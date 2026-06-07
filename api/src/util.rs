use actix_web::{
    cookie::{time::Duration as CookieDuration, Cookie, SameSite},
    http::StatusCode,
    HttpRequest, HttpResponse,
};
use rand::Rng;
use regex::Regex;
use serde::Serialize;
use std::sync::OnceLock;

pub const SESSION_COOKIE: &str = "raterlog_session";

pub fn generate_id(len: usize) -> String {
    const ALPHABET: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let mut rng = rand::thread_rng();
    (0..len)
        .map(|_| ALPHABET[rng.gen_range(0..ALPHABET.len())] as char)
        .collect()
}

pub fn valid_email(email: &str) -> bool {
    static RE: OnceLock<Regex> = OnceLock::new();
    let re = RE.get_or_init(|| {
        Regex::new(r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$")
            .expect("email regex")
    });
    email.len() >= 3 && email.len() <= 255 && re.is_match(email)
}

pub fn json_ok<T: Serialize>(value: T) -> HttpResponse {
    HttpResponse::Ok().json(value)
}

pub fn json_created<T: Serialize>(value: T) -> HttpResponse {
    HttpResponse::Created().json(value)
}

pub fn error_json(status: StatusCode, message: &str) -> HttpResponse {
    HttpResponse::build(status).json(serde_json::json!({ "error": message }))
}

pub fn session_id_from_request(req: &HttpRequest) -> Option<String> {
    if let Some(cookie) = req.cookie(SESSION_COOKIE) {
        let value = cookie.value().trim();
        if !value.is_empty() {
            return Some(value.to_string());
        }
    }
    req.headers()
        .get("X-Session-Token")
        .and_then(|h| h.to_str().ok())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(ToOwned::to_owned)
}

pub fn api_token_from_request(req: &HttpRequest) -> Option<String> {
    let value = req
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok())?
        .trim();
    if value.is_empty() {
        return None;
    }
    let token = value
        .strip_prefix("Bearer ")
        .or_else(|| value.strip_prefix("Basic "))
        .unwrap_or(value)
        .trim();
    if token.is_empty() {
        None
    } else {
        Some(token.to_string())
    }
}

pub fn session_cookie(session_id: &str, secure: bool, clear: bool) -> Cookie<'static> {
    let mut builder = Cookie::build(SESSION_COOKIE, session_id.to_string())
        .path("/")
        .http_only(true)
        .same_site(SameSite::Lax)
        .secure(secure);
    if clear {
        builder = builder.max_age(CookieDuration::seconds(0));
    } else {
        builder = builder.max_age(CookieDuration::days(30));
    }
    builder.finish()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generate_id_has_requested_length() {
        assert_eq!(generate_id(15).len(), 15);
        assert_eq!(generate_id(32).len(), 32);
    }

    #[test]
    fn email_validation() {
        assert!(valid_email("you@example.com"));
        assert!(!valid_email("nope"));
        assert!(!valid_email(""));
    }
}
