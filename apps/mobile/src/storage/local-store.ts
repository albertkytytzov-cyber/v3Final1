import { normalizeApiBaseUrl } from "../config.js";
import {
  createEmptySnapshot,
  type MobileDataSnapshot,
  type MobileSessionState,
  type PendingSyncAction,
} from "../types/models.js";

const SESSION_KEY = "perform.mobile.session";
const SNAPSHOT_KEY = "perform.mobile.snapshot";
const QUEUE_KEY = "perform.mobile.syncQueue";
const SELECTED_ATHLETE_KEY = "perform.mobile.selectedAthleteId";
const DIRECT_WATCH_CONFIG_KEY = "perform.mobile.directWatchConfig";

export interface DirectWatchLocalConfig {
  authKeyHex: string | null;
  deviceId: string | null;
  deviceName: string | null;
  lastHistorySyncCompletedDays: number | null;
  lastHistorySyncAvailableDays: number | null;
  lastHistorySyncCurrentDate: string | null;
  lastHistorySyncError: string | null;
  lastHistorySyncFileCount: number | null;
  lastHistorySyncStartedAt: string | null;
  lastHistorySyncStatus: "completed" | "error" | "partial" | "running" | null;
  lastHistorySyncSuccessDays: number | null;
  lastHistorySyncTotalDays: number | null;
  lastHistorySyncedAt: string | null;
  lastActivitySyncAt: string | null;
  lastActivitySyncDiagnostic: string | null;
  lastActivitySyncFileCount: number | null;
  lastActivitySyncSportsFileCount: number | null;
  lastActivitySyncStatus: "error" | "ok" | "warning" | null;
  lastActivitySyncWorkoutCount: number | null;
  lastServiceBridgeUntil: string | null;
  lastServiceError: string | null;
  lastServiceStatus: "error" | "running" | "stopped" | "synced" | null;
  lastServiceSyncedAt: string | null;
  lastServiceUpdatedAt: string | null;
  weatherCity: string | null;
  weatherLatitude: number | null;
  weatherLongitude: number | null;
}

function readJson<T>(key: string, fallback: T): T {
  const rawValue = window.localStorage.getItem(key);

  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadSession(defaultApiBaseUrl: string): MobileSessionState {
  const session = readJson<MobileSessionState>(SESSION_KEY, {
    apiBaseUrl: defaultApiBaseUrl,
    sessionToken: null,
    user: null,
  });

  return {
    apiBaseUrl: normalizeApiBaseUrl(session.apiBaseUrl || defaultApiBaseUrl),
    sessionToken: session.sessionToken ?? null,
    user: session.user ?? null,
  };
}

export function saveSession(session: MobileSessionState) {
  writeJson(SESSION_KEY, {
    ...session,
    apiBaseUrl: normalizeApiBaseUrl(session.apiBaseUrl),
  });
}

export function clearSession(defaultApiBaseUrl: string) {
  saveSession({
    apiBaseUrl: defaultApiBaseUrl,
    sessionToken: null,
    user: null,
  });
}

export function loadSnapshot(): MobileDataSnapshot {
  return {
    ...createEmptySnapshot(),
    ...readJson<Partial<MobileDataSnapshot>>(SNAPSHOT_KEY, {}),
  };
}

export function saveSnapshot(snapshot: MobileDataSnapshot) {
  const compactSnapshot = compactSnapshotForStorage(snapshot);

  try {
    writeJson(SNAPSHOT_KEY, compactSnapshot);
  } catch {
    try {
      window.localStorage.removeItem(SNAPSHOT_KEY);
      writeJson(SNAPSHOT_KEY, compactSnapshot);
    } catch {
      try {
        window.localStorage.removeItem(SNAPSHOT_KEY);
        writeJson(SNAPSHOT_KEY, {
          ...compactSnapshot,
          deviceWorkouts: [],
          deviceWorkoutLinks: [],
        });
      } catch {
        window.localStorage.removeItem(SNAPSHOT_KEY);
      }
    }
  }
}

function compactSnapshotForStorage(snapshot: MobileDataSnapshot): MobileDataSnapshot {
  return {
    ...snapshot,
    deviceHealthSummaries: snapshot.deviceHealthSummaries.map((summary) => ({
      ...summary,
      rawPayload: null,
    })),
    deviceHealthSamples: snapshot.deviceHealthSamples
      .filter((sample) => sample.metric === "heart_rate" || sample.metric === "oxygen_saturation" || sample.metric === "stress")
      .sort((left, right) =>
        right.entryDate.localeCompare(left.entryDate) ||
        left.metric.localeCompare(right.metric) ||
        left.sampledAt.localeCompare(right.sampledAt),
      )
      .slice(0, 6000)
      .map((sample) => ({
        ...sample,
        rawPayload: null,
      })),
    deviceWorkouts: snapshot.deviceWorkouts.map((workout) => ({
      ...workout,
      rawPayload: null,
      samples: [],
    })),
    deviceWorkoutLinks: snapshot.deviceWorkoutLinks.map(compactDeviceWorkoutLinkForStorage),
  };
}

function compactDeviceWorkoutLinkForStorage(link: MobileDataSnapshot["deviceWorkoutLinks"][number]) {
  return {
    ...link,
    workout: {
      ...link.workout,
      rawPayload: null,
      samples: [],
    },
  };
}

export function loadQueue(): PendingSyncAction[] {
  return readJson<PendingSyncAction[]>(QUEUE_KEY, []);
}

export function saveQueue(queue: PendingSyncAction[]) {
  writeJson(QUEUE_KEY, queue);
}

export function loadSelectedAthleteId() {
  return window.localStorage.getItem(SELECTED_ATHLETE_KEY);
}

export function saveSelectedAthleteId(athleteId: string | null) {
  if (athleteId) {
    window.localStorage.setItem(SELECTED_ATHLETE_KEY, athleteId);
    return;
  }

  window.localStorage.removeItem(SELECTED_ATHLETE_KEY);
}

export function loadDirectWatchConfig(): DirectWatchLocalConfig {
  const config = readJson<Partial<DirectWatchLocalConfig>>(DIRECT_WATCH_CONFIG_KEY, {});

  return {
    authKeyHex: normalizeAuthKey(config.authKeyHex),
    deviceId: normalizeText(config.deviceId),
    deviceName: normalizeText(config.deviceName),
    lastHistorySyncAvailableDays: normalizeNonNegativeNumber(config.lastHistorySyncAvailableDays),
    lastHistorySyncCompletedDays: normalizeNonNegativeNumber(config.lastHistorySyncCompletedDays),
    lastHistorySyncCurrentDate: normalizeText(config.lastHistorySyncCurrentDate),
    lastHistorySyncError: normalizeText(config.lastHistorySyncError),
    lastHistorySyncFileCount: normalizeNonNegativeNumber(config.lastHistorySyncFileCount),
    lastHistorySyncStartedAt: normalizeText(config.lastHistorySyncStartedAt),
    lastHistorySyncStatus: normalizeDirectWatchHistoryStatus(config.lastHistorySyncStatus),
    lastHistorySyncSuccessDays: normalizeNonNegativeNumber(config.lastHistorySyncSuccessDays),
    lastHistorySyncTotalDays: normalizeNonNegativeNumber(config.lastHistorySyncTotalDays),
    lastHistorySyncedAt: normalizeText(config.lastHistorySyncedAt),
    lastActivitySyncAt: normalizeText(config.lastActivitySyncAt),
    lastActivitySyncDiagnostic: normalizeText(config.lastActivitySyncDiagnostic),
    lastActivitySyncFileCount: normalizeNonNegativeNumber(config.lastActivitySyncFileCount),
    lastActivitySyncSportsFileCount: normalizeNonNegativeNumber(config.lastActivitySyncSportsFileCount),
    lastActivitySyncStatus: normalizeDirectWatchActivitySyncStatus(config.lastActivitySyncStatus),
    lastActivitySyncWorkoutCount: normalizeNonNegativeNumber(config.lastActivitySyncWorkoutCount),
    lastServiceBridgeUntil: normalizeText(config.lastServiceBridgeUntil),
    lastServiceError: normalizeText(config.lastServiceError),
    lastServiceStatus: normalizeDirectWatchServiceStatus(config.lastServiceStatus),
    lastServiceSyncedAt: normalizeText(config.lastServiceSyncedAt),
    lastServiceUpdatedAt: normalizeText(config.lastServiceUpdatedAt),
    weatherCity: normalizeText(config.weatherCity),
    weatherLatitude: normalizeNumber(config.weatherLatitude),
    weatherLongitude: normalizeNumber(config.weatherLongitude),
  };
}

export function saveDirectWatchConfig(config: DirectWatchLocalConfig) {
  writeJson(DIRECT_WATCH_CONFIG_KEY, {
    authKeyHex: normalizeAuthKey(config.authKeyHex),
    deviceId: normalizeText(config.deviceId),
    deviceName: normalizeText(config.deviceName),
    lastHistorySyncAvailableDays: normalizeNonNegativeNumber(config.lastHistorySyncAvailableDays),
    lastHistorySyncCompletedDays: normalizeNonNegativeNumber(config.lastHistorySyncCompletedDays),
    lastHistorySyncCurrentDate: normalizeText(config.lastHistorySyncCurrentDate),
    lastHistorySyncError: normalizeText(config.lastHistorySyncError),
    lastHistorySyncFileCount: normalizeNonNegativeNumber(config.lastHistorySyncFileCount),
    lastHistorySyncStartedAt: normalizeText(config.lastHistorySyncStartedAt),
    lastHistorySyncStatus: normalizeDirectWatchHistoryStatus(config.lastHistorySyncStatus),
    lastHistorySyncSuccessDays: normalizeNonNegativeNumber(config.lastHistorySyncSuccessDays),
    lastHistorySyncTotalDays: normalizeNonNegativeNumber(config.lastHistorySyncTotalDays),
    lastHistorySyncedAt: normalizeText(config.lastHistorySyncedAt),
    lastActivitySyncAt: normalizeText(config.lastActivitySyncAt),
    lastActivitySyncDiagnostic: normalizeText(config.lastActivitySyncDiagnostic),
    lastActivitySyncFileCount: normalizeNonNegativeNumber(config.lastActivitySyncFileCount),
    lastActivitySyncSportsFileCount: normalizeNonNegativeNumber(config.lastActivitySyncSportsFileCount),
    lastActivitySyncStatus: normalizeDirectWatchActivitySyncStatus(config.lastActivitySyncStatus),
    lastActivitySyncWorkoutCount: normalizeNonNegativeNumber(config.lastActivitySyncWorkoutCount),
    lastServiceBridgeUntil: normalizeText(config.lastServiceBridgeUntil),
    lastServiceError: normalizeText(config.lastServiceError),
    lastServiceStatus: normalizeDirectWatchServiceStatus(config.lastServiceStatus),
    lastServiceSyncedAt: normalizeText(config.lastServiceSyncedAt),
    lastServiceUpdatedAt: normalizeText(config.lastServiceUpdatedAt),
    weatherCity: normalizeText(config.weatherCity),
    weatherLatitude: normalizeNumber(config.weatherLatitude),
    weatherLongitude: normalizeNumber(config.weatherLongitude),
  });
}

function normalizeAuthKey(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(/[^0-9a-f]/gi, "").toLowerCase();
  return normalized.length === 32 ? normalized : null;
}

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeDirectWatchServiceStatus(value: unknown) {
  return value === "error" || value === "running" || value === "stopped" || value === "synced"
    ? value
    : null;
}

function normalizeDirectWatchHistoryStatus(value: unknown) {
  return value === "completed" || value === "error" || value === "partial" || value === "running"
    ? value
    : null;
}

function normalizeDirectWatchActivitySyncStatus(value: unknown) {
  return value === "error" || value === "ok" || value === "warning" ? value : null;
}

function normalizeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeNonNegativeNumber(value: unknown) {
  const numberValue = normalizeNumber(value);
  return numberValue !== null && numberValue >= 0 ? numberValue : null;
}
