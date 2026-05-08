import type { FastifyInstance } from "fastify";
import {
  listDeviceHealthDailySummariesForAthlete,
  upsertDeviceHealthDailySummary,
} from "../services/device-health.service";
import type { ApiGuards, HttpErrorFactory } from "./guards";
import {
  parseDeviceHealthAthleteParams,
  parseDeviceHealthSummaryBody,
} from "./device-health.schemas";

interface DeviceHealthRouteDependencies {
  guards: ApiGuards;
  httpError: HttpErrorFactory;
}

export function registerDeviceHealthRoutes(
  app: FastifyInstance,
  dependencies: DeviceHealthRouteDependencies,
) {
  app.get("/api/v1/device-health/daily-summaries", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (!user.athlete_id) {
      throw dependencies.httpError(403, "Only athlete accounts can view device health data");
    }

    return {
      summaries: await listDeviceHealthDailySummariesForAthlete(user.athlete_id),
    };
  });

  app.post("/api/v1/device-health/daily-summaries", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (!user.athlete_id) {
      throw dependencies.httpError(403, "Only athlete accounts can sync device health data");
    }

    let payload;
    try {
      payload = parseDeviceHealthSummaryBody(request.body);
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    return {
      summary: await upsertDeviceHealthDailySummary({
        athleteId: user.athlete_id,
        payload,
      }),
    };
  });

  app.get("/api/v1/coach/athletes/:athleteId/device-health", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(
        403,
        "Only coach or admin accounts can view athlete device health data",
      );
    }

    let athleteId: string;
    try {
      athleteId = parseDeviceHealthAthleteParams(request.params).athleteId;
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    await dependencies.guards.assertAthleteAccess(user, athleteId);

    return {
      summaries: await listDeviceHealthDailySummariesForAthlete(athleteId),
    };
  });
}
