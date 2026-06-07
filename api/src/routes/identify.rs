use crate::pg;
use crate::state::AppState;
use crate::util::{error_json, generate_id, json_ok};
use actix_web::{get, http::StatusCode, post, web, HttpRequest, HttpResponse};
use serde::Deserialize;
use serde_json::Value;
use std::collections::BTreeMap;

use super::{company_id_from_api_token, require_company_member};

#[derive(Deserialize)]
struct IdentifyInput {
    project: String,
    user_id: String,
    properties: BTreeMap<String, Value>,
}

#[post("/v1/identify")]
pub async fn identify(
    req: HttpRequest,
    body: web::Json<IdentifyInput>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let project = body.project.trim();
    let user_id = body.user_id.trim();
    if project.is_empty() || user_id.is_empty() {
        return error_json(StatusCode::BAD_REQUEST, "project and user_id are required");
    }
    let company_id = match company_id_from_api_token(&req, &state).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };
    let company = match pg::company_by_id(&state.client, &company_id).await {
        Ok(Some(company)) => company,
        Ok(None) => return error_json(StatusCode::UNAUTHORIZED, "invalid api token"),
        Err(e) => return error_json(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    };
    if !company.name.eq_ignore_ascii_case(project) {
        return error_json(StatusCode::FORBIDDEN, "token does not match project");
    }
    let properties = Value::Object(body.properties.clone().into_iter().collect());
    match pg::upsert_identified_user(
        &state.client,
        &generate_id(15),
        &company_id,
        user_id,
        properties,
    )
    .await
    {
        Ok(user) => json_ok(user),
        Err(e) => error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to identify user: {e}"),
        ),
    }
}

#[get("/api/companies/{company_id}/users")]
pub async fn list_identified_users(
    req: HttpRequest,
    path: web::Path<String>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let company_id = path.into_inner();
    if let Err(resp) = require_company_member(&req, &state, &company_id).await {
        return resp;
    }
    match pg::identified_users(&state.client, &company_id).await {
        Ok(users) => json_ok(users),
        Err(e) => error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to list users: {e}"),
        ),
    }
}
