//! Remote MCP server (Streamable HTTP transport, stateless JSON responses).
//!
//!   POST https://raterlog.com/mcp
//!   Authorization: Bearer <project API token>
//!
//! The token picks the project, so no tool takes a `project` argument. Tools
//! cover both directions: writing (log events, identify users, insights) and
//! reading (search the feed, counts, breakdowns, funnels, user journeys).
//! Write tools need an `ingest` or `full` token, read tools a `read` or `full`
//! one; `tools/list` only advertises what the token's scope allows.

use crate::billing;
use crate::ch::{EventFilter, PublicEvent};
use crate::monitor;
use crate::pg;
use crate::routes::log::{ingest_event, resolve_channel, value_to_tags, NewEvent};
use crate::routes::{retention_cutoff, retention_since};
use crate::state::AppState;
use crate::util::{api_token_from_request, generate_id};
use actix_web::{http::header, web, HttpRequest, HttpResponse};
use chrono::{Duration, Utc};
use serde_json::{json, Value};

const SUPPORTED_VERSIONS: &[&str] = &["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const LATEST_VERSION: &str = "2025-06-18";

const WRITE_TOOLS: &[&str] = &["log_event", "identify_user", "set_insight", "increment_insight"];
/// Configuration tools: only `full` tokens. `create_monitor` makes the server
/// send email/webhooks, which an ingest token shipped in a client app must not do.
const FULL_TOOLS: &[&str] = &["create_monitor"];
const READ_TOOLS: &[&str] = &[
    "search_events",
    "event_stats",
    "event_timeseries",
    "top_breakdown",
    "funnel",
    "user_journey",
    "list_channels",
    "list_insights",
    "get_usage",
    "get_dashboard",
    "list_monitors",
];

/// Whether the token's scope allows this tool.
fn scope_allows_tool(name: &str, scope: pg::TokenScope) -> bool {
    (WRITE_TOOLS.contains(&name) && scope.can_ingest())
        || (READ_TOOLS.contains(&name) && scope.can_read())
        || (FULL_TOOLS.contains(&name) && scope == pg::TokenScope::Full)
}

/// Clear error when a token calls a known tool outside its scope.
fn scope_error(name: &str, scope: pg::TokenScope) -> Option<String> {
    if WRITE_TOOLS.contains(&name) && !scope.can_ingest() {
        Some(format!("`{name}` is a write tool; this token's scope is '{scope}'. Use an ingest or full token."))
    } else if FULL_TOOLS.contains(&name) && scope != pg::TokenScope::Full {
        Some(format!("`{name}` changes project configuration; this token's scope is '{scope}'. Use a full token."))
    } else if READ_TOOLS.contains(&name) && !scope.can_read() {
        Some(format!("`{name}` is a read tool; this token's scope is '{scope}'. Use a read or full token."))
    } else {
        None
    }
}

const INSTRUCTIONS: &str = "Raterlog is real-time event tracking for products (LogSnag-compatible). \
This connection is scoped to ONE project by its API token. Use log_event to record something that \
just happened (signup, payment, deploy, error, agent task finished) — channels are created on first use; \
set notify=true only for events a human should be pinged about. Use identify_user to attach properties \
to a user_id, and set_insight/increment_insight for live KPI tiles. To answer questions about what \
happened, use search_events, event_stats, event_timeseries, top_breakdown, funnel and user_journey. \
Use get_dashboard to read a saved dashboard's widget definitions. \
To get notified about patterns later, create_monitor sets up a threshold or absence alert (list_monitors shows them). \
Ranges are 24h, 7d, 30d or 90d.";

fn tools(scope: pg::TokenScope) -> Value {
    let range = json!({ "type": "string", "enum": ["24h", "7d", "30d", "90d"], "description": "Time window (default 7d)." });
    let ro = json!({ "readOnlyHint": true, "openWorldHint": false });
    let all = json!([
        {
            "name": "log_event",
            "title": "Log event",
            "description": "Record an event in the project's live feed (e.g. 'User signed up', 'New Subscription', 'Deploy finished'). The channel is created automatically if it does not exist.",
            "inputSchema": { "type": "object", "required": ["channel", "event"], "properties": {
                "channel": { "type": "string", "description": "Channel name, lowercase-kebab, e.g. 'payments', 'signups', 'deploys'." },
                "event": { "type": "string", "description": "Short event title, e.g. 'New Subscription'." },
                "description": { "type": "string", "description": "Optional details; supports **bold**, `code` and links." },
                "icon": { "type": "string", "description": "A single emoji, e.g. '💰'." },
                "notify": { "type": "boolean", "description": "Send a push notification to the team. Default false." },
                "tags": { "type": "object", "additionalProperties": { "type": "string" }, "description": "Searchable key/value tags, e.g. {\"plan\":\"pro\"}." },
                "user_id": { "type": "string", "description": "Your user's id, to build user journeys and funnels." }
            }},
            "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": false, "openWorldHint": false }
        },
        {
            "name": "identify_user",
            "title": "Identify user",
            "description": "Attach or update properties (name, email, plan, ...) for a user_id. Properties are merged.",
            "inputSchema": { "type": "object", "required": ["user_id", "properties"], "properties": {
                "user_id": { "type": "string" },
                "properties": { "type": "object", "description": "Arbitrary JSON properties." }
            }},
            "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": true, "openWorldHint": false }
        },
        {
            "name": "set_insight",
            "title": "Set insight",
            "description": "Create or overwrite a live KPI tile (e.g. title 'MRR', value '$12,480').",
            "inputSchema": { "type": "object", "required": ["title", "value"], "properties": {
                "title": { "type": "string" },
                "value": { "type": "string", "description": "Display value, e.g. '$12,480' or '42'." },
                "icon": { "type": "string", "description": "A single emoji." }
            }},
            "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": true, "openWorldHint": false }
        },
        {
            "name": "increment_insight",
            "title": "Increment insight",
            "description": "Add to a numeric KPI tile (creates it at 0 first). Use a negative number to decrement.",
            "inputSchema": { "type": "object", "required": ["title"], "properties": {
                "title": { "type": "string" },
                "by": { "type": "number", "description": "Amount to add. Default 1." },
                "icon": { "type": "string" }
            }},
            "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": false, "openWorldHint": false }
        },
        {
            "name": "list_channels",
            "title": "List channels",
            "description": "List the project's channels.",
            "inputSchema": { "type": "object", "properties": {} },
            "annotations": ro
        },
        {
            "name": "list_insights",
            "title": "List insights",
            "description": "List the project's KPI tiles and their current values.",
            "inputSchema": { "type": "object", "properties": {} },
            "annotations": ro
        },
        {
            "name": "search_events",
            "title": "Search events",
            "description": "Newest-first events, optionally filtered. Use for 'what happened recently', 'show failed payments', 'what did user X do'.",
            "inputSchema": { "type": "object", "properties": {
                "channel": { "type": "string", "description": "Channel name." },
                "event": { "type": "string", "description": "Exact event name." },
                "user_id": { "type": "string" },
                "tag": { "type": "string", "description": "key:value, e.g. 'plan:pro'." },
                "query": { "type": "string", "description": "Case-insensitive text search over event, description and user id." },
                "limit": { "type": "integer", "minimum": 1, "maximum": 200, "description": "Default 25." }
            }},
            "annotations": ro
        },
        {
            "name": "event_stats",
            "title": "Event stats",
            "description": "Exact totals for a range: total events, unique users, events today and yesterday (UTC).",
            "inputSchema": { "type": "object", "properties": { "range": range } },
            "annotations": ro
        },
        {
            "name": "event_timeseries",
            "title": "Event timeseries",
            "description": "Event counts per hour (24h) or per day (7d/30d/90d), optionally for one channel or event name.",
            "inputSchema": { "type": "object", "properties": {
                "range": range,
                "channel": { "type": "string", "description": "Channel name." },
                "event": { "type": "string", "description": "Exact event name." }
            }},
            "annotations": ro
        },
        {
            "name": "top_breakdown",
            "title": "Top events / channels / users",
            "description": "Most frequent event names, channels or users in a range.",
            "inputSchema": { "type": "object", "properties": {
                "by": { "type": "string", "enum": ["event", "channel", "user"], "description": "Default event." },
                "range": range,
                "limit": { "type": "integer", "minimum": 1, "maximum": 100, "description": "Default 10." }
            }},
            "annotations": ro
        },
        {
            "name": "funnel",
            "title": "Conversion funnel",
            "description": "How many users completed each step in order (events must carry user_id).",
            "inputSchema": { "type": "object", "required": ["steps"], "properties": {
                "steps": { "type": "array", "items": { "type": "string" }, "minItems": 2, "maxItems": 8, "description": "Event names in order." },
                "range": range,
                "window_hours": { "type": "integer", "minimum": 1, "maximum": 2160, "description": "Max time from first to last step. Default 168." }
            }},
            "annotations": ro
        },
        {
            "name": "user_journey",
            "title": "User journey",
            "description": "A user's identified properties and their events, newest first.",
            "inputSchema": { "type": "object", "required": ["user_id"], "properties": {
                "user_id": { "type": "string" },
                "limit": { "type": "integer", "minimum": 1, "maximum": 500, "description": "Default 100." }
            }},
            "annotations": ro
        },
        {
            "name": "get_usage",
            "title": "Plan usage",
            "description": "Current plan, events used this month and limits.",
            "inputSchema": { "type": "object", "properties": {} },
            "annotations": ro
        },
        {
            "name": "get_dashboard",
            "title": "Get dashboard",
            "description": "Get a saved dashboard and its widget definitions (kind, title and config holding the same params as the analytics tools, plus x/y/w/h layout).",
            "inputSchema": { "type": "object", "required": ["dashboard"], "properties": {
                "dashboard": { "type": "string", "description": "Dashboard name or id." }
            }},
            "annotations": ro
        },
        {
            "name": "list_monitors",
            "title": "List monitors",
            "description": "List the project's threshold monitors: condition, filters, state (ok/alerting) and notify targets.",
            "inputSchema": { "type": "object", "properties": {} },
            "annotations": ro
        },
        {
            "name": "create_monitor",
            "title": "Create monitor",
            "description": "Create a threshold monitor checked every minute: alert when matching events go above/below a count in a window, or when none arrive at all ('absent', e.g. a dead cron or heartbeat). Notify by email and/or webhook (Slack and Discord URLs are detected automatically).",
            "inputSchema": { "type": "object", "required": ["name", "condition"], "properties": {
                "name": { "type": "string" },
                "condition": { "type": "string", "enum": ["count_above", "count_below", "absent"], "description": "'absent' alerts when no matching event arrives in the window." },
                "threshold": { "type": "integer", "minimum": 0, "description": "Event count to compare against. Not used by 'absent'." },
                "window_minutes": { "type": "integer", "minimum": 1, "maximum": 10080, "description": "Lookback window checked every minute. Default 60." },
                "cooldown_minutes": { "type": "integer", "minimum": 0, "maximum": 10080, "description": "Min minutes between alerts. Default 60." },
                "channel": { "type": "string", "description": "Only count this channel's events." },
                "event": { "type": "string", "description": "Only count this exact event name." },
                "tag": { "type": "string", "description": "Only count events with this tag, 'key:value'." },
                "notify_emails": { "type": "array", "items": { "type": "string" } },
                "webhook_urls": { "type": "array", "items": { "type": "string" }, "description": "Slack/Discord webhook URLs post in their format; other URLs get a generic JSON POST." },
                "enabled": { "type": "boolean", "description": "Default true." }
            }},
            "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": false, "openWorldHint": false }
        }
    ]);
    match all {
        Value::Array(tools) => Value::Array(
            tools
                .into_iter()
                .filter(|t| scope_allows_tool(t["name"].as_str().unwrap_or(""), scope))
                .collect(),
        ),
        _ => all,
    }
}

fn range_start(args: &Value) -> chrono::DateTime<Utc> {
    Utc::now()
        - match args["range"].as_str() {
            Some("24h") => Duration::hours(24),
            Some("30d") => Duration::days(30),
            Some("90d") => Duration::days(90),
            _ => Duration::days(7),
        }
}

fn str_arg<'a>(args: &'a Value, k: &str) -> Option<&'a str> {
    args[k].as_str().map(str::trim).filter(|s| !s.is_empty())
}

fn req_str<'a>(args: &'a Value, k: &str) -> Result<&'a str, String> {
    str_arg(args, k).ok_or_else(|| format!("`{k}` is required"))
}

async fn channel_id_by_name(state: &web::Data<AppState>, company_id: &str, name: Option<&str>) -> Result<Option<String>, String> {
    let Some(name) = name else { return Ok(None) };
    match pg::channel_by_name(&state.client, company_id, name).await {
        Ok(Some(c)) => Ok(Some(c.id)),
        Ok(None) => Err(format!("no channel named '{name}' (use list_channels)")),
        Err(e) => Err(e.to_string()),
    }
}

async fn call_tool(state: &web::Data<AppState>, company_id: &str, scope: pg::TokenScope, name: &str, args: &Value) -> Result<Value, String> {
    if let Some(e) = scope_error(name, scope) {
        return Err(e);
    }
    match name {
        "log_event" => {
            let channel = resolve_channel(state, company_id, req_str(args, "channel")?, str_arg(args, "icon")).await?;
            let ev = ingest_event(
                state,
                company_id,
                &channel,
                NewEvent {
                    event: req_str(args, "event")?.to_string(),
                    description: str_arg(args, "description").unwrap_or("").to_string(),
                    icon: str_arg(args, "icon").map(str::to_string),
                    tags: value_to_tags(args.get("tags")),
                    user_id: str_arg(args, "user_id").unwrap_or("").to_string(),
                    notify: args["notify"].as_bool().unwrap_or(false),
                    at: None,
                },
            )
            .await
            .map_err(|(_, msg)| msg)?;
            Ok(json!({ "logged": ev }))
        }
        "identify_user" => {
            let props = args.get("properties").filter(|p| p.is_object()).cloned().ok_or("`properties` must be an object")?;
            let u = pg::upsert_identified_user(&state.client, &generate_id(15), company_id, req_str(args, "user_id")?, props)
                .await
                .map_err(|e| e.to_string())?;
            Ok(json!({ "user": u }))
        }
        "set_insight" => {
            let value = match &args["value"] {
                Value::String(s) => s.clone(),
                Value::Null => return Err("`value` is required".into()),
                v => v.to_string(),
            };
            let i = pg::upsert_insight(&state.client, &generate_id(15), company_id, req_str(args, "title")?, &value, str_arg(args, "icon"))
                .await
                .map_err(|e| e.to_string())?;
            Ok(json!({ "insight": i }))
        }
        "increment_insight" => {
            let by = args["by"].as_f64().unwrap_or(1.0);
            let i = pg::mutate_insight(&state.client, company_id, req_str(args, "title")?, by, str_arg(args, "icon"), &generate_id(15))
                .await
                .map_err(|e| e.to_string())?;
            Ok(json!({ "insight": i }))
        }
        "list_channels" => {
            let c = pg::channels_for_company(&state.client, company_id).await.map_err(|e| e.to_string())?;
            Ok(json!({ "channels": c.into_iter().map(|c| json!({ "name": c.name, "icon": c.icon, "id": c.id })).collect::<Vec<_>>() }))
        }
        "list_insights" => {
            let i = pg::insights_for_company(&state.client, company_id).await.map_err(|e| e.to_string())?;
            Ok(json!({ "insights": i }))
        }
        "search_events" => {
            let f = EventFilter {
                channel_id: channel_id_by_name(state, company_id, str_arg(args, "channel")).await?,
                event: str_arg(args, "event").map(str::to_string),
                user_id: str_arg(args, "user_id").map(str::to_string),
                tag: str_arg(args, "tag").and_then(|t| t.split_once(':')).map(|(k, v)| (k.trim().to_string(), v.trim().to_string())),
                q: str_arg(args, "query").map(str::to_string),
                limit: args["limit"].as_u64().unwrap_or(25).clamp(1, 200) as u32,
                since: Some(retention_since(state, company_id).await),
                ..Default::default()
            };
            let rows = state.ch.list(company_id, &f).await?;
            Ok(json!({ "events": rows.into_iter().map(PublicEvent::from).collect::<Vec<_>>() }))
        }
        "event_stats" => state.ch.summary(company_id, range_start(args).max(retention_cutoff(state, company_id).await)).await,
        "event_timeseries" => {
            let channel = channel_id_by_name(state, company_id, str_arg(args, "channel")).await?;
            let hourly = args["range"].as_str() == Some("24h");
            let from = range_start(args).max(retention_cutoff(state, company_id).await);
            let pts = state
                .ch
                .timeseries(company_id, from, hourly, channel.as_deref(), str_arg(args, "event"))
                .await?;
            Ok(json!({ "interval": if hourly { "hour" } else { "day" }, "points": pts }))
        }
        "top_breakdown" => {
            let by = str_arg(args, "by").unwrap_or("event");
            let rows = state
                .ch
                .breakdown(
                    company_id,
                    range_start(args).max(retention_cutoff(state, company_id).await),
                    by,
                    None,
                    args["limit"].as_u64().unwrap_or(10).clamp(1, 100) as u32,
                )
                .await?;
            Ok(json!({ "by": by, "rows": rows }))
        }
        "funnel" => {
            let steps: Vec<String> = args["steps"]
                .as_array()
                .ok_or("`steps` must be an array of event names")?
                .iter()
                .filter_map(|s| s.as_str().map(|s| s.trim().to_string()))
                .filter(|s| !s.is_empty())
                .collect();
            if steps.len() < 2 || steps.len() > 8 {
                return Err("a funnel needs 2 to 8 steps".into());
            }
            let window = args["window_hours"].as_u64().unwrap_or(168).clamp(1, 2160) * 3600;
            let counts = state
                .ch
                .funnel(company_id, range_start(args).max(retention_cutoff(state, company_id).await), &steps, window)
                .await?;
            let first = counts.first().copied().unwrap_or(0).max(1) as f64;
            Ok(json!({ "steps": steps.iter().zip(&counts).map(|(s, c)| json!({
                "event": s, "users": c, "conversion_from_first": (*c as f64 / first * 1000.0).round() / 10.0
            })).collect::<Vec<_>>() }))
        }
        "user_journey" => {
            let user_id = req_str(args, "user_id")?;
            let user = pg::identified_user(&state.client, company_id, user_id).await.map_err(|e| e.to_string())?;
            let f = EventFilter {
                user_id: Some(user_id.to_string()),
                limit: args["limit"].as_u64().unwrap_or(100).clamp(1, 500) as u32,
                since: Some(retention_since(state, company_id).await),
                ..Default::default()
            };
            let rows = state.ch.list(company_id, &f).await?;
            Ok(json!({ "user": user, "events": rows.into_iter().map(PublicEvent::from).collect::<Vec<_>>() }))
        }
        "get_usage" => {
            let plan = match pg::company_billing(&state.client, company_id).await.map_err(|e| e.to_string())? {
                Some(b) => billing::plan(&b.plan),
                None => return Err("project not found".into()),
            };
            let (start, end) = billing::current_period();
            let used = state.ch.count_since(company_id, start).await?;
            Ok(json!({
                "plan": plan.id, "events_used": used, "events_limit": plan.events_limit,
                "period_start": start.to_rfc3339(), "period_end": end.to_rfc3339(), "retention_days": plan.retention_days
            }))
        }
        "get_dashboard" => {
            let want = req_str(args, "dashboard")?;
            let dashboard = match pg::dashboard_by_id(&state.client, company_id, want)
                .await
                .map_err(|e| e.to_string())?
            {
                Some(d) => Some(d),
                None => pg::dashboard_by_name(&state.client, company_id, want)
                    .await
                    .map_err(|e| e.to_string())?,
            };
            let Some(dashboard) = dashboard else {
                let names = pg::dashboards_for_company(&state.client, company_id)
                    .await
                    .map(|list| list.into_iter().map(|d| d.name).collect::<Vec<_>>())
                    .unwrap_or_default();
                return Err(if names.is_empty() {
                    format!("no dashboard '{want}' (this project has no dashboards)")
                } else {
                    format!("no dashboard '{want}'. Available: {}", names.join(", "))
                });
            };
            let widgets = pg::widgets_for_dashboard(&state.client, &dashboard.id)
                .await
                .map_err(|e| e.to_string())?;
            Ok(json!({ "dashboard": dashboard, "widgets": widgets }))
        }
        "list_monitors" => {
            let m = pg::monitors_for_company(&state.client, company_id).await.map_err(|e| e.to_string())?;
            Ok(json!({ "monitors": m }))
        }
        "create_monitor" => {
            let spec = monitor::spec_from_input(
                monitor::MonitorInput {
                    name: str_arg(args, "name").map(str::to_string),
                    enabled: args.get("enabled").and_then(Value::as_bool),
                    channel: str_arg(args, "channel").map(str::to_string),
                    event: str_arg(args, "event").map(str::to_string),
                    tag: str_arg(args, "tag").map(str::to_string),
                    condition: str_arg(args, "condition").map(str::to_string),
                    threshold: args["threshold"].as_i64(),
                    window_minutes: args["window_minutes"].as_i64().map(|v| v as i32),
                    cooldown_minutes: args["cooldown_minutes"].as_i64().map(|v| v as i32),
                    notify_emails: args["notify_emails"].as_array().map(|a| {
                        a.iter().filter_map(|v| v.as_str().map(str::to_string)).collect()
                    }),
                    webhook_urls: args["webhook_urls"].as_array().map(|a| {
                        a.iter().filter_map(|v| v.as_str().map(str::to_string)).collect()
                    }),
                    notify_resolved: None,
                },
                None,
            )?;
            let m = pg::create_monitor(
                &state.client,
                &generate_id(15),
                company_id,
                &spec.name,
                spec.enabled,
                spec.channel.as_deref(),
                spec.event.as_deref(),
                spec.tag.as_deref(),
                &spec.condition,
                spec.threshold,
                spec.window_minutes,
                spec.cooldown_minutes,
                &spec.notify_emails,
                &spec.webhook_urls,
                spec.notify_resolved,
            )
            .await
            .map_err(|e| e.to_string())?;
            Ok(json!({ "monitor": m }))
        }
        other => Err(format!("unknown tool: {other}")),
    }
}

fn rpc_result(id: &Value, result: Value) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "result": result })
}

fn rpc_error(id: &Value, code: i64, message: &str) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } })
}

/// Handle one JSON-RPC message. `None` for notifications (no response).
async fn handle(state: &web::Data<AppState>, company: &pg::Company, scope: pg::TokenScope, msg: &Value) -> Option<Value> {
    let id = msg.get("id")?.clone(); // notifications have no id
    let method = msg["method"].as_str().unwrap_or("");
    let params = &msg["params"];
    Some(match method {
        "initialize" => {
            let requested = params["protocolVersion"].as_str().unwrap_or(LATEST_VERSION);
            let version = if SUPPORTED_VERSIONS.contains(&requested) { requested } else { LATEST_VERSION };
            rpc_result(
                &id,
                json!({
                    "protocolVersion": version,
                    "capabilities": { "tools": { "listChanged": false } },
                    "serverInfo": { "name": "raterlog", "title": "Raterlog", "version": env!("CARGO_PKG_VERSION") },
                    "instructions": format!("{INSTRUCTIONS} Connected project: \"{}\".", company.name),
                }),
            )
        }
        "ping" => rpc_result(&id, json!({})),
        "tools/list" => rpc_result(&id, json!({ "tools": tools(scope) })),
        "tools/call" => {
            let name = params["name"].as_str().unwrap_or("");
            let args = params.get("arguments").cloned().unwrap_or_else(|| json!({}));
            match call_tool(state, &company.id, scope, name, &args).await {
                Ok(v) => rpc_result(
                    &id,
                    json!({
                        "content": [{ "type": "text", "text": serde_json::to_string_pretty(&v).unwrap_or_default() }],
                        "structuredContent": v,
                        "isError": false
                    }),
                ),
                // Tool failures are results the model can read and recover from.
                Err(e) => rpc_result(&id, json!({ "content": [{ "type": "text", "text": e }], "isError": true })),
            }
        }
        "resources/list" => rpc_result(&id, json!({ "resources": [] })),
        "prompts/list" => rpc_result(&id, json!({ "prompts": [] })),
        _ => rpc_error(&id, -32601, &format!("method not found: {method}")),
    })
}

fn unauthorized(msg: &str) -> HttpResponse {
    HttpResponse::Unauthorized()
        .insert_header((header::WWW_AUTHENTICATE, r#"Bearer realm="raterlog", error="invalid_token""#))
        .json(json!({ "jsonrpc": "2.0", "id": null, "error": { "code": -32001, "message": msg } }))
}

pub async fn post(req: HttpRequest, body: web::Bytes, state: web::Data<AppState>) -> HttpResponse {
    let Some(token) = api_token_from_request(&req) else {
        return unauthorized("Authorization: Bearer <Raterlog API token> is required. Create one in Settings → API tokens.");
    };
    let (company, scope) = match pg::token_company(&state.client, &token).await {
        Ok(Some((cid, scope))) => match pg::company_by_id(&state.client, &cid).await {
            Ok(Some(c)) => (c, scope),
            _ => return unauthorized("invalid API token"),
        },
        Ok(None) => return unauthorized("invalid API token"),
        Err(e) => return HttpResponse::InternalServerError().json(json!({ "error": e.to_string() })),
    };
    let Ok(msg) = serde_json::from_slice::<Value>(&body) else {
        return HttpResponse::BadRequest().json(rpc_error(&Value::Null, -32700, "parse error"));
    };

    let out = if let Some(batch) = msg.as_array() {
        let mut responses = vec![];
        for m in batch {
            if let Some(r) = handle(&state, &company, scope, m).await {
                responses.push(r);
            }
        }
        if responses.is_empty() { None } else { Some(Value::Array(responses)) }
    } else {
        handle(&state, &company, scope, &msg).await
    };

    match out {
        Some(v) => HttpResponse::Ok().content_type("application/json").json(v),
        None => HttpResponse::Accepted().finish(),
    }
}

/// No server-initiated stream: this server is stateless.
pub async fn get() -> HttpResponse {
    HttpResponse::MethodNotAllowed()
        .insert_header((header::ALLOW, "POST"))
        .finish()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Every advertised tool must be classified as read or write, otherwise
    /// the scope filter silently hides it from every token.
    #[test]
    fn every_tool_has_a_scope() {
        let names: Vec<String> = tools(pg::TokenScope::Full)
            .as_array()
            .unwrap()
            .iter()
            .map(|t| t["name"].as_str().unwrap().to_string())
            .collect();
        let classified: Vec<&str> = WRITE_TOOLS.iter().chain(READ_TOOLS).chain(FULL_TOOLS).copied().collect();
        for name in &classified {
            assert!(names.iter().any(|n| n == name), "{name} is classified but not defined");
        }
        let defined = names.len();
        assert_eq!(defined, classified.len(), "tools: {names:?}");
    }
}
