import postgres from "postgres";

const url =
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5432/example";

// Single shared connection pool for the server runtime.
export const sql = postgres(url);
