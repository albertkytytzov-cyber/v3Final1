import type {
  AnalyticsCoachActionDecision,
  AnalyticsCoachActionDecisionPayload,
  AnalyticsCoachActionOutcome,
  AnalyticsCoachActionSnapshot,
  CoachAthleteProfilePayload,
  CoachAthleteSummary,
  PlanBlockInput,
  ReadinessStatus,
} from "@training-platform/shared";
import { pool } from "../../db";
import type {
  ExecutionBlock,
  StoredAnalyticsCoachActionDecision,
} from "../../domain/analytics/analytics.types";

interface CoachAthleteRow {
  athlete_id: string;
  user_id: string;
  full_name: string;
  email: string;
  photo_url: string | null;
  birth_date: string | null;
  height_cm: string | null;
  sport: string | null;
  discipline: string | null;
  weight_class: string | null;
  dominant_side: string | null;
  baseline_resting_hr: number | null;
  baseline_weight_kg: string | null;
  current_weight_kg: string | null;
  current_weight_date: string | null;
  wrestling_experience_years: string | null;
  strength_squat_kg: string | null;
  strength_bench_press_kg: string | null;
  strength_deadlift_kg: string | null;
  strength_pull_ups_max: number | null;
  strength_grip_left_kg: string | null;
  strength_grip_right_kg: string | null;
  strength_notes: string | null;
  strengths: string | null;
  weaknesses: string | null;
  injuries_or_restrictions: string | null;
  preparation_goal: string | null;
  profile_notes: string | null;
  updated_at: string | null;
  entry_date: string | null;
  score: string | null;
  status: ReadinessStatus | null;
}

interface AnalyticsAthleteRow {
  athlete_id: string;
  athlete_name: string;
  baseline_weight_kg: string | null;
}

interface AnalyticsReadinessRow {
  entry_date: string;
  score: string;
  status: ReadinessStatus;
}

interface AnalyticsExecutionTrendRow {
  day_date: string;
  block_id: string;
  completed: boolean | null;
  sets_completed: number | null;
  reps_completed: number | null;
  weight_kg: string | null;
  duration_minutes: string | null;
  rpe: string | null;
  result_notes: string | null;
  block_type: PlanBlockInput["blockType"];
  block_priority: number;
  target_duration_minutes: string | null;
  target_rpe: string | null;
  target_sets: number | null;
  target_reps: number | null;
}

interface WeightLogRow {
  log_date: string;
  weight_kg: string;
}

interface TrainingLoadLogRow {
  log_date: string;
  planned_load: string;
  actual_load: string;
  actual_rpe: string | null;
  actual_duration_minutes: string | null;
}

interface AnalyticsDecisionRow {
  id: string;
  athlete_id: string;
  coach_user_id: string;
  suggestion_id: string;
  suggestion_title: string;
  suggestion_level: AnalyticsCoachActionDecision["suggestionLevel"];
  source_code: AnalyticsCoachActionDecision["sourceCode"];
  week_start_date: string;
  week_label: string | null;
  decision_status: AnalyticsCoachActionDecision["decisionStatus"];
  outcome_status: AnalyticsCoachActionOutcome;
  planner_bridge_json: AnalyticsCoachActionDecision["plannerBridge"];
  baseline_snapshot_json: AnalyticsCoachActionSnapshot | null;
  decision_notes: string;
  outcome_notes: string;
  created_at: string;
  updated_at: string;
}

export interface SaveAnalyticsCoachActionDecisionInput
  extends AnalyticsCoachActionDecisionPayload {
  athleteId: string;
  coachUserId: string;
  clientRequestId?: string | null;
  baselineSnapshot: AnalyticsCoachActionSnapshot | null;
}

export type AttachCoachAthleteResult =
  | { status: "attached"; athlete: CoachAthleteSummary }
  | { status: "not_found" }
  | { status: "already_assigned" };

function mapCoachAthletes(rows: CoachAthleteRow[]): CoachAthleteSummary[] {
  return rows.map((row) => ({
    athleteId: row.athlete_id,
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    photoUrl: row.photo_url ?? "",
    birthDate: row.birth_date ?? null,
    heightCm: row.height_cm !== null ? Number(row.height_cm) : null,
    sport: row.sport ?? "",
    discipline: row.discipline ?? "",
    weightClass: row.weight_class ?? "",
    dominantSide: row.dominant_side ?? "",
    baselineRestingHr: row.baseline_resting_hr,
    baselineWeightKg:
      row.baseline_weight_kg !== null ? Number(row.baseline_weight_kg) : null,
    currentWeightKg:
      row.current_weight_kg !== null ? Number(row.current_weight_kg) : null,
    currentWeightDate: row.current_weight_date ?? null,
    wrestlingExperienceYears:
      row.wrestling_experience_years !== null ? Number(row.wrestling_experience_years) : null,
    strengthSquatKg: row.strength_squat_kg !== null ? Number(row.strength_squat_kg) : null,
    strengthBenchPressKg:
      row.strength_bench_press_kg !== null ? Number(row.strength_bench_press_kg) : null,
    strengthDeadliftKg:
      row.strength_deadlift_kg !== null ? Number(row.strength_deadlift_kg) : null,
    strengthPullUpsMax: row.strength_pull_ups_max,
    strengthGripLeftKg:
      row.strength_grip_left_kg !== null ? Number(row.strength_grip_left_kg) : null,
    strengthGripRightKg:
      row.strength_grip_right_kg !== null ? Number(row.strength_grip_right_kg) : null,
    strengthNotes: row.strength_notes ?? "",
    strengths: row.strengths ?? "",
    weaknesses: row.weaknesses ?? "",
    injuriesOrRestrictions: row.injuries_or_restrictions ?? "",
    preparationGoal: row.preparation_goal ?? "",
    profileNotes: row.profile_notes ?? "",
    updatedAt: row.updated_at ?? null,
    latestReadiness:
      row.entry_date && row.score && row.status
        ? {
            entryDate: row.entry_date,
            score: Number(row.score),
            status: row.status,
          }
        : null,
  }));
}

function mapStoredDecision(row: AnalyticsDecisionRow): StoredAnalyticsCoachActionDecision {
  return {
    id: row.id,
    athleteId: row.athlete_id,
    coachUserId: row.coach_user_id,
    suggestionId: row.suggestion_id,
    suggestionTitle: row.suggestion_title,
    suggestionLevel: row.suggestion_level,
    sourceCode: row.source_code,
    weekStartDate: row.week_start_date,
    weekLabel: row.week_label ?? null,
    decisionStatus: row.decision_status,
    outcomeStatus: row.outcome_status,
    plannerBridge: row.planner_bridge_json ?? null,
    baselineSnapshot: row.baseline_snapshot_json ?? null,
    decisionNotes: row.decision_notes ?? "",
    outcomeNotes: row.outcome_notes ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listCoachAthletesForUser(input: {
  coachUserId: string;
  role: string;
}): Promise<CoachAthleteSummary[]> {
  const result = await pool.query<CoachAthleteRow>(
    `
      SELECT
        athletes.id AS athlete_id,
        users.id AS user_id,
        users.full_name,
        users.email,
        athletes.photo_url,
        athletes.birth_date::text,
        athletes.height_cm::text,
        athletes.sport,
        athletes.discipline,
        athletes.weight_class,
        athletes.dominant_side,
        athletes.baseline_resting_hr,
        athletes.baseline_weight_kg::text,
        weight.current_weight_kg::text AS current_weight_kg,
        weight.current_weight_date::text AS current_weight_date,
        athletes.wrestling_experience_years::text,
        athletes.strength_squat_kg::text,
        athletes.strength_bench_press_kg::text,
        athletes.strength_deadlift_kg::text,
        athletes.strength_pull_ups_max,
        athletes.strength_grip_left_kg::text,
        athletes.strength_grip_right_kg::text,
        athletes.strength_notes,
        athletes.strengths,
        athletes.weaknesses,
        athletes.injuries_or_restrictions,
        athletes.preparation_goal,
        athletes.profile_notes,
        athletes.updated_at::text AS updated_at,
        readiness.entry_date::text,
        readiness.score::text,
        readiness.status
      FROM coach_athletes
      JOIN athletes ON athletes.id = coach_athletes.athlete_id
      JOIN users ON users.id = athletes.user_id
      LEFT JOIN LATERAL (
        SELECT
          daily_readiness_entries.entry_date,
          readiness_scores.score,
          readiness_scores.status
        FROM daily_readiness_entries
        JOIN readiness_scores ON readiness_scores.readiness_entry_id = daily_readiness_entries.id
        WHERE daily_readiness_entries.athlete_id = athletes.id
        ORDER BY daily_readiness_entries.entry_date DESC
        LIMIT 1
      ) readiness ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          weight_logs.weight_kg AS current_weight_kg,
          weight_logs.log_date AS current_weight_date
        FROM weight_logs
        WHERE weight_logs.athlete_id = athletes.id
        ORDER BY weight_logs.log_date DESC, weight_logs.created_at DESC
        LIMIT 1
      ) weight ON TRUE
      WHERE coach_athletes.coach_user_id = $1 OR $2 = 'admin'
      ORDER BY users.full_name ASC
    `,
    [input.coachUserId, input.role],
  );

  return mapCoachAthletes(result.rows);
}

export async function listAvailableAthletesForCoach(): Promise<CoachAthleteSummary[]> {
  const result = await pool.query<CoachAthleteRow>(
    `
      SELECT
        athletes.id AS athlete_id,
        users.id AS user_id,
        users.full_name,
        users.email,
        athletes.photo_url,
        athletes.birth_date::text,
        athletes.height_cm::text,
        athletes.sport,
        athletes.discipline,
        athletes.weight_class,
        athletes.dominant_side,
        athletes.baseline_resting_hr,
        athletes.baseline_weight_kg::text,
        weight.current_weight_kg::text AS current_weight_kg,
        weight.current_weight_date::text AS current_weight_date,
        athletes.wrestling_experience_years::text,
        athletes.strength_squat_kg::text,
        athletes.strength_bench_press_kg::text,
        athletes.strength_deadlift_kg::text,
        athletes.strength_pull_ups_max,
        athletes.strength_grip_left_kg::text,
        athletes.strength_grip_right_kg::text,
        athletes.strength_notes,
        athletes.strengths,
        athletes.weaknesses,
        athletes.injuries_or_restrictions,
        athletes.preparation_goal,
        athletes.profile_notes,
        athletes.updated_at::text AS updated_at,
        readiness.entry_date::text,
        readiness.score::text,
        readiness.status
      FROM athletes
      JOIN users ON users.id = athletes.user_id
      LEFT JOIN LATERAL (
        SELECT
          daily_readiness_entries.entry_date,
          readiness_scores.score,
          readiness_scores.status
        FROM daily_readiness_entries
        JOIN readiness_scores ON readiness_scores.readiness_entry_id = daily_readiness_entries.id
        WHERE daily_readiness_entries.athlete_id = athletes.id
        ORDER BY daily_readiness_entries.entry_date DESC
        LIMIT 1
      ) readiness ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          weight_logs.weight_kg AS current_weight_kg,
          weight_logs.log_date AS current_weight_date
        FROM weight_logs
        WHERE weight_logs.athlete_id = athletes.id
        ORDER BY weight_logs.log_date DESC, weight_logs.created_at DESC
        LIMIT 1
      ) weight ON TRUE
      WHERE users.role = 'athlete'
        AND NOT EXISTS (
          SELECT 1
          FROM coach_athletes
          WHERE coach_athletes.athlete_id = athletes.id
        )
      ORDER BY users.full_name ASC
    `,
  );

  return mapCoachAthletes(result.rows);
}

export async function attachAthleteToCoachUser(input: {
  coachUserId: string;
  athleteId: string;
}): Promise<AttachCoachAthleteResult> {
  const athleteExists = await pool.query(
    `
      SELECT 1
      FROM athletes
      JOIN users ON users.id = athletes.user_id
      WHERE athletes.id = $1
        AND users.role = 'athlete'
      LIMIT 1
    `,
    [input.athleteId],
  );

  if (!athleteExists.rowCount) {
    return { status: "not_found" };
  }

  const assignedToAnotherCoach = await pool.query(
    `
      SELECT 1
      FROM coach_athletes
      WHERE athlete_id = $1
        AND coach_user_id <> $2
      LIMIT 1
    `,
    [input.athleteId, input.coachUserId],
  );

  if (assignedToAnotherCoach.rowCount) {
    return { status: "already_assigned" };
  }

  await pool.query(
    `
      INSERT INTO coach_athletes (coach_user_id, athlete_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `,
    [input.coachUserId, input.athleteId],
  );

  const result = await pool.query<CoachAthleteRow>(
    `
      SELECT
        athletes.id AS athlete_id,
        users.id AS user_id,
        users.full_name,
        users.email,
        athletes.photo_url,
        athletes.birth_date::text,
        athletes.height_cm::text,
        athletes.sport,
        athletes.discipline,
        athletes.weight_class,
        athletes.dominant_side,
        athletes.baseline_resting_hr,
        athletes.baseline_weight_kg::text,
        weight.current_weight_kg::text AS current_weight_kg,
        weight.current_weight_date::text AS current_weight_date,
        athletes.wrestling_experience_years::text,
        athletes.strength_squat_kg::text,
        athletes.strength_bench_press_kg::text,
        athletes.strength_deadlift_kg::text,
        athletes.strength_pull_ups_max,
        athletes.strength_grip_left_kg::text,
        athletes.strength_grip_right_kg::text,
        athletes.strength_notes,
        athletes.strengths,
        athletes.weaknesses,
        athletes.injuries_or_restrictions,
        athletes.preparation_goal,
        athletes.profile_notes,
        athletes.updated_at::text AS updated_at,
        readiness.entry_date::text,
        readiness.score::text,
        readiness.status
      FROM athletes
      JOIN users ON users.id = athletes.user_id
      LEFT JOIN LATERAL (
        SELECT
          daily_readiness_entries.entry_date,
          readiness_scores.score,
          readiness_scores.status
        FROM daily_readiness_entries
        JOIN readiness_scores ON readiness_scores.readiness_entry_id = daily_readiness_entries.id
        WHERE daily_readiness_entries.athlete_id = athletes.id
        ORDER BY daily_readiness_entries.entry_date DESC
        LIMIT 1
      ) readiness ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          weight_logs.weight_kg AS current_weight_kg,
          weight_logs.log_date AS current_weight_date
        FROM weight_logs
        WHERE weight_logs.athlete_id = athletes.id
        ORDER BY weight_logs.log_date DESC, weight_logs.created_at DESC
        LIMIT 1
      ) weight ON TRUE
      WHERE athletes.id = $1
      LIMIT 1
    `,
    [input.athleteId],
  );

  const [athlete] = mapCoachAthletes(result.rows);

  if (!athlete) {
    return { status: "not_found" };
  }

  return {
    status: "attached",
    athlete,
  };
}

export async function updateCoachAthleteProfile(input: {
  athleteId: string;
  profile: CoachAthleteProfilePayload;
}): Promise<CoachAthleteSummary | null> {
  await pool.query(
    `
      UPDATE athletes
      SET
        photo_url = $2,
        birth_date = $3,
        height_cm = $4,
        sport = $5,
        discipline = $6,
        weight_class = $7,
        dominant_side = $8,
        baseline_resting_hr = $9,
        baseline_weight_kg = $10,
        wrestling_experience_years = $11,
        strength_squat_kg = $12,
        strength_bench_press_kg = $13,
        strength_deadlift_kg = $14,
        strength_pull_ups_max = $15,
        strength_grip_left_kg = $16,
        strength_grip_right_kg = $17,
        strength_notes = $18,
        strengths = $19,
        weaknesses = $20,
        injuries_or_restrictions = $21,
        preparation_goal = $22,
        profile_notes = $23,
        updated_at = NOW()
      WHERE id = $1
    `,
    [
      input.athleteId,
      input.profile.photoUrl.trim(),
      input.profile.birthDate,
      input.profile.heightCm,
      input.profile.sport.trim(),
      input.profile.discipline.trim(),
      input.profile.weightClass.trim(),
      input.profile.dominantSide.trim(),
      input.profile.baselineRestingHr,
      input.profile.baselineWeightKg,
      input.profile.wrestlingExperienceYears,
      input.profile.strengthSquatKg,
      input.profile.strengthBenchPressKg,
      input.profile.strengthDeadliftKg,
      input.profile.strengthPullUpsMax,
      input.profile.strengthGripLeftKg,
      input.profile.strengthGripRightKg,
      input.profile.strengthNotes.trim(),
      input.profile.strengths.trim(),
      input.profile.weaknesses.trim(),
      input.profile.injuriesOrRestrictions.trim(),
      input.profile.preparationGoal.trim(),
      input.profile.profileNotes.trim(),
    ],
  );

  const result = await pool.query<CoachAthleteRow>(
    `
      SELECT
        athletes.id AS athlete_id,
        users.id AS user_id,
        users.full_name,
        users.email,
        athletes.photo_url,
        athletes.birth_date::text,
        athletes.height_cm::text,
        athletes.sport,
        athletes.discipline,
        athletes.weight_class,
        athletes.dominant_side,
        athletes.baseline_resting_hr,
        athletes.baseline_weight_kg::text,
        weight.current_weight_kg::text AS current_weight_kg,
        weight.current_weight_date::text AS current_weight_date,
        athletes.wrestling_experience_years::text,
        athletes.strength_squat_kg::text,
        athletes.strength_bench_press_kg::text,
        athletes.strength_deadlift_kg::text,
        athletes.strength_pull_ups_max,
        athletes.strength_grip_left_kg::text,
        athletes.strength_grip_right_kg::text,
        athletes.strength_notes,
        athletes.strengths,
        athletes.weaknesses,
        athletes.injuries_or_restrictions,
        athletes.preparation_goal,
        athletes.profile_notes,
        athletes.updated_at::text AS updated_at,
        readiness.entry_date::text,
        readiness.score::text,
        readiness.status
      FROM athletes
      JOIN users ON users.id = athletes.user_id
      LEFT JOIN LATERAL (
        SELECT
          daily_readiness_entries.entry_date,
          readiness_scores.score,
          readiness_scores.status
        FROM daily_readiness_entries
        JOIN readiness_scores ON readiness_scores.readiness_entry_id = daily_readiness_entries.id
        WHERE daily_readiness_entries.athlete_id = athletes.id
        ORDER BY daily_readiness_entries.entry_date DESC
        LIMIT 1
      ) readiness ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          weight_logs.weight_kg AS current_weight_kg,
          weight_logs.log_date AS current_weight_date
        FROM weight_logs
        WHERE weight_logs.athlete_id = athletes.id
        ORDER BY weight_logs.log_date DESC, weight_logs.created_at DESC
        LIMIT 1
      ) weight ON TRUE
      WHERE athletes.id = $1
      LIMIT 1
    `,
    [input.athleteId],
  );

  return mapCoachAthletes(result.rows)[0] ?? null;
}

export async function getAnalyticsAthlete(athleteId: string) {
  const result = await pool.query<AnalyticsAthleteRow>(
    `
      SELECT athletes.id AS athlete_id, users.full_name AS athlete_name
      , athletes.baseline_weight_kg::text
      FROM athletes
      JOIN users ON users.id = athletes.user_id
      WHERE athletes.id = $1
      LIMIT 1
    `,
    [athleteId],
  );

  if (!result.rowCount) {
    return null;
  }

  return {
    athleteId: result.rows[0].athlete_id,
    athleteName: result.rows[0].athlete_name,
    baselineWeightKg:
      result.rows[0].baseline_weight_kg !== null
        ? Number(result.rows[0].baseline_weight_kg)
        : null,
  };
}

export async function listAnalyticsReadinessRows(
  athleteId: string,
  referenceDateText: string,
) {
  const result = await pool.query<AnalyticsReadinessRow>(
    `
      SELECT
        daily_readiness_entries.entry_date::text,
        readiness_scores.score::text,
        readiness_scores.status
      FROM daily_readiness_entries
      JOIN readiness_scores ON readiness_scores.readiness_entry_id = daily_readiness_entries.id
      WHERE daily_readiness_entries.athlete_id = $1
        AND daily_readiness_entries.entry_date BETWEEN ($2::date - INTERVAL '28 days') AND $2::date
      ORDER BY daily_readiness_entries.entry_date DESC
      LIMIT 28
    `,
    [athleteId, referenceDateText],
  );

  return result.rows.map((row) => ({
    entryDate: row.entry_date,
    score: Number(row.score),
    status: row.status,
  }));
}

export async function listAnalyticsExecutionRows(
  athleteId: string,
  referenceDateText: string,
): Promise<Array<{ dayDate: string; block: ExecutionBlock }>> {
  const result = await pool.query<AnalyticsExecutionTrendRow>(
    `
      SELECT
        assigned_plan_days.day_date::text,
        assigned_day_blocks.id AS block_id,
        exercise_results.completed,
        exercise_results.sets_completed,
        exercise_results.reps_completed,
        exercise_results.weight_kg::text,
        exercise_results.duration_minutes::text,
        exercise_results.rpe::text,
        exercise_results.notes AS result_notes,
        assigned_day_blocks.block_type,
        assigned_day_blocks.block_priority,
        assigned_day_blocks.target_duration_minutes::text,
        assigned_day_blocks.target_rpe::text,
        assigned_day_blocks.target_sets,
        assigned_day_blocks.target_reps
      FROM assigned_plans
      JOIN assigned_plan_days ON assigned_plan_days.assigned_plan_id = assigned_plans.id
      JOIN assigned_day_sessions ON assigned_day_sessions.assigned_day_id = assigned_plan_days.id
      JOIN assigned_day_blocks ON assigned_day_blocks.assigned_session_id = assigned_day_sessions.id
      LEFT JOIN exercise_results
        ON exercise_results.assigned_block_id = assigned_day_blocks.id
       AND exercise_results.athlete_id = assigned_plans.athlete_id
      WHERE assigned_plans.athlete_id = $1
        AND assigned_plan_days.day_date BETWEEN ($2::date - INTERVAL '35 days') AND ($2::date + INTERVAL '14 days')
      ORDER BY assigned_plan_days.day_date DESC, assigned_day_blocks.display_order ASC
    `,
    [athleteId, referenceDateText],
  );

  return result.rows.map((row) => ({
    dayDate: row.day_date,
    block: {
      blockId: row.block_id,
      completed: row.completed,
      setsCompleted: row.sets_completed,
      repsCompleted: row.reps_completed,
      weightKg: row.weight_kg !== null ? Number(row.weight_kg) : null,
      durationMinutes: row.duration_minutes !== null ? Number(row.duration_minutes) : null,
      rpe: row.rpe !== null ? Number(row.rpe) : null,
      resultNotes: row.result_notes ?? "",
      blockType: row.block_type,
      blockPriority: row.block_priority,
      targetDurationMinutes:
        row.target_duration_minutes !== null ? Number(row.target_duration_minutes) : null,
      targetRpe: row.target_rpe !== null ? Number(row.target_rpe) : null,
      targetSets: row.target_sets ?? null,
      targetReps: row.target_reps ?? null,
    },
  }));
}

export async function listWeightLogRows(
  athleteId: string,
  referenceDateText: string,
) {
  const result = await pool.query<WeightLogRow>(
    `
      SELECT
        log_date::text,
        weight_kg::text
      FROM weight_logs
      WHERE athlete_id = $1
        AND log_date BETWEEN ($2::date - INTERVAL '28 days') AND $2::date
      ORDER BY log_date DESC
      LIMIT 28
    `,
    [athleteId, referenceDateText],
  );

  return result.rows.map((row) => ({
    date: row.log_date,
    weightKg: Number(row.weight_kg),
  }));
}

export async function listTrainingLoadLogRows(
  athleteId: string,
  referenceDateText: string,
) {
  const result = await pool.query<TrainingLoadLogRow>(
    `
      SELECT
        log_date::text,
        planned_load::text,
        actual_load::text,
        actual_rpe::text,
        actual_duration_minutes::text
      FROM training_load_logs
      WHERE athlete_id = $1
        AND log_date BETWEEN ($2::date - INTERVAL '35 days') AND $2::date
      ORDER BY log_date DESC
    `,
    [athleteId, referenceDateText],
  );

  return result.rows.map((row) => ({
    date: row.log_date,
    plannedLoad: Number(row.planned_load),
    actualLoad: Number(row.actual_load),
    actualRpe: row.actual_rpe !== null ? Number(row.actual_rpe) : null,
    actualDurationMinutes:
      row.actual_duration_minutes !== null ? Number(row.actual_duration_minutes) : null,
  }));
}

export async function listAnalyticsCoachActionDecisions(
  athleteId: string,
  limit = 12,
): Promise<StoredAnalyticsCoachActionDecision[]> {
  const result = await pool.query<AnalyticsDecisionRow>(
    `
      SELECT
        id,
        athlete_id,
        coach_user_id,
        suggestion_id,
        suggestion_title,
        suggestion_level,
        source_code,
        week_start_date::text,
        NULLIF(week_label, '') AS week_label,
        decision_status,
        outcome_status,
        planner_bridge_json,
        baseline_snapshot_json,
        decision_notes,
        outcome_notes,
        created_at::text,
        updated_at::text
      FROM analytics_action_decisions
      WHERE athlete_id = $1
      ORDER BY updated_at DESC, created_at DESC
      LIMIT $2
    `,
    [athleteId, limit],
  );

  return result.rows.map(mapStoredDecision);
}

export async function listAnalyticsCoachActionDecisionsForWindow(input: {
  athleteId: string;
  horizonDays: number;
  anchorDateText?: string;
}) {
  const result = await pool.query<AnalyticsDecisionRow>(
    `
      SELECT
        id,
        athlete_id,
        coach_user_id,
        suggestion_id,
        suggestion_title,
        suggestion_level,
        source_code,
        week_start_date::text,
        NULLIF(week_label, '') AS week_label,
        decision_status,
        outcome_status,
        planner_bridge_json,
        baseline_snapshot_json,
        decision_notes,
        outcome_notes,
        created_at::text,
        updated_at::text
      FROM analytics_action_decisions
      WHERE athlete_id = $1
        AND week_start_date >= ($2::date - ($3::text || ' days')::interval)
      ORDER BY updated_at DESC, created_at DESC
    `,
    [
      input.athleteId,
      input.anchorDateText ?? new Date().toISOString().slice(0, 10),
      input.horizonDays,
    ],
  );

  return result.rows.map(mapStoredDecision);
}

export async function upsertAnalyticsCoachActionDecision(
  input: SaveAnalyticsCoachActionDecisionInput,
): Promise<StoredAnalyticsCoachActionDecision> {
  const result = await pool.query<AnalyticsDecisionRow>(
    `
      INSERT INTO analytics_action_decisions (
        athlete_id,
        coach_user_id,
        suggestion_id,
        suggestion_title,
        suggestion_level,
        source_code,
        week_start_date,
        week_label,
        decision_status,
        outcome_status,
        planner_bridge_json,
        baseline_snapshot_json,
        decision_notes,
        outcome_notes,
        client_request_id
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7::date,
        $8,
        $9,
        $10,
        $11::jsonb,
        $12::jsonb,
        $13,
        $14,
        $15
      )
      ON CONFLICT (athlete_id, suggestion_id, week_start_date)
      DO UPDATE SET
        coach_user_id = EXCLUDED.coach_user_id,
        suggestion_title = EXCLUDED.suggestion_title,
        suggestion_level = EXCLUDED.suggestion_level,
        source_code = EXCLUDED.source_code,
        week_label = EXCLUDED.week_label,
        decision_status = EXCLUDED.decision_status,
        outcome_status = EXCLUDED.outcome_status,
        planner_bridge_json = EXCLUDED.planner_bridge_json,
        decision_notes = EXCLUDED.decision_notes,
        outcome_notes = EXCLUDED.outcome_notes,
        client_request_id = COALESCE(EXCLUDED.client_request_id, analytics_action_decisions.client_request_id),
        updated_at = NOW()
      RETURNING
        id,
        athlete_id,
        coach_user_id,
        suggestion_id,
        suggestion_title,
        suggestion_level,
        source_code,
        week_start_date::text,
        NULLIF(week_label, '') AS week_label,
        decision_status,
        outcome_status,
        planner_bridge_json,
        baseline_snapshot_json,
        decision_notes,
        outcome_notes,
        created_at::text,
        updated_at::text
    `,
    [
      input.athleteId,
      input.coachUserId,
      input.suggestionId,
      input.suggestionTitle,
      input.suggestionLevel,
      input.sourceCode,
      input.weekStartDate,
      input.weekLabel ?? "",
      input.decisionStatus,
      input.outcome ?? "pending",
      JSON.stringify(input.plannerBridge ?? null),
      JSON.stringify(input.baselineSnapshot ?? null),
      input.decisionNotes ?? "",
      input.outcomeNotes ?? "",
      input.clientRequestId ?? null,
    ],
  );

  return mapStoredDecision(result.rows[0]);
}
