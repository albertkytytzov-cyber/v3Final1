import { createServer } from "node:http";
import { describeDatabaseTarget, pool } from "../db";

const port = Number(process.env.WORKER_PORT ?? 4010);
const intervalMs = Number(process.env.WORKER_INTERVAL_MS ?? 60_000);

let lastRunAt: string | null = null;
let lastError: string | null = null;
let deletedSessions = 0;

async function runWorkerTick() {
  try {
    const result = await pool.query<{ deleted_count: string }>(`
      WITH deleted AS (
        DELETE FROM user_sessions
        WHERE expires_at < NOW()
        RETURNING id
      )
      SELECT COUNT(*)::text AS deleted_count FROM deleted
    `);

    deletedSessions = Number(result.rows[0]?.deleted_count ?? 0);
    lastRunAt = new Date().toISOString();
    lastError = null;
  } catch (error) {
    lastRunAt = new Date().toISOString();
    lastError = error instanceof Error ? error.message : "Worker tick failed";
  }
}

const server = createServer((request, response) => {
  if (request.url !== "/health") {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "not_found" }));
    return;
  }

  response.writeHead(lastError ? 503 : 200, { "content-type": "application/json" });
  response.end(
    JSON.stringify({
      status: lastError ? "degraded" : "ok",
      service: "worker",
      database: describeDatabaseTarget(),
      lastRunAt,
      lastError,
      deletedSessions,
    }),
  );
});

server.listen(port, "0.0.0.0", () => {
  void runWorkerTick();
  setInterval(() => void runWorkerTick(), intervalMs);
});

function shutdown() {
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
