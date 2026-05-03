import type {
  CompetitionContext,
  CompetitionPlanSummary,
  CompetitionResultSummary,
  CompetitionSummary,
  OlympicCycleSummary,
} from "@training-platform/shared";
import { buildCompetitionContextFromCandidates } from "../../domain/competition/competition-context";
import { toDateKey } from "../../domain/competition/competition-timeline.policy";
import type { CompetitionContextCandidate } from "../../domain/competition/competition.types";
import { pool } from "../../db";

interface OlympicCycleRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  target_event: string | null;
  description: string;
  created_at: string;
}

interface CompetitionRow {
  id: string;
  title: string;
  federation: string;
  location: string;
  start_date: string;
  end_date: string;
  level: CompetitionSummary["level"];
  age_group: string;
  description: string;
  created_at: string;
}

interface CompetitionPlanRow {
  id: string;
  athlete_id: string;
  athlete_name: string;
  season_id: string | null;
  season_name: string | null;
  season_year: number | null;
  competition_id: string;
  competition_title: string;
  competition_start_date: string;
  competition_end_date: string;
  priority: CompetitionPlanSummary["priority"];
  plan_type: CompetitionPlanSummary["planType"];
  peak_required: boolean;
  taper_days: number;
  weight_cut_required: boolean;
  target_weight: string | null;
  current_weight: string | null;
  expected_matches: number | null;
  competition_format: string;
  prep_start_date: string;
  prep_end_date: string;
  notes: string;
  created_at: string;
  updated_at: string;
  result_final_place: number | null;
  result_matches_count: number | null;
  result_weight_at_weigh_in: string | null;
  result_weight_after: string | null;
  result_performance_notes: string | null;
  result_coach_notes: string | null;
  result_created_at: string | null;
}

interface CompetitionContextRow {
  competition_plan_id: string;
  competition_id: string;
  priority: CompetitionPlanSummary["priority"];
  taper_days: number;
  weight_cut_required: boolean;
  prep_start_date: string;
  prep_end_date: string;
  competition_start_date: string;
}

function mapCompetitionResult(row: CompetitionPlanRow): CompetitionResultSummary | null {
  if (!row.result_created_at) {
    return null;
  }

  return {
    competitionPlanId: row.id,
    finalPlace: row.result_final_place,
    matchesCount: row.result_matches_count,
    weightAtWeighIn:
      row.result_weight_at_weigh_in !== null ? Number(row.result_weight_at_weigh_in) : null,
    weightAfter: row.result_weight_after !== null ? Number(row.result_weight_after) : null,
    performanceNotes: row.result_performance_notes ?? "",
    coachNotes: row.result_coach_notes ?? "",
    createdAt: row.result_created_at,
  };
}

function mapOlympicCycles(rows: OlympicCycleRow[]): OlympicCycleSummary[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    targetEvent: row.target_event ?? "",
    description: row.description,
    createdAt: row.created_at,
  }));
}

function mapCompetitions(rows: CompetitionRow[]): CompetitionSummary[] {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    federation: row.federation,
    location: row.location,
    startDate: row.start_date,
    endDate: row.end_date,
    level: row.level,
    ageGroup: row.age_group,
    description: row.description,
    createdAt: row.created_at,
  }));
}

function mapCompetitionPlans(rows: CompetitionPlanRow[]): CompetitionPlanSummary[] {
  return rows.map((row) => ({
    id: row.id,
    athleteId: row.athlete_id,
    athleteName: row.athlete_name,
    seasonId: row.season_id,
    seasonName: row.season_name,
    seasonYear: row.season_year,
    competitionId: row.competition_id,
    competitionTitle: row.competition_title,
    competitionStartDate: row.competition_start_date,
    competitionEndDate: row.competition_end_date,
    priority: row.priority,
    planType: row.plan_type,
    peakRequired: row.peak_required,
    taperDays: row.taper_days,
    weightCutRequired: row.weight_cut_required,
    targetWeight: row.target_weight !== null ? Number(row.target_weight) : null,
    currentWeight: row.current_weight !== null ? Number(row.current_weight) : null,
    expectedMatches: row.expected_matches,
    competitionFormat: row.competition_format,
    prepStartDate: row.prep_start_date,
    prepEndDate: row.prep_end_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    result: mapCompetitionResult(row),
  }));
}

function mapCompetitionContextCandidates(
  rows: CompetitionContextRow[],
): CompetitionContextCandidate[] {
  return rows.map((row) => ({
    competitionPlanId: row.competition_plan_id,
    competitionId: row.competition_id,
    competitionPriority: row.priority,
    taperDays: row.taper_days,
    weightCutRequired: row.weight_cut_required,
    prepStartDate: row.prep_start_date,
    prepEndDate: row.prep_end_date,
    competitionStartDate: row.competition_start_date,
  }));
}

async function queryOlympicCycles(whereSql = "", params: unknown[] = []) {
  const result = await pool.query<OlympicCycleRow>(
    `
      SELECT
        id,
        name,
        start_date::text,
        end_date::text,
        target_event,
        description,
        created_at::text
      FROM olympic_cycles
      ${whereSql ? `WHERE ${whereSql}` : ""}
      ORDER BY start_date DESC, created_at DESC
    `,
    params,
  );

  return mapOlympicCycles(result.rows);
}

async function queryCompetitions(whereSql = "", params: unknown[] = []) {
  const result = await pool.query<CompetitionRow>(
    `
      SELECT
        id,
        title,
        federation,
        location,
        start_date::text,
        end_date::text,
        level,
        age_group,
        description,
        created_at::text
      FROM competitions
      ${whereSql ? `WHERE ${whereSql}` : ""}
      ORDER BY
        CASE WHEN start_date >= CURRENT_DATE THEN 0 ELSE 1 END,
        CASE WHEN start_date >= CURRENT_DATE THEN start_date END ASC,
        CASE WHEN start_date < CURRENT_DATE THEN start_date END DESC,
        created_at DESC
    `,
    params,
  );

  return mapCompetitions(result.rows);
}

async function queryCompetitionPlans(whereSql = "", params: unknown[] = []) {
  const result = await pool.query<CompetitionPlanRow>(
    `
      SELECT
        competition_plans.id,
        competition_plans.athlete_id,
        users.full_name AS athlete_name,
        competition_plans.season_id,
        seasons.name AS season_name,
        seasons.year AS season_year,
        competition_plans.competition_id,
        competitions.title AS competition_title,
        competitions.start_date::text AS competition_start_date,
        competitions.end_date::text AS competition_end_date,
        competition_plans.priority,
        competition_plans.plan_type,
        competition_plans.peak_required,
        competition_plans.taper_days,
        competition_plans.weight_cut_required,
        competition_plans.target_weight::text,
        competition_plans.current_weight::text,
        competition_plans.expected_matches,
        competition_plans.competition_format,
        competition_plans.prep_start_date::text,
        competition_plans.prep_end_date::text,
        competition_plans.notes,
        competition_plans.created_at::text,
        competition_plans.updated_at::text,
        competition_results.final_place AS result_final_place,
        competition_results.matches_count AS result_matches_count,
        competition_results.weight_at_weigh_in::text AS result_weight_at_weigh_in,
        competition_results.weight_after::text AS result_weight_after,
        competition_results.performance_notes AS result_performance_notes,
        competition_results.coach_notes AS result_coach_notes,
        competition_results.created_at::text AS result_created_at
      FROM competition_plans
      JOIN athletes ON athletes.id = competition_plans.athlete_id
      JOIN users ON users.id = athletes.user_id
      JOIN competitions ON competitions.id = competition_plans.competition_id
      LEFT JOIN seasons ON seasons.id = competition_plans.season_id
      LEFT JOIN competition_results ON competition_results.competition_plan_id = competition_plans.id
      ${whereSql ? `WHERE ${whereSql}` : ""}
      ORDER BY competition_plans.prep_start_date DESC, competition_plans.created_at DESC
    `,
    params,
  );

  return mapCompetitionPlans(result.rows);
}

export async function listOlympicCycles() {
  return queryOlympicCycles();
}

export async function getOlympicCycleById(id: string) {
  return (await queryOlympicCycles("id = $1", [id]))[0] ?? null;
}

export async function listCompetitions() {
  return queryCompetitions();
}

export async function getCompetitionById(id: string) {
  return (await queryCompetitions("id = $1", [id]))[0] ?? null;
}

export async function listCompetitionPlans(athleteId?: string) {
  if (!athleteId) {
    return queryCompetitionPlans();
  }

  return queryCompetitionPlans("competition_plans.athlete_id = $1", [athleteId]);
}

export async function getCompetitionPlanById(id: string) {
  return (await queryCompetitionPlans("competition_plans.id = $1", [id]))[0] ?? null;
}

export async function getCompetitionPlanAthleteId(competitionPlanId: string) {
  const result = await pool.query<{ athlete_id: string }>(
    `
      SELECT athlete_id
      FROM competition_plans
      WHERE id = $1
      LIMIT 1
    `,
    [competitionPlanId],
  );

  return result.rows[0]?.athlete_id ?? null;
}

export async function getCompetitionPlanCompetitionTitle(competitionPlanId: string) {
  const result = await pool.query<{ title: string | null }>(
    `
      SELECT competitions.title
      FROM competition_plans
      JOIN competitions ON competitions.id = competition_plans.competition_id
      WHERE competition_plans.id = $1
      LIMIT 1
    `,
    [competitionPlanId],
  );

  return result.rows[0]?.title ?? null;
}

export async function getCompetitionContextForAthlete(
  athleteId: string,
  referenceDate: string | Date = new Date(),
): Promise<CompetitionContext | null> {
  const referenceDateText = toDateKey(referenceDate);
  const result = await pool.query<CompetitionContextRow>(
    `
      SELECT
        competition_plans.id AS competition_plan_id,
        competition_plans.competition_id,
        competition_plans.priority,
        competition_plans.taper_days,
        competition_plans.weight_cut_required,
        competition_plans.prep_start_date::text,
        competition_plans.prep_end_date::text,
        competitions.start_date::text AS competition_start_date
      FROM competition_plans
      JOIN competitions ON competitions.id = competition_plans.competition_id
      WHERE competition_plans.athlete_id = $1
    `,
    [athleteId],
  );

  return buildCompetitionContextFromCandidates(
    mapCompetitionContextCandidates(result.rows),
    referenceDateText,
  );
}
