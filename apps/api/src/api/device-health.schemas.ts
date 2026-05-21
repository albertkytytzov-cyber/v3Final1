import type {
  DeviceHealthDailySummaryPayload,
  DeviceHealthHeartRateSummary,
  DeviceHealthOxygenSaturationSummary,
  DeviceHealthProvider,
  DeviceHealthSleepSummary,
  DeviceHealthWorkoutSummary,
  DeviceWorkoutLinkPayload,
  DeviceWorkoutPayload,
  DeviceWorkoutSamplePayload,
  DeviceWorkoutsSyncPayload,
} from "@training-platform/shared";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const providers: DeviceHealthProvider[] = ["huawei-health", "health-connect", "apple-health", "direct-watch"];

export function parseDeviceHealthAthleteParams(params: unknown): { athleteId: string } {
  const athleteId = (params as { athleteId?: unknown } | null)?.athleteId;

  if (typeof athleteId !== "string" || !athleteId) {
    throw new Error("athleteId is required");
  }

  return { athleteId };
}

export function parseDeviceWorkoutLinkParams(params: unknown): {
  athleteId: string;
  linkId: string;
} {
  const athleteId = (params as { athleteId?: unknown } | null)?.athleteId;
  const linkId = (params as { linkId?: unknown } | null)?.linkId;

  if (typeof athleteId !== "string" || !athleteId) {
    throw new Error("athleteId is required");
  }

  if (typeof linkId !== "string" || !linkId) {
    throw new Error("linkId is required");
  }

  return { athleteId, linkId };
}

export function parseDeviceHealthSummaryBody(body: unknown): DeviceHealthDailySummaryPayload {
  const payload = readRecord(body, "payload");

  return {
    entryDate: readEntryDate(payload.entryDate),
    provider: readEnum(payload.provider, providers, "provider"),
    sourceDevice: readNullableString(payload.sourceDevice, "sourceDevice"),
    sleep: payload.sleep === null || payload.sleep === undefined
      ? null
      : readSleepSummary(payload.sleep),
    heartRate: payload.heartRate === null || payload.heartRate === undefined
      ? null
      : readHeartRateSummary(payload.heartRate),
    oxygenSaturation: payload.oxygenSaturation === null || payload.oxygenSaturation === undefined
      ? null
      : readOxygenSaturationSummary(payload.oxygenSaturation),
    workout: payload.workout === null || payload.workout === undefined
      ? null
      : readWorkoutSummary(payload.workout),
    rawPayload: readRawPayload(payload.rawPayload),
    syncedAt: readNullableIsoDateTime(payload.syncedAt, "syncedAt"),
  };
}

export function parseDeviceHealthSummariesQuery(query: unknown): { entryDate?: string } {
  return parseDeviceHealthEntryDateQuery(query);
}

export function parseDeviceWorkoutsQuery(query: unknown): { entryDate?: string } {
  return parseDeviceHealthEntryDateQuery(query);
}

function parseDeviceHealthEntryDateQuery(query: unknown): { entryDate?: string } {
  const entryDate = (query as { entryDate?: unknown } | null)?.entryDate;

  if (entryDate === undefined || entryDate === null || entryDate === "") {
    return {};
  }

  return { entryDate: readEntryDate(entryDate) };
}

export function parseDeviceWorkoutsSyncBody(body: unknown): DeviceWorkoutsSyncPayload {
  const payload = readRecord(body, "payload");
  const entryDate = readEntryDate(payload.entryDate);
  const provider = readEnum(payload.provider, providers, "provider");
  const workouts = readArray(payload.workouts, "workouts", MAX_WORKOUTS_PER_DAY).map((value, index) =>
    readDeviceWorkoutPayload(value, entryDate, provider, index),
  );

  return {
    entryDate,
    provider,
    workouts,
  };
}

export function parseDeviceWorkoutLinkBody(body: unknown): DeviceWorkoutLinkPayload {
  const payload = readRecord(body, "payload");

  return {
    assignedPlanId: readRequiredString(payload.assignedPlanId, "assignedPlanId"),
    assignedBlockId: readRequiredString(payload.assignedBlockId, "assignedBlockId"),
    assignedExerciseId: readNullableString(payload.assignedExerciseId, "assignedExerciseId"),
    deviceWorkoutId: readRequiredString(payload.deviceWorkoutId, "deviceWorkoutId"),
  };
}

function readSleepSummary(value: unknown): DeviceHealthSleepSummary {
  const sleep = readRecord(value, "sleep");

  return {
    awakeMinutes: readNullableNumber(sleep.awakeMinutes, "sleep.awakeMinutes"),
    deepMinutes: readNullableNumber(sleep.deepMinutes, "sleep.deepMinutes"),
    durationMinutes: readNullableNumber(sleep.durationMinutes, "sleep.durationMinutes"),
    endTime: readNullableIsoDateTime(sleep.endTime, "sleep.endTime"),
    lightMinutes: readNullableNumber(sleep.lightMinutes, "sleep.lightMinutes"),
    remMinutes: readNullableNumber(sleep.remMinutes, "sleep.remMinutes"),
    score: readNullableNumber(sleep.score, "sleep.score"),
    startTime: readNullableIsoDateTime(sleep.startTime, "sleep.startTime"),
  };
}

function readHeartRateSummary(value: unknown): DeviceHealthHeartRateSummary {
  const heartRate = readRecord(value, "heartRate");

  return {
    averageBpm: readNullableNumber(heartRate.averageBpm, "heartRate.averageBpm"),
    hrvRmssdMs: readNullableNumber(heartRate.hrvRmssdMs, "heartRate.hrvRmssdMs"),
    maxBpm: readNullableNumber(heartRate.maxBpm, "heartRate.maxBpm"),
    minBpm: readNullableNumber(heartRate.minBpm, "heartRate.minBpm"),
    restingBpm: readNullableNumber(heartRate.restingBpm, "heartRate.restingBpm"),
  };
}

function readOxygenSaturationSummary(value: unknown): DeviceHealthOxygenSaturationSummary {
  const oxygenSaturation = readRecord(value, "oxygenSaturation");

  return {
    averagePercent: readNullableNumber(oxygenSaturation.averagePercent, "oxygenSaturation.averagePercent"),
    latestPercent: readNullableNumber(oxygenSaturation.latestPercent, "oxygenSaturation.latestPercent"),
    maxPercent: readNullableNumber(oxygenSaturation.maxPercent, "oxygenSaturation.maxPercent"),
    minPercent: readNullableNumber(oxygenSaturation.minPercent, "oxygenSaturation.minPercent"),
    sampleCount: readCount(oxygenSaturation.sampleCount, "oxygenSaturation.sampleCount"),
  };
}

function readWorkoutSummary(value: unknown): DeviceHealthWorkoutSummary {
  const workout = readRecord(value, "workout");

  return {
    activeCalories: readNullableNumber(workout.activeCalories, "workout.activeCalories"),
    averageHeartRateBpm: readNullableNumber(
      workout.averageHeartRateBpm,
      "workout.averageHeartRateBpm",
    ),
    count: readCount(workout.count, "workout.count"),
    maxHeartRateBpm: readNullableNumber(workout.maxHeartRateBpm, "workout.maxHeartRateBpm"),
    totalDistanceMeters: readNullableNumber(
      workout.totalDistanceMeters,
      "workout.totalDistanceMeters",
    ),
    totalDurationMinutes: readNullableNumber(
      workout.totalDurationMinutes,
      "workout.totalDurationMinutes",
    ),
  };
}

function readDeviceWorkoutPayload(
  value: unknown,
  expectedEntryDate: string,
  expectedProvider: DeviceHealthProvider,
  index: number,
): DeviceWorkoutPayload {
  const workout = readRecord(value, `workouts[${index}]`);
  const entryDate = readEntryDate(workout.entryDate);
  const provider = readEnum(workout.provider, providers, `workouts[${index}].provider`);

  if (entryDate !== expectedEntryDate) {
    throw new Error(`workouts[${index}].entryDate must match entryDate`);
  }

  if (provider !== expectedProvider) {
    throw new Error(`workouts[${index}].provider must match provider`);
  }

  const startTime = readRequiredIsoDateTime(workout.startTime, `workouts[${index}].startTime`);
  const endTime = readRequiredIsoDateTime(workout.endTime, `workouts[${index}].endTime`);

  if (new Date(endTime).getTime() <= new Date(startTime).getTime()) {
    throw new Error(`workouts[${index}].endTime must be after startTime`);
  }

  return {
    activeCalories: readNullableNumber(workout.activeCalories, `workouts[${index}].activeCalories`),
    averageHeartRateBpm: readNullableNumber(
      workout.averageHeartRateBpm,
      `workouts[${index}].averageHeartRateBpm`,
    ),
    distanceMeters: readNullableNumber(workout.distanceMeters, `workouts[${index}].distanceMeters`),
    durationMinutes: readNullableNumber(workout.durationMinutes, `workouts[${index}].durationMinutes`),
    endTime,
    entryDate,
    maxHeartRateBpm: readNullableNumber(workout.maxHeartRateBpm, `workouts[${index}].maxHeartRateBpm`),
    minHeartRateBpm: readNullableNumber(workout.minHeartRateBpm, `workouts[${index}].minHeartRateBpm`),
    provider,
    rawPayload: readRawPayload(workout.rawPayload),
    samples: readArray(workout.samples, `workouts[${index}].samples`, MAX_SAMPLES_PER_WORKOUT).map(
      (sample, sampleIndex) => readDeviceWorkoutSample(sample, index, sampleIndex),
    ),
    sourceDevice: readNullableString(workout.sourceDevice, `workouts[${index}].sourceDevice`),
    sourceWorkoutId: readRequiredString(workout.sourceWorkoutId, `workouts[${index}].sourceWorkoutId`),
    startTime,
    syncedAt: readNullableIsoDateTime(workout.syncedAt, `workouts[${index}].syncedAt`),
    workoutType: readRequiredString(workout.workoutType, `workouts[${index}].workoutType`),
  };
}

function readDeviceWorkoutSample(
  value: unknown,
  workoutIndex: number,
  sampleIndex: number,
): DeviceWorkoutSamplePayload {
  const sample = readRecord(value, `workouts[${workoutIndex}].samples[${sampleIndex}]`);

  return {
    distanceMeters: readNullableNumber(
      sample.distanceMeters,
      `workouts[${workoutIndex}].samples[${sampleIndex}].distanceMeters`,
    ),
    heartRateBpm: readNullableNumber(
      sample.heartRateBpm,
      `workouts[${workoutIndex}].samples[${sampleIndex}].heartRateBpm`,
    ),
    oxygenSaturationPercent: readNullableNumber(
      sample.oxygenSaturationPercent,
      `workouts[${workoutIndex}].samples[${sampleIndex}].oxygenSaturationPercent`,
    ),
    paceSecondsPerKm: readNullableNumber(
      sample.paceSecondsPerKm,
      `workouts[${workoutIndex}].samples[${sampleIndex}].paceSecondsPerKm`,
    ),
    rawPayload: readRawPayload(sample.rawPayload),
    sampleTime: readRequiredIsoDateTime(
      sample.sampleTime,
      `workouts[${workoutIndex}].samples[${sampleIndex}].sampleTime`,
    ),
    speedMetersPerSecond: readNullableNumber(
      sample.speedMetersPerSecond,
      `workouts[${workoutIndex}].samples[${sampleIndex}].speedMetersPerSecond`,
    ),
  };
}

function readRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object`);
  }

  return value as Record<string, unknown>;
}

function readArray(value: unknown, fieldName: string, maxLength: number): unknown[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }

  if (value.length > maxLength) {
    throw new Error(`${fieldName} is too large`);
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

function readRequiredIsoDateTime(value: unknown, fieldName: string) {
  const dateTime = readNullableIsoDateTime(value, fieldName);
  if (!dateTime) {
    throw new Error(`${fieldName} is required`);
  }

  return dateTime;
}

function readNullableIsoDateTime(value: unknown, fieldName: string) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be an ISO date-time string`);
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(`${fieldName} must be a valid ISO date-time string`);
  }

  return parsedDate.toISOString();
}

function readRequiredString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} is required`);
  }

  return value.trim();
}

function readNullableString(value: unknown, fieldName: string) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }

  return value.trim() || null;
}

function readNullableNumber(value: unknown, fieldName: string) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    throw new Error(`${fieldName} must be a number`);
  }

  return numericValue;
}

function readCount(value: unknown, fieldName: string) {
  const numericValue = Number(value);

  if (!Number.isInteger(numericValue) || numericValue < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`);
  }

  return numericValue;
}

function readRawPayload(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("rawPayload must be an object");
  }

  return value as Record<string, unknown>;
}

function readEnum<T extends string>(value: unknown, allowedValues: T[], fieldName: string): T {
  if (typeof value !== "string" || !allowedValues.includes(value as T)) {
    throw new Error(`${fieldName} has unsupported value`);
  }

  return value as T;
}

const MAX_WORKOUTS_PER_DAY = 20;
const MAX_SAMPLES_PER_WORKOUT = 2500;
