import type {
  AnalyticsCoachActionDecision,
  AnalyticsCoachActionDecisionPayload,
  AnalyticsCoachActionOutcome,
  AnalyticsCoachActionSnapshot,
  AnalyticsOverview,
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
  row_kind: PlanBlockInput["rowKind"] | null;
  block_type: PlanBlockInput["blockType"];
  block_priority: number;
  target_duration_minutes: string | null;
  target_rpe: string | null;
  target_sets: number | null;
  target_reps: number | null;
  assigned_exercise_count: number;
  executed_exercise_count: number;
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

interface AnalyticsOverviewCacheRow {
  overview_json: AnalyticsOverview;
}

interface AnalyticsSourceFingerprintRow {
  source_fingerprint: string;
}

interface AnalyticsDirtyFlagRow {
  athlete_id: string;
  reference_date: string;
  reason: string;
  attempts: number;
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
        assigned_day_blocks.row_kind,
        assigned_day_blocks.block_type,
        assigned_day_blocks.block_priority,
        assigned_day_blocks.target_duration_minutes::text,
        assigned_day_blocks.target_rpe::text,
        assigned_day_blocks.target_sets,
        assigned_day_blocks.target_reps,
        COALESCE(assigned_exercises.assigned_exercise_count, 0) AS assigned_exercise_count,
        COALESCE(executed_exercises.executed_exercise_count, 0) AS executed_exercise_count
      FROM assigned_plans
      JOIN assigned_plan_days ON assigned_plan_days.assigned_plan_id = assigned_plans.id
      JOIN assigned_day_sessions ON assigned_day_sessions.assigned_day_id = assigned_plan_days.id
      JOIN assigned_day_blocks ON assigned_day_blocks.assigned_session_id = assigned_day_sessions.id
      LEFT JOIN exercise_results
        ON exercise_results.assigned_block_id = assigned_day_blocks.id
       AND exercise_results.athlete_id = assigned_plans.athlete_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS assigned_exercise_count
        FROM assigned_block_exercises
        WHERE assigned_block_exercises.assigned_block_id = assigned_day_blocks.id
      ) assigned_exercises ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT exercise_result_exercises.assigned_exercise_id)::int AS executed_exercise_count
        FROM exercise_result_exercises
        WHERE exercise_result_exercises.execution_result_id = exercise_results.id
          AND (
            exercise_result_exercises.completed = TRUE
            OR exercise_result_exercises.sets_completed IS NOT NULL
            OR exercise_result_exercises.reps_completed IS NOT NULL
            OR exercise_result_exercises.duration_minutes IS NOT NULL
            OR exercise_result_exercises.rpe IS NOT NULL
          )
      ) executed_exercises ON TRUE
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
      rowKind: row.row_kind ?? "exercise",
      blockType: row.block_type,
      blockPriority: row.block_priority,
      targetDurationMinutes:
        row.target_duration_minutes !== null ? Number(row.target_duration_minutes) : null,
      targetRpe: row.target_rpe !== null ? Number(row.target_rpe) : null,
      targetSets: row.target_sets ?? null,
      targetReps: row.target_reps ?? null,
      assignedExerciseCount: row.assigned_exercise_count ?? 0,
      executedExerciseCount: row.executed_exercise_count ?? 0,
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
        SUM(planned_load)::text AS planned_load,
        SUM(actual_load)::text AS actual_load,
        AVG(actual_rpe)::text AS actual_rpe,
        SUM(actual_duration_minutes)::text AS actual_duration_minutes
      FROM training_load_logs
      WHERE athlete_id = $1
        AND log_date BETWEEN ($2::date - INTERVAL '35 days') AND $2::date
      GROUP BY log_date
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

export async function buildAnalyticsOverviewSourceFingerprint(
  athleteId: string,
  referenceDateText: string,
  cacheSchemaVersion: string,
) {
  const result = await pool.query<AnalyticsSourceFingerprintRow>(
    `
      WITH source_versions AS (
        SELECT 'schema' AS source_name, 1::bigint AS row_count, $3::text AS marker
        UNION ALL
        SELECT
          'athlete_profile',
          COUNT(*)::bigint,
          COALESCE(MAX(GREATEST(athletes.updated_at, users.created_at))::text, '')
        FROM athletes
        JOIN users ON users.id = athletes.user_id
        WHERE athletes.id = $1
        UNION ALL
        SELECT
          'readiness_entries',
          COUNT(*)::bigint,
          COALESCE(MAX(GREATEST(daily_readiness_entries.created_at, daily_readiness_entries.updated_at))::text, '')
        FROM daily_readiness_entries
        WHERE daily_readiness_entries.athlete_id = $1
          AND daily_readiness_entries.entry_date BETWEEN ($2::date - INTERVAL '28 days') AND $2::date
        UNION ALL
        SELECT
          'readiness_scores',
          COUNT(*)::bigint,
          COALESCE(MAX(GREATEST(readiness_scores.created_at, readiness_scores.updated_at))::text, '')
        FROM daily_readiness_entries
        JOIN readiness_scores ON readiness_scores.readiness_entry_id = daily_readiness_entries.id
        WHERE daily_readiness_entries.athlete_id = $1
          AND daily_readiness_entries.entry_date BETWEEN ($2::date - INTERVAL '28 days') AND $2::date
        UNION ALL
        SELECT
          'weight_logs',
          COUNT(*)::bigint,
          COALESCE(MAX(GREATEST(weight_logs.created_at, weight_logs.updated_at))::text, '')
        FROM weight_logs
        WHERE weight_logs.athlete_id = $1
          AND weight_logs.log_date BETWEEN ($2::date - INTERVAL '28 days') AND $2::date
        UNION ALL
        SELECT
          'training_load_logs',
          COUNT(*)::bigint,
          COALESCE(MAX(GREATEST(training_load_logs.created_at, training_load_logs.updated_at))::text, '')
        FROM training_load_logs
        WHERE training_load_logs.athlete_id = $1
          AND training_load_logs.log_date BETWEEN ($2::date - INTERVAL '35 days') AND $2::date
        UNION ALL
        SELECT
          'assigned_plans',
          COUNT(*)::bigint,
          COALESCE(MAX(assigned_plans.created_at)::text, '')
        FROM assigned_plans
        WHERE assigned_plans.athlete_id = $1
        UNION ALL
        SELECT
          'assigned_plan_days',
          COUNT(*)::bigint,
          COALESCE(MAX(assigned_plans.created_at)::text, '')
        FROM assigned_plans
        JOIN assigned_plan_days ON assigned_plan_days.assigned_plan_id = assigned_plans.id
        WHERE assigned_plans.athlete_id = $1
          AND assigned_plan_days.day_date BETWEEN ($2::date - INTERVAL '35 days') AND ($2::date + INTERVAL '14 days')
        UNION ALL
        SELECT
          'assigned_day_blocks',
          COUNT(*)::bigint,
          COALESCE(MAX(assigned_plans.created_at)::text, '')
        FROM assigned_plans
        JOIN assigned_plan_days ON assigned_plan_days.assigned_plan_id = assigned_plans.id
        JOIN assigned_day_sessions ON assigned_day_sessions.assigned_day_id = assigned_plan_days.id
        JOIN assigned_day_blocks ON assigned_day_blocks.assigned_session_id = assigned_day_sessions.id
        WHERE assigned_plans.athlete_id = $1
          AND assigned_plan_days.day_date BETWEEN ($2::date - INTERVAL '35 days') AND ($2::date + INTERVAL '14 days')
        UNION ALL
        SELECT
          'assigned_block_exercises',
          COUNT(*)::bigint,
          COALESCE(MAX(assigned_plans.created_at)::text, '')
        FROM assigned_plans
        JOIN assigned_plan_days ON assigned_plan_days.assigned_plan_id = assigned_plans.id
        JOIN assigned_day_sessions ON assigned_day_sessions.assigned_day_id = assigned_plan_days.id
        JOIN assigned_day_blocks ON assigned_day_blocks.assigned_session_id = assigned_day_sessions.id
        JOIN assigned_block_exercises ON assigned_block_exercises.assigned_block_id = assigned_day_blocks.id
        WHERE assigned_plans.athlete_id = $1
          AND assigned_plan_days.day_date BETWEEN ($2::date - INTERVAL '35 days') AND ($2::date + INTERVAL '14 days')
        UNION ALL
        SELECT
          'exercise_results',
          COUNT(*)::bigint,
          COALESCE(MAX(GREATEST(exercise_results.created_at, exercise_results.updated_at))::text, '')
        FROM exercise_results
        WHERE exercise_results.athlete_id = $1
        UNION ALL
        SELECT
          'exercise_result_exercises',
          COUNT(*)::bigint,
          COALESCE(MAX(GREATEST(exercise_result_exercises.created_at, exercise_result_exercises.updated_at))::text, '')
        FROM exercise_result_exercises
        WHERE exercise_result_exercises.athlete_id = $1
        UNION ALL
        SELECT
          'seasons',
          COUNT(*)::bigint,
          COALESCE(MAX(seasons.created_at)::text, '')
        FROM seasons
        WHERE seasons.athlete_id = $1
        UNION ALL
        SELECT
          'mesocycles',
          COUNT(*)::bigint,
          COALESCE(MAX(GREATEST(mesocycles.created_at, mesocycles.updated_at))::text, '')
        FROM mesocycles
        WHERE mesocycles.athlete_id = $1
        UNION ALL
        SELECT
          'competition_plans',
          COUNT(*)::bigint,
          COALESCE(MAX(GREATEST(competition_plans.created_at, competition_plans.updated_at))::text, '')
        FROM competition_plans
        WHERE competition_plans.athlete_id = $1
        UNION ALL
        SELECT
          'competition_results',
          COUNT(*)::bigint,
          COALESCE(MAX(competition_results.created_at)::text, '')
        FROM competition_plans
        JOIN competition_results ON competition_results.competition_plan_id = competition_plans.id
        WHERE competition_plans.athlete_id = $1
        UNION ALL
        SELECT
          'analytics_action_decisions',
          COUNT(*)::bigint,
          COALESCE(MAX(GREATEST(analytics_action_decisions.created_at, analytics_action_decisions.updated_at))::text, '')
        FROM analytics_action_decisions
        WHERE analytics_action_decisions.athlete_id = $1
      )
      SELECT md5(
        string_agg(
          source_name || ':' || row_count::text || ':' || marker,
          '|'
          ORDER BY source_name
        )
      ) AS source_fingerprint
      FROM source_versions
    `,
    [athleteId, referenceDateText, cacheSchemaVersion],
  );

  return result.rows[0]?.source_fingerprint ?? "";
}

export async function getCachedAnalyticsOverview(input: {
  athleteId: string;
  referenceDateText: string;
  sourceFingerprint: string;
}) {
  const result = await pool.query<AnalyticsOverviewCacheRow>(
    `
      SELECT overview_json
      FROM analytics_overview_cache
      WHERE athlete_id = $1
        AND reference_date = $2::date
        AND source_fingerprint = $3
      LIMIT 1
    `,
    [input.athleteId, input.referenceDateText, input.sourceFingerprint],
  );

  return result.rows[0]?.overview_json ?? null;
}

export async function saveCachedAnalyticsOverview(input: {
  athleteId: string;
  referenceDateText: string;
  sourceFingerprint: string;
  overview: AnalyticsOverview;
}) {
  await pool.query(
    `
      INSERT INTO analytics_overview_cache (
        athlete_id,
        reference_date,
        source_fingerprint,
        overview_json,
        computed_at
      )
      VALUES ($1, $2::date, $3, $4::jsonb, NOW())
      ON CONFLICT (athlete_id, reference_date)
      DO UPDATE SET
        source_fingerprint = EXCLUDED.source_fingerprint,
        overview_json = EXCLUDED.overview_json,
        computed_at = NOW()
    `,
    [
      input.athleteId,
      input.referenceDateText,
      input.sourceFingerprint,
      JSON.stringify(input.overview),
    ],
  );
}

export async function markAnalyticsDirty(input: {
  athleteId: string;
  referenceDate: string | Date;
  reason?: string;
}) {
  const referenceDateText =
    input.referenceDate instanceof Date
      ? input.referenceDate.toISOString().slice(0, 10)
      : input.referenceDate.slice(0, 10);
  const currentReferenceDateText = new Date().toISOString().slice(0, 10);
  const referenceDates = Array.from(
    new Set([referenceDateText, currentReferenceDateText]),
  );

  await pool.query(
    `
      WITH dirty_dates AS (
        SELECT DISTINCT unnest($2::date[]) AS reference_date
      )
      INSERT INTO analytics_dirty_flags (
        athlete_id,
        reference_date,
        reason,
        attempts,
        last_error,
        marked_at,
        next_attempt_at,
        processed_at
      )
      SELECT
        $1,
        dirty_dates.reference_date,
        $3,
        0,
        NULL,
        NOW(),
        NOW(),
        NULL
      FROM dirty_dates
      ON CONFLICT (athlete_id, reference_date)
      DO UPDATE SET
        reason = EXCLUDED.reason,
        attempts = 0,
        last_error = NULL,
        marked_at = NOW(),
        next_attempt_at = NOW(),
        processed_at = NULL
    `,
    [
      input.athleteId,
      referenceDates,
      input.reason ?? "data_changed",
    ],
  );
}

export async function listPendingAnalyticsDirtyFlags(limit = 8) {
  const result = await pool.query<AnalyticsDirtyFlagRow>(
    `
      SELECT
        athlete_id,
        reference_date::text,
        reason,
        attempts
      FROM analytics_dirty_flags
      WHERE processed_at IS NULL
        AND next_attempt_at <= NOW()
      ORDER BY next_attempt_at ASC, marked_at ASC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows.map((row) => ({
    athleteId: row.athlete_id,
    referenceDate: row.reference_date,
    reason: row.reason,
    attempts: row.attempts,
  }));
}

export async function countPendingAnalyticsDirtyFlags() {
  const result = await pool.query<{ pending_count: string }>(
    `
      SELECT COUNT(*)::text AS pending_count
      FROM analytics_dirty_flags
      WHERE processed_at IS NULL
    `,
  );

  return Number(result.rows[0]?.pending_count ?? 0);
}

export async function markAnalyticsDirtyProcessed(input: {
  athleteId: string;
  referenceDate: string | Date;
}) {
  await pool.query(
    `
      UPDATE analytics_dirty_flags
      SET processed_at = NOW(),
          last_error = NULL
      WHERE athlete_id = $1
        AND reference_date = $2::date
    `,
    [input.athleteId, input.referenceDate],
  );
}

export async function markAnalyticsDirtyFailed(input: {
  athleteId: string;
  referenceDate: string | Date;
  errorMessage: string;
}) {
  await pool.query(
    `
      UPDATE analytics_dirty_flags
      SET attempts = attempts + 1,
          last_error = $3,
          next_attempt_at = NOW() + INTERVAL '5 minutes'
      WHERE athlete_id = $1
        AND reference_date = $2::date
    `,
    [input.athleteId, input.referenceDate, input.errorMessage],
  );
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
