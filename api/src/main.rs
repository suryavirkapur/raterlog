use actix_web::{web::Data, App, HttpServer};
use db::connect_with_retry;
use scylla::Session;
use std::time::Duration;
use tokio_postgres::{Client, NoTls};

mod db;
mod routes;

struct AppState {
    db: Session,
    client: Client,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let uri = "host.docker.internal:9042";
    let max_retries = 5;
    let initial_delay = Duration::from_secs(10);

    let (client, connection) = tokio_postgres::connect(
        "postgres://postgres:postgres@host.docker.internal:5432/example",
        NoTls,
    )
    .await
    .unwrap();

    // Spawn the connection handler
    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("Connection error: {}", e);
        }
    });

    println!("Successfully connected to Postgres!");

    let db_name = client
        .query_one("SELECT current_database()", &[])
        .await
        .unwrap()
        .get::<_, String>(0);

    println!("Connected to database: {}", db_name);

    let session = connect_with_retry(uri, max_retries, initial_delay)
        .await
        .unwrap();
    db::start_db(&session).await;
    println!("Successfully connected to Cassandra!");

    let data = Data::new(AppState {
        db: session,
        client,
    });

    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .service(routes::log::hello)
            .service(routes::log::create_log)
            .service(routes::log::get_logs)
    })
    .bind("0.0.0.0:8080")?
    .run()
    .await
}
