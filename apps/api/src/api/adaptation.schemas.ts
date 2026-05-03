export function parseAdaptationAthleteParams(params: unknown): { athleteId: string } {
  const athleteId = (params as { athleteId?: unknown } | null)?.athleteId;

  if (typeof athleteId !== "string" || !athleteId) {
    throw new Error("athleteId is required");
  }

  return { athleteId };
}
