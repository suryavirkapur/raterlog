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
pub async fn log_input(data: web::Json<LogReadout>) -> String {
    print!("Got Req");
    eprintln!("Received: {:?}", data.channel_id);
    eprintln!("Received: {:?}", data.message);
    "OK\n".to_owned()
}

#[get("/")]
pub async fn hello(data: web::Data<AppState>) -> String {
    let result = data
        .db
        .query("SELECT channel_id, message FROM raterlog.logs", &[])
        .await
        .unwrap();

    let mut iter = result.rows_typed::<LogReadout>().expect("X");
    while let Some(row_data) = iter.next().transpose().expect("Y") {
        println!("row_data: {:?}", row_data);
    }
    "Hello Actix".to_owned()
}
