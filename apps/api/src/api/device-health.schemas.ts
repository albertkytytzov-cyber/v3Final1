import type {
  DeviceHealthDailySummaryPayload,
  DeviceHealthHeartRateSummary,
  DeviceHealthProvider,
  DeviceHealthSleepSummary,
  DeviceHealthWorkoutSummary,
} from "@training-platform/shared";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const providers: DeviceHealthProvider[] = ["huawei-health"];

export function parseDeviceHealthAthleteParams(params: unknown): { athleteId: string } {
  const athleteId = (params as { athleteId?: unknown } | null)?.athleteId;

  if (typeof athleteId !== "string" || !athleteId) {
    throw new Error("athleteId is required");
  }

  return { athleteId };
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
    workout: payload.workout === null || payload.workout === undefined
      ? null
      : readWorkoutSummary(payload.workout),
    rawPayload: readRawPayload(payload.rawPayload),
    syncedAt: readNullableIsoDateTime(payload.syncedAt, "syncedAt"),
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

function readRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object`);
  }

  return value as Record<string, unknown>;
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
