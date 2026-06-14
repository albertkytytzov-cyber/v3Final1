import type { ConstructorMatrixEvidenceDependencyId } from "./constructor-matrix-evidence";

export type ConstructorMatrixNutritionGuidancePhase =
  | "body_composition"
  | "development"
  | "pre_competition"
  | "taper"
  | "travel"
  | "weigh_in"
  | "competition_day"
  | "post_competition";

export type ConstructorMatrixNutritionAllowedUseNow =
  | "educational_guidance"
  | "review_prompt"
  | "docs_only";

export type ConstructorMatrixNutritionGuidanceItem = {
  id: string;
  phase: ConstructorMatrixNutritionGuidancePhase;
  title: string;
  guidance: readonly string[];
  allowedUseNow: ConstructorMatrixNutritionAllowedUseNow;
  reviewRequired: readonly ("coach" | "medical" | "sport_science")[];
  highRiskBlocked: boolean;
  rationale: string;
  forbiddenUses: readonly string[];
  evidenceDependencyIds: readonly ConstructorMatrixEvidenceDependencyId[];
  limitations: readonly string[];
};

const COMMON_FORBIDDEN = [
  "exact calorie prescription",
  "medical diagnosis",
  "dehydration protocol",
  "rapid weight-cut protocol",
  "diuretic or laxative advice",
  "sweat-suit or spitting protocol",
  "RED-S decision",
] as const;

const COMMON_LIMITATIONS = [
  "educational guidance only",
  "not medical advice",
  "coach and qualified professional review required for high-risk cases",
] as const;

export const CONSTRUCTOR_MATRIX_NUTRITION_GUIDANCE = [
  {
    id: "body_composition_meal_pattern_review_prompt",
    phase: "body_composition",
    title: "Body-composition meal pattern review prompt",
    guidance: [
      "Use a repeatable meal pattern that supports training quality instead of crash restriction.",
      "Coach and qualified support should review appetite, fatigue, recovery and body-mass trend together.",
      "Do not turn body-composition guidance into a rapid weight-cut plan.",
    ],
    allowedUseNow: "educational_guidance",
    reviewRequired: ["coach", "sport_science"],
    highRiskBlocked: false,
    rationale: "Long-horizon body-composition work needs consistency and training support, not last-minute restriction.",
    forbiddenUses: COMMON_FORBIDDEN,
    evidenceDependencyIds: ["perform_evidence_matrix", "acsm_hydration_nutrition"],
    limitations: COMMON_LIMITATIONS,
  },
  {
    id: "muscle_preservation_fueling_prompt",
    phase: "body_composition",
    title: "Muscle-preservation fueling prompt",
    guidance: [
      "Protect hard training quality when body-composition work is active.",
      "Review recovery meals and familiar protein-containing foods with qualified support when needed.",
      "Escalate sudden performance drop, persistent fatigue, illness or RED-S-sensitive concerns.",
    ],
    allowedUseNow: "review_prompt",
    reviewRequired: ["coach", "medical", "sport_science"],
    highRiskBlocked: false,
    rationale: "Body-composition changes should not be treated as progress if strength, recovery or health context deteriorates.",
    forbiddenUses: COMMON_FORBIDDEN,
    evidenceDependencyIds: ["perform_evidence_matrix", "acsm_hydration_nutrition", "recovery_monitoring_consensus"],
    limitations: COMMON_LIMITATIONS,
  },
  {
    id: "body_composition_training_day_recovery_prompt",
    phase: "body_composition",
    title: "Body-composition training-day recovery prompt",
    guidance: [
      "Plan recovery food and normal hydration around strength and mat sessions.",
      "Use body-composition work as a long-horizon habit layer, not as a reason to under-fuel key sessions.",
      "Coach should adjust training density when appetite, sleep or readiness worsens.",
    ],
    allowedUseNow: "educational_guidance",
    reviewRequired: ["coach", "sport_science"],
    highRiskBlocked: false,
    rationale: "Maintaining training output is part of preserving muscle mass while body composition is being reviewed.",
    forbiddenUses: COMMON_FORBIDDEN,
    evidenceDependencyIds: ["perform_evidence_matrix", "recovery_monitoring_consensus", "acsm_hydration_nutrition"],
    limitations: COMMON_LIMITATIONS,
  },
  {
    id: "development_training_day_fueling",
    phase: "development",
    title: "Training-day fueling reminder",
    guidance: [
      "Plan regular meals around training so the athlete does not enter hard work under-fueled.",
      "Use familiar foods that the athlete tolerates well.",
      "Adjust meal timing with the coach when session time changes.",
    ],
    allowedUseNow: "educational_guidance",
    reviewRequired: ["coach"],
    highRiskBlocked: false,
    rationale: "Development blocks need repeatable fueling habits, not aggressive restriction.",
    forbiddenUses: COMMON_FORBIDDEN,
    evidenceDependencyIds: ["perform_evidence_matrix", "acsm_hydration_nutrition"],
    limitations: COMMON_LIMITATIONS,
  },
  {
    id: "pre_competition_recovery_meal_prompt",
    phase: "pre_competition",
    title: "Pre-competition recovery meal prompt",
    guidance: [
      "Prioritize familiar recovery meals after key mat sessions.",
      "Avoid experimenting with new foods during the final preparation block.",
      "Coach should adapt timing to travel, weigh-in and athlete tolerance.",
    ],
    allowedUseNow: "educational_guidance",
    reviewRequired: ["coach"],
    highRiskBlocked: false,
    rationale: "Pre-competition consistency reduces avoidable disruptions.",
    forbiddenUses: COMMON_FORBIDDEN,
    evidenceDependencyIds: ["europe_pre_competition_plan", "acsm_hydration_nutrition"],
    limitations: COMMON_LIMITATIONS,
  },
  {
    id: "taper_freshness_fueling_prompt",
    phase: "taper",
    title: "Taper freshness fueling prompt",
    guidance: [
      "Keep meals familiar and aligned with lower training volume.",
      "Do not use taper days for aggressive restriction without qualified review.",
      "Use coach review when appetite, fatigue or weight concerns change suddenly.",
    ],
    allowedUseNow: "educational_guidance",
    reviewRequired: ["coach"],
    highRiskBlocked: false,
    rationale: "Taper should protect freshness and confidence.",
    forbiddenUses: COMMON_FORBIDDEN,
    evidenceDependencyIds: ["periodization_taper_peaking", "acsm_hydration_nutrition"],
    limitations: COMMON_LIMITATIONS,
  },
  {
    id: "travel_food_planning_prompt",
    phase: "travel",
    title: "Travel food planning prompt",
    guidance: [
      "Plan familiar travel meals and snacks before departure.",
      "Avoid relying on unknown venue food when competition timing is tight.",
      "Use travel day as logistics and recovery support, not extra training load.",
    ],
    allowedUseNow: "educational_guidance",
    reviewRequired: ["coach"],
    highRiskBlocked: false,
    rationale: "Travel fatigue and food access can disrupt readiness.",
    forbiddenUses: COMMON_FORBIDDEN,
    evidenceDependencyIds: ["europe_pre_competition_plan", "acsm_hydration_nutrition"],
    limitations: COMMON_LIMITATIONS,
  },
  {
    id: "weigh_in_review_required_prompt",
    phase: "weigh_in",
    title: "Weigh-in review-required checklist",
    guidance: [
      "Confirm weight-management plan with responsible coach and qualified support.",
      "Do not treat Matrix output as clearance for rapid weight loss.",
      "Escalate symptoms, unusual fatigue or concerning body-mass trend for review.",
    ],
    allowedUseNow: "review_prompt",
    reviewRequired: ["coach", "medical", "sport_science"],
    highRiskBlocked: true,
    rationale: "Weigh-in nutrition and hydration decisions can be high-risk.",
    forbiddenUses: COMMON_FORBIDDEN,
    evidenceDependencyIds: ["ncaa_weight_management", "acsm_hydration_nutrition"],
    limitations: COMMON_LIMITATIONS,
  },
  {
    id: "competition_day_between_bout_prompt",
    phase: "competition_day",
    title: "Competition-day between-bout prompt",
    guidance: [
      "Use familiar between-bout food and drink choices prepared in advance.",
      "Keep tactical review short and avoid new nutrition experiments.",
      "Medical symptoms or dehydration concerns require qualified support.",
    ],
    allowedUseNow: "educational_guidance",
    reviewRequired: ["coach"],
    highRiskBlocked: false,
    rationale: "Competition day guidance should support routines, not prescribe clinical decisions.",
    forbiddenUses: COMMON_FORBIDDEN,
    evidenceDependencyIds: ["wrestling_temporal_structure", "acsm_hydration_nutrition"],
    limitations: COMMON_LIMITATIONS,
  },
  {
    id: "post_competition_recovery_nutrition_prompt",
    phase: "post_competition",
    title: "Post-competition recovery nutrition prompt",
    guidance: [
      "Return to familiar recovery meals and normal routine.",
      "Review body mass, appetite, sleep and pain with the coach before the next block.",
      "Escalate illness, injury or RED-S-sensitive concerns for qualified review.",
    ],
    allowedUseNow: "educational_guidance",
    reviewRequired: ["coach"],
    highRiskBlocked: false,
    rationale: "Post-competition nutrition supports recovery and next-cycle readiness.",
    forbiddenUses: COMMON_FORBIDDEN,
    evidenceDependencyIds: ["recovery_monitoring_consensus", "acsm_hydration_nutrition"],
    limitations: COMMON_LIMITATIONS,
  },
] as const satisfies readonly ConstructorMatrixNutritionGuidanceItem[];

export function buildConstructorMatrixNutritionGuidanceSummary() {
  return {
    guidanceCount: CONSTRUCTOR_MATRIX_NUTRITION_GUIDANCE.length,
    guidanceIds: CONSTRUCTOR_MATRIX_NUTRITION_GUIDANCE.map((item) => item.id),
    reviewRequiredIds: CONSTRUCTOR_MATRIX_NUTRITION_GUIDANCE.filter(
      (item) => item.reviewRequired.length > 0,
    ).map((item) => item.id),
    highRiskBlockedIds: CONSTRUCTOR_MATRIX_NUTRITION_GUIDANCE.filter(
      (item) => item.highRiskBlocked,
    ).map((item) => item.id),
    highRiskBlockedCount: CONSTRUCTOR_MATRIX_NUTRITION_GUIDANCE.filter(
      (item) => item.highRiskBlocked,
    ).length,
    reviewRequiredCount: CONSTRUCTOR_MATRIX_NUTRITION_GUIDANCE.filter(
      (item) => item.reviewRequired.length > 0,
    ).length,
    notMedicalAdvice: true,
  };
}
