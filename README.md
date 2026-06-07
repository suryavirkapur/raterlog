# Raterlog

Raterlog is a LogSnag-style event monitoring platform: ingest product events, identify users, publish live insights, and ask an AI copilot what just happened.

The Go rewrite lives at [suryavirkapur/raterlog-go](https://github.com/suryavirkapur/raterlog-go). This repository is the original Rust + Next.js stack, now with **all HTTP APIs owned by the Rust backend**.

## Architecture

- **Rust API (`api/`)** — authentication, sessions, companies, members, invites, channels, API tokens, LogSnag-compatible ingest (`/v1/log`, `/v1/identify`, `/v1/insight`), Cassandra event storage, and AI summarize/query.
- **Next.js UI (`web/`)** — dashboard and marketing site. It talks to the API over JSON; it does not own Prisma mutations or Next.js route handlers for product data.
- **Postgres** — users, sessions, companies, membership, channels, tokens, invites, insights, identified users. The API applies this schema on boot.
- **Cassandra/Scylla** — append-only event logs.
- **Kong** — optional gateway in front of the API.

## API surface

Session cookie `raterlog_session` (or `X-Session-Token`) for the dashboard. Ingest uses `Authorization: Bearer <token>` or `Basic <token>`.

Auth: `POST /api/auth/signup`, `POST /api/auth/signin`, `POST /api/auth/signout`, `GET /api/auth/me`

Companies: `GET|POST /api/companies`, `GET|PATCH /api/companies/{id}`, channels, members, invites, tokens

Invites: `GET /api/invites/{token}`, `POST /api/invites/{token}/accept`

Logs: `POST /api/logs`, `GET /api/logs/{channelId}` (aliases `POST /log`, `GET /log/{channelId}`)

LogSnag-compatible: `POST /v1/log`, `POST /v1/identify`, `POST|PATCH /v1/insight`

AI: `POST /api/channels/{channelId}/ai/summarize`, `POST /api/channels/{channelId}/ai/query`

## Run locally

Postgres on `5432`, Cassandra on `9042`, Mailhog on `1025`.

```sh
cd api
# optional: DATABASE_URL, CASSANDRA_URI, CORS_ORIGINS, APP_URL, SMTP_HOST, SMTP_PORT, OPENAI_API_KEY
cargo run
```

```sh
cd web
echo 'NEXT_PUBLIC_API_URL=http://localhost:8080' > .env
bun install   # or npm install
bun run dev
```

The API creates Postgres tables on startup. Open `http://localhost:3000`.

Docker Compose starts Cassandra, Postgres, Mailhog, Kong, the API, and the web UI. Set `NEXT_PUBLIC_API_URL` at image build time to the browser-reachable API (default `http://localhost:8080`).

## AI

Summaries and Q&A always work with local heuristics. Set `OPENAI_API_KEY` on the API to upgrade those answers with `gpt-4o-mini`.
