use crate::AppState;
use actix_web::{get, post, web, HttpRequest, HttpResponse};
use chrono::Utc;
use scylla::FromRow;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, Clone, FromRow)]
struct Log {
    channel_id: String,
    timestamp: String,
    event_name: String,
    event_payload: String,
}

#[derive(Debug, Deserialize)]
struct CreateLogInput {
    channel_id: String,
    event_name: String,
    event_payload: String,
}

async fn verify_token(client: &tokio_postgres::Client, token: &str) -> bool {
    let result = client
        .query_one(
            "SELECT EXISTS(SELECT 1 FROM \"Token\" WHERE token = $1)",
            &[&token],
        )
        .await;

    match result {
        Ok(row) => row.get::<_, bool>(0),
        Err(_) => false,
    }
}

#[post("/log")]
async fn create_log(
    request: HttpRequest,
    data: web::Json<CreateLogInput>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let basic_auth = match request.headers().get("Authorization") {
        Some(header) => header.to_str().unwrap_or(""),
        None => return HttpResponse::Unauthorized().finish(),
    };

    let token = basic_auth.trim_start_matches("Basic ");
    if !verify_token(&state.client, token).await {
        return HttpResponse::Unauthorized().finish();
    }

    let log = Log {
        channel_id: data.channel_id.clone(),
        timestamp: Utc::now().to_string(),
        event_name: data.event_name.clone(),
        event_payload: data.event_payload.clone(),
    };

    let result = state.db.query(
        "INSERT INTO raterlog.logs (channel_id, timestamp, event_name, event_payload) VALUES (?, ?, ?, ?)",
        (&log.channel_id, &log.timestamp, &log.event_name, &log.event_payload)
    ).await;

    match result {
        Ok(_) => HttpResponse::Created().json(&log),
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

#[get("/log/{channel_id}")]
async fn get_logs(
    request: HttpRequest,
    path: web::Path<String>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let basic_auth = match request.headers().get("Authorization") {
        Some(header) => header.to_str().unwrap_or(""),
        None => return HttpResponse::Unauthorized().finish(),
    };

    let token = basic_auth.trim_start_matches("Basic ");
    if !verify_token(&state.client, token).await {
        return HttpResponse::Unauthorized().finish();
    }

    let channel_id = path.into_inner();
    let result = state.db.query(
        "SELECT channel_id, timestamp, event_name, event_payload FROM raterlog.logs WHERE channel_id = ?",
        (channel_id,)
    ).await;

    match result {
        Ok(res) => {
            let rows: Vec<Log> = res
                .rows_typed::<Log>()
                .unwrap()
                .into_iter()
                .map(|row| row.unwrap())
                .collect();

            HttpResponse::Ok().json(rows)
        }
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

#[get("/")]
pub async fn hello(data: web::Data<AppState>) -> String {
    let db_name = data
        .client
        .query_one("SELECT current_database()", &[])
        .await
        .unwrap()
        .get::<_, String>(0);

    db_name
}
