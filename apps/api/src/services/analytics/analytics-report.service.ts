import type {
  AnalyticsOverview,
  CompetitionPriority,
  PreparationPhase,
} from "@training-platform/shared";
import {
  buildAnalyticsChain,
  pickCompetitionPlan,
  pickMesocycle,
  pickSeason,
} from "../../domain/analytics/competition-review.policy";
import {
  buildAnalyticsCoachActionSnapshot,
  buildAnalyticsCoachActionSnapshotFromOverview,
  buildCoachSuggestions,
  buildPlannerSuggestionFeedbackIndexFromDecisions,
  hydrateDecisionHistory,
  linkCoachSuggestionsWithHistory,
} from "../../domain/analytics/analytics-decision.policy";
import {
  buildBlockTypeWeekStats,
  buildInsights,
  buildPatterns,
  buildWeekFrame,
  buildWeekSummary,
} from "../../domain/analytics/load-trend.policy";
import {
  buildCompletionTrend,
  buildExecutionTrendMaps,
  buildLoadTrend,
  buildReadinessTrend,
  buildWeightTrend,
  toDateKey,
} from "../../domain/analytics/readiness-trend.policy";
import {
  getCompetitionContextForAthlete,
  listCompetitionPlans,
} from "../competition/competition-query.service";
import {
  getMesocycleWeekContextForDate,
  listMesocycles,
} from "../competition/mesocycle.service";
import { listSeasons } from "../competition/season.service";
import {
  buildAnalyticsOverviewSourceFingerprint,
  getCachedAnalyticsOverview,
  getAnalyticsAthlete,
  listAnalyticsCoachActionDecisions,
  listAnalyticsCoachActionDecisionsForWindow,
  listAnalyticsExecutionRows,
  listAnalyticsReadinessRows,
  saveCachedAnalyticsOverview,
  listTrainingLoadLogRows,
  listWeightLogRows,
} from "./analytics-query.service";

export {
  buildAnalyticsCoachActionSnapshotFromOverview,
} from "../../domain/analytics/analytics-decision.policy";

const ANALYTICS_OVERVIEW_CACHE_SCHEMA_VERSION = "analytics-overview-v2";

export async function buildAnalyticsOverviewForAthlete(
  athleteId: string,
  referenceDate: string | Date = new Date(),
): Promise<AnalyticsOverview | null> {
  const referenceDateText = toDateKey(referenceDate);
  const sourceFingerprint = await buildAnalyticsOverviewSourceFingerprint(
    athleteId,
    referenceDateText,
    ANALYTICS_OVERVIEW_CACHE_SCHEMA_VERSION,
  );
  const cachedOverview = await getCachedAnalyticsOverview({
    athleteId,
    referenceDateText,
    sourceFingerprint,
  });

  if (cachedOverview) {
    return cachedOverview;
  }

  const analyticsOverview = await buildAnalyticsOverviewForAthleteFromSources(
    athleteId,
    referenceDateText,
  );

  if (analyticsOverview) {
    await saveCachedAnalyticsOverview({
      athleteId,
      referenceDateText,
      sourceFingerprint,
      overview: analyticsOverview,
    });
  }

  return analyticsOverview;
}

async function buildAnalyticsOverviewForAthleteFromSources(
  athleteId: string,
  referenceDateText: string,
): Promise<AnalyticsOverview | null> {
  const [
    athlete,
    readinessRows,
    weightLogRows,
    executionRows,
    trainingLoadRows,
    competitionContext,
    mesocycleWeek,
    seasons,
    mesocycles,
    competitionPlans,
    decisions,
  ] = await Promise.all([
    getAnalyticsAthlete(athleteId),
    listAnalyticsReadinessRows(athleteId, referenceDateText),
    listWeightLogRows(athleteId, referenceDateText),
    listAnalyticsExecutionRows(athleteId, referenceDateText),
    listTrainingLoadLogRows(athleteId, referenceDateText),
    getCompetitionContextForAthlete(athleteId, referenceDateText),
    getMesocycleWeekContextForDate(athleteId, referenceDateText),
    listSeasons(athleteId),
    listMesocycles(athleteId),
    listCompetitionPlans(athleteId),
    listAnalyticsCoachActionDecisions(athleteId),
  ]);

  if (!athlete) {
    return null;
  }

  const readinessTrend = buildReadinessTrend(readinessRows);
  const weightTrend = buildWeightTrend(weightLogRows, athlete.baselineWeightKg);
  const groupedByDate = buildExecutionTrendMaps(executionRows);
  const completionTrend = buildCompletionTrend(groupedByDate, referenceDateText);
  const fallbackLoadTrend = buildLoadTrend(groupedByDate, referenceDateText);
  const loggedLoadTrend = trainingLoadRows
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((row) => ({
      date: row.date,
      plannedLoad: row.plannedLoad,
      actualLoad: row.actualLoad,
      loadDelta: Number((row.actualLoad - row.plannedLoad).toFixed(1)),
      averageRpe: row.actualRpe,
      totalDurationMinutes: row.actualDurationMinutes ?? 0,
    }));
  const loadTrend =
    loggedLoadTrend.length > 0
      ? Array.from(
          new Set([
            ...fallbackLoadTrend.map((point) => point.date),
            ...loggedLoadTrend.map((point) => point.date),
          ]),
        )
          .sort((left, right) => left.localeCompare(right))
          .slice(-14)
          .map((date) => {
            const fallbackPoint = fallbackLoadTrend.find((point) => point.date === date);
            const loggedPoint = loggedLoadTrend.find((point) => point.date === date);

            if (!loggedPoint) {
              return fallbackPoint!;
            }

            const plannedLoad =
              loggedPoint.plannedLoad > 0
                ? loggedPoint.plannedLoad
                : fallbackPoint?.plannedLoad ?? 0;

            return {
              ...loggedPoint,
              plannedLoad,
              loadDelta: Number((loggedPoint.actualLoad - plannedLoad).toFixed(1)),
              averageRpe: loggedPoint.averageRpe ?? fallbackPoint?.averageRpe ?? null,
              totalDurationMinutes:
                loggedPoint.totalDurationMinutes || fallbackPoint?.totalDurationMinutes || 0,
            };
          })
      : fallbackLoadTrend;
  const activeSeason = pickSeason(seasons, referenceDateText);
  const activeMesocycle = pickMesocycle(
    mesocycles,
    referenceDateText,
    mesocycleWeek,
    competitionContext,
  );
  const activeCompetitionPlan = pickCompetitionPlan(
    competitionPlans,
    referenceDateText,
    competitionContext,
    activeMesocycle,
  );
  const weekFrame = buildWeekFrame({
    referenceDate: referenceDateText,
    groupedByDate,
    mesocycleWeek,
  });
  const weekSummary = buildWeekSummary({
    readinessTrend,
    loadTrend,
    mesocycleWeek,
    frame: weekFrame,
  });
  const chain = buildAnalyticsChain({
    activeSeason,
    activeCompetitionPlan,
    competitionContext,
    activeMesocycle,
    mesocycleWeek,
    weekSummary,
  });
  const blockTypeStats = buildBlockTypeWeekStats(weekFrame.days);
  const insights = buildInsights({
    competitionContext,
    chain,
    readinessTrend,
    completionTrend,
    loadTrend,
  });
  const patterns = buildPatterns({
    competitionContext,
    chain,
    readinessTrend,
    weekFrame,
    weekSummary,
    blockTypeStats,
  });
  const coachSuggestions = buildCoachSuggestions({
    athleteId,
    chain,
    insights,
    patterns,
  });
  const currentSnapshot = buildAnalyticsCoachActionSnapshot({
    chain,
    readinessTrend,
    completionTrend,
    loadTrend,
  });
  const activeSourceCodes = new Set<string>([
    ...insights.map((insight) => insight.code),
    ...patterns.map((pattern) => pattern.code),
  ]);
  const decisionHistory = hydrateDecisionHistory({
    decisions,
    currentSnapshot,
    activeSourceCodes,
    referenceDateText,
  });

  return {
    athleteId,
    athleteName: athlete.athleteName,
    readinessTrend,
    weightTrend,
    completionTrend,
    loadTrend,
    chain,
    insights,
    patterns,
    coachSuggestions: linkCoachSuggestionsWithHistory(coachSuggestions, decisionHistory),
    decisionHistory,
  };
}

export async function buildPlannerSuggestionFeedbackIndex(input: {
  athleteId: string;
  phase: PreparationPhase | null;
  competitionPriority: CompetitionPriority | null;
  horizonDays?: number;
}) {
  const decisions = await listAnalyticsCoachActionDecisionsForWindow({
    athleteId: input.athleteId,
    horizonDays: input.horizonDays ?? 365,
  });

  return buildPlannerSuggestionFeedbackIndexFromDecisions({
    decisions,
    phase: input.phase,
    competitionPriority: input.competitionPriority,
  });
}
