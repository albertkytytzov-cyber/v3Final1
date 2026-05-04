import { MobileApiClient, MobileApiError } from "../api/client.js";
import { readRuntimeConfig } from "../config.js";
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
  CompetitionPlanSummary,
  CompetitionResultPayload,
  ExecutionExerciseResult,
  ExecutionResult,
  ExecutionResultInput,
  MobileAppState,
  MobileDataSnapshot,
  MobileScreen,
  ReadinessEntry,
  ReadinessSubmissionPayload,
} from "../types/models.js";

const runtimeConfig = readRuntimeConfig();

export function bootstrapMobileApp(root: HTMLElement) {
  const state: MobileAppState = {
    session: loadSession(runtimeConfig.apiBaseUrl),
    data: loadSnapshot(),
    queue: loadQueue(),
    selectedScreen: "dashboard",
    selectedAthleteId: loadSelectedAthleteId(),
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
      const loadedData = await api.loadAppData(auth.user.role);
      const snapshot: MobileDataSnapshot = {
        ...state.data,
        ...loadedData,
        savedAt: new Date().toISOString(),
      };
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

    const result = await flushSyncQueue(client(), state.session.user.id);
    const message = result.syncedCount > 0
      ? `Синхронизировано: ${result.syncedCount}`
      : "Очередь синхронизации проверена";

    update({
      isSyncing: false,
      message,
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

  const submitExecution = async (form: HTMLFormElement) => {
    const blockKey = readString(form, "assignedBlock");
    const [legacyAssignedPlanId, legacyAssignedBlockId] = blockKey.split("|");
    const assignedPlanId = readString(form, "assignedPlanId") || legacyAssignedPlanId;
    const assignedBlockId = readString(form, "assignedBlockId") || legacyAssignedBlockId;

    if (!assignedPlanId || !assignedBlockId) {
      update({ error: "Выберите блок плана" });
      return;
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

    const payload: ExecutionResultInput = {
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

    await submitOrQueue("execution", payload, async (idempotencyKey) => {
      const result = await client().submitExecution(payload, idempotencyKey);
      const snapshot = {
        ...state.data,
        executionResults: upsertById(state.data.executionResults, result.result),
        savedAt: new Date().toISOString(),
      };
      saveSnapshot(snapshot);
      update({ data: snapshot });
    });
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

  const submitOrQueue = async (
    kind: "readiness" | "execution" | "competition-result",
    payload: ReadinessSubmissionPayload | ExecutionResultInput | CompetitionResultPayload,
    submit: (idempotencyKey: string) => Promise<void>,
  ) => {
    const pendingAction = createPendingAction(kind, payload, state.session.user?.id ?? null);

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
          error: error.message,
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

    root.querySelector<HTMLButtonElement>("[data-refresh]")?.addEventListener("click", () => {
      void refreshData();
    });

    root.querySelector<HTMLButtonElement>("[data-sync]")?.addEventListener("click", () => {
      void tryFlushQueue();
    });

    root.querySelector<HTMLButtonElement>("[data-logout]")?.addEventListener("click", () => {
      void handleLogout();
    });

    root.querySelector<HTMLSelectElement>("[data-athlete-select]")?.addEventListener("change", (event) => {
      const selectedAthleteId = (event.currentTarget as HTMLSelectElement).value || null;
      saveSelectedAthleteId(selectedAthleteId);
      update({ selectedAthleteId });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-athlete-card]").forEach((button) => {
      button.addEventListener("click", () => {
        const selectedAthleteId = button.dataset.athleteCard ?? null;
        saveSelectedAthleteId(selectedAthleteId);
        update({
          selectedAthleteId,
          selectedScreen: "dashboard",
        });
      });
    });

    root.querySelector<HTMLFormElement>("[data-readiness-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      void submitReadiness(event.currentTarget as HTMLFormElement);
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
        void submitExecution(event.currentTarget as HTMLFormElement);
      });
    });

    root.querySelector<HTMLFormElement>("[data-competition-result-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      void submitCompetitionResult(event.currentTarget as HTMLFormElement);
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
        user?.role === "coach" || user?.role === "admin"
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
  return `
    <section class="toolbar-row">
      <button data-refresh type="button" ${state.isBusy ? "disabled" : ""}>Обновить</button>
      <button data-sync type="button" ${state.isSyncing || state.queue.length === 0 ? "disabled" : ""}>
        Синхронизация ${state.queue.length ? `(${state.queue.length})` : ""}
      </button>
      <small>${state.data.savedAt ? `Сохранено: ${formatDateTime(state.data.savedAt)}` : "Локальных данных пока нет"}</small>
    </section>
  `;
}

function renderAthletePicker(state: MobileAppState) {
  if (state.data.athletes.length === 0) {
    return "";
  }

  return `
    <label class="athlete-picker">
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

  return `
    <div class="screen-head">
      <h2>Сегодня</h2>
      <p>${nextStart ? `До старта ${daysUntil(nextStart.competitionStartDate)} дн.` : "Ближайший старт не выбран"}</p>
    </div>
    <div class="metric-grid">
      <article><span>Планы</span><strong>${plans.length}</strong></article>
      <article><span>Старты</span><strong>${competitionPlans.length}</strong></article>
      <article><span>Очередь</span><strong>${state.queue.length}</strong></article>
      <article><span>Связь</span><strong>${state.isOnline ? "Есть" : "Нет"}</strong></article>
    </div>
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

  return `
    <div class="screen-head">
      <h2>Спортсмены</h2>
      <p>${state.data.athletes.length} в списке</p>
    </div>
    <div class="list-stack">
      ${state.data.athletes.map((athlete) => `
        <button class="list-card ${state.selectedAthleteId === athlete.athleteId ? "is-selected" : ""}" data-athlete-card="${escapeHtml(athlete.athleteId)}" type="button">
          <strong>${escapeHtml(athlete.fullName)}</strong>
          <span>${escapeHtml(athlete.email)}</span>
          <small>${escapeHtml([athlete.sport, athlete.weightClass].filter(Boolean).join(" · ") || "Профиль не заполнен")}</small>
        </button>
      `).join("")}
    </div>
  `;
}

function renderPlansScreen(state: MobileAppState, athleteId: string | null) {
  const plans = getPlansForAthlete(state, athleteId);

  if (plans.length === 0) {
    return renderEmpty("Планов пока нет", "После обновления здесь появятся назначенные тренировочные дни.");
  }

  return `
    <div class="screen-head">
      <h2>Планы</h2>
      <p>${plans.length} назначенных дней</p>
    </div>
    <div class="list-stack">
      ${plans.map((plan) => renderPlanCard(plan)).join("")}
    </div>
  `;
}

function renderCalendarScreen(state: MobileAppState, athleteId: string | null) {
  const plans = getCompetitionPlansForAthlete(state, athleteId);
  const competitions = state.data.competitions
    .slice()
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  return `
    <div class="screen-head">
      <h2>Календарь</h2>
      <p>${competitions.length} соревнований · ${plans.length} планов старта</p>
    </div>
    <div class="timeline-list">
      ${competitions.slice(0, 30).map((competition) => {
        const linkedPlan = plans.find((plan) => plan.competitionId === competition.id);
        return `
          <article class="timeline-card ${linkedPlan ? "is-linked" : ""}">
            <time>${formatDate(competition.startDate)}</time>
            <div>
              <strong>${escapeHtml(competition.title)}</strong>
              <span>${escapeHtml([competition.location, competition.ageGroup].filter(Boolean).join(" · "))}</span>
              ${linkedPlan ? `<small>План: ${escapeHtml(linkedPlan.priority)} · ${daysUntil(linkedPlan.competitionStartDate)} дн.</small>` : ""}
            </div>
          </article>
        `;
      }).join("") || renderEmpty("Календарь пуст", "Обновите данные с сервера.")}
    </div>
  `;
}

function renderResultsScreen(state: MobileAppState, athleteId: string | null) {
  const plans = getPlansForAthlete(state, athleteId);
  const competitionPlans = getCompetitionPlansForAthlete(state, athleteId);

  return `
    <div class="screen-head">
      <h2>Результаты</h2>
      <p>Тренировка и соревнование сохраняются локально, если нет интернета.</p>
    </div>
    ${renderExecutionForm(state, plans)}
    ${state.session.user?.role === "coach" || state.session.user?.role === "admin" ? renderCompetitionResultForm(competitionPlans) : ""}
    ${renderExecutionHistory(state)}
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

function renderExecutionForm(state: MobileAppState, plans: AssignedPlanSummary[]) {
  const planGroups = getExecutionPlanGroups(plans);
  const blockCount = planGroups.reduce((total, group) => total + group.blockItems.length, 0);
  const exerciseCount = planGroups.reduce(
    (total, group) =>
      total + group.blockItems.reduce(
        (blockTotal, item) => blockTotal + (item.block.exercises?.length ?? 0),
        0,
      ),
    0,
  );

  if (blockCount === 0) {
    return renderEmpty("Нет блоков для результата", "Назначенный план появится после обновления данных.");
  }

  return `
    <section class="execution-panel">
      <div class="section-title">
        <h3>Результат тренировки</h3>
        <p>${plans.length} назначенных дней · ${blockCount} блоков · ${exerciseCount} упражнений. Ближайший день открыт сверху.</p>
      </div>
      <div class="execution-plan-stack">
        ${planGroups.map((group, index) => renderExecutionPlanGroup(state, group, index === 0)).join("")}
      </div>
    </section>
  `;
}

function renderExecutionPlanGroup(
  state: MobileAppState,
  group: ExecutionPlanGroup,
  isOpen: boolean,
) {
  const blockCount = group.blockItems.length;
  const exerciseCount = group.blockItems.reduce(
    (total, item) => total + (item.block.exercises?.length ?? 0),
    0,
  );
  const completedBlockCount = group.blockItems.filter((item) =>
    Boolean(getExecutionResultForBlock(state, item.plan.id, item.block.id)),
  ).length;

  return `
    <details class="execution-plan-group mobile-plan-day-card mobile-execution-day-card" ${isOpen ? "open" : ""}>
      <summary class="mobile-plan-day-card-head">
        <div>
          <strong>${formatDate(group.plan.day.dayDate)} · ${escapeHtml(group.plan.day.label)}</strong>
          <span>${escapeHtml(group.plan.templateName)} · ${blockCount} блоков · ${exerciseCount} упр.</span>
        </div>
        <em>${completedBlockCount}/${blockCount}</em>
      </summary>
      <div class="mobile-plan-day-card-body">
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
                  renderExecutionBlockForm(
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
      </div>
    </details>
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
        <button class="primary-action" type="submit">Сохранить</button>
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
        <button class="primary-action" type="submit">Сохранить</button>
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
      <h3>Результат соревнования</h3>
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
      <button class="primary-action" type="submit">Сохранить старт</button>
    </form>
  `;
}

function renderExecutionHistory(state: MobileAppState) {
  if (state.data.executionResults.length === 0) {
    return "";
  }

  return `
    <div class="list-stack">
      ${state.data.executionResults.slice(0, 10).map((result) => `
        <article class="list-card">
          <strong>${result.completed ? "Выполнено" : "Не выполнено"}</strong>
          <span>${formatDateTime(result.updatedAt)}</span>
          <small>${escapeHtml(formatExecutionHistoryDetails(result))}</small>
          ${result.exerciseResults?.length && result.notes ? `<small>${escapeHtml(result.notes)}</small>` : ""}
        </article>
      `).join("")}
    </div>
  `;
}

function renderPlanCard(plan: AssignedPlanSummary) {
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
        <em>${escapeHtml(dayFocus)}</em>
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
      <h3>Ожидает синхронизации</h3>
      ${state.queue.map((item) => `
        <article>
          <strong>${escapeHtml(item.label)}</strong>
          <span>${formatDateTime(item.createdAt)}</span>
          ${item.lastError ? `<small>${escapeHtml(item.lastError)}</small>` : ""}
        </article>
      `).join("")}
    </section>
  `;
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
    { id: "results", label: "Результаты", icon: "✓" },
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

function formatExerciseWorkCell(exercise: AssignedBlockExercise) {
  const noteParts = splitExerciseNoteParts(exercise.notes);

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
  const controlParts = noteParts.length > 1 ? noteParts.slice(1) : [];

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
  const parts = [
    exercise.targetSets ? `${exercise.targetSets} подх.` : "",
    exercise.targetReps ? `${exercise.targetReps} повт.` : "",
    exercise.targetWeightKg ? `${exercise.targetWeightKg} кг` : "",
    exercise.targetDurationMinutes ? `${exercise.targetDurationMinutes} мин.` : "",
    exercise.targetRpe ? `RPE ${exercise.targetRpe}` : "",
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

function formatInputValue(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function formatExecutionHistoryDetails(result: ExecutionResult) {
  if (!result.exerciseResults?.length) {
    return result.notes || "Без заметки";
  }

  const completed = result.exerciseResults.filter((exercise) => exercise.completed).length;
  return `Упражнения: ${completed} из ${result.exerciseResults.length}`;
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

    return error.message;
  }

  return error instanceof Error ? error.message : "Неизвестная ошибка";
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
