import {
  CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP,
  type ConstructorMatrixExerciseEvidenceFamilyAllowedUseNow,
  type ConstructorMatrixExerciseEvidenceFamilyId,
  type ConstructorMatrixExerciseEvidenceSourceTypeNeeded,
} from "./constructor-matrix-exercise-evidence-map";

export type ConstructorMatrixFamilySourceVerificationStatus =
  | "verified_public_source"
  | "verified_peer_reviewed_source"
  | "verified_official_source"
  | "partial_match"
  | "full_text_needed"
  | "manual_verification_needed"
  | "rejected";

export type ConstructorMatrixFamilySourceExtractionReadiness =
  | "ready_for_limited_claim_summary"
  | "needs_full_text_or_abstract"
  | "needs_manual_verification"
  | "not_ready";

export type ConstructorMatrixFamilySourceReview = {
  id: string;
  familyId: ConstructorMatrixExerciseEvidenceFamilyId;
  sourceTitle: string;
  sourceType: ConstructorMatrixExerciseEvidenceSourceTypeNeeded;
  sourceUrl: string | null;
  doi: string | null;
  pmid: string | null;
  authorsOrOrganization: readonly string[];
  year: string | null;
  verificationStatus: ConstructorMatrixFamilySourceVerificationStatus;
  reviewedBy: "AI desk review";
  aiDeskReviewed: true;
  humanReviewed: false;
  sourceTextAvailable: boolean;
  extractionReadiness: ConstructorMatrixFamilySourceExtractionReadiness;
  limitations: readonly string[];
  allowedUseNow: ConstructorMatrixExerciseEvidenceFamilyAllowedUseNow;
  runtimePromotionAllowedNow: false;
  forbiddenUses: readonly string[];
};

const NO_RUNTIME_PROMOTION = [
  "runtime hard gate",
  "production default promotion",
  "numeric medical or weight-control gate",
] as const;

const TRAINING_LIMITATIONS = [
  "AI desk review only; no human coach approval recorded",
  "General training use remains coach-editable",
  "Family-level source match still needs future human review before runtime promotion",
] as const;

const HIGH_RISK_LIMITATIONS = [
  "AI desk review only; no medical approval recorded",
  "Source identity supports review context only",
  "High-risk decision remains blocked or review-required",
] as const;

type SourceSeed = Omit<
  ConstructorMatrixFamilySourceReview,
  "reviewedBy" | "aiDeskReviewed" | "humanReviewed" | "runtimePromotionAllowedNow"
>;

function sourceReview(seed: SourceSeed): ConstructorMatrixFamilySourceReview {
  return {
    ...seed,
    reviewedBy: "AI desk review",
    aiDeskReviewed: true,
    humanReviewed: false,
    runtimePromotionAllowedNow: false,
  };
}

const ACSM_RESISTANCE_PROGRESSION = {
  sourceTitle:
    "American College of Sports Medicine position stand. Progression models in resistance training for healthy adults",
  sourceType: "position_stand" as const,
  sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/19204579/",
  doi: null,
  pmid: "19204579",
  authorsOrOrganization: ["American College of Sports Medicine"],
  year: "2009",
};

const WRESTLING_ATTRIBUTES = {
  sourceTitle: "Physical and physiological attributes of wrestlers: an update",
  sourceType: "wrestling_specific_study" as const,
  sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/28030533/",
  doi: null,
  pmid: "28030533",
  authorsOrOrganization: [],
  year: null,
};

const ACSM_NUTRITION = {
  sourceTitle: "Nutrition and Athletic Performance",
  sourceType: "nutrition_position_stand" as const,
  sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/26891166/",
  doi: "10.1249/MSS.0000000000000852",
  pmid: "26891166",
  authorsOrOrganization: [
    "Academy of Nutrition and Dietetics",
    "Dietitians of Canada",
    "American College of Sports Medicine",
  ],
  year: "2016",
};

const IOC_BODY_COMPOSITION = {
  sourceTitle:
    "Best practice recommendations for body composition considerations in sport to reduce health and performance risks",
  sourceType: "body_composition_source" as const,
  sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/37752006/",
  doi: "10.1136/bjsports-2023-106812",
  pmid: "37752006",
  authorsOrOrganization: ["IOC REDs consensus subgroup"],
  year: "2023",
};

const IOC_REDS = {
  sourceTitle: "IOC consensus statement on Relative Energy Deficiency in Sport",
  sourceType: "consensus_statement" as const,
  sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/37752011/",
  doi: "10.1136/bjsports-2023-106994",
  pmid: "37752011",
  authorsOrOrganization: ["International Olympic Committee"],
  year: "2023",
};

const NCAA_WEIGHT_MANAGEMENT = {
  sourceTitle: "NCAA Men's Wrestling Weight Management Program Packet",
  sourceType: "weight_management_policy" as const,
  sourceUrl:
    "https://ncaaorg.s3.amazonaws.com/championships/sports/wrestling/rules/mens/2025-256RMWR_WeightManagementProgramPacket.pdf",
  doi: null,
  pmid: null,
  authorsOrOrganization: ["NCAA"],
  year: "2025",
};

const ACSM_FLUID_REPLACEMENT = {
  sourceTitle: "Exercise and Fluid Replacement",
  sourceType: "position_stand" as const,
  sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/17277604/",
  doi: "10.1249/mss.0b013e31802ca597",
  pmid: "17277604",
  authorsOrOrganization: ["American College of Sports Medicine"],
  year: "2007",
};

const RAPID_WEIGHT_LOSS = {
  sourceTitle: "Rapid Weight Loss of Combat Sport Athletes and Strategies to Reduce Its Negative Effects",
  sourceType: "meta_analysis" as const,
  sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/35492609/",
  doi: "10.3389/fphys.2022.830229",
  pmid: "35492609",
  authorsOrOrganization: [],
  year: "2022",
};

const BFR_POSITION_STAND = {
  sourceTitle: "Blood Flow Restriction Exercise Position Stand",
  sourceType: "position_stand" as const,
  sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/31156448/",
  doi: "10.3389/fphys.2019.00533",
  pmid: "31156448",
  authorsOrOrganization: ["Frontiers in Physiology position stand authors"],
  year: "2019",
};

const TAPER_META_ANALYSIS = {
  sourceTitle:
    "Effects of tapering on performance in endurance athletes: A systematic review and meta-analysis",
  sourceType: "meta_analysis" as const,
  sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/37163550/",
  doi: "10.1371/journal.pone.0282838",
  pmid: "37163550",
  authorsOrOrganization: [],
  year: "2023",
};

const RECOVERY_CONSENSUS = {
  sourceTitle: "Recovery and Performance in Sport: Consensus Statement",
  sourceType: "consensus_statement" as const,
  sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/29345524/",
  doi: "10.1123/ijspp.2017-0759",
  pmid: "29345524",
  authorsOrOrganization: ["International Journal of Sports Physiology and Performance"],
  year: "2018",
};

const NSCA_LTAD = {
  sourceTitle: "Long-Term Athletic Development Position Statement",
  sourceType: "position_stand" as const,
  sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/26933920/",
  doi: "10.1519/JSC.0000000000001387",
  pmid: "26933920",
  authorsOrOrganization: ["National Strength and Conditioning Association"],
  year: "2016",
};

const UWW_RULES = {
  sourceTitle: "International Wrestling Rules",
  sourceType: "official_regulation" as const,
  sourceUrl: "https://uww.org/governance/regulations-olympic-wrestling",
  doi: null,
  pmid: null,
  authorsOrOrganization: ["United World Wrestling"],
  year: "2026",
};

export const CONSTRUCTOR_MATRIX_FAMILY_SOURCE_REVIEWS = [
  sourceReview({
    id: "source_review_body_composition_ioc",
    familyId: "body_composition_training",
    ...IOC_BODY_COMPOSITION,
    verificationStatus: "verified_peer_reviewed_source",
    sourceTextAvailable: true,
    extractionReadiness: "ready_for_limited_claim_summary",
    limitations: [
      ...TRAINING_LIMITATIONS,
      "Supports health-aware body-composition context, not automated weight manipulation",
    ],
    allowedUseNow: "coach_editable_training_candidate",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "rapid weight cut", "exact body-mass target prescription"],
  }),
  sourceReview({
    id: "source_review_body_composition_resistance_progression",
    familyId: "body_composition_training",
    ...ACSM_RESISTANCE_PROGRESSION,
    verificationStatus: "verified_peer_reviewed_source",
    sourceTextAvailable: true,
    extractionReadiness: "ready_for_limited_claim_summary",
    limitations: TRAINING_LIMITATIONS,
    allowedUseNow: "coach_editable_training_candidate",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "locked strength load prescription"],
  }),
  sourceReview({
    id: "source_review_muscle_preservation_resistance_progression",
    familyId: "muscle_preservation_training",
    ...ACSM_RESISTANCE_PROGRESSION,
    verificationStatus: "verified_peer_reviewed_source",
    sourceTextAvailable: true,
    extractionReadiness: "ready_for_limited_claim_summary",
    limitations: TRAINING_LIMITATIONS,
    allowedUseNow: "coach_editable_training_candidate",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "locked strength load prescription"],
  }),
  sourceReview({
    id: "source_review_low_impact_body_composition_recovery",
    familyId: "low_impact_conditioning_for_body_composition",
    ...RECOVERY_CONSENSUS,
    verificationStatus: "verified_peer_reviewed_source",
    sourceTextAvailable: true,
    extractionReadiness: "ready_for_limited_claim_summary",
    limitations: [
      ...TRAINING_LIMITATIONS,
      "Supports recovery context only; body-composition transfer remains indirect",
    ],
    allowedUseNow: "controlled_pilot_training_candidate",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "wearable absolute-truth gate"],
  }),
  sourceReview({
    id: "source_review_nutrition_body_composition_acsm",
    familyId: "nutrition_body_composition_guidance",
    ...ACSM_NUTRITION,
    verificationStatus: "verified_peer_reviewed_source",
    sourceTextAvailable: true,
    extractionReadiness: "ready_for_limited_claim_summary",
    limitations: [
      ...HIGH_RISK_LIMITATIONS,
      "Supports education and review prompts only; no exact calorie prescription",
    ],
    allowedUseNow: "review_export_only",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "exact calorie prescription", "medical nutrition therapy"],
  }),
  sourceReview({
    id: "source_review_nutrition_body_composition_ioc_reds",
    familyId: "nutrition_body_composition_guidance",
    ...IOC_REDS,
    verificationStatus: "verified_peer_reviewed_source",
    sourceTextAvailable: true,
    extractionReadiness: "ready_for_limited_claim_summary",
    limitations: [
      ...HIGH_RISK_LIMITATIONS,
      "RED-S-sensitive interpretation requires qualified review",
    ],
    allowedUseNow: "review_export_only",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "RED-S diagnosis", "medical clearance"],
  }),
  sourceReview({
    id: "source_review_nutrition_training_day_acsm",
    familyId: "nutrition_training_day_guidance",
    ...ACSM_NUTRITION,
    verificationStatus: "verified_peer_reviewed_source",
    sourceTextAvailable: true,
    extractionReadiness: "ready_for_limited_claim_summary",
    limitations: [
      ...TRAINING_LIMITATIONS,
      "Coach-facing guidance remains general education, not individualized dietetics",
    ],
    allowedUseNow: "warning_candidate_only",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "exact calorie prescription"],
  }),
  sourceReview({
    id: "source_review_weight_management_ncaa",
    familyId: "weight_management_review_prompt",
    ...NCAA_WEIGHT_MANAGEMENT,
    verificationStatus: "verified_official_source",
    sourceTextAvailable: false,
    extractionReadiness: "needs_manual_verification",
    limitations: HIGH_RISK_LIMITATIONS,
    allowedUseNow: "review_export_only",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "automatic weight-cut decision"],
  }),
  sourceReview({
    id: "source_review_weight_management_ioc_body_composition",
    familyId: "weight_management_review_prompt",
    ...IOC_BODY_COMPOSITION,
    verificationStatus: "verified_peer_reviewed_source",
    sourceTextAvailable: true,
    extractionReadiness: "ready_for_limited_claim_summary",
    limitations: [
      ...HIGH_RISK_LIMITATIONS,
      "Supports cautious review prompts only, not mass-loss automation",
    ],
    allowedUseNow: "review_export_only",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "rapid weight cut", "exact body-mass target prescription"],
  }),
  sourceReview({
    id: "source_review_weigh_in_ncaa",
    familyId: "weigh_in_review_required_guidance",
    ...NCAA_WEIGHT_MANAGEMENT,
    verificationStatus: "verified_official_source",
    sourceTextAvailable: false,
    extractionReadiness: "needs_manual_verification",
    limitations: HIGH_RISK_LIMITATIONS,
    allowedUseNow: "blocked",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "weigh-in manipulation protocol"],
  }),
  sourceReview({
    id: "source_review_hydration_acsm_fluid",
    familyId: "high_risk_blocked_weight_cut_hydration",
    ...ACSM_FLUID_REPLACEMENT,
    verificationStatus: "verified_peer_reviewed_source",
    sourceTextAvailable: true,
    extractionReadiness: "needs_manual_verification",
    limitations: HIGH_RISK_LIMITATIONS,
    allowedUseNow: "blocked",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "automatic hydration diagnosis", "dehydration protocol"],
  }),
  sourceReview({
    id: "source_review_hydration_rapid_weight_loss",
    familyId: "high_risk_blocked_weight_cut_hydration",
    ...RAPID_WEIGHT_LOSS,
    verificationStatus: "verified_peer_reviewed_source",
    sourceTextAvailable: true,
    extractionReadiness: "needs_manual_verification",
    limitations: HIGH_RISK_LIMITATIONS,
    allowedUseNow: "blocked",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "rapid weight cut", "dehydration protocol"],
  }),
  sourceReview({
    id: "source_review_bfr_position_stand",
    familyId: "bfr_kaatsu_blocked_screening_context",
    ...BFR_POSITION_STAND,
    verificationStatus: "verified_peer_reviewed_source",
    sourceTextAvailable: true,
    extractionReadiness: "needs_manual_verification",
    limitations: HIGH_RISK_LIMITATIONS,
    allowedUseNow: "blocked",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "BFR/KAATSU prescription", "medical screening automation"],
  }),
  sourceReview({
    id: "source_review_seluyanov_lme_bfr_safety",
    familyId: "seluyanov_statodynamic_lme",
    ...BFR_POSITION_STAND,
    verificationStatus: "partial_match",
    sourceTextAvailable: true,
    extractionReadiness: "needs_manual_verification",
    limitations: [
      ...TRAINING_LIMITATIONS,
      "Direct Seluyanov/statodynamic wrestling source support is still incomplete",
      "BFR/KAATSU content remains separated and blocked",
    ],
    allowedUseNow: "coach_editable_training_candidate",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "BFR/KAATSU prescription", "failure-chasing protocol"],
  }),
  sourceReview({
    id: "source_review_speed_first_action_wrestling_attributes",
    familyId: "speed_first_action",
    ...WRESTLING_ATTRIBUTES,
    verificationStatus: "verified_peer_reviewed_source",
    sourceTextAvailable: true,
    extractionReadiness: "needs_full_text_or_abstract",
    limitations: TRAINING_LIMITATIONS,
    allowedUseNow: "controlled_pilot_training_candidate",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "fatigue-based speed test gate"],
  }),
  sourceReview({
    id: "source_review_acceleration_cod_resistance_progression",
    familyId: "acceleration_change_of_direction",
    ...ACSM_RESISTANCE_PROGRESSION,
    verificationStatus: "verified_peer_reviewed_source",
    sourceTextAvailable: true,
    extractionReadiness: "ready_for_limited_claim_summary",
    limitations: TRAINING_LIMITATIONS,
    allowedUseNow: "controlled_pilot_training_candidate",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "automatic sprint readiness clearance"],
  }),
  sourceReview({
    id: "source_review_speed_endurance_wrestling_attributes",
    familyId: "speed_endurance_wrestling_density",
    ...WRESTLING_ATTRIBUTES,
    verificationStatus: "verified_peer_reviewed_source",
    sourceTextAvailable: true,
    extractionReadiness: "needs_full_text_or_abstract",
    limitations: TRAINING_LIMITATIONS,
    allowedUseNow: "coach_editable_training_candidate",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "automatic contact-load ceiling"],
  }),
  sourceReview({
    id: "source_review_max_strength_resistance_progression",
    familyId: "max_strength",
    ...ACSM_RESISTANCE_PROGRESSION,
    verificationStatus: "verified_peer_reviewed_source",
    sourceTextAvailable: true,
    extractionReadiness: "ready_for_limited_claim_summary",
    limitations: TRAINING_LIMITATIONS,
    allowedUseNow: "coach_editable_training_candidate",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "locked strength load prescription"],
  }),
  sourceReview({
    id: "source_review_strength_endurance_resistance_progression",
    familyId: "strength_endurance",
    ...ACSM_RESISTANCE_PROGRESSION,
    verificationStatus: "verified_peer_reviewed_source",
    sourceTextAvailable: true,
    extractionReadiness: "ready_for_limited_claim_summary",
    limitations: TRAINING_LIMITATIONS,
    allowedUseNow: "coach_editable_training_candidate",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "failure-chasing protocol"],
  }),
  sourceReview({
    id: "source_review_posterior_chain_resistance_progression",
    familyId: "posterior_chain_strength",
    ...ACSM_RESISTANCE_PROGRESSION,
    verificationStatus: "verified_peer_reviewed_source",
    sourceTextAvailable: true,
    extractionReadiness: "ready_for_limited_claim_summary",
    limitations: TRAINING_LIMITATIONS,
    allowedUseNow: "coach_editable_training_candidate",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "injury-return clearance"],
  }),
  sourceReview({
    id: "source_review_trunk_anti_rotation_resistance_progression",
    familyId: "trunk_anti_rotation",
    ...ACSM_RESISTANCE_PROGRESSION,
    verificationStatus: "verified_peer_reviewed_source",
    sourceTextAvailable: true,
    extractionReadiness: "ready_for_limited_claim_summary",
    limitations: TRAINING_LIMITATIONS,
    allowedUseNow: "coach_editable_training_candidate",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "pain-based clearance"],
  }),
  sourceReview({
    id: "source_review_grip_hand_fighting_wrestling_attributes",
    familyId: "grip_hand_fighting_strength_endurance",
    ...WRESTLING_ATTRIBUTES,
    verificationStatus: "verified_peer_reviewed_source",
    sourceTextAvailable: true,
    extractionReadiness: "needs_full_text_or_abstract",
    limitations: TRAINING_LIMITATIONS,
    allowedUseNow: "coach_editable_training_candidate",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "automatic grip fatigue gate"],
  }),
  sourceReview({
    id: "source_review_aerobic_base_recovery_consensus",
    familyId: "aerobic_base_low_impact",
    ...RECOVERY_CONSENSUS,
    verificationStatus: "verified_peer_reviewed_source",
    sourceTextAvailable: true,
    extractionReadiness: "ready_for_limited_claim_summary",
    limitations: TRAINING_LIMITATIONS,
    allowedUseNow: "controlled_pilot_training_candidate",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "wearable absolute-truth gate"],
  }),
  sourceReview({
    id: "source_review_wrestling_technical_uww",
    familyId: "wrestling_technical_transfer",
    ...UWW_RULES,
    verificationStatus: "verified_official_source",
    sourceTextAvailable: true,
    extractionReadiness: "ready_for_limited_claim_summary",
    limitations: [
      ...TRAINING_LIMITATIONS,
      "Official rules support competition context, not automatic tactical approval",
    ],
    allowedUseNow: "controlled_pilot_training_candidate",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "automatic tactical approval"],
  }),
  sourceReview({
    id: "source_review_par_terre_uww",
    familyId: "par_terre_technical_transfer",
    ...UWW_RULES,
    verificationStatus: "verified_official_source",
    sourceTextAvailable: true,
    extractionReadiness: "ready_for_limited_claim_summary",
    limitations: [
      ...TRAINING_LIMITATIONS,
      "Official rules support context only; drill density stays coach-selected",
    ],
    allowedUseNow: "controlled_pilot_training_candidate",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "forced joint-range protocol"],
  }),
  sourceReview({
    id: "source_review_competition_model_uww",
    familyId: "competition_model_and_controlled_bouts",
    ...UWW_RULES,
    verificationStatus: "verified_official_source",
    sourceTextAvailable: true,
    extractionReadiness: "ready_for_limited_claim_summary",
    limitations: TRAINING_LIMITATIONS,
    allowedUseNow: "coach_editable_training_candidate",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "unsafe competition-day decision"],
  }),
  sourceReview({
    id: "source_review_taper_meta_analysis",
    familyId: "taper_activation",
    ...TAPER_META_ANALYSIS,
    verificationStatus: "verified_peer_reviewed_source",
    sourceTextAvailable: true,
    extractionReadiness: "ready_for_limited_claim_summary",
    limitations: [
      ...TRAINING_LIMITATIONS,
      "Source is not wrestling-specific; transfer remains coach and sport-science review aware",
    ],
    allowedUseNow: "coach_editable_training_candidate",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "exact taper cutoff"],
  }),
  sourceReview({
    id: "source_review_recovery_mobility_consensus",
    familyId: "recovery_mobility_downregulation",
    ...RECOVERY_CONSENSUS,
    verificationStatus: "verified_peer_reviewed_source",
    sourceTextAvailable: true,
    extractionReadiness: "ready_for_limited_claim_summary",
    limitations: TRAINING_LIMITATIONS,
    allowedUseNow: "controlled_pilot_training_candidate",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "medical recovery clearance"],
  }),
  sourceReview({
    id: "source_review_travel_mobility_recovery",
    familyId: "travel_mobility_reset",
    ...RECOVERY_CONSENSUS,
    verificationStatus: "partial_match",
    sourceTextAvailable: true,
    extractionReadiness: "needs_full_text_or_abstract",
    limitations: [
      ...TRAINING_LIMITATIONS,
      "Travel-specific wrestling evidence remains incomplete",
    ],
    allowedUseNow: "warning_candidate_only",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "automatic travel fatigue gate"],
  }),
  sourceReview({
    id: "source_review_post_competition_recovery",
    familyId: "post_competition_recovery",
    ...RECOVERY_CONSENSUS,
    verificationStatus: "verified_peer_reviewed_source",
    sourceTextAvailable: true,
    extractionReadiness: "ready_for_limited_claim_summary",
    limitations: TRAINING_LIMITATIONS,
    allowedUseNow: "controlled_pilot_training_candidate",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "injury-return clearance"],
  }),
  sourceReview({
    id: "source_review_youth_safety_nsca_litad",
    familyId: "speed_first_action",
    ...NSCA_LTAD,
    verificationStatus: "verified_peer_reviewed_source",
    sourceTextAvailable: true,
    extractionReadiness: "ready_for_limited_claim_summary",
    limitations: [
      ...HIGH_RISK_LIMITATIONS,
      "Youth context remains review-required and cannot become automatic progression logic",
    ],
    allowedUseNow: "warning_candidate_only",
    forbiddenUses: [...NO_RUNTIME_PROMOTION, "automatic youth high-load progression"],
  }),
] as const satisfies readonly ConstructorMatrixFamilySourceReview[];

export type ConstructorMatrixFamilySourceReviewId =
  (typeof CONSTRUCTOR_MATRIX_FAMILY_SOURCE_REVIEWS)[number]["id"];

export const CONSTRUCTOR_MATRIX_FAMILY_SOURCE_REVIEW_IDS =
  CONSTRUCTOR_MATRIX_FAMILY_SOURCE_REVIEWS.map((item) => item.id);

export function listConstructorMatrixFamilySourceReviewIds():
  ConstructorMatrixFamilySourceReviewId[] {
  return [
    ...CONSTRUCTOR_MATRIX_FAMILY_SOURCE_REVIEW_IDS,
  ] as ConstructorMatrixFamilySourceReviewId[];
}

export function getConstructorMatrixFamilySourceReview(
  id: string,
): ConstructorMatrixFamilySourceReview | null {
  return CONSTRUCTOR_MATRIX_FAMILY_SOURCE_REVIEWS.find((item) => item.id === id) ?? null;
}

export function getConstructorMatrixFamilySourceReviewsForFamily(
  familyId: string,
): ConstructorMatrixFamilySourceReview[] {
  return CONSTRUCTOR_MATRIX_FAMILY_SOURCE_REVIEWS.filter((item) => item.familyId === familyId);
}

export function validateConstructorMatrixFamilySourceReviewCoverage() {
  const coveredFamilyIds = new Set(
    CONSTRUCTOR_MATRIX_FAMILY_SOURCE_REVIEWS.map((item) => item.familyId),
  );
  const missingFamilyIds = CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP
    .map((item) => item.id)
    .filter((familyId) => !coveredFamilyIds.has(familyId));

  return {
    ok: missingFamilyIds.length === 0,
    familyCount: CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP.length,
    coveredFamilyCount: coveredFamilyIds.size,
    missingFamilyIds,
  };
}

function countBy<T extends string>(
  values: readonly T[],
): Readonly<Record<T, number>> {
  const counts = Object.create(null) as Record<T, number>;

  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }

  return counts;
}

export function buildConstructorMatrixFamilySourceReviewSummary() {
  const coverage = validateConstructorMatrixFamilySourceReviewCoverage();

  return {
    familySourceReviewCount: CONSTRUCTOR_MATRIX_FAMILY_SOURCE_REVIEWS.length,
    sourceReviewIds: CONSTRUCTOR_MATRIX_FAMILY_SOURCE_REVIEW_IDS,
    familyCoverage: coverage,
    verifiedSourceCount: CONSTRUCTOR_MATRIX_FAMILY_SOURCE_REVIEWS.filter((item) =>
      [
        "verified_public_source",
        "verified_peer_reviewed_source",
        "verified_official_source",
      ].includes(item.verificationStatus),
    ).length,
    fullTextNeededCount: CONSTRUCTOR_MATRIX_FAMILY_SOURCE_REVIEWS.filter((item) =>
      ["needs_full_text_or_abstract", "needs_manual_verification"].includes(
        item.extractionReadiness,
      ),
    ).length,
    manualVerificationNeededCount: CONSTRUCTOR_MATRIX_FAMILY_SOURCE_REVIEWS.filter(
      (item) =>
        item.verificationStatus === "manual_verification_needed" ||
        item.extractionReadiness === "needs_manual_verification",
    ).length,
    byFamilyId: countBy(CONSTRUCTOR_MATRIX_FAMILY_SOURCE_REVIEWS.map((item) => item.familyId)),
    byVerificationStatus: countBy(
      CONSTRUCTOR_MATRIX_FAMILY_SOURCE_REVIEWS.map((item) => item.verificationStatus),
    ),
    byAllowedUseNow: countBy(
      CONSTRUCTOR_MATRIX_FAMILY_SOURCE_REVIEWS.map((item) => item.allowedUseNow),
    ),
    runtimePromotionAllowedNow: false,
    humanReviewed: false,
  };
}
