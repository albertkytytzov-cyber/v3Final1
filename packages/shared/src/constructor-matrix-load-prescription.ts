import type { ConstructorInput, ConstructorPlanExercise } from "./constructor-core";
import type { MatrixDrivenSelectedBlock } from "./constructor-matrix-plan-builder";
import type {
  ConstructorMatrixExercise,
  ConstructorMatrixExerciseLoadPrescriptionMode,
} from "./constructor-matrix-exercise-library";

export type ConstructorMatrixStrengthLoadContext = {
  trainingMaxKgByExerciseId?: Readonly<Record<string, number>>;
  estimatedOneRepMaxKgByExerciseId?: Readonly<Record<string, number>>;
};

export type ConstructorMatrixLoadPrescriptionInput = {
  exercise: ConstructorMatrixExercise;
  block: MatrixDrivenSelectedBlock;
  input: ConstructorInput;
  displayOrder: number;
  strengthLoadContext?: ConstructorMatrixStrengthLoadContext;
};

export type ConstructorMatrixLoadPrescription = ConstructorPlanExercise & {
  sourceExerciseId: string;
  loadPrescriptionMode: ConstructorMatrixExerciseLoadPrescriptionMode;
  coachEditable: true;
  loadLocked: false;
  calculationNotes: readonly string[];
  reviewRequired: readonly string[];
  highRiskAutomationBlocked: boolean;
};

const LOAD_LEVEL_RPE: Record<MatrixDrivenSelectedBlock["volume"]["loadLevel"], number> = {
  very_low: 2,
  low: 4,
  medium: 6,
  high: 7,
};

const COMPETITION_PROXIMITY_RPE_CAPS = [
  { maxDays: 4, cap: 4 },
  { maxDays: 10, cap: 5 },
  { maxDays: 21, cap: 6 },
] as const;

function roundHalf(value: number) {
  return Math.round(value * 2) / 2;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function capRpeForContext(
  rpe: number | null,
  input: ConstructorInput,
  block: MatrixDrivenSelectedBlock,
) {
  if (rpe === null) {
    return null;
  }

  let capped = rpe;

  for (const item of COMPETITION_PROXIMITY_RPE_CAPS) {
    if (block.volume.recoveryPriority === "primary") {
      capped = Math.min(capped, item.cap);
      break;
    }

    if (input.context.cycleLengthDays <= item.maxDays) {
      capped = Math.min(capped, item.cap);
      break;
    }
  }

  if (input.constraints?.travelFatigue || input.constraints?.injuryCaution) {
    capped = Math.min(capped, 5);
  }

  if (input.constraints?.weightCutActive) {
    capped = Math.min(capped, 4);
  }

  return roundHalf(clamp(capped, 1, 10));
}

function getStrengthReferenceKg(
  exerciseId: string,
  context?: ConstructorMatrixStrengthLoadContext,
) {
  return (
    context?.trainingMaxKgByExerciseId?.[exerciseId] ??
    context?.estimatedOneRepMaxKgByExerciseId?.[exerciseId] ??
    null
  );
}

function strengthLoadCandidateFor(
  exercise: ConstructorMatrixExercise,
  context?: ConstructorMatrixStrengthLoadContext,
) {
  if (
    exercise.loadPrescriptionMode !== "percent_1rm_candidate" &&
    exercise.loadPrescriptionMode !== "e1rm_based_candidate" &&
    exercise.loadPrescriptionMode !== "velocity_based_candidate"
  ) {
    return { targetWeightKg: null, note: "no strength max needed for this exercise" };
  }

  const reference = getStrengthReferenceKg(exercise.id, context);

  if (!reference || !Number.isFinite(reference) || reference <= 0) {
    return {
      targetWeightKg: null,
      note: "no athlete training max/e1RM available; use RPE/technical quality only",
    };
  }

  return {
    targetWeightKg: Number((reference * 0.7).toFixed(1)),
    note: "coach-editable candidate from athlete training max/e1RM; not a medical threshold",
  };
}

function auditPrescriptionNotes(params: {
  exercise: ConstructorMatrixExercise;
  block: MatrixDrivenSelectedBlock;
  input: ConstructorInput;
  strengthNote: string;
}) {
  const notes = [
    params.exercise.defaultPrescription.notes,
    params.strengthNote,
    `mode=${params.exercise.loadPrescriptionMode}`,
    "coachEditable=true",
    "loadLocked=false",
    "not medical advice",
  ];

  if (params.exercise.reviewRequired.length) {
    notes.push(`reviewRequired=${params.exercise.reviewRequired.join(",")}`);
  }

  if (params.exercise.highRiskAutomationBlocked) {
    notes.push("high-risk automation blocked");
  }

  if (params.input.constraints?.injuryCaution || params.input.state.painLevel) {
    notes.push("pain/injury context requires coach or medical review before progression");
  }

  if (params.input.constraints?.weightCutActive) {
    notes.push("weight-management context is review-required; no rapid weight-cut protocol");
  }

  if (params.block.volume.recoveryPriority === "primary") {
    notes.push("recovery priority caps intensity and volume");
  }

  return notes;
}

function coachFacingPrescriptionNotes(params: {
  exercise: ConstructorMatrixExercise;
  strengthNote: string;
}) {
  const notes = [params.exercise.defaultPrescription.notes];

  if (params.strengthNote.includes("training max/e1RM")) {
    notes.push("если рабочий максимум не задан, использовать RPE и качество техники");
  } else if (params.strengthNote.includes("coach-editable candidate")) {
    notes.push("вес рассчитан как тренерский кандидат и редактируется перед применением");
  }

  if (params.exercise.highRiskAutomationBlocked) {
    notes.push("только как review-required блок, без автоматического назначения");
  } else if (params.exercise.reviewRequired.length) {
    notes.push("требует тренерской проверки перед повышением объёма");
  }

  return notes.filter(Boolean);
}

export function buildConstructorMatrixLoadPrescription(
  params: ConstructorMatrixLoadPrescriptionInput,
): ConstructorMatrixLoadPrescription {
  const { exercise, block, input, displayOrder, strengthLoadContext } = params;
  const base = exercise.defaultPrescription;
  const fallbackRpe = LOAD_LEVEL_RPE[block.volume.loadLevel] ?? 5;
  const targetRpe = capRpeForContext(base.targetRpe ?? fallbackRpe, input, block);
  const strength = strengthLoadCandidateFor(exercise, strengthLoadContext);
  const calculationNotes = auditPrescriptionNotes({
    exercise,
    block,
    input,
    strengthNote: strength.note,
  });
  const notes = coachFacingPrescriptionNotes({
    exercise,
    strengthNote: strength.note,
  });

  return {
    sourceExerciseId: exercise.id,
    loadPrescriptionMode: exercise.loadPrescriptionMode,
    name: exercise.name,
    targetSets: base.sets,
    targetReps: base.reps,
    targetWeightKg: strength.targetWeightKg,
    targetDurationMinutes: base.durationMinutes,
    targetRpe,
    notes: notes.join(" · "),
    displayOrder,
    coachEditable: true,
    loadLocked: false,
    calculationNotes,
    reviewRequired: exercise.reviewRequired,
    highRiskAutomationBlocked: exercise.highRiskAutomationBlocked,
  };
}

export function buildConstructorMatrixLoadPrescriptionSummary(
  prescriptions: readonly ConstructorMatrixLoadPrescription[],
) {
  return {
    prescriptionCount: prescriptions.length,
    coachEditableCount: prescriptions.filter((item) => item.coachEditable).length,
    loadLockedCount: prescriptions.filter((item) => item.loadLocked).length,
    strengthWeightCandidateCount: prescriptions.filter(
      (item) => item.targetWeightKg !== null,
    ).length,
    missingStrengthMaxFallbackCount: prescriptions.filter((item) =>
      item.calculationNotes.some((note) => note.includes("no athlete training max/e1RM")),
    ).length,
    highRiskAutomationBlockedCount: prescriptions.filter(
      (item) => item.highRiskAutomationBlocked,
    ).length,
  };
}
