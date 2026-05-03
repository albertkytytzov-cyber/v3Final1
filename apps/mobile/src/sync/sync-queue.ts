import { MobileApiClient } from "../api/client.js";
import { loadQueue, saveQueue } from "../storage/local-store.js";
import type {
  CompetitionResultPayload,
  ExecutionResultInput,
  PendingSyncAction,
  ReadinessSubmissionPayload,
  SyncActionKind,
} from "../types/models.js";

export function createPendingAction(
  kind: SyncActionKind,
  body: ReadinessSubmissionPayload | ExecutionResultInput | CompetitionResultPayload,
  ownerUserId: string | null,
): PendingSyncAction {
  const id = createLocalId(kind);
  const endpoint =
    kind === "readiness"
      ? "/readiness"
      : kind === "execution"
        ? "/execution"
        : "/competition-results";

  return {
    id,
    kind,
    label: getActionLabel(kind),
    endpoint,
    method: "POST",
    body,
    idempotencyKey: id,
    ownerUserId,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  };
}

export function enqueueAction(action: PendingSyncAction) {
  const queue = loadQueue();
  queue.push(action);
  saveQueue(queue);
  return queue;
}

export async function flushSyncQueue(client: MobileApiClient, ownerUserId: string | null) {
  const queue = loadQueue();
  const remaining: PendingSyncAction[] = [];
  let syncedCount = 0;

  for (const action of queue) {
    if (action.ownerUserId !== ownerUserId) {
      remaining.push(action);
      continue;
    }

    try {
      await client.request(action.endpoint, {
        body: JSON.stringify(action.body),
        idempotencyKey: action.idempotencyKey,
        method: action.method,
      });
      syncedCount += 1;
    } catch (error) {
      remaining.push({
        ...action,
        attempts: action.attempts + 1,
        lastError:
          error instanceof Error ? error.message : "Не удалось синхронизировать",
      });
    }
  }

  saveQueue(remaining);

  return {
    queue: remaining,
    syncedCount,
  };
}

function createLocalId(kind: SyncActionKind) {
  const randomPart =
    "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${kind}-${randomPart}`;
}

function getActionLabel(kind: SyncActionKind) {
  if (kind === "readiness") {
    return "Готовность";
  }

  if (kind === "execution") {
    return "Результат тренировки";
  }

  return "Результат соревнования";
}
