import type {
  AnalyticsCoachActionDecision,
  AnalyticsCoachActionDecisionPayload,
  AnalyticsOverview,
  CoachAthleteProfilePayload,
  CoachAthleteSummary,
} from "@training-platform/shared";
import {
  buildAnalyticsCoachActionSnapshotFromOverview,
  buildAnalyticsOverviewForAthlete,
} from "./analytics-report.service";
import {
  attachAthleteToCoachUser,
  listCoachAthletesForUser,
  listAvailableAthletesForCoach,
  updateCoachAthleteProfile,
  upsertAnalyticsCoachActionDecision,
} from "./analytics-query.service";

export async function listCoachAthletes(input: {
  coachUserId: string;
  role: string;
}): Promise<CoachAthleteSummary[]> {
  return listCoachAthletesForUser(input);
}

export async function listAvailableCoachAthletes(): Promise<CoachAthleteSummary[]> {
  return listAvailableAthletesForCoach();
}

export async function attachCoachAthlete(input: {
  coachUserId: string;
  athleteId: string;
}) {
  return attachAthleteToCoachUser(input);
}

export async function saveCoachAthleteProfile(input: {
  athleteId: string;
  profile: CoachAthleteProfilePayload;
}): Promise<CoachAthleteSummary | null> {
  return updateCoachAthleteProfile(input);
}

export async function buildCoachAnalyticsOverview(
  athleteId: string,
): Promise<AnalyticsOverview | null> {
  return buildAnalyticsOverviewForAthlete(athleteId);
}

export async function saveCoachAnalyticsDecision(input: {
  athleteId: string;
  coachUserId: string;
  clientRequestId?: string | null;
  decision: AnalyticsCoachActionDecisionPayload;
}): Promise<{
  analytics: AnalyticsOverview | null;
  decision: AnalyticsCoachActionDecision | null;
}> {
  const analyticsBeforeSave = await buildAnalyticsOverviewForAthlete(input.athleteId);

  await upsertAnalyticsCoachActionDecision({
    ...input.decision,
    athleteId: input.athleteId,
    coachUserId: input.coachUserId,
    clientRequestId: input.clientRequestId ?? null,
    baselineSnapshot: buildAnalyticsCoachActionSnapshotFromOverview(analyticsBeforeSave),
  });

  const analytics = await buildAnalyticsOverviewForAthlete(input.athleteId);
  const decision =
    analytics?.decisionHistory.find(
      (item) =>
        item.suggestionId === input.decision.suggestionId &&
        item.weekStartDate === input.decision.weekStartDate,
    ) ?? null;

  return {
    analytics,
    decision,
  };
}
