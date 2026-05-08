import { MobileApiClient, MobileApiError } from "../api/client.js";
import {
  canSubmitSyncAction,
  getSyncActionRestrictionMessage,
  translateApiErrorMessage,
} from "../permissions.js";
import { readRuntimeConfig } from "../config.js";
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
const mobileLoadBlockProfiles: Record<AssignedPlanBlock["blockType"], { durationMinutes: number; rpe: number }> = {
  CNS_high: { durationMinutes: 24, rpe: 8 },
  activation: { durationMinutes: 14, rpe: 4 },
  conditioning: { durationMinutes: 32, rpe: 6.5 },
  metabolic: { durationMinutes: 26, rpe: 8.5 },
  mobility: { durationMinutes: 18, rpe: 2.5 },
  recovery: { durationMinutes: 20, rpe: 2.5 },
  speed: { durationMinutes: 22, rpe: 7.5 },
  strength: { durationMinutes: 30, rpe: 7 },
  technical: { durationMinutes: 35, rpe: 5 },
};
const defaultMobileLoadProfile = { durationMinutes: 20, rpe: 5 };

export function bootstrapMobileApp(root: HTMLElement) {
  const initialData = loadSnapshot();
  const state: MobileAppState = {
    session: loadSession(runtimeConfig.apiBaseUrl),
    data: initialData,
    queue: loadQueue(),
    coachAiDiagnostic: null,
    coachAiStatus: null,
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
        api.loadAppData(auth.user.role),
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
    const forms = Array.from(group?.querySelectorAll<HTMLFormElement>("[data-execution-form]") ?? []);

    if (forms.length === 0) {
      update({ error: "Нет блоков для сохранения." });
      return;
    }

    const payloads: ExecutionResultInput[] = [];

    for (const form of forms) {
      const payload = readExecutionPayload(form);

      if (!payload) {
        return;
      }

      payloads.push(payload);
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
        message: `Сохранено локально: ${payloads.length} блоков. Отправим при появлении интернета.`,
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
        message: `Сохранено выполнение: ${savedResults.length} блоков.`,
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

    root.querySelector<HTMLButtonElement>("[data-refresh]")?.addEventListener("click", () => {
      void refreshData();
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

    root.querySelectorAll<HTMLButtonElement>("[data-readiness-preset]").forEach((button) => {
      button.addEventListener("click", () => {
        const form = button.closest("form");

        if (form instanceof HTMLFormElement) {
          applyReadinessPreset(form, button.dataset.readinessPreset ?? "normal");
        }
      });
    });

    root.querySelectorAll<HTMLFormElement>("[data-execution-form]").forEach((form) => {
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
      <div class="coach-day-status-grid">
        ${renderCoachExecutionReviewMetric("Готовность", readiness ? String(readiness.score) : "-", readiness ? formatReadinessStatus(readiness.status) : "спортсмен не отправил")}
        ${renderCoachExecutionReviewMetric("Плановая нагрузка", formatLoadValue(summary.plannedLoad), formatCoachTodayPlanNames(summary))}
        ${renderCoachExecutionReviewMetric("Фактическая нагрузка", formatLoadValue(summary.actualLoad), formatCoachTodayLoadDelta(summary))}
        ${renderCoachExecutionReviewMetric("Выполнение", `${summary.completedExerciseCount}/${summary.exerciseCount || 0}`, formatCoachTodayExerciseBreakdown(summary))}
        ${renderCoachExecutionReviewMetric("Сон", formatDeviceHealthSleepValue(deviceHealth), formatDeviceHealthSleepDetail(deviceHealth))}
        ${renderCoachExecutionReviewMetric("Пульс покоя", formatDeviceHealthRestingHrValue(deviceHealth), formatDeviceHealthHeartRateDetail(deviceHealth))}
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
            <p>${escapeHtml(block.sessionName)} · ${escapeHtml(block.name)} · ${escapeHtml(exercise.plannedWork || "-")}</p>
          </article>
        `).join("")}
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

    return { aiReview, athlete, dataQuality, dayData };
  });

  return `
    <section class="coach-team-day-panel">
      <div class="summary-inline-head">
        <div>
          <span>Команда сегодня</span>
          <h3>${formatDate(selectedDayDate)}</h3>
        </div>
        <strong>${rows.length}</strong>
      </div>
      <div class="coach-team-day-list">
        ${rows.map(({ aiReview, athlete, dataQuality, dayData }) => `
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
            </div>
            <p>${escapeHtml(aiReview?.riskNotes[0] ?? formatCoachAiBriefDetail(aiReview))}</p>
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
  const canSync = state.session.user?.role === "athlete" &&
    state.session.user.athleteId === athleteId;
  const syncLabel = formatDeviceHealthSyncLabel(summary);
  const status = getDeviceHealthStatus(summary);

  return `
    <section class="device-health-card">
      <div class="device-health-head">
        <div>
          <span>Huawei Health</span>
          <h3>Данные устройства</h3>
          <p>${escapeHtml(formatDate(date))} · ${escapeHtml(syncLabel)}</p>
        </div>
        ${canSync ? `
          <button class="secondary-action" data-huawei-health-sync data-huawei-health-date="${escapeHtml(date)}" type="button" ${state.isBusy ? "disabled" : ""}>
            Синхронизировать
          </button>
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
      <p class="device-health-guidance">
        Данные устройства не заменяют отметки выполнения. Они помогают тренеру сопоставить план, факт, сон, пульс и внешнюю активность за выбранный день.
      </p>
    </section>
  `;
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
      : "Попросите спортсмена синхронизировать Huawei Health за этот день.";
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
  return summary?.heartRate?.restingBpm !== null && summary?.heartRate?.restingBpm !== undefined
    ? `${formatLoadValue(summary.heartRate.restingBpm)}`
    : "-";
}

function formatDeviceHealthHeartRateDetail(summary: DeviceHealthDailySummary | null) {
  if (!summary?.heartRate) {
    return "пульс не пришёл";
  }

  const parts = [
    summary.heartRate.averageBpm !== null ? `средний ${formatLoadValue(summary.heartRate.averageBpm)}` : null,
    summary.heartRate.minBpm !== null ? `мин ${formatLoadValue(summary.heartRate.minBpm)}` : null,
    summary.heartRate.maxBpm !== null ? `макс ${formatLoadValue(summary.heartRate.maxBpm)}` : null,
  ].filter((item): item is string => Boolean(item));

  return parts.length ? parts.join(" · ") : "нет пульса покоя";
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
  return `
    <section class="coach-ai-review-card">
      <div class="coach-ai-review-head">
        <div>
          <span>Разбор ИИ</span>
          <h3>Черновая рекомендация</h3>
          <p>Онлайн отправляется только карточка дня без email/userId. План и дневник не меняются.</p>
        </div>
        <button class="secondary-action" data-ai-athlete-id="${escapeHtml(dayData.athleteId)}" data-ai-date="${escapeHtml(dayData.date)}" data-generate-coach-ai-review type="button" ${isBusy ? "disabled" : ""}>
          ${isBusy ? "Формируется..." : "Сформировать рекомендацию"}
        </button>
      </div>
      ${renderCoachAiReviewStatus(status, diagnostic, isBusy)}
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
}

interface CoachDayBlockCleanSummary {
  assignedPlanId: string;
  assignedBlockId: string;
  planName: string;
  sessionName: string;
  name: string;
  target: string;
  notes: string;
  status: ExecutionDayStatus;
  statusLabel: string;
  plannedLoad: number;
  actualLoad: number;
  loadDeltaLabel: string;
  exercises: CoachDayExerciseCleanSummary[];
}

interface CoachDayCleanSummary {
  athlete: CoachAthleteSummary | null;
  athleteId: string;
  athleteName: string;
  date: string;
  deviceHealthSummary: DeviceHealthDailySummary | null;
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
  const totalBlockCount = allPlanGroups.reduce((total, group) => total + group.blockItems.length, 0);
  const blockCount = planGroups.reduce((total, group) => total + group.blockItems.length, 0);
  const exerciseCount = planGroups.reduce(
    (total, group) =>
      total + group.blockItems.reduce(
        (blockTotal, item) => blockTotal + (item.block.exercises?.length ?? 0),
        0,
      ),
    0,
  );

  if (totalBlockCount === 0) {
    return renderEmpty("Нет блоков для результата", "Назначенный план появится после обновления данных.");
  }

  return `
    <section class="execution-panel">
      <div class="section-title">
        <h3>${canSubmitExecution ? "Выполнение тренировки" : "Дни по плану"}</h3>
        <p>${canSubmitExecution
          ? `${plans.length} назначенных дней · ${blockCount} блоков · ${exerciseCount} упражнений. Ближайший день открыт сверху.`
          : `Режим просмотра · ${formatDate(selectedDate)} · ${blockCount} блоков · ${exerciseCount} упражнений.`}</p>
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

function renderExecutionPlanGroup(
  state: MobileAppState,
  group: ExecutionPlanGroup,
  isOpen: boolean,
  canSubmitExecution: boolean,
) {
  const blockCount = group.blockItems.length;
  const canSubmitCoachDiary = state.session.user?.role === "coach" || state.session.user?.role === "admin";
  const diaryEntries = getCoachDiaryEntriesForPlan(state, group.plan.id);
  const daySummary = getExecutionDaySummary(state, group, diaryEntries);
  const exerciseCount = group.blockItems.reduce(
    (total, item) => total + (item.block.exercises?.length ?? 0),
    0,
  );

  return `
    <details class="execution-plan-group mobile-plan-day-card mobile-execution-day-card" data-execution-plan-group ${isOpen ? "open" : ""}>
      <summary class="mobile-plan-day-card-head">
        <div>
          <strong>${formatDate(group.plan.day.dayDate)} · ${escapeHtml(group.plan.day.label)}</strong>
          <span>${escapeHtml(group.plan.templateName)} · ${blockCount} блоков · ${exerciseCount} упр.</span>
          <div class="execution-day-meta">
            <span class="execution-day-status is-${daySummary.status}">${escapeHtml(daySummary.statusLabel)}</span>
            <span>Факт нагрузки: ${formatLoadValue(daySummary.actualLoad)}</span>
            <span>План: ${formatLoadValue(daySummary.plannedLoad)}</span>
          </div>
        </div>
        <em>${daySummary.completedBlockCount}/${blockCount}</em>
      </summary>
      <div class="mobile-plan-day-card-body">
        ${renderExecutionDayAnalyticsCard(daySummary)}
        ${group.plan.day.sessions.map((session) => `
          <section class="mobile-plan-session">
            <h4>${escapeHtml(session.name)}</h4>
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

function renderExecutionDayAnalyticsCard(summary: ExecutionDaySummary) {
  return `
    <aside class="execution-day-analytics-card">
      <div class="execution-day-analytics-head">
        <strong>Аналитика дня</strong>
        <span>${escapeHtml(summary.statusLabel)}</span>
      </div>
      <div class="execution-day-analytics-grid">
        <div class="execution-day-analytics-metric">
          <span>Выполнение</span>
          <strong>${summary.completedBlockCount}/${summary.completedBlockCount + summary.partialBlockCount + summary.missedBlockCount}</strong>
          <small>${escapeHtml(formatExecutionDayBreakdown(summary))}</small>
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
  const blocks = plan.day.sessions.flatMap((session) => session.blocks);
  const exerciseCount = countPlanExercises(plan);
  const dayFocus = formatAssignedPlanDayFocus(plan);

  return `
    <article class="mobile-plan-day-card plan-card">
      <header class="mobile-plan-day-card-head">
        <div>
          <strong>${formatDate(plan.day.dayDate)} · ${escapeHtml(plan.day.label)}</strong>
          <span>${escapeHtml(plan.templateName)} · ${blocks.length} блоков · ${exerciseCount} упражнений</span>
        </div>
        ${isCoachView
          ? `<button class="mobile-plan-open-day" data-coach-open-day="${escapeHtml(plan.day.dayDate)}" data-coach-open-screen="dashboard" type="button">Открыть день</button>`
          : `<em>${escapeHtml(dayFocus)}</em>`}
      </header>
      <div class="mobile-plan-day-card-body">
        ${plan.day.sessions.map((session) => `
          <section class="mobile-plan-session">
            <h4>${escapeHtml(session.name)}</h4>
            <div class="mobile-plan-table">
              <div class="mobile-plan-table-head">
                <span>Упр.</span>
                <span>Подходы</span>
                <span>Контр.</span>
              </div>
              ${session.blocks.map((block) => renderPlanBlock(block)).join("")}
            </div>
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
  let actualLoad = 0;

  for (const group of groups) {
    sessionCount += group.plan.day.sessions.length;

    for (const item of group.blockItems) {
      const result = getExecutionResultForBlock(state, item.plan.id, item.block.id);
      const blockPlannedLoad = getExecutionBlockPlannedLoad(item.block, result);
      const blockStatus = getExecutionBlockStatus(item.block, result);
      const exercises = item.block.exercises ?? [];

      blockCount += 1;
      plannedLoad += blockPlannedLoad;
      actualLoad += getExecutionBlockActualLoad(item.block, result, blockPlannedLoad);

      if (blockStatus === "completed") {
        completedBlockCount += 1;
      } else if (blockStatus === "partial") {
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

  return {
    actualLoad: roundLoad(actualLoad),
    blockCount,
    completedBlockCount,
    completedExerciseCount,
    date,
    exerciseCount,
    latestDiaryEntry: diaryEntries[0] ?? null,
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
  let hasExecutionMarks = false;
  const blocks = groups.flatMap((group) =>
    group.blockItems.map((item) => {
      const result = getExecutionResultForBlock(state, item.plan.id, item.block.id);
      hasExecutionMarks = hasExecutionMarks || Boolean(result);
      const plannedLoad = getExecutionBlockPlannedLoad(item.block, result);
      const actualLoad = getExecutionBlockActualLoad(item.block, result, plannedLoad);
      const status = getExecutionBlockStatus(item.block, result);
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
          };
        });

      return {
        actualLoad: roundLoad(actualLoad),
        assignedBlockId: item.block.id,
        assignedPlanId: item.plan.id,
        exercises,
        loadDeltaLabel: formatExecutionBlockLoadDelta(actualLoad, plannedLoad),
        name: item.block.name,
        notes: item.block.notes,
        plannedLoad: roundLoad(plannedLoad),
        planName: item.plan.templateName,
        sessionName: item.sessionName,
        status,
        statusLabel: getExecutionDayStatusLabel(status),
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

  return {
    athlete: {
      displayName: dayData.athleteName,
      discipline: dayData.athlete?.discipline || null,
      sport: dayData.athlete?.sport || null,
      weightClass: dayData.athlete?.weightClass || null,
    },
    coachComment: dayData.latestDiaryEntry ? dayData.coachNote : null,
    dataQuality: buildCoachDayDataQuality(dayData),
    date: dayData.date,
    deviceHealth: buildCoachDayAiDeviceHealth(dayData.deviceHealthSummary),
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

function buildCoachDayDataQuality(dayData: CoachDayCleanSummary): NonNullable<CoachDayAiPayload["dataQuality"]> {
  const device = dayData.deviceHealthSummary;
  const hasDeviceSync = Boolean(device);
  const hasSleep = hasDeviceSleepData(device);
  const hasRestingHr = device?.heartRate?.restingBpm !== null && device?.heartRate?.restingBpm !== undefined;
  const hasDeviceWorkout = Boolean(device?.workout);
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
      present: dayData.summary.planCount === 0 || dayData.hasExecutionMarks,
    },
    {
      action: "Добавьте короткий комментарий тренера по дню.",
      key: "coachComment",
      label: "комментарий тренера",
      present: Boolean(dayData.latestDiaryEntry),
    },
    {
      action: "Попросите спортсмена синхронизировать Huawei Health.",
      key: "deviceSync",
      label: "синхронизация устройства",
      present: hasDeviceSync,
    },
    {
      action: "Проверьте доступ Huawei Health ко сну и повторите синхронизацию.",
      key: "sleep",
      label: "сон",
      present: hasSleep,
    },
    {
      action: "Проверьте доступ Huawei Health к пульсу и повторите синхронизацию.",
      key: "restingHr",
      label: "пульс покоя",
      present: hasRestingHr,
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

function buildCoachDayAiDeviceHealth(
  summary: DeviceHealthDailySummary | null,
): CoachDayAiPayload["deviceHealth"] {
  if (!summary) {
    return null;
  }

  const status = getDeviceHealthStatus(summary);

  return {
    heartRate: summary.heartRate
      ? {
        averageBpm: summary.heartRate.averageBpm,
        hrvRmssdMs: summary.heartRate.hrvRmssdMs,
        maxBpm: summary.heartRate.maxBpm,
        minBpm: summary.heartRate.minBpm,
        restingBpm: summary.heartRate.restingBpm,
      }
      : null,
    missing: status.missing,
    sleep: summary.sleep
      ? {
        awakeMinutes: summary.sleep.awakeMinutes,
        deepMinutes: summary.sleep.deepMinutes,
        durationMinutes: summary.sleep.durationMinutes,
        lightMinutes: summary.sleep.lightMinutes,
        remMinutes: summary.sleep.remMinutes,
        score: summary.sleep.score,
      }
      : null,
    sourceDevice: summary.sourceDevice,
    statusLabel: status.statusLabel,
    syncedAt: summary.syncedAt,
    workout: summary.workout
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

  if (dataQuality.status === "partial") {
    risks.push(`Вывод ограничен: не хватает ${dataQuality.missing.slice(0, 4).join(", ")}.`);
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
    actions.push("Попросите спортсмена синхронизировать Huawei Health перед повторным разбором дня.");
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
  return state.data.deviceHealthSummaries.find((summary) =>
    summary.entryDate === date &&
    (!athleteId || summary.athleteId === athleteId)
  ) ?? null;
}

function estimateAssignedBlockLoad(block: AssignedPlanBlock) {
  const profile = mobileLoadBlockProfiles[block.blockType] ?? defaultMobileLoadProfile;
  const priorityFactor = getMobileLoadPriorityFactor(block.blockPriority);
  const fallbackDurationMinutes = profile.durationMinutes * priorityFactor;
  const fallbackRpe = profile.rpe * priorityFactor;
  const durationMinutes = normalizeMobileLoadNumber(block.targetDurationMinutes, 240);
  const rpe = normalizeMobileLoadNumber(block.targetRpe, 10);

  if (durationMinutes !== null && rpe !== null) {
    return roundLoad(durationMinutes * rpe);
  }

  const exerciseLoads = (block.exercises ?? [])
    .map((exercise) => estimateAssignedExerciseLoad(exercise, fallbackRpe))
    .filter((value): value is number => value !== null);

  if (exerciseLoads.length) {
    return roundLoad(exerciseLoads.reduce((sum, value) => sum + value, 0));
  }

  if (durationMinutes !== null) {
    return roundLoad(durationMinutes * (rpe ?? fallbackRpe));
  }

  if (rpe !== null) {
    return roundLoad(fallbackDurationMinutes * rpe);
  }

  return roundLoad(fallbackDurationMinutes * profile.rpe);
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

function estimateAssignedExerciseLoad(exercise: AssignedBlockExercise, fallbackRpe: number) {
  const durationMinutes = normalizeMobileLoadNumber(exercise.targetDurationMinutes, 240);
  const rpe = normalizeMobileLoadNumber(exercise.targetRpe, 10);

  if (durationMinutes === null) {
    return null;
  }

  return durationMinutes * (rpe ?? fallbackRpe);
}

function normalizeMobileLoadNumber(value: number | null | undefined, maxValue: number) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  return value > 0 && value <= maxValue ? value : null;
}

function getMobileLoadPriorityFactor(blockPriority: number | null | undefined) {
  const priority = Number.isFinite(blockPriority ?? NaN)
    ? Math.min(Math.max(Number(blockPriority), 1), 5)
    : 1;

  return 0.7 + priority * 0.1;
}

function estimateExecutionActualLoad(
  block: AssignedPlanBlock,
  result: ExecutionResult | null,
  plannedLoad: number,
) {
  if (!result) {
    return 0;
  }

  if (result.durationMinutes !== null && result.rpe !== null) {
    return roundLoad(result.durationMinutes * result.rpe);
  }

  const exercises = block.exercises ?? [];

  if (exercises.length > 0 && result.exerciseResults?.length) {
    const completedExerciseCount = exercises.filter((exercise) =>
      getExerciseResult(result, exercise.id)?.completed === true
    ).length;
    const completionRatio = Math.min(completedExerciseCount, exercises.length) / exercises.length;

    return roundLoad(plannedLoad * completionRatio);
  }

  return result.completed ? plannedLoad : 0;
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
