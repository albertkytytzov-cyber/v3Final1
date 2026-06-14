import {
  CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP,
  type ConstructorMatrixExerciseEvidenceFamilyAllowedUseNow,
  type ConstructorMatrixExerciseEvidenceFamilyId,
  type ConstructorMatrixExerciseEvidenceFamilyRuntimeUseAllowedNow,
} from "./constructor-matrix-exercise-evidence-map";
import { getConstructorMatrixP0FamilyEvidenceDossier } from "./constructor-matrix-p0-family-evidence-dossiers";
import { getConstructorMatrixP1FamilyEvidenceDossier } from "./constructor-matrix-p1-family-evidence-dossiers";

export type ConstructorMatrixFamilyAllowedUseDecision = {
  familyId: ConstructorMatrixExerciseEvidenceFamilyId;
  mapAllowedUseNow: ConstructorMatrixExerciseEvidenceFamilyAllowedUseNow;
  mapRuntimeUseAllowedNow: ConstructorMatrixExerciseEvidenceFamilyRuntimeUseAllowedNow;
  dossierAllowedUseRecommendation: ConstructorMatrixExerciseEvidenceFamilyAllowedUseNow | null;
  dossierRuntimeUseRecommendation: ConstructorMatrixExerciseEvidenceFamilyRuntimeUseAllowedNow | null;
  effectiveAllowedUseNow: ConstructorMatrixExerciseEvidenceFamilyAllowedUseNow;
  effectiveRuntimeUseAllowedNow: ConstructorMatrixExerciseEvidenceFamilyRuntimeUseAllowedNow;
  highRiskAutomationBlocked: boolean;
  humanReviewed: false;
  runtimePromotionAllowedNow: false;
};

const ALLOWED_USE_RANK: Record<ConstructorMatrixExerciseEvidenceFamilyAllowedUseNow, number> = {
  blocked: 0,
  docs_only: 1,
  review_export_only: 2,
  warning_candidate_only: 3,
  coach_editable_training_candidate: 4,
  controlled_pilot_training_candidate: 5,
};

const RUNTIME_USE_RANK: Record<ConstructorMatrixExerciseEvidenceFamilyRuntimeUseAllowedNow, number> = {
  none: 0,
  docs_only: 1,
  review_export_only: 2,
  soft_warning_only: 3,
  fallback_guard_only: 4,
  coach_editable_plan_content: 5,
};

function minAllowedUse(
  current: ConstructorMatrixExerciseEvidenceFamilyAllowedUseNow,
  recommendation: ConstructorMatrixExerciseEvidenceFamilyAllowedUseNow | null,
) {
  if (!recommendation) return current;

  return ALLOWED_USE_RANK[recommendation] < ALLOWED_USE_RANK[current]
    ? recommendation
    : current;
}

function minRuntimeUse(
  current: ConstructorMatrixExerciseEvidenceFamilyRuntimeUseAllowedNow,
  recommendation: ConstructorMatrixExerciseEvidenceFamilyRuntimeUseAllowedNow | null,
) {
  if (!recommendation) return current;

  return RUNTIME_USE_RANK[recommendation] < RUNTIME_USE_RANK[current]
    ? recommendation
    : current;
}

export const CONSTRUCTOR_MATRIX_FAMILY_ALLOWED_USE_DECISIONS =
  CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP.map((family) => {
    const dossier =
      getConstructorMatrixP0FamilyEvidenceDossier(family.id) ??
      getConstructorMatrixP1FamilyEvidenceDossier(family.id);
    const effectiveAllowedUseNow = family.highRiskAutomationBlocked
      ? minAllowedUse(family.allowedUseNow, dossier?.allowedUseRecommendation ?? "blocked")
      : minAllowedUse(family.allowedUseNow, dossier?.allowedUseRecommendation ?? null);
    const effectiveRuntimeUseAllowedNow = family.highRiskAutomationBlocked
      ? minRuntimeUse(family.runtimeUseAllowedNow, dossier?.runtimeUseRecommendation ?? "none")
      : minRuntimeUse(family.runtimeUseAllowedNow, dossier?.runtimeUseRecommendation ?? null);

    return {
      familyId: family.id,
      mapAllowedUseNow: family.allowedUseNow,
      mapRuntimeUseAllowedNow: family.runtimeUseAllowedNow,
      dossierAllowedUseRecommendation: dossier?.allowedUseRecommendation ?? null,
      dossierRuntimeUseRecommendation: dossier?.runtimeUseRecommendation ?? null,
      effectiveAllowedUseNow,
      effectiveRuntimeUseAllowedNow,
      highRiskAutomationBlocked: family.highRiskAutomationBlocked,
      humanReviewed: false,
      runtimePromotionAllowedNow: false,
    };
  }) as readonly ConstructorMatrixFamilyAllowedUseDecision[];

export function getConstructorMatrixFamilyAllowedUseDecision(
  familyId: string,
): ConstructorMatrixFamilyAllowedUseDecision | null {
  return CONSTRUCTOR_MATRIX_FAMILY_ALLOWED_USE_DECISIONS.find(
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

export function buildConstructorMatrixFamilyAllowedUseSummary() {
  return {
    familyAllowedUseDecisionCount: CONSTRUCTOR_MATRIX_FAMILY_ALLOWED_USE_DECISIONS.length,
    highRiskBlockedCount: CONSTRUCTOR_MATRIX_FAMILY_ALLOWED_USE_DECISIONS.filter(
      (item) => item.highRiskAutomationBlocked,
    ).length,
    byEffectiveAllowedUseNow: countBy(
      CONSTRUCTOR_MATRIX_FAMILY_ALLOWED_USE_DECISIONS.map(
        (item) => item.effectiveAllowedUseNow,
      ),
    ),
    byEffectiveRuntimeUseAllowedNow: countBy(
      CONSTRUCTOR_MATRIX_FAMILY_ALLOWED_USE_DECISIONS.map(
        (item) => item.effectiveRuntimeUseAllowedNow,
      ),
    ),
    runtimePromotionAllowedNow: false,
    humanReviewed: false,
  };
}
