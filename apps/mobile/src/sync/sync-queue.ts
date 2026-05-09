import { MobileApiClient, MobileApiError } from "../api/client.js";
import {
  canSubmitSyncAction,
  getSyncActionRestrictionMessage,
  isPermanentPermissionError,
  translateApiErrorMessage,
} from "../permissions.js";
import { loadQueue, saveQueue } from "../storage/local-store.js";
import type {
  CoachDiaryEntryPayload,
  CompetitionResultPayload,
  DeviceHealthDailySummaryPayload,
  ExecutionResultInput,
  PendingSyncAction,
  ReadinessSubmissionPayload,
  SyncActionKind,
  UserRole,
} from "../types/models.js";

export function createPendingAction(
  kind: SyncActionKind,
  body:
    | ReadinessSubmissionPayload
    | ExecutionResultInput
    | DeviceHealthDailySummaryPayload
    | CompetitionResultPayload
    | CoachDiaryEntryPayload,
  ownerUserId: string | null,
  ownerUserRole: UserRole | null,
): PendingSyncAction {
  const id = createLocalId(kind);
  const endpoint =
    kind === "readiness"
      ? "/readiness"
      : kind === "execution"
        ? "/execution"
        : kind === "device-health"
          ? "/device-health/daily-summaries"
          : kind === "competition-result"
            ? "/competition-results"
            : "/coach/diary";

  return {
    id,
    kind,
    label: getActionLabel(kind),
    endpoint,
    method: "POST",
    body,
    idempotencyKey: id,
    ownerUserId,
    ownerUserRole,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
    status: "pending",
  };
}

export function enqueueAction(action: PendingSyncAction) {
  const queue = loadQueue();
  queue.push(action);
  saveQueue(queue);
  return queue;
}

export async function flushSyncQueue(
  client: MobileApiClient,
  ownerUserId: string | null,
  ownerUserRole: UserRole | null,
) {
  const queue = loadQueue();
  const remaining: PendingSyncAction[] = [];
  let syncedCount = 0;
  let invalidatedCount = 0;

  for (const action of queue) {
    const pendingAction = normalizePendingAction(action);

    if (pendingAction.ownerUserId !== ownerUserId) {
      remaining.push(pendingAction);
      continue;
    }

    if (pendingAction.status === "invalid") {
      remaining.push(pendingAction);
      continue;
    }

    if (!canSubmitSyncAction(ownerUserRole, pendingAction.kind)) {
      remaining.push(markActionInvalid(
        pendingAction,
        getSyncActionRestrictionMessage(ownerUserRole, pendingAction.kind),
      ));
      invalidatedCount += 1;
      continue;
    }

    try {
      await client.request(pendingAction.endpoint, {
        body: JSON.stringify(pendingAction.body),
        idempotencyKey: pendingAction.idempotencyKey,
        method: pendingAction.method,
      });
      syncedCount += 1;
    } catch (error) {
      const lastError = toSyncErrorMessage(error);

      if (isPermanentPermissionError(pendingAction.kind, lastError)) {
        remaining.push(markActionInvalid(
          pendingAction,
          getSyncActionRestrictionMessage(ownerUserRole, pendingAction.kind),
        ));
        invalidatedCount += 1;
        continue;
      }

      if (error instanceof MobileApiError && error.statusCode === 403) {
        remaining.push(markActionInvalid(pendingAction, lastError));
        invalidatedCount += 1;
        continue;
      }

      remaining.push({
        ...pendingAction,
        attempts: pendingAction.attempts + 1,
        lastError,
        status: "pending",
      });
    }
  }

  saveQueue(remaining);

  return {
    invalidatedCount,
    queue: remaining,
    syncedCount,
  };
}

function normalizePendingAction(action: PendingSyncAction): PendingSyncAction {
  return {
    ...action,
    lastError: action.lastError ? translateApiErrorMessage(action.lastError) : null,
    status: action.status ?? "pending",
  };
}

function markActionInvalid(action: PendingSyncAction, lastError: string): PendingSyncAction {
  return {
    ...action,
    attempts: action.attempts + 1,
    lastError,
    status: "invalid",
  };
}

function toSyncErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return translateApiErrorMessage(error.message);
  }

  return "Не удалось синхронизировать";
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

  if (kind === "device-health") {
    return "Данные устройства";
  }

  if (kind === "coach-diary") {
    return "Запись тренера";
  }

  return "Результат соревнования";
}
