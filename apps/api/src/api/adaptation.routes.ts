import type { FastifyInstance } from "fastify";
import { buildAdaptedPlanForAthlete } from "../services/adaptation.service";
import type { ApiGuards, HttpErrorFactory } from "./guards";
import { parseAdaptationAthleteParams } from "./adaptation.schemas";

interface AdaptationRouteDependencies {
  guards: ApiGuards;
  httpError: HttpErrorFactory;
}

export function registerAdaptationRoutes(
  app: FastifyInstance,
  dependencies: AdaptationRouteDependencies,
) {
  app.get("/api/v1/coach/athletes/:athleteId/adapted-plan", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(403, "Only coach or admin accounts can view adapted plans");
    }

    let athleteId: string;
    try {
      athleteId = parseAdaptationAthleteParams(request.params).athleteId;
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    await dependencies.guards.assertAthleteAccess(user, athleteId);

    const adaptation = await buildAdaptedPlanForAthlete(athleteId);

    return {
      adaptedPlan: adaptation?.adaptedPlan ?? null,
    };
  });

  app.get("/api/v1/adapted-plan", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (!user.athlete_id) {
      throw dependencies.httpError(403, "Only athlete accounts can view adapted plans");
    }

    const adaptation = await buildAdaptedPlanForAthlete(user.athlete_id);

    return {
      adaptedPlan: adaptation?.adaptedPlan ?? null,
    };
  });
}
