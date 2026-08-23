use crate::ai::{heuristic_answer, heuristic_summary, maybe_llm_answer, maybe_llm_summary, LogItem};
use crate::state::AppState;
use crate::util::{error_json, json_ok};
use actix_web::{http::StatusCode, post, web, HttpRequest, HttpResponse};
use serde::Deserialize;

use super::log::fetch_logs;
use super::require_channel_read;

#[derive(Deserialize)]
struct QueryInput {
    #[serde(default)]
    question: String,
    #[serde(default)]
    limit: Option<i32>,
}

fn to_ai_logs(rows: Vec<super::log::LogRow>) -> Vec<LogItem> {
    rows.into_iter()
        .map(|row| LogItem {
            channel_id: row.channel_id,
            timestamp: row.timestamp,
            event_name: row.event_name,
            event_payload: row.event_payload,
            metadata: row.metadata,
        })
        .collect()
}

#[post("/api/channels/{channel_id}/ai/summarize")]
pub async fn summarize(
    req: HttpRequest,
    path: web::Path<String>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let channel_id = path.into_inner();
    if let Err(resp) = require_channel_read(&req, &state, &channel_id).await {
        return resp;
    }
    let rows = match fetch_logs(&state, &channel_id, 200).await {
        Ok(rows) => rows,
        Err(e) => return error_json(StatusCode::INTERNAL_SERVER_ERROR, &e),
    };
    let logs = to_ai_logs(rows);
    let fallback = heuristic_summary(&logs);
    let summary = maybe_llm_summary(state.openai_key(), &logs, fallback).await;
    json_ok(summary)
}

#[post("/api/channels/{channel_id}/ai/query")]
pub async fn query(
    req: HttpRequest,
    path: web::Path<String>,
    body: web::Json<QueryInput>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let channel_id = path.into_inner();
    if let Err(resp) = require_channel_read(&req, &state, &channel_id).await {
        return resp;
    }
    let question = body.question.trim();
    if question.is_empty() {
        return error_json(StatusCode::BAD_REQUEST, "question is required");
    }
    let limit = body.limit.unwrap_or(200).clamp(1, 1000);
    let rows = match fetch_logs(&state, &channel_id, limit).await {
        Ok(rows) => rows,
        Err(e) => return error_json(StatusCode::INTERNAL_SERVER_ERROR, &e),
    };
    let logs = to_ai_logs(rows);
    let summary = heuristic_summary(&logs);
    let fallback = heuristic_answer(question, &logs, &summary);
    let answer = maybe_llm_answer(state.openai_key(), question, &logs, fallback).await;
    json_ok(serde_json::json!({
        "answer": answer,
        "summary": summary,
    }))
}
