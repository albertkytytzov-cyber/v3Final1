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
  try {
    writeJson(SNAPSHOT_KEY, snapshot);
  } catch {
    try {
      window.localStorage.removeItem(SNAPSHOT_KEY);
      writeJson(SNAPSHOT_KEY, compactSnapshotForStorage(snapshot));
    } catch {
      try {
        window.localStorage.removeItem(SNAPSHOT_KEY);
        writeJson(SNAPSHOT_KEY, {
          ...compactSnapshotForStorage(snapshot),
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
    deviceWorkouts: snapshot.deviceWorkouts.map((workout) => ({
      ...workout,
      rawPayload: null,
      samples: [],
    })),
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
