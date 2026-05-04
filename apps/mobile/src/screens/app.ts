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
  AssignedPlanSummary,
  CompetitionPlanSummary,
  CompetitionResultPayload,
  ExecutionResultInput,
  MobileAppState,
  MobileDataSnapshot,
  MobileScreen,
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
        message: "Данные обновлены",
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
        savedAt: new Date().toISOString(),
      };
      saveSnapshot(snapshot);
      update({ data: snapshot });
    });
  };

  const submitExecution = async (form: HTMLFormElement) => {
    const blockKey = readString(form, "assignedBlock");
    const [assignedPlanId, assignedBlockId] = blockKey.split("|");

    if (!assignedPlanId || !assignedBlockId) {
      update({ error: "Выберите блок плана" });
      return;
    }

    const payload: ExecutionResultInput = {
      assignedBlockId,
      assignedPlanId,
      completed: readCheckbox(form, "completed"),
      durationMinutes: readOptionalNumber(form, "durationMinutes"),
      notes: readString(form, "notes"),
      repsCompleted: readOptionalNumber(form, "repsCompleted"),
      rpe: readOptionalNumber(form, "rpe"),
      setsCompleted: readOptionalNumber(form, "setsCompleted"),
      weightKg: readOptionalNumber(form, "weightKg"),
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

    root.querySelector<HTMLFormElement>("[data-execution-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      void submitExecution(event.currentTarget as HTMLFormElement);
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
    ${renderExecutionForm(plans)}
    ${state.session.user?.role === "coach" || state.session.user?.role === "admin" ? renderCompetitionResultForm(competitionPlans) : ""}
    ${renderExecutionHistory(state)}
  `;
}

function renderReadinessScreen(state: MobileAppState) {
  if (state.session.user?.role !== "athlete") {
    return renderEmpty("Готовность заполняет спортсмен", "Тренер видит готовность в карточке спортсмена и после обновления данных.");
  }

  return `
    <div class="screen-head">
      <h2>Готовность</h2>
      <p>${state.data.readinessEntry ? `Сегодня: ${state.data.readinessEntry.score} / ${state.data.readinessEntry.status}` : "Заполните форму перед тренировкой."}</p>
    </div>
    <form class="mobile-form compact-form" data-readiness-form>
      <label><span>Дата</span><input name="entryDate" type="date" value="${todayValue()}" /></label>
      <label><span>Пульс покоя</span><input name="restingHr" type="number" min="30" max="140" value="${state.session.user.baselineRestingHr ?? 60}" /></label>
      <label><span>Вес</span><input name="bodyWeight" type="number" min="20" max="200" step="0.1" value="${state.session.user.baselineWeightKg ?? 70}" /></label>
      ${renderChoiceGroup("sleepHours", "Сон", [
        { label: "меньше 6 ч", value: "5.5" },
        { label: "6-7 ч", value: "6.5" },
        { label: "7-8 ч", value: "7.5" },
        { label: "8+ ч", value: "8.5" },
      ], "8.5")}
      ${renderChoiceGroup("sleepQuality", "Качество сна", readinessBetterOptions, "4")}
      ${renderChoiceGroup("generalFeeling", "Самочувствие", readinessFeelingOptions, "4")}
      ${renderChoiceGroup("fatigueLevel", "Усталость", readinessLoadOptions, "2")}
      ${renderChoiceGroup("muscleSoreness", "Мышцы", readinessLoadOptions, "2")}
      ${renderChoiceGroup("motivationLevel", "Мотивация", readinessMotivationOptions, "4")}
      ${renderChoiceGroup("painLevel", "Боль", readinessPainOptions, "0")}
      <label class="check-row"><input name="illnessFlag" type="checkbox" /> Есть болезнь</label>
      <label class="check-row"><input name="feverFlag" type="checkbox" /> Температура</label>
      <button class="primary-action" type="submit">Сохранить готовность</button>
    </form>
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

function renderExecutionForm(plans: AssignedPlanSummary[]) {
  const blockOptions = plans.flatMap((plan) =>
    plan.day.sessions.flatMap((session) =>
      session.blocks.map((block) => ({
        label: `${plan.templateName} · ${session.name} · ${block.name}`,
        value: `${plan.id}|${block.id}`,
      })),
    ),
  );

  if (blockOptions.length === 0) {
    return renderEmpty("Нет блоков для результата", "Назначенный план появится после обновления данных.");
  }

  return `
    <form class="mobile-form compact-form" data-execution-form>
      <h3>Результат тренировки</h3>
      <label>
        <span>Блок плана</span>
        <select name="assignedBlock">
          ${blockOptions.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join("")}
        </select>
      </label>
      <label class="check-row"><input name="completed" type="checkbox" checked /> Выполнено</label>
      <label><span>Подходы</span><input name="setsCompleted" type="number" min="0" /></label>
      <label><span>Повторы</span><input name="repsCompleted" type="number" min="0" /></label>
      <label><span>Вес, кг</span><input name="weightKg" type="number" min="0" step="0.5" /></label>
      <label><span>Минуты</span><input name="durationMinutes" type="number" min="0" /></label>
      <label><span>RPE</span><input name="rpe" type="number" min="1" max="10" /></label>
      <label class="wide-field"><span>Заметка</span><textarea name="notes" rows="3"></textarea></label>
      <button class="primary-action" type="submit">Сохранить результат</button>
    </form>
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
          <small>${escapeHtml(result.notes || "Без заметки")}</small>
        </article>
      `).join("")}
    </div>
  `;
}

function renderPlanCard(plan: AssignedPlanSummary) {
  const blocks = plan.day.sessions.flatMap((session) => session.blocks);

  return `
    <article class="list-card plan-card">
      <strong>${escapeHtml(plan.templateName)}</strong>
      <span>${formatDate(plan.startDate)} · ${escapeHtml(plan.day.label)}</span>
      <small>${escapeHtml(plan.plannedPhase ?? "фаза не задана")} · ${blocks.length} блоков</small>
      <div class="chip-row">
        ${blocks.slice(0, 4).map((block) => `<em>${escapeHtml(block.name)}</em>`).join("")}
      </div>
    </article>
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

function getCompetitionPlansForAthlete(state: MobileAppState, athleteId: string | null) {
  return state.data.competitionPlans.filter((plan) => !athleteId || plan.athleteId === athleteId);
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
