import type {
  AnalyticsCoachActionDecision,
  AnalyticsCoachActionOutcome,
  AnalyticsCoachActionSnapshot,
  AnalyticsOverview,
  AnalyticsWeekStatus,
  PlanBlockInput,
} from "@training-platform/shared";

export interface StoredAnalyticsCoachActionDecision {
  id: string;
  athleteId: string;
  coachUserId: string;
  suggestionId: string;
  suggestionTitle: string;
  suggestionLevel: AnalyticsCoachActionDecision["suggestionLevel"];
  sourceCode: AnalyticsCoachActionDecision["sourceCode"];
  weekStartDate: string;
  weekLabel: string | null;
  decisionStatus: AnalyticsCoachActionDecision["decisionStatus"];
  outcomeStatus: AnalyticsCoachActionOutcome;
  plannerBridge: AnalyticsCoachActionDecision["plannerBridge"];
  baselineSnapshot: AnalyticsCoachActionSnapshot | null;
  decisionNotes: string;
  outcomeNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionBlock {
  blockId: string;
  completed: boolean | null;
  setsCompleted: number | null;
  repsCompleted: number | null;
  weightKg: number | null;
  durationMinutes: number | null;
  rpe: number | null;
  resultNotes: string;
  blockType: PlanBlockInput["blockType"];
  blockPriority: number;
  targetDurationMinutes: number | null;
  targetRpe: number | null;
  targetSets: number | null;
  targetReps: number | null;
  assignedExerciseCount: number;
  executedExerciseCount: number;
}

export interface DailyExecutionStats {
  plannedBlocks: number;
  completedBlocks: number;
  partialBlocks: number;
  missedBlocks: number;
  adherenceRate: number;
  plannedLoad: number;
  actualLoad: number;
  averageRpe: number | null;
  totalDurationMinutes: number;
}

export interface WeekDaySnapshot {
  date: string;
  dayOffset: number;
  blocks: ExecutionBlock[];
  stats: DailyExecutionStats;
}

export interface WeekFrame {
  label: string;
  startDate: string;
  endDate: string;
  trackingEnd: string;
  status: AnalyticsWeekStatus;
  elapsedDays: number;
  totalDays: number;
  days: WeekDaySnapshot[];
}

export interface BlockTypeWeekStats {
  blockType: PlanBlockInput["blockType"];
  plannedBlocks: number;
  completedBlocks: number;
  partialBlocks: number;
  missedBlocks: number;
  adherenceRate: number;
  plannedLoad: number;
  actualLoad: number;
  averageRpe: number | null;
  totalDurationMinutes: number;
  activeDayOffsets: number[];
}

export interface AnalyticsTrendSet {
  readinessTrend: AnalyticsOverview["readinessTrend"];
  weightTrend?: AnalyticsOverview["weightTrend"];
  completionTrend: AnalyticsOverview["completionTrend"];
  loadTrend: AnalyticsOverview["loadTrend"];
}
