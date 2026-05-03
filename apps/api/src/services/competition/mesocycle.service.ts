import type {
  CreateMesocyclePayload,
  MesocycleSummary,
} from "@training-platform/shared";
import {
  buildMesocycleWeeks,
  resolveMesocycleWeekContextForDate,
  validateMesocycleWeeksCount,
} from "../../domain/competition/mesocycle-structure.policy";
import { pool } from "../../db";
import {
  getCompetitionPlanAthleteId,
  getCompetitionPlanCompetitionTitle,
} from "./competition-query.service";
import { getSeasonAthleteId } from "./season.service";

interface MesocycleRow {
  id: string;
  athlete_id: string;
  athlete_name: string;
  season_id: string | null;
  season_name: string | null;
  competition_plan_id: string | null;
  competition_title: string | null;
  name: string;
  phase: MesocycleSummary["phase"];
  goal: string;
  progression_type: MesocycleSummary["progressionType"];
  start_date: string;
  end_date: string;
  weeks_count: number;
  notes: string;
  week_plan_json: MesocycleSummary["weeks"] | null;
  created_at: string;
  updated_at: string;
}

export class MesocycleServiceError extends Error {
  constructor(
    public readonly code:
      | "weeks_count_out_of_range"
      | "season_athlete_mismatch"
      | "competition_plan_athlete_mismatch",
    message: string,
  ) {
    super(message);
    this.name = "MesocycleServiceError";
  }
}

function mapMesocycles(rows: MesocycleRow[]): MesocycleSummary[] {
  return rows.map((row) => ({
    id: row.id,
    athleteId: row.athlete_id,
    athleteName: row.athlete_name,
    seasonId: row.season_id,
    seasonName: row.season_name,
    competitionPlanId: row.competition_plan_id,
    competitionTitle: row.competition_title,
    name: row.name,
    phase: row.phase,
    goal: row.goal,
    progressionType: row.progression_type,
    startDate: row.start_date,
    endDate: row.end_date,
    weeksCount: row.weeks_count,
    notes: row.notes,
    weeks: Array.isArray(row.week_plan_json) ? row.week_plan_json : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

async function queryMesocycles(whereSql = "", params: unknown[] = []) {
  const result = await pool.query<MesocycleRow>(
    `
      SELECT
        mesocycles.id,
        mesocycles.athlete_id,
        users.full_name AS athlete_name,
        mesocycles.season_id,
        seasons.name AS season_name,
        mesocycles.competition_plan_id,
        competitions.title AS competition_title,
        mesocycles.name,
        mesocycles.phase,
        mesocycles.goal,
        mesocycles.progression_type,
        mesocycles.start_date::text,
        mesocycles.end_date::text,
        mesocycles.weeks_count,
        mesocycles.notes,
        mesocycles.week_plan_json,
        mesocycles.created_at::text,
        mesocycles.updated_at::text
      FROM mesocycles
      JOIN athletes ON athletes.id = mesocycles.athlete_id
      JOIN users ON users.id = athletes.user_id
      LEFT JOIN seasons ON seasons.id = mesocycles.season_id
      LEFT JOIN competition_plans ON competition_plans.id = mesocycles.competition_plan_id
      LEFT JOIN competitions ON competitions.id = competition_plans.competition_id
      ${whereSql ? `WHERE ${whereSql}` : ""}
      ORDER BY mesocycles.start_date DESC, mesocycles.created_at DESC
    `,
    params,
  );

  return mapMesocycles(result.rows);
}

export async function listMesocycles(athleteId?: string) {
  if (!athleteId) {
    return queryMesocycles();
  }

  return queryMesocycles("mesocycles.athlete_id = $1", [athleteId]);
}

export async function getMesocycleById(id: string) {
  return (await queryMesocycles("mesocycles.id = $1", [id]))[0] ?? null;
}

export async function createMesocycle(payload: CreateMesocyclePayload) {
  const weeksCountValidation = validateMesocycleWeeksCount(payload.weeksCount);

  if (!weeksCountValidation.ok) {
    throw new MesocycleServiceError(
      "weeks_count_out_of_range",
      weeksCountValidation.message,
    );
  }

  if (payload.seasonId) {
    const seasonAthleteId = await getSeasonAthleteId(payload.seasonId);

    if (seasonAthleteId !== payload.athleteId) {
      throw new MesocycleServiceError(
        "season_athlete_mismatch",
        "seasonId must belong to the same athlete",
      );
    }
  }

  if (payload.competitionPlanId) {
    const competitionPlanAthleteId = await getCompetitionPlanAthleteId(payload.competitionPlanId);

    if (competitionPlanAthleteId !== payload.athleteId) {
      throw new MesocycleServiceError(
        "competition_plan_athlete_mismatch",
        "competitionPlanId must belong to the same athlete",
      );
    }
  }

  const competitionTitle = payload.competitionPlanId
    ? await getCompetitionPlanCompetitionTitle(payload.competitionPlanId)
    : null;
  const weeks = buildMesocycleWeeks({
    phase: payload.phase,
    progressionType: payload.progressionType,
    startDate: payload.startDate,
    weeksCount: payload.weeksCount,
    competitionTitle,
  });
  const result = await pool.query<{ id: string }>(
    `
      INSERT INTO mesocycles (
        athlete_id,
        season_id,
        competition_plan_id,
        name,
        phase,
        goal,
        progression_type,
        start_date,
        end_date,
        weeks_count,
        notes,
        week_plan_json,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9::date, $10, $11, $12::jsonb, NOW())
      RETURNING id
    `,
    [
      payload.athleteId,
      payload.seasonId,
      payload.competitionPlanId,
      payload.name,
      payload.phase,
      payload.goal ?? "",
      payload.progressionType,
      payload.startDate,
      payload.endDate,
      payload.weeksCount,
      payload.notes ?? "",
      JSON.stringify(weeks),
    ],
  );

  return getMesocycleById(result.rows[0].id);
}

export async function getMesocycleWeekContextForDate(
  athleteId: string,
  referenceDate: string,
) {
  return resolveMesocycleWeekContextForDate({
    mesocycles: await listMesocycles(athleteId),
    referenceDate,
  });
}
