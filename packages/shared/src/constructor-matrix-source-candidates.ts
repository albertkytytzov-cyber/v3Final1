import type { ConstructorMatrixDataDependencyId } from "./constructor-matrix-data-dependencies";
import type { ConstructorMatrixEvidenceDependencyId } from "./constructor-matrix-evidence";
import {
  CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG,
  type ConstructorMatrixSourceExpansionBacklogId,
} from "./constructor-matrix-source-expansion-backlog";
import type { ConstructorMatrixThresholdCandidateId } from "./constructor-matrix-threshold-candidates";

export type ConstructorMatrixSourceCandidateArea =
  | "weight_cut"
  | "hydration"
  | "readiness"
  | "wearable_data"
  | "sleep"
  | "rhr"
  | "hrv"
  | "pain"
  | "injury"
  | "female_context"
  | "reds"
  | "youth_context"
  | "travel_fatigue"
  | "competition_context"
  | "contact_load"
  | "lmv"
  | "bfr_kaatsu"
  | "taper"
  | "competition_model"
  | "product_safety";

export type ConstructorMatrixSourceNeedType =
  | "systematic_review"
  | "meta_analysis"
  | "consensus_statement"
  | "position_stand"
  | "official_regulation"
  | "peer_reviewed_intervention"
  | "observational_study"
  | "validity_reliability_study"
  | "sport_specific_review"
  | "combat_sport_transfer_evidence"
  | "clinical_guideline"
  | "internal_validation_protocol"
  | "product_safety_policy";

export type ConstructorMatrixSourceCandidateStatus =
  | "needs_external_lookup"
  | "mentioned_in_existing_docs"
  | "candidate_source_identified"
  | "requires_verification"
  | "accepted_for_claim_extraction"
  | "rejected"
  | "do_not_use";

export type ConstructorMatrixSourceCandidateReviewTrack =
  | "coach"
  | "medical"
  | "data_quality"
  | "sport_science"
  | "product_safety";

export type ConstructorMatrixSourceCandidateFutureTargetLayer =
  | "evidence_claim_extraction"
  | "threshold_candidate_update"
  | "data_dependency_update"
  | "review_decision_update"
  | "review_export"
  | "risk_check_future"
  | "block_eligibility_future"
  | "volume_allocator_future"
  | "rollout_gate_future";

export type ConstructorMatrixSourceCandidate = {
  id: string;
  area: ConstructorMatrixSourceCandidateArea;
  title: string;
  needType: ConstructorMatrixSourceNeedType;
  status: ConstructorMatrixSourceCandidateStatus;
  linkedSourceExpansionBacklogIds: readonly ConstructorMatrixSourceExpansionBacklogId[];
  linkedEvidenceDependencyIds: readonly ConstructorMatrixEvidenceDependencyId[];
  linkedDataDependencyIds: readonly ConstructorMatrixDataDependencyId[];
  linkedThresholdCandidateIds: readonly ConstructorMatrixThresholdCandidateId[];
  linkedReviewDecisionIds: readonly string[];
  reviewTracks: readonly ConstructorMatrixSourceCandidateReviewTrack[];
  acceptanceCriteria: readonly string[];
  rejectionCriteria: readonly string[];
  extractionQuestions: readonly string[];
  requiredBibliographicFields: readonly string[];
  candidateSourceNotes: readonly string[];
  forbiddenUseUntilAccepted: readonly string[];
  futureTargetLayers: readonly ConstructorMatrixSourceCandidateFutureTargetLayer[];
  runtimeChangeAllowedNow: false;
};

export interface ConstructorMatrixSourceAcquisitionSummary {
  totalCandidates: number;
  sourceCandidateIds: readonly ConstructorMatrixSourceCandidateId[];
  candidatesByArea: Readonly<Record<ConstructorMatrixSourceCandidateArea, number>>;
  candidatesByStatus: Readonly<Record<ConstructorMatrixSourceCandidateStatus, number>>;
  p0BacklogCoverage: {
    p0BacklogCount: number;
    coveredP0BacklogCount: number;
    coveredP0BacklogIds: readonly ConstructorMatrixSourceExpansionBacklogId[];
    missingP0BacklogIds: readonly ConstructorMatrixSourceExpansionBacklogId[];
  };
  linkedSourceExpansionBacklogCount: number;
  linkedEvidenceDependencyCount: number;
  linkedDataDependencyCount: number;
  linkedThresholdCandidateCount: number;
  linkedReviewDecisionCount: number;
  runtimeChangeAllowedNow: false;
}

const SOURCE_CANDIDATE_AREAS = [
  "weight_cut",
  "hydration",
  "readiness",
  "wearable_data",
  "sleep",
  "rhr",
  "hrv",
  "pain",
  "injury",
  "female_context",
  "reds",
  "youth_context",
  "travel_fatigue",
  "competition_context",
  "contact_load",
  "lmv",
  "bfr_kaatsu",
  "taper",
  "competition_model",
  "product_safety",
] as const satisfies readonly ConstructorMatrixSourceCandidateArea[];

const SOURCE_CANDIDATE_STATUSES = [
  "needs_external_lookup",
  "mentioned_in_existing_docs",
  "candidate_source_identified",
  "requires_verification",
  "accepted_for_claim_extraction",
  "rejected",
  "do_not_use",
] as const satisfies readonly ConstructorMatrixSourceCandidateStatus[];

const COMMON_BIBLIOGRAPHIC_FIELDS = [
  "source type",
  "source title",
  "issuing body or journal",
  "population and sport context",
  "safety scope",
  "bibliographic verification status",
] as const;

const COMMON_ACCEPTANCE_CRITERIA = [
  "Exact source metadata is verified before claim extraction",
  "Population and sport-transfer limits are explicit",
  "No numeric threshold is accepted by this source candidate",
  "Coach, medical or data-quality reviewer confirms the source is suitable for intake",
] as const;

const COMMON_REJECTION_CRITERIA = [
  "Source is a blog, marketing page or unsourced coaching opinion",
  "Source does not describe population or safety scope clearly",
  "Source is used to imply automatic runtime approval",
  "Source cannot be verified during intake",
] as const;

const COMMON_NOTES = [
  "Existing docs mention this area but exact source metadata needs verification",
  "Requires external lookup before evidence claim extraction",
  "This candidate does not accept or reject a source",
] as const;

const COMMON_FORBIDDEN_USE = [
  "runtime hard rule",
  "runtime gate",
  "numeric threshold promotion",
  "production rollout promotion",
] as const;

const SOURCE_LOOKUP_TARGETS = [
  "evidence_claim_extraction",
  "review_decision_update",
  "review_export",
] as const satisfies readonly ConstructorMatrixSourceCandidateFutureTargetLayer[];

function unique<T extends string>(items: readonly T[]): T[] {
  return Array.from(new Set(items));
}

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

export const CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES = [
  {
    id: "weight_cut_hydration_consensus_source_need",
    area: "weight_cut",
    title: "Weight-cut and hydration consensus source need",
    needType: "consensus_statement",
    status: "mentioned_in_existing_docs",
    linkedSourceExpansionBacklogIds: [
      "weight_cut_quantitative_safety_sources",
      "hydration_sauna_heat_exposure_sources",
    ],
    linkedEvidenceDependencyIds: [
      "ncaa_weight_management",
      "acsm_hydration_nutrition",
      "japan_rapid_weight_loss_wrestlers",
      "sichuan_weight_reduction_wrestlers",
    ],
    linkedDataDependencyIds: [
      "body_mass_trend_for_weight_cut",
      "hydration_status_for_weigh_in",
    ],
    linkedThresholdCandidateIds: [
      "acute_body_mass_loss_candidate",
      "weight_descent_rate_candidate",
      "hydration_status_review_trigger_candidate",
      "sauna_heat_exposure_review_candidate",
    ],
    linkedReviewDecisionIds: [
      "evidence_ncaa_weight_management",
      "evidence_acsm_hydration_nutrition",
      "evidence_japan_rapid_weight_loss_wrestlers",
      "evidence_sichuan_weight_reduction_wrestlers",
      "data_body_mass_trend_for_weight_cut",
      "data_hydration_status_for_weigh_in",
      "threshold_acute_body_mass_loss_candidate",
      "threshold_weight_descent_rate_candidate",
      "threshold_hydration_status_review_trigger_candidate",
      "threshold_sauna_heat_exposure_review_candidate",
    ],
    reviewTracks: ["medical", "coach", "sport_science"],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Source addresses combat or weight-category sport safety, or states why transfer is appropriate",
      "Source distinguishes performance guidance from medical safety constraints",
    ],
    rejectionCriteria: [
      ...COMMON_REJECTION_CRITERIA,
      "Source treats weight-making as a performance shortcut without safety guardrails",
    ],
    extractionQuestions: [
      "What safety constraints are stated for weight-making or hydration management?",
      "What population and competition context does the source describe?",
      "Which claims must remain review-export-only until medical and coach review?",
    ],
    requiredBibliographicFields: COMMON_BIBLIOGRAPHIC_FIELDS,
    candidateSourceNotes: [
      ...COMMON_NOTES,
      "Requires medical review before runtime use",
    ],
    forbiddenUseUntilAccepted: [
      ...COMMON_FORBIDDEN_USE,
      "automatic weight cut rule",
      "dehydration diagnosis",
      "automatic load change based on mass trend",
    ],
    futureTargetLayers: [
      ...SOURCE_LOOKUP_TARGETS,
      "threshold_candidate_update",
      "data_dependency_update",
      "risk_check_future",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "hydration_heat_exposure_policy_source_need",
    area: "hydration",
    title: "Hydration and heat exposure policy source need",
    needType: "position_stand",
    status: "requires_verification",
    linkedSourceExpansionBacklogIds: ["hydration_sauna_heat_exposure_sources"],
    linkedEvidenceDependencyIds: [
      "acsm_hydration_nutrition",
      "ncaa_weight_management",
      "grappling_grip_dehydration_transfer",
    ],
    linkedDataDependencyIds: ["hydration_status_for_weigh_in"],
    linkedThresholdCandidateIds: [
      "hydration_status_review_trigger_candidate",
      "sauna_heat_exposure_review_candidate",
    ],
    linkedReviewDecisionIds: [
      "evidence_acsm_hydration_nutrition",
      "evidence_ncaa_weight_management",
      "evidence_grappling_grip_dehydration_transfer",
      "data_hydration_status_for_weigh_in",
      "threshold_hydration_status_review_trigger_candidate",
      "threshold_sauna_heat_exposure_review_candidate",
    ],
    reviewTracks: ["medical", "coach"],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Source separates hydration education from diagnosis or heat-exposure prescription",
    ],
    rejectionCriteria: [
      ...COMMON_REJECTION_CRITERIA,
      "Source encourages heat exposure as a generic weight-making method",
    ],
    extractionQuestions: [
      "What safety wording is required for hydration and heat-exposure review notes?",
      "What conditions make the source unsuitable for automated recommendations?",
      "What evidence is needed before coach-facing language can mention sauna or heat exposure?",
    ],
    requiredBibliographicFields: COMMON_BIBLIOGRAPHIC_FIELDS,
    candidateSourceNotes: [
      ...COMMON_NOTES,
      "Requires medical review before any coach-facing source claim",
    ],
    forbiddenUseUntilAccepted: [
      ...COMMON_FORBIDDEN_USE,
      "automatic hydration diagnosis",
      "automatic sauna recommendation",
      "automatic dehydration warning as medical clearance",
    ],
    futureTargetLayers: [
      ...SOURCE_LOOKUP_TARGETS,
      "threshold_candidate_update",
      "risk_check_future",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "readiness_multi_signal_monitoring_source_need",
    area: "readiness",
    title: "Readiness multi-signal monitoring source need",
    needType: "consensus_statement",
    status: "mentioned_in_existing_docs",
    linkedSourceExpansionBacklogIds: [
      "reds_low_energy_availability_sources",
      "wearable_data_quality_and_readiness_sources",
      "rhr_hrv_sleep_readiness_composite_sources",
    ],
    linkedEvidenceDependencyIds: [
      "recovery_monitoring_consensus",
      "wearable_validity_trend",
      "perform_evidence_matrix",
    ],
    linkedDataDependencyIds: [
      "sleep_readiness_for_load_confidence",
      "resting_hr_trend_for_recovery_confidence",
      "hrv_trend_for_recovery_confidence",
      "wearable_data_quality_for_readiness",
      "readiness_context_for_load_confidence",
    ],
    linkedThresholdCandidateIds: [
      "sleep_low_confidence_candidate",
      "rhr_deviation_candidate",
      "hrv_trend_candidate",
      "wearable_data_quality_candidate",
      "multi_signal_readiness_candidate",
    ],
    linkedReviewDecisionIds: [
      "evidence_recovery_monitoring_consensus",
      "evidence_wearable_validity_trend",
      "evidence_perform_evidence_matrix",
      "data_sleep_readiness_for_load_confidence",
      "data_resting_hr_trend_for_recovery_confidence",
      "data_hrv_trend_for_recovery_confidence",
      "data_wearable_data_quality_for_readiness",
      "data_readiness_context_for_load_confidence",
      "threshold_sleep_low_confidence_candidate",
      "threshold_rhr_deviation_candidate",
      "threshold_hrv_trend_candidate",
      "threshold_wearable_data_quality_candidate",
      "threshold_multi_signal_readiness_candidate",
    ],
    reviewTracks: ["data_quality", "coach", "sport_science"],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Source supports multi-signal interpretation without treating one signal as a diagnosis",
    ],
    rejectionCriteria: [
      ...COMMON_REJECTION_CRITERIA,
      "Source treats a single readiness signal as absolute truth",
    ],
    extractionQuestions: [
      "Which signals are valid as trends and which require manual context?",
      "How should missing or partial readiness data be described in review export?",
      "What claims must stay advisory until data-quality review is complete?",
    ],
    requiredBibliographicFields: COMMON_BIBLIOGRAPHIC_FIELDS,
    candidateSourceNotes: [
      ...COMMON_NOTES,
      "Requires data-quality review before claim extraction",
    ],
    forbiddenUseUntilAccepted: [
      ...COMMON_FORBIDDEN_USE,
      "isolated signal diagnosis",
      "wearable absolute truth",
      "automatic load gate from readiness trend",
    ],
    futureTargetLayers: [
      ...SOURCE_LOOKUP_TARGETS,
      "data_dependency_update",
      "threshold_candidate_update",
      "risk_check_future",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "wearable_validity_reliability_source_need",
    area: "wearable_data",
    title: "Wearable validity and reliability source need",
    needType: "validity_reliability_study",
    status: "mentioned_in_existing_docs",
    linkedSourceExpansionBacklogIds: ["wearable_data_quality_and_readiness_sources"],
    linkedEvidenceDependencyIds: [
      "wearable_validity_trend",
      "recovery_monitoring_consensus",
    ],
    linkedDataDependencyIds: [
      "wearable_data_quality_for_readiness",
      "readiness_context_for_load_confidence",
    ],
    linkedThresholdCandidateIds: [
      "wearable_data_quality_candidate",
      "multi_signal_readiness_candidate",
    ],
    linkedReviewDecisionIds: [
      "evidence_wearable_validity_trend",
      "evidence_recovery_monitoring_consensus",
      "data_wearable_data_quality_for_readiness",
      "data_readiness_context_for_load_confidence",
      "threshold_wearable_data_quality_candidate",
      "threshold_multi_signal_readiness_candidate",
    ],
    reviewTracks: ["data_quality", "sport_science", "product_safety"],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Source identifies device-data limits and trend-only use",
    ],
    rejectionCriteria: [
      ...COMMON_REJECTION_CRITERIA,
      "Source makes unsupported claims about consumer wearable precision",
    ],
    extractionQuestions: [
      "Which wearable fields can support trends only?",
      "What data completeness or timestamp context must be captured?",
      "How should review export phrase low-confidence wearable signals?",
    ],
    requiredBibliographicFields: COMMON_BIBLIOGRAPHIC_FIELDS,
    candidateSourceNotes: [
      ...COMMON_NOTES,
      "Requires data-quality review before source claims are reused",
    ],
    forbiddenUseUntilAccepted: [
      ...COMMON_FORBIDDEN_USE,
      "wearable absolute truth",
      "automatic recovery diagnosis from device data",
    ],
    futureTargetLayers: [
      ...SOURCE_LOOKUP_TARGETS,
      "data_dependency_update",
      "review_export",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "sleep_readiness_context_source_need",
    area: "sleep",
    title: "Sleep readiness context source need",
    needType: "consensus_statement",
    status: "needs_external_lookup",
    linkedSourceExpansionBacklogIds: ["rhr_hrv_sleep_readiness_composite_sources"],
    linkedEvidenceDependencyIds: [
      "recovery_monitoring_consensus",
      "wearable_validity_trend",
    ],
    linkedDataDependencyIds: [
      "sleep_readiness_for_load_confidence",
      "readiness_context_for_load_confidence",
    ],
    linkedThresholdCandidateIds: [
      "sleep_low_confidence_candidate",
      "multi_signal_readiness_candidate",
    ],
    linkedReviewDecisionIds: [
      "evidence_recovery_monitoring_consensus",
      "evidence_wearable_validity_trend",
      "data_sleep_readiness_for_load_confidence",
      "data_readiness_context_for_load_confidence",
      "threshold_sleep_low_confidence_candidate",
      "threshold_multi_signal_readiness_candidate",
    ],
    reviewTracks: ["data_quality", "coach", "sport_science"],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Source clarifies sleep as a contextual readiness signal rather than a hard gate",
    ],
    rejectionCriteria: [
      ...COMMON_REJECTION_CRITERIA,
      "Source promotes a universal sleep cutoff for all athletes",
    ],
    extractionQuestions: [
      "What sleep context can be safely summarized for coach review?",
      "Which claims require athlete-reported context before use?",
      "What wording prevents sleep from becoming an automatic threshold?",
    ],
    requiredBibliographicFields: COMMON_BIBLIOGRAPHIC_FIELDS,
    candidateSourceNotes: COMMON_NOTES,
    forbiddenUseUntilAccepted: [
      ...COMMON_FORBIDDEN_USE,
      "automatic sleep threshold",
      "automatic training block removal from sleep alone",
    ],
    futureTargetLayers: [
      ...SOURCE_LOOKUP_TARGETS,
      "data_dependency_update",
      "threshold_candidate_update",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "rhr_trend_monitoring_source_need",
    area: "rhr",
    title: "Resting heart-rate trend monitoring source need",
    needType: "validity_reliability_study",
    status: "needs_external_lookup",
    linkedSourceExpansionBacklogIds: ["rhr_hrv_sleep_readiness_composite_sources"],
    linkedEvidenceDependencyIds: [
      "recovery_monitoring_consensus",
      "wearable_validity_trend",
    ],
    linkedDataDependencyIds: [
      "resting_hr_trend_for_recovery_confidence",
      "readiness_context_for_load_confidence",
    ],
    linkedThresholdCandidateIds: [
      "rhr_deviation_candidate",
      "multi_signal_readiness_candidate",
    ],
    linkedReviewDecisionIds: [
      "evidence_recovery_monitoring_consensus",
      "evidence_wearable_validity_trend",
      "data_resting_hr_trend_for_recovery_confidence",
      "data_readiness_context_for_load_confidence",
      "threshold_rhr_deviation_candidate",
      "threshold_multi_signal_readiness_candidate",
    ],
    reviewTracks: ["data_quality", "coach", "sport_science"],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Source describes trend interpretation and measurement context",
    ],
    rejectionCriteria: [
      ...COMMON_REJECTION_CRITERIA,
      "Source turns resting heart-rate changes into a standalone diagnosis",
    ],
    extractionQuestions: [
      "What measurement consistency must be present before trend review?",
      "Which athlete context should accompany resting heart-rate signals?",
      "What claims remain warning-candidate-only?",
    ],
    requiredBibliographicFields: COMMON_BIBLIOGRAPHIC_FIELDS,
    candidateSourceNotes: COMMON_NOTES,
    forbiddenUseUntilAccepted: [
      ...COMMON_FORBIDDEN_USE,
      "automatic resting heart-rate threshold",
      "isolated signal diagnosis",
    ],
    futureTargetLayers: [
      ...SOURCE_LOOKUP_TARGETS,
      "data_dependency_update",
      "threshold_candidate_update",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "hrv_trend_monitoring_source_need",
    area: "hrv",
    title: "Heart-rate-variability trend monitoring source need",
    needType: "validity_reliability_study",
    status: "needs_external_lookup",
    linkedSourceExpansionBacklogIds: ["rhr_hrv_sleep_readiness_composite_sources"],
    linkedEvidenceDependencyIds: [
      "recovery_monitoring_consensus",
      "wearable_validity_trend",
    ],
    linkedDataDependencyIds: [
      "hrv_trend_for_recovery_confidence",
      "readiness_context_for_load_confidence",
    ],
    linkedThresholdCandidateIds: [
      "hrv_trend_candidate",
      "multi_signal_readiness_candidate",
    ],
    linkedReviewDecisionIds: [
      "evidence_recovery_monitoring_consensus",
      "evidence_wearable_validity_trend",
      "data_hrv_trend_for_recovery_confidence",
      "data_readiness_context_for_load_confidence",
      "threshold_hrv_trend_candidate",
      "threshold_multi_signal_readiness_candidate",
    ],
    reviewTracks: ["data_quality", "coach", "sport_science"],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Source describes trend reliability and context required before interpretation",
    ],
    rejectionCriteria: [
      ...COMMON_REJECTION_CRITERIA,
      "Source treats heart-rate-variability as a standalone clearance or blocker",
    ],
    extractionQuestions: [
      "What context makes the trend interpretable for review export?",
      "Which device or measurement limits must be stated?",
      "What claims remain blocked from runtime gating?",
    ],
    requiredBibliographicFields: COMMON_BIBLIOGRAPHIC_FIELDS,
    candidateSourceNotes: COMMON_NOTES,
    forbiddenUseUntilAccepted: [
      ...COMMON_FORBIDDEN_USE,
      "automatic heart-rate-variability threshold",
      "isolated signal diagnosis",
    ],
    futureTargetLayers: [
      ...SOURCE_LOOKUP_TARGETS,
      "data_dependency_update",
      "threshold_candidate_update",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "pain_review_intake_source_need",
    area: "pain",
    title: "Pain review intake source need",
    needType: "clinical_guideline",
    status: "needs_external_lookup",
    linkedSourceExpansionBacklogIds: ["injury_pain_return_to_training_sources"],
    linkedEvidenceDependencyIds: [
      "perform_evidence_matrix",
      "recovery_monitoring_consensus",
      "nsca_youth_safe_progression",
    ],
    linkedDataDependencyIds: ["pain_location_severity_for_block_eligibility"],
    linkedThresholdCandidateIds: [
      "pain_unknown_location_candidate",
      "pain_severity_threshold_candidate",
    ],
    linkedReviewDecisionIds: [
      "evidence_perform_evidence_matrix",
      "evidence_recovery_monitoring_consensus",
      "evidence_nsca_youth_safe_progression",
      "data_pain_location_severity_for_block_eligibility",
      "threshold_pain_unknown_location_candidate",
      "threshold_pain_severity_threshold_candidate",
    ],
    reviewTracks: ["medical", "coach"],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Source supports pain-context triage without replacing medical review",
    ],
    rejectionCriteria: [
      ...COMMON_REJECTION_CRITERIA,
      "Source implies pain can be automatically cleared by software",
    ],
    extractionQuestions: [
      "What pain-context questions belong in review intake?",
      "Which pain claims require medical confirmation before any coach language?",
      "What wording prevents pain severity from becoming a cutoff?",
    ],
    requiredBibliographicFields: COMMON_BIBLIOGRAPHIC_FIELDS,
    candidateSourceNotes: [
      ...COMMON_NOTES,
      "Requires medical review before runtime use",
    ],
    forbiddenUseUntilAccepted: [
      ...COMMON_FORBIDDEN_USE,
      "automatic pain-load decision",
      "pain cutoff",
      "return-to-training clearance",
    ],
    futureTargetLayers: [
      ...SOURCE_LOOKUP_TARGETS,
      "block_eligibility_future",
      "risk_check_future",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "injury_return_source_need",
    area: "injury",
    title: "Injury return-to-training source need",
    needType: "clinical_guideline",
    status: "needs_external_lookup",
    linkedSourceExpansionBacklogIds: ["injury_pain_return_to_training_sources"],
    linkedEvidenceDependencyIds: [
      "perform_evidence_matrix",
      "recovery_monitoring_consensus",
      "nsca_youth_safe_progression",
    ],
    linkedDataDependencyIds: ["injury_status_for_return_to_training"],
    linkedThresholdCandidateIds: ["injury_return_to_training_candidate"],
    linkedReviewDecisionIds: [
      "evidence_perform_evidence_matrix",
      "evidence_recovery_monitoring_consensus",
      "evidence_nsca_youth_safe_progression",
      "data_injury_status_for_return_to_training",
      "threshold_injury_return_to_training_candidate",
    ],
    reviewTracks: ["medical", "coach", "product_safety"],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Source confirms that return decisions remain medical or coach review decisions",
    ],
    rejectionCriteria: [
      ...COMMON_REJECTION_CRITERIA,
      "Source is too generic to guide combat-sport return review",
    ],
    extractionQuestions: [
      "Which return-to-training claims can be recorded only as review questions?",
      "What context must remain blocked for automation?",
      "How should injury status appear in review export without clearance language?",
    ],
    requiredBibliographicFields: COMMON_BIBLIOGRAPHIC_FIELDS,
    candidateSourceNotes: [
      ...COMMON_NOTES,
      "Requires medical review before any claim extraction is reused",
    ],
    forbiddenUseUntilAccepted: [
      ...COMMON_FORBIDDEN_USE,
      "automatic return-to-training",
      "medical clearance",
      "automatic injury block selection",
    ],
    futureTargetLayers: [
      ...SOURCE_LOOKUP_TARGETS,
      "block_eligibility_future",
      "risk_check_future",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "female_context_review_source_need",
    area: "female_context",
    title: "Female-context review source need",
    needType: "consensus_statement",
    status: "needs_external_lookup",
    linkedSourceExpansionBacklogIds: [
      "reds_low_energy_availability_sources",
      "female_context_symptom_aware_readiness_sources",
    ],
    linkedEvidenceDependencyIds: [
      "perform_evidence_matrix",
      "acsm_hydration_nutrition",
      "recovery_monitoring_consensus",
    ],
    linkedDataDependencyIds: ["female_context_for_reds_or_cycle_sensitive_decisions"],
    linkedThresholdCandidateIds: [
      "female_symptom_context_candidate",
      "reds_risk_review_candidate",
    ],
    linkedReviewDecisionIds: [
      "evidence_perform_evidence_matrix",
      "evidence_acsm_hydration_nutrition",
      "evidence_recovery_monitoring_consensus",
      "data_female_context_for_reds_or_cycle_sensitive_decisions",
      "threshold_female_symptom_context_candidate",
      "threshold_reds_risk_review_candidate",
    ],
    reviewTracks: ["medical", "coach", "sport_science"],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Source addresses symptom-aware context without automatic cycle-phase adjustment",
    ],
    rejectionCriteria: [
      ...COMMON_REJECTION_CRITERIA,
      "Source makes universal phase-based training rules without individual context",
    ],
    extractionQuestions: [
      "Which symptom-aware questions belong in review intake?",
      "What claims must remain medical-review-only?",
      "How can review export avoid diagnosis or automatic plan changes?",
    ],
    requiredBibliographicFields: COMMON_BIBLIOGRAPHIC_FIELDS,
    candidateSourceNotes: [
      ...COMMON_NOTES,
      "Requires medical and sport-science review before claim extraction",
    ],
    forbiddenUseUntilAccepted: [
      ...COMMON_FORBIDDEN_USE,
      "cycle-phase automatic adjustment",
      "automatic medical interpretation",
    ],
    futureTargetLayers: [
      ...SOURCE_LOOKUP_TARGETS,
      "data_dependency_update",
      "review_decision_update",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "female_reds_context_source_need",
    area: "reds",
    title: "RED-S context source need",
    needType: "clinical_guideline",
    status: "needs_external_lookup",
    linkedSourceExpansionBacklogIds: ["reds_low_energy_availability_sources"],
    linkedEvidenceDependencyIds: [
      "perform_evidence_matrix",
      "acsm_hydration_nutrition",
    ],
    linkedDataDependencyIds: ["female_context_for_reds_or_cycle_sensitive_decisions"],
    linkedThresholdCandidateIds: [
      "female_symptom_context_candidate",
      "reds_risk_review_candidate",
    ],
    linkedReviewDecisionIds: [
      "evidence_perform_evidence_matrix",
      "evidence_acsm_hydration_nutrition",
      "data_female_context_for_reds_or_cycle_sensitive_decisions",
      "threshold_female_symptom_context_candidate",
      "threshold_reds_risk_review_candidate",
    ],
    reviewTracks: ["medical", "sport_science", "product_safety"],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Source defines what can be asked during review intake without diagnosis",
    ],
    rejectionCriteria: [
      ...COMMON_REJECTION_CRITERIA,
      "Source wording could be used as a software diagnosis",
    ],
    extractionQuestions: [
      "Which RED-S-sensitive claims are source-supported as intake questions only?",
      "What language must be blocked from coach-facing automation?",
      "Which follow-up belongs to medical review rather than planning logic?",
    ],
    requiredBibliographicFields: COMMON_BIBLIOGRAPHIC_FIELDS,
    candidateSourceNotes: [
      ...COMMON_NOTES,
      "Requires medical review before runtime use",
    ],
    forbiddenUseUntilAccepted: [
      ...COMMON_FORBIDDEN_USE,
      "RED-S diagnosis",
      "automatic cycle-phase adjustment",
      "automatic weight-cut permission",
    ],
    futureTargetLayers: [
      ...SOURCE_LOOKUP_TARGETS,
      "review_decision_update",
      "risk_check_future",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "youth_high_load_and_weight_cut_source_need",
    area: "youth_context",
    title: "Youth high-load and weight-cut source need",
    needType: "position_stand",
    status: "mentioned_in_existing_docs",
    linkedSourceExpansionBacklogIds: ["youth_high_load_and_weight_cut_sources"],
    linkedEvidenceDependencyIds: [
      "nsca_youth_safe_progression",
      "ncaa_weight_management",
      "china_bfr_half_squat_wrestlers",
    ],
    linkedDataDependencyIds: ["youth_context_for_high_load_progression"],
    linkedThresholdCandidateIds: [
      "youth_high_load_progression_candidate",
      "youth_weight_cut_block_candidate",
    ],
    linkedReviewDecisionIds: [
      "evidence_nsca_youth_safe_progression",
      "evidence_ncaa_weight_management",
      "evidence_china_bfr_half_squat_wrestlers",
      "data_youth_context_for_high_load_progression",
      "threshold_youth_high_load_progression_candidate",
      "threshold_youth_weight_cut_block_candidate",
    ],
    reviewTracks: ["medical", "coach", "sport_science"],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Source separates youth progression guidance from adult template scaling",
    ],
    rejectionCriteria: [
      ...COMMON_REJECTION_CRITERIA,
      "Source assumes adult load progression applies to youth athletes",
    ],
    extractionQuestions: [
      "What youth-context questions must be asked before high-load progression?",
      "What weight-making claims must remain blocked for youth athletes?",
      "Which source limits should appear in review export?",
    ],
    requiredBibliographicFields: COMMON_BIBLIOGRAPHIC_FIELDS,
    candidateSourceNotes: [
      ...COMMON_NOTES,
      "Requires coach and medical review before claim extraction",
    ],
    forbiddenUseUntilAccepted: [
      ...COMMON_FORBIDDEN_USE,
      "adult-matrix auto scaling",
      "automatic youth weight cutting",
      "automatic youth high-load progression",
    ],
    futureTargetLayers: [
      ...SOURCE_LOOKUP_TARGETS,
      "threshold_candidate_update",
      "block_eligibility_future",
      "volume_allocator_future",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "wrestling_contact_load_source_need",
    area: "contact_load",
    title: "Wrestling contact-load classification source need",
    needType: "sport_specific_review",
    status: "mentioned_in_existing_docs",
    linkedSourceExpansionBacklogIds: ["wrestling_contact_load_classification_sources"],
    linkedEvidenceDependencyIds: [
      "wrestling_temporal_structure",
      "europe_pre_competition_plan",
      "perform_evidence_matrix",
      "grappling_grip_dehydration_transfer",
    ],
    linkedDataDependencyIds: ["contact_load_exposure_for_wrestling_sessions"],
    linkedThresholdCandidateIds: [
      "contact_load_exposure_candidate",
      "control_bouts_recovery_window_candidate",
    ],
    linkedReviewDecisionIds: [
      "evidence_wrestling_temporal_structure",
      "evidence_europe_pre_competition_plan",
      "evidence_perform_evidence_matrix",
      "evidence_grappling_grip_dehydration_transfer",
      "data_contact_load_exposure_for_wrestling_sessions",
      "threshold_contact_load_exposure_candidate",
      "threshold_control_bouts_recovery_window_candidate",
    ],
    reviewTracks: ["coach", "sport_science"],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Source helps classify contact exposure without creating a universal cutoff",
    ],
    rejectionCriteria: [
      ...COMMON_REJECTION_CRITERIA,
      "Source is not transferable to wrestling or comparable combat-sport contact",
    ],
    extractionQuestions: [
      "What contact-exposure categories can be defined for review intake?",
      "Which competition-model details require coach confirmation?",
      "What claims must remain source-expansion questions rather than gates?",
    ],
    requiredBibliographicFields: COMMON_BIBLIOGRAPHIC_FIELDS,
    candidateSourceNotes: [
      ...COMMON_NOTES,
      "Requires coach and sport-science review before claim extraction",
    ],
    forbiddenUseUntilAccepted: [
      ...COMMON_FORBIDDEN_USE,
      "contact-minute threshold",
      "control-bout recovery hard window",
      "automatic contact-load gate",
    ],
    futureTargetLayers: [
      ...SOURCE_LOOKUP_TARGETS,
      "threshold_candidate_update",
      "block_eligibility_future",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "lmv_statodynamics_source_need",
    area: "lmv",
    title: "LMV statodynamics source need",
    needType: "peer_reviewed_intervention",
    status: "mentioned_in_existing_docs",
    linkedSourceExpansionBacklogIds: [
      "bfr_kaatsu_safety_and_screening_sources",
      "lmv_legs_recovery_and_start_proximity_sources",
    ],
    linkedEvidenceDependencyIds: [
      "bfr_kaatsu_local_metabolic",
      "china_bfr_half_squat_wrestlers",
      "europe_pre_competition_plan",
      "perform_evidence_matrix",
    ],
    linkedDataDependencyIds: [
      "lmv_local_fatigue_for_legs",
      "taper_load_context_for_hidden_fatigue",
    ],
    linkedThresholdCandidateIds: [
      "lmv_legs_recovery_window_candidate",
      "lmv_near_main_start_role_candidate",
    ],
    linkedReviewDecisionIds: [
      "evidence_bfr_kaatsu_local_metabolic",
      "evidence_china_bfr_half_squat_wrestlers",
      "evidence_europe_pre_competition_plan",
      "evidence_perform_evidence_matrix",
      "data_lmv_local_fatigue_for_legs",
      "data_taper_load_context_for_hidden_fatigue",
      "threshold_lmv_legs_recovery_window_candidate",
      "threshold_lmv_near_main_start_role_candidate",
    ],
    reviewTracks: ["medical", "coach", "sport_science"],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Source distinguishes LMV-like local metabolic work from true BFR or KAATSU",
    ],
    rejectionCriteria: [
      ...COMMON_REJECTION_CRITERIA,
      "Source implies true BFR prescription can be automated",
    ],
    extractionQuestions: [
      "Which claims apply to local metabolic stress without true BFR prescription?",
      "What recovery-context claims remain coach review questions?",
      "Which close-start LMV claims must stay blocked?",
    ],
    requiredBibliographicFields: COMMON_BIBLIOGRAPHIC_FIELDS,
    candidateSourceNotes: [
      ...COMMON_NOTES,
      "Requires medical and coach review before source claims are reused",
    ],
    forbiddenUseUntilAccepted: [
      ...COMMON_FORBIDDEN_USE,
      "true BFR or KAATSU automatic prescription",
      "universal close-start LMV rule",
      "automatic local-fatigue clearance",
    ],
    futureTargetLayers: [
      ...SOURCE_LOOKUP_TARGETS,
      "threshold_candidate_update",
      "block_eligibility_future",
      "volume_allocator_future",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "bfr_kaatsu_safety_screening_source_need",
    area: "bfr_kaatsu",
    title: "BFR and KAATSU safety-screening source need",
    needType: "position_stand",
    status: "requires_verification",
    linkedSourceExpansionBacklogIds: ["bfr_kaatsu_safety_and_screening_sources"],
    linkedEvidenceDependencyIds: [
      "bfr_kaatsu_local_metabolic",
      "china_bfr_half_squat_wrestlers",
    ],
    linkedDataDependencyIds: ["lmv_local_fatigue_for_legs"],
    linkedThresholdCandidateIds: ["lmv_legs_recovery_window_candidate"],
    linkedReviewDecisionIds: [
      "evidence_bfr_kaatsu_local_metabolic",
      "evidence_china_bfr_half_squat_wrestlers",
      "data_lmv_local_fatigue_for_legs",
      "threshold_lmv_legs_recovery_window_candidate",
    ],
    reviewTracks: ["medical", "coach", "sport_science", "product_safety"],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Source defines safety-screening scope before any BFR-related claim is extracted",
    ],
    rejectionCriteria: [
      ...COMMON_REJECTION_CRITERIA,
      "Source lacks safety-screening context or contraindication boundaries",
    ],
    extractionQuestions: [
      "Which BFR or KAATSU claims must remain medical-review-only?",
      "What distinguishes source description from prescription?",
      "Which screening boundaries must stay outside runtime logic?",
    ],
    requiredBibliographicFields: COMMON_BIBLIOGRAPHIC_FIELDS,
    candidateSourceNotes: [
      ...COMMON_NOTES,
      "Requires medical review before runtime use",
    ],
    forbiddenUseUntilAccepted: [
      ...COMMON_FORBIDDEN_USE,
      "BFR or KAATSU automatic prescription",
      "automatic medical screening",
      "automatic contraindication decision",
    ],
    futureTargetLayers: [
      ...SOURCE_LOOKUP_TARGETS,
      "review_decision_update",
      "review_export",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "taper_hidden_load_source_need",
    area: "taper",
    title: "Taper and hidden-load source need",
    needType: "systematic_review",
    status: "mentioned_in_existing_docs",
    linkedSourceExpansionBacklogIds: [
      "taper_hidden_glycolytic_load_sources",
      "lmv_legs_recovery_and_start_proximity_sources",
    ],
    linkedEvidenceDependencyIds: [
      "periodization_taper_peaking",
      "china_ssit_freestyle_wrestlers",
      "matrix_transition_plan",
      "europe_pre_competition_plan",
    ],
    linkedDataDependencyIds: [
      "taper_load_context_for_hidden_fatigue",
      "sleep_readiness_for_load_confidence",
      "lmv_local_fatigue_for_legs",
    ],
    linkedThresholdCandidateIds: [
      "taper_high_volume_sfp_candidate",
      "hidden_glycolytic_load_close_start_candidate",
      "lmv_near_main_start_role_candidate",
    ],
    linkedReviewDecisionIds: [
      "evidence_periodization_taper_peaking",
      "evidence_china_ssit_freestyle_wrestlers",
      "evidence_matrix_transition_plan",
      "evidence_europe_pre_competition_plan",
      "data_taper_load_context_for_hidden_fatigue",
      "data_sleep_readiness_for_load_confidence",
      "data_lmv_local_fatigue_for_legs",
      "threshold_taper_high_volume_sfp_candidate",
      "threshold_hidden_glycolytic_load_close_start_candidate",
      "threshold_lmv_near_main_start_role_candidate",
    ],
    reviewTracks: ["coach", "sport_science"],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Source explains close-start hidden load without approving a fixed window",
    ],
    rejectionCriteria: [
      ...COMMON_REJECTION_CRITERIA,
      "Source collapses taper context into a universal timing rule",
    ],
    extractionQuestions: [
      "Which taper claims can guide review questions without becoming rules?",
      "What hidden-load contexts require coach confirmation?",
      "Which threshold candidates must remain candidate-only?",
    ],
    requiredBibliographicFields: COMMON_BIBLIOGRAPHIC_FIELDS,
    candidateSourceNotes: [
      ...COMMON_NOTES,
      "Requires sport-science review before claim extraction",
    ],
    forbiddenUseUntilAccepted: [
      ...COMMON_FORBIDDEN_USE,
      "fixed close-start hard window",
      "numeric volume threshold",
      "automatic taper gate",
    ],
    futureTargetLayers: [
      ...SOURCE_LOOKUP_TARGETS,
      "threshold_candidate_update",
      "volume_allocator_future",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "competition_model_source_need",
    area: "competition_model",
    title: "Competition event model source need",
    needType: "official_regulation",
    status: "requires_verification",
    linkedSourceExpansionBacklogIds: ["competition_event_model_and_uww_rules_sources"],
    linkedEvidenceDependencyIds: [
      "wrestling_temporal_structure",
      "constructor_core_stack",
      "matrix_transition_plan",
    ],
    linkedDataDependencyIds: ["competition_day_context_for_no_training_development"],
    linkedThresholdCandidateIds: ["competition_day_no_development_candidate"],
    linkedReviewDecisionIds: [
      "evidence_wrestling_temporal_structure",
      "evidence_constructor_core_stack",
      "evidence_matrix_transition_plan",
      "data_competition_day_context_for_no_training_development",
      "threshold_competition_day_no_development_candidate",
    ],
    reviewTracks: ["coach", "sport_science", "product_safety"],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Source verifies competition context without turning it into a new runtime model",
    ],
    rejectionCriteria: [
      ...COMMON_REJECTION_CRITERIA,
      "Source cannot be tied to the relevant competition format or regulation context",
    ],
    extractionQuestions: [
      "Which competition-day assumptions are source-backed?",
      "Which bout-model details require event-specific verification?",
      "How should review export describe competition context safely?",
    ],
    requiredBibliographicFields: COMMON_BIBLIOGRAPHIC_FIELDS,
    candidateSourceNotes: [
      ...COMMON_NOTES,
      "Requires sport-science and product-safety review before claim extraction",
    ],
    forbiddenUseUntilAccepted: [
      ...COMMON_FORBIDDEN_USE,
      "normal training day on competition day",
      "hard bout-count model without verified context",
    ],
    futureTargetLayers: [
      ...SOURCE_LOOKUP_TARGETS,
      "review_decision_update",
      "rollout_gate_future",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "competition_context_review_source_need",
    area: "competition_context",
    title: "Competition context review source need",
    needType: "sport_specific_review",
    status: "mentioned_in_existing_docs",
    linkedSourceExpansionBacklogIds: ["competition_event_model_and_uww_rules_sources"],
    linkedEvidenceDependencyIds: [
      "wrestling_temporal_structure",
      "constructor_core_stack",
      "matrix_transition_plan",
    ],
    linkedDataDependencyIds: ["competition_day_context_for_no_training_development"],
    linkedThresholdCandidateIds: ["competition_day_no_development_candidate"],
    linkedReviewDecisionIds: [
      "evidence_wrestling_temporal_structure",
      "evidence_constructor_core_stack",
      "evidence_matrix_transition_plan",
      "data_competition_day_context_for_no_training_development",
      "threshold_competition_day_no_development_candidate",
    ],
    reviewTracks: ["coach", "sport_science", "product_safety"],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Source supports competition-context review notes without changing day selection logic",
    ],
    rejectionCriteria: [
      ...COMMON_REJECTION_CRITERIA,
      "Source cannot distinguish competition context from ordinary training",
    ],
    extractionQuestions: [
      "What context must be captured before competition-day claims are shown?",
      "What should remain product-safety review rather than sport-science evidence?",
      "Which assumptions require manual event confirmation?",
    ],
    requiredBibliographicFields: COMMON_BIBLIOGRAPHIC_FIELDS,
    candidateSourceNotes: COMMON_NOTES,
    forbiddenUseUntilAccepted: [
      ...COMMON_FORBIDDEN_USE,
      "automatic competition-day rule promotion",
      "event model hard gate",
    ],
    futureTargetLayers: [
      ...SOURCE_LOOKUP_TARGETS,
      "review_decision_update",
      "rollout_gate_future",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "travel_fatigue_context_source_need",
    area: "travel_fatigue",
    title: "Travel fatigue context source need",
    needType: "sport_specific_review",
    status: "needs_external_lookup",
    linkedSourceExpansionBacklogIds: ["travel_fatigue_load_ceiling_sources"],
    linkedEvidenceDependencyIds: [
      "europe_pre_competition_plan",
      "acsm_hydration_nutrition",
      "recovery_monitoring_consensus",
    ],
    linkedDataDependencyIds: ["travel_fatigue_for_load_ceiling"],
    linkedThresholdCandidateIds: ["travel_fatigue_load_ceiling_candidate"],
    linkedReviewDecisionIds: [
      "evidence_europe_pre_competition_plan",
      "evidence_acsm_hydration_nutrition",
      "evidence_recovery_monitoring_consensus",
      "data_travel_fatigue_for_load_ceiling",
      "threshold_travel_fatigue_load_ceiling_candidate",
    ],
    reviewTracks: ["coach", "data_quality", "sport_science"],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Source keeps travel fatigue as context rather than an automatic load ceiling",
    ],
    rejectionCriteria: [
      ...COMMON_REJECTION_CRITERIA,
      "Source lacks sport or travel context needed for review intake",
    ],
    extractionQuestions: [
      "What travel context should be collected before review?",
      "Which claims remain coach-confirmed only?",
      "How should low-confidence travel data be described?",
    ],
    requiredBibliographicFields: COMMON_BIBLIOGRAPHIC_FIELDS,
    candidateSourceNotes: COMMON_NOTES,
    forbiddenUseUntilAccepted: [
      ...COMMON_FORBIDDEN_USE,
      "automatic travel load ceiling",
      "travel context hard gate",
    ],
    futureTargetLayers: [
      ...SOURCE_LOOKUP_TARGETS,
      "data_dependency_update",
      "risk_check_future",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "product_safety_rollout_source_need",
    area: "product_safety",
    title: "Product-safety rollout source need",
    needType: "product_safety_policy",
    status: "requires_verification",
    linkedSourceExpansionBacklogIds: [
      "internal_validation_outcome_measurement_sources",
      "review_export_coach_explanation_source_trace_sources",
      "competition_event_model_and_uww_rules_sources",
    ],
    linkedEvidenceDependencyIds: [
      "perform_internal_validation_pending",
      "constructor_core_stack",
      "matrix_transition_plan",
    ],
    linkedDataDependencyIds: ["readiness_context_for_load_confidence"],
    linkedThresholdCandidateIds: [
      "multi_signal_readiness_candidate",
      "competition_day_no_development_candidate",
    ],
    linkedReviewDecisionIds: [
      "evidence_perform_internal_validation_pending",
      "evidence_constructor_core_stack",
      "evidence_matrix_transition_plan",
      "data_readiness_context_for_load_confidence",
      "threshold_multi_signal_readiness_candidate",
      "threshold_competition_day_no_development_candidate",
    ],
    reviewTracks: ["product_safety", "data_quality", "sport_science"],
    acceptanceCriteria: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "Source or internal protocol defines pilot acceptance without claiming sport-science proof",
    ],
    rejectionCriteria: [
      ...COMMON_REJECTION_CRITERIA,
      "Source confuses product rollout evidence with medical or sport-science evidence",
    ],
    extractionQuestions: [
      "Which rollout acceptance questions belong in product-safety review?",
      "What evidence is required before broad Matrix default can be reconsidered?",
      "How should review export separate source traceability from rollout permission?",
    ],
    requiredBibliographicFields: COMMON_BIBLIOGRAPHIC_FIELDS,
    candidateSourceNotes: [
      ...COMMON_NOTES,
      "Requires product-safety review before any rollout-related claim is reused",
    ],
    forbiddenUseUntilAccepted: [
      ...COMMON_FORBIDDEN_USE,
      "broad Matrix default",
      "product rollout guard represented as sport-science evidence",
      "save or assign enablement",
    ],
    futureTargetLayers: [
      ...SOURCE_LOOKUP_TARGETS,
      "review_decision_update",
      "rollout_gate_future",
    ],
    runtimeChangeAllowedNow: false,
  },
] as const satisfies readonly ConstructorMatrixSourceCandidate[];

export type ConstructorMatrixSourceCandidateId =
  (typeof CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES)[number]["id"];

export const CONSTRUCTOR_MATRIX_SOURCE_CANDIDATE_IDS =
  CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES.map((item) => item.id);

const CONSTRUCTOR_MATRIX_SOURCE_CANDIDATE_ID_SET = new Set<string>(
  CONSTRUCTOR_MATRIX_SOURCE_CANDIDATE_IDS,
);

export function listConstructorMatrixSourceCandidateIds():
  ConstructorMatrixSourceCandidateId[] {
  return [...CONSTRUCTOR_MATRIX_SOURCE_CANDIDATE_IDS];
}

export function getConstructorMatrixSourceCandidate(
  id: string,
): ConstructorMatrixSourceCandidate | null {
  return CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES.find((item) => item.id === id) ?? null;
}

export function validateConstructorMatrixSourceCandidateIds(
  ids: readonly string[],
): { ok: boolean; missing: string[] } {
  const missing = ids.filter((id) => !CONSTRUCTOR_MATRIX_SOURCE_CANDIDATE_ID_SET.has(id));

  return {
    ok: missing.length === 0,
    missing,
  };
}

export function buildConstructorMatrixSourceAcquisitionSummary():
  ConstructorMatrixSourceAcquisitionSummary {
  const p0BacklogIds = CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG
    .filter((item) => item.priority === "P0")
    .map((item) => item.id as ConstructorMatrixSourceExpansionBacklogId);
  const linkedSourceExpansionBacklogIds = unique(
    CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES.flatMap((item) => item.linkedSourceExpansionBacklogIds),
  );
  const coveredP0BacklogIds = p0BacklogIds.filter((id) =>
    linkedSourceExpansionBacklogIds.includes(id),
  );
  const missingP0BacklogIds = p0BacklogIds.filter((id) =>
    !linkedSourceExpansionBacklogIds.includes(id),
  );

  return {
    totalCandidates: CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES.length,
    sourceCandidateIds: listConstructorMatrixSourceCandidateIds(),
    candidatesByArea: countBy(
      SOURCE_CANDIDATE_AREAS,
      CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES.map((item) => item.area),
    ),
    candidatesByStatus: countBy(
      SOURCE_CANDIDATE_STATUSES,
      CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES.map((item) => item.status),
    ),
    p0BacklogCoverage: {
      p0BacklogCount: p0BacklogIds.length,
      coveredP0BacklogCount: coveredP0BacklogIds.length,
      coveredP0BacklogIds,
      missingP0BacklogIds,
    },
    linkedSourceExpansionBacklogCount: linkedSourceExpansionBacklogIds.length,
    linkedEvidenceDependencyCount: unique(
      CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES.flatMap((item) => item.linkedEvidenceDependencyIds),
    ).length,
    linkedDataDependencyCount: unique(
      CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES.flatMap((item) => item.linkedDataDependencyIds),
    ).length,
    linkedThresholdCandidateCount: unique(
      CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES.flatMap((item) => item.linkedThresholdCandidateIds),
    ).length,
    linkedReviewDecisionCount: unique(
      CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES.flatMap((item) => item.linkedReviewDecisionIds),
    ).length,
    runtimeChangeAllowedNow: false,
  };
}
