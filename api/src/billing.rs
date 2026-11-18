//! Plans, quota cache and the Dodo Payments client.
//!
//! Configuration (all optional; billing endpoints answer 503 when unset):
//!   DODO_API_KEY         secret API key
//!   DODO_API_BASE        https://test.dodopayments.com (default) or https://live.dodopayments.com
//!   DODO_WEBHOOK_SECRET  whsec_... (Standard Webhooks)
//!   DODO_PRODUCTS        starter_month=pdt_..,starter_year=pdt_..,growth_month=..,growth_year=..,scale_month=..,scale_year=..

use base64ct::{Base64, Encoding};
use chrono::{DateTime, Datelike, TimeZone, Utc};
use hmac::{Hmac, Mac};
use serde::Serialize;
use sha2::Sha256;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;

#[derive(Debug, Clone, Serialize)]
pub struct Plan {
    pub id: &'static str,
    pub name: &'static str,
    pub price_month: u32,
    pub price_year: u32,
    pub events_limit: i64,
    pub seats_limit: i64,
    pub retention_days: u32,
    pub features: Vec<&'static str>,
}

/// Mirrors web/src/lib/plans.ts.
pub fn plans() -> Vec<Plan> {
    vec![
        Plan {
            id: "free",
            name: "Free",
            price_month: 0,
            price_year: 0,
            events_limit: 3_000,
            seats_limit: 3,
            retention_days: 30,
            features: vec!["3,000 events / month", "3 seats", "30-day history", "Live feed & push notifications"],
        },
        Plan {
            id: "starter",
            name: "Starter",
            price_month: 12,
            price_year: 120,
            events_limit: 50_000,
            seats_limit: -1,
            retention_days: 365,
            features: vec!["50,000 events / month", "Unlimited seats", "1-year history", "Charts, funnels & journeys"],
        },
        Plan {
            id: "growth",
            name: "Growth",
            price_month: 29,
            price_year: 290,
            events_limit: 250_000,
            seats_limit: -1,
            retention_days: 730,
            features: vec!["250,000 events / month", "Unlimited seats", "2-year history", "AI copilot", "Priority support"],
        },
        Plan {
            id: "scale",
            name: "Scale",
            price_month: 59,
            price_year: 590,
            events_limit: 1_000_000,
            seats_limit: -1,
            retention_days: 1095,
            features: vec!["1,000,000 events / month", "Unlimited seats", "3-year history", "AI copilot", "Priority support"],
        },
    ]
}

pub fn plan(id: &str) -> Plan {
    plans()
        .into_iter()
        .find(|p| p.id == id)
        .unwrap_or_else(|| plans().remove(0))
}

/// Start/end of the current usage period (calendar month, UTC).
pub fn current_period() -> (DateTime<Utc>, DateTime<Utc>) {
    let now = Utc::now();
    let start = Utc.with_ymd_and_hms(now.year(), now.month(), 1, 0, 0, 0).unwrap();
    let (y, m) = if now.month() == 12 { (now.year() + 1, 1) } else { (now.year(), now.month() + 1) };
    let end = Utc.with_ymd_and_hms(y, m, 1, 0, 0, 0).unwrap();
    (start, end)
}

/// Per-project event counter for quota checks, refreshed from ClickHouse at
/// most once a minute and bumped locally on every accepted event.
#[derive(Default)]
pub struct QuotaCache {
    inner: Mutex<HashMap<String, (u64, Instant, DateTime<Utc>)>>,
}

impl QuotaCache {
    pub fn get_fresh(&self, company_id: &str) -> Option<u64> {
        let (period, _) = current_period();
        let map = self.inner.lock().unwrap();
        map.get(company_id).and_then(|(n, at, p)| {
            (at.elapsed().as_secs() < 60 && *p == period).then_some(*n)
        })
    }
    pub fn set(&self, company_id: &str, n: u64) {
        let (period, _) = current_period();
        self.inner
            .lock()
            .unwrap()
            .insert(company_id.to_string(), (n, Instant::now(), period));
    }
    pub fn bump(&self, company_id: &str) {
        if let Some(e) = self.inner.lock().unwrap().get_mut(company_id) {
            e.0 += 1;
        }
    }
}

#[derive(Clone)]
pub struct Dodo {
    pub http: reqwest::Client,
    pub key: String,
    pub base: String,
    pub webhook_secret: Option<String>,
    /// "starter_month" -> product id
    pub products: HashMap<String, String>,
}

impl Dodo {
    pub fn from_env() -> Option<Dodo> {
        let key = std::env::var("DODO_API_KEY").ok().filter(|v| !v.is_empty())?;
        let products = std::env::var("DODO_PRODUCTS")
            .unwrap_or_default()
            .split(',')
            .filter_map(|kv| {
                let (k, v) = kv.split_once('=')?;
                Some((k.trim().to_string(), v.trim().to_string()))
            })
            .collect();
        Some(Dodo {
            http: reqwest::Client::new(),
            key,
            base: std::env::var("DODO_API_BASE")
                .unwrap_or_else(|_| "https://test.dodopayments.com".into())
                .trim_end_matches('/')
                .to_string(),
            webhook_secret: std::env::var("DODO_WEBHOOK_SECRET").ok().filter(|v| !v.is_empty()),
            products,
        })
    }

    pub fn product_for(&self, plan: &str, interval: &str) -> Option<&String> {
        self.products.get(&format!("{plan}_{interval}"))
    }

    pub fn plan_for_product(&self, product_id: &str) -> Option<String> {
        self.products
            .iter()
            .find(|(_, v)| v.as_str() == product_id)
            .and_then(|(k, _)| k.split('_').next().map(str::to_string))
    }

    async fn post(&self, path: &str, body: serde_json::Value) -> Result<serde_json::Value, String> {
        let res = self
            .http
            .post(format!("{}{}", self.base, path))
            .bearer_auth(&self.key)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("dodo: {e}"))?;
        let status = res.status();
        let v: serde_json::Value = res.json().await.unwrap_or(serde_json::Value::Null);
        if !status.is_success() {
            return Err(format!("dodo {status}: {v}"));
        }
        Ok(v)
    }

    pub async fn checkout(
        &self,
        product_id: &str,
        customer: serde_json::Value,
        return_url: &str,
        company_id: &str,
    ) -> Result<String, String> {
        let v = self
            .post(
                "/checkouts",
                serde_json::json!({
                    "product_cart": [{ "product_id": product_id, "quantity": 1 }],
                    "customer": customer,
                    "return_url": return_url,
                    "metadata": { "company_id": company_id },
                }),
            )
            .await?;
        v.get("checkout_url")
            .and_then(|u| u.as_str())
            .map(str::to_string)
            .ok_or_else(|| format!("dodo: no checkout_url in {v}"))
    }

    pub async fn portal(&self, customer_id: &str) -> Result<String, String> {
        let v = self
            .post(
                &format!("/customers/{customer_id}/customer-portal/session"),
                serde_json::json!({}),
            )
            .await?;
        v.get("link")
            .and_then(|u| u.as_str())
            .map(str::to_string)
            .ok_or_else(|| format!("dodo: no portal link in {v}"))
    }

    /// Standard Webhooks verification: HMAC-SHA256 over "{id}.{ts}.{body}".
    pub fn verify_webhook(&self, id: &str, ts: &str, sig_header: &str, body: &[u8]) -> bool {
        let Some(secret) = &self.webhook_secret else { return false };
        let Ok(ts_num) = ts.parse::<i64>() else { return false };
        if (Utc::now().timestamp() - ts_num).abs() > 300 {
            return false;
        }
        verify_signature(secret, id, ts, sig_header, body)
    }
}

pub(crate) fn verify_signature(secret: &str, id: &str, ts: &str, sig_header: &str, body: &[u8]) -> bool {
    {
        let raw = secret.strip_prefix("whsec_").unwrap_or(secret);
        let Ok(key) = Base64::decode_vec(raw) else { return false };
        let Ok(mut mac) = Hmac::<Sha256>::new_from_slice(&key) else { return false };
        mac.update(id.as_bytes());
        mac.update(b".");
        mac.update(ts.as_bytes());
        mac.update(b".");
        mac.update(body);
        let expected = mac.finalize().into_bytes();
        sig_header.split_whitespace().any(|part| {
            part.strip_prefix("v1,")
                .and_then(|s| Base64::decode_vec(s).ok())
                .map(|got| constant_time_eq(&got, &expected))
                .unwrap_or(false)
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn standard_webhook_signature() {
        // Vector computed independently with Python's hmac module.
        let secret = "whsec_c3VwZXJzZWNyZXRrZXkxMjM=";
        let body = br#"{"type":"x"}"#;
        let good = "v0,zzz v1,pz8CczD/J6Old27ex5D56ft58/4xGBpnBnuDJ/2Dv+s=";
        assert!(verify_signature(secret, "msg_1", "1700000000", good, body));
        assert!(!verify_signature(secret, "msg_2", "1700000000", good, body));
        assert!(!verify_signature(secret, "msg_1", "1700000000", "v1,AAAA", body));
    }

    #[test]
    fn plan_lookup_defaults_to_free() {
        assert_eq!(plan("growth").events_limit, 250_000);
        assert_eq!(plan("nope").id, "free");
    }
}

pub(crate) fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}
