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

function readEntryDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("entryDate must use YYYY-MM-DD format");
  }

  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== value) {
    throw new Error("entryDate must be a valid calendar date");
  }

  return value;
}

export function parseCoachDiaryBody(body: unknown): CoachDiaryEntryPayload {
  const payload = (body ?? {}) as Partial<Record<keyof CoachDiaryEntryPayload, unknown>>;
  const scope = readScope(payload.scope);

  return {
    athleteId: readRequiredId(payload.athleteId, "athleteId"),
    assignedPlanId: readRequiredId(payload.assignedPlanId, "assignedPlanId"),
    entryDate: readEntryDate(payload.entryDate),
    scope,
    notes: typeof payload.notes === "string" ? payload.notes : "",
    assignedBlockIds: scope === "tasks" ? readIdList(payload.assignedBlockIds) : [],
    assignedExerciseIds: scope === "tasks" ? readIdList(payload.assignedExerciseIds) : [],
  };
}
