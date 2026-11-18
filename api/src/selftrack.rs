//! Raterlog tracks itself with Raterlog.
//!
//! Set `RATERLOG_SELF_EMAIL` to the operator's account email. On first use the
//! server finds (or creates) a project called `raterlog` owned by that account,
//! puts it on the top plan so it is never quota-blocked, and logs product events
//! into it: signups, projects, activation, invites, billing and deploys.
//!
//! Tracking is fire-and-forget: it runs on a spawned task, never blocks or fails
//! a request, and is a no-op when the env var is unset or the account does not
//! exist yet. Events are written straight to ClickHouse (no HTTP round trip and
//! no quota check), so the ingest path can call it without recursion.

use crate::ch::{next_event_id, Event};
use crate::pg;
use crate::state::AppState;
use crate::util::generate_id;
use actix_web::web::Data;
use chrono::Utc;
use std::collections::BTreeMap;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

const PROJECT_NAME: &str = "raterlog";
const PROJECT_PLAN: &str = "scale";
const RETRY_AFTER: Duration = Duration::from_secs(10);

#[derive(Default)]
struct Resolved {
    project_id: Option<String>,
    last_attempt: Option<Instant>,
}

pub struct SelfTrack {
    email: Option<String>,
    resolved: Mutex<Resolved>,
}

impl SelfTrack {
    pub fn from_env() -> Self {
        let email = std::env::var("RATERLOG_SELF_EMAIL")
            .ok()
            .map(|s| s.trim().to_lowercase())
            .filter(|s| !s.is_empty());
        if let Some(e) = &email {
            tracing::info!("self-tracking enabled for {e}");
        }
        Self {
            email,
            resolved: Mutex::new(Resolved::default()),
        }
    }

    pub fn enabled(&self) -> bool {
        self.email.is_some()
    }
}

/// One self-tracked event.
pub struct Track {
    pub channel: &'static str,
    pub event: String,
    pub description: String,
    pub icon: &'static str,
    pub notify: bool,
    pub user_id: String,
    pub tags: BTreeMap<String, String>,
}

impl Track {
    pub fn new(channel: &'static str, icon: &'static str, event: impl Into<String>) -> Self {
        Self {
            channel,
            event: event.into(),
            description: String::new(),
            icon,
            notify: false,
            user_id: String::new(),
            tags: BTreeMap::new(),
        }
    }
    pub fn desc(mut self, d: impl Into<String>) -> Self {
        self.description = d.into();
        self
    }
    pub fn notify(mut self) -> Self {
        self.notify = true;
        self
    }
    pub fn user(mut self, id: impl Into<String>) -> Self {
        self.user_id = id.into();
        self
    }
    pub fn tag(mut self, k: &str, v: impl Into<String>) -> Self {
        self.tags.insert(k.to_string(), v.into());
        self
    }
}

/// Side effects that go with an event: KPI tiles and identified users.
#[derive(Default)]
pub struct Extras {
    pub increment: Vec<(&'static str, &'static str)>, // (insight title, icon)
    pub identify: Option<(String, serde_json::Value)>, // (user_id, properties)
}

/// Fire-and-forget.
pub fn track(state: &Data<AppState>, t: Track) {
    track_with(state, t, Extras::default());
}

pub fn track_with(state: &Data<AppState>, t: Track, extras: Extras) {
    if !state.selftrack.enabled() {
        return;
    }
    let state = state.clone();
    tokio::spawn(async move {
        if let Err(e) = write(&state, t, extras).await {
            tracing::warn!("self-tracking failed: {e}");
        }
    });
}

/// Call after a signup: if it is the operator's account, look it up right away
/// instead of waiting out the retry window.
pub async fn on_signup(state: &AppState, email: &str) {
    if state.selftrack.email.as_deref() == Some(email) {
        state.selftrack.resolved.lock().await.last_attempt = None;
    }
}

async fn forget(state: &AppState) {
    let mut r = state.selftrack.resolved.lock().await;
    r.project_id = None;
    r.last_attempt = None;
}

/// The self project id, if it exists (used to skip tracking our own activity).
pub async fn project_id(state: &AppState) -> Option<String> {
    state.selftrack.resolved.lock().await.project_id.clone()
}

async fn resolve(state: &AppState) -> Result<Option<String>, String> {
    let Some(email) = state.selftrack.email.as_deref() else {
        return Ok(None);
    };
    let mut r = state.selftrack.resolved.lock().await;
    if let Some(id) = &r.project_id {
        return Ok(Some(id.clone()));
    }
    if r.last_attempt.is_some_and(|t| t.elapsed() < RETRY_AFTER) {
        return Ok(None);
    }
    r.last_attempt = Some(Instant::now());

    let Some((user, _)) = pg::user_by_email(&state.client, email)
        .await
        .map_err(|e| e.to_string())?
    else {
        tracing::info!("self-tracking: no account for {email} yet");
        return Ok(None);
    };
    let companies = pg::companies_for_user(&state.client, &user.id)
        .await
        .map_err(|e| e.to_string())?;
    let id = match companies.iter().find(|c| c.name.eq_ignore_ascii_case(PROJECT_NAME)) {
        Some(c) => c.id.clone(),
        None => {
            let c = pg::create_company(&state.client, &generate_id(15), PROJECT_NAME, &user.id)
                .await
                .map_err(|e| e.to_string())?;
            tracing::info!("self-tracking: created project {} for {email}", c.id);
            c.id
        }
    };
    // Top plan: never quota-blocked, longest retention.
    let _ = pg::set_company_plan(&state.client, &id, PROJECT_PLAN, None, None).await;
    r.project_id = Some(id.clone());
    Ok(Some(id))
}

async fn write(state: &AppState, t: Track, extras: Extras) -> Result<(), String> {
    let Some(project) = resolve(state).await? else {
        return Ok(());
    };
    // The project may have been deleted since we cached it.
    if !matches!(pg::company_by_id(&state.client, &project).await, Ok(Some(_))) {
        forget(state).await;
        return Ok(());
    }
    let name = t.channel.to_lowercase();
    let channel = match pg::channel_by_name(&state.client, &project, &name)
        .await
        .map_err(|e| e.to_string())?
    {
        Some(c) => c,
        None => pg::create_channel(&state.client, &generate_id(15), &project, &name, t.icon)
            .await
            .map_err(|e| e.to_string())?,
    };
    let now = Utc::now();
    let ev = Event {
        id: next_event_id(now),
        company_id: project.clone(),
        channel_id: channel.id.clone(),
        channel: channel.name.clone(),
        event: t.event,
        description: t.description,
        icon: t.icon.to_string(),
        tags: t.tags,
        user_id: t.user_id,
        notify: t.notify,
        timestamp: now.to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
    };
    state.ch.insert(&ev).await?;
    state.quota.bump(&project);

    for (title, icon) in extras.increment {
        let _ = pg::mutate_insight(&state.client, &project, title, 1.0, Some(icon), &generate_id(15)).await;
    }
    if let Some((uid, props)) = extras.identify {
        let _ = pg::upsert_identified_user(&state.client, &generate_id(15), &project, &uid, props).await;
    }
    Ok(())
}
