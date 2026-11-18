use crate::pg::{self, User};
use crate::state::AppState;
use crate::util::{api_token_from_request, error_json, session_id_from_request};
use actix_web::{http::StatusCode, web::Data, HttpRequest, HttpResponse};
use chrono::{DateTime, Duration, Utc};

pub mod ai;
pub mod analytics;
pub mod billing;
pub mod auth;
pub mod companies;
pub mod identify;
pub mod insights;
pub mod log;
pub mod webhooks;

pub async fn require_user(req: &HttpRequest, state: &Data<AppState>) -> Result<User, HttpResponse> {
    let Some(session_id) = session_id_from_request(req) else {
        return Err(error_json(
            StatusCode::UNAUTHORIZED,
            "authentication required",
        ));
    };
    match pg::user_by_session(&state.client, &session_id).await {
        Ok(Some(user)) => Ok(user),
        Ok(None) => Err(error_json(
            StatusCode::UNAUTHORIZED,
            "authentication required",
        )),
        Err(e) => Err(error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("session lookup failed: {e}"),
        )),
    }
}

pub async fn require_company_member(
    req: &HttpRequest,
    state: &Data<AppState>,
    company_id: &str,
) -> Result<User, HttpResponse> {
    let user = require_user(req, state).await?;
    match pg::is_company_member(&state.client, company_id, &user.id).await {
        Ok(true) => Ok(user),
        Ok(false) => Err(error_json(StatusCode::FORBIDDEN, "company access denied")),
        Err(e) => Err(error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("membership check failed: {e}"),
        )),
    }
}

pub async fn require_channel_read(
    req: &HttpRequest,
    state: &Data<AppState>,
    channel_id: &str,
) -> Result<(), HttpResponse> {
    if let Some(token) = api_token_from_request(req) {
        return match pg::verify_token_for_channel(&state.client, &token, channel_id).await {
            Ok(Some(scope)) if scope.can_read() => Ok(()),
            Ok(Some(scope)) => Err(error_json(
                StatusCode::FORBIDDEN,
                &format!("token scope '{scope}' cannot read events; use a read or full token"),
            )),
            Ok(None) => Err(error_json(StatusCode::UNAUTHORIZED, "invalid api token")),
            Err(e) => Err(error_json(
                StatusCode::INTERNAL_SERVER_ERROR,
                &format!("token check failed: {e}"),
            )),
        };
    }

    let user = require_user(req, state).await?;
    match pg::user_can_read_channel(&state.client, &user.id, channel_id).await {
        Ok(true) => Ok(()),
        Ok(false) => Err(error_json(StatusCode::FORBIDDEN, "channel access denied")),
        Err(e) => Err(error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("channel access check failed: {e}"),
        )),
    }
}

/// Earliest instant a project's plan allows it to read (plan retention
/// cutoff). Falls back to the free plan — shortest retention — when billing
/// can't be read, so we never over-serve history. The daily job in main.rs
/// deletes old rows; this keeps stale rows from being returned in between.
pub async fn retention_cutoff(state: &Data<AppState>, company_id: &str) -> DateTime<Utc> {
    let plan = match pg::company_billing(&state.client, company_id).await {
        Ok(Some(b)) => crate::billing::plan(&b.plan),
        _ => crate::billing::plan("free"),
    };
    Utc::now() - Duration::days(plan.retention_days.max(1) as i64)
}

/// `retention_cutoff` as an `EventFilter::since` bound. `since` is exclusive,
/// so subtract 1 to keep events exactly at the cutoff visible.
pub async fn retention_since(state: &Data<AppState>, company_id: &str) -> u64 {
    crate::ch::id_floor(retention_cutoff(state, company_id).await).saturating_sub(1)
}

/// Resolve the project for a Bearer token that must be able to *ingest* —
/// every caller is a write endpoint (`/v1/*`, legacy `/api/logs`). A
/// read-only token gets 403 so the caller can tell auth failure from scope.
pub async fn company_id_from_api_token(
    req: &HttpRequest,
    state: &Data<AppState>,
) -> Result<String, HttpResponse> {
    let Some(token) = api_token_from_request(req) else {
        return Err(error_json(
            StatusCode::UNAUTHORIZED,
            "api token is required",
        ));
    };
    match pg::token_company(&state.client, &token).await {
        Ok(Some((company_id, scope))) if scope.can_ingest() => Ok(company_id),
        Ok(Some((_, scope))) => Err(error_json(
            StatusCode::FORBIDDEN,
            &format!("token scope '{scope}' cannot ingest; use an ingest or full token"),
        )),
        Ok(None) => Err(error_json(StatusCode::UNAUTHORIZED, "invalid api token")),
        Err(e) => Err(error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("token lookup failed: {e}"),
        )),
    }
}
