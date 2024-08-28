use actix_web::{web::Data, App, HttpServer};
use scylla::{Session, SessionBuilder};
use std::time::Duration;
use tokio::time::sleep;
use tokio_postgres::NoTls;

use crate::routes::log::{hello, log_input};

mod db;
mod routes;

struct AppState {
    db: Session,
}

async fn connect_with_retry(
    uri: &str,
    max_retries: u32,
    initial_delay: Duration,
) -> Result<Session, Box<dyn std::error::Error>> {
    let mut retries = 0;
    let mut delay = initial_delay;

    loop {
        match SessionBuilder::new().known_node(uri).build().await {
            Ok(session) => return Ok(session),
            Err(e) => {
                if retries >= max_retries {
                    return Err(
                        format!("Failed to connect after {} retries: {}", max_retries, e).into(),
                    );
                }
                println!(
                    "Connection attempt failed: {}. Retrying in {:?}...",
                    e, delay
                );
                sleep(delay).await;
                retries += 1;
                delay *= 2; // Exponential backoff
            }
        }
    }
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // let (client, _) = tokio_postgres::connect("postgres://avnadmin:AVNS_g9jhX8Ctx_x0P6vDC4K@pg-1d2d2fd1-suryavirkapur-e42a.k.aivencloud.com:18186/defaultdb?sslmode=require", NoTls).await.unwrap();
    //let x = client.execute("SELECT * FROM User", &[]).await.unwrap();
    // for row in x {
    //     println!("{:?}", row);
    // }
    //print!(" XX {}", x);

    let uri = "cassandra:9042";
    let max_retries = 5;
    let initial_delay = Duration::from_secs(10);

    let session = connect_with_retry(uri, max_retries, initial_delay)
        .await
        .unwrap();

    println!("Successfully connected to Cassandra!");

    db::start_db(&session).await;

    // let prepared = session
    //     .prepare("INSERT INTO raterlog.logs (channel_id, message) VALUES (?, ?)")
    //     .await
    //     .unwrap();

    // session
    //     .execute(&prepared, (42_i32, "I'm prepared!"))
    //     .await
    //     .unwrap();

    // session
    //     .execute(&prepared, (43_i32, "I'm prepared 2!"))
    //     .await
    //     .unwrap();

    // session
    //     .execute(&prepared, (44_i32, "I'm prepared 3!"))
    //     .await
    //     .unwrap();

    let data = Data::new(AppState { db: session });

    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .service(hello)
            .service(log_input)
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}
