import type { FastifyInstance } from "fastify";
import {
  getReadinessEntryForDate,
  getTodayReadinessEntry,
  listRecentReadinessEntries,
  submitReadiness,
} from "../services/readiness.service";
import type { ApiGuards, HttpErrorFactory } from "./guards";
import { readIdempotencyKey } from "./idempotency";
import {
  parseReadinessAthleteParams,
  parseReadinessBody,
  parseReadinessDateQuery,
} from "./readiness.schemas";

interface ReadinessRouteDependencies {
  guards: ApiGuards;
  httpError: HttpErrorFactory;
}

export function registerReadinessRoutes(
  app: FastifyInstance,
  dependencies: ReadinessRouteDependencies,
) {
  app.get("/api/v1/coach/athletes/:athleteId/readiness", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(
        403,
        "Only coach or admin accounts can view athlete readiness",
      );
    }

    let athleteId: string;
    try {
      athleteId = parseReadinessAthleteParams(request.params).athleteId;
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    await dependencies.guards.assertAthleteAccess(user, athleteId);

    return {
      entries: await listRecentReadinessEntries(athleteId),
    };
  });

  app.get("/api/v1/readiness/today", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (!user.athlete_id) {
      throw dependencies.httpError(403, "Only athlete accounts have readiness entries");
    }

    return {
      entry: await getTodayReadinessEntry(user.athlete_id),
    };
  });

  app.get("/api/v1/readiness/day", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (!user.athlete_id) {
      throw dependencies.httpError(403, "Only athlete accounts have readiness entries");
    }

    let entryDate: string;
    try {
      entryDate = parseReadinessDateQuery(request.query).entryDate;
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    return {
      entry: await getReadinessEntryForDate(user.athlete_id, entryDate),
    };
  });

  app.post("/api/v1/readiness", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (!user.athlete_id) {
      throw dependencies.httpError(403, "Only athlete accounts can submit readiness");
    }

    let payload;
    try {
      payload = parseReadinessBody(request.body);
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    const { entryDate, ...values } = payload;

    return {
      entry: await submitReadiness({
        athleteId: user.athlete_id,
        baselineRestingHr: user.baseline_resting_hr,
        baselineWeightKg:
          user.baseline_weight_kg !== null ? Number(user.baseline_weight_kg) : null,
        clientRequestId: readIdempotencyKey(request.headers),
        entryDate,
        values,
      }),
    };
  });
}
