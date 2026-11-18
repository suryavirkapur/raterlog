use crate::billing::{Dodo, QuotaCache};
use crate::ch::ClickHouse;
use tokio_postgres::Client;

pub struct AppState {
    pub client: Client,
    pub ch: ClickHouse,
    pub quota: QuotaCache,
    pub dodo: Option<Dodo>,
    pub cookie_secure: bool,
    pub app_url: String,
    pub smtp_host: String,
    pub smtp_port: u16,
    pub openai_api_key: Option<String>,
}

impl AppState {
    pub fn openai_key(&self) -> Option<&str> {
        self.openai_api_key.as_deref()
    }
}
