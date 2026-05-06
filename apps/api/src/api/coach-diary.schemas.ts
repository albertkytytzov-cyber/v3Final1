import type { CoachDiaryEntryPayload, CoachDiaryScope } from "@training-platform/shared";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function readRequiredId(value: unknown, fieldName: string) {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new Error(`${fieldName} is required`);
  }

  return value;
}

function readIdList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => typeof item === "string" ? item.trim() : "")
    .filter(Boolean)
    .map((item) => {
      if (!uuidPattern.test(item)) {
        throw new Error("Assigned diary task was not found for this plan");
      }

      return item;
    });
}

function readScope(value: unknown): CoachDiaryScope {
  return value === "tasks" ? "tasks" : "day";
}

export function parseCoachDiaryBody(body: unknown): CoachDiaryEntryPayload {
  const payload = (body ?? {}) as Partial<Record<keyof CoachDiaryEntryPayload, unknown>>;
  const scope = readScope(payload.scope);

  return {
    athleteId: readRequiredId(payload.athleteId, "athleteId"),
    assignedPlanId: readRequiredId(payload.assignedPlanId, "assignedPlanId"),
    entryDate: typeof payload.entryDate === "string" ? payload.entryDate : "",
    scope,
    notes: typeof payload.notes === "string" ? payload.notes : "",
    assignedBlockIds: scope === "tasks" ? readIdList(payload.assignedBlockIds) : [],
    assignedExerciseIds: scope === "tasks" ? readIdList(payload.assignedExerciseIds) : [],
  };
}
