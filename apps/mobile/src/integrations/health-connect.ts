import type {
  DeviceHealthDailySummaryPayload,
  DeviceHealthHeartRateSummary,
  DeviceHealthSleepSummary,
  DeviceHealthWorkoutSummary,
  DeviceWorkoutPayload,
  DeviceWorkoutSamplePayload,
  DeviceWorkoutsSyncPayload,
} from "../types/models.js";

interface HealthConnectPlugin {
  isAvailable?: () => Promise<{
    available?: boolean;
    hasKnownHealthSource?: boolean;
    hasMiFitness?: boolean;
    reason?: string;
  }>;
  requestAuthorization?: () => Promise<{ granted?: boolean; reason?: string }>;
  readDailySummary?: (input: { entryDate: string }) => Promise<Partial<DeviceHealthDailySummaryPayload>>;
  readDailyWorkouts?: (input: { entryDate: string }) => Promise<Partial<DeviceWorkoutsSyncPayload>>;
}

type CapacitorWithHealthConnect = {
  Capacitor?: {
    Plugins?: {
      HealthConnect?: HealthConnectPlugin;
    };
  };
};

export async function readMiFitnessHealthConnectDailySummary(
  entryDate: string,
): Promise<DeviceHealthDailySummaryPayload> {
  const plugin = getHealthConnectPlugin();

  if (!plugin?.readDailySummary) {
    throw new Error(
      "Health Connect ещё не подключён в Android-сборке. Нужен Android Health Connect bridge.",
    );
  }

  if (plugin.isAvailable) {
    const availability = await plugin.isAvailable();

    if (!availability.available) {
      throw new Error(availability.reason || "Health Connect недоступен на этом устройстве.");
    }
  }

  if (plugin.requestAuthorization) {
    const authorization = await plugin.requestAuthorization();

    if (!authorization.granted) {
      throw new Error(authorization.reason || "Нет разрешения Health Connect на чтение данных.");
    }
  }

  const summary = await plugin.readDailySummary({ entryDate });

  return {
    entryDate,
    provider: "health-connect",
    sourceDevice: normalizeNullableString(summary.sourceDevice) ?? "Health Connect",
    sleep: normalizeSleepSummary(summary.sleep),
    heartRate: normalizeHeartRateSummary(summary.heartRate),
    workout: normalizeWorkoutSummary(summary.workout),
    rawPayload: isPlainRecord(summary.rawPayload) ? summary.rawPayload : null,
    syncedAt: new Date().toISOString(),
  };
}

export async function readMiFitnessHealthConnectDeviceWorkouts(
  entryDate: string,
): Promise<DeviceWorkoutsSyncPayload> {
  const plugin = getHealthConnectPlugin();

  if (!plugin?.readDailyWorkouts) {
    throw new Error(
      "Health Connect bridge does not support device workout details yet.",
    );
  }

  if (plugin.isAvailable) {
    const availability = await plugin.isAvailable();

    if (!availability.available) {
      throw new Error(availability.reason || "Health Connect РЅРµРґРѕСЃС‚СѓРїРµРЅ РЅР° СЌС‚РѕРј СѓСЃС‚СЂРѕР№СЃС‚РІРµ.");
    }
  }

  if (plugin.requestAuthorization) {
    const authorization = await plugin.requestAuthorization();

    if (!authorization.granted) {
      throw new Error(authorization.reason || "РќРµС‚ СЂР°Р·СЂРµС€РµРЅРёСЏ Health Connect РЅР° С‡С‚РµРЅРёРµ С‚СЂРµРЅРёСЂРѕРІРѕРє.");
    }
  }

  const payload = await plugin.readDailyWorkouts({ entryDate });

  return {
    entryDate,
    provider: "health-connect",
    workouts: Array.isArray(payload.workouts)
      ? payload.workouts
          .map((workout) => normalizeDeviceWorkout(workout, entryDate))
          .filter((workout): workout is DeviceWorkoutPayload => Boolean(workout))
      : [],
  };
}

function getHealthConnectPlugin() {
  return (globalThis as CapacitorWithHealthConnect).Capacitor?.Plugins?.HealthConnect ?? null;
}

function normalizeDeviceWorkout(
  value: unknown,
  entryDate: string,
): DeviceWorkoutPayload | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const startTime = normalizeIsoString(value.startTime);
  const endTime = normalizeIsoString(value.endTime);
  if (!startTime || !endTime) {
    return null;
  }

  const workoutType = normalizeNullableString(value.workoutType) ?? "workout";
  const sourceWorkoutId = normalizeNullableString(value.sourceWorkoutId) ??
    `health-connect:${workoutType}:${startTime}:${endTime}`;

  return {
    activeCalories: normalizeNumber(value.activeCalories),
    averageHeartRateBpm: normalizeNumber(value.averageHeartRateBpm),
    distanceMeters: normalizeNumber(value.distanceMeters),
    durationMinutes: normalizeNumber(value.durationMinutes),
    endTime,
    entryDate,
    maxHeartRateBpm: normalizeNumber(value.maxHeartRateBpm),
    minHeartRateBpm: normalizeNumber(value.minHeartRateBpm),
    provider: "health-connect",
    rawPayload: isPlainRecord(value.rawPayload) ? value.rawPayload : null,
    samples: Array.isArray(value.samples)
      ? value.samples
          .map(normalizeDeviceWorkoutSample)
          .filter((sample): sample is DeviceWorkoutSamplePayload => Boolean(sample))
      : [],
    sourceDevice: normalizeNullableString(value.sourceDevice) ?? "Health Connect",
    sourceWorkoutId,
    startTime,
    syncedAt: new Date().toISOString(),
    workoutType,
  };
}

function normalizeDeviceWorkoutSample(value: unknown): DeviceWorkoutSamplePayload | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const sampleTime = normalizeIsoString(value.sampleTime);
  if (!sampleTime) {
    return null;
  }

  return {
    distanceMeters: normalizeNumber(value.distanceMeters),
    heartRateBpm: normalizeNumber(value.heartRateBpm),
    oxygenSaturationPercent: normalizeNumber(value.oxygenSaturationPercent),
    paceSecondsPerKm: normalizeNumber(value.paceSecondsPerKm),
    rawPayload: isPlainRecord(value.rawPayload) ? value.rawPayload : null,
    sampleTime,
    speedMetersPerSecond: normalizeNumber(value.speedMetersPerSecond),
  };
}

function normalizeSleepSummary(value: unknown): DeviceHealthSleepSummary | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  return {
    awakeMinutes: normalizeNumber(value.awakeMinutes),
    deepMinutes: normalizeNumber(value.deepMinutes),
    durationMinutes: normalizeNumber(value.durationMinutes),
    endTime: normalizeIsoString(value.endTime),
    lightMinutes: normalizeNumber(value.lightMinutes),
    remMinutes: normalizeNumber(value.remMinutes),
    score: normalizeNumber(value.score),
    startTime: normalizeIsoString(value.startTime),
  };
}

function normalizeHeartRateSummary(value: unknown): DeviceHealthHeartRateSummary | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  return {
    averageBpm: normalizeNumber(value.averageBpm),
    hrvRmssdMs: normalizeNumber(value.hrvRmssdMs),
    maxBpm: normalizeNumber(value.maxBpm),
    minBpm: normalizeNumber(value.minBpm),
    restingBpm: normalizeNumber(value.restingBpm),
  };
}

function normalizeWorkoutSummary(value: unknown): DeviceHealthWorkoutSummary | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  return {
    activeCalories: normalizeNumber(value.activeCalories),
    averageHeartRateBpm: normalizeNumber(value.averageHeartRateBpm),
    count: Math.max(0, Math.trunc(normalizeNumber(value.count) ?? 0)),
    maxHeartRateBpm: normalizeNumber(value.maxHeartRateBpm),
    totalDistanceMeters: normalizeNumber(value.totalDistanceMeters),
    totalDurationMinutes: normalizeNumber(value.totalDurationMinutes),
  };
}

function normalizeNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeIsoString(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString();
}

function normalizeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
