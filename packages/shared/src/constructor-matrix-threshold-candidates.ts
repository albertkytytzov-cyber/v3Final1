import type {
  ConstructorMatrixDataDependencyId,
  ConstructorMatrixMissingDataBehavior,
} from "./constructor-matrix-data-dependencies";
import type { ConstructorMatrixEvidenceDependencyId } from "./constructor-matrix-evidence";

export type ConstructorMatrixThresholdArea =
  | "weight_cut"
  | "hydration"
  | "readiness"
  | "wearable_data"
  | "sleep"
  | "rhr"
  | "hrv"
  | "pain"
  | "soreness"
  | "injury"
  | "female_context"
  | "youth_context"
  | "travel_fatigue"
  | "competition_context"
  | "contact_load"
  | "lmv"
  | "taper";

export type ConstructorMatrixThresholdCandidateArea =
  ConstructorMatrixThresholdArea;

export type ConstructorMatrixThresholdCandidateKind =
  | "upper_bound"
  | "lower_bound"
  | "rate_of_change"
  | "trend_deviation"
  | "composite_score"
  | "categorical_gate"
  | "data_quality_gate"
  | "time_window"
  | "recovery_window"
  | "contact_exposure_window"
  | "review_trigger";

export type ConstructorMatrixThresholdCandidateStatus =
  | "draft"
  | "needs_evidence"
  | "needs_coach_review"
  | "needs_medical_review"
  | "approved_for_docs_only"
  | "approved_for_warning_candidate"
  | "blocked_for_runtime"
  | "do_not_automate";

export type ConstructorMatrixThresholdRuntimeUse =
  | "none"
  | "documentation_only"
  | "review_export_only"
  | "risk_warning_candidate"
  | "future_soft_gate_candidate"
  | "future_hard_gate_candidate";

export type ConstructorMatrixThresholdCandidateRuntimeUse =
  ConstructorMatrixThresholdRuntimeUse;

export type ConstructorMatrixThresholdReviewRequirement =
  | "coach_review"
  | "medical_review"
  | "sport_science_review"
  | "data_quality_review"
  | "product_safety_review";

export type ConstructorMatrixThresholdFutureTargetLayer =
  | "pilot_readiness"
  | "block_eligibility"
  | "volume_allocator"
  | "risk_check"
  | "explanation_builder"
  | "review_export"
  | "rollout_gate";

export type ConstructorMatrixThresholdImplementationReadiness =
  | "metadata_only"
  | "needs_evidence"
  | "needs_review"
  | "ready_for_review_export"
  | "blocked_for_runtime";

export interface ConstructorMatrixThresholdCandidateFixtureImpact {
  shouldCreateFutureFixture: boolean;
  affectedFixtureAreas: readonly string[];
  runtimeChangeAllowedNow: false;
}

export interface ConstructorMatrixThresholdCandidate {
  id: string;
  area: ConstructorMatrixThresholdArea;
  kind: ConstructorMatrixThresholdCandidateKind;
  title: string;
  whyNeeded: string;
  candidateStatement: string;
  evidenceDependencyIds: readonly ConstructorMatrixEvidenceDependencyId[];
  dataDependencyIds: readonly ConstructorMatrixDataDependencyId[];
  requiredFields: readonly string[];
  missingDataBehavior: ConstructorMatrixMissingDataBehavior;
  proposedRuntimeUse: ConstructorMatrixThresholdRuntimeUse;
  status: ConstructorMatrixThresholdCandidateStatus;
  reviewRequired: readonly ConstructorMatrixThresholdReviewRequirement[];
  limitations: readonly string[];
  forbiddenRuntimeUseNow: readonly string[];
  futureTargetLayers: readonly ConstructorMatrixThresholdFutureTargetLayer[];
  fixtureImpact: ConstructorMatrixThresholdCandidateFixtureImpact;
  implementationReadiness: ConstructorMatrixThresholdImplementationReadiness;
  candidateOnly: true;
}

const NO_RUNTIME_FIXTURE_IMPACT = {
  shouldCreateFutureFixture: true,
  affectedFixtureAreas: ["review_export", "metadata_checks"],
  runtimeChangeAllowedNow: false,
} as const satisfies ConstructorMatrixThresholdCandidateFixtureImpact;

const DOCS_ONLY_FIXTURE_IMPACT = {
  shouldCreateFutureFixture: false,
  affectedFixtureAreas: ["documentation", "review_export"],
  runtimeChangeAllowedNow: false,
} as const satisfies ConstructorMatrixThresholdCandidateFixtureImpact;

const BLOCKED_RUNTIME_USE = [
  "hard risk gate",
  "automatic plan change",
  "automatic load increase or decrease from this candidate",
  "rollout gate override",
] as const;

const MEDICAL_BLOCKED_RUNTIME_USE = [
  "medical diagnosis",
  "automatic medical clearance",
  "automatic plan change from medical context",
  "hard risk gate",
] as const;

const WEIGHT_CUT_BLOCKED_RUNTIME_USE = [
  "hard risk gate",
  "automatic weight cut decision",
  "automatic load increase or decrease based only on mass",
] as const;

const CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATE_DEFINITIONS = [
  {
    id: "acute_body_mass_loss_candidate",
    area: "weight_cut",
    kind: "rate_of_change",
    title: "Acute body mass loss candidate",
    whyNeeded:
      "Rapid body-mass change can change safety and readiness interpretation around weigh-in, but it needs coach and medical context.",
    candidateStatement:
      "Candidate for acute body mass loss percentage review. Exact value requires medical and coach approval.",
    evidenceDependencyIds: [
      "ncaa_weight_management",
      "acsm_hydration_nutrition",
      "japan_rapid_weight_loss_wrestlers",
      "sichuan_weight_reduction_wrestlers",
    ],
    dataDependencyIds: ["body_mass_trend_for_weight_cut"],
    requiredFields: [
      "current_body_mass",
      "target_weight_class",
      "days_to_start",
      "weigh_in_datetime",
      "recent_body_mass_trend",
    ],
    missingDataBehavior: "require_medical_confirmation",
    proposedRuntimeUse: "review_export_only",
    status: "needs_medical_review",
    reviewRequired: ["medical_review", "coach_review", "data_quality_review"],
    limitations: ["No numeric threshold value approved."],
    forbiddenRuntimeUseNow: WEIGHT_CUT_BLOCKED_RUNTIME_USE,
    futureTargetLayers: ["review_export", "risk_check", "explanation_builder"],
    fixtureImpact: NO_RUNTIME_FIXTURE_IMPACT,
    implementationReadiness: "needs_review",
    candidateOnly: true,
  },
  {
    id: "weight_descent_rate_candidate",
    area: "weight_cut",
    kind: "rate_of_change",
    title: "Weight descent rate candidate",
    whyNeeded:
      "The rate of body-mass descent may matter more than one isolated body-mass reading during weight management.",
    candidateStatement:
      "Candidate for weight descent rate review. No threshold value approved.",
    evidenceDependencyIds: [
      "ncaa_weight_management",
      "acsm_hydration_nutrition",
      "japan_rapid_weight_loss_wrestlers",
      "sichuan_weight_reduction_wrestlers",
    ],
    dataDependencyIds: ["body_mass_trend_for_weight_cut"],
    requiredFields: [
      "current_body_mass",
      "target_weight_class",
      "recent_body_mass_trend",
    ],
    missingDataBehavior: "require_medical_confirmation",
    proposedRuntimeUse: "review_export_only",
    status: "needs_medical_review",
    reviewRequired: ["medical_review", "coach_review", "data_quality_review"],
    limitations: ["No numeric threshold value approved."],
    forbiddenRuntimeUseNow: WEIGHT_CUT_BLOCKED_RUNTIME_USE,
    futureTargetLayers: ["review_export", "risk_check"],
    fixtureImpact: NO_RUNTIME_FIXTURE_IMPACT,
    implementationReadiness: "needs_review",
    candidateOnly: true,
  },
  {
    id: "hydration_status_review_trigger_candidate",
    area: "hydration",
    kind: "review_trigger",
    title: "Hydration status review trigger candidate",
    whyNeeded:
      "Hydration context can affect weigh-in safety and training confidence, but one isolated signal is not enough for a decision.",
    candidateStatement:
      "Candidate for hydration status review. No automatic dehydration diagnosis is approved.",
    evidenceDependencyIds: ["acsm_hydration_nutrition", "ncaa_weight_management"],
    dataDependencyIds: ["hydration_status_for_weigh_in"],
    requiredFields: [
      "weigh_in_datetime",
      "hydration_symptoms",
      "recent_body_mass_trend",
    ],
    missingDataBehavior: "require_medical_confirmation",
    proposedRuntimeUse: "review_export_only",
    status: "needs_medical_review",
    reviewRequired: ["medical_review", "coach_review", "data_quality_review"],
    limitations: ["No numeric threshold value approved."],
    forbiddenRuntimeUseNow: [
      "automatic dehydration diagnosis",
      "automatic fluid restriction advice",
      "hard risk gate",
    ],
    futureTargetLayers: ["review_export", "risk_check", "explanation_builder"],
    fixtureImpact: NO_RUNTIME_FIXTURE_IMPACT,
    implementationReadiness: "needs_review",
    candidateOnly: true,
  },
  {
    id: "sauna_heat_exposure_review_candidate",
    area: "hydration",
    kind: "review_trigger",
    title: "Sauna or heat exposure review candidate",
    whyNeeded:
      "Sauna or heat exposure context may change safety review around weigh-in and recovery.",
    candidateStatement:
      "Candidate for heat exposure review. No automatic sauna recommendation is approved.",
    evidenceDependencyIds: ["acsm_hydration_nutrition", "ncaa_weight_management"],
    dataDependencyIds: ["hydration_status_for_weigh_in"],
    requiredFields: [
      "weigh_in_datetime",
      "hydration_symptoms",
      "sauna_or_heat_exposure",
    ],
    missingDataBehavior: "require_medical_confirmation",
    proposedRuntimeUse: "review_export_only",
    status: "needs_medical_review",
    reviewRequired: ["medical_review", "coach_review"],
    limitations: ["No numeric threshold value approved."],
    forbiddenRuntimeUseNow: [
      "automatic sauna recommendation",
      "automatic dehydration diagnosis",
      "hard risk gate",
    ],
    futureTargetLayers: ["review_export", "risk_check"],
    fixtureImpact: NO_RUNTIME_FIXTURE_IMPACT,
    implementationReadiness: "needs_review",
    candidateOnly: true,
  },
  {
    id: "sleep_low_confidence_candidate",
    area: "sleep",
    kind: "data_quality_gate",
    title: "Sleep low confidence candidate",
    whyNeeded:
      "Sleep context can lower recommendation confidence, especially when device confidence or athlete report is weak.",
    candidateStatement:
      "Candidate for sleep confidence review. No sleep duration cutoff approved.",
    evidenceDependencyIds: [
      "recovery_monitoring_consensus",
      "wearable_validity_trend",
    ],
    dataDependencyIds: [
      "sleep_readiness_for_load_confidence",
      "wearable_data_quality_for_readiness",
    ],
    requiredFields: [
      "sleep_duration",
      "sleep_quality",
      "days_to_start",
      "device_confidence",
    ],
    missingDataBehavior: "use_low_risk_replacement",
    proposedRuntimeUse: "risk_warning_candidate",
    status: "needs_coach_review",
    reviewRequired: ["coach_review", "data_quality_review"],
    limitations: ["No numeric threshold value approved."],
    forbiddenRuntimeUseNow: BLOCKED_RUNTIME_USE,
    futureTargetLayers: ["review_export", "risk_check", "explanation_builder"],
    fixtureImpact: NO_RUNTIME_FIXTURE_IMPACT,
    implementationReadiness: "needs_review",
    candidateOnly: true,
  },
  {
    id: "rhr_deviation_candidate",
    area: "rhr",
    kind: "trend_deviation",
    title: "Resting heart rate deviation candidate",
    whyNeeded:
      "Resting heart rate can be useful as a trend signal, but it must be interpreted with symptoms and sleep context.",
    candidateStatement:
      "Candidate for resting heart rate trend deviation review. No heart rate threshold approved.",
    evidenceDependencyIds: [
      "recovery_monitoring_consensus",
      "wearable_validity_trend",
    ],
    dataDependencyIds: [
      "resting_hr_trend_for_recovery_confidence",
      "wearable_data_quality_for_readiness",
    ],
    requiredFields: [
      "resting_hr_trend",
      "baseline_resting_hr",
      "data_window_days",
      "device_confidence",
    ],
    missingDataBehavior: "advisory_only",
    proposedRuntimeUse: "review_export_only",
    status: "needs_coach_review",
    reviewRequired: ["coach_review", "data_quality_review"],
    limitations: ["No numeric threshold value approved."],
    forbiddenRuntimeUseNow: BLOCKED_RUNTIME_USE,
    futureTargetLayers: ["review_export", "risk_check"],
    fixtureImpact: NO_RUNTIME_FIXTURE_IMPACT,
    implementationReadiness: "needs_review",
    candidateOnly: true,
  },
  {
    id: "hrv_trend_candidate",
    area: "hrv",
    kind: "trend_deviation",
    title: "HRV trend candidate",
    whyNeeded:
      "HRV may support recovery confidence when trend quality and device confidence are acceptable.",
    candidateStatement:
      "Candidate for HRV trend review. No HRV threshold approved.",
    evidenceDependencyIds: [
      "recovery_monitoring_consensus",
      "wearable_validity_trend",
    ],
    dataDependencyIds: [
      "hrv_trend_for_recovery_confidence",
      "wearable_data_quality_for_readiness",
    ],
    requiredFields: [
      "hrv_trend",
      "baseline_hrv",
      "data_window_days",
      "device_confidence",
    ],
    missingDataBehavior: "advisory_only",
    proposedRuntimeUse: "review_export_only",
    status: "needs_evidence",
    reviewRequired: ["coach_review", "data_quality_review"],
    limitations: ["No numeric threshold value approved."],
    forbiddenRuntimeUseNow: BLOCKED_RUNTIME_USE,
    futureTargetLayers: ["review_export", "risk_check"],
    fixtureImpact: NO_RUNTIME_FIXTURE_IMPACT,
    implementationReadiness: "needs_evidence",
    candidateOnly: true,
  },
  {
    id: "wearable_data_quality_candidate",
    area: "wearable_data",
    kind: "data_quality_gate",
    title: "Wearable data quality candidate",
    whyNeeded:
      "Wearable data needs completeness, timestamp and source confidence before it can support coach review.",
    candidateStatement:
      "Candidate for wearable data quality review. Wearable data stays trend and context evidence.",
    evidenceDependencyIds: ["wearable_validity_trend"],
    dataDependencyIds: ["wearable_data_quality_for_readiness"],
    requiredFields: [
      "device_source",
      "data_completeness",
      "measurement_timestamp",
    ],
    missingDataBehavior: "advisory_only",
    proposedRuntimeUse: "review_export_only",
    status: "approved_for_docs_only",
    reviewRequired: ["data_quality_review", "product_safety_review"],
    limitations: ["Wearable data is trend and context, not absolute truth."],
    forbiddenRuntimeUseNow: BLOCKED_RUNTIME_USE,
    futureTargetLayers: ["review_export", "explanation_builder"],
    fixtureImpact: DOCS_ONLY_FIXTURE_IMPACT,
    implementationReadiness: "ready_for_review_export",
    candidateOnly: true,
  },
  {
    id: "multi_signal_readiness_candidate",
    area: "readiness",
    kind: "composite_score",
    title: "Multi signal readiness candidate",
    whyNeeded:
      "Readiness is safer when sleep, heart-rate trends, wearable quality and coach context are reviewed together.",
    candidateStatement:
      "Candidate for multi signal readiness review. No score threshold approved.",
    evidenceDependencyIds: [
      "recovery_monitoring_consensus",
      "wearable_validity_trend",
    ],
    dataDependencyIds: [
      "readiness_context_for_load_confidence",
      "sleep_readiness_for_load_confidence",
      "resting_hr_trend_for_recovery_confidence",
      "hrv_trend_for_recovery_confidence",
      "wearable_data_quality_for_readiness",
    ],
    requiredFields: [
      "readiness_score",
      "readiness_trend",
      "sleep_quality",
      "resting_hr_trend",
      "hrv_trend",
      "device_confidence",
    ],
    missingDataBehavior: "use_low_risk_replacement",
    proposedRuntimeUse: "risk_warning_candidate",
    status: "needs_coach_review",
    reviewRequired: ["coach_review", "data_quality_review"],
    limitations: ["No numeric threshold value approved."],
    forbiddenRuntimeUseNow: BLOCKED_RUNTIME_USE,
    futureTargetLayers: ["pilot_readiness", "review_export", "risk_check"],
    fixtureImpact: NO_RUNTIME_FIXTURE_IMPACT,
    implementationReadiness: "needs_review",
    candidateOnly: true,
  },
  {
    id: "pain_unknown_location_candidate",
    area: "pain",
    kind: "review_trigger",
    title: "Pain unknown location candidate",
    whyNeeded:
      "Pain without clear location or onset is unsafe for automatic block eligibility decisions.",
    candidateStatement:
      "Candidate for pain location review. No automatic load decision is approved.",
    evidenceDependencyIds: [
      "perform_evidence_matrix",
      "recovery_monitoring_consensus",
    ],
    dataDependencyIds: ["pain_location_severity_for_block_eligibility"],
    requiredFields: ["pain_location", "pain_onset", "coach_note"],
    missingDataBehavior: "require_medical_confirmation",
    proposedRuntimeUse: "review_export_only",
    status: "needs_medical_review",
    reviewRequired: ["medical_review", "coach_review"],
    limitations: ["No numeric threshold value approved."],
    forbiddenRuntimeUseNow: MEDICAL_BLOCKED_RUNTIME_USE,
    futureTargetLayers: ["review_export", "risk_check"],
    fixtureImpact: NO_RUNTIME_FIXTURE_IMPACT,
    implementationReadiness: "needs_review",
    candidateOnly: true,
  },
  {
    id: "pain_severity_threshold_candidate",
    area: "pain",
    kind: "upper_bound",
    title: "Pain severity review candidate",
    whyNeeded:
      "Pain severity may need a future coach or medical review trigger, but it cannot become an automatic rule now.",
    candidateStatement:
      "Candidate for pain severity threshold review. No pain score cutoff approved.",
    evidenceDependencyIds: [
      "perform_evidence_matrix",
      "recovery_monitoring_consensus",
    ],
    dataDependencyIds: ["pain_location_severity_for_block_eligibility"],
    requiredFields: ["pain_location", "pain_severity", "pain_onset"],
    missingDataBehavior: "require_medical_confirmation",
    proposedRuntimeUse: "review_export_only",
    status: "needs_medical_review",
    reviewRequired: ["medical_review", "coach_review"],
    limitations: ["No numeric threshold value approved."],
    forbiddenRuntimeUseNow: MEDICAL_BLOCKED_RUNTIME_USE,
    futureTargetLayers: ["review_export", "risk_check"],
    fixtureImpact: NO_RUNTIME_FIXTURE_IMPACT,
    implementationReadiness: "needs_review",
    candidateOnly: true,
  },
  {
    id: "injury_return_to_training_candidate",
    area: "injury",
    kind: "categorical_gate",
    title: "Injury return to training candidate",
    whyNeeded:
      "Return to training after injury requires medical clearance and cannot be inferred from constructor metadata.",
    candidateStatement:
      "Candidate for injury return to training review. No automatic return to training is approved.",
    evidenceDependencyIds: [
      "perform_evidence_matrix",
      "nsca_youth_safe_progression",
    ],
    dataDependencyIds: [
      "injury_status_for_return_to_training",
      "pain_location_severity_for_block_eligibility",
    ],
    requiredFields: ["injury_status", "medical_clearance", "affected_area"],
    missingDataBehavior: "require_medical_confirmation",
    proposedRuntimeUse: "documentation_only",
    status: "do_not_automate",
    reviewRequired: ["medical_review", "coach_review", "product_safety_review"],
    limitations: ["No automatic medical clearance approved."],
    forbiddenRuntimeUseNow: MEDICAL_BLOCKED_RUNTIME_USE,
    futureTargetLayers: ["review_export", "risk_check"],
    fixtureImpact: DOCS_ONLY_FIXTURE_IMPACT,
    implementationReadiness: "blocked_for_runtime",
    candidateOnly: true,
  },
  {
    id: "female_symptom_context_candidate",
    area: "female_context",
    kind: "review_trigger",
    title: "Female symptom context candidate",
    whyNeeded:
      "Female athlete symptom context can affect safety language and training confidence, but it needs coach and medical review.",
    candidateStatement:
      "Candidate for female symptom context review. No automatic cycle phase adjustment is approved.",
    evidenceDependencyIds: ["perform_evidence_matrix", "acsm_hydration_nutrition"],
    dataDependencyIds: [
      "female_context_for_reds_or_cycle_sensitive_decisions",
      "sleep_readiness_for_load_confidence",
    ],
    requiredFields: ["sex", "symptoms", "energy_availability_risk"],
    missingDataBehavior: "require_medical_confirmation",
    proposedRuntimeUse: "review_export_only",
    status: "needs_medical_review",
    reviewRequired: ["medical_review", "coach_review", "data_quality_review"],
    limitations: ["No automatic cycle phase adjustment approved."],
    forbiddenRuntimeUseNow: MEDICAL_BLOCKED_RUNTIME_USE,
    futureTargetLayers: ["review_export", "risk_check", "explanation_builder"],
    fixtureImpact: NO_RUNTIME_FIXTURE_IMPACT,
    implementationReadiness: "needs_review",
    candidateOnly: true,
  },
  {
    id: "reds_risk_review_candidate",
    area: "female_context",
    kind: "review_trigger",
    title: "RED-S risk review candidate",
    whyNeeded:
      "Energy availability risk context belongs in medical review and must not become diagnosis logic.",
    candidateStatement:
      "Candidate for RED-S risk review. No diagnosis is approved.",
    evidenceDependencyIds: [
      "perform_evidence_matrix",
      "acsm_hydration_nutrition",
      "recovery_monitoring_consensus",
    ],
    dataDependencyIds: [
      "female_context_for_reds_or_cycle_sensitive_decisions",
      "body_mass_trend_for_weight_cut",
      "sleep_readiness_for_load_confidence",
    ],
    requiredFields: ["symptoms", "energy_availability_risk", "medical_note"],
    missingDataBehavior: "require_medical_confirmation",
    proposedRuntimeUse: "documentation_only",
    status: "do_not_automate",
    reviewRequired: ["medical_review", "coach_review", "product_safety_review"],
    limitations: ["No diagnosis approved."],
    forbiddenRuntimeUseNow: MEDICAL_BLOCKED_RUNTIME_USE,
    futureTargetLayers: ["review_export", "risk_check"],
    fixtureImpact: DOCS_ONLY_FIXTURE_IMPACT,
    implementationReadiness: "blocked_for_runtime",
    candidateOnly: true,
  },
  {
    id: "youth_high_load_progression_candidate",
    area: "youth_context",
    kind: "categorical_gate",
    title: "Youth high load progression candidate",
    whyNeeded:
      "Youth athletes need context-specific review before adult load assumptions are applied.",
    candidateStatement:
      "Candidate for youth high load progression review. No adult matrix auto scaling is approved.",
    evidenceDependencyIds: ["nsca_youth_safe_progression"],
    dataDependencyIds: ["youth_context_for_high_load_progression"],
    requiredFields: ["athlete_age", "training_age"],
    missingDataBehavior: "require_coach_confirmation",
    proposedRuntimeUse: "review_export_only",
    status: "needs_coach_review",
    reviewRequired: ["coach_review", "data_quality_review", "product_safety_review"],
    limitations: ["No adult matrix auto scaling approved."],
    forbiddenRuntimeUseNow: BLOCKED_RUNTIME_USE,
    futureTargetLayers: ["review_export", "risk_check", "explanation_builder"],
    fixtureImpact: NO_RUNTIME_FIXTURE_IMPACT,
    implementationReadiness: "needs_review",
    candidateOnly: true,
  },
  {
    id: "youth_weight_cut_block_candidate",
    area: "youth_context",
    kind: "review_trigger",
    title: "Youth weight cut review candidate",
    whyNeeded:
      "Youth weight management is safety sensitive and must stay outside automation without medical review.",
    candidateStatement:
      "Candidate for youth weight cut review. No automatic weight cutting is approved.",
    evidenceDependencyIds: [
      "nsca_youth_safe_progression",
      "ncaa_weight_management",
      "acsm_hydration_nutrition",
    ],
    dataDependencyIds: [
      "youth_context_for_high_load_progression",
      "body_mass_trend_for_weight_cut",
      "hydration_status_for_weigh_in",
    ],
    requiredFields: [
      "athlete_age",
      "training_age",
      "current_body_mass",
      "target_weight_class",
    ],
    missingDataBehavior: "require_medical_confirmation",
    proposedRuntimeUse: "documentation_only",
    status: "needs_medical_review",
    reviewRequired: ["medical_review", "coach_review", "product_safety_review"],
    limitations: ["No automatic weight cutting approved."],
    forbiddenRuntimeUseNow: WEIGHT_CUT_BLOCKED_RUNTIME_USE,
    futureTargetLayers: ["review_export", "risk_check"],
    fixtureImpact: DOCS_ONLY_FIXTURE_IMPACT,
    implementationReadiness: "needs_review",
    candidateOnly: true,
  },
  {
    id: "travel_fatigue_load_ceiling_candidate",
    area: "travel_fatigue",
    kind: "review_trigger",
    title: "Travel fatigue load ceiling candidate",
    whyNeeded:
      "Travel context may justify conservative coach review when freshness and sleep context are uncertain.",
    candidateStatement:
      "Candidate for travel fatigue load ceiling review. No travel duration cutoff approved.",
    evidenceDependencyIds: [
      "europe_pre_competition_plan",
      "acsm_hydration_nutrition",
    ],
    dataDependencyIds: [
      "travel_fatigue_for_load_ceiling",
      "sleep_readiness_for_load_confidence",
    ],
    requiredFields: ["travel_date", "travel_duration", "days_to_start"],
    missingDataBehavior: "use_low_risk_replacement",
    proposedRuntimeUse: "risk_warning_candidate",
    status: "approved_for_warning_candidate",
    reviewRequired: ["coach_review", "data_quality_review"],
    limitations: ["No numeric threshold value approved."],
    forbiddenRuntimeUseNow: BLOCKED_RUNTIME_USE,
    futureTargetLayers: ["review_export", "risk_check", "explanation_builder"],
    fixtureImpact: NO_RUNTIME_FIXTURE_IMPACT,
    implementationReadiness: "ready_for_review_export",
    candidateOnly: true,
  },
  {
    id: "competition_day_no_development_candidate",
    area: "competition_context",
    kind: "categorical_gate",
    title: "Competition day no development candidate",
    whyNeeded:
      "Competition day should be represented as a review context before any future tournament logic is promoted.",
    candidateStatement:
      "Candidate for competition day no development review. This is not a new runtime rule.",
    evidenceDependencyIds: [
      "constructor_core_stack",
      "matrix_transition_plan",
      "periodization_taper_peaking",
    ],
    dataDependencyIds: ["competition_day_context_for_no_training_development"],
    requiredFields: ["competition_date", "day_type", "start_role"],
    missingDataBehavior: "use_low_risk_replacement",
    proposedRuntimeUse: "review_export_only",
    status: "approved_for_docs_only",
    reviewRequired: ["coach_review", "product_safety_review"],
    limitations: ["No runtime behavior change approved."],
    forbiddenRuntimeUseNow: BLOCKED_RUNTIME_USE,
    futureTargetLayers: ["review_export", "explanation_builder"],
    fixtureImpact: DOCS_ONLY_FIXTURE_IMPACT,
    implementationReadiness: "ready_for_review_export",
    candidateOnly: true,
  },
  {
    id: "contact_load_exposure_candidate",
    area: "contact_load",
    kind: "contact_exposure_window",
    title: "Contact load exposure candidate",
    whyNeeded:
      "Wrestling contact exposure needs typed context before it can support future review or warning language.",
    candidateStatement:
      "Candidate for contact load exposure review. No contact minute threshold approved.",
    evidenceDependencyIds: [
      "wrestling_temporal_structure",
      "perform_evidence_matrix",
    ],
    dataDependencyIds: ["contact_load_exposure_for_wrestling_sessions"],
    requiredFields: [
      "contact_minutes",
      "live_wrestling_minutes",
      "sparring_rounds",
      "control_bouts",
    ],
    missingDataBehavior: "require_coach_confirmation",
    proposedRuntimeUse: "review_export_only",
    status: "needs_evidence",
    reviewRequired: ["coach_review", "sport_science_review"],
    limitations: ["No numeric threshold value approved."],
    forbiddenRuntimeUseNow: BLOCKED_RUNTIME_USE,
    futureTargetLayers: ["review_export", "risk_check", "volume_allocator"],
    fixtureImpact: NO_RUNTIME_FIXTURE_IMPACT,
    implementationReadiness: "needs_evidence",
    candidateOnly: true,
  },
  {
    id: "control_bouts_recovery_window_candidate",
    area: "contact_load",
    kind: "recovery_window",
    title: "Control bouts recovery window candidate",
    whyNeeded:
      "Control bout exposure may need a recovery-window review, but the window must be validated before use.",
    candidateStatement:
      "Candidate for control bout recovery window review. No fixed recovery timing threshold approved.",
    evidenceDependencyIds: [
      "wrestling_temporal_structure",
      "matrix_transition_plan",
      "europe_pre_competition_plan",
    ],
    dataDependencyIds: [
      "contact_load_exposure_for_wrestling_sessions",
      "readiness_context_for_load_confidence",
    ],
    requiredFields: [
      "control_bouts",
      "coach_contact_note",
      "readiness_trend",
    ],
    missingDataBehavior: "require_coach_confirmation",
    proposedRuntimeUse: "review_export_only",
    status: "needs_coach_review",
    reviewRequired: ["coach_review", "sport_science_review"],
    limitations: ["No fixed recovery window approved."],
    forbiddenRuntimeUseNow: BLOCKED_RUNTIME_USE,
    futureTargetLayers: ["review_export", "risk_check", "volume_allocator"],
    fixtureImpact: NO_RUNTIME_FIXTURE_IMPACT,
    implementationReadiness: "needs_review",
    candidateOnly: true,
  },
  {
    id: "lmv_legs_recovery_window_candidate",
    area: "lmv",
    kind: "recovery_window",
    title: "Leg LMV recovery window candidate",
    whyNeeded:
      "Leg LMV may create local fatigue that needs coach review near important starts.",
    candidateStatement:
      "Candidate for leg LMV recovery window review. No fixed recovery timing threshold approved.",
    evidenceDependencyIds: [
      "bfr_kaatsu_local_metabolic",
      "europe_pre_competition_plan",
      "perform_evidence_matrix",
    ],
    dataDependencyIds: [
      "lmv_local_fatigue_for_legs",
      "readiness_context_for_load_confidence",
    ],
    requiredFields: [
      "leg_local_fatigue",
      "previous_lmv_load",
      "days_to_start",
      "movement_quality",
    ],
    missingDataBehavior: "require_coach_confirmation",
    proposedRuntimeUse: "review_export_only",
    status: "needs_coach_review",
    reviewRequired: ["coach_review", "sport_science_review"],
    limitations: ["No fixed recovery window approved."],
    forbiddenRuntimeUseNow: BLOCKED_RUNTIME_USE,
    futureTargetLayers: ["review_export", "risk_check", "volume_allocator"],
    fixtureImpact: NO_RUNTIME_FIXTURE_IMPACT,
    implementationReadiness: "needs_review",
    candidateOnly: true,
  },
  {
    id: "lmv_near_main_start_role_candidate",
    area: "lmv",
    kind: "categorical_gate",
    title: "Near main start LMV role candidate",
    whyNeeded:
      "LMV close to a main start needs role context before it can be explained safely.",
    candidateStatement:
      "Candidate for near main start LMV role review. Later stages may split leg LMV roles, but not now.",
    evidenceDependencyIds: [
      "europe_pre_competition_plan",
      "matrix_transition_plan",
      "perform_evidence_matrix",
    ],
    dataDependencyIds: [
      "lmv_local_fatigue_for_legs",
      "taper_load_context_for_hidden_fatigue",
    ],
    requiredFields: ["leg_local_fatigue", "days_to_start", "start_role"],
    missingDataBehavior: "require_coach_confirmation",
    proposedRuntimeUse: "review_export_only",
    status: "needs_coach_review",
    reviewRequired: ["coach_review", "sport_science_review"],
    limitations: ["No runtime LMV subtype split approved."],
    forbiddenRuntimeUseNow: [
      ...BLOCKED_RUNTIME_USE,
      "split leg lmv into runtime subtypes",
    ],
    futureTargetLayers: ["review_export", "explanation_builder", "risk_check"],
    fixtureImpact: NO_RUNTIME_FIXTURE_IMPACT,
    implementationReadiness: "needs_review",
    candidateOnly: true,
  },
  {
    id: "taper_high_volume_sfp_candidate",
    area: "taper",
    kind: "upper_bound",
    title: "High volume SFP inside taper candidate",
    whyNeeded:
      "SFP volume inside taper needs coach review because hidden fatigue can conflict with freshness goals.",
    candidateStatement:
      "Candidate for high volume SFP inside taper review. No numeric volume threshold approved.",
    evidenceDependencyIds: ["periodization_taper_peaking", "matrix_transition_plan"],
    dataDependencyIds: [
      "taper_load_context_for_hidden_fatigue",
      "readiness_context_for_load_confidence",
    ],
    requiredFields: [
      "days_to_start",
      "start_role",
      "planned_volume",
      "recent_high_intensity_load",
    ],
    missingDataBehavior: "use_low_risk_replacement",
    proposedRuntimeUse: "risk_warning_candidate",
    status: "approved_for_warning_candidate",
    reviewRequired: ["coach_review", "sport_science_review"],
    limitations: ["No numeric threshold value approved."],
    forbiddenRuntimeUseNow: BLOCKED_RUNTIME_USE,
    futureTargetLayers: ["review_export", "risk_check", "volume_allocator"],
    fixtureImpact: NO_RUNTIME_FIXTURE_IMPACT,
    implementationReadiness: "ready_for_review_export",
    candidateOnly: true,
  },
  {
    id: "hidden_glycolytic_load_close_start_candidate",
    area: "taper",
    kind: "review_trigger",
    title: "Hidden glycolytic load close start candidate",
    whyNeeded:
      "Close-start high-intensity work can create hidden fatigue and needs coach review before any warning language is promoted.",
    candidateStatement:
      "Candidate for hidden glycolytic load close start review. No fixed recovery threshold approved.",
    evidenceDependencyIds: [
      "periodization_taper_peaking",
      "china_ssit_freestyle_wrestlers",
      "matrix_transition_plan",
    ],
    dataDependencyIds: [
      "taper_load_context_for_hidden_fatigue",
      "sleep_readiness_for_load_confidence",
    ],
    requiredFields: [
      "days_to_start",
      "recent_high_intensity_load",
      "sleep_quality",
    ],
    missingDataBehavior: "use_low_risk_replacement",
    proposedRuntimeUse: "review_export_only",
    status: "needs_coach_review",
    reviewRequired: ["coach_review", "sport_science_review"],
    limitations: ["No fixed recovery threshold approved."],
    forbiddenRuntimeUseNow: BLOCKED_RUNTIME_USE,
    futureTargetLayers: ["review_export", "risk_check", "volume_allocator"],
    fixtureImpact: NO_RUNTIME_FIXTURE_IMPACT,
    implementationReadiness: "needs_review",
    candidateOnly: true,
  },
] as const satisfies readonly ConstructorMatrixThresholdCandidate[];

export type ConstructorMatrixThresholdCandidateId =
  (typeof CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATE_DEFINITIONS)[number]["id"];

export const CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES =
  CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATE_DEFINITIONS as readonly (ConstructorMatrixThresholdCandidate & {
    id: ConstructorMatrixThresholdCandidateId;
  })[];

export const CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATE_IDS =
  CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATE_DEFINITIONS.map((item) => item.id);

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
  id: string,
): ConstructorMatrixThresholdCandidate | null {
  return (
    CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATE_LOOKUP.get(
      id as ConstructorMatrixThresholdCandidateId,
    ) ?? null
  );
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
