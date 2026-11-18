# Raterlog

Real-time event tracking for products: send an event with one HTTP request and get a live feed, push notifications, threshold monitors, charts, funnels, user journeys and KPI insights. LogSnag-compatible API.

## Architecture

One Rust binary serves everything:

- **API** (`api/`, actix-web): auth, projects, channels, tokens, invites, ingest, analytics, billing.
- **Web app** (`web/`, Rsbuild + React + Blueprint): built to `web/dist` and **embedded into the binary** with `rust-embed`, so the UI and the API share one origin.
- **Postgres**: users, sessions, projects, members, tokens, insights, identified users, plan.
- **ClickHouse**: events (columnar, compressed, `windowFunnel` for funnels, per-plan retention).
- **Dodo Payments**: hosted checkout, customer portal, webhooks → `Company.plan`.

## Ingest API (LogSnag-compatible)

`Authorization: Bearer <token>` (create a token in Settings → Tokens).

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

## MCP server (AI agents)

`https://raterlog.com/mcp`: Streamable HTTP, stateless, `Authorization: Bearer <project token>`.

```sh
claude mcp add --transport http raterlog https://raterlog.com/mcp --header "Authorization: Bearer $TOKEN"
```

Write tools: `log_event`, `identify_user`, `set_insight`, `increment_insight`, `create_monitor`.
Read tools: `search_events`, `event_stats`, `event_timeseries`, `top_breakdown`, `funnel`, `user_journey`, `list_channels`, `list_insights`, `list_monitors`, `get_usage`.
Implementation: `api/src/mcp.rs`. Setup guide for every client: `/docs/agents` (and the in-app Setup guide with your token filled in); summary for LLMs at `/llms.txt`.

## Dashboard API (session cookie)

Auth `/api/auth/*`; projects `/api/companies[/{id}]` with channels, tokens, invites;
feed `GET /api/companies/{id}/events?channel&event&user_id&tag=k:v&q&before&since&limit`;
analytics `/api/companies/{id}/analytics/{timeseries,breakdown,funnel}`;
journeys `GET /api/companies/{id}/users/{userId}`; usage `GET /api/companies/{id}/usage`;
monitors `GET|POST /api/companies/{id}/monitors`, `PATCH|DELETE /api/companies/{id}/monitors/{mid}`, `POST .../monitors/{mid}/test`;
billing `GET /api/plans`, `POST /api/companies/{id}/billing/{checkout,portal}`, `POST /api/billing/webhook`;
AI `POST /api/channels/{id}/ai/{summarize,query}`. Health: `GET /health`.

The typed client in `web/src/lib/api.ts` is the contract.

## Monitors

Server-side threshold alerts (Axiom-style) on your event stream. A monitor counts events in ClickHouse once a minute — optionally narrowed to a channel, an event name and/or a `key:value` tag — and alerts when:

- `count_above` — more than `threshold` events in `window_minutes` (spike),
- `count_below` — fewer than `threshold` events (drop),
- `absent` — **no** matching events at all in the window (dead heartbeat/cron).

Alerts go to a list of emails (via `SMTP_*` settings) and/or webhook URLs: `hooks.slack.com` gets a Slack payload, `discord.com`/`discordapp.com` hosts get Discord's, and any other URL gets a generic JSON POST describing the monitor. On recovery a "resolved" notice can be sent (`notifyResolved`). `cooldown_minutes` suppresses repeated alerts; the evaluator runs inside the same binary (`api/src/monitor.rs`) and uses a Postgres advisory lock, so multiple replicas evaluate each tick only once. Manage monitors in the app (Monitors page), via the dashboard API, or through the `list_monitors`/`create_monitor` MCP tools.

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
Optional: `SMTP_HOST`/`SMTP_PORT` (invite emails; invites can also be shared as links), `OPENAI_API_KEY` (AI copilot), `DODO_*` (billing; endpoints return 503 when unset).

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
