import type { FastifyInstance } from "fastify";
import {
  autoAssignMicrocycle,
  assignPlan,
  createPlanTemplate,
  PlanningCommandServiceError,
} from "../../services/planning/planning-command.service";
import {
  listAssignedPlansForAthlete,
  listAssignedPlansForCoachContext,
  listPlanTemplatesForCoachContext,
} from "../../services/planning/planning-query.service";
import {
  buildTemplatePackRecommendationResponse,
  buildTemplateRecommendationResponse,
} from "../../services/planning/template-pack.service";
import type { ApiGuards, HttpErrorFactory } from "../guards";
import {
  parseAssignedPlanBody,
  parseAutoAssignMicrocycleBody,
  parsePlanningAthleteDateQuery,
  parsePlanTemplateBody,
  parseTemplatePackQuery,
} from "./planning.schemas";

interface PlanningRouteDependencies {
  guards: ApiGuards;
  httpError: HttpErrorFactory;
}

export function registerPlanningRoutes(
  app: FastifyInstance,
  dependencies: PlanningRouteDependencies,
) {
  app.get("/api/v1/plans/templates", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(403, "Only coach or admin accounts can manage plan templates");
    }

    return {
      templates: await listPlanTemplatesForCoachContext(user.id, user.role),
    };
  });

  app.get("/api/v1/plans/template-recommendations", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(
        403,
        "Only coach or admin accounts can view template recommendations",
      );
    }

    let query;
    try {
      query = parsePlanningAthleteDateQuery(request.query);
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    await dependencies.guards.assertAthleteAccess(user, query.athleteId);

    return buildTemplateRecommendationResponse({
      coachUserId: user.id,
      role: user.role,
      athleteId: query.athleteId,
      referenceDate: query.date ?? new Date().toISOString().slice(0, 10),
    });
  });

  app.get("/api/v1/plans/template-pack-recommendations", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(403, "Only coach or admin accounts can view pack recommendations");
    }

    let query;
    try {
      query = parseTemplatePackQuery(request.query);
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    await dependencies.guards.assertAthleteAccess(user, query.athleteId);

    return buildTemplatePackRecommendationResponse({
      coachUserId: user.id,
      role: user.role,
      athleteId: query.athleteId,
      startDate: query.startDate ?? new Date().toISOString().slice(0, 10),
    });
  });

  app.post("/api/v1/plans/templates", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(403, "Only coach or admin accounts can create plan templates");
    }

    const body = parsePlanTemplateBody(request.body);
    const hasBlocks =
      body.blocks.length > 0 ||
      Boolean(
        body.days?.some((day) =>
          day.sessions.some((session) => session.blocks.length > 0),
        ),
      );

    if (!body.name || !hasBlocks) {
      throw dependencies.httpError(
        400,
        "Plan template name and at least one block are required",
      );
    }

    return createPlanTemplate({
      coachUserId: user.id,
      payload: body,
    });
  });

  app.get("/api/v1/plans/assigned", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role === "athlete") {
      if (!user.athlete_id) {
        throw dependencies.httpError(404, "Athlete profile was not found");
      }

      return {
        assignedPlans: await listAssignedPlansForAthlete(user.athlete_id),
      };
    }

    if (user.role === "coach" || user.role === "admin") {
      return {
        assignedPlans: await listAssignedPlansForCoachContext(user.id, user.role),
      };
    }

    throw dependencies.httpError(403, "Unsupported role");
  });

  app.post("/api/v1/plans/assign", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(403, "Only coach or admin accounts can assign plans");
    }

    const body = parseAssignedPlanBody(request.body);

    if (!body.athleteId || !body.templateId || !body.startDate || !body.dayLabel) {
      throw dependencies.httpError(
        400,
        "athleteId, templateId, startDate and dayLabel are required",
      );
    }

    await dependencies.guards.assertAthleteAccess(user, body.athleteId);

    try {
      return await assignPlan({
        coachUserId: user.id,
        payload: body,
      });
    } catch (error) {
      if (
        error instanceof PlanningCommandServiceError &&
        error.code === "template_blocks_not_found"
      ) {
        throw dependencies.httpError(404, error.message);
      }

      throw error;
    }
  });

  app.post("/api/v1/plans/auto-assign-microcycle", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(403, "Only coach or admin accounts can auto-assign microcycles");
    }

    const body = parseAutoAssignMicrocycleBody(request.body);

    if (!body.athleteId || !body.startDate || !body.items.length) {
      throw dependencies.httpError(400, "athleteId, startDate and items are required");
    }

    await dependencies.guards.assertAthleteAccess(user, body.athleteId);

    return autoAssignMicrocycle({
      coachUserId: user.id,
      payload: body,
    });
  });
}
