import type { AuthUser, ReadinessEntry } from "@training-platform/shared";
import { MVP_MODULES } from "@training-platform/shared";
import type {
  AnalyticsCoachActionDecision,
  AnalyticsCoachActionDecisionStatus,
  AnalyticsCoachSuggestion,
  AnalyticsInsight,
  AnalyticsCoachActionOutcome,
  AnalyticsCoachActionOutcomeSource,
  AnalyticsPattern,
  AnalyticsWeekStatus,
} from "@training-platform/shared";
import type { QueueItem } from "./offline-sync";

export type Language = "en" | "ru" | "bg";

export const LANGUAGE_OPTIONS: Array<{ value: Language; label: string }> = [
  { value: "en", label: "English" },
  { value: "ru", label: "Русский" },
  { value: "bg", label: "Български" },
];

export const UI_TEXT: Record<Language, Record<string, string>> = {
  en: {
    statusOffline: "Mode: offline / stale cache",
    statusOnline: "Mode: online",
    pendingSync: "pending sync",
    staleCache: "stale cache",
    synced: "synced",
    latestReadiness: "Latest readiness",
    noEntriesYet: "no entries yet",
    athleteReadinessHistory: "Athlete readiness history",
    recentEntries: "recent entries",
    athleteNoReadinessYet: "This athlete has not submitted readiness entries yet.",
    coachAdaptationTitle: "Adaptation Engine v1",
    noCoachAdaptationChanges: "No block changes were required.",
    adaptationNeedsPlan:
      "This athlete needs both an active plan and a readiness entry to produce an adapted day.",
    completionPercent: "completion",
    coachReviewNeedsPlan:
      "This athlete needs an active plan to compare plan versus actual execution.",
    loadPoints: "load points",
    coachAnalyticsIntro:
      "Analytics v2 for the selected athlete. Trends now connect season context, mesocycle week, execution load, and coach-facing risk insights.",
    coachAnalyticsNeedData:
      "Analytics need readiness history plus plan and execution data.",
    analyticsCoachInsights: "Coach insights",
    analyticsPatterns: "Auto-detected patterns",
    analyticsCoachActions: "Coach actions",
    analyticsPlanningChain: "Planning chain",
    analyticsWeekSnapshot: "Week snapshot",
    analyticsRecommendation: "Recommendation",
    analyticsMissingLinks: "Missing links",
    analyticsOpenInPlanner: "Open in planner",
    analyticsOpenAndApply: "Open and apply",
    analyticsDecisionHistory: "Decision history",
    analyticsDecisionState: "Decision",
    analyticsOutcome: "Outcome",
    analyticsNoDecisionHistory: "No coach decisions have been logged yet.",
    analyticsMarkNotApplied: "Mark not applied",
    analyticsOutcomeFeedback: "Outcome feedback",
    signInHint: "Sign in with a demo account or create a new one.",
    accountCreatedFor: "Account created for",
    adaptedPlanCache: "Adapted plan cache",
    analyticsAppearLater:
      "Analytics will appear after readiness and execution data accumulate.",
    analyticsCache: "Analytics cache",
    assignedPlansCache: "Assigned plans cache",
    assigning: "Assigning...",
    athleteOnlyReadiness: "Only the athlete can submit the daily readiness form.",
    authFailed: "Authentication failed.",
    completionTrend: "Completion trend",
    createdAtLabel: "Created",
    demoCredentials: "Demo credentials",
    executionCache: "Execution cache",
    executionSaved: "Execution saved.",
    guestTopbarTitle: "Access",
    guest: "Guest",
    lastAttemptFailed: "Last attempt failed",
    loadTrend: "Load trend",
    networkLoadedCache: "Network unavailable, stale cache loaded.",
    noActiveAssignments: "No active assignments yet.",
    noActivePlan: "No active plan",
    noAdaptationYet: "No adaptation yet",
    noAnalyticsYet: "No analytics yet",
    noCoachAthletes: "No athletes are linked to this coach yet.",
    noReviewYet: "No review yet",
    notGenerated: "Not generated",
    notSavedYet: "Not saved yet",
    offlineChangesSynced: "Offline changes synced.",
    offlineSyncCenter: "Offline sync center",
    openAthlete: "Open athlete",
    pendingItems: "Pending items",
    planAssignmentFailed: "Failed to assign plan.",
    pleaseWait: "Please wait...",
    queueEmpty: "Queue is empty.",
    readinessCache: "Readiness cache",
    readinessSaved: "Readiness saved.",
    readinessTrend: "Readiness trend",
    readyToSync: "Ready to sync",
    selectAthlete: "Select athlete",
    selectTemplate: "Select template",
    sessionClosed: "Session closed.",
    sessionRestored: "Session restored.",
    signedInAs: "Signed in as",
    syncFailedPrefix: "Sync failed",
    syncNow: "Sync now",
    syncingNow: "Syncing...",
    templateAssigned: "Template assigned.",
    templateCreated: "Template created.",
    templateRequestFailed: "Failed to create template.",
  },
  ru: {
    statusOffline: "Режим: офлайн / устаревший кэш",
    statusOnline: "Режим: онлайн",
    pendingSync: "ожидает синхронизации",
    staleCache: "устаревший кэш",
    synced: "синхронизировано",
    latestReadiness: "Последняя готовность",
    noEntriesYet: "записей пока нет",
    athleteReadinessHistory: "История готовности спортсмена",
    recentEntries: "последних записей",
    athleteNoReadinessYet: "Этот спортсмен ещё не отправлял данные готовности.",
    coachAdaptationTitle: "Адаптация нагрузки v1",
    noCoachAdaptationChanges: "Изменения блоков не потребовались.",
    adaptationNeedsPlan:
      "Чтобы получить адаптированный день, этому спортсмену нужны активный план и запись готовности.",
    completionPercent: "выполнения",
    coachReviewNeedsPlan:
      "Этому спортсмену нужен активный план, чтобы сравнивать план и факт.",
    loadPoints: "точек нагрузки",
    coachAnalyticsIntro:
      "Краткая аналитика по спортсмену",
    coachAnalyticsNeedData:
      "Для аналитики нужны записи готовности, назначенный план и отметки выполнения.",
    analyticsCoachInsights: "Сигналы",
    analyticsPatterns: "Автоматически найденные закономерности",
    analyticsCoachActions: "Рекомендации тренеру",
    analyticsPlanningChain: "Планировочная цепочка",
    analyticsWeekSnapshot: "Снимок недели",
    analyticsRecommendation: "Что сделать",
    analyticsMissingLinks: "Отсутствующие звенья",
    analyticsOpenInPlanner: "Открыть неделю",
    analyticsOpenAndApply: "Открыть и применить",
    analyticsDecisionHistory: "История решений",
    analyticsDecisionState: "Решение",
    analyticsOutcome: "Результат",
    analyticsNoDecisionHistory: "Тренерские решения пока не зафиксированы.",
    analyticsMarkNotApplied: "Отметить как не применено",
    analyticsOutcomeFeedback: "Оценка результата",
    signInHint: "Войдите с демо-аккаунтом или создайте новый.",
    accountCreatedFor: "Аккаунт создан для",
    adaptedPlanCache: "Кэш адаптированного плана",
    analyticsAppearLater:
      "Аналитика появится, когда накопятся данные готовности и выполнения.",
    analyticsCache: "Кэш аналитики",
    assignedPlansCache: "Кэш назначенных планов",
    assigning: "Назначение...",
    athleteOnlyReadiness: "Только спортсмен может отправить дневную форму готовности.",
    authFailed: "Ошибка авторизации.",
    completionTrend: "Тренд выполнения",
    createdAtLabel: "Создано",
    demoCredentials: "Демо-доступы",
    executionCache: "Кэш выполнения",
    executionSaved: "Выполнение сохранено.",
    guestTopbarTitle: "Доступ",
    guest: "Гость",
    lastAttemptFailed: "Последняя попытка не удалась",
    loadTrend: "Тренд нагрузки",
    networkLoadedCache: "Сеть недоступна, загружен устаревший кэш.",
    noActiveAssignments: "Активных назначений пока нет.",
    noActivePlan: "Нет активного плана",
    noAdaptationYet: "Адаптации пока нет",
    noAnalyticsYet: "Аналитики пока нет",
    noCoachAthletes: "К этому тренеру пока не привязан ни один спортсмен.",
    noReviewYet: "Разбора пока нет",
    notGenerated: "Не сгенерировано",
    notSavedYet: "Ещё не сохранено",
    offlineChangesSynced: "Офлайн-изменения синхронизированы.",
    offlineSyncCenter: "Центр офлайн-синхронизации",
    openAthlete: "Открыть спортсмена",
    pendingItems: "Элементы в очереди",
    planAssignmentFailed: "Не удалось назначить план.",
    pleaseWait: "Пожалуйста, подождите...",
    queueEmpty: "Очередь пуста.",
    readinessCache: "Кэш готовности",
    readinessSaved: "Готовность сохранена.",
    readinessTrend: "Тренд готовности",
    readyToSync: "Готово к синхронизации",
    selectAthlete: "Выберите спортсмена",
    selectTemplate: "Выберите шаблон",
    sessionClosed: "Сессия закрыта.",
    sessionRestored: "Сессия восстановлена.",
    signedInAs: "Вход выполнен как",
    syncFailedPrefix: "Ошибка синхронизации",
    syncNow: "Синхронизировать сейчас",
    syncingNow: "Синхронизация...",
    templateAssigned: "Шаблон назначен.",
    templateCreated: "Шаблон создан.",
    templateRequestFailed: "Не удалось создать шаблон.",
  },
  bg: {
    statusOffline: "Режим: офлайн / остарял кеш",
    statusOnline: "Режим: онлайн",
    pendingSync: "очаква синхронизация",
    staleCache: "остарял кеш",
    synced: "синхронизирано",
    latestReadiness: "Последна готовност",
    noEntriesYet: "още няма записи",
    athleteReadinessHistory: "История на готовността на спортиста",
    recentEntries: "последни записи",
    athleteNoReadinessYet: "Този спортист още не е подавал данни за готовност.",
    coachAdaptationTitle: "Адаптиране на натоварването v1",
    noCoachAdaptationChanges: "Не бяха нужни промени по блоковете.",
    adaptationNeedsPlan:
      "За да се генерира адаптиран ден, този спортист има нужда от активен план и запис за готовност.",
    completionPercent: "изпълнение",
    coachReviewNeedsPlan:
      "На този спортист му е нужен активен план, за да се сравняват планът и реалното изпълнение.",
    loadPoints: "точки натоварване",
    coachAnalyticsIntro:
      "Кратък анализ за спортиста",
    coachAnalyticsNeedData:
      "За анализа са нужни записи за готовност, назначен план и отбелязано изпълнение.",
    analyticsCoachInsights: "Сигнали",
    analyticsPatterns: "Автоматично открити закономерности",
    analyticsCoachActions: "Препоръки за треньора",
    analyticsPlanningChain: "Планираща верига",
    analyticsWeekSnapshot: "Снимка на седмицата",
    analyticsRecommendation: "Какво да се направи",
    analyticsMissingLinks: "Липсващи връзки",
    analyticsOpenInPlanner: "Отвори седмицата",
    analyticsOpenAndApply: "Отвори и приложи",
    analyticsDecisionHistory: "История на решенията",
    analyticsDecisionState: "Решение",
    analyticsOutcome: "Резултат",
    analyticsNoDecisionHistory: "Все още няма записани треньорски решения.",
    analyticsMarkNotApplied: "Маркирай като неприложено",
    analyticsOutcomeFeedback: "Оценка на резултата",
    signInHint: "Влезте с демо акаунт или създайте нов.",
    accountCreatedFor: "Създаден е акаунт за",
    adaptedPlanCache: "Кеш на адаптирания план",
    analyticsAppearLater:
      "Анализът ще се появи, когато се натрупат данни за готовност и изпълнение.",
    analyticsCache: "Кеш на аналитиката",
    assignedPlansCache: "Кеш на назначените планове",
    assigning: "Назначаване...",
    athleteOnlyReadiness: "Само спортистът може да подаде дневната форма за готовност.",
    authFailed: "Грешка при автентикация.",
    completionTrend: "Тренд на изпълнението",
    createdAtLabel: "Създадено",
    demoCredentials: "Демо достъпи",
    executionCache: "Кеш на изпълнението",
    executionSaved: "Изпълнението е записано.",
    guestTopbarTitle: "Достъп",
    guest: "Гост",
    lastAttemptFailed: "Последният опит беше неуспешен",
    loadTrend: "Тренд на натоварването",
    networkLoadedCache: "Мрежата е недостъпна, зареден е остарял кеш.",
    noActiveAssignments: "Все още няма активни назначения.",
    noActivePlan: "Няма активен план",
    noAdaptationYet: "Все още няма адаптация",
    noAnalyticsYet: "Все още няма аналитика",
    noCoachAthletes: "Към този треньор все още няма свързани спортисти.",
    noReviewYet: "Все още няма преглед",
    notGenerated: "Не е генерирано",
    notSavedYet: "Все още не е запазено",
    offlineChangesSynced: "Офлайн промените са синхронизирани.",
    offlineSyncCenter: "Център за офлайн синхронизация",
    openAthlete: "Отвори спортиста",
    pendingItems: "Елементи в опашката",
    planAssignmentFailed: "Планът не можа да бъде назначен.",
    pleaseWait: "Моля, изчакайте...",
    queueEmpty: "Опашката е празна.",
    readinessCache: "Кеш на готовността",
    readinessSaved: "Готовността е запазена.",
    readinessTrend: "Тенденция на готовността",
    readyToSync: "Готово за синхронизация",
    selectAthlete: "Изберете спортист",
    selectTemplate: "Изберете шаблон",
    sessionClosed: "Сесията е затворена.",
    sessionRestored: "Сесията е възстановена.",
    signedInAs: "Влезли сте като",
    syncFailedPrefix: "Неуспешна синхронизация",
    syncNow: "Синхронизирай сега",
    syncingNow: "Синхронизиране...",
    templateAssigned: "Шаблонът е назначен.",
    templateCreated: "Шаблонът е създаден.",
    templateRequestFailed: "Шаблонът не можа да бъде създаден.",
  },
};

export function queueLabel(language: Language, count: number) {
  if (language === "ru") return `Офлайн-очередь: ${count}`;
  if (language === "bg") return `Офлайн опашка: ${count}`;
  return `Offline queue: ${count}`;
}

export function syncStateLabel(language: Language, isOffline: boolean, queueSize: number) {
  if (queueSize > 0) return UI_TEXT[language].pendingSync;
  if (isOffline) return UI_TEXT[language].staleCache;
  return UI_TEXT[language].synced;
}

export function queueItemStatusLabel(item: QueueItem, language: Language) {
  if (item.status === "synced") {
    return UI_TEXT[language].synced;
  }

  if (item.status === "syncing") {
    return UI_TEXT[language].syncingNow;
  }

  if (item.status === "failed") {
    return language === "ru"
      ? "ошибка"
      : language === "bg"
        ? "грешка"
        : "failed";
  }

  return UI_TEXT[language].pendingSync;
}

export function translateRoleName(role: AuthUser["role"], language: Language) {
  const map = {
    coach: { en: "Coach", ru: "Тренер", bg: "Треньор" },
    athlete: { en: "Athlete", ru: "Спортсмен", bg: "Спортист" },
    admin: { en: "Admin", ru: "Админ", bg: "Админ" },
  };
  return map[role][language];
}

export function translateTrainingRole(
  role: { id: "coach" | "athlete" | "admin"; name: string; summary: string },
  language: Language,
) {
  return {
    ...role,
    name: translateRoleName(role.id, language),
  };
}

export function translateExecutionStatus(status: string, language: Language) {
  const map: Record<string, Record<Language, string>> = {
    completed: { en: "completed", ru: "выполнено", bg: "изпълнено" },
    partial: { en: "partial", ru: "частично", bg: "частично" },
    missed: { en: "missed", ru: "пропущено", bg: "пропуснато" },
    planned: { en: "planned", ru: "запланировано", bg: "планирано" },
  };
  return map[status]?.[language] ?? status;
}

export function translateBlockAction(action: string, language: Language) {
  const map: Record<string, Record<Language, string>> = {
    keep: { en: "keep", ru: "оставить", bg: "запази" },
    kept: { en: "kept", ru: "оставлено", bg: "запазено" },
    reduce: { en: "reduce", ru: "снизить", bg: "намали" },
    reduced: { en: "reduced", ru: "снижено", bg: "намалено" },
    replace: { en: "replace", ru: "заменить", bg: "замени" },
    replaced: { en: "replaced", ru: "заменено", bg: "заменено" },
    remove: { en: "remove", ru: "убрать", bg: "премахни" },
    removed: { en: "removed", ru: "убрано", bg: "премахнато" },
  };
  return map[action]?.[language] ?? action;
}

export function formatQueueItemLabel(item: QueueItem, language: Language) {
  if (item.type === "readiness") {
    const entryDate = item.payload.entryDate ?? item.createdAt.slice(0, 10);
    return language === "ru"
      ? `готовность / ${entryDate}`
      : language === "bg"
        ? `готовност / ${entryDate}`
        : `readiness / ${entryDate}`;
  }

  if (item.type === "execution") {
    return language === "ru"
      ? `выполнение / блок ${item.payload.assignedBlockId}`
      : language === "bg"
        ? `изпълнение / блок ${item.payload.assignedBlockId}`
        : `execution / block ${item.payload.assignedBlockId}`;
  }

  if (item.type === "coach-diary") {
    return language === "ru"
      ? `запись тренера / ${item.payload.entryDate}`
      : language === "bg"
        ? `запис на треньора / ${item.payload.entryDate}`
        : `coach note / ${item.payload.entryDate}`;
  }

  return language === "ru"
    ? `решение аналитики / ${item.payload.suggestionTitle}`
    : language === "bg"
      ? `решение от анализа / ${item.payload.suggestionTitle}`
      : `analytics decision / ${item.payload.suggestionTitle}`;
}

export function queueConflictLabel(item: QueueItem, language: Language) {
  if (item.type === "readiness") {
    return language === "ru"
      ? "Последний черновик готовности за день заменяет предыдущий."
      : language === "bg"
        ? "Последната чернова за готовността през деня заменя предишната."
        : "Latest readiness draft for the day replaces the previous one.";
  }

  if (item.type === "analytics-decision") {
    return language === "ru"
      ? "Последнее решение по одной рекомендации и неделе заменяет предыдущее."
      : language === "bg"
        ? "Последното решение за същата препоръка и седмица заменя предишното."
        : "Latest decision for the same suggestion/week context replaces the previous one.";
  }

  if (item.type === "coach-diary") {
    return language === "ru"
      ? "Последняя запись тренера для этого дня или набора заданий заменяет предыдущую."
      : language === "bg"
        ? "Последният запис на треньора за този ден или набор задачи заменя предишния."
        : "Latest coach note for the same day or task set replaces the previous one.";
  }

  return language === "ru"
    ? "Последний черновик выполнения по блоку заменяет предыдущий."
    : language === "bg"
      ? "Последната чернова за изпълнението на блока заменя предишната."
      : "Latest execution draft for the block replaces the previous one.";
}

export function translateModule(
  module: (typeof MVP_MODULES)[number],
  language: Language,
) {
  const localized = {
    auth: {
      en: ["Auth + roles", "Role-based sign-in and session restore."],
      ru: ["Авторизация и роли", "Ролевой вход и восстановление сессии."],
      bg: ["Автентикация и роли", "Вход по роли и възстановяване на сесия."],
    },
    readiness: {
      en: ["Readiness form", "Daily athlete readiness with PostgreSQL persistence."],
      ru: ["Форма готовности", "Ежедневная проверка готовности спортсмена с сохранением в PostgreSQL."],
      bg: ["Форма за готовност", "Дневна проверка на готовността на спортиста със запис в PostgreSQL."],
    },
    dashboard: {
      en: ["Coach workspace", "Coach view for athletes, plans, and review."],
      ru: ["Рабочая зона тренера", "Экран тренера для спортсменов, планов и разбора."],
      bg: ["Работна зона на треньора", "Екран на треньора за спортисти, планове и преглед."],
    },
  } as const;
  const value = localized[module.id as keyof typeof localized];
  return value ? { ...module, name: value[language][0], summary: value[language][1] } : module;
}

export const COPY: Record<Language, Record<string, string>> = {
  en: {
    language: "Language",
    authRoles: "Authentication and roles",
    logout: "Log out",
    login: "Login",
    register: "Register",
    fullName: "Full name",
    email: "Email",
    password: "Password",
    role: "Role",
    signIn: "Sign in",
    createAccount: "Create account",
    dailyReadiness: "Daily readiness",
    saveReadiness: "Save readiness",
    assignedTrainingDay: "Assigned training day",
    adaptedDay: "Adapted day",
    executionTracking: "Execution Tracking v1",
    analytics: "Analytics Engine v2",
    coachDashboard: "Coach dashboard",
    executionReview: "Execution review",
    planEngine: "Planning studio",
    templateName: "Template name",
    description: "Description",
    sportType: "Sport type",
    phaseFocus: "Phase focus",
    priorityFocus: "Priority focus",
    templateGoal: "Template goal",
    microcycleType: "Microcycle type",
    competitionSpecific: "Competition specific",
    general: "General",
    allPriorities: "All priorities",
    phase: "Phase",
    priority: "Priority",
    templateBlocks: "Training blocks",
    noPlanTemplates: "No plan templates have been created yet.",
    phaseDrivenRecommendations: "Phase-driven recommendations",
    selectAthleteDateForRecommendations:
      "Select athlete and date to load recommended templates for the current competition phase.",
    score: "Score",
    plannedPhase: "Planned phase",
    autoFromCompetitionContext: "Auto from competition context",
    createTemplate: "Create template",
    savedTemplates: "Saved templates",
    assignTemplate: "Assign template to athlete",
    athlete: "Athlete",
    template: "Template",
    startDate: "Start date",
    dayLabel: "Day label",
    coachNotes: "Coach notes",
    assignPlan: "Assign plan",
    activeAssignments: "Active assignments",
    completed: "Completed",
    sets: "Sets",
    reps: "Reps",
    weightKg: "Weight, kg",
    durationMin: "Duration, min",
    rpe: "RPE",
    notes: "Notes",
    saveExecution: "Save execution",
    targetDuration: "Target duration",
    targetRpe: "Target RPE",
    targetSets: "Target sets",
    targetReps: "Target reps",
    blockName: "Block name",
    blockType: "Block type",
    blockPriority: "Priority",
    mandatory: "Mandatory",
  },
  ru: {
    language: "Язык",
    authRoles: "Авторизация и роли",
    logout: "Выйти",
    login: "Вход",
    register: "Регистрация",
    fullName: "Полное имя",
    email: "Email",
    password: "Пароль",
    role: "Роль",
    signIn: "Войти",
    createAccount: "Создать аккаунт",
    dailyReadiness: "Ежедневная форма готовности",
    saveReadiness: "Сохранить готовность",
    assignedTrainingDay: "Назначенный тренировочный день",
    adaptedDay: "Адаптированный день",
    executionTracking: "Фиксация выполнения v1",
    analytics: "Аналитика v2",
    coachDashboard: "Панель тренера",
    executionReview: "Разбор выполнения",
    planEngine: "Планировочная студия",
    templateName: "Название шаблона",
    description: "Описание",
    sportType: "Вид спорта",
    phaseFocus: "Фокус фазы",
    priorityFocus: "Фокус приоритета",
    templateGoal: "Цель шаблона",
    microcycleType: "Тип микроцикла",
    competitionSpecific: "Специфика соревнований",
    general: "Общий",
    allPriorities: "Все приоритеты",
    phase: "Фаза",
    priority: "Приоритет",
    templateBlocks: "Тренировочные блоки",
    noPlanTemplates: "Шаблоны плана пока не созданы.",
    phaseDrivenRecommendations: "Рекомендации по фазе подготовки",
    selectAthleteDateForRecommendations:
      "Выберите спортсмена и дату, чтобы загрузить рекомендованные шаблоны под текущую соревновательную фазу.",
    score: "Оценка",
    plannedPhase: "Плановая фаза",
    autoFromCompetitionContext: "Авто по соревнованиям",
    createTemplate: "Создать шаблон",
    savedTemplates: "Сохранённые шаблоны",
    assignTemplate: "Назначить шаблон спортсмену",
    athlete: "Спортсмен",
    template: "Шаблон",
    startDate: "Дата старта",
    dayLabel: "Название дня",
    coachNotes: "Заметки тренера",
    assignPlan: "Назначить план",
    activeAssignments: "Активные назначения",
    completed: "Выполнено",
    sets: "Подходы",
    reps: "Повторы",
    weightKg: "Вес, кг",
    durationMin: "Длительность, мин",
    rpe: "RPE",
    notes: "Заметки",
    saveExecution: "Сохранить выполнение",
    targetDuration: "Плановая длительность",
    targetRpe: "Плановый RPE",
    targetSets: "Плановые подходы",
    targetReps: "Плановые повторы",
    blockName: "Название блока",
    blockType: "Тип блока",
    blockPriority: "Приоритет",
    mandatory: "Обязательный",
  },
  bg: {
    language: "Език",
    authRoles: "Автентикация и роли",
    logout: "Изход",
    login: "Вход",
    register: "Регистрация",
    fullName: "Пълно име",
    email: "Имейл",
    password: "Парола",
    role: "Роля",
    signIn: "Вход",
    createAccount: "Създай акаунт",
    dailyReadiness: "Дневна форма за готовност",
    saveReadiness: "Запази готовността",
    assignedTrainingDay: "Назначен тренировъчен ден",
    adaptedDay: "Адаптиран ден",
    executionTracking: "Отчитане на изпълнение v1",
    analytics: "Анализ v2",
    coachDashboard: "Табло на треньора",
    executionReview: "Преглед на изпълнението",
    planEngine: "Планиращо студио",
    templateName: "Име на шаблона",
    description: "Описание",
    sportType: "Спорт",
    phaseFocus: "Фокус на фазата",
    priorityFocus: "Фокус на приоритета",
    templateGoal: "Цел на шаблона",
    microcycleType: "Тип микроцикъл",
    competitionSpecific: "Състезателна специфика",
    general: "Общ",
    allPriorities: "Всички приоритети",
    phase: "Фаза",
    priority: "Приоритет",
    templateBlocks: "Тренировъчни блокове",
    noPlanTemplates: "Все още няма създадени планови шаблони.",
    phaseDrivenRecommendations: "Препоръки според фазата",
    selectAthleteDateForRecommendations:
      "Изберете спортист и дата, за да заредите препоръчани шаблони за текущата състезателна фаза.",
    score: "Оценка",
    plannedPhase: "Планирана фаза",
    autoFromCompetitionContext: "Авто според състезание",
    createTemplate: "Създай шаблон",
    savedTemplates: "Запазени шаблони",
    assignTemplate: "Назначи шаблон на спортист",
    athlete: "Спортист",
    template: "Шаблон",
    startDate: "Начална дата",
    dayLabel: "Име на деня",
    coachNotes: "Бележки на треньора",
    assignPlan: "Назначи план",
    activeAssignments: "Активни назначения",
    completed: "Изпълнено",
    sets: "Серии",
    reps: "Повторения",
    weightKg: "Тежест, кг",
    durationMin: "Продължителност, мин",
    rpe: "RPE",
    notes: "Бележки",
    saveExecution: "Запази изпълнението",
    targetDuration: "Планирана продължителност",
    targetRpe: "Планиран RPE",
    targetSets: "Планирани серии",
    targetReps: "Планирани повторения",
    blockName: "Име на блок",
    blockType: "Тип блок",
    blockPriority: "Приоритет",
    mandatory: "Задължителен",
  },
};

export function translateReadinessReason(
  reason: ReadinessEntry["explanation"][number],
  language: Language,
) {
  const exact: Record<string, Record<Language, string>> = {
    fever: {
      en: "Fever was reported",
      ru: "Была указана температура",
      bg: "Отчетена е температура",
    },
    illness: {
      en: "Illness symptoms were reported",
      ru: "Были указаны симптомы болезни",
      bg: "Отчетени са симптоми на заболяване",
    },
    sleep_quality: {
      en: "Sleep quality is poor",
      ru: "Качество сна низкое",
      bg: "Качеството на съня е ниско",
    },
  };

  if (exact[reason.code]) {
    return exact[reason.code][language];
  }

  if (reason.code === "sleep_hours") {
    if (language === "ru") return `Сон снизился до ${reason.label.match(/\d+(\.\d+)?/)?.[0] ?? "?"} часов`;
    if (language === "bg") return `Сънят е спаднал до ${reason.label.match(/\d+(\.\d+)?/)?.[0] ?? "?"} часа`;
    return reason.label;
  }

  if (reason.code === "fatigue") {
    const score = reason.label.match(/\d+\/5/)?.[0] ?? "";
    if (language === "ru") return `Усталость ${score}`;
    if (language === "bg") return `Умора ${score}`;
    return reason.label;
  }

  if (reason.code === "soreness") {
    const score = reason.label.match(/\d+\/5/)?.[0] ?? "";
    if (language === "ru") return `Мышечная боль ${score}`;
    if (language === "bg") return `Мускулна болезненост ${score}`;
    return reason.label;
  }

  if (reason.code === "pain") {
    const score = reason.label.match(/\d+\/10/)?.[0] ?? "";
    if (language === "ru") return `Уровень боли ${score}`;
    if (language === "bg") return `Ниво на болка ${score}`;
    return reason.label;
  }

  if (reason.code === "resting_hr") {
    const delta = reason.label.match(/\d+/)?.[0] ?? "?";
    if (language === "ru") return `Пульс покоя на ${delta} уд/мин выше базового`;
    if (language === "bg") return `Пулсът в покой е с ${delta} уд/мин над базовия`;
    return reason.label;
  }

  return reason.label;
}

export function translateAdaptationText(text: string, language: Language) {
  const replacements: Array<[string, Record<Language, string>]> = [
    [
      "Green day: keep planned structure.",
      {
        en: "Green day: keep planned structure.",
        ru: "Зелёный день: сохранить плановую структуру.",
        bg: "Зелен ден: запази планираната структура.",
      },
    ],
    [
      "Yellow day: keep technical or supportive work unchanged.",
      {
        en: "Yellow day: keep technical or supportive work unchanged.",
        ru: "Жёлтый день: технику и поддерживающую работу оставить без изменений.",
        bg: "Жълт ден: техниката и поддържащата работа остават без промяна.",
      },
    ],
    [
      "Red day: high-load mandatory block replaced with a safe technical or recovery alternative.",
      {
        en: "Red day: high-load mandatory block replaced with a safe technical or recovery alternative.",
        ru: "Красный день: обязательный высоконагрузочный блок заменён безопасной технической или восстановительной альтернативой.",
        bg: "Червен ден: задължителният високоинтензивен блок е заменен с безопасна техническа или възстановителна алтернатива.",
      },
    ],
  ];

  for (const [source, localized] of replacements) {
    if (text === source) {
      return localized[language];
    }
  }

  if (text.includes("was removed on yellow day")) {
    const name = text.split(" was removed")[0];
    if (language === "ru") return `${name} удалён в жёлтый день, потому что removePriorityYellow >= 4.`;
    if (language === "bg") return `${name} е премахнат в жълт ден, защото removePriorityYellow >= 4.`;
  }

  if (text.includes("volume/intensity was reduced for a yellow readiness day")) {
    const name = text.split(" volume")[0];
    if (language === "ru") return `Объём/интенсивность ${name} снижены для жёлтого дня готовности.`;
    if (language === "bg") return `Обемът/интензивността на ${name} са намалени за жълт ден на готовност.`;
  }

  if (text.includes("stays because low-risk block types are preserved on red day")) {
    const name = text.split(" stays")[0];
    if (language === "ru") return `${name} сохранён, потому что низкорисковые типы блоков остаются в красный день.`;
    if (language === "bg") return `${name} остава, защото нискорисковите типове блокове се запазват в червен ден.`;
  }

  if (text.includes("was replaced by safe low-load work on red day")) {
    const name = text.split(" was replaced")[0];
    if (language === "ru") return `${name} заменён безопасной низконагрузочной работой в красный день.`;
    if (language === "bg") return `${name} е заменен с безопасна нисконатоварваща работа в червен ден.`;
  }

  if (text.includes("was removed on red day because it is a high-load optional block")) {
    const name = text.split(" was removed")[0];
    if (language === "ru") return `${name} удалён в красный день как высоконагрузочный необязательный блок.`;
    if (language === "bg") return `${name} е премахнат в червен ден като незадължителен високоинтензивен блок.`;
  }

  if (text.includes("Yellow day: reduce load by")) {
    const percent = text.match(/\d+/)?.[0] ?? "?";
    if (language === "ru") return `Жёлтый день: снизить нагрузку на ${percent}% и сохранить технический замысел.`;
    if (language === "bg") return `Жълт ден: намали натоварването с ${percent}% и запази техническия замисъл.`;
  }

  if (text.includes("Red day: keep only safe technical/recovery work and reduce by")) {
    const percent = text.match(/\d+/)?.[0] ?? "?";
    if (language === "ru") return `Красный день: оставить только безопасную технику/восстановление и снизить на ${percent}%.`;
    if (language === "bg") return `Червен ден: запази само безопасна техника/възстановяване и намали с ${percent}%.`;
  }

  return text;
}

export function translateAnalyticsWeekStatus(status: AnalyticsWeekStatus, language: Language) {
  const map: Record<AnalyticsWeekStatus, Record<Language, string>> = {
    upcoming: { en: "upcoming", ru: "впереди", bg: "предстои" },
    in_progress: { en: "in progress", ru: "в процессе", bg: "в процес" },
    completed: { en: "completed", ru: "завершена", bg: "завършена" },
  };

  return map[status][language];
}

export function translateAnalyticsInsightLevel(
  level: AnalyticsInsight["level"],
  language: Language,
) {
  const map: Record<AnalyticsInsight["level"], Record<Language, string>> = {
    info: { en: "info", ru: "инфо", bg: "инфо" },
    warning: { en: "warning", ru: "внимание", bg: "внимание" },
    critical: { en: "critical", ru: "критично", bg: "критично" },
  };

  return map[level][language];
}

export function translateAnalyticsMissingLink(link: string, language: Language) {
  const map: Record<string, Record<Language, string>> = {
    season: { en: "season", ru: "сезон", bg: "сезон" },
    competition_plan: { en: "competition plan", ru: "план старта", bg: "план за старт" },
    mesocycle: { en: "mesocycle", ru: "мезоцикл", bg: "мезоцикъл" },
    week: { en: "week", ru: "неделя", bg: "седмица" },
  };

  return map[link]?.[language] ?? link;
}

export function translateAnalyticsEvidenceLabel(label: string, language: Language) {
  const map: Record<string, Record<Language, string>> = {
    latest_readiness: {
      en: "Latest readiness",
      ru: "Последняя готовность",
      bg: "Последна готовност",
    },
    readiness_3d_avg: {
      en: "3-day readiness avg",
      ru: "Средняя готовность за 3 дня",
      bg: "Средна готовност за 3 дни",
    },
    expected_load_to_date: {
      en: "Expected load to date",
      ru: "Ожидаемая нагрузка к текущему дню",
      bg: "Очаквано натоварване до днес",
    },
    week_actual_load: {
      en: "Actual week load",
      ru: "Фактическая недельная нагрузка",
      bg: "Фактическо седмично натоварване",
    },
    latest_adherence: {
      en: "Latest adherence",
      ru: "Последнее соблюдение плана",
      bg: "Последно спазване на плана",
    },
    adherence_3d_avg: {
      en: "3-day adherence avg",
      ru: "Среднее соблюдение плана за 3 дня",
      bg: "Средно спазване на плана за 3 дни",
    },
    missed_blocks: {
      en: "Missed blocks",
      ru: "Пропущенные блоки",
      bg: "Пропуснати блокове",
    },
    week_microcycle: {
      en: "Week microcycle",
      ru: "Микроцикл недели",
      bg: "Микроцикъл на седмицата",
    },
    competition_phase: {
      en: "Competition phase",
      ru: "Соревновательная фаза",
      bg: "Състезателна фаза",
    },
    days_to_competition: {
      en: "Days to competition",
      ru: "Дней до старта",
      bg: "Дни до състезанието",
    },
    latest_load_delta: {
      en: "Latest load delta",
      ru: "Последняя дельта нагрузки",
      bg: "Последна делта на натоварването",
    },
    missing_links: {
      en: "Missing links",
      ru: "Отсутствующие звенья",
      bg: "Липсващи връзки",
    },
    readiness_range: {
      en: "Readiness range",
      ru: "Разброс готовности",
      bg: "Диапазон на готовността",
    },
    status_changes: {
      en: "Status changes",
      ru: "Смены статуса",
      bg: "Смени на статуса",
    },
    recovery_blocks: {
      en: "Recovery-support blocks",
      ru: "Восстановительные блоки",
      bg: "Възстановителни блокове",
    },
    recovery_adherence: {
      en: "Recovery adherence",
      ru: "Соблюдение восстановления",
      bg: "Спазване на възстановяването",
    },
    fatigue_load_share: {
      en: "Fatigue load share",
      ru: "Доля утомляющей нагрузки",
      bg: "Дял на уморяващото натоварване",
    },
    fatigue_block_type: {
      en: "Fatigue block type",
      ru: "Тип утомляющего блока",
      bg: "Тип уморяващ блок",
    },
    specific_adherence: {
      en: "Specific adherence",
      ru: "Соблюдение специальной работы",
      bg: "Спазване на специфичната работа",
    },
    specific_missed_blocks: {
      en: "Specific missed blocks",
      ru: "Пропущенные специальные блоки",
      bg: "Пропуснати специфични блокове",
    },
    strength_load_delivery: {
      en: "Strength load delivery",
      ru: "Доставка силовой нагрузки",
      bg: "Доставка на силовото натоварване",
    },
    strength_adherence: {
      en: "Strength adherence",
      ru: "Соблюдение силовой работы",
      bg: "Спазване на силовата работа",
    },
    strength_blocks: {
      en: "Strength blocks",
      ru: "Силовые блоки",
      bg: "Силови блокове",
    },
  };

  return map[label]?.[language] ?? label.replaceAll("_", " ");
}

export function translateAnalyticsInsightTitle(
  insight: AnalyticsInsight,
  language: Language,
) {
  const map: Record<AnalyticsInsight["code"], Record<Language, string>> = {
    fatigue_risk: {
      en: "Readiness is dropping under active load",
      ru: "Готовность снижается на фоне текущей нагрузки",
      bg: "Готовността спада при текущото натоварване",
    },
    adherence_risk: {
      en: "Execution adherence is slipping",
      ru: "Соблюдение плана по выполнению проседает",
      bg: "Спазването на плана при изпълнението спада",
    },
    load_spike: {
      en: "Weekly load is climbing too fast",
      ru: "Недельная нагрузка растёт слишком резко",
      bg: "Седмичното натоварване расте твърде рязко",
    },
    underload_risk: {
      en: "The week is under-loaded against intent",
      ru: "Неделя недогружена относительно замысла",
      bg: "Седмицата е недонатоварена спрямо замисъла",
    },
    taper_violation: {
      en: "Taper freshness is being violated",
      ru: "Свежесть в подводке нарушается",
      bg: "Свежестта преди старта се нарушава",
    },
    planning_chain_gap: {
      en: "Planning chain is incomplete",
      ru: "Планировочная цепочка неполная",
      bg: "Планиращата верига е непълна",
    },
    on_track: {
      en: "Current block is tracking well",
      ru: "Текущий блок идёт по плану",
      bg: "Текущият блок върви по план",
    },
  };

  return map[insight.code]?.[language] ?? insight.title;
}

export function translateAnalyticsInsightSummary(
  insight: AnalyticsInsight,
  language: Language,
) {
  const map: Record<AnalyticsInsight["code"], Record<Language, string>> = {
    fatigue_risk: {
      en: "Recent readiness is trending down while the athlete is still carrying meaningful load in the current week.",
      ru: "Последний тренд готовности идёт вниз, а спортсмен всё ещё несёт заметную нагрузку в текущей неделе.",
      bg: "Последната тенденция на готовността върви надолу, а спортистът все още носи осезаемо натоварване през текущата седмица.",
    },
    adherence_risk: {
      en: "Actual execution is falling behind the assigned work, so progression quality and analytics confidence are weakening.",
      ru: "Фактическое выполнение отстаёт от назначенной работы, поэтому качество прогрессии и уверенность аналитики снижаются.",
      bg: "Фактическото изпълнение изостава от назначената работа, затова качеството на прогресията и увереността в анализа спадат.",
    },
    load_spike: {
      en: "The current week is running above the expected load pace for the active planning context.",
      ru: "Текущая неделя идёт выше ожидаемого темпа нагрузки для активного планировочного контекста.",
      bg: "Текущата седмица върви над очакваното темпо на натоварване за активния контекст на планиране.",
    },
    underload_risk: {
      en: "Actual execution is materially below the load expected from the current block, so adaptation stimulus may be softer than planned.",
      ru: "Фактическое выполнение заметно ниже ожидаемой нагрузки блока, поэтому стимул адаптации может быть слабее запланированного.",
      bg: "Фактическото изпълнение е чувствително под очакваното натоварване на блока, така че адаптационният стимул може да е по-слаб от планираното.",
    },
    taper_violation: {
      en: "Close-to-competition load is still too dense for a taper or competition window, which can erode freshness without adding useful stimulus.",
      ru: "Нагрузка перед стартом всё ещё слишком плотная для подводки или соревновательного окна и может снижать свежесть без полезного стимула.",
      bg: "Натоварването преди старта все още е твърде плътно за предстартово намаляване или състезателен прозорец и може да намали свежестта без полезен стимул.",
    },
    planning_chain_gap: {
      en: "Analytics can still run, but the season-to-week context is partially missing for this athlete.",
      ru: "Аналитика может работать, но для этого спортсмена частично отсутствует контекст от сезона до недели.",
      bg: "Анализът може да работи, но за този спортист част от контекста от сезона до седмицата липсва.",
    },
    on_track: {
      en: "Readiness, execution, and load are aligned closely enough to the active plan that no immediate coach intervention is required.",
      ru: "Готовность, выполнение и нагрузка достаточно близко совпадают с активным планом, поэтому срочное вмешательство тренера не требуется.",
      bg: "Готовността, изпълнението и натоварването са достатъчно близо до активния план, затова не е нужна незабавна намеса на треньора.",
    },
  };

  return map[insight.code]?.[language] ?? insight.summary;
}

export function translateAnalyticsInsightRecommendation(
  insight: AnalyticsInsight,
  language: Language,
) {
  const map: Record<AnalyticsInsight["code"], Record<Language, string>> = {
    fatigue_risk: {
      en: "Reduce the next high-load slot, keep only essential specific work, and re-check readiness before adding volume back.",
      ru: "Снизьте ближайшую тяжёлую работу, оставьте только ключевую специальную часть и проверьте готовность перед возвратом объёма.",
      bg: "Намалете следващата тежка работа, оставете само ключовата специфична част и проверете готовността отново преди връщане на обема.",
    },
    adherence_risk: {
      en: "Review the blocker with the athlete, simplify the next 48 hours if needed, and protect the most important session instead of chasing missed volume.",
      ru: "Разберите блокер со спортсменом, при необходимости упростите ближайшие 48 часов и защищайте важнейшую сессию вместо догоняния пропущенного объёма.",
      bg: "Разгледайте блокера със спортиста, при нужда опростете следващите 48 часа и защитете най-важната сесия вместо да гоните пропуснат обем.",
    },
    load_spike: {
      en: "Trim the heaviest remaining day, reduce metabolic volume first, and keep only the block types that match the week intent.",
      ru: "Сократите самый тяжёлый оставшийся день, сначала снизьте объём утомляющей работы и оставьте только то, что соответствует цели недели.",
      bg: "Съкратете най-тежкия оставащ ден, първо намалете обема на уморяващата работа и оставете само това, което отговаря на целта на седмицата.",
    },
    underload_risk: {
      en: "Check whether sessions were missed, then either recover the key work or lower the planned target so the block stays honest.",
      ru: "Проверьте, не были ли пропущены сессии, затем либо верните ключевую работу, либо понизьте плановую цель, чтобы блок оставался честным.",
      bg: "Проверете дали не са пропуснати сесии, след което или върнете ключовата работа, или намалете планираната цел, за да остане блокът честен.",
    },
    taper_violation: {
      en: "Keep activation, mobility, and tactical sharpness, but remove fatiguing volume from the remaining days.",
      ru: "Сохраните активацию, мобильность и тактическую остроту, но уберите утомляющий объём из оставшихся дней.",
      bg: "Запазете активацията, мобилността и тактическата острота, но премахнете уморяващия обем от оставащите дни.",
    },
    planning_chain_gap: {
      en: "Link the active season, mesocycle, and competition plan so readiness and execution can be interpreted against the intended block.",
      ru: "Свяжите активный сезон, мезоцикл и план старта, чтобы готовность и выполнение оценивались в правильном контексте.",
      bg: "Свържете активния сезон, мезоцикъла и плана за старт, за да се оценяват готовността и изпълнението в правилния контекст.",
    },
    on_track: {
      en: "Hold the current week intent, monitor readiness daily, and adjust only if execution or freshness changes materially.",
      ru: "Сохраняйте текущий замысел недели, ежедневно отслеживайте готовность и меняйте курс только при заметном сдвиге выполнения или свежести.",
      bg: "Запазете текущия замисъл на седмицата, следете готовността всеки ден и коригирайте само при осезаема промяна в изпълнението или свежестта.",
    },
  };

  return map[insight.code]?.[language] ?? insight.recommendation;
}

export function translateAnalyticsPatternTitle(
  pattern: AnalyticsPattern,
  language: Language,
) {
  const map: Record<AnalyticsPattern["code"], Record<Language, string>> = {
    readiness_volatility: {
      en: "Readiness is oscillating inside the week",
      ru: "Готовность колеблется внутри недели",
      bg: "Готовността се колебае в рамките на седмицата",
    },
    recovery_gap: {
      en: "Recovery-support work is too thin for the week intent",
      ru: "Восстановительной работы недостаточно для замысла недели",
      bg: "Възстановителната работа е недостатъчна за замисъла на седмицата",
    },
    fatigue_block_density: {
      en: "Fatiguing block density is too high for the current context",
      ru: "Плотность утомляющих блоков слишком высока для текущего контекста",
      bg: "Плътността на уморяващите блокове е твърде висока за текущия контекст",
    },
    specific_block_drift: {
      en: "Specific work is drifting away from execution",
      ru: "Специальная работа уходит от фактического выполнения",
      bg: "Специфичната работа се отдалечава от реалното изпълнение",
    },
    strength_underdelivery: {
      en: "Strength stimulus is being under-delivered",
      ru: "Силовой стимул недополучается",
      bg: "Силовият стимул е недодаден",
    },
  };

  return map[pattern.code]?.[language] ?? pattern.title;
}

export function translateAnalyticsPatternSummary(
  pattern: AnalyticsPattern,
  language: Language,
) {
  const map: Record<AnalyticsPattern["code"], Record<Language, string>> = {
    readiness_volatility: {
      en: "Recent readiness is swinging sharply instead of stabilizing, which usually means the week rhythm is still too noisy.",
      ru: "Последняя готовность резко колеблется вместо стабилизации, что обычно означает слишком шумный ритм недели.",
      bg: "Последната готовност се колебае рязко вместо да се стабилизира, което обикновено означава твърде шумен ритъм на седмицата.",
    },
    recovery_gap: {
      en: "The current week does not contain enough recovery, mobility, or activation work for the active phase and competition proximity.",
      ru: "В текущей неделе недостаточно восстановления, мобильности или активации для активной фазы и близости старта.",
      bg: "В текущата седмица няма достатъчно възстановяване, мобилност или активация за активната фаза и близостта на старта.",
    },
    fatigue_block_density: {
      en: "A large share of the week is still coming from metabolic or CNS-heavy work, which increases fatigue carry-over into the next sessions.",
      ru: "Слишком большая доля недели всё ещё приходится на метаболическую работу или блоки с высокой нагрузкой на ЦНС, что переносит усталость в следующие сессии.",
      bg: "Твърде голяма част от седмицата все още идва от метаболитна работа или блокове с високо натоварване на ЦНС, което пренася умората в следващите сесии.",
    },
    specific_block_drift: {
      en: "Technical or speed-focused work is being missed or only partially executed, so the week may lose specificity at the wrong time.",
      ru: "Техническая или скоростная работа пропускается либо выполняется частично, из-за чего неделя теряет специфику в неподходящий момент.",
      bg: "Техническата или скоростната работа се пропуска или се изпълнява частично, така че седмицата може да загуби специфичност в неподходящ момент.",
    },
    strength_underdelivery: {
      en: "The current block is not reaching the planned strength work, which can flatten progression in a build-oriented phase.",
      ru: "Текущий блок не добирает плановую силовую работу, что может сгладить прогрессию в развивающей фазе.",
      bg: "Текущият блок не достига планираната силова работа, което може да забави прогресията в развиваща фаза.",
    },
  };

  return map[pattern.code]?.[language] ?? pattern.summary;
}

export function translateAnalyticsCoachSuggestionTitle(
  suggestion: AnalyticsCoachSuggestion,
  language: Language,
) {
  const map: Record<AnalyticsCoachSuggestion["id"], Record<Language, string>> = {
    "protect-taper-freshness": {
      en: "Protect taper freshness in planner",
      ru: "Сохранить свежесть перед стартом",
      bg: "Запазете свежестта преди старта",
    },
    "rebalance-recovery-density": {
      en: "Rebalance the week toward recovery",
      ru: "Усилить восстановление на неделе",
      bg: "Усилете възстановяването през седмицата",
    },
    "rescue-specific-work": {
      en: "Rescue the specific work slot",
      ru: "Сохранить специальную работу",
      bg: "Запазете специфичната работа",
    },
    "smooth-load-curve": {
      en: "Smooth the weekly load curve",
      ru: "Сгладить недельную кривую нагрузки",
      bg: "Изгладете седмичната крива на натоварването",
    },
    "restore-block-stimulus": {
      en: "Restore the intended block stimulus",
      ru: "Вернуть нужную нагрузку блока",
      bg: "Върнете нужното натоварване в блока",
    },
  };

  return map[suggestion.id]?.[language] ?? suggestion.title;
}

export function translateAnalyticsCoachSuggestionSummary(
  suggestion: AnalyticsCoachSuggestion,
  language: Language,
) {
  const map: Record<AnalyticsCoachSuggestion["id"], Record<Language, string>> = {
    "protect-taper-freshness": {
      en: "Open the active week in planning studio and convert the flagged fatiguing slot into activation or recovery work.",
      ru: "Откройте активную неделю и замените утомляющую работу на активацию или восстановление.",
      bg: "Отворете активната седмица и заменете уморяващата работа с активация или възстановяване.",
    },
    "rebalance-recovery-density": {
      en: "Use the weekly planner to insert more recovery-support work before fatigue accumulates further.",
      ru: "Добавьте восстановительную работу сейчас, пока усталость не накопилась сильнее.",
      bg: "Добавете възстановителна работа сега, преди умората да се натрупа повече.",
    },
    "rescue-specific-work": {
      en: "Specific execution is drifting, so open the planner and move or protect the targeted day before it is lost.",
      ru: "Специальная работа уходит от плана: перенесите или защитите нужный день, пока он не потерян.",
      bg: "Специфичната работа се отдалечава от плана: преместете или защитете нужния ден, преди да бъде загубен.",
    },
    "smooth-load-curve": {
      en: "The active week is climbing too fast, so use the planner to reduce the heaviest slot instead of carrying the spike forward.",
      ru: "Активная неделя растёт слишком резко, поэтому используйте планирование, чтобы снизить самый тяжёлый слот, а не переносить пик дальше.",
      bg: "Активната седмица расте твърде рязко, затова използвайте планирането, за да намалите най-тежкия слот, вместо да пренасяте пика напред.",
    },
    "restore-block-stimulus": {
      en: "The block is under-delivering against intent, so the next planner pass should add load back in the right slot instead of drifting quietly.",
      ru: "Блок недобирает нагрузку. Верните работу в подходящий день, чтобы не терять замысел подготовки.",
      bg: "Блокът не достига планираното натоварване. Върнете работата в подходящия ден, за да не се губи замисълът на подготовката.",
    },
  };

  return map[suggestion.id]?.[language] ?? suggestion.summary;
}

export function translateAnalyticsCoachSuggestionRecommendation(
  suggestion: AnalyticsCoachSuggestion,
  language: Language,
) {
  const map: Record<AnalyticsCoachSuggestion["id"], Record<Language, string>> = {
    "protect-taper-freshness": {
      en: "Load the weekly planner for this week and apply the taper-safe swap on the targeted day.",
      ru: "Откройте недельный план и замените тяжёлую работу на более лёгкую в нужный день.",
      bg: "Отворете седмичния план и заменете тежката работа с по-лека в нужния ден.",
    },
    "rebalance-recovery-density": {
      en: "Open the current week and convert the heaviest slot into a recovery day or lighter template.",
      ru: "Откройте текущую неделю и замените самый тяжёлый день на восстановление или лёгкий шаблон.",
      bg: "Отворете текущата седмица и заменете най-тежкия ден с възстановяване или по-лек шаблон.",
    },
    "rescue-specific-work": {
      en: "Open the active week, move the specific slot if needed, and preserve it from overlap or fatigue spillover.",
      ru: "Откройте активную неделю, перенесите специальную работу при необходимости и уберите пересечения.",
      bg: "Отворете активната седмица, преместете специфичната работа при нужда и премахнете припокриванията.",
    },
    "smooth-load-curve": {
      en: "Open the weekly planner and apply a load-reduction suggestion on the overloaded day.",
      ru: "Откройте недельное планирование и примените снижение нагрузки на перегруженный день.",
      bg: "Отворете седмичното планиране и приложете намаляване на натоварването в претоварения ден.",
    },
    "restore-block-stimulus": {
      en: "Open the current week and increase one of the lighter slots to better match the block target.",
      ru: "Откройте текущую неделю и усилите один из лёгких дней, чтобы попасть в цель блока.",
      bg: "Отворете текущата седмица и усилете един от леките дни, за да достигнете целта на блока.",
    },
  };

  return map[suggestion.id]?.[language] ?? suggestion.recommendation;
}

export function translateAnalyticsDecisionStatus(
  status: AnalyticsCoachActionDecisionStatus,
  language: Language,
) {
  const map: Record<AnalyticsCoachActionDecisionStatus, Record<Language, string>> = {
    applied: {
      en: "Applied",
      ru: "Применено",
      bg: "Приложено",
    },
    not_applied: {
      en: "Not applied",
      ru: "Не применено",
      bg: "Неприложено",
    },
  };

  return map[status][language];
}

export function translateAnalyticsDecisionOutcome(
  outcome: AnalyticsCoachActionOutcome,
  language: Language,
) {
  const map: Record<AnalyticsCoachActionOutcome, Record<Language, string>> = {
    pending: {
      en: "Pending",
      ru: "Ожидается",
      bg: "Изчаква",
    },
    positive: {
      en: "Positive",
      ru: "Позитивно",
      bg: "Положително",
    },
    neutral: {
      en: "Neutral",
      ru: "Нейтрально",
      bg: "Неутрално",
    },
    negative: {
      en: "Negative",
      ru: "Негативно",
      bg: "Негативно",
    },
  };

  return map[outcome][language];
}

export function translateAnalyticsDecisionOutcomeSource(
  source: AnalyticsCoachActionOutcomeSource,
  language: Language,
) {
  const map: Record<AnalyticsCoachActionOutcomeSource, Record<Language, string>> = {
    pending: {
      en: "Awaiting more data",
      ru: "Ждём больше данных",
      bg: "Очакват се още данни",
    },
    manual: {
      en: "Coach-marked outcome",
      ru: "Результат отмечен тренером",
      bg: "Резултатът е отбелязан от треньора",
    },
    automatic: {
      en: "Auto-evaluated from week data",
      ru: "Автооценка по данным недели",
      bg: "Автооценка по данните от седмицата",
    },
  };

  return map[source][language];
}

export function translateAnalyticsDecisionExplanation(
  decision: AnalyticsCoachActionDecision,
  language: Language,
) {
  if (decision.outcomeSource === "pending") {
    return language === "ru"
      ? "Для оценки эффекта системе нужно больше данных готовности и выполнения."
      : language === "bg"
        ? "За да оцени ефекта, системата има нужда от още данни за готовност и изпълнение."
        : "Outcome is waiting for more readiness/execution data before the system scores the effect.";
  }

  if (decision.outcome === "positive" && !decision.sourceStillActive) {
    return language === "ru"
      ? "Исходный сигнал риска больше не активен, а недельные метрики двигаются в правильную сторону."
      : language === "bg"
        ? "Първоначалният сигнал за риск вече не е активен, а седмичните метрики се движат в правилната посока."
        : "The original risk signal is no longer active and the weekly metrics are moving in the right direction.";
  }

  if (decision.outcome === "negative" && decision.sourceStillActive) {
    return decision.decisionStatus === "applied"
      ? language === "ru"
        ? "Действие применили, но исходный сигнал всё ещё активен и неделя не улучшилась достаточно."
        : language === "bg"
          ? "Действието е приложено, но първоначалният сигнал още е активен и седмицата не се е подобрила достатъчно."
          : "The action was applied, but the original signal is still active and the week has not improved enough."
      : language === "ru"
        ? "Предложение не применили, и исходный сигнал всё ещё активен в текущей неделе."
        : language === "bg"
          ? "Предложението не беше приложено и първоначалният сигнал още е активен в текущата седмица."
          : "The suggestion was not applied and the original signal is still active in the current week.";
  }

  return decision.decisionStatus === "applied"
    ? language === "ru"
      ? "Решение зафиксировано, но недельные сигналы пока смешанные, а не однозначно лучше."
      : language === "bg"
        ? "Решението е записано, но седмичните сигнали засега са смесени, а не ясно по-добри."
        : "The action is logged, but the weekly signals are still mixed rather than clearly better."
    : language === "ru"
      ? "Пропуск решения зафиксирован, но текущая неделя показывает смешанный эффект."
      : language === "bg"
        ? "Пропускът на решението е записан, но текущата седмица показва смесен ефект."
        : "The skipped action is logged, but the current week is showing a mixed effect.";
}

