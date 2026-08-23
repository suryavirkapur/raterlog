use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogItem {
    pub channel_id: String,
    pub timestamp: String,
    pub event_name: String,
    pub event_payload: String,
    pub metadata: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct EventCount {
    pub name: String,
    pub count: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct Anomaly {
    pub event_name: String,
    pub count: usize,
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct AiSummary {
    pub summary: String,
    pub event_counts: Vec<EventCount>,
    pub anomalies: Vec<Anomaly>,
    pub source: String,
}

pub fn heuristic_summary(logs: &[LogItem]) -> AiSummary {
    if logs.is_empty() {
        return AiSummary {
            summary: "No events in this channel yet. Once traffic lands, Raterlog will summarize volume, top events, and unusual spikes.".to_string(),
            event_counts: vec![],
            anomalies: vec![],
            source: "heuristic".to_string(),
        };
    }

    let mut counts: HashMap<String, usize> = HashMap::new();
    let mut errorish = 0usize;
    for log in logs {
        *counts.entry(log.event_name.clone()).or_insert(0) += 1;
        let blob = format!(
            "{} {} {}",
            log.event_name,
            log.event_payload,
            log.metadata.clone().unwrap_or_default()
        )
        .to_lowercase();
        if blob.contains("error")
            || blob.contains("fail")
            || blob.contains("exception")
            || blob.contains("timeout")
            || blob.contains("panic")
        {
            errorish += 1;
        }
    }

    let mut event_counts: Vec<EventCount> = counts
        .iter()
        .map(|(name, count)| EventCount {
            name: name.clone(),
            count: *count,
        })
        .collect();
    event_counts.sort_by(|a, b| b.count.cmp(&a.count).then(a.name.cmp(&b.name)));

    let total = logs.len();
    let unique = event_counts.len();
    let top = event_counts
        .first()
        .map(|e| format!("{} ({} events)", e.name, e.count))
        .unwrap_or_else(|| "none".to_string());

    let anomalies = detect_anomalies(&event_counts, total);

    let mut summary = format!(
        "Channel ingested {total} events across {unique} event types. The most common event is {top}."
    );
    if errorish > 0 {
        summary.push_str(&format!(
            " {errorish} event(s) look error-like and may need a closer look."
        ));
    }
    if !anomalies.is_empty() {
        summary.push_str(&format!(
            " Detected {} unusual pattern(s) compared with the rest of this window.",
            anomalies.len()
        ));
    } else {
        summary.push_str(" Volume looks even across event types.");
    }

    AiSummary {
        summary,
        event_counts,
        anomalies,
        source: "heuristic".to_string(),
    }
}

pub fn detect_anomalies(event_counts: &[EventCount], total: usize) -> Vec<Anomaly> {
    if event_counts.len() < 2 || total == 0 {
        return event_counts
            .iter()
            .filter(|e| {
                let n = e.name.to_lowercase();
                n.contains("error") || n.contains("fail") || n.contains("alert")
            })
            .map(|e| Anomaly {
                event_name: e.name.clone(),
                count: e.count,
                reason: "error-like event name".to_string(),
            })
            .collect();
    }

    let mean = total as f64 / event_counts.len() as f64;
    let mut anomalies = Vec::new();
    for event in event_counts {
        let name = event.name.to_lowercase();
        if event.count as f64 > mean * 3.0 && event.count > 5 {
            anomalies.push(Anomaly {
                event_name: event.name.clone(),
                count: event.count,
                reason: format!(
                    "volume is {:.1}x the average event type in this window",
                    event.count as f64 / mean
                ),
            });
        }
        if name.contains("error") || name.contains("fail") || name.contains("alert") {
            anomalies.push(Anomaly {
                event_name: event.name.clone(),
                count: event.count,
                reason: "error-like event name".to_string(),
            });
        }
    }
    anomalies
}

pub fn heuristic_answer(question: &str, logs: &[LogItem], summary: &AiSummary) -> String {
    let q = question.to_lowercase();
    if logs.is_empty() {
        return "This channel has no events yet, so there is nothing to answer from.".to_string();
    }
    if q.contains("error") || q.contains("fail") || q.contains("incident") {
        let hits: Vec<_> = logs
            .iter()
            .filter(|l| {
                format!("{} {}", l.event_name, l.event_payload)
                    .to_lowercase()
                    .contains("error")
                    || l.event_name.to_lowercase().contains("fail")
            })
            .take(5)
            .map(|l| format!("{} at {}", l.event_name, l.timestamp))
            .collect();
        if hits.is_empty() {
            return "No error-like events showed up in the current window.".to_string();
        }
        return format!("Possible error events: {}.", hits.join("; "));
    }
    if q.contains("top") || q.contains("common") || q.contains("most") {
        if let Some(top) = summary.event_counts.first() {
            return format!(
                "The most common event is '{}' with {} occurrences out of {}.",
                top.name, top.count, logs.len()
            );
        }
    }
    if q.contains("how many") || q.contains("count") || q.contains("volume") {
        return format!(
            "There are {} events and {} distinct event types in this window.",
            logs.len(),
            summary.event_counts.len()
        );
    }
    format!(
        "{}\n\nTop events: {}",
        summary.summary,
        summary
            .event_counts
            .iter()
            .take(5)
            .map(|e| format!("{} ({})", e.name, e.count))
            .collect::<Vec<_>>()
            .join(", ")
    )
}

pub async fn maybe_llm_summary(
    api_key: Option<&str>,
    logs: &[LogItem],
    fallback: AiSummary,
) -> AiSummary {
    let Some(key) = api_key.filter(|k| !k.is_empty()) else {
        return fallback;
    };
    let sample: Vec<_> = logs.iter().take(40).collect();
    let prompt = format!(
        "You are an analytics copilot for a LogSnag-style product analytics tool. Summarize these events in 2-3 sentences. Call out spikes, errors, and what an operator should look at next.\n\n{}",
        serde_json::to_string(&sample).unwrap_or_default()
    );
    match chat_completion(key, &prompt).await {
        Ok(text) if !text.trim().is_empty() => AiSummary {
            summary: text.trim().to_string(),
            event_counts: fallback.event_counts,
            anomalies: fallback.anomalies,
            source: "llm".to_string(),
        },
        Ok(_) | Err(_) => fallback,
    }
}

pub async fn maybe_llm_answer(
    api_key: Option<&str>,
    question: &str,
    logs: &[LogItem],
    fallback: String,
) -> String {
    let Some(key) = api_key.filter(|k| !k.is_empty()) else {
        return fallback;
    };
    let sample: Vec<_> = logs.iter().take(40).collect();
    let prompt = format!(
        "Answer the operator's question using only these product events. Be concise.\nQuestion: {question}\nEvents: {}",
        serde_json::to_string(&sample).unwrap_or_default()
    );
    match chat_completion(key, &prompt).await {
        Ok(text) if !text.trim().is_empty() => text.trim().to_string(),
        Ok(_) | Err(_) => fallback,
    }
}

async fn chat_completion(api_key: &str, prompt: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(api_key)
        .json(&serde_json::json!({
            "model": "gpt-4o-mini",
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": "You help product teams understand event streams."},
                {"role": "user", "content": prompt}
            ]
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let body: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(body["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn log(name: &str, payload: &str) -> LogItem {
        LogItem {
            channel_id: "c1".into(),
            timestamp: "2026-01-01T00:00:00Z".into(),
            event_name: name.into(),
            event_payload: payload.into(),
            metadata: None,
        }
    }

    #[test]
    fn empty_channel_summary() {
        let summary = heuristic_summary(&[]);
        assert!(summary.summary.contains("No events"));
        assert!(summary.event_counts.is_empty());
    }

    #[test]
    fn counts_and_error_detection() {
        let logs = vec![
            log("signup", "new user"),
            log("signup", "new user"),
            log("error", "db timeout"),
            log("signup", "new user"),
        ];
        let summary = heuristic_summary(&logs);
        assert_eq!(summary.event_counts[0].name, "signup");
        assert_eq!(summary.event_counts[0].count, 3);
        assert!(summary.summary.contains("error-like"));
        assert!(summary.anomalies.iter().any(|a| a.event_name == "error"));
    }

    #[test]
    fn answers_volume_questions() {
        let logs = vec![log("click", "a"), log("click", "b"), log("view", "c")];
        let summary = heuristic_summary(&logs);
        let answer = heuristic_answer("how many events", &logs, &summary);
        assert!(answer.contains("3 events"));
    }
}
