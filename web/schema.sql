-- Raterlog PostgreSQL schema (replaces the former Prisma schema / `prisma db push`).
-- Table and column names are kept compatible with the Rust API, which queries
-- "Token" and "Channel" (with the "companyID" column) directly.

CREATE TABLE IF NOT EXISTS "User" (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  email    TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "Session" (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS "Company" (
  id      TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  billing BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS "Channel" (
  id          TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  icon        TEXT NOT NULL,
  "companyID" TEXT NOT NULL REFERENCES "Company"(id),
  PRIMARY KEY (id, "companyID")
);

CREATE TABLE IF NOT EXISTS "CompanyUser" (
  "companyID" TEXT NOT NULL REFERENCES "Company"(id),
  "userID"    TEXT NOT NULL REFERENCES "User"(id),
  PRIMARY KEY ("companyID", "userID")
);

CREATE TABLE IF NOT EXISTS "Token" (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  token       TEXT NOT NULL,
  "companyID" TEXT NOT NULL REFERENCES "Company"(id)
);

CREATE TABLE IF NOT EXISTS "Invite" (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  "companyID" TEXT NOT NULL REFERENCES "Company"(id),
  token       TEXT NOT NULL UNIQUE,
  status      TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "expiresAt" TIMESTAMPTZ NOT NULL,
  UNIQUE (email, "companyID")
);
