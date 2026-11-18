# Raterlog

Real-time event tracking for products: send an event with one HTTP request and get a live feed, push notifications, charts, funnels, user journeys and KPI insights. LogSnag-compatible API.

## Architecture

One Rust binary serves everything:

- **API** (`api/`, actix-web): auth, projects, channels, tokens, invites, ingest, analytics, billing.
- **Web app** (`web/`, Rsbuild + React + Blueprint): built to `web/dist` and **embedded into the binary** with `rust-embed`, so the UI and the API share one origin.
- **Postgres**: users, sessions, projects, members, tokens, insights, identified users, plan.
- **ClickHouse**: events (columnar, compressed, `windowFunnel` for funnels, per-plan retention).
- **Dodo Payments**: hosted checkout, customer portal, webhooks → `Company.plan`.

## Ingest API (LogSnag-compatible)

`Authorization: Bearer <token>` (create a token in Settings → Tokens). Tokens have a
scope: `ingest` (default for new tokens) can only write, `read` can only read, `full`
does both — tokens created before scopes existed are `full`. Ingest endpoints accept
`ingest` or `full` tokens.

```sh
curl -X POST https://raterlog.com/v1/log \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"project":"my-saas","channel":"payments","event":"New Subscription","icon":"💰","notify":true,"tags":{"plan":"pro"},"user_id":"user_123"}'
```

- `POST /v1/log` — event (`project`, `channel`, `event`, `description`, `icon`, `notify`, `tags`, `user_id`, `timestamp`)
- `POST /v1/identify` — user properties (`project`, `user_id`, `properties`)
- `POST /v1/insight`, `PATCH /v1/insight` (`value: {"$inc": 1}`) — KPI tiles

`project` is the project name (or id). Channels are created on first use.
Legacy: `POST /api/logs` / `POST /log` with `channel_id`, `event_name`, `event_payload`, `metadata`.

## Inbound webhooks

Turn third-party webhooks into events with no code — the project token lives in the URL because providers can't set auth headers:

```
POST /v1/webhooks/{source}/{token}
```

Sources: `dodo` → `payments` (all payment, refund, dispute, subscription, invoice, dunning and abandoned-checkout events; payouts → `payouts`; money-moving and churn events notify) · `stripe` → `payments` (checkouts, subscriptions, invoices, refunds — amount/currency/customer in tags, notify on money events) · `github` → `github` (push, pull_request, release, issues, star) · `vercel` → `deploys` (deployment created/succeeded/error) · `generic` → `webhooks` (JSON body with optional `event`, `description`, `channel`, `icon`, `tags`, `user_id`). Unknown event types are still logged, never rejected.

Signature verification is optional per project: set a secret in **Settings → Integrations** (stored per source in Postgres) and Stripe-Signature, X-Hub-Signature-256, x-vercel-signature, or Standard Webhooks signatures are enforced. With no secret, deliveries are accepted.

Session endpoints: `GET`/`PUT`/`DELETE /api/companies/{id}/integrations[/{source}]`.

## MCP server (AI agents)

`https://raterlog.com/mcp`: Streamable HTTP, stateless, `Authorization: Bearer <project token>`.

```sh
claude mcp add --transport http raterlog https://raterlog.com/mcp --header "Authorization: Bearer $TOKEN"
```

Write tools: `log_event`, `identify_user`, `set_insight`, `increment_insight` — need an `ingest` or `full` token.
Read tools: `search_events`, `event_stats`, `event_timeseries`, `top_breakdown`, `funnel`, `user_journey`, `list_channels`, `list_insights`, `get_usage`, `get_dashboard` — need a `read` or `full` token.
`tools/list` only shows the tools the token's scope allows.
Implementation: `api/src/mcp.rs`. Setup guide for every client: `/docs/agents` (and the in-app Setup guide with your token filled in); summary for LLMs at `/llms.txt`.

## Dashboard API (session cookie)

Auth `/api/auth/*`; projects `/api/companies[/{id}]` with channels, tokens, invites;
feed `GET /api/companies/{id}/events?channel&event&user_id&tag=k:v&q&before&since&limit`;
analytics `/api/companies/{id}/analytics/{timeseries,breakdown,funnel}`;
dashboards `/api/companies/{id}/dashboards` (+ `/{did}` get/rename/delete, `/{did}/widgets` create,
`/{did}/widgets/{wid}` update/delete, `PUT /{did}/layout` bulk x/y/w/h save) — widget configs hold
the same params the analytics endpoints take, and the UI fetches widget data through them;
journeys `GET /api/companies/{id}/users/{userId}`; usage `GET /api/companies/{id}/usage`;
billing `GET /api/plans`, `POST /api/companies/{id}/billing/{checkout,portal}`, `POST /api/billing/webhook`;
AI `POST /api/channels/{id}/ai/{summarize,query}`. Health: `GET /health`.

The typed client in `web/src/lib/api.ts` is the contract.

## Run locally

```sh
docker compose up --build          # app on http://localhost:8080
```

Or for development with hot reload:

```sh
docker compose up -d postgres clickhouse
cd api && cp .env.example .env && cargo run      # :8080
cd web && npm install && npm run dev             # :3000, proxies /api and /v1 to :8080
```

## Configuration

See `api/.env.example`. Required: `DATABASE_URL`, `CLICKHOUSE_URL`, `APP_URL`.
Optional: `SMTP_HOST`/`SMTP_PORT` (invite emails; invites can also be shared as links), `OPENAI_API_KEY` (AI copilot), `DODO_*` (billing; endpoints return 503 when unset), `CLICKHOUSE_STORAGE_POLICY`/`CLICKHOUSE_HOT_DAYS` (storage tiering, below).

### ClickHouse storage tiering (hot → S3)

Off by default. When `CLICKHOUSE_STORAGE_POLICY` names a storage policy defined
in the ClickHouse server config (e.g. `tiered`), the events table is created —
or `ALTER`ed, idempotently — with `SETTINGS storage_policy = '<policy>'` and a
second TTL `toDateTime(ts) + INTERVAL <CLICKHOUSE_HOT_DAYS> DAY TO VOLUME 'cold'`
(default 30 days) alongside the existing 3-year delete TTL. Parts older than
`CLICKHOUSE_HOT_DAYS` move to cheap object storage; queries stay transparent.

`deploy/clickhouse/storage.xml` is a drop-in server config: an S3 disk
(endpoint/keys from `CLICKHOUSE_S3_*` env vars via `from_env`), a local
read-through cache disk in front of it, and a `tiered` policy with `hot` (a
dedicated local disk), `cold` and `default` volumes. `default` mirrors the
built-in policy so an existing events table can be ALTERed onto `tiered` —
ClickHouse requires the new policy to contain the old policy's volumes.

```sh
# local demo with MinIO standing in for S3
docker compose -f docker-compose.yml -f docker-compose.tiered.yml up --build
```

Per-plan retention (see Plans below) is enforced at query time — no read path
returns events older than a project's plan history — and a daily background
job deletes expired rows outright.

### Raterlog on Raterlog

Set `RATERLOG_SELF_EMAIL` to your account's email and the server tracks itself:
it creates a `raterlog` project for that account (on the top plan, never
quota-blocked) and logs `#signups`, `#projects`, `#activation` (API token
created, first event received), `#growth` (invites), `#billing` (checkout,
subscription changes, failed payments) and `#ops` (server started), plus
Users / Projects / Activated projects insight tiles and identified users.
It runs in-process and fire-and-forget (`api/src/selftrack.rs`).

`www.` hosts are redirected (301) to the apex domain by the server.

## Plans

| Plan | Monthly | Yearly | Events / month | Seats | History |
|---|---|---|---|---|---|
| Free | $0 | $0 | 3,000 | 3 | 30 days |
| Starter | $12 | $120 | 50,000 | Unlimited | 1 year |
| Growth | $29 | $290 | 250,000 | Unlimited | 2 years |
| Scale | $59 | $590 | 1,000,000 | Unlimited | 3 years |

Free projects stop ingesting at the limit (HTTP 402); paid projects never drop events.
Defined in `api/src/billing.rs` and mirrored in `web/src/lib/plans.ts`.

The Go rewrite lives at [suryavirkapur/raterlog-go](https://github.com/suryavirkapur/raterlog-go).
