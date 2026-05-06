import type { FastifyInstance } from "fastify";
import {
  CoachDiaryServiceError,
  listCoachDiaryEntriesForAthlete,
  listCoachDiaryEntriesForCoachContext,
  submitCoachDiaryEntry,
} from "../services/coach-diary.service";
import type { ApiGuards, HttpErrorFactory } from "./guards";
import { readIdempotencyKey } from "./idempotency";
import { parseCoachDiaryBody } from "./coach-diary.schemas";

interface CoachDiaryRouteDependencies {
  guards: ApiGuards;
  httpError: HttpErrorFactory;
}

export function registerCoachDiaryRoutes(
  app: FastifyInstance,
  dependencies: CoachDiaryRouteDependencies,
) {
  app.get("/api/v1/coach/diary", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(403, "Only coach or admin accounts can view coach diary entries");
    }

    return {
      entries: await listCoachDiaryEntriesForCoachContext({
        coachUserId: user.id,
        role: user.role,
      }),
    };
  });

  app.get("/api/v1/diary", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (!user.athlete_id) {
      throw dependencies.httpError(403, "Only athlete accounts can view coach diary entries");
    }

    return {
      entries: await listCoachDiaryEntriesForAthlete(user.athlete_id),
    };
  });

  app.post("/api/v1/coach/diary", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(403, "Only coach or admin accounts can save coach diary entries");
    }

    let payload;
    try {
      payload = parseCoachDiaryBody(request.body);
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    await dependencies.guards.assertAthleteAccess(user, payload.athleteId);

    try {
      return {
        entry: await submitCoachDiaryEntry({
          coachUserId: user.id,
          clientRequestId: readIdempotencyKey(request.headers),
          payload,
        }),
      };
    } catch (error) {
      if (error instanceof CoachDiaryServiceError) {
        const statusCode = error.code === "assigned_plan_not_found" ||
          error.code === "diary_task_not_found"
          ? 404
          : 400;
        throw dependencies.httpError(statusCode, error.message);
      }

      throw error;
    }
  });
}
