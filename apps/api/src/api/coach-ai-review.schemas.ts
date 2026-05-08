import type {
  CoachDayAiExecutionStatus,
  CoachDayAiPayload,
  CoachDayAiReviewRequest,
  ReadinessStatus,
} from "@training-platform/shared";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const dayStatuses: CoachDayAiExecutionStatus[] = ["completed", "partial", "missed", "no-plan"];
const executionStatuses: Array<Exclude<CoachDayAiExecutionStatus, "no-plan">> = [
  "completed",
  "partial",
  "missed",
];
const readinessStatuses: ReadinessStatus[] = ["green", "yellow", "red"];

export function parseCoachDayAiAthleteParams(params: unknown): { athleteId: string } {
  const athleteId = (params as { athleteId?: unknown } | null)?.athleteId;

  if (typeof athleteId !== "string" || !athleteId) {
    throw new Error("athleteId is required");
  }

  return { athleteId };
}

export function parseCoachDayAiReviewBody(body: unknown): CoachDayAiReviewRequest {
  const payload = (body ?? {}) as {
    entryDate?: unknown;
    dayPayload?: unknown;
  };
  const entryDate = readEntryDate(payload.entryDate);
  const dayPayload = readDayPayload(payload.dayPayload);

  if (dayPayload.date !== entryDate) {
    throw new Error("entryDate must match dayPayload.date");
  }

  return { entryDate, dayPayload };
}

function readDayPayload(value: unknown): CoachDayAiPayload {
  const payload = readRecord(value, "dayPayload");
  const athlete = readRecord(payload.athlete, "athlete");
  const execution = readRecord(payload.execution, "execution");
  const blockCounts = readRecord(execution.blocks, "execution.blocks");
  const exerciseCounts = readRecord(execution.exercises, "execution.exercises");
  const load = readRecord(payload.load, "load");
  const plan = readRecord(payload.plan, "plan");
  const readiness = payload.readiness === null || payload.readiness === undefined
    ? null
    : readRecord(payload.readiness, "readiness");

  return {
    athlete: {
      displayName: readString(athlete.displayName, "athlete.displayName"),
      discipline: readNullableString(athlete.discipline, "athlete.discipline"),
      sport: readNullableString(athlete.sport, "athlete.sport"),
      weightClass: readNullableString(athlete.weightClass, "athlete.weightClass"),
    },
    coachComment: readNullableString(payload.coachComment, "coachComment"),
    date: readEntryDate(payload.date),
    execution: {
      blocks: {
        completed: readCount(blockCounts.completed, "execution.blocks.completed"),
        missed: readCount(blockCounts.missed, "execution.blocks.missed"),
        partial: readCount(blockCounts.partial, "execution.blocks.partial"),
        total: readCount(blockCounts.total, "execution.blocks.total"),
      },
      exercises: {
        completed: readCount(exerciseCounts.completed, "execution.exercises.completed"),
        missed: readCount(exerciseCounts.missed, "execution.exercises.missed"),
        partial: readCount(exerciseCounts.partial, "execution.exercises.partial"),
        total: readCount(exerciseCounts.total, "execution.exercises.total"),
      },
      status: readEnum(execution.status, dayStatuses, "execution.status"),
      statusLabel: readString(execution.statusLabel, "execution.statusLabel"),
    },
    load: {
      actual: readNumber(load.actual, "load.actual"),
      delta: readNumber(load.delta, "load.delta"),
      planned: readNumber(load.planned, "load.planned"),
    },
    plan: {
      blocks: readArray(plan.blocks, "plan.blocks").map(readPlanBlock),
      count: readCount(plan.count, "plan.count"),
      templates: readArray(plan.templates, "plan.templates").map((item) =>
        readString(item, "plan.templates[]")
      ),
    },
    readiness: readiness
      ? {
        flags: readString(readiness.flags, "readiness.flags"),
        score: readNumber(readiness.score, "readiness.score"),
        status: readEnum(readiness.status, readinessStatuses, "readiness.status"),
        statusLabel: readString(readiness.statusLabel, "readiness.statusLabel"),
      }
      : null,
  };
}

function readPlanBlock(value: unknown) {
  const block = readRecord(value, "plan.blocks[]");

  return {
    actualLoad: readNumber(block.actualLoad, "plan.blocks[].actualLoad"),
    exercises: readArray(block.exercises, "plan.blocks[].exercises").map(readPlanExercise),
    name: readString(block.name, "plan.blocks[].name"),
    plannedLoad: readNumber(block.plannedLoad, "plan.blocks[].plannedLoad"),
    sessionName: readString(block.sessionName, "plan.blocks[].sessionName"),
    status: readEnum(block.status, executionStatuses, "plan.blocks[].status"),
  };
}

function readPlanExercise(value: unknown) {
  const exercise = readRecord(value, "plan.blocks[].exercises[]");

  return {
    actual: readString(exercise.actual, "plan.blocks[].exercises[].actual"),
    name: readString(exercise.name, "plan.blocks[].exercises[].name"),
    plannedControl: readString(
      exercise.plannedControl,
      "plan.blocks[].exercises[].plannedControl",
    ),
    plannedWork: readString(exercise.plannedWork, "plan.blocks[].exercises[].plannedWork"),
    status: readEnum(exercise.status, executionStatuses, "plan.blocks[].exercises[].status"),
  };
}

function readRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object`);
  }

  return value as Record<string, unknown>;
}

function readArray(value: unknown, fieldName: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }

  return value;
}

function readEntryDate(value: unknown) {
  if (typeof value !== "string" || !datePattern.test(value)) {
    throw new Error("entryDate must use YYYY-MM-DD format");
  }

  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== value) {
    throw new Error("entryDate must be a valid calendar date");
  }

  return value;
}

function readString(value: unknown, fieldName: string) {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }

  return value;
}

function readNullableString(value: unknown, fieldName: string) {
  if (value === null || value === undefined) {
    return null;
  }

  return readString(value, fieldName);
}

function readNumber(value: unknown, fieldName: string) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    throw new Error(`${fieldName} must be a number`);
  }

  return numericValue;
}

function readCount(value: unknown, fieldName: string) {
  const numericValue = readNumber(value, fieldName);

  if (!Number.isInteger(numericValue) || numericValue < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`);
  }

  return numericValue;
}

function readEnum<T extends string>(value: unknown, allowedValues: T[], fieldName: string): T {
  if (typeof value !== "string" || !allowedValues.includes(value as T)) {
    throw new Error(`${fieldName} has unsupported value`);
  }

  return value as T;
}
