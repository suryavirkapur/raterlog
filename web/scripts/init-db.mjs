// Applies schema.sql to the configured PostgreSQL database.
// Replaces the former `prisma db push`. Idempotent (uses CREATE TABLE IF NOT EXISTS).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(join(__dirname, "..", "schema.sql"), "utf8");

const url =
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5432/example";

const sql = postgres(url, { max: 1 });

try {
  await sql.unsafe(schema);
  console.log("Schema applied to", url.replace(/:\/\/.*@/, "://***@"));
} catch (err) {
  console.error("Failed to apply schema:", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
