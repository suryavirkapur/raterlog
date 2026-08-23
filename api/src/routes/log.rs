use crate::pg;
use crate::state::AppState;
use crate::util::{error_json, generate_id, json_created, json_ok};
use actix_web::{get, http::StatusCode, post, web, HttpRequest, HttpResponse};
use chrono::Utc;
use scylla::FromRow;
use serde::{Deserialize, Serialize};

use super::{company_id_from_api_token, require_channel_read, require_company_member};

#[derive(Debug, Deserialize, Serialize, Clone, FromRow)]
pub struct LogRow {
    pub channel_id: String,
    pub timestamp: String,
    pub event_name: String,
    pub event_payload: String,
    pub metadata: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CreateLogInput {
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
    parser: Option<String>,
    user_id: Option<String>,
    timestamp: Option<f64>,
}

async fn insert_log(
    state: &web::Data<AppState>,
    channel_id: &str,
    event_name: &str,
    event_payload: &str,
    metadata: Option<String>,
    timestamp: Option<String>,
) -> Result<LogRow, String> {
    let log = LogRow {
        channel_id: channel_id.to_string(),
        timestamp: timestamp.unwrap_or_else(|| Utc::now().to_rfc3339()),
        event_name: event_name.to_string(),
        event_payload: event_payload.to_string(),
        metadata: metadata.clone(),
    };
    state
        .db
        .query(
            "INSERT INTO raterlog.logs (channel_id, timestamp, event_name, event_payload, metadata) VALUES (?, ?, ?, ?, ?)",
            (
                &log.channel_id,
                &log.timestamp,
                &log.event_name,
                &log.event_payload,
                &metadata,
            ),
        )
        .await
        .map_err(|e| e.to_string())?;
    Ok(log)
}

pub async fn fetch_logs(
    state: &web::Data<AppState>,
    channel_id: &str,
    limit: i32,
) -> Result<Vec<LogRow>, String> {
    let result = state
        .db
        .query(
            "SELECT channel_id, timestamp, event_name, event_payload, metadata FROM raterlog.logs WHERE channel_id = ? LIMIT ?",
            (channel_id, limit),
        )
        .await
        .map_err(|e| e.to_string())?;
    Ok(result
        .rows_typed::<LogRow>()
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect())
}

async fn create_log_inner(
    req: HttpRequest,
    data: CreateLogInput,
    state: web::Data<AppState>,
) -> HttpResponse {
    if let Err(resp) = require_channel_read(&req, &state, &data.channel_id).await {
        // create still requires an API token, not just a session
        if crate::util::api_token_from_request(&req).is_none() {
            return error_json(
                StatusCode::UNAUTHORIZED,
                "api token is required to ingest events",
            );
        }
        return resp;
    }
    if crate::util::api_token_from_request(&req).is_none() {
        return error_json(
            StatusCode::UNAUTHORIZED,
            "api token is required to ingest events",
        );
    }
    let metadata = data.metadata.as_ref().map(|m| m.to_string());
    match insert_log(
        &state,
        &data.channel_id,
        &data.event_name,
        &data.event_payload,
        metadata,
        None,
    )
    .await
    {
        Ok(log) => json_created(log),
        Err(e) => error_json(StatusCode::INTERNAL_SERVER_ERROR, &e),
    }
}

#[post("/log")]
pub async fn create_log_compat(
    req: HttpRequest,
    body: web::Json<CreateLogInput>,
    state: web::Data<AppState>,
) -> HttpResponse {
    create_log_inner(req, body.into_inner(), state).await
}

#[post("/api/logs")]
pub async fn create_log(
    req: HttpRequest,
    body: web::Json<CreateLogInput>,
    state: web::Data<AppState>,
) -> HttpResponse {
    create_log_inner(req, body.into_inner(), state).await
}

async fn get_logs_inner(
    req: HttpRequest,
    channel_id: String,
    state: web::Data<AppState>,
    limit: Option<i32>,
) -> HttpResponse {
    if let Err(resp) = require_channel_read(&req, &state, &channel_id).await {
        return resp;
    }
    let limit = limit.unwrap_or(200).clamp(1, 1000);
    match fetch_logs(&state, &channel_id, limit).await {
        Ok(rows) => json_ok(rows),
        Err(e) => error_json(StatusCode::INTERNAL_SERVER_ERROR, &e),
    }
}

#[get("/log/{channel_id}")]
pub async fn get_logs_compat(
    req: HttpRequest,
    path: web::Path<String>,
    state: web::Data<AppState>,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> HttpResponse {
    let limit = query.get("limit").and_then(|v| v.parse().ok());
    get_logs_inner(req, path.into_inner(), state, limit).await
}

#[get("/api/logs/{channel_id}")]
pub async fn get_logs(
    req: HttpRequest,
    path: web::Path<String>,
    state: web::Data<AppState>,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> HttpResponse {
    let limit = query.get("limit").and_then(|v| v.parse().ok());
    get_logs_inner(req, path.into_inner(), state, limit).await
}

#[post("/v1/log")]
pub async fn create_logsnag_log(
    req: HttpRequest,
    body: web::Json<LogSnagInput>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let company_id = match company_id_from_api_token(&req, &state).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };
    let project = body.project.trim();
    let channel_name = body.channel.trim();
    let event = body.event.trim();
    if project.is_empty() || channel_name.is_empty() || event.is_empty() {
        return error_json(
            StatusCode::BAD_REQUEST,
            "project, channel, and event are required",
        );
    }
    let Some(company) = (match pg::company_by_id(&state.client, &company_id).await {
        Ok(c) => c,
        Err(e) => return error_json(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }) else {
        return error_json(StatusCode::UNAUTHORIZED, "invalid api token");
    };
    if !company.name.eq_ignore_ascii_case(project) {
        if let Ok(Some(named)) = pg::company_by_name(&state.client, project).await {
            if named.id != company_id {
                return error_json(StatusCode::FORBIDDEN, "token does not match project");
            }
        } else {
            return error_json(StatusCode::NOT_FOUND, "project not found");
        }
    }

    let channel = match pg::channel_by_name(&state.client, &company_id, channel_name).await {
        Ok(Some(channel)) => channel,
        Ok(None) => {
            match pg::create_channel(
                &state.client,
                &generate_id(15),
                &company_id,
                channel_name,
                body.icon.as_deref().unwrap_or("📡"),
            )
            .await
            {
                Ok(channel) => channel,
                Err(e) => {
                    return error_json(
                        StatusCode::INTERNAL_SERVER_ERROR,
                        &format!("failed to create channel: {e}"),
                    )
                }
            }
        }
        Err(e) => return error_json(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    };

    let metadata = serde_json::json!({
        "icon": body.icon,
        "notify": body.notify.unwrap_or(false),
        "tags": body.tags,
        "parser": body.parser,
        "user_id": body.user_id,
    });
    let timestamp = body.timestamp.map(|ts| {
        chrono::DateTime::<Utc>::from_timestamp(ts as i64, 0)
            .unwrap_or_else(Utc::now)
            .to_rfc3339()
    });
    match insert_log(
        &state,
        &channel.id,
        event,
        body.description.as_deref().unwrap_or(""),
        Some(metadata.to_string()),
        timestamp,
    )
    .await
    {
        Ok(log) => json_created(log),
        Err(e) => error_json(StatusCode::INTERNAL_SERVER_ERROR, &e),
    }
}

#[get("/")]
pub async fn hello(state: web::Data<AppState>) -> String {
    match state
        .client
        .query_one("SELECT current_database()", &[])
        .await
    {
        Ok(row) => row.get::<_, String>(0),
        Err(e) => format!("database error: {e}"),
    }
}

#[get("/health")]
pub async fn health() -> HttpResponse {
    json_ok(serde_json::json!({ "status": "ok" }))
}

#[get("/api/companies/{company_id}/channels/{channel_id}")]
pub async fn channel_detail(
    req: HttpRequest,
    path: web::Path<(String, String)>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let (company_id, channel_id) = path.into_inner();
    if let Err(resp) = require_company_member(&req, &state, &company_id).await {
        return resp;
    }
    match pg::channel_by_id(&state.client, &channel_id).await {
        Ok(Some(channel)) if channel.company_id == company_id => json_ok(channel),
        Ok(Some(_)) => error_json(StatusCode::NOT_FOUND, "channel not found"),
        Ok(None) => error_json(StatusCode::NOT_FOUND, "channel not found"),
        Err(e) => error_json(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}
