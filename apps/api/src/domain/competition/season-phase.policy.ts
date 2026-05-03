import type {
  CompetitionReviewOverview,
  CompetitionPlanSummary,
} from "@training-platform/shared";
import type { CompetitionReviewInput } from "./competition.types";

export function buildCompetitionReviewOverviewFromPlans(
  input: CompetitionReviewInput,
): CompetitionReviewOverview {
  const seasonsMap = new Map<string, CompetitionReviewOverview["seasons"][number]>();
  const unlinkedPlans: CompetitionPlanSummary[] = [];

  for (const plan of input.plans) {
    if (!plan.seasonId) {
      unlinkedPlans.push(plan);
      continue;
    }

    const existing = seasonsMap.get(plan.seasonId);

    if (existing) {
      existing.plans.push(plan);
      continue;
    }

    seasonsMap.set(plan.seasonId, {
      seasonId: plan.seasonId,
      seasonName: plan.seasonName ?? "Unnamed season",
      seasonYear: plan.seasonYear,
      athleteId: plan.athleteId,
      athleteName: plan.athleteName,
      plans: [plan],
    });
  }

  return {
    athleteId: input.athleteId,
    athleteName: input.athleteName,
    seasons: Array.from(seasonsMap.values()).sort((left, right) => {
      const leftYear = left.seasonYear ?? 0;
      const rightYear = right.seasonYear ?? 0;
      return rightYear - leftYear;
    }),
    unlinkedPlans,
  };
}
