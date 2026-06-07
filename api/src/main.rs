use actix_cors::Cors;
use actix_web::{http::header, web::Data, App, HttpServer};
use db::connect_with_retry;
use std::{env, sync::Arc, time::Duration};
use tokio_postgres::NoTls;

mod ai;
mod db;
mod mail;
mod pg;
mod routes;
mod state;
mod util;

use state::AppState;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    dotenv::dotenv().ok();
    tracing_subscriber::fmt::init();

    let postgres_uri = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/example".into());
    let cassandra_uri = env::var("CASSANDRA_URI").unwrap_or_else(|_| "localhost:9042".into());
    let cors_origins = env::var("CORS_ORIGINS")
        .unwrap_or_else(|_| "http://localhost:3000,http://127.0.0.1:3000".into());
    let cookie_secure = env::var("COOKIE_SECURE")
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    let app_url = env::var("APP_URL").unwrap_or_else(|_| "http://localhost:3000".into());
    let smtp_host = env::var("SMTP_HOST").unwrap_or_default();
    let smtp_port = env::var("SMTP_PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(1025);
    let openai_api_key = env::var("OPENAI_API_KEY").ok().filter(|v| !v.is_empty());
    let bind = env::var("HTTP_ADDR").unwrap_or_else(|_| "0.0.0.0:8080".into());

    let (client, connection) = tokio_postgres::connect(&postgres_uri, NoTls)
        .await
        .expect("failed to connect to postgres");
    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("postgres connection error: {e}");
        }
    });
    println!("Successfully connected to Postgres!");
    pg::ensure_schema(&client)
        .await
        .expect("failed to apply postgres schema");

    let session = connect_with_retry(&cassandra_uri, 5, Duration::from_secs(10))
        .await
        .expect("failed to connect to cassandra");
    db::start_db(&session).await;
    println!("Successfully connected to Cassandra!");

    let data = Data::new(AppState {
        db: Arc::new(session),
        client,
        cookie_secure,
        app_url,
        smtp_host,
        smtp_port,
        openai_api_key,
    });

    HttpServer::new(move || {
        let mut cors = Cors::default()
            .allowed_methods(vec!["GET", "POST", "PATCH", "DELETE", "OPTIONS"])
            .allowed_headers(vec![
                header::AUTHORIZATION,
                header::ACCEPT,
                header::CONTENT_TYPE,
                header::COOKIE,
                header::HeaderName::from_static("x-session-token"),
            ])
            .supports_credentials()
            .max_age(3600);
        for origin in cors_origins.split(',') {
            let origin = origin.trim();
            if !origin.is_empty() {
                cors = cors.allowed_origin(origin);
            }
        }

        App::new()
            .wrap(cors)
            .app_data(data.clone())
            .service(routes::log::hello)
            .service(routes::log::health)
            .service(routes::log::create_log)
            .service(routes::log::create_log_compat)
            .service(routes::log::get_logs)
            .service(routes::log::get_logs_compat)
            .service(routes::log::create_logsnag_log)
            .service(routes::log::channel_detail)
            .service(routes::auth::signup)
            .service(routes::auth::signin)
            .service(routes::auth::signout)
            .service(routes::auth::me)
            .service(routes::companies::list_companies)
            .service(routes::companies::create_company)
            .service(routes::companies::company_detail)
            .service(routes::companies::update_company)
            .service(routes::companies::create_channel)
            .service(routes::companies::members)
            .service(routes::companies::create_invite)
            .service(routes::companies::delete_invite)
            .service(routes::companies::create_token)
            .service(routes::companies::delete_token)
            .service(routes::companies::get_invite)
            .service(routes::companies::accept_invite)
            .service(routes::insights::publish_insight)
            .service(routes::insights::mutate_insight)
            .service(routes::insights::list_insights)
            .service(routes::identify::identify)
            .service(routes::identify::list_identified_users)
            .service(routes::ai::summarize)
            .service(routes::ai::query)
    })
    .bind(bind)?
    .run()
    .await
}
