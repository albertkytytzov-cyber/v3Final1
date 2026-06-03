import type {
  CoachDayAiExecutionStatus,
  CoachDayAiPayload,
  CoachDayAiReviewRequest,
  CoachPeriodAiReviewRequest,
  CoachPeriodAiPayload,
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
type PeriodTrendStatus = CoachPeriodAiPayload["periodContext"]["trends"]["load"];

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

export function parseCoachPeriodAiReviewBody(body: unknown): CoachPeriodAiReviewRequest {
  const payload = (body ?? {}) as {
    selectedDate?: unknown;
    windowDays?: unknown;
  };
  const selectedDate = readEntryDate(payload.selectedDate);
  const windowDays = readWindowDays(payload.windowDays);

  return { selectedDate, windowDays };
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
  const analysisContext = payload.analysisContext === null || payload.analysisContext === undefined
    ? null
    : readAnalysisContext(payload.analysisContext);
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
    analysisContext,
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

export function readCoachPeriodAiPayload(value: unknown): CoachPeriodAiPayload {
  const payload = readRecord(value, "periodPayload");

  return {
    athlete: readPeriodAthlete(payload.athlete),
    periodContext: readPeriodContext(payload.periodContext),
    periodEnd: readEntryDate(payload.periodEnd),
    periodStart: readEntryDate(payload.periodStart),
    selectedDate: readEntryDate(payload.selectedDate),
    windowDays: readWindowDays(payload.windowDays),
  };
}

function readPeriodAthlete(value: unknown): CoachPeriodAiPayload["athlete"] {
  const athlete = readRecord(value, "periodPayload.athlete");

  return {
    displayName: readString(athlete.displayName, "periodPayload.athlete.displayName"),
    discipline: readNullableString(athlete.discipline, "periodPayload.athlete.discipline"),
    sport: readNullableString(athlete.sport, "periodPayload.athlete.sport"),
    weightClass: readNullableString(athlete.weightClass, "periodPayload.athlete.weightClass"),
  };
}

function readPeriodContext(value: unknown): CoachPeriodAiPayload["periodContext"] {
  const context = readRecord(value, "periodContext");
  const trends = readRecord(context.trends, "periodContext.trends");

  return {
    days: readArray(context.days ?? [], "periodContext.days").map(readPeriodContextDay),
    generatedAt: readString(context.generatedAt, "periodContext.generatedAt"),
    interpretation: readArray(context.interpretation ?? [], "periodContext.interpretation").map((item) =>
      readString(item, "periodContext.interpretation[]")
    ),
    mesocycle30: readPeriodWindowSummary(context.mesocycle30, "periodContext.mesocycle30"),
    microcycle7: readPeriodWindowSummary(context.microcycle7, "periodContext.microcycle7"),
    periodEnd: readEntryDate(context.periodEnd),
    periodStart: readEntryDate(context.periodStart),
    selectedDate: readEntryDate(context.selectedDate),
    trends: {
      bodyWeight: readTrendStatus(trends.bodyWeight, "periodContext.trends.bodyWeight"),
      load: readTrendStatus(trends.load, "periodContext.trends.load"),
      readiness: readTrendStatus(trends.readiness, "periodContext.trends.readiness"),
      restingHr: readTrendStatus(trends.restingHr, "periodContext.trends.restingHr"),
      sleep: readTrendStatus(trends.sleep, "periodContext.trends.sleep"),
    },
    warnings: readArray(context.warnings ?? [], "periodContext.warnings").map((item) =>
      readString(item, "periodContext.warnings[]")
    ),
    windowDays: readCount(context.windowDays, "periodContext.windowDays"),
  };
}

const trendStatuses: PeriodTrendStatus[] = ["up", "down", "stable", "unknown"];

function readTrendStatus(value: unknown, fieldName: string) {
  return readEnum(value, trendStatuses, fieldName);
}

function readPeriodContextDay(value: unknown) {
  const day = readRecord(value, "periodContext.days[]");

  return {
    actualLoad: readNumber(day.actualLoad, "periodContext.days[].actualLoad"),
    bodyWeightKg: readNullableNumber(day.bodyWeightKg, "periodContext.days[].bodyWeightKg"),
    completedBlocks: readCount(day.completedBlocks, "periodContext.days[].completedBlocks"),
    date: readEntryDate(day.date),
    loadDelta: readNumber(day.loadDelta, "periodContext.days[].loadDelta"),
    missedBlocks: readCount(day.missedBlocks, "periodContext.days[].missedBlocks"),
    notesPresent: readBoolean(day.notesPresent, "periodContext.days[].notesPresent"),
    partialBlocks: readCount(day.partialBlocks, "periodContext.days[].partialBlocks"),
    plannedBlocks: readCount(day.plannedBlocks, "periodContext.days[].plannedBlocks"),
    plannedLoad: readNumber(day.plannedLoad, "periodContext.days[].plannedLoad"),
    readinessScore: readNullableNumber(day.readinessScore, "periodContext.days[].readinessScore"),
    readinessStatus: day.readinessStatus === null || day.readinessStatus === undefined
      ? null
      : readEnum(day.readinessStatus, readinessStatuses, "periodContext.days[].readinessStatus"),
    restingHr: readNullableNumber(day.restingHr, "periodContext.days[].restingHr"),
    sleepMinutes: readNullableNumber(day.sleepMinutes, "periodContext.days[].sleepMinutes"),
    workoutCalories: readNullableNumber(day.workoutCalories, "periodContext.days[].workoutCalories"),
    workoutCount: readCount(day.workoutCount, "periodContext.days[].workoutCount"),
    workoutDistanceMeters: readNullableNumber(day.workoutDistanceMeters, "periodContext.days[].workoutDistanceMeters"),
    workoutDurationMinutes: readNullableNumber(day.workoutDurationMinutes, "periodContext.days[].workoutDurationMinutes"),
  };
}

function readPeriodWindowSummary(value: unknown, fieldName: string) {
  const summary = readRecord(value, fieldName);

  return {
    actualLoad: readNumber(summary.actualLoad, `${fieldName}.actualLoad`),
    bodyWeightDeltaKg: readNullableNumber(summary.bodyWeightDeltaKg, `${fieldName}.bodyWeightDeltaKg`),
    completedBlocks: readCount(summary.completedBlocks, `${fieldName}.completedBlocks`),
    completionRate: readNullableNumber(summary.completionRate, `${fieldName}.completionRate`),
    daysWithDeviceData: readCount(summary.daysWithDeviceData, `${fieldName}.daysWithDeviceData`),
    daysWithPlan: readCount(summary.daysWithPlan, `${fieldName}.daysWithPlan`),
    daysWithReadiness: readCount(summary.daysWithReadiness, `${fieldName}.daysWithReadiness`),
    highLoadDays: readCount(summary.highLoadDays, `${fieldName}.highLoadDays`),
    incompletePlanDays: readCount(summary.incompletePlanDays, `${fieldName}.incompletePlanDays`),
    loadDelta: readNumber(summary.loadDelta, `${fieldName}.loadDelta`),
    loadRatio: readNullableNumber(summary.loadRatio, `${fieldName}.loadRatio`),
    partialBlocks: readCount(summary.partialBlocks, `${fieldName}.partialBlocks`),
    periodDays: readCount(summary.periodDays, `${fieldName}.periodDays`),
    plannedBlocks: readCount(summary.plannedBlocks, `${fieldName}.plannedBlocks`),
    plannedLoad: readNumber(summary.plannedLoad, `${fieldName}.plannedLoad`),
    readinessAverage: readNullableNumber(summary.readinessAverage, `${fieldName}.readinessAverage`),
    readinessGreenDays: readCount(summary.readinessGreenDays, `${fieldName}.readinessGreenDays`),
    readinessRedDays: readCount(summary.readinessRedDays, `${fieldName}.readinessRedDays`),
    readinessYellowDays: readCount(summary.readinessYellowDays, `${fieldName}.readinessYellowDays`),
    restingHrAverage: readNullableNumber(summary.restingHrAverage, `${fieldName}.restingHrAverage`),
    sleepAverageMinutes: readNullableNumber(summary.sleepAverageMinutes, `${fieldName}.sleepAverageMinutes`),
    workoutCount: readCount(summary.workoutCount, `${fieldName}.workoutCount`),
    workoutDays: readCount(summary.workoutDays, `${fieldName}.workoutDays`),
    workoutDurationMinutes: readNullableNumber(summary.workoutDurationMinutes, `${fieldName}.workoutDurationMinutes`),
  };
}

function readAnalysisContext(value: unknown): CoachDayAiPayload["analysisContext"] {
  const context = readRecord(value, "analysisContext");

  return {
    blocks: readArray(context.blocks ?? [], "analysisContext.blocks").map(readAnalysisBlock),
    contactFocus: readArray(context.contactFocus ?? [], "analysisContext.contactFocus").map((item) =>
      readString(item, "analysisContext.contactFocus[]")
    ),
    energySystems: readArray(context.energySystems ?? [], "analysisContext.energySystems").map((item) =>
      readString(item, "analysisContext.energySystems[]")
    ),
    frameworkVersion: readString(context.frameworkVersion, "analysisContext.frameworkVersion"),
    keyQuestions: readArray(context.keyQuestions ?? [], "analysisContext.keyQuestions").map((item) =>
      readString(item, "analysisContext.keyQuestions[]")
    ),
    localLoadZones: readArray(context.localLoadZones ?? [], "analysisContext.localLoadZones").map((item) =>
      readString(item, "analysisContext.localLoadZones[]")
    ),
    phase: readString(context.phase, "analysisContext.phase"),
    primaryIntents: readArray(context.primaryIntents ?? [], "analysisContext.primaryIntents").map((item) =>
      readString(item, "analysisContext.primaryIntents[]")
    ),
    recoverySignals: readArray(context.recoverySignals ?? [], "analysisContext.recoverySignals").map((item) =>
      readString(item, "analysisContext.recoverySignals[]")
    ),
    rules: readArray(context.rules ?? [], "analysisContext.rules").map((item) =>
      readString(item, "analysisContext.rules[]")
    ),
    technicalFocus: readArray(context.technicalFocus ?? [], "analysisContext.technicalFocus").map((item) =>
      readString(item, "analysisContext.technicalFocus[]")
    ),
    weightCutSignals: readArray(context.weightCutSignals ?? [], "analysisContext.weightCutSignals").map((item) =>
      readString(item, "analysisContext.weightCutSignals[]")
    ),
  };
}

function readAnalysisBlock(value: unknown) {
  const block = readRecord(value, "analysisContext.blocks[]");

  return {
    blockName: readString(block.blockName, "analysisContext.blocks[].blockName"),
    contactIntensity: readEnum(
      block.contactIntensity,
      ["none", "low", "moderate", "high"],
      "analysisContext.blocks[].contactIntensity",
    ),
    energySystem: readString(block.energySystem, "analysisContext.blocks[].energySystem"),
    intent: readString(block.intent, "analysisContext.blocks[].intent"),
    localZones: readArray(block.localZones ?? [], "analysisContext.blocks[].localZones").map((item) =>
      readString(item, "analysisContext.blocks[].localZones[]")
    ),
    rationale: readString(block.rationale, "analysisContext.blocks[].rationale"),
    sessionName: readString(block.sessionName, "analysisContext.blocks[].sessionName"),
    technicalFocus: readArray(block.technicalFocus ?? [], "analysisContext.blocks[].technicalFocus").map((item) =>
      readString(item, "analysisContext.blocks[].technicalFocus[]")
    ),
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

function readWindowDays(value: unknown) {
  const numericValue = readNumber(value, "windowDays");

  if (![7, 14, 30].includes(numericValue)) {
    throw new Error("windowDays must be 7, 14 or 30");
  }

  return numericValue;
}

function readEnum<T extends string>(value: unknown, allowedValues: T[], fieldName: string): T {
  if (typeof value !== "string" || !allowedValues.includes(value as T)) {
    throw new Error(`${fieldName} has unsupported value`);
  }

  return value as T;
}
