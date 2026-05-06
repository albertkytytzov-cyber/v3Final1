import type {
  AssignedPlanSummary,
  CompetitionPlanSummary,
  MesocycleWeekContext,
  PlanTemplateSummary,
  PlannerSuggestion,
  PlannerSuggestionFeedback,
  PlannerWarning,
} from "@training-platform/shared";
import {
  diffDaysBetween,
  estimateAssignedPlanLoad,
  shiftDate,
} from "./load-balance.policy";
import { type TemplatePackDraftItem } from "./planning.types";
import {
  normalizeMicrocycleType,
  recommendHeavierTemplateForItem,
  recommendLighterTemplateForItem,
  recommendTemplateForMicrocycle,
} from "./slot-selection.policy";

export function buildPlannerWarnings(
  phase: AssignedPlanSummary["plannedPhase"],
  packItems: TemplatePackDraftItem[],
  nearbyAssignedPlans: AssignedPlanSummary[],
  startDate: string,
  competitionPriority: CompetitionPlanSummary["priority"] | null,
  mesocycleWeek: MesocycleWeekContext | null,
  totalPlannedLoad: number,
) {
  const warnings: PlannerWarning[] = [];
  const upcoming = packItems.map((item) => ({
    date: shiftDate(startDate, item.dayOffset),
    estimatedLoad: item.estimatedLoad,
    microcycleType: item.microcycleType,
    source: "planned" as const,
  }));
  const nearby = nearbyAssignedPlans.map((plan) => ({
    date: plan.day.dayDate,
    estimatedLoad: estimateAssignedPlanLoad(plan),
    microcycleType: plan.templateName,
    source: "existing" as const,
  }));

  const combined = [...nearby, ...upcoming].sort((a, b) => a.date.localeCompare(b.date));
  const highLoadDays = combined.filter((item) => item.estimatedLoad >= 320);

  for (let index = 0; index < highLoadDays.length; index += 1) {
    const window = highLoadDays.slice(index, index + 3);
    if (
      window.length >= 2 &&
      diffDaysBetween(window[0].date, window[window.length - 1].date) <= 2
    ) {
      warnings.push({
        code: "high_load_density",
        level: competitionPriority === "A" ? "critical" : "warning",
        message: "Too much high-load density around the planned microcycle.",
      });
      break;
    }
  }

  const hasRecovery = combined.some(
    (item) =>
      normalizeMicrocycleType(item.microcycleType).includes("recovery") ||
      normalizeMicrocycleType(item.microcycleType).includes("mobility") ||
      item.estimatedLoad <= 140,
  );
  if (!hasRecovery) {
    warnings.push({
      code: "low_recovery",
      level: "warning",
      message: "Too little recovery across nearby assigned days and proposed slots.",
    });
  }

  if (
    (phase === "taper" || phase === "competition") &&
    upcoming.some(
      (item) =>
        item.estimatedLoad > 220 || normalizeMicrocycleType(item.microcycleType) === "load",
    )
  ) {
    warnings.push({
      code: "taper_violated",
      level: "critical",
      message: "Taper is violated by a high-load or load-oriented day too close to competition.",
    });
  }

  if (
    combined.some(
      (item, index) =>
        index > 0 && Math.abs(item.estimatedLoad - combined[index - 1].estimatedLoad) > 150,
    )
  ) {
    warnings.push({
      code: "weekly_load_jump",
      level: "warning",
      message: "Weekly load jumps too sharply between adjacent calendar days.",
    });
  }

  if (
    upcoming.some((item) =>
      nearbyAssignedPlans.some((plan) => plan.day.dayDate === item.date),
    )
  ) {
    warnings.push({
      code: "calendar_overlap",
      level: "warning",
      message: "One or more proposed days overlap with already assigned calendar dates.",
    });
  }

  if (mesocycleWeek) {
    const maxDelta = Math.max(110, Math.round(mesocycleWeek.targetLoad * 0.18));
    const targetLoadDelta = Number((totalPlannedLoad - mesocycleWeek.targetLoad).toFixed(1));

    if (targetLoadDelta > maxDelta) {
      warnings.push({
        code: "mesocycle_target_above",
        level:
          mesocycleWeek.microcycleType === "recovery" || mesocycleWeek.microcycleType === "taper"
            ? "critical"
            : "warning",
        message: `Planned weekly load exceeds mesocycle target by ${targetLoadDelta}.`,
      });
    } else if (targetLoadDelta < -maxDelta) {
      warnings.push({
        code: "mesocycle_target_below",
        level:
          mesocycleWeek.microcycleType === "shock" || mesocycleWeek.microcycleType === "impact"
            ? "warning"
            : "info",
        message: `Planned weekly load sits below mesocycle target by ${Math.abs(targetLoadDelta)}.`,
      });
    }

    const packHighLoadDays = upcoming.filter((item) => item.estimatedLoad >= 280).length;
    const packRecoveryDays = upcoming.filter(
      (item) =>
        normalizeMicrocycleType(item.microcycleType).includes("recovery") ||
        normalizeMicrocycleType(item.microcycleType).includes("mobility") ||
        item.estimatedLoad <= 140,
    ).length;

    if (
      (mesocycleWeek.microcycleType === "recovery" || mesocycleWeek.microcycleType === "taper") &&
      (packHighLoadDays > 1 || packRecoveryDays === 0)
    ) {
      warnings.push({
        code: "mesocycle_week_mismatch",
        level: "critical",
        message: `The pack does not respect the ${mesocycleWeek.microcycleType} intent of the active mesocycle week.`,
      });
    }

    if (
      (mesocycleWeek.microcycleType === "shock" || mesocycleWeek.microcycleType === "impact") &&
      packHighLoadDays === 0
    ) {
      warnings.push({
        code: "mesocycle_week_mismatch",
        level: "warning",
        message: `The pack is too conservative for the ${mesocycleWeek.microcycleType} mesocycle week intent.`,
      });
    }
  }

  return warnings;
}

export function buildPlannerSuggestions(
  phase: AssignedPlanSummary["plannedPhase"],
  packItems: TemplatePackDraftItem[],
  nearbyAssignedPlans: AssignedPlanSummary[],
  warnings: PlannerWarning[],
  templates: PlanTemplateSummary[],
  competitionContext: AssignedPlanSummary["competitionContextSnapshot"],
  startDate: string,
  mesocycleWeek: MesocycleWeekContext | null,
  feedbackIndex: Map<string, PlannerSuggestionFeedback> | null,
) {
  const suggestions: PlannerSuggestion[] = [];
  const templateDayIndex = (template: { templateDayIndex?: number } | null | undefined) =>
    template?.templateDayIndex ?? null;
  const pushSuggestion = (suggestion: Omit<PlannerSuggestion, "feedback">) => {
    if (
      suggestions.some(
        (item) =>
          item.code === suggestion.code &&
          item.dayOffset === suggestion.dayOffset &&
          item.targetDayOffset === suggestion.targetDayOffset &&
          item.recommendedTemplateId === suggestion.recommendedTemplateId,
      )
    ) {
      return;
    }

    suggestions.push({
      ...suggestion,
      feedback: null,
    });
  };

  const highestLoadItem = [...packItems].sort(
    (left, right) => right.estimatedLoad - left.estimatedLoad,
  )[0];
  const recoveryTemplate = recommendTemplateForMicrocycle(
    templates,
    "recovery",
    phase,
    competitionContext,
    highestLoadItem ? [highestLoadItem.templateId] : [],
    feedbackIndex,
  );
  const activationTemplate = recommendTemplateForMicrocycle(
    templates,
    "activation",
    phase,
    competitionContext,
    highestLoadItem ? [highestLoadItem.templateId] : [],
    feedbackIndex,
  );
  const lowestLoadItem = [...packItems].sort(
    (left, right) => left.estimatedLoad - right.estimatedLoad,
  )[0];

  for (const warning of warnings) {
    if (warning.code === "high_load_density" && highestLoadItem) {
      const lighterTemplate = recommendLighterTemplateForItem(
        templates,
        highestLoadItem,
        phase,
        competitionContext,
        feedbackIndex,
      );
      pushSuggestion({
        code: "reduce_slot_load",
        action: "reduce_load",
        message: `Reduce load on ${highestLoadItem.templateName} (Day ${
          highestLoadItem.dayOffset + 1
        }) to break up dense high-load clustering.`,
        dayOffset: highestLoadItem.dayOffset,
        targetDayOffset: null,
        recommendedTemplateId: lighterTemplate?.templateId ?? null,
        recommendedTemplateName: lighterTemplate?.templateName ?? null,
        recommendedTemplateDayIndex: templateDayIndex(lighterTemplate),
      });

      if (recoveryTemplate) {
        pushSuggestion({
          code: "recover_day_swap",
          action: "swap_to_recovery",
          message: `Swap Day ${highestLoadItem.dayOffset + 1} to recovery using ${
            recoveryTemplate.templateName
          }.`,
          dayOffset: highestLoadItem.dayOffset,
          targetDayOffset: null,
          recommendedTemplateId: recoveryTemplate.templateId,
          recommendedTemplateName: recoveryTemplate.templateName,
          recommendedTemplateDayIndex: templateDayIndex(recoveryTemplate),
        });
      }
    }

    if (warning.code === "low_recovery" && highestLoadItem && recoveryTemplate) {
      pushSuggestion({
        code: "recover_day_swap",
        action: "swap_to_recovery",
        message: `Replace Day ${highestLoadItem.dayOffset + 1} with a recovery slot via ${
          recoveryTemplate.templateName
        }.`,
        dayOffset: highestLoadItem.dayOffset,
        targetDayOffset: null,
        recommendedTemplateId: recoveryTemplate.templateId,
        recommendedTemplateName: recoveryTemplate.templateName,
        recommendedTemplateDayIndex: templateDayIndex(recoveryTemplate),
      });
    }

    if (warning.code === "taper_violated") {
      const taperViolatingItem =
        packItems.find(
          (item) =>
            item.estimatedLoad > 220 ||
            normalizeMicrocycleType(item.microcycleType) === "load",
        ) ?? highestLoadItem;

      if (taperViolatingItem) {
        const recommendedTemplate =
          activationTemplate ??
          recommendTemplateForMicrocycle(
            templates,
            "recovery",
            phase,
            competitionContext,
            [taperViolatingItem.templateId],
            feedbackIndex,
          );

        pushSuggestion({
          code: "activation_swap",
          action: activationTemplate ? "swap_to_activation" : "swap_to_recovery",
          message: recommendedTemplate
            ? `Taper-safe change: replace Day ${taperViolatingItem.dayOffset + 1} with ${
                recommendedTemplate.templateName
              }.`
            : `Taper-safe change: reduce Day ${taperViolatingItem.dayOffset + 1} and keep only activation/recovery content.`,
          dayOffset: taperViolatingItem.dayOffset,
          targetDayOffset: null,
          recommendedTemplateId: recommendedTemplate?.templateId ?? null,
          recommendedTemplateName: recommendedTemplate?.templateName ?? null,
          recommendedTemplateDayIndex: templateDayIndex(recommendedTemplate),
        });
      }
    }

    if (warning.code === "weekly_load_jump" && highestLoadItem) {
      const lighterTemplate = recommendLighterTemplateForItem(
        templates,
        highestLoadItem,
        phase,
        competitionContext,
        feedbackIndex,
      );
      const previousItem = packItems.find(
        (item) => item.dayOffset === highestLoadItem.dayOffset - 1,
      );
      pushSuggestion({
        code: "reduce_slot_load",
        action: "reduce_load",
        message: previousItem
          ? `Soften the jump between Day ${previousItem.dayOffset + 1} and Day ${
              highestLoadItem.dayOffset + 1
            } by reducing the heavier slot.`
          : `Reduce the heaviest slot on Day ${highestLoadItem.dayOffset + 1} to smooth the weekly load curve.`,
        dayOffset: highestLoadItem.dayOffset,
        targetDayOffset: null,
        recommendedTemplateId: lighterTemplate?.templateId ?? null,
        recommendedTemplateName: lighterTemplate?.templateName ?? null,
        recommendedTemplateDayIndex: templateDayIndex(lighterTemplate),
      });
    }

    if (warning.code === "calendar_overlap") {
      const overlappingItem = packItems.find((item) =>
        nearbyAssignedPlans.some((plan) => plan.day.dayDate === shiftDate(startDate, item.dayOffset)),
      );

      if (overlappingItem) {
        pushSuggestion({
          code: "resolve_overlap",
          action: "avoid_overlap",
          message: `Avoid calendar overlap on Day ${overlappingItem.dayOffset + 1}; keep only one primary session on that date.`,
          dayOffset: overlappingItem.dayOffset,
          targetDayOffset: overlappingItem.dayOffset + 1,
          recommendedTemplateId: null,
          recommendedTemplateName: null,
          recommendedTemplateDayIndex: null,
        });
      }

      const specificItem = packItems.find(
        (item) => normalizeMicrocycleType(item.microcycleType) === "specific",
      );
      if (specificItem) {
        pushSuggestion({
          code: "move_specific_day",
          action: "move_day",
          message: `Move the specific day from Day ${specificItem.dayOffset + 1} to Day ${
            specificItem.dayOffset + 2
          } if the calendar remains crowded.`,
          dayOffset: specificItem.dayOffset,
          targetDayOffset: specificItem.dayOffset + 1,
          recommendedTemplateId: specificItem.templateId,
          recommendedTemplateName: specificItem.templateName,
          recommendedTemplateDayIndex: specificItem.templateDayIndex ?? null,
        });
      }
    }

    if (warning.code === "mesocycle_target_above" && highestLoadItem) {
      const lighterTemplate = recommendLighterTemplateForItem(
        templates,
        highestLoadItem,
        phase,
        competitionContext,
        feedbackIndex,
      );
      pushSuggestion({
        code: "reduce_slot_load",
        action: "reduce_load",
        message: `Bring the week back toward mesocycle target by reducing Day ${
          highestLoadItem.dayOffset + 1
        }.`,
        dayOffset: highestLoadItem.dayOffset,
        targetDayOffset: null,
        recommendedTemplateId: lighterTemplate?.templateId ?? null,
        recommendedTemplateName: lighterTemplate?.templateName ?? null,
        recommendedTemplateDayIndex: templateDayIndex(lighterTemplate),
      });
    }

    if (warning.code === "mesocycle_target_below" && lowestLoadItem) {
      const heavierTemplate = recommendHeavierTemplateForItem(
        templates,
        lowestLoadItem,
        phase,
        competitionContext,
        feedbackIndex,
      );

      pushSuggestion({
        code: "increase_slot_load",
        action: "increase_load",
        message: `Increase Day ${lowestLoadItem.dayOffset + 1} to better meet mesocycle target load.`,
        dayOffset: lowestLoadItem.dayOffset,
        targetDayOffset: null,
        recommendedTemplateId: heavierTemplate?.templateId ?? null,
        recommendedTemplateName: heavierTemplate?.templateName ?? null,
        recommendedTemplateDayIndex: templateDayIndex(heavierTemplate),
      });
    }

    if (
      warning.code === "mesocycle_week_mismatch" &&
      mesocycleWeek &&
      highestLoadItem
    ) {
      if (
        mesocycleWeek.microcycleType === "recovery" ||
        mesocycleWeek.microcycleType === "taper"
      ) {
        if (recoveryTemplate) {
          pushSuggestion({
            code: "recover_day_swap",
            action: "swap_to_recovery",
            message: `Align the pack with the ${mesocycleWeek.microcycleType} week by converting the heaviest day to recovery.`,
            dayOffset: highestLoadItem.dayOffset,
            targetDayOffset: null,
            recommendedTemplateId: recoveryTemplate.templateId,
            recommendedTemplateName: recoveryTemplate.templateName,
            recommendedTemplateDayIndex: templateDayIndex(recoveryTemplate),
          });
        }
      } else if (
        (mesocycleWeek.microcycleType === "shock" || mesocycleWeek.microcycleType === "impact") &&
        lowestLoadItem
      ) {
        const heavierTemplate = recommendHeavierTemplateForItem(
          templates,
          lowestLoadItem,
          phase,
          competitionContext,
          feedbackIndex,
        );

        pushSuggestion({
          code: "increase_slot_load",
          action: "increase_load",
          message: `Increase one of the lighter slots to respect the ${mesocycleWeek.microcycleType} week intent.`,
          dayOffset: lowestLoadItem.dayOffset,
          targetDayOffset: null,
          recommendedTemplateId: heavierTemplate?.templateId ?? null,
          recommendedTemplateName: heavierTemplate?.templateName ?? null,
          recommendedTemplateDayIndex: templateDayIndex(heavierTemplate),
        });
      }
    }
  }

  const labelRank = {
    historically_effective: 3,
    mixed: 2,
    new: 1,
    watch: 0,
  } satisfies Record<NonNullable<PlannerSuggestion["feedback"]>["label"], number>;

  return suggestions
    .map((suggestion, index) => ({
      suggestion: {
        ...suggestion,
        feedback:
          feedbackIndex?.get(`${suggestion.code}:${suggestion.action}`) ?? null,
      },
      index,
    }))
    .sort((left, right) => {
      const leftFeedback = left.suggestion.feedback;
      const rightFeedback = right.suggestion.feedback;
      const feedbackDelta =
        (rightFeedback ? labelRank[rightFeedback.label] * 10 + rightFeedback.netScore : 0) -
        (leftFeedback ? labelRank[leftFeedback.label] * 10 + leftFeedback.netScore : 0);

      if (feedbackDelta !== 0) {
        return feedbackDelta;
      }

      return left.index - right.index;
    })
    .map((entry) => entry.suggestion);
}
