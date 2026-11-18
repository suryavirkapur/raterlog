//! Dodo Payments: plans, hosted checkout, customer portal, webhooks.

use crate::billing;
use crate::pg;
use crate::selftrack::{self, Track};
use crate::state::AppState;
use crate::util::{error_json, json_ok};
use actix_web::{get, http::StatusCode, post, web, HttpRequest, HttpResponse};
use serde::Deserialize;

use super::require_company_member;

#[get("/api/plans")]
pub async fn plans() -> HttpResponse {
    json_ok(billing::plans())
}

#[derive(Deserialize)]
struct CheckoutInput {
    plan: String,
    interval: Option<String>,
}

fn not_configured() -> HttpResponse {
    error_json(StatusCode::SERVICE_UNAVAILABLE, "billing is not enabled yet")
}

#[post("/api/companies/{company_id}/billing/checkout")]
pub async fn checkout(req: HttpRequest, path: web::Path<String>, body: web::Json<CheckoutInput>, state: web::Data<AppState>) -> HttpResponse {
    let company_id = path.into_inner();
    let user = match require_company_member(&req, &state, &company_id).await {
        Ok(u) => u,
        Err(r) => return r,
    };
    let Some(dodo) = &state.dodo else { return not_configured() };
    let interval = match body.interval.as_deref() {
        Some("month") => "month",
        _ => "year",
    };
    let Some(product) = dodo.product_for(&body.plan, interval) else {
        return error_json(StatusCode::BAD_REQUEST, "unknown plan");
    };
    let customer = match pg::company_billing(&state.client, &company_id).await {
        Ok(Some(b)) if b.customer_id.is_some() => serde_json::json!({ "customer_id": b.customer_id }),
        _ => serde_json::json!({ "email": user.email, "name": user.name }),
    };
    let return_url = format!(
        "{}/app/{}/settings?tab=billing&upgraded=1",
        state.app_url.trim_end_matches('/'),
        company_id
    );
    match dodo.checkout(product, customer, &return_url, &company_id).await {
        Ok(url) => {
            selftrack::track(
                &state,
                Track::new("billing", "🛒", "Checkout started")
                    .desc(format!("{} · {} ({})", user.email, body.plan, interval))
                    .user(&user.id)
                    .tag("plan", body.plan.clone())
                    .tag("interval", interval)
                    .tag("project", company_id.clone()),
            );
            json_ok(serde_json::json!({ "url": url }))
        }
        Err(e) => {
            tracing::error!("checkout failed: {e}");
            error_json(StatusCode::BAD_GATEWAY, "could not start checkout, please try again")
        }
    }
}

#[post("/api/companies/{company_id}/billing/portal")]
pub async fn portal(req: HttpRequest, path: web::Path<String>, state: web::Data<AppState>) -> HttpResponse {
    let company_id = path.into_inner();
    if let Err(r) = require_company_member(&req, &state, &company_id).await {
        return r;
    }
    let Some(dodo) = &state.dodo else { return not_configured() };
    let customer_id = match pg::company_billing(&state.client, &company_id).await {
        Ok(Some(b)) => b.customer_id,
        _ => None,
    };
    let Some(customer_id) = customer_id else {
        return error_json(StatusCode::BAD_REQUEST, "no subscription yet");
    };
    match dodo.portal(&customer_id).await {
        Ok(url) => json_ok(serde_json::json!({ "url": url })),
        Err(e) => {
            tracing::error!("portal failed: {e}");
            error_json(StatusCode::BAD_GATEWAY, "could not open the billing portal")
        }
    }
}

/// Dodo → us. Keeps `Company.plan` in sync with the subscription state.
#[post("/api/billing/webhook")]
pub async fn webhook(req: HttpRequest, body: web::Bytes, state: web::Data<AppState>) -> HttpResponse {
    let Some(dodo) = &state.dodo else { return not_configured() };
    let h = |k: &str| req.headers().get(k).and_then(|v| v.to_str().ok()).unwrap_or("");
    if !dodo.verify_webhook(h("webhook-id"), h("webhook-timestamp"), h("webhook-signature"), &body) {
        return error_json(StatusCode::UNAUTHORIZED, "bad signature");
    }
    let Ok(ev) = serde_json::from_slice::<serde_json::Value>(&body) else {
        return error_json(StatusCode::BAD_REQUEST, "bad json");
    };
    let kind = ev["type"].as_str().unwrap_or("");
    let data = &ev["data"];
    let sub_id = data["subscription_id"].as_str();
    let company_id = data["metadata"]["company_id"].as_str();
    let customer_id = data["customer"]["customer_id"].as_str();
    let product_id = data["product_id"].as_str().unwrap_or("");
    tracing::info!("dodo webhook {kind} sub={sub_id:?} company={company_id:?}");

    let result = match kind {
        "subscription.active" | "subscription.renewed" | "subscription.plan_changed" | "subscription.updated" => {
            let status = data["status"].as_str().unwrap_or("active");
            match (company_id, dodo.plan_for_product(product_id)) {
                (Some(cid), Some(plan)) if status == "active" => {
                    pg::set_company_plan(&state.client, cid, &plan, customer_id, sub_id).await
                }
                _ => Ok(0),
            }
        }
        // A cancel scheduled for period end keeps the plan until `expired`.
        "subscription.cancelled" if data["cancel_at_next_billing_date"].as_bool() == Some(true) => Ok(0),
        "subscription.cancelled" | "subscription.expired" | "subscription.failed" => match sub_id {
            Some(s) => pg::downgrade_subscription(&state.client, s).await,
            None => Ok(0),
        },
        _ => Ok(0),
    };
    if result.is_ok() {
        let plan = dodo.plan_for_product(product_id).unwrap_or_default();
        let t = match kind {
            "subscription.active" => Some(Track::new("billing", "💰", "Subscription started").notify()),
            "subscription.plan_changed" => Some(Track::new("billing", "🔁", "Plan changed").notify()),
            "subscription.renewed" => Some(Track::new("billing", "🔄", "Subscription renewed")),
            "subscription.cancelled" => Some(Track::new("billing", "👋", "Subscription canceled").notify()),
            "subscription.expired" => Some(Track::new("billing", "⌛", "Subscription expired")),
            "subscription.failed" => Some(Track::new("billing", "🚨", "Payment failed").notify()),
            _ => None,
        };
        if let Some(t) = t {
            let t = t
                .desc(format!("{} plan", if plan.is_empty() { "unknown" } else { plan.as_str() }))
                .tag("plan", plan.clone())
                .tag("project", company_id.unwrap_or("").to_string());
            selftrack::track(&state, t);
        }
    }
    match result {
        Ok(_) => json_ok(serde_json::json!({ "received": true })),
        // 500 makes Dodo retry later.
        Err(e) => error_json(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}
