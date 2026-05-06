import type {
  AssignedPlanSummary,
  PlanTemplateRecommendation,
  PlanTemplateSummary,
  PlannerSuggestion,
  PlannerSuggestionFeedback,
} from "@training-platform/shared";
import { normalizeMicrocycleType } from "./load-balance.policy";
import type {
  TemplateFeedbackBias,
  TemplateSelectionIntent,
} from "./planning.types";

export function scoreTemplateRecommendation(
  template: PlanTemplateSummary,
  competitionContext: AssignedPlanSummary["competitionContextSnapshot"],
) {
  let score = 0;
  const reasons: string[] = [];

  if (competitionContext?.phase && template.phaseFocus === competitionContext.phase) {
    score += 5;
    reasons.push(`phase match: ${competitionContext.phase}`);
  }

  if (
    competitionContext?.competitionPriority &&
    template.competitionPriorityFocus === competitionContext.competitionPriority
  ) {
    score += 3;
    reasons.push(`priority match: ${competitionContext.competitionPriority}`);
  }

  if (competitionContext?.phase === "taper" || competitionContext?.phase === "competition") {
    if (template.competitionSpecific) {
      score += 2;
      reasons.push("competition-specific template");
    }
  }

  if (!reasons.length) {
    reasons.push("general template fit");
  }

  return {
    templateId: template.id,
    templateName: template.name,
    phaseFocus: template.phaseFocus,
    competitionPriorityFocus: template.competitionPriorityFocus,
    competitionSpecific: template.competitionSpecific,
    score,
    reason: reasons.join(", "),
  } satisfies PlanTemplateRecommendation;
}

export function plannerSuggestionFeedbackKey(
  code: PlannerSuggestion["code"],
  action: PlannerSuggestion["action"],
) {
  return `${code}:${action}`;
}

export function getPlannerFeedbackBiasDelta(feedback: PlannerSuggestionFeedback) {
  let delta = 0;

  if (feedback.label === "historically_effective") {
    delta = 3;
  } else if (feedback.label === "watch") {
    delta = -3;
  } else if (feedback.label === "mixed") {
    if (feedback.netScore >= 1) {
      delta = 1;
    } else if (feedback.netScore <= -1) {
      delta = -1;
    }
  }

  if (!delta) {
    return 0;
  }

  if (feedback.scope === "exact_context") {
    delta += Math.sign(delta);
  } else if (feedback.scope === "phase_context") {
    delta += 0.5 * Math.sign(delta);
  }

  if (feedback.sampleSize >= 4) {
    delta += 0.5 * Math.sign(delta);
  }

  return delta;
}

export function getTemplateFeedbackBias(input: {
  template: PlanTemplateSummary;
  desiredMicrocycleType: string;
  selectionIntent: TemplateSelectionIntent;
  feedbackIndex: Map<string, PlannerSuggestionFeedback> | null;
  targetSlotLoad?: number | null;
  estimatedLoad?: number;
}): TemplateFeedbackBias {
  if (!input.feedbackIndex?.size) {
    return {
      scoreDelta: 0,
      reasons: [],
      historyBiases: [],
    };
  }

  const templateType = normalizeMicrocycleType(input.template.microcycleType);
  const desiredType = normalizeMicrocycleType(input.desiredMicrocycleType);
  const estimatedLoad = input.estimatedLoad ?? input.template.estimatedLoad;
  let scoreDelta = 0;
  const reasons: string[] = [];
  const historyBiases: TemplateFeedbackBias["historyBiases"] = [];

  const applyFeedback = (
    code: PlannerSuggestion["code"],
    action: PlannerSuggestion["action"],
    description: string,
    weight = 1,
  ) => {
    const feedback = input.feedbackIndex?.get(plannerSuggestionFeedbackKey(code, action));

    if (!feedback) {
      return;
    }

    const delta = Math.round(getPlannerFeedbackBiasDelta(feedback) * weight);

    if (!delta) {
      return;
    }

    scoreDelta += delta;
    reasons.push(
      `${delta > 0 ? "history boost" : "history caution"}: ${description} (${feedback.scope}, n=${feedback.sampleSize})`,
    );
    historyBiases.push({
      code,
      action,
      effect: delta > 0 ? "boost" : "caution",
      label: feedback.label,
      scope: feedback.scope,
      netScore: feedback.netScore,
      sampleSize: feedback.sampleSize,
    });
  };

  if (input.selectionIntent !== "heavier") {
    if (
      templateType === "recovery" ||
      templateType === "mobility" ||
      desiredType === "recovery" ||
      desiredType === "mobility"
    ) {
      applyFeedback(
        "recover_day_swap",
        "swap_to_recovery",
        "recovery-style template replacements",
        1.2,
      );
    } else if (templateType === "support" || desiredType === "support") {
      applyFeedback(
        "recover_day_swap",
        "swap_to_recovery",
        "supportive low-load templates",
        0.8,
      );
    }
  }

  if (templateType === "activation" || desiredType === "activation") {
    applyFeedback(
      "activation_swap",
      "swap_to_activation",
      "activation-style template replacements",
      1.1,
    );
  }

  if (input.selectionIntent === "lighter") {
    applyFeedback(
      "reduce_slot_load",
      "reduce_load",
      "lighter substitutions for heavy slots",
      1.25,
    );
  }

  if (input.selectionIntent === "heavier") {
    applyFeedback(
      "increase_slot_load",
      "increase_load",
      "higher-load substitutions for underloaded slots",
      1.25,
    );
  }

  if (
    input.selectionIntent === "slot" &&
    input.targetSlotLoad !== null &&
    input.targetSlotLoad !== undefined
  ) {
    if (estimatedLoad > input.targetSlotLoad + 45) {
      applyFeedback(
        "reduce_slot_load",
        "reduce_load",
        "protecting this slot from overload",
      );
    }

    if (
      estimatedLoad < input.targetSlotLoad - 45 &&
      (
        desiredType === "load" ||
        desiredType === "specific" ||
        templateType === "load" ||
        templateType === "specific"
      )
    ) {
      applyFeedback(
        "increase_slot_load",
        "increase_load",
        "filling underloaded load/specific slots",
      );
    }
  }

  return {
    scoreDelta: Math.max(-6, Math.min(6, scoreDelta)),
    reasons,
    historyBiases,
  };
}
