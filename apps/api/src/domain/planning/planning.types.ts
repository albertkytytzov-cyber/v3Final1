import type {
  AssignedPlanSummary,
  MesocycleWeekContext,
  PlanTemplateRecommendation,
  PlanTemplateSummary,
  PlannerSuggestionFeedback,
  TemplatePackHistoryBias,
  TemplatePackRecommendation,
} from "@training-platform/shared";

export interface PlannerSlot {
  dayOffset: number;
  dayLabel: string;
  microcycleType: string;
  slotWeight: number;
}

export type TemplateSelectionIntent = "slot" | "lighter" | "heavier";

export interface TemplateFeedbackBias {
  scoreDelta: number;
  reasons: string[];
  historyBiases: TemplatePackHistoryBias[];
}

export interface TemplateScoredRecommendation extends PlanTemplateRecommendation {
  estimatedLoad: number;
  templateDayIndex?: number;
  selectionKey: string;
  historyBiases: TemplatePackHistoryBias[];
}

export interface TemplateLoadRecommendation {
  templateId: string;
  templateName: string;
  templateDayIndex?: number;
  estimatedLoad: number;
  score: number;
}

export type TemplatePackDraftItem = TemplatePackRecommendation["items"][number];

export interface BuildTemplatePackInput {
  templates: PlanTemplateSummary[];
  phase: AssignedPlanSummary["plannedPhase"];
  competitionContext: AssignedPlanSummary["competitionContextSnapshot"];
  mesocycleWeek: MesocycleWeekContext | null;
  startDate: string;
  nearbyAssignedPlans: AssignedPlanSummary[];
  feedbackIndex: Map<string, PlannerSuggestionFeedback> | null;
}
