import type { FastifyInstance } from "fastify";
import {
  CompetitionCommandServiceError,
  createCompetition,
  createCompetitionPlan,
  createOlympicCycle,
  deleteCompetition,
  deleteCompetitionPlan,
  deleteCompetitions,
  saveCompetitionResult,
} from "../../services/competition/competition-command.service";
import {
  getCompetitionContextForAthlete,
  getCompetitionPlanAthleteId,
  listCompetitionPlans,
  listCompetitions,
  listOlympicCycles,
} from "../../services/competition/competition-query.service";
import {
  createMesocycle,
  listMesocycles,
  MesocycleServiceError,
} from "../../services/competition/mesocycle.service";
import {
  buildCompetitionReviewOverview,
  createSeason,
  listSeasons,
} from "../../services/competition/season.service";
import {
  getUwwEventSyncOptions,
  syncUwwEvents,
  UwwEventSyncServiceError,
} from "../../services/competition/uww-event-sync.service";
import type { ApiGuards, HttpErrorFactory } from "../guards";
import {
  parseCompetitionAthleteParams,
  parseCompetitionAthleteQuery,
  parseCompetitionPlanParams,
  parseCompetitionParams,
  parseCompetitionResultBody,
  parseCreateCompetitionBody,
  parseCreateCompetitionPlanBody,
  parseCreateMesocycleBody,
  parseCreateOlympicCycleBody,
  parseCreateSeasonBody,
  parseDeleteCompetitionsBody,
  parseUwwEventSyncFilters,
} from "./competition.schemas";

interface CompetitionRouteDependencies {
  guards: ApiGuards;
  httpError: HttpErrorFactory;
}

export function registerCompetitionRoutes(
  app: FastifyInstance,
  dependencies: CompetitionRouteDependencies,
) {
  app.get("/api/v1/competitions", async (request) => {
    await dependencies.guards.requireUser(request);

    return {
      competitions: await listCompetitions(),
    };
  });

  app.post("/api/v1/competitions", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(403, "Only coach or admin accounts can create competitions");
    }

    const body = parseCreateCompetitionBody(request.body);

    if (!body.title || !body.startDate || !body.endDate || !body.level) {
      throw dependencies.httpError(400, "title, startDate, endDate and level are required");
    }

    return {
      competition: await createCompetition(body),
    };
  });

  app.post("/api/v1/competitions/uww-sync", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(403, "Only coach or admin accounts can sync UWW events");
    }

    const filters = parseUwwEventSyncFilters(request.body);

    try {
      return await syncUwwEvents(filters);
    } catch (error) {
      if (error instanceof UwwEventSyncServiceError) {
        throw dependencies.httpError(
          error.code === "fetch_failed" ? 502 : 500,
          error.message,
        );
      }

      throw error;
    }
  });

  app.get("/api/v1/competitions/uww-options", async (request) => {
    await dependencies.guards.requireUser(request);

    try {
      return await getUwwEventSyncOptions();
    } catch (error) {
      if (error instanceof UwwEventSyncServiceError) {
        throw dependencies.httpError(
          error.code === "fetch_failed" ? 502 : 500,
          error.message,
        );
      }

      throw error;
    }
  });

  async function handleDeleteCompetitionsRequest(request: { body: unknown; cookies: Record<string, string | undefined> }) {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(403, "Only coach or admin accounts can delete competitions");
    }

    const body = parseDeleteCompetitionsBody(request.body);

    if (body.competitionIds.length === 0) {
      throw dependencies.httpError(400, "competitionIds are required");
    }

    return deleteCompetitions(body.competitionIds);
  }

  app.post("/api/v1/competitions/bulk-delete", handleDeleteCompetitionsRequest);

  app.post("/api/v1/competitions/delete", handleDeleteCompetitionsRequest);

  app.delete("/api/v1/competitions/:competitionId", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(403, "Only coach or admin accounts can delete competitions");
    }

    const params = parseCompetitionParams(request.params);
    const result = await deleteCompetition(params.competitionId);

    if (!result) {
      throw dependencies.httpError(404, "Competition was not found");
    }

    return result;
  });

  app.get("/api/v1/olympic-cycles", async (request) => {
    await dependencies.guards.requireUser(request);

    return {
      olympicCycles: await listOlympicCycles(),
    };
  });

  app.post("/api/v1/olympic-cycles", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(403, "Only coach or admin accounts can create Olympic cycles");
    }

    const body = parseCreateOlympicCycleBody(request.body);

    if (!body.name || !body.startDate || !body.endDate) {
      throw dependencies.httpError(400, "name, startDate and endDate are required");
    }

    return {
      olympicCycle: await createOlympicCycle(body),
    };
  });

  app.get("/api/v1/seasons", async (request) => {
    const user = await dependencies.guards.requireUser(request);
    const query = parseCompetitionAthleteQuery(request.query);

    if (user.role === "athlete") {
      if (!user.athlete_id) {
        throw dependencies.httpError(404, "Athlete profile was not found");
      }

      return {
        seasons: await listSeasons(user.athlete_id),
      };
    }

    if (query.athleteId) {
      await dependencies.guards.assertAthleteAccess(user, query.athleteId);
    }

    return {
      seasons: await listSeasons(query.athleteId),
    };
  });

  app.post("/api/v1/seasons", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(403, "Only coach or admin accounts can create seasons");
    }

    const body = parseCreateSeasonBody(request.body);

    if (!body.athleteId || !body.year || !body.name || !body.strategyType) {
      throw dependencies.httpError(400, "athleteId, year, name and strategyType are required");
    }

    await dependencies.guards.assertAthleteAccess(user, body.athleteId);

    return {
      season: await createSeason(body),
    };
  });

  app.get("/api/v1/mesocycles", async (request) => {
    const user = await dependencies.guards.requireUser(request);
    const query = parseCompetitionAthleteQuery(request.query);

    if (user.role === "athlete") {
      if (!user.athlete_id) {
        throw dependencies.httpError(404, "Athlete profile was not found");
      }

      return {
        mesocycles: await listMesocycles(user.athlete_id),
      };
    }

    if (query.athleteId) {
      await dependencies.guards.assertAthleteAccess(user, query.athleteId);
    }

    return {
      mesocycles: await listMesocycles(query.athleteId),
    };
  });

  app.post("/api/v1/mesocycles", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(403, "Only coach or admin accounts can create mesocycles");
    }

    const body = parseCreateMesocycleBody(request.body);

    if (
      !body.athleteId ||
      !body.name ||
      !body.phase ||
      !body.progressionType ||
      !body.startDate ||
      !body.endDate
    ) {
      throw dependencies.httpError(
        400,
        "athleteId, name, phase, progressionType, startDate and endDate are required",
      );
    }

    await dependencies.guards.assertAthleteAccess(user, body.athleteId);

    try {
      return {
        mesocycle: await createMesocycle(body),
      };
    } catch (error) {
      if (error instanceof MesocycleServiceError) {
        throw dependencies.httpError(400, error.message);
      }

      throw error;
    }
  });

  app.get("/api/v1/competition-plans", async (request) => {
    const user = await dependencies.guards.requireUser(request);
    const query = parseCompetitionAthleteQuery(request.query);

    if (user.role === "athlete") {
      if (!user.athlete_id) {
        throw dependencies.httpError(404, "Athlete profile was not found");
      }

      return {
        competitionPlans: await listCompetitionPlans(user.athlete_id),
      };
    }

    if (query.athleteId) {
      await dependencies.guards.assertAthleteAccess(user, query.athleteId);
    }

    return {
      competitionPlans: await listCompetitionPlans(query.athleteId),
    };
  });

  app.post("/api/v1/competition-plans", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(403, "Only coach or admin accounts can create competition plans");
    }

    const body = parseCreateCompetitionPlanBody(request.body);

    if (
      !body.athleteId ||
      !body.competitionId ||
      !body.priority ||
      !body.planType ||
      !body.prepStartDate ||
      !body.prepEndDate
    ) {
      throw dependencies.httpError(
        400,
        "athleteId, competitionId, priority, planType, prepStartDate and prepEndDate are required",
      );
    }

    await dependencies.guards.assertAthleteAccess(user, body.athleteId);

    return {
      competitionPlan: await createCompetitionPlan(body),
    };
  });

  app.delete("/api/v1/competition-plans/:competitionPlanId", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(403, "Only coach or admin accounts can delete competition plans");
    }

    const params = parseCompetitionPlanParams(request.params);
    const athleteId = await getCompetitionPlanAthleteId(params.competitionPlanId);

    if (!athleteId) {
      throw dependencies.httpError(404, "Competition plan was not found");
    }

    await dependencies.guards.assertAthleteAccess(user, athleteId);

    const deletedCompetitionPlanId = await deleteCompetitionPlan(params.competitionPlanId);

    if (!deletedCompetitionPlanId) {
      throw dependencies.httpError(404, "Competition plan was not found");
    }

    return {
      deletedCompetitionPlanId,
      competitionPlans: await listCompetitionPlans(athleteId),
    };
  });

  app.get("/api/v1/competition-context/:athleteId", async (request) => {
    const user = await dependencies.guards.requireUser(request);
    const params = parseCompetitionAthleteParams(request.params);

    await dependencies.guards.assertAthleteAccess(user, params.athleteId);

    return {
      context: await getCompetitionContextForAthlete(params.athleteId, new Date()),
    };
  });

  app.get("/api/v1/competition-review/:athleteId", async (request) => {
    const user = await dependencies.guards.requireUser(request);
    const params = parseCompetitionAthleteParams(request.params);

    await dependencies.guards.assertAthleteAccess(user, params.athleteId);

    return {
      review: await buildCompetitionReviewOverview(params.athleteId),
    };
  });

  app.post("/api/v1/competition-results", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(403, "Only coach or admin accounts can save competition results");
    }

    const body = parseCompetitionResultBody(request.body);

    if (!body.competitionPlanId) {
      throw dependencies.httpError(400, "competitionPlanId is required");
    }

    const athleteId = await getCompetitionPlanAthleteId(body.competitionPlanId);

    if (!athleteId) {
      throw dependencies.httpError(404, "Competition plan was not found");
    }

    await dependencies.guards.assertAthleteAccess(user, athleteId);

    try {
      return {
        result: await saveCompetitionResult(body),
      };
    } catch (error) {
      if (
        error instanceof CompetitionCommandServiceError &&
        error.code === "competition_plan_not_found"
      ) {
        throw dependencies.httpError(404, error.message);
      }

      throw error;
    }
  });
}
