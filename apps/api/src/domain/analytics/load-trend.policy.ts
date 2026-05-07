import type {
  AnalyticsChain,
  AnalyticsInsight,
  AnalyticsOverview,
  AnalyticsPattern,
  AnalyticsWeekSummary,
  CompetitionContext,
  CompletionTrendPoint,
  LoadTrendPoint,
  MesocycleWeekContext,
  PlanBlockInput,
} from "@training-platform/shared";
import type {
  BlockTypeWeekStats,
  ExecutionBlock,
  WeekDaySnapshot,
  WeekFrame,
} from "./analytics.types";
import {
  average,
  buildDailyExecutionStats,
  diffDays,
  estimateActualBlockLoad,
  estimatePlannedBlockLoad,
  hasActualExecution,
  round,
  shiftDate,
  startOfCalendarWeek,
} from "./readiness-trend.policy";

export function buildWeekFrame(input: {
  referenceDate: string;
  groupedByDate: Map<string, ExecutionBlock[]>;
  mesocycleWeek: MesocycleWeekContext | null;
}): WeekFrame {
  const totalDays = 7;
  const weekStart = input.mesocycleWeek?.startDate ?? startOfCalendarWeek(input.referenceDate);
  const weekEnd = input.mesocycleWeek?.endDate ?? shiftDate(weekStart, totalDays - 1);
  const label = input.mesocycleWeek?.weekLabel ?? "Calendar week";
  const status =
    input.referenceDate < weekStart
      ? "upcoming"
      : input.referenceDate > weekEnd
        ? "completed"
        : "in_progress";
  const trackingEnd =
    status === "upcoming"
      ? shiftDate(weekStart, -1)
      : input.referenceDate < weekEnd
        ? input.referenceDate
        : weekEnd;
  const elapsedDays = status === "upcoming" ? 0 : diffDays(weekStart, trackingEnd) + 1;

  return {
    label,
    startDate: weekStart,
    endDate: weekEnd,
    trackingEnd,
    status,
    elapsedDays,
    totalDays,
    days: Array.from({ length: elapsedDays }, (_, index) => {
      const date = shiftDate(weekStart, index);
      const blocks = input.groupedByDate.get(date) ?? [];
      return {
        date,
        dayOffset: index,
        blocks,
        stats: buildDailyExecutionStats(blocks),
      };
    }),
  };
}

export function buildWeekSummary(input: {
  readinessTrend: AnalyticsOverview["readinessTrend"];
  loadTrend?: LoadTrendPoint[];
  mesocycleWeek: MesocycleWeekContext | null;
  frame: WeekFrame;
}): AnalyticsWeekSummary {
  const trackedBlocks = input.frame.days.flatMap((day) => day.blocks);
  const trackedStats = buildDailyExecutionStats(trackedBlocks);
  const trackedLoadPoints = (input.loadTrend ?? []).filter(
    (point) => point.date >= input.frame.startDate && point.date <= input.frame.trackingEnd,
  );
  const plannedLoad = trackedLoadPoints.length
    ? round(trackedLoadPoints.reduce((sum, point) => sum + point.plannedLoad, 0))
    : trackedStats.plannedLoad;
  const actualLoad = trackedLoadPoints.length
    ? round(trackedLoadPoints.reduce((sum, point) => sum + point.actualLoad, 0))
    : trackedStats.actualLoad;
  const readinessInWindow = input.readinessTrend
    .filter((point) => point.date >= input.frame.startDate && point.date <= input.frame.trackingEnd)
    .map((point) => point.score);
  const targetLoad = input.mesocycleWeek?.targetLoad ?? null;
  const expectedLoadToDate =
    targetLoad !== null && input.frame.elapsedDays > 0
      ? round((targetLoad * input.frame.elapsedDays) / input.frame.totalDays)
      : null;

  return {
    label: input.frame.label,
    startDate: input.frame.startDate,
    endDate: input.frame.endDate,
    status: input.frame.status,
    elapsedDays: input.frame.elapsedDays,
    totalDays: input.frame.totalDays,
    microcycleType: input.mesocycleWeek?.microcycleType ?? null,
    targetLoad,
    expectedLoadToDate,
    plannedLoad,
    actualLoad,
    loadDelta: round(actualLoad - plannedLoad),
    averageRpe: trackedStats.averageRpe,
    averageReadiness: average(readinessInWindow),
    plannedBlocks: trackedStats.plannedBlocks,
    completedBlocks: trackedStats.completedBlocks,
    partialBlocks: trackedStats.partialBlocks,
    missedBlocks: trackedStats.missedBlocks,
    adherenceRate: trackedStats.adherenceRate,
  };
}

export function buildBlockTypeWeekStats(days: WeekDaySnapshot[]): BlockTypeWeekStats[] {
  const byType = new Map<
    PlanBlockInput["blockType"],
    BlockTypeWeekStats & { rpeSum: number; rpeCount: number }
  >();

  for (const day of days) {
    for (const block of day.blocks) {
      const stats = byType.get(block.blockType) ?? {
        blockType: block.blockType,
        plannedBlocks: 0,
        completedBlocks: 0,
        partialBlocks: 0,
        missedBlocks: 0,
        adherenceRate: 0,
        plannedLoad: 0,
        actualLoad: 0,
        averageRpe: null,
        totalDurationMinutes: 0,
        activeDayOffsets: [],
        rpeSum: 0,
        rpeCount: 0,
      };

      if (!stats.activeDayOffsets.includes(day.dayOffset)) {
        stats.activeDayOffsets.push(day.dayOffset);
      }

      stats.plannedBlocks += 1;
      stats.plannedLoad += day.stats.plannedLoad / Math.max(1, day.blocks.length);

      if (block.completed) {
        stats.completedBlocks += 1;
      } else if (hasActualExecution(block)) {
        stats.partialBlocks += 1;
      } else if (block.completed === false) {
        stats.missedBlocks += 1;
      }

      stats.actualLoad += estimateActualBlockLoad(
        block,
        estimatePlannedBlockLoad(
          block.blockType,
          block.blockPriority,
          block.targetDurationMinutes,
          block.targetRpe,
        ),
      );

      if (block.durationMinutes !== null) {
        stats.totalDurationMinutes += block.durationMinutes;
      }

      if (block.rpe !== null) {
        stats.rpeSum += block.rpe;
        stats.rpeCount += 1;
      }

      byType.set(block.blockType, stats);
    }
  }

  return Array.from(byType.values()).map(({ rpeSum, rpeCount, ...stats }) => ({
    ...stats,
    adherenceRate: stats.plannedBlocks
      ? Math.round((stats.completedBlocks / stats.plannedBlocks) * 100)
      : 0,
    plannedLoad: round(stats.plannedLoad),
    actualLoad: round(stats.actualLoad),
    averageRpe: rpeCount ? round(rpeSum / rpeCount) : null,
    totalDurationMinutes: round(stats.totalDurationMinutes),
    activeDayOffsets: [...stats.activeDayOffsets].sort((left, right) => left - right),
  }));
}

function metric(
  label: string,
  value: string | number | null,
  tone: "neutral" | "positive" | "warning" = "neutral",
) {
  return {
    label,
    value: value === null ? "-" : String(value),
    tone,
  } satisfies AnalyticsInsight["evidence"][number];
}

function sumBlockTypeStats(
  stats: BlockTypeWeekStats[],
  blockTypes: PlanBlockInput["blockType"][],
) {
  const matches = stats.filter((item) => blockTypes.includes(item.blockType));

  return {
    matches,
    plannedBlocks: matches.reduce((sum, item) => sum + item.plannedBlocks, 0),
    completedBlocks: matches.reduce((sum, item) => sum + item.completedBlocks, 0),
    partialBlocks: matches.reduce((sum, item) => sum + item.partialBlocks, 0),
    missedBlocks: matches.reduce((sum, item) => sum + item.missedBlocks, 0),
    plannedLoad: round(matches.reduce((sum, item) => sum + item.plannedLoad, 0)),
    actualLoad: round(matches.reduce((sum, item) => sum + item.actualLoad, 0)),
    adherenceRate:
      matches.reduce((sum, item) => sum + item.plannedBlocks, 0) > 0
        ? Math.round(
            (matches.reduce((sum, item) => sum + item.completedBlocks, 0) /
              matches.reduce((sum, item) => sum + item.plannedBlocks, 0)) *
              100,
          )
        : 0,
  };
}

function findDayForBlockTypes(
  days: WeekDaySnapshot[],
  blockTypes: PlanBlockInput["blockType"][],
  strategy: "highest_load" | "most_missed" = "highest_load",
) {
  const ranked = days
    .map((day) => {
      const matchingBlocks = day.blocks.filter((block) => blockTypes.includes(block.blockType));
      const matchingStats = buildDailyExecutionStats(matchingBlocks);
      const missedLike = matchingBlocks.filter(
        (block) =>
          block.completed === false ||
          (!block.completed && hasActualExecution(block)) ||
          (block.completed === null && hasActualExecution(block)),
      ).length;

      return {
        day,
        matchingStats,
        missedLike,
      };
    })
    .filter((entry) => entry.matchingStats.plannedBlocks > 0);

  if (!ranked.length) {
    return null;
  }

  ranked.sort((left, right) =>
    strategy === "most_missed"
      ? right.missedLike - left.missedLike ||
        right.matchingStats.actualLoad - left.matchingStats.actualLoad
      : right.matchingStats.actualLoad - left.matchingStats.actualLoad ||
        right.matchingStats.plannedLoad - left.matchingStats.plannedLoad,
  );

  return ranked[0].day;
}

function countStatusChanges(statuses: AnalyticsOverview["readinessTrend"][number]["status"][]) {
  let changes = 0;

  for (let index = 1; index < statuses.length; index += 1) {
    if (statuses[index] !== statuses[index - 1]) {
      changes += 1;
    }
  }

  return changes;
}

export function buildPatterns(input: {
  competitionContext: CompetitionContext | null;
  chain: AnalyticsChain;
  readinessTrend: AnalyticsOverview["readinessTrend"];
  weekFrame: WeekFrame;
  weekSummary: AnalyticsWeekSummary | null;
  blockTypeStats: BlockTypeWeekStats[];
}): AnalyticsPattern[] {
  const patterns: AnalyticsPattern[] = [];
  const phase = input.chain.mesocycleWeek?.phase ?? input.competitionContext?.phase ?? null;
  const daysToCompetition = input.competitionContext?.daysToCompetition ?? null;
  const competitionPriority = input.competitionContext?.competitionPriority ?? null;
  const weekSummary = input.weekSummary;
  const recentReadiness = input.readinessTrend.slice(-4);
  const readinessScores = recentReadiness.map((point) => point.score);
  const readinessRange =
    readinessScores.length > 1 ? Math.max(...readinessScores) - Math.min(...readinessScores) : 0;

  if (
    recentReadiness.length >= 3 &&
    readinessRange >= 12 &&
    countStatusChanges(recentReadiness.map((point) => point.status)) >= 2
  ) {
    patterns.push({
      code: "readiness_volatility",
      level: competitionPriority === "A" ? "warning" : "info",
      scope: "week",
      title: "Readiness is oscillating inside the week",
      summary:
        "Recent readiness is swinging sharply instead of stabilizing, which usually means the week rhythm is still too noisy.",
      weekLabel: weekSummary?.label ?? input.weekFrame.label,
      blockType: null,
      dayOffset: null,
      evidence: [
        metric("readiness_range", readinessRange, "warning"),
        metric("status_changes", countStatusChanges(recentReadiness.map((point) => point.status))),
      ],
    });
  }

  const recoverySupport = sumBlockTypeStats(input.blockTypeStats, [
    "recovery",
    "mobility",
    "activation",
  ]);
  const heaviestDay = [...input.weekFrame.days].sort(
    (left, right) =>
      right.stats.actualLoad - left.stats.actualLoad ||
      right.stats.plannedLoad - left.stats.plannedLoad,
  )[0];

  if (
    weekSummary &&
    ["taper", "competition", "recovery"].includes(phase ?? "") &&
    (recoverySupport.plannedBlocks < 2 || recoverySupport.adherenceRate < 80)
  ) {
    patterns.push({
      code: "recovery_gap",
      level:
        competitionPriority === "A" || (daysToCompetition !== null && daysToCompetition <= 7)
          ? "critical"
          : "warning",
      scope: "block",
      title: "Recovery-support work is too thin for the week intent",
      summary:
        "The current week does not contain enough recovery, mobility, or activation work for the active phase and competition proximity.",
      weekLabel: weekSummary.label,
      blockType: "recovery",
      dayOffset: heaviestDay?.dayOffset ?? null,
      evidence: [
        metric("recovery_blocks", recoverySupport.plannedBlocks, "warning"),
        metric("recovery_adherence", recoverySupport.adherenceRate, "warning"),
        metric("week_microcycle", weekSummary.microcycleType),
      ],
    });
  }

  const fatigueDensity = sumBlockTypeStats(input.blockTypeStats, [
    "metabolic",
    "CNS_high",
    "conditioning",
  ]);
  const dominantFatigueType = [...fatigueDensity.matches].sort(
    (left, right) => right.actualLoad - left.actualLoad || right.plannedLoad - left.plannedLoad,
  )[0];
  const fatigueDay =
    findDayForBlockTypes(input.weekFrame.days, ["metabolic", "CNS_high", "conditioning"]) ??
    heaviestDay;
  const fatigueRatio =
    weekSummary && weekSummary.actualLoad > 0
      ? fatigueDensity.actualLoad / weekSummary.actualLoad
      : weekSummary && weekSummary.plannedLoad > 0
        ? fatigueDensity.plannedLoad / weekSummary.plannedLoad
        : 0;

  if (
    weekSummary &&
    dominantFatigueType &&
    fatigueRatio >= 0.38 &&
    (["taper", "competition"].includes(phase ?? "") ||
      (weekSummary.averageReadiness !== null && weekSummary.averageReadiness < 72))
  ) {
    patterns.push({
      code: "fatigue_block_density",
      level:
        ["taper", "competition"].includes(phase ?? "") || competitionPriority === "A"
          ? "critical"
          : "warning",
      scope: "block",
      title: "Fatiguing block density is too high for the current context",
      summary:
        "A large share of the week is still coming from metabolic or CNS-heavy work, which increases fatigue carry-over into the next sessions.",
      weekLabel: weekSummary.label,
      blockType: dominantFatigueType.blockType,
      dayOffset: fatigueDay?.dayOffset ?? null,
      evidence: [
        metric("fatigue_load_share", `${Math.round(fatigueRatio * 100)}%`, "warning"),
        metric("fatigue_block_type", dominantFatigueType.blockType, "warning"),
        metric("week_actual_load", weekSummary.actualLoad, "warning"),
      ],
    });
  }

  const specificWork = sumBlockTypeStats(input.blockTypeStats, ["technical", "speed"]);
  const specificDay = findDayForBlockTypes(
    input.weekFrame.days,
    ["technical", "speed"],
    "most_missed",
  );

  if (
    weekSummary &&
    ["specific", "taper", "competition"].includes(phase ?? "") &&
    (specificWork.adherenceRate < 75 || specificWork.missedBlocks >= 2)
  ) {
    patterns.push({
      code: "specific_block_drift",
      level: competitionPriority === "A" ? "warning" : "info",
      scope: "block",
      title: "Specific work is drifting away from execution",
      summary:
        "Technical or speed-focused work is being missed or only partially executed, so the week may lose specificity at the wrong time.",
      weekLabel: weekSummary.label,
      blockType: "technical",
      dayOffset: specificDay?.dayOffset ?? null,
      evidence: [
        metric("specific_adherence", specificWork.adherenceRate, "warning"),
        metric("specific_missed_blocks", specificWork.missedBlocks, "warning"),
        metric("week_microcycle", weekSummary.microcycleType),
      ],
    });
  }

  const strengthWork = sumBlockTypeStats(input.blockTypeStats, ["strength"]);
  const strengthDay = findDayForBlockTypes(input.weekFrame.days, ["strength"], "most_missed");
  const strengthRatio =
    strengthWork.plannedLoad > 0 ? strengthWork.actualLoad / strengthWork.plannedLoad : 0;

  if (
    weekSummary &&
    ["base", "strength"].includes(phase ?? "") &&
    strengthWork.plannedBlocks > 0 &&
    (strengthRatio <= 0.65 || strengthWork.adherenceRate < 75)
  ) {
    patterns.push({
      code: "strength_underdelivery",
      level: "warning",
      scope: "block",
      title: "Strength stimulus is being under-delivered",
      summary:
        "The current block is not reaching the planned strength work, which can flatten progression in a build-oriented phase.",
      weekLabel: weekSummary.label,
      blockType: "strength",
      dayOffset: strengthDay?.dayOffset ?? null,
      evidence: [
        metric("strength_load_delivery", `${Math.round(strengthRatio * 100)}%`, "warning"),
        metric("strength_adherence", strengthWork.adherenceRate, "warning"),
        metric("strength_blocks", strengthWork.plannedBlocks),
      ],
    });
  }

  const levelRank = {
    critical: 0,
    warning: 1,
    info: 2,
  } satisfies Record<AnalyticsPattern["level"], number>;

  return patterns
    .sort((left, right) => levelRank[left.level] - levelRank[right.level])
    .slice(0, 4);
}

export function buildInsights(input: {
  competitionContext: CompetitionContext | null;
  chain: AnalyticsChain;
  readinessTrend: AnalyticsOverview["readinessTrend"];
  completionTrend: CompletionTrendPoint[];
  loadTrend: LoadTrendPoint[];
}): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = [];
  const latestReadiness = input.readinessTrend.at(-1) ?? null;
  const latestCompletion = input.completionTrend.at(-1) ?? null;
  const latestLoad = input.loadTrend.at(-1) ?? null;
  const lastThreeReadinessAverage = average(input.readinessTrend.slice(-3).map((point) => point.score));
  const previousThreeReadinessAverage = average(
    input.readinessTrend.slice(-6, -3).map((point) => point.score),
  );
  const lastThreeAdherenceAverage = average(
    input.completionTrend.slice(-3).map((point) => point.adherenceRate),
  );
  const recentLoadAverage = average(input.loadTrend.slice(-3).map((point) => point.actualLoad));
  const weekSummary = input.chain.weekSummary;
  const phase = input.chain.mesocycleWeek?.phase ?? input.competitionContext?.phase ?? null;
  const competitionPriority = input.competitionContext?.competitionPriority ?? null;
  const daysToCompetition = input.competitionContext?.daysToCompetition ?? null;
  const missingLinks = input.chain.missingLinks;

  if (missingLinks.length > 0) {
    insights.push({
      code: "planning_chain_gap",
      level:
        missingLinks.includes("season") || missingLinks.includes("mesocycle")
          ? "warning"
          : "info",
      title: "Planning chain is incomplete",
      summary:
        "Analytics can still run, but the season-to-week planning context is partially missing for this athlete.",
      recommendation:
        "Link the active season, mesocycle, and competition plan so readiness and execution can be interpreted against the intended block.",
      phase,
      competitionPriority,
      daysToCompetition,
      evidence: [metric("missing_links", missingLinks.join(", "), "warning")],
    });
  }

  const expectedLoadAnchor = weekSummary?.expectedLoadToDate ?? null;
  const overloadRatio =
    weekSummary && expectedLoadAnchor && expectedLoadAnchor > 0
      ? weekSummary.actualLoad / expectedLoadAnchor
      : null;

  if (
    latestReadiness &&
    weekSummary &&
    lastThreeReadinessAverage !== null &&
    (latestReadiness.status === "red" ||
      lastThreeReadinessAverage < 62 ||
      (previousThreeReadinessAverage !== null &&
        lastThreeReadinessAverage <= previousThreeReadinessAverage - 7)) &&
    (weekSummary.actualLoad ?? 0) >= (expectedLoadAnchor ?? weekSummary.plannedLoad ?? 0) * 0.9
  ) {
    insights.push({
      code: "fatigue_risk",
      level:
        competitionPriority === "A" ||
        latestReadiness.status === "red" ||
        phase === "competition"
          ? "critical"
          : "warning",
      title: "Readiness is dropping under active load",
      summary:
        "Recent readiness is trending down while the athlete is still carrying meaningful training load in the current week.",
      recommendation:
        "Reduce the next high-load slot, keep only the essential specific work, and re-check readiness before adding volume back.",
      phase,
      competitionPriority,
      daysToCompetition,
      evidence: [
        metric(
          "latest_readiness",
          latestReadiness.score,
          latestReadiness.status === "green" ? "positive" : "warning",
        ),
        metric("readiness_3d_avg", lastThreeReadinessAverage, "warning"),
        metric("expected_load_to_date", expectedLoadAnchor),
        metric("week_actual_load", weekSummary.actualLoad, "warning"),
      ],
    });
  }

  if (
    latestCompletion &&
    weekSummary &&
    ((lastThreeAdherenceAverage !== null && lastThreeAdherenceAverage < 82) ||
      weekSummary.adherenceRate < 80 ||
      weekSummary.missedBlocks >= 2)
  ) {
    insights.push({
      code: "adherence_risk",
      level: weekSummary.missedBlocks >= 2 ? "critical" : "warning",
      title: "Execution adherence is slipping",
      summary:
        "Actual execution is falling behind the assigned work, so progression quality and analytics confidence are weakening.",
      recommendation:
        "Review the blocker with the athlete, simplify the next 48 hours if needed, and protect the most important session instead of chasing missed volume.",
      phase,
      competitionPriority,
      daysToCompetition,
      evidence: [
        metric(
          "latest_adherence",
          latestCompletion.adherenceRate,
          latestCompletion.adherenceRate >= 85 ? "positive" : "warning",
        ),
        metric("adherence_3d_avg", lastThreeAdherenceAverage, "warning"),
        metric(
          "missed_blocks",
          weekSummary.missedBlocks,
          weekSummary.missedBlocks > 0 ? "warning" : "neutral",
        ),
      ],
    });
  }

  if (weekSummary && overloadRatio !== null && overloadRatio >= 1.18 && weekSummary.actualLoad > 0) {
    insights.push({
      code: "load_spike",
      level:
        phase === "recovery" ||
        phase === "taper" ||
        (daysToCompetition !== null && daysToCompetition <= 7)
          ? "critical"
          : "warning",
      title: "Weekly load is climbing too fast",
      summary:
        "The current week is running above the expected load pace for the active planning context.",
      recommendation:
        "Trim the heaviest remaining day, reduce metabolic volume first, and keep only the block types that match the week intent.",
      phase,
      competitionPriority,
      daysToCompetition,
      evidence: [
        metric("week_actual_load", weekSummary.actualLoad, "warning"),
        metric("expected_load_to_date", expectedLoadAnchor, "warning"),
        metric("week_microcycle", weekSummary.microcycleType),
      ],
    });
  }

  if (
    weekSummary &&
    expectedLoadAnchor !== null &&
    expectedLoadAnchor > 0 &&
    weekSummary.actualLoad / expectedLoadAnchor <= 0.72 &&
    !["recovery", "taper", "competition"].includes(phase ?? "")
  ) {
    insights.push({
      code: "underload_risk",
      level:
        weekSummary.microcycleType === "shock" || weekSummary.microcycleType === "impact"
          ? "warning"
          : "info",
      title: "The week is under-loaded against intent",
      summary:
        "Actual execution is materially below the load expected from the current block, so adaptation stimulus may be softer than planned.",
      recommendation:
        "Check whether sessions were missed, then either recover the key work or lower the planned target so the block stays honest.",
      phase,
      competitionPriority,
      daysToCompetition,
      evidence: [
        metric("week_actual_load", weekSummary.actualLoad),
        metric("expected_load_to_date", expectedLoadAnchor),
        metric("latest_adherence", latestCompletion?.adherenceRate ?? null),
      ],
    });
  }

  const taperLikePhase =
    phase === "taper" ||
    phase === "competition" ||
    weekSummary?.microcycleType === "taper" ||
    (daysToCompetition !== null && daysToCompetition <= 7);

  if (
    taperLikePhase &&
    weekSummary &&
    ((overloadRatio !== null && overloadRatio >= 1.08) ||
      (recentLoadAverage !== null &&
        latestLoad !== null &&
        latestLoad.averageRpe !== null &&
        recentLoadAverage > 0 &&
        latestLoad.averageRpe >= 7.5))
  ) {
    insights.push({
      code: "taper_violation",
      level: "critical",
      title: "Taper freshness is being violated",
      summary:
        "Close-to-competition load is still too dense for a taper or competition window, which can erode freshness without adding useful stimulus.",
      recommendation:
        "Keep activation, mobility, and tactical sharpness, but remove the fatiguing volume from the remaining days.",
      phase,
      competitionPriority,
      daysToCompetition,
      evidence: [
        metric("competition_phase", phase, "warning"),
        metric("days_to_competition", daysToCompetition, "warning"),
        metric("week_actual_load", weekSummary.actualLoad, "warning"),
        metric("expected_load_to_date", expectedLoadAnchor),
      ],
    });
  }

  if (insights.length === 0) {
    insights.push({
      code: "on_track",
      level: "info",
      title: "Current block is tracking well",
      summary:
        "Readiness, execution, and load are aligned closely enough to the active plan that no immediate coach intervention is required.",
      recommendation:
        "Hold the current week intent, monitor readiness daily, and only adjust if execution or freshness changes materially.",
      phase,
      competitionPriority,
      daysToCompetition,
      evidence: [
        metric("latest_readiness", latestReadiness?.score ?? null, "positive"),
        metric("latest_adherence", latestCompletion?.adherenceRate ?? null, "positive"),
        metric("latest_load_delta", latestLoad?.loadDelta ?? null),
      ],
    });
  }

  const levelRank = {
    critical: 0,
    warning: 1,
    info: 2,
  } satisfies Record<AnalyticsInsight["level"], number>;

  return insights
    .sort((left, right) => levelRank[left.level] - levelRank[right.level])
    .slice(0, 4);
}
