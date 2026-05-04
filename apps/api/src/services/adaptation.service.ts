import type { AdaptedPlanDay } from "@training-platform/shared";
import { adaptAssignedPlan } from "../domain/adaptation.engine";
import { pool } from "../db";
import { getCompetitionContextForAthlete } from "./competition/competition-query.service";
import { loadAssignedPlans } from "./planning/planning-query.service";
import { getLatestReadinessEntryRecord } from "./readiness.service";

export interface AdaptedPlanResult {
  adaptedPlan: AdaptedPlanDay;
  readinessScoreId: string;
}

export async function buildAdaptedPlanForAthlete(
  athleteId: string,
): Promise<AdaptedPlanResult | null> {
  const readiness = await getLatestReadinessEntryRecord(athleteId);

  if (!readiness) {
    return null;
  }

  const assignedPlans = await loadAssignedPlans(
    "assigned_plans.athlete_id = $1 AND assigned_plans.status = 'active'",
    [athleteId],
  );
  const assignedPlan =
    assignedPlans.find((plan) => plan.day.dayDate === readiness.entryDate) ??
    assignedPlans
      .filter((plan) => plan.day.dayDate >= readiness.entryDate)
      .sort((left, right) => left.day.dayDate.localeCompare(right.day.dayDate))[0] ??
    assignedPlans.sort((left, right) => right.day.dayDate.localeCompare(left.day.dayDate))[0] ??
    null;

  if (!assignedPlan) {
    return null;
  }

  const competitionContext = await getCompetitionContextForAthlete(
    athleteId,
    assignedPlan.day.dayDate,
  );

  const adaptedPlan = adaptAssignedPlan({
    assignedPlan,
    readiness,
    competitionContext,
  });

  await pool.query(
    `
      INSERT INTO readiness_actions (readiness_score_id, action_summary, adapted_plan_json, updated_at)
      VALUES ($1, $2::jsonb, $3::jsonb, NOW())
      ON CONFLICT (readiness_score_id)
      DO UPDATE SET
        action_summary = EXCLUDED.action_summary,
        adapted_plan_json = EXCLUDED.adapted_plan_json,
        updated_at = NOW()
    `,
    [
      readiness.readinessScoreId,
      JSON.stringify({
        removedBlocks: adaptedPlan.removedBlocks,
        reducedBlocks: adaptedPlan.reducedBlocks,
        replacedBlocks: adaptedPlan.replacedBlocks,
        explanation: adaptedPlan.explanation,
        competitionContext: adaptedPlan.competitionContext,
      }),
      JSON.stringify(adaptedPlan),
    ],
  );

  return {
    adaptedPlan,
    readinessScoreId: readiness.readinessScoreId,
  };
}
