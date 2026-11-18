//! Inbound webhook endpoints.
//!
//! `POST /v1/webhooks/{source}/{token}` receives third-party webhooks — the
//! project token goes in the path because providers can't set auth headers.
//! Mapping and signature verification live in `crate::webhooks`; secrets are
//! managed with the session-auth `/api/companies/{id}/integrations` routes.

use crate::pg;
use crate::state::AppState;
use crate::util::{error_json, json_created, json_ok};
use crate::webhooks;
use actix_web::{delete, get, http::StatusCode, post, put, web, HttpRequest, HttpResponse};
use serde::Deserialize;

use super::log::{ingest_event, resolve_channel, NewEvent};
use super::require_company_member;

fn header<'a>(req: &'a HttpRequest, name: &str) -> &'a str {
    req.headers()
        .get(name)
        .and_then(|h| h.to_str().ok())
        .unwrap_or_default()
}

/// Verify the delivery against the configured secret. With no secret the
/// webhook is accepted (the path token is the only credential).
fn verify_signature(source: &str, secret: &str, req: &HttpRequest, body: &[u8]) -> bool {
    match source {
        "stripe" => webhooks::verify_stripe(secret, header(req, "stripe-signature"), body),
        "github" => webhooks::verify_github(secret, header(req, "x-hub-signature-256"), body),
        "vercel" => webhooks::verify_vercel(secret, header(req, "x-vercel-signature"), body),
        "dodo" => webhooks::verify_dodo(
            secret,
            header(req, "webhook-id"),
            header(req, "webhook-timestamp"),
            header(req, "webhook-signature"),
            body,
        ),
        "generic" => webhooks::verify_github(secret, header(req, "x-hub-signature-256"), body),
        _ => false,
    }
}

#[post("/v1/webhooks/{source}/{token}")]
pub async fn inbound(
    req: HttpRequest,
    path: web::Path<(String, String)>,
    body: web::Bytes,
    state: web::Data<AppState>,
) -> HttpResponse {
    let (source, token) = path.into_inner();
    let source = source.to_lowercase();
    if !webhooks::valid_source(&source) {
        return error_json(StatusCode::NOT_FOUND, "unknown webhook source");
    }
    let company_id = match pg::token_company(&state.client, &token).await {
        Ok(Some((id, scope))) if scope.can_ingest() => id,
        Ok(Some((_, scope))) => {
            return error_json(
                StatusCode::FORBIDDEN,
                &format!("token scope '{scope}' cannot ingest; use an ingest or full token"),
            )
        }
        Ok(None) => return error_json(StatusCode::UNAUTHORIZED, "invalid token"),
        Err(e) => return error_json(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    };
    match pg::integration_secret(&state.client, &company_id, &source).await {
        Ok(Some(secret)) if !verify_signature(&source, &secret, &req, &body) => {
            return error_json(StatusCode::UNAUTHORIZED, "invalid signature");
        }
        Ok(_) => {}
        Err(e) => return error_json(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }

    let json = match serde_json::from_slice::<serde_json::Value>(&body) {
        Ok(v) => v,
        Err(_) if source == "generic" => serde_json::Value::Null,
        Err(_) => return error_json(StatusCode::BAD_REQUEST, "invalid json body"),
    };
    let event_type = match source.as_str() {
        "github" => header(&req, "x-github-event").to_string(),
        _ => json
            .get("type")
            .and_then(|t| t.as_str())
            .unwrap_or_default()
            .to_string(),
    };
    let m = webhooks::map_event(&source, &event_type, &json);
    let channel = match resolve_channel(&state, &company_id, &m.channel, m.icon.as_deref()).await {
        Ok(c) => c,
        Err(e) => return error_json(StatusCode::INTERNAL_SERVER_ERROR, &e),
    };
    let ne = NewEvent {
        event: m.event,
        description: m.description,
        icon: m.icon,
        tags: m.tags,
        user_id: m.user_id,
        notify: m.notify,
        at: None,
    };
    match ingest_event(&state, &company_id, &channel, ne).await {
        Ok(ev) => json_created(ev),
        Err((status, msg)) => error_json(status, &msg),
    }
}

// ─────────────── session-auth: integration secrets ───────────────

#[derive(Deserialize)]
struct SecretInput {
    secret: String,
}

/// Which sources have a signing secret configured (never the secrets).
#[get("/api/companies/{company_id}/integrations")]
pub async fn list_integrations(
    req: HttpRequest,
    path: web::Path<String>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let company_id = path.into_inner();
    if let Err(resp) = require_company_member(&req, &state, &company_id).await {
        return resp;
    }
    match pg::integration_sources(&state.client, &company_id).await {
        Ok(sources) => json_ok(serde_json::json!({ "sources": sources })),
        Err(e) => error_json(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

#[put("/api/companies/{company_id}/integrations/{source}")]
pub async fn set_integration_secret(
    req: HttpRequest,
    path: web::Path<(String, String)>,
    body: web::Json<SecretInput>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let (company_id, source) = path.into_inner();
    if let Err(resp) = require_company_member(&req, &state, &company_id).await {
        return resp;
    }
    let source = source.to_lowercase();
    if !webhooks::valid_source(&source) {
        return error_json(StatusCode::BAD_REQUEST, "unknown webhook source");
    }
    let secret = body.secret.trim();
    if secret.is_empty() || secret.len() > 256 {
        return error_json(StatusCode::BAD_REQUEST, "secret must be 1-256 characters");
    }
    match pg::set_integration_secret(&state.client, &company_id, &source, secret).await {
        Ok(()) => json_ok(serde_json::json!({ "ok": true })),
        Err(e) => error_json(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

#[delete("/api/companies/{company_id}/integrations/{source}")]
pub async fn delete_integration_secret(
    req: HttpRequest,
    path: web::Path<(String, String)>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let (company_id, source) = path.into_inner();
    if let Err(resp) = require_company_member(&req, &state, &company_id).await {
        return resp;
    }
    match pg::delete_integration_secret(&state.client, &company_id, &source.to_lowercase()).await {
        Ok(0) => error_json(StatusCode::NOT_FOUND, "integration not configured"),
        Ok(_) => json_ok(serde_json::json!({ "ok": true })),
        Err(e) => error_json(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}
