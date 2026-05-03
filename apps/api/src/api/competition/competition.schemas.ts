import type {
  CompetitionResultPayload,
  CreateCompetitionPayload,
  CreateCompetitionPlanPayload,
  CreateMesocyclePayload,
  CreateOlympicCyclePayload,
  CreateSeasonPayload,
  DeleteCompetitionsPayload,
  UwwEventSyncFilters,
} from "@training-platform/shared";

function toNullableString(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value);
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? null : numberValue;
}

export function parseCompetitionAthleteParams(params: unknown): { athleteId: string } {
  const athleteId = (params as { athleteId?: unknown } | null)?.athleteId;

  if (typeof athleteId !== "string" || !athleteId) {
    throw new Error("athleteId is required");
  }

  return { athleteId };
}

export function parseCompetitionParams(params: unknown): { competitionId: string } {
  const competitionId = (params as { competitionId?: unknown } | null)?.competitionId;

  if (typeof competitionId !== "string" || !competitionId) {
    throw new Error("competitionId is required");
  }

  return { competitionId };
}

export function parseCompetitionPlanParams(params: unknown): { competitionPlanId: string } {
  const competitionPlanId = (params as { competitionPlanId?: unknown } | null)?.competitionPlanId;

  if (typeof competitionPlanId !== "string" || !competitionPlanId) {
    throw new Error("competitionPlanId is required");
  }

  return { competitionPlanId };
}

export function parseCompetitionAthleteQuery(query: unknown): { athleteId?: string } {
  const athleteId = (query as { athleteId?: unknown } | null)?.athleteId;

  if (athleteId === undefined || athleteId === null || athleteId === "") {
    return {};
  }

  if (typeof athleteId !== "string") {
    throw new Error("athleteId must be a string");
  }

  return { athleteId };
}

export function parseCreateCompetitionBody(body: unknown): CreateCompetitionPayload {
  const payload = (body ?? {}) as Partial<Record<keyof CreateCompetitionPayload, unknown>>;

  return {
    title: typeof payload.title === "string" ? payload.title : "",
    federation: typeof payload.federation === "string" ? payload.federation : "",
    location: typeof payload.location === "string" ? payload.location : "",
    startDate: typeof payload.startDate === "string" ? payload.startDate : "",
    endDate: typeof payload.endDate === "string" ? payload.endDate : "",
    level: (payload.level ?? "") as CreateCompetitionPayload["level"],
    ageGroup: typeof payload.ageGroup === "string" ? payload.ageGroup : "",
    description: typeof payload.description === "string" ? payload.description : "",
  };
}

export function parseUwwEventSyncFilters(body: unknown): UwwEventSyncFilters {
  const payload = (body ?? {}) as Partial<Record<keyof UwwEventSyncFilters, unknown>>;

  return {
    year: typeof payload.year === "string" ? payload.year : "",
    ageGroup: typeof payload.ageGroup === "string" ? payload.ageGroup : "",
    style: typeof payload.style === "string" ? payload.style : "",
    eventType: typeof payload.eventType === "string" ? payload.eventType : "",
    country: typeof payload.country === "string" ? payload.country : "",
  };
}

export function parseDeleteCompetitionsBody(body: unknown): DeleteCompetitionsPayload {
  const payload = (body ?? {}) as Partial<Record<keyof DeleteCompetitionsPayload, unknown>>;
  const rawIds = Array.isArray(payload.competitionIds) ? payload.competitionIds : [];

  return {
    competitionIds: [
      ...new Set(rawIds.filter((value): value is string => typeof value === "string" && Boolean(value))),
    ],
  };
}

export function parseCreateOlympicCycleBody(body: unknown): CreateOlympicCyclePayload {
  const payload = (body ?? {}) as Partial<Record<keyof CreateOlympicCyclePayload, unknown>>;

  return {
    name: typeof payload.name === "string" ? payload.name : "",
    startDate: typeof payload.startDate === "string" ? payload.startDate : "",
    endDate: typeof payload.endDate === "string" ? payload.endDate : "",
    targetEvent: typeof payload.targetEvent === "string" ? payload.targetEvent : "",
    description: typeof payload.description === "string" ? payload.description : "",
  };
}

export function parseCreateSeasonBody(body: unknown): CreateSeasonPayload {
  const payload = (body ?? {}) as Partial<Record<keyof CreateSeasonPayload, unknown>>;

  return {
    athleteId: typeof payload.athleteId === "string" ? payload.athleteId : "",
    olympicCycleId: toNullableString(payload.olympicCycleId),
    year: Number(payload.year ?? 0),
    name: typeof payload.name === "string" ? payload.name : "",
    goal: typeof payload.goal === "string" ? payload.goal : "",
    strategyType: (payload.strategyType ?? "") as CreateSeasonPayload["strategyType"],
  };
}

export function parseCreateMesocycleBody(body: unknown): CreateMesocyclePayload {
  const payload = (body ?? {}) as Partial<Record<keyof CreateMesocyclePayload, unknown>>;

  return {
    athleteId: typeof payload.athleteId === "string" ? payload.athleteId : "",
    seasonId: toNullableString(payload.seasonId),
    competitionPlanId: toNullableString(payload.competitionPlanId),
    name: typeof payload.name === "string" ? payload.name : "",
    phase: (payload.phase ?? "") as CreateMesocyclePayload["phase"],
    goal: typeof payload.goal === "string" ? payload.goal : "",
    progressionType:
      (payload.progressionType ?? "") as CreateMesocyclePayload["progressionType"],
    startDate: typeof payload.startDate === "string" ? payload.startDate : "",
    endDate: typeof payload.endDate === "string" ? payload.endDate : "",
    weeksCount: Number(payload.weeksCount ?? 0),
    notes: typeof payload.notes === "string" ? payload.notes : "",
  };
}

export function parseCreateCompetitionPlanBody(
  body: unknown,
): CreateCompetitionPlanPayload {
  const payload = (body ?? {}) as Partial<
    Record<keyof CreateCompetitionPlanPayload, unknown>
  >;

  return {
    athleteId: typeof payload.athleteId === "string" ? payload.athleteId : "",
    seasonId: toNullableString(payload.seasonId),
    competitionId: typeof payload.competitionId === "string" ? payload.competitionId : "",
    priority: (payload.priority ?? "") as CreateCompetitionPlanPayload["priority"],
    planType: (payload.planType ?? "") as CreateCompetitionPlanPayload["planType"],
    peakRequired: Boolean(payload.peakRequired),
    taperDays: Number(payload.taperDays ?? 0),
    weightCutRequired: Boolean(payload.weightCutRequired),
    targetWeight: toNullableNumber(payload.targetWeight),
    currentWeight: toNullableNumber(payload.currentWeight),
    expectedMatches: toNullableNumber(payload.expectedMatches),
    competitionFormat:
      typeof payload.competitionFormat === "string" ? payload.competitionFormat : "",
    prepStartDate:
      typeof payload.prepStartDate === "string" ? payload.prepStartDate : "",
    prepEndDate: typeof payload.prepEndDate === "string" ? payload.prepEndDate : "",
    notes: typeof payload.notes === "string" ? payload.notes : "",
  };
}

export function parseCompetitionResultBody(body: unknown): CompetitionResultPayload {
  const payload = (body ?? {}) as Partial<Record<keyof CompetitionResultPayload, unknown>>;

  return {
    competitionPlanId:
      typeof payload.competitionPlanId === "string" ? payload.competitionPlanId : "",
    finalPlace: toNullableNumber(payload.finalPlace),
    matchesCount: toNullableNumber(payload.matchesCount),
    weightAtWeighIn: toNullableNumber(payload.weightAtWeighIn),
    weightAfter: toNullableNumber(payload.weightAfter),
    performanceNotes:
      typeof payload.performanceNotes === "string" ? payload.performanceNotes : "",
    coachNotes: typeof payload.coachNotes === "string" ? payload.coachNotes : "",
  };
}
