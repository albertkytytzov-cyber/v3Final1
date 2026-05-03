import type {
  CompetitionReviewOverview,
  CreateSeasonPayload,
  SeasonSummary,
} from "@training-platform/shared";
import { buildCompetitionReviewOverviewFromPlans } from "../../domain/competition/season-phase.policy";
import { pool } from "../../db";
import { listCompetitionPlans } from "./competition-query.service";

interface SeasonRow {
  id: string;
  athlete_id: string;
  athlete_name: string;
  olympic_cycle_id: string | null;
  olympic_cycle_name: string | null;
  year: number;
  name: string;
  goal: string;
  strategy_type: SeasonSummary["strategyType"];
  created_at: string;
}

function mapSeasons(rows: SeasonRow[]): SeasonSummary[] {
  return rows.map((row) => ({
    id: row.id,
    athleteId: row.athlete_id,
    athleteName: row.athlete_name,
    olympicCycleId: row.olympic_cycle_id,
    olympicCycleName: row.olympic_cycle_name,
    year: row.year,
    name: row.name,
    goal: row.goal,
    strategyType: row.strategy_type,
    createdAt: row.created_at,
  }));
}

async function querySeasons(whereSql = "", params: unknown[] = []) {
  const result = await pool.query<SeasonRow>(
    `
      SELECT
        seasons.id,
        seasons.athlete_id,
        users.full_name AS athlete_name,
        seasons.olympic_cycle_id,
        olympic_cycles.name AS olympic_cycle_name,
        seasons.year,
        seasons.name,
        seasons.goal,
        seasons.strategy_type,
        seasons.created_at::text
      FROM seasons
      JOIN athletes ON athletes.id = seasons.athlete_id
      JOIN users ON users.id = athletes.user_id
      LEFT JOIN olympic_cycles ON olympic_cycles.id = seasons.olympic_cycle_id
      ${whereSql ? `WHERE ${whereSql}` : ""}
      ORDER BY seasons.year DESC, seasons.created_at DESC
    `,
    params,
  );

  return mapSeasons(result.rows);
}

async function getAthleteName(athleteId: string) {
  const result = await pool.query<{ athlete_name: string }>(
    `
      SELECT users.full_name AS athlete_name
      FROM athletes
      JOIN users ON users.id = athletes.user_id
      WHERE athletes.id = $1
      LIMIT 1
    `,
    [athleteId],
  );

  return result.rows[0]?.athlete_name ?? null;
}

export async function listSeasons(athleteId?: string) {
  if (!athleteId) {
    return querySeasons();
  }

  return querySeasons("seasons.athlete_id = $1", [athleteId]);
}

export async function getSeasonById(id: string) {
  return (await querySeasons("seasons.id = $1", [id]))[0] ?? null;
}

export async function getSeasonAthleteId(seasonId: string) {
  const result = await pool.query<{ athlete_id: string }>(
    `
      SELECT athlete_id
      FROM seasons
      WHERE id = $1
      LIMIT 1
    `,
    [seasonId],
  );

  return result.rows[0]?.athlete_id ?? null;
}

export async function createSeason(payload: CreateSeasonPayload) {
  const result = await pool.query<{ id: string }>(
    `
      INSERT INTO seasons (athlete_id, olympic_cycle_id, year, name, goal, strategy_type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    [
      payload.athleteId,
      payload.olympicCycleId,
      payload.year,
      payload.name,
      payload.goal ?? "",
      payload.strategyType,
    ],
  );

  return getSeasonById(result.rows[0].id);
}

export async function buildCompetitionReviewOverview(
  athleteId: string,
): Promise<CompetitionReviewOverview | null> {
  const plans = await listCompetitionPlans(athleteId);
  const athleteName = plans[0]?.athleteName ?? (await getAthleteName(athleteId));

  if (!athleteName) {
    return null;
  }

  return buildCompetitionReviewOverviewFromPlans({
    athleteId,
    athleteName,
    plans,
  });
}
