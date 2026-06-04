import type {
  DeviceHealthDailySummaryPayload,
  DeviceHealthHeartRateSummary,
  DeviceHealthSleepSummary,
  DeviceHealthWorkoutSummary,
} from "../types/models.js";

interface HuaweiHealthPlugin {
  isAvailable?: () => Promise<HuaweiHealthAvailability>;
  requestAuthorization?: () => Promise<{ granted?: boolean; reason?: string }>;
  readDailySummary?: (input: { entryDate: string }) => Promise<Partial<DeviceHealthDailySummaryPayload>>;
}

export interface HuaweiHealthAvailability {
  available?: boolean;
  hasAgConnectServices?: boolean;
  hasHmsCore?: boolean;
  hasHuaweiHealth?: boolean;
  healthPackage?: string;
  hmsPackage?: string;
  packageName?: string;
  provider?: string;
  reason?: string;
  scopes?: string[];
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
      throw new Error(formatHuaweiHealthAvailabilityError(availability));
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
    oxygenSaturation: null,
    workout: normalizeWorkoutSummary(summary.workout),
    rawPayload: isPlainRecord(summary.rawPayload) ? summary.rawPayload : null,
    syncedAt: new Date().toISOString(),
  };
}

function getHuaweiHealthPlugin() {
  return (globalThis as CapacitorWithHuaweiHealth).Capacitor?.Plugins?.HuaweiHealth ?? null;
}

function formatHuaweiHealthAvailabilityError(availability: HuaweiHealthAvailability) {
  if (!availability.hasAgConnectServices) {
    return "Huawei Health Kit не настроен в этой Android-сборке: нужен apps/mobile/android/app/agconnect-services.json из AppGallery Connect.";
  }

  if (!availability.hasHmsCore) {
    return "На телефоне не найден HMS Core. Установите или обновите HMS Core/AppGallery перед тестом Huawei.";
  }

  if (!availability.hasHuaweiHealth) {
    return "На телефоне не найдено приложение Huawei Health. Сначала подключите часы через Huawei Health.";
  }

  return availability.reason || "Huawei Health недоступен на этом устройстве.";
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
