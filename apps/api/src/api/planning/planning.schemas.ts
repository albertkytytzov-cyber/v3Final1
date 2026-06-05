import {
  PLAN_BLOCK_ROW_KINDS,
  PLAN_DEVICE_LINK_MODES,
  PLAN_SESSION_EXECUTION_MODES,
} from "@training-platform/shared";
import type {
  AssignedPlanPayload,
  AutoAssignMicrocyclePayload,
  ConstructorInput,
  PlanBlockInput,
  PlanDayInput,
  PlanExerciseInput,
  PlanTemplatePayload,
} from "@training-platform/shared";

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? null : numberValue;
}

function readEnumValue<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fallback: T,
) {
  return typeof value === "string" && allowedValues.includes(value as T)
    ? (value as T)
    : fallback;
}

function toBlockInput(value: unknown): PlanBlockInput {
  const block = (value ?? {}) as Partial<Record<keyof PlanBlockInput, unknown>>;

  return {
    name: typeof block.name === "string" ? block.name : "",
    rowKind: readEnumValue(block.rowKind, PLAN_BLOCK_ROW_KINDS, "exercise"),
    blockType: (block.blockType ?? "") as PlanBlockInput["blockType"],
    blockPriority: Number(block.blockPriority ?? 1),
    isMandatory: Boolean(block.isMandatory),
    removePriorityYellow: Number(block.removePriorityYellow ?? 5),
    removePriorityRed: Number(block.removePriorityRed ?? 5),
    reductionPercentYellow: Number(block.reductionPercentYellow ?? 0),
    reductionPercentRed: Number(block.reductionPercentRed ?? 0),
    targetDurationMinutes: toNullableNumber(block.targetDurationMinutes),
    targetRpe: toNullableNumber(block.targetRpe),
    targetSets: toNullableNumber(block.targetSets),
    targetReps: toNullableNumber(block.targetReps),
    notes: typeof block.notes === "string" ? block.notes : "",
    replacementBlockId:
      typeof block.replacementBlockId === "string" ? block.replacementBlockId : null,
    exercises: Array.isArray(block.exercises)
      ? block.exercises.map(toExerciseInput)
      : undefined,
  };
}

function toExerciseInput(value: unknown): PlanExerciseInput {
  const exercise = (value ?? {}) as Partial<Record<keyof PlanExerciseInput, unknown>>;

  return {
    id: typeof exercise.id === "string" ? exercise.id : undefined,
    name: typeof exercise.name === "string" ? exercise.name : "",
    targetSets: toNullableNumber(exercise.targetSets),
    targetReps: toNullableNumber(exercise.targetReps),
    targetWeightKg: toNullableNumber(exercise.targetWeightKg),
    targetDurationMinutes: toNullableNumber(exercise.targetDurationMinutes),
    targetRpe: toNullableNumber(exercise.targetRpe),
    notes: typeof exercise.notes === "string" ? exercise.notes : "",
  };
}

function toDayInput(value: unknown): PlanDayInput {
  const day = (value ?? {}) as Partial<Record<keyof PlanDayInput, unknown>>;
  const sessions = Array.isArray(day.sessions)
    ? day.sessions.map((session, index) => {
        const sessionValue = session as {
          id?: unknown;
          name?: unknown;
          notes?: unknown;
          orderIndex?: unknown;
          executionMode?: unknown;
          deviceLinkMode?: unknown;
          blocks?: unknown;
        };

        return {
          id: typeof sessionValue.id === "string" ? sessionValue.id : undefined,
          name: typeof sessionValue.name === "string" ? sessionValue.name : "",
          notes: typeof sessionValue.notes === "string" ? sessionValue.notes : "",
          orderIndex: Number(sessionValue.orderIndex ?? index),
          executionMode: readEnumValue(
            sessionValue.executionMode,
            PLAN_SESSION_EXECUTION_MODES,
            "whole_session",
          ),
          deviceLinkMode: readEnumValue(
            sessionValue.deviceLinkMode,
            PLAN_DEVICE_LINK_MODES,
            "session",
          ),
          blocks: Array.isArray(sessionValue.blocks)
            ? sessionValue.blocks.map(toBlockInput)
            : [],
        };
      })
    : [];

  return {
    id: typeof day.id === "string" ? day.id : undefined,
    label: typeof day.label === "string" ? day.label : "",
    notes: typeof day.notes === "string" ? day.notes : "",
    orderIndex: Number(day.orderIndex ?? 0),
    sessions,
  };
}

export function parsePlanTemplateBody(body: unknown): PlanTemplatePayload {
  const payload = (body ?? {}) as Partial<Record<keyof PlanTemplatePayload, unknown>>;
  const blocks = Array.isArray(payload.blocks) ? payload.blocks.map(toBlockInput) : [];
  const days = Array.isArray(payload.days) ? payload.days.map(toDayInput) : undefined;

  return {
    name: typeof payload.name === "string" ? payload.name : "",
    description: typeof payload.description === "string" ? payload.description : "",
    sportType: typeof payload.sportType === "string" ? payload.sportType : "",
    phaseFocus: (payload.phaseFocus ?? null) as PlanTemplatePayload["phaseFocus"],
    competitionPriorityFocus:
      (payload.competitionPriorityFocus ?? null) as PlanTemplatePayload["competitionPriorityFocus"],
    templateGoal: typeof payload.templateGoal === "string" ? payload.templateGoal : "",
    microcycleType: typeof payload.microcycleType === "string" ? payload.microcycleType : "",
    competitionSpecific: Boolean(payload.competitionSpecific),
    blocks,
    days,
  };
}

export function parseAssignedPlanBody(body: unknown): AssignedPlanPayload {
  const payload = (body ?? {}) as Partial<Record<keyof AssignedPlanPayload, unknown>>;

  return {
    athleteId: typeof payload.athleteId === "string" ? payload.athleteId : "",
    templateId: typeof payload.templateId === "string" ? payload.templateId : "",
    startDate: typeof payload.startDate === "string" ? payload.startDate : "",
    dayLabel: typeof payload.dayLabel === "string" ? payload.dayLabel : "",
    notes: typeof payload.notes === "string" ? payload.notes : "",
    plannedPhase: (payload.plannedPhase ?? null) as AssignedPlanPayload["plannedPhase"],
  };
}

export function parseAutoAssignMicrocycleBody(body: unknown): AutoAssignMicrocyclePayload {
  const payload = (body ?? {}) as Partial<
    Record<keyof AutoAssignMicrocyclePayload, unknown>
  >;
  const items = Array.isArray(payload.items)
    ? payload.items.map((item) => {
        const value = item as Partial<AutoAssignMicrocyclePayload["items"][number]>;

        return {
          templateId: typeof value.templateId === "string" ? value.templateId : "",
          dayOffset: Number(value.dayOffset ?? 0),
          dayLabel: typeof value.dayLabel === "string" ? value.dayLabel : "",
          microcycleType:
            typeof value.microcycleType === "string" ? value.microcycleType : "",
          templateDayIndex:
            value.templateDayIndex === undefined || value.templateDayIndex === null
              ? undefined
              : Number(value.templateDayIndex),
        };
      })
    : [];

  return {
    athleteId: typeof payload.athleteId === "string" ? payload.athleteId : "",
    startDate: typeof payload.startDate === "string" ? payload.startDate : "",
    daysCount: Number(payload.daysCount ?? items.length),
    notes: typeof payload.notes === "string" ? payload.notes : "",
    plannedPhase:
      (payload.plannedPhase ?? null) as AutoAssignMicrocyclePayload["plannedPhase"],
    items,
  };
}

export function parsePlanningAthleteDateQuery(
  query: unknown,
): { athleteId: string; date?: string } {
  const payload = query as { athleteId?: unknown; date?: unknown } | null;
  const athleteId = payload?.athleteId;
  const date = payload?.date;

  if (typeof athleteId !== "string" || !athleteId) {
    throw new Error("athleteId is required");
  }

  return {
    athleteId,
    date: typeof date === "string" && date ? date : undefined,
  };
}

export function parseTemplatePackQuery(
  query: unknown,
): { athleteId: string; startDate?: string } {
  const payload = query as { athleteId?: unknown; startDate?: unknown } | null;
  const athleteId = payload?.athleteId;
  const startDate = payload?.startDate;

  if (typeof athleteId !== "string" || !athleteId) {
    throw new Error("athleteId is required");
  }

  return {
    athleteId,
    startDate: typeof startDate === "string" && startDate ? startDate : undefined,
  };
}

export function parseConstructorDraftBody(body: unknown): ConstructorInput {
  const payload = (body ?? {}) as Partial<ConstructorInput>;

  if (!payload.competition || !payload.athlete || !payload.context || !payload.state) {
    throw new Error("competition, athlete, context and state are required");
  }

  if (!Array.isArray(payload.goals) || payload.goals.length === 0) {
    throw new Error("At least one constructor goal is required");
  }

  if (!payload.athlete.athleteId) {
    throw new Error("athlete.athleteId is required");
  }

  return {
    competition: payload.competition,
    athlete: payload.athlete,
    context: payload.context,
    goals: payload.goals,
    tests: payload.tests ?? {},
    state: payload.state,
    constraints: payload.constraints ?? {},
  };
}
