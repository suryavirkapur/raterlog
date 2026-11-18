//! Inbound webhook integrations: turn third-party webhooks into Raterlog
//! events. Signature verification is optional per project — a secret is
//! stored per (company, source) in Postgres and, when set, the matching
//! signature scheme is enforced:
//!
//!   stripe   Stripe-Signature: t=…,v1=… — HMAC-SHA256 over "{t}.{body}"
//!   github   X-Hub-Signature-256: sha256=… — HMAC-SHA256 over the raw body
//!   vercel   x-vercel-signature: … — HMAC-SHA1 over the raw body
//!   dodo     Standard Webhooks (webhook-id/-timestamp/-signature)
//!   generic  X-Hub-Signature-256 (same convention as GitHub)
//!
//! HTTP handlers live in routes/webhooks.rs.

use crate::billing::{constant_time_eq, verify_signature as standard_webhooks};
use crate::routes::log::value_to_tags;
use chrono::Utc;
use hmac::{Hmac, Mac};
use serde_json::Value;
use sha1::Sha1;
use sha2::Sha256;
use std::collections::BTreeMap;

pub const SOURCES: &[&str] = &["dodo", "stripe", "github", "vercel", "generic"];

pub fn valid_source(s: &str) -> bool {
    SOURCES.contains(&s)
}

/// One webhook delivery turned into a Raterlog event.
pub struct Mapped {
    pub channel: String,
    pub event: String,
    pub description: String,
    pub icon: Option<String>,
    pub notify: bool,
    pub tags: BTreeMap<String, String>,
    pub user_id: String,
}

fn mapped(
    channel: &str,
    event: impl Into<String>,
    description: impl Into<String>,
    icon: &str,
    notify: bool,
    tags: BTreeMap<String, String>,
    user_id: String,
) -> Mapped {
    Mapped {
        channel: channel.to_string(),
        event: event.into(),
        description: description.into(),
        icon: Some(icon.to_string()),
        notify,
        tags,
        user_id,
    }
}

/// Map a delivery to a Raterlog event. `event_type` is the provider's own
/// event name (Stripe/Dodo/Vercel `type`, GitHub's X-GitHub-Event header).
/// Unknown event types are logged generically, never rejected.
pub fn map_event(source: &str, event_type: &str, body: &Value) -> Mapped {
    match source {
        "stripe" => map_stripe(event_type, body),
        "github" => map_github(event_type, body),
        "vercel" => map_vercel(event_type, body),
        "dodo" => map_dodo(event_type, body),
        _ => map_generic(event_type, body),
    }
}

// ───────────────────────── helpers ─────────────────────────

fn at<'a>(v: &'a Value, path: &[&str]) -> Option<&'a str> {
    let mut cur = v;
    for k in path {
        cur = cur.get(*k)?;
    }
    cur.as_str()
}

fn pick<'a>(v: &'a Value, paths: &[&[&str]]) -> Option<&'a str> {
    paths.iter().find_map(|p| at(v, p))
}

fn tag(tags: &mut BTreeMap<String, String>, k: &str, v: Option<&str>) {
    if let Some(v) = v.filter(|s| !s.is_empty()) {
        tags.insert(k.to_string(), v.chars().take(512).collect());
    }
}

/// Stripe/Dodo amounts are minor units (cents); render as "12.00".
fn minor_units(v: Option<i64>) -> Option<String> {
    v.map(|c| format!("{:.2}", c as f64 / 100.0))
}

fn title_case(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for (i, part) in s.split(['.', '_', '-']).enumerate() {
        if i > 0 {
            out.push(' ');
        }
        let mut ch = part.chars();
        if let Some(c) = ch.next() {
            out.extend(c.to_uppercase());
            out.push_str(ch.as_str());
        }
    }
    out
}

// ───────────────────────── stripe ─────────────────────────

fn stripe_amount(obj: &Value) -> Option<String> {
    let cents = ["amount_total", "amount_paid", "amount", "amount_refunded", "total"]
        .iter()
        .find_map(|k| obj.get(k).and_then(Value::as_i64))
        .or_else(|| obj.pointer("/plan/amount").and_then(Value::as_i64))
        .or_else(|| obj.pointer("/items/data/0/price/unit_amount").and_then(Value::as_i64));
    minor_units(cents)
}

fn map_stripe(event_type: &str, body: &Value) -> Mapped {
    let obj = body.pointer("/data/object").cloned().unwrap_or(Value::Null);
    let email = pick(
        &obj,
        &[
            &["customer_details", "email"],
            &["customer_email"],
            &["receipt_email"],
            &["customer", "email"],
        ],
    );
    let customer = at(&obj, &["customer"]);
    let user_id = email.or(customer).unwrap_or_default().to_string();
    let currency = at(&obj, &["currency"])
        .or_else(|| at(&obj, &["plan", "currency"]))
        .or_else(|| at(&obj, &["items", "data", "0", "price", "currency"]))
        .unwrap_or_default()
        .to_uppercase();
    let amount = stripe_amount(&obj);
    let customer_label = email.or(customer).unwrap_or_default();

    let mut tags = BTreeMap::new();
    tag(&mut tags, "amount", amount.as_deref());
    tag(&mut tags, "currency", Some(currency.as_str()).filter(|c| !c.is_empty()));
    tag(&mut tags, "customer", Some(customer_label).filter(|c| !c.is_empty()));

    let (event, icon, notify) = match event_type {
        "checkout.session.completed" => ("Checkout Completed", "💰", true),
        "customer.subscription.created" => ("New Subscription", "💰", true),
        "customer.subscription.updated" => ("Subscription Updated", "🔄", false),
        "customer.subscription.deleted" => ("Subscription Cancelled", "⚠️", true),
        "invoice.paid" => ("Invoice Paid", "💰", true),
        "invoice.payment_failed" => ("Payment Failed", "⚠️", true),
        "charge.refunded" => ("Charge Refunded", "↩️", true),
        other => (other, "💳", false),
    };

    let mut parts: Vec<String> = Vec::new();
    if !customer_label.is_empty() {
        parts.push(customer_label.to_string());
    }
    if let Some(a) = &amount {
        parts.push(format!("{a} {currency}").trim().to_string());
    }
    mapped(
        "payments",
        event,
        parts.join(" · "),
        icon,
        notify,
        tags,
        user_id,
    )
}

// ───────────────────────── github ─────────────────────────

fn map_github(event_type: &str, body: &Value) -> Mapped {
    let repo = at(body, &["repository", "full_name"]).unwrap_or_default();
    let sender = at(body, &["sender", "login"]).unwrap_or_default().to_string();

    let mut tags = BTreeMap::new();
    tag(&mut tags, "repo", Some(repo).filter(|r| !r.is_empty()));

    let (event, icon, description) = match event_type {
        "push" => {
            let branch = at(body, &["ref"])
                .map(|r| r.strip_prefix("refs/heads/").unwrap_or(r))
                .unwrap_or_default();
            let commits = body
                .get("commits")
                .and_then(Value::as_array)
                .map(Vec::len)
                .unwrap_or(0);
            tag(&mut tags, "branch", Some(branch).filter(|b| !b.is_empty()));
            tags.insert("commits".into(), commits.to_string());
            let event = if branch.is_empty() {
                "Push".to_string()
            } else {
                format!("Push to {branch}")
            };
            (
                event,
                "📦",
                format!("{commits} commit{} on {repo}", if commits == 1 { "" } else { "s" }),
            )
        }
        "pull_request" => {
            let action = at(body, &["action"]).unwrap_or_default();
            let number = body.get("number").and_then(Value::as_i64).unwrap_or(0);
            let title = at(body, &["pull_request", "title"]).unwrap_or_default();
            let merged = body
                .pointer("/pull_request/merged")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            tags.insert("number".into(), number.to_string());
            tag(&mut tags, "action", Some(action).filter(|a| !a.is_empty()));
            let (event, icon) = match action {
                "opened" => ("Pull Request Opened".to_string(), "🔀"),
                "closed" if merged => ("Pull Request Merged".to_string(), "✅"),
                "closed" => ("Pull Request Closed".to_string(), "❌"),
                other if !other.is_empty() => (format!("Pull Request {}", title_case(other)), "🔀"),
                _ => ("Pull Request".to_string(), "🔀"),
            };
            (
                event,
                icon,
                format!("#{number} {title} in {repo}").trim().to_string(),
            )
        }
        "release" => {
            let action = at(body, &["action"]).unwrap_or_default();
            let release_tag = at(body, &["release", "tag_name"]).unwrap_or_default();
            tag(&mut tags, "tag", Some(release_tag).filter(|t| !t.is_empty()));
            (
                format!("Release {}", title_case(action)),
                "🚀",
                format!("{release_tag} in {repo}").trim().to_string(),
            )
        }
        "issues" => {
            let action = at(body, &["action"]).unwrap_or_default();
            let number = body.get("issue").and_then(|i| i.get("number")).and_then(Value::as_i64).unwrap_or(0);
            let title = at(body, &["issue", "title"]).unwrap_or_default();
            tags.insert("number".into(), number.to_string());
            (
                format!("Issue {}", title_case(action)),
                "🐛",
                format!("#{number} {title} in {repo}").trim().to_string(),
            )
        }
        "star" => {
            let action = at(body, &["action"]).unwrap_or("created");
            if action == "deleted" {
                ("Star Removed".to_string(), "☆", format!("{repo} by {sender}"))
            } else {
                ("New Star".to_string(), "⭐", format!("{repo} by {sender}"))
            }
        }
        other => (
            other.to_string(),
            "🐙",
            format!("{repo} by {sender}").trim().to_string(),
        ),
    };

    mapped("github", event, description, icon, false, tags, sender)
}

// ───────────────────────── vercel ─────────────────────────

fn map_vercel(event_type: &str, body: &Value) -> Mapped {
    let payload = body.get("payload").unwrap_or(&Value::Null);
    let dep = payload.get("deployment").unwrap_or(payload);
    let project = at(payload, &["project", "name"])
        .or_else(|| at(dep, &["name"]))
        .unwrap_or_default();
    let url = at(dep, &["url"]).unwrap_or_default();
    let user = pick(payload, &[&["user", "username"], &["user", "id"]])
        .unwrap_or_default()
        .to_string();

    let mut tags = BTreeMap::new();
    tag(&mut tags, "project", Some(project).filter(|p| !p.is_empty()));
    tag(&mut tags, "url", Some(url).filter(|u| !u.is_empty()));

    let (event, icon, notify) = match event_type {
        "deployment.created" => ("Deployment Started", "🚧", false),
        "deployment.succeeded" | "deployment.ready" => ("Deployment Succeeded", "✅", false),
        "deployment.error" | "deployment.canceled" => ("Deployment Failed", "⚠️", true),
        other => (other, "▲", false),
    };
    let description = match (project.is_empty(), url.is_empty()) {
        (false, false) => format!("{project} → {url}"),
        (false, true) => project.to_string(),
        (true, false) => url.to_string(),
        _ => String::new(),
    };
    mapped("deploys", event, description, icon, notify, tags, user)
}

// ───────────────────────── dodo ─────────────────────────

/// Dodo amounts are minor units; most are integers, but dispute `amount` is a string.
fn dodo_amount(data: &Value) -> Option<String> {
    ["total_amount", "recurring_pre_tax_amount", "amount", "settlement_amount"]
        .iter()
        .find_map(|k| match data.get(*k) {
            Some(Value::Number(n)) => n.as_i64(),
            Some(Value::String(s)) => s.trim().parse::<i64>().ok(),
            _ => None,
        })
        .map(|c| format!("{:.2}", c as f64 / 100.0))
}

/// Friendly name, icon and whether to notify for each Dodo event type.
/// Covers payments, refunds, disputes, subscriptions, invoices, recovery,
/// dunning, license keys and payouts; anything else is title-cased.
fn dodo_event(event_type: &str) -> (String, &'static str, bool) {
    let (name, icon, notify) = match event_type {
        "payment.succeeded" => ("Payment Succeeded", "💰", true),
        "payment.failed" => ("Payment Failed", "⚠️", true),
        "payment.processing" => ("Payment Processing", "⏳", false),
        "payment.cancelled" => ("Payment Cancelled", "🚫", false),
        "refund.succeeded" => ("Refund Issued", "↩️", true),
        "refund.failed" => ("Refund Failed", "⚠️", true),
        "dispute.opened" => ("Dispute Opened", "🚨", true),
        "dispute.challenged" => ("Dispute Challenged", "⚖️", false),
        "dispute.accepted" => ("Dispute Accepted", "⚖️", true),
        "dispute.cancelled" => ("Dispute Cancelled", "⚖️", false),
        "dispute.expired" => ("Dispute Expired", "⚖️", false),
        "dispute.won" => ("Dispute Won", "🏆", true),
        "dispute.lost" => ("Dispute Lost", "🚨", true),
        "subscription.active" => ("New Subscription", "🎉", true),
        "subscription.renewed" => ("Subscription Renewed", "🔁", false),
        "subscription.plan_changed" => ("Plan Changed", "🔀", true),
        "subscription.updated" => ("Subscription Updated", "📝", false),
        "subscription.past_due" => ("Subscription Past Due", "⚠️", true),
        "subscription.on_hold" => ("Subscription On Hold", "⏸️", true),
        "subscription.paused" => ("Subscription Paused", "⏸️", false),
        "subscription.unpaused" => ("Subscription Resumed", "▶️", false),
        "subscription.update_payment_method" => ("Payment Method Updated", "💳", false),
        "subscription.cancelled" => ("Subscription Cancelled", "😢", true),
        "subscription.failed" => ("Subscription Failed", "⚠️", true),
        "subscription.expired" => ("Subscription Expired", "⌛", false),
        "invoice.paid" => ("Invoice Paid", "🧾", false),
        "invoice.payment_failed" => ("Invoice Payment Failed", "⚠️", true),
        "invoice.past_due" => ("Invoice Past Due", "⚠️", false),
        "abandoned_checkout.detected" => ("Checkout Abandoned", "🛒", false),
        "abandoned_checkout.recovered" => ("Checkout Recovered", "🛒", true),
        "dunning.started" => ("Dunning Started", "📨", false),
        "dunning.recovered" => ("Payment Recovered", "💪", true),
        "license_key.created" => ("License Key Created", "🔑", false),
        "payout.success" => ("Payout Sent", "🏦", true),
        "payout.failed" => ("Payout Failed", "⚠️", true),
        other => return (title_case(other), "💳", false),
    };
    (name.to_string(), icon, notify)
}

fn map_dodo(event_type: &str, body: &Value) -> Mapped {
    let event_type = if event_type.is_empty() { at(body, &["type"]).unwrap_or("") } else { event_type };
    let data = body.get("data").unwrap_or(&Value::Null);
    let email = at(data, &["customer", "email"]);
    let customer_id = at(data, &["customer", "customer_id"]).or_else(|| at(data, &["customer_id"]));
    let user_id = email.or(customer_id).unwrap_or_default().to_string();
    let amount = dodo_amount(data);
    let currency = at(data, &["currency"]).unwrap_or_default().to_uppercase();

    let mut tags = BTreeMap::new();
    tag(&mut tags, "amount", amount.as_deref());
    tag(&mut tags, "currency", Some(currency.as_str()).filter(|c| !c.is_empty()));
    tag(&mut tags, "customer", email.or(customer_id));
    tag(&mut tags, "product", at(data, &["product_id"]));
    tag(&mut tags, "subscription", at(data, &["subscription_id"]));
    tag(&mut tags, "payment", at(data, &["payment_id"]));
    tag(&mut tags, "status", at(data, &["status"]));
    tag(&mut tags, "dodo_event", Some(event_type));

    let (event, icon, notify) = dodo_event(event_type);
    let channel = if event_type.starts_with("payout.") { "payouts" } else { "payments" };

    let mut parts: Vec<String> = Vec::new();
    if let Some(e) = at(data, &["customer", "name"]).or(email).or(customer_id) {
        parts.push(e.to_string());
    }
    if let Some(a) = &amount {
        parts.push(format!("{a} {currency}").trim().to_string());
    }
    if let Some(r) = at(data, &["reason"]).or_else(|| at(data, &["error_message"])) {
        parts.push(r.to_string());
    }
    mapped(channel, &event, parts.join(" · "), icon, notify, tags, user_id)
}

// ───────────────────────── generic ─────────────────────────

fn map_generic(event_type: &str, body: &Value) -> Mapped {
    let event = at(body, &["event"])
        .or_else(|| at(body, &["type"]))
        .or(if event_type.is_empty() { None } else { Some(event_type) })
        .unwrap_or("Webhook");
    mapped(
        at(body, &["channel"]).unwrap_or("webhooks"),
        event,
        at(body, &["description"]).unwrap_or_default(),
        at(body, &["icon"]).unwrap_or("🪝"),
        body.get("notify").and_then(Value::as_bool).unwrap_or(false),
        value_to_tags(body.get("tags")),
        at(body, &["user_id"]).unwrap_or_default().to_string(),
    )
}

// ─────────────────────── signatures ───────────────────────

fn hmac_sha256(key: &[u8], msg: &[u8]) -> Vec<u8> {
    let mut mac = Hmac::<Sha256>::new_from_slice(key).expect("hmac accepts any key length");
    mac.update(msg);
    mac.finalize().into_bytes().to_vec()
}

fn hmac_sha1(key: &[u8], msg: &[u8]) -> Vec<u8> {
    let mut mac = Hmac::<Sha1>::new_from_slice(key).expect("hmac accepts any key length");
    mac.update(msg);
    mac.finalize().into_bytes().to_vec()
}

fn hex_decode(s: &str) -> Option<Vec<u8>> {
    let s = s.trim();
    if !s.len().is_multiple_of(2) || !s.bytes().all(|b| b.is_ascii_hexdigit()) {
        return None;
    }
    Some(
        (0..s.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap())
            .collect(),
    )
}

fn hex_match(expected: &[u8], hex_sig: &str) -> bool {
    hex_decode(hex_sig)
        .map(|got| constant_time_eq(&got, expected))
        .unwrap_or(false)
}

/// Stripe-Signature: "t=…,v1=…[,v1=…]" — HMAC-SHA256 over "{t}.{body}",
/// timestamp within 5 minutes.
pub fn verify_stripe(secret: &str, header: &str, body: &[u8]) -> bool {
    let mut ts = None;
    let mut sigs = Vec::new();
    for part in header.split(',') {
        if let Some((k, v)) = part.split_once('=') {
            match k.trim() {
                "t" => ts = Some(v.trim().to_string()),
                "v1" => sigs.push(v.trim().to_string()),
                _ => {}
            }
        }
    }
    let Some(ts) = ts else { return false };
    let Ok(ts_num) = ts.parse::<i64>() else { return false };
    if (Utc::now().timestamp() - ts_num).abs() > 300 {
        return false;
    }
    let mut msg = Vec::with_capacity(ts.len() + 1 + body.len());
    msg.extend_from_slice(ts.as_bytes());
    msg.push(b'.');
    msg.extend_from_slice(body);
    let expected = hmac_sha256(secret.as_bytes(), &msg);
    sigs.iter().any(|s| hex_match(&expected, s))
}

/// X-Hub-Signature-256: "sha256=<hex>" — HMAC-SHA256 over the raw body.
/// Also used for `generic` sources.
pub fn verify_github(secret: &str, header: &str, body: &[u8]) -> bool {
    let Some(sig) = header.trim().strip_prefix("sha256=") else {
        return false;
    };
    let expected = hmac_sha256(secret.as_bytes(), body);
    hex_match(&expected, sig.trim())
}

/// x-vercel-signature: "<hex>" — HMAC-SHA1 over the raw body.
pub fn verify_vercel(secret: &str, header: &str, body: &[u8]) -> bool {
    let expected = hmac_sha1(secret.as_bytes(), body);
    hex_match(&expected, header.trim())
}

/// Dodo Payments uses Standard Webhooks: HMAC-SHA256 over "{id}.{ts}.{body}"
/// keyed by the base64 `whsec_…` secret, timestamp within 5 minutes.
pub fn verify_dodo(secret: &str, id: &str, ts: &str, sig_header: &str, body: &[u8]) -> bool {
    let Ok(ts_num) = ts.parse::<i64>() else { return false };
    if (Utc::now().timestamp() - ts_num).abs() > 300 {
        return false;
    }
    standard_webhooks(secret, id, ts, sig_header, body)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const BODY: &[u8] = br#"{"type":"checkout.session.completed","data":{"object":{}}}"#;

    // ── signature vectors (computed independently with Python's hmac) ──

    #[test]
    fn stripe_signature() {
        let secret = "whsec_testsecret";
        let ts = Utc::now().timestamp().to_string();
        let mut msg = ts.clone().into_bytes();
        msg.push(b'.');
        msg.extend_from_slice(BODY);
        let expected = hmac_sha256(secret.as_bytes(), &msg);
        let good = format!(
            "t={ts},v1={}",
            expected.iter().map(|b| format!("{b:02x}")).collect::<String>()
        );
        assert!(verify_stripe(secret, &good, BODY));
        assert!(!verify_stripe(secret, &format!("t={ts},v1=00"), BODY));
        assert!(!verify_stripe("wrong", &good, BODY));
        // Fixed vector: correct signature but a timestamp from 2023 — replay
        // protection must reject it.
        let stale = "t=1700000000,v1=22c9b472507663d0ea4ff01b1141fa1351916e21088db67e6fb2af98dc186886";
        assert!(!verify_stripe(secret, stale, BODY));
        assert!(!verify_stripe(secret, "v1=abc", BODY));
    }

    #[test]
    fn github_signature() {
        let good = "sha256=41c10aa2d5281ba806706f16032da5f4157625ed57afd138603ad87e2630eec2";
        assert!(verify_github("whsec_testsecret", good, BODY));
        assert!(!verify_github("whsec_testsecret", &good.to_uppercase(), BODY));
        assert!(!verify_github("wrong", good, BODY));
        assert!(!verify_github("whsec_testsecret", "sha1=abc", BODY));
    }

    #[test]
    fn vercel_signature() {
        let good = "5ff275cea1691a86c45874c99b747fafdbb25b6a";
        assert!(verify_vercel("whsec_testsecret", good, BODY));
        assert!(!verify_vercel("wrong", good, BODY));
        assert!(!verify_vercel("whsec_testsecret", "deadbeef", BODY));
    }

    #[test]
    fn dodo_signature() {
        // whsec_bXlzZWNyZXQ= == base64("mysecret"); signature over "msg_1.ts.body".
        // Timestamp must be fresh, so sign at runtime with the same scheme and
        // keep a fixed vector only for the reject path.
        let secret = "whsec_bXlzZWNyZXQ=";
        let ts = Utc::now().timestamp().to_string();
        let mut full = format!("msg_1.{ts}.").into_bytes();
        full.extend_from_slice(BODY);
        let mac = hmac_sha256(b"mysecret", &full);
        let good = format!("v1,{}", base64_encode(&mac));
        assert!(verify_dodo(secret, "msg_1", &ts, &good, BODY));
        assert!(!verify_dodo(secret, "msg_2", &ts, &good, BODY));
        assert!(!verify_dodo(secret, "msg_1", "1700000000", &good, BODY));
        assert!(!verify_dodo("whsec_AAAA", "msg_1", &ts, &good, BODY));
    }

    fn base64_encode(b: &[u8]) -> String {
        use base64ct::{Base64, Encoding};
        Base64::encode_string(b)
    }

    // ── mappers ──

    #[test]
    fn stripe_payment_failed() {
        let body = json!({
            "type": "invoice.payment_failed",
            "data": {"object": {
                "customer_email": "jane@acme.com",
                "customer": "cus_123",
                "amount_due": 0,
                "amount": 4900,
                "currency": "usd"
            }}
        });
        let m = map_event("stripe", "invoice.payment_failed", &body);
        assert_eq!(m.channel, "payments");
        assert_eq!(m.event, "Payment Failed");
        assert_eq!(m.icon.as_deref(), Some("⚠️"));
        assert!(m.notify);
        assert_eq!(m.user_id, "jane@acme.com");
        assert_eq!(m.tags.get("amount").unwrap(), "49.00");
        assert_eq!(m.tags.get("currency").unwrap(), "USD");
        assert_eq!(m.tags.get("customer").unwrap(), "jane@acme.com");
    }

    #[test]
    fn stripe_subscription_created() {
        let body = json!({
            "type": "customer.subscription.created",
            "data": {"object": {
                "customer": "cus_9",
                "items": {"data": [{"price": {"unit_amount": 1200, "currency": "usd"}}]}
            }}
        });
        let m = map_event("stripe", "customer.subscription.created", &body);
        assert_eq!(m.event, "New Subscription");
        assert_eq!(m.user_id, "cus_9");
        assert_eq!(m.tags.get("amount").unwrap(), "12.00");
    }

    #[test]
    fn stripe_unknown_is_generic() {
        let body = json!({"type": "customer.created", "data": {"object": {"id": "cus_1", "email": "a@b.c"}}});
        let m = map_event("stripe", "customer.created", &body);
        assert_eq!(m.channel, "payments");
        assert_eq!(m.event, "customer.created");
        assert!(!m.notify);
    }

    #[test]
    fn github_push_and_pr() {
        let push = json!({
            "ref": "refs/heads/main",
            "commits": [{}, {}, {}],
            "repository": {"full_name": "acme/api"},
            "sender": {"login": "jane"}
        });
        let m = map_event("github", "push", &push);
        assert_eq!(m.channel, "github");
        assert_eq!(m.event, "Push to main");
        assert_eq!(m.description, "3 commits on acme/api");
        assert_eq!(m.user_id, "jane");
        assert_eq!(m.tags.get("repo").unwrap(), "acme/api");

        let pr = json!({
            "action": "closed",
            "number": 42,
            "pull_request": {"title": "Add feature", "merged": true},
            "repository": {"full_name": "acme/api"},
            "sender": {"login": "jane"}
        });
        let m = map_event("github", "pull_request", &pr);
        assert_eq!(m.event, "Pull Request Merged");
        assert_eq!(m.description, "#42 Add feature in acme/api");

        let star = json!({"action": "created", "repository": {"full_name": "acme/api"}, "sender": {"login": "bob"}});
        let m = map_event("github", "star", &star);
        assert_eq!(m.event, "New Star");
    }

    #[test]
    fn vercel_deployment_error() {
        let body = json!({
            "type": "deployment.error",
            "payload": {
                "deployment": {"name": "site", "url": "site-abc.vercel.app"},
                "project": {"name": "site"},
                "user": {"username": "jane"}
            }
        });
        let m = map_event("vercel", "deployment.error", &body);
        assert_eq!(m.channel, "deploys");
        assert_eq!(m.event, "Deployment Failed");
        assert!(m.notify);
        assert_eq!(m.user_id, "jane");
        assert_eq!(m.tags.get("url").unwrap(), "site-abc.vercel.app");
    }

    #[test]
    fn dodo_payment_succeeded() {
        let body = json!({
            "type": "payment.succeeded",
            "data": {"total_amount": 2900, "currency": "usd",
                     "customer": {"email": "j@a.co", "customer_id": "cus_1"}}
        });
        let m = map_event("dodo", "payment.succeeded", &body);
        assert_eq!(m.channel, "payments");
        assert_eq!(m.event, "Payment Succeeded");
        assert!(m.notify);
        assert_eq!(m.user_id, "j@a.co");
        assert_eq!(m.tags.get("amount").unwrap(), "29.00");
    }

    #[test]
    fn dodo_lifecycle_events() {
        let sub = json!({"type": "subscription.active", "data": {"recurring_pre_tax_amount": 1200,
            "currency": "USD", "subscription_id": "sub_1", "product_id": "pdt_1",
            "customer": {"email": "j@a.co", "customer_id": "cus_1", "name": "Jane"}}});
        let m = map_event("dodo", "subscription.active", &sub);
        assert_eq!(m.event, "New Subscription");
        assert!(m.notify);
        assert_eq!(m.tags.get("amount").unwrap(), "12.00");
        assert_eq!(m.tags.get("subscription").unwrap(), "sub_1");

        let dispute = json!({"data": {"amount": "4500", "currency": "usd", "customer": {"email": "j@a.co"}}});
        let m = map_event("dodo", "dispute.opened", &dispute);
        assert_eq!(m.event, "Dispute Opened");
        assert!(m.notify);
        assert_eq!(m.tags.get("amount").unwrap(), "45.00");

        let m = map_event("dodo", "refund.succeeded", &json!({"data": {"amount": 500}}));
        assert_eq!(m.event, "Refund Issued");

        let m = map_event("dodo", "payout.success", &json!({"data": {}}));
        assert_eq!(m.channel, "payouts");

        let m = map_event("dodo", "credit.balance_low", &json!({"data": {}}));
        assert_eq!(m.event, "Credit Balance Low");
        assert!(!m.notify);
    }

    #[test]
    fn generic_fallback() {
        let body = json!({"channel": "ci", "event": "Build finished", "tags": {"status": "ok"}, "user_id": "runner"});
        let m = map_event("generic", "", &body);
        assert_eq!(m.channel, "ci");
        assert_eq!(m.event, "Build finished");
        assert_eq!(m.tags.get("status").unwrap(), "ok");
        assert_eq!(m.user_id, "runner");

        let bare = json!({"hello": "world"});
        let m = map_event("generic", "", &bare);
        assert_eq!(m.channel, "webhooks");
        assert_eq!(m.event, "Webhook");
    }
}
