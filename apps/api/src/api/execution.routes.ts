import type { FastifyInstance } from "fastify";
import {
  buildExecutionReviewForAthlete,
  ExecutionServiceError,
  listExecutionResultsForAthlete,
  submitExecutionResult,
} from "../services/execution.service";
import type { ApiGuards, HttpErrorFactory } from "./guards";
import { readIdempotencyKey } from "./idempotency";
import {
  parseExecutionAthleteParams,
  parseExecutionBody,
  parseExecutionListQuery,
  parseExecutionReviewQuery,
} from "./execution.schemas";

interface ExecutionRouteDependencies {
  guards: ApiGuards;
  httpError: HttpErrorFactory;
}

export function registerExecutionRoutes(
  app: FastifyInstance,
  dependencies: ExecutionRouteDependencies,
) {
  app.get("/api/v1/coach/athletes/:athleteId/execution-review", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(403, "Only coach or admin accounts can view execution review");
    }

    let athleteId: string;
    try {
      athleteId = parseExecutionAthleteParams(request.params).athleteId;
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    let query;
    try {
      query = parseExecutionReviewQuery(request.query);
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    await dependencies.guards.assertAthleteAccess(user, athleteId);

    return {
      review: await buildExecutionReviewForAthlete(athleteId, query.assignedPlanId),
    };
  });

  app.get("/api/v1/coach/athletes/:athleteId/execution", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (user.role !== "coach" && user.role !== "admin") {
      throw dependencies.httpError(403, "Only coach or admin accounts can view execution tracking");
    }

    let athleteId: string;
    let query: { entryDate?: string };
    try {
      athleteId = parseExecutionAthleteParams(request.params).athleteId;
      query = parseExecutionListQuery(request.query);
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    await dependencies.guards.assertAthleteAccess(user, athleteId);

    return {
      results: await listExecutionResultsForAthlete(athleteId, undefined, query.entryDate),
    };
  });

  app.get("/api/v1/execution", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (!user.athlete_id) {
      throw dependencies.httpError(403, "Only athlete accounts can view execution tracking");
    }

    return {
      results: await listExecutionResultsForAthlete(user.athlete_id),
    };
  });

  app.post("/api/v1/execution", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    if (!user.athlete_id) {
      throw dependencies.httpError(403, "Only athlete accounts can submit execution tracking");
    }

    let resultInput;
    try {
      resultInput = parseExecutionBody(request.body);
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    try {
      return {
        result: await submitExecutionResult({
          athleteId: user.athlete_id,
          clientRequestId: readIdempotencyKey(request.headers),
          result: resultInput,
        }),
      };
    } catch (error) {
      if (
        error instanceof ExecutionServiceError &&
        (error.code === "assigned_block_not_found" ||
          error.code === "assigned_exercise_not_found")
      ) {
        throw dependencies.httpError(404, error.message);
      }

      throw error;
    }
  });
}
