use actix_web::{web::Data, App, HttpServer};

use scylla::{Session, SessionBuilder};
use tokio_postgres::NoTls;

use crate::routes::log::{hello, log_input};

mod db;
mod routes;

struct AppState {
    db: Session,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // let (client, _) = tokio_postgres::connect("postgres://avnadmin:AVNS_g9jhX8Ctx_x0P6vDC4K@pg-1d2d2fd1-suryavirkapur-e42a.k.aivencloud.com:18186/defaultdb?sslmode=require", NoTls).await.unwrap();
    //let x = client.execute("SELECT * FROM User", &[]).await.unwrap();
    // for row in x {
    //     println!("{:?}", row);
    // }
    //print!(" XX {}", x);
    let uri = "cassandra-container:9042";

    let session = SessionBuilder::new()
        .known_node(uri)
        .build()
        .await
        .expect("msg");

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
