import {
  estimateTrainingActualLoad,
  estimateTrainingBlockLoad,
  type AnalyticsOverview,
  type CompletionTrendPoint,
  type LoadTrendPoint,
  type PlanBlockInput,
  type ReadinessStatus,
  type WeightTrendPoint,
} from "@training-platform/shared";
import type {
  DailyExecutionStats,
  ExecutionBlock,
} from "./analytics.types";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function round(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

export function toDateKey(value: string | Date) {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  return value.toISOString().slice(0, 10);
}

export function startOfDay(value: string | Date) {
  const date =
    typeof value === "string" ? new Date(`${toDateKey(value)}T00:00:00Z`) : new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function shiftDate(dateText: string, dayOffset: number) {
  const date = startOfDay(dateText);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return toDateKey(date);
}

export function diffDays(from: string | Date, to: string | Date) {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_IN_MS);
}

export function startOfCalendarWeek(referenceDate: string) {
  const date = startOfDay(referenceDate);
  const weekday = date.getUTCDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return shiftDate(referenceDate, offset);
}

export function average(values: number[]) {
  if (!values.length) {
    return null;
  }

  return round(values.reduce((sum, value) => sum + value, 0) / values.length, 1);
}

export function buildReadinessTrend(rows: Array<{
  entryDate: string;
  score: number;
  status: ReadinessStatus;
}>): AnalyticsOverview["readinessTrend"] {
  return rows
    .slice()
    .sort((left, right) => left.entryDate.localeCompare(right.entryDate))
    .slice(-14)
    .map((row) => ({
      date: row.entryDate,
      score: row.score,
      status: row.status,
    }));
}

export function estimatePlannedBlockLoad(
  blockType: PlanBlockInput["blockType"],
  blockPriority: number,
  targetDurationMinutes: number | null,
  targetRpe: number | null,
  rowKind: PlanBlockInput["rowKind"] = "exercise",
) {
  return estimateTrainingBlockLoad({
    rowKind,
    blockType,
    blockPriority,
    targetDurationMinutes,
    targetRpe,
  });
}

export function hasActualExecution(block: ExecutionBlock) {
  return (
    block.setsCompleted !== null ||
    block.repsCompleted !== null ||
    block.weightKg !== null ||
    block.durationMinutes !== null ||
    block.rpe !== null ||
    block.executedExerciseCount > 0 ||
    block.resultNotes.trim().length > 0
  );
}

export function estimateActualBlockLoad(
  block: ExecutionBlock,
  plannedLoad: number,
) {
  return estimateTrainingActualLoad({
    assignedExerciseCount: block.assignedExerciseCount,
    completed: block.completed ?? false,
    durationMinutes: block.durationMinutes,
    exercises: Array.from({ length: block.executedExerciseCount }, (_, index) => ({
      assignedExerciseId: `${block.blockId}:${index}`,
      completed: true,
    })),
    plannedLoad,
    rpe: block.rpe,
  });
}

export function buildDailyExecutionStats(blocks: ExecutionBlock[]): DailyExecutionStats {
  let completedBlocks = 0;
  let partialBlocks = 0;
  let missedBlocks = 0;
  let plannedLoad = 0;
  let actualLoad = 0;
  let totalDurationMinutes = 0;
  let rpeSum = 0;
  let rpeCount = 0;

  for (const block of blocks) {
    const blockPlannedLoad = estimatePlannedBlockLoad(
      block.blockType,
      block.blockPriority,
      block.targetDurationMinutes,
      block.targetRpe,
      block.rowKind,
    );
    plannedLoad += blockPlannedLoad;
    actualLoad += estimateActualBlockLoad(block, blockPlannedLoad);

    if (block.durationMinutes !== null) {
      totalDurationMinutes += block.durationMinutes;
    }

    if (block.rpe !== null) {
      rpeSum += block.rpe;
      rpeCount += 1;
    }

    if (block.completed) {
      completedBlocks += 1;
    } else if (hasActualExecution(block)) {
      partialBlocks += 1;
    } else if (block.completed === false) {
      missedBlocks += 1;
    }
  }

  return {
    plannedBlocks: blocks.length,
    completedBlocks,
    partialBlocks,
    missedBlocks,
    adherenceRate: blocks.length ? Math.round((completedBlocks / blocks.length) * 100) : 0,
    plannedLoad: round(plannedLoad),
    actualLoad: round(actualLoad),
    averageRpe: rpeCount ? round(rpeSum / rpeCount) : null,
    totalDurationMinutes: round(totalDurationMinutes),
  };
}

export function buildExecutionTrendMaps(rows: Array<{ dayDate: string; block: ExecutionBlock }>) {
  const groupedByDate = new Map<string, ExecutionBlock[]>();

  for (const row of rows) {
    const bucket = groupedByDate.get(row.dayDate) ?? [];
    bucket.push(row.block);
    groupedByDate.set(row.dayDate, bucket);
  }

  return groupedByDate;
}

export function buildCompletionTrend(
  groupedByDate: Map<string, ExecutionBlock[]>,
  referenceDateText: string,
): CompletionTrendPoint[] {
  return Array.from(groupedByDate.keys())
    .filter((date) => date <= referenceDateText)
    .sort((left, right) => left.localeCompare(right))
    .slice(-14)
    .map((date) => {
      const stats = buildDailyExecutionStats(groupedByDate.get(date) ?? []);
      return {
        date,
        plannedBlocks: stats.plannedBlocks,
        completedBlocks: stats.completedBlocks,
        partialBlocks: stats.partialBlocks,
        missedBlocks: stats.missedBlocks,
        adherenceRate: stats.adherenceRate,
      };
    });
}

export function buildLoadTrend(
  groupedByDate: Map<string, ExecutionBlock[]>,
  referenceDateText: string,
): LoadTrendPoint[] {
  return Array.from(groupedByDate.keys())
    .filter((date) => date <= referenceDateText)
    .sort((left, right) => left.localeCompare(right))
    .slice(-14)
    .map((date) => {
      const stats = buildDailyExecutionStats(groupedByDate.get(date) ?? []);
      return {
        date,
        plannedLoad: stats.plannedLoad,
        actualLoad: stats.actualLoad,
        loadDelta: round(stats.actualLoad - stats.plannedLoad),
        averageRpe: stats.averageRpe,
        totalDurationMinutes: stats.totalDurationMinutes,
      };
    });
}

export function buildWeightTrend(
  rows: Array<{ date: string; weightKg: number }>,
  baselineWeightKg: number | null,
): WeightTrendPoint[] {
  return rows
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-14)
    .map((row) => ({
      date: row.date,
      weightKg: row.weightKg,
      deltaFromBaseline:
        baselineWeightKg !== null
          ? Number((row.weightKg - baselineWeightKg).toFixed(2))
          : null,
    }));
}
