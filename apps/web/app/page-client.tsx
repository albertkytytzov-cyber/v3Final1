"use client";

import {
  type AdaptedPlanDay,
  type AnalyticsCoachActionDecision,
  type AnalyticsCoachActionDecisionPayload,
  type AnalyticsCoachSuggestion,
  type AnalyticsOverview,
  type AnalyticsPlannerBridge,
  type AssignedBlockExercise,
  type AssignedPlanPayload,
  type AssignedPlanSummary,
  type CompetitionContext,
  type CompetitionPlanSummary,
  type CompetitionReviewOverview,
  type CompetitionResultPayload,
  type CompetitionSummary,
  type CreateCompetitionPayload,
  type CreateCompetitionPlanPayload,
  type CreateMesocyclePayload,
  type CreateOlympicCyclePayload,
  type CreateSeasonPayload,
  DEFAULT_PLAN_TEMPLATE,
  type ExecutionReviewPlan,
  type ExecutionResult,
  type ExecutionResultInput,
  MVP_MODULES,
  type MesocycleSummary,
  type OlympicCycleSummary,
  type PreparationPhase,
  READINESS_DEFAULTS,
  READINESS_FIELD_META,
  READINESS_STATUS_META,
  type SeasonSummary,
  TRAINING_ROLES,
  type AuthResponse,
  type AuthUser,
  type CoachAttachAthleteResponse,
  type CoachAvailableAthletesResponse,
  type CoachAthleteProfilePayload,
  type CoachAthleteSummary,
  type CoachDiaryEntry,
  type CoachDiaryEntryPayload,
  type CoachAiReviewDiagnosticResponse,
  type CoachAiReviewStatus,
  type CoachAiReviewStatusResponse,
  type CoachDayAiPayload,
  type CoachDayAiReview,
  type CoachDayAiReviewHistoryResponse,
  type CoachDayAiReviewResponse,
  type DeviceHealthDailySummariesResponse,
  type DeviceHealthDailySummary,
  type DeviceWorkout,
  type DeviceWorkoutLink,
  type DeviceWorkoutLinkPayload,
  type DeviceWorkoutLinkResponse,
  type DeviceWorkoutsResponse,
  type PlanTemplateRecommendation,
  type PlannerSuggestion,
  type PlannerWarning,
  type PlanExerciseInput,
  type TemplatePackRecommendation,
  type TemplatePackRecommendationResponse,
  type TemplatePackItem,
  type AutoAssignMicrocyclePayload,
  type PlanTemplateRecommendationResponse,
  type PlanTemplatePayload,
  type PlanTemplateSummary,
  type ReadinessEntry,
  type ReadinessFormValues,
  type ReadinessResponse,
  type ReadinessSubmissionPayload,
  type DeleteCompetitionsPayload,
  type DeleteCompetitionsResponse,
  estimateTrainingBlockLoad,
  estimateTrainingBlocksLoad,
  type UwwEventSyncFilters,
  type UwwEventSyncOptions,
  type UwwEventSyncOptionsResponse,
  type UwwEventSyncResponse,
} from "@training-platform/shared";
import { startTransition, type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import {
  LANGUAGE_OPTIONS as I18N_LANGUAGE_OPTIONS,
  type Language as I18nLanguage,
  UI_TEXT as IMPORTED_UI_TEXT,
  formatQueueItemLabel as importedFormatQueueItemLabel,
  queueConflictLabel as importedQueueConflictLabel,
  queueItemStatusLabel as importedQueueItemStatusLabel,
  queueLabel as importedQueueLabel,
  syncStateLabel as importedSyncStateLabel,
  translateAnalyticsEvidenceLabel as importedTranslateAnalyticsEvidenceLabel,
  translateAnalyticsCoachSuggestionRecommendation as importedTranslateAnalyticsCoachSuggestionRecommendation,
  translateAnalyticsCoachSuggestionSummary as importedTranslateAnalyticsCoachSuggestionSummary,
  translateAnalyticsCoachSuggestionTitle as importedTranslateAnalyticsCoachSuggestionTitle,
  translateAnalyticsDecisionOutcome as importedTranslateAnalyticsDecisionOutcome,
  translateAnalyticsDecisionStatus as importedTranslateAnalyticsDecisionStatus,
  translateAnalyticsInsightLevel as importedTranslateAnalyticsInsightLevel,
  translateAnalyticsInsightRecommendation as importedTranslateAnalyticsInsightRecommendation,
  translateAnalyticsInsightSummary as importedTranslateAnalyticsInsightSummary,
  translateAnalyticsInsightTitle as importedTranslateAnalyticsInsightTitle,
  translateAnalyticsMissingLink as importedTranslateAnalyticsMissingLink,
  translateAnalyticsWeekStatus as importedTranslateAnalyticsWeekStatus,
  translateBlockAction as importedTranslateBlockAction,
  translateExecutionStatus as importedTranslateExecutionStatus,
  translateModule as importedTranslateModule,
  translateRoleName as importedTranslateRoleName,
  translateTrainingRole as importedTranslateTrainingRole,
  COPY as importedCopy,
  translateReadinessReason as importedTranslateReadinessReason,
  translateAdaptationText as importedTranslateAdaptationText,
} from "./lib/i18n";
import {
  STORAGE_KEYS as OFFLINE_STORAGE_KEYS,
  countActiveQueueItems as importedCountActiveQueueItems,
  createQueueItem as importedCreateQueueItem,
  enqueueOfflineItem as importedEnqueueOfflineItem,
  getActiveQueueItems as importedGetActiveQueueItems,
  getOfflineQueue as importedGetOfflineQueue,
  getQueueErrorMap as importedGetQueueErrorMap,
  getQueueStatusCounts as importedGetQueueStatusCounts,
  readCachedData as importedReadCachedData,
  setOfflineQueue as importedSetOfflineQueue,
  type QueueItem as ImportedQueueItem,
  updateQueueItem as importedUpdateQueueItem,
  writeCachedData as importedWriteCachedData,
} from "./lib/offline-sync";
import {
  type PreparationPlanReference,
  type PreparationPlanTableRow,
} from "./lib/preparation-plan-reference";
import { type WorkspacePreviewState } from "./lib/workspace-preview";
import {
  type CoachDashboardView,
  type PlanningStudioView,
  type WorkspaceSectionId,
} from "./lib/workspace-types";
import {
  WorkspaceContextDock,
  WorkspaceContextSection,
  WorkspaceRail,
  WorkspaceStageHeader,
  WorkspaceTopBar,
} from "./components/workspace-shell";
import {
  AthleteWorkspaceScene,
  CoachDashboardScene,
  OfflineSyncCenterScene,
  PlanningStudioScene,
} from "./components/workspace-scenes";
import { AthleteWorkspace } from "./components/athlete-workspace";
import { CoachDashboard } from "./components/coach-dashboard";
import { PlanningStudio } from "./components/planning-studio";
import { OfflineSyncCenter } from "./components/offline-sync-center";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";
const mobileAppDownloadUrl =
  process.env.NEXT_PUBLIC_MOBILE_APP_DOWNLOAD_URL?.trim() ||
  "/downloads/perform-mobile-android.apk";
const SHOW_OFFLINE_CENTER_NAV = false;

function getDateInputValue(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function shiftDateInputValue(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return getDateInputValue();
  }

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function diffDateInputDays(fromDateValue: string, toDateValue: string) {
  const fromDate = new Date(`${fromDateValue}T00:00:00.000Z`);
  const toDate = new Date(`${toDateValue}T00:00:00.000Z`);

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return null;
  }

  return Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));
}

function deriveAthletePreparationPhase(daysToCompetition: number | null): PreparationPhase | null {
  if (daysToCompetition === null) {
    return null;
  }

  if (daysToCompetition > 30) {
    return "base";
  }

  if (daysToCompetition >= 15) {
    return "strength";
  }

  if (daysToCompetition >= 8) {
    return "specific";
  }

  if (daysToCompetition >= 2) {
    return "taper";
  }

  if (daysToCompetition >= 0) {
    return "competition";
  }

  if (daysToCompetition >= -7) {
    return "recovery";
  }

  return null;
}

function getDateYearValue(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.getUTCFullYear();
}

function getDateMonthIndex(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return -1;
  }

  return date.getUTCMonth();
}

function getSeasonTimelinePosition(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  const year = date.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const yearEnd = Date.UTC(year, 11, 31);
  const value = date.getTime();
  const percent = ((value - yearStart) / (yearEnd - yearStart)) * 100;

  return Math.min(100, Math.max(0, percent));
}

function parseOptionalNumberInput(value: string) {
  return value === "" ? null : Number(value);
}

function formatKgValue(value: number | null) {
  return value !== null ? `${value} кг` : "-";
}

type AuthMode = "login" | "register";
type Language = I18nLanguage;
type SeasonDisplayMode = "timeline" | "hybrid";
type SeasonEditorMode = "starts" | "plan" | "result" | "cycles";
type ReviewBlock = ExecutionReviewPlan["sessions"][number]["blocks"][number];
type ReviewExercise = NonNullable<ReviewBlock["exercises"]>[number];
type CoachDayAiTaskStatus = Exclude<CoachDayAiPayload["execution"]["status"], "no-plan">;

const MONTH_LABELS: Record<Language, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ru: ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"],
  bg: ["Яну", "Фев", "Мар", "Апр", "Май", "Юни", "Юли", "Авг", "Сеп", "Окт", "Ное", "Дек"],
};

const SEASON_PHASE_LABELS: Record<string, Record<Language, string>> = {
  base: { en: "Base", ru: "База", bg: "База" },
  specific: { en: "Specific", ru: "Спецподготовка", bg: "Спецподготовка" },
  taper: { en: "Taper", ru: "Подводка", bg: "Тейпър" },
  competition: { en: "Start", ru: "Старт", bg: "Старт" },
  recovery: { en: "Recovery", ru: "Восстановление", bg: "Възстановяване" },
};

type AuthFormState = {
  email: string;
  password: string;
  fullName: string;
  role: "coach" | "athlete";
};

type QueueItem = ImportedQueueItem;

const UI_TEXT = IMPORTED_UI_TEXT;
const STORAGE_KEYS = OFFLINE_STORAGE_KEYS;

type ExecutionDraft = Omit<ExecutionResultInput, "assignedPlanId" | "assignedBlockId">;
type CoachDiaryDraft = Pick<
  CoachDiaryEntryPayload,
  "scope" | "notes" | "assignedBlockIds" | "assignedExerciseIds"
>;
type CoachDiaryTaskChoice = {
  id: string;
  kind: "block" | "exercise";
  label: string;
  meta: string;
};

type OfflineSyncErrors = Record<string, string>;
type TemplatePackDraftItem = TemplatePackRecommendation["items"][number];
type TemplatePackHistoryBiasItem = TemplatePackDraftItem["historyBiases"][number];
type TemplatePackContext = {
  athleteId: string;
  startDate: string;
};

const emptyExecutionDraft: ExecutionDraft = {
  completed: false,
  setsCompleted: null,
  repsCompleted: null,
  weightKg: null,
  durationMinutes: null,
  rpe: null,
  notes: "",
};

const emptyCoachDiaryDraft: CoachDiaryDraft = {
  scope: "day",
  notes: "",
  assignedBlockIds: [],
  assignedExerciseIds: [],
};

const emptyAthleteProfileForm: CoachAthleteProfilePayload = {
  photoUrl: "",
  birthDate: null,
  heightCm: null,
  sport: "",
  discipline: "",
  weightClass: "",
  dominantSide: "",
  baselineRestingHr: null,
  baselineWeightKg: null,
  wrestlingExperienceYears: null,
  strengthSquatKg: null,
  strengthBenchPressKg: null,
  strengthDeadliftKg: null,
  strengthPullUpsMax: null,
  strengthGripLeftKg: null,
  strengthGripRightKg: null,
  strengthNotes: "",
  strengths: "",
  weaknesses: "",
  injuriesOrRestrictions: "",
  preparationGoal: "",
  profileNotes: "",
};

const initialAuthForm: AuthFormState = {
  email: "",
  password: "",
  fullName: "",
  role: "athlete",
};
const SELF_REGISTRATION_ROLES = TRAINING_ROLES.filter(
  (role): role is (typeof TRAINING_ROLES)[number] & { id: AuthFormState["role"] } =>
    role.id === "coach" || role.id === "athlete",
);

const initialAssignedPlanForm: AssignedPlanPayload = {
  athleteId: "",
  templateId: "",
  startDate: new Date().toISOString().slice(0, 10),
  dayLabel: "Day 1",
  notes: "Assigned from coach workspace",
  plannedPhase: null,
};

const initialCompetitionForm: CreateCompetitionPayload = {
  title: "",
  federation: "",
  location: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  level: "national",
  ageGroup: "",
  description: "",
};

const initialUwwSyncFilters: UwwEventSyncFilters = {
  year: String(new Date().getFullYear()),
  ageGroup: "",
  style: "",
  eventType: "",
  country: "",
};

const emptyUwwSyncOptions: UwwEventSyncOptions = {
  years: [],
  ageGroups: [],
  styles: [],
  eventTypes: [],
  countries: [],
};

const initialOlympicCycleForm: CreateOlympicCyclePayload = {
  name: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  targetEvent: "",
  description: "",
};

const initialSeasonForm: CreateSeasonPayload = {
  athleteId: "",
  olympicCycleId: null,
  year: new Date().getFullYear(),
  name: "",
  goal: "",
  strategyType: "single_peak",
};

const initialCompetitionPlanForm: CreateCompetitionPlanPayload = {
  athleteId: "",
  seasonId: null,
  competitionId: "",
  priority: "B",
  planType: "main",
  peakRequired: false,
  taperDays: 7,
  weightCutRequired: false,
  targetWeight: null,
  currentWeight: null,
  expectedMatches: null,
  competitionFormat: "",
  prepStartDate: new Date().toISOString().slice(0, 10),
  prepEndDate: new Date().toISOString().slice(0, 10),
  notes: "",
};

const initialMesocycleForm: CreateMesocyclePayload = {
  athleteId: "",
  seasonId: null,
  competitionPlanId: null,
  name: "",
  phase: "base",
  goal: "",
  progressionType: "linear",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  weeksCount: 4,
  notes: "",
};

const initialCompetitionResultForm: CompetitionResultPayload = {
  competitionPlanId: "",
  finalPlace: null,
  matchesCount: null,
  weightAtWeighIn: null,
  weightAfter: null,
  performanceNotes: "",
  coachNotes: "",
};

const initialMicrocycleForm: AutoAssignMicrocyclePayload = {
  athleteId: "",
  startDate: new Date().toISOString().slice(0, 10),
  daysCount: 5,
  notes: "Phase-driven microcycle",
  plannedPhase: null,
  items: [],
};

const COPY = importedCopy;
const queueLabel = importedQueueLabel;
const translateRoleName = importedTranslateRoleName;
const translateExecutionStatus = importedTranslateExecutionStatus;
const translateBlockAction = importedTranslateBlockAction;
const translateReadinessReason = importedTranslateReadinessReason;
const translateAdaptationText = importedTranslateAdaptationText;

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers ?? {});

  if (options?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const rawMessage = await response.text();
    let message = rawMessage;

    if (rawMessage) {
      try {
        const errorBody = JSON.parse(rawMessage) as { message?: unknown };

        if (typeof errorBody.message === "string" && errorBody.message) {
          message = errorBody.message;
        }
      } catch {
        message = rawMessage;
      }
    }

    throw new Error(message || `Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

function copyFor(language: Language, values: Record<Language, string>) {
  return values[language];
}

function coachDiaryTargetKey(entry: Pick<
  CoachDiaryEntryPayload,
  "athleteId" | "assignedPlanId" | "entryDate" | "scope" | "assignedBlockIds" | "assignedExerciseIds"
>) {
  const blockIds = [...entry.assignedBlockIds].sort().join(",");
  const exerciseIds = [...entry.assignedExerciseIds].sort().join(",");
  return [
    entry.athleteId,
    entry.assignedPlanId,
    entry.entryDate,
    entry.scope,
    blockIds,
    exerciseIds,
  ].join(":");
}

function upsertCoachDiaryEntry(entries: CoachDiaryEntry[], entry: CoachDiaryEntry) {
  const nextEntryKey = coachDiaryTargetKey(entry);
  return [entry, ...entries.filter((item) => item.id !== entry.id && coachDiaryTargetKey(item) !== nextEntryKey)]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function upsertDeviceWorkout(workouts: DeviceWorkout[], workout: DeviceWorkout) {
  return [
    workout,
    ...workouts.filter((item) =>
      item.id !== workout.id &&
      (
        item.athleteId !== workout.athleteId ||
        item.provider !== workout.provider ||
        item.sourceWorkoutId !== workout.sourceWorkoutId
      )
    ),
  ].slice(0, 250);
}

function upsertDeviceWorkoutLink(links: DeviceWorkoutLink[], link: DeviceWorkoutLink) {
  return [
    link,
    ...links.filter((item) =>
      item.id !== link.id &&
      (
        item.athleteId !== link.athleteId ||
        item.assignedBlockId !== link.assignedBlockId ||
        item.deviceWorkoutId !== link.deviceWorkoutId
      )
    ),
  ].slice(0, 250);
}

function sortCoachAiReviewsNewestFirst(left: CoachDayAiReview, right: CoachDayAiReview) {
  return right.generatedAt.localeCompare(left.generatedAt);
}

function upsertCoachAiReviewHistory(reviews: CoachDayAiReview[], review: CoachDayAiReview) {
  const nextReviews = review.id
    ? reviews.filter((item) => item.id !== review.id)
    : reviews.filter(
        (item) =>
          item.athleteId !== review.athleteId ||
          item.entryDate !== review.entryDate ||
          item.generatedAt !== review.generatedAt,
      );

  return [review, ...nextReviews]
    .filter((item) => item.source !== "local-rules")
    .sort(sortCoachAiReviewsNewestFirst)
    .slice(0, 300);
}

function getCoachAiReviewsForDay(
  reviews: CoachDayAiReview[],
  athleteId: string,
  entryDate: string,
) {
  return reviews
    .filter(
      (review) =>
        review.athleteId === athleteId &&
        review.entryDate === entryDate &&
        review.source !== "local-rules",
    )
    .slice()
    .sort(sortCoachAiReviewsNewestFirst);
}

function formatCoachAiReviewSource(source: CoachDayAiReview["source"], language: Language) {
  if (source === "model") {
    return copyFor(language, { en: "AI model", ru: "ИИ-модель", bg: "AI модел" });
  }

  if (source === "server-rules") {
    return copyFor(language, {
      en: "server review",
      ru: "серверный разбор",
      bg: "сървърен анализ",
    });
  }

  return copyFor(language, {
    en: "local draft",
    ru: "локальный черновик",
    bg: "локална чернова",
  });
}

function roundCoachAiLoad(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(1)) : 0;
}

function getCoachAiReviewStatusFromReview(status: ReviewBlock["executionStatus"]): CoachDayAiTaskStatus {
  return status === "completed" ? "completed" : status === "partial" ? "partial" : "missed";
}

function getCoachAiExerciseStatus(exercise: ReviewExercise): CoachDayAiTaskStatus {
  if (exercise.executionStatus === "completed") {
    return "completed";
  }

  if (exercise.executionStatus === "partial" || hasCoachAiExerciseDetails(exercise.actualResult)) {
    return "partial";
  }

  return "missed";
}

function hasCoachAiExerciseDetails(result: ReviewExercise["actualResult"]) {
  return Boolean(
    result &&
      (result.setsCompleted !== null ||
        result.repsCompleted !== null ||
        result.weightKg !== null ||
        result.durationMinutes !== null ||
        result.rpe !== null ||
        result.notes.trim().length > 0),
  );
}

function formatCoachAiExerciseActual(result: ReviewExercise["actualResult"], language: Language) {
  if (!result) {
    return copyFor(language, { en: "not marked", ru: "нет отметки", bg: "няма отметка" });
  }

  const parts = [
    result.completed
      ? copyFor(language, { en: "marked", ru: "отмечено", bg: "отбелязано" })
      : "",
    result.setsCompleted !== null
      ? `${result.setsCompleted} ${copyFor(language, { en: "sets", ru: "подх.", bg: "сер." })}`
      : "",
    result.repsCompleted !== null
      ? `${result.repsCompleted} ${copyFor(language, { en: "reps", ru: "повт.", bg: "повт." })}`
      : "",
    result.weightKg !== null ? `${result.weightKg} кг` : "",
    result.durationMinutes !== null
      ? `${result.durationMinutes} ${copyFor(language, { en: "min", ru: "мин.", bg: "мин." })}`
      : "",
    result.rpe !== null ? `RPE ${result.rpe}` : "",
    result.notes.trim(),
  ].filter(Boolean);

  return parts.length
    ? parts.join(" · ")
    : copyFor(language, {
        en: "result row exists, but details are empty",
        ru: "есть строка, но факт не заполнен",
        bg: "има ред, но реалното изпълнение не е попълнено",
      });
}

function formatCoachAiReadinessFlags(entry: ReadinessEntry, language: Language) {
  if (entry.explanation.length === 0) {
    return copyFor(language, {
      en: "no additional readiness flags",
      ru: "без дополнительных факторов готовности",
      bg: "без допълнителни фактори за готовност",
    });
  }

  return entry.explanation.join(", ");
}

function formatCoachAiReadinessStatus(status: ReadinessEntry["status"], language: Language) {
  if (status === "green") {
    return copyFor(language, { en: "Green", ru: "Зелёный", bg: "Зелен" });
  }

  if (status === "yellow") {
    return copyFor(language, { en: "Yellow", ru: "Жёлтый", bg: "Жълт" });
  }

  return copyFor(language, { en: "Red", ru: "Красный", bg: "Червен" });
}

function getDeviceHealthSummaryForDay(
  summaries: DeviceHealthDailySummary[],
  athleteId: string,
  entryDate: string,
) {
  return summaries
    .filter((summary) =>
      summary.athleteId === athleteId &&
      summary.entryDate === entryDate
    )
    .sort(compareDeviceHealthSummaries)[0] ?? null;
}

function getDeviceWorkoutsForDay(
  workouts: DeviceWorkout[],
  athleteId: string,
  entryDate: string,
) {
  return workouts
    .filter((workout) =>
      workout.athleteId === athleteId &&
      workout.entryDate === entryDate
    )
    .sort((left, right) => left.startTime.localeCompare(right.startTime));
}

function getDeviceWorkoutLinksForDay(
  links: DeviceWorkoutLink[],
  athleteId: string,
  entryDate: string,
) {
  return links
    .filter((link) =>
      link.athleteId === athleteId &&
      link.workout.entryDate === entryDate
    )
    .sort((left, right) => left.workout.startTime.localeCompare(right.workout.startTime));
}

function getDeviceWorkoutLinkForBlock(
  links: DeviceWorkoutLink[],
  assignedBlockId: string,
) {
  return links.find((link) => link.assignedBlockId === assignedBlockId) ?? null;
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

function hasReviewExecutionMarks(review: ExecutionReviewPlan | null) {
  return Boolean(
    review?.sessions.some((session) =>
      session.blocks.some((block) =>
        Boolean(block.actualResult) ||
        (block.exercises ?? []).some((exercise) => Boolean(exercise.actualResult))
      )
    ),
  );
}

function formatDeviceDuration(minutes: number | null | undefined, language: Language) {
  if (minutes === null || minutes === undefined) {
    return "-";
  }

  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);

  if (hours <= 0) {
    return `${rest} ${copyFor(language, { en: "min", ru: "мин", bg: "мин" })}`;
  }

  return rest > 0
    ? `${hours} ${copyFor(language, { en: "h", ru: "ч", bg: "ч" })} ${rest} ${copyFor(language, { en: "min", ru: "мин", bg: "мин" })}`
    : `${hours} ${copyFor(language, { en: "h", ru: "ч", bg: "ч" })}`;
}

function formatCoachDayLoadValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDeviceSleepValue(summary: DeviceHealthDailySummary | null, language: Language) {
  if (!summary?.sleep) {
    return "-";
  }

  if (summary.sleep.durationMinutes !== null) {
    return formatDeviceDuration(summary.sleep.durationMinutes, language);
  }

  return summary.sleep.score !== null ? String(summary.sleep.score) : "-";
}

function formatDeviceRestingHrValue(summary: DeviceHealthDailySummary | null) {
  const source = readDeviceRawText(summary?.rawPayload ?? null, "restingHeartRateSource");
  return summary?.heartRate?.restingBpm !== null && summary?.heartRate?.restingBpm !== undefined
    ? `${isEstimatedDeviceRestingHrSource(source) ? "≈" : ""}${summary.heartRate.restingBpm}`
    : "-";
}

function formatDeviceRestingHrDetail(summary: DeviceHealthDailySummary | null, language: Language) {
  if (!summary?.heartRate?.restingBpm) {
    return copyFor(language, { en: "not synced", ru: "не синхронизирован", bg: "не е синхронизиран" });
  }

  const source = readDeviceRawText(summary.rawPayload ?? null, "restingHeartRateSource");

  if (source === "calculated-from-sleep-heart-rate") {
    const sampleCount = readDeviceRawCount(summary.rawPayload ?? null, "sleepHeartRateSampleCount");
    const windowLabel = formatDeviceRawTimeRange(summary.rawPayload ?? null, language);
    return [
      copyFor(language, { en: "sleep average", ru: "средний за сон", bg: "среден за сън" }),
      sampleCount > 0
        ? `${sampleCount} ${copyFor(language, { en: "samples", ru: "зам.", bg: "изм." })}`
        : null,
      windowLabel,
    ].filter((item): item is string => Boolean(item)).join(" · ");
  }

  if (source === "health-connect-resting-record") {
    return copyFor(language, {
      en: "received directly from Health Connect",
      ru: "получен напрямую из Health Connect",
      bg: "получен директно от Health Connect",
    });
  }

  return summary.heartRate.averageBpm
    ? `${copyFor(language, { en: "avg", ru: "средний", bg: "среден" })} ${summary.heartRate.averageBpm}`
    : copyFor(language, { en: "not synced", ru: "не синхронизирован", bg: "не е синхронизиран" });
}

function readDeviceRawText(rawPayload: Record<string, unknown> | null | undefined, key: string) {
  const value = rawPayload?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readDeviceRawCount(rawPayload: Record<string, unknown> | null | undefined, key: string) {
  const value = rawPayload?.[key];
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? Math.max(0, Math.trunc(numericValue)) : 0;
}

function formatDeviceRawTimeRange(rawPayload: Record<string, unknown> | null | undefined, language: Language) {
  const start = readDeviceRawText(rawPayload, "restingHeartRateWindowStart");
  const end = readDeviceRawText(rawPayload, "restingHeartRateWindowEnd");

  if (!start || !end) {
    return null;
  }

  const locale = language === "en" ? "en-US" : language === "bg" ? "bg-BG" : "ru-RU";
  const formatter = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
  return `${copyFor(language, { en: "sleep", ru: "сон", bg: "сън" })} ${formatter.format(new Date(start))}-${formatter.format(new Date(end))}`;
}

function isEstimatedDeviceRestingHrSource(source: string | null) {
  return source === "calculated-from-sleep-heart-rate" || source === "estimated-from-sleep-heart-rate";
}

function formatDeviceWorkoutValue(summary: DeviceHealthDailySummary | null) {
  return summary?.workout ? String(summary.workout.count) : "-";
}

function formatDeviceWorkoutTypeLabel(workout: DeviceWorkout, language: Language) {
  const type = workout.workoutType.trim().toLowerCase();
  const knownTypes: Record<string, Record<Language, string>> = {
    cycling: { en: "Cycling", ru: "Велотренировка", bg: "Колоездене" },
    hiking: { en: "Hike", ru: "Поход", bg: "Преход" },
    running: { en: "Run", ru: "Бег", bg: "Бягане" },
    walking: { en: "Walk", ru: "Ходьба", bg: "Ходене" },
    workout: { en: "Device workout", ru: "Тренировка с устройства", bg: "Тренировка от устройство" },
  };

  if (!type || /^exercise-\d+$/i.test(type)) {
    return copyFor(language, {
      en: "Device workout",
      ru: "Тренировка с устройства",
      bg: "Тренировка от устройство",
    });
  }

  return knownTypes[type]?.[language] ?? workout.workoutType;
}

function formatDeviceWorkoutTitle(workout: DeviceWorkout, language: Language) {
  const time = formatDeviceWorkoutTimeRange(workout, language);
  return `${formatDeviceWorkoutTypeLabel(workout, language)}${time ? ` · ${time}` : ""}`;
}

function formatDeviceWorkoutTimeRange(workout: DeviceWorkout, language: Language) {
  const locale = language === "en" ? "en-US" : language === "bg" ? "bg-BG" : "ru-RU";
  const formatter = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
  return `${formatter.format(new Date(workout.startTime))}-${formatter.format(new Date(workout.endTime))}`;
}

function formatDeviceDistance(meters: number, language: Language) {
  const value = (meters / 1000).toLocaleString(
    language === "en" ? "en-US" : language === "bg" ? "bg-BG" : "ru-RU",
    { maximumFractionDigits: 2, minimumFractionDigits: 2 },
  );
  return `${value} ${copyFor(language, { en: "km", ru: "км", bg: "км" })}`;
}

function formatDeviceWorkoutSummary(workout: DeviceWorkout, language: Language) {
  return [
    workout.durationMinutes !== null ? formatDeviceDuration(workout.durationMinutes, language) : null,
    workout.distanceMeters !== null ? formatDeviceDistance(workout.distanceMeters, language) : null,
    workout.averageHeartRateBpm !== null
      ? `${copyFor(language, { en: "avg HR", ru: "ср. пульс", bg: "ср. пулс" })} ${Math.round(workout.averageHeartRateBpm)}`
      : null,
    workout.maxHeartRateBpm !== null
      ? `${copyFor(language, { en: "max", ru: "макс", bg: "макс" })} ${Math.round(workout.maxHeartRateBpm)}`
      : null,
    workout.activeCalories !== null ? `${Math.round(workout.activeCalories)} ${copyFor(language, { en: "kcal", ru: "ккал", bg: "ккал" })}` : null,
  ].filter(Boolean).join(" · ");
}

function formatDeviceWorkoutOptionLabel(workout: DeviceWorkout, language: Language) {
  return `${formatDeviceWorkoutTimeRange(workout, language)} · ${formatDeviceWorkoutSummary(workout, language) || formatDeviceWorkoutTypeLabel(workout, language)}`;
}

function buildDeviceWorkoutMetrics(workout: DeviceWorkout, language: Language) {
  return [
    {
      label: copyFor(language, { en: "Duration", ru: "Длительность", bg: "Продължителност" }),
      value: workout.durationMinutes !== null ? formatDeviceDuration(workout.durationMinutes, language) : "-",
    },
    {
      label: copyFor(language, { en: "Distance", ru: "Дистанция", bg: "Дистанция" }),
      value: workout.distanceMeters !== null ? formatDeviceDistance(workout.distanceMeters, language) : "-",
    },
    {
      label: copyFor(language, { en: "Avg HR", ru: "Средний пульс", bg: "Среден пулс" }),
      value: workout.averageHeartRateBpm !== null ? Math.round(workout.averageHeartRateBpm).toString() : "-",
    },
    {
      label: copyFor(language, { en: "Max HR", ru: "Макс. пульс", bg: "Макс. пулс" }),
      value: workout.maxHeartRateBpm !== null ? Math.round(workout.maxHeartRateBpm).toString() : "-",
    },
    {
      label: copyFor(language, { en: "Calories", ru: "Калории", bg: "Калории" }),
      value: workout.activeCalories !== null ? Math.round(workout.activeCalories).toString() : "-",
    },
    {
      label: copyFor(language, { en: "Graph points", ru: "Точки графика", bg: "Точки на графиката" }),
      value: workout.sampleCount.toString(),
    },
  ];
}

function limitDeviceWorkoutSamples<T>(samples: T[], maxCount = 180) {
  if (samples.length <= maxCount) {
    return samples;
  }

  const step = (samples.length - 1) / (maxCount - 1);
  return Array.from({ length: maxCount }, (_, index) => samples[Math.round(index * step)]);
}

function hasDeviceWorkoutGraph(workout: DeviceWorkout) {
  return workout.samples.some((sample) =>
    sample.heartRateBpm !== null ||
    sample.speedMetersPerSecond !== null ||
    sample.oxygenSaturationPercent !== null ||
    sample.distanceMeters !== null
  );
}

function DeviceWorkoutMiniGraph({
  language,
  workout,
}: {
  language: Language;
  workout: DeviceWorkout;
}) {
  const allHeartRateSamples = workout.samples.filter((sample) => sample.heartRateBpm !== null);

  if (!hasDeviceWorkoutGraph(workout) || allHeartRateSamples.length < 2) {
    return (
      <p className="device-workout-empty">
        {copyFor(language, {
          en: "The device sent only summary data. The graph is not available.",
          ru: "Устройство передало только итоговые данные, график недоступен.",
          bg: "Устройството е изпратило само обобщени данни. Графиката не е налична.",
        })}
      </p>
    );
  }

  const heartRateSamples = limitDeviceWorkoutSamples(allHeartRateSamples);
  const values = heartRateSamples.map((sample) => sample.heartRateBpm ?? 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const points = heartRateSamples
    .map((sample, index) => {
      const x = heartRateSamples.length === 1 ? 0 : (index / (heartRateSamples.length - 1)) * 100;
      const y = 42 - (((sample.heartRateBpm ?? min) - min) / range) * 34;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const hasSpeed = workout.samples.some((sample) => sample.speedMetersPerSecond !== null);
  const hasSpo2 = workout.samples.some((sample) => sample.oxygenSaturationPercent !== null);

  return (
    <div className="device-workout-graph">
      <svg aria-hidden="true" viewBox="0 0 100 48" preserveAspectRatio="none">
        <polyline fill="none" points={points} />
      </svg>
      <small>
        {copyFor(language, { en: "HR", ru: "Пульс", bg: "Пулс" })} {Math.round(min)}-{Math.round(max)}
        {hasSpeed ? ` · ${copyFor(language, { en: "pace/speed", ru: "темп/скорость", bg: "темпо/скорост" })}` : ""}
        {hasSpo2 ? " · SpO2" : ""}
        {allHeartRateSamples.length > heartRateSamples.length
          ? ` · ${copyFor(language, { en: "shown compactly", ru: "показано компактно", bg: "показано компактно" })}`
          : ""}
      </small>
    </div>
  );
}

function DeviceWorkoutMetricGrid({
  language,
  workout,
}: {
  language: Language;
  workout: DeviceWorkout;
}) {
  return (
    <div className="device-workout-metric-grid">
      {buildDeviceWorkoutMetrics(workout, language).map((metric) => (
        <span className="device-workout-metric" key={metric.label}>
          <small>{metric.label}</small>
          <strong>{metric.value}</strong>
        </span>
      ))}
    </div>
  );
}

function buildCoachDayDataQuality(input: {
  coachComment: string | null;
  deviceHealthSummary: DeviceHealthDailySummary | null;
  hasExecutionMarks: boolean;
  hasPlan: boolean;
  readinessEntry: ReadinessEntry | null;
  language: Language;
}): NonNullable<CoachDayAiPayload["dataQuality"]> {
  const hasDeviceSync = Boolean(input.deviceHealthSummary);
  const hasSleep = hasDeviceSleepData(input.deviceHealthSummary);
  const hasRestingHr =
    input.deviceHealthSummary?.heartRate?.restingBpm !== null &&
    input.deviceHealthSummary?.heartRate?.restingBpm !== undefined;
  const hasDeviceWorkout = Boolean(input.deviceHealthSummary?.workout);
  const signals = [
    {
      action: copyFor(input.language, {
        en: "Ask the athlete to submit readiness for the selected day.",
        ru: "Попросите спортсмена отправить готовность за выбранный день.",
        bg: "Помолете спортиста да подаде готовност за избрания ден.",
      }),
      key: "readiness",
      label: copyFor(input.language, { en: "readiness", ru: "готовность", bg: "готовност" }),
      present: Boolean(input.readinessEntry),
    },
    {
      action: copyFor(input.language, {
        en: "Assign a plan or select a day that has a plan.",
        ru: "Назначьте план или выберите день с планом.",
        bg: "Назначете план или изберете ден с план.",
      }),
      key: "plan",
      label: copyFor(input.language, { en: "plan", ru: "план", bg: "план" }),
      present: input.hasPlan,
    },
    {
      action: copyFor(input.language, {
        en: "Ask the athlete to mark execution for the day.",
        ru: "Попросите спортсмена отметить выполнение упражнений.",
        bg: "Помолете спортиста да отбележи изпълнението.",
      }),
      key: "execution",
      label: copyFor(input.language, { en: "execution", ru: "выполнение", bg: "изпълнение" }),
      present: !input.hasPlan || input.hasExecutionMarks,
    },
    {
      action: copyFor(input.language, {
        en: "Add a short coach comment for the day.",
        ru: "Добавьте короткий комментарий тренера по дню.",
        bg: "Добавете кратък коментар на треньора за деня.",
      }),
      key: "coachComment",
      label: copyFor(input.language, { en: "coach comment", ru: "комментарий тренера", bg: "коментар на треньора" }),
      present: Boolean(input.coachComment),
    },
    {
      action: copyFor(input.language, {
        en: "Ask the athlete to sync Huawei Health or Mi Fitness.",
        ru: "Попросите спортсмена синхронизировать Huawei Health или Mi Fitness.",
        bg: "Помолете спортиста да синхронизира Huawei Health или Mi Fitness.",
      }),
      key: "deviceSync",
      label: copyFor(input.language, { en: "device sync", ru: "синхронизация устройства", bg: "синхронизация на устройство" }),
      present: hasDeviceSync,
    },
    {
      action: copyFor(input.language, {
        en: "Check sleep access in the health app and sync again.",
        ru: "Проверьте доступ приложения здоровья ко сну и повторите синхронизацию.",
        bg: "Проверете достъпа до сън в здравното приложение и синхронизирайте отново.",
      }),
      key: "sleep",
      label: copyFor(input.language, { en: "sleep", ru: "сон", bg: "сън" }),
      present: hasSleep,
    },
    {
      action: copyFor(input.language, {
        en: "Check heart-rate access in the health app and sync again.",
        ru: "Проверьте доступ приложения здоровья к пульсу и повторите синхронизацию.",
        bg: "Проверете достъпа до пулс в здравното приложение и синхронизирайте отново.",
      }),
      key: "restingHr",
      label: copyFor(input.language, { en: "resting HR", ru: "пульс покоя", bg: "пулс в покой" }),
      present: hasRestingHr,
    },
    {
      action: copyFor(input.language, {
        en: "Check whether device workouts arrived for the selected day.",
        ru: "Проверьте, пришли ли тренировки с устройства за выбранный день.",
        bg: "Проверете дали тренировките от устройството са дошли за избрания ден.",
      }),
      key: "deviceWorkout",
      label: copyFor(input.language, { en: "device workouts", ru: "тренировки с устройства", bg: "тренировки от устройство" }),
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
    actions: missingSignals.map((signal) => signal.action),
    available,
    missing,
    signals,
    status,
    statusLabel: status === "complete"
      ? copyFor(input.language, { en: "Enough data", ru: "Данных достаточно", bg: "Данните са достатъчни" })
      : status === "partial"
        ? copyFor(input.language, { en: "Partial data", ru: "Данные частичные", bg: "Частични данни" })
        : copyFor(input.language, { en: "Too little data for analysis", ru: "Данных мало для анализа", bg: "Малко данни за анализ" }),
  };
}

function getCoachAiBlockPlannedLoad(block: ReviewBlock) {
  return roundCoachAiLoad(block.actualResult?.plannedLoad ?? estimateTrainingBlockLoad(block));
}

function getCoachAiBlockActualLoad(block: ReviewBlock, plannedLoad: number) {
  if (block.actualResult?.actualLoad !== null && block.actualResult?.actualLoad !== undefined) {
    return roundCoachAiLoad(block.actualResult.actualLoad);
  }

  if (!block.actualResult) {
    return 0;
  }

  if (block.actualResult.durationMinutes !== null && block.actualResult.rpe !== null) {
    return roundCoachAiLoad(block.actualResult.durationMinutes * block.actualResult.rpe);
  }

  const exercises = block.exercises ?? [];
  if (exercises.length > 0) {
    const completed = exercises.filter((exercise) => exercise.actualResult?.completed === true).length;
    return roundCoachAiLoad(plannedLoad * (completed / exercises.length));
  }

  return block.actualResult.completed ? plannedLoad : 0;
}

function buildCoachDayAiPayloadFromReview(input: {
  athlete: CoachAthleteSummary | null;
  deviceHealthSummary: DeviceHealthDailySummary | null;
  deviceWorkoutLinks?: DeviceWorkoutLink[];
  diaryEntry: CoachDiaryEntry | null;
  language: Language;
  readinessEntry: ReadinessEntry | null;
  review: ExecutionReviewPlan;
}): CoachDayAiPayload {
  const blocks = input.review.sessions.flatMap((session) =>
    session.blocks.map((block) => {
      const plannedLoad = getCoachAiBlockPlannedLoad(block);
      const actualLoad = getCoachAiBlockActualLoad(block, plannedLoad);
      const exercises = [...(block.exercises ?? [])]
        .sort((left, right) => left.orderIndex - right.orderIndex)
        .map((exercise) => {
          return {
            actual: formatCoachAiExerciseActual(exercise.actualResult, input.language),
            name: exercise.name,
            plannedControl: formatExerciseControlCell(exercise, input.language).replace(/^-$/u, ""),
            plannedWork: formatExerciseWorkCell(exercise, input.language).replace(/^-$/u, ""),
            status: getCoachAiExerciseStatus(exercise),
          };
        });

      return {
        actualLoad,
        exercises,
        name: block.name,
        plannedLoad,
        sessionName: session.name,
        status: getCoachAiReviewStatusFromReview(block.executionStatus),
      };
    }),
  );
  const plannedLoad = roundCoachAiLoad(blocks.reduce((sum, block) => sum + block.plannedLoad, 0));
  const actualLoad = roundCoachAiLoad(blocks.reduce((sum, block) => sum + block.actualLoad, 0));
  const linkedWorkouts = (input.deviceWorkoutLinks ?? []).map((link) => {
    const planBlockName =
      input.review.sessions
        .flatMap((session) => session.blocks)
        .find((block) => block.id === link.assignedBlockId)?.name ?? "";

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
      maxHeartRateBpm: link.workout.maxHeartRateBpm,
      planBlockId: link.assignedBlockId,
      planBlockName,
      sourceDevice: link.workout.sourceDevice,
      startTime: link.workout.startTime,
      workoutId: link.workout.id,
      workoutType: link.workout.workoutType,
    };
  });
  const executionStatus =
    input.review.summary.plannedBlocks === 0
      ? "no-plan"
      : input.review.summary.completedBlocks >= input.review.summary.plannedBlocks
        ? "completed"
        : input.review.summary.completedBlocks + input.review.summary.partialBlocks > 0
          ? "partial"
          : "missed";

  return {
    athlete: {
      discipline: input.athlete?.discipline || null,
      displayName: input.review.athleteName,
      sport: input.athlete?.sport || null,
      weightClass: input.athlete?.weightClass || null,
    },
    coachComment: input.diaryEntry?.notes.trim() || null,
    dataQuality: buildCoachDayDataQuality({
      coachComment: input.diaryEntry?.notes.trim() || null,
      deviceHealthSummary: input.deviceHealthSummary,
      hasExecutionMarks: hasReviewExecutionMarks(input.review),
      hasPlan: input.review.summary.plannedBlocks > 0,
      language: input.language,
      readinessEntry: input.readinessEntry,
    }),
    date: input.review.dayDate,
    deviceHealth: input.deviceHealthSummary || linkedWorkouts.length
      ? {
          heartRate: input.deviceHealthSummary?.heartRate
            ? {
                averageBpm: input.deviceHealthSummary?.heartRate?.averageBpm ?? null,
                hrvRmssdMs: input.deviceHealthSummary?.heartRate?.hrvRmssdMs ?? null,
                maxBpm: input.deviceHealthSummary?.heartRate?.maxBpm ?? null,
                minBpm: input.deviceHealthSummary?.heartRate?.minBpm ?? null,
                restingBpm: input.deviceHealthSummary?.heartRate?.restingBpm ?? null,
              }
            : null,
          missing: buildCoachDayDataQuality({
            coachComment: input.diaryEntry?.notes.trim() || null,
            deviceHealthSummary: input.deviceHealthSummary,
            hasExecutionMarks: hasReviewExecutionMarks(input.review),
            hasPlan: input.review.summary.plannedBlocks > 0,
            language: input.language,
            readinessEntry: input.readinessEntry,
          }).missing.filter((item) =>
            [
              copyFor(input.language, { en: "sleep", ru: "сон", bg: "сън" }),
              copyFor(input.language, { en: "resting HR", ru: "пульс покоя", bg: "пулс в покой" }),
              copyFor(input.language, { en: "device workouts", ru: "тренировки с устройства", bg: "тренировки от устройство" }),
            ].includes(item)
          ),
          linkedWorkouts,
          sleep: input.deviceHealthSummary?.sleep
            ? {
                awakeMinutes: input.deviceHealthSummary?.sleep?.awakeMinutes ?? null,
                deepMinutes: input.deviceHealthSummary?.sleep?.deepMinutes ?? null,
                durationMinutes: input.deviceHealthSummary?.sleep?.durationMinutes ?? null,
                lightMinutes: input.deviceHealthSummary?.sleep?.lightMinutes ?? null,
                remMinutes: input.deviceHealthSummary?.sleep?.remMinutes ?? null,
                score: input.deviceHealthSummary?.sleep?.score ?? null,
              }
            : null,
          sourceDevice: input.deviceHealthSummary?.sourceDevice ?? linkedWorkouts[0]?.sourceDevice ?? null,
          statusLabel: input.deviceHealthSummary
            ? copyFor(input.language, { en: "Device data received", ru: "Данные устройства получены", bg: "Данните от устройството са получени" })
            : copyFor(input.language, { en: "Device workout linked", ru: "Тренировка устройства связана", bg: "Тренировка от устройство е свързана" }),
          syncedAt: input.deviceHealthSummary?.syncedAt ?? null,
          workout: input.deviceHealthSummary?.workout
            ? {
                activeCalories: input.deviceHealthSummary?.workout?.activeCalories ?? null,
                averageHeartRateBpm: input.deviceHealthSummary?.workout?.averageHeartRateBpm ?? null,
                count: input.deviceHealthSummary?.workout?.count ?? 0,
                maxHeartRateBpm: input.deviceHealthSummary?.workout?.maxHeartRateBpm ?? null,
                totalDistanceMeters: input.deviceHealthSummary?.workout?.totalDistanceMeters ?? null,
                totalDurationMinutes: input.deviceHealthSummary?.workout?.totalDurationMinutes ?? null,
              }
            : null,
        }
      : null,
    execution: {
      blocks: {
        completed: input.review.summary.completedBlocks,
        missed: input.review.summary.missedBlocks,
        partial: input.review.summary.partialBlocks,
        total: input.review.summary.plannedBlocks,
      },
      exercises: {
        completed: input.review.summary.completedExercises,
        missed: input.review.summary.missedExercises,
        partial: input.review.summary.partialExercises,
        total: input.review.summary.plannedExercises,
      },
      status: executionStatus,
      statusLabel:
        executionStatus === "completed"
          ? copyFor(input.language, { en: "Completed", ru: "Выполнено", bg: "Изпълнено" })
          : executionStatus === "partial"
            ? copyFor(input.language, {
                en: "Partially completed",
                ru: "Частично выполнено",
                bg: "Частично изпълнено",
              })
            : executionStatus === "missed"
              ? copyFor(input.language, {
                  en: "Not completed",
                  ru: "Не выполнено",
                  bg: "Не е изпълнено",
                })
              : copyFor(input.language, {
                  en: "No plan",
                  ru: "Нет плана",
                  bg: "Няма план",
                }),
    },
    load: {
      actual: actualLoad,
      delta: roundCoachAiLoad(actualLoad - plannedLoad),
      planned: plannedLoad,
    },
    plan: {
      blocks,
      count: 1,
      templates: [input.review.templateName].filter(Boolean),
    },
    readiness: input.readinessEntry
      ? {
          flags: formatCoachAiReadinessFlags(input.readinessEntry, input.language),
          score: input.readinessEntry.score,
          status: input.readinessEntry.status,
          statusLabel: formatCoachAiReadinessStatus(input.readinessEntry.status, input.language),
        }
      : null,
  };
}

function withFallbackOptions(options: string[], fallback: string) {
  const values = new Set(options.filter(Boolean));

  if (fallback) {
    values.add(fallback);
  }

  return [...values];
}

function syncCompetitionSelection(
  selectedIds: string[],
  competitions: CompetitionSummary[],
) {
  const availableIds = new Set(competitions.map((competition) => competition.id));
  return selectedIds.filter((id) => availableIds.has(id));
}

function syncPlanTemplateSelection(
  selectedIds: string[],
  templates: PlanTemplateSummary[],
) {
  const availableIds = new Set(templates.map((template) => template.id));
  return selectedIds.filter((id) => availableIds.has(id));
}

function syncAssignedPlanSelection(
  selectedIds: string[],
  assignedPlans: AssignedPlanSummary[],
) {
  const availableIds = new Set(assignedPlans.map((plan) => plan.id));
  return selectedIds.filter((id) => availableIds.has(id));
}

function buildAthleteProfileForm(athlete: CoachAthleteSummary | null): CoachAthleteProfilePayload {
  if (!athlete) {
    return emptyAthleteProfileForm;
  }

  return {
    photoUrl: athlete.photoUrl,
    birthDate: athlete.birthDate,
    heightCm: athlete.heightCm,
    sport: athlete.sport,
    discipline: athlete.discipline,
    weightClass: athlete.weightClass,
    dominantSide: athlete.dominantSide,
    baselineRestingHr: athlete.baselineRestingHr,
    baselineWeightKg: athlete.baselineWeightKg,
    wrestlingExperienceYears: athlete.wrestlingExperienceYears,
    strengthSquatKg: athlete.strengthSquatKg,
    strengthBenchPressKg: athlete.strengthBenchPressKg,
    strengthDeadliftKg: athlete.strengthDeadliftKg,
    strengthPullUpsMax: athlete.strengthPullUpsMax,
    strengthGripLeftKg: athlete.strengthGripLeftKg,
    strengthGripRightKg: athlete.strengthGripRightKg,
    strengthNotes: athlete.strengthNotes,
    strengths: athlete.strengths,
    weaknesses: athlete.weaknesses,
    injuriesOrRestrictions: athlete.injuriesOrRestrictions,
    preparationGoal: athlete.preparationGoal,
    profileNotes: athlete.profileNotes,
  };
}

function getAthleteInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getAthleteAge(birthDate: string | null) {
  if (!birthDate) {
    return null;
  }

  const parsedDate = new Date(`${birthDate}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - parsedDate.getFullYear();
  const monthDelta = today.getMonth() - parsedDate.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < parsedDate.getDate())) {
    age -= 1;
  }

  return age;
}

function getAthleteProfileSaveErrorMessage(message: string, language: Language) {
  if (message.includes("birthDate cannot be in the future")) {
    return copyFor(language, {
      en: "Birth date cannot be in the future.",
      ru: "Дата рождения не может быть в будущем.",
      bg: "Датата на раждане не може да бъде в бъдещето.",
    });
  }

  if (message.includes("birthDate must be a valid date")) {
    return copyFor(language, {
      en: "Enter birth date in the correct format.",
      ru: "Укажите дату рождения в правильном формате.",
      bg: "Въведете датата на раждане в правилен формат.",
    });
  }

  return message;
}

const PREPARATION_PHASE_LABELS: Record<string, Record<Language, string>> = {
  base: { en: "Base", ru: "Базовая", bg: "Базова" },
  strength: { en: "Strength", ru: "Силовая", bg: "Силова" },
  specific: { en: "Specific", ru: "Специальная", bg: "Специфична" },
  taper: { en: "Taper", ru: "Подводка", bg: "Тейпър" },
  competition: { en: "Competition", ru: "Соревновательная", bg: "Състезателна" },
  recovery: { en: "Recovery", ru: "Восстановление", bg: "Възстановяване" },
};

const PREPARATION_PHASE_VALUES = [
  "base",
  "strength",
  "specific",
  "taper",
  "competition",
  "recovery",
] as const;

const BLOCK_TYPE_LABELS: Record<string, Record<Language, string>> = {
  technical: { en: "Technical", ru: "Технический", bg: "Технически" },
  speed: { en: "Speed", ru: "Скоростной", bg: "Скоростен" },
  strength: { en: "Strength", ru: "Силовой", bg: "Силов" },
  CNS_high: { en: "High CNS load", ru: "Высокая нагрузка ЦНС", bg: "Високо ЦНС натоварване" },
  metabolic: { en: "Metabolic", ru: "Метаболический", bg: "Метаболитен" },
  conditioning: { en: "Conditioning", ru: "Кондиционный", bg: "Кондиционен" },
  recovery: { en: "Recovery", ru: "Восстановительный", bg: "Възстановителен" },
  mobility: { en: "Mobility", ru: "Мобильность", bg: "Мобилност" },
  activation: { en: "Activation", ru: "Активация", bg: "Активация" },
};

const PLAN_BLOCK_TYPE_VALUES = [
  "technical",
  "speed",
  "strength",
  "CNS_high",
  "metabolic",
  "conditioning",
  "recovery",
  "mobility",
  "activation",
] as const satisfies readonly PlanTemplatePayload["blocks"][number]["blockType"][];

type PlanBlockType = PlanTemplatePayload["blocks"][number]["blockType"];
type PlanTemplateDayInput = NonNullable<PlanTemplatePayload["days"]>[number];
type PlanTemplateSessionInput = PlanTemplateDayInput["sessions"][number];

type ImportedPlanDayDraft = {
  label: string;
  dayDate: string | null;
  dayOffset: number;
  templateDayIndex: number;
  template: PlanTemplatePayload;
  blockCount: number;
};

type ImportedPlanDraft = {
  sourceFileName: string;
  title: string;
  description: string;
  startDate: string;
  template: PlanTemplatePayload;
  days: ImportedPlanDayDraft[];
};

type PlanAssignmentMode = "full" | "week" | "selected";

type TemplateExercisePreviewSession = {
  name: string;
  blocks: PlanTemplatePayload["blocks"];
};

type PlanTemplateStructureSource = Pick<
  PlanTemplatePayload,
  "blocks" | "days" | "microcycleType" | "templateGoal"
>;

function getTemplateExercisePreviewSessions(
  template: Pick<PlanTemplateSummary, "blocks" | "days">,
): TemplateExercisePreviewSession[] {
  const daySessions =
    template.days?.flatMap((day) =>
      day.sessions.map((session) => ({
        name: `${day.label} / ${session.name}`,
        blocks: session.blocks,
      })),
    ) ?? [];

  if (daySessions.length) {
    return daySessions;
  }

  return [
    {
      name: "",
      blocks: template.blocks,
    },
  ];
}

function countTemplateExercises(template: Pick<PlanTemplateSummary, "blocks" | "days">) {
  return getTemplateExercisePreviewSessions(template).reduce(
    (total, session) =>
      total +
      session.blocks.reduce(
        (sessionTotal, block) => sessionTotal + (block.exercises?.length ?? 0),
        0,
      ),
    0,
  );
}

function countTemplateDays(template: Pick<PlanTemplateSummary, "blocks" | "days">) {
  return template.days?.length || 1;
}

function countTemplateSessions(template: Pick<PlanTemplateSummary, "blocks" | "days">) {
  return template.days?.reduce(
    (total, day) => total + day.sessions.length,
    0,
  ) || (template.blocks.length ? 1 : 0);
}

function getTemplateStructureDays(
  template: PlanTemplateStructureSource,
  language: Language,
): PlanTemplateDayInput[] {
  if (template.days?.length) {
    return [...template.days].sort(
      (left, right) => (left.orderIndex ?? 0) - (right.orderIndex ?? 0),
    );
  }

  if (!template.blocks.length) {
    return [];
  }

  return [
    {
      label: copyFor(language, { en: "Day 1", ru: "День 1", bg: "Ден 1" }),
      notes: template.templateGoal || template.microcycleType,
      orderIndex: 0,
      sessions: [
        {
          name: copyFor(language, {
            en: "Main session",
            ru: "Основная тренировка",
            bg: "Основна тренировка",
          }),
          notes: "",
          orderIndex: 0,
          blocks: template.blocks,
        },
      ],
    },
  ];
}

function countTemplateDayBlocks(day: PlanTemplateDayInput) {
  return day.sessions.reduce((total, session) => total + session.blocks.length, 0);
}

function estimateTemplateBlocksLoad(blocks: PlanTemplatePayload["blocks"]) {
  return estimateTrainingBlocksLoad(blocks);
}

function estimateTemplateDayLoad(day: PlanTemplateDayInput) {
  return estimateTemplateBlocksLoad(day.sessions.flatMap((session) => session.blocks));
}

function estimateTemplateLoadForDay(
  template: Pick<PlanTemplateSummary, "days" | "estimatedLoad">,
  templateDayIndex: number | null | undefined,
) {
  const days = template.days ?? [];

  if (!days.length) {
    return template.estimatedLoad;
  }

  const normalizedIndex = Number.isFinite(templateDayIndex ?? NaN)
    ? Math.min(Math.max(Number(templateDayIndex), 0), days.length - 1)
    : 0;

  return estimateTemplateDayLoad(days[normalizedIndex]);
}

function countTemplateDayExercises(day: PlanTemplateDayInput) {
  return day.sessions.reduce(
    (total, session) =>
      total +
      session.blocks.reduce(
        (sessionTotal, block) => sessionTotal + (block.exercises?.length ?? 0),
        0,
      ),
    0,
  );
}

function groupTemplateDaysByWeek(days: PlanTemplateDayInput[]) {
  const weeks: Array<{ label: string; startIndex: number; days: PlanTemplateDayInput[] }> = [];

  days.forEach((day, index) => {
    const weekIndex = Math.floor(index / 7);
    weeks[weekIndex] ??= {
      label: `Week ${weekIndex + 1}`,
      startIndex: weekIndex * 7,
      days: [],
    };
    weeks[weekIndex].days.push(day);
  });

  return weeks;
}

function normalizeTemplateDayIndex(days: PlanTemplateDayInput[], index: number) {
  if (!days.length) {
    return 0;
  }

  return Math.min(Math.max(index, 0), days.length - 1);
}

function getAssignmentDayIndexes(
  days: PlanTemplateDayInput[],
  mode: PlanAssignmentMode,
  selectedDayIndex: number,
  selectedDayIndexes: number[],
) {
  if (!days.length) {
    return [];
  }

  if (mode === "full") {
    return days.map((_, index) => index);
  }

  if (mode === "week") {
    const normalizedIndex = normalizeTemplateDayIndex(days, selectedDayIndex);
    const weekStart = Math.floor(normalizedIndex / 7) * 7;
    return days
      .map((_, index) => index)
      .filter((index) => index >= weekStart && index < weekStart + 7);
  }

  const normalizedIndexes = selectedDayIndexes
    .filter((index) => index >= 0 && index < days.length)
    .sort((left, right) => left - right);

  return normalizedIndexes.length
    ? normalizedIndexes
    : [normalizeTemplateDayIndex(days, selectedDayIndex)];
}

function buildTemplateAssignmentItems(input: {
  template: PlanTemplateSummary;
  days: PlanTemplateDayInput[];
  mode: PlanAssignmentMode;
  selectedDayIndex: number;
  selectedDayIndexes: number[];
}) {
  const selectedIndexes = getAssignmentDayIndexes(
    input.days,
    input.mode,
    input.selectedDayIndex,
    input.selectedDayIndexes,
  );
  const firstIndex = selectedIndexes.length ? Math.min(...selectedIndexes) : 0;

  return selectedIndexes.map((dayIndex) => {
    const day = input.days[dayIndex];

    return {
      templateId: input.template.id,
      templateDayIndex: dayIndex,
      dayOffset: dayIndex - firstIndex,
      dayLabel: day?.label || `Day ${dayIndex + 1}`,
      microcycleType:
        day?.notes || input.template.templateGoal || input.template.microcycleType || input.template.name,
    } satisfies TemplatePackItem;
  });
}

function normalizeImportedPlanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripFileExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

function formatImportedDateValue(year: number, day: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseImportedPlanYear(...values: string[]) {
  for (const value of values) {
    const match = value.match(/\b(20\d{2})\b/);

    if (match) {
      return Number(match[1]);
    }
  }

  return new Date().getFullYear();
}

function parseImportedPlanDate(label: string, fallbackYear: number) {
  const match = label.match(/(\d{1,2})[./-](\d{1,2})/);

  if (!match) {
    return null;
  }

  return formatImportedDateValue(fallbackYear, Number(match[1]), Number(match[2]));
}

function extractImportedDurationMinutes(value: string) {
  const normalized = value.toLowerCase();
  const minuteMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:мин|m|min)(?=$|[\s/.,;:!?()-])/u);

  if (minuteMatch) {
    return Number(minuteMatch[1].replace(",", "."));
  }

  const secondMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:сек|s|sec)(?=$|[\s/.,;:!?()-])/u);

  if (secondMatch) {
    return roundImportedDurationMinutes(Number(secondMatch[1].replace(",", ".")) / 60);
  }

  return null;
}

function roundImportedDurationMinutes(value: number) {
  return Math.round(value * 100) / 100;
}

type ImportedSetDurationUnit = "minutes" | "seconds";

function hasImportedSetPattern(value: string) {
  return /\d+\s*[xх×*]\s*\d/u.test(value);
}

function hasImportedDurationUnit(value: string) {
  return /(?:сек|sec|s|мин|min|m)(?=$|[\s/.,;:!?()-])/iu.test(value);
}

function hasImportedSetDurationUnit(value: string) {
  return /\d+\s*[xх×*]\s*\d+(?:[.,]\d+)?(?:\s*[-–—]\s*\d+(?:[.,]\d+)?)?\s*(?:сек|s|sec|мин|m|min)(?=$|[\s/.,;:!?()-])/iu.test(
    value,
  );
}

function inferImportedSetDurationUnit(value: string, blockType?: PlanBlockType): ImportedSetDurationUnit | null {
  const normalized = value.toLowerCase();

  if (!hasImportedSetPattern(normalized)) {
    return null;
  }

  if (hasImportedSetDurationUnit(normalized)) {
    return null;
  }

  if (/(?:ускор|спринт|скорост|рывок|отрез|прыж|shuttle|sprint|speed)/iu.test(normalized) || blockType === "speed") {
    return "seconds";
  }

  if (/(?:схват|раунд|спарр|борьб|round|sparring)/iu.test(normalized)) {
    return "minutes";
  }

  return null;
}

function importedSetDurationUnitLabel(unit: ImportedSetDurationUnit) {
  return unit === "seconds" ? "сек" : "мин";
}

function getImportedStandaloneDurationUnit(value: string): ImportedSetDurationUnit | null {
  const normalized = normalizeImportedPlanText(value).toLowerCase();

  if (/^(?:сек|s|sec)\.?$/iu.test(normalized)) {
    return "seconds";
  }

  if (/^(?:мин|m|min)\.?$/iu.test(normalized)) {
    return "minutes";
  }

  return null;
}

function inferDetachedImportedSetDurationUnit(volume: string, control: string) {
  const normalizedVolume = normalizeImportedPlanText(volume);

  if (!hasImportedSetPattern(normalizedVolume) || hasImportedDurationUnit(normalizedVolume)) {
    return null;
  }

  const controlParts = normalizeImportedPlanText(control).split(/\s*\/\s*/u);

  for (const part of controlParts) {
    const standaloneUnit = getImportedStandaloneDurationUnit(part);

    if (standaloneUnit) {
      return standaloneUnit;
    }
  }

  const leadingUnitMatch = normalizeImportedPlanText(control)
    .toLowerCase()
    .match(/^(сек|s|sec|мин|m|min)\.?(?:\s+|$)/iu);

  if (!leadingUnitMatch) {
    return null;
  }

  return /^(?:сек|s|sec)$/iu.test(leadingUnitMatch[1]) ? "seconds" : "minutes";
}

function removeDetachedImportedSetDurationUnit(control: string, unit: ImportedSetDurationUnit | null) {
  if (!unit) {
    return normalizeImportedPlanText(control);
  }

  const unitPattern =
    unit === "seconds"
      ? /^(?:сек|s|sec)\.?(?:\s+|$)/iu
      : /^(?:мин|m|min)\.?(?:\s+|$)/iu;

  return normalizeImportedPlanText(control)
    .split(/\s*\/\s*/u)
    .map((part) => part.replace(unitPattern, "").trim())
    .filter((part) => part && getImportedStandaloneDurationUnit(part) !== unit)
    .join(" / ");
}

function normalizeImportedVolumeText(
  name: string,
  volume: string,
  control: string,
  blockType: PlanBlockType,
  detachedUnit: ImportedSetDurationUnit | null = null,
) {
  const normalizedVolume = normalizeImportedPlanText(volume);
  const inferredUnit =
    detachedUnit ??
    inferImportedSetDurationUnit(
      normalizeImportedPlanText(`${name} ${normalizedVolume} ${control}`),
      blockType,
    );

  if (!inferredUnit) {
    return normalizedVolume;
  }

  return normalizedVolume.replace(
    /(\d+)\s*[xх×*]\s*(\d+(?:[.,]\d+)?)(?!\s*(?:сек|s|sec|мин|m|min)(?=$|[\s/.,;:!?()-]))/iu,
    `$1×$2 ${importedSetDurationUnitLabel(inferredUnit)}`,
  );
}

function extractImportedSetDuration(value: string, inferredUnit: ImportedSetDurationUnit | null = null) {
  const normalized = value.toLowerCase();
  const explicitMatch = normalized.match(
    /(\d+)\s*[xх×*]\s*(\d+(?:[.,]\d+)?)(?:\s*[-–—]\s*(\d+(?:[.,]\d+)?))?\s*(сек|s|sec|мин|m|min)(?=$|[\s/.,;:!?()-])/iu,
  );
  const inferredMatch = explicitMatch
    ? null
    : normalized.match(/(\d+)\s*[xх×*]\s*(\d+(?:[.,]\d+)?)/iu);

  if (!explicitMatch && (!inferredMatch || !inferredUnit)) {
    return null;
  }

  const match = explicitMatch ?? inferredMatch!;
  const sets = Number(match[1]);
  const durationValue = Number((explicitMatch?.[3] ?? match[2]).replace(",", "."));
  const durationUnit = explicitMatch?.[4]
    ? /^(?:сек|s|sec)$/iu.test(explicitMatch[4])
      ? "seconds"
      : "minutes"
    : inferredUnit;
  const durationMinutes = durationUnit === "seconds"
    ? durationValue / 60
    : durationValue;

  return {
    sets,
    totalDurationMinutes: roundImportedDurationMinutes(sets * durationMinutes),
  };
}

function extractImportedSetsReps(value: string) {
  const match = value.match(/(\d+)\s*[xх×*]\s*(\d+)/iu);

  if (!match) {
    return { sets: null, reps: null };
  }

  return {
    sets: Number(match[1]),
    reps: Number(match[2]),
  };
}

function extractImportedRpe(value: string) {
  const match = value.match(/rpe\s*(\d+(?:[.,]\d+)?)/iu);

  if (!match) {
    return null;
  }

  return Number(match[1].replace(",", "."));
}

function isGenericImportedExerciseGroup(name: string) {
  return /^(?:состав|внутри\b|повторы|комплекс)/iu.test(name.trim());
}

function splitImportedExerciseItems(value: string) {
  return value
    .split(/\s*(?:\/|\+|;)\s*/u)
    .map(normalizeImportedPlanText)
    .filter((item) => /[a-zа-яё]/iu.test(item));
}

function buildImportedExerciseItems(name: string, volume: string, control: string) {
  const details = [volume, control].filter(Boolean);

  if (!isGenericImportedExerciseGroup(name) || details.length === 0) {
    return [];
  }

  const candidates = details.flatMap(splitImportedExerciseItems);
  const uniqueItems = candidates.filter(
    (item, index) => candidates.findIndex((candidate) => candidate === item) === index,
  );

  return uniqueItems.length > 1 ? uniqueItems : [];
}

function inferImportedBlockType(value: string): PlanBlockType {
  const normalized = value.toLowerCase();

  if (/отдых|восстанов|прогул|дыхани|замин|recovery|z1/u.test(normalized)) {
    return "recovery";
  }

  if (/мобил|растяж|таз|плеч|спина/u.test(normalized)) {
    return "mobility";
  }

  if (/техник|вход|стойк|борьб|ситуац|схват/u.test(normalized)) {
    return "technical";
  }

  if (/присед|тяга|жим|подтяг|канат|полотен|фермер|сгибан|резина руками|сил/u.test(normalized)) {
    return "strength";
  }

  if (/ускор|прыж|спринт|скорост/u.test(normalized)) {
    return "speed";
  }

  if (/пано|180|185|188|190|пульс|повтор|круг|кросс|функцион/u.test(normalized)) {
    return "conditioning";
  }

  if (/активац|размин/u.test(normalized)) {
    return "activation";
  }

  return "metabolic";
}

function createImportedPlanBlock(
  name: string,
  volume: string,
  control: string,
  displayOrder: number,
): PlanTemplatePayload["blocks"][number] {
  const rawDetails = normalizeImportedPlanText(`${name} ${volume} ${control}`);
  const blockType = inferImportedBlockType(rawDetails);
  const detachedSetDurationUnit = inferDetachedImportedSetDurationUnit(volume, control);
  const normalizedVolume = normalizeImportedVolumeText(
    name,
    volume,
    control,
    blockType,
    detachedSetDurationUnit,
  );
  const normalizedControl = removeDetachedImportedSetDurationUnit(control, detachedSetDurationUnit);
  const notes = normalizeImportedPlanText([normalizedVolume, normalizedControl].filter(Boolean).join(" / "));
  const details = normalizeImportedPlanText(`${name} ${notes}`);
  const inferredSetDurationUnit = inferImportedSetDurationUnit(details, blockType);
  const setDuration = extractImportedSetDuration(details, inferredSetDurationUnit);
  const duration = setDuration?.totalDurationMinutes ?? extractImportedDurationMinutes(details);
  const rpe = extractImportedRpe(details);
  const { sets, reps } = extractImportedSetsReps(details);
  const isMandatory = blockType !== "recovery" && blockType !== "mobility";
  const exerciseItems = buildImportedExerciseItems(name, normalizedVolume, normalizedControl);
  const exercises = exerciseItems.length
    ? exerciseItems.map((item, exerciseIndex) => {
        const itemDuration = extractImportedDurationMinutes(item) ?? duration;
        const itemRpe = extractImportedRpe(item) ?? rpe;
        const itemSetDuration =
          extractImportedSetDuration(
            item,
            inferImportedSetDurationUnit(`${name} ${item} ${notes}`, blockType),
          ) ?? setDuration;
        const itemSetsReps = extractImportedSetsReps(item);

        return {
          name: item,
          targetSets: itemSetDuration?.sets ?? itemSetsReps.sets ?? setDuration?.sets ?? sets,
          targetReps: itemSetDuration ? null : itemSetsReps.reps ?? reps,
          targetWeightKg: null,
          targetDurationMinutes: itemSetDuration?.totalDurationMinutes ?? itemDuration,
          targetRpe: itemRpe,
          notes,
          displayOrder: displayOrder + exerciseIndex,
        };
      })
    : [
        {
          name: name || "Импортированное упражнение",
          targetSets: setDuration?.sets ?? sets,
          targetReps: setDuration ? null : reps,
          targetWeightKg: null,
          targetDurationMinutes: duration,
          targetRpe: rpe,
          notes,
          displayOrder,
        },
      ];

  return {
    name: name || "Импортированный блок",
    blockType,
    blockPriority: isMandatory ? 1 : 3,
    isMandatory,
    removePriorityYellow: isMandatory ? 5 : 2,
    removePriorityRed: isMandatory ? 4 : 1,
    reductionPercentYellow: isMandatory ? 30 : 50,
    reductionPercentRed: isMandatory ? 55 : 100,
    targetDurationMinutes: duration,
    targetRpe: rpe,
    targetSets: setDuration?.sets ?? sets,
    targetReps: setDuration ? null : reps,
    notes,
    exercises,
  };
}

function parseImportedPlanTableBlocks(table: HTMLTableElement, startOrderIndex: number) {
  const blocks: PlanTemplatePayload["blocks"] = [];
  const rows = Array.from(table.querySelectorAll("tr"));

  rows.forEach((row) => {
    if (row.querySelector("th") && !row.querySelector("td")) {
      return;
    }

    const cells = Array.from(row.querySelectorAll("td")).map((cell) =>
      normalizeImportedPlanText(cell.textContent ?? ""),
    );
    const [name, volume, ...controlCells] = cells;

    if (!name) {
      return;
    }

    blocks.push(
      createImportedPlanBlock(
        name,
        volume ?? "",
        controlCells.join(" / "),
        startOrderIndex + blocks.length,
      ),
    );
  });

  return blocks;
}

function parseImportedPlanHtml(
  html: string,
  sourceFileName: string,
  language: Language,
): ImportedPlanDraft {
  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");
  const title =
    normalizeImportedPlanText(document.querySelector("h1")?.textContent ?? "") ||
    stripFileExtension(sourceFileName);
  const description =
    normalizeImportedPlanText(document.querySelector(".subtitle")?.textContent ?? "") ||
    copyFor(language, {
      en: `Imported from ${sourceFileName}`,
      ru: `Импортировано из файла ${sourceFileName}`,
      bg: `Импортирано от файла ${sourceFileName}`,
    });
  const fallbackYear = parseImportedPlanYear(title, sourceFileName, description);
  const cards = Array.from(document.querySelectorAll<HTMLElement>(".card"));
  const firstParsedDate = cards
    .map((card) =>
      parseImportedPlanDate(
        normalizeImportedPlanText(card.querySelector(".head .title")?.textContent ?? ""),
        fallbackYear,
      ),
    )
    .find((date): date is string => Boolean(date));
  const days: ImportedPlanDayDraft[] = [];

  cards.forEach((card, cardIndex) => {
    const rawLabel =
      normalizeImportedPlanText(card.querySelector(".head .title")?.textContent ?? "") ||
      copyFor(language, {
        en: `Day ${cardIndex + 1}`,
        ru: `День ${cardIndex + 1}`,
        bg: `Ден ${cardIndex + 1}`,
      });
    const dayType = normalizeImportedPlanText(card.querySelector(".head .type")?.textContent ?? "");
    const dayDate = parseImportedPlanDate(rawLabel, fallbackYear);
    const sessions: PlanTemplateSessionInput[] = Array.from(card.querySelectorAll<HTMLElement>(".session"))
      .map((session, sessionIndex) => {
        const sessionName =
          normalizeImportedPlanText(session.querySelector(".stime")?.textContent ?? "") ||
          dayType ||
          copyFor(language, {
            en: `Session ${sessionIndex + 1}`,
            ru: `Сессия ${sessionIndex + 1}`,
            bg: `Сесия ${sessionIndex + 1}`,
          });
        const tableBlocks = Array.from(session.querySelectorAll<HTMLTableElement>("table")).flatMap(
          (table, tableIndex) => parseImportedPlanTableBlocks(table, tableIndex * 100),
        );
        const noteBlocks = Array.from(session.querySelectorAll(".note, .ok, .warn, .info"))
          .map((note) => normalizeImportedPlanText(note.textContent ?? ""))
          .filter(Boolean)
          .map((note, noteIndex) =>
            createImportedPlanBlock(
              copyFor(language, {
                en: "Coach note",
                ru: "Заметка тренера",
                bg: "Бележка на треньора",
              }),
              "",
              note,
              tableBlocks.length + noteIndex,
            ),
          );
        const blocks = [...tableBlocks, ...noteBlocks];

        return {
          name: sessionName,
          notes: dayType,
          orderIndex: sessionIndex,
          blocks,
        };
      })
      .filter((session) => session.blocks.length > 0);

    if (sessions.length === 0) {
      return;
    }

    const blocks = sessions.flatMap((session) => session.blocks);
    const dayOffset =
      firstParsedDate && dayDate ? diffDateInputDays(firstParsedDate, dayDate) : cardIndex;
    const normalizedDayOffset = dayOffset === null || dayOffset < 0 ? cardIndex : dayOffset;
    const templateName = dayType ? `${title} - ${rawLabel} (${dayType})` : `${title} - ${rawLabel}`;
    const template: PlanTemplatePayload = {
      name: templateName,
      description,
      sportType: copyFor(language, {
        en: "Wrestling",
        ru: "Борьба",
        bg: "Борба",
      }),
      phaseFocus: null,
      competitionPriorityFocus: null,
      templateGoal: dayType || title,
      microcycleType: "imported-plan",
      competitionSpecific: false,
      blocks,
      days: [
        {
          label: rawLabel,
          notes: dayType,
          orderIndex: 0,
          sessions,
        },
      ],
    };

    days.push({
      label: rawLabel,
      dayDate,
      dayOffset: normalizedDayOffset,
      templateDayIndex: days.length,
      template,
      blockCount: blocks.length,
    });
  });

  if (days.length === 0) {
    throw new Error(
      copyFor(language, {
        en: "No training days were found in this HTML file.",
        ru: "В HTML-файле не найдены тренировочные дни.",
        bg: "В HTML файла не са намерени тренировъчни дни.",
      }),
    );
  }

  const templateDays = days.map((day, dayIndex) => ({
    ...day.template.days![0],
    orderIndex: dayIndex,
  }));
  const templateBlocks = templateDays.flatMap((day) =>
    day.sessions.flatMap((session) => session.blocks),
  );
  const fullTemplate: PlanTemplatePayload = {
    name: title,
    description,
    sportType: copyFor(language, {
      en: "Wrestling",
      ru: "Борьба",
      bg: "Борба",
    }),
    phaseFocus: null,
    competitionPriorityFocus: null,
    templateGoal: title,
    microcycleType: "imported-plan",
    competitionSpecific: false,
    blocks: templateBlocks,
    days: templateDays,
  };

  return {
    sourceFileName,
    title,
    description,
    startDate: firstParsedDate ?? getDateInputValue(),
    template: fullTemplate,
    days,
  };
}

type BlockExercisePreset = Omit<PlanExerciseInput, "name" | "notes" | "id"> & {
  id: string;
  label: Record<Language, string>;
  notes: Record<Language, string>;
};

const BLOCK_EXERCISE_PRESETS: Record<PlanBlockType, BlockExercisePreset[]> = {
  technical: [
    {
      id: "stance_movement",
      label: { en: "Stance and movement", ru: "Стойка и передвижения", bg: "Стойка и движение" },
      targetSets: 4,
      targetReps: 3,
      targetWeightKg: null,
      targetDurationMinutes: 12,
      targetRpe: 4,
      displayOrder: 0,
      notes: {
        en: "Quality footwork, stance discipline, and mat position.",
        ru: "Качество передвижений, дисциплина стойки и контроль позиции на ковре.",
        bg: "Качествено движение, дисциплина в стойката и контрол на позицията.",
      },
    },
    {
      id: "leg_attack_entries",
      label: { en: "Leg attack entries", ru: "Проходы в ноги", bg: "Влизания в крака" },
      targetSets: 5,
      targetReps: 4,
      targetWeightKg: null,
      targetDurationMinutes: null,
      targetRpe: 5,
      displayOrder: 1,
      notes: {
        en: "Clean entry, head position, and finish mechanics.",
        ru: "Чистый вход, позиция головы и механика завершения атаки.",
        bg: "Чисто влизане, позиция на главата и механика на завършване.",
      },
    },
    {
      id: "shot_defense",
      label: { en: "Shot defense", ru: "Защита от прохода", bg: "Защита от влизане" },
      targetSets: 4,
      targetReps: 5,
      targetWeightKg: null,
      targetDurationMinutes: null,
      targetRpe: 5,
      displayOrder: 2,
      notes: {
        en: "Sprawl timing, hips heavy, and immediate counter control.",
        ru: "Тайминг спролла, тяжёлый таз и быстрый контроль после защиты.",
        bg: "Тайминг на спроул, тежък таз и бърз контрол след защита.",
      },
    },
    {
      id: "parterre_escape",
      label: { en: "Parterre escape", ru: "Выход из партера", bg: "Излизане от партер" },
      targetSets: 4,
      targetReps: 4,
      targetWeightKg: null,
      targetDurationMinutes: null,
      targetRpe: 5,
      displayOrder: 3,
      notes: {
        en: "First move speed, hip pressure, and hand control.",
        ru: "Скорость первого движения, давление тазом и контроль рук.",
        bg: "Скорост на първото движение, натиск с таза и контрол на ръцете.",
      },
    },
    {
      id: "hand_fighting",
      label: { en: "Hand fighting", ru: "Борьба за захват", bg: "Борба за захват" },
      targetSets: 5,
      targetReps: 3,
      targetWeightKg: null,
      targetDurationMinutes: 10,
      targetRpe: 6,
      displayOrder: 4,
      notes: {
        en: "Grip control, inside position, and pressure without rushing.",
        ru: "Контроль захвата, внутренняя позиция и давление без суеты.",
        bg: "Контрол на захвата, вътрешна позиция и натиск без бързане.",
      },
    },
  ],
  speed: [
    {
      id: "short_starts",
      label: { en: "5-10 m starts", ru: "Старты 5-10 м", bg: "Стартове 5-10 м" },
      targetSets: 6,
      targetReps: 2,
      targetWeightKg: null,
      targetDurationMinutes: null,
      targetRpe: 7,
      displayOrder: 0,
      notes: {
        en: "Explosive first step. Full recovery between reps.",
        ru: "Взрывной первый шаг. Полное восстановление между повторами.",
        bg: "Взривна първа крачка. Пълно възстановяване между повторенията.",
      },
    },
    {
      id: "reaction_signal",
      label: { en: "Reaction to signal", ru: "Реакция на сигнал", bg: "Реакция на сигнал" },
      targetSets: 5,
      targetReps: 4,
      targetWeightKg: null,
      targetDurationMinutes: null,
      targetRpe: 6,
      displayOrder: 1,
      notes: {
        en: "React to visual or audio cue, then enter cleanly.",
        ru: "Реакция на зрительный или звуковой сигнал с чистым входом.",
        bg: "Реакция на визуален или звуков сигнал с чисто влизане.",
      },
    },
    {
      id: "fast_attack_entry",
      label: { en: "Fast attack entry", ru: "Быстрый вход в атаку", bg: "Бързо влизане в атака" },
      targetSets: 5,
      targetReps: 3,
      targetWeightKg: null,
      targetDurationMinutes: null,
      targetRpe: 7,
      displayOrder: 2,
      notes: {
        en: "Speed first, finish only if mechanics stay clean.",
        ru: "Сначала скорость, завершение только при чистой механике.",
        bg: "Първо скорост, завършване само при чиста механика.",
      },
    },
    {
      id: "speed_footwork",
      label: { en: "Fast footwork", ru: "Скоростные передвижения", bg: "Бързо движение" },
      targetSets: 4,
      targetReps: 4,
      targetWeightKg: null,
      targetDurationMinutes: 8,
      targetRpe: 6,
      displayOrder: 3,
      notes: {
        en: "Short bursts with stance control and no technical collapse.",
        ru: "Короткие ускорения с контролем стойки без развала техники.",
        bg: "Кратки ускорения с контрол на стойката без срив на техниката.",
      },
    },
  ],
  strength: [
  {
    id: "back_squat",
    label: { en: "Back squat", ru: "Приседания со штангой", bg: "Клек с щанга" },
    targetSets: 4,
    targetReps: 5,
    targetWeightKg: null,
    targetDurationMinutes: null,
    targetRpe: 7.5,
    displayOrder: 0,
    notes: {
      en: "Primary lower-body strength. Keep technique strict.",
      ru: "Основная силовая работа для ног. Контроль техники обязателен.",
      bg: "Основна силова работа за краката. Техниката е задължителна.",
    },
  },
  {
    id: "trap_bar_deadlift",
    label: { en: "Trap bar deadlift", ru: "Тяга трэп-грифа", bg: "Тяга с трап бар" },
    targetSets: 4,
    targetReps: 4,
    targetWeightKg: null,
    targetDurationMinutes: null,
    targetRpe: 8,
    displayOrder: 1,
    notes: {
      en: "Hip extension and mat drive strength.",
      ru: "Разгибание таза и силовой толчок для работы в ковре.",
      bg: "Разгъване в таза и силов натиск за работа на тепиха.",
    },
  },
  {
    id: "weighted_pull_up",
    label: { en: "Weighted pull-up", ru: "Подтягивания с весом", bg: "Набирания с тежест" },
    targetSets: 4,
    targetReps: 5,
    targetWeightKg: null,
    targetDurationMinutes: null,
    targetRpe: 8,
    displayOrder: 2,
    notes: {
      en: "Grip, back, and pulling strength.",
      ru: "Хват, спина и силовая тяга.",
      bg: "Хват, гръб и силово дърпане.",
    },
  },
  {
    id: "bench_press",
    label: { en: "Bench press", ru: "Жим лёжа", bg: "Лег преса с щанга" },
    targetSets: 4,
    targetReps: 5,
    targetWeightKg: null,
    targetDurationMinutes: null,
    targetRpe: 7.5,
    displayOrder: 3,
    notes: {
      en: "Upper-body pressing strength without grinding reps.",
      ru: "Силовой жим без отказных повторов.",
      bg: "Силово избутване без отказни повторения.",
    },
  },
  {
    id: "barbell_row",
    label: { en: "Barbell row", ru: "Тяга штанги в наклоне", bg: "Гребане с щанга" },
    targetSets: 4,
    targetReps: 6,
    targetWeightKg: null,
    targetDurationMinutes: null,
    targetRpe: 7,
    displayOrder: 4,
    notes: {
      en: "Back strength for pulling and hand fighting.",
      ru: "Сила спины для тяг и борьбы за захват.",
      bg: "Сила на гърба за дърпане и борба за захват.",
    },
  },
  {
    id: "bulgarian_split_squat",
    label: {
      en: "Bulgarian split squat",
      ru: "Болгарские сплит-приседания",
      bg: "Български сплит клек",
    },
    targetSets: 3,
    targetReps: 6,
    targetWeightKg: null,
    targetDurationMinutes: null,
    targetRpe: 7,
    displayOrder: 5,
    notes: {
      en: "Single-leg strength and hip control.",
      ru: "Одноногая сила и контроль таза.",
      bg: "Едностранна сила и контрол в таза.",
    },
  },
  {
    id: "power_clean",
    label: { en: "Power clean", ru: "Взятие на грудь в стойку", bg: "Силово обръщане" },
    targetSets: 5,
    targetReps: 3,
    targetWeightKg: null,
    targetDurationMinutes: null,
    targetRpe: 7,
    displayOrder: 6,
    notes: {
      en: "Explosive strength. Stop before speed drops.",
      ru: "Взрывная сила. Остановить подход до падения скорости.",
      bg: "Взривна сила. Спира се преди спад на скоростта.",
    },
  },
  {
    id: "rope_climb",
    label: { en: "Rope climb", ru: "Лазание по канату", bg: "Катерене по въже" },
    targetSets: 4,
    targetReps: 2,
    targetWeightKg: null,
    targetDurationMinutes: null,
    targetRpe: 8,
    displayOrder: 7,
    notes: {
      en: "Grip endurance and pulling strength.",
      ru: "Силовая выносливость хвата и тяги.",
      bg: "Силова издръжливост на хвата и дърпането.",
    },
  },
  {
    id: "dummy_throws",
    label: { en: "Power dummy throws", ru: "Броски манекена на мощность", bg: "Хвърляния на манекен за мощност" },
    targetSets: 5,
    targetReps: 5,
    targetWeightKg: null,
    targetDurationMinutes: null,
    targetRpe: 8,
    displayOrder: 8,
    notes: {
      en: "Wrestling-specific power. Keep every throw explosive.",
      ru: "Специальная мощность для борьбы. Каждый бросок должен быть взрывным.",
      bg: "Специфична мощност за борба. Всяко хвърляне трябва да е взривно.",
    },
  },
  ],
  CNS_high: [
    {
      id: "explosive_dummy_throws",
      label: {
        en: "Explosive dummy throws",
        ru: "Взрывные броски манекена",
        bg: "Взривни хвърляния на манекен",
      },
      targetSets: 5,
      targetReps: 4,
      targetWeightKg: null,
      targetDurationMinutes: null,
      targetRpe: 8,
      displayOrder: 0,
      notes: {
        en: "High neural output. Stop if speed or coordination drops.",
        ru: "Высокая нервная нагрузка. Остановить при падении скорости или координации.",
        bg: "Високо нервно натоварване. Спрете при спад на скоростта или координацията.",
      },
    },
    {
      id: "power_clean_cns",
      label: { en: "Power clean", ru: "Взятие на грудь", bg: "Силово обръщане" },
      targetSets: 5,
      targetReps: 3,
      targetWeightKg: null,
      targetDurationMinutes: null,
      targetRpe: 7.5,
      displayOrder: 1,
      notes: {
        en: "Fast bar speed only. No grinding reps.",
        ru: "Только высокая скорость штанги. Без отказных повторов.",
        bg: "Само висока скорост на щангата. Без отказни повторения.",
      },
    },
    {
      id: "box_jumps",
      label: { en: "Box jumps", ru: "Прыжки на тумбу", bg: "Скокове на кутия" },
      targetSets: 5,
      targetReps: 3,
      targetWeightKg: null,
      targetDurationMinutes: null,
      targetRpe: 7,
      displayOrder: 2,
      notes: {
        en: "Explosive jump quality with full reset between reps.",
        ru: "Качественные взрывные прыжки с полным сбросом между повторами.",
        bg: "Качествени взривни скокове с пълен ресет между повторенията.",
      },
    },
    {
      id: "short_sprints",
      label: { en: "Short sprints", ru: "Короткие спринты", bg: "Кратки спринтове" },
      targetSets: 6,
      targetReps: 1,
      targetWeightKg: null,
      targetDurationMinutes: null,
      targetRpe: 8,
      displayOrder: 3,
      notes: {
        en: "Maximum acceleration, full recovery, low total volume.",
        ru: "Максимальное ускорение, полное восстановление, малый общий объём.",
        bg: "Максимално ускорение, пълно възстановяване, малък общ обем.",
      },
    },
  ],
  metabolic: [
    {
      id: "wrestling_intervals_30_30",
      label: { en: "Wrestling intervals 30/30", ru: "Интервалы борьбы 30/30", bg: "Борцови интервали 30/30" },
      targetSets: 2,
      targetReps: 6,
      targetWeightKg: null,
      targetDurationMinutes: 12,
      targetRpe: 8,
      displayOrder: 0,
      notes: {
        en: "Work/rest intervals with controlled technical quality.",
        ru: "Интервалы работа/отдых с контролем качества техники.",
        bg: "Интервали работа/почивка с контрол на техническото качество.",
      },
    },
    {
      id: "wrestling_circuit",
      label: { en: "Wrestling circuit", ru: "Круговая работа", bg: "Кръгова работа" },
      targetSets: 3,
      targetReps: 4,
      targetWeightKg: null,
      targetDurationMinutes: 18,
      targetRpe: 7.5,
      displayOrder: 1,
      notes: {
        en: "Rotate through wrestling-specific stations without technical collapse.",
        ru: "Переход по борцовским станциям без развала техники.",
        bg: "Ротация през борцови станции без срив на техниката.",
      },
    },
    {
      id: "grip_movement_combo",
      label: { en: "Grip + movement combo", ru: "Захваты + перемещения", bg: "Захват + движение" },
      targetSets: 4,
      targetReps: 3,
      targetWeightKg: null,
      targetDurationMinutes: 12,
      targetRpe: 7,
      displayOrder: 2,
      notes: {
        en: "Sustained hand fighting with stance movement.",
        ru: "Продолжительная борьба за захват с передвижением в стойке.",
        bg: "Продължителна борба за захват с движение в стойка.",
      },
    },
    {
      id: "match_simulation",
      label: { en: "Match simulation", ru: "Имитация схватки", bg: "Имитация на схватка" },
      targetSets: 3,
      targetReps: 1,
      targetWeightKg: null,
      targetDurationMinutes: 18,
      targetRpe: 8.5,
      displayOrder: 3,
      notes: {
        en: "Controlled match pace with coach-defined intensity.",
        ru: "Контролируемый темп схватки с заданной тренером интенсивностью.",
        bg: "Контролирано темпо на схватка с интензивност от треньора.",
      },
    },
  ],
  conditioning: [
    {
      id: "aerobic_work",
      label: { en: "Aerobic work", ru: "Аэробная работа", bg: "Аеробна работа" },
      targetSets: 1,
      targetReps: 1,
      targetWeightKg: null,
      targetDurationMinutes: 30,
      targetRpe: 5,
      displayOrder: 0,
      notes: {
        en: "Low-to-moderate intensity base work.",
        ru: "Базовая работа низкой или умеренной интенсивности.",
        bg: "Базова работа с ниска до умерена интензивност.",
      },
    },
    {
      id: "tempo_wrestling",
      label: { en: "Tempo wrestling", ru: "Темповая борьба", bg: "Темпова борба" },
      targetSets: 4,
      targetReps: 1,
      targetWeightKg: null,
      targetDurationMinutes: 20,
      targetRpe: 6,
      displayOrder: 1,
      notes: {
        en: "Sustainable pace, clean positions, no maximal exchanges.",
        ru: "Устойчивый темп, чистые позиции, без максимальных разменов.",
        bg: "Устойчиво темпо, чисти позиции, без максимални размени.",
      },
    },
    {
      id: "jump_rope",
      label: { en: "Jump rope", ru: "Скакалка", bg: "Скачане на въже" },
      targetSets: 5,
      targetReps: 1,
      targetWeightKg: null,
      targetDurationMinutes: 15,
      targetRpe: 5,
      displayOrder: 2,
      notes: {
        en: "Rhythm, ankle stiffness, and general conditioning.",
        ru: "Ритм, упругость стопы и общая кондиция.",
        bg: "Ритъм, стабилност на глезена и обща кондиция.",
      },
    },
    {
      id: "erg_work",
      label: { en: "Rowing / bike erg", ru: "Гребля / велотренажёр", bg: "Гребен / велоергометър" },
      targetSets: 1,
      targetReps: 1,
      targetWeightKg: null,
      targetDurationMinutes: 25,
      targetRpe: 5.5,
      displayOrder: 3,
      notes: {
        en: "Joint-friendly conditioning option.",
        ru: "Кондиционная работа с низкой ударной нагрузкой.",
        bg: "Кондиционна работа с ниско ударно натоварване.",
      },
    },
  ],
  recovery: [
    {
      id: "light_mobilization",
      label: { en: "Light mobilization", ru: "Лёгкая мобилизация", bg: "Лека мобилизация" },
      targetSets: 1,
      targetReps: 1,
      targetWeightKg: null,
      targetDurationMinutes: 15,
      targetRpe: 2,
      displayOrder: 0,
      notes: {
        en: "Easy movement to restore range without fatigue.",
        ru: "Лёгкое движение для восстановления амплитуды без усталости.",
        bg: "Леко движение за възстановяване на амплитудата без умора.",
      },
    },
    {
      id: "breathing_reset",
      label: { en: "Breathing reset", ru: "Дыхание", bg: "Дишане" },
      targetSets: 1,
      targetReps: 1,
      targetWeightKg: null,
      targetDurationMinutes: 8,
      targetRpe: 1.5,
      displayOrder: 1,
      notes: {
        en: "Down-regulation and recovery focus.",
        ru: "Снижение возбуждения и фокус на восстановлении.",
        bg: "Намаляване на възбудата и фокус върху възстановяване.",
      },
    },
    {
      id: "easy_technical_drills",
      label: { en: "Easy technical drills", ru: "Лёгкая техника", bg: "Лека техника" },
      targetSets: 3,
      targetReps: 4,
      targetWeightKg: null,
      targetDurationMinutes: 12,
      targetRpe: 3,
      displayOrder: 2,
      notes: {
        en: "Technical patterning only, no pressure exchanges.",
        ru: "Только технический рисунок, без силовых разменов.",
        bg: "Само технически модел, без силови размени.",
      },
    },
    {
      id: "soft_stretching",
      label: { en: "Soft stretching", ru: "Мягкая растяжка", bg: "Меко разтягане" },
      targetSets: 1,
      targetReps: 1,
      targetWeightKg: null,
      targetDurationMinutes: 10,
      targetRpe: 2,
      displayOrder: 3,
      notes: {
        en: "Relaxed positions, no aggressive end-range forcing.",
        ru: "Расслабленные позиции без агрессивного продавливания амплитуды.",
        bg: "Отпуснати позиции без агресивно натискане в крайна амплитуда.",
      },
    },
  ],
  mobility: [
    {
      id: "hip_mobility",
      label: { en: "Hip mobility", ru: "Таз / бедро", bg: "Таз / бедро" },
      targetSets: 2,
      targetReps: 6,
      targetWeightKg: null,
      targetDurationMinutes: 10,
      targetRpe: 3,
      displayOrder: 0,
      notes: {
        en: "Hip rotation and split-position control.",
        ru: "Ротация таза и контроль позиций в выпаде.",
        bg: "Ротация в таза и контрол на позиции в напад.",
      },
    },
    {
      id: "shoulder_scapula_mobility",
      label: { en: "Shoulders / scapula", ru: "Плечи / лопатки", bg: "Рамене / лопатки" },
      targetSets: 2,
      targetReps: 8,
      targetWeightKg: null,
      targetDurationMinutes: 8,
      targetRpe: 3,
      displayOrder: 1,
      notes: {
        en: "Shoulder control for posting, pulling, and mat pressure.",
        ru: "Контроль плеча для упора, тяги и давления в ковре.",
        bg: "Контрол на рамото за опора, дърпане и натиск.",
      },
    },
    {
      id: "thoracic_mobility",
      label: { en: "Thoracic spine", ru: "Грудной отдел", bg: "Гръден отдел" },
      targetSets: 2,
      targetReps: 6,
      targetWeightKg: null,
      targetDurationMinutes: 8,
      targetRpe: 2.5,
      displayOrder: 2,
      notes: {
        en: "Rotation and extension for cleaner positions.",
        ru: "Ротация и разгибание для более чистых позиций.",
        bg: "Ротация и разгъване за по-чисти позиции.",
      },
    },
    {
      id: "ankle_mobility",
      label: { en: "Ankle mobility", ru: "Голеностоп", bg: "Глезен" },
      targetSets: 2,
      targetReps: 8,
      targetWeightKg: null,
      targetDurationMinutes: 8,
      targetRpe: 2.5,
      displayOrder: 3,
      notes: {
        en: "Dorsiflexion and stance depth control.",
        ru: "Тыльное сгибание и контроль глубины стойки.",
        bg: "Дорзифлексия и контрол на дълбочината в стойка.",
      },
    },
  ],
  activation: [
    {
      id: "band_activation",
      label: { en: "Band activation", ru: "Резина", bg: "Ластик" },
      targetSets: 2,
      targetReps: 10,
      targetWeightKg: null,
      targetDurationMinutes: 8,
      targetRpe: 3,
      displayOrder: 0,
      notes: {
        en: "Prime hips, shoulders, and trunk before mat work.",
        ru: "Подготовить таз, плечи и корпус перед работой на ковре.",
        bg: "Подготовка на таза, раменете и корпуса преди работа.",
      },
    },
    {
      id: "light_shots",
      label: { en: "Light shots", ru: "Лёгкие проходы", bg: "Леки влизания" },
      targetSets: 3,
      targetReps: 4,
      targetWeightKg: null,
      targetDurationMinutes: null,
      targetRpe: 4,
      displayOrder: 1,
      notes: {
        en: "Smooth entries without fatigue.",
        ru: "Плавные входы без накопления усталости.",
        bg: "Плавни влизания без натрупване на умора.",
      },
    },
    {
      id: "start_accelerations",
      label: { en: "Start accelerations", ru: "Стартовые ускорения", bg: "Стартови ускорения" },
      targetSets: 4,
      targetReps: 2,
      targetWeightKg: null,
      targetDurationMinutes: null,
      targetRpe: 5,
      displayOrder: 2,
      notes: {
        en: "Short activation sprints, stop well before fatigue.",
        ru: "Короткие активационные ускорения, остановка до усталости.",
        bg: "Кратки активационни ускорения, спиране преди умора.",
      },
    },
    {
      id: "coordination_entries",
      label: { en: "Coordination entries", ru: "Координационные входы", bg: "Координационни влизания" },
      targetSets: 3,
      targetReps: 4,
      targetWeightKg: null,
      targetDurationMinutes: null,
      targetRpe: 4,
      displayOrder: 3,
      notes: {
        en: "Timing and coordination before heavier work.",
        ru: "Тайминг и координация перед более тяжёлой работой.",
        bg: "Тайминг и координация преди по-тежка работа.",
      },
    },
  ],
};

const TEMPLATE_MICROCYCLE_TYPES = [
  "load",
  "support",
  "specific",
  "activation",
  "recovery",
  "build",
  "impact",
  "shock",
  "taper",
  "competition",
] as const;

const MICROCYCLE_TYPE_LABELS: Record<string, Record<Language, string>> = {
  load: { en: "Load", ru: "Нагрузочный", bg: "Натоварващ" },
  support: { en: "Support", ru: "Поддерживающий", bg: "Поддържащ" },
  specific: { en: "Specific", ru: "Специальный", bg: "Специфичен" },
  activation: { en: "Activation", ru: "Активационный", bg: "Активационен" },
  recovery: { en: "Recovery", ru: "Восстановительный", bg: "Възстановителен" },
  build: { en: "Build", ru: "Накопительный", bg: "Изграждащ" },
  impact: { en: "Impact", ru: "Ударный", bg: "Ударен" },
  shock: { en: "Shock", ru: "Шоковый", bg: "Шоков" },
  taper: { en: "Taper", ru: "Подводящий", bg: "Тейпър" },
  competition: { en: "Competition", ru: "Соревновательный", bg: "Състезателен" },
};

const PROGRESSION_TYPE_LABELS: Record<string, Record<Language, string>> = {
  linear: { en: "Linear", ru: "Линейная", bg: "Линейна" },
  wave: { en: "Wave", ru: "Волновая", bg: "Вълнова" },
  taper: { en: "Taper", ru: "Подводящая", bg: "Тейпър" },
  recovery: { en: "Recovery", ru: "Восстановительная", bg: "Възстановителна" },
};

const KNOWN_TEMPLATE_TEXT_LABELS: Record<string, Record<Language, string>> = {
  "Weekly speed-strength day": {
    en: "Weekly speed-strength day",
    ru: "Недельный скоростно-силовой день",
    bg: "Седмичен скоростно-силов ден",
  },
  "Coach-authored template for a single key training day.": {
    en: "Coach-authored template for a single key training day.",
    ru: "Тренерский шаблон для одного ключевого тренировочного дня.",
    bg: "Треньорски шаблон за един ключов тренировъчен ден.",
  },
  "Baseline template for a primary speed-strength loading day.": {
    en: "Baseline template for a primary speed-strength loading day.",
    ru: "Базовый шаблон основного скоростно-силового нагрузочного дня.",
    bg: "Базов шаблон за основен скоростно-силов натоварващ ден.",
  },
  "Track and field": {
    en: "Track and field",
    ru: "Лёгкая атлетика",
    bg: "Лека атлетика",
  },
  "Primary speed-strength loading day": {
    en: "Primary speed-strength loading day",
    ru: "Основной скоростно-силовой нагрузочный день",
    bg: "Основен скоростно-силов натоварващ ден",
  },
  "Sprint mechanics": {
    en: "Sprint mechanics",
    ru: "Спринтерская механика",
    bg: "Спринтова механика",
  },
  "Drills and coordination work stay in all statuses.": {
    en: "Drills and coordination work stay in all statuses.",
    ru: "Дриллы и координационная работа сохраняются при любом статусе.",
    bg: "Дриловете и координационната работа остават при всички статуси.",
  },
  "Drills and coordination stay in all statuses.": {
    en: "Drills and coordination stay in all statuses.",
    ru: "Дриллы и координация сохраняются при любом статусе.",
    bg: "Дриловете и координацията остават при всички статуси.",
  },
  "Main acceleration set": {
    en: "Main acceleration set",
    ru: "Основной блок ускорений",
    bg: "Основен блок ускорения",
  },
  "Reduce total sprint volume on yellow or red days.": {
    en: "Reduce total sprint volume on yellow or red days.",
    ru: "Снижайте общий объём спринта в жёлтые и красные дни.",
    bg: "Намалете общия спринтов обем в жълти и червени дни.",
  },
  "Reduce sprint volume when readiness drops.": {
    en: "Reduce sprint volume when readiness drops.",
    ru: "Снижайте объём спринта при падении готовности.",
    bg: "Намалете спринтовия обем при спад на готовността.",
  },
  "Gym strength block": {
    en: "Gym strength block",
    ru: "Силовой блок в зале",
    bg: "Силов блок в залата",
  },
  "Secondary block that can be cut first when readiness drops.": {
    en: "Secondary block that can be cut first when readiness drops.",
    ru: "Второстепенный блок, который можно убрать первым при падении готовности.",
    bg: "Второстепенен блок, който може да се премахне първи при спад на готовността.",
  },
  "Secondary strength work that can be removed first.": {
    en: "Secondary strength work that can be removed first.",
    ru: "Второстепенная силовая работа, которую можно убрать первой.",
    bg: "Второстепенна силова работа, която може да се премахне първа.",
  },
  "Base aerobic support day": {
    en: "Base aerobic support day",
    ru: "Базовый день аэробной поддержки",
    bg: "Базов ден за аеробна подкрепа",
  },
  "Lower-intensity base phase day for aerobic support and movement quality.": {
    en: "Lower-intensity base phase day for aerobic support and movement quality.",
    ru: "День базовой фазы с низкой интенсивностью для аэробной поддержки и качества движения.",
    bg: "Ден от базовата фаза с по-ниска интензивност за аеробна подкрепа и качество на движението.",
  },
  "Aerobic support and movement base": {
    en: "Aerobic support and movement base",
    ru: "Аэробная поддержка и двигательная база",
    bg: "Аеробна подкрепа и двигателна база",
  },
  "Movement prep": {
    en: "Movement prep",
    ru: "Подготовка движения",
    bg: "Подготовка на движението",
  },
  "Open the session with low-load mobility.": {
    en: "Open the session with low-load mobility.",
    ru: "Начните с низконагрузочной мобильности.",
    bg: "Започнете с нискоинтензивна мобилност.",
  },
  "Extensive tempo run": {
    en: "Extensive tempo run",
    ru: "Объёмный темповый бег",
    bg: "Обемен темпов бег",
  },
  "Base phase aerobic support.": {
    en: "Base phase aerobic support.",
    ru: "Аэробная поддержка базовой фазы.",
    bg: "Аеробна подкрепа за базовата фаза.",
  },
  "Recovery circuit": {
    en: "Recovery circuit",
    ru: "Восстановительный круг",
    bg: "Възстановителен кръг",
  },
  "Finish with light circuit and breathing.": {
    en: "Finish with light circuit and breathing.",
    ru: "Завершите лёгким кругом и дыханием.",
    bg: "Завършете с лек кръг и дишане.",
  },
  "Specific speed-technical day": {
    en: "Specific speed-technical day",
    ru: "Специальный скоростно-технический день",
    bg: "Специфичен скоростно-технически ден",
  },
  "Specific phase day focused on event rhythm and quality speed exposure.": {
    en: "Specific phase day focused on event rhythm and quality speed exposure.",
    ru: "День специальной фазы с фокусом на ритм дисциплины и качественную скорость.",
    bg: "Ден от специфичната фаза с фокус върху състезателния ритъм и качествената скорост.",
  },
  "Specific speed and technical sharpness": {
    en: "Specific speed and technical sharpness",
    ru: "Специальная скорость и техническая острота",
    bg: "Специфична скорост и техническа острота",
  },
  "Event rhythm drills": {
    en: "Event rhythm drills",
    ru: "Дриллы ритма дисциплины",
    bg: "Дрилове за ритъм на дисциплината",
  },
  "Technical quality is protected close to competition.": {
    en: "Technical quality is protected close to competition.",
    ru: "Техническое качество сохраняется ближе к старту.",
    bg: "Техническото качество се пази близо до състезанието.",
  },
  "Specific speed reps": {
    en: "Specific speed reps",
    ru: "Специальные скоростные повторы",
    bg: "Специфични скоростни повторения",
  },
  "Keep quality, reduce total volume when needed.": {
    en: "Keep quality, reduce total volume when needed.",
    ru: "Сохраняйте качество и при необходимости снижайте общий объём.",
    bg: "Запазете качеството и намалете общия обем при нужда.",
  },
  "Activation lifts": {
    en: "Activation lifts",
    ru: "Активационные подъёмы",
    bg: "Активационни вдигания",
  },
  "Short neural activation without excessive fatigue.": {
    en: "Short neural activation without excessive fatigue.",
    ru: "Короткая нейроактивация без лишней усталости.",
    bg: "Кратка невроактивация без излишна умора.",
  },
  "Taper activation": {
    en: "Taper activation",
    ru: "Подводящая активация",
    bg: "Тейпър активация",
  },
  "Sharpness session with low fatigue and speed retention.": {
    en: "Sharpness session with low fatigue and speed retention.",
    ru: "Сессия на остроту с низкой усталостью и сохранением скорости.",
    bg: "Сесия за острота с ниска умора и запазване на скоростта.",
  },
  "Specific power build": {
    en: "Specific power build",
    ru: "Специальное развитие мощности",
    bg: "Специфично развитие на мощността",
  },
  "Specific intensity with disciplined volume control.": {
    en: "Specific intensity with disciplined volume control.",
    ru: "Специальная интенсивность с контролем объёма.",
    bg: "Специфична интензивност с дисциплиниран контрол на обема.",
  },
  "Recovery reset": {
    en: "Recovery reset",
    ru: "Восстановительный сброс",
    bg: "Възстановителен ресет",
  },
  "Low-load reset day with mobility and aerobic flush.": {
    en: "Low-load reset day with mobility and aerobic flush.",
    ru: "Низконагрузочный день сброса с мобильностью и лёгкой аэробной разгрузкой.",
    bg: "Нисконатоварващ ден за ресет с мобилност и аеробно раздвижване.",
  },
  "speed retention": {
    en: "speed retention",
    ru: "сохранение скорости",
    bg: "запазване на скоростта",
  },
  "specific power": {
    en: "specific power",
    ru: "специальная мощность",
    bg: "специфична мощност",
  },
  "recovery": {
    en: "recovery",
    ru: "восстановление",
    bg: "възстановяване",
  },
  "Explosive entry": {
    en: "Explosive entry",
    ru: "Взрывной вход",
    bg: "Експлозивно влизане",
  },
  "Specific patterns": {
    en: "Specific patterns",
    ru: "Специальные паттерны",
    bg: "Специфични модели",
  },
  "Mobility flush": {
    en: "Mobility flush",
    ru: "Мобильность и разгрузка",
    bg: "Мобилност и раздвижване",
  },
  "Primary session": {
    en: "Primary session",
    ru: "Основная сессия",
    bg: "Основна сесия",
  },
  "Final taper activation before weigh-in.": {
    en: "Final taper activation before weigh-in.",
    ru: "Финальная активация подводки перед взвешиванием.",
    bg: "Финална тейпър активация преди кантара.",
  },
  "Taper activation day": {
    en: "Taper activation day",
    ru: "Активационный день подводки",
    bg: "Активационен ден в тейпър",
  },
  "Taper phase session to maintain sharpness with minimal fatigue.": {
    en: "Taper phase session to maintain sharpness with minimal fatigue.",
    ru: "Сессия подводки для сохранения остроты при минимальной усталости.",
    bg: "Сесия в тейпър за запазване на острота с минимална умора.",
  },
  "Maintain readiness and activation": {
    en: "Maintain readiness and activation",
    ru: "Сохранить готовность и активацию",
    bg: "Поддържане на готовност и активация",
  },
  "Warm-up mobility": {
    en: "Warm-up mobility",
    ru: "Разминочная мобильность",
    bg: "Загряваща мобилност",
  },
  "Easy mobility and breathing.": {
    en: "Easy mobility and breathing.",
    ru: "Лёгкая мобильность и дыхание.",
    bg: "Лека мобилност и дишане.",
  },
  "Starts and reactions": {
    en: "Starts and reactions",
    ru: "Старты и реакции",
    bg: "Стартове и реакции",
  },
  "Short high-quality activation work.": {
    en: "Short high-quality activation work.",
    ru: "Короткая качественная активационная работа.",
    bg: "Кратка качествена активационна работа.",
  },
  "Technical rehearsal": {
    en: "Technical rehearsal",
    ru: "Техническая репетиция",
    bg: "Техническа репетиция",
  },
  "Keep timing and event feel.": {
    en: "Keep timing and event feel.",
    ru: "Сохраняйте тайминг и ощущение дисциплины.",
    bg: "Запазете тайминга и усещането за дисциплината.",
  },
  "Recovery regeneration day": {
    en: "Recovery regeneration day",
    ru: "День восстановления и регенерации",
    bg: "Ден за възстановяване и регенерация",
  },
  "Recovery phase day with regeneration, mobility, and low-stress restoration.": {
    en: "Recovery phase day with regeneration, mobility, and low-stress restoration.",
    ru: "День восстановительной фазы с регенерацией, мобильностью и низким стрессом.",
    bg: "Ден от възстановителната фаза с регенерация, мобилност и нисък стрес.",
  },
  "Restore freshness and mobility": {
    en: "Restore freshness and mobility",
    ru: "Восстановить свежесть и мобильность",
    bg: "Възстановяване на свежестта и мобилността",
  },
  "Breathing reset": {
    en: "Breathing reset",
    ru: "Дыхательный сброс",
    bg: "Дихателен ресет",
  },
  "Reset and down-regulate.": {
    en: "Reset and down-regulate.",
    ru: "Сбросить напряжение и снизить возбуждение.",
    bg: "Ресет и намаляване на възбудата.",
  },
  "Mobility flow": {
    en: "Mobility flow",
    ru: "Мобильность в потоке",
    bg: "Мобилност в движение",
  },
  "Low-load full-body mobility.": {
    en: "Low-load full-body mobility.",
    ru: "Низконагрузочная мобильность всего тела.",
    bg: "Нискоинтензивна мобилност за цяло тяло.",
  },
  "Easy activation": {
    en: "Easy activation",
    ru: "Лёгкая активация",
    bg: "Лека активация",
  },
  "Optional light activation if athlete feels flat.": {
    en: "Optional light activation if athlete feels flat.",
    ru: "Опциональная лёгкая активация, если спортсмен выглядит вялым.",
    bg: "Опционална лека активация, ако спортистът изглежда отпуснат.",
  },
};

function localizedOptionLabel(
  value: string | null | undefined,
  language: Language,
  labels: Record<string, Record<Language, string>>,
) {
  if (!value) {
    return copyFor(language, { en: "General", ru: "Общий", bg: "Общ" });
  }

  return labels[value]?.[language] ?? value;
}

function translateKnownTemplateText(value: string | null | undefined, language: Language) {
  if (!value) {
    return "";
  }

  const exact = KNOWN_TEMPLATE_TEXT_LABELS[value];
  if (exact) {
    return exact[language];
  }

  const source = Object.entries(KNOWN_TEMPLATE_TEXT_LABELS).find(([, translations]) =>
    Object.values(translations).includes(value),
  );

  return source ? source[1][language] : value;
}

const KNOWN_MESOCYCLE_TEXT_LABELS: Record<string, Record<Language, string>> = {
  "Specific-to-taper block": {
    en: "Specific-to-taper block",
    ru: "Специально-подводящий блок",
    bg: "Блок от специфична подготовка към тейпър",
  },
  "Preserve sharpness and reduce residual fatigue.": {
    en: "Preserve sharpness and reduce residual fatigue.",
    ru: "Сохранить скорость и снизить остаточную усталость.",
    bg: "Запазване на остротата и намаляване на остатъчната умора.",
  },
  "Convert specific load into fresh competition rhythm.": {
    en: "Convert specific load into fresh competition rhythm.",
    ru: "Перевести специальную нагрузку в свежий соревновательный ритм.",
    bg: "Превеждане на специфичното натоварване в свеж състезателен ритъм.",
  },
  "Protect freshness, preserve specificity, and reduce fatigue.": {
    en: "Protect freshness, preserve specificity, and reduce fatigue.",
    ru: "Сохранить свежесть, специальную готовность и снизить усталость.",
    bg: "Запазване на свежестта, специфичната готовност и намаляване на умората.",
  },
  "Restore readiness and tissue quality before the next build.": {
    en: "Restore readiness and tissue quality before the next build.",
    ru: "Восстановить готовность перед следующим нагрузочным блоком.",
    bg: "Възстановяване на готовността преди следващия натоварващ блок.",
  },
  "Convert general capacity into competition-specific quality.": {
    en: "Convert general capacity into competition-specific quality.",
    ru: "Перевести общую работоспособность в соревновательное качество.",
    bg: "Превръщане на общия капацитет в специфично състезателно качество.",
  },
  "Build force output while keeping sport-specific rhythm.": {
    en: "Build force output while keeping sport-specific rhythm.",
    ru: "Развить силовую отдачу без потери специального ритма.",
    bg: "Развитие на силовата отдача при запазване на специфичния ритъм.",
  },
  "Establish aerobic, technical, and structural base.": {
    en: "Establish aerobic, technical, and structural base.",
    ru: "Заложить аэробную, техническую и структурную базу.",
    bg: "Изграждане на аеробна, техническа и структурна база.",
  },
};

function localizedWeekLabel(label: string, language: Language) {
  const match = /^Week\s+(\d+)$/i.exec(label.trim());

  if (!match) {
    return label;
  }

  return copyFor(language, {
    en: `Week ${match[1]}`,
    ru: `Неделя ${match[1]}`,
    bg: `Седмица ${match[1]}`,
  });
}

function localizedPlannerDayLabel(label: string | null | undefined, language: Language) {
  if (!label) {
    return "";
  }

  const trimmed = label.trim();
  const dayMatch = /^Day\s+(\d+)$/i.exec(trimmed);
  if (dayMatch) {
    return copyFor(language, {
      en: `Day ${dayMatch[1]}`,
      ru: `День ${dayMatch[1]}`,
      bg: `Ден ${dayMatch[1]}`,
    });
  }

  const weekMatch = /^Week\s+\d+$/i.exec(trimmed);
  if (weekMatch) {
    return localizedWeekLabel(trimmed, language);
  }

  return translateKnownTemplateText(label, language);
}

function localizedPlannerDayFromOffset(dayOffset: number | null, language: Language) {
  return dayOffset === null
    ? copyFor(language, { en: "the selected day", ru: "выбранный день", bg: "избрания ден" })
    : localizedPlannerDayLabel(`Day ${dayOffset + 1}`, language);
}

function localizedPlannerWarningLevel(level: PlannerWarning["level"], language: Language) {
  if (level === "critical") {
    return copyFor(language, { en: "Critical", ru: "Критично", bg: "Критично" });
  }

  if (level === "warning") {
    return copyFor(language, {
      en: "Warning",
      ru: "Предупреждение",
      bg: "Предупреждение",
    });
  }

  return copyFor(language, { en: "Info", ru: "Информация", bg: "Информация" });
}

function localizedPlannerLoadBalanceLabel(label: string | null | undefined, language: Language) {
  if (!label) {
    return "";
  }

  const normalized = label.trim().toLowerCase().replace(/[\s_]+/g, "-");

  if (normalized === "single-day") {
    return copyFor(language, { en: "single-day", ru: "один день", bg: "един ден" });
  }

  if (normalized === "volatile") {
    return copyFor(language, { en: "volatile", ru: "скачкообразный", bg: "нестабилен" });
  }

  if (normalized === "balanced-taper") {
    return copyFor(language, {
      en: "balanced taper",
      ru: "сбалансированная подводка",
      bg: "балансиран тейпър",
    });
  }

  if (normalized === "balanced") {
    return copyFor(language, { en: "balanced", ru: "сбалансированный", bg: "балансиран" });
  }

  return label;
}

function localizedPlannerScopeLabel(
  scope: NonNullable<PlannerSuggestion["feedback"]>["scope"],
  language: Language,
) {
  if (scope === "exact_context") {
    return copyFor(language, {
      en: "same phase and priority",
      ru: "та же фаза и приоритет",
      bg: "същата фаза и приоритет",
    });
  }

  if (scope === "phase_context") {
    return copyFor(language, {
      en: "same phase",
      ru: "та же фаза",
      bg: "същата фаза",
    });
  }

  return copyFor(language, {
    en: "athlete history",
    ru: "история спортсмена",
    bg: "история на спортиста",
  });
}

function localizedPlannerHistoryReasonDescription(description: string, language: Language) {
  const labels: Record<string, Record<Language, string>> = {
    "recovery-style template replacements": {
      en: "recovery-style template replacements",
      ru: "замены на восстановительные шаблоны",
      bg: "замени с възстановителни шаблони",
    },
    "supportive low-load templates": {
      en: "supportive low-load templates",
      ru: "поддерживающие низконагрузочные шаблоны",
      bg: "поддържащи нисконатоварващи шаблони",
    },
    "activation-style template replacements": {
      en: "activation-style template replacements",
      ru: "замены на активационные шаблоны",
      bg: "замени с активационни шаблони",
    },
    "lighter substitutions for heavy slots": {
      en: "lighter substitutions for heavy slots",
      ru: "более лёгкие замены для тяжёлых слотов",
      bg: "по-леки замени за тежки слотове",
    },
    "higher-load substitutions for underloaded slots": {
      en: "higher-load substitutions for underloaded slots",
      ru: "более нагрузочные замены для недогруженных слотов",
      bg: "по-натоварени замени за недостатъчно натоварени слотове",
    },
    "protecting this slot from overload": {
      en: "protecting this slot from overload",
      ru: "защита слота от перегрузки",
      bg: "защита на слота от претоварване",
    },
    "filling underloaded load/specific slots": {
      en: "filling underloaded load/specific slots",
      ru: "добавление нагрузки в недогруженные нагрузочные/специальные слоты",
      bg: "добавяне на натоварване в недонатоварени натоварващи/специфични слотове",
    },
  };

  return labels[description]?.[language] ?? description;
}

function localizedPlannerReasonFragment(fragment: string, language: Language) {
  const trimmed = fragment.trim();
  const exact: Record<string, Record<Language, string>> = {
    "competition-specific template": {
      en: "competition-specific template",
      ru: "соревновательно-специфичный шаблон",
      bg: "състезателно-специфичен шаблон",
    },
    "general template fit": {
      en: "general template fit",
      ru: "общее соответствие шаблона",
      bg: "общо съответствие на шаблона",
    },
    "back-to-back repeat penalty": {
      en: "back-to-back repeat penalty",
      ru: "штраф за повтор подряд",
      bg: "санкция за последователно повторение",
    },
    "hard load jump penalty": {
      en: "hard load jump penalty",
      ru: "штраф за резкий скачок нагрузки",
      bg: "санкция за рязък скок на натоварването",
    },
    "load jump penalty": {
      en: "load jump penalty",
      ru: "штраф за скачок нагрузки",
      bg: "санкция за скок на натоварването",
    },
    "soft load jump penalty": {
      en: "soft load jump penalty",
      ru: "штраф за умеренный скачок нагрузки",
      bg: "санкция за умерен скок на натоварването",
    },
    "balanced load transition": {
      en: "balanced load transition",
      ru: "ровный переход нагрузки",
      bg: "балансиран преход на натоварването",
    },
    "calendar-adjacent load jump": {
      en: "calendar-adjacent load jump",
      ru: "скачок нагрузки рядом в календаре",
      bg: "скок на натоварването в близки календарни дни",
    },
    "calendar proximity penalty": {
      en: "calendar proximity penalty",
      ru: "штраф за близость в календаре",
      bg: "санкция за близост в календара",
    },
    "existing assignment on same date": {
      en: "existing assignment on same date",
      ru: "уже есть назначение на эту дату",
      bg: "вече има назначение за тази дата",
    },
    "recovery/taper load protected": {
      en: "recovery/taper load protected",
      ru: "нагрузка восстановления/подводки защищена",
      bg: "натоварването за възстановяване/тейпър е защитено",
    },
    "impact week load supported": {
      en: "impact week load supported",
      ru: "нагрузка ударной недели поддержана",
      bg: "натоварването на ударната седмица е подкрепено",
    },
    "slot load close to mesocycle target": {
      en: "slot load close to mesocycle target",
      ru: "нагрузка слота близка к цели мезоцикла",
      bg: "натоварването на слота е близо до целта на мезоцикъла",
    },
    "slot load within mesocycle range": {
      en: "slot load within mesocycle range",
      ru: "нагрузка слота в диапазоне мезоцикла",
      bg: "натоварването на слота е в диапазона на мезоцикъла",
    },
    "far from mesocycle target load": {
      en: "far from mesocycle target load",
      ru: "далеко от целевой нагрузки мезоцикла",
      bg: "далеч от целевото натоварване на мезоцикъла",
    },
    "off mesocycle target load": {
      en: "off mesocycle target load",
      ru: "вне целевой нагрузки мезоцикла",
      bg: "извън целевото натоварване на мезоцикъла",
    },
    "manual suggestion applied": {
      en: "manual suggestion applied",
      ru: "совет применён вручную",
      bg: "предложението е приложено ръчно",
    },
  };

  if (exact[trimmed]) {
    return exact[trimmed][language];
  }

  const phaseMatch = /^phase match: (.+)$/i.exec(trimmed);
  if (phaseMatch) {
    return copyFor(language, {
      en: `phase match: ${localizedOptionLabel(
        phaseMatch[1],
        language,
        PREPARATION_PHASE_LABELS,
      )}`,
      ru: `совпадение фазы: ${localizedOptionLabel(
        phaseMatch[1],
        language,
        PREPARATION_PHASE_LABELS,
      )}`,
      bg: `съвпадение на фазата: ${localizedOptionLabel(
        phaseMatch[1],
        language,
        PREPARATION_PHASE_LABELS,
      )}`,
    });
  }

  const priorityMatch = /^priority match: (.+)$/i.exec(trimmed);
  if (priorityMatch) {
    return copyFor(language, {
      en: `priority match: ${priorityMatch[1]}`,
      ru: `совпадение приоритета: ${priorityMatch[1]}`,
      bg: `съвпадение на приоритета: ${priorityMatch[1]}`,
    });
  }

  const microcycleMatch = /^microcycle match: (.+)$/i.exec(trimmed);
  if (microcycleMatch) {
    return copyFor(language, {
      en: `microcycle match: ${localizedOptionLabel(
        microcycleMatch[1],
        language,
        MICROCYCLE_TYPE_LABELS,
      )}`,
      ru: `совпадение микроцикла: ${localizedOptionLabel(
        microcycleMatch[1],
        language,
        MICROCYCLE_TYPE_LABELS,
      )}`,
      bg: `съвпадение на микроцикъла: ${localizedOptionLabel(
        microcycleMatch[1],
        language,
        MICROCYCLE_TYPE_LABELS,
      )}`,
    });
  }

  const mesocycleMatch = /^mesocycle week match: (.+)$/i.exec(trimmed);
  if (mesocycleMatch) {
    return copyFor(language, {
      en: `mesocycle week match: ${localizedOptionLabel(
        mesocycleMatch[1],
        language,
        MICROCYCLE_TYPE_LABELS,
      )}`,
      ru: `совпадение недели мезоцикла: ${localizedOptionLabel(
        mesocycleMatch[1],
        language,
        MICROCYCLE_TYPE_LABELS,
      )}`,
      bg: `съвпадение на седмицата от мезоцикъла: ${localizedOptionLabel(
        mesocycleMatch[1],
        language,
        MICROCYCLE_TYPE_LABELS,
      )}`,
    });
  }

  const repeatMatch = /^repeat penalty x(\d+)$/i.exec(trimmed);
  if (repeatMatch) {
    return copyFor(language, {
      en: `repeat penalty x${repeatMatch[1]}`,
      ru: `штраф за повтор x${repeatMatch[1]}`,
      bg: `санкция за повторение x${repeatMatch[1]}`,
    });
  }

  const historyMatch = /^history (boost|caution): (.+) \(([^,]+), n=(\d+)\)$/i.exec(trimmed);
  if (historyMatch) {
    const effect = historyMatch[1] === "boost"
      ? copyFor(language, {
          en: "history boost",
          ru: "история усиливает",
          bg: "историята подсилва",
        })
      : copyFor(language, {
          en: "history caution",
          ru: "история предупреждает",
          bg: "историята предупреждава",
        });
    const scope = localizedPlannerScopeLabel(
      historyMatch[3] as NonNullable<PlannerSuggestion["feedback"]>["scope"],
      language,
    );

    return `${effect}: ${localizedPlannerHistoryReasonDescription(
      historyMatch[2],
      language,
    )} (${scope}, n=${historyMatch[4]})`;
  }

  return trimmed;
}

function localizedPlannerReason(reason: string, language: Language) {
  const exact: Record<string, Record<Language, string>> = {
    "Restores freshness after the last build session.": {
      en: "Restores freshness after the last build session.",
      ru: "Восстанавливает свежесть после последней нагрузочной сессии.",
      bg: "Възстановява свежестта след последната натоварваща сесия.",
    },
    "Best fit for phase taper, priority A, and competition proximity.": {
      en: "Best fit for phase taper, priority A, and competition proximity.",
      ru: "Лучше всего подходит под подводку, приоритет A и близость соревнования.",
      bg: "Най-добро съответствие за тейпър, приоритет A и близост до състезание.",
    },
    "Balances cumulative density before travel.": {
      en: "Balances cumulative density before travel.",
      ru: "Выравнивает накопленную плотность нагрузки перед поездкой.",
      bg: "Балансира натрупаната плътност преди пътуване.",
    },
    "Keeps specific sharpness without reopening fatigue.": {
      en: "Keeps specific sharpness without reopening fatigue.",
      ru: "Сохраняет специальную остроту без повторного накопления усталости.",
      bg: "Запазва специфичната острота без повторно натрупване на умора.",
    },
    "Short flush and mobility before competition day.": {
      en: "Short flush and mobility before competition day.",
      ru: "Короткая разгрузка и мобильность перед соревновательным днём.",
      bg: "Кратко раздвижване и мобилност преди състезателния ден.",
    },
  };

  if (exact[reason]) {
    return exact[reason][language];
  }

  return reason
    .split(/, (?![^()]*\))/)
    .map((fragment) => localizedPlannerReasonFragment(fragment, language))
    .join(", ");
}

function localizedPlannerWarningMessage(warning: PlannerWarning, language: Language) {
  const amountMatch = /by\s+(-?\d+(?:\.\d+)?)/i.exec(warning.message);
  const amount = amountMatch?.[1] ?? "";
  const weekTypeMatch = /the\s+([\w-]+)\s+(?:intent|mesocycle week intent)/i.exec(
    warning.message,
  );
  const weekType = weekTypeMatch
    ? localizedOptionLabel(weekTypeMatch[1], language, MICROCYCLE_TYPE_LABELS)
    : "";
  const betweenDaysMatch = /between\s+Day\s+(\d+)\s+and\s+Day\s+(\d+)/i.exec(
    warning.message,
  );

  if (warning.code === "high_load_density") {
    return copyFor(language, {
      en: warning.message,
      ru: "Слишком высокая плотность тяжёлых дней вокруг недельного плана.",
      bg: "Твърде висока плътност на тежки дни около седмичния план.",
    });
  }

  if (warning.code === "low_recovery") {
    return copyFor(language, {
      en: warning.message,
      ru: "Недостаточно восстановления в ближайших назначенных днях и предложенных слотах.",
      bg: "Недостатъчно възстановяване в близките назначени дни и предложените слотове.",
    });
  }

  if (warning.code === "taper_violated") {
    if (betweenDaysMatch) {
      return copyFor(language, {
        en: warning.message,
        ru: `Слишком высокая плотность нагрузки между ${localizedPlannerDayLabel(
          `Day ${betweenDaysMatch[1]}`,
          language,
        )} и ${localizedPlannerDayLabel(
          `Day ${betweenDaysMatch[2]}`,
          language,
        )} на неделе подводки.`,
        bg: `Твърде висока плътност на натоварването между ${localizedPlannerDayLabel(
          `Day ${betweenDaysMatch[1]}`,
          language,
        )} и ${localizedPlannerDayLabel(
          `Day ${betweenDaysMatch[2]}`,
          language,
        )} в тейпър седмицата.`,
      });
    }

    return copyFor(language, {
      en: warning.message,
      ru: "Подводка нарушена: тяжёлый или нагрузочный день стоит слишком близко к соревнованию.",
      bg: "Тейпърът е нарушен: тежък или натоварващ ден е твърде близо до състезанието.",
    });
  }

  if (warning.code === "weekly_load_jump") {
    return copyFor(language, {
      en: warning.message,
      ru: "Недельная нагрузка слишком резко меняется между соседними календарными днями.",
      bg: "Седмичното натоварване се променя твърде рязко между съседни календарни дни.",
    });
  }

  if (warning.code === "calendar_overlap") {
    return copyFor(language, {
      en: warning.message,
      ru: "Один или несколько предложенных дней пересекаются с уже назначенными датами.",
      bg: "Един или повече предложени дни се припокриват с вече назначени дати.",
    });
  }

  if (warning.code === "mesocycle_target_above") {
    return copyFor(language, {
      en: warning.message,
      ru: `Плановая недельная нагрузка выше цели мезоцикла${amount ? ` на ${amount}` : ""}.`,
      bg: `Планираното седмично натоварване е над целта на мезоцикъла${
        amount ? ` с ${amount}` : ""
      }.`,
    });
  }

  if (warning.code === "mesocycle_target_below") {
    return copyFor(language, {
      en: warning.message,
      ru: `Плановая недельная нагрузка ниже цели мезоцикла${amount ? ` на ${amount}` : ""}.`,
      bg: `Планираното седмично натоварване е под целта на мезоцикъла${
        amount ? ` с ${amount}` : ""
      }.`,
    });
  }

  return copyFor(language, {
    en: warning.message,
    ru: weekType
      ? `Пакет не соответствует намерению недели мезоцикла: ${weekType}.`
      : "Пакет не соответствует типу текущей недели мезоцикла.",
    bg: weekType
      ? `Пакетът не съответства на намерението на седмицата от мезоцикъла: ${weekType}.`
      : "Пакетът не съответства на типа на текущата седмица от мезоцикъла.",
  });
}

function localizedPlannerSuggestionMessage(
  suggestion: PlannerSuggestion,
  language: Language,
) {
  const day = localizedPlannerDayFromOffset(suggestion.dayOffset, language);
  const targetDay =
    suggestion.targetDayOffset === null
      ? ""
      : localizedPlannerDayFromOffset(suggestion.targetDayOffset, language);
  const templateName = translateKnownTemplateText(suggestion.recommendedTemplateName, language);

  if (suggestion.code === "recover_day_swap") {
    return copyFor(language, {
      en: suggestion.message,
      ru: templateName
        ? `Заменить ${day} на восстановительный слот: ${templateName}.`
        : `Заменить ${day} на восстановительный слот.`,
      bg: templateName
        ? `Заменете ${day} с възстановителен слот: ${templateName}.`
        : `Заменете ${day} с възстановителен слот.`,
    });
  }

  if (suggestion.code === "activation_swap") {
    return copyFor(language, {
      en: suggestion.message,
      ru: templateName
        ? `Безопасная подводка: заменить ${day} на ${templateName}.`
        : `Безопасная подводка: снизить ${day} и оставить только активацию/восстановление.`,
      bg: templateName
        ? `Безопасен тейпър: заменете ${day} с ${templateName}.`
        : `Безопасен тейпър: намалете ${day} и оставете само активация/възстановяване.`,
    });
  }

  if (suggestion.code === "reduce_slot_load") {
    return copyFor(language, {
      en: suggestion.message,
      ru: `Снизить нагрузку в ${day}, чтобы сгладить недельную кривую нагрузки.`,
      bg: `Намалете натоварването в ${day}, за да изгладите седмичната крива на натоварване.`,
    });
  }

  if (suggestion.code === "increase_slot_load") {
    return copyFor(language, {
      en: suggestion.message,
      ru: `Увеличить нагрузку в ${day}, чтобы лучше попасть в цель мезоцикла.`,
      bg: `Увеличете натоварването в ${day}, за да доближите целта на мезоцикъла.`,
    });
  }

  if (suggestion.code === "move_specific_day") {
    return copyFor(language, {
      en: suggestion.message,
      ru: targetDay
        ? `Перенести специальный день: ${day} → ${targetDay}, если календарь остаётся плотным.`
        : `Перенести специальный день с ${day}, если календарь остаётся плотным.`,
      bg: targetDay
        ? `Преместете специфичния ден: ${day} → ${targetDay}, ако календарът остава плътен.`
        : `Преместете специфичния ден от ${day}, ако календарът остава плътен.`,
    });
  }

  if (suggestion.code === "resolve_overlap") {
    return copyFor(language, {
      en: suggestion.message,
      ru: `Убрать пересечение календаря в ${day}: оставить одну основную сессию на дату.`,
      bg: `Премахнете календарното припокриване в ${day}: оставете една основна сесия за датата.`,
    });
  }

  return suggestion.message;
}

function formatPlannerLoad(value: number | null | undefined, language: Language) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return copyFor(language, { en: "not calculated", ru: "не рассчитана", bg: "не е изчислено" });
  }

  return Number(value.toFixed(1)).toString();
}

function localizedPlannerSuggestionDetails(
  suggestion: PlannerSuggestion,
  language: Language,
  pack: TemplatePackRecommendation | null,
  templates: PlanTemplateSummary[],
) {
  const day = localizedPlannerDayFromOffset(suggestion.dayOffset, language);
  const targetDay =
    suggestion.targetDayOffset === null
      ? ""
      : localizedPlannerDayFromOffset(suggestion.targetDayOffset, language);
  const currentItem =
    suggestion.dayOffset === null || !pack
      ? null
      : pack.items.find((item) => item.dayOffset === suggestion.dayOffset) ?? null;
  const previousItem =
    currentItem && pack
      ? pack.items.find((item) => item.dayOffset === currentItem.dayOffset - 1) ?? null
      : null;
  const nextItem =
    currentItem && pack
      ? pack.items.find((item) => item.dayOffset === currentItem.dayOffset + 1) ?? null
      : null;
  const neighboringItems = [previousItem, nextItem].filter(
    (item): item is TemplatePackDraftItem => Boolean(item),
  );
  const sharpestNeighbor = currentItem
    ? neighboringItems
        .map((item) => ({
          item,
          delta: Math.abs(currentItem.estimatedLoad - item.estimatedLoad),
        }))
        .sort((left, right) => right.delta - left.delta)[0] ?? null
    : null;
  const highestLoad = pack?.items.length
    ? Math.max(...pack.items.map((item) => item.estimatedLoad))
    : null;
  const recommendedTemplate = suggestion.recommendedTemplateId
    ? templates.find((template) => template.id === suggestion.recommendedTemplateId) ?? null
    : null;
  const recommendedLoad = recommendedTemplate
    ? estimateTemplateLoadForDay(recommendedTemplate, suggestion.recommendedTemplateDayIndex)
    : null;
  const details: string[] = [];

  if (suggestion.code === "reduce_slot_load") {
    if (currentItem) {
      details.push(
        copyFor(language, {
          en: `Current ${day} load is ${formatPlannerLoad(currentItem.estimatedLoad, language)}${
            highestLoad !== null && currentItem.estimatedLoad >= highestLoad
              ? ", the highest slot in this week"
              : ""
          }.`,
          ru: `Текущая нагрузка в ${day}: ${formatPlannerLoad(currentItem.estimatedLoad, language)}${
            highestLoad !== null && currentItem.estimatedLoad >= highestLoad
              ? ", это самый высокий слот недели"
              : ""
          }.`,
          bg: `Текущото натоварване в ${day}: ${formatPlannerLoad(currentItem.estimatedLoad, language)}${
            highestLoad !== null && currentItem.estimatedLoad >= highestLoad
              ? ", това е най-високият слот за седмицата"
              : ""
          }.`,
        }),
      );
    }

    if (sharpestNeighbor) {
      const neighborDay = localizedPlannerDayFromOffset(sharpestNeighbor.item.dayOffset, language);
      details.push(
        copyFor(language, {
          en: `${neighborDay} is ${formatPlannerLoad(
            sharpestNeighbor.item.estimatedLoad,
            language,
          )}; the difference is ${formatPlannerLoad(
            sharpestNeighbor.delta,
            language,
          )}, so the load curve becomes too sharp.`,
          ru: `${neighborDay} имеет нагрузку ${formatPlannerLoad(
            sharpestNeighbor.item.estimatedLoad,
            language,
          )}; разница ${formatPlannerLoad(
            sharpestNeighbor.delta,
            language,
          )}, поэтому кривая нагрузки получается слишком резкой.`,
          bg: `${neighborDay} има натоварване ${formatPlannerLoad(
            sharpestNeighbor.item.estimatedLoad,
            language,
          )}; разликата е ${formatPlannerLoad(
            sharpestNeighbor.delta,
            language,
          )}, затова кривата на натоварването става твърде рязка.`,
        }),
      );
    }

    if (pack?.mesocycleWeek) {
      details.push(
        copyFor(language, {
          en: `Weekly plan load is ${formatPlannerLoad(
            pack.totalPlannedLoad,
            language,
          )} against mesocycle target ${formatPlannerLoad(
            pack.mesocycleWeek.targetLoad,
            language,
          )}; delta ${formatPlannerLoad(pack.targetLoadDelta, language)}.`,
          ru: `Нагрузка недели ${formatPlannerLoad(
            pack.totalPlannedLoad,
            language,
          )} при цели мезоцикла ${formatPlannerLoad(
            pack.mesocycleWeek.targetLoad,
            language,
          )}; отклонение ${formatPlannerLoad(pack.targetLoadDelta, language)}.`,
          bg: `Седмичното натоварване е ${formatPlannerLoad(
            pack.totalPlannedLoad,
            language,
          )} при цел на мезоцикъла ${formatPlannerLoad(
            pack.mesocycleWeek.targetLoad,
            language,
          )}; отклонение ${formatPlannerLoad(pack.targetLoadDelta, language)}.`,
        }),
      );
    }

    if (recommendedTemplate) {
      details.push(
        copyFor(language, {
          en: `Suggested replacement: ${translateKnownTemplateText(
            recommendedTemplate.name,
            language,
          )}, estimated slot load ${formatPlannerLoad(recommendedLoad, language)}.`,
          ru: `Предлагаемая замена: ${translateKnownTemplateText(
            recommendedTemplate.name,
            language,
          )}, ожидаемая нагрузка слота ${formatPlannerLoad(recommendedLoad, language)}.`,
          bg: `Предложена замяна: ${translateKnownTemplateText(
            recommendedTemplate.name,
            language,
          )}, очаквано натоварване на слота ${formatPlannerLoad(recommendedLoad, language)}.`,
        }),
      );
    }
  }

  if (suggestion.code === "increase_slot_load" && currentItem) {
    details.push(
      copyFor(language, {
        en: `${day} is the lightest available slot at ${formatPlannerLoad(
          currentItem.estimatedLoad,
          language,
        )}, while the week is below the mesocycle target.`,
        ru: `${day} сейчас один из самых лёгких слотов: ${formatPlannerLoad(
          currentItem.estimatedLoad,
          language,
        )}, при этом неделя ниже цели мезоцикла.`,
        bg: `${day} е един от най-леките слотов: ${formatPlannerLoad(
          currentItem.estimatedLoad,
          language,
        )}, а седмицата е под целта на мезоцикъла.`,
      }),
    );
  }

  if (suggestion.code === "recover_day_swap" && currentItem) {
    details.push(
      copyFor(language, {
        en: `${day} is carrying ${formatPlannerLoad(
          currentItem.estimatedLoad,
          language,
        )}; recovery protects adaptation when nearby days are dense.`,
        ru: `${day} несёт нагрузку ${formatPlannerLoad(
          currentItem.estimatedLoad,
          language,
        )}; восстановительный слот защищает адаптацию, когда рядом плотные дни.`,
        bg: `${day} носи натоварване ${formatPlannerLoad(
          currentItem.estimatedLoad,
          language,
        )}; възстановителният слот пази адаптацията при плътни съседни дни.`,
      }),
    );
  }

  if (suggestion.code === "activation_swap" && currentItem) {
    details.push(
      copyFor(language, {
        en: `${day} is too demanding for taper/competition context: load ${formatPlannerLoad(
          currentItem.estimatedLoad,
          language,
        )}.`,
        ru: `${day} слишком тяжёлый для подводки или соревновательного контекста: нагрузка ${formatPlannerLoad(
          currentItem.estimatedLoad,
          language,
        )}.`,
        bg: `${day} е твърде тежък за тейпър или състезателен контекст: натоварване ${formatPlannerLoad(
          currentItem.estimatedLoad,
          language,
        )}.`,
      }),
    );
  }

  if (suggestion.code === "move_specific_day" && targetDay) {
    details.push(
      copyFor(language, {
        en: `Moving from ${day} to ${targetDay} keeps the specific work but separates it from calendar pressure.`,
        ru: `Перенос с ${day} на ${targetDay} сохраняет специальную работу, но разводит её с календарной плотностью.`,
        bg: `Преместването от ${day} към ${targetDay} запазва специфичната работа, но я отделя от календарната плътност.`,
      }),
    );
  }

  if (suggestion.code === "resolve_overlap") {
    details.push(
      copyFor(language, {
        en: `${day} already has an assigned calendar item, so stacking another primary session can distort execution and analytics.`,
        ru: `На ${day} уже есть назначение в календаре, поэтому ещё одна основная сессия может исказить выполнение и аналитику.`,
        bg: `В ${day} вече има назначение в календара, затова още една основна сесия може да изкриви изпълнението и аналитиката.`,
      }),
    );
  }

  if (!details.length && suggestion.message) {
    details.push(suggestion.message);
  }

  return details;
}

function translateKnownMesocycleText(value: string | null | undefined, language: Language) {
  if (!value) {
    return "";
  }

  const exact = KNOWN_MESOCYCLE_TEXT_LABELS[value];
  if (exact) {
    return exact[language];
  }

  const competitionMatch = /^Competition execution(?: for (.+))?\.$/.exec(value);
  if (competitionMatch) {
    const suffix = competitionMatch[1] ? `: ${competitionMatch[1]}` : "";
    return copyFor(language, {
      en: `Competition execution${suffix}.`,
      ru: `Соревновательное выполнение${suffix}.`,
      bg: `Състезателно изпълнение${suffix}.`,
    });
  }

  const source = Object.entries(KNOWN_MESOCYCLE_TEXT_LABELS).find(([, translations]) =>
    Object.values(translations).includes(value),
  );

  return source ? source[1][language] : value;
}

function isKnownTemplateText(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return Object.entries(KNOWN_TEMPLATE_TEXT_LABELS).some(
    ([source, translations]) => value === source || Object.values(translations).includes(value),
  );
}

function getBlockExercisePresets(blockType: PlanBlockType) {
  return BLOCK_EXERCISE_PRESETS[blockType] ?? [];
}

function buildBlockExerciseFromPreset(
  preset: BlockExercisePreset,
  language: Language,
): PlanExerciseInput {
  return {
    name: copyFor(language, preset.label),
    targetSets: preset.targetSets,
    targetReps: preset.targetReps,
    targetWeightKg: preset.targetWeightKg,
    targetDurationMinutes: preset.targetDurationMinutes,
    targetRpe: preset.targetRpe,
    notes: copyFor(language, preset.notes),
    displayOrder: preset.displayOrder,
  };
}

function formatExercisePresetVolume(preset: BlockExercisePreset, language: Language) {
  const parts: string[] = [];

  if (preset.targetSets && preset.targetReps) {
    parts.push(`${preset.targetSets}x${preset.targetReps}`);
  } else if (preset.targetSets) {
    parts.push(`${preset.targetSets} ${copyFor(language, { en: "sets", ru: "подх.", bg: "серии" })}`);
  } else if (preset.targetReps) {
    parts.push(`${preset.targetReps} ${copyFor(language, { en: "reps", ru: "повт.", bg: "повт." })}`);
  }

  if (preset.targetDurationMinutes) {
    parts.push(`${preset.targetDurationMinutes} ${copyFor(language, { en: "min", ru: "мин", bg: "мин" })}`);
  }

  if (preset.targetWeightKg) {
    parts.push(`${preset.targetWeightKg} ${copyFor(language, { en: "kg", ru: "кг", bg: "кг" })}`);
  }

  return parts.length ? parts.join(" / ") : copyFor(language, {
    en: "Set by coach",
    ru: "По назначению",
    bg: "По преценка",
  });
}

function formatExercisePresetControl(preset: BlockExercisePreset, language: Language) {
  const control = preset.targetRpe ? `RPE ${preset.targetRpe}` : "";
  const notes = copyFor(language, preset.notes);

  return control ? `${control} / ${notes}` : notes;
}

function buildPreparationRowFromPreset(
  preset: BlockExercisePreset,
  language: Language,
): PreparationPlanTableRow {
  return {
    block: copyFor(language, preset.label),
    volume: formatExercisePresetVolume(preset, language),
    control: formatExercisePresetControl(preset, language),
  };
}

function buildEmptyBlockExercise(language: Language, blockType: PlanBlockType): PlanExerciseInput {
  return {
    name: copyFor(language, {
      en: `Custom ${localizedOptionLabel(blockType, language, BLOCK_TYPE_LABELS).toLowerCase()} exercise`,
      ru: `Своё упражнение: ${localizedOptionLabel(blockType, language, BLOCK_TYPE_LABELS).toLowerCase()}`,
      bg: `Собствено упражнение: ${localizedOptionLabel(blockType, language, BLOCK_TYPE_LABELS).toLowerCase()}`,
    }),
    targetSets: 3,
    targetReps: 5,
    targetWeightKg: null,
    targetDurationMinutes: null,
    targetRpe: 7,
    notes: "",
  };
}

function buildDefaultBlockExercises(language: Language, blockType: PlanBlockType): PlanExerciseInput[] {
  return getBlockExercisePresets(blockType).slice(0, 3).map((preset, index) => ({
    ...buildBlockExerciseFromPreset(preset, language),
    displayOrder: index,
  }));
}

function templateSummaryToPayload(template: PlanTemplateSummary, language: Language): PlanTemplatePayload {
  return {
    name: translateKnownTemplateText(template.name, language),
    description: translateKnownTemplateText(template.description, language),
    sportType: translateKnownTemplateText(template.sportType, language),
    phaseFocus: template.phaseFocus,
    competitionPriorityFocus: template.competitionPriorityFocus,
    templateGoal: translateKnownTemplateText(template.templateGoal, language),
    microcycleType: template.microcycleType,
    competitionSpecific: template.competitionSpecific,
    blocks: template.blocks.map((block) => ({
      ...block,
      name: translateKnownTemplateText(block.name, language),
      notes: translateKnownTemplateText(block.notes, language),
      exercises: block.exercises?.map((exercise, index) => ({
        name: translateKnownTemplateText(exercise.name, language),
        targetSets: exercise.targetSets,
        targetReps: exercise.targetReps,
        targetWeightKg: exercise.targetWeightKg,
        targetDurationMinutes: exercise.targetDurationMinutes,
        targetRpe: exercise.targetRpe,
        notes: translateKnownTemplateText(exercise.notes, language),
        displayOrder: index,
      })),
    })),
    days: template.days?.map((day, dayIndex) => ({
      label: translateKnownTemplateText(day.label, language),
      notes: translateKnownTemplateText(day.notes, language),
      orderIndex: day.orderIndex ?? dayIndex,
      sessions: day.sessions.map((session, sessionIndex) => ({
        name: translateKnownTemplateText(session.name, language),
        notes: translateKnownTemplateText(session.notes, language),
        orderIndex: session.orderIndex ?? sessionIndex,
        blocks: session.blocks.map((block) => ({
          ...block,
          name: translateKnownTemplateText(block.name, language),
          notes: translateKnownTemplateText(block.notes, language),
          exercises: block.exercises?.map((exercise, exerciseIndex) => ({
            name: translateKnownTemplateText(exercise.name, language),
            targetSets: exercise.targetSets,
            targetReps: exercise.targetReps,
            targetWeightKg: exercise.targetWeightKg,
            targetDurationMinutes: exercise.targetDurationMinutes,
            targetRpe: exercise.targetRpe,
            notes: translateKnownTemplateText(exercise.notes, language),
            displayOrder: exercise.displayOrder ?? exerciseIndex,
          })),
        })),
      })),
    })),
  };
}

function createEmptyPreparationPlanDraft(language: Language): PreparationPlanReference {
  return {
    title: copyFor(language, {
      en: "New preparation plan",
      ru: "Новый план подготовки",
      bg: "Нов план за подготовка",
    }),
    period: getDateInputValue(),
    subtitle: "",
    metrics: [],
    phases: [],
    zones: [],
    monitoringDates: [],
    weeks: [
      {
        title: copyFor(language, { en: "Week 1", ru: "Неделя 1", bg: "Седмица 1" }),
        days: [
          {
            title: copyFor(language, { en: "Day 1", ru: "День 1", bg: "Ден 1" }),
            type: copyFor(language, {
              en: "Training focus",
              ru: "Фокус дня",
              bg: "Фокус на деня",
            }),
            sessions: [
              {
                title: copyFor(language, { en: "Session 1", ru: "Сессия 1", bg: "Сесия 1" }),
                columns: [
                  copyFor(language, { en: "Exercise", ru: "Упражнение", bg: "Упражнение" }),
                  copyFor(language, { en: "Volume", ru: "Объём", bg: "Обем" }),
                  copyFor(language, { en: "Control", ru: "Контроль", bg: "Контрол" }),
                ],
                rows: [],
              },
            ],
          },
        ],
      },
    ],
    nutrition: [],
    summary: [],
  };
}

function createLocalizedDefaultPlanTemplate(language: Language): PlanTemplatePayload {
  return {
    ...DEFAULT_PLAN_TEMPLATE,
    name: translateKnownTemplateText(DEFAULT_PLAN_TEMPLATE.name, language),
    description: translateKnownTemplateText(DEFAULT_PLAN_TEMPLATE.description, language),
    sportType: translateKnownTemplateText(DEFAULT_PLAN_TEMPLATE.sportType, language),
    templateGoal: translateKnownTemplateText(DEFAULT_PLAN_TEMPLATE.templateGoal, language),
    blocks: DEFAULT_PLAN_TEMPLATE.blocks.map((block) => ({
      ...block,
      name: translateKnownTemplateText(block.name, language),
      notes: translateKnownTemplateText(block.notes, language),
      exercises:
        block.exercises && block.exercises.length > 0
          ? block.exercises.map((exercise) => ({
              ...exercise,
              name: translateKnownTemplateText(exercise.name, language),
              notes: translateKnownTemplateText(exercise.notes, language),
            }))
          : buildDefaultBlockExercises(language, block.blockType),
    })),
  };
}

function isLocalizedDefaultPlanTemplate(template: PlanTemplatePayload) {
  return (
    isKnownTemplateText(template.name) &&
    isKnownTemplateText(template.description) &&
    isKnownTemplateText(template.sportType) &&
    isKnownTemplateText(template.templateGoal) &&
    template.phaseFocus === DEFAULT_PLAN_TEMPLATE.phaseFocus &&
    template.competitionPriorityFocus === DEFAULT_PLAN_TEMPLATE.competitionPriorityFocus &&
    template.microcycleType === DEFAULT_PLAN_TEMPLATE.microcycleType &&
    template.competitionSpecific === DEFAULT_PLAN_TEMPLATE.competitionSpecific &&
    template.blocks.length === DEFAULT_PLAN_TEMPLATE.blocks.length &&
    template.blocks.every((block, index) => {
      const defaultBlock = DEFAULT_PLAN_TEMPLATE.blocks[index];

      return (
        Boolean(defaultBlock) &&
        block.blockType === defaultBlock.blockType &&
        block.blockPriority === defaultBlock.blockPriority &&
        block.isMandatory === defaultBlock.isMandatory &&
        isKnownTemplateText(block.name) &&
        isKnownTemplateText(block.notes)
      );
    })
  );
}

function localizedDayOneLabel(language: Language) {
  return copyFor(language, { en: "Day 1", ru: "День 1", bg: "Ден 1" });
}

function localizedAssignedPlanNotes(language: Language) {
  return copyFor(language, {
    en: "Assigned from coach workspace",
    ru: "Назначено из рабочего места тренера",
    bg: "Назначено от работното място на треньора",
  });
}

function localizedMicrocycleNotes(language: Language) {
  return copyFor(language, {
    en: "Phase-driven microcycle",
    ru: "Микроцикл с учётом фазы подготовки",
    bg: "Микроцикъл според фазата на подготовка",
  });
}

function isKnownDayOneLabel(value: string) {
  return ["Day 1", "День 1", "Ден 1"].includes(value);
}

function isKnownAssignedPlanNotes(value: string) {
  return [
    "Assigned from coach workspace",
    "Назначено из рабочего места тренера",
    "Назначено от работното място на треньора",
  ].includes(value);
}

function isKnownMicrocycleNotes(value: string) {
  return [
    "Phase-driven microcycle",
    "Микроцикл с учётом фазы подготовки",
    "Микроцикъл според фазата на подготовка",
  ].includes(value);
}

function blocksCountLabel(count: number, language: Language) {
  if (language === "en") {
    return `${count} ${count === 1 ? "block" : "blocks"}`;
  }

  if (language === "bg") {
    return `${count} ${count === 1 ? "блок" : "блока"}`;
  }

  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  const form =
    lastDigit === 1 && lastTwoDigits !== 11
      ? "блок"
      : lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)
        ? "блока"
        : "блоков";

  return `${count} ${form}`;
}

function translateTemplateRecommendationReason(reason: string, language: Language) {
  return reason
    .split(", ")
    .map((part) => {
      if (part.startsWith("phase match: ")) {
        const phase = part.replace("phase match: ", "");
        return copyFor(language, {
          en: `Phase match: ${localizedOptionLabel(phase, language, PREPARATION_PHASE_LABELS)}`,
          ru: `Совпадение фазы: ${localizedOptionLabel(phase, language, PREPARATION_PHASE_LABELS)}`,
          bg: `Съвпадение на фазата: ${localizedOptionLabel(phase, language, PREPARATION_PHASE_LABELS)}`,
        });
      }

      if (part.startsWith("priority match: ")) {
        const priority = part.replace("priority match: ", "");
        return copyFor(language, {
          en: `Priority match: ${priority}`,
          ru: `Совпадение приоритета: ${priority}`,
          bg: `Съвпадение на приоритета: ${priority}`,
        });
      }

      if (part === "competition-specific template") {
        return copyFor(language, {
          en: "Competition-specific template",
          ru: "Шаблон учитывает специфику соревнований",
          bg: "Шаблонът отчита състезателната специфика",
        });
      }

      if (part === "general template fit") {
        return copyFor(language, {
          en: "General template fit",
          ru: "Общее соответствие шаблона",
          bg: "Общо съответствие на шаблона",
        });
      }

      return part;
    })
    .join("; ");
}

function initialsFor(name: string) {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "V3";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function scrollViewportToTop() {
  if (typeof window === "undefined") {
    return;
  }

  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }

  const scrollNow = () => {
    const scrollingElement = document.scrollingElement ?? document.documentElement;
    scrollingElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };

  scrollNow();
  window.requestAnimationFrame(scrollNow);
  window.setTimeout(scrollNow, 0);
  window.setTimeout(scrollNow, 180);
  window.setTimeout(scrollNow, 420);
}

function isCoachWorkspaceId(workspaceId: WorkspaceSectionId) {
  return (
    workspaceId === "coach-dashboard" ||
    workspaceId === "coach-athletes" ||
    workspaceId === "coach-analytics" ||
    workspaceId === "coach-review"
  );
}

function isAthleteWorkspaceId(workspaceId: WorkspaceSectionId) {
  return (
    workspaceId === "athlete-today" ||
    workspaceId === "daily-readiness" ||
    workspaceId === "athlete-training" ||
    workspaceId === "athlete-workspace" ||
    workspaceId === "athlete-history" ||
    workspaceId === "athlete-competitions"
  );
}

function resolveAccessibleWorkspace(
  workspaceId: WorkspaceSectionId,
  canSeeCoachWorkspace: boolean,
): WorkspaceSectionId {
  if (!SHOW_OFFLINE_CENTER_NAV && workspaceId === "offline-center") {
    return canSeeCoachWorkspace ? "coach-dashboard" : "athlete-today";
  }

  if (canSeeCoachWorkspace && isAthleteWorkspaceId(workspaceId)) {
    return "coach-dashboard";
  }

  if (
    !canSeeCoachWorkspace &&
    (isCoachWorkspaceId(workspaceId) || workspaceId === "planning-studio")
  ) {
    return "athlete-today";
  }

  return workspaceId;
}

function createEmptyAnalyticsChain(): AnalyticsOverview["chain"] {
  return {
    season: null,
    competitionPlan: null,
    competitionContext: null,
    mesocycle: null,
    mesocycleWeek: null,
    weekSummary: null,
    missingLinks: [],
  };
}

function normalizeAnalyticsOverview(
  overview: Partial<AnalyticsOverview> | AnalyticsOverview | null | undefined,
): AnalyticsOverview | null {
  if (!overview) {
    return null;
  }

  const chain = overview.chain ?? createEmptyAnalyticsChain();

  return {
    athleteId: overview.athleteId ?? "",
    athleteName: overview.athleteName ?? "",
    readinessTrend: Array.isArray(overview.readinessTrend) ? overview.readinessTrend : [],
    completionTrend: Array.isArray(overview.completionTrend) ? overview.completionTrend : [],
    loadTrend: Array.isArray(overview.loadTrend) ? overview.loadTrend : [],
    chain: {
      ...createEmptyAnalyticsChain(),
      ...chain,
      missingLinks: Array.isArray(chain.missingLinks) ? chain.missingLinks : [],
    },
    insights: Array.isArray(overview.insights) ? overview.insights : [],
    patterns: Array.isArray(overview.patterns) ? overview.patterns : [],
    coachSuggestions: Array.isArray(overview.coachSuggestions)
      ? overview.coachSuggestions.map((suggestion) => ({
          ...suggestion,
          weekStartDate: suggestion.weekStartDate ?? suggestion.plannerBridge?.startDate ?? null,
          weekLabel:
            suggestion.weekLabel ??
            chain.weekSummary?.label ??
            chain.mesocycleWeek?.weekLabel ??
            null,
          latestDecision: suggestion.latestDecision ?? null,
        }))
      : [],
    decisionHistory: Array.isArray(overview.decisionHistory) ? overview.decisionHistory : [],
  };
}

function toExecutionDraft(result?: ExecutionResult): ExecutionDraft {
  if (!result) {
    return emptyExecutionDraft;
  }

  return {
    completed: result.completed,
    setsCompleted: result.setsCompleted,
    repsCompleted: result.repsCompleted,
    weightKg: result.weightKg,
    durationMinutes: result.durationMinutes,
    rpe: result.rpe,
    notes: result.notes,
  };
}

function normalizeTemplatePackItems(items: TemplatePackDraftItem[]) {
  return [...items]
    .sort((left, right) => left.dayOffset - right.dayOffset)
    .map((item) => ({
      ...item,
      dayLabel: `Day ${item.dayOffset + 1}`,
    }));
}

function recalculateTemplatePack(
  pack: TemplatePackRecommendation,
  items: TemplatePackDraftItem[],
): TemplatePackRecommendation {
  const normalizedItems = normalizeTemplatePackItems(items);
  const totalPlannedLoad = Number(
    normalizedItems.reduce((sum, item) => sum + item.estimatedLoad, 0).toFixed(1),
  );
  const uniqueTemplates = new Set(normalizedItems.map((item) => item.templateId)).size;
  const varietyScore = normalizedItems.length
    ? Number((uniqueTemplates / normalizedItems.length).toFixed(2))
    : 0;
  const loadBalanceLabel =
    normalizedItems.length <= 1
      ? "single-day"
      : normalizedItems.some(
            (item, index) =>
              index > 0 &&
              Math.abs(item.estimatedLoad - normalizedItems[index - 1].estimatedLoad) > 120,
          )
        ? "volatile"
        : "balanced";
  const targetLoadDelta = pack.mesocycleWeek
    ? Number((totalPlannedLoad - pack.mesocycleWeek.targetLoad).toFixed(1))
    : null;

  return {
    ...pack,
    suggestedDays: normalizedItems.length,
    totalPlannedLoad,
    targetLoadDelta,
    varietyScore,
    loadBalanceLabel,
    warnings: [],
    suggestions: [],
    items: normalizedItems,
  };
}

function packToMicrocycleItems(pack: TemplatePackRecommendation) {
  return pack.items.map((item) => ({
    templateId: item.templateId,
    templateDayIndex: item.templateDayIndex,
    dayOffset: item.dayOffset,
    dayLabel: item.dayLabel,
    microcycleType: item.microcycleType,
  }));
}

function selectCurrentAssignedPlan(
  plans: AssignedPlanSummary[],
  referenceDate = getDateInputValue(),
) {
  return (
    plans.find((plan) => plan.day.dayDate === referenceDate) ??
    plans
      .filter((plan) => plan.day.dayDate >= referenceDate)
      .sort((left, right) => left.day.dayDate.localeCompare(right.day.dayDate))[0] ??
    [...plans].sort((left, right) => right.day.dayDate.localeCompare(left.day.dayDate))[0] ??
    null
  );
}

function formatExerciseTarget(
  item: Pick<
    AssignedBlockExercise,
    | "name"
    | "targetSets"
    | "targetReps"
    | "targetWeightKg"
    | "targetDurationMinutes"
    | "targetRpe"
    | "notes"
  >,
  language: Language,
) {
  const parts: string[] = [];
  const noteParts = splitExerciseNoteParts(item.notes);
  const workNotePart = getExerciseWorkNotePart(item, noteParts);
  const workNoteSource = workNotePart ? noteParts[0] : null;
  const structuredSetDuration = formatStructuredSetDurationWork(item, language);
  const inferredWorkUnit =
    workNotePart && workNotePart !== workNoteSource
      ? inferExerciseWorkDisplayUnit(item.name, workNoteSource ?? "")
      : null;
  const detachedWorkUnit =
    inferredWorkUnit === "сек" ? "seconds" : inferredWorkUnit === "мин" ? "minutes" : null;

  if (workNotePart) {
    parts.push(workNotePart);
  } else if (structuredSetDuration) {
    parts.push(structuredSetDuration);
  } else if (item.targetSets !== null && item.targetReps !== null) {
    parts.push(`${item.targetSets} x ${item.targetReps}`);
  } else if (item.targetSets !== null) {
    parts.push(
      `${copyFor(language, {
        en: "sets",
        ru: "подходы",
        bg: "серии",
      })}: ${item.targetSets}`,
    );
  } else if (item.targetReps !== null) {
    parts.push(
      `${copyFor(language, {
        en: "reps",
        ru: "повторы",
        bg: "повторения",
      })}: ${item.targetReps}`,
    );
  }

  if (item.targetWeightKg !== null) {
    parts.push(`${item.targetWeightKg} ${copyFor(language, { en: "kg", ru: "кг", bg: "кг" })}`);
  }

  if (item.targetDurationMinutes !== null && !workNotePart && !structuredSetDuration) {
    parts.push(
      `${item.targetDurationMinutes} ${copyFor(language, {
        en: "min",
        ru: "мин",
        bg: "мин",
      })}`,
    );
  }

  if (item.targetRpe !== null) {
    parts.push(`RPE ${item.targetRpe}`);
  }

  parts.push(
    ...noteParts.filter(
      (part) =>
        part !== workNoteSource &&
        part !== workNotePart &&
        (!detachedWorkUnit || getImportedStandaloneDurationUnit(part) !== detachedWorkUnit),
    ),
  );

  return parts.length ? parts.join(" / ") : "-";
}

function splitExerciseNoteParts(notes?: string | null) {
  return (notes ?? "")
    .split(/\s*\/\s*/u)
    .map(normalizeImportedPlanText)
    .filter(Boolean);
}

function inferExerciseWorkDisplayUnit(name: string, value: string): "мин" | "сек" | null {
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

function formatStructuredSetDurationWork(
  item: Pick<
    AssignedBlockExercise,
    "name" | "targetSets" | "targetReps" | "targetDurationMinutes"
  >,
  language: Language,
) {
  if (
    item.targetSets === null ||
    item.targetReps !== null ||
    item.targetDurationMinutes === null ||
    item.targetSets <= 0 ||
    item.targetDurationMinutes <= 0
  ) {
    return null;
  }

  const displayUnit = inferExerciseWorkDisplayUnit(item.name, `${item.targetSets}×1`);

  if (!displayUnit) {
    return null;
  }

  const perSetValue =
    displayUnit === "сек"
      ? (item.targetDurationMinutes * 60) / item.targetSets
      : item.targetDurationMinutes / item.targetSets;
  const unitLabel =
    displayUnit === "сек"
      ? copyFor(language, { en: "sec", ru: "сек", bg: "сек" })
      : copyFor(language, { en: "min", ru: "мин", bg: "мин" });

  return `${item.targetSets}×${formatExerciseDurationValue(perSetValue)} ${unitLabel}`;
}

function getExerciseWorkNotePart(
  item: Pick<
    AssignedBlockExercise,
    "name" | "targetSets" | "targetReps" | "targetDurationMinutes"
  >,
  noteParts: string[],
) {
  const firstNotePart = noteParts[0];

  if (!firstNotePart || !isExerciseVolumeNote(firstNotePart)) {
    return null;
  }

  return normalizeExerciseWorkDisplay(item.name, firstNotePart);
}

function formatExerciseWorkCell(
  item: Pick<
    AssignedBlockExercise,
    "name" | "targetSets" | "targetReps" | "targetDurationMinutes" | "notes"
  >,
  language: Language,
) {
  const noteParts = splitExerciseNoteParts(item.notes);
  const workNotePart = getExerciseWorkNotePart(item, noteParts);
  const structuredSetDuration = formatStructuredSetDurationWork(item, language);

  if (workNotePart) {
    return workNotePart;
  }

  if (structuredSetDuration) {
    return structuredSetDuration;
  }

  if (item.targetSets !== null && item.targetReps !== null) {
    return `${item.targetSets}×${item.targetReps}`;
  }

  if (item.targetSets !== null) {
    return `${copyFor(language, { en: "sets", ru: "подходы", bg: "серии" })}: ${item.targetSets}`;
  }

  if (item.targetReps !== null) {
    return `${copyFor(language, { en: "reps", ru: "повторы", bg: "повторения" })}: ${item.targetReps}`;
  }

  if (noteParts[0]) {
    return noteParts[0];
  }

  if (item.targetDurationMinutes !== null) {
    return `${item.targetDurationMinutes} ${copyFor(language, { en: "min", ru: "мин", bg: "мин" })}`;
  }

  return "-";
}

function formatExerciseControlCell(
  item: Pick<
    AssignedBlockExercise,
    | "name"
    | "targetSets"
    | "targetReps"
    | "targetWeightKg"
    | "targetDurationMinutes"
    | "targetRpe"
    | "notes"
  >,
  language: Language,
) {
  const noteParts = splitExerciseNoteParts(item.notes);
  const workNotePart = getExerciseWorkNotePart(item, noteParts);
  const inferredWorkUnit =
    workNotePart && workNotePart !== noteParts[0]
      ? inferExerciseWorkDisplayUnit(item.name, noteParts[0] ?? "")
      : null;
  const detachedUnit =
    inferredWorkUnit === "сек" ? "seconds" : inferredWorkUnit === "мин" ? "minutes" : null;
  const rawControlParts = noteParts.length > 1 ? noteParts.slice(1) : [];
  const controlParts = detachedUnit
    ? rawControlParts.filter((part) => getImportedStandaloneDurationUnit(part) !== detachedUnit)
    : rawControlParts;

  if (item.targetWeightKg !== null) {
    controlParts.unshift(`${item.targetWeightKg} ${copyFor(language, { en: "kg", ru: "кг", bg: "кг" })}`);
  }

  if (item.targetRpe !== null) {
    controlParts.push(`RPE ${item.targetRpe}`);
  }

  if (controlParts.length === 0 && noteParts.length === 1 && item.targetDurationMinutes === null) {
    controlParts.push(noteParts[0]);
  }

  return controlParts.length ? controlParts.join(" / ") : "-";
}

function historyBiasesFromPlannerSuggestion(
  suggestion: PlannerSuggestion,
): TemplatePackHistoryBiasItem[] {
  if (!suggestion.feedback) {
    return [];
  }

  return [
    {
      code: suggestion.code,
      action: suggestion.action,
      effect:
        suggestion.feedback.label === "watch" || suggestion.feedback.netScore < 0
          ? "caution"
          : "boost",
      label: suggestion.feedback.label,
      scope: suggestion.feedback.scope,
      netScore: suggestion.feedback.netScore,
      sampleSize: suggestion.feedback.sampleSize,
    },
  ];
}

function summarizeTemplatePackHistory(pack: TemplatePackRecommendation | null) {
  if (!pack) {
    return null;
  }

  let informedSlots = 0;
  let boostSignals = 0;
  let cautionSignals = 0;
  let exactContextSignals = 0;

  for (const item of pack.items) {
    if (item.historyBiases.length) {
      informedSlots += 1;
    }

    for (const bias of item.historyBiases) {
      if (bias.effect === "boost") {
        boostSignals += 1;
      } else {
        cautionSignals += 1;
      }

      if (bias.scope === "exact_context") {
        exactContextSignals += 1;
      }
    }
  }

  return {
    informedSlots,
    boostSignals,
    cautionSignals,
    exactContextSignals,
  };
}

function resolveAnalyticsSuggestionPlannerLink(
  suggestion: AnalyticsCoachSuggestion,
  templatePack: TemplatePackRecommendation | null,
  templatePackContext: TemplatePackContext | null,
) {
  const bridge = suggestion.plannerBridge;

  if (!bridge) {
    return {
      bridge: null,
      hasMatchingPack: false,
      packItem: null as TemplatePackDraftItem | null,
      plannerSuggestion: null as PlannerSuggestion | null,
    };
  }

  const hasMatchingPack =
    !!templatePack &&
    !!templatePackContext &&
    templatePackContext.athleteId === bridge.athleteId &&
    templatePackContext.startDate === bridge.startDate;

  if (!hasMatchingPack || !templatePack) {
    return {
      bridge,
      hasMatchingPack: false,
      packItem: null as TemplatePackDraftItem | null,
      plannerSuggestion: null as PlannerSuggestion | null,
    };
  }

  return {
    bridge,
    hasMatchingPack: true,
    packItem:
      bridge.dayOffset !== null
        ? templatePack.items.find((item) => item.dayOffset === bridge.dayOffset) ?? null
        : null,
    plannerSuggestion: findPlannerSuggestionForBridge(templatePack.suggestions, bridge),
  };
}

function applyPlannerSuggestionToPack(
  pack: TemplatePackRecommendation,
  suggestion: PlannerSuggestion,
  templates: PlanTemplateSummary[],
) {
  if (suggestion.dayOffset === null) {
    return null;
  }

  const draftItems = pack.items.map((item) => ({ ...item }));
  const targetIndex = draftItems.findIndex((item) => item.dayOffset === suggestion.dayOffset);

  if (targetIndex === -1) {
    return null;
  }

  const targetItem = draftItems[targetIndex];
  const recommendedTemplate = suggestion.recommendedTemplateId
    ? templates.find((template) => template.id === suggestion.recommendedTemplateId) ?? null
    : null;

  if (
    (suggestion.action === "swap_to_recovery" ||
      suggestion.action === "swap_to_activation" ||
      suggestion.action === "reduce_load" ||
      suggestion.action === "increase_load") &&
    recommendedTemplate
  ) {
    const recommendedTemplateDayIndex =
      suggestion.recommendedTemplateDayIndex === undefined
        ? undefined
        : suggestion.recommendedTemplateDayIndex;

    targetItem.templateId = recommendedTemplate.id;
    targetItem.templateName = recommendedTemplate.name;
    targetItem.templateDayIndex = recommendedTemplateDayIndex ?? undefined;
    targetItem.microcycleType = recommendedTemplate.microcycleType || targetItem.microcycleType;
    targetItem.estimatedLoad = estimateTemplateLoadForDay(
      recommendedTemplate,
      recommendedTemplateDayIndex,
    );
    targetItem.reason = `${targetItem.reason}, manual suggestion applied`;
    targetItem.score = Number((targetItem.score + 1).toFixed(1));
    targetItem.historyBiases = historyBiasesFromPlannerSuggestion(suggestion);
  }

  if (suggestion.action === "move_day" || suggestion.action === "avoid_overlap") {
    const nextDayOffset = suggestion.targetDayOffset ?? suggestion.dayOffset + 1;
    const swapIndex = draftItems.findIndex(
      (item, index) => index !== targetIndex && item.dayOffset === nextDayOffset,
    );

    if (swapIndex >= 0) {
      draftItems[swapIndex].dayOffset = targetItem.dayOffset;
    }

    targetItem.dayOffset = nextDayOffset;
  }

  return recalculateTemplatePack(pack, draftItems);
}

function findPlannerSuggestionForBridge(
  suggestions: PlannerSuggestion[],
  bridge: AnalyticsPlannerBridge,
) {
  return (
    suggestions.find(
      (suggestion) =>
        suggestion.action === bridge.preferredAction &&
        (bridge.preferredSuggestionCode === null ||
          suggestion.code === bridge.preferredSuggestionCode) &&
        (bridge.dayOffset === null || suggestion.dayOffset === bridge.dayOffset),
    ) ??
    suggestions.find(
      (suggestion) =>
        bridge.preferredSuggestionCode !== null &&
        suggestion.code === bridge.preferredSuggestionCode,
    ) ??
    suggestions.find((suggestion) => suggestion.action === bridge.preferredAction) ??
    null
  );
}

type PageClientProps = {
  initialPreviewState?: WorkspacePreviewState | null;
  initialAuthMode?: AuthMode;
  initialGuestAccessOpen?: boolean;
  initialLanguage?: Language;
  initialLanguageLocked?: boolean;
  suppressSessionRestore?: boolean;
};

export function PageClient({
  initialPreviewState = null,
  initialAuthMode = "login",
  initialGuestAccessOpen = false,
  initialLanguage = "ru",
  initialLanguageLocked = false,
  suppressSessionRestore = false,
}: PageClientProps) {
  const previewState = initialPreviewState;
  const isPreviewMode = Boolean(previewState);
  const [language, setLanguage] = useState<Language>(previewState?.language ?? initialLanguage);
  const [authMode, setAuthMode] = useState<AuthMode>(initialAuthMode);
  const [guestAccessOpen, setGuestAccessOpen] = useState(initialGuestAccessOpen);
  const [authForm, setAuthForm] = useState<AuthFormState>(initialAuthForm);
  const [readinessForm, setReadinessForm] =
    useState<ReadinessFormValues>(READINESS_DEFAULTS);
  const [readinessEntryDate, setReadinessEntryDate] = useState(
    getDateInputValue(),
  );
  const [user, setUser] = useState<AuthUser | null>(previewState?.user ?? null);
  const [todayEntry, setTodayEntry] = useState<ReadinessEntry | null>(null);
  const [coachAthletes, setCoachAthletes] = useState<CoachAthleteSummary[]>(
    previewState?.coachAthletes ?? [],
  );
  const [availableCoachAthletes, setAvailableCoachAthletes] = useState<
    CoachAthleteSummary[]
  >([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>(
    previewState?.selectedAthleteId ?? "",
  );
  const [athleteProfileForm, setAthleteProfileForm] =
    useState<CoachAthleteProfilePayload>(emptyAthleteProfileForm);
  const [isAthleteProfileEditorOpen, setIsAthleteProfileEditorOpen] = useState(false);
  const [athleteProfileSaveState, setAthleteProfileSaveState] = useState<
    "idle" | "saving" | "saved" | "failed"
  >("idle");
  const [athleteProfileSaveMessage, setAthleteProfileSaveMessage] = useState("");
  const [selectedAthleteEntries, setSelectedAthleteEntries] = useState<
    ReadinessEntry[]
  >(previewState?.selectedAthleteEntries ?? []);
  const [planTemplates, setPlanTemplates] = useState<PlanTemplateSummary[]>(
    previewState?.planTemplates ?? [],
  );
  const [selectedPlanTemplateIds, setSelectedPlanTemplateIds] = useState<string[]>([]);
  const [planForm, setPlanForm] =
    useState<PlanTemplatePayload>(() => createLocalizedDefaultPlanTemplate(language));
  const [importedPlanDraft, setImportedPlanDraft] = useState<ImportedPlanDraft | null>(null);
  const [isTemplateDraftActive, setIsTemplateDraftActive] = useState(false);
  const [selectedTemplateDayIndex, setSelectedTemplateDayIndex] = useState(0);
  const [selectedTemplateAssignMode, setSelectedTemplateAssignMode] =
    useState<PlanAssignmentMode>("full");
  const [selectedTemplateAssignDayIndexes, setSelectedTemplateAssignDayIndexes] =
    useState<number[]>([]);
  const [assignedPlans, setAssignedPlans] = useState<AssignedPlanSummary[]>(
    previewState?.assignedPlans ?? [],
  );
  const [selectedAssignedPlanIds, setSelectedAssignedPlanIds] = useState<string[]>([]);
  const [competitions, setCompetitions] = useState<CompetitionSummary[]>(
    previewState?.competitions ?? [],
  );
  const [uwwSyncSummary, setUwwSyncSummary] = useState<UwwEventSyncResponse | null>(
    null,
  );
  const [uwwSyncFilters, setUwwSyncFilters] =
    useState<UwwEventSyncFilters>(initialUwwSyncFilters);
  const [uwwSyncOptions, setUwwSyncOptions] =
    useState<UwwEventSyncOptions>(emptyUwwSyncOptions);
  const [uwwSyncOptionsLoaded, setUwwSyncOptionsLoaded] = useState(false);
  const [selectedCompetitionIds, setSelectedCompetitionIds] = useState<string[]>([]);
  const [competitionPlans, setCompetitionPlans] = useState<CompetitionPlanSummary[]>(
    previewState?.competitionPlans ?? [],
  );
  const [mesocycles, setMesocycles] = useState<MesocycleSummary[]>(
    previewState?.mesocycles ?? [],
  );
  const [competitionReview, setCompetitionReview] =
    useState<CompetitionReviewOverview | null>(previewState?.competitionReview ?? null);
  const [templateRecommendations, setTemplateRecommendations] = useState<
    PlanTemplateRecommendation[]
  >([]);
  const [templatePack, setTemplatePack] = useState<TemplatePackRecommendation | null>(
    previewState?.templatePack ?? null,
  );
  const [templatePackContext, setTemplatePackContext] = useState<TemplatePackContext | null>(
    previewState?.templatePack
      ? {
          athleteId: previewState.selectedAthleteId,
          startDate:
            previewState.coachAnalyticsOverview.chain.weekSummary?.startDate ??
            initialMicrocycleForm.startDate,
        }
      : null,
  );
  const [seasons, setSeasons] = useState<SeasonSummary[]>(previewState?.seasons ?? []);
  const [olympicCycles, setOlympicCycles] = useState<OlympicCycleSummary[]>(
    previewState?.olympicCycles ?? [],
  );
  const [competitionContext, setCompetitionContext] = useState<CompetitionContext | null>(
    previewState?.competitionContext ?? null,
  );
  const [selectedAthleteCompetitionPlanId, setSelectedAthleteCompetitionPlanId] = useState("");
  const [competitionForm, setCompetitionForm] =
    useState<CreateCompetitionPayload>(initialCompetitionForm);
  const [olympicCycleForm, setOlympicCycleForm] =
    useState<CreateOlympicCyclePayload>(initialOlympicCycleForm);
  const [seasonForm, setSeasonForm] = useState<CreateSeasonPayload>(initialSeasonForm);
  const [competitionPlanForm, setCompetitionPlanForm] =
    useState<CreateCompetitionPlanPayload>(initialCompetitionPlanForm);
  const [mesocycleForm, setMesocycleForm] =
    useState<CreateMesocyclePayload>(initialMesocycleForm);
  const [competitionResultForm, setCompetitionResultForm] =
    useState<CompetitionResultPayload>(initialCompetitionResultForm);
  const [microcycleForm, setMicrocycleForm] =
    useState<AutoAssignMicrocyclePayload>(() => ({
      ...initialMicrocycleForm,
      notes: localizedMicrocycleNotes(language),
    }));
  const [adaptedPlan, setAdaptedPlan] = useState<AdaptedPlanDay | null>(null);
  const [executionResults, setExecutionResults] = useState<ExecutionResult[]>([]);
  const [executionDrafts, setExecutionDrafts] = useState<
    Record<string, ExecutionDraft>
  >({});
  const [analyticsOverview, setAnalyticsOverview] =
    useState<AnalyticsOverview | null>(null);
  const [coachAdaptedPlan, setCoachAdaptedPlan] = useState<AdaptedPlanDay | null>(
    null,
  );
  const [coachExecutionReview, setCoachExecutionReview] =
    useState<ExecutionReviewPlan | null>(previewState?.coachExecutionReview ?? null);
  const [coachDiaryEntries, setCoachDiaryEntries] = useState<CoachDiaryEntry[]>(
    previewState?.coachDiaryEntries ?? [],
  );
  const [coachDeviceHealthSummaries, setCoachDeviceHealthSummaries] = useState<
    DeviceHealthDailySummary[]
  >(previewState?.coachDeviceHealthSummaries ?? []);
  const [coachDeviceWorkouts, setCoachDeviceWorkouts] = useState<DeviceWorkout[]>(
    previewState?.coachDeviceWorkouts ?? [],
  );
  const [coachDeviceWorkoutLinks, setCoachDeviceWorkoutLinks] = useState<DeviceWorkoutLink[]>(
    previewState?.coachDeviceWorkoutLinks ?? [],
  );
  const [coachReadinessEntries, setCoachReadinessEntries] = useState<ReadinessEntry[]>(
    previewState?.selectedAthleteEntries ?? [],
  );
  const [coachDiaryDraft, setCoachDiaryDraft] =
    useState<CoachDiaryDraft>(emptyCoachDiaryDraft);
  const [coachAiReviews, setCoachAiReviews] = useState<CoachDayAiReview[]>([]);
  const [coachAiReviewBusy, setCoachAiReviewBusy] = useState(false);
  const [coachAiReviewMessage, setCoachAiReviewMessage] = useState("");
  const [coachAiStatus, setCoachAiStatus] = useState<CoachAiReviewStatus | null>(null);
  const [coachAiDiagnostic, setCoachAiDiagnostic] =
    useState<CoachAiReviewDiagnosticResponse | null>(null);
  const [coachAiDiagnosticBusy, setCoachAiDiagnosticBusy] = useState(false);
  const [coachAiDiagnosticMessage, setCoachAiDiagnosticMessage] = useState("");
  const [coachAnalyticsOverview, setCoachAnalyticsOverview] =
    useState<AnalyticsOverview | null>(
      normalizeAnalyticsOverview(previewState?.coachAnalyticsOverview ?? null),
    );
  const [assignedPlanForm, setAssignedPlanForm] =
    useState<AssignedPlanPayload>(() => ({
      ...initialAssignedPlanForm,
      dayLabel: localizedDayOneLabel(language),
      notes: localizedAssignedPlanNotes(language),
    }));
  const [statusMessage, setStatusMessage] = useState(
    previewState?.statusMessage ?? IMPORTED_UI_TEXT.en.signInHint,
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const initialOfflineQueue = previewState?.offlineQueueItems ?? [];
  const [offlineQueueSize, setOfflineQueueSize] = useState(
    importedCountActiveQueueItems(initialOfflineQueue),
  );
  const [isOffline, setIsOffline] = useState(previewState?.isOffline ?? false);
  const [offlineQueueItems, setOfflineQueueItems] = useState<QueueItem[]>(initialOfflineQueue);
  const [offlineSyncErrors, setOfflineSyncErrors] = useState<OfflineSyncErrors>(
    previewState?.offlineSyncErrors ?? importedGetQueueErrorMap(initialOfflineQueue),
  );
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [selectedOfflineItemId, setSelectedOfflineItemId] = useState(
    previewState?.selectedOfflineItemId ?? "",
  );
  const [coachView, setCoachView] = useState<CoachDashboardView>(
    previewState?.coachView ?? "readiness",
  );
  const [planningView, setPlanningView] = useState<PlanningStudioView>(
    previewState?.planningView ?? "weekly",
  );
  const [seasonDisplayMode, setSeasonDisplayMode] =
    useState<SeasonDisplayMode>("hybrid");
  const [seasonEditorMode, setSeasonEditorMode] = useState<SeasonEditorMode>(
    previewState?.seasonEditorMode ?? "starts",
  );
  const [selectedSeasonStartId, setSelectedSeasonStartId] = useState("");
  const [preparationPlanDraft, setPreparationPlanDraft] = useState<PreparationPlanReference>(
    () => createEmptyPreparationPlanDraft(language),
  );
  const [selectedPreparationWeekIndex, setSelectedPreparationWeekIndex] = useState(0);
  const [selectedPreparationDayIndex, setSelectedPreparationDayIndex] = useState(0);
  const [selectedPreparationSessionIndex, setSelectedPreparationSessionIndex] = useState(0);
  const [activeWorkspace, setActiveWorkspace] =
    useState<WorkspaceSectionId>(previewState?.activeWorkspace ?? "athlete-today");
  const [isCheckinOpen, setIsCheckinOpen] = useState(true);

  const t = (key: string) => COPY[language][key] ?? key;
  const ui = (key: string) =>
    IMPORTED_UI_TEXT[language]?.[key] ?? UI_TEXT[language]?.[key] ?? COPY[language]?.[key] ?? key;
  const analyticsInsightTitle = (insight: NonNullable<AnalyticsOverview["insights"]>[number]) =>
    importedTranslateAnalyticsInsightTitle(insight, language);
  const analyticsInsightSummary = (insight: NonNullable<AnalyticsOverview["insights"]>[number]) =>
    importedTranslateAnalyticsInsightSummary(insight, language);
  const analyticsInsightRecommendation = (
    insight: NonNullable<AnalyticsOverview["insights"]>[number],
  ) => importedTranslateAnalyticsInsightRecommendation(insight, language);
  const analyticsInsightLevel = (insight: NonNullable<AnalyticsOverview["insights"]>[number]) =>
    importedTranslateAnalyticsInsightLevel(insight.level, language);
  const analyticsSeverityLabel = (
    level: NonNullable<AnalyticsOverview["insights"]>[number]["level"],
  ) => importedTranslateAnalyticsInsightLevel(level, language);
  const analyticsEvidenceLabel = (label: string) =>
    importedTranslateAnalyticsEvidenceLabel(label, language);

  useEffect(() => {
    setPlanForm((current) =>
      isLocalizedDefaultPlanTemplate(current)
        ? createLocalizedDefaultPlanTemplate(language)
        : current,
    );
    setAssignedPlanForm((current) => ({
      ...current,
      dayLabel: isKnownDayOneLabel(current.dayLabel)
        ? localizedDayOneLabel(language)
        : current.dayLabel,
      notes: isKnownAssignedPlanNotes(current.notes)
        ? localizedAssignedPlanNotes(language)
        : current.notes,
    }));
    setMicrocycleForm((current) => ({
      ...current,
      notes: isKnownMicrocycleNotes(current.notes)
        ? localizedMicrocycleNotes(language)
        : current.notes,
      }));
  }, [language]);

  function canLoadCoachScopedAthleteData(
    athleteId: string,
    athletes: CoachAthleteSummary[] = coachAthletes,
    role: AuthUser["role"] | null = user?.role ?? null,
  ) {
    if (!athleteId) {
      return false;
    }

    if (role !== "coach") {
      return true;
    }

    return athletes.some((athlete) => athlete.athleteId === athleteId);
  }

  function resetCoachAthleteSelection() {
    setSelectedAthleteId("");
    setSelectedAthleteEntries([]);
    setCoachAdaptedPlan(null);
    setCoachExecutionReview(null);
    setCoachDiaryEntries([]);
    setCoachDeviceHealthSummaries([]);
    setCoachDeviceWorkoutLinks([]);
    setCoachDeviceWorkouts([]);
    setCoachReadinessEntries([]);
    setCoachDiaryDraft(emptyCoachDiaryDraft);
    setCoachAiReviews([]);
    setCoachAiReviewMessage("");
    setCoachAnalyticsOverview(null);
    setCompetitionContext(null);
    setCompetitionReview(null);
    setTemplateRecommendations([]);
    setTemplatePack(null);
    setTemplatePackContext(null);
    setSeasons([]);
    setCompetitionPlans([]);
    setMesocycles([]);
    setSeasonEditorMode("starts");
    setSelectedSeasonStartId("");
    setSeasonForm((current) => ({ ...current, athleteId: "" }));
    setCompetitionPlanForm((current) => ({ ...current, athleteId: "" }));
    setMesocycleForm((current) => ({ ...current, athleteId: "" }));
    setCompetitionResultForm(initialCompetitionResultForm);
    setAssignedPlanForm((current) => ({
      ...current,
      athleteId: "",
      plannedPhase: null,
    }));
    setMicrocycleForm((current) => ({
      ...current,
      athleteId: "",
      plannedPhase: null,
      items: [],
    }));
  }

  const analyticsCoachSuggestionTitle = (
    suggestion: NonNullable<AnalyticsOverview["coachSuggestions"]>[number],
  ) => importedTranslateAnalyticsCoachSuggestionTitle(suggestion, language);
  const analyticsCoachSuggestionSummary = (
    suggestion: NonNullable<AnalyticsOverview["coachSuggestions"]>[number],
  ) => importedTranslateAnalyticsCoachSuggestionSummary(suggestion, language);
  const analyticsCoachSuggestionRecommendation = (
    suggestion: NonNullable<AnalyticsOverview["coachSuggestions"]>[number],
  ) => importedTranslateAnalyticsCoachSuggestionRecommendation(suggestion, language);
  const analyticsDecisionStatus = (status: AnalyticsCoachActionDecision["decisionStatus"]) =>
    importedTranslateAnalyticsDecisionStatus(status, language);
  const analyticsDecisionOutcome = (outcome: AnalyticsCoachActionDecision["outcome"]) =>
    importedTranslateAnalyticsDecisionOutcome(outcome, language);
  const analyticsWeekStatus = (status: NonNullable<AnalyticsOverview["chain"]["weekSummary"]>["status"]) =>
    importedTranslateAnalyticsWeekStatus(status, language);
  const analyticsMissingLink = (link: string) =>
    importedTranslateAnalyticsMissingLink(link, language);
  const plannerSuggestionFeedbackLabel = (
    feedback: Pick<NonNullable<PlannerSuggestion["feedback"]>, "label">,
  ) => {
    if (feedback.label === "historically_effective") {
      return copyFor(language, {
        en: "Historically effective",
        ru: "Исторически эффективно",
        bg: "Исторически ефективно",
      });
    }

    if (feedback.label === "watch") {
      return copyFor(language, {
        en: "Watch closely",
        ru: "Нужен контроль",
        bg: "Нужен е контрол",
      });
    }

    if (feedback.label === "mixed") {
      return copyFor(language, {
        en: "Mixed outcomes",
        ru: "Смешанные исходы",
        bg: "Смесени резултати",
      });
    }

    return copyFor(language, {
      en: "New pattern",
      ru: "Новый паттерн",
      bg: "Нов патерн",
    });
  };
  const plannerSuggestionFeedbackScope = (
    feedback: Pick<NonNullable<PlannerSuggestion["feedback"]>, "scope">,
  ) => {
    if (feedback.scope === "exact_context") {
      return copyFor(language, {
        en: "same phase and priority",
        ru: "та же фаза и приоритет",
        bg: "същата фаза и приоритет",
      });
    }

    if (feedback.scope === "phase_context") {
      return copyFor(language, {
        en: "same phase",
        ru: "та же фаза",
        bg: "същата фаза",
      });
    }

    return copyFor(language, {
      en: "athlete history",
      ru: "история спортсмена",
      bg: "история на спортиста",
    });
  };
  const plannerSuggestionFeedbackSummary = (
    feedback: NonNullable<PlannerSuggestion["feedback"]>,
  ) =>
    copyFor(language, {
      en: `${plannerSuggestionFeedbackLabel(feedback)} • ${feedback.positiveCount} positive / ${feedback.negativeCount} negative • ${plannerSuggestionFeedbackScope(feedback)}`,
      ru: `${plannerSuggestionFeedbackLabel(feedback)} • ${feedback.positiveCount} позитивных / ${feedback.negativeCount} негативных • ${plannerSuggestionFeedbackScope(feedback)}`,
      bg: `${plannerSuggestionFeedbackLabel(feedback)} • ${feedback.positiveCount} положителни / ${feedback.negativeCount} негативни • ${plannerSuggestionFeedbackScope(feedback)}`,
    });
  const plannerHistoryBiasEffectLabel = (bias: TemplatePackHistoryBiasItem) =>
    bias.effect === "caution"
      ? copyFor(language, {
          en: "History caution",
          ru: "История предупреждает",
          bg: "Историята предупреждава",
        })
      : copyFor(language, {
          en: "History boost",
          ru: "История усиливает выбор",
          bg: "Историята подсилва избора",
        });
  const plannerHistoryBiasAction = (bias: TemplatePackHistoryBiasItem) => {
    if (bias.action === "swap_to_recovery") {
      return copyFor(language, {
        en: "recovery replacement",
        ru: "восстановительная замена",
        bg: "възстановителна замяна",
      });
    }

    if (bias.action === "swap_to_activation") {
      return copyFor(language, {
        en: "activation-safe replacement",
        ru: "безопасная активационная замена",
        bg: "безопасна активационна замяна",
      });
    }

    if (bias.action === "reduce_load") {
      return copyFor(language, {
        en: "lighter slot choice",
        ru: "более лёгкий слот",
        bg: "по-лек слот",
      });
    }

    if (bias.action === "increase_load") {
      return copyFor(language, {
        en: "higher-load choice",
        ru: "более нагруженный слот",
        bg: "по-натоварен слот",
      });
    }

    if (bias.action === "move_day") {
      return copyFor(language, {
        en: "day shift preference",
        ru: "предпочтение к сдвигу дня",
        bg: "предпочитание за местене на деня",
      });
    }

    return copyFor(language, {
      en: "overlap avoidance",
      ru: "избежание наложения",
      bg: "избягване на припокриване",
    });
  };
  const plannerHistoryBiasSummary = (bias: TemplatePackHistoryBiasItem) =>
    copyFor(language, {
      en: `${plannerHistoryBiasEffectLabel(bias)} • ${plannerHistoryBiasAction(
        bias,
      )} • ${plannerSuggestionFeedbackScope(bias)} • n=${bias.sampleSize}`,
      ru: `${plannerHistoryBiasEffectLabel(bias)} • ${plannerHistoryBiasAction(
        bias,
      )} • ${plannerSuggestionFeedbackScope(bias)} • n=${bias.sampleSize}`,
      bg: `${plannerHistoryBiasEffectLabel(bias)} • ${plannerHistoryBiasAction(
        bias,
      )} • ${plannerSuggestionFeedbackScope(bias)} • n=${bias.sampleSize}`,
    });
  const templatePackHistorySummary = summarizeTemplatePackHistory(templatePack);
  const syncQueueState = (items = importedGetOfflineQueue()) => {
    setOfflineQueueSize(importedCountActiveQueueItems(items));
    setOfflineQueueItems(items);
    setOfflineSyncErrors(importedGetQueueErrorMap(items));
    setSelectedOfflineItemId((current) =>
      items.some((item) => item.id === current) ? current : items[0]?.id || "",
    );
  };
  const translatedReadinessFields = READINESS_FIELD_META.map((field) => ({
    ...field,
    label:
      {
        sleepHours: { en: "Sleep, hours", ru: "Сон, часы", bg: "Сън, часове" },
        sleepQuality: { en: "Sleep quality", ru: "Качество сна", bg: "Качество на съня" },
        generalFeeling: { en: "General feeling", ru: "Общее самочувствие", bg: "Общо състояние" },
        fatigueLevel: { en: "Fatigue", ru: "Усталость", bg: "Умора" },
        muscleSoreness: { en: "Muscle soreness", ru: "Мышечная боль", bg: "Мускулна болезненост" },
        motivationLevel: { en: "Motivation", ru: "Мотивация", bg: "Мотивация" },
        restingHr: { en: "Resting HR", ru: "Пульс покоя", bg: "Пулс в покой" },
        bodyWeight: { en: "Body weight, kg", ru: "Вес, кг", bg: "Тегло, кг" },
        painLevel: { en: "Pain level", ru: "Уровень боли", bg: "Ниво на болка" },
        illnessFlag: { en: "Illness symptoms", ru: "Признаки болезни", bg: "Симптоми на заболяване" },
        feverFlag: { en: "Fever", ru: "Температура", bg: "Температура" },
      }[field.key][language],
  }));
  const readinessCacheSavedAt =
    previewState?.cacheSavedAt.readiness ??
    importedReadCachedData<{ entry: ReadinessEntry | null }>(
      STORAGE_KEYS.readiness,
    )?.savedAt;
  const assignedCacheSavedAt =
    previewState?.cacheSavedAt.assignedPlans ??
    importedReadCachedData<{ assignedPlans: AssignedPlanSummary[] }>(
      STORAGE_KEYS.assignedPlans,
    )?.savedAt;
  const adaptedCacheSavedAt =
    previewState?.cacheSavedAt.adaptedPlan ??
    importedReadCachedData<{ adaptedPlan: AdaptedPlanDay | null }>(
      STORAGE_KEYS.adaptedPlan,
    )?.savedAt;
  const executionCacheSavedAt =
    previewState?.cacheSavedAt.execution ??
    importedReadCachedData<{ results: ExecutionResult[] }>(
      STORAGE_KEYS.execution,
    )?.savedAt;
  const analyticsCacheSavedAt =
    previewState?.cacheSavedAt.analytics ??
    importedReadCachedData<{ analytics: AnalyticsOverview | null }>(
      STORAGE_KEYS.analytics,
    )?.savedAt;
  const readinessMeta = Object.fromEntries(
    Object.entries(READINESS_STATUS_META).map(([key, value]) => [
      key,
      {
        label:
          key === "green"
            ? language === "ru"
              ? "Зелёный"
              : language === "bg"
                ? "Зелен"
                : "Green"
            : key === "yellow"
              ? language === "ru"
                ? "Жёлтый"
                : language === "bg"
                  ? "Жълт"
                  : "Yellow"
              : language === "ru"
                ? "Красный"
                : language === "bg"
                  ? "Червен"
                  : "Red",
        loadRange:
          language === "ru"
            ? `Нагрузка ${value.loadRange}`
            : language === "bg"
              ? `Натоварване ${value.loadRange}`
              : value.loadRange,
        summary:
          key === "green"
            ? language === "ru"
              ? "Плановый тренировочный день можно оставить без изменений."
              : language === "bg"
                ? "Планираният тренировъчен ден може да остане без промяна."
                : value.summary
            : key === "yellow"
              ? language === "ru"
                ? "День требует частичного снижения объёма и интенсивности."
                : language === "bg"
                  ? "Денят изисква частично намаляване на обема и интензивността."
                  : value.summary
              : language === "ru"
                ? "День требует сильного снижения нагрузки или замены на восстановительную работу."
                : language === "bg"
                  ? "Денят изисква силно намаляване на натоварването или замяна с възстановителна работа."
                  : value.summary,
      },
    ]),
  ) as typeof READINESS_STATUS_META;

  function applyCachedAthleteSnapshot() {
    const cachedUser = importedReadCachedData<AuthUser>(OFFLINE_STORAGE_KEYS.authUser)?.data ?? null;
    const cachedReadiness =
      importedReadCachedData<{ entry: ReadinessEntry | null; entryDate?: string }>(
        OFFLINE_STORAGE_KEYS.readiness,
      )?.data ?? null;
    const cachedAssigned =
      importedReadCachedData<{ assignedPlans: AssignedPlanSummary[] }>(
        OFFLINE_STORAGE_KEYS.assignedPlans,
      )?.data ?? null;
    const cachedAdapted =
      importedReadCachedData<{ adaptedPlan: AdaptedPlanDay | null }>(
        OFFLINE_STORAGE_KEYS.adaptedPlan,
      )?.data ?? null;
    const cachedExecution =
      importedReadCachedData<{ results: ExecutionResult[] }>(OFFLINE_STORAGE_KEYS.execution)?.data ??
      null;
    const cachedAnalytics =
      importedReadCachedData<{ analytics: AnalyticsOverview | null }>(
        OFFLINE_STORAGE_KEYS.analytics,
      )?.data ?? null;

    if (cachedUser) {
      setUser(cachedUser);
    }

    if (cachedReadiness) {
      setTodayEntry(cachedReadiness.entry);
      setReadinessEntryDate(
        cachedReadiness.entryDate ?? cachedReadiness.entry?.entryDate ?? getDateInputValue(),
      );
      applyReadinessEntryToForm(cachedReadiness.entry);
    }

    if (cachedAssigned) {
      setAssignedPlans(cachedAssigned.assignedPlans);
    }

    if (cachedAdapted) {
      setAdaptedPlan(cachedAdapted.adaptedPlan);
    }

    if (cachedExecution) {
      setExecutionResults(cachedExecution.results);
      setExecutionDrafts(
        Object.fromEntries(
          cachedExecution.results.map((result) => [
            result.assignedBlockId,
            toExecutionDraft(result),
          ]),
        ),
      );
    }

    if (cachedAnalytics) {
      setAnalyticsOverview(normalizeAnalyticsOverview(cachedAnalytics.analytics));
    }
  }

  async function flushOfflineQueue() {
    let queue = importedGetOfflineQueue();
    const activeQueue = importedGetActiveQueueItems(queue);

    if (!activeQueue.length || (typeof navigator !== "undefined" && !navigator.onLine)) {
      syncQueueState(queue);
      return;
    }

    const commitQueue = (nextQueue: QueueItem[]) => {
      importedSetOfflineQueue(nextQueue);
      queue = importedGetOfflineQueue();
      syncQueueState(queue);
    };

    for (const item of activeQueue) {
      const attemptStartedAt = new Date().toISOString();
      commitQueue(
        importedUpdateQueueItem(queue, item.id, {
          attemptCount: item.attemptCount + 1,
          error: null,
          lastAttemptAt: attemptStartedAt,
          status: "syncing",
        }),
      );

      try {
        if (item.type === "readiness") {
          const response = await apiRequest<ReadinessResponse>("/readiness", {
            method: "POST",
            headers: { "X-Idempotency-Key": item.clientRequestId },
            body: JSON.stringify(item.payload),
          });
          if (response.entry.entryDate === readinessEntryDate) {
            setTodayEntry(response.entry);
            applyReadinessEntryToForm(response.entry);
            importedWriteCachedData(OFFLINE_STORAGE_KEYS.readiness, {
              entry: response.entry,
              entryDate: response.entry.entryDate,
            });
          }
        } else if (item.type === "execution") {
          const response = await apiRequest<{ result: ExecutionResult }>("/execution", {
            method: "POST",
            headers: { "X-Idempotency-Key": item.clientRequestId },
            body: JSON.stringify(item.payload),
          });
          setExecutionResults((current) => {
            const next = current.filter(
              (result) => result.assignedBlockId !== response.result.assignedBlockId,
            );
            next.unshift(response.result);
            importedWriteCachedData(OFFLINE_STORAGE_KEYS.execution, { results: next });
            return next;
          });
          setExecutionDrafts((current) => ({
            ...current,
            [response.result.assignedBlockId]: toExecutionDraft(response.result),
          }));
        } else if (item.type === "analytics-decision") {
          const response = await apiRequest<{
            analytics: AnalyticsOverview | null;
            decision: AnalyticsCoachActionDecision | null;
          }>(`/coach/athletes/${item.athleteId}/analytics-decisions`, {
            method: "POST",
            headers: { "X-Idempotency-Key": item.clientRequestId },
            body: JSON.stringify(item.payload),
          });
          const normalized = normalizeAnalyticsOverview(response.analytics);
          if (item.athleteId === selectedAthleteId) {
            setCoachAnalyticsOverview(normalized);
          }
        } else {
          const response = await apiRequest<{ entry: CoachDiaryEntry }>("/coach/diary", {
            method: "POST",
            headers: { "X-Idempotency-Key": item.clientRequestId },
            body: JSON.stringify(item.payload),
          });
          setCoachDiaryEntries((current) => upsertCoachDiaryEntry(current, response.entry));
        }
      } catch (error) {
        commitQueue(
          importedUpdateQueueItem(queue, item.id, {
            error:
              error instanceof Error && error.message
                ? error.message
                : `${ui("syncFailedPrefix")}.`,
            status: "failed",
          }),
        );
        continue;
      }

      commitQueue(
        importedUpdateQueueItem(queue, item.id, {
          error: null,
          status: "synced",
          syncedAt: new Date().toISOString(),
        }),
      );
    }

    const activeItemsLeft = importedCountActiveQueueItems(queue);
    if (activeItemsLeft === 0) {
      setStatusMessage(ui("offlineChangesSynced"));
      return;
    }

    setStatusMessage(importedQueueLabel(language, activeItemsLeft));
  }

  useEffect(() => {
    if (isPreviewMode || suppressSessionRestore) {
      return;
    }
    void refreshSession();
  }, [isPreviewMode, suppressSessionRestore]);

  useEffect(() => {
    if (isPreviewMode || initialLanguageLocked) {
      return;
    }
    const savedLanguage = window.localStorage.getItem(OFFLINE_STORAGE_KEYS.language);
    if (savedLanguage === "en" || savedLanguage === "ru" || savedLanguage === "bg") {
      setLanguage(savedLanguage);
    }
  }, [initialLanguageLocked, isPreviewMode]);

  useEffect(() => {
    window.localStorage.setItem(OFFLINE_STORAGE_KEYS.language, language);
  }, [language]);

  useEffect(() => {
    function preventInstallPrompt(event: Event) {
      event.preventDefault();
    }

    window.addEventListener("beforeinstallprompt", preventInstallPrompt);

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      );
    }

    if ("caches" in window) {
      void window.caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("training-platform-"))
            .map((key) => window.caches.delete(key)),
        ),
      );
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", preventInstallPrompt);
    };
  }, []);

  useEffect(() => {
    if (isPreviewMode || suppressSessionRestore) {
      return;
    }
    syncQueueState();
    setIsOffline(typeof navigator !== "undefined" ? !navigator.onLine : false);

    async function handleOnline() {
      setIsOffline(false);
      await flushOfflineQueue();
      await refreshSession();
    }

    function handleOffline() {
      setIsOffline(true);
      setStatusMessage(
        importedQueueLabel(language, importedCountActiveQueueItems(importedGetOfflineQueue())),
      );
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isPreviewMode, language, suppressSessionRestore]);

  async function refreshSession() {
    try {
      const response = await apiRequest<AuthResponse>("/auth/me");
      setUser(response.user);
      importedWriteCachedData(OFFLINE_STORAGE_KEYS.authUser, response.user);
      setErrorMessage("");
      setStatusMessage(`${ui("sessionRestored")} ${response.user.fullName}.`);

      if (response.user.role === "athlete") {
        setActiveWorkspace("athlete-today");
        if (response.user.athleteId) {
          await loadCompetitionContext(response.user.athleteId);
          await Promise.all([
            loadCompetitions(),
            loadOlympicCycles(),
            loadSeasons(),
            loadMesocycles(),
            loadCompetitionPlans(),
            loadCompetitionReview(response.user.athleteId),
          ]);
        }
        await Promise.all([
          loadReadiness(),
          loadAssignedPlans(),
          loadAdaptedPlan(),
          loadExecutionResults(),
          loadAnalyticsOverview(),
        ]);
      } else if (response.user.role === "coach" || response.user.role === "admin") {
        setTodayEntry(null);
        setAdaptedPlan(null);
        setExecutionResults([]);
        setExecutionDrafts({});
        setAnalyticsOverview(null);
        resetCoachAthleteSelection();
        setActiveWorkspace("coach-dashboard");
        await Promise.all([
          loadCoachAthletes(),
          loadAvailableCoachAthletes(),
          loadPlanTemplates(),
          loadAssignedPlans(),
          loadCompetitions(),
          loadOlympicCycles(),
          loadMesocycles(),
        ]);
      }
    } catch {
      applyCachedAthleteSnapshot();
      const cachedUser = importedReadCachedData<AuthUser>(OFFLINE_STORAGE_KEYS.authUser)?.data ?? null;

      if (!cachedUser) {
        setUser(null);
        setTodayEntry(null);
        setCoachAthletes([]);
        setAvailableCoachAthletes([]);
        setPlanTemplates([]);
        setSelectedPlanTemplateIds([]);
        setAssignedPlans([]);
        setSelectedAssignedPlanIds([]);
        setAdaptedPlan(null);
        setExecutionResults([]);
        setExecutionDrafts({});
        setAnalyticsOverview(null);
        resetCoachAthleteSelection();
        setCompetitions([]);
        setUwwSyncSummary(null);
        setUwwSyncOptions(emptyUwwSyncOptions);
        setUwwSyncOptionsLoaded(false);
        setSelectedCompetitionIds([]);
        setCompetitionPlans([]);
        setMesocycles([]);
        setSeasons([]);
        setOlympicCycles([]);
      } else {
        setStatusMessage(
          language === "ru"
            ? "Сеть недоступна. Загружены последние сохранённые данные."
            : language === "bg"
              ? "Няма връзка. Заредени са последните запазени данни."
              : ui("networkLoadedCache"),
        );
      }
    }
  }

  function applyReadinessEntryToForm(entry: ReadinessEntry | null) {
    if (entry) {
      setReadinessForm({
        sleepHours: entry.sleepHours,
        sleepQuality: entry.sleepQuality,
        generalFeeling: entry.generalFeeling,
        fatigueLevel: entry.fatigueLevel,
        muscleSoreness: entry.muscleSoreness,
        motivationLevel: entry.motivationLevel,
        restingHr: entry.restingHr,
        bodyWeight: entry.bodyWeight,
        painLevel: entry.painLevel,
        illnessFlag: entry.illnessFlag,
        feverFlag: entry.feverFlag,
      });
      return;
    }

    setReadinessForm(READINESS_DEFAULTS);
  }

  async function loadReadiness(entryDate = getDateInputValue()) {
    try {
      const response = await apiRequest<{ entry: ReadinessEntry | null }>(
        `/readiness/day?date=${encodeURIComponent(entryDate)}`,
      );
      setTodayEntry(response.entry);
      setReadinessEntryDate(entryDate);
      importedWriteCachedData(OFFLINE_STORAGE_KEYS.readiness, {
        ...response,
        entryDate,
      });

      applyReadinessEntryToForm(response.entry);
    } catch {
      const cached = importedReadCachedData<{
        entry: ReadinessEntry | null;
        entryDate?: string;
      }>(
        OFFLINE_STORAGE_KEYS.readiness,
      )?.data;
      if (cached && (cached.entryDate ?? cached.entry?.entryDate) === entryDate) {
        setTodayEntry(cached.entry);
        applyReadinessEntryToForm(cached.entry);
      }
    }
  }

  async function loadCoachAthletes(preferredAthleteId?: string) {
    const response = await apiRequest<{ athletes: CoachAthleteSummary[] }>(
      "/coach/athletes",
    );
    setCoachAthletes(response.athletes);

    if (response.athletes.length > 0) {
      const athleteId =
        (preferredAthleteId &&
        response.athletes.some((athlete) => athlete.athleteId === preferredAthleteId)
          ? preferredAthleteId
          : response.athletes.some((athlete) => athlete.athleteId === selectedAthleteId)
            ? selectedAthleteId
            : response.athletes[0]?.athleteId) ?? "";

      if (!athleteId) {
        return;
      }

      setSelectedAthleteId(athleteId);
      setSeasonForm((current) => ({ ...current, athleteId }));
      setCompetitionPlanForm((current) => ({ ...current, athleteId }));
      setMesocycleForm((current) => ({ ...current, athleteId }));
      setCompetitionResultForm(initialCompetitionResultForm);
      setSeasonEditorMode("starts");
      setSelectedSeasonStartId("");
      setAssignedPlanForm((current) => ({ ...current, athleteId }));
      setMicrocycleForm((current) => ({ ...current, athleteId }));
      await Promise.all([
        loadCoachAthleteReadiness(athleteId),
        loadCoachTeamDayData(response.athletes),
        loadCoachAdaptedPlan(athleteId),
        loadCoachExecutionReview(athleteId),
        loadCoachDiaryEntries(),
        loadCoachAnalyticsOverview(athleteId),
        loadCompetitionContext(athleteId),
        loadSeasons(athleteId),
        loadMesocycles(athleteId),
        loadCompetitionPlans(athleteId),
        loadCompetitionReview(athleteId),
        loadTemplateRecommendations(
          athleteId,
          initialAssignedPlanForm.startDate,
          response.athletes,
        ),
        loadTemplatePackRecommendations(
          athleteId,
          initialMicrocycleForm.startDate,
          response.athletes,
        ),
      ]);
    } else {
      resetCoachAthleteSelection();
    }
  }

  async function loadAvailableCoachAthletes() {
    const response = await apiRequest<CoachAvailableAthletesResponse>(
      "/coach/athletes/available",
    );
    setAvailableCoachAthletes(response.athletes);
  }

  async function loadCoachAthleteReadiness(athleteId: string) {
    const response = await apiRequest<{ entries: ReadinessEntry[] }>(
      `/coach/athletes/${athleteId}/readiness`,
    );
    setSelectedAthleteEntries(response.entries);
    setCoachReadinessEntries((current) => [
      ...current.filter((entry) => entry.athleteId !== athleteId),
      ...response.entries,
    ]);

    const latestEntry = response.entries[0];
    if (latestEntry) {
      setCoachAthletes((current) =>
        current.map((athlete) =>
          athlete.athleteId === athleteId
            ? {
                ...athlete,
                latestReadiness: {
                  entryDate: latestEntry.entryDate,
                  score: latestEntry.score,
                  status: latestEntry.status,
                },
              }
            : athlete,
        ),
      );
    }
  }

  async function loadCoachTeamDayData(athletes: CoachAthleteSummary[]) {
    const athleteIds = Array.from(new Set(athletes.map((athlete) => athlete.athleteId).filter(Boolean)));

    if (athleteIds.length === 0) {
      setCoachReadinessEntries([]);
      setCoachDeviceHealthSummaries([]);
      setCoachDeviceWorkoutLinks([]);
      setCoachDeviceWorkouts([]);
      setExecutionResults([]);
      return;
    }

    const [
      readinessResponses,
      deviceResponses,
      deviceWorkoutResponses,
      executionResponses,
    ] = await Promise.all([
      Promise.all(
        athleteIds.map((athleteId) =>
          apiRequest<{ entries: ReadinessEntry[] }>(
            `/coach/athletes/${encodeURIComponent(athleteId)}/readiness`,
          ).catch(() => ({ entries: [] })),
        ),
      ),
      Promise.all(
        athleteIds.map((athleteId) =>
          apiRequest<DeviceHealthDailySummariesResponse>(
            `/coach/athletes/${encodeURIComponent(athleteId)}/device-health`,
          ).catch(() => ({ summaries: [] })),
        ),
      ),
      Promise.all(
        athleteIds.map((athleteId) =>
          apiRequest<DeviceWorkoutsResponse>(
            `/coach/athletes/${encodeURIComponent(athleteId)}/device-workouts`,
          ).catch(() => ({ links: [], workouts: [] })),
        ),
      ),
      Promise.all(
        athleteIds.map((athleteId) =>
          apiRequest<{ results: ExecutionResult[] }>(
            `/coach/athletes/${encodeURIComponent(athleteId)}/execution`,
          ).catch(() => ({ results: [] })),
        ),
      ),
    ]);

    setCoachReadinessEntries(readinessResponses.flatMap((response) => response.entries));
    setCoachDeviceHealthSummaries(deviceResponses.flatMap((response) => response.summaries));
    setCoachDeviceWorkoutLinks(deviceWorkoutResponses.flatMap((response) => response.links ?? []));
    setCoachDeviceWorkouts(deviceWorkoutResponses.flatMap((response) => response.workouts));
    setExecutionResults(executionResponses.flatMap((response) => response.results));
  }

  async function loadPlanTemplates() {
    const response = await apiRequest<{ templates: PlanTemplateSummary[] }>(
      "/plans/templates",
    );
    setPlanTemplates(response.templates);
    setSelectedPlanTemplateIds((current) =>
      syncPlanTemplateSelection(current, response.templates),
    );
  }

  async function loadCompetitions() {
    const response = await apiRequest<{ competitions: CompetitionSummary[] }>(
      "/competitions",
    );
    setCompetitions(response.competitions);
    setSelectedCompetitionIds((current) =>
      syncCompetitionSelection(current, response.competitions),
    );
  }

  async function loadUwwSyncOptions() {
    const response = await apiRequest<UwwEventSyncOptionsResponse>(
      "/competitions/uww-options",
    );
    setUwwSyncOptions(response.options);
    setUwwSyncOptionsLoaded(true);
  }

  async function loadOlympicCycles() {
    const response = await apiRequest<{ olympicCycles: OlympicCycleSummary[] }>(
      "/olympic-cycles",
    );
    setOlympicCycles(response.olympicCycles);
  }

  async function loadSeasons(athleteId?: string) {
    const suffix = athleteId ? `?athleteId=${encodeURIComponent(athleteId)}` : "";
    const response = await apiRequest<{ seasons: SeasonSummary[] }>(`/seasons${suffix}`);
    setSeasons(response.seasons);
  }

  async function loadCompetitionPlans(athleteId?: string) {
    const suffix = athleteId ? `?athleteId=${encodeURIComponent(athleteId)}` : "";
    const response = await apiRequest<{ competitionPlans: CompetitionPlanSummary[] }>(
      `/competition-plans${suffix}`,
    );
    setCompetitionPlans(response.competitionPlans);
  }

  async function loadMesocycles(athleteId?: string) {
    const suffix = athleteId ? `?athleteId=${encodeURIComponent(athleteId)}` : "";
    const response = await apiRequest<{ mesocycles: MesocycleSummary[] }>(
      `/mesocycles${suffix}`,
    );
    setMesocycles(response.mesocycles);
  }

  async function loadCompetitionReview(athleteId: string) {
    const response = await apiRequest<{ review: CompetitionReviewOverview | null }>(
      `/competition-review/${athleteId}`,
    );
    setCompetitionReview(response.review);
  }

  async function loadTemplateRecommendations(
    athleteId: string,
    date: string,
    allowedAthletes: CoachAthleteSummary[] = coachAthletes,
  ) {
    if (!canLoadCoachScopedAthleteData(athleteId, allowedAthletes)) {
      setTemplateRecommendations([]);
      setAssignedPlanForm((current) =>
        current.athleteId === athleteId
          ? { ...current, athleteId: "", templateId: "", plannedPhase: null }
          : current,
      );
      return null;
    }

    let response: PlanTemplateRecommendationResponse;
    try {
      response = await apiRequest<PlanTemplateRecommendationResponse>(
        `/plans/template-recommendations?athleteId=${encodeURIComponent(athleteId)}&date=${encodeURIComponent(date)}`,
      );
    } catch (error) {
      if (error instanceof Error && error.message === "Athlete is not assigned to this coach") {
        setTemplateRecommendations([]);
        setAssignedPlanForm((current) =>
          current.athleteId === athleteId
            ? { ...current, athleteId: "", templateId: "", plannedPhase: null }
            : current,
        );
        return null;
      }

      throw error;
    }

    setTemplateRecommendations(response.recommendations);
    setAssignedPlanForm((current) => ({
      ...current,
      plannedPhase: response.competitionContext?.phase ?? current.plannedPhase ?? null,
      templateId: current.templateId || response.recommendations[0]?.templateId || current.templateId,
    }));
    return response;
  }

  async function loadTemplatePackRecommendations(
    athleteId: string,
    startDate: string,
    allowedAthletes: CoachAthleteSummary[] = coachAthletes,
  ) {
    if (!canLoadCoachScopedAthleteData(athleteId, allowedAthletes)) {
      setTemplatePack(null);
      setTemplatePackContext(null);
      setMicrocycleForm((current) =>
        current.athleteId === athleteId
          ? { ...current, athleteId: "", plannedPhase: null, items: [] }
          : current,
      );
      return null;
    }

    let response: TemplatePackRecommendationResponse;
    try {
      response = await apiRequest<TemplatePackRecommendationResponse>(
        `/plans/template-pack-recommendations?athleteId=${encodeURIComponent(athleteId)}&startDate=${encodeURIComponent(startDate)}`,
      );
    } catch (error) {
      if (error instanceof Error && error.message === "Athlete is not assigned to this coach") {
        setTemplatePack(null);
        setTemplatePackContext(null);
        setMicrocycleForm((current) =>
          current.athleteId === athleteId
            ? { ...current, athleteId: "", plannedPhase: null, items: [] }
            : current,
        );
        return null;
      }

      throw error;
    }

    setTemplatePack(response.pack);
    setTemplatePackContext({ athleteId, startDate });
    setMicrocycleForm((current) => ({
      ...current,
      plannedPhase:
        response.pack.mesocycleWeek?.phase ??
        response.competitionContext?.phase ??
        current.plannedPhase ??
        null,
      items: packToMicrocycleItems(response.pack),
      daysCount: response.pack.items.length || current.daysCount,
    }));
    return response;
  }

  async function loadCompetitionContext(athleteId: string) {
    const response = await apiRequest<{ context: CompetitionContext | null }>(
      `/competition-context/${athleteId}`,
    );
    setCompetitionContext(response.context);
  }

  async function loadAssignedPlans() {
    try {
      const response = await apiRequest<{ assignedPlans: AssignedPlanSummary[] }>(
        "/plans/assigned",
      );
      setAssignedPlans(response.assignedPlans);
      setSelectedAssignedPlanIds((current) =>
        syncAssignedPlanSelection(current, response.assignedPlans),
      );
      importedWriteCachedData(OFFLINE_STORAGE_KEYS.assignedPlans, response);
    } catch {
      const cached = importedReadCachedData<{ assignedPlans: AssignedPlanSummary[] }>(
        OFFLINE_STORAGE_KEYS.assignedPlans,
      )?.data;
      if (cached) {
        setAssignedPlans(cached.assignedPlans);
        setSelectedAssignedPlanIds((current) =>
          syncAssignedPlanSelection(current, cached.assignedPlans),
        );
      }
    }
  }

  async function loadExecutionResults() {
    try {
      const response = await apiRequest<{ results: ExecutionResult[] }>("/execution");
      setExecutionResults(response.results);
      importedWriteCachedData(OFFLINE_STORAGE_KEYS.execution, response);
      setExecutionDrafts((current) => {
        const next = { ...current };

        for (const result of response.results) {
          next[result.assignedBlockId] = toExecutionDraft(result);
        }

        return next;
      });
    } catch {
      const cached = importedReadCachedData<{ results: ExecutionResult[] }>(
        OFFLINE_STORAGE_KEYS.execution,
      )?.data;
      if (cached) {
        setExecutionResults(cached.results);
        setExecutionDrafts(
          Object.fromEntries(
            cached.results.map((result) => [result.assignedBlockId, toExecutionDraft(result)]),
          ),
        );
      }
    }
  }

  async function loadAnalyticsOverview() {
    try {
      const response = await apiRequest<{ analytics: AnalyticsOverview | null }>(
        "/analytics",
      );
      const normalized = normalizeAnalyticsOverview(response.analytics);
      setAnalyticsOverview(normalized);
      importedWriteCachedData(OFFLINE_STORAGE_KEYS.analytics, { analytics: normalized });
    } catch {
      const cached = importedReadCachedData<{ analytics: AnalyticsOverview | null }>(
        OFFLINE_STORAGE_KEYS.analytics,
      )?.data;
      if (cached) {
        setAnalyticsOverview(normalizeAnalyticsOverview(cached.analytics));
      }
    }
  }

  async function loadAdaptedPlan() {
    try {
      const response = await apiRequest<{ adaptedPlan: AdaptedPlanDay | null }>(
        "/adapted-plan",
      );
      setAdaptedPlan(response.adaptedPlan);
      importedWriteCachedData(OFFLINE_STORAGE_KEYS.adaptedPlan, response);
    } catch {
      const cached = importedReadCachedData<{ adaptedPlan: AdaptedPlanDay | null }>(
        OFFLINE_STORAGE_KEYS.adaptedPlan,
      )?.data;
      if (cached) {
        setAdaptedPlan(cached.adaptedPlan);
      }
    }
  }

  async function loadCoachAdaptedPlan(athleteId: string) {
    const response = await apiRequest<{ adaptedPlan: AdaptedPlanDay | null }>(
      `/coach/athletes/${athleteId}/adapted-plan`,
    );
    setCoachAdaptedPlan(response.adaptedPlan);
  }

  async function loadCoachExecutionReview(athleteId: string, assignedPlanId?: string) {
    const query = assignedPlanId ? `?assignedPlanId=${encodeURIComponent(assignedPlanId)}` : "";
    const response = await apiRequest<{ review: ExecutionReviewPlan | null }>(
      `/coach/athletes/${athleteId}/execution-review${query}`,
    );
    setCoachExecutionReview(response.review);
    if (response.review) {
      await loadCoachDeviceWorkoutsForDay(athleteId, response.review.dayDate).catch(() => null);
    }
  }

  async function loadCoachDeviceWorkoutsForDay(athleteId: string, entryDate: string) {
    const response = await apiRequest<DeviceWorkoutsResponse>(
      `/coach/athletes/${encodeURIComponent(athleteId)}/device-workouts?entryDate=${encodeURIComponent(entryDate)}`,
    );
    setCoachDeviceWorkoutLinks((current) =>
      (response.links ?? []).reduce(
        (items, link) => upsertDeviceWorkoutLink(items, link),
        current,
      ),
    );
    setCoachDeviceWorkouts((current) =>
      response.workouts.reduce(
        (items, workout) => upsertDeviceWorkout(items, workout),
        current,
      ),
    );
    return response;
  }

  async function loadCoachDiaryEntries() {
    const response = await apiRequest<{ entries: CoachDiaryEntry[] }>("/coach/diary");
    setCoachDiaryEntries(
      response.entries.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    );
  }

  async function loadCoachAiReviews() {
    const response = await apiRequest<CoachDayAiReviewHistoryResponse>("/coach/ai-day-reviews");
    setCoachAiReviews(response.reviews.slice().sort(sortCoachAiReviewsNewestFirst));
  }

  async function loadCoachAiReviewStatus() {
    const response = await apiRequest<CoachAiReviewStatusResponse>("/coach/ai-day-review/status");
    setCoachAiStatus(response.status);
    return response.status;
  }

  async function loadCoachAnalyticsOverview(athleteId: string) {
    const response = await apiRequest<{ analytics: AnalyticsOverview | null }>(
      `/coach/athletes/${athleteId}/analytics`,
    );
    setCoachAnalyticsOverview(normalizeAnalyticsOverview(response.analytics));
  }

  async function saveCoachDiaryEntry(
    payload: CoachDiaryEntryPayload,
    clientRequestId?: string,
  ) {
    const response = await apiRequest<{ entry: CoachDiaryEntry }>("/coach/diary", {
      method: "POST",
      headers: clientRequestId ? { "X-Idempotency-Key": clientRequestId } : undefined,
      body: JSON.stringify(payload),
    });
    setCoachDiaryEntries((current) => upsertCoachDiaryEntry(current, response.entry));
    return response.entry;
  }

  async function saveCoachAnalyticsDecision(
    athleteId: string,
    payload: AnalyticsCoachActionDecisionPayload,
    clientRequestId?: string,
  ) {
    const response = await apiRequest<{
      analytics: AnalyticsOverview | null;
      decision: AnalyticsCoachActionDecision | null;
    }>(`/coach/athletes/${athleteId}/analytics-decisions`, {
      method: "POST",
      headers: clientRequestId ? { "X-Idempotency-Key": clientRequestId } : undefined,
      body: JSON.stringify(payload),
    });
    const normalized = normalizeAnalyticsOverview(response.analytics);
    setCoachAnalyticsOverview(normalized);
    return {
      analytics: normalized,
      decision: response.decision,
    };
  }

  function enqueueAnalyticsDecision(
    athleteId: string,
    payload: AnalyticsCoachActionDecisionPayload,
    queueItem = importedCreateQueueItem({
      type: "analytics-decision",
      athleteId,
      payload,
    }),
  ) {
    const enqueueResult = importedEnqueueOfflineItem(queueItem);
    const nextQueueSize = importedCountActiveQueueItems(enqueueResult.queue);
    syncQueueState(enqueueResult.queue);
    setStatusMessage(
      copyFor(language, {
        en: `Analytics decision was queued offline. ${queueLabel(language, nextQueueSize)}`,
        ru: `Решение аналитики сохранено в офлайн-очередь. ${queueLabel(language, nextQueueSize)}`,
        bg: `Решението от анализа е добавено в офлайн опашката. ${queueLabel(language, nextQueueSize)}`,
      }),
    );
    return enqueueResult;
  }

  function enqueueCoachDiaryEntry(
    payload: CoachDiaryEntryPayload,
    queueItem = importedCreateQueueItem({
      type: "coach-diary",
      payload,
    }),
  ) {
    const now = new Date().toISOString();
    const optimisticEntry: CoachDiaryEntry = {
      id: `offline-${queueItem.clientRequestId}`,
      ...payload,
      coachUserId: user?.id ?? "",
      coachName: user?.fullName ?? copyFor(language, { en: "Coach", ru: "Тренер", bg: "Треньор" }),
      createdAt: now,
      updatedAt: now,
    };
    const enqueueResult = importedEnqueueOfflineItem(queueItem);
    const nextQueueSize = importedCountActiveQueueItems(enqueueResult.queue);
    setCoachDiaryEntries((current) => upsertCoachDiaryEntry(current, optimisticEntry));
    syncQueueState(enqueueResult.queue);
    setStatusMessage(
      copyFor(language, {
        en: `Coach note was saved locally and will sync later. ${queueLabel(language, nextQueueSize)}`,
        ru: `Запись тренера сохранена локально и будет отправлена позже. ${queueLabel(language, nextQueueSize)}`,
        bg: `Записът на треньора е запазен локално и ще бъде изпратен по-късно. ${queueLabel(language, nextQueueSize)}`,
      }),
    );
    return enqueueResult;
  }

  async function handleCoachDiarySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!coachExecutionReview || !selectedAthleteId) {
      return;
    }

    const notes = coachDiaryDraft.notes.trim();
    const assignedBlockIds =
      coachDiaryDraft.scope === "tasks" ? coachDiaryDraft.assignedBlockIds : [];
    const assignedExerciseIds =
      coachDiaryDraft.scope === "tasks" ? coachDiaryDraft.assignedExerciseIds : [];

    if (!notes) {
      setErrorMessage(
        copyFor(language, {
          en: "Add a note before saving.",
          ru: "Добавьте текст заметки перед сохранением.",
          bg: "Добавете текст на бележката преди запазване.",
        }),
      );
      return;
    }

    if (coachDiaryDraft.scope === "tasks" && assignedBlockIds.length + assignedExerciseIds.length === 0) {
      setErrorMessage(
        copyFor(language, {
          en: "Select at least one task for a task note.",
          ru: "Выберите хотя бы одно задание для записи по заданиям.",
          bg: "Изберете поне една задача за запис по задачи.",
        }),
      );
      return;
    }

    const payload: CoachDiaryEntryPayload = {
      athleteId: selectedAthleteId,
      assignedPlanId: coachExecutionReview.assignedPlanId,
      entryDate: coachExecutionReview.dayDate,
      scope: coachDiaryDraft.scope,
      notes,
      assignedBlockIds,
      assignedExerciseIds,
    };
    const queueItem = importedCreateQueueItem({
      type: "coach-diary",
      payload,
    });

    setBusy(true);
    setErrorMessage("");

    try {
      await saveCoachDiaryEntry(payload, queueItem.clientRequestId);
      setCoachDiaryDraft((current) => ({
        ...current,
        notes: "",
        assignedBlockIds: [],
        assignedExerciseIds: [],
      }));
      setStatusMessage(
        copyFor(language, {
          en: "Coach note saved.",
          ru: "Запись тренера сохранена.",
          bg: "Записът на треньора е запазен.",
        }),
      );
    } catch (error) {
      enqueueCoachDiaryEntry(payload, queueItem);
      setCoachDiaryDraft((current) => ({
        ...current,
        notes: "",
        assignedBlockIds: [],
        assignedExerciseIds: [],
      }));
      setErrorMessage(
        error instanceof Error && typeof navigator !== "undefined" && navigator.onLine
          ? error.message
          : "",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCoachReviewDayChange(assignedPlanId: string) {
    if (!selectedAthleteId || !assignedPlanId) {
      return;
    }

    setBusy(true);
    setErrorMessage("");
    setCoachDiaryDraft((current) => ({
      ...current,
      assignedBlockIds: [],
      assignedExerciseIds: [],
    }));

    try {
      await loadCoachExecutionReview(selectedAthleteId, assignedPlanId);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : copyFor(language, {
              en: "Could not load the selected day.",
              ru: "Не удалось загрузить выбранный день.",
              bg: "Избраният ден не можа да се зареди.",
            }),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleLinkDeviceWorkout(payload: DeviceWorkoutLinkPayload) {
    if (!selectedAthleteId) {
      return;
    }

    setBusy(true);
    setErrorMessage("");

    try {
      const response = await apiRequest<DeviceWorkoutLinkResponse>(
        `/coach/athletes/${encodeURIComponent(selectedAthleteId)}/device-workout-links`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
      setCoachDeviceWorkoutLinks((current) => upsertDeviceWorkoutLink(current, response.link));
      setCoachDeviceWorkouts((current) => upsertDeviceWorkout(current, response.link.workout));
      setStatusMessage(
        copyFor(language, {
          en: "Device workout linked to the plan block.",
          ru: "Тренировка устройства связана с блоком плана.",
          bg: "Тренировката от устройство е свързана с блока от плана.",
        }),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlinkDeviceWorkout(linkId: string) {
    if (!selectedAthleteId) {
      return;
    }

    setBusy(true);
    setErrorMessage("");

    try {
      await apiRequest<{ ok: boolean }>(
        `/coach/athletes/${encodeURIComponent(selectedAthleteId)}/device-workout-links/${encodeURIComponent(linkId)}`,
        { method: "DELETE" },
      );
      setCoachDeviceWorkoutLinks((current) => current.filter((link) => link.id !== linkId));
      setStatusMessage(
        copyFor(language, {
          en: "Device workout link removed.",
          ru: "Связь с тренировкой устройства удалена.",
          bg: "Връзката с тренировката от устройство е премахната.",
        }),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleRefreshCoachDeviceWorkouts() {
    if (!selectedAthleteId || !coachExecutionReview) {
      return;
    }

    setBusy(true);
    setErrorMessage("");

    try {
      const response = await loadCoachDeviceWorkoutsForDay(
        selectedAthleteId,
        coachExecutionReview.dayDate,
      );
      setStatusMessage(
        response.workouts.length
          ? copyFor(language, {
              en: "Device workouts for the selected day were refreshed.",
              ru: "Тренировки устройства за выбранный день обновлены.",
              bg: "Тренировките от устройство за избрания ден са обновени.",
            })
          : copyFor(language, {
              en: "No detailed device workouts were found for the selected day yet.",
              ru: "Детальные тренировки устройства за выбранный день пока не найдены.",
              bg: "Все още няма детайлни тренировки от устройство за избрания ден.",
            }),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  function updateCoachDiaryTarget(kind: CoachDiaryTaskChoice["kind"], id: string, checked: boolean) {
    const key = kind === "exercise" ? "assignedExerciseIds" : "assignedBlockIds";
    setCoachDiaryDraft((current) => {
      const nextIds = checked
        ? Array.from(new Set([...current[key], id]))
        : current[key].filter((item) => item !== id);

      return {
        ...current,
        [key]: nextIds,
      };
    });
  }

  function getExecutionDraft(blockId: string) {
    return executionDrafts[blockId] ?? emptyExecutionDraft;
  }

  function updateExecutionDraft(
    blockId: string,
    patch: Partial<ExecutionDraft>,
  ) {
    setExecutionDrafts((current) => ({
      ...current,
      [blockId]: {
        ...(current[blockId] ?? emptyExecutionDraft),
        ...patch,
      },
    }));
  }

  async function saveExecutionResult(
    assignedPlanId: string,
    assignedBlockId: string,
    clientRequestId?: string,
  ) {
    const draft = getExecutionDraft(assignedBlockId);
    const response = await apiRequest<{ result: ExecutionResult }>("/execution", {
      method: "POST",
      headers: clientRequestId ? { "X-Idempotency-Key": clientRequestId } : undefined,
      body: JSON.stringify({
        assignedPlanId,
        assignedBlockId,
        ...draft,
      }),
    });

    setExecutionResults((current) => {
      const next = current.filter((item) => item.assignedBlockId !== assignedBlockId);
      next.unshift(response.result);
      return next;
    });
    setExecutionDrafts((current) => ({
      ...current,
      [assignedBlockId]: toExecutionDraft(response.result),
    }));
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrorMessage("");

    try {
      const endpoint = authMode === "login" ? "/auth/login" : "/auth/register";
      const payload =
        authMode === "login"
          ? { email: authForm.email, password: authForm.password }
          : authForm;

      const response = await apiRequest<AuthResponse>(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", "/workspace");
      }

      setUser(response.user);
      setGuestAccessOpen(false);
      scrollViewportToTop();
      setStatusMessage(
        authMode === "login"
          ? `${ui("signedInAs")} ${response.user.fullName}.`
          : `${ui("accountCreatedFor")} ${response.user.fullName}.`,
      );

      if (response.user.role === "athlete") {
        setActiveWorkspace("athlete-today");
        if (response.user.athleteId) {
          await loadCompetitionContext(response.user.athleteId);
          await Promise.all([loadCompetitions(), loadOlympicCycles(), loadSeasons(), loadCompetitionPlans()]);
        }
        await Promise.all([
          loadReadiness(),
          loadAssignedPlans(),
          loadAdaptedPlan(),
          loadExecutionResults(),
          loadAnalyticsOverview(),
        ]);
      } else {
        setTodayEntry(null);
        setAdaptedPlan(null);
        setExecutionResults([]);
        setExecutionDrafts({});
        setAnalyticsOverview(null);
        resetCoachAthleteSelection();
        setActiveWorkspace("coach-dashboard");
        await Promise.all([
          loadCoachAthletes(),
          loadAvailableCoachAthletes(),
          loadCoachAiReviews(),
          loadCoachAiReviewStatus(),
          loadPlanTemplates(),
          loadAssignedPlans(),
          loadCompetitions(),
          loadOlympicCycles(),
        ]);
      }

      scrollViewportToTop();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : ui("authFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);

    try {
      await apiRequest("/auth/logout", { method: "POST" });
      setUser(null);
      scrollViewportToTop();
      setTodayEntry(null);
      setCoachAthletes([]);
      setAvailableCoachAthletes([]);
      setPlanTemplates([]);
      setSelectedPlanTemplateIds([]);
      setAssignedPlans([]);
      setSelectedAssignedPlanIds([]);
      setAdaptedPlan(null);
      setExecutionResults([]);
      setExecutionDrafts({});
      setAnalyticsOverview(null);
      resetCoachAthleteSelection();
      setCompetitions([]);
      setUwwSyncSummary(null);
      setUwwSyncOptions(emptyUwwSyncOptions);
      setUwwSyncOptionsLoaded(false);
      setSelectedCompetitionIds([]);
      setCompetitionPlans([]);
      setSeasons([]);
      setOlympicCycles([]);
      setStatusMessage(ui("sessionClosed"));
      scrollViewportToTop();
      window.location.assign("/");
      return;
    } finally {
      setBusy(false);
    }
  }

  async function handleReadinessSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrorMessage("");
    const payload: ReadinessSubmissionPayload = {
      ...readinessForm,
      entryDate: readinessEntryDate,
    };
    const queueItem = importedCreateQueueItem({
      type: "readiness",
      payload,
    });

    try {
      const response = await apiRequest<ReadinessResponse>("/readiness", {
        method: "POST",
        headers: { "X-Idempotency-Key": queueItem.clientRequestId },
        body: JSON.stringify(payload),
      });
      setTodayEntry(response.entry);
      setReadinessEntryDate(response.entry.entryDate);
      importedWriteCachedData(OFFLINE_STORAGE_KEYS.readiness, {
        entry: response.entry,
        entryDate: response.entry.entryDate,
      });
      setStatusMessage(ui("readinessSaved"));
      if (response.entry.entryDate === getDateInputValue()) {
        await loadAdaptedPlan();
      }
      await loadAnalyticsOverview();
    } catch (error) {
      const enqueueResult = importedEnqueueOfflineItem(queueItem);
      const nextQueueSize = importedCountActiveQueueItems(enqueueResult.queue);
      syncQueueState(enqueueResult.queue);
      setStatusMessage(
        language === "ru"
          ? `Готовность сохранена в офлайн-очередь. ${queueLabel(language, nextQueueSize)}`
          : language === "bg"
            ? `Готовността е добавена в офлайн опашката. ${queueLabel(language, nextQueueSize)}`
            : `Readiness was queued offline. ${queueLabel(language, nextQueueSize)}`,
      );
      setErrorMessage(
        error instanceof Error && typeof navigator !== "undefined" && navigator.onLine
          ? error.message
          : "",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleReadinessDateChange(entryDate: string) {
    setReadinessEntryDate(entryDate);
    void loadReadiness(entryDate);
  }

  async function handleExecutionSave(assignedPlanId: string, assignedBlockId: string) {
    setBusy(true);
    setErrorMessage("");
    const draft = getExecutionDraft(assignedBlockId);
    const queueItem = importedCreateQueueItem({
      type: "execution",
      payload: { assignedPlanId, assignedBlockId, ...draft },
    });

    try {
      await saveExecutionResult(
        assignedPlanId,
        assignedBlockId,
        queueItem.clientRequestId,
      );
      await loadAnalyticsOverview();
      setStatusMessage(ui("executionSaved"));
    } catch (error) {
      const optimisticResult: ExecutionResult = {
        id: `offline-${assignedBlockId}`,
        athleteId: user?.athleteId ?? "",
        assignedPlanId,
        assignedBlockId,
        completed: draft.completed,
        setsCompleted: draft.setsCompleted,
        repsCompleted: draft.repsCompleted,
        weightKg: draft.weightKg,
        durationMinutes: draft.durationMinutes,
        rpe: draft.rpe,
        notes: draft.notes,
        completedAt: draft.completed ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      };

      setExecutionResults((current) => {
        const next = current.filter((item) => item.assignedBlockId !== assignedBlockId);
        next.unshift(optimisticResult);
        importedWriteCachedData(OFFLINE_STORAGE_KEYS.execution, { results: next });
        return next;
      });

      const enqueueResult = importedEnqueueOfflineItem(queueItem);
      const nextQueueSize = importedCountActiveQueueItems(enqueueResult.queue);
      syncQueueState(enqueueResult.queue);
      setStatusMessage(
        language === "ru"
          ? `Выполнение сохранено локально и будет отправлено позже. ${queueLabel(language, nextQueueSize)}`
          : language === "bg"
            ? `Изпълнението е запазено локално и ще бъде изпратено по-късно. ${queueLabel(language, nextQueueSize)}`
            : `Execution was saved locally and will sync later. ${queueLabel(language, nextQueueSize)}`,
      );
      setErrorMessage(
        error instanceof Error && typeof navigator !== "undefined" && navigator.onLine
          ? error.message
          : "",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCoachAthleteChange(athleteId: string) {
    if (!canLoadCoachScopedAthleteData(athleteId)) {
      resetCoachAthleteSelection();
      return;
    }

    setSelectedAthleteId(athleteId);
    setSeasonForm((current) => ({ ...current, athleteId }));
    setCompetitionPlanForm((current) => ({ ...current, athleteId }));
    setMesocycleForm((current) => ({
      ...current,
      athleteId,
      seasonId: null,
      competitionPlanId: null,
    }));
    setCompetitionResultForm(initialCompetitionResultForm);
    setSeasonEditorMode("starts");
    setSelectedSeasonStartId("");
    setAssignedPlanForm((current) => ({ ...current, athleteId }));
    setMicrocycleForm((current) => ({ ...current, athleteId }));
    setBusy(true);

    try {
      await Promise.all([
        loadCoachAthleteReadiness(athleteId),
        loadCoachAdaptedPlan(athleteId),
        loadCoachExecutionReview(athleteId),
        loadCoachDiaryEntries(),
        loadCoachAnalyticsOverview(athleteId),
        loadCompetitionContext(athleteId),
        loadSeasons(athleteId),
        loadCompetitionPlans(athleteId),
        loadMesocycles(athleteId),
        loadCompetitionReview(athleteId),
        loadTemplateRecommendations(athleteId, assignedPlanForm.startDate, coachAthletes),
        loadTemplatePackRecommendations(athleteId, microcycleForm.startDate, coachAthletes),
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function handleAttachCoachAthlete(athleteId: string) {
    setBusy(true);
    setErrorMessage("");

    try {
      const response = await apiRequest<CoachAttachAthleteResponse>(
        `/coach/athletes/${athleteId}/assign`,
        {
          method: "POST",
        },
      );

      setStatusMessage(
        copyFor(language, {
          en: `${response.athlete.fullName} was attached to your roster.`,
          ru: `${response.athlete.fullName}: спортсмен добавлен в ваш список.`,
          bg: `${response.athlete.fullName} е прикрепена към вашия списък със спортисти.`,
        }),
      );
      await Promise.all([
        loadCoachAthletes(response.athlete.athleteId),
        loadAvailableCoachAthletes(),
      ]);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : copyFor(language, {
              en: "Failed to attach athlete.",
              ru: "Не удалось прикрепить спортсмена.",
              bg: "Спортистът не можа да бъде прикрепен.",
            }),
      );
    } finally {
      setBusy(false);
    }
  }

  async function createPlanTemplateFromDraft(payload: PlanTemplatePayload) {
    const response = await apiRequest<{ template: PlanTemplateSummary }>("/plans/templates", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const latestTemplates = await apiRequest<{ templates: PlanTemplateSummary[] }>(
      "/plans/templates",
    );

    setPlanTemplates(latestTemplates.templates);
    setAssignedPlanForm((current) => ({
      ...current,
      templateId: response.template.id,
    }));
    setSelectedTemplateDayIndex(0);
    setSelectedTemplateAssignDayIndexes([]);
    setImportedPlanDraft(null);
    setIsTemplateDraftActive(false);
    return response.template;
  }

  function getCurrentTemplatePayload() {
    if (importedPlanDraft) {
      return importedPlanDraft.template;
    }

    if (isTemplateDraftActive) {
      return planForm;
    }

    return activePlanTemplate
      ? templateSummaryToPayload(activePlanTemplate, language)
      : planForm;
  }

  function syncImportedDraftTemplate(
    draft: ImportedPlanDraft,
    template: PlanTemplatePayload,
  ): ImportedPlanDraft {
    const days = template.days ?? [];

    return {
      ...draft,
      title: template.name || draft.title,
      description: template.description || draft.description,
      template,
      days: draft.days.map((day, index) => {
        const templateDay = days[index];

        return {
          ...day,
          label: templateDay?.label ?? day.label,
          template: {
            ...template,
            days: templateDay ? [templateDay] : day.template.days,
          },
        };
      }),
    };
  }

  function updateTemplateWorkspaceDraft(
    updater: (template: PlanTemplatePayload) => PlanTemplatePayload,
  ) {
    const nextTemplate = updater(getCurrentTemplatePayload());

    setPlanForm(nextTemplate);
    setIsTemplateDraftActive(true);

    if (importedPlanDraft) {
      setImportedPlanDraft((current) =>
        current ? syncImportedDraftTemplate(current, nextTemplate) : current,
      );
    }
  }

  function getEditableTemplateDays(template: PlanTemplatePayload) {
    return template.days?.length ? template.days : getTemplateStructureDays(template, language);
  }

  function updateTemplateDayDraft(
    dayIndex: number,
    updater: (day: PlanTemplateDayInput) => PlanTemplateDayInput,
  ) {
    updateTemplateWorkspaceDraft((template) => {
      const days = getEditableTemplateDays(template);

      if (!days.length) {
        return template;
      }

      return {
        ...template,
        days: days.map((day, index) => (index === dayIndex ? updater(day) : day)),
      };
    });
  }

  function updateTemplateSessionDraft(
    dayIndex: number,
    sessionIndex: number,
    updater: (session: PlanTemplateSessionInput) => PlanTemplateSessionInput,
  ) {
    updateTemplateDayDraft(dayIndex, (day) => ({
      ...day,
      sessions: day.sessions.map((session, index) =>
        index === sessionIndex ? updater(session) : session,
      ),
    }));
  }

  function getEditableBlockExercises(
    block: PlanTemplatePayload["blocks"][number],
    blockIndex: number,
  ): PlanExerciseInput[] {
    if (block.exercises?.length) {
      return block.exercises;
    }

    return [
      {
        name: block.name,
        targetSets: block.targetSets,
        targetReps: block.targetReps,
        targetWeightKg: null,
        targetDurationMinutes: block.targetDurationMinutes,
        targetRpe: block.targetRpe,
        notes: block.notes,
        displayOrder: blockIndex,
      },
    ];
  }

  function rebuildTemplateExerciseBlock(
    block: PlanTemplatePayload["blocks"][number],
    exerciseIndex: number,
    patch: Partial<{
      name: string;
      work: string;
      control: string;
    }>,
  ) {
    const exercises = getEditableBlockExercises(block, exerciseIndex);
    const currentExercise = exercises[exerciseIndex] ?? exercises[0];
    const nextName = patch.name ?? currentExercise.name;
    const nextWork =
      patch.work ??
      formatExerciseWorkCell(currentExercise, language).replace(/^-$/u, "");
    const nextControl =
      patch.control ??
      formatExerciseControlCell(currentExercise, language).replace(/^-$/u, "");
    const parsedBlock = createImportedPlanBlock(
      nextName,
      nextWork,
      nextControl,
      currentExercise.displayOrder ?? exerciseIndex,
    );
    const parsedExercise = {
      ...(parsedBlock.exercises?.[0] ?? currentExercise),
      name: nextName,
    };
    const nextExercises = exercises.map((exercise, index) =>
      index === exerciseIndex
        ? {
            ...parsedExercise,
            displayOrder: exercise.displayOrder ?? index,
          }
        : exercise,
    );

    return exerciseIndex === 0
      ? {
          ...block,
          ...parsedBlock,
          name: nextName || parsedBlock.name,
          exercises: nextExercises,
        }
      : {
          ...block,
          exercises: nextExercises,
        };
  }

  function updateTemplateExerciseRow(
    dayIndex: number,
    sessionIndex: number,
    blockIndex: number,
    exerciseIndex: number,
    patch: Partial<{
      name: string;
      work: string;
      control: string;
    }>,
  ) {
    updateTemplateSessionDraft(dayIndex, sessionIndex, (session) => ({
      ...session,
      blocks: session.blocks.map((block, index) =>
        index === blockIndex
          ? rebuildTemplateExerciseBlock(block, exerciseIndex, patch)
          : block,
      ),
    }));
  }

  function addTemplateExerciseRow(dayIndex: number, sessionIndex: number) {
    updateTemplateSessionDraft(dayIndex, sessionIndex, (session) => ({
      ...session,
      blocks: [
        ...session.blocks,
        createImportedPlanBlock(
          copyFor(language, {
            en: "New exercise",
            ru: "Новое упражнение",
            bg: "Ново упражнение",
          }),
          "",
          "",
          session.blocks.length,
        ),
      ],
    }));
  }

  function removeTemplateExerciseRow(
    dayIndex: number,
    sessionIndex: number,
    blockIndex: number,
    exerciseIndex: number,
  ) {
    updateTemplateSessionDraft(dayIndex, sessionIndex, (session) => ({
      ...session,
      blocks: session.blocks.flatMap((block, index) => {
        if (index !== blockIndex) {
          return [block];
        }

        const exercises = getEditableBlockExercises(block, blockIndex);

        if (exercises.length <= 1) {
          return [];
        }

        return [
          {
            ...block,
            exercises: exercises.filter((_, itemIndex) => itemIndex !== exerciseIndex),
          },
        ];
      }),
    }));
  }

  async function handlePlanTemplateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrorMessage("");

    try {
      await createPlanTemplateFromDraft(planForm);
      setStatusMessage(ui("templateCreated"));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : ui("templateRequestFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveCurrentPlanTemplate() {
    setBusy(true);
    setErrorMessage("");

    try {
      await createPlanTemplateFromDraft(getCurrentTemplatePayload());
      setStatusMessage(ui("templateCreated"));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : ui("templateRequestFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDeletePlanTemplate(template: PlanTemplateSummary) {
    async function deleteTemplate(force = false) {
      await apiRequest(`/plans/templates/${template.id}${force ? "?force=true" : ""}`, {
        method: "DELETE",
      });
      setStatusMessage(
        force
          ? copyFor(language, {
              en: "Template and assigned plans deleted.",
              ru: "Шаблон и его назначения удалены.",
              bg: "Шаблонът и назначенията му са изтрити.",
            })
          : copyFor(language, {
              en: "Template deleted.",
              ru: "Шаблон удалён.",
              bg: "Шаблонът е изтрит.",
            }),
      );
      setPlanTemplates((current) => current.filter((item) => item.id !== template.id));
      setSelectedPlanTemplateIds((current) => current.filter((id) => id !== template.id));
      const removedAssignedPlanIds = new Set(
        assignedPlans
          .filter((plan) => plan.templateId === template.id)
          .map((plan) => plan.id),
      );
      setAssignedPlans((current) => current.filter((plan) => plan.templateId !== template.id));
      setSelectedAssignedPlanIds((current) =>
        current.filter((id) => !removedAssignedPlanIds.has(id)),
      );
      setAssignedPlanForm((current) =>
        current.templateId === template.id ? { ...current, templateId: "" } : current,
      );
      await Promise.all([loadPlanTemplates(), loadAssignedPlans()]);
    }

    const confirmed = globalThis.confirm(
      copyFor(language, {
        en: `Delete template "${translateKnownTemplateText(template.name, language)}"?`,
        ru: `Удалить шаблон «${translateKnownTemplateText(template.name, language)}»?`,
        bg: `Да се изтрие ли шаблонът „${translateKnownTemplateText(template.name, language)}“?`,
      }),
    );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setErrorMessage("");

    try {
      await deleteTemplate(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const isTemplateInUse =
        message.includes("already assigned") || message.includes("cannot be deleted");

      if (isTemplateInUse) {
        const forceConfirmed = globalThis.confirm(
          copyFor(language, {
            en: "This template is already assigned to athletes. Delete it together with all assigned training days?",
            ru: "Этот шаблон уже назначен спортсменам. Удалить его вместе со всеми назначенными тренировочными днями?",
            bg: "Този шаблон вече е назначен на спортисти. Да се изтрие ли заедно с всички назначени тренировъчни дни?",
          }),
        );

        if (forceConfirmed) {
          try {
            await deleteTemplate(true);
          } catch (forceError) {
            setErrorMessage(
              forceError instanceof Error
                ? forceError.message
                : copyFor(language, {
                    en: "Failed to delete assigned template.",
                    ru: "Не удалось удалить назначенный шаблон.",
                    bg: "Назначеният шаблон не можа да бъде изтрит.",
                  }),
            );
          }
        }

        return;
      }

      const fallback = copyFor(language, {
        en: "Failed to delete template.",
        ru: "Не удалось удалить шаблон.",
        bg: "Шаблонът не можа да бъде изтрит.",
      });

      setErrorMessage(message || fallback);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSelectedPlanTemplates() {
    const selectedTemplates = planTemplates.filter((template) =>
      selectedPlanTemplateIds.includes(template.id),
    );

    if (!selectedTemplates.length) {
      return;
    }

    const confirmed = globalThis.confirm(
      copyFor(language, {
        en: `Delete ${selectedTemplates.length} selected saved template(s)?`,
        ru: `Удалить выбранные сохранённые шаблоны: ${selectedTemplates.length}?`,
        bg: `Да се изтрият ли избраните запазени шаблони: ${selectedTemplates.length}?`,
      }),
    );

    if (!confirmed) {
      return;
    }

    const deletedTemplateIds = new Set<string>();
    const templatesInUse: PlanTemplateSummary[] = [];

    setBusy(true);
    setErrorMessage("");

    try {
      for (const template of selectedTemplates) {
        try {
          await apiRequest(`/plans/templates/${template.id}`, {
            method: "DELETE",
          });
          deletedTemplateIds.add(template.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          const isTemplateInUse =
            message.includes("already assigned") || message.includes("cannot be deleted");

          if (!isTemplateInUse) {
            throw error;
          }

          templatesInUse.push(template);
        }
      }

      if (templatesInUse.length) {
        const forceConfirmed = globalThis.confirm(
          copyFor(language, {
            en: `${templatesInUse.length} selected template(s) are already assigned. Delete them together with their assigned training days?`,
            ru: `${templatesInUse.length} выбранных шаблонов уже назначены спортсменам. Удалить их вместе с назначенными тренировочными днями?`,
            bg: `${templatesInUse.length} от избраните шаблони вече са назначени на спортисти. Да се изтрият ли заедно с назначените тренировъчни дни?`,
          }),
        );

        if (forceConfirmed) {
          for (const template of templatesInUse) {
            await apiRequest(`/plans/templates/${template.id}?force=true`, {
              method: "DELETE",
            });
            deletedTemplateIds.add(template.id);
          }
        }
      }

      setSelectedPlanTemplateIds((current) =>
        current.filter((id) => !deletedTemplateIds.has(id)),
      );
      setSelectedAssignedPlanIds((current) =>
        current.filter(
          (id) =>
            !assignedPlans.some(
              (plan) => plan.id === id && deletedTemplateIds.has(plan.templateId),
            ),
        ),
      );
      setAssignedPlanForm((current) =>
        deletedTemplateIds.has(current.templateId) ? { ...current, templateId: "" } : current,
      );
      await Promise.all([loadPlanTemplates(), loadAssignedPlans()]);
      setStatusMessage(
        deletedTemplateIds.size > 0
          ? copyFor(language, {
              en: `Deleted templates: ${deletedTemplateIds.size}.`,
              ru: `Удалено шаблонов: ${deletedTemplateIds.size}.`,
              bg: `Изтрити шаблони: ${deletedTemplateIds.size}.`,
            })
          : copyFor(language, {
              en: "No templates were deleted.",
              ru: "Шаблоны не удалены.",
              bg: "Няма изтрити шаблони.",
            }),
      );
    } catch (error) {
      await Promise.all([loadPlanTemplates(), loadAssignedPlans()]);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : copyFor(language, {
              en: "Failed to delete selected templates.",
              ru: "Не удалось удалить выбранные шаблоны.",
              bg: "Избраните шаблони не можаха да бъдат изтрити.",
            }),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSelectedAssignedPlans() {
    const selectedPlans = assignedPlans.filter((plan) =>
      selectedAssignedPlanIds.includes(plan.id),
    );

    if (!selectedPlans.length) {
      return;
    }

    const confirmed = globalThis.confirm(
      copyFor(language, {
        en: `Delete ${selectedPlans.length} selected assigned training day(s)? Linked results for these assignments will also be deleted.`,
        ru: `Удалить выбранные назначенные дни: ${selectedPlans.length}? Связанные результаты по этим назначениям тоже будут удалены.`,
        bg: `Да се изтрият ли избраните назначени тренировъчни дни: ${selectedPlans.length}? Свързаните резултати за тези назначения също ще бъдат изтрити.`,
      }),
    );

    if (!confirmed) {
      return;
    }

    const selectedIds = new Set(selectedPlans.map((plan) => plan.id));
    const previousAssignedPlans = assignedPlans;
    const previousSelectedIds = selectedAssignedPlanIds;

    setBusy(true);
    setErrorMessage("");
    setAssignedPlans((current) => current.filter((plan) => !selectedIds.has(plan.id)));
    setSelectedAssignedPlanIds([]);

    try {
      await Promise.all(
        selectedPlans.map((plan) =>
          apiRequest(`/plans/assigned/${plan.id}`, {
            method: "DELETE",
          }),
        ),
      );
      setStatusMessage(
        copyFor(language, {
          en: "Selected assigned training days deleted.",
          ru: "Выбранные назначенные дни удалены.",
          bg: "Избраните назначени тренировъчни дни са изтрити.",
        }),
      );
      await Promise.all([loadAssignedPlans(), loadCoachAthletes()]);

      if (canLoadCoachScopedAthleteData(selectedAthleteId)) {
        await Promise.all([
          loadCoachAdaptedPlan(selectedAthleteId),
          loadCoachExecutionReview(selectedAthleteId),
          loadCoachAnalyticsOverview(selectedAthleteId),
        ]);
      }
    } catch (error) {
      setAssignedPlans(previousAssignedPlans);
      setSelectedAssignedPlanIds(previousSelectedIds);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : copyFor(language, {
              en: "Failed to delete selected assigned plans.",
              ru: "Не удалось удалить выбранные назначения.",
              bg: "Избраните назначения не можаха да бъдат изтрити.",
            }),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handlePlanFileImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setErrorMessage("");

    try {
      const text = await file.text();
      const draft = parseImportedPlanHtml(text, file.name, language);
      const firstDay = draft.days[0];

      setImportedPlanDraft(draft);
      setPlanForm(draft.template);
      setIsTemplateDraftActive(true);
      setSelectedTemplateDayIndex(0);
      setSelectedTemplateAssignMode("full");
      setSelectedTemplateAssignDayIndexes([]);
      setAssignedPlanForm((current) => ({
        ...current,
        templateId: "",
        startDate: draft.startDate,
        dayLabel: firstDay.label,
        notes: "",
      }));
      setStatusMessage(
        copyFor(language, {
          en: `Imported ${draft.days.length} training day(s) as one plan template. Save and assign the full plan.`,
          ru: `Импортировано дней: ${draft.days.length}. План будет сохранён одним шаблоном и назначен полностью.`,
          bg: `Импортирани дни: ${draft.days.length}. Планът ще бъде запазен като един шаблон и назначен изцяло.`,
        }),
      );
    } catch (error) {
      setImportedPlanDraft(null);
      setIsTemplateDraftActive(false);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : copyFor(language, {
              en: "Plan import failed.",
              ru: "Не удалось импортировать план.",
              bg: "Планът не можа да бъде импортиран.",
            }),
      );
    } finally {
      event.target.value = "";
    }
  }

  async function handleAssignImportedPlan() {
    if (!importedPlanDraft) {
      return;
    }

    setBusy(true);
    setErrorMessage("");

    try {
      const athleteId = selectedAthleteId || assignedPlanForm.athleteId;

      if (!athleteId) {
        throw new Error(
          copyFor(language, {
            en: "Select an athlete in the top menu first.",
            ru: "Сначала выберите спортсмена в верхнем меню.",
            bg: "Първо изберете спортист от горното меню.",
          }),
        );
      }

      const templateResponse = await apiRequest<{ template: PlanTemplateSummary }>("/plans/templates", {
        method: "POST",
        body: JSON.stringify(importedPlanDraft.template),
      });
      const createdItems: TemplatePackItem[] = importedPlanDraft.days.map((day) => ({
        templateId: templateResponse.template.id,
        templateDayIndex: day.templateDayIndex,
        dayOffset: day.dayOffset,
        dayLabel: day.label,
        microcycleType: day.template.templateGoal || day.template.microcycleType,
      }));

      const startDate = assignedPlanForm.startDate || importedPlanDraft.startDate;
      const maxOffset = Math.max(...createdItems.map((item) => item.dayOffset), 0);
      const payload: AutoAssignMicrocyclePayload = {
        athleteId,
        startDate,
        daysCount: maxOffset + 1,
        notes: assignedPlanForm.notes,
        plannedPhase: assignedPlanForm.plannedPhase,
        items: createdItems,
      };
      const response = await apiRequest<{ assignedPlans: AssignedPlanSummary[] }>(
        "/plans/auto-assign-microcycle",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );

      setAssignedPlanForm((current) => ({
        ...current,
        athleteId,
        startDate,
        templateId: templateResponse.template.id,
        dayLabel: createdItems[0]?.dayLabel ?? current.dayLabel,
      }));
      setMicrocycleForm((current) => ({
        ...current,
        ...payload,
      }));
      setStatusMessage(
        copyFor(language, {
          en: `Full plan assigned: ${response.assignedPlans.length} day(s).`,
          ru: `План назначен полностью: ${response.assignedPlans.length} дн.`,
          bg: `Планът е назначен изцяло: ${response.assignedPlans.length} дни.`,
        }),
      );
      await Promise.all([loadPlanTemplates(), loadAssignedPlans(), loadCoachAthletes()]);
      if (canLoadCoachScopedAthleteData(athleteId)) {
        await Promise.all([
          loadCoachAdaptedPlan(athleteId),
          loadCoachExecutionReview(athleteId),
          loadCoachAnalyticsOverview(athleteId),
          loadTemplatePackRecommendations(athleteId, startDate, coachAthletes),
        ]);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : copyFor(language, {
              en: "Imported plan assignment failed.",
              ru: "Не удалось назначить импортированный план.",
              bg: "Импортираният план не можа да бъде назначен.",
            }),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleAssignActivePlanTemplate() {
    const draftTemplatePayload = isTemplateDraftActive ? planForm : null;

    if (!draftTemplatePayload && !activePlanTemplate) {
      return;
    }

    const athleteId = selectedAthleteId;

    if (!athleteId) {
      setErrorMessage(
        copyFor(language, {
          en: "Select an athlete in the top menu first.",
          ru: "Сначала выберите спортсмена в верхнем меню.",
          bg: "Първо изберете спортист от горното меню.",
        }),
      );
      return;
    }

    const sourceDays = draftTemplatePayload
      ? getTemplateStructureDays(draftTemplatePayload, language)
      : activeTemplateDays;

    if (!sourceDays.length) {
      setErrorMessage(
        copyFor(language, {
          en: "The selected plan has no training days to assign.",
          ru: "В выбранном плане нет тренировочных дней для назначения.",
          bg: "Избраният план няма тренировъчни дни за назначаване.",
        }),
      );
      return;
    }

    setBusy(true);
    setErrorMessage("");

    try {
      const sourceTemplate = draftTemplatePayload
        ? await createPlanTemplateFromDraft(draftTemplatePayload)
        : activePlanTemplate;

      if (!sourceTemplate) {
        return;
      }

      const items = buildTemplateAssignmentItems({
        template: sourceTemplate,
        days: sourceDays,
        mode: selectedTemplateAssignMode,
        selectedDayIndex: selectedTemplateDayIndex,
        selectedDayIndexes: selectedTemplateAssignDayIndexes,
      });

      if (!items.length) {
        throw new Error(
          copyFor(language, {
            en: "The selected plan has no training days to assign.",
            ru: "В выбранном плане нет тренировочных дней для назначения.",
            bg: "Избраният план няма тренировъчни дни за назначаване.",
          }),
        );
      }

      const maxOffset = Math.max(...items.map((item) => item.dayOffset), 0);
      const payload: AutoAssignMicrocyclePayload = {
        athleteId,
        startDate: assignedPlanForm.startDate,
        daysCount: maxOffset + 1,
        notes:
          assignedPlanForm.notes ||
          copyFor(language, {
            en: `Assigned from ${sourceTemplate.name}`,
            ru: `Назначено из плана ${sourceTemplate.name}`,
            bg: `Назначено от плана ${sourceTemplate.name}`,
          }),
        plannedPhase: assignedPlanForm.plannedPhase,
        items,
      };
      const response = await apiRequest<{ assignedPlans: AssignedPlanSummary[] }>(
        "/plans/auto-assign-microcycle",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );

      setAssignedPlanForm((current) => ({
        ...current,
        athleteId,
        templateId: sourceTemplate.id,
        dayLabel: items[0]?.dayLabel ?? current.dayLabel,
      }));
      setMicrocycleForm((current) => ({
        ...current,
        ...payload,
      }));
      setStatusMessage(
        copyFor(language, {
          en: `Plan assigned: ${response.assignedPlans.length} training day(s).`,
          ru: `План назначен: ${response.assignedPlans.length} тренировочных дн.`,
          bg: `Планът е назначен: ${response.assignedPlans.length} тренировъчни дни.`,
        }),
      );
      await Promise.all([loadAssignedPlans(), loadCoachAthletes()]);

      if (canLoadCoachScopedAthleteData(athleteId)) {
        await Promise.all([
          loadCoachAdaptedPlan(athleteId),
          loadCoachExecutionReview(athleteId),
          loadCoachAnalyticsOverview(athleteId),
          loadTemplatePackRecommendations(athleteId, assignedPlanForm.startDate, coachAthletes),
        ]);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : copyFor(language, {
              en: "Failed to assign the selected plan.",
              ru: "Не удалось назначить выбранный план.",
              bg: "Избраният план не можа да бъде назначен.",
            }),
      );
    } finally {
      setBusy(false);
    }
  }

  function addPlanBlockExercise(blockIndex: number, exercise: PlanExerciseInput) {
    setPlanForm((current) => ({
      ...current,
      blocks: current.blocks.map((block, index) =>
        index === blockIndex
          ? {
              ...block,
              exercises: [
                ...(block.exercises ?? []),
                {
                  ...exercise,
                  displayOrder: block.exercises?.length ?? 0,
                },
              ],
            }
          : block,
      ),
    }));
  }

  function updatePlanBlockExercise(
    blockIndex: number,
    exerciseIndex: number,
    patch: Partial<PlanExerciseInput>,
  ) {
    setPlanForm((current) => ({
      ...current,
      blocks: current.blocks.map((block, index) =>
        index === blockIndex
          ? {
              ...block,
              exercises: (block.exercises ?? []).map((exercise, currentExerciseIndex) =>
                currentExerciseIndex === exerciseIndex ? { ...exercise, ...patch } : exercise,
              ),
            }
          : block,
      ),
    }));
  }

  function removePlanBlockExercise(blockIndex: number, exerciseIndex: number) {
    setPlanForm((current) => ({
      ...current,
      blocks: current.blocks.map((block, index) =>
        index === blockIndex
          ? {
              ...block,
              exercises: (block.exercises ?? [])
                .filter((_, currentExerciseIndex) => currentExerciseIndex !== exerciseIndex)
                .map((exercise, nextIndex) => ({ ...exercise, displayOrder: nextIndex })),
            }
          : block,
      ),
    }));
  }

  function updatePreparationPlanDraft(patch: Partial<PreparationPlanReference>) {
    setPreparationPlanDraft((current) => ({ ...current, ...patch }));
  }

  function updatePreparationMetric(
    metricIndex: number,
    patch: Partial<PreparationPlanReference["metrics"][number]>,
  ) {
    setPreparationPlanDraft((current) => ({
      ...current,
      metrics: current.metrics.map((metric, currentMetricIndex) =>
        currentMetricIndex === metricIndex ? { ...metric, ...patch } : metric,
      ),
    }));
  }

  function addPreparationMetric() {
    setPreparationPlanDraft((current) => ({
      ...current,
      metrics: [
        ...current.metrics,
        {
          label: copyFor(language, {
            en: "New module",
            ru: "Новый модуль",
            bg: "Нов модул",
          }),
          value: "",
          tone: "blue",
        },
      ],
    }));
  }

  function removePreparationMetric(metricIndex: number) {
    setPreparationPlanDraft((current) => ({
      ...current,
      metrics: current.metrics.filter((_, currentMetricIndex) => currentMetricIndex !== metricIndex),
    }));
  }

  function updatePreparationPhase(phaseIndex: number, value: string) {
    setPreparationPlanDraft((current) => ({
      ...current,
      phases: current.phases.map((phase, currentPhaseIndex) =>
        currentPhaseIndex === phaseIndex ? value : phase,
      ),
    }));
  }

  function removePreparationPhase(phaseIndex: number) {
    setPreparationPlanDraft((current) => ({
      ...current,
      phases: current.phases.filter((_, currentPhaseIndex) => currentPhaseIndex !== phaseIndex),
    }));
  }

  function addPreparationPhase() {
    setPreparationPlanDraft((current) => ({
      ...current,
      phases: [
        ...current.phases,
        copyFor(language, {
          en: "New phase - dates and focus",
          ru: "Новый этап - даты и фокус",
          bg: "Нов етап - дати и фокус",
        }),
      ],
    }));
  }

  function updatePreparationGuidance(color: "green" | "yellow" | "red", value: string) {
    setPreparationPlanDraft((current) => ({
      ...current,
      weeks: current.weeks.map((week, weekIndex) =>
        weekIndex === selectedPreparationWeekIndex
          ? {
              ...week,
              days: week.days.map((day, dayIndex) =>
                dayIndex === selectedPreparationDayIndex
                  ? {
                      ...day,
                      guidance: {
                        green: day.guidance?.green ?? "",
                        yellow: day.guidance?.yellow ?? "",
                        red: day.guidance?.red ?? "",
                        [color]: value,
                      },
                    }
                  : day,
              ),
            }
          : week,
      ),
    }));
  }

  function updatePreparationSessionTitle(value: string) {
    setPreparationPlanDraft((current) => ({
      ...current,
      weeks: current.weeks.map((week, weekIndex) =>
        weekIndex === selectedPreparationWeekIndex
          ? {
              ...week,
              days: week.days.map((day, dayIndex) =>
                dayIndex === selectedPreparationDayIndex
                  ? {
                      ...day,
                      sessions: day.sessions.map((session, sessionIndex) =>
                        sessionIndex === selectedPreparationSessionIndex
                          ? { ...session, title: value }
                          : session,
                      ),
                    }
                  : day,
              ),
            }
          : week,
      ),
    }));
  }

  function updatePreparationRow(rowIndex: number, patch: Partial<PreparationPlanTableRow>) {
    setPreparationPlanDraft((current) => ({
      ...current,
      weeks: current.weeks.map((week, weekIndex) =>
        weekIndex === selectedPreparationWeekIndex
          ? {
              ...week,
              days: week.days.map((day, dayIndex) =>
                dayIndex === selectedPreparationDayIndex
                  ? {
                      ...day,
                      sessions: day.sessions.map((session, sessionIndex) =>
                        sessionIndex === selectedPreparationSessionIndex
                          ? {
                              ...session,
                              rows: session.rows.map((row, currentRowIndex) =>
                                currentRowIndex === rowIndex ? { ...row, ...patch } : row,
                              ),
                            }
                          : session,
                      ),
                    }
                  : day,
              ),
            }
          : week,
      ),
    }));
  }

  function addPreparationExerciseFromPreset(preset: BlockExercisePreset) {
    setPreparationPlanDraft((current) => ({
      ...current,
      weeks: current.weeks.map((week, weekIndex) =>
        weekIndex === selectedPreparationWeekIndex
          ? {
              ...week,
              days: week.days.map((day, dayIndex) =>
                dayIndex === selectedPreparationDayIndex
                  ? {
                      ...day,
                      sessions: day.sessions.map((session, sessionIndex) =>
                        sessionIndex === selectedPreparationSessionIndex
                          ? {
                              ...session,
                              rows: [
                                ...session.rows,
                                buildPreparationRowFromPreset(preset, language),
                              ],
                            }
                          : session,
                      ),
                    }
                  : day,
              ),
            }
          : week,
      ),
    }));
  }

  function removePreparationRow(rowIndex: number) {
    setPreparationPlanDraft((current) => ({
      ...current,
      weeks: current.weeks.map((week, weekIndex) =>
        weekIndex === selectedPreparationWeekIndex
          ? {
              ...week,
              days: week.days.map((day, dayIndex) =>
                dayIndex === selectedPreparationDayIndex
                  ? {
                      ...day,
                      sessions: day.sessions.map((session, sessionIndex) =>
                        sessionIndex === selectedPreparationSessionIndex
                          ? {
                              ...session,
                              rows: session.rows.filter(
                                (_, currentRowIndex) => currentRowIndex !== rowIndex,
                              ),
                            }
                          : session,
                      ),
                    }
                  : day,
              ),
            }
          : week,
      ),
    }));
  }

  function addPreparationWeek() {
    setPreparationPlanDraft((current) => {
      const nextIndex = current.weeks.length;
      return {
        ...current,
        weeks: [
          ...current.weeks,
          {
            title: `${copyFor(language, { en: "New week", ru: "Новая неделя", bg: "Нова седмица" })} ${
              nextIndex + 1
            }`,
            days: [
              {
                title: copyFor(language, { en: "New day", ru: "Новый день", bg: "Нов ден" }),
                type: copyFor(language, { en: "Training focus", ru: "Фокус тренировки", bg: "Фокус на тренировката" }),
                sessions: [
                  {
                    title: copyFor(language, { en: "Session", ru: "Сессия", bg: "Сесия" }),
                    columns: ["Блок", "Объём", "Контроль"],
                    rows: [
                      {
                        block: copyFor(language, { en: "Block", ru: "Блок", bg: "Блок" }),
                        volume: "",
                        control: "",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };
    });
    setSelectedPreparationWeekIndex(preparationPlanDraft.weeks.length);
    setSelectedPreparationDayIndex(0);
    setSelectedPreparationSessionIndex(0);
  }

  function addPreparationDay() {
    setPreparationPlanDraft((current) => ({
      ...current,
      weeks: current.weeks.map((week, weekIndex) =>
        weekIndex === selectedPreparationWeekIndex
          ? {
              ...week,
              days: [
                ...week.days,
                {
                  title: copyFor(language, { en: "New day", ru: "Новый день", bg: "Нов ден" }),
                  type: copyFor(language, { en: "Training focus", ru: "Фокус тренировки", bg: "Фокус на тренировката" }),
                  sessions: [
                    {
                      title: copyFor(language, { en: "Session", ru: "Сессия", bg: "Сесия" }),
                      columns: ["Блок", "Объём", "Контроль"],
                      rows: [
                        {
                          block: copyFor(language, { en: "Block", ru: "Блок", bg: "Блок" }),
                          volume: "",
                          control: "",
                        },
                      ],
                    },
                  ],
                },
              ],
            }
          : week,
      ),
    }));
    setSelectedPreparationDayIndex(selectedPreparationWeek?.days.length ?? 0);
    setSelectedPreparationSessionIndex(0);
  }

  function addPreparationSession() {
    setPreparationPlanDraft((current) => ({
      ...current,
      weeks: current.weeks.map((week, weekIndex) =>
        weekIndex === selectedPreparationWeekIndex
          ? {
              ...week,
              days: week.days.map((day, dayIndex) =>
                dayIndex === selectedPreparationDayIndex
                  ? {
                      ...day,
                      sessions: [
                        ...day.sessions,
                        {
                          title: copyFor(language, { en: "Session", ru: "Сессия", bg: "Сесия" }),
                          columns: ["Блок", "Объём", "Контроль"],
                          rows: [
                            {
                              block: copyFor(language, { en: "Block", ru: "Блок", bg: "Блок" }),
                              volume: "",
                              control: "",
                            },
                          ],
                        },
                      ],
                    }
                  : day,
              ),
            }
          : week,
      ),
    }));
    setSelectedPreparationSessionIndex(selectedPreparationDay?.sessions.length ?? 0);
  }

  function addPreparationRow() {
    setPreparationPlanDraft((current) => ({
      ...current,
      weeks: current.weeks.map((week, weekIndex) =>
        weekIndex === selectedPreparationWeekIndex
          ? {
              ...week,
              days: week.days.map((day, dayIndex) =>
                dayIndex === selectedPreparationDayIndex
                  ? {
                      ...day,
                      sessions: day.sessions.map((session, sessionIndex) =>
                        sessionIndex === selectedPreparationSessionIndex
                          ? {
                              ...session,
                              rows: [
                                ...session.rows,
                                {
                                  block: copyFor(language, { en: "Block", ru: "Блок", bg: "Блок" }),
                                  volume: "",
                                  control: "",
                                },
                              ],
                            }
                          : session,
                      ),
                    }
                  : day,
              ),
            }
          : week,
      ),
    }));
  }

  async function handleAssignPlanSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrorMessage("");

    try {
      await apiRequest("/plans/assign", {
        method: "POST",
        body: JSON.stringify(assignedPlanForm),
      });
      setStatusMessage(ui("templateAssigned"));
      await loadAssignedPlans();
      await loadCoachAthletes();
      if (canLoadCoachScopedAthleteData(assignedPlanForm.athleteId)) {
        await loadTemplateRecommendations(
          assignedPlanForm.athleteId,
          assignedPlanForm.startDate,
          coachAthletes,
        );
      }
      if (assignedPlanForm.athleteId === selectedAthleteId) {
        await Promise.all([
          loadCoachAdaptedPlan(assignedPlanForm.athleteId),
          loadCoachExecutionReview(assignedPlanForm.athleteId),
          loadCoachAnalyticsOverview(assignedPlanForm.athleteId),
        ]);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : ui("planAssignmentFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCompetitionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrorMessage("");

    try {
      await apiRequest("/competitions", {
        method: "POST",
        body: JSON.stringify(competitionForm),
      });
      setStatusMessage("Competition created.");
      setCompetitionForm(initialCompetitionForm);
      await loadCompetitions();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Competition request failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleUwwEventSync() {
    setBusy(true);
    setErrorMessage("");

    try {
      const response = await apiRequest<UwwEventSyncResponse>(
        "/competitions/uww-sync",
        {
          method: "POST",
          body: JSON.stringify(uwwSyncFilters),
        },
      );
      setCompetitions(response.competitions);
      setSelectedCompetitionIds((current) =>
        syncCompetitionSelection(current, response.competitions),
      );
      setUwwSyncSummary(response);
      setUwwSyncOptions(response.options);
      setUwwSyncOptionsLoaded(true);
      setStatusMessage(
        copyFor(language, {
          en: `UWW calendar synced: ${response.addedCount} added, ${response.updatedCount} updated.`,
          ru: `Календарь UWW обновлён: добавлено ${response.addedCount}, обновлено ${response.updatedCount}.`,
          bg: `Календарът UWW е обновен: добавени ${response.addedCount}, обновени ${response.updatedCount}.`,
        }),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "UWW sync request failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteCompetition(competition: CompetitionSummary) {
    await handleDeleteCompetitions([competition]);
  }

  async function requestDeleteCompetitions(
    payload: DeleteCompetitionsPayload,
  ): Promise<DeleteCompetitionsResponse> {
    try {
      return await apiRequest<DeleteCompetitionsResponse>("/competitions/bulk-delete", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (primaryError) {
      try {
        return await apiRequest<DeleteCompetitionsResponse>("/competitions/delete", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      } catch {
        if (payload.competitionIds.length === 0) {
          throw primaryError;
        }

        let linkedPlanCount = 0;

        for (const competitionId of payload.competitionIds) {
          const response = await apiRequest<{
            deletedCompetitionId: string;
            linkedPlanCount: number;
          }>(`/competitions/${competitionId}`, {
            method: "DELETE",
          });
          linkedPlanCount += response.linkedPlanCount;
        }

        const competitionsResponse = await apiRequest<{
          competitions: CompetitionSummary[];
        }>("/competitions");

        return {
          deletedCompetitionIds: payload.competitionIds,
          linkedPlanCount,
          competitions: competitionsResponse.competitions,
        };
      }
    }
  }

  async function handleDeleteSelectedCompetitions() {
    await handleDeleteCompetitions(selectedCalendarCompetitions);
  }

  async function handleDeleteCompetitions(items: CompetitionSummary[]) {
    if (items.length === 0) {
      return;
    }

    const nextDeletedIds = new Set(items.map((item) => item.id));
    const previousCompetitions = competitions;
    const previousSelectedIds = selectedCompetitionIds;
    setBusy(true);
    setErrorMessage("");
    setStatusMessage(
      copyFor(language, {
        en: items.length === 1 ? "Deleting competition..." : `Deleting selected competitions (${items.length})...`,
        ru:
          items.length === 1
            ? "Удаляю соревнование..."
            : `Удаляю выбранные соревнования (${items.length})...`,
        bg:
          items.length === 1
            ? "Изтриване на състезание..."
            : `Изтриване на избраните състезания (${items.length})...`,
      }),
    );
    setCompetitions((current) =>
      current.filter((competition) => !nextDeletedIds.has(competition.id)),
    );
    setSelectedCompetitionIds([]);

    try {
      const payload: DeleteCompetitionsPayload = {
        competitionIds: items.map((item) => item.id),
      };
      const response = await requestDeleteCompetitions(payload);
      setCompetitions(response.competitions);
      setSelectedCompetitionIds([]);

      if (response.deletedCompetitionIds.includes(competitionPlanForm.competitionId)) {
        setCompetitionPlanForm((current) => ({
          ...current,
          competitionId: "",
        }));
      }

      if (response.linkedPlanCount > 0) {
        await loadCompetitionPlans(selectedAthleteId || undefined);

        if (selectedAthleteId) {
          await Promise.all([
            loadCompetitionContext(selectedAthleteId),
            loadCompetitionReview(selectedAthleteId),
          ]);
        }
      }

      setStatusMessage(
        copyFor(language, {
          en: items.length === 1 ? "Competition deleted." : "Selected competitions deleted.",
          ru:
            items.length === 1
              ? "Соревнование удалено."
              : "Выбранные соревнования удалены.",
          bg:
            items.length === 1
              ? "Състезанието е изтрито."
              : "Избраните състезания са изтрити.",
        }),
      );
    } catch (error) {
      setCompetitions(previousCompetitions);
      setSelectedCompetitionIds(previousSelectedIds);
      setErrorMessage(error instanceof Error ? error.message : "Competition delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleOlympicCycleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrorMessage("");

    try {
      await apiRequest("/olympic-cycles", {
        method: "POST",
        body: JSON.stringify(olympicCycleForm),
      });
      setStatusMessage(
        copyFor(language, {
          en: "Long-term cycle saved.",
          ru: "Долгосрочный цикл сохранён.",
          bg: "Дългосрочният цикъл е запазен.",
        }),
      );
      setOlympicCycleForm(initialOlympicCycleForm);
      await loadOlympicCycles();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : copyFor(language, {
              en: "Could not save the long-term cycle.",
              ru: "Не удалось сохранить долгосрочный цикл.",
              bg: "Дългосрочният цикъл не можа да бъде запазен.",
            }),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSeasonSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrorMessage("");

    try {
      await apiRequest("/seasons", {
        method: "POST",
        body: JSON.stringify(seasonForm),
      });
      setStatusMessage("Season saved.");
      setSeasonForm((current) => ({
        ...initialSeasonForm,
        athleteId: current.athleteId,
        olympicCycleId: current.olympicCycleId,
      }));
      await loadSeasons(seasonForm.athleteId || undefined);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Season request failed");
    } finally {
      setBusy(false);
    }
  }

  function handlePrepareCompetitionPlan(competition: CompetitionSummary) {
    const athleteId = selectedAthleteId || competitionPlanForm.athleteId;
    const competitionYear = getDateYearValue(competition.startDate);
    const matchingSeasonId =
      athleteId && competitionYear
        ? seasons.find((season) => season.athleteId === athleteId && season.year === competitionYear)
            ?.id ?? null
        : null;

    setCompetitionPlanForm((current) => ({
      ...current,
      athleteId,
      competitionId: competition.id,
      seasonId:
        matchingSeasonId ??
        (current.athleteId === athleteId ? current.seasonId : null),
      prepStartDate: shiftDateInputValue(competition.startDate, -60),
      prepEndDate: competition.startDate,
    }));
    setSeasonEditorMode("plan");
    setPlanningView("season");
    setStatusMessage(
      copyFor(language, {
        en: "Competition selected. Save it as a season start for the selected athlete.",
        ru: "Соревнование выбрано. Сохраните его как старт сезона для выбранного спортсмена.",
        bg: "Състезанието е избрано. Запазете го като старт от сезона за избрания спортист.",
      }),
    );
    scrollViewportToTop();
  }

  function handleSelectSeasonStart(
    plan: CompetitionPlanSummary,
    nextMode: SeasonEditorMode = "result",
  ) {
    setSelectedSeasonStartId(plan.id);
    setSeasonEditorMode(nextMode);
    setCompetitionResultForm((current) => ({
      ...current,
      competitionPlanId: plan.id,
    }));
  }

  function handleNewSeasonStart() {
    const athleteId = selectedAthleteId || competitionPlanForm.athleteId;

    setSeasonEditorMode("plan");
    setCompetitionPlanForm((current) => ({
      ...current,
      athleteId,
      competitionId: "",
    }));
  }

  async function handleDeleteSeasonStart(plan: CompetitionPlanSummary) {
    const confirmed =
      typeof window === "undefined" ||
      window.confirm(
        copyFor(language, {
          en: `Delete season start "${plan.competitionTitle}"?`,
          ru: `Удалить старт "${plan.competitionTitle}"?`,
          bg: `Да се изтрие стартът "${plan.competitionTitle}"?`,
        }),
      );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setErrorMessage("");

    try {
      const response = await apiRequest<{
        deletedCompetitionPlanId: string;
        competitionPlans: CompetitionPlanSummary[];
      }>(`/competition-plans/${plan.id}`, {
        method: "DELETE",
      });
      const nextVisibleStart =
        response.competitionPlans
          .filter((item) => {
            const competitionYear = getDateYearValue(item.competitionStartDate);
            return (
              (!selectedAthleteId || item.athleteId === selectedAthleteId) &&
              competitionYear === seasonDisplayYear
            );
          })
          .sort((left, right) =>
            left.competitionStartDate.localeCompare(right.competitionStartDate),
          )[0]?.id ?? "";

      setCompetitionPlans(response.competitionPlans);
      setSelectedSeasonStartId(nextVisibleStart);
      setCompetitionResultForm(initialCompetitionResultForm);

      if (!nextVisibleStart) {
        setSeasonEditorMode("starts");
      }

      if (selectedAthleteId) {
        await Promise.all([
          loadCompetitionContext(selectedAthleteId),
          loadCompetitionReview(selectedAthleteId),
        ]);
      }

      setStatusMessage(
        copyFor(language, {
          en: "Season start deleted.",
          ru: "Старт сезона удалён.",
          bg: "Стартът от сезона е изтрит.",
        }),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Season start delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleCompetitionPlanSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrorMessage("");
    const athleteId = selectedAthleteId || competitionPlanForm.athleteId;

    try {
      if (!athleteId) {
        throw new Error(
          copyFor(language, {
            en: "Select an athlete in the top menu first.",
            ru: "Сначала выберите спортсмена в верхнем меню.",
            bg: "Първо изберете спортист от горното меню.",
          }),
        );
      }

      const response = await apiRequest<{ competitionPlan: CompetitionPlanSummary }>(
        "/competition-plans",
        {
          method: "POST",
          body: JSON.stringify({
            ...competitionPlanForm,
            athleteId,
          }),
        },
      );
      setSelectedSeasonStartId(response.competitionPlan.id);
      setStatusMessage(
        copyFor(language, {
          en: "Season start saved.",
          ru: "Старт сезона сохранён.",
          bg: "Стартът от сезона е запазен.",
        }),
      );
      await loadCompetitionPlans(athleteId);
      if (athleteId) {
        await Promise.all([
          loadCompetitionContext(athleteId),
          loadCompetitionReview(athleteId),
        ]);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Competition plan request failed",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCompetitionResultSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrorMessage("");
    const competitionPlanId =
      competitionResultForm.competitionPlanId || selectedSeasonStart?.id || "";

    try {
      if (!competitionPlanId) {
        throw new Error(
          copyFor(language, {
            en: "Select a season start first.",
            ru: "Сначала выберите старт сезона.",
            bg: "Първо изберете старт от сезона.",
          }),
        );
      }

      await apiRequest("/competition-results", {
        method: "POST",
        body: JSON.stringify({
          ...competitionResultForm,
          competitionPlanId,
        }),
      });
      setStatusMessage("Competition result saved.");
      if (selectedAthleteId) {
        await Promise.all([
          loadCompetitionPlans(selectedAthleteId),
          loadCompetitionReview(selectedAthleteId),
          loadCompetitionContext(selectedAthleteId),
        ]);
      }
      setCompetitionResultForm(initialCompetitionResultForm);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Competition result request failed",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleMesocycleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrorMessage("");

    try {
      const athleteId = mesocycleForm.athleteId || selectedAthleteId;
      if (!athleteId) {
        throw new Error(
          copyFor(language, {
            en: "Select an athlete in the top menu first.",
            ru: "Сначала выберите спортсмена в верхнем меню.",
            bg: "Първо изберете спортист от горното меню.",
          }),
        );
      }

      const payload: CreateMesocyclePayload = {
        ...mesocycleForm,
        athleteId,
      };

      await apiRequest("/mesocycles", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setStatusMessage(
        copyFor(language, {
          en: "Mesocycle saved.",
          ru: "Мезоцикл сохранён.",
          bg: "Мезоцикълът е запазен.",
        }),
      );
      await loadMesocycles(athleteId);
      setMesocycleForm((current) => ({
        ...initialMesocycleForm,
        athleteId,
        seasonId: current.seasonId,
        competitionPlanId: current.competitionPlanId,
      }));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Mesocycle request failed",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleUseMesocycleWeek(mesocycle: MesocycleSummary, week: MesocycleSummary["weeks"][number]) {
    setMicrocycleForm((current) => ({
      ...current,
      athleteId: mesocycle.athleteId,
      startDate: week.startDate,
      plannedPhase: mesocycle.phase,
      notes: `${mesocycle.name} / ${week.label} / ${week.microcycleType}`,
    }));
    if (canLoadCoachScopedAthleteData(mesocycle.athleteId)) {
      void loadTemplatePackRecommendations(mesocycle.athleteId, week.startDate, coachAthletes);
    }
    setStatusMessage(
      copyFor(language, {
        en: `Weekly planner aligned to ${translateKnownMesocycleText(mesocycle.name, language)} ${localizedWeekLabel(week.label, language)}. Review the suggested pack and assign when ready.`,
          ru: `Недельный план связан с ${translateKnownMesocycleText(mesocycle.name, language)} ${localizedWeekLabel(week.label, language)}. Проверьте предложенный пакет и назначьте, когда будете готовы.`,
          bg: `Седмичният план е свързан с ${translateKnownMesocycleText(mesocycle.name, language)} ${localizedWeekLabel(week.label, language)}. Прегледайте предложения пакет и назначете, когато сте готови.`,
      }),
    );
  }

  async function handleAutoAssignMicrocycleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrorMessage("");

    try {
      const athleteId = selectedAthleteId || microcycleForm.athleteId;

      if (!athleteId) {
        throw new Error(ui("selectAthlete"));
      }

      const payload: AutoAssignMicrocyclePayload = {
        ...microcycleForm,
        athleteId,
      };

      const response = await apiRequest<{ assignedPlans: AssignedPlanSummary[] }>(
        "/plans/auto-assign-microcycle",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
      setStatusMessage(`Microcycle assigned: ${response.assignedPlans.length} day(s).`);
      await loadAssignedPlans();
      if (canLoadCoachScopedAthleteData(athleteId)) {
        await Promise.all([
          loadCoachAthletes(),
          loadCoachAdaptedPlan(athleteId),
          loadCoachExecutionReview(athleteId),
          loadCoachAnalyticsOverview(athleteId),
          loadTemplatePackRecommendations(
            athleteId,
            microcycleForm.startDate,
            coachAthletes,
          ),
        ]);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Microcycle auto-assignment failed",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleApplyPlannerSuggestion(suggestion: PlannerSuggestion) {
    if (!templatePack) {
      return;
    }

    const nextPack = applyPlannerSuggestionToPack(templatePack, suggestion, planTemplates);
    const recommendedTemplateName = translateKnownTemplateText(
      suggestion.recommendedTemplateName,
      language,
    );

    if (!nextPack) {
      return;
    }

    setTemplatePack(nextPack);
    setMicrocycleForm((current) => ({
      ...current,
      daysCount: nextPack.items.length,
      items: packToMicrocycleItems(nextPack),
    }));
    setStatusMessage(
      suggestion.recommendedTemplateName
        ? suggestion.feedback
          ? copyFor(language, {
              en: `Suggestion applied: ${recommendedTemplateName}. ${plannerSuggestionFeedbackLabel(
                suggestion.feedback,
              )}. Review the draft pack and assign when ready.`,
              ru: `Совет применён: ${recommendedTemplateName}. ${plannerSuggestionFeedbackLabel(
                suggestion.feedback,
              )}. Проверьте черновой пакет и назначьте, когда будете готовы.`,
              bg: `Предложението е приложено: ${recommendedTemplateName}. ${plannerSuggestionFeedbackLabel(
                suggestion.feedback,
              )}. Прегледайте черновия пакет и назначете, когато сте готови.`,
            })
          : copyFor(language, {
              en: `Suggestion applied: ${recommendedTemplateName}. Review the draft pack and assign when ready.`,
              ru: `Совет применён: ${recommendedTemplateName}. Проверьте черновой пакет и назначьте, когда будете готовы.`,
              bg: `Предложението е приложено: ${recommendedTemplateName}. Прегледайте черновия пакет и назначете, когато сте готови.`,
            })
        : copyFor(language, {
            en: "Suggestion applied to the draft pack. Review the updated weekly plan before auto-assign.",
            ru: "Совет применён к черновому пакету. Проверьте обновлённый недельный план перед автоназначением.",
            bg: "Предложението е приложено към черновия пакет. Прегледайте обновения седмичен план преди автоматично назначаване.",
          }),
    );
  }

  async function handleApplyAnalyticsCoachSuggestion(
    suggestion: AnalyticsCoachSuggestion,
  ) {
    const bridge = suggestion.plannerBridge;

    if (!bridge) {
      setStatusMessage(
        copyFor(language, {
          en: "This analytics suggestion has no direct planner action yet.",
        ru: "У этого аналитического предложения пока нет прямого действия планирования.",
        bg: "Това аналитично предложение все още няма директно действие за планиране.",
        }),
      );
      return;
    }

    if (!canLoadCoachScopedAthleteData(bridge.athleteId)) {
      resetCoachAthleteSelection();
      return;
    }

    setBusy(true);
    setErrorMessage("");

    startTransition(() => {
      setActiveWorkspace("planning-studio");
      setPlanningView("weekly");
      setSelectedAthleteId(bridge.athleteId);
    });

    setMicrocycleForm((current) => ({
      ...current,
      athleteId: bridge.athleteId,
      startDate: bridge.startDate,
      plannedPhase: bridge.plannedPhase ?? current.plannedPhase ?? null,
      notes: `${suggestion.title} / analytics planner bridge`,
    }));

    try {
      const response = await loadTemplatePackRecommendations(
        bridge.athleteId,
        bridge.startDate,
        coachAthletes,
      );
      const matchedSuggestion = response
        ? findPlannerSuggestionForBridge(response.pack.suggestions, bridge)
        : null;

      if (bridge.autoApply && response && matchedSuggestion) {
        const nextPack = applyPlannerSuggestionToPack(
          response.pack,
          matchedSuggestion,
          planTemplates,
        );

        if (nextPack) {
          const decisionPayload: AnalyticsCoachActionDecisionPayload = {
            suggestionId: suggestion.id,
            suggestionTitle: suggestion.title,
            suggestionLevel: suggestion.level,
            sourceCode: suggestion.sourceCode,
            weekStartDate: suggestion.weekStartDate ?? bridge.startDate,
            weekLabel: suggestion.weekLabel ?? null,
            decisionStatus: "applied",
            plannerBridge: bridge,
          };
          const queueItem = importedCreateQueueItem({
            type: "analytics-decision",
            athleteId: bridge.athleteId,
            payload: decisionPayload,
          });
          try {
            await saveCoachAnalyticsDecision(
              bridge.athleteId,
              decisionPayload,
              queueItem.clientRequestId,
            );
          } catch (error) {
            enqueueAnalyticsDecision(bridge.athleteId, decisionPayload, queueItem);
            if (error instanceof Error && typeof navigator !== "undefined" && navigator.onLine) {
              setErrorMessage(error.message);
            }
          }
          setTemplatePack(nextPack);
          setMicrocycleForm((current) => ({
            ...current,
            athleteId: bridge.athleteId,
            startDate: bridge.startDate,
            plannedPhase: bridge.plannedPhase ?? current.plannedPhase ?? null,
            daysCount: nextPack.items.length,
            items: packToMicrocycleItems(nextPack),
          }));
          setStatusMessage(
            copyFor(language, {
              en: `Analytics suggestion applied in weekly planner: ${suggestion.title}.`,
              ru: `Предложение аналитики применено в недельном планировщике: ${suggestion.title}.`,
              bg: `Предложението от аналитиката е приложено в седмичния планировчик: ${suggestion.title}.`,
            }),
          );
          return;
        }
      }

      setStatusMessage(
        matchedSuggestion
          ? copyFor(language, {
              en: `Weekly planner opened from analytics: ${suggestion.title}. Review the loaded draft.`,
              ru: `Недельный планировщик открыт из аналитики: ${suggestion.title}. Проверьте загруженный черновик.`,
              bg: `Седмичният планировчик е отворен от аналитиката: ${suggestion.title}. Прегледайте заредения черновик.`,
            })
          : copyFor(language, {
              en: `Weekly planner opened for ${bridge.startDate}. Review coach suggestions and apply the best fit manually.`,
              ru: `Недельный планировщик открыт на ${bridge.startDate}. Проверьте советы тренеру и примените лучший вариант вручную.`,
              bg: `Седмичният планировчик е отворен за ${bridge.startDate}. Прегледайте предложенията за треньора и приложете най-подходящия вариант ръчно.`,
            }),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Analytics planner bridge failed",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkAnalyticsCoachSuggestionNotApplied(
    suggestion: AnalyticsCoachSuggestion,
  ) {
    const athleteId = suggestion.plannerBridge?.athleteId ?? selectedAthleteId;
    const weekStartDate = suggestion.weekStartDate ?? suggestion.plannerBridge?.startDate ?? null;

    if (!athleteId || !weekStartDate) {
      setStatusMessage(
        copyFor(language, {
          en: "This analytics suggestion is missing week context, so it cannot be logged yet.",
        ru: "У этого аналитического предложения нет недельного контекста, поэтому его пока нельзя зафиксировать.",
        bg: "Това аналитично предложение няма седмичен контекст и засега не може да бъде записано.",
        }),
      );
      return;
    }

    setBusy(true);
    setErrorMessage("");
    const decisionPayload: AnalyticsCoachActionDecisionPayload = {
      suggestionId: suggestion.id,
      suggestionTitle: suggestion.title,
      suggestionLevel: suggestion.level,
      sourceCode: suggestion.sourceCode,
      weekStartDate,
      weekLabel: suggestion.weekLabel ?? null,
      decisionStatus: "not_applied",
      plannerBridge: suggestion.plannerBridge,
    };
    const queueItem = importedCreateQueueItem({
      type: "analytics-decision",
      athleteId,
      payload: decisionPayload,
    });

    try {
      await saveCoachAnalyticsDecision(
        athleteId,
        decisionPayload,
        queueItem.clientRequestId,
      );
      setStatusMessage(
        copyFor(language, {
          en: `Coach action logged as not applied: ${suggestion.title}.`,
          ru: `Тренерское действие отмечено как не применённое: ${suggestion.title}.`,
          bg: `Треньорското действие е отбелязано като неприложено: ${suggestion.title}.`,
        }),
      );
    } catch (error) {
      enqueueAnalyticsDecision(athleteId, decisionPayload, queueItem);
      setErrorMessage(
        error instanceof Error && typeof navigator !== "undefined" && navigator.onLine
          ? error.message
          : "",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSetAnalyticsDecisionOutcome(
    decision: AnalyticsCoachActionDecision,
    outcome: AnalyticsCoachActionDecision["outcome"],
  ) {
    setBusy(true);
    setErrorMessage("");
    const decisionPayload: AnalyticsCoachActionDecisionPayload = {
      suggestionId: decision.suggestionId,
      suggestionTitle: decision.suggestionTitle,
      suggestionLevel: decision.suggestionLevel,
      sourceCode: decision.sourceCode,
      weekStartDate: decision.weekStartDate,
      weekLabel: decision.weekLabel,
      decisionStatus: decision.decisionStatus,
      plannerBridge: decision.plannerBridge,
      decisionNotes: decision.decisionNotes,
      outcome,
      outcomeNotes: decision.outcomeNotes,
    };
    const queueItem = importedCreateQueueItem({
      type: "analytics-decision",
      athleteId: decision.athleteId,
      payload: decisionPayload,
    });

    try {
      await saveCoachAnalyticsDecision(
        decision.athleteId,
        decisionPayload,
        queueItem.clientRequestId,
      );
      setStatusMessage(
        copyFor(language, {
          en: `Outcome updated for ${decision.suggestionTitle}.`,
          ru: `Результат обновлён для ${decision.suggestionTitle}.`,
          bg: `Резултатът е обновен за ${decision.suggestionTitle}.`,
        }),
      );
    } catch (error) {
      enqueueAnalyticsDecision(decision.athleteId, decisionPayload, queueItem);
      setErrorMessage(
        error instanceof Error && typeof navigator !== "undefined" && navigator.onLine
          ? error.message
          : "",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSyncNow() {
    setIsSyncingNow(true);
    setErrorMessage("");

    try {
      await flushOfflineQueue();
      await refreshSession();
    } finally {
      setIsSyncingNow(false);
    }
  }

  const canSeeCoachWorkspace = user?.role === "coach" || user?.role === "admin";
  const selectedCoachAthlete =
    coachAthletes.find((athlete) => athlete.athleteId === selectedAthleteId) ?? null;
  const weeklyPlanAthleteId = selectedAthleteId || microcycleForm.athleteId;
  const weeklyPlanAthlete =
    selectedCoachAthlete ??
    coachAthletes.find((athlete) => athlete.athleteId === weeklyPlanAthleteId) ??
    null;
  const visibleSeasons = seasons.filter(
    (season) => !selectedAthleteId || season.athleteId === selectedAthleteId,
  );
  const visibleCompetitionPlans = competitionPlans.filter(
    (plan) => !selectedAthleteId || plan.athleteId === selectedAthleteId,
  );
  const activeMesocycleAthleteId = mesocycleForm.athleteId || selectedAthleteId;
  const visibleMesocycles = [...mesocycles]
    .filter(
      (mesocycle) => !activeMesocycleAthleteId || mesocycle.athleteId === activeMesocycleAthleteId,
    )
    .sort(
      (left, right) =>
        right.createdAt.localeCompare(left.createdAt) ||
        right.startDate.localeCompare(left.startDate),
    );
  const seasonDisplayYear = Number.isFinite(seasonForm.year)
    ? seasonForm.year
    : new Date().getFullYear();
  const visibleSeasonStarts = [...visibleCompetitionPlans]
    .filter((plan) => {
      const competitionYear = getDateYearValue(plan.competitionStartDate);
      return (
        plan.seasonYear === seasonDisplayYear ||
        competitionYear === seasonDisplayYear
      );
    })
    .sort((left, right) =>
      left.competitionStartDate.localeCompare(right.competitionStartDate),
    );
  const selectedSeasonStart =
    visibleSeasonStarts.find((plan) => plan.id === selectedSeasonStartId) ??
    visibleSeasonStarts[0] ??
    null;
  const selectedSeasonCompetition = selectedSeasonStart
    ? competitions.find((competition) => competition.id === selectedSeasonStart.competitionId) ??
      null
    : null;
  const seasonMonthLabels = MONTH_LABELS[language];
  const isCoachDashboardWorkspace = activeWorkspace === "coach-dashboard";
  const isCoachAthletesWorkspace = activeWorkspace === "coach-athletes";
  const isCoachAnalyticsWorkspace = activeWorkspace === "coach-analytics";
  const isCoachReviewWorkspace = activeWorkspace === "coach-review";
  const showCoachRosterColumn = false;
  const showCoachInspectorColumn = isCoachDashboardWorkspace;
  const showAthleteProfileEditor = isAthleteProfileEditorOpen;
  const coachAiStatusSourceLabel = coachAiStatus?.source === "model"
    ? copyFor(language, { en: "Model", ru: "Модель", bg: "Модел" })
    : copyFor(language, { en: "Server rules", ru: "Серверные правила", bg: "Сървърни правила" });
  const coachAiStatusModeLabel = coachAiStatus?.mode === "model"
    ? copyFor(language, { en: "model mode", ru: "режим модели", bg: "режим модел" })
    : copyFor(language, { en: "server rules", ru: "серверные правила", bg: "сървърни правила" });
  const coachAiStatusChipClass = coachAiStatus?.source === "model" && coachAiStatus.modelReady
    ? "green"
    : coachAiStatus?.mode === "model"
      ? "warning"
      : "idle";

  useEffect(() => {
    if (
      isPreviewMode ||
      !canSeeCoachWorkspace ||
      activeWorkspace !== "planning-studio" ||
      planningView !== "calendar" ||
      uwwSyncOptionsLoaded
    ) {
      return;
    }

    void loadUwwSyncOptions().catch((error) => {
      setUwwSyncOptionsLoaded(true);
      setErrorMessage(error instanceof Error ? error.message : "UWW options request failed");
    });
  }, [
    activeWorkspace,
    canSeeCoachWorkspace,
    isPreviewMode,
    planningView,
    user?.id,
    uwwSyncOptionsLoaded,
  ]);

  useEffect(() => {
    setAthleteProfileForm(buildAthleteProfileForm(selectedCoachAthlete));
    setIsAthleteProfileEditorOpen(false);
    setAthleteProfileSaveState("idle");
    setAthleteProfileSaveMessage("");
  }, [selectedCoachAthlete?.athleteId]);

  useEffect(() => {
    if (!canSeeCoachWorkspace) {
      setAvailableCoachAthletes([]);
      setCoachAiStatus(null);
      setCoachAiDiagnostic(null);
      setCoachAiDiagnosticMessage("");
      setCoachAiReviews([]);
      setCoachAiReviewMessage("");
      return;
    }

    if (!isPreviewMode) {
      void loadAvailableCoachAthletes();
      void loadCoachAiReviews().catch(() => {
        setCoachAiReviews([]);
      });
      void loadCoachAiReviewStatus().catch(() => {
        setCoachAiStatus(null);
      });
    }
  }, [canSeeCoachWorkspace, isPreviewMode, user?.id]);

  async function handleCoachAiDiagnosticClick() {
    if (!canSeeCoachWorkspace) {
      return;
    }

    if (isPreviewMode) {
      setCoachAiDiagnosticMessage(
        copyFor(language, {
          en: "The test call is available after sign-in.",
          ru: "Тестовый вызов доступен после входа в аккаунт.",
          bg: "Тестовото извикване е достъпно след вход.",
        }),
      );
      return;
    }

    setCoachAiDiagnosticBusy(true);
    setCoachAiDiagnosticMessage(
      copyFor(language, {
        en: "Checking AI review on the server...",
        ru: "Проверяю ИИ-разбор на сервере...",
        bg: "Проверявам AI анализа на сървъра...",
      }),
    );
    setErrorMessage("");

    try {
      const response = await apiRequest<CoachAiReviewDiagnosticResponse>(
        "/coach/ai-day-review/test",
        { method: "POST" },
      );
      setCoachAiDiagnostic(response);
      setCoachAiStatus(response.status);
      setCoachAiDiagnosticMessage(response.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setCoachAiDiagnosticMessage(
        copyFor(language, {
          en: "AI test call failed. The main review keeps using server rules.",
          ru: "Тестовый вызов ИИ не прошёл. Основной разбор продолжает работать по серверным правилам.",
          bg: "Тестовото извикване на AI не мина. Основният анализ продължава със сървърни правила.",
        }),
      );
      setErrorMessage(message);
    } finally {
      setCoachAiDiagnosticBusy(false);
    }
  }

  async function handleGenerateCoachAiReviewClick() {
    if (!canSeeCoachWorkspace || !selectedAthleteId || !coachExecutionReview) {
      setCoachAiReviewMessage(
        copyFor(language, {
          en: "Select an athlete and a day before generating the AI review.",
          ru: "Выберите спортсмена и день перед формированием разбора ИИ.",
          bg: "Изберете спортист и ден преди генериране на AI анализа.",
        }),
      );
      return;
    }

    if (isPreviewMode) {
      setCoachAiReviewMessage(
        copyFor(language, {
          en: "AI review generation is available after sign-in.",
          ru: "Формирование разбора ИИ доступно после входа в аккаунт.",
          bg: "Генерирането на AI анализ е достъпно след вход.",
        }),
      );
      return;
    }

    const readinessEntry =
      selectedAthleteEntries.find(
        (entry) => entry.athleteId === selectedAthleteId && entry.entryDate === coachExecutionReview.dayDate,
      ) ?? null;
    const diaryEntry =
      coachDiaryEntries
        .filter(
          (entry) =>
            entry.athleteId === selectedAthleteId &&
            entry.assignedPlanId === coachExecutionReview.assignedPlanId,
        )
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
    const deviceHealthSummary = getDeviceHealthSummaryForDay(
      coachDeviceHealthSummaries,
      selectedAthleteId,
      coachExecutionReview.dayDate,
    );
    const dayPayload = buildCoachDayAiPayloadFromReview({
      athlete: selectedCoachAthlete,
      deviceHealthSummary,
      deviceWorkoutLinks: getDeviceWorkoutLinksForDay(
        coachDeviceWorkoutLinks,
        selectedAthleteId,
        coachExecutionReview.dayDate,
      ),
      diaryEntry,
      language,
      readinessEntry,
      review: coachExecutionReview,
    });

    setCoachAiReviewBusy(true);
    setCoachAiReviewMessage(
      copyFor(language, {
        en: "Generating server review for the selected day...",
        ru: "Формирую серверный разбор выбранного дня...",
        bg: "Генерирам сървърен анализ за избрания ден...",
      }),
    );
    setErrorMessage("");

    try {
      const response = await apiRequest<CoachDayAiReviewResponse>(
        `/coach/athletes/${encodeURIComponent(selectedAthleteId)}/ai-day-review`,
        {
          method: "POST",
          body: JSON.stringify({
            dayPayload,
            entryDate: coachExecutionReview.dayDate,
          }),
        },
      );
      setCoachAiReviews((current) => upsertCoachAiReviewHistory(current, response.review));
      setCoachAiReviewMessage(
        copyFor(language, {
          en: "AI review saved in history. Plan and diary were not changed.",
          ru: "Разбор ИИ сохранён в истории. План и дневник не изменены.",
          bg: "AI анализът е запазен в историята. Планът и дневникът не са променени.",
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setCoachAiReviewMessage(
        copyFor(language, {
          en: "Server review failed. Plan and diary were not changed.",
          ru: "Серверный разбор не прошёл. План и дневник не изменены.",
          bg: "Сървърният анализ не мина. Планът и дневникът не са променени.",
        }),
      );
      setErrorMessage(message);
    } finally {
      setCoachAiReviewBusy(false);
    }
  }

  async function handleAthleteProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCoachAthlete) {
      return;
    }

    setAthleteProfileSaveState("saving");
    setAthleteProfileSaveMessage(
      copyFor(language, {
        en: "Saving athlete card...",
        ru: "Сохраняю карточку спортсмена...",
        bg: "Запазвам картата на спортиста...",
      }),
    );
    setErrorMessage("");

    try {
      const response = await apiRequest<CoachAttachAthleteResponse>(
        `/coach/athletes/${selectedCoachAthlete.athleteId}/profile`,
        {
          method: "PATCH",
          body: JSON.stringify(athleteProfileForm),
        },
      );

      setCoachAthletes((current) =>
        current.map((athlete) =>
          athlete.athleteId === response.athlete.athleteId ? response.athlete : athlete,
        ),
      );
      setAvailableCoachAthletes((current) =>
        current.map((athlete) =>
          athlete.athleteId === response.athlete.athleteId ? response.athlete : athlete,
        ),
      );
      setStatusMessage(
        copyFor(language, {
          en: "Athlete card updated.",
          ru: "Карточка спортсмена обновлена.",
          bg: "Картата на спортиста е обновена.",
        }),
      );
      setAthleteProfileSaveState("saved");
      setAthleteProfileSaveMessage(
        copyFor(language, {
          en: "Saved. Athlete card has been updated.",
          ru: "Сохранено. Карточка спортсмена обновлена.",
          bg: "Запазено. Картата на спортиста е обновена.",
        }),
      );
      setIsAthleteProfileEditorOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const readableMessage = getAthleteProfileSaveErrorMessage(message, language);
      setErrorMessage(readableMessage);
      setAthleteProfileSaveState("failed");
      setAthleteProfileSaveMessage(readableMessage);
    } finally {
      // The athlete card has its own visible save state; do not tie it to global screen busy state.
    }
  }

  useEffect(() => {
    if (isPreviewMode || !canSeeCoachWorkspace || activeWorkspace !== "coach-dashboard") {
      return;
    }

    let cancelled = false;
    const refreshCoachDashboardData = async () => {
      if (cancelled) {
        return;
      }

      try {
        await Promise.all([
          loadCoachAthletes(selectedAthleteId || undefined),
          loadAvailableCoachAthletes(),
        ]);
      } catch {
        // Keep the current dashboard visible if a background refresh fails.
      }
    };

    const handleFocus = () => {
      void refreshCoachDashboardData();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshCoachDashboardData();
      }
    };

    void refreshCoachDashboardData();
    const intervalId = window.setInterval(refreshCoachDashboardData, 30000);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeWorkspace, canSeeCoachWorkspace, isPreviewMode, selectedAthleteId, user?.id]);

  const activeUserLabel = user ? translateRoleName(user.role, language) : ui("guest");
  const activeAthleteLabel =
    user?.role === "athlete"
      ? user.fullName
      : selectedCoachAthlete?.fullName ?? ui("selectAthlete");
  const latestVisibleReadiness =
    user?.role === "athlete"
      ? todayEntry
        ? `${readinessMeta[todayEntry.status].label} (${todayEntry.score})`
        : ui("noEntriesYet")
      : selectedCoachAthlete?.latestReadiness
        ? `${readinessMeta[selectedCoachAthlete.latestReadiness.status].label} (${selectedCoachAthlete.latestReadiness.score})`
        : ui("noEntriesYet");
  const visibleAthleteCompetitionPlans =
    user?.role === "athlete" && user.athleteId
      ? competitionPlans.filter((plan) => plan.athleteId === user.athleteId)
      : competitionPlans;
  const sortedAthleteCompetitionPlans = [...visibleAthleteCompetitionPlans].sort((left, right) =>
    left.competitionStartDate.localeCompare(right.competitionStartDate),
  );
  const upcomingAthleteCompetitionPlans = sortedAthleteCompetitionPlans.filter(
    (plan) => plan.competitionEndDate >= getDateInputValue(),
  );
  const selectedAthleteCompetitionPlan = selectedAthleteCompetitionPlanId
    ? sortedAthleteCompetitionPlans.find((plan) => plan.id === selectedAthleteCompetitionPlanId) ??
      null
    : null;
  const contextAthleteCompetitionPlan = competitionContext?.competitionPlanId
    ? sortedAthleteCompetitionPlans.find(
        (plan) => plan.id === competitionContext.competitionPlanId,
      ) ?? null
    : null;
  const currentAthleteCompetitionPlan =
    selectedAthleteCompetitionPlan ??
    contextAthleteCompetitionPlan ??
    upcomingAthleteCompetitionPlans[0] ??
    sortedAthleteCompetitionPlans[0] ??
    null;
  const hasSelectedAthleteCompetitionPlan = selectedAthleteCompetitionPlan !== null;
  const currentAthleteContextMatchesPlan = Boolean(
    currentAthleteCompetitionPlan &&
      competitionContext?.competitionPlanId === currentAthleteCompetitionPlan.id,
  );
  const currentAthleteCompetition =
    competitions.find(
      (competition) => competition.id === currentAthleteCompetitionPlan?.competitionId,
    ) ??
    competitions.find((competition) => competition.id === competitionContext?.competitionId) ??
    null;
  const currentAthletePlanDaysToStart = currentAthleteCompetitionPlan
    ? diffDateInputDays(getDateInputValue(), currentAthleteCompetitionPlan.competitionStartDate)
    : null;
  const currentAthleteDaysToStart =
    currentAthleteContextMatchesPlan &&
    competitionContext?.daysToCompetition !== null &&
    competitionContext?.daysToCompetition !== undefined
      ? competitionContext.daysToCompetition
      : currentAthletePlanDaysToStart;
  const currentAthleteDaysToStartValue =
    currentAthleteDaysToStart !== null ? String(currentAthleteDaysToStart) : "-";
  const currentAthleteCompetitionPhaseValue =
    currentAthleteContextMatchesPlan && competitionContext?.phase
      ? competitionContext.phase
      : deriveAthletePreparationPhase(currentAthleteDaysToStart);
  const currentAthleteCompetitionPhase = currentAthleteCompetitionPhaseValue
    ? localizedOptionLabel(currentAthleteCompetitionPhaseValue, language, PREPARATION_PHASE_LABELS)
    : "-";
  const currentAthleteTaperState =
    currentAthleteContextMatchesPlan && competitionContext
      ? competitionContext.taperState
      : Boolean(
          currentAthleteCompetitionPlan &&
            currentAthleteDaysToStart !== null &&
            currentAthleteDaysToStart >= 0 &&
            currentAthleteDaysToStart <= currentAthleteCompetitionPlan.taperDays,
        );
  const currentAthleteWeightCutState =
    currentAthleteContextMatchesPlan && competitionContext
      ? competitionContext.weightCutState
      : Boolean(
          currentAthleteCompetitionPlan &&
            currentAthleteCompetitionPlan.weightCutRequired &&
            currentAthleteDaysToStart !== null &&
            currentAthleteDaysToStart >= 0 &&
            currentAthleteDaysToStart <= Math.max(currentAthleteCompetitionPlan.taperDays, 10),
        );
  const availableAthleteAttachmentPanel = canSeeCoachWorkspace ? (
    <div className="coach-available-panel">
      <div className="coach-roster-head">
        <strong>
          {copyFor(language, {
            en: "Available athletes",
            ru: "Доступные спортсмены",
            bg: "Достъпни спортисти",
          })}
        </strong>
        <span>{availableCoachAthletes.length}</span>
      </div>
      {availableCoachAthletes.length > 0 ? (
        <div className="role-grid coach-roster-grid coach-available-grid">
          {availableCoachAthletes.map((athlete) => (
            <article className="role-card" key={athlete.athleteId}>
              <div className="coach-roster-status">
                <strong>{athlete.fullName}</strong>
                <span className="status-chip idle">
                  {copyFor(language, {
                    en: "Not linked",
                    ru: "Не привязан",
                    bg: "Не е свързан",
                  })}
                </span>
              </div>
              <span>{athlete.email}</span>
              <span>
                {athlete.latestReadiness
                  ? `${readinessMeta[athlete.latestReadiness.status].label} (${athlete.latestReadiness.score})`
                  : ui("noEntriesYet")}
              </span>
              <button
                className="primary-button"
                disabled={busy}
                onClick={() => void handleAttachCoachAthlete(athlete.athleteId)}
                type="button"
              >
                {copyFor(language, {
                  en: "Attach athlete",
                  ru: "Прикрепить",
                  bg: "Прикачи",
                })}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="placeholder-copy">
          {copyFor(language, {
            en: "There are no free athletes to attach right now.",
            ru: "Свободных спортсменов для прикрепления сейчас нет.",
            bg: "В момента няма свободни спортисти за прикрепяне.",
          })}
        </p>
      )}
    </div>
  ) : null;
  const activeAthleteId =
    user?.role === "athlete" ? user.athleteId : selectedAthleteId || null;
  const relevantAssignedPlans = activeAthleteId
    ? assignedPlans.filter((plan) => plan.athleteId === activeAthleteId)
    : assignedPlans;
  const primaryAssignedPlan = selectCurrentAssignedPlan(relevantAssignedPlans);
  const activeAthleteTrainingSessions =
    adaptedPlan?.sessions ?? primaryAssignedPlan?.day.sessions ?? [];
  const activeAthleteTrainingDayLabel =
    adaptedPlan?.dayLabel ?? primaryAssignedPlan?.day.label ?? ui("noActivePlan");
  const activeAthleteTrainingPlanId = adaptedPlan?.assignedPlanId ?? primaryAssignedPlan?.id ?? "";
  const activePhaseLabel =
    competitionContext?.phase ??
    primaryAssignedPlan?.plannedPhase ??
    templatePack?.phase ??
    ui("notGenerated");
  const productTitle = "v3Final";
  const productEyebrow = copyFor(language, {
    en: "Training OS",
    ru: "Тренировочная система",
    bg: "Тренировъчна система",
  });
  const stateLabelText = copyFor(language, {
    en: "Sync state",
    ru: "Состояние синхронизации",
    bg: "Състояние на синхронизация",
  });
  const queueItemLabelText = copyFor(language, {
    en: "Queue item",
    ru: "Элемент очереди",
    bg: "Елемент от опашката",
  });
  const athleteLatestReadinessPoint = analyticsOverview?.readinessTrend.at(-1) ?? null;
  const athleteLatestCompletionPoint = analyticsOverview?.completionTrend.at(-1) ?? null;
  const athleteLatestLoadPoint = analyticsOverview?.loadTrend.at(-1) ?? null;
  const athleteWeekSummary = analyticsOverview?.chain.weekSummary ?? null;
  const coachLatestReadinessPoint = coachAnalyticsOverview?.readinessTrend.at(-1) ?? null;
  const coachLatestCompletionPoint = coachAnalyticsOverview?.completionTrend.at(-1) ?? null;
  const coachLatestLoadPoint = coachAnalyticsOverview?.loadTrend.at(-1) ?? null;
  const coachWeekSummary = coachAnalyticsOverview?.chain.weekSummary ?? null;
  const isCoachRailContext = isCoachWorkspaceId(activeWorkspace) || activeWorkspace === "planning-studio";
  const railStats = [
    {
      label: stateLabelText,
      value: importedSyncStateLabel(language, isOffline, offlineQueueSize),
      note: importedQueueLabel(language, offlineQueueSize),
      tone: offlineQueueSize > 0 ? "accent" as const : "default" as const,
    },
    {
      label: ui("latestReadiness"),
      value: latestVisibleReadiness,
      note: isCoachRailContext
        ? selectedCoachAthlete?.fullName ?? ui("selectAthlete")
        : todayEntry
          ? `Score ${todayEntry.score}`
          : ui("saveReadiness"),
      tone: "default" as const,
    },
    {
      label: t("activeAssignments"),
      value: String(assignedPlans.length),
      note: activePhaseLabel,
      tone: "default" as const,
    },
  ];
  const coachWorkspaceLinks: Array<{
    id: WorkspaceSectionId;
    label: string;
    meta: string;
  }> = canSeeCoachWorkspace
    ? [
        {
          id: "coach-dashboard",
          label: "Dashboard",
          meta: selectedCoachAthlete?.fullName ?? ui("selectAthlete"),
        },
        {
          id: "coach-athletes",
          label:
            language === "ru"
              ? "Спортсмены"
              : language === "bg"
                ? "Спортисти"
                : "Athletes",
          meta: String(coachAthletes.length),
        },
        {
          id: "planning-studio",
          label:
            language === "ru"
              ? "Планирование"
              : language === "bg"
                ? "Планиране"
                : "Planning",
          meta: `${planTemplates.length} / ${competitionPlans.length}`,
        },
        {
          id: "coach-analytics",
          label: t("analytics"),
          meta: coachAnalyticsOverview
            ? `${coachAnalyticsOverview.insights.length}/${coachAnalyticsOverview.patterns.length}`
            : ui("noAnalyticsYet"),
        },
        {
          id: "coach-review",
          label: "Review",
          meta: coachExecutionReview
            ? `${coachExecutionReview.summary.completionRate}%`
            : ui("noReviewYet"),
        },
      ]
    : [];

  const athleteWorkspaceLinks: Array<{
    id: WorkspaceSectionId;
    label: string;
    meta: string;
  }> =
    !user || user.role === "athlete"
      ? [
          {
            id: "athlete-today",
            label:
              language === "ru"
                ? "Сегодня"
                : language === "bg"
                  ? "Днес"
                  : "Today",
            meta: t("dailyReadiness"),
          },
          {
            id: "athlete-training",
            label:
              language === "ru"
                ? "Тренировка"
                : language === "bg"
                  ? "Тренировка"
                  : "Training",
            meta: activeAthleteTrainingDayLabel,
          },
          {
            id: "athlete-history",
            label:
              language === "ru"
                ? "История"
                : language === "bg"
                  ? "История"
                  : "History",
            meta: latestVisibleReadiness,
          },
          {
            id: "athlete-competitions",
            label:
              language === "ru"
                ? "Соревнования"
                : language === "bg"
                  ? "Състезания"
                  : "Competitions",
            meta:
              currentAthleteDaysToStartValue !== "-"
                ? `${copyFor(language, {
                    en: "Days to start",
                    ru: "До старта",
                    bg: "До старт",
                  })}: ${currentAthleteDaysToStartValue}`
                : activePhaseLabel,
          },
        ]
      : [];

  const workspaceLinks: Array<{ id: WorkspaceSectionId; label: string; meta: string }> = [
    ...athleteWorkspaceLinks,
    ...(SHOW_OFFLINE_CENTER_NAV
      ? [
          {
            id: "offline-center" as const,
            label: ui("offlineSyncCenter"),
            meta: importedSyncStateLabel(language, isOffline, offlineQueueSize),
          },
        ]
      : []),
    ...coachWorkspaceLinks,
  ];
  const athleteSummaryItems = [
    {
      label: language === "ru" ? "Фаза" : language === "bg" ? "Фаза" : "Phase",
      value: competitionContext?.phase ?? primaryAssignedPlan?.plannedPhase ?? ui("notGenerated"),
    },
    {
      label:
        language === "ru"
          ? "До старта"
          : language === "bg"
            ? "До старт"
            : "Days to comp",
      value:
        currentAthleteDaysToStartValue,
    },
    {
      label: t("assignedTrainingDay"),
      value: activeAthleteTrainingDayLabel,
    },
    {
      label: stateLabelText,
      value: importedSyncStateLabel(language, isOffline, offlineQueueSize),
    },
  ];
  const coachTabs: Array<{ id: CoachDashboardView; label: string }> = [
    { id: "readiness", label: ui("athleteReadinessHistory") },
    { id: "adaptation", label: ui("coachAdaptationTitle") },
    { id: "execution", label: t("executionReview") },
    {
      id: "competition",
      label:
        language === "ru"
          ? "Соревнования"
          : language === "bg"
            ? "Състезания"
            : "Competition",
    },
    { id: "analytics", label: t("analytics") },
  ];
  const planningTabs: Array<{ id: PlanningStudioView; label: string }> = [
    {
      id: "preparation",
      label:
        language === "ru"
          ? "План подготовки"
          : language === "bg"
            ? "План за подготовка"
            : "Preparation plan",
    },
    {
      id: "mesocycle",
      label:
        language === "ru"
          ? "Мезоциклы"
          : language === "bg"
            ? "Мезоцикли"
            : "Mesocycles",
    },
    {
      id: "weekly",
      label:
        language === "ru"
          ? "Недельный план"
          : language === "bg"
            ? "Седмичен план"
            : "Weekly planner",
    },
    {
      id: "templates",
      label:
        language === "ru"
          ? "Библиотека шаблонов"
          : language === "bg"
            ? "Библиотека с шаблони"
            : "Template library",
    },
    {
      id: "season",
      label:
        language === "ru"
          ? "Сезон и старты"
          : language === "bg"
            ? "Сезон и стартове"
            : "Season & starts",
    },
    {
      id: "calendar",
      label:
        language === "ru"
          ? "Календарь"
          : language === "bg"
            ? "Календар"
            : "Calendar",
    },
  ];
  const topOverviewItems = [
    {
      label: t("athlete"),
      value: activeAthleteLabel,
      note: latestVisibleReadiness,
    },
    {
      label: language === "ru" ? "Фаза" : language === "bg" ? "Фаза" : "Phase",
      value: activePhaseLabel,
      note:
        competitionContext?.daysToCompetition !== null &&
        competitionContext?.daysToCompetition !== undefined
          ? `${
              language === "ru"
                ? "До старта"
                : language === "bg"
                  ? "До старт"
                  : "Days to comp"
            }: ${competitionContext.daysToCompetition}`
          : ui("notGenerated"),
    },
    {
      label: stateLabelText,
      value: importedSyncStateLabel(language, isOffline, offlineQueueSize),
      note: importedQueueLabel(language, offlineQueueSize),
    },
    {
      label: t("activeAssignments"),
      value: String(assignedPlans.length),
      note:
        language === "ru"
          ? `${planTemplates.length} шаблонов`
          : language === "bg"
            ? `${planTemplates.length} шаблона`
            : `${planTemplates.length} templates`,
    },
  ];
  const athletePreviewCards = [
    {
      title: copyFor(language, {
        en: "Today's readiness",
        ru: "Готовность на сегодня",
        bg: "Готовност за днес",
      }),
      value: ui("noEntriesYet"),
      description: copyFor(language, {
        en: "Sleep, fatigue, soreness, and motivation are collected here before the day is adapted.",
        ru: "Здесь собираются сон, усталость, soreness и мотивация до адаптации дня.",
        bg: "Тук се събират сън, умора, soreness и мотивация преди адаптацията на деня.",
      }),
    },
    {
      title: t("assignedTrainingDay"),
      value: ui("noActivePlan"),
      description: copyFor(language, {
        en: "The central stage shows the working day, target duration, target RPE, and the next athlete task.",
        ru: "Центральная сцена показывает рабочий день, target duration, target RPE и следующее действие спортсмена.",
        bg: "Централната сцена показва работния ден, target duration, target RPE и следващото действие на спортиста.",
      }),
    },
    {
      title: t("executionTracking"),
      value: importedSyncStateLabel(language, isOffline, offlineQueueSize),
      description: copyFor(language, {
        en: "Actual completion, saved block results, and pending offline sync stay visible in the same surface.",
        ru: "Факт выполнения, сохранённые результаты блоков и ожидание офлайн-синхронизации видны в той же рабочей зоне.",
        bg: "Реалното изпълнение, записаните резултати от блоковете и чакащата офлайн синхронизация са в същата работна зона.",
      }),
    },
    {
      title: copyFor(language, {
        en: "Competition context",
        ru: "Соревновательный контекст",
        bg: "Състезателен контекст",
      }),
      value: activePhaseLabel,
      description: copyFor(language, {
        en: "Phase, days to competition, and adaptation logic remain attached to the daily scene.",
        ru: "Фаза, дни до старта и логика адаптации остаются привязаны к ежедневной сцене.",
        bg: "Фазата, дните до старта и логиката за адаптация остават свързани с дневната сцена.",
      }),
    },
  ];
  const currentWorkspaceLabel =
    language === "ru"
      ? "Текущая зона"
      : language === "bg"
        ? "Текуща зона"
        : "Current workspace";
  const workspaceSectionsLabel =
    language === "ru"
      ? "Рабочие зоны"
      : language === "bg"
        ? "Работни зони"
        : "Workspaces";
  const activeWorkspaceItem =
    workspaceLinks.find((link) => link.id === activeWorkspace) ?? workspaceLinks[0];
  const isAthleteTodayWorkspace =
    activeWorkspace === "athlete-today" || activeWorkspace === "daily-readiness";
  const isAthleteTrainingWorkspace =
    activeWorkspace === "athlete-training" || activeWorkspace === "athlete-workspace";
  const isAthleteHistoryWorkspace = activeWorkspace === "athlete-history";
  const isAthleteCompetitionsWorkspace = activeWorkspace === "athlete-competitions";
  const isCoachSceneWorkspace = isCoachWorkspaceId(activeWorkspace);
  const isDailyReadinessWorkspace = isAthleteTodayWorkspace;
  const isAthleteSceneWorkspace = isAthleteWorkspaceId(activeWorkspace);
  const workspaceTitle =
    isAthleteTodayWorkspace
      ? t("dailyReadiness")
      : isAthleteTrainingWorkspace
      ? language === "ru"
        ? "Тренировка"
        : language === "bg"
          ? "Тренировка"
          : "Training"
      : isAthleteHistoryWorkspace
        ? language === "ru"
          ? "История"
          : language === "bg"
            ? "История"
            : "History"
      : isAthleteCompetitionsWorkspace
        ? language === "ru"
          ? "Соревнования"
          : language === "bg"
            ? "Състезания"
            : "Competitions"
      : activeWorkspace === "coach-dashboard"
        ? "Dashboard"
      : activeWorkspace === "coach-athletes"
        ? language === "ru"
          ? "Спортсмены"
          : language === "bg"
            ? "Спортисти"
            : "Athletes"
      : activeWorkspace === "coach-analytics"
        ? t("analytics")
      : activeWorkspace === "coach-review"
        ? "Review"
        : activeWorkspace === "planning-studio"
          ? language === "ru"
            ? "Планирование"
            : language === "bg"
              ? "Планиране"
              : "Planning"
          : ui("offlineSyncCenter");
  const topbarTitle =
    !user && isAthleteSceneWorkspace ? ui("guestTopbarTitle") : workspaceTitle;
  const workspaceSummary =
    isAthleteTodayWorkspace
      ? language === "ru"
        ? "Ежедневный сбор сигналов перед началом рабочего дня."
        : language === "bg"
          ? "Ежедневно събиране на сигнали преди началото на работния ден."
          : "Daily signal collection before the working day starts."
      : isAthleteTrainingWorkspace
      ? language === "ru"
        ? "Назначенный тренировочный день, блоки, упражнения и фиксация фактического выполнения."
        : language === "bg"
          ? "Назначеният тренировъчен ден, блокове, упражнения и запис на реалното изпълнение."
          : "Assigned training day, blocks, exercises, and actual execution capture."
      : isAthleteHistoryWorkspace
      ? language === "ru"
        ? "История готовности, выполнения и динамики нагрузки спортсмена."
        : language === "bg"
          ? "История на готовността, изпълнението и динамиката на натоварването."
          : "Readiness, execution, and load history for the athlete."
      : isAthleteCompetitionsWorkspace
      ? language === "ru"
        ? "Соревновательный контекст: фаза, дни до старта, вес и цель подготовки."
        : language === "bg"
          ? "Състезателен контекст: фаза, дни до старт, тегло и цел на подготовката."
          : "Competition context: phase, days to start, weight, and preparation target."
      : activeWorkspace === "coach-dashboard"
        ? language === "ru"
          ? "Быстрый обзор спортсменов, статусы дня и приоритеты внимания."
          : language === "bg"
            ? "Бърз преглед на спортистите, дневни статуси и приоритети за внимание."
            : "Quick athlete overview, daily statuses, and attention priorities."
      : activeWorkspace === "coach-athletes"
        ? language === "ru"
          ? "Список спортсменов, привязка к тренеру и карточка выбранного спортсмена."
          : language === "bg"
            ? "Списък със спортисти, прикрепяне към треньор и карта на избрания спортист."
            : "Athlete roster, coach linking, and selected athlete profile."
      : activeWorkspace === "coach-analytics"
        ? language === "ru"
        ? "Ключевые сигналы, риски и практические рекомендации по выбранному спортсмену."
        : language === "bg"
          ? "Ключови сигнали, рискове и практически препоръки за избрания спортист."
            : "Key signals, risks, and practical coach recommendations for the selected athlete."
      : activeWorkspace === "coach-review"
        ? language === "ru"
        ? "Разбор выполнения, план и факт, отклонения по выбранному спортсмену."
        : language === "bg"
          ? "Преглед на изпълнението, план и реално изпълнение, отклонения за избрания спортист."
            : "Execution review, plan vs actual, and deviations for the selected athlete."
        : activeWorkspace === "planning-studio"
          ? language === "ru"
            ? "План подготовки, недельная работа и библиотека шаблонов."
            : language === "bg"
              ? "План за подготовка, седмична работа и библиотека с шаблони."
              : "Preparation plan, weekly work, and template library."
          : language === "ru"
            ? "Очередь синхронизации, локальные данные и конфликты восстановления сети."
            : language === "bg"
              ? "Опашка за синхронизация, локални данни и конфликти при възстановяване на мрежата."
              : "Sync queue, local data snapshots, and conflict handling when the network returns.";
  const workspaceTopActionLabel =
    activeWorkspace === "planning-studio"
      ? copyFor(language, {
          en: "Build week",
          ru: "Собрать неделю",
          bg: "Сглоби седмица",
        })
      : isCoachSceneWorkspace
        ? copyFor(language, {
            en: "Analytics",
            ru: "Аналитика",
            bg: "Анализ",
          })
        : ui("syncNow");
  const warningsLabel =
    language === "ru"
      ? "Предупреждения"
      : language === "bg"
        ? "Предупреждения"
        : "Warnings";
  const activeOfflineQueueItems = importedGetActiveQueueItems(offlineQueueItems);
  const offlineQueueStatusCounts = importedGetQueueStatusCounts(offlineQueueItems);
  const pendingReadinessQueued = activeOfflineQueueItems.some((item) => item.type === "readiness");
  const pendingExecutionBlockIds = new Set(
    activeOfflineQueueItems
      .filter((item): item is Extract<QueueItem, { type: "execution" }> => item.type === "execution")
      .map((item) => item.payload.assignedBlockId),
  );
  const pendingCoachDiaryQueued = activeOfflineQueueItems.some(
    (item) =>
      item.type === "coach-diary" &&
      item.payload.athleteId === selectedAthleteId &&
      item.payload.assignedPlanId === coachExecutionReview?.assignedPlanId,
  );
  const coachReviewDayOptions = selectedAthleteId
    ? assignedPlans
        .filter((plan) => plan.athleteId === selectedAthleteId)
        .slice()
        .sort((left, right) => left.day.dayDate.localeCompare(right.day.dayDate))
    : [];
  const coachDiaryTaskChoices: CoachDiaryTaskChoice[] = coachExecutionReview
    ? coachExecutionReview.sessions.flatMap((session) =>
        session.blocks.flatMap<CoachDiaryTaskChoice>((block) => {
          const exercises = [...(block.exercises ?? [])].sort(
            (left, right) => left.orderIndex - right.orderIndex,
          );

          if (exercises.length === 0) {
            return [
              {
                id: block.id,
                kind: "block" as const,
                label: block.name,
                meta: `${session.name} / ${translateExecutionStatus(block.executionStatus, language)}`,
              },
            ];
          }

          return exercises.map<CoachDiaryTaskChoice>((exercise) => ({
            id: exercise.id,
            kind: "exercise" as const,
            label: exercise.name,
            meta: `${block.name} / ${formatExerciseTarget(exercise, language)}`,
          }));
        }),
      )
    : [];
  const selectedCoachDiaryEntries = coachExecutionReview
    ? coachDiaryEntries
        .filter(
          (entry) =>
            entry.athleteId === selectedAthleteId &&
            entry.assignedPlanId === coachExecutionReview.assignedPlanId,
        )
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    : [];
  const latestCoachDiaryEntry = selectedCoachDiaryEntries[0] ?? null;
  const selectedCoachAiReviewHistory = coachExecutionReview
    ? getCoachAiReviewsForDay(coachAiReviews, selectedAthleteId, coachExecutionReview.dayDate)
    : [];
  const latestCoachAiReview = selectedCoachAiReviewHistory[0] ?? null;
  const selectedCoachReadinessEntry = coachExecutionReview
    ? (
        selectedAthleteEntries.find(
          (entry) =>
            entry.athleteId === selectedAthleteId &&
            entry.entryDate === coachExecutionReview.dayDate,
        ) ??
        coachReadinessEntries.find(
          (entry) =>
            entry.athleteId === selectedAthleteId &&
            entry.entryDate === coachExecutionReview.dayDate,
        ) ??
        null
      )
    : null;
  const selectedCoachDeviceHealthSummary = coachExecutionReview
    ? getDeviceHealthSummaryForDay(
        coachDeviceHealthSummaries,
        selectedAthleteId,
        coachExecutionReview.dayDate,
      )
    : null;
  const selectedCoachDeviceWorkouts = coachExecutionReview
    ? getDeviceWorkoutsForDay(
        coachDeviceWorkouts,
        selectedAthleteId,
        coachExecutionReview.dayDate,
      )
    : [];
  const selectedCoachDeviceWorkoutLinks = coachExecutionReview
    ? getDeviceWorkoutLinksForDay(
        coachDeviceWorkoutLinks,
        selectedAthleteId,
        coachExecutionReview.dayDate,
      )
    : [];
  const selectedCoachDayDataQuality = coachExecutionReview
    ? buildCoachDayDataQuality({
        coachComment: latestCoachDiaryEntry?.notes.trim() || null,
        deviceHealthSummary: selectedCoachDeviceHealthSummary,
        hasExecutionMarks: hasReviewExecutionMarks(coachExecutionReview),
        hasPlan: coachExecutionReview.summary.plannedBlocks > 0,
        language,
        readinessEntry: selectedCoachReadinessEntry,
      })
    : null;
  const coachTeamDayDate = coachExecutionReview?.dayDate ?? getDateInputValue();
  const coachTeamDayRows = coachAthletes.map((athlete) => {
    const plansForDay = assignedPlans.filter(
      (plan) => plan.athleteId === athlete.athleteId && plan.day.dayDate === coachTeamDayDate,
    );
    const readinessEntry =
      coachReadinessEntries.find(
        (entry) => entry.athleteId === athlete.athleteId && entry.entryDate === coachTeamDayDate,
      ) ?? null;
    const deviceHealthSummary = getDeviceHealthSummaryForDay(
      coachDeviceHealthSummaries,
      athlete.athleteId,
      coachTeamDayDate,
    );
    const planIds = new Set(plansForDay.map((plan) => plan.id));
    const dayResults = executionResults.filter(
      (result) => result.athleteId === athlete.athleteId && planIds.has(result.assignedPlanId),
    );
    const plannedLoad = roundCoachAiLoad(
      plansForDay.reduce(
        (total, plan) =>
          total +
          plan.day.sessions.reduce(
            (sessionTotal, session) =>
              sessionTotal +
              session.blocks.reduce((blockTotal, block) => blockTotal + estimateTrainingBlockLoad(block), 0),
            0,
          ),
        0,
      ),
    );
    const actualLoad = roundCoachAiLoad(
      dayResults.reduce((total, result) => total + (result.actualLoad ?? 0), 0),
    );
    const dataQuality = buildCoachDayDataQuality({
      coachComment:
        coachDiaryEntries.find(
          (entry) =>
            entry.athleteId === athlete.athleteId &&
            entry.entryDate === coachTeamDayDate,
        )?.notes.trim() || null,
      deviceHealthSummary,
      hasExecutionMarks: dayResults.length > 0,
      hasPlan: plansForDay.length > 0,
      language,
      readinessEntry,
    });
    const aiReview = getCoachAiReviewsForDay(
      coachAiReviews,
      athlete.athleteId,
      coachTeamDayDate,
    )[0] ?? null;

    return {
      actualLoad,
      aiReview,
      athlete,
      dataQuality,
      deviceHealthSummary,
      plannedLoad,
      readinessEntry,
      statusLabel: plansForDay.length === 0
        ? copyFor(language, { en: "No plan", ru: "Нет плана", bg: "Няма план" })
        : dayResults.length === 0
          ? copyFor(language, { en: "No execution", ru: "Нет отметок", bg: "Няма изпълнение" })
          : copyFor(language, { en: "Execution exists", ru: "Есть выполнение", bg: "Има изпълнение" }),
    };
  });
  const athleteChangedToday = adaptedPlan
    ? [
        ...adaptedPlan.reducedBlocks.map((name) => ({
          id: `reduce-${name}`,
          tone: "warning" as const,
          label: copyFor(language, {
            en: `Reduced load: ${name}`,
            ru: `Снижен объём: ${name}`,
            bg: `Намален обем: ${name}`,
          }),
        })),
        ...adaptedPlan.replacedBlocks.map((name) => ({
          id: `replace-${name}`,
          tone: "accent" as const,
          label: copyFor(language, {
            en: `Replaced block: ${name}`,
            ru: `Заменён блок: ${name}`,
            bg: `Заменен блок: ${name}`,
          }),
        })),
        ...adaptedPlan.removedBlocks.map((name) => ({
          id: `remove-${name}`,
          tone: "danger" as const,
          label: copyFor(language, {
            en: `Removed from today: ${name}`,
            ru: `Убрано из дня: ${name}`,
            bg: `Премахнато от деня: ${name}`,
          }),
        })),
      ]
    : [];
  const athleteExecutionCompletedBlocks = executionResults.filter((item) => item.completed).length;
  const athletePlannedBlocksCount =
    activeAthleteTrainingSessions.reduce((sum, session) => sum + session.blocks.length, 0);
  const athleteDayChecklist = [
    {
      id: "readiness",
      label: copyFor(language, {
        en: "Submit readiness",
        ru: "Отправить готовность",
        bg: "Подай готовност",
      }),
      value: todayEntry
        ? copyFor(language, {
            en: "Done",
            ru: "Готово",
            bg: "Готово",
          })
        : copyFor(language, {
            en: "Waiting",
            ru: "Ожидается",
            bg: "Очаква се",
          }),
    },
    {
      id: "adaptation",
      label: copyFor(language, {
        en: "Check what changed",
        ru: "Проверить изменения дня",
        bg: "Провери промените за деня",
      }),
      value: adaptedPlan ? String(athleteChangedToday.length) : ui("notGenerated"),
    },
    {
      id: "execution",
      label: copyFor(language, {
        en: "Log execution",
        ru: "Зафиксировать выполнение",
        bg: "Запиши изпълнението",
      }),
      value: `${athleteExecutionCompletedBlocks}/${athletePlannedBlocksCount || 0}`,
    },
  ];
  const coachViewLabel =
    coachTabs.find((tab) => tab.id === coachView)?.label ?? coachTabs[0]?.label ?? "";
  const coachViewDescription =
    coachView === "readiness"
      ? copyFor(language, {
          en: "Monitor the last readiness entries, recovery drift, and current daily state.",
        ru: "Следите за последними записями готовности, динамикой восстановления и текущим состоянием дня.",
        bg: "Следете последните записи за готовност, динамиката на възстановяване и текущото състояние за деня.",
        })
      : coachView === "adaptation"
        ? copyFor(language, {
            en: "Review the adapted day, the retained blocks, and the reasoning behind changes.",
            ru: "Проверьте адаптированный день, сохранённые блоки и причины внесённых изменений.",
            bg: "Прегледайте адаптирания ден, запазените блокове и причините за промените.",
          })
        : coachView === "execution"
          ? copyFor(language, {
              en: "Compare planned versus actual execution and spot gaps before they accumulate.",
              ru: "Сравнивайте план и факт выполнения, чтобы замечать отклонения до накопления риска.",
              bg: "Сравнявайте план и реално изпълнение, за да хващате отклоненията преди да се натрупат.",
            })
          : coachView === "competition"
            ? copyFor(language, {
                en: "Track the active competition chain from season structure through result capture.",
                ru: "Контролируйте активную соревновательную цепочку от структуры сезона до фиксации результата.",
                bg: "Следете активната състезателна верига от сезонната структура до записания резултат.",
              })
            : copyFor(language, {
                en: "Surface readiness, adherence, and load patterns that need a coaching decision.",
        ru: "Выводите закономерности готовности, соблюдения плана и нагрузки, которые требуют решения тренера.",
        bg: "Показвайте закономерности в готовността, спазването на плана и натоварването, които изискват треньорско решение.",
          });
  const coachSceneDescription =
    activeWorkspace === "coach-dashboard" ? coachViewDescription : workspaceSummary;
  const planningViewLabel =
    planningTabs.find((tab) => tab.id === planningView)?.label ?? planningTabs[0]?.label ?? "";
  const planningViewDescription =
    planningView === "calendar"
      ? copyFor(language, {
          en: "Manage the competition calendar, UWW sync, and anchor dates.",
          ru: "Ведите календарь соревнований, синхронизацию UWW и ключевые даты.",
          bg: "Управлявайте календара на състезанията, синхронизацията с UWW и ключовите дати.",
        })
      : planningView === "season"
        ? copyFor(language, {
            en: "Link long-term cycles, season strategy, starts, and actual results in one chain.",
            ru: "Свяжите долгосрочные циклы, стратегию сезона, старты и реальные результаты в одну цепочку.",
            bg: "Свържете дългосрочните цикли, сезонната стратегия, стартовете и реалните резултати в една верига.",
          })
        : planningView === "mesocycle"
          ? copyFor(language, {
              en: "Shape the 3–6 week block with phase, progression, and the weekly targets it drives.",
              ru: "Сформируйте блок на 3–6 недель с фазой, прогрессией и недельными целями.",
              bg: "Оформете блок от 3–6 седмици с фаза, прогресия и седмични цели.",
            })
        : planningView === "preparation"
          ? copyFor(language, {
              en: "Set the period: goal, dates, phase, target starts, and weekly load.",
              ru: "Настройте период: цель, даты, фазу, главные старты и нагрузку по неделям.",
        bg: "Настройте периода: цел, дати, фаза, основни стартове и седмично натоварване.",
            })
          : planningView === "templates"
            ? copyFor(language, {
                en: "Keep reusable days, weeks, and full plans here. Edit first, assign only when needed.",
                ru: "Храните здесь дни, недели и полные планы. Сначала редактируйте, назначайте только нужное.",
                bg: "Съхранявайте тук дни, седмици и цели планове. Първо редактирайте, назначавайте само нужното.",
              })
            : copyFor(language, {
                en: "Build the working week: days, sessions, exercises, control, and assigned plans.",
        ru: "Соберите рабочую неделю: дни, тренировки, упражнения, контроль и назначенные планы.",
        bg: "Сглобете работната седмица: дни, тренировки, упражнения, контрол и назначени планове.",
              });
  const uwwYearOptions = withFallbackOptions(
    uwwSyncOptions.years,
    uwwSyncFilters.year,
  );
  const uwwAgeGroupOptions = withFallbackOptions(
    uwwSyncOptions.ageGroups,
    uwwSyncFilters.ageGroup,
  );
  const uwwStyleOptions = withFallbackOptions(
    uwwSyncOptions.styles,
    uwwSyncFilters.style,
  );
  const uwwEventTypeOptions = withFallbackOptions(
    uwwSyncOptions.eventTypes,
    uwwSyncFilters.eventType,
  );
  const uwwCountryOptions = withFallbackOptions(
    uwwSyncOptions.countries,
    uwwSyncFilters.country,
  );
  const selectedCalendarCompetitions = competitions.filter((competition) =>
    selectedCompetitionIds.includes(competition.id),
  );
  const selectedCalendarCompetitionCount = selectedCalendarCompetitions.length;
  const allCalendarCompetitionsSelected =
    competitions.length > 0 && selectedCalendarCompetitionCount === competitions.length;
  const selectedPlanTemplates = planTemplates.filter((template) =>
    selectedPlanTemplateIds.includes(template.id),
  );
  const selectedPlanTemplateCount = selectedPlanTemplates.length;
  const allPlanTemplatesSelected =
    planTemplates.length > 0 && selectedPlanTemplateCount === planTemplates.length;
  const activePlanTemplate =
    planTemplates.find((template) => template.id === assignedPlanForm.templateId) ??
    planTemplates[0] ??
    null;
  const activeTemplateDays = activePlanTemplate
    ? getTemplateStructureDays(activePlanTemplate, language)
    : [];
  const templateWorkspaceSource =
    importedPlanDraft?.template ?? (isTemplateDraftActive ? planForm : activePlanTemplate ?? planForm);
  const templateWorkspaceDays = getTemplateStructureDays(templateWorkspaceSource, language);
  const templateWorkspaceWeeks = groupTemplateDaysByWeek(templateWorkspaceDays);
  const normalizedSelectedTemplateDayIndex = normalizeTemplateDayIndex(
    templateWorkspaceDays,
    selectedTemplateDayIndex,
  );
  const selectedTemplateDay = templateWorkspaceDays[normalizedSelectedTemplateDayIndex] ?? null;
  const templateWorkspaceBlockCount = templateWorkspaceDays.reduce(
    (total, day) => total + countTemplateDayBlocks(day),
    0,
  );
  const templateWorkspaceExerciseCount = templateWorkspaceDays.reduce(
    (total, day) => total + countTemplateDayExercises(day),
    0,
  );
  const assignmentTemplateDays =
    importedPlanDraft || isTemplateDraftActive ? templateWorkspaceDays : activeTemplateDays;
  const selectedTemplateAssignmentIndexes = getAssignmentDayIndexes(
    assignmentTemplateDays,
    selectedTemplateAssignMode,
    selectedTemplateDayIndex,
    selectedTemplateAssignDayIndexes,
  );
  const selectedTemplateAssignmentCount = selectedTemplateAssignmentIndexes.length;
  const selectedAssignedPlans = assignedPlans.filter((plan) =>
    selectedAssignedPlanIds.includes(plan.id),
  );
  const selectedAssignedPlanCount = selectedAssignedPlans.length;
  const allAssignedPlansSelected =
    assignedPlans.length > 0 && selectedAssignedPlanCount === assignedPlans.length;
  const selectedPreparationWeek =
    preparationPlanDraft.weeks[selectedPreparationWeekIndex] ?? preparationPlanDraft.weeks[0] ?? null;
  const selectedPreparationDay =
    selectedPreparationWeek?.days[selectedPreparationDayIndex] ?? selectedPreparationWeek?.days[0] ?? null;
  const selectedPreparationSession =
    selectedPreparationDay?.sessions[selectedPreparationSessionIndex] ??
    selectedPreparationDay?.sessions[0] ??
    null;
  const preparationPlanStats = preparationPlanDraft.weeks.reduce(
    (stats, week) => {
      const dayCount = week.days.length;
      const sessionCount = week.days.reduce((total, day) => total + day.sessions.length, 0);
      const exerciseCount = week.days.reduce(
        (total, day) =>
          total +
          day.sessions.reduce((sessionTotal, session) => sessionTotal + session.rows.length, 0),
        0,
      );

      return {
        weeks: stats.weeks + 1,
        days: stats.days + dayCount,
        sessions: stats.sessions + sessionCount,
        exercises: stats.exercises + exerciseCount,
      };
    },
    { weeks: 0, days: 0, sessions: 0, exercises: 0 },
  );
  const preparationPlanSetupStats = [
    {
      label: copyFor(language, { en: "Weeks", ru: "Недели", bg: "Седмици" }),
      value: String(preparationPlanStats.weeks),
    },
    {
      label: copyFor(language, { en: "Training days", ru: "Тренировочные дни", bg: "Тренировъчни дни" }),
      value: String(preparationPlanStats.days),
    },
    {
      label: copyFor(language, { en: "Sessions", ru: "Сессии", bg: "Сесии" }),
      value: String(preparationPlanStats.sessions),
    },
    {
      label: copyFor(language, { en: "Exercises", ru: "Упражнения", bg: "Упражнения" }),
      value: String(preparationPlanStats.exercises),
    },
    {
      label: copyFor(language, { en: "Monitoring", ru: "Мониторинг", bg: "Мониторинг" }),
      value: String(preparationPlanDraft.monitoringDates.length),
    },
  ];
  const selectedOfflineItem =
    offlineQueueItems.find((item) => item.id === selectedOfflineItemId) ?? offlineQueueItems[0] ?? null;
  const athleteSceneMetrics = [
    {
      label: copyFor(language, {
        en: "Readiness",
        ru: "Готовность",
        bg: "Готовност",
      }),
      value: todayEntry ? readinessMeta[todayEntry.status].label : ui("noEntriesYet"),
      note: todayEntry ? `Score ${todayEntry.score}` : ui("saveReadiness"),
    },
    {
      label: copyFor(language, {
        en: "Assigned day",
        ru: "Назначенный день",
        bg: "Назначен ден",
      }),
      value: activeAthleteTrainingDayLabel,
      note: primaryAssignedPlan?.templateName ?? ui("notGenerated"),
    },
    {
      label: copyFor(language, {
        en: "Competition phase",
        ru: "Соревновательная фаза",
        bg: "Състезателна фаза",
      }),
      value: competitionContext?.phase ?? activePhaseLabel,
      note:
        competitionContext?.daysToCompetition !== null &&
        competitionContext?.daysToCompetition !== undefined
          ? `${copyFor(language, {
              en: "Days to competition",
              ru: "До старта",
              bg: "До старт",
            })}: ${competitionContext.daysToCompetition}`
          : ui("notGenerated"),
    },
    {
      label: copyFor(language, {
        en: "Execution",
        ru: "Выполнение",
        bg: "Изпълнение",
      }),
      value: String(executionResults.filter((item) => item.completed).length),
      note:
        primaryAssignedPlan?.day.sessions.reduce((sum, session) => sum + session.blocks.length, 0) ??
        0
          ? `${copyFor(language, {
              en: "Planned blocks",
              ru: "Плановых блоков",
              bg: "Планирани блокове",
            })}: ${primaryAssignedPlan?.day.sessions.reduce(
              (sum, session) => sum + session.blocks.length,
              0,
            ) ?? 0}`
          : ui("noActivePlan"),
    },
  ];
  const coachSceneMetrics = [
    {
      label: ui("latestReadiness"),
      value: latestVisibleReadiness,
      note: selectedCoachAthlete?.email ?? ui("selectAthlete"),
    },
    {
      label: t("executionReview"),
      value: coachExecutionReview ? `${coachExecutionReview.summary.completionRate}%` : ui("noReviewYet"),
      note:
        coachExecutionReview
          ? `${coachExecutionReview.summary.completedBlocks}/${coachExecutionReview.summary.plannedBlocks}`
          : ui("coachReviewNeedsPlan"),
    },
    {
      label: copyFor(language, {
        en: "Competition phase",
        ru: "Соревновательная фаза",
        bg: "Състезателна фаза",
      }),
      value: competitionContext?.phase ?? ui("notGenerated"),
      note: competitionContext?.competitionPriority ?? "-",
    },
    {
      label: t("analytics"),
      value: coachAnalyticsOverview ? String(coachAnalyticsOverview.loadTrend.length) : "0",
      note: coachViewLabel,
    },
  ];
  const planningSceneMetrics = [
    {
      label: copyFor(language, {
        en: "Phase",
        ru: "Фаза",
        bg: "Фаза",
      }),
      value: activePhaseLabel,
      note: planningViewLabel,
    },
    {
      label: copyFor(language, {
        en: "Library",
        ru: "Библиотека",
        bg: "Библиотека",
      }),
      value: String(planTemplates.length),
      note: t("savedTemplates"),
    },
    {
      label: copyFor(language, {
        en: "Competition plans",
        ru: "Планы стартов",
        bg: "Планове за старт",
      }),
      value: String(competitionPlans.length),
      note: competitions.length
        ? `${competitions.length} ${copyFor(language, {
            en: "competitions",
            ru: "соревнований",
            bg: "състезания",
          })}`
        : ui("notGenerated"),
    },
    {
      label: copyFor(language, {
        en: "Mesocycles",
        ru: "Мезоциклы",
        bg: "Мезоцикли",
      }),
      value: String(mesocycles.length),
      note:
        templatePack?.warnings?.length
          ? `${templatePack.warnings.length} ${warningsLabel.toLowerCase()}`
          : copyFor(language, {
              en: "No active warnings",
              ru: "Нет активных предупреждений",
              bg: "Няма активни предупреждения",
            }),
    },
  ];
  const offlineSceneMetrics = [
    {
      label: stateLabelText,
      value: importedSyncStateLabel(language, isOffline, offlineQueueSize),
      note: importedQueueLabel(language, offlineQueueSize),
    },
    {
      label: ui("pendingItems"),
      value: String(offlineQueueSize),
      note: `${ui("synced")}: ${offlineQueueStatusCounts.synced}`,
    },
    {
      label: ui("readinessCache"),
      value: readinessCacheSavedAt ?? "-",
      note: assignedCacheSavedAt ?? "-",
    },
    {
      label: ui("analyticsCache"),
      value: analyticsCacheSavedAt ?? "-",
      note: executionCacheSavedAt ?? "-",
    },
  ];
  const workspaceTopActionDisabled =
    activeWorkspace === "planning-studio"
      ? !canSeeCoachWorkspace
      : isCoachSceneWorkspace
        ? !canSeeCoachWorkspace
        : isSyncingNow || isOffline || offlineQueueSize === 0;
  const workspaceTopActionButtonLabel =
    isSyncingNow &&
    (isAthleteSceneWorkspace || activeWorkspace === "offline-center")
      ? ui("syncingNow")
      : workspaceTopActionLabel;
  const showWorkspaceTopAction = Boolean(
    user && (isAthleteSceneWorkspace || activeWorkspace === "planning-studio" || activeWorkspace === "coach-dashboard"),
  );
  const showTopbarAthleteSelect =
    canSeeCoachWorkspace && activeWorkspace !== "offline-center";
  const topbarSelects = [
    ...(showTopbarAthleteSelect
      ? [
          {
            label: t("athlete"),
            value: selectedAthleteId,
            options: [
              { value: "", label: ui("selectAthlete") },
              ...coachAthletes.map((athlete) => ({
                value: athlete.athleteId,
                label: athlete.fullName,
              })),
              ...availableCoachAthletes.map((athlete) => ({
                value: `attach:${athlete.athleteId}`,
                label: copyFor(language, {
                  en: `+ Attach: ${athlete.fullName}`,
                  ru: `+ Прикрепить: ${athlete.fullName}`,
                  bg: `+ Прикачи: ${athlete.fullName}`,
                }),
              })),
            ],
            onChange: (value: string) => {
              if (!value) {
                resetCoachAthleteSelection();
                return;
              }

              if (value.startsWith("attach:")) {
                void handleAttachCoachAthlete(value.slice("attach:".length));
                return;
              }

              void handleCoachAthleteChange(value);
            },
          },
        ]
      : []),
  ];
  const selectedLanguageLabel =
    language.toUpperCase();
  const topbarLanguageMenu = {
    label: t("language"),
    valueLabel: selectedLanguageLabel,
    options: I18N_LANGUAGE_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
      active: option.value === language,
      onSelect: () => setLanguage(option.value as Language),
    })),
  };
  const topbarDownloadLink = {
    href: mobileAppDownloadUrl,
    label: copyFor(language, {
      en: "Download",
      ru: "Скачать",
      bg: "Изтегли",
    }),
    title: copyFor(language, {
      en: "Download the mobile app",
      ru: "Скачать мобильное приложение",
      bg: "Изтегляне на мобилното приложение",
    }),
  };
  const guestAccessSection = !user ? (
    <>
      <div className="toggle-row compact-tab-row workspace-profile-auth-tabs">
        <button
          className={authMode === "login" ? "tab-active" : "tab-button"}
          onClick={() => setAuthMode("login")}
          type="button"
        >
          {t("login")}
        </button>
        <button
          className={authMode === "register" ? "tab-active" : "tab-button"}
          onClick={() => setAuthMode("register")}
          type="button"
        >
          {t("register")}
        </button>
      </div>
      <form className="auth-form workspace-profile-auth-form" onSubmit={handleAuthSubmit}>
        {authMode === "register" ? (
          <label className="field">
            <span>{t("fullName")}</span>
            <input
              value={authForm.fullName}
              onChange={(event) =>
                setAuthForm((current) => ({
                  ...current,
                  fullName: event.target.value,
                }))
              }
              required
            />
          </label>
        ) : null}
        <label className="field">
          <span>{t("email")}</span>
          <input
            type="email"
            value={authForm.email}
            onChange={(event) =>
              setAuthForm((current) => ({
                ...current,
                email: event.target.value,
              }))
            }
            required
          />
        </label>
        <label className="field">
          <span>{t("password")}</span>
          <input
            type="password"
            value={authForm.password}
            onChange={(event) =>
              setAuthForm((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
            required
          />
        </label>
        {authMode === "register" ? (
          <label className="field">
            <span>{t("role")}</span>
            <select
              value={authForm.role}
              onChange={(event) =>
                setAuthForm((current) => ({
                  ...current,
                  role: event.target.value as AuthFormState["role"],
                }))
              }
            >
              {SELF_REGISTRATION_ROLES.map((role) => (
                <option key={role.id} value={role.id}>
                  {translateRoleName(role.id, language)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button className="primary-button workspace-profile-auth-submit" disabled={busy} type="submit">
          {busy
            ? ui("pleaseWait")
            : authMode === "login"
              ? t("signIn")
              : t("createAccount")}
        </button>
      </form>
      {errorMessage ? <p className="error-copy">{errorMessage}</p> : null}
    </>
  ) : undefined;
  const profileStatusItem = SHOW_OFFLINE_CENTER_NAV && user
    ? offlineQueueStatusCounts.failed > 0
      ? {
          label: ui("offlineSyncCenter"),
          value: copyFor(language, {
            en: "Sync error",
            ru: "Ошибка синхронизации",
            bg: "Грешка при синхронизация",
          }),
          tone: "failed" as const,
          onSelect: () => {
            setActiveWorkspace("offline-center");
            scrollViewportToTop();
          },
        }
      : offlineQueueStatusCounts.pending > 0
        ? {
            label: ui("offlineSyncCenter"),
            value: copyFor(language, {
              en: `${offlineQueueStatusCounts.pending} pending`,
              ru: `${offlineQueueStatusCounts.pending} в очереди`,
              bg: `${offlineQueueStatusCounts.pending} в опашка`,
            }),
            tone: "pending" as const,
            onSelect: () => {
              setActiveWorkspace("offline-center");
              scrollViewportToTop();
            },
          }
        : undefined
    : undefined;
  const topbarAuthActions = !user
    ? {
        loginLabel: t("login"),
        registerLabel: t("register"),
        activeMode: authMode,
        onLogin: () => {
          setAuthMode("login");
          setGuestAccessOpen(true);
          scrollViewportToTop();
        },
        onRegister: () => {
          setAuthMode("register");
          setGuestAccessOpen(true);
          scrollViewportToTop();
        },
      }
    : undefined;
  const topbarAthleteProfileDetails =
    user?.role === "athlete" ? (
      <div className="workspace-athlete-menu-card">
        <div className="workspace-athlete-menu-head">
          <div
            aria-label={user.fullName}
            className="workspace-athlete-menu-photo"
            role="img"
            style={user.photoUrl ? { backgroundImage: `url("${user.photoUrl}")` } : undefined}
          >
            {!user.photoUrl ? <span>{initialsFor(user.fullName)}</span> : null}
          </div>
          <div className="workspace-athlete-menu-title">
            <strong>{user.fullName}</strong>
            <small>{user.email}</small>
          </div>
        </div>

        <div className="workspace-profile-info-grid workspace-athlete-menu-grid">
          <article className="workspace-profile-info-card">
            <span>{copyFor(language, { en: "Height", ru: "Рост", bg: "Ръст" })}</span>
            <strong>{user.heightCm ? `${user.heightCm} см` : "-"}</strong>
          </article>
          <article className="workspace-profile-info-card">
            <span>{copyFor(language, { en: "Weight", ru: "Вес", bg: "Тегло" })}</span>
            <strong>{user.baselineWeightKg ? `${user.baselineWeightKg} кг` : "-"}</strong>
          </article>
          <article className="workspace-profile-info-card">
            <span>{copyFor(language, { en: "Age", ru: "Возраст", bg: "Възраст" })}</span>
            <strong>{getAthleteAge(user.birthDate ?? null) ?? "-"}</strong>
          </article>
          <article className="workspace-profile-info-card">
            <span>{copyFor(language, { en: "Resting HR", ru: "Пульс покоя", bg: "Пулс в покой" })}</span>
            <strong>{user.baselineRestingHr ?? "-"}</strong>
          </article>
          <article className="workspace-profile-info-card">
            <span>{copyFor(language, { en: "Sport", ru: "Спорт", bg: "Спорт" })}</span>
            <strong>{user.sport || "-"}</strong>
          </article>
          <article className="workspace-profile-info-card">
            <span>{copyFor(language, { en: "Class", ru: "Категория", bg: "Категория" })}</span>
            <strong>{user.weightClass || "-"}</strong>
          </article>
        </div>

        {todayEntry ? (
          <div className="workspace-profile-status-link workspace-athlete-menu-readiness">
            <span>{ui("latestReadiness")}</span>
            <strong>{`${readinessMeta[todayEntry.status].label} (${todayEntry.score})`}</strong>
          </div>
        ) : null}
      </div>
    ) : undefined;
  const topbarProfileMenu = user
    ? {
        avatarLabel: initialsFor(user.fullName),
        name: user.fullName,
        meta: translateRoleName(user.role, language),
        profileDetails: topbarAthleteProfileDetails,
        statusItem: profileStatusItem,
        signOutLabel: t("logout"),
        onSignOut: handleLogout,
      }
    : undefined;
  const guestAccessTitle = authMode === "login" ? t("login") : t("register");
  const closeGuestAccessLabel = copyFor(language, {
    en: "Close",
    ru: "Закрыть",
    bg: "Затвори",
  });
  const workspaceStageTabs =
    activeWorkspace === "planning-studio" ? (
      <div className="toggle-row compact-tab-row planning-nav-row workspace-stage-tabs">
        {planningTabs.map((tab) => (
          <button
            className={planningView === tab.id ? "tab-active" : "tab-button"}
            key={tab.id}
            onClick={() => setPlanningView(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
    ) : null;
  const workspaceRailNote = errorMessage || statusMessage || ui("signInHint");

  useEffect(() => {
    const nextWorkspace = resolveAccessibleWorkspace(activeWorkspace, canSeeCoachWorkspace);
    if (nextWorkspace !== activeWorkspace) {
      setActiveWorkspace(nextWorkspace);
    }
  }, [activeWorkspace, canSeeCoachWorkspace]);

  useEffect(() => {
    if (activeWorkspace === "coach-dashboard") {
      setCoachView("readiness");
      return;
    }

    if (activeWorkspace === "coach-analytics") {
      setCoachView("analytics");
      return;
    }

    if (activeWorkspace === "coach-review") {
      setCoachView("execution");
      return;
    }

    if (activeWorkspace === "coach-athletes") {
      setCoachView("readiness");
    }
  }, [activeWorkspace]);

  useEffect(() => {
    if (isAthleteTodayWorkspace) {
      setIsCheckinOpen(true);
    }
  }, [isAthleteTodayWorkspace]);

  useEffect(() => {
    if (isPreviewMode) {
      return;
    }

    scrollViewportToTop();
  }, [isPreviewMode, user?.id, user?.role]);

  function handleWorkspaceTopAction() {
    if (activeWorkspace === "planning-studio") {
      setPlanningView("weekly");
      return;
    }

    if (activeWorkspace === "coach-dashboard") {
      setCoachView("analytics");
      return;
    }

    void handleSyncNow();
  }

  return (
    <main className="page-shell">
      <section className="top-shell" id="top">
        <WorkspaceTopBar
          actionDisabled={showWorkspaceTopAction ? workspaceTopActionDisabled : undefined}
          actionLabel={showWorkspaceTopAction ? workspaceTopActionButtonLabel : undefined}
          authActions={topbarAuthActions}
          downloadLink={topbarDownloadLink}
          languageMenu={topbarLanguageMenu}
          onAction={showWorkspaceTopAction ? handleWorkspaceTopAction : undefined}
          profileMenu={topbarProfileMenu}
          selects={topbarSelects}
          title={topbarTitle}
        />

        <nav className="panel workspace-quick-nav" aria-label={workspaceSectionsLabel}>
          <span>{workspaceSectionsLabel}</span>
          <div className="workspace-quick-nav-links">
            {workspaceLinks.map((link) => (
              <button
                aria-current={activeWorkspace === link.id ? "page" : undefined}
                className={`workspace-quick-nav-link ${
                  activeWorkspace === link.id ? "workspace-quick-nav-link-active" : ""
                }`.trim()}
                key={link.id}
                onClick={() => {
                  setActiveWorkspace(link.id);
                  scrollViewportToTop();
                }}
                type="button"
              >
                <strong>{link.label}</strong>
                <small>{link.meta}</small>
              </button>
            ))}
          </div>
        </nav>

        {!user && guestAccessOpen && guestAccessSection ? (
          <div className="panel workspace-access-dock">
            <div className="summary-topline">
              <strong>{guestAccessTitle}</strong>
              <button
                className="secondary-button workspace-access-close"
                onClick={() => setGuestAccessOpen(false)}
                type="button"
              >
                {closeGuestAccessLabel}
              </button>
            </div>
            {guestAccessSection}
          </div>
        ) : null}

        <div className="panel workspace-command-bar">
          <div className="workspace-command-head">
            <div className="workspace-command-copy">
              <span className="eyebrow eyebrow-muted">{currentWorkspaceLabel}</span>
              <h1>{workspaceTitle}</h1>
              <p>{statusMessage || workspaceSummary}</p>
            </div>

            <div className="workspace-command-meta">
              <article className="command-meta-card">
                <span>{t("athlete")}</span>
                <strong>{activeAthleteLabel}</strong>
                <small>{latestVisibleReadiness}</small>
              </article>
              <article className="command-meta-card">
                <span>{stateLabelText}</span>
                <strong>{importedSyncStateLabel(language, isOffline, offlineQueueSize)}</strong>
                <small>{importedQueueLabel(language, offlineQueueSize)}</small>
              </article>
              <article className="command-meta-card">
                <span>API</span>
                <strong>{apiBaseUrl}</strong>
                <small>{productTitle}</small>
              </article>
            </div>
          </div>

          <div className="workspace-kpi-strip">
            {topOverviewItems.map((item) => (
              <article className="workspace-kpi" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.note}</small>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div
        className={`workspace-layout ${
          isAthleteSceneWorkspace ? "workspace-layout-athlete" : ""
        } ${
          isCoachSceneWorkspace ? "workspace-layout-coach" : ""
        } ${
          activeWorkspace === "planning-studio" ? "workspace-layout-planning" : ""
        }`.trim()}
      >
        <WorkspaceRail
          activeId={activeWorkspace}
          activeItem={activeWorkspaceItem}
          currentWorkspaceLabel={currentWorkspaceLabel}
          links={workspaceLinks}
          note={workspaceRailNote}
          noteIsError={Boolean(errorMessage)}
          onSelect={setActiveWorkspace}
          productEyebrow={productEyebrow}
          productTitle={productTitle}
          sectionsLabel={workspaceSectionsLabel}
          stats={isCoachDashboardWorkspace ? [] : railStats}
        />

        <div className="workspace-stage">
          {!isAthleteSceneWorkspace && !isCoachDashboardWorkspace ? (
            <WorkspaceStageHeader
              eyebrow={activeWorkspaceItem.label}
              hideCopy={activeWorkspace === "planning-studio"}
              summary={workspaceSummary}
              tabs={workspaceStageTabs}
              title={workspaceTitle}
            />
          ) : null}

          <div className="workspace-content">
      {isAthleteSceneWorkspace ? (
      <AthleteWorkspaceScene isGuest={!user}>
        {null}

        {!user ? (
        <AthleteWorkspace
          guestLabel={ui("guest")}
          isGuest
          metrics={athleteSceneMetrics}
          previewCards={athletePreviewCards}
          summaryItems={athleteSummaryItems}
          title={workspaceTitle}
        >
          {null}
        </AthleteWorkspace>
        ) : null}

        {user ? (
        <AthleteWorkspace
          guestLabel={ui("guest")}
          isGuest={false}
          metrics={athleteSceneMetrics}
          previewCards={athletePreviewCards}
          summaryItems={athleteSummaryItems}
          title={workspaceTitle}
        >
        {isAthleteCompetitionsWorkspace ? (
        <div className="anchor-panel athlete-competitions-view" id="athlete-competitions">
          <div className="section-head">
            <h2>
              {copyFor(language, {
                en: "My competitions",
                ru: "Мои соревнования",
                bg: "Моите състезания",
              })}
            </h2>
            <div className="section-head-actions">
              <span className="eyebrow eyebrow-muted">
                {copyFor(language, {
                  en: "Read-only athlete view",
                  ru: "Витрина спортсмена",
                  bg: "Витрина за спортиста",
                })}
              </span>
            </div>
          </div>

          <div className="athlete-competition-hero">
            <article className="entry-summary athlete-competition-card athlete-competition-card-primary">
              <div className="summary-topline">
                <strong>
                  {hasSelectedAthleteCompetitionPlan
                    ? copyFor(language, {
                        en: "Selected start",
                        ru: "Выбранный старт",
                        bg: "Избран старт",
                      })
                    : copyFor(language, {
                        en: "Next start",
                        ru: "Ближайший старт",
                        bg: "Най-близък старт",
                      })}
                </strong>
                <span className={`status-chip ${currentAthleteCompetitionPlan ? "accent" : "idle"}`}>
                  {currentAthleteCompetitionPlan?.priority ?? "-"}
                </span>
              </div>
              {currentAthleteCompetitionPlan ? (
                <>
                  <h3>{currentAthleteCompetitionPlan.competitionTitle}</h3>
                  <p className="athlete-scene-note">
                    {currentAthleteCompetition?.location || currentAthleteCompetition?.federation
                      ? [currentAthleteCompetition.location, currentAthleteCompetition.federation]
                          .filter(Boolean)
                          .join(" / ")
                      : copyFor(language, {
                          en: "Location is not specified yet.",
                          ru: "Место пока не указано.",
                          bg: "Мястото все още не е зададено.",
                        })}
                  </p>
                  <div className="context-chip-grid">
                    <article className="context-chip">
                      <span>
                        {copyFor(language, {
                          en: "Competition dates",
                          ru: "Даты соревнования",
                          bg: "Дати на състезанието",
                        })}
                      </span>
                      <strong>
                        {currentAthleteCompetitionPlan.competitionStartDate} {"->"}{" "}
                        {currentAthleteCompetitionPlan.competitionEndDate}
                      </strong>
                    </article>
                    <article className="context-chip">
                      <span>{t("priority")}</span>
                      <strong>{currentAthleteCompetitionPlan.priority}</strong>
                    </article>
                    <article className="context-chip">
                      <span>
                        {copyFor(language, {
                          en: "Days to start",
                          ru: "До старта",
                          bg: "До старт",
                        })}
                      </span>
                      <strong>{currentAthleteDaysToStartValue}</strong>
                    </article>
                    <article className="context-chip">
                      <span>
                        {copyFor(language, {
                          en: "Level",
                          ru: "Уровень",
                          bg: "Ниво",
                        })}
                      </span>
                      <strong>{currentAthleteCompetition?.level ?? "-"}</strong>
                    </article>
                    <article className="context-chip">
                      <span>
                        {copyFor(language, {
                          en: "Age group",
                          ru: "Возрастная группа",
                          bg: "Възрастова група",
                        })}
                      </span>
                      <strong>{currentAthleteCompetition?.ageGroup || "-"}</strong>
                    </article>
                  </div>
                </>
              ) : (
                <p className="placeholder-copy">
                  {copyFor(language, {
                    en: "No competitions are linked to your athlete profile yet.",
                    ru: "К вашему профилю спортсмена пока не привязаны соревнования.",
                    bg: "Към вашия профил на спортист все още няма свързани състезания.",
                  })}
                </p>
              )}
            </article>

            <article className="entry-summary athlete-competition-card">
              <div className="summary-topline">
                <strong>
                  {copyFor(language, {
                    en: "Preparation status",
                    ru: "Статус подготовки",
                    bg: "Статус на подготовката",
                  })}
                </strong>
                <span
                  className={`status-chip ${
                    currentAthleteCompetitionPhaseValue ? "accent" : "idle"
                  }`}
                >
                  {currentAthleteCompetitionPhase}
                </span>
              </div>
              <div className="context-chip-grid">
                <article className="context-chip">
                  <span>
                    {copyFor(language, {
                      en: "Days to start",
                      ru: "До старта",
                      bg: "До старт",
                    })}
                  </span>
                  <strong>{currentAthleteDaysToStartValue}</strong>
                </article>
                <article className="context-chip">
                  <span>{t("phase")}</span>
                  <strong>{currentAthleteCompetitionPhase}</strong>
                </article>
                <article className="context-chip">
                  <span>
                    {copyFor(language, {
                      en: "Taper",
                      ru: "Подводка",
                      bg: "Тейпър",
                    })}
                  </span>
                  <strong>
                    {currentAthleteTaperState
                      ? copyFor(language, { en: "yes", ru: "да", bg: "да" })
                      : copyFor(language, { en: "no", ru: "нет", bg: "не" })}
                  </strong>
                </article>
                <article className="context-chip">
                  <span>
                    {copyFor(language, {
                      en: "Weight cut",
                      ru: "Весогонка",
                      bg: "Сваляне на тегло",
                    })}
                  </span>
                  <strong>
                    {currentAthleteWeightCutState
                      ? copyFor(language, { en: "yes", ru: "да", bg: "да" })
                      : copyFor(language, { en: "no", ru: "нет", bg: "не" })}
                  </strong>
                </article>
              </div>
            </article>
          </div>

          <article className="entry-summary athlete-competition-card">
            <div className="summary-topline">
              <strong>
                {copyFor(language, {
                  en: "Preparation plan",
                  ru: "План подготовки",
                  bg: "План за подготовка",
                })}
              </strong>
              <span>{currentAthleteCompetitionPlan?.planType ?? "-"}</span>
            </div>
            {currentAthleteCompetitionPlan ? (
              <div className="context-chip-grid">
                <article className="context-chip">
                  <span>
                    {copyFor(language, {
                      en: "Preparation period",
                      ru: "Период подготовки",
                      bg: "Период на подготовка",
                    })}
                  </span>
                  <strong>
                    {currentAthleteCompetitionPlan.prepStartDate} {"->"}{" "}
                    {currentAthleteCompetitionPlan.prepEndDate}
                  </strong>
                </article>
                <article className="context-chip">
                  <span>
                    {copyFor(language, {
                      en: "Target weight",
                      ru: "Целевой вес",
                      bg: "Целево тегло",
                    })}
                  </span>
                  <strong>
                    {currentAthleteCompetitionPlan.targetWeight !== null
                      ? `${currentAthleteCompetitionPlan.targetWeight} ${copyFor(language, {
                          en: "kg",
                          ru: "кг",
                          bg: "кг",
                        })}`
                      : "-"}
                  </strong>
                </article>
                <article className="context-chip">
                  <span>
                    {copyFor(language, {
                      en: "Expected matches",
                      ru: "Ожидаемые схватки",
                      bg: "Очаквани срещи",
                    })}
                  </span>
                  <strong>{currentAthleteCompetitionPlan.expectedMatches ?? "-"}</strong>
                </article>
                <article className="context-chip">
                  <span>
                    {copyFor(language, {
                      en: "Peak required",
                      ru: "Пик формы",
                      bg: "Пикова форма",
                    })}
                  </span>
                  <strong>
                    {currentAthleteCompetitionPlan.peakRequired
                      ? copyFor(language, { en: "yes", ru: "да", bg: "да" })
                      : copyFor(language, { en: "no", ru: "нет", bg: "не" })}
                  </strong>
                </article>
              </div>
            ) : (
              <p className="placeholder-copy">
                {copyFor(language, {
                  en: "A coach has not assigned a competition preparation plan yet.",
                  ru: "Тренер пока не назначил план подготовки к соревнованию.",
                  bg: "Треньорът все още не е назначил план за подготовка към състезание.",
                })}
              </p>
            )}
          </article>

          <article className="entry-summary athlete-competition-card">
            <div className="summary-topline">
              <strong>
                {copyFor(language, {
                  en: "Competition calendar",
                  ru: "Календарь соревнований",
                  bg: "Календар на състезанията",
                })}
              </strong>
              <span>{sortedAthleteCompetitionPlans.length}</span>
            </div>
            {sortedAthleteCompetitionPlans.length ? (
              <div className="athlete-competition-list">
                {sortedAthleteCompetitionPlans.map((plan) => {
                  const isCurrentPlan = plan.id === currentAthleteCompetitionPlan?.id;
                  return (
                    <button
                      aria-pressed={isCurrentPlan}
                      className={`athlete-competition-row ${isCurrentPlan ? "athlete-competition-row-active" : ""}`}
                      key={plan.id}
                      onClick={() => setSelectedAthleteCompetitionPlanId(plan.id)}
                      type="button"
                    >
                      <span>{plan.competitionStartDate}</span>
                      <strong>{plan.competitionTitle}</strong>
                      <span>{plan.priority}</span>
                      <span>{plan.planType}</span>
                      <span>
                        {plan.result
                          ? copyFor(language, {
                              en: "result saved",
                              ru: "результат сохранён",
                              bg: "резултатът е запазен",
                            })
                          : copyFor(language, {
                              en: "upcoming",
                              ru: "впереди",
                              bg: "предстои",
                            })}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="placeholder-copy">
                {copyFor(language, {
                  en: "Competition calendar will appear here after the coach links a competition plan.",
                  ru: "Календарь появится здесь после того, как тренер привяжет план соревнования.",
                  bg: "Календарът ще се появи тук, след като треньорът свърже състезателен план.",
                })}
              </p>
            )}
          </article>
        </div>
        ) : (
        <div
          className={`anchor-panel athlete-section-panel ${
            isDailyReadinessWorkspace ? "athlete-checkin-panel" : ""
          } ${
            isAthleteTrainingWorkspace ? "athlete-training-panel" : ""
          } ${
            isAthleteHistoryWorkspace ? "athlete-history-panel" : ""
          }`.trim()}
          id={isDailyReadinessWorkspace ? "daily-readiness" : "athlete-workspace"}
        >
          <div className="section-head">
            <h2>{workspaceTitle}</h2>
            <div className="section-head-actions">
              <span className="eyebrow eyebrow-muted">
                {user?.role === "athlete"
                  ? user.fullName
                  : selectedCoachAthlete?.fullName ?? activeAthleteLabel}
              </span>
            </div>
          </div>
          <div className="context-chip-grid">
            {athleteSummaryItems.map((item) => (
              <article className="context-chip" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>
          <div className="athlete-scene-topbar">
            {athleteSceneMetrics.map((item) => (
              <article className="scene-metric" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.note}</small>
              </article>
            ))}
          </div>
          <div className="athlete-day-board">
            <article className="entry-summary athlete-day-card athlete-day-card-accent">
              <div className="summary-topline">
                <strong>
                  {copyFor(language, {
                    en: "Today at a glance",
                    ru: "Ключевое на сегодня",
                    bg: "Най-важното за днес",
                  })}
                </strong>
                <span
                  className={`status-chip ${
                    pendingReadinessQueued || offlineQueueSize > 0 ? "pending" : "synced"
                  }`}
                >
                  {pendingReadinessQueued
                    ? ui("pendingSync")
                    : importedSyncStateLabel(language, isOffline, offlineQueueSize)}
                </span>
              </div>
              <p className="athlete-scene-note">
                {copyFor(language, {
                  en: "One fast flow: check in, review the adapted day, then log actual work without leaving the same screen.",
                  ru: "Один быстрый сценарий: чек-ин, просмотр адаптированного дня и фиксация факта без переходов по экрану.",
                  bg: "Един бърз поток: check-in, преглед на адаптирания ден и запис на реалното изпълнение без да напускаш екрана.",
                })}
              </p>
              <div className="athlete-day-checklist">
                {athleteDayChecklist.map((item) => (
                  <article className="athlete-day-checklist-item" key={item.id}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </article>
                ))}
              </div>
            </article>

            <article className="entry-summary athlete-day-card">
              <div className="summary-topline">
                <strong>
                  {copyFor(language, {
                    en: "What changed today",
                    ru: "Что изменилось сегодня",
                    bg: "Какво се промени днес",
                  })}
                </strong>
                <span>{athleteChangedToday.length}</span>
              </div>
              {athleteChangedToday.length ? (
                <div className="athlete-change-list">
                  {athleteChangedToday.slice(0, 4).map((item) => (
                    <span className={`status-chip ${item.tone}`} key={item.id}>
                      {item.label}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="placeholder-copy">
                  {copyFor(language, {
                    en: "No block-level changes are active right now.",
                    ru: "Сейчас активных изменений по блокам нет.",
                    bg: "В момента няма активни промени по блоковете.",
                  })}
                </p>
              )}
            </article>

            <article className="entry-summary athlete-day-card">
              <div className="summary-topline">
                <strong>
                  {copyFor(language, {
                    en: "Working surface",
                    ru: "Рабочая поверхность",
                    bg: "Работна повърхност",
                  })}
                </strong>
                <span>{activeAthleteTrainingDayLabel}</span>
              </div>
              <ul>
                <li>
                  {copyFor(language, {
                    en: "Readiness queue",
        ru: "Очередь готовности",
        bg: "Опашка за готовност",
                  })}
                  : {pendingReadinessQueued ? ui("pendingSync") : ui("synced")}
                </li>
                <li>
                  {copyFor(language, {
                    en: "Execution queue",
        ru: "Очередь выполнения",
        bg: "Опашка за изпълнение",
                  })}
                  : {pendingExecutionBlockIds.size}
                </li>
                <li>
                  {copyFor(language, {
                    en: "Phase context",
                    ru: "Контекст фазы",
                    bg: "Контекст на фазата",
                  })}
                  : {activePhaseLabel}
                </li>
              </ul>
            </article>
          </div>
          <div className="athlete-scene-grid">
          {user?.role !== "athlete" ? (
            <p className="placeholder-copy">
              {ui("athleteOnlyReadiness")}
            </p>
          ) : (
            <>
              <div className="athlete-scene-column athlete-scene-column-primary">
                <div className="athlete-form-shell">
                  <button
                    aria-controls="daily-readiness-form-panel"
                    aria-expanded={isCheckinOpen}
                    className="athlete-checkin-trigger"
                    onClick={() => setIsCheckinOpen((current) => !current)}
                    type="button"
                  >
                    <div className="athlete-panel-head">
                      <div>
                        <span className="eyebrow eyebrow-muted">
                          {copyFor(language, { en: "Check-in", ru: "Чек-ин", bg: "Чек-ин" })}
                        </span>
                        <h3>{t("dailyReadiness")}</h3>
                      </div>
                      <p>
                        {copyFor(language, {
                          en: "Daily signal collection before the working day starts.",
                          ru: "Ежедневный сбор сигналов перед началом рабочего дня.",
                          bg: "Ежедневно събиране на сигнали преди началото на работния ден.",
                        })}
                      </p>
                    </div>
                    <span className="athlete-checkin-caret" aria-hidden="true">
                      v
                    </span>
                  </button>

                  {isCheckinOpen ? (
                    <div className="athlete-checkin-dropdown-body" id="daily-readiness-form-panel">
                      <label className="field athlete-readiness-date-field">
                        <span>
                          {copyFor(language, {
                            en: "Readiness date",
        ru: "Дата готовности",
        bg: "Дата на готовността",
                          })}
                        </span>
                        <input
                          max={getDateInputValue()}
                          onChange={(event) => handleReadinessDateChange(event.target.value)}
                          type="date"
                          value={readinessEntryDate}
                        />
                      </label>
                      <div className="athlete-readiness-hint">
                        <span
                          className={`status-chip ${
                            pendingReadinessQueued ? "pending" : "synced"
                          }`}
                        >
                          {pendingReadinessQueued ? ui("pendingSync") : ui("synced")}
                        </span>
                        <small>
                          {copyFor(language, {
                            en: "Select today or a past date, then submit the daily check-in in 20-30 seconds.",
                            ru: "Выберите сегодня или прошедшую дату и отправьте дневной чек-ин за 20-30 секунд.",
                            bg: "Изберете днес или минала дата и подайте дневния check-in за 20-30 секунди.",
                          })}
                        </small>
                      </div>
                      <form
                        className="readiness-form athlete-readiness-form"
                        onSubmit={handleReadinessSubmit}
                      >
                        {translatedReadinessFields.map((field) => (
                          <label
                            className={`field athlete-readiness-field ${
                              field.type === "boolean"
                                ? "athlete-readiness-toggle"
                                : field.key === "sleepHours" ||
                                    field.key === "restingHr" ||
                                    field.key === "bodyWeight"
                                  ? "athlete-readiness-metric"
                                  : "athlete-readiness-score"
                            }`}
                            key={field.key}
                          >
                            <span>{field.label}</span>
                            {field.type === "boolean" ? (
                              <input
                                checked={Boolean(readinessForm[field.key])}
                                onChange={(event) =>
                                  setReadinessForm((current) => ({
                                    ...current,
                                    [field.key]: event.target.checked,
                                  }))
                                }
                                type="checkbox"
                              />
                            ) : (
                              <input
                                min={field.min}
                                max={field.max}
                                step={field.step}
                                type="number"
                                value={String(readinessForm[field.key])}
                                onChange={(event) =>
                                  setReadinessForm((current) => ({
                                    ...current,
                                    [field.key]: Number(event.target.value),
                                  }))
                                }
                              />
                            )}
                          </label>
                        ))}

                        <button className="primary-button" disabled={busy} type="submit">
                          {busy ? ui("syncingNow") : t("saveReadiness")}
                        </button>
                      </form>
                    </div>
                  ) : null}
                </div>

              {todayEntry ? (
                <div className="entry-summary athlete-scene-card athlete-readiness-status-card">
                  <div className="summary-topline">
                    <strong>{readinessMeta[todayEntry.status].label}</strong>
                    <span className={`status-chip ${todayEntry.status}`}>
                      Score {todayEntry.score}
                    </span>
                    <span>{readinessMeta[todayEntry.status].loadRange}</span>
                  </div>
                  <p>{readinessMeta[todayEntry.status].summary}</p>
                  <ul>
                    {todayEntry.explanation.length ? (
                      todayEntry.explanation.map((reason) => (
                        <li key={reason.code}>
                          {translateReadinessReason(reason, language)}
                        </li>
                      ))
                    ) : (
                      <li>
                        {language === "ru"
                          ? "Критических отклонений не найдено."
                          : language === "bg"
                            ? "Не са открити критични отклонения."
                            : "No critical deviations were found."}
                      </li>
                    )}
                  </ul>
                </div>
              ) : (
                <p className="placeholder-copy">
                  {copyFor(language, {
                    en: "No readiness entry has been submitted yet for today.",
                    ru: "Сегодня данные готовности ещё не отправлены.",
                    bg: "Днес все още няма подадени данни за готовност.",
                  })}
                </p>
              )}
              </div>

              <div className="athlete-scene-column athlete-scene-column-secondary">
              <div className="entry-summary athlete-scene-card athlete-plan-card">
                <div className="summary-topline">
                  <strong>{t("assignedTrainingDay")}</strong>
                  <span className={`status-chip ${primaryAssignedPlan ? "synced" : "idle"}`}>
                    {primaryAssignedPlan
                      ? copyFor(language, {
                          en: `${relevantAssignedPlans.length} active`,
                          ru: `${relevantAssignedPlans.length} активн.`,
                          bg: `${relevantAssignedPlans.length} активни`,
                        })
                      : ui("noActivePlan")}
                  </span>
                </div>
                {primaryAssignedPlan === null ? (
                  <p className="placeholder-copy">
                    {copyFor(language, {
                      en: "No assigned plan is available yet for this athlete.",
                      ru: "Для этого спортсмена пока нет назначенного плана.",
                      bg: "За този спортист все още няма назначен план.",
                    })}
                  </p>
                ) : (
                    <ul>
                      {activeAthleteTrainingSessions.map((session) => (
                        <li key={session.id}>
                          {primaryAssignedPlan.templateName} / {activeAthleteTrainingDayLabel} /{" "}
                        {session.name}:{" "}
                        {session.blocks
                          .map(
                            (block) =>
                              `${block.name} (${t("targetDuration")}: ${
                                block.targetDurationMinutes ?? "-"
                              }, ${t("targetRpe")}: ${block.targetRpe ?? "-"})`,
                          )
                          .join(", ")}
                        </li>
                      ))}
                    </ul>
                )}
              </div>

              <div className="entry-summary athlete-scene-card athlete-adaptation-card">
                <div className="summary-topline">
                  <strong>{t("adaptedDay")}</strong>
                  <span className={`status-chip ${adaptedPlan?.readinessStatus ?? "idle"}`}>
                    {adaptedPlan
                      ? `${adaptedPlan.readinessStatus} / ${adaptedPlan.readinessScore}`
                      : ui("noAdaptationYet")}
                  </span>
                </div>
                {adaptedPlan ? (
                  <>
                    {athleteChangedToday.length ? (
                      <div className="athlete-change-list">
                        {athleteChangedToday.slice(0, 5).map((item) => (
                          <span className={`status-chip ${item.tone}`} key={item.id}>
                            {item.label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <p>
                      {adaptedPlan.explanation.length
                        ? adaptedPlan.explanation
                            .map((item) => translateAdaptationText(item, language))
                            .join(" ")
                        : language === "ru"
                          ? "Изменения адаптации не потребовались."
                          : language === "bg"
                            ? "Не бяха нужни промени по адаптацията."
                            : "No adaptation changes were required."}
                    </p>
                    <ul>
                      {adaptedPlan.sessions.flatMap((session) =>
                        session.blocks.map((block) => (
                          <li key={block.id}>
                            {session.name}: {block.name} [{translateBlockAction(block.action, language)}] -{" "}
                            {translateAdaptationText(block.adaptationReason, language)}
                          </li>
                        )),
                      )}
                    </ul>
                  </>
                ) : (
                  <p className="placeholder-copy">
                    {copyFor(language, {
                      en: "Submit readiness and assign an active plan to generate the adapted day.",
                      ru: "Отправьте готовность и назначьте активный план, чтобы сформировать адаптированный день.",
                      bg: "Подайте готовност и назначете активен план, за да се генерира адаптиран ден.",
                    })}
                  </p>
                )}
              </div>
              </div>

              <div className="athlete-scene-column athlete-scene-column-tertiary">
              <div className="entry-summary athlete-scene-card athlete-history-card">
                <div className="summary-topline">
                  <strong>
                    {copyFor(language, {
                      en: "Training history",
                      ru: "История",
                      bg: "История",
                    })}
                  </strong>
                  <span>
                    {analyticsOverview
                      ? `${analyticsOverview.readinessTrend.length}/${executionResults.length}`
                      : String(executionResults.length)}
                  </span>
                </div>
                {analyticsOverview || executionResults.length ? (
                  <>
                    <div className="context-chip-grid">
                      <article className="context-chip">
                        <span>{ui("readinessTrend")}</span>
                        <strong>{analyticsOverview?.readinessTrend.length ?? 0}</strong>
                      </article>
                      <article className="context-chip">
                        <span>{t("executionTracking")}</span>
                        <strong>{executionResults.length}</strong>
                      </article>
                      <article className="context-chip">
                        <span>{ui("completionTrend")}</span>
                        <strong>{athleteLatestCompletionPoint?.adherenceRate ?? "-"}%</strong>
                      </article>
                    </div>

                    {analyticsOverview?.readinessTrend.length ? (
                      <div className="analytics-trend-list">
                        <strong>{ui("readinessTrend")}</strong>
                        <ul>
                          {analyticsOverview.readinessTrend.slice(-5).reverse().map((point) => (
                            <li key={point.date}>
                              {point.date}: {readinessMeta[point.status].label} / {point.score}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {executionResults.length ? (
                      <div className="analytics-trend-list">
                        <strong>{t("executionTracking")}</strong>
                        <ul>
                          {executionResults.slice(0, 5).map((result) => (
                            <li key={result.id}>
                              {result.updatedAt.slice(0, 10)}:{" "}
                              {result.completed ? t("completed") : ui("notSavedYet")} / RPE{" "}
                              {result.rpe ?? "-"} / {t("durationMin")}{" "}
                              {result.durationMinutes ?? "-"}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="placeholder-copy">
                    {copyFor(language, {
                      en: "History will appear after readiness and execution entries are saved.",
        ru: "История появится после сохранения готовности и выполнения тренировок.",
        bg: "Историята ще се появи след записана готовност и отчетено изпълнение.",
                    })}
                  </p>
                )}
              </div>

              <div className="entry-summary athlete-scene-card athlete-context-card">
                <div className="summary-topline">
                  <strong>
                    {copyFor(language, {
                      en: "Competition context",
                      ru: "Соревновательный контекст",
                      bg: "Състезателен контекст",
                    })}
                  </strong>
                  <span className={`status-chip ${competitionContext ? "accent" : "idle"}`}>
                    {competitionContext?.phase
                      ? `${competitionContext.phase} / ${competitionContext.competitionPriority ?? "-"}`
                      : "none"}
                  </span>
                </div>
                {competitionContext ? (
                  <ul>
                    <li>Days to competition: {competitionContext.daysToCompetition ?? "-"}</li>
                    <li>Phase: {competitionContext.phase ?? "-"}</li>
                    <li>Priority: {competitionContext.competitionPriority ?? "-"}</li>
                    <li>Taper: {competitionContext.taperState ? "yes" : "no"}</li>
                    <li>Weight cut: {competitionContext.weightCutState ? "yes" : "no"}</li>
                  </ul>
                ) : (
                  <p className="placeholder-copy">
                    No active competition preparation context is linked to this athlete yet.
                  </p>
                )}
              </div>

              <div className="entry-summary athlete-scene-card athlete-execution-card">
                <div className="summary-topline">
                  <strong>{t("executionTracking")}</strong>
                  <span className={`status-chip ${pendingExecutionBlockIds.size ? "pending" : "synced"}`}>
                    {primaryAssignedPlan === null
                      ? ui("noActivePlan")
                      : `${athleteExecutionCompletedBlocks}/${athletePlannedBlocksCount}`}
                  </span>
                </div>
                {!activeAthleteTrainingPlanId ? (
                  <p className="placeholder-copy">
                    Assign an active plan before recording actual execution.
                  </p>
                ) : (
                  <div className="stack athlete-execution-stack">
                    {activeAthleteTrainingSessions.map((session) => (
                      <div className="session-card" key={session.id}>
                        <strong>{session.name}</strong>
                        <span>{activeAthleteTrainingDayLabel}</span>
                        {session.blocks.map((block) => {
                          const draft = getExecutionDraft(block.id);
                          const savedResult = executionResults.find(
                            (item) => item.assignedBlockId === block.id,
                          );
                          const blockSyncLabel = pendingExecutionBlockIds.has(block.id)
                            ? ui("pendingSync")
                            : savedResult
                              ? ui("synced")
                              : ui("notSavedYet");
                          const blockSyncTone = pendingExecutionBlockIds.has(block.id)
                            ? "pending"
                            : savedResult
                              ? "synced"
                              : "idle";

                          return (
                            <div className="entry-summary athlete-execution-block" key={block.id}>
                              <div className="summary-topline">
                                <div>
                                  <strong>{block.name}</strong>
                                  {"action" in block && typeof block.action === "string" ? (
                                    <small>{translateBlockAction(block.action, language)}</small>
                                  ) : null}
                                </div>
                                <span className={`status-chip ${blockSyncTone}`}>{blockSyncLabel}</span>
                              </div>
                              {block.notes ? (
                                <p className="assigned-block-note">{block.notes}</p>
                              ) : null}
                              {(block.exercises ?? []).length > 0 ? (
                                <div className="assigned-exercise-list">
                                  {(block.exercises ?? []).map((exercise) => (
                                    <div className="assigned-exercise-row" key={exercise.id}>
                                      <strong>{exercise.name}</strong>
                                      <span>{formatExerciseTarget(exercise, language)}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                              <div className="context-chip-grid athlete-execution-target-grid">
                                <article className="context-chip">
                                  <span>{t("targetDuration")}</span>
                                  <strong>
                                    {block.targetDurationMinutes ?? "-"} {"->"}{" "}
                                    {savedResult?.durationMinutes ?? draft.durationMinutes ?? "-"}
                                  </strong>
                                </article>
                                <article className="context-chip">
                                  <span>{t("targetRpe")}</span>
                                  <strong>
                                    {block.targetRpe ?? "-"} {"->"}{" "}
                                    {savedResult?.rpe ?? draft.rpe ?? "-"}
                                  </strong>
                                </article>
                                <article className="context-chip">
                                  <span>{t("targetSets")}</span>
                                  <strong>
                                    {block.targetSets ?? "-"} {"->"}{" "}
                                    {savedResult?.setsCompleted ?? draft.setsCompleted ?? "-"}
                                  </strong>
                                </article>
                                <article className="context-chip">
                                  <span>{t("targetReps")}</span>
                                  <strong>
                                    {block.targetReps ?? "-"} {"->"}{" "}
                                    {savedResult?.repsCompleted ?? draft.repsCompleted ?? "-"}
                                  </strong>
                                </article>
                              </div>

                              <div className="readiness-form">
                                <label className="field">
                                  <span>{t("completed")}</span>
                                  <input
                                    checked={draft.completed}
                                    onChange={(event) =>
                                      updateExecutionDraft(block.id, {
                                        completed: event.target.checked,
                                      })
                                    }
                                    type="checkbox"
                                  />
                                </label>

                                <label className="field">
                                  <span>{t("sets")}</span>
                                  <input
                                    type="number"
                                    value={draft.setsCompleted ?? ""}
                                    onChange={(event) =>
                                      updateExecutionDraft(block.id, {
                                        setsCompleted:
                                          event.target.value === ""
                                            ? null
                                            : Number(event.target.value),
                                      })
                                    }
                                  />
                                </label>

                                <label className="field">
                                  <span>{t("reps")}</span>
                                  <input
                                    type="number"
                                    value={draft.repsCompleted ?? ""}
                                    onChange={(event) =>
                                      updateExecutionDraft(block.id, {
                                        repsCompleted:
                                          event.target.value === ""
                                            ? null
                                            : Number(event.target.value),
                                      })
                                    }
                                  />
                                </label>

                                <label className="field">
                                  <span>{t("weightKg")}</span>
                                  <input
                                    type="number"
                                    step="0.5"
                                    value={draft.weightKg ?? ""}
                                    onChange={(event) =>
                                      updateExecutionDraft(block.id, {
                                        weightKg:
                                          event.target.value === ""
                                            ? null
                                            : Number(event.target.value),
                                      })
                                    }
                                  />
                                </label>

                                <label className="field">
                                  <span>{t("durationMin")}</span>
                                  <input
                                    type="number"
                                    step="0.5"
                                    value={draft.durationMinutes ?? ""}
                                    onChange={(event) =>
                                      updateExecutionDraft(block.id, {
                                        durationMinutes:
                                          event.target.value === ""
                                            ? null
                                            : Number(event.target.value),
                                      })
                                    }
                                  />
                                </label>

                                <label className="field">
                                  <span>{t("rpe")}</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    step="0.5"
                                    value={draft.rpe ?? ""}
                                    onChange={(event) =>
                                      updateExecutionDraft(block.id, {
                                        rpe:
                                          event.target.value === ""
                                            ? null
                                            : Number(event.target.value),
                                      })
                                    }
                                  />
                                </label>

                                <label className="field">
                                  <span>{t("notes")}</span>
                                  <input
                                    value={draft.notes}
                                    onChange={(event) =>
                                      updateExecutionDraft(block.id, {
                                        notes: event.target.value,
                                      })
                                    }
                                  />
                                </label>
                              </div>

                              <button
                                className="primary-button"
                                disabled={busy}
                                onClick={() => void handleExecutionSave(activeAthleteTrainingPlanId, block.id)}
                                type="button"
                              >
                                {busy ? ui("syncingNow") : t("saveExecution")}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="entry-summary athlete-scene-card athlete-analytics-card">
                <div className="summary-topline">
                  <strong>{t("analytics")}</strong>
                  <span>
                    {analyticsOverview
                      ? `${analyticsOverview.insights.length} / ${analyticsOverview.patterns.length}`
                      : ui("noAnalyticsYet")}
                  </span>
                </div>
                {analyticsOverview ? (
                  <>
                    <div className="coach-stat-strip analytics-mini-grid">
                      <article className="scene-metric">
                        <span>{ui("latestReadiness")}</span>
                        <strong>{athleteLatestReadinessPoint?.score ?? "-"}</strong>
                        <small>
                          {athleteLatestReadinessPoint
                            ? readinessMeta[athleteLatestReadinessPoint.status].label
                            : ui("noEntriesYet")}
                        </small>
                      </article>
                      <article className="scene-metric">
                        <span>{ui("completionTrend")}</span>
                        <strong>{athleteLatestCompletionPoint?.adherenceRate ?? "-"}%</strong>
                        <small>
                          {athleteLatestCompletionPoint
                            ? `${athleteLatestCompletionPoint.completedBlocks}/${athleteLatestCompletionPoint.plannedBlocks} ${copyFor(language, {
                                en: "blocks",
                                ru: "блоков",
                                bg: "блока",
                              })}`
                            : ui("noReviewYet")}
                        </small>
                      </article>
                      <article className="scene-metric">
                        <span>{ui("loadTrend")}</span>
                        <strong>{athleteLatestLoadPoint?.actualLoad ?? "-"}</strong>
                        <small>
                          {athleteLatestLoadPoint
                            ? `${copyFor(language, {
                                en: "delta",
                                ru: "дельта",
                                bg: "делта",
                              })} ${athleteLatestLoadPoint.loadDelta}`
                            : ui("noAnalyticsYet")}
                        </small>
                      </article>
                    </div>

                    {athleteWeekSummary ? (
                      <article className="entry-summary analytics-week-card">
                        <div className="summary-topline">
                          <strong>{ui("analyticsWeekSnapshot")}</strong>
                          <span>{analyticsWeekStatus(athleteWeekSummary.status)}</span>
                        </div>
                        <div className="analytics-week-grid">
                          <div>
                            <span>{copyFor(language, { en: "Week", ru: "Неделя", bg: "Седмица" })}</span>
                            <strong>{athleteWeekSummary.label}</strong>
                          </div>
                          <div>
                            <span>{ui("loadTrend")}</span>
                            <strong>{athleteWeekSummary.actualLoad}</strong>
                          </div>
                          <div>
                            <span>{ui("completionTrend")}</span>
                            <strong>{athleteWeekSummary.adherenceRate}%</strong>
                          </div>
                          <div>
                            <span>{ui("latestReadiness")}</span>
                            <strong>{athleteWeekSummary.averageReadiness ?? "-"}</strong>
                          </div>
                        </div>
                      </article>
                    ) : null}

                    <div className="analytics-insight-stack analytics-insight-stack-compact">
                      {analyticsOverview.insights.slice(0, 2).map((insight) => (
                        <article className="analytics-insight-card" key={insight.code}>
                          <div className="summary-topline">
                            <strong>{analyticsInsightTitle(insight)}</strong>
                            <span className={`analytics-severity-chip ${insight.level}`}>
                              {analyticsInsightLevel(insight)}
                            </span>
                          </div>
                          <p>{analyticsInsightSummary(insight)}</p>
                          <p className="analytics-recommendation">
                            <strong>{ui("analyticsRecommendation")}:</strong>{" "}
                            {analyticsInsightRecommendation(insight)}
                          </p>
                        </article>
                      ))}
                    </div>

                    <div className="analytics-trend-list">
                      <strong>{ui("readinessTrend")}</strong>
                      <ul>
                        {analyticsOverview.readinessTrend.slice(-3).reverse().map((point) => (
                          <li key={point.date}>
                            {point.date}: {readinessMeta[point.status].label} / {point.score}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : (
                  <p className="placeholder-copy">
                    {ui("analyticsAppearLater")}
                  </p>
                )}
              </div>
              </div>
            </>
          )}
          </div>
        </div>
        )}
        </AthleteWorkspace>
        ) : null}
      </AthleteWorkspaceScene>
      ) : null}

      {activeWorkspace === "offline-center" ? (
      <OfflineSyncCenterScene>
        <OfflineSyncCenter
          action={
            <button
              className="secondary-button"
              disabled={isSyncingNow || isOffline || offlineQueueSize === 0}
              onClick={() => void handleSyncNow()}
              type="button"
            >
              {isSyncingNow ? ui("syncingNow") : ui("syncNow")}
            </button>
          }
          description={copyFor(language, {
            en: "Review local queue items, sync state, and the latest cached readiness, plans, execution, and analytics snapshots.",
        ru: "Проверьте локальные элементы очереди, состояние синхронизации и последние кэши готовности, плана, выполнения и аналитики.",
        bg: "Прегледайте локалните елементи в опашката, състоянието на синхронизация и последните кешове на готовността, плана, изпълнението и анализа.",
          })}
          eyebrow={ui("offlineSyncCenter")}
          metrics={offlineSceneMetrics}
          title={copyFor(language, {
            en: "Pending sync, stale cache, and queue recovery in one control surface.",
        ru: "Ожидающая синхронизация, устаревший кэш и восстановление очереди в одной управляющей зоне.",
        bg: "Чакаща синхронизация, остарял кеш и възстановяване на опашката в една работна зона.",
          })}
        >
          <div className="offline-sync-grid">
            <div className="entry-summary offline-sync-queue">
              <div className="summary-topline">
                <strong>{ui("pendingItems")}</strong>
                <span>{offlineQueueSize}</span>
              </div>
              <div className="context-chip-grid">
                <article className="context-chip">
                  <span>{ui("pendingSync")}</span>
                  <strong>{offlineQueueStatusCounts.pending}</strong>
                </article>
                <article className="context-chip">
                  <span>{ui("syncingNow")}</span>
                  <strong>{offlineQueueStatusCounts.syncing}</strong>
                </article>
                <article className="context-chip">
                  <span>{copyFor(language, { en: "failed", ru: "ошибки", bg: "грешки" })}</span>
                  <strong>{offlineQueueStatusCounts.failed}</strong>
                </article>
                <article className="context-chip">
                  <span>{ui("synced")}</span>
                  <strong>{offlineQueueStatusCounts.synced}</strong>
                </article>
              </div>
              {offlineQueueItems.length === 0 ? (
                <p className="placeholder-copy">{ui("queueEmpty")}</p>
              ) : (
                <div className="offline-sync-item-list">
                  {offlineQueueItems.map((item) => (
                    <button
                      className={`offline-sync-item ${
                        selectedOfflineItem?.id === item.id ? "offline-sync-item-active" : ""
                      }`}
                      key={item.id}
                      onClick={() => setSelectedOfflineItemId(item.id)}
                      type="button"
                    >
                      <div className="offline-sync-item-top">
                        <strong>{importedFormatQueueItemLabel(item, language)}</strong>
                        <span className={`status-chip ${item.status}`}>
                          {importedQueueItemStatusLabel(item, language)}
                        </span>
                      </div>
                      <div className="offline-sync-item-meta">
                        <span>
                          {offlineSyncErrors[item.id]
                            ? `${ui("lastAttemptFailed")}: ${offlineSyncErrors[item.id]}`
                            : ui("readyToSync")}
                        </span>
                        <span>
                          {copyFor(language, { en: "attempts", ru: "попыток", bg: "опити" })}:{" "}
                          {item.attemptCount}
                        </span>
                        <span>{importedQueueConflictLabel(item, language)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="offline-sync-meta">
              <div className="summary-topline">
                <strong>
                  {selectedOfflineItem
                    ? importedFormatQueueItemLabel(selectedOfflineItem, language)
                    : queueItemLabelText}
                </strong>
                <span className={`status-chip ${selectedOfflineItem?.status ?? "idle"}`}>
                  {selectedOfflineItem
                    ? importedQueueItemStatusLabel(selectedOfflineItem, language)
                    : importedSyncStateLabel(language, isOffline, offlineQueueSize)}
                </span>
              </div>
              {selectedOfflineItem ? (
                <div className="offline-sync-detail">
                  <p className="placeholder-copy">
                    {ui("createdAtLabel")}: {selectedOfflineItem.createdAt.slice(0, 16)}
                  </p>
                  <ul>
                    <li>
                      {copyFor(language, {
                        en: "Conflict policy",
                        ru: "Политика конфликта",
                        bg: "Политика за конфликт",
                      })}
                      : {importedQueueConflictLabel(selectedOfflineItem, language)}
                    </li>
                    <li>
                      {copyFor(language, {
                        en: "Current sync status",
                        ru: "Текущий статус синхронизации",
                        bg: "Текущ статус на синхронизация",
                      })}
                      :{" "}
                      {offlineSyncErrors[selectedOfflineItem.id]
                        ? `${ui("lastAttemptFailed")}: ${offlineSyncErrors[selectedOfflineItem.id]}`
                        : importedQueueItemStatusLabel(selectedOfflineItem, language)}
                    </li>
                    <li>
                      {copyFor(language, {
                        en: "Idempotency key",
                        ru: "Ключ идемпотентности",
                        bg: "Ключ за идемпотентност",
                      })}
                      : {selectedOfflineItem.clientRequestId}
                    </li>
                    <li>
                      {copyFor(language, {
                        en: "Last attempt",
                        ru: "Последняя попытка",
                        bg: "Последен опит",
                      })}
                      : {selectedOfflineItem.lastAttemptAt?.slice(0, 16) ?? "-"}
                    </li>
                    <li>
                      {copyFor(language, {
                        en: "Synced at",
                        ru: "Синхронизировано",
                        bg: "Синхронизирано",
                      })}
                      : {selectedOfflineItem.syncedAt?.slice(0, 16) ?? "-"}
                    </li>
                  </ul>
                </div>
              ) : (
                <p className="placeholder-copy">
                  {copyFor(language, {
                    en: "Select a pending item to inspect sync details and conflict handling.",
                    ru: "Выберите pending item, чтобы посмотреть детали синхронизации и обработку конфликта.",
                    bg: "Изберете pending item, за да видите детайлите по синхронизация и конфликт.",
                  })}
                </p>
              )}
              <div className="offline-cache-grid">
                <article className="scene-metric">
                  <span>{ui("readinessCache")}</span>
                  <strong>{readinessCacheSavedAt ?? "-"}</strong>
                  <small>{stateLabelText}</small>
                </article>
                <article className="scene-metric">
                  <span>{ui("assignedPlansCache")}</span>
                  <strong>{assignedCacheSavedAt ?? "-"}</strong>
                  <small>{ui("pendingItems")}</small>
                </article>
                <article className="scene-metric">
                  <span>{ui("adaptedPlanCache")}</span>
                  <strong>{adaptedCacheSavedAt ?? "-"}</strong>
                  <small>{ui("offlineSyncCenter")}</small>
                </article>
                <article className="scene-metric">
                  <span>{ui("executionCache")}</span>
                  <strong>{executionCacheSavedAt ?? "-"}</strong>
                  <small>{t("analytics")}</small>
                </article>
                <article className="scene-metric">
                  <span>{ui("analyticsCache")}</span>
                  <strong>{analyticsCacheSavedAt ?? "-"}</strong>
                  <small>{importedQueueLabel(language, offlineQueueSize)}</small>
                </article>
              </div>
              <p className="placeholder-copy">
                {copyFor(language, {
                  en: "When the network returns, the queue syncs automatically. Readiness keeps only the latest entry for the day, and execution keeps only the latest version per block.",
        ru: "Когда сеть возвращается, очередь синхронизируется автоматически. Для готовности хранится только последняя запись за день, а для выполнения - только последняя версия по блоку.",
        bg: "Когато мрежата се върне, опашката се синхронизира автоматично. За готовността се пази само последният запис за деня, а за изпълнението - само последната версия на блока.",
                })}
              </p>
            </div>
          </div>
        </OfflineSyncCenter>
      </OfflineSyncCenterScene>
      ) : null}

      {isCoachSceneWorkspace && (user?.role === "coach" || user?.role === "admin") ? (
        <CoachDashboardScene>
          <CoachDashboard
            description={coachSceneDescription}
            eyebrow={activeWorkspaceItem.label}
            metrics={coachSceneMetrics}
            showHeaderCopy={false}
            title={workspaceTitle}
          >
            {coachAthletes.length === 0 ? (
              <>
                <p className="placeholder-copy">
                  {ui("noCoachAthletes")}
                </p>
                {availableAthleteAttachmentPanel}
              </>
            ) : (
              <>
                <div
                  className={`coach-dashboard-grid coach-dashboard-grid-${activeWorkspace.replace(
                    "coach-",
                    "",
                  )}`}
                >
                  {isCoachAthletesWorkspace ? availableAthleteAttachmentPanel : null}
                  {showCoachRosterColumn ? (
                  <aside className="coach-roster-column">
                    <div className="coach-roster-head">
                      <strong>
                        {copyFor(language, {
                          en: "Athlete roster",
                          ru: "Список спортсменов",
                          bg: "Списък със спортисти",
                        })}
                      </strong>
                      <span>{coachAthletes.length}</span>
                    </div>
                    {isCoachDashboardWorkspace ? (
                      <label className="field coach-roster-select-field">
                        <span>{t("athlete")}</span>
                        <select
                          value={selectedAthleteId}
                          onChange={(event) => void handleCoachAthleteChange(event.target.value)}
                        >
                          <option value="">{ui("selectAthlete")}</option>
                          {coachAthletes.map((athlete) => (
                            <option key={athlete.athleteId} value={athlete.athleteId}>
                              {athlete.fullName}
                            </option>
                          ))}
                        </select>
                        <small>
                          {selectedCoachAthlete?.latestReadiness
                            ? `${ui("latestReadiness")}: ${
                                readinessMeta[selectedCoachAthlete.latestReadiness.status].label
                              } (${selectedCoachAthlete.latestReadiness.score})`
                            : ui("noEntriesYet")}
                        </small>
                      </label>
                    ) : (
                      <div className="role-grid coach-roster-grid">
                        {coachAthletes.map((athlete) => (
                          <article
                            className={`role-card ${
                              selectedAthleteId === athlete.athleteId
                                ? "role-card-active"
                                : ""
                            }`}
                            key={athlete.athleteId}
                          >
                            <div className="coach-roster-status">
                              <strong>{athlete.fullName}</strong>
                              <span
                                className={`status-chip ${
                                  athlete.latestReadiness?.status ?? "idle"
                                }`}
                              >
                                {athlete.latestReadiness
                                  ? readinessMeta[athlete.latestReadiness.status].label
                                  : ui("noEntriesYet")}
                              </span>
                            </div>
                            <span>{athlete.email}</span>
                            <span>
                              {language === "ru"
        ? "Последняя готовность:"
        : language === "bg"
          ? "Последна готовност:"
                                  : `${ui("latestReadiness")}:`}{" "}
                              {athlete.latestReadiness
                                ? `${readinessMeta[athlete.latestReadiness.status].label} (${athlete.latestReadiness.score})`
                                : language === "ru"
                                  ? "записей пока нет"
                                  : language === "bg"
                                    ? "още няма записи"
                                    : ui("noEntriesYet")}
                            </span>
                            <button
                              className="secondary-button"
                              onClick={() => void handleCoachAthleteChange(athlete.athleteId)}
                              type="button"
                            >
                              {ui("openAthlete")}
                            </button>
                          </article>
                        ))}
                      </div>
                    )}
                    {isCoachAthletesWorkspace ? availableAthleteAttachmentPanel : null}
                  </aside>
                  ) : null}
                  <div className="coach-main-column">

                {isCoachAthletesWorkspace && selectedCoachAthlete ? (
                  <section className="coach-athlete-profile-card">
                    <div className="coach-athlete-profile-head">
                      <div
                        aria-label={selectedCoachAthlete.fullName}
                        className="coach-athlete-photo"
                        role="img"
                        style={
                          selectedCoachAthlete.photoUrl
                            ? { backgroundImage: `url("${selectedCoachAthlete.photoUrl}")` }
                            : undefined
                        }
                      >
                        {!selectedCoachAthlete.photoUrl ? (
                          <span>{getAthleteInitials(selectedCoachAthlete.fullName)}</span>
                        ) : null}
                      </div>
                      <div className="coach-athlete-profile-title">
                        <span className="eyebrow eyebrow-muted">
                          {copyFor(language, {
                            en: "Athlete card",
                            ru: "Карточка спортсмена",
                            bg: "Карта на спортиста",
                          })}
                        </span>
                        <strong>{selectedCoachAthlete.fullName}</strong>
                        <small>{selectedCoachAthlete.email}</small>
                      </div>
                      <div className="coach-athlete-profile-actions">
                        <span
                          className={`status-chip ${
                            selectedCoachAthlete.latestReadiness?.status ?? "idle"
                          }`}
                        >
                          {selectedCoachAthlete.latestReadiness
                            ? readinessMeta[selectedCoachAthlete.latestReadiness.status].label
                            : ui("noEntriesYet")}
                        </span>
                        <button
                          className="secondary-button coach-athlete-edit-button"
                          onClick={() => setIsAthleteProfileEditorOpen((open) => !open)}
                          type="button"
                        >
                          {showAthleteProfileEditor
                            ? copyFor(language, {
                                en: "Close editor",
                                ru: "Скрыть форму",
                                bg: "Скрий формата",
                              })
                            : copyFor(language, {
                                en: "Edit card",
                                ru: "Редактировать карточку",
                                bg: "Редактирай картата",
                              })}
                        </button>
                      </div>
                    </div>

                    <div className="coach-athlete-profile-grid">
                      <article>
                        <span>{copyFor(language, { en: "Height", ru: "Рост", bg: "Ръст" })}</span>
                        <strong>
                          {selectedCoachAthlete.heightCm
                            ? `${selectedCoachAthlete.heightCm} см`
                            : "-"}
                        </strong>
                      </article>
                      <article>
                        <span>{copyFor(language, { en: "Base weight", ru: "Базовый вес", bg: "Базово тегло" })}</span>
                        <strong>
                          {selectedCoachAthlete.baselineWeightKg
                            ? `${selectedCoachAthlete.baselineWeightKg} кг`
                            : "-"}
                        </strong>
                      </article>
                      <article>
                        <span>{copyFor(language, { en: "Current weight", ru: "Текущий вес", bg: "Текущо тегло" })}</span>
                        <strong>
                          {selectedCoachAthlete.currentWeightKg
                            ? `${selectedCoachAthlete.currentWeightKg} кг`
                            : "-"}
                        </strong>
                        <small>{selectedCoachAthlete.currentWeightDate ?? ""}</small>
                      </article>
                      <article>
                        <span>{copyFor(language, { en: "Weight class", ru: "Весовая категория", bg: "Категория" })}</span>
                        <strong>{selectedCoachAthlete.weightClass || "-"}</strong>
                      </article>
                      <article>
                        <span>{copyFor(language, { en: "Resting HR", ru: "ЧСС в покое", bg: "Пулс в покой" })}</span>
                        <strong>{selectedCoachAthlete.baselineRestingHr ?? "-"}</strong>
                      </article>
                      <article>
                        <span>{copyFor(language, { en: "Wrestling experience", ru: "Стаж борьбы", bg: "Стаж борба" })}</span>
                        <strong>
                          {selectedCoachAthlete.wrestlingExperienceYears !== null
                            ? `${selectedCoachAthlete.wrestlingExperienceYears} ${copyFor(language, {
                                en: "years",
                                ru: "лет",
                                bg: "год.",
                              })}`
                            : "-"}
                        </strong>
                      </article>
                      <article>
                        <span>{copyFor(language, { en: "Stance / side", ru: "Стойка / сторона", bg: "Стойка / страна" })}</span>
                        <strong>{selectedCoachAthlete.dominantSide || "-"}</strong>
                      </article>
                      <article>
                        <span>{copyFor(language, { en: "Age", ru: "Возраст", bg: "Възраст" })}</span>
                        <strong>{getAthleteAge(selectedCoachAthlete.birthDate) ?? "-"}</strong>
                      </article>
                      <article>
                        <span>{copyFor(language, { en: "Style", ru: "Стиль", bg: "Стил" })}</span>
                        <strong>{selectedCoachAthlete.discipline || selectedCoachAthlete.sport || "-"}</strong>
                      </article>
                    </div>

                    <div className="coach-athlete-profile-strength">
                      <div className="summary-topline">
                        <strong>
                          {copyFor(language, {
                            en: "Strength indicators",
                            ru: "Силовые показатели",
                            bg: "Силови показатели",
                          })}
                        </strong>
                        <span>
                          {copyFor(language, {
                            en: "Wrestling profile",
                            ru: "Профиль борца",
                            bg: "Профил борец",
                          })}
                        </span>
                      </div>
                      <div className="coach-athlete-profile-grid">
                        <article>
                          <span>{copyFor(language, { en: "Squat", ru: "Присед", bg: "Клек" })}</span>
                          <strong>{formatKgValue(selectedCoachAthlete.strengthSquatKg)}</strong>
                        </article>
                        <article>
                          <span>{copyFor(language, { en: "Bench press", ru: "Жим лёжа", bg: "Лег" })}</span>
                          <strong>{formatKgValue(selectedCoachAthlete.strengthBenchPressKg)}</strong>
                        </article>
                        <article>
                          <span>{copyFor(language, { en: "Deadlift", ru: "Становая тяга", bg: "Тяга" })}</span>
                          <strong>{formatKgValue(selectedCoachAthlete.strengthDeadliftKg)}</strong>
                        </article>
                        <article>
                          <span>{copyFor(language, { en: "Pull-ups max", ru: "Подтягивания max", bg: "Набирания max" })}</span>
                          <strong>{selectedCoachAthlete.strengthPullUpsMax ?? "-"}</strong>
                        </article>
                        <article>
                          <span>{copyFor(language, { en: "Grip left", ru: "Хват левый", bg: "Хват ляв" })}</span>
                          <strong>{formatKgValue(selectedCoachAthlete.strengthGripLeftKg)}</strong>
                        </article>
                        <article>
                          <span>{copyFor(language, { en: "Grip right", ru: "Хват правый", bg: "Хват десен" })}</span>
                          <strong>{formatKgValue(selectedCoachAthlete.strengthGripRightKg)}</strong>
                        </article>
                      </div>
                      {selectedCoachAthlete.strengthNotes ? (
                        <article className="coach-athlete-profile-note coach-athlete-profile-note-wide">
                          <span>
                            {copyFor(language, {
                              en: "Strength notes",
                              ru: "Заметки по силовой подготовке",
                              bg: "Бележки за силова подготовка",
                            })}
                          </span>
                          <p>{selectedCoachAthlete.strengthNotes}</p>
                        </article>
                      ) : null}
                    </div>

                    <div className="coach-athlete-profile-text-grid">
                      <article className="coach-athlete-profile-note">
                        <span>{copyFor(language, { en: "Strengths", ru: "Сильные стороны", bg: "Силни страни" })}</span>
                        <p>{selectedCoachAthlete.strengths || "-"}</p>
                      </article>
                      <article className="coach-athlete-profile-note">
                        <span>{copyFor(language, { en: "Weaknesses", ru: "Слабые стороны", bg: "Слаби страни" })}</span>
                        <p>{selectedCoachAthlete.weaknesses || "-"}</p>
                      </article>
                      <article className="coach-athlete-profile-note">
                        <span>{copyFor(language, { en: "Injuries / restrictions", ru: "Травмы / ограничения", bg: "Травми / ограничения" })}</span>
                        <p>{selectedCoachAthlete.injuriesOrRestrictions || "-"}</p>
                      </article>
                      <article className="coach-athlete-profile-note">
                        <span>{copyFor(language, { en: "Preparation goal", ru: "Цель подготовки", bg: "Цел на подготовката" })}</span>
                        <p>{selectedCoachAthlete.preparationGoal || "-"}</p>
                      </article>
                      <article className="coach-athlete-profile-note coach-athlete-profile-note-wide">
                        <span>{copyFor(language, { en: "Coach notes", ru: "Заметки тренера", bg: "Бележки на треньора" })}</span>
                        <p>{selectedCoachAthlete.profileNotes || "-"}</p>
                      </article>
                    </div>

                    {showAthleteProfileEditor ? (
                      <form
                        className="coach-athlete-profile-form"
                        onSubmit={handleAthleteProfileSubmit}
                      >
                        {athleteProfileSaveMessage ? (
                          <div
                            className={`coach-athlete-profile-save-state coach-athlete-profile-save-state-${athleteProfileSaveState}`}
                            role="status"
                          >
                            {athleteProfileSaveMessage}
                          </div>
                        ) : null}
                        <label className="field">
                          <span>{copyFor(language, { en: "Photo URL", ru: "URL фото", bg: "URL снимка" })}</span>
                          <input
                            value={athleteProfileForm.photoUrl}
                            onChange={(event) =>
                              setAthleteProfileForm((current) => ({
                                ...current,
                                photoUrl: event.target.value,
                              }))
                            }
                            placeholder="https://..."
                          />
                        </label>
                        <label className="field">
                          <span>{copyFor(language, { en: "Birth date", ru: "Дата рождения", bg: "Дата на раждане" })}</span>
                          <input
                            type="date"
                            max={getDateInputValue()}
                            value={athleteProfileForm.birthDate ?? ""}
                            onChange={(event) =>
                              setAthleteProfileForm((current) => ({
                                ...current,
                                birthDate: event.target.value || null,
                              }))
                            }
                          />
                        </label>
                        <label className="field">
                          <span>{copyFor(language, { en: "Height, cm", ru: "Рост, см", bg: "Ръст, см" })}</span>
                          <input
                            type="number"
                            value={athleteProfileForm.heightCm ?? ""}
                            onChange={(event) =>
                              setAthleteProfileForm((current) => ({
                                ...current,
                                heightCm: event.target.value ? Number(event.target.value) : null,
                              }))
                            }
                          />
                        </label>
                        <label className="field">
                          <span>{copyFor(language, { en: "Weight, kg", ru: "Вес, кг", bg: "Тегло, кг" })}</span>
                          <input
                            type="number"
                            value={athleteProfileForm.baselineWeightKg ?? ""}
                            onChange={(event) =>
                              setAthleteProfileForm((current) => ({
                                ...current,
                                baselineWeightKg: event.target.value ? Number(event.target.value) : null,
                              }))
                            }
                          />
                        </label>
                        <label className="field">
                          <span>{copyFor(language, { en: "Resting HR", ru: "Пульс покоя", bg: "Пулс в покой" })}</span>
                          <input
                            type="number"
                            value={athleteProfileForm.baselineRestingHr ?? ""}
                            onChange={(event) =>
                              setAthleteProfileForm((current) => ({
                                ...current,
                                baselineRestingHr: event.target.value ? Number(event.target.value) : null,
                              }))
                            }
                          />
                        </label>
                        <label className="field">
                          <span>{copyFor(language, { en: "Sport", ru: "Вид спорта", bg: "Спорт" })}</span>
                          <input
                            value={athleteProfileForm.sport}
                            onChange={(event) =>
                              setAthleteProfileForm((current) => ({
                                ...current,
                                sport: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label className="field">
                          <span>{copyFor(language, { en: "Discipline", ru: "Дисциплина", bg: "Дисциплина" })}</span>
                          <input
                            value={athleteProfileForm.discipline}
                            onChange={(event) =>
                              setAthleteProfileForm((current) => ({
                                ...current,
                                discipline: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label className="field">
                          <span>{copyFor(language, { en: "Weight class", ru: "Весовая категория", bg: "Категория" })}</span>
                          <input
                            value={athleteProfileForm.weightClass}
                            onChange={(event) =>
                              setAthleteProfileForm((current) => ({
                                ...current,
                                weightClass: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label className="field">
                          <span>{copyFor(language, { en: "Dominant side", ru: "Ведущая сторона", bg: "Водеща страна" })}</span>
                          <input
                            value={athleteProfileForm.dominantSide}
                            onChange={(event) =>
                              setAthleteProfileForm((current) => ({
                                ...current,
                                dominantSide: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label className="field">
                          <span>{copyFor(language, { en: "Wrestling experience, years", ru: "Стаж борьбы, лет", bg: "Стаж борба, години" })}</span>
                          <input
                            type="number"
                            step="0.1"
                            value={athleteProfileForm.wrestlingExperienceYears ?? ""}
                            onChange={(event) =>
                              setAthleteProfileForm((current) => ({
                                ...current,
                                wrestlingExperienceYears: event.target.value
                                  ? Number(event.target.value)
                                  : null,
                              }))
                            }
                          />
                        </label>
                        <div className="coach-athlete-profile-form-section">
                          <div className="summary-topline">
                            <strong>
                              {copyFor(language, {
                                en: "Strength indicators",
                                ru: "Силовые показатели",
                                bg: "Силови показатели",
                              })}
                            </strong>
                            <span>
                              {copyFor(language, {
                                en: "kg / reps",
                                ru: "кг / повторы",
                                bg: "кг / повторения",
                              })}
                            </span>
                          </div>
                          <div className="coach-athlete-profile-form">
                            <label className="field">
                              <span>{copyFor(language, { en: "Squat, kg", ru: "Присед, кг", bg: "Клек, кг" })}</span>
                              <input
                                type="number"
                                step="0.5"
                                value={athleteProfileForm.strengthSquatKg ?? ""}
                                onChange={(event) =>
                                  setAthleteProfileForm((current) => ({
                                    ...current,
                                    strengthSquatKg: parseOptionalNumberInput(event.target.value),
                                  }))
                                }
                              />
                            </label>
                            <label className="field">
                              <span>{copyFor(language, { en: "Bench press, kg", ru: "Жим лёжа, кг", bg: "Лег, кг" })}</span>
                              <input
                                type="number"
                                step="0.5"
                                value={athleteProfileForm.strengthBenchPressKg ?? ""}
                                onChange={(event) =>
                                  setAthleteProfileForm((current) => ({
                                    ...current,
                                    strengthBenchPressKg: parseOptionalNumberInput(event.target.value),
                                  }))
                                }
                              />
                            </label>
                            <label className="field">
                              <span>{copyFor(language, { en: "Deadlift, kg", ru: "Становая тяга, кг", bg: "Тяга, кг" })}</span>
                              <input
                                type="number"
                                step="0.5"
                                value={athleteProfileForm.strengthDeadliftKg ?? ""}
                                onChange={(event) =>
                                  setAthleteProfileForm((current) => ({
                                    ...current,
                                    strengthDeadliftKg: parseOptionalNumberInput(event.target.value),
                                  }))
                                }
                              />
                            </label>
                            <label className="field">
                              <span>{copyFor(language, { en: "Pull-ups max", ru: "Подтягивания max", bg: "Набирания max" })}</span>
                              <input
                                type="number"
                                value={athleteProfileForm.strengthPullUpsMax ?? ""}
                                onChange={(event) =>
                                  setAthleteProfileForm((current) => ({
                                    ...current,
                                    strengthPullUpsMax: parseOptionalNumberInput(event.target.value),
                                  }))
                                }
                              />
                            </label>
                            <label className="field">
                              <span>{copyFor(language, { en: "Grip left, kg", ru: "Хват левый, кг", bg: "Хват ляв, кг" })}</span>
                              <input
                                type="number"
                                step="0.5"
                                value={athleteProfileForm.strengthGripLeftKg ?? ""}
                                onChange={(event) =>
                                  setAthleteProfileForm((current) => ({
                                    ...current,
                                    strengthGripLeftKg: parseOptionalNumberInput(event.target.value),
                                  }))
                                }
                              />
                            </label>
                            <label className="field">
                              <span>{copyFor(language, { en: "Grip right, kg", ru: "Хват правый, кг", bg: "Хват десен, кг" })}</span>
                              <input
                                type="number"
                                step="0.5"
                                value={athleteProfileForm.strengthGripRightKg ?? ""}
                                onChange={(event) =>
                                  setAthleteProfileForm((current) => ({
                                    ...current,
                                    strengthGripRightKg: parseOptionalNumberInput(event.target.value),
                                  }))
                                }
                              />
                            </label>
                            <label className="field coach-athlete-profile-notes">
                              <span>
                                {copyFor(language, {
                                  en: "Strength notes",
                                  ru: "Заметки по силовой подготовке",
                                  bg: "Бележки за силова подготовка",
                                })}
                              </span>
                              <textarea
                                value={athleteProfileForm.strengthNotes}
                                onChange={(event) =>
                                  setAthleteProfileForm((current) => ({
                                    ...current,
                                    strengthNotes: event.target.value,
                                  }))
                                }
                              />
                            </label>
                          </div>
                        </div>
                        <label className="field coach-athlete-profile-notes">
                          <span>{copyFor(language, { en: "Strengths", ru: "Сильные стороны", bg: "Силни страни" })}</span>
                          <textarea
                            value={athleteProfileForm.strengths}
                            onChange={(event) =>
                              setAthleteProfileForm((current) => ({
                                ...current,
                                strengths: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label className="field coach-athlete-profile-notes">
                          <span>{copyFor(language, { en: "Weaknesses", ru: "Слабые стороны", bg: "Слаби страни" })}</span>
                          <textarea
                            value={athleteProfileForm.weaknesses}
                            onChange={(event) =>
                              setAthleteProfileForm((current) => ({
                                ...current,
                                weaknesses: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label className="field coach-athlete-profile-notes">
                          <span>{copyFor(language, { en: "Injuries / restrictions", ru: "Травмы / ограничения", bg: "Травми / ограничения" })}</span>
                          <textarea
                            value={athleteProfileForm.injuriesOrRestrictions}
                            onChange={(event) =>
                              setAthleteProfileForm((current) => ({
                                ...current,
                                injuriesOrRestrictions: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label className="field coach-athlete-profile-notes">
                          <span>{copyFor(language, { en: "Preparation goal", ru: "Цель подготовки", bg: "Цел на подготовката" })}</span>
                          <textarea
                            value={athleteProfileForm.preparationGoal}
                            onChange={(event) =>
                              setAthleteProfileForm((current) => ({
                                ...current,
                                preparationGoal: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label className="field coach-athlete-profile-notes">
                          <span>{copyFor(language, { en: "Coach notes", ru: "Рабочие заметки", bg: "Работни бележки" })}</span>
                          <textarea
                            value={athleteProfileForm.profileNotes}
                            onChange={(event) =>
                              setAthleteProfileForm((current) => ({
                                ...current,
                                profileNotes: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <button
                          className="primary-button"
                          disabled={athleteProfileSaveState === "saving"}
                          type="submit"
                        >
                          {athleteProfileSaveState === "saving"
                            ? copyFor(language, {
                                en: "Saving...",
                                ru: "Сохранение...",
                                bg: "Запазване...",
                              })
                            : copyFor(language, {
                                en: "Save athlete card",
                                ru: "Сохранить карточку",
                                bg: "Запази картата",
                              })}
                        </button>
                      </form>
                    ) : null}
                  </section>
                ) : null}

                {isCoachDashboardWorkspace && coachView === "readiness" ? (
                <div className="entry-summary">
                  <div className="summary-topline">
                    <strong>{ui("athleteReadinessHistory")}</strong>
                    <span>{selectedAthleteEntries.length} {ui("recentEntries")}</span>
                  </div>

                  {selectedAthleteEntries.length === 0 ? (
                    <p className="placeholder-copy">
                      {ui("athleteNoReadinessYet")}
                    </p>
                  ) : (
                    <ul>
                      {selectedAthleteEntries.map((entry) => (
                        <li key={entry.id}>
                          {entry.entryDate}: {readinessMeta[entry.status].label} /{" "}
                          {copyFor(language, { en: "score", ru: "оценка", bg: "оценка" })}{" "}
                          {entry.score} /{" "}
                          {copyFor(language, { en: "HR", ru: "пульс", bg: "пулс" })}{" "}
                          {entry.restingHr} /{" "}
                          {copyFor(language, { en: "pain", ru: "боль", bg: "болка" })}{" "}
                          {entry.painLevel}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                ) : null}

                {isCoachDashboardWorkspace && coachView === "adaptation" ? (
                <div className="entry-summary">
                  <div className="summary-topline">
                    <strong>{ui("coachAdaptationTitle")}</strong>
                    <span>
                      {coachAdaptedPlan
                        ? `${coachAdaptedPlan.readinessStatus} / ${coachAdaptedPlan.readinessScore}`
                        : ui("notGenerated")}
                    </span>
                  </div>
                  {coachAdaptedPlan ? (
                    <>
                      <p>
                        {coachAdaptedPlan.explanation.length
                          ? coachAdaptedPlan.explanation
                              .map((item) => translateAdaptationText(item, language))
                              .join(" ")
                          : language === "ru"
                            ? "Изменения блоков не потребовались."
                            : language === "bg"
                              ? "Не бяха нужни промени по блоковете."
                              : ui("noCoachAdaptationChanges")}
                      </p>
                      <ul>
                        {coachAdaptedPlan.sessions.flatMap((session) =>
                          session.blocks.map((block) => (
                            <li key={block.id}>
                              {session.name}: {block.name} [{translateBlockAction(block.action, language)}] -{" "}
                              {translateAdaptationText(block.adaptationReason, language)}
                              {(block.exercises ?? []).length > 0 ? (
                                <div className="assigned-exercise-list">
                                  {(block.exercises ?? []).map((exercise) => (
                                    <div className="assigned-exercise-row" key={exercise.id}>
                                      <strong>{exercise.name}</strong>
                                      <span>{formatExerciseTarget(exercise, language)}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </li>
                          )),
                        )}
                      </ul>
                    </>
                  ) : (
                    <p className="placeholder-copy">
                      {ui("adaptationNeedsPlan")}
                    </p>
                  )}
                </div>
                ) : null}

                {isCoachDashboardWorkspace && coachView === "competition" ? (
                <div className="entry-summary">
                  <div className="summary-topline">
                    <strong>Competition context</strong>
                    <span>
                      {competitionContext?.phase
                        ? `${competitionContext.phase} / ${competitionContext.competitionPriority ?? "-"}`
                        : "not linked"}
                    </span>
                  </div>
                  {competitionContext ? (
                    <ul>
                      <li>Days to competition: {competitionContext.daysToCompetition ?? "-"}</li>
                      <li>Phase: {competitionContext.phase ?? "-"}</li>
                      <li>Priority: {competitionContext.competitionPriority ?? "-"}</li>
                      <li>Taper active: {competitionContext.taperState ? "yes" : "no"}</li>
                      <li>Weight cut active: {competitionContext.weightCutState ? "yes" : "no"}</li>
                    </ul>
                  ) : (
                    <p className="placeholder-copy">
                      No competition preparation context is active for the selected athlete.
                    </p>
                  )}
                </div>
                ) : null}

                {isCoachDashboardWorkspace && coachView === "competition" ? (
                <div className="entry-summary">
                  <div className="summary-topline">
                    <strong>Competition review</strong>
                    <span>
                      {competitionReview
                        ? `${competitionReview.seasons.length} season group(s)`
                        : "not loaded"}
                    </span>
                  </div>
                  {competitionReview &&
                  (competitionReview.seasons.length > 0 ||
                    competitionReview.unlinkedPlans.length > 0) ? (
                    <>
                      {competitionReview.seasons.length > 0 ? (
                        <ul>
                          {competitionReview.seasons.map((season) => (
                            <li key={season.seasonId ?? `${season.seasonName}-${season.seasonYear ?? "na"}`}>
                              {season.seasonYear ?? "-"} / {season.seasonName}:{" "}
                              {season.plans
                                .map((plan) =>
                                  `${plan.competitionTitle} [${plan.priority}] -> ${
                                    plan.result
                                      ? `place ${plan.result.finalPlace ?? "-"}, matches ${
                                          plan.result.matchesCount ?? "-"
                                        }`
                                      : "result pending"
                                  }`,
                                )
                                .join("; ")}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {competitionReview.unlinkedPlans.length > 0 ? (
                        <p>
                          Unlinked plans:{" "}
                          {competitionReview.unlinkedPlans
                            .map((plan) => `${plan.competitionTitle} (${plan.priority})`)
                            .join(", ")}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="placeholder-copy">
                      No season/competition result chain exists yet for the selected athlete.
                    </p>
                  )}
                </div>
                ) : null}

                {isCoachReviewWorkspace || (isCoachDashboardWorkspace && coachView === "execution") ? (
                <div className="entry-summary coach-review-card">
                  <div className="summary-topline">
                    <strong>{t("executionReview")}</strong>
                    <span>
                      {coachExecutionReview
                        ? `${coachExecutionReview.summary.completionRate}% ${ui("completionPercent")}`
                        : ui("noReviewYet")}
                    </span>
                  </div>
                  {coachReviewDayOptions.length > 0 ? (
                    <label className="field coach-review-day-field">
                      <span>
                        {copyFor(language, {
                          en: "Day for coach note",
                          ru: "День для записи тренера",
                          bg: "Ден за запис на треньора",
                        })}
                      </span>
                      <select
                        disabled={busy}
                        onChange={(event) => void handleCoachReviewDayChange(event.target.value)}
                        value={coachExecutionReview?.assignedPlanId ?? ""}
                      >
                        {!coachExecutionReview ? (
                          <option value="">
                            {copyFor(language, {
                              en: "Select day",
                              ru: "Выберите день",
                              bg: "Изберете ден",
                            })}
                          </option>
                        ) : null}
                        {coachReviewDayOptions.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.day.dayDate} / {plan.day.label} / {plan.templateName}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {coachExecutionReview ? (
                    <>
                      <section className="coach-day-status-panel">
                        <div className="summary-topline">
                          <div>
                            <strong>
                              {copyFor(language, {
                                en: "Day status",
                                ru: "Статус дня",
                                bg: "Статус на деня",
                              })}
                            </strong>
                            <span>
                              {selectedCoachAthlete?.fullName ?? coachExecutionReview.athleteName} /{" "}
                              {coachExecutionReview.dayDate}
                            </span>
                          </div>
                          <span className={`status-chip ${selectedCoachDayDataQuality?.status ?? "pending"}`}>
                            {selectedCoachDayDataQuality?.statusLabel ??
                              copyFor(language, {
                                en: "Not evaluated",
                                ru: "Не оценено",
                                bg: "Не е оценено",
                              })}
                          </span>
                        </div>
                        <div className="coach-day-status-grid">
                          {[
                            {
                              label: copyFor(language, { en: "Readiness", ru: "Готовность", bg: "Готовност" }),
                              value: selectedCoachReadinessEntry ? selectedCoachReadinessEntry.score : "-",
                              detail: selectedCoachReadinessEntry
                                ? formatCoachAiReadinessStatus(selectedCoachReadinessEntry.status, language)
                                : copyFor(language, { en: "not submitted", ru: "не отправлена", bg: "не е подадена" }),
                            },
                            {
                              label: copyFor(language, { en: "Planned load", ru: "Плановая нагрузка", bg: "Планово натоварване" }),
                              value: formatCoachDayLoadValue(
                                coachExecutionReview.sessions.reduce(
                                  (total, session) =>
                                    total +
                                    session.blocks.reduce(
                                      (blockTotal, block) =>
                                        blockTotal + getCoachAiBlockPlannedLoad(block),
                                      0,
                                    ),
                                  0,
                                ),
                              ),
                              detail: `${coachExecutionReview.summary.plannedBlocks} ${copyFor(language, {
                                en: "blocks",
                                ru: "блоков",
                                bg: "блока",
                              })}`,
                            },
                            {
                              label: copyFor(language, { en: "Actual load", ru: "Фактическая нагрузка", bg: "Реално натоварване" }),
                              value: formatCoachDayLoadValue(
                                coachExecutionReview.sessions.reduce(
                                  (total, session) =>
                                    total +
                                    session.blocks.reduce((blockTotal, block) => {
                                      const planned = getCoachAiBlockPlannedLoad(block);
                                      return blockTotal + getCoachAiBlockActualLoad(block, planned);
                                    }, 0),
                                  0,
                                ),
                              ),
                              detail: `${coachExecutionReview.summary.completionRate}% ${ui("completionPercent")}`,
                            },
                            {
                              label: copyFor(language, { en: "Execution", ru: "Выполнение", bg: "Изпълнение" }),
                              value: `${coachExecutionReview.summary.completedBlocks}/${coachExecutionReview.summary.plannedBlocks}`,
                              detail: `${coachExecutionReview.summary.partialBlocks} ${copyFor(language, {
                                en: "partial",
                                ru: "частично",
                                bg: "частично",
                              })}`,
                            },
                            {
                              label: copyFor(language, { en: "Sleep", ru: "Сон", bg: "Сън" }),
                              value: formatDeviceSleepValue(selectedCoachDeviceHealthSummary, language),
                              detail: selectedCoachDeviceHealthSummary?.sleep?.score !== null &&
                                selectedCoachDeviceHealthSummary?.sleep?.score !== undefined
                                ? `${copyFor(language, { en: "score", ru: "оценка", bg: "оценка" })} ${selectedCoachDeviceHealthSummary.sleep.score}`
                                : copyFor(language, { en: "device data", ru: "данные устройства", bg: "данни от устройство" }),
                            },
                            {
                              label: copyFor(language, { en: "Resting HR", ru: "Пульс покоя", bg: "Пулс в покой" }),
                              value: formatDeviceRestingHrValue(selectedCoachDeviceHealthSummary),
                              detail: formatDeviceRestingHrDetail(selectedCoachDeviceHealthSummary, language),
                            },
                            {
                              label: copyFor(language, { en: "Device workouts", ru: "Тренировки устройства", bg: "Тренировки от устройство" }),
                              value: formatDeviceWorkoutValue(selectedCoachDeviceHealthSummary),
                              detail: selectedCoachDeviceHealthSummary?.workout?.totalDurationMinutes
                                ? formatDeviceDuration(selectedCoachDeviceHealthSummary.workout.totalDurationMinutes, language)
                                : copyFor(language, { en: "not received", ru: "не пришли", bg: "не са получени" }),
                            },
                            {
                              label: copyFor(language, { en: "AI", ru: "ИИ", bg: "AI" }),
                              value: latestCoachAiReview
                                ? formatCoachAiReviewSource(latestCoachAiReview.source, language)
                                : "-",
                              detail: latestCoachAiReview
                                ? latestCoachAiReview.riskNotes[0] ?? latestCoachAiReview.observation
                                : copyFor(language, { en: "not generated", ru: "не сформирован", bg: "не е генериран" }),
                            },
                          ].map((item) => (
                            <article className="coach-day-status-metric" key={item.label}>
                              <span>{item.label}</span>
                              <strong>{item.value}</strong>
                              <small>{item.detail}</small>
                            </article>
                          ))}
                        </div>
                        {selectedCoachDayDataQuality ? (
                          <div className="coach-day-quality-panel">
                            <article>
                              <strong>{copyFor(language, { en: "Available", ru: "Что есть", bg: "Налично" })}</strong>
                              <p>
                                {selectedCoachDayDataQuality.available.length
                                  ? selectedCoachDayDataQuality.available.join(", ")
                                  : copyFor(language, { en: "nothing yet", ru: "пока ничего", bg: "все още нищо" })}
                              </p>
                            </article>
                            <article>
                              <strong>{copyFor(language, { en: "Missing", ru: "Чего не хватает", bg: "Липсва" })}</strong>
                              <p>
                                {selectedCoachDayDataQuality.missing.length
                                  ? selectedCoachDayDataQuality.missing.join(", ")
                                  : copyFor(language, {
                                      en: "enough for analysis",
                                      ru: "достаточно для анализа",
                                      bg: "достатъчно за анализ",
                                    })}
                              </p>
                            </article>
                            <ul>
                              {(selectedCoachDayDataQuality.actions.length
                                ? selectedCoachDayDataQuality.actions
                                : [
                                    copyFor(language, {
                                      en: "The day can be reviewed with the current data.",
                                      ru: "День можно разбирать по текущим данным.",
                                      bg: "Денят може да се анализира с текущите данни.",
                                    }),
                                  ]).slice(0, 4).map((action) => (
                                <li key={action}>{action}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        <div className="device-workout-link-panel">
                          <div className="summary-topline">
                            <div>
                              <strong>
                                {copyFor(language, {
                                  en: "Device workout data",
                                  ru: "Данные тренировки с устройства",
                                  bg: "Данни за тренировка от устройство",
                                })}
                              </strong>
                              <span>
                                {selectedCoachDeviceWorkouts.length
                                  ? `${selectedCoachDeviceWorkouts.length} ${copyFor(language, {
                                      en: "workouts received",
                                      ru: "тренировок пришло",
                                      bg: "получени тренировки",
                                    })}`
                                  : copyFor(language, {
                                      en: "No device workouts for this day",
                                      ru: "За этот день тренировок устройства нет",
                                      bg: "Няма тренировки от устройство за този ден",
                                    })}
                              </span>
                            </div>
                            <button
                              className="secondary-button"
                              disabled={busy || !selectedAthleteId}
                              onClick={() => void handleRefreshCoachDeviceWorkouts()}
                              type="button"
                            >
                              {copyFor(language, {
                                en: "Refresh",
                                ru: "Обновить",
                                bg: "Обнови",
                              })}
                            </button>
                          </div>
                          {selectedCoachDeviceWorkouts.length === 0 ? (
                            <p className="device-workout-empty">
                              {copyFor(language, {
                                en: "The selector becomes active after the athlete syncs detailed Mi Fitness / Health Connect workouts for this date.",
                                ru: "Выбор станет активным после того, как спортсмен синхронизирует детальные тренировки Mi Fitness / Health Connect за эту дату.",
                                bg: "Изборът става активен след като спортистът синхронизира детайлни тренировки Mi Fitness / Health Connect за тази дата.",
                              })}
                            </p>
                          ) : null}
                          <div className="device-workout-block-list">
                            {coachExecutionReview.sessions.flatMap((session) =>
                              session.blocks.map((block) => {
                                const link = getDeviceWorkoutLinkForBlock(
                                  selectedCoachDeviceWorkoutLinks,
                                  block.id,
                                );
                                const linkedWorkout = link?.workout ?? null;

                                return (
                                  <article className="device-workout-block-card" key={block.id}>
                                    <div>
                                      <strong>{block.name}</strong>
                                      <span>{session.name}</span>
                                    </div>
                                    <span className={`status-chip ${linkedWorkout ? "complete" : selectedCoachDeviceWorkouts.length ? "partial" : "pending"}`}>
                                      {linkedWorkout
                                        ? copyFor(language, {
                                            en: "linked to device",
                                            ru: "связано с устройством",
                                            bg: "свързано с устройство",
                                          })
                                        : selectedCoachDeviceWorkouts.length
                                          ? copyFor(language, {
                                              en: "not linked",
                                              ru: "не связано",
                                              bg: "не е свързано",
                                            })
                                          : copyFor(language, {
                                              en: "no device data",
                                              ru: "нет данных устройства",
                                              bg: "няма данни от устройство",
                                            })}
                                    </span>
                                    <select
                                      disabled={busy || selectedCoachDeviceWorkouts.length === 0}
                                      value={linkedWorkout?.id ?? ""}
                                      onChange={(event) => {
                                        const deviceWorkoutId = event.currentTarget.value;
                                        if (!deviceWorkoutId) {
                                          if (link) {
                                            void handleUnlinkDeviceWorkout(link.id);
                                          }
                                          return;
                                        }

                                        void handleLinkDeviceWorkout({
                                          assignedBlockId: block.id,
                                          assignedPlanId: coachExecutionReview.assignedPlanId,
                                          deviceWorkoutId,
                                        });
                                      }}
                                    >
                                      <option value="">
                                        {copyFor(language, {
                                          en: "Select device workout",
                                          ru: "Выбрать тренировку устройства",
                                          bg: "Изберете тренировка от устройство",
                                        })}
                                      </option>
                                      {selectedCoachDeviceWorkouts.map((workout) => (
                                        <option key={workout.id} value={workout.id}>
                                          {formatDeviceWorkoutOptionLabel(workout, language)}
                                        </option>
                                      ))}
                                    </select>
                                    {linkedWorkout ? (
                                      <div className="device-workout-linked-summary">
                                        <strong>{formatDeviceWorkoutTitle(linkedWorkout, language)}</strong>
                                        <DeviceWorkoutMetricGrid language={language} workout={linkedWorkout} />
                                        <small>
                                          {linkedWorkout.sourceDevice ?? "Health Connect"} · {formatDeviceWorkoutTimeRange(linkedWorkout, language)}
                                        </small>
                                        <DeviceWorkoutMiniGraph language={language} workout={linkedWorkout} />
                                      </div>
                                    ) : null}
                                  </article>
                                );
                              }),
                            )}
                          </div>
                        </div>
                      </section>
                      <div className="coach-review-summary-grid">
                        {[
                          {
                            label: copyFor(language, { en: "Planned", ru: "План", bg: "План" }),
                            value: coachExecutionReview.summary.plannedBlocks,
                          },
                          {
                            label: copyFor(language, { en: "Done", ru: "Выполнено", bg: "Изпълнено" }),
                            value: coachExecutionReview.summary.completedBlocks,
                          },
                          {
                            label: copyFor(language, { en: "Partial", ru: "Частично", bg: "Частично" }),
                            value: coachExecutionReview.summary.partialBlocks,
                          },
                          {
                            label: copyFor(language, { en: "Missed", ru: "Пропущено", bg: "Пропуснато" }),
                            value: coachExecutionReview.summary.missedBlocks,
                          },
                          {
                            label: "RPE",
                            value: coachExecutionReview.summary.averageRpe ?? "-",
                          },
                          {
                            label: copyFor(language, { en: "Duration", ru: "Длительность", bg: "Продължителност" }),
                            value: `${coachExecutionReview.summary.totalDurationMinutes} ${copyFor(language, {
                              en: "min",
                              ru: "мин",
                              bg: "мин",
                            })}`,
                          },
                        ].map((item) => (
                          <div className="coach-review-summary-item" key={item.label}>
                            <span>{item.label}</span>
                            <strong>{item.value}</strong>
                          </div>
                        ))}
                      </div>
                      <form className="coach-diary-panel" onSubmit={handleCoachDiarySubmit}>
                        <div className="summary-topline">
                          <div className="coach-diary-heading">
                            <strong>
                              {copyFor(language, {
                                en: "Coach note for the day",
                                ru: "Запись тренера за день",
                                bg: "Запис на треньора за деня",
                              })}
                            </strong>
                            <small>
                              {coachExecutionReview.dayDate} / {coachExecutionReview.dayLabel}
                            </small>
                            <small>
                              {latestCoachDiaryEntry
                                ? `${copyFor(language, {
                                    en: "Latest",
                                    ru: "Последняя",
                                    bg: "Последен",
                                  })}: ${latestCoachDiaryEntry.updatedAt.slice(0, 16)}`
                                : copyFor(language, {
                                    en: "Day comment or task-specific note",
                                    ru: "Комментарий ко всему дню или к заданиям",
                                    bg: "Коментар за целия ден или по задачи",
                                  })}
                            </small>
                          </div>
                          <span className={`status-chip ${pendingCoachDiaryQueued ? "pending" : "synced"}`}>
                            {pendingCoachDiaryQueued ? ui("pendingSync") : ui("readyToSync")}
                          </span>
                        </div>

                        <div className="coach-diary-scope" role="radiogroup">
                          <label>
                            <input
                              checked={coachDiaryDraft.scope === "day"}
                              name="coachDiaryScope"
                              onChange={() =>
                                setCoachDiaryDraft((current) => ({
                                  ...current,
                                  scope: "day",
                                  assignedBlockIds: [],
                                  assignedExerciseIds: [],
                                }))
                              }
                              type="radio"
                            />
                            <span>
                              {copyFor(language, { en: "Whole day", ru: "Весь день", bg: "Целият ден" })}
                            </span>
                          </label>
                          <label>
                            <input
                              checked={coachDiaryDraft.scope === "tasks"}
                              name="coachDiaryScope"
                              onChange={() =>
                                setCoachDiaryDraft((current) => ({
                                  ...current,
                                  scope: "tasks",
                                }))
                              }
                              type="radio"
                            />
                            <span>
                              {copyFor(language, { en: "By tasks", ru: "По заданиям", bg: "По задачи" })}
                            </span>
                          </label>
                        </div>

                        {coachDiaryDraft.scope === "tasks" ? (
                          <div className="coach-diary-task-grid">
                            {coachDiaryTaskChoices.map((choice) => {
                              const checked =
                                choice.kind === "exercise"
                                  ? coachDiaryDraft.assignedExerciseIds.includes(choice.id)
                                  : coachDiaryDraft.assignedBlockIds.includes(choice.id);

                              return (
                                <label className="coach-diary-task-choice" key={`${choice.kind}-${choice.id}`}>
                                  <input
                                    checked={checked}
                                    onChange={(event) =>
                                      updateCoachDiaryTarget(choice.kind, choice.id, event.target.checked)
                                    }
                                    type="checkbox"
                                  />
                                  <span>
                                    <strong>{choice.label}</strong>
                                    <small>{choice.meta}</small>
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        ) : null}

                        <label className="field coach-diary-note-field">
                          <span>{t("notes")}</span>
                          <textarea
                            onChange={(event) =>
                              setCoachDiaryDraft((current) => ({
                                ...current,
                                notes: event.target.value,
                              }))
                            }
                            placeholder={copyFor(language, {
                              en: "Observation, decision, or recommendation for this day",
                              ru: "Наблюдение, решение или рекомендация на этот день",
                              bg: "Наблюдение, решение или препоръка за този ден",
                            })}
                            rows={3}
                            value={coachDiaryDraft.notes}
                          />
                        </label>

                        <button
                          className="primary-button"
                          disabled={busy || coachDiaryDraft.notes.trim().length === 0}
                          type="submit"
                        >
                          {busy
                            ? ui("syncingNow")
                            : copyFor(language, {
                                en: "Save note",
                                ru: "Сохранить запись",
                                bg: "Запази запис",
                              })}
                        </button>
                      </form>
                      {selectedCoachDiaryEntries.length > 0 ? (
                        <div className="coach-diary-history">
                          {selectedCoachDiaryEntries.slice(0, 4).map((entry) => {
                            const targetIds = new Set([
                              ...entry.assignedBlockIds,
                              ...entry.assignedExerciseIds,
                            ]);
                            const targetLabels = coachDiaryTaskChoices
                              .filter((choice) => targetIds.has(choice.id))
                              .map((choice) => choice.label);
                            const targetLabel =
                              entry.scope === "day"
                                ? copyFor(language, {
                                    en: "Whole day",
                                    ru: "Весь день",
                                    bg: "Целият ден",
                                  })
                                : targetLabels.length > 0
                                  ? targetLabels.slice(0, 3).join(" / ")
                                  : copyFor(language, {
                                      en: "Selected tasks",
                                      ru: "Выбранные задания",
                                      bg: "Избрани задачи",
                                    });

                            return (
                              <article className="coach-diary-history-item" key={entry.id}>
                                <div className="summary-topline">
                                  <strong>{targetLabel}</strong>
                                  <span>{entry.entryDate} / {entry.updatedAt.slice(0, 16)}</span>
                                </div>
                                <p>{entry.notes}</p>
                                <small>{entry.coachName}</small>
                              </article>
                            );
                          })}
                        </div>
                      ) : null}
                      <div className="coach-ai-status-panel">
                        <div className="summary-topline">
                          <div className="coach-ai-status-heading">
                            <strong>
                              {copyFor(language, {
                                en: "AI review check",
                                ru: "Проверка ИИ-разбора",
                                bg: "Проверка на AI анализа",
                              })}
                            </strong>
                            <small>
                              {copyFor(language, {
                                en: "Service check only: plans, diary, and history are not changed.",
                                ru: "Только служебная проверка: план, дневник и история не меняются.",
                                bg: "Само служебна проверка: планът, дневникът и историята не се променят.",
                              })}
                            </small>
                          </div>
                          <span className={`status-chip ${coachAiStatusChipClass}`}>
                            {coachAiStatusSourceLabel}
                          </span>
                        </div>

                        {coachAiStatus ? (
                          <>
                            <div className="coach-ai-status-grid">
                              <span>
                                <small>
                                  {copyFor(language, { en: "Mode", ru: "Режим", bg: "Режим" })}
                                </small>
                                <strong>{coachAiStatusModeLabel}</strong>
                              </span>
                              <span>
                                <small>
                                  {copyFor(language, { en: "Model", ru: "Модель", bg: "Модел" })}
                                </small>
                                <strong>
                                  {coachAiStatus.modelConfigured
                                    ? copyFor(language, { en: "configured", ru: "настроена", bg: "настроен" })
                                    : copyFor(language, { en: "not set", ru: "не задана", bg: "не е зададен" })}
                                </strong>
                              </span>
                              <span>
                                <small>
                                  {copyFor(language, { en: "API key", ru: "Ключ API", bg: "API ключ" })}
                                </small>
                                <strong>
                                  {coachAiStatus.apiKeyConfigured
                                    ? copyFor(language, { en: "configured", ru: "настроен", bg: "настроен" })
                                    : copyFor(language, { en: "not set", ru: "не задан", bg: "не е зададен" })}
                                </strong>
                              </span>
                              <span>
                                <small>Fallback</small>
                                <strong>
                                  {coachAiStatus.fallbackEnabled
                                    ? copyFor(language, { en: "enabled", ru: "включён", bg: "включен" })
                                    : copyFor(language, { en: "disabled", ru: "выключен", bg: "изключен" })}
                                </strong>
                              </span>
                            </div>
                            <p>{coachAiStatus.message}</p>
                          </>
                        ) : (
                          <p>
                            {copyFor(language, {
                              en: "AI status will load after sign-in.",
                              ru: "Статус ИИ загрузится после входа в аккаунт.",
                              bg: "Статусът на AI ще се зареди след вход.",
                            })}
                          </p>
                        )}

                        <div className="coach-ai-status-actions">
                          <button
                            className="secondary-button"
                            disabled={coachAiDiagnosticBusy}
                            onClick={() => void handleCoachAiDiagnosticClick()}
                            type="button"
                          >
                            {coachAiDiagnosticBusy
                              ? copyFor(language, {
                                  en: "Checking...",
                                  ru: "Проверяю...",
                                  bg: "Проверявам...",
                                })
                              : copyFor(language, {
                                  en: "Test AI",
                                  ru: "Проверить ИИ",
                                  bg: "Провери AI",
                                })}
                          </button>
                          {coachAiDiagnosticMessage ? <span>{coachAiDiagnosticMessage}</span> : null}
                        </div>

                        {coachAiDiagnostic ? (
                          <article className="coach-ai-diagnostic-result">
                            <div className="summary-topline">
                              <strong>
                                {copyFor(language, {
                                  en: "Last test result",
                                  ru: "Последняя проверка",
                                  bg: "Последна проверка",
                                })}
                              </strong>
                              <span>
                                {coachAiDiagnostic.checkedAt.slice(0, 16)} /{" "}
                                {coachAiDiagnostic.review.source === "model"
                                  ? copyFor(language, { en: "model", ru: "модель", bg: "модел" })
                                  : copyFor(language, {
                                      en: "server rules",
                                      ru: "серверные правила",
                                      bg: "сървърни правила",
                                    })}
                              </span>
                            </div>
                            <p>{coachAiDiagnostic.review.observation}</p>
                            {coachAiDiagnostic.fallbackUsed ? (
                              <small>
                                {copyFor(language, {
                                  en: "Fallback was used; real AI model did not return the final review.",
                                  ru: "Использован fallback: реальная модель не вернула итоговый разбор.",
                                  bg: "Използван е fallback: реалният модел не върна финалния анализ.",
                                })}
                              </small>
                            ) : null}
                          </article>
                        ) : null}
                      </div>
                      <div className="coach-ai-day-review-panel">
                        <div className="summary-topline">
                          <div className="coach-ai-status-heading">
                            <strong>
                              {copyFor(language, {
                                en: "AI review for this day",
                                ru: "Разбор ИИ по этому дню",
                                bg: "AI анализ за този ден",
                              })}
                            </strong>
                            <small>
                              {copyFor(language, {
                                en: "Uses the selected day: data quality, readiness, plan, execution, device data, and coach note.",
                                ru: "Используется выбранный день: качество данных, готовность, план, выполнение, устройство и запись тренера.",
                                bg: "Използва избрания ден: качество на данните, готовност, план, изпълнение, устройство и запис на треньора.",
                              })}
                            </small>
                          </div>
                          <button
                            className="secondary-button"
                            disabled={coachAiReviewBusy}
                            onClick={() => void handleGenerateCoachAiReviewClick()}
                            type="button"
                          >
                            {coachAiReviewBusy
                              ? copyFor(language, {
                                  en: "Generating...",
                                  ru: "Формирую...",
                                  bg: "Генерирам...",
                                })
                              : copyFor(language, {
                                  en: "Generate recommendation",
                                  ru: "Сформировать рекомендацию",
                                  bg: "Генерирай препоръка",
                                })}
                          </button>
                        </div>

                        <p>
                          {coachAiReviewMessage ||
                            copyFor(language, {
                              en: "The server saves only the recommendation history. Plan and diary stay unchanged.",
                              ru: "Сервер сохраняет только историю рекомендации. План и дневник не меняются.",
                              bg: "Сървърът запазва само историята на препоръката. Планът и дневникът не се променят.",
                            })}
                        </p>

                        {latestCoachAiReview ? (
                          <div className="coach-ai-day-review-result">
                            <article>
                              <span>
                                {copyFor(language, { en: "What is visible", ru: "Что видно", bg: "Какво се вижда" })}
                              </span>
                              <p>{latestCoachAiReview.observation}</p>
                            </article>
                            <article>
                              <span>{copyFor(language, { en: "Risks", ru: "Риски", bg: "Рискове" })}</span>
                              <ul>
                                {latestCoachAiReview.riskNotes.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </article>
                            <article>
                              <span>
                                {copyFor(language, {
                                  en: "What to do tomorrow",
                                  ru: "Что сделать завтра",
                                  bg: "Какво да се направи утре",
                                })}
                              </span>
                              <ul>
                                {latestCoachAiReview.tomorrowActions.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </article>
                            <small>
                              {latestCoachAiReview.generatedAt.slice(0, 16)} /{" "}
                              {formatCoachAiReviewSource(latestCoachAiReview.source, language)}
                            </small>
                          </div>
                        ) : (
                          <p className="placeholder-copy">
                            {copyFor(language, {
                              en: "There is no AI review history for this day yet.",
                              ru: "Истории разбора ИИ за этот день пока нет.",
                              bg: "Все още няма история на AI анализ за този ден.",
                            })}
                          </p>
                        )}

                        {selectedCoachAiReviewHistory.length > 1 ? (
                          <div className="coach-ai-review-history">
                            {selectedCoachAiReviewHistory.slice(1, 4).map((review) => (
                              <article key={`${review.generatedAt}-${review.source}`}>
                                <strong>{review.observation}</strong>
                                <span>
                                  {review.generatedAt.slice(0, 16)} /{" "}
                                  {formatCoachAiReviewSource(review.source, language)}
                                </span>
                              </article>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="coach-day-exercise-status-list">
                        <div className="summary-topline">
                          <strong>
                            {copyFor(language, {
                              en: "Exercises by status",
                              ru: "Упражнения по статусу",
                              bg: "Упражнения по статус",
                            })}
                          </strong>
                          <span>
                            {coachExecutionReview.summary.completedExercises}/
                            {coachExecutionReview.summary.plannedExercises}
                          </span>
                        </div>
                        {coachExecutionReview.sessions.flatMap((session) =>
                          session.blocks.flatMap((block) =>
                            [...(block.exercises ?? [])]
                              .sort((left, right) => left.orderIndex - right.orderIndex)
                              .map((exercise) => (
                                <article
                                  className={`coach-day-exercise-status-item ${getCoachAiExerciseStatus(exercise)}`}
                                  key={exercise.id}
                                >
                                  <span>{translateExecutionStatus(exercise.executionStatus, language)}</span>
                                  <strong>{exercise.name}</strong>
                                  <small>
                                    {session.name} / {block.name} / {formatExerciseTarget(exercise, language)}
                                  </small>
                                </article>
                              )),
                          ),
                        )}
                      </div>
                      <div className="coach-review-block-list">
                        {coachExecutionReview.sessions.flatMap((session) =>
                          session.blocks.map((block) => (
                            <article className="coach-review-block-item" key={block.id}>
                              <div className="coach-review-block-main">
                                <strong>{block.name}</strong>
                                <span>
                                  {session.name} / {translateExecutionStatus(block.executionStatus, language)}
                                </span>
                              </div>
                              <div className="coach-review-block-values">
                                <span>
                                  <small>{copyFor(language, { en: "Sets", ru: "Подходы", bg: "Серии" })}</small>
                                  <strong>
                                    {block.targetSets ?? "-"} / {block.actualResult?.setsCompleted ?? "-"}
                                  </strong>
                                </span>
                                <span>
                                  <small>{copyFor(language, { en: "Reps", ru: "Повторы", bg: "Повт." })}</small>
                                  <strong>
                                    {block.targetReps ?? "-"} / {block.actualResult?.repsCompleted ?? "-"}
                                  </strong>
                                </span>
                                <span>
                                  <small>{copyFor(language, { en: "Duration", ru: "Длит.", bg: "Време" })}</small>
                                  <strong>
                                    {block.targetDurationMinutes ?? "-"} / {block.actualResult?.durationMinutes ?? "-"}
                                  </strong>
                                </span>
                                <span>
                                  <small>RPE</small>
                                  <strong>
                                    {block.targetRpe ?? "-"} / {block.actualResult?.rpe ?? "-"}
                                  </strong>
                                </span>
                              </div>
                            </article>
                          )),
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="placeholder-copy">
                      {ui("coachReviewNeedsPlan")}
                    </p>
                  )}
                </div>
                ) : null}

                {(isCoachDashboardWorkspace || isCoachReviewWorkspace) && coachTeamDayRows.length > 0 ? (
                <div className="entry-summary coach-team-day-panel">
                  <div className="summary-topline">
                    <strong>
                      {copyFor(language, {
                        en: "Team day panel",
                        ru: "Панель команды",
                        bg: "Панел на отбора",
                      })}
                    </strong>
                    <span>{coachTeamDayDate}</span>
                  </div>
                  <div className="coach-team-day-table">
                    {coachTeamDayRows.map((row) => (
                      <article className={`coach-team-day-row ${row.dataQuality.status}`} key={row.athlete.athleteId}>
                        <div>
                          <strong>{row.athlete.fullName}</strong>
                          <span>{row.statusLabel}</span>
                        </div>
                        <span>{row.readinessEntry ? row.readinessEntry.score : "-"}</span>
                        <span>
                          {formatCoachDayLoadValue(row.actualLoad)} / {formatCoachDayLoadValue(row.plannedLoad)}
                        </span>
                        <span>{formatDeviceSleepValue(row.deviceHealthSummary, language)}</span>
                        <span>{formatDeviceRestingHrValue(row.deviceHealthSummary)}</span>
                        <span>{row.dataQuality.statusLabel}</span>
                        <p>{row.aiReview?.riskNotes[0] ?? row.aiReview?.observation ?? "-"}</p>
                        <button
                          className="secondary-button"
                          disabled={busy}
                          onClick={() => {
                            setSelectedAthleteId(row.athlete.athleteId);
                            const assignedPlanId = assignedPlans.find(
                              (plan) =>
                                plan.athleteId === row.athlete.athleteId &&
                                plan.day.dayDate === coachTeamDayDate,
                            )?.id;
                            void Promise.all([
                              loadCoachAthleteReadiness(row.athlete.athleteId),
                              loadCoachExecutionReview(row.athlete.athleteId, assignedPlanId),
                            ]);
                          }}
                          type="button"
                        >
                          {copyFor(language, { en: "Open day", ru: "Открыть день", bg: "Отвори деня" })}
                        </button>
                      </article>
                    ))}
                  </div>
                </div>
                ) : null}

                {isCoachAnalyticsWorkspace || (isCoachDashboardWorkspace && coachView === "analytics") ? (
                <div className="coach-focus-panel coach-analytics-stage">
                  <div className="summary-topline">
                    <strong>{t("analytics")}</strong>
                    <span>
                      {coachAnalyticsOverview
                        ? `${coachAnalyticsOverview.insights.length} ${copyFor(language, {
                            en: "signals",
                            ru: "сигналов",
                            bg: "сигнала",
                          })} / ${coachAnalyticsOverview.coachSuggestions.length} ${copyFor(language, {
                            en: "recommendations",
                            ru: "рекомендаций",
                            bg: "препоръки",
                          })}`
                        : ui("noAnalyticsYet")}
                    </span>
                  </div>
                  {coachAnalyticsOverview ? (
                    <>
                      <p>
                        {ui("coachAnalyticsIntro")} {coachAnalyticsOverview.athleteName}.
                      </p>
                      <div className="coach-stat-strip">
                        <article className="scene-metric">
                          <span>{ui("latestReadiness")}</span>
                          <strong>
                            {coachLatestReadinessPoint?.score ?? "-"}
                          </strong>
                          <small>
                            {coachLatestReadinessPoint
                              ? readinessMeta[
                                  coachLatestReadinessPoint.status
                                ].label
                              : ui("noEntriesYet")}
                          </small>
                        </article>
                        <article className="scene-metric">
                          <span>{ui("completionTrend")}</span>
                          <strong>
                            {coachLatestCompletionPoint?.adherenceRate ?? "-"}%
                          </strong>
                          <small>
                            {coachLatestCompletionPoint
                              ? `${coachLatestCompletionPoint.completedBlocks}/${coachLatestCompletionPoint.plannedBlocks} ${copyFor(language, {
                                  en: "blocks",
                                  ru: "блоков",
                                  bg: "блока",
                                })}`
                              : ui("noReviewYet")}
                          </small>
                        </article>
                        <article className="scene-metric">
                          <span>{ui("analyticsWeekSnapshot")}</span>
                          <strong>
                            {coachWeekSummary?.actualLoad ?? "-"}
                          </strong>
                          <small>
                            {coachWeekSummary
                              ? `${copyFor(language, {
                                  en: "expected",
                                  ru: "ожидалось",
                                  bg: "очаквано",
                                })} ${coachWeekSummary.expectedLoadToDate ?? coachWeekSummary.targetLoad ?? "-"}`
                              : ui("noAnalyticsYet")}
                          </small>
                        </article>
                      </div>

                      <div className="coach-analytics-grid coach-analytics-grid-v2">
                        <article className="entry-summary coach-analytics-card coach-analytics-card-wide">
                          <div className="summary-topline">
                            <strong>{ui("analyticsCoachInsights")}</strong>
                            <span>{coachAnalyticsOverview.insights.length}</span>
                          </div>
                          <div className="analytics-insight-stack">
                            {coachAnalyticsOverview.insights.map((insight) => (
                              <article className="analytics-insight-card" key={insight.code}>
                                <div className="summary-topline">
                                  <strong>{analyticsInsightTitle(insight)}</strong>
                                  <span className={`analytics-severity-chip ${insight.level}`}>
                                    {analyticsInsightLevel(insight)}
                                  </span>
                                </div>
                                <p>{analyticsInsightSummary(insight)}</p>
                                <div className="analytics-evidence-list">
                                  {insight.evidence.map((item) => (
                                    <div className="analytics-evidence-row" key={`${insight.code}-${item.label}`}>
                                      <span>{analyticsEvidenceLabel(item.label)}</span>
                                      <strong>{item.label === "missing_links"
                                        ? item.value
                                            .split(",")
                                            .map((value) => analyticsMissingLink(value.trim()))
                                            .join(", ")
                                        : item.value}</strong>
                                    </div>
                                  ))}
                                </div>
                                <p className="analytics-recommendation">
                                  <strong>{ui("analyticsRecommendation")}:</strong>{" "}
                                  {analyticsInsightRecommendation(insight)}
                                </p>
                              </article>
                            ))}
                          </div>
                        </article>

                        <article className="entry-summary coach-analytics-card coach-analytics-card-wide">
                          <div className="summary-topline">
                            <strong>{ui("analyticsCoachActions")}</strong>
                            <span>{coachAnalyticsOverview.coachSuggestions.length}</span>
                          </div>
                          {coachAnalyticsOverview.coachSuggestions.length ? (
                            <div className="analytics-action-stack">
                              {coachAnalyticsOverview.coachSuggestions.map((suggestion) => {
                                const plannerLink = resolveAnalyticsSuggestionPlannerLink(
                                  suggestion,
                                  templatePack,
                                  templatePackContext,
                                );

                                return (
                                  <article className="analytics-action-card" key={suggestion.id}>
                                    <div className="summary-topline">
                                      <strong>{analyticsCoachSuggestionTitle(suggestion)}</strong>
                                      <span className={`analytics-severity-chip ${suggestion.level}`}>
                                        {analyticsSeverityLabel(suggestion.level)}
                                      </span>
                                    </div>
                                    <p>{analyticsCoachSuggestionSummary(suggestion)}</p>
                                    <p className="analytics-recommendation">
                                      <strong>{ui("analyticsRecommendation")}:</strong>{" "}
                                      {analyticsCoachSuggestionRecommendation(suggestion)}
                                    </p>

                                    {suggestion.latestDecision ? (
                                      <div className="analytics-decision-panel">
                                        <div className="analytics-decision-row">
                                          <span>{ui("analyticsDecisionState")}</span>
                                          <strong>
                                            {analyticsDecisionStatus(
                                              suggestion.latestDecision.decisionStatus,
                                            )}
                                          </strong>
                                        </div>
                                        <div className="analytics-decision-row">
                                          <span>{ui("analyticsOutcome")}</span>
                                          <strong>
                                            {analyticsDecisionOutcome(suggestion.latestDecision.outcome)}
                                          </strong>
                                        </div>
                                        <div className="analytics-outcome-actions">
                                          {(["positive", "neutral", "negative"] as const).map(
                                            (outcome) => (
                                              <button
                                                className={`tertiary-button analytics-outcome-button ${
                                                  suggestion.latestDecision?.outcome === outcome
                                                    ? "is-active"
                                                    : ""
                                                }`}
                                                disabled={busy}
                                                key={`${suggestion.id}-${outcome}`}
                                                onClick={() =>
                                                  void handleSetAnalyticsDecisionOutcome(
                                                    suggestion.latestDecision!,
                                                    outcome,
                                                  )
                                                }
                                                type="button"
                                              >
                                                {analyticsDecisionOutcome(outcome)}
                                              </button>
                                            ),
                                          )}
                                        </div>
                                      </div>
                                    ) : null}
                                    <div className="analytics-action-footer">
                                      <small>
                                        {suggestion.plannerBridge
                                          ? plannerLink.hasMatchingPack
                                            ? `${suggestion.plannerBridge.startDate} / ${suggestion.plannerBridge.plannedPhase ?? "-"}`
                                            : copyFor(language, {
                                                en: "Open the matching week in planning",
                                                ru: "Откройте эту неделю в планировании",
                                                bg: "Отворете тази седмица в планирането",
                                              })
                                          : copyFor(language, {
                                              en: "Planner bridge unavailable",
        ru: "Связь с планированием недоступна",
        bg: "Връзката с планирането не е налична",
                                            })}
                                      </small>
                                      <div className="analytics-action-buttons">
                                        <button
                                          className="secondary-button analytics-action-button"
                                          disabled={busy || !suggestion.plannerBridge}
                                          onClick={() => void handleApplyAnalyticsCoachSuggestion(suggestion)}
                                          type="button"
                                        >
                                          {suggestion.plannerBridge?.autoApply
                                            ? ui("analyticsOpenAndApply")
                                            : ui("analyticsOpenInPlanner")}
                                        </button>
                                        <button
                                          className="tertiary-button analytics-action-button"
                                          disabled={busy}
                                          onClick={() =>
                                            void handleMarkAnalyticsCoachSuggestionNotApplied(
                                              suggestion,
                                            )
                                          }
                                          type="button"
                                        >
                                          {ui("analyticsMarkNotApplied")}
                                        </button>
                                      </div>
                                    </div>
                                  </article>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="placeholder-copy">{ui("noAnalyticsYet")}</p>
                          )}
                        </article>

                        {coachWeekSummary ? (
                          <article className="entry-summary coach-analytics-card analytics-week-card">
                            <div className="summary-topline">
                              <strong>{ui("analyticsWeekSnapshot")}</strong>
                              <span>{analyticsWeekStatus(coachWeekSummary.status)}</span>
                            </div>
                            <div className="analytics-week-grid">
                              <div>
                                <span>{copyFor(language, { en: "Microcycle", ru: "Микроцикл", bg: "Микроцикъл" })}</span>
                                <strong>{coachWeekSummary.microcycleType ?? "-"}</strong>
                              </div>
                              <div>
                                <span>{copyFor(language, { en: "Target", ru: "Цель", bg: "Цел" })}</span>
                                <strong>{coachWeekSummary.targetLoad ?? "-"}</strong>
                              </div>
                              <div>
                                <span>{copyFor(language, { en: "Expected", ru: "Ожидалось", bg: "Очаквано" })}</span>
                                <strong>{coachWeekSummary.expectedLoadToDate ?? "-"}</strong>
                              </div>
                              <div>
                                <span>{copyFor(language, { en: "Planned by tasks", ru: "План по заданиям", bg: "План по задачи" })}</span>
                                <strong>{coachWeekSummary.plannedLoad}</strong>
                              </div>
                              <div>
                                <span>{copyFor(language, { en: "Actual", ru: "Факт", bg: "Факт" })}</span>
                                <strong>{coachWeekSummary.actualLoad}</strong>
                              </div>
                              <div>
                                <span>{copyFor(language, { en: "Adherence", ru: "Выполнение", bg: "Изпълнение" })}</span>
                                <strong>{coachWeekSummary.adherenceRate}%</strong>
                              </div>
                              <div>
                                <span>{ui("latestReadiness")}</span>
                                <strong>{coachWeekSummary.averageReadiness ?? "-"}</strong>
                              </div>
                            </div>
                            <p className="analytics-load-note">
                              {copyFor(language, {
                                en: `Actual load is based on saved execution: completed exercises count their share of the block, full blocks count planned load, and entered minutes x RPE override the estimate. Now: ${coachWeekSummary.completedBlocks} done, ${coachWeekSummary.partialBlocks} partial, ${coachWeekSummary.missedBlocks} missed.`,
                                ru: `Фактическая нагрузка берётся из сохранённого выполнения: отмеченные упражнения дают свою долю блока, полностью выполненный блок даёт плановую нагрузку, а введённые минуты × RPE заменяют оценку. Сейчас: выполнено ${coachWeekSummary.completedBlocks}, частично ${coachWeekSummary.partialBlocks}, пропущено ${coachWeekSummary.missedBlocks}.`,
                                bg: `Фактическото натоварване идва от запазеното изпълнение: отбелязаните упражнения дават своя дял от блока, пълен блок дава плановото натоварване, а въведени минути × RPE заменят оценката. Сега: изпълнени ${coachWeekSummary.completedBlocks}, частични ${coachWeekSummary.partialBlocks}, пропуснати ${coachWeekSummary.missedBlocks}.`,
                              })}
                            </p>
                          </article>
                        ) : null}

                      </div>
                    </>
                  ) : (
                    <p className="placeholder-copy">
                      {ui("coachAnalyticsNeedData")}
                    </p>
                  )}
                </div>
                ) : null}
                  </div>
                  {showCoachInspectorColumn ? (
                  <aside className="coach-inspector-column">
                    <div className="coach-inspector-card">
                      <div className="summary-topline">
                        <strong>
                          {copyFor(language, {
                            en: "Competition context",
                            ru: "Соревновательный контекст",
                            bg: "Състезателен контекст",
                          })}
                        </strong>
                        <span>
                          {competitionContext?.phase
                            ? `${competitionContext.phase} / ${competitionContext.competitionPriority ?? "-"}`
                            : ui("notGenerated")}
                        </span>
                      </div>
                      {competitionContext ? (
                        <ul>
                          <li>
                            {copyFor(language, {
                              en: "Days to competition",
                              ru: "До старта",
                              bg: "До старт",
                            })}
                            : {competitionContext.daysToCompetition ?? "-"}
                          </li>
                          <li>
                            {copyFor(language, {
                              en: "Phase",
                              ru: "Фаза",
                              bg: "Фаза",
                            })}
                            : {competitionContext.phase ?? "-"}
                          </li>
                          <li>
                            {copyFor(language, {
                              en: "Priority",
                              ru: "Приоритет",
                              bg: "Приоритет",
                            })}
                            : {competitionContext.competitionPriority ?? "-"}
                          </li>
                        </ul>
                      ) : (
                        <p className="placeholder-copy">
                          {copyFor(language, {
                            en: "No active competition preparation context is linked to the selected athlete yet.",
                            ru: "У выбранного спортсмена пока нет активного контекста подготовки к старту.",
                            bg: "Избраният спортист все още няма активен контекст за подготовка към старт.",
                          })}
                        </p>
                      )}
                    </div>
                  </aside>
                  ) : null}
                </div>
              </>
            )}
          </CoachDashboard>
          </CoachDashboardScene>
      ) : null}

      {activeWorkspace === "planning-studio" && (user?.role === "coach" || user?.role === "admin") ? (
        <PlanningStudioScene>
          <PlanningStudio
            compact
            description={planningViewDescription}
            eyebrow={planningViewLabel}
            metrics={planningSceneMetrics}
            title={workspaceTitle}
          >
            <div
              className={`planning-workgrid planning-workgrid-${planningView} ${
                planningView === "weekly" ? "planning-workgrid-weekly" : ""
              } ${
                planningView === "season"
                  ? `planning-workgrid-season-${seasonDisplayMode}`
                  : ""
              }`.trim()}
            >
            {planningView === "preparation" ? (
            <section className="preparation-plan-builder wide-card">
              <aside className="preparation-exercise-library">
                <header>
                  <h3>
                    {copyFor(language, {
                      en: "Exercise library",
                      ru: "Библиотека упражнений",
                      bg: "Библиотека с упражнения",
                    })}
                  </h3>
                  <p className="placeholder-copy">
                    {copyFor(language, {
                      en: "Pick the active day and session on the right, then click an exercise here to add it to the plan.",
                      ru: "Выберите справа день и сессию, затем нажмите упражнение слева — оно появится в плане.",
                      bg: "Изберете ден и сесия вдясно, после натиснете упражнение тук, за да влезе в плана.",
                    })}
                  </p>
                </header>

                <div className="preparation-exercise-library-groups">
                  {PLAN_BLOCK_TYPE_VALUES.map((blockType) => {
                    const presets = getBlockExercisePresets(blockType);

                    return (
                      <details className="preparation-exercise-group" key={blockType} open>
                        <summary>
                          <span>{localizedOptionLabel(blockType, language, BLOCK_TYPE_LABELS)}</span>
                          <strong>{presets.length}</strong>
                        </summary>
                        <div className="preparation-exercise-group-list">
                          {presets.map((preset) => (
                            <button
                              className="preparation-exercise-preset"
                              disabled={!selectedPreparationSession}
                              key={`${blockType}-${preset.id}`}
                              onClick={() => addPreparationExerciseFromPreset(preset)}
                              type="button"
                            >
                              <strong>{copyFor(language, preset.label)}</strong>
                              <span>{formatExercisePresetVolume(preset, language)}</span>
                              <small>{copyFor(language, preset.notes)}</small>
                            </button>
                          ))}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </aside>

              <div className="preparation-plan-workspace">
                <section className="preparation-plan-config-panel">
                  <div className="summary-topline">
                    <div>
                      <strong>
                        {copyFor(language, {
                          en: "Preparation strategy",
                          ru: "Стратегия подготовки",
                          bg: "Стратегия за подготовка",
                        })}
                      </strong>
                      <p className="placeholder-copy">
                        {copyFor(language, {
                          en: "Set the period, goals, phases, monitoring rules, and load logic. Daily exercises are assembled in Weekly plan or Template library.",
                          ru: "Задайте период, цели, фазы, правила контроля и логику нагрузки. Упражнения по дням собираются в недельном плане или библиотеке шаблонов.",
                          bg: "Задайте периода, целите, фазите, правилата за контрол и логиката на натоварването. Дневните упражнения се сглобяват в седмичния план или библиотеката с шаблони.",
                        })}
                      </p>
                    </div>
                    <span>{preparationPlanDraft.period}</span>
                  </div>

                  <div className="preparation-plan-setup-stats">
                    {preparationPlanSetupStats.map((item) => (
                      <article className="preparation-plan-stat-chip" key={item.label}>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </article>
                    ))}
                  </div>

                  <div className="preparation-plan-config-grid">
                    <label className="field">
                      <span>{copyFor(language, { en: "Plan name", ru: "Название плана", bg: "Име на плана" })}</span>
                      <input
                        value={preparationPlanDraft.title}
                        onChange={(event) => updatePreparationPlanDraft({ title: event.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>{copyFor(language, { en: "Period", ru: "Период", bg: "Период" })}</span>
                      <input
                        value={preparationPlanDraft.period}
                        onChange={(event) => updatePreparationPlanDraft({ period: event.target.value })}
                      />
                    </label>
                    <label className="field preparation-plan-config-description">
                      <span>{copyFor(language, { en: "Description", ru: "Описание", bg: "Описание" })}</span>
                      <textarea
                        rows={2}
                        value={preparationPlanDraft.subtitle}
                        onChange={(event) => updatePreparationPlanDraft({ subtitle: event.target.value })}
                      />
                    </label>
                  </div>

                  <section className="preparation-plan-editor-section">
                    <div className="summary-topline">
                      <strong>
                        {copyFor(language, {
                          en: "Key parameters",
                          ru: "Ключевые параметры",
                          bg: "Ключови параметри",
                        })}
                      </strong>
                      <button className="tertiary-button" onClick={addPreparationMetric} type="button">
                        {copyFor(language, { en: "Add module", ru: "Добавить модуль", bg: "Добави модул" })}
                      </button>
                    </div>
                    {preparationPlanDraft.metrics.length === 0 ? (
                      <p className="placeholder-copy">
                        {copyFor(language, {
                          en: "Add the modules that matter for this plan: goal, load, monitoring, nutrition, recovery, taper, or any custom block.",
                          ru: "Добавьте нужные параметры: цель, нагрузка, мониторинг, питание, восстановление, подводка или любой свой блок.",
        bg: "Добавете нужните параметри: цел, натоварване, мониторинг, хранене, възстановяване, тейпър или собствен блок.",
                        })}
                      </p>
                    ) : (
                      <div className="preparation-plan-priority-grid">
                        {preparationPlanDraft.metrics.map((metric, metricIndex) => (
                          <article className="preparation-plan-priority-item" key={`${metric.label}-${metricIndex}`}>
                            <div className="summary-topline preparation-plan-module-header">
                              <strong>
                                {copyFor(language, { en: "Module", ru: "Модуль", bg: "Модул" })} {metricIndex + 1}
                              </strong>
                              <button
                                className="tertiary-button preparation-plan-small-action"
                                onClick={() => removePreparationMetric(metricIndex)}
                                type="button"
                              >
                                {copyFor(language, { en: "Remove", ru: "Удалить", bg: "Премахни" })}
                              </button>
                            </div>
                            <label className="field">
                              <span>{copyFor(language, { en: "Module name", ru: "Название модуля", bg: "Име на модул" })}</span>
                              <input
                                value={metric.label}
                                onChange={(event) =>
                                  updatePreparationMetric(metricIndex, { label: event.target.value })
                                }
                              />
                            </label>
                            <label className="field">
                              <span>{copyFor(language, { en: "Content", ru: "Содержание", bg: "Съдържание" })}</span>
                              <textarea
                                rows={2}
                                value={metric.value}
                                onChange={(event) =>
                                  updatePreparationMetric(metricIndex, { value: event.target.value })
                                }
                              />
                            </label>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="preparation-plan-editor-section">
                    <div className="summary-topline">
                      <strong>
                        {copyFor(language, {
                          en: "Preparation phases",
                          ru: "Фазы подготовки",
                          bg: "Фази на подготовка",
                        })}
                      </strong>
                      <button className="tertiary-button" onClick={addPreparationPhase} type="button">
                        {copyFor(language, { en: "Add phase", ru: "Добавить этап", bg: "Добави етап" })}
                      </button>
                    </div>
                    <div className="preparation-plan-phase-list">
                      {preparationPlanDraft.phases.map((phase, phaseIndex) => (
                        <div className="preparation-plan-phase-row" key={`${phase}-${phaseIndex}`}>
                          <label className="field preparation-plan-phase-field">
                            <span>
                              {copyFor(language, { en: "Phase", ru: "Этап", bg: "Етап" })} {phaseIndex + 1}
                            </span>
                            <input
                              value={phase}
                              onChange={(event) => updatePreparationPhase(phaseIndex, event.target.value)}
                            />
                          </label>
                          <button
                            className="tertiary-button preparation-plan-small-action"
                            onClick={() => removePreparationPhase(phaseIndex)}
                            type="button"
                          >
                            {copyFor(language, { en: "Remove", ru: "Удалить", bg: "Премахни" })}
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                </section>

                <section className="preparation-plan-target-panel">
                  <div className="summary-topline">
                    <strong>
                      {copyFor(language, {
                        en: "Where to add",
                        ru: "Куда добавлять",
                        bg: "Къде да се добавя",
                      })}
                    </strong>
                    <span>
                      {selectedPreparationSession?.rows.length ?? 0}{" "}
                      {copyFor(language, { en: "exercises", ru: "упр.", bg: "упр." })}
                    </span>
                  </div>

                  <span className="preparation-plan-target-label">
                    {copyFor(language, { en: "Week", ru: "Неделя", bg: "Седмица" })}
                  </span>
                  <div className="preparation-plan-picker preparation-plan-week-picker">
                    {preparationPlanDraft.weeks.map((week, weekIndex) => (
                      <button
                        className={weekIndex === selectedPreparationWeekIndex ? "is-active" : ""}
                        key={`${week.title}-${weekIndex}`}
                        onClick={() => {
                          setSelectedPreparationWeekIndex(weekIndex);
                          setSelectedPreparationDayIndex(0);
                          setSelectedPreparationSessionIndex(0);
                        }}
                        type="button"
                      >
                        {week.title}
                      </button>
                    ))}
                  </div>

                  {selectedPreparationWeek ? (
                    <>
                      <span className="preparation-plan-target-label">
                        {copyFor(language, { en: "Day", ru: "День", bg: "Ден" })}
                      </span>
                      <div className="preparation-plan-picker preparation-plan-day-picker">
                        {selectedPreparationWeek.days.map((day, dayIndex) => (
                          <button
                            className={dayIndex === selectedPreparationDayIndex ? "is-active" : ""}
                            key={`${day.title}-${dayIndex}`}
                            onClick={() => {
                              setSelectedPreparationDayIndex(dayIndex);
                              setSelectedPreparationSessionIndex(0);
                            }}
                            type="button"
                          >
                            <strong>{day.title}</strong>
                            <span>{day.type}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : null}

                  {selectedPreparationDay ? (
                    <>
                      <span className="preparation-plan-target-label">
                        {copyFor(language, { en: "Session", ru: "Сессия", bg: "Сесия" })}
                      </span>
                      <div className="preparation-plan-picker preparation-plan-session-picker">
                        {selectedPreparationDay.sessions.map((session, sessionIndex) => (
                          <button
                            className={sessionIndex === selectedPreparationSessionIndex ? "is-active" : ""}
                            key={`${session.title}-${sessionIndex}`}
                            onClick={() => setSelectedPreparationSessionIndex(sessionIndex)}
                            type="button"
                          >
                            {session.title}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : null}

                  <div className="preparation-plan-action-row">
                    <button className="tertiary-button" onClick={addPreparationWeek} type="button">
                      {copyFor(language, { en: "Add week", ru: "Добавить неделю", bg: "Добави седмица" })}
                    </button>
                    {selectedPreparationWeek ? (
                      <button className="tertiary-button" onClick={addPreparationDay} type="button">
                        {copyFor(language, { en: "Add day", ru: "Добавить день", bg: "Добави ден" })}
                      </button>
                    ) : null}
                    {selectedPreparationDay ? (
                      <button className="tertiary-button" onClick={addPreparationSession} type="button">
                        {copyFor(language, { en: "Add session", ru: "Добавить сессию", bg: "Добави сесия" })}
                      </button>
                    ) : null}
                  </div>
                </section>

                <section className="preparation-session-canvas">
                  <div className="summary-topline">
                    <div>
                      <strong>
                        {selectedPreparationSession?.title ??
                          copyFor(language, {
                            en: "No session selected",
                            ru: "Сессия не выбрана",
                            bg: "Няма избрана сесия",
                          })}
                      </strong>
                      <p className="placeholder-copy">
                        {selectedPreparationDay
                          ? `${selectedPreparationDay.title} / ${selectedPreparationDay.type}`
                          : copyFor(language, {
                              en: "Select a day to start building the session.",
                              ru: "Выберите день, чтобы начать собирать сессию.",
                              bg: "Изберете ден, за да започнете сесията.",
                            })}
                      </p>
                    </div>
                    <button
                      className="secondary-button"
                      disabled={!selectedPreparationSession}
                      onClick={addPreparationRow}
                      type="button"
                    >
                      {copyFor(language, { en: "Custom row", ru: "Своя строка", bg: "Свой ред" })}
                    </button>
                  </div>

                  {selectedPreparationSession ? (
                    <>
                      <label className="field">
                        <span>{copyFor(language, { en: "Session title", ru: "Название сессии", bg: "Име на сесия" })}</span>
                        <input
                          value={selectedPreparationSession.title}
                          onChange={(event) => updatePreparationSessionTitle(event.target.value)}
                        />
                      </label>

                      {selectedPreparationDay ? (
                        <div className="preparation-plan-guidance-editor">
                          <label className="field">
                            <span>GREEN</span>
                            <input
                              value={selectedPreparationDay.guidance?.green ?? ""}
                              onChange={(event) => updatePreparationGuidance("green", event.target.value)}
                            />
                          </label>
                          <label className="field">
                            <span>YELLOW</span>
                            <input
                              value={selectedPreparationDay.guidance?.yellow ?? ""}
                              onChange={(event) => updatePreparationGuidance("yellow", event.target.value)}
                            />
                          </label>
                          <label className="field">
                            <span>RED</span>
                            <input
                              value={selectedPreparationDay.guidance?.red ?? ""}
                              onChange={(event) => updatePreparationGuidance("red", event.target.value)}
                            />
                          </label>
                        </div>
                      ) : null}

                      {selectedPreparationSession.rows.length === 0 ? (
                        <p className="placeholder-copy">
                          {copyFor(language, {
                            en: "Click an exercise in the left library to add it here.",
                            ru: "Нажмите упражнение в библиотеке слева, чтобы добавить его сюда.",
                            bg: "Натиснете упражнение вляво, за да го добавите тук.",
                          })}
                        </p>
                      ) : (
                        <div className="preparation-session-exercise-list">
                          {selectedPreparationSession.rows.map((row, rowIndex) => (
                            <article
                              className="preparation-session-exercise-card"
                              key={`${row.block}-${rowIndex}`}
                            >
                              <div className="summary-topline">
                                <strong>
                                  {rowIndex + 1}.{" "}
                                  {row.block ||
                                    copyFor(language, {
                                      en: "Exercise",
                                      ru: "Упражнение",
                                      bg: "Упражнение",
                                    })}
                                </strong>
                                <button
                                  className="tertiary-button"
                                  onClick={() => removePreparationRow(rowIndex)}
                                  type="button"
                                >
                                  {copyFor(language, { en: "Remove", ru: "Удалить", bg: "Премахни" })}
                                </button>
                              </div>
                              <div className="readiness-form preparation-session-exercise-fields">
                                <label className="field">
                                  <span>{copyFor(language, { en: "Exercise", ru: "Упражнение", bg: "Упражнение" })}</span>
                                  <input
                                    value={row.block}
                                    onChange={(event) => updatePreparationRow(rowIndex, { block: event.target.value })}
                                  />
                                </label>
                                <label className="field">
                                  <span>{copyFor(language, { en: "Volume", ru: "Объём", bg: "Обем" })}</span>
                                  <input
                                    value={row.volume}
                                    onChange={(event) => updatePreparationRow(rowIndex, { volume: event.target.value })}
                                  />
                                </label>
                                <label className="field preparation-session-control-field">
                                  <span>{copyFor(language, { en: "Control", ru: "Контроль", bg: "Контрол" })}</span>
                                  <input
                                    value={row.control}
                                    onChange={(event) => updatePreparationRow(rowIndex, { control: event.target.value })}
                                  />
                                </label>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </>
                  ) : null}
                </section>

                <details className="preparation-plan-preview-panel" open>
                  <summary>
                    <span>
                      {copyFor(language, {
                        en: "Preparation document",
                        ru: "Документ подготовки",
                        bg: "Документ за подготовка",
                      })}
                    </span>
                    <strong>{preparationPlanDraft.weeks.length}</strong>
                  </summary>
                <section className="preparation-plan-document">
              <header className="preparation-plan-hero">
                <div>
                  <h3>{preparationPlanDraft.title}</h3>
                  <p>{preparationPlanDraft.subtitle}</p>
                  <div className="preparation-plan-phase-line">
                    {preparationPlanDraft.phases.map((phase) => (
                      <span key={phase}>{phase}</span>
                    ))}
                  </div>
                </div>
                <strong>{preparationPlanDraft.period}</strong>
              </header>

              <div className="preparation-plan-top-grid">
                {preparationPlanDraft.metrics.map((metric) => (
                  <article className={`preparation-plan-box ${metric.tone}`} key={metric.label}>
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                  </article>
                ))}
              </div>

              <article className="preparation-plan-monitor">
                <div className="preparation-plan-week-header">
                  {copyFor(language, {
                    en: "Daily monitoring",
                    ru: "Ежедневный мониторинг состояния",
                    bg: "Ежедневен мониторинг на състоянието",
                  })}
                </div>
                <div className="preparation-plan-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>{copyFor(language, { en: "Date", ru: "Дата", bg: "Дата" })}</th>
                        <th>{copyFor(language, { en: "Weight", ru: "Вес", bg: "Тегло" })}</th>
                        <th>{copyFor(language, { en: "Pulse", ru: "Пульс", bg: "Пулс" })}</th>
                        <th>{copyFor(language, { en: "Sleep", ru: "Сон", bg: "Сън" })}</th>
                        <th>{copyFor(language, { en: "Readiness", ru: "Готовность", bg: "Готовност" })}</th>
                        <th>{copyFor(language, { en: "Action", ru: "Что делать", bg: "Действие" })}</th>
                        <th>{copyFor(language, { en: "Remove", ru: "Что убрать", bg: "Какво да се махне" })}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preparationPlanDraft.monitoringDates.map((date) => (
                        <tr key={date}>
                          <td>{date}</td>
                          <td className="preparation-plan-muted-cell">кг</td>
                          <td className="preparation-plan-muted-cell">уд/мин</td>
                          <td className="preparation-plan-muted-cell">часы</td>
                          <td><span className="preparation-plan-status neutral">-</span></td>
                      <td className="preparation-plan-muted-cell">
                        {copyFor(language, { en: "by readiness", ru: "по готовности", bg: "по готовност" })}
                      </td>
                          <td className="preparation-plan-muted-cell">по adaptation</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <div className="preparation-plan-zones">
                {preparationPlanDraft.zones.map((zone) => (
                  <article className="preparation-plan-zone-card" key={zone.title}>
                    <strong>{zone.title}</strong>
                    <span>{zone.value}</span>
                    <small>{zone.note}</small>
                  </article>
                ))}
              </div>

              {preparationPlanDraft.weeks.map((week) => (
                <section className="preparation-plan-week" key={week.title}>
                  <div className="preparation-plan-week-header">{week.title}</div>
                  {week.days.map((day) => (
                    <article className="preparation-plan-day-card" key={`${week.title}-${day.title}`}>
                      <div className="preparation-plan-day-header">
                        <strong>{day.title}</strong>
                        <span>{day.type}</span>
                      </div>
                      {day.guidance ? (
                        <div className="preparation-plan-guidance">
                          <span className="green">GREEN / {day.guidance.green}</span>
                          <span className="yellow">YELLOW / {day.guidance.yellow}</span>
                          <span className="red">RED / {day.guidance.red}</span>
                        </div>
                      ) : null}
                      {day.sessions.map((session) => (
                        <section className="preparation-plan-session" key={`${day.title}-${session.title}`}>
                          <h4>{session.title}</h4>
                          <div className="preparation-plan-table-scroll">
                            <table>
                              <thead>
                                <tr>
                                  {session.columns.map((column) => (
                                    <th key={column}>{column}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {session.rows.map((row) => (
                                  <tr key={`${session.title}-${row.block}-${row.volume}`}>
                                    <td>{row.block}</td>
                                    <td>{row.volume}</td>
                                    <td>{row.control}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {session.notes?.map((note) => (
                            <p className={`preparation-plan-note ${note.tone}`} key={note.text}>
                              {note.text}
                            </p>
                          ))}
                        </section>
                      ))}
                    </article>
                  ))}
                </section>
              ))}

              <section className="preparation-plan-week">
                <div className="preparation-plan-week-header">
                  {copyFor(language, {
                    en: "Nutrition and weight cut protocol",
                    ru: "Питание и сгонка / короткий протокол",
                    bg: "Хранене и сваляне на тегло / кратък протокол",
                  })}
                </div>
                <article className="preparation-plan-day-card">
                  <div className="preparation-plan-table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>{copyFor(language, { en: "Phase", ru: "Фаза", bg: "Фаза" })}</th>
                          <th>{copyFor(language, { en: "Nutrition", ru: "Питание", bg: "Хранене" })}</th>
                          <th>{copyFor(language, { en: "Goal", ru: "Задача", bg: "Цел" })}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preparationPlanDraft.nutrition.map((item) => (
                          <tr key={item.phase}>
                            <td>{item.phase}</td>
                            <td>{item.nutrition}</td>
                            <td>{item.goal}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              </section>

              <footer className="preparation-plan-summary">
                <h3>
                  {copyFor(language, {
                    en: "Final structure",
                    ru: "Итоговая структура",
                    bg: "Финална структура",
                  })}
                </h3>
                <div>
                  {preparationPlanDraft.summary.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </footer>
                </section>
                </details>
              </div>
            </section>
            ) : null}

            {planningView === "calendar" ? (
            <form
              className="auth-form planning-main-form planning-calendar-primary-form"
              onSubmit={handleCompetitionSubmit}
            >
              <div className="summary-topline">
                <div>
                  <span className="eyebrow eyebrow-muted">
                    {copyFor(language, {
                      en: "Step 1",
                      ru: "Шаг 1",
                      bg: "Стъпка 1",
                    })}
                  </span>
                  <h3>
                    {copyFor(language, {
                      en: "Add competition",
                      ru: "Добавить соревнование",
                      bg: "Добави състезание",
                    })}
                  </h3>
                </div>
                <span>
                  {copyFor(language, {
                    en: "Calendar input",
                    ru: "Ввод в календарь",
                    bg: "Въвеждане в календар",
                  })}
                </span>
              </div>
              <div className="uww-sync-panel">
                <header className="uww-sync-head">
                  <div className="uww-sync-title">
                    <strong>UWW</strong>
                    <a href="https://uww.org/events" rel="noreferrer" target="_blank">
                      uww.org/events
                    </a>
                  </div>
                  <div className="uww-sync-actions">
                    <button
                      className="secondary-button"
                      disabled={busy}
                      onClick={handleUwwEventSync}
                      type="button"
                    >
                      {busy
                        ? ui("syncingNow")
                        : copyFor(language, {
                            en: "Sync UWW",
                            ru: "Обновить из UWW",
                            bg: "Обнови от UWW",
                          })}
                    </button>
                    <button
                      className="tertiary-button"
                      disabled={busy}
                      onClick={() => setUwwSyncFilters(initialUwwSyncFilters)}
                      type="button"
                    >
                      {copyFor(language, {
                        en: "Reset",
                        ru: "Сбросить",
                        bg: "Изчисти",
                      })}
                    </button>
                  </div>
                </header>
                <div className="uww-sync-fields">
                  <label className="field">
                    <span>
                      {copyFor(language, { en: "Year", ru: "Год", bg: "Година" })}
                    </span>
                    <select
                      value={uwwSyncFilters.year}
                      onChange={(event) =>
                        setUwwSyncFilters((current) => ({
                          ...current,
                          year: event.target.value,
                        }))
                      }
                    >
                      <option value="">
                        {copyFor(language, { en: "All", ru: "Все", bg: "Всички" })}
                      </option>
                      {uwwYearOptions.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>
                      {copyFor(language, {
                        en: "Age",
                        ru: "Возраст",
                        bg: "Възраст",
                      })}
                    </span>
                    <select
                      value={uwwSyncFilters.ageGroup}
                      onChange={(event) =>
                        setUwwSyncFilters((current) => ({
                          ...current,
                          ageGroup: event.target.value,
                        }))
                      }
                    >
                      <option value="">
                        {copyFor(language, { en: "All", ru: "Все", bg: "Всички" })}
                      </option>
                      {uwwAgeGroupOptions.map((ageGroup) => (
                        <option key={ageGroup} value={ageGroup}>
                          {ageGroup}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>
                      {copyFor(language, {
                        en: "Style",
                        ru: "Стиль",
                        bg: "Стил",
                      })}
                    </span>
                    <select
                      value={uwwSyncFilters.style}
                      onChange={(event) =>
                        setUwwSyncFilters((current) => ({
                          ...current,
                          style: event.target.value,
                        }))
                      }
                    >
                      <option value="">
                        {copyFor(language, { en: "All", ru: "Все", bg: "Всички" })}
                      </option>
                      {uwwStyleOptions.map((style) => (
                        <option key={style} value={style}>
                          {style}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>
                      {copyFor(language, {
                        en: "Type",
                        ru: "Тип",
                        bg: "Тип",
                      })}
                    </span>
                    <select
                      value={uwwSyncFilters.eventType}
                      onChange={(event) =>
                        setUwwSyncFilters((current) => ({
                          ...current,
                          eventType: event.target.value,
                        }))
                      }
                    >
                      <option value="">
                        {copyFor(language, { en: "All", ru: "Все", bg: "Всички" })}
                      </option>
                      {uwwEventTypeOptions.map((eventType) => (
                        <option key={eventType} value={eventType}>
                          {eventType}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>
                      {copyFor(language, {
                        en: "Country",
                        ru: "Страна",
                        bg: "Държава",
                      })}
                    </span>
                    <select
                      value={uwwSyncFilters.country}
                      onChange={(event) =>
                        setUwwSyncFilters((current) => ({
                          ...current,
                          country: event.target.value,
                        }))
                      }
                    >
                      <option value="">
                        {copyFor(language, { en: "All", ru: "Все", bg: "Всички" })}
                      </option>
                      {uwwCountryOptions.map((country) => (
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {uwwSyncSummary ? (
                  <div className="uww-sync-result">
                    <span>
                      {copyFor(language, {
                        en: "Found",
                        ru: "Найдено",
                        bg: "Намерени",
                      })}
                      : {uwwSyncSummary.totalFound}
                    </span>
                    <span>
                      {copyFor(language, {
                        en: "Added",
                        ru: "Добавлено",
                        bg: "Добавени",
                      })}
                      : {uwwSyncSummary.addedCount}
                    </span>
                    <span>
                      {copyFor(language, {
                        en: "Updated",
                        ru: "Обновлено",
                        bg: "Обновени",
                      })}
                      : {uwwSyncSummary.updatedCount}
                    </span>
                  </div>
                ) : null}
              </div>
              <label className="field">
                <span>
                  {copyFor(language, {
                    en: "Competition name",
                    ru: "Название соревнования",
                    bg: "Име на състезанието",
                  })}
                </span>
                <input
                  value={competitionForm.title}
                  onChange={(event) =>
                    setCompetitionForm((current) => ({ ...current, title: event.target.value }))
                  }
                  required
                />
              </label>
              <label className="field">
                <span>
                  {copyFor(language, {
                    en: "Location",
                    ru: "Место проведения",
                    bg: "Място",
                  })}
                </span>
                <input
                  value={competitionForm.location}
                  onChange={(event) =>
                    setCompetitionForm((current) => ({ ...current, location: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>
                  {copyFor(language, {
                    en: "Federation",
                    ru: "Федерация",
                    bg: "Федерация",
                  })}
                </span>
                <input
                  value={competitionForm.federation}
                  onChange={(event) =>
                    setCompetitionForm((current) => ({
                      ...current,
                      federation: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>
                  {copyFor(language, {
                    en: "Start date",
                    ru: "Дата начала",
                    bg: "Начална дата",
                  })}
                </span>
                <input
                  type="date"
                  value={competitionForm.startDate}
                  onChange={(event) =>
                    setCompetitionForm((current) => ({
                      ...current,
                      startDate: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="field">
                <span>
                  {copyFor(language, {
                    en: "End date",
                    ru: "Дата окончания",
                    bg: "Крайна дата",
                  })}
                </span>
                <input
                  type="date"
                  value={competitionForm.endDate}
                  onChange={(event) =>
                    setCompetitionForm((current) => ({ ...current, endDate: event.target.value }))
                  }
                  required
                />
              </label>
              <label className="field">
                <span>
                  {copyFor(language, {
                    en: "Level",
                    ru: "Уровень",
                    bg: "Ниво",
                  })}
                </span>
                <select
                  value={competitionForm.level}
                  onChange={(event) =>
                    setCompetitionForm((current) => ({
                      ...current,
                      level: event.target.value as CompetitionSummary["level"],
                    }))
                  }
                >
                  {["local", "national", "continental", "world", "olympics"].map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>
                  {copyFor(language, {
                    en: "Age group",
                    ru: "Возрастная группа",
                    bg: "Възрастова група",
                  })}
                </span>
                <input
                  value={competitionForm.ageGroup}
                  onChange={(event) =>
                    setCompetitionForm((current) => ({
                      ...current,
                      ageGroup: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>
                  {copyFor(language, {
                    en: "Description",
                    ru: "Описание",
                    bg: "Описание",
                  })}
                </span>
                <input
                  value={competitionForm.description}
                  onChange={(event) =>
                    setCompetitionForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </label>
              <button className="primary-button" disabled={busy} type="submit">
                {busy
                  ? ui("syncingNow")
                  : copyFor(language, {
                      en: "Create competition",
                      ru: "Создать соревнование",
                      bg: "Създай състезание",
                    })}
              </button>
            </form>
            ) : null}

            {planningView === "calendar" ? (
            <div className="entry-summary planning-side-card planning-calendar-list">
              <div className="summary-topline">
                <strong>
                  {copyFor(language, {
                    en: "Competition calendar",
                    ru: "Календарь соревнований",
                    bg: "Календар на състезанията",
                  })}
                </strong>
                <span>{competitions.length}</span>
              </div>
              {competitions.length > 0 ? (
                <div className="planning-calendar-select-bar">
                  <label className="planning-calendar-select-all">
                    <input
                      checked={allCalendarCompetitionsSelected}
                      onChange={(event) =>
                        setSelectedCompetitionIds(
                          event.target.checked
                            ? competitions.map((competition) => competition.id)
                            : [],
                        )
                      }
                      type="checkbox"
                    />
                    <span>
                      {copyFor(language, {
                        en: "Select all",
                        ru: "Выбрать все",
                        bg: "Избери всички",
                      })}
                    </span>
                  </label>
                  <button
                    className="tertiary-button planning-calendar-delete-selected"
                    disabled={busy || selectedCalendarCompetitionCount === 0}
                    onClick={handleDeleteSelectedCompetitions}
                    type="button"
                  >
                    {copyFor(language, {
                      en: `Delete selected (${selectedCalendarCompetitionCount})`,
                      ru: `Удалить выбранные (${selectedCalendarCompetitionCount})`,
                      bg: `Изтрий избраните (${selectedCalendarCompetitionCount})`,
                    })}
                  </button>
                </div>
              ) : null}
              {competitions.length === 0 ? (
                <p className="placeholder-copy">
                  {copyFor(language, {
                    en: "No competitions created yet. Fill the form on the left.",
                    ru: "Соревнований пока нет. Заполните форму слева.",
                    bg: "Все още няма състезания. Попълнете формата вляво.",
                  })}
                </p>
              ) : (
                <ul>
                  {competitions.map((competition) => (
                    <li className="planning-calendar-item" key={competition.id}>
                      <div className="planning-calendar-item-main">
                        <label className="planning-calendar-check">
                          <input
                            checked={selectedCompetitionIds.includes(competition.id)}
                            onChange={(event) =>
                              setSelectedCompetitionIds((current) =>
                                event.target.checked
                                  ? [...current, competition.id]
                                  : current.filter((id) => id !== competition.id),
                              )
                            }
                            type="checkbox"
                          />
                        </label>
                        <div>
                          <strong>{competition.title}</strong>
                          <span>
                            {competition.federation || competition.level} /{" "}
                            {competition.level} / {competition.startDate}
                            {competition.endDate !== competition.startDate
                              ? ` - ${competition.endDate}`
                              : ""}{" "}
                            / {competition.location || "n/a"}
                            {competition.ageGroup ? ` / ${competition.ageGroup}` : ""}
                          </span>
                        </div>
                      </div>
                      <div className="planning-calendar-actions">
                        <button
                          className="secondary-button planning-calendar-attach-button"
                          onClick={() => handlePrepareCompetitionPlan(competition)}
                          type="button"
                        >
                          {copyFor(language, {
                            en: "Add to season",
                            ru: "В сезон",
                            bg: "Към сезона",
                          })}
                        </button>
                        <button
                          className="tertiary-button planning-calendar-delete-button"
                          disabled={busy}
                          onClick={() => handleDeleteCompetition(competition)}
                          type="button"
                        >
                          {copyFor(language, {
                            en: "Delete",
                            ru: "Удалить",
                            bg: "Изтрий",
                          })}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            ) : null}

            {planningView === "season" && seasonEditorMode === "cycles" ? (
            <form
              className="auth-form planning-main-form planning-season-cycle-form"
              onSubmit={handleOlympicCycleSubmit}
            >
              <div className="summary-topline">
                <div>
                  <h3>
                    {copyFor(language, {
                      en: "Long-term cycles",
                      ru: "Долгосрочные циклы",
                      bg: "Дългосрочни цикли",
                    })}
                  </h3>
                </div>
                <span>{olympicCycles.length}</span>
              </div>
              <label className="field">
                <span>
                  {copyFor(language, {
                    en: "Cycle name",
                    ru: "Название цикла",
                    bg: "Име на цикъла",
                  })}
                </span>
                <input
                  value={olympicCycleForm.name}
                  onChange={(event) =>
                    setOlympicCycleForm((current) => ({ ...current, name: event.target.value }))
                  }
                  required
                />
              </label>
              <label className="field">
                <span>
                  {copyFor(language, {
                    en: "Start date",
                    ru: "Дата начала",
                    bg: "Начална дата",
                  })}
                </span>
                <input
                  type="date"
                  value={olympicCycleForm.startDate}
                  onChange={(event) =>
                    setOlympicCycleForm((current) => ({
                      ...current,
                      startDate: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="field">
                <span>
                  {copyFor(language, {
                    en: "End date",
                    ru: "Дата окончания",
                    bg: "Крайна дата",
                  })}
                </span>
                <input
                  type="date"
                  value={olympicCycleForm.endDate}
                  onChange={(event) =>
                    setOlympicCycleForm((current) => ({ ...current, endDate: event.target.value }))
                  }
                  required
                />
              </label>
              <label className="field">
                <span>
                  {copyFor(language, {
                    en: "Main start",
                    ru: "Главный старт",
                    bg: "Основен старт",
                  })}
                </span>
                <input
                  value={olympicCycleForm.targetEvent}
                  onChange={(event) =>
                    setOlympicCycleForm((current) => ({
                      ...current,
                      targetEvent: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field planning-season-cycle-description">
                <span>
                  {copyFor(language, {
                    en: "Note",
                    ru: "Заметка",
                    bg: "Бележка",
                  })}
                </span>
                <input
                  value={olympicCycleForm.description}
                  onChange={(event) =>
                    setOlympicCycleForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </label>
              <button className="secondary-button" disabled={busy} type="submit">
                {copyFor(language, {
                  en: "Save cycle",
                  ru: "Сохранить цикл",
                  bg: "Запази цикъл",
                })}
              </button>
              <div className="planning-season-cycle-list">
                <div className="summary-topline">
                  <strong>
                    {copyFor(language, {
                      en: "Saved cycles",
                      ru: "Сохранённые циклы",
                      bg: "Запазени цикли",
                    })}
                  </strong>
                  <span>{olympicCycles.length}</span>
                </div>
                {olympicCycles.length === 0 ? (
                  <p className="placeholder-copy">
                    {copyFor(language, {
                      en: "No cycles yet.",
                      ru: "Циклов пока нет.",
                      bg: "Все още няма цикли.",
                    })}
                  </p>
                ) : (
                  <ul className="planning-season-card-list">
                    {olympicCycles.map((cycle) => (
                      <li className="planning-season-mini-card" key={cycle.id}>
                        <strong>{cycle.name}</strong>
                        <span>
                          {cycle.startDate} - {cycle.endDate}
                          {cycle.targetEvent ? ` / ${cycle.targetEvent}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </form>
            ) : null}

            {planningView === "season" ? (
            <div className="entry-summary wide-card planning-season-modebar">
              <div>
                <strong>
                  {selectedCoachAthlete?.fullName ?? ui("selectAthlete")}
                </strong>
                <span>
                  {copyFor(language, {
                    en: `Year ${seasonDisplayYear} / ${visibleSeasonStarts.length} starts`,
                    ru: `${seasonDisplayYear} год / стартов: ${visibleSeasonStarts.length}`,
                    bg: `${seasonDisplayYear} година / стартове: ${visibleSeasonStarts.length}`,
                  })}
                </span>
              </div>
              <div className="planning-season-view-toggle" role="group">
                {(["timeline", "hybrid"] as const).map((mode) => (
                  <button
                    className={
                      seasonDisplayMode === mode ? "tab-active" : "tab-button"
                    }
                    key={mode}
                    onClick={() => setSeasonDisplayMode(mode)}
                    type="button"
                  >
                    {mode === "timeline"
                      ? copyFor(language, {
                          en: "Season timeline",
                          ru: "Лента сезона",
                          bg: "Лента на сезона",
                        })
                      : copyFor(language, {
                          en: "Hybrid",
                          ru: "Гибрид",
                          bg: "Хибрид",
                        })}
                  </button>
                ))}
              </div>
            </div>
            ) : null}

            {planningView === "season" ? (
            <form
              className="auth-form planning-side-form planning-season-form"
              onSubmit={handleSeasonSubmit}
            >
              <h3>
                {copyFor(language, {
                  en: "Season",
                  ru: "Сезон",
                  bg: "Сезон",
                })}
              </h3>
              <label className="field">
                <span>
                  {copyFor(language, { en: "Year", ru: "Год", bg: "Година" })}
                </span>
                <input
                  type="number"
                  value={seasonForm.year}
                  onChange={(event) =>
                    setSeasonForm((current) => ({
                      ...current,
                      year: Number(event.target.value),
                    }))
                  }
                  required
                />
              </label>
              <label className="field">
                <span>
                  {copyFor(language, {
                    en: "Name",
                    ru: "Название",
                    bg: "Име",
                  })}
                </span>
                <input
                  value={seasonForm.name}
                  onChange={(event) =>
                    setSeasonForm((current) => ({ ...current, name: event.target.value }))
                  }
                  required
                />
              </label>
              <label className="field">
                <span>
                  {copyFor(language, {
                    en: "Strategy",
                    ru: "Стратегия",
                    bg: "Стратегия",
                  })}
                </span>
                <select
                  value={seasonForm.strategyType}
                  onChange={(event) =>
                    setSeasonForm((current) => ({
                      ...current,
                      strategyType: event.target.value as SeasonSummary["strategyType"],
                    }))
                  }
                >
                  {["single_peak", "double_peak", "multi_peak"].map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>
                  {copyFor(language, {
                    en: "Cycle",
                    ru: "Цикл",
                    bg: "Цикъл",
                  })}
                </span>
                <select
                  value={seasonForm.olympicCycleId ?? ""}
                  onChange={(event) =>
                    setSeasonForm((current) => ({
                      ...current,
                      olympicCycleId: event.target.value || null,
                    }))
                  }
                >
                  <option value="">
                    {copyFor(language, {
                      en: "No cycle",
                      ru: "Без цикла",
                      bg: "Без цикъл",
                    })}
                  </option>
                  {olympicCycles.map((cycle) => (
                    <option key={cycle.id} value={cycle.id}>
                      {cycle.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="secondary-button"
                disabled={busy || !seasonForm.athleteId}
                type="submit"
              >
                {copyFor(language, {
                  en: "Save season",
                  ru: "Сохранить сезон",
                  bg: "Запази сезон",
                })}
              </button>
              <div className="planning-season-inline-list">
                <div className="summary-topline">
                  <strong>
                    {copyFor(language, {
                      en: "Seasons",
                      ru: "Сезоны",
                      bg: "Сезони",
                    })}
                  </strong>
                  <span>{visibleSeasons.length}</span>
                </div>
                {visibleSeasons.length === 0 ? (
                  <p className="placeholder-copy">
                    {copyFor(language, {
                      en: "No seasons yet.",
                      ru: "Сезонов пока нет.",
                      bg: "Все още няма сезони.",
                    })}
                  </p>
                ) : (
                  <ul className="planning-season-card-list">
                    {visibleSeasons.map((season) => (
                      <li className="planning-season-mini-card" key={season.id}>
                        <strong>
                          {season.year} / {season.name}
                        </strong>
                        <span>{season.strategyType}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </form>
            ) : null}

            {planningView === "season" && seasonDisplayMode === "timeline" ? (
            <div className="entry-summary wide-card planning-season-timeline-card">
              <div className="summary-topline">
                <strong>
                  {copyFor(language, {
                    en: "Season timeline",
                    ru: "Лента сезона",
                    bg: "Лента на сезона",
                  })}
                </strong>
                <span>{seasonDisplayYear}</span>
              </div>
              <div className="planning-season-phase-row">
                {["base", "specific", "taper", "competition", "recovery"].map((phase) => (
                  <span className={`planning-season-phase planning-season-phase-${phase}`} key={phase}>
                    {copyFor(language, SEASON_PHASE_LABELS[phase])}
                  </span>
                ))}
              </div>
              <div className="planning-season-timeline-months">
                {seasonMonthLabels.map((month) => (
                  <span key={month}>{month}</span>
                ))}
              </div>
              <div className="planning-season-timeline-track">
                {visibleSeasonStarts.map((plan) => (
                  <button
                    className={`planning-season-timeline-marker priority-${plan.priority.toLowerCase()} ${
                      selectedSeasonStart?.id === plan.id ? "is-active" : ""
                    }`}
                    key={plan.id}
                    onClick={() => handleSelectSeasonStart(plan)}
                    style={{ left: `${getSeasonTimelinePosition(plan.competitionStartDate)}%` }}
                    type="button"
                  >
                    <span>{plan.priority}</span>
                    <strong>{plan.competitionTitle}</strong>
                    <small>{plan.competitionStartDate.slice(5)}</small>
                  </button>
                ))}
              </div>
            </div>
            ) : null}

            {planningView === "season" && seasonDisplayMode === "hybrid" ? (
            <div className="entry-summary planning-main-form planning-season-calendar-card">
              <div className="summary-topline">
                <strong>
                  {copyFor(language, {
                    en: "Year calendar",
                    ru: "Календарь года",
                    bg: "Годишен календар",
                  })}
                </strong>
                <span>{seasonDisplayYear}</span>
              </div>
              <div className="planning-season-year-grid">
                {seasonMonthLabels.map((month, monthIndex) => {
                  const monthStarts = visibleSeasonStarts.filter(
                    (plan) => getDateMonthIndex(plan.competitionStartDate) === monthIndex,
                  );

                  return (
                    <div className="planning-season-month-card" key={month}>
                      <div className="planning-season-month-head">
                        <strong>{month}</strong>
                        <span>{monthStarts.length}</span>
                      </div>
                      <div className="planning-season-month-events">
                        {monthStarts.length === 0 ? (
                          <span className="planning-season-empty-dot" />
                        ) : (
                          monthStarts.map((plan) => (
                            <button
                              className={`planning-season-month-event priority-${plan.priority.toLowerCase()} ${
                                selectedSeasonStart?.id === plan.id ? "is-active" : ""
                              }`}
                              key={plan.id}
                              onClick={() => handleSelectSeasonStart(plan)}
                              type="button"
                            >
                              <span>{plan.competitionStartDate.slice(8, 10)}</span>
                              <strong>{plan.competitionTitle}</strong>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            ) : null}

            {planningView === "season" ? (
            <div
              aria-label={copyFor(language, {
                en: "Season sections",
                ru: "Разделы сезона",
                bg: "Раздели на сезона",
              })}
              className="planning-season-work-tabs"
              role="group"
            >
              {(["starts", "plan", "result", "cycles"] as const).map((mode) => {
                const label =
                  mode === "starts"
                    ? copyFor(language, {
                        en: "Starts",
                        ru: "Старты",
                        bg: "Стартове",
                      })
                    : mode === "plan"
                      ? copyFor(language, {
                          en: "Start plan",
                          ru: "План старта",
                          bg: "План старт",
                        })
                      : mode === "result"
                        ? copyFor(language, {
                          en: "Result",
                          ru: "Результат",
                          bg: "Резултат",
                        })
                        : copyFor(language, {
                            en: "Cycles",
                            ru: "Циклы",
                            bg: "Цикли",
                          });

                return (
                  <button
                    aria-pressed={seasonEditorMode === mode}
                    className={seasonEditorMode === mode ? "tab-active" : "tab-button"}
                    key={mode}
                    onClick={() => setSeasonEditorMode(mode)}
                    type="button"
                  >
                    <span>{label}</span>
                    {mode === "starts" ? <small>{visibleSeasonStarts.length}</small> : null}
                    {mode === "cycles" ? <small>{olympicCycles.length}</small> : null}
                  </button>
                );
              })}
            </div>
            ) : null}

            {planningView === "season" && seasonEditorMode === "plan" ? (
            <form
              className="auth-form planning-main-form planning-season-start-form"
              onSubmit={handleCompetitionPlanSubmit}
            >
              <h3>
                {copyFor(language, {
                  en: "Add start",
                  ru: "Добавить старт",
                  bg: "Добави старт",
                })}
              </h3>
              <label className="field">
                <span>
                  {copyFor(language, {
                    en: "Competition",
                    ru: "Соревнование",
                    bg: "Състезание",
                  })}
                </span>
                <select
                  value={competitionPlanForm.competitionId}
                  onChange={(event) =>
                    setCompetitionPlanForm((current) => ({
                      ...current,
                      competitionId: event.target.value,
                    }))
                  }
                  required
                >
                  <option value="">
                    {copyFor(language, {
                      en: "Select competition",
                      ru: "Выберите соревнование",
                      bg: "Изберете състезание",
                    })}
                  </option>
                  {competitions.map((competition) => (
                    <option key={competition.id} value={competition.id}>
                      {competition.title} ({competition.startDate})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>
                  {copyFor(language, {
                    en: "Priority",
                    ru: "Приоритет",
                    bg: "Приоритет",
                  })}
                </span>
                <select
                  value={competitionPlanForm.priority}
                  onChange={(event) =>
                    setCompetitionPlanForm((current) => ({
                      ...current,
                      priority: event.target.value as CompetitionPlanSummary["priority"],
                    }))
                  }
                >
                  {["A", "B", "C"].map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>
                  {copyFor(language, {
                    en: "Plan type",
                    ru: "Тип плана",
                    bg: "Тип план",
                  })}
                </span>
                <select
                  value={competitionPlanForm.planType}
                  onChange={(event) =>
                    setCompetitionPlanForm((current) => ({
                      ...current,
                      planType: event.target.value as CompetitionPlanSummary["planType"],
                    }))
                  }
                >
                  {["main", "secondary", "qualifying", "control"].map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>
                  {copyFor(language, {
                    en: "Preparation start",
                    ru: "Начало подготовки",
                    bg: "Начало на подготовката",
                  })}
                </span>
                <input
                  type="date"
                  value={competitionPlanForm.prepStartDate}
                  onChange={(event) =>
                    setCompetitionPlanForm((current) => ({
                      ...current,
                      prepStartDate: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="field">
                <span>
                  {copyFor(language, {
                    en: "Preparation end",
                    ru: "Конец подготовки",
                    bg: "Край на подготовката",
                  })}
                </span>
                <input
                  type="date"
                  value={competitionPlanForm.prepEndDate}
                  onChange={(event) =>
                    setCompetitionPlanForm((current) => ({
                      ...current,
                      prepEndDate: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="field">
                <span>
                  {copyFor(language, {
                    en: "Taper days",
                    ru: "Дней подводки",
        bg: "Дни за тейпър",
                  })}
                </span>
                <input
                  type="number"
                  value={competitionPlanForm.taperDays}
                  onChange={(event) =>
                    setCompetitionPlanForm((current) => ({
                      ...current,
                      taperDays: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <details className="planning-season-advanced-fields">
                <summary>
                  {copyFor(language, {
                    en: "Advanced",
                    ru: "Дополнительно",
                    bg: "Допълнително",
                  })}
                </summary>
                <div className="planning-season-advanced-grid">
                <label className="field">
                  <span>
                    {copyFor(language, {
                      en: "Season",
                      ru: "Сезон",
                      bg: "Сезон",
                    })}
                  </span>
                  <select
                    value={competitionPlanForm.seasonId ?? ""}
                    onChange={(event) =>
                      setCompetitionPlanForm((current) => ({
                        ...current,
                        seasonId: event.target.value || null,
                      }))
                    }
                  >
                    <option value="">
                      {copyFor(language, {
                        en: "No season link",
                        ru: "Без сезона",
                        bg: "Без връзка със сезон",
                      })}
                    </option>
                    {visibleSeasons
                      .filter(
                        (season) =>
                          !competitionPlanForm.athleteId ||
                          season.athleteId === competitionPlanForm.athleteId,
                      )
                      .map((season) => (
                        <option key={season.id} value={season.id}>
                          {season.year} / {season.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="field">
                  <span>
                    {copyFor(language, {
                      en: "Target weight",
                      ru: "Целевой вес",
                      bg: "Целево тегло",
                    })}
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    value={competitionPlanForm.targetWeight ?? ""}
                    onChange={(event) =>
                      setCompetitionPlanForm((current) => ({
                        ...current,
                        targetWeight:
                          event.target.value === "" ? null : Number(event.target.value),
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span>
                    {copyFor(language, {
                      en: "Expected matches",
                      ru: "Ожидаемые схватки",
                      bg: "Очаквани срещи",
                    })}
                  </span>
                  <input
                    type="number"
                    value={competitionPlanForm.expectedMatches ?? ""}
                    onChange={(event) =>
                      setCompetitionPlanForm((current) => ({
                        ...current,
                        expectedMatches:
                          event.target.value === "" ? null : Number(event.target.value),
                      }))
                    }
                  />
                </label>
                </div>
              </details>
              <button
                className="primary-button planning-season-submit"
                disabled={busy || !competitionPlanForm.athleteId}
                type="submit"
              >
                {busy
                  ? ui("syncingNow")
                  : copyFor(language, {
                      en: "Save season start",
                      ru: "Сохранить старт",
                      bg: "Запази старт",
                    })}
              </button>
            </form>
            ) : null}

            {planningView === "season" && seasonEditorMode === "starts" ? (
            <div className="entry-summary planning-inspector-card planning-season-start-list">
              <div className="summary-topline">
                <strong>
                  {copyFor(language, {
                    en: "Starts",
                    ru: "Старты",
                    bg: "Стартове",
                  })}
                </strong>
                <span>{visibleSeasonStarts.length}</span>
              </div>
              {selectedSeasonStart ? (
                <div className="planning-season-selected-start">
                  <strong>{selectedSeasonStart.competitionTitle}</strong>
                  <span>
                    {selectedSeasonStart.competitionStartDate}
                    {selectedSeasonCompetition?.location
                      ? ` / ${selectedSeasonCompetition.location}`
                      : ""}
                  </span>
                  <div>
                    <span>{selectedSeasonStart.priority}</span>
                    <span>{selectedSeasonStart.planType}</span>
                    <span>
                {copyFor(language, { en: "Taper", ru: "Подводка", bg: "Тейпър" })}:{" "}
                      {selectedSeasonStart.taperDays}
                    </span>
                  </div>
                  <div className="planning-season-start-actions">
                    <button className="tertiary-button" onClick={handleNewSeasonStart} type="button">
                      {copyFor(language, {
                        en: "New",
                        ru: "Новый",
                        bg: "Нов",
                      })}
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => handleSelectSeasonStart(selectedSeasonStart)}
                      type="button"
                    >
                      {copyFor(language, {
                        en: "Result",
                        ru: "Результат",
                        bg: "Резултат",
                      })}
                    </button>
                    <button
                      className="tertiary-button planning-season-start-delete"
                      disabled={busy}
                      onClick={() => handleDeleteSeasonStart(selectedSeasonStart)}
                      type="button"
                    >
                      {copyFor(language, {
                        en: "Delete",
                        ru: "Удалить",
                        bg: "Изтрий",
                      })}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="placeholder-copy">
                  {copyFor(language, {
                    en: "No starts in this year.",
                    ru: "В этом году стартов пока нет.",
                    bg: "Все още няма стартове за тази година.",
                  })}
                </p>
              )}
              {visibleSeasonStarts.length > 0 ? (
                <details className="planning-season-starts-details">
                  <summary>
                    {copyFor(language, {
                      en: "All starts",
                      ru: "Все старты",
                      bg: "Всички стартове",
                    })}
                  </summary>
                  <ul className="planning-season-card-list">
                    {visibleSeasonStarts.map((plan) => (
                      <li key={plan.id}>
                        <button
                          className={`planning-season-start-card ${
                            selectedSeasonStart?.id === plan.id ? "is-active" : ""
                          }`}
                          onClick={() => handleSelectSeasonStart(plan, "starts")}
                          type="button"
                        >
                          <strong>{plan.competitionTitle}</strong>
                          <span>
                            {plan.priority} / {plan.planType}
                          </span>
                          <small>
                            {plan.prepStartDate} - {plan.prepEndDate}
                          </small>
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
            ) : null}

            {planningView === "mesocycle" ? (
            <form
              className="auth-form wide-form planning-main-form planning-mesocycle-form"
              onSubmit={handleMesocycleSubmit}
            >
              <div className="summary-topline planning-mesocycle-form-head">
                <h3>
                  {copyFor(language, {
                    en: "Mesocycle plan",
                    ru: "План мезоцикла",
                    bg: "План на мезоцикъл",
                  })}
                </h3>
                <span>{selectedCoachAthlete?.fullName ?? activeAthleteLabel}</span>
              </div>
              <label className="field planning-mesocycle-name-field">
                <span>
                  {copyFor(language, {
                    en: "Name",
                    ru: "Название",
                    bg: "Име",
                  })}
                </span>
                <input
                  value={mesocycleForm.name}
                  onChange={(event) =>
                    setMesocycleForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder={copyFor(language, {
                    en: "Specific preparation block",
                    ru: "Блок специальной подготовки",
                    bg: "Блок за специална подготовка",
                  })}
                  required
                />
              </label>
              <label className="field planning-mesocycle-season-field">
                <span>
                  {copyFor(language, {
                    en: "Season",
                    ru: "Сезон",
                    bg: "Сезон",
                  })}
                </span>
                <select
                  value={mesocycleForm.seasonId ?? ""}
                  onChange={(event) =>
                    setMesocycleForm((current) => ({
                      ...current,
                      seasonId: event.target.value || null,
                    }))
                  }
                >
                  <option value="">
                    {copyFor(language, {
                      en: "Unlinked",
                      ru: "Без сезона",
                      bg: "Без сезон",
                    })}
                  </option>
                  {seasons
                    .filter((season) => season.athleteId === activeMesocycleAthleteId)
                    .map((season) => (
                      <option key={season.id} value={season.id}>
                        {season.year} / {season.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field planning-mesocycle-competition-field">
                <span>
                  {copyFor(language, {
                    en: "Competition plan",
                    ru: "План старта",
                    bg: "План за старт",
                  })}
                </span>
                <select
                  value={mesocycleForm.competitionPlanId ?? ""}
                  onChange={(event) =>
                    setMesocycleForm((current) => ({
                      ...current,
                      competitionPlanId: event.target.value || null,
                    }))
                  }
                >
                  <option value="">
                    {copyFor(language, {
                      en: "Optional link",
                      ru: "Без плана старта",
                      bg: "Без план за старт",
                    })}
                  </option>
                  {competitionPlans
                    .filter((plan) => plan.athleteId === activeMesocycleAthleteId)
                    .map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.competitionTitle} / {plan.priority} / {plan.prepStartDate}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field planning-mesocycle-phase-field">
                <span>
                  {copyFor(language, {
                    en: "Phase",
                    ru: "Фаза",
                    bg: "Фаза",
                  })}
                </span>
                <select
                  value={mesocycleForm.phase}
                  onChange={(event) =>
                    setMesocycleForm((current) => ({
                      ...current,
                      phase: event.target.value as CreateMesocyclePayload["phase"],
                    }))
                  }
                >
                  {["base", "strength", "specific", "taper", "competition", "recovery"].map(
                    (phase) => (
                      <option key={phase} value={phase}>
                        {localizedOptionLabel(phase, language, PREPARATION_PHASE_LABELS)}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label className="field planning-mesocycle-progression-field">
                <span>
                  {copyFor(language, {
                    en: "Progression",
                    ru: "Прогрессия",
                    bg: "Прогресия",
                  })}
                </span>
                <select
                  value={mesocycleForm.progressionType}
                  onChange={(event) =>
                    setMesocycleForm((current) => ({
                      ...current,
                      progressionType:
                        event.target.value as CreateMesocyclePayload["progressionType"],
                    }))
                  }
                >
                  {["linear", "wave", "taper", "recovery"].map((type) => (
                    <option key={type} value={type}>
                      {localizedOptionLabel(type, language, PROGRESSION_TYPE_LABELS)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field planning-mesocycle-weeks-field">
                <span>
                  {copyFor(language, {
                    en: "Weeks",
                    ru: "Недель",
                    bg: "Седмици",
                  })}
                </span>
                <input
                  type="number"
                  min="3"
                  max="6"
                  value={mesocycleForm.weeksCount}
                  onChange={(event) =>
                    setMesocycleForm((current) => ({
                      ...current,
                      weeksCount: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label className="field planning-mesocycle-date-field">
                <span>
                  {copyFor(language, {
                    en: "Start",
                    ru: "Начало",
                    bg: "Начало",
                  })}
                </span>
                <input
                  type="date"
                  value={mesocycleForm.startDate}
                  onChange={(event) =>
                    setMesocycleForm((current) => ({
                      ...current,
                      startDate: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="field planning-mesocycle-date-field">
                <span>
                  {copyFor(language, {
                    en: "End",
                    ru: "Конец",
                    bg: "Край",
                  })}
                </span>
                <input
                  type="date"
                  value={mesocycleForm.endDate}
                  onChange={(event) =>
                    setMesocycleForm((current) => ({
                      ...current,
                      endDate: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="field planning-mesocycle-goal-field">
                <span>
                  {copyFor(language, {
                    en: "Goal",
                    ru: "Цель",
                    bg: "Цел",
                  })}
                </span>
                <input
                  value={mesocycleForm.goal}
                  onChange={(event) =>
                    setMesocycleForm((current) => ({ ...current, goal: event.target.value }))
                  }
                  placeholder={copyFor(language, {
                    en: "Raise specific work capacity before taper",
                    ru: "Поднять специальную работоспособность перед подводкой",
                    bg: "Повишаване на специфичната работоспособност преди тейпър",
                  })}
                />
              </label>
              <label className="field planning-mesocycle-notes-field">
                <span>{t("coachNotes")}</span>
                <input
                  value={mesocycleForm.notes}
                  onChange={(event) =>
                    setMesocycleForm((current) => ({ ...current, notes: event.target.value }))
                  }
                />
              </label>
              <button
                className="primary-button planning-mesocycle-submit"
                disabled={busy || !activeMesocycleAthleteId}
                type="submit"
              >
                {busy
                  ? ui("syncingNow")
                  : copyFor(language, {
                      en: "Save mesocycle",
                      ru: "Сохранить мезоцикл",
                      bg: "Запази мезоцикъл",
                    })}
              </button>
            </form>
            ) : null}

            {planningView === "mesocycle" ? (
            <div className="entry-summary wide-card planning-review-card planning-mesocycle-board">
              <div className="summary-topline">
                <strong>
                  {copyFor(language, {
                    en: "Mesocycles",
                    ru: "Мезоциклы",
                    bg: "Мезоцикли",
                  })}
                </strong>
                <span>{visibleMesocycles.length}</span>
              </div>
              {visibleMesocycles.length === 0 ? (
                <p className="placeholder-copy">
                  {copyFor(language, {
                    en: "No mesocycle blocks yet. Create one to bridge competition planning and weekly assignment.",
                    ru: "Мезоциклов пока нет. Создайте блок, чтобы связать соревновательное планирование и недельное назначение.",
                    bg: "Все още няма мезоцикли. Създайте блок, за да свържете състезателното планиране и седмичното назначаване.",
                  })}
                </p>
              ) : (
                <ul className="mesocycle-plan-list">
                  {visibleMesocycles.map((mesocycle) => {
                    const totalTargetLoad = mesocycle.weeks.reduce(
                      (sum, week) => sum + week.targetLoad,
                      0,
                    );
                    const maxWeekLoad = Math.max(
                      1,
                      ...mesocycle.weeks.map((week) => week.targetLoad),
                    );
                    const goalText = translateKnownMesocycleText(mesocycle.goal, language);

                    return (
                      <li className="mesocycle-plan-item" key={mesocycle.id}>
                        <div className="mesocycle-plan-head">
                          <div className="mesocycle-plan-title">
                            <strong>{translateKnownMesocycleText(mesocycle.name, language)}</strong>
                            <small>
                              {mesocycle.athleteName}
                              {mesocycle.seasonName ? ` / ${mesocycle.seasonName}` : ""}
                            </small>
                          </div>
                          <div className="mesocycle-plan-tags">
                            <span className="status-chip accent">
                              {localizedOptionLabel(
                                mesocycle.phase,
                                language,
                                PREPARATION_PHASE_LABELS,
                              )}
                            </span>
                            <span className="status-chip idle">
                              {localizedOptionLabel(
                                mesocycle.progressionType,
                                language,
                                PROGRESSION_TYPE_LABELS,
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="mesocycle-plan-meta">
                          <article>
                            <span>
                              {copyFor(language, {
                                en: "Period",
                                ru: "Период",
                                bg: "Период",
                              })}
                            </span>
                            <strong>
                              {mesocycle.startDate} - {mesocycle.endDate}
                            </strong>
                          </article>
                          <article>
                            <span>
                              {copyFor(language, {
                                en: "Weeks",
                                ru: "Недели",
                                bg: "Седмици",
                              })}
                            </span>
                            <strong>{mesocycle.weeksCount}</strong>
                          </article>
                          <article>
                            <span>
                              {copyFor(language, {
                                en: "Target load",
                                ru: "Целевая нагрузка",
                                bg: "Целево натоварване",
                              })}
                            </span>
                            <strong>{Math.round(totalTargetLoad)}</strong>
                          </article>
                          <article>
                            <span>
                              {copyFor(language, {
                                en: "Start",
                                ru: "Старт",
                                bg: "Старт",
                              })}
                            </span>
                            <strong>
                              {mesocycle.competitionTitle ||
                                copyFor(language, {
                                  en: "Not linked",
                                  ru: "Не привязан",
                                  bg: "Няма връзка",
                                })}
                            </strong>
                          </article>
                        </div>

                        <p className="mesocycle-plan-goal">
                          <span>
                            {copyFor(language, {
                              en: "Goal",
                              ru: "Цель",
                              bg: "Цел",
                            })}
                          </span>
                          {goalText ||
                            copyFor(language, {
                              en: "not set",
                              ru: "не задана",
                              bg: "не е зададена",
                            })}
                        </p>

                        <div className="mesocycle-week-grid">
                          {mesocycle.weeks.map((week) => {
                            const loadWidth = Math.min(
                              100,
                              Math.max(4, (week.targetLoad / maxWeekLoad) * 100),
                            );

                            return (
                              <article
                                className="mesocycle-week-item"
                                key={`${mesocycle.id}-${week.weekIndex}`}
                              >
                                <div className="mesocycle-week-head">
                                  <strong>{localizedWeekLabel(week.label, language)}</strong>
                                  <span>
                                    {week.startDate} - {week.endDate}
                                  </span>
                                </div>
                                <div className="mesocycle-load-bar" aria-hidden="true">
                                  <span style={{ width: `${loadWidth}%` }} />
                                </div>
                                <div className="mesocycle-week-meta">
                                  <span>
                                    {localizedOptionLabel(
                                      week.microcycleType,
                                      language,
                                      MICROCYCLE_TYPE_LABELS,
                                    )}
                                  </span>
                                  <strong>{Math.round(week.targetLoad)}</strong>
                                </div>
                                <p>{translateKnownMesocycleText(week.focus, language)}</p>
                                <button
                                  className="secondary-button"
                                  onClick={() => handleUseMesocycleWeek(mesocycle, week)}
                                  type="button"
                                >
                                  {copyFor(language, {
                                    en: "Use in week",
                                    ru: "В недельный план",
                                    bg: "Към седмичния план",
                                  })}
                                </button>
                              </article>
                            );
                          })}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            ) : null}

            {planningView === "season" && seasonEditorMode === "result" ? (
            <form
              className="auth-form planning-main-form planning-season-result-form"
              onSubmit={handleCompetitionResultSubmit}
            >
              <h3>
                {copyFor(language, {
                  en: "Start result",
                  ru: "Результат старта",
                  bg: "Резултат от старт",
                })}
              </h3>
              <label className="field">
                <span>
                  {copyFor(language, {
                    en: "Start",
                    ru: "Старт",
                    bg: "Старт",
                  })}
                </span>
                <select
                  value={competitionResultForm.competitionPlanId || selectedSeasonStart?.id || ""}
                  onChange={(event) => {
                    setSelectedSeasonStartId(event.target.value);
                    setCompetitionResultForm((current) => ({
                      ...current,
                      competitionPlanId: event.target.value,
                    }));
                  }}
                  required
                >
                  <option value="">
                    {copyFor(language, {
                      en: "Select start",
                      ru: "Выберите старт",
                      bg: "Изберете старт",
                    })}
                  </option>
                  {visibleSeasonStarts.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.competitionTitle} / {plan.prepStartDate}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>
                  {copyFor(language, {
                    en: "Place",
                    ru: "Место",
                    bg: "Място",
                  })}
                </span>
                <input
                  type="number"
                  value={competitionResultForm.finalPlace ?? ""}
                  onChange={(event) =>
                    setCompetitionResultForm((current) => ({
                      ...current,
                      finalPlace: event.target.value === "" ? null : Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>
                  {copyFor(language, {
                    en: "Matches",
                    ru: "Схватки",
                    bg: "Срещи",
                  })}
                </span>
                <input
                  type="number"
                  value={competitionResultForm.matchesCount ?? ""}
                  onChange={(event) =>
                    setCompetitionResultForm((current) => ({
                      ...current,
                      matchesCount:
                        event.target.value === "" ? null : Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>
                  {copyFor(language, {
                    en: "Weigh-in",
                    ru: "Вес на взвешивании",
                    bg: "Тегло на кантар",
                  })}
                </span>
                <input
                  type="number"
                  step="0.1"
                  value={competitionResultForm.weightAtWeighIn ?? ""}
                  onChange={(event) =>
                    setCompetitionResultForm((current) => ({
                      ...current,
                      weightAtWeighIn:
                        event.target.value === "" ? null : Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>
                  {copyFor(language, {
                    en: "Weight after",
                    ru: "Вес после",
                    bg: "Тегло след",
                  })}
                </span>
                <input
                  type="number"
                  step="0.1"
                  value={competitionResultForm.weightAfter ?? ""}
                  onChange={(event) =>
                    setCompetitionResultForm((current) => ({
                      ...current,
                      weightAfter: event.target.value === "" ? null : Number(event.target.value),
                    }))
                  }
                />
              </label>
              <details className="planning-season-advanced-fields">
                <summary>
                  {copyFor(language, {
                    en: "Notes",
                    ru: "Заметки",
                    bg: "Бележки",
                  })}
                </summary>
                <label className="field">
                  <span>
                    {copyFor(language, {
                      en: "Performance",
                      ru: "Выступление",
                      bg: "Представяне",
                    })}
                  </span>
                  <input
                    value={competitionResultForm.performanceNotes}
                    onChange={(event) =>
                      setCompetitionResultForm((current) => ({
                        ...current,
                        performanceNotes: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span>{t("coachNotes")}</span>
                  <input
                    value={competitionResultForm.coachNotes}
                    onChange={(event) =>
                      setCompetitionResultForm((current) => ({
                        ...current,
                        coachNotes: event.target.value,
                      }))
                    }
                  />
                </label>
              </details>
              <button className="primary-button planning-season-submit" disabled={busy} type="submit">
                {busy
                  ? ui("syncingNow")
                  : copyFor(language, {
                      en: "Save result",
                      ru: "Сохранить результат",
                      bg: "Запази резултат",
                    })}
              </button>
            </form>
            ) : null}

            {planningView === "templates" ? (
            <form
              className="auth-form wide-form planning-main-form planning-template-builder"
              onSubmit={handlePlanTemplateSubmit}
            >
              <div className="planning-template-editor-head">
                <div>
                  <h3>
                    {copyFor(language, {
                      en: "Template editor",
                      ru: "Редактор шаблона",
                      bg: "Редактор на шаблон",
                    })}
                  </h3>
                  <p className="placeholder-copy">
                    {copyFor(language, {
                      en: "Edit a day, week, or full plan before it becomes a working assignment.",
                      ru: "Редактируйте день, неделю или полный план до назначения спортсмену.",
                      bg: "Редактирайте ден, седмица или цял план преди назначаване на спортист.",
                    })}
                  </p>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setPlanForm(createLocalizedDefaultPlanTemplate(language));
                    setImportedPlanDraft(null);
                    setIsTemplateDraftActive(true);
                    setSelectedTemplateDayIndex(0);
                    setSelectedTemplateAssignDayIndexes([]);
                  }}
                  type="button"
                >
                  {copyFor(language, {
                    en: "New template",
                    ru: "Новый шаблон",
                    bg: "Нов шаблон",
                  })}
                </button>
              </div>

              <div className="planning-template-import-card">
                <div className="planning-template-import-copy">
                  <strong>
                    {copyFor(language, {
                      en: "Import work plan",
                      ru: "Импорт плана работы",
                      bg: "Импорт на работен план",
                    })}
                  </strong>
                  <p className="placeholder-copy">
                    {copyFor(language, {
                      en: "Upload an HTML plan. It will stay as one multi-day template with all days and exercises inside.",
                      ru: "Загрузите HTML-план. Он сохранится одним многодневным шаблоном со всеми днями и упражнениями.",
                      bg: "Качете HTML план. Той ще се запази като един многодневен шаблон с всички дни и упражнения.",
                    })}
                  </p>
                </div>
                <label className="field planning-template-import-file">
                  <span>
                    {copyFor(language, {
                      en: "Plan file",
                      ru: "Файл плана",
                      bg: "Файл на плана",
                    })}
                  </span>
                  <input accept=".html,text/html" onChange={handlePlanFileImport} type="file" />
                </label>
                {importedPlanDraft ? (
                  <div className="planning-template-import-preview">
                    <div className="summary-topline">
                      <div>
                        <strong>{importedPlanDraft.title}</strong>
                        <small>{importedPlanDraft.sourceFileName}</small>
                      </div>
                      <span>
                        {copyFor(language, {
                          en: `${importedPlanDraft.days.length} day(s)`,
                          ru: `${importedPlanDraft.days.length} дн.`,
                          bg: `${importedPlanDraft.days.length} дни`,
                        })}
                      </span>
                    </div>
                    <div className="planning-template-import-days">
                      {importedPlanDraft.days.map((day) => (
                        <button
                          className={`planning-template-import-day ${
                            assignedPlanForm.dayLabel === day.label ? "is-active" : ""
                          }`}
                          key={`${day.label}-${day.dayOffset}`}
                          onClick={() => {
                            setAssignedPlanForm((current) => ({
                              ...current,
                              dayLabel: day.label,
                            }));
                          }}
                          type="button"
                        >
                          <strong>{day.label}</strong>
                          <span>
                            {day.dayDate ?? `+${day.dayOffset}`} /{" "}
                            {blocksCountLabel(day.blockCount, language)} /{" "}
                            {copyFor(language, {
                              en: "ex.",
                              ru: "упр.",
                              bg: "упр.",
                            })}{" "}
                            {countTemplateExercises(day.template)}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="planning-template-import-actions">
                      <label className="field">
                        <span>{t("startDate")}</span>
                        <input
                          type="date"
                          value={assignedPlanForm.startDate}
                          onChange={(event) =>
                            setAssignedPlanForm((current) => ({
                              ...current,
                              startDate: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>{t("plannedPhase")}</span>
                        <select
                          value={assignedPlanForm.plannedPhase ?? ""}
                          onChange={(event) =>
                            setAssignedPlanForm((current) => ({
                              ...current,
                              plannedPhase:
                                event.target.value === ""
                                  ? null
                                  : (event.target.value as AssignedPlanPayload["plannedPhase"]),
                            }))
                          }
                        >
                          <option value="">{t("autoFromCompetitionContext")}</option>
                          {PREPARATION_PHASE_VALUES.map((phase) => (
                            <option key={phase} value={phase}>
                              {localizedOptionLabel(phase, language, PREPARATION_PHASE_LABELS)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="primary-button"
                        disabled={busy || !importedPlanDraft || (!selectedAthleteId && !assignedPlanForm.athleteId)}
                        onClick={handleAssignImportedPlan}
                        type="button"
                      >
                        {busy
                          ? ui("assigning")
                          : copyFor(language, {
                              en: "Save and assign full plan",
                              ru: "Сохранить и назначить весь план",
                              bg: "Запази и назначи целия план",
                            })}
                      </button>
                    </div>
                    <p className="placeholder-copy">
                      {copyFor(language, {
                        en: selectedAthleteId
                          ? "The plan will be assigned to the athlete selected in the top menu."
                          : "Select an athlete in the top menu or in the assignment panel.",
                        ru: selectedAthleteId
                          ? "План будет назначен спортсмену, выбранному в верхнем меню."
                          : "Выберите спортсмена в верхнем меню или в блоке назначения.",
                        bg: selectedAthleteId
                          ? "Планът ще бъде назначен на спортиста, избран в горното меню."
                          : "Изберете спортист от горното меню или от блока за назначаване.",
                      })}
                    </p>
                  </div>
                ) : null}
              </div>

              <section className="planning-template-structure-card">
                <div className="summary-topline planning-template-structure-head">
                  <div>
                    <strong>
                      {translateKnownTemplateText(
                        importedPlanDraft?.title ??
                          (isTemplateDraftActive ? planForm.name : activePlanTemplate?.name ?? planForm.name),
                        language,
                      )}
                    </strong>
                    <small>
                      {importedPlanDraft?.sourceFileName ??
                        translateKnownTemplateText(
                          isTemplateDraftActive
                            ? planForm.description
                            : activePlanTemplate?.description ?? planForm.description,
                          language,
                        ) ??
                        ""}
                    </small>
                  </div>
                  <span>
                    {copyFor(language, {
                      en: importedPlanDraft ? "Draft" : "Plan",
                      ru: importedPlanDraft ? "Черновик" : "План",
                      bg: importedPlanDraft ? "Чернова" : "План",
                    })}
                  </span>
                </div>

                <div className="planning-template-structure-stats">
                  <span>
                    <strong>{templateWorkspaceWeeks.length}</strong>
                    {copyFor(language, { en: "weeks", ru: "недель", bg: "седмици" })}
                  </span>
                  <span>
                    <strong>{templateWorkspaceDays.length}</strong>
                    {copyFor(language, { en: "days", ru: "дней", bg: "дни" })}
                  </span>
                  <span>
                    <strong>{templateWorkspaceBlockCount}</strong>
                    {copyFor(language, { en: "blocks", ru: "блоков", bg: "блокове" })}
                  </span>
                  <span>
                    <strong>{templateWorkspaceExerciseCount}</strong>
                    {copyFor(language, { en: "exercises", ru: "упр.", bg: "упр." })}
                  </span>
                </div>

                {templateWorkspaceDays.length === 0 ? (
                  <p className="placeholder-copy">
                    {copyFor(language, {
                      en: "Load a plan or select one from the library to see its structure.",
                      ru: "Загрузите план или выберите его в библиотеке, чтобы увидеть структуру.",
                      bg: "Качете план или го изберете от библиотеката, за да видите структурата.",
                    })}
                  </p>
                ) : (
                  <div className="planning-template-structure-grid">
                    <div className="planning-template-week-list">
                      {templateWorkspaceWeeks.map((week, weekIndex) => (
                        <details
                          className="planning-template-week"
                          key={`${week.label}-${week.startIndex}`}
                          open={
                            normalizedSelectedTemplateDayIndex >= week.startIndex &&
                            normalizedSelectedTemplateDayIndex < week.startIndex + week.days.length
                          }
                        >
                          <summary>
                            <strong>
                              {copyFor(language, {
                                en: `Week ${weekIndex + 1}`,
                                ru: `Неделя ${weekIndex + 1}`,
                                bg: `Седмица ${weekIndex + 1}`,
                              })}
                            </strong>
                            <span>{week.days.length}</span>
                          </summary>
                          <div className="planning-template-day-list">
                            {week.days.map((day, dayOffset) => {
                              const dayIndex = week.startIndex + dayOffset;
                              const isSelected = normalizedSelectedTemplateDayIndex === dayIndex;
                              const isAssignmentSelected =
                                selectedTemplateAssignMode === "full" ||
                                selectedTemplateAssignmentIndexes.includes(dayIndex);

                              return (
                                <button
                                  className={`planning-template-day-row ${isSelected ? "is-active" : ""}`}
                                  key={`${day.label}-${dayIndex}`}
                                  onClick={() => {
                                    setSelectedTemplateDayIndex(dayIndex);
                                    if (selectedTemplateAssignMode === "selected") {
                                      setSelectedTemplateAssignDayIndexes((current) =>
                                        current.includes(dayIndex) ? current : [...current, dayIndex],
                                      );
                                    }
                                  }}
                                  type="button"
                                >
                                  <span>{isAssignmentSelected ? "✓" : ""}</span>
                                  <strong>{translateKnownTemplateText(day.label, language)}</strong>
                                  <small>
                                    {countTemplateDayBlocks(day)}{" "}
                                    {copyFor(language, { en: "blocks", ru: "бл.", bg: "бл." })} /{" "}
                                    {countTemplateDayExercises(day)}{" "}
                                    {copyFor(language, { en: "ex.", ru: "упр.", bg: "упр." })}
                                  </small>
                                </button>
                              );
                            })}
                          </div>
                        </details>
                      ))}
                    </div>

                    <div className="planning-template-day-detail">
                      {selectedTemplateDay ? (
                        <>
                          <div className="planning-template-session-preview">
                            <article className="planning-template-day-card">
                              <header className="planning-template-day-card-head">
                                <input
                                  aria-label={copyFor(language, {
                                    en: "Day",
                                    ru: "День",
                                    bg: "Ден",
                                  })}
                                  className="planning-template-card-title-input"
                                  value={selectedTemplateDay.label}
                                  onChange={(event) =>
                                    updateTemplateDayDraft(normalizedSelectedTemplateDayIndex, (day) => ({
                                      ...day,
                                      label: event.target.value,
                                    }))
                                  }
                                />
                                <input
                                  aria-label={copyFor(language, {
                                    en: "Day focus",
                                    ru: "Фокус дня",
                                    bg: "Фокус на деня",
                                  })}
                                  className="planning-template-card-note-input"
                                  value={selectedTemplateDay.notes ?? ""}
                                  onChange={(event) =>
                                    updateTemplateDayDraft(normalizedSelectedTemplateDayIndex, (day) => ({
                                      ...day,
                                      notes: event.target.value,
                                    }))
                                  }
                                />
                              </header>
                              <div className="planning-template-day-card-body">
                                {selectedTemplateDay.sessions.map((session, sessionIndex) => (
                                  <section
                                    className="planning-template-day-session"
                                    key={`${session.name}-${sessionIndex}`}
                                  >
                                    <input
                                      aria-label={copyFor(language, {
                                        en: "Session name",
                                        ru: "Название тренировки",
                                        bg: "Име на тренировката",
                                      })}
                                      className="planning-template-session-name-input"
                                      value={session.name}
                                      onChange={(event) =>
                                        updateTemplateSessionDraft(
                                          normalizedSelectedTemplateDayIndex,
                                          sessionIndex,
                                          (currentSession) => ({
                                            ...currentSession,
                                            name: event.target.value,
                                          }),
                                        )
                                      }
                                    />
                                    <table className="planning-template-exercise-table">
                                      <thead>
                                        <tr>
                                          <th>
                                            {copyFor(language, { en: "Exercise", ru: "Упр.", bg: "Упр." })}
                                          </th>
                                          <th>
                                            {copyFor(language, { en: "Sets", ru: "Подходы", bg: "Серии" })}
                                          </th>
                                          <th>
                                            {copyFor(language, { en: "Control", ru: "Контроль", bg: "Контрол" })}
                                          </th>
                                          <th aria-label={copyFor(language, { en: "Actions", ru: "Действия", bg: "Действия" })} />
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {session.blocks.flatMap((block, blockIndex) =>
                                          getEditableBlockExercises(block, blockIndex).map((exercise, exerciseIndex) => (
                                            <tr key={`${block.name}-${exercise.name}-${blockIndex}-${exerciseIndex}`}>
                                              <td>
                                                <input
                                                  value={exercise.name}
                                                  onChange={(event) =>
                                                    updateTemplateExerciseRow(
                                                      normalizedSelectedTemplateDayIndex,
                                                      sessionIndex,
                                                      blockIndex,
                                                      exerciseIndex,
                                                      { name: event.target.value },
                                                    )
                                                  }
                                                />
                                              </td>
                                              <td>
                                                <input
                                                  value={formatExerciseWorkCell(exercise, language).replace(/^-$/u, "")}
                                                  onChange={(event) =>
                                                    updateTemplateExerciseRow(
                                                      normalizedSelectedTemplateDayIndex,
                                                      sessionIndex,
                                                      blockIndex,
                                                      exerciseIndex,
                                                      { work: event.target.value },
                                                    )
                                                  }
                                                />
                                              </td>
                                              <td>
                                                <input
                                                  value={formatExerciseControlCell(exercise, language).replace(/^-$/u, "")}
                                                  onChange={(event) =>
                                                    updateTemplateExerciseRow(
                                                      normalizedSelectedTemplateDayIndex,
                                                      sessionIndex,
                                                      blockIndex,
                                                      exerciseIndex,
                                                      { control: event.target.value },
                                                    )
                                                  }
                                                />
                                              </td>
                                              <td className="planning-template-exercise-action-cell">
                                                <button
                                                  aria-label={copyFor(language, {
                                                    en: "Remove exercise",
                                                    ru: "Удалить упражнение",
                                                    bg: "Изтрий упражнение",
                                                  })}
                                                  className="planning-template-row-action"
                                                  onClick={() =>
                                                    removeTemplateExerciseRow(
                                                      normalizedSelectedTemplateDayIndex,
                                                      sessionIndex,
                                                      blockIndex,
                                                      exerciseIndex,
                                                    )
                                                  }
                                                  type="button"
                                                >
                                                  ×
                                                </button>
                                              </td>
                                            </tr>
                                          )),
                                        )}
                                      </tbody>
                                    </table>
                                    <button
                                      className="planning-template-add-row-button"
                                      onClick={() =>
                                        addTemplateExerciseRow(normalizedSelectedTemplateDayIndex, sessionIndex)
                                      }
                                      type="button"
                                    >
                                      {copyFor(language, {
                                        en: "Add exercise",
                                        ru: "Добавить упражнение",
                                        bg: "Добави упражнение",
                                      })}
                                    </button>
                                  </section>
                                ))}
                              </div>
                            </article>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                )}
              </section>

              <details className="planning-template-editor-details">
                <summary>
                  <strong>
                    {copyFor(language, {
                      en: "Edit plan fields and blocks",
                      ru: "Редактировать поля и блоки",
                      bg: "Редактирай полета и блокове",
                    })}
                  </strong>
                  <span>
                    {copyFor(language, {
                      en: "Advanced",
                      ru: "Дополнительно",
                      bg: "Допълнително",
                    })}
                  </span>
                </summary>

              <div className="planning-template-meta-grid">
              <label className="field">
                <span>{t("templateName")}</span>
                <input
                  value={planForm.name}
                  onChange={(event) =>
                    setPlanForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label className="field">
                <span>{t("description")}</span>
                <input
                  value={planForm.description}
                  onChange={(event) =>
                    setPlanForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="field">
                <span>{t("sportType")}</span>
                <input
                  value={planForm.sportType}
                  onChange={(event) =>
                    setPlanForm((current) => ({
                      ...current,
                      sportType: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="field">
                <span>{t("phaseFocus")}</span>
                <select
                  value={planForm.phaseFocus ?? ""}
                  onChange={(event) =>
                    setPlanForm((current) => ({
                      ...current,
                      phaseFocus:
                        event.target.value === ""
                          ? null
                          : (event.target.value as PlanTemplatePayload["phaseFocus"]),
                    }))
                  }
                >
                  <option value="">{t("general")}</option>
                  {PREPARATION_PHASE_VALUES.map(
                    (phase) => (
                      <option key={phase} value={phase}>
                        {localizedOptionLabel(phase, language, PREPARATION_PHASE_LABELS)}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="field">
                <span>{t("priorityFocus")}</span>
                <select
                  value={planForm.competitionPriorityFocus ?? ""}
                  onChange={(event) =>
                    setPlanForm((current) => ({
                      ...current,
                      competitionPriorityFocus:
                        event.target.value === ""
                          ? null
                          : (event.target.value as PlanTemplatePayload["competitionPriorityFocus"]),
                    }))
                  }
                >
                  <option value="">{t("general")}</option>
                  {["A", "B", "C"].map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>{t("templateGoal")}</span>
                <input
                  value={planForm.templateGoal}
                  onChange={(event) =>
                    setPlanForm((current) => ({
                      ...current,
                      templateGoal: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="field">
                <span>{t("microcycleType")}</span>
                <select
                  value={planForm.microcycleType}
                  onChange={(event) =>
                    setPlanForm((current) => ({
                      ...current,
                      microcycleType: event.target.value,
                    }))
                  }
                >
                  {!TEMPLATE_MICROCYCLE_TYPES.includes(
                    planForm.microcycleType as (typeof TEMPLATE_MICROCYCLE_TYPES)[number],
                  ) ? (
                    <option value={planForm.microcycleType}>{planForm.microcycleType}</option>
                  ) : null}
                  {TEMPLATE_MICROCYCLE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {localizedOptionLabel(type, language, MICROCYCLE_TYPE_LABELS)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>{t("competitionSpecific")}</span>
                <input
                  type="checkbox"
                  checked={planForm.competitionSpecific}
                  onChange={(event) =>
                    setPlanForm((current) => ({
                      ...current,
                      competitionSpecific: event.target.checked,
                    }))
                  }
                />
              </label>
              </div>

              <div className="entry-summary">
                <div className="summary-topline">
                  <strong>{t("templateBlocks")}</strong>
                  <span>{blocksCountLabel(planForm.blocks.length, language)}</span>
                </div>
                <div className="stack">
                  {planForm.blocks.map((block, index) => (
                    <details
                      className="entry-summary planning-template-block"
                      key={`${block.name}-${index}`}
                      open={index === 0}
                    >
                      <summary className="summary-topline planning-template-block-summary">
                        <div>
                          <strong>{block.name}</strong>
                          <small>
                            {localizedOptionLabel(block.blockType, language, BLOCK_TYPE_LABELS)} /{" "}
                            {block.targetDurationMinutes ?? "-"} {copyFor(language, {
                              en: "min",
                              ru: "мин",
                              bg: "мин",
                            })}{" "}
                            / RPE {block.targetRpe ?? "-"}
                          </small>
                        </div>
                        <span>
                          {copyFor(language, {
                            en: "Exercises",
                            ru: "Упражнения",
                            bg: "Упражнения",
                          })}: {block.exercises?.length ?? 0}
                        </span>
                      </summary>
                      <div className="readiness-form">
                        <label className="field">
                          <span>{t("blockName")}</span>
                          <input
                            value={block.name}
                            onChange={(event) =>
                              setPlanForm((current) => ({
                                ...current,
                                blocks: current.blocks.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, name: event.target.value }
                                    : item,
                                ),
                              }))
                            }
                          />
                        </label>
                        <label className="field">
                          <span>{t("blockType")}</span>
                          <select
                            value={block.blockType}
                            onChange={(event) =>
                              setPlanForm((current) => ({
                                ...current,
                                blocks: current.blocks.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        blockType: event.target
                                          .value as PlanTemplatePayload["blocks"][number]["blockType"],
                                      }
                                    : item,
                                ),
                              }))
                            }
                          >
                            {block.blockType &&
                              PLAN_BLOCK_TYPE_VALUES.map((type) => (
                                <option key={type} value={type}>
                                  {localizedOptionLabel(type, language, BLOCK_TYPE_LABELS)}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label className="field">
                          <span>{t("blockPriority")}</span>
                          <input
                            type="number"
                            value={block.blockPriority}
                            onChange={(event) =>
                              setPlanForm((current) => ({
                                ...current,
                                blocks: current.blocks.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        blockPriority: Number(event.target.value),
                                      }
                                    : item,
                                ),
                              }))
                            }
                          />
                        </label>
                        <label className="field">
                          <span>{t("mandatory")}</span>
                          <input
                            type="checkbox"
                            checked={block.isMandatory}
                            onChange={(event) =>
                              setPlanForm((current) => ({
                                ...current,
                                blocks: current.blocks.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, isMandatory: event.target.checked }
                                    : item,
                                ),
                              }))
                            }
                          />
                        </label>
                        <label className="field">
                          <span>{t("targetDuration")}</span>
                          <input
                            type="number"
                            step="0.5"
                            value={block.targetDurationMinutes ?? ""}
                            onChange={(event) =>
                              setPlanForm((current) => ({
                                ...current,
                                blocks: current.blocks.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        targetDurationMinutes:
                                          event.target.value === ""
                                            ? null
                                            : Number(event.target.value),
                                      }
                                    : item,
                                ),
                              }))
                            }
                          />
                        </label>
                        <label className="field">
                          <span>{t("targetRpe")}</span>
                          <input
                            type="number"
                            step="0.5"
                            value={block.targetRpe ?? ""}
                            onChange={(event) =>
                              setPlanForm((current) => ({
                                ...current,
                                blocks: current.blocks.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        targetRpe:
                                          event.target.value === ""
                                            ? null
                                            : Number(event.target.value),
                                      }
                                    : item,
                                ),
                              }))
                            }
                          />
                        </label>
                        <label className="field">
                          <span>{t("targetSets")}</span>
                          <input
                            type="number"
                            value={block.targetSets ?? ""}
                            onChange={(event) =>
                              setPlanForm((current) => ({
                                ...current,
                                blocks: current.blocks.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        targetSets:
                                          event.target.value === ""
                                            ? null
                                            : Number(event.target.value),
                                      }
                                    : item,
                                ),
                              }))
                            }
                          />
                        </label>
                        <label className="field">
                          <span>{t("targetReps")}</span>
                          <input
                            type="number"
                            value={block.targetReps ?? ""}
                            onChange={(event) =>
                              setPlanForm((current) => ({
                                ...current,
                                blocks: current.blocks.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        targetReps:
                                          event.target.value === ""
                                            ? null
                                            : Number(event.target.value),
                                      }
                                    : item,
                                ),
                              }))
                            }
                          />
                        </label>
                        <label className="field">
                          <span>{t("notes")}</span>
                          <input
                            value={block.notes}
                            onChange={(event) =>
                              setPlanForm((current) => ({
                                ...current,
                                blocks: current.blocks.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, notes: event.target.value }
                                    : item,
                                ),
                              }))
                            }
                          />
                        </label>
                      </div>
                      {(() => {
                        const exercisePresets = getBlockExercisePresets(block.blockType);

                        return (
                          <div className="strength-exercise-builder">
                          <div className="summary-topline">
                            <div>
                              <strong>
                                {copyFor(language, {
                                  en: "Block exercises",
                                  ru: "Упражнения блока",
                                  bg: "Упражнения на блока",
                                })}
                              </strong>
                              <p className="placeholder-copy">
                                {copyFor(language, {
                                  en: "Select exercises for this block type. They will be assigned to the athlete and tracked in execution.",
                                  ru: "Выберите упражнения для этого типа блока. Они попадут спортсмену в план и будут учитываться при фиксации выполнения.",
                                  bg: "Изберете упражнения за този тип блок. Те ще влязат в плана на спортиста и ще се следят при изпълнение.",
                                })}
                              </p>
                            </div>
                            <span>{block.exercises?.length ?? 0}</span>
                          </div>

                          <div className="strength-exercise-actions">
                            <label className="field">
                              <span>
                                {copyFor(language, {
                                  en: "Exercise list",
                                  ru: "Список упражнений",
                                  bg: "Списък с упражнения",
                                })}
                              </span>
                              <select
                                onChange={(event) => {
                                  const preset = exercisePresets.find(
                                    (item) => item.id === event.target.value,
                                  );

                                  if (preset) {
                                    addPlanBlockExercise(
                                      index,
                                      buildBlockExerciseFromPreset(preset, language),
                                    );
                                  }
                                }}
                                value=""
                              >
                                <option value="">
                                  {copyFor(language, {
                                    en: "Add exercise from list",
                                    ru: "Добавить упражнение из списка",
                                    bg: "Добави упражнение от списъка",
                                  })}
                                </option>
                                {exercisePresets.map((preset) => (
                                  <option key={preset.id} value={preset.id}>
                                    {copyFor(language, preset.label)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button
                              className="secondary-button"
                              onClick={() =>
                                addPlanBlockExercise(
                                  index,
                                  buildEmptyBlockExercise(language, block.blockType),
                                )
                              }
                              type="button"
                            >
                              {copyFor(language, {
                                en: "Add custom",
                                ru: "Добавить своё",
                                bg: "Добави свое",
                              })}
                            </button>
                          </div>

                          {(block.exercises ?? []).length === 0 ? (
                            <p className="placeholder-copy">
                              {copyFor(language, {
                                en: "No exercises selected yet.",
                                ru: "Пока упражнения не выбраны.",
                                bg: "Все още няма избрани упражнения.",
                              })}
                            </p>
                          ) : (
                            <div className="strength-exercise-list">
                              {(block.exercises ?? []).map((exercise, exerciseIndex) => (
                                <article
                                  className="strength-exercise-card"
                                  key={`${exercise.name}-${exerciseIndex}`}
                                >
                                  <div className="summary-topline">
                                    <strong>
                                      {copyFor(language, {
                                        en: "Exercise",
                                        ru: "Упражнение",
                                        bg: "Упражнение",
                                      })}{" "}
                                      {exerciseIndex + 1}
                                    </strong>
                                    <button
                                      className="tertiary-button"
                                      onClick={() => removePlanBlockExercise(index, exerciseIndex)}
                                      type="button"
                                    >
                                      {copyFor(language, {
                                        en: "Remove",
                                        ru: "Удалить",
                                        bg: "Премахни",
                                      })}
                                    </button>
                                  </div>
                                  <div className="readiness-form strength-exercise-fields">
                                    <label className="field">
                                      <span>
                                        {copyFor(language, {
                                          en: "Name",
                                          ru: "Название",
                                          bg: "Име",
                                        })}
                                      </span>
                                      <input
                                        value={exercise.name}
                                        onChange={(event) =>
                                          updatePlanBlockExercise(index, exerciseIndex, {
                                            name: event.target.value,
                                          })
                                        }
                                      />
                                    </label>
                                    <label className="field">
                                      <span>{t("targetSets")}</span>
                                      <input
                                        type="number"
                                        value={exercise.targetSets ?? ""}
                                        onChange={(event) =>
                                          updatePlanBlockExercise(index, exerciseIndex, {
                                            targetSets: parseOptionalNumberInput(event.target.value),
                                          })
                                        }
                                      />
                                    </label>
                                    <label className="field">
                                      <span>{t("targetReps")}</span>
                                      <input
                                        type="number"
                                        value={exercise.targetReps ?? ""}
                                        onChange={(event) =>
                                          updatePlanBlockExercise(index, exerciseIndex, {
                                            targetReps: parseOptionalNumberInput(event.target.value),
                                          })
                                        }
                                      />
                                    </label>
                                    <label className="field">
                                      <span>
                                        {copyFor(language, {
                                          en: "Weight, kg",
                                          ru: "Вес, кг",
                                          bg: "Тегло, кг",
                                        })}
                                      </span>
                                      <input
                                        step="0.5"
                                        type="number"
                                        value={exercise.targetWeightKg ?? ""}
                                        onChange={(event) =>
                                          updatePlanBlockExercise(index, exerciseIndex, {
                                            targetWeightKg: parseOptionalNumberInput(event.target.value),
                                          })
                                        }
                                      />
                                    </label>
                                    <label className="field">
                                      <span>{t("targetDuration")}</span>
                                      <input
                                        step="0.5"
                                        type="number"
                                        value={exercise.targetDurationMinutes ?? ""}
                                        onChange={(event) =>
                                          updatePlanBlockExercise(index, exerciseIndex, {
                                            targetDurationMinutes: parseOptionalNumberInput(
                                              event.target.value,
                                            ),
                                          })
                                        }
                                      />
                                    </label>
                                    <label className="field">
                                      <span>{t("targetRpe")}</span>
                                      <input
                                        step="0.5"
                                        type="number"
                                        value={exercise.targetRpe ?? ""}
                                        onChange={(event) =>
                                          updatePlanBlockExercise(index, exerciseIndex, {
                                            targetRpe: parseOptionalNumberInput(event.target.value),
                                          })
                                        }
                                      />
                                    </label>
                                    <label className="field strength-exercise-notes">
                                      <span>{t("notes")}</span>
                                      <input
                                        value={exercise.notes}
                                        onChange={(event) =>
                                          updatePlanBlockExercise(index, exerciseIndex, {
                                            notes: event.target.value,
                                          })
                                        }
                                      />
                                    </label>
                                  </div>
                                </article>
                              ))}
                            </div>
                          )}
                          </div>
                        );
                      })()}
                    </details>
                  ))}
                </div>
              </div>

              </details>

              <button className="primary-button" disabled={busy} type="submit">
                {busy ? ui("syncingNow") : t("createTemplate")}
              </button>
            </form>
            ) : null}

            {planningView === "templates" ? (
            <div className="entry-summary planning-side-card planning-template-list">
              <div className="planning-template-library-head">
                <div>
                  <strong>
                    {copyFor(language, {
                      en: "Template library",
                      ru: "Библиотека шаблонов",
                      bg: "Библиотека с шаблони",
                    })}
                  </strong>
                  <p className="placeholder-copy">
                    {copyFor(language, {
                      en: "Saved reusable days, weeks, and full plans.",
                      ru: "Сохранённые дни, недели и полные планы.",
                      bg: "Запазени дни, седмици и цели планове.",
                    })}
                  </p>
                </div>
                <span>{planTemplates.length}</span>
              </div>
              {planTemplates.length === 0 ? (
                <p className="placeholder-copy">
                  {t("noPlanTemplates")}
                </p>
              ) : (
                <div className="planning-template-library-list">
                  <div className="planning-template-delete-bar">
                    <label className="planning-template-select planning-template-select-all">
                      <input
                        checked={allPlanTemplatesSelected}
                        onChange={(event) =>
                          setSelectedPlanTemplateIds(
                            event.target.checked ? planTemplates.map((template) => template.id) : [],
                          )
                        }
                        type="checkbox"
                      />
                      <span>
                        {copyFor(language, {
                          en: "Select all",
                          ru: "Выбрать все",
                          bg: "Избери всички",
                        })}
                      </span>
                    </label>
                    <span className="planning-template-selected-count">
                      {copyFor(language, {
                        en: `${selectedPlanTemplateCount} selected`,
                        ru: `Выбрано: ${selectedPlanTemplateCount}`,
                        bg: `Избрани: ${selectedPlanTemplateCount}`,
                      })}
                    </span>
                    <div className="planning-template-delete-actions">
                      <button
                        className="planning-template-delete-button"
                        disabled={busy || selectedPlanTemplateCount === 0}
                        onClick={() => void handleDeleteSelectedPlanTemplates()}
                        type="button"
                      >
                        {copyFor(language, {
                          en: "Delete selected",
                          ru: "Удалить выбранные",
                          bg: "Изтрий избраните",
                        })}
                      </button>
                      <button
                        className="planning-template-clear-button"
                        disabled={busy || selectedPlanTemplateCount === 0}
                        onClick={() => setSelectedPlanTemplateIds([])}
                        type="button"
                      >
                        {copyFor(language, {
                          en: "Clear",
                          ru: "Снять выбор",
                          bg: "Изчисти",
                        })}
                      </button>
                    </div>
                  </div>
                  {planTemplates.map((template) => {
                    const previewSessions = getTemplateExercisePreviewSessions(template);
                    const exerciseCount = countTemplateExercises(template);
                    const dayCount = countTemplateDays(template);
                    const sessionCount = countTemplateSessions(template);

                    return (
                    <article
                      className={`planning-template-library-card ${
                        activePlanTemplate?.id === template.id ? "is-active" : ""
                      }`}
                      key={template.id}
                    >
                      <label className="planning-template-select">
                        <input
                          checked={selectedPlanTemplateIds.includes(template.id)}
                          onChange={(event) =>
                            setSelectedPlanTemplateIds((current) =>
                              event.target.checked
                                ? current.includes(template.id)
                                  ? current
                                  : [...current, template.id]
                                : current.filter((id) => id !== template.id),
                            )
                          }
                          type="checkbox"
                        />
                        <span>
                          {copyFor(language, {
                            en: "Select",
                            ru: "Выбрать",
                            bg: "Избери",
                          })}
                        </span>
                      </label>
                      <button
                        className="planning-template-library-select"
                        onClick={() => {
                          setAssignedPlanForm((current) => ({
                            ...current,
                            templateId: template.id,
                          }));
                          setPlanForm(templateSummaryToPayload(template, language));
                          setImportedPlanDraft(null);
                          setIsTemplateDraftActive(false);
                          setSelectedTemplateDayIndex(0);
                          setSelectedTemplateAssignDayIndexes([]);
                        }}
                        type="button"
                      >
                        <span className="planning-template-library-kind">
                          {dayCount > 1
                            ? copyFor(language, {
                                en: "Multi-day plan",
                                ru: "План на несколько дней",
                                bg: "Многодневен план",
                              })
                            : copyFor(language, {
                                en: "Day template",
                                ru: "Шаблон дня",
                                bg: "Шаблон за ден",
                              })}
                        </span>
                        <strong>{translateKnownTemplateText(template.name, language)}</strong>
                        <small className="planning-template-library-meta">
                          {translateKnownTemplateText(template.sportType, language) || "-"} /{" "}
                          {localizedOptionLabel(template.phaseFocus, language, PREPARATION_PHASE_LABELS)} /{" "}
                          {localizedOptionLabel(template.microcycleType, language, MICROCYCLE_TYPE_LABELS)}
                        </small>
                        <div className="planning-template-library-stats">
                          <span>
                            <strong>{dayCount}</strong>
                            {copyFor(language, { en: "days", ru: "дней", bg: "дни" })}
                          </span>
                          <span>
                            <strong>{sessionCount}</strong>
                            {copyFor(language, { en: "sessions", ru: "сессий", bg: "сесии" })}
                          </span>
                          <span>
                            <strong>{template.blockCount}</strong>
                            {copyFor(language, { en: "blocks", ru: "блоков", bg: "блокове" })}
                          </span>
                          <span>
                            <strong>{exerciseCount}</strong>
                            {copyFor(language, { en: "exercises", ru: "упр.", bg: "упр." })}
                          </span>
                        </div>
                        <em>
                          {copyFor(language, {
                            en: "Load",
                            ru: "Нагрузка",
                            bg: "Натоварване",
                          })}: {template.estimatedLoad}
                        </em>
                      </button>
                      <details className="planning-template-exercise-details">
                        <summary>
                          {copyFor(language, {
                            en: "Contents",
                            ru: "Содержимое",
                            bg: "Съдържание",
                          })}{" "}
                          ({dayCount} / {template.blockCount} / {exerciseCount})
                        </summary>
                        <div className="planning-template-exercise-preview">
                          {previewSessions.map((session, sessionIndex) => (
                            <section
                              className="planning-template-exercise-session"
                              key={`${template.id}-${session.name}-${sessionIndex}`}
                            >
                              <strong>
                                {session.name ||
                                  copyFor(language, {
                                    en: "Template",
                                    ru: "Шаблон",
                                    bg: "Шаблон",
                                  })}
                              </strong>
                              {session.blocks.map((block, blockIndex) => (
                                <div
                                  className="planning-template-exercise-block"
                                  key={`${block.name}-${blockIndex}`}
                                >
                                  <span>{translateKnownTemplateText(block.name, language)}</span>
                                  {(block.exercises ?? []).length ? (
                                    <div className="assigned-exercise-list">
                                      {(block.exercises ?? []).map((exercise, exerciseIndex) => (
                                        <div
                                          className="assigned-exercise-row"
                                          key={`${exercise.name}-${exerciseIndex}`}
                                        >
                                          <strong>{exercise.name}</strong>
                                          <span>{formatExerciseTarget(exercise, language)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <small>{block.notes}</small>
                                  )}
                                </div>
                              ))}
                            </section>
                          ))}
                        </div>
                      </details>
                      <button
                        className="planning-template-delete-button"
                        disabled={busy}
                        onClick={() => void handleDeletePlanTemplate(template)}
                        type="button"
                      >
                        {copyFor(language, {
                          en: "Delete",
                          ru: "Удалить",
                          bg: "Изтрий",
                        })}
                      </button>
                    </article>
                    );
                  })}
                </div>
              )}
            </div>
            ) : null}

            {planningView === "templates" ? (
            <aside className="entry-summary planning-inspector-form planning-template-assign">
              <div className="planning-template-assign-head">
                <h3>
                  {copyFor(language, {
                    en: "Assign selected",
                    ru: "Назначить выбранное",
                    bg: "Назначи избраното",
                  })}
                </h3>
                <p className="placeholder-copy">
                  {selectedCoachAthlete
                    ? copyFor(language, {
                        en: `Athlete selected in the top menu: ${selectedCoachAthlete.fullName}.`,
                        ru: `Спортсмен выбран в верхнем меню: ${selectedCoachAthlete.fullName}.`,
                        bg: `Спортистът е избран в горното меню: ${selectedCoachAthlete.fullName}.`,
                      })
                    : copyFor(language, {
                        en: "Select an athlete in the top menu before assigning a plan.",
                        ru: "Перед назначением выберите спортсмена в верхнем меню.",
                        bg: "Преди назначаване изберете спортист от горното меню.",
                      })}
                </p>
              </div>

              <div className="planning-template-assignment-summary">
                <span>{copyFor(language, { en: "Selected plan", ru: "Выбранный план", bg: "Избран план" })}</span>
                <strong>
                  {translateKnownTemplateText(
                    importedPlanDraft?.title ??
                      (isTemplateDraftActive ? planForm.name : activePlanTemplate?.name ?? planForm.name),
                    language,
                  )}
                </strong>
                <small>
                  {selectedTemplateAssignmentCount}{" "}
                  {copyFor(language, {
                    en: "training day(s) will be assigned",
                    ru: "тренировочных дн. к назначению",
                    bg: "тренировъчни дни за назначаване",
                  })}
                </small>
              </div>

              <label className="field">
                <span>{t("startDate")}</span>
                <input
                  type="date"
                  value={assignedPlanForm.startDate}
                  onChange={(event) =>
                    {
                      const startDate = event.target.value;
                      setAssignedPlanForm((current) => ({
                        ...current,
                        startDate,
                      }));
                      if (canLoadCoachScopedAthleteData(selectedAthleteId)) {
                        void loadTemplateRecommendations(
                          selectedAthleteId,
                          startDate,
                          coachAthletes,
                        );
                      }
                    }
                  }
                  required
                />
              </label>

              <label className="field">
                <span>{t("plannedPhase")}</span>
                <select
                  value={assignedPlanForm.plannedPhase ?? ""}
                  onChange={(event) =>
                    setAssignedPlanForm((current) => ({
                      ...current,
                      plannedPhase:
                        event.target.value === ""
                          ? null
                          : (event.target.value as AssignedPlanPayload["plannedPhase"]),
                    }))
                  }
                >
                  <option value="">{t("autoFromCompetitionContext")}</option>
                  {PREPARATION_PHASE_VALUES.map(
                    (phase) => (
                      <option key={phase} value={phase}>
                        {localizedOptionLabel(phase, language, PREPARATION_PHASE_LABELS)}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <div className="planning-template-mode-group">
                <span>
                  {copyFor(language, {
                    en: "Mode",
                    ru: "Режим",
                    bg: "Режим",
                  })}
                </span>
                <div className="planning-template-mode-buttons">
                  {(["full", "week", "selected"] as const).map((mode) => (
                    <button
                      className={selectedTemplateAssignMode === mode ? "is-active" : ""}
                      key={mode}
                      onClick={() => {
                        setSelectedTemplateAssignMode(mode);
                        if (mode === "selected" && selectedTemplateAssignDayIndexes.length === 0) {
                          setSelectedTemplateAssignDayIndexes([normalizedSelectedTemplateDayIndex]);
                        }
                      }}
                      type="button"
                    >
                      {mode === "full"
                        ? copyFor(language, { en: "Full plan", ru: "Весь план", bg: "Целият план" })
                        : mode === "week"
                          ? copyFor(language, { en: "Week", ru: "Неделя", bg: "Седмица" })
                          : copyFor(language, { en: "Selected days", ru: "Выбранные дни", bg: "Избрани дни" })}
                    </button>
                  ))}
                </div>
              </div>

              {selectedTemplateAssignMode === "selected" && templateWorkspaceDays.length ? (
                <div className="planning-template-selected-days">
                  {templateWorkspaceDays.map((day, dayIndex) => (
                    <label key={`${day.label}-${dayIndex}`}>
                      <input
                        checked={selectedTemplateAssignDayIndexes.includes(dayIndex)}
                        onChange={(event) =>
                          setSelectedTemplateAssignDayIndexes((current) =>
                            event.target.checked
                              ? current.includes(dayIndex)
                                ? current
                                : [...current, dayIndex]
                              : current.filter((index) => index !== dayIndex),
                          )
                        }
                        type="checkbox"
                      />
                      <span>{translateKnownTemplateText(day.label, language)}</span>
                    </label>
                  ))}
                </div>
              ) : null}

              <label className="field">
                <span>{t("coachNotes")}</span>
                <input
                  value={assignedPlanForm.notes}
                  onChange={(event) =>
                    setAssignedPlanForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                />
              </label>

              <button
                className="primary-button"
                disabled={
                  busy ||
                  (!importedPlanDraft && !isTemplateDraftActive && !activePlanTemplate) ||
                  !selectedAthleteId
                }
                onClick={() =>
                  void (importedPlanDraft ? handleAssignImportedPlan() : handleAssignActivePlanTemplate())
                }
                type="button"
              >
                {busy
                  ? ui("assigning")
                  : copyFor(language, {
                      en: "Assign plan",
                      ru: "Назначить план",
                      bg: "Назначи план",
                    })}
              </button>
              <button
                className="secondary-button"
                disabled={busy || !templateWorkspaceDays.length}
                onClick={() => void handleSaveCurrentPlanTemplate()}
                type="button"
              >
                {copyFor(language, {
                  en: "Save to library",
                  ru: "Сохранить в библиотеку",
                  bg: "Запази в библиотеката",
                })}
              </button>

              <div className="planning-template-assignment-note">
                {copyFor(language, {
                  en: "After assignment, the athlete will see the days and exercises in the mobile app.",
                  ru: "После назначения спортсмен увидит дни и упражнения в мобильном приложении.",
                  bg: "След назначаване спортистът ще вижда дните и упражненията в мобилното приложение.",
                })}
              </div>
            </aside>
            ) : null}

            {planningView === "weekly" ? (
            <form className="auth-form wide-form planning-main-form planning-weekly-form" onSubmit={handleAutoAssignMicrocycleSubmit}>
              <h3>
                {copyFor(language, {
                  en: "Weekly plan",
                  ru: "Недельный план",
                  bg: "Седмичен план",
                })}
              </h3>
              <div className="planning-weekly-stage">
                <div className="entry-summary planning-weekly-pack-card">
                  <div className="summary-topline">
                    <strong>
                      {copyFor(language, {
                        en: "Recommended week",
                        ru: "Рекомендованная неделя",
                        bg: "Препоръчана седмица",
                      })}
                    </strong>
                    <span>{templatePack?.suggestedDays ?? 0}</span>
                  </div>
                  {templatePack ? (
                    <>
                      <p>
                        {t("phase")}{" "}
                        {localizedOptionLabel(
                          templatePack.phase,
                          language,
                          PREPARATION_PHASE_LABELS,
                        )}{" "}
                        / {t("priority")} {templatePack.competitionPriority ?? t("allPriorities")} /{" "}
                        {copyFor(language, {
                          en: "total planned load",
                          ru: "общая плановая нагрузка",
                          bg: "общо планирано натоварване",
                        })}{" "}
                        {templatePack.totalPlannedLoad}
                        {templatePack.targetLoadDelta !== null
                          ? ` / ${copyFor(language, {
                              en: "target delta",
                              ru: "отклонение от цели",
                              bg: "отклонение от целта",
                            })} ${templatePack.targetLoadDelta}`
                          : ""}
                      </p>
                      <div className="context-chip-grid">
                        <article className="context-chip">
                          <span>
                            {copyFor(language, {
                              en: "Variety",
                              ru: "Вариативность",
                              bg: "Вариативност",
                            })}
                          </span>
                          <strong>{templatePack.varietyScore}</strong>
                        </article>
                        <article className="context-chip">
                          <span>
                            {copyFor(language, {
                              en: "Balance",
                              ru: "Баланс",
                              bg: "Баланс",
                            })}
                          </span>
                          <strong>
                            {localizedPlannerLoadBalanceLabel(templatePack.loadBalanceLabel, language)}
                          </strong>
                        </article>
                        <article className="context-chip">
                          <span>
                            {copyFor(language, {
                              en: "Nearby days",
                              ru: "Ближайшие дни",
                              bg: "Близки дни",
                            })}
                          </span>
                          <strong>{templatePack.nearbyAssignedDays}</strong>
                        </article>
                        <article className="context-chip">
                          <span>
                            {copyFor(language, {
                              en: "Pack slots",
                              ru: "Слоты пакета",
                              bg: "Слотове в пакета",
                            })}
                          </span>
                          <strong>{templatePack.items.length}</strong>
                        </article>
                      </div>
                      {templatePackHistorySummary ? (
                        <div className="planner-pack-intelligence-grid">
                          <article className="planner-pack-intelligence-card">
                            <span>
                              {copyFor(language, {
                                en: "History-informed slots",
                                ru: "Слоты с историей решений",
                                bg: "Слотове с история на решенията",
                              })}
                            </span>
                            <strong>
                              {templatePackHistorySummary.informedSlots}/{templatePack.items.length}
                            </strong>
                            <small>
                              {copyFor(language, {
                                en: "Templates already influenced by coach outcome history.",
                                ru: "Шаблоны уже учитывают историю исходов coach-решений.",
                                bg: "Шаблоните вече отчитат историята на coach решенията.",
                              })}
                            </small>
                          </article>
                          <article className="planner-pack-intelligence-card">
                            <span>
                              {copyFor(language, {
                                en: "Positive boosts",
                                ru: "Позитивные усиления",
                                bg: "Положителни усилвания",
                              })}
                            </span>
                            <strong>{templatePackHistorySummary.boostSignals}</strong>
                            <small>
                              {copyFor(language, {
                                en: "Patterns that pushed the pack toward proven template choices.",
                                ru: "Паттерны, которые усилили выбор проверенных шаблонов.",
                                bg: "Патерни, които подсилиха избора на доказани шаблони.",
                              })}
                            </small>
                          </article>
                          <article className="planner-pack-intelligence-card">
                            <span>
                              {copyFor(language, {
                                en: "Exact-context hits",
                                ru: "Совпадения точного контекста",
                                bg: "Съвпадения по точен контекст",
                              })}
                            </span>
                            <strong>{templatePackHistorySummary.exactContextSignals}</strong>
                            <small>
                              {copyFor(language, {
                                en: "Signals coming from the same phase and competition priority.",
                                ru: "Сигналы из той же фазы и того же приоритета соревнования.",
                                bg: "Сигнали от същата фаза и същия приоритет на състезанието.",
                              })}
                            </small>
                          </article>
                          <article className="planner-pack-intelligence-card caution">
                            <span>
                              {copyFor(language, {
                                en: "Caution signals",
                                ru: "Сигналы осторожности",
                                bg: "Сигнали за внимание",
                              })}
                            </span>
                            <strong>{templatePackHistorySummary.cautionSignals}</strong>
                            <small>
                              {copyFor(language, {
                                en: "History that warned the planner away from weaker template paths.",
                                ru: "История, которая отвела планировщик от более слабых шаблонных веток.",
          bg: "История, която отклони планирането от по-слабите шаблонни пътища.",
                              })}
                            </small>
                          </article>
                        </div>
                      ) : null}
                      {templatePack.mesocycleWeek ? (
                        <p>
                          {copyFor(language, {
                            en: "Mesocycle",
                            ru: "Мезоцикл",
                            bg: "Мезоцикъл",
                          })}:{" "}
                          {translateKnownMesocycleText(
                            templatePack.mesocycleWeek.mesocycleName,
                            language,
                          )}{" "}
                          / {localizedWeekLabel(templatePack.mesocycleWeek.weekLabel, language)} /{" "}
                          {localizedOptionLabel(
                            templatePack.mesocycleWeek.microcycleType,
                            language,
                            MICROCYCLE_TYPE_LABELS,
                          )}{" "}
                          / {copyFor(language, {
                            en: "target load",
                            ru: "целевая нагрузка",
                            bg: "целева натовареност",
                          })}{" "}
                          {templatePack.mesocycleWeek.targetLoad} /{" "}
                          {copyFor(language, {
                            en: "modifier",
                            ru: "модификатор",
                            bg: "модификатор",
                          })}{" "}
                          {templatePack.mesocycleWeek.loadModifier}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="placeholder-copy">
                      {copyFor(language, {
                        en: "Select an athlete in the top menu and set the week start date.",
                        ru: "Выберите спортсмена в верхнем меню и задайте дату начала недели.",
                        bg: "Изберете спортист от горното меню и задайте началната дата на седмицата.",
                      })}
                    </p>
                  )}
                </div>

                <div className="planning-weekly-grid">
                  <div className="entry-summary planning-weekly-signal-card">
                    <div className="summary-topline">
                      <strong>
                        {copyFor(language, {
                          en: "Coach warnings",
                          ru: "Предупреждения тренеру",
                          bg: "Предупреждения за треньора",
                        })}
                      </strong>
                      <span>{templatePack?.warnings?.length ?? 0}</span>
                    </div>
                    {templatePack?.warnings?.length ? (
                      <ul>
                        {templatePack.warnings.map((warning) => (
                          <li key={`${warning.code}-${warning.message}`}>
                            {localizedPlannerWarningLevel(warning.level, language)}:{" "}
                            {localizedPlannerWarningMessage(warning, language)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="placeholder-copy">
                        {copyFor(language, {
                          en: "No planner warnings right now.",
                          ru: "Сейчас нет предупреждений планировщика.",
                          bg: "В момента няма предупреждения от планировчика.",
                        })}
                      </p>
                    )}

                    <div className="summary-topline">
                      <strong>
                        {copyFor(language, {
                          en: "Coach suggestions",
                          ru: "Советы тренеру",
                          bg: "Предложения за треньора",
                        })}
                      </strong>
                      <span>{templatePack?.suggestions?.length ?? 0}</span>
                    </div>
                    {templatePack?.suggestions?.length ? (
                      <ul className="planner-suggestion-list">
                        {templatePack.suggestions.map((suggestion) => {
                          const suggestionDetails = localizedPlannerSuggestionDetails(
                            suggestion,
                            language,
                            templatePack,
                            planTemplates,
                          );

                          return (
                            <li
                              className="planner-suggestion-item"
                              key={`${suggestion.code}-${suggestion.dayOffset}-${suggestion.targetDayOffset}-${suggestion.recommendedTemplateId}`}
                            >
                              <div className="planner-suggestion-copy">
                                <span>{localizedPlannerSuggestionMessage(suggestion, language)}</span>
                                {suggestionDetails.length ? (
                                  <ul className="planner-suggestion-details">
                                    {suggestionDetails.map((detail, detailIndex) => (
                                      <li key={`${suggestion.code}-${detailIndex}`}>{detail}</li>
                                    ))}
                                  </ul>
                                ) : null}
                                {suggestion.recommendedTemplateName ? (
                                  <small>
                                    {copyFor(language, {
                                      en: `Recommended template: ${translateKnownTemplateText(
                                        suggestion.recommendedTemplateName,
                                        language,
                                      )}.`,
                                      ru: `Рекомендованный шаблон: ${translateKnownTemplateText(
                                        suggestion.recommendedTemplateName,
                                        language,
                                      )}.`,
                                      bg: `Препоръчан шаблон: ${translateKnownTemplateText(
                                        suggestion.recommendedTemplateName,
                                        language,
                                      )}.`,
                                    })}
                                  </small>
                                ) : null}
                                {suggestion.feedback ? (
                                  <small
                                    className={`planner-feedback-badge ${suggestion.feedback.label}`}
                                  >
                                    {plannerSuggestionFeedbackSummary(suggestion.feedback)}
                                  </small>
                                ) : null}
                              </div>
                              <button
                                className="secondary-button"
                                disabled={busy}
                                onClick={() => handleApplyPlannerSuggestion(suggestion)}
                                type="button"
                              >
                                {copyFor(language, {
                                  en: "Apply suggestion",
                                  ru: "Применить совет",
                                  bg: "Приложи предложението",
                                })}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="placeholder-copy">
                        {copyFor(language, {
                          en: "No automatic coach suggestions yet.",
                          ru: "Автоматических советов тренеру пока нет.",
                          bg: "Все още няма автоматични предложения за треньора.",
                        })}
                      </p>
                    )}
                  </div>

                  <div className="entry-summary planning-weekly-nearby-card">
                    <div className="summary-topline">
                      <strong>
                        {copyFor(language, {
                          en: "Nearby assigned days",
                          ru: "Ближайшие назначенные дни",
                          bg: "Близки назначени дни",
                        })}
                      </strong>
                      <span>{templatePack?.nearbyAssignedPlanSummaries?.length ?? 0}</span>
                    </div>
                    {templatePack?.nearbyAssignedPlanSummaries?.length ? (
                      <ul>
                        {templatePack.nearbyAssignedPlanSummaries.map((day) => (
                          <li key={`${day.assignedPlanId}-${day.date}`}>
                            {day.date}: {translateKnownTemplateText(day.templateName, language)} /{" "}
                            {t("phase")}{" "}
                            {localizedOptionLabel(
                              day.plannedPhase,
                              language,
                              PREPARATION_PHASE_LABELS,
                            )}{" "}
                            / {copyFor(language, {
                              en: "load",
                              ru: "нагрузка",
                              bg: "натоварване",
                            })}{" "}
                            {day.estimatedLoad}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="placeholder-copy">
                        {copyFor(language, {
                          en: "No nearby assigned days were detected.",
                          ru: "Ближайшие назначенные дни не найдены.",
                          bg: "Не са открити близки назначени дни.",
                        })}
                      </p>
                    )}

                    <div className="summary-topline">
                      <strong>
                        {copyFor(language, {
                          en: "Recommended days",
                          ru: "Рекомендованные дни",
                          bg: "Препоръчани дни",
                        })}
                      </strong>
                      <span>{templatePack?.items?.length ?? 0}</span>
                    </div>
                    {templatePack?.items?.length ? (
                      <div className="planner-pack-days-grid">
                        {templatePack.items.map((item) => (
                          <article
                            className="planner-pack-day-card"
                            key={`${item.dayOffset}-${item.templateId}`}
                          >
                            <div className="planner-pack-day-header">
                              <div className="planner-pack-day-copy">
                                <span className="planner-pack-day-label">
                                  {localizedPlannerDayLabel(item.dayLabel, language)}
                                </span>
                                <strong>{translateKnownTemplateText(item.templateName, language)}</strong>
                                <small>
                                  {localizedOptionLabel(
                                    item.microcycleType,
                                    language,
                                    MICROCYCLE_TYPE_LABELS,
                                  )}
                                </small>
                              </div>
                              <div className="planner-pack-day-metrics">
                                <strong>
                                  {copyFor(language, {
                                    en: `Load ${item.estimatedLoad}`,
                                    ru: `Нагрузка ${item.estimatedLoad}`,
                                    bg: `Натоварване ${item.estimatedLoad}`,
                                  })}
                                </strong>
                                <span>
                                  {copyFor(language, {
                                    en: `Score ${item.score}`,
                                    ru: `Оценка ${item.score}`,
                                    bg: `Оценка ${item.score}`,
                                  })}
                                </span>
                              </div>
                            </div>

                            {item.historyBiases.length ? (
                              <div className="planner-pack-history-list">
                                {item.historyBiases.map((bias, index) => (
                                  <article
                                    className={`planner-pack-history-chip ${bias.effect}`}
                                    key={`${item.templateId}-${bias.code}-${bias.action}-${index}`}
                                  >
                                    <span>{plannerHistoryBiasEffectLabel(bias)}</span>
                                    <strong>{plannerHistoryBiasAction(bias)}</strong>
                                    <small>{plannerHistoryBiasSummary(bias)}</small>
                                  </article>
                                ))}
                              </div>
                            ) : (
                              <p className="planner-pack-rationale planner-pack-rationale-muted">
                                {copyFor(language, {
                                  en: "No strong historical bias was needed for this slot, so the choice stayed mostly phase/load-driven.",
        ru: "Для этого слота не понадобилась сильная историческая поправка, поэтому выбор остался в основном завязанным на фазу и нагрузку.",
        bg: "За този слот не беше нужна силна историческа корекция, така че изборът остана основно според фазата и натоварването.",
                                })}
                              </p>
                            )}

                            <p className="planner-pack-rationale">
                              <span>
                                {copyFor(language, {
                                  en: "Why chosen",
                                  ru: "Почему выбран",
                                  bg: "Защо е избран",
                                })}
                              </span>
                              <strong>{localizedPlannerReason(item.reason, language)}</strong>
                            </p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="placeholder-copy">
                        {copyFor(language, {
                          en: "No recommended days are loaded yet.",
                          ru: "Рекомендованные дни пока не загружены.",
                          bg: "Все още няма заредени препоръчани дни.",
                        })}
                      </p>
                    )}
                  </div>
                </div>

                <div className="planning-weekly-controls">
                  <div className="planning-weekly-athlete-chip" aria-live="polite">
                    <span>{t("athlete")}</span>
                    <strong>{weeklyPlanAthlete?.fullName ?? ui("selectAthlete")}</strong>
                    <small>
                      {weeklyPlanAthlete
                        ? copyFor(language, {
                            en: "Active athlete for this week",
                            ru: "Активный спортсмен недели",
                            bg: "Активен спортист за седмицата",
                          })
                        : copyFor(language, {
                            en: "Select an athlete above first",
                            ru: "Сначала выберите спортсмена сверху",
                            bg: "Първо изберете спортист горе",
                          })}
                    </small>
                  </div>

                  <label className="field">
                    <span>{t("startDate")}</span>
                    <input
                      type="date"
                      value={microcycleForm.startDate}
                      onChange={(event) => {
                        const startDate = event.target.value;
                        setMicrocycleForm((current) => ({ ...current, startDate }));
                        if (canLoadCoachScopedAthleteData(microcycleForm.athleteId)) {
                          void loadTemplatePackRecommendations(
                            microcycleForm.athleteId,
                            startDate,
                            coachAthletes,
                          );
                        }
                      }}
                      required
                    />
                  </label>

                  <label className="field">
                    <span>
                      {copyFor(language, {
                        en: "Days count",
                        ru: "Количество дней",
                        bg: "Брой дни",
                      })}
                    </span>
                    <input
                      type="number"
                      min="1"
                      max="14"
                      value={microcycleForm.daysCount}
                      onChange={(event) =>
                        setMicrocycleForm((current) => ({
                          ...current,
                          daysCount: Number(event.target.value),
                        }))
                      }
                    />
                  </label>

                  <label className="field">
                    <span>{t("plannedPhase")}</span>
                    <select
                      value={microcycleForm.plannedPhase ?? ""}
                      onChange={(event) =>
                        setMicrocycleForm((current) => ({
                          ...current,
                          plannedPhase:
                            event.target.value === ""
                              ? null
                              : (event.target.value as AutoAssignMicrocyclePayload["plannedPhase"]),
                        }))
                      }
                    >
                      <option value="">{t("autoFromCompetitionContext")}</option>
                  {PREPARATION_PHASE_VALUES.map(
                        (phase) => (
                          <option key={phase} value={phase}>
                            {localizedOptionLabel(phase, language, PREPARATION_PHASE_LABELS)}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label className="field planning-weekly-notes">
                    <span>{t("coachNotes")}</span>
                    <input
                      value={microcycleForm.notes}
                      onChange={(event) =>
                        setMicrocycleForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <button className="primary-button planning-weekly-submit" disabled={busy || !weeklyPlanAthleteId} type="submit">
                    {busy
                      ? ui("syncingNow")
                      : copyFor(language, {
                          en: "Assign weekly plan",
                          ru: "Назначить недельный план",
                          bg: "Назначи седмичен план",
                        })}
                  </button>
                </div>
              </div>
            </form>
            ) : null}

            {planningView === "weekly" ? (
            <div className="entry-summary wide-card planning-review-card">
                <div className="summary-topline">
                <strong>
                  {copyFor(language, {
                    en: "Assigned plans",
                    ru: "Назначенные планы",
                    bg: "Назначени планове",
                  })}
                </strong>
                <span>{assignedPlans.length}</span>
              </div>
              {assignedPlans.length === 0 ? (
                <p className="placeholder-copy">
                  {ui("noActiveAssignments")}
                </p>
              ) : (
                <div className="planning-assigned-plan-list">
                  <div className="planning-assigned-delete-bar">
                    <label className="planning-assigned-select planning-assigned-select-all">
                      <input
                        checked={allAssignedPlansSelected}
                        onChange={(event) =>
                          setSelectedAssignedPlanIds(
                            event.target.checked ? assignedPlans.map((plan) => plan.id) : [],
                          )
                        }
                        type="checkbox"
                      />
                      <span>
                        {copyFor(language, {
                          en: "Select all",
                          ru: "Выбрать все",
                          bg: "Избери всички",
                        })}
                      </span>
                    </label>
                    <span className="planning-assigned-selected-count">
                      {copyFor(language, {
                        en: `${selectedAssignedPlanCount} selected`,
                        ru: `Выбрано: ${selectedAssignedPlanCount}`,
                        bg: `Избрани: ${selectedAssignedPlanCount}`,
                      })}
                    </span>
                    <div className="planning-assigned-delete-actions">
                      <button
                        className="planning-template-delete-button"
                        disabled={busy || selectedAssignedPlanCount === 0}
                        onClick={() => void handleDeleteSelectedAssignedPlans()}
                        type="button"
                      >
                        {copyFor(language, {
                          en: "Delete selected",
                          ru: "Удалить выбранные",
                          bg: "Изтрий избраните",
                        })}
                      </button>
                      <button
                        className="planning-assigned-clear-button"
                        disabled={busy || selectedAssignedPlanCount === 0}
                        onClick={() => setSelectedAssignedPlanIds([])}
                        type="button"
                      >
                        {copyFor(language, {
                          en: "Clear",
                          ru: "Снять выбор",
                          bg: "Изчисти",
                        })}
                      </button>
                    </div>
                  </div>
                  {assignedPlans.map((plan) => (
                    <details className="planning-assigned-plan-card" key={plan.id}>
                      <summary>
                        <label
                          className="planning-assigned-select"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            checked={selectedAssignedPlanIds.includes(plan.id)}
                            onChange={(event) =>
                              setSelectedAssignedPlanIds((current) =>
                                event.target.checked
                                  ? current.includes(plan.id)
                                    ? current
                                    : [...current, plan.id]
                                  : current.filter((id) => id !== plan.id),
                              )
                            }
                            type="checkbox"
                          />
                          <span>
                            {copyFor(language, {
                              en: "Delete",
                              ru: "Удалить",
                              bg: "Изтрий",
                            })}
                          </span>
                        </label>
                        <div className="planning-assigned-plan-summary-copy">
                          <strong>
                            {plan.athleteName}: {translateKnownTemplateText(plan.templateName, language)}
                          </strong>
                          <span>
                            {plan.day.dayDate} / {localizedPlannerDayLabel(plan.day.label, language)} / {t("phase")}{" "}
                            {plan.plannedPhase
                              ? localizedOptionLabel(
                                  plan.plannedPhase,
                                  language,
                                  PREPARATION_PHASE_LABELS,
                                )
                              : copyFor(language, {
                                  en: "Auto",
                                  ru: "Авто",
                                  bg: "Авто",
                                })}
                          </span>
                        </div>
                      </summary>
                      <div className="planning-assigned-session-list">
                        {plan.day.sessions.map((session) => (
                          <section className="planning-assigned-session" key={session.id}>
                            <strong>{session.name}</strong>
                            {session.blocks.map((block) => (
                              <div className="planning-assigned-block" key={block.id}>
                                <div>
                                  <strong>{translateKnownTemplateText(block.name, language)}</strong>
                                  <small>
                                    {localizedOptionLabel(block.blockType, language, BLOCK_TYPE_LABELS)} /{" "}
                                    {t("targetDuration")} {block.targetDurationMinutes ?? "-"} / RPE{" "}
                                    {block.targetRpe ?? "-"}
                                  </small>
                                </div>
                                {block.notes ? <p>{block.notes}</p> : null}
                                {(block.exercises ?? []).length > 0 ? (
                                  <div className="assigned-exercise-list">
                                    {(block.exercises ?? []).map((exercise) => (
                                      <div className="assigned-exercise-row" key={exercise.id}>
                                        <strong>{exercise.name}</strong>
                                        <span>{formatExerciseTarget(exercise, language)}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </section>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
            ) : null}
            </div>
          </PlanningStudio>
          </PlanningStudioScene>
      ) : null}
          </div>
        </div>

        {!isAthleteSceneWorkspace && !isCoachSceneWorkspace ? (
          <WorkspaceContextDock>
            <WorkspaceContextSection
              className={!user && isAthleteSceneWorkspace ? "workspace-context-access" : undefined}
            >
              <div className="summary-topline">
                <strong>
                  {language === "ru"
                    ? "Контекст"
                    : language === "bg"
                      ? "Контекст"
                      : "Context"}
                </strong>
                <span>{activeWorkspaceItem.label}</span>
              </div>
              <div className="context-chip-grid">
                <article className="context-chip">
                  <span>
                    {language === "ru"
                      ? "Фаза"
                      : language === "bg"
                        ? "Фаза"
                        : "Phase"}
                  </span>
                  <strong>{activePhaseLabel}</strong>
                </article>
                <article className="context-chip">
                  <span>
                    {language === "ru"
                      ? "Приоритет"
                      : language === "bg"
                        ? "Приоритет"
                        : "Priority"}
                  </span>
                  <strong>{competitionContext?.competitionPriority ?? "-"}</strong>
                </article>
                <article className="context-chip">
                  <span>
                    {language === "ru"
                      ? "До старта"
                      : language === "bg"
                        ? "До старт"
                        : "Days to comp"}
                  </span>
                  <strong>{competitionContext?.daysToCompetition ?? "-"}</strong>
                </article>
                <article className="context-chip">
                  <span>{stateLabelText}</span>
                  <strong>{importedSyncStateLabel(language, isOffline, offlineQueueSize)}</strong>
                </article>
              </div>
            </WorkspaceContextSection>

            {!isCoachSceneWorkspace ? (
              <WorkspaceContextSection>
                <div className="summary-topline">
                  <strong>
                    {activeWorkspace === "offline-center"
                      ? ui("pendingItems")
                      : activeWorkspace === "planning-studio"
                        ? warningsLabel
                        : language === "ru"
                          ? "Сегодня"
                          : language === "bg"
                            ? "Днес"
                            : "Today"}
                  </strong>
                  <span>
                    {activeWorkspace === "offline-center"
                      ? offlineQueueSize
                      : activeWorkspace === "planning-studio"
                        ? templatePack?.warnings?.length ?? 0
                        : activeAthleteTrainingDayLabel}
                  </span>
                </div>

                {isAthleteSceneWorkspace ? (
                  <>
                    <p className="placeholder-copy">
                      {adaptedPlan
                        ? adaptedPlan.explanation
                            .slice(0, 2)
                            .map((item) => translateAdaptationText(item, language))
                            .join(" ")
                        : ui("noAdaptationYet")}
                    </p>
                    <ul>
                      <li>{t("assignedTrainingDay")}: {activeAthleteTrainingDayLabel}</li>
                      <li>{t("executionTracking")}: {executionResults.filter((item) => item.completed).length}</li>
                      <li>{t("analytics")}: {analyticsOverview?.loadTrend.length ?? 0}</li>
                    </ul>
                  </>
                ) : null}

                {activeWorkspace === "offline-center" ? (
                  offlineQueueItems.length === 0 ? (
                    <p className="placeholder-copy">{ui("queueEmpty")}</p>
                  ) : (
                    <ul>
                      {offlineQueueItems.slice(0, 5).map((item) => (
                        <li key={item.id}>
                          {importedFormatQueueItemLabel(item, language)}{" "}
                          {offlineSyncErrors[item.id]
                            ? `- ${offlineSyncErrors[item.id]}`
                            : `- ${importedQueueItemStatusLabel(item, language)}`}
                        </li>
                      ))}
                    </ul>
                  )
                ) : null}

                {activeWorkspace === "planning-studio" ? (
                  templatePack?.warnings?.length ? (
                    <ul>
                      {templatePack.warnings.slice(0, 5).map((warning) => (
                        <li key={`${warning.code}-${warning.message}`}>
                          {localizedPlannerWarningLevel(warning.level, language)}:{" "}
                          {localizedPlannerWarningMessage(warning, language)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="placeholder-copy">
                      {language === "ru"
          ? "Предупреждения планирования появятся после подбора недельного пакета."
        : language === "bg"
          ? "Предупрежденията на планирането ще се покажат след избор на седмичния пакет."
                          : "Planner intelligence warnings appear after building a weekly pack."}
                    </p>
                  )
                ) : null}
              </WorkspaceContextSection>
            ) : null}

            {!user ? (
              <WorkspaceContextSection>
                <div className="summary-topline">
                  <strong>
                    {copyFor(language, {
                      en: "Access",
                      ru: "Доступ",
                      bg: "Достъп",
                    })}
                  </strong>
                  <span>{ui("guest")}</span>
                </div>
                <p className="placeholder-copy">
                  {copyFor(language, {
                    en: "Use Sign in or Register in the top bar to open the access form.",
                    ru: "Используйте Войти или Регистрация в верхнем меню, чтобы открыть форму доступа.",
                    bg: "Използвайте Вход или Регистрация в горното меню, за да отворите формата за достъп.",
                  })}
                </p>
              </WorkspaceContextSection>
            ) : null}
          </WorkspaceContextDock>
        ) : null}
      </div>
    </main>
  );
}


