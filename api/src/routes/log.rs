use actix_web::{
    get, post,
    web::{self},
};
use scylla::FromRow;

use crate::AppState;

#[derive(Debug, serde::Deserialize, FromRow)]
struct LogReadout {
    channel_id: i32,
    message: String,
}

#[post("/log")]
pub async fn log_input(data: web::Json<LogReadout>, dbs: web::Data<AppState>) -> String {
    print!("Got Req");
    eprintln!("Received: {:?}", data.channel_id);
    eprintln!("Received: {:?}", data.message);
    "OK\n".to_owned()
}

#[get("/log")]
pub async fn logs_display(dbs: web::Data<AppState>) -> String {
    let strsm = dbs
        .client
        .query_one("SELECT * FROM \"Token\"", &[])
        .await
        .unwrap()
        .get::<_, String>(1);
    strsm
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
