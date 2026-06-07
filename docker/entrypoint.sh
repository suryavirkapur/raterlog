#!/usr/bin/env bash
# Boots every Raterlog service inside a single container:
# PostgreSQL, Cassandra, MailHog, the Rust API, and the Next.js web server.
set -euo pipefail

JDK17="/usr/lib/jvm/java-17-openjdk-amd64"
PGDATA="/var/lib/postgresql/data"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin | head -1)"

log() { echo "[entrypoint] $*"; }
port_open() { (exec 3<>"/dev/tcp/localhost/$1") 2>/dev/null && exec 3>&-; }

########## PostgreSQL ##########
log "Preparing PostgreSQL"
mkdir -p "$PGDATA"
chown -R postgres:postgres "$PGDATA"
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  gosu postgres "$PGBIN/initdb" -D "$PGDATA" >/dev/null
  echo "listen_addresses = 'localhost'" >>"$PGDATA/postgresql.conf"
  echo "host all all 127.0.0.1/32 trust" >>"$PGDATA/pg_hba.conf"
  echo "host all all ::1/128 trust" >>"$PGDATA/pg_hba.conf"
fi
gosu postgres "$PGBIN/pg_ctl" -D "$PGDATA" -o "-p 5432" -w start
gosu postgres psql -q -c "ALTER USER postgres WITH PASSWORD 'postgres';"
gosu postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='example'" | grep -q 1 \
  || gosu postgres createdb example
log "PostgreSQL ready on :5432 (Rust API applies the schema on startup)"

########## Cassandra ##########
log "Starting Cassandra"
mkdir -p /var/lib/cassandra /var/log/cassandra
chown -R cassandra:cassandra /var/lib/cassandra /var/log/cassandra
gosu cassandra env JAVA_HOME="$JDK17" MAX_HEAP_SIZE="${CASSANDRA_MAX_HEAP:-2G}" \
  /usr/sbin/cassandra >/var/log/cassandra/stdout.log 2>&1
for _ in $(seq 1 90); do
  if port_open 9042; then break; fi
  sleep 2
done
log "Cassandra ready on :9042"

########## MailHog ##########
log "Starting MailHog"
/usr/local/bin/mailhog >/var/log/mailhog.log 2>&1 &

########## Rust API ##########
log "Starting Rust API on :8080"
/usr/local/bin/raterlog >/var/log/raterlog.log 2>&1 &

########## Web (foreground / PID 1 child) ##########
log "Starting web server on :${PORT:-3000}"
cd /app/web
exec node .output/server/index.mjs
