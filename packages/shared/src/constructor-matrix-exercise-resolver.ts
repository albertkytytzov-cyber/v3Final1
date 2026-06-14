import type { ConstructorInput, ConstructorPlanExercise } from "./constructor-core";
import type {
  ConstructorDayType,
  ConstructorPreparationPhase,
  ConstructorSessionSlot,
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
  weekNumber?: number;
  dayNumber?: number;
  daysUntilStart?: number | null;
  sessionSlot?: ConstructorSessionSlot;
  blockIndex?: number;
  avoidExerciseIds?: readonly string[];
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

type ConstructorMatrixAthleteExerciseProfile = {
  needCategories: ReadonlySet<ConstructorMatrixExerciseCategory>;
  supportCategories: ReadonlySet<ConstructorMatrixExerciseCategory>;
  cautionCategories: ReadonlySet<ConstructorMatrixExerciseCategory>;
  needQualities: ReadonlySet<string>;
  supportQualities: ReadonlySet<string>;
  prefersBodyCompositionCandidates: boolean;
  hasSpecificSignal: boolean;
  hasCautionSignal: boolean;
  stableKey: string;
};

type ConstructorMatrixProfileSignal = {
  keywords: readonly string[];
  categories: readonly ConstructorMatrixExerciseCategory[];
  qualities: readonly string[];
};

const PROFILE_SIGNALS = [
  {
    keywords: [
      "grip",
      "hand fight",
      "hand-fight",
      "tie",
      "clinch",
      "захват",
      "рук",
      "кисть",
      "предплеч",
      "клинч",
    ],
    categories: ["grip_hand_fighting", "strength_endurance"],
    qualities: ["arms_grip", "fatigue_skill"],
  },
  {
    keywords: [
      "speed",
      "first action",
      "reaction",
      "explosive",
      "быстр",
      "скорост",
      "перв",
      "реакц",
      "взрыв",
    ],
    categories: [
      "speed_first_action",
      "acceleration_change_of_direction",
      "shots_entries",
    ],
    qualities: ["speed_first_action", "speed_strength"],
  },
  {
    keywords: [
      "leg",
      "legs",
      "lme",
      "lmv",
      "shot",
      "entry",
      "single",
      "double",
      "ног",
      "лмв",
      "проход",
      "атака в ноги",
    ],
    categories: [
      "local_muscular_endurance_legs",
      "shots_entries",
      "posterior_chain",
    ],
    qualities: ["legs_lme", "fatigue_skill"],
  },
  {
    keywords: ["strength", "power", "сил", "мощн"],
    categories: [
      "max_strength",
      "strength_endurance",
      "posterior_chain",
      "trunk_anti_rotation",
    ],
    qualities: ["max_strength", "speed_strength"],
  },
  {
    keywords: [
      "endurance",
      "aerobic",
      "conditioning",
      "stamina",
      "вынослив",
      "аэроб",
      "дых",
      "кондиц",
    ],
    categories: [
      "aerobic_recovery",
      "strength_endurance",
      "wrestling_stance_movement",
    ],
    qualities: ["aerobic_base", "fatigue_skill", "recovery"],
  },
  {
    keywords: [
      "par terre",
      "parterre",
      "top",
      "bottom",
      "партер",
      "накат",
      "низ",
      "верх",
    ],
    categories: ["par_terre_top", "par_terre_bottom", "trunk_anti_rotation"],
    qualities: ["fatigue_skill", "wrestling_contact_density"],
  },
  {
    keywords: ["defense", "sprawl", "counter", "защ", "спрол", "контр"],
    categories: ["defense_sprawl", "trunk_anti_rotation", "mobility"],
    qualities: ["fatigue_skill"],
  },
  {
    keywords: [
      "mobility",
      "recovery",
      "reset",
      "rest",
      "восстанов",
      "мобил",
      "сон",
    ],
    categories: ["mobility", "breathing_downregulation", "aerobic_recovery"],
    qualities: ["recovery", "aerobic_base"],
  },
] as const satisfies readonly ConstructorMatrixProfileSignal[];

const GOAL_CATEGORY_SIGNALS: Partial<
  Record<string, readonly ConstructorMatrixExerciseCategory[]>
> = {
  speed_first_action: [
    "speed_first_action",
    "acceleration_change_of_direction",
    "shots_entries",
  ],
  max_strength: ["max_strength", "posterior_chain", "trunk_anti_rotation"],
  strength_endurance: ["strength_endurance", "grip_hand_fighting"],
  legs_lme: ["local_muscular_endurance_legs", "shots_entries"],
  aerobic_base: ["aerobic_recovery", "wrestling_stance_movement"],
  recovery: ["aerobic_recovery", "mobility", "breathing_downregulation"],
  fatigue_skill: [
    "tactical_score_situation",
    "controlled_bout",
    "competition_model",
  ],
  weight_management: [
    "aerobic_recovery",
    "strength_endurance",
    "mobility",
  ],
};

const GOAL_QUALITY_SIGNALS: Partial<Record<string, readonly string[]>> = {
  speed_first_action: ["speed_first_action", "speed_strength"],
  max_strength: ["max_strength", "speed_strength"],
  strength_endurance: ["arms_grip", "fatigue_skill"],
  legs_lme: ["legs_lme", "fatigue_skill"],
  aerobic_base: ["aerobic_base", "recovery"],
  recovery: ["recovery", "aerobic_base"],
  fatigue_skill: ["fatigue_skill", "wrestling_contact_density"],
  weight_management: ["aerobic_base", "recovery"],
};

const PAIN_CAUTION_SIGNALS = [
  {
    keywords: ["knee", "ankle", "hip", "groin", "колен", "голен", "таз", "пах"],
    categories: [
      "local_muscular_endurance_legs",
      "shots_entries",
      "acceleration_change_of_direction",
    ],
  },
  {
    keywords: ["back", "spine", "lumbar", "спин", "поясниц"],
    categories: ["posterior_chain", "max_strength", "trunk_anti_rotation"],
  },
  {
    keywords: ["shoulder", "elbow", "wrist", "плеч", "локт", "запяст"],
    categories: ["grip_hand_fighting", "max_strength", "par_terre_top"],
  },
  {
    keywords: ["neck", "concussion", "ше", "голов"],
    categories: ["neck_prehab", "controlled_bout", "competition_model"],
  },
] as const satisfies readonly {
  keywords: readonly string[];
  categories: readonly ConstructorMatrixExerciseCategory[];
}[];

function normalizeProfileText(value: readonly string[] | string | null | undefined) {
  const source =
    typeof value === "string" ? value : value ? [...value].join(" ") : "";

  return source.toLocaleLowerCase();
}

function textHasAnyKeyword(text: string, keywords: readonly string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function addSignalMatches(params: {
  text: string;
  categoryTarget: Set<ConstructorMatrixExerciseCategory>;
  qualityTarget: Set<string>;
}) {
  for (const signal of PROFILE_SIGNALS) {
    if (!textHasAnyKeyword(params.text, signal.keywords)) {
      continue;
    }

    for (const category of signal.categories) {
      params.categoryTarget.add(category);
    }

    for (const quality of signal.qualities) {
      params.qualityTarget.add(quality);
    }
  }
}

function stableHash(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function buildAthleteExerciseProfile(
  input: ConstructorInput,
): ConstructorMatrixAthleteExerciseProfile {
  const needCategories = new Set<ConstructorMatrixExerciseCategory>();
  const supportCategories = new Set<ConstructorMatrixExerciseCategory>();
  const cautionCategories = new Set<ConstructorMatrixExerciseCategory>();
  const needQualities = new Set<string>();
  const supportQualities = new Set<string>();
  const weaknessText = normalizeProfileText(input.athlete.weaknesses);
  const strengthText = normalizeProfileText(input.athlete.strengths);
  const coachContextText = normalizeProfileText([
    input.state.coachComment ?? "",
    ...input.goals.map((goal) => goal.reason ?? ""),
  ]);
  const cautionText = normalizeProfileText([
    ...(input.athlete.injuryHistory ?? []),
    ...(input.athlete.painZones ?? []),
  ]);

  addSignalMatches({
    text: `${weaknessText} ${coachContextText}`,
    categoryTarget: needCategories,
    qualityTarget: needQualities,
  });
  addSignalMatches({
    text: strengthText,
    categoryTarget: supportCategories,
    qualityTarget: supportQualities,
  });

  for (const goal of input.goals) {
    for (const category of GOAL_CATEGORY_SIGNALS[goal.goalType] ?? []) {
      needCategories.add(category);
    }

    for (const quality of GOAL_QUALITY_SIGNALS[goal.goalType] ?? []) {
      needQualities.add(quality);
    }
  }

  for (const signal of PAIN_CAUTION_SIGNALS) {
    if (!textHasAnyKeyword(cautionText, signal.keywords)) {
      continue;
    }

    for (const category of signal.categories) {
      cautionCategories.add(category);
    }
  }

  if (input.constraints?.injuryCaution || (input.state.painLevel ?? 0) > 0) {
    cautionCategories.add("controlled_bout");
    cautionCategories.add("competition_model");
  }

  if ((input.athlete.trainingAgeYears ?? 99) <= 2 || (input.athlete.age ?? 99) < 18) {
    supportCategories.add("mobility");
    supportCategories.add("aerobic_recovery");
    cautionCategories.add("max_strength");
    cautionCategories.add("controlled_bout");
  }

  return {
    needCategories,
    supportCategories,
    cautionCategories,
    needQualities,
    supportQualities,
    prefersBodyCompositionCandidates: hasExplicitWeightManagementGoal(input),
    hasSpecificSignal:
      needCategories.size > 0 ||
      supportCategories.size > 0 ||
      needQualities.size > 0 ||
      supportQualities.size > 0 ||
      hasExplicitWeightManagementGoal(input),
    hasCautionSignal: cautionCategories.size > 0,
    stableKey: [
      input.athlete.athleteId,
      input.athlete.sex,
      input.athlete.trainingAgeYears ?? "unknown",
      weaknessText,
      strengthText,
      coachContextText,
    ].join("|"),
  };
}

function athleteProfileScore(
  exercise: ConstructorMatrixExercise,
  profile: ConstructorMatrixAthleteExerciseProfile,
) {
  let score = 0;

  if (profile.needCategories.has(exercise.category)) {
    score += 70;
  }

  if (profile.supportCategories.has(exercise.category)) {
    score += 20;
  }

  if (profile.cautionCategories.has(exercise.category)) {
    score -= 50;
  }

  if (profile.prefersBodyCompositionCandidates && isBodyCompositionCandidate(exercise)) {
    score += 80;
  }

  for (const quality of exercise.targetQualities) {
    if (profile.needQualities.has(quality)) {
      score += 35;
    }

    if (profile.supportQualities.has(quality)) {
      score += 10;
    }
  }

  return score;
}

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
  params: ConstructorMatrixExerciseResolverContext,
  profile: ConstructorMatrixAthleteExerciseProfile,
) {
  const avoidExerciseIds = new Set(params.avoidExerciseIds ?? []);
  const leftScore =
    athleteProfileScore(left, profile) - (avoidExerciseIds.has(left.id) ? 120 : 0);
  const rightScore =
    athleteProfileScore(right, profile) - (avoidExerciseIds.has(right.id) ? 120 : 0);

  if (leftScore !== rightScore) {
    return rightScore - leftScore;
  }

  const leftPriority = CATEGORY_PRIORITY[left.category] ?? 50;
  const rightPriority = CATEGORY_PRIORITY[right.category] ?? 50;

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  const contextKey = [
    profile.stableKey,
    params.block.blockType,
    params.phase ?? "unknown_phase",
    params.dayType ?? "unknown_day_type",
    params.weekNumber ?? "unknown_week",
    params.dayNumber ?? "unknown_day",
    params.daysUntilStart ?? "unknown_d",
    params.sessionSlot ?? "unknown_slot",
    params.blockIndex ?? "unknown_block",
  ].join(":");
  const leftRotation = stableHash(`${contextKey}:${left.id}`) % 997;
  const rightRotation = stableHash(`${contextKey}:${right.id}`) % 997;

  if (leftRotation !== rightRotation) {
    return leftRotation - rightRotation;
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
  const athleteProfile = buildAthleteExerciseProfile(params.input);
  const primaryCandidates = getConstructorMatrixExercisesForBlockType(blockType);
  const suppressedBodyCompositionIds = primaryCandidates
    .filter((exercise) => shouldSuppressBodyCompositionCandidate(exercise, params))
    .map((exercise) => exercise.id);
  const applicableCandidates = primaryCandidates
    .filter((exercise) => isExerciseApplicable(exercise, params))
    .filter((exercise) => !shouldSuppressBodyCompositionCandidate(exercise, params))
    .sort((left, right) => sortExerciseCandidates(left, right, params, athleteProfile));
  const fallbackCandidates = fallbackExercisesFor(blockType)
    .filter((exercise) => !shouldSuppressBodyCompositionCandidate(exercise, params))
    .sort((left, right) => sortExerciseCandidates(left, right, params, athleteProfile));
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
      athleteProfile.hasSpecificSignal
        ? "athlete profile scoring applied from goals, strengths, weaknesses and coach context"
        : "",
      athleteProfile.hasCautionSignal
        ? "pain/injury/youth caution only lowers candidate priority; no medical clearance inferred"
        : "",
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
  weekNumber?: number;
  dayNumber?: number;
  daysUntilStart?: number | null;
  sessionSlot?: ConstructorSessionSlot;
  blockIndex?: number;
  avoidExerciseIds?: readonly string[];
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
        item.substitutions.regressions[0]
          ? `проще: ${item.substitutions.regressions[0]}`
          : "",
        item.substitutions.progressions[0]
          ? `сложнее: ${item.substitutions.progressions[0]}`
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
