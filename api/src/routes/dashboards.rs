//! User-built dashboards made of saved analytics widgets.
//!
//! Widgets store the same parameters the `/api/companies/{id}/analytics/*`
//! endpoints take in their JSONB `config` (channel, event, by, steps, range,
//! interval, window_hours, insight) plus layout (x, y, w, h). Widgets fetch
//! their data through the existing analytics endpoints — no query logic here.

use crate::pg;
use crate::state::AppState;
use crate::util::{error_json, generate_id, json_created, json_ok};
use actix_web::{delete, get, http::StatusCode, patch, post, put, web, HttpRequest, HttpResponse};
use serde::Deserialize;
use serde_json::{json, Value};

use super::require_company_member;

const WIDGET_KINDS: &[&str] = &["timeseries", "breakdown", "funnel", "insight", "event_count"];

#[derive(Deserialize)]
struct DashboardInput {
    name: String,
}

#[derive(Deserialize)]
struct WidgetInput {
    kind: String,
    title: String,
    #[serde(default)]
    config: Value,
}

#[derive(Deserialize)]
struct WidgetPatch {
    title: Option<String>,
    config: Option<Value>,
}

#[derive(Deserialize)]
struct LayoutEntry {
    id: String,
    x: i64,
    y: i64,
    w: i64,
    h: i64,
}

#[derive(Deserialize)]
struct LayoutInput {
    widgets: Vec<LayoutEntry>,
}

/// Membership check + verify the dashboard belongs to this company.
async fn member_dashboard(
    req: &HttpRequest,
    state: &web::Data<AppState>,
    company_id: &str,
    dashboard_id: &str,
) -> Result<pg::Dashboard, HttpResponse> {
    require_company_member(req, state, company_id).await?;
    match pg::dashboard_by_id(&state.client, company_id, dashboard_id).await {
        Ok(Some(d)) => Ok(d),
        Ok(None) => Err(error_json(StatusCode::NOT_FOUND, "dashboard not found")),
        Err(e) => Err(error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to load dashboard: {e}"),
        )),
    }
}

#[get("/api/companies/{company_id}/dashboards")]
pub async fn list_dashboards(
    req: HttpRequest,
    path: web::Path<String>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let company_id = path.into_inner();
    if let Err(resp) = require_company_member(&req, &state, &company_id).await {
        return resp;
    }
    match pg::dashboards_for_company(&state.client, &company_id).await {
        Ok(dashboards) => json_ok(dashboards),
        Err(e) => error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to list dashboards: {e}"),
        ),
    }
}

#[post("/api/companies/{company_id}/dashboards")]
pub async fn create_dashboard(
    req: HttpRequest,
    path: web::Path<String>,
    body: web::Json<DashboardInput>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let company_id = path.into_inner();
    if let Err(resp) = require_company_member(&req, &state, &company_id).await {
        return resp;
    }
    let name = body.name.trim();
    if name.is_empty() {
        return error_json(StatusCode::BAD_REQUEST, "dashboard name is required");
    }
    match pg::create_dashboard(&state.client, &generate_id(15), &company_id, name).await {
        Ok(dashboard) => json_created(dashboard),
        Err(e) => error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to create dashboard: {e}"),
        ),
    }
}

#[get("/api/companies/{company_id}/dashboards/{dashboard_id}")]
pub async fn get_dashboard(
    req: HttpRequest,
    path: web::Path<(String, String)>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let (company_id, dashboard_id) = path.into_inner();
    let dashboard = match member_dashboard(&req, &state, &company_id, &dashboard_id).await {
        Ok(d) => d,
        Err(resp) => return resp,
    };
    match pg::widgets_for_dashboard(&state.client, &dashboard.id).await {
        Ok(widgets) => json_ok(json!({ "dashboard": dashboard, "widgets": widgets })),
        Err(e) => error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to load widgets: {e}"),
        ),
    }
}

#[patch("/api/companies/{company_id}/dashboards/{dashboard_id}")]
pub async fn rename_dashboard(
    req: HttpRequest,
    path: web::Path<(String, String)>,
    body: web::Json<DashboardInput>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let (company_id, dashboard_id) = path.into_inner();
    if let Err(resp) = require_company_member(&req, &state, &company_id).await {
        return resp;
    }
    let name = body.name.trim();
    if name.is_empty() {
        return error_json(StatusCode::BAD_REQUEST, "dashboard name is required");
    }
    match pg::update_dashboard(&state.client, &company_id, &dashboard_id, name).await {
        Ok(Some(dashboard)) => json_ok(dashboard),
        Ok(None) => error_json(StatusCode::NOT_FOUND, "dashboard not found"),
        Err(e) => error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to rename dashboard: {e}"),
        ),
    }
}

#[delete("/api/companies/{company_id}/dashboards/{dashboard_id}")]
pub async fn delete_dashboard(
    req: HttpRequest,
    path: web::Path<(String, String)>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let (company_id, dashboard_id) = path.into_inner();
    if let Err(resp) = require_company_member(&req, &state, &company_id).await {
        return resp;
    }
    match pg::delete_dashboard(&state.client, &company_id, &dashboard_id).await {
        Ok(0) => error_json(StatusCode::NOT_FOUND, "dashboard not found"),
        Ok(_) => json_ok(json!({ "ok": true })),
        Err(e) => error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to delete dashboard: {e}"),
        ),
    }
}

#[post("/api/companies/{company_id}/dashboards/{dashboard_id}/widgets")]
pub async fn create_widget(
    req: HttpRequest,
    path: web::Path<(String, String)>,
    body: web::Json<WidgetInput>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let (company_id, dashboard_id) = path.into_inner();
    let dashboard = match member_dashboard(&req, &state, &company_id, &dashboard_id).await {
        Ok(d) => d,
        Err(resp) => return resp,
    };
    let kind = body.kind.trim();
    let title = body.title.trim();
    if !WIDGET_KINDS.contains(&kind) {
        return error_json(
            StatusCode::BAD_REQUEST,
            &format!("kind must be one of: {}", WIDGET_KINDS.join(", ")),
        );
    }
    if title.is_empty() {
        return error_json(StatusCode::BAD_REQUEST, "widget title is required");
    }
    if !body.config.is_object() {
        return error_json(StatusCode::BAD_REQUEST, "config must be an object");
    }
    match pg::create_widget(
        &state.client,
        &generate_id(15),
        &dashboard.id,
        kind,
        title,
        &body.config,
    )
    .await
    {
        Ok(widget) => json_created(widget),
        Err(e) => error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to create widget: {e}"),
        ),
    }
}

#[patch("/api/companies/{company_id}/dashboards/{dashboard_id}/widgets/{widget_id}")]
pub async fn update_widget(
    req: HttpRequest,
    path: web::Path<(String, String, String)>,
    body: web::Json<WidgetPatch>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let (company_id, dashboard_id, widget_id) = path.into_inner();
    let dashboard = match member_dashboard(&req, &state, &company_id, &dashboard_id).await {
        Ok(d) => d,
        Err(resp) => return resp,
    };
    let title = body.title.as_deref().map(str::trim);
    if title == Some("") {
        return error_json(StatusCode::BAD_REQUEST, "widget title cannot be empty");
    }
    if body.config.as_ref().is_some_and(|c| !c.is_object()) {
        return error_json(StatusCode::BAD_REQUEST, "config must be an object");
    }
    match pg::update_widget(
        &state.client,
        &dashboard.id,
        &widget_id,
        title,
        body.config.as_ref(),
    )
    .await
    {
        Ok(Some(widget)) => json_ok(widget),
        Ok(None) => error_json(StatusCode::NOT_FOUND, "widget not found"),
        Err(e) => error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to update widget: {e}"),
        ),
    }
}

#[delete("/api/companies/{company_id}/dashboards/{dashboard_id}/widgets/{widget_id}")]
pub async fn delete_widget(
    req: HttpRequest,
    path: web::Path<(String, String, String)>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let (company_id, dashboard_id, widget_id) = path.into_inner();
    let dashboard = match member_dashboard(&req, &state, &company_id, &dashboard_id).await {
        Ok(d) => d,
        Err(resp) => return resp,
    };
    match pg::delete_widget(&state.client, &dashboard.id, &widget_id).await {
        Ok(0) => error_json(StatusCode::NOT_FOUND, "widget not found"),
        Ok(_) => json_ok(json!({ "ok": true })),
        Err(e) => error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to delete widget: {e}"),
        ),
    }
}

/// Bulk layout save: merge x/y/w/h into each widget's JSONB config.
#[put("/api/companies/{company_id}/dashboards/{dashboard_id}/layout")]
pub async fn save_layout(
    req: HttpRequest,
    path: web::Path<(String, String)>,
    body: web::Json<LayoutInput>,
    state: web::Data<AppState>,
) -> HttpResponse {
    let (company_id, dashboard_id) = path.into_inner();
    let dashboard = match member_dashboard(&req, &state, &company_id, &dashboard_id).await {
        Ok(d) => d,
        Err(resp) => return resp,
    };
    for e in &body.widgets {
        let x = e.x.clamp(0, 11);
        let w = e.w.clamp(1, 12 - x);
        let patch = json!({ "x": x, "y": e.y.clamp(0, 10_000), "w": w, "h": e.h.clamp(1, 8) });
        if let Err(err) = pg::merge_widget_config(&state.client, &dashboard.id, &e.id, &patch).await {
            return error_json(
                StatusCode::INTERNAL_SERVER_ERROR,
                &format!("failed to save layout: {err}"),
            );
        }
    }
    match pg::widgets_for_dashboard(&state.client, &dashboard.id).await {
        Ok(widgets) => json_ok(widgets),
        Err(e) => error_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("failed to save layout: {e}"),
        ),
    }
}
