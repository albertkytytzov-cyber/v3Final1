import {
  getDeviceWorkoutMetricExpectation,
  getDeviceWorkoutProfile,
  isDeviceWorkoutMetricRelevant,
  type DeviceWorkoutMetricKey,
} from "../workout-profiles.js";
import { MobileApiClient, MobileApiError } from "../api/client.js";
import {
  canSubmitSyncAction,
  getSyncActionRestrictionMessage,
  translateApiErrorMessage,
} from "../permissions.js";
import { readRuntimeConfig } from "../config.js";
import {
  isAppleHealthRuntime,
  readAppleHealthDailySummary,
  readAppleHealthDeviceWorkouts,
} from "../integrations/apple-health.js";
import {
  readMiFitnessHealthConnectDailySummary,
  readMiFitnessHealthConnectDeviceWorkouts,
} from "../integrations/health-connect.js";
import {
  ackDirectWatchActivityFiles,
  addDirectWatchPacketListener,
  addDirectWatchSessionListener,
  addDirectWatchSyncRequestListener,
  clearDirectWatchBackgroundSyncResult,
  getDirectWatchSessionStatus,
  getDirectWatchBackgroundSyncResult,
  configureDirectWatchSyncCoordinator,
  getDirectWatchSyncCoordinatorStatus,
  markDirectWatchSyncRequestHandled,
  getDirectWatchSyncServiceStatus,
  inspectDirectWatchDevice,
  isDirectWatchRuntime,
  loadDirectWatchRawCacheEntries,
  markDirectWatchRawCacheAcked,
  markDirectWatchRawCacheAckError,
  markDirectWatchRawCacheQueued,
  markDirectWatchRawCacheSubmitted,
  pairDirectWatchDevice,
  probeDirectWatchClassicSession,
  buildDirectWatchDailySyncPayloadFromProbe,
  readDirectWatchActivityInventory,
  readDirectWatchDailySync,
  notifyDirectWatchAppVisible,
  requestDirectWatchCoordinatorSync,
  scanDirectWatchDevices,
  startDirectWatchSession,
  stopDirectWatchSession,
  stopDirectWatchSyncService,
  syncDirectWatchService,
  unpairDirectWatchDevice,
} from "../integrations/direct-watch.js";
import type {
  DirectWatchDailySyncPayload,
  DirectWatchDecryptedPacket,
  DirectWatchSyncCoordinatorRequest,
  DirectWatchServiceSyncResult,
} from "../integrations/direct-watch.js";
import { readHuaweiHealthDailySummary } from "../integrations/huawei-health.js";
import {
  buildDirectWatchWeatherLocationPayload,
  fetchDirectWatchWeatherPayload,
  getDirectWatchWeatherLocation,
  resolveDirectWatchWeatherLocation,
} from "../integrations/watch-weather.js";
import {
  clearSession,
  loadCoachReadinessChartMetrics,
  loadCoachReadinessChartPeriod,
  loadDirectWatchConfig,
  loadQueue,
  loadSelectedAthleteId,
  loadSession,
  loadSnapshot,
  saveDirectWatchConfig,
  saveCoachReadinessChartMetrics,
  saveCoachReadinessChartPeriod,
  saveSelectedAthleteId,
  saveSession,
  saveSnapshot,
} from "../storage/local-store.js";
import type { DirectWatchLocalConfig } from "../storage/local-store.js";
import { createPendingAction, enqueueAction, flushSyncQueue } from "../sync/sync-queue.js";
import {
  estimateTrainingActualLoad,
  estimateTrainingBlockLoad,
  isDeviceWorkoutLinkablePlanBlock,
} from "../shared-runtime.js";
import type {
  AssignedBlockExercise,
  AssignedPlanBlock,
  AssignedPlanSummary,
  CoachReadinessChartMetric,
  CoachReadinessChartPeriod,
  CoachAthleteSummary,
  CoachDayAiPayload,
  CoachDayAiReview,
  CoachDiaryEntry,
  CoachDiaryEntryPayload,
  CompetitionPlanSummary,
  CompetitionResultPayload,
  DeviceHealthDailySummary,
  DeviceHealthDailySummaryPayload,
  DeviceHealthSample,
  DeviceHealthSampleMetric,
  DeviceWorkout,
  DeviceWorkoutLink,
  DeviceWorkoutLinkPayload,
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
  WatchDetailMetric,
  WatchDetailPeriod,
} from "../types/models.js";

type SubmitOrQueueResult = "queued" | "skipped" | "submitted";

const runtimeConfig = readRuntimeConfig();
const SHOW_DIRECT_WATCH_DIAGNOSTICS = false;
const DIRECT_WATCH_AUTH_KEY_PATTERN = /^[0-9a-f]{32}$/i;
const DIRECT_WATCH_SERVICE_KEEP_ALIVE_MS = 12 * 60 * 60 * 1000;
const DIRECT_WATCH_AUTO_SYNC_TICK_MS = 60 * 1000;
const DIRECT_WATCH_BACKGROUND_RESULT_TICK_MS = 60 * 1000;
const DIRECT_WATCH_AUTO_SYNC_START_DELAY_MS = 10 * 1000;
const DIRECT_WATCH_NATIVE_SYNC_RETRY_DELAY_MS = 15 * 1000;
const DIRECT_WATCH_SERVICE_STATUS_SETTLE_MS = 8_000;
const DIRECT_WATCH_HISTORY_SYNC_DAYS = 30;
const DIRECT_WATCH_HISTORY_SYNC_DAY_DELAY_MS = 350;
const COACH_READINESS_CHART_LIMIT = 4;
const DIRECT_WATCH_SYNC_ALREADY_RUNNING_MESSAGE =
  "PERFORM Sync уже синхронизирует часы. Данные обновятся автоматически.";
const DEVICE_WORKOUT_SERIES_RENDER_LIMIT = 1_600;
const WATCH_SLEEP_MIN_MEANINGFUL_MINUTES = 120;
const WATCH_SLEEP_SHORTER_TOLERANCE_MINUTES = 30;

interface UPlotInstance {
  destroy: () => void;
  setSize: (size: { height: number; width: number }) => void;
}

interface UPlotConstructor {
  new(options: Record<string, unknown>, data: number[][], target: HTMLElement): UPlotInstance;
}

interface UPlotWindow extends Window {
  uPlot?: UPlotConstructor;
}

interface MobileUPlotPayload {
  average?: number | null;
  color: string;
  format?: "decimal" | "integer" | "pace" | "percent";
  highColor?: string;
  label: string;
  lower: number;
  title: string;
  unit: string;
  upper: number;
  valueDecimals?: number;
  x: number[];
  y: number[];
}

let mobileUPlotPayloadSequence = 0;
const mobileUPlotPayloads = new Map<string, MobileUPlotPayload>();
const mobileUPlotTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});
const mobileDateFormatter = new Intl.DateTimeFormat("ru", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const mobileShortDateFormatter = new Intl.DateTimeFormat("ru", {
  day: "2-digit",
  month: "2-digit",
});
const mobileDateTimeFormatter = new Intl.DateTimeFormat("ru", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});
const mobileTimeFormatter = new Intl.DateTimeFormat("ru", {
  hour: "2-digit",
  minute: "2-digit",
});
const formattedDateCache = new Map<string, string>();
const formattedShortDateCache = new Map<string, string>();
const formattedDateTimeCache = new Map<string, string>();
const formattedTimeCache = new Map<string, string>();
const watchWorkoutHistoryGroupsCache = new WeakMap<DeviceWorkout[], Map<string, WatchWorkoutHistoryGroup[]>>();
const deviceWorkoutGraphSummaryCache = new WeakMap<DeviceWorkout, boolean>();
const deviceWorkoutGraphSeriesCache = new WeakMap<DeviceWorkout, Map<string, DeviceWorkoutGraphSeries[]>>();
const deviceWorkoutHeartRateDetailHtmlCache = new WeakMap<DeviceWorkout, Map<string, string>>();
const deviceWorkoutGraphTimeCache = new Map<string, number | null>();
const deviceWorkoutDisplayKeyCache = new WeakMap<DeviceWorkout, string>();
const deviceWorkoutCompletenessScoreCache = new WeakMap<DeviceWorkout, number>();

const TRAINING_ABBREVIATION_EXPLANATIONS: Record<string, string> = {
  "АНП": "Анаэробный порог. Граница между устойчивой работой и зоной, где усталость начинает быстро накапливаться. Если в плане указана работа около АнП, держи высокую, но контролируемую интенсивность без развала техники.",
  "HR": "Пульс / частота сердечных сокращений. Используется для контроля интенсивности нагрузки. Если указан диапазон HR, держи работу примерно в этом пульсовом коридоре, не уходя сильно выше или ниже.",
  "RPE": "Субъективная тяжесть нагрузки по шкале 1-10. 1-3 легко, 4-6 умеренно, 7-8 тяжело, 9-10 почти максимум. Помогает тренеру понять реальную нагрузку, даже если пульс или вес не отражают состояние.",
  "ИТ": "Интервальная тренировка. Работа выполняется отрезками: нагрузка, затем отдых или снижение интенсивности. Главная задача - выдерживать заданный ритм, качество выполнения и восстановление между отрезками.",
  "ЛМВ": "Локальная мышечная выносливость. Способность конкретной мышцы или группы мышц долго выполнять нагрузку без резкого падения качества. Обычно это длительные подходы, статодинамика, удержания или повторная работа без полного восстановления.",
  "ПАНО": "Порог анаэробного обмена. Интенсивность, при которой организм уже работает тяжело, но ещё способен удерживать нагрузку без быстрого закисления. Важно не сорваться в максимальный темп слишком рано.",
  "СДР": "Статодинамический режим. Силовая работа в медленном контролируемом темпе, часто без полного расслабления мышцы. Цель - длительное напряжение, локальная выносливость и контроль движения, а не максимальный вес.",
  "ТР": "Тренировочный режим. Рабочий режим выполнения задания: интенсивность, темп, характер нагрузки и степень контроля. Работа выполняется не соревновательно на максимум, а в заданном тренировочном качестве.",
};
const TRAINING_ABBREVIATION_PATTERN =
  /(^|[^\p{L}\p{N}])(АНП|HR|RPE|ИТ|ЛМВ|ПАНО|СДР|ТР)(?=$|[^\p{L}\p{N}])/giu;
type MobileAssignedPlanSession = AssignedPlanSummary["day"]["sessions"][number];

export function bootstrapMobileApp(root: HTMLElement) {
  const storedData = loadSnapshot();
  const initialData = normalizeMobileDataSnapshot(storedData);
  if (initialData.deviceWorkouts.length !== storedData.deviceWorkouts.length) {
    saveSnapshot(initialData);
  }
  const state: MobileAppState = {
    session: loadSession(runtimeConfig.apiBaseUrl),
    data: initialData,
    queue: loadQueue(),
    coachAiDiagnostic: null,
    coachAiStatus: null,
    coachDeviceWorkoutDetailId: null,
    directWatchDiagnostic: {
      classicProbe: null,
      devices: [],
      inspectedDeviceId: null,
      inspection: null,
      packets: [],
      scannedAt: null,
      session: null,
      syncCoordinatorStatus: null,
      serviceStatus: null,
    },
    aiReviewByDay: buildCoachAiReviewByDay(initialData.coachAiReviews),
    selectedScreen: "dashboard",
    selectedAthleteId: loadSelectedAthleteId(),
    selectedDayDate: todayValue(),
    coachReadinessChartMetrics: loadCoachReadinessChartMetrics(),
    coachReadinessChartPeriod: loadCoachReadinessChartPeriod(),
    executionDateFilter: null,
    executionEditDate: null,
    planDateFilter: null,
    readinessEditMode: false,
    watchDetailMetric: null,
    watchDetailPeriod: "day",
    watchExpandedWorkoutId: null,
    watchExpandedWorkoutGraphId: null,
    watchWorkoutHistoryOpen: false,
    watchWorkoutHistoryPeriod: "day",
    watchWorkoutDetailId: null,
    watchSettingsOpen: false,
    isOnline: navigator.onLine,
    isBusy: false,
    isSyncing: false,
    message: null,
    error: null,
  };
  let mountedUPlotCharts: UPlotInstance[] = [];

  const update = (patch: Partial<MobileAppState>) => {
    Object.assign(state, patch);
    render();
  };

  const updateWatchState = (patch: Partial<MobileAppState>) => {
    Object.assign(state, patch);
    renderWatchPanel();
  };

  const scrollToScreenTop = () => {
    window.requestAnimationFrame(() => window.scrollTo({ left: 0, top: 0 }));
  };

  const openWatchWorkoutDetail = (workoutId: string) => {
    updateWatchState({
      watchDetailMetric: null,
      watchExpandedWorkoutId: null,
      watchExpandedWorkoutGraphId: null,
      watchWorkoutDetailId: workoutId,
      watchSettingsOpen: false,
    });
    scrollToScreenTop();
    void hydrateDeviceWorkoutSamples(workoutId);
  };

  const openWatchWorkoutHistory = () => {
    updateWatchState({
      watchDetailMetric: null,
      watchExpandedWorkoutId: null,
      watchExpandedWorkoutGraphId: null,
      watchWorkoutHistoryOpen: true,
      watchWorkoutDetailId: null,
      watchSettingsOpen: false,
    });
    scrollToScreenTop();
  };

  const closeWatchWorkoutHistory = () => {
    updateWatchState({
      watchExpandedWorkoutId: null,
      watchExpandedWorkoutGraphId: null,
      watchWorkoutHistoryOpen: false,
      watchWorkoutDetailId: null,
    });
    scrollToScreenTop();
  };

  const closeWatchWorkoutDetail = () => {
    updateWatchState({ watchWorkoutDetailId: null });
    scrollToScreenTop();
  };

  const destroyMountedUPlotCharts = () => {
    mountedUPlotCharts.forEach((chart) => chart.destroy());
    mountedUPlotCharts = [];
    resetMobileUPlotPayloads();
  };

  const bindWatchPanelEvents = (scope: ParentNode) => {
    scope.querySelectorAll<HTMLButtonElement>("[data-watch-detail]").forEach((button) => {
      button.addEventListener("click", () => {
        updateWatchState({
          watchDetailMetric: (button.dataset.watchDetail as WatchDetailMetric) || null,
          watchDetailPeriod: "day",
          watchExpandedWorkoutId: null,
          watchExpandedWorkoutGraphId: null,
          watchWorkoutHistoryOpen: false,
          watchWorkoutDetailId: null,
          watchSettingsOpen: false,
        });
        scrollToScreenTop();
      });
    });

    scope.querySelectorAll<HTMLButtonElement>("[data-watch-detail-back]").forEach((button) => {
      button.addEventListener("click", () => {
        updateWatchState({
          watchDetailMetric: null,
          watchExpandedWorkoutId: null,
          watchExpandedWorkoutGraphId: null,
          watchWorkoutDetailId: null,
        });
        scrollToScreenTop();
      });
    });

    scope.querySelectorAll<HTMLButtonElement>("[data-watch-detail-period]").forEach((button) => {
      button.addEventListener("click", () => {
        state.watchDetailPeriod = (button.dataset.watchDetailPeriod as WatchDetailPeriod) || "day";
        renderWatchPanel();
      });
    });

    scope.querySelectorAll<HTMLButtonElement>("[data-watch-settings-open]").forEach((button) => {
      button.addEventListener("click", () => {
        updateWatchState({
          watchDetailMetric: null,
          watchExpandedWorkoutId: null,
          watchExpandedWorkoutGraphId: null,
          watchWorkoutHistoryOpen: false,
          watchWorkoutDetailId: null,
          watchSettingsOpen: true,
        });
        scrollToScreenTop();
      });
    });

    scope.querySelectorAll<HTMLButtonElement>("[data-watch-settings-back]").forEach((button) => {
      button.addEventListener("click", () => {
        updateWatchState({
          watchExpandedWorkoutId: null,
          watchExpandedWorkoutGraphId: null,
          watchWorkoutDetailId: null,
          watchSettingsOpen: false,
        });
        scrollToScreenTop();
      });
    });

    scope.querySelectorAll<HTMLButtonElement>("[data-watch-workouts-open]").forEach((button) => {
      button.addEventListener("click", () => {
        openWatchWorkoutHistory();
      });
    });

    scope.querySelectorAll<HTMLButtonElement>("[data-watch-workouts-back]").forEach((button) => {
      button.addEventListener("click", () => {
        closeWatchWorkoutHistory();
      });
    });

    scope.querySelectorAll<HTMLButtonElement>("[data-watch-workouts-period]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextPeriod = (button.dataset.watchWorkoutsPeriod as WatchDetailPeriod) || "day";
        updateWatchWorkoutHistoryPeriod(nextPeriod);
      });
    });

    scope.querySelectorAll<HTMLButtonElement>("[data-watch-workout-open]").forEach((button) => {
      button.addEventListener("click", () => {
        const workoutId = button.dataset.watchWorkoutOpen;
        if (workoutId) {
          openWatchWorkoutDetail(workoutId);
        }
      });
    });

    scope.querySelectorAll<HTMLButtonElement>("[data-watch-workout-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const workoutId = button.dataset.watchWorkoutToggle;
        if (!workoutId) {
          return;
        }

        const isOpening = state.watchExpandedWorkoutId !== workoutId;
        updateWatchState({
          watchExpandedWorkoutId: isOpening ? workoutId : null,
          watchExpandedWorkoutGraphId: null,
          watchWorkoutDetailId: null,
        });
        scrollToScreenTop();
        if (isOpening) {
          void hydrateDeviceWorkoutSamples(workoutId);
        }
      });
    });

    scope.querySelectorAll<HTMLButtonElement>("[data-watch-workout-graph]").forEach((button) => {
      button.addEventListener("click", () => {
        const workoutId = button.dataset.watchWorkoutGraph;
        if (!workoutId) {
          return;
        }

        updateWatchState({
          watchDetailMetric: null,
          watchExpandedWorkoutId: workoutId,
          watchExpandedWorkoutGraphId: null,
          watchWorkoutDetailId: workoutId,
        });
        scrollToScreenTop();
        void hydrateDeviceWorkoutSamples(workoutId);
      });
    });

    scope.querySelectorAll<HTMLButtonElement>("[data-watch-workout-detail-back]").forEach((button) => {
      button.addEventListener("click", () => {
        closeWatchWorkoutDetail();
      });
    });

    scope.querySelectorAll<HTMLButtonElement>("[data-direct-watch-scan]").forEach((button) => {
      button.addEventListener("click", () => {
        void scanDirectWatch();
      });
    });

    scope.querySelector<HTMLButtonElement>("[data-direct-watch-auth-key-save]")?.addEventListener("click", () => {
      saveDirectWatchAuthKey();
    });

    scope.querySelector<HTMLButtonElement>("[data-direct-watch-weather-save]")?.addEventListener("click", () => {
      void saveDirectWatchWeatherLocation();
    });

    scope.querySelectorAll<HTMLButtonElement>("[data-direct-watch-select]").forEach((button) => {
      button.addEventListener("click", () => {
        selectDirectWatchDevice(button.dataset.directWatchSelect ?? "");
      });
    });

    scope.querySelectorAll<HTMLButtonElement>("[data-direct-watch-full-sync]").forEach((button) => {
      button.addEventListener("click", () => {
        void syncDirectWatchFull(
          button.dataset.directWatchFullSyncDate || todayValue(),
          button.dataset.directWatchFullSync || null,
        );
      });
    });

    scope.querySelectorAll<HTMLButtonElement>("[data-direct-watch-sync]").forEach((button) => {
      button.addEventListener("click", () => {
        void syncDirectWatch(
          button.dataset.directWatchSyncDate ?? todayValue(),
          button.dataset.directWatchSync ?? null,
        );
      });
    });

    scope.querySelectorAll<HTMLButtonElement>("[data-direct-watch-history-sync]").forEach((button) => {
      button.addEventListener("click", () => {
        void syncDirectWatchHistory(button.dataset.directWatchHistorySync ?? null);
      });
    });

    scope.querySelectorAll<HTMLButtonElement>("[data-direct-watch-service-sync]").forEach((button) => {
      button.addEventListener("click", () => {
        void syncDirectWatchServiceSettings(button.dataset.directWatchServiceSync ?? null);
      });
    });

    scope.querySelectorAll<HTMLButtonElement>("[data-direct-watch-service-status]").forEach((button) => {
      button.addEventListener("click", () => {
        void refreshDirectWatchSyncService();
      });
    });

    scope.querySelectorAll<HTMLButtonElement>("[data-direct-watch-service-stop]").forEach((button) => {
      button.addEventListener("click", () => {
        void stopDirectWatchForegroundService();
      });
    });

    scope.querySelectorAll<HTMLButtonElement>("[data-direct-watch-inspect]").forEach((button) => {
      button.addEventListener("click", () => {
        void inspectDirectWatch(button.dataset.directWatchInspect ?? "");
      });
    });

    scope.querySelectorAll<HTMLButtonElement>("[data-direct-watch-pair]").forEach((button) => {
      button.addEventListener("click", () => {
        void pairDirectWatch(button.dataset.directWatchPair ?? "");
      });
    });

    scope.querySelectorAll<HTMLButtonElement>("[data-direct-watch-unpair]").forEach((button) => {
      button.addEventListener("click", () => {
        void unpairDirectWatch(button.dataset.directWatchUnpair ?? "");
      });
    });

    scope.querySelectorAll<HTMLButtonElement>("[data-direct-watch-classic-probe]").forEach((button) => {
      button.addEventListener("click", () => {
        void probeDirectWatchClassic(button.dataset.directWatchClassicProbe ?? "");
      });
    });

    scope.querySelectorAll<HTMLButtonElement>("[data-direct-watch-auth-probe]").forEach((button) => {
      button.addEventListener("click", () => {
        void probeDirectWatchClassic(button.dataset.directWatchAuthProbe ?? "", true);
      });
    });

    scope.querySelectorAll<HTMLButtonElement>("[data-direct-watch-session-start]").forEach((button) => {
      button.addEventListener("click", () => {
        void startDirectWatchConnection(button.dataset.directWatchSessionStart ?? "");
      });
    });

    scope.querySelectorAll<HTMLButtonElement>("[data-direct-watch-session-stop]").forEach((button) => {
      button.addEventListener("click", () => {
        void stopDirectWatchConnection();
      });
    });

    scope.querySelectorAll<HTMLButtonElement>("[data-direct-watch-session-refresh]").forEach((button) => {
      button.addEventListener("click", () => {
        void refreshDirectWatchSession();
      });
    });
  };

  const renderWatchPanel = () => {
    const panel = root.querySelector<HTMLElement>(".screen-panel");
    const athleteId = getActiveAthleteId(state);
    if (!panel || state.selectedScreen !== "watches" || !athleteId) {
      render();
      return;
    }

    root.querySelector<HTMLElement>(".mobile-shell")?.classList.toggle(
      "is-watch-detail",
      isWatchSubscreenActive(state),
    );
    destroyMountedUPlotCharts();
    panel.innerHTML = renderScreen(state, athleteId);
    bindWatchPanelEvents(panel);
    mountedUPlotCharts = mountMobileUPlotCharts(panel);
  };

  function updateWatchWorkoutHistoryPeriod(nextPeriod: WatchDetailPeriod) {
    if (state.watchWorkoutHistoryPeriod === nextPeriod) {
      return;
    }

    state.watchWorkoutHistoryPeriod = nextPeriod;
    renderWatchPanel();
  }

  const rememberDirectWatchConfig = (patch: Partial<DirectWatchLocalConfig>) => {
    saveDirectWatchConfig({
      ...loadDirectWatchConfig(),
      ...patch,
    });
  };

  let directWatchAutoSyncTimer: ReturnType<typeof window.setInterval> | null = null;
  let directWatchNativeSyncRetryTimer: ReturnType<typeof window.setTimeout> | null = null;
  let directWatchBridgeEnsureInFlight = false;
  let directWatchHistorySyncInFlight = false;
  let directWatchNativeSyncInFlight = false;
  let directWatchServiceSyncInFlight = false;

  const syncDirectWatchNativeCoordinatorConfig = async (
    config: DirectWatchLocalConfig = loadDirectWatchConfig(),
  ) => {
    if (!isDirectWatchRuntime()) {
      return;
    }

    const syncCoordinatorStatus = await configureDirectWatchSyncCoordinator({
      authKeyHex: config.authKeyHex,
      deviceId: config.deviceId,
      deviceName: config.deviceName,
      enabled: Boolean(config.deviceId && config.authKeyHex),
      weather: config.deviceId && config.authKeyHex
        ? buildDirectWatchWeatherLocationPayload(config)
        : null,
    }).catch(() => undefined);

    if (syncCoordinatorStatus) {
      update({
        directWatchDiagnostic: {
          ...state.directWatchDiagnostic,
          syncCoordinatorStatus,
        },
      });
    }
  };

  const handleDirectWatchNativeSyncRequest = async (request: DirectWatchSyncCoordinatorRequest) => {
    if (!request.requested || !request.deviceId) {
      return;
    }

    if (
      directWatchNativeSyncInFlight ||
      directWatchServiceSyncInFlight ||
      state.isBusy ||
      directWatchHistorySyncInFlight
    ) {
      scheduleDirectWatchNativeSyncRetry(request);
      return;
    }

    directWatchNativeSyncInFlight = true;
    try {
      const completed = await processDirectWatchBackgroundSyncResult({ allowNativeInFlight: true });
      const syncCoordinatorStatus = await markDirectWatchSyncRequestHandled(
        request.id,
        completed ? "synced" : "service-queued",
      ).catch(() => undefined);
      if (syncCoordinatorStatus) {
        update({
          directWatchDiagnostic: {
            ...state.directWatchDiagnostic,
            syncCoordinatorStatus,
          },
        });
      }
    } finally {
      directWatchNativeSyncInFlight = false;
    }
  };

  const scheduleDirectWatchNativeSyncRetry = (
    request: DirectWatchSyncCoordinatorRequest,
    delayMs = DIRECT_WATCH_NATIVE_SYNC_RETRY_DELAY_MS,
  ) => {
    if (directWatchNativeSyncRetryTimer !== null) {
      return;
    }

    directWatchNativeSyncRetryTimer = window.setTimeout(() => {
      directWatchNativeSyncRetryTimer = null;
      void handleDirectWatchNativeSyncRequest(request);
    }, delayMs);
  };

  if (isDirectWatchRuntime()) {
    void syncDirectWatchNativeCoordinatorConfig();
    void addDirectWatchPacketListener((packet) => {
      update({
        directWatchDiagnostic: {
          ...state.directWatchDiagnostic,
          packets: [packet, ...state.directWatchDiagnostic.packets].slice(0, 8),
          session: state.directWatchDiagnostic.session
            ? {
                ...state.directWatchDiagnostic.session,
                lastPacket: packet,
                packetCount: Math.max(
                  state.directWatchDiagnostic.session.packetCount ?? 0,
                  packet.packetIndex ?? 0,
                ),
              }
            : state.directWatchDiagnostic.session,
        },
      });
    });
    void addDirectWatchSessionListener((session) => {
      update({
        directWatchDiagnostic: {
          ...state.directWatchDiagnostic,
          packets: session.packets?.length ? session.packets : state.directWatchDiagnostic.packets,
          session,
        },
      });
    });
    void addDirectWatchSyncRequestListener((request) => {
      window.setTimeout(() => {
        void handleDirectWatchNativeSyncRequest(request);
      }, 0);
    });
    void getDirectWatchSyncServiceStatus().then((serviceStatus) => {
      update({
        directWatchDiagnostic: {
          ...state.directWatchDiagnostic,
          serviceStatus,
        },
      });
    }).catch(() => {
      // Статус служебного режима не критичен для запуска приложения.
    });
    void getDirectWatchSyncCoordinatorStatus().then((syncCoordinatorStatus) => {
      update({
        directWatchDiagnostic: {
          ...state.directWatchDiagnostic,
          syncCoordinatorStatus,
        },
      });
    }).catch(() => {
      // Координатор нужен только для диагностики фоновой синхронизации.
    });
  }

  let refreshData: (silent?: boolean) => Promise<void>;

  const updateSelectedDayDate = (
    date: string,
    selectedScreen?: MobileScreen,
    selectedAthleteId?: string | null,
  ) => {
    const selectedDayDate = normalizeDateValue(date) ?? todayValue();
    const nextSelectedAthleteId = selectedAthleteId !== undefined
      ? selectedAthleteId
      : state.selectedAthleteId;
    const shouldReloadDayData = isCoachRole(state.session.user?.role) &&
      (
        selectedDayDate !== state.selectedDayDate ||
        nextSelectedAthleteId !== state.selectedAthleteId
      );

    update({
      coachDeviceWorkoutDetailId: null,
      executionDateFilter: selectedDayDate,
      planDateFilter: selectedDayDate,
      ...(selectedScreen ? { selectedScreen } : {}),
      ...(selectedAthleteId !== undefined ? { selectedAthleteId } : {}),
      selectedDayDate,
    });

    if (shouldReloadDayData) {
      void refreshData(true);
    }
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
        message: "Разбор дня сформирован. План и дневник не изменены.",
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
    destroyMountedUPlotCharts();
    root.innerHTML = state.session.user ? renderAppShell(state) : renderLogin(state);
    bindEvents();
    mountedUPlotCharts = mountMobileUPlotCharts(root);
  };

  refreshData = async (silent = false) => {
    if (!state.session.user) {
      return;
    }

    if (!silent) {
      update({ error: null, isBusy: true, message: null });
    }

    try {
      const api = client();
      const auth = await api.me();
      const requestedDayDate = state.selectedDayDate;
      const [
        loadedData,
        coachAiStatus,
      ] = await Promise.all([
        api.loadAppData(
          auth.user.role,
          requestedDayDate,
          isCoachRole(auth.user.role) && state.selectedScreen !== "dashboard"
            ? state.selectedAthleteId
            : null,
        ),
        isCoachRole(auth.user.role)
          ? api.getCoachAiReviewStatus().catch(() => ({ status: null }))
          : Promise.resolve({ status: null }),
      ]);

      if (isCoachRole(auth.user.role) && state.selectedDayDate !== requestedDayDate) {
        if (!silent) {
          update({ isBusy: false });
        }
        return;
      }

      const snapshot = normalizeMobileDataSnapshot({
        ...state.data,
        ...loadedData,
        savedAt: new Date().toISOString(),
      });
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
        message: silent ? state.message : null,
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
    const hasSyncChanges = result.syncedCount > 0 || result.invalidatedCount > 0;

    update({
      isSyncing: false,
      message: hasSyncChanges ? formatSyncResultMessage(result.syncedCount, result.invalidatedCount) : null,
      queue: result.queue,
    });

    if (result.syncedCount > 0) {
      await ackDirectWatchRawCachesAfterQueueFlush().catch(() => undefined);
      await refreshData(true);
    }
  };

  const handleLogin = async (form: HTMLFormElement) => {
    const formData = new FormData(form);
    const apiBaseUrl = runtimeConfig.apiBaseUrl || state.session.apiBaseUrl;
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
      update({ data: snapshot, readinessEditMode: false });
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

  const syncDeviceHealth = async (entryDate: string) => {
    if (state.session.user?.role !== "athlete") {
      update({
        error: "Синхронизацию часов выполняет спортсмен в своём приложении.",
        isBusy: false,
        message: null,
      });
      return;
    }

    update({ error: null, isBusy: true, message: "Синхронизирую данные часов..." });

    if (isAppleHealthRuntime()) {
      try {
        const payload = await readAppleHealthDailySummary(entryDate);
        const workoutsPayload = await readAppleHealthDeviceWorkouts(entryDate).catch(() => null);
        await submitDeviceHealthPayload(payload);

        if (workoutsPayload && workoutsPayload.workouts.length > 0) {
          await submitDeviceWorkoutsPayload(workoutsPayload);
        }

        return;
      } catch (error) {
        update({
          error: error instanceof Error ? error.message : "Apple Health недоступен.",
          isBusy: false,
          message: null,
        });
        return;
      }
    }

    let directWatchError: unknown = null;
    const directWatchConfig = loadDirectWatchConfig();
    if (isDirectWatchRuntime() && directWatchConfig.deviceId && directWatchConfig.authKeyHex) {
      try {
        update({ error: null, isBusy: true, message: "PERFORM Sync читает день напрямую с часов..." });
        const { payload, payloadError, serviceBusy, serviceResult } = await readDirectWatchDailyWithServiceSession(
          entryDate,
          directWatchConfig.deviceId,
          directWatchConfig,
        );
        if (!payload) {
          if (serviceBusy) {
            update({
              error: null,
              isBusy: false,
              message: DIRECT_WATCH_SYNC_ALREADY_RUNNING_MESSAGE,
            });
            return;
          }
          throw payloadError instanceof Error
            ? payloadError
            : new Error("PERFORM Sync не смог считать день с часов.");
        }
        await submitDirectWatchSyncPayload(payload, { silent: true });
        await refreshData(true).catch(() => undefined);
        update({
          error: null,
          isBusy: false,
          message: formatDirectWatchDailySyncResultMessage(payload, serviceResult),
        });
        return;
      } catch (error) {
        directWatchError = error;
      }
    }

    let healthConnectError: unknown = null;
    try {
      const payload = await readMiFitnessHealthConnectDailySummary(entryDate);
      const workoutsPayload = await readMiFitnessHealthConnectDeviceWorkouts(entryDate).catch(() => null);
      await submitDeviceHealthPayload(payload);

      if (workoutsPayload && workoutsPayload.workouts.length > 0) {
        await submitDeviceWorkoutsPayload(workoutsPayload);
      }

      return;
    } catch (error) {
      healthConnectError = error;
    }

    try {
      const payload = await readHuaweiHealthDailySummary(entryDate);
      await submitDeviceHealthPayload(payload);
    } catch (error) {
      update({
        error: directWatchError instanceof Error
            ? directWatchError.message
          : error instanceof Error
            ? error.message
          : healthConnectError instanceof Error
            ? healthConnectError.message
            : "Данные часов недоступны.",
        isBusy: false,
        message: null,
      });
    }
  };

  const readDirectWatchDailyWithServiceSession = async (
    entryDate: string,
    targetDeviceId: string,
    _config: ReturnType<typeof loadDirectWatchConfig>,
  ) => {
    let payload: DirectWatchDailySyncPayload | null = null;
    let payloadError: unknown = null;
    let serviceResult: DirectWatchServiceSyncResult | null = null;
    let serviceBusy = false;
    const serviceOk = await syncDirectWatchServiceSettings(targetDeviceId, {
      entryDate,
      fetchActivity: true,
      includeSleep: shouldFetchDirectWatchSleep(state.data, entryDate),
      silent: true,
      onResult: (result) => {
        serviceResult = result;
      },
    });

    if (serviceResult) {
      serviceBusy = isDirectWatchSyncAlreadyRunningResult(serviceResult);
      if (serviceBusy) {
        payloadError = new Error(DIRECT_WATCH_SYNC_ALREADY_RUNNING_MESSAGE);
      } else {
        try {
          payload = buildDirectWatchDailySyncPayloadFromProbe(entryDate, targetDeviceId, serviceResult);
        } catch (error) {
          payloadError = error;
        }
      }
    } else if (!serviceOk) {
      const serviceError = loadDirectWatchConfig().lastServiceError || "PERFORM Sync не смог открыть прямую сессию часов.";
      serviceBusy = isDirectWatchSyncAlreadyRunningMessage(serviceError);
      payloadError = new Error(serviceBusy ? DIRECT_WATCH_SYNC_ALREADY_RUNNING_MESSAGE : serviceError);
    }

    const completedServiceResult = serviceResult as DirectWatchServiceSyncResult | null;
    if (serviceBusy) {
      return {
        payload,
        payloadError,
        serviceBusy,
        serviceOk,
        serviceResult,
      };
    }

    const activityDiagnostic = buildDirectWatchActivitySyncDiagnostic(payload, completedServiceResult, payloadError);
    const serviceSyncedAt = completedServiceResult?.syncedAt ?? activityDiagnostic.syncedAt;
    const serviceSyncOk = isDirectWatchServiceSyncSuccessful(completedServiceResult);
    const currentServiceConfig = loadDirectWatchConfig();
    rememberDirectWatchConfig({
      lastActivitySyncAt: activityDiagnostic.syncedAt,
      lastActivitySyncDiagnostic: activityDiagnostic.message,
      lastActivitySyncFileCount: activityDiagnostic.fileCount,
      lastActivitySyncSportsFileCount: activityDiagnostic.sportsFileCount,
      lastActivitySyncStatus: activityDiagnostic.status,
      lastActivitySyncWorkoutCount: activityDiagnostic.workoutCount,
      ...(serviceSyncOk && completedServiceResult
        ? {
            lastServiceError: null,
            lastServiceBridgeUntil: currentServiceConfig.lastServiceBridgeUntil,
            lastServiceStatus: currentServiceConfig.lastServiceStatus,
            lastServiceSyncedAt: serviceSyncedAt,
            lastServiceUpdatedAt: currentServiceConfig.lastServiceUpdatedAt ?? serviceSyncedAt,
          }
        : {}),
    });

    return {
      payload,
      payloadError,
      serviceBusy,
      serviceOk,
      serviceResult,
    };
  };

  async function processDirectWatchBackgroundSyncResult(options: { allowNativeInFlight?: boolean } = {}) {
    if (!isDirectWatchRuntime() || state.session.user?.role !== "athlete") {
      return false;
    }

    if ((!options.allowNativeInFlight && directWatchNativeSyncInFlight) || directWatchHistorySyncInFlight) {
      return false;
    }

    const backgroundResult = await getDirectWatchBackgroundSyncResult().catch(() => null);
    if (!backgroundResult) {
      return false;
    }

    const config = loadDirectWatchConfig();
    const entryDate = backgroundResult.backgroundEntryDate || todayValue();
    const deviceId = backgroundResult.backgroundDeviceId || config.deviceId;
    if (!deviceId) {
      return false;
    }

    directWatchNativeSyncInFlight = true;
    try {
      const payload = buildDirectWatchDailySyncPayloadFromProbe(entryDate, deviceId, backgroundResult);
      await submitDirectWatchSyncPayload(payload, { silent: true, skipWatchAck: true });
      const activityDiagnostic = buildDirectWatchActivitySyncDiagnostic(payload, backgroundResult, null);
      rememberDirectWatchConfig({
        lastActivitySyncAt: activityDiagnostic.syncedAt,
        lastActivitySyncDiagnostic: activityDiagnostic.message,
        lastActivitySyncFileCount: activityDiagnostic.fileCount,
        lastActivitySyncSportsFileCount: activityDiagnostic.sportsFileCount,
        lastActivitySyncStatus: activityDiagnostic.status,
        lastActivitySyncWorkoutCount: activityDiagnostic.workoutCount,
        lastServiceSyncedAt: backgroundResult.syncedAt ?? activityDiagnostic.syncedAt,
        lastServiceUpdatedAt: backgroundResult.backgroundSavedAt ?? backgroundResult.syncedAt ?? activityDiagnostic.syncedAt,
      });
      await clearDirectWatchBackgroundSyncResult().catch(() => undefined);
      const serviceStatus = await getDirectWatchSyncServiceStatus().catch(() => null);
      update({
        directWatchDiagnostic: {
          ...state.directWatchDiagnostic,
          classicProbe: backgroundResult,
          ...(serviceStatus ? { serviceStatus } : {}),
        },
      });
      return true;
    } catch (error) {
      rememberDirectWatchConfig({
        lastActivitySyncDiagnostic: error instanceof Error
          ? error.message
          : "Фоновая синхронизация часов сохранена, но не обработана.",
        lastActivitySyncStatus: "error",
        lastServiceUpdatedAt: new Date().toISOString(),
      });
      return false;
    } finally {
      directWatchNativeSyncInFlight = false;
    }
  }

  const syncDirectWatch = async (
    entryDate: string,
    deviceId?: string | null,
    options: { silent?: boolean } = {},
  ) => {
    if (state.session.user?.role !== "athlete") {
      if (!options.silent) {
        update({
          error: "PERFORM Sync выполняет спортсмен в своём Android-приложении.",
          isBusy: false,
          message: null,
        });
      }
      return false;
    }

    const config = loadDirectWatchConfig();
    const targetDeviceId = deviceId || config.deviceId;

    if (!targetDeviceId) {
      if (!options.silent) {
        update({ error: "Сначала выберите часы в блоке PERFORM Sync." });
      }
      return false;
    }

    if (!config.authKeyHex) {
      if (!options.silent) {
        update({ error: "Сначала сохраните Auth Key часов в блоке PERFORM Sync." });
      }
      return false;
    }

    const targetDevice = state.directWatchDiagnostic.devices.find((device) => device.id === targetDeviceId);
    const nextConfig = {
      ...config,
      deviceId: targetDeviceId,
      deviceName: targetDevice?.name ?? config.deviceName,
    };
    saveDirectWatchConfig(nextConfig);
    void syncDirectWatchNativeCoordinatorConfig(nextConfig);

    if (!options.silent) {
      update({ error: null, isBusy: true, message: "PERFORM Sync читает день напрямую с часов..." });
    }

    try {
      const { payload, payloadError, serviceBusy, serviceResult } = await readDirectWatchDailyWithServiceSession(entryDate, targetDeviceId, config);
      if (!payload) {
        if (serviceBusy) {
          if (!options.silent) {
            update({
              error: null,
              isBusy: false,
              message: DIRECT_WATCH_SYNC_ALREADY_RUNNING_MESSAGE,
            });
          }
          return false;
        }
        throw payloadError instanceof Error
          ? payloadError
          : new Error("PERFORM Sync не смог считать день с часов.");
      }
      await submitDirectWatchSyncPayload(payload, { silent: true });
      if (!options.silent) {
        await refreshData(true).catch(() => undefined);
        update({
          error: null,
          isBusy: false,
          message: formatDirectWatchDailySyncResultMessage(payload, serviceResult),
        });
      }
      return true;
    } catch (error) {
      if (!options.silent) {
        update({
          error: error instanceof Error ? error.message : "PERFORM Sync не смог считать день с часов.",
          isBusy: false,
          message: null,
        });
      }
      return false;
    }
  };

  const syncDirectWatchFull = async (entryDate: string, deviceId?: string | null) => {
    if (state.session.user?.role !== "athlete") {
      update({
        error: "PERFORM Sync выполняет спортсмен в своём Android-приложении.",
        isBusy: false,
        message: null,
      });
      return;
    }

    const config = loadDirectWatchConfig();
    const targetDeviceId = deviceId || config.deviceId;

    if (!targetDeviceId) {
      update({ error: "Сначала выберите часы в настройке часов." });
      return;
    }

    if (!config.authKeyHex) {
      update({ error: "Сначала сохраните Auth Key часов в настройке часов." });
      return;
    }

    update({
      error: null,
      isBusy: true,
      message: "Синхронизирую часы: время, погода, показатели и тренировки...",
    });

    let payload: DirectWatchDailySyncPayload | null = null;
    let payloadError: unknown = null;
    const serviceResult = await readDirectWatchDailyWithServiceSession(entryDate, targetDeviceId, config);
    payload = serviceResult.payload;
    payloadError = serviceResult.payloadError;
    const serviceOk = serviceResult.serviceOk;
    const serviceBusy = serviceResult.serviceBusy;

    if (payload) {
      await submitDirectWatchSyncPayload(payload, { silent: true });
    }

    if (payload) {
      await refreshData(true).catch(() => undefined);
      update({
        error: serviceOk || serviceBusy ? null : loadDirectWatchConfig().lastServiceError,
        isBusy: false,
        message: formatDirectWatchDailySyncResultMessage(payload, serviceResult.serviceResult),
      });
      return;
    }

    if (serviceBusy) {
      update({
        error: null,
        isBusy: false,
        message: DIRECT_WATCH_SYNC_ALREADY_RUNNING_MESSAGE,
      });
      return;
    }

    const errorMessage = payloadError instanceof Error
      ? payloadError.message
      : "PERFORM Sync не смог считать данные часов.";
    const isNoDailyFiles = errorMessage.includes("не отдали отдельные файлы активности");
    update({
      error: isNoDailyFiles && serviceOk ? null : errorMessage,
      isBusy: false,
      message: isNoDailyFiles && serviceOk
        ? "Время и погода обновлены. За выбранный день часы не отдали отдельные файлы, показатели не менял."
        : serviceOk
          ? null
          : "Время и погода обновились, но показатели с часов не считались.",
    });
  };

  const syncDirectWatchHistory = async (deviceId?: string | null) => {
    if (directWatchHistorySyncInFlight) {
      update({ message: "Первая синхронизация истории уже выполняется." });
      return;
    }

    if (state.session.user?.role !== "athlete") {
      update({
        error: "Историю часов загружает спортсмен в своём Android-приложении.",
        isBusy: false,
        message: null,
      });
      return;
    }

    const config = loadDirectWatchConfig();
    const targetDeviceId = deviceId || config.deviceId;

    if (!targetDeviceId) {
      update({ error: "Сначала выберите часы в настройке PERFORM Sync." });
      return;
    }

    if (!config.authKeyHex) {
      update({ error: "Сначала сохраните Auth Key часов." });
      return;
    }

    const dates = Array.from({ length: DIRECT_WATCH_HISTORY_SYNC_DAYS }, (_, index) =>
      addDays(todayValue(), -index),
    );
    const startedAt = new Date().toISOString();
    let successDays = 0;
    let lastError: string | null = null;
    let availableDays: number | null = null;
    let fileCount: number | null = null;
    let datesToRead = dates;

    directWatchHistorySyncInFlight = true;
    rememberDirectWatchConfig({
      deviceId: targetDeviceId,
      lastHistorySyncCompletedDays: 0,
      lastHistorySyncAvailableDays: null,
      lastHistorySyncCurrentDate: dates[0],
      lastHistorySyncError: null,
      lastHistorySyncFileCount: null,
      lastHistorySyncStartedAt: startedAt,
      lastHistorySyncStatus: "running",
      lastHistorySyncSuccessDays: 0,
      lastHistorySyncTotalDays: dates.length,
    });
    update({
      error: null,
      isBusy: true,
      message: `Первая синхронизация истории: 0 из ${dates.length}.`,
    });

    try {
      await syncDirectWatchServiceSettings(targetDeviceId, { silent: true });

      update({
        error: null,
        isBusy: true,
        message: "PERFORM Sync проверяет список файлов на часах...",
      });

      try {
        const inventory = await readDirectWatchActivityInventory(targetDeviceId, config.authKeyHex);
        const availableDateSet = new Set(inventory.entryDates);
        const inventoryDates = dates.filter((entryDate) => availableDateSet.has(entryDate));
        availableDays = inventoryDates.length;
        fileCount = inventory.fileCount;
        datesToRead = inventory.fileCount > 0 ? inventoryDates : dates;

        rememberDirectWatchConfig({
          lastHistorySyncAvailableDays: availableDays,
          lastHistorySyncFileCount: fileCount,
        });
        update({
          directWatchDiagnostic: {
            ...state.directWatchDiagnostic,
            classicProbe: inventory.probe,
          },
          error: null,
          isBusy: true,
          message: inventory.fileCount > 0
            ? `Часы отдали список файлов: ${availableDays} из ${dates.length} дней.`
            : "Список файлов пустой, пробуем пройти 30 дней напрямую.",
        });
      } catch (error) {
        lastError = error instanceof Error
          ? error.message
          : "Не удалось получить список файлов часов.";
        rememberDirectWatchConfig({
          lastHistorySyncError: lastError,
        });
      }

      if (!datesToRead.length) {
        lastError = fileCount
          ? "Часы отдали файлы, но ни один не попал в последние 30 дней."
          : lastError || "Часы не отдали список файлов активности.";
      }

      for (const [index, entryDate] of datesToRead.entries()) {
        const dayPosition = dates.indexOf(entryDate) + 1 || index + 1;
        const completedDays = Math.max(0, dayPosition - 1);
        rememberDirectWatchConfig({
          lastHistorySyncCompletedDays: completedDays,
          lastHistorySyncCurrentDate: entryDate,
          lastHistorySyncError: lastError,
          lastHistorySyncAvailableDays: availableDays,
          lastHistorySyncFileCount: fileCount,
          lastHistorySyncStatus: "running",
          lastHistorySyncSuccessDays: successDays,
          lastHistorySyncTotalDays: dates.length,
        });
        update({
          error: null,
          isBusy: true,
          message: `Первая синхронизация истории: ${dayPosition} из ${dates.length} · ${formatDate(entryDate)}.`,
        });

        try {
          const payload = await readDirectWatchDailySync(entryDate, targetDeviceId, config.authKeyHex, {
            includeSleep: true,
          });
          await submitDirectWatchSyncPayload(payload, { silent: true });
          successDays += 1;
        } catch (error) {
          lastError = error instanceof Error
            ? error.message
            : `Часы не отдали данные за ${formatDate(entryDate)}.`;
        }

        rememberDirectWatchConfig({
          lastHistorySyncCompletedDays: completedDays + 1,
          lastHistorySyncCurrentDate: entryDate,
          lastHistorySyncError: lastError,
          lastHistorySyncAvailableDays: availableDays,
          lastHistorySyncFileCount: fileCount,
          lastHistorySyncStatus: "running",
          lastHistorySyncSuccessDays: successDays,
          lastHistorySyncTotalDays: dates.length,
        });

        if (index < datesToRead.length - 1) {
          await delay(DIRECT_WATCH_HISTORY_SYNC_DAY_DELAY_MS);
        }
      }

      const finishedAt = new Date().toISOString();
      const status = successDays === dates.length
        ? "completed"
        : successDays > 0
          ? "partial"
          : "error";
      const readAllAvailableDays = availableDays !== null && availableDays > 0 && successDays >= availableDays;
      const message = successDays === dates.length
        ? `История часов загружена: ${successDays} из ${dates.length} дней.`
        : readAllAvailableDays
          ? `История часов загружена: все доступные дни ${successDays} из ${availableDays}.`
          : successDays > 0
            ? `История часов частично загружена: ${successDays} из ${dates.length} дней.`
            : null;
      const error = successDays > 0
        ? null
        : lastError || "Часы не отдали данные за последние 30 дней.";

      rememberDirectWatchConfig({
        lastHistorySyncCompletedDays: dates.length,
        lastHistorySyncCurrentDate: dates[dates.length - 1],
        lastHistorySyncAvailableDays: availableDays,
        lastHistorySyncError: successDays === dates.length ? null : lastError,
        lastHistorySyncFileCount: fileCount,
        lastHistorySyncStatus: status,
        lastHistorySyncSuccessDays: successDays,
        lastHistorySyncTotalDays: dates.length,
        lastHistorySyncedAt: successDays > 0 ? finishedAt : config.lastHistorySyncedAt,
      });
      update({
        error,
        isBusy: false,
        message,
      });
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Первая синхронизация истории остановилась.";
      rememberDirectWatchConfig({
        lastHistorySyncAvailableDays: availableDays,
        lastHistorySyncError: errorMessage,
        lastHistorySyncFileCount: fileCount,
        lastHistorySyncStatus: successDays > 0 ? "partial" : "error",
        lastHistorySyncSuccessDays: successDays,
        lastHistorySyncTotalDays: dates.length,
      });
      update({
        error: errorMessage,
        isBusy: false,
        message: successDays > 0
          ? `История часов частично загружена: ${successDays} из ${dates.length} дней.`
          : null,
      });
    } finally {
      directWatchHistorySyncInFlight = false;
    }
  };

  const syncDirectWatchServiceSettings = async (
    deviceId?: string | null,
    options: {
      entryDate?: string;
      fetchActivity?: boolean;
      includeHistory?: boolean;
      includeSleep?: boolean;
      onResult?: (result: DirectWatchServiceSyncResult) => void;
      silent?: boolean;
    } = {},
  ) => {
    if (state.session.user?.role !== "athlete") {
      if (!options.silent) {
        update({
          error: "Служебная синхронизация выполняется на телефоне спортсмена.",
          isBusy: false,
          message: null,
        });
      }
      return false;
    }

    const config = loadDirectWatchConfig();
    const targetDeviceId = deviceId || config.deviceId;

    if (!targetDeviceId) {
      if (!options.silent) {
        update({ error: "Сначала выберите часы в блоке PERFORM Sync." });
      }
      return false;
    }

    if (!config.authKeyHex) {
      if (!options.silent) {
        update({ error: "Сначала сохраните Auth Key часов в блоке PERFORM Sync." });
      }
      return false;
    }

    if (directWatchServiceSyncInFlight) {
      if (!options.silent) {
        update({
          error: null,
          isBusy: false,
          message: DIRECT_WATCH_SYNC_ALREADY_RUNNING_MESSAGE,
        });
      }
      return false;
    }

    const targetDevice = state.directWatchDiagnostic.devices.find((device) => device.id === targetDeviceId);
    saveDirectWatchConfig({
      ...config,
      deviceId: targetDeviceId,
      deviceName: targetDevice?.name ?? config.deviceName,
    });

    directWatchServiceSyncInFlight = true;
    if (!options.silent) {
      update({
        error: null,
        isBusy: true,
        message: "PERFORM Sync обновляет время, часовой пояс и погоду на часах...",
      });
    }

    try {
      const weatherSourceLabel = formatDirectWatchWeatherSource(config);
      let weatherPayload = null;
      let weatherError: string | null = null;
      try {
        weatherPayload = await fetchDirectWatchWeatherPayload(config);
      } catch (error) {
        weatherError = error instanceof Error ? error.message : "погода не получена";
        weatherPayload = buildDirectWatchWeatherLocationPayload(config);
      }

      const result = await syncDirectWatchService(
        targetDeviceId,
        config.authKeyHex,
        weatherPayload,
        DIRECT_WATCH_SERVICE_KEEP_ALIVE_MS,
        {
          entryDate: options.entryDate,
          fetchActivity: options.fetchActivity,
          includeHistory: options.includeHistory ?? true,
          includeSleep: options.includeSleep ?? true,
        },
      );
      options.onResult?.(result);
      const serviceStatus = await getSettledDirectWatchSyncServiceStatus();
      const ok = isDirectWatchServiceSyncSuccessful(result);
      const serviceBusy = isDirectWatchSyncAlreadyRunningResult(result);
      const syncedAt = result.syncedAt ?? new Date().toISOString();
      const serviceIsRunning = serviceStatus
        ? serviceStatus.running === true
        : Boolean(result.keptBluetoothBridge && isFutureDate(result.bridgeUntil));
      const serviceBridgeUntil = serviceIsRunning
        ? serviceStatus?.bridgeUntil ?? result.bridgeUntil ?? null
        : null;
      const serviceError = serviceBusy
        ? DIRECT_WATCH_SYNC_ALREADY_RUNNING_MESSAGE
        : result.error || result.authKeyError || "Служебная синхронизация часов не подтвердилась.";
      rememberDirectWatchConfig({
        deviceId: targetDeviceId,
        deviceName: serviceStatus?.deviceName ?? targetDevice?.name ?? config.deviceName,
        lastServiceBridgeUntil: serviceBridgeUntil,
        lastServiceError: ok || serviceBusy ? null : serviceError,
        lastServiceStatus: ok
          ? serviceIsRunning
            ? "running"
            : "synced"
          : serviceBusy
            ? "running"
            : "error",
        lastServiceSyncedAt: ok ? syncedAt : config.lastServiceSyncedAt,
        lastServiceUpdatedAt: serviceStatus?.updatedAt ?? syncedAt,
      });
      if (ok && serviceIsRunning) {
        window.setTimeout(() => {
          void refreshDirectWatchSyncService().catch(() => undefined);
        }, DIRECT_WATCH_SERVICE_STATUS_SETTLE_MS);
      }
      update(options.silent ? {
        directWatchDiagnostic: {
          ...state.directWatchDiagnostic,
          classicProbe: {
            ...result,
            sentActivityFileProbe: result.sentActivityFileProbe ?? false,
          },
          serviceStatus,
        },
      } : {
        directWatchDiagnostic: {
          ...state.directWatchDiagnostic,
          classicProbe: {
            ...result,
            sentActivityFileProbe: result.sentActivityFileProbe ?? false,
          },
          serviceStatus,
        },
        error: ok || serviceBusy ? null : serviceError,
        isBusy: false,
        message: ok
          ? formatDirectWatchServiceSyncMessage(result, weatherSourceLabel, weatherError)
          : serviceBusy
            ? DIRECT_WATCH_SYNC_ALREADY_RUNNING_MESSAGE
            : null,
      });
      return ok;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Не удалось выполнить служебную синхронизацию часов.";
      const serviceBusy = isDirectWatchSyncAlreadyRunningMessage(errorMessage);
      rememberDirectWatchConfig({
        lastServiceError: serviceBusy ? null : errorMessage,
        lastServiceStatus: serviceBusy ? "running" : "error",
        lastServiceUpdatedAt: new Date().toISOString(),
      });
      if (!options.silent) {
        update({
          error: serviceBusy ? null : errorMessage,
          isBusy: false,
          message: serviceBusy ? DIRECT_WATCH_SYNC_ALREADY_RUNNING_MESSAGE : null,
        });
      }
      return false;
    } finally {
      directWatchServiceSyncInFlight = false;
    }
  };

  async function ensureDirectWatchServiceBridge() {
    if (
      !isDirectWatchRuntime() ||
      state.session.user?.role !== "athlete" ||
      state.isBusy ||
      directWatchBridgeEnsureInFlight ||
      directWatchHistorySyncInFlight ||
      directWatchServiceSyncInFlight
    ) {
      return;
    }

    const config = loadDirectWatchConfig();
    if (!config.deviceId || !config.authKeyHex) {
      return;
    }

    directWatchBridgeEnsureInFlight = true;
    try {
      const serviceStatus = await getDirectWatchSyncServiceStatus().catch(() => null);
      if (serviceStatus?.running) {
        return;
      }

      await requestDirectWatchCoordinatorSync("app-visible", true).catch(() => undefined);
    } finally {
      directWatchBridgeEnsureInFlight = false;
    }
  }

  const startDirectWatchAutoSync = () => {
    if (!isDirectWatchRuntime() || directWatchAutoSyncTimer !== null) {
      return;
    }

    const tick = () => {
      void refreshDirectWatchSyncService().catch(() => undefined);
      void processDirectWatchBackgroundSyncResult().catch(() => undefined);
      void notifyDirectWatchAppVisible()
        .then((status) => {
          if (status?.lastBlockedReason === "interval") {
            void ensureDirectWatchServiceBridge();
          }
        })
        .catch(() => undefined);
    };

    window.setTimeout(tick, DIRECT_WATCH_AUTO_SYNC_START_DELAY_MS);
    window.setTimeout(tick, 30_000);
    window.setTimeout(() => {
      void processDirectWatchBackgroundSyncResult().catch(() => undefined);
    }, DIRECT_WATCH_AUTO_SYNC_START_DELAY_MS + 2_000);
    directWatchAutoSyncTimer = window.setInterval(tick, DIRECT_WATCH_AUTO_SYNC_TICK_MS);
    window.setInterval(() => {
      void processDirectWatchBackgroundSyncResult().catch(() => undefined);
    }, DIRECT_WATCH_BACKGROUND_RESULT_TICK_MS);

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        tick();
      }
    });
  };

  const saveDirectWatchWeatherLocation = async () => {
    const input = root.querySelector<HTMLInputElement>("[data-direct-watch-weather-city]");
    const rawValue = input?.value.trim() ?? "";
    update({
      error: null,
      isBusy: true,
      message: "Ищу город для погоды часов...",
    });

    try {
      const location = await resolveDirectWatchWeatherLocation(rawValue);
      saveDirectWatchConfig({
        ...loadDirectWatchConfig(),
        weatherCity: location.city,
        weatherLatitude: location.latitude,
        weatherLongitude: location.longitude,
      });
      update({
        error: null,
        isBusy: false,
        message: `Город погоды сохранён: ${location.city}.`,
      });
    } catch (error) {
      update({
        error: error instanceof Error ? error.message : "Не удалось сохранить город погоды.",
        isBusy: false,
        message: null,
      });
    }
  };

  const saveDirectWatchAuthKey = () => {
    const input = root.querySelector<HTMLInputElement>("[data-direct-watch-auth-key]");
    const rawValue = input?.value.trim() ?? "";
    const normalized = rawValue.replace(/[^0-9a-f]/gi, "").toLowerCase();
    const config = loadDirectWatchConfig();

    if (!normalized) {
      update({
        error: config.authKeyHex ? null : "Введите Auth Key часов, чтобы включить PERFORM Sync.",
        message: config.authKeyHex
          ? "Auth Key уже сохранён. Введите новый ключ только если нужно заменить старый."
          : null,
      });
      return;
    }

    if (!DIRECT_WATCH_AUTH_KEY_PATTERN.test(normalized)) {
      update({ error: "Auth Key должен быть 32 hex-символа." });
      return;
    }

    const nextConfig = { ...config, authKeyHex: normalized };
    saveDirectWatchConfig(nextConfig);
    void syncDirectWatchNativeCoordinatorConfig(nextConfig);
    if (input) {
      input.value = "";
    }
    update({ error: null, message: "Auth Key PERFORM Sync сохранён только на этом телефоне." });
  };

  const selectDirectWatchDevice = (deviceId: string) => {
    if (!deviceId) {
      update({ error: "Выберите часы для PERFORM Sync." });
      return;
    }

    const device = state.directWatchDiagnostic.devices.find((item) => item.id === deviceId);
    const nextConfig = {
      ...loadDirectWatchConfig(),
      deviceId,
      deviceName: device?.name ?? null,
    };
    saveDirectWatchConfig(nextConfig);
    void syncDirectWatchNativeCoordinatorConfig(nextConfig);
    update({
      error: null,
      message: `${device?.name || "Часы"} выбраны для PERFORM Sync.`,
    });
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
          classicProbe: state.directWatchDiagnostic.classicProbe,
          devices: result.devices.filter((device) => Boolean(device.id)),
          inspectedDeviceId: null,
          inspection: null,
          packets: state.directWatchDiagnostic.packets,
          scannedAt: result.scannedAt ?? new Date().toISOString(),
          session: state.directWatchDiagnostic.session,
          syncCoordinatorStatus: state.directWatchDiagnostic.syncCoordinatorStatus,
          serviceStatus: state.directWatchDiagnostic.serviceStatus,
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
        message: formatDirectWatchInspectionMessage(inspection),
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
          classicProbe: null,
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

  const unpairDirectWatch = async (deviceId: string) => {
    if (!deviceId) {
      update({ error: "Выберите часы для сброса привязки." });
      return;
    }

    update({
      error: null,
      isBusy: true,
      message: "Сбрасываю системную привязку часов на телефоне...",
    });

    try {
      const pairing = await unpairDirectWatchDevice(deviceId);
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
      update({
        directWatchDiagnostic: {
          ...state.directWatchDiagnostic,
          devices,
          classicProbe: null,
          session: null,
        },
        error: null,
        isBusy: false,
        message: formatDirectWatchUnpairMessage(pairing.status),
      });
    } catch (error) {
      update({
        error: error instanceof Error ? error.message : "Не удалось сбросить системную привязку часов.",
        isBusy: false,
        message: null,
      });
    }
  };

  const probeDirectWatchClassic = async (deviceId: string, authStep1 = false) => {
    if (!deviceId) {
      update({ error: "Выберите часы для проверки Classic/SPP." });
      return;
    }

    update({
      error: null,
      isBusy: true,
      message: authStep1
        ? "Проверяю первый шаг Xiaomi Auth..."
        : "Проверяю Classic/SPP-канал часов...",
    });

    try {
      const classicProbe = await probeDirectWatchClassicSession(deviceId, authStep1);
      update({
        directWatchDiagnostic: {
          ...state.directWatchDiagnostic,
          classicProbe,
        },
        error: classicProbe.error,
        isBusy: false,
        message: formatDirectWatchClassicProbeMessage(classicProbe),
      });
    } catch (error) {
      update({
        directWatchDiagnostic: {
          ...state.directWatchDiagnostic,
          classicProbe: null,
        },
        error: error instanceof Error ? error.message : "Не удалось проверить Classic/SPP-канал часов.",
        isBusy: false,
        message: null,
      });
    }
  };

  const startDirectWatchConnection = async (deviceId: string) => {
    if (!deviceId) {
      update({ error: "Выберите часы для PERFORM Sync." });
      return;
    }

    update({
      error: null,
      isBusy: true,
      message: "Открываю PERFORM Sync-сессию и подписываюсь на BLE-каналы часов...",
    });

    try {
      const session = await startDirectWatchSession(deviceId);
      update({
        directWatchDiagnostic: {
          ...state.directWatchDiagnostic,
          packets: session.packets ?? [],
          session,
        },
        error: null,
        isBusy: false,
        message: formatDirectWatchSessionMessage(session),
      });
    } catch (error) {
      update({
        error: error instanceof Error ? error.message : "Не удалось открыть PERFORM Sync-сессию.",
        isBusy: false,
        message: null,
      });
    }
  };

  const stopDirectWatchConnection = async () => {
    update({
      error: null,
      isBusy: true,
      message: "Отключаю PERFORM Sync от часов...",
    });

    try {
      const session = await stopDirectWatchSession();
      update({
        directWatchDiagnostic: {
          ...state.directWatchDiagnostic,
          session,
        },
        error: null,
        isBusy: false,
        message: "PERFORM Sync-сессия остановлена.",
      });
    } catch (error) {
      update({
        error: error instanceof Error ? error.message : "Не удалось остановить PERFORM Sync-сессию.",
        isBusy: false,
        message: null,
      });
    }
  };

  const refreshDirectWatchSession = async () => {
    try {
      const session = await getDirectWatchSessionStatus();
      update({
        directWatchDiagnostic: {
          ...state.directWatchDiagnostic,
          packets: session.packets?.length ? session.packets : state.directWatchDiagnostic.packets,
          session,
        },
      });
    } catch {
      // Session refresh is diagnostic only; the visible action will report connection errors.
    }
  };

  const refreshDirectWatchSyncService = async () => {
    try {
      const serviceStatus = await getDirectWatchSyncServiceStatus();
      const currentConfig = loadDirectWatchConfig();
      rememberDirectWatchConfig({
        deviceId: serviceStatus.deviceId ?? currentConfig.deviceId,
        deviceName: serviceStatus.deviceName ?? currentConfig.deviceName,
        lastServiceBridgeUntil: serviceStatus.running ? serviceStatus.bridgeUntil ?? null : null,
        lastServiceError: serviceStatus.running ? null : currentConfig.lastServiceError,
        lastServiceStatus: serviceStatus.running ? "running" : "stopped",
        lastServiceUpdatedAt: serviceStatus.updatedAt ?? new Date().toISOString(),
      });
      update({
        directWatchDiagnostic: {
          ...state.directWatchDiagnostic,
          serviceStatus,
        },
      });
    } catch (error) {
      update({
        error: error instanceof Error ? error.message : "Не удалось обновить статус сервиса часов.",
      });
    }
  };

  const getSettledDirectWatchSyncServiceStatus = async () => {
    let status = await getDirectWatchSyncServiceStatus().catch(() => null);
    for (let attempt = 0; attempt < 5 && status?.running; attempt += 1) {
      await delay(1_000);
      status = await getDirectWatchSyncServiceStatus().catch(() => status);
    }

    return status;
  };

  const stopDirectWatchForegroundService = async () => {
    update({
      error: null,
      isBusy: true,
      message: "Останавливаю служебный режим часов...",
    });

    try {
      const serviceStatus = await stopDirectWatchSyncService();
      rememberDirectWatchConfig({
        lastServiceBridgeUntil: null,
        lastServiceError: null,
        lastServiceStatus: "stopped",
        lastServiceUpdatedAt: serviceStatus.updatedAt ?? new Date().toISOString(),
      });
      update({
        directWatchDiagnostic: {
          ...state.directWatchDiagnostic,
          serviceStatus,
        },
        error: null,
        isBusy: false,
        message: "Служебный режим часов остановлен.",
      });
    } catch (error) {
      update({
        error: error instanceof Error ? error.message : "Не удалось остановить служебный режим часов.",
        isBusy: false,
        message: null,
      });
    }
  };

  const submitDeviceHealthPayload = async (
    payload: DeviceHealthDailySummaryPayload,
    options: { silent?: boolean } = {},
  ): Promise<SubmitOrQueueResult> => {
    const payloadForSubmit = normalizeDeviceHealthPayloadForSubmit(payload, state.data);
    return submitOrQueue("device-health", payloadForSubmit, async (idempotencyKey) => {
      const result = await client().submitDeviceHealthSummary(payloadForSubmit, idempotencyKey);
      const normalizedResultSummary = mergeDeviceHealthSummaryForStorage(
        normalizeDeviceHealthDailySummaryForStorage(result.summary),
        normalizeDeviceHealthDailySummaryForStorage({
          ...result.summary,
          ...payloadForSubmit,
          athleteId: result.summary.athleteId,
          createdAt: result.summary.createdAt,
          id: result.summary.id,
          syncedAt: payloadForSubmit.syncedAt ?? result.summary.syncedAt,
          updatedAt: result.summary.updatedAt,
        }),
      );
      const sampleMetrics = Array.from(new Set(payloadForSubmit.samples?.map((sample) => sample.metric) ?? []));
      const sampleResponses = sampleMetrics.length
        ? await Promise.all(sampleMetrics.map((metric) =>
            client().listDeviceHealthSamples(payloadForSubmit.entryDate, metric).catch(() => null),
          ))
        : [];
      const deviceHealthSamples = sampleMetrics.reduce((items, metric, index) => {
        const response = sampleResponses[index];
        if (!response) {
          return items;
        }

        return replaceDeviceHealthSamplesForDay(
          items,
          response.samples,
          normalizedResultSummary.athleteId,
          payloadForSubmit.entryDate,
          metric,
        );
      }, state.data.deviceHealthSamples);
      const snapshot = {
        ...state.data,
        deviceHealthSummaries: upsertDeviceHealthSummary(
          state.data.deviceHealthSummaries,
          normalizedResultSummary,
        ),
        deviceHealthSamples,
        savedAt: new Date().toISOString(),
      };
      saveSnapshot(snapshot);
      update({ data: snapshot });
    }, options);
  };

  const submitDeviceWorkoutsPayload = async (
    payload: DeviceWorkoutsSyncPayload,
    options: { silent?: boolean } = {},
  ): Promise<SubmitOrQueueResult> => {
    return submitOrQueue("device-workouts", payload, async (idempotencyKey) => {
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
    }, options);
  };

  const hydrateDeviceWorkoutSamples = async (workoutId: string) => {
    const isCoachContext = isCoachRole(state.session.user?.role);
    const athleteId = isCoachContext ? null : state.session.user?.athleteId ?? null;
    const workout = getDeviceWorkoutById(state, athleteId, workoutId);
    if (!workout || workout.sampleCount <= workout.samples.length) {
      return;
    }

    try {
      const result = isCoachContext
        ? await client().listCoachDeviceWorkouts(workout.athleteId, workout.entryDate, true)
        : await client().listDeviceWorkouts(workout.entryDate, true);
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
    } catch (error) {
      update({ error: toFriendlyError(error) });
    }
  };

  const submitDirectWatchSyncPayload = async (
    payload: DirectWatchDailySyncPayload,
    options: { silent?: boolean; skipWatchAck?: boolean } = {},
  ): Promise<boolean> => {
    const healthResult = await submitDeviceHealthPayload(payload.summary, options);
    let workoutsResult: SubmitOrQueueResult = "submitted";
    if (payload.workouts.workouts.length > 0) {
      workoutsResult = await submitDeviceWorkoutsPayload(payload.workouts, options);
    }

    const didSubmitToServer = healthResult === "submitted" && workoutsResult === "submitted";
    const ackFileIds = collectDirectWatchAckFileIdsForSubmit(payload);
    if (!didSubmitToServer) {
      const didQueueForServer = healthResult === "queued" || workoutsResult === "queued";
      if (didQueueForServer && ackFileIds.length > 0) {
        markDirectWatchRawCacheQueued(payload.rawCacheId);
      }
      return false;
    }

    if (didSubmitToServer && ackFileIds.length > 0) {
      if (options.skipWatchAck) {
        markDirectWatchRawCacheAcked(payload.rawCacheId, ackFileIds);
        return true;
      }

      const config = loadDirectWatchConfig();
      if (config.deviceId && config.authKeyHex) {
        markDirectWatchRawCacheSubmitted(payload.rawCacheId);
        try {
          const ack = await ackDirectWatchActivityFiles(config.deviceId, config.authKeyHex, ackFileIds);
          markDirectWatchRawCacheAcked(payload.rawCacheId, ack.activityFileAckIds ?? ackFileIds);
        } catch (error) {
          markDirectWatchRawCacheAckError(payload.rawCacheId, error);
        } finally {
          await syncDirectWatchServiceSettings(config.deviceId, {
            fetchActivity: false,
            includeHistory: false,
            includeSleep: false,
            silent: true,
          }).catch(() => undefined);
        }
      }
    }

    return didSubmitToServer;
  };

  const collectDirectWatchAckFileIdsForSubmit = (payload: DirectWatchDailySyncPayload) => {
    return Array.from(new Set(payload.ackFileIds.map((fileId) => fileId.trim()).filter(Boolean)));
  };

  const ackDirectWatchRawCachesAfterQueueFlush = async () => {
    if (state.session.user?.role !== "athlete") {
      return;
    }

    const config = loadDirectWatchConfig();
    if (!config.deviceId || !config.authKeyHex) {
      return;
    }

    const queue = loadQueue();
    const candidates = loadDirectWatchRawCacheEntries().filter((entry) =>
      entry.deviceId === config.deviceId &&
      entry.ackFileIds.length > 0 &&
      (
        entry.status === "submitted" ||
        entry.status === "ack-error" ||
        (entry.status === "queued" && Boolean(entry.queuedAt))
      ) &&
      !queue.some((action) => pendingActionReferencesDirectWatchRawCache(action, entry.id))
    );

    for (const entry of candidates) {
      markDirectWatchRawCacheSubmitted(entry.id);
      try {
        const ack = await ackDirectWatchActivityFiles(config.deviceId, config.authKeyHex, entry.ackFileIds);
        markDirectWatchRawCacheAcked(entry.id, ack.activityFileAckIds ?? entry.ackFileIds);
      } catch (error) {
        markDirectWatchRawCacheAckError(entry.id, error);
      }
    }
  };

  const linkDeviceWorkoutToBlock = async (select: HTMLSelectElement) => {
    const role = state.session.user?.role ?? null;
    const isCoachContext = isCoachRole(role);
    const isAthleteContext = role === "athlete";

    if (!isCoachContext && !isAthleteContext) {
      return;
    }

    const athleteId = isCoachContext ? state.selectedAthleteId : state.session.user?.athleteId ?? null;
    const assignedPlanId = select.dataset.deviceWorkoutPlanId ?? "";
    const assignedBlockIds = (select.dataset.deviceWorkoutBlockIds ?? select.dataset.deviceWorkoutBlockId ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    const assignedExerciseId = select.dataset.deviceWorkoutExerciseId?.trim() || null;
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
      const unlink = (linkId: string) =>
        isCoachContext
          ? client().unlinkDeviceWorkout(athleteId, linkId)
          : client().unlinkOwnDeviceWorkout(linkId);
      const link = (assignedBlockId: string) => {
        const payload: DeviceWorkoutLinkPayload = {
          assignedBlockId,
          assignedPlanId,
          deviceWorkoutId,
        };

        if (assignedBlockIds.length === 1 && assignedExerciseId) {
          payload.assignedExerciseId = assignedExerciseId;
        }

        return isCoachContext
          ? client().linkDeviceWorkout(athleteId, payload)
          : client().linkOwnDeviceWorkout(payload);
      };

      if (!deviceWorkoutId) {
        if (linkIds.length > 0) {
          await Promise.all(linkIds.map(unlink));
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

      await Promise.all(linkIds.map(unlink));
      const responses = await Promise.all(assignedBlockIds.map((assignedBlockId) =>
        link(assignedBlockId)
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
      update({ data: snapshot, isBusy: false, message: "Тренировка часов связана с планом." });
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

      const sessionNotesInput = form
        .closest<HTMLElement>("[data-execution-session]")
        ?.querySelector<HTMLTextAreaElement>("[data-execution-session-notes]");
      const sessionNotes = sessionNotesInput ? sessionNotesInput.value.trim() : null;

      payloads.push(...formPayloads.map((payload) => ({
        ...payload,
        notes: sessionNotes ?? payload.notes,
      })));
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
        executionEditDate: null,
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
        executionEditDate: savedResults.length > 0 ? null : state.executionEditDate,
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
    options: { silent?: boolean } = {},
  ): Promise<SubmitOrQueueResult> => {
    const userRole = state.session.user?.role ?? null;

    if (!canSubmitSyncAction(userRole, kind)) {
      if (!options.silent) {
        update({
          error: getSyncActionRestrictionMessage(userRole, kind),
          isBusy: false,
          message: null,
          queue: loadQueue(),
        });
      }
      return "skipped";
    }

    const pendingAction = createPendingAction(
      kind,
      payload,
      state.session.user?.id ?? null,
      userRole,
    );

    if (!options.silent) {
      update({ error: null, isBusy: true, message: null });
    }

    if (!navigator.onLine) {
      const queue = enqueueAction(pendingAction);
      update(options.silent
        ? { queue }
        : {
            isBusy: false,
            message: "Сохранено локально. Отправим при появлении интернета.",
            queue,
          });
      return "queued";
    }

    try {
      await submit(pendingAction.idempotencyKey);
      update(options.silent
        ? { queue: loadQueue() }
        : {
            isBusy: false,
            message: "Сохранено на сервере",
            queue: loadQueue(),
          });
      if (!options.silent) {
        await refreshData(true);
      }
      return "submitted";
    } catch (error) {
      if (error instanceof MobileApiError && error.statusCode !== null && error.statusCode < 500) {
        if (!options.silent) {
          update({
            error: toFriendlyError(error),
            isBusy: false,
          });
        }
        return "skipped";
      }

      const queue = enqueueAction({
        ...pendingAction,
        attempts: 1,
        lastError: toFriendlyError(error),
      });
      update(options.silent
        ? { queue }
        : {
            isBusy: false,
            message: "Сервер недоступен. Данные сохранены локально.",
            queue,
          });
      return "queued";
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
        const selectedScreen = button.dataset.screen as MobileScreen;

        if (!getScreensForRole(state.session.user?.role).some((screen) => screen.id === selectedScreen)) {
          update({
            coachDeviceWorkoutDetailId: null,
            selectedScreen: "dashboard",
            watchDetailMetric: null,
            watchExpandedWorkoutId: null,
            watchExpandedWorkoutGraphId: null,
            watchWorkoutHistoryOpen: false,
            watchWorkoutDetailId: null,
            watchSettingsOpen: false,
          });
          scrollToScreenTop();
          return;
        }

        update({
          coachDeviceWorkoutDetailId: null,
          selectedScreen,
          watchDetailMetric: null,
          watchExpandedWorkoutId: null,
          watchExpandedWorkoutGraphId: null,
          watchWorkoutHistoryOpen: false,
          watchWorkoutDetailId: null,
          watchSettingsOpen: false,
        });
        scrollToScreenTop();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-watch-detail]").forEach((button) => {
      button.addEventListener("click", () => {
        update({
          watchDetailMetric: (button.dataset.watchDetail as WatchDetailMetric) || null,
          watchDetailPeriod: "day",
          watchExpandedWorkoutId: null,
          watchExpandedWorkoutGraphId: null,
          watchWorkoutHistoryOpen: false,
          watchWorkoutDetailId: null,
          watchSettingsOpen: false,
        });
        scrollToScreenTop();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-watch-detail-back]").forEach((button) => {
      button.addEventListener("click", () => {
        update({
          watchDetailMetric: null,
          watchExpandedWorkoutId: null,
          watchExpandedWorkoutGraphId: null,
          watchWorkoutDetailId: null,
        });
        scrollToScreenTop();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-watch-settings-open]").forEach((button) => {
      button.addEventListener("click", () => {
        update({
          watchDetailMetric: null,
          watchExpandedWorkoutId: null,
          watchExpandedWorkoutGraphId: null,
          watchWorkoutHistoryOpen: false,
          watchWorkoutDetailId: null,
          watchSettingsOpen: true,
        });
        scrollToScreenTop();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-watch-settings-back]").forEach((button) => {
      button.addEventListener("click", () => {
        update({
          watchExpandedWorkoutId: null,
          watchExpandedWorkoutGraphId: null,
          watchWorkoutDetailId: null,
          watchSettingsOpen: false,
        });
        scrollToScreenTop();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-watch-detail-period]").forEach((button) => {
      button.addEventListener("click", () => {
        update({ watchDetailPeriod: (button.dataset.watchDetailPeriod as WatchDetailPeriod) || "day" });
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-watch-workouts-open]").forEach((button) => {
      button.addEventListener("click", () => {
        openWatchWorkoutHistory();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-watch-workouts-back]").forEach((button) => {
      button.addEventListener("click", () => {
        closeWatchWorkoutHistory();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-watch-workouts-period]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextPeriod = (button.dataset.watchWorkoutsPeriod as WatchDetailPeriod) || "day";
        updateWatchWorkoutHistoryPeriod(nextPeriod);
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-watch-workout-open]").forEach((button) => {
      button.addEventListener("click", () => {
        const workoutId = button.dataset.watchWorkoutOpen;
        if (!workoutId) {
          return;
        }

        openWatchWorkoutDetail(workoutId);
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-watch-workout-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const workoutId = button.dataset.watchWorkoutToggle;
        if (!workoutId) {
          return;
        }

        const isOpening = state.watchExpandedWorkoutId !== workoutId;
        update({
          watchExpandedWorkoutId: isOpening ? workoutId : null,
          watchExpandedWorkoutGraphId: null,
          watchWorkoutDetailId: null,
        });
        scrollToScreenTop();
        if (isOpening) {
          void hydrateDeviceWorkoutSamples(workoutId);
        }
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-watch-workout-graph]").forEach((button) => {
      button.addEventListener("click", () => {
        const workoutId = button.dataset.watchWorkoutGraph;
        if (!workoutId) {
          return;
        }

        update({
          watchDetailMetric: null,
          watchExpandedWorkoutId: workoutId,
          watchExpandedWorkoutGraphId: null,
          watchWorkoutDetailId: workoutId,
        });
        scrollToScreenTop();
        void hydrateDeviceWorkoutSamples(workoutId);
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-watch-workout-detail-back]").forEach((button) => {
      button.addEventListener("click", () => {
        closeWatchWorkoutDetail();
      });
    });

    root.querySelectorAll<HTMLElement>("[data-training-abbreviation]").forEach((element) => {
      const showHint = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        element.setAttribute("aria-expanded", "true");
        element.focus({ preventScroll: true });
      };

      element.addEventListener("click", showHint);
      element.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          showHint(event);
        }
      });
      element.addEventListener("blur", () => {
        element.setAttribute("aria-expanded", "false");
      });
    });

    root.querySelector<HTMLSelectElement>("[data-execution-date-filter]")?.addEventListener("change", (event) => {
      const executionDateFilter = (event.currentTarget as HTMLSelectElement).value || null;
      if (isCoachRole(state.session.user?.role)) {
        updateSelectedDayDate(executionDateFilter ?? state.selectedDayDate);
        return;
      }

      if (executionDateFilter) {
        updateSelectedDayDate(executionDateFilter, "results");
        return;
      }

      update({ executionDateFilter });
    });

    root.querySelectorAll<HTMLSelectElement>("[data-device-workout-link]").forEach((select) => {
      select.addEventListener("change", () => {
        void linkDeviceWorkoutToBlock(select);
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-coach-device-workout-detail]").forEach((button) => {
      button.addEventListener("click", () => {
        const workoutId = button.dataset.coachDeviceWorkoutDetail;
        if (!workoutId) {
          return;
        }

        update({
          coachDeviceWorkoutDetailId: workoutId,
          watchDetailMetric: null,
          watchExpandedWorkoutId: null,
          watchExpandedWorkoutGraphId: null,
          watchWorkoutHistoryOpen: false,
          watchWorkoutDetailId: null,
          watchSettingsOpen: false,
        });
        scrollToScreenTop();
        void hydrateDeviceWorkoutSamples(workoutId);
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-coach-device-workout-detail-back]").forEach((button) => {
      button.addEventListener("click", () => {
        update({ coachDeviceWorkoutDetailId: null });
        scrollToScreenTop();
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
        const selectedAthleteId = button.dataset.coachOpenAthlete ?? undefined;
        if (selectedAthleteId) {
          saveSelectedAthleteId(selectedAthleteId);
        }
        updateSelectedDayDate(
          button.dataset.coachOpenDay ?? state.selectedDayDate,
          selectedScreen,
          selectedAthleteId,
        );
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-refresh]").forEach((button) => {
      button.addEventListener("click", () => {
        void refreshData();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-sync]").forEach((button) => {
      button.addEventListener("click", () => {
        void tryFlushQueue();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-logout]").forEach((button) => {
      button.addEventListener("click", () => {
        void handleLogout();
      });
    });

    root.querySelectorAll<HTMLSelectElement>("[data-athlete-select]").forEach((select) => {
      select.addEventListener("change", (event) => {
        const selectedAthleteId = (event.currentTarget as HTMLSelectElement).value || null;
        saveSelectedAthleteId(selectedAthleteId);
        if (isCoachRole(state.session.user?.role)) {
          updateSelectedDayDate(state.selectedDayDate, undefined, selectedAthleteId);
        } else {
          update({ selectedAthleteId });
        }
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-athlete-card]").forEach((button) => {
      button.addEventListener("click", () => {
        const selectedAthleteId = button.dataset.athleteCard ?? null;
        saveSelectedAthleteId(selectedAthleteId);
        if (isCoachRole(state.session.user?.role)) {
          updateSelectedDayDate(state.selectedDayDate, "athletes", selectedAthleteId);
        } else {
          update({ selectedAthleteId, selectedScreen: "dashboard" });
        }
      });
    });

    root.querySelectorAll<HTMLInputElement>("[data-coach-readiness-chart-metric]").forEach((input) => {
      input.addEventListener("change", () => {
        const metric = parseCoachReadinessChartMetric(input.value);
        if (!metric) {
          return;
        }

        const currentMetrics = normalizeCoachReadinessChartMetrics(state.coachReadinessChartMetrics);
        const nextMetrics = input.checked
          ? currentMetrics.includes(metric)
            ? currentMetrics
            : currentMetrics.length >= COACH_READINESS_CHART_LIMIT
              ? currentMetrics
              : [...currentMetrics, metric]
          : currentMetrics.filter((currentMetric) => currentMetric !== metric);
        const normalizedMetrics = normalizeCoachReadinessChartMetrics(nextMetrics);
        saveCoachReadinessChartMetrics(normalizedMetrics);
        update({
          coachReadinessChartMetrics: normalizedMetrics,
          message: input.checked && currentMetrics.length >= COACH_READINESS_CHART_LIMIT && !currentMetrics.includes(metric)
            ? `Можно выбрать до ${COACH_READINESS_CHART_LIMIT} графиков.`
            : null,
        });
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-coach-readiness-chart-period]").forEach((button) => {
      button.addEventListener("click", () => {
        const period = parseCoachReadinessChartPeriod(button.dataset.coachReadinessChartPeriod);
        saveCoachReadinessChartPeriod(period);
        update({ coachReadinessChartPeriod: period });
      });
    });

    root.querySelector<HTMLFormElement>("[data-readiness-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      void submitReadiness(event.currentTarget as HTMLFormElement);
    });

    root.querySelector<HTMLButtonElement>("[data-readiness-edit]")?.addEventListener("click", () => {
      update({ readinessEditMode: true });
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

    root.querySelectorAll<HTMLButtonElement>("[data-device-health-sync]").forEach((button) => {
      button.addEventListener("click", () => {
        void syncDeviceHealth(button.dataset.deviceHealthDate ?? todayValue());
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-direct-watch-scan]").forEach((button) => {
      button.addEventListener("click", () => {
        void scanDirectWatch();
      });
    });

    root.querySelectorAll<HTMLInputElement>("[data-readiness-watch-field]").forEach((field) => {
      field.addEventListener("input", () => {
        const source = field.closest("label")?.querySelector<HTMLElement>("[data-readiness-field-source]");
        const status = root.querySelector<HTMLElement>("[data-readiness-watch-status]");

        if (source) {
          source.textContent = "вручную";
          source.classList.add("is-manual");
        }

        if (status) {
          status.textContent = "Часы: часть значений изменена вручную";
          status.classList.add("is-manual");
        }
      });
    });

    root.querySelector<HTMLButtonElement>("[data-direct-watch-auth-key-save]")?.addEventListener("click", () => {
      saveDirectWatchAuthKey();
    });

    root.querySelector<HTMLButtonElement>("[data-direct-watch-weather-save]")?.addEventListener("click", () => {
      void saveDirectWatchWeatherLocation();
    });

    root.querySelectorAll<HTMLButtonElement>("[data-direct-watch-select]").forEach((button) => {
      button.addEventListener("click", () => {
        selectDirectWatchDevice(button.dataset.directWatchSelect ?? "");
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-direct-watch-full-sync]").forEach((button) => {
      button.addEventListener("click", () => {
        void syncDirectWatchFull(
          button.dataset.directWatchFullSyncDate || todayValue(),
          button.dataset.directWatchFullSync || null,
        );
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-direct-watch-sync]").forEach((button) => {
      button.addEventListener("click", () => {
        void syncDirectWatch(
          button.dataset.directWatchSyncDate ?? todayValue(),
          button.dataset.directWatchSync ?? null,
        );
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-direct-watch-history-sync]").forEach((button) => {
      button.addEventListener("click", () => {
        void syncDirectWatchHistory(button.dataset.directWatchHistorySync ?? null);
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-direct-watch-service-sync]").forEach((button) => {
      button.addEventListener("click", () => {
        void syncDirectWatchServiceSettings(button.dataset.directWatchServiceSync ?? null);
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-direct-watch-service-status]").forEach((button) => {
      button.addEventListener("click", () => {
        void refreshDirectWatchSyncService();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-direct-watch-service-stop]").forEach((button) => {
      button.addEventListener("click", () => {
        void stopDirectWatchForegroundService();
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

    root.querySelectorAll<HTMLButtonElement>("[data-direct-watch-unpair]").forEach((button) => {
      button.addEventListener("click", () => {
        void unpairDirectWatch(button.dataset.directWatchUnpair ?? "");
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-direct-watch-classic-probe]").forEach((button) => {
      button.addEventListener("click", () => {
        void probeDirectWatchClassic(button.dataset.directWatchClassicProbe ?? "");
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-direct-watch-auth-probe]").forEach((button) => {
      button.addEventListener("click", () => {
        void probeDirectWatchClassic(button.dataset.directWatchAuthProbe ?? "", true);
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-direct-watch-session-start]").forEach((button) => {
      button.addEventListener("click", () => {
        void startDirectWatchConnection(button.dataset.directWatchSessionStart ?? "");
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-direct-watch-session-stop]").forEach((button) => {
      button.addEventListener("click", () => {
        void stopDirectWatchConnection();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-direct-watch-session-refresh]").forEach((button) => {
      button.addEventListener("click", () => {
        void refreshDirectWatchSession();
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

    root.querySelectorAll<HTMLButtonElement>("[data-execution-edit-day]").forEach((button) => {
      button.addEventListener("click", () => {
        update({ executionEditDate: button.dataset.executionEditDay ?? todayValue() });
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

  startDirectWatchAutoSync();

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
          <p>Введите данные для входа.</p>
        </div>
        ${renderStatus(state)}
        <form class="mobile-form" data-login-form>
          <label>
            <span>Логин</span>
            <input name="email" type="email" autocomplete="username" required />
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
  const screens = getScreensForRole(user?.role);
  const activeScreen = screens.some((screen) => screen.id === state.selectedScreen)
    ? state.selectedScreen
    : "dashboard";
  const displayState = activeScreen === state.selectedScreen
    ? state
    : { ...state, selectedScreen: activeScreen };
  const selectedAthlete = getSelectedAthlete(state);
  const activeAthleteId = getActiveAthleteId(state);
  const isWatchDetailScreen = isWatchSubscreenActive(displayState) || Boolean(displayState.coachDeviceWorkoutDetailId);
  const isCoachView = isCoachRole(user?.role);

  return `
    <main class="mobile-shell ${isWatchDetailScreen ? "is-watch-detail" : ""}">
      ${isCoachView ? renderCoachUtilityMenu(state) : renderAppTopBar(state, selectedAthlete)}

      ${renderStatus(state)}

      <section class="screen-panel">
        ${renderScreen(displayState, activeAthleteId)}
      </section>

      <nav class="bottom-nav" aria-label="Разделы" style="--bottom-nav-count: ${screens.length}">
        ${screens.map((screen) => `
          <button class="${displayState.selectedScreen === screen.id ? "is-active" : ""}" data-screen="${screen.id}" type="button">
            <span>${screen.icon}</span>
            ${screen.label}
          </button>
        `).join("")}
      </nav>
    </main>
  `;
}

function renderCoachUtilityMenu(state: MobileAppState) {
  const pendingQueue = getPendingQueueItems(state.queue);
  const invalidQueue = getInvalidQueueItems(state.queue);
  const savedLabel = state.data.savedAt
    ? `сохранено ${formatDateTime(state.data.savedAt)}`
    : "данные ещё не сохранены";
  const queueLabel = pendingQueue.length
    ? `очередь ${pendingQueue.length}`
    : invalidQueue.length
      ? `ошибка ${invalidQueue.length}`
      : "очередь пустая";
  const syncLabel = pendingQueue.length ? `Синхр. (${pendingQueue.length})` : "Синхр.";
  const coachName = state.session.user?.fullName ?? "Тренер";

  return `
    <details class="coach-utility-menu">
      <summary aria-label="Открыть меню тренера" title="Открыть меню тренера">
        <span>Тренер</span>
        <strong>${escapeHtml(coachName)}</strong>
        <em>${state.isOnline ? "онлайн" : "офлайн"}</em>
        <b aria-hidden="true">⋯</b>
      </summary>
      <div class="coach-utility-panel" aria-label="Действия тренера">
        <p>${escapeHtml(savedLabel)} · ${escapeHtml(queueLabel)}</p>
        <div class="coach-utility-actions">
          <button
            class="topbar-action-button"
            data-refresh
            type="button"
            ${state.isBusy ? "disabled" : ""}
          >↻ Обновить</button>
          <button
            aria-label="${escapeHtml(syncLabel)}"
            class="topbar-action-button"
            data-sync
            title="${escapeHtml(syncLabel)}"
            type="button"
            ${state.isSyncing || pendingQueue.length === 0 ? "disabled" : ""}
          >⇄ ${escapeHtml(syncLabel)}</button>
          <button
            class="topbar-logout-button"
            data-logout
            type="button"
          >Выйти</button>
        </div>
      </div>
    </details>
  `;
}

function isWatchSubscreenActive(state: MobileAppState) {
  return state.selectedScreen === "watches" && (
    Boolean(state.watchDetailMetric) ||
    Boolean(state.watchWorkoutDetailId) ||
    state.watchWorkoutHistoryOpen ||
    state.watchSettingsOpen
  );
}

function renderAppTopBar(state: MobileAppState, selectedAthlete: CoachAthleteSummary | null) {
  const pendingQueue = getPendingQueueItems(state.queue);
  const invalidQueue = getInvalidQueueItems(state.queue);
  const savedLabel = state.data.savedAt
    ? `сохранено ${formatDateTime(state.data.savedAt)}`
    : "Локальных данных пока нет";
  const invalidLabel = invalidQueue.length ? ` · не отправляется: ${invalidQueue.length}` : "";
  const roleLabel = getRoleLabel(state.session.user?.role);
  const athleteLabel = selectedAthlete ? ` · ${selectedAthlete.fullName}` : "";
  const syncLabel = pendingQueue.length ? `Синхр. (${pendingQueue.length})` : "Синхр.";
  const summaryLine = `Планов: ${state.data.assignedPlans.length} · ${savedLabel}${invalidLabel}`;

  return `
    <details class="app-topbar">
      <summary aria-label="Открыть действия профиля" title="Открыть действия профиля">
        <div class="app-topbar-main">
          <span>${state.isOnline ? "онлайн" : "офлайн"} · ${escapeHtml(roleLabel)}</span>
          <h1>${escapeHtml(state.session.user?.fullName ?? "PERFORM")}</h1>
          <p>${escapeHtml(summaryLine)}${escapeHtml(athleteLabel)}</p>
        </div>
        <span class="app-topbar-toggle" aria-hidden="true">
          <span class="topbar-toggle-open">⋯</span>
          <span class="topbar-toggle-close">×</span>
        </span>
      </summary>
      <div class="app-topbar-panel" aria-label="Действия приложения">
        <div class="app-topbar-panel-actions">
          <button
            class="topbar-action-button"
            data-refresh
            type="button"
            ${state.isBusy ? "disabled" : ""}
          >↻ Обновить</button>
          <button
            aria-label="${escapeHtml(syncLabel)}"
            class="topbar-action-button"
            data-sync
            title="${escapeHtml(syncLabel)}"
            type="button"
            ${state.isSyncing || pendingQueue.length === 0 ? "disabled" : ""}
          >⇄ ${escapeHtml(syncLabel)}</button>
        </div>
        <button
          class="topbar-logout-button"
          data-logout
          type="button"
        >Выйти</button>
      </div>
    </details>
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
        ${renderAthleteSelectOptions(state, state.selectedAthleteId)}
      </select>
    </label>
  `;
}

function renderAthleteSelectOptions(state: MobileAppState, selectedAthleteId: string | null) {
  return state.data.athletes.map((athlete) => `
    <option value="${escapeHtml(athlete.athleteId)}" ${selectedAthleteId === athlete.athleteId ? "selected" : ""}>
      ${escapeHtml(athlete.fullName)}
    </option>
  `).join("");
}

function renderScreen(state: MobileAppState, athleteId: string | null) {
  if (isCoachRole(state.session.user?.role) && state.coachDeviceWorkoutDetailId) {
    return renderCoachDeviceWorkoutDetailScreen(state, athleteId, state.coachDeviceWorkoutDetailId);
  }

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

  if (state.selectedScreen === "watches") {
    return renderWatchesScreen(state);
  }

  return renderDashboardScreen(state, athleteId);
}

function renderDashboardScreen(state: MobileAppState, athleteId: string | null) {
  const competitionPlans = getCompetitionPlansForAthlete(state, athleteId);
  const nextStart = getNextCompetitionPlan(competitionPlans);
  const isCoachView = isCoachRole(state.session.user?.role);
  const selectedDayDate = isCoachView ? state.selectedDayDate : todayValue();

  if (isCoachView) {
    return renderCoachTeamDashboardScreen(state, selectedDayDate);
  }

  return `
    <div class="screen-head">
      <h2>Главная</h2>
      <p>${formatDate(selectedDayDate)}${nextStart ? ` · старт через ${daysUntil(nextStart.competitionStartDate)} дн.` : ""}</p>
    </div>
    ${athleteId ? renderAthleteHomeCard(state, athleteId, selectedDayDate) : ""}
    ${nextStart ? renderAthleteNextStartCard(nextStart) : ""}
  `;
}

function renderCoachTeamDashboardScreen(state: MobileAppState, selectedDayDate: string) {
  const athletesWithReadiness = state.data.athletes
    .filter((athlete) => Boolean(getReadinessEntryForDate(state, athlete.athleteId, selectedDayDate)))
    .length;
  const athletesWithPlans = state.data.athletes
    .filter((athlete) => getPlansForAthlete(state, athlete.athleteId)
      .some((plan) => plan.day.dayDate === selectedDayDate))
    .length;

  return `
    <div class="screen-head coach-team-screen-head">
      <span>Команда</span>
      <h2>Сегодня у спортсменов</h2>
      <p>${formatDate(selectedDayDate)} · готовность ${athletesWithReadiness}/${state.data.athletes.length} · планы ${athletesWithPlans}/${state.data.athletes.length}</p>
    </div>
    ${renderCoachDayControl(state, null)}
    ${renderCoachTeamDayPanel(state, selectedDayDate)}
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
      <h2>Главная тренера</h2>
      <p>${formatDate(selectedDayDate)} · коротко по выбранному спортсмену и команде</p>
    </div>
    ${renderCoachDayControl(state, athleteId)}
    ${dayData
      ? `
        <div class="coach-day-status-stack">
          ${renderCoachDayStatusCard(state, dayData, aiReview)}
          ${renderCoachDayDetails(dayData, aiReview, aiReviewHistory, state)}
        </div>
      `
      : renderEmpty("Выберите спортсмена", "После выбора спортсмена экран покажет статус выбранного дня.")}
    ${renderCoachTeamDayPanel(state, selectedDayDate)}
  `;
}

function renderCoachDayDetails(
  dayData: CoachDayCleanSummary,
  aiReview: CoachDayAiReview | null,
  aiReviewHistory: CoachDayAiReview[],
  state: MobileAppState,
) {
  return `
    <details class="coach-day-details">
      <summary>
        <span>Подробности выбранного дня</span>
        <strong>${dayData.summary.completedExerciseCount}/${dayData.summary.exerciseCount || 0}</strong>
      </summary>
      <div class="coach-day-details-stack">
        ${renderCoachDayDataQualityCard(dayData)}
        ${renderCoachDayLoadExplanation(dayData)}
        ${renderCoachDayExerciseChecklist(dayData)}
        ${renderCoachDeviceWorkoutPanel(dayData, state.isBusy)}
        ${renderCoachDeviceHealthSummaryCard(dayData)}
        ${renderCoachAiReviewCard(
          dayData,
          aiReview,
          aiReviewHistory,
          state.isBusy,
        )}
      </div>
    </details>
  `;
}

function renderAthleteHomeCard(state: MobileAppState, athleteId: string, date: string) {
  const dayData = getCoachDayCleanSummary(state, athleteId, date);
  const entry = dayData.readinessEntry;
  const summary = dayData.summary;
  const readinessEntries = getRecentReadinessEntriesForAthlete(state, athleteId, 7);
  const cardStateClass = entry ? `readiness-${escapeHtml(entry.status)}` : "is-missing-readiness";
  const executionValue = formatAthleteExecutionCompletion(summary);

  return `
    <section class="athlete-home-card ${cardStateClass}">
      <div class="athlete-home-head">
        <div>
          <span>${escapeHtml(formatDayRelativeLabel(date))}</span>
          <h3>${escapeHtml(summary.statusLabel)}</h3>
          <p>${formatDate(date)} · выполнение ${escapeHtml(executionValue)}</p>
        </div>
        <strong>${entry ? entry.score : "-"}</strong>
      </div>
      ${renderAthleteTodayReadinessOverview(dayData, readinessEntries)}
      ${dayData.latestDiaryEntry ? `
        <p class="athlete-home-note">${escapeHtml(dayData.latestDiaryEntry.notes)}</p>
      ` : ""}
      <div class="athlete-home-actions">
        <button class="primary-action" data-screen="results" type="button">Открыть выполнение</button>
        <button class="secondary-action" data-screen="readiness" type="button">Заполнить готовность</button>
      </div>
    </section>
  `;
}

function renderAthleteTodayReadinessOverview(dayData: CoachDayCleanSummary, readinessEntries: ReadinessEntry[]) {
  const entry = dayData.readinessEntry;
  const summary = dayData.summary;
  const reasonRows = entry ? getReadinessPriorityRows(entry).slice(0, 3) : [];
  const recommendation = formatAthleteTodayRecommendation(entry, summary);

  return `
    <div class="athlete-today-overview">
      <div class="athlete-today-main">
        <div>
          <span>Сегодня</span>
          <strong>${entry ? `${entry.score} · ${formatReadinessStatus(entry.status)}` : "готовность не заполнена"}</strong>
          <small>${escapeHtml(entry ? formatReadinessFlags(entry) : "заполни готовность до тренировки")}</small>
        </div>
        <div>
          <span>Выполнение</span>
          <strong>${escapeHtml(formatAthleteExecutionCompletion(summary))}</strong>
          <small>${escapeHtml(formatAthleteExecutionDetail(summary))}</small>
        </div>
      </div>
      ${readinessEntries.length ? `
        <div class="mobile-readiness-mini-chart">
          ${renderReadinessTrendSvg(readinessEntries, "readiness-trend-svg is-mini")}
          ${renderReadinessTrendDots(readinessEntries)}
        </div>
      ` : ""}
      <div class="readiness-factor-list is-compact">
        ${reasonRows.length
          ? reasonRows.map(renderReadinessFactorRow).join("")
          : `<article class="readiness-factor-row is-watch">
              <span>Готовность</span>
              <strong>нет записи</strong>
              <small>данные появятся после сохранения чек-ина</small>
            </article>`}
      </div>
      <p class="athlete-today-recommendation">${escapeHtml(recommendation)}</p>
    </div>
  `;
}

function renderAthleteNextStartCard(nextStart: CompetitionPlanSummary) {
  return `
    <article class="athlete-next-start-card">
      <span>Следующий старт</span>
      <h3>${escapeHtml(nextStart.competitionTitle)}</h3>
      <p>${formatDate(nextStart.competitionStartDate)} · через ${daysUntil(nextStart.competitionStartDate)} дн.</p>
    </article>
  `;
}

function formatAthleteExecutionCompletion(summary: CoachTodayDaySummary) {
  if (summary.exerciseCount > 0) {
    return `${summary.completedExerciseCount}/${summary.exerciseCount}`;
  }

  if (summary.blockCount > 0) {
    return `${summary.completedBlockCount}/${summary.blockCount}`;
  }

  return "-";
}

function formatAthleteExecutionDetail(summary: CoachTodayDaySummary) {
  if (summary.exerciseCount > 0 || summary.blockCount > 0) {
    return summary.statusLabel.toLowerCase();
  }

  return "нет тренировки";
}

function renderCoachDayStatusCard(
  state: MobileAppState,
  dayData: CoachDayCleanSummary,
  aiReview: CoachDayAiReview | null,
) {
  const summary = dayData.summary;
  const readiness = dayData.readinessEntry;
  const dataQuality = buildCoachDayDataQuality(dayData);
  const completionRate = summary.exerciseCount > 0
    ? Math.round(((summary.completedExerciseCount + summary.partialExerciseCount * 0.5) / summary.exerciseCount) * 100)
    : summary.blockCount > 0
      ? Math.round(((summary.completedBlockCount + summary.partialBlockCount * 0.5) / summary.blockCount) * 100)
      : 0;
  const primaryAction = dataQuality.actions[0] ??
    aiReview?.tomorrowActions[0] ??
    "День можно разбирать по текущим данным.";
  const executionValue = summary.exerciseCount > 0
    ? `${summary.completedExerciseCount}/${summary.exerciseCount}`
    : `${summary.completedBlockCount}/${summary.blockCount || 0}`;
  const readinessEntries = getRecentReadinessEntriesForAthlete(state, dayData.athleteId, 7, dayData.date);

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
      ${renderCoachReadinessAnalytics(dayData, readinessEntries, aiReview)}
      <div class="coach-day-status-brief is-${dataQuality.status}">
        <div class="coach-day-status-brief-main">
          <span>Рабочая сводка тренера</span>
          <strong>${escapeHtml(summary.statusLabel)}</strong>
          <p>${escapeHtml(primaryAction)}</p>
        </div>
        <div class="coach-day-status-brief-grid">
          <article>
            <span>Готовность</span>
            <strong>${readiness ? `${readiness.score} · ${formatReadinessStatus(readiness.status)}` : "нет записи"}</strong>
            <small>${escapeHtml(readiness ? formatReadinessFlags(readiness) : "спортсмен ещё не отправил")}</small>
          </article>
          <article>
            <span>Выполнение</span>
            <strong>${escapeHtml(executionValue)}</strong>
            <small>${completionRate}% по дню · ${escapeHtml(formatCoachTodayExerciseBreakdown(summary))}</small>
          </article>
          <article>
            <span>Нагрузка</span>
            <strong>${escapeHtml(formatLoadValue(summary.actualLoad))} / ${escapeHtml(formatLoadValue(summary.plannedLoad))}</strong>
            <small>${escapeHtml(formatCoachTodayLoadDelta(summary))}</small>
          </article>
        </div>
      </div>
      ${renderCoachDayCommentBlocks(dayData)}
    </section>
  `;
}

function renderCoachReadinessAnalytics(
  dayData: CoachDayCleanSummary,
  readinessEntries: ReadinessEntry[],
  aiReview: CoachDayAiReview | null,
) {
  const readiness = dayData.readinessEntry;
  const reasonRows = readiness ? getReadinessPriorityRows(readiness).slice(0, 4) : [];
  const trend = getReadinessTrendDelta(readinessEntries);
  const trendLabel = formatReadinessTrendDelta(trend);
  const trendClass = getReadinessTrendClass(trend);

  return `
    <div class="coach-readiness-analytics ${readiness ? `readiness-${escapeHtml(readiness.status)}` : "is-missing-readiness"}">
      <div class="coach-readiness-analytics-head">
        <div>
          <span>Готовность и риск</span>
          <strong>${readiness ? `${readiness.score} · ${formatReadinessStatus(readiness.status)}` : "нет готовности"}</strong>
          <small>${escapeHtml(trendLabel)}</small>
        </div>
        <em class="readiness-trend-chip is-${trendClass}">${escapeHtml(formatCoachReadinessDecision(dayData, aiReview))}</em>
      </div>
      ${readinessEntries.length ? renderReadinessTrendSvg(readinessEntries, "readiness-trend-svg is-coach") : ""}
      <div class="readiness-factor-list is-coach">
        ${reasonRows.length
          ? reasonRows.map(renderReadinessFactorRow).join("")
          : `<article class="readiness-factor-row is-watch">
              <span>Готовность</span>
              <strong>нет записи</strong>
              <small>сначала нужна отметка спортсмена</small>
            </article>`}
      </div>
    </div>
  `;
}

function renderCoachDayLoadExplanation(dayData: CoachDayCleanSummary) {
  const summary = dayData.summary;
  const linkGroups = getCoachDeviceWorkoutLinkGroups(dayData.blocks);
  const linkedSessionCount = linkGroups.filter((group) =>
    getDeviceWorkoutLinkGroupForBlocks(
      dayData.deviceWorkoutLinks,
      group.assignedBlockIds,
    ).isFullyLinked
  ).length;
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

  return `
    <section class="coach-day-load-explanation">
      <div class="summary-inline-head">
        <div>
          <span>Нагрузка</span>
          <h3>Как посчитан факт</h3>
        </div>
        <strong>${formatLoadValue(summary.actualLoad)}</strong>
      </div>
      <ul>
        ${loadExplanation.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
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

function renderCoachDayCommentBlocks(dayData: CoachDayCleanSummary) {
  const blocks = [
    dayData.athleteExecutionNote
      ? {
          label: "Комментарий спортсмена",
          text: dayData.athleteExecutionNote,
        }
      : null,
    dayData.latestDiaryEntry
      ? {
          label: "Комментарий тренера",
          text: dayData.coachNote,
        }
      : null,
  ].filter((block): block is { label: string; text: string } => Boolean(block));

  if (blocks.length === 0) {
    return "";
  }

  return `
    ${blocks.map((block) => `
      <div class="coach-execution-review-note">
        <strong>${escapeHtml(block.label)}</strong>
        <p>${escapeHtml(block.text)}</p>
      </div>
    `).join("")}
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
        ${exercises.map(({ block, exercise }) => {
          const detailParts = [
            escapeHtml(block.sessionName),
            isRepeatedSingleExerciseBlock(block) ? "" : renderTrainingTextWithAbbreviationHints(block.name),
            renderTrainingTextWithAbbreviationHints(exercise.plannedWork || "-"),
            escapeHtml(exercise.sourceLabel),
          ].filter(Boolean);

          return `
            <article class="is-${exercise.status}">
              <span>${escapeHtml(exercise.statusLabel)}</span>
              <strong>${renderTrainingTextWithAbbreviationHints(exercise.name)}</strong>
              <p>${detailParts.join(" · ")}</p>
            </article>
          `;
        }).join("")}
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
        ? `<p class="muted-copy">Выбор станет активным после того, как спортсмен синхронизирует детальные тренировки часов или приложения здоровья за эту дату.</p>`
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
                  <small>устройство · ${escapeHtml(formatTimeRange(linkedWorkout.startTime, linkedWorkout.endTime))}</small>
                  <button
                    class="secondary-action device-workout-detail-action"
                    data-coach-device-workout-detail="${escapeHtml(linkedWorkout.id)}"
                    type="button"
                  >
                    Детали тренировки
                  </button>
                </div>
              ` : ""}
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderCoachDeviceHealthSummaryCard(dayData: CoachDayCleanSummary) {
  const summary = dayData.deviceHealthSummary;
  const status = getDeviceHealthStatus(summary);
  const signalTotal = status.present.length + status.missing.length;
  const workouts = dayData.deviceWorkouts;

  return `
    <section class="coach-day-exercise-card coach-device-health-summary-card">
      <div class="summary-inline-head">
        <div>
          <span>Данные часов</span>
          <h3>${summary ? status.statusLabel : "Пока нет данных"}</h3>
          <p>${summary ? `Обновлено ${formatDateTime(summary.syncedAt)}` : "Синхронизацию выполняет спортсмен в своём приложении."}</p>
        </div>
        <strong>${status.present.length}/${signalTotal || 0}</strong>
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
          workouts.length
            ? `${workouts.length} детальных записей за день`
            : formatDeviceHealthWorkoutDetail(summary),
        )}
      </div>
      <div class="device-health-signal-list">
        <article>
          <strong>Есть</strong>
          <p>${escapeHtml(status.present.length ? status.present.join(", ") : "пока нет ключевых показателей")}</p>
        </article>
        <article>
          <strong>Не хватает</strong>
          <p>${escapeHtml(status.missing.length ? status.missing.join(", ") : "достаточно для разбора дня")}</p>
        </article>
      </div>
      <p class="device-health-guidance">
        Тренер видит только итоговые показатели за выбранный день. Подключение и повторную синхронизацию делает спортсмен.
      </p>
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
    const executionValue = dayData.summary.exerciseCount > 0
      ? `${dayData.summary.completedExerciseCount}/${dayData.summary.exerciseCount}`
      : `${dayData.summary.completedBlockCount}/${dayData.summary.blockCount || 0}`;
    const readinessValue = dayData.readinessEntry ? String(dayData.readinessEntry.score) : "-";
    const planValue = formatCoachTodayPlanCount(dayData.summary);

    return {
      athlete,
      attentionLabel: dataQuality.actions[0] ?? dayData.summary.statusLabel,
      dataQuality,
      dayData,
      executionValue,
      planValue,
      readinessValue,
    };
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
        ${rows.map(({ athlete, attentionLabel, dataQuality, dayData, executionValue, planValue, readinessValue }) => `
          <article class="coach-team-day-row is-${dataQuality.status}">
            <div>
              <strong>${escapeHtml(athlete.fullName)}</strong>
              <span>${escapeHtml(dayData.summary.statusLabel)}</span>
            </div>
            <div class="coach-team-day-metrics">
              <span>Гот. ${readinessValue}</span>
              <span>План ${escapeHtml(planValue)}</span>
              <span>Вып. ${escapeHtml(executionValue)}</span>
            </div>
            <p>${escapeHtml(attentionLabel)}</p>
            <button
              data-coach-open-athlete="${escapeHtml(athlete.athleteId)}"
              data-coach-open-day="${escapeHtml(selectedDayDate)}"
              data-coach-open-screen="athletes"
              type="button"
            >
              Открыть спортсмена
            </button>
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
    ${selectedAthlete ? renderCoachAthleteSwitchHeader(state, selectedAthlete) : ""}
    ${selectedAthlete ? renderCoachAthleteReadinessOverview(state, selectedAthlete.athleteId) : ""}
    ${selectedAthlete ? renderCoachAthleteDayBrief(state, selectedAthlete.athleteId) : ""}
  `;
}

function renderCoachAthleteSwitchHeader(state: MobileAppState, athlete: CoachAthleteSummary) {
  return `
    <section class="coach-athlete-switch-header" aria-label="Выбор спортсмена">
      <label class="coach-athlete-switch-control">
        <span class="coach-athlete-switch-copy">
          <em>Спортсмен</em>
          <strong>${escapeHtml(athlete.fullName)}</strong>
        </span>
        <span class="coach-athlete-switch-action" aria-hidden="true">Сменить</span>
        <select data-athlete-select aria-label="Выбрать спортсмена">
          ${renderAthleteSelectOptions(state, athlete.athleteId)}
        </select>
        <span class="coach-athlete-switch-chevron" aria-hidden="true">⌄</span>
      </label>
    </section>
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
        <span>Профиль</span>
        <h3>Данные спортсмена</h3>
        <p>${escapeHtml(athlete.email)}</p>
      </div>
      <div class="coach-athlete-card-grid">
        <span>${escapeHtml(profileParts.join(" · ") || "Профиль не заполнен")}</span>
        <span>${escapeHtml(baselineParts.join(" · ") || "Базовые показатели не заданы")}</span>
      </div>
    </article>
  `;
}

interface CoachReadinessChartDefinition {
  axisDecimals: number;
  detail: string;
  fixedMax?: number;
  fixedMin?: number;
  label: string;
  lineClass: string;
  lowerIsBetter?: boolean;
  metric: CoachReadinessChartMetric;
  minWindow: number;
  shortLabel: string;
  unit: string;
  valueDecimals: number;
}

interface CoachReadinessChartScale {
  max: number;
  min: number;
  ticks: number[];
}

const COACH_READINESS_CHART_DEFINITIONS: Record<CoachReadinessChartMetric, CoachReadinessChartDefinition> = {
  bodyWeight: {
    axisDecimals: 1,
    detail: "изменение веса",
    label: "Вес",
    lineClass: "is-weight",
    metric: "bodyWeight",
    minWindow: 1,
    shortLabel: "Вес",
    unit: "кг",
    valueDecimals: 1,
  },
  fatigueLevel: {
    axisDecimals: 0,
    detail: "ниже лучше",
    fixedMax: 5,
    fixedMin: 1,
    label: "Усталость",
    lineClass: "is-fatigue",
    lowerIsBetter: true,
    metric: "fatigueLevel",
    minWindow: 4,
    shortLabel: "Усталость",
    unit: "/5",
    valueDecimals: 0,
  },
  motivationLevel: {
    axisDecimals: 0,
    detail: "выше лучше",
    fixedMax: 5,
    fixedMin: 1,
    label: "Мотивация",
    lineClass: "is-motivation",
    metric: "motivationLevel",
    minWindow: 4,
    shortLabel: "Мотивация",
    unit: "/5",
    valueDecimals: 0,
  },
  muscleSoreness: {
    axisDecimals: 0,
    detail: "ниже лучше",
    fixedMax: 5,
    fixedMin: 1,
    label: "Мышцы",
    lineClass: "is-muscles",
    lowerIsBetter: true,
    metric: "muscleSoreness",
    minWindow: 4,
    shortLabel: "Мышцы",
    unit: "/5",
    valueDecimals: 0,
  },
  painLevel: {
    axisDecimals: 0,
    detail: "ниже лучше",
    fixedMax: 10,
    fixedMin: 0,
    label: "Боль",
    lineClass: "is-pain",
    lowerIsBetter: true,
    metric: "painLevel",
    minWindow: 10,
    shortLabel: "Боль",
    unit: "/10",
    valueDecimals: 0,
  },
  readiness: {
    axisDecimals: 0,
    detail: "общая оценка",
    fixedMax: 100,
    fixedMin: 0,
    label: "Готовность",
    lineClass: "is-readiness",
    metric: "readiness",
    minWindow: 100,
    shortLabel: "Готовность",
    unit: "",
    valueDecimals: 0,
  },
  restingHr: {
    axisDecimals: 0,
    detail: "пульс покоя",
    label: "Пульс покоя",
    lineClass: "is-pulse",
    lowerIsBetter: true,
    metric: "restingHr",
    minWindow: 18,
    shortLabel: "Пульс",
    unit: "уд/мин",
    valueDecimals: 0,
  },
  sleepHours: {
    axisDecimals: 1,
    detail: "часы сна",
    label: "Сон",
    lineClass: "is-sleep",
    metric: "sleepHours",
    minWindow: 2,
    shortLabel: "Сон",
    unit: "ч",
    valueDecimals: 1,
  },
};

const COACH_READINESS_CHART_OPTION_ORDER: CoachReadinessChartMetric[] = [
  "readiness",
  "restingHr",
  "bodyWeight",
  "sleepHours",
  "fatigueLevel",
  "muscleSoreness",
  "motivationLevel",
  "painLevel",
];

const DEFAULT_COACH_READINESS_CHART_METRICS: CoachReadinessChartMetric[] = [
  "readiness",
  "restingHr",
  "bodyWeight",
];

function renderCoachAthleteReadinessOverview(state: MobileAppState, athleteId: string) {
  const period = normalizeCoachReadinessChartPeriod(state.coachReadinessChartPeriod);
  const entries = getRecentReadinessEntriesForAthlete(state, athleteId, period);
  const history = getReadinessHistory(state, athleteId);
  const latestEntry = history[0] ?? entries[entries.length - 1] ?? null;
  const selectedMetrics = normalizeCoachReadinessChartMetrics(state.coachReadinessChartMetrics);
  const selectedAthlete = getCoachContextAthlete(state, athleteId);

  if (!latestEntry) {
    return `
      <section class="readiness-trend-card coach-athlete-readiness-card is-empty">
        <div class="readiness-trend-head">
          <div>
            <span>Готовность</span>
            <h3>Пока нет записей</h3>
            <p>Когда спортсмен сохранит готовность, тренер увидит динамику и ключевые показатели здесь.</p>
          </div>
          <strong>—</strong>
        </div>
      </section>
    `;
  }

  return `
    <section class="readiness-trend-card coach-athlete-readiness-card readiness-${escapeHtml(latestEntry.status)}" aria-label="Готовность спортсмена">
      <div class="readiness-trend-head">
        <div>
          <span>Готовность</span>
          <h3>Панель показателей</h3>
          <p>${formatDate(latestEntry.entryDate)} · ${escapeHtml(formatReadinessFlags(latestEntry))}</p>
        </div>
        <strong>${latestEntry.score}</strong>
      </div>
      ${renderCoachReadinessChartSettings(selectedMetrics, period)}
      <div class="coach-athlete-chart-list">
        ${selectedMetrics.map((metric) => renderCoachReadinessMetricChart(entries, metric, selectedAthlete)).join("")}
      </div>
      <div class="coach-athlete-readiness-facts">
        ${renderCoachAthleteReadinessFact("Пульс покоя", `${latestEntry.restingHr}`, "уд/мин")}
        ${renderCoachAthleteReadinessFact("Вес", `${formatReadinessNumber(latestEntry.bodyWeight)} кг`, "последний")}
        ${renderCoachAthleteReadinessFact("Сон", `${formatReadinessNumber(latestEntry.sleepHours)} ч`, "за ночь")}
        ${renderCoachAthleteReadinessFact("Боль", latestEntry.painLevel > 0 ? `${latestEntry.painLevel}/10` : "нет", "самооценка")}
      </div>
    </section>
  `;
}

function renderCoachReadinessChartSettings(
  selectedMetrics: CoachReadinessChartMetric[],
  period: CoachReadinessChartPeriod,
) {
  return `
    <details class="coach-athlete-chart-settings">
      <summary>
        <span>Настроить графики</span>
        <small>${selectedMetrics.length}/${COACH_READINESS_CHART_LIMIT} · ${period} дней</small>
      </summary>
      <section>
        <div class="coach-athlete-chart-periods" aria-label="Период графиков">
          ${([15, 20, 30] as CoachReadinessChartPeriod[]).map((option) => `
            <button class="${period === option ? "is-active" : ""}" data-coach-readiness-chart-period="${option}" type="button">${option} дней</button>
          `).join("")}
        </div>
        <div class="coach-athlete-chart-options">
          ${COACH_READINESS_CHART_OPTION_ORDER.map((metric) => {
            const definition = COACH_READINESS_CHART_DEFINITIONS[metric];
            const isSelected = selectedMetrics.includes(metric);
            const isDisabled = !isSelected && selectedMetrics.length >= COACH_READINESS_CHART_LIMIT;

            return `
              <label class="${isSelected ? "is-selected" : ""} ${isDisabled ? "is-disabled" : ""}">
                <input data-coach-readiness-chart-metric type="checkbox" value="${definition.metric}" ${isSelected ? "checked" : ""} ${isDisabled ? "disabled" : ""} />
                <span>${escapeHtml(definition.label)}</span>
                <small>${escapeHtml(definition.detail)}</small>
              </label>
            `;
          }).join("")}
        </div>
      </section>
    </details>
  `;
}

function renderCoachReadinessMetricChart(
  entries: ReadinessEntry[],
  metric: CoachReadinessChartMetric,
  athlete: CoachAthleteSummary | null,
) {
  const definition = COACH_READINESS_CHART_DEFINITIONS[metric];
  const points = entries
    .map((entry) => ({
      entry,
      value: getCoachReadinessMetricValue(entry, metric),
    }))
    .filter((point) => Number.isFinite(point.value));
  const latestPoint = points[points.length - 1] ?? null;

  if (!latestPoint) {
    return `
      <article class="coach-athlete-metric-card is-empty">
        <div class="readiness-trend-chart-meta">
          <span>${escapeHtml(definition.label)}</span>
          <em class="readiness-trend-chip is-watch">нет данных</em>
        </div>
        <p>Спортсмен ещё не отправлял этот показатель.</p>
      </article>
    `;
  }

  const values = points.map((point) => point.value);
  const referenceValue = getCoachReadinessMetricReferenceValue(metric, athlete);
  const scale = getCoachReadinessChartScale(values, definition, referenceValue);
  const trendDelta = latestPoint.value - points[0].value;

  return `
    <article class="coach-athlete-metric-card ${definition.lineClass}">
      <div class="readiness-trend-chart-meta">
        <div>
          <span>${escapeHtml(definition.label)}</span>
          <strong>${escapeHtml(formatCoachReadinessMetricValue(latestPoint.value, definition))}</strong>
          <small>${formatDate(latestPoint.entry.entryDate)} · ${points.length} замеров</small>
        </div>
        <em class="readiness-trend-chip ${getCoachReadinessMetricTrendClass(trendDelta, definition)}">${escapeHtml(formatCoachReadinessMetricTrend(trendDelta, definition))}</em>
      </div>
      ${renderCoachReadinessMetricSvg(points, definition, scale, referenceValue)}
    </article>
  `;
}

function renderCoachReadinessMetricSvg(
  points: { entry: ReadinessEntry; value: number }[],
  definition: CoachReadinessChartDefinition,
  scale: CoachReadinessChartScale,
  referenceValue: number | null,
) {
  const width = 300;
  const height = 116;
  const leftPadding = 34;
  const rightPadding = 10;
  const topPadding = 14;
  const bottomPadding = 18;
  const chartWidth = width - leftPadding - rightPadding;
  const chartHeight = height - topPadding - bottomPadding;
  const denominator = Math.max(points.length - 1, 1);
  const valueRange = Math.max(scale.max - scale.min, 1);
  const chartPoints = points.map((point, index) => {
    const x = leftPadding + (chartWidth * index) / denominator;
    const normalized = (point.value - scale.min) / valueRange;
    const y = topPadding + chartHeight * (1 - Math.max(0, Math.min(1, normalized)));
    return { ...point, x, y };
  });
  const polyline = chartPoints.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const areaPoints = [
    polyline,
    `${chartPoints[chartPoints.length - 1]?.x.toFixed(1) ?? leftPadding},${height - bottomPadding}`,
    `${leftPadding},${height - bottomPadding}`,
  ].join(" ");
  const tickLines = scale.ticks.map((tick) => {
    const y = topPadding + chartHeight * (1 - (tick - scale.min) / valueRange);
    return `
      <line x1="${leftPadding}" y1="${y.toFixed(1)}" x2="${width - rightPadding}" y2="${y.toFixed(1)}"></line>
      <text class="coach-athlete-metric-axis" x="0" y="${(y + 3).toFixed(1)}">${escapeHtml(formatCoachReadinessAxisValue(tick, definition))}</text>
    `;
  }).join("");
  const referenceY = referenceValue !== null
    ? topPadding + chartHeight * (1 - (referenceValue - scale.min) / valueRange)
    : null;

  return `
    <svg class="readiness-trend-svg coach-athlete-metric-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="График ${escapeHtml(definition.label.toLowerCase())}">
      ${tickLines}
      ${referenceY !== null && referenceY >= topPadding && referenceY <= height - bottomPadding
        ? `<line class="coach-athlete-metric-reference" x1="${leftPadding}" y1="${referenceY.toFixed(1)}" x2="${width - rightPadding}" y2="${referenceY.toFixed(1)}"></line>`
        : ""}
      <polygon class="coach-athlete-metric-area ${definition.lineClass}" points="${areaPoints}"></polygon>
      <polyline class="coach-athlete-metric-line ${definition.lineClass}" points="${polyline}"></polyline>
      ${chartPoints.map((point) => `
        <circle class="coach-athlete-metric-dot ${definition.lineClass}" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="3.7"></circle>
      `).join("")}
      <text class="coach-athlete-metric-date" x="${leftPadding}" y="${height - 2}">${formatShortDate(points[0].entry.entryDate)}</text>
      <text class="coach-athlete-metric-date" x="${width - 52}" y="${height - 2}">${formatShortDate(points[points.length - 1].entry.entryDate)}</text>
    </svg>
  `;
}

function getCoachReadinessMetricValue(entry: ReadinessEntry, metric: CoachReadinessChartMetric) {
  switch (metric) {
    case "bodyWeight":
      return entry.bodyWeight;
    case "fatigueLevel":
      return entry.fatigueLevel;
    case "motivationLevel":
      return entry.motivationLevel;
    case "muscleSoreness":
      return entry.muscleSoreness;
    case "painLevel":
      return entry.painLevel;
    case "readiness":
      return entry.score;
    case "restingHr":
      return entry.restingHr;
    case "sleepHours":
      return entry.sleepHours;
  }
}

function getCoachReadinessMetricReferenceValue(
  metric: CoachReadinessChartMetric,
  athlete: CoachAthleteSummary | null,
) {
  if (metric === "bodyWeight") {
    return athlete?.baselineWeightKg ?? null;
  }

  if (metric === "restingHr") {
    return athlete?.baselineRestingHr ?? null;
  }

  return null;
}

function getCoachReadinessChartScale(
  values: number[],
  definition: CoachReadinessChartDefinition,
  referenceValue: number | null,
): CoachReadinessChartScale {
  if (definition.fixedMin !== undefined && definition.fixedMax !== undefined) {
    return {
      max: definition.fixedMax,
      min: definition.fixedMin,
      ticks: [definition.fixedMax, (definition.fixedMax + definition.fixedMin) / 2, definition.fixedMin],
    };
  }

  const scaleValues = values;
  const minValue = Math.min(...scaleValues);
  const maxValue = Math.max(...scaleValues);
  const rawWindow = maxValue - minValue;
  const windowSize = Math.max(rawWindow * 1.35, definition.minWindow);
  const center = (minValue + maxValue) / 2;
  const step = getCoachReadinessChartStep(windowSize, definition);
  const min = Math.floor((center - windowSize / 2) / step) * step;
  const max = Math.ceil((center + windowSize / 2) / step) * step;
  const mid = (min + max) / 2;

  return {
    max,
    min,
    ticks: [max, mid, min],
  };
}

function getCoachReadinessChartStep(windowSize: number, definition: CoachReadinessChartDefinition) {
  if (definition.metric === "bodyWeight") {
    if (windowSize <= 1.2) {
      return 0.2;
    }

    if (windowSize <= 3) {
      return 0.5;
    }

    return 1;
  }

  if (definition.metric === "sleepHours") {
    return windowSize <= 3 ? 0.5 : 1;
  }

  if (definition.metric === "restingHr") {
    return windowSize <= 20 ? 5 : 10;
  }

  return 1;
}

function formatCoachReadinessMetricValue(value: number, definition: CoachReadinessChartDefinition) {
  const normalizedValue = definition.valueDecimals === 0
    ? String(Math.round(value))
    : value.toFixed(definition.valueDecimals);

  return definition.unit ? `${normalizedValue} ${definition.unit}` : normalizedValue;
}

function formatCoachReadinessAxisValue(value: number, definition: CoachReadinessChartDefinition) {
  return definition.axisDecimals === 0 ? String(Math.round(value)) : value.toFixed(definition.axisDecimals);
}

function formatCoachReadinessMetricTrend(delta: number, definition: CoachReadinessChartDefinition) {
  if (Math.abs(delta) < 0.0001) {
    return "без изменений";
  }

  const sign = delta > 0 ? "+" : "";
  const formattedDelta = definition.valueDecimals === 0
    ? `${sign}${Math.round(delta)}`
    : `${sign}${delta.toFixed(definition.valueDecimals)}`;

  return `${formattedDelta}${definition.unit ? ` ${definition.unit}` : ""}`;
}

function getCoachReadinessMetricTrendClass(delta: number, definition: CoachReadinessChartDefinition) {
  if (Math.abs(delta) < 0.0001) {
    return "is-good";
  }

  const isPositive = delta > 0;
  const isBetter = definition.lowerIsBetter ? !isPositive : isPositive;

  return isBetter ? "is-good" : "is-watch";
}

function normalizeCoachReadinessChartMetrics(metrics: CoachReadinessChartMetric[]) {
  const normalized = metrics
    .filter((metric) => COACH_READINESS_CHART_OPTION_ORDER.includes(metric))
    .filter((metric, index, items) => items.indexOf(metric) === index)
    .slice(0, COACH_READINESS_CHART_LIMIT);

  return normalized.length ? normalized : DEFAULT_COACH_READINESS_CHART_METRICS;
}

function parseCoachReadinessChartMetric(value: string | undefined): CoachReadinessChartMetric | null {
  return COACH_READINESS_CHART_OPTION_ORDER.includes(value as CoachReadinessChartMetric)
    ? value as CoachReadinessChartMetric
    : null;
}

function parseCoachReadinessChartPeriod(value: string | undefined): CoachReadinessChartPeriod {
  const period = Number(value);

  return period === 15 || period === 20 || period === 30 ? period : 30;
}

function normalizeCoachReadinessChartPeriod(period: CoachReadinessChartPeriod) {
  return period === 15 || period === 20 || period === 30 ? period : 30;
}

function renderCoachAthleteSingleReadinessPoint(entry: ReadinessEntry) {
  return `
    <div class="coach-athlete-readiness-one-point">
      <strong>${entry.score}</strong>
      <span>${formatShortDate(entry.entryDate)}</span>
      <small>нужны ещё замеры для графика</small>
    </div>
  `;
}

function renderCoachAthleteReadinessFact(label: string, value: string, detail: string) {
  return `
    <article>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(detail)}</small>
    </article>
  `;
}

function renderCoachAthleteDayBrief(state: MobileAppState, athleteId: string) {
  const selectedDayDate = state.selectedDayDate;
  const dayData = getCoachDayCleanSummary(state, athleteId, selectedDayDate);
  const daySummary = dayData.summary;

  return `
    <section class="athlete-day-brief-card">
      <div class="athlete-day-brief-head">
        <div>
          <span>День спортсмена</span>
          <h3>${escapeHtml(formatDayRelativeLabel(selectedDayDate))} · ${formatShortDate(selectedDayDate)}</h3>
          <p>${escapeHtml(daySummary.statusLabel.toLowerCase())}</p>
        </div>
        <strong>${daySummary.completedExerciseCount}/${daySummary.exerciseCount || 0}</strong>
      </div>
      <div class="athlete-day-brief-grid">
        ${renderCoachAthleteBriefMetric("План на день", formatCoachTodayPlanCount(daySummary), formatCoachTodayPlanNames(daySummary))}
        ${renderCoachAthleteBriefMetric("Выполнение", `${daySummary.completedExerciseCount}/${daySummary.exerciseCount || 0}`, formatCoachTodayExerciseBreakdown(daySummary))}
        ${renderCoachAthleteBriefMetric("Нагрузка", `${formatLoadValue(daySummary.actualLoad)} / ${formatLoadValue(daySummary.plannedLoad)}`, formatCoachTodayLoadDelta(daySummary))}
      </div>
      <p class="athlete-day-brief-note">Комментарий: ${escapeHtml(dayData.coachNote)}</p>
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

interface DeviceHealthCardOptions {
  compact?: boolean;
  diagnosticsCollapsed?: boolean;
}

function renderDeviceHealthCard(
  state: MobileAppState,
  athleteId: string,
  date: string,
  options: DeviceHealthCardOptions = {},
) {
  const summary = getDeviceHealthSummaryForDate(state, athleteId, date);
  const workouts = getDeviceWorkoutsForDate(state, athleteId, date);
  const canSync = state.session.user?.role === "athlete" &&
    state.session.user.athleteId === athleteId;
  const syncLabel = formatDeviceHealthSyncLabel(summary);
  const status = getDeviceHealthStatus(summary);

  if (options.compact) {
    return renderCompactDeviceHealthCard(state, summary, workouts, canSync, date);
  }

  return `
    <section class="device-health-card ${options.compact ? "is-compact" : ""}">
      <div class="device-health-head">
        <div>
          <span>${escapeHtml(formatWatchProviderLabel(summary))}</span>
          <h3>${escapeHtml(formatDeviceHealthCardTitle(summary))}</h3>
          <p>${escapeHtml(formatDate(date))} · ${escapeHtml(syncLabel)}</p>
        </div>
        ${canSync && isAppleHealthRuntime() ? `
          <div class="device-health-actions">
            <button class="secondary-action" data-device-health-sync data-device-health-date="${escapeHtml(date)}" type="button" ${state.isBusy ? "disabled" : ""}>
              Синхронизировать часы
            </button>
          </div>
        ` : canSync ? `
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
      ${renderHealthConnectDiagnostics(summary, options.diagnosticsCollapsed === true)}
      ${canSync && SHOW_DIRECT_WATCH_DIAGNOSTICS && isDirectWatchRuntime() ? renderDirectWatchDiagnostics(state, date) : ""}
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

function renderCompactDeviceHealthCard(
  state: MobileAppState,
  summary: DeviceHealthDailySummary | null,
  workouts: DeviceWorkout[],
  canSync: boolean,
  date: string,
) {
  return `
    <section class="device-health-card is-compact">
      <div class="device-health-status ${summary ? "is-connected" : "is-missing"}">
        <strong>${escapeHtml(formatCompactDeviceHealthStatus(summary))}</strong>
        <span>${escapeHtml(formatCompactDeviceHealthHint(summary, canSync))}</span>
      </div>
      <div class="today-indicators-grid device-health-compact-grid">
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
          "Тренировка",
          formatDeviceHealthWorkoutValue(summary),
          formatDeviceHealthWorkoutDetail(summary),
        )}
        ${hasDeviceOxygenSaturationData(summary)
          ? renderTodayIndicator(
            "SpO2",
            formatDeviceHealthOxygenValue(summary),
            formatDeviceHealthOxygenDetail(summary),
          )
          : ""}
      </div>
      ${workouts.length ? `
        <div class="device-health-compact-workouts">
          ${workouts.slice(0, 2).map((workout) => `
            <article>
              <strong>${escapeHtml(formatDeviceWorkoutTitle(workout))}</strong>
              <span>${escapeHtml(formatDeviceWorkoutSummary(workout) || "данные тренировки получены")}</span>
            </article>
          `).join("")}
        </div>
      ` : ""}
      ${canSync ? `
        <div class="device-health-actions device-health-compact-actions">
          <button class="secondary-action" data-device-health-sync data-device-health-date="${escapeHtml(date)}" type="button" ${state.isBusy ? "disabled" : ""}>
            Синхронизировать часы
          </button>
        </div>
      ` : ""}
      ${canSync && SHOW_DIRECT_WATCH_DIAGNOSTICS && isDirectWatchRuntime() ? renderDirectWatchDiagnostics(state, date) : ""}
    </section>
  `;
}

function renderWatchesScreen(state: MobileAppState) {
  if (state.session.user?.role !== "athlete") {
    return renderEmpty("Часы подключает спортсмен", "Тренер видит данные часов в карточке спортсмена после синхронизации.");
  }

  const athleteId = state.session.user.athleteId;
  if (!athleteId) {
    return renderEmpty("Профиль спортсмена не найден", "Войдите под спортсменом, чтобы подключить часы.");
  }

  const date = todayValue();

  if (state.watchDetailMetric) {
    return renderWatchMetricDetailScreen(state, athleteId, date);
  }

  if (state.watchWorkoutDetailId) {
    return renderWatchWorkoutDetailScreen(state, athleteId, state.watchWorkoutDetailId);
  }

  if (state.watchWorkoutHistoryOpen) {
    return renderWatchWorkoutHistoryScreen(state, athleteId, date);
  }

  const summary = getDeviceHealthSummaryForDate(state, athleteId, date);

  if (state.watchSettingsOpen) {
    return renderWatchSettingsScreen(state, summary, date);
  }

  const heartRateSamples = getDeviceHealthSamplesForDate(state, athleteId, date, "heart_rate");
  const todayWorkouts = getDeviceWorkoutsForDate(state, athleteId, date);
  const recentWorkouts = getRecentDeviceWorkouts(state, athleteId, date, 30);

  return `
    ${renderWatchParametersCard(summary, heartRateSamples, state, date)}
    ${renderWatchWorkoutSummaryCard(todayWorkouts, recentWorkouts, date)}
    ${renderWatchSettingsEntryCard(state, summary)}
  `;
}

interface WatchWorkoutContext {
  heartRateSamples: DeviceHealthSample[];
  oxygenSamples: DeviceHealthSample[];
  stressSamples: DeviceHealthSample[];
  summary: DeviceHealthDailySummary | null;
}

type WatchMetricStat = {
  detail?: string;
  label: string;
  value: string;
};

type WatchMetricTrendPoint = {
  date: string;
  displayValue: string;
  label: string;
  value: number | null;
};

interface WatchWorkoutHistoryGroup {
  activeCalories: number;
  date: string;
  distanceMeters: number;
  durationMinutes: number;
  workouts: DeviceWorkout[];
}

interface WatchWorkoutHistoryTotals {
  activeCalories: number;
  distanceMeters: number;
  durationMinutes: number;
  workoutCount: number;
}

const WATCH_DETAIL_METRIC_LABELS: Record<WatchDetailMetric, string> = {
  load: "Нагрузка",
  oxygen: "Кислород",
  pulse: "Пульс",
  sleep: "Сон",
  steps: "Шаги",
  stress: "Стресс",
};

function getWatchDetailSampleMetric(metric: WatchDetailMetric): DeviceHealthSampleMetric | null {
  if (metric === "pulse") {
    return "heart_rate";
  }

  if (metric === "oxygen") {
    return "oxygen_saturation";
  }

  if (metric === "stress") {
    return "stress";
  }

  return null;
}

function renderWatchMetricDetailScreen(state: MobileAppState, athleteId: string, date: string) {
  const metric = state.watchDetailMetric ?? "pulse";
  const period = state.watchDetailPeriod;
  const periodDates = getWatchDetailPeriodDates(date, period);
  const summaries = getDeviceHealthSummariesForDates(state, athleteId, periodDates);
  const summary = getDeviceHealthSummaryForDate(state, athleteId, date);
  const sampleMetric = getWatchDetailSampleMetric(metric);
  const detailSamples = sampleMetric && period === "day"
    ? getDeviceHealthSamplesForDate(state, athleteId, date, sampleMetric)
    : [];
  const title = WATCH_DETAIL_METRIC_LABELS[metric];

  return `
    <section class="watch-detail-screen">
      <div class="watch-detail-title-row">
        <button aria-label="Назад" class="watch-detail-back-button" data-watch-detail-back type="button">‹</button>
        <h3>${escapeHtml(title)}</h3>
      </div>
      <p class="watch-detail-date">${escapeHtml(formatWatchDetailPeriodLabel(date, period))}</p>
      <div class="watch-detail-period-tabs" role="tablist" aria-label="Период">
        ${(["day", "week", "month"] as WatchDetailPeriod[]).map((item) => `
          <button
            class="${period === item ? "is-active" : ""}"
            data-watch-detail-period="${item}"
            type="button"
          >${escapeHtml(formatWatchDetailPeriodTab(item))}</button>
        `).join("")}
      </div>
      ${renderWatchMetricDetailBody(metric, period, summary, summaries, periodDates, detailSamples)}
    </section>
  `;
}

function renderWatchWorkoutDetailScreen(state: MobileAppState, athleteId: string, workoutId: string) {
  const workout = getDeviceWorkoutById(state, athleteId, workoutId);
  if (!workout) {
    return `
      <section class="watch-detail-screen">
        <div class="watch-detail-title-row">
          <button aria-label="Назад" class="watch-detail-back-button" data-watch-workout-detail-back type="button">‹</button>
          <h3>Тренировка</h3>
        </div>
        ${renderEmpty("Тренировка не найдена", "Синхронизируйте часы ещё раз, чтобы обновить список тренировок.")}
      </section>
    `;
  }

  const context = getWatchWorkoutDetailContext(state, athleteId, workout);
  const graphSeries = buildDeviceWorkoutGraphSeries(workout, context);
  const primarySeries = graphSeries[0] ?? null;
  const secondarySeries = graphSeries.slice(1);
  const detailTitle = formatDeviceWorkoutTypeLabel(workout);
  const detailSubtitle = `${formatDate(workout.entryDate)} · ${formatDeviceWorkoutTimeLabel(workout)}`;

  return `
    <section class="watch-detail-screen">
      <div class="watch-detail-title-row">
        <button aria-label="Назад" class="watch-detail-back-button" data-watch-workout-detail-back type="button">‹</button>
        <h3>${escapeHtml(detailTitle)}</h3>
      </div>
      <p class="watch-detail-date">${escapeHtml(detailSubtitle)}</p>
      ${renderWatchWorkoutParameterPanel(workout, context, graphSeries)}
      <section class="watch-detail-card">
        ${primarySeries
          ? renderDeviceWorkoutSeriesDetailGraph(primarySeries, workout)
          : renderDeviceWorkoutGraph(workout, context, graphSeries)}
        ${secondarySeries.length > 0 ? `
          <div class="device-workout-secondary-series">
            ${secondarySeries.map((item) => `<span>${escapeHtml(item.label)}</span>`).join("")}
          </div>
        ` : ""}
      </section>
    </section>
  `;
}

function renderCoachDeviceWorkoutDetailScreen(
  state: MobileAppState,
  athleteId: string | null,
  workoutId: string,
) {
  const workout = getDeviceWorkoutById(state, athleteId, workoutId);
  if (!workout) {
    return `
      <section class="watch-detail-screen">
        <div class="watch-detail-title-row">
          <button aria-label="Назад" class="watch-detail-back-button" data-coach-device-workout-detail-back type="button">‹</button>
          <h3>Тренировка</h3>
        </div>
        ${renderEmpty("Тренировка не найдена", "Обновите данные спортсмена и откройте тренировку ещё раз.")}
      </section>
    `;
  }

  const workoutAthleteId = workout.athleteId;
  const context = getWatchWorkoutDetailContext(state, workoutAthleteId, workout);
  const graphSeries = buildDeviceWorkoutGraphSeries(workout, context);
  const primarySeries = graphSeries.find((series) => series.key === "heartRate") ?? graphSeries[0] ?? null;
  const secondarySeries = graphSeries.filter((series) => series !== primarySeries);
  const title = formatDeviceWorkoutTypeLabel(workout);
  const subtitle = `${formatDate(workout.entryDate)} · ${formatDeviceWorkoutTimeLabel(workout)}`;
  const isLoadingSamples = workout.sampleCount > workout.samples.length;

  return `
    <section class="watch-detail-screen coach-workout-detail-screen">
      <div class="watch-detail-title-row">
        <button aria-label="Назад" class="watch-detail-back-button" data-coach-device-workout-detail-back type="button">‹</button>
        <h3>${escapeHtml(title)}</h3>
      </div>
      <p class="watch-detail-date">${escapeHtml(subtitle)}</p>
      ${renderWatchWorkoutParameterPanel(workout, context, graphSeries)}
      <section class="watch-detail-card">
        ${isLoadingSamples ? `
          <section class="watch-workout-data-note">
            <strong>Загружаю точки тренировки</strong>
            <span>Краткие данные уже показаны. График пульса появится после загрузки ${workout.sampleCount.toLocaleString("ru-RU")} точек с сервера.</span>
          </section>
        ` : ""}
        ${primarySeries
          ? renderDeviceWorkoutSeriesDetailGraph(primarySeries, workout)
          : renderDeviceWorkoutGraph(workout, context, graphSeries)}
        ${secondarySeries.length > 0 ? `
          <div class="device-workout-secondary-series">
            ${secondarySeries.map((item) => `<span>${escapeHtml(item.label)}</span>`).join("")}
          </div>
        ` : ""}
      </section>
    </section>
  `;
}

function getWatchWorkoutDetailContext(
  state: MobileAppState,
  athleteId: string,
  workout: DeviceWorkout,
): WatchWorkoutContext {
  let hasWorkoutHeartRate = hasWorkoutSummaryHeartRate(workout);
  let hasWorkoutOxygen = false;
  let hasWorkoutPaceOrSpeed = false;

  for (const sample of workout.samples) {
    if (sample.heartRateBpm !== null) {
      hasWorkoutHeartRate = true;
    }
    if (sample.oxygenSaturationPercent !== null) {
      hasWorkoutOxygen = true;
    }
    if (getDeviceWorkoutPaceSeconds(sample) !== null || sample.speedMetersPerSecond !== null) {
      hasWorkoutPaceOrSpeed = true;
    }

    if (hasWorkoutHeartRate && hasWorkoutOxygen && hasWorkoutPaceOrSpeed) {
      break;
    }
  }

  const canUseWorkoutOnly = hasWorkoutHeartRate || hasWorkoutOxygen || hasWorkoutPaceOrSpeed;

  return {
    heartRateSamples: hasWorkoutHeartRate ? [] : getDeviceHealthSamplesForDate(state, athleteId, workout.entryDate, "heart_rate"),
    oxygenSamples: hasWorkoutOxygen ? [] : getDeviceHealthSamplesForDate(state, athleteId, workout.entryDate, "oxygen_saturation"),
    stressSamples: canUseWorkoutOnly ? [] : getDeviceHealthSamplesForDate(state, athleteId, workout.entryDate, "stress"),
    summary: getDeviceHealthSummaryForDate(state, athleteId, workout.entryDate),
  };
}

function renderWatchMetricDetailBody(
  metric: WatchDetailMetric,
  period: WatchDetailPeriod,
  summary: DeviceHealthDailySummary | null,
  summaries: DeviceHealthDailySummary[],
  periodDates: string[],
  detailSamples: DeviceHealthSample[],
) {
  const stats = buildWatchMetricStats(metric, period, summary, summaries, periodDates.length);
  const trend = buildWatchMetricTrend(metric, periodDates, summaries);
  const subtitle = formatWatchMetricDetailSubtitle(metric, period, summary, summaries, periodDates.length, detailSamples);

  return `
    <section class="watch-detail-card is-${escapeHtml(metric)}">
      <div class="watch-detail-stat-grid">
        ${stats.map((stat) => `
          <article>
            <span>${escapeHtml(stat.label)}</span>
            <strong>${escapeHtml(stat.value)}</strong>
            ${stat.detail ? `<small>${escapeHtml(stat.detail)}</small>` : ""}
          </article>
        `).join("")}
      </div>
      <p class="watch-detail-subtitle">${escapeHtml(subtitle)}</p>
      ${metric === "pulse" && period === "day"
        ? renderWatchDetailPulseChart(summary, detailSamples)
        : metric === "sleep" && period === "day"
          ? renderWatchDetailSleepChart(summary)
          : (metric === "oxygen" || metric === "stress") && period === "day"
            ? renderWatchDetailSampleChart(metric, summary, detailSamples)
            : renderWatchDetailTrendChart(metric, trend, period)}
    </section>
  `;
}

function buildWatchMetricStats(
  metric: WatchDetailMetric,
  period: WatchDetailPeriod,
  summary: DeviceHealthDailySummary | null,
  summaries: DeviceHealthDailySummary[],
  totalDays: number,
): WatchMetricStat[] {
  if (metric === "sleep" && period === "day") {
    return [
      { detail: formatWatchSleepWindow(summary), label: "Всего", value: formatWatchSleepGridValue(summary) },
      { label: "Глубокий", value: summary?.sleep?.deepMinutes ? formatDurationHours(summary.sleep.deepMinutes) : "-" },
      { label: "REM", value: summary?.sleep?.remMinutes ? formatDurationHours(summary.sleep.remMinutes) : "-" },
    ];
  }

  if (metric === "pulse" && period === "day") {
    const heartRate = summary?.heartRate;
    const values = [
      heartRate?.minBpm ?? null,
      heartRate?.averageBpm ?? getDeviceRestingHeartRateValue(summary),
      heartRate?.maxBpm ?? null,
    ];

    return [
      { label: "Мин", value: formatWatchMetricNumberValue(metric, values[0]) },
      { label: "Сред", value: formatWatchMetricNumberValue(metric, values[1]) },
      { label: "Макс", value: formatWatchMetricNumberValue(metric, values[2]) },
    ];
  }

  if (metric === "oxygen" && period === "day") {
    const oxygen = summary?.oxygenSaturation;
    return [
      { label: "Мин", value: formatWatchMetricNumberValue(metric, oxygen?.minPercent ?? null) },
      { label: "Сред", value: formatWatchMetricNumberValue(metric, oxygen?.averagePercent ?? oxygen?.latestPercent ?? null) },
      { label: "Макс", value: formatWatchMetricNumberValue(metric, oxygen?.maxPercent ?? null) },
    ];
  }

  const values = summaries
    .map((item) => getWatchMetricNumericValue(item, metric))
    .filter((value): value is number => value !== null);

  if (!values.length) {
    return [
      { label: period === "day" ? "Сегодня" : "Сред", value: "-" },
      { label: "Макс", value: "-" },
      {
        detail: period === "day" ? undefined : "с данными",
        label: "Дней",
        value: period === "day" ? "0" : `0/${totalDays}`,
      },
    ];
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const max = Math.max(...values);
  const min = Math.min(...values);

  if (period === "day") {
    return [
      { label: "Значение", value: formatWatchMetricNumberValue(metric, values[values.length - 1]) },
      { label: "Мин", value: formatWatchMetricNumberValue(metric, min) },
      { label: "Макс", value: formatWatchMetricNumberValue(metric, max) },
    ];
  }

  return [
    { label: "Сред", value: formatWatchMetricNumberValue(metric, average) },
    { label: "Макс", value: formatWatchMetricNumberValue(metric, max) },
    { detail: "с данными", label: "Дней", value: `${values.length}/${totalDays}` },
  ];
}

function buildWatchMetricTrend(
  metric: WatchDetailMetric,
  periodDates: string[],
  summaries: DeviceHealthDailySummary[],
): WatchMetricTrendPoint[] {
  const summaryByDate = new Map(summaries.map((summary) => [summary.entryDate, summary]));
  return periodDates.map((date) => {
    const summary = summaryByDate.get(date) ?? null;
    const value = getWatchMetricNumericValue(summary, metric);
    return {
      date,
      displayValue: value === null ? "нет" : formatWatchMetricNumberValue(metric, value),
      label: formatShortDate(date),
      value,
    };
  });
}

function renderMobileUPlotChart(payload: MobileUPlotPayload, className: string, height: number) {
  const chartId = registerMobileUPlotPayload(payload);

  return `
    <div
      class="mobile-uplot-chart ${escapeHtml(className)}"
      data-uplot-chart-id="${escapeHtml(chartId)}"
      data-uplot-height="${height}"
    >
      <div class="mobile-uplot-plot" role="img" aria-label="${escapeHtml(payload.title)}"></div>
    </div>
  `;
}

function renderMobileBarsChart(payload: MobileUPlotPayload, className: string, height: number) {
  if (payload.x.length < 2 || payload.y.length < 2 || payload.x.length !== payload.y.length) {
    return `<p class="watch-empty-note">Недостаточно точек для графика.</p>`;
  }

  const yRange = Math.max(1, payload.upper - payload.lower);
  const visibleSamples = limitDeviceWorkoutSamples(
    payload.x.map((xValue, index) => ({ sampleTime: xValue, value: payload.y[index] })),
    54,
  );
  const bars = visibleSamples.map((sample) => {
    const valueRatio = Math.max(0.04, Math.min(1, (sample.value - payload.lower) / yRange));
    return `<i style="height: ${(valueRatio * 100).toFixed(1)}%"></i>`;
  }).join("");
  const averageBottom = payload.average !== null && payload.average !== undefined
    ? Math.max(0, Math.min(100, ((payload.average - payload.lower) / yRange) * 100))
    : null;
  const averageLine = averageBottom !== null
    ? `<span class="mobile-bars-average" style="bottom: ${averageBottom.toFixed(1)}%"></span>`
    : "";

  return `
    <div
      class="mobile-uplot-chart mobile-bars-chart ${escapeHtml(className)}"
      style="--mobile-bars-height: ${height}px"
    >
      <div class="mobile-bars-plot" role="img" aria-label="${escapeHtml(payload.title)}">
        ${averageLine}
        ${bars}
      </div>
    </div>
  `;
}

function registerMobileUPlotPayload(payload: MobileUPlotPayload) {
  mobileUPlotPayloadSequence += 1;
  const chartId = `chart-${mobileUPlotPayloadSequence}`;
  mobileUPlotPayloads.set(chartId, payload);
  return chartId;
}

function resetMobileUPlotPayloads() {
  mobileUPlotPayloadSequence = 0;
  mobileUPlotPayloads.clear();
}

function buildWatchHeartRateUPlotPayload(
  summary: DeviceHealthDailySummary | null,
  samples: DeviceHealthSample[],
): MobileUPlotPayload | null {
  const entryDate = summary?.entryDate ?? samples[0]?.entryDate;
  if (!entryDate) {
    return null;
  }

  const dayBounds = getLocalDayBounds(entryDate);
  if (!dayBounds) {
    return null;
  }

  const points = buildWatchTimedPoints(samples, dayBounds, 25, 240);
  if (points.length < 2) {
    return null;
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const scale = buildAdaptiveHeartRateScale(min, max);
  const visiblePoints = limitDeviceWorkoutSamples(points, 900);

  return {
    average,
    color: "#0f766e",
    format: "integer",
    label: "Пульс",
    lower: scale.lower,
    title: "График пульса",
    unit: "уд/мин",
    upper: scale.upper,
    x: visiblePoints.map((point) => Math.round(point.sampledAt.getTime() / 1000)),
    y: visiblePoints.map((point) => point.value),
  };
}

function buildWatchSampleUPlotPayload(
  metric: WatchDetailMetric,
  entryDate: string | null,
  samples: DeviceHealthSample[],
): MobileUPlotPayload | null {
  if (!entryDate) {
    return null;
  }

  const dayBounds = getLocalDayBounds(entryDate);
  if (!dayBounds) {
    return null;
  }

  const validRange = getWatchSampleValidRange(metric);
  const points = buildWatchTimedPoints(samples, dayBounds, validRange.lower, validRange.upper);
  if (points.length < 2) {
    return null;
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const scale = buildWatchSampleScale(metric, min, max);
  const visiblePoints = limitDeviceWorkoutSamples(points, 900);
  const isOxygen = metric === "oxygen";

  return {
    average,
    color: isOxygen ? "#0891b2" : "#ad6a15",
    format: isOxygen ? "percent" : "integer",
    label: isOxygen ? "SpO₂" : "Стресс",
    lower: scale.lower,
    title: isOxygen ? "График SpO₂" : "График стресса",
    unit: isOxygen ? "%" : "",
    upper: scale.upper,
    x: visiblePoints.map((point) => Math.round(point.sampledAt.getTime() / 1000)),
    y: visiblePoints.map((point) => point.value),
  };
}

function getWatchSampleValidRange(metric: WatchDetailMetric) {
  if (metric === "oxygen") {
    return { lower: 70, upper: 100 };
  }

  if (metric === "stress") {
    return { lower: 1, upper: 100 };
  }

  return { lower: Number.NEGATIVE_INFINITY, upper: Number.POSITIVE_INFINITY };
}

function buildWatchTimedPoints(
  samples: DeviceHealthSample[],
  dayBounds: { end: Date; start: Date },
  lowerLimit: number,
  upperLimit: number,
) {
  return samples
    .map((sample) => {
      const sampledAt = new Date(sample.sampledAt);
      const value = sample.value;
      if (
        Number.isNaN(sampledAt.getTime()) ||
        sampledAt.getTime() < dayBounds.start.getTime() ||
        sampledAt.getTime() > dayBounds.end.getTime() ||
        !Number.isFinite(value) ||
        value < lowerLimit ||
        value > upperLimit
      ) {
        return null;
      }

      return { sampledAt, value };
    })
    .filter((sample): sample is { sampledAt: Date; value: number } => Boolean(sample))
    .sort((left, right) => left.sampledAt.getTime() - right.sampledAt.getTime());
}

function renderWatchDetailPulseChart(
  summary: DeviceHealthDailySummary | null,
  samples: DeviceHealthSample[],
) {
  const payload = buildWatchHeartRateUPlotPayload(summary, samples);
  if (!payload) {
    return `<p class="watch-empty-note">После синхронизации здесь появится подробный график пульса за день.</p>`;
  }

  return `
    ${renderMobileUPlotChart(payload, "is-pulse", 274)}
  `;
}

function renderWatchDetailSleepChart(summary: DeviceHealthDailySummary | null) {
  const sleep = summary?.sleep;
  const stages = [
    { className: "deep", label: "Глубокий", minutes: sleep?.deepMinutes ?? 0 },
    { className: "rem", label: "REM", minutes: sleep?.remMinutes ?? 0 },
    { className: "light", label: "Лёгкий", minutes: sleep?.lightMinutes ?? 0 },
  ].filter((stage) => stage.minutes > 0);

  if (!stages.length) {
    return `<p class="watch-empty-note">Детализация сна появится после синхронизации.</p>`;
  }

  return `
    <div class="watch-detail-sleep-chart">
      <div class="watch-stage-bar">
        ${stages.map((stage) => `
          <span class="is-${escapeHtml(stage.className)}" style="flex-grow: ${stage.minutes}"></span>
        `).join("")}
      </div>
      <div class="watch-detail-sleep-grid">
        ${stages.map((stage) => `
          <article>
            <span>${escapeHtml(stage.label)}</span>
            <strong>${escapeHtml(formatDurationHours(stage.minutes))}</strong>
          </article>
        `).join("")}
      </div>
    </div>
  `;
}

function renderWatchDetailSampleChart(
  metric: WatchDetailMetric,
  summary: DeviceHealthDailySummary | null,
  samples: DeviceHealthSample[],
) {
  const payload = buildWatchSampleUPlotPayload(metric, summary?.entryDate ?? samples[0]?.entryDate ?? null, samples);
  if (!payload) {
    const label = metric === "oxygen" ? "SpO₂" : "стресс";
    return `<p class="watch-empty-note">После синхронизации здесь появится график ${label} за день.</p>`;
  }

  return `
    ${renderMobileUPlotChart(payload, `is-${metric}`, 274)}
  `;
}

function renderWatchDetailTrendChart(
  metric: WatchDetailMetric,
  trend: WatchMetricTrendPoint[],
  period: WatchDetailPeriod,
) {
  const values = trend
    .map((point) => point.value)
    .filter((value): value is number => value !== null);

  const max = values.length ? Math.max(...values, 1) : 1;
  const min = values.length ? Math.min(...values) : 0;
  const baseline = values.length ? Math.min(0, min) : 0;
  const range = Math.max(1, max - baseline);

  return `
    ${values.length ? "" : `<p class="watch-empty-note">Данных за выбранный период пока нет.</p>`}
    <div class="watch-detail-trend-chart is-${escapeHtml(metric)} is-${escapeHtml(period)}">
      ${trend.map((point) => {
        const height = point.value === null
          ? 8
          : Math.max(12, Math.round(((point.value - baseline) / range) * 124));
        return `
          <article class="${point.value === null ? "is-empty" : ""}">
            <i style="height: ${height}px"></i>
            <strong>${escapeHtml(point.displayValue)}</strong>
            <span>${escapeHtml(point.label)}</span>
          </article>
        `;
      }).join("")}
    </div>
    <div class="watch-detail-trend-legend" aria-hidden="true">
      <span><i></i>есть данные</span>
      <span><i class="is-empty"></i>нет данных</span>
    </div>
  `;
}

function formatWatchMetricDetailSubtitle(
  metric: WatchDetailMetric,
  period: WatchDetailPeriod,
  summary: DeviceHealthDailySummary | null,
  summaries: DeviceHealthDailySummary[],
  totalDays: number,
  heartRateSamples: DeviceHealthSample[],
) {
  if (metric === "pulse" && period === "day") {
    return heartRateSamples.length
      ? `${heartRateSamples.length} точек за день · ${formatReadinessDeviceHealthSyncLabel(summary)}`
      : formatDeviceHealthHeartRateDetail(summary);
  }

  if (metric === "sleep" && period === "day") {
    return formatDeviceHealthSleepDetail(summary);
  }

  const dataDays = summaries.filter((item) => getWatchMetricNumericValue(item, metric) !== null).length;
  return period === "day"
    ? formatWatchMetricDayDetail(metric, summary)
    : `Данные: ${dataDays}/${totalDays} ${formatCalendarDayCountLabel(totalDays)}. Пустые дни показаны серым.`;
}

function formatWatchMetricDayDetail(metric: WatchDetailMetric, summary: DeviceHealthDailySummary | null) {
  if (metric === "oxygen") {
    return formatDeviceHealthOxygenDetail(summary);
  }

  if (metric === "steps") {
    return formatWatchStepsDetail(summary);
  }

  if (metric === "stress") {
    return getWatchMetricNumericValue(summary, metric) === null ? "часы не передали стресс" : "среднее значение за день";
  }

  if (metric === "load") {
    return getWatchMetricNumericValue(summary, metric) === null ? "часы не передали нагрузку" : "дневная нагрузка";
  }

  return "";
}

function getWatchMetricNumericValue(summary: DeviceHealthDailySummary | null, metric: WatchDetailMetric) {
  if (!summary) {
    return null;
  }

  const rawPayload = summary.rawPayload ?? {};
  if (metric === "pulse") {
    return summary.heartRate?.averageBpm ??
      getDeviceRestingHeartRateValue(summary) ??
      summary.heartRate?.minBpm ??
      null;
  }

  if (metric === "sleep") {
    return summary.sleep?.durationMinutes !== null && summary.sleep?.durationMinutes !== undefined
      ? summary.sleep.durationMinutes / 60
      : null;
  }

  if (metric === "oxygen") {
    return summary.oxygenSaturation?.averagePercent ??
      summary.oxygenSaturation?.latestPercent ??
      null;
  }

  if (metric === "steps") {
    return getWatchStepCount(summary);
  }

  if (metric === "stress") {
    return readDeviceHealthRawNumber(rawPayload, "stressAvg");
  }

  return readDeviceHealthRawNumber(rawPayload, "trainingLoadDay") ??
    readDeviceHealthRawNumber(rawPayload, "vitality");
}

function formatWatchMetricNumberValue(metric: WatchDetailMetric, value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  if (metric === "sleep") {
    return formatDurationHours(Math.round(value * 60));
  }

  if (metric === "oxygen") {
    return `${formatLoadValue(value)}%`;
  }

  if (metric === "steps") {
    return Math.round(value).toLocaleString("ru-RU");
  }

  return formatLoadValue(value);
}

function getWatchDetailPeriodDates(date: string, period: WatchDetailPeriod) {
  const days = period === "month" ? 30 : period === "week" ? 7 : 1;
  return Array.from({ length: days }, (_, index) => addDays(date, index - days + 1));
}

function getDeviceHealthSummariesForDates(
  state: MobileAppState,
  athleteId: string | null,
  dates: string[],
) {
  const dateSet = new Set(dates);
  return state.data.deviceHealthSummaries
    .filter((summary) =>
      dateSet.has(summary.entryDate) &&
      (!athleteId || summary.athleteId === athleteId)
    )
    .map(normalizeDeviceHealthDailySummaryForStorage)
    .sort((left, right) => left.entryDate.localeCompare(right.entryDate));
}

function formatWatchDetailPeriodTab(period: WatchDetailPeriod) {
  if (period === "week") {
    return "Неделя";
  }

  if (period === "month") {
    return "Месяц";
  }

  return "День";
}

function formatWatchDetailPeriodLabel(date: string, period: WatchDetailPeriod) {
  if (period === "day") {
    return formatDate(date);
  }

  const dates = getWatchDetailPeriodDates(date, period);
  return `${formatShortDate(dates[0])} - ${formatShortDate(dates[dates.length - 1])}`;
}

function getLatestIsoTimestamp(values: Array<string | null | undefined>) {
  let latestValue: string | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;

  for (const value of values) {
    if (!value) {
      continue;
    }

    const time = new Date(value).getTime();
    if (!Number.isNaN(time) && time > latestTime) {
      latestTime = time;
      latestValue = value;
    }
  }

  return latestValue;
}

function getLatestDirectWatchConfigSyncAt(config: DirectWatchLocalConfig) {
  return getLatestIsoTimestamp([
    config.lastServiceSyncedAt,
    config.lastActivitySyncAt,
  ]);
}

function getLatestDirectWatchSyncAt(
  config: DirectWatchLocalConfig,
  serviceStatus: MobileAppState["directWatchDiagnostic"]["serviceStatus"],
  coordinatorStatus: MobileAppState["directWatchDiagnostic"]["syncCoordinatorStatus"],
) {
  return getLatestIsoTimestamp([
    serviceStatus?.backgroundSync?.serviceUpdatedAt,
    serviceStatus?.backgroundSync?.updatedAt,
    coordinatorStatus?.lastSuccessfulAt,
    coordinatorStatus?.lastCompletedAt,
    config.lastServiceSyncedAt,
    config.lastActivitySyncAt,
    serviceStatus?.updatedAt,
    config.lastServiceUpdatedAt,
  ]);
}

function getWatchDisplaySyncedAt(
  summary: DeviceHealthDailySummary | null,
  config?: DirectWatchLocalConfig | null,
) {
  if (!summary) {
    return null;
  }

  return getLatestIsoTimestamp([
    summary.syncedAt,
    summary.provider === "direct-watch" ? config?.lastServiceSyncedAt : null,
    summary.provider === "direct-watch" ? config?.lastActivitySyncAt : null,
  ]) ?? summary.syncedAt;
}

function renderWatchSettingsEntryCard(
  state: MobileAppState,
  summary: DeviceHealthDailySummary | null,
) {
  if (!isDirectWatchRuntime()) {
    return `
      <button class="watch-settings-entry-card" data-watch-settings-open type="button">
        <div>
          <strong>Настройка часов</strong>
          <span>${escapeHtml(formatWatchSourceHint(summary))}</span>
        </div>
        <span aria-hidden="true">›</span>
      </button>
    `;
  }

  const config = loadDirectWatchConfig();
  const statusKind = getDirectWatchServiceStatusKind(config, state.directWatchDiagnostic.serviceStatus);
  const statusLabel = formatDirectWatchServiceStatusLabel(config, state.directWatchDiagnostic.serviceStatus);
  const lastSyncAt = getLatestDirectWatchConfigSyncAt(config);
  const lastSyncLabel = lastSyncAt ? formatDateTime(lastSyncAt) : "ещё не было";
  const deviceLabel = config.deviceName || (config.deviceId ? "часы выбраны" : "часы не выбраны");
  const historyProgress = getDirectWatchHistorySyncProgress(config);
  const historyLabel = config.lastHistorySyncStatus === "running"
    ? ` · история ${historyProgress.label}`
    : config.lastHistorySyncedAt
      ? ` · история ${historyProgress.label}`
      : "";

  return `
    <button class="watch-settings-entry-card watch-clean-settings-entry is-${escapeHtml(statusKind)}" data-watch-settings-open type="button">
      <div>
        <strong>Настройка часов</strong>
        <span>${escapeHtml(`${deviceLabel} · ${statusLabel} · ${lastSyncLabel}${historyLabel}`)}</span>
      </div>
      <span aria-hidden="true">›</span>
    </button>
  `;
}

function renderWatchSettingsScreen(
  state: MobileAppState,
  summary: DeviceHealthDailySummary | null,
  date: string,
) {
  return `
    <section class="watch-detail-screen">
      <div class="watch-detail-title-row">
        <button aria-label="Назад" class="watch-detail-back-button" data-watch-settings-back type="button">‹</button>
        <h3>Настройка часов</h3>
      </div>
      <p class="watch-detail-date">Синхронизация, погода и подключение</p>
      ${isDirectWatchRuntime()
        ? renderWatchSyncPanel(state, date)
        : renderWatchSettingsPanel(state, summary, date)}
    </section>
  `;
}

function hasDirectWatchSavedWeatherLocation(config: DirectWatchLocalConfig) {
  return config.weatherLatitude !== null &&
    config.weatherLongitude !== null &&
    !(config.weatherLatitude === 0 && config.weatherLongitude === 0);
}

function formatDirectWatchWeatherSource(config: DirectWatchLocalConfig) {
  if (!hasDirectWatchSavedWeatherLocation(config)) {
    return "Геолокация телефона";
  }

  return getDirectWatchWeatherLocation(config).city;
}

function getDirectWatchWeatherFallbackCity(config: DirectWatchLocalConfig) {
  return config.weatherCity ?? "";
}

function formatDirectWatchUserError(message?: string | null) {
  if (!message) {
    return null;
  }

  const lowerMessage = message.toLowerCase();
  if (
    lowerMessage.includes("spp-канал занят") ||
    lowerMessage.includes("mi fitness") ||
    lowerMessage.includes("xiaomi mi connect") ||
    lowerMessage.includes("broken pipe")
  ) {
    return "Bluetooth занят другим приложением или системной службой Xiaomi. Закройте Mi Fitness/Gadgetbridge и повторите синхронизацию.";
  }

  if (lowerMessage.includes("auth")) {
    return "Часы не прошли авторизацию. Проверьте Auth Key и подключение часов.";
  }

  if (lowerMessage.includes("crc")) {
    return "Часы отдали повреждённый пакет данных. Повторите синхронизацию рядом с телефоном.";
  }

  return message;
}

function getDirectWatchUserDiagnostics(
  config: DirectWatchLocalConfig,
  serviceStatus: MobileAppState["directWatchDiagnostic"]["serviceStatus"],
  coordinatorStatus: MobileAppState["directWatchDiagnostic"]["syncCoordinatorStatus"],
) {
  const backgroundSync = serviceStatus?.backgroundSync;
  const isRunning = isDirectWatchServiceRunning(config, serviceStatus);
  const hasDevice = Boolean(config.deviceId);
  const hasAuthKey = Boolean(config.authKeyHex);
  const canSync = hasDevice && hasAuthKey;
  const lastSyncAt = getLatestDirectWatchSyncAt(config, serviceStatus, coordinatorStatus);
  const lastWeatherAt = getLatestIsoTimestamp([
    backgroundSync?.weatherUpdatedAt,
    backgroundSync?.serviceUpdatedAt,
    config.lastServiceSyncedAt,
    coordinatorStatus?.lastSuccessfulAt,
    serviceStatus?.updatedAt,
  ]);
  const lastActivityAt = getLatestIsoTimestamp([
    backgroundSync?.dataUpdatedAt,
    backgroundSync?.updatedAt,
    config.lastActivitySyncAt,
  ]);
  const activityChecked = Boolean(lastActivityAt) && config.lastActivitySyncStatus !== "error";
  const activityHasFiles = (config.lastActivitySyncFileCount ?? 0) > 0;
  const retryAfterMs = coordinatorStatus?.retryAfterMs ?? null;
  const hasPending = Boolean(coordinatorStatus?.pendingRequestId);
  const userError = formatDirectWatchUserError(
    config.lastServiceError || (config.lastActivitySyncStatus === "error" ? config.lastActivitySyncDiagnostic : null),
  );
  const connectionLabel = !hasDevice
    ? "часы не выбраны"
    : !hasAuthKey
      ? "нужен Auth Key"
      : userError
        ? "Bluetooth занят"
        : isRunning
          ? "подключено"
          : "не подключено";
  const weatherLabel = lastWeatherAt
    ? "отправлена на часы"
    : canSync
      ? "ждёт первой синхронизации"
      : "не настроена";
  const autoLabel = hasPending
    ? "синхронизация в очереди"
    : retryAfterMs && retryAfterMs > 0
      ? `через ${formatDeviceWorkoutDuration(retryAfterMs / 60000)}`
      : coordinatorStatus?.nextAllowedAt
        ? formatDateTime(coordinatorStatus.nextAllowedAt)
        : coordinatorStatus?.lastBlockedReason
          ? formatDirectWatchCoordinatorReason(coordinatorStatus.lastBlockedReason)
          : isRunning
            ? "автоматически каждые 10 минут и при подключении часов"
            : "после запуска синхронизации";
  const headline = userError
    ? userError
    : isRunning
      ? "Часы подключены. Погода и данные обновляются без открытия приложения."
      : canSync
        ? "Часы готовы к синхронизации."
        : "Для прямой синхронизации выберите часы и сохраните Auth Key.";
  const lastSyncLabel = lastSyncAt ? formatDateTime(lastSyncAt) : "ещё не было";
  const lastWeatherLabel = lastWeatherAt ? formatDateTime(lastWeatherAt) : "ещё не отправлялась";
  const dataDayLabel = backgroundSync?.available || config.lastActivitySyncStatus === "ok" || activityHasFiles
    ? "Шаги, активность, сон и файлы часов получены"
    : activityChecked
      ? "Дневные данные проверены, новых файлов нет"
      : config.lastActivitySyncStatus === "error"
        ? "Ошибка чтения дневных данных"
        : "Ожидает первой синхронизации";
  const bluetoothTone = userError ? "error" : canSync ? "ok" : "warning";
  const bluetoothValue = userError
    ? userError
    : canSync
      ? "Канал готов, часы отвечают при синхронизации"
      : "Нужно выбрать часы и сохранить Auth Key";
  const batteryValue = isRunning
    ? "Разрешена работа в фоне"
    : userError
      ? "Проверьте Bluetooth и ограничения Android"
      : canSync
        ? "Служба готова к запуску"
        : "Настройка ещё не завершена";

  return {
    autoLabel,
    connectionLabel,
    headline,
    lastWeatherLabel,
    lastSyncLabel,
    updates: [
      {
        label: "Погода",
        meta: lastWeatherAt ? formatDateTime(lastWeatherAt) : null,
        tone: lastWeatherAt ? "ok" : canSync ? "warning" : "muted",
        value: lastWeatherAt
          ? "Температура, ветер, влажность и прогноз отправлены"
          : weatherLabel,
      },
      {
        label: "Показатели дня",
        meta: lastActivityAt ? formatDateTime(lastActivityAt) : null,
        tone: config.lastActivitySyncStatus === "error" ? "error" : lastActivityAt ? "ok" : "muted",
        value: dataDayLabel,
      },
      {
        label: "Подключение",
        meta: connectionLabel,
        tone: bluetoothTone,
        value: bluetoothValue,
      },
      {
        label: "Работа в фоне",
        meta: isRunning ? "активно" : null,
        tone: isRunning ? "ok" : canSync ? "warning" : "muted",
        value: batteryValue,
      },
    ],
    userError,
  };
}

function renderWatchSyncPanel(state: MobileAppState, date: string) {
  if (!isDirectWatchRuntime()) {
    return "";
  }

  const config = loadDirectWatchConfig();
  const weatherSourceLabel = formatDirectWatchWeatherSource(config);
  const weatherFallbackCity = getDirectWatchWeatherFallbackCity(config);
  const serviceStatus = state.directWatchDiagnostic.serviceStatus;
  const hasDevice = Boolean(config.deviceId);
  const hasAuthKey = Boolean(config.authKeyHex);
  const canServiceSync = hasDevice && hasAuthKey;
  const isRunning = isDirectWatchServiceRunning(config, serviceStatus);
  const statusKind = getDirectWatchServiceStatusKind(config, serviceStatus);
  const statusLabel = formatDirectWatchServiceStatusLabel(config, serviceStatus);
  const bridgeLabel = formatDirectWatchServiceRuntime(config, serviceStatus);
  const deviceLabel = config.deviceName || (config.deviceId ? formatDirectWatchDeviceId(config.deviceId) : "часы не выбраны");
  const historyProgress = getDirectWatchHistorySyncProgress(config);
  const userDiagnostics = getDirectWatchUserDiagnostics(
    config,
    serviceStatus,
    state.directWatchDiagnostic.syncCoordinatorStatus,
  );

  return `
    <section class="watch-sync-panel is-${escapeHtml(statusKind)}">
      <article class="watch-background-status">
        <div class="watch-background-head">
          <div>
            <span>Статус часов</span>
            <h3>${escapeHtml(deviceLabel)}</h3>
            <p>${escapeHtml(userDiagnostics.headline)}</p>
          </div>
          <strong class="watch-sync-status">${escapeHtml(statusLabel)}</strong>
        </div>
        <div class="watch-status-metrics">
          <article>
            <span>Последняя синхронизация</span>
            <strong>${escapeHtml(userDiagnostics.lastSyncLabel)}</strong>
          </article>
          <article>
            <span>Погода отправлена</span>
            <strong>${escapeHtml(userDiagnostics.lastWeatherLabel)}</strong>
          </article>
        </div>
      </article>
      ${userDiagnostics.userError ? `<p class="watch-sync-error">${escapeHtml(userDiagnostics.userError)}</p>` : ""}
      <article class="watch-background-card">
        <div class="watch-background-card-head">
          <div>
            <span>Что обновилось</span>
            <strong>Последняя синхронизация</strong>
          </div>
          <em>${escapeHtml(userDiagnostics.connectionLabel)}</em>
        </div>
        <div class="watch-background-updates">
          ${userDiagnostics.updates.map((update) => `
            <article class="watch-background-row is-${escapeHtml(update.tone)}">
              <span aria-hidden="true"></span>
              <div>
                <strong>${escapeHtml(update.label)}</strong>
                <p>${escapeHtml(update.value)}</p>
              </div>
              ${update.meta ? `<em>${escapeHtml(update.meta)}</em>` : ""}
            </article>
          `).join("")}
        </div>
        <p class="watch-background-next">Следующее автообновление: ${escapeHtml(userDiagnostics.autoLabel)}</p>
      </article>
      <div class="watch-sync-main-actions">
        <button
          class="primary-action"
          data-direct-watch-full-sync="${escapeHtml(config.deviceId || "")}"
          data-direct-watch-full-sync-date="${escapeHtml(date)}"
          type="button"
          ${state.isBusy || !canServiceSync ? "disabled" : ""}
        >
          Синхронизировать сейчас
        </button>
        <details class="watch-technical-status watch-technical-drawer">
          <summary aria-label="Дополнительные настройки часов">Настройки</summary>
          <div class="watch-technical-body">
            <div class="watch-sync-actions">
              <button
                class="secondary-action"
                data-direct-watch-sync="${escapeHtml(config.deviceId || "")}"
                data-direct-watch-sync-date="${escapeHtml(date)}"
                type="button"
                ${state.isBusy || !canServiceSync ? "disabled" : ""}
              >
                Считать данные
              </button>
              <button
                class="secondary-action"
                data-direct-watch-service-sync="${escapeHtml(config.deviceId || "")}"
                type="button"
                ${state.isBusy || !canServiceSync ? "disabled" : ""}
              >
                Время и погода
              </button>
            </div>
            <section class="watch-history-sync-card is-${escapeHtml(historyProgress.statusKind)}">
              <div class="watch-history-sync-head">
                <div>
                  <span>История данных</span>
                  <h4>Первичная синхронизация</h4>
                  <p>${escapeHtml(historyProgress.detail)}</p>
                </div>
                <strong>${escapeHtml(historyProgress.label)}</strong>
              </div>
              <div class="watch-history-progress" aria-hidden="true">
                <i style="width: ${escapeHtml(historyProgress.percent)}%"></i>
              </div>
              <button
                class="secondary-action"
                data-direct-watch-history-sync="${escapeHtml(config.deviceId || "")}"
                type="button"
                ${state.isBusy || !canServiceSync ? "disabled" : ""}
              >
                ${escapeHtml(historyProgress.buttonLabel)}
              </button>
            </section>
            ${renderWatchActivitySyncDiagnostic(config)}
            ${renderWatchCoordinatorStatus(state.directWatchDiagnostic.syncCoordinatorStatus)}
            <div class="watch-sync-grid">
              <article>
                <span>Источник погоды</span>
                <strong>${escapeHtml(weatherSourceLabel)}</strong>
              </article>
              <article>
                <span>Служба</span>
                <strong>${escapeHtml(bridgeLabel)}</strong>
              </article>
              <article>
                <span>Погода на часы</span>
                <strong>влажность · ветер · UV/AQI · солнце</strong>
              </article>
            </div>
            <div class="watch-sync-setup-grid">
              <label class="wide-field">
                <span>Запасной город погоды</span>
                <input data-direct-watch-weather-city inputmode="text" placeholder="если геолокация недоступна" type="text" value="${escapeHtml(weatherFallbackCity)}">
              </label>
              <label class="wide-field">
                <span>Auth Key часов</span>
                <input data-direct-watch-auth-key inputmode="text" placeholder="${escapeHtml(hasAuthKey ? "ключ сохранён" : "32 hex-символа")}" type="password" autocomplete="off">
              </label>
            </div>
            <div class="watch-sync-setup-actions">
              <button class="secondary-action" data-direct-watch-weather-save type="button" ${state.isBusy ? "disabled" : ""}>
                Сохранить запасной город
              </button>
              <button class="secondary-action" data-direct-watch-auth-key-save type="button" ${state.isBusy ? "disabled" : ""}>
                Сохранить ключ
              </button>
              <button class="secondary-action" data-direct-watch-scan type="button" ${state.isBusy ? "disabled" : ""}>
                Найти часы
              </button>
              <button class="secondary-action" data-direct-watch-service-status type="button" ${state.isBusy ? "disabled" : ""}>
                Обновить статус
              </button>
              <button
                class="secondary-action"
                data-direct-watch-service-stop
                type="button"
                ${state.isBusy || !isRunning ? "disabled" : ""}
              >
                Остановить службу
              </button>
            </div>
            ${renderWatchSyncDevicePicker(state, config)}
            <article class="watch-source-note">
              <strong>Прямое подключение</strong>
              <span>Здесь можно заменить часы, обновить город, проверить статус и остановить фоновую синхронизацию.</span>
            </article>
          </div>
        </details>
      </div>
    </section>
  `;
}

function renderWatchActivitySyncDiagnostic(config: DirectWatchLocalConfig) {
  if (!config.lastActivitySyncDiagnostic) {
    return "";
  }

  const status = config.lastActivitySyncStatus ?? "warning";
  const title = status === "ok"
    ? "Данные считаны"
    : status === "error"
      ? "Ошибка чтения данных"
      : "Нужна проверка тренировки";
  const meta = [
    config.lastActivitySyncAt ? formatDateTime(config.lastActivitySyncAt) : null,
    config.lastActivitySyncFileCount !== null ? `файлов ${config.lastActivitySyncFileCount}` : null,
    config.lastActivitySyncSportsFileCount !== null ? `SPORTS ${config.lastActivitySyncSportsFileCount}` : null,
    config.lastActivitySyncWorkoutCount !== null ? `тренировок ${config.lastActivitySyncWorkoutCount}` : null,
  ].filter((item): item is string => Boolean(item));

  return `
    <article class="watch-sync-diagnostic is-${escapeHtml(status)}">
      <div>
        <span>Последнее чтение данных</span>
        <strong>${escapeHtml(title)}</strong>
      </div>
      <p>${escapeHtml(config.lastActivitySyncDiagnostic)}</p>
      ${meta.length ? `<small>${escapeHtml(meta.join(" · "))}</small>` : ""}
    </article>
  `;
}

function renderWatchCoordinatorStatus(status: MobileAppState["directWatchDiagnostic"]["syncCoordinatorStatus"]) {
  if (!status || (!status.pendingRequestId && !status.nextAllowedReason && !status.lastBlockedReason)) {
    return "";
  }

  const title = status.pendingRequestId
    ? "Запрос в очереди"
    : status.nextAllowedReason
      ? "Следующее автообновление"
      : "Последний автозапуск";
  const details = [
    status.pendingReason ? formatDirectWatchCoordinatorReason(status.pendingReason) : null,
    status.nextAllowedReason ? formatDirectWatchCoordinatorReason(status.nextAllowedReason) : null,
    status.lastBlockedReason ? formatDirectWatchCoordinatorReason(status.lastBlockedReason) : null,
    status.retryAfterMs && status.retryAfterMs > 0 ? `через ${formatDeviceWorkoutDuration(status.retryAfterMs / 60000)}` : null,
    status.lastSuccessfulAt ? `успешно ${formatDateTime(status.lastSuccessfulAt)}` : null,
  ].filter((item): item is string => Boolean(item));

  return `
    <article class="watch-sync-diagnostic is-warning">
      <div>
        <span>Автосинхронизация</span>
        <strong>${escapeHtml(title)}</strong>
      </div>
      <p>${escapeHtml(details.join(" · ") || "координатор ждёт следующего события")}</p>
    </article>
  `;
}

function formatDirectWatchCoordinatorReason(reason: string) {
  const labels: Record<string, string> = {
    "app-visible": "возврат в приложение",
    "bluetooth-on": "Bluetooth включён",
    "bluetooth-reconnect": "Bluetooth reconnect",
    boot: "запуск телефона",
    disabled: "координатор выключен",
    "failure-backoff": "пауза после ошибки",
    interval: "интервал 10 мин",
    "missing-config": "нет настройки часов",
    "other-device": "другое устройство",
    "package-replaced": "обновление приложения",
    "quick-throttle": "слишком частый запуск",
    "service-start": "старт службы",
    "service-timer": "таймер службы",
    "sync-in-progress": "синхронизация уже идёт",
    "user-present": "разблокировка телефона",
  };

  return labels[reason] ?? reason;
}

function renderWatchSyncDevicePicker(state: MobileAppState, config: DirectWatchLocalConfig) {
  const devices = state.directWatchDiagnostic.devices
    .slice()
    .sort((left, right) =>
      Number(Boolean(right.isLikelyWatch)) - Number(Boolean(left.isLikelyWatch)) ||
      (right.rssi ?? -999) - (left.rssi ?? -999),
    )
    .slice(0, 5);

  if (!devices.length) {
    return `
      <p class="watch-sync-help">
        ${config.deviceId
          ? "Часы уже выбраны. Если нужно заменить устройство, нажмите “Найти часы”."
          : "Нажмите “Найти часы”, когда Redmi Watch рядом с телефоном и Bluetooth включён."}
      </p>
    `;
  }

  return `
    <div class="watch-sync-device-list">
      ${devices.map((device) => {
        const isSelected = config.deviceId === device.id;
        return `
          <article class="${isSelected ? "is-selected" : ""}">
            <div>
              <strong>${escapeHtml(device.name || "Bluetooth-устройство")}</strong>
              <span>${escapeHtml(formatDirectWatchBondState(device.bondState))} · ${escapeHtml(formatDirectWatchSignal(device.rssi))}</span>
            </div>
            <button
              class="secondary-action"
              data-direct-watch-select="${escapeHtml(device.id)}"
              type="button"
              ${state.isBusy || isSelected ? "disabled" : ""}
            >
              ${isSelected ? "Выбрано" : "Выбрать"}
            </button>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderWatchRecoveryCard(
  state: MobileAppState,
  summary: DeviceHealthDailySummary | null,
  date: string,
) {
  const status = getDeviceHealthStatus(summary);
  const directWatchConfig = isDirectWatchRuntime() ? loadDirectWatchConfig() : null;
  const displaySyncedAt = getWatchDisplaySyncedAt(summary, directWatchConfig);
  const syncLabel = displaySyncedAt ? formatDateTime(displaySyncedAt) : "данных за сегодня нет";
  const sleepProgress = getWatchSleepProgress(summary);

  return `
    <section class="watch-recovery-card ${summary ? "is-connected" : "is-empty"}">
      <div class="watch-card-head">
        <div>
          <span>${escapeHtml(formatWatchProviderLabel(summary))}</span>
          <h3>График восстановления</h3>
          <p>${formatDate(date)} · ${escapeHtml(syncLabel)}</p>
        </div>
        <strong>${escapeHtml(status.statusLabel)}</strong>
      </div>
      <div class="watch-recovery-layout">
        <article class="watch-sleep-visual">
          <span>Сон</span>
          <div class="watch-sleep-ring" style="--sleep-progress: ${sleepProgress}">
            <strong>${escapeHtml(formatWatchSleepClock(summary))}</strong>
            <small>${escapeHtml(formatWatchSleepWindow(summary))}</small>
          </div>
          ${renderWatchSleepStages(summary)}
        </article>
        <div class="watch-vital-stack">
          ${renderWatchVitalTile("Пульс покоя", formatDeviceHealthRestingHrValue(summary), formatDeviceHealthHeartRateDetail(summary), "pulse")}
          ${renderWatchVitalTile("SpO2", formatDeviceHealthOxygenValue(summary), formatDeviceHealthOxygenDetail(summary), "oxygen")}
          ${renderWatchVitalTile("Шаги", formatWatchStepsValue(summary), formatWatchStepsDetail(summary), "steps")}
        </div>
      </div>
      <div class="watch-insight">
        <strong>${escapeHtml(formatWatchInsightTitle(summary))}</strong>
        <span>${escapeHtml(formatWatchInsightText(summary))}</span>
      </div>
      <div class="watch-actions">
        <button class="primary-action" data-device-health-sync data-device-health-date="${escapeHtml(date)}" type="button" ${state.isBusy ? "disabled" : ""}>
          Считать данные за сегодня
        </button>
      </div>
    </section>
  `;
}

function renderWatchHeartRateChartCard(
  summary: DeviceHealthDailySummary | null,
  samples: DeviceHealthSample[],
) {
  const chart = buildWatchHeartRateChart(summary, samples);
  const fallbackDetail = summary?.heartRate
    ? formatDeviceHealthHeartRateDetail(summary)
    : "после считывания часов здесь появятся все точки пульса за день";

  return `
    <section class="watch-heart-rate-card ${chart ? "has-samples" : "is-empty"}">
      <div class="watch-heart-rate-approved-head">
        <div>
          <span>PERFORM SYNC</span>
          <h3>Пульс за день</h3>
          <p>${chart ? `${chart.sampleCountLabel} · ${chart.visiblePointLabel}` : escapeHtml(fallbackDetail)}</p>
        </div>
        <strong>${chart ? escapeHtml(chart.averageLabel) : "-"}<span>средний</span></strong>
      </div>
      ${chart ? `
        <div class="watch-heart-rate-approved-metrics">
          <article><span>Мин</span><strong>${escapeHtml(chart.minLabel)}</strong></article>
          <article><span>Сред</span><strong>${escapeHtml(chart.averageLabel)}</strong></article>
          <article><span>Макс</span><strong>${escapeHtml(chart.maxLabel)}</strong></article>
        </div>
        <div class="watch-heart-rate-approved-layout">
          <div class="watch-heart-rate-approved-chart">
            <div class="watch-heart-rate-approved-axis-y" aria-hidden="true">
              ${chart.axisLabels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}
            </div>
            <div class="watch-heart-rate-approved-plot">
              <svg aria-label="График пульса за день" role="img" viewBox="0 0 100 100" preserveAspectRatio="none">
                ${chart.zoneStrips}
                ${chart.sleepBand}
                ${chart.gridLines}
                <line class="average" x1="0" x2="100" y1="${escapeHtml(chart.averageY)}" y2="${escapeHtml(chart.averageY)}"></line>
                ${chart.coverageLine}
                <polyline fill="none" points="${escapeHtml(chart.points)}"></polyline>
                ${chart.peakMarker}
              </svg>
            </div>
            <div class="watch-heart-rate-approved-axis-x" aria-hidden="true">
              <span>00</span>
              <span>12</span>
              <span>24</span>
            </div>
          </div>
          <aside class="watch-heart-rate-approved-zones">
            <strong>Зоны ЧСС</strong>
            ${chart.zoneRows.map((zone) => `
              <div class="watch-heart-rate-approved-zone-row z${zone.zone}">
                <span>${zone.zone}</span>
                <i><b style="width: ${zone.width}"></b><em>${zone.percentLabel}</em></i>
                <strong>${escapeHtml(zone.durationLabel)}</strong>
              </div>
            `).join("")}
          </aside>
        </div>
      ` : `
        <p class="watch-empty-note">Пока есть только дневной итог. После новой синхронизации PERFORM Sync сохранит все точки пульса без усреднения.</p>
      `}
    </section>
  `;
}

function renderWatchParametersCard(
  summary: DeviceHealthDailySummary | null,
  samples: DeviceHealthSample[],
  state: MobileAppState,
  date: string,
) {
  const rawPayload = summary?.rawPayload ?? {};
  const stressAvg = readDeviceHealthRawNumber(rawPayload, "stressAvg");
  const trainingLoadDay = readDeviceHealthRawNumber(rawPayload, "trainingLoadDay");
  const vitality = readDeviceHealthRawNumber(rawPayload, "vitality");
  const directWatchConfig = isDirectWatchRuntime() ? loadDirectWatchConfig() : null;
  const directWatchStatus = directWatchConfig
    ? state.directWatchDiagnostic.serviceStatus
    : null;
  const directWatchStatusKind = directWatchConfig
    ? getDirectWatchServiceStatusKind(directWatchConfig, directWatchStatus)
    : summary ? "running" : "setup";
  const directWatchStatusLabel = directWatchConfig
    ? formatDirectWatchServiceStatusLabel(directWatchConfig, directWatchStatus)
    : summary ? "обновлено" : "нет данных";
  const displaySyncedAt = getWatchDisplaySyncedAt(summary, directWatchConfig);
  const lastSyncAt = directWatchConfig
    ? getLatestDirectWatchConfigSyncAt(directWatchConfig) ?? displaySyncedAt ?? summary?.syncedAt ?? null
    : displaySyncedAt ?? summary?.syncedAt ?? null;
  const lastSyncLabel = lastSyncAt
    ? `Обновлено ${formatDateTime(lastSyncAt)}`
    : "После синхронизации здесь появятся данные часов";
  const sourceLabel = summary
    ? `${formatWatchProviderLabel(summary)} · ${formatDateTime(displaySyncedAt ?? summary.syncedAt)}`
    : "Источник появится после синхронизации";
  const deviceLabel = directWatchConfig
    ? directWatchConfig.deviceName || (directWatchConfig.deviceId ? "Часы выбраны" : "Часы не выбраны")
    : formatWatchProviderLabel(summary);
  const canDirectSync = Boolean(directWatchConfig?.deviceId && directWatchConfig.authKeyHex);
  const oxygenValue = summary?.oxygenSaturation?.latestPercent ?? summary?.oxygenSaturation?.averagePercent ?? null;
  const restingPulse = getDeviceRestingHeartRateValue(summary);
  const pulseProgress = Math.max(8, Math.min(100, Math.round(((restingPulse ?? 64) / 150) * 100)));
  const oxygenProgress = Math.max(8, Math.min(100, Math.round(oxygenValue ?? 0)));
  const sleepProgress = Math.max(8, getWatchSleepProgress(summary));
  const heroStats = [
    { detail: "покой", label: "Пульс", value: formatDeviceHealthRestingHrValue(summary) },
    { detail: "сатурация", label: "SpO2", value: formatDeviceHealthOxygenValue(summary) },
    { detail: "сегодня", label: "Шаги", value: formatWatchStepsValue(summary) },
  ];

  const rows = [
    {
      detail: formatDeviceHealthHeartRateDetail(summary),
      icon: "♥",
      kind: "pulse",
      label: "Пульс",
      preview: renderWatchMetricPreview("pulse", summary, samples),
      value: formatDeviceHealthRestingHrValue(summary),
    },
    {
      detail: formatDeviceHealthSleepDetail(summary),
      icon: "◔",
      kind: "sleep",
      label: "Сон",
      preview: renderWatchMetricPreview("sleep", summary, samples),
      value: formatWatchSleepGridValue(summary),
    },
    {
      detail: formatDeviceHealthOxygenDetail(summary),
      icon: "O₂",
      kind: "oxygen",
      label: "SpO₂",
      preview: renderWatchMetricPreview("oxygen", summary, samples),
      value: formatDeviceHealthOxygenValue(summary),
    },
    {
      detail: formatWatchStepsDetail(summary),
      icon: "↥",
      kind: "steps",
      label: "Шаги",
      preview: renderWatchMetricPreview("steps", summary, samples),
      value: formatWatchStepsValue(summary),
    },
    {
      detail: stressAvg === null ? "часы не передали стресс" : "среднее значение за день",
      icon: "−",
      kind: "stress",
      label: "Стресс",
      preview: renderWatchMetricPreview("stress", summary, samples),
      value: formatWatchOptionalNumber(stressAvg),
    },
    {
      detail: [trainingLoadDay !== null ? "дневная нагрузка" : null, vitality !== null ? `vitality ${formatLoadValue(vitality)}` : null]
        .filter((item): item is string => Boolean(item))
        .join(" · ") || "часы не передали нагрузку",
      icon: "↯",
      kind: "load",
      label: "Нагрузка",
      preview: renderWatchMetricPreview("load", summary, samples),
      value: formatWatchOptionalNumber(trainingLoadDay),
    },
  ];
  const visibleRows = rows.filter((row) =>
    row.kind === "pulse" ||
    row.kind === "sleep" ||
    row.kind === "oxygen" ||
    row.kind === "stress"
  );

  return `
    <section class="watch-parameters-card watch-clean-panel">
      <div class="watch-clean-head">
        <div>
          <h3>Часы</h3>
          <p>${escapeHtml(sourceLabel)}</p>
        </div>
        <span>${escapeHtml(formatDate(date))}</span>
      </div>
      <article class="watch-clean-hero is-${escapeHtml(directWatchStatusKind)}">
        <div class="watch-clean-hero-head">
          <div>
            <span>${escapeHtml(deviceLabel)}</span>
            <strong>${escapeHtml(directWatchStatusLabel)}</strong>
            <small>${escapeHtml(lastSyncLabel)}</small>
          </div>
          ${directWatchConfig
            ? canDirectSync
              ? `
                <button
                  class="watch-clean-sync-button"
                  data-direct-watch-full-sync="${escapeHtml(directWatchConfig.deviceId || "")}"
                  data-direct-watch-full-sync-date="${escapeHtml(date)}"
                  type="button"
                  ${state.isBusy ? "disabled" : ""}
                >
                  ${state.isBusy ? "Обновление" : "Обновить"}
                </button>
              `
              : `
                <button class="watch-clean-sync-button" data-watch-settings-open type="button" ${state.isBusy ? "disabled" : ""}>
                  Настроить
                </button>
              `
            : ""}
        </div>
        <div class="watch-clean-hero-body">
          <div
            class="watch-clean-rings"
            style="--pulse-progress: ${pulseProgress}; --oxygen-progress: ${oxygenProgress}; --sleep-progress: ${sleepProgress};"
            aria-hidden="true"
          >
            <i class="is-pulse"></i>
            <i class="is-sleep"></i>
            <i class="is-oxygen"></i>
            <span></span>
          </div>
          <div class="watch-clean-hero-stats">
            ${heroStats.map((item) => `
              <article>
                <span>${escapeHtml(item.label)}</span>
                <strong>${escapeHtml(item.value)}</strong>
                <small>${escapeHtml(item.detail)}</small>
              </article>
            `).join("")}
          </div>
        </div>
      </article>
      <div class="watch-clean-metric-grid">
        ${visibleRows.map((row) => {
          const content = `
            <span class="watch-clean-metric-icon">${escapeHtml(row.icon)}</span>
            <span class="watch-clean-metric-label">${escapeHtml(row.label)}</span>
            <strong>${escapeHtml(row.value)}</strong>
            <small>${escapeHtml(row.detail)}</small>
            <div class="watch-clean-metric-preview">${row.preview}</div>
          `;

          return `
            <button class="watch-clean-metric is-${escapeHtml(row.kind)}" data-watch-detail="${escapeHtml(row.kind)}" type="button">
              ${content}
            </button>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderWatchQuickSyncAction(state: MobileAppState, date: string) {
  if (!isDirectWatchRuntime()) {
    return "";
  }

  const config = loadDirectWatchConfig();
  const canSync = Boolean(config.deviceId && config.authKeyHex);
  const lastSyncedAt = getLatestDirectWatchConfigSyncAt(config);
  const lastSyncedLabel = lastSyncedAt
    ? `Последняя синхронизация: ${formatDateTime(lastSyncedAt)}`
    : "После нажатия обновятся показатели и тренировки за сегодня.";

  if (!canSync) {
    return `
      <div class="watch-quick-sync-card is-setup">
        <div>
          <span>Синхронизация</span>
          <strong>Нужно выбрать часы и сохранить ключ.</strong>
        </div>
        <div class="watch-quick-sync-actions">
          <button class="primary-action" data-watch-settings-open type="button">
            Настроить
          </button>
        </div>
      </div>
    `;
  }

  return `
    <div class="watch-quick-sync-card">
      <div>
        <span>Синхронизация</span>
        <strong>${escapeHtml(lastSyncedLabel)}</strong>
      </div>
      <div class="watch-quick-sync-actions">
        <button
          class="primary-action"
          data-direct-watch-full-sync="${escapeHtml(config.deviceId || "")}"
          data-direct-watch-full-sync-date="${escapeHtml(date)}"
          type="button"
          ${state.isBusy ? "disabled" : ""}
        >
          Обновить
        </button>
        <button class="secondary-action" data-watch-settings-open type="button" ${state.isBusy ? "disabled" : ""}>
          Настройка
        </button>
      </div>
    </div>
  `;
}

function buildWatchHeartRateSparkline(
  summary: DeviceHealthDailySummary | null,
  samples: DeviceHealthSample[],
) {
  const entryDate = summary?.entryDate ?? samples[0]?.entryDate;
  if (!entryDate) {
    return null;
  }

  const dayBounds = getLocalDayBounds(entryDate);
  if (!dayBounds) {
    return null;
  }

  const points = samples
    .map((sample) => {
      const sampledAt = new Date(sample.sampledAt);
      const value = sample.value;
      if (
        Number.isNaN(sampledAt.getTime()) ||
        sampledAt.getTime() < dayBounds.start.getTime() ||
        sampledAt.getTime() > dayBounds.end.getTime() ||
        value < 25 ||
        value > 240
      ) {
        return null;
      }

      return { sampledAt, value };
    })
    .filter((sample): sample is { sampledAt: Date; value: number } => Boolean(sample))
    .sort((left, right) => left.sampledAt.getTime() - right.sampledAt.getTime());

  if (points.length < 2) {
    return null;
  }

  const visiblePoints = limitDeviceWorkoutSamples(points, 34);
  const values = visiblePoints.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const rangePadding = Math.max(8, (max - min) * 0.28);
  let lower = Math.max(35, Math.floor((min - rangePadding) / 5) * 5);
  let upper = Math.min(220, Math.ceil((max + rangePadding) / 5) * 5);

  if (upper - lower < 35) {
    const middle = (upper + lower) / 2;
    lower = Math.max(35, Math.floor((middle - 18) / 5) * 5);
    upper = Math.min(220, Math.ceil((middle + 18) / 5) * 5);
  }

  const range = Math.max(1, upper - lower);
  const valueToY = (value: number) => 38 - ((value - lower) / range) * 30;
  const pointCount = Math.max(1, visiblePoints.length - 1);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;

  return {
    averageY: valueToY(average).toFixed(2),
    points: visiblePoints
      .map((point, index) => `${((index / pointCount) * 100).toFixed(2)},${valueToY(point.value).toFixed(2)}`)
      .join(" "),
  };
}

function renderWatchMetricPreview(
  kind: string,
  summary: DeviceHealthDailySummary | null,
  samples: DeviceHealthSample[],
) {
  if (kind === "pulse") {
    const sparkline = buildWatchHeartRateSparkline(summary, samples);

    return sparkline
      ? `
        <svg class="watch-parameter-preview is-pulse-preview" viewBox="0 0 100 44" preserveAspectRatio="none" aria-hidden="true">
          <line class="watch-parameter-baseline" x1="0" x2="100" y1="${escapeHtml(sparkline.averageY)}" y2="${escapeHtml(sparkline.averageY)}"></line>
          <polyline points="${escapeHtml(sparkline.points)}"></polyline>
        </svg>
      `
      : `<span class="watch-parameter-preview is-empty-preview"></span>`;
  }

  if (kind === "sleep") {
    const stages = [
      summary?.sleep?.deepMinutes ?? 0,
      summary?.sleep?.remMinutes ?? 0,
      summary?.sleep?.lightMinutes ?? 0,
      summary?.sleep?.durationMinutes ? Math.max(20, summary.sleep.durationMinutes - (summary.sleep.deepMinutes ?? 0) - (summary.sleep.remMinutes ?? 0)) : 0,
    ].filter((value) => value > 0);
    const max = Math.max(...stages, 1);
    const visibleStages = stages.length ? stages.slice(0, 4) : [35, 52, 28, 44];

    return `
      <div class="watch-parameter-preview is-sleep-preview" aria-hidden="true">
        ${visibleStages.map((value) => `
          <i style="height: ${Math.max(22, Math.round((value / max) * 58))}px"></i>
        `).join("")}
      </div>
    `;
  }

  if (kind === "steps") {
    return `
      <div class="watch-parameter-preview is-bar-preview" aria-hidden="true">
        <i style="height: 36px"></i>
        <i style="height: 58px"></i>
        <i style="height: 42px"></i>
      </div>
    `;
  }

  if (kind === "oxygen") {
    return `
      <svg class="watch-parameter-preview is-line-preview" viewBox="0 0 100 50" preserveAspectRatio="none" aria-hidden="true">
        <path d="M8 34 C28 24 44 35 60 31 C76 28 84 18 94 12"></path>
      </svg>
    `;
  }

  if (kind === "load") {
    const rawPayload = summary?.rawPayload ?? {};
    const vitality = readDeviceHealthRawNumber(rawPayload, "vitality");
    const width = vitality === null ? 18 : Math.max(10, Math.min(100, vitality * 8));
    return `<span class="watch-parameter-preview is-fill-preview"><i style="width: ${width}%"></i></span>`;
  }

  return `<span class="watch-parameter-preview is-empty-preview"></span>`;
}

function renderWatchWorkoutsCard(
  workouts: DeviceWorkout[],
  state: MobileAppState,
  athleteId: string,
  date: string,
  showingRecentWorkouts: boolean,
  expandedWorkoutId: string | null,
  expandedWorkoutGraphId: string | null,
) {
  const contextByDate = new Map<string, WatchWorkoutContext>();
  const getWorkoutContext = (entryDate: string) => {
    const cached = contextByDate.get(entryDate);
    if (cached) {
      return cached;
    }

    const context = getWatchWorkoutContextForDate(state, athleteId, entryDate);
    contextByDate.set(entryDate, context);
    return context;
  };

  return `
    <section class="watch-workouts-card">
      <div class="watch-card-head">
        <div>
          <span>${showingRecentWorkouts ? "Последние тренировки" : "Тренировки"}</span>
          <h3>${showingRecentWorkouts ? "Недавняя активность" : "Активность с устройства"}</h3>
        </div>
        <strong>${workouts.length}</strong>
      </div>
      ${workouts.length ? `
        <div class="watch-workout-list">
          ${workouts.map((workout) => {
            const context = getWorkoutContext(workout.entryDate);
            return renderWatchWorkoutItem(
              workout,
              context,
              date,
              expandedWorkoutId === workout.id,
              expandedWorkoutGraphId === workout.id,
            );
          }).join("")}
        </div>
      ` : `
        <p class="watch-empty-note">Тренировки за сегодня пока не пришли. После синхронизации они появятся здесь.</p>
      `}
    </section>
  `;
}

function renderWatchWorkoutSummaryCard(todayWorkouts: DeviceWorkout[], recentWorkouts: DeviceWorkout[], date: string) {
  const latestWorkout = recentWorkouts[0] ?? null;
  const totalDuration = sumWatchWorkoutDurationMinutes(todayWorkouts);
  const totalCalories = sumWatchWorkoutActiveCalories(todayWorkouts);
  const totalDistance = sumWatchWorkoutDistanceMeters(todayWorkouts);
  const summaryStats = [
    {
      label: "Время",
      value: totalDuration > 0 ? formatDeviceWorkoutDuration(totalDuration) : "нет данных",
    },
    {
      label: "Калории",
      value: totalCalories > 0 ? `${Math.round(totalCalories)} ккал` : "нет данных",
    },
    {
      label: "Дистанция",
      value: totalDistance > 0 ? formatDistanceMeters(totalDistance) : "нет данных",
    },
  ];

  return `
    <section class="watch-workouts-card is-summary watch-clean-workout-card">
      <div class="watch-clean-workout-head">
        <div>
          <span>Тренировки</span>
          <h3>${escapeHtml(todayWorkouts.length ? `${todayWorkouts.length} ${formatWorkoutCountLabel(todayWorkouts.length, "тренировка", "тренировки", "тренировок")}` : "Сегодня нет тренировок")}</h3>
          <p>${escapeHtml(formatWatchWorkoutSummaryHint(todayWorkouts, latestWorkout, date))}</p>
        </div>
        <button class="secondary-action" data-watch-workouts-open type="button">
          Открыть
        </button>
      </div>
      <div class="watch-workouts-summary-body">
        <div class="watch-workouts-summary-grid">
          ${summaryStats.map((item) => `
            <article>
              <span>${escapeHtml(item.label)}</span>
              <strong>${escapeHtml(item.value)}</strong>
            </article>
          `).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderWatchWorkoutHistoryScreen(state: MobileAppState, athleteId: string, date: string) {
  const period = state.watchWorkoutHistoryPeriod;
  const groups = getWatchWorkoutHistoryGroups(state, athleteId, date, period);
  const totals = summarizeWatchWorkoutHistoryGroups(groups);

  return `
    <section class="watch-detail-screen watch-training-history-screen">
      <div class="watch-detail-title-row">
        <button aria-label="Назад" class="watch-detail-back-button" data-watch-workouts-back type="button">‹</button>
        <h3>Тренировки</h3>
      </div>
      <p class="watch-detail-date">${escapeHtml(formatWatchDetailPeriodLabel(date, period))}</p>
      <div class="watch-detail-period-tabs" role="tablist" aria-label="Период тренировок">
        ${(["day", "week", "month"] as WatchDetailPeriod[]).map((item) => `
          <button
            class="${period === item ? "is-active" : ""}"
            data-watch-workouts-period="${item}"
            type="button"
          >${escapeHtml(formatWatchDetailPeriodTab(item))}</button>
        `).join("")}
      </div>
      <section class="watch-training-history-total">
        <div>
          <span>Всего за период</span>
          <strong>${totals.workoutCount}</strong>
          <small>${escapeHtml(formatWorkoutCountLabel(totals.workoutCount, "тренировка", "тренировки", "тренировок"))}</small>
        </div>
        <div>
          <span>Время</span>
          <strong>${escapeHtml(totals.durationMinutes > 0 ? formatDeviceWorkoutDuration(totals.durationMinutes) : "0 мин")}</strong>
          <small>суммарно</small>
        </div>
        <div>
          <span>Калории</span>
          <strong>${escapeHtml(totals.activeCalories > 0 ? `${Math.round(totals.activeCalories)} ккал` : "0 ккал")}</strong>
          <small>${escapeHtml(totals.distanceMeters > 0 ? formatDistanceMeters(totals.distanceMeters) : "без дистанции")}</small>
        </div>
      </section>
      ${groups.length ? `
        <div class="watch-training-date-list">
          ${groups.map((group) => renderWatchWorkoutHistoryGroup(group, date)).join("")}
        </div>
      ` : renderEmpty("Тренировок за период нет", "Синхронизируйте часы, и новые тренировки появятся здесь по датам.")}
    </section>
  `;
}

function getWatchWorkoutHistoryGroups(
  state: MobileAppState,
  athleteId: string,
  date: string,
  period: WatchDetailPeriod,
): WatchWorkoutHistoryGroup[] {
  const cacheKey = `${athleteId}|${date}|${period}`;
  const sourceWorkouts = state.data.deviceWorkouts;
  const sourceCache = watchWorkoutHistoryGroupsCache.get(sourceWorkouts);
  const cachedGroups = sourceCache?.get(cacheKey);
  if (cachedGroups) {
    return cachedGroups;
  }

  const periodDates = getWatchDetailPeriodDates(date, period);
  const periodDateSet = new Set(periodDates);
  const workoutsByDate = new Map<string, DeviceWorkout[]>();

  for (const workout of sourceWorkouts) {
    if (
      periodDateSet.has(workout.entryDate) &&
      (!athleteId || workout.athleteId === athleteId)
    ) {
      const items = workoutsByDate.get(workout.entryDate);
      if (items) {
        items.push(workout);
      } else {
        workoutsByDate.set(workout.entryDate, [workout]);
      }
    }
  }

  const groups = periodDates
    .slice()
    .reverse()
    .map((entryDate) => buildWatchWorkoutHistoryGroup(entryDate, getDisplayDeviceWorkoutsForDateItems(workoutsByDate.get(entryDate) ?? [])))
    .filter((group) => group.workouts.length > 0);
  const nextSourceCache = sourceCache ?? new Map<string, WatchWorkoutHistoryGroup[]>();
  nextSourceCache.set(cacheKey, groups);
  if (!sourceCache) {
    watchWorkoutHistoryGroupsCache.set(sourceWorkouts, nextSourceCache);
  }
  return groups;
}

function buildWatchWorkoutHistoryGroup(date: string, workouts: DeviceWorkout[]): WatchWorkoutHistoryGroup {
  const totals = summarizeWatchWorkouts(workouts);

  return {
    activeCalories: totals.activeCalories,
    date,
    distanceMeters: totals.distanceMeters,
    durationMinutes: totals.durationMinutes,
    workouts,
  };
}

function summarizeWatchWorkoutHistoryGroups(groups: WatchWorkoutHistoryGroup[]): WatchWorkoutHistoryTotals {
  return groups.reduce<WatchWorkoutHistoryTotals>((totals, group) => ({
    activeCalories: totals.activeCalories + group.activeCalories,
    distanceMeters: totals.distanceMeters + group.distanceMeters,
    durationMinutes: totals.durationMinutes + group.durationMinutes,
    workoutCount: totals.workoutCount + group.workouts.length,
  }), {
    activeCalories: 0,
    distanceMeters: 0,
    durationMinutes: 0,
    workoutCount: 0,
  });
}

function renderWatchWorkoutHistoryGroup(
  group: WatchWorkoutHistoryGroup,
  currentDate: string,
) {
  return `
    <section class="watch-training-date-group">
      <div class="watch-training-date-head">
        <div>
          <span>${escapeHtml(formatDayRelativeLabel(group.date))}</span>
          <strong>${escapeHtml(formatDate(group.date))}</strong>
        </div>
        <small>${escapeHtml(formatWatchWorkoutGroupSummary(group))}</small>
      </div>
      <div class="watch-training-history-list">
        ${group.workouts.map((workout) => renderWatchWorkoutHistoryItem(workout, currentDate)).join("")}
      </div>
    </section>
  `;
}

function renderWatchWorkoutHistoryItem(
  workout: DeviceWorkout,
  currentDate: string,
) {
  const chips = getWatchWorkoutChips(workout);
  const profile = getDeviceWorkoutProfile(workout.workoutType);
  const hasGraphs = hasDeviceWorkoutGraphSummary(workout);

  return `
    <button class="watch-training-history-item is-${escapeHtml(profile.id)}" data-watch-workout-open="${escapeHtml(workout.id)}" type="button">
      <span class="watch-training-type-dot" aria-hidden="true"></span>
      <span class="watch-training-history-content">
        <strong>${escapeHtml(formatDeviceWorkoutTypeLabel(workout))}</strong>
        <small>${escapeHtml(formatWatchWorkoutListTimeLabel(workout, currentDate))}</small>
        ${chips.length ? `
          <span class="watch-workout-chip-list">
            ${chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join("")}
          </span>
        ` : ""}
        ${hasGraphs ? `<em>Есть графики и подробности</em>` : ""}
      </span>
      <span class="watch-training-history-arrow" aria-hidden="true">›</span>
    </button>
  `;
}

function formatWatchWorkoutSummaryHint(
  todayWorkouts: DeviceWorkout[],
  latestWorkout: DeviceWorkout | null,
  date: string,
) {
  if (todayWorkouts.length > 0) {
    return "Сводка за сегодня. Полная история открывается отдельным экраном.";
  }

  if (latestWorkout) {
    const latestLabel = latestWorkout.entryDate === date
      ? formatDeviceWorkoutTimeLabel(latestWorkout)
      : `${formatDate(latestWorkout.entryDate)} · ${formatDeviceWorkoutTimeLabel(latestWorkout)}`;
    return `Сегодня новых нет. Последняя: ${formatDeviceWorkoutTypeLabel(latestWorkout)}, ${latestLabel}.`;
  }

  return "После синхронизации тренировки будут собраны по датам.";
}

function formatWatchWorkoutGroupSummary(group: WatchWorkoutHistoryGroup) {
  return [
    `${group.workouts.length} ${formatWorkoutCountLabel(group.workouts.length, "тренировка", "тренировки", "тренировок")}`,
    group.durationMinutes > 0 ? formatDeviceWorkoutDuration(group.durationMinutes) : null,
    group.activeCalories > 0 ? `${Math.round(group.activeCalories)} ккал` : null,
    group.distanceMeters > 0 ? formatDistanceMeters(group.distanceMeters) : null,
  ].filter((item): item is string => Boolean(item)).join(" · ");
}

function summarizeWatchWorkouts(workouts: DeviceWorkout[]): Omit<WatchWorkoutHistoryTotals, "workoutCount"> {
  let activeCalories = 0;
  let distanceMeters = 0;
  let durationMinutes = 0;

  for (const workout of workouts) {
    durationMinutes += workout.durationMinutes ?? 0;
    activeCalories += getTrustedWatchWorkoutActiveCalories(workout) ?? 0;

    if (isDeviceWorkoutMetricRelevant(workout.workoutType, "distance")) {
      distanceMeters += getTrustedWatchWorkoutDistanceMeters(workout) ?? 0;
    }
  }

  return {
    activeCalories,
    distanceMeters,
    durationMinutes,
  };
}

function sumWatchWorkoutDurationMinutes(workouts: DeviceWorkout[]) {
  return workouts.reduce((sum, workout) => sum + (workout.durationMinutes ?? 0), 0);
}

function sumWatchWorkoutActiveCalories(workouts: DeviceWorkout[]) {
  return workouts.reduce((sum, workout) => sum + (getTrustedWatchWorkoutActiveCalories(workout) ?? 0), 0);
}

function sumWatchWorkoutDistanceMeters(workouts: DeviceWorkout[]) {
  return workouts.reduce((sum, workout) => {
    if (!isDeviceWorkoutMetricRelevant(workout.workoutType, "distance")) {
      return sum;
    }

    return sum + (getTrustedWatchWorkoutDistanceMeters(workout) ?? 0);
  }, 0);
}

function formatWorkoutCountLabel(count: number, one: string, few: string, many: string) {
  const mod10 = Math.abs(count) % 10;
  const mod100 = Math.abs(count) % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return one;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return few;
  }

  return many;
}

function renderWatchWorkoutItem(
  workout: DeviceWorkout,
  context: WatchWorkoutContext,
  currentDate: string,
  isExpanded: boolean,
  isGraphExpanded: boolean,
) {
  const chips = getWatchWorkoutChips(workout);
  const graphSeries = isExpanded && isGraphExpanded ? buildDeviceWorkoutGraphSeries(workout, context) : [];
  const hasAvailableGraphs = isExpanded ? hasDeviceWorkoutGraph(workout, context) : false;

  return `
    <article class="watch-workout-item ${isExpanded ? "is-open" : ""}">
      <button
        class="watch-workout-summary"
        data-watch-workout-toggle="${escapeHtml(workout.id)}"
        type="button"
        aria-expanded="${isExpanded ? "true" : "false"}"
      >
        <div class="watch-workout-title">
          <span>${escapeHtml(formatDeviceWorkoutTypeLabel(workout))}</span>
          <small>${escapeHtml(formatWatchWorkoutListTimeLabel(workout, currentDate))}</small>
        </div>
        ${chips.length ? `
          <div class="watch-workout-chip-list">
            ${chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join("")}
          </div>
        ` : ""}
      </button>
      ${isExpanded ? `
        <div class="watch-workout-details">
          ${renderWatchWorkoutParameterPanel(workout, context, graphSeries)}
          ${renderWatchWorkoutGraphGate(workout, context, graphSeries, isGraphExpanded, hasAvailableGraphs)}
        </div>
      ` : ""}
    </article>
  `;
}

function getWatchWorkoutContextForDate(
  state: MobileAppState,
  athleteId: string,
  date: string,
): WatchWorkoutContext {
  return {
    heartRateSamples: getDeviceHealthSamplesForDate(state, athleteId, date, "heart_rate"),
    oxygenSamples: getDeviceHealthSamplesForDate(state, athleteId, date, "oxygen_saturation"),
    stressSamples: getDeviceHealthSamplesForDate(state, athleteId, date, "stress"),
    summary: getDeviceHealthSummaryForDate(state, athleteId, date),
  };
}

function formatWatchWorkoutListTimeLabel(workout: DeviceWorkout, currentDate: string) {
  const timeLabel = formatDeviceWorkoutTimeLabel(workout);
  return workout.entryDate === currentDate ? timeLabel : `${formatDate(workout.entryDate)} · ${timeLabel}`;
}

function renderWatchWorkoutGraphGate(
  workout: DeviceWorkout,
  context: WatchWorkoutContext,
  graphSeries: DeviceWorkoutGraphSeries[],
  isGraphExpanded: boolean,
  hasAvailableGraphs: boolean,
) {
  const hasRawZones = getDeviceWorkoutRawHeartRateZones(workout).length > 0;
  const showsOnlyZones = !hasAvailableGraphs && hasRawZones;
  const hasHeartRateGraph = graphSeries.some((series) => series.key === "heartRate");
  const hasPaceGraph = graphSeries.some((series) => series.key === "pace" || series.key === "speed");
  const gateTitle = showsOnlyZones
    ? "Зоны ЧСС"
    : hasHeartRateGraph
      ? "График пульса"
      : hasPaceGraph
        ? "График темпа"
        : "Графики тренировки";
  const gateDescription = showsOnlyZones
    ? "Часы отдали зоны по итогу тренировки. Откроем их отдельно, без тяжёлого графика."
    : hasHeartRateGraph
      ? "Откроем подробный график пульса без подвисания карточки."
      : hasPaceGraph
        ? "Откроем темп и маршрутные точки без подвисания карточки."
        : "Откроем доступные графики тренировки без подвисания карточки.";
  const gateButtonLabel = showsOnlyZones
    ? "Показать зоны"
    : hasHeartRateGraph
      ? "Открыть пульс"
      : hasPaceGraph
        ? "Открыть темп"
        : "Открыть графики";

  if (isGraphExpanded) {
    return `
      ${renderDeviceWorkoutGraph(workout, context, graphSeries)}
      <button class="watch-workout-graph-toggle" data-watch-workout-graph="${escapeHtml(workout.id)}" type="button">
        Свернуть ${graphSeries.length === 0 ? "зоны" : "графики"}
      </button>
    `;
  }

  return `
    <section class="watch-workout-graph-gate">
      <div>
        <strong>${escapeHtml(gateTitle)}</strong>
        <span>${escapeHtml(gateDescription)}</span>
      </div>
      <button class="watch-workout-graph-toggle" data-watch-workout-graph="${escapeHtml(workout.id)}" type="button">
        ${escapeHtml(gateButtonLabel)}
      </button>
    </section>
  `;
}

function getWatchWorkoutChips(workout: DeviceWorkout) {
  const steps = getTrustedWatchWorkoutSteps(workout);
  const activeCalories = getTrustedWatchWorkoutActiveCalories(workout);
  const distanceMeters = getTrustedWatchWorkoutDistanceMeters(workout);
  return [
    workout.durationMinutes !== null ? formatDeviceWorkoutDuration(workout.durationMinutes) : null,
    distanceMeters !== null && isDeviceWorkoutMetricRelevant(workout.workoutType, "distance")
      ? formatDistanceMeters(distanceMeters)
      : null,
    steps !== null && isDeviceWorkoutMetricRelevant(workout.workoutType, "steps")
      ? `${Math.round(steps).toLocaleString("ru-RU")} шагов`
      : null,
    workout.averageHeartRateBpm !== null ? `Пульс ${formatLoadValue(workout.averageHeartRateBpm)}` : null,
    activeCalories !== null ? `${Math.round(activeCalories)} ккал` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 3);
}

function renderWatchSettingsPanel(
  state: MobileAppState,
  summary: DeviceHealthDailySummary | null,
  date: string,
) {
  const canSync = state.session.user?.role === "athlete";
  const showGenericSync = canSync && !isDirectWatchRuntime();

  return `
    <details class="watch-settings-panel">
      <summary>
        <span>Настройка часов</span>
        <small>${escapeHtml(formatWatchSourceHint(summary))}</small>
      </summary>
      <div class="watch-settings-body">
        <article class="watch-source-note">
          <strong>${escapeHtml(formatWatchProviderLabel(summary))}</strong>
          <span>${escapeHtml(formatWatchSourceDescription(summary))}</span>
        </article>
        ${showGenericSync ? `
          <div class="watch-settings-actions">
            <button class="secondary-action" data-device-health-sync data-device-health-date="${escapeHtml(date)}" type="button" ${state.isBusy ? "disabled" : ""}>
            Синхронизировать часы
          </button>
          </div>
        ` : ""}
        ${isDirectWatchRuntime() ? "" : renderHealthConnectDiagnostics(summary, true)}
        ${canSync && SHOW_DIRECT_WATCH_DIAGNOSTICS && isDirectWatchRuntime() ? renderDirectWatchDiagnostics(state, date) : ""}
      </div>
    </details>
  `;
}

function buildWatchHeartRateChart(
  summary: DeviceHealthDailySummary | null,
  samples: DeviceHealthSample[],
) {
  const entryDate = summary?.entryDate ?? samples[0]?.entryDate;
  if (!entryDate) {
    return null;
  }

  const dayBounds = getLocalDayBounds(entryDate);
  if (!dayBounds) {
    return null;
  }

  const points = samples
    .map((sample) => {
      const sampledAt = new Date(sample.sampledAt);
      const value = sample.value;
      if (
        Number.isNaN(sampledAt.getTime()) ||
        sampledAt.getTime() < dayBounds.start.getTime() ||
        sampledAt.getTime() > dayBounds.end.getTime() ||
        value < 25 ||
        value > 240
      ) {
        return null;
      }

      return {
        sampledAt,
        value,
      };
    })
    .filter((sample): sample is { sampledAt: Date; value: number } => Boolean(sample))
    .sort((left, right) => left.sampledAt.getTime() - right.sampledAt.getTime());

  if (points.length < 2) {
    return null;
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const estimatedHeartRateMax = getEstimatedHeartRateMax(max);
  const scale = buildAdaptiveHeartRateScale(min, max);
  const { lower, upper } = scale;
  const range = Math.max(1, upper - lower);
  const dayMs = dayBounds.end.getTime() - dayBounds.start.getTime();
  const valueToY = (value: number) => 92 - ((value - lower) / range) * 84;
  const timeToX = (value: Date) => ((value.getTime() - dayBounds.start.getTime()) / dayMs) * 100;
  const visiblePoints = limitDeviceWorkoutSamples(points, 260);
  const svgPoints = visiblePoints
    .map((point) => `${timeToX(point.sampledAt).toFixed(2)},${valueToY(point.value).toFixed(2)}`)
    .join(" ");
  const zoneSeries: DeviceWorkoutGraphSeries = {
    key: "heartRate",
    label: "Пульс",
    samples: points.map((point) => ({
      sampleTime: point.sampledAt.toISOString(),
      value: point.value,
    })),
    valueLabel: (value) => `${Math.round(value)} уд/мин`,
  };
  const heartRateZones = buildDeviceWorkoutHeartRateZones(zoneSeries, estimatedHeartRateMax);
  const gridValues = scale.axisValues;
  const gridLines = gridValues.map((value) => {
    const y = valueToY(value).toFixed(2);
    return `<line class="grid" x1="0" x2="100" y1="${y}" y2="${y}"></line>`;
  }).join("");
  const zoneStrips = heartRateZones.map((zone) => {
    const visibleTop = Math.min(upper, zone.upper);
    const visibleBottom = Math.max(lower, zone.zone === 1 ? 0 : zone.lower);
    if (visibleBottom >= visibleTop) {
      return "";
    }
    const zoneTop = valueToY(visibleTop);
    const zoneBottom = valueToY(visibleBottom);
    return `<rect class="hr-zone-strip z${zone.zone}" height="${Math.max(0, zoneBottom - zoneTop).toFixed(2)}" width="1.7" x="0" y="${zoneTop.toFixed(2)}"></rect>`;
  }).join("");
  const peak = points.reduce((current, point) => point.value > current.value ? point : current, points[0]);
  const peakX = timeToX(peak.sampledAt).toFixed(2);
  const peakY = valueToY(peak.value).toFixed(2);
  const sampleStartX = timeToX(points[0].sampledAt);
  const sampleEndX = timeToX(points[points.length - 1].sampledAt);
  const coveragePercent = Math.max(0, Math.min(100, sampleEndX - sampleStartX));
  const sleepBand = buildWatchSleepBand(summary, dayBounds);
  const averageY = valueToY(average).toFixed(2);

  return {
    averageY,
    averageLabel: `${Math.round(average)}`,
    axisLabels: gridValues.map((value) => String(Math.round(value))),
    checkNote: "Пульс с часов сохраняется и уже отрисовывается в утверждённом формате.",
    coverageLine: `<line class="coverage" x1="${Math.max(0, Math.min(100, sampleStartX)).toFixed(2)}" x2="${Math.max(0, Math.min(100, sampleEndX)).toFixed(2)}" y1="97" y2="97"></line>`,
    coverageNote: `Покрытие данных: ${Math.round(coveragePercent)}%. Точки не теряются, но для экрана берутся min/max по бакетам, чтобы график не лагал.`,
    gridLines,
    maxLabel: `${Math.round(max)}`,
    minLabel: `${Math.round(min)}`,
    peakLabel: `пик ${Math.round(peak.value)} · ${formatTime(peak.sampledAt.toISOString())}`,
    peakMarker: `
      <line class="peak-line" x1="${peakX}" x2="${peakX}" y1="${peakY}" y2="96"></line>
      <circle class="peak-dot" cx="${peakX}" cy="${peakY}" r="1.8"></circle>
    `,
    points: svgPoints,
    rangeLabel: `${Math.round(min)}-${Math.round(max)} уд/мин`,
    sampleCountLabel: `${points.length} точек ЧСС`,
    sleepBand,
    visiblePointLabel: `на графике ${visiblePoints.length} ключевых точек`,
    zoneRows: heartRateZones.map((zone) => ({
      durationLabel: formatHeartRateZoneCompactDurationMs(zone.durationMs),
      percentLabel: `${Math.round(zone.percent)}%`,
      width: zone.percent > 0 ? `${Math.max(2, zone.percent).toFixed(1)}%` : "0%",
      zone: zone.zone,
    })),
    zoneStrips,
  };
}

function buildWatchSampleChart(
  metric: WatchDetailMetric,
  entryDate: string | null,
  samples: DeviceHealthSample[],
) {
  if (!entryDate) {
    return null;
  }

  const dayBounds = getLocalDayBounds(entryDate);
  if (!dayBounds) {
    return null;
  }

  const validRange = getWatchSampleValidRange(metric);
  const points = samples
    .map((sample) => {
      const sampledAt = new Date(sample.sampledAt);
      const value = sample.value;
      if (
        Number.isNaN(sampledAt.getTime()) ||
        sampledAt.getTime() < dayBounds.start.getTime() ||
        sampledAt.getTime() > dayBounds.end.getTime() ||
        !Number.isFinite(value) ||
        value < validRange.lower ||
        value > validRange.upper
      ) {
        return null;
      }

      return { sampledAt, value };
    })
    .filter((sample): sample is { sampledAt: Date; value: number } => Boolean(sample))
    .sort((left, right) => left.sampledAt.getTime() - right.sampledAt.getTime());

  if (points.length < 2) {
    return null;
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const scale = buildWatchSampleScale(metric, min, max);
  const { lower, upper } = scale;
  const range = Math.max(1, upper - lower);
  const dayMs = dayBounds.end.getTime() - dayBounds.start.getTime();
  const valueToY = (value: number) => 92 - ((value - lower) / range) * 84;
  const timeToX = (value: Date) => ((value.getTime() - dayBounds.start.getTime()) / dayMs) * 100;
  const visiblePoints = limitDeviceWorkoutSamples(points, 260);
  const gridLines = scale.axisValues.map((value) => {
    const y = valueToY(value).toFixed(2);
    return `<line class="grid" x1="0" x2="100" y1="${y}" y2="${y}"></line>`;
  }).join("");

  return {
    averageY: valueToY(average).toFixed(2),
    axisLabels: scale.axisValues.map((value) => (
      metric === "oxygen" ? `${Math.round(value)}%` : String(Math.round(value))
    )),
    gridLines,
    points: visiblePoints
      .map((point) => `${timeToX(point.sampledAt).toFixed(2)},${valueToY(point.value).toFixed(2)}`)
      .join(" "),
    title: metric === "oxygen" ? "График SpO₂" : "График стресса",
  };
}

function buildWatchSampleScale(metric: WatchDetailMetric, min: number, max: number) {
  if (metric === "oxygen") {
    let lower = Math.max(80, Math.floor(min - 1));
    let upper = Math.min(100, Math.ceil(max + 1));
    if (upper - lower < 4) {
      lower = Math.max(80, lower - 2);
      upper = Math.min(100, upper + 2);
    }
    const middle = Math.round((lower + upper) / 2);
    return { axisValues: [upper, middle, lower], lower, upper };
  }

  let lower = Math.max(0, Math.floor((min - 5) / 10) * 10);
  let upper = Math.min(100, Math.ceil((max + 5) / 10) * 10);
  if (upper - lower < 20) {
    lower = Math.max(0, lower - 10);
    upper = Math.min(100, upper + 10);
  }
  const middle = Math.round((lower + upper) / 2);
  return { axisValues: [upper, middle, lower], lower, upper };
}

function formatHeartRateZoneCompactDurationMs(value: number) {
  const totalSeconds = Math.max(0, Math.round(value / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getLocalDayBounds(entryDate: string) {
  const [year, month, day] = entryDate.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
  return { end, start };
}

function buildWatchSleepBand(
  summary: DeviceHealthDailySummary | null,
  dayBounds: { start: Date; end: Date },
) {
  const start = summary?.sleep?.startTime ? new Date(summary.sleep.startTime) : null;
  const end = summary?.sleep?.endTime ? new Date(summary.sleep.endTime) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "";
  }

  const clampedStart = Math.max(start.getTime(), dayBounds.start.getTime());
  const clampedEnd = Math.min(end.getTime(), dayBounds.end.getTime());
  if (clampedEnd <= clampedStart) {
    return "";
  }

  const dayMs = dayBounds.end.getTime() - dayBounds.start.getTime();
  const x = ((clampedStart - dayBounds.start.getTime()) / dayMs) * 100;
  const width = ((clampedEnd - clampedStart) / dayMs) * 100;
  return `<rect class="sleep-band" x="${x.toFixed(2)}" y="6" width="${width.toFixed(2)}" height="88"></rect>`;
}

function formatWatchSleepBandLabel(summary: DeviceHealthDailySummary | null) {
  if (!summary?.sleep?.startTime || !summary.sleep.endTime) {
    return null;
  }

  return `сон ${formatTime(summary.sleep.startTime)}-${formatTime(summary.sleep.endTime)}`;
}

function renderWatchVitalTile(label: string, value: string, detail: string, status: string) {
  return `
    <article class="watch-vital-tile is-${escapeHtml(status)}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(detail)}</small>
    </article>
  `;
}

function renderWatchSleepStages(summary: DeviceHealthDailySummary | null) {
  const stages = [
    { className: "deep", label: "Глубокий", minutes: summary?.sleep?.deepMinutes ?? 0 },
    { className: "rem", label: "REM", minutes: summary?.sleep?.remMinutes ?? 0 },
    { className: "light", label: "Лёгкий", minutes: summary?.sleep?.lightMinutes ?? 0 },
  ].filter((stage) => stage.minutes > 0);

  if (stages.length === 0) {
    return `<p class="watch-empty-note">Детализация сна появится после синхронизации.</p>`;
  }

  return `
    <div class="watch-stage-panel">
      <div class="watch-stage-bar">
        ${stages.map((stage) => `
          <span class="is-${escapeHtml(stage.className)}" style="flex-grow: ${stage.minutes}"></span>
        `).join("")}
      </div>
      <div class="watch-stage-legend">
        ${stages.map((stage) => `
          <span><i class="is-${escapeHtml(stage.className)}"></i>${escapeHtml(stage.label)} ${escapeHtml(formatDurationHours(stage.minutes))}</span>
        `).join("")}
      </div>
    </div>
  `;
}

function getWatchStepCount(summary: DeviceHealthDailySummary | null) {
  const rawPayload = summary?.rawPayload ?? {};
  return readBestDeviceHealthStepCount(rawPayload);
}

function formatWatchStepsValue(summary: DeviceHealthDailySummary | null) {
  const steps = getWatchStepCount(summary);
  return steps === null ? "-" : Math.round(steps).toLocaleString("ru-RU");
}

function formatWatchStepsDetail(summary: DeviceHealthDailySummary | null) {
  const steps = getWatchStepCount(summary);
  return steps === null ? "шаги не пришли" : "активность за день";
}

function formatWatchOptionalNumber(value: number | null) {
  return value === null ? "-" : formatLoadValue(value);
}

function formatWatchSleepClock(summary: DeviceHealthDailySummary | null) {
  const minutes = summary?.sleep?.durationMinutes;
  if (minutes === null || minutes === undefined) {
    return "-";
  }

  const roundedMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(roundedMinutes / 60);
  const remainder = roundedMinutes % 60;
  return `${hours}:${remainder.toString().padStart(2, "0")}`;
}

function formatWatchSleepGridValue(summary: DeviceHealthDailySummary | null) {
  const minutes = summary?.sleep?.durationMinutes;
  if (minutes === null || minutes === undefined) {
    return formatDeviceHealthSleepValue(summary);
  }

  const roundedMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(roundedMinutes / 60);
  const remainder = roundedMinutes % 60;
  return remainder > 0 ? `${hours} ч ${remainder.toString().padStart(2, "0")}` : `${hours} ч`;
}

function formatWatchSleepWindow(summary: DeviceHealthDailySummary | null) {
  const sleep = summary?.sleep;

  if (sleep?.startTime && sleep.endTime) {
    return `${formatTime(sleep.startTime)}-${formatTime(sleep.endTime)}`;
  }

  return hasDeviceSleepData(summary) ? formatDeviceHealthSleepDetail(summary) : "нет данных сна";
}

function getWatchSleepProgress(summary: DeviceHealthDailySummary | null) {
  const minutes = summary?.sleep?.durationMinutes;
  if (minutes === null || minutes === undefined) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((minutes / 480) * 100)));
}

function formatWatchInsightTitle(summary: DeviceHealthDailySummary | null) {
  if (!summary) {
    return "Нужна синхронизация";
  }

  const status = getDeviceHealthStatus(summary);
  return status.missing.length === 0 ? "Данные готовы" : "Данные частичные";
}

function formatWatchInsightText(summary: DeviceHealthDailySummary | null) {
  if (!summary) {
    return "Нажми синхронизацию после сна или тренировки, затем можно перенести сон и пульс в показатели готовности.";
  }

  const status = getDeviceHealthStatus(summary);
  if (status.missing.length > 0) {
    return `Не хватает: ${status.missing.join(", ")}. Недостающее лучше заполнить вручную.`;
  }

  return "Сон, пульс и активность можно использовать для готовности и разбора дня.";
}

function formatWatchSourceHint(summary: DeviceHealthDailySummary | null) {
  if (summary) {
    const directWatchConfig = isDirectWatchRuntime() ? loadDirectWatchConfig() : null;
    const displaySyncedAt = getWatchDisplaySyncedAt(summary, directWatchConfig);
    return `${formatWatchProviderLabel(summary)} · ${formatDateTime(displaySyncedAt ?? summary.syncedAt)}`;
  }

  if (isAppleHealthRuntime()) {
    return "Apple Health и разрешения iPhone";
  }

  if (isDirectWatchRuntime()) {
    return "PERFORM Sync, Auth Key и Bluetooth";
  }

  return "Health Connect и приложения здоровья";
}

function formatWatchProviderLabel(summary: DeviceHealthDailySummary | null) {
  if (summary) {
    if (summary.provider === "direct-watch") {
      return "Часы";
    }
    if (summary.provider === "apple-health") {
      return "Apple Health";
    }
    if (summary.provider === "health-connect") {
      return "Health Connect";
    }
    if (summary.provider === "huawei-health") {
      return "Huawei Health";
    }
  }

  if (isAppleHealthRuntime()) {
    return "Apple Health";
  }

  if (isDirectWatchRuntime()) {
    return "Часы";
  }

  return "Health Connect";
}

function formatWatchSourceDescription(summary: DeviceHealthDailySummary | null) {
  if (summary?.provider === "direct-watch") {
    return "PERFORM Sync читает часы напрямую. Диагностика ниже нужна только для настройки и проверки соединения.";
  }

  if (summary?.provider === "apple-health" || isAppleHealthRuntime()) {
    return "iPhone отдаёт данные через Apple Health. Если показателей нет, проверь разрешения в приложении Здоровье.";
  }

  if (summary?.provider === "health-connect") {
    return "Android читает данные через Health Connect. В диагностике видно, какой источник реально записал сон, пульс и тренировки.";
  }

  return "После первой синхронизации здесь будет видно, откуда пришли данные и что именно удалось прочитать.";
}

function renderDirectWatchDiagnostics(state: MobileAppState, date: string) {
  const diagnostic = state.directWatchDiagnostic;
  const devices = diagnostic.devices
    .slice()
    .sort((left, right) =>
      Number(Boolean(right.isLikelyWatch)) - Number(Boolean(left.isLikelyWatch)) ||
      (right.rssi ?? -999) - (left.rssi ?? -999),
    )
    .slice(0, 8);
  const inspection = diagnostic.inspection;
  const session = diagnostic.session;
  const classicProbe = diagnostic.classicProbe;
  const serviceStatus = diagnostic.serviceStatus;
  const sessionPackets = diagnostic.packets.length ? diagnostic.packets : session?.packets ?? [];
  const activeSessionDeviceId = session?.connected ? session.deviceId : null;
  const config = loadDirectWatchConfig();
  const hasAuthKey = Boolean(config.authKeyHex);
  const weatherSourceLabel = formatDirectWatchWeatherSource(config);
  const weatherFallbackCity = getDirectWatchWeatherFallbackCity(config);
  const services = inspection?.services ?? [];
  const knownServices = services
    .filter((service) => service.name && service.name !== "Unknown")
    .map((service) => service.name as string);

  return `
    <div class="device-health-diagnostics direct-watch-diagnostics">
      <div class="summary-inline-head">
        <div>
          <span>PERFORM Sync</span>
          <h3>Диагностика прямого подключения</h3>
        </div>
        <div class="direct-watch-header-actions">
          ${session?.connected ? `
            <button class="secondary-action" data-direct-watch-session-refresh type="button" ${state.isBusy ? "disabled" : ""}>
              Обновить
            </button>
            <button class="secondary-action" data-direct-watch-session-stop type="button" ${state.isBusy ? "disabled" : ""}>
              Отключить
            </button>
          ` : ""}
          <button class="secondary-action" data-direct-watch-scan type="button" ${state.isBusy ? "disabled" : ""}>
            Найти часы
          </button>
        </div>
      </div>
      <p>
        Android проверяет часы напрямую по Bluetooth: поиск, сопряжение, BLE-сервисы и чтение дневных файлов активности.
      </p>
      <details class="direct-watch-services" ${hasAuthKey ? "" : "open"}>
        <summary>Настройка PERFORM Sync</summary>
        <div class="device-health-diagnostics-grid">
          <article>
            <span>Auth Key</span>
            <strong>${escapeHtml(hasAuthKey ? "сохранён на телефоне" : "не сохранён")}</strong>
          </article>
          <article>
            <span>Выбранные часы</span>
            <strong>${escapeHtml(config.deviceName || (config.deviceId ? formatDirectWatchDeviceId(config.deviceId) : "не выбраны"))}</strong>
          </article>
          <article>
            <span>Погода</span>
            <strong>${escapeHtml(weatherSourceLabel)}</strong>
          </article>
          <article>
            <span>Сервис часов</span>
            <strong>${escapeHtml(formatDirectWatchSyncServiceStatus(serviceStatus))}</strong>
          </article>
        </div>
        <label class="wide-field">
          <span>Auth Key часов</span>
          <input data-direct-watch-auth-key inputmode="text" placeholder="32 hex-символа" type="password" autocomplete="off">
        </label>
        <label class="wide-field">
          <span>Запасной город погоды</span>
          <input data-direct-watch-weather-city inputmode="text" placeholder="если геолокация недоступна" type="text" value="${escapeHtml(weatherFallbackCity)}">
        </label>
        <div class="device-health-actions">
          <button class="secondary-action" data-direct-watch-auth-key-save type="button" ${state.isBusy ? "disabled" : ""}>
            Сохранить ключ
          </button>
          <button class="secondary-action" data-direct-watch-weather-save type="button" ${state.isBusy ? "disabled" : ""}>
            Сохранить запасной город
          </button>
          <button
            class="secondary-action"
            data-direct-watch-sync="${escapeHtml(config.deviceId || "")}"
            data-direct-watch-sync-date="${escapeHtml(date)}"
            type="button"
            ${state.isBusy || !config.deviceId || !hasAuthKey ? "disabled" : ""}
          >
            Считать выбранный день
          </button>
          <button
            class="secondary-action"
            data-direct-watch-service-sync="${escapeHtml(config.deviceId || "")}"
            type="button"
            ${state.isBusy || !config.deviceId || !hasAuthKey ? "disabled" : ""}
          >
            Запустить сервис часов
          </button>
          <button class="secondary-action" data-direct-watch-service-status type="button" ${state.isBusy ? "disabled" : ""}>
            Обновить статус
          </button>
          <button
            class="secondary-action"
            data-direct-watch-service-stop
            type="button"
            ${state.isBusy || !serviceStatus?.running ? "disabled" : ""}
          >
            Остановить сервис
          </button>
        </div>
      </details>
      ${diagnostic.scannedAt ? `<p class="muted-copy">Последний поиск: ${escapeHtml(formatDateTime(diagnostic.scannedAt))}</p>` : ""}
      ${renderDirectWatchSession(session, sessionPackets)}
      ${renderDirectWatchClassicProbe(classicProbe)}
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
                ${activeSessionDeviceId === device.id ? `
                  <span class="direct-watch-session-pill">PERFORM Sync активен</span>
                ` : `
                  <button
                    class="secondary-action"
                    data-direct-watch-session-start="${escapeHtml(device.id)}"
                    type="button"
                    ${state.isBusy || session?.connected ? "disabled" : ""}
                  >
                    Подключить Sync
                  </button>
                `}
                <button
                  class="secondary-action"
                  data-direct-watch-select="${escapeHtml(device.id)}"
                  type="button"
                  ${state.isBusy ? "disabled" : ""}
                >
                  Выбрать
                </button>
                <button
                  class="secondary-action"
                  data-direct-watch-sync="${escapeHtml(device.id)}"
                  data-direct-watch-sync-date="${escapeHtml(date)}"
                  type="button"
                  ${state.isBusy || device.bondState !== "bonded" || !hasAuthKey ? "disabled" : ""}
                >
                  Считать день
                </button>
                <button
                  class="secondary-action"
                  data-direct-watch-service-sync="${escapeHtml(device.id)}"
                  type="button"
                  ${state.isBusy || device.bondState !== "bonded" || !hasAuthKey ? "disabled" : ""}
                >
                  Обновить время
                </button>
                ${device.bondState !== "bonded" ? `
                  <button
                    class="secondary-action"
                    data-direct-watch-pair="${escapeHtml(device.id)}"
                    type="button"
                    ${state.isBusy ? "disabled" : ""}
                  >
                    Сопрячь
                  </button>
                ` : `
                  <button
                    class="secondary-action"
                    data-direct-watch-unpair="${escapeHtml(device.id)}"
                    type="button"
                    ${state.isBusy || session?.connected ? "disabled" : ""}
                  >
                    Сбросить привязку
                  </button>
                `}
                <button
                  class="secondary-action"
                  data-direct-watch-classic-probe="${escapeHtml(device.id)}"
                  type="button"
                  ${state.isBusy || session?.connected || device.bondState !== "bonded" ? "disabled" : ""}
                >
                  Проверить SPP
                </button>
                <button
                  class="secondary-action"
                  data-direct-watch-auth-probe="${escapeHtml(device.id)}"
                  type="button"
                  ${state.isBusy || session?.connected || device.bondState !== "bonded" ? "disabled" : ""}
                >
                  Проверить Auth
                </button>
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
          <div class="device-health-status ${inspection.canSubscribeHeartRate || inspection.canReadBatteryLevel || inspection.canReadDeviceInfo ? "is-connected" : "is-missing"}">
            <strong>${escapeHtml(formatDirectWatchCapabilityTitle(inspection))}</strong>
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
              <span>Живой пульс</span>
              <strong>${escapeHtml(formatDirectWatchBoolean(inspection.canSubscribeHeartRate, "можно читать", "нет доступа"))}</strong>
            </article>
            <article>
              <span>Батарея</span>
              <strong>${escapeHtml(formatDirectWatchBoolean(inspection.canReadBatteryLevel, "читается", "не читается"))}</strong>
            </article>
            <article>
              <span>Инфо часов</span>
              <strong>${escapeHtml(formatDirectWatchBoolean(inspection.canReadDeviceInfo, "читается", "не читается"))}</strong>
            </article>
            <article>
              <span>Закрытые сервисы</span>
              <strong>${escapeHtml(String(inspection.proprietaryServiceCount ?? 0))}</strong>
            </article>
            <article>
              <span>Известные сервисы</span>
              <strong>${escapeHtml(knownServices.length ? knownServices.join(", ") : "не найдены")}</strong>
            </article>
          </div>
          ${renderDirectWatchStandardReadings(inspection)}
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

function renderDirectWatchSession(
  session: MobileAppState["directWatchDiagnostic"]["session"],
  packets: MobileAppState["directWatchDiagnostic"]["packets"],
) {
  if (!session?.connected && !session?.deviceId) {
    return "";
  }

  const subscribed = session.subscribed ?? [];
  const packetItems = packets.slice(0, 6);

  return `
    <div class="direct-watch-session ${session.connected ? "is-connected" : "is-stopped"}">
      <div class="device-health-status ${session.connected ? "is-connected" : "is-missing"}">
        <strong>${escapeHtml(session.connected ? "PERFORM Sync подключен" : "PERFORM Sync отключен")}</strong>
        <span>${escapeHtml(formatDirectWatchSessionSummary(session))}</span>
      </div>
      <div class="device-health-diagnostics-grid">
        <article>
          <span>Часы</span>
          <strong>${escapeHtml(session.deviceName || session.deviceId || "не выбраны")}</strong>
        </article>
        <article>
          <span>Подписки</span>
          <strong>${escapeHtml(`${session.subscribedCount ?? 0}/${subscribed.length}`)}</strong>
        </article>
        <article>
          <span>Пакеты</span>
          <strong>${escapeHtml(String(session.packetCount ?? packetItems.length))}</strong>
        </article>
        <article>
          <span>Сервисов</span>
          <strong>${escapeHtml(String(session.serviceCount ?? 0))}</strong>
        </article>
      </div>
      ${subscribed.length ? `
        <div class="direct-watch-reading-list">
          ${subscribed.slice(0, 6).map((item) => `
            <article>
              <span>${escapeHtml(item.name || item.uuid)}</span>
              <strong>${escapeHtml(formatDirectWatchSubscriptionStatus(item.status, item.error))}</strong>
            </article>
          `).join("")}
        </div>
      ` : ""}
      ${packetItems.length ? `
        <div class="direct-watch-packet-list">
          ${packetItems.map((packet) => `
            <article>
              <div>
                <strong>${escapeHtml(packet.name || packet.characteristicUuid || "BLE packet")}</strong>
                <span>${escapeHtml(packet.receivedAt ? formatDateTime(packet.receivedAt) : "только что")} · ${escapeHtml(String(packet.byteLength ?? 0))} байт</span>
              </div>
              <code>${escapeHtml(packet.rawHex || "empty")}</code>
            </article>
          `).join("")}
        </div>
      ` : `
        <p class="muted-copy">Сессия открыта. Если часы отправят данные, здесь появятся сырые пакеты для разбора протокола.</p>
      `}
    </div>
  `;
}

function renderDirectWatchClassicProbe(
  probe: MobileAppState["directWatchDiagnostic"]["classicProbe"],
) {
  if (!probe) {
    return "";
  }

  const packets = probe.packets ?? [];
  const statusClass = probe.connected && !probe.error ? "is-connected" : "is-missing";

  return `
    <div class="direct-watch-session ${probe.connected ? "is-connected" : "is-stopped"}">
      <div class="device-health-status ${statusClass}">
        <strong>${escapeHtml(formatDirectWatchClassicProbeTitle(probe))}</strong>
        <span>${escapeHtml(formatDirectWatchClassicProbeSummary(probe))}</span>
      </div>
      <div class="device-health-diagnostics-grid">
        <article>
          <span>Канал</span>
          <strong>${escapeHtml(probe.detectedProtocol || "не определён")}</strong>
        </article>
        <article>
          <span>Сопряжение</span>
          <strong>${escapeHtml(formatDirectWatchBondState(probe.bondState))}</strong>
        </article>
        <article>
          <span>Запрос версии</span>
          <strong>${escapeHtml(probe.sentVersionRequest ? "отправлен" : "не отправлен")}</strong>
        </article>
        <article>
          <span>Auth step 1</span>
          <strong>${escapeHtml(probe.sentAuthStep1 ? "отправлен" : probe.sentSessionConfig ? "session v2" : "не отправлен")}</strong>
        </article>
        <article>
          <span>Auth step 2</span>
          <strong>${escapeHtml(probe.sentAuthStep2 ? "отправлен" : "ожидает ключ")}</strong>
        </article>
        <article>
          <span>Проба данных</span>
          <strong>${escapeHtml(probe.sentPostAuthProbe ? "отправлена" : "не запускалась")}</strong>
        </article>
        <article>
          <span>Файл активности</span>
          <strong>${escapeHtml(probe.sentActivityFileProbe ? `запрошено ${probe.activityFileProbeCount ?? 0}` : "не запрашивался")}</strong>
        </article>
        <article>
          <span>Пакеты</span>
          <strong>${escapeHtml(String(probe.packetCount ?? packets.length))}</strong>
        </article>
        <article>
          <span>Ответ Auth</span>
          <strong>${escapeHtml(probe.authStage === "watch-nonce" ? "watch nonce" : probe.authStage || "нет")}</strong>
        </article>
      </div>
      ${packets.length ? `
        <div class="direct-watch-packet-list">
          ${packets.slice(0, 4).map((packet) => `
            <article>
              <div>
                <strong>${escapeHtml(packet.receivedAt ? formatDateTime(packet.receivedAt) : "SPP packet")}</strong>
                <span>${escapeHtml(String(packet.byteLength ?? 0))} байт</span>
              </div>
              <code>${escapeHtml(packet.rawHex || "empty")}</code>
            </article>
          `).join("")}
        </div>
      ` : `
        <p class="muted-copy">Classic/SPP открылся без входящих пакетов. Если это повторится, часы могут ждать авторизацию или канал занят другим приложением.</p>
      `}
      ${probe.decryptedPackets?.length ? `
        <div class="direct-watch-packet-list">
          ${probe.decryptedPackets.slice(0, 10).map((packet) => `
            <article>
              <div>
                <strong>${escapeHtml(packet.label || `command ${packet.commandType ?? "-"}:${packet.commandSubtype ?? "-"}`)}</strong>
                <span>${escapeHtml(formatDirectWatchDecryptedPacketSummary(packet))}</span>
              </div>
              <code>${escapeHtml(packet.rawHex || "empty")}</code>
            </article>
          `).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function formatDirectWatchDecryptedPacketSummary(packet: DirectWatchDecryptedPacket) {
  const details = [
    typeof packet.batteryLevel === "number" ? `батарея ${packet.batteryLevel}%` : null,
    typeof packet.isWorn === "boolean" ? `на руке: ${formatDirectWatchBoolean(packet.isWorn, "да", "нет")}` : null,
    typeof packet.isCharging === "boolean" ? `зарядка: ${formatDirectWatchBoolean(packet.isCharging, "да", "нет")}` : null,
    packet.deviceModel ? `модель ${packet.deviceModel}` : null,
    packet.firmware ? `прошивка ${packet.firmware}` : null,
    typeof packet.heartRateInterval === "number" ? `пульс: интервал ${packet.heartRateInterval}` : null,
    typeof packet.heartRateDisabled === "boolean" ? `пульс выкл: ${formatDirectWatchBoolean(packet.heartRateDisabled, "да", "нет")}` : null,
    typeof packet.steps === "number" ? `шаги ${packet.steps}` : null,
    typeof packet.heartRate === "number" ? `пульс ${packet.heartRate}` : null,
    typeof packet.activityFileCount === "number" ? `файлов активности ${packet.activityFileCount}` : null,
    typeof packet.activityChunkNumber === "number" && typeof packet.activityChunkTotal === "number"
      ? `часть файла ${packet.activityChunkNumber}/${packet.activityChunkTotal}`
      : null,
    packet.activityFileKind || packet.activityFile?.kind || null,
    typeof packet.activitySampleCount === "number" ? `точек ${packet.activitySampleCount}` : null,
    typeof packet.activitySteps === "number" ? `шаги ${packet.activitySteps}` : null,
    typeof packet.activityCalories === "number" ? `ккал ${packet.activityCalories}` : null,
    typeof packet.activityHeartRateResting === "number" ? `пульс покоя ${packet.activityHeartRateResting}` : null,
    typeof packet.activityHeartRateAvg === "number" ? `пульс ср. ${packet.activityHeartRateAvg}` : null,
    typeof packet.activitySpo2Avg === "number" ? `SpO2 ср. ${packet.activitySpo2Avg}` : null,
    typeof packet.activityStressAvg === "number" ? `стресс ср. ${packet.activityStressAvg}` : null,
    typeof packet.activityTrainingLoadDay === "number" ? `нагрузка ${packet.activityTrainingLoadDay}` : null,
    typeof packet.activityVitality === "number" ? `Vitality ${packet.activityVitality}` : null,
    typeof packet.activityFileCrcValid === "boolean"
      ? `CRC ${packet.activityFileCrcValid ? "ок" : "ошибка"}`
      : null,
    typeof packet.activityChunkPayloadBytes === "number" ? `данных ${packet.activityChunkPayloadBytes} байт` : null,
  ].filter(Boolean);

  const command = `command ${packet.commandType ?? "-"}:${packet.commandSubtype ?? "-"}`;
  return `${details.length ? details.join(" · ") : `${packet.byteLength ?? 0} байт`} · ${command}`;
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

function formatDirectWatchInspectionMessage(
  inspection: NonNullable<MobileAppState["directWatchDiagnostic"]["inspection"]>,
) {
  if (inspection.canSubscribeHeartRate) {
    return "Диагностика готова: часы отдают стандартный канал живого пульса. Следующий шаг — тестовое чтение пульса и запись в PERFORM Sync.";
  }

  if (inspection.canReadBatteryLevel || inspection.canReadDeviceInfo) {
    return "Диагностика готова: часы отвечают по Bluetooth, но пульс/сон могут быть закрыты протоколом Xiaomi.";
  }

  return "Часы подключились, но стандартные данные здоровья не найдены. Скорее всего, основные показатели закрыты протоколом Xiaomi.";
}

function formatDirectWatchSessionMessage(
  session: NonNullable<MobileAppState["directWatchDiagnostic"]["session"]>,
) {
  if (!session.connected) {
    return "PERFORM Sync не удержал подключение к часам. Повторите, когда часы в режиме сопряжения и рядом с телефоном.";
  }

  if ((session.subscribedCount ?? 0) > 0) {
    return "PERFORM Sync подключен: подписки открыты. Теперь ждём сырые пакеты от часов для разбора протокола.";
  }

  return "PERFORM Sync подключился к часам, но Android не смог включить уведомления BLE-характеристик.";
}

function formatDirectWatchClassicProbeMessage(
  probe: NonNullable<MobileAppState["directWatchDiagnostic"]["classicProbe"]>,
) {
  if (probe.error) {
    return "Classic/SPP проверен, но канал не открылся. Подробность показана в диагностике.";
  }

  if (probe.detectedProtocol === "spp-v1" || probe.detectedProtocol === "spp-v2") {
    if (probe.sentPostAuthProbe && probe.decryptedPackets?.length) {
      return "Auth прошёл, зашифрованный запрос после авторизации расшифрован. Можно переходить к чтению health-данных.";
    }
    if (probe.authStage === "authenticated") {
      return "Ключ принят: Xiaomi Auth прошёл. Следующий шаг — пробное чтение данных здоровья.";
    }
    if (probe.authStage === "watch-nonce") {
      return probe.authKeyStatus === "valid"
        ? "Ключ совпал с ответом часов. Следующий шаг — завершить авторизацию."
        : "Часы отдали первый ответ Xiaomi Auth. Следующий шаг — проверить настоящий Auth Key.";
    }
    return "Classic/SPP канал часов отвечает. Следующий шаг — авторизация через Auth Key.";
  }

  if (probe.connected) {
    return "Classic/SPP сокет открылся, но часы не вернули версию протокола.";
  }

  return "Classic/SPP канал не подтвердился.";
}

function hasDirectWatchServiceSyncSignal(result: DirectWatchServiceSyncResult | null | undefined) {
  return Boolean(result && (
    result.sentServiceSync ||
    result.sentTime ||
    result.sentPhoneLocation ||
    result.sentWeatherPrefs ||
    result.sentWeatherLocation ||
    result.sentWeatherCurrent ||
    result.sentWeatherDaily ||
    result.sentWeatherHourly ||
    result.sentActivityFileProbe
  ));
}

function isDirectWatchSyncAlreadyRunningMessage(value: unknown) {
  const message = value instanceof Error
    ? value.message
    : typeof value === "string"
      ? value
      : null;

  if (!message) {
    return false;
  }

  const normalized = message.toLocaleLowerCase("ru-RU");
  return normalized.includes("уже синхронизирует") ||
    normalized.includes("уже выполняется") ||
    normalized.includes("текущий bluetooth") ||
    normalized.includes("bluetooth-обмен") ||
    normalized.includes("sync-in-progress");
}

function isDirectWatchSyncAlreadyRunningResult(result: DirectWatchServiceSyncResult | null | undefined) {
  return isDirectWatchSyncAlreadyRunningMessage(result?.error);
}

function isDirectWatchServiceSyncSuccessful(result: DirectWatchServiceSyncResult | null | undefined) {
  return Boolean(
    result &&
      result.authKeyStatus === "valid" &&
      !result.error &&
      !result.authKeyError &&
      hasDirectWatchServiceSyncSignal(result),
  );
}

function formatDirectWatchServiceSyncMessage(
  result: DirectWatchServiceSyncResult,
  weatherLocation: string | null,
  weatherError: string | null,
) {
  const hasUsefulSync = hasDirectWatchServiceSyncSignal(result);
  const weatherLocationMessage = weatherLocation === "Геолокация телефона"
    ? "Погода обновлена по геолокации телефона."
    : weatherLocation
      ? `Погода обновлена для ${weatherLocation}.`
      : "";
  const baseMessage = hasUsefulSync
    ? `Часы синхронизированы.${weatherLocationMessage ? ` ${weatherLocationMessage}` : ""}`
    : "Часы подключились, но данные не обновились.";
  const bridgeMessage = result.keptBluetoothBridge
    ? `Сервис активен до ${result.bridgeUntil ? formatDateTime(result.bridgeUntil) : "окончания окна синхронизации"}.`
    : "";
  const weatherMessage = weatherError ? `Погода не обновилась: ${weatherError}.` : "";
  return [baseMessage, bridgeMessage, weatherMessage].filter(Boolean).join(" ");
}

type DirectWatchActivitySyncStatus = "error" | "ok" | "warning";

interface DirectWatchActivitySyncDiagnostic {
  dailyFileCount: number;
  fileCount: number;
  message: string;
  sportsFileCount: number;
  status: DirectWatchActivitySyncStatus;
  syncedAt: string;
  workoutCount: number;
}

function buildDirectWatchActivitySyncDiagnostic(
  payload: {
    summary: DeviceHealthDailySummaryPayload;
    workouts: DeviceWorkoutsSyncPayload;
  } | null,
  probe: DirectWatchServiceSyncResult | null,
  error?: unknown,
): DirectWatchActivitySyncDiagnostic {
  const requests = probe?.activityFileProbeRequests ?? [];
  const files = requests
    .map((request) => request.activityFile ?? request)
    .filter((file): file is NonNullable<typeof file> => Boolean(file));
  const fileCount = requests.length || files.length;
  const dailyFileCount = files.filter((file) => file.type === 0).length;
  const sportsFileCount = files.filter(isDirectWatchSportsActivityFile).length;
  const completedCount = requests.filter((request) => request.status === "complete").length;
  const failedCount = requests.filter((request) => request.status && request.status !== "complete").length;
  const crcErrorCount = requests.filter((request) => request.crcValid === false).length;
  const unparsedSportsCount = requests.filter((request) =>
    isDirectWatchSportsActivityFile(request.activityFile ?? request) &&
    request.status === "complete" &&
    request.parsed === false
  ).length;
  const workoutCount = payload?.workouts.workouts.length ?? 0;
  const metricLabels = payload ? getDirectWatchSyncedMetricLabels(payload) : [];
  const syncedAt = probe?.syncedAt ?? new Date().toISOString();
  const errorMessage = error instanceof Error ? error.message : typeof error === "string" ? error : null;

  if (!payload && errorMessage) {
    return {
      dailyFileCount,
      fileCount,
      message: fileCount > 0
        ? `Файлы активности получены (${fileCount}), но день не собрался: ${errorMessage}`
        : `Синхронизация не завершилась: ${errorMessage}`,
      sportsFileCount,
      status: "error",
      syncedAt,
      workoutCount,
    };
  }

  if (crcErrorCount > 0 || failedCount > 0) {
    return {
      dailyFileCount,
      fileCount,
      message: `Часы ответили, но есть ошибки чтения: ${failedCount} не завершено, ${crcErrorCount} с ошибкой CRC. Повторите синхронизацию рядом с часами.`,
      sportsFileCount,
      status: "warning",
      syncedAt,
      workoutCount,
    };
  }

  if (workoutCount > 0) {
    return {
      dailyFileCount,
      fileCount,
      message: `Тренировки: ${workoutCount}. Файлы: ${fileCount || completedCount}, SPORTS: ${sportsFileCount}.`,
      sportsFileCount,
      status: "ok",
      syncedAt,
      workoutCount,
    };
  }

  if (sportsFileCount > 0) {
    return {
      dailyFileCount,
      fileCount,
      message: unparsedSportsCount > 0
        ? `SPORTS-файлы пришли (${sportsFileCount}), но часть не распознана. Нужно проверить parser этого типа тренировки.`
        : `SPORTS-файлы пришли (${sportsFileCount}), но тренировка не сохранилась. Нужно проверить сопоставление summary/details.`,
      sportsFileCount,
      status: "warning",
      syncedAt,
      workoutCount,
    };
  }

  if (dailyFileCount > 0 || metricLabels.length > 0) {
    return {
      dailyFileCount,
      fileCount,
      message: "Дневные данные пришли, но SPORTS-файлов нет. Если тренировка есть на часах, ее могло уже считать другое приложение.",
      sportsFileCount,
      status: "warning",
      syncedAt,
      workoutCount,
    };
  }

  return {
    dailyFileCount,
    fileCount,
    message: "Часы подключились, но activity-файлы за выбранный день не пришли. Проверьте дату, заряд часов и что другое приложение не забрало данные раньше.",
    sportsFileCount,
    status: "warning",
    syncedAt,
    workoutCount,
  };
}

function isDirectWatchSportsActivityFile(file: { type?: number | null } | null | undefined) {
  return file?.type === 1;
}

function getDirectWatchSyncedMetricLabels(payload: {
  summary: DeviceHealthDailySummaryPayload;
  workouts: DeviceWorkoutsSyncPayload;
}) {
  const metricLabels = [
    payload.summary.heartRate ? "пульс" : null,
    payload.summary.sleep ? "сон" : null,
    payload.summary.oxygenSaturation ? "SpO2" : null,
    payload.summary.samples?.some((sample) => sample.metric === "stress") ? "стресс" : null,
  ].filter((item): item is string => Boolean(item));
  return metricLabels;
}

function formatDirectWatchDailySyncResultMessage(
  payload: {
    summary: DeviceHealthDailySummaryPayload;
    workouts: DeviceWorkoutsSyncPayload;
  },
  probe?: DirectWatchServiceSyncResult | null,
) {
  const metricLabels = getDirectWatchSyncedMetricLabels(payload);
  const workoutsCount = payload.workouts.workouts.length;
  const diagnostic = buildDirectWatchActivitySyncDiagnostic(payload, probe ?? null);
  const workoutLabel = workoutsCount > 0
    ? `${workoutsCount} ${formatRussianCount(workoutsCount, "тренировка", "тренировки", "тренировок")}`
    : diagnostic.message;

  return [
    "Данные часов обновлены.",
    metricLabels.length ? `Показатели: ${metricLabels.join(", ")}.` : "Показатели сохранены.",
    workoutLabel,
  ].join(" ");
}

function shouldFetchDirectWatchSleep(data: MobileDataSnapshot, entryDate: string) {
  return !data.deviceHealthSummaries.some((summary) =>
    summary.entryDate === entryDate && hasMeaningfulWatchSleep(summary.sleep)
  );
}

function hasMeaningfulWatchSleep(sleep: DeviceHealthDailySummary["sleep"] | DeviceHealthDailySummaryPayload["sleep"]) {
  if (!sleep) {
    return false;
  }

  const stageTotal = getDeviceHealthSleepStageTotalMinutes(sleep);
  const windowDuration = getDeviceHealthSleepWindowDurationMinutes(sleep);
  const duration = sleep.durationMinutes ?? null;

  return [duration, stageTotal, windowDuration].some((value) =>
    typeof value === "number" &&
      Number.isFinite(value) &&
      value >= WATCH_SLEEP_MIN_MEANINGFUL_MINUTES
  );
}

function isPositiveNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function formatRussianCount(count: number, one: string, few: string, many: string) {
  const mod10 = Math.abs(count) % 10;
  const mod100 = Math.abs(count) % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return one;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return few;
  }

  return many;
}

function formatDirectWatchSyncServiceStatus(
  status: MobileAppState["directWatchDiagnostic"]["serviceStatus"],
) {
  if (!status?.running) {
    return "не активен";
  }

  return status.bridgeUntil
    ? `активен до ${formatDateTime(status.bridgeUntil)}`
    : "активен";
}

function getDirectWatchServiceStatusKind(
  config: DirectWatchLocalConfig,
  status: MobileAppState["directWatchDiagnostic"]["serviceStatus"],
) {
  if (!config.deviceId || !config.authKeyHex) {
    return "setup";
  }

  if (isDirectWatchServiceRunning(config, status)) {
    return "running";
  }

  return config.lastServiceStatus === "error" ? "error" : "stopped";
}

function isDirectWatchServiceRunning(
  config: DirectWatchLocalConfig,
  status: MobileAppState["directWatchDiagnostic"]["serviceStatus"],
) {
  if (status) {
    return status.running === true;
  }

  return config.lastServiceStatus === "running" && isFutureDate(config.lastServiceBridgeUntil);
}

function formatDirectWatchServiceStatusLabel(
  config: DirectWatchLocalConfig,
  status: MobileAppState["directWatchDiagnostic"]["serviceStatus"],
) {
  if (!config.deviceId) {
    return "часы не выбраны";
  }

  if (!config.authKeyHex) {
    return "нужен ключ";
  }

  if (isDirectWatchServiceRunning(config, status)) {
    return "подключено";
  }

  if (config.lastServiceStatus === "error") {
    return formatDirectWatchUserError(config.lastServiceError)?.includes("Bluetooth занят")
      ? "Bluetooth занят"
      : "ошибка";
  }

  return getLatestDirectWatchConfigSyncAt(config) ? "не подключено" : "ещё не запускалось";
}

function formatDirectWatchServiceRuntime(
  config: DirectWatchLocalConfig,
  status: MobileAppState["directWatchDiagnostic"]["serviceStatus"],
) {
  const bridgeUntil = status?.bridgeUntil ?? config.lastServiceBridgeUntil;

  if (isDirectWatchServiceRunning(config, status)) {
    return bridgeUntil
      ? `Bluetooth-канал активен до ${formatDateTime(bridgeUntil)}.`
      : "Bluetooth-канал активен.";
  }

  if (!config.deviceId || !config.authKeyHex) {
    return "Сначала выберите часы и сохраните Auth Key.";
  }

  if (config.lastServiceStatus === "error") {
    return "Последняя синхронизация не завершилась. Можно повторить запуск.";
  }

  return "Служба остановлена. Для времени и погоды запустите синхронизацию.";
}

function getDirectWatchHistorySyncProgress(config: DirectWatchLocalConfig) {
  const totalDays = Math.max(1, config.lastHistorySyncTotalDays ?? DIRECT_WATCH_HISTORY_SYNC_DAYS);
  const completedDays = Math.max(0, Math.min(totalDays, config.lastHistorySyncCompletedDays ?? 0));
  const successDays = Math.max(0, Math.min(totalDays, config.lastHistorySyncSuccessDays ?? 0));
  const availableDays = config.lastHistorySyncAvailableDays;
  const fileCount = config.lastHistorySyncFileCount;
  const hasAvailableDays = availableDays !== null && availableDays !== undefined && availableDays > 0;
  const inventoryLabel = availableDays !== null && availableDays !== undefined
    ? ` За ${totalDays} дней часы нашли ${availableDays} дней${fileCount ? `, файлов: ${fileCount}.` : "."}`
    : "";
  const runningLabelTotal = hasAvailableDays ? availableDays : totalDays;
  const runningLabelDone = hasAvailableDays
    ? Math.min(successDays, runningLabelTotal)
    : completedDays;
  const percent = Math.round((runningLabelDone / runningLabelTotal) * 100);

  if (config.lastHistorySyncStatus === "running") {
    return {
      buttonLabel: "Синхронизация идёт",
      detail: config.lastHistorySyncCurrentDate
        ? `Сейчас читаем ${formatDate(config.lastHistorySyncCurrentDate)}. Загружено ${runningLabelDone}/${runningLabelTotal}.${inventoryLabel}`
        : `Читаем последние ${totalDays} дней.${inventoryLabel}`,
      label: `${runningLabelDone}/${runningLabelTotal}`,
      percent: String(percent),
      statusKind: "running",
    };
  }

  if (config.lastHistorySyncStatus === "completed") {
    return {
      buttonLabel: "Обновить историю 30 дней",
      detail: config.lastHistorySyncedAt
        ? `Последняя полная загрузка: ${formatDateTime(config.lastHistorySyncedAt)}.`
        : "История за 30 дней загружена.",
      label: `${successDays || totalDays}/${totalDays}`,
      percent: "100",
      statusKind: "completed",
    };
  }

  if (config.lastHistorySyncStatus === "partial") {
    if (hasAvailableDays && successDays >= availableDays) {
      return {
        buttonLabel: "Проверить историю снова",
        detail: `Загружены все доступные дни: ${successDays}/${availableDays}.${inventoryLabel}`,
        label: `${successDays}/${availableDays}`,
        percent: "100",
        statusKind: "completed",
      };
    }

    return {
      buttonLabel: "Дочитать историю",
      detail: config.lastHistorySyncError
        ? `Загружено ${successDays}/${hasAvailableDays ? availableDays : totalDays}.${inventoryLabel} Последняя ошибка: ${config.lastHistorySyncError}`
        : `Загружено ${successDays}/${hasAvailableDays ? availableDays : totalDays}.${inventoryLabel} Можно повторить, чтобы добрать пропуски.`,
      label: `${successDays}/${hasAvailableDays ? availableDays : totalDays}`,
      percent: String(Math.round((successDays / (hasAvailableDays ? availableDays : totalDays)) * 100)),
      statusKind: "partial",
    };
  }

  if (config.lastHistorySyncStatus === "error") {
    return {
      buttonLabel: "Повторить историю 30 дней",
      detail: config.lastHistorySyncError || "Последняя попытка не получила данные с часов.",
      label: "ошибка",
      percent: "0",
      statusKind: "error",
    };
  }

  return {
    buttonLabel: "Считать историю 30 дней",
    detail: "При первом подключении загрузим сегодня, вчера и ещё 28 дней назад.",
    label: "0/30",
    percent: "0",
    statusKind: "idle",
  };
}

function isFutureDate(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) && time > Date.now();
}

function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function formatDirectWatchClassicProbeTitle(
  probe: NonNullable<MobileAppState["directWatchDiagnostic"]["classicProbe"]>,
) {
  if (probe.error) {
    return "Classic/SPP не прошёл";
  }

  if (probe.detectedProtocol === "spp-v1" || probe.detectedProtocol === "spp-v2") {
    if (probe.authStage === "authenticated") {
      return "Xiaomi Auth пройден";
    }
    return probe.authStage === "watch-nonce" ? "Xiaomi Auth отвечает" : "Classic/SPP отвечает";
  }

  if (probe.connected) {
    return "Classic/SPP подключился";
  }

  return "Classic/SPP не подключился";
}

function formatDirectWatchClassicProbeSummary(
  probe: NonNullable<MobileAppState["directWatchDiagnostic"]["classicProbe"]>,
) {
  if (probe.error) {
    return probe.error;
  }

  const parts = [
    probe.probedAt ? formatDateTime(probe.probedAt) : null,
    probe.versionHex ? `версия: ${probe.versionHex}` : null,
    probe.authKeyStatus ? `ключ: ${probe.authKeyStatus}` : null,
    probe.sentAuthStep2 ? "auth step 2 отправлен" : null,
    probe.sentPostAuthProbe ? "проба данных отправлена" : null,
    probe.watchNonceHex ? `watch nonce: ${probe.watchNonceHex}` : null,
    probe.rawHex && !probe.versionHex ? `ответ: ${probe.rawHex}` : null,
  ].filter((part): part is string => Boolean(part));

  return parts.length ? parts.join(" · ") : "ответа от часов пока нет";
}

function formatDirectWatchUnpairMessage(status: string | null | undefined) {
  if (status === "unpaired" || status === "already-unpaired") {
    return "Привязка часов сброшена. Переведите часы в режим нового сопряжения и нажмите “Найти часы”.";
  }

  if (status === "timeout") {
    return "Android не подтвердил сброс привязки. Проверьте системное окно Bluetooth или сбросьте пару в настройках телефона.";
  }

  if (status === "still-bonded") {
    return "Часы снова остались в системной паре. Для PERFORM Sync нужно удалить пару и включить режим нового сопряжения на часах.";
  }

  return "Сброс привязки запущен. Если часы не найдутся в BLE, переведите их в режим нового сопряжения.";
}

function formatDirectWatchSessionSummary(
  session: NonNullable<MobileAppState["directWatchDiagnostic"]["session"]>,
) {
  const parts = [
    session.startedAt ? `с ${formatDateTime(session.startedAt)}` : null,
    `подписок: ${session.subscribedCount ?? 0}/${session.subscribed?.length ?? 0}`,
    `пакетов: ${session.packetCount ?? 0}`,
  ].filter((part): part is string => Boolean(part));

  return parts.join(" · ");
}

function formatDirectWatchSubscriptionStatus(status: string | null | undefined, error?: string | null) {
  if (status === "subscribed") {
    return "слушаем";
  }

  if (status === "no-cccd") {
    return "нет CCCD";
  }

  if (status === "error") {
    return error || "ошибка";
  }

  return status || "ожидает";
}

function formatDirectWatchCapabilityTitle(
  inspection: NonNullable<MobileAppState["directWatchDiagnostic"]["inspection"]>,
) {
  if (inspection.canSubscribeHeartRate) {
    return "Прямой пульс доступен";
  }

  if (inspection.canReadBatteryLevel || inspection.canReadDeviceInfo) {
    return "Часы отвечают, но здоровье не открыто";
  }

  return "Стандартные данные не найдены";
}

function formatDirectWatchBoolean(value: boolean | null | undefined, yes: string, no: string) {
  return value ? yes : no;
}

function renderDirectWatchStandardReadings(
  inspection: NonNullable<MobileAppState["directWatchDiagnostic"]["inspection"]>,
) {
  const readings = inspection.standardReadings ?? [];

  if (!readings.length) {
    return "";
  }

  return `
    <div class="direct-watch-reading-list">
      ${readings.map((reading) => `
        <article>
          <span>${escapeHtml(reading.name || "BLE value")}</span>
          <strong>${escapeHtml(formatDirectWatchReadingValue(reading))}</strong>
        </article>
      `).join("")}
    </div>
  `;
}

function formatDirectWatchReadingValue(
  reading: NonNullable<NonNullable<MobileAppState["directWatchDiagnostic"]["inspection"]>["standardReadings"]>[number],
) {
  if (reading.status === "error") {
    return reading.error || "ошибка чтения";
  }

  if (reading.status === "not-readable") {
    return "есть, но чтение закрыто";
  }

  if (typeof reading.numericValue === "number") {
    return reading.kind === "battery" ? `${Math.round(reading.numericValue)}%` : String(reading.numericValue);
  }

  if (reading.textValue) {
    return reading.textValue;
  }

  if (reading.rawHex) {
    return reading.rawHex;
  }

  return "прочитано";
}

function formatDirectWatchInspectionSummary(
  inspection: NonNullable<MobileAppState["directWatchDiagnostic"]["inspection"]>,
) {
  const parts = [
    inspection.canSubscribeHeartRate ? "живой пульс открыт" : "живой пульс не открыт",
    inspection.canReadBatteryLevel ? "батарея читается" : null,
    inspection.canReadDeviceInfo ? "модель/прошивка читаются" : null,
    inspection.proprietaryServiceCount ? `закрытых сервисов: ${inspection.proprietaryServiceCount}` : null,
  ].filter((part): part is string => Boolean(part));

  return parts.join(", ");
}

function renderHealthConnectDiagnostics(
  summary: DeviceHealthDailySummary | null,
  collapsed = false,
) {
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

  const content = `
      <div class="device-health-diagnostics-grid">
        ${items.map((item) => `
          <article>
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.value)}</strong>
          </article>
        `).join("")}
      </div>
      <p>${escapeHtml(guidance)}</p>
  `;

  if (collapsed) {
    return `
      <details class="device-health-diagnostics is-collapsible">
        <summary>
          <span>Диагностика Health Connect</span>
          <small>источники, счётчики и разрешения</small>
        </summary>
        ${content}
      </details>
    `;
  }

  return `
    <div class="device-health-diagnostics">
      <div class="summary-inline-head">
        <div>
          <span>Диагностика Health Connect</span>
          <h3>Что реально отдал Health Connect</h3>
        </div>
      </div>
      ${content}
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
  return [
    "calculated-from-sleep-heart-rate",
    "estimated-from-average-heart-rate",
    "estimated-from-min-heart-rate",
    "estimated-from-sleep-heart-rate",
  ].includes(source ?? "");
}

function getDeviceHealthStatus(summary: DeviceHealthDailySummary | null) {
  if (!summary) {
    return {
      missing: ["сон", "пульс", "SpO2"],
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

  if (hasDeviceRestingHeartRateData(summary)) {
    present.push("пульс покоя");
  } else if (hasDeviceHeartRateData(summary)) {
    present.push("пульс");
  } else {
    missing.push("пульс");
  }

  if (hasDeviceOxygenSaturationData(summary)) {
    present.push("SpO2");
  } else {
    missing.push("SpO2");
  }

  if (hasDeviceWorkoutData(summary)) {
    present.push("тренировки с устройства");
  } else if (summary.workout) {
    present.push("тренировки: 0");
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
  if (!summary) {
    return "за этот день синхронизации пока нет";
  }

  const directWatchConfig = isDirectWatchRuntime() ? loadDirectWatchConfig() : null;
  const displaySyncedAt = getWatchDisplaySyncedAt(summary, directWatchConfig);
  return `последняя синхронизация: ${formatDateTime(displaySyncedAt ?? summary.syncedAt)}`;
}

function formatDeviceHealthProviderLabel(summary: DeviceHealthDailySummary | null) {
  if (summary?.provider === "direct-watch") {
    return "PERFORM Sync";
  }

  if (summary?.provider === "apple-health" || isAppleHealthRuntime()) {
    return "Apple Health";
  }

  return "Health Connect";
}

function formatDeviceHealthCardTitle(summary: DeviceHealthDailySummary | null) {
  if (summary?.provider === "direct-watch") {
    return "Данные часов";
  }

  return summary?.provider === "apple-health" || isAppleHealthRuntime()
    ? "Данные здоровья"
    : "Данные устройства";
}

function formatReadinessDeviceHealthSyncLabel(summary: DeviceHealthDailySummary | null) {
  if (!summary) {
    return "нет данных за сегодня";
  }

  const directWatchConfig = isDirectWatchRuntime() ? loadDirectWatchConfig() : null;
  const displaySyncedAt = getWatchDisplaySyncedAt(summary, directWatchConfig);
  return `обновлено ${formatDateTime(displaySyncedAt ?? summary.syncedAt)}`;
}

function formatCompactDeviceHealthStatus(summary: DeviceHealthDailySummary | null) {
  return summary ? formatReadinessDeviceHealthSyncLabel(summary) : "Нет данных часов";
}

function formatCompactDeviceHealthHint(summary: DeviceHealthDailySummary | null, canSync: boolean) {
  if (!summary) {
    return canSync
      ? isAppleHealthRuntime()
        ? "Синхронизируй после сна или тренировки. iPhone прочитает Apple Health."
        : "Синхронизируй после сна или тренировки."
      : "Спортсмен ещё не синхронизировал часы.";
  }

  const status = getDeviceHealthStatus(summary);

  if (status.present.length === 0) {
    return "Показателей мало, можно заполнить вручную.";
  }

  if (status.missing.includes("сон") || status.missing.includes("пульс")) {
    return "Главные показатели частично пришли, недостающее заполни вручную.";
  }

  return "Можно перенести сон и пульс в показатели готовности.";
}

function getDeviceSleepHoursForReadiness(summary: DeviceHealthDailySummary | null) {
  const minutes = summary?.sleep?.durationMinutes;

  if (minutes === null || minutes === undefined) {
    return null;
  }

  const hours = minutes / 60;

  if (hours < 2 || hours > 13) {
    return null;
  }

  return Math.round(hours * 2) / 2;
}

function getDeviceRestingHrForReadiness(summary: DeviceHealthDailySummary | null) {
  const restingHr = getDeviceRestingHeartRateValue(summary);

  if (restingHr === null || restingHr === undefined || restingHr < 30 || restingHr > 140) {
    return null;
  }

  return Math.round(restingHr);
}

function formatDeviceHealthActionText(summary: DeviceHealthDailySummary | null, canSync: boolean) {
  const status = getDeviceHealthStatus(summary);

  if (!summary) {
    return canSync
      ? isAppleHealthRuntime()
        ? "Нажмите синхронизацию: iPhone прочитает данные из Apple Health."
        : "Нажмите синхронизацию после сна или тренировки."
      : "Попросите спортсмена синхронизировать часы или приложение здоровья за этот день.";
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
  const value = getDeviceRestingHeartRateValue(summary);
  const isEstimated = isEstimatedRestingHrSource(source) || !hasDeviceRestingHeartRateData(summary);
  return value !== null
    ? `${isEstimated ? "≈" : ""}${formatLoadValue(value)}`
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
    return "получен напрямую";
  }

  if (restingSource === "direct-watch-resting") {
    return "получен с часов";
  }

  if (restingSource === "estimated-from-min-heart-rate") {
    const parts = [
      "≈ по минимальному пульсу",
      summary.heartRate.averageBpm !== null ? `средний ${formatLoadValue(summary.heartRate.averageBpm)}` : null,
      summary.heartRate.maxBpm !== null ? `макс ${formatLoadValue(summary.heartRate.maxBpm)}` : null,
    ].filter((item): item is string => Boolean(item));

    return parts.join(" · ");
  }

  if (restingSource === "estimated-from-average-heart-rate") {
    const parts = [
      "≈ по среднему пульсу",
      summary.heartRate.minBpm !== null ? `мин ${formatLoadValue(summary.heartRate.minBpm)}` : null,
      summary.heartRate.maxBpm !== null ? `макс ${formatLoadValue(summary.heartRate.maxBpm)}` : null,
    ].filter((item): item is string => Boolean(item));

    return parts.join(" · ");
  }

  if (!hasDeviceRestingHeartRateData(summary) && hasDeviceHeartRateData(summary)) {
    const parts = [
      summary.heartRate.minBpm !== null ? "≈ по минимальному пульсу" : "≈ по среднему пульсу",
      summary.heartRate.averageBpm !== null ? `средний ${formatLoadValue(summary.heartRate.averageBpm)}` : null,
      summary.heartRate.minBpm !== null ? `мин ${formatLoadValue(summary.heartRate.minBpm)}` : null,
      summary.heartRate.maxBpm !== null ? `макс ${formatLoadValue(summary.heartRate.maxBpm)}` : null,
    ].filter((item): item is string => Boolean(item));

    return parts.join(" · ");
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

function getDeviceRestingHeartRateValue(summary: DeviceHealthDailySummary | null) {
  const heartRate = summary?.heartRate;
  if (!heartRate) {
    return null;
  }

  return heartRate.restingBpm ??
    heartRate.minBpm ??
    heartRate.averageBpm ??
    null;
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
    boxing: "Бокс",
    combat: "Единоборства",
    cycling: "Велотренировка",
    dance: "Танцы",
    "elliptical": "Эллипс",
    "field-sport": "Игровая тренировка",
    freestyle: "Свободная тренировка",
    hiking: "Поход",
    hiit: "HIIT",
    "indoor-cycling": "Велотренажёр",
    "jump-rope": "Скакалка",
    "outdoor-cycling": "Велотренировка",
    "outdoor-run": "Бег",
    "outdoor-walk": "Ходьба",
    "pool-swim": "Плавание",
    rowing: "Гребля",
    running: "Бег",
    strength: "Силовая",
    static: "Статичная активность",
    treadmill: "Дорожка",
    triathlon: "Триатлон",
    "water-sport": "Водная тренировка",
    "winter-sport": "Зимняя тренировка",
    walking: "Ходьба",
    wrestling: "Борьба",
    workout: "Тренировка с устройства",
  };

  if (!type || /^exercise-\d+$/i.test(type)) {
    return "Тренировка с устройства";
  }

  return labels[type] ?? workout.workoutType;
}

function formatDeviceWorkoutTitle(workout: DeviceWorkout) {
  return `${formatDeviceWorkoutTypeLabel(workout)} · ${formatDeviceWorkoutTimeLabel(workout)}`;
}

function formatDeviceWorkoutSummary(workout: DeviceWorkout) {
  const activeCalories = getTrustedWatchWorkoutActiveCalories(workout);
  const distanceMeters = getTrustedWatchWorkoutDistanceMeters(workout);
  return [
    workout.durationMinutes !== null ? formatDeviceWorkoutDuration(workout.durationMinutes) : null,
    distanceMeters !== null && isDeviceWorkoutMetricRelevant(workout.workoutType, "distance")
      ? formatDistanceMeters(distanceMeters)
      : null,
    workout.averageHeartRateBpm !== null ? `ср. пульс ${formatLoadValue(workout.averageHeartRateBpm)}` : null,
    workout.maxHeartRateBpm !== null ? `макс ${formatLoadValue(workout.maxHeartRateBpm)}` : null,
    activeCalories !== null ? `${Math.round(activeCalories)} ккал` : null,
  ].filter((item): item is string => Boolean(item)).join(" · ");
}

function formatDeviceWorkoutOptionLabel(workout: DeviceWorkout) {
  return `${formatDeviceWorkoutTimeLabel(workout)} · ${formatDeviceWorkoutSummary(workout) || formatDeviceWorkoutTypeLabel(workout)}`;
}

function formatDeviceWorkoutTimeLabel(workout: DeviceWorkout) {
  if (workout.provider === "direct-watch" && workout.durationMinutes === null) {
    return `${formatTime(workout.startTime)} · старт`;
  }

  return formatTimeRange(workout.startTime, workout.endTime);
}

function renderWatchWorkoutParameterPanel(
  workout: DeviceWorkout,
  context: WatchWorkoutContext,
  series = buildDeviceWorkoutGraphSeries(workout, context),
) {
  const heartRateSeries = series.find((item) => item.key === "heartRate");
  const oxygenSeries = series.find((item) => item.key === "spo2");
  const stressSeries = series.find((item) => item.key === "stress");
  const metrics = deriveWatchWorkoutMetrics(workout, context);
  const canScanWorkoutSamples = series.length > 0 || workout.samples.length <= 600;
  const heartRateStats = heartRateSeries
    ? summarizeDeviceWorkoutHeartRateSeries(workout, heartRateSeries)
    : {
        avg: workout.averageHeartRateBpm,
        max: workout.maxHeartRateBpm,
        min: workout.minHeartRateBpm,
      };
  const oxygenStats = oxygenSeries
    ? summarizeWorkoutSeries(oxygenSeries.samples)
    : canScanWorkoutSamples
      ? summarizeWorkoutValues(workout.samples.map((sample) => sample.oxygenSaturationPercent))
      : summarizeWorkoutValues([readWatchWorkoutRawNumber(workout.rawPayload, "spo2Average")]);
  const stressStats = stressSeries
    ? summarizeWorkoutSeries(stressSeries.samples)
    : canScanWorkoutSamples
      ? summarizeWorkoutValues(workout.samples.map((sample) => readWatchWorkoutRawNumber(sample.rawPayload, "stress")))
      : summarizeWorkoutValues([]);
  const hasMeaningfulWorkoutStress = stressStats.avg !== null && (stressStats.max ?? 0) > 0;
  const sourceLabel = workout.provider === "direct-watch"
    ? "Данные с часов"
    : workout.sourceDevice || formatWatchProviderLabel(context.summary);
  const rawCards: WatchWorkoutMetricCard[] = [
    { label: "Старт", value: formatTime(workout.startTime), hasValue: true },
    {
      label: "Длительность",
      value: metrics.durationMinutes !== null ? formatDeviceWorkoutDuration(metrics.durationMinutes) : "нет данных",
      detail: metrics.durationDetail,
      hasValue: metrics.durationMinutes !== null,
      metric: "duration",
    },
    {
      label: "Шаги",
      value: metrics.steps !== null ? metrics.steps.toLocaleString("ru-RU") : "нет данных",
      detail: metrics.stepsDetail,
      hasValue: metrics.steps !== null,
      metric: "steps",
    },
    {
      label: "Калории",
      value: metrics.activeCalories !== null ? `${metrics.activeCaloriesPrefix}${Math.round(metrics.activeCalories)}` : "нет данных",
      detail: metrics.activeCaloriesDetail,
      hasValue: metrics.activeCalories !== null,
      metric: "calories",
    },
    {
      label: "Дистанция",
      value: metrics.distanceMeters !== null ? `${metrics.distancePrefix}${formatDistanceMeters(metrics.distanceMeters)}` : "нет данных",
      detail: metrics.distanceDetail,
      hasValue: metrics.distanceMeters !== null,
      metric: "distance",
    },
    {
      label: "Пульс",
      value: heartRateStats.avg !== null
        ? `${formatLoadValue(heartRateStats.avg)} ср.`
        : workout.averageHeartRateBpm !== null
          ? `${formatLoadValue(workout.averageHeartRateBpm)} ср.`
          : "-",
      detail: heartRateStats.min !== null && heartRateStats.max !== null
        ? `${formatLoadValue(heartRateStats.min)}-${formatLoadValue(heartRateStats.max)}`
        : workout.minHeartRateBpm !== null && workout.maxHeartRateBpm !== null
        ? `${formatLoadValue(workout.minHeartRateBpm)}-${formatLoadValue(workout.maxHeartRateBpm)}`
        : undefined,
      hasValue: heartRateStats.avg !== null || workout.averageHeartRateBpm !== null,
      metric: "heartRate",
    },
    {
      label: "SpO2",
      value: oxygenStats.avg !== null ? `${formatLoadValue(oxygenStats.avg)}%` : "-",
      detail: oxygenStats.min !== null && oxygenStats.max !== null
        ? `${formatLoadValue(oxygenStats.min)}-${formatLoadValue(oxygenStats.max)}%`
        : undefined,
      hasValue: oxygenStats.avg !== null,
    },
    {
      label: "Стресс",
      value: hasMeaningfulWorkoutStress ? formatLoadValue(stressStats.avg) : "-",
      detail: hasMeaningfulWorkoutStress && stressStats.min !== null && stressStats.max !== null
        ? `${formatLoadValue(stressStats.min)}-${formatLoadValue(stressStats.max)}`
        : undefined,
      hasValue: hasMeaningfulWorkoutStress,
    },
    ...buildWatchWorkoutExtendedMetricCards(workout),
  ];
  const cards = rawCards.filter((card) => shouldRenderWatchWorkoutMetricCard(workout, card.metric, card.hasValue ?? false));

  return `
    <section class="watch-workout-parameter-panel">
      <div class="watch-workout-parameter-head">
        <span>${escapeHtml(sourceLabel)}</span>
        <strong>${escapeHtml(formatDeviceWorkoutTimeLabel(workout))}</strong>
      </div>
      <div class="watch-workout-parameter-grid">
        ${cards.map((card) => `
          <article>
            <span>${escapeHtml(card.label)}</span>
            <strong>${escapeHtml(card.value)}</strong>
            ${card.detail ? `<small>${escapeHtml(card.detail)}</small>` : ""}
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function buildWatchWorkoutExtendedMetricCards(workout: DeviceWorkout): WatchWorkoutMetricCard[] {
  const summary = readWatchWorkoutSummaryRawPayload(workout);
  const summaryDistanceMeters = readDeviceHealthRawNumber(summary ?? {}, "distanceMeters") ?? workout.distanceMeters;
  const summaryDurationMinutes = readDeviceHealthRawNumber(summary ?? {}, "durationMinutes") ?? workout.durationMinutes;
  const paceAvg = readDeviceHealthRawNumber(summary ?? {}, "paceAvgSecondsPerKm") ??
    deriveWatchWorkoutPaceSecondsPerKm(summaryDistanceMeters, summaryDurationMinutes);
  const speedAvg = readDeviceHealthRawNumber(summary ?? {}, "speedAvgKmh") ??
    deriveWatchWorkoutSpeedKmh(summaryDistanceMeters, summaryDurationMinutes);
  const cadenceAvg = readDeviceHealthRawNumber(summary ?? {}, "cadenceAvg") ??
    readDeviceHealthRawNumber(summary ?? {}, "stepRateAvg");
  const strokes = readDeviceHealthRawNumber(summary ?? {}, "strokes");
  const strokeRateAvg = readDeviceHealthRawNumber(summary ?? {}, "strokeRateAvg");
  const jumps = readDeviceHealthRawNumber(summary ?? {}, "jumps");
  const jumpRateAvg = readDeviceHealthRawNumber(summary ?? {}, "jumpRateAvg");
  const laps = readDeviceHealthRawNumber(summary ?? {}, "laps");
  const swolfAvg = readDeviceHealthRawNumber(summary ?? {}, "swolfAvg");
  const elevationGain = readDeviceHealthRawNumber(summary ?? {}, "elevationGainMeters");
  const workoutLoad = readPositiveDeviceHealthRawNumber(summary ?? {}, "workoutLoad");
  const trainingEffectAerobic = readPositiveDeviceHealthRawNumber(summary ?? {}, "trainingEffectAerobic");
  const trainingEffectAnaerobic = readPositiveDeviceHealthRawNumber(summary ?? {}, "trainingEffectAnaerobic");
  const vo2Max = readPositiveDeviceHealthRawNumber(summary ?? {}, "vo2Max");

  const cards: Array<WatchWorkoutMetricCard | null> = [
    paceAvg !== null ? {
      hasValue: true,
      label: "Темп",
      metric: "pace",
      value: formatPaceSeconds(paceAvg),
    } : null,
    speedAvg !== null ? {
      hasValue: true,
      label: "Скорость",
      metric: "speed",
      value: `${speedAvg.toFixed(1)} км/ч`,
    } : null,
    cadenceAvg !== null ? {
      hasValue: true,
      label: "Каденс",
      metric: "cadence",
      value: `${Math.round(cadenceAvg)} spm`,
    } : null,
    strokes !== null ? {
      hasValue: true,
      label: "Гребки",
      metric: "strokes",
      value: Math.round(strokes).toLocaleString("ru-RU"),
    } : null,
    strokeRateAvg !== null ? {
      hasValue: true,
      label: "Частота гребков",
      metric: "strokeRate",
      value: `${Math.round(strokeRateAvg)}/мин`,
    } : null,
    jumps !== null ? {
      hasValue: true,
      label: "Прыжки",
      metric: "jumps",
      value: Math.round(jumps).toLocaleString("ru-RU"),
    } : null,
    jumpRateAvg !== null ? {
      hasValue: true,
      label: "Частота прыжков",
      metric: "cadence",
      value: `${Math.round(jumpRateAvg)}/мин`,
    } : null,
    laps !== null ? {
      hasValue: true,
      label: "Дорожки",
      metric: "laps",
      value: Math.round(laps).toLocaleString("ru-RU"),
    } : null,
    swolfAvg !== null ? {
      hasValue: true,
      label: "SWOLF",
      metric: "swolf",
      value: Math.round(swolfAvg).toLocaleString("ru-RU"),
    } : null,
    elevationGain !== null ? {
      hasValue: true,
      label: "Набор",
      metric: "elevation",
      value: `${Math.round(elevationGain)} м`,
    } : null,
    workoutLoad !== null ? {
      hasValue: true,
      label: "Нагрузка",
      value: Math.round(workoutLoad).toLocaleString("ru-RU"),
    } : null,
    trainingEffectAerobic !== null || trainingEffectAnaerobic !== null ? {
      detail: [
        trainingEffectAerobic !== null ? `аэр ${trainingEffectAerobic.toFixed(1)}` : null,
        trainingEffectAnaerobic !== null ? `анаэр ${trainingEffectAnaerobic.toFixed(1)}` : null,
      ].filter((item): item is string => Boolean(item)).join(" · "),
      hasValue: true,
      label: "Эффект",
      value: trainingEffectAerobic !== null ? trainingEffectAerobic.toFixed(1) : trainingEffectAnaerobic?.toFixed(1) ?? "-",
    } : null,
    vo2Max !== null ? {
      hasValue: true,
      label: "VO2 max",
      value: Math.round(vo2Max).toString(),
    } : null,
  ];

  return cards.filter((item): item is WatchWorkoutMetricCard => Boolean(item));
}

function readPositiveDeviceHealthRawNumber(rawPayload: Record<string, unknown>, key: string) {
  const value = readDeviceHealthRawNumber(rawPayload, key);
  return value !== null && value > 0 ? value : null;
}

function deriveWatchWorkoutSpeedKmh(
  distanceMeters: number | null | undefined,
  durationMinutes: number | null | undefined,
) {
  if (
    typeof distanceMeters !== "number" ||
    typeof durationMinutes !== "number" ||
    !Number.isFinite(distanceMeters) ||
    !Number.isFinite(durationMinutes) ||
    distanceMeters <= 0 ||
    durationMinutes <= 0
  ) {
    return null;
  }

  const speedKmh = distanceMeters / 1000 / (durationMinutes / 60);
  return speedKmh > 0 && speedKmh <= 80 ? speedKmh : null;
}

function deriveWatchWorkoutPaceSecondsPerKm(
  distanceMeters: number | null | undefined,
  durationMinutes: number | null | undefined,
) {
  if (
    typeof distanceMeters !== "number" ||
    typeof durationMinutes !== "number" ||
    !Number.isFinite(distanceMeters) ||
    !Number.isFinite(durationMinutes) ||
    distanceMeters <= 0 ||
    durationMinutes <= 0
  ) {
    return null;
  }

  const paceSeconds = Math.round((durationMinutes * 60) / (distanceMeters / 1000));
  return paceSeconds >= 60 && paceSeconds <= 7200 ? paceSeconds : null;
}

function shouldRenderWatchWorkoutMetricCard(
  workout: DeviceWorkout,
  metric: DeviceWorkoutMetricKey | undefined,
  hasValue: boolean,
) {
  if (!metric) {
    return hasValue;
  }

  const expectation = getDeviceWorkoutMetricExpectation(workout.workoutType, metric);
  return expectation === "expected" || hasValue && expectation === "optional";
}

function summarizeWorkoutSeries(samples: { value: number }[]) {
  return summarizeWorkoutValues(samples.map((sample) => sample.value));
}

function summarizeDeviceWorkoutHeartRateSeries(workout: DeviceWorkout, series: DeviceWorkoutGraphSeries) {
  return series.source === "summary"
    ? getDeviceWorkoutSummaryHeartRateStats(workout)
    : summarizeWorkoutSeries(series.samples);
}

function summarizeWorkoutValues(values: Array<number | null | undefined>) {
  let count = 0;
  let max = Number.NEGATIVE_INFINITY;
  let min = Number.POSITIVE_INFINITY;
  let sum = 0;

  for (const value of values) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      continue;
    }
    count += 1;
    sum += value;
    if (value > max) {
      max = value;
    }
    if (value < min) {
      min = value;
    }
  }

  if (count === 0) {
    return { avg: null, max: null, min: null };
  }

  return {
    avg: Math.round(sum / count),
    max,
    min,
  };
}

function hasWorkoutSummaryHeartRate(workout: DeviceWorkout) {
  const stats = getDeviceWorkoutSummaryHeartRateStats(workout);
  return stats.avg !== null || stats.min !== null || stats.max !== null;
}

function getDeviceWorkoutSummaryHeartRateStats(workout: DeviceWorkout) {
  const rawSamples = readDeviceWorkoutSummaryHeartRateSamples(workout);
  const averageFromRaw = rawSamples[0] ?? null;
  const minFromRaw = rawSamples[1] ?? null;
  const maxFromRaw = rawSamples[2] ?? null;

  return {
    avg: normalizeWorkoutHeartRateBpm(workout.averageHeartRateBpm) ?? averageFromRaw,
    max: normalizeWorkoutHeartRateBpm(workout.maxHeartRateBpm) ?? maxFromRaw,
    min: normalizeWorkoutHeartRateBpm(workout.minHeartRateBpm) ?? minFromRaw,
  };
}

function readDeviceWorkoutSummaryHeartRateSamples(workout: DeviceWorkout) {
  const value = workout.rawPayload?.summaryHeartRateSamples;
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => typeof item === "number" && Number.isFinite(item) ? item : null)
    .filter((item): item is number => item !== null && isPlausibleWorkoutHeartRateBpm(item));
}

function buildDeviceWorkoutSummaryHeartRateSamples(workout: DeviceWorkout): { sampleTime: string; value: number }[] {
  const stats = getDeviceWorkoutSummaryHeartRateStats(workout);
  if (stats.avg === null && stats.min === null && stats.max === null) {
    return [];
  }

  const start = getDeviceWorkoutGraphTime(workout.startTime);
  const end = getDeviceWorkoutGraphTime(workout.endTime);
  if (start === null || end === null || end <= start) {
    const value = stats.avg ?? stats.min ?? stats.max;
    return value !== null ? [{ sampleTime: workout.startTime, value }] : [];
  }

  const avg = stats.avg ?? stats.min ?? stats.max;
  const min = stats.min ?? avg;
  const max = stats.max ?? avg;
  if (avg === null || min === null || max === null) {
    return [];
  }

  const middle = start + (end - start) / 2;
  const midValue = Math.max(min, Math.min(max, avg * 3 - min - max));
  const points = [
    { sampleTime: new Date(start).toISOString(), value: min },
    { sampleTime: new Date(middle).toISOString(), value: midValue },
    { sampleTime: new Date(end).toISOString(), value: max },
  ];

  return points;
}

interface WatchWorkoutDerivedMetrics {
  activeCalories: number | null;
  activeCaloriesDetail?: string;
  activeCaloriesPrefix: string;
  distanceDetail?: string;
  distanceMeters: number | null;
  distancePrefix: string;
  durationDetail?: string;
  durationMinutes: number | null;
  steps: number | null;
  stepsDetail?: string;
}

interface WatchWorkoutMetricCard {
  detail?: string;
  hasValue?: boolean;
  label: string;
  metric?: DeviceWorkoutMetricKey;
  value: string;
}

function deriveWatchWorkoutMetrics(
  workout: DeviceWorkout,
  context: WatchWorkoutContext,
): WatchWorkoutDerivedMetrics {
  const expectsDistance = getDeviceWorkoutMetricExpectation(workout.workoutType, "distance") === "expected";
  const expectsSteps = getDeviceWorkoutMetricExpectation(workout.workoutType, "steps") === "expected";
  const allowsRawDistance = isDeviceWorkoutMetricRelevant(workout.workoutType, "distance");
  const allowsRawSteps = isDeviceWorkoutMetricRelevant(workout.workoutType, "steps");
  const activeCalories = getTrustedWatchWorkoutActiveCalories(workout);
  const rawWorkoutSteps = getTrustedWatchWorkoutSteps(workout);
  const trustedDistanceMeters = getTrustedWatchWorkoutDistanceMeters(workout);
  const canScanWorkoutSamples = workout.samples.length <= 600;
  const workoutSampleSteps = rawWorkoutSteps ?? (expectsSteps && canScanWorkoutSamples ? inferWatchWorkoutStepsFromWorkoutSamples(workout.samples) : null);
  const durationFromWorkoutSamples = workout.durationMinutes !== null || !canScanWorkoutSamples
    ? null
    : inferWatchWorkoutDurationFromWorkoutSamples(workout);
  const needsDailySamples = expectsSteps && workoutSampleSteps === null ||
    (workout.durationMinutes === null && durationFromWorkoutSamples === null);
  const samplesAfterStart = needsDailySamples ? getWatchWorkoutSamplesAfterStart(workout, context) : [];
  const durationFromSamples = durationFromWorkoutSamples ?? inferWatchWorkoutDurationFromSamples(workout, samplesAfterStart);
  const durationMinutes = workout.durationMinutes ?? durationFromSamples;
  const steps = allowsRawSteps
    ? workoutSampleSteps ?? (expectsSteps ? inferWatchWorkoutSteps(samplesAfterStart) : null)
    : null;
  const dailySteps = getWatchStepCount(context.summary);
  const dailyCalories = readWatchWorkoutRawNumber(context.summary?.rawPayload, "calories");
  const estimatedCalories = activeCalories === null &&
      steps !== null &&
      dailySteps !== null &&
      dailySteps > 0 &&
      dailyCalories !== null &&
      dailyCalories > 0
    ? (dailyCalories * steps) / dailySteps
    : null;
  const distanceFromWorkout = allowsRawDistance ? trustedDistanceMeters : null;
  const estimatedDistanceMeters = expectsDistance && distanceFromWorkout === null && steps !== null && steps > 0
    ? steps * 0.75
    : null;

  return {
    activeCalories: activeCalories ?? estimatedCalories,
    activeCaloriesDetail: activeCalories !== null
      ? "с часов"
      : estimatedCalories !== null
        ? "примерно по шагам"
        : "нет данных",
    activeCaloriesPrefix: activeCalories === null && estimatedCalories !== null ? "≈" : "",
    distanceDetail: distanceFromWorkout !== null
      ? "с часов"
      : estimatedDistanceMeters !== null
        ? "примерно по шагам"
        : expectsDistance
          ? "нет данных"
          : undefined,
    distanceMeters: distanceFromWorkout ?? estimatedDistanceMeters,
    distancePrefix: distanceFromWorkout === null && estimatedDistanceMeters !== null ? "≈" : "",
    durationDetail: workout.durationMinutes !== null
      ? "с часов"
      : durationFromSamples !== null
        ? "по точкам пульса"
        : "только старт",
    durationMinutes,
    steps,
    stepsDetail: steps !== null
      ? rawWorkoutSteps !== null
        ? "с часов"
        : workoutSampleSteps !== null
        ? "по точкам тренировки"
        : "по точкам после старта"
      : expectsSteps
        ? "нет данных"
        : undefined,
  };
}

function getTrustedWatchWorkoutActiveCalories(workout: DeviceWorkout) {
  if (workout.activeCalories === null) {
    return null;
  }
  if (workout.activeCalories < 1) {
    return null;
  }
  if (isLegacyDirectWatchWorkoutParserShift(workout)) {
    return null;
  }

  const rawPayload = workout.rawPayload ?? {};
  const rawSteps = readWatchWorkoutRawNumber(rawPayload, "steps");
  const hasCurrentParserMetadata = typeof rawPayload.dataCompleteness === "string";
  if (
    workout.provider === "direct-watch" &&
    !hasCurrentParserMetadata &&
    rawSteps !== null &&
    Math.round(rawSteps) === Math.round(workout.activeCalories)
  ) {
    return null;
  }

  return workout.activeCalories;
}

function getTrustedWatchWorkoutDistanceMeters(workout: DeviceWorkout) {
  if (isLegacyDirectWatchWorkoutParserShift(workout)) {
    return workout.activeCalories ?? readWatchWorkoutRawNumber(workout.rawPayload, "steps");
  }

  return workout.distanceMeters;
}

function getTrustedWatchWorkoutSteps(workout: DeviceWorkout) {
  if (isLegacyDirectWatchWorkoutParserShift(workout)) {
    return null;
  }

  return readWatchWorkoutRawNumber(workout.rawPayload, "steps");
}

function isLegacyDirectWatchWorkoutParserShift(workout: DeviceWorkout) {
  if (workout.provider !== "direct-watch") {
    return false;
  }
  if (workout.sourceWorkoutId.startsWith("direct-watch:workout-file:")) {
    return false;
  }

  const summary = readWatchWorkoutSummaryRawPayload(workout);
  if (summary?.type !== "walking") {
    return false;
  }

  const durationMinutes = workout.durationMinutes ?? readWatchWorkoutSummaryRawNumber(workout, "durationMinutes");
  const distanceMeters = workout.distanceMeters ?? readWatchWorkoutSummaryRawNumber(workout, "distanceMeters");
  const rawSteps = readWatchWorkoutRawNumber(workout.rawPayload, "steps");
  if (
    durationMinutes === null ||
    distanceMeters === null ||
    workout.activeCalories === null ||
    rawSteps === null
  ) {
    return false;
  }

  const durationSeconds = durationMinutes * 60;
  const distanceLooksLikeDuration = Math.abs(distanceMeters - durationSeconds) <= Math.max(90, durationSeconds * 0.08);
  const duplicatedDistanceField = Math.round(workout.activeCalories) === Math.round(rawSteps);
  return distanceLooksLikeDuration && duplicatedDistanceField;
}

function inferWatchWorkoutDurationFromWorkoutSamples(workout: DeviceWorkout) {
  let end = Number.NEGATIVE_INFINITY;
  let start = Number.POSITIVE_INFINITY;
  let count = 0;

  for (const sample of workout.samples) {
    const time = getDeviceWorkoutGraphTime(sample.sampleTime);
    if (time === null) {
      continue;
    }
    count += 1;
    if (time < start) {
      start = time;
    }
    if (time > end) {
      end = time;
    }
  }

  if (count < 2) {
    return null;
  }

  return end > start ? Math.max(1, Math.round((end - start) / 60000)) : null;
}

function inferWatchWorkoutStepsFromWorkoutSamples(samples: DeviceWorkout["samples"]) {
  const values = samples
    .map((sample) => readWatchWorkoutRawNumber(sample.rawPayload, "steps"))
    .filter((value): value is number => value !== null && value >= 0);

  return inferWatchWorkoutStepsFromValues(values);
}

function getWatchWorkoutSamplesAfterStart(
  workout: DeviceWorkout,
  context: WatchWorkoutContext,
) {
  const start = getDeviceWorkoutGraphTime(workout.startTime);
  if (start === null) {
    return [];
  }

  const knownEnd = workout.durationMinutes !== null ? getDeviceWorkoutGraphTime(workout.endTime) : null;
  const fallbackEnd = start + 90 * 60 * 1000;
  const end = knownEnd !== null && knownEnd > start ? knownEnd : fallbackEnd;
  const samplesByTime = new Map<string, DeviceHealthSample>();

  const addSamples = (samples: DeviceHealthSample[]) => {
    for (const sample of samples) {
      const time = getDeviceWorkoutGraphTime(sample.sampledAt);
      if (time !== null && time >= start && time <= end) {
        samplesByTime.set(`${sample.metric}:${sample.sampledAt}`, sample);
      }
    }
  };

  addSamples(context.heartRateSamples);
  addSamples(context.oxygenSamples);
  addSamples(context.stressSamples);

  return Array.from(samplesByTime.values()).sort((left, right) => left.sampledAt.localeCompare(right.sampledAt));
}

function inferWatchWorkoutDurationFromSamples(
  workout: DeviceWorkout,
  samples: DeviceHealthSample[],
) {
  const start = getDeviceWorkoutGraphTime(workout.startTime);
  if (start === null || samples.length === 0) {
    return null;
  }

  const lastSampleTime = Math.max(
    ...samples
      .map((sample) => getDeviceWorkoutGraphTime(sample.sampledAt))
      .filter((time): time is number => time !== null && time >= start),
  );

  if (!Number.isFinite(lastSampleTime) || lastSampleTime <= start) {
    return null;
  }

  return Math.max(1, Math.round((lastSampleTime - start) / 60000));
}

function inferWatchWorkoutSteps(samples: DeviceHealthSample[]) {
  const values = samples
    .map((sample) => readWatchWorkoutRawNumber(sample.rawPayload, "steps"))
    .filter((value): value is number => value !== null && value >= 0);

  return inferWatchWorkoutStepsFromValues(values);
}

function inferWatchWorkoutStepsFromValues(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const first = values[0];
  const last = values[values.length - 1];
  const isMostlyCumulative = values.every((value, index) => index === 0 || value >= values[index - 1]);

  if (isMostlyCumulative && last > first) {
    return Math.round(last - first);
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max > min) {
    return Math.round(max - min);
  }

  const sum = values.reduce((total, value) => total + value, 0);
  return sum > 0 ? Math.round(sum) : null;
}

function readWatchWorkoutRawNumber(
  rawPayload: Record<string, unknown> | null | undefined,
  key: string,
) {
  if (!rawPayload) {
    return null;
  }

  return readDeviceHealthRawNumber(rawPayload, key);
}

function readWatchWorkoutSummaryRawPayload(workout: DeviceWorkout) {
  const value = workout.rawPayload?.workoutSummary;
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readWatchWorkoutSummaryRawNumber(workout: DeviceWorkout, key: string) {
  const summary = readWatchWorkoutSummaryRawPayload(workout);
  return summary ? readDeviceHealthRawNumber(summary, key) : null;
}

function getDeviceWorkoutRawHeartRateZones(workout: DeviceWorkout): DeviceWorkoutHeartRateZone[] {
  const summary = readWatchWorkoutSummaryRawPayload(workout);
  const rawZones = summary?.heartRateZonesSeconds;
  if (!rawZones || typeof rawZones !== "object" || Array.isArray(rawZones)) {
    return [];
  }

  const zoneSource = rawZones as Record<string, unknown>;
  const secondsByZone = [
    { key: "extreme", zone: 5 },
    { key: "anaerobic", zone: 4 },
    { key: "aerobic", zone: 3 },
    { key: "fatBurn", zone: 2 },
    { key: "warmUp", zone: 1 },
  ].map((item) => ({
    ...item,
    seconds: readDeviceHealthRawNumber(zoneSource, item.key),
  }));
  const totalSeconds = secondsByZone.reduce((sum, item) => sum + Math.max(0, item.seconds ?? 0), 0);

  if (totalSeconds <= 0) {
    return [];
  }

  const maxHeartRate = workout.maxHeartRateBpm ?? workout.averageHeartRateBpm ?? 180;
  const estimatedMax = getEstimatedHeartRateMax(maxHeartRate);

  return secondsByZone.map((item) => {
    const durationMs = Math.max(0, item.seconds ?? 0) * 1000;
    return {
      color: DEVICE_WORKOUT_ZONE_COLORS[item.zone],
      durationMs,
      lower: item.zone === 1 ? 0 : Math.round(estimatedMax * (0.5 + (item.zone - 1) * 0.1)),
      percent: (durationMs / (totalSeconds * 1000)) * 100,
      upper: item.zone === 5 ? estimatedMax : Math.round(estimatedMax * (0.5 + item.zone * 0.1)),
      zone: item.zone,
    };
  });
}

function renderDeviceWorkoutMetrics(workout: DeviceWorkout) {
  const steps = getTrustedWatchWorkoutSteps(workout);
  const durationMinutes = workout.durationMinutes ?? readWatchWorkoutSummaryRawNumber(workout, "durationMinutes");
  const distanceMeters = getTrustedWatchWorkoutDistanceMeters(workout) ??
    readWatchWorkoutSummaryRawNumber(workout, "distanceMeters");
  const activeCalories = getTrustedWatchWorkoutActiveCalories(workout);
  const metrics = [
    { hasValue: durationMinutes !== null, label: "Длительность", metric: "duration" as DeviceWorkoutMetricKey, value: durationMinutes !== null ? formatDeviceWorkoutDuration(durationMinutes) : "-" },
    { hasValue: distanceMeters !== null, label: "Дистанция", metric: "distance" as DeviceWorkoutMetricKey, value: distanceMeters !== null ? formatDistanceMeters(distanceMeters) : "-" },
    { hasValue: steps !== null, label: "Шаги", metric: "steps" as DeviceWorkoutMetricKey, value: steps !== null ? Math.round(steps).toLocaleString("ru-RU") : "-" },
    { hasValue: activeCalories !== null, label: "Калории", metric: "calories" as DeviceWorkoutMetricKey, value: activeCalories !== null ? String(Math.round(activeCalories)) : "-" },
    { hasValue: workout.averageHeartRateBpm !== null, label: "Средний пульс", metric: "heartRate" as DeviceWorkoutMetricKey, value: workout.averageHeartRateBpm !== null ? formatLoadValue(workout.averageHeartRateBpm) : "-" },
    { hasValue: workout.maxHeartRateBpm !== null, label: "Макс. пульс", metric: "heartRate" as DeviceWorkoutMetricKey, value: workout.maxHeartRateBpm !== null ? formatLoadValue(workout.maxHeartRateBpm) : "-" },
  ].filter((metric) => {
    const expectation = getDeviceWorkoutMetricExpectation(workout.workoutType, metric.metric);
    return expectation === "expected" || metric.hasValue && expectation === "optional";
  });

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

type DeviceWorkoutGraphKind = "heartRate" | "pace" | "speed" | "spo2" | "stress";

interface DeviceWorkoutGraphSeries {
  detail?: string;
  key: DeviceWorkoutGraphKind;
  label: string;
  samples: { sampleTime: string; value: number }[];
  source?: "day-window" | "summary" | "workout";
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

const DEVICE_WORKOUT_ZONE_COLORS: Record<number, string> = {
  1: "#cbd5e1",
  2: "#38bdf8",
  3: "#84cc16",
  4: "#facc15",
  5: "#e11d48",
};
const WORKOUT_HEART_RATE_MIN_BPM = 35;
const WORKOUT_HEART_RATE_MAX_BPM = 220;

function isPlausibleWorkoutHeartRateBpm(value: number) {
  return Number.isFinite(value) &&
    value >= WORKOUT_HEART_RATE_MIN_BPM &&
    value <= WORKOUT_HEART_RATE_MAX_BPM;
}

function normalizeWorkoutHeartRateBpm(value: number | null | undefined) {
  return typeof value === "number" && isPlausibleWorkoutHeartRateBpm(value) ? value : null;
}

function getWorkoutHeartRateGraphBounds(workout: DeviceWorkout) {
  const summaryMin = normalizeWorkoutHeartRateBpm(workout.minHeartRateBpm);
  const summaryMax = normalizeWorkoutHeartRateBpm(workout.maxHeartRateBpm);

  return {
    lower: summaryMin !== null
      ? Math.max(WORKOUT_HEART_RATE_MIN_BPM, summaryMin - 8)
      : Math.max(WORKOUT_HEART_RATE_MIN_BPM, 40),
    upper: summaryMax !== null
      ? Math.min(WORKOUT_HEART_RATE_MAX_BPM, summaryMax + 8)
      : WORKOUT_HEART_RATE_MAX_BPM,
  };
}

function isWorkoutHeartRateGraphValue(workout: DeviceWorkout, value: number) {
  if (!isPlausibleWorkoutHeartRateBpm(value)) {
    return false;
  }

  const bounds = getWorkoutHeartRateGraphBounds(workout);
  return value >= bounds.lower && value <= bounds.upper;
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

function buildDeviceWorkoutGraphSeries(
  workout: DeviceWorkout,
  context?: WatchWorkoutContext,
): DeviceWorkoutGraphSeries[] {
  const cacheKey = getDeviceWorkoutGraphSeriesCacheKey(workout, context);
  const workoutCache = deviceWorkoutGraphSeriesCache.get(workout);
  const cachedSeries = workoutCache?.get(cacheKey);
  if (cachedSeries) {
    return cachedSeries;
  }

  const series = buildDeviceWorkoutGraphSeriesUncached(workout, context);
  const nextWorkoutCache = workoutCache ?? new Map<string, DeviceWorkoutGraphSeries[]>();
  if (nextWorkoutCache.size >= 6) {
    const oldestKey = nextWorkoutCache.keys().next().value;
    if (oldestKey) {
      nextWorkoutCache.delete(oldestKey);
    }
  }
  nextWorkoutCache.set(cacheKey, series);
  if (!workoutCache) {
    deviceWorkoutGraphSeriesCache.set(workout, nextWorkoutCache);
  }
  return series;
}

function getDeviceWorkoutGraphSeriesCacheKey(
  workout: DeviceWorkout,
  context?: WatchWorkoutContext,
) {
  return [
    workout.samples.length,
    workout.sampleCount,
    workout.startTime,
    workout.endTime,
    workout.averageHeartRateBpm ?? "",
    workout.maxHeartRateBpm ?? "",
    workout.minHeartRateBpm ?? "",
    context ? context.summary?.updatedAt ?? "summary-none" : "context-none",
    getDeviceHealthSampleListCacheKey(context?.heartRateSamples),
    getDeviceHealthSampleListCacheKey(context?.oxygenSamples),
    getDeviceHealthSampleListCacheKey(context?.stressSamples),
  ].join("|");
}

function getDeviceHealthSampleListCacheKey(samples?: DeviceHealthSample[]) {
  if (!samples || samples.length === 0) {
    return "0";
  }

  const first = samples[0];
  const last = samples[samples.length - 1];
  return [
    samples.length,
    first.sampledAt,
    first.value,
    last.sampledAt,
    last.value,
  ].join(":");
}

function getDeviceWorkoutSeriesCacheKey(series: DeviceWorkoutGraphSeries, workout: DeviceWorkout) {
  const first = series.samples[0];
  const last = series.samples[series.samples.length - 1];
  return [
    series.key,
    series.source ?? "",
    series.samples.length,
    first?.sampleTime ?? "",
    first?.value ?? "",
    last?.sampleTime ?? "",
    last?.value ?? "",
    workout.startTime,
    workout.endTime,
    workout.averageHeartRateBpm ?? "",
    workout.maxHeartRateBpm ?? "",
    workout.minHeartRateBpm ?? "",
  ].join("|");
}

function buildDeviceWorkoutGraphSeriesUncached(
  workout: DeviceWorkout,
  context?: WatchWorkoutContext,
): DeviceWorkoutGraphSeries[] {
  const rawHeartRateSamples: { sampleTime: string; value: number }[] = [];
  const rawPaceSamples: { sampleTime: string; value: number }[] = [];
  const rawSpeedSamples: { sampleTime: string; value: number }[] = [];
  const rawSpo2Samples: { sampleTime: string; value: number }[] = [];

  for (const sample of workout.samples) {
    if (sample.heartRateBpm !== null && isWorkoutHeartRateGraphValue(workout, sample.heartRateBpm)) {
      rawHeartRateSamples.push({ sampleTime: sample.sampleTime, value: sample.heartRateBpm });
    }

    const pace = getDeviceWorkoutPaceSeconds(sample);
    if (pace !== null) {
      rawPaceSamples.push({ sampleTime: sample.sampleTime, value: pace });
    }

    if (sample.speedMetersPerSecond !== null) {
      rawSpeedSamples.push({ sampleTime: sample.sampleTime, value: sample.speedMetersPerSecond * 3.6 });
    }

    if (sample.oxygenSaturationPercent !== null) {
      rawSpo2Samples.push({ sampleTime: sample.sampleTime, value: sample.oxygenSaturationPercent });
    }
  }

  const heartRateSamples = compactDeviceWorkoutGraphSamples(rawHeartRateSamples);
  const paceSamples = compactDeviceWorkoutGraphSamples(rawPaceSamples);
  const speedSamples = compactDeviceWorkoutGraphSamples(rawSpeedSamples);
  const spo2Samples = compactDeviceWorkoutGraphSamples(rawSpo2Samples);
  const summaryHeartRateSamples = heartRateSamples.length > 1
    ? []
    : buildDeviceWorkoutSummaryHeartRateSamples(workout);
  const fallbackHeartRateSamples = heartRateSamples.length > 1
    ? []
    : summaryHeartRateSamples.length > 1
      ? []
    : filterWorkoutHeartRateGraphSamples(workout, getWatchWorkoutWindowSamples(workout, context?.heartRateSamples ?? []));
  const fallbackOxygenSamples = spo2Samples.length > 1
    ? []
    : getWatchWorkoutWindowSamples(workout, context?.oxygenSamples ?? []);
  const fallbackStressSamples = getWatchWorkoutWindowSamples(workout, context?.stressSamples ?? []);

  const series: DeviceWorkoutGraphSeries[] = [];

  if (heartRateSamples.length > 1 || summaryHeartRateSamples.length > 1 || fallbackHeartRateSamples.length > 1) {
    const useSummary = heartRateSamples.length <= 1 && summaryHeartRateSamples.length > 1;
    const useFallback = heartRateSamples.length <= 1 && !useSummary;
    series.push({
      detail: useSummary
        ? "сводка часов min/avg/max без секундных точек"
        : useFallback
          ? "дневные точки вокруг старта тренировки"
          : "точки тренировки",
      key: "heartRate",
      label: useSummary
        ? "Пульс по сводке"
        : useFallback
          ? "Пульс вокруг тренировки"
          : "Пульс",
      samples: useSummary
        ? summaryHeartRateSamples
        : useFallback
          ? compactDeviceWorkoutGraphSamples(fallbackHeartRateSamples)
          : heartRateSamples,
      source: useSummary ? "summary" : useFallback ? "day-window" : "workout",
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

  if (spo2Samples.length > 1 || fallbackOxygenSamples.length > 1) {
    const useFallback = spo2Samples.length <= 1;
    series.push({
      detail: useFallback ? "дневные точки вокруг старта тренировки" : "точки тренировки",
      key: "spo2",
      label: useFallback ? "SpO2 вокруг тренировки" : "SpO2",
      samples: useFallback ? compactDeviceWorkoutGraphSamples(fallbackOxygenSamples) : spo2Samples,
      source: useFallback ? "day-window" : "workout",
      valueLabel: (value) => `${Math.round(value)}%`,
    });
  }

  if (fallbackStressSamples.length > 1) {
    series.push({
      detail: "дневные точки вокруг старта тренировки",
      key: "stress",
      label: "Стресс вокруг тренировки",
      samples: compactDeviceWorkoutGraphSamples(fallbackStressSamples),
      source: "day-window",
      valueLabel: (value) => String(Math.round(value)),
    });
  }

  return series;
}

function compactDeviceWorkoutGraphSamples<T extends { sampleTime: string; value: number }>(
  samples: T[],
) {
  return limitDeviceWorkoutSamples(samples, DEVICE_WORKOUT_SERIES_RENDER_LIMIT);
}

function filterWorkoutHeartRateGraphSamples<T extends { value: number }>(workout: DeviceWorkout, samples: T[]) {
  return samples.filter((sample) => isWorkoutHeartRateGraphValue(workout, sample.value));
}

function getWatchWorkoutWindowSamples(
  workout: DeviceWorkout,
  samples: DeviceHealthSample[],
): { sampleTime: string; value: number }[] {
  if (!samples.length) {
    return [];
  }

  const start = getDeviceWorkoutGraphTime(workout.startTime);
  if (start === null) {
    return [];
  }

  const knownEnd = workout.durationMinutes !== null ? getDeviceWorkoutGraphTime(workout.endTime) : null;
  const windowStart = start - 15 * 60 * 1000;
  const windowEnd = knownEnd !== null && knownEnd > start
    ? knownEnd + 5 * 60 * 1000
    : start + 90 * 60 * 1000;

  return samples
    .filter((sample) => {
      const time = getDeviceWorkoutGraphTime(sample.sampledAt);
      return time !== null && time >= windowStart && time <= windowEnd;
    })
    .map((sample) => ({ sampleTime: sample.sampledAt, value: sample.value }));
}

function hasDeviceWorkoutGraph(workout: DeviceWorkout, context?: WatchWorkoutContext) {
  if (hasWorkoutSummaryHeartRate(workout)) {
    return true;
  }

  let heartRateSamples = 0;
  let paceSamples = 0;
  let speedSamples = 0;
  let spo2Samples = 0;

  for (const sample of workout.samples) {
    if (sample.heartRateBpm !== null) {
      heartRateSamples += 1;
    }
    if (getDeviceWorkoutPaceSeconds(sample) !== null) {
      paceSamples += 1;
    }
    if (sample.speedMetersPerSecond !== null) {
      speedSamples += 1;
    }
    if (sample.oxygenSaturationPercent !== null) {
      spo2Samples += 1;
    }

    if (heartRateSamples > 1 || paceSamples > 1 || speedSamples > 1 || spo2Samples > 1) {
      return true;
    }
  }

  if (!context) {
    return false;
  }

  return hasWatchWorkoutWindowSamples(workout, context.heartRateSamples) ||
    hasWatchWorkoutWindowSamples(workout, context.oxygenSamples) ||
    hasWatchWorkoutWindowSamples(workout, context.stressSamples);
}

function hasDeviceWorkoutGraphSummary(workout: DeviceWorkout) {
  const cached = deviceWorkoutGraphSummaryCache.get(workout);
  if (cached !== undefined) {
    return cached;
  }

  let hasGraph = false;
  if (getDeviceWorkoutRawHeartRateZones(workout).length > 0) {
    hasGraph = true;
  } else if (hasWorkoutSummaryHeartRate(workout)) {
    hasGraph = true;
  } else if (workout.sampleCount <= 1 && workout.samples.length <= 1) {
    hasGraph = false;
  } else {
    const quickSampleLimit = Math.min(workout.samples.length, 48);
    for (let index = 0; index < quickSampleLimit; index += 1) {
      const sample = workout.samples[index];
      if (
        sample.heartRateBpm !== null ||
        sample.oxygenSaturationPercent !== null ||
        sample.speedMetersPerSecond !== null ||
        sample.paceSecondsPerKm !== null
      ) {
        hasGraph = true;
        break;
      }
    }

    if (!hasGraph) {
      hasGraph = workout.samples.length === 0 && workout.sampleCount > 1;
    }
  }

  deviceWorkoutGraphSummaryCache.set(workout, hasGraph);
  return hasGraph;
}

function hasWatchWorkoutWindowSamples(workout: DeviceWorkout, samples: DeviceHealthSample[]) {
  if (samples.length < 2) {
    return false;
  }

  const start = getDeviceWorkoutGraphTime(workout.startTime);
  if (start === null) {
    return false;
  }

  const knownEnd = workout.durationMinutes !== null ? getDeviceWorkoutGraphTime(workout.endTime) : null;
  const windowStart = start - 15 * 60 * 1000;
  const windowEnd = knownEnd !== null && knownEnd > start
    ? knownEnd + 5 * 60 * 1000
    : start + 90 * 60 * 1000;
  let count = 0;

  for (const sample of samples) {
    const time = getDeviceWorkoutGraphTime(sample.sampledAt);
    if (time !== null && time >= windowStart && time <= windowEnd) {
      count += 1;
      if (count > 1) {
        return true;
      }
    }
  }

  return false;
}

function formatDeviceWorkoutGraphTime(value: number) {
  return mobileUPlotTimeFormatter.format(new Date(value));
}

function getDeviceWorkoutGraphTime(value: string) {
  if (!value) {
    return null;
  }

  if (deviceWorkoutGraphTimeCache.has(value)) {
    return deviceWorkoutGraphTimeCache.get(value) ?? null;
  }

  const time = parseDeviceWorkoutGraphTimeFast(value);
  const result = Number.isFinite(time) ? time : null;
  deviceWorkoutGraphTimeCache.set(value, result);
  return result;
}

function parseDeviceWorkoutGraphTimeFast(value: string) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:\s*(Z|[+-]\d{2}(?::?\d{2})?))?$/,
  );

  if (!match) {
    return Date.parse(value);
  }

  const [, year, month, day, hour, minute, second = "0", zone] = match;
  const utcTime = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );

  if (!zone || zone === "Z") {
    return utcTime;
  }

  const sign = zone.startsWith("-") ? -1 : 1;
  const cleanZone = zone.slice(1).replace(":", "");
  const offsetHours = Number(cleanZone.slice(0, 2));
  const offsetMinutes = Number(cleanZone.slice(2, 4) || "0");
  const offsetMs = sign * ((offsetHours * 60 + offsetMinutes) * 60 * 1000);
  return utcTime - offsetMs;
}

function clampDeviceWorkoutGraphX(value: number) {
  return Math.max(0, Math.min(100, value));
}

function getEstimatedHeartRateMax(maxWorkoutHeartRate: number) {
  return Math.max(180, Math.round(maxWorkoutHeartRate / 0.9));
}

function buildAdaptiveHeartRateScale(minValue: number, maxValue: number) {
  const rawRange = Math.max(1, maxValue - minValue);
  const lowerPadding = Math.max(8, rawRange * 0.18);
  const upperPadding = Math.max(12, rawRange * 0.24);
  let lower = Math.max(30, Math.floor((minValue - lowerPadding) / 10) * 10);
  let upper = Math.min(230, Math.ceil((maxValue + upperPadding) / 10) * 10);

  if (maxValue <= 100) {
    upper = Math.max(upper, 120);
  } else if (maxValue <= 120) {
    upper = Math.max(upper, 130);
  } else if (maxValue <= 150) {
    upper = Math.max(upper, 160);
  }

  if (upper - lower < 50) {
    upper = Math.min(230, lower + 50);
  }

  const steps = [10, 20, 30, 40, 50];
  let step = steps[steps.length - 1];

  for (const candidate of steps) {
    const count = Math.floor((upper - lower) / candidate) + 1;
    if (count <= 6) {
      step = candidate;
      break;
    }
  }

  lower = Math.max(30, Math.floor(lower / step) * step);
  upper = Math.min(240, Math.ceil(upper / step) * step);

  const axisValues: number[] = [];
  for (let value = upper; value >= lower; value -= step) {
    axisValues.push(value);
  }

  return {
    axisValues,
    lower,
    upper,
  };
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
      color: DEVICE_WORKOUT_ZONE_COLORS[zone],
      durationMs,
      lower,
      percent: total > 0 ? (durationMs / total) * 100 : 0,
      upper,
      zone,
    };
  });
}

function getDeviceWorkoutHeartRateZonesForRender(
  workout: DeviceWorkout,
  series: DeviceWorkoutGraphSeries,
  estimatedMax: number,
) {
  const rawZones = getDeviceWorkoutRawHeartRateZones(workout);
  return rawZones.length > 0 ? rawZones : buildDeviceWorkoutHeartRateZones(series, estimatedMax);
}

function renderDeviceWorkoutZoneRows(heartRateZones: DeviceWorkoutHeartRateZone[]) {
  return heartRateZones.map((zone) => `
    <div class="device-workout-zone-row z${zone.zone}">
      <span class="zone-number">${zone.zone}</span>
      <span class="zone-bar">
        <i style="width: ${zone.percent > 0 ? `${Math.max(2, zone.percent).toFixed(1)}%` : "0%"}"></i>
        <b>${Math.round(zone.percent)}%</b>
      </span>
      <span class="zone-time">${escapeHtml(formatDeviceWorkoutDurationMs(zone.durationMs))}</span>
    </div>
  `).join("");
}

function renderDeviceWorkoutRawZoneSummary(workout: DeviceWorkout) {
  const zones = getDeviceWorkoutRawHeartRateZones(workout);
  if (!zones.length) {
    return "";
  }
  const visibleZones = zones.some((zone) => zone.durationMs > 0)
    ? zones.filter((zone) => zone.durationMs > 0)
    : zones;

  return `
    <section class="watch-workout-data-note">
      <strong>Зоны ЧСС из часов</strong>
      <span>Часы отдали summary тренировки без точек графика. Показываю зоны по готовому итогу устройства.</span>
      <div class="device-workout-zone-panel is-summary-only">
        <strong>Зоны ЧСС</strong>
        <div class="device-workout-zone-list">
          ${renderDeviceWorkoutZoneRows(visibleZones)}
        </div>
      </div>
    </section>
  `;
}

function renderDeviceWorkoutSeriesGraph(series: DeviceWorkoutGraphSeries, workout: DeviceWorkout) {
  const values = series.samples.map((sample) => sample.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const average = values.reduce((total, value) => total + value, 0) / values.length;
  const isHeartRate = series.key === "heartRate";
  const estimatedHeartRateMax = isHeartRate ? getEstimatedHeartRateMax(max) : null;
  const rawRange = Math.max(1, max - min);
  const heartRateScale = isHeartRate ? buildAdaptiveHeartRateScale(min, max) : null;
  const lower = heartRateScale !== null ? heartRateScale.lower : min - rawRange * 0.08;
  const upper = heartRateScale !== null ? heartRateScale.upper : max + rawRange * 0.08;
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
  const heartRateZones =
    isHeartRate && estimatedHeartRateMax !== null
      ? getDeviceWorkoutHeartRateZonesForRender(workout, series, estimatedHeartRateMax)
      : [];
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
  const sourceDetail = series.detail ? ` · ${series.detail}` : "";
  const uPlotPayload = buildDeviceWorkoutUPlotPayload(series, lower, upper, average);

  const caption = `
    <div class="device-workout-series-caption">
      <strong>${escapeHtml(series.label)}</strong>
      <span>${escapeHtml(`${captionDetail}${sourceDetail}`)}</span>
    </div>
  `;
  const chartColumn = `
    <div class="device-workout-chart-column">
      ${renderMobileBarsChart(uPlotPayload, `is-workout is-${series.key}`, 158)}
      ${timeLabels.length > 0
        ? `<div class="device-workout-axis-x" aria-hidden="true">${timeLabels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}</div>`
        : ""}
      ${coverageStartX !== null && coverageEndX !== null ? `<span class="device-workout-coverage-bar"><i style="left: ${coverageStartX.toFixed(2)}%; width: ${Math.max(2, coverageEndX - coverageStartX).toFixed(2)}%"></i></span>` : ""}
      ${coverageNote ? `<small class="device-workout-coverage-note">${escapeHtml(coverageNote)}</small>` : ""}
    </div>
  `;
  const zonePanel = `
    <div class="device-workout-zone-panel">
      <strong>Зоны ЧСС</strong>
      <div class="device-workout-zone-list">
        ${renderDeviceWorkoutZoneRows(heartRateZones)}
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

function buildDeviceWorkoutUPlotPayload(
  series: DeviceWorkoutGraphSeries,
  lower: number,
  upper: number,
  average: number,
): MobileUPlotPayload {
  const visibleSamples = limitDeviceWorkoutSamples(
    series.samples
      .map((sample) => {
        const sampleTime = getDeviceWorkoutGraphTime(sample.sampleTime);
        return sampleTime === null ? null : { sampleTime, value: sample.value };
      })
      .filter((sample): sample is { sampleTime: number; value: number } => Boolean(sample))
      .sort((left, right) => left.sampleTime - right.sampleTime),
    900,
  );
  const color = series.key === "heartRate"
    ? "#0f766e"
    : series.key === "spo2"
      ? "#0891b2"
      : series.key === "stress"
        ? "#ad6a15"
        : "#426f9d";
  const format = series.key === "spo2"
    ? "percent"
    : series.key === "pace"
      ? "pace"
      : series.key === "speed"
        ? "decimal"
        : "integer";

  return {
    average,
    color,
    format,
    label: series.label,
    lower,
    title: series.label,
    unit: series.key === "heartRate"
      ? "уд/мин"
      : series.key === "spo2"
        ? "%"
        : "",
    upper,
    valueDecimals: series.key === "speed" ? 1 : 0,
    x: visibleSamples.map((sample) => Math.round(sample.sampleTime / 1000)),
    y: visibleSamples.map((sample) => sample.value),
  };
}

function renderDeviceWorkoutGraph(
  workout: DeviceWorkout,
  context?: WatchWorkoutContext,
  precomputedSeries?: DeviceWorkoutGraphSeries[],
) {
  const series = precomputedSeries ?? buildDeviceWorkoutGraphSeries(workout, context);

  if (series.length === 0) {
    const rawZoneSummary = renderDeviceWorkoutRawZoneSummary(workout);
    if (rawZoneSummary) {
      return rawZoneSummary;
    }

    return `
      <section class="watch-workout-data-note">
        <strong>Графики пока недоступны</strong>
        <span>Часы отдали тренировку, но без точек пульса, SpO2 или стресса рядом со стартом. После следующей синхронизации данные появятся здесь, если часы их передадут.</span>
      </section>
    `;
  }

  const primarySeries = series[0];
  const secondarySeries = series.slice(1);

  return `
    <div class="device-workout-graph">
      ${renderDeviceWorkoutSeriesGraph(primarySeries, workout)}
      ${secondarySeries.length > 0 ? `
        <div class="device-workout-secondary-series">
          ${secondarySeries.map((item) => `
            <span>${escapeHtml(item.label)}</span>
          `).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function renderDeviceWorkoutSeriesDetailGraph(series: DeviceWorkoutGraphSeries, workout: DeviceWorkout) {
  if (series.key !== "heartRate") {
    return renderDeviceWorkoutSeriesGraph(series, workout);
  }

  const cacheKey = getDeviceWorkoutSeriesCacheKey(series, workout);
  const workoutCache = deviceWorkoutHeartRateDetailHtmlCache.get(workout);
  const cachedHtml = workoutCache?.get(cacheKey);
  if (cachedHtml) {
    return cachedHtml;
  }

  const chart = buildDeviceWorkoutHeartRateDetailChart(series, workout);
  if (!chart) {
    const fallbackHtml = renderDeviceWorkoutSeriesGraph(series, workout);
    const nextWorkoutCache = workoutCache ?? new Map<string, string>();
    nextWorkoutCache.set(cacheKey, fallbackHtml);
    if (!workoutCache) {
      deviceWorkoutHeartRateDetailHtmlCache.set(workout, nextWorkoutCache);
    }
    return fallbackHtml;
  }

  const html = `
    <div class="device-workout-series heartRate is-approved-detail">
      <div class="watch-heart-rate-approved-head">
        <div>
          <span>${escapeHtml(
            series.source === "workout"
              ? "ТОЧКИ ТРЕНИРОВКИ"
              : series.source === "summary"
                ? "СВОДКА ЧАСОВ"
                : "ОКНО ТРЕНИРОВКИ",
          )}</span>
          <h3>Пульс тренировки</h3>
          <p>${escapeHtml(`${chart.sampleCountLabel} · ${chart.visiblePointLabel}`)}</p>
        </div>
        <strong>${escapeHtml(chart.averageLabel)}<span>средний</span></strong>
      </div>
      <div class="watch-heart-rate-approved-metrics">
        <article><span>Мин</span><strong>${escapeHtml(chart.minLabel)}</strong></article>
        <article><span>Сред</span><strong>${escapeHtml(chart.averageLabel)}</strong></article>
        <article><span>Макс</span><strong>${escapeHtml(chart.maxLabel)}</strong></article>
      </div>
      <div class="watch-heart-rate-approved-layout is-workout-detail">
        <div class="watch-heart-rate-approved-chart">
          <div class="watch-heart-rate-approved-axis-y" aria-hidden="true">
            ${chart.axisLabels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}
          </div>
          <div class="watch-heart-rate-approved-plot">
            <svg aria-label="График пульса тренировки" role="img" viewBox="0 0 100 100" preserveAspectRatio="none">
              ${chart.zoneStrips}
              ${chart.gridLines}
              <line class="average" x1="0" x2="100" y1="${escapeHtml(chart.averageY)}" y2="${escapeHtml(chart.averageY)}"></line>
              ${chart.coverageLine}
              <polyline fill="none" points="${escapeHtml(chart.points)}"></polyline>
              ${chart.peakMarker}
            </svg>
          </div>
          <div class="watch-heart-rate-approved-axis-x" aria-hidden="true">
            ${chart.timeLabels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}
          </div>
        </div>
        <aside class="watch-heart-rate-approved-zones">
          <strong>Зоны ЧСС</strong>
          ${chart.zoneRows.map((zone) => `
            <div class="watch-heart-rate-approved-zone-row z${zone.zone}">
              <span>${zone.zone}</span>
              <i><b style="width: ${zone.width}"></b><em>${zone.percentLabel}</em></i>
              <strong>${escapeHtml(zone.durationLabel)}</strong>
            </div>
          `).join("")}
        </aside>
      </div>
    </div>
  `;
  const nextWorkoutCache = workoutCache ?? new Map<string, string>();
  if (nextWorkoutCache.size >= 6) {
    const oldestKey = nextWorkoutCache.keys().next().value;
    if (oldestKey) {
      nextWorkoutCache.delete(oldestKey);
    }
  }
  nextWorkoutCache.set(cacheKey, html);
  if (!workoutCache) {
    deviceWorkoutHeartRateDetailHtmlCache.set(workout, nextWorkoutCache);
  }
  return html;
}

function buildDeviceWorkoutHeartRateDetailChart(
  series: DeviceWorkoutGraphSeries,
  workout: DeviceWorkout,
) {
  const points = series.samples
    .map((sample) => {
      const sampledAt = getDeviceWorkoutGraphTime(sample.sampleTime);
      if (sampledAt === null || !isWorkoutHeartRateGraphValue(workout, sample.value)) {
        return null;
      }

      return { sampledAt, value: sample.value };
    })
    .filter((sample): sample is { sampledAt: number; value: number } => Boolean(sample))
    .sort((left, right) => left.sampledAt - right.sampledAt);

  if (points.length < 2) {
    return null;
  }

  const summaryStats = series.source === "summary" ? getDeviceWorkoutSummaryHeartRateStats(workout) : null;
  const values = points.map((point) => point.value);
  const min = summaryStats?.min ?? Math.min(...values);
  const max = summaryStats?.max ?? Math.max(...values);
  const average = summaryStats?.avg ?? values.reduce((total, value) => total + value, 0) / values.length;
  const scale = buildAdaptiveHeartRateScale(min, max);
  const range = Math.max(1, scale.upper - scale.lower);
  const workoutStartTime = getDeviceWorkoutGraphTime(workout.startTime);
  const workoutEndTime = getDeviceWorkoutGraphTime(workout.endTime);
  const sampleStartTime = points[0].sampledAt;
  const sampleEndTime = points[points.length - 1].sampledAt;
  let axisStartTime = workoutStartTime ?? sampleStartTime;
  let axisEndTime = workoutEndTime ?? sampleEndTime;

  if (
    axisEndTime <= axisStartTime ||
    sampleStartTime < axisStartTime ||
    sampleEndTime > axisEndTime
  ) {
    axisStartTime = sampleStartTime;
    axisEndTime = sampleEndTime;
  }

  const axisDuration = Math.max(1, axisEndTime - axisStartTime);
  const valueToY = (value: number) => 92 - ((value - scale.lower) / range) * 84;
  const timeToX = (value: number) => clampDeviceWorkoutGraphX(((value - axisStartTime) / axisDuration) * 100);
  const visiblePoints = limitDeviceWorkoutSamples(points, 260);
  const svgPoints = visiblePoints
    .map((point) => `${timeToX(point.sampledAt).toFixed(2)},${valueToY(point.value).toFixed(2)}`)
    .join(" ");
  const estimatedHeartRateMax = getEstimatedHeartRateMax(max);
  const heartRateZones = getDeviceWorkoutHeartRateZonesForRender(workout, series, estimatedHeartRateMax);
  const gridLines = scale.axisValues.map((value) => {
    const y = valueToY(value).toFixed(2);
    return `<line class="grid" x1="0" x2="100" y1="${y}" y2="${y}"></line>`;
  }).join("");
  const zoneStrips = heartRateZones.map((zone) => {
    const visibleTop = Math.min(scale.upper, zone.upper);
    const visibleBottom = Math.max(scale.lower, zone.zone === 1 ? 0 : zone.lower);
    if (visibleBottom >= visibleTop) {
      return "";
    }

    const zoneTop = valueToY(visibleTop);
    const zoneBottom = valueToY(visibleBottom);
    return `<rect class="hr-zone-strip z${zone.zone}" height="${Math.max(0, zoneBottom - zoneTop).toFixed(2)}" width="1.7" x="0" y="${zoneTop.toFixed(2)}"></rect>`;
  }).join("");
  const peak = points.reduce((current, point) => point.value > current.value ? point : current, points[0]);
  const peakX = timeToX(peak.sampledAt).toFixed(2);
  const peakY = valueToY(peak.value).toFixed(2);
  const coverageStartX = timeToX(sampleStartTime);
  const coverageEndX = timeToX(sampleEndTime);

  return {
    averageY: valueToY(average).toFixed(2),
    averageLabel: `${Math.round(average)}`,
    axisLabels: scale.axisValues.map((value) => String(Math.round(value))),
    coverageLine: `<line class="coverage" x1="${coverageStartX.toFixed(2)}" x2="${coverageEndX.toFixed(2)}" y1="97" y2="97"></line>`,
    gridLines,
    maxLabel: `${Math.round(max)}`,
    minLabel: `${Math.round(min)}`,
    peakMarker: `
      <line class="peak-line" x1="${peakX}" x2="${peakX}" y1="${peakY}" y2="96"></line>
      <circle class="peak-dot" cx="${peakX}" cy="${peakY}" r="1.8"></circle>
    `,
    points: svgPoints,
    sampleCountLabel: series.source === "summary" ? "сводка ЧСС" : `${points.length} точек ЧСС`,
    timeLabels: [
      formatDeviceWorkoutGraphTime(axisStartTime),
      formatDeviceWorkoutGraphTime(axisStartTime + axisDuration / 2),
      formatDeviceWorkoutGraphTime(axisEndTime),
    ],
    visiblePointLabel: series.source === "summary"
      ? "min / avg / max от часов"
      : `на графике ${visiblePoints.length} ключевых точек`,
    zoneRows: heartRateZones.map((zone) => ({
      durationLabel: formatHeartRateZoneCompactDurationMs(zone.durationMs),
      percentLabel: `${Math.round(zone.percent)}%`,
      width: zone.percent > 0 ? `${Math.max(2, zone.percent).toFixed(1)}%` : "0%",
      zone: zone.zone,
    })),
    zoneStrips,
  };
}

function renderDeviceWorkoutSeriesUPlotGraph(series: DeviceWorkoutGraphSeries, workout: DeviceWorkout) {
  const values = series.samples.map((sample) => sample.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const average = values.reduce((total, value) => total + value, 0) / values.length;
  const isHeartRate = series.key === "heartRate";
  const estimatedHeartRateMax = isHeartRate ? getEstimatedHeartRateMax(max) : null;
  const rawRange = Math.max(1, max - min);
  const heartRateScale = isHeartRate ? buildAdaptiveHeartRateScale(min, max) : null;
  const lower = heartRateScale !== null ? heartRateScale.lower : min - rawRange * 0.08;
  const upper = heartRateScale !== null ? heartRateScale.upper : max + rawRange * 0.08;
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

  const timeLabels =
    axisStartTime !== null && axisEndTime !== null && axisEndTime > axisStartTime
      ? [
          formatDeviceWorkoutGraphTime(axisStartTime),
          formatDeviceWorkoutGraphTime(axisStartTime + (axisEndTime - axisStartTime) / 2),
          formatDeviceWorkoutGraphTime(axisEndTime),
        ]
      : [];
  const uPlotPayload = buildDeviceWorkoutUPlotPayload(series, lower, upper, average);
  const heartRateZones =
    isHeartRate && estimatedHeartRateMax !== null
      ? getDeviceWorkoutHeartRateZonesForRender(workout, series, estimatedHeartRateMax)
      : [];

  return `
    <div class="device-workout-series ${escapeHtml(series.key)}">
      <div class="device-workout-series-caption">
        <strong>${escapeHtml(series.label)}</strong>
        <span>${escapeHtml(isHeartRate
          ? "ЧСС, уд/мин"
          : `мин ${series.valueLabel(min)} · сред ${series.valueLabel(average)} · макс ${series.valueLabel(max)}`)}</span>
      </div>
      <div class="device-workout-chart-column">
        ${renderMobileUPlotChart(uPlotPayload, `is-workout-detail is-${series.key}`, 254)}
        ${timeLabels.length > 0
          ? `<div class="device-workout-axis-x" aria-hidden="true">${timeLabels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}</div>`
          : ""}
      </div>
      ${isHeartRate ? `
        <div class="device-workout-zone-panel">
          <strong>Зоны ЧСС</strong>
          <div class="device-workout-zone-list">
            ${renderDeviceWorkoutZoneRows(heartRateZones)}
          </div>
        </div>
      ` : ""}
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

function getCoachContextAthlete(state: MobileAppState, athleteId: string | null) {
  return state.data.athletes.find((athlete) => athlete.athleteId === athleteId) ??
    getSelectedAthlete(state) ??
    state.data.athletes[0] ??
    null;
}

function renderCoachContextScreenHead(
  isCoachView: boolean,
  title: string,
  athlete: CoachAthleteSummary | null,
  detail: string,
) {
  if (!isCoachView) {
    return `
      <div class="screen-head">
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(detail)}</p>
      </div>
    `;
  }

  return `
    <div class="screen-head coach-context-screen-head">
      <span>Раздел спортсмена</span>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(athlete ? detail : "Спортсмен не выбран")}</p>
    </div>
  `;
}

function renderPlansScreen(state: MobileAppState, athleteId: string | null) {
  const isCoachView = isCoachRole(state.session.user?.role);
  const selectedAthlete = isCoachView ? getCoachContextAthlete(state, athleteId) : null;

  if (isCoachView && !selectedAthlete) {
    return renderEmpty("Выберите спортсмена", "После выбора спортсмена здесь появятся его назначенные планы.");
  }

  const allPlans = sortPlansForExecution(getPlansForAthlete(state, athleteId));
  const dateOptions = getPlanDateOptions(allPlans);
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
    ${selectedAthlete ? renderCoachAthleteSwitchHeader(state, selectedAthlete) : ""}
    ${renderCoachContextScreenHead(
      isCoachView,
      "Планы",
      selectedAthlete,
      selectedDate
        ? `${plans.length} ${formatAssignedDayCountLabel(plans.length)} · ${formatDate(selectedDate)}`
        : `${allPlans.length} ${formatAssignedDayCountLabel(allPlans.length)}`,
    )}
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
      <span>${isCoachView ? "Дата" : "День плана"}</span>
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
  const isCoachView = isCoachRole(state.session.user?.role);
  const selectedAthlete = isCoachView ? getCoachContextAthlete(state, athleteId) : null;

  if (isCoachView && !selectedAthlete) {
    return renderEmpty("Выберите спортсмена", "После выбора спортсмена здесь появятся его старты и календарные планы.");
  }

  const plans = getCompetitionPlansForAthlete(state, athleteId);
  const athleteCompetitionIds = new Set(plans.map((plan) => plan.competitionId).filter(Boolean));
  const competitions = state.data.competitions
    .filter((competition) => !isCoachView || athleteCompetitionIds.has(competition.id))
    .slice()
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const canSubmitCompetitionResult = isCoachView;

  return `
    ${selectedAthlete ? renderCoachAthleteSwitchHeader(state, selectedAthlete) : ""}
    ${renderCoachContextScreenHead(
      isCoachView,
      "Календарь",
      selectedAthlete,
      `${competitions.length} соревнований · ${plans.length} планов старта`,
    )}
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
            <button class="timeline-card ${linkedPlan ? "is-linked" : ""}" data-coach-open-day="${escapeHtml(competition.startDate)}" data-coach-open-screen="athletes" type="button">
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
  const selectedAthlete = isCoachReview ? getCoachContextAthlete(state, athleteId) : null;

  if (canSubmitExecution) {
    return renderAthleteExecutionScreen(state, plans);
  }

  if (isCoachReview && !selectedAthlete) {
    return renderEmpty("Выберите спортсмена", "После выбора спортсмена здесь появится выполнение и дневник.");
  }

  return `
    ${selectedAthlete ? renderCoachAthleteSwitchHeader(state, selectedAthlete) : ""}
    ${renderCoachContextScreenHead(
      isCoachReview,
      "Выполнение",
      selectedAthlete,
      isCoachReview
        ? `${formatDate(state.selectedDayDate)} · план/факт, отметки спортсмена и дневник`
        : getSyncActionRestrictionMessage(state.session.user?.role ?? null, "execution"),
    )}
    ${isCoachReview ? renderCoachExecutionReviewSummary(state, athleteId, state.selectedDayDate) : ""}
    ${renderExecutionForm(state, plans)}
    ${renderCoachDiaryHistory(state, athleteId, selectedDayDate)}
    ${renderExecutionHistory(state, athleteId, selectedDayDate)}
  `;
}

function renderAthleteExecutionScreen(state: MobileAppState, plans: AssignedPlanSummary[]) {
  const allPlanGroups = getExecutionPlanGroups(plans);
  const dateOptions = getExecutionDateOptions(allPlanGroups);
  const selectedDate = getAthleteExecutionSelectedDate(state, dateOptions);
  const athleteId = state.session.user?.athleteId ?? null;
  const planGroups = selectedDate
    ? allPlanGroups.filter((group) => group.plan.day.dayDate === selectedDate)
    : [];
  const deviceWorkoutsForDay = athleteId && selectedDate
    ? getDeviceWorkoutsForDate(state, athleteId, selectedDate)
    : [];
  const deviceWorkoutLinksForDay = athleteId && selectedDate
    ? getDeviceWorkoutLinksForDate(state, athleteId, selectedDate)
    : [];
  const exerciseCount = planGroups.reduce(
    (total, group) =>
      total + group.blockItems.reduce(
        (blockTotal, item) => blockTotal + (item.block.exercises?.length ?? 0),
        0,
      ),
    0,
  );
  const hasSavedExecution = planGroups.some((group) => hasExecutionMarksForGroup(state, group));
  const executionLocked = Boolean(selectedDate && hasSavedExecution && state.executionEditDate !== selectedDate);

  if (allPlanGroups.length === 0) {
    return `
      <div class="screen-head">
        <h2>Выполнение заданий</h2>
        <p>Здесь появится тренировка после обновления данных.</p>
      </div>
      ${renderEmpty("Нет тренировки", "Назначенный день появится после обновления данных.")}
    `;
  }

  return `
    <div class="screen-head">
      <h2>Выполнение заданий</h2>
      <p>${selectedDate
        ? `${formatDayRelativeLabel(selectedDate)} · ${formatDate(selectedDate)} · ${formatAthleteExerciseCount(exerciseCount)}`
        : "Выберите день тренировки"}</p>
    </div>
    <section class="execution-panel athlete-execution-panel">
      ${renderAthleteExecutionDateFilter(dateOptions, selectedDate)}
      <div class="execution-plan-stack">
        ${planGroups.length > 0
          ? planGroups
              .map((group, index) =>
                renderExecutionPlanGroup(state, group, index === 0, true, {
                  compactAthlete: true,
                  deviceWorkoutLinks: deviceWorkoutLinksForDay,
                  deviceWorkouts: deviceWorkoutsForDay,
                  hasSavedExecution,
                  isLocked: executionLocked,
                })
              )
              .join("")
          : renderEmpty("На выбранную дату нет тренировки", "Выберите другой день из назначенного плана.")}
      </div>
      ${athleteId && selectedDate
        ? renderAthleteUnlinkedDeviceWorkouts(deviceWorkoutsForDay, deviceWorkoutLinksForDay)
        : ""}
    </section>
  `;
}

function hasExecutionMarksForGroup(state: MobileAppState, group: ExecutionPlanGroup) {
  return group.blockItems.some((item) =>
    Boolean(getExecutionResultForBlock(state, item.plan.id, item.block.id))
  );
}

function getAthleteExecutionDisplayCompletion(
  state: MobileAppState,
  planGroups: ExecutionPlanGroup[],
): ExecutionDisplayCompletion {
  return planGroups.reduce<ExecutionDisplayCompletion>((total, group) => {
    const completion = getExecutionDisplayCompletion(state, group.plan, true);

    return {
      completedCount: total.completedCount + completion.completedCount,
      missedCount: total.missedCount + completion.missedCount,
      partialCount: total.partialCount + completion.partialCount,
      totalCount: total.totalCount + completion.totalCount,
    };
  }, {
    completedCount: 0,
    missedCount: 0,
    partialCount: 0,
    totalCount: 0,
  });
}

function formatAthleteExerciseCount(count: number) {
  if (count === 0) {
    return "задания без упражнений";
  }

  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  const label = lastDigit === 1 && lastTwoDigits !== 11
    ? "упражнение"
    : lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)
      ? "упражнения"
      : "упражнений";

  return `${count} ${label}`;
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
      ${renderCoachDayCommentBlocks(dayData)}
    </section>
    ${renderCoachDayDataQualityCard(dayData)}
    ${renderCoachDeviceWorkoutPanel(dayData, state.isBusy)}
    ${renderCoachAiReviewCard(
      dayData,
      aiReview,
      aiReviewHistory,
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
  isBusy: boolean,
) {
  const currentPayloadFingerprint = getCoachDayAiPayloadFingerprint(buildCoachDayAiPayload(dayData));
  const isReviewStale = Boolean(
    review && getCoachDayAiPayloadFingerprint(review.dayPayload) !== currentPayloadFingerprint,
  );
  const actionLabel = review ? "Обновить разбор" : "Сформировать разбор";

  return `
    <section class="coach-ai-review-card">
      <div class="coach-ai-review-head">
        <div>
          <span>Разбор дня</span>
          <h3>Рекомендация тренеру</h3>
          <p>Сводка помогает быстро увидеть риски и следующий шаг. План и дневник не меняются.</p>
        </div>
        <button class="secondary-action" data-ai-athlete-id="${escapeHtml(dayData.athleteId)}" data-ai-date="${escapeHtml(dayData.date)}" data-generate-coach-ai-review type="button" ${isBusy ? "disabled" : ""}>
          ${isBusy ? "Формируется..." : actionLabel}
        </button>
      </div>
      ${isReviewStale
        ? `<p class="coach-ai-stale-warning">Данные дня изменились после последнего разбора. Обновите рекомендацию перед решением.</p>`
        : ""}
      ${review
        ? `
          <div class="coach-ai-review-result">
            <article>
              <span>Наблюдение</span>
              <p>${escapeHtml(review.observation)}</p>
            </article>
            <article>
              <span>Риски</span>
              <ul>
                ${review.riskNotes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
              </ul>
            </article>
            <article>
              <span>Следующее действие</span>
              <ul>
                ${review.tomorrowActions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
              </ul>
            </article>
          </div>
          ${renderCoachAiReviewHistory(reviewHistory)}
          <small>Сформировано: ${formatDateTime(review.generatedAt)} · ${escapeHtml(formatCoachDayAiReviewSource(review.source))}</small>
        `
        : `
          <p class="coach-ai-review-empty">
            Сформируйте разбор, когда готовы оценить день по плану, факту, готовности, данным часов и комментариям.
          </p>
          ${renderCoachAiReviewHistory(reviewHistory)}
        `}
    </section>
  `;
}

function renderCoachAiReviewHistory(reviews: CoachDayAiReview[]) {
  const serverReviews = reviews.filter((review) => review.source !== "local-rules");

  if (serverReviews.length === 0) {
    return "";
  }

  return `
    <details class="coach-ai-review-history">
      <summary>История разборов (${serverReviews.length})</summary>
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

  const today = todayValue();
  const athleteId = state.session.user.athleteId ?? null;
  const readiness = getReadinessEntryForDate(state, athleteId, today);
  const readinessTrendEntries = getRecentReadinessEntriesForAthlete(state, athleteId, 10);
  const entryDate = readiness?.entryDate ?? today;
  const deviceHealth = athleteId ? getDeviceHealthSummaryForDate(state, athleteId, entryDate) : null;
  const watchAutofill = getReadinessWatchAutofill(deviceHealth);
  const values = getReadinessFormDefaults(state, readiness, watchAutofill);
  const watchSources = getReadinessWatchFieldSources(readiness, values, watchAutofill);
  const readinessLocked = Boolean(readiness) && !state.readinessEditMode;
  const readinessDisabled = readinessLocked ? "disabled" : "";

  return `
    <div class="screen-head readiness-head">
      <h2>Готовность</h2>
      <p>${readiness ? `Сегодня: ${readiness.score} · ${formatReadinessStatus(readiness.status)}` : "Быстрый чек-ин перед тренировкой"}</p>
    </div>
    ${renderAthleteReadinessTrendCard(readinessTrendEntries, readiness)}
    <form class="mobile-form compact-form readiness-form" data-readiness-form>
      <details class="readiness-section readiness-details readiness-indicators-menu wide-field" open>
        <summary>
          <span>Показатели</span>
          <small>пульс, вес, сон и состояние</small>
        </summary>
        ${renderReadinessWatchAutofillStatus(watchSources, watchAutofill)}
        <section class="readiness-indicators-grid">
          <input name="sleepQuality" type="hidden" value="4" />
          ${renderReadinessNumberField("restingHr", "Пульс покоя", values.restingHr, {
            disabled: readinessLocked,
            max: "140",
            min: "30",
            source: watchSources.restingHr ? "watch" : null,
          })}
          <label><span>Вес</span><input name="bodyWeight" type="number" min="20" max="200" step="0.1" value="${formatInputValue(values.bodyWeight)}" ${readinessDisabled} /></label>
          ${renderReadinessNumberField("sleepHours", "Сон, часов", values.sleepHours, {
            disabled: readinessLocked,
            inputMode: "decimal",
            max: "16",
            min: "0",
            source: watchSources.sleepHours ? "watch" : null,
            step: "0.5",
          })}
          ${renderReadinessSelectField("generalFeeling", "Самочувствие", readinessFeelingOptions, getChoiceDefault(readinessFeelingOptions, values.generalFeeling), readinessLocked)}
          ${renderReadinessSelectField("fatigueLevel", "Усталость", readinessLoadOptions, getChoiceDefault(readinessLoadOptions, values.fatigueLevel), readinessLocked)}
          ${renderReadinessSelectField("painLevel", "Боль", readinessPainOptions, getChoiceDefault(readinessPainOptions, values.painLevel), readinessLocked)}
          ${renderReadinessSelectField("muscleSoreness", "Мышцы", readinessLoadOptions, getChoiceDefault(readinessLoadOptions, values.muscleSoreness), readinessLocked)}
          ${renderReadinessSelectField("motivationLevel", "Мотивация", readinessMotivationOptions, getChoiceDefault(readinessMotivationOptions, values.motivationLevel), readinessLocked)}
          <label><span>Дата</span><input name="entryDate" type="date" value="${escapeHtml(entryDate)}" ${readinessDisabled} /></label>
          <div class="readiness-flags-inline">
            <label class="check-row"><input name="illnessFlag" type="checkbox" ${values.illnessFlag ? "checked" : ""} ${readinessDisabled} /> Есть болезнь</label>
            <label class="check-row"><input name="feverFlag" type="checkbox" ${values.feverFlag ? "checked" : ""} ${readinessDisabled} /> Температура</label>
          </div>
        </section>
      </details>

      ${readinessLocked
        ? `<button class="primary-action" data-readiness-edit type="button">Редактировать готовность</button>`
        : `<button class="primary-action" type="submit">${readiness ? "Сохранить изменения" : "Сохранить готовность"}</button>`}
    </form>
    ${renderReadinessSyncMenu(state)}
  `;
}

interface ChoiceOption {
  label: string;
  value: string;
}

interface ReadinessWatchAutofill {
  restingHr: number | null;
  sleepHours: number | null;
  syncLabel: string;
}

function getReadinessFormDefaults(
  state: MobileAppState,
  readiness: ReadinessEntry | null,
  watchAutofill: ReadinessWatchAutofill | null = null,
): Omit<ReadinessSubmissionPayload, "entryDate"> {
  const todayReadiness = readiness?.entryDate === todayValue() ? readiness : null;
  const latestEntry = state.data.readinessHistory
    .slice()
    .sort((left, right) => right.entryDate.localeCompare(left.entryDate))[0] ?? readiness;

  return {
    bodyWeight: todayReadiness?.bodyWeight ?? latestEntry?.bodyWeight ?? state.session.user?.baselineWeightKg ?? 70,
    fatigueLevel: todayReadiness?.fatigueLevel ?? 2,
    feverFlag: todayReadiness?.feverFlag ?? false,
    generalFeeling: todayReadiness?.generalFeeling ?? 4,
    illnessFlag: todayReadiness?.illnessFlag ?? false,
    motivationLevel: todayReadiness?.motivationLevel ?? 4,
    muscleSoreness: todayReadiness?.muscleSoreness ?? 2,
    painLevel: todayReadiness?.painLevel ?? 0,
    restingHr: todayReadiness?.restingHr ?? watchAutofill?.restingHr ?? latestEntry?.restingHr ?? state.session.user?.baselineRestingHr ?? 60,
    sleepHours: todayReadiness?.sleepHours ?? watchAutofill?.sleepHours ?? 7.5,
    sleepQuality: todayReadiness?.sleepQuality ?? 4,
  };
}

function getReadinessWatchAutofill(summary: DeviceHealthDailySummary | null): ReadinessWatchAutofill | null {
  if (!summary) {
    return null;
  }

  const sleepHours = getDeviceSleepHoursForReadiness(summary);
  const restingHr = getDeviceRestingHrForReadiness(summary);

  if (sleepHours === null && restingHr === null) {
    return null;
  }

  return {
    restingHr,
    sleepHours,
    syncLabel: formatReadinessDeviceHealthSyncLabel(summary),
  };
}

function getReadinessWatchFieldSources(
  readiness: ReadinessEntry | null,
  values: Omit<ReadinessSubmissionPayload, "entryDate">,
  watchAutofill: ReadinessWatchAutofill | null,
) {
  const restingHr = watchAutofill?.restingHr ?? null;
  const sleepHours = watchAutofill?.sleepHours ?? null;

  return {
    restingHr: restingHr !== null && readiness === null && areReadinessNumbersClose(values.restingHr, restingHr),
    sleepHours: sleepHours !== null && readiness === null && areReadinessNumbersClose(values.sleepHours, sleepHours),
  };
}

function areReadinessNumbersClose(left: number, right: number) {
  return Math.abs(left - right) < 0.05;
}

function renderReadinessWatchAutofillStatus(
  sources: { restingHr: boolean; sleepHours: boolean },
  watchAutofill: ReadinessWatchAutofill | null,
) {
  const filled = [
    sources.sleepHours ? "сон" : null,
    sources.restingHr ? "пульс" : null,
  ].filter((item): item is string => Boolean(item));

  if (!watchAutofill || filled.length === 0) {
    return "";
  }

  return `
    <p class="readiness-watch-autofill-status" data-readiness-watch-status>
      Часы: ${escapeHtml(filled.join(" и "))} подставлены · ${escapeHtml(watchAutofill.syncLabel)}
    </p>
  `;
}

function renderReadinessResultCard(entry: ReadinessEntry | null) {
  if (!entry) {
    return `
      <section class="readiness-result-card is-empty">
        <div>
          <span>Сегодня</span>
          <strong>—</strong>
        </div>
        <p>Готовность ещё не отправлена.</p>
      </section>
    `;
  }

  const reasons = getReadinessReasonLabels(entry).slice(0, 3);

  return `
    <section class="readiness-result-card readiness-${escapeHtml(entry.status)}">
      <div>
        <span>${formatDate(entry.entryDate)}</span>
        <strong>${entry.score}</strong>
      </div>
      <article>
        <h3>${escapeHtml(formatReadinessStatus(entry.status))}</h3>
        <ul>
          ${reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}
        </ul>
      </article>
    </section>
  `;
}

function renderAthleteReadinessTrendCard(entries: ReadinessEntry[], todayEntry: ReadinessEntry | null) {
  const latestEntry = todayEntry ?? entries[entries.length - 1] ?? null;
  const trend = getReadinessTrendDelta(entries);
  const trendClass = getReadinessTrendClass(trend);
  const reasonRows = latestEntry ? getReadinessPriorityRows(latestEntry).slice(0, 5) : [];

  if (!latestEntry) {
    return `
      <section class="readiness-trend-card is-empty">
        <div class="readiness-trend-head">
          <div>
            <span>Тренд готовности</span>
            <h3>Пока нет данных</h3>
            <p>Сохрани первый чек-ин, и здесь появится динамика состояния.</p>
          </div>
          <strong>—</strong>
        </div>
      </section>
    `;
  }

  return `
    <section class="readiness-trend-card readiness-${escapeHtml(latestEntry.status)}">
      <div class="readiness-trend-head">
        <div>
          <span>Тренд готовности</span>
          <h3>${escapeHtml(formatReadinessStatus(latestEntry.status))}</h3>
          <p>${formatDate(latestEntry.entryDate)} · ${escapeHtml(formatReadinessFlags(latestEntry))}</p>
        </div>
        <strong>${latestEntry.score}</strong>
      </div>
      <div class="readiness-trend-chart">
        <div class="readiness-trend-chart-meta">
          <span>Последние дни</span>
          <em class="readiness-trend-chip is-${trendClass}">${escapeHtml(formatReadinessTrendDelta(trend))}</em>
        </div>
        ${renderReadinessTrendSvg(entries, "readiness-trend-svg")}
      </div>
      <div class="readiness-factor-list">
        ${reasonRows.map(renderReadinessFactorRow).join("")}
      </div>
    </section>
  `;
}

interface ReadinessFactorRow {
  detail: string;
  label: string;
  severity: "good" | "risk" | "watch";
  value: string;
}

function renderReadinessFactorRow(row: ReadinessFactorRow) {
  return `
    <article class="readiness-factor-row is-${row.severity}">
      <span>${escapeHtml(row.label)}</span>
      <strong>${escapeHtml(row.value)}</strong>
      <small>${escapeHtml(row.detail)}</small>
    </article>
  `;
}

function renderReadinessTrendSvg(entries: ReadinessEntry[], className: string) {
  const chartEntries = entries.slice(-10);

  if (chartEntries.length === 0) {
    return "";
  }

  const width = 280;
  const height = 96;
  const horizontalPadding = 10;
  const verticalPadding = 12;
  const denominator = Math.max(chartEntries.length - 1, 1);
  const points = chartEntries.map((entry, index) => {
    const x = horizontalPadding + ((width - horizontalPadding * 2) * index) / denominator;
    const normalizedScore = Math.max(0, Math.min(100, entry.score));
    const y = height - verticalPadding - ((height - verticalPadding * 2) * normalizedScore) / 100;
    return { entry, x, y };
  });
  const polyline = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");

  return `
    <svg class="${escapeHtml(className)}" viewBox="0 0 ${width} ${height}" role="img" aria-label="График готовности">
      <line x1="10" y1="22" x2="270" y2="22"></line>
      <line x1="10" y1="48" x2="270" y2="48"></line>
      <line x1="10" y1="74" x2="270" y2="74"></line>
      <polyline points="${polyline}"></polyline>
      ${points.map((point) => `
        <circle class="readiness-${escapeHtml(point.entry.status)}" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="4.2"></circle>
      `).join("")}
    </svg>
  `;
}

function renderReadinessTrendDots(entries: ReadinessEntry[]) {
  return `
    <div class="readiness-trend-dots">
      ${entries.slice(-7).map((entry) => `
        <span class="readiness-${escapeHtml(entry.status)}">
          <i>${entry.score}</i>
          <small>${formatShortDate(entry.entryDate)}</small>
        </span>
      `).join("")}
    </div>
  `;
}

function renderReadinessSyncMenu(state: MobileAppState) {
  const pendingQueue = getPendingQueueItems(state.queue);
  const invalidQueue = getInvalidQueueItems(state.queue);
  const savedLabel = state.data.savedAt
    ? `обновлено ${formatDateTime(state.data.savedAt)}`
    : "данные ещё не обновлялись";
  const queueLabel = pendingQueue.length
    ? `очередь: ${pendingQueue.length}`
    : invalidQueue.length
      ? `не отправляется: ${invalidQueue.length}`
      : "очередь пустая";

  return `
    <details class="readiness-section readiness-details readiness-utility-menu wide-field">
      <summary>
        <span>Обновление</span>
        <small>${escapeHtml(savedLabel)} · ${escapeHtml(queueLabel)}</small>
      </summary>
      <section class="readiness-utility-actions">
        <button class="secondary-action" data-refresh type="button" ${state.isBusy ? "disabled" : ""}>Обновить данные</button>
        <button class="secondary-action" data-sync type="button" ${state.isSyncing || pendingQueue.length === 0 ? "disabled" : ""}>
          Отправить очередь${pendingQueue.length ? ` (${pendingQueue.length})` : ""}
        </button>
      </section>
    </details>
  `;
}

function renderReadinessDeviceHealthMenu(state: MobileAppState, athleteId: string, date: string) {
  const summary = getDeviceHealthSummaryForDate(state, athleteId, date);
  const status = getDeviceHealthStatus(summary);
  const syncLabel = formatReadinessDeviceHealthSyncLabel(summary);

  return `
    <details class="readiness-section readiness-details readiness-utility-menu wide-field">
      <summary>
        <span>Данные часов</span>
        <small>${escapeHtml(status.statusLabel)} · ${escapeHtml(syncLabel)}</small>
      </summary>
      <section class="readiness-device-health-body">
        ${renderDeviceHealthCard(state, athleteId, date, { compact: true, diagnosticsCollapsed: true })}
      </section>
    </details>
  `;
}

function getReadinessReasonLabels(entry: ReadinessEntry) {
  const labels = entry.explanation
    .filter((reason) => reason.impact < 0)
    .map((reason) => {
      if (reason.code === "fever") {
        return "отмечена температура";
      }
      if (reason.code === "illness") {
        return "есть симптомы болезни";
      }
      if (reason.code === "sleep_hours") {
        return `сон ${formatReadinessNumber(entry.sleepHours)} ч`;
      }
      if (reason.code === "sleep_quality") {
        return "низкое качество сна";
      }
      if (reason.code === "fatigue") {
        return `усталость ${entry.fatigueLevel}/5`;
      }
      if (reason.code === "soreness") {
        return `мышцы ${entry.muscleSoreness}/5`;
      }
      if (reason.code === "pain") {
        return `боль ${entry.painLevel}/10`;
      }
      if (reason.code === "resting_hr") {
        return "пульс покоя выше обычного";
      }

      return reason.label;
    });

  if (labels.length > 0) {
    return labels;
  }

  if (entry.status === "green") {
    return ["красных флагов нет", `сон ${formatReadinessNumber(entry.sleepHours)} ч`, `пульс ${entry.restingHr}`];
  }

  return ["общая оценка ниже обычного", `сон ${formatReadinessNumber(entry.sleepHours)} ч`, `самочувствие ${entry.generalFeeling}/5`];
}

function getReadinessPriorityRows(entry: ReadinessEntry): ReadinessFactorRow[] {
  const rows = buildReadinessFactorRows(entry);
  const rank: Record<ReadinessFactorRow["severity"], number> = {
    good: 0,
    watch: 1,
    risk: 2,
  };

  return rows.slice().sort((left, right) => rank[right.severity] - rank[left.severity]);
}

function buildReadinessFactorRows(entry: ReadinessEntry): ReadinessFactorRow[] {
  const rows: ReadinessFactorRow[] = [];

  if (entry.feverFlag) {
    rows.push({
      detail: "тренировку лучше согласовать с тренером",
      label: "Температура",
      severity: "risk",
      value: "отмечена",
    });
  }

  if (entry.illnessFlag) {
    rows.push({
      detail: "есть симптомы, нагрузку надо пересмотреть",
      label: "Болезнь",
      severity: "risk",
      value: "да",
    });
  }

  rows.push(
    {
      detail: getRestingHrReadinessDetail(entry),
      label: "Пульс",
      severity: getRestingHrReadinessSeverity(entry),
      value: `${entry.restingHr}`,
    },
    {
      detail: entry.sleepHours < 6.5 ? "мало сна, восстановление под вопросом" : "сон в рабочем диапазоне",
      label: "Сон",
      severity: entry.sleepHours < 6 ? "risk" : entry.sleepHours < 7 ? "watch" : "good",
      value: `${formatReadinessNumber(entry.sleepHours)} ч`,
    },
    {
      detail: entry.fatigueLevel >= 4 ? "снизить интенсивность или объём" : "усталость приемлемая",
      label: "Усталость",
      severity: entry.fatigueLevel >= 4 ? "risk" : entry.fatigueLevel >= 3 ? "watch" : "good",
      value: `${entry.fatigueLevel}/5`,
    },
    {
      detail: entry.painLevel >= 5 ? "нужна ручная проверка зоны боли" : entry.painLevel > 0 ? "контролировать по ходу тренировки" : "боли нет",
      label: "Боль",
      severity: entry.painLevel >= 5 ? "risk" : entry.painLevel > 0 ? "watch" : "good",
      value: `${entry.painLevel}/10`,
    },
    {
      detail: entry.muscleSoreness >= 4 ? "мышцы перегружены, осторожнее с тяжёлой работой" : "мышцы в рабочем состоянии",
      label: "Мышцы",
      severity: entry.muscleSoreness >= 4 ? "risk" : entry.muscleSoreness >= 3 ? "watch" : "good",
      value: `${entry.muscleSoreness}/5`,
    },
    {
      detail: entry.generalFeeling <= 2 ? "самочувствие низкое, нужен контроль" : "самочувствие без острого риска",
      label: "Самочувствие",
      severity: entry.generalFeeling <= 2 ? "risk" : entry.generalFeeling <= 3 ? "watch" : "good",
      value: `${entry.generalFeeling}/5`,
    },
    {
      detail: entry.motivationLevel <= 2 ? "низкая мотивация, лучше держать простые задачи" : "мотивация достаточная",
      label: "Мотивация",
      severity: entry.motivationLevel <= 2 ? "watch" : "good",
      value: `${entry.motivationLevel}/5`,
    },
  );

  return rows;
}

function getRestingHrReadinessSeverity(entry: ReadinessEntry): ReadinessFactorRow["severity"] {
  const hasNegativeRestingHrReason = entry.explanation.some((reason) =>
    reason.code === "resting_hr" && reason.impact < 0
  );

  if (hasNegativeRestingHrReason || entry.restingHr >= 82) {
    return "risk";
  }

  if (entry.restingHr >= 74) {
    return "watch";
  }

  return "good";
}

function getRestingHrReadinessDetail(entry: ReadinessEntry) {
  const hasNegativeRestingHrReason = entry.explanation.some((reason) =>
    reason.code === "resting_hr" && reason.impact < 0
  );

  if (hasNegativeRestingHrReason || entry.restingHr >= 82) {
    return "выше обычного, проверь восстановление";
  }

  if (entry.restingHr >= 74) {
    return "слегка повышен, наблюдать в разминке";
  }

  return "в спокойном диапазоне";
}

function getChoiceDefault(options: ChoiceOption[], value: number) {
  const exactValue = String(value);

  if (options.some((option) => option.value === exactValue)) {
    return exactValue;
  }

  const numericValue = Number(value);
  const closest = options
    .map((option) => ({ option, distance: Math.abs(Number(option.value) - numericValue) }))
    .filter((item) => Number.isFinite(item.distance))
    .sort((left, right) => left.distance - right.distance)[0]?.option.value;

  return closest ?? options[0]?.value ?? "";
}

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

function renderReadinessNumberField(
  name: string,
  label: string,
  value: number,
  options: {
    disabled?: boolean;
    inputMode?: string;
    max?: string;
    min?: string;
    source?: "watch" | null;
    step?: string;
  } = {},
) {
  const inputMode = options.inputMode ? ` inputmode="${escapeHtml(options.inputMode)}"` : "";
  const max = options.max ? ` max="${escapeHtml(options.max)}"` : "";
  const min = options.min ? ` min="${escapeHtml(options.min)}"` : "";
  const step = options.step ? ` step="${escapeHtml(options.step)}"` : "";
  const disabled = options.disabled ? " disabled" : "";
  const watchField = options.source === "watch" ? " data-readiness-watch-field" : "";

  return `
    <label class="readiness-number-field">
      <div class="readiness-field-top">
        <span>${escapeHtml(label)}</span>
        ${options.source === "watch" ? `<b data-readiness-field-source>с часов</b>` : ""}
      </div>
      <input name="${escapeHtml(name)}" type="number"${min}${max}${step}${inputMode} value="${formatInputValue(value)}"${disabled}${watchField} />
    </label>
  `;
}

function renderReadinessSelectField(
  name: string,
  label: string,
  options: ChoiceOption[],
  defaultValue: string,
  disabled = false,
) {
  return `
    <label class="readiness-select-field">
      <span>${escapeHtml(label)}</span>
      <select name="${escapeHtml(name)}" ${disabled ? "disabled" : ""}>
        ${options.map((option) => `
          <option value="${escapeHtml(option.value)}" ${option.value === defaultValue ? "selected" : ""}>
            ${escapeHtml(option.label)}
          </option>
        `).join("")}
      </select>
    </label>
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

interface ExecutionPlanGroupRenderOptions {
  compactAthlete?: boolean;
  deviceWorkoutLinks?: DeviceWorkoutLink[];
  deviceWorkouts?: DeviceWorkout[];
  hasSavedExecution?: boolean;
  isLocked?: boolean;
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
  athleteExecutionNote: string;
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

function getAthleteExecutionSelectedDate(
  state: MobileAppState,
  options: Array<{ date: string; label: string }>,
) {
  if (options.length === 0) {
    return "";
  }

  const selectedDate = state.executionDateFilter ?? state.selectedDayDate;

  if (selectedDate && options.some((option) => option.date === selectedDate)) {
    return selectedDate;
  }

  const today = todayValue();
  return options.find((option) => option.date === today)?.date ?? options[0].date;
}

function renderAthleteExecutionDateFilter(
  options: Array<{ date: string; label: string }>,
  selectedDate: string,
) {
  if (options.length === 0) {
    return "";
  }

  return `
    <label class="execution-date-filter athlete-execution-date-filter">
      <span>День тренировки</span>
      <select data-execution-date-filter>
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
  preferExerciseItems = false,
): ExecutionDisplayCompletion {
  const completion: ExecutionDisplayCompletion = {
    completedCount: 0,
    missedCount: 0,
    partialCount: 0,
    totalCount: 0,
  };

  for (const session of plan.day.sessions) {
    if (!preferExerciseItems && isSessionLevelPlanUnit(session)) {
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
      const result = getExecutionResultForBlock(state, plan.id, block.id);
      const exercises = block.exercises ?? [];

      if (preferExerciseItems && exercises.length > 0) {
        const shouldInheritBlockCompletion = result?.completed && !(result.exerciseResults?.length);

        for (const exercise of exercises) {
          const status = shouldInheritBlockCompletion
            ? "completed"
            : getExecutionExerciseStatus(getExerciseResult(result, exercise.id));
          completion.totalCount += 1;
          if (status === "completed") {
            completion.completedCount += 1;
          } else if (status === "partial") {
            completion.partialCount += 1;
          } else {
            completion.missedCount += 1;
          }
        }
        continue;
      }

      const status = getExecutionBlockStatus(block, result);
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
  options: ExecutionPlanGroupRenderOptions = {},
) {
  const compactAthlete = options.compactAthlete === true;
  const isLocked = options.isLocked === true;
  const displayUnitCount = countPlanDisplayUnits(group.plan);
  const canSubmitCoachDiary = state.session.user?.role === "coach" || state.session.user?.role === "admin";
  const diaryEntries = getCoachDiaryEntriesForPlan(state, group.plan.id);
  const daySummary = getExecutionDaySummary(state, group, diaryEntries);
  const displayCompletion = getExecutionDisplayCompletion(state, group.plan, compactAthlete);
  const canLinkDeviceWorkouts = compactAthlete &&
    canSubmitExecution &&
    state.session.user?.role === "athlete";
  const renderOptions: ExecutionPlanGroupRenderOptions = {
    ...options,
    deviceWorkoutLinks: options.deviceWorkoutLinks ?? (
      canLinkDeviceWorkouts
        ? getDeviceWorkoutLinksForDate(state, group.plan.athleteId, group.plan.day.dayDate)
        : []
    ),
    deviceWorkouts: options.deviceWorkouts ?? (
      canLinkDeviceWorkouts
        ? getDeviceWorkoutsForDate(state, group.plan.athleteId, group.plan.day.dayDate)
        : []
    ),
  };
  const exerciseCount = group.blockItems.reduce(
    (total, item) => total + (item.block.exercises?.length ?? 0),
    0,
  );

  return `
    <details class="execution-plan-group mobile-plan-day-card mobile-execution-day-card ${compactAthlete ? "is-athlete-compact" : ""}" data-execution-plan-group ${isOpen ? "open" : ""}>
      <summary class="mobile-plan-day-card-head">
        <div>
          <strong>${compactAthlete
            ? `${escapeHtml(formatDayRelativeLabel(group.plan.day.dayDate))} · ${formatDate(group.plan.day.dayDate)}`
            : `${formatDate(group.plan.day.dayDate)} · ${escapeHtml(group.plan.day.label)}`}</strong>
          <span>${compactAthlete
            ? `${formatAthleteExerciseCount(exerciseCount)}`
            : `${escapeHtml(group.plan.templateName)} · ${formatPlanUnitCount(displayUnitCount)} · ${exerciseCount} упр.`}</span>
          <div class="execution-day-meta ${compactAthlete ? "is-athlete-compact" : ""}">
            ${compactAthlete
              ? `<span>${displayCompletion.completedCount}/${displayCompletion.totalCount} отмечено</span>`
              : `
              <span class="execution-day-status is-${daySummary.status}">${escapeHtml(daySummary.statusLabel)}</span>
              <span>${displayCompletion.completedCount}/${displayCompletion.totalCount} отмечено</span>
              <span>Факт нагрузки: ${formatLoadValue(daySummary.actualLoad)}</span>
              <span>План: ${formatLoadValue(daySummary.plannedLoad)}</span>
            `}
          </div>
        </div>
        ${compactAthlete ? "" : `<em>${displayCompletion.completedCount}/${displayCompletion.totalCount}</em>`}
      </summary>
      <div class="mobile-plan-day-card-body">
        ${compactAthlete ? renderAthleteCoachDayNote(daySummary.latestDiaryEntry) : renderExecutionDayAnalyticsCard(daySummary, displayCompletion)}
        ${group.plan.day.sessions.map((session) => `
          <section class="mobile-plan-session" data-execution-session>
            <h4>${escapeHtml(session.name)}</h4>
            ${isSessionLevelPlanUnit(session) && !compactAthlete
              ? renderExecutionUnifiedSession(state, group.plan, session, canSubmitExecution, options)
              : `
                <div class="mobile-plan-table ${compactAthlete ? "is-athlete-simple" : ""}">
                  ${compactAthlete ? "" : `
                    <div class="mobile-plan-table-head">
                      <span>Блок</span>
                      <span>Объём</span>
                    </div>
                  `}
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
                            renderOptions,
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
            ${canLinkDeviceWorkouts
              ? renderAthleteSessionDeviceWorkoutLinkSelect(group.plan, session, renderOptions)
              : ""}
            ${canSubmitExecution || getExecutionSessionNote(state, group.plan.id, session)
              ? renderExecutionSessionNoteField(
                  state,
                  group.plan,
                  session,
                  isLocked || !canSubmitExecution,
                  compactAthlete,
                )
              : ""}
          </section>
        `).join("")}
        ${canSubmitExecution ? `
          <div class="mobile-execution-day-actions">
            ${isLocked
              ? `<button class="primary-action" type="button" data-execution-edit-day="${escapeHtml(group.plan.day.dayDate)}">Редактировать выполнение</button>`
              : `<button class="primary-action" type="button" data-execution-save-day ${state.isBusy ? "disabled" : ""}>
                  ${state.isBusy ? "Сохранение..." : options.hasSavedExecution ? "Сохранить изменения" : "Сохранить выполнение"}
                </button>`}
          </div>
        ` : ""}
        ${canSubmitCoachDiary ? renderCoachDiaryForm(group, diaryEntries) : ""}
      </div>
    </details>
  `;
}

function renderAthleteCoachDayNote(entry: CoachDiaryEntry | null) {
  if (!entry) {
    return "";
  }

  return `
    <aside class="athlete-coach-day-note">
      <strong>Комментарий тренера</strong>
      <p>${escapeHtml(entry.notes)}</p>
      <small>${escapeHtml(entry.coachName)} · ${formatDateTime(entry.updatedAt)}</small>
    </aside>
  `;
}

function renderExecutionSessionNoteField(
  state: MobileAppState,
  plan: AssignedPlanSummary,
  session: MobileAssignedPlanSession,
  disabled = false,
  athleteDiary = false,
) {
  const sessionName = formatExecutionSessionDiaryName(session.name);
  const label = athleteDiary
    ? `Дневник тренировки: ${sessionName}`
    : `Комментарий спортсмена: ${sessionName}`;
  const hint = athleteDiary
    ? ""
    : "Заметка спортсмена только по этой тренировке, без комментариев под каждым упражнением.";
  const placeholder = athleteDiary
    ? "Как прошла эта тренировка: что получилось, что было тяжело, самочувствие после"
    : "Коротко: что получилось, что было тяжело";

  return `
    <label class="execution-day-note ${athleteDiary ? "is-athlete-diary" : ""}">
      <span>${label}</span>
      ${hint ? `<small>${hint}</small>` : ""}
      <textarea data-execution-session-notes rows="3" placeholder="${placeholder}" ${disabled ? "disabled" : ""}>${escapeHtml(getExecutionSessionNote(state, plan.id, session))}</textarea>
    </label>
  `;
}

function renderAthleteSessionDeviceWorkoutLinkSelect(
  plan: AssignedPlanSummary,
  session: MobileAssignedPlanSession,
  options: ExecutionPlanGroupRenderOptions,
) {
  const targetBlocks = getAthleteSessionDeviceWorkoutTargetBlocks(session);

  if (targetBlocks.length <= 1) {
    return "";
  }

  return renderAthleteDeviceWorkoutLinkSelect({
    assignedBlockIds: targetBlocks.map((block) => block.id),
    assignedExerciseId: null,
    assignedPlanId: plan.id,
    disabled: options.isLocked === true,
    hint: `${targetBlocks.length} строк плана, если тренировка покрывает всю ${formatExecutionSessionDiaryName(session.name).toLowerCase()}`,
    links: options.deviceWorkoutLinks ?? [],
    targetLabel: `Вся ${formatExecutionSessionDiaryName(session.name).toLowerCase()}`,
    targetType: "session",
    workouts: options.deviceWorkouts ?? [],
  });
}

function renderAthleteDeviceWorkoutLinkForBlock(
  plan: AssignedPlanSummary,
  block: AssignedPlanBlock,
  options: ExecutionPlanGroupRenderOptions,
) {
  if (!canRenderAthleteDeviceWorkoutLinkForBlock(block)) {
    return "";
  }

  const target = getAthleteBlockDeviceWorkoutTarget(block);

  return renderAthleteDeviceWorkoutLinkSelect({
    assignedBlockIds: [block.id],
    assignedExerciseId: target.exercise?.id ?? null,
    assignedPlanId: plan.id,
    disabled: options.isLocked === true,
    hint: target.hint,
    links: options.deviceWorkoutLinks ?? [],
    targetLabel: target.label,
    targetType: target.exercise ? "exercise" : "block",
    workouts: options.deviceWorkouts ?? [],
  });
}

function canRenderAthleteDeviceWorkoutLinkForBlock(block: AssignedPlanBlock) {
  const rowKind = block.rowKind ?? "exercise";

  if (rowKind === "exercise" || rowKind === "workout") {
    return true;
  }

  if (rowKind === "instruction") {
    return isDeviceWorkoutLinkablePlanBlock(block);
  }

  return false;
}

function renderAthleteDeviceWorkoutLinkSelect(input: {
  assignedBlockIds: string[];
  assignedExerciseId: string | null;
  assignedPlanId: string;
  disabled: boolean;
  hint: string;
  links: DeviceWorkoutLink[];
  targetLabel: string;
  targetType: "exercise" | "block" | "session";
  workouts: DeviceWorkout[];
}) {
  if (input.workouts.length === 0 || input.assignedBlockIds.length === 0) {
    return "";
  }

  const linkGroup = getDeviceWorkoutLinkGroupForTarget(
    input.links,
    input.assignedBlockIds,
    input.assignedExerciseId,
  );
  const linkedWorkout = linkGroup.linkedWorkout;
  const statusLabel = linkedWorkout && linkGroup.isFullyLinked
    ? "привязано"
    : linkGroup.isPartiallyLinked || linkGroup.hasMixedWorkouts
      ? "частично"
      : "не привязано";

  return `
    <div class="athlete-device-workout-link is-${escapeHtml(input.targetType)} ${linkedWorkout ? "is-linked" : ""}">
      <div class="athlete-device-workout-link-head">
        <span>Тренировка часов</span>
        <strong>${escapeHtml(input.targetLabel)}</strong>
        <small>${escapeHtml(input.hint)}</small>
      </div>
      <div class="athlete-device-workout-control">
        <span>${escapeHtml(statusLabel)}</span>
        <select
          data-device-workout-link
          data-device-workout-plan-id="${escapeHtml(input.assignedPlanId)}"
          data-device-workout-block-ids="${escapeHtml(input.assignedBlockIds.join(","))}"
          data-device-workout-link-ids="${escapeHtml(linkGroup.links.map((link) => link.id).join(","))}"
          ${input.assignedExerciseId ? `data-device-workout-exercise-id="${escapeHtml(input.assignedExerciseId)}"` : ""}
          ${input.disabled ? "disabled" : ""}
        >
          <option value="">Не привязано</option>
          ${input.workouts.map((workout) => `
            <option value="${escapeHtml(workout.id)}" ${!linkGroup.hasMixedWorkouts && linkedWorkout?.id === workout.id ? "selected" : ""}>
              ${escapeHtml(formatDeviceWorkoutOptionLabel(workout))}
            </option>
          `).join("")}
        </select>
      </div>
      ${linkedWorkout ? `<small class="athlete-device-workout-linked-summary">${escapeHtml(formatDeviceWorkoutSummary(linkedWorkout) || formatDeviceWorkoutTypeLabel(linkedWorkout))}</small>` : ""}
    </div>
  `;
}

function renderAthleteUnlinkedDeviceWorkouts(
  workouts: DeviceWorkout[],
  links: DeviceWorkoutLink[],
) {
  if (workouts.length === 0) {
    return "";
  }

  const linkedWorkoutIds = new Set(links.map((link) => link.deviceWorkoutId));
  const unlinkedWorkouts = workouts.filter((workout) => !linkedWorkoutIds.has(workout.id));

  return `
    <aside class="athlete-device-workout-unlinked">
      <div class="athlete-device-workout-unlinked-head">
        <span>Внеплановые тренировки часов</span>
        <strong>${unlinkedWorkouts.length ? `${unlinkedWorkouts.length} без привязки` : "всё связано с планом"}</strong>
      </div>
      ${unlinkedWorkouts.length
        ? `<div class="athlete-device-workout-unlinked-list">
            ${unlinkedWorkouts.map((workout) => `
              <article>
                <strong>${escapeHtml(formatDeviceWorkoutTitle(workout))}</strong>
                <small>${escapeHtml(formatDeviceWorkoutSummary(workout) || "Можно оставить вне плана или привязать выше.")}</small>
              </article>
            `).join("")}
          </div>`
        : `<p>Все тренировки часов за день уже подтверждены в плане.</p>`}
    </aside>
  `;
}

function getAthleteBlockDeviceWorkoutTarget(block: AssignedPlanBlock) {
  const exercises = getSortedBlockExercises(block);
  const singleExercise = exercises.length === 1 ? exercises[0] : getRepeatedSingleExerciseBlock(block);

  if (singleExercise) {
    return {
      exercise: singleExercise,
      hint: formatAssignedPlanExerciseVolume(singleExercise) || formatAssignedPlanDisplayVolume(block),
      label: `К упражнению: ${singleExercise.name}`,
    };
  }

  return {
    exercise: null,
    hint: formatAssignedPlanDisplayVolume(block),
    label: `К блоку: ${block.name}`,
  };
}

function getAthleteSessionDeviceWorkoutTargetBlocks(session: MobileAssignedPlanSession) {
  if (session.deviceLinkMode === "none") {
    return [];
  }

  if (session.deviceLinkMode === "block") {
    return [];
  }

  const linkableBlocks = session.blocks.filter((block) => isDeviceWorkoutLinkablePlanBlock(block));
  const fallbackBlocks = session.blocks.filter((block) =>
    !["instruction", "control", "note", "recovery"].includes(block.rowKind ?? "exercise")
  );

  return linkableBlocks.length ? linkableBlocks : fallbackBlocks;
}

function renderExecutionUnifiedSession(
  state: MobileAppState,
  plan: AssignedPlanSummary,
  session: MobileAssignedPlanSession,
  canSubmitExecution: boolean,
  options: ExecutionPlanGroupRenderOptions = {},
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
        <input name="completed" type="checkbox" ${status === "completed" ? "checked" : ""} ${options.isLocked ? "disabled" : ""} />
        <span>
          <strong>${options.compactAthlete ? "Сессия выполнена" : "Отметить всю сессию"}</strong>
          <small>${options.compactAthlete ? `${session.blocks.length} заданий` : "Все строки этой сессии сохраняются вместе."}</small>
        </span>
      </label>
      ${renderUnifiedSessionPlanTable(session)}
    </form>
  `;
}

function renderUnifiedSessionPlanTable(session: MobileAssignedPlanSession) {
  return `
    <div class="mobile-plan-table mobile-unified-plan-table">
      <div class="mobile-plan-table-head">
        <span>Блок</span>
        <span>Объём</span>
      </div>
      ${session.blocks.map((block) => `
        <div class="mobile-plan-row mobile-unified-plan-row">
          <span class="mobile-plan-exercise-name-static">${renderTrainingTextWithAbbreviationHints(block.name)}</span>
          <span class="mobile-plan-cell mobile-plan-volume">${renderTrainingTextWithAbbreviationHints(formatUnifiedSessionBlockTarget(block))}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function getSortedBlockExercises(block: AssignedPlanBlock) {
  return (block.exercises ?? []).slice().sort((a, b) => a.orderIndex - b.orderIndex);
}

function normalizeRepeatedExerciseName(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function getRepeatedSingleExerciseBlock<TExercise extends { name: string }>(
  block: { name: string; exercises?: TExercise[] | null },
) {
  const exercises = block.exercises ?? [];

  if (exercises.length !== 1) {
    return null;
  }

  const [exercise] = exercises;
  const blockName = normalizeRepeatedExerciseName(block.name);
  const exerciseName = normalizeRepeatedExerciseName(exercise.name);

  return blockName && blockName === exerciseName ? exercise : null;
}

function isRepeatedSingleExerciseBlock(block: { name: string; exercises?: Array<{ name: string }> | null }) {
  return Boolean(getRepeatedSingleExerciseBlock(block));
}

function formatUnifiedSessionBlockTarget(block: AssignedPlanBlock) {
  return formatAssignedPlanDisplayVolume(block);
}

function formatAssignedPlanDisplayVolume(block: AssignedPlanBlock) {
  const exercises = getSortedBlockExercises(block);

  if (exercises.length === 0) {
    return formatAssignedPlanBlockVolume(block);
  }

  if (exercises.length === 1) {
    return formatAssignedPlanExerciseVolume(exercises[0]);
  }

  const exerciseVolumes = exercises
    .map((exercise) => {
      const volume = formatAssignedPlanExerciseVolume(exercise);
      const blockName = normalizeRepeatedExerciseName(block.name);
      const exerciseName = normalizeRepeatedExerciseName(exercise.name);

      if (!volume || volume === "-") {
        return "";
      }

      return blockName && exerciseName !== blockName ? `${exercise.name}: ${volume}` : volume;
    })
    .filter(Boolean);

  return exerciseVolumes.length > 0
    ? exerciseVolumes.join("; ")
    : formatAssignedPlanBlockVolume(block);
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
  const latestEntry = entries[0] ?? null;

  return `
    <form class="coach-diary-form" data-coach-diary-form>
      <input name="athleteId" type="hidden" value="${escapeHtml(group.plan.athleteId)}" />
      <input name="assignedPlanId" type="hidden" value="${escapeHtml(group.plan.id)}" />
      <div class="coach-diary-head">
        <div>
          <strong>Запись тренера за день</strong>
          <span>${latestEntry ? `Последняя: ${formatDateTime(latestEntry.updatedAt)}` : "Общий комментарий к дню"}</span>
        </div>
      </div>
      <label class="coach-diary-date">
        <span>Дата записи</span>
        <input name="entryDate" type="date" value="${escapeHtml(group.plan.day.dayDate)}" readonly />
      </label>
      <label class="coach-diary-note">
        <span>Комментарий</span>
        <textarea name="notes" rows="3" placeholder="Наблюдение, решение или рекомендация на этот день"></textarea>
      </label>
      <button class="primary-action" type="submit">Сохранить запись</button>
    </form>
  `;
}

function renderExecutionBlockReadonly(item: ExecutionBlockItem, result: ExecutionResult | null) {
  const exercises = item.block.exercises ?? [];
  const repeatedExercise = getRepeatedSingleExerciseBlock(item.block);
  const visibleExercises = repeatedExercise ? [] : exercises;
  const plannedLoad = getExecutionBlockPlannedLoad(item.block, result);
  const actualLoad = getExecutionBlockActualLoad(item.block, result, plannedLoad);

  return `
    <article class="mobile-plan-row mobile-execution-row execution-readonly-row">
      <div class="mobile-plan-exercise-name">
        <span>
          <strong>${renderTrainingTextWithAbbreviationHints(item.block.name)}</strong>
          <small>${escapeHtml(formatExecutionResultStatus(result))}</small>
        </span>
      </div>
      <span class="mobile-plan-cell mobile-plan-work">${renderTrainingTextWithAbbreviationHints(
        repeatedExercise ? formatExerciseWorkCell(repeatedExercise) : formatBlockTarget(item.block),
      )}</span>
      <div class="execution-block-load">
        <span>Нагрузка блока</span>
        <strong>Факт ${formatLoadValue(actualLoad)} / план ${formatLoadValue(plannedLoad)}</strong>
        <small>${escapeHtml(formatExecutionBlockLoadDelta(actualLoad, plannedLoad))}</small>
      </div>
      ${visibleExercises.length > 0 ? `
        <div class="execution-readonly-exercises">
          ${visibleExercises
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
        <strong>${renderTrainingTextWithAbbreviationHints(exercise.name)}</strong>
        <small>Факт: ${renderTrainingTextWithAbbreviationHints(formatExerciseActualDetails(result))}</small>
        <small>План: ${renderTrainingTextWithAbbreviationHints(formatExerciseWorkCell(exercise))}</small>
      </span>
      <em>${escapeHtml(formatExerciseResultStatus(result))}</em>
    </div>
  `;
}

function renderExecutionBlockForm(
  item: ExecutionBlockItem,
  result: ExecutionResult | null,
  options: ExecutionPlanGroupRenderOptions = {},
) {
  const exercises = item.block.exercises ?? [];
  return `
    <form class="mobile-execution-row-form" data-execution-form>
      <input name="assignedPlanId" type="hidden" value="${escapeHtml(item.plan.id)}" />
      <input name="assignedBlockId" type="hidden" value="${escapeHtml(item.block.id)}" />
      ${options.compactAthlete
        ? renderExecutionBlockFallbackRow(item.block, result, options)
        : exercises.length > 0
        ? exercises
            .slice()
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((exercise) => renderExecutionExerciseRow(exercise, getExerciseResult(result, exercise.id), result, options))
            .join("")
        : renderExecutionBlockFallbackRow(item.block, result, options)}
      ${options.compactAthlete
        ? renderAthleteDeviceWorkoutLinkForBlock(item.plan, item.block, options)
        : ""}
    </form>
  `;
}

function renderExecutionExerciseRow(
  exercise: AssignedBlockExercise,
  result: ExecutionExerciseResult | null,
  blockResult: ExecutionResult | null,
  options: ExecutionPlanGroupRenderOptions = {},
) {
  const isCompleted = result?.completed ?? (blockResult?.completed && !(blockResult.exerciseResults?.length)) ?? false;
  const plannedWork = options.compactAthlete
    ? formatAssignedPlanExerciseVolume(exercise)
    : formatExerciseWorkCell(exercise);

  return `
    <div class="mobile-plan-row mobile-execution-row" data-execution-exercise data-exercise-id="${escapeHtml(exercise.id)}">
      <label class="execution-exercise-check mobile-plan-exercise-name">
        <input name="exerciseCompleted:${escapeHtml(exercise.id)}" type="checkbox" ${isCompleted ? "checked" : ""} ${options.isLocked ? "disabled" : ""} />
        <span>
          <strong>${renderTrainingTextWithAbbreviationHints(exercise.name)}</strong>
          ${options.compactAthlete ? "" : `<small>${isCompleted ? "выполнено" : "не отмечено"}</small>`}
        </span>
      </label>
      <span class="mobile-plan-cell mobile-plan-work">${renderTrainingTextWithAbbreviationHints(plannedWork)}</span>
      ${options.compactAthlete ? "" : `
        <details class="mobile-execution-row-details">
          <summary>Факт</summary>
          <div class="execution-exercise-fields">
            <label><span>Подх.</span><input inputmode="numeric" name="exerciseSets:${escapeHtml(exercise.id)}" placeholder="${escapeHtml(exercise.targetSets)}" type="number" min="0" value="${formatInputValue(result?.setsCompleted)}" ${options.isLocked ? "disabled" : ""} /></label>
            <label><span>Повт.</span><input inputmode="numeric" name="exerciseReps:${escapeHtml(exercise.id)}" placeholder="${escapeHtml(exercise.targetReps)}" type="number" min="0" value="${formatInputValue(result?.repsCompleted)}" ${options.isLocked ? "disabled" : ""} /></label>
            <label><span>Кг</span><input inputmode="decimal" name="exerciseWeight:${escapeHtml(exercise.id)}" placeholder="${escapeHtml(exercise.targetWeightKg)}" type="number" min="0" step="0.5" value="${formatInputValue(result?.weightKg)}" ${options.isLocked ? "disabled" : ""} /></label>
            <label><span>Мин.</span><input inputmode="numeric" name="exerciseDuration:${escapeHtml(exercise.id)}" placeholder="${escapeHtml(exercise.targetDurationMinutes)}" type="number" min="0" value="${formatInputValue(result?.durationMinutes)}" ${options.isLocked ? "disabled" : ""} /></label>
            <label><span>RPE</span><input inputmode="numeric" name="exerciseRpe:${escapeHtml(exercise.id)}" placeholder="${escapeHtml(exercise.targetRpe)}" type="number" min="1" max="10" value="${formatInputValue(result?.rpe)}" ${options.isLocked ? "disabled" : ""} /></label>
          </div>
        </details>
      `}
    </div>
  `;
}

function renderExecutionBlockFallbackRow(
  block: AssignedPlanBlock,
  result: ExecutionResult | null,
  options: ExecutionPlanGroupRenderOptions = {},
) {
  const plannedWork = options.compactAthlete
    ? formatAssignedPlanDisplayVolume(block)
    : formatBlockTarget(block);

  return `
    <div class="mobile-plan-row mobile-execution-row">
      <label class="execution-exercise-check mobile-plan-exercise-name">
        <input name="completed" type="checkbox" ${result?.completed ? "checked" : ""} ${options.isLocked ? "disabled" : ""} />
        <span>
          <strong>${renderTrainingTextWithAbbreviationHints(block.name)}</strong>
          ${options.compactAthlete ? "" : `<small>${result?.completed ? "выполнено" : "не отмечено"}</small>`}
        </span>
      </label>
      <span class="mobile-plan-cell mobile-plan-work">${renderTrainingTextWithAbbreviationHints(plannedWork)}</span>
      ${options.compactAthlete ? "" : `
        <details class="mobile-execution-row-details">
          <summary>Факт</summary>
          ${renderBlockFallbackFields(result, options.isLocked === true)}
        </details>
      `}
    </div>
  `;
}

function renderBlockFallbackFields(result: ExecutionResult | null, disabled = false) {
  const disabledAttr = disabled ? "disabled" : "";

  return `
    <label class="check-row"><input name="completed" type="checkbox" ${result?.completed ? "checked" : ""} ${disabledAttr} /> Выполнено</label>
    <label><span>Подходы</span><input name="setsCompleted" type="number" min="0" value="${formatInputValue(result?.setsCompleted)}" ${disabledAttr} /></label>
    <label><span>Повторы</span><input name="repsCompleted" type="number" min="0" value="${formatInputValue(result?.repsCompleted)}" ${disabledAttr} /></label>
    <label><span>Вес, кг</span><input name="weightKg" type="number" min="0" step="0.5" value="${formatInputValue(result?.weightKg)}" ${disabledAttr} /></label>
    <label><span>Минуты</span><input name="durationMinutes" type="number" min="0" value="${formatInputValue(result?.durationMinutes)}" ${disabledAttr} /></label>
    <label><span>RPE</span><input name="rpe" type="number" min="1" max="10" value="${formatInputValue(result?.rpe)}" ${disabledAttr} /></label>
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
        const plan = state.data.assignedPlans.find((item) => item.id === result.assignedPlanId);
        const trainingDate = result.trainingDate ?? plan?.day.dayDate ?? result.updatedAt.slice(0, 10);

        return `
          <article class="list-card">
            <strong>${escapeHtml(status)}</strong>
            <span>Тренировка: ${formatDate(trainingDate)} · сохранено ${formatDateTime(result.updatedAt)}</span>
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
          ? `<button class="mobile-plan-open-day" data-coach-open-day="${escapeHtml(plan.day.dayDate)}" data-coach-open-screen="athletes" type="button">Открыть спортсмена</button>`
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
                    <span>Блок</span>
                    <span>Объём</span>
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
  return `
    <div class="mobile-plan-row">
      <span class="mobile-plan-exercise-name-static">${renderTrainingTextWithAbbreviationHints(block.name)}</span>
      <span class="mobile-plan-cell mobile-plan-work">${renderTrainingTextWithAbbreviationHints(formatAssignedPlanDisplayVolume(block))}</span>
    </div>
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
  const dashboard: { id: MobileScreen; label: string; icon: string } = {
    id: "dashboard",
    label: role === "coach" || role === "admin" ? "Команда" : "Главная",
    icon: "⌂",
  };
  const plans: { id: MobileScreen; label: string; icon: string } = { id: "plans", label: "Планы", icon: "▦" };
  const calendar: { id: MobileScreen; label: string; icon: string } = { id: "calendar", label: "Календарь", icon: "□" };
  const results: { id: MobileScreen; label: string; icon: string } = { id: "results", label: "Выполнение", icon: "✓" };

  if (role === "coach" || role === "admin") {
    return [
      dashboard,
      { id: "athletes", label: "Спортсмен", icon: "◎" },
      plans,
      calendar,
      results,
    ];
  }

  return [
    dashboard,
    { id: "readiness", label: "Готовность", icon: "●" },
    { id: "watches", label: "Часы", icon: "◌" },
    calendar,
    results,
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
        const exerciseResult = getExerciseResult(result, exercise.id);
        const exerciseStatus = exerciseResult
          ? getExecutionExerciseStatus(exerciseResult)
          : statusForSummary === "completed"
            ? "completed"
            : statusForSummary === "partial"
              ? "partial"
              : "missed";

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
          const exerciseStatus = exerciseResult
            ? getExecutionExerciseStatus(exerciseResult)
            : status === "completed"
              ? "completed"
              : status === "partial"
                ? "partial"
                : "missed";

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
            statusLabel: exerciseResult
              ? formatExerciseResultStatus(exerciseResult)
              : getExecutionDayStatusLabel(exerciseStatus).toLowerCase(),
            sourceLabel: getMobileExecutionSourceLabel(Boolean(exerciseResult || result), isDeviceLinked),
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
  const athleteExecutionNote = getExecutionDayNoteForGroups(state, groups);

  return {
    athlete,
    athleteId,
    athleteName: athlete?.fullName ?? plans[0]?.athleteName ?? "Спортсмен",
    blocks,
    athleteExecutionNote,
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
    return "Серверный разбор";
  }

  if (source === "server-rules") {
    return "Разбор по правилам";
  }

  return "Локальный разбор";
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
      action: "Попросите спортсмена синхронизировать часы или приложение здоровья.",
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
    return "Локальный разбор: на выбранный день нет назначенного плана. Для полной рекомендации нужен серверный разбор.";
  }

  const loadLabel = `${formatLoadValue(summary.actualLoad)} из ${formatLoadValue(summary.plannedLoad)}`;
  const exerciseLabel = summary.exerciseCount > 0
    ? `${summary.completedExerciseCount}/${summary.exerciseCount} упражнений`
    : `${summary.completedBlockCount}/${summary.blockCount} блоков`;

  const deviceLabel = formatOfflineCoachAiDeviceObservation(dayData.deviceHealthSummary);

  return `Локальный разбор: день отмечен как «${summary.statusLabel.toLowerCase()}», выполнено ${exerciseLabel}, нагрузка ${loadLabel}.${deviceLabel ? ` ${deviceLabel}` : ""}`;
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
    risks.push("Нет данных устройства: сон, пульс покоя и внешние тренировки не учитываются в локальном разборе.");
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
    actions.push("Попросите спортсмена синхронизировать часы или приложение здоровья перед повторным разбором дня.");
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
    .map(normalizeDeviceHealthDailySummaryForStorage)
    .sort(compareDeviceHealthSummaries)[0] ?? null;
}

function getDeviceWorkoutsForDate(
  state: MobileAppState,
  athleteId: string | null,
  date: string,
) {
  return getDisplayDeviceWorkoutsForDateItems(
    state.data.deviceWorkouts.filter((workout) =>
      workout.entryDate === date &&
      (!athleteId || workout.athleteId === athleteId)
    ),
  );
}

function getDisplayDeviceWorkoutsForDateItems(workouts: DeviceWorkout[]) {
  return dedupeDeviceWorkoutsForDisplay(
    workouts,
  )
    .sort((left, right) => left.startTime.localeCompare(right.startTime));
}

function dedupeDeviceWorkoutsForDisplay(workouts: DeviceWorkout[]) {
  const workoutsByKey = new Map<string, DeviceWorkout>();

  for (const workout of workouts) {
    const key = getDeviceWorkoutDisplayKey(workout);
    const previous = workoutsByKey.get(key);
    if (!previous || getDeviceWorkoutCompletenessScore(workout) >= getDeviceWorkoutCompletenessScore(previous)) {
      workoutsByKey.set(key, workout);
    }
  }

  return Array.from(workoutsByKey.values());
}

function getDeviceWorkoutDisplayKey(workout: DeviceWorkout) {
  const cachedKey = deviceWorkoutDisplayKeyCache.get(workout);
  if (cachedKey) {
    return cachedKey;
  }

  const startTime = Number.isFinite(new Date(workout.startTime).getTime())
    ? new Date(workout.startTime).getTime()
    : workout.startTime;
  const distanceMeters = getTrustedWatchWorkoutDistanceMeters(workout);
  const key = [
    workout.athleteId,
    workout.provider,
    workout.entryDate,
    workout.workoutType,
    startTime,
    workout.durationMinutes ?? "",
    distanceMeters ?? "",
  ].join("|");
  deviceWorkoutDisplayKeyCache.set(workout, key);
  return key;
}

function getDeviceWorkoutCompletenessScore(workout: DeviceWorkout) {
  const cachedScore = deviceWorkoutCompletenessScoreCache.get(workout);
  if (cachedScore !== undefined) {
    return cachedScore;
  }

  const rawFiles = Array.isArray(workout.rawPayload?.files) ? workout.rawPayload.files.length : 0;
  const score = (
    (workout.sampleCount ?? 0) * 4 +
    rawFiles * 3 +
    (workout.activeCalories !== null ? 2 : 0) +
    (workout.distanceMeters !== null ? 2 : 0) +
    (workout.averageHeartRateBpm !== null ? 2 : 0) +
    (workout.maxHeartRateBpm !== null ? 1 : 0) +
    (workout.minHeartRateBpm !== null ? 1 : 0)
  );
  deviceWorkoutCompletenessScoreCache.set(workout, score);
  return score;
}

function getDeviceWorkoutById(
  state: MobileAppState,
  athleteId: string | null,
  workoutId: string,
) {
  return state.data.deviceWorkouts.find((workout) =>
    workout.id === workoutId &&
    (!athleteId || workout.athleteId === athleteId)
  ) ?? null;
}

function getRecentDeviceWorkouts(
  state: MobileAppState,
  athleteId: string | null,
  maxDate: string,
  limit: number,
) {
  return dedupeDeviceWorkoutsForDisplay(
    state.data.deviceWorkouts.filter((workout) =>
        workout.entryDate <= maxDate &&
        (!athleteId || workout.athleteId === athleteId)
    ),
  )
    .sort((left, right) => right.startTime.localeCompare(left.startTime))
    .slice(0, limit);
}

function getDeviceHealthSamplesForDate(
  state: MobileAppState,
  athleteId: string | null,
  date: string,
  metric: DeviceHealthSample["metric"],
) {
  return state.data.deviceHealthSamples
    .filter((sample) =>
      sample.entryDate === date &&
      sample.metric === metric &&
      (!athleteId || sample.athleteId === athleteId)
    )
    .sort((left, right) => left.sampledAt.localeCompare(right.sampledAt));
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

function getDeviceWorkoutLinkGroupForTarget(
  links: DeviceWorkoutLink[],
  assignedBlockIds: string[],
  assignedExerciseId: string | null,
) {
  const assignedBlockIdSet = new Set(assignedBlockIds);
  const groupLinks = links.filter((link) =>
    assignedBlockIdSet.has(link.assignedBlockId) &&
    (assignedExerciseId ? link.assignedExerciseId === assignedExerciseId : !link.assignedExerciseId)
  );
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

  const providerDelta = getDeviceHealthProviderPriority(right) - getDeviceHealthProviderPriority(left);
  if (providerDelta !== 0) {
    return providerDelta;
  }

  return right.syncedAt.localeCompare(left.syncedAt);
}

function getDeviceHealthSummaryScore(summary: DeviceHealthDailySummary) {
  return [
    hasDeviceSleepData(summary),
    hasDeviceRestingHeartRateData(summary),
    hasDeviceHeartRateData(summary),
    hasDeviceOxygenSaturationData(summary),
    hasDeviceWorkoutData(summary),
    getWatchStepCount(summary) !== null,
  ].filter(Boolean).length;
}

function getDeviceHealthProviderPriority(summary: DeviceHealthDailySummary) {
  if (summary.provider === "direct-watch") {
    return 3;
  }

  if (summary.provider === "apple-health") {
    return 2;
  }

  if (summary.provider === "health-connect") {
    return 1;
  }

  return 0;
}

function hasDeviceRestingHeartRateData(summary: DeviceHealthDailySummary | null) {
  return summary?.heartRate?.restingBpm !== null && summary?.heartRate?.restingBpm !== undefined;
}

function hasDeviceHeartRateData(summary: DeviceHealthDailySummary | null) {
  return Boolean(
    summary?.heartRate &&
      (
        hasDeviceRestingHeartRateData(summary) ||
        summary.heartRate.averageBpm !== null ||
        summary.heartRate.minBpm !== null ||
        summary.heartRate.maxBpm !== null
      ),
  );
}

function hasDeviceWorkoutData(summary: DeviceHealthDailySummary | null) {
  return Boolean(summary?.workout && summary.workout.count > 0);
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

function formatExecutionSessionDiaryName(sessionName: string) {
  const shortName = sessionName.split(/[—–-]/)[0]?.trim() || sessionName.trim();
  return shortName.toLowerCase() || "сессия";
}

function getExecutionSessionNote(
  state: MobileAppState,
  assignedPlanId: string,
  session: MobileAssignedPlanSession,
) {
  const notes: string[] = [];
  const seen = new Set<string>();

  session.blocks.forEach((block) => {
    const note = getExecutionResultForBlock(state, assignedPlanId, block.id)?.notes.trim() ?? "";

    if (note && !seen.has(note)) {
      seen.add(note);
      notes.push(note);
    }
  });

  return notes.join("\n\n");
}

function getExecutionDayNoteForGroups(state: MobileAppState, groups: ExecutionPlanGroup[]) {
  const notes: string[] = [];
  const seen = new Set<string>();

  groups.forEach((group) => {
    group.plan.day.sessions.forEach((session) => {
      const note = getExecutionSessionNote(state, group.plan.id, session);

      if (note && !seen.has(note)) {
        seen.add(note);
        notes.push(`${formatExecutionSessionDiaryName(session.name)}: ${note}`);
      }
    });
  });

  return notes.join("\n\n");
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

function formatAssignedPlanExerciseVolume(exercise: AssignedBlockExercise) {
  const notes = cleanAssignedPlanNotes(exercise.notes);

  return notes || formatExerciseWorkCell(exercise);
}

function formatAssignedPlanBlockVolume(block: AssignedPlanBlock) {
  const notes = cleanAssignedPlanNotes(block.notes);

  return notes || formatBlockTarget(block);
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

function getReadinessTrendDelta(entries: ReadinessEntry[]) {
  const trendEntries = entries.slice(-7);

  if (trendEntries.length < 2) {
    return null;
  }

  return trendEntries[trendEntries.length - 1].score - trendEntries[0].score;
}

function formatReadinessTrendDelta(delta: number | null) {
  if (delta === null) {
    return "нужны ещё замеры";
  }

  if (delta === 0) {
    return "без изменений";
  }

  return delta > 0 ? `+${delta} за период` : `${delta} за период`;
}

function getReadinessTrendClass(delta: number | null): "good" | "risk" | "watch" {
  if (delta === null || Math.abs(delta) < 4) {
    return "watch";
  }

  return delta > 0 ? "good" : "risk";
}

function formatAthleteTodayRecommendation(entry: ReadinessEntry | null, summary: CoachTodayDaySummary) {
  if (!entry) {
    return summary.planCount > 0
      ? "Перед выполнением плана сохрани готовность, чтобы тренер видел состояние перед нагрузкой."
      : "На сегодня нет плана, но готовность всё равно можно сохранить для истории состояния.";
  }

  if (entry.status === "red") {
    return "Сегодня не гони нагрузку: сначала проверь самочувствие и согласуй тяжёлую работу с тренером.";
  }

  if (entry.status === "yellow") {
    return "Работай по плану аккуратно: следи за разминкой, болью и усталостью, без добавления лишнего объёма.";
  }

  if (summary.status === "completed") {
    return "День закрыт. Если состояние изменилось после тренировки, обнови готовность или оставь заметку.";
  }

  return summary.planCount > 0
    ? "Готовность нормальная: выполняй назначенный план и отметь сделанные задания."
    : "Готовность нормальная. Планов на сегодня нет, можно держать лёгкое восстановление.";
}

function formatCoachReadinessDecision(dayData: CoachDayCleanSummary, aiReview: CoachDayAiReview | null) {
  const entry = dayData.readinessEntry;
  const summary = dayData.summary;

  if (!entry) {
    return "сначала получить чек-ин";
  }

  if (entry.status === "red") {
    return "проверить перед нагрузкой";
  }

  if (entry.status === "yellow") {
    return "держать план без добавления";
  }

  if (summary.planCount > 0 && summary.actualLoad > summary.plannedLoad) {
    return "факт выше плана";
  }

  return aiReview?.tomorrowActions[0] ? "есть рекомендация" : "можно вести по плану";
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

function formatDeviceWorkoutDuration(minutes: number) {
  if (minutes < 60) {
    return `${Math.max(1, Math.round(minutes))} мин`;
  }

  return formatDurationHours(minutes);
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

function formatCalendarDayCountLabel(count: number) {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return "дней";
  }

  if (lastDigit === 1) {
    return "день";
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return "дня";
  }

  return "дней";
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

function getReadinessEntriesForAthlete(state: MobileAppState, athleteId: string | null) {
  const entries = state.data.readinessHistory.length
    ? state.data.readinessHistory
    : state.data.readinessEntry
      ? [state.data.readinessEntry]
      : [];

  return entries
    .filter((entry) => !athleteId || entry.athleteId === athleteId)
    .slice()
    .sort((left, right) => left.entryDate.localeCompare(right.entryDate));
}

function getRecentReadinessEntriesForAthlete(
  state: MobileAppState,
  athleteId: string | null,
  limit = 7,
  maxDate?: string,
) {
  return getReadinessEntriesForAthlete(state, athleteId)
    .filter((entry) => !maxDate || entry.entryDate <= maxDate)
    .slice(-limit);
}

function getReadinessHistory(state: MobileAppState, athleteId: string | null = null) {
  const entries = getReadinessEntriesForAthlete(state, athleteId);

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

function isDeviceHealthRawRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const deviceHealthStepKeys = ["steps", "stepCount", "totalSteps"] as const;

function readBestDeviceHealthStepCount(rawPayload: Record<string, unknown>) {
  const values = deviceHealthStepKeys
    .map((key) => readDeviceHealthRawNumber(rawPayload, key))
    .filter((value): value is number => value !== null);

  return values.length ? Math.max(...values) : null;
}

function keepMaxDeviceHealthRawNumber(
  merged: Record<string, unknown>,
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
  key: string,
) {
  const existingValue = readDeviceHealthRawNumber(existing, key);
  const incomingValue = readDeviceHealthRawNumber(incoming, key);
  if (existingValue === null && incomingValue === null) {
    return;
  }

  merged[key] = Math.max(existingValue ?? Number.NEGATIVE_INFINITY, incomingValue ?? Number.NEGATIVE_INFINITY);
}

function keepBestDeviceHealthRawSteps(
  merged: Record<string, unknown>,
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
) {
  const existingSteps = readBestDeviceHealthStepCount(existing);
  const incomingSteps = readBestDeviceHealthStepCount(incoming);
  const incomingSource = typeof incoming.stepsSource === "string" ? incoming.stepsSource : null;

  if (incomingSource === "minute-details-partial") {
    if (existingSteps !== null) {
      deviceHealthStepKeys.forEach((key) => {
        merged[key] = existingSteps;
      });
      merged.stepsSource = existing.stepsSource ?? "preserved-existing";
    } else {
      deviceHealthStepKeys.forEach((key) => {
        delete merged[key];
      });
    }
    return;
  }

  const bestSteps = Math.max(existingSteps ?? Number.NEGATIVE_INFINITY, incomingSteps ?? Number.NEGATIVE_INFINITY);
  if (!Number.isFinite(bestSteps)) {
    return;
  }

  deviceHealthStepKeys.forEach((key) => {
    merged[key] = bestSteps;
  });

  if (existingSteps !== null && existingSteps > (incomingSteps ?? Number.NEGATIVE_INFINITY)) {
    merged.stepsSource = existing.stepsSource ?? "preserved-existing";
  }
}

function mergeDeviceHealthRawPayloadForStorage(
  existingRawPayload: Record<string, unknown> | null | undefined,
  incomingRawPayload: Record<string, unknown> | null | undefined,
) {
  const existing = isDeviceHealthRawRecord(existingRawPayload) ? existingRawPayload : {};
  const incoming = isDeviceHealthRawRecord(incomingRawPayload) ? incomingRawPayload : {};
  const merged = { ...existing, ...incoming };

  keepBestDeviceHealthRawSteps(merged, existing, incoming);
  ["calories", "trainingLoadDay", "trainingLoadWeek", "vitality"].forEach((key) => {
    keepMaxDeviceHealthRawNumber(merged, existing, incoming, key);
  });

  return Object.keys(merged).length ? merged : null;
}

function mergeValue<T>(incoming: T | null | undefined, existing: T | null | undefined) {
  return incoming ?? existing ?? null;
}

function mergeMinValue(
  incoming: number | null | undefined,
  existing: number | null | undefined,
) {
  if (typeof incoming === "number" && typeof existing === "number") {
    return Math.min(incoming, existing);
  }

  return incoming ?? existing ?? null;
}

function mergeMaxValue(
  incoming: number | null | undefined,
  existing: number | null | undefined,
) {
  if (typeof incoming === "number" && typeof existing === "number") {
    return Math.max(incoming, existing);
  }

  return incoming ?? existing ?? null;
}

function mergeSleepStageValue(
  incoming: number | null | undefined,
  existing: number | null | undefined,
  preferExisting: boolean,
) {
  if (typeof incoming === "number" && typeof existing === "number") {
    return preferExisting ? existing : incoming;
  }

  return incoming ?? existing ?? null;
}

type DeviceHealthSleepLike = NonNullable<DeviceHealthDailySummary["sleep"] | DeviceHealthDailySummaryPayload["sleep"]>;

function getDeviceHealthSleepStageTotalMinutes(sleep: DeviceHealthSleepLike | null | undefined) {
  if (!sleep) {
    return null;
  }

  const values = [
    sleep.awakeMinutes,
    sleep.deepMinutes,
    sleep.lightMinutes,
    sleep.remMinutes,
  ].filter(isPositiveNumber);

  return values.length ? values.reduce((total, value) => total + value, 0) : null;
}

function getDeviceHealthSleepWindowDurationMinutes(sleep: DeviceHealthSleepLike | null | undefined) {
  if (!sleep?.startTime || !sleep.endTime) {
    return null;
  }

  const start = new Date(sleep.startTime).getTime();
  const end = new Date(sleep.endTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }

  return Math.round((end - start) / 60000);
}

function normalizeDeviceHealthSleepSummaryForStorage<T extends DeviceHealthSleepLike>(sleep: T): T {
  const stageTotal = getDeviceHealthSleepStageTotalMinutes(sleep);
  const windowDuration = getDeviceHealthSleepWindowDurationMinutes(sleep);
  const durationCandidates = [sleep.durationMinutes, stageTotal, windowDuration]
    .filter(isPositiveNumber);

  if (!durationCandidates.length) {
    return sleep;
  }

  const bestDuration = Math.max(...durationCandidates);
  if (sleep.durationMinutes === bestDuration) {
    return sleep;
  }

  return {
    ...sleep,
    durationMinutes: bestDuration,
  };
}

function normalizeDeviceHealthDailySummaryForStorage<T extends DeviceHealthDailySummary | DeviceHealthDailySummaryPayload>(summary: T): T {
  return {
    ...summary,
    sleep: summary.sleep ? normalizeDeviceHealthSleepSummaryForStorage(summary.sleep) : summary.sleep,
  };
}

function normalizeDeviceHealthPayloadForSubmit(
  payload: DeviceHealthDailySummaryPayload,
  data: MobileDataSnapshot,
): DeviceHealthDailySummaryPayload {
  const normalizedPayload = normalizeDeviceHealthDailySummaryForStorage(payload);
  if (normalizedPayload.sleep) {
    return normalizedPayload;
  }

  const existingSummary = data.deviceHealthSummaries.find((summary) =>
    summary.entryDate === payload.entryDate &&
      summary.provider === payload.provider
  );
  const existingSleep = existingSummary?.sleep
    ? normalizeDeviceHealthSleepSummaryForStorage(existingSummary.sleep)
    : null;

  return existingSleep && hasMeaningfulWatchSleep(existingSleep)
    ? {
        ...normalizedPayload,
        sleep: existingSleep,
      }
    : normalizedPayload;
}

function mergeDeviceHealthSleepSummary(
  existing: DeviceHealthDailySummary["sleep"],
  incoming: DeviceHealthDailySummary["sleep"],
) {
  if (!existing || !incoming) {
    return incoming
      ? normalizeDeviceHealthSleepSummaryForStorage(incoming)
      : existing
        ? normalizeDeviceHealthSleepSummaryForStorage(existing)
        : null;
  }

  const normalizedExisting = normalizeDeviceHealthSleepSummaryForStorage(existing);
  const normalizedIncoming = normalizeDeviceHealthSleepSummaryForStorage(incoming);
  const existingDuration = normalizedExisting.durationMinutes ?? null;
  const incomingDuration = normalizedIncoming.durationMinutes ?? null;
  const preferExisting = typeof existingDuration === "number" &&
    typeof incomingDuration === "number" &&
    incomingDuration + WATCH_SLEEP_SHORTER_TOLERANCE_MINUTES < existingDuration;

  return normalizeDeviceHealthSleepSummaryForStorage({
    awakeMinutes: mergeSleepStageValue(normalizedIncoming.awakeMinutes, normalizedExisting.awakeMinutes, preferExisting),
    deepMinutes: mergeSleepStageValue(normalizedIncoming.deepMinutes, normalizedExisting.deepMinutes, preferExisting),
    durationMinutes: preferExisting
      ? existingDuration
      : mergeValue(normalizedIncoming.durationMinutes, normalizedExisting.durationMinutes),
    endTime: preferExisting ? mergeValue(normalizedExisting.endTime, normalizedIncoming.endTime) : mergeValue(normalizedIncoming.endTime, normalizedExisting.endTime),
    lightMinutes: mergeSleepStageValue(normalizedIncoming.lightMinutes, normalizedExisting.lightMinutes, preferExisting),
    remMinutes: mergeSleepStageValue(normalizedIncoming.remMinutes, normalizedExisting.remMinutes, preferExisting),
    score: mergeValue(normalizedIncoming.score, normalizedExisting.score),
    startTime: preferExisting ? mergeValue(normalizedExisting.startTime, normalizedIncoming.startTime) : mergeValue(normalizedIncoming.startTime, normalizedExisting.startTime),
  });
}

function mergeDeviceHealthHeartRateSummary(
  existing: DeviceHealthDailySummary["heartRate"],
  incoming: DeviceHealthDailySummary["heartRate"],
) {
  if (!existing || !incoming) {
    return incoming ?? existing ?? null;
  }

  return {
    averageBpm: mergeValue(incoming.averageBpm, existing.averageBpm),
    hrvRmssdMs: mergeValue(incoming.hrvRmssdMs, existing.hrvRmssdMs),
    maxBpm: mergeMaxValue(incoming.maxBpm, existing.maxBpm),
    minBpm: mergeMinValue(incoming.minBpm, existing.minBpm),
    restingBpm: mergeValue(incoming.restingBpm, existing.restingBpm),
  };
}

function mergeDeviceHealthOxygenSaturationSummary(
  existing: DeviceHealthDailySummary["oxygenSaturation"],
  incoming: DeviceHealthDailySummary["oxygenSaturation"],
) {
  if (!existing || !incoming) {
    return incoming ?? existing ?? null;
  }

  return {
    averagePercent: mergeValue(incoming.averagePercent, existing.averagePercent),
    latestPercent: mergeValue(incoming.latestPercent, existing.latestPercent),
    maxPercent: mergeMaxValue(incoming.maxPercent, existing.maxPercent),
    minPercent: mergeMinValue(incoming.minPercent, existing.minPercent),
    sampleCount: Math.max(existing.sampleCount ?? 0, incoming.sampleCount ?? 0),
  };
}

function mergeDeviceHealthWorkoutSummary(
  existing: DeviceHealthDailySummary["workout"],
  incoming: DeviceHealthDailySummary["workout"],
) {
  if (!existing || !incoming) {
    return incoming ?? existing ?? null;
  }

  return {
    activeCalories: mergeMaxValue(incoming.activeCalories, existing.activeCalories),
    averageHeartRateBpm: mergeValue(incoming.averageHeartRateBpm, existing.averageHeartRateBpm),
    count: Math.max(existing.count ?? 0, incoming.count ?? 0),
    maxHeartRateBpm: mergeMaxValue(incoming.maxHeartRateBpm, existing.maxHeartRateBpm),
    totalDistanceMeters: mergeMaxValue(incoming.totalDistanceMeters, existing.totalDistanceMeters),
    totalDurationMinutes: mergeMaxValue(incoming.totalDurationMinutes, existing.totalDurationMinutes),
  };
}

function mergeDeviceHealthSummaryForStorage(
  existing: DeviceHealthDailySummary,
  incoming: DeviceHealthDailySummary,
): DeviceHealthDailySummary {
  return {
    ...existing,
    ...incoming,
    heartRate: mergeDeviceHealthHeartRateSummary(existing.heartRate, incoming.heartRate),
    oxygenSaturation: mergeDeviceHealthOxygenSaturationSummary(existing.oxygenSaturation, incoming.oxygenSaturation),
    rawPayload: mergeDeviceHealthRawPayloadForStorage(existing.rawPayload, incoming.rawPayload),
    sleep: mergeDeviceHealthSleepSummary(existing.sleep, incoming.sleep),
    sourceDevice: incoming.sourceDevice ?? existing.sourceDevice,
    workout: mergeDeviceHealthWorkoutSummary(existing.workout, incoming.workout),
  };
}

function upsertDeviceHealthSummary(
  items: DeviceHealthDailySummary[],
  summary: DeviceHealthDailySummary,
) {
  const normalizedSummary = normalizeDeviceHealthDailySummaryForStorage(summary);
  const existingSummary = items.find((item) =>
    item.id === normalizedSummary.id ||
    (item.athleteId === normalizedSummary.athleteId &&
      item.provider === normalizedSummary.provider &&
      item.entryDate === normalizedSummary.entryDate)
  );
  const mergedSummary = existingSummary
    ? mergeDeviceHealthSummaryForStorage(existingSummary, normalizedSummary)
    : normalizedSummary;
  const nextItems = items.filter((item) =>
    item.id !== mergedSummary.id &&
    (item.athleteId !== mergedSummary.athleteId ||
      item.provider !== mergedSummary.provider ||
      item.entryDate !== mergedSummary.entryDate)
  );
  nextItems.unshift(mergedSummary);
  return nextItems
    .sort((left, right) => right.entryDate.localeCompare(left.entryDate))
    .slice(0, 120);
}

function replaceDeviceHealthSamplesForDay(
  items: DeviceHealthSample[],
  samples: DeviceHealthSample[],
  athleteId: string,
  entryDate: string,
  metric: DeviceHealthSample["metric"],
) {
  const existingItems = items.filter((item) =>
    item.athleteId === athleteId &&
    item.entryDate === entryDate &&
    item.metric === metric
  );
  const shouldReplaceMetric = samples.length >= existingItems.length;
  const baseItems = shouldReplaceMetric ? items.filter((item) =>
    item.athleteId !== athleteId ||
    item.entryDate !== entryDate ||
    item.metric !== metric
  ) : items;
  const samplesByKey = new Map(baseItems.map((item) => [getDeviceHealthSampleStorageKey(item), item]));
  samples.forEach((sample) => {
    samplesByKey.set(getDeviceHealthSampleStorageKey(sample), sample);
  });

  return Array.from(samplesByKey.values())
    .sort((left, right) =>
      right.entryDate.localeCompare(left.entryDate) ||
      left.metric.localeCompare(right.metric) ||
      left.sampledAt.localeCompare(right.sampledAt),
    )
    .slice(0, 5000);
}

function getDeviceHealthSampleStorageKey(sample: DeviceHealthSample) {
  return `${sample.athleteId}:${sample.provider}:${sample.metric}:${sample.sampledAt}`;
}

function normalizeMobileDataSnapshot(snapshot: MobileDataSnapshot): MobileDataSnapshot {
  return {
    ...snapshot,
    deviceWorkoutLinks: snapshot.deviceWorkoutLinks.map(compactDeviceWorkoutLinkForRuntime),
    deviceWorkouts: dedupeDeviceWorkoutsForDisplay(snapshot.deviceWorkouts)
      .sort((left, right) =>
        right.entryDate.localeCompare(left.entryDate) || right.startTime.localeCompare(left.startTime),
      )
      .slice(0, 200),
  };
}

function upsertDeviceWorkouts(items: DeviceWorkout[], workouts: DeviceWorkout[]) {
  const incomingDisplayKeys = new Set(workouts.map(getDeviceWorkoutDisplayKey));
  const nextItems = items.filter((item) => !workouts.some((workout) =>
    workout.id === item.id ||
    (workout.athleteId === item.athleteId &&
      workout.provider === item.provider &&
      workout.sourceWorkoutId === item.sourceWorkoutId)
  ) && !incomingDisplayKeys.has(getDeviceWorkoutDisplayKey(item)));
  const workoutsByKey = new Map<string, DeviceWorkout>();

  [...workouts, ...nextItems].forEach((workout) => {
    const key = getDeviceWorkoutDisplayKey(workout);
    const previous = workoutsByKey.get(key);
    if (!previous || getDeviceWorkoutCompletenessScore(workout) > getDeviceWorkoutCompletenessScore(previous)) {
      workoutsByKey.set(key, workout);
    }
  });

  return Array.from(workoutsByKey.values())
    .sort((left, right) =>
      right.entryDate.localeCompare(left.entryDate) || right.startTime.localeCompare(left.startTime),
    )
    .slice(0, 200);
}

function upsertDeviceWorkoutLinks(items: DeviceWorkoutLink[], links: DeviceWorkoutLink[]) {
  const compactLinks = links.map(compactDeviceWorkoutLinkForRuntime);
  const nextItems = items.filter((item) => !links.some((link) =>
    link.id === item.id ||
    (link.athleteId === item.athleteId &&
      link.assignedBlockId === item.assignedBlockId &&
      link.deviceWorkoutId === item.deviceWorkoutId)
  ));
  nextItems.unshift(...compactLinks);
  return nextItems.slice(0, 200);
}

function compactDeviceWorkoutLinkForRuntime(link: DeviceWorkoutLink): DeviceWorkoutLink {
  return {
    ...link,
    workout: {
      ...link.workout,
      rawPayload: null,
      samples: [],
    },
  };
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

  const cached = formattedDateCache.get(value);
  if (cached) {
    return cached;
  }

  const formatted = mobileDateFormatter.format(new Date(`${value}T00:00:00.000Z`));
  formattedDateCache.set(value, formatted);
  return formatted;
}

function formatShortDate(value: string) {
  if (!value) {
    return "-";
  }

  const cached = formattedShortDateCache.get(value);
  if (cached) {
    return cached;
  }

  const formatted = mobileShortDateFormatter.format(new Date(`${value}T00:00:00.000Z`));
  formattedShortDateCache.set(value, formatted);
  return formatted;
}

function formatDateTime(value: string) {
  const cached = formattedDateTimeCache.get(value);
  if (cached) {
    return cached;
  }

  const formatted = mobileDateTimeFormatter.format(new Date(value));
  formattedDateTimeCache.set(value, formatted);
  return formatted;
}

function formatTime(value: string) {
  const cached = formattedTimeCache.get(value);
  if (cached) {
    return cached;
  }

  const formatted = mobileTimeFormatter.format(new Date(value));
  formattedTimeCache.set(value, formatted);
  return formatted;
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

function mountMobileUPlotCharts(root: HTMLElement): UPlotInstance[] {
  const uPlot = (window as UPlotWindow).uPlot;
  const charts: UPlotInstance[] = [];

  root.querySelectorAll<HTMLElement>("[data-uplot-chart-id]").forEach((container) => {
    const plot = container.querySelector<HTMLElement>(".mobile-uplot-plot");
    const chartId = container.dataset.uplotChartId;

    if (!plot || !chartId) {
      return;
    }

    if (!uPlot) {
      plot.innerHTML = `<p class="watch-empty-note">График не загрузился. Обнови приложение.</p>`;
      return;
    }

    const payload = mobileUPlotPayloads.get(chartId);
    if (!payload) {
      plot.innerHTML = `<p class="watch-empty-note">График не удалось подготовить.</p>`;
      return;
    }

    if (payload.x.length < 2 || payload.y.length < 2 || payload.x.length !== payload.y.length) {
      plot.innerHTML = `<p class="watch-empty-note">Недостаточно точек для графика.</p>`;
      return;
    }

    const height = Math.max(120, Number(container.dataset.uplotHeight) || 260);
    const width = Math.max(260, Math.round(plot.clientWidth || container.clientWidth || 320));
    const averageSeries = payload.average !== null && payload.average !== undefined
      ? payload.x.map(() => payload.average as number)
      : null;
    const data = averageSeries ? [payload.x, payload.y, averageSeries] : [payload.x, payload.y];
    const chart = new uPlot(buildMobileUPlotOptions(payload, width, height), data, plot);
    charts.push(chart);
  });

  return charts;
}

function buildMobileUPlotOptions(payload: MobileUPlotPayload, width: number, height: number) {
  const valueFormatter = (value: number) => formatMobileUPlotValue(value, payload);

  return {
    axes: [
      {
        grid: { stroke: "rgba(100, 116, 139, 0.18)", width: 1 },
        stroke: "#64748b",
        values: (_plot: unknown, values: number[]) => values.map((value) => formatMobileUPlotTime(value)),
      },
      {
        grid: { stroke: "rgba(100, 116, 139, 0.18)", width: 1 },
        size: 48,
        stroke: "#64748b",
        values: (_plot: unknown, values: number[]) => values.map(valueFormatter),
      },
    ],
    cursor: {
      drag: { x: true, y: false },
      points: { show: false },
    },
    height,
    legend: { show: false },
    padding: [8, 8, 4, 0],
    scales: {
      x: { time: true },
      y: {
        range: () => [payload.lower, payload.upper],
      },
    },
    series: [
      {},
      {
        label: payload.label,
        points: { show: false },
        spanGaps: true,
        stroke: payload.color,
        width: 2.4,
      },
      ...(payload.average !== null && payload.average !== undefined
        ? [{
            dash: [6, 5],
            label: "Среднее",
            points: { show: false },
            spanGaps: true,
            stroke: payload.highColor ?? "rgba(173, 106, 21, 0.75)",
            width: 1.2,
          }]
        : []),
    ],
    width,
  };
}

function pendingActionReferencesDirectWatchRawCache(action: PendingSyncAction, cacheId: string) {
  return valueReferencesDirectWatchRawCache(action.body, cacheId);
}

function valueReferencesDirectWatchRawCache(value: unknown, cacheId: string): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => valueReferencesDirectWatchRawCache(item, cacheId));
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (record.directWatchRawCacheId === cacheId) {
    return true;
  }

  return Object.values(record).some((item) => valueReferencesDirectWatchRawCache(item, cacheId));
}

function formatMobileUPlotTime(value: number) {
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return mobileUPlotTimeFormatter.format(date);
}

function formatMobileUPlotValue(value: number, payload: MobileUPlotPayload) {
  if (!Number.isFinite(value)) {
    return "";
  }

  if (payload.format === "pace") {
    const minutes = Math.floor(value / 60);
    const seconds = Math.max(0, Math.round(value - minutes * 60));
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  const decimals = payload.valueDecimals ?? (payload.format === "decimal" ? 1 : 0);
  const formatted = value.toFixed(decimals);
  return payload.format === "percent" ? `${formatted}%` : formatted;
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getTrainingAbbreviationExplanation(value: string) {
  return TRAINING_ABBREVIATION_EXPLANATIONS[value.toLocaleUpperCase("ru-RU")] ?? null;
}

function renderTrainingTextWithAbbreviationHints(value: string | number | null | undefined) {
  const text = String(value ?? "");

  if (!text) {
    return "";
  }

  let html = "";
  let lastIndex = 0;
  let hasAbbreviation = false;

  text.replace(
    TRAINING_ABBREVIATION_PATTERN,
    (match: string, prefix: string, abbreviation: string, offset: number) => {
      const abbreviationStart = offset + prefix.length;
      const abbreviationEnd = abbreviationStart + abbreviation.length;
      const explanation = getTrainingAbbreviationExplanation(abbreviation);

      if (!explanation) {
        return match;
      }

      html += escapeHtml(text.slice(lastIndex, abbreviationStart));

      const original = text.slice(abbreviationStart, abbreviationEnd);
      const tooltip = `${original}: ${explanation}`;

      html += `<span class="mobile-training-abbreviation" role="button" tabindex="0" aria-expanded="false" aria-label="${escapeHtml(tooltip)}" data-explanation="${escapeHtml(explanation)}" data-training-abbreviation>${escapeHtml(original)}</span>`;
      lastIndex = abbreviationEnd;
      hasAbbreviation = true;

      return match;
    },
  );

  if (!hasAbbreviation) {
    return escapeHtml(text);
  }

  html += escapeHtml(text.slice(lastIndex));
  return html;
}
