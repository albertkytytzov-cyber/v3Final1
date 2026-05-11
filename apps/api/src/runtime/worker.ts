import { createServer } from "node:http";
import { describeDatabaseTarget, pool } from "../db";
import { buildAnalyticsOverviewForAthlete } from "../services/analytics/analytics-report.service";
import {
  countPendingAnalyticsDirtyFlags,
  listPendingAnalyticsDirtyFlags,
  markAnalyticsDirtyFailed,
  markAnalyticsDirtyProcessed,
} from "../services/analytics/analytics-query.service";

const port = Number(process.env.WORKER_PORT ?? 4010);
const intervalMs = Number(process.env.WORKER_INTERVAL_MS ?? 60_000);
const analyticsBatchSize = Number(process.env.WORKER_ANALYTICS_BATCH_SIZE ?? 8);

let lastRunAt: string | null = null;
let lastError: string | null = null;
let deletedSessions = 0;
let analyticsJobsProcessed = 0;
let analyticsJobsFailed = 0;
let analyticsJobsPending = 0;

async function processAnalyticsDirtyFlags() {
  const dirtyFlags = await listPendingAnalyticsDirtyFlags(analyticsBatchSize);
  let processedCount = 0;
  let failedCount = 0;

  for (const dirtyFlag of dirtyFlags) {
    try {
      await buildAnalyticsOverviewForAthlete(
        dirtyFlag.athleteId,
        dirtyFlag.referenceDate,
      );
      await markAnalyticsDirtyProcessed({
        athleteId: dirtyFlag.athleteId,
        referenceDate: dirtyFlag.referenceDate,
      });
      processedCount += 1;
    } catch (error) {
      failedCount += 1;
      await markAnalyticsDirtyFailed({
        athleteId: dirtyFlag.athleteId,
        referenceDate: dirtyFlag.referenceDate,
        errorMessage:
          error instanceof Error ? error.message : "Analytics cache rebuild failed",
      });
    }
  }

  analyticsJobsProcessed = processedCount;
  analyticsJobsFailed = failedCount;
  analyticsJobsPending = await countPendingAnalyticsDirtyFlags();
}

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
    await processAnalyticsDirtyFlags();
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
      analyticsJobsProcessed,
      analyticsJobsFailed,
      analyticsJobsPending,
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
