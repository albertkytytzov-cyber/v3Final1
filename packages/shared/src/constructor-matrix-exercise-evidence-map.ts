import type { ConstructorGoalType } from "./constructor-core";
import type { ConstructorTrainingBlockType } from "./constructor-matrix";
import type { ConstructorMatrixEvidenceDependencyId } from "./constructor-matrix-evidence";
import {
  CONSTRUCTOR_MATRIX_EXERCISE_LIBRARY,
  type ConstructorMatrixExercise,
  type ConstructorMatrixExerciseId,
  type ConstructorMatrixExerciseMethodologyTag,
} from "./constructor-matrix-exercise-library";
import {
  CONSTRUCTOR_MATRIX_NUTRITION_GUIDANCE,
  type ConstructorMatrixNutritionGuidanceItem,
} from "./constructor-matrix-nutrition-guidance";
import type { ConstructorMatrixSourceCandidateId } from "./constructor-matrix-source-candidates";
import type { ConstructorMatrixSourceExpansionBacklogId } from "./constructor-matrix-source-expansion-backlog";
import type { ConstructorMatrixSourceLookupIntakeId } from "./constructor-matrix-source-lookup-intake";
import {
  CONSTRUCTOR_MATRIX_WEIGHT_MANAGEMENT_GUIDANCE,
  type ConstructorMatrixWeightManagementGuidanceItem,
} from "./constructor-matrix-weight-management-guidance";

export type ConstructorMatrixExerciseEvidenceFamilyAllowedUseNow =
  | "docs_only"
  | "review_export_only"
  | "coach_editable_training_candidate"
  | "controlled_pilot_training_candidate"
  | "warning_candidate_only"
  | "blocked";

export type ConstructorMatrixExerciseEvidenceFamilyRuntimeUseAllowedNow =
  | "none"
  | "docs_only"
  | "review_export_only"
  | "coach_editable_plan_content"
  | "soft_warning_only"
  | "fallback_guard_only";

export type ConstructorMatrixExerciseEvidenceReviewTrack =
  | "coach"
  | "medical"
  | "data_quality"
  | "sport_science"
  | "product_safety";

export type ConstructorMatrixExerciseEvidenceSourceTypeNeeded =
  | "systematic_review"
  | "meta_analysis"
  | "position_stand"
  | "consensus_statement"
  | "official_regulation"
  | "wrestling_specific_study"
  | "combat_sport_study"
  | "strength_conditioning_guideline"
  | "periodization_source"
  | "nutrition_position_stand"
  | "weight_management_policy"
  | "body_composition_source"
  | "safety_screening_source"
  | "coach_school_methodology_source"
  | "internal_validation_study";

export type ConstructorMatrixExerciseEvidenceFamily = {
  id: string;
  title: string;
  scope: string;
  linkedExerciseIds: readonly ConstructorMatrixExerciseId[];
  linkedNutritionGuidanceIds: readonly string[];
  linkedWeightManagementGuidanceIds: readonly string[];
  linkedMethodologyTags: readonly ConstructorMatrixExerciseMethodologyTag[];
  targetQualities: readonly ConstructorGoalType[];
  blockTypes: readonly ConstructorTrainingBlockType[];
  evidenceDependencyIds: readonly ConstructorMatrixEvidenceDependencyId[];
  sourceExpansionBacklogIds: readonly ConstructorMatrixSourceExpansionBacklogId[];
  sourceCandidateIds: readonly ConstructorMatrixSourceCandidateId[];
  sourceLookupIntakeIds: readonly ConstructorMatrixSourceLookupIntakeId[];
  requiredSourceTypes: readonly ConstructorMatrixExerciseEvidenceSourceTypeNeeded[];
  reviewTracks: readonly ConstructorMatrixExerciseEvidenceReviewTrack[];
  allowedUseNow: ConstructorMatrixExerciseEvidenceFamilyAllowedUseNow;
  runtimeUseAllowedNow: ConstructorMatrixExerciseEvidenceFamilyRuntimeUseAllowedNow;
  forbiddenUses: readonly string[];
  limitations: readonly string[];
  evidenceReviewQuestions: readonly string[];
  acceptanceCriteriaForFutureApproval: readonly string[];
  highRiskAutomationBlocked: boolean;
  humanReviewed: false;
};

type FamilySeed = Omit<
  ConstructorMatrixExerciseEvidenceFamily,
  | "linkedExerciseIds"
  | "linkedNutritionGuidanceIds"
  | "linkedWeightManagementGuidanceIds"
  | "targetQualities"
  | "blockTypes"
  | "evidenceDependencyIds"
  | "humanReviewed"
> & {
  exerciseFilter?: (exercise: ConstructorMatrixExercise) => boolean;
  nutritionFilter?: (item: ConstructorMatrixNutritionGuidanceItem) => boolean;
  weightFilter?: (item: ConstructorMatrixWeightManagementGuidanceItem) => boolean;
  evidenceDependencyIds?: readonly ConstructorMatrixEvidenceDependencyId[];
};

const COMMON_LIMITATIONS = [
  "metadata-only evidence family",
  "no final source approval yet",
  "no human review recorded",
  "no numeric runtime threshold approved",
] as const;

const COMMON_ACCEPTANCE_CRITERIA = [
  "exact source metadata is verified",
  "population and wrestling-transfer limits are explicit",
  "coach, sport-science, medical or data-quality review is recorded where required",
  "runtime use remains separately gated after evidence review",
] as const;

const COMMON_FORBIDDEN_RUNTIME_USES = [
  "runtime hard rule",
  "runtime medical gate",
  "production default promotion",
  "automatic threshold cutoff",
] as const;

const BODY_COMPOSITION_FORBIDDEN = [
  ...COMMON_FORBIDDEN_RUNTIME_USES,
  "rapid weight cut",
  "dehydration protocol",
  "exact kg loss prescription",
  "exact calorie prescription",
  "sauna or heat-exposure prescription",
  "sweat-suit, spitting, diuretic or laxative method",
] as const;

const WEIGHT_CUT_FORBIDDEN = [
  ...BODY_COMPOSITION_FORBIDDEN,
  "automatic hydration diagnosis",
  "automatic weight-cut decision",
  "weigh-in manipulation protocol",
] as const;

function unique<T extends string>(items: readonly T[]): T[] {
  return Array.from(new Set(items));
}

function exerciseIdsWhere(
  predicate: (exercise: ConstructorMatrixExercise) => boolean,
): ConstructorMatrixExerciseId[] {
  return CONSTRUCTOR_MATRIX_EXERCISE_LIBRARY
    .filter(predicate)
    .map((item) => item.id) as ConstructorMatrixExerciseId[];
}

function nutritionIdsWhere(
  predicate: (item: ConstructorMatrixNutritionGuidanceItem) => boolean,
): string[] {
  return CONSTRUCTOR_MATRIX_NUTRITION_GUIDANCE
    .filter(predicate)
    .map((item) => item.id);
}

function weightIdsWhere(
  predicate: (item: ConstructorMatrixWeightManagementGuidanceItem) => boolean,
): string[] {
  return CONSTRUCTOR_MATRIX_WEIGHT_MANAGEMENT_GUIDANCE
    .filter(predicate)
    .map((item) => item.id);
}

function exerciseById(id: string) {
  return CONSTRUCTOR_MATRIX_EXERCISE_LIBRARY.find((item) => item.id === id);
}

function buildFamily(seed: FamilySeed): ConstructorMatrixExerciseEvidenceFamily {
  const linkedExerciseIds = exerciseIdsWhere(seed.exerciseFilter ?? (() => false));
  const linkedNutritionGuidanceIds = nutritionIdsWhere(seed.nutritionFilter ?? (() => false));
  const linkedWeightManagementGuidanceIds = weightIdsWhere(seed.weightFilter ?? (() => false));
  const linkedExercises = linkedExerciseIds
    .map(exerciseById)
    .filter((item): item is ConstructorMatrixExercise => Boolean(item));

  return {
    ...seed,
    linkedExerciseIds,
    linkedNutritionGuidanceIds,
    linkedWeightManagementGuidanceIds,
    targetQualities: unique(linkedExercises.flatMap((item) => item.targetQualities)),
    blockTypes: unique(linkedExercises.flatMap((item) => item.blockTypes)),
    evidenceDependencyIds: unique([
      ...(seed.evidenceDependencyIds ?? []),
      ...linkedExercises.flatMap((item) => item.evidenceDependencyIds),
    ]),
    humanReviewed: false,
  };
}

const hasTag =
  (tag: ConstructorMatrixExerciseMethodologyTag) =>
  (exercise: ConstructorMatrixExercise) =>
    exercise.methodologyTags.includes(tag);

const categoryIn =
  (...categories: readonly ConstructorMatrixExercise["category"][]) =>
  (exercise: ConstructorMatrixExercise) =>
    categories.includes(exercise.category);

const blockIn =
  (...blockTypes: readonly ConstructorTrainingBlockType[]) =>
  (exercise: ConstructorMatrixExercise) =>
    exercise.blockTypes.some((blockType) => blockTypes.includes(blockType));

const targetIn =
  (...targetQualities: readonly ConstructorGoalType[]) =>
  (exercise: ConstructorMatrixExercise) =>
    exercise.targetQualities.some((quality) => targetQualities.includes(quality));

export const CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP = [
  buildFamily({
    id: "seluyanov_statodynamic_lme",
    title: "Seluyanov/statodynamic local muscular endurance",
    scope:
      "Coach-school statodynamic and local muscular endurance candidates for legs, grip, trunk and wrestling transfer.",
    exerciseFilter: hasTag("seluyanov_statodynamic_lme_candidate"),
    linkedMethodologyTags: [
      "coach_school_candidate",
      "seluyanov_statodynamic_lme_candidate",
      "wrestling_transfer_candidate",
    ],
    sourceExpansionBacklogIds: [
      "lmv_legs_recovery_and_start_proximity_sources",
      "bfr_kaatsu_safety_and_screening_sources",
    ],
    sourceCandidateIds: [
      "lmv_statodynamics_source_need",
      "bfr_kaatsu_safety_screening_source_need",
    ],
    sourceLookupIntakeIds: [
      "bfr_lmv_methodology_intake",
      "bfr_position_stand_intake",
    ],
    requiredSourceTypes: [
      "coach_school_methodology_source",
      "wrestling_specific_study",
      "safety_screening_source",
    ],
    reviewTracks: ["coach", "sport_science", "medical"],
    allowedUseNow: "coach_editable_training_candidate",
    runtimeUseAllowedNow: "coach_editable_plan_content",
    forbiddenUses: [
      ...COMMON_FORBIDDEN_RUNTIME_USES,
      "BFR/KAATSU prescription",
      "failure-chasing protocol",
      "automatic close-start progression",
    ],
    limitations: COMMON_LIMITATIONS,
    evidenceReviewQuestions: [
      "Which statodynamic exercise families have source support for wrestling transfer?",
      "What safety limits are required before local fatigue work is used near a main start?",
    ],
    acceptanceCriteriaForFutureApproval: COMMON_ACCEPTANCE_CRITERIA,
    highRiskAutomationBlocked: false,
  }),
  buildFamily({
    id: "speed_first_action",
    title: "Speed and first-action development",
    scope: "Fresh first-step, signal response and first-contact speed candidates.",
    exerciseFilter: (exercise) =>
      exercise.category === "speed_first_action" ||
      exercise.methodologyTags.includes("speed_development_candidate"),
    linkedMethodologyTags: ["speed_development_candidate", "performance_content_candidate"],
    sourceExpansionBacklogIds: ["wrestling_contact_load_classification_sources"],
    sourceCandidateIds: ["wrestling_contact_load_source_need"],
    sourceLookupIntakeIds: [],
    requiredSourceTypes: [
      "wrestling_specific_study",
      "combat_sport_study",
      "strength_conditioning_guideline",
    ],
    reviewTracks: ["coach", "sport_science"],
    allowedUseNow: "controlled_pilot_training_candidate",
    runtimeUseAllowedNow: "coach_editable_plan_content",
    forbiddenUses: [...COMMON_FORBIDDEN_RUNTIME_USES, "fatigue-based speed test gate"],
    limitations: COMMON_LIMITATIONS,
    evidenceReviewQuestions: [
      "Which speed drills transfer to first-action quality in wrestling?",
      "How should speed work be limited when mechanics decay?",
    ],
    acceptanceCriteriaForFutureApproval: COMMON_ACCEPTANCE_CRITERIA,
    highRiskAutomationBlocked: false,
  }),
  buildFamily({
    id: "acceleration_change_of_direction",
    title: "Acceleration and change-of-direction candidates",
    scope: "Acceleration, deceleration, lateral cut and medicine-ball power candidates.",
    exerciseFilter: categoryIn("acceleration_change_of_direction"),
    linkedMethodologyTags: ["speed_development_candidate", "strength_development_candidate"],
    sourceExpansionBacklogIds: ["internal_validation_outcome_measurement_sources"],
    sourceCandidateIds: [],
    sourceLookupIntakeIds: [],
    requiredSourceTypes: [
      "strength_conditioning_guideline",
      "combat_sport_study",
      "internal_validation_study",
    ],
    reviewTracks: ["coach", "sport_science"],
    allowedUseNow: "controlled_pilot_training_candidate",
    runtimeUseAllowedNow: "coach_editable_plan_content",
    forbiddenUses: [...COMMON_FORBIDDEN_RUNTIME_USES, "automatic sprint readiness clearance"],
    limitations: COMMON_LIMITATIONS,
    evidenceReviewQuestions: [
      "Which acceleration and change-of-direction families are safe for wrestling preparation?",
      "Which regressions are required when pain, surface or fatigue flags appear?",
    ],
    acceptanceCriteriaForFutureApproval: COMMON_ACCEPTANCE_CRITERIA,
    highRiskAutomationBlocked: false,
  }),
  buildFamily({
    id: "speed_endurance_wrestling_density",
    title: "Speed endurance and wrestling exchange density",
    scope: "Repeated wrestling exchanges, short-bout density and anaerobic contact-density candidates.",
    exerciseFilter: (exercise) =>
      exercise.methodologyTags.includes("speed_endurance_candidate") ||
      targetIn("anaerobic_power", "wrestling_contact_density")(exercise),
    linkedMethodologyTags: ["speed_endurance_candidate", "wrestling_transfer_candidate"],
    sourceExpansionBacklogIds: [
      "wrestling_contact_load_classification_sources",
      "competition_event_model_and_uww_rules_sources",
    ],
    sourceCandidateIds: [
      "wrestling_contact_load_source_need",
      "competition_model_source_need",
    ],
    sourceLookupIntakeIds: ["uww_international_wrestling_rules_intake"],
    requiredSourceTypes: [
      "wrestling_specific_study",
      "combat_sport_study",
      "periodization_source",
    ],
    reviewTracks: ["coach", "sport_science"],
    allowedUseNow: "coach_editable_training_candidate",
    runtimeUseAllowedNow: "coach_editable_plan_content",
    forbiddenUses: [...COMMON_FORBIDDEN_RUNTIME_USES, "automatic contact-load ceiling"],
    limitations: COMMON_LIMITATIONS,
    evidenceReviewQuestions: [
      "Which repeated-exchange formats match wrestling competition demands?",
      "When should density become review-required because contact load is unclear?",
    ],
    acceptanceCriteriaForFutureApproval: COMMON_ACCEPTANCE_CRITERIA,
    highRiskAutomationBlocked: false,
  }),
  buildFamily({
    id: "max_strength",
    title: "Max-strength candidates",
    scope: "Coach-editable strength candidates that require max/e1RM context before load calculation.",
    exerciseFilter: categoryIn("max_strength"),
    linkedMethodologyTags: ["strength_development_candidate", "muscle_preservation_candidate"],
    sourceExpansionBacklogIds: ["internal_validation_outcome_measurement_sources"],
    sourceCandidateIds: [],
    sourceLookupIntakeIds: [],
    requiredSourceTypes: [
      "strength_conditioning_guideline",
      "combat_sport_study",
      "internal_validation_study",
    ],
    reviewTracks: ["coach", "sport_science"],
    allowedUseNow: "coach_editable_training_candidate",
    runtimeUseAllowedNow: "coach_editable_plan_content",
    forbiddenUses: [
      ...COMMON_FORBIDDEN_RUNTIME_USES,
      "medical threshold",
      "unreviewed one-rep max test",
      "locked load prescription",
    ],
    limitations: COMMON_LIMITATIONS,
    evidenceReviewQuestions: [
      "Which max-strength lifts are appropriate for wrestling preparation phases?",
      "Which athlete max/e1RM data quality is required before load candidates are calculated?",
    ],
    acceptanceCriteriaForFutureApproval: COMMON_ACCEPTANCE_CRITERIA,
    highRiskAutomationBlocked: false,
  }),
  buildFamily({
    id: "strength_endurance",
    title: "Strength-endurance candidates",
    scope: "Repeatable strength-endurance, grip, carry and circuit candidates.",
    exerciseFilter: categoryIn("strength_endurance"),
    linkedMethodologyTags: [
      "strength_development_candidate",
      "exercise_complex_candidate",
      "muscle_preservation_candidate",
    ],
    sourceExpansionBacklogIds: ["internal_validation_outcome_measurement_sources"],
    sourceCandidateIds: [],
    sourceLookupIntakeIds: [],
    requiredSourceTypes: [
      "strength_conditioning_guideline",
      "combat_sport_study",
      "internal_validation_study",
    ],
    reviewTracks: ["coach", "sport_science"],
    allowedUseNow: "coach_editable_training_candidate",
    runtimeUseAllowedNow: "coach_editable_plan_content",
    forbiddenUses: [...COMMON_FORBIDDEN_RUNTIME_USES, "failure-chasing protocol"],
    limitations: COMMON_LIMITATIONS,
    evidenceReviewQuestions: [
      "Which strength-endurance formats preserve technical quality under fatigue?",
      "Which density progressions need review before future runtime promotion?",
    ],
    acceptanceCriteriaForFutureApproval: COMMON_ACCEPTANCE_CRITERIA,
    highRiskAutomationBlocked: false,
  }),
  buildFamily({
    id: "posterior_chain_strength",
    title: "Posterior-chain strength and maintenance",
    scope: "Posterior-chain strength, hinge, hip and hamstring candidates.",
    exerciseFilter: categoryIn("posterior_chain"),
    linkedMethodologyTags: ["strength_development_candidate", "muscle_preservation_candidate"],
    sourceExpansionBacklogIds: ["internal_validation_outcome_measurement_sources"],
    sourceCandidateIds: [],
    sourceLookupIntakeIds: [],
    requiredSourceTypes: ["strength_conditioning_guideline", "safety_screening_source"],
    reviewTracks: ["coach", "sport_science"],
    allowedUseNow: "coach_editable_training_candidate",
    runtimeUseAllowedNow: "coach_editable_plan_content",
    forbiddenUses: [...COMMON_FORBIDDEN_RUNTIME_USES, "injury-return clearance"],
    limitations: COMMON_LIMITATIONS,
    evidenceReviewQuestions: [
      "Which posterior-chain exercises are safest for wrestling phases and available equipment?",
      "Which pain or hamstring/back symptoms require regression or qualified review?",
    ],
    acceptanceCriteriaForFutureApproval: COMMON_ACCEPTANCE_CRITERIA,
    highRiskAutomationBlocked: false,
  }),
  buildFamily({
    id: "trunk_anti_rotation",
    title: "Trunk and anti-rotation candidates",
    scope: "Anti-rotation, trunk-control and trunk-transfer candidates.",
    exerciseFilter: categoryIn("trunk_anti_rotation"),
    linkedMethodologyTags: ["strength_development_candidate", "exercise_complex_candidate"],
    sourceExpansionBacklogIds: ["internal_validation_outcome_measurement_sources"],
    sourceCandidateIds: [],
    sourceLookupIntakeIds: [],
    requiredSourceTypes: ["strength_conditioning_guideline", "wrestling_specific_study"],
    reviewTracks: ["coach", "sport_science"],
    allowedUseNow: "coach_editable_training_candidate",
    runtimeUseAllowedNow: "coach_editable_plan_content",
    forbiddenUses: [...COMMON_FORBIDDEN_RUNTIME_USES, "pain-based clearance"],
    limitations: COMMON_LIMITATIONS,
    evidenceReviewQuestions: [
      "Which trunk-control families transfer to wrestling positions?",
      "Which regressions are needed when lumbar or hip symptoms appear?",
    ],
    acceptanceCriteriaForFutureApproval: COMMON_ACCEPTANCE_CRITERIA,
    highRiskAutomationBlocked: false,
  }),
  buildFamily({
    id: "grip_hand_fighting_strength_endurance",
    title: "Grip and hand-fighting strength endurance",
    scope: "Grip, wrist-control, hand-fighting and arm-endurance candidates.",
    exerciseFilter: (exercise) =>
      exercise.category === "grip_hand_fighting" ||
      exercise.targetQualities.includes("arms_grip"),
    linkedMethodologyTags: ["wrestling_transfer_candidate", "strength_development_candidate"],
    sourceExpansionBacklogIds: ["wrestling_contact_load_classification_sources"],
    sourceCandidateIds: ["wrestling_contact_load_source_need"],
    sourceLookupIntakeIds: [],
    requiredSourceTypes: ["wrestling_specific_study", "combat_sport_study"],
    reviewTracks: ["coach", "sport_science"],
    allowedUseNow: "coach_editable_training_candidate",
    runtimeUseAllowedNow: "coach_editable_plan_content",
    forbiddenUses: [...COMMON_FORBIDDEN_RUNTIME_USES, "automatic grip fatigue gate"],
    limitations: COMMON_LIMITATIONS,
    evidenceReviewQuestions: [
      "Which grip and hand-fighting drills best represent wrestling transfer?",
      "Which fatigue signs require reducing contact density?",
    ],
    acceptanceCriteriaForFutureApproval: COMMON_ACCEPTANCE_CRITERIA,
    highRiskAutomationBlocked: false,
  }),
  buildFamily({
    id: "aerobic_base_low_impact",
    title: "Aerobic base and low-impact conditioning",
    scope: "Easy aerobic, low-contact and low-impact conditioning candidates.",
    exerciseFilter: (exercise) =>
      exercise.category === "aerobic_recovery" ||
      exercise.methodologyTags.includes("endurance_development_candidate") ||
      exercise.methodologyTags.includes("low_impact_conditioning_candidate"),
    linkedMethodologyTags: [
      "endurance_development_candidate",
      "low_impact_conditioning_candidate",
    ],
    sourceExpansionBacklogIds: [
      "rhr_hrv_sleep_readiness_composite_sources",
      "travel_fatigue_load_ceiling_sources",
    ],
    sourceCandidateIds: [
      "readiness_multi_signal_monitoring_source_need",
      "travel_fatigue_context_source_need",
    ],
    sourceLookupIntakeIds: ["recovery_performance_consensus_intake"],
    requiredSourceTypes: [
      "consensus_statement",
      "strength_conditioning_guideline",
      "internal_validation_study",
    ],
    reviewTracks: ["coach", "sport_science", "data_quality"],
    allowedUseNow: "controlled_pilot_training_candidate",
    runtimeUseAllowedNow: "coach_editable_plan_content",
    forbiddenUses: [...COMMON_FORBIDDEN_RUNTIME_USES, "wearable absolute-truth gate"],
    limitations: COMMON_LIMITATIONS,
    evidenceReviewQuestions: [
      "Which low-impact conditioning options best support wrestling preparation and recovery?",
      "Which data-quality limits apply when wearables or readiness signals are incomplete?",
    ],
    acceptanceCriteriaForFutureApproval: COMMON_ACCEPTANCE_CRITERIA,
    highRiskAutomationBlocked: false,
  }),
  buildFamily({
    id: "wrestling_technical_transfer",
    title: "Wrestling technical transfer",
    scope: "Stance, entries, defense, grip, edge and tactical transfer candidates.",
    exerciseFilter: (exercise) =>
      categoryIn(
        "wrestling_stance_movement",
        "shots_entries",
        "defense_sprawl",
        "grip_hand_fighting",
        "edge_of_mat",
        "tactical_score_situation",
      )(exercise) || exercise.methodologyTags.includes("wrestling_transfer_candidate"),
    linkedMethodologyTags: ["wrestling_transfer_candidate"],
    sourceExpansionBacklogIds: [
      "wrestling_contact_load_classification_sources",
      "review_export_coach_explanation_source_trace_sources",
    ],
    sourceCandidateIds: ["wrestling_contact_load_source_need"],
    sourceLookupIntakeIds: [],
    requiredSourceTypes: [
      "wrestling_specific_study",
      "coach_school_methodology_source",
      "internal_validation_study",
    ],
    reviewTracks: ["coach", "sport_science"],
    allowedUseNow: "controlled_pilot_training_candidate",
    runtimeUseAllowedNow: "coach_editable_plan_content",
    forbiddenUses: [...COMMON_FORBIDDEN_RUNTIME_USES, "automatic tactical approval"],
    limitations: COMMON_LIMITATIONS,
    evidenceReviewQuestions: [
      "Which technical families should be grouped by phase and competition proximity?",
      "Which coach-review cues are required before technical density increases?",
    ],
    acceptanceCriteriaForFutureApproval: COMMON_ACCEPTANCE_CRITERIA,
    highRiskAutomationBlocked: false,
  }),
  buildFamily({
    id: "par_terre_technical_transfer",
    title: "Par terre technical transfer",
    scope: "Par terre top pressure, bottom base, transitions and recovery candidates.",
    exerciseFilter: categoryIn("par_terre_top", "par_terre_bottom"),
    linkedMethodologyTags: ["wrestling_transfer_candidate"],
    sourceExpansionBacklogIds: ["wrestling_contact_load_classification_sources"],
    sourceCandidateIds: ["wrestling_contact_load_source_need"],
    sourceLookupIntakeIds: [],
    requiredSourceTypes: [
      "wrestling_specific_study",
      "coach_school_methodology_source",
      "safety_screening_source",
    ],
    reviewTracks: ["coach", "sport_science"],
    allowedUseNow: "controlled_pilot_training_candidate",
    runtimeUseAllowedNow: "coach_editable_plan_content",
    forbiddenUses: [...COMMON_FORBIDDEN_RUNTIME_USES, "forced joint-range protocol"],
    limitations: COMMON_LIMITATIONS,
    evidenceReviewQuestions: [
      "Which par terre drill families transfer safely without forcing neck, spine or shoulder positions?",
      "Which top/bottom density should remain coach-selected?",
    ],
    acceptanceCriteriaForFutureApproval: COMMON_ACCEPTANCE_CRITERIA,
    highRiskAutomationBlocked: false,
  }),
  buildFamily({
    id: "competition_model_and_controlled_bouts",
    title: "Competition model and controlled bouts",
    scope: "Competition-period, exchange-model and controlled-bout candidates.",
    exerciseFilter: (exercise) =>
      categoryIn("competition_model", "controlled_bout")(exercise) ||
      blockIn("mat_competition_model", "mat_control_bouts")(exercise),
    linkedMethodologyTags: [
      "speed_endurance_candidate",
      "exercise_complex_candidate",
      "wrestling_transfer_candidate",
    ],
    sourceExpansionBacklogIds: [
      "competition_event_model_and_uww_rules_sources",
      "wrestling_contact_load_classification_sources",
    ],
    sourceCandidateIds: [
      "competition_model_source_need",
      "competition_context_review_source_need",
      "wrestling_contact_load_source_need",
    ],
    sourceLookupIntakeIds: ["uww_international_wrestling_rules_intake"],
    requiredSourceTypes: [
      "wrestling_specific_study",
      "combat_sport_study",
      "periodization_source",
    ],
    reviewTracks: ["coach", "sport_science", "product_safety"],
    allowedUseNow: "coach_editable_training_candidate",
    runtimeUseAllowedNow: "coach_editable_plan_content",
    forbiddenUses: [...COMMON_FORBIDDEN_RUNTIME_USES, "unsafe competition-day decision"],
    limitations: COMMON_LIMITATIONS,
    evidenceReviewQuestions: [
      "Which controlled-bout formats match competition model without unsafe close-start load?",
      "Which bout-density decisions must remain coach-selected?",
    ],
    acceptanceCriteriaForFutureApproval: COMMON_ACCEPTANCE_CRITERIA,
    highRiskAutomationBlocked: false,
  }),
  buildFamily({
    id: "taper_activation",
    title: "Taper activation",
    scope: "Taper, start-window freshness and first-action activation candidates.",
    exerciseFilter: (exercise) =>
      exercise.targetQualities.includes("taper_quality") ||
      exercise.blockTypes.includes("competition_start"),
    linkedMethodologyTags: ["speed_development_candidate", "exercise_complex_candidate"],
    sourceExpansionBacklogIds: ["taper_hidden_glycolytic_load_sources"],
    sourceCandidateIds: ["taper_hidden_load_source_need"],
    sourceLookupIntakeIds: ["tapering_systematic_review_intake"],
    requiredSourceTypes: [
      "systematic_review",
      "periodization_source",
      "wrestling_specific_study",
    ],
    reviewTracks: ["coach", "sport_science"],
    allowedUseNow: "coach_editable_training_candidate",
    runtimeUseAllowedNow: "coach_editable_plan_content",
    forbiddenUses: [...COMMON_FORBIDDEN_RUNTIME_USES, "hidden glycolytic close-start load"],
    limitations: COMMON_LIMITATIONS,
    evidenceReviewQuestions: [
      "Which activation choices preserve freshness close to a main start?",
      "Which hidden fatigue patterns must block runtime promotion?",
    ],
    acceptanceCriteriaForFutureApproval: COMMON_ACCEPTANCE_CRITERIA,
    highRiskAutomationBlocked: false,
  }),
  buildFamily({
    id: "recovery_mobility_downregulation",
    title: "Recovery, mobility and downregulation",
    scope: "Mobility, breathing, aerobic recovery and recovery-day support candidates.",
    exerciseFilter: (exercise) =>
      categoryIn("mobility", "breathing_downregulation", "aerobic_recovery")(exercise) ||
      exercise.blockTypes.includes("recovery"),
    linkedMethodologyTags: ["endurance_development_candidate", "low_impact_conditioning_candidate"],
    sourceExpansionBacklogIds: ["rhr_hrv_sleep_readiness_composite_sources"],
    sourceCandidateIds: ["readiness_multi_signal_monitoring_source_need"],
    sourceLookupIntakeIds: ["recovery_performance_consensus_intake"],
    requiredSourceTypes: [
      "consensus_statement",
      "position_stand",
      "internal_validation_study",
    ],
    reviewTracks: ["coach", "sport_science", "data_quality"],
    allowedUseNow: "controlled_pilot_training_candidate",
    runtimeUseAllowedNow: "coach_editable_plan_content",
    forbiddenUses: [...COMMON_FORBIDDEN_RUNTIME_USES, "medical recovery clearance"],
    limitations: COMMON_LIMITATIONS,
    evidenceReviewQuestions: [
      "Which recovery and mobility families can be used as low-risk support?",
      "Which readiness data limitations should keep recovery guidance advisory only?",
    ],
    acceptanceCriteriaForFutureApproval: COMMON_ACCEPTANCE_CRITERIA,
    highRiskAutomationBlocked: false,
  }),
  buildFamily({
    id: "travel_mobility_reset",
    title: "Travel mobility reset",
    scope: "Travel-day reset, hotel mobility and no-heavy-load travel candidates.",
    exerciseFilter: (exercise) =>
      exercise.category === "travel_mobility" || exercise.blockTypes.includes("travel"),
    linkedMethodologyTags: ["exercise_complex_candidate", "low_impact_conditioning_candidate"],
    sourceExpansionBacklogIds: ["travel_fatigue_load_ceiling_sources"],
    sourceCandidateIds: ["travel_fatigue_context_source_need"],
    sourceLookupIntakeIds: ["recovery_performance_consensus_intake"],
    requiredSourceTypes: [
      "consensus_statement",
      "periodization_source",
      "internal_validation_study",
    ],
    reviewTracks: ["coach", "sport_science", "data_quality"],
    allowedUseNow: "review_export_only",
    runtimeUseAllowedNow: "fallback_guard_only",
    forbiddenUses: [...COMMON_FORBIDDEN_RUNTIME_USES, "automatic travel fatigue load ceiling"],
    limitations: COMMON_LIMITATIONS,
    evidenceReviewQuestions: [
      "Which travel reset choices are safe as advisory low-load content?",
      "Which travel-fatigue signals require fallback instead of Matrix primary?",
    ],
    acceptanceCriteriaForFutureApproval: COMMON_ACCEPTANCE_CRITERIA,
    highRiskAutomationBlocked: false,
  }),
  buildFamily({
    id: "post_competition_recovery",
    title: "Post-competition recovery",
    scope: "Post-competition walk, mobility, symptom review and recovery nutrition context.",
    exerciseFilter: (exercise) =>
      exercise.category === "post_competition_recovery" ||
      exercise.blockTypes.includes("post_competition_recovery"),
    nutritionFilter: (item) => item.phase === "post_competition",
    linkedMethodologyTags: ["exercise_complex_candidate", "low_impact_conditioning_candidate"],
    sourceExpansionBacklogIds: ["rhr_hrv_sleep_readiness_composite_sources"],
    sourceCandidateIds: ["readiness_multi_signal_monitoring_source_need"],
    sourceLookupIntakeIds: ["recovery_performance_consensus_intake"],
    requiredSourceTypes: ["consensus_statement", "internal_validation_study"],
    reviewTracks: ["coach", "sport_science", "medical"],
    allowedUseNow: "controlled_pilot_training_candidate",
    runtimeUseAllowedNow: "coach_editable_plan_content",
    forbiddenUses: [...COMMON_FORBIDDEN_RUNTIME_USES, "injury-return clearance"],
    limitations: COMMON_LIMITATIONS,
    evidenceReviewQuestions: [
      "Which post-competition recovery actions are safe before symptom review?",
      "Which pain, illness or injury signals require medical escalation?",
    ],
    acceptanceCriteriaForFutureApproval: COMMON_ACCEPTANCE_CRITERIA,
    highRiskAutomationBlocked: false,
  }),
  buildFamily({
    id: "body_composition_training",
    title: "Body-composition training",
    scope: "Long-horizon body-composition training candidates that support fat-loss context without rapid cut automation.",
    exerciseFilter: hasTag("body_composition_training_candidate"),
    weightFilter: (item) =>
      [
        "long_horizon_body_composition_review_prompt",
        "fat_loss_without_rapid_cut_prompt",
        "body_composition_plateau_review_prompt",
      ].includes(item.id),
    linkedMethodologyTags: ["body_composition_training_candidate"],
    sourceExpansionBacklogIds: [
      "weight_cut_quantitative_safety_sources",
      "internal_validation_outcome_measurement_sources",
    ],
    sourceCandidateIds: ["weight_cut_hydration_consensus_source_need"],
    sourceLookupIntakeIds: [
      "acsm_nutrition_athletic_performance_intake",
      "combat_sports_rapid_weight_loss_meta_analysis_intake",
    ],
    requiredSourceTypes: [
      "body_composition_source",
      "nutrition_position_stand",
      "strength_conditioning_guideline",
      "internal_validation_study",
    ],
    reviewTracks: ["coach", "sport_science", "medical"],
    allowedUseNow: "coach_editable_training_candidate",
    runtimeUseAllowedNow: "coach_editable_plan_content",
    forbiddenUses: BODY_COMPOSITION_FORBIDDEN,
    limitations: [
      ...COMMON_LIMITATIONS,
      "body-composition support is long-horizon and review-required",
    ],
    evidenceReviewQuestions: [
      "Which training families support body-composition goals while preserving strength and recovery?",
      "Which warning signs require stopping body-composition progression or escalating review?",
    ],
    acceptanceCriteriaForFutureApproval: COMMON_ACCEPTANCE_CRITERIA,
    highRiskAutomationBlocked: false,
  }),
  buildFamily({
    id: "muscle_preservation_training",
    title: "Muscle-preservation training",
    scope: "Strength maintenance and fueling-context candidates used to protect training quality during body-composition work.",
    exerciseFilter: hasTag("muscle_preservation_candidate"),
    nutritionFilter: (item) => item.id === "muscle_preservation_fueling_prompt",
    weightFilter: (item) => item.id === "muscle_mass_preservation_context_needed",
    linkedMethodologyTags: ["muscle_preservation_candidate"],
    sourceExpansionBacklogIds: ["internal_validation_outcome_measurement_sources"],
    sourceCandidateIds: [],
    sourceLookupIntakeIds: ["acsm_nutrition_athletic_performance_intake"],
    requiredSourceTypes: [
      "body_composition_source",
      "nutrition_position_stand",
      "strength_conditioning_guideline",
    ],
    reviewTracks: ["coach", "sport_science", "medical"],
    allowedUseNow: "coach_editable_training_candidate",
    runtimeUseAllowedNow: "coach_editable_plan_content",
    forbiddenUses: BODY_COMPOSITION_FORBIDDEN,
    limitations: COMMON_LIMITATIONS,
    evidenceReviewQuestions: [
      "Which strength maintenance patterns best protect muscle mass during body-composition work?",
      "Which nutrition/recovery signals should prevent progression?",
    ],
    acceptanceCriteriaForFutureApproval: COMMON_ACCEPTANCE_CRITERIA,
    highRiskAutomationBlocked: false,
  }),
  buildFamily({
    id: "low_impact_conditioning_for_body_composition",
    title: "Low-impact conditioning for body-composition support",
    scope: "Low-impact conditioning candidates used as coach-editable body-composition support.",
    exerciseFilter: hasTag("low_impact_conditioning_candidate"),
    linkedMethodologyTags: [
      "low_impact_conditioning_candidate",
      "body_composition_training_candidate",
    ],
    sourceExpansionBacklogIds: [
      "rhr_hrv_sleep_readiness_composite_sources",
      "internal_validation_outcome_measurement_sources",
    ],
    sourceCandidateIds: ["readiness_multi_signal_monitoring_source_need"],
    sourceLookupIntakeIds: ["recovery_performance_consensus_intake"],
    requiredSourceTypes: [
      "body_composition_source",
      "consensus_statement",
      "internal_validation_study",
    ],
    reviewTracks: ["coach", "sport_science", "data_quality"],
    allowedUseNow: "coach_editable_training_candidate",
    runtimeUseAllowedNow: "coach_editable_plan_content",
    forbiddenUses: BODY_COMPOSITION_FORBIDDEN,
    limitations: COMMON_LIMITATIONS,
    evidenceReviewQuestions: [
      "Which low-impact conditioning formats are safest during body-composition blocks?",
      "Which fatigue or recovery signals require switching to recovery-only content?",
    ],
    acceptanceCriteriaForFutureApproval: COMMON_ACCEPTANCE_CRITERIA,
    highRiskAutomationBlocked: false,
  }),
  buildFamily({
    id: "nutrition_body_composition_guidance",
    title: "Nutrition guidance for body-composition context",
    scope: "Educational meal-pattern, fueling and recovery prompts for body-composition support.",
    nutritionFilter: (item) => item.phase === "body_composition",
    linkedMethodologyTags: [],
    sourceExpansionBacklogIds: [
      "weight_cut_quantitative_safety_sources",
      "reds_low_energy_availability_sources",
    ],
    sourceCandidateIds: [
      "weight_cut_hydration_consensus_source_need",
      "female_reds_context_source_need",
    ],
    sourceLookupIntakeIds: [
      "acsm_nutrition_athletic_performance_intake",
      "ioc_reds_consensus_statement_intake",
    ],
    requiredSourceTypes: [
      "nutrition_position_stand",
      "body_composition_source",
      "consensus_statement",
    ],
    reviewTracks: ["coach", "medical", "sport_science"],
    allowedUseNow: "review_export_only",
    runtimeUseAllowedNow: "review_export_only",
    forbiddenUses: BODY_COMPOSITION_FORBIDDEN,
    limitations: [
      ...COMMON_LIMITATIONS,
      "educational guidance only",
      "not medical advice",
    ],
    evidenceReviewQuestions: [
      "Which nutrition prompts are safe as educational guidance without exact calorie prescription?",
      "Which RED-S-sensitive contexts require medical review before any wording changes?",
    ],
    acceptanceCriteriaForFutureApproval: COMMON_ACCEPTANCE_CRITERIA,
    highRiskAutomationBlocked: true,
  }),
  buildFamily({
    id: "nutrition_training_day_guidance",
    title: "Nutrition guidance for training, travel, competition and recovery days",
    scope: "Educational nutrition prompts outside body-composition-specific context.",
    nutritionFilter: (item) => item.phase !== "body_composition",
    linkedMethodologyTags: [],
    sourceExpansionBacklogIds: [
      "travel_fatigue_load_ceiling_sources",
      "competition_event_model_and_uww_rules_sources",
      "rhr_hrv_sleep_readiness_composite_sources",
    ],
    sourceCandidateIds: [
      "travel_fatigue_context_source_need",
      "competition_model_source_need",
      "readiness_multi_signal_monitoring_source_need",
    ],
    sourceLookupIntakeIds: [
      "acsm_nutrition_athletic_performance_intake",
      "recovery_performance_consensus_intake",
    ],
    requiredSourceTypes: [
      "nutrition_position_stand",
      "consensus_statement",
      "periodization_source",
    ],
    reviewTracks: ["coach", "sport_science", "medical"],
    allowedUseNow: "warning_candidate_only",
    runtimeUseAllowedNow: "soft_warning_only",
    forbiddenUses: [
      ...BODY_COMPOSITION_FORBIDDEN,
      "competition-day medical decision",
    ],
    limitations: COMMON_LIMITATIONS,
    evidenceReviewQuestions: [
      "Which nutrition prompts are safe for training-day, travel-day and recovery-day education?",
      "Which competition-day prompts require qualified support or review-only status?",
    ],
    acceptanceCriteriaForFutureApproval: COMMON_ACCEPTANCE_CRITERIA,
    highRiskAutomationBlocked: false,
  }),
  buildFamily({
    id: "weight_management_review_prompt",
    title: "Weight-management review prompts",
    scope: "Review-required body-mass trend, category, plateau and context prompts.",
    weightFilter: () => true,
    nutritionFilter: (item) => item.phase === "weigh_in",
    linkedMethodologyTags: [],
    sourceExpansionBacklogIds: [
      "weight_cut_quantitative_safety_sources",
      "hydration_sauna_heat_exposure_sources",
    ],
    sourceCandidateIds: [
      "weight_cut_hydration_consensus_source_need",
      "hydration_heat_exposure_policy_source_need",
    ],
    sourceLookupIntakeIds: [
      "ncaa_wrestling_weight_management_program_intake",
      "acsm_exercise_fluid_replacement_intake",
      "combat_sports_rapid_weight_loss_meta_analysis_intake",
    ],
    requiredSourceTypes: [
      "weight_management_policy",
      "nutrition_position_stand",
      "consensus_statement",
    ],
    reviewTracks: ["coach", "medical", "sport_science"],
    allowedUseNow: "review_export_only",
    runtimeUseAllowedNow: "review_export_only",
    forbiddenUses: WEIGHT_CUT_FORBIDDEN,
    limitations: [
      ...COMMON_LIMITATIONS,
      "review prompt only",
      "not medical advice",
    ],
    evidenceReviewQuestions: [
      "Which weight-management prompts can be shown without implying clearance?",
      "Which contexts must remain blocked until qualified review is documented?",
    ],
    acceptanceCriteriaForFutureApproval: COMMON_ACCEPTANCE_CRITERIA,
    highRiskAutomationBlocked: true,
  }),
  buildFamily({
    id: "weigh_in_review_required_guidance",
    title: "Weigh-in review-required guidance",
    scope: "Weigh-in day activation, nutrition and safety prompts that remain review-required.",
    exerciseFilter: (exercise) =>
      exercise.category === "weigh_in_day_activation" ||
      exercise.blockTypes.includes("weigh_in") ||
      exercise.blockTypes.includes("sauna"),
    nutritionFilter: (item) => item.phase === "weigh_in",
    weightFilter: (item) =>
      [
        "aggressive_last_minute_loss_blocked",
        "weigh_in_day_safety_checklist",
        "hydration_awareness_no_diagnosis",
      ].includes(item.id),
    linkedMethodologyTags: [],
    sourceExpansionBacklogIds: [
      "weight_cut_quantitative_safety_sources",
      "hydration_sauna_heat_exposure_sources",
    ],
    sourceCandidateIds: [
      "weight_cut_hydration_consensus_source_need",
      "hydration_heat_exposure_policy_source_need",
    ],
    sourceLookupIntakeIds: [
      "ncaa_wrestling_weight_management_program_intake",
      "acsm_exercise_fluid_replacement_intake",
    ],
    requiredSourceTypes: [
      "weight_management_policy",
      "position_stand",
      "safety_screening_source",
    ],
    reviewTracks: ["coach", "medical", "sport_science", "product_safety"],
    allowedUseNow: "blocked",
    runtimeUseAllowedNow: "none",
    forbiddenUses: WEIGHT_CUT_FORBIDDEN,
    limitations: COMMON_LIMITATIONS,
    evidenceReviewQuestions: [
      "Which weigh-in prompts are safe as review checklist wording only?",
      "Which language could be misread as dehydration or rapid-cut protocol and must remain forbidden?",
    ],
    acceptanceCriteriaForFutureApproval: COMMON_ACCEPTANCE_CRITERIA,
    highRiskAutomationBlocked: true,
  }),
  buildFamily({
    id: "high_risk_blocked_weight_cut_hydration",
    title: "High-risk blocked weight-cut and hydration context",
    scope: "Blocked high-risk layer for rapid weight cut, hydration diagnosis and heat-exposure contexts.",
    exerciseFilter: (exercise) =>
      exercise.blockTypes.includes("sauna") ||
      exercise.blockTypes.includes("weigh_in") ||
      exercise.targetQualities.includes("weight_management"),
    nutritionFilter: (item) => item.highRiskBlocked,
    weightFilter: (item) => item.highRiskBlocked,
    linkedMethodologyTags: ["body_composition_training_candidate"],
    sourceExpansionBacklogIds: [
      "weight_cut_quantitative_safety_sources",
      "hydration_sauna_heat_exposure_sources",
      "reds_low_energy_availability_sources",
    ],
    sourceCandidateIds: [
      "weight_cut_hydration_consensus_source_need",
      "hydration_heat_exposure_policy_source_need",
      "female_reds_context_source_need",
    ],
    sourceLookupIntakeIds: [
      "ncaa_wrestling_weight_management_program_intake",
      "acsm_exercise_fluid_replacement_intake",
      "combat_sports_rapid_weight_loss_meta_analysis_intake",
      "ioc_reds_consensus_statement_intake",
    ],
    requiredSourceTypes: [
      "weight_management_policy",
      "nutrition_position_stand",
      "consensus_statement",
      "safety_screening_source",
    ],
    reviewTracks: ["coach", "medical", "sport_science", "product_safety"],
    allowedUseNow: "blocked",
    runtimeUseAllowedNow: "none",
    forbiddenUses: WEIGHT_CUT_FORBIDDEN,
    limitations: [
      ...COMMON_LIMITATIONS,
      "high-risk medical and weight-cut decisions remain non-automated",
    ],
    evidenceReviewQuestions: [
      "Which source and review artifacts are required before wording changes are even considered?",
      "Which contexts must stay permanently do-not-automate?",
    ],
    acceptanceCriteriaForFutureApproval: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "future approval cannot enable automatic weight-cut or hydration decisions",
    ],
    highRiskAutomationBlocked: true,
  }),
  buildFamily({
    id: "bfr_kaatsu_blocked_screening_context",
    title: "BFR/KAATSU blocked screening context",
    scope: "Blocked context for BFR/KAATSU-related source dependencies and safety screening.",
    exerciseFilter: (exercise) =>
      exercise.evidenceDependencyIds.includes("bfr_kaatsu_local_metabolic") ||
      exercise.evidenceDependencyIds.includes("china_bfr_half_squat_wrestlers"),
    linkedMethodologyTags: [
      "seluyanov_statodynamic_lme_candidate",
      "coach_school_candidate",
    ],
    sourceExpansionBacklogIds: ["bfr_kaatsu_safety_and_screening_sources"],
    sourceCandidateIds: ["bfr_kaatsu_safety_screening_source_need"],
    sourceLookupIntakeIds: ["bfr_position_stand_intake", "bfr_lmv_methodology_intake"],
    requiredSourceTypes: [
      "position_stand",
      "safety_screening_source",
      "coach_school_methodology_source",
    ],
    reviewTracks: ["coach", "medical", "sport_science"],
    allowedUseNow: "blocked",
    runtimeUseAllowedNow: "none",
    forbiddenUses: [
      ...COMMON_FORBIDDEN_RUNTIME_USES,
      "BFR/KAATSU prescription",
      "automatic vascular restriction decision",
      "medical screening automation",
    ],
    limitations: [
      ...COMMON_LIMITATIONS,
      "BFR/KAATSU remains do-not-automate",
    ],
    evidenceReviewQuestions: [
      "Which BFR/KAATSU safety sources are required before any text can leave review export?",
      "Which related LMV exercises must remain separated from BFR/KAATSU prescription?",
    ],
    acceptanceCriteriaForFutureApproval: [
      ...COMMON_ACCEPTANCE_CRITERIA,
      "future approval cannot enable BFR/KAATSU automation",
    ],
    highRiskAutomationBlocked: true,
  }),
] as const satisfies readonly ConstructorMatrixExerciseEvidenceFamily[];

export type ConstructorMatrixExerciseEvidenceFamilyId =
  (typeof CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP)[number]["id"];

export const CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_FAMILY_IDS =
  CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP.map((item) => item.id);

export function listConstructorMatrixExerciseEvidenceFamilyIds():
  ConstructorMatrixExerciseEvidenceFamilyId[] {
  return [
    ...CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_FAMILY_IDS,
  ] as ConstructorMatrixExerciseEvidenceFamilyId[];
}

export function getConstructorMatrixExerciseEvidenceFamily(
  id: string,
): ConstructorMatrixExerciseEvidenceFamily | null {
  return CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP.find((item) => item.id === id) ?? null;
}

export function getConstructorMatrixEvidenceFamiliesForExercise(
  exerciseId: string,
): ConstructorMatrixExerciseEvidenceFamily[] {
  return CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP.filter((family) =>
    family.linkedExerciseIds.includes(exerciseId as ConstructorMatrixExerciseId),
  );
}

export function validateConstructorMatrixExerciseEvidenceCoverage() {
  const uncoveredExerciseIds = CONSTRUCTOR_MATRIX_EXERCISE_LIBRARY
    .map((item) => item.id)
    .filter((id) => getConstructorMatrixEvidenceFamiliesForExercise(id).length === 0);
  const uncoveredNutritionGuidanceIds = CONSTRUCTOR_MATRIX_NUTRITION_GUIDANCE
    .map((item) => item.id)
    .filter(
      (id) =>
        !CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP.some((family) =>
          family.linkedNutritionGuidanceIds.includes(id),
        ),
    );
  const uncoveredWeightManagementGuidanceIds =
    CONSTRUCTOR_MATRIX_WEIGHT_MANAGEMENT_GUIDANCE
      .map((item) => item.id)
      .filter(
        (id) =>
          !CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP.some((family) =>
            family.linkedWeightManagementGuidanceIds.includes(id),
          ),
      );

  return {
    ok:
      uncoveredExerciseIds.length === 0 &&
      uncoveredNutritionGuidanceIds.length === 0 &&
      uncoveredWeightManagementGuidanceIds.length === 0,
    uncoveredExerciseIds,
    uncoveredNutritionGuidanceIds,
    uncoveredWeightManagementGuidanceIds,
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

export function buildConstructorMatrixExerciseEvidenceMapSummary() {
  const coverage = validateConstructorMatrixExerciseEvidenceCoverage();

  return {
    familyCount: CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP.length,
    familyIds: CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_FAMILY_IDS,
    exerciseCount: CONSTRUCTOR_MATRIX_EXERCISE_LIBRARY.length,
    coveredExerciseCount:
      CONSTRUCTOR_MATRIX_EXERCISE_LIBRARY.length - coverage.uncoveredExerciseIds.length,
    nutritionGuidanceCount: CONSTRUCTOR_MATRIX_NUTRITION_GUIDANCE.length,
    coveredNutritionGuidanceCount:
      CONSTRUCTOR_MATRIX_NUTRITION_GUIDANCE.length -
      coverage.uncoveredNutritionGuidanceIds.length,
    weightManagementGuidanceCount: CONSTRUCTOR_MATRIX_WEIGHT_MANAGEMENT_GUIDANCE.length,
    coveredWeightManagementGuidanceCount:
      CONSTRUCTOR_MATRIX_WEIGHT_MANAGEMENT_GUIDANCE.length -
      coverage.uncoveredWeightManagementGuidanceIds.length,
    byAllowedUseNow: countBy(
      CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP.map((item) => item.allowedUseNow),
    ),
    byRuntimeUseAllowedNow: countBy(
      CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP.map((item) => item.runtimeUseAllowedNow),
    ),
    highRiskBlockedFamilyCount: CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP.filter(
      (item) => item.highRiskAutomationBlocked,
    ).length,
    humanReviewed: false,
    coverage,
  };
}
