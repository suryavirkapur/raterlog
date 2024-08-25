CREATE KEYSPACE raterlog
   WITH replication = {'class': 'SimpleStrategy', 'replication_factor': '1'}
   AND durable_writes = true;
CREATE TABLE raterlog.logs (
     channel_id int,
     message text,
)