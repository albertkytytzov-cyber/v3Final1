type PlanBlockRowKind =
  | "workout"
  | "exercise"
  | "instruction"
  | "control"
  | "note"
  | "recovery";

type PlanBlockType =
  | "technical"
  | "speed"
  | "strength"
  | "CNS_high"
  | "metabolic"
  | "conditioning"
  | "recovery"
  | "mobility"
  | "activation";

type DeviceWorkoutLinkablePlanBlockInput = {
  name: string;
  notes: string;
  rowKind?: PlanBlockRowKind | null;
};

type TrainingLoadExerciseInput = {
  targetDurationMinutes: number | null;
  targetRpe: number | null;
};

type TrainingLoadBlockInput = {
  targetDurationMinutes: number | null;
  targetRpe: number | null;
  blockType?: PlanBlockType | null;
  blockPriority?: number | null;
  exercises?: TrainingLoadExerciseInput[] | null;
  rowKind?: PlanBlockRowKind | null;
};

type TrainingActualExerciseInput = {
  assignedExerciseId?: string | null;
  completed?: boolean | null;
  setsCompleted?: number | null;
  repsCompleted?: number | null;
  durationMinutes?: number | null;
  rpe?: number | null;
};

type TrainingActualLoadInput = {
  plannedLoad: number;
  completed?: boolean | null;
  durationMinutes?: number | null;
  rpe?: number | null;
  assignedExerciseCount?: number | null;
  exercises?: TrainingActualExerciseInput[] | null;
};

const DEVICE_WORKOUT_LINK_NAME_PATTERN =
  /кросс|поход|бег|пано|кругов|трениров|спринт|ускор|отрез|интервал/iu;

const DEVICE_WORKOUT_IMPORT_MARKER_PATTERN =
  /(?:тип|type)\s*:\s*(?:exercise)?workout|exerciseworkout/iu;

const TRAINING_LOAD_BLOCK_PROFILES: Record<
  PlanBlockType,
  { durationMinutes: number; rpe: number }
> = {
  technical: { durationMinutes: 35, rpe: 5 },
  speed: { durationMinutes: 22, rpe: 7.5 },
  strength: { durationMinutes: 30, rpe: 7 },
  CNS_high: { durationMinutes: 24, rpe: 8 },
  metabolic: { durationMinutes: 26, rpe: 8.5 },
  conditioning: { durationMinutes: 32, rpe: 6.5 },
  recovery: { durationMinutes: 20, rpe: 2.5 },
  mobility: { durationMinutes: 18, rpe: 2.5 },
  activation: { durationMinutes: 14, rpe: 4 },
};

const DEFAULT_TRAINING_LOAD_PROFILE = { durationMinutes: 20, rpe: 5 };

export function isDeviceWorkoutLinkablePlanBlock(
  block: DeviceWorkoutLinkablePlanBlockInput,
) {
  const rowKind = block.rowKind ?? "exercise";

  if (rowKind === "workout") {
    return true;
  }

  if (rowKind !== "instruction") {
    return false;
  }

  return (
    DEVICE_WORKOUT_LINK_NAME_PATTERN.test(block.name) ||
    DEVICE_WORKOUT_IMPORT_MARKER_PATTERN.test(block.notes)
  );
}

function normalizeTrainingLoadNumber(
  value: number | null | undefined,
  maxValue: number,
) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  return value > 0 && value <= maxValue ? value : null;
}

function getTrainingLoadProfile(blockType: PlanBlockType | null | undefined) {
  return blockType && TRAINING_LOAD_BLOCK_PROFILES[blockType]
    ? TRAINING_LOAD_BLOCK_PROFILES[blockType]
    : DEFAULT_TRAINING_LOAD_PROFILE;
}

function getTrainingLoadPriorityFactor(blockPriority: number | null | undefined) {
  const priority = Number.isFinite(blockPriority ?? NaN)
    ? Math.min(Math.max(Number(blockPriority), 1), 5)
    : 1;

  return 0.7 + priority * 0.1;
}

function estimateTrainingExerciseLoad(
  exercise: TrainingLoadExerciseInput,
  fallbackRpe: number,
) {
  const durationMinutes = normalizeTrainingLoadNumber(
    exercise.targetDurationMinutes,
    240,
  );
  const rpe = normalizeTrainingLoadNumber(exercise.targetRpe, 10);

  if (durationMinutes === null) {
    return null;
  }

  return durationMinutes * (rpe ?? fallbackRpe);
}

export function estimateTrainingBlockLoad(block: TrainingLoadBlockInput) {
  if (
    block.rowKind === "instruction" ||
    block.rowKind === "control" ||
    block.rowKind === "note"
  ) {
    return 0;
  }

  const profile = getTrainingLoadProfile(block.blockType);
  const priorityFactor = getTrainingLoadPriorityFactor(block.blockPriority);
  const fallbackDurationMinutes = profile.durationMinutes * priorityFactor;
  const fallbackRpe = profile.rpe * priorityFactor;
  const durationMinutes = normalizeTrainingLoadNumber(
    block.targetDurationMinutes,
    240,
  );
  const rpe = normalizeTrainingLoadNumber(block.targetRpe, 10);

  if (durationMinutes !== null && rpe !== null) {
    return Number((durationMinutes * rpe).toFixed(1));
  }

  const exerciseLoads = (block.exercises ?? [])
    .map((exercise) => estimateTrainingExerciseLoad(exercise, fallbackRpe))
    .filter((value): value is number => value !== null);

  if (exerciseLoads.length) {
    return Number(
      exerciseLoads.reduce((sum, value) => sum + value, 0).toFixed(1),
    );
  }

  if (durationMinutes !== null) {
    return Number((durationMinutes * (rpe ?? fallbackRpe)).toFixed(1));
  }

  if (rpe !== null) {
    return Number((fallbackDurationMinutes * rpe).toFixed(1));
  }

  return Number((fallbackDurationMinutes * profile.rpe).toFixed(1));
}

function roundTrainingLoad(value: number, digits = 1) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : 0;
}

function hasTrainingExerciseActualValue(exercise: TrainingActualExerciseInput) {
  return Boolean(
    exercise.completed ||
      (exercise.setsCompleted !== null && exercise.setsCompleted !== undefined) ||
      (exercise.repsCompleted !== null && exercise.repsCompleted !== undefined) ||
      (exercise.durationMinutes !== null && exercise.durationMinutes !== undefined) ||
      (exercise.rpe !== null && exercise.rpe !== undefined),
  );
}

export function estimateTrainingActualLoad(input: TrainingActualLoadInput) {
  const plannedLoad = roundTrainingLoad(input.plannedLoad);

  if (
    input.durationMinutes !== null &&
    input.durationMinutes !== undefined &&
    input.rpe !== null &&
    input.rpe !== undefined
  ) {
    return roundTrainingLoad(input.durationMinutes * input.rpe);
  }

  if (input.completed) {
    return plannedLoad;
  }

  const exercises = input.exercises ?? [];

  if (!exercises.length || plannedLoad <= 0) {
    return 0;
  }

  const assignedExerciseCount = Math.max(
    1,
    input.assignedExerciseCount ?? exercises.length,
  );
  const completedExerciseCount = new Set(
    exercises
      .filter(hasTrainingExerciseActualValue)
      .map((exercise, index) => exercise.assignedExerciseId ?? `exercise-${index}`),
  ).size;

  return completedExerciseCount
    ? roundTrainingLoad(
        plannedLoad *
          (Math.min(completedExerciseCount, assignedExerciseCount) /
            assignedExerciseCount),
      )
    : 0;
}
