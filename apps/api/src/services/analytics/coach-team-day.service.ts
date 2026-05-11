import type {
  CoachTeamDayExecutionStatus,
  CoachTeamDayResponse,
  CoachTeamDayRowSummary,
  DeviceHealthDailySummary,
  DeviceHealthOxygenSaturationSummary,
  DeviceHealthProvider,
  ReadinessEntry,
  ReadinessReason,
  ReadinessStatus,
} from "@training-platform/shared";
import { pool } from "../../db";

interface CoachTeamDayCacheRow {
  rows_json: CoachTeamDayRowSummary[];
  computed_at: string;
}

interface CoachTeamDayDirtyFlagRow {
  coach_user_id: string;
  role: string;
  entry_date: string;
  reason: string;
  attempts: number;
}

interface CoachTeamDaySourceFingerprintRow {
  source_fingerprint: string;
}

interface CoachTeamDayRow {
  athlete_id: string;
  data_updated_at: string | null;
  readiness_id: string | null;
  readiness_created_at: string | null;
  readiness_entry_date: string | null;
  sleep_hours: string | null;
  sleep_quality: number | null;
  general_feeling: number | null;
  fatigue_level: number | null;
  muscle_soreness: number | null;
  motivation_level: number | null;
  resting_hr: number | null;
  body_weight: string | null;
  pain_level: number | null;
  illness_flag: boolean | null;
  fever_flag: boolean | null;
  readiness_score: string | null;
  readiness_status: ReadinessStatus | null;
  readiness_explanation: ReadinessReason[] | null;
  planned_blocks: string;
  completed_blocks: string;
  partial_blocks: string;
  execution_result_count: string;
  planned_load: string;
  actual_load: string;
  device_confirmed_blocks: string;
  device_confirmed_load: string;
  manual_actual_load: string;
  manual_execution_result_count: string;
  device_health_id: string | null;
  device_health_provider: DeviceHealthProvider | null;
  device_health_entry_date: string | null;
  device_health_source_device: string | null;
  sleep_start_time: string | null;
  sleep_end_time: string | null;
  sleep_duration_minutes: string | null;
  deep_sleep_minutes: string | null;
  light_sleep_minutes: string | null;
  rem_sleep_minutes: string | null;
  awake_minutes: string | null;
  sleep_score: string | null;
  device_resting_hr: string | null;
  average_hr: string | null;
  min_hr: string | null;
  max_hr: string | null;
  hrv_rmssd_ms: string | null;
  oxygen_saturation_avg_percent: string | null;
  oxygen_saturation_min_percent: string | null;
  oxygen_saturation_max_percent: string | null;
  oxygen_saturation_latest_percent: string | null;
  oxygen_saturation_sample_count: number | null;
  workout_count: number | null;
  workout_duration_minutes: string | null;
  workout_distance_meters: string | null;
  workout_active_calories: string | null;
  workout_average_hr: string | null;
  workout_max_hr: string | null;
  device_health_raw_payload_json: Record<string, unknown> | null;
  device_health_synced_at: string | null;
  device_health_created_at: string | null;
  device_health_updated_at: string | null;
  device_workout_count: string;
  device_workout_linked_count: string;
  device_workout_synced_at: string | null;
  coach_comment_updated_at: string | null;
}

function toNullableNumber(value: string | number | null) {
  return value !== null ? Number(value) : null;
}

function buildReadinessEntry(row: CoachTeamDayRow): ReadinessEntry | null {
  if (!row.readiness_id || !row.readiness_entry_date || !row.readiness_status) {
    return null;
  }

  return {
    athleteId: row.athlete_id,
    bodyWeight: Number(row.body_weight ?? 0),
    createdAt: row.readiness_created_at ?? "",
    entryDate: row.readiness_entry_date,
    explanation: row.readiness_explanation ?? [],
    fatigueLevel: row.fatigue_level ?? 0,
    feverFlag: row.fever_flag ?? false,
    generalFeeling: row.general_feeling ?? 0,
    id: row.readiness_id,
    illnessFlag: row.illness_flag ?? false,
    motivationLevel: row.motivation_level ?? 0,
    muscleSoreness: row.muscle_soreness ?? 0,
    painLevel: row.pain_level ?? 0,
    restingHr: row.resting_hr ?? 0,
    score: Number(row.readiness_score ?? 0),
    sleepHours: Number(row.sleep_hours ?? 0),
    sleepQuality: row.sleep_quality ?? 0,
    status: row.readiness_status,
  };
}

function buildDeviceOxygenSummary(
  row: CoachTeamDayRow,
): DeviceHealthOxygenSaturationSummary | null {
  const summary = {
    averagePercent: toNullableNumber(row.oxygen_saturation_avg_percent),
    latestPercent: toNullableNumber(row.oxygen_saturation_latest_percent),
    maxPercent: toNullableNumber(row.oxygen_saturation_max_percent),
    minPercent: toNullableNumber(row.oxygen_saturation_min_percent),
    sampleCount: row.oxygen_saturation_sample_count ?? 0,
  };

  return summary.sampleCount > 0 ||
    summary.averagePercent !== null ||
    summary.latestPercent !== null ||
    summary.maxPercent !== null ||
    summary.minPercent !== null
    ? summary
    : null;
}

function buildDeviceHealthSummary(
  row: CoachTeamDayRow,
): DeviceHealthDailySummary | null {
  if (!row.device_health_id || !row.device_health_provider || !row.device_health_entry_date) {
    return null;
  }

  return {
    athleteId: row.athlete_id,
    createdAt: row.device_health_created_at ?? "",
    entryDate: row.device_health_entry_date,
    heartRate: {
      averageBpm: toNullableNumber(row.average_hr),
      hrvRmssdMs: toNullableNumber(row.hrv_rmssd_ms),
      maxBpm: toNullableNumber(row.max_hr),
      minBpm: toNullableNumber(row.min_hr),
      restingBpm: toNullableNumber(row.device_resting_hr),
    },
    id: row.device_health_id,
    oxygenSaturation: buildDeviceOxygenSummary(row),
    provider: row.device_health_provider,
    rawPayload: row.device_health_raw_payload_json,
    sleep: {
      awakeMinutes: toNullableNumber(row.awake_minutes),
      deepMinutes: toNullableNumber(row.deep_sleep_minutes),
      durationMinutes: toNullableNumber(row.sleep_duration_minutes),
      endTime: row.sleep_end_time,
      lightMinutes: toNullableNumber(row.light_sleep_minutes),
      remMinutes: toNullableNumber(row.rem_sleep_minutes),
      score: toNullableNumber(row.sleep_score),
      startTime: row.sleep_start_time,
    },
    sourceDevice: row.device_health_source_device,
    syncedAt: row.device_health_synced_at ?? "",
    updatedAt: row.device_health_updated_at ?? "",
    workout: {
      activeCalories: toNullableNumber(row.workout_active_calories),
      averageHeartRateBpm: toNullableNumber(row.workout_average_hr),
      count: row.workout_count ?? 0,
      maxHeartRateBpm: toNullableNumber(row.workout_max_hr),
      totalDistanceMeters: toNullableNumber(row.workout_distance_meters),
      totalDurationMinutes: toNullableNumber(row.workout_duration_minutes),
    },
  };
}

function resolveExecutionStatus(input: {
  completedBlocks: number;
  executionResultCount: number;
  plannedBlocks: number;
}): CoachTeamDayExecutionStatus {
  if (input.plannedBlocks === 0) {
    return "no_plan";
  }

  if (input.executionResultCount === 0) {
    return "no_execution";
  }

  if (input.completedBlocks >= input.plannedBlocks) {
    return "completed";
  }

  return "partial";
}

function normalizeDateText(value: string | Date) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function dirtyReferenceDates(entryDate: string | Date) {
  return Array.from(
    new Set([
      normalizeDateText(entryDate),
      new Date().toISOString().slice(0, 10),
    ]),
  );
}

export async function markCoachTeamDayDirty(input: {
  coachUserId: string;
  role?: string;
  entryDate: string | Date;
  reason?: string;
}) {
  await pool.query(
    `
      WITH dirty_dates AS (
        SELECT DISTINCT unnest($3::date[]) AS entry_date
      )
      INSERT INTO coach_team_day_dirty_flags (
        coach_user_id,
        role,
        entry_date,
        reason,
        attempts,
        last_error,
        marked_at,
        next_attempt_at,
        processed_at
      )
      SELECT
        $1,
        $2,
        dirty_dates.entry_date,
        $4,
        0,
        NULL,
        NOW(),
        NOW(),
        NULL
      FROM dirty_dates
      ON CONFLICT (coach_user_id, role, entry_date)
      DO UPDATE SET
        reason = EXCLUDED.reason,
        attempts = 0,
        last_error = NULL,
        marked_at = NOW(),
        next_attempt_at = NOW(),
        processed_at = NULL
    `,
    [
      input.coachUserId,
      input.role ?? "coach",
      dirtyReferenceDates(input.entryDate),
      input.reason ?? "data_changed",
    ],
  );
}

export async function markCoachTeamDayDirtyForAthlete(input: {
  athleteId: string;
  entryDate: string | Date;
  reason?: string;
}) {
  await pool.query(
    `
      WITH dirty_dates AS (
        SELECT DISTINCT unnest($2::date[]) AS entry_date
      ),
      coach_rows AS (
        SELECT DISTINCT coach_user_id
        FROM coach_athletes
        WHERE athlete_id = $1
      )
      INSERT INTO coach_team_day_dirty_flags (
        coach_user_id,
        role,
        entry_date,
        reason,
        attempts,
        last_error,
        marked_at,
        next_attempt_at,
        processed_at
      )
      SELECT
        coach_rows.coach_user_id,
        'coach',
        dirty_dates.entry_date,
        $3,
        0,
        NULL,
        NOW(),
        NOW(),
        NULL
      FROM coach_rows
      CROSS JOIN dirty_dates
      ON CONFLICT (coach_user_id, role, entry_date)
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
      dirtyReferenceDates(input.entryDate),
      input.reason ?? "data_changed",
    ],
  );
}

export async function listPendingCoachTeamDayDirtyFlags(limit = 8) {
  const result = await pool.query<CoachTeamDayDirtyFlagRow>(
    `
      SELECT
        coach_user_id,
        role,
        entry_date::text,
        reason,
        attempts
      FROM coach_team_day_dirty_flags
      WHERE processed_at IS NULL
        AND next_attempt_at <= NOW()
      ORDER BY next_attempt_at ASC, marked_at ASC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows.map((row) => ({
    attempts: row.attempts,
    coachUserId: row.coach_user_id,
    entryDate: row.entry_date,
    reason: row.reason,
    role: row.role,
  }));
}

export async function countPendingCoachTeamDayDirtyFlags() {
  const result = await pool.query<{ pending_count: string }>(
    `
      SELECT COUNT(*)::text AS pending_count
      FROM coach_team_day_dirty_flags
      WHERE processed_at IS NULL
    `,
  );

  return Number(result.rows[0]?.pending_count ?? 0);
}

export async function markCoachTeamDayDirtyProcessed(input: {
  coachUserId: string;
  role: string;
  entryDate: string | Date;
}) {
  await pool.query(
    `
      UPDATE coach_team_day_dirty_flags
      SET processed_at = NOW(),
          last_error = NULL
      WHERE coach_user_id = $1
        AND role = $2
        AND entry_date = $3::date
    `,
    [input.coachUserId, input.role, input.entryDate],
  );
}

export async function markCoachTeamDayDirtyFailed(input: {
  coachUserId: string;
  role: string;
  entryDate: string | Date;
  errorMessage: string;
}) {
  await pool.query(
    `
      UPDATE coach_team_day_dirty_flags
      SET attempts = attempts + 1,
          last_error = $4,
          next_attempt_at = NOW() + INTERVAL '5 minutes'
      WHERE coach_user_id = $1
        AND role = $2
        AND entry_date = $3::date
    `,
    [input.coachUserId, input.role, input.entryDate, input.errorMessage],
  );
}

async function buildCoachTeamDaySourceFingerprint(input: {
  coachUserId: string;
  role: string;
  entryDate: string;
}) {
  const result = await pool.query<CoachTeamDaySourceFingerprintRow>(
    `
      WITH roster AS (
        SELECT DISTINCT
          athletes.id AS athlete_id,
          coach_athletes.created_at AS linked_at
        FROM coach_athletes
        JOIN athletes ON athletes.id = coach_athletes.athlete_id
        JOIN users ON users.id = athletes.user_id
        WHERE users.role = 'athlete'
          AND (coach_athletes.coach_user_id = $1 OR $2 = 'admin')
      ),
      source_versions AS (
        SELECT 'schema' AS source_name, 1::bigint AS row_count, 'coach-team-day-v3' AS marker
        UNION ALL
        SELECT
          'roster' AS source_name,
          COUNT(*)::bigint AS row_count,
          COALESCE(MAX(roster.linked_at)::text, '') AS marker
        FROM roster
        UNION ALL
        SELECT
          'athlete_profile',
          COUNT(*)::bigint,
          COALESCE(MAX(GREATEST(athletes.updated_at, users.created_at))::text, '')
        FROM roster
        JOIN athletes ON athletes.id = roster.athlete_id
        JOIN users ON users.id = athletes.user_id
        UNION ALL
        SELECT
          'readiness_entries',
          COUNT(*)::bigint,
          COALESCE(MAX(GREATEST(daily_readiness_entries.created_at, daily_readiness_entries.updated_at))::text, '')
        FROM daily_readiness_entries
        JOIN roster ON roster.athlete_id = daily_readiness_entries.athlete_id
        WHERE daily_readiness_entries.entry_date = $3::date
        UNION ALL
        SELECT
          'readiness_scores',
          COUNT(*)::bigint,
          COALESCE(MAX(GREATEST(readiness_scores.created_at, readiness_scores.updated_at))::text, '')
        FROM daily_readiness_entries
        JOIN readiness_scores ON readiness_scores.readiness_entry_id = daily_readiness_entries.id
        JOIN roster ON roster.athlete_id = daily_readiness_entries.athlete_id
        WHERE daily_readiness_entries.entry_date = $3::date
        UNION ALL
        SELECT
          'assigned_day_blocks',
          COUNT(*)::bigint,
          COALESCE(MAX(assigned_plans.created_at)::text, '')
        FROM assigned_plans
        JOIN assigned_plan_days ON assigned_plan_days.assigned_plan_id = assigned_plans.id
        JOIN assigned_day_sessions ON assigned_day_sessions.assigned_day_id = assigned_plan_days.id
        JOIN assigned_day_blocks ON assigned_day_blocks.assigned_session_id = assigned_day_sessions.id
        JOIN roster ON roster.athlete_id = assigned_plans.athlete_id
        WHERE assigned_plan_days.day_date = $3::date
          AND assigned_plans.status = 'active'
        UNION ALL
        SELECT
          'training_load_logs',
          COUNT(*)::bigint,
          COALESCE(MAX(GREATEST(training_load_logs.created_at, training_load_logs.updated_at))::text, '')
        FROM training_load_logs
        JOIN roster ON roster.athlete_id = training_load_logs.athlete_id
        WHERE training_load_logs.log_date = $3::date
        UNION ALL
        SELECT
          'exercise_results',
          COUNT(*)::bigint,
          COALESCE(MAX(GREATEST(exercise_results.created_at, exercise_results.updated_at))::text, '')
        FROM exercise_results
        JOIN roster ON roster.athlete_id = exercise_results.athlete_id
        WHERE exercise_results.training_date = $3::date
        UNION ALL
        SELECT
          'device_health_daily_summaries',
          COUNT(*)::bigint,
          COALESCE(MAX(GREATEST(device_health_daily_summaries.synced_at, device_health_daily_summaries.updated_at))::text, '')
        FROM device_health_daily_summaries
        JOIN roster ON roster.athlete_id = device_health_daily_summaries.athlete_id
        WHERE device_health_daily_summaries.entry_date = $3::date
        UNION ALL
        SELECT
          'device_workouts',
          COUNT(*)::bigint,
          COALESCE(MAX(GREATEST(device_workouts.synced_at, device_workouts.updated_at))::text, '')
        FROM device_workouts
        JOIN roster ON roster.athlete_id = device_workouts.athlete_id
        WHERE device_workouts.entry_date = $3::date
        UNION ALL
        SELECT
          'training_plan_device_links',
          COUNT(*)::bigint,
          COALESCE(MAX(training_plan_device_links.linked_at)::text, '')
        FROM training_plan_device_links
        JOIN device_workouts ON device_workouts.id = training_plan_device_links.device_workout_id
        JOIN roster ON roster.athlete_id = training_plan_device_links.athlete_id
        WHERE device_workouts.entry_date = $3::date
        UNION ALL
        SELECT
          'coach_diary_entries',
          COUNT(*)::bigint,
          COALESCE(MAX(GREATEST(coach_diary_entries.created_at, coach_diary_entries.updated_at))::text, '')
        FROM coach_diary_entries
        JOIN roster ON roster.athlete_id = coach_diary_entries.athlete_id
        WHERE coach_diary_entries.entry_date = $3::date
          AND (coach_diary_entries.coach_user_id = $1 OR $2 = 'admin')
        UNION ALL
        SELECT
          'coach_ai_day_reviews',
          COUNT(*)::bigint,
          COALESCE(MAX(coach_ai_day_reviews.generated_at)::text, '')
        FROM coach_ai_day_reviews
        JOIN roster ON roster.athlete_id = coach_ai_day_reviews.athlete_id
        WHERE coach_ai_day_reviews.entry_date = $3::date
          AND (coach_ai_day_reviews.coach_user_id = $1 OR $2 = 'admin')
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
    [input.coachUserId, input.role, input.entryDate],
  );

  return result.rows[0]?.source_fingerprint ?? "";
}

async function getCachedCoachTeamDay(input: {
  coachUserId: string;
  role: string;
  entryDate: string;
  sourceFingerprint: string;
}) {
  const result = await pool.query<CoachTeamDayCacheRow>(
    `
      SELECT rows_json, computed_at::text
      FROM coach_team_day_cache
      WHERE coach_user_id = $1
        AND role = $2
        AND entry_date = $3::date
        AND source_fingerprint = $4
      LIMIT 1
    `,
    [input.coachUserId, input.role, input.entryDate, input.sourceFingerprint],
  );

  return result.rows[0] ?? null;
}

async function saveCachedCoachTeamDay(input: {
  coachUserId: string;
  role: string;
  entryDate: string;
  sourceFingerprint: string;
  rows: CoachTeamDayRowSummary[];
}) {
  const result = await pool.query<{ computed_at: string }>(
    `
      INSERT INTO coach_team_day_cache (
        coach_user_id,
        role,
        entry_date,
        source_fingerprint,
        rows_json,
        computed_at
      )
      VALUES ($1, $2, $3::date, $4, $5::jsonb, NOW())
      ON CONFLICT (coach_user_id, role, entry_date)
      DO UPDATE SET
        source_fingerprint = EXCLUDED.source_fingerprint,
        rows_json = EXCLUDED.rows_json,
        computed_at = NOW()
      RETURNING computed_at::text
    `,
    [
      input.coachUserId,
      input.role,
      input.entryDate,
      input.sourceFingerprint,
      JSON.stringify(input.rows),
    ],
  );

  return result.rows[0]?.computed_at ?? new Date().toISOString();
}

async function buildCoachTeamDayRows(input: {
  coachUserId: string;
  role: string;
  entryDate: string;
}): Promise<CoachTeamDayRowSummary[]> {
  const result = await pool.query<CoachTeamDayRow>(
    `
      WITH roster AS (
        SELECT DISTINCT athletes.id AS athlete_id
        FROM coach_athletes
        JOIN athletes ON athletes.id = coach_athletes.athlete_id
        JOIN users ON users.id = athletes.user_id
        WHERE users.role = 'athlete'
          AND (coach_athletes.coach_user_id = $1 OR $2 = 'admin')
      ),
      readiness_day AS (
        SELECT
          daily_readiness_entries.id,
          daily_readiness_entries.athlete_id,
          daily_readiness_entries.entry_date,
          daily_readiness_entries.sleep_hours,
          daily_readiness_entries.sleep_quality,
          daily_readiness_entries.general_feeling,
          daily_readiness_entries.fatigue_level,
          daily_readiness_entries.muscle_soreness,
          daily_readiness_entries.motivation_level,
          daily_readiness_entries.resting_hr,
          daily_readiness_entries.body_weight,
          daily_readiness_entries.pain_level,
          daily_readiness_entries.illness_flag,
          daily_readiness_entries.fever_flag,
          daily_readiness_entries.created_at,
          readiness_scores.score,
          readiness_scores.status,
          readiness_scores.explanation,
          GREATEST(daily_readiness_entries.updated_at, readiness_scores.updated_at) AS updated_at
        FROM daily_readiness_entries
        JOIN readiness_scores ON readiness_scores.readiness_entry_id = daily_readiness_entries.id
        JOIN roster ON roster.athlete_id = daily_readiness_entries.athlete_id
        WHERE daily_readiness_entries.entry_date = $3::date
      ),
      plans_day AS (
        SELECT
          assigned_plans.athlete_id,
          COUNT(assigned_day_blocks.id)::integer AS planned_blocks,
          MAX(assigned_plans.created_at) AS updated_at
        FROM assigned_plans
        JOIN assigned_plan_days ON assigned_plan_days.assigned_plan_id = assigned_plans.id
        JOIN assigned_day_sessions ON assigned_day_sessions.assigned_day_id = assigned_plan_days.id
        JOIN assigned_day_blocks ON assigned_day_blocks.assigned_session_id = assigned_day_sessions.id
        JOIN roster ON roster.athlete_id = assigned_plans.athlete_id
        WHERE assigned_plan_days.day_date = $3::date
          AND assigned_plans.status = 'active'
        GROUP BY assigned_plans.athlete_id
      ),
      load_day AS (
        SELECT
          training_load_logs.athlete_id,
          SUM(training_load_logs.planned_load) AS planned_load,
          SUM(training_load_logs.actual_load) AS actual_load,
          MAX(GREATEST(training_load_logs.created_at, training_load_logs.updated_at)) AS updated_at
        FROM training_load_logs
        JOIN roster ON roster.athlete_id = training_load_logs.athlete_id
        WHERE training_load_logs.log_date = $3::date
        GROUP BY training_load_logs.athlete_id
      ),
      execution_day AS (
        SELECT
          exercise_results.athlete_id,
          COUNT(*)::integer AS execution_result_count,
          COUNT(*) FILTER (WHERE exercise_results.completed)::integer AS completed_blocks,
          COUNT(*) FILTER (WHERE NOT exercise_results.completed)::integer AS partial_blocks,
          MAX(GREATEST(exercise_results.created_at, exercise_results.updated_at)) AS updated_at
        FROM exercise_results
        JOIN roster ON roster.athlete_id = exercise_results.athlete_id
        WHERE exercise_results.training_date = $3::date
        GROUP BY exercise_results.athlete_id
      ),
      device_health_ranked AS (
        SELECT
          device_health_daily_summaries.*,
          ROW_NUMBER() OVER (
            PARTITION BY device_health_daily_summaries.athlete_id
            ORDER BY
              (
                CASE WHEN device_health_daily_summaries.sleep_duration_minutes IS NOT NULL THEN 1 ELSE 0 END +
                CASE WHEN device_health_daily_summaries.resting_hr IS NOT NULL THEN 1 ELSE 0 END +
                CASE WHEN device_health_daily_summaries.workout_count > 0 THEN 1 ELSE 0 END
              ) DESC,
              device_health_daily_summaries.synced_at DESC
          ) AS row_number
        FROM device_health_daily_summaries
        JOIN roster ON roster.athlete_id = device_health_daily_summaries.athlete_id
        WHERE device_health_daily_summaries.entry_date = $3::date
      ),
      device_health_day AS (
        SELECT *
        FROM device_health_ranked
        WHERE row_number = 1
      ),
      device_workouts_day AS (
        SELECT
          device_workouts.athlete_id,
          COUNT(*)::integer AS workout_count,
          MAX(GREATEST(device_workouts.synced_at, device_workouts.updated_at)) AS synced_at
        FROM device_workouts
        JOIN roster ON roster.athlete_id = device_workouts.athlete_id
        WHERE device_workouts.entry_date = $3::date
        GROUP BY device_workouts.athlete_id
      ),
      device_links_day AS (
        SELECT
          training_plan_device_links.athlete_id,
          COUNT(*)::integer AS linked_count,
          MAX(training_plan_device_links.linked_at) AS linked_at
        FROM training_plan_device_links
        JOIN device_workouts ON device_workouts.id = training_plan_device_links.device_workout_id
        JOIN roster ON roster.athlete_id = training_plan_device_links.athlete_id
        WHERE device_workouts.entry_date = $3::date
        GROUP BY training_plan_device_links.athlete_id
      ),
      device_confirmed_load_day AS (
        SELECT
          link_targets.athlete_id,
          COUNT(*)::integer AS confirmed_blocks,
          SUM(link_targets.planned_load) AS confirmed_planned_load,
          MAX(link_targets.linked_at) AS linked_at
        FROM (
          SELECT
            training_plan_device_links.athlete_id,
            training_plan_device_links.assigned_block_id,
            MAX(COALESCE(training_load_logs.planned_load, 0)) AS planned_load,
            MAX(training_plan_device_links.linked_at) AS linked_at
          FROM training_plan_device_links
          JOIN device_workouts
            ON device_workouts.id = training_plan_device_links.device_workout_id
          JOIN assigned_plans
            ON assigned_plans.id = training_plan_device_links.assigned_plan_id
          JOIN assigned_plan_days
            ON assigned_plan_days.assigned_plan_id = assigned_plans.id
          JOIN assigned_day_sessions
            ON assigned_day_sessions.assigned_day_id = assigned_plan_days.id
          JOIN assigned_day_blocks
            ON assigned_day_blocks.id = training_plan_device_links.assigned_block_id
           AND assigned_day_blocks.assigned_session_id = assigned_day_sessions.id
          JOIN roster ON roster.athlete_id = training_plan_device_links.athlete_id
          LEFT JOIN training_load_logs
            ON training_load_logs.athlete_id = training_plan_device_links.athlete_id
           AND training_load_logs.assigned_block_id = training_plan_device_links.assigned_block_id
           AND training_load_logs.log_date = device_workouts.entry_date
          WHERE device_workouts.entry_date = $3::date
            AND assigned_plan_days.day_date = $3::date
            AND assigned_plans.status = 'active'
          GROUP BY
            training_plan_device_links.athlete_id,
            training_plan_device_links.assigned_block_id
        ) link_targets
        GROUP BY link_targets.athlete_id
      ),
      device_confirmed_blocks AS (
        SELECT
          link_targets.athlete_id,
          COUNT(*)::integer AS confirmed_blocks,
          SUM(link_targets.planned_load) AS confirmed_planned_load,
          MAX(link_targets.linked_at) AS linked_at
        FROM (
          SELECT
            training_plan_device_links.athlete_id,
            training_plan_device_links.assigned_block_id,
            MAX(COALESCE(training_load_logs.planned_load, 0)) AS planned_load,
            MAX(training_plan_device_links.linked_at) AS linked_at
          FROM training_plan_device_links
          JOIN device_workouts
            ON device_workouts.id = training_plan_device_links.device_workout_id
          JOIN assigned_plans
            ON assigned_plans.id = training_plan_device_links.assigned_plan_id
          JOIN assigned_plan_days
            ON assigned_plan_days.assigned_plan_id = assigned_plans.id
          JOIN assigned_day_sessions
            ON assigned_day_sessions.assigned_day_id = assigned_plan_days.id
          JOIN assigned_day_blocks
            ON assigned_day_blocks.id = training_plan_device_links.assigned_block_id
           AND assigned_day_blocks.assigned_session_id = assigned_day_sessions.id
          JOIN roster ON roster.athlete_id = training_plan_device_links.athlete_id
          LEFT JOIN training_load_logs
            ON training_load_logs.athlete_id = training_plan_device_links.athlete_id
           AND training_load_logs.assigned_block_id = training_plan_device_links.assigned_block_id
           AND training_load_logs.log_date = device_workouts.entry_date
          LEFT JOIN exercise_results
            ON exercise_results.athlete_id = training_plan_device_links.athlete_id
           AND exercise_results.assigned_block_id = training_plan_device_links.assigned_block_id
           AND exercise_results.training_date = device_workouts.entry_date
          WHERE device_workouts.entry_date = $3::date
            AND assigned_plan_days.day_date = $3::date
            AND assigned_plans.status = 'active'
            AND exercise_results.id IS NULL
          GROUP BY
            training_plan_device_links.athlete_id,
            training_plan_device_links.assigned_block_id
        ) link_targets
        GROUP BY link_targets.athlete_id
      ),
      diary_day AS (
        SELECT
          coach_diary_entries.athlete_id,
          MAX(GREATEST(coach_diary_entries.created_at, coach_diary_entries.updated_at)) AS updated_at
        FROM coach_diary_entries
        JOIN roster ON roster.athlete_id = coach_diary_entries.athlete_id
        WHERE coach_diary_entries.entry_date = $3::date
          AND coach_diary_entries.notes <> ''
          AND (coach_diary_entries.coach_user_id = $1 OR $2 = 'admin')
        GROUP BY coach_diary_entries.athlete_id
      )
      SELECT
        roster.athlete_id::text,
        GREATEST(
          COALESCE(readiness_day.updated_at, '-infinity'::timestamptz),
          COALESCE(plans_day.updated_at, '-infinity'::timestamptz),
          COALESCE(load_day.updated_at, '-infinity'::timestamptz),
          COALESCE(execution_day.updated_at, '-infinity'::timestamptz),
          COALESCE(GREATEST(device_health_day.synced_at, device_health_day.updated_at), '-infinity'::timestamptz),
          COALESCE(device_workouts_day.synced_at, '-infinity'::timestamptz),
          COALESCE(device_links_day.linked_at, '-infinity'::timestamptz),
          COALESCE(device_confirmed_load_day.linked_at, '-infinity'::timestamptz),
          COALESCE(device_confirmed_blocks.linked_at, '-infinity'::timestamptz),
          COALESCE(diary_day.updated_at, '-infinity'::timestamptz)
        )::text AS data_updated_at,
        readiness_day.id::text AS readiness_id,
        readiness_day.created_at::text AS readiness_created_at,
        readiness_day.entry_date::text AS readiness_entry_date,
        readiness_day.sleep_hours::text,
        readiness_day.sleep_quality,
        readiness_day.general_feeling,
        readiness_day.fatigue_level,
        readiness_day.muscle_soreness,
        readiness_day.motivation_level,
        readiness_day.resting_hr,
        readiness_day.body_weight::text,
        readiness_day.pain_level,
        readiness_day.illness_flag,
        readiness_day.fever_flag,
        readiness_day.score::text AS readiness_score,
        readiness_day.status AS readiness_status,
        readiness_day.explanation AS readiness_explanation,
        COALESCE(plans_day.planned_blocks, 0)::text AS planned_blocks,
        (
          COALESCE(execution_day.completed_blocks, 0) +
          COALESCE(device_confirmed_blocks.confirmed_blocks, 0)
        )::text AS completed_blocks,
        COALESCE(execution_day.partial_blocks, 0)::text AS partial_blocks,
        (
          COALESCE(execution_day.execution_result_count, 0) +
          COALESCE(device_confirmed_blocks.confirmed_blocks, 0)
        )::text AS execution_result_count,
        COALESCE(load_day.planned_load, 0)::text AS planned_load,
        COALESCE(load_day.actual_load, 0)::text AS manual_actual_load,
        COALESCE(execution_day.execution_result_count, 0)::text AS manual_execution_result_count,
        COALESCE(device_confirmed_load_day.confirmed_blocks, 0)::text AS device_confirmed_blocks,
        (
          CASE
            WHEN COALESCE(device_confirmed_load_day.confirmed_blocks, 0) > 0 THEN
              LEAST(
                COALESCE(load_day.planned_load, 0),
                CASE
                  WHEN COALESCE(device_confirmed_load_day.confirmed_planned_load, 0) > 0
                    THEN COALESCE(device_confirmed_load_day.confirmed_planned_load, 0)
                  ELSE COALESCE(load_day.planned_load, 0)
                END
              )
            ELSE 0
          END
        )::text AS device_confirmed_load,
        (
          CASE
            WHEN COALESCE(device_confirmed_load_day.confirmed_blocks, 0) > 0 THEN
              GREATEST(
                COALESCE(load_day.actual_load, 0),
                LEAST(
                  COALESCE(load_day.planned_load, 0),
                  CASE
                    WHEN COALESCE(device_confirmed_load_day.confirmed_planned_load, 0) > 0
                      THEN COALESCE(device_confirmed_load_day.confirmed_planned_load, 0)
                    ELSE COALESCE(load_day.planned_load, 0)
                  END
                )
              )
            ELSE COALESCE(load_day.actual_load, 0)
          END
        )::text AS actual_load,
        device_health_day.id::text AS device_health_id,
        device_health_day.provider AS device_health_provider,
        device_health_day.entry_date::text AS device_health_entry_date,
        device_health_day.source_device AS device_health_source_device,
        device_health_day.sleep_start_time::text,
        device_health_day.sleep_end_time::text,
        device_health_day.sleep_duration_minutes::text,
        device_health_day.deep_sleep_minutes::text,
        device_health_day.light_sleep_minutes::text,
        device_health_day.rem_sleep_minutes::text,
        device_health_day.awake_minutes::text,
        device_health_day.sleep_score::text,
        device_health_day.resting_hr::text AS device_resting_hr,
        device_health_day.average_hr::text,
        device_health_day.min_hr::text,
        device_health_day.max_hr::text,
        device_health_day.hrv_rmssd_ms::text,
        device_health_day.oxygen_saturation_avg_percent::text,
        device_health_day.oxygen_saturation_min_percent::text,
        device_health_day.oxygen_saturation_max_percent::text,
        device_health_day.oxygen_saturation_latest_percent::text,
        device_health_day.oxygen_saturation_sample_count,
        device_health_day.workout_count,
        device_health_day.workout_duration_minutes::text,
        device_health_day.workout_distance_meters::text,
        device_health_day.workout_active_calories::text,
        device_health_day.workout_average_hr::text,
        device_health_day.workout_max_hr::text,
        device_health_day.raw_payload_json AS device_health_raw_payload_json,
        device_health_day.synced_at::text AS device_health_synced_at,
        device_health_day.created_at::text AS device_health_created_at,
        device_health_day.updated_at::text AS device_health_updated_at,
        COALESCE(device_workouts_day.workout_count, 0)::text AS device_workout_count,
        COALESCE(device_links_day.linked_count, 0)::text AS device_workout_linked_count,
        device_workouts_day.synced_at::text AS device_workout_synced_at,
        diary_day.updated_at::text AS coach_comment_updated_at
      FROM roster
      LEFT JOIN readiness_day ON readiness_day.athlete_id = roster.athlete_id
      LEFT JOIN plans_day ON plans_day.athlete_id = roster.athlete_id
      LEFT JOIN load_day ON load_day.athlete_id = roster.athlete_id
      LEFT JOIN execution_day ON execution_day.athlete_id = roster.athlete_id
      LEFT JOIN device_health_day ON device_health_day.athlete_id = roster.athlete_id
      LEFT JOIN device_workouts_day ON device_workouts_day.athlete_id = roster.athlete_id
      LEFT JOIN device_links_day ON device_links_day.athlete_id = roster.athlete_id
      LEFT JOIN device_confirmed_load_day ON device_confirmed_load_day.athlete_id = roster.athlete_id
      LEFT JOIN device_confirmed_blocks ON device_confirmed_blocks.athlete_id = roster.athlete_id
      LEFT JOIN diary_day ON diary_day.athlete_id = roster.athlete_id
      ORDER BY roster.athlete_id
    `,
    [input.coachUserId, input.role, input.entryDate],
  );

  const cachedAt = new Date().toISOString();

  return result.rows.map((row) => {
    const plannedBlocks = Number(row.planned_blocks);
    const completedBlocks = Number(row.completed_blocks);
    const executionResultCount = Number(row.execution_result_count);
    const actualLoad = Number(Number(row.actual_load).toFixed(1));
    const plannedLoad = Number(Number(row.planned_load).toFixed(1));

    return {
      actualLoad,
      athleteId: row.athlete_id,
      cachedAt,
      coachCommentUpdatedAt: row.coach_comment_updated_at,
      completedBlocks,
      dataUpdatedAt: row.data_updated_at?.includes("-infinity")
        ? null
        : row.data_updated_at,
      deviceConfirmedBlocks: Number(row.device_confirmed_blocks),
      deviceConfirmedLoad: Number(Number(row.device_confirmed_load).toFixed(1)),
      deviceHealthSummary: buildDeviceHealthSummary(row),
      deviceWorkoutCount: Number(row.device_workout_count),
      deviceWorkoutLinkedCount: Number(row.device_workout_linked_count),
      deviceWorkoutSyncedAt: row.device_workout_synced_at,
      entryDate: input.entryDate,
      executionResultCount,
      executionStatus: resolveExecutionStatus({
        completedBlocks,
        executionResultCount,
        plannedBlocks,
      }),
      loadDelta: Number((actualLoad - plannedLoad).toFixed(1)),
      manualActualLoad: Number(Number(row.manual_actual_load).toFixed(1)),
      manualExecutionResultCount: Number(row.manual_execution_result_count),
      partialBlocks: Number(row.partial_blocks),
      plannedBlocks,
      plannedLoad,
      readinessEntry: buildReadinessEntry(row),
    };
  });
}

export async function buildCoachTeamDay(input: {
  coachUserId: string;
  role: string;
  entryDate: string;
}): Promise<CoachTeamDayResponse> {
  const sourceFingerprint = await buildCoachTeamDaySourceFingerprint(input);
  const cached = await getCachedCoachTeamDay({
    ...input,
    sourceFingerprint,
  });

  if (cached) {
    return {
      computedAt: cached.computed_at,
      entryDate: input.entryDate,
      rows: cached.rows_json,
      source: "cache",
    };
  }

  const rows = await buildCoachTeamDayRows(input);
  const computedAt = await saveCachedCoachTeamDay({
    ...input,
    rows,
    sourceFingerprint,
  });

  return {
    computedAt,
    entryDate: input.entryDate,
    rows: rows.map((row) => ({ ...row, cachedAt: computedAt })),
    source: "computed",
  };
}
