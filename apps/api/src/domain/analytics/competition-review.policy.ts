import type {
  AnalyticsChain,
  CompetitionContext,
  CompetitionPlanSummary,
  MesocycleSummary,
  MesocycleWeekContext,
  SeasonSummary,
} from "@training-platform/shared";

function distanceToRange(referenceDate: string, startDate: string, endDate: string) {
  if (referenceDate < startDate) {
    return Math.round(
      (new Date(`${startDate}T00:00:00Z`).getTime() -
        new Date(`${referenceDate}T00:00:00Z`).getTime()) /
        (24 * 60 * 60 * 1000),
    );
  }

  if (referenceDate > endDate) {
    return Math.round(
      (new Date(`${referenceDate}T00:00:00Z`).getTime() -
        new Date(`${endDate}T00:00:00Z`).getTime()) /
        (24 * 60 * 60 * 1000),
    );
  }

  return 0;
}

export function pickSeason(seasons: SeasonSummary[], referenceDate: string) {
  const referenceYear = Number(referenceDate.slice(0, 4));

  return (
    seasons.find((season) => season.year === referenceYear) ??
    seasons
      .slice()
      .sort(
        (left, right) =>
          right.year - left.year || right.createdAt.localeCompare(left.createdAt),
      )[0] ??
    null
  );
}

export function pickMesocycle(
  mesocycles: MesocycleSummary[],
  referenceDate: string,
  mesocycleWeek: MesocycleWeekContext | null,
  competitionContext: CompetitionContext | null,
) {
  if (mesocycleWeek) {
    return mesocycles.find((mesocycle) => mesocycle.id === mesocycleWeek.mesocycleId) ?? null;
  }

  const active =
    mesocycles.find(
      (mesocycle) =>
        mesocycle.startDate <= referenceDate && mesocycle.endDate >= referenceDate,
    ) ?? null;

  if (active) {
    return active;
  }

  if (competitionContext?.competitionPlanId) {
    const linked = mesocycles
      .filter(
        (mesocycle) =>
          mesocycle.competitionPlanId === competitionContext.competitionPlanId,
      )
      .sort(
        (left, right) =>
          distanceToRange(referenceDate, left.startDate, left.endDate) -
            distanceToRange(referenceDate, right.startDate, right.endDate) ||
          right.createdAt.localeCompare(left.createdAt),
      )[0];

    if (linked) {
      return linked;
    }
  }

  return (
    mesocycles
      .slice()
      .sort(
        (left, right) =>
          distanceToRange(referenceDate, left.startDate, left.endDate) -
            distanceToRange(referenceDate, right.startDate, right.endDate) ||
          right.createdAt.localeCompare(left.createdAt),
      )[0] ?? null
  );
}

export function pickCompetitionPlan(
  plans: CompetitionPlanSummary[],
  referenceDate: string,
  competitionContext: CompetitionContext | null,
  mesocycle: MesocycleSummary | null,
) {
  if (competitionContext?.competitionPlanId) {
    return plans.find((plan) => plan.id === competitionContext.competitionPlanId) ?? null;
  }

  if (mesocycle?.competitionPlanId) {
    return plans.find((plan) => plan.id === mesocycle.competitionPlanId) ?? null;
  }

  const active =
    plans.find(
      (plan) =>
        plan.prepStartDate <= referenceDate && plan.competitionEndDate >= referenceDate,
    ) ?? null;

  if (active) {
    return active;
  }

  return (
    plans
      .slice()
      .sort(
        (left, right) =>
          distanceToRange(referenceDate, left.prepStartDate, left.competitionEndDate) -
            distanceToRange(referenceDate, right.prepStartDate, right.competitionEndDate) ||
          left.competitionStartDate.localeCompare(right.competitionStartDate),
      )[0] ?? null
  );
}

export function buildAnalyticsChain(input: {
  activeSeason: SeasonSummary | null;
  activeCompetitionPlan: CompetitionPlanSummary | null;
  competitionContext: CompetitionContext | null;
  activeMesocycle: MesocycleSummary | null;
  mesocycleWeek: MesocycleWeekContext | null;
  weekSummary: AnalyticsChain["weekSummary"];
}): AnalyticsChain {
  return {
    season: input.activeSeason
      ? {
          id: input.activeSeason.id,
          name: input.activeSeason.name,
          year: input.activeSeason.year,
          strategyType: input.activeSeason.strategyType,
          goal: input.activeSeason.goal,
        }
      : null,
    competitionPlan: input.activeCompetitionPlan
      ? {
          id: input.activeCompetitionPlan.id,
          competitionTitle: input.activeCompetitionPlan.competitionTitle,
          priority: input.activeCompetitionPlan.priority,
          planType: input.activeCompetitionPlan.planType,
          prepStartDate: input.activeCompetitionPlan.prepStartDate,
          prepEndDate: input.activeCompetitionPlan.prepEndDate,
          competitionStartDate: input.activeCompetitionPlan.competitionStartDate,
          competitionEndDate: input.activeCompetitionPlan.competitionEndDate,
        }
      : null,
    competitionContext: input.competitionContext,
    mesocycle: input.activeMesocycle
      ? {
          id: input.activeMesocycle.id,
          name: input.activeMesocycle.name,
          phase: input.activeMesocycle.phase,
          progressionType: input.activeMesocycle.progressionType,
          goal: input.activeMesocycle.goal,
          startDate: input.activeMesocycle.startDate,
          endDate: input.activeMesocycle.endDate,
        }
      : null,
    mesocycleWeek: input.mesocycleWeek,
    weekSummary: input.weekSummary,
    missingLinks: [
      ...(input.activeSeason ? [] : ["season"]),
      ...(input.activeCompetitionPlan ? [] : ["competition_plan"]),
      ...(input.activeMesocycle ? [] : ["mesocycle"]),
      ...(input.mesocycleWeek ? [] : ["week"]),
    ],
  };
}
