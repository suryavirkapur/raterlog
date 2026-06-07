use crate::pg::{self, User};
use crate::state::AppState;
use crate::util::{
    error_json, generate_id, json_ok, session_cookie, session_id_from_request, valid_email,
};
use actix_web::{get, http::StatusCode, post, web, HttpRequest, HttpResponse};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use chrono::{Duration, Utc};
use serde::Deserialize;

use super::require_user;

#[derive(Deserialize)]
struct SignupInput {
    name: String,
    email: String,
    password: String,
    #[serde(default)]
    invite_token: String,
}

#[derive(Deserialize)]
struct SigninInput {
    email: String,
    password: String,
    #[serde(default)]
    invite_token: String,
}

fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| e.to_string())
}

fn verify_password(password: &str, hash: &str) -> bool {
    let Ok(parsed) = PasswordHash::new(hash) else {
        return false;
    };
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok()
}

async fn create_session_response(state: &web::Data<AppState>, user: User) -> HttpResponse {
    let session_id = generate_id(32);
    let expires_at = Utc::now() + Duration::days(30);
    if let Err(e) = pg::create_session(&state.client, &session_id, &user.id, expires_at).await {
        return error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to create session: {e}"),
        );
    }
    HttpResponse::Ok()
        .cookie(session_cookie(&session_id, state.cookie_secure, false))
        .json(serde_json::json!({ "user": user, "session": session_id }))
}

#[post("/api/auth/signup")]
pub async fn signup(body: web::Json<SignupInput>, state: web::Data<AppState>) -> HttpResponse {
    let name = body.name.trim();
    let email = body.email.trim().to_lowercase();
    if name.len() < 3 || name.len() > 80 {
        return error_json(
            StatusCode::BAD_REQUEST,
            "name must be between 3 and 80 characters",
        );
    }
    if !valid_email(&email) {
        return error_json(StatusCode::BAD_REQUEST, "invalid email");
    }
    if body.password.len() < 6 || body.password.len() > 255 {
        return error_json(
            StatusCode::BAD_REQUEST,
            "password must be between 6 and 255 characters",
        );
    }
    if let Ok(Some(_)) = pg::user_by_email(&state.client, &email).await {
        return error_json(StatusCode::CONFLICT, "email already exists");
    }
    let Ok(password_hash) = hash_password(&body.password) else {
        return error_json(StatusCode::INTERNAL_SERVER_ERROR, "failed to hash password");
    };
    let user_id = generate_id(15);
    let user = match pg::create_user(&state.client, &user_id, name, &email, &password_hash).await {
        Ok(user) => user,
        Err(e) => {
            return error_json(StatusCode::CONFLICT, &format!("could not create user: {e}"))
        }
    };
    if !body.invite_token.is_empty() {
        let _ = pg::accept_invite(&state.client, &body.invite_token, &user.id, &user.email).await;
    }
    create_session_response(&state, user).await
}

#[post("/api/auth/signin")]
pub async fn signin(body: web::Json<SigninInput>, state: web::Data<AppState>) -> HttpResponse {
    let email = body.email.trim().to_lowercase();
    let Some((user, hash)) = (match pg::user_by_email(&state.client, &email).await {
        Ok(row) => row,
        Err(e) => {
            return error_json(
                StatusCode::INTERNAL_SERVER_ERROR,
                &format!("signin failed: {e}"),
            )
        }
    }) else {
        return error_json(StatusCode::UNAUTHORIZED, "incorrect email or password");
    };
    if !verify_password(&body.password, &hash) {
        return error_json(StatusCode::UNAUTHORIZED, "incorrect email or password");
    }
    if !body.invite_token.is_empty() {
        let _ = pg::accept_invite(&state.client, &body.invite_token, &user.id, &user.email).await;
    }
    create_session_response(&state, user).await
}

#[post("/api/auth/signout")]
pub async fn signout(req: HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if let Some(session_id) = session_id_from_request(&req) {
        let _ = pg::delete_session(&state.client, &session_id).await;
    }
    HttpResponse::Ok()
        .cookie(session_cookie("", state.cookie_secure, true))
        .json(serde_json::json!({ "ok": true }))
}

#[get("/api/auth/me")]
pub async fn me(req: HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    match require_user(&req, &state).await {
        Ok(user) => json_ok(user),
        Err(resp) => resp,
    }
}
