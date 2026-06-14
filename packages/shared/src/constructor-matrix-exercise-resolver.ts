import type { ConstructorInput, ConstructorPlanExercise } from "./constructor-core";
import type {
  ConstructorDayType,
  ConstructorPreparationPhase,
  ConstructorTrainingBlockType,
} from "./constructor-matrix";
import {
  CONSTRUCTOR_MATRIX_EXERCISE_LIBRARY,
  getConstructorMatrixExercisesForBlockType,
  type ConstructorMatrixExercise,
  type ConstructorMatrixExerciseCategory,
} from "./constructor-matrix-exercise-library";
import {
  buildConstructorMatrixLoadPrescription,
  type ConstructorMatrixStrengthLoadContext,
} from "./constructor-matrix-load-prescription";
import type { MatrixDrivenSelectedBlock } from "./constructor-matrix-plan-builder";

export type ConstructorMatrixExerciseResolverContext = {
  block: MatrixDrivenSelectedBlock;
  input: ConstructorInput;
  phase?: ConstructorPreparationPhase;
  dayType?: ConstructorDayType;
  strengthLoadContext?: ConstructorMatrixStrengthLoadContext;
  maxExercises?: number;
};

export type ConstructorMatrixResolvedExercise = ConstructorPlanExercise & {
  sourceExerciseId: string;
  category: ConstructorMatrixExerciseCategory;
  coachEditable: true;
  loadLocked: false;
  safetyNotes: readonly string[];
  substitutions: {
    regressions: readonly string[];
    progressions: readonly string[];
  };
  reviewRequired: readonly string[];
  highRiskAutomationBlocked: boolean;
};

export type ConstructorMatrixExerciseResolverResult = {
  blockType: ConstructorTrainingBlockType;
  exerciseCount: number;
  exercises: readonly ConstructorMatrixResolvedExercise[];
  candidateIds: readonly string[];
  rejectedIds: readonly string[];
  reviewRequiredIds: readonly string[];
  highRiskAutomationBlockedIds: readonly string[];
  notes: readonly string[];
};

const DEFAULT_MAX_EXERCISES_BY_BLOCK_TYPE: Partial<
  Record<ConstructorTrainingBlockType, number>
> = {
  mat_competition_model: 3,
  mat_control_bouts: 2,
  competition_start: 2,
  travel: 2,
  weigh_in: 2,
  recovery: 2,
  mobility: 2,
  sauna: 2,
  post_competition_recovery: 3,
};

const CATEGORY_PRIORITY: Partial<Record<ConstructorMatrixExerciseCategory, number>> = {
  wrestling_stance_movement: 1,
  shots_entries: 2,
  defense_sprawl: 3,
  grip_hand_fighting: 4,
  edge_of_mat: 5,
  tactical_score_situation: 6,
  competition_model: 7,
  controlled_bout: 8,
  speed_first_action: 2,
  acceleration_change_of_direction: 3,
  max_strength: 4,
  strength_endurance: 5,
  local_muscular_endurance_legs: 2,
  posterior_chain: 5,
  trunk_anti_rotation: 6,
  neck_prehab: 9,
  mobility: 1,
  aerobic_recovery: 2,
  breathing_downregulation: 3,
  travel_mobility: 1,
  weigh_in_day_activation: 1,
  post_competition_recovery: 1,
};

function isExerciseApplicable(
  exercise: ConstructorMatrixExercise,
  params: ConstructorMatrixExerciseResolverContext,
) {
  const phaseMatches =
    !params.phase || exercise.phaseApplicability.includes(params.phase);
  const dayMatches =
    !params.dayType || exercise.dayTypeApplicability.includes(params.dayType);

  return phaseMatches && dayMatches;
}

function sortExerciseCandidates(
  left: ConstructorMatrixExercise,
  right: ConstructorMatrixExercise,
) {
  const leftPriority = CATEGORY_PRIORITY[left.category] ?? 50;
  const rightPriority = CATEGORY_PRIORITY[right.category] ?? 50;

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return left.id.localeCompare(right.id);
}

function hasExplicitWeightManagementGoal(input: ConstructorInput) {
  return input.goals.some((goal) => goal.goalType === "weight_management");
}

function isBodyCompositionCandidate(exercise: ConstructorMatrixExercise) {
  return exercise.methodologyTags.includes("body_composition_training_candidate");
}

function isCloseStartPhase(phase?: ConstructorPreparationPhase) {
  return (
    phase === "special_pre_competition" ||
    phase === "direct_pre_competition" ||
    phase === "taper" ||
    phase === "competition"
  );
}

function shouldSuppressBodyCompositionCandidate(
  exercise: ConstructorMatrixExercise,
  params: ConstructorMatrixExerciseResolverContext,
) {
  if (!isBodyCompositionCandidate(exercise)) {
    return false;
  }

  if (params.block.blockType === "mat_light_technical") {
    return true;
  }

  if (params.input.constraints?.weightCutActive) {
    return true;
  }

  if (isCloseStartPhase(params.phase)) {
    return true;
  }

  return !hasExplicitWeightManagementGoal(params.input);
}

function maxExercisesFor(params: ConstructorMatrixExerciseResolverContext) {
  return (
    params.maxExercises ??
    DEFAULT_MAX_EXERCISES_BY_BLOCK_TYPE[params.block.blockType] ??
    3
  );
}

function fallbackExercisesFor(
  blockType: ConstructorTrainingBlockType,
): ConstructorMatrixExercise[] {
  if (blockType === "travel") {
    return getConstructorMatrixExercisesForBlockType("travel");
  }

  if (blockType === "weigh_in") {
    return getConstructorMatrixExercisesForBlockType("weigh_in");
  }

  if (blockType === "competition_start") {
    return getConstructorMatrixExercisesForBlockType("competition_start");
  }

  return CONSTRUCTOR_MATRIX_EXERCISE_LIBRARY.filter((item) =>
    item.blockTypes.includes("mobility") || item.blockTypes.includes("recovery"),
  );
}

export function resolveConstructorMatrixExercisesForBlock(
  params: ConstructorMatrixExerciseResolverContext,
): ConstructorMatrixExerciseResolverResult {
  const blockType = params.block.blockType;
  const primaryCandidates = getConstructorMatrixExercisesForBlockType(blockType);
  const suppressedBodyCompositionIds = primaryCandidates
    .filter((exercise) => shouldSuppressBodyCompositionCandidate(exercise, params))
    .map((exercise) => exercise.id);
  const applicableCandidates = primaryCandidates
    .filter((exercise) => isExerciseApplicable(exercise, params))
    .filter((exercise) => !shouldSuppressBodyCompositionCandidate(exercise, params))
    .sort(sortExerciseCandidates);
  const fallbackCandidates = fallbackExercisesFor(blockType)
    .filter((exercise) => !shouldSuppressBodyCompositionCandidate(exercise, params))
    .sort(sortExerciseCandidates);
  const sourceCandidates = applicableCandidates.length
    ? applicableCandidates
    : fallbackCandidates;
  const maxExercises = maxExercisesFor(params);
  const selected = sourceCandidates.slice(0, maxExercises);
  const rejectedIds = primaryCandidates
    .filter((item) => !selected.some((selectedItem) => selectedItem.id === item.id))
    .map((item) => item.id);
  const exercises = selected.map((exercise, index) => {
    const prescription = buildConstructorMatrixLoadPrescription({
      exercise,
      block: params.block,
      input: params.input,
      displayOrder: index,
      strengthLoadContext: params.strengthLoadContext,
    });

    return {
      ...prescription,
      category: exercise.category,
      safetyNotes: exercise.safetyNotes,
      substitutions: {
        regressions: exercise.regressionOptions,
        progressions: exercise.progressionOptions,
      },
    };
  });

  return {
    blockType,
    exerciseCount: exercises.length,
    exercises,
    candidateIds: primaryCandidates.map((item) => item.id),
    rejectedIds,
    reviewRequiredIds: exercises
      .filter((item) => item.reviewRequired.length > 0)
      .map((item) => item.sourceExerciseId),
    highRiskAutomationBlockedIds: exercises
      .filter((item) => item.highRiskAutomationBlocked)
      .map((item) => item.sourceExerciseId),
    notes: [
      "exercise resolver uses registry-backed concrete exercises",
      "all prescriptions remain coach-editable",
      "high-risk entries stay review-required or automation-blocked",
      suppressedBodyCompositionIds.length
        ? `body-composition candidates suppressed by pilot quality guard: ${suppressedBodyCompositionIds.join(",")}`
        : "",
    ].filter(Boolean),
  };
}

export function resolveConstructorMatrixBlockExercises(params: {
  block: MatrixDrivenSelectedBlock;
  input: ConstructorInput;
  phase?: ConstructorPreparationPhase;
  dayType?: ConstructorDayType;
  strengthLoadContext?: ConstructorMatrixStrengthLoadContext;
}): ConstructorPlanExercise[] {
  return resolveConstructorMatrixExercisesForBlock(params).exercises.map(
    (item) => ({
      name: item.name,
      targetSets: item.targetSets,
      targetReps: item.targetReps,
      targetWeightKg: item.targetWeightKg,
      targetDurationMinutes: item.targetDurationMinutes,
      targetRpe: item.targetRpe,
      notes: [
        item.notes,
        item.safetyNotes.length ? `safety: ${item.safetyNotes.join("; ")}` : "",
        item.substitutions.regressions.length
          ? `regressions: ${item.substitutions.regressions.join("; ")}`
          : "",
        item.substitutions.progressions.length
          ? `progressions: ${item.substitutions.progressions.join("; ")}`
          : "",
      ]
        .filter(Boolean)
        .join(" · "),
      displayOrder: item.displayOrder,
    }),
  );
}

export function buildConstructorMatrixExerciseResolverSummary() {
  const coveredBlockTypes = new Set<ConstructorTrainingBlockType>();

  for (const exercise of CONSTRUCTOR_MATRIX_EXERCISE_LIBRARY) {
    for (const blockType of exercise.blockTypes) {
      coveredBlockTypes.add(blockType);
    }
  }

  return {
    coveredBlockTypes: Array.from(coveredBlockTypes).sort(),
    coveredBlockTypeCount: coveredBlockTypes.size,
    exerciseCount: CONSTRUCTOR_MATRIX_EXERCISE_LIBRARY.length,
    highRiskAutomationBlockedCount: CONSTRUCTOR_MATRIX_EXERCISE_LIBRARY.filter(
      (item) => item.highRiskAutomationBlocked,
    ).length,
  };
}
