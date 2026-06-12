import type { ConstructorMatrixDataDependencyId } from "./constructor-matrix-data-dependencies";
import type { ConstructorMatrixEvidenceDependencyId } from "./constructor-matrix-evidence";
import type { ConstructorMatrixReviewTrack } from "./constructor-matrix-review-decision-ledger";
import type { ConstructorMatrixThresholdCandidateId } from "./constructor-matrix-threshold-candidates";

export type ConstructorMatrixSourceExpansionPriority =
  | "P0"
  | "P1"
  | "P2"
  | "P3";

export type ConstructorMatrixSourceExpansionStatus =
  | "needs_source_expansion"
  | "needs_exact_citation"
  | "needs_population_match"
  | "needs_wrestling_specificity"
  | "needs_medical_review"
  | "needs_coach_review"
  | "needs_data_quality_review"
  | "blocked_for_runtime"
  | "do_not_automate"
  | "docs_only";

export type ConstructorMatrixSourceTypeNeeded =
  | "systematic_review"
  | "meta_analysis"
  | "position_stand"
  | "consensus_statement"
  | "official_regulation"
  | "combat_sport_study"
  | "wrestling_specific_study"
  | "female_athlete_source"
  | "youth_athlete_source"
  | "medical_safety_source"
  | "hydration_weight_management_policy"
  | "wearable_validity_source"
  | "coach_school_review"
  | "internal_validation_study"
  | "data_quality_spec";

export type ConstructorMatrixSourceExpansionRuntimeBlocker =
  | "no_runtime_use_until_review"
  | "no_hard_rule_without_external_source"
  | "no_numeric_threshold_without_review"
  | "no_medical_decision_automation"
  | "no_weight_cut_automation"
  | "no_bfr_kaatsu_automation"
  | "no_injury_return_automation"
  | "no_reds_diagnosis"
  | "no_wearable_absolute_truth"
  | "no_internal_case_as_universal_rule";

export type ConstructorMatrixSourceExpansionBacklogItem = {
  id: string;
  priority: ConstructorMatrixSourceExpansionPriority;
  status: ConstructorMatrixSourceExpansionStatus;
  title: string;
  question: string;
  whyNeeded: string;
  riskAreas: readonly string[];
  reviewTracks: readonly ConstructorMatrixReviewTrack[];
  sourceTypesNeeded: readonly ConstructorMatrixSourceTypeNeeded[];
  evidenceDependencyIds: readonly ConstructorMatrixEvidenceDependencyId[];
  dataDependencyIds: readonly ConstructorMatrixDataDependencyId[];
  thresholdCandidateIds: readonly ConstructorMatrixThresholdCandidateId[];
  reviewDecisionLedgerIds: readonly string[];
  acceptanceCriteria: readonly string[];
  runtimeBlockers: readonly ConstructorMatrixSourceExpansionRuntimeBlocker[];
  forbiddenUntilResolved: readonly string[];
  notes: readonly string[];
};

export interface ConstructorMatrixSourceExpansionBacklogSummary {
  sourceExpansionBacklogCount: number;
  sourceExpansionBacklogIds: readonly ConstructorMatrixSourceExpansionBacklogId[];
  sourceExpansionByPriority: Readonly<Record<ConstructorMatrixSourceExpansionPriority, number>>;
  sourceExpansionByReviewTrack: Readonly<Record<ConstructorMatrixReviewTrack, number>>;
  unresolvedP0SourceExpansionIds: readonly ConstructorMatrixSourceExpansionBacklogId[];
}

const SOURCE_EXPANSION_PRIORITY_VALUES = [
  "P0",
  "P1",
  "P2",
  "P3",
] as const satisfies readonly ConstructorMatrixSourceExpansionPriority[];

const SOURCE_EXPANSION_REVIEW_TRACK_VALUES = [
  "coach",
  "medical",
  "data_quality",
  "sport_science",
  "product_safety",
] as const satisfies readonly ConstructorMatrixReviewTrack[];

const COMMON_ACCEPTANCE_CRITERIA = [
  "Record exact source type needed before review intake",
  "Do not approve numeric threshold values in this backlog",
  "Keep runtime promotion blocked until real review is complete",
] as const;

const COMMON_FORBIDDEN_UNTIL_RESOLVED = [
  "runtime hard rule",
  "runtime gate",
  "production rollout promotion",
] as const;

const COMMON_NOTES = [
  "Backlog item describes source needs only",
  "No new citation is claimed by this metadata",
  "No human review decision is recorded",
] as const;

export const CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG = [
  {
    id: "weight_cut_quantitative_safety_sources",
    priority: "P0",
    status: "needs_medical_review",
    title: "Weight-cut quantitative safety source expansion",
    question:
      "Which external policies and sport-specific sources are required before any weight-cut threshold candidate can move beyond review export?",
    whyNeeded:
      "Weight-cut and hydration candidates are safety-sensitive and cannot rely on internal examples or body-mass trend alone.",
    riskAreas: ["weight_cut", "hydration"],
    reviewTracks: ["medical", "coach", "sport_science"],
    sourceTypesNeeded: [
      "systematic_review",
      "position_stand",
      "official_regulation",
      "hydration_weight_management_policy",
      "wrestling_specific_study",
    ],
    evidenceDependencyIds: [
      "ncaa_weight_management",
      "acsm_hydration_nutrition",
      "japan_rapid_weight_loss_wrestlers",
      "sichuan_weight_reduction_wrestlers",
    ],
    dataDependencyIds: [
      "body_mass_trend_for_weight_cut",
      "hydration_status_for_weigh_in",
    ],
    thresholdCandidateIds: [
      "acute_body_mass_loss_candidate",
      "weight_descent_rate_candidate",
      "hydration_status_review_trigger_candidate",
    ],
    reviewDecisionLedgerIds: [
      "evidence_ncaa_weight_management",
      "evidence_acsm_hydration_nutrition",
      "evidence_japan_rapid_weight_loss_wrestlers",
      "evidence_sichuan_weight_reduction_wrestlers",
      "data_body_mass_trend_for_weight_cut",
      "data_hydration_status_for_weigh_in",
      "threshold_acute_body_mass_loss_candidate",
      "threshold_weight_descent_rate_candidate",
      "threshold_hydration_status_review_trigger_candidate",
    ],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Medical and coach review define what evidence is sufficient before any warning language changes",
      "Sport-science review confirms transfer limits for current wrestling context",
    ],
    runtimeBlockers: [
      "no_numeric_threshold_without_review",
      "no_weight_cut_automation",
      "no_hard_rule_without_external_source",
    ],
    forbiddenUntilResolved: [
      ...COMMON_FORBIDDEN_UNTIL_RESOLVED,
      "automatic weight-cut decision",
      "automatic load change based on mass trend",
    ],
    notes: COMMON_NOTES,
  },
  {
    id: "hydration_sauna_heat_exposure_sources",
    priority: "P0",
    status: "needs_medical_review",
    title: "Hydration and sauna heat exposure source expansion",
    question:
      "What medical and coaching sources are needed before sauna or heat exposure can appear in review guidance?",
    whyNeeded:
      "Hydration and heat exposure can be misread as diagnosis or recommendation unless source scope and review intake are explicit.",
    riskAreas: ["hydration"],
    reviewTracks: ["medical", "coach"],
    sourceTypesNeeded: [
      "position_stand",
      "consensus_statement",
      "medical_safety_source",
      "hydration_weight_management_policy",
    ],
    evidenceDependencyIds: [
      "acsm_hydration_nutrition",
      "ncaa_weight_management",
      "grappling_grip_dehydration_transfer",
    ],
    dataDependencyIds: ["hydration_status_for_weigh_in"],
    thresholdCandidateIds: [
      "hydration_status_review_trigger_candidate",
      "sauna_heat_exposure_review_candidate",
    ],
    reviewDecisionLedgerIds: [
      "evidence_acsm_hydration_nutrition",
      "evidence_ncaa_weight_management",
      "evidence_grappling_grip_dehydration_transfer",
      "data_hydration_status_for_weigh_in",
      "threshold_hydration_status_review_trigger_candidate",
      "threshold_sauna_heat_exposure_review_candidate",
    ],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Medical review confirms wording cannot be read as hydration diagnosis",
      "Coach review confirms sauna or heat exposure remains review-only context",
    ],
    runtimeBlockers: [
      "no_weight_cut_automation",
      "no_medical_decision_automation",
      "no_runtime_use_until_review",
    ],
    forbiddenUntilResolved: [
      ...COMMON_FORBIDDEN_UNTIL_RESOLVED,
      "automatic hydration diagnosis",
      "automatic sauna recommendation",
    ],
    notes: COMMON_NOTES,
  },
  {
    id: "reds_low_energy_availability_sources",
    priority: "P0",
    status: "do_not_automate",
    title: "RED-S and low energy availability source expansion",
    question:
      "Which medical and female-athlete sources are required before RED-S-sensitive context can be reviewed safely?",
    whyNeeded:
      "RED-S-sensitive context must not become diagnosis, cycle-phase automation or weight-cut permission.",
    riskAreas: ["female_context", "readiness", "weight_cut"],
    reviewTracks: ["medical", "sport_science"],
    sourceTypesNeeded: [
      "systematic_review",
      "consensus_statement",
      "female_athlete_source",
      "medical_safety_source",
    ],
    evidenceDependencyIds: [
      "perform_evidence_matrix",
      "acsm_hydration_nutrition",
    ],
    dataDependencyIds: ["female_context_for_reds_or_cycle_sensitive_decisions"],
    thresholdCandidateIds: [
      "female_symptom_context_candidate",
      "reds_risk_review_candidate",
    ],
    reviewDecisionLedgerIds: [
      "evidence_perform_evidence_matrix",
      "evidence_acsm_hydration_nutrition",
      "data_female_context_for_reds_or_cycle_sensitive_decisions",
      "threshold_female_symptom_context_candidate",
      "threshold_reds_risk_review_candidate",
    ],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Medical review confirms no diagnosis wording",
      "Sport-science review identifies source gaps before any review export copy change",
    ],
    runtimeBlockers: [
      "no_reds_diagnosis",
      "no_medical_decision_automation",
      "no_runtime_use_until_review",
    ],
    forbiddenUntilResolved: [
      ...COMMON_FORBIDDEN_UNTIL_RESOLVED,
      "automatic RED-S decision",
      "automatic cycle-phase adjustment",
    ],
    notes: COMMON_NOTES,
  },
  {
    id: "bfr_kaatsu_safety_and_screening_sources",
    priority: "P0",
    status: "do_not_automate",
    title: "BFR and KAATSU safety screening source expansion",
    question:
      "Which medical safety and coach-review sources are required before BFR or KAATSU analogies can be used beyond documentation?",
    whyNeeded:
      "BFR and KAATSU context is safety-sensitive and must not become automatic programming or screening.",
    riskAreas: ["bfr_kaatsu", "lmv"],
    reviewTracks: ["medical", "coach", "sport_science"],
    sourceTypesNeeded: [
      "systematic_review",
      "position_stand",
      "medical_safety_source",
      "combat_sport_study",
    ],
    evidenceDependencyIds: [
      "bfr_kaatsu_local_metabolic",
      "china_bfr_half_squat_wrestlers",
    ],
    dataDependencyIds: ["lmv_local_fatigue_for_legs"],
    thresholdCandidateIds: ["lmv_legs_recovery_window_candidate"],
    reviewDecisionLedgerIds: [
      "evidence_bfr_kaatsu_local_metabolic",
      "evidence_china_bfr_half_squat_wrestlers",
      "data_lmv_local_fatigue_for_legs",
      "threshold_lmv_legs_recovery_window_candidate",
    ],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Medical review confirms BFR or KAATSU remains non-automated",
      "Coach review separates LMV/statodynamic context from actual BFR prescription",
    ],
    runtimeBlockers: [
      "no_bfr_kaatsu_automation",
      "no_medical_decision_automation",
      "no_runtime_use_until_review",
    ],
    forbiddenUntilResolved: [
      ...COMMON_FORBIDDEN_UNTIL_RESOLVED,
      "automatic BFR or KAATSU prescription",
      "automatic medical screening",
    ],
    notes: COMMON_NOTES,
  },
  {
    id: "injury_pain_return_to_training_sources",
    priority: "P0",
    status: "needs_medical_review",
    title: "Injury and pain return-to-training source expansion",
    question:
      "What medical and coach-reviewed source scope is required before pain or injury metadata can guide review export?",
    whyNeeded:
      "Pain and injury context must not become automatic load reduction, diagnosis or return-to-training clearance.",
    riskAreas: ["injury_pain", "pain", "injury"],
    reviewTracks: ["medical", "coach"],
    sourceTypesNeeded: [
      "consensus_statement",
      "medical_safety_source",
      "combat_sport_study",
      "coach_school_review",
    ],
    evidenceDependencyIds: [
      "perform_evidence_matrix",
      "recovery_monitoring_consensus",
      "nsca_youth_safe_progression",
    ],
    dataDependencyIds: [
      "pain_location_severity_for_block_eligibility",
      "injury_status_for_return_to_training",
    ],
    thresholdCandidateIds: [
      "pain_unknown_location_candidate",
      "pain_severity_threshold_candidate",
      "injury_return_to_training_candidate",
    ],
    reviewDecisionLedgerIds: [
      "evidence_perform_evidence_matrix",
      "evidence_recovery_monitoring_consensus",
      "evidence_nsca_youth_safe_progression",
      "data_pain_location_severity_for_block_eligibility",
      "data_injury_status_for_return_to_training",
      "threshold_pain_unknown_location_candidate",
      "threshold_pain_severity_threshold_candidate",
      "threshold_injury_return_to_training_candidate",
    ],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Medical review confirms no diagnosis or clearance wording",
      "Coach review defines which observations stay manual context only",
    ],
    runtimeBlockers: [
      "no_injury_return_automation",
      "no_medical_decision_automation",
      "no_runtime_use_until_review",
    ],
    forbiddenUntilResolved: [
      ...COMMON_FORBIDDEN_UNTIL_RESOLVED,
      "automatic injury-return decision",
      "automatic pain threshold cutoff",
    ],
    notes: COMMON_NOTES,
  },
  {
    id: "youth_high_load_and_weight_cut_sources",
    priority: "P0",
    status: "needs_medical_review",
    title: "Youth high-load and weight-cut source expansion",
    question:
      "Which youth-athlete and medical sources are needed before youth high-load or weight-cut candidates can be reviewed?",
    whyNeeded:
      "Youth context needs stronger safeguards before adult matrix assumptions or weight-cut context can be used.",
    riskAreas: ["youth_context", "weight_cut", "injury_pain"],
    reviewTracks: ["medical", "coach", "sport_science"],
    sourceTypesNeeded: [
      "position_stand",
      "youth_athlete_source",
      "medical_safety_source",
      "wrestling_specific_study",
    ],
    evidenceDependencyIds: [
      "nsca_youth_safe_progression",
      "ncaa_weight_management",
      "china_bfr_half_squat_wrestlers",
    ],
    dataDependencyIds: ["youth_context_for_high_load_progression"],
    thresholdCandidateIds: [
      "youth_high_load_progression_candidate",
      "youth_weight_cut_block_candidate",
    ],
    reviewDecisionLedgerIds: [
      "evidence_nsca_youth_safe_progression",
      "evidence_ncaa_weight_management",
      "evidence_china_bfr_half_squat_wrestlers",
      "data_youth_context_for_high_load_progression",
      "threshold_youth_high_load_progression_candidate",
      "threshold_youth_weight_cut_block_candidate",
    ],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Medical review confirms youth weight-cut automation remains blocked",
      "Coach and sport-science review define adult-matrix transfer limits",
    ],
    runtimeBlockers: [
      "no_weight_cut_automation",
      "no_medical_decision_automation",
      "no_runtime_use_until_review",
    ],
    forbiddenUntilResolved: [
      ...COMMON_FORBIDDEN_UNTIL_RESOLVED,
      "automatic youth high-load progression",
      "automatic youth weight-cut decision",
    ],
    notes: COMMON_NOTES,
  },
  {
    id: "female_context_symptom_aware_readiness_sources",
    priority: "P1",
    status: "needs_medical_review",
    title: "Female context and symptom-aware readiness source expansion",
    question:
      "Which female-athlete and coaching sources are needed before symptom-aware readiness appears in review export?",
    whyNeeded:
      "Female context can support review questions but must not become cycle-phase automation or diagnosis.",
    riskAreas: ["female_context", "readiness"],
    reviewTracks: ["medical", "coach", "sport_science"],
    sourceTypesNeeded: [
      "female_athlete_source",
      "consensus_statement",
      "coach_school_review",
    ],
    evidenceDependencyIds: [
      "perform_evidence_matrix",
      "recovery_monitoring_consensus",
    ],
    dataDependencyIds: [
      "female_context_for_reds_or_cycle_sensitive_decisions",
      "readiness_context_for_load_confidence",
    ],
    thresholdCandidateIds: [
      "female_symptom_context_candidate",
      "multi_signal_readiness_candidate",
    ],
    reviewDecisionLedgerIds: [
      "evidence_perform_evidence_matrix",
      "evidence_recovery_monitoring_consensus",
      "data_female_context_for_reds_or_cycle_sensitive_decisions",
      "data_readiness_context_for_load_confidence",
      "threshold_female_symptom_context_candidate",
      "threshold_multi_signal_readiness_candidate",
    ],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Medical review confirms symptom language stays non-diagnostic",
      "Coach review confirms how context is collected without automatic adjustment",
    ],
    runtimeBlockers: [
      "no_medical_decision_automation",
      "no_runtime_use_until_review",
    ],
    forbiddenUntilResolved: [
      ...COMMON_FORBIDDEN_UNTIL_RESOLVED,
      "automatic symptom-based plan change",
    ],
    notes: COMMON_NOTES,
  },
  {
    id: "wearable_data_quality_and_readiness_sources",
    priority: "P1",
    status: "needs_data_quality_review",
    title: "Wearable data quality and readiness source expansion",
    question:
      "Which wearable validity and data-quality specs are required before wearable context can influence review confidence?",
    whyNeeded:
      "Wearables are trend/context inputs and need source and data-quality boundaries before warning language changes.",
    riskAreas: ["wearable_data", "readiness"],
    reviewTracks: ["data_quality", "sport_science"],
    sourceTypesNeeded: [
      "wearable_validity_source",
      "data_quality_spec",
      "consensus_statement",
    ],
    evidenceDependencyIds: [
      "wearable_validity_trend",
      "recovery_monitoring_consensus",
    ],
    dataDependencyIds: [
      "wearable_data_quality_for_readiness",
      "readiness_context_for_load_confidence",
    ],
    thresholdCandidateIds: [
      "wearable_data_quality_candidate",
      "multi_signal_readiness_candidate",
    ],
    reviewDecisionLedgerIds: [
      "evidence_wearable_validity_trend",
      "evidence_recovery_monitoring_consensus",
      "data_wearable_data_quality_for_readiness",
      "data_readiness_context_for_load_confidence",
      "threshold_wearable_data_quality_candidate",
      "threshold_multi_signal_readiness_candidate",
    ],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Data-quality review defines completeness and timestamp requirements",
      "Sport-science review confirms wearable context cannot be treated as absolute truth",
    ],
    runtimeBlockers: [
      "no_wearable_absolute_truth",
      "no_runtime_use_until_review",
    ],
    forbiddenUntilResolved: [
      ...COMMON_FORBIDDEN_UNTIL_RESOLVED,
      "automatic wearable-derived diagnosis",
    ],
    notes: COMMON_NOTES,
  },
  {
    id: "rhr_hrv_sleep_readiness_composite_sources",
    priority: "P1",
    status: "needs_data_quality_review",
    title: "RHR, HRV, sleep and readiness composite source expansion",
    question:
      "Which recovery-monitoring and data-quality sources are needed before multi-signal readiness can be reviewed?",
    whyNeeded:
      "Composite readiness is useful only if sleep, RHR, HRV and self-report confidence are source-bounded.",
    riskAreas: ["readiness", "sleep", "rhr", "hrv"],
    reviewTracks: ["data_quality", "coach", "sport_science"],
    sourceTypesNeeded: [
      "systematic_review",
      "consensus_statement",
      "wearable_validity_source",
      "data_quality_spec",
    ],
    evidenceDependencyIds: [
      "recovery_monitoring_consensus",
      "wearable_validity_trend",
      "sichuan_weight_reduction_wrestlers",
    ],
    dataDependencyIds: [
      "readiness_context_for_load_confidence",
      "sleep_readiness_for_load_confidence",
      "resting_hr_trend_for_recovery_confidence",
      "hrv_trend_for_recovery_confidence",
    ],
    thresholdCandidateIds: [
      "sleep_low_confidence_candidate",
      "rhr_deviation_candidate",
      "hrv_trend_candidate",
      "multi_signal_readiness_candidate",
    ],
    reviewDecisionLedgerIds: [
      "evidence_recovery_monitoring_consensus",
      "evidence_wearable_validity_trend",
      "evidence_sichuan_weight_reduction_wrestlers",
      "data_readiness_context_for_load_confidence",
      "data_sleep_readiness_for_load_confidence",
      "data_resting_hr_trend_for_recovery_confidence",
      "data_hrv_trend_for_recovery_confidence",
      "threshold_sleep_low_confidence_candidate",
      "threshold_rhr_deviation_candidate",
      "threshold_hrv_trend_candidate",
      "threshold_multi_signal_readiness_candidate",
    ],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Data-quality review defines trend completeness before review export",
      "Coach and sport-science review define how composite context is explained",
    ],
    runtimeBlockers: [
      "no_numeric_threshold_without_review",
      "no_wearable_absolute_truth",
      "no_runtime_use_until_review",
    ],
    forbiddenUntilResolved: [
      ...COMMON_FORBIDDEN_UNTIL_RESOLVED,
      "automatic readiness score cutoff",
    ],
    notes: COMMON_NOTES,
  },
  {
    id: "wrestling_contact_load_classification_sources",
    priority: "P1",
    status: "needs_wrestling_specificity",
    title: "Wrestling contact-load classification source expansion",
    question:
      "Which wrestling-specific and coach-school sources are needed to classify contact exposure without hard runtime rules?",
    whyNeeded:
      "Contact-load exposure must distinguish mat minutes, live wrestling and control bouts before warning candidates can be reviewed.",
    riskAreas: ["contact_load", "competition_model"],
    reviewTracks: ["coach", "sport_science"],
    sourceTypesNeeded: [
      "wrestling_specific_study",
      "combat_sport_study",
      "coach_school_review",
    ],
    evidenceDependencyIds: [
      "wrestling_temporal_structure",
      "europe_pre_competition_plan",
      "perform_evidence_matrix",
      "grappling_grip_dehydration_transfer",
    ],
    dataDependencyIds: ["contact_load_exposure_for_wrestling_sessions"],
    thresholdCandidateIds: [
      "contact_load_exposure_candidate",
      "control_bouts_recovery_window_candidate",
    ],
    reviewDecisionLedgerIds: [
      "evidence_wrestling_temporal_structure",
      "evidence_europe_pre_competition_plan",
      "evidence_perform_evidence_matrix",
      "evidence_grappling_grip_dehydration_transfer",
      "data_contact_load_exposure_for_wrestling_sessions",
      "threshold_contact_load_exposure_candidate",
      "threshold_control_bouts_recovery_window_candidate",
    ],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Coach review defines contact taxonomy for review export",
      "Sport-science review confirms no hard contact exposure rule is implied",
    ],
    runtimeBlockers: [
      "no_hard_rule_without_external_source",
      "no_runtime_use_until_review",
    ],
    forbiddenUntilResolved: [
      ...COMMON_FORBIDDEN_UNTIL_RESOLVED,
      "automatic contact exposure cutoff",
    ],
    notes: COMMON_NOTES,
  },
  {
    id: "lmv_legs_recovery_and_start_proximity_sources",
    priority: "P1",
    status: "needs_coach_review",
    title: "LMV legs recovery and start-proximity source expansion",
    question:
      "Which coach and sport-science sources are needed before LMV leg recovery or start proximity can be reviewed?",
    whyNeeded:
      "LMV leg work near main starts currently relies on internal patterns and needs source expansion before any broader use.",
    riskAreas: ["lmv", "taper", "block_eligibility"],
    reviewTracks: ["coach", "sport_science"],
    sourceTypesNeeded: [
      "coach_school_review",
      "combat_sport_study",
      "wrestling_specific_study",
    ],
    evidenceDependencyIds: [
      "bfr_kaatsu_local_metabolic",
      "europe_pre_competition_plan",
      "perform_evidence_matrix",
    ],
    dataDependencyIds: [
      "lmv_local_fatigue_for_legs",
      "taper_load_context_for_hidden_fatigue",
    ],
    thresholdCandidateIds: [
      "lmv_legs_recovery_window_candidate",
      "lmv_near_main_start_role_candidate",
    ],
    reviewDecisionLedgerIds: [
      "evidence_bfr_kaatsu_local_metabolic",
      "evidence_europe_pre_competition_plan",
      "evidence_perform_evidence_matrix",
      "data_lmv_local_fatigue_for_legs",
      "data_taper_load_context_for_hidden_fatigue",
      "threshold_lmv_legs_recovery_window_candidate",
      "threshold_lmv_near_main_start_role_candidate",
    ],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Coach review confirms LMV role names remain metadata only",
      "Sport-science review identifies source gaps before any recovery-window candidate changes",
    ],
    runtimeBlockers: [
      "no_numeric_threshold_without_review",
      "no_internal_case_as_universal_rule",
      "no_runtime_use_until_review",
    ],
    forbiddenUntilResolved: [
      ...COMMON_FORBIDDEN_UNTIL_RESOLVED,
      "automatic LMV recovery window",
    ],
    notes: COMMON_NOTES,
  },
  {
    id: "taper_hidden_glycolytic_load_sources",
    priority: "P1",
    status: "needs_source_expansion",
    title: "Taper hidden glycolytic load source expansion",
    question:
      "Which taper and combat-sport sources are needed before hidden glycolytic load can appear in review warnings?",
    whyNeeded:
      "Close-start high-intensity load needs source expansion before any taper warning candidate can be promoted.",
    riskAreas: ["taper", "readiness", "competition_model"],
    reviewTracks: ["coach", "sport_science"],
    sourceTypesNeeded: [
      "systematic_review",
      "combat_sport_study",
      "wrestling_specific_study",
      "coach_school_review",
    ],
    evidenceDependencyIds: [
      "periodization_taper_peaking",
      "china_ssit_freestyle_wrestlers",
      "matrix_transition_plan",
    ],
    dataDependencyIds: [
      "taper_load_context_for_hidden_fatigue",
      "sleep_readiness_for_load_confidence",
    ],
    thresholdCandidateIds: [
      "taper_high_volume_sfp_candidate",
      "hidden_glycolytic_load_close_start_candidate",
    ],
    reviewDecisionLedgerIds: [
      "evidence_periodization_taper_peaking",
      "evidence_china_ssit_freestyle_wrestlers",
      "evidence_matrix_transition_plan",
      "data_taper_load_context_for_hidden_fatigue",
      "data_sleep_readiness_for_load_confidence",
      "threshold_taper_high_volume_sfp_candidate",
      "threshold_hidden_glycolytic_load_close_start_candidate",
    ],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Coach review confirms close-start wording remains advisory",
      "Sport-science review defines source gaps for taper warning candidates",
    ],
    runtimeBlockers: [
      "no_numeric_threshold_without_review",
      "no_runtime_use_until_review",
    ],
    forbiddenUntilResolved: [
      ...COMMON_FORBIDDEN_UNTIL_RESOLVED,
      "automatic taper load cutoff",
    ],
    notes: COMMON_NOTES,
  },
  {
    id: "competition_event_model_and_uww_rules_sources",
    priority: "P1",
    status: "needs_exact_citation",
    title: "Competition event model and official rules source expansion",
    question:
      "Which official regulation and wrestling-model sources are needed for competition-day review context?",
    whyNeeded:
      "Competition-day review needs an event model before bout count, weigh-in and same-day context are treated as structured data.",
    riskAreas: ["competition_day", "competition_model"],
    reviewTracks: ["coach", "sport_science", "product_safety"],
    sourceTypesNeeded: [
      "official_regulation",
      "wrestling_specific_study",
      "coach_school_review",
    ],
    evidenceDependencyIds: [
      "wrestling_temporal_structure",
      "constructor_core_stack",
      "matrix_transition_plan",
    ],
    dataDependencyIds: ["competition_day_context_for_no_training_development"],
    thresholdCandidateIds: ["competition_day_no_development_candidate"],
    reviewDecisionLedgerIds: [
      "evidence_wrestling_temporal_structure",
      "evidence_constructor_core_stack",
      "evidence_matrix_transition_plan",
      "data_competition_day_context_for_no_training_development",
      "threshold_competition_day_no_development_candidate",
    ],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Official regulation source type is identified before event-model fields change",
      "Product safety review confirms competition-day routing stays unchanged",
    ],
    runtimeBlockers: [
      "no_hard_rule_without_external_source",
      "no_runtime_use_until_review",
    ],
    forbiddenUntilResolved: [
      ...COMMON_FORBIDDEN_UNTIL_RESOLVED,
      "competition-day primary rollout promotion",
    ],
    notes: COMMON_NOTES,
  },
  {
    id: "travel_fatigue_load_ceiling_sources",
    priority: "P2",
    status: "needs_source_expansion",
    title: "Travel fatigue load-ceiling source expansion",
    question:
      "Which travel-fatigue and readiness sources are needed before travel context can influence review warnings?",
    whyNeeded:
      "Travel fatigue is currently conservative context and must not become an automatic load ceiling.",
    riskAreas: ["travel", "readiness"],
    reviewTracks: ["coach", "data_quality", "sport_science"],
    sourceTypesNeeded: [
      "consensus_statement",
      "combat_sport_study",
      "data_quality_spec",
    ],
    evidenceDependencyIds: [
      "europe_pre_competition_plan",
      "acsm_hydration_nutrition",
      "recovery_monitoring_consensus",
    ],
    dataDependencyIds: ["travel_fatigue_for_load_ceiling"],
    thresholdCandidateIds: ["travel_fatigue_load_ceiling_candidate"],
    reviewDecisionLedgerIds: [
      "evidence_europe_pre_competition_plan",
      "evidence_acsm_hydration_nutrition",
      "evidence_recovery_monitoring_consensus",
      "data_travel_fatigue_for_load_ceiling",
      "threshold_travel_fatigue_load_ceiling_candidate",
    ],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Coach review confirms travel remains review-only context",
      "Data-quality review confirms travel fields are auditable",
    ],
    runtimeBlockers: [
      "no_hard_rule_without_external_source",
      "no_runtime_use_until_review",
    ],
    forbiddenUntilResolved: [
      ...COMMON_FORBIDDEN_UNTIL_RESOLVED,
      "automatic travel load ceiling",
    ],
    notes: COMMON_NOTES,
  },
  {
    id: "internal_validation_outcome_measurement_sources",
    priority: "P2",
    status: "needs_source_expansion",
    title: "Internal validation outcome measurement source expansion",
    question:
      "Which internal validation design is needed before PERFORM cases can support broader Matrix review claims?",
    whyNeeded:
      "Internal validation is an audit marker, not proof that Matrix decisions should become default.",
    riskAreas: ["internal_validation", "product_safety"],
    reviewTracks: ["data_quality", "sport_science", "product_safety"],
    sourceTypesNeeded: [
      "internal_validation_study",
      "data_quality_spec",
      "coach_school_review",
    ],
    evidenceDependencyIds: [
      "perform_internal_validation_pending",
      "constructor_core_stack",
    ],
    dataDependencyIds: ["readiness_context_for_load_confidence"],
    thresholdCandidateIds: ["multi_signal_readiness_candidate"],
    reviewDecisionLedgerIds: [
      "evidence_perform_internal_validation_pending",
      "evidence_constructor_core_stack",
      "data_readiness_context_for_load_confidence",
      "threshold_multi_signal_readiness_candidate",
    ],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Product safety review confirms internal cases cannot become universal rules",
      "Data-quality review defines outcome fields before validation claims change",
    ],
    runtimeBlockers: [
      "no_internal_case_as_universal_rule",
      "no_runtime_use_until_review",
    ],
    forbiddenUntilResolved: [
      ...COMMON_FORBIDDEN_UNTIL_RESOLVED,
      "Matrix broad default",
    ],
    notes: COMMON_NOTES,
  },
  {
    id: "review_export_coach_explanation_source_trace_sources",
    priority: "P3",
    status: "docs_only",
    title: "Review export coach explanation source trace expansion",
    question:
      "Which source-trace and coach-review requirements should be documented before review export explanations expand?",
    whyNeeded:
      "Review export can become more useful only if source traces stay anonymized, explainable and non-runtime.",
    riskAreas: ["explanation", "product_safety"],
    reviewTracks: ["coach", "data_quality", "product_safety"],
    sourceTypesNeeded: [
      "coach_school_review",
      "data_quality_spec",
      "internal_validation_study",
    ],
    evidenceDependencyIds: [
      "perform_evidence_matrix",
      "constructor_core_stack",
      "matrix_transition_plan",
    ],
    dataDependencyIds: ["readiness_context_for_load_confidence"],
    thresholdCandidateIds: ["multi_signal_readiness_candidate"],
    reviewDecisionLedgerIds: [
      "evidence_perform_evidence_matrix",
      "evidence_constructor_core_stack",
      "evidence_matrix_transition_plan",
      "data_readiness_context_for_load_confidence",
      "threshold_multi_signal_readiness_candidate",
    ],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Product safety review confirms no identity or raw ids are exposed",
      "Coach review confirms explanations remain review intake, not runtime approval",
    ],
    runtimeBlockers: [
      "no_runtime_use_until_review",
      "no_internal_case_as_universal_rule",
    ],
    forbiddenUntilResolved: [
      ...COMMON_FORBIDDEN_UNTIL_RESOLVED,
      "review export as runtime approval",
    ],
    notes: COMMON_NOTES,
  },
] as const satisfies readonly ConstructorMatrixSourceExpansionBacklogItem[];

export type ConstructorMatrixSourceExpansionBacklogId =
  (typeof CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG)[number]["id"];

export const CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG_IDS =
  CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG.map((item) => item.id);

export const CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG_ID_SET = new Set<string>(
  CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG_IDS,
);

const CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG_LOOKUP = new Map<
  ConstructorMatrixSourceExpansionBacklogId,
  ConstructorMatrixSourceExpansionBacklogItem
>(
  CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG.map((item) => [item.id, item]),
);

function emptyRecord<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}

function countBy<K extends string>(
  keys: readonly K[],
  items: readonly K[],
): Readonly<Record<K, number>> {
  const counts = emptyRecord(keys);

  for (const item of items) {
    counts[item] += 1;
  }

  return counts;
}

export function listConstructorMatrixSourceExpansionBacklogIds():
  ConstructorMatrixSourceExpansionBacklogId[] {
  return [
    ...CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG_IDS,
  ] as ConstructorMatrixSourceExpansionBacklogId[];
}

export function getConstructorMatrixSourceExpansionBacklogItem(
  id: string,
): ConstructorMatrixSourceExpansionBacklogItem | null {
  return (
    CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG_LOOKUP.get(
      id as ConstructorMatrixSourceExpansionBacklogId,
    ) ?? null
  );
}

export function validateConstructorMatrixSourceExpansionBacklogIds(
  ids: readonly string[],
): { ok: boolean; missing: string[] } {
  const missing = ids.filter((id) => !CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG_ID_SET.has(id));

  return {
    ok: missing.length === 0,
    missing,
  };
}

export function buildConstructorMatrixSourceExpansionBacklogSummary():
  ConstructorMatrixSourceExpansionBacklogSummary {
  return {
    sourceExpansionBacklogCount: CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG.length,
    sourceExpansionBacklogIds: listConstructorMatrixSourceExpansionBacklogIds(),
    sourceExpansionByPriority: countBy(
      SOURCE_EXPANSION_PRIORITY_VALUES,
      CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG.map((item) => item.priority),
    ),
    sourceExpansionByReviewTrack: countBy(
      SOURCE_EXPANSION_REVIEW_TRACK_VALUES,
      CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG.flatMap((item) => item.reviewTracks),
    ),
    unresolvedP0SourceExpansionIds: CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG
      .filter((item) => item.priority === "P0")
      .map((item) => item.id as ConstructorMatrixSourceExpansionBacklogId),
  };
}
