import { MobileApiClient, MobileApiError } from "../api/client.js";
import {
  canSubmitSyncAction,
  getSyncActionRestrictionMessage,
  translateApiErrorMessage,
} from "../permissions.js";
import { readRuntimeConfig } from "../config.js";
import {
  readMiFitnessHealthConnectDailySummary,
  readMiFitnessHealthConnectDeviceWorkouts,
} from "../integrations/health-connect.js";
import {
  inspectDirectWatchDevice,
  pairDirectWatchDevice,
  scanDirectWatchDevices,
} from "../integrations/direct-watch.js";
import { readHuaweiHealthDailySummary } from "../integrations/huawei-health.js";
import {
  clearSession,
  loadQueue,
  loadSelectedAthleteId,
  loadSession,
  loadSnapshot,
  saveSelectedAthleteId,
  saveSession,
  saveSnapshot,
} from "../storage/local-store.js";
import { createPendingAction, enqueueAction, flushSyncQueue } from "../sync/sync-queue.js";
import {
  estimateTrainingActualLoad,
  estimateTrainingBlockLoad,
  isDeviceWorkoutLinkablePlanBlock,
} from "@training-platform/shared";
import type {
  AssignedBlockExercise,
  AssignedPlanBlock,
  AssignedPlanSummary,
  CoachAiReviewDiagnosticResponse,
  CoachAiReviewStatus,
  CoachAthleteSummary,
  CoachDayAiPayload,
  CoachDayAiReview,
  CoachDiaryEntry,
  CoachDiaryEntryPayload,
  CompetitionPlanSummary,
  CompetitionResultPayload,
  DeviceHealthDailySummary,
  DeviceHealthDailySummaryPayload,
  DeviceWorkout,
  DeviceWorkoutLink,
  DeviceWorkoutsSyncPayload,
  ExecutionExerciseResult,
  ExecutionResult,
  ExecutionResultInput,
  MobileAppState,
  MobileDataSnapshot,
  MobileScreen,
  PendingSyncAction,
  ReadinessEntry,
  ReadinessSubmissionPayload,
  SyncActionKind,
} from "../types/models.js";

const runtimeConfig = readRuntimeConfig();
const SHOW_DIRECT_WATCH_DIAGNOSTICS = false;
type MobileAssignedPlanSession = AssignedPlanSummary["day"]["sessions"][number];

export function bootstrapMobileApp(root: HTMLElement) {
  const initialData = loadSnapshot();
  const state: MobileAppState = {
    session: loadSession(runtimeConfig.apiBaseUrl),
    data: initialData,
    queue: loadQueue(),
    coachAiDiagnostic: null,
    coachAiStatus: null,
    directWatchDiagnostic: {
      devices: [],
      inspectedDeviceId: null,
      inspection: null,
      scannedAt: null,
    },
    aiReviewByDay: buildCoachAiReviewByDay(initialData.coachAiReviews),
    selectedScreen: "dashboard",
    selectedAthleteId: loadSelectedAthleteId(),
    selectedDayDate: todayValue(),
    executionDateFilter: null,
    planDateFilter: null,
    isOnline: navigator.onLine,
    isBusy: false,
    isSyncing: false,
    message: null,
    error: null,
  };

  const update = (patch: Partial<MobileAppState>) => {
    Object.assign(state, patch);
    render();
  };

  const updateSelectedDayDate = (date: string, selectedScreen?: MobileScreen) => {
    const selectedDayDate = normalizeDateValue(date) ?? todayValue();
    update({
      executionDateFilter: selectedDayDate,
      planDateFilter: selectedDayDate,
      ...(selectedScreen ? { selectedScreen } : {}),
      selectedDayDate,
    });
  };

  const generateCoachAiReview = async (athleteId: string | null, entryDate: string) => {
    if (!athleteId) {
      update({ error: "Выберите спортсмена для разбора ИИ." });
      return;
    }

    const dayData = getCoachDayCleanSummary(state, athleteId, entryDate);
    const offlineReview = buildOfflineCoachDayAiReview(dayData);
    const key = getCoachDayAiReviewKey(athleteId, entryDate);

    if (!state.isOnline) {
      update({
        aiReviewByDay: {
          ...state.aiReviewByDay,
          [key]: offlineReview,
        },
        error: null,
        message: "Нет сети: показан локальный черновой разбор. План и дневник не изменены.",
      });
      return;
    }

    update({ error: null, isBusy: true, message: "Формирую разбор ИИ на сервере..." });

    try {
      const response = await client().generateCoachDayAiReview(
        athleteId,
        dayData.date,
        offlineReview.dayPayload,
      );
      const snapshot = {
        ...state.data,
        coachAiReviews: upsertCoachAiReviewHistory(state.data.coachAiReviews, response.review),
        savedAt: new Date().toISOString(),
      };
      saveSnapshot(snapshot);

      update({
        aiReviewByDay: {
          ...state.aiReviewByDay,
          [key]: response.review,
        },
        data: snapshot,
        error: null,
        isBusy: false,
        message: "Разбор ИИ получен с сервера. План и дневник не изменены.",
      });
    } catch (error) {
      update({
        aiReviewByDay: {
          ...state.aiReviewByDay,
          [key]: offlineReview,
        },
        error: error instanceof MobileApiError
          ? `Серверный разбор недоступен: ${error.message}`
          : "Серверный разбор недоступен.",
        isBusy: false,
        message: "Показан локальный черновой разбор. План и дневник не изменены.",
      });
    }
  };

  const testCoachAiReview = async () => {
    if (!isCoachRole(state.session.user?.role)) {
      update({ error: "Проверка ИИ доступна только тренеру или администратору." });
      return;
    }

    if (!state.isOnline) {
      update({ error: "Нет сети: серверную проверку ИИ сейчас выполнить нельзя." });
      return;
    }

    update({ error: null, isBusy: true, message: "Проверяю подключение ИИ на сервере..." });

    try {
      const diagnostic = await client().testCoachAiReview();
      update({
        coachAiDiagnostic: diagnostic,
        coachAiStatus: diagnostic.status,
        error: null,
        isBusy: false,
        message: diagnostic.message,
      });
    } catch (error) {
      update({
        error: toFriendlyError(error),
        isBusy: false,
        message: "Проверка ИИ не выполнена.",
      });
    }
  };

  const client = () => new MobileApiClient(
    state.session.apiBaseUrl,
    state.session.sessionToken,
  );

  const render = () => {
    root.innerHTML = state.session.user ? renderAppShell(state) : renderLogin(state);
    bindEvents();
  };

  const refreshData = async (silent = false) => {
    if (!state.session.user) {
      return;
    }

    if (!silent) {
      update({ error: null, isBusy: true, message: null });
    }

    try {
      const api = client();
      const auth = await api.me();
      const [
        loadedData,
        coachAiStatus,
      ] = await Promise.all([
        api.loadAppData(auth.user.role, state.selectedDayDate),
        isCoachRole(auth.user.role)
          ? api.getCoachAiReviewStatus().catch(() => ({ status: null }))
          : Promise.resolve({ status: null }),
      ]);
      const snapshot: MobileDataSnapshot = {
        ...state.data,
        ...loadedData,
        savedAt: new Date().toISOString(),
      };
      const storedAiReviewsByDay = buildCoachAiReviewByDay(snapshot.coachAiReviews);
      const nextSession = {
        ...state.session,
        user: auth.user,
      };
      const selectedAthleteId = resolveSelectedAthleteId(
        nextSession.user,
        snapshot,
        state.selectedAthleteId,
      );

      saveSession(nextSession);
      saveSnapshot(snapshot);
      saveSelectedAthleteId(selectedAthleteId);
      update({
        aiReviewByDay: {
          ...state.aiReviewByDay,
          ...storedAiReviewsByDay,
        },
        coachAiStatus: coachAiStatus.status,
        data: snapshot,
        error: null,
        isBusy: false,
        message: `Данные обновлены · планов: ${snapshot.assignedPlans.length}`,
        selectedAthleteId,
        session: nextSession,
      });
    } catch (error) {
      update({
        error: toFriendlyError(error),
        isBusy: false,
        message: state.data.savedAt
          ? `Показаны сохранённые данные от ${formatDateTime(state.data.savedAt)}`
          : null,
      });
    }
  };

  const tryFlushQueue = async () => {
    if (!state.session.user || !navigator.onLine) {
      return;
    }

    update({ error: null, isSyncing: true });

    const result = await flushSyncQueue(client(), state.session.user.id, state.session.user.role);

    update({
      isSyncing: false,
      message: formatSyncResultMessage(result.syncedCount, result.invalidatedCount),
      queue: result.queue,
    });

    if (result.syncedCount > 0) {
      await refreshData(true);
    }
  };

  const handleLogin = async (form: HTMLFormElement) => {
    const formData = new FormData(form);
    const apiBaseUrl = String(formData.get("apiBaseUrl") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const api = new MobileApiClient(apiBaseUrl, null);

    update({
      error: null,
      isBusy: true,
      message: null,
      session: {
        ...state.session,
        apiBaseUrl: apiBaseUrl.trim(),
      },
    });

    try {
      const response = await api.login(email, password);
      const nextSession = {
        apiBaseUrl: apiBaseUrl.trim(),
        sessionToken: response.sessionToken ?? null,
        user: response.user,
      };

      saveSession(nextSession);
      update({
        isBusy: false,
        message: "Вход выполнен",
        selectedAthleteId: response.user.athleteId,
        session: nextSession,
      });
      await refreshData();
    } catch (error) {
      update({
        error: toFriendlyError(error),
        isBusy: false,
      });
    }
  };

  const handleLogout = async () => {
    if (state.session.sessionToken) {
      try {
        await client().logout();
      } catch {
        // Local logout should still clear the app session.
      }
    }

    clearSession(runtimeConfig.apiBaseUrl);
    update({
      error: null,
      message: "Вы вышли из приложения",
      selectedAthleteId: null,
      session: loadSession(runtimeConfig.apiBaseUrl),
    });
  };

  const submitReadiness = async (form: HTMLFormElement) => {
    const payload: ReadinessSubmissionPayload = {
      bodyWeight: readNumber(form, "bodyWeight", 0),
      entryDate: readString(form, "entryDate") || todayValue(),
      fatigueLevel: readNumber(form, "fatigueLevel", 5),
      feverFlag: readCheckbox(form, "feverFlag"),
      generalFeeling: readNumber(form, "generalFeeling", 5),
      illnessFlag: readCheckbox(form, "illnessFlag"),
      motivationLevel: readNumber(form, "motivationLevel", 5),
      muscleSoreness: readNumber(form, "muscleSoreness", 5),
      painLevel: readNumber(form, "painLevel", 0),
      restingHr: readNumber(form, "restingHr", 60),
      sleepHours: readNumber(form, "sleepHours", 8),
      sleepQuality: readNumber(form, "sleepQuality", 5),
    };

    await submitOrQueue("readiness", payload, async (idempotencyKey) => {
      const result = await client().submitReadiness(payload, idempotencyKey);
      const snapshot = {
        ...state.data,
        readinessEntry: result.entry,
        readinessHistory: upsertReadinessHistory(state.data.readinessHistory, result.entry),
        savedAt: new Date().toISOString(),
      };
      saveSnapshot(snapshot);
      update({ data: snapshot });
    });
  };

  const syncHuaweiHealth = async (entryDate: string) => {
    if (state.session.user?.role !== "athlete") {
      update({
        error: "Подключение Huawei Health выполняет спортсмен в своём приложении.",
        isBusy: false,
        message: null,
      });
      return;
    }

    update({ error: null, isBusy: true, message: "Читаю данные Huawei Health..." });

    let payload: DeviceHealthDailySummaryPayload;
    try {
      payload = await readHuaweiHealthDailySummary(entryDate);
    } catch (error) {
      update({
        error: error instanceof Error ? error.message : "Huawei Health недоступен.",
        isBusy: false,
        message: null,
      });
      return;
    }

    await submitDeviceHealthPayload(payload);
  };

  const syncMiFitnessHealthConnect = async (entryDate: string) => {
    if (state.session.user?.role !== "athlete") {
      update({
        error: "Подключение Mi Fitness выполняет спортсмен в своём Android-приложении.",
        isBusy: false,
        message: null,
      });
      return;
    }

    update({ error: null, isBusy: true, message: "Читаю данные из Health Connect..." });

    let payload: DeviceHealthDailySummaryPayload;
    let workoutsPayload: DeviceWorkoutsSyncPayload | null = null;
    try {
      payload = await readMiFitnessHealthConnectDailySummary(entryDate);
      workoutsPayload = await readMiFitnessHealthConnectDeviceWorkouts(entryDate).catch(() => null);
    } catch (error) {
      update({
        error: error instanceof Error ? error.message : "Health Connect недоступен.",
        isBusy: false,
        message: null,
      });
      return;
    }

    await submitDeviceHealthPayload(payload);
    if (workoutsPayload && workoutsPayload.workouts.length > 0) {
      await submitDeviceWorkoutsPayload(workoutsPayload);
    }
  };

  const scanDirectWatch = async () => {
    if (state.session.user?.role !== "athlete") {
      update({
        error: "Прямое подключение часов выполняет спортсмен в своём Android-приложении.",
        isBusy: false,
        message: null,
      });
      return;
    }

    update({ error: null, isBusy: true, message: "Ищу часы рядом с телефоном..." });

    try {
      const result = await scanDirectWatchDevices();
      update({
        directWatchDiagnostic: {
          devices: result.devices.filter((device) => Boolean(device.id)),
          inspectedDeviceId: null,
          inspection: null,
          scannedAt: result.scannedAt ?? new Date().toISOString(),
        },
        error: null,
        isBusy: false,
        message: result.devices.length
          ? "Поиск часов завершён. Выберите Redmi Watch 5 для проверки сервисов."
          : "Часы не найдены. Держите Redmi Watch 5 рядом, включите Bluetooth и повторите поиск.",
      });
    } catch (error) {
      update({
        error: error instanceof Error ? error.message : "Не удалось выполнить поиск часов.",
        isBusy: false,
        message: null,
      });
    }
  };

  const inspectDirectWatch = async (deviceId: string) => {
    if (!deviceId) {
      update({ error: "Выберите часы для проверки." });
      return;
    }

    update({ error: null, isBusy: true, message: "Подключаюсь к часам и читаю BLE-сервисы..." });

    try {
      const inspection = await inspectDirectWatchDevice(deviceId);
      update({
        directWatchDiagnostic: {
          ...state.directWatchDiagnostic,
          inspectedDeviceId: deviceId,
          inspection,
        },
        error: null,
        isBusy: false,
        message: inspection.hasHeartRateService
          ? "Часы отдают стандартный сервис пульса. Следующий шаг — чтение живого пульса во время тренировки."
          : "Часы подключились, но стандартный сервис пульса не найден. Данные могут быть закрыты протоколом Xiaomi.",
      });
    } catch (error) {
      update({
        directWatchDiagnostic: {
          ...state.directWatchDiagnostic,
          inspectedDeviceId: deviceId,
          inspection: null,
        },
        error: error instanceof Error ? error.message : "Не удалось проверить сервисы часов.",
        isBusy: false,
        message: null,
      });
    }
  };

  const pairDirectWatch = async (deviceId: string) => {
    if (!deviceId) {
      update({ error: "Выберите часы для сопряжения." });
      return;
    }

    update({
      error: null,
      isBusy: true,
      message: "Откройте системное окно сопряжения, подтвердите код на телефоне и часах.",
    });

    try {
      const pairing = await pairDirectWatchDevice(deviceId);
      const devices = state.directWatchDiagnostic.devices.map((device) =>
        device.id === deviceId
          ? {
              ...device,
              bondState: pairing.bondState ?? device.bondState,
              bondStateCode: pairing.bondStateCode ?? device.bondStateCode,
              name: pairing.deviceName ?? device.name,
            }
          : device,
      );
      const isBonded = pairing.bondState === "bonded";
      update({
        directWatchDiagnostic: {
          ...state.directWatchDiagnostic,
          devices,
        },
        error: null,
        isBusy: false,
        message: isBonded
          ? "Сопряжение выполнено. Теперь нажмите “Проверить”, чтобы прочитать BLE-сервисы часов."
          : "Сопряжение не завершено. Проверьте системное окно Bluetooth и подтвердите запрос на часах.",
      });
    } catch (error) {
      update({
        error: error instanceof Error ? error.message : "Не удалось выполнить системное сопряжение часов.",
        isBusy: false,
        message: null,
      });
    }
  };

  const submitDeviceHealthPayload = async (payload: DeviceHealthDailySummaryPayload) => {
    await submitOrQueue("device-health", payload, async (idempotencyKey) => {
      const result = await client().submitDeviceHealthSummary(payload, idempotencyKey);
      const snapshot = {
        ...state.data,
        deviceHealthSummaries: upsertDeviceHealthSummary(
          state.data.deviceHealthSummaries,
          result.summary,
        ),
        savedAt: new Date().toISOString(),
      };
      saveSnapshot(snapshot);
      update({ data: snapshot });
    });
  };

  const submitDeviceWorkoutsPayload = async (payload: DeviceWorkoutsSyncPayload) => {
    await submitOrQueue("device-workouts", payload, async (idempotencyKey) => {
      const result = await client().submitDeviceWorkouts(payload, idempotencyKey);
      const snapshot = {
        ...state.data,
        deviceWorkoutLinks: upsertDeviceWorkoutLinks(
          state.data.deviceWorkoutLinks,
          result.links ?? [],
        ),
        deviceWorkouts: upsertDeviceWorkouts(state.data.deviceWorkouts, result.workouts),
        savedAt: new Date().toISOString(),
      };
      saveSnapshot(snapshot);
      update({ data: snapshot });
    });
  };

  const linkDeviceWorkoutToBlock = async (select: HTMLSelectElement) => {
    if (!isCoachRole(state.session.user?.role)) {
      return;
    }

    const athleteId = state.selectedAthleteId;
    const assignedPlanId = select.dataset.deviceWorkoutPlanId ?? "";
    const assignedBlockIds = (select.dataset.deviceWorkoutBlockIds ?? select.dataset.deviceWorkoutBlockId ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    const linkIds = (select.dataset.deviceWorkoutLinkIds ?? select.dataset.deviceWorkoutLinkId ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    const deviceWorkoutId = select.value;

    if (!athleteId || !assignedPlanId || assignedBlockIds.length === 0) {
      update({ error: "Не выбран спортсмен или блок плана" });
      return;
    }

    if (!navigator.onLine) {
      update({ error: "Связь с тренировкой устройства можно сохранить только при наличии интернета." });
      return;
    }

    update({ error: null, isBusy: true, message: null });

    try {
      if (!deviceWorkoutId) {
        if (linkIds.length > 0) {
          await Promise.all(linkIds.map((linkId) => client().unlinkDeviceWorkout(athleteId, linkId)));
          const removedLinkIds = new Set(linkIds);
          const snapshot = {
            ...state.data,
            deviceWorkoutLinks: state.data.deviceWorkoutLinks.filter((link) => !removedLinkIds.has(link.id)),
            savedAt: new Date().toISOString(),
          };
          saveSnapshot(snapshot);
          update({ data: snapshot, isBusy: false, message: "Связь с тренировкой устройства удалена." });
          return;
        }

        update({ isBusy: false });
        return;
      }

      await Promise.all(linkIds.map((linkId) => client().unlinkDeviceWorkout(athleteId, linkId)));
      const responses = await Promise.all(assignedBlockIds.map((assignedBlockId) =>
        client().linkDeviceWorkout(athleteId, {
          assignedBlockId,
          assignedPlanId,
          deviceWorkoutId,
        })
      ));
      const removedLinkIds = new Set(linkIds);
      const snapshot = {
        ...state.data,
        deviceWorkoutLinks: upsertDeviceWorkoutLinks(
          state.data.deviceWorkoutLinks.filter((link) => !removedLinkIds.has(link.id)),
          responses.map((response) => response.link),
        ),
        deviceWorkouts: upsertDeviceWorkouts(
          state.data.deviceWorkouts,
          responses.map((response) => response.link.workout),
        ),
        savedAt: new Date().toISOString(),
      };
      saveSnapshot(snapshot);
      update({ data: snapshot, isBusy: false, message: "Тренировка устройства связана со сессией плана." });
    } catch (error) {
      update({
        error: error instanceof Error ? error.message : "Не удалось сохранить связь с тренировкой устройства.",
        isBusy: false,
        message: null,
      });
    }
  };

  const readExecutionPayload = (form: HTMLFormElement): ExecutionResultInput | null => {
    const blockKey = readString(form, "assignedBlock");
    const [legacyAssignedPlanId, legacyAssignedBlockId] = blockKey.split("|");
    const assignedPlanId = readString(form, "assignedPlanId") || legacyAssignedPlanId;
    const assignedBlockId = readString(form, "assignedBlockId") || legacyAssignedBlockId;

    if (!assignedPlanId || !assignedBlockId) {
      update({ error: "Выберите блок плана" });
      return null;
    }

    const exercises = Array
      .from(form.querySelectorAll<HTMLElement>("[data-execution-exercise]"))
      .map((element) => {
        const assignedExerciseId = element.dataset.exerciseId ?? "";

        return {
          assignedExerciseId,
          completed: readCheckbox(form, `exerciseCompleted:${assignedExerciseId}`),
          durationMinutes: readOptionalNumber(form, `exerciseDuration:${assignedExerciseId}`),
          notes: readString(form, `exerciseNotes:${assignedExerciseId}`),
          repsCompleted: readOptionalNumber(form, `exerciseReps:${assignedExerciseId}`),
          rpe: readOptionalNumber(form, `exerciseRpe:${assignedExerciseId}`),
          setsCompleted: readOptionalNumber(form, `exerciseSets:${assignedExerciseId}`),
          weightKg: readOptionalNumber(form, `exerciseWeight:${assignedExerciseId}`),
        };
      })
      .filter((exercise) => Boolean(exercise.assignedExerciseId));

    return {
      assignedBlockId,
      assignedPlanId,
      completed: exercises.length > 0
        ? exercises.every((exercise) => exercise.completed)
        : readCheckbox(form, "completed"),
      durationMinutes: readOptionalNumber(form, "durationMinutes"),
      notes: readString(form, "notes"),
      repsCompleted: readOptionalNumber(form, "repsCompleted"),
      rpe: readOptionalNumber(form, "rpe"),
      setsCompleted: readOptionalNumber(form, "setsCompleted"),
      weightKg: readOptionalNumber(form, "weightKg"),
      exercises: exercises.length > 0 ? exercises : undefined,
    };
  };

  const readExecutionSessionPayloads = (form: HTMLFormElement): ExecutionResultInput[] | null => {
    const assignedPlanId = readString(form, "assignedPlanId");
    const assignedBlockIds = readString(form, "assignedBlockIds")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (!assignedPlanId || assignedBlockIds.length === 0) {
      update({ error: "Выберите сессию плана" });
      return null;
    }

    const completed = readCheckbox(form, "completed");
    const notes = readString(form, "notes");

    return assignedBlockIds.map((assignedBlockId) => ({
      assignedBlockId,
      assignedPlanId,
      completed,
      durationMinutes: null,
      notes,
      repsCompleted: null,
      rpe: null,
      setsCompleted: null,
      weightKg: null,
    }));
  };

  const saveExecutionResultsSnapshot = (results: ExecutionResult[]) => {
    const snapshot = {
      ...state.data,
      executionResults: results.reduce(
        (items, result) => upsertExecutionResult(items, result),
        state.data.executionResults,
      ),
      savedAt: new Date().toISOString(),
    };

    saveSnapshot(snapshot);
    update({ data: snapshot });
    return snapshot;
  };

  const submitExecutionDay = async (button: HTMLButtonElement) => {
    const group = button.closest<HTMLElement>("[data-execution-plan-group]");
    const forms = Array.from(
      group?.querySelectorAll<HTMLFormElement>("[data-execution-form], [data-execution-session-form]") ?? [],
    );

    if (forms.length === 0) {
      update({ error: "Нет блоков для сохранения." });
      return;
    }

    const payloads: ExecutionResultInput[] = [];

    for (const form of forms) {
      const formPayloads = form.hasAttribute("data-execution-session-form")
        ? readExecutionSessionPayloads(form)
        : (() => {
            const payload = readExecutionPayload(form);
            return payload ? [payload] : null;
          })();

      if (!formPayloads) {
        return;
      }

      payloads.push(...formPayloads);
    }

    const userRole = state.session.user?.role ?? null;

    if (!canSubmitSyncAction(userRole, "execution")) {
      update({
        error: getSyncActionRestrictionMessage(userRole, "execution"),
        isBusy: false,
        message: null,
        queue: loadQueue(),
      });
      return;
    }

    const pendingActions = payloads.map((payload) => ({
      action: createPendingAction(
        "execution",
        payload,
        state.session.user?.id ?? null,
        userRole,
      ),
      payload,
    }));

    update({ error: null, isBusy: true, message: null });

    if (!navigator.onLine) {
      let queue = loadQueue();

      for (const { action } of pendingActions) {
        queue = enqueueAction(action);
      }

      update({
        isBusy: false,
        message: "Сохранено локально. Отправим при появлении интернета.",
        queue,
      });
      return;
    }

    const savedResults: ExecutionResult[] = [];

    try {
      for (const { action, payload } of pendingActions) {
        const result = await client().submitExecution(payload, action.idempotencyKey);
        savedResults.push(result.result);
      }

      saveExecutionResultsSnapshot(savedResults);
      update({
        isBusy: false,
        message: "Сохранено выполнение дня.",
        queue: loadQueue(),
      });
      await refreshData(true);
    } catch (error) {
      if (error instanceof MobileApiError && error.statusCode !== null && error.statusCode < 500) {
        if (savedResults.length > 0) {
          saveExecutionResultsSnapshot(savedResults);
        }

        update({
          error: toFriendlyError(error),
          isBusy: false,
        });
        return;
      }

      const failedActions = pendingActions.slice(savedResults.length);
      let queue = loadQueue();

      for (const { action } of failedActions) {
        queue = enqueueAction({
          ...action,
          attempts: 1,
          lastError: toFriendlyError(error),
        });
      }

      if (savedResults.length > 0) {
        saveExecutionResultsSnapshot(savedResults);
      }

      update({
        isBusy: false,
        message:
          savedResults.length > 0
            ? `Часть дня сохранена: ${savedResults.length}. Остальное добавлено в офлайн-очередь.`
            : "Сервер недоступен. День сохранён локально.",
        queue,
      });
    }
  };

  const submitCompetitionResult = async (form: HTMLFormElement) => {
    const payload: CompetitionResultPayload = {
      coachNotes: readString(form, "coachNotes"),
      competitionPlanId: readString(form, "competitionPlanId"),
      finalPlace: readOptionalNumber(form, "finalPlace"),
      matchesCount: readOptionalNumber(form, "matchesCount"),
      performanceNotes: readString(form, "performanceNotes"),
      weightAfter: readOptionalNumber(form, "weightAfter"),
      weightAtWeighIn: readOptionalNumber(form, "weightAtWeighIn"),
    };

    if (!payload.competitionPlanId) {
      update({ error: "Выберите старт" });
      return;
    }

    await submitOrQueue("competition-result", payload, async (idempotencyKey) => {
      await client().submitCompetitionResult(payload, idempotencyKey);
    });
  };

  const submitCoachDiary = async (form: HTMLFormElement) => {
    const scope = readString(form, "scope") === "tasks" ? "tasks" : "day";
    const selectedBlockIds = readStringList(form, "assignedBlockIds");
    const selectedExerciseIds = readStringList(form, "assignedExerciseIds");
    const notes = readString(form, "notes");

    const payload: CoachDiaryEntryPayload = {
      athleteId: readString(form, "athleteId"),
      assignedPlanId: readString(form, "assignedPlanId"),
      entryDate: readString(form, "entryDate") || todayValue(),
      scope,
      notes,
      assignedBlockIds: scope === "tasks" ? selectedBlockIds : [],
      assignedExerciseIds: scope === "tasks" ? selectedExerciseIds : [],
    };

    if (!payload.athleteId || !payload.assignedPlanId) {
      update({ error: "Выберите спортсмена и день плана." });
      return;
    }

    if (!payload.notes) {
      update({ error: "Добавьте текст записи тренера." });
      return;
    }

    if (
      payload.scope === "tasks" &&
      payload.assignedBlockIds.length === 0 &&
      payload.assignedExerciseIds.length === 0
    ) {
      update({ error: "Выберите задания или переключите запись на весь день." });
      return;
    }

    await submitOrQueue("coach-diary", payload, async (idempotencyKey) => {
      const result = await client().submitCoachDiary(payload, idempotencyKey);
      const snapshot = {
        ...state.data,
        coachDiaryEntries: upsertById(state.data.coachDiaryEntries, result.entry),
        savedAt: new Date().toISOString(),
      };
      saveSnapshot(snapshot);
      update({ data: snapshot });
    });
  };

  const submitOrQueue = async (
    kind: SyncActionKind,
    payload:
      | ReadinessSubmissionPayload
      | ExecutionResultInput
      | DeviceHealthDailySummaryPayload
      | DeviceWorkoutsSyncPayload
      | CompetitionResultPayload
      | CoachDiaryEntryPayload,
    submit: (idempotencyKey: string) => Promise<void>,
  ) => {
    const userRole = state.session.user?.role ?? null;

    if (!canSubmitSyncAction(userRole, kind)) {
      update({
        error: getSyncActionRestrictionMessage(userRole, kind),
        isBusy: false,
        message: null,
        queue: loadQueue(),
      });
      return;
    }

    const pendingAction = createPendingAction(
      kind,
      payload,
      state.session.user?.id ?? null,
      userRole,
    );

    update({ error: null, isBusy: true, message: null });

    if (!navigator.onLine) {
      const queue = enqueueAction(pendingAction);
      update({
        isBusy: false,
        message: "Сохранено локально. Отправим при появлении интернета.",
        queue,
      });
      return;
    }

    try {
      await submit(pendingAction.idempotencyKey);
      update({
        isBusy: false,
        message: "Сохранено на сервере",
        queue: loadQueue(),
      });
      await refreshData(true);
    } catch (error) {
      if (error instanceof MobileApiError && error.statusCode !== null && error.statusCode < 500) {
        update({
          error: toFriendlyError(error),
          isBusy: false,
        });
        return;
      }

      const queue = enqueueAction({
        ...pendingAction,
        attempts: 1,
        lastError: toFriendlyError(error),
      });
      update({
        isBusy: false,
        message: "Сервер недоступен. Данные сохранены локально.",
        queue,
      });
    }
  };

  const bindEvents = () => {
    root.querySelector<HTMLFormElement>("[data-login-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      void handleLogin(event.currentTarget as HTMLFormElement);
    });

    root.querySelector<HTMLButtonElement>("[data-toggle-password]")?.addEventListener("click", (event) => {
      const button = event.currentTarget as HTMLButtonElement;
      const input = root.querySelector<HTMLInputElement>("[data-password-input]");

      if (!input) {
        return;
      }

      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      button.textContent = isHidden ? "Скрыть" : "Показать";
      button.setAttribute("aria-pressed", String(isHidden));
    });

    root.querySelectorAll<HTMLButtonElement>("[data-screen]").forEach((button) => {
      button.addEventListener("click", () => {
        update({ selectedScreen: button.dataset.screen as MobileScreen });
      });
    });

    root.querySelector<HTMLSelectElement>("[data-execution-date-filter]")?.addEventListener("change", (event) => {
      const executionDateFilter = (event.currentTarget as HTMLSelectElement).value || null;
      if (isCoachRole(state.session.user?.role)) {
        updateSelectedDayDate(executionDateFilter ?? state.selectedDayDate);
        return;
      }

      update({ executionDateFilter });
    });

    root.querySelectorAll<HTMLSelectElement>("[data-device-workout-link]").forEach((select) => {
      select.addEventListener("change", () => {
        void linkDeviceWorkoutToBlock(select);
      });
    });

    root.querySelector<HTMLSelectElement>("[data-plan-date-filter]")?.addEventListener("change", (event) => {
      const planDateFilter = (event.currentTarget as HTMLSelectElement).value || null;
      if (isCoachRole(state.session.user?.role)) {
        updateSelectedDayDate(planDateFilter ?? state.selectedDayDate);
        return;
      }

      update({ planDateFilter });
    });

    root.querySelector<HTMLInputElement>("[data-coach-day-date]")?.addEventListener("change", (event) => {
      updateSelectedDayDate((event.currentTarget as HTMLInputElement).value);
    });

    root.querySelector<HTMLSelectElement>("[data-coach-day-plan-date]")?.addEventListener("change", (event) => {
      const date = (event.currentTarget as HTMLSelectElement).value;

      if (date) {
        updateSelectedDayDate(date);
      }
    });

    root.querySelectorAll<HTMLButtonElement>("[data-coach-day-shift]").forEach((button) => {
      button.addEventListener("click", () => {
        const shift = button.dataset.coachDayShift ?? "0";
        const nextDate = shift === "today"
          ? todayValue()
          : addDays(state.selectedDayDate, Number(shift));

        updateSelectedDayDate(nextDate);
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-coach-open-day]").forEach((button) => {
      button.addEventListener("click", () => {
        const selectedScreen = (button.dataset.coachOpenScreen as MobileScreen | undefined) ?? "dashboard";
        updateSelectedDayDate(button.dataset.coachOpenDay ?? state.selectedDayDate, selectedScreen);
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-refresh]").forEach((button) => {
      button.addEventListener("click", () => {
        void refreshData();
      });
    });

    root.querySelector<HTMLButtonElement>("[data-sync]")?.addEventListener("click", () => {
      void tryFlushQueue();
    });

    root.querySelector<HTMLButtonElement>("[data-logout]")?.addEventListener("click", () => {
      void handleLogout();
    });

    root.querySelectorAll<HTMLSelectElement>("[data-athlete-select]").forEach((select) => {
      select.addEventListener("change", (event) => {
        const selectedAthleteId = (event.currentTarget as HTMLSelectElement).value || null;
        saveSelectedAthleteId(selectedAthleteId);
        update({
          executionDateFilter: isCoachRole(state.session.user?.role) ? state.selectedDayDate : null,
          planDateFilter: isCoachRole(state.session.user?.role) ? state.selectedDayDate : null,
          selectedAthleteId,
        });
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-athlete-card]").forEach((button) => {
      button.addEventListener("click", () => {
        const selectedAthleteId = button.dataset.athleteCard ?? null;
        saveSelectedAthleteId(selectedAthleteId);
        update({
          executionDateFilter: isCoachRole(state.session.user?.role) ? state.selectedDayDate : null,
          planDateFilter: isCoachRole(state.session.user?.role) ? state.selectedDayDate : null,
          selectedAthleteId,
          selectedScreen: "dashboard",
        });
      });
    });

    root.querySelector<HTMLFormElement>("[data-readiness-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      void submitReadiness(event.currentTarget as HTMLFormElement);
    });

    root.querySelectorAll<HTMLButtonElement>("[data-huawei-health-sync]").forEach((button) => {
      button.addEventListener("click", () => {
        void syncHuaweiHealth(button.dataset.huaweiHealthDate ?? todayValue());
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-health-connect-sync]").forEach((button) => {
      button.addEventListener("click", () => {
        void syncMiFitnessHealthConnect(button.dataset.healthConnectDate ?? todayValue());
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-direct-watch-scan]").forEach((button) => {
      button.addEventListener("click", () => {
        void scanDirectWatch();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-direct-watch-inspect]").forEach((button) => {
      button.addEventListener("click", () => {
        void inspectDirectWatch(button.dataset.directWatchInspect ?? "");
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-direct-watch-pair]").forEach((button) => {
      button.addEventListener("click", () => {
        void pairDirectWatch(button.dataset.directWatchPair ?? "");
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-readiness-preset]").forEach((button) => {
      button.addEventListener("click", () => {
        const form = button.closest("form");

        if (form instanceof HTMLFormElement) {
          applyReadinessPreset(form, button.dataset.readinessPreset ?? "normal");
        }
      });
    });

    root.querySelectorAll<HTMLFormElement>("[data-execution-form], [data-execution-session-form]").forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const saveButton = (event.currentTarget as HTMLFormElement)
          .closest<HTMLElement>("[data-execution-plan-group]")
          ?.querySelector<HTMLButtonElement>("[data-execution-save-day]");

        if (saveButton) {
          void submitExecutionDay(saveButton);
        }
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-execution-save-day]").forEach((button) => {
      button.addEventListener("click", () => {
        void submitExecutionDay(button);
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-generate-coach-ai-review]").forEach((button) => {
      button.addEventListener("click", () => {
        void generateCoachAiReview(
          button.dataset.aiAthleteId ?? state.selectedAthleteId,
          button.dataset.aiDate ?? state.selectedDayDate,
        );
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-test-coach-ai-review]").forEach((button) => {
      button.addEventListener("click", () => {
        void testCoachAiReview();
      });
    });

    root.querySelector<HTMLFormElement>("[data-competition-result-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      void submitCompetitionResult(event.currentTarget as HTMLFormElement);
    });

    root.querySelectorAll<HTMLFormElement>("[data-coach-diary-form]").forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        void submitCoachDiary(event.currentTarget as HTMLFormElement);
      });
    });
  };

  window.addEventListener("online", () => {
    update({ isOnline: true, message: "Интернет появился" });
    void tryFlushQueue();
  });

  window.addEventListener("offline", () => {
    update({ isOnline: false, message: "Офлайн-режим включён" });
  });

  render();

  if (state.session.user && navigator.onLine) {
    void refreshData(true);
    void tryFlushQueue();
  }
}

function renderLogin(state: MobileAppState) {
  return `
    <main class="mobile-shell mobile-shell-auth">
      <section class="login-panel">
        <div class="brand-block">
          <span>PERFORM</span>
          <h1>Мобильная работа тренера и спортсмена</h1>
          <p>Интерфейс хранится внутри приложения. Сервер используется только для данных.</p>
        </div>
        ${renderStatus(state)}
        <form class="mobile-form" data-login-form>
          <label>
            <span>API сервера</span>
            <input name="apiBaseUrl" inputmode="url" required value="${escapeHtml(state.session.apiBaseUrl)}" placeholder="https://example.com/api/v1" />
          </label>
          <label>
            <span>Email</span>
            <input name="email" type="email" autocomplete="email" required />
          </label>
          <label class="password-field">
            <span>Пароль</span>
            <div class="password-control">
              <input data-password-input name="password" type="password" autocomplete="current-password" required />
              <button aria-pressed="false" class="inline-action" data-toggle-password type="button">Показать</button>
            </div>
          </label>
          <button class="primary-action" ${state.isBusy ? "disabled" : ""} type="submit">
            ${state.isBusy ? "Подключение..." : "Войти"}
          </button>
        </form>
      </section>
    </main>
  `;
}

function renderAppShell(state: MobileAppState) {
  const user = state.session.user;
  const selectedAthlete = getSelectedAthlete(state);
  const activeAthleteId = getActiveAthleteId(state);
  const screens = getScreensForRole(user?.role);

  return `
    <main class="mobile-shell">
      <header class="app-header">
        <div>
          <span>${state.isOnline ? "онлайн" : "офлайн"}</span>
          <h1>${escapeHtml(user?.fullName ?? "PERFORM")}</h1>
          <p>${escapeHtml(getRoleLabel(user?.role))}${selectedAthlete ? ` · ${escapeHtml(selectedAthlete.fullName)}` : ""}</p>
        </div>
        <button class="icon-button" data-logout type="button">Выйти</button>
      </header>

      ${renderStatus(state)}
      ${renderToolbar(state)}

      ${
        isCoachRole(user?.role) && state.selectedScreen !== "athletes"
          ? renderAthletePicker(state)
          : ""
      }

      <section class="screen-panel">
        ${renderScreen(state, activeAthleteId)}
      </section>

      <nav class="bottom-nav" aria-label="Разделы">
        ${screens.map((screen) => `
          <button class="${state.selectedScreen === screen.id ? "is-active" : ""}" data-screen="${screen.id}" type="button">
            <span>${screen.icon}</span>
            ${screen.label}
          </button>
        `).join("")}
      </nav>
    </main>
  `;
}

function renderToolbar(state: MobileAppState) {
  const pendingQueue = getPendingQueueItems(state.queue);
  const invalidQueue = getInvalidQueueItems(state.queue);
  const savedLabel = state.data.savedAt
    ? `Сохранено: ${formatDateTime(state.data.savedAt)}`
    : "Локальных данных пока нет";
  const invalidLabel = invalidQueue.length ? ` · не отправляется: ${invalidQueue.length}` : "";

  return `
    <section class="toolbar-row">
      <button data-refresh type="button" ${state.isBusy ? "disabled" : ""}>Обновить</button>
      <button data-sync type="button" ${state.isSyncing || pendingQueue.length === 0 ? "disabled" : ""}>
        Синхронизация ${pendingQueue.length ? `(${pendingQueue.length})` : ""}
      </button>
      <small>${savedLabel}${invalidLabel}</small>
    </section>
  `;
}

function renderAthletePicker(state: MobileAppState) {
  if (state.data.athletes.length === 0) {
    return "";
  }

  return renderAthleteSelectControl(state, "athlete-picker");
}

function renderAthleteSelectControl(state: MobileAppState, className: string) {
  return `
    <label class="${escapeHtml(className)}">
      <span>Спортсмен</span>
      <select data-athlete-select>
        ${state.data.athletes.map((athlete) => `
          <option value="${escapeHtml(athlete.athleteId)}" ${state.selectedAthleteId === athlete.athleteId ? "selected" : ""}>
            ${escapeHtml(athlete.fullName)}
          </option>
        `).join("")}
      </select>
    </label>
  `;
}

function renderScreen(state: MobileAppState, athleteId: string | null) {
  if (state.selectedScreen === "athletes") {
    return renderAthletesScreen(state);
  }

  if (state.selectedScreen === "plans") {
    return renderPlansScreen(state, athleteId);
  }

  if (state.selectedScreen === "calendar") {
    return renderCalendarScreen(state, athleteId);
  }

  if (state.selectedScreen === "results") {
    return renderResultsScreen(state, athleteId);
  }

  if (state.selectedScreen === "readiness") {
    return renderReadinessScreen(state);
  }

  return renderDashboardScreen(state, athleteId);
}

function renderDashboardScreen(state: MobileAppState, athleteId: string | null) {
  const plans = getPlansForAthlete(state, athleteId);
  const competitionPlans = getCompetitionPlansForAthlete(state, athleteId);
  const nextStart = getNextCompetitionPlan(competitionPlans);
  const pendingQueue = getPendingQueueItems(state.queue);
  const isCoachView = isCoachRole(state.session.user?.role);
  const selectedDayDate = isCoachView ? state.selectedDayDate : todayValue();
  const visiblePlans = isCoachView
    ? plans.filter((plan) => plan.day.dayDate === selectedDayDate)
    : plans;

  if (isCoachView) {
    return renderCoachDayStatusScreen(state, athleteId, selectedDayDate);
  }

  return `
    <div class="screen-head">
      <h2>Сегодня</h2>
      <p>${nextStart ? `До старта ${daysUntil(nextStart.competitionStartDate)} дн.` : "Ближайший старт не выбран"}</p>
    </div>
    <div class="metric-grid">
      <article><span>Планы</span><strong>${visiblePlans.length}</strong></article>
      <article><span>Старты</span><strong>${competitionPlans.length}</strong></article>
      <article><span>Очередь</span><strong>${pendingQueue.length}</strong></article>
      <article><span>Связь</span><strong>${state.isOnline ? "Есть" : "Нет"}</strong></article>
    </div>
    ${athleteId ? renderAthleteDayIndicators(state, athleteId, selectedDayDate) : ""}
    ${athleteId ? renderDeviceHealthCard(state, athleteId, selectedDayDate) : ""}
    ${nextStart ? `
      <article class="focus-card">
        <span>Следующий старт</span>
        <h3>${escapeHtml(nextStart.competitionTitle)}</h3>
        <p>${formatDate(nextStart.competitionStartDate)} · ${escapeHtml(nextStart.priority)} · ${escapeHtml(nextStart.planType)}</p>
      </article>
    ` : ""}
    ${state.queue.length ? renderQueue(state) : ""}
  `;
}

function renderCoachDayStatusScreen(
  state: MobileAppState,
  athleteId: string | null,
  selectedDayDate: string,
) {
  const dayData = athleteId ? getCoachDayCleanSummary(state, athleteId, selectedDayDate) : null;
  const aiReviewHistory = athleteId
    ? getCoachAiReviewsForDay(state.data.coachAiReviews, athleteId, selectedDayDate)
    : [];
  const aiReview = athleteId
    ? state.aiReviewByDay[getCoachDayAiReviewKey(athleteId, selectedDayDate)] ?? aiReviewHistory[0] ?? null
    : null;

  return `
    <div class="screen-head">
      <h2>Статус дня</h2>
      <p>${formatDate(selectedDayDate)} · план, факт, восстановление, устройство и ИИ в одной карточке</p>
    </div>
    ${renderCoachDayControl(state, athleteId)}
    ${dayData
      ? `
        <div class="coach-day-status-stack">
          ${renderCoachDayStatusCard(dayData, aiReview)}
          ${renderCoachDayDataQualityCard(dayData)}
          ${renderCoachDayExerciseChecklist(dayData)}
          ${renderCoachDeviceWorkoutPanel(dayData, state.isBusy)}
          ${renderDeviceHealthCard(state, dayData.athleteId, selectedDayDate)}
          ${renderCoachAiReviewCard(
            dayData,
            aiReview,
            aiReviewHistory,
            state.coachAiStatus,
            state.coachAiDiagnostic,
            state.isBusy,
          )}
        </div>
      `
      : renderEmpty("Выберите спортсмена", "После выбора спортсмена экран покажет статус выбранного дня.")}
    ${renderCoachTeamDayPanel(state, selectedDayDate)}
  `;
}

function renderCoachDayStatusCard(dayData: CoachDayCleanSummary, aiReview: CoachDayAiReview | null) {
  const summary = dayData.summary;
  const readiness = dayData.readinessEntry;
  const deviceHealth = dayData.deviceHealthSummary;
  const dataQuality = buildCoachDayDataQuality(dayData);
  const completionRate = summary.exerciseCount > 0
    ? Math.round(((summary.completedExerciseCount + summary.partialExerciseCount * 0.5) / summary.exerciseCount) * 100)
    : summary.blockCount > 0
      ? Math.round(((summary.completedBlockCount + summary.partialBlockCount * 0.5) / summary.blockCount) * 100)
      : 0;
  const linkGroups = getCoachDeviceWorkoutLinkGroups(dayData.blocks);
  const linkedSessionCount = linkGroups.filter((group) =>
    getDeviceWorkoutLinkGroupForBlocks(
      dayData.deviceWorkoutLinks,
      group.assignedBlockIds,
    ).isFullyLinked
  ).length;
  const deviceFact = dayData.deviceWorkouts.length
    ? `${dayData.deviceWorkouts.length} тренировок · ${linkedSessionCount}/${linkGroups.length || 0} связано`
    : "тренировки устройства не пришли";
  const loadDelta = roundLoad(summary.actualLoad - summary.plannedLoad);
  const loadExplanation = [
    `Плановая: ${formatLoadValue(summary.plannedLoad)} из назначенных блоков плана.`,
    `Факт по отметкам: ${formatLoadValue(summary.manualActualLoad)} ${dayData.hasExecutionMarks ? "из сохранённых отметок выполнения" : "ручные отметки выполнения не сохранены"}.`,
    `Подтверждено устройством: ${formatLoadValue(summary.deviceConfirmedLoad)} ${linkGroups.length ? `· ${linkedSessionCount}/${linkGroups.length} плановых целей связано` : "· в плане нет цели для привязки тренировки"}.`,
    `Итоговый факт: ${formatLoadValue(summary.actualLoad)} ${summary.deviceConfirmedLoad > summary.manualActualLoad ? "по связанной тренировке устройства" : "без повторного суммирования ручных и device-данных"}.`,
    `Расхождение: ${formatLoadValue(loadDelta)} ${loadDelta === 0
      ? "единиц нагрузки"
      : loadDelta > 0
        ? "выше плана; проверьте длительность/RPE или дополнительную работу"
        : "ниже плана; часть задач не выполнена или не отмечена"}.`,
  ];
  const recoverySummary = deviceHealth
    ? [
        `сон ${formatDeviceHealthSleepValue(deviceHealth)}`,
        `пульс покоя ${formatDeviceHealthRestingHrValue(deviceHealth)}`,
        `SpO2 ${formatDeviceHealthOxygenValue(deviceHealth)}`,
      ].join(" · ")
    : "данные восстановления с устройства не пришли";
  const aiSummary = aiReview
    ? `${formatCoachDayAiReviewSource(aiReview.source)} · ${aiReview.observation}`
    : "ИИ-разбор не сформирован";
  const primaryAction = dataQuality.actions[0] ??
    aiReview?.tomorrowActions[0] ??
    "День можно разбирать по текущим данным.";

  return `
    <section class="coach-day-status-card">
      <div class="coach-day-status-head">
        <div>
          <span>Карточка дня</span>
          <h3>${escapeHtml(dayData.athleteName)}</h3>
          <p>${formatDate(dayData.date)} · ${escapeHtml(summary.statusLabel.toLowerCase())}</p>
        </div>
        <strong>${readiness ? readiness.score : "-"}</strong>
      </div>
      <div class="coach-day-status-brief is-${dataQuality.status}">
        <div class="coach-day-status-brief-main">
          <span>Рабочая сводка тренера</span>
          <strong>${escapeHtml(summary.statusLabel)}</strong>
          <p>${escapeHtml(primaryAction)}</p>
        </div>
        <div class="coach-day-status-brief-grid">
          <article>
            <span>План / факт</span>
            <strong>${escapeHtml(formatLoadValue(summary.actualLoad))} / ${escapeHtml(formatLoadValue(summary.plannedLoad))}</strong>
            <small>отметки ${escapeHtml(formatLoadValue(summary.manualActualLoad))} · устройство ${escapeHtml(formatLoadValue(summary.deviceConfirmedLoad))}</small>
          </article>
          <article>
            <span>Восстановление</span>
            <strong>${readiness ? `готовность ${readiness.score}` : "готовность не отправлена"}</strong>
            <small>${escapeHtml(recoverySummary)}</small>
          </article>
          <article>
            <span>Факт с устройства</span>
            <strong>${escapeHtml(deviceFact)}</strong>
            <small>${deviceHealth?.syncedAt ? `синхронизация: ${formatDateTime(deviceHealth.syncedAt)}` : "нет дневной синхронизации"}</small>
          </article>
          <article>
            <span>ИИ и комментарий</span>
            <strong>${dayData.latestDiaryEntry ? "комментарий есть" : "нет комментария"}</strong>
            <small>${escapeHtml(aiSummary)}</small>
          </article>
        </div>
        <div class="coach-day-load-explanation">
          <strong>Как посчитана нагрузка</strong>
          <ul>
            ${loadExplanation.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </div>
      </div>
      <div class="coach-day-status-grid">
        ${renderCoachExecutionReviewMetric("Готовность", readiness ? String(readiness.score) : "-", readiness ? formatReadinessStatus(readiness.status) : "спортсмен не отправил")}
        ${renderCoachExecutionReviewMetric("Плановая нагрузка", formatLoadValue(summary.plannedLoad), formatCoachTodayPlanNames(summary))}
        ${renderCoachExecutionReviewMetric("Фактическая нагрузка", formatLoadValue(summary.actualLoad), formatCoachTodayLoadDelta(summary))}
        ${renderCoachExecutionReviewMetric("Выполнение", `${summary.completedExerciseCount}/${summary.exerciseCount || 0}`, formatCoachTodayExerciseBreakdown(summary))}
        ${renderCoachExecutionReviewMetric("Сон", formatDeviceHealthSleepValue(deviceHealth), formatDeviceHealthSleepDetail(deviceHealth))}
        ${renderCoachExecutionReviewMetric("Пульс покоя", formatDeviceHealthRestingHrValue(deviceHealth), formatDeviceHealthHeartRateDetail(deviceHealth))}
        ${renderCoachExecutionReviewMetric("SpO2", formatDeviceHealthOxygenValue(deviceHealth), formatDeviceHealthOxygenDetail(deviceHealth))}
        ${renderCoachExecutionReviewMetric("Тренировки устройства", formatDeviceHealthWorkoutValue(deviceHealth), formatDeviceHealthWorkoutDetail(deviceHealth))}
        ${renderCoachExecutionReviewMetric("ИИ", formatCoachAiBriefValue(aiReview), formatCoachAiBriefDetail(aiReview))}
      </div>
      <div class="coach-execution-review-note">
        <strong>Комментарий тренера</strong>
        <p>${escapeHtml(dayData.coachNote)}</p>
      </div>
    </section>
  `;
}

function renderCoachDayDataQualityCard(dayData: CoachDayCleanSummary) {
  const dataQuality = buildCoachDayDataQuality(dayData);

  return `
    <section class="coach-day-quality-card is-${dataQuality.status}">
      <div class="summary-inline-head">
        <div>
          <span>Качество данных</span>
          <h3>${escapeHtml(dataQuality.statusLabel)}</h3>
        </div>
        <strong>${dataQuality.available.length}/${dataQuality.signals.length}</strong>
      </div>
      <div class="device-health-signal-list">
        <article>
          <strong>Что есть</strong>
          <p>${escapeHtml(dataQuality.available.length ? dataQuality.available.join(", ") : "пока ничего")}</p>
        </article>
        <article>
          <strong>Чего не хватает</strong>
          <p>${escapeHtml(dataQuality.missing.length ? dataQuality.missing.join(", ") : "данных достаточно")}</p>
        </article>
      </div>
      <ul class="coach-day-quality-actions">
        ${(dataQuality.actions.length ? dataQuality.actions : ["Можно формировать разбор дня."])
          .map((action) => `<li>${escapeHtml(action)}</li>`)
          .join("")}
      </ul>
    </section>
  `;
}

function renderCoachDayExerciseChecklist(dayData: CoachDayCleanSummary) {
  const exercises = dayData.blocks.flatMap((block) =>
    block.exercises.map((exercise) => ({ block, exercise })),
  );

  if (exercises.length === 0) {
    return renderEmpty("Упражнений в плане нет", "Если на день назначены только блоки без упражнений, смотрите статус блоков в разделе выполнения.");
  }

  return `
    <section class="coach-day-exercise-card">
      <div class="summary-inline-head">
        <div>
          <span>Упражнения дня</span>
          <h3>Что выполнено и что нет</h3>
        </div>
        <strong>${dayData.summary.completedExerciseCount}/${dayData.summary.exerciseCount || 0}</strong>
      </div>
      <div class="coach-day-exercise-list">
        ${exercises.map(({ block, exercise }) => `
          <article class="is-${exercise.status}">
            <span>${escapeHtml(exercise.statusLabel)}</span>
            <strong>${escapeHtml(exercise.name)}</strong>
            <p>${escapeHtml(block.sessionName)} · ${escapeHtml(block.name)} · ${escapeHtml(exercise.plannedWork || "-")} · ${escapeHtml(exercise.sourceLabel)}</p>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderCoachDeviceWorkoutPanel(dayData: CoachDayCleanSummary, isBusy: boolean) {
  const workouts = dayData.deviceWorkouts;
  const linkGroups = getCoachDeviceWorkoutLinkGroups(dayData.blocks);
  const linkedSessionCount = linkGroups.filter((group) =>
    getDeviceWorkoutLinkGroupForBlocks(
      dayData.deviceWorkoutLinks,
      group.assignedBlockIds,
    ).isFullyLinked
  ).length;

  return `
    <section class="coach-day-exercise-card">
      <div class="summary-inline-head">
        <div>
          <span>Данные тренировки с устройства</span>
          <h3>${workouts.length ? `${workouts.length} тренировок пришло` : "Нет тренировок устройства"}</h3>
        </div>
        <div class="device-health-actions">
          <strong>${linkedSessionCount}/${linkGroups.length || 0}</strong>
          <button class="secondary-action" data-refresh type="button" ${isBusy ? "disabled" : ""}>
            Обновить
          </button>
        </div>
      </div>
      ${workouts.length === 0
        ? `<p class="muted-copy">Выбор станет активным после того, как спортсмен синхронизирует детальные тренировки Mi Fitness / Health Connect за эту дату.</p>`
        : ""}
      <div class="coach-day-exercise-list">
        ${linkGroups.map((group) => {
          const assignedBlockIds = group.assignedBlockIds;
          const linkGroup = getDeviceWorkoutLinkGroupForBlocks(dayData.deviceWorkoutLinks, assignedBlockIds);
          const linkedWorkout = linkGroup.linkedWorkout;
          const status = linkedWorkout && linkGroup.isFullyLinked
            ? "completed"
            : linkGroup.isPartiallyLinked || workouts.length
              ? "partial"
              : "missed";
          const statusLabel = linkedWorkout && linkGroup.isFullyLinked
            ? "связано с устройством"
            : linkGroup.isPartiallyLinked || linkGroup.hasMixedWorkouts
              ? "частично связано"
              : workouts.length
                ? "не связано"
                : "нет данных устройства";

          return `
            <article class="is-${status}">
              <span>${escapeHtml(statusLabel)}</span>
              <strong>${escapeHtml(group.label)}</strong>
              <p>${escapeHtml(group.description)}</p>
              <select
                data-device-workout-link
                data-device-workout-plan-id="${escapeHtml(group.assignedPlanId)}"
                data-device-workout-block-ids="${escapeHtml(assignedBlockIds.join(","))}"
                data-device-workout-link-ids="${escapeHtml(linkGroup.links.map((link) => link.id).join(","))}"
                ${isBusy || workouts.length === 0 ? "disabled" : ""}
              >
                <option value="">Выбрать тренировку устройства</option>
                ${workouts.map((workout) => `
                  <option value="${escapeHtml(workout.id)}" ${!linkGroup.hasMixedWorkouts && linkedWorkout?.id === workout.id ? "selected" : ""}>
                    ${escapeHtml(formatDeviceWorkoutOptionLabel(workout))}
                  </option>
                `).join("")}
              </select>
              ${linkedWorkout ? `
                <div class="device-workout-summary-card">
                  <strong>${escapeHtml(formatDeviceWorkoutTitle(linkedWorkout))}</strong>
                  ${renderDeviceWorkoutMetrics(linkedWorkout)}
                  <small>${escapeHtml(linkedWorkout.sourceDevice ?? "Health Connect")} · ${escapeHtml(formatTimeRange(linkedWorkout.startTime, linkedWorkout.endTime))}</small>
                  ${renderDeviceWorkoutGraph(linkedWorkout)}
                </div>
              ` : ""}
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderCoachTeamDayPanel(state: MobileAppState, selectedDayDate: string) {
  if (!isCoachRole(state.session.user?.role) || state.data.athletes.length === 0) {
    return "";
  }

  const rows = state.data.athletes.map((athlete) => {
    const dayData = getCoachDayCleanSummary(state, athlete.athleteId, selectedDayDate);
    const dataQuality = buildCoachDayDataQuality(dayData);
    const aiReview = state.aiReviewByDay[getCoachDayAiReviewKey(athlete.athleteId, selectedDayDate)] ??
      getCoachAiReviewsForDay(state.data.coachAiReviews, athlete.athleteId, selectedDayDate)[0] ??
      null;
    const linkedWorkouts = dayData.deviceWorkoutLinks.length;
    const deviceWorkouts = dayData.deviceWorkouts.length;

    return { aiReview, athlete, dataQuality, dayData, deviceWorkouts, linkedWorkouts };
  });

  return `
    <section class="coach-team-day-panel">
      <div class="summary-inline-head">
        <div>
          <span>Команда за день</span>
          <h3>${formatDate(selectedDayDate)}</h3>
        </div>
        <strong>${rows.length}</strong>
      </div>
      <div class="coach-team-day-list">
        ${rows.map(({ aiReview, athlete, dataQuality, dayData, deviceWorkouts, linkedWorkouts }) => `
          <article class="coach-team-day-row is-${dataQuality.status}">
            <div>
              <strong>${escapeHtml(athlete.fullName)}</strong>
              <span>${escapeHtml(dayData.summary.statusLabel)} · ${escapeHtml(dataQuality.statusLabel)}</span>
            </div>
            <div class="coach-team-day-metrics">
              <span>Гот. ${dayData.readinessEntry ? dayData.readinessEntry.score : "-"}</span>
              <span>${formatLoadValue(dayData.summary.actualLoad)} / ${formatLoadValue(dayData.summary.plannedLoad)}</span>
              <span>Сон ${formatDeviceHealthSleepValue(dayData.deviceHealthSummary)}</span>
              <span>Пульс ${formatDeviceHealthRestingHrValue(dayData.deviceHealthSummary)}</span>
              <span>SpO2 ${formatDeviceHealthOxygenValue(dayData.deviceHealthSummary)}</span>
              <span>Устр. ${deviceWorkouts ? `${linkedWorkouts}/${deviceWorkouts}` : "нет"}</span>
            </div>
            <p>${escapeHtml(aiReview ? `${formatCoachDayAiReviewSource(aiReview.source)} · ${aiReview.riskNotes[0] ?? aiReview.observation}` : "ИИ-разбор не сформирован")}</p>
            <button data-athlete-card="${escapeHtml(athlete.athleteId)}" type="button">Открыть день</button>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderAthletesScreen(state: MobileAppState) {
  if (state.session.user?.role === "athlete") {
    return `
      <div class="screen-head">
        <h2>Профиль</h2>
        <p>${escapeHtml(state.session.user.fullName)}</p>
      </div>
      ${renderProfileCard(state.session.user)}
    `;
  }

  if (state.data.athletes.length === 0) {
    return renderEmpty("Спортсменов пока нет", "Обновите данные или назначьте спортсменов на сайте.");
  }

  const selectedAthlete = getSelectedAthlete(state) ?? state.data.athletes[0] ?? null;

  return `
    <div class="screen-head">
      <h2>Спортсмены</h2>
      <p>${state.data.athletes.length} в списке</p>
    </div>
    ${renderAthleteSelectControl(state, "athlete-picker athlete-screen-picker")}
    ${selectedAthlete ? renderCoachAthleteCard(selectedAthlete) : ""}
    ${selectedAthlete ? renderCoachAthleteDayBrief(state, selectedAthlete.athleteId) : ""}
  `;
}

function renderCoachDayControl(state: MobileAppState, athleteId: string | null) {
  const selectedDayDate = state.selectedDayDate;
  const options = getCoachSelectableDayOptions(state, athleteId);
  const selectedOption = options.some((option) => option.date === selectedDayDate);

  return `
    <section class="coach-day-control" aria-label="Выбор дня спортсмена">
      <div class="coach-day-control-head">
        <div>
          <span>Выбранный день</span>
          <strong>${escapeHtml(formatDayRelativeLabel(selectedDayDate))}</strong>
          <small>${formatDate(selectedDayDate)}</small>
        </div>
        <input data-coach-day-date type="date" value="${escapeHtml(selectedDayDate)}" />
      </div>
      <div class="coach-day-control-actions">
        <button data-coach-day-shift="-1" type="button">Вчера</button>
        <button data-coach-day-shift="today" type="button">Сегодня</button>
        <button data-coach-day-shift="1" type="button">Завтра</button>
      </div>
      ${options.length ? `
        <label class="coach-day-plan-select">
          <span>Даты из плана, дневника и календаря</span>
          <select data-coach-day-plan-date>
            ${selectedOption ? "" : `<option value="${escapeHtml(selectedDayDate)}" selected>${formatDate(selectedDayDate)} · выбранный день</option>`}
            ${options.map((option) => `
              <option value="${escapeHtml(option.date)}" ${selectedDayDate === option.date ? "selected" : ""}>
                ${formatDate(option.date)} · ${escapeHtml(option.label)}
              </option>
            `).join("")}
          </select>
        </label>
      ` : ""}
    </section>
  `;
}

function renderCoachAthleteCard(athlete: CoachAthleteSummary) {
  const profileParts = [
    athlete.sport,
    athlete.discipline,
    athlete.weightClass ? `вес ${athlete.weightClass}` : "",
  ].filter(Boolean);
  const baselineParts = [
    athlete.baselineRestingHr !== null ? `пульс ${athlete.baselineRestingHr}` : "",
    athlete.baselineWeightKg !== null ? `вес ${athlete.baselineWeightKg} кг` : "",
  ].filter(Boolean);

  return `
    <article class="coach-athlete-card">
      <div>
        <span>Выбранный спортсмен</span>
        <h3>${escapeHtml(athlete.fullName)}</h3>
        <p>${escapeHtml(athlete.email)}</p>
      </div>
      <div class="coach-athlete-card-grid">
        <span>${escapeHtml(profileParts.join(" · ") || "Профиль не заполнен")}</span>
        <span>${escapeHtml(baselineParts.join(" · ") || "Базовые показатели не заданы")}</span>
      </div>
    </article>
  `;
}

function renderCoachAthleteDayBrief(state: MobileAppState, athleteId: string) {
  const selectedDayDate = state.selectedDayDate;
  const dayData = getCoachDayCleanSummary(state, athleteId, selectedDayDate);
  const entry = dayData.readinessEntry;
  const daySummary = dayData.summary;
  const deviceHealth = dayData.deviceHealthSummary;
  const nextStart = getNextCompetitionPlan(getCompetitionPlansForAthlete(state, athleteId));
  const aiReview = state.aiReviewByDay[getCoachDayAiReviewKey(athleteId, selectedDayDate)] ??
    getCoachAiReviewsForDay(state.data.coachAiReviews, athleteId, selectedDayDate)[0] ??
    null;
  const cardStateClass = entry ? `readiness-${escapeHtml(entry.status)}` : "is-missing-readiness";
  const startLabel = nextStart
    ? `${formatShortDate(nextStart.competitionStartDate)} · через ${daysUntil(nextStart.competitionStartDate)} дн.`
    : "стартов нет";

  return `
    <section class="athlete-day-brief-card ${cardStateClass}">
      <div class="athlete-day-brief-head">
        <div>
          <span>Краткий статус дня</span>
          <h3>${escapeHtml(formatDayRelativeLabel(selectedDayDate))} · ${formatShortDate(selectedDayDate)}</h3>
          <p>${escapeHtml(entry ? formatReadinessFlags(entry) : "готовность не отправлена")} · ${escapeHtml(daySummary.statusLabel.toLowerCase())}</p>
        </div>
        <strong>${entry ? entry.score : "-"}</strong>
      </div>
      <div class="athlete-day-brief-grid">
        ${renderCoachAthleteBriefMetric("План на день", formatCoachTodayPlanCount(daySummary), formatCoachTodayPlanNames(daySummary))}
        ${renderCoachAthleteBriefMetric("Выполнение", `${daySummary.completedExerciseCount}/${daySummary.exerciseCount || 0}`, formatCoachTodayExerciseBreakdown(daySummary))}
        ${renderCoachAthleteBriefMetric("Нагрузка", `${formatLoadValue(daySummary.actualLoad)} / ${formatLoadValue(daySummary.plannedLoad)}`, formatCoachTodayLoadDelta(daySummary))}
        ${renderCoachAthleteBriefMetric("Устройство", formatDeviceHealthBriefValue(deviceHealth), formatDeviceHealthBriefDetail(deviceHealth))}
        ${renderCoachAthleteBriefMetric("ИИ", formatCoachAiBriefValue(aiReview), formatCoachAiBriefDetail(aiReview))}
        ${renderCoachAthleteBriefMetric("Ближайший старт", nextStart ? formatShortDate(nextStart.competitionStartDate) : "-", startLabel)}
      </div>
      <p class="athlete-day-brief-note">Комментарий: ${escapeHtml(dayData.coachNote)}</p>
      <div class="athlete-day-brief-actions" aria-label="Быстрые действия по спортсмену">
        <button class="primary-action" data-screen="dashboard" type="button">Открыть день</button>
        <button class="secondary-action" data-screen="plans" type="button">Планы</button>
        <button class="secondary-action" data-screen="results" type="button">Разбор</button>
      </div>
    </section>
  `;
}

function renderCoachAthleteBriefMetric(label: string, value: string, detail: string) {
  return `
    <article>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(detail)}</small>
    </article>
  `;
}

function formatCoachAiBriefValue(review: CoachDayAiReview | null) {
  return review ? formatCoachDayAiReviewSource(review.source) : "-";
}

function formatCoachAiBriefDetail(review: CoachDayAiReview | null) {
  if (!review) {
    return "разбор ещё не сформирован";
  }

  return review.tomorrowActions[0] || review.observation;
}

function renderAthleteDayIndicators(state: MobileAppState, athleteId: string, date: string) {
  const dayData = getCoachDayCleanSummary(state, athleteId, date);
  const entry = dayData.readinessEntry;
  const daySummary = dayData.summary;
  const title = dayData.athlete ? `Показатели дня · ${dayData.athlete.fullName}` : "Показатели дня";
  const cardStateClass = entry ? `readiness-${escapeHtml(entry.status)}` : "is-missing-readiness";

  return `
    <section class="today-indicators-card ${cardStateClass}">
      <div class="today-indicators-head">
        <div>
          <span>${escapeHtml(formatDayRelativeLabel(date))}</span>
          <h3>${escapeHtml(title)}</h3>
          <p>${formatDate(date)} · ${escapeHtml(entry ? formatReadinessFlags(entry) : "готовность не отправлена")} · ${escapeHtml(daySummary.statusLabel.toLowerCase())}</p>
        </div>
        <strong>${entry ? entry.score : "-"}</strong>
      </div>
      <div class="today-indicators-grid">
        ${renderTodayIndicator("Готовность", entry ? formatReadinessStatus(entry.status) : "нет записи", entry ? `оценка ${entry.score}` : "спортсмен ещё не отправил")}
        ${renderTodayIndicator("Сон", entry ? `${formatReadinessNumber(entry.sleepHours)} ч` : "-", entry ? `качество ${entry.sleepQuality}/5` : "нет данных")}
        ${renderTodayIndicator("Самочувствие", entry ? `${entry.generalFeeling}/5` : "-", entry ? `мотивация ${entry.motivationLevel}/5` : "нет данных")}
        ${renderTodayIndicator("Усталость", entry ? `${entry.fatigueLevel}/5` : "-", entry ? `мышцы ${entry.muscleSoreness}/5` : "нет данных")}
        ${renderTodayIndicator("Пульс", entry ? `${entry.restingHr}` : "-", "покой")}
        ${renderTodayIndicator("Вес", entry ? `${formatReadinessNumber(entry.bodyWeight)} кг` : "-", entry ? `боль ${entry.painLevel}/10` : "нет данных")}
      </div>
      <div class="today-day-summary">
        <div class="today-day-summary-head">
          <strong>День по плану</strong>
          <span class="execution-day-status is-${daySummary.status}">${escapeHtml(daySummary.statusLabel)}</span>
        </div>
        <div class="today-indicators-grid">
          ${renderTodayIndicator("План", formatCoachTodayPlanCount(daySummary), formatCoachTodayPlanNames(daySummary))}
          ${renderTodayIndicator("Блоки", `${daySummary.completedBlockCount}/${daySummary.blockCount || 0}`, formatCoachTodayBlockBreakdown(daySummary))}
          ${renderTodayIndicator("Упражнения", `${daySummary.completedExerciseCount}/${daySummary.exerciseCount || 0}`, formatCoachTodayExerciseBreakdown(daySummary))}
          ${renderTodayIndicator("Нагрузка", `${formatLoadValue(daySummary.actualLoad)} / ${formatLoadValue(daySummary.plannedLoad)}`, formatCoachTodayLoadDelta(daySummary))}
        </div>
      </div>
      <div class="today-coach-note">
        <strong>Комментарий тренера</strong>
        ${dayData.latestDiaryEntry
          ? `
            <p>${escapeHtml(dayData.latestDiaryEntry.notes)}</p>
            <small>${escapeHtml(dayData.latestDiaryEntry.coachName)} · ${formatDateTime(dayData.latestDiaryEntry.updatedAt)}</small>
          `
          : "<p>Комментария за выбранный день пока нет.</p>"}
      </div>
    </section>
  `;
}

function renderDeviceHealthCard(state: MobileAppState, athleteId: string, date: string) {
  const summary = getDeviceHealthSummaryForDate(state, athleteId, date);
  const workouts = getDeviceWorkoutsForDate(state, athleteId, date);
  const canSync = state.session.user?.role === "athlete" &&
    state.session.user.athleteId === athleteId;
  const syncLabel = formatDeviceHealthSyncLabel(summary);
  const status = getDeviceHealthStatus(summary);

  return `
    <section class="device-health-card">
      <div class="device-health-head">
        <div>
          <span>Huawei Health / Health Connect</span>
          <h3>Данные устройства</h3>
          <p>${escapeHtml(formatDate(date))} · ${escapeHtml(syncLabel)}</p>
        </div>
        ${canSync ? `
          <div class="device-health-actions">
            <button class="secondary-action" data-huawei-health-sync data-huawei-health-date="${escapeHtml(date)}" type="button" ${state.isBusy ? "disabled" : ""}>
              Huawei
            </button>
            <button class="secondary-action" data-health-connect-sync data-health-connect-date="${escapeHtml(date)}" type="button" ${state.isBusy ? "disabled" : ""}>
              Health Connect
            </button>
          </div>
        ` : ""}
      </div>
      <div class="device-health-status ${summary ? "is-connected" : "is-missing"}">
        <strong>${escapeHtml(status.statusLabel)}</strong>
        <span>${escapeHtml(formatDeviceHealthActionText(summary, canSync))}</span>
      </div>
      <div class="today-indicators-grid">
        ${renderTodayIndicator(
          "Сон",
          formatDeviceHealthSleepValue(summary),
          formatDeviceHealthSleepDetail(summary),
        )}
        ${renderTodayIndicator(
          "Пульс покоя",
          formatDeviceHealthRestingHrValue(summary),
          formatDeviceHealthHeartRateDetail(summary),
        )}
        ${renderTodayIndicator(
          "SpO2",
          formatDeviceHealthOxygenValue(summary),
          formatDeviceHealthOxygenDetail(summary),
        )}
        ${renderTodayIndicator(
          "Тренировки",
          formatDeviceHealthWorkoutValue(summary),
          formatDeviceHealthWorkoutDetail(summary),
        )}
        ${renderTodayIndicator(
          "Источник",
          summary ? "подключён" : "нет данных",
          summary?.sourceDevice || "разрешение выдаёт спортсмен",
        )}
      </div>
      <div class="device-health-signal-list">
        <article>
          <strong>Что пришло</strong>
          <p>${escapeHtml(status.present.length ? status.present.join(", ") : "пока ничего")}</p>
        </article>
        <article>
          <strong>Чего не хватает</strong>
          <p>${escapeHtml(status.missing.length ? status.missing.join(", ") : "достаточно для разбора дня")}</p>
        </article>
      </div>
      ${renderHealthConnectDiagnostics(summary)}
      ${canSync && SHOW_DIRECT_WATCH_DIAGNOSTICS ? renderDirectWatchDiagnostics(state) : ""}
      ${workouts.length ? `
        <div class="device-health-signal-list">
          ${workouts.map((workout) => `
            <article>
              <strong>${escapeHtml(formatDeviceWorkoutTitle(workout))}</strong>
              <p>${escapeHtml(formatDeviceWorkoutSummary(workout) || workout.sourceDevice || "Health Connect")}</p>
            </article>
          `).join("")}
        </div>
      ` : ""}
      <p class="device-health-guidance">
        Данные устройства не заменяют отметки выполнения. Они помогают тренеру сопоставить план, факт, сон, пульс и внешнюю активность за выбранный день.
      </p>
    </section>
  `;
}

function renderDirectWatchDiagnostics(state: MobileAppState) {
  const diagnostic = state.directWatchDiagnostic;
  const devices = diagnostic.devices
    .slice()
    .sort((left, right) =>
      Number(Boolean(right.isLikelyWatch)) - Number(Boolean(left.isLikelyWatch)) ||
      (right.rssi ?? -999) - (left.rssi ?? -999),
    )
    .slice(0, 8);
  const inspection = diagnostic.inspection;
  const services = inspection?.services ?? [];
  const knownServices = services
    .filter((service) => service.name && service.name !== "Unknown")
    .map((service) => service.name as string);

  return `
    <div class="device-health-diagnostics direct-watch-diagnostics">
      <div class="summary-inline-head">
        <div>
          <span>Прямое подключение часов</span>
          <h3>Redmi Watch 5 через Bluetooth</h3>
        </div>
        <button class="secondary-action" data-direct-watch-scan type="button" ${state.isBusy ? "disabled" : ""}>
          Найти часы
        </button>
      </div>
      <p>
        Этот блок проверяет, какие данные часы отдают напрямую телефону. Пока это диагностика: поиск часов и проверка BLE-сервисов, без записи тренировки.
      </p>
      ${diagnostic.scannedAt ? `<p class="muted-copy">Последний поиск: ${escapeHtml(formatDateTime(diagnostic.scannedAt))}</p>` : ""}
      ${devices.length ? `
        <div class="direct-watch-device-list">
          ${devices.map((device) => `
            <article>
              <div>
                <strong>${escapeHtml(device.name || "Bluetooth-устройство")}</strong>
                <span>${escapeHtml(device.isLikelyWatch ? "похоже на часы" : "устройство рядом")} · ${escapeHtml(formatDirectWatchSignal(device.rssi))}</span>
                <span>${escapeHtml(formatDirectWatchBondState(device.bondState))} · ${escapeHtml(formatDirectWatchDeviceType(device.deviceType))} · ${escapeHtml(formatDirectWatchConnectable(device.isConnectable))}</span>
                <span>${escapeHtml(formatDirectWatchDeviceId(device.id))}</span>
                ${renderDirectWatchAdvertisedData(device)}
              </div>
              <div class="direct-watch-device-actions">
                ${device.bondState !== "bonded" ? `
                  <button
                    class="secondary-action"
                    data-direct-watch-pair="${escapeHtml(device.id)}"
                    type="button"
                    ${state.isBusy ? "disabled" : ""}
                  >
                    Сопрячь
                  </button>
                ` : ""}
                <button
                  class="secondary-action"
                  data-direct-watch-inspect="${escapeHtml(device.id)}"
                  type="button"
                  ${state.isBusy ? "disabled" : ""}
                >
                  Проверить
                </button>
              </div>
            </article>
          `).join("")}
        </div>
      ` : `
        <div class="device-health-status is-missing">
          <strong>Часы ещё не найдены</strong>
          <span>Нажмите “Найти часы”, держите Redmi Watch 5 рядом и включите Bluetooth.</span>
        </div>
      `}
      ${inspection ? `
        <div class="direct-watch-inspection">
          <div class="device-health-status ${inspection.hasHeartRateService ? "is-connected" : "is-missing"}">
            <strong>${escapeHtml(inspection.hasHeartRateService ? "Пульс доступен по стандартному BLE" : "Стандартный пульс не найден")}</strong>
            <span>${escapeHtml(formatDirectWatchInspectionSummary(inspection))}</span>
          </div>
          <div class="device-health-diagnostics-grid">
            <article>
              <span>Устройство</span>
              <strong>${escapeHtml(inspection.deviceName || "Redmi Watch 5")}</strong>
            </article>
            <article>
              <span>Сопряжение</span>
              <strong>${escapeHtml(formatDirectWatchBondState(inspection.bondState))}</strong>
            </article>
            <article>
              <span>Сервисов</span>
              <strong>${escapeHtml(String(inspection.serviceCount ?? services.length))}</strong>
            </article>
            <article>
              <span>Пульс</span>
              <strong>${escapeHtml(inspection.hasHeartRateService ? "есть" : "нет")}</strong>
            </article>
            <article>
              <span>Известные сервисы</span>
              <strong>${escapeHtml(knownServices.length ? knownServices.join(", ") : "не найдены")}</strong>
            </article>
          </div>
          ${services.length ? `
            <details class="direct-watch-services">
              <summary>Показать BLE-сервисы</summary>
              <ul>
                ${services.slice(0, 12).map((service) => `
                  <li>
                    <strong>${escapeHtml(service.name || "Unknown")}</strong>
                    <span>${escapeHtml(service.uuid)}</span>
                  </li>
                `).join("")}
              </ul>
            </details>
          ` : ""}
        </div>
      ` : ""}
    </div>
  `;
}

function formatDirectWatchSignal(rssi: number | null | undefined) {
  if (typeof rssi !== "number" || !Number.isFinite(rssi)) {
    return "сигнал неизвестен";
  }

  if (rssi >= -60) {
    return `сильный сигнал ${rssi} dBm`;
  }

  if (rssi >= -75) {
    return `средний сигнал ${rssi} dBm`;
  }

  return `слабый сигнал ${rssi} dBm`;
}

function formatDirectWatchBondState(state: string | null | undefined) {
  if (state === "bonded") {
    return "сопряжено";
  }

  if (state === "bonding") {
    return "идёт сопряжение";
  }

  if (state === "not-bonded") {
    return "не сопряжено";
  }

  return "сопряжение неизвестно";
}

function formatDirectWatchDeviceType(type: string | null | undefined) {
  if (type === "le") {
    return "BLE";
  }

  if (type === "dual") {
    return "Bluetooth dual";
  }

  if (type === "classic") {
    return "Bluetooth classic";
  }

  return "тип неизвестен";
}

function formatDirectWatchConnectable(value: boolean | null | undefined) {
  if (value === true) {
    return "можно подключаться";
  }

  if (value === false) {
    return "не рекламирует подключение";
  }

  return "подключение неизвестно";
}

function formatDirectWatchDeviceId(id: string) {
  if (!id) {
    return "ID неизвестен";
  }

  return id.length > 7 ? `ID ...${id.slice(-7)}` : `ID ${id}`;
}

function renderDirectWatchAdvertisedData(
  device: MobileAppState["directWatchDiagnostic"]["devices"][number],
) {
  const serviceUuids = device.serviceUuids ?? [];
  const manufacturerData = device.manufacturerData ?? [];
  const serviceData = device.serviceData ?? [];

  if (!serviceUuids.length && !manufacturerData.length && !serviceData.length && device.txPowerLevel == null) {
    return `<span>рекламируемых BLE-сервисов нет</span>`;
  }

  return `
    <details class="direct-watch-advertisement">
      <summary>Данные поиска Bluetooth</summary>
      <ul>
        ${device.txPowerLevel != null ? `<li><strong>TX power</strong><span>${escapeHtml(String(device.txPowerLevel))}</span></li>` : ""}
        ${serviceUuids.map((uuid) => `
          <li><strong>Service UUID</strong><span>${escapeHtml(uuid)}</span></li>
        `).join("")}
        ${manufacturerData.map((item) => `
          <li>
            <strong>Manufacturer ${escapeHtml(item.companyId != null ? String(item.companyId) : "-")}</strong>
            <span>${escapeHtml(`${item.byteLength ?? 0} байт${item.previewHex ? ` · ${item.previewHex}` : ""}`)}</span>
          </li>
        `).join("")}
        ${serviceData.map((item) => `
          <li>
            <strong>Service data</strong>
            <span>${escapeHtml(`${item.uuid ?? "-"} · ${item.byteLength ?? 0} байт${item.previewHex ? ` · ${item.previewHex}` : ""}`)}</span>
          </li>
        `).join("")}
      </ul>
    </details>
  `;
}

function formatDirectWatchInspectionSummary(
  inspection: NonNullable<MobileAppState["directWatchDiagnostic"]["inspection"]>,
) {
  const parts = [
    inspection.hasHeartRateService ? "сервис пульса есть" : "сервиса пульса нет",
    inspection.hasBatteryService ? "батарея есть" : null,
    inspection.hasDeviceInfoService ? "информация об устройстве есть" : null,
  ].filter((part): part is string => Boolean(part));

  return parts.join(", ");
}

function renderHealthConnectDiagnostics(summary: DeviceHealthDailySummary | null) {
  if (!summary || summary.provider !== "health-connect") {
    return "";
  }

  const rawPayload = summary.rawPayload ?? {};
  const items = [
    {
      label: "Источник",
      value: readDeviceHealthRawText(rawPayload, "dataOrigin") || "Health Connect",
    },
    {
      label: "Xiaomi / Notify",
      value: readDeviceHealthRawBoolean(rawPayload, "hasKnownHealthSource") === false ? "не найден" : "найден",
    },
    {
      label: "Сон",
      value: formatHealthConnectDiagnosticCount(rawPayload, "sleepRecordCount", "allSleepRecordCount"),
    },
    {
      label: "Пульс покоя",
      value: formatHealthConnectDiagnosticCount(
        rawPayload,
        "restingHeartRateRecordCount",
        "allRestingHeartRateRecordCount",
      ),
    },
    {
      label: "Расчёт покоя",
      value: formatHealthConnectRestingHrEstimate(rawPayload),
    },
    {
      label: "Пульс",
      value: formatHealthConnectDiagnosticCount(rawPayload, "heartRateRecordCount", "allHeartRateRecordCount"),
    },
    {
      label: "SpO2",
      value: formatHealthConnectDiagnosticCount(
        rawPayload,
        "oxygenSaturationRecordCount",
        "allOxygenSaturationRecordCount",
      ),
    },
    {
      label: "Тренировки",
      value: formatHealthConnectDiagnosticCount(rawPayload, "exerciseRecordCount", "allExerciseRecordCount"),
    },
    {
      label: "Дистанция",
      value: formatHealthConnectDiagnosticCount(rawPayload, "distanceRecordCount", "allDistanceRecordCount"),
    },
    {
      label: "Калории",
      value: `${formatHealthConnectDiagnosticCount(rawPayload, "activeCaloriesRecordCount", "allActiveCaloriesRecordCount")} активных`,
    },
    {
      label: "Все источники",
      value: readDeviceHealthRawText(rawPayload, "allDataOrigins") || "появятся после новой синхронизации",
    },
  ];
  const sleepCount = readDeviceHealthRawCount(rawPayload, "sleepRecordCount");
  const restingHrCount = readDeviceHealthRawCount(rawPayload, "restingHeartRateRecordCount");
  const allSleepCount = readDeviceHealthRawOptionalCount(rawPayload, "allSleepRecordCount");
  const allRestingHrCount = readDeviceHealthRawOptionalCount(rawPayload, "allRestingHeartRateRecordCount");
  const restingHrSource = readDeviceHealthRawText(rawPayload, "restingHeartRateSource");
  const guidance = sleepCount === 0 && (allSleepCount ?? 0) > 0
    ? "Сон есть в Health Connect, но источник не входит в поддерживаемые источники Xiaomi/Notify. Проверьте, какое приложение записало сон."
    : restingHrCount === 0 && (allRestingHrCount ?? 0) > 0
      ? "Пульс покоя есть в Health Connect, но источник не входит в поддерживаемые источники Xiaomi/Notify. Проверьте источник записи пульса покоя."
      : restingHrCount === 0 && isEstimatedRestingHrSource(restingHrSource)
        ? "Отдельного пульса покоя нет, поэтому PERFORM рассчитал средний пульс только по замерам внутри интервала сна. Для аналитики это помечено как оценка."
      : sleepCount === 0 || restingHrCount === 0
        ? "Если разрешения включены, но счётчик Xiaomi/Notify 0, значит приложение-источник не передало этот тип данных в Health Connect за выбранный день."
    : "Health Connect отдал ключевые записи для разбора дня.";

  return `
    <div class="device-health-diagnostics">
      <div class="summary-inline-head">
        <div>
          <span>Диагностика Health Connect</span>
          <h3>Что реально отдал Health Connect</h3>
        </div>
      </div>
      <div class="device-health-diagnostics-grid">
        ${items.map((item) => `
          <article>
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.value)}</strong>
          </article>
        `).join("")}
      </div>
      <p>${escapeHtml(guidance)}</p>
    </div>
  `;
}

function readDeviceHealthRawText(rawPayload: Record<string, unknown>, key: string) {
  const value = rawPayload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readDeviceHealthRawBoolean(rawPayload: Record<string, unknown>, key: string) {
  const value = rawPayload[key];

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value.toLowerCase() === "true") {
      return true;
    }
    if (value.toLowerCase() === "false") {
      return false;
    }
  }

  return null;
}

function readDeviceHealthRawCount(rawPayload: Record<string, unknown>, key: string) {
  const value = rawPayload[key];
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? Math.max(0, Math.trunc(numericValue)) : 0;
}

function readDeviceHealthRawNumber(rawPayload: Record<string, unknown>, key: string) {
  const value = rawPayload[key];
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function readDeviceHealthRawOptionalCount(rawPayload: Record<string, unknown>, key: string) {
  if (!(key in rawPayload)) {
    return null;
  }

  return readDeviceHealthRawCount(rawPayload, key);
}

function formatHealthConnectDiagnosticCount(
  rawPayload: Record<string, unknown>,
  miFitnessKey: string,
  allSourcesKey: string,
) {
  const miFitnessCount = readDeviceHealthRawCount(rawPayload, miFitnessKey);
  const allSourcesCount = readDeviceHealthRawOptionalCount(rawPayload, allSourcesKey);

  return allSourcesCount === null
    ? `${miFitnessCount} Xiaomi/Notify`
    : `${miFitnessCount} Xiaomi/Notify / ${allSourcesCount} всего`;
}

function formatHealthConnectRestingHrEstimate(rawPayload: Record<string, unknown>) {
  const source = readDeviceHealthRawText(rawPayload, "restingHeartRateSource");
  const estimatedBpm = readDeviceHealthRawNumber(rawPayload, "estimatedRestingHeartRate");
  const sleepSamples = readDeviceHealthRawCount(rawPayload, "sleepHeartRateSampleCount");

  if (source === "health-connect-resting-record") {
    return "получен напрямую";
  }

  if (source === "calculated-from-sleep-heart-rate" && estimatedBpm !== null) {
    const windowLabel = formatDeviceHealthRawTimeRange(rawPayload);
    return `≈${formatLoadValue(estimatedBpm)} средний за сон (${[
      `${sleepSamples} зам.`,
      windowLabel,
    ].filter(Boolean).join(", ")})`;
  }

  if (source === "estimated-from-sleep-heart-rate" && estimatedBpm !== null) {
    return `≈${formatLoadValue(estimatedBpm)} по сну (${sleepSamples} зам.)`;
  }

  return "нет данных";
}

function isEstimatedRestingHrSource(source: string | null) {
  return source === "calculated-from-sleep-heart-rate" || source === "estimated-from-sleep-heart-rate";
}

function getDeviceHealthStatus(summary: DeviceHealthDailySummary | null) {
  if (!summary) {
    return {
      missing: ["сон", "пульс покоя", "тренировки с устройства"],
      present: [] as string[],
      statusLabel: "Нет синхронизации",
    };
  }

  const present: string[] = [];
  const missing: string[] = [];

  if (hasDeviceSleepData(summary)) {
    present.push("сон");
  } else {
    missing.push("сон");
  }

  if (summary.heartRate?.restingBpm !== null && summary.heartRate?.restingBpm !== undefined) {
    present.push("пульс покоя");
  } else {
    missing.push("пульс покоя");
  }

  if (hasDeviceOxygenSaturationData(summary)) {
    present.push("SpO2");
  } else {
    missing.push("SpO2");
  }

  if (summary.workout) {
    present.push(summary.workout.count > 0 ? "тренировки с устройства" : "тренировки: 0");
  } else {
    missing.push("тренировки с устройства");
  }

  return {
    missing,
    present,
    statusLabel: missing.length === 0
      ? "Данные полные"
      : present.length > 0
        ? "Данные частичные"
        : "Данных мало",
  };
}

function hasDeviceSleepData(summary: DeviceHealthDailySummary | null) {
  return Boolean(
    summary?.sleep &&
      (
        summary.sleep.durationMinutes !== null ||
        summary.sleep.score !== null ||
        summary.sleep.deepMinutes !== null ||
        summary.sleep.lightMinutes !== null ||
        summary.sleep.remMinutes !== null
      ),
  );
}

function hasDeviceOxygenSaturationData(summary: DeviceHealthDailySummary | null) {
  return Boolean(
    summary?.oxygenSaturation &&
      (
        summary.oxygenSaturation.sampleCount > 0 ||
        summary.oxygenSaturation.latestPercent !== null ||
        summary.oxygenSaturation.averagePercent !== null ||
        summary.oxygenSaturation.minPercent !== null ||
        summary.oxygenSaturation.maxPercent !== null
      ),
  );
}

function formatDeviceHealthSyncLabel(summary: DeviceHealthDailySummary | null) {
  return summary
    ? `последняя синхронизация: ${formatDateTime(summary.syncedAt)}`
    : "за этот день синхронизации пока нет";
}

function formatDeviceHealthActionText(summary: DeviceHealthDailySummary | null, canSync: boolean) {
  const status = getDeviceHealthStatus(summary);

  if (!summary) {
    return canSync
      ? "Нажмите синхронизацию после сна или тренировки."
      : "Попросите спортсмена синхронизировать Huawei Health или Mi Fitness за этот день.";
  }

  if (status.missing.length > 0) {
    return `Проверьте доступ к данным: ${status.missing.join(", ")}.`;
  }

  return "Можно учитывать в разборе дня и рекомендации ИИ.";
}

function formatDeviceHealthSleepValue(summary: DeviceHealthDailySummary | null) {
  if (!summary?.sleep) {
    return "-";
  }

  if (summary.sleep.durationMinutes !== null) {
    return formatDurationHours(summary.sleep.durationMinutes);
  }

  return summary.sleep.score !== null ? `оценка ${formatLoadValue(summary.sleep.score)}` : "-";
}

function formatDeviceHealthSleepDetail(summary: DeviceHealthDailySummary | null) {
  if (!summary?.sleep) {
    return "сон не пришёл";
  }

  const parts = [
    summary.sleep.score !== null ? `оценка ${formatLoadValue(summary.sleep.score)}` : null,
    summary.sleep.deepMinutes !== null ? `глубокий ${formatDurationHours(summary.sleep.deepMinutes)}` : null,
    summary.sleep.remMinutes !== null ? `REM ${formatDurationHours(summary.sleep.remMinutes)}` : null,
  ].filter((item): item is string => Boolean(item));

  return parts.length ? parts.join(" · ") : "нет детализации сна";
}

function formatDeviceHealthRestingHrValue(summary: DeviceHealthDailySummary | null) {
  const source = readDeviceHealthRawText(summary?.rawPayload ?? {}, "restingHeartRateSource");
  return summary?.heartRate?.restingBpm !== null && summary?.heartRate?.restingBpm !== undefined
    ? `${isEstimatedRestingHrSource(source) ? "≈" : ""}${formatLoadValue(summary.heartRate.restingBpm)}`
    : "-";
}

function formatDeviceHealthHeartRateDetail(summary: DeviceHealthDailySummary | null) {
  if (!summary?.heartRate) {
    return "пульс не пришёл";
  }

  const rawPayload = summary.rawPayload ?? {};
  const restingSource = readDeviceHealthRawText(rawPayload, "restingHeartRateSource");

  if (restingSource === "calculated-from-sleep-heart-rate") {
    const parts = [
      "средний за сон",
      readDeviceHealthRawCount(rawPayload, "sleepHeartRateSampleCount") > 0
        ? `${readDeviceHealthRawCount(rawPayload, "sleepHeartRateSampleCount")} зам.`
        : null,
      formatDeviceHealthRawTimeRange(rawPayload),
    ].filter((item): item is string => Boolean(item));

    return parts.join(" · ");
  }

  if (restingSource === "health-connect-resting-record") {
    return "получен напрямую из Health Connect";
  }

  const parts = [
    isEstimatedRestingHrSource(restingSource)
      ? "пульс покоя рассчитан"
      : null,
    summary.heartRate.averageBpm !== null ? `средний ${formatLoadValue(summary.heartRate.averageBpm)}` : null,
    summary.heartRate.minBpm !== null ? `мин ${formatLoadValue(summary.heartRate.minBpm)}` : null,
    summary.heartRate.maxBpm !== null ? `макс ${formatLoadValue(summary.heartRate.maxBpm)}` : null,
  ].filter((item): item is string => Boolean(item));

  return parts.length ? parts.join(" · ") : "нет пульса покоя";
}

function formatDeviceHealthOxygenValue(summary: DeviceHealthDailySummary | null) {
  const oxygenSaturation = summary?.oxygenSaturation;
  const value = oxygenSaturation?.latestPercent ?? oxygenSaturation?.averagePercent;

  return value !== null && value !== undefined ? `${formatLoadValue(value)}%` : "-";
}

function formatDeviceHealthOxygenDetail(summary: DeviceHealthDailySummary | null) {
  const oxygenSaturation = summary?.oxygenSaturation;

  if (!oxygenSaturation || oxygenSaturation.sampleCount <= 0) {
    return "нет данных";
  }

  const parts = [
    oxygenSaturation.averagePercent !== null ? `средний ${formatLoadValue(oxygenSaturation.averagePercent)}%` : null,
    oxygenSaturation.minPercent !== null && oxygenSaturation.maxPercent !== null
      ? `${formatLoadValue(oxygenSaturation.minPercent)}-${formatLoadValue(oxygenSaturation.maxPercent)}%`
      : null,
    `${oxygenSaturation.sampleCount} зам.`,
  ].filter((item): item is string => Boolean(item));

  return parts.join(" · ");
}

function formatDeviceHealthRawTimeRange(rawPayload: Record<string, unknown>) {
  const start = readDeviceHealthRawText(rawPayload, "restingHeartRateWindowStart");
  const end = readDeviceHealthRawText(rawPayload, "restingHeartRateWindowEnd");

  if (!start || !end) {
    return null;
  }

  return `сон ${formatTime(start)}-${formatTime(end)}`;
}

function formatDeviceHealthWorkoutValue(summary: DeviceHealthDailySummary | null) {
  return summary?.workout ? String(summary.workout.count) : "-";
}

function formatDeviceHealthWorkoutDetail(summary: DeviceHealthDailySummary | null) {
  if (!summary?.workout) {
    return "тренировки не пришли";
  }

  const parts = [
    summary.workout.totalDurationMinutes !== null ? formatDurationHours(summary.workout.totalDurationMinutes) : null,
    summary.workout.totalDistanceMeters !== null ? formatDistanceMeters(summary.workout.totalDistanceMeters) : null,
    summary.workout.averageHeartRateBpm !== null ? `ср. пульс ${formatLoadValue(summary.workout.averageHeartRateBpm)}` : null,
  ].filter((item): item is string => Boolean(item));

  return parts.length ? parts.join(" · ") : "внешних тренировок нет";
}

function formatDeviceWorkoutTypeLabel(workout: DeviceWorkout) {
  const type = workout.workoutType.trim().toLowerCase();
  const labels: Record<string, string> = {
    cycling: "Велотренировка",
    hiking: "Поход",
    running: "Бег",
    walking: "Ходьба",
    workout: "Тренировка с устройства",
  };

  if (!type || /^exercise-\d+$/i.test(type)) {
    return "Тренировка с устройства";
  }

  return labels[type] ?? workout.workoutType;
}

function formatDeviceWorkoutTitle(workout: DeviceWorkout) {
  return `${formatDeviceWorkoutTypeLabel(workout)} · ${formatTimeRange(workout.startTime, workout.endTime)}`;
}

function formatDeviceWorkoutSummary(workout: DeviceWorkout) {
  return [
    workout.durationMinutes !== null ? formatDurationHours(workout.durationMinutes) : null,
    workout.distanceMeters !== null ? formatDistanceMeters(workout.distanceMeters) : null,
    workout.averageHeartRateBpm !== null ? `ср. пульс ${formatLoadValue(workout.averageHeartRateBpm)}` : null,
    workout.maxHeartRateBpm !== null ? `макс ${formatLoadValue(workout.maxHeartRateBpm)}` : null,
    workout.activeCalories !== null ? `${Math.round(workout.activeCalories)} ккал` : null,
  ].filter((item): item is string => Boolean(item)).join(" · ");
}

function formatDeviceWorkoutOptionLabel(workout: DeviceWorkout) {
  return `${formatTimeRange(workout.startTime, workout.endTime)} · ${formatDeviceWorkoutSummary(workout) || formatDeviceWorkoutTypeLabel(workout)}`;
}

function renderDeviceWorkoutMetrics(workout: DeviceWorkout) {
  const metrics = [
    { label: "Длительность", value: workout.durationMinutes !== null ? formatDurationHours(workout.durationMinutes) : "-" },
    { label: "Дистанция", value: workout.distanceMeters !== null ? formatDistanceMeters(workout.distanceMeters) : "-" },
    { label: "Средний пульс", value: workout.averageHeartRateBpm !== null ? formatLoadValue(workout.averageHeartRateBpm) : "-" },
    { label: "Макс. пульс", value: workout.maxHeartRateBpm !== null ? formatLoadValue(workout.maxHeartRateBpm) : "-" },
    { label: "Калории", value: workout.activeCalories !== null ? String(Math.round(workout.activeCalories)) : "-" },
  ];

  return `
    <div class="device-workout-metric-grid">
      ${metrics.map((metric) => `
        <span class="device-workout-metric">
          <small>${escapeHtml(metric.label)}</small>
          <strong>${escapeHtml(metric.value)}</strong>
        </span>
      `).join("")}
    </div>
  `;
}

function limitDeviceWorkoutSamples<T extends { value: number }>(samples: T[], maxCount = 260) {
  if (samples.length <= maxCount) {
    return samples;
  }

  const bucketCount = Math.max(1, Math.floor(maxCount / 2));
  const selected = new Map<number, T>();
  selected.set(0, samples[0]);
  selected.set(samples.length - 1, samples[samples.length - 1]);

  for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex += 1) {
    const start = Math.floor((bucketIndex * samples.length) / bucketCount);
    const end = Math.min(samples.length, Math.floor(((bucketIndex + 1) * samples.length) / bucketCount));
    if (start >= end) {
      continue;
    }

    let minIndex = start;
    let maxIndex = start;
    for (let index = start + 1; index < end; index += 1) {
      if (samples[index].value < samples[minIndex].value) {
        minIndex = index;
      }
      if (samples[index].value > samples[maxIndex].value) {
        maxIndex = index;
      }
    }
    selected.set(minIndex, samples[minIndex]);
    selected.set(maxIndex, samples[maxIndex]);
  }

  return [...selected.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, sample]) => sample);
}

type DeviceWorkoutGraphKind = "heartRate" | "pace" | "speed" | "spo2";

interface DeviceWorkoutGraphSeries {
  key: DeviceWorkoutGraphKind;
  label: string;
  samples: { sampleTime: string; value: number }[];
  valueLabel: (value: number) => string;
}

interface DeviceWorkoutHeartRateZone {
  color: string;
  durationMs: number;
  lower: number;
  percent: number;
  upper: number;
  zone: number;
}

function formatPaceSeconds(value: number) {
  const rounded = Math.max(0, Math.round(value));
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")} /км`;
}

function getDeviceWorkoutPaceSeconds(sample: DeviceWorkout["samples"][number]) {
  if (sample.paceSecondsPerKm !== null) {
    return sample.paceSecondsPerKm;
  }

  if (sample.speedMetersPerSecond !== null && sample.speedMetersPerSecond > 0) {
    return 1000 / sample.speedMetersPerSecond;
  }

  return null;
}

function buildDeviceWorkoutGraphSeries(workout: DeviceWorkout): DeviceWorkoutGraphSeries[] {
  const heartRateSamples = workout.samples
    .filter((sample) => sample.heartRateBpm !== null)
    .map((sample) => ({ sampleTime: sample.sampleTime, value: sample.heartRateBpm ?? 0 }));
  const paceSamples = workout.samples
    .map((sample) => {
      const value = getDeviceWorkoutPaceSeconds(sample);
      return value === null ? null : { sampleTime: sample.sampleTime, value };
    })
    .filter((sample): sample is { sampleTime: string; value: number } => sample !== null);
  const speedSamples = workout.samples
    .filter((sample) => sample.speedMetersPerSecond !== null)
    .map((sample) => ({ sampleTime: sample.sampleTime, value: (sample.speedMetersPerSecond ?? 0) * 3.6 }));
  const spo2Samples = workout.samples
    .filter((sample) => sample.oxygenSaturationPercent !== null)
    .map((sample) => ({ sampleTime: sample.sampleTime, value: sample.oxygenSaturationPercent ?? 0 }));

  const series: DeviceWorkoutGraphSeries[] = [];

  if (heartRateSamples.length > 1) {
    series.push({
      key: "heartRate",
      label: "Пульс",
      samples: heartRateSamples,
      valueLabel: (value) => `${Math.round(value)} уд/мин`,
    });
  }

  if (paceSamples.length > 1) {
    series.push({
      key: "pace",
      label: "Темп",
      samples: paceSamples,
      valueLabel: (value) => formatPaceSeconds(value),
    });
  } else if (speedSamples.length > 1) {
    series.push({
      key: "speed",
      label: "Скорость",
      samples: speedSamples,
      valueLabel: (value) => `${value.toFixed(1)} км/ч`,
    });
  }

  if (spo2Samples.length > 1) {
    series.push({
      key: "spo2",
      label: "SpO2",
      samples: spo2Samples,
      valueLabel: (value) => `${Math.round(value)}%`,
    });
  }

  return series;
}

function hasDeviceWorkoutGraph(workout: DeviceWorkout) {
  return buildDeviceWorkoutGraphSeries(workout).length > 0;
}

function formatDeviceWorkoutGraphTime(value: number) {
  return new Intl.DateTimeFormat("ru", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function getDeviceWorkoutGraphTime(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function clampDeviceWorkoutGraphX(value: number) {
  return Math.max(0, Math.min(100, value));
}

function getEstimatedHeartRateMax(maxWorkoutHeartRate: number) {
  return Math.max(180, Math.round(maxWorkoutHeartRate / 0.9));
}

function getDeviceWorkoutHeartRateZone(value: number, estimatedMax: number) {
  const ratio = value / estimatedMax;
  if (ratio >= 0.9) {
    return 5;
  }
  if (ratio >= 0.8) {
    return 4;
  }
  if (ratio >= 0.7) {
    return 3;
  }
  if (ratio >= 0.6) {
    return 2;
  }
  return 1;
}

function formatDeviceWorkoutDurationMs(value: number) {
  const totalSeconds = Math.max(0, Math.round(value / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((item) => item.toString().padStart(2, "0")).join(":");
}

function buildDeviceWorkoutHeartRateZones(series: DeviceWorkoutGraphSeries, estimatedMax: number): DeviceWorkoutHeartRateZone[] {
  const zoneColors: Record<number, string> = {
    1: "#cbd5e1",
    2: "#38bdf8",
    3: "#84cc16",
    4: "#facc15",
    5: "#e11d48",
  };
  const durations = new Map<number, number>([
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    [5, 0],
  ]);

  for (let index = 0; index < series.samples.length - 1; index += 1) {
    const start = getDeviceWorkoutGraphTime(series.samples[index].sampleTime);
    const end = getDeviceWorkoutGraphTime(series.samples[index + 1].sampleTime);
    if (start === null || end === null || end <= start) {
      continue;
    }
    const zone = getDeviceWorkoutHeartRateZone(series.samples[index].value, estimatedMax);
    durations.set(zone, (durations.get(zone) ?? 0) + end - start);
  }

  const total = [...durations.values()].reduce((sum, value) => sum + value, 0);

  return [5, 4, 3, 2, 1].map((zone) => {
    const lower = zone === 1 ? 0 : Math.round(estimatedMax * (0.5 + (zone - 1) * 0.1));
    const upper = zone === 5 ? estimatedMax : Math.round(estimatedMax * (0.5 + zone * 0.1));
    const durationMs = durations.get(zone) ?? 0;
    return {
      color: zoneColors[zone],
      durationMs,
      lower,
      percent: total > 0 ? (durationMs / total) * 100 : 0,
      upper,
      zone,
    };
  });
}

function renderDeviceWorkoutSeriesGraph(series: DeviceWorkoutGraphSeries, workout: DeviceWorkout) {
  const shownSamples = limitDeviceWorkoutSamples(series.samples);
  const values = series.samples.map((sample) => sample.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const average = values.reduce((total, value) => total + value, 0) / values.length;
  const isHeartRate = series.key === "heartRate";
  const estimatedHeartRateMax = isHeartRate ? getEstimatedHeartRateMax(max) : null;
  const rawRange = Math.max(1, max - min);
  const lower = isHeartRate && estimatedHeartRateMax !== null ? Math.min(min, estimatedHeartRateMax * 0.5) : min - rawRange * 0.08;
  const upper = isHeartRate && estimatedHeartRateMax !== null ? Math.max(max, estimatedHeartRateMax) : max + rawRange * 0.08;
  const range = Math.max(1, upper - lower);
  const sampleStartTime = getDeviceWorkoutGraphTime(series.samples[0]?.sampleTime ?? "");
  const sampleEndTime = getDeviceWorkoutGraphTime(series.samples[series.samples.length - 1]?.sampleTime ?? "");
  const workoutStartTime = getDeviceWorkoutGraphTime(workout.startTime);
  const workoutEndTime = getDeviceWorkoutGraphTime(workout.endTime);
  let axisStartTime = workoutStartTime ?? sampleStartTime;
  let axisEndTime = workoutEndTime ?? sampleEndTime;

  if (
    axisStartTime === null ||
    axisEndTime === null ||
    axisEndTime <= axisStartTime ||
    (sampleStartTime !== null && sampleStartTime < axisStartTime) ||
    (sampleEndTime !== null && sampleEndTime > axisEndTime)
  ) {
    axisStartTime = sampleStartTime;
    axisEndTime = sampleEndTime;
  }

  const axis =
    axisStartTime !== null && axisEndTime !== null && axisEndTime > axisStartTime
      ? {
          duration: axisEndTime - axisStartTime,
          end: axisEndTime,
          middle: axisStartTime + (axisEndTime - axisStartTime) / 2,
          start: axisStartTime,
        }
      : null;
  const axisDuration = axis?.duration ?? 0;
  const valueToY = (value: number) => 92 - ((value - lower) / range) * 84;
  const averageY = valueToY(average);
  const points = shownSamples.map((sample, index) => {
    const sampleTime = getDeviceWorkoutGraphTime(sample.sampleTime);
    const x =
      axis !== null && sampleTime !== null
        ? clampDeviceWorkoutGraphX(((sampleTime - axis.start) / axis.duration) * 100)
        : shownSamples.length === 1
          ? 0
          : (index / (shownSamples.length - 1)) * 100;
    const y = valueToY(sample.value);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  const heartRateZones =
    isHeartRate && estimatedHeartRateMax !== null
      ? buildDeviceWorkoutHeartRateZones(series, estimatedHeartRateMax)
      : [];
  const heartRateGridValues =
    estimatedHeartRateMax !== null
      ? [
          estimatedHeartRateMax,
          estimatedHeartRateMax * 0.9,
          estimatedHeartRateMax * 0.8,
          estimatedHeartRateMax * 0.7,
          estimatedHeartRateMax * 0.6,
          estimatedHeartRateMax * 0.5,
          lower,
        ].filter((value, index, values) => index === 0 || Math.round(value) !== Math.round(values[index - 1]))
      : [];
  const axisLabels = isHeartRate
    ? heartRateGridValues.map((value) => String(Math.round(value)))
    : [max, average, min].map((value) => series.valueLabel(value));
  const gridValues = isHeartRate ? heartRateGridValues : [upper, average, lower];
  const coverageStartX =
    axis !== null && sampleStartTime !== null
      ? clampDeviceWorkoutGraphX(((sampleStartTime - axis.start) / axis.duration) * 100)
      : null;
  const coverageEndX =
    axis !== null && sampleEndTime !== null
      ? clampDeviceWorkoutGraphX(((sampleEndTime - axis.start) / axis.duration) * 100)
      : null;
  const dataCoveragePercent =
    axisDuration > 0 && sampleStartTime !== null && sampleEndTime !== null
      ? clampDeviceWorkoutGraphX(((sampleEndTime - sampleStartTime) / axisDuration) * 100)
      : null;
  const timeLabels =
    axis !== null
      ? [
          formatDeviceWorkoutGraphTime(axis.start),
          formatDeviceWorkoutGraphTime(axis.middle),
          formatDeviceWorkoutGraphTime(axis.end),
        ]
      : [];
  const coverageNote = isHeartRate && dataCoveragePercent !== null ? `Покрытие данных: ${Math.round(dataCoveragePercent)}%` : "";
  const captionDetail = isHeartRate
    ? "ЧСС, уд/мин"
    : `мин ${series.valueLabel(min)} · сред ${series.valueLabel(average)} · макс ${series.valueLabel(max)}`;

  const caption = `
    <div class="device-workout-series-caption">
      <strong>${escapeHtml(series.label)}</strong>
      <span>${escapeHtml(captionDetail)}</span>
    </div>
  `;
  const chart = `
    <div class="device-workout-chart">
      <div class="device-workout-axis-y" aria-hidden="true">
        ${axisLabels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}
      </div>
      <div class="device-workout-chart-plot">
        <svg aria-label="${escapeHtml(series.label)}" role="img" viewBox="0 0 100 100" preserveAspectRatio="none">
          ${isHeartRate ? heartRateZones.map((zone) => {
            const zoneTop = valueToY(zone.upper);
            const zoneBottom = valueToY(zone.zone === 1 ? lower : zone.lower);
            return `<rect class="hr-zone-strip z${zone.zone}" height="${Math.max(0, zoneBottom - zoneTop).toFixed(2)}" width="1.6" x="0" y="${zoneTop.toFixed(2)}"></rect>`;
          }).join("") : ""}
          ${gridValues.map((value) => `<line class="grid" x1="0" x2="100" y1="${valueToY(value).toFixed(2)}" y2="${valueToY(value).toFixed(2)}"></line>`).join("")}
          <line class="average" x1="0" x2="100" y1="${averageY.toFixed(2)}" y2="${averageY.toFixed(2)}"></line>
          ${coverageStartX !== null && coverageEndX !== null ? `<line class="coverage" x1="${coverageStartX.toFixed(2)}" x2="${coverageEndX.toFixed(2)}" y1="97" y2="97"></line>` : ""}
          <polyline fill="none" points="${escapeHtml(points)}"></polyline>
        </svg>
      </div>
      ${timeLabels.length > 0
        ? `<div class="device-workout-axis-x" aria-hidden="true">${timeLabels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}</div>`
        : ""}
    </div>
  `;
  const chartColumn = `
    <div class="device-workout-chart-column">
      ${chart}
      ${coverageNote ? `<small class="device-workout-coverage-note">${escapeHtml(coverageNote)}</small>` : ""}
    </div>
  `;
  const zonePanel = `
    <div class="device-workout-zone-panel">
      <strong>Зоны ЧСС</strong>
      <div class="device-workout-zone-list">
        ${heartRateZones.map((zone) => `
          <div class="device-workout-zone-row z${zone.zone}">
            <span class="zone-number">${zone.zone}</span>
            <span class="zone-bar">
              <i style="width: ${zone.percent > 0 ? `${Math.max(2, zone.percent).toFixed(1)}%` : "0%"}"></i>
              <b>${Math.round(zone.percent)}%</b>
            </span>
            <span class="zone-time">${escapeHtml(formatDeviceWorkoutDurationMs(zone.durationMs))}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  if (!isHeartRate) {
    return `
      <div class="device-workout-series ${escapeHtml(series.key)}">
        ${caption}
        ${chartColumn}
      </div>
    `;
  }

  return `
    <div class="device-workout-series ${escapeHtml(series.key)}">
      ${caption}
      <div class="device-workout-heart-rate-layout">
        ${chartColumn}
        ${zonePanel}
      </div>
    </div>
  `;
}

function renderDeviceWorkoutGraph(workout: DeviceWorkout) {
  const series = buildDeviceWorkoutGraphSeries(workout);

  if (series.length === 0) {
    return `<small>Устройство передало только итоговые данные, график недоступен.</small>`;
  }

  return `
    <div class="device-workout-graph">
      ${series.map((item) => renderDeviceWorkoutSeriesGraph(item, workout)).join("")}
    </div>
  `;
}

function formatDeviceHealthBriefValue(summary: DeviceHealthDailySummary | null) {
  if (!summary) {
    return "-";
  }

  const parts = [
    summary.sleep?.durationMinutes !== null && summary.sleep?.durationMinutes !== undefined
      ? `сон ${formatDurationHours(summary.sleep.durationMinutes)}`
      : null,
    summary.heartRate?.restingBpm !== null && summary.heartRate?.restingBpm !== undefined
      ? `пульс ${formatLoadValue(summary.heartRate.restingBpm)}`
      : null,
  ].filter((item): item is string => Boolean(item));

  return parts.length ? parts.join(" · ") : "частично";
}

function formatDeviceHealthBriefDetail(summary: DeviceHealthDailySummary | null) {
  const status = getDeviceHealthStatus(summary);
  const workoutLabel = summary?.workout ? ` · тренировки ${summary.workout.count}` : "";

  return `${status.statusLabel.toLowerCase()}${workoutLabel}`;
}

function formatDistanceMeters(value: number) {
  return value >= 1000
    ? `${formatLoadValue(Math.round((value / 1000) * 10) / 10)} км`
    : `${Math.round(value)} м`;
}

function renderTodayIndicator(label: string, value: string, detail: string) {
  return `
    <article>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(detail)}</small>
    </article>
  `;
}

function renderPlansScreen(state: MobileAppState, athleteId: string | null) {
  const allPlans = sortPlansForExecution(getPlansForAthlete(state, athleteId));
  const dateOptions = getPlanDateOptions(allPlans);
  const isCoachView = isCoachRole(state.session.user?.role);
  const selectedDate = isCoachView
    ? state.selectedDayDate
    : state.planDateFilter && dateOptions.some((option) => option.date === state.planDateFilter)
      ? state.planDateFilter
      : "";
  const plans = selectedDate
    ? allPlans.filter((plan) => plan.day.dayDate === selectedDate)
    : allPlans;

  if (allPlans.length === 0) {
    return renderEmpty("Планов пока нет", "После обновления здесь появятся назначенные тренировочные дни.");
  }

  return `
    <div class="screen-head">
      <h2>Планы</h2>
      <p>${selectedDate
        ? `${plans.length} ${formatAssignedDayCountLabel(plans.length)} · ${formatDate(selectedDate)}`
        : `${allPlans.length} ${formatAssignedDayCountLabel(allPlans.length)}`}</p>
    </div>
    ${renderPlanDateFilter(dateOptions, selectedDate, isCoachView)}
    <div class="list-stack">
      ${plans.length > 0
        ? plans.map((plan) => renderPlanCard(plan, isCoachView)).join("")
        : renderEmpty("На выбранную дату нет плана", "Выберите другой день из назначенного плана.")}
    </div>
  `;
}

function renderPlanDateFilter(
  options: Array<{ date: string; label: string }>,
  selectedDate: string,
  isCoachView = false,
) {
  if (options.length <= 1 && !isCoachView) {
    return "";
  }

  const selectedOption = options.some((option) => option.date === selectedDate);

  return `
    <label class="plan-date-filter">
      <span>${isCoachView ? "Единый день" : "День плана"}</span>
      <select data-plan-date-filter>
        ${isCoachView
          ? selectedOption ? "" : `<option value="${escapeHtml(selectedDate)}" selected>${formatDate(selectedDate)} · выбранный день</option>`
          : `<option value="" ${selectedDate ? "" : "selected"}>Все дни по плану</option>`}
        ${options.map((option) => `
          <option value="${escapeHtml(option.date)}" ${selectedDate === option.date ? "selected" : ""}>
            ${escapeHtml(formatDate(option.date))} · ${escapeHtml(option.label)}
          </option>
        `).join("")}
      </select>
    </label>
  `;
}

function renderCalendarScreen(state: MobileAppState, athleteId: string | null) {
  const plans = getCompetitionPlansForAthlete(state, athleteId);
  const competitions = state.data.competitions
    .slice()
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const canSubmitCompetitionResult = isCoachRole(state.session.user?.role);

  return `
    <div class="screen-head">
      <h2>Календарь</h2>
      <p>${competitions.length} соревнований · ${plans.length} планов старта</p>
    </div>
    <div class="timeline-list">
      ${competitions.slice(0, 30).map((competition) => {
        const linkedPlan = plans.find((plan) => plan.competitionId === competition.id);
        const content = `
          <time>${formatDate(competition.startDate)}</time>
          <div>
            <strong>${escapeHtml(competition.title)}</strong>
            <span>${escapeHtml([competition.location, competition.ageGroup].filter(Boolean).join(" · "))}</span>
            ${linkedPlan ? `<small>План: ${escapeHtml(linkedPlan.priority)} · ${daysUntil(linkedPlan.competitionStartDate)} дн.</small>` : ""}
          </div>
        `;

        return canSubmitCompetitionResult
          ? `
            <button class="timeline-card ${linkedPlan ? "is-linked" : ""}" data-coach-open-day="${escapeHtml(competition.startDate)}" data-coach-open-screen="dashboard" type="button">
              ${content}
            </button>
          `
          : `<article class="timeline-card ${linkedPlan ? "is-linked" : ""}">${content}</article>`;
      }).join("") || renderEmpty("Календарь пуст", "Обновите данные с сервера.")}
    </div>
    ${canSubmitCompetitionResult ? renderCompetitionResultForm(plans) : ""}
  `;
}

function renderResultsScreen(state: MobileAppState, athleteId: string | null) {
  const plans = getPlansForAthlete(state, athleteId);
  const canSubmitExecution = state.session.user?.role === "athlete";
  const isCoachReview = isCoachRole(state.session.user?.role);
  const selectedDayDate = isCoachReview ? state.selectedDayDate : null;

  return `
    <div class="screen-head">
      <h2>${canSubmitExecution ? "Выполнение тренировки" : "Разбор выполнения"}</h2>
      <p>${canSubmitExecution
        ? "Тренировка сохраняется локально, если нет интернета."
        : isCoachReview
          ? "Назначенные дни, план/факт, отметки спортсмена и дневник тренера."
          : getSyncActionRestrictionMessage(state.session.user?.role ?? null, "execution")}</p>
    </div>
    ${isCoachReview ? renderCoachExecutionReviewSummary(state, athleteId, state.selectedDayDate) : ""}
    ${renderExecutionForm(state, plans)}
    ${renderCoachDiaryHistory(state, athleteId, selectedDayDate)}
    ${renderExecutionHistory(state, athleteId, selectedDayDate)}
  `;
}

function renderCoachExecutionReviewSummary(
  state: MobileAppState,
  athleteId: string | null,
  selectedDayDate: string,
) {
  if (!athleteId) {
    return renderEmpty("Выберите спортсмена", "После выбора спортсмена разбор покажет план, факт, выполнение и комментарий за выбранный день.");
  }

  const dayData = getCoachDayCleanSummary(state, athleteId, selectedDayDate);
  const summary = dayData.summary;
  const readinessEntry = dayData.readinessEntry;
  const deviceHealth = dayData.deviceHealthSummary;
  const aiReviewHistory = getCoachAiReviewsForDay(state.data.coachAiReviews, athleteId, selectedDayDate);
  const aiReview = state.aiReviewByDay[getCoachDayAiReviewKey(athleteId, selectedDayDate)] ??
    aiReviewHistory[0] ??
    null;

  return `
    <section class="coach-execution-review-card ${summary.status === "no-plan" ? "is-empty" : ""}">
      <div class="coach-execution-review-head">
        <div>
          <span>Выбранный день</span>
          <h3>${escapeHtml(dayData.athleteName)}</h3>
          <p>${formatDate(selectedDayDate)} · ${escapeHtml(summary.statusLabel.toLowerCase())}</p>
        </div>
        <span class="execution-day-status is-${summary.status}">${escapeHtml(summary.statusLabel)}</span>
      </div>
      <div class="coach-execution-review-grid">
        ${renderCoachExecutionReviewMetric("План", formatCoachTodayPlanCount(summary), formatCoachTodayPlanNames(summary))}
        ${renderCoachExecutionReviewMetric("Упражнения", `${summary.completedExerciseCount}/${summary.exerciseCount || 0}`, formatCoachTodayExerciseBreakdown(summary))}
        ${renderCoachExecutionReviewMetric("Нагрузка", `${formatLoadValue(summary.actualLoad)} / ${formatLoadValue(summary.plannedLoad)}`, formatCoachTodayLoadDelta(summary))}
        ${renderCoachExecutionReviewMetric("Готовность", readinessEntry ? String(readinessEntry.score) : "-", readinessEntry ? formatReadinessStatus(readinessEntry.status) : "нет записи")}
        ${renderCoachExecutionReviewMetric("Сон устройства", formatDeviceHealthSleepValue(deviceHealth), formatDeviceHealthSleepDetail(deviceHealth))}
        ${renderCoachExecutionReviewMetric("Пульс покоя", formatDeviceHealthRestingHrValue(deviceHealth), formatDeviceHealthHeartRateDetail(deviceHealth))}
        ${renderCoachExecutionReviewMetric("Тренировки устройства", formatDeviceHealthWorkoutValue(deviceHealth), formatDeviceHealthWorkoutDetail(deviceHealth))}
      </div>
      <div class="coach-execution-review-note">
        <strong>Комментарий тренера</strong>
        <p>${escapeHtml(dayData.coachNote)}</p>
      </div>
    </section>
    ${renderCoachDayDataQualityCard(dayData)}
    ${renderCoachDeviceWorkoutPanel(dayData, state.isBusy)}
    ${renderCoachAiReviewCard(
      dayData,
      aiReview,
      aiReviewHistory,
      state.coachAiStatus,
      state.coachAiDiagnostic,
      state.isBusy,
    )}
  `;
}

function renderCoachExecutionReviewMetric(label: string, value: string, detail: string) {
  return `
    <article>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(detail)}</small>
    </article>
  `;
}

function renderCoachAiReviewCard(
  dayData: CoachDayCleanSummary,
  review: CoachDayAiReview | null,
  reviewHistory: CoachDayAiReview[],
  status: CoachAiReviewStatus | null,
  diagnostic: CoachAiReviewDiagnosticResponse | null,
  isBusy: boolean,
) {
  const currentPayloadFingerprint = getCoachDayAiPayloadFingerprint(buildCoachDayAiPayload(dayData));
  const isReviewStale = Boolean(
    review && getCoachDayAiPayloadFingerprint(review.dayPayload) !== currentPayloadFingerprint,
  );
  const actionLabel = review ? "Обновить ИИ-разбор" : "Сформировать ИИ-разбор";

  return `
    <section class="coach-ai-review-card">
      <div class="coach-ai-review-head">
        <div>
          <span>Разбор ИИ</span>
          <h3>Черновая рекомендация</h3>
          <p>Онлайн отправляется только карточка дня без email/userId. План и дневник не меняются.</p>
        </div>
        <button class="secondary-action" data-ai-athlete-id="${escapeHtml(dayData.athleteId)}" data-ai-date="${escapeHtml(dayData.date)}" data-generate-coach-ai-review type="button" ${isBusy ? "disabled" : ""}>
          ${isBusy ? "Формируется..." : actionLabel}
        </button>
      </div>
      ${renderCoachAiReviewStatus(status, diagnostic, isBusy)}
      ${isReviewStale
        ? `<p class="coach-ai-stale-warning">Данные дня изменились после последнего разбора. Обновите ИИ-разбор перед решением.</p>`
        : ""}
      ${review
        ? `
          <div class="coach-ai-review-result">
            <article>
              <span>Что видно</span>
              <p>${escapeHtml(review.observation)}</p>
            </article>
            <article>
              <span>Риски</span>
              <ul>
                ${review.riskNotes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
              </ul>
            </article>
            <article>
              <span>Что сделать завтра</span>
              <ul>
                ${review.tomorrowActions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
              </ul>
            </article>
          </div>
          <details class="coach-ai-review-payload">
            <summary>Данные дня для ИИ</summary>
            <pre>${escapeHtml(review.dayPayloadJson)}</pre>
          </details>
          ${renderCoachAiReviewHistory(reviewHistory)}
          <small>Сформировано: ${formatDateTime(review.generatedAt)} · Источник: ${escapeHtml(formatCoachDayAiReviewSource(review.source))}</small>
        `
        : `
          <p class="coach-ai-review-empty">
            Нажмите кнопку, чтобы отправить качество данных, готовность, план/факт, выполнение упражнений, устройство и комментарий тренера в серверный разбор.
          </p>
          ${renderCoachAiReviewHistory(reviewHistory)}
        `}
    </section>
  `;
}

function renderCoachAiReviewStatus(
  status: CoachAiReviewStatus | null,
  diagnostic: CoachAiReviewDiagnosticResponse | null,
  isBusy: boolean,
) {
  const source = diagnostic?.review.source === "model"
    ? "model"
    : status?.source ?? "server-rules";
  const statusTitle = source === "model"
    ? "Модель подключена"
    : "Серверный разбор по правилам";
  const statusMessage = diagnostic?.message ??
    status?.message ??
    "Статус ИИ появится после обновления данных.";

  return `
    <div class="coach-ai-review-status is-${source}">
      <div>
        <span>Статус ИИ</span>
        <strong>${escapeHtml(statusTitle)}</strong>
        <small>${escapeHtml(statusMessage)}</small>
      </div>
      <button data-test-coach-ai-review type="button" ${isBusy ? "disabled" : ""}>
        ${isBusy ? "Проверка..." : "Проверить ИИ"}
      </button>
      ${status
        ? `
          <ul>
            <li>Режим: ${escapeHtml(status.mode)}</li>
            <li>Модель: ${status.modelConfigured ? "настроена" : "не настроена"}</li>
            <li>Ключ: ${status.apiKeyConfigured ? "есть" : "нет"}</li>
            <li>Fallback: ${status.fallbackEnabled ? "включён" : "выключен"}</li>
          </ul>
        `
        : ""}
    </div>
  `;
}

function renderCoachAiReviewHistory(reviews: CoachDayAiReview[]) {
  const serverReviews = reviews.filter((review) => review.source !== "local-rules");

  if (serverReviews.length === 0) {
    return "";
  }

  return `
    <details class="coach-ai-review-history">
      <summary>История серверных разборов (${serverReviews.length})</summary>
      <div>
        ${serverReviews.slice(0, 5).map((review) => `
          <article>
            <strong>${formatDateTime(review.generatedAt)}</strong>
            <span>${escapeHtml(formatCoachDayAiReviewSource(review.source))}</span>
            <p>${escapeHtml(review.observation)}</p>
          </article>
        `).join("")}
      </div>
    </details>
  `;
}

function renderReadinessScreen(state: MobileAppState) {
  if (state.session.user?.role !== "athlete") {
    return renderEmpty("Готовность заполняет спортсмен", "Тренер видит готовность в карточке спортсмена и после обновления данных.");
  }

  const readiness = state.data.readinessEntry;
  const readinessHistory = getReadinessHistory(state);

  return `
    <div class="screen-head readiness-head">
      <h2>Готовность</h2>
      <p>${readiness ? `Сегодня: ${readiness.score} · ${formatReadinessStatus(readiness.status)}` : "Перед тренировкой"}</p>
    </div>
    ${readiness ? `
      <section class="readiness-summary-card">
        <strong>${readiness.score}</strong>
        <span>${formatReadinessStatus(readiness.status)}</span>
        <small>${formatDate(readiness.entryDate)}</small>
      </section>
    ` : ""}
    ${state.session.user.athleteId ? renderDeviceHealthCard(state, state.session.user.athleteId, todayValue()) : ""}
    <form class="mobile-form compact-form readiness-form" data-readiness-form>
      <section class="readiness-section wide-field">
        <div class="section-title">
          <h3>Быстрый выбор</h3>
        </div>
        <div class="readiness-preset-grid">
          <button data-readiness-preset="good" type="button">
            <strong>Хорошо</strong>
            <span>готов к нагрузке</span>
          </button>
          <button data-readiness-preset="normal" type="button">
            <strong>Норма</strong>
            <span>обычный день</span>
          </button>
          <button data-readiness-preset="tired" type="button">
            <strong>Усталость</strong>
            <span>снизить объём</span>
          </button>
          <button data-readiness-preset="risk" type="button">
            <strong>Риск</strong>
            <span>нужна осторожность</span>
          </button>
        </div>
      </section>

      <section class="readiness-section readiness-metrics wide-field">
        <label><span>Дата</span><input name="entryDate" type="date" value="${todayValue()}" /></label>
        <label><span>Пульс покоя</span><input name="restingHr" type="number" min="30" max="140" value="${state.session.user.baselineRestingHr ?? 60}" /></label>
        <label><span>Вес</span><input name="bodyWeight" type="number" min="20" max="200" step="0.1" value="${state.session.user.baselineWeightKg ?? 70}" /></label>
      </section>

      <section class="readiness-section wide-field">
        ${renderChoiceGroup("sleepHours", "Сон", [
          { label: "< 6 ч", value: "5.5" },
          { label: "6-7 ч", value: "6.5" },
          { label: "7-8 ч", value: "7.5" },
          { label: "8+ ч", value: "8.5" },
        ], "8.5")}
        ${renderChoiceGroup("sleepQuality", "Качество сна", readinessBetterOptions, "4")}
      </section>

      <section class="readiness-section wide-field">
        ${renderChoiceGroup("generalFeeling", "Самочувствие", readinessFeelingOptions, "4")}
        ${renderChoiceGroup("fatigueLevel", "Усталость", readinessLoadOptions, "2")}
        ${renderChoiceGroup("muscleSoreness", "Мышцы", readinessLoadOptions, "2")}
        ${renderChoiceGroup("motivationLevel", "Мотивация", readinessMotivationOptions, "4")}
        ${renderChoiceGroup("painLevel", "Боль", readinessPainOptions, "0")}
      </section>

      <section class="readiness-section readiness-flags wide-field">
        <label class="check-row"><input name="illnessFlag" type="checkbox" /> Есть болезнь</label>
        <label class="check-row"><input name="feverFlag" type="checkbox" /> Температура</label>
      </section>
      <button class="primary-action" type="submit">Сохранить готовность</button>
    </form>
    ${renderReadinessHistory(readinessHistory)}
  `;
}

interface ChoiceOption {
  label: string;
  value: string;
}

const readinessBetterOptions: ChoiceOption[] = [
  { label: "плохо", value: "1" },
  { label: "слабо", value: "2" },
  { label: "нормально", value: "3" },
  { label: "хорошо", value: "4" },
  { label: "отлично", value: "5" },
];

const readinessFeelingOptions: ChoiceOption[] = [
  { label: "плохо", value: "1" },
  { label: "тяжело", value: "2" },
  { label: "нормально", value: "3" },
  { label: "хорошо", value: "4" },
  { label: "отлично", value: "5" },
];

const readinessLoadOptions: ChoiceOption[] = [
  { label: "нет", value: "1" },
  { label: "лёгкая", value: "2" },
  { label: "средняя", value: "3" },
  { label: "сильная", value: "4" },
  { label: "очень сильная", value: "5" },
];

const readinessMotivationOptions: ChoiceOption[] = [
  { label: "нет", value: "1" },
  { label: "низкая", value: "2" },
  { label: "нормальная", value: "3" },
  { label: "высокая", value: "4" },
  { label: "максимум", value: "5" },
];

const readinessPainOptions: ChoiceOption[] = [
  { label: "нет", value: "0" },
  { label: "лёгкая", value: "2" },
  { label: "средняя", value: "5" },
  { label: "сильная", value: "8" },
  { label: "очень сильная", value: "10" },
];

function renderChoiceGroup(
  name: string,
  label: string,
  options: ChoiceOption[],
  defaultValue: string,
) {
  return `
    <fieldset class="choice-field">
      <legend>${escapeHtml(label)}</legend>
      <div class="choice-group">
        ${options.map((option) => `
          <label class="choice-option">
            <input name="${escapeHtml(name)}" type="radio" value="${escapeHtml(option.value)}" ${option.value === defaultValue ? "checked" : ""} />
            <span>${escapeHtml(option.label)}</span>
          </label>
        `).join("")}
      </div>
    </fieldset>
  `;
}

function applyReadinessPreset(form: HTMLFormElement, preset: string) {
  const presets: Record<string, Record<string, string | boolean>> = {
    good: {
      fatigueLevel: "1",
      feverFlag: false,
      generalFeeling: "5",
      illnessFlag: false,
      motivationLevel: "5",
      muscleSoreness: "1",
      painLevel: "0",
      sleepHours: "8.5",
      sleepQuality: "5",
    },
    normal: {
      fatigueLevel: "2",
      feverFlag: false,
      generalFeeling: "4",
      illnessFlag: false,
      motivationLevel: "4",
      muscleSoreness: "2",
      painLevel: "0",
      sleepHours: "7.5",
      sleepQuality: "4",
    },
    risk: {
      fatigueLevel: "5",
      feverFlag: false,
      generalFeeling: "2",
      illnessFlag: false,
      motivationLevel: "2",
      muscleSoreness: "5",
      painLevel: "5",
      sleepHours: "5.5",
      sleepQuality: "2",
    },
    tired: {
      fatigueLevel: "4",
      feverFlag: false,
      generalFeeling: "3",
      illnessFlag: false,
      motivationLevel: "3",
      muscleSoreness: "4",
      painLevel: "2",
      sleepHours: "6.5",
      sleepQuality: "3",
    },
  };
  const values = presets[preset] ?? presets.normal;

  for (const [name, value] of Object.entries(values)) {
    if (typeof value === "boolean") {
      const checkbox = form.elements.namedItem(name);

      if (checkbox instanceof HTMLInputElement) {
        checkbox.checked = value;
      }
      continue;
    }

    const radio = form.querySelector<HTMLInputElement>(
      `input[name="${cssEscape(name)}"][value="${cssEscape(value)}"]`,
    );

    if (radio) {
      radio.checked = true;
    }
  }
}

function cssEscape(value: string) {
  return value.replace(/["\\]/g, "\\$&");
}

function renderReadinessHistory(entries: ReadinessEntry[]) {
  if (entries.length === 0) {
    return "";
  }

  return `
    <section class="readiness-history">
      <div class="section-title">
        <h3>Предыдущие дни</h3>
      </div>
      <div class="readiness-history-list">
        ${entries.map((entry) => `
          <article class="readiness-history-card readiness-${escapeHtml(entry.status)}">
            <time>${formatDate(entry.entryDate)}</time>
            <strong>${entry.score}</strong>
            <span>${formatReadinessStatus(entry.status)}</span>
            <small>${formatReadinessHistoryDetails(entry)}</small>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

interface ExecutionBlockItem {
  plan: AssignedPlanSummary;
  sessionName: string;
  sessionDeviceLinkMode?: MobileAssignedPlanSession["deviceLinkMode"];
  block: AssignedPlanBlock;
}

interface ExecutionPlanGroup {
  plan: AssignedPlanSummary;
  blockItems: ExecutionBlockItem[];
}

type ExecutionDayStatus = "completed" | "partial" | "missed";
type CoachTodayDayStatus = ExecutionDayStatus | "no-plan";

interface ExecutionDaySummary {
  status: ExecutionDayStatus;
  statusLabel: string;
  completedBlockCount: number;
  partialBlockCount: number;
  missedBlockCount: number;
  plannedLoad: number;
  actualLoad: number;
  latestDiaryEntry: CoachDiaryEntry | null;
  readinessEntry: ReadinessEntry | null;
}

interface ExecutionDisplayCompletion {
  completedCount: number;
  partialCount: number;
  missedCount: number;
  totalCount: number;
}

interface CoachTodayDaySummary {
  date: string;
  status: CoachTodayDayStatus;
  statusLabel: string;
  planCount: number;
  sessionCount: number;
  blockCount: number;
  completedBlockCount: number;
  partialBlockCount: number;
  missedBlockCount: number;
  exerciseCount: number;
  completedExerciseCount: number;
  partialExerciseCount: number;
  missedExerciseCount: number;
  plannedLoad: number;
  actualLoad: number;
  deviceConfirmedLoad: number;
  manualActualLoad: number;
  templateNames: string[];
  latestDiaryEntry: CoachDiaryEntry | null;
}

interface CoachDayExerciseCleanSummary {
  assignedExerciseId: string;
  assignedPlanId: string;
  assignedBlockId: string;
  blockName: string;
  sessionName: string;
  name: string;
  plannedWork: string;
  plannedControl: string;
  actualDetails: string;
  status: ExecutionDayStatus;
  statusLabel: string;
  sourceLabel: string;
}

interface CoachDayBlockCleanSummary {
  assignedPlanId: string;
  assignedBlockId: string;
  planName: string;
  sessionName: string;
  sessionDeviceLinkMode?: MobileAssignedPlanSession["deviceLinkMode"];
  name: string;
  rowKind?: AssignedPlanBlock["rowKind"];
  target: string;
  notes: string;
  status: ExecutionDayStatus;
  statusLabel: string;
  sourceLabel: string;
  plannedLoad: number;
  actualLoad: number;
  deviceConfirmedLoad: number;
  manualActualLoad: number;
  loadDeltaLabel: string;
  exercises: CoachDayExerciseCleanSummary[];
}

interface CoachDayCleanSummary {
  athlete: CoachAthleteSummary | null;
  athleteId: string;
  athleteName: string;
  date: string;
  deviceHealthSummary: DeviceHealthDailySummary | null;
  deviceWorkoutLinks: DeviceWorkoutLink[];
  deviceWorkouts: DeviceWorkout[];
  hasExecutionMarks: boolean;
  summary: CoachTodayDaySummary;
  readinessEntry: ReadinessEntry | null;
  latestDiaryEntry: CoachDiaryEntry | null;
  coachNote: string;
  plans: AssignedPlanSummary[];
  blocks: CoachDayBlockCleanSummary[];
}

function renderExecutionForm(state: MobileAppState, plans: AssignedPlanSummary[]) {
  const allPlanGroups = getExecutionPlanGroups(plans);
  const canSubmitExecution = state.session.user?.role === "athlete";
  const isCoachView = isCoachRole(state.session.user?.role);
  const dateOptions = getExecutionDateOptions(allPlanGroups);
  const selectedDate = isCoachView
    ? state.selectedDayDate
    : state.executionDateFilter && dateOptions.some((option) => option.date === state.executionDateFilter)
      ? state.executionDateFilter
      : "";
  const planGroups = selectedDate
    ? allPlanGroups.filter((group) => group.plan.day.dayDate === selectedDate)
    : allPlanGroups;
  const totalDisplayUnitCount = allPlanGroups.reduce(
    (total, group) => total + countPlanDisplayUnits(group.plan),
    0,
  );
  const displayUnitCount = planGroups.reduce(
    (total, group) => total + countPlanDisplayUnits(group.plan),
    0,
  );
  const exerciseCount = planGroups.reduce(
    (total, group) =>
      total + group.blockItems.reduce(
        (blockTotal, item) => blockTotal + (item.block.exercises?.length ?? 0),
        0,
      ),
    0,
  );

  if (totalDisplayUnitCount === 0) {
    return renderEmpty("Нет блоков для результата", "Назначенный план появится после обновления данных.");
  }

  return `
    <section class="execution-panel">
      <div class="section-title">
        <h3>${canSubmitExecution ? "Выполнение тренировки" : "Дни по плану"}</h3>
        <p>${canSubmitExecution
          ? `${plans.length} назначенных дней · ${formatPlanUnitCount(displayUnitCount)} · ${exerciseCount} упражнений. Ближайший день открыт сверху.`
          : `Режим просмотра · ${formatDate(selectedDate)} · ${formatPlanUnitCount(displayUnitCount)} · ${exerciseCount} упражнений.`}</p>
      </div>
      ${renderExecutionDateFilter(dateOptions, selectedDate, isCoachView)}
      <div class="execution-plan-stack">
        ${planGroups.length > 0
          ? planGroups
              .map((group, index) => renderExecutionPlanGroup(state, group, index === 0, canSubmitExecution))
              .join("")
          : renderEmpty("На выбранную дату нет плана", "Выберите другой день из назначенного плана.")}
      </div>
    </section>
  `;
}

function renderExecutionDateFilter(
  options: Array<{ date: string; label: string }>,
  selectedDate: string,
  isCoachView = false,
) {
  if (options.length <= 1 && !isCoachView) {
    return "";
  }

  const selectedOption = options.some((option) => option.date === selectedDate);

  return `
    <label class="execution-date-filter">
      <span>${isCoachView ? "Единый день" : "Дата разбора"}</span>
      <select data-execution-date-filter>
        ${isCoachView
          ? selectedOption ? "" : `<option value="${escapeHtml(selectedDate)}" selected>${formatDate(selectedDate)} · выбранный день</option>`
          : `<option value="" ${selectedDate ? "" : "selected"}>Все дни по плану</option>`}
        ${options.map((option) => `
          <option value="${escapeHtml(option.date)}" ${selectedDate === option.date ? "selected" : ""}>
            ${escapeHtml(formatDate(option.date))} · ${escapeHtml(option.label)}
          </option>
        `).join("")}
      </select>
    </label>
  `;
}

function isSessionLevelPlanUnit(session: MobileAssignedPlanSession) {
  if (session.executionMode) {
    return session.executionMode === "whole_session";
  }

  return session.blocks.length > 1;
}

function countPlanDisplayUnits(plan: AssignedPlanSummary) {
  return plan.day.sessions.reduce(
    (total, session) =>
      total + (isSessionLevelPlanUnit(session) ? 1 : session.blocks.length),
    0,
  );
}

function formatPlanUnitCount(count: number) {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  const label = lastDigit === 1 && lastTwoDigits !== 11
    ? "сессия"
    : lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)
      ? "сессии"
      : "сессий";

  return `${count} ${label}`;
}

function getExecutionDisplayCompletion(
  state: MobileAppState,
  plan: AssignedPlanSummary,
): ExecutionDisplayCompletion {
  const completion: ExecutionDisplayCompletion = {
    completedCount: 0,
    missedCount: 0,
    partialCount: 0,
    totalCount: 0,
  };

  for (const session of plan.day.sessions) {
    if (isSessionLevelPlanUnit(session)) {
      const status = getUnifiedSessionExecutionStatus(state, plan.id, session);
      completion.totalCount += 1;
      if (status === "completed") {
        completion.completedCount += 1;
      } else if (status === "partial") {
        completion.partialCount += 1;
      } else {
        completion.missedCount += 1;
      }
      continue;
    }

    for (const block of session.blocks) {
      const status = getExecutionBlockStatus(
        block,
        getExecutionResultForBlock(state, plan.id, block.id),
      );
      completion.totalCount += 1;
      if (status === "completed") {
        completion.completedCount += 1;
      } else if (status === "partial") {
        completion.partialCount += 1;
      } else {
        completion.missedCount += 1;
      }
    }
  }

  return completion;
}

function getUnifiedSessionExecutionStatus(
  state: MobileAppState,
  assignedPlanId: string,
  session: MobileAssignedPlanSession,
): ExecutionDayStatus {
  const statuses = session.blocks.map((block) =>
    getExecutionBlockStatus(block, getExecutionResultForBlock(state, assignedPlanId, block.id))
  );

  if (statuses.length > 0 && statuses.every((status) => status === "completed")) {
    return "completed";
  }

  if (statuses.some((status) => status === "completed" || status === "partial")) {
    return "partial";
  }

  return "missed";
}

function renderExecutionPlanGroup(
  state: MobileAppState,
  group: ExecutionPlanGroup,
  isOpen: boolean,
  canSubmitExecution: boolean,
) {
  const displayUnitCount = countPlanDisplayUnits(group.plan);
  const canSubmitCoachDiary = state.session.user?.role === "coach" || state.session.user?.role === "admin";
  const diaryEntries = getCoachDiaryEntriesForPlan(state, group.plan.id);
  const daySummary = getExecutionDaySummary(state, group, diaryEntries);
  const displayCompletion = getExecutionDisplayCompletion(state, group.plan);
  const exerciseCount = group.blockItems.reduce(
    (total, item) => total + (item.block.exercises?.length ?? 0),
    0,
  );

  return `
    <details class="execution-plan-group mobile-plan-day-card mobile-execution-day-card" data-execution-plan-group ${isOpen ? "open" : ""}>
      <summary class="mobile-plan-day-card-head">
        <div>
          <strong>${formatDate(group.plan.day.dayDate)} · ${escapeHtml(group.plan.day.label)}</strong>
          <span>${escapeHtml(group.plan.templateName)} · ${formatPlanUnitCount(displayUnitCount)} · ${exerciseCount} упр.</span>
          <div class="execution-day-meta">
            <span class="execution-day-status is-${daySummary.status}">${escapeHtml(daySummary.statusLabel)}</span>
            <span>Факт нагрузки: ${formatLoadValue(daySummary.actualLoad)}</span>
            <span>План: ${formatLoadValue(daySummary.plannedLoad)}</span>
          </div>
        </div>
        <em>${displayCompletion.completedCount}/${displayCompletion.totalCount}</em>
      </summary>
      <div class="mobile-plan-day-card-body">
        ${renderExecutionDayAnalyticsCard(daySummary, displayCompletion)}
        ${group.plan.day.sessions.map((session) => `
          <section class="mobile-plan-session">
            <h4>${escapeHtml(session.name)}</h4>
            ${isSessionLevelPlanUnit(session)
              ? renderExecutionUnifiedSession(state, group.plan, session, canSubmitExecution)
              : `
                <div class="mobile-plan-table">
                  <div class="mobile-plan-table-head">
                    <span>Упр.</span>
                    <span>Подходы</span>
                    <span>Контр.</span>
                  </div>
                  ${session.blocks
                    .map((block) =>
                      canSubmitExecution
                        ? renderExecutionBlockForm(
                            {
                              block,
                              plan: group.plan,
                              sessionName: session.name,
                            },
                            getExecutionResultForBlock(state, group.plan.id, block.id),
                          )
                        : renderExecutionBlockReadonly(
                            {
                              block,
                              plan: group.plan,
                              sessionName: session.name,
                            },
                            getExecutionResultForBlock(state, group.plan.id, block.id),
                          ),
                    )
                    .join("")}
                </div>
              `}
          </section>
        `).join("")}
        ${canSubmitExecution ? `
          <div class="mobile-execution-day-actions">
            <button class="primary-action" type="button" data-execution-save-day ${state.isBusy ? "disabled" : ""}>
              ${state.isBusy ? "Сохранение..." : "Сохранить выполнение"}
            </button>
          </div>
        ` : ""}
        ${canSubmitCoachDiary ? renderCoachDiaryForm(group, diaryEntries) : ""}
      </div>
    </details>
  `;
}

function renderExecutionUnifiedSession(
  state: MobileAppState,
  plan: AssignedPlanSummary,
  session: MobileAssignedPlanSession,
  canSubmitExecution: boolean,
) {
  const status = getUnifiedSessionExecutionStatus(state, plan.id, session);
  const results = session.blocks.map((block) => getExecutionResultForBlock(state, plan.id, block.id));
  const latestNote = results.find((result) => result?.notes)?.notes ?? "";
  const blockIds = session.blocks.map((block) => block.id);

  if (!canSubmitExecution) {
    return `
      <div class="mobile-unified-session-card is-${status}">
        <div class="mobile-unified-session-head">
          <strong>${escapeHtml(getExecutionDayStatusLabel(status))}</strong>
          <span>${session.blocks.length} строк плана сохраняются как одна сессия</span>
        </div>
        ${renderUnifiedSessionPlanTable(session)}
        ${latestNote ? `<p class="mobile-unified-session-note">${escapeHtml(latestNote)}</p>` : ""}
      </div>
    `;
  }

  return `
    <form class="mobile-execution-session-form mobile-unified-session-card is-${status}" data-execution-session-form>
      <input name="assignedPlanId" type="hidden" value="${escapeHtml(plan.id)}" />
      <input name="assignedBlockIds" type="hidden" value="${escapeHtml(blockIds.join(","))}" />
      <label class="execution-session-check">
        <input name="completed" type="checkbox" ${status === "completed" ? "checked" : ""} />
        <span>
          <strong>Отметить всю сессию</strong>
          <small>Все строки этой сессии сохраняются вместе.</small>
        </span>
      </label>
      ${renderUnifiedSessionPlanTable(session)}
      <label class="exercise-note">
        <span>Комментарий</span>
        <input name="notes" value="${escapeHtml(latestNote)}" />
      </label>
    </form>
  `;
}

function renderUnifiedSessionPlanTable(session: MobileAssignedPlanSession) {
  return `
    <div class="mobile-plan-table mobile-unified-plan-table">
      <div class="mobile-plan-table-head">
        <span>Блок</span>
        <span>Объём</span>
        <span>Контроль</span>
      </div>
      ${session.blocks.map((block) => `
        <div class="mobile-plan-row mobile-unified-plan-row">
          <span class="mobile-plan-exercise-name-static">${escapeHtml(block.name)}</span>
          <span class="mobile-plan-cell mobile-plan-volume">${escapeHtml(formatUnifiedSessionBlockTarget(block))}</span>
          <span class="mobile-plan-cell mobile-plan-control">${escapeHtml(formatUnifiedSessionBlockControl(block))}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function getSortedBlockExercises(block: AssignedPlanBlock) {
  return (block.exercises ?? []).slice().sort((a, b) => a.orderIndex - b.orderIndex);
}

function formatUnifiedSessionBlockTarget(block: AssignedPlanBlock) {
  const exercises = getSortedBlockExercises(block);

  if (exercises.length === 0) {
    return formatBlockTarget(block);
  }

  if (exercises.length === 1) {
    return formatExerciseWorkCell(exercises[0]);
  }

  return exercises
    .map((exercise) => `${exercise.name}: ${formatExerciseWorkCell(exercise)}`)
    .join("; ");
}

function formatUnifiedSessionBlockControl(block: AssignedPlanBlock) {
  const exercises = getSortedBlockExercises(block);

  if (block.notes) {
    return block.notes;
  }

  if (exercises.length === 0) {
    return "-";
  }

  if (exercises.length === 1) {
    return formatExerciseControlCell(exercises[0]);
  }

  return exercises
    .map((exercise) => `${exercise.name}: ${formatExerciseControlCell(exercise)}`)
    .join("; ");
}

function renderExecutionDayAnalyticsCard(
  summary: ExecutionDaySummary,
  displayCompletion: ExecutionDisplayCompletion,
) {
  return `
    <aside class="execution-day-analytics-card">
      <div class="execution-day-analytics-head">
        <strong>Аналитика дня</strong>
        <span>${escapeHtml(summary.statusLabel)}</span>
      </div>
      <div class="execution-day-analytics-grid">
        <div class="execution-day-analytics-metric">
          <span>Выполнение</span>
          <strong>${displayCompletion.completedCount}/${displayCompletion.totalCount}</strong>
          <small>${escapeHtml(formatExecutionDisplayBreakdown(displayCompletion))}</small>
        </div>
        <div class="execution-day-analytics-metric">
          <span>Плановая нагрузка</span>
          <strong>${formatLoadValue(summary.plannedLoad)}</strong>
          <small>по назначенному дню</small>
        </div>
        <div class="execution-day-analytics-metric">
          <span>Фактическая нагрузка</span>
          <strong>${formatLoadValue(summary.actualLoad)}</strong>
          <small>${escapeHtml(formatExecutionLoadDelta(summary))}</small>
        </div>
        <div class="execution-day-analytics-metric readiness-${escapeHtml(summary.readinessEntry?.status ?? "none")}">
          <span>Готовность</span>
          <strong>${summary.readinessEntry ? summary.readinessEntry.score : "-"}</strong>
          <small>${escapeHtml(summary.readinessEntry ? formatReadinessStatus(summary.readinessEntry.status) : "нет записи")}</small>
        </div>
      </div>
      <div class="execution-day-analytics-comment">
        <strong>Комментарий тренера</strong>
        ${summary.latestDiaryEntry
          ? `
            <p>${escapeHtml(summary.latestDiaryEntry.notes)}</p>
            <small>${escapeHtml(summary.latestDiaryEntry.coachName)} · ${formatDateTime(summary.latestDiaryEntry.updatedAt)}</small>
          `
          : "<p>Комментария за этот день пока нет.</p>"}
      </div>
    </aside>
  `;
}

function renderCoachDiaryForm(group: ExecutionPlanGroup, entries: CoachDiaryEntry[]) {
  const taskChoices = getCoachDiaryTaskChoices(group);
  const latestEntry = entries[0] ?? null;

  return `
    <form class="coach-diary-form" data-coach-diary-form>
      <input name="athleteId" type="hidden" value="${escapeHtml(group.plan.athleteId)}" />
      <input name="assignedPlanId" type="hidden" value="${escapeHtml(group.plan.id)}" />
      <div class="coach-diary-head">
        <div>
          <strong>Запись тренера за день</strong>
          <span>${latestEntry ? `Последняя: ${formatDateTime(latestEntry.updatedAt)}` : "Комментарий к дню или заданиям"}</span>
        </div>
      </div>
      <label class="coach-diary-date">
        <span>Дата записи</span>
        <input name="entryDate" type="date" value="${escapeHtml(group.plan.day.dayDate)}" readonly />
      </label>
      <fieldset class="coach-diary-scope">
        <label>
          <input name="scope" type="radio" value="day" checked />
          <span>Весь день</span>
        </label>
        <label>
          <input name="scope" type="radio" value="tasks" />
          <span>По заданиям</span>
        </label>
      </fieldset>
      ${taskChoices.length ? `
        <div class="coach-diary-tasks" aria-label="Задания для записи">
          ${taskChoices.map((choice) => `
            <label class="coach-diary-task">
              <input name="${choice.kind === "exercise" ? "assignedExerciseIds" : "assignedBlockIds"}" type="checkbox" value="${escapeHtml(choice.id)}" />
              <span>
                <strong>${escapeHtml(choice.label)}</strong>
                <small>${escapeHtml(choice.meta)}</small>
              </span>
            </label>
          `).join("")}
        </div>
      ` : ""}
      <label class="coach-diary-note">
        <span>Комментарий</span>
        <textarea name="notes" rows="3" placeholder="Наблюдение, решение или рекомендация на этот день"></textarea>
      </label>
      <button class="primary-action" type="submit">Сохранить запись</button>
    </form>
  `;
}

interface CoachDiaryTaskChoice {
  id: string;
  kind: "block" | "exercise";
  label: string;
  meta: string;
}

function getCoachDiaryTaskChoices(group: ExecutionPlanGroup): CoachDiaryTaskChoice[] {
  return group.blockItems.flatMap<CoachDiaryTaskChoice>((item) => {
    const exercises = (item.block.exercises ?? [])
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex);

    if (exercises.length === 0) {
      return [{
        id: item.block.id,
        kind: "block" as const,
        label: item.block.name,
        meta: formatBlockTarget(item.block),
      }];
    }

    return exercises.map((exercise) => ({
      id: exercise.id,
      kind: "exercise" as const,
      label: exercise.name,
      meta: `${item.block.name} · ${formatExerciseTarget(exercise)}`,
    }));
  });
}

function renderExecutionBlockReadonly(item: ExecutionBlockItem, result: ExecutionResult | null) {
  const exercises = item.block.exercises ?? [];
  const plannedLoad = getExecutionBlockPlannedLoad(item.block, result);
  const actualLoad = getExecutionBlockActualLoad(item.block, result, plannedLoad);

  return `
    <article class="mobile-plan-row mobile-execution-row execution-readonly-row">
      <div class="mobile-plan-exercise-name">
        <span>
          <strong>${escapeHtml(item.block.name)}</strong>
          <small>${escapeHtml(formatExecutionResultStatus(result))}</small>
        </span>
      </div>
      <span class="mobile-plan-cell mobile-plan-work">${escapeHtml(formatBlockTarget(item.block))}</span>
      <span class="mobile-plan-cell mobile-plan-control">${escapeHtml(item.block.notes || item.sessionName)}</span>
      <div class="execution-block-load">
        <span>Нагрузка блока</span>
        <strong>Факт ${formatLoadValue(actualLoad)} / план ${formatLoadValue(plannedLoad)}</strong>
        <small>${escapeHtml(formatExecutionBlockLoadDelta(actualLoad, plannedLoad))}</small>
      </div>
      ${exercises.length > 0 ? `
        <div class="execution-readonly-exercises">
          ${exercises
            .slice()
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((exercise) => renderExecutionExerciseReadonly(exercise, getExerciseResult(result, exercise.id)))
            .join("")}
        </div>
      ` : ""}
    </article>
  `;
}

function renderExecutionExerciseReadonly(
  exercise: AssignedBlockExercise,
  result: ExecutionExerciseResult | null,
) {
  const status = getExecutionExerciseStatus(result);

  return `
    <div class="execution-readonly-exercise is-${status}">
      <span>
        <strong>${escapeHtml(exercise.name)}</strong>
        <small>Факт: ${escapeHtml(formatExerciseActualDetails(result))}</small>
        <small>План: ${escapeHtml(formatExerciseWorkCell(exercise))} · ${escapeHtml(formatExerciseControlCell(exercise))}</small>
      </span>
      <em>${escapeHtml(formatExerciseResultStatus(result))}</em>
    </div>
  `;
}

function renderExecutionBlockForm(item: ExecutionBlockItem, result: ExecutionResult | null) {
  const exercises = item.block.exercises ?? [];
  return `
    <form class="mobile-execution-row-form" data-execution-form>
      <input name="assignedPlanId" type="hidden" value="${escapeHtml(item.plan.id)}" />
      <input name="assignedBlockId" type="hidden" value="${escapeHtml(item.block.id)}" />
      ${exercises.length > 0
        ? exercises
            .slice()
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((exercise) => renderExecutionExerciseRow(exercise, getExerciseResult(result, exercise.id), result))
            .join("")
        : renderExecutionBlockFallbackRow(item.block, result)}
    </form>
  `;
}

function renderExecutionExerciseRow(
  exercise: AssignedBlockExercise,
  result: ExecutionExerciseResult | null,
  blockResult: ExecutionResult | null,
) {
  return `
    <div class="mobile-plan-row mobile-execution-row" data-execution-exercise data-exercise-id="${escapeHtml(exercise.id)}">
      <label class="execution-exercise-check mobile-plan-exercise-name">
        <input name="exerciseCompleted:${escapeHtml(exercise.id)}" type="checkbox" ${result?.completed ? "checked" : ""} />
        <span>
          <strong>${escapeHtml(exercise.name)}</strong>
          <small>${result?.completed ? "выполнено" : "не отмечено"}</small>
        </span>
      </label>
      <span class="mobile-plan-cell mobile-plan-work">${escapeHtml(formatExerciseWorkCell(exercise))}</span>
      <span class="mobile-plan-cell mobile-plan-control">${escapeHtml(formatExerciseControlCell(exercise))}</span>
      <details class="mobile-execution-row-details">
        <summary>Факт</summary>
        <div class="execution-exercise-fields">
          <label><span>Подх.</span><input inputmode="numeric" name="exerciseSets:${escapeHtml(exercise.id)}" placeholder="${escapeHtml(exercise.targetSets)}" type="number" min="0" value="${formatInputValue(result?.setsCompleted)}" /></label>
          <label><span>Повт.</span><input inputmode="numeric" name="exerciseReps:${escapeHtml(exercise.id)}" placeholder="${escapeHtml(exercise.targetReps)}" type="number" min="0" value="${formatInputValue(result?.repsCompleted)}" /></label>
          <label><span>Кг</span><input inputmode="decimal" name="exerciseWeight:${escapeHtml(exercise.id)}" placeholder="${escapeHtml(exercise.targetWeightKg)}" type="number" min="0" step="0.5" value="${formatInputValue(result?.weightKg)}" /></label>
          <label><span>Мин.</span><input inputmode="numeric" name="exerciseDuration:${escapeHtml(exercise.id)}" placeholder="${escapeHtml(exercise.targetDurationMinutes)}" type="number" min="0" value="${formatInputValue(result?.durationMinutes)}" /></label>
          <label><span>RPE</span><input inputmode="numeric" name="exerciseRpe:${escapeHtml(exercise.id)}" placeholder="${escapeHtml(exercise.targetRpe)}" type="number" min="1" max="10" value="${formatInputValue(result?.rpe)}" /></label>
        </div>
        <label class="exercise-note">
          <span>Заметка</span>
          <input name="exerciseNotes:${escapeHtml(exercise.id)}" placeholder="${escapeHtml(exercise.notes || "по упражнению")}" value="${escapeHtml(result?.notes ?? "")}" />
        </label>
        <label class="exercise-note">
          <span>Комментарий</span>
          <input name="notes" value="${escapeHtml(blockResult?.notes ?? "")}" />
        </label>
      </details>
    </div>
  `;
}

function renderExecutionBlockFallbackRow(block: AssignedPlanBlock, result: ExecutionResult | null) {
  return `
    <div class="mobile-plan-row mobile-execution-row">
      <label class="execution-exercise-check mobile-plan-exercise-name">
        <input name="completed" type="checkbox" ${result?.completed !== false ? "checked" : ""} />
        <span>
          <strong>${escapeHtml(block.name)}</strong>
          <small>${result?.completed ? "выполнено" : "не отмечено"}</small>
        </span>
      </label>
      <span class="mobile-plan-cell mobile-plan-work">${escapeHtml(formatBlockTarget(block))}</span>
      <span class="mobile-plan-cell mobile-plan-control">${escapeHtml(block.notes || "-")}</span>
      <details class="mobile-execution-row-details">
        <summary>Факт</summary>
        ${renderBlockFallbackFields(result)}
        <label class="exercise-note">
          <span>Комментарий</span>
          <input name="notes" value="${escapeHtml(result?.notes ?? "")}" />
        </label>
      </details>
    </div>
  `;
}

function renderBlockFallbackFields(result: ExecutionResult | null) {
  return `
    <label class="check-row"><input name="completed" type="checkbox" ${result?.completed !== false ? "checked" : ""} /> Выполнено</label>
    <label><span>Подходы</span><input name="setsCompleted" type="number" min="0" value="${formatInputValue(result?.setsCompleted)}" /></label>
    <label><span>Повторы</span><input name="repsCompleted" type="number" min="0" value="${formatInputValue(result?.repsCompleted)}" /></label>
    <label><span>Вес, кг</span><input name="weightKg" type="number" min="0" step="0.5" value="${formatInputValue(result?.weightKg)}" /></label>
    <label><span>Минуты</span><input name="durationMinutes" type="number" min="0" value="${formatInputValue(result?.durationMinutes)}" /></label>
    <label><span>RPE</span><input name="rpe" type="number" min="1" max="10" value="${formatInputValue(result?.rpe)}" /></label>
  `;
}

function renderCompetitionResultForm(plans: CompetitionPlanSummary[]) {
  if (plans.length === 0) {
    return "";
  }

  return `
    <form class="mobile-form compact-form" data-competition-result-form>
      <h3>Результаты соревнований</h3>
      <label>
        <span>Старт</span>
        <select name="competitionPlanId">
          ${plans.map((plan) => `<option value="${escapeHtml(plan.id)}">${escapeHtml(plan.competitionTitle)}</option>`).join("")}
        </select>
      </label>
      <label><span>Место</span><input name="finalPlace" type="number" min="1" /></label>
      <label><span>Схваток</span><input name="matchesCount" type="number" min="0" /></label>
      <label><span>Вес на взвешивании</span><input name="weightAtWeighIn" type="number" min="0" step="0.1" /></label>
      <label><span>Вес после</span><input name="weightAfter" type="number" min="0" step="0.1" /></label>
      <label class="wide-field"><span>Выступление</span><textarea name="performanceNotes" rows="3"></textarea></label>
      <label class="wide-field"><span>Заметки тренера</span><textarea name="coachNotes" rows="3"></textarea></label>
      <button class="primary-action" type="submit">Сохранить результат</button>
    </form>
  `;
}

function renderExecutionHistory(
  state: MobileAppState,
  athleteId: string | null = null,
  dayDate: string | null = null,
) {
  const results = state.data.executionResults.filter((result) => {
    if (athleteId && result.athleteId !== athleteId) {
      return false;
    }

    if (!dayDate) {
      return true;
    }

    const plan = state.data.assignedPlans.find((item) => item.id === result.assignedPlanId);
    return plan?.day.dayDate === dayDate;
  });

  if (results.length === 0) {
    return "";
  }

  return `
    <div class="list-stack">
      ${results.slice(0, 10).map((result) => {
        const status = formatExecutionResultStatus(result);

        return `
          <article class="list-card">
            <strong>${escapeHtml(status)}</strong>
            <span>${formatDateTime(result.updatedAt)}</span>
            <small>${escapeHtml(formatExecutionHistoryDetails(result))}</small>
            ${result.exerciseResults?.length && result.notes ? `<small>${escapeHtml(result.notes)}</small>` : ""}
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderCoachDiaryHistory(
  state: MobileAppState,
  athleteId: string | null,
  dayDate: string | null = null,
) {
  const entries = getCoachDiaryEntriesForAthlete(state, athleteId)
    .filter((entry) => !dayDate || entry.entryDate === dayDate)
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 6);

  if (entries.length === 0) {
    return "";
  }

  return `
    <section class="coach-diary-history">
      <div class="section-title">
        <h3>Дневник тренера</h3>
        <p>${dayDate ? `${entries.length} записей за ${formatDate(dayDate)}` : `${entries.length} последних записей`}</p>
      </div>
      <div class="coach-diary-history-list">
        ${entries.map((entry) => `
          <article class="coach-diary-history-card">
            <header>
              <strong>${escapeHtml(formatDate(entry.entryDate))}</strong>
              <span>${escapeHtml(formatCoachDiaryEntryTarget(state, entry))}</span>
            </header>
            <p>${escapeHtml(entry.notes)}</p>
            <small>${escapeHtml(entry.coachName)} · ${formatDateTime(entry.updatedAt)}</small>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderPlanCard(plan: AssignedPlanSummary, isCoachView = false) {
  const displayUnitCount = countPlanDisplayUnits(plan);
  const exerciseCount = countPlanExercises(plan);
  const dayFocus = formatAssignedPlanDayFocus(plan);

  return `
    <article class="mobile-plan-day-card plan-card">
      <header class="mobile-plan-day-card-head">
        <div>
          <strong>${formatDate(plan.day.dayDate)} · ${escapeHtml(plan.day.label)}</strong>
          <span>${escapeHtml(plan.templateName)} · ${formatPlanUnitCount(displayUnitCount)} · ${exerciseCount} упражнений</span>
        </div>
        ${isCoachView
          ? `<button class="mobile-plan-open-day" data-coach-open-day="${escapeHtml(plan.day.dayDate)}" data-coach-open-screen="dashboard" type="button">Открыть день</button>`
          : `<em>${escapeHtml(dayFocus)}</em>`}
      </header>
      <div class="mobile-plan-day-card-body">
        ${plan.day.sessions.map((session) => `
          <section class="mobile-plan-session">
            <h4>${escapeHtml(session.name)}</h4>
            ${isSessionLevelPlanUnit(session)
              ? renderUnifiedSessionPlanTable(session)
              : `
                <div class="mobile-plan-table">
                  <div class="mobile-plan-table-head">
                    <span>Упр.</span>
                    <span>Подходы</span>
                    <span>Контр.</span>
                  </div>
                  ${session.blocks.map((block) => renderPlanBlock(block)).join("")}
                </div>
              `}
          </section>
        `).join("")}
      </div>
    </article>
  `;
}

function renderPlanBlock(block: AssignedPlanBlock) {
  const exercises = (block.exercises ?? []).slice().sort((a, b) => a.orderIndex - b.orderIndex);

  return `
    ${exercises.length > 0 ? exercises.map((exercise) => `
      <div class="mobile-plan-row">
        <span class="mobile-plan-exercise-name-static">${escapeHtml(exercise.name)}</span>
        <span class="mobile-plan-cell mobile-plan-work">${escapeHtml(formatExerciseWorkCell(exercise))}</span>
        <span class="mobile-plan-cell mobile-plan-control">${escapeHtml(formatExerciseControlCell(exercise))}</span>
      </div>
    `).join("") : `
      <div class="mobile-plan-row">
        <span class="mobile-plan-exercise-name-static">${escapeHtml(block.name)}</span>
        <span class="mobile-plan-cell mobile-plan-work">${escapeHtml(formatBlockTarget(block))}</span>
        <span class="mobile-plan-cell mobile-plan-control">-</span>
      </div>
    `}
  `;
}

function renderProfileCard(user: NonNullable<MobileAppState["session"]["user"]>) {
  return `
    <article class="focus-card">
      <span>${escapeHtml(user.email)}</span>
      <h3>${escapeHtml(user.fullName)}</h3>
      <p>${escapeHtml([user.sport, user.discipline, user.weightClass].filter(Boolean).join(" · ") || "Профиль можно заполнить у тренера.")}</p>
    </article>
  `;
}

function renderQueue(state: MobileAppState) {
  return `
    <section class="queue-panel">
      <h3>Очередь синхронизации</h3>
      ${state.queue.map((item) => `
        <article class="${item.status === "invalid" ? "is-invalid" : ""}">
          <strong>${escapeHtml(item.label)}</strong>
          <span>${formatDateTime(item.createdAt)}</span>
          <em>${escapeHtml(formatQueueItemStatus(item))}</em>
          ${item.lastError ? `<small>${escapeHtml(item.lastError)}</small>` : ""}
        </article>
      `).join("")}
    </section>
  `;
}

function getPendingQueueItems(queue: PendingSyncAction[]) {
  return queue.filter((item) => item.status !== "invalid");
}

function getInvalidQueueItems(queue: PendingSyncAction[]) {
  return queue.filter((item) => item.status === "invalid");
}

function formatQueueItemStatus(item: PendingSyncAction) {
  if (item.status === "invalid") {
    return "Не синхронизируется";
  }

  if (item.lastError) {
    return "Повторим при синхронизации";
  }

  return "Ожидает отправки";
}

function formatSyncResultMessage(syncedCount: number, invalidatedCount: number) {
  const parts = [
    syncedCount > 0 ? `Синхронизировано: ${syncedCount}` : "",
    invalidatedCount > 0 ? `Не отправляется из-за прав: ${invalidatedCount}` : "",
  ].filter(Boolean);

  return parts.length ? parts.join(". ") : "Очередь синхронизации проверена";
}

function renderStatus(state: MobileAppState) {
  return `
    <div class="status-stack">
      ${state.message ? `<p class="status-message">${escapeHtml(state.message)}</p>` : ""}
      ${state.error ? `<p class="status-error">${escapeHtml(state.error)}</p>` : ""}
    </div>
  `;
}

function renderEmpty(title: string, text: string) {
  return `
    <article class="empty-state">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(text)}</p>
    </article>
  `;
}

function getScreensForRole(role: string | undefined): Array<{ id: MobileScreen; label: string; icon: string }> {
  const common: Array<{ id: MobileScreen; label: string; icon: string }> = [
    { id: "dashboard", label: "Главная", icon: "⌂" },
    { id: "plans", label: "Планы", icon: "▦" },
    { id: "calendar", label: "Календарь", icon: "□" },
    { id: "results", label: "Выполнение", icon: "✓" },
  ];

  if (role === "coach" || role === "admin") {
    return [
      common[0],
      { id: "athletes", label: "Спортсмены", icon: "◎" },
      ...common.slice(1),
    ];
  }

  return [
    common[0],
    { id: "readiness", label: "Готовность", icon: "●" },
    ...common.slice(1),
  ];
}

function isCoachRole(role: string | undefined | null) {
  return role === "coach" || role === "admin";
}

function resolveSelectedAthleteId(
  user: MobileAppState["session"]["user"],
  data: MobileDataSnapshot,
  currentAthleteId: string | null,
) {
  if (user?.role === "athlete") {
    return user.athleteId;
  }

  if (currentAthleteId && data.athletes.some((athlete) => athlete.athleteId === currentAthleteId)) {
    return currentAthleteId;
  }

  return data.athletes[0]?.athleteId ?? null;
}

function getSelectedAthlete(state: MobileAppState) {
  return state.data.athletes.find((athlete) => athlete.athleteId === state.selectedAthleteId) ?? null;
}

function getActiveAthleteId(state: MobileAppState) {
  return state.session.user?.role === "athlete"
    ? state.session.user.athleteId
    : state.selectedAthleteId;
}

function getPlansForAthlete(state: MobileAppState, athleteId: string | null) {
  return state.data.assignedPlans.filter((plan) => !athleteId || plan.athleteId === athleteId);
}

function getExecutionPlanGroups(plans: AssignedPlanSummary[]): ExecutionPlanGroup[] {
  return sortPlansForExecution(plans)
    .map((plan) => ({
      blockItems: getExecutionBlockItems([plan]),
      plan,
    }))
    .filter((group) => group.blockItems.length > 0);
}

function getPlanDateOptions(plans: AssignedPlanSummary[]) {
  const seenDates = new Set<string>();

  return plans
    .filter((plan) => {
      if (seenDates.has(plan.day.dayDate)) {
        return false;
      }

      seenDates.add(plan.day.dayDate);
      return true;
    })
    .map((plan) => ({
      date: plan.day.dayDate,
      label: plan.day.label,
    }));
}

function getExecutionDateOptions(groups: ExecutionPlanGroup[]) {
  const seenDates = new Set<string>();

  return groups
    .filter((group) => {
      if (seenDates.has(group.plan.day.dayDate)) {
        return false;
      }

      seenDates.add(group.plan.day.dayDate);
      return true;
    })
    .map((group) => ({
      date: group.plan.day.dayDate,
      label: group.plan.day.label,
    }));
}

function getCoachSelectableDayOptions(state: MobileAppState, athleteId: string | null) {
  const labelsByDate = new Map<string, Set<string>>();
  const addDate = (date: string | null | undefined, label: string) => {
    const normalizedDate = normalizeDateValue(date ?? "");

    if (!normalizedDate) {
      return;
    }

    if (!labelsByDate.has(normalizedDate)) {
      labelsByDate.set(normalizedDate, new Set());
    }

    labelsByDate.get(normalizedDate)?.add(label);
  };

  addDate(todayValue(), "Сегодня");

  getPlansForAthlete(state, athleteId).forEach((plan) => {
    addDate(plan.day.dayDate, plan.day.label ? `План ${plan.day.label}` : "План");
  });

  const readinessEntries = state.data.readinessHistory.length
    ? state.data.readinessHistory
    : state.data.readinessEntry
      ? [state.data.readinessEntry]
      : [];

  readinessEntries
    .filter((entry) => !athleteId || entry.athleteId === athleteId)
    .forEach((entry) => addDate(entry.entryDate, "Готовность"));

  getCoachDiaryEntriesForAthlete(state, athleteId).forEach((entry) => {
    addDate(entry.entryDate, "Дневник");
  });

  getCompetitionPlansForAthlete(state, athleteId).forEach((plan) => {
    addDate(plan.competitionStartDate, "Старт");
  });

  return Array.from(labelsByDate.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, labels]) => ({
      date,
      label: Array.from(labels).slice(0, 2).join(" · "),
    }));
}

function getExecutionDaySummary(
  state: MobileAppState,
  group: ExecutionPlanGroup,
  diaryEntries: CoachDiaryEntry[],
): ExecutionDaySummary {
  let completedBlockCount = 0;
  let partialBlockCount = 0;
  let missedBlockCount = 0;
  let plannedLoad = 0;
  let actualLoad = 0;

  for (const item of group.blockItems) {
    const result = getExecutionResultForBlock(state, item.plan.id, item.block.id);
    const blockPlannedLoad = getExecutionBlockPlannedLoad(item.block, result);
    const blockStatus = getExecutionBlockStatus(item.block, result);

    plannedLoad += blockPlannedLoad;
    actualLoad += getExecutionBlockActualLoad(item.block, result, blockPlannedLoad);

    if (blockStatus === "completed") {
      completedBlockCount += 1;
    } else if (blockStatus === "partial") {
      partialBlockCount += 1;
    } else {
      missedBlockCount += 1;
    }
  }

  const status: ExecutionDayStatus =
    completedBlockCount === group.blockItems.length
      ? "completed"
      : completedBlockCount + partialBlockCount > 0
        ? "partial"
        : "missed";

  return {
    actualLoad: roundLoad(actualLoad),
    completedBlockCount,
    latestDiaryEntry: diaryEntries[0] ?? null,
    missedBlockCount,
    partialBlockCount,
    plannedLoad: roundLoad(plannedLoad),
    readinessEntry: getReadinessEntryForDate(state, group.plan.athleteId, group.plan.day.dayDate),
    status,
    statusLabel: getExecutionDayStatusLabel(status),
  };
}

function getCoachDaySummary(
  state: MobileAppState,
  athleteId: string,
  date: string,
): CoachTodayDaySummary {
  const plans = getPlansForAthlete(state, athleteId)
    .filter((plan) => plan.day.dayDate === date);
  const groups = getExecutionPlanGroups(plans);
  const diaryEntries = getCoachDiaryEntriesForAthleteDate(state, athleteId, date);
  const templateNames = Array.from(new Set(plans.map((plan) => plan.templateName).filter(Boolean)));
  const deviceWorkoutLinks = getDeviceWorkoutLinksForDate(state, athleteId, date);
  const linkedBlockIds = new Set(deviceWorkoutLinks.map((link) => link.assignedBlockId));
  let sessionCount = 0;
  let blockCount = 0;
  let completedBlockCount = 0;
  let partialBlockCount = 0;
  let missedBlockCount = 0;
  let exerciseCount = 0;
  let completedExerciseCount = 0;
  let partialExerciseCount = 0;
  let missedExerciseCount = 0;
  let plannedLoad = 0;
  let manualActualLoad = 0;
  let linkedPlannedLoad = 0;

  for (const group of groups) {
    sessionCount += group.plan.day.sessions.length;

    for (const item of group.blockItems) {
      const result = getExecutionResultForBlock(state, item.plan.id, item.block.id);
      const blockPlannedLoad = getExecutionBlockPlannedLoad(item.block, result);
      const blockStatus = getExecutionBlockStatus(item.block, result);
      const statusForSummary = result || !linkedBlockIds.has(item.block.id)
        ? blockStatus
        : "completed";
      const exercises = item.block.exercises ?? [];

      blockCount += 1;
      plannedLoad += blockPlannedLoad;
      manualActualLoad += getExecutionBlockActualLoad(item.block, result, blockPlannedLoad);

      if (linkedBlockIds.has(item.block.id)) {
        linkedPlannedLoad += blockPlannedLoad;
      }

      if (statusForSummary === "completed") {
        completedBlockCount += 1;
      } else if (statusForSummary === "partial") {
        partialBlockCount += 1;
      } else {
        missedBlockCount += 1;
      }

      exerciseCount += exercises.length;

      for (const exercise of exercises) {
        const exerciseStatus = getExecutionExerciseStatus(getExerciseResult(result, exercise.id));

        if (exerciseStatus === "completed") {
          completedExerciseCount += 1;
        } else if (exerciseStatus === "partial") {
          partialExerciseCount += 1;
        } else {
          missedExerciseCount += 1;
        }
      }
    }
  }

  const status: CoachTodayDayStatus =
    blockCount === 0
      ? "no-plan"
      : completedBlockCount === blockCount
        ? "completed"
        : completedBlockCount + partialBlockCount > 0
          ? "partial"
          : "missed";
  const deviceConfirmedLoad = linkedBlockIds.size > 0
    ? roundLoad(Math.min(plannedLoad, linkedPlannedLoad > 0 ? linkedPlannedLoad : plannedLoad))
    : 0;
  const actualLoad = roundLoad(Math.max(manualActualLoad, deviceConfirmedLoad));

  return {
    actualLoad,
    blockCount,
    completedBlockCount,
    completedExerciseCount,
    date,
    deviceConfirmedLoad,
    exerciseCount,
    latestDiaryEntry: diaryEntries[0] ?? null,
    manualActualLoad: roundLoad(manualActualLoad),
    missedBlockCount,
    missedExerciseCount,
    partialBlockCount,
    partialExerciseCount,
    planCount: plans.length,
    plannedLoad: roundLoad(plannedLoad),
    sessionCount,
    status,
    statusLabel: getCoachTodayDayStatusLabel(status),
    templateNames,
  };
}

function getCoachDayCleanSummary(
  state: MobileAppState,
  athleteId: string,
  date: string,
): CoachDayCleanSummary {
  const athlete = state.data.athletes.find((item) => item.athleteId === athleteId) ?? null;
  const plans = getPlansForAthlete(state, athleteId)
    .filter((plan) => plan.day.dayDate === date);
  const groups = getExecutionPlanGroups(plans);
  const summary = getCoachDaySummary(state, athleteId, date);
  const readinessEntry = getReadinessEntryForDate(state, athleteId, date);
  const deviceHealthSummary = getDeviceHealthSummaryForDate(state, athleteId, date);
  const deviceWorkouts = getDeviceWorkoutsForDate(state, athleteId, date);
  const deviceWorkoutLinks = getDeviceWorkoutLinksForDate(state, athleteId, date);
  const linkedBlockIds = new Set(deviceWorkoutLinks.map((link) => link.assignedBlockId));
  let hasExecutionMarks = false;
  const blocks = groups.flatMap((group) =>
    group.blockItems.map((item) => {
      const result = getExecutionResultForBlock(state, item.plan.id, item.block.id);
      hasExecutionMarks = hasExecutionMarks || Boolean(result);
      const plannedLoad = getExecutionBlockPlannedLoad(item.block, result);
      const actualLoad = getExecutionBlockActualLoad(item.block, result, plannedLoad);
      const isDeviceLinked = linkedBlockIds.has(item.block.id);
      const status = result || !isDeviceLinked
        ? getExecutionBlockStatus(item.block, result)
        : "completed";
      const exercises = (item.block.exercises ?? [])
        .slice()
        .sort((left, right) => left.orderIndex - right.orderIndex)
        .map((exercise) => {
          const exerciseResult = getExerciseResult(result, exercise.id);
          const exerciseStatus = getExecutionExerciseStatus(exerciseResult);

          return {
            actualDetails: formatExerciseActualDetails(exerciseResult),
            assignedBlockId: item.block.id,
            assignedExerciseId: exercise.id,
            assignedPlanId: item.plan.id,
            blockName: item.block.name,
            name: exercise.name,
            plannedControl: formatExerciseControlCell(exercise),
            plannedWork: formatExerciseWorkCell(exercise),
            sessionName: item.sessionName,
            status: exerciseStatus,
            statusLabel: formatExerciseResultStatus(exerciseResult),
            sourceLabel: getMobileExecutionSourceLabel(Boolean(exerciseResult), isDeviceLinked),
          };
        });

      return {
        actualLoad: roundLoad(result ? actualLoad : isDeviceLinked ? plannedLoad : actualLoad),
        assignedBlockId: item.block.id,
        assignedPlanId: item.plan.id,
        deviceConfirmedLoad: isDeviceLinked ? roundLoad(plannedLoad) : 0,
        exercises,
        loadDeltaLabel: formatExecutionBlockLoadDelta(actualLoad, plannedLoad),
        manualActualLoad: roundLoad(actualLoad),
        name: item.block.name,
        notes: item.block.notes,
        plannedLoad: roundLoad(plannedLoad),
        planName: item.plan.templateName,
        rowKind: item.block.rowKind,
        sessionDeviceLinkMode: item.sessionDeviceLinkMode,
        sessionName: item.sessionName,
        status,
        statusLabel: getExecutionDayStatusLabel(status),
        sourceLabel: getMobileExecutionSourceLabel(Boolean(result), isDeviceLinked),
        target: formatBlockTarget(item.block),
      };
    }),
  );
  const latestDiaryEntry = summary.latestDiaryEntry;

  return {
    athlete,
    athleteId,
    athleteName: athlete?.fullName ?? plans[0]?.athleteName ?? "Спортсмен",
    blocks,
    coachNote: latestDiaryEntry?.notes?.trim() || "Комментария тренера за выбранный день пока нет.",
    date,
    deviceHealthSummary,
    deviceWorkoutLinks,
    deviceWorkouts,
    hasExecutionMarks,
    latestDiaryEntry,
    plans,
    readinessEntry,
    summary,
  };
}

function getCoachDayAiReviewKey(athleteId: string, entryDate: string) {
  return `${athleteId}::${entryDate}`;
}

function getMobileExecutionSourceLabel(hasManualMark: boolean, hasDeviceLink: boolean) {
  if (hasManualMark) {
    return "отмечено спортсменом";
  }

  if (hasDeviceLink) {
    return "подтверждено устройством";
  }

  return "нет отметки или данных устройства";
}

function buildCoachAiReviewByDay(reviews: CoachDayAiReview[]) {
  return reviews
    .filter((review) => review.source !== "local-rules")
    .slice()
    .sort(sortCoachAiReviewsOldestFirst)
    .reduce<Record<string, CoachDayAiReview>>((items, review) => {
      items[getCoachDayAiReviewKey(review.athleteId, review.entryDate)] = review;
      return items;
    }, {});
}

function getCoachAiReviewsForDay(
  reviews: CoachDayAiReview[],
  athleteId: string,
  entryDate: string,
) {
  return reviews
    .filter((review) =>
      review.athleteId === athleteId &&
      review.entryDate === entryDate &&
      review.source !== "local-rules"
    )
    .slice()
    .sort(sortCoachAiReviewsNewestFirst);
}

function getCoachDayAiPayloadFingerprint(payload: CoachDayAiPayload) {
  return JSON.stringify(sortJsonForFingerprint(payload));
}

function sortJsonForFingerprint(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonForFingerprint);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sortJsonForFingerprint((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }

  return value;
}

function sortCoachAiReviewsNewestFirst(left: CoachDayAiReview, right: CoachDayAiReview) {
  return right.generatedAt.localeCompare(left.generatedAt);
}

function sortCoachAiReviewsOldestFirst(left: CoachDayAiReview, right: CoachDayAiReview) {
  return left.generatedAt.localeCompare(right.generatedAt);
}

function formatCoachDayAiReviewSource(source: CoachDayAiReview["source"]) {
  if (source === "model") {
    return "ИИ-модель";
  }

  if (source === "server-rules") {
    return "серверный разбор";
  }

  return "локальный черновик, сервер недоступен";
}

function buildOfflineCoachDayAiReview(dayData: CoachDayCleanSummary): CoachDayAiReview {
  const payload = buildCoachDayAiPayload(dayData);

  return {
    athleteId: dayData.athleteId,
    dayPayload: payload,
    dayPayloadJson: JSON.stringify(payload, null, 2),
    entryDate: dayData.date,
    generatedAt: new Date().toISOString(),
    observation: buildOfflineCoachAiObservation(dayData),
    riskNotes: buildOfflineCoachAiRiskNotes(dayData),
    source: "local-rules",
    tomorrowActions: buildOfflineCoachAiTomorrowActions(dayData),
  };
}

function buildCoachDayAiPayload(dayData: CoachDayCleanSummary): CoachDayAiPayload {
  const summary = dayData.summary;
  const readiness = dayData.readinessEntry;
  const dataQuality = buildCoachDayDataQuality(dayData);
  const deviceLinkGroups = getCoachDeviceWorkoutLinkGroups(dayData.blocks);
  const fullyLinkedDeviceTargets = deviceLinkGroups.filter((group) =>
    getDeviceWorkoutLinkGroupForBlocks(dayData.deviceWorkoutLinks, group.assignedBlockIds).isFullyLinked
  ).length;

  return {
    athlete: {
      displayName: dayData.athleteName,
      discipline: dayData.athlete?.discipline || null,
      sport: dayData.athlete?.sport || null,
      weightClass: dayData.athlete?.weightClass || null,
    },
    coachComment: dayData.latestDiaryEntry ? dayData.coachNote : null,
    dataQuality,
    date: dayData.date,
    deviceHealth: buildCoachDayAiDeviceHealth(dayData),
    limitations: buildCoachDayAiLimitations(dataQuality),
    execution: {
      blocks: {
        completed: summary.completedBlockCount,
        missed: summary.missedBlockCount,
        partial: summary.partialBlockCount,
        total: summary.blockCount,
      },
      exercises: {
        completed: summary.completedExerciseCount,
        missed: summary.missedExerciseCount,
        partial: summary.partialExerciseCount,
        total: summary.exerciseCount,
      },
      status: summary.status,
      statusLabel: summary.statusLabel,
    },
    load: {
      actual: summary.actualLoad,
      delta: roundLoad(summary.actualLoad - summary.plannedLoad),
      deviceConfirmed: summary.deviceConfirmedLoad,
      explanation: buildCoachDayAiLoadExplanation({
        actualLoad: summary.actualLoad,
        deviceConfirmedLoad: summary.deviceConfirmedLoad,
        fullyLinkedDeviceTargets,
        hasExecutionMarks: dayData.hasExecutionMarks,
        linkableDeviceTargets: deviceLinkGroups.length,
        manualActualLoad: summary.manualActualLoad,
        plannedLoad: summary.plannedLoad,
      }),
      manualActual: summary.manualActualLoad,
      planned: summary.plannedLoad,
    },
    plan: {
      blocks: dayData.blocks.map((block) => ({
        actualLoad: block.actualLoad,
        exercises: block.exercises.map((exercise) => ({
          actual: exercise.actualDetails,
          name: exercise.name,
          plannedControl: exercise.plannedControl,
          plannedWork: exercise.plannedWork,
          status: exercise.status,
        })),
        name: block.name,
        plannedLoad: block.plannedLoad,
        sessionName: block.sessionName,
        status: block.status,
      })),
      count: summary.planCount,
      templates: summary.templateNames,
    },
    readiness: readiness
      ? {
        flags: formatReadinessFlags(readiness),
        score: readiness.score,
        status: readiness.status,
        statusLabel: formatReadinessStatus(readiness.status),
      }
      : null,
  };
}

function buildCoachDayAiLimitations(dataQuality: NonNullable<CoachDayAiPayload["dataQuality"]>) {
  if (dataQuality.missing.length === 0) {
    return [];
  }

  return [`Вывод ограничен, потому что не хватает ${dataQuality.missing.slice(0, 6).join(", ")}.`];
}

function buildCoachDayAiLoadExplanation(input: {
  actualLoad: number;
  deviceConfirmedLoad: number;
  fullyLinkedDeviceTargets: number;
  hasExecutionMarks: boolean;
  linkableDeviceTargets: number;
  manualActualLoad: number;
  plannedLoad: number;
}) {
  const delta = roundLoad(input.actualLoad - input.plannedLoad);

  return [
    `Плановая: ${formatLoadValue(input.plannedLoad)} из назначенных блоков плана.`,
    `Факт по отметкам: ${formatLoadValue(input.manualActualLoad)} ${input.hasExecutionMarks ? "из сохранённых отметок выполнения" : "ручные отметки выполнения не сохранены"}.`,
    `Подтверждено устройством: ${formatLoadValue(input.deviceConfirmedLoad)} ${input.linkableDeviceTargets > 0 ? `· ${input.fullyLinkedDeviceTargets}/${input.linkableDeviceTargets} плановых целей связано` : "· в плане нет цели для привязки тренировки"}.`,
    `Итоговый факт: ${formatLoadValue(input.actualLoad)} ${input.deviceConfirmedLoad > input.manualActualLoad ? "по связанной тренировке устройства" : "без повторного суммирования ручных и device-данных"}.`,
    `Расхождение: ${formatLoadValue(delta)} ${delta === 0 ? "единиц нагрузки" : delta > 0 ? "выше плана; проверьте длительность/RPE или дополнительную работу" : "ниже плана; часть задач не выполнена или не отмечена"}.`,
  ];
}

function buildCoachDayDataQuality(dayData: CoachDayCleanSummary): NonNullable<CoachDayAiPayload["dataQuality"]> {
  const device = dayData.deviceHealthSummary;
  const hasDeviceSync = Boolean(device);
  const hasSleep = hasDeviceSleepData(device);
  const hasRestingHr = device?.heartRate?.restingBpm !== null && device?.heartRate?.restingBpm !== undefined;
  const hasOxygenSaturation = hasDeviceOxygenSaturationData(device);
  const hasDeviceWorkout = Boolean(device?.workout) || dayData.deviceWorkouts.length > 0;
  const hasDeviceLinkedWorkout = dayData.deviceWorkoutLinks.length > 0;
  const signals = [
    {
      action: "Попросите спортсмена отправить готовность за выбранный день.",
      key: "readiness",
      label: "готовность",
      present: Boolean(dayData.readinessEntry),
    },
    {
      action: "Назначьте план или выберите день с планом.",
      key: "plan",
      label: "план",
      present: dayData.summary.planCount > 0,
    },
    {
      action: "Попросите спортсмена отметить выполнение упражнений.",
      key: "execution",
      label: "выполнение",
      present: dayData.summary.planCount === 0 || dayData.hasExecutionMarks || hasDeviceLinkedWorkout,
    },
    {
      action: "Добавьте короткий комментарий тренера по дню.",
      key: "coachComment",
      label: "комментарий тренера",
      present: Boolean(dayData.latestDiaryEntry),
    },
    {
      action: "Попросите спортсмена синхронизировать Huawei Health или Mi Fitness.",
      key: "deviceSync",
      label: "синхронизация устройства",
      present: hasDeviceSync,
    },
    {
      action: "Проверьте доступ приложения здоровья ко сну и повторите синхронизацию.",
      key: "sleep",
      label: "сон",
      present: hasSleep,
    },
    {
      action: "Проверьте доступ приложения здоровья к пульсу и повторите синхронизацию.",
      key: "restingHr",
      label: "пульс покоя",
      present: hasRestingHr,
    },
    {
      action: "Проверьте доступ приложения здоровья к SpO2 и повторите синхронизацию.",
      key: "oxygenSaturation",
      label: "SpO2",
      present: hasOxygenSaturation,
    },
    {
      action: "Проверьте, пришли ли тренировки с устройства за выбранный день.",
      key: "deviceWorkout",
      label: "тренировки с устройства",
      present: hasDeviceWorkout,
    },
  ];
  const available = signals.filter((signal) => signal.present).map((signal) => signal.label);
  const missingSignals = signals.filter((signal) => !signal.present);
  const missing = missingSignals.map((signal) => signal.label);
  const criticalMissing = missingSignals.filter((signal) =>
    ["readiness", "plan", "execution", "sleep", "restingHr"].includes(signal.key)
  ).length;
  const status = criticalMissing === 0
    ? "complete"
    : criticalMissing <= 2
      ? "partial"
      : "insufficient";

  return {
    actions: missingSignals
      .map((signal) => signal.action)
      .filter((action): action is string => Boolean(action)),
    available,
    missing,
    signals,
    status,
    statusLabel: status === "complete"
      ? "Данных достаточно"
      : status === "partial"
        ? "Данные частичные"
        : "Данных мало для анализа",
  };
}

function buildCoachDayAiDeviceHealth(dayData: CoachDayCleanSummary): CoachDayAiPayload["deviceHealth"] {
  const summary = dayData.deviceHealthSummary;
  const linkedWorkouts = dayData.deviceWorkoutLinks.map((link) => {
    const block = dayData.blocks.find((item) => item.assignedBlockId === link.assignedBlockId);

    return {
      averageHeartRateBpm: link.workout.averageHeartRateBpm,
      distanceMeters: link.workout.distanceMeters,
      durationMinutes: link.workout.durationMinutes,
      endTime: link.workout.endTime,
      hasDistance: link.workout.distanceMeters !== null ||
        link.workout.samples.some((sample) => sample.distanceMeters !== null),
      hasGraph: hasDeviceWorkoutGraph(link.workout),
      hasHeartRate: link.workout.averageHeartRateBpm !== null ||
        link.workout.samples.some((sample) => sample.heartRateBpm !== null),
      hasSpO2: link.workout.samples.some((sample) => sample.oxygenSaturationPercent !== null),
      linkedToPlan: true,
      linkStatusLabel: "связано с блоком плана",
      maxHeartRateBpm: link.workout.maxHeartRateBpm,
      planBlockId: link.assignedBlockId,
      planBlockName: block?.name ?? "",
      sourceDevice: link.workout.sourceDevice,
      startTime: link.workout.startTime,
      workoutId: link.workout.id,
      workoutType: link.workout.workoutType,
    };
  });

  if (!summary && linkedWorkouts.length === 0) {
    return null;
  }

  const status = summary
    ? getDeviceHealthStatus(summary)
    : { missing: [], present: [], statusLabel: "Тренировка устройства связана" };

  return {
    heartRate: summary?.heartRate
      ? {
        averageBpm: summary.heartRate.averageBpm,
        hrvRmssdMs: summary.heartRate.hrvRmssdMs,
        maxBpm: summary.heartRate.maxBpm,
        minBpm: summary.heartRate.minBpm,
        restingBpm: summary.heartRate.restingBpm,
      }
      : null,
    linkedWorkouts,
    missing: status.missing,
    oxygenSaturation: summary?.oxygenSaturation
      ? {
        averagePercent: summary.oxygenSaturation.averagePercent,
        latestPercent: summary.oxygenSaturation.latestPercent,
        maxPercent: summary.oxygenSaturation.maxPercent,
        minPercent: summary.oxygenSaturation.minPercent,
        sampleCount: summary.oxygenSaturation.sampleCount,
      }
      : null,
    sleep: summary?.sleep
      ? {
        awakeMinutes: summary.sleep.awakeMinutes,
        deepMinutes: summary.sleep.deepMinutes,
        durationMinutes: summary.sleep.durationMinutes,
        lightMinutes: summary.sleep.lightMinutes,
        remMinutes: summary.sleep.remMinutes,
        score: summary.sleep.score,
      }
      : null,
    sourceDevice: summary?.sourceDevice ?? linkedWorkouts[0]?.sourceDevice ?? null,
    statusLabel: status.statusLabel,
    syncedAt: summary?.syncedAt ?? null,
    workout: summary?.workout
      ? {
        activeCalories: summary.workout.activeCalories,
        averageHeartRateBpm: summary.workout.averageHeartRateBpm,
        count: summary.workout.count,
        maxHeartRateBpm: summary.workout.maxHeartRateBpm,
        totalDistanceMeters: summary.workout.totalDistanceMeters,
        totalDurationMinutes: summary.workout.totalDurationMinutes,
      }
      : null,
  };
}

function buildOfflineCoachAiObservation(dayData: CoachDayCleanSummary) {
  const summary = dayData.summary;

  if (summary.planCount === 0) {
    return "Офлайн-черновик: на выбранный день нет назначенного плана. Серверный разбор нужен для полной рекомендации.";
  }

  const loadLabel = `${formatLoadValue(summary.actualLoad)} из ${formatLoadValue(summary.plannedLoad)}`;
  const exerciseLabel = summary.exerciseCount > 0
    ? `${summary.completedExerciseCount}/${summary.exerciseCount} упражнений`
    : `${summary.completedBlockCount}/${summary.blockCount} блоков`;

  const deviceLabel = formatOfflineCoachAiDeviceObservation(dayData.deviceHealthSummary);

  return `Офлайн-черновик: день отмечен как «${summary.statusLabel.toLowerCase()}», выполнено ${exerciseLabel}, нагрузка ${loadLabel}.${deviceLabel ? ` ${deviceLabel}` : ""}`;
}

function buildOfflineCoachAiRiskNotes(dayData: CoachDayCleanSummary) {
  const summary = dayData.summary;
  const readiness = dayData.readinessEntry;
  const risks = [
    "Серверный разбор недоступен, поэтому это только ограниченная подсказка по данным на устройстве.",
  ];

  if (summary.planCount === 0) {
    risks.push("Нет плановой нагрузки: проверьте выбранную дату или назначение плана после восстановления сети.");
  }

  addOfflineCoachAiDataQualityRisks(risks, dayData);

  if (summary.status === "missed") {
    risks.push("День не выполнен: не переносите весь объём автоматически без серверной проверки.");
  } else if (summary.status === "partial") {
    risks.push("Есть частичное выполнение: проверьте список отмеченных и пропущенных упражнений вручную.");
  }

  if (readiness?.status === "red") {
    risks.push("Готовность в красной зоне: перед нагрузкой нужна ручная проверка самочувствия.");
  } else if (readiness?.status === "yellow") {
    risks.push("Готовность требует внимания: тяжёлую работу лучше не добавлять до серверного разбора.");
  }

  addOfflineCoachAiDeviceRisks(risks, dayData);

  return risks;
}

function buildOfflineCoachAiTomorrowActions(dayData: CoachDayCleanSummary) {
  const summary = dayData.summary;
  const actions = [
    "Повторите разбор после восстановления сети, чтобы получить серверную рекомендацию.",
    "План и дневник не менялись.",
  ];

  addOfflineCoachAiDataQualityActions(actions, dayData);

  if (summary.planCount === 0) {
    actions.push("Выберите день с назначенным планом или назначьте план перед повторным разбором.");
  } else if (summary.status === "partial") {
    actions.push("До серверного разбора смотрите по упражнениям, что именно было пропущено.");
  } else if (summary.status === "missed") {
    actions.push("Не переносите пропущенный день целиком без проверки готовности.");
  }

  addOfflineCoachAiDeviceActions(actions, dayData.deviceHealthSummary);

  return Array.from(new Set(actions)).slice(0, 4);
}

function addOfflineCoachAiDataQualityRisks(risks: string[], dayData: CoachDayCleanSummary) {
  const dataQuality = buildCoachDayDataQuality(dayData);

  if (dataQuality.missing.length > 0) {
    risks.push(`Вывод ограничен, потому что не хватает ${dataQuality.missing.slice(0, 5).join(", ")}.`);
  }

  if (dataQuality.status === "partial") {
    risks.push("Данные частичные: не делайте уверенный вывод только по общей нагрузке.");
  } else if (dataQuality.status === "insufficient") {
    risks.push(`Данных мало для анализа: не хватает ${dataQuality.missing.slice(0, 5).join(", ")}.`);
  }
}

function addOfflineCoachAiDataQualityActions(actions: string[], dayData: CoachDayCleanSummary) {
  const dataQuality = buildCoachDayDataQuality(dayData);

  for (const action of dataQuality.actions.slice(0, 2)) {
    actions.push(action);
  }
}

function formatOfflineCoachAiDeviceObservation(summary: DeviceHealthDailySummary | null) {
  if (!summary) {
    return "Данные устройства за этот день не синхронизированы.";
  }

  const parts = [
    summary.sleep?.durationMinutes !== null && summary.sleep?.durationMinutes !== undefined
      ? `сон ${formatDurationHours(summary.sleep.durationMinutes)}`
      : null,
    summary.heartRate?.restingBpm !== null && summary.heartRate?.restingBpm !== undefined
      ? `пульс покоя ${formatLoadValue(summary.heartRate.restingBpm)}`
      : null,
    summary.workout ? `тренировки устройства: ${summary.workout.count}` : null,
  ].filter((item): item is string => Boolean(item));

  return parts.length ? `По устройству: ${parts.join(", ")}.` : "Данные устройства пришли неполностью.";
}

function addOfflineCoachAiDeviceRisks(risks: string[], dayData: CoachDayCleanSummary) {
  const summary = dayData.deviceHealthSummary;

  if (!summary) {
    risks.push("Нет данных устройства: сон, пульс покоя и внешние тренировки не учитываются в офлайн-черновике.");
    return;
  }

  if (isDeviceSleepLow(summary)) {
    risks.push("По устройству сон выглядит низким: перед тяжёлой работой стоит уточнить восстановление спортсмена.");
  }

  if (isDeviceRestingHrHigh(summary)) {
    risks.push("Пульс покоя по устройству высокий: это повод проверить самочувствие и не повышать нагрузку автоматически.");
  }

  if (summary.workout && summary.workout.count > 0 && dayData.summary.status !== "completed") {
    risks.push("Устройство показывает тренировочную активность, но выполнение в плане отмечено не полностью: проверьте, не была ли работа сделана вне отметок.");
  }
}

function addOfflineCoachAiDeviceActions(actions: string[], summary: DeviceHealthDailySummary | null) {
  if (!summary) {
    actions.push("Попросите спортсмена синхронизировать Huawei Health или Mi Fitness перед повторным разбором дня.");
    return;
  }

  if (isDeviceSleepLow(summary) || isDeviceRestingHrHigh(summary)) {
    actions.push("Сверьте сон и пульс покоя с самочувствием, прежде чем оставлять тяжёлую работу на следующий день.");
  }
}

function isDeviceSleepLow(summary: DeviceHealthDailySummary | null) {
  return Boolean(
    summary?.sleep &&
      (
        (summary.sleep.durationMinutes !== null && summary.sleep.durationMinutes < 360) ||
        (summary.sleep.score !== null && summary.sleep.score < 60)
      ),
  );
}

function isDeviceRestingHrHigh(summary: DeviceHealthDailySummary | null) {
  return Boolean(
    summary?.heartRate?.restingBpm !== null &&
      summary?.heartRate?.restingBpm !== undefined &&
      summary.heartRate.restingBpm >= 80,
  );
}

function getReadinessEntryForDate(
  state: MobileAppState,
  athleteId: string | null,
  date: string,
) {
  const entries = state.data.readinessHistory.length
    ? state.data.readinessHistory
    : state.data.readinessEntry
      ? [state.data.readinessEntry]
      : [];

  return entries.find((entry) =>
    entry.entryDate === date &&
    (!athleteId || entry.athleteId === athleteId)
  ) ?? null;
}

function getDeviceHealthSummaryForDate(
  state: MobileAppState,
  athleteId: string | null,
  date: string,
) {
  return state.data.deviceHealthSummaries
    .filter((summary) =>
      summary.entryDate === date &&
      (!athleteId || summary.athleteId === athleteId)
    )
    .sort(compareDeviceHealthSummaries)[0] ?? null;
}

function getDeviceWorkoutsForDate(
  state: MobileAppState,
  athleteId: string | null,
  date: string,
) {
  return state.data.deviceWorkouts
    .filter((workout) =>
      workout.entryDate === date &&
      (!athleteId || workout.athleteId === athleteId)
    )
    .sort((left, right) => left.startTime.localeCompare(right.startTime));
}

function getDeviceWorkoutLinksForDate(
  state: MobileAppState,
  athleteId: string | null,
  date: string,
) {
  return state.data.deviceWorkoutLinks
    .filter((link) =>
      link.workout.entryDate === date &&
      (!athleteId || link.athleteId === athleteId)
    )
    .sort((left, right) => left.workout.startTime.localeCompare(right.workout.startTime));
}

function getDeviceWorkoutLinkGroupForBlocks(
  links: DeviceWorkoutLink[],
  assignedBlockIds: string[],
) {
  const assignedBlockIdSet = new Set(assignedBlockIds);
  const groupLinks = links.filter((link) => assignedBlockIdSet.has(link.assignedBlockId));
  const workoutIds = Array.from(new Set(groupLinks.map((link) => link.deviceWorkoutId)));
  const commonWorkoutId = workoutIds.length === 1 ? workoutIds[0] : null;
  const linkedWorkout = commonWorkoutId
    ? groupLinks.find((link) => link.deviceWorkoutId === commonWorkoutId)?.workout ?? null
    : null;
  const linkedBlockIds = new Set(
    groupLinks
      .filter((link) => !commonWorkoutId || link.deviceWorkoutId === commonWorkoutId)
      .map((link) => link.assignedBlockId),
  );

  return {
    hasMixedWorkouts: workoutIds.length > 1,
    isFullyLinked: Boolean(commonWorkoutId) &&
      assignedBlockIds.length > 0 &&
      linkedBlockIds.size === assignedBlockIdSet.size,
    isPartiallyLinked: groupLinks.length > 0 &&
      (!commonWorkoutId || linkedBlockIds.size < assignedBlockIdSet.size),
    linkedWorkout,
    links: groupLinks,
  };
}

function isMobileDeviceWorkoutLinkableBlock(
  block: Pick<CoachDayBlockCleanSummary, "name" | "notes" | "rowKind">,
) {
  return isDeviceWorkoutLinkablePlanBlock(block);
}

function isMobileLoadBearingPlanBlock(block: Pick<CoachDayBlockCleanSummary, "rowKind">) {
  return !["instruction", "control", "note", "recovery"].includes(block.rowKind ?? "exercise");
}

function getCoachDeviceWorkoutLinkGroups(blocks: CoachDayBlockCleanSummary[]) {
  const sessionGroups = new Map<string, {
    assignedPlanId: string;
    blocks: CoachDayBlockCleanSummary[];
    deviceLinkMode?: MobileAssignedPlanSession["deviceLinkMode"];
    sessionName: string;
  }>();

  for (const block of blocks) {
    const key = `${block.assignedPlanId}:${block.sessionName}`;
    const group = sessionGroups.get(key);
    if (group) {
      group.blocks.push(block);
    } else {
      sessionGroups.set(key, {
        assignedPlanId: block.assignedPlanId,
        blocks: [block],
        deviceLinkMode: block.sessionDeviceLinkMode,
        sessionName: block.sessionName,
      });
    }
  }

  return Array.from(sessionGroups.values()).flatMap((group) => {
    if (group.deviceLinkMode === "none") {
      return [];
    }

    if (group.deviceLinkMode === "block") {
      return group.blocks
        .filter(isMobileDeviceWorkoutLinkableBlock)
        .map((block) => ({
          assignedBlockIds: [block.assignedBlockId],
          assignedPlanId: group.assignedPlanId,
          blocks: [block],
          description: group.sessionName,
          id: `${group.assignedPlanId}:${block.assignedBlockId}`,
          label: block.name,
        }));
    }

    const linkableBlocks = group.blocks.filter(isMobileDeviceWorkoutLinkableBlock);
    const fallbackBlocks = group.blocks.filter(isMobileLoadBearingPlanBlock);
    const targetBlocks = linkableBlocks.length ? linkableBlocks : fallbackBlocks;

    return targetBlocks.length
      ? [
          {
            assignedBlockIds: targetBlocks.map((block) => block.assignedBlockId),
            assignedPlanId: group.assignedPlanId,
            blocks: group.blocks,
            description: group.blocks.map((block) => block.name).join(" · "),
            id: `${group.assignedPlanId}:${group.sessionName}`,
            label: group.sessionName,
          },
        ]
      : [];
  });
}

function compareDeviceHealthSummaries(
  left: DeviceHealthDailySummary,
  right: DeviceHealthDailySummary,
) {
  const scoreDelta = getDeviceHealthSummaryScore(right) - getDeviceHealthSummaryScore(left);
  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  return right.syncedAt.localeCompare(left.syncedAt);
}

function getDeviceHealthSummaryScore(summary: DeviceHealthDailySummary) {
  return [
    hasDeviceSleepData(summary),
    summary.heartRate?.restingBpm !== null && summary.heartRate?.restingBpm !== undefined,
    Boolean(summary.workout),
  ].filter(Boolean).length;
}

function estimateAssignedBlockLoad(block: AssignedPlanBlock) {
  return estimateTrainingBlockLoad(block);
}

function getExecutionBlockPlannedLoad(
  block: AssignedPlanBlock,
  result: ExecutionResult | null,
) {
  return result?.plannedLoad !== null && result?.plannedLoad !== undefined
    ? roundLoad(result.plannedLoad)
    : estimateAssignedBlockLoad(block);
}

function getExecutionBlockActualLoad(
  block: AssignedPlanBlock,
  result: ExecutionResult | null,
  plannedLoad = getExecutionBlockPlannedLoad(block, result),
) {
  return result?.actualLoad !== null && result?.actualLoad !== undefined
    ? roundLoad(result.actualLoad)
    : estimateExecutionActualLoad(block, result, plannedLoad);
}

function estimateExecutionActualLoad(
  block: AssignedPlanBlock,
  result: ExecutionResult | null,
  plannedLoad: number,
) {
  return estimateTrainingActualLoad({
    assignedExerciseCount: block.exercises?.length ?? 0,
    completed: result?.completed ?? false,
    durationMinutes: result?.durationMinutes ?? null,
    exercises: (block.exercises ?? []).map((exercise) => {
      const exerciseResult = result ? getExerciseResult(result, exercise.id) : null;

      return {
        assignedExerciseId: exercise.id,
        completed: exerciseResult?.completed ?? false,
        durationMinutes: exerciseResult?.durationMinutes ?? null,
        repsCompleted: exerciseResult?.repsCompleted ?? null,
        rpe: exerciseResult?.rpe ?? null,
        setsCompleted: exerciseResult?.setsCompleted ?? null,
        weightKg: exerciseResult?.weightKg ?? null,
      };
    }),
    plannedLoad,
    rpe: result?.rpe ?? null,
  });
}

function getExecutionBlockStatus(
  block: AssignedPlanBlock,
  result: ExecutionResult | null,
): ExecutionDayStatus {
  if (!result) {
    return "missed";
  }

  const exercises = block.exercises ?? [];

  if (exercises.length > 0 && result.exerciseResults?.length) {
    const completedExerciseCount = exercises.filter((exercise) =>
      getExerciseResult(result, exercise.id)?.completed === true
    ).length;

    if (completedExerciseCount >= exercises.length) {
      return "completed";
    }

    if (completedExerciseCount > 0 || hasExecutionResultDetails(result)) {
      return "partial";
    }
  }

  if (result.completed) {
    return "completed";
  }

  return hasExecutionResultDetails(result) ? "partial" : "missed";
}

function hasExecutionResultDetails(result: ExecutionResult) {
  return (
    result.setsCompleted !== null ||
    result.repsCompleted !== null ||
    result.weightKg !== null ||
    result.durationMinutes !== null ||
    result.rpe !== null ||
    result.notes.trim().length > 0 ||
    Boolean(result.exerciseResults?.some((exercise) =>
      exercise.completed ||
      exercise.setsCompleted !== null ||
      exercise.repsCompleted !== null ||
      exercise.weightKg !== null ||
      exercise.durationMinutes !== null ||
      exercise.rpe !== null ||
      exercise.notes.trim().length > 0
    ))
  );
}

function hasExerciseResultDetails(result: ExecutionExerciseResult) {
  return (
    result.setsCompleted !== null ||
    result.repsCompleted !== null ||
    result.weightKg !== null ||
    result.durationMinutes !== null ||
    result.rpe !== null ||
    result.notes.trim().length > 0
  );
}

function getExecutionExerciseStatus(result: ExecutionExerciseResult | null): ExecutionDayStatus {
  if (!result) {
    return "missed";
  }

  return result.completed ? "completed" : hasExerciseResultDetails(result) ? "partial" : "missed";
}

function getExecutionDayStatusLabel(status: ExecutionDayStatus) {
  if (status === "completed") {
    return "Выполнено";
  }

  if (status === "partial") {
    return "Частично";
  }

  return "Не выполнено";
}

function getCoachTodayDayStatusLabel(status: CoachTodayDayStatus) {
  if (status === "no-plan") {
    return "Нет плана";
  }

  return getExecutionDayStatusLabel(status);
}

function roundLoad(value: number) {
  return Number(value.toFixed(1));
}

function sortPlansForExecution(plans: AssignedPlanSummary[]) {
  const today = todayValue();

  return plans.slice().sort((left, right) => {
    const leftRank = getExecutionDateRank(left.day.dayDate, today);
    const rightRank = getExecutionDateRank(right.day.dayDate, today);

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return leftRank === 2
      ? right.day.dayDate.localeCompare(left.day.dayDate)
      : left.day.dayDate.localeCompare(right.day.dayDate);
  });
}

function getExecutionDateRank(dayDate: string, today: string) {
  if (dayDate === today) {
    return 0;
  }

  return dayDate > today ? 1 : 2;
}

function getExecutionBlockItems(plans: AssignedPlanSummary[]): ExecutionBlockItem[] {
  return plans.flatMap((plan) =>
    plan.day.sessions.flatMap((session) =>
      session.blocks.map((block) => ({
        block,
        plan,
        sessionDeviceLinkMode: session.deviceLinkMode,
        sessionName: session.name,
      })),
    ),
  );
}

function getExecutionResultForBlock(
  state: MobileAppState,
  assignedPlanId: string,
  assignedBlockId: string,
) {
  return state.data.executionResults.find((result) =>
    result.assignedPlanId === assignedPlanId && result.assignedBlockId === assignedBlockId
  ) ?? null;
}

function getExerciseResult(
  result: ExecutionResult | null,
  assignedExerciseId: string,
) {
  return result?.exerciseResults?.find((exercise) =>
    exercise.assignedExerciseId === assignedExerciseId
  ) ?? null;
}

function getCoachDiaryEntriesForPlan(state: MobileAppState, assignedPlanId: string) {
  return state.data.coachDiaryEntries
    .filter((entry) => entry.assignedPlanId === assignedPlanId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function getCoachDiaryEntriesForAthlete(state: MobileAppState, athleteId: string | null) {
  return state.data.coachDiaryEntries.filter((entry) =>
    !athleteId || entry.athleteId === athleteId
  );
}

function getCoachDiaryEntriesForAthleteDate(
  state: MobileAppState,
  athleteId: string,
  entryDate: string,
) {
  return getCoachDiaryEntriesForAthlete(state, athleteId)
    .filter((entry) => entry.entryDate === entryDate)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function formatCoachDiaryEntryTarget(state: MobileAppState, entry: CoachDiaryEntry) {
  if (entry.scope === "day") {
    return "весь день";
  }

  const plan = state.data.assignedPlans.find((assignedPlan) => assignedPlan.id === entry.assignedPlanId);
  const names = plan
    ? getCoachDiaryTargetNames(plan, entry)
    : [];

  if (names.length > 0) {
    return names.slice(0, 3).join(" · ");
  }

  const taskCount = entry.assignedBlockIds.length + entry.assignedExerciseIds.length;
  return taskCount > 0 ? `заданий: ${taskCount}` : "по заданиям";
}

function getCoachDiaryTargetNames(plan: AssignedPlanSummary, entry: CoachDiaryEntry) {
  const blockIds = new Set(entry.assignedBlockIds);
  const exerciseIds = new Set(entry.assignedExerciseIds);
  const names: string[] = [];

  for (const session of plan.day.sessions) {
    for (const block of session.blocks) {
      if (blockIds.has(block.id)) {
        names.push(block.name);
      }

      for (const exercise of block.exercises ?? []) {
        if (exerciseIds.has(exercise.id)) {
          names.push(exercise.name);
        }
      }
    }
  }

  return names;
}

function countPlanExercises(plan: AssignedPlanSummary) {
  return plan.day.sessions.reduce((sessionTotal, session) =>
    sessionTotal + session.blocks.reduce((blockTotal, block) =>
      blockTotal + (block.exercises?.length ?? 0),
    0),
  0);
}

function formatAssignedPlanDayFocus(plan: AssignedPlanSummary) {
  return cleanAssignedPlanNotes(plan.day.notes) || plan.plannedPhase || "план";
}

function cleanAssignedPlanNotes(notes?: string | null) {
  const parts = splitExerciseNoteParts(notes).filter((part) =>
    !/^(?:imported from|импорт(?:ировано)?\s+(?:из|от)\s+файла)/iu.test(part),
  );

  return parts.join(" / ");
}

function splitExerciseNoteParts(notes?: string | null) {
  return (notes ?? "")
    .split(/\s*\/\s*/u)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function inferExerciseWorkDisplayUnit(name: string, value: string) {
  const normalized = `${name} ${value}`.toLowerCase();

  if (!/\d+\s*[xх×*]\s*\d/u.test(normalized) || /(?:сек|sec|s\b|мин|min|m\b)/iu.test(normalized)) {
    return null;
  }

  if (/(?:ускор|спринт|скорост|рывок|отрез|прыж|shuttle|sprint|speed)/iu.test(normalized)) {
    return "сек";
  }

  if (/(?:схват|раунд|спарр|борьб|round|sparring)/iu.test(normalized)) {
    return "мин";
  }

  return null;
}

function getExerciseStandaloneDurationUnit(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim().toLowerCase();

  if (/^(?:сек|s|sec)\.?$/iu.test(normalized)) {
    return "сек";
  }

  if (/^(?:мин|m|min)\.?$/iu.test(normalized)) {
    return "мин";
  }

  return null;
}

function isExerciseVolumeNote(value: string) {
  return /\d/u.test(value) && (
    /\d+\s*[xх×*]\s*\d/iu.test(value) ||
    /(?:сек|sec|s\b|мин|min|m\b|км|km|кг|kg|м\b|подх|повт|reps|sets)/iu.test(value)
  );
}

function normalizeExerciseWorkDisplay(name: string, value: string) {
  const inferredUnit = inferExerciseWorkDisplayUnit(name, value);

  if (!inferredUnit) {
    return value;
  }

  return value.replace(
    /(\d+)\s*[xх×*]\s*(\d+(?:[.,]\d+)?)(?!\s*(?:сек|s|sec|мин|m|min)\b)/iu,
    `$1×$2 ${inferredUnit}`,
  );
}

function formatExerciseDurationValue(value: number) {
  const rounded = Math.round(value * 10) / 10;

  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatStructuredSetDurationWork(exercise: AssignedBlockExercise) {
  if (
    exercise.targetSets === null ||
    exercise.targetReps !== null ||
    exercise.targetDurationMinutes === null ||
    exercise.targetSets <= 0 ||
    exercise.targetDurationMinutes <= 0
  ) {
    return null;
  }

  const displayUnit = inferExerciseWorkDisplayUnit(exercise.name, `${exercise.targetSets}×1`);

  if (!displayUnit) {
    return null;
  }

  const perSetValue =
    displayUnit === "сек"
      ? (exercise.targetDurationMinutes * 60) / exercise.targetSets
      : exercise.targetDurationMinutes / exercise.targetSets;

  return `${exercise.targetSets}×${formatExerciseDurationValue(perSetValue)} ${displayUnit}`;
}

function getExerciseWorkNotePart(exercise: AssignedBlockExercise, noteParts: string[]) {
  const firstNotePart = noteParts[0];

  if (!firstNotePart || !isExerciseVolumeNote(firstNotePart)) {
    return null;
  }

  return normalizeExerciseWorkDisplay(exercise.name, firstNotePart);
}

function formatExerciseWorkCell(exercise: AssignedBlockExercise) {
  const noteParts = splitExerciseNoteParts(exercise.notes);
  const workNotePart = getExerciseWorkNotePart(exercise, noteParts);
  const structuredSetDuration = formatStructuredSetDurationWork(exercise);

  if (workNotePart) {
    return workNotePart;
  }

  if (structuredSetDuration) {
    return structuredSetDuration;
  }

  if (exercise.targetSets !== null && exercise.targetReps !== null) {
    return `${exercise.targetSets}×${exercise.targetReps}`;
  }

  if (exercise.targetSets !== null) {
    return `${exercise.targetSets} подх.`;
  }

  if (exercise.targetReps !== null) {
    return `${exercise.targetReps} повт.`;
  }

  if (noteParts[0]) {
    return noteParts[0];
  }

  if (exercise.targetDurationMinutes !== null) {
    return `${exercise.targetDurationMinutes} мин.`;
  }

  return "-";
}

function formatExerciseControlCell(exercise: AssignedBlockExercise) {
  const noteParts = splitExerciseNoteParts(exercise.notes);
  const workNotePart = getExerciseWorkNotePart(exercise, noteParts);
  const inferredWorkUnit =
    workNotePart && workNotePart !== noteParts[0]
      ? inferExerciseWorkDisplayUnit(exercise.name, noteParts[0] ?? "")
      : null;
  const rawControlParts = noteParts.length > 1 ? noteParts.slice(1) : [];
  const controlParts = inferredWorkUnit
    ? rawControlParts.filter((part) => getExerciseStandaloneDurationUnit(part) !== inferredWorkUnit)
    : rawControlParts;

  if (exercise.targetWeightKg !== null) {
    controlParts.unshift(`${exercise.targetWeightKg} кг`);
  }

  if (exercise.targetRpe !== null) {
    controlParts.push(`RPE ${exercise.targetRpe}`);
  }

  if (controlParts.length === 0 && noteParts.length === 1 && exercise.targetDurationMinutes === null) {
    controlParts.push(noteParts[0]);
  }

  return controlParts.length ? controlParts.join(" / ") : "-";
}

function formatBlockTarget(block: AssignedPlanBlock) {
  const parts = [
    block.targetSets ? `${block.targetSets} подх.` : "",
    block.targetReps ? `${block.targetReps} повт.` : "",
    block.targetDurationMinutes ? `${block.targetDurationMinutes} мин.` : "",
    block.targetRpe ? `RPE ${block.targetRpe}` : "",
  ].filter(Boolean);

  return parts.join(" · ") || "без целевых значений";
}

function formatExerciseTarget(exercise: AssignedBlockExercise) {
  const noteParts = splitExerciseNoteParts(exercise.notes);
  const workNotePart = getExerciseWorkNotePart(exercise, noteParts);
  const workNoteSource = workNotePart ? noteParts[0] : null;
  const structuredSetDuration = formatStructuredSetDurationWork(exercise);
  const inferredWorkUnit =
    workNotePart && workNotePart !== workNoteSource
      ? inferExerciseWorkDisplayUnit(exercise.name, workNoteSource ?? "")
      : null;
  const parts = [
    workNotePart || structuredSetDuration || (exercise.targetSets ? `${exercise.targetSets} подх.` : ""),
    workNotePart || !exercise.targetReps ? "" : `${exercise.targetReps} повт.`,
    exercise.targetWeightKg ? `${exercise.targetWeightKg} кг` : "",
    exercise.targetDurationMinutes && !workNotePart && !structuredSetDuration ? `${exercise.targetDurationMinutes} мин.` : "",
    exercise.targetRpe ? `RPE ${exercise.targetRpe}` : "",
    ...noteParts.filter(
      (part) =>
        part !== workNoteSource &&
        part !== workNotePart &&
        (!inferredWorkUnit || getExerciseStandaloneDurationUnit(part) !== inferredWorkUnit),
    ),
  ].filter(Boolean);

  return parts.join(" · ") || "плановые значения не заданы";
}

function formatReadinessStatus(status: string) {
  if (status === "green") {
    return "готов";
  }

  if (status === "yellow") {
    return "снизить нагрузку";
  }

  if (status === "red") {
    return "восстановление";
  }

  return status;
}

function formatReadinessHistoryDetails(entry: ReadinessEntry) {
  const flags = [
    entry.fatigueLevel >= 4 ? "усталость" : "",
    entry.muscleSoreness >= 4 ? "мышцы" : "",
    entry.painLevel >= 5 ? "боль" : "",
    entry.illnessFlag ? "болезнь" : "",
    entry.feverFlag ? "температура" : "",
  ].filter(Boolean);

  return flags.length
    ? flags.join(" · ")
    : `сон ${entry.sleepHours} ч · пульс ${entry.restingHr}`;
}

function formatReadinessFlags(entry: ReadinessEntry) {
  const flags = [
    entry.illnessFlag ? "болезнь" : "",
    entry.feverFlag ? "температура" : "",
    entry.painLevel >= 5 ? "боль" : "",
    entry.fatigueLevel >= 4 ? "высокая усталость" : "",
    entry.muscleSoreness >= 4 ? "мышцы перегружены" : "",
  ].filter(Boolean);

  return flags.length ? flags.join(" · ") : "без красных флагов";
}

function formatReadinessNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatCoachTodayPlanCount(summary: CoachTodayDaySummary) {
  if (summary.planCount === 0) {
    return "нет плана";
  }

  return `${summary.planCount} ${formatAssignedDayCountLabel(summary.planCount)}`;
}

function formatCoachTodayPlanNames(summary: CoachTodayDaySummary) {
  if (summary.templateNames.length === 0) {
    return summary.planCount > 0 ? `${summary.sessionCount} сесс.` : "на сегодня не назначено";
  }

  return summary.templateNames.slice(0, 2).join(" · ");
}

function formatCoachTodayBlockBreakdown(summary: CoachTodayDaySummary) {
  if (summary.blockCount === 0) {
    return "нет блоков";
  }

  return `${summary.completedBlockCount} вып. · ${summary.partialBlockCount} част. · ${summary.missedBlockCount} нет`;
}

function formatCoachTodayExerciseBreakdown(summary: CoachTodayDaySummary) {
  if (summary.exerciseCount === 0) {
    return summary.blockCount > 0 ? "упражнения не заданы" : "нет заданий";
  }

  return `${summary.completedExerciseCount} вып. · ${summary.partialExerciseCount} част. · ${summary.missedExerciseCount} нет`;
}

function formatCoachTodayLoadDelta(summary: CoachTodayDaySummary) {
  if (summary.planCount === 0) {
    return "нет плановой нагрузки";
  }

  const delta = roundLoad(summary.actualLoad - summary.plannedLoad);

  if (delta === 0) {
    return summary.actualLoad > 0 ? "факт совпадает с планом" : "выполнение ещё не отмечено";
  }

  return delta > 0 ? `+${delta} к плану` : `${delta} к плану`;
}

function formatInputValue(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function formatLoadValue(value: number) {
  return value > 0 ? String(roundLoad(value)) : "0";
}

function formatDurationHours(minutes: number) {
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} ч`;
}

function formatExecutionDayBreakdown(summary: ExecutionDaySummary) {
  return `${summary.completedBlockCount} вып. · ${summary.partialBlockCount} част. · ${summary.missedBlockCount} нет`;
}

function formatExecutionDisplayBreakdown(completion: ExecutionDisplayCompletion) {
  return `${completion.completedCount} вып. · ${completion.partialCount} част. · ${completion.missedCount} нет`;
}

function formatExecutionLoadDelta(summary: ExecutionDaySummary) {
  const delta = roundLoad(summary.actualLoad - summary.plannedLoad);

  if (delta === 0) {
    return "по плану";
  }

  return delta > 0 ? `+${delta} к плану` : `${delta} к плану`;
}

function formatExecutionBlockLoadDelta(actualLoad: number, plannedLoad: number) {
  const delta = roundLoad(actualLoad - plannedLoad);

  if (delta === 0) {
    return "блок по плану";
  }

  return delta > 0 ? `+${delta} к плану блока` : `${delta} к плану блока`;
}

function formatExerciseActualDetails(result: ExecutionExerciseResult | null) {
  if (!result) {
    return "нет отметки";
  }

  const parts = [
    result.completed ? "отмечено" : "",
    result.setsCompleted !== null ? `${result.setsCompleted} подх.` : "",
    result.repsCompleted !== null ? `${result.repsCompleted} повт.` : "",
    result.weightKg !== null ? `${result.weightKg} кг` : "",
    result.durationMinutes !== null ? `${result.durationMinutes} мин.` : "",
    result.rpe !== null ? `RPE ${result.rpe}` : "",
    result.notes.trim() ? result.notes.trim() : "",
  ].filter(Boolean);

  return parts.length ? parts.join(" · ") : "есть строка, но факт не заполнен";
}

function formatAssignedDayCountLabel(count: number) {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return "назначенных дней";
  }

  if (lastDigit === 1) {
    return "назначенный день";
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return "назначенных дня";
  }

  return "назначенных дней";
}

function formatExecutionHistoryDetails(result: ExecutionResult) {
  if (!result.exerciseResults?.length) {
    return result.notes || "Без заметки";
  }

  const completed = result.exerciseResults.filter((exercise) =>
    getExecutionExerciseStatus(exercise) === "completed"
  ).length;
  const partial = result.exerciseResults.filter((exercise) =>
    getExecutionExerciseStatus(exercise) === "partial"
  ).length;
  const missed = Math.max(result.exerciseResults.length - completed - partial, 0);

  return `Упражнения: ${completed} вып. · ${partial} част. · ${missed} нет`;
}

function formatExecutionResultStatus(result: ExecutionResult | null) {
  if (!result) {
    return "выполнение не отправлено";
  }

  return result.completed
    ? "выполнено"
    : hasExecutionResultDetails(result)
      ? "частично"
      : "не выполнено";
}

function formatExerciseResultStatus(result: ExecutionExerciseResult | null) {
  if (!result) {
    return "нет отметки";
  }

  return result.completed
    ? "выполнено"
    : hasExerciseResultDetails(result)
      ? "частично"
      : "не выполнено";
}

function getCompetitionPlansForAthlete(state: MobileAppState, athleteId: string | null) {
  return state.data.competitionPlans.filter((plan) => !athleteId || plan.athleteId === athleteId);
}

function getReadinessHistory(state: MobileAppState) {
  const entries = state.data.readinessHistory.length
    ? state.data.readinessHistory
    : state.data.readinessEntry
      ? [state.data.readinessEntry]
      : [];

  return entries
    .slice()
    .sort((left, right) => right.entryDate.localeCompare(left.entryDate))
    .slice(0, 10);
}

function getNextCompetitionPlan(plans: CompetitionPlanSummary[]) {
  const today = todayValue();
  return plans
    .filter((plan) => plan.competitionStartDate >= today)
    .sort((a, b) => a.competitionStartDate.localeCompare(b.competitionStartDate))[0] ?? null;
}

function daysUntil(dateValue: string) {
  const start = new Date(`${todayValue()}T00:00:00.000Z`).getTime();
  const end = new Date(`${dateValue}T00:00:00.000Z`).getTime();

  if (Number.isNaN(end)) {
    return "-";
  }

  return String(Math.round((end - start) / 86400000));
}

function upsertById<T extends { id: string }>(items: T[], item: T) {
  const nextItems = items.filter((value) => value.id !== item.id);
  nextItems.unshift(item);
  return nextItems;
}

function upsertCoachAiReviewHistory(items: CoachDayAiReview[], review: CoachDayAiReview) {
  const nextItems = review.id
    ? items.filter((item) => item.id !== review.id)
    : items.filter((item) =>
      item.athleteId !== review.athleteId ||
      item.entryDate !== review.entryDate ||
      item.generatedAt !== review.generatedAt
    );

  nextItems.unshift(review);
  return nextItems
    .filter((item) => item.source !== "local-rules")
    .sort(sortCoachAiReviewsNewestFirst)
    .slice(0, 300);
}

function upsertDeviceHealthSummary(
  items: DeviceHealthDailySummary[],
  summary: DeviceHealthDailySummary,
) {
  const nextItems = items.filter((item) =>
    item.id !== summary.id &&
    (item.athleteId !== summary.athleteId ||
      item.provider !== summary.provider ||
      item.entryDate !== summary.entryDate)
  );
  nextItems.unshift(summary);
  return nextItems
    .sort((left, right) => right.entryDate.localeCompare(left.entryDate))
    .slice(0, 120);
}

function upsertDeviceWorkouts(items: DeviceWorkout[], workouts: DeviceWorkout[]) {
  const nextItems = items.filter((item) => !workouts.some((workout) =>
    workout.id === item.id ||
    (workout.athleteId === item.athleteId &&
      workout.provider === item.provider &&
      workout.sourceWorkoutId === item.sourceWorkoutId)
  ));
  nextItems.unshift(...workouts);
  return nextItems
    .sort((left, right) =>
      right.entryDate.localeCompare(left.entryDate) || right.startTime.localeCompare(left.startTime),
    )
    .slice(0, 200);
}

function upsertDeviceWorkoutLinks(items: DeviceWorkoutLink[], links: DeviceWorkoutLink[]) {
  const nextItems = items.filter((item) => !links.some((link) =>
    link.id === item.id ||
    (link.athleteId === item.athleteId &&
      link.assignedBlockId === item.assignedBlockId &&
      link.deviceWorkoutId === item.deviceWorkoutId)
  ));
  nextItems.unshift(...links);
  return nextItems.slice(0, 200);
}

function upsertExecutionResult(items: ExecutionResult[], result: ExecutionResult) {
  const nextItems = items.filter((item) =>
    item.id !== result.id &&
    (item.assignedPlanId !== result.assignedPlanId ||
      item.assignedBlockId !== result.assignedBlockId)
  );
  nextItems.unshift(result);
  return nextItems;
}

function upsertReadinessHistory(items: ReadinessEntry[], entry: ReadinessEntry) {
  const nextItems = items.filter((item) => item.entryDate !== entry.entryDate);
  nextItems.unshift(entry);
  return nextItems
    .sort((left, right) => right.entryDate.localeCompare(left.entryDate))
    .slice(0, 14);
}

function readString(form: HTMLFormElement, name: string) {
  return String(new FormData(form).get(name) ?? "").trim();
}

function readStringList(form: HTMLFormElement, name: string) {
  return new FormData(form)
    .getAll(name)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function readNumber(form: HTMLFormElement, name: string, fallback: number) {
  const value = Number(new FormData(form).get(name));
  return Number.isFinite(value) ? value : fallback;
}

function readOptionalNumber(form: HTMLFormElement, name: string) {
  const value = readString(form, name);
  const numericValue = Number(value);
  return value === "" || !Number.isFinite(numericValue) ? null : numericValue;
}

function readCheckbox(form: HTMLFormElement, name: string) {
  return new FormData(form).get(name) === "on";
}

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDateValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : value;
}

function addDays(value: string, days: number) {
  const normalizedDate = normalizeDateValue(value) ?? todayValue();
  const date = new Date(`${normalizedDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + (Number.isFinite(days) ? days : 0));
  return date.toISOString().slice(0, 10);
}

function formatDayRelativeLabel(value: string) {
  const normalizedDate = normalizeDateValue(value) ?? todayValue();
  const selectedTime = new Date(`${normalizedDate}T00:00:00.000Z`).getTime();
  const todayTime = new Date(`${todayValue()}T00:00:00.000Z`).getTime();
  const diffDays = Math.round((selectedTime - todayTime) / 86400000);

  if (diffDays === -1) {
    return "Вчера";
  }

  if (diffDays === 0) {
    return "Сегодня";
  }

  if (diffDays === 1) {
    return "Завтра";
  }

  return "Выбранный день";
}

function formatDate(value: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ru", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatShortDate(value: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ru", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ru", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatTimeRange(start: string, end: string) {
  return `${formatTime(start)}-${formatTime(end)}`;
}

function getRoleLabel(role: string | undefined) {
  if (role === "coach") {
    return "Тренер";
  }

  if (role === "admin") {
    return "Администратор";
  }

  return "Спортсмен";
}

function toFriendlyError(error: unknown) {
  if (error instanceof MobileApiError) {
    if (error.statusCode === null) {
      return "Нет соединения с сервером. Можно работать с сохранёнными данными.";
    }

    return translateApiErrorMessage(error.message);
  }

  return error instanceof Error ? translateApiErrorMessage(error.message) : "Неизвестная ошибка";
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
