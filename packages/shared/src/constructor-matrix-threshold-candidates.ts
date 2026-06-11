import type {
  ConstructorMatrixDataDependencyId,
  ConstructorMatrixMissingDataBehavior,
} from "./constructor-matrix-data-dependencies";
import type { ConstructorMatrixEvidenceDependencyId } from "./constructor-matrix-evidence";

export type ConstructorMatrixThresholdCandidateArea =
  | "weight_cut"
  | "hydration"
  | "readiness"
  | "sleep"
  | "rhr"
  | "wearable_data"
  | "pain"
  | "injury"
  | "female_context"
  | "youth_context"
  | "travel_fatigue"
  | "competition_context";

export type ConstructorMatrixThresholdCandidateSignalType =
  | "trend"
  | "context_flag"
  | "composite_signal"
  | "data_quality"
  | "coach_observation"
  | "medical_clearance";

export type ConstructorMatrixThresholdCandidateDirection =
  | "higher_than_baseline"
  | "lower_than_baseline"
  | "rapid_change"
  | "missing_or_stale"
  | "presence_required"
  | "contextual";

export type ConstructorMatrixThresholdCandidateDecisionScope =
  | "load_ceiling"
  | "block_eligibility"
  | "pilot_readiness"
  | "review_confidence"
  | "medical_safety"
  | "coach_review"
  | "competition_day_safety";

export type ConstructorMatrixThresholdCandidateRuntimeUse =
  | "none"
  | "documentation_only"
  | "review_queue_only"
  | "future_candidate";

export type ConstructorMatrixThresholdCandidateReviewStatus =
  | "draft"
  | "needs_coach_review"
  | "needs_medical_review"
  | "needs_data_validation"
  | "blocked_for_runtime"
  | "approved_for_metadata_review";

export type ConstructorMatrixThresholdCandidateReviewer =
  | "coach"
  | "medical"
  | "product"
  | "data_quality";

export interface ConstructorMatrixThresholdCandidate {
  id: string;
  area: ConstructorMatrixThresholdCandidateArea;
  title: string;
  signalType: ConstructorMatrixThresholdCandidateSignalType;
  candidateDirection: ConstructorMatrixThresholdCandidateDirection;
  decisionScope: ConstructorMatrixThresholdCandidateDecisionScope;
  requiredDataDependencies: readonly ConstructorMatrixDataDependencyId[];
  supportsEvidenceDependencies: readonly ConstructorMatrixEvidenceDependencyId[];
  missingDataBehavior: ConstructorMatrixMissingDataBehavior;
  runtimeUseNow: ConstructorMatrixThresholdCandidateRuntimeUse;
  reviewStatus: ConstructorMatrixThresholdCandidateReviewStatus;
  reviewRequired: readonly ConstructorMatrixThresholdCandidateReviewer[];
  candidateOnly: true;
  limitations: readonly string[];
  futureValidationQuestions: readonly string[];
}

export const CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES = [
  {
    id: "body_mass_trend_weight_cut_candidate",
    area: "weight_cut",
    title: "Body-mass trend candidate for weight-cut risk review",
    signalType: "trend",
    candidateDirection: "rapid_change",
    decisionScope: "coach_review",
    requiredDataDependencies: [
      "body_mass_trend_for_weight_cut",
      "hydration_status_for_weigh_in",
    ],
    supportsEvidenceDependencies: [
      "ncaa_weight_management",
      "acsm_hydration_nutrition",
      "japan_rapid_weight_loss_wrestlers",
      "sichuan_weight_reduction_wrestlers",
    ],
    missingDataBehavior: "require_coach_confirmation",
    runtimeUseNow: "future_candidate",
    reviewStatus: "needs_medical_review",
    reviewRequired: ["coach", "medical", "data_quality"],
    candidateOnly: true,
    limitations: [
      "Candidate only: no numeric threshold is defined, and body mass alone must not infer hydration or readiness.",
    ],
    futureValidationQuestions: [
      "Which body-mass trend pattern predicts unsafe load decisions in PERFORM data after coach review?",
      "Which context fields separate planned weight management from risky rapid weight loss?",
    ],
  },
  {
    id: "hydration_context_weigh_in_candidate",
    area: "hydration",
    title: "Hydration context candidate for weigh-in safety review",
    signalType: "composite_signal",
    candidateDirection: "contextual",
    decisionScope: "medical_safety",
    requiredDataDependencies: [
      "hydration_status_for_weigh_in",
      "body_mass_trend_for_weight_cut",
    ],
    supportsEvidenceDependencies: [
      "acsm_hydration_nutrition",
      "ncaa_weight_management",
    ],
    missingDataBehavior: "require_medical_confirmation",
    runtimeUseNow: "future_candidate",
    reviewStatus: "needs_medical_review",
    reviewRequired: ["coach", "medical", "data_quality"],
    candidateOnly: true,
    limitations: [
      "Candidate only: no dehydration cutoff is defined, and symptoms, trend and context are required before any decision.",
    ],
    futureValidationQuestions: [
      "Which hydration-context fields are reliable enough for a future risk-warning layer?",
      "When should missing hydration context force a low-risk replacement instead of normal load?",
    ],
  },
  {
    id: "readiness_trend_load_confidence_candidate",
    area: "readiness",
    title: "Readiness trend candidate for load-confidence review",
    signalType: "trend",
    candidateDirection: "lower_than_baseline",
    decisionScope: "pilot_readiness",
    requiredDataDependencies: [
      "readiness_context_for_load_confidence",
      "sleep_readiness_for_load_confidence",
      "resting_hr_trend_for_recovery_confidence",
    ],
    supportsEvidenceDependencies: [
      "recovery_monitoring_consensus",
      "wearable_validity_trend",
    ],
    missingDataBehavior: "use_low_risk_replacement",
    runtimeUseNow: "review_queue_only",
    reviewStatus: "needs_data_validation",
    reviewRequired: ["coach", "data_quality"],
    candidateOnly: true,
    limitations: [
      "Candidate only: readiness trend can lower confidence, but it cannot diagnose fatigue or permit extra load alone.",
    ],
    futureValidationQuestions: [
      "Which readiness trend patterns match coach-edited load reductions in PERFORM history?",
      "Which readiness signals are stable enough to affect pilot readiness without becoming an automatic rule?",
    ],
  },
  {
    id: "sleep_context_load_replacement_candidate",
    area: "sleep",
    title: "Sleep context candidate for low-risk replacement review",
    signalType: "trend",
    candidateDirection: "lower_than_baseline",
    decisionScope: "load_ceiling",
    requiredDataDependencies: [
      "sleep_readiness_for_load_confidence",
      "wearable_data_quality_for_readiness",
    ],
    supportsEvidenceDependencies: [
      "recovery_monitoring_consensus",
      "wearable_validity_trend",
    ],
    missingDataBehavior: "use_low_risk_replacement",
    runtimeUseNow: "review_queue_only",
    reviewStatus: "needs_data_validation",
    reviewRequired: ["coach", "data_quality"],
    candidateOnly: true,
    limitations: [
      "Candidate only: one sleep signal cannot make a load decision without trend, quality and coach context.",
    ],
    futureValidationQuestions: [
      "Which sleep trend pattern should only change confidence, and which should suggest a lower-risk replacement?",
      "How should wearable confidence affect sleep-derived recommendations?",
    ],
  },
  {
    id: "rhr_recovery_confidence_candidate",
    area: "rhr",
    title: "Resting-HR trend candidate for recovery-confidence review",
    signalType: "trend",
    candidateDirection: "higher_than_baseline",
    decisionScope: "review_confidence",
    requiredDataDependencies: [
      "resting_hr_trend_for_recovery_confidence",
      "wearable_data_quality_for_readiness",
    ],
    supportsEvidenceDependencies: [
      "recovery_monitoring_consensus",
      "wearable_validity_trend",
    ],
    missingDataBehavior: "advisory_only",
    runtimeUseNow: "documentation_only",
    reviewStatus: "needs_data_validation",
    reviewRequired: ["coach", "data_quality"],
    candidateOnly: true,
    limitations: [
      "Candidate only: resting-HR trend is context evidence and cannot diagnose illness or recovery debt alone.",
    ],
    futureValidationQuestions: [
      "Which baseline-relative RHR pattern correlates with coach-noted recovery debt in PERFORM?",
      "How should illness symptoms override or qualify RHR trend interpretation?",
    ],
  },
  {
    id: "wearable_completeness_confidence_candidate",
    area: "wearable_data",
    title: "Wearable completeness candidate for data-confidence review",
    signalType: "data_quality",
    candidateDirection: "missing_or_stale",
    decisionScope: "review_confidence",
    requiredDataDependencies: [
      "wearable_data_quality_for_readiness",
    ],
    supportsEvidenceDependencies: [
      "wearable_validity_trend",
    ],
    missingDataBehavior: "advisory_only",
    runtimeUseNow: "documentation_only",
    reviewStatus: "approved_for_metadata_review",
    reviewRequired: ["data_quality", "product"],
    candidateOnly: true,
    limitations: [
      "Candidate only: wearable completeness can qualify confidence, not prove training readiness or health status.",
    ],
    futureValidationQuestions: [
      "Which missing or stale wearable fields should be shown as confidence limits in review export?",
      "Which device sources need separate quality labels before any pilot gate uses them?",
    ],
  },
  {
    id: "pain_block_eligibility_candidate",
    area: "pain",
    title: "Pain context candidate for block-eligibility review",
    signalType: "coach_observation",
    candidateDirection: "presence_required",
    decisionScope: "block_eligibility",
    requiredDataDependencies: [
      "pain_location_severity_for_block_eligibility",
    ],
    supportsEvidenceDependencies: [
      "perform_evidence_matrix",
      "recovery_monitoring_consensus",
    ],
    missingDataBehavior: "require_medical_confirmation",
    runtimeUseNow: "future_candidate",
    reviewStatus: "needs_medical_review",
    reviewRequired: ["coach", "medical"],
    candidateOnly: true,
    limitations: [
      "Candidate only: pain context must not auto-block or auto-allow training without coach or medical review.",
    ],
    futureValidationQuestions: [
      "Which pain-location patterns should require coach confirmation before local load is assigned?",
      "Which pain context belongs to medical review rather than constructor logic?",
    ],
  },
  {
    id: "injury_clearance_return_candidate",
    area: "injury",
    title: "Injury clearance candidate for return-to-training review",
    signalType: "medical_clearance",
    candidateDirection: "presence_required",
    decisionScope: "medical_safety",
    requiredDataDependencies: [
      "injury_status_for_return_to_training",
      "pain_location_severity_for_block_eligibility",
    ],
    supportsEvidenceDependencies: [
      "perform_evidence_matrix",
      "nsca_youth_safe_progression",
    ],
    missingDataBehavior: "require_medical_confirmation",
    runtimeUseNow: "none",
    reviewStatus: "blocked_for_runtime",
    reviewRequired: ["medical", "coach"],
    candidateOnly: true,
    limitations: [
      "Candidate only: return-to-training after injury is blocked for runtime automation and requires medical review.",
    ],
    futureValidationQuestions: [
      "Which return-to-training stages can be represented safely as coach-visible metadata?",
      "Which injury contexts must stay outside the constructor entirely?",
    ],
  },
  {
    id: "female_energy_availability_candidate",
    area: "female_context",
    title: "Female-athlete energy-availability candidate for review",
    signalType: "composite_signal",
    candidateDirection: "contextual",
    decisionScope: "medical_safety",
    requiredDataDependencies: [
      "female_context_for_reds_or_cycle_sensitive_decisions",
      "body_mass_trend_for_weight_cut",
      "sleep_readiness_for_load_confidence",
    ],
    supportsEvidenceDependencies: [
      "perform_evidence_matrix",
      "acsm_hydration_nutrition",
    ],
    missingDataBehavior: "require_medical_confirmation",
    runtimeUseNow: "future_candidate",
    reviewStatus: "needs_medical_review",
    reviewRequired: ["coach", "medical", "data_quality"],
    candidateOnly: true,
    limitations: [
      "Candidate only: RED-S is not diagnosed by the constructor, and cycle context alone must not change the plan.",
    ],
    futureValidationQuestions: [
      "Which symptom and energy-availability context should lower confidence rather than change a plan automatically?",
      "Which cases require medical review before the constructor shows any recommendation?",
    ],
  },
  {
    id: "youth_high_load_progression_candidate",
    area: "youth_context",
    title: "Youth high-load progression candidate for review",
    signalType: "context_flag",
    candidateDirection: "contextual",
    decisionScope: "coach_review",
    requiredDataDependencies: [
      "youth_context_for_high_load_progression",
    ],
    supportsEvidenceDependencies: [
      "nsca_youth_safe_progression",
    ],
    missingDataBehavior: "require_coach_confirmation",
    runtimeUseNow: "future_candidate",
    reviewStatus: "needs_coach_review",
    reviewRequired: ["coach", "data_quality"],
    candidateOnly: true,
    limitations: [
      "Candidate only: adult high-load assumptions must not be auto-scaled to youth athletes without review.",
    ],
    futureValidationQuestions: [
      "Which youth context fields are required before high-load progression can even be reviewed?",
      "How should training age and maturity context be represented without creating an automatic rule?",
    ],
  },
  {
    id: "travel_fatigue_load_ceiling_candidate",
    area: "travel_fatigue",
    title: "Travel fatigue candidate for load-ceiling review",
    signalType: "composite_signal",
    candidateDirection: "contextual",
    decisionScope: "load_ceiling",
    requiredDataDependencies: [
      "travel_fatigue_for_load_ceiling",
      "sleep_readiness_for_load_confidence",
    ],
    supportsEvidenceDependencies: [
      "europe_pre_competition_plan",
      "acsm_hydration_nutrition",
    ],
    missingDataBehavior: "use_low_risk_replacement",
    runtimeUseNow: "review_queue_only",
    reviewStatus: "approved_for_metadata_review",
    reviewRequired: ["coach", "data_quality"],
    candidateOnly: true,
    limitations: [
      "Candidate only: travel fatigue can suggest conservative review, not hidden added load or automatic diagnosis.",
    ],
    futureValidationQuestions: [
      "Which travel context makes coaches replace a planned session with recovery or mobility?",
      "How should time-zone and post-travel sleep context affect confidence labels?",
    ],
  },
  {
    id: "competition_day_no_development_candidate",
    area: "competition_context",
    title: "Competition-day no-development candidate for pilot review",
    signalType: "context_flag",
    candidateDirection: "presence_required",
    decisionScope: "competition_day_safety",
    requiredDataDependencies: [
      "competition_day_context_for_no_training_development",
    ],
    supportsEvidenceDependencies: [
      "constructor_core_stack",
      "matrix_transition_plan",
      "periodization_taper_peaking",
    ],
    missingDataBehavior: "use_low_risk_replacement",
    runtimeUseNow: "documentation_only",
    reviewStatus: "approved_for_metadata_review",
    reviewRequired: ["coach", "product"],
    candidateOnly: true,
    limitations: [
      "Candidate only: competition day stays review-only until bout structure and tournament context become typed data.",
    ],
    futureValidationQuestions: [
      "Which competition-day fields are enough to explain no-development behavior without changing rollout gates?",
      "Which bout-structure fields must exist before competition-day logic can move beyond metadata?",
    ],
  },
] as const satisfies readonly ConstructorMatrixThresholdCandidate[];

export type ConstructorMatrixThresholdCandidateId =
  (typeof CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES)[number]["id"];

export const CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATE_IDS =
  CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES.map((item) => item.id);

export const CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATE_ID_SET = new Set<string>(
  CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATE_IDS,
);

const CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATE_LOOKUP = new Map<
  ConstructorMatrixThresholdCandidateId,
  ConstructorMatrixThresholdCandidate
>(
  CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES.map((item) => [item.id, item]),
);

export function listConstructorMatrixThresholdCandidateIds(): ConstructorMatrixThresholdCandidateId[] {
  return [...CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATE_IDS];
}

export function getConstructorMatrixThresholdCandidate(
  id: ConstructorMatrixThresholdCandidateId,
): ConstructorMatrixThresholdCandidate | null {
  return CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATE_LOOKUP.get(id) ?? null;
}

export function validateConstructorMatrixThresholdCandidateIds(
  ids: readonly string[],
): { ok: boolean; missing: string[] } {
  const missing = ids.filter((id) => !CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATE_ID_SET.has(id));

  return {
    ok: missing.length === 0,
    missing,
  };
}
