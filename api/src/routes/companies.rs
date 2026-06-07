use crate::mail::send_invite_email;
use crate::pg;
use crate::state::AppState;
use crate::util::{error_json, generate_id, json_created, json_ok, valid_email};
use actix_web::{delete, get, http::StatusCode, patch, post, web, HttpRequest, HttpResponse};
use serde::Deserialize;

use super::{require_company_member, require_user};

#[derive(Deserialize)]
struct NameInput {
    name: String,
}

#[derive(Deserialize)]
struct ChannelInput {
    name: String,
    icon: String,
}

#[derive(Deserialize)]
struct InviteInput {
    email: String,
}

#[get("/api/companies")]
pub async fn list_companies(req: HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    let user = match require_user(&req, &state).await {
        Ok(user) => user,
        Err(resp) => return resp,
    };
    match pg::companies_for_user(&state.client, &user.id).await {
        Ok(companies) => json_ok(companies),
        Err(e) => error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to list companies: {e}"),
        ),
    }
}

#[post("/api/companies")]
pub async fn create_company(
    req: HttpRequest,
    body: web::Json<NameInput>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let user = match require_user(&req, &state).await {
        Ok(user) => user,
        Err(resp) => return resp,
    };
    let name = body.name.trim();
    if name.is_empty() {
        return error_json(StatusCode::BAD_REQUEST, "company name is required");
    }
    match pg::create_company(&state.client, &generate_id(15), name, &user.id).await {
        Ok(company) => json_created(company),
        Err(e) => error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to create company: {e}"),
        ),
    }
}

#[get("/api/companies/{company_id}")]
pub async fn company_detail(
    req: HttpRequest,
    path: web::Path<String>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let company_id = path.into_inner();
    if require_company_member(&req, &state, &company_id)
        .await
        .is_err()
    {
        return match require_company_member(&req, &state, &company_id).await {
            Err(resp) => resp,
            Ok(_) => unreachable!(),
        };
    }
    match pg::company_detail(&state.client, &company_id).await {
        Ok(Some(detail)) => json_ok(detail),
        Ok(None) => error_json(StatusCode::NOT_FOUND, "company not found"),
        Err(e) => error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to load company: {e}"),
        ),
    }
}

#[patch("/api/companies/{company_id}")]
pub async fn update_company(
    req: HttpRequest,
    path: web::Path<String>,
    body: web::Json<NameInput>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let company_id = path.into_inner();
    if let Err(resp) = require_company_member(&req, &state, &company_id).await {
        return resp;
    }
    let name = body.name.trim();
    if name.is_empty() {
        return error_json(StatusCode::BAD_REQUEST, "company name is required");
    }
    match pg::update_company(&state.client, &company_id, name).await {
        Ok(Some(company)) => json_ok(company),
        Ok(None) => error_json(StatusCode::NOT_FOUND, "company not found"),
        Err(e) => error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to update company: {e}"),
        ),
    }
}

#[post("/api/companies/{company_id}/channels")]
pub async fn create_channel(
    req: HttpRequest,
    path: web::Path<String>,
    body: web::Json<ChannelInput>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let company_id = path.into_inner();
    if let Err(resp) = require_company_member(&req, &state, &company_id).await {
        return resp;
    }
    let name = body.name.trim();
    let icon = body.icon.trim();
    if name.is_empty() || icon.is_empty() {
        return error_json(StatusCode::BAD_REQUEST, "channel name and icon are required");
    }
    match pg::create_channel(&state.client, &generate_id(15), &company_id, name, icon).await {
        Ok(channel) => json_created(channel),
        Err(e) => error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to create channel: {e}"),
        ),
    }
}

#[get("/api/companies/{company_id}/members")]
pub async fn members(
    req: HttpRequest,
    path: web::Path<String>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let company_id = path.into_inner();
    if let Err(resp) = require_company_member(&req, &state, &company_id).await {
        return resp;
    }
    match pg::members(&state.client, &company_id).await {
        Ok(members) => json_ok(members),
        Err(e) => error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to list members: {e}"),
        ),
    }
}

#[post("/api/companies/{company_id}/invites")]
pub async fn create_invite(
    req: HttpRequest,
    path: web::Path<String>,
    body: web::Json<InviteInput>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let company_id = path.into_inner();
    if let Err(resp) = require_company_member(&req, &state, &company_id).await {
        return resp;
    }
    let email = body.email.trim().to_lowercase();
    if !valid_email(&email) {
        return error_json(StatusCode::BAD_REQUEST, "valid email is required");
    }
    let token = generate_id(32);
    let invite = match pg::create_invite(
        &state.client,
        &generate_id(15),
        &email,
        &company_id,
        &token,
    )
    .await
    {
        Ok(invite) => invite,
        Err(_) => {
            return error_json(
                StatusCode::CONFLICT,
                "invite already exists or could not be created",
            )
        }
    };
    if let Ok(Some(company)) = pg::company_by_id(&state.client, &company_id).await {
        if let Err(e) = send_invite_email(
            &state.smtp_host,
            state.smtp_port,
            &state.app_url,
            &email,
            &company.name,
            &token,
        )
        .await
        {
            eprintln!("failed to send invite email: {e}");
        }
    }
    json_created(invite)
}

#[delete("/api/companies/{company_id}/invites/{invite_id}")]
pub async fn delete_invite(
    req: HttpRequest,
    path: web::Path<(String, String)>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let (company_id, invite_id) = path.into_inner();
    if let Err(resp) = require_company_member(&req, &state, &company_id).await {
        return resp;
    }
    match pg::delete_invite(&state.client, &company_id, &invite_id).await {
        Ok(0) => error_json(StatusCode::NOT_FOUND, "invite not found"),
        Ok(_) => json_ok(serde_json::json!({ "ok": true })),
        Err(e) => error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to delete invite: {e}"),
        ),
    }
}

#[post("/api/companies/{company_id}/tokens")]
pub async fn create_token(
    req: HttpRequest,
    path: web::Path<String>,
    body: web::Json<NameInput>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let company_id = path.into_inner();
    if let Err(resp) = require_company_member(&req, &state, &company_id).await {
        return resp;
    }
    let name = body.name.trim();
    if name.is_empty() {
        return error_json(StatusCode::BAD_REQUEST, "token name is required");
    }
    match pg::create_token(&state.client, &company_id, name, &generate_id(24)).await {
        Ok(token) => json_created(token),
        Err(e) => error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to create token: {e}"),
        ),
    }
}

#[delete("/api/companies/{company_id}/tokens/{token_id}")]
pub async fn delete_token(
    req: HttpRequest,
    path: web::Path<(String, i32)>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let (company_id, token_id) = path.into_inner();
    if let Err(resp) = require_company_member(&req, &state, &company_id).await {
        return resp;
    }
    match pg::delete_token(&state.client, &company_id, token_id).await {
        Ok(0) => error_json(StatusCode::NOT_FOUND, "token not found"),
        Ok(_) => json_ok(serde_json::json!({ "ok": true })),
        Err(e) => error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to delete token: {e}"),
        ),
    }
}

#[get("/api/invites/{token}")]
pub async fn get_invite(path: web::Path<String>, state: web::Data<AppState>) -> HttpResponse {
    match pg::invite_by_token(&state.client, &path.into_inner()).await {
        Ok(Some(invite)) => json_ok(invite),
        Ok(None) => error_json(StatusCode::NOT_FOUND, "invite not found"),
        Err(e) => error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to load invite: {e}"),
        ),
    }
}

#[post("/api/invites/{token}/accept")]
pub async fn accept_invite(
    req: HttpRequest,
    path: web::Path<String>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let user = match require_user(&req, &state).await {
        Ok(user) => user,
        Err(resp) => return resp,
    };
    match pg::accept_invite(&state.client, &path.into_inner(), &user.id, &user.email).await {
        Ok(Ok(invite)) => json_ok(invite),
        Ok(Err(message)) => error_json(StatusCode::BAD_REQUEST, &message),
        Err(e) => error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to accept invite: {e}"),
        ),
    }
}
