use scylla::Session;
use std::sync::Arc;
use tokio_postgres::Client;

pub struct AppState {
    pub db: Arc<Session>,
    pub client: Client,
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
