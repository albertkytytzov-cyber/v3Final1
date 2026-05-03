import type {
  AnalyticsChain,
  AnalyticsCoachActionDecision,
  AnalyticsCoachActionOutcome,
  AnalyticsCoachActionSnapshot,
  AnalyticsCoachSuggestion,
  AnalyticsInsight,
  AnalyticsOverview,
  AnalyticsPattern,
  AnalyticsPlannerBridge,
  CompetitionPriority,
  CompletionTrendPoint,
  LoadTrendPoint,
  PlannerSuggestion,
  PlannerSuggestionFeedback,
  PreparationPhase,
} from "@training-platform/shared";
import type { StoredAnalyticsCoachActionDecision } from "./analytics.types";
import { diffDays } from "./readiness-trend.policy";

export function buildAnalyticsCoachActionSnapshot(input: {
  chain: AnalyticsChain;
  readinessTrend: AnalyticsOverview["readinessTrend"];
  completionTrend: CompletionTrendPoint[];
  loadTrend: LoadTrendPoint[];
}): AnalyticsCoachActionSnapshot | null {
  const latestReadiness = input.readinessTrend.at(-1) ?? null;
  const latestCompletion = input.completionTrend.at(-1) ?? null;
  const latestLoad = input.loadTrend.at(-1) ?? null;
  const weekSummary = input.chain.weekSummary;

  if (!latestReadiness && !latestCompletion && !latestLoad && !weekSummary) {
    return null;
  }

  return {
    readinessScore: weekSummary?.averageReadiness ?? latestReadiness?.score ?? null,
    readinessStatus: latestReadiness?.status ?? null,
    adherenceRate: weekSummary?.adherenceRate ?? latestCompletion?.adherenceRate ?? null,
    actualLoad: weekSummary?.actualLoad ?? latestLoad?.actualLoad ?? null,
    loadDelta: weekSummary?.loadDelta ?? latestLoad?.loadDelta ?? null,
    phase:
      input.chain.mesocycleWeek?.phase ??
      input.chain.competitionContext?.phase ??
      input.chain.mesocycle?.phase ??
      null,
    competitionPriority:
      input.chain.competitionContext?.competitionPriority ??
      input.chain.competitionPlan?.priority ??
      null,
  };
}

export function scoreSnapshotDelta(
  baselineSnapshot: AnalyticsCoachActionSnapshot | null,
  latestSnapshot: AnalyticsCoachActionSnapshot | null,
) {
  if (!baselineSnapshot || !latestSnapshot) {
    return 0;
  }

  let score = 0;

  if (
    baselineSnapshot.readinessScore !== null &&
    latestSnapshot.readinessScore !== null
  ) {
    if (latestSnapshot.readinessScore >= baselineSnapshot.readinessScore + 4) {
      score += 1;
    } else if (latestSnapshot.readinessScore <= baselineSnapshot.readinessScore - 4) {
      score -= 1;
    }
  }

  if (
    baselineSnapshot.adherenceRate !== null &&
    latestSnapshot.adherenceRate !== null
  ) {
    if (latestSnapshot.adherenceRate >= baselineSnapshot.adherenceRate + 6) {
      score += 1;
    } else if (latestSnapshot.adherenceRate <= baselineSnapshot.adherenceRate - 6) {
      score -= 1;
    }
  }

  if (baselineSnapshot.loadDelta !== null && latestSnapshot.loadDelta !== null) {
    const baselineDelta = Math.abs(baselineSnapshot.loadDelta);
    const latestDelta = Math.abs(latestSnapshot.loadDelta);

    if (latestDelta + 8 <= baselineDelta) {
      score += 1;
    } else if (latestDelta >= baselineDelta + 8) {
      score -= 1;
    }
  }

  return score;
}

export function evaluateCoachActionDecision(input: {
  decision: StoredAnalyticsCoachActionDecision;
  currentSnapshot: AnalyticsCoachActionSnapshot | null;
  activeSourceCodes: Set<string>;
  referenceDateText: string;
}): Pick<
  AnalyticsCoachActionDecision,
  "outcome" | "outcomeSource" | "sourceStillActive" | "metricDeltaScore" | "latestSnapshot"
> {
  const sourceStillActive = input.activeSourceCodes.has(input.decision.sourceCode);
  const latestSnapshot = input.currentSnapshot;
  const metricDeltaScore = scoreSnapshotDelta(input.decision.baselineSnapshot, latestSnapshot);

  if (input.decision.outcomeStatus !== "pending") {
    return {
      outcome: input.decision.outcomeStatus,
      outcomeSource: "manual",
      sourceStillActive,
      metricDeltaScore,
      latestSnapshot,
    };
  }

  const daysSinceDecision = Math.max(0, diffDays(input.decision.createdAt, input.referenceDateText));

  if (!input.decision.baselineSnapshot || !latestSnapshot || daysSinceDecision < 2) {
    return {
      outcome: "pending",
      outcomeSource: "pending",
      sourceStillActive,
      metricDeltaScore,
      latestSnapshot,
    };
  }

  let outcome: AnalyticsCoachActionOutcome = "neutral";

  if (input.decision.decisionStatus === "applied") {
    if (!sourceStillActive && metricDeltaScore >= 1) {
      outcome = "positive";
    } else if (sourceStillActive && metricDeltaScore <= -1) {
      outcome = "negative";
    } else if (!sourceStillActive || metricDeltaScore >= 0) {
      outcome = "neutral";
    } else {
      outcome = "negative";
    }
  } else if (sourceStillActive && metricDeltaScore <= 0) {
    outcome = "negative";
  } else if (!sourceStillActive && metricDeltaScore >= 1) {
    outcome = "positive";
  } else {
    outcome = "neutral";
  }

  return {
    outcome,
    outcomeSource: "automatic",
    sourceStillActive,
    metricDeltaScore,
    latestSnapshot,
  };
}

export function hydrateDecisionHistory(input: {
  decisions: StoredAnalyticsCoachActionDecision[];
  currentSnapshot: AnalyticsCoachActionSnapshot | null;
  activeSourceCodes: Set<string>;
  referenceDateText: string;
}): AnalyticsCoachActionDecision[] {
  return input.decisions.map((decision) => {
    const evaluation = evaluateCoachActionDecision({
      decision,
      currentSnapshot: input.currentSnapshot,
      activeSourceCodes: input.activeSourceCodes,
      referenceDateText: input.referenceDateText,
    });

    return {
      id: decision.id,
      athleteId: decision.athleteId,
      suggestionId: decision.suggestionId,
      suggestionTitle: decision.suggestionTitle,
      suggestionLevel: decision.suggestionLevel,
      sourceCode: decision.sourceCode,
      weekStartDate: decision.weekStartDate,
      weekLabel: decision.weekLabel,
      decisionStatus: decision.decisionStatus,
      outcome: evaluation.outcome,
      outcomeSource: evaluation.outcomeSource,
      plannerBridge: decision.plannerBridge,
      baselineSnapshot: decision.baselineSnapshot,
      latestSnapshot: evaluation.latestSnapshot,
      sourceStillActive: evaluation.sourceStillActive,
      metricDeltaScore: evaluation.metricDeltaScore,
      decisionNotes: decision.decisionNotes,
      outcomeNotes: decision.outcomeNotes,
      createdAt: decision.createdAt,
      updatedAt: decision.updatedAt,
    };
  });
}

export function buildAnalyticsCoachActionSnapshotFromOverview(
  overview: AnalyticsOverview | null,
): AnalyticsCoachActionSnapshot | null {
  if (!overview) {
    return null;
  }

  return buildAnalyticsCoachActionSnapshot({
    chain: overview.chain,
    readinessTrend: overview.readinessTrend,
    completionTrend: overview.completionTrend,
    loadTrend: overview.loadTrend,
  });
}

export function buildCoachSuggestions(input: {
  athleteId: string;
  chain: AnalyticsChain;
  insights: AnalyticsInsight[];
  patterns: AnalyticsPattern[];
}): AnalyticsCoachSuggestion[] {
  const suggestions: AnalyticsCoachSuggestion[] = [];
  const weekStart = input.chain.weekSummary?.startDate ?? input.chain.mesocycleWeek?.startDate ?? null;
  const weekLabel = input.chain.weekSummary?.label ?? input.chain.mesocycleWeek?.weekLabel ?? null;
  const plannedPhase =
    input.chain.mesocycleWeek?.phase ??
    input.chain.competitionContext?.phase ??
    input.chain.mesocycle?.phase ??
    null;

  const pushSuggestion = (suggestion: AnalyticsCoachSuggestion) => {
    if (suggestions.some((item) => item.id === suggestion.id)) {
      return;
    }

    suggestions.push(suggestion);
  };

  const insightByCode = (code: AnalyticsInsight["code"]) =>
    input.insights.find((insight) => insight.code === code) ?? null;
  const patternByCode = (code: AnalyticsPattern["code"]) =>
    input.patterns.find((pattern) => pattern.code === code) ?? null;
  const makeBridge = (config: {
    preferredSuggestionCode: AnalyticsPlannerBridge["preferredSuggestionCode"];
    preferredAction: AnalyticsPlannerBridge["preferredAction"];
    dayOffset: number | null;
    targetDayOffset?: number | null;
    autoApply?: boolean;
  }): AnalyticsPlannerBridge | null =>
    weekStart
      ? {
          athleteId: input.athleteId,
          startDate: weekStart,
          plannedPhase,
          preferredSuggestionCode: config.preferredSuggestionCode,
          preferredAction: config.preferredAction,
          dayOffset: config.dayOffset,
          targetDayOffset: config.targetDayOffset ?? null,
          autoApply: config.autoApply ?? true,
        }
      : null;

  const taperPattern = patternByCode("fatigue_block_density");
  const taperInsight = insightByCode("taper_violation");
  if (taperPattern || taperInsight) {
    pushSuggestion({
      id: "protect-taper-freshness",
      level: taperInsight?.level ?? taperPattern?.level ?? "warning",
      title: "Protect taper freshness in planner",
      summary:
        "Open the active week in planning studio and convert the flagged fatiguing slot into activation or recovery work.",
      recommendation:
        "Load the weekly planner for this week and apply the taper-safe swap on the targeted day.",
      source: taperPattern ? "pattern" : "insight",
      sourceCode: taperPattern?.code ?? taperInsight!.code,
      weekStartDate: weekStart,
      weekLabel,
      plannerBridge: makeBridge({
        preferredSuggestionCode: "activation_swap",
        preferredAction: "swap_to_activation",
        dayOffset: taperPattern?.dayOffset ?? null,
        autoApply: true,
      }),
      latestDecision: null,
    });
  }

  const recoveryPattern = patternByCode("recovery_gap");
  const fatigueInsight = insightByCode("fatigue_risk");
  if (recoveryPattern || fatigueInsight) {
    pushSuggestion({
      id: "rebalance-recovery-density",
      level: recoveryPattern?.level ?? fatigueInsight?.level ?? "warning",
      title: "Rebalance the week toward recovery",
      summary:
        "Use the weekly planner to insert more recovery-support work before fatigue accumulates further.",
      recommendation:
        "Open the current week and convert the heaviest slot into a recovery day or lighter template.",
      source: recoveryPattern ? "pattern" : "insight",
      sourceCode: recoveryPattern?.code ?? fatigueInsight!.code,
      weekStartDate: weekStart,
      weekLabel,
      plannerBridge: makeBridge({
        preferredSuggestionCode: "recover_day_swap",
        preferredAction: "swap_to_recovery",
        dayOffset: recoveryPattern?.dayOffset ?? null,
        autoApply: true,
      }),
      latestDecision: null,
    });
  }

  const specificPattern = patternByCode("specific_block_drift");
  if (specificPattern) {
    pushSuggestion({
      id: "rescue-specific-work",
      level: specificPattern.level,
      title: "Rescue the specific work slot",
      summary:
        "Specific execution is drifting, so open the planner and move or protect the targeted day before it is lost.",
      recommendation:
        "Open the active week, move the specific slot if needed, and preserve it from overlap or fatigue spillover.",
      source: "pattern",
      sourceCode: specificPattern.code,
      weekStartDate: weekStart,
      weekLabel,
      plannerBridge: makeBridge({
        preferredSuggestionCode: "move_specific_day",
        preferredAction: "move_day",
        dayOffset: specificPattern.dayOffset,
        targetDayOffset:
          specificPattern.dayOffset !== null ? specificPattern.dayOffset + 1 : null,
        autoApply: true,
      }),
      latestDecision: null,
    });
  }

  const loadSpikeInsight = insightByCode("load_spike");
  if (loadSpikeInsight) {
    pushSuggestion({
      id: "smooth-load-curve",
      level: loadSpikeInsight.level,
      title: "Smooth the weekly load curve",
      summary:
        "The active week is climbing too fast, so use the planner to reduce the heaviest slot instead of carrying the spike forward.",
      recommendation:
        "Open the weekly planner and apply a load-reduction suggestion on the overloaded day.",
      source: "insight",
      sourceCode: loadSpikeInsight.code,
      weekStartDate: weekStart,
      weekLabel,
      plannerBridge: makeBridge({
        preferredSuggestionCode: "reduce_slot_load",
        preferredAction: "reduce_load",
        dayOffset: null,
        autoApply: true,
      }),
      latestDecision: null,
    });
  }

  const strengthPattern = patternByCode("strength_underdelivery");
  const underloadInsight = insightByCode("underload_risk");
  if (strengthPattern || underloadInsight) {
    pushSuggestion({
      id: "restore-block-stimulus",
      level: strengthPattern?.level ?? underloadInsight?.level ?? "info",
      title: "Restore the intended block stimulus",
      summary:
        "The block is under-delivering against intent, so the next planner pass should add load back in the right slot instead of drifting quietly.",
      recommendation:
        "Open the current week and increase one of the lighter slots to better match the block target.",
      source: strengthPattern ? "pattern" : "insight",
      sourceCode: strengthPattern?.code ?? underloadInsight!.code,
      weekStartDate: weekStart,
      weekLabel,
      plannerBridge: makeBridge({
        preferredSuggestionCode: "increase_slot_load",
        preferredAction: "increase_load",
        dayOffset: strengthPattern?.dayOffset ?? null,
        autoApply: true,
      }),
      latestDecision: null,
    });
  }

  const levelRank = {
    critical: 0,
    warning: 1,
    info: 2,
  } satisfies Record<AnalyticsCoachSuggestion["level"], number>;

  return suggestions
    .sort((left, right) => levelRank[left.level] - levelRank[right.level])
    .slice(0, 4);
}

export function linkCoachSuggestionsWithHistory(
  suggestions: AnalyticsCoachSuggestion[],
  decisionHistory: AnalyticsCoachActionDecision[],
): AnalyticsCoachSuggestion[] {
  const decisionByKey = new Map(
    decisionHistory.map((decision) => [
      `${decision.suggestionId}:${decision.weekStartDate}`,
      decision,
    ]),
  );
  const latestDecisionBySuggestionId = new Map<string, AnalyticsCoachActionDecision>();

  for (const decision of decisionHistory) {
    if (!latestDecisionBySuggestionId.has(decision.suggestionId)) {
      latestDecisionBySuggestionId.set(decision.suggestionId, decision);
    }
  }

  return suggestions.map((suggestion) => ({
    ...suggestion,
    latestDecision:
      (suggestion.weekStartDate
        ? decisionByKey.get(`${suggestion.id}:${suggestion.weekStartDate}`)
        : undefined) ??
      latestDecisionBySuggestionId.get(suggestion.id) ??
      null,
  }));
}

export function plannerSuggestionFeedbackKey(
  code: PlannerSuggestion["code"],
  action: PlannerSuggestion["action"],
) {
  return `${code}:${action}`;
}

function pickPlannerFeedbackRows(
  decisions: StoredAnalyticsCoachActionDecision[],
  phase: PreparationPhase | null,
  competitionPriority: CompetitionPriority | null,
) {
  const eligible = decisions.filter(
    (decision) =>
      decision.plannerBridge?.preferredSuggestionCode !== null &&
      decision.plannerBridge?.preferredSuggestionCode !== undefined &&
      decision.outcomeStatus !== "pending",
  );

  if (!eligible.length) {
    return {
      decisions: [] as StoredAnalyticsCoachActionDecision[],
      scope: "athlete_history" as PlannerSuggestionFeedback["scope"],
    };
  }

  const exactContextDecisions = eligible.filter((decision) => {
    const snapshot = decision.baselineSnapshot;

    return (
      snapshot?.phase === phase &&
      snapshot?.competitionPriority === competitionPriority
    );
  });

  if (exactContextDecisions.length) {
    return {
      decisions: exactContextDecisions,
      scope: "exact_context" as PlannerSuggestionFeedback["scope"],
    };
  }

  const samePhaseDecisions = eligible.filter(
    (decision) => decision.baselineSnapshot?.phase === phase,
  );

  if (samePhaseDecisions.length) {
    return {
      decisions: samePhaseDecisions,
      scope: "phase_context" as PlannerSuggestionFeedback["scope"],
    };
  }

  return {
    decisions: eligible,
    scope: "athlete_history" as PlannerSuggestionFeedback["scope"],
  };
}

export function buildPlannerSuggestionFeedbackIndexFromDecisions(input: {
  decisions: StoredAnalyticsCoachActionDecision[];
  phase: PreparationPhase | null;
  competitionPriority: CompetitionPriority | null;
}) {
  const selected = pickPlannerFeedbackRows(
    input.decisions,
    input.phase,
    input.competitionPriority,
  );
  const grouped = new Map<string, StoredAnalyticsCoachActionDecision[]>();

  for (const decision of selected.decisions) {
    const preferredCode = decision.plannerBridge?.preferredSuggestionCode;
    const preferredAction = decision.plannerBridge?.preferredAction;

    if (!preferredCode || !preferredAction) {
      continue;
    }

    const key = plannerSuggestionFeedbackKey(preferredCode, preferredAction);
    const bucket = grouped.get(key) ?? [];
    bucket.push(decision);
    grouped.set(key, bucket);
  }

  const feedbackIndex = new Map<string, PlannerSuggestionFeedback>();

  for (const [key, decisions] of grouped) {
    let appliedCount = 0;
    let skippedCount = 0;
    let positiveCount = 0;
    let neutralCount = 0;
    let negativeCount = 0;
    let netScore = 0;

    for (const decision of decisions) {
      if (decision.decisionStatus === "applied") {
        appliedCount += 1;
      } else {
        skippedCount += 1;
      }

      if (decision.outcomeStatus === "positive") {
        positiveCount += 1;
      } else if (decision.outcomeStatus === "negative") {
        negativeCount += 1;
      } else {
        neutralCount += 1;
      }

      if (decision.decisionStatus === "applied") {
        if (decision.outcomeStatus === "positive") {
          netScore += 2;
        } else if (decision.outcomeStatus === "negative") {
          netScore -= 2;
        }
      } else if (decision.outcomeStatus === "positive") {
        netScore -= 1;
      } else if (decision.outcomeStatus === "negative") {
        netScore += 1;
      }
    }

    const sampleSize = decisions.length;
    const label: PlannerSuggestionFeedback["label"] =
      sampleSize === 0
        ? "new"
        : netScore >= 2 && positiveCount >= negativeCount
          ? "historically_effective"
          : netScore <= -1
            ? "watch"
            : "mixed";
    const referenceSnapshot = decisions[0]?.baselineSnapshot ?? null;

    feedbackIndex.set(key, {
      label,
      scope: selected.scope,
      netScore,
      sampleSize,
      appliedCount,
      skippedCount,
      positiveCount,
      neutralCount,
      negativeCount,
      phase: referenceSnapshot?.phase ?? input.phase,
      competitionPriority:
        referenceSnapshot?.competitionPriority ?? input.competitionPriority,
    });
  }

  return feedbackIndex;
}
