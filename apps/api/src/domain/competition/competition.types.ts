import type {
  CompetitionContext,
  CompetitionPlanSummary,
  MesocycleProgressionType,
  MesocycleSummary,
  MesocycleWeekContext,
  MesocycleWeekPlan,
  PreparationPhase,
} from "@training-platform/shared";

export interface CompetitionContextCandidate {
  competitionPlanId: string;
  competitionId: string;
  competitionPriority: CompetitionContext["competitionPriority"];
  taperDays: number;
  weightCutRequired: boolean;
  prepStartDate: string;
  prepEndDate: string;
  competitionStartDate: string;
}

export interface MesocycleWeeksInput {
  phase: PreparationPhase;
  progressionType: MesocycleProgressionType;
  startDate: string;
  weeksCount: number;
  competitionTitle: string | null;
}

export interface CompetitionReviewInput {
  athleteId: string;
  athleteName: string;
  plans: CompetitionPlanSummary[];
}

export interface MesocycleWeekMatch {
  mesocycle: MesocycleSummary;
  week: MesocycleWeekPlan;
}

export interface MesocycleWeekLookupInput {
  mesocycles: MesocycleSummary[];
  referenceDate: string;
}

export type MesocycleWeeksValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export type CompetitionContextCandidateComparator = (
  left: CompetitionContextCandidate,
  right: CompetitionContextCandidate,
  referenceDate: string,
) => number;

export type MesocycleWeekContextResolver = (
  input: MesocycleWeekLookupInput,
) => MesocycleWeekContext | null;
