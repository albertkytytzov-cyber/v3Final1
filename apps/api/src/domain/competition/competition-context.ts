import type { CompetitionContext } from "@training-platform/shared";
import type { CompetitionContextCandidate } from "./competition.types";
import {
  compareCompetitionContextCandidates,
  derivePreparationPhase,
  diffDays,
  isCompetitionContextCandidateRelevant,
} from "./competition-timeline.policy";

export function buildCompetitionContext(
  candidate: CompetitionContextCandidate | null,
  referenceDate: string,
): CompetitionContext | null {
  if (!candidate) {
    return null;
  }

  const daysToCompetition = diffDays(referenceDate, candidate.competitionStartDate);
  const phase = derivePreparationPhase(daysToCompetition);

  if (!phase) {
    return null;
  }

  return {
    competitionPlanId: candidate.competitionPlanId,
    competitionId: candidate.competitionId,
    daysToCompetition,
    competitionPriority: candidate.competitionPriority,
    phase,
    taperState: daysToCompetition >= 0 && daysToCompetition <= candidate.taperDays,
    weightCutState:
      candidate.weightCutRequired &&
      daysToCompetition >= 0 &&
      daysToCompetition <= Math.max(candidate.taperDays, 10),
  };
}

export function selectCompetitionContextCandidate(
  candidates: CompetitionContextCandidate[],
  referenceDate: string,
) {
  return candidates
    .filter((candidate) => isCompetitionContextCandidateRelevant(candidate, referenceDate))
    .sort((left, right) =>
      compareCompetitionContextCandidates(left, right, referenceDate),
    )[0] ?? null;
}

export function buildCompetitionContextFromCandidates(
  candidates: CompetitionContextCandidate[],
  referenceDate: string,
): CompetitionContext | null {
  return buildCompetitionContext(
    selectCompetitionContextCandidate(candidates, referenceDate),
    referenceDate,
  );
}
