import {
  CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP,
  type ConstructorMatrixExerciseEvidenceFamilyId,
  type ConstructorMatrixExerciseEvidenceSourceTypeNeeded,
} from "./constructor-matrix-exercise-evidence-map";

export type ConstructorMatrixExerciseSourceRequirementPriority =
  | "P0"
  | "P1"
  | "P2"
  | "P3";

export type ConstructorMatrixExerciseSourceRequirement = {
  familyId: ConstructorMatrixExerciseEvidenceFamilyId;
  priority: ConstructorMatrixExerciseSourceRequirementPriority;
  requiredSourceTypes: readonly ConstructorMatrixExerciseEvidenceSourceTypeNeeded[];
  sourceQuestions: readonly string[];
  minimumAcceptanceCriteria: readonly string[];
  blockersBeforeRuntimePromotion: readonly string[];
  manualReviewNeeded: boolean;
  humanReviewRequiredBeforeApproval: boolean;
  runtimePromotionAllowedNow: false;
};

const P0_FAMILIES = [
  "high_risk_blocked_weight_cut_hydration",
  "weigh_in_review_required_guidance",
  "nutrition_body_composition_guidance",
  "weight_management_review_prompt",
  "body_composition_training",
  "muscle_preservation_training",
] as const satisfies readonly ConstructorMatrixExerciseEvidenceFamilyId[];

const P1_FAMILIES = [
  "seluyanov_statodynamic_lme",
  "speed_endurance_wrestling_density",
  "max_strength",
  "strength_endurance",
  "competition_model_and_controlled_bouts",
  "taper_activation",
  "aerobic_base_low_impact",
] as const satisfies readonly ConstructorMatrixExerciseEvidenceFamilyId[];

const HUMAN_REVIEW_REQUIRED_FAMILIES = [
  ...P0_FAMILIES,
  "bfr_kaatsu_blocked_screening_context",
  "post_competition_recovery",
  "travel_mobility_reset",
] as const satisfies readonly ConstructorMatrixExerciseEvidenceFamilyId[];

const COMMON_MINIMUM_ACCEPTANCE_CRITERIA = [
  "source identity and source type are verified",
  "source scope, population and transfer limits are recorded",
  "no numeric threshold is approved by this source requirement",
  "family remains metadata-only until a later review stage",
] as const;

const COMMON_RUNTIME_BLOCKERS = [
  "no runtime promotion from source requirement metadata",
  "no production default promotion",
  "no hard gate or numeric threshold",
  "no fake human, coach or medical approval",
] as const;

const HIGH_RISK_RUNTIME_BLOCKERS = [
  ...COMMON_RUNTIME_BLOCKERS,
  "no rapid weight-cut automation",
  "no hydration diagnosis automation",
  "no medical decision automation",
] as const;

function priorityForFamily(
  familyId: ConstructorMatrixExerciseEvidenceFamilyId,
): ConstructorMatrixExerciseSourceRequirementPriority {
  if ((P0_FAMILIES as readonly string[]).includes(familyId)) return "P0";
  if ((P1_FAMILIES as readonly string[]).includes(familyId)) return "P1";
  if (familyId === "bfr_kaatsu_blocked_screening_context") return "P0";
  return "P2";
}

function humanReviewRequiredForFamily(
  familyId: ConstructorMatrixExerciseEvidenceFamilyId,
) {
  return (HUMAN_REVIEW_REQUIRED_FAMILIES as readonly string[]).includes(familyId);
}

function sourceQuestionsForFamily(familyId: ConstructorMatrixExerciseEvidenceFamilyId) {
  const family = CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP.find(
    (item) => item.id === familyId,
  );

  return family?.evidenceReviewQuestions ?? [
    "Which source types are required before this family can move beyond metadata?",
  ];
}

function blockersForFamily(familyId: ConstructorMatrixExerciseEvidenceFamilyId) {
  if (
    familyId === "high_risk_blocked_weight_cut_hydration" ||
    familyId === "weigh_in_review_required_guidance" ||
    familyId === "weight_management_review_prompt" ||
    familyId === "nutrition_body_composition_guidance" ||
    familyId === "body_composition_training" ||
    familyId === "muscle_preservation_training" ||
    familyId === "bfr_kaatsu_blocked_screening_context"
  ) {
    return HIGH_RISK_RUNTIME_BLOCKERS;
  }

  return COMMON_RUNTIME_BLOCKERS;
}

export const CONSTRUCTOR_MATRIX_EXERCISE_SOURCE_REQUIREMENTS =
  CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP.map((family) => ({
    familyId: family.id,
    priority: priorityForFamily(family.id),
    requiredSourceTypes: family.requiredSourceTypes,
    sourceQuestions: sourceQuestionsForFamily(family.id),
    minimumAcceptanceCriteria: [
      ...COMMON_MINIMUM_ACCEPTANCE_CRITERIA,
      ...family.acceptanceCriteriaForFutureApproval,
    ],
    blockersBeforeRuntimePromotion: blockersForFamily(family.id),
    manualReviewNeeded: true,
    humanReviewRequiredBeforeApproval: humanReviewRequiredForFamily(family.id),
    runtimePromotionAllowedNow: false,
  })) as readonly ConstructorMatrixExerciseSourceRequirement[];

export type ConstructorMatrixExerciseSourceRequirementFamilyId =
  (typeof CONSTRUCTOR_MATRIX_EXERCISE_SOURCE_REQUIREMENTS)[number]["familyId"];

export function getConstructorMatrixExerciseSourceRequirement(
  familyId: string,
): ConstructorMatrixExerciseSourceRequirement | null {
  return (
    CONSTRUCTOR_MATRIX_EXERCISE_SOURCE_REQUIREMENTS.find(
      (item) => item.familyId === familyId,
    ) ?? null
  );
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

export function buildConstructorMatrixExerciseSourceRequirementSummary() {
  return {
    sourceRequirementCount: CONSTRUCTOR_MATRIX_EXERCISE_SOURCE_REQUIREMENTS.length,
    byPriority: countBy(
      CONSTRUCTOR_MATRIX_EXERCISE_SOURCE_REQUIREMENTS.map((item) => item.priority),
    ),
    p0FamilyIds: CONSTRUCTOR_MATRIX_EXERCISE_SOURCE_REQUIREMENTS
      .filter((item) => item.priority === "P0")
      .map((item) => item.familyId),
    p1FamilyIds: CONSTRUCTOR_MATRIX_EXERCISE_SOURCE_REQUIREMENTS
      .filter((item) => item.priority === "P1")
      .map((item) => item.familyId),
    manualReviewNeededCount: CONSTRUCTOR_MATRIX_EXERCISE_SOURCE_REQUIREMENTS
      .filter((item) => item.manualReviewNeeded).length,
    humanReviewRequiredBeforeApprovalCount:
      CONSTRUCTOR_MATRIX_EXERCISE_SOURCE_REQUIREMENTS
        .filter((item) => item.humanReviewRequiredBeforeApproval).length,
    runtimePromotionAllowedNow: false,
  };
}
