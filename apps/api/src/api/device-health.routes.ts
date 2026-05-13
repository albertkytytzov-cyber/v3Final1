import type { FastifyInstance } from "fastify";
import {
  deleteDeviceWorkoutLink,
  linkDeviceWorkoutToPlanBlock,
  listDeviceHealthDailySummariesForAthlete,
  listDeviceWorkoutLinksForAthlete,
  listDeviceWorkoutsForAthlete,
  syncDeviceWorkouts,
  upsertDeviceHealthDailySummary,
} from "../services/device-health.service";
import type { ApiGuards, HttpErrorFactory } from "./guards";
import {
  parseDeviceHealthAthleteParams,
  parseDeviceHealthSummariesQuery,
  parseDeviceHealthSummaryBody,
  parseDeviceWorkoutLinkBody,
  parseDeviceWorkoutLinkParams,
  parseDeviceWorkoutsQuery,
  parseDeviceWorkoutsSyncBody,
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

  app.get("/api/v1/device-health/workouts", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (!user.athlete_id) {
      throw dependencies.httpError(403, "Only athlete accounts can view device workouts");
    }

    let query;
    try {
      query = parseDeviceWorkoutsQuery(request.query);
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    return {
      workouts: await listDeviceWorkoutsForAthlete(user.athlete_id, query.entryDate),
    };
  });

  app.post("/api/v1/device-health/workouts", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (!user.athlete_id) {
      throw dependencies.httpError(403, "Only athlete accounts can sync device workouts");
    }

    let payload;
    try {
      payload = parseDeviceWorkoutsSyncBody(request.body);
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    return {
      workouts: await syncDeviceWorkouts({
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
    let query: { entryDate?: string };
    try {
      athleteId = parseDeviceHealthAthleteParams(request.params).athleteId;
      query = parseDeviceHealthSummariesQuery(request.query);
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    await dependencies.guards.assertAthleteAccess(user, athleteId);

    return {
      summaries: await listDeviceHealthDailySummariesForAthlete(
        athleteId,
        query.entryDate ? 1 : undefined,
        query.entryDate,
      ),
    };
  });

  app.get("/api/v1/coach/athletes/:athleteId/device-workouts", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(
        403,
        "Only coach or admin accounts can view athlete device workouts",
      );
    }

    let athleteId: string;
    let query;
    try {
      athleteId = parseDeviceHealthAthleteParams(request.params).athleteId;
      query = parseDeviceWorkoutsQuery(request.query);
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    await dependencies.guards.assertAthleteAccess(user, athleteId);

    return {
      links: await listDeviceWorkoutLinksForAthlete(athleteId, query.entryDate),
      workouts: await listDeviceWorkoutsForAthlete(athleteId, query.entryDate),
    };
  });

  app.post("/api/v1/coach/athletes/:athleteId/device-workout-links", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(
        403,
        "Only coach or admin accounts can link athlete device workouts",
      );
    }

    let athleteId: string;
    let payload;
    try {
      athleteId = parseDeviceHealthAthleteParams(request.params).athleteId;
      payload = parseDeviceWorkoutLinkBody(request.body);
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    await dependencies.guards.assertAthleteAccess(user, athleteId);

    try {
      return {
        link: await linkDeviceWorkoutToPlanBlock({
          athleteId,
          linkedByUserId: user.id,
          payload,
        }),
      };
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }
  });

  app.delete("/api/v1/coach/athletes/:athleteId/device-workout-links/:linkId", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(
        403,
        "Only coach or admin accounts can unlink athlete device workouts",
      );
    }

    let athleteId: string;
    let linkId: string;
    try {
      ({ athleteId, linkId } = parseDeviceWorkoutLinkParams(request.params));
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    await dependencies.guards.assertAthleteAccess(user, athleteId);

    const deleted = await deleteDeviceWorkoutLink({ athleteId, linkId });
    if (!deleted) {
      throw dependencies.httpError(404, "Device workout link was not found");
    }

    return { ok: true };
  });
}
