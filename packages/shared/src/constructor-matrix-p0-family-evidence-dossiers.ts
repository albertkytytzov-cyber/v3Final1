import type {
  ConstructorMatrixExerciseEvidenceFamilyAllowedUseNow,
  ConstructorMatrixExerciseEvidenceFamilyId,
  ConstructorMatrixExerciseEvidenceFamilyRuntimeUseAllowedNow,
} from "./constructor-matrix-exercise-evidence-map";
import type { ConstructorMatrixFamilySourceReviewId } from "./constructor-matrix-family-source-review";

export type ConstructorMatrixFamilyEvidenceStrength =
  | "insufficient"
  | "weak"
  | "moderate"
  | "strong_for_training_context_only"
  | "blocked_high_risk";

export type ConstructorMatrixP0FamilyEvidenceDossier = {
  familyId: ConstructorMatrixExerciseEvidenceFamilyId;
  priority: "P0";
  evidenceSummary: string;
  sourceReviewIds: readonly ConstructorMatrixFamilySourceReviewId[];
  evidenceStrength: ConstructorMatrixFamilyEvidenceStrength;
  allowedUseRecommendation: ConstructorMatrixExerciseEvidenceFamilyAllowedUseNow;
  runtimeUseRecommendation: ConstructorMatrixExerciseEvidenceFamilyRuntimeUseAllowedNow;
  highRiskAutomationBlocked: boolean;
  medicalReviewRequired: boolean;
  coachReviewRequired: boolean;
  sportScienceReviewRequired: boolean;
  dataQualityReviewRequired: boolean;
  rationale: string;
  limitations: readonly string[];
  forbiddenRuntimeUses: readonly string[];
  nextReviewActions: readonly string[];
  humanReviewed: false;
  runtimePromotionAllowedNow: false;
};

const HIGH_RISK_FORBIDDEN = [
  "runtime hard gate",
  "production default promotion",
  "medical diagnosis",
  "weight-cut automation",
  "hydration automation",
  "RED-S decision",
  "injury-return clearance",
] as const;

const TRAINING_FORBIDDEN = [
  "runtime hard gate",
  "production default promotion",
  "locked load prescription",
  "medical threshold",
] as const;

export const CONSTRUCTOR_MATRIX_P0_FAMILY_EVIDENCE_DOSSIERS = [
  {
    familyId: "body_composition_training",
    priority: "P0",
    evidenceSummary:
      "Public body-composition and resistance-training sources support conservative, long-horizon training context and muscle-preserving strength work, but not automatic mass-loss decisions.",
    sourceReviewIds: [
      "source_review_body_composition_ioc",
      "source_review_body_composition_resistance_progression",
    ],
    evidenceStrength: "moderate",
    allowedUseRecommendation: "coach_editable_training_candidate",
    runtimeUseRecommendation: "coach_editable_plan_content",
    highRiskAutomationBlocked: false,
    medicalReviewRequired: false,
    coachReviewRequired: true,
    sportScienceReviewRequired: true,
    dataQualityReviewRequired: false,
    rationale:
      "The family can support coach-editable training content when separated from weight-loss prescription and medical interpretation.",
    limitations: [
      "No exact body-mass target or calorie target is approved",
      "Any athlete-specific body-composition interpretation remains review-required",
      "Human review has not been recorded",
    ],
    forbiddenRuntimeUses: [
      ...TRAINING_FORBIDDEN,
      "rapid weight cut",
      "exact body-mass target prescription",
      "exact calorie prescription",
    ],
    nextReviewActions: [
      "Acquire family-level body-composition source text",
      "Run coach and sport-science review before broader runtime promotion",
      "Keep weight-management prompts separated from training content",
    ],
    humanReviewed: false,
    runtimePromotionAllowedNow: false,
  },
  {
    familyId: "muscle_preservation_training",
    priority: "P0",
    evidenceSummary:
      "Resistance-training position-stand metadata supports coach-editable strength content for maintaining muscle qualities, while athlete-specific body-composition goals remain outside automation.",
    sourceReviewIds: ["source_review_muscle_preservation_resistance_progression"],
    evidenceStrength: "moderate",
    allowedUseRecommendation: "coach_editable_training_candidate",
    runtimeUseRecommendation: "coach_editable_plan_content",
    highRiskAutomationBlocked: false,
    medicalReviewRequired: false,
    coachReviewRequired: true,
    sportScienceReviewRequired: true,
    dataQualityReviewRequired: false,
    rationale:
      "Strength work may appear in controlled pilot drafts as editable plan content when load is not locked and high-risk weight decisions are not inferred.",
    limitations: [
      "Strength loads remain coach-editable candidates",
      "No body-composition outcome is guaranteed",
      "Human review has not been recorded",
    ],
    forbiddenRuntimeUses: [...TRAINING_FORBIDDEN, "automatic body-composition target"],
    nextReviewActions: [
      "Acquire full resistance-training source text",
      "Define coach review questions for load selection and regressions",
      "Collect pilot quality notes before any wider rollout",
    ],
    humanReviewed: false,
    runtimePromotionAllowedNow: false,
  },
  {
    familyId: "nutrition_body_composition_guidance",
    priority: "P0",
    evidenceSummary:
      "Sports nutrition and RED-S-related sources support education and review prompts, but individualized nutrition decisions remain qualified-review territory.",
    sourceReviewIds: [
      "source_review_nutrition_body_composition_acsm",
      "source_review_nutrition_body_composition_ioc_reds",
    ],
    evidenceStrength: "moderate",
    allowedUseRecommendation: "review_export_only",
    runtimeUseRecommendation: "review_export_only",
    highRiskAutomationBlocked: true,
    medicalReviewRequired: true,
    coachReviewRequired: true,
    sportScienceReviewRequired: true,
    dataQualityReviewRequired: false,
    rationale:
      "The family can explain what must be reviewed, but cannot prescribe individualized diet or diagnose risk states.",
    limitations: [
      "Educational prompts only",
      "No exact calorie, macro, hydration or mass-loss prescription",
      "Human review has not been recorded",
    ],
    forbiddenRuntimeUses: [
      ...HIGH_RISK_FORBIDDEN,
      "exact calorie prescription",
      "medical nutrition therapy",
    ],
    nextReviewActions: [
      "Acquire full nutrition position-stand text",
      "Route RED-S-sensitive language to medical review",
      "Keep guidance outside save/assign hard rules",
    ],
    humanReviewed: false,
    runtimePromotionAllowedNow: false,
  },
  {
    familyId: "weight_management_review_prompt",
    priority: "P0",
    evidenceSummary:
      "Official wrestling policy and body-composition safety sources support review-required prompts only; they do not support automatic weight-management decisions.",
    sourceReviewIds: [
      "source_review_weight_management_ncaa",
      "source_review_weight_management_ioc_body_composition",
    ],
    evidenceStrength: "blocked_high_risk",
    allowedUseRecommendation: "review_export_only",
    runtimeUseRecommendation: "review_export_only",
    highRiskAutomationBlocked: true,
    medicalReviewRequired: true,
    coachReviewRequired: true,
    sportScienceReviewRequired: true,
    dataQualityReviewRequired: false,
    rationale:
      "Weight-management context is retained as review intake and safety prompt, not as an automated prescription layer.",
    limitations: [
      "Policy text still needs manual verification for exact wording",
      "No weight-loss prescription is produced",
      "Human review has not been recorded",
    ],
    forbiddenRuntimeUses: [
      ...HIGH_RISK_FORBIDDEN,
      "rapid weight cut",
      "exact body-mass target prescription",
    ],
    nextReviewActions: [
      "Acquire source text and verify policy passages",
      "Run qualified medical and coach review",
      "Keep runtime behavior review-required",
    ],
    humanReviewed: false,
    runtimePromotionAllowedNow: false,
  },
  {
    familyId: "weigh_in_review_required_guidance",
    priority: "P0",
    evidenceSummary:
      "The official policy source can identify that weigh-in context requires review, but Matrix must not automate weigh-in manipulation or clearance.",
    sourceReviewIds: ["source_review_weigh_in_ncaa"],
    evidenceStrength: "blocked_high_risk",
    allowedUseRecommendation: "blocked",
    runtimeUseRecommendation: "none",
    highRiskAutomationBlocked: true,
    medicalReviewRequired: true,
    coachReviewRequired: true,
    sportScienceReviewRequired: true,
    dataQualityReviewRequired: false,
    rationale:
      "Weigh-in day remains a blocked/review-required context for high-risk decisions in controlled pilot.",
    limitations: [
      "Manual policy verification still required",
      "No dehydration or manipulation method is permitted",
      "Human review has not been recorded",
    ],
    forbiddenRuntimeUses: [
      ...HIGH_RISK_FORBIDDEN,
      "dehydration protocol",
      "weigh-in manipulation protocol",
    ],
    nextReviewActions: [
      "Verify policy text manually",
      "Define non-prescriptive coach review checklist",
      "Keep save/assign blocked for Matrix high-risk weigh-in contexts",
    ],
    humanReviewed: false,
    runtimePromotionAllowedNow: false,
  },
  {
    familyId: "high_risk_blocked_weight_cut_hydration",
    priority: "P0",
    evidenceSummary:
      "Hydration and rapid weight-loss sources reinforce that this family must stay blocked for automation without qualified review.",
    sourceReviewIds: [
      "source_review_hydration_acsm_fluid",
      "source_review_hydration_rapid_weight_loss",
    ],
    evidenceStrength: "blocked_high_risk",
    allowedUseRecommendation: "blocked",
    runtimeUseRecommendation: "none",
    highRiskAutomationBlocked: true,
    medicalReviewRequired: true,
    coachReviewRequired: true,
    sportScienceReviewRequired: true,
    dataQualityReviewRequired: false,
    rationale:
      "AI can flag review need, but cannot diagnose hydration state or prescribe weight-cut actions.",
    limitations: [
      "No hydration diagnosis is made",
      "No rapid weight-loss method is described or recommended",
      "Human review has not been recorded",
    ],
    forbiddenRuntimeUses: [
      ...HIGH_RISK_FORBIDDEN,
      "dehydration protocol",
      "sauna or heat-exposure prescription",
    ],
    nextReviewActions: [
      "Acquire full source text",
      "Route to medical and coach review",
      "Keep Matrix fallback/review-required behavior unchanged",
    ],
    humanReviewed: false,
    runtimePromotionAllowedNow: false,
  },
  {
    familyId: "bfr_kaatsu_blocked_screening_context",
    priority: "P0",
    evidenceSummary:
      "The BFR position-stand source is relevant for safety context, but BFR/KAATSU remains blocked and non-prescriptive.",
    sourceReviewIds: ["source_review_bfr_position_stand"],
    evidenceStrength: "blocked_high_risk",
    allowedUseRecommendation: "blocked",
    runtimeUseRecommendation: "none",
    highRiskAutomationBlocked: true,
    medicalReviewRequired: true,
    coachReviewRequired: true,
    sportScienceReviewRequired: true,
    dataQualityReviewRequired: false,
    rationale:
      "BFR/KAATSU requires screening and qualified oversight; Matrix must not prescribe or automate it.",
    limitations: [
      "No screening decision is automated",
      "No BFR/KAATSU exercise prescription is produced",
      "Human review has not been recorded",
    ],
    forbiddenRuntimeUses: [
      ...HIGH_RISK_FORBIDDEN,
      "BFR/KAATSU prescription",
      "medical screening automation",
    ],
    nextReviewActions: [
      "Keep BFR/KAATSU separated from ordinary LMV content",
      "Require medical review before any coach-facing implementation",
      "Keep runtime use blocked",
    ],
    humanReviewed: false,
    runtimePromotionAllowedNow: false,
  },
] as const satisfies readonly ConstructorMatrixP0FamilyEvidenceDossier[];

export type ConstructorMatrixP0FamilyEvidenceDossierId =
  (typeof CONSTRUCTOR_MATRIX_P0_FAMILY_EVIDENCE_DOSSIERS)[number]["familyId"];

export const CONSTRUCTOR_MATRIX_P0_FAMILY_EVIDENCE_DOSSIER_IDS =
  CONSTRUCTOR_MATRIX_P0_FAMILY_EVIDENCE_DOSSIERS.map((item) => item.familyId);

export function getConstructorMatrixP0FamilyEvidenceDossier(
  familyId: string,
): ConstructorMatrixP0FamilyEvidenceDossier | null {
  return CONSTRUCTOR_MATRIX_P0_FAMILY_EVIDENCE_DOSSIERS.find(
    (item) => item.familyId === familyId,
  ) ?? null;
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

export function buildConstructorMatrixP0FamilyEvidenceDossierSummary() {
  return {
    p0DossierCount: CONSTRUCTOR_MATRIX_P0_FAMILY_EVIDENCE_DOSSIERS.length,
    p0FamilyIds: CONSTRUCTOR_MATRIX_P0_FAMILY_EVIDENCE_DOSSIER_IDS,
    byEvidenceStrength: countBy(
      CONSTRUCTOR_MATRIX_P0_FAMILY_EVIDENCE_DOSSIERS.map((item) => item.evidenceStrength),
    ),
    byAllowedUseRecommendation: countBy(
      CONSTRUCTOR_MATRIX_P0_FAMILY_EVIDENCE_DOSSIERS.map(
        (item) => item.allowedUseRecommendation,
      ),
    ),
    blockedHighRiskCount: CONSTRUCTOR_MATRIX_P0_FAMILY_EVIDENCE_DOSSIERS.filter(
      (item) => item.highRiskAutomationBlocked,
    ).length,
    runtimePromotionAllowedNow: false,
    humanReviewed: false,
  };
}
