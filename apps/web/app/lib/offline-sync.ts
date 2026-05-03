import type {
  AnalyticsCoachActionDecisionPayload,
  ExecutionResultInput,
  ReadinessSubmissionPayload,
} from "@training-platform/shared";

export type CacheRecord<T> = {
  savedAt: string;
  data: T;
};

export type QueueItemStatus = "pending" | "syncing" | "failed" | "synced";

type QueueItemBase = {
  id: string;
  clientRequestId: string;
  dedupeKey: string;
  createdAt: string;
  lastAttemptAt: string | null;
  syncedAt: string | null;
  attemptCount: number;
  status: QueueItemStatus;
  error: string | null;
};

export type QueueItem =
  | (QueueItemBase & {
      type: "readiness";
      payload: ReadinessSubmissionPayload;
    })
  | (QueueItemBase & {
      type: "execution";
      payload: ExecutionResultInput;
    })
  | (QueueItemBase & {
      type: "analytics-decision";
      athleteId: string;
      payload: AnalyticsCoachActionDecisionPayload;
    });

type LegacyQueueItem =
  | {
      id?: string;
      type: "readiness";
      payload: ReadinessSubmissionPayload;
      createdAt?: string;
    }
  | {
      id?: string;
      type: "execution";
      payload: ExecutionResultInput;
      createdAt?: string;
    };

export const STORAGE_KEYS = {
  language: "training-platform-language",
  authUser: "training-platform-cache-auth-user",
  readiness: "training-platform-cache-readiness",
  assignedPlans: "training-platform-cache-assigned-plans",
  adaptedPlan: "training-platform-cache-adapted-plan",
  execution: "training-platform-cache-execution",
  analytics: "training-platform-cache-analytics",
  queue: "training-platform-offline-queue-v2",
} as const;

function createStableId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `offline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );
}

function readinessDedupeKey(entryDate: string) {
  return `readiness:${entryDate}`;
}

function executionDedupeKey(payload: ExecutionResultInput) {
  return `execution:${payload.assignedBlockId}`;
}

function analyticsDecisionDedupeKey(
  athleteId: string,
  payload: AnalyticsCoachActionDecisionPayload,
) {
  return `analytics:${athleteId}:${payload.suggestionId}:${payload.weekStartDate}`;
}

function sortQueueItems(items: QueueItem[]) {
  return [...items].sort((left, right) => {
    const leftRank = left.status === "synced" ? 1 : 0;
    const rightRank = right.status === "synced" ? 1 : 0;

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    const leftDate = left.syncedAt ?? left.lastAttemptAt ?? left.createdAt;
    const rightDate = right.syncedAt ?? right.lastAttemptAt ?? right.createdAt;
    return rightDate.localeCompare(leftDate);
  });
}

function pruneSyncedItems(items: QueueItem[]) {
  const active = items.filter((item) => item.status !== "synced");
  const synced = items
    .filter((item) => item.status === "synced")
    .sort((left, right) => (right.syncedAt ?? right.createdAt).localeCompare(left.syncedAt ?? left.createdAt))
    .slice(0, 12);

  return sortQueueItems([...active, ...synced]);
}

function normalizeLegacyQueueItem(item: LegacyQueueItem | QueueItem): QueueItem | null {
  const createdAt =
    "createdAt" in item && item.createdAt ? item.createdAt : new Date().toISOString();

  if (item.type === "readiness") {
    const clientRequestId =
      "clientRequestId" in item && item.clientRequestId ? item.clientRequestId : createStableId();

    return {
      id: "id" in item && item.id ? item.id : createStableId(),
      type: "readiness",
      payload: item.payload,
      clientRequestId,
      dedupeKey:
        "dedupeKey" in item && item.dedupeKey
          ? item.dedupeKey
          : readinessDedupeKey(item.payload.entryDate ?? createdAt.slice(0, 10)),
      createdAt,
      lastAttemptAt:
        "lastAttemptAt" in item && item.lastAttemptAt ? item.lastAttemptAt : null,
      syncedAt: "syncedAt" in item && item.syncedAt ? item.syncedAt : null,
      attemptCount:
        "attemptCount" in item && typeof item.attemptCount === "number" ? item.attemptCount : 0,
      status: "status" in item && item.status ? item.status : "pending",
      error: "error" in item && typeof item.error === "string" ? item.error : null,
    };
  }

  if (item.type === "execution") {
    const clientRequestId =
      "clientRequestId" in item && item.clientRequestId ? item.clientRequestId : createStableId();

    return {
      id: "id" in item && item.id ? item.id : createStableId(),
      type: "execution",
      payload: item.payload,
      clientRequestId,
      dedupeKey:
        "dedupeKey" in item && item.dedupeKey
          ? item.dedupeKey
          : executionDedupeKey(item.payload),
      createdAt,
      lastAttemptAt:
        "lastAttemptAt" in item && item.lastAttemptAt ? item.lastAttemptAt : null,
      syncedAt: "syncedAt" in item && item.syncedAt ? item.syncedAt : null,
      attemptCount:
        "attemptCount" in item && typeof item.attemptCount === "number" ? item.attemptCount : 0,
      status: "status" in item && item.status ? item.status : "pending",
      error: "error" in item && typeof item.error === "string" ? item.error : null,
    };
  }

  if (item.type === "analytics-decision") {
    if (!("athleteId" in item) || !item.athleteId) {
      return null;
    }

    const clientRequestId =
      "clientRequestId" in item && item.clientRequestId ? item.clientRequestId : createStableId();

    return {
      id: "id" in item && item.id ? item.id : createStableId(),
      type: "analytics-decision",
      athleteId: item.athleteId,
      payload: item.payload,
      clientRequestId,
      dedupeKey:
        "dedupeKey" in item && item.dedupeKey
          ? item.dedupeKey
          : analyticsDecisionDedupeKey(item.athleteId, item.payload),
      createdAt,
      lastAttemptAt:
        "lastAttemptAt" in item && item.lastAttemptAt ? item.lastAttemptAt : null,
      syncedAt: "syncedAt" in item && item.syncedAt ? item.syncedAt : null,
      attemptCount:
        "attemptCount" in item && typeof item.attemptCount === "number" ? item.attemptCount : 0,
      status: "status" in item && item.status ? item.status : "pending",
      error: "error" in item && typeof item.error === "string" ? item.error : null,
    };
  }

  return null;
}

export function isBrowser() {
  return typeof window !== "undefined";
}

export function readStorage<T>(key: string): T | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeStorage<T>(key: string, value: T) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function writeCachedData<T>(key: string, data: T) {
  writeStorage<CacheRecord<T>>(key, {
    savedAt: new Date().toISOString(),
    data,
  });
}

export function readCachedData<T>(key: string) {
  return readStorage<CacheRecord<T>>(key);
}

export function getOfflineQueue() {
  const rawItems = readStorage<Array<LegacyQueueItem | QueueItem>>(STORAGE_KEYS.queue) ?? [];
  const normalized = rawItems
    .map((item) => normalizeLegacyQueueItem(item))
    .filter((item): item is QueueItem => item !== null);
  const normalizedQueue = pruneSyncedItems(normalized);

  if (isBrowser()) {
    const normalizedRaw = JSON.stringify(normalizedQueue);
    const currentRaw = JSON.stringify(rawItems);

    if (normalizedRaw !== currentRaw) {
      writeStorage(STORAGE_KEYS.queue, normalizedQueue);
    }
  }

  return normalizedQueue;
}

export function setOfflineQueue(items: QueueItem[]) {
  writeStorage(STORAGE_KEYS.queue, pruneSyncedItems(items));
}

export function countActiveQueueItems(items: QueueItem[]) {
  return items.filter((item) => item.status !== "synced").length;
}

export function getQueueStatusCounts(items: QueueItem[]) {
  return items.reduce(
    (accumulator, item) => {
      accumulator[item.status] += 1;
      return accumulator;
    },
    {
      pending: 0,
      syncing: 0,
      failed: 0,
      synced: 0,
    } satisfies Record<QueueItemStatus, number>,
  );
}

export function getQueueErrorMap(items: QueueItem[]) {
  return items.reduce<Record<string, string>>((accumulator, item) => {
    if (item.status === "failed" && item.error) {
      accumulator[item.id] = item.error;
    }

    return accumulator;
  }, {});
}

export function getActiveQueueItems(items: QueueItem[] = getOfflineQueue()) {
  return [...items]
    .filter((item) => item.status !== "synced")
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function updateQueueItem(
  items: QueueItem[],
  itemId: string,
  patch: Partial<QueueItem>,
) {
  return items.map((item) => (item.id === itemId ? ({ ...item, ...patch } as QueueItem) : item));
}

export function createQueueItem(
  input:
    | {
        type: "readiness";
        payload: ReadinessSubmissionPayload;
      }
    | {
        type: "execution";
        payload: ExecutionResultInput;
      }
    | {
        type: "analytics-decision";
        athleteId: string;
        payload: AnalyticsCoachActionDecisionPayload;
      },
): QueueItem {
  const createdAt = new Date().toISOString();
  const clientRequestId = createStableId();
  const id = createStableId();

  if (input.type === "readiness") {
    return {
      id,
      type: "readiness",
      payload: input.payload,
      clientRequestId,
      dedupeKey: readinessDedupeKey(input.payload.entryDate ?? createdAt.slice(0, 10)),
      createdAt,
      lastAttemptAt: null,
      syncedAt: null,
      attemptCount: 0,
      status: "pending",
      error: null,
    };
  }

  if (input.type === "execution") {
    return {
      id,
      type: "execution",
      payload: input.payload,
      clientRequestId,
      dedupeKey: executionDedupeKey(input.payload),
      createdAt,
      lastAttemptAt: null,
      syncedAt: null,
      attemptCount: 0,
      status: "pending",
      error: null,
    };
  }

  return {
    id,
    type: "analytics-decision",
    athleteId: input.athleteId,
    payload: input.payload,
    clientRequestId,
    dedupeKey: analyticsDecisionDedupeKey(input.athleteId, input.payload),
    createdAt,
    lastAttemptAt: null,
    syncedAt: null,
    attemptCount: 0,
    status: "pending",
    error: null,
  };
}

export function enqueueOfflineItem(item: QueueItem) {
  const queue = getOfflineQueue();
  const preserved = queue.filter(
    (existing) => existing.status === "synced" || existing.dedupeKey !== item.dedupeKey,
  );
  const deduped = sortQueueItems([...preserved, item]);
  setOfflineQueue(deduped);

  return {
    queue: deduped,
    replaced: Math.max(0, queue.length + 1 - deduped.length),
    item,
  };
}
