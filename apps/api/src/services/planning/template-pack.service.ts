import type {
  PlanTemplateRecommendationResponse,
  TemplatePackRecommendationResponse,
} from "@training-platform/shared";
import { buildTemplatePackRecommendation } from "../../domain/planning/template-pack.engine";
import { shiftDate } from "../../domain/planning/load-balance.policy";
import { defaultMicrocycleSlots } from "../../domain/planning/slot-selection.policy";
import { scoreTemplateRecommendation } from "../../domain/planning/scoring.policy";
import { buildPlannerSuggestionFeedbackIndex } from "../analytics/analytics-report.service";
import { getCompetitionContextForAthlete } from "../competition/competition-query.service";
import { getMesocycleWeekContextForDate } from "../competition/mesocycle.service";
import {
  listPlanTemplatesForCoachContext,
  loadAssignedPlansForWindow,
} from "./planning-query.service";

export async function buildTemplateRecommendationResponse(input: {
  coachUserId: string;
  role: string;
  athleteId: string;
  referenceDate: string;
}): Promise<PlanTemplateRecommendationResponse> {
  const [competitionContext, templates] = await Promise.all([
    getCompetitionContextForAthlete(input.athleteId, input.referenceDate),
    listPlanTemplatesForCoachContext(input.coachUserId, input.role),
  ]);

  const recommendations = templates
    .map((template) => scoreTemplateRecommendation(template, competitionContext))
    .sort(
      (left, right) =>
        right.score - left.score || left.templateName.localeCompare(right.templateName),
    );

  return {
    athleteId: input.athleteId,
    date: input.referenceDate,
    competitionContext,
    recommendations,
  };
}

export async function buildTemplatePackRecommendationResponse(input: {
  coachUserId: string;
  role: string;
  athleteId: string;
  startDate: string;
}): Promise<TemplatePackRecommendationResponse> {
  const [competitionContext, mesocycleWeek, templates] = await Promise.all([
    getCompetitionContextForAthlete(input.athleteId, input.startDate),
    getMesocycleWeekContextForDate(input.athleteId, input.startDate),
    listPlanTemplatesForCoachContext(input.coachUserId, input.role),
  ]);

  const phase = mesocycleWeek?.phase ?? competitionContext?.phase ?? null;
  const feedbackIndex = await buildPlannerSuggestionFeedbackIndex({
    athleteId: input.athleteId,
    phase,
    competitionPriority: competitionContext?.competitionPriority ?? null,
  });
  const slots = defaultMicrocycleSlots(phase, mesocycleWeek);
  const nearbyAssignedPlans = await loadAssignedPlansForWindow(
    input.athleteId,
    shiftDate(input.startDate, -3),
    shiftDate(input.startDate, (slots[slots.length - 1]?.dayOffset ?? 0) + 3),
  );
  const pack = buildTemplatePackRecommendation({
    templates,
    phase,
    competitionContext,
    mesocycleWeek,
    startDate: input.startDate,
    nearbyAssignedPlans,
    feedbackIndex,
  });

  return {
    athleteId: input.athleteId,
    startDate: input.startDate,
    competitionContext,
    pack,
  };
}
