use std::time::Duration;

use scylla::{Session, SessionBuilder};
use tokio::time::sleep;

pub async fn connect_with_retry(
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

pub async fn start_db(session: &Session) {
    let _ = session
        .query(
            "CREATE KEYSPACE IF NOT EXISTS raterlog
       WITH replication = {'class': 'SimpleStrategy', 'replication_factor': '1'}
       AND durable_writes = true;
    ",
            &[],
        )
        .await
        .unwrap();

    let _ = session
        .query(
            "CREATE TABLE IF NOT EXISTS raterlog.logs (channel_id int primary key, message text)",
            &[],
        )
        .await
        .unwrap();
}
