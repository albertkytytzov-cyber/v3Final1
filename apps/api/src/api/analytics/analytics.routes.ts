import type {
  AnalyticsCoachActionDecisionPayload,
  CoachAthleteProfilePayload,
} from "@training-platform/shared";
import type { FastifyInstance } from "fastify";
import {
  buildAnalyticsOverviewForAthlete,
} from "../../services/analytics/analytics-report.service";
import {
  attachCoachAthlete,
  buildCoachAnalyticsOverview,
  listAvailableCoachAthletes,
  listCoachAthletes,
  saveCoachAthleteProfile,
  saveCoachAnalyticsDecision,
} from "../../services/analytics/coach-dashboard.service";
import type { ApiGuards, HttpErrorFactory } from "../guards";
import { readIdempotencyKey } from "../idempotency";
import {
  parseAnalyticsAthleteParams,
  parseAnalyticsDecisionBody,
  parseCoachAthleteProfileBody,
} from "./analytics.schemas";

interface AnalyticsRouteDependencies {
  guards: ApiGuards;
  httpError: HttpErrorFactory;
}

export function registerAnalyticsRoutes(
  app: FastifyInstance,
  dependencies: AnalyticsRouteDependencies,
) {
  app.get("/api/v1/coach/athletes", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(403, "Only coach or admin accounts can view athlete lists");
    }

    return {
      athletes: await listCoachAthletes({
        coachUserId: user.id,
        role: user.role,
      }),
    };
  });

  app.get("/api/v1/coach/athletes/available", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(403, "Only coach or admin accounts can view available athletes");
    }

    return {
      athletes: await listAvailableCoachAthletes(),
    };
  });

  app.post("/api/v1/coach/athletes/:athleteId/assign", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(403, "Only coach or admin accounts can attach athletes");
    }

    let athleteId: string;
    try {
      athleteId = parseAnalyticsAthleteParams(request.params).athleteId;
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    const result = await attachCoachAthlete({
      coachUserId: user.id,
      athleteId,
    });

    if (result.status === "not_found") {
      throw dependencies.httpError(404, "Athlete was not found");
    }

    if (result.status === "already_assigned") {
      throw dependencies.httpError(409, "Athlete is already assigned to another coach");
    }

    return {
      athlete: result.athlete,
    };
  });

  app.patch("/api/v1/coach/athletes/:athleteId/profile", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(403, "Only coach or admin accounts can update athlete profiles");
    }

    let athleteId: string;
    let profile: CoachAthleteProfilePayload;
    try {
      athleteId = parseAnalyticsAthleteParams(request.params).athleteId;
      profile = parseCoachAthleteProfileBody(request.body);
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    await dependencies.guards.assertAthleteAccess(user, athleteId);

    const athlete = await saveCoachAthleteProfile({
      athleteId,
      profile,
    });

    if (!athlete) {
      throw dependencies.httpError(404, "Athlete was not found");
    }

    return { athlete };
  });

  app.get("/api/v1/coach/athletes/:athleteId/analytics", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(403, "Only coach or admin accounts can view analytics");
    }

    let athleteId: string;
    try {
      athleteId = parseAnalyticsAthleteParams(request.params).athleteId;
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    await dependencies.guards.assertAthleteAccess(user, athleteId);

    return {
      analytics: await buildCoachAnalyticsOverview(athleteId),
    };
  });

  app.post("/api/v1/coach/athletes/:athleteId/analytics-decisions", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(403, "Only coach or admin accounts can log analytics decisions");
    }

    let athleteId: string;
    let body: AnalyticsCoachActionDecisionPayload;
    try {
      athleteId = parseAnalyticsAthleteParams(request.params).athleteId;
      body = parseAnalyticsDecisionBody(request.body);
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    await dependencies.guards.assertAthleteAccess(user, athleteId);

    if (
      !body.suggestionId ||
      !body.suggestionTitle ||
      !body.suggestionLevel ||
      !body.sourceCode ||
      !body.weekStartDate ||
      !body.decisionStatus
    ) {
      throw dependencies.httpError(
        400,
        "suggestionId, suggestionTitle, suggestionLevel, sourceCode, weekStartDate and decisionStatus are required",
      );
    }

    if (!["applied", "not_applied"].includes(body.decisionStatus)) {
      throw dependencies.httpError(400, "decisionStatus must be applied or not_applied");
    }

    if (
      body.outcome !== undefined &&
      body.outcome !== null &&
      !["pending", "positive", "neutral", "negative"].includes(body.outcome)
    ) {
      throw dependencies.httpError(400, "outcome must be pending, positive, neutral or negative");
    }

    return saveCoachAnalyticsDecision({
      athleteId,
      coachUserId: user.id,
      clientRequestId: readIdempotencyKey(request.headers),
      decision: body,
    });
  });

  app.get("/api/v1/analytics", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (!user.athlete_id) {
      throw dependencies.httpError(403, "Only athlete accounts can view analytics");
    }

    return {
      analytics: await buildAnalyticsOverviewForAthlete(user.athlete_id),
    };
  });
}
