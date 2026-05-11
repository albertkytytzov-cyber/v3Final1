import type {
  CoachDayAiExecutionStatus,
  CoachDayAiPayload,
  CoachDayAiReviewRequest,
  ReadinessStatus,
} from "@training-platform/shared";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const dayStatuses: CoachDayAiExecutionStatus[] = ["completed", "partial", "missed", "no-plan"];
const dataQualityStatuses = ["complete", "partial", "insufficient"] as const;
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
  const dataQuality = payload.dataQuality === null || payload.dataQuality === undefined
    ? null
    : readDataQuality(payload.dataQuality);
  const deviceHealth = payload.deviceHealth === null || payload.deviceHealth === undefined
    ? null
    : readDeviceHealth(payload.deviceHealth);
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
    dataQuality,
    date: readEntryDate(payload.date),
    deviceHealth,
    limitations: readArray(payload.limitations ?? [], "limitations").map((item) =>
      readString(item, "limitations[]")
    ),
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
      deviceConfirmed: readNumber(
        load.deviceConfirmed ?? 0,
        "load.deviceConfirmed",
      ),
      explanation: readArray(load.explanation ?? [], "load.explanation").map((item) =>
        readString(item, "load.explanation[]")
      ),
      manualActual: readNumber(
        load.manualActual ?? load.actual,
        "load.manualActual",
      ),
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

function readDataQuality(value: unknown): CoachDayAiPayload["dataQuality"] {
  const dataQuality = readRecord(value, "dataQuality");

  return {
    actions: readArray(dataQuality.actions ?? [], "dataQuality.actions").map((item) =>
      readString(item, "dataQuality.actions[]")
    ),
    available: readArray(dataQuality.available ?? [], "dataQuality.available").map((item) =>
      readString(item, "dataQuality.available[]")
    ),
    missing: readArray(dataQuality.missing ?? [], "dataQuality.missing").map((item) =>
      readString(item, "dataQuality.missing[]")
    ),
    signals: readArray(dataQuality.signals ?? [], "dataQuality.signals").map(readDataQualitySignal),
    status: readEnum(dataQuality.status, [...dataQualityStatuses], "dataQuality.status"),
    statusLabel: readString(dataQuality.statusLabel, "dataQuality.statusLabel"),
  };
}

function readDataQualitySignal(value: unknown) {
  const signal = readRecord(value, "dataQuality.signals[]");

  return {
    action: readNullableString(signal.action, "dataQuality.signals[].action"),
    key: readString(signal.key, "dataQuality.signals[].key"),
    label: readString(signal.label, "dataQuality.signals[].label"),
    present: readBoolean(signal.present, "dataQuality.signals[].present"),
  };
}

function readDeviceHealth(value: unknown): CoachDayAiPayload["deviceHealth"] {
  const device = readRecord(value, "deviceHealth");
  const heartRate = device.heartRate === null || device.heartRate === undefined
    ? null
    : readRecord(device.heartRate, "deviceHealth.heartRate");
  const sleep = device.sleep === null || device.sleep === undefined
    ? null
    : readRecord(device.sleep, "deviceHealth.sleep");
  const oxygenSaturation = device.oxygenSaturation === null || device.oxygenSaturation === undefined
    ? null
    : readRecord(device.oxygenSaturation, "deviceHealth.oxygenSaturation");
  const workout = device.workout === null || device.workout === undefined
    ? null
    : readRecord(device.workout, "deviceHealth.workout");

  return {
    heartRate: heartRate
      ? {
        averageBpm: readNullableNumber(heartRate.averageBpm, "deviceHealth.heartRate.averageBpm"),
        hrvRmssdMs: readNullableNumber(heartRate.hrvRmssdMs, "deviceHealth.heartRate.hrvRmssdMs"),
        maxBpm: readNullableNumber(heartRate.maxBpm, "deviceHealth.heartRate.maxBpm"),
        minBpm: readNullableNumber(heartRate.minBpm, "deviceHealth.heartRate.minBpm"),
        restingBpm: readNullableNumber(heartRate.restingBpm, "deviceHealth.heartRate.restingBpm"),
      }
      : null,
    linkedWorkouts: readArray(device.linkedWorkouts ?? [], "deviceHealth.linkedWorkouts").map(
      readLinkedWorkout,
    ),
    missing: readArray(device.missing ?? [], "deviceHealth.missing").map((item) =>
      readString(item, "deviceHealth.missing[]")
    ),
    oxygenSaturation: oxygenSaturation
      ? {
        averagePercent: readNullableNumber(
          oxygenSaturation.averagePercent,
          "deviceHealth.oxygenSaturation.averagePercent",
        ),
        latestPercent: readNullableNumber(
          oxygenSaturation.latestPercent,
          "deviceHealth.oxygenSaturation.latestPercent",
        ),
        maxPercent: readNullableNumber(
          oxygenSaturation.maxPercent,
          "deviceHealth.oxygenSaturation.maxPercent",
        ),
        minPercent: readNullableNumber(
          oxygenSaturation.minPercent,
          "deviceHealth.oxygenSaturation.minPercent",
        ),
        sampleCount: readCount(oxygenSaturation.sampleCount, "deviceHealth.oxygenSaturation.sampleCount"),
      }
      : null,
    sleep: sleep
      ? {
        awakeMinutes: readNullableNumber(sleep.awakeMinutes, "deviceHealth.sleep.awakeMinutes"),
        deepMinutes: readNullableNumber(sleep.deepMinutes, "deviceHealth.sleep.deepMinutes"),
        durationMinutes: readNullableNumber(sleep.durationMinutes, "deviceHealth.sleep.durationMinutes"),
        lightMinutes: readNullableNumber(sleep.lightMinutes, "deviceHealth.sleep.lightMinutes"),
        remMinutes: readNullableNumber(sleep.remMinutes, "deviceHealth.sleep.remMinutes"),
        score: readNullableNumber(sleep.score, "deviceHealth.sleep.score"),
      }
      : null,
    sourceDevice: readNullableString(device.sourceDevice, "deviceHealth.sourceDevice"),
    statusLabel: typeof device.statusLabel === "string"
      ? readString(device.statusLabel, "deviceHealth.statusLabel")
      : "",
    syncedAt: readNullableString(device.syncedAt, "deviceHealth.syncedAt"),
    workout: workout
      ? {
        activeCalories: readNullableNumber(workout.activeCalories, "deviceHealth.workout.activeCalories"),
        averageHeartRateBpm: readNullableNumber(workout.averageHeartRateBpm, "deviceHealth.workout.averageHeartRateBpm"),
        count: readCount(workout.count, "deviceHealth.workout.count"),
        maxHeartRateBpm: readNullableNumber(workout.maxHeartRateBpm, "deviceHealth.workout.maxHeartRateBpm"),
        totalDistanceMeters: readNullableNumber(workout.totalDistanceMeters, "deviceHealth.workout.totalDistanceMeters"),
        totalDurationMinutes: readNullableNumber(workout.totalDurationMinutes, "deviceHealth.workout.totalDurationMinutes"),
      }
      : null,
  };
}

function readLinkedWorkout(value: unknown) {
  const workout = readRecord(value, "deviceHealth.linkedWorkouts[]");
  const startTime = readString(workout.startTime, "deviceHealth.linkedWorkouts[].startTime");

  return {
    averageHeartRateBpm: readNullableNumber(
      workout.averageHeartRateBpm,
      "deviceHealth.linkedWorkouts[].averageHeartRateBpm",
    ),
    distanceMeters: readNullableNumber(
      workout.distanceMeters,
      "deviceHealth.linkedWorkouts[].distanceMeters",
    ),
    durationMinutes: readNullableNumber(
      workout.durationMinutes,
      "deviceHealth.linkedWorkouts[].durationMinutes",
    ),
    endTime: typeof workout.endTime === "string"
      ? readString(workout.endTime, "deviceHealth.linkedWorkouts[].endTime")
      : startTime,
    hasDistance: readBoolean(workout.hasDistance, "deviceHealth.linkedWorkouts[].hasDistance"),
    hasGraph: readBoolean(workout.hasGraph, "deviceHealth.linkedWorkouts[].hasGraph"),
    hasHeartRate: readBoolean(workout.hasHeartRate, "deviceHealth.linkedWorkouts[].hasHeartRate"),
    hasSpO2: readBoolean(workout.hasSpO2, "deviceHealth.linkedWorkouts[].hasSpO2"),
    linkedToPlan: typeof workout.linkedToPlan === "boolean"
      ? readBoolean(workout.linkedToPlan, "deviceHealth.linkedWorkouts[].linkedToPlan")
      : true,
    linkStatusLabel: typeof workout.linkStatusLabel === "string"
      ? readString(workout.linkStatusLabel, "deviceHealth.linkedWorkouts[].linkStatusLabel")
      : "связано с блоком плана",
    maxHeartRateBpm: readNullableNumber(
      workout.maxHeartRateBpm,
      "deviceHealth.linkedWorkouts[].maxHeartRateBpm",
    ),
    planBlockId: readString(workout.planBlockId, "deviceHealth.linkedWorkouts[].planBlockId"),
    planBlockName: readString(workout.planBlockName, "deviceHealth.linkedWorkouts[].planBlockName"),
    sourceDevice: readNullableString(workout.sourceDevice, "deviceHealth.linkedWorkouts[].sourceDevice"),
    startTime,
    workoutId: readString(workout.workoutId, "deviceHealth.linkedWorkouts[].workoutId"),
    workoutType: readString(workout.workoutType, "deviceHealth.linkedWorkouts[].workoutType"),
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

function readNullableNumber(value: unknown, fieldName: string) {
  if (value === null || value === undefined) {
    return null;
  }

  return readNumber(value, fieldName);
}

function readBoolean(value: unknown, fieldName: string) {
  if (typeof value !== "boolean") {
    throw new Error(`${fieldName} must be a boolean`);
  }

  return value;
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
