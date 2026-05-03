import type {
  CompetitionContext,
  ReadinessFormValues,
  ReadinessReason,
  ReadinessStatus,
} from "@training-platform/shared";

export interface BaselineProfile {
  baselineRestingHr: number | null;
  baselineWeightKg: number | null;
}

export interface ReadinessEngineInput {
  values: ReadinessFormValues;
  baseline: BaselineProfile;
  competitionContext?: CompetitionContext | null;
}

export interface ReadinessEngineOutput {
  score: number;
  status: ReadinessStatus;
  explanation: ReadinessReason[];
}
