//! Event ingestion (LogSnag-compatible `/v1/log` + legacy `/api/logs`) and the
//! dashboard event feed.

use crate::billing;
use crate::ch::{next_event_id, Event, EventFilter, PublicEvent};
use crate::pg;
use crate::state::AppState;
use crate::util::{api_token_from_request, error_json, generate_id, json_created, json_ok};
use actix_web::{get, http::StatusCode, post, web, HttpRequest, HttpResponse};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use std::collections::{BTreeMap, HashMap};

use super::{company_id_from_api_token, require_channel_read, require_company_member, retention_since};

#[derive(Debug, Deserialize)]
struct LegacyLogInput {
    channel_id: String,
    event_name: String,
    #[serde(default)]
    event_payload: String,
    metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct LogSnagInput {
    project: String,
    channel: String,
    event: String,
    description: Option<String>,
    icon: Option<String>,
    notify: Option<bool>,
    tags: Option<serde_json::Value>,
    user_id: Option<String>,
    timestamp: Option<f64>,
}

pub fn value_to_tags(v: Option<&serde_json::Value>) -> BTreeMap<String, String> {
    let mut out = BTreeMap::new();
    if let Some(serde_json::Value::Object(map)) = v {
        for (k, v) in map.iter().take(50) {
            let s = match v {
                serde_json::Value::String(s) => s.clone(),
                serde_json::Value::Null => continue,
                other => other.to_string(),
            };
            out.insert(k.chars().take(64).collect(), s.chars().take(512).collect());
        }
    }
    out
}

pub struct NewEvent {
    pub event: String,
    pub description: String,
    pub icon: Option<String>,
    pub tags: BTreeMap<String, String>,
    pub user_id: String,
    pub notify: bool,
    pub at: Option<DateTime<Utc>>,
}

async fn ingest(
    state: &web::Data<AppState>,
    company_id: &str,
    channel: &pg::Channel,
    e: NewEvent,
) -> Result<PublicEvent, HttpResponse> {
    ingest_event(state, company_id, channel, e)
        .await
        .map_err(|(status, msg)| error_json(status, &msg))
}

/// Quota check → insert into ClickHouse → bump the counter. Shared by the
/// HTTP ingest routes and the MCP server.
pub async fn ingest_event(
    state: &web::Data<AppState>,
    company_id: &str,
    channel: &pg::Channel,
    e: NewEvent,
) -> Result<PublicEvent, (StatusCode, String)> {
    let plan = match pg::company_billing(&state.client, company_id).await {
        Ok(Some(b)) => billing::plan(&b.plan),
        Ok(None) => return Err((StatusCode::UNAUTHORIZED, "unknown project".into())),
        Err(e) => return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    };
    let used = match state.quota.get_fresh(company_id) {
        Some(n) => n,
        None => {
            let (start, _) = billing::current_period();
            let n = state.ch.count_since(company_id, start).await.unwrap_or(0);
            state.quota.set(company_id, n);
            n
        }
    };
    // Free projects stop at their limit; paid projects keep ingesting (we
    // never drop a paying customer's data) and get nudged to upgrade.
    if plan.id == "free" && plan.events_limit >= 0 && used >= plan.events_limit as u64 {
        return Err((
            StatusCode::PAYMENT_REQUIRED,
            "monthly event limit reached for the free plan; upgrade at /app to keep ingesting".into(),
        ));
    }

    let at = e.at.unwrap_or_else(Utc::now);
    let ev = Event {
        id: next_event_id(at),
        company_id: company_id.to_string(),
        channel_id: channel.id.clone(),
        channel: channel.name.clone(),
        event: e.event.chars().take(200).collect(),
        description: e.description.chars().take(10_000).collect(),
        icon: e
            .icon
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| channel.icon.clone()),
        tags: e.tags,
        user_id: e.user_id.chars().take(256).collect(),
        notify: e.notify,
        timestamp: at.to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
    };
    state
        .ch
        .insert(&ev)
        .await
        .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err))?;
    state.quota.bump(company_id);
    if used == 0 && state.selftrack.enabled() {
        let st = state.clone();
        let cid = company_id.to_string();
        let channel_name = channel.name.clone();
        tokio::spawn(async move {
            if crate::selftrack::project_id(&st).await.as_deref() == Some(cid.as_str()) {
                return;
            }
            let name = match pg::company_by_id(&st.client, &cid).await {
                Ok(Some(c)) => c.name,
                _ => cid.clone(),
            };
            crate::selftrack::track_with(
                &st,
                crate::selftrack::Track::new("activation", "📡", "First event received")
                    .desc(format!("{name} → #{channel_name}"))
                    .tag("project", cid)
                    .notify(),
                crate::selftrack::Extras { increment: vec![("Activated projects", "📡")], identify: None },
            );
        });
    }
    Ok(ev.into())
}

/// Find a channel by name (case-insensitive) or create it, LogSnag-style.
pub async fn resolve_channel(
    state: &web::Data<AppState>,
    company_id: &str,
    name: &str,
    icon: Option<&str>,
) -> Result<pg::Channel, String> {
    let name = name.trim().to_lowercase();
    if name.is_empty() {
        return Err("channel is required".into());
    }
    match pg::channel_by_name(&state.client, company_id, &name).await {
        Ok(Some(c)) => Ok(c),
        Ok(None) => pg::create_channel(
            &state.client,
            &generate_id(15),
            company_id,
            &name,
            icon.filter(|s| !s.is_empty()).unwrap_or("📡"),
        )
        .await
        .map_err(|e| format!("failed to create channel: {e}")),
        Err(e) => Err(e.to_string()),
    }
}

async fn legacy_create(req: HttpRequest, data: LegacyLogInput, state: web::Data<AppState>) -> HttpResponse {
    let Some(token) = api_token_from_request(&req) else {
        return error_json(StatusCode::UNAUTHORIZED, "api token is required to ingest events");
    };
    match pg::verify_token_for_channel(&state.client, &token, &data.channel_id).await {
        Ok(Some(scope)) if scope.can_ingest() => {}
        Ok(Some(scope)) => {
            return error_json(
                StatusCode::FORBIDDEN,
                &format!("token scope '{scope}' cannot ingest; use an ingest or full token"),
            )
        }
        Ok(None) => return error_json(StatusCode::UNAUTHORIZED, "invalid api token"),
        Err(e) => return error_json(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
    let channel = match pg::channel_by_id(&state.client, &data.channel_id).await {
        Ok(Some(c)) => c,
        Ok(None) => return error_json(StatusCode::NOT_FOUND, "channel not found"),
        Err(e) => return error_json(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    };
    let company_id = channel.company_id.clone();
    let ne = NewEvent {
        event: data.event_name,
        description: data.event_payload,
        icon: None,
        tags: value_to_tags(data.metadata.as_ref()),
        user_id: String::new(),
        notify: false,
        at: None,
    };
    match ingest(&state, &company_id, &channel, ne).await {
        Ok(ev) => json_created(ev),
        Err(resp) => resp,
    }
}

#[post("/log")]
pub async fn create_log_compat(req: HttpRequest, body: web::Json<LegacyLogInput>, state: web::Data<AppState>) -> HttpResponse {
    legacy_create(req, body.into_inner(), state).await
}

#[post("/api/logs")]
pub async fn create_log(req: HttpRequest, body: web::Json<LegacyLogInput>, state: web::Data<AppState>) -> HttpResponse {
    legacy_create(req, body.into_inner(), state).await
}

async fn channel_events(
    req: HttpRequest,
    channel_id: String,
    state: web::Data<AppState>,
    q: HashMap<String, String>,
) -> HttpResponse {
    if let Err(resp) = require_channel_read(&req, &state, &channel_id).await {
        return resp;
    }
    let channel = match pg::channel_by_id(&state.client, &channel_id).await {
        Ok(Some(c)) => c,
        Ok(None) => return error_json(StatusCode::NOT_FOUND, "channel not found"),
        Err(e) => return error_json(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    };
    let floor = retention_since(&state, &channel.company_id).await;
    let since = q.get("since").and_then(|v| v.parse::<u64>().ok());
    let f = EventFilter {
        channel_id: Some(channel_id),
        limit: q.get("limit").and_then(|v| v.parse().ok()).unwrap_or(100),
        since: Some(since.map_or(floor, |s| s.max(floor))),
        before: q.get("before").and_then(|v| v.parse().ok()),
        ..Default::default()
    };
    match state.ch.list(&channel.company_id, &f).await {
        Ok(rows) => json_ok(rows.into_iter().map(PublicEvent::from).collect::<Vec<_>>()),
        Err(e) => error_json(StatusCode::INTERNAL_SERVER_ERROR, &e),
    }
}

#[get("/log/{channel_id}")]
pub async fn get_logs_compat(req: HttpRequest, path: web::Path<String>, state: web::Data<AppState>, q: web::Query<HashMap<String, String>>) -> HttpResponse {
    channel_events(req, path.into_inner(), state, q.into_inner()).await
}

#[get("/api/logs/{channel_id}")]
pub async fn get_logs(req: HttpRequest, path: web::Path<String>, state: web::Data<AppState>, q: web::Query<HashMap<String, String>>) -> HttpResponse {
    channel_events(req, path.into_inner(), state, q.into_inner()).await
}

#[post("/v1/log")]
pub async fn create_logsnag_log(req: HttpRequest, body: web::Json<LogSnagInput>, state: web::Data<AppState>) -> HttpResponse {
    let company_id = match company_id_from_api_token(&req, &state).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };
    let body = body.into_inner();
    let project = body.project.trim();
    let channel_name = body.channel.trim().to_lowercase();
    let event = body.event.trim();
    if project.is_empty() || channel_name.is_empty() || event.is_empty() {
        return error_json(StatusCode::BAD_REQUEST, "project, channel, and event are required");
    }
    let company = match pg::company_by_id(&state.client, &company_id).await {
        Ok(Some(c)) => c,
        Ok(None) => return error_json(StatusCode::UNAUTHORIZED, "invalid api token"),
        Err(e) => return error_json(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    };
    // The token decides the project; `project` must name it (case-insensitive)
    // or be its id, so a token can never write into someone else's project.
    if !company.name.eq_ignore_ascii_case(project) && company.id != project {
        return error_json(StatusCode::FORBIDDEN, "token does not belong to this project");
    }

    let channel = match resolve_channel(&state, &company_id, &channel_name, body.icon.as_deref()).await {
        Ok(c) => c,
        Err(e) => return error_json(StatusCode::INTERNAL_SERVER_ERROR, &e),
    };

    let ne = NewEvent {
        event: event.to_string(),
        description: body.description.unwrap_or_default(),
        icon: body.icon,
        tags: value_to_tags(body.tags.as_ref()),
        user_id: body.user_id.unwrap_or_default(),
        notify: body.notify.unwrap_or(false),
        at: body.timestamp.and_then(|ts| DateTime::<Utc>::from_timestamp(ts as i64, 0)),
    };
    match ingest(&state, &company_id, &channel, ne).await {
        Ok(ev) => json_created(ev),
        Err(resp) => resp,
    }
}

#[get("/health")]
pub async fn health(state: web::Data<AppState>) -> HttpResponse {
    let pg_ok = state.client.query_one("SELECT 1", &[]).await.is_ok();
    let ch_ok = state.ch.ping().await;
    let body = serde_json::json!({ "status": if pg_ok && ch_ok { "ok" } else { "degraded" }, "postgres": pg_ok, "clickhouse": ch_ok });
    if pg_ok && ch_ok {
        json_ok(body)
    } else {
        HttpResponse::ServiceUnavailable().json(body)
    }
}

#[get("/api/companies/{company_id}/channels/{channel_id}")]
pub async fn channel_detail(req: HttpRequest, path: web::Path<(String, String)>, state: web::Data<AppState>) -> HttpResponse {
    let (company_id, channel_id) = path.into_inner();
    if let Err(resp) = require_company_member(&req, &state, &company_id).await {
        return resp;
    }
    match pg::channel_by_id(&state.client, &channel_id).await {
        Ok(Some(channel)) if channel.company_id == company_id => json_ok(channel),
        Ok(_) => error_json(StatusCode::NOT_FOUND, "channel not found"),
        Err(e) => error_json(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

#[actix_web::delete("/api/companies/{company_id}/channels/{channel_id}")]
pub async fn delete_channel(req: HttpRequest, path: web::Path<(String, String)>, state: web::Data<AppState>) -> HttpResponse {
    let (company_id, channel_id) = path.into_inner();
    if let Err(resp) = require_company_member(&req, &state, &company_id).await {
        return resp;
    }
    match pg::delete_channel(&state.client, &company_id, &channel_id).await {
        Ok(0) => error_json(StatusCode::NOT_FOUND, "channel not found"),
        Ok(_) => {
            if let Err(e) = state.ch.delete_channel(&company_id, &channel_id).await {
                tracing::warn!("channel {channel_id} deleted but events remain: {e}");
            }
            json_ok(serde_json::json!({ "ok": true }))
        }
        Err(e) => error_json(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Dashboard feed: GET /api/companies/{id}/events?channel=&event=&user_id=&tag=k:v&q=&before=&since=&limit=
#[get("/api/companies/{company_id}/events")]
pub async fn company_events(req: HttpRequest, path: web::Path<String>, state: web::Data<AppState>, q: web::Query<HashMap<String, String>>) -> HttpResponse {
    let company_id = path.into_inner();
    if let Err(resp) = require_company_member(&req, &state, &company_id).await {
        return resp;
    }
    let nonempty = |k: &str| q.get(k).map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    let floor = retention_since(&state, &company_id).await;
    let since = nonempty("since").and_then(|v| v.parse::<u64>().ok());
    let f = EventFilter {
        channel_id: nonempty("channel"),
        event: nonempty("event"),
        user_id: nonempty("user_id"),
        tag: nonempty("tag").and_then(|t| t.split_once(':').map(|(k, v)| (k.trim().to_string(), v.trim().to_string()))),
        q: nonempty("q"),
        before: nonempty("before").and_then(|v| v.parse().ok()),
        since: Some(since.map_or(floor, |s| s.max(floor))),
        limit: nonempty("limit").and_then(|v| v.parse().ok()).unwrap_or(50),
    };
    match state.ch.list(&company_id, &f).await {
        Ok(rows) => json_ok(rows.into_iter().map(PublicEvent::from).collect::<Vec<_>>()),
        Err(e) => error_json(StatusCode::INTERNAL_SERVER_ERROR, &e),
    }
}
