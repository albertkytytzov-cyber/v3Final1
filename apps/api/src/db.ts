import "./env";
import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/training_platform";

export function describeDatabaseTarget() {
  try {
    const target = new URL(connectionString);
    const databaseName = target.pathname.replace(/^\//, "") || "postgres";
    return `${target.hostname}:${target.port || "5432"}/${databaseName}`;
  } catch {
    return "DATABASE_URL";
  }
}

export const pool = new Pool({
  connectionString,
});
