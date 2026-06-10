import type { FastifyInstance } from "fastify";
import {
  buildConstructorTemplatePayload,
  buildConstructorMatrixPreviewResponse,
  buildMatrixDrivenConstructorDraft,
  buildMatrixPrimaryPilotSaveDryRun,
  decideMatrixConstructorRollout,
  buildPerformConstructorDraft,
  evaluateMatrixPilotReadiness,
} from "@training-platform/shared";
import {
  autoAssignMicrocycle,
  assignPlan,
  createPlanTemplate,
  deleteAssignedPlan,
  deletePlanTemplate,
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
  parseConstructorDraftBody,
  parseConstructorMatrixPreviewBody,
  parseConstructorMatrixRolloutDecisionBody,
  parseMatrixPrimaryPilotSaveDryRunBody,
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

  app.post("/api/v1/plans/constructor/draft", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(403, "Only coach or admin accounts can build constructor drafts");
    }

    let body;
    try {
      body = parseConstructorDraftBody(request.body);
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    await dependencies.guards.assertAthleteAccess(user, body.athlete.athleteId);

    const draft = buildPerformConstructorDraft(body);

    return {
      draft,
      templatePayload: buildConstructorTemplatePayload(
        draft,
        `PERFORM Constructor • ${body.competition.name}`,
      ),
    };
  });

  app.post("/api/v1/plans/constructor/internal/matrix-preview", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(
        403,
        "Only coach or admin accounts can build constructor preview",
      );
    }

    let body;
    try {
      body = parseConstructorMatrixPreviewBody(request.body);
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    await dependencies.guards.assertAthleteAccess(user, body.input.athlete.athleteId);

    // Internal/experimental preview only: no DB writes, no template creation and no production route changes.
    return buildConstructorMatrixPreviewResponse(body.input, body.options);
  });

  app.post("/api/v1/plans/constructor/internal/matrix-rollout-decision", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(
        403,
        "Only coach or admin accounts can build constructor rollout decisions",
      );
    }

    let body;
    try {
      body = parseConstructorMatrixRolloutDecisionBody(request.body);
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    await dependencies.guards.assertAthleteAccess(user, body.input.athlete.athleteId);

    // Internal decision only: no DB writes, no template creation and no production route changes.
    return decideMatrixConstructorRollout(body.input, body.options);
  });

  app.post("/api/v1/plans/constructor/internal/matrix-primary-pilot-save-dry-run", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(
        403,
        "Only coach or admin accounts can run constructor save dry-runs",
      );
    }

    let body;
    try {
      body = parseMatrixPrimaryPilotSaveDryRunBody(request.body);
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    await dependencies.guards.assertAthleteAccess(user, body.input.athlete.athleteId);

    const rolloutDecision = decideMatrixConstructorRollout(body.input, body.rolloutOptions);
    const pilotReadiness = evaluateMatrixPilotReadiness(body.input, {
      rolloutOptions: body.rolloutOptions,
    });
    const primaryPilotEligible =
      rolloutDecision.mode === "matrix_allowed_for_primary" &&
      rolloutDecision.matrixPrimaryAllowed &&
      rolloutDecision.blockers.length === 0 &&
      pilotReadiness.status === "ready_for_limited_primary_pilot" &&
      pilotReadiness.blockers.length === 0;
    let matrixDraft: ReturnType<typeof buildMatrixDrivenConstructorDraft> | null = null;
    let matrixDraftError = "";

    try {
      matrixDraft = buildMatrixDrivenConstructorDraft(
        body.input,
        body.rolloutOptions?.previewOptions?.matrixOptions,
      );
    } catch (error) {
      matrixDraftError = error instanceof Error ? error.message : String(error);
    }

    const dryRun = buildMatrixPrimaryPilotSaveDryRun({
      activeDraftSource: "matrix_primary_pilot",
      draft: matrixDraft,
      primaryPilotEligible: primaryPilotEligible && Boolean(matrixDraft),
      eligibilityReason: primaryPilotEligible
        ? matrixDraftError || null
        : `${rolloutDecision.mode}/${pilotReadiness.status}`,
      eligibilityEvidence: [
        `scenario=${rolloutDecision.scenario}`,
        `rolloutMode=${rolloutDecision.mode}`,
        `matrixPrimaryAllowed=${rolloutDecision.matrixPrimaryAllowed}`,
        `readiness=${pilotReadiness.status}`,
        `rolloutBlockers=${rolloutDecision.blockers.length}`,
        `readinessBlockers=${pilotReadiness.blockers.length}`,
        ...(matrixDraftError ? [`matrixDraftError=${matrixDraftError}`] : []),
      ],
      templateName:
        body.templateName ?? `PERFORM Matrix Primary Pilot Dry Run • ${body.input.competition.name}`,
    });

    // Internal dry-run only: no DB writes, no template creation and no production route changes.
    return {
      generatedFrom: "matrix_primary_pilot_server_save_dry_run",
      generatedAt: new Date().toISOString(),
      dryRun,
      rolloutDecision,
      pilotReadiness,
      notes: [
        "Internal server-side dry-run only.",
        "This route does not create templates, assign plans, write DB/storage/telemetry, or change the production constructor route.",
      ],
    };
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

  app.delete("/api/v1/plans/templates/:templateId", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(403, "Only coach or admin accounts can delete plan templates");
    }

    const params = request.params as { templateId?: string };
    const query = request.query as { force?: string | boolean };
    const templateId = params.templateId ?? "";
    const force = query.force === true || query.force === "true";

    if (!templateId) {
      throw dependencies.httpError(400, "templateId is required");
    }

    try {
      return await deletePlanTemplate({
        coachUserId: user.id,
        role: user.role,
        templateId,
        force,
      });
    } catch (error) {
      if (error instanceof PlanningCommandServiceError) {
        if (error.code === "template_not_found") {
          throw dependencies.httpError(404, error.message);
        }

        if (error.code === "template_in_use") {
          throw dependencies.httpError(409, error.message);
        }
      }

      throw error;
    }
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

  app.delete("/api/v1/plans/assigned/:assignedPlanId", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(403, "Only coach or admin accounts can delete assigned plans");
    }

    const params = request.params as { assignedPlanId?: string };
    const assignedPlanId = params.assignedPlanId ?? "";

    if (!assignedPlanId) {
      throw dependencies.httpError(400, "assignedPlanId is required");
    }

    try {
      return await deleteAssignedPlan({
        coachUserId: user.id,
        role: user.role,
        assignedPlanId,
      });
    } catch (error) {
      if (
        error instanceof PlanningCommandServiceError &&
        error.code === "assigned_plan_not_found"
      ) {
        throw dependencies.httpError(404, error.message);
      }

      throw error;
    }
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
