# syntax=docker/dockerfile:1
#
# All-in-one Raterlog image: builds the Rust API and the TanStack web app, then
# runs PostgreSQL, Cassandra, MailHog, the Rust API and the web server together
# from a single container (see docker/entrypoint.sh).

########################  Stage 1 — build the Rust API  ########################
FROM rust:1-bookworm AS api-builder
WORKDIR /build
COPY api/Cargo.toml api/Cargo.lock ./
COPY api/src ./src
RUN cargo build --release && cp target/release/raterlog /raterlog

########################  Stage 2 — build the web app  ########################
FROM node:22-bookworm AS web-builder
WORKDIR /build
RUN npm install -g bun@1.4.0
COPY web/package.json web/bun.lock ./
RUN bun install --frozen-lockfile
COPY web/ ./
RUN bun run build

########################  Stage 3 — runtime  ########################
FROM debian:bookworm-slim AS runtime
ENV DEBIAN_FRONTEND=noninteractive

# System services: PostgreSQL 15 (bookworm), Cassandra 5.0 (JDK 17), Node 22,
# MailHog, plus gosu to drop privileges for postgres/cassandra.
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg gosu procps \
      postgresql postgresql-contrib \
      openjdk-17-jre-headless; \
    curl -fsSL https://downloads.apache.org/cassandra/KEYS \
      | gpg --dearmor -o /etc/apt/trusted.gpg.d/cassandra.gpg; \
    echo "deb [signed-by=/etc/apt/trusted.gpg.d/cassandra.gpg] https://debian.cassandra.apache.org 50x main" \
      > /etc/apt/sources.list.d/cassandra.list; \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -; \
    apt-get update; \
    apt-get install -y --no-install-recommends cassandra nodejs; \
    curl -fsSL -o /usr/local/bin/mailhog \
      https://github.com/mailhog/MailHog/releases/download/v1.0.1/MailHog_linux_amd64; \
    chmod +x /usr/local/bin/mailhog; \
    rm -rf /var/lib/apt/lists/*

# App artifacts.
COPY --from=api-builder /raterlog /usr/local/bin/raterlog
COPY --from=web-builder /build/.output /app/web/.output
COPY web/schema.sql /app/web/schema.sql
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENV DATABASE_URL="postgres://postgres:postgres@localhost:5432/example" \
    SMTP_HOST="localhost" \
    SMTP_PORT="1025" \
    APP_URL="http://localhost:3000" \
    PORT="3000" \
    HOST="0.0.0.0" \
    COOKIE_SECURE="false"

# web (3000), api (8080), MailHog UI (8025)
EXPOSE 3000 8080 8025

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
