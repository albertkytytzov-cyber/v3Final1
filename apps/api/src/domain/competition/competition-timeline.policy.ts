import type {
  CompetitionPriority,
  PreparationPhase,
} from "@training-platform/shared";
import type {
  CompetitionContextCandidate,
  CompetitionContextCandidateComparator,
} from "./competition.types";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function competitionPriorityRank(priority: CompetitionPriority | null) {
  if (priority === "A") {
    return 0;
  }

  if (priority === "B") {
    return 1;
  }

  return 2;
}

export function toDateKey(value: string | Date) {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  return value.toISOString().slice(0, 10);
}

export function startOfDay(value: string | Date) {
  const date =
    typeof value === "string" ? new Date(`${toDateKey(value)}T00:00:00Z`) : new Date(value);

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function shiftDate(dateText: string, dayOffset: number) {
  const date = startOfDay(dateText);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return toDateKey(date);
}

export function diffDays(from: string | Date, to: string | Date) {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_IN_MS);
}

export function derivePreparationPhase(daysToCompetition: number | null): PreparationPhase | null {
  if (daysToCompetition === null) {
    return null;
  }

  if (daysToCompetition > 30) {
    return "base";
  }

  if (daysToCompetition >= 15) {
    return "strength";
  }

  if (daysToCompetition >= 8) {
    return "specific";
  }

  if (daysToCompetition >= 2) {
    return "taper";
  }

  if (daysToCompetition >= 0) {
    return "competition";
  }

  if (daysToCompetition >= -7) {
    return "recovery";
  }

  return null;
}

export function isCompetitionContextCandidateRelevant(
  candidate: CompetitionContextCandidate,
  referenceDate: string,
) {
  const daysToCompetition = diffDays(referenceDate, candidate.competitionStartDate);
  const inPreparationWindow =
    referenceDate >= candidate.prepStartDate && referenceDate <= candidate.prepEndDate;
  const inUpcomingWindow = daysToCompetition >= 0 && daysToCompetition <= 60;
  const inRecoveryWindow = daysToCompetition <= 0 && daysToCompetition >= -7;

  return inPreparationWindow || inUpcomingWindow || inRecoveryWindow;
}

export function getCompetitionContextCandidateBucket(
  candidate: CompetitionContextCandidate,
  referenceDate: string,
) {
  const daysToCompetition = diffDays(referenceDate, candidate.competitionStartDate);

  if (referenceDate >= candidate.prepStartDate && referenceDate <= candidate.prepEndDate) {
    return 0;
  }

  if (daysToCompetition <= 0 && daysToCompetition >= -7) {
    return 1;
  }

  return 2;
}

export const compareCompetitionContextCandidates: CompetitionContextCandidateComparator = (
  left,
  right,
  referenceDate,
) => {
  const bucketDelta =
    getCompetitionContextCandidateBucket(left, referenceDate) -
    getCompetitionContextCandidateBucket(right, referenceDate);

  if (bucketDelta !== 0) {
    return bucketDelta;
  }

  const distanceDelta =
    Math.abs(diffDays(referenceDate, left.competitionStartDate)) -
    Math.abs(diffDays(referenceDate, right.competitionStartDate));

  if (distanceDelta !== 0) {
    return distanceDelta;
  }

  const priorityDelta =
    competitionPriorityRank(left.competitionPriority) -
    competitionPriorityRank(right.competitionPriority);

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  return left.competitionStartDate.localeCompare(right.competitionStartDate);
};
