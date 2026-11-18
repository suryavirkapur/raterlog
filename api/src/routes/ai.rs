use crate::ai::{heuristic_answer, heuristic_summary, maybe_llm_answer, maybe_llm_summary, LogItem};
use crate::state::AppState;
use crate::util::{error_json, json_ok};
use actix_web::{http::StatusCode, post, web, HttpRequest, HttpResponse};
use serde::Deserialize;

use super::require_channel_read;

#[derive(Deserialize)]
struct QueryInput {
    #[serde(default)]
    question: String,
    #[serde(default)]
    limit: Option<i32>,
}

async fn channel_logs(state: &web::Data<AppState>, channel_id: &str, limit: u32) -> Result<Vec<LogItem>, String> {
    let channel = crate::pg::channel_by_id(&state.client, channel_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "channel not found".to_string())?;
    let f = crate::ch::EventFilter { channel_id: Some(channel_id.to_string()), limit, ..Default::default() };
    let rows = state.ch.list(&channel.company_id, &f).await?;
    Ok(rows
        .into_iter()
        .map(|e| LogItem {
            channel_id: e.channel_id,
            timestamp: e.timestamp,
            event_name: e.event,
            event_payload: e.description,
            metadata: (!e.tags.is_empty()).then(|| serde_json::to_string(&e.tags).unwrap_or_default()),
        })
        .collect())
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
    let logs = match channel_logs(&state, &channel_id, 200).await {
        Ok(rows) => rows,
        Err(e) => return error_json(StatusCode::INTERNAL_SERVER_ERROR, &e),
    };
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
    let limit = body.limit.unwrap_or(200).clamp(1, 500) as u32;
    let logs = match channel_logs(&state, &channel_id, limit).await {
        Ok(rows) => rows,
        Err(e) => return error_json(StatusCode::INTERNAL_SERVER_ERROR, &e),
    };
    let summary = heuristic_summary(&logs);
    let fallback = heuristic_answer(question, &logs, &summary);
    let answer = maybe_llm_answer(state.openai_key(), question, &logs, fallback).await;
    json_ok(serde_json::json!({
        "answer": answer,
        "summary": summary,
    }))
}
