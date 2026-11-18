//! Dashboard CRUD for threshold monitors + a test-notification endpoint.

use crate::monitor::{self, MonitorInput};
use crate::pg;
use crate::state::AppState;
use crate::util::{error_json, generate_id, json_created, json_ok};
use actix_web::{delete, get, http::StatusCode, patch, post, web, HttpRequest, HttpResponse};

use super::require_company_member;

#[get("/api/companies/{company_id}/monitors")]
pub async fn list_monitors(
    req: HttpRequest,
    path: web::Path<String>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let company_id = path.into_inner();
    if let Err(resp) = require_company_member(&req, &state, &company_id).await {
        return resp;
    }
    match pg::monitors_for_company(&state.client, &company_id).await {
        Ok(monitors) => json_ok(monitors),
        Err(e) => error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to list monitors: {e}"),
        ),
    }
}

#[post("/api/companies/{company_id}/monitors")]
pub async fn create_monitor(
    req: HttpRequest,
    path: web::Path<String>,
    body: web::Json<MonitorInput>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let company_id = path.into_inner();
    if let Err(resp) = require_company_member(&req, &state, &company_id).await {
        return resp;
    }
    let spec = match monitor::spec_from_input(body.into_inner(), None) {
        Ok(spec) => spec,
        Err(msg) => return error_json(StatusCode::BAD_REQUEST, &msg),
    };
    match pg::create_monitor(
        &state.client,
        &generate_id(15),
        &company_id,
        &spec.name,
        spec.enabled,
        spec.channel.as_deref(),
        spec.event.as_deref(),
        spec.tag.as_deref(),
        &spec.condition,
        spec.threshold,
        spec.window_minutes,
        spec.cooldown_minutes,
        &spec.notify_emails,
        &spec.webhook_urls,
        spec.notify_resolved,
    )
    .await
    {
        Ok(m) => json_created(m),
        Err(e) => error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to create monitor: {e}"),
        ),
    }
}

#[patch("/api/companies/{company_id}/monitors/{monitor_id}")]
pub async fn update_monitor(
    req: HttpRequest,
    path: web::Path<(String, String)>,
    body: web::Json<MonitorInput>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let (company_id, monitor_id) = path.into_inner();
    if let Err(resp) = require_company_member(&req, &state, &company_id).await {
        return resp;
    }
    let existing = match pg::monitor_by_id(&state.client, &company_id, &monitor_id).await {
        Ok(Some(m)) => m,
        Ok(None) => return error_json(StatusCode::NOT_FOUND, "monitor not found"),
        Err(e) => return error_json(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    };
    let spec = match monitor::spec_from_input(body.into_inner(), Some(&existing)) {
        Ok(spec) => spec,
        Err(msg) => return error_json(StatusCode::BAD_REQUEST, &msg),
    };
    match pg::update_monitor(
        &state.client,
        &company_id,
        &monitor_id,
        &spec.name,
        spec.enabled,
        spec.channel.as_deref(),
        spec.event.as_deref(),
        spec.tag.as_deref(),
        &spec.condition,
        spec.threshold,
        spec.window_minutes,
        spec.cooldown_minutes,
        &spec.notify_emails,
        &spec.webhook_urls,
        spec.notify_resolved,
    )
    .await
    {
        Ok(Some(m)) => json_ok(m),
        Ok(None) => error_json(StatusCode::NOT_FOUND, "monitor not found"),
        Err(e) => error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to update monitor: {e}"),
        ),
    }
}

#[delete("/api/companies/{company_id}/monitors/{monitor_id}")]
pub async fn delete_monitor(
    req: HttpRequest,
    path: web::Path<(String, String)>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let (company_id, monitor_id) = path.into_inner();
    if let Err(resp) = require_company_member(&req, &state, &company_id).await {
        return resp;
    }
    match pg::delete_monitor(&state.client, &company_id, &monitor_id).await {
        Ok(0) => error_json(StatusCode::NOT_FOUND, "monitor not found"),
        Ok(_) => json_ok(serde_json::json!({ "ok": true })),
        Err(e) => error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to delete monitor: {e}"),
        ),
    }
}

/// Fire a test notification at the monitor's targets (no state change).
#[post("/api/companies/{company_id}/monitors/{monitor_id}/test")]
pub async fn test_monitor(
    req: HttpRequest,
    path: web::Path<(String, String)>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let (company_id, monitor_id) = path.into_inner();
    if let Err(resp) = require_company_member(&req, &state, &company_id).await {
        return resp;
    }
    let m = match pg::monitor_by_id(&state.client, &company_id, &monitor_id).await {
        Ok(Some(m)) => m,
        Ok(None) => return error_json(StatusCode::NOT_FOUND, "monitor not found"),
        Err(e) => return error_json(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    };
    if m.notify_emails.is_empty() && m.webhook_urls.is_empty() {
        return error_json(
            StatusCode::BAD_REQUEST,
            "no notify targets — add an email or a webhook URL first",
        );
    }
    let results = monitor::deliver_test(&state, &m).await;
    let sent = results.iter().filter(|(_, r)| r.is_ok()).count();
    json_ok(serde_json::json!({
        "ok": sent == results.len(),
        "sent": sent,
        "targets": results.len(),
        "errors": results
            .iter()
            .filter_map(|(t, r)| r.as_ref().err().map(|e| format!("{t}: {e}")))
            .collect::<Vec<_>>(),
    }))
}
