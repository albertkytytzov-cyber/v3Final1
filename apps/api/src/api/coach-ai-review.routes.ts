import type { FastifyInstance } from "fastify";
import {
  buildCoachDayAiReview,
  getCoachAiReviewStatus,
  listCoachDayAiReviewsForCoachContext,
  runCoachAiReviewDiagnostic,
  saveCoachDayAiReview,
} from "../services/coach-ai-review.service";
import type { ApiGuards, HttpErrorFactory } from "./guards";
import {
  parseCoachDayAiAthleteParams,
  parseCoachDayAiReviewBody,
} from "./coach-ai-review.schemas";

interface CoachAiReviewRouteDependencies {
  guards: ApiGuards;
  httpError: HttpErrorFactory;
}

export function registerCoachAiReviewRoutes(
  app: FastifyInstance,
  dependencies: CoachAiReviewRouteDependencies,
) {
  async function requireCoachAiReviewUser(request: Parameters<ApiGuards["requireUser"]>[0]) {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(403, "Only coach or admin accounts can use AI day review");
    }

    return user;
  }

  app.get("/api/v1/coach/ai-day-review/status", async (request) => {
    await requireCoachAiReviewUser(request);

    return {
      status: getCoachAiReviewStatus(),
    };
  });

  app.post("/api/v1/coach/ai-day-review/test", async (request) => {
    await requireCoachAiReviewUser(request);

    return runCoachAiReviewDiagnostic();
  });

  app.get("/api/v1/coach/ai-day-reviews", async (request) => {
    const user = await requireCoachAiReviewUser(request);

    return {
      reviews: await listCoachDayAiReviewsForCoachContext({
        coachUserId: user.id,
        role: user.role,
      }),
    };
  });

  app.post("/api/v1/coach/athletes/:athleteId/ai-day-review", async (request) => {
    const user = await requireCoachAiReviewUser(request);

    let athleteId: string;
    try {
      athleteId = parseCoachDayAiAthleteParams(request.params).athleteId;
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    let payload;
    try {
      payload = parseCoachDayAiReviewBody(request.body);
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    await dependencies.guards.assertAthleteAccess(user, athleteId);
    const review = await buildCoachDayAiReview({
      athleteId,
      dayPayload: payload.dayPayload,
      entryDate: payload.entryDate,
    });

    return {
      review: await saveCoachDayAiReview({
        coachUserId: user.id,
        review,
      }),
    };
  });
}
