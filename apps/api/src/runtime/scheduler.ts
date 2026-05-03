import { createServer } from "node:http";
import { describeDatabaseTarget, pool } from "../db";

const port = Number(process.env.SCHEDULER_PORT ?? 4011);
const intervalMs = Number(process.env.SCHEDULER_INTERVAL_MS ?? 300_000);

let lastRunAt: string | null = null;
let lastError: string | null = null;
let recentLoadLogCount = 0;

async function runSchedulerTick() {
  try {
    const result = await pool.query<{ count: string }>(`
      SELECT COUNT(*)::text AS count
      FROM training_load_logs
      WHERE log_date >= CURRENT_DATE - INTERVAL '14 days'
    `);

    recentLoadLogCount = Number(result.rows[0]?.count ?? 0);
    lastRunAt = new Date().toISOString();
    lastError = null;
  } catch (error) {
    lastRunAt = new Date().toISOString();
    lastError = error instanceof Error ? error.message : "Scheduler tick failed";
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
      service: "scheduler",
      database: describeDatabaseTarget(),
      lastRunAt,
      lastError,
      recentLoadLogCount,
    }),
  );
});

server.listen(port, "0.0.0.0", () => {
  void runSchedulerTick();
  setInterval(() => void runSchedulerTick(), intervalMs);
});

function shutdown() {
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
