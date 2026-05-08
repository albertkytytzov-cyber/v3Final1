import type {
  DeviceHealthDailySummaryPayload,
  DeviceHealthHeartRateSummary,
  DeviceHealthSleepSummary,
  DeviceHealthWorkoutSummary,
} from "../types/models.js";

interface HuaweiHealthPlugin {
  isAvailable?: () => Promise<{ available?: boolean; reason?: string }>;
  requestAuthorization?: () => Promise<{ granted?: boolean; reason?: string }>;
  readDailySummary?: (input: { entryDate: string }) => Promise<Partial<DeviceHealthDailySummaryPayload>>;
}

type CapacitorWithHuaweiHealth = {
  Capacitor?: {
    Plugins?: {
      HuaweiHealth?: HuaweiHealthPlugin;
    };
  };
};

export async function readHuaweiHealthDailySummary(
  entryDate: string,
): Promise<DeviceHealthDailySummaryPayload> {
  const plugin = getHuaweiHealthPlugin();

  if (!plugin?.readDailySummary) {
    throw new Error(
      "Huawei Health ещё не подключён в Android-сборке. Нужен HMS Health Kit и agconnect-services.json.",
    );
  }

  if (plugin.isAvailable) {
    const availability = await plugin.isAvailable();

    if (!availability.available) {
      throw new Error(availability.reason || "Huawei Health недоступен на этом устройстве.");
    }
  }

  if (plugin.requestAuthorization) {
    const authorization = await plugin.requestAuthorization();

    if (!authorization.granted) {
      throw new Error(authorization.reason || "Нет разрешения на чтение Huawei Health.");
    }
  }

  const summary = await plugin.readDailySummary({ entryDate });

  return {
    entryDate,
    provider: "huawei-health",
    sourceDevice: normalizeNullableString(summary.sourceDevice),
    sleep: normalizeSleepSummary(summary.sleep),
    heartRate: normalizeHeartRateSummary(summary.heartRate),
    workout: normalizeWorkoutSummary(summary.workout),
    rawPayload: isPlainRecord(summary.rawPayload) ? summary.rawPayload : null,
    syncedAt: new Date().toISOString(),
  };
}

function getHuaweiHealthPlugin() {
  return (globalThis as CapacitorWithHuaweiHealth).Capacitor?.Plugins?.HuaweiHealth ?? null;
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
