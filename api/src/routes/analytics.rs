//! Charts, breakdowns, funnels, user journeys and plan usage.

use crate::billing;
use crate::ch::{EventFilter, PublicEvent};
use crate::pg;
use crate::state::AppState;
use crate::util::{error_json, json_ok};
use actix_web::{get, http::StatusCode, post, web, HttpRequest, HttpResponse};
use chrono::{Duration, Utc};
use serde::Deserialize;
use std::collections::HashMap;

use super::{require_company_member, retention_cutoff, retention_since};

fn range_start(range: Option<&String>) -> chrono::DateTime<Utc> {
    let d = match range.map(String::as_str) {
        Some("24h") => Duration::hours(24),
        Some("30d") => Duration::days(30),
        Some("90d") => Duration::days(90),
        _ => Duration::days(7),
    };
    Utc::now() - d
}

fn opt<'a>(q: &'a HashMap<String, String>, k: &str) -> Option<&'a str> {
    q.get(k).map(|s| s.trim()).filter(|s| !s.is_empty())
}

#[get("/api/companies/{company_id}/analytics/timeseries")]
pub async fn timeseries(req: HttpRequest, path: web::Path<String>, state: web::Data<AppState>, q: web::Query<HashMap<String, String>>) -> HttpResponse {
    let company_id = path.into_inner();
    if let Err(r) = require_company_member(&req, &state, &company_id).await {
        return r;
    }
    let hourly = opt(&q, "interval") == Some("hour") || (opt(&q, "interval").is_none() && opt(&q, "range") == Some("24h"));
    let from = range_start(q.get("range")).max(retention_cutoff(&state, &company_id).await);
    match state
        .ch
        .timeseries(&company_id, from, hourly, opt(&q, "channel"), opt(&q, "event"))
        .await
    {
        Ok(v) => json_ok(v),
        Err(e) => error_json(StatusCode::INTERNAL_SERVER_ERROR, &e),
    }
}

#[get("/api/companies/{company_id}/analytics/breakdown")]
pub async fn breakdown(req: HttpRequest, path: web::Path<String>, state: web::Data<AppState>, q: web::Query<HashMap<String, String>>) -> HttpResponse {
    let company_id = path.into_inner();
    if let Err(r) = require_company_member(&req, &state, &company_id).await {
        return r;
    }
    let limit = opt(&q, "limit").and_then(|v| v.parse().ok()).unwrap_or(20);
    let from = range_start(q.get("range")).max(retention_cutoff(&state, &company_id).await);
    match state
        .ch
        .breakdown(&company_id, from, opt(&q, "by").unwrap_or("event"), opt(&q, "channel"), limit)
        .await
    {
        Ok(v) => json_ok(v),
        Err(e) => error_json(StatusCode::INTERNAL_SERVER_ERROR, &e),
    }
}

#[derive(Deserialize)]
struct FunnelInput {
    steps: Vec<String>,
    range: Option<String>,
    window_hours: Option<u64>,
}

#[post("/api/companies/{company_id}/analytics/funnel")]
pub async fn funnel(req: HttpRequest, path: web::Path<String>, body: web::Json<FunnelInput>, state: web::Data<AppState>) -> HttpResponse {
    let company_id = path.into_inner();
    if let Err(r) = require_company_member(&req, &state, &company_id).await {
        return r;
    }
    let steps: Vec<String> = body.steps.iter().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
    if steps.len() < 2 || steps.len() > 8 {
        return error_json(StatusCode::BAD_REQUEST, "a funnel needs 2 to 8 steps");
    }
    let window = body.window_hours.unwrap_or(24 * 7).clamp(1, 24 * 90) * 3600;
    let from = range_start(body.range.as_ref()).max(retention_cutoff(&state, &company_id).await);
    match state.ch.funnel(&company_id, from, &steps, window).await {
        Ok(counts) => json_ok(
            steps
                .iter()
                .zip(counts)
                .map(|(event, count)| serde_json::json!({ "event": event, "count": count }))
                .collect::<Vec<_>>(),
        ),
        Err(e) => error_json(StatusCode::INTERNAL_SERVER_ERROR, &e),
    }
}

#[get("/api/companies/{company_id}/users/{user_id}")]
pub async fn user_journey(req: HttpRequest, path: web::Path<(String, String)>, state: web::Data<AppState>) -> HttpResponse {
    let (company_id, user_id) = path.into_inner();
    if let Err(r) = require_company_member(&req, &state, &company_id).await {
        return r;
    }
    let user = match pg::identified_user(&state.client, &company_id, &user_id).await {
        Ok(u) => u,
        Err(e) => return error_json(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    };
    let f = EventFilter {
        user_id: Some(user_id),
        limit: 500,
        since: Some(retention_since(&state, &company_id).await),
        ..Default::default()
    };
    match state.ch.list(&company_id, &f).await {
        Ok(rows) => json_ok(serde_json::json!({
            "user": user,
            "events": rows.into_iter().map(PublicEvent::from).collect::<Vec<_>>(),
        })),
        Err(e) => error_json(StatusCode::INTERNAL_SERVER_ERROR, &e),
    }
}

#[get("/api/companies/{company_id}/usage")]
pub async fn usage(req: HttpRequest, path: web::Path<String>, state: web::Data<AppState>) -> HttpResponse {
    let company_id = path.into_inner();
    if let Err(r) = require_company_member(&req, &state, &company_id).await {
        return r;
    }
    let plan = match pg::company_billing(&state.client, &company_id).await {
        Ok(Some(b)) => billing::plan(&b.plan),
        Ok(None) => return error_json(StatusCode::NOT_FOUND, "project not found"),
        Err(e) => return error_json(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    };
    let (start, end) = billing::current_period();
    let used = match state.ch.count_since(&company_id, start).await {
        Ok(n) => {
            state.quota.set(&company_id, n);
            n
        }
        Err(e) => return error_json(StatusCode::INTERNAL_SERVER_ERROR, &e),
    };
    let seats = pg::seat_count(&state.client, &company_id).await.unwrap_or(0);
    json_ok(serde_json::json!({
        "plan": plan.id,
        "period_start": start.to_rfc3339(),
        "period_end": end.to_rfc3339(),
        "events_used": used,
        "events_limit": plan.events_limit,
        "seats_used": seats,
        "seats_limit": plan.seats_limit,
        "retention_days": plan.retention_days,
    }))
}

#[get("/api/companies/{company_id}/analytics/summary")]
pub async fn summary(req: HttpRequest, path: web::Path<String>, state: web::Data<AppState>, q: web::Query<HashMap<String, String>>) -> HttpResponse {
    let company_id = path.into_inner();
    if let Err(r) = require_company_member(&req, &state, &company_id).await {
        return r;
    }
    let from = range_start(q.get("range")).max(retention_cutoff(&state, &company_id).await);
    match state.ch.summary(&company_id, from).await {
        Ok(v) => json_ok(v),
        Err(e) => error_json(StatusCode::INTERNAL_SERVER_ERROR, &e),
    }
}
