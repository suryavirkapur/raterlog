# syntax=docker/dockerfile:1
# One image: the Rust API with the React SPA embedded in the binary.
# Postgres and ClickHouse run as separate services (see docker-compose.yml).

FROM node:22-bookworm-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

FROM rust:1-bookworm AS api
WORKDIR /build/api
COPY api/Cargo.toml api/Cargo.lock ./
COPY api/src ./src
COPY --from=web /web/dist /build/web/dist
RUN cargo build --release && cp target/release/raterlog /raterlog

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/* && useradd -r -u 10001 raterlog
COPY --from=api /raterlog /usr/local/bin/raterlog
USER raterlog
ENV HTTP_ADDR=0.0.0.0:8080 COOKIE_SECURE=true RUST_LOG=info
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD curl -fsS http://127.0.0.1:8080/health || exit 1
CMD ["raterlog"]
