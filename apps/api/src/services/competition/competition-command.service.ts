import type {
  CompetitionResultPayload,
  CreateCompetitionPayload,
  CreateCompetitionPlanPayload,
  CreateOlympicCyclePayload,
  DeleteCompetitionResponse,
  DeleteCompetitionsResponse,
} from "@training-platform/shared";
import { pool } from "../../db";
import {
  getCompetitionById,
  getCompetitionPlanAthleteId,
  getCompetitionPlanById,
  getOlympicCycleById,
  listCompetitions,
} from "./competition-query.service";

export class CompetitionCommandServiceError extends Error {
  constructor(
    public readonly code: "competition_plan_not_found",
    message: string,
  ) {
    super(message);
    this.name = "CompetitionCommandServiceError";
  }
}

export async function createCompetition(payload: CreateCompetitionPayload) {
  const result = await pool.query<{ id: string }>(
    `
      INSERT INTO competitions (
        title,
        federation,
        location,
        start_date,
        end_date,
        level,
        age_group,
        description
      )
      VALUES ($1, $2, $3, $4::date, $5::date, $6, $7, $8)
      RETURNING id
    `,
    [
      payload.title,
      payload.federation ?? "",
      payload.location ?? "",
      payload.startDate,
      payload.endDate,
      payload.level,
      payload.ageGroup ?? "",
      payload.description ?? "",
    ],
  );

  return getCompetitionById(result.rows[0].id);
}

export async function deleteCompetition(id: string): Promise<DeleteCompetitionResponse | null> {
  const result = await deleteCompetitions([id]);

  if (!result.deletedCompetitionIds.includes(id)) {
    return null;
  }

  return {
    deletedCompetitionId: id,
    linkedPlanCount: result.linkedPlanCount,
    competitions: result.competitions,
  };
}

export async function deleteCompetitions(ids: string[]): Promise<DeleteCompetitionsResponse> {
  if (ids.length === 0) {
    return {
      deletedCompetitionIds: [],
      linkedPlanCount: 0,
      competitions: await listCompetitions(),
    };
  }

  const linkedPlans = await pool.query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM competition_plans
      WHERE competition_id = ANY($1::uuid[])
    `,
    [ids],
  );
  const result = await pool.query<{ id: string }>(
    `
      DELETE FROM competitions
      WHERE id = ANY($1::uuid[])
      RETURNING id
    `,
    [ids],
  );

  return {
    deletedCompetitionIds: result.rows.map((row) => row.id),
    linkedPlanCount: Number(linkedPlans.rows[0]?.count ?? 0),
    competitions: await listCompetitions(),
  };
}

export async function createOlympicCycle(payload: CreateOlympicCyclePayload) {
  const result = await pool.query<{ id: string }>(
    `
      INSERT INTO olympic_cycles (name, start_date, end_date, target_event, description)
      VALUES ($1, $2::date, $3::date, $4, $5)
      RETURNING id
    `,
    [
      payload.name,
      payload.startDate,
      payload.endDate,
      payload.targetEvent ?? "",
      payload.description ?? "",
    ],
  );

  return getOlympicCycleById(result.rows[0].id);
}

export async function createCompetitionPlan(payload: CreateCompetitionPlanPayload) {
  const result = await pool.query<{ id: string }>(
    `
      INSERT INTO competition_plans (
        athlete_id,
        season_id,
        competition_id,
        priority,
        plan_type,
        peak_required,
        taper_days,
        weight_cut_required,
        target_weight,
        current_weight,
        expected_matches,
        competition_format,
        prep_start_date,
        prep_end_date,
        notes,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::date, $14::date, $15, NOW())
      RETURNING id
    `,
    [
      payload.athleteId,
      payload.seasonId,
      payload.competitionId,
      payload.priority,
      payload.planType,
      payload.peakRequired,
      payload.taperDays,
      payload.weightCutRequired,
      payload.targetWeight,
      payload.currentWeight,
      payload.expectedMatches,
      payload.competitionFormat ?? "",
      payload.prepStartDate,
      payload.prepEndDate,
      payload.notes ?? "",
    ],
  );

  return getCompetitionPlanById(result.rows[0].id);
}

export async function deleteCompetitionPlan(id: string) {
  const result = await pool.query<{ id: string }>(
    `
      DELETE FROM competition_plans
      WHERE id = $1
      RETURNING id
    `,
    [id],
  );

  return result.rows[0]?.id ?? null;
}

export async function saveCompetitionResult(payload: CompetitionResultPayload) {
  const athleteId = await getCompetitionPlanAthleteId(payload.competitionPlanId);

  if (!athleteId) {
    throw new CompetitionCommandServiceError(
      "competition_plan_not_found",
      "Competition plan was not found",
    );
  }

  await pool.query(
    `
      INSERT INTO competition_results (
        competition_plan_id,
        final_place,
        matches_count,
        weight_at_weigh_in,
        weight_after,
        performance_notes,
        coach_notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (competition_plan_id)
      DO UPDATE SET
        final_place = EXCLUDED.final_place,
        matches_count = EXCLUDED.matches_count,
        weight_at_weigh_in = EXCLUDED.weight_at_weigh_in,
        weight_after = EXCLUDED.weight_after,
        performance_notes = EXCLUDED.performance_notes,
        coach_notes = EXCLUDED.coach_notes
    `,
    [
      payload.competitionPlanId,
      payload.finalPlace,
      payload.matchesCount,
      payload.weightAtWeighIn,
      payload.weightAfter,
      payload.performanceNotes ?? "",
      payload.coachNotes ?? "",
    ],
  );

  return {
    competitionPlanId: payload.competitionPlanId,
    athleteId,
  };
}
