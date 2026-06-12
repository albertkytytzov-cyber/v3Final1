import {
  CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES,
  type ConstructorMatrixSourceCandidateId,
} from "./constructor-matrix-source-candidates";
import {
  CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG,
  type ConstructorMatrixSourceExpansionBacklogId,
} from "./constructor-matrix-source-expansion-backlog";

export type ConstructorMatrixSourceLookupStatus =
  | "verified_exact_source"
  | "verified_official_source"
  | "verified_peer_reviewed_source"
  | "verified_consensus_or_position_stand"
  | "verified_regulatory_source"
  | "partial_match"
  | "not_found"
  | "access_blocked"
  | "lookup_unavailable"
  | "needs_manual_lookup";

export type ConstructorMatrixSourceReliability =
  | "official_policy"
  | "peer_reviewed"
  | "systematic_review"
  | "meta_analysis"
  | "consensus_statement"
  | "position_stand"
  | "regulatory_source"
  | "official_federation_rule"
  | "internal_doc_only"
  | "candidate_only"
  | "unknown";

export type ConstructorMatrixSourceUsePermission =
  | "citation_metadata_only"
  | "evidence_claim_extraction_candidate"
  | "coach_review_context_only"
  | "medical_review_context_only"
  | "data_quality_review_context_only"
  | "do_not_use_for_rules";

export type ConstructorMatrixSourceLookupReviewTrack =
  | "coach"
  | "medical"
  | "data_quality"
  | "sport_science"
  | "product_safety";

export type ConstructorMatrixSourceLookupMethod =
  | "external_web_lookup"
  | "existing_docs_only"
  | "manual_placeholder"
  | "not_attempted";

export type ConstructorMatrixSourceExtractionReadiness =
  | "ready_for_claim_extraction"
  | "needs_full_text_or_abstract"
  | "needs_manual_verification"
  | "not_ready";

export type ConstructorMatrixSourceLookupIntake = {
  id: string;
  sourceCandidateId: ConstructorMatrixSourceCandidateId;
  sourceExpansionBacklogIds: readonly ConstructorMatrixSourceExpansionBacklogId[];
  linkedEvidenceDependencyIds: readonly string[];
  linkedDataDependencyIds: readonly string[];
  linkedThresholdCandidateIds: readonly string[];
  linkedReviewDecisionIds: readonly string[];
  lookupStatus: ConstructorMatrixSourceLookupStatus;
  reliability: ConstructorMatrixSourceReliability;
  usePermission: ConstructorMatrixSourceUsePermission;
  title: string;
  authors: readonly string[];
  year: string | null;
  sourceUrl: string | null;
  doi: string | null;
  pmid: string | null;
  publisherOrOrganization: string | null;
  lookupMethod: ConstructorMatrixSourceLookupMethod;
  verificationNotes: readonly string[];
  extractionReadiness: ConstructorMatrixSourceExtractionReadiness;
  reviewRequired: readonly ConstructorMatrixSourceLookupReviewTrack[];
  limitations: readonly string[];
  forbiddenRuntimeUseNow: readonly string[];
  runtimeChangeAllowedNow: false;
};

export interface ConstructorMatrixSourceLookupIntakeSummary {
  sourceLookupIntakeCount: number;
  sourceLookupIntakeIds: readonly ConstructorMatrixSourceLookupIntakeId[];
  verifiedSourceCount: number;
  manualLookupNeededCount: number;
  extractionReadyCount: number;
  lookupUnavailableCount: number;
  sourceLookupByStatus: Readonly<Record<ConstructorMatrixSourceLookupStatus, number>>;
  sourceLookupByReliability: Readonly<Record<ConstructorMatrixSourceReliability, number>>;
  sourceLookupByReviewTrack: Readonly<Record<ConstructorMatrixSourceLookupReviewTrack, number>>;
  p0BacklogCoverage: {
    p0BacklogCount: number;
    coveredP0BacklogCount: number;
    coveredP0BacklogIds: readonly ConstructorMatrixSourceExpansionBacklogId[];
    missingP0BacklogIds: readonly ConstructorMatrixSourceExpansionBacklogId[];
  };
  p0SourceCandidateCoverage: {
    p0SourceCandidateCount: number;
    coveredP0SourceCandidateCount: number;
    coveredP0SourceCandidateIds: readonly ConstructorMatrixSourceCandidateId[];
    missingP0SourceCandidateIds: readonly ConstructorMatrixSourceCandidateId[];
  };
  sourceLookupRuntimeChangeAllowedNow: false;
}

const LOOKUP_STATUS_VALUES = [
  "verified_exact_source",
  "verified_official_source",
  "verified_peer_reviewed_source",
  "verified_consensus_or_position_stand",
  "verified_regulatory_source",
  "partial_match",
  "not_found",
  "access_blocked",
  "lookup_unavailable",
  "needs_manual_lookup",
] as const satisfies readonly ConstructorMatrixSourceLookupStatus[];

const RELIABILITY_VALUES = [
  "official_policy",
  "peer_reviewed",
  "systematic_review",
  "meta_analysis",
  "consensus_statement",
  "position_stand",
  "regulatory_source",
  "official_federation_rule",
  "internal_doc_only",
  "candidate_only",
  "unknown",
] as const satisfies readonly ConstructorMatrixSourceReliability[];

const REVIEW_TRACK_VALUES = [
  "coach",
  "medical",
  "data_quality",
  "sport_science",
  "product_safety",
] as const satisfies readonly ConstructorMatrixSourceLookupReviewTrack[];

const COMMON_FORBIDDEN_RUNTIME_USE = [
  "runtime hard rule",
  "runtime gate",
  "numeric threshold promotion",
  "production rollout promotion",
] as const;

const COMMON_VERIFIED_CITATION_NOTES = [
  "External lookup verified source identity metadata",
  "This intake records citation metadata only",
  "No runtime rule or numeric threshold is approved by this intake",
] as const;

const COMMON_FULL_TEXT_LIMITATIONS = [
  "Evidence-claim extraction still needs full text or abstract review",
  "Population and sport-transfer limits must be reviewed before any claim is reused",
  "This metadata does not move any source into runtime rules",
] as const;

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

export const CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE = [
  {
    id: "ncaa_wrestling_weight_management_program_intake",
    sourceCandidateId: "weight_cut_hydration_consensus_source_need",
    sourceExpansionBacklogIds: [
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
    lookupStatus: "verified_official_source",
    reliability: "official_policy",
    usePermission: "medical_review_context_only",
    title: "NCAA Men's Wrestling Weight Management Program Packet",
    authors: [],
    year: "2025",
    sourceUrl:
      "https://ncaaorg.s3.amazonaws.com/championships/sports/wrestling/rules/mens/2025-256RMWR_WeightManagementProgramPacket.pdf",
    doi: null,
    pmid: null,
    publisherOrOrganization: "NCAA",
    lookupMethod: "external_web_lookup",
    verificationNotes: [
      ...COMMON_VERIFIED_CITATION_NOTES,
      "Official policy source identity was verified by URL and issuing organization",
    ],
    extractionReadiness: "needs_manual_verification",
    reviewRequired: ["medical", "coach", "sport_science", "product_safety"],
    limitations: [
      "Policy wording still needs manual review before source claims are extracted",
      "Official policy context does not approve an automatic weight-cut or hydration decision",
      "No threshold value is accepted by this intake",
    ],
    forbiddenRuntimeUseNow: [
      ...COMMON_FORBIDDEN_RUNTIME_USE,
      "automatic weight-cut decision",
      "automatic hydration diagnosis",
      "Matrix default promotion",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "acsm_exercise_fluid_replacement_intake",
    sourceCandidateId: "hydration_heat_exposure_policy_source_need",
    sourceExpansionBacklogIds: ["hydration_sauna_heat_exposure_sources"],
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
    lookupStatus: "verified_consensus_or_position_stand",
    reliability: "position_stand",
    usePermission: "evidence_claim_extraction_candidate",
    title: "American College of Sports Medicine position stand. Exercise and fluid replacement.",
    authors: [
      "American College of Sports Medicine",
      "Sawka MN",
      "Burke LM",
      "Eichner ER",
      "Maughan RJ",
      "Montain SJ",
      "Stachenfeld NS",
    ],
    year: "2007",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/17277604/",
    doi: "10.1249/mss.0b013e31802ca597",
    pmid: "17277604",
    publisherOrOrganization: "Medicine and Science in Sports and Exercise",
    lookupMethod: "external_web_lookup",
    verificationNotes: COMMON_VERIFIED_CITATION_NOTES,
    extractionReadiness: "needs_full_text_or_abstract",
    reviewRequired: ["medical", "coach", "sport_science"],
    limitations: [
      ...COMMON_FULL_TEXT_LIMITATIONS,
      "Hydration source metadata is verified but no hydration diagnosis or sauna guidance is automated",
    ],
    forbiddenRuntimeUseNow: [
      ...COMMON_FORBIDDEN_RUNTIME_USE,
      "automatic hydration diagnosis",
      "automatic sauna recommendation",
      "automatic weight-cut decision",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "acsm_nutrition_athletic_performance_intake",
    sourceCandidateId: "female_context_review_source_need",
    sourceExpansionBacklogIds: [
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
    lookupStatus: "verified_consensus_or_position_stand",
    reliability: "position_stand",
    usePermission: "evidence_claim_extraction_candidate",
    title:
      "American College of Sports Medicine Joint Position Statement. Nutrition and Athletic Performance.",
    authors: ["Thomas DT", "Erdman KA", "Burke LM"],
    year: "2016",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/26891166/",
    doi: "10.1249/MSS.0000000000000852",
    pmid: "26891166",
    publisherOrOrganization: "Medicine and Science in Sports and Exercise",
    lookupMethod: "external_web_lookup",
    verificationNotes: COMMON_VERIFIED_CITATION_NOTES,
    extractionReadiness: "needs_full_text_or_abstract",
    reviewRequired: ["medical", "coach", "sport_science"],
    limitations: [
      ...COMMON_FULL_TEXT_LIMITATIONS,
      "Nutrition and female-context metadata does not approve cycle-phase or RED-S automation",
    ],
    forbiddenRuntimeUseNow: [
      ...COMMON_FORBIDDEN_RUNTIME_USE,
      "automatic medical interpretation",
      "cycle-phase automatic adjustment",
      "automatic RED-S decision",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "combat_sports_rapid_weight_loss_meta_analysis_intake",
    sourceCandidateId: "weight_cut_hydration_consensus_source_need",
    sourceExpansionBacklogIds: ["weight_cut_quantitative_safety_sources"],
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
    ],
    lookupStatus: "verified_peer_reviewed_source",
    reliability: "meta_analysis",
    usePermission: "evidence_claim_extraction_candidate",
    title:
      "Rapid Weight Loss of Up to Five Percent of the Body Mass in Less Than 7 Days Does Not Affect Physical Performance in Official Olympic Combat Athletes With Weight Classes: A Systematic Review With Meta-Analysis.",
    authors: [
      "Mauricio CA",
      "Merino P",
      "Merlo R",
      "Vargas JJN",
      "Chavez JAR",
      "Perez DV",
      "Aedo-Munoz EA",
      "Slimani M",
      "Brito CJ",
      "Bragazzi NL",
      "Miarka B",
    ],
    year: "2022",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/35492609/",
    doi: "10.3389/fphys.2022.830229",
    pmid: "35492609",
    publisherOrOrganization: "Frontiers in Physiology",
    lookupMethod: "external_web_lookup",
    verificationNotes: [
      ...COMMON_VERIFIED_CITATION_NOTES,
      "Author names are stored as ASCII-normalized PubMed initials",
    ],
    extractionReadiness: "needs_full_text_or_abstract",
    reviewRequired: ["medical", "coach", "sport_science"],
    limitations: [
      ...COMMON_FULL_TEXT_LIMITATIONS,
      "Source title contains quantitative scope; this intake records citation metadata only and approves no cutoff",
      "Combat-sport transfer limits need sport-science and medical review",
    ],
    forbiddenRuntimeUseNow: [
      ...COMMON_FORBIDDEN_RUNTIME_USE,
      "automatic weight-cut decision",
      "automatic body-mass cutoff",
      "automatic hydration diagnosis",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "recovery_performance_consensus_intake",
    sourceCandidateId: "readiness_multi_signal_monitoring_source_need",
    sourceExpansionBacklogIds: [
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
    lookupStatus: "verified_consensus_or_position_stand",
    reliability: "consensus_statement",
    usePermission: "evidence_claim_extraction_candidate",
    title: "Recovery and Performance in Sport: Consensus Statement.",
    authors: [
      "Kellmann M",
      "Bertollo M",
      "Bosquet L",
      "Brink M",
      "Coutts AJ",
      "Duffield R",
      "Erlacher D",
      "Halson SL",
      "Hecksteden A",
      "Heidari J",
      "Kallus KW",
      "Meeusen R",
      "Mujika I",
      "Robazza C",
      "Skorski S",
      "Venter R",
      "Beckmann J",
    ],
    year: "2018",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/29345524/",
    doi: "10.1123/ijspp.2017-0759",
    pmid: "29345524",
    publisherOrOrganization: "International Journal of Sports Physiology and Performance",
    lookupMethod: "external_web_lookup",
    verificationNotes: COMMON_VERIFIED_CITATION_NOTES,
    extractionReadiness: "needs_full_text_or_abstract",
    reviewRequired: ["data_quality", "coach", "sport_science"],
    limitations: [
      ...COMMON_FULL_TEXT_LIMITATIONS,
      "Readiness signals remain review context and cannot become isolated runtime gates",
    ],
    forbiddenRuntimeUseNow: [
      ...COMMON_FORBIDDEN_RUNTIME_USE,
      "isolated signal diagnosis",
      "automatic load gate from readiness trend",
      "wearable absolute truth",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "wearable_validity_systematic_review_intake",
    sourceCandidateId: "wearable_validity_reliability_source_need",
    sourceExpansionBacklogIds: ["wearable_data_quality_and_readiness_sources"],
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
    lookupStatus: "verified_peer_reviewed_source",
    reliability: "systematic_review",
    usePermission: "data_quality_review_context_only",
    title:
      "Reliability and Validity of Commercially Available Wearable Devices for Measuring Steps, Energy Expenditure, and Heart Rate: Systematic Review.",
    authors: [
      "Fuller D",
      "Colwell E",
      "Low J",
      "Orychock K",
      "Tobin MA",
      "Simango B",
      "Buote R",
      "Van Heerden D",
      "Luan H",
      "Cullen K",
      "Slade L",
      "Taylor NGA",
    ],
    year: "2020",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/32897239/",
    doi: "10.2196/18694",
    pmid: "32897239",
    publisherOrOrganization: "JMIR mHealth and uHealth",
    lookupMethod: "external_web_lookup",
    verificationNotes: COMMON_VERIFIED_CITATION_NOTES,
    extractionReadiness: "needs_full_text_or_abstract",
    reviewRequired: ["data_quality", "sport_science", "product_safety"],
    limitations: [
      ...COMMON_FULL_TEXT_LIMITATIONS,
      "Wearable validity evidence is limited to source review and does not make device data absolute truth",
    ],
    forbiddenRuntimeUseNow: [
      ...COMMON_FORBIDDEN_RUNTIME_USE,
      "wearable absolute truth",
      "automatic recovery diagnosis from device data",
      "automatic threshold cutoff",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "ioc_reds_consensus_statement_intake",
    sourceCandidateId: "female_reds_context_source_need",
    sourceExpansionBacklogIds: ["reds_low_energy_availability_sources"],
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
    lookupStatus: "verified_consensus_or_position_stand",
    reliability: "consensus_statement",
    usePermission: "medical_review_context_only",
    title:
      "2023 International Olympic Committee's (IOC) consensus statement on Relative Energy Deficiency in Sport (REDs).",
    authors: [
      "Mountjoy M",
      "Ackerman KE",
      "Bailey DM",
      "Burke LM",
      "Constantini N",
      "Hackney AC",
      "Heikura IA",
      "Melin A",
      "Pensgaard AM",
      "Stellingwerff T",
      "Sundgot-Borgen JK",
      "Torstveit MK",
      "Jacobsen AU",
      "Verhagen E",
      "Budgett R",
      "Engebretsen L",
      "Erdener U",
    ],
    year: "2023",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/37752011/",
    doi: "10.1136/bjsports-2023-106994",
    pmid: "37752011",
    publisherOrOrganization: "British Journal of Sports Medicine",
    lookupMethod: "external_web_lookup",
    verificationNotes: COMMON_VERIFIED_CITATION_NOTES,
    extractionReadiness: "needs_full_text_or_abstract",
    reviewRequired: ["medical", "sport_science", "product_safety"],
    limitations: [
      ...COMMON_FULL_TEXT_LIMITATIONS,
      "RED-S-related source metadata is not a diagnosis, screening rule or plan-adjustment rule",
    ],
    forbiddenRuntimeUseNow: [
      ...COMMON_FORBIDDEN_RUNTIME_USE,
      "RED-S diagnosis",
      "automatic medical interpretation",
      "automatic weight-cut permission",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "return_to_sport_pain_review_intake",
    sourceCandidateId: "pain_review_intake_source_need",
    sourceExpansionBacklogIds: ["injury_pain_return_to_training_sources"],
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
    lookupStatus: "verified_consensus_or_position_stand",
    reliability: "consensus_statement",
    usePermission: "medical_review_context_only",
    title:
      "2016 Consensus statement on return to sport from the First World Congress in Sports Physical Therapy, Bern.",
    authors: [
      "Ardern CL",
      "Glasgow P",
      "Schneiders A",
      "Witvrouw E",
      "Clarsen B",
      "Cools A",
      "Gojanovic B",
      "Griffin S",
      "Khan KM",
      "Moksnes H",
      "Mutch SA",
      "Phillips N",
      "Reurink G",
      "Sadler R",
      "Silbernagel KG",
      "Thorborg K",
      "Wangensteen A",
      "Wilk KE",
      "Bizzini M",
    ],
    year: "2016",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/27226389/",
    doi: "10.1136/bjsports-2016-096278",
    pmid: "27226389",
    publisherOrOrganization: "British Journal of Sports Medicine",
    lookupMethod: "external_web_lookup",
    verificationNotes: COMMON_VERIFIED_CITATION_NOTES,
    extractionReadiness: "needs_full_text_or_abstract",
    reviewRequired: ["medical", "coach"],
    limitations: [
      ...COMMON_FULL_TEXT_LIMITATIONS,
      "Pain-context review remains an intake question and does not clear athletes for training",
    ],
    forbiddenRuntimeUseNow: [
      ...COMMON_FORBIDDEN_RUNTIME_USE,
      "automatic pain-load decision",
      "pain cutoff",
      "return-to-training clearance",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "return_to_sport_injury_review_intake",
    sourceCandidateId: "injury_return_source_need",
    sourceExpansionBacklogIds: ["injury_pain_return_to_training_sources"],
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
    lookupStatus: "verified_consensus_or_position_stand",
    reliability: "consensus_statement",
    usePermission: "medical_review_context_only",
    title:
      "2016 Consensus statement on return to sport from the First World Congress in Sports Physical Therapy, Bern.",
    authors: [
      "Ardern CL",
      "Glasgow P",
      "Schneiders A",
      "Witvrouw E",
      "Clarsen B",
      "Cools A",
      "Gojanovic B",
      "Griffin S",
      "Khan KM",
      "Moksnes H",
      "Mutch SA",
      "Phillips N",
      "Reurink G",
      "Sadler R",
      "Silbernagel KG",
      "Thorborg K",
      "Wangensteen A",
      "Wilk KE",
      "Bizzini M",
    ],
    year: "2016",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/27226389/",
    doi: "10.1136/bjsports-2016-096278",
    pmid: "27226389",
    publisherOrOrganization: "British Journal of Sports Medicine",
    lookupMethod: "external_web_lookup",
    verificationNotes: COMMON_VERIFIED_CITATION_NOTES,
    extractionReadiness: "needs_full_text_or_abstract",
    reviewRequired: ["medical", "coach", "product_safety"],
    limitations: [
      ...COMMON_FULL_TEXT_LIMITATIONS,
      "Return-to-training source metadata is not medical clearance and cannot select blocks",
    ],
    forbiddenRuntimeUseNow: [
      ...COMMON_FORBIDDEN_RUNTIME_USE,
      "automatic return-to-training",
      "medical clearance",
      "automatic injury block selection",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "nsca_long_term_athletic_development_intake",
    sourceCandidateId: "youth_high_load_and_weight_cut_source_need",
    sourceExpansionBacklogIds: ["youth_high_load_and_weight_cut_sources"],
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
    lookupStatus: "verified_consensus_or_position_stand",
    reliability: "position_stand",
    usePermission: "medical_review_context_only",
    title:
      "National Strength and Conditioning Association Position Statement on Long-Term Athletic Development.",
    authors: [
      "Lloyd RS",
      "Cronin JB",
      "Faigenbaum AD",
      "Haff GG",
      "Howard R",
      "Kraemer WJ",
      "Micheli LJ",
      "Myer GD",
      "Oliver JL",
    ],
    year: "2016",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/26933920/",
    doi: "10.1519/JSC.0000000000001387",
    pmid: "26933920",
    publisherOrOrganization: "Journal of Strength and Conditioning Research",
    lookupMethod: "external_web_lookup",
    verificationNotes: COMMON_VERIFIED_CITATION_NOTES,
    extractionReadiness: "needs_full_text_or_abstract",
    reviewRequired: ["medical", "coach", "sport_science"],
    limitations: [
      ...COMMON_FULL_TEXT_LIMITATIONS,
      "Youth context remains review-only and does not approve adult-template scaling",
    ],
    forbiddenRuntimeUseNow: [
      ...COMMON_FORBIDDEN_RUNTIME_USE,
      "adult-matrix auto scaling",
      "automatic youth weight cutting",
      "automatic youth high-load progression",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "bfr_position_stand_intake",
    sourceCandidateId: "bfr_kaatsu_safety_screening_source_need",
    sourceExpansionBacklogIds: ["bfr_kaatsu_safety_and_screening_sources"],
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
    lookupStatus: "verified_peer_reviewed_source",
    reliability: "peer_reviewed",
    usePermission: "medical_review_context_only",
    title: "Blood Flow Restriction Exercise: Considerations of Methodology, Application, and Safety.",
    authors: [
      "Patterson SD",
      "Hughes L",
      "Warmington S",
      "Burr J",
      "Scott BR",
      "Owens J",
      "Abe T",
      "Nielsen JL",
      "Libardi CA",
      "Laurentino G",
      "Neto GR",
      "Brandner C",
      "Martin-Hernandez J",
      "Loenneke J",
    ],
    year: "2019",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/31156448/",
    doi: "10.3389/fphys.2019.00533",
    pmid: "31156448",
    publisherOrOrganization: "Frontiers in Physiology",
    lookupMethod: "external_web_lookup",
    verificationNotes: COMMON_VERIFIED_CITATION_NOTES,
    extractionReadiness: "needs_full_text_or_abstract",
    reviewRequired: ["medical", "coach", "sport_science", "product_safety"],
    limitations: [
      ...COMMON_FULL_TEXT_LIMITATIONS,
      "BFR or KAATSU screening remains outside runtime logic",
    ],
    forbiddenRuntimeUseNow: [
      ...COMMON_FORBIDDEN_RUNTIME_USE,
      "BFR or KAATSU automatic prescription",
      "automatic medical screening",
      "automatic contraindication decision",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "bfr_lmv_methodology_intake",
    sourceCandidateId: "lmv_statodynamics_source_need",
    sourceExpansionBacklogIds: [
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
    lookupStatus: "verified_peer_reviewed_source",
    reliability: "peer_reviewed",
    usePermission: "coach_review_context_only",
    title: "Blood Flow Restriction Exercise: Considerations of Methodology, Application, and Safety.",
    authors: [
      "Patterson SD",
      "Hughes L",
      "Warmington S",
      "Burr J",
      "Scott BR",
      "Owens J",
      "Abe T",
      "Nielsen JL",
      "Libardi CA",
      "Laurentino G",
      "Neto GR",
      "Brandner C",
      "Martin-Hernandez J",
      "Loenneke J",
    ],
    year: "2019",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/31156448/",
    doi: "10.3389/fphys.2019.00533",
    pmid: "31156448",
    publisherOrOrganization: "Frontiers in Physiology",
    lookupMethod: "external_web_lookup",
    verificationNotes: COMMON_VERIFIED_CITATION_NOTES,
    extractionReadiness: "needs_full_text_or_abstract",
    reviewRequired: ["medical", "coach", "sport_science"],
    limitations: [
      ...COMMON_FULL_TEXT_LIMITATIONS,
      "BFR source identity is verified, but LMV transfer remains a separate coach and sport-science question",
      "This intake does not permit true BFR or KAATSU prescription",
    ],
    forbiddenRuntimeUseNow: [
      ...COMMON_FORBIDDEN_RUNTIME_USE,
      "true BFR or KAATSU automatic prescription",
      "universal close-start LMV rule",
      "automatic local-fatigue clearance",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "uww_international_wrestling_rules_intake",
    sourceCandidateId: "competition_model_source_need",
    sourceExpansionBacklogIds: ["competition_event_model_and_uww_rules_sources"],
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
    lookupStatus: "verified_official_source",
    reliability: "official_federation_rule",
    usePermission: "coach_review_context_only",
    title: "International Wrestling Rules",
    authors: [],
    year: "2026",
    sourceUrl: "https://uww.org/governance/regulations-olympic-wrestling",
    doi: null,
    pmid: null,
    publisherOrOrganization: "United World Wrestling",
    lookupMethod: "external_web_lookup",
    verificationNotes: [
      ...COMMON_VERIFIED_CITATION_NOTES,
      "Official federation rule source identity was verified from the governance page",
    ],
    extractionReadiness: "needs_manual_verification",
    reviewRequired: ["coach", "sport_science", "product_safety"],
    limitations: [
      "Competition rules need manual review before any event-context claim is extracted",
      "Official federation source metadata does not change competition-day runtime behavior",
      "No Matrix default or rollout permission is created by this intake",
    ],
    forbiddenRuntimeUseNow: [
      ...COMMON_FORBIDDEN_RUNTIME_USE,
      "normal training day on competition day",
      "hard bout-count model without verified context",
      "automatic competition-day rule promotion",
    ],
    runtimeChangeAllowedNow: false,
  },
  {
    id: "tapering_systematic_review_intake",
    sourceCandidateId: "taper_hidden_load_source_need",
    sourceExpansionBacklogIds: [
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
    lookupStatus: "verified_peer_reviewed_source",
    reliability: "systematic_review",
    usePermission: "evidence_claim_extraction_candidate",
    title: "Effects of tapering on performance in endurance athletes: A systematic review and meta-analysis.",
    authors: ["Wang Z", "Wang YT", "Gao W", "Zhong Y"],
    year: "2023",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/37163550/",
    doi: "10.1371/journal.pone.0282838",
    pmid: "37163550",
    publisherOrOrganization: "PLOS ONE",
    lookupMethod: "external_web_lookup",
    verificationNotes: COMMON_VERIFIED_CITATION_NOTES,
    extractionReadiness: "needs_full_text_or_abstract",
    reviewRequired: ["coach", "sport_science"],
    limitations: [
      ...COMMON_FULL_TEXT_LIMITATIONS,
      "Endurance-athlete evidence needs transfer review before wrestling taper questions reuse any claim",
    ],
    forbiddenRuntimeUseNow: [
      ...COMMON_FORBIDDEN_RUNTIME_USE,
      "fixed close-start hard window",
      "numeric volume threshold",
      "automatic taper gate",
    ],
    runtimeChangeAllowedNow: false,
  },
] as const satisfies readonly ConstructorMatrixSourceLookupIntake[];

const CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE_ITEMS:
  readonly ConstructorMatrixSourceLookupIntake[] =
    CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE;

export type ConstructorMatrixSourceLookupIntakeId =
  (typeof CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE)[number]["id"];

export const CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE_IDS =
  CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE.map((item) => item.id);

const CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE_ID_SET = new Set<string>(
  CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE_IDS,
);

const CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE_LOOKUP = new Map<
  ConstructorMatrixSourceLookupIntakeId,
  ConstructorMatrixSourceLookupIntake
>(
  CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE.map((item) => [
    item.id as ConstructorMatrixSourceLookupIntakeId,
    item,
  ]),
);

export function listConstructorMatrixSourceLookupIntakeIds():
  ConstructorMatrixSourceLookupIntakeId[] {
  return [...CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE_IDS] as
    ConstructorMatrixSourceLookupIntakeId[];
}

export function getConstructorMatrixSourceLookupIntake(
  id: string,
): ConstructorMatrixSourceLookupIntake | null {
  return (
    CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE_LOOKUP.get(
      id as ConstructorMatrixSourceLookupIntakeId,
    ) ?? null
  );
}

export function validateConstructorMatrixSourceLookupIntakeIds(
  ids: readonly string[],
): { ok: boolean; missing: string[] } {
  const missing = ids.filter((id) => !CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE_ID_SET.has(id));

  return {
    ok: missing.length === 0,
    missing,
  };
}

export function buildConstructorMatrixSourceLookupIntakeSummary():
  ConstructorMatrixSourceLookupIntakeSummary {
  const p0BacklogIds = CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG
    .filter((item) => item.priority === "P0")
    .map((item) => item.id as ConstructorMatrixSourceExpansionBacklogId);
  const p0SourceCandidateIds = CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES
    .filter((item) =>
      item.linkedSourceExpansionBacklogIds.some((id) => p0BacklogIds.includes(id)),
    )
    .map((item) => item.id as ConstructorMatrixSourceCandidateId);
  const coveredP0BacklogIds = p0BacklogIds.filter((id) =>
    CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE_ITEMS.some((item) =>
      item.sourceExpansionBacklogIds.includes(id),
    ),
  );
  const coveredP0SourceCandidateIds = p0SourceCandidateIds.filter((id) =>
    CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE_ITEMS.some((item) => item.sourceCandidateId === id),
  );

  return {
    sourceLookupIntakeCount: CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE.length,
    sourceLookupIntakeIds: listConstructorMatrixSourceLookupIntakeIds(),
    verifiedSourceCount: CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE_ITEMS.filter((item) =>
      item.lookupStatus.startsWith("verified_"),
    ).length,
    manualLookupNeededCount: CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE_ITEMS.filter(
      (item) =>
        item.lookupStatus === "needs_manual_lookup" ||
        item.extractionReadiness === "needs_manual_verification",
    ).length,
    extractionReadyCount: CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE_ITEMS.filter(
      (item) => item.extractionReadiness === "ready_for_claim_extraction",
    ).length,
    lookupUnavailableCount: CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE_ITEMS.filter(
      (item) => item.lookupStatus === "lookup_unavailable",
    ).length,
    sourceLookupByStatus: countBy(
      LOOKUP_STATUS_VALUES,
      CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE_ITEMS.map((item) => item.lookupStatus),
    ),
    sourceLookupByReliability: countBy(
      RELIABILITY_VALUES,
      CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE_ITEMS.map((item) => item.reliability),
    ),
    sourceLookupByReviewTrack: countBy(
      REVIEW_TRACK_VALUES,
      CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE_ITEMS.flatMap((item) => item.reviewRequired),
    ),
    p0BacklogCoverage: {
      p0BacklogCount: p0BacklogIds.length,
      coveredP0BacklogCount: coveredP0BacklogIds.length,
      coveredP0BacklogIds,
      missingP0BacklogIds: p0BacklogIds.filter((id) => !coveredP0BacklogIds.includes(id)),
    },
    p0SourceCandidateCoverage: {
      p0SourceCandidateCount: p0SourceCandidateIds.length,
      coveredP0SourceCandidateCount: coveredP0SourceCandidateIds.length,
      coveredP0SourceCandidateIds,
      missingP0SourceCandidateIds: p0SourceCandidateIds.filter(
        (id) => !coveredP0SourceCandidateIds.includes(id),
      ),
    },
    sourceLookupRuntimeChangeAllowedNow: false,
  };
}

export function listConstructorMatrixSourceLookupIntakeIdsForSourceCandidate(
  sourceCandidateId: string,
): ConstructorMatrixSourceLookupIntakeId[] {
  return CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE
    .filter((item) => item.sourceCandidateId === sourceCandidateId)
    .map((item) => item.id as ConstructorMatrixSourceLookupIntakeId);
}

export function listConstructorMatrixSourceLookupIntakeIdsForBacklog(
  sourceExpansionBacklogId: string,
): ConstructorMatrixSourceLookupIntakeId[] {
  return CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE
    .filter((item) =>
      (item.sourceExpansionBacklogIds as readonly string[]).includes(sourceExpansionBacklogId),
    )
    .map((item) => item.id as ConstructorMatrixSourceLookupIntakeId);
}

export function listConstructorMatrixSourceLookupIntakeIdsForReviewDecision(
  reviewDecisionId: string,
): ConstructorMatrixSourceLookupIntakeId[] {
  return CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE
    .filter((item) => (item.linkedReviewDecisionIds as readonly string[]).includes(reviewDecisionId))
    .map((item) => item.id as ConstructorMatrixSourceLookupIntakeId);
}
