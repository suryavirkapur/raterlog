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

async fn verify_token(client: &tokio_postgres::Client, token: &str, channel_id: &str) -> bool {
    let result = client
        .query_one(
            "SELECT EXISTS(
                SELECT 1 FROM \"Token\" t
                JOIN \"Channel\" c ON t.\"companyID\" = c.\"companyID\"
                WHERE t.token = $1 AND c.id = $2
            )",
            &[&token, &channel_id],
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
    if !verify_token(&state.client, token, &data.channel_id).await {
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
    let channel_id = path.into_inner();
    let token = basic_auth.trim_start_matches("Basic ");
    if !verify_token(&state.client, token, &channel_id).await {
        return HttpResponse::Unauthorized().finish();
    }

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

// #[get("/live-logs/{channel_id}")]
// async fn live_logs(
//     request: HttpRequest,
//     path: web::Path<String>,
//     state: web::Data<AppState>,
// ) -> impl Responder {
//     let channel_id = path.into_inner();
//     let basic_auth = match request.headers().get("Authorization") {
//         Some(header) => header.to_str().unwrap_or(""),
//         None => return HttpResponse::Unauthorized().finish(),
//     };
//     let token = basic_auth.trim_start_matches("Basic ");
//     if !verify_token(&state.client, token, &channel_id).await {
//         return HttpResponse::Unauthorized().finish();
//     }

//     let db = Arc::clone(&state.db);

//     let stream = tokio_stream::wrappers::IntervalStream::new(interval(Duration::from_secs(5)))
//         .then(move |_| {
//             let db = Arc::clone(&db);
//             let channel_id = channel_id.clone();
//             async move {
//                 let result =   db.query(
//                     "SELECT channel_id, timestamp, event_name, event_payload FROM raterlog.logs WHERE channel_id = ? ORDER BY timestamp DESC LIMIT 1",
//                     (channel_id,)
//                 ).await;
//                 match result{
//                     Ok(res) => {
//                         let rows: Vec<Log> = res
//                 .rows_typed::<Log>()
//                 .unwrap()
//                 .into_iter()
//                 .map(|row| row.unwrap())
//                 .collect();

//                         match res.into_typed_rows::<Log>() {
//                             Some(mut rows) => {
//                                 if let Some(log) = rows.next() {
//                                     match log {
//                                         Ok(log) => {
//                                             let data = serde_json::to_string(&log).unwrap();
//                                             Ok(Bytes::from(format!("data: {}\n\n", data)))
//                                         },
//                                         Err(e) => Err(Error::from(e))
//                                     }
//                                 } else {
//                                     Ok(Bytes::from(":\n\n")) // Keep-alive when no rows
//                                 }
//                             },
//                             None => Ok(Bytes::from(":\n\n")) // Keep-alive when no typed rows
//                         }
//                     },
//                     Err(e) => Err(Error::from(e)) // Convert database error to actix_web::Error
//                 }
//             }
//         });

//     HttpResponse::Ok()
//         .insert_header(("Content-Type", "text/event-stream"))
//         .insert_header(("Cache-Control", "no-cache"))
//         .streaming(stream)
// }
