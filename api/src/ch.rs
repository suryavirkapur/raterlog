//! ClickHouse event store (HTTP interface, no extra driver).
//!
//! Every query goes through ClickHouse's server-side parameter binding
//! (`{name:Type}` placeholders + `param_name` URL params), so user input is
//! never spliced into SQL text.

use chrono::{DateTime, SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::sync::atomic::{AtomicU64, Ordering};

#[derive(Clone)]
pub struct ClickHouse {
    http: reqwest::Client,
    url: String,
    db: String,
    user: Option<String>,
    password: Option<String>,
    /// Optional storage policy (e.g. `tiered`) for the events table.
    storage_policy: Option<String>,
    /// Days on the hot volume before TTL moves parts to `cold`.
    hot_days: u32,
}

/// One ingested event, as stored and as returned to the dashboard.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    /// Monotonic-ish id (ms timestamp << 16 | sequence). Serialised as a string
    /// because it does not fit in a JS number.
    #[serde(with = "u64_string")]
    pub id: u64,
    pub company_id: String,
    pub channel_id: String,
    pub channel: String,
    pub event: String,
    pub description: String,
    pub icon: String,
    pub tags: BTreeMap<String, String>,
    pub user_id: String,
    pub notify: bool,
    pub timestamp: String,
}

/// Dashboard view of an event (no company_id).
#[derive(Debug, Clone, Serialize)]
pub struct PublicEvent {
    #[serde(with = "u64_string")]
    pub id: u64,
    pub channel_id: String,
    pub channel: String,
    pub event: String,
    pub description: String,
    pub icon: String,
    pub tags: BTreeMap<String, String>,
    pub user_id: String,
    pub notify: bool,
    pub timestamp: String,
}

impl From<Event> for PublicEvent {
    fn from(e: Event) -> Self {
        PublicEvent {
            id: e.id,
            channel_id: e.channel_id,
            channel: e.channel,
            event: e.event,
            description: e.description,
            icon: e.icon,
            tags: e.tags,
            user_id: e.user_id,
            notify: e.notify,
            timestamp: e.timestamp,
        }
    }
}

mod u64_string {
    use serde::{de, Deserialize, Deserializer, Serializer};
    pub fn serialize<S: Serializer>(v: &u64, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&v.to_string())
    }
    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<u64, D::Error> {
        #[derive(Deserialize)]
        #[serde(untagged)]
        enum N {
            S(String),
            N(u64),
        }
        match N::deserialize(d)? {
            N::S(s) => s.parse().map_err(de::Error::custom),
            N::N(n) => Ok(n),
        }
    }
}

static SEQ: AtomicU64 = AtomicU64::new(0);

pub fn next_event_id(at: DateTime<Utc>) -> u64 {
    let ms = at.timestamp_millis().max(0) as u64;
    (ms << 16) | (SEQ.fetch_add(1, Ordering::Relaxed) & 0xFFFF)
}

/// Lowest id that can belong to an event at or after `at`.
pub fn id_floor(at: DateTime<Utc>) -> u64 {
    (at.timestamp_millis().max(0) as u64) << 16
}

pub fn ch_time(at: DateTime<Utc>) -> String {
    at.format("%Y-%m-%d %H:%M:%S%.3f").to_string()
}

#[derive(Default, Debug)]
pub struct EventFilter {
    pub channel_id: Option<String>,
    pub event: Option<String>,
    pub user_id: Option<String>,
    pub tag: Option<(String, String)>,
    pub q: Option<String>,
    pub before: Option<u64>,
    pub since: Option<u64>,
    pub limit: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SeriesPoint {
    pub t: String,
    #[serde(with = "u64_string_num")]
    pub count: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KeyCount {
    pub key: String,
    #[serde(with = "u64_string_num")]
    pub count: u64,
}

/// ClickHouse quotes 64-bit ints in JSON; the dashboard wants plain numbers.
mod u64_string_num {
    use serde::{de, Deserialize, Deserializer, Serializer};
    pub fn serialize<S: Serializer>(v: &u64, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_u64(*v)
    }
    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<u64, D::Error> {
        #[derive(Deserialize)]
        #[serde(untagged)]
        enum N {
            S(String),
            N(u64),
        }
        match N::deserialize(d)? {
            N::S(s) => s.parse().map_err(de::Error::custom),
            N::N(n) => Ok(n),
        }
    }
}

type Params = Vec<(String, String)>;

impl ClickHouse {
    /// `url` like `http://user:pass@clickhouse:8123` (credentials optional).
    pub fn new(url: &str, db: &str) -> Result<Self, String> {
        let parsed = url::Url::parse(url).map_err(|e| format!("bad CLICKHOUSE_URL: {e}"))?;
        let user = (!parsed.username().is_empty()).then(|| {
            percent_decode(parsed.username())
        });
        let password = parsed.password().map(percent_decode);
        let mut clean = parsed.clone();
        let _ = clean.set_username("");
        let _ = clean.set_password(None);
        // The policy name lands verbatim in DDL, so keep it identifier-safe.
        let storage_policy = std::env::var("CLICKHOUSE_STORAGE_POLICY")
            .ok()
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty());
        if let Some(p) = &storage_policy {
            if !p.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
                return Err("CLICKHOUSE_STORAGE_POLICY may only contain letters, digits and '_'".into());
            }
        }
        let hot_days = std::env::var("CLICKHOUSE_HOT_DAYS")
            .ok()
            .and_then(|v| v.trim().parse().ok())
            .unwrap_or(30u32)
            .max(1);
        Ok(ClickHouse {
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .map_err(|e| e.to_string())?,
            url: clean.as_str().trim_end_matches('/').to_string(),
            db: db.to_string(),
            user,
            password,
            storage_policy,
            hot_days,
        })
    }

    async fn exec(&self, sql: &str, params: &Params, body: Option<String>, use_db: bool) -> Result<String, String> {
        let mut q: Vec<(String, String)> = params
            .iter()
            .map(|(k, v)| (format!("param_{k}"), v.clone()))
            .collect();
        if use_db {
            q.push(("database".into(), self.db.clone()));
        }
        let mut req = self.http.post(&self.url).query(&q);
        if let Some(u) = &self.user {
            req = req.header("X-ClickHouse-User", u);
        }
        if let Some(p) = &self.password {
            req = req.header("X-ClickHouse-Key", p);
        }
        let req = match body {
            // INSERT: query in the URL, rows in the body.
            Some(rows) => req.query(&[("query", sql)]).body(rows),
            None => req.body(sql.to_string()),
        };
        let res = req.send().await.map_err(|e| format!("clickhouse: {e}"))?;
        let status = res.status();
        let text = res.text().await.map_err(|e| format!("clickhouse: {e}"))?;
        if !status.is_success() {
            return Err(format!("clickhouse {status}: {}", text.trim()));
        }
        Ok(text)
    }

    async fn rows<T: for<'de> Deserialize<'de>>(&self, sql: &str, params: &Params) -> Result<Vec<T>, String> {
        let text = self.exec(&format!("{sql} FORMAT JSONEachRow"), params, None, true).await?;
        text.lines()
            .filter(|l| !l.trim().is_empty())
            .map(|l| serde_json::from_str(l).map_err(|e| format!("clickhouse decode: {e}: {l}")))
            .collect()
    }

    pub async fn ensure_schema(&self) -> Result<(), String> {
        self.exec(&format!("CREATE DATABASE IF NOT EXISTS `{}`", self.db), &vec![], None, false)
            .await?;
        let (tier_ttl, settings) = match &self.storage_policy {
            Some(policy) => (
                format!(", toDateTime(ts) + INTERVAL {} DAY TO VOLUME 'cold'", self.hot_days),
                format!(" SETTINGS storage_policy = '{policy}'"),
            ),
            None => (String::new(), String::new()),
        };
        self.exec(
            &format!(
                r#"CREATE TABLE IF NOT EXISTS events (
                company_id  LowCardinality(String),
                channel_id  LowCardinality(String),
                channel     LowCardinality(String),
                id          UInt64,
                ts          DateTime64(3, 'UTC'),
                event       LowCardinality(String),
                description String CODEC(ZSTD(3)),
                icon        LowCardinality(String),
                tags        Map(LowCardinality(String), String),
                user_id     String,
                notify      Bool,
                INDEX idx_user user_id TYPE bloom_filter(0.01) GRANULARITY 4
            ) ENGINE = MergeTree
            PARTITION BY toYYYYMM(ts)
            ORDER BY (company_id, id)
            TTL toDateTime(ts) + INTERVAL 3 YEAR{tier_ttl}{settings}"#
            ),
            &vec![],
            None,
            true,
        )
        .await?;
        // CREATE ... IF NOT EXISTS leaves an existing table untouched, so
        // apply the policy/TTL again to catch old tables. These are
        // idempotent; a server that can't honour them gets a warning, not a
        // crash (tiering stays optional).
        if let Some(policy) = &self.storage_policy {
            if let Err(e) = self
                .exec(
                    &format!("ALTER TABLE events MODIFY SETTING storage_policy = '{policy}'"),
                    &vec![],
                    None,
                    true,
                )
                .await
            {
                tracing::warn!("could not set storage_policy '{policy}' on events (is it defined server-side?): {e}");
            }
            if let Err(e) = self
                .exec(
                    &format!(
                        "ALTER TABLE events MODIFY TTL toDateTime(ts) + INTERVAL 3 YEAR, toDateTime(ts) + INTERVAL {} DAY TO VOLUME 'cold'",
                        self.hot_days
                    ),
                    &vec![],
                    None,
                    true,
                )
                .await
            {
                tracing::warn!("could not set the tiered TTL on events (does the policy have a 'cold' volume?): {e}");
            }
        }
        Ok(())
    }

    pub async fn ping(&self) -> bool {
        self.exec("SELECT 1", &vec![], None, false).await.is_ok()
    }

    pub async fn insert(&self, e: &Event) -> Result<(), String> {
        #[derive(Serialize)]
        struct Row<'a> {
            company_id: &'a str,
            channel_id: &'a str,
            channel: &'a str,
            id: u64,
            ts: String,
            event: &'a str,
            description: &'a str,
            icon: &'a str,
            tags: &'a BTreeMap<String, String>,
            user_id: &'a str,
            notify: bool,
        }
        let ts = DateTime::parse_from_rfc3339(&e.timestamp)
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());
        let row = serde_json::to_string(&Row {
            company_id: &e.company_id,
            channel_id: &e.channel_id,
            channel: &e.channel,
            id: e.id,
            ts: ch_time(ts),
            event: &e.event,
            description: &e.description,
            icon: &e.icon,
            tags: &e.tags,
            user_id: &e.user_id,
            notify: e.notify,
        })
        .map_err(|e| e.to_string())?;
        // async_insert batches small inserts server-side; wait=1 keeps the
        // ack meaningful (the event is durable when we return 201).
        let sql = "INSERT INTO events SETTINGS async_insert=1, wait_for_async_insert=1 FORMAT JSONEachRow";
        self.exec(sql, &vec![], Some(row), true).await.map(|_| ())
    }

    const EVENT_COLS: &'static str = "toString(id) AS id, company_id, channel_id, channel, event, description, icon, tags, user_id, notify, formatDateTime(ts, '%Y-%m-%dT%H:%i:%S.%fZ') AS timestamp";

    pub async fn list(&self, company_id: &str, f: &EventFilter) -> Result<Vec<Event>, String> {
        let mut params: Params = vec![("c".into(), company_id.into())];
        let mut wh = vec!["company_id = {c:String}".to_string()];
        if let Some(v) = &f.channel_id {
            wh.push("channel_id = {ch:String}".into());
            params.push(("ch".into(), v.clone()));
        }
        if let Some(v) = &f.event {
            wh.push("event = {ev:String}".into());
            params.push(("ev".into(), v.clone()));
        }
        if let Some(v) = &f.user_id {
            wh.push("user_id = {u:String}".into());
            params.push(("u".into(), v.clone()));
        }
        if let Some((k, v)) = &f.tag {
            wh.push("tags[{tk:String}] = {tv:String}".into());
            params.push(("tk".into(), k.clone()));
            params.push(("tv".into(), v.clone()));
        }
        if let Some(v) = &f.q {
            wh.push("(positionCaseInsensitiveUTF8(event, {q:String}) > 0 OR positionCaseInsensitiveUTF8(description, {q:String}) > 0 OR positionCaseInsensitiveUTF8(user_id, {q:String}) > 0)".into());
            params.push(("q".into(), v.clone()));
        }
        if let Some(v) = f.before {
            wh.push("id < {before:UInt64}".into());
            params.push(("before".into(), v.to_string()));
        }
        if let Some(v) = f.since {
            wh.push("id > {since:UInt64}".into());
            params.push(("since".into(), v.to_string()));
        }
        params.push(("lim".into(), f.limit.clamp(1, 500).to_string()));
        let sql = format!(
            "SELECT {} FROM events WHERE {} ORDER BY id DESC LIMIT {{lim:UInt32}}",
            Self::EVENT_COLS,
            wh.join(" AND ")
        );
        self.rows(&sql, &params).await
    }

    /// Events per bucket in [from, now). Missing buckets are filled with 0.
    pub async fn timeseries(
        &self,
        company_id: &str,
        from: DateTime<Utc>,
        hourly: bool,
        channel_id: Option<&str>,
        event: Option<&str>,
    ) -> Result<Vec<SeriesPoint>, String> {
        let bucket = if hourly { "toStartOfHour(ts)" } else { "toStartOfDay(ts)" };
        let mut params: Params = vec![
            ("c".into(), company_id.into()),
            ("from".into(), id_floor(from).to_string()),
        ];
        let mut wh = vec!["company_id = {c:String}".to_string(), "id >= {from:UInt64}".to_string()];
        if let Some(v) = channel_id {
            wh.push("channel_id = {ch:String}".into());
            params.push(("ch".into(), v.into()));
        }
        if let Some(v) = event {
            wh.push("event = {ev:String}".into());
            params.push(("ev".into(), v.into()));
        }
        let sql = format!(
            "SELECT formatDateTime({bucket}, '%Y-%m-%dT%H:%i:%SZ') AS t, count() AS count FROM events WHERE {} GROUP BY t ORDER BY t",
            wh.join(" AND ")
        );
        let got: Vec<SeriesPoint> = self.rows(&sql, &params).await?;
        let map: std::collections::HashMap<String, u64> = got.into_iter().map(|p| (p.t, p.count)).collect();

        let step = if hourly { chrono::Duration::hours(1) } else { chrono::Duration::days(1) };
        use chrono::DurationRound;
        let mut t = from.duration_trunc(step).unwrap_or(from);
        let now = Utc::now();
        let mut out = vec![];
        while t <= now {
            let key = t.to_rfc3339_opts(SecondsFormat::Secs, true);
            out.push(SeriesPoint { count: *map.get(&key).unwrap_or(&0), t: key });
            t += step;
        }
        Ok(out)
    }

    pub async fn breakdown(
        &self,
        company_id: &str,
        from: DateTime<Utc>,
        by: &str,
        channel_id: Option<&str>,
        limit: u32,
    ) -> Result<Vec<KeyCount>, String> {
        let (col, extra) = match by {
            "channel" => ("channel", ""),
            "user" => ("user_id", " AND user_id != ''"),
            _ => ("event", ""),
        };
        let mut params: Params = vec![
            ("c".into(), company_id.into()),
            ("from".into(), id_floor(from).to_string()),
            ("lim".into(), limit.clamp(1, 1000).to_string()),
        ];
        let mut wh = format!("company_id = {{c:String}} AND id >= {{from:UInt64}}{extra}");
        if let Some(v) = channel_id {
            wh.push_str(" AND channel_id = {ch:String}");
            params.push(("ch".into(), v.into()));
        }
        let sql = format!(
            "SELECT toString({col}) AS key, count() AS count FROM events WHERE {wh} GROUP BY key ORDER BY count DESC LIMIT {{lim:UInt32}}"
        );
        self.rows(&sql, &params).await
    }

    /// Ordered conversion funnel over identified users (`windowFunnel`).
    /// Returns the number of users that reached each step.
    pub async fn funnel(
        &self,
        company_id: &str,
        from: DateTime<Utc>,
        steps: &[String],
        window_secs: u64,
    ) -> Result<Vec<u64>, String> {
        let mut params: Params = vec![
            ("c".into(), company_id.into()),
            ("from".into(), id_floor(from).to_string()),
            ("w".into(), (window_secs * 1000).to_string()),
        ];
        let conds: Vec<String> = steps
            .iter()
            .enumerate()
            .map(|(i, s)| {
                params.push((format!("s{i}"), s.clone()));
                format!("event = {{s{i}:String}}")
            })
            .collect();
        let in_list: Vec<String> = (0..steps.len()).map(|i| format!("{{s{i}:String}}")).collect();
        let sql = format!(
            "SELECT level, count() AS users FROM (
               SELECT user_id, windowFunnel({{w:UInt64}})(toUInt64(toUnixTimestamp64Milli(ts)), {}) AS level
               FROM events
               WHERE company_id = {{c:String}} AND id >= {{from:UInt64}} AND user_id != '' AND event IN ({})
               GROUP BY user_id
             ) GROUP BY level",
            conds.join(", "),
            in_list.join(", ")
        );
        #[derive(Deserialize)]
        struct Row {
            level: u64,
            #[serde(with = "u64_string_num")]
            users: u64,
        }
        let rows: Vec<Row> = self.rows(&sql, &params).await?;
        // users reaching step k = users whose max level >= k
        Ok((1..=steps.len() as u64)
            .map(|k| rows.iter().filter(|r| r.level >= k).map(|r| r.users).sum())
            .collect())
    }

    /// Headline numbers for the analytics page.
    pub async fn summary(&self, company_id: &str, from: DateTime<Utc>) -> Result<serde_json::Value, String> {
        use chrono::DurationRound;
        let today = Utc::now().duration_trunc(chrono::Duration::days(1)).unwrap_or_else(|_| Utc::now());
        let yesterday = today - chrono::Duration::days(1);
        #[derive(Deserialize)]
        struct Row {
            #[serde(with = "u64_string_num")]
            total: u64,
            #[serde(with = "u64_string_num")]
            users: u64,
            #[serde(with = "u64_string_num")]
            today: u64,
            #[serde(with = "u64_string_num")]
            yesterday: u64,
        }
        let lo = id_floor(from.min(yesterday));
        let rows: Vec<Row> = self
            .rows(
                "SELECT countIf(id >= {from:UInt64}) AS total,
                        uniqExactIf(user_id, id >= {from:UInt64} AND user_id != '') AS users,
                        countIf(id >= {today:UInt64}) AS today,
                        countIf(id >= {yday:UInt64} AND id < {today:UInt64}) AS yesterday
                 FROM events WHERE company_id = {c:String} AND id >= {lo:UInt64}",
                &vec![
                    ("c".into(), company_id.into()),
                    ("from".into(), id_floor(from).to_string()),
                    ("today".into(), id_floor(today).to_string()),
                    ("yday".into(), id_floor(yesterday).to_string()),
                    ("lo".into(), lo.to_string()),
                ],
            )
            .await?;
        let r = rows.into_iter().next().ok_or("no summary row")?;
        Ok(serde_json::json!({ "total": r.total, "unique_users": r.users, "today": r.today, "yesterday": r.yesterday }))
    }

    pub async fn count_since(&self, company_id: &str, from: DateTime<Utc>) -> Result<u64, String> {
        #[derive(Deserialize)]
        struct Row {
            #[serde(with = "u64_string_num")]
            n: u64,
        }
        let rows: Vec<Row> = self
            .rows(
                "SELECT count() AS n FROM events WHERE company_id = {c:String} AND id >= {from:UInt64}",
                &vec![("c".into(), company_id.into()), ("from".into(), id_floor(from).to_string())],
            )
            .await?;
        Ok(rows.first().map(|r| r.n).unwrap_or(0))
    }

    /// Drop events older than `days` for one company (plan retention).
    pub async fn purge_older_than(&self, company_id: &str, days: u32) -> Result<(), String> {
        let cutoff = Utc::now() - chrono::Duration::days(days as i64);
        self.exec(
            "DELETE FROM events WHERE company_id = {c:String} AND id < {cut:UInt64}",
            &vec![("c".into(), company_id.into()), ("cut".into(), id_floor(cutoff).to_string())],
            None,
            true,
        )
        .await
        .map(|_| ())
    }

    pub async fn delete_channel(&self, company_id: &str, channel_id: &str) -> Result<(), String> {
        self.exec(
            "DELETE FROM events WHERE company_id = {c:String} AND channel_id = {ch:String}",
            &vec![("c".into(), company_id.into()), ("ch".into(), channel_id.into())],
            None,
            true,
        )
        .await
        .map(|_| ())
    }
}

fn percent_decode(s: &str) -> String {
    url::form_urlencoded::parse(format!("x={}", s.replace('+', "%2B")).as_bytes())
        .next()
        .map(|(_, v)| v.into_owned())
        .unwrap_or_else(|| s.to_string())
}
