//! Server-side threshold monitors (Axiom-style), evaluated against ClickHouse.
//!
//! A background task wakes every 60s, takes a Postgres advisory lock so only
//! one replica runs the tick, then runs one cheap `count()` query per enabled
//! monitor. On ok → alerting it notifies every configured target (emails via
//! SMTP, webhook URLs — Slack/Discord payloads are detected by URL host, other
//! URLs get a generic JSON POST); on alerting → ok it optionally sends a
//! "resolved" notice. `cooldown_minutes` suppresses repeated alerts.

use crate::mail;
use crate::pg::{self, Monitor};
use crate::state::AppState;
use crate::util::valid_email;
use actix_web::web::Data;
use chrono::{DateTime, Duration, Utc};
use serde::Deserialize;
use serde_json::{json, Value};
use url::Url;

/// Arbitrary session lock key; the value only has to be stable across replicas.
const LOCK_KEY: i64 = 727_001_001;
const TICK_SECS: u64 = 60;
const MAX_MINUTES: i32 = 7 * 24 * 60; // 7 days

pub const CONDITIONS: &[&str] = &["count_above", "count_below", "absent"];

/// Raw monitor fields from the dashboard API or MCP. Missing fields fall back
/// to the existing row on update, or to defaults on create.
#[derive(Debug, Deserialize, Default)]
pub struct MonitorInput {
    pub name: Option<String>,
    pub enabled: Option<bool>,
    pub channel: Option<String>,
    pub event: Option<String>,
    /// Tag filter as "key:value".
    pub tag: Option<String>,
    pub condition: Option<String>,
    pub threshold: Option<i64>,
    pub window_minutes: Option<i32>,
    pub cooldown_minutes: Option<i32>,
    pub notify_emails: Option<Vec<String>>,
    pub webhook_urls: Option<Vec<String>>,
    pub notify_resolved: Option<bool>,
}

/// Fully validated monitor fields, ready to persist.
pub struct MonitorSpec {
    pub name: String,
    pub enabled: bool,
    pub channel: Option<String>,
    pub event: Option<String>,
    pub tag: Option<String>,
    pub condition: String,
    pub threshold: i64,
    pub window_minutes: i32,
    pub cooldown_minutes: i32,
    pub notify_emails: Vec<String>,
    pub webhook_urls: Vec<String>,
    pub notify_resolved: bool,
}

fn clean(s: Option<String>) -> Option<String> {
    s.map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
}

/// Validate raw input into a spec. `base` is the existing monitor for PATCH
/// (absent fields keep their current values); `None` means create.
pub fn spec_from_input(i: MonitorInput, base: Option<&Monitor>) -> Result<MonitorSpec, String> {
    let name = match clean(i.name).or_else(|| base.map(|b| b.name.clone())) {
        Some(n) => n,
        None => return Err("name is required".into()),
    };
    let condition = match clean(i.condition).or_else(|| base.map(|b| b.condition.clone())) {
        Some(c) if CONDITIONS.contains(&c.as_str()) => c,
        Some(c) => return Err(format!("unknown condition '{c}' (expected one of {CONDITIONS:?})")),
        None => return Err("condition is required".into()),
    };
    let threshold = match i.threshold.or_else(|| base.map(|b| b.threshold)) {
        _ if condition == "absent" => 0,
        Some(t) if t >= 0 => t,
        Some(_) => return Err("threshold must be >= 0".into()),
        None => return Err("threshold is required for count conditions".into()),
    };
    let window_minutes = i
        .window_minutes
        .or_else(|| base.map(|b| b.window_minutes))
        .unwrap_or(60);
    if !(1..=MAX_MINUTES).contains(&window_minutes) {
        return Err(format!("window_minutes must be 1..{MAX_MINUTES}"));
    }
    let cooldown_minutes = i
        .cooldown_minutes
        .or_else(|| base.map(|b| b.cooldown_minutes))
        .unwrap_or(60);
    if !(0..=MAX_MINUTES).contains(&cooldown_minutes) {
        return Err(format!("cooldown_minutes must be 0..{MAX_MINUTES}"));
    }
    let tag_input = i.tag;
    let tag = match clean(tag_input.clone()) {
        Some(t) => match t.split_once(':') {
            Some((k, v)) if !k.trim().is_empty() && !v.trim().is_empty() => {
                Some(format!("{}:{}", k.trim(), v.trim()))
            }
            _ => return Err("tag must be a 'key:value' pair".into()),
        },
        None if tag_input.is_some() => None, // explicit empty string clears it
        None => base.and_then(|b| b.tag.clone()),
    };
    let pick_opt = |v: Option<String>, old: Option<&String>| -> Option<String> {
        match v {
            Some(s) if s.trim().is_empty() => None, // explicit clear
            Some(s) => Some(s.trim().to_string()),
            None => old.cloned(),
        }
    };
    let notify_emails = i
        .notify_emails
        .or_else(|| base.map(|b| b.notify_emails.clone()))
        .unwrap_or_default()
        .into_iter()
        .map(|e| e.trim().to_lowercase())
        .filter(|e| !e.is_empty())
        .collect::<Vec<_>>();
    for e in &notify_emails {
        if !valid_email(e) {
            return Err(format!("invalid email '{e}'"));
        }
    }
    let webhook_urls = i
        .webhook_urls
        .or_else(|| base.map(|b| b.webhook_urls.clone()))
        .unwrap_or_default()
        .into_iter()
        .map(|u| u.trim().to_string())
        .filter(|u| !u.is_empty())
        .collect::<Vec<_>>();
    for u in &webhook_urls {
        match Url::parse(u) {
            Ok(parsed) if matches!(parsed.scheme(), "http" | "https") => {}
            _ => return Err(format!("webhook '{u}' must be an http(s) URL")),
        }
    }
    Ok(MonitorSpec {
        name,
        enabled: i.enabled.or_else(|| base.map(|b| b.enabled)).unwrap_or(true),
        channel: pick_opt(i.channel, base.and_then(|b| b.channel.as_ref())),
        event: pick_opt(i.event, base.and_then(|b| b.event.as_ref())),
        tag,
        condition,
        threshold,
        window_minutes,
        cooldown_minutes,
        notify_emails,
        webhook_urls,
        notify_resolved: i
            .notify_resolved
            .or_else(|| base.map(|b| b.notify_resolved))
            .unwrap_or(true),
    })
}

/// Is the monitor's condition met for this count?
pub fn violated(condition: &str, count: u64, threshold: i64) -> bool {
    match condition {
        "count_above" => count as i64 > threshold,
        "count_below" => (count as i64) < threshold,
        "absent" => count == 0,
        _ => false,
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NotifyKind {
    Alert,
    Resolved,
}

pub struct Verdict {
    pub new_state: &'static str,
    pub notify: Option<NotifyKind>,
}

/// Pure state machine: current state + this tick's count → next state and any
/// notification. Fires at most once per alerting episode; `cooldown_minutes`
/// must elapse since the last alert before a new episode can notify.
#[allow(clippy::too_many_arguments)]
pub fn evaluate(
    condition: &str,
    threshold: i64,
    count: u64,
    state: &str,
    last_triggered_at: Option<DateTime<Utc>>,
    cooldown_minutes: i64,
    notify_resolved: bool,
    now: DateTime<Utc>,
) -> Verdict {
    if violated(condition, count, threshold) {
        let cooling = last_triggered_at
            .map(|t| now - t < Duration::minutes(cooldown_minutes.max(0)))
            .unwrap_or(false);
        let notify = if state != "alerting" && !cooling {
            Some(NotifyKind::Alert)
        } else {
            None
        };
        Verdict { new_state: "alerting", notify }
    } else {
        let notify = if state == "alerting" && notify_resolved {
            Some(NotifyKind::Resolved)
        } else {
            None
        };
        Verdict { new_state: "ok", notify }
    }
}

/// "channel \"payments\", event \"X\", tag \"plan:pro\"" — for messages.
pub fn filter_text(m: &Monitor) -> String {
    let mut parts = vec![];
    if let Some(c) = &m.channel {
        parts.push(format!("channel \"{c}\""));
    }
    if let Some(e) = &m.event {
        parts.push(format!("event \"{e}\""));
    }
    if let Some(t) = &m.tag {
        parts.push(format!("tag \"{t}\""));
    }
    if parts.is_empty() {
        "all events".into()
    } else {
        parts.join(", ")
    }
}

/// "more than 100 events in 60m" — for messages.
fn condition_text(m: &Monitor) -> String {
    match m.condition.as_str() {
        "count_above" => format!("more than {} events", m.threshold),
        "count_below" => format!("fewer than {} events", m.threshold),
        _ => "no events".into(),
    }
}

fn messages(m: &Monitor, kind: NotifyKind, count: u64) -> (String, String) {
    match kind {
        NotifyKind::Alert => (
            format!("[Raterlog] Monitor \"{}\" is alerting", m.name),
            format!(
                "Monitor \"{}\" is alerting.\n\nCondition: {} in {}m — saw {count}.\nFilter: {}\n",
                m.name,
                condition_text(m),
                m.window_minutes,
                filter_text(m),
            ),
        ),
        NotifyKind::Resolved => (
            format!("[Raterlog] Monitor \"{}\" recovered", m.name),
            format!(
                "Monitor \"{}\" recovered.\n\n{} events matched in the last {}m ({}).\nFilter: {}\n",
                m.name,
                count,
                m.window_minutes,
                condition_text(m),
                filter_text(m),
            ),
        ),
    }
}

/// Slack and Discord payloads are detected by URL host; anything else gets a
/// generic JSON POST describing the monitor and what happened.
fn webhook_payload(parsed: &Url, m: &Monitor, kind: &str, title: &str, text: &str, count: Option<u64>) -> Value {
    let host = parsed.host_str().unwrap_or_default().to_lowercase();
    if host == "hooks.slack.com" {
        json!({ "text": format!("*{title}*\n{text}") })
    } else if host.ends_with("discord.com") || host.ends_with("discordapp.com") {
        json!({ "content": format!("**{title}**\n{text}") })
    } else {
        json!({
            "text": text,
            "title": title,
            "state": kind,
            "count": count,
            "monitor": {
                "id": m.id, "name": m.name, "condition": m.condition,
                "threshold": m.threshold, "window_minutes": m.window_minutes,
                "channel": m.channel, "event": m.event, "tag": m.tag,
            },
        })
    }
}

/// Webhook targets are user-supplied, so never let the server POST to its own
/// network (ClickHouse, Postgres, cloud metadata, localhost). Resolves the
/// host and rejects it unless every address is publicly routable.
async fn public_addr(url: &Url) -> Result<std::net::SocketAddr, String> {
    let host = url.host_str().ok_or("webhook url has no host")?;
    let port = url.port_or_known_default().unwrap_or(443);
    let addrs: Vec<std::net::SocketAddr> = tokio::net::lookup_host((host.trim_matches(['[', ']']), port))
        .await
        .map_err(|e| format!("webhook host {host}: {e}"))?
        .collect();
    if addrs.is_empty() {
        return Err(format!("webhook host {host} did not resolve"));
    }
    if let Some(bad) = addrs.iter().find(|a| !is_public_ip(a.ip())) {
        return Err(format!("webhook host {host} resolves to non-public address {}", bad.ip()));
    }
    Ok(addrs[0])
}

fn is_public_ip(ip: std::net::IpAddr) -> bool {
    use std::net::IpAddr;
    match ip {
        IpAddr::V4(v4) => {
            let o = v4.octets();
            !(v4.is_private()
                || v4.is_loopback()
                || v4.is_link_local()
                || v4.is_broadcast()
                || v4.is_documentation()
                || v4.is_unspecified()
                || o[0] == 0
                || (o[0] == 100 && (64..128).contains(&o[1])) // CGNAT
                || (o[0] == 198 && (o[1] & 0xfe) == 18) // benchmarking
                || o[0] >= 224) // multicast + reserved
        }
        IpAddr::V6(v6) => {
            if let Some(v4) = v6.to_ipv4_mapped() {
                return is_public_ip(IpAddr::V4(v4));
            }
            let seg = v6.segments();
            !(v6.is_loopback()
                || v6.is_unspecified()
                || v6.is_multicast()
                || (seg[0] & 0xfe00) == 0xfc00 // unique local
                || (seg[0] & 0xffc0) == 0xfe80) // link local
        }
    }
}

async fn post_webhook(raw: &str, m: &Monitor, kind: &str, title: &str, text: &str, count: Option<u64>) -> Result<(), String> {
    let url = Url::parse(raw).map_err(|e| format!("bad url: {e}"))?;
    let addr = public_addr(&url).await?;
    let body = webhook_payload(&url, m, kind, title, text, count);
    let res = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        // Pin the vetted address (no DNS rebinding) and refuse redirects, which
        // could otherwise bounce the request to an internal service.
        .resolve(url.host_str().unwrap_or_default(), addr)
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| e.to_string())?
        .post(url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("webhook: {e}"))?;
    let status = res.status();
    if status.is_success() {
        Ok(())
    } else {
        Err(format!("webhook returned {status}"))
    }
}

/// Send a notice to every configured target. Returns per-target results so the
/// /test endpoint can report them; the evaluator just logs failures.
pub async fn deliver(
    state: &AppState,
    m: &Monitor,
    kind: &str,
    title: &str,
    text: &str,
    count: Option<u64>,
) -> Vec<(String, Result<(), String>)> {
    let mut out = Vec::new();
    for to in &m.notify_emails {
        let r = if state.smtp_host.is_empty() {
            Err("SMTP is not configured on this server".into())
        } else {
            mail::send_email(&state.smtp_host, state.smtp_port, to, title, text).await
        };
        out.push((format!("email {to}"), r));
    }
    for url in &m.webhook_urls {
        let r = post_webhook(url, m, kind, title, text, count).await;
        out.push((format!("webhook {url}"), r));
    }
    out
}

/// Test-notification helper for `POST .../monitors/{id}/test`.
pub async fn deliver_test(state: &AppState, m: &Monitor) -> Vec<(String, Result<(), String>)> {
    let (title, text) = (
        format!("[Raterlog] Test: monitor \"{}\"", m.name),
        format!(
            "This is a test notification for monitor \"{}\".\n\nCondition: {} in {}m.\nFilter: {}\n",
            m.name,
            condition_text(m),
            m.window_minutes,
            filter_text(m),
        ),
    );
    deliver(state, m, "test", &title, &text, None).await
}

async fn check_one(state: &Data<AppState>, m: &Monitor) -> Result<(), String> {
    let now = Utc::now();
    let from = now - Duration::minutes(m.window_minutes as i64);
    let tag = m
        .tag
        .as_deref()
        .and_then(|t| t.split_once(':'))
        .map(|(k, v)| (k.trim(), v.trim()));
    let count = state
        .ch
        .count_matching(&m.company_id, from, m.channel.as_deref(), m.event.as_deref(), tag)
        .await?;
    let v = evaluate(
        &m.condition,
        m.threshold,
        count,
        &m.state,
        m.last_triggered_at,
        m.cooldown_minutes as i64,
        m.notify_resolved,
        now,
    );
    pg::monitor_check_done(
        &state.client,
        &m.id,
        v.new_state,
        now,
        v.notify == Some(NotifyKind::Alert),
    )
    .await
    .map_err(|e| e.to_string())?;
    if let Some(kind) = v.notify {
        let (title, text) = messages(m, kind, count);
        let payload_state = match kind {
            NotifyKind::Alert => "alerting",
            NotifyKind::Resolved => "ok",
        };
        for (target, res) in deliver(state, m, payload_state, &title, &text, Some(count)).await {
            if let Err(e) = res {
                tracing::warn!("monitor {} ({}) notify {target} failed: {e}", m.id, m.name);
            }
        }
    }
    Ok(())
}

async fn run_tick(state: &Data<AppState>) -> Result<(), String> {
    let monitors = pg::enabled_monitors(&state.client)
        .await
        .map_err(|e| e.to_string())?;
    for m in monitors {
        if let Err(e) = check_one(state, &m).await {
            tracing::warn!("monitor {} ({}) check failed: {e}", m.id, m.name);
        }
    }
    Ok(())
}

/// One evaluation pass behind a Postgres advisory lock — with several replicas
/// only one runs each tick; the others' `pg_try_advisory_lock` returns false.
async fn tick(state: &Data<AppState>) {
    match pg::try_advisory_lock(&state.client, LOCK_KEY).await {
        Ok(true) => {}
        Ok(false) => return,
        Err(e) => {
            tracing::warn!("monitor lock: {e}");
            return;
        }
    }
    let res = run_tick(state).await;
    if let Err(e) = pg::advisory_unlock(&state.client, LOCK_KEY).await {
        tracing::warn!("monitor unlock: {e}");
    }
    if let Err(e) = res {
        tracing::warn!("monitor tick: {e}");
    }
}

/// Spawned at startup: evaluates every enabled monitor once a minute.
pub fn spawn(state: Data<AppState>) {
    tokio::spawn(async move {
        let mut iv = tokio::time::interval(std::time::Duration::from_secs(TICK_SECS));
        loop {
            iv.tick().await;
            tick(&state).await;
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn at(min: i64) -> DateTime<Utc> {
        Utc.timestamp_opt(1_700_000_000 + min * 60, 0).unwrap()
    }

    #[test]
    fn conditions() {
        assert!(violated("count_above", 11, 10));
        assert!(!violated("count_above", 10, 10));
        assert!(violated("count_below", 9, 10));
        assert!(!violated("count_below", 10, 10));
        assert!(violated("absent", 0, 0));
        assert!(!violated("absent", 1, 0));
        assert!(!violated("bogus", 100, 10));
    }

    #[test]
    fn ok_to_alerting_notifies() {
        let v = evaluate("count_above", 10, 50, "ok", None, 60, true, at(0));
        assert_eq!(v.new_state, "alerting");
        assert_eq!(v.notify, Some(NotifyKind::Alert));
    }

    #[test]
    fn stays_alerting_quietly() {
        let v = evaluate("count_above", 10, 50, "alerting", Some(at(-30)), 60, true, at(0));
        assert_eq!(v.new_state, "alerting");
        assert_eq!(v.notify, None);
    }

    #[test]
    fn cooldown_suppresses_new_episode() {
        // resolved 30m ago, cooldown 60m → no notification, but still alerting.
        let v = evaluate("count_above", 10, 50, "ok", Some(at(-30)), 60, true, at(0));
        assert_eq!(v.new_state, "alerting");
        assert_eq!(v.notify, None);
        // cooldown elapsed → notify again.
        let v = evaluate("count_above", 10, 50, "ok", Some(at(-61)), 60, true, at(0));
        assert_eq!(v.notify, Some(NotifyKind::Alert));
    }

    #[test]
    fn resolving() {
        let v = evaluate("count_above", 10, 5, "alerting", Some(at(-90)), 60, true, at(0));
        assert_eq!(v.new_state, "ok");
        assert_eq!(v.notify, Some(NotifyKind::Resolved));
        // resolved notices disabled → silent transition.
        let v = evaluate("count_above", 10, 5, "alerting", Some(at(-90)), 60, false, at(0));
        assert_eq!(v.new_state, "ok");
        assert_eq!(v.notify, None);
        // already ok → nothing.
        let v = evaluate("count_above", 10, 5, "ok", None, 60, true, at(0));
        assert_eq!(v.new_state, "ok");
        assert_eq!(v.notify, None);
    }

    #[test]
    fn absent_condition_flow() {
        // No heartbeat for the window → alert; heartbeat resumes → resolve.
        let v = evaluate("absent", 0, 0, "ok", None, 30, true, at(0));
        assert_eq!(v.notify, Some(NotifyKind::Alert));
        let v = evaluate("absent", 0, 3, "alerting", Some(at(-10)), 30, true, at(0));
        assert_eq!(v.notify, Some(NotifyKind::Resolved));
    }

    #[test]
    fn validation() {
        let input = |patch: fn(&mut MonitorInput)| {
            let mut i = MonitorInput {
                name: Some("m".into()),
                condition: Some("count_above".into()),
                threshold: Some(10),
                window_minutes: Some(15),
                ..Default::default()
            };
            patch(&mut i);
            spec_from_input(i, None)
        };
        assert!(input(|_| {}).is_ok());
        assert!(input(|i| i.name = None).is_err());
        assert!(input(|i| i.condition = Some("weird".into())).is_err());
        assert!(input(|i| i.threshold = None).is_err());
        assert!(input(|i| i.window_minutes = Some(0)).is_err());
        assert!(input(|i| i.tag = Some("novalue".into())).is_err());
        assert!(input(|i| i.notify_emails = Some(vec!["bad".into()])).is_err());
        assert!(input(|i| i.webhook_urls = Some(vec!["ftp://x".into()])).is_err());
        for ip in ["127.0.0.1", "10.0.0.5", "172.17.0.2", "192.168.1.1", "169.254.169.254", "100.64.0.1", "::1", "fc00::1", "fe80::1", "::ffff:10.0.0.1"] {
            assert!(!is_public_ip(ip.parse().unwrap()), "{ip} should be blocked");
        }
        for ip in ["1.1.1.1", "35.201.97.85", "2606:4700::1111"] {
            assert!(is_public_ip(ip.parse().unwrap()), "{ip} should be allowed");
        }
        // absent needs no threshold.
        let ok = spec_from_input(
            MonitorInput {
                name: Some("hb".into()),
                condition: Some("absent".into()),
                ..Default::default()
            },
            None,
        )
        .unwrap();
        assert_eq!(ok.threshold, 0);
        assert_eq!(ok.window_minutes, 60);
    }

    #[test]
    fn webhook_shapes() {
        let m = Monitor {
            id: "m1".into(),
            company_id: "c1".into(),
            name: "test".into(),
            enabled: true,
            channel: Some("payments".into()),
            event: None,
            tag: None,
            condition: "count_above".into(),
            threshold: 10,
            window_minutes: 60,
            cooldown_minutes: 60,
            notify_emails: vec![],
            webhook_urls: vec![],
            notify_resolved: true,
            state: "ok".into(),
            last_checked_at: None,
            last_triggered_at: None,
            created_at: at(0),
        };
        let slack = webhook_payload(
            &Url::parse("https://hooks.slack.com/services/T/B/xxx").unwrap(),
            &m, "alerting", "t", "body", Some(5),
        );
        assert!(slack.get("text").is_some());
        assert!(slack.get("monitor").is_none());
        let discord = webhook_payload(
            &Url::parse("https://discord.com/api/webhooks/1/abc").unwrap(),
            &m, "alerting", "t", "body", Some(5),
        );
        assert!(discord.get("content").is_some());
        let generic = webhook_payload(
            &Url::parse("https://example.com/hook").unwrap(),
            &m, "alerting", "t", "body", Some(5),
        );
        assert_eq!(generic["monitor"]["id"], "m1");
        assert_eq!(generic["count"], 5);
        assert_eq!(generic["state"], "alerting");
    }
}
