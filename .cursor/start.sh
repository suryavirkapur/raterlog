#!/usr/bin/env bash
# Per-boot startup for the Raterlog backing services: PostgreSQL, Cassandra, MailHog.
# Waits for each to become ready and applies the Prisma schema. Idempotent.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JDK17="/usr/lib/jvm/java-17-openjdk-amd64"

port_open() { (exec 3<>"/dev/tcp/localhost/$1") 2>/dev/null && exec 3>&-; }

echo "==> Starting PostgreSQL"
sudo pg_ctlcluster 16 main start 2>/dev/null || true
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q 2>/dev/null; then break; fi
  sleep 1
done
# Ensure the credentials + database the apps expect (idempotent).
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';" >/dev/null
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='example'" | grep -q 1 \
  || sudo -u postgres createdb example
echo "    PostgreSQL ready on :5432"

echo "==> Starting Cassandra"
if ! port_open 9042; then
  sudo mkdir -p /var/lib/cassandra /var/log/cassandra
  sudo chown -R cassandra:cassandra /var/lib/cassandra /var/log/cassandra
  sudo -u cassandra env JAVA_HOME="$JDK17" /usr/sbin/cassandra >/dev/null 2>&1
fi
for _ in $(seq 1 90); do
  if port_open 9042; then break; fi
  sleep 2
done
echo "    Cassandra ready on :9042"

echo "==> Starting MailHog"
if ! port_open 1025; then
  setsid /usr/local/bin/mailhog >/tmp/mailhog.log 2>&1 </dev/null &
fi
echo "    MailHog ready on :1025 (UI :8025)"

echo "==> Applying database schema"
cd "$REPO_ROOT/web"
node scripts/init-db.mjs

echo "==> All backing services started"
