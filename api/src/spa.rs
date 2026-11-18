//! Serves the React SPA (web/dist) embedded into the binary at compile time,
//! plus the apex-domain redirect for `www.`.

use actix_web::{
    body::MessageBody,
    dev::{ServiceRequest, ServiceResponse},
    http::{header, StatusCode},
    middleware::Next,
    HttpRequest, HttpResponse,
};
use rust_embed::RustEmbed;

#[derive(RustEmbed)]
#[folder = "../web/dist"]
#[allow_missing = true]
struct Assets;

fn serve(path: &str) -> Option<HttpResponse> {
    let file = Assets::get(path)?;
    let mime = mime_guess::from_path(path).first_or_octet_stream();
    // Rsbuild fingerprints everything under static/, so it can be cached forever.
    let cache = if path.starts_with("static/") {
        "public, max-age=31536000, immutable"
    } else {
        "no-cache"
    };
    Some(
        HttpResponse::Ok()
            .content_type(mime.as_ref())
            .insert_header((header::CACHE_CONTROL, cache))
            .body(file.data.into_owned()),
    )
}

/// Fallback for every route the API doesn't own: static file or index.html.
pub async fn spa(req: HttpRequest) -> HttpResponse {
    let path = req.path().trim_start_matches('/');
    if path.starts_with("api/") || path.starts_with("v1/") {
        return crate::util::error_json(StatusCode::NOT_FOUND, "not found");
    }
    if !path.is_empty() {
        if let Some(res) = serve(path) {
            return res;
        }
        // Missing fingerprinted asset: real 404, not the app shell.
        if path.starts_with("static/") {
            return HttpResponse::NotFound().finish();
        }
    }
    serve("index.html").unwrap_or_else(|| {
        HttpResponse::Ok()
            .content_type("text/plain")
            .body("Raterlog API is running. The web app was not built into this binary (run `npm run build` in web/).")
    })
}

/// www.example.com/x → https://example.com/x (301).
pub async fn www_redirect(
    req: ServiceRequest,
    next: Next<impl MessageBody + 'static>,
) -> Result<ServiceResponse<impl MessageBody>, actix_web::Error> {
    let host = req.connection_info().host().to_string();
    if let Some(apex) = host.strip_prefix("www.") {
        let pq = req
            .uri()
            .path_and_query()
            .map(|p| p.as_str())
            .unwrap_or("/");
        let res = HttpResponse::MovedPermanently()
            .insert_header((header::LOCATION, format!("https://{apex}{pq}")))
            .finish();
        return Ok(req.into_response(res).map_into_right_body());
    }
    next.call(req).await.map(|r| r.map_into_left_body())
}
