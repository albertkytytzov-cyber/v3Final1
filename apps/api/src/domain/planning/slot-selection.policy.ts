import type {
  AssignedPlanSummary,
  MesocycleWeekContext,
  PlanTemplateSummary,
  PlannerSuggestionFeedback,
} from "@training-platform/shared";
import {
  getTargetSlotLoad,
  normalizeMicrocycleType,
} from "./load-balance.policy";
import type {
  PlannerSlot,
  TemplateLoadRecommendation,
  TemplateScoredRecommendation,
} from "./planning.types";
import {
  getTemplateFeedbackBias,
  scoreTemplateRecommendation,
} from "./scoring.policy";

export { normalizeMicrocycleType };

export function defaultMicrocycleSlots(
  phase: AssignedPlanSummary["plannedPhase"],
  mesocycleWeek: MesocycleWeekContext | null,
) {
  const mesocycleMicrocycleType = normalizeMicrocycleType(mesocycleWeek?.microcycleType);

  if (mesocycleMicrocycleType === "shock") {
    return [
      { dayOffset: 0, dayLabel: "Day 1", microcycleType: "load", slotWeight: 1.25 },
      { dayOffset: 1, dayLabel: "Day 2", microcycleType: "load", slotWeight: 1.15 },
      { dayOffset: 2, dayLabel: "Day 3", microcycleType: "support", slotWeight: 0.8 },
      { dayOffset: 3, dayLabel: "Day 4", microcycleType: "load", slotWeight: 1.2 },
      { dayOffset: 4, dayLabel: "Day 5", microcycleType: "recovery", slotWeight: 0.6 },
    ] satisfies PlannerSlot[];
  }

  if (mesocycleMicrocycleType === "impact") {
    return [
      { dayOffset: 0, dayLabel: "Day 1", microcycleType: "load", slotWeight: 1.1 },
      { dayOffset: 1, dayLabel: "Day 2", microcycleType: "support", slotWeight: 0.8 },
      { dayOffset: 2, dayLabel: "Day 3", microcycleType: "specific", slotWeight: 0.95 },
      { dayOffset: 3, dayLabel: "Day 4", microcycleType: "load", slotWeight: 1.05 },
      { dayOffset: 4, dayLabel: "Day 5", microcycleType: "recovery", slotWeight: 0.65 },
    ] satisfies PlannerSlot[];
  }

  if (mesocycleMicrocycleType === "competition") {
    return [
      { dayOffset: 0, dayLabel: "Day 1", microcycleType: "activation", slotWeight: 0.7 },
      { dayOffset: 1, dayLabel: "Day 2", microcycleType: "specific", slotWeight: 0.9 },
      { dayOffset: 2, dayLabel: "Day 3", microcycleType: "recovery", slotWeight: 0.5 },
      { dayOffset: 3, dayLabel: "Day 4", microcycleType: "activation", slotWeight: 0.6 },
    ] satisfies PlannerSlot[];
  }

  if (
    mesocycleMicrocycleType === "taper" ||
    phase === "taper" ||
    phase === "competition"
  ) {
    return [
      { dayOffset: 0, dayLabel: "Day 1", microcycleType: "activation", slotWeight: 0.75 },
      { dayOffset: 1, dayLabel: "Day 2", microcycleType: "specific", slotWeight: 0.95 },
      { dayOffset: 2, dayLabel: "Day 3", microcycleType: "recovery", slotWeight: 0.55 },
      { dayOffset: 3, dayLabel: "Day 4", microcycleType: "activation", slotWeight: 0.65 },
    ] satisfies PlannerSlot[];
  }

  if (mesocycleMicrocycleType === "recovery" || phase === "recovery") {
    return [
      { dayOffset: 0, dayLabel: "Day 1", microcycleType: "recovery", slotWeight: 0.65 },
      { dayOffset: 1, dayLabel: "Day 2", microcycleType: "mobility", slotWeight: 0.45 },
      { dayOffset: 2, dayLabel: "Day 3", microcycleType: "activation", slotWeight: 0.55 },
    ] satisfies PlannerSlot[];
  }

  return [
    { dayOffset: 0, dayLabel: "Day 1", microcycleType: "load", slotWeight: 1 },
    { dayOffset: 1, dayLabel: "Day 2", microcycleType: "support", slotWeight: 0.78 },
    { dayOffset: 2, dayLabel: "Day 3", microcycleType: "load", slotWeight: 1 },
    { dayOffset: 3, dayLabel: "Day 4", microcycleType: "recovery", slotWeight: 0.62 },
    { dayOffset: 4, dayLabel: "Day 5", microcycleType: "specific", slotWeight: 0.9 },
  ] satisfies PlannerSlot[];
}

export function chooseTemplateForSlot(
  templates: PlanTemplateSummary[],
  phase: AssignedPlanSummary["plannedPhase"],
  competitionContext: AssignedPlanSummary["competitionContextSnapshot"],
  slot: PlannerSlot,
  previousTemplateIds: string[],
  previousLoad: number | null,
  adjacentCalendarLoads: number[],
  sameDateAssignedCount: number,
  mesocycleWeek: MesocycleWeekContext | null,
  feedbackIndex: Map<string, PlannerSuggestionFeedback> | null = null,
  slots?: PlannerSlot[],
): TemplateScoredRecommendation | null {
  const targetSlotLoad =
    slots && slots.length ? getTargetSlotLoad(slots, slot, mesocycleWeek) : null;

  const ranked = templates
    .map((template) => {
      const base = scoreTemplateRecommendation(template, competitionContext);
      let score = base.score;
      const reason = [base.reason];
      const historyBias = getTemplateFeedbackBias({
        template,
        desiredMicrocycleType: slot.microcycleType,
        selectionIntent: "slot",
        feedbackIndex,
        targetSlotLoad,
      });

      if (phase && template.phaseFocus === phase) {
        score += 2;
      }

      if (
        template.microcycleType &&
        template.microcycleType.toLowerCase() === slot.microcycleType.toLowerCase()
      ) {
        score += 3;
        reason.push(`microcycle match: ${slot.microcycleType}`);
      }

      const repeatCount = previousTemplateIds.filter((id) => id === template.id).length;
      if (repeatCount > 0) {
        score -= repeatCount * 4;
        reason.push(`repeat penalty x${repeatCount}`);
      }

      if (previousTemplateIds[previousTemplateIds.length - 1] === template.id) {
        score -= 6;
        reason.push("back-to-back repeat penalty");
      }

      if (previousLoad !== null) {
        const loadDelta = Math.abs(template.estimatedLoad - previousLoad);
        if (loadDelta > 180) {
          score -= 8;
          reason.push("hard load jump penalty");
        } else if (loadDelta > 120) {
          score -= 4;
          reason.push("load jump penalty");
        } else if (loadDelta > 80) {
          score -= 2;
          reason.push("soft load jump penalty");
        } else if (loadDelta < 20) {
          score += 1;
          reason.push("balanced load transition");
        }
      }

      for (const adjacentLoad of adjacentCalendarLoads) {
        const loadDelta = Math.abs(template.estimatedLoad - adjacentLoad);
        if (loadDelta > 200) {
          score -= 7;
          reason.push("calendar-adjacent load jump");
        } else if (loadDelta > 140) {
          score -= 3;
          reason.push("calendar proximity penalty");
        }
      }

      if (sameDateAssignedCount > 0) {
        score -= sameDateAssignedCount * 5;
        reason.push("existing assignment on same date");
      }

      if (mesocycleWeek) {
        if (normalizeMicrocycleType(template.microcycleType) === mesocycleWeek.microcycleType) {
          score += 2;
          reason.push(`mesocycle week match: ${mesocycleWeek.microcycleType}`);
        }

        if (
          (mesocycleWeek.microcycleType === "recovery" || mesocycleWeek.microcycleType === "taper") &&
          template.estimatedLoad <= 220
        ) {
          score += 2;
          reason.push("recovery/taper load protected");
        }

        if (
          (mesocycleWeek.microcycleType === "shock" || mesocycleWeek.microcycleType === "impact") &&
          template.estimatedLoad >= 220
        ) {
          score += 2;
          reason.push("impact week load supported");
        }
      }

      if (targetSlotLoad !== null) {
        const targetDelta = Math.abs(template.estimatedLoad - targetSlotLoad);
        if (targetDelta <= 35) {
          score += 4;
          reason.push("slot load close to mesocycle target");
        } else if (targetDelta <= 70) {
          score += 2;
          reason.push("slot load within mesocycle range");
        } else if (targetDelta >= 180) {
          score -= 5;
          reason.push("far from mesocycle target load");
        } else if (targetDelta >= 120) {
          score -= 3;
          reason.push("off mesocycle target load");
        }
      }

      if (historyBias.scoreDelta) {
        score += historyBias.scoreDelta;
        reason.push(...historyBias.reasons);
      }

      return {
        ...base,
        score,
        reason: reason.join(", "),
        estimatedLoad: template.estimatedLoad,
        historyBiases: historyBias.historyBiases,
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score || left.templateName.localeCompare(right.templateName),
    );

  return ranked[0] ?? null;
}

export function recommendTemplateForMicrocycle(
  templates: PlanTemplateSummary[],
  desiredMicrocycleType: string,
  phase: AssignedPlanSummary["plannedPhase"],
  competitionContext: AssignedPlanSummary["competitionContextSnapshot"],
  excludeTemplateIds: string[] = [],
  feedbackIndex: Map<string, PlannerSuggestionFeedback> | null = null,
): TemplateLoadRecommendation | null {
  const ranked = templates
    .filter((template) => !excludeTemplateIds.includes(template.id))
    .map((template) => {
      const base = scoreTemplateRecommendation(template, competitionContext);
      let score = base.score;
      const historyBias = getTemplateFeedbackBias({
        template,
        desiredMicrocycleType,
        selectionIntent: "slot",
        feedbackIndex,
        targetSlotLoad: null,
      });

      if (phase && template.phaseFocus === phase) {
        score += 2;
      }

      if (
        normalizeMicrocycleType(template.microcycleType) ===
        normalizeMicrocycleType(desiredMicrocycleType)
      ) {
        score += 4;
      }

      score += historyBias.scoreDelta;

      return {
        templateId: template.id,
        templateName: template.name,
        estimatedLoad: template.estimatedLoad,
        score,
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score || left.templateName.localeCompare(right.templateName),
    );

  return ranked[0] ?? null;
}

export function recommendLighterTemplateForItem(
  templates: PlanTemplateSummary[],
  packItem: {
    templateId: string;
    microcycleType: string;
    estimatedLoad: number;
  },
  phase: AssignedPlanSummary["plannedPhase"],
  competitionContext: AssignedPlanSummary["competitionContextSnapshot"],
  feedbackIndex: Map<string, PlannerSuggestionFeedback> | null = null,
): TemplateLoadRecommendation | null {
  const candidates = templates
    .filter(
      (template) =>
        template.id !== packItem.templateId &&
        template.estimatedLoad < packItem.estimatedLoad &&
        (
          normalizeMicrocycleType(template.microcycleType) ===
            normalizeMicrocycleType(packItem.microcycleType) ||
          normalizeMicrocycleType(template.microcycleType) === "support" ||
          normalizeMicrocycleType(template.microcycleType) === "recovery" ||
          normalizeMicrocycleType(template.microcycleType) === "activation"
        ),
    )
    .map((template) => {
      const base = scoreTemplateRecommendation(template, competitionContext);
      let score = base.score;
      const historyBias = getTemplateFeedbackBias({
        template,
        desiredMicrocycleType: packItem.microcycleType,
        selectionIntent: "lighter",
        feedbackIndex,
        targetSlotLoad: null,
      });

      if (phase && template.phaseFocus === phase) {
        score += 2;
      }

      if (
        normalizeMicrocycleType(template.microcycleType) ===
        normalizeMicrocycleType(packItem.microcycleType)
      ) {
        score += 3;
      }

      const loadRelief = packItem.estimatedLoad - template.estimatedLoad;
      score += Math.min(5, Math.max(1, Math.round(loadRelief / 40)));
      score += historyBias.scoreDelta;

      return {
        templateId: template.id,
        templateName: template.name,
        estimatedLoad: template.estimatedLoad,
        score,
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score || left.templateName.localeCompare(right.templateName),
    );

  return candidates[0] ?? null;
}

export function recommendHeavierTemplateForItem(
  templates: PlanTemplateSummary[],
  packItem: {
    templateId: string;
    microcycleType: string;
    estimatedLoad: number;
  },
  phase: AssignedPlanSummary["plannedPhase"],
  competitionContext: AssignedPlanSummary["competitionContextSnapshot"],
  feedbackIndex: Map<string, PlannerSuggestionFeedback> | null = null,
): TemplateLoadRecommendation | null {
  const candidates = templates
    .filter(
      (template) =>
        template.id !== packItem.templateId &&
        template.estimatedLoad > packItem.estimatedLoad &&
        (
          normalizeMicrocycleType(template.microcycleType) ===
            normalizeMicrocycleType(packItem.microcycleType) ||
          normalizeMicrocycleType(template.microcycleType) === "load" ||
          normalizeMicrocycleType(template.microcycleType) === "specific"
        ),
    )
    .map((template) => {
      const base = scoreTemplateRecommendation(template, competitionContext);
      let score = base.score;
      const historyBias = getTemplateFeedbackBias({
        template,
        desiredMicrocycleType: packItem.microcycleType,
        selectionIntent: "heavier",
        feedbackIndex,
        targetSlotLoad: null,
      });

      if (phase && template.phaseFocus === phase) {
        score += 2;
      }

      if (
        normalizeMicrocycleType(template.microcycleType) ===
        normalizeMicrocycleType(packItem.microcycleType)
      ) {
        score += 3;
      }

      const loadIncrease = template.estimatedLoad - packItem.estimatedLoad;
      score += Math.min(5, Math.max(1, Math.round(loadIncrease / 40)));
      score += historyBias.scoreDelta;

      return {
        templateId: template.id,
        templateName: template.name,
        estimatedLoad: template.estimatedLoad,
        score,
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score || left.templateName.localeCompare(right.templateName),
    );

  return candidates[0] ?? null;
}
