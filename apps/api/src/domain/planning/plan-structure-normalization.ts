import type {
  PlanBlockInput,
  PlanDeviceLinkMode,
  PlanSessionExecutionMode,
} from "@training-platform/shared";

type NormalizablePlanBlock = {
  name: string;
  rowKind?: PlanBlockInput["rowKind"];
  notes?: string;
  blockType?: PlanBlockInput["blockType"];
  displayOrder?: number;
  exercises?: Array<{
    name: string;
    notes?: string;
  }>;
};

type SingleBlockSession<TBlock extends NormalizablePlanBlock> = {
  id?: string;
  name: string;
  notes?: string;
  orderIndex?: number;
  displayOrder?: number;
  executionMode?: PlanSessionExecutionMode;
  deviceLinkMode?: PlanDeviceLinkMode;
  blocks: TBlock[];
};

const DEVICE_WORKOUT_NAME_PATTERN =
  /кросс|поход|бег|пано|кругов|трениров|спринт|ускор|отрез|интервал/u;

function isDescriptionPlanRow(block: Pick<NormalizablePlanBlock, "rowKind" | "name">) {
  const rowKind = block.rowKind ?? "exercise";
  const normalizedName = block.name.toLowerCase();

  return ["instruction", "control", "note"].includes(rowKind) ||
    /^(?:маршрут|дистанц|спуск|подъ[её]м|пульс|чсс|hr|rpe|темп|зона)/u.test(normalizedName);
}

function isRecoveryPlanRow(block: Pick<NormalizablePlanBlock, "rowKind" | "name">) {
  return (block.rowKind ?? "exercise") === "recovery" ||
    /^(?:после|замин|мобил|растяж|восстанов|прогул)/u.test(block.name.toLowerCase());
}

function isDeviceWorkoutPlanRow(block: Pick<NormalizablePlanBlock, "rowKind" | "name">) {
  return (block.rowKind ?? "exercise") === "workout" ||
    DEVICE_WORKOUT_NAME_PATTERN.test(block.name.toLowerCase());
}

function getWorkoutNameFromSession(sessionName: string) {
  const normalized = sessionName.replace(/\s+/g, " ").trim();
  const parts = normalized.split(/\s*[—–-]\s*/u).map((part) => part.trim()).filter(Boolean);

  return parts
    .slice()
    .reverse()
    .find((part) => DEVICE_WORKOUT_NAME_PATTERN.test(part.toLowerCase())) ??
    normalized;
}

function formatPlanDescriptionLine(block: NormalizablePlanBlock) {
  const notes = (block.notes ?? "").replace(/\s+/g, " ").trim();
  return notes ? `${block.name}: ${notes}` : block.name;
}

function mergePlanNotes(...values: Array<string | null | undefined>) {
  return values
    .flatMap((value) => (value ?? "").split(/\s*;\s*/u))
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((value, index, items) => items.indexOf(value) === index)
    .join("; ");
}

function normalizeDeviceWorkoutDescriptionSession<
  TBlock extends NormalizablePlanBlock,
  TSession extends SingleBlockSession<TBlock>,
>(session: TSession): TSession {
  const descriptionBlocks = session.blocks.filter(isDescriptionPlanRow);
  const recoveryBlocks = session.blocks.filter(isRecoveryPlanRow);
  const workoutBlocks = session.blocks.filter((block) =>
    isDeviceWorkoutPlanRow(block) && !isDescriptionPlanRow(block) && !isRecoveryPlanRow(block)
  );
  const otherBlocks = session.blocks.filter(
    (block) =>
      !isDescriptionPlanRow(block) &&
      !isRecoveryPlanRow(block) &&
      !workoutBlocks.includes(block),
  );

  if (descriptionBlocks.length === 0) {
    return workoutBlocks.length > 0
      ? { ...session, deviceLinkMode: "block" } as TSession
      : session;
  }

  const workoutName = getWorkoutNameFromSession(session.name);
  if (
    workoutBlocks.length === 0 &&
    !DEVICE_WORKOUT_NAME_PATTERN.test(workoutName.toLowerCase())
  ) {
    return session;
  }

  const description = descriptionBlocks.map(formatPlanDescriptionLine).join("; ");
  const sourceWorkout = workoutBlocks[0] ?? descriptionBlocks[0];
  const sourceWorkoutNotes = workoutBlocks[0] ? sourceWorkout.notes : null;
  const workoutBlock = {
    ...sourceWorkout,
    name: workoutBlocks[0]?.name ?? workoutName,
    rowKind: "workout",
    notes: mergePlanNotes(sourceWorkoutNotes, description),
    exercises: (sourceWorkout.exercises ?? []).map((exercise, exerciseIndex) =>
      exerciseIndex === 0
        ? {
            ...exercise,
            name: workoutBlocks[0]?.name ?? workoutName,
            notes: mergePlanNotes(workoutBlocks[0] ? exercise.notes : null, description),
          }
        : exercise,
    ),
    displayOrder: 0,
  } as TBlock;
  const extraWorkouts = workoutBlocks.slice(1);
  const nextBlocks = [workoutBlock, ...extraWorkouts, ...otherBlocks, ...recoveryBlocks]
    .map((block, index) => ({ ...block, displayOrder: index })) as TBlock[];

  return {
    ...session,
    executionMode: nextBlocks.length > 1 ? "by_blocks" : session.executionMode ?? "whole_session",
    deviceLinkMode: "block",
    blocks: nextBlocks,
  } as TSession;
}

function normalizeSingleBlockSessions<
  TBlock extends NormalizablePlanBlock,
  TSession extends SingleBlockSession<TBlock>,
>(sessions: TSession[]): TSession[] {
  if (sessions.length < 2 || sessions.some((session) => session.blocks.length !== 1)) {
    return sessions;
  }

  const commonBlockName = sessions[0]?.blocks[0]?.name ?? "";
  const hasSameBlockName = Boolean(commonBlockName) &&
    sessions.every((session) => session.blocks[0]?.name === commonBlockName);
  const sessionNamesAreRows = sessions.some((session) => session.name !== commonBlockName);

  if (!hasSameBlockName || !sessionNamesAreRows) {
    return sessions;
  }

  const firstSession = sessions[0];
  const mergedSession = {
    ...firstSession,
    name: commonBlockName,
    notes: sessions.map((session) => session.notes).filter(Boolean).join(" / "),
    orderIndex: firstSession.orderIndex ?? 0,
    displayOrder: firstSession.displayOrder ?? 0,
    executionMode: "whole_session",
    deviceLinkMode: "session",
    blocks: sessions.map((session, index) => ({
      ...session.blocks[0],
      name: session.name || session.blocks[0].name,
      displayOrder: index,
    })),
  } as TSession;

  return [normalizeDeviceWorkoutDescriptionSession(mergedSession)];
}

export function normalizePlanDeviceWorkoutSessions<
  TBlock extends NormalizablePlanBlock,
  TSession extends SingleBlockSession<TBlock>,
>(sessions: TSession[]): TSession[] {
  return normalizeSingleBlockSessions(sessions).map(normalizeDeviceWorkoutDescriptionSession);
}
