import type {
  AdaptedPlanDay,
  AssignedPlanSummary,
  CompetitionContext,
  ReadinessEntry,
} from "@training-platform/shared";

export interface AdaptationEngineInput {
  assignedPlan: AssignedPlanSummary;
  readiness: ReadinessEntry;
  competitionContext?: CompetitionContext | null;
}

export type AdaptationEngineOutput = AdaptedPlanDay;
