import type { TemplatePackRecommendation } from "@training-platform/shared";
import {
  estimateAssignedPlanLoad,
} from "./load-balance.policy";
import type { BuildTemplatePackInput, TemplatePackDraftItem } from "./planning.types";
import {
  defaultMicrocycleSlots,
  chooseTemplateForSlot,
} from "./slot-selection.policy";
import {
  buildPlannerSuggestions,
  buildPlannerWarnings,
} from "./planner-intelligence.engine";

export function buildTemplatePackRecommendation(
  input: BuildTemplatePackInput,
): TemplatePackRecommendation {
  const slots = defaultMicrocycleSlots(input.phase, input.mesocycleWeek);
  const items: TemplatePackDraftItem[] = [];
  const selectedTemplateKeys: string[] = [];
  let previousLoad: number | null = null;

  for (const slot of slots) {
    const slotDate = new Date(`${input.startDate}T00:00:00Z`);
    slotDate.setUTCDate(slotDate.getUTCDate() + slot.dayOffset);
    const slotDateText = slotDate.toISOString().slice(0, 10);
    const sameDateAssignedCount = input.nearbyAssignedPlans.filter(
      (plan) => plan.day.dayDate === slotDateText,
    ).length;
    const adjacentCalendarLoads = input.nearbyAssignedPlans
      .filter((plan) => {
        const planDate = new Date(`${plan.day.dayDate}T00:00:00Z`).getTime();
        const currentDate = new Date(`${slotDateText}T00:00:00Z`).getTime();
        return Math.abs((planDate - currentDate) / (24 * 60 * 60 * 1000)) <= 1;
      })
      .map((plan) => estimateAssignedPlanLoad(plan));

    const recommendation = chooseTemplateForSlot(
      input.templates,
      input.phase,
      input.competitionContext,
      slot,
      selectedTemplateKeys,
      previousLoad,
      adjacentCalendarLoads,
      sameDateAssignedCount,
      input.mesocycleWeek,
      input.feedbackIndex,
      slots,
    );

    if (!recommendation) {
      continue;
    }

    items.push({
      templateId: recommendation.templateId,
      templateName: recommendation.templateName,
      dayOffset: slot.dayOffset,
      dayLabel: slot.dayLabel,
      microcycleType: slot.microcycleType,
      templateDayIndex: recommendation.templateDayIndex,
      score: recommendation.score,
      reason: recommendation.reason,
      estimatedLoad: recommendation.estimatedLoad,
      historyBiases: recommendation.historyBiases,
    });
    selectedTemplateKeys.push(recommendation.selectionKey);
    previousLoad = recommendation.estimatedLoad;
  }

  const totalPlannedLoad = Number(
    items.reduce((sum, item) => sum + item.estimatedLoad, 0).toFixed(1),
  );
  const targetLoadDelta = input.mesocycleWeek
    ? Number((totalPlannedLoad - input.mesocycleWeek.targetLoad).toFixed(1))
    : null;
  const uniqueTemplates = new Set(items.map((item) => item.templateId)).size;
  const varietyScore = items.length ? Number((uniqueTemplates / items.length).toFixed(2)) : 0;
  const loadBalanceLabel =
    items.length <= 1
      ? "single-day"
      : items.some(
            (item, index) =>
              index > 0 &&
              Math.abs(item.estimatedLoad - items[index - 1].estimatedLoad) > 120,
          )
        ? "volatile"
        : "balanced";
  const warnings = buildPlannerWarnings(
    input.phase,
    items,
    input.nearbyAssignedPlans,
    input.startDate,
    input.competitionContext?.competitionPriority ?? null,
    input.mesocycleWeek,
    totalPlannedLoad,
  );
  const suggestions = buildPlannerSuggestions(
    input.phase,
    items,
    input.nearbyAssignedPlans,
    warnings,
    input.templates,
    input.competitionContext,
    input.startDate,
    input.mesocycleWeek,
    input.feedbackIndex,
  );

  return {
    phase: input.phase,
    competitionPriority: input.competitionContext?.competitionPriority ?? null,
    mesocycleWeek: input.mesocycleWeek,
    suggestedDays: items.length,
    totalPlannedLoad,
    targetLoadDelta,
    varietyScore,
    loadBalanceLabel,
    nearbyAssignedDays: input.nearbyAssignedPlans.length,
    nearbyAssignedPlanSummaries: input.nearbyAssignedPlans.map((plan) => ({
      assignedPlanId: plan.id,
      date: plan.day.dayDate,
      templateName: plan.templateName,
      plannedPhase: plan.plannedPhase,
      estimatedLoad: estimateAssignedPlanLoad(plan),
    })),
    warnings,
    suggestions,
    items,
  };
}
