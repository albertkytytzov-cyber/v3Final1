import {
  CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEWS,
  type ConstructorMatrixDeskSourceReviewId,
} from "./constructor-matrix-desk-source-review";
import {
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS,
  type ConstructorMatrixEvidenceClaimBlockerId,
} from "./constructor-matrix-evidence-claims";
import {
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES,
  type ConstructorMatrixEvidenceClaimReviewIntakeId,
} from "./constructor-matrix-evidence-claim-review-intake";
import {
  CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES,
  type ConstructorMatrixSourceCandidate,
  type ConstructorMatrixSourceCandidateId,
} from "./constructor-matrix-source-candidates";
import {
  CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE,
  type ConstructorMatrixSourceLookupIntake,
  type ConstructorMatrixSourceLookupIntakeId,
} from "./constructor-matrix-source-lookup-intake";

export type ConstructorMatrixEvidenceClaimCandidateStatus =
  | "desk_reviewed_candidate"
  | "desk_review_limited_candidate"
  | "needs_full_text_before_extraction"
  | "needs_policy_text_before_extraction"
  | "needs_human_review_before_extraction"
  | "manual_verification_required_before_extraction"
  | "do_not_automate_candidate";

export type ConstructorMatrixEvidenceClaimCandidateType =
  | "safety_context"
  | "methodology_context"
  | "performance_context"
  | "readiness_context"
  | "weight_management_context"
  | "hydration_context"
  | "regulatory_competition_context"
  | "data_quality_context"
  | "population_context"
  | "injury_pain_context"
  | "review_blocker_context";

export type ConstructorMatrixEvidenceClaimCandidateRuntimeUse =
  | "none"
  | "documentation_only"
  | "review_export_only"
  | "future_claim_extraction_candidate";

export type ConstructorMatrixEvidenceClaimCandidateReviewRequirement =
  | "coach_review"
  | "medical_review"
  | "sport_science_review"
  | "data_quality_review"
  | "product_safety_review"
  | "manual_source_verification";

export type ConstructorMatrixEvidenceClaimCandidate = {
  id: string;
  status: ConstructorMatrixEvidenceClaimCandidateStatus;
  candidateType: ConstructorMatrixEvidenceClaimCandidateType;
  title: string;
  candidateText: string;
  deskSourceReviewIds: readonly string[];
  sourceLookupIntakeIds: readonly string[];
  sourceCandidateIds: readonly string[];
  sourceExpansionBacklogIds: readonly string[];
  evidenceDependencyIds: readonly string[];
  dataDependencyIds: readonly string[];
  thresholdCandidateIds: readonly string[];
  reviewDecisionIds: readonly string[];
  blockerIds: readonly string[];
  reviewIntakeIds: readonly string[];
  methodOrRiskArea: readonly string[];
  populationContext: readonly string[];
  supports: readonly string[];
  limitations: readonly string[];
  reviewRequired: readonly ConstructorMatrixEvidenceClaimCandidateReviewRequirement[];
  runtimeUseNow: ConstructorMatrixEvidenceClaimCandidateRuntimeUse;
  candidateOnly: true;
  humanReviewed: false;
  runtimeChangeAllowedNow: false;
};

export interface ConstructorMatrixEvidenceClaimCandidateSummary {
  evidenceClaimCandidateCount: number;
  evidenceClaimCandidateIds: readonly ConstructorMatrixEvidenceClaimCandidateId[];
  evidenceClaimCandidatesByStatus: Readonly<
    Record<ConstructorMatrixEvidenceClaimCandidateStatus, number>
  >;
  evidenceClaimCandidatesByRuntimeUse: Readonly<
    Record<ConstructorMatrixEvidenceClaimCandidateRuntimeUse, number>
  >;
  evidenceClaimCandidatesHumanReviewedCount: number;
  evidenceClaimCandidatesRuntimeChangeAllowedNowCount: number;
  candidateOnlyCount: number;
  highRiskAreasCovered: readonly string[];
  highRiskAreasStillBlocked: readonly string[];
}

type CandidateDraft = {
  id: string;
  status: ConstructorMatrixEvidenceClaimCandidateStatus;
  candidateType: ConstructorMatrixEvidenceClaimCandidateType;
  title: string;
  candidateText: string;
  sourceLookupIntakeIds: readonly ConstructorMatrixSourceLookupIntakeId[];
  sourceCandidateIds?: readonly ConstructorMatrixSourceCandidateId[];
  sourceExpansionBacklogIds?: readonly string[];
  evidenceDependencyIds?: readonly string[];
  dataDependencyIds?: readonly string[];
  thresholdCandidateIds?: readonly string[];
  reviewDecisionIds?: readonly string[];
  blockerIds?: readonly string[];
  reviewIntakeIds?: readonly string[];
  methodOrRiskArea: readonly string[];
  populationContext: readonly string[];
  supports: readonly string[];
  limitations: readonly string[];
  reviewRequired: readonly ConstructorMatrixEvidenceClaimCandidateReviewRequirement[];
  runtimeUseNow: ConstructorMatrixEvidenceClaimCandidateRuntimeUse;
};

const CLAIM_CANDIDATE_STATUSES = [
  "desk_reviewed_candidate",
  "desk_review_limited_candidate",
  "needs_full_text_before_extraction",
  "needs_policy_text_before_extraction",
  "needs_human_review_before_extraction",
  "manual_verification_required_before_extraction",
  "do_not_automate_candidate",
] as const satisfies readonly ConstructorMatrixEvidenceClaimCandidateStatus[];

const CLAIM_CANDIDATE_RUNTIME_USES = [
  "none",
  "documentation_only",
  "review_export_only",
  "future_claim_extraction_candidate",
] as const satisfies readonly ConstructorMatrixEvidenceClaimCandidateRuntimeUse[];

const REQUIRED_HIGH_RISK_AREAS = [
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
  "youth_context",
  "travel_fatigue",
  "competition_context",
  "contact_load",
  "lmv",
  "taper",
  "bfr_kaatsu",
  "RED-S",
] as const;

const SOURCE_LOOKUP_BY_ID = new Map<
  string,
  ConstructorMatrixSourceLookupIntake
>(
  CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE.map((item) => [item.id, item]),
);

const SOURCE_CANDIDATE_BY_ID = new Map(
  CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES.map((item) => [item.id, item]),
) as Map<string, ConstructorMatrixSourceCandidate>;

const BLOCKER_BY_ID = new Map(
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS.map((item) => [item.id, item]),
);

const REVIEW_INTAKES_BY_BLOCKER_ID = new Map<string, string[]>();

for (const intake of CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES) {
  for (const blockerId of intake.blockerIds) {
    REVIEW_INTAKES_BY_BLOCKER_ID.set(blockerId, [
      ...(REVIEW_INTAKES_BY_BLOCKER_ID.get(blockerId) ?? []),
      intake.id,
    ]);
  }
}

function unique<T extends string>(items: readonly T[]): T[] {
  return Array.from(new Set(items)).sort();
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

function lookupItems(ids: readonly string[]): ConstructorMatrixSourceLookupIntake[] {
  return ids
    .map((id) => SOURCE_LOOKUP_BY_ID.get(id))
    .filter((item): item is ConstructorMatrixSourceLookupIntake => Boolean(item));
}

function blockerIdsForDraft(
  sourceLookupIntakeIds: readonly string[],
  sourceCandidateIds: readonly string[],
  explicitBlockerIds: readonly string[] = [],
): string[] {
  return unique([
    ...sourceLookupIntakeIds.map((id) => `source_lookup_${id}`),
    ...sourceCandidateIds.map((id) => `source_candidate_${id}`),
    ...explicitBlockerIds,
  ].filter((id) => BLOCKER_BY_ID.has(id)));
}

function reviewIntakeIdsForBlockers(
  blockerIds: readonly string[],
  explicitReviewIntakeIds: readonly string[] = [],
): string[] {
  return unique([
    ...blockerIds.flatMap((id) => REVIEW_INTAKES_BY_BLOCKER_ID.get(id) ?? []),
    ...explicitReviewIntakeIds,
  ]);
}

function claimCandidate(draft: CandidateDraft): ConstructorMatrixEvidenceClaimCandidate {
  const sources = lookupItems(draft.sourceLookupIntakeIds);
  const sourceCandidateIds = unique([
    ...sources.map((item) => item.sourceCandidateId),
    ...(draft.sourceCandidateIds ?? []),
  ]);
  const explicitSourceCandidates = sourceCandidateIds
    .map((id) => SOURCE_CANDIDATE_BY_ID.get(id))
    .filter((item): item is ConstructorMatrixSourceCandidate => Boolean(item));
  const blockerIds = blockerIdsForDraft(
    draft.sourceLookupIntakeIds,
    sourceCandidateIds,
    draft.blockerIds,
  );

  return {
    id: draft.id,
    status: draft.status,
    candidateType: draft.candidateType,
    title: draft.title,
    candidateText: draft.candidateText,
    deskSourceReviewIds: unique(
      sources.map((item) => `desk_source_review_${item.id}` as ConstructorMatrixDeskSourceReviewId),
    ),
    sourceLookupIntakeIds: draft.sourceLookupIntakeIds,
    sourceCandidateIds,
    sourceExpansionBacklogIds: unique([
      ...sources.flatMap((item) => item.sourceExpansionBacklogIds),
      ...explicitSourceCandidates.flatMap((item) => item.linkedSourceExpansionBacklogIds),
      ...(draft.sourceExpansionBacklogIds ?? []),
    ]),
    evidenceDependencyIds: unique([
      ...sources.flatMap((item) => item.linkedEvidenceDependencyIds),
      ...(draft.evidenceDependencyIds ?? []),
    ]),
    dataDependencyIds: unique([
      ...sources.flatMap((item) => item.linkedDataDependencyIds),
      ...(draft.dataDependencyIds ?? []),
    ]),
    thresholdCandidateIds: unique([
      ...sources.flatMap((item) => item.linkedThresholdCandidateIds),
      ...(draft.thresholdCandidateIds ?? []),
    ]),
    reviewDecisionIds: unique([
      ...sources.flatMap((item) => item.linkedReviewDecisionIds),
      ...(draft.reviewDecisionIds ?? []),
    ]),
    blockerIds,
    reviewIntakeIds: reviewIntakeIdsForBlockers(
      blockerIds,
      draft.reviewIntakeIds,
    ) as ConstructorMatrixEvidenceClaimReviewIntakeId[],
    methodOrRiskArea: draft.methodOrRiskArea,
    populationContext: draft.populationContext,
    supports: draft.supports,
    limitations: draft.limitations,
    reviewRequired: draft.reviewRequired,
    runtimeUseNow: draft.runtimeUseNow,
    candidateOnly: true,
    humanReviewed: false,
    runtimeChangeAllowedNow: false,
  };
}

export const CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES = [
  claimCandidate({
    id: "candidate_weight_cut_hydration_safety_context",
    status: "needs_full_text_before_extraction",
    candidateType: "weight_management_context",
    title: "Weight-cut and hydration safety context candidate",
    candidateText:
      "Rapid weight-loss and hydration contexts should remain safety-first review areas before any training-load decision uses them.",
    sourceLookupIntakeIds: [
      "combat_sports_rapid_weight_loss_meta_analysis_intake",
      "acsm_exercise_fluid_replacement_intake",
    ],
    methodOrRiskArea: ["weight_cut", "hydration"],
    populationContext: ["combat sport transfer", "wrestling transfer requires review"],
    supports: [
      "Verified source identities support a cautious review-export candidate only.",
      "Medical, coach and sport-science review are required before final extraction.",
    ],
    limitations: [
      "No numeric threshold approved.",
      "NCAA manual-verification source is not used as evidence support for this candidate.",
      "This candidate does not diagnose hydration status or authorize weight cutting.",
    ],
    reviewRequired: [
      "medical_review",
      "coach_review",
      "sport_science_review",
      "data_quality_review",
      "product_safety_review",
    ],
    runtimeUseNow: "future_claim_extraction_candidate",
  }),
  claimCandidate({
    id: "candidate_hydration_heat_exposure_review_context",
    status: "needs_full_text_before_extraction",
    candidateType: "hydration_context",
    title: "Hydration and heat-exposure review context candidate",
    candidateText:
      "Hydration and heat-exposure metadata should be handled as review context and not as automatic diagnosis or sauna guidance.",
    sourceLookupIntakeIds: ["acsm_exercise_fluid_replacement_intake"],
    methodOrRiskArea: ["hydration"],
    populationContext: ["general sport", "wrestling weigh-in transfer requires review"],
    supports: [
      "Source identity is verified as a position stand record.",
      "The repository already blocks hydration automation and keeps source text review pending.",
    ],
    limitations: [
      "Full text or abstract review remains required.",
      "No numeric threshold approved.",
      "This candidate cannot be used for hydration diagnosis.",
    ],
    reviewRequired: ["medical_review", "coach_review", "sport_science_review"],
    runtimeUseNow: "review_export_only",
  }),
  claimCandidate({
    id: "candidate_readiness_multi_signal_context",
    status: "needs_full_text_before_extraction",
    candidateType: "readiness_context",
    title: "Multi-signal readiness context candidate",
    candidateText:
      "Readiness signals should be treated as multi-signal context and require data-quality and coach review before influencing load confidence.",
    sourceLookupIntakeIds: ["recovery_performance_consensus_intake"],
    methodOrRiskArea: ["readiness", "sleep", "rhr", "hrv"],
    populationContext: ["general sport", "wrestling transfer requires review"],
    supports: [
      "Verified consensus source identity supports a cautious readiness-context candidate.",
      "Source lookup and existing data dependency metadata both keep isolated signals out of runtime gates.",
    ],
    limitations: [
      "No numeric threshold approved.",
      "No single signal is accepted as a runtime gate.",
      "Full text or abstract review remains required before final claim extraction.",
    ],
    reviewRequired: ["data_quality_review", "coach_review", "sport_science_review"],
    runtimeUseNow: "future_claim_extraction_candidate",
  }),
  claimCandidate({
    id: "candidate_wearable_data_quality_context",
    status: "needs_full_text_before_extraction",
    candidateType: "data_quality_context",
    title: "Wearable data-quality context candidate",
    candidateText:
      "Wearable readiness data should be treated as trend and context, with data-quality review before any future use in load confidence.",
    sourceLookupIntakeIds: [
      "wearable_validity_systematic_review_intake",
      "recovery_performance_consensus_intake",
    ],
    methodOrRiskArea: ["wearable_data", "readiness"],
    populationContext: ["general device validity", "wrestling transfer requires review"],
    supports: [
      "Verified wearable-validity source identity supports data-quality review context.",
      "Existing data dependencies already keep wearable data advisory and review-only.",
    ],
    limitations: [
      "No wearable signal is treated as absolute truth.",
      "No numeric threshold approved.",
      "Full text or abstract review remains required.",
    ],
    reviewRequired: ["data_quality_review", "sport_science_review", "product_safety_review"],
    runtimeUseNow: "future_claim_extraction_candidate",
  }),
  claimCandidate({
    id: "candidate_sleep_readiness_review_context",
    status: "needs_human_review_before_extraction",
    candidateType: "readiness_context",
    title: "Sleep readiness review context candidate",
    candidateText:
      "Sleep-readiness context should remain a data-quality and coach-review input rather than an isolated load-changing rule.",
    sourceLookupIntakeIds: ["recovery_performance_consensus_intake"],
    sourceCandidateIds: ["sleep_readiness_context_source_need"],
    evidenceDependencyIds: ["recovery_monitoring_consensus", "wearable_validity_trend"],
    dataDependencyIds: [
      "sleep_readiness_for_load_confidence",
      "readiness_context_for_load_confidence",
    ],
    thresholdCandidateIds: [
      "sleep_low_confidence_candidate",
      "multi_signal_readiness_candidate",
    ],
    reviewDecisionIds: [
      "data_sleep_readiness_for_load_confidence",
      "data_readiness_context_for_load_confidence",
      "evidence_recovery_monitoring_consensus",
      "evidence_wearable_validity_trend",
      "threshold_sleep_low_confidence_candidate",
      "threshold_multi_signal_readiness_candidate",
    ],
    methodOrRiskArea: ["sleep", "readiness"],
    populationContext: ["general sport", "wrestling transfer requires review"],
    supports: [
      "Existing source candidate metadata identifies sleep as a readiness review area.",
      "Desk review supports review routing, not final extraction.",
    ],
    limitations: [
      "No sleep cutoff or numeric threshold approved.",
      "No isolated sleep rule is accepted.",
      "Human review remains required before final extraction.",
    ],
    reviewRequired: ["data_quality_review", "coach_review", "sport_science_review"],
    runtimeUseNow: "review_export_only",
  }),
  claimCandidate({
    id: "candidate_rhr_hrv_trend_review_context",
    status: "needs_human_review_before_extraction",
    candidateType: "readiness_context",
    title: "RHR and HRV trend review context candidate",
    candidateText:
      "RHR and HRV trend metadata should remain recovery-context inputs requiring data-quality review before any future claim extraction.",
    sourceLookupIntakeIds: ["recovery_performance_consensus_intake"],
    sourceCandidateIds: [
      "rhr_trend_monitoring_source_need",
      "hrv_trend_monitoring_source_need",
    ],
    evidenceDependencyIds: ["recovery_monitoring_consensus", "wearable_validity_trend"],
    dataDependencyIds: [
      "resting_hr_trend_for_recovery_confidence",
      "hrv_trend_for_recovery_confidence",
      "readiness_context_for_load_confidence",
    ],
    thresholdCandidateIds: [
      "rhr_deviation_candidate",
      "hrv_trend_candidate",
      "multi_signal_readiness_candidate",
    ],
    reviewDecisionIds: [
      "data_resting_hr_trend_for_recovery_confidence",
      "data_hrv_trend_for_recovery_confidence",
      "data_readiness_context_for_load_confidence",
      "evidence_recovery_monitoring_consensus",
      "evidence_wearable_validity_trend",
      "threshold_rhr_deviation_candidate",
      "threshold_hrv_trend_candidate",
      "threshold_multi_signal_readiness_candidate",
    ],
    methodOrRiskArea: ["rhr", "hrv", "readiness"],
    populationContext: ["general sport", "device-derived context requires review"],
    supports: [
      "Existing source candidate metadata identifies RHR and HRV trend monitoring as review-only.",
      "Desk review supports candidate routing to data-quality review.",
    ],
    limitations: [
      "No numeric threshold approved.",
      "No automatic recovery diagnosis is allowed.",
      "Human review remains required before final extraction.",
    ],
    reviewRequired: ["data_quality_review", "coach_review", "sport_science_review"],
    runtimeUseNow: "review_export_only",
  }),
  claimCandidate({
    id: "candidate_female_energy_availability_context",
    status: "needs_full_text_before_extraction",
    candidateType: "population_context",
    title: "Female energy availability and RED-S context candidate",
    candidateText:
      "Female energy-availability and RED-S-related metadata should remain medical and sport-science review context, not diagnosis or automatic plan adjustment.",
    sourceLookupIntakeIds: [
      "acsm_nutrition_athletic_performance_intake",
      "ioc_reds_consensus_statement_intake",
    ],
    methodOrRiskArea: ["female_context", "RED-S", "readiness", "weight_cut"],
    populationContext: ["female athlete context", "medical interpretation requires review"],
    supports: [
      "Verified source identities support a cautious review-context candidate.",
      "Existing Matrix metadata blocks RED-S automation and medical interpretation.",
    ],
    limitations: [
      "No medical diagnosis is extracted.",
      "No automatic RED-S decision is allowed.",
      "Full text or abstract review remains required.",
    ],
    reviewRequired: [
      "medical_review",
      "coach_review",
      "data_quality_review",
      "sport_science_review",
      "product_safety_review",
    ],
    runtimeUseNow: "future_claim_extraction_candidate",
  }),
  claimCandidate({
    id: "candidate_pain_review_context",
    status: "needs_full_text_before_extraction",
    candidateType: "injury_pain_context",
    title: "Pain review context candidate",
    candidateText:
      "Pain context should remain a coach and medical review question before any future block-eligibility effect is considered.",
    sourceLookupIntakeIds: ["return_to_sport_pain_review_intake"],
    methodOrRiskArea: ["pain", "injury_pain"],
    populationContext: ["return-to-sport context", "wrestling transfer requires review"],
    supports: [
      "Verified consensus source identity supports routing pain context to review.",
      "Current blockers keep pain out of automatic load decisions.",
    ],
    limitations: [
      "No pain cutoff or severity threshold approved.",
      "No clearance or diagnosis is extracted.",
      "Full text or abstract review remains required.",
    ],
    reviewRequired: ["medical_review", "coach_review", "product_safety_review"],
    runtimeUseNow: "review_export_only",
  }),
  claimCandidate({
    id: "candidate_injury_return_review_context",
    status: "needs_full_text_before_extraction",
    candidateType: "injury_pain_context",
    title: "Injury return-to-training review context candidate",
    candidateText:
      "Injury status should remain a medical and coach review context before any future return-to-training claim extraction.",
    sourceLookupIntakeIds: ["return_to_sport_injury_review_intake"],
    methodOrRiskArea: ["injury"],
    populationContext: ["return-to-sport context", "wrestling transfer requires review"],
    supports: [
      "Verified consensus source identity supports review packet context only.",
      "Existing data dependency metadata keeps injury status out of automatic block selection.",
    ],
    limitations: [
      "No medical clearance is extracted.",
      "No automatic injury-return decision is allowed.",
      "Full text or abstract review remains required.",
    ],
    reviewRequired: ["medical_review", "coach_review", "product_safety_review"],
    runtimeUseNow: "review_export_only",
  }),
  claimCandidate({
    id: "candidate_youth_progression_review_context",
    status: "needs_full_text_before_extraction",
    candidateType: "population_context",
    title: "Youth progression and weight-cut review context candidate",
    candidateText:
      "Youth high-load progression and youth weight-making context require conservative coach, medical and sport-science review before final extraction.",
    sourceLookupIntakeIds: ["nsca_long_term_athletic_development_intake"],
    methodOrRiskArea: ["youth_context", "weight_cut", "injury_pain"],
    populationContext: ["youth athlete context", "adult template transfer is blocked"],
    supports: [
      "Verified position-stand identity supports a cautious youth-context candidate.",
      "Existing Matrix metadata blocks adult-default scaling and youth weight-cut automation.",
    ],
    limitations: [
      "No automatic youth high-load progression is allowed.",
      "No youth weight-cut rule is extracted.",
      "Full text or abstract review remains required.",
    ],
    reviewRequired: ["medical_review", "coach_review", "sport_science_review"],
    runtimeUseNow: "future_claim_extraction_candidate",
  }),
  claimCandidate({
    id: "candidate_bfr_kaatsu_safety_review_context",
    status: "needs_full_text_before_extraction",
    candidateType: "safety_context",
    title: "BFR and KAATSU safety review context candidate",
    candidateText:
      "BFR and KAATSU-related methods require safety screening and cannot become automatic constructor assignments.",
    sourceLookupIntakeIds: ["bfr_position_stand_intake"],
    methodOrRiskArea: ["bfr_kaatsu", "lmv"],
    populationContext: ["methodology context", "wrestling transfer requires review"],
    supports: [
      "Verified source identity supports safety-review routing.",
      "Existing Matrix metadata keeps BFR and KAATSU outside runtime logic.",
    ],
    limitations: [
      "No contraindication decision is extracted.",
      "No automatic BFR or KAATSU prescription is allowed.",
      "Full text or abstract review remains required.",
    ],
    reviewRequired: [
      "medical_review",
      "coach_review",
      "sport_science_review",
      "product_safety_review",
    ],
    runtimeUseNow: "review_export_only",
  }),
  claimCandidate({
    id: "candidate_lmv_local_fatigue_review_context",
    status: "needs_full_text_before_extraction",
    candidateType: "methodology_context",
    title: "LMV local fatigue review context candidate",
    candidateText:
      "LMV and local-fatigue metadata should remain coach and sport-science review context, especially near start-proximity decisions.",
    sourceLookupIntakeIds: [
      "bfr_lmv_methodology_intake",
      "tapering_systematic_review_intake",
    ],
    methodOrRiskArea: ["lmv", "taper", "bfr_kaatsu"],
    populationContext: ["methodology transfer", "wrestling transfer requires review"],
    supports: [
      "Verified source identities support methodology review context.",
      "Existing local-fatigue data dependency remains review-only.",
    ],
    limitations: [
      "No universal LMV rule is extracted.",
      "No numeric threshold approved.",
      "Full text or abstract review remains required.",
    ],
    reviewRequired: [
      "coach_review",
      "sport_science_review",
      "medical_review",
      "product_safety_review",
    ],
    runtimeUseNow: "future_claim_extraction_candidate",
  }),
  claimCandidate({
    id: "candidate_taper_hidden_load_review_context",
    status: "needs_full_text_before_extraction",
    candidateType: "performance_context",
    title: "Taper hidden-load review context candidate",
    candidateText:
      "Taper and hidden-load context should remain a coach and sport-science review topic before any future close-start claim extraction.",
    sourceLookupIntakeIds: [
      "tapering_systematic_review_intake",
      "recovery_performance_consensus_intake",
    ],
    methodOrRiskArea: ["taper", "lmv", "readiness", "sleep"],
    populationContext: ["general sport transfer", "wrestling close-start transfer requires review"],
    supports: [
      "Verified source identities support cautious review context for taper transfer.",
      "Existing Matrix metadata keeps close-start taper thresholds as candidates only.",
    ],
    limitations: [
      "No close-start hard window is extracted.",
      "No numeric threshold approved.",
      "Full text or abstract review remains required.",
    ],
    reviewRequired: ["coach_review", "sport_science_review", "data_quality_review"],
    runtimeUseNow: "future_claim_extraction_candidate",
  }),
  claimCandidate({
    id: "candidate_travel_fatigue_review_blocker_context",
    status: "needs_human_review_before_extraction",
    candidateType: "review_blocker_context",
    title: "Travel fatigue review blocker context candidate",
    candidateText:
      "Travel fatigue should remain a review blocker until source-specific context and data-quality limits are reviewed.",
    sourceLookupIntakeIds: ["recovery_performance_consensus_intake"],
    sourceCandidateIds: ["travel_fatigue_context_source_need"],
    evidenceDependencyIds: [
      "acsm_hydration_nutrition",
      "europe_pre_competition_plan",
      "recovery_monitoring_consensus",
    ],
    dataDependencyIds: ["travel_fatigue_for_load_ceiling"],
    thresholdCandidateIds: ["travel_fatigue_load_ceiling_candidate"],
    reviewDecisionIds: [
      "data_travel_fatigue_for_load_ceiling",
      "evidence_acsm_hydration_nutrition",
      "evidence_europe_pre_competition_plan",
      "evidence_recovery_monitoring_consensus",
      "threshold_travel_fatigue_load_ceiling_candidate",
    ],
    methodOrRiskArea: ["travel_fatigue", "readiness"],
    populationContext: ["travel context", "wrestling transfer requires review"],
    supports: [
      "Existing source candidate metadata identifies travel fatigue as unresolved.",
      "Desk review supports keeping travel fatigue in review export only.",
    ],
    limitations: [
      "No load ceiling is extracted.",
      "No numeric threshold approved.",
      "Human review remains required before final extraction.",
    ],
    reviewRequired: [
      "coach_review",
      "data_quality_review",
      "sport_science_review",
      "product_safety_review",
    ],
    runtimeUseNow: "review_export_only",
  }),
  claimCandidate({
    id: "candidate_contact_load_review_blocker_context",
    status: "needs_human_review_before_extraction",
    candidateType: "review_blocker_context",
    title: "Wrestling contact-load review blocker context candidate",
    candidateText:
      "Wrestling contact-load classification remains a coach and sport-science review blocker before any future claim extraction.",
    sourceLookupIntakeIds: ["recovery_performance_consensus_intake"],
    sourceCandidateIds: ["wrestling_contact_load_source_need"],
    evidenceDependencyIds: [
      "europe_pre_competition_plan",
      "grappling_grip_dehydration_transfer",
      "perform_evidence_matrix",
      "wrestling_temporal_structure",
    ],
    dataDependencyIds: ["contact_load_exposure_for_wrestling_sessions"],
    thresholdCandidateIds: [
      "contact_load_exposure_candidate",
      "control_bouts_recovery_window_candidate",
    ],
    reviewDecisionIds: [
      "data_contact_load_exposure_for_wrestling_sessions",
      "evidence_europe_pre_competition_plan",
      "evidence_grappling_grip_dehydration_transfer",
      "evidence_perform_evidence_matrix",
      "evidence_wrestling_temporal_structure",
      "threshold_contact_load_exposure_candidate",
      "threshold_control_bouts_recovery_window_candidate",
    ],
    methodOrRiskArea: ["contact_load"],
    populationContext: ["wrestling contact context", "coach-school transfer requires review"],
    supports: [
      "Existing source candidate metadata marks contact-load classification as unresolved.",
      "Desk review supports blocker routing, not final extraction.",
    ],
    limitations: [
      "No contact exposure rule is extracted.",
      "No numeric threshold approved.",
      "Human review remains required before final extraction.",
    ],
    reviewRequired: ["coach_review", "sport_science_review", "product_safety_review"],
    runtimeUseNow: "review_export_only",
  }),
] satisfies readonly ConstructorMatrixEvidenceClaimCandidate[];

export type ConstructorMatrixEvidenceClaimCandidateId =
  (typeof CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES)[number]["id"];

export const CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATE_IDS =
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES.map((item) => item.id);

const CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATE_ID_SET = new Set<string>(
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATE_IDS,
);

const CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATE_LOOKUP = new Map<
  string,
  ConstructorMatrixEvidenceClaimCandidate
>(
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES.map((item) => [item.id, item]),
);

export function listConstructorMatrixEvidenceClaimCandidateIds():
  ConstructorMatrixEvidenceClaimCandidateId[] {
  return [...CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATE_IDS];
}

export function getConstructorMatrixEvidenceClaimCandidate(
  id: string,
): ConstructorMatrixEvidenceClaimCandidate | null {
  return CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATE_LOOKUP.get(id) ?? null;
}

export function validateConstructorMatrixEvidenceClaimCandidateIds(
  ids: readonly string[],
): { ok: boolean; missing: string[] } {
  const missing = ids.filter(
    (id) => !CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATE_ID_SET.has(id),
  );

  return {
    ok: missing.length === 0,
    missing,
  };
}

export function buildConstructorMatrixEvidenceClaimCandidateSummary():
  ConstructorMatrixEvidenceClaimCandidateSummary {
  const highRiskAreasCovered = unique(
    CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES.flatMap(
      (item) => item.methodOrRiskArea,
    ),
  ).filter((area) => (REQUIRED_HIGH_RISK_AREAS as readonly string[]).includes(area));

  return {
    evidenceClaimCandidateCount:
      CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES.length,
    evidenceClaimCandidateIds: listConstructorMatrixEvidenceClaimCandidateIds(),
    evidenceClaimCandidatesByStatus: countBy(
      CLAIM_CANDIDATE_STATUSES,
      CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES.map((item) => item.status),
    ),
    evidenceClaimCandidatesByRuntimeUse: countBy(
      CLAIM_CANDIDATE_RUNTIME_USES,
      CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES.map((item) => item.runtimeUseNow),
    ),
    evidenceClaimCandidatesHumanReviewedCount:
      CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES.filter(
        (item) => item.humanReviewed,
      ).length,
    evidenceClaimCandidatesRuntimeChangeAllowedNowCount:
      CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES.filter(
        (item) => item.runtimeChangeAllowedNow,
      ).length,
    candidateOnlyCount: CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES.filter(
      (item) => item.candidateOnly,
    ).length,
    highRiskAreasCovered,
    highRiskAreasStillBlocked: REQUIRED_HIGH_RISK_AREAS.filter(
      (area) => !highRiskAreasCovered.includes(area),
    ),
  };
}
