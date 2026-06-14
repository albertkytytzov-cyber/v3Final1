import type {
  ConstructorMatrixExerciseEvidenceFamilyAllowedUseNow,
  ConstructorMatrixExerciseEvidenceFamilyId,
  ConstructorMatrixExerciseEvidenceFamilyRuntimeUseAllowedNow,
} from "./constructor-matrix-exercise-evidence-map";
import type { ConstructorMatrixFamilySourceReviewId } from "./constructor-matrix-family-source-review";
import type { ConstructorMatrixFamilyEvidenceStrength } from "./constructor-matrix-p0-family-evidence-dossiers";

export type ConstructorMatrixP1FamilyEvidenceDossier = {
  familyId: ConstructorMatrixExerciseEvidenceFamilyId;
  priority: "P1";
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

const TRAINING_FORBIDDEN = [
  "runtime hard gate",
  "production default promotion",
  "locked load prescription",
  "medical threshold",
] as const;

export const CONSTRUCTOR_MATRIX_P1_FAMILY_EVIDENCE_DOSSIERS = [
  {
    familyId: "seluyanov_statodynamic_lme",
    priority: "P1",
    evidenceSummary:
      "The current source review supports only cautious coach-editable LMV/statodynamic candidates; direct Seluyanov wrestling-specific source support is still incomplete.",
    sourceReviewIds: ["source_review_seluyanov_lme_bfr_safety"],
    evidenceStrength: "weak",
    allowedUseRecommendation: "coach_editable_training_candidate",
    runtimeUseRecommendation: "coach_editable_plan_content",
    highRiskAutomationBlocked: false,
    medicalReviewRequired: true,
    coachReviewRequired: true,
    sportScienceReviewRequired: true,
    dataQualityReviewRequired: false,
    rationale:
      "LMV content can remain coach-editable only when separated from BFR/KAATSU and close-start automatic progression.",
    limitations: [
      "Direct method source acquisition is still needed",
      "BFR/KAATSU stays blocked",
      "Human review has not been recorded",
    ],
    forbiddenRuntimeUses: [
      ...TRAINING_FORBIDDEN,
      "BFR/KAATSU prescription",
      "automatic close-start progression",
    ],
    nextReviewActions: [
      "Acquire direct methodology sources",
      "Run coach and sport-science review on exercise family boundaries",
      "Keep load prescription coach-editable",
    ],
    humanReviewed: false,
    runtimePromotionAllowedNow: false,
  },
  {
    familyId: "speed_endurance_wrestling_density",
    priority: "P1",
    evidenceSummary:
      "Wrestling attributes and competition-model sources support conservative repeated-exchange training candidates, while contact-load ceilings remain coach-selected.",
    sourceReviewIds: ["source_review_speed_endurance_wrestling_attributes"],
    evidenceStrength: "moderate",
    allowedUseRecommendation: "coach_editable_training_candidate",
    runtimeUseRecommendation: "coach_editable_plan_content",
    highRiskAutomationBlocked: false,
    medicalReviewRequired: false,
    coachReviewRequired: true,
    sportScienceReviewRequired: true,
    dataQualityReviewRequired: false,
    rationale:
      "The family is appropriate for controlled pilot content when density and contact exposure remain editable and review-aware.",
    limitations: [
      "Full source-text extraction is still needed",
      "No automatic contact-load ceiling is approved",
      "Human review has not been recorded",
    ],
    forbiddenRuntimeUses: [...TRAINING_FORBIDDEN, "automatic contact-load ceiling"],
    nextReviewActions: [
      "Acquire full wrestling-demand source text",
      "Define coach review questions for density progression",
      "Collect pilot quality notes for contact-load fit",
    ],
    humanReviewed: false,
    runtimePromotionAllowedNow: false,
  },
  {
    familyId: "max_strength",
    priority: "P1",
    evidenceSummary:
      "Resistance-training position-stand metadata supports coach-editable max-strength content when athlete max or training max context is available.",
    sourceReviewIds: ["source_review_max_strength_resistance_progression"],
    evidenceStrength: "moderate",
    allowedUseRecommendation: "coach_editable_training_candidate",
    runtimeUseRecommendation: "coach_editable_plan_content",
    highRiskAutomationBlocked: false,
    medicalReviewRequired: false,
    coachReviewRequired: true,
    sportScienceReviewRequired: true,
    dataQualityReviewRequired: true,
    rationale:
      "Strength prescription can be shown as editable candidate content, while missing max data must fall back to RPE or technical quality notes.",
    limitations: [
      "No locked load prescription",
      "No unreviewed maximal test requirement",
      "Human review has not been recorded",
    ],
    forbiddenRuntimeUses: [
      ...TRAINING_FORBIDDEN,
      "unreviewed one-rep max test",
      "automatic injury-return clearance",
    ],
    nextReviewActions: [
      "Acquire source text for load progression review",
      "Validate max/e1RM data-quality requirements",
      "Keep all loads coach-editable",
    ],
    humanReviewed: false,
    runtimePromotionAllowedNow: false,
  },
  {
    familyId: "strength_endurance",
    priority: "P1",
    evidenceSummary:
      "Resistance-training source metadata supports strength-endurance content as editable training candidates, not as failure-chasing hard protocols.",
    sourceReviewIds: ["source_review_strength_endurance_resistance_progression"],
    evidenceStrength: "moderate",
    allowedUseRecommendation: "coach_editable_training_candidate",
    runtimeUseRecommendation: "coach_editable_plan_content",
    highRiskAutomationBlocked: false,
    medicalReviewRequired: false,
    coachReviewRequired: true,
    sportScienceReviewRequired: true,
    dataQualityReviewRequired: false,
    rationale:
      "The family can be used for controlled pilot plan content when density and fatigue exposure remain editable.",
    limitations: [
      "Full source review is still needed for detailed progression models",
      "No failure-based hard rule is approved",
      "Human review has not been recorded",
    ],
    forbiddenRuntimeUses: [...TRAINING_FORBIDDEN, "failure-chasing protocol"],
    nextReviewActions: [
      "Acquire full text for progression review",
      "Add coach review prompts for fatigue quality",
      "Monitor pilot plans for excessive density",
    ],
    humanReviewed: false,
    runtimePromotionAllowedNow: false,
  },
  {
    familyId: "competition_model_and_controlled_bouts",
    priority: "P1",
    evidenceSummary:
      "Official wrestling rules and demand-context sources support controlled-bout framing, but bout density and start-window decisions remain coach-selected.",
    sourceReviewIds: ["source_review_competition_model_uww"],
    evidenceStrength: "moderate",
    allowedUseRecommendation: "coach_editable_training_candidate",
    runtimeUseRecommendation: "coach_editable_plan_content",
    highRiskAutomationBlocked: false,
    medicalReviewRequired: false,
    coachReviewRequired: true,
    sportScienceReviewRequired: true,
    dataQualityReviewRequired: false,
    rationale:
      "Competition model can shape practice content in controlled pilot without becoming an unsafe competition-day automation layer.",
    limitations: [
      "Official rules do not validate athlete-specific load decisions",
      "Competition-day remains fallback/review-aware",
      "Human review has not been recorded",
    ],
    forbiddenRuntimeUses: [...TRAINING_FORBIDDEN, "unsafe competition-day decision"],
    nextReviewActions: [
      "Acquire wrestling demand sources",
      "Review controlled-bout density with coaches",
      "Keep competition-day fallback behavior unchanged",
    ],
    humanReviewed: false,
    runtimePromotionAllowedNow: false,
  },
  {
    familyId: "taper_activation",
    priority: "P1",
    evidenceSummary:
      "Taper meta-analysis metadata supports conservative taper activation as coach-editable content, with sport-transfer limits explicitly retained.",
    sourceReviewIds: ["source_review_taper_meta_analysis"],
    evidenceStrength: "moderate",
    allowedUseRecommendation: "coach_editable_training_candidate",
    runtimeUseRecommendation: "coach_editable_plan_content",
    highRiskAutomationBlocked: false,
    medicalReviewRequired: false,
    coachReviewRequired: true,
    sportScienceReviewRequired: true,
    dataQualityReviewRequired: false,
    rationale:
      "Taper activation can guide controlled pilot structure but cannot become an exact cutoff or hard proximity rule.",
    limitations: [
      "Source transfer to wrestling requires review",
      "No exact taper cutoff is approved",
      "Human review has not been recorded",
    ],
    forbiddenRuntimeUses: [...TRAINING_FORBIDDEN, "exact taper cutoff"],
    nextReviewActions: [
      "Acquire full taper source text",
      "Review wrestling-specific transfer",
      "Keep D-3 and competition-day fallbacks unchanged",
    ],
    humanReviewed: false,
    runtimePromotionAllowedNow: false,
  },
  {
    familyId: "aerobic_base_low_impact",
    priority: "P1",
    evidenceSummary:
      "Recovery consensus source metadata supports low-impact conditioning and recovery-oriented aerobic content, while wearable/readiness interpretation remains data-quality aware.",
    sourceReviewIds: ["source_review_aerobic_base_recovery_consensus"],
    evidenceStrength: "moderate",
    allowedUseRecommendation: "controlled_pilot_training_candidate",
    runtimeUseRecommendation: "coach_editable_plan_content",
    highRiskAutomationBlocked: false,
    medicalReviewRequired: false,
    coachReviewRequired: true,
    sportScienceReviewRequired: true,
    dataQualityReviewRequired: true,
    rationale:
      "This family is suitable for controlled pilot content as long as wearables are not treated as absolute truth.",
    limitations: [
      "No wearable hard gate is approved",
      "Recovery status remains coach-editable and data-quality aware",
      "Human review has not been recorded",
    ],
    forbiddenRuntimeUses: [...TRAINING_FORBIDDEN, "wearable absolute-truth gate"],
    nextReviewActions: [
      "Acquire full recovery source text",
      "Review wearable confidence language",
      "Track pilot quality notes for fallback decisions",
    ],
    humanReviewed: false,
    runtimePromotionAllowedNow: false,
  },
] as const satisfies readonly ConstructorMatrixP1FamilyEvidenceDossier[];

export type ConstructorMatrixP1FamilyEvidenceDossierId =
  (typeof CONSTRUCTOR_MATRIX_P1_FAMILY_EVIDENCE_DOSSIERS)[number]["familyId"];

export const CONSTRUCTOR_MATRIX_P1_FAMILY_EVIDENCE_DOSSIER_IDS =
  CONSTRUCTOR_MATRIX_P1_FAMILY_EVIDENCE_DOSSIERS.map((item) => item.familyId);

export function getConstructorMatrixP1FamilyEvidenceDossier(
  familyId: string,
): ConstructorMatrixP1FamilyEvidenceDossier | null {
  return CONSTRUCTOR_MATRIX_P1_FAMILY_EVIDENCE_DOSSIERS.find(
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

export function buildConstructorMatrixP1FamilyEvidenceDossierSummary() {
  return {
    p1DossierCount: CONSTRUCTOR_MATRIX_P1_FAMILY_EVIDENCE_DOSSIERS.length,
    p1FamilyIds: CONSTRUCTOR_MATRIX_P1_FAMILY_EVIDENCE_DOSSIER_IDS,
    byEvidenceStrength: countBy(
      CONSTRUCTOR_MATRIX_P1_FAMILY_EVIDENCE_DOSSIERS.map((item) => item.evidenceStrength),
    ),
    byAllowedUseRecommendation: countBy(
      CONSTRUCTOR_MATRIX_P1_FAMILY_EVIDENCE_DOSSIERS.map(
        (item) => item.allowedUseRecommendation,
      ),
    ),
    coachEditableFamilyCount: CONSTRUCTOR_MATRIX_P1_FAMILY_EVIDENCE_DOSSIERS.filter(
      (item) => item.runtimeUseRecommendation === "coach_editable_plan_content",
    ).length,
    runtimePromotionAllowedNow: false,
    humanReviewed: false,
  };
}
