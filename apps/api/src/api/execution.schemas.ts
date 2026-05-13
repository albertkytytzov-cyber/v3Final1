import type { ExecutionResultInput } from "@training-platform/shared";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);
  return Number.isNaN(numericValue) ? null : numericValue;
}

export function parseExecutionAthleteParams(params: unknown): { athleteId: string } {
  const athleteId = (params as { athleteId?: unknown } | null)?.athleteId;

  if (typeof athleteId !== "string" || !athleteId) {
    throw new Error("athleteId is required");
  }

  return { athleteId };
}

export function parseExecutionReviewQuery(query: unknown): { assignedPlanId?: string } {
  const assignedPlanId = (query as { assignedPlanId?: unknown } | null)?.assignedPlanId;

  if (assignedPlanId === undefined || assignedPlanId === null || assignedPlanId === "") {
    return {};
  }

  if (typeof assignedPlanId !== "string") {
    throw new Error("assignedPlanId must be a string");
  }

  if (!uuidPattern.test(assignedPlanId)) {
    throw new Error("assignedPlanId must be a valid id");
  }

  return { assignedPlanId };
}

export function parseExecutionListQuery(query: unknown): { entryDate?: string } {
  const entryDate = (query as { entryDate?: unknown } | null)?.entryDate;

  if (entryDate === undefined || entryDate === null || entryDate === "") {
    return {};
  }

  if (typeof entryDate !== "string" || !datePattern.test(entryDate)) {
    throw new Error("entryDate must be a date in YYYY-MM-DD format");
  }

  return { entryDate };
}

export function parseExecutionBody(body: unknown): ExecutionResultInput {
  const payload = (body ?? {}) as Partial<Record<keyof ExecutionResultInput, unknown>>;

  if (
    typeof payload.assignedPlanId !== "string" ||
    typeof payload.assignedBlockId !== "string"
  ) {
    throw new Error("assignedPlanId and assignedBlockId are required");
  }

  const setsCompleted = toNullableNumber(payload.setsCompleted);
  const repsCompleted = toNullableNumber(payload.repsCompleted);
  const weightKg = toNullableNumber(payload.weightKg);
  const durationMinutes = toNullableNumber(payload.durationMinutes);
  const rpe = toNullableNumber(payload.rpe);
  const exercises = Array.isArray(payload.exercises)
    ? payload.exercises.map((exercise) => {
        const value = exercise as {
          assignedExerciseId?: unknown;
          completed?: unknown;
          setsCompleted?: unknown;
          repsCompleted?: unknown;
          weightKg?: unknown;
          durationMinutes?: unknown;
          rpe?: unknown;
          notes?: unknown;
        };

        return {
          assignedExerciseId:
            typeof value.assignedExerciseId === "string" ? value.assignedExerciseId : "",
          completed: Boolean(value.completed),
          setsCompleted: toNullableNumber(value.setsCompleted),
          repsCompleted: toNullableNumber(value.repsCompleted),
          weightKg: toNullableNumber(value.weightKg),
          durationMinutes: toNullableNumber(value.durationMinutes),
          rpe: toNullableNumber(value.rpe),
          notes: typeof value.notes === "string" ? value.notes : "",
        };
      })
    : undefined;

  if (
    [setsCompleted, repsCompleted, weightKg, durationMinutes, rpe].some(
      (value) => value !== null && Number.isNaN(value),
    )
  ) {
    throw new Error("Execution metrics must be numeric when provided");
  }

  return {
    assignedPlanId: payload.assignedPlanId,
    assignedBlockId: payload.assignedBlockId,
    completed: Boolean(payload.completed),
    setsCompleted,
    repsCompleted,
    weightKg,
    durationMinutes,
    rpe,
    notes: typeof payload.notes === "string" ? payload.notes : "",
    exercises,
  };
}
