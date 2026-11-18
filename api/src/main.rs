use actix_cors::Cors;
use actix_web::{
    http::header,
    middleware::{from_fn, Compress, DefaultHeaders},
    web::{self, Data},
    App, HttpServer,
};
use std::env;
use tokio_postgres::NoTls;

mod ai;
mod billing;
mod ch;
mod mail;
mod mcp;
mod pg;
mod routes;
mod selftrack;
mod state;
mod util;
mod spa;
mod webhooks;

use state::AppState;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt::init();

    let postgres_uri = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/example".into());
    let clickhouse_url = env::var("CLICKHOUSE_URL").unwrap_or_else(|_| "http://localhost:8123".into());
    let clickhouse_db = env::var("CLICKHOUSE_DB").unwrap_or_else(|_| "raterlog".into());
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
        // The API holds a single connection; if it drops, exit so the
        // orchestrator restarts us with a fresh one instead of serving 500s.
        eprintln!("postgres connection closed, exiting");
        std::process::exit(1);
    });
    println!("Successfully connected to Postgres!");
    pg::ensure_schema(&client)
        .await
        .expect("failed to apply postgres schema");

    let ch = ch::ClickHouse::new(&clickhouse_url, &clickhouse_db).expect("invalid CLICKHOUSE_URL");
    let mut attempt = 0;
    loop {
        match ch.ensure_schema().await {
            Ok(()) => break,
            Err(e) if attempt < 30 => {
                attempt += 1;
                eprintln!("clickhouse not ready ({e}); retrying in 2s");
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            }
            Err(e) => panic!("failed to apply clickhouse schema: {e}"),
        }
    }
    println!("ClickHouse ready");

    let dodo = billing::Dodo::from_env();
    println!("Billing: {}", if dodo.is_some() { "Dodo Payments enabled" } else { "disabled (DODO_API_KEY not set)" });

    let data = Data::new(AppState {
        client,
        ch,
        quota: billing::QuotaCache::default(),
        dodo,
        cookie_secure,
        app_url,
        smtp_host,
        smtp_port,
        openai_api_key,
        selftrack: selftrack::SelfTrack::from_env(),
    });

    spawn_retention_job(data.clone());
    selftrack::track(
        &data,
        selftrack::Track::new("ops", "🚀", "Server started")
            .desc(format!("raterlog v{}", env!("CARGO_PKG_VERSION")))
            .tag("version", env!("CARGO_PKG_VERSION")),
    );

    HttpServer::new(move || {
        // Same-origin dashboard needs no CORS; this is for browser-side
        // ingestion from customers' sites (token auth, no cookies).
        let cors = Cors::default()
            .allow_any_origin()
            .allowed_methods(vec!["GET", "POST", "PATCH", "DELETE", "OPTIONS"])
            .allowed_headers(vec![
                header::AUTHORIZATION,
                header::ACCEPT,
                header::CONTENT_TYPE,
                header::HeaderName::from_static("mcp-protocol-version"),
                header::HeaderName::from_static("mcp-session-id"),
            ])
            .max_age(3600);

        App::new()
            .wrap(cors)
            .wrap(Compress::default())
            .wrap(DefaultHeaders::new().add(("X-Content-Type-Options", "nosniff")))
            .wrap(from_fn(spa::www_redirect))
            .app_data(data.clone())
            .app_data(web::JsonConfig::default().limit(256 * 1024))
            .service(routes::log::health)
            .service(routes::log::create_log)
            .service(routes::log::create_log_compat)
            .service(routes::log::get_logs)
            .service(routes::log::get_logs_compat)
            .service(routes::log::create_logsnag_log)
            .service(routes::log::channel_detail)
            .service(routes::log::delete_channel)
            .service(routes::log::company_events)
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
            .service(routes::analytics::timeseries)
            .service(routes::analytics::breakdown)
            .service(routes::analytics::funnel)
            .service(routes::analytics::user_journey)
            .service(routes::analytics::usage)
            .service(routes::analytics::summary)
            .service(routes::billing::plans)
            .service(routes::billing::checkout)
            .service(routes::billing::portal)
            .service(routes::billing::webhook)
            .service(routes::ai::summarize)
            .service(routes::ai::query)
            .service(routes::webhooks::inbound)
            .service(routes::webhooks::list_integrations)
            .service(routes::webhooks::set_integration_secret)
            .service(routes::webhooks::delete_integration_secret)
            .route("/mcp", web::post().to(mcp::post))
            .route("/mcp", web::get().to(mcp::get))
            .default_service(web::to(spa::spa))
    })
    .bind(bind)?
    .run()
    .await
}

/// Daily: delete events older than each project's plan retention.
fn spawn_retention_job(state: Data<AppState>) {
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(6 * 3600)).await;
            match pg::all_company_plans(&state.client).await {
                Ok(list) => {
                    for (company_id, plan) in list {
                        let days = billing::plan(&plan).retention_days;
                        if let Err(e) = state.ch.purge_older_than(&company_id, days).await {
                            tracing::warn!("retention purge failed for {company_id}: {e}");
                        }
                    }
                }
                Err(e) => tracing::warn!("retention job: {e}"),
            }
            tokio::time::sleep(std::time::Duration::from_secs(18 * 3600)).await;
        }
    });
}
