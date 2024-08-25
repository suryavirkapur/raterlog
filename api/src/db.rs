use scylla::Session;

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
