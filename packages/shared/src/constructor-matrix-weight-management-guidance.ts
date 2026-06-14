import type { ConstructorMatrixEvidenceDependencyId } from "./constructor-matrix-evidence";

export type ConstructorMatrixWeightManagementGuidanceStatus =
  | "safe_review_prompt"
  | "missing_data_prompt"
  | "blocked_do_not_automate"
  | "educational_only";

export type ConstructorMatrixWeightManagementGuidanceItem = {
  id: string;
  status: ConstructorMatrixWeightManagementGuidanceStatus;
  title: string;
  guidance: readonly string[];
  requiredContext: readonly string[];
  allowedUseNow: "review_prompt" | "docs_only" | "educational_guidance";
  reviewRequired: readonly ("coach" | "medical" | "sport_science")[];
  highRiskBlocked: boolean;
  forbiddenUses: readonly string[];
  evidenceDependencyIds: readonly ConstructorMatrixEvidenceDependencyId[];
  limitations: readonly string[];
};

const WEIGHT_FORBIDDEN_USES = [
  "automatic kg loss recommendation",
  "automatic water restriction",
  "sauna prescription",
  "sweat-suit protocol",
  "dehydration method",
  "diuretic advice",
  "laxative advice",
  "spitting protocol",
  "medical clearance",
  "hard numeric runtime threshold",
] as const;

const WEIGHT_LIMITATIONS = [
  "review-required guidance only",
  "not medical advice",
  "does not prescribe rapid weight cut",
  "does not diagnose dehydration",
] as const;

export const CONSTRUCTOR_MATRIX_WEIGHT_MANAGEMENT_GUIDANCE = [
  {
    id: "long_horizon_body_composition_review_prompt",
    status: "safe_review_prompt",
    title: "Long-horizon body-composition review prompt",
    guidance: [
      "Treat fat-loss and muscle-preservation work as a long-horizon review plan, not a last-minute weight cut.",
      "Review body-mass trend, strength performance, recovery, appetite and competition calendar together.",
      "Keep Matrix output as a prompt for coach and qualified support, not as clearance.",
    ],
    requiredContext: ["bodyMassTrend", "strengthPerformanceTrend", "recoveryContext", "competitionCalendar"],
    allowedUseNow: "review_prompt",
    reviewRequired: ["coach", "sport_science"],
    highRiskBlocked: false,
    forbiddenUses: WEIGHT_FORBIDDEN_USES,
    evidenceDependencyIds: ["perform_evidence_matrix", "acsm_hydration_nutrition", "recovery_monitoring_consensus"],
    limitations: WEIGHT_LIMITATIONS,
  },
  {
    id: "fat_loss_without_rapid_cut_prompt",
    status: "educational_only",
    title: "Fat-loss support without rapid-cut automation",
    guidance: [
      "Support gradual body-composition work with consistent training, normal hydration and review of recovery signals.",
      "Keep unsafe rapid-cut methods outside Matrix recommendations.",
      "Escalate any rapid weight-change request to coach and qualified review.",
    ],
    requiredContext: ["trainingPlan", "bodyMassTrend", "nutritionReview", "readiness"],
    allowedUseNow: "educational_guidance",
    reviewRequired: ["coach", "sport_science"],
    highRiskBlocked: false,
    forbiddenUses: WEIGHT_FORBIDDEN_USES,
    evidenceDependencyIds: ["perform_evidence_matrix", "ncaa_weight_management", "acsm_hydration_nutrition"],
    limitations: WEIGHT_LIMITATIONS,
  },
  {
    id: "muscle_mass_preservation_context_needed",
    status: "missing_data_prompt",
    title: "Muscle-mass preservation context needed",
    guidance: [
      "Request strength trend, training max context, session quality and recovery before changing body-composition support.",
      "Do not interpret body-mass decrease as success when strength, readiness or health context worsens.",
      "Use coach review before reducing load, density or fueling around key sessions.",
    ],
    requiredContext: ["strengthTrend", "trainingMaxContext", "sessionQuality", "readiness", "coachReview"],
    allowedUseNow: "review_prompt",
    reviewRequired: ["coach", "sport_science"],
    highRiskBlocked: false,
    forbiddenUses: WEIGHT_FORBIDDEN_USES,
    evidenceDependencyIds: ["perform_evidence_matrix", "recovery_monitoring_consensus"],
    limitations: WEIGHT_LIMITATIONS,
  },
  {
    id: "body_composition_plateau_review_prompt",
    status: "safe_review_prompt",
    title: "Body-composition plateau review prompt",
    guidance: [
      "When body-composition progress stalls, review sleep, training density, recovery and meal consistency before adding stress.",
      "Do not automatically increase conditioning or restrict food from Matrix output alone.",
      "Keep changes coach-editable and reversible.",
    ],
    requiredContext: ["sleepTrend", "trainingDensity", "recoveryContext", "mealConsistencyReview"],
    allowedUseNow: "review_prompt",
    reviewRequired: ["coach", "sport_science"],
    highRiskBlocked: false,
    forbiddenUses: WEIGHT_FORBIDDEN_USES,
    evidenceDependencyIds: ["perform_evidence_matrix", "recovery_monitoring_consensus", "acsm_hydration_nutrition"],
    limitations: WEIGHT_LIMITATIONS,
  },
  {
    id: "body_mass_trend_needed",
    status: "missing_data_prompt",
    title: "Body mass trend needed",
    guidance: [
      "Ask for current body-mass trend instead of making a decision from one reading.",
      "Keep training conservative when weight-management context is incomplete.",
    ],
    requiredContext: ["currentBodyMass", "bodyMassTrend", "weighInDate"],
    allowedUseNow: "review_prompt",
    reviewRequired: ["coach"],
    highRiskBlocked: false,
    forbiddenUses: WEIGHT_FORBIDDEN_USES,
    evidenceDependencyIds: ["ncaa_weight_management", "acsm_hydration_nutrition"],
    limitations: WEIGHT_LIMITATIONS,
  },
  {
    id: "target_category_confirmation_needed",
    status: "safe_review_prompt",
    title: "Target category confirmation needed",
    guidance: [
      "Confirm target category with the responsible coach before adjusting training or food planning.",
      "Do not infer category strategy from Matrix output alone.",
    ],
    requiredContext: ["targetCategory", "competitionRole", "coachConfirmation"],
    allowedUseNow: "review_prompt",
    reviewRequired: ["coach"],
    highRiskBlocked: false,
    forbiddenUses: WEIGHT_FORBIDDEN_USES,
    evidenceDependencyIds: ["ncaa_weight_management", "perform_evidence_matrix"],
    limitations: WEIGHT_LIMITATIONS,
  },
  {
    id: "aggressive_last_minute_loss_blocked",
    status: "blocked_do_not_automate",
    title: "Aggressive last-minute loss remains blocked",
    guidance: [
      "Aggressive last-minute weight loss cannot be automated by Matrix.",
      "Escalate to qualified coach and medical review when the plan depends on rapid loss.",
    ],
    requiredContext: ["bodyMassTrend", "weighInDate", "medicalReviewIfNeeded"],
    allowedUseNow: "review_prompt",
    reviewRequired: ["coach", "medical", "sport_science"],
    highRiskBlocked: true,
    forbiddenUses: WEIGHT_FORBIDDEN_USES,
    evidenceDependencyIds: ["ncaa_weight_management", "acsm_hydration_nutrition"],
    limitations: WEIGHT_LIMITATIONS,
  },
  {
    id: "weigh_in_day_safety_checklist",
    status: "safe_review_prompt",
    title: "Weigh-in day safety checklist",
    guidance: [
      "Check readiness, symptoms, body-mass trend and coach plan before any activation.",
      "Use only short, fresh movement; do not use training to force weight change.",
    ],
    requiredContext: ["readiness", "symptoms", "coachPlan", "weighInSchedule"],
    allowedUseNow: "review_prompt",
    reviewRequired: ["coach", "medical"],
    highRiskBlocked: true,
    forbiddenUses: WEIGHT_FORBIDDEN_USES,
    evidenceDependencyIds: ["ncaa_weight_management", "acsm_hydration_nutrition"],
    limitations: WEIGHT_LIMITATIONS,
  },
  {
    id: "hydration_awareness_no_diagnosis",
    status: "educational_only",
    title: "Hydration awareness without diagnosis",
    guidance: [
      "Use hydration awareness as a prompt for review, not a diagnosis.",
      "Concerning symptoms require qualified support.",
    ],
    requiredContext: ["symptoms", "coachObservation", "medicalSupportIfNeeded"],
    allowedUseNow: "review_prompt",
    reviewRequired: ["coach", "medical"],
    highRiskBlocked: true,
    forbiddenUses: WEIGHT_FORBIDDEN_USES,
    evidenceDependencyIds: ["acsm_hydration_nutrition"],
    limitations: WEIGHT_LIMITATIONS,
  },
] as const satisfies readonly ConstructorMatrixWeightManagementGuidanceItem[];

export function buildConstructorMatrixWeightManagementGuidanceSummary() {
  return {
    guidanceCount: CONSTRUCTOR_MATRIX_WEIGHT_MANAGEMENT_GUIDANCE.length,
    guidanceIds: CONSTRUCTOR_MATRIX_WEIGHT_MANAGEMENT_GUIDANCE.map((item) => item.id),
    reviewRequiredIds: CONSTRUCTOR_MATRIX_WEIGHT_MANAGEMENT_GUIDANCE.filter(
      (item) => item.reviewRequired.length > 0,
    ).map((item) => item.id),
    highRiskBlockedIds: CONSTRUCTOR_MATRIX_WEIGHT_MANAGEMENT_GUIDANCE.filter(
      (item) => item.highRiskBlocked,
    ).map((item) => item.id),
    highRiskBlockedCount: CONSTRUCTOR_MATRIX_WEIGHT_MANAGEMENT_GUIDANCE.filter(
      (item) => item.highRiskBlocked,
    ).length,
    reviewRequiredCount: CONSTRUCTOR_MATRIX_WEIGHT_MANAGEMENT_GUIDANCE.filter(
      (item) => item.reviewRequired.length > 0,
    ).length,
    noUnsafeRapidWeightCutAutomation: true,
  };
}
