import type {
  AnalyticsCoachActionDecisionPayload,
  CoachAthleteProfilePayload,
} from "@training-platform/shared";

function toNullableString(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value);
}

function toText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : null;
}

function parseNullableNumber(
  fieldName: string,
  value: unknown,
  min: number,
  max: number,
) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  if (typeof value !== "number" && typeof value !== "string") {
    throw new Error(`${fieldName} must be a number or null`);
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    throw new Error(`${fieldName} must be a valid number`);
  }

  if (numericValue < min || numericValue > max) {
    throw new Error(`${fieldName} must be between ${min} and ${max}`);
  }

  return numericValue;
}

function parseBirthDate(value: unknown) {
  const rawDate = toNullableString(value);

  if (rawDate === null) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    throw new Error("birthDate must be a valid date in YYYY-MM-DD format");
  }

  const [year, month, day] = rawDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("birthDate must be a valid date in YYYY-MM-DD format");
  }

  const today = new Date();
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );

  if (date.getTime() > todayUtc) {
    throw new Error("birthDate cannot be in the future");
  }

  return rawDate;
}

export function parseAnalyticsAthleteParams(params: unknown): { athleteId: string } {
  const athleteId = (params as { athleteId?: unknown } | null)?.athleteId;

  if (typeof athleteId !== "string" || !athleteId) {
    throw new Error("athleteId is required");
  }

  return { athleteId };
}

export function parseAnalyticsDecisionBody(body: unknown): AnalyticsCoachActionDecisionPayload {
  const payload = (body ?? {}) as Partial<
    Record<keyof AnalyticsCoachActionDecisionPayload, unknown>
  >;

  return {
    suggestionId: typeof payload.suggestionId === "string" ? payload.suggestionId : "",
    suggestionTitle: typeof payload.suggestionTitle === "string" ? payload.suggestionTitle : "",
    suggestionLevel:
      (payload.suggestionLevel ?? "") as AnalyticsCoachActionDecisionPayload["suggestionLevel"],
    sourceCode:
      (payload.sourceCode ?? "") as AnalyticsCoachActionDecisionPayload["sourceCode"],
    weekStartDate: typeof payload.weekStartDate === "string" ? payload.weekStartDate : "",
    weekLabel: toNullableString(payload.weekLabel),
    decisionStatus:
      (payload.decisionStatus ?? "") as AnalyticsCoachActionDecisionPayload["decisionStatus"],
    plannerBridge:
      (payload.plannerBridge ?? null) as AnalyticsCoachActionDecisionPayload["plannerBridge"],
    decisionNotes: typeof payload.decisionNotes === "string" ? payload.decisionNotes : "",
    outcome:
      payload.outcome === undefined
        ? undefined
        : payload.outcome === null
          ? null
          : (payload.outcome as AnalyticsCoachActionDecisionPayload["outcome"]),
    outcomeNotes: typeof payload.outcomeNotes === "string" ? payload.outcomeNotes : "",
  };
}

export function parseCoachAthleteProfileBody(body: unknown): CoachAthleteProfilePayload {
  const payload = (body ?? {}) as Partial<Record<keyof CoachAthleteProfilePayload, unknown>>;
  const birthDate = parseBirthDate(payload.birthDate);

  return {
    photoUrl: toText(payload.photoUrl),
    birthDate,
    heightCm: parseNullableNumber("heightCm", payload.heightCm, 80, 230),
    sport: toText(payload.sport),
    discipline: toText(payload.discipline),
    weightClass: toText(payload.weightClass),
    dominantSide: toText(payload.dominantSide),
    baselineRestingHr: parseNullableNumber(
      "baselineRestingHr",
      payload.baselineRestingHr,
      30,
      120,
    ),
    baselineWeightKg: parseNullableNumber(
      "baselineWeightKg",
      payload.baselineWeightKg,
      20,
      200,
    ),
    wrestlingExperienceYears: parseNullableNumber(
      "wrestlingExperienceYears",
      payload.wrestlingExperienceYears,
      0,
      50,
    ),
    strengthSquatKg: parseNullableNumber("strengthSquatKg", payload.strengthSquatKg, 0, 400),
    strengthBenchPressKg: parseNullableNumber(
      "strengthBenchPressKg",
      payload.strengthBenchPressKg,
      0,
      300,
    ),
    strengthDeadliftKg: parseNullableNumber(
      "strengthDeadliftKg",
      payload.strengthDeadliftKg,
      0,
      450,
    ),
    strengthPullUpsMax: parseNullableNumber(
      "strengthPullUpsMax",
      payload.strengthPullUpsMax,
      0,
      100,
    ),
    strengthGripLeftKg: parseNullableNumber(
      "strengthGripLeftKg",
      payload.strengthGripLeftKg,
      0,
      150,
    ),
    strengthGripRightKg: parseNullableNumber(
      "strengthGripRightKg",
      payload.strengthGripRightKg,
      0,
      150,
    ),
    strengthNotes: toText(payload.strengthNotes),
    strengths: toText(payload.strengths),
    weaknesses: toText(payload.weaknesses),
    injuriesOrRestrictions: toText(payload.injuriesOrRestrictions),
    preparationGoal: toText(payload.preparationGoal),
    profileNotes: toText(payload.profileNotes),
  };
}
