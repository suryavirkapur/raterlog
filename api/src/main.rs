use actix_web::{web::Data, App, HttpServer};
use db::connect_with_retry;
use scylla::Session;
use sqlx::{postgres::PgPoolOptions, FromRow};
use std::time::Duration;

use crate::routes::log::{hello, log_input};

mod db;
mod routes;

use sqlx::postgres::PgPool;

#[derive(FromRow, Debug)]
struct User {
    name: String,
    email: String,
    password: String,
}

async fn fetch_and_display_users(pool: &PgPool) -> Result<(), sqlx::Error> {
    let users = sqlx::query!("SELECT name, email, password FROM User")
        .fetch_all(pool)
        .await?;

    println!("All Users:");
    for user in users {
        println!("Name: {}", user.name);
        println!("Email: {}", user.email);
        println!("Password: [REDACTED]");
        println!("--------------------");
    }

    Ok(())
}

async fn print_user_columns(pool: &PgPool) -> Result<(), sqlx::Error> {
    let columns = sqlx::query!(
        "SELECT column_name, data_type 
         FROM information_schema.columns 
         WHERE table_name = 'User'"
    )
    .fetch_all(pool)
    .await?;

    println!("Columns in User table:");
    for column in columns {
        println!("{:?}: {:?}", column.column_name, column.data_type);
    }

    Ok(())
}

struct AppState {
    db: Session,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let uri = "localhost:9042";
    let max_retries = 5;
    let initial_delay = Duration::from_secs(10);

    let session = connect_with_retry(uri, max_retries, initial_delay)
        .await
        .unwrap();
    println!("Successfully connected to Cassandra!");

    let pool = PgPoolOptions::new().max_connections(5).connect("postgres://avnadmin:AVNS_g9jhX8Ctx_x0P6vDC4K@pg-1d2d2fd1-suryavirkapur-e42a.k.aivencloud.com:18186/defaultdb?sslmode=require").await.unwrap();
    println!("Successfully connected to Postgres!");
    fetch_and_display_users(&pool).await.unwrap();
    db::start_db(&session).await;

    let data = Data::new(AppState { db: session });

    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .service(hello)
            .service(log_input)
    })
    .bind("0.0.0.0:8080")?
    .run()
    .await
}
