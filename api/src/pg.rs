use chrono::{DateTime, Duration, Utc};
use serde::Serialize;
use tokio_postgres::Client;

#[derive(Debug, Serialize, Clone)]
pub struct User {
    pub id: String,
    pub name: String,
    pub email: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct Company {
    pub id: String,
    pub name: String,
    pub billing: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Channel {
    pub id: String,
    pub name: String,
    pub icon: String,
    #[serde(rename = "companyID")]
    pub company_id: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Token {
    pub id: i32,
    pub name: String,
    pub token: String,
    #[serde(rename = "companyID")]
    pub company_id: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct Member {
    pub id: String,
    pub name: String,
    pub email: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Invite {
    pub id: String,
    pub email: String,
    #[serde(rename = "companyID")]
    pub company_id: String,
    pub token: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub company_name: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Insight {
    pub id: String,
    #[serde(rename = "companyID")]
    pub company_id: String,
    pub title: String,
    pub value: String,
    pub icon: Option<String>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct IdentifiedUser {
    pub id: String,
    #[serde(rename = "companyID")]
    pub company_id: String,
    pub user_id: String,
    pub properties: serde_json::Value,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Clone)]
pub struct CompanyDetail {
    pub company: Company,
    pub channels: Vec<Channel>,
    pub tokens: Vec<Token>,
    pub members: Vec<Member>,
    pub invites: Vec<Invite>,
    pub insights: Vec<Insight>,
    #[serde(rename = "identifiedUsers")]
    pub identified_users: Vec<IdentifiedUser>,
}

pub async fn ensure_schema(client: &Client) -> Result<(), tokio_postgres::Error> {
    client
        .batch_execute(
            r#"
            CREATE TABLE IF NOT EXISTS "User" (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS "Session" (
                id TEXT PRIMARY KEY,
                "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
                "expiresAt" TIMESTAMPTZ NOT NULL
            );
            CREATE TABLE IF NOT EXISTS "Company" (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                billing BOOLEAN NOT NULL DEFAULT FALSE
            );
            CREATE TABLE IF NOT EXISTS "Channel" (
                id TEXT NOT NULL,
                name TEXT NOT NULL,
                icon TEXT NOT NULL,
                "companyID" TEXT NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
                PRIMARY KEY (id, "companyID")
            );
            CREATE UNIQUE INDEX IF NOT EXISTS channel_id_idx ON "Channel"(id);
            CREATE TABLE IF NOT EXISTS "CompanyUser" (
                "companyID" TEXT NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
                "userID" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
                PRIMARY KEY ("companyID", "userID")
            );
            CREATE TABLE IF NOT EXISTS "Token" (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                token TEXT NOT NULL,
                "companyID" TEXT NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS "Invite" (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL,
                "companyID" TEXT NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
                token TEXT NOT NULL UNIQUE,
                status TEXT NOT NULL DEFAULT 'pending',
                "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                "expiresAt" TIMESTAMPTZ NOT NULL,
                UNIQUE (email, "companyID")
            );
            CREATE TABLE IF NOT EXISTS "Insight" (
                id TEXT PRIMARY KEY,
                "companyID" TEXT NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                value TEXT NOT NULL,
                icon TEXT,
                "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE ("companyID", title)
            );
            CREATE TABLE IF NOT EXISTS "IdentifiedUser" (
                id TEXT PRIMARY KEY,
                "companyID" TEXT NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
                "userId" TEXT NOT NULL,
                properties JSONB NOT NULL DEFAULT '{}'::jsonb,
                "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE ("companyID", "userId")
            );
            "#,
        )
        .await
}

pub async fn create_user(
    client: &Client,
    id: &str,
    name: &str,
    email: &str,
    password: &str,
) -> Result<User, tokio_postgres::Error> {
    client
        .execute(
            r#"INSERT INTO "User" (id, name, email, password) VALUES ($1, $2, $3, $4)"#,
            &[&id, &name, &email, &password],
        )
        .await?;
    Ok(User {
        id: id.to_string(),
        name: name.to_string(),
        email: email.to_string(),
    })
}

pub async fn user_by_email(
    client: &Client,
    email: &str,
) -> Result<Option<(User, String)>, tokio_postgres::Error> {
    let row = client
        .query_opt(
            r#"SELECT id, name, email, password FROM "User" WHERE email = $1"#,
            &[&email],
        )
        .await?;
    Ok(row.map(|row| {
        (
            User {
                id: row.get(0),
                name: row.get(1),
                email: row.get(2),
            },
            row.get::<_, String>(3),
        )
    }))
}

pub async fn user_by_session(
    client: &Client,
    session_id: &str,
) -> Result<Option<User>, tokio_postgres::Error> {
    let row = client
        .query_opt(
            r#"SELECT u.id, u.name, u.email
               FROM "Session" s
               JOIN "User" u ON u.id = s."userId"
               WHERE s.id = $1 AND s."expiresAt" > NOW()"#,
            &[&session_id],
        )
        .await?;
    Ok(row.map(|row| User {
        id: row.get(0),
        name: row.get(1),
        email: row.get(2),
    }))
}

pub async fn create_session(
    client: &Client,
    id: &str,
    user_id: &str,
    expires_at: DateTime<Utc>,
) -> Result<(), tokio_postgres::Error> {
    client
        .execute(
            r#"INSERT INTO "Session" (id, "userId", "expiresAt") VALUES ($1, $2, $3)"#,
            &[&id, &user_id, &expires_at],
        )
        .await?;
    Ok(())
}

pub async fn delete_session(client: &Client, id: &str) -> Result<(), tokio_postgres::Error> {
    client
        .execute(r#"DELETE FROM "Session" WHERE id = $1"#, &[&id])
        .await?;
    Ok(())
}

pub async fn companies_for_user(
    client: &Client,
    user_id: &str,
) -> Result<Vec<Company>, tokio_postgres::Error> {
    let rows = client
        .query(
            r#"SELECT c.id, c.name, c.billing
               FROM "Company" c
               JOIN "CompanyUser" cu ON cu."companyID" = c.id
               WHERE cu."userID" = $1
               ORDER BY c.name"#,
            &[&user_id],
        )
        .await?;
    Ok(rows
        .into_iter()
        .map(|row| Company {
            id: row.get(0),
            name: row.get(1),
            billing: row.get(2),
        })
        .collect())
}

pub async fn create_company(
    client: &Client,
    id: &str,
    name: &str,
    owner_id: &str,
) -> Result<Company, tokio_postgres::Error> {
    client
        .execute(
            r#"INSERT INTO "Company" (id, name, billing) VALUES ($1, $2, false)"#,
            &[&id, &name],
        )
        .await?;
    client
        .execute(
            r#"INSERT INTO "CompanyUser" ("companyID", "userID") VALUES ($1, $2)"#,
            &[&id, &owner_id],
        )
        .await?;
    Ok(Company {
        id: id.to_string(),
        name: name.to_string(),
        billing: false,
    })
}

pub async fn company_by_id(
    client: &Client,
    id: &str,
) -> Result<Option<Company>, tokio_postgres::Error> {
    let row = client
        .query_opt(
            r#"SELECT id, name, billing FROM "Company" WHERE id = $1"#,
            &[&id],
        )
        .await?;
    Ok(row.map(|row| Company {
        id: row.get(0),
        name: row.get(1),
        billing: row.get(2),
    }))
}

pub async fn company_by_name(
    client: &Client,
    name: &str,
) -> Result<Option<Company>, tokio_postgres::Error> {
    let row = client
        .query_opt(
            r#"SELECT id, name, billing FROM "Company" WHERE lower(name) = lower($1)"#,
            &[&name],
        )
        .await?;
    Ok(row.map(|row| Company {
        id: row.get(0),
        name: row.get(1),
        billing: row.get(2),
    }))
}

pub async fn update_company(
    client: &Client,
    id: &str,
    name: &str,
) -> Result<Option<Company>, tokio_postgres::Error> {
    let row = client
        .query_opt(
            r#"UPDATE "Company" SET name = $2 WHERE id = $1 RETURNING id, name, billing"#,
            &[&id, &name],
        )
        .await?;
    Ok(row.map(|row| Company {
        id: row.get(0),
        name: row.get(1),
        billing: row.get(2),
    }))
}

pub async fn is_company_member(
    client: &Client,
    company_id: &str,
    user_id: &str,
) -> Result<bool, tokio_postgres::Error> {
    let row = client
        .query_one(
            r#"SELECT EXISTS(SELECT 1 FROM "CompanyUser" WHERE "companyID" = $1 AND "userID" = $2)"#,
            &[&company_id, &user_id],
        )
        .await?;
    Ok(row.get(0))
}

pub async fn channels_for_company(
    client: &Client,
    company_id: &str,
) -> Result<Vec<Channel>, tokio_postgres::Error> {
    let rows = client
        .query(
            r#"SELECT id, name, icon, "companyID" FROM "Channel" WHERE "companyID" = $1 ORDER BY name"#,
            &[&company_id],
        )
        .await?;
    Ok(rows
        .into_iter()
        .map(|row| Channel {
            id: row.get(0),
            name: row.get(1),
            icon: row.get(2),
            company_id: row.get(3),
        })
        .collect())
}

pub async fn channel_by_id(
    client: &Client,
    id: &str,
) -> Result<Option<Channel>, tokio_postgres::Error> {
    let row = client
        .query_opt(
            r#"SELECT id, name, icon, "companyID" FROM "Channel" WHERE id = $1"#,
            &[&id],
        )
        .await?;
    Ok(row.map(|row| Channel {
        id: row.get(0),
        name: row.get(1),
        icon: row.get(2),
        company_id: row.get(3),
    }))
}

pub async fn channel_by_name(
    client: &Client,
    company_id: &str,
    name: &str,
) -> Result<Option<Channel>, tokio_postgres::Error> {
    let row = client
        .query_opt(
            r#"SELECT id, name, icon, "companyID" FROM "Channel" WHERE "companyID" = $1 AND lower(name) = lower($2)"#,
            &[&company_id, &name],
        )
        .await?;
    Ok(row.map(|row| Channel {
        id: row.get(0),
        name: row.get(1),
        icon: row.get(2),
        company_id: row.get(3),
    }))
}

pub async fn create_channel(
    client: &Client,
    id: &str,
    company_id: &str,
    name: &str,
    icon: &str,
) -> Result<Channel, tokio_postgres::Error> {
    client
        .execute(
            r#"INSERT INTO "Channel" (id, name, icon, "companyID") VALUES ($1, $2, $3, $4)"#,
            &[&id, &name, &icon, &company_id],
        )
        .await?;
    Ok(Channel {
        id: id.to_string(),
        name: name.to_string(),
        icon: icon.to_string(),
        company_id: company_id.to_string(),
    })
}

pub async fn tokens_for_company(
    client: &Client,
    company_id: &str,
) -> Result<Vec<Token>, tokio_postgres::Error> {
    let rows = client
        .query(
            r#"SELECT id, name, token, "companyID" FROM "Token" WHERE "companyID" = $1 ORDER BY id DESC"#,
            &[&company_id],
        )
        .await?;
    Ok(rows
        .into_iter()
        .map(|row| Token {
            id: row.get(0),
            name: row.get(1),
            token: row.get(2),
            company_id: row.get(3),
        })
        .collect())
}

pub async fn create_token(
    client: &Client,
    company_id: &str,
    name: &str,
    token: &str,
) -> Result<Token, tokio_postgres::Error> {
    let row = client
        .query_one(
            r#"INSERT INTO "Token" (name, token, "companyID") VALUES ($1, $2, $3) RETURNING id, name, token, "companyID""#,
            &[&name, &token, &company_id],
        )
        .await?;
    Ok(Token {
        id: row.get(0),
        name: row.get(1),
        token: row.get(2),
        company_id: row.get(3),
    })
}

pub async fn delete_token(
    client: &Client,
    company_id: &str,
    token_id: i32,
) -> Result<u64, tokio_postgres::Error> {
    client
        .execute(
            r#"DELETE FROM "Token" WHERE id = $1 AND "companyID" = $2"#,
            &[&token_id, &company_id],
        )
        .await
}

pub async fn token_company(
    client: &Client,
    token: &str,
) -> Result<Option<String>, tokio_postgres::Error> {
    let row = client
        .query_opt(
            r#"SELECT "companyID" FROM "Token" WHERE token = $1"#,
            &[&token],
        )
        .await?;
    Ok(row.map(|row| row.get(0)))
}

pub async fn verify_token_for_channel(
    client: &Client,
    token: &str,
    channel_id: &str,
) -> Result<bool, tokio_postgres::Error> {
    let row = client
        .query_one(
            r#"SELECT EXISTS(
                SELECT 1 FROM "Token" t
                JOIN "Channel" c ON t."companyID" = c."companyID"
                WHERE t.token = $1 AND c.id = $2
            )"#,
            &[&token, &channel_id],
        )
        .await?;
    Ok(row.get(0))
}

pub async fn user_can_read_channel(
    client: &Client,
    user_id: &str,
    channel_id: &str,
) -> Result<bool, tokio_postgres::Error> {
    let row = client
        .query_one(
            r#"SELECT EXISTS(
                SELECT 1 FROM "Channel" c
                JOIN "CompanyUser" cu ON cu."companyID" = c."companyID"
                WHERE c.id = $1 AND cu."userID" = $2
            )"#,
            &[&channel_id, &user_id],
        )
        .await?;
    Ok(row.get(0))
}

pub async fn members(
    client: &Client,
    company_id: &str,
) -> Result<Vec<Member>, tokio_postgres::Error> {
    let rows = client
        .query(
            r#"SELECT u.id, u.name, u.email
               FROM "CompanyUser" cu
               JOIN "User" u ON u.id = cu."userID"
               WHERE cu."companyID" = $1
               ORDER BY u.name"#,
            &[&company_id],
        )
        .await?;
    Ok(rows
        .into_iter()
        .map(|row| Member {
            id: row.get(0),
            name: row.get(1),
            email: row.get(2),
        })
        .collect())
}

pub async fn create_invite(
    client: &Client,
    id: &str,
    email: &str,
    company_id: &str,
    token: &str,
) -> Result<Invite, tokio_postgres::Error> {
    let expires_at = Utc::now() + Duration::days(7);
    let row = client
        .query_one(
            r#"INSERT INTO "Invite" (id, email, "companyID", token, status, "expiresAt")
               VALUES ($1, $2, $3, $4, 'pending', $5)
               RETURNING id, email, "companyID", token, status, "createdAt", "expiresAt""#,
            &[&id, &email, &company_id, &token, &expires_at],
        )
        .await?;
    Ok(invite_from_row(&row, None))
}

pub async fn invites_for_company(
    client: &Client,
    company_id: &str,
) -> Result<Vec<Invite>, tokio_postgres::Error> {
    let rows = client
        .query(
            r#"SELECT id, email, "companyID", token, status, "createdAt", "expiresAt"
               FROM "Invite" WHERE "companyID" = $1 ORDER BY "createdAt" DESC"#,
            &[&company_id],
        )
        .await?;
    Ok(rows.iter().map(|row| invite_from_row(row, None)).collect())
}

pub async fn invite_by_token(
    client: &Client,
    token: &str,
) -> Result<Option<Invite>, tokio_postgres::Error> {
    let row = client
        .query_opt(
            r#"SELECT i.id, i.email, i."companyID", i.token, i.status, i."createdAt", i."expiresAt", c.name
               FROM "Invite" i
               JOIN "Company" c ON c.id = i."companyID"
               WHERE i.token = $1"#,
            &[&token],
        )
        .await?;
    Ok(row.map(|row| invite_from_row(&row, Some(row.get(7)))))
}

pub async fn delete_invite(
    client: &Client,
    company_id: &str,
    invite_id: &str,
) -> Result<u64, tokio_postgres::Error> {
    client
        .execute(
            r#"DELETE FROM "Invite" WHERE id = $1 AND "companyID" = $2"#,
            &[&invite_id, &company_id],
        )
        .await
}

pub async fn accept_invite(
    client: &Client,
    token: &str,
    user_id: &str,
    user_email: &str,
) -> Result<Result<Invite, String>, tokio_postgres::Error> {
    let Some(invite) = invite_by_token(client, token).await? else {
        return Ok(Err("invite not found".into()));
    };
    if invite.status != "pending" {
        return Ok(Err("invite already used".into()));
    }
    if invite.expires_at < Utc::now() {
        return Ok(Err("invite expired".into()));
    }
    if invite.email.to_lowercase() != user_email.to_lowercase() {
        return Ok(Err("invite email does not match this account".into()));
    }
    client
        .execute(
            r#"INSERT INTO "CompanyUser" ("companyID", "userID") VALUES ($1, $2)
               ON CONFLICT ("companyID", "userID") DO NOTHING"#,
            &[&invite.company_id, &user_id],
        )
        .await?;
    client
        .execute(
            r#"UPDATE "Invite" SET status = 'accepted' WHERE id = $1"#,
            &[&invite.id],
        )
        .await?;
    let mut accepted = invite;
    accepted.status = "accepted".into();
    Ok(Ok(accepted))
}

pub async fn insights_for_company(
    client: &Client,
    company_id: &str,
) -> Result<Vec<Insight>, tokio_postgres::Error> {
    let rows = client
        .query(
            r#"SELECT id, "companyID", title, value, icon, "updatedAt" FROM "Insight" WHERE "companyID" = $1 ORDER BY title"#,
            &[&company_id],
        )
        .await?;
    Ok(rows.iter().map(insight_from_row).collect())
}

pub async fn upsert_insight(
    client: &Client,
    id: &str,
    company_id: &str,
    title: &str,
    value: &str,
    icon: Option<&str>,
) -> Result<Insight, tokio_postgres::Error> {
    let row = client
        .query_one(
            r#"INSERT INTO "Insight" (id, "companyID", title, value, icon, "updatedAt")
               VALUES ($1, $2, $3, $4, $5, NOW())
               ON CONFLICT ("companyID", title)
               DO UPDATE SET value = EXCLUDED.value, icon = COALESCE(EXCLUDED.icon, "Insight".icon), "updatedAt" = NOW()
               RETURNING id, "companyID", title, value, icon, "updatedAt""#,
            &[&id, &company_id, &title, &value, &icon],
        )
        .await?;
    Ok(insight_from_row(&row))
}

pub async fn mutate_insight(
    client: &Client,
    company_id: &str,
    title: &str,
    delta: f64,
    icon: Option<&str>,
    new_id: &str,
) -> Result<Insight, tokio_postgres::Error> {
    if let Some(existing) = client
        .query_opt(
            r#"SELECT id, value FROM "Insight" WHERE "companyID" = $1 AND title = $2"#,
            &[&company_id, &title],
        )
        .await?
    {
        let id: String = existing.get(0);
        let current: String = existing.get(1);
        let next = current.parse::<f64>().unwrap_or(0.0) + delta;
        let next_s = if next.fract() == 0.0 {
            format!("{}", next as i64)
        } else {
            format!("{next}")
        };
        let row = client
            .query_one(
                r#"UPDATE "Insight" SET value = $3, icon = COALESCE($4, icon), "updatedAt" = NOW()
                   WHERE id = $1 AND "companyID" = $2
                   RETURNING id, "companyID", title, value, icon, "updatedAt""#,
                &[&id, &company_id, &next_s, &icon],
            )
            .await?;
        Ok(insight_from_row(&row))
    } else {
        upsert_insight(client, new_id, company_id, title, &delta.to_string(), icon).await
    }
}

pub async fn identified_users(
    client: &Client,
    company_id: &str,
) -> Result<Vec<IdentifiedUser>, tokio_postgres::Error> {
    let rows = client
        .query(
            r#"SELECT id, "companyID", "userId", properties, "updatedAt"
               FROM "IdentifiedUser" WHERE "companyID" = $1 ORDER BY "updatedAt" DESC"#,
            &[&company_id],
        )
        .await?;
    Ok(rows.iter().map(identified_from_row).collect())
}

pub async fn upsert_identified_user(
    client: &Client,
    id: &str,
    company_id: &str,
    user_id: &str,
    properties: serde_json::Value,
) -> Result<IdentifiedUser, tokio_postgres::Error> {
    let row = client
        .query_one(
            r#"INSERT INTO "IdentifiedUser" (id, "companyID", "userId", properties, "updatedAt")
               VALUES ($1, $2, $3, $4, NOW())
               ON CONFLICT ("companyID", "userId")
               DO UPDATE SET properties = "IdentifiedUser".properties || EXCLUDED.properties, "updatedAt" = NOW()
               RETURNING id, "companyID", "userId", properties, "updatedAt""#,
            &[&id, &company_id, &user_id, &properties],
        )
        .await?;
    Ok(identified_from_row(&row))
}

pub async fn company_detail(
    client: &Client,
    company_id: &str,
) -> Result<Option<CompanyDetail>, tokio_postgres::Error> {
    let Some(company) = company_by_id(client, company_id).await? else {
        return Ok(None);
    };
    Ok(Some(CompanyDetail {
        company,
        channels: channels_for_company(client, company_id).await?,
        tokens: tokens_for_company(client, company_id).await?,
        members: members(client, company_id).await?,
        invites: invites_for_company(client, company_id).await?,
        insights: insights_for_company(client, company_id).await?,
        identified_users: identified_users(client, company_id).await?,
    }))
}

fn invite_from_row(row: &tokio_postgres::Row, company_name: Option<String>) -> Invite {
    Invite {
        id: row.get(0),
        email: row.get(1),
        company_id: row.get(2),
        token: row.get(3),
        status: row.get(4),
        created_at: row.get(5),
        expires_at: row.get(6),
        company_name,
    }
}

fn insight_from_row(row: &tokio_postgres::Row) -> Insight {
    Insight {
        id: row.get(0),
        company_id: row.get(1),
        title: row.get(2),
        value: row.get(3),
        icon: row.get(4),
        updated_at: row.get(5),
    }
}

fn identified_from_row(row: &tokio_postgres::Row) -> IdentifiedUser {
    IdentifiedUser {
        id: row.get(0),
        company_id: row.get(1),
        user_id: row.get(2),
        properties: row.get(3),
        updated_at: row.get(4),
    }
}
