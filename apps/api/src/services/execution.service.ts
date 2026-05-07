import {
  estimateTrainingBlockLoad,
  type ExecutionExerciseResult,
  type ExecutionResult,
  type ExecutionResultInput,
  type ExecutionReviewPlan,
  type PlanBlockInput,
} from "@training-platform/shared";
import { buildExecutionReviewPlan } from "../domain/execution-review.engine";
import { pool } from "../db";
import { loadAssignedPlans } from "./planning/planning-query.service";

interface ExecutionResultRow {
  id: string;
  athlete_id: string;
  assigned_plan_id: string;
  assigned_block_id: string;
  completed: boolean;
  sets_completed: number | null;
  reps_completed: number | null;
  weight_kg: string | null;
  duration_minutes: string | null;
  rpe: string | null;
  notes: string;
  completed_at: string | null;
  updated_at: string;
  exercise_result_id: string | null;
  assigned_exercise_id: string | null;
  exercise_completed: boolean | null;
  exercise_sets_completed: number | null;
  exercise_reps_completed: number | null;
  exercise_weight_kg: string | null;
  exercise_duration_minutes: string | null;
  exercise_rpe: string | null;
  exercise_notes: string | null;
  exercise_updated_at: string | null;
}

interface BlockLoadContextRow {
  day_date: string;
  block_type: PlanBlockInput["blockType"];
  block_priority: number;
  target_duration_minutes: string | null;
  target_rpe: string | null;
  target_sets: number | null;
  target_reps: number | null;
  exercise_id: string | null;
  exercise_target_duration_minutes: string | null;
  exercise_target_rpe: string | null;
  exercise_target_sets: number | null;
  exercise_target_reps: number | null;
}

export interface SubmitExecutionInput {
  athleteId: string;
  clientRequestId?: string | null;
  result: ExecutionResultInput;
}

export class ExecutionServiceError extends Error {
  constructor(
    public readonly code: "assigned_block_not_found" | "assigned_exercise_not_found",
    message: string,
  ) {
    super(message);
    this.name = "ExecutionServiceError";
  }
}

function toNullableNumber(value: string | null) {
  return value !== null ? Number(value) : null;
}

function mapExecutionExerciseResult(row: ExecutionResultRow): ExecutionExerciseResult | null {
  if (!row.exercise_result_id || !row.assigned_exercise_id || row.exercise_completed === null) {
    return null;
  }

  return {
    id: row.exercise_result_id,
    executionResultId: row.id,
    athleteId: row.athlete_id,
    assignedPlanId: row.assigned_plan_id,
    assignedBlockId: row.assigned_block_id,
    assignedExerciseId: row.assigned_exercise_id,
    completed: row.exercise_completed,
    setsCompleted: row.exercise_sets_completed,
    repsCompleted: row.exercise_reps_completed,
    weightKg: toNullableNumber(row.exercise_weight_kg),
    durationMinutes: toNullableNumber(row.exercise_duration_minutes),
    rpe: toNullableNumber(row.exercise_rpe),
    notes: row.exercise_notes ?? "",
    updatedAt: row.exercise_updated_at ?? row.updated_at,
  };
}

function mapExecutionResults(rows: ExecutionResultRow[]): ExecutionResult[] {
  const grouped = new Map<string, ExecutionResult>();

  for (const row of rows) {
    let executionResult = grouped.get(row.id);

    if (!executionResult) {
      executionResult = {
        id: row.id,
        athleteId: row.athlete_id,
        assignedPlanId: row.assigned_plan_id,
        assignedBlockId: row.assigned_block_id,
        completed: row.completed,
        setsCompleted: row.sets_completed,
        repsCompleted: row.reps_completed,
        weightKg: toNullableNumber(row.weight_kg),
        durationMinutes: toNullableNumber(row.duration_minutes),
        rpe: toNullableNumber(row.rpe),
        notes: row.notes,
        completedAt: row.completed_at,
        updatedAt: row.updated_at,
        exerciseResults: [],
      };
      grouped.set(row.id, executionResult);
    }

    const exerciseResult = mapExecutionExerciseResult(row);
    if (
      exerciseResult &&
      !(executionResult.exerciseResults ?? []).some((item) => item.id === exerciseResult.id)
    ) {
      executionResult.exerciseResults ??= [];
      executionResult.exerciseResults.push(exerciseResult);
    }
  }

  return Array.from(grouped.values());
}

function sumNullableExerciseMetric(
  exercises: NonNullable<ExecutionResultInput["exercises"]>,
  key: "setsCompleted" | "repsCompleted" | "durationMinutes",
) {
  const values = exercises
    .map((exercise) => exercise[key])
    .filter((value): value is number => value !== null && value !== undefined);

  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

async function loadExecutionResults(whereSql: string, params: unknown[]) {
  const result = await pool.query<ExecutionResultRow>(
    `
      SELECT
        exercise_results.id,
        exercise_results.athlete_id,
        exercise_results.assigned_plan_id,
        exercise_results.assigned_block_id,
        exercise_results.completed,
        exercise_results.sets_completed,
        exercise_results.reps_completed,
        exercise_results.weight_kg::text,
        exercise_results.duration_minutes::text,
        exercise_results.rpe::text,
        exercise_results.notes,
        exercise_results.completed_at::text,
        exercise_results.updated_at::text,
        exercise_result_exercises.id AS exercise_result_id,
        exercise_result_exercises.assigned_exercise_id::text,
        exercise_result_exercises.completed AS exercise_completed,
        exercise_result_exercises.sets_completed AS exercise_sets_completed,
        exercise_result_exercises.reps_completed AS exercise_reps_completed,
        exercise_result_exercises.weight_kg::text AS exercise_weight_kg,
        exercise_result_exercises.duration_minutes::text AS exercise_duration_minutes,
        exercise_result_exercises.rpe::text AS exercise_rpe,
        exercise_result_exercises.notes AS exercise_notes,
        exercise_result_exercises.updated_at::text AS exercise_updated_at
      FROM exercise_results
      JOIN assigned_plans ON assigned_plans.id = exercise_results.assigned_plan_id
      LEFT JOIN exercise_result_exercises
        ON exercise_result_exercises.execution_result_id = exercise_results.id
      WHERE ${whereSql}
      ORDER BY exercise_results.updated_at DESC, exercise_result_exercises.updated_at DESC
    `,
    params,
  );

  return mapExecutionResults(result.rows);
}

function hasExerciseCompletionValue(
  exercise: NonNullable<ExecutionResultInput["exercises"]>[number],
) {
  return exercise.completed || exercise.setsCompleted !== null;
}

function summarizeExercisePayloads(
  result: ExecutionResultInput,
  assignedExerciseCount: number,
) {
  if (!result.exercises?.length) {
    return {
      completed: result.completed,
      setsCompleted: result.setsCompleted,
      repsCompleted: result.repsCompleted,
      weightKg: result.weightKg,
      durationMinutes: result.durationMinutes,
      rpe: result.rpe,
    };
  }

  const setsCompleted =
    result.setsCompleted ??
    sumNullableExerciseMetric(result.exercises, "setsCompleted");
  const repsCompleted =
    result.repsCompleted ??
    sumNullableExerciseMetric(result.exercises, "repsCompleted");
  const durationMinutes =
    result.durationMinutes ??
    sumNullableExerciseMetric(result.exercises, "durationMinutes");
  const rpeValues = result.exercises
    .map((exercise) => exercise.rpe)
    .filter((value): value is number => value !== null && value !== undefined);
  const rpe =
    result.rpe ??
    (rpeValues.length
      ? Number((rpeValues.reduce((sum, value) => sum + value, 0) / rpeValues.length).toFixed(1))
      : null);
  const weightValues = result.exercises
    .map((exercise) => exercise.weightKg)
    .filter((value): value is number => value !== null && value !== undefined);
  const weightKg =
    result.weightKg ??
    (weightValues.length
      ? Number((weightValues.reduce((sum, value) => sum + value, 0) / weightValues.length).toFixed(2))
      : null);
  const completedExerciseIds = new Set(
    result.exercises
      .filter(hasExerciseCompletionValue)
      .map((exercise) => exercise.assignedExerciseId),
  );
  const completed =
    result.completed ||
    (assignedExerciseCount > 0 && completedExerciseIds.size >= assignedExerciseCount);

  return {
    completed,
    setsCompleted,
    repsCompleted,
    weightKg,
    durationMinutes,
    rpe,
  };
}

function resolveCompletionStatus(input: {
  completed: boolean;
  setsCompleted: number | null;
  repsCompleted: number | null;
  durationMinutes: number | null;
  rpe: number | null;
  exercises?: ExecutionResultInput["exercises"];
}) {
  if (input.completed) {
    return "completed";
  }

  if (
    input.setsCompleted !== null ||
    input.repsCompleted !== null ||
    input.durationMinutes !== null ||
    input.rpe !== null ||
    input.exercises?.some(
      (exercise) =>
        exercise.completed ||
        exercise.setsCompleted !== null ||
        exercise.repsCompleted !== null ||
        exercise.durationMinutes !== null ||
        exercise.rpe !== null,
    )
  ) {
    return "partial";
  }

  return "missed";
}

function hasExerciseExecutionValue(exercise: NonNullable<ExecutionResultInput["exercises"]>[number]) {
  return (
    exercise.completed ||
    exercise.setsCompleted !== null ||
    exercise.repsCompleted !== null ||
    exercise.durationMinutes !== null ||
    exercise.rpe !== null
  );
}

function estimateActualLoad(input: {
  plannedLoad: number;
  completed: boolean;
  actualDurationMinutes: number | null;
  actualRpe: number | null;
  assignedExerciseCount: number;
  exercises?: ExecutionResultInput["exercises"];
}) {
  if (input.actualDurationMinutes !== null && input.actualRpe !== null) {
    return Number((input.actualDurationMinutes * input.actualRpe).toFixed(2));
  }

  if (input.completed) {
    return input.plannedLoad;
  }

  const exercises = input.exercises ?? [];

  if (!exercises.length || input.plannedLoad <= 0) {
    return 0;
  }

  const assignedExerciseCount = input.assignedExerciseCount || exercises.length;
  const completedExercises = new Set(
    exercises
      .filter(hasExerciseExecutionValue)
      .map((exercise) => exercise.assignedExerciseId),
  ).size;
  const completionRatio = Math.min(completedExercises, assignedExerciseCount) / assignedExerciseCount;

  return completedExercises
    ? Number((input.plannedLoad * completionRatio).toFixed(2))
    : 0;
}

export async function listExecutionResultsForAthlete(
  athleteId: string,
  assignedPlanId?: string,
): Promise<ExecutionResult[]> {
  const params: unknown[] = [athleteId];
  let whereSql =
    "exercise_results.athlete_id = $1 AND assigned_plans.status = 'active'";

  if (assignedPlanId) {
    params.push(assignedPlanId);
    whereSql += " AND exercise_results.assigned_plan_id = $2";
  }

  return loadExecutionResults(whereSql, params);
}

export async function buildExecutionReviewForAthlete(
  athleteId: string,
  assignedPlanId?: string,
): Promise<ExecutionReviewPlan | null> {
  const whereSql = assignedPlanId
    ? "assigned_plans.athlete_id = $1 AND assigned_plans.id = $2 AND assigned_plans.status = 'active'"
    : "assigned_plans.athlete_id = $1 AND assigned_plans.status = 'active'";
  const params = assignedPlanId ? [athleteId, assignedPlanId] : [athleteId];
  const [assignedPlan] = await loadAssignedPlans(
    whereSql,
    params,
  );

  if (!assignedPlan) {
    return null;
  }

  const results = await listExecutionResultsForAthlete(athleteId, assignedPlan.id);
  return buildExecutionReviewPlan(assignedPlan, results);
}

export async function submitExecutionResult(
  input: SubmitExecutionInput,
): Promise<ExecutionResult> {
  const blockAccess = await pool.query<{
    assigned_plan_id: string;
    assigned_block_id: string;
    day_date: string;
    assigned_exercise_id: string | null;
  }>(
    `
      SELECT
        assigned_plans.id AS assigned_plan_id,
        assigned_day_blocks.id AS assigned_block_id,
        assigned_plan_days.day_date::text AS day_date,
        assigned_block_exercises.id AS assigned_exercise_id
      FROM assigned_plans
      JOIN assigned_plan_days ON assigned_plan_days.assigned_plan_id = assigned_plans.id
      JOIN assigned_day_sessions ON assigned_day_sessions.assigned_day_id = assigned_plan_days.id
      JOIN assigned_day_blocks ON assigned_day_blocks.assigned_session_id = assigned_day_sessions.id
      LEFT JOIN assigned_block_exercises
        ON assigned_block_exercises.assigned_block_id = assigned_day_blocks.id
      WHERE assigned_plans.id = $1
        AND assigned_day_blocks.id = $2
        AND assigned_plans.athlete_id = $3
        AND assigned_plans.status = 'active'
    `,
    [input.result.assignedPlanId, input.result.assignedBlockId, input.athleteId],
  );

  if (!blockAccess.rowCount) {
    throw new ExecutionServiceError(
      "assigned_block_not_found",
      "Assigned block was not found for this athlete",
    );
  }

  const allowedExerciseIds = new Set(
    blockAccess.rows
      .map((row) => row.assigned_exercise_id)
      .filter((value): value is string => Boolean(value)),
  );
  const assignedExerciseCount = allowedExerciseIds.size;

  if (
    input.result.exercises?.some(
      (exercise) => !exercise.assignedExerciseId || !allowedExerciseIds.has(exercise.assignedExerciseId),
    )
  ) {
    throw new ExecutionServiceError(
      "assigned_exercise_not_found",
      "Assigned exercise was not found for this athlete block",
    );
  }

  const summary = summarizeExercisePayloads(input.result, assignedExerciseCount);
  const result = await pool.query<ExecutionResultRow>(
    `
      INSERT INTO exercise_results (
        athlete_id,
        assigned_plan_id,
        assigned_block_id,
        training_date,
        completed,
        sets_completed,
        reps_completed,
        weight_kg,
        duration_minutes,
        rpe,
        notes,
        client_request_id,
        completed_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10, $11, $12, CASE WHEN $5 THEN NOW() ELSE NULL END, NOW())
      ON CONFLICT (athlete_id, assigned_block_id)
      DO UPDATE SET
        training_date = EXCLUDED.training_date,
        completed = EXCLUDED.completed,
        sets_completed = EXCLUDED.sets_completed,
        reps_completed = EXCLUDED.reps_completed,
        weight_kg = EXCLUDED.weight_kg,
        duration_minutes = EXCLUDED.duration_minutes,
        rpe = EXCLUDED.rpe,
        notes = EXCLUDED.notes,
        client_request_id = COALESCE(EXCLUDED.client_request_id, exercise_results.client_request_id),
        completed_at = CASE WHEN EXCLUDED.completed THEN NOW() ELSE NULL END,
        updated_at = NOW()
      RETURNING
        id,
        athlete_id,
        assigned_plan_id,
        assigned_block_id,
        completed,
        sets_completed,
        reps_completed,
        weight_kg::text,
        duration_minutes::text,
        rpe::text,
        notes,
        completed_at::text,
        updated_at::text,
        NULL::text AS exercise_result_id,
        NULL::text AS assigned_exercise_id,
        NULL::boolean AS exercise_completed,
        NULL::integer AS exercise_sets_completed,
        NULL::integer AS exercise_reps_completed,
        NULL::text AS exercise_weight_kg,
        NULL::text AS exercise_duration_minutes,
        NULL::text AS exercise_rpe,
        NULL::text AS exercise_notes,
        NULL::text AS exercise_updated_at
    `,
    [
      input.athleteId,
      input.result.assignedPlanId,
      input.result.assignedBlockId,
      blockAccess.rows[0].day_date,
      summary.completed,
      summary.setsCompleted,
      summary.repsCompleted,
      summary.weightKg,
      summary.durationMinutes,
      summary.rpe,
      input.result.notes,
      input.clientRequestId ?? null,
    ],
  );

  const executionResultId = result.rows[0].id;

  if (input.result.exercises !== undefined) {
    const submittedExerciseIds = input.result.exercises.map((exercise) => exercise.assignedExerciseId);

    if (submittedExerciseIds.length) {
      await pool.query(
        `
          DELETE FROM exercise_result_exercises
          WHERE execution_result_id = $1
            AND assigned_exercise_id <> ALL($2::uuid[])
        `,
        [executionResultId, submittedExerciseIds],
      );
    } else {
      await pool.query(
        `DELETE FROM exercise_result_exercises WHERE execution_result_id = $1`,
        [executionResultId],
      );
    }

    for (const exercise of input.result.exercises) {
      await pool.query(
        `
          INSERT INTO exercise_result_exercises (
            execution_result_id,
            athlete_id,
            assigned_plan_id,
            assigned_block_id,
            assigned_exercise_id,
            completed,
            sets_completed,
            reps_completed,
            weight_kg,
            duration_minutes,
            rpe,
            notes,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
          ON CONFLICT (execution_result_id, assigned_exercise_id)
          DO UPDATE SET
            completed = EXCLUDED.completed,
            sets_completed = EXCLUDED.sets_completed,
            reps_completed = EXCLUDED.reps_completed,
            weight_kg = EXCLUDED.weight_kg,
            duration_minutes = EXCLUDED.duration_minutes,
            rpe = EXCLUDED.rpe,
            notes = EXCLUDED.notes,
            updated_at = NOW()
        `,
        [
          executionResultId,
          input.athleteId,
          input.result.assignedPlanId,
          input.result.assignedBlockId,
          exercise.assignedExerciseId,
          exercise.completed,
          exercise.setsCompleted,
          exercise.repsCompleted,
          exercise.weightKg,
          exercise.durationMinutes,
          exercise.rpe,
          exercise.notes,
        ],
      );
    }
  }

  const blockLoadContext = await pool.query<BlockLoadContextRow>(
    `
      SELECT
        assigned_plan_days.day_date::text,
        assigned_day_blocks.block_type,
        assigned_day_blocks.block_priority,
        assigned_day_blocks.target_duration_minutes::text,
        assigned_day_blocks.target_rpe::text,
        assigned_day_blocks.target_sets,
        assigned_day_blocks.target_reps,
        assigned_block_exercises.id::text AS exercise_id,
        assigned_block_exercises.target_duration_minutes::text AS exercise_target_duration_minutes,
        assigned_block_exercises.target_rpe::text AS exercise_target_rpe,
        assigned_block_exercises.target_sets AS exercise_target_sets,
        assigned_block_exercises.target_reps AS exercise_target_reps
      FROM assigned_plans
      JOIN assigned_plan_days ON assigned_plan_days.assigned_plan_id = assigned_plans.id
      JOIN assigned_day_sessions ON assigned_day_sessions.assigned_day_id = assigned_plan_days.id
      JOIN assigned_day_blocks ON assigned_day_blocks.assigned_session_id = assigned_day_sessions.id
      LEFT JOIN assigned_block_exercises
        ON assigned_block_exercises.assigned_block_id = assigned_day_blocks.id
      WHERE assigned_plans.id = $1
        AND assigned_day_blocks.id = $2
      ORDER BY assigned_block_exercises.display_order ASC
    `,
    [input.result.assignedPlanId, input.result.assignedBlockId],
  );

  if (blockLoadContext.rowCount) {
    const blockRow = blockLoadContext.rows[0];
    const plannedDurationMinutes = toNullableNumber(blockRow.target_duration_minutes);
    const plannedRpe = toNullableNumber(blockRow.target_rpe);
    const actualDurationMinutes = summary.durationMinutes ?? null;
    const actualRpe = summary.rpe ?? null;
    const plannedLoad = estimateTrainingBlockLoad({
      blockType: blockRow.block_type,
      blockPriority: blockRow.block_priority,
      targetDurationMinutes: plannedDurationMinutes,
      targetRpe: plannedRpe,
      targetSets: blockRow.target_sets,
      targetReps: blockRow.target_reps,
      exercises: blockLoadContext.rows
        .filter((row) => row.exercise_id)
        .map((row) => ({
          targetDurationMinutes: toNullableNumber(row.exercise_target_duration_minutes),
          targetRpe: toNullableNumber(row.exercise_target_rpe),
          targetSets: row.exercise_target_sets,
          targetReps: row.exercise_target_reps,
          targetWeightKg: null,
          notes: "",
          name: "",
        })),
    });
    const actualLoad = estimateActualLoad({
      plannedLoad,
      completed: summary.completed,
      actualDurationMinutes,
      actualRpe,
      assignedExerciseCount,
      exercises: input.result.exercises,
    });

    await pool.query(
      `
        INSERT INTO training_load_logs (
          athlete_id,
          assigned_plan_id,
          assigned_block_id,
          log_date,
          planned_load,
          actual_load,
          planned_duration_minutes,
          actual_duration_minutes,
          planned_rpe,
          actual_rpe,
          planned_sets,
          actual_sets,
          planned_reps,
          actual_reps,
          completion_status,
          source_type,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4::date,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          'execution',
          NOW()
        )
        ON CONFLICT (athlete_id, assigned_block_id, log_date)
        DO UPDATE SET
          planned_load = EXCLUDED.planned_load,
          actual_load = EXCLUDED.actual_load,
          planned_duration_minutes = EXCLUDED.planned_duration_minutes,
          actual_duration_minutes = EXCLUDED.actual_duration_minutes,
          planned_rpe = EXCLUDED.planned_rpe,
          actual_rpe = EXCLUDED.actual_rpe,
          planned_sets = EXCLUDED.planned_sets,
          actual_sets = EXCLUDED.actual_sets,
          planned_reps = EXCLUDED.planned_reps,
          actual_reps = EXCLUDED.actual_reps,
          completion_status = EXCLUDED.completion_status,
          source_type = EXCLUDED.source_type,
          updated_at = NOW()
      `,
      [
        input.athleteId,
        input.result.assignedPlanId,
        input.result.assignedBlockId,
        blockRow.day_date,
        plannedLoad,
        actualLoad,
        plannedDurationMinutes,
        actualDurationMinutes,
        plannedRpe,
        actualRpe,
        blockRow.target_sets,
        summary.setsCompleted,
        blockRow.target_reps,
        summary.repsCompleted,
        resolveCompletionStatus({
          completed: summary.completed,
          setsCompleted: summary.setsCompleted,
          repsCompleted: summary.repsCompleted,
          durationMinutes: summary.durationMinutes,
          rpe: summary.rpe,
          exercises: input.result.exercises,
        }),
      ],
    );
  }

  const [savedResult] = await loadExecutionResults(
    "exercise_results.id = $1 AND exercise_results.athlete_id = $2",
    [executionResultId, input.athleteId],
  );

  return savedResult;
}
