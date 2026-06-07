use crate::pg;
use crate::state::AppState;
use crate::util::{error_json, generate_id, json_ok};
use actix_web::{http::StatusCode, patch, post, web, HttpRequest, HttpResponse};
use serde::Deserialize;
use serde_json::Value;

use super::{company_id_from_api_token, require_company_member};

#[derive(Deserialize)]
struct InsightInput {
    project: String,
    title: String,
    value: Value,
    icon: Option<String>,
}

fn value_to_string(value: &Value) -> String {
    match value {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        other => other.to_string(),
    }
}

async fn resolve_company(
    req: &HttpRequest,
    state: &web::Data<AppState>,
    project: &str,
) -> Result<String, HttpResponse> {
    let company_id = company_id_from_api_token(req, state).await?;
    let company = match pg::company_by_id(&state.client, &company_id).await {
        Ok(Some(company)) => company,
        Ok(None) => return Err(error_json(StatusCode::UNAUTHORIZED, "invalid api token")),
        Err(e) => {
            return Err(error_json(
                StatusCode::INTERNAL_SERVER_ERROR,
                &e.to_string(),
            ))
        }
    };
    if !company.name.eq_ignore_ascii_case(project) {
        return Err(error_json(
            StatusCode::FORBIDDEN,
            "token does not match project",
        ));
    }
    Ok(company_id)
}

#[post("/v1/insight")]
pub async fn publish_insight(
    req: HttpRequest,
    body: web::Json<InsightInput>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let project = body.project.trim();
    let title = body.title.trim();
    if project.is_empty() || title.is_empty() {
        return error_json(StatusCode::BAD_REQUEST, "project and title are required");
    }
    let company_id = match resolve_company(&req, &state, project).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };
    match pg::upsert_insight(
        &state.client,
        &generate_id(15),
        &company_id,
        title,
        &value_to_string(&body.value),
        body.icon.as_deref(),
    )
    .await
    {
        Ok(insight) => json_ok(insight),
        Err(e) => error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to publish insight: {e}"),
        ),
    }
}

#[patch("/v1/insight")]
pub async fn mutate_insight(
    req: HttpRequest,
    body: web::Json<InsightInput>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let project = body.project.trim();
    let title = body.title.trim();
    if project.is_empty() || title.is_empty() {
        return error_json(StatusCode::BAD_REQUEST, "project and title are required");
    }
    let company_id = match resolve_company(&req, &state, project).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };
    let delta = body
        .value
        .get("$inc")
        .and_then(|v| v.as_f64())
        .or_else(|| body.value.as_f64())
        .unwrap_or(0.0);
    match pg::mutate_insight(
        &state.client,
        &company_id,
        title,
        delta,
        body.icon.as_deref(),
        &generate_id(15),
    )
    .await
    {
        Ok(insight) => json_ok(insight),
        Err(e) => error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to mutate insight: {e}"),
        ),
    }
}

#[actix_web::get("/api/companies/{company_id}/insights")]
pub async fn list_insights(
    req: HttpRequest,
    path: web::Path<String>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let company_id = path.into_inner();
    if let Err(resp) = require_company_member(&req, &state, &company_id).await {
        return resp;
    }
    match pg::insights_for_company(&state.client, &company_id).await {
        Ok(insights) => json_ok(insights),
        Err(e) => error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to list insights: {e}"),
        ),
    }
}
