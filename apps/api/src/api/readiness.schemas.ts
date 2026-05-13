import type {
  ReadinessFormValues,
  ReadinessSubmissionPayload,
} from "@training-platform/shared";

function parseReadinessDate(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("entryDate must use YYYY-MM-DD format");
  }

  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== value) {
    throw new Error("entryDate must be a valid calendar date");
  }

  const today = new Date().toISOString().slice(0, 10);
  if (value > today) {
    throw new Error("entryDate cannot be in the future");
  }

  return value;
}

export function parseReadinessBody(body: unknown): ReadinessSubmissionPayload {
  const payload = (body ?? {}) as Partial<Record<keyof ReadinessSubmissionPayload, unknown>>;
  const values: ReadinessFormValues = {
    sleepHours: Number(payload.sleepHours),
    sleepQuality: Number(payload.sleepQuality),
    generalFeeling: Number(payload.generalFeeling),
    fatigueLevel: Number(payload.fatigueLevel),
    muscleSoreness: Number(payload.muscleSoreness),
    motivationLevel: Number(payload.motivationLevel),
    restingHr: Number(payload.restingHr),
    bodyWeight: Number(payload.bodyWeight),
    painLevel: Number(payload.painLevel),
    illnessFlag: Boolean(payload.illnessFlag),
    feverFlag: Boolean(payload.feverFlag),
  };

  if (
    Object.values(values).some(
      (value) => typeof value === "number" && Number.isNaN(value),
    )
  ) {
    throw new Error("All numeric readiness fields are required");
  }

  return {
    ...values,
    entryDate: parseReadinessDate(payload.entryDate),
  };
}

export function parseReadinessAthleteParams(params: unknown): { athleteId: string } {
  const athleteId = (params as { athleteId?: unknown } | null)?.athleteId;

  if (typeof athleteId !== "string" || !athleteId) {
    throw new Error("athleteId is required");
  }

  return { athleteId };
}

export function parseReadinessDateQuery(query: unknown): { entryDate: string } {
  const entryDate = parseReadinessDate((query as { date?: unknown } | null)?.date);

  if (!entryDate) {
    throw new Error("date is required");
  }

  return { entryDate };
}

export function parseOptionalReadinessDateQuery(query: unknown): { entryDate?: string } {
  const entryDate = parseReadinessDate(
    (query as { entryDate?: unknown } | null)?.entryDate,
  );

  return entryDate ? { entryDate } : {};
}
