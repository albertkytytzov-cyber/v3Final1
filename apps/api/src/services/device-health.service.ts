import { isDeviceWorkoutLinkablePlanBlock } from "@training-platform/shared";
import type {
  DeviceHealthDailySummary,
  DeviceHealthDailySummaryPayload,
  DeviceHealthOxygenSaturationSummary,
  DeviceHealthProvider,
  DeviceWorkout,
  DeviceWorkoutLink,
  DeviceWorkoutLinkPayload,
  DeviceWorkoutPayload,
  DeviceWorkoutSample,
  DeviceWorkoutsSyncPayload,
  PlanBlockRowKind,
} from "@training-platform/shared";
import type { PoolClient } from "pg";
import { pool } from "../db";
import { markCoachTeamDayDirtyForAthlete } from "./analytics/coach-team-day.service";
import { markAnalyticsDirty } from "./analytics/analytics-query.service";

interface DeviceHealthDailySummaryRow {
  id: string;
  athlete_id: string;
  provider: DeviceHealthProvider;
  entry_date: string;
  source_device: string | null;
  sleep_start_time: string | null;
  sleep_end_time: string | null;
  sleep_duration_minutes: string | null;
  deep_sleep_minutes: string | null;
  light_sleep_minutes: string | null;
  rem_sleep_minutes: string | null;
  awake_minutes: string | null;
  sleep_score: string | null;
  resting_hr: string | null;
  average_hr: string | null;
  min_hr: string | null;
  max_hr: string | null;
  hrv_rmssd_ms: string | null;
  oxygen_saturation_avg_percent: string | null;
  oxygen_saturation_min_percent: string | null;
  oxygen_saturation_max_percent: string | null;
  oxygen_saturation_latest_percent: string | null;
  oxygen_saturation_sample_count: number;
  workout_count: number;
  workout_duration_minutes: string | null;
  workout_distance_meters: string | null;
  workout_active_calories: string | null;
  workout_average_hr: string | null;
  workout_max_hr: string | null;
  raw_payload_json: Record<string, unknown> | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

interface DeviceWorkoutRow {
  id: string;
  athlete_id: string;
  provider: DeviceHealthProvider;
  entry_date: string;
  source_device: string | null;
  source_workout_id: string;
  workout_type: string;
  start_time: string;
  end_time: string;
  duration_minutes: string | null;
  distance_meters: string | null;
  active_calories: string | null;
  average_hr: string | null;
  max_hr: string | null;
  min_hr: string | null;
  raw_payload_json: Record<string, unknown> | null;
  sample_count: number;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

interface DeviceWorkoutSampleRow {
  id: string;
  device_workout_id: string;
  sample_time: string;
  heart_rate_bpm: string | null;
  distance_meters: string | null;
  speed_meters_per_second: string | null;
  pace_seconds_per_km: string | null;
  oxygen_saturation_percent: string | null;
  raw_payload_json: Record<string, unknown> | null;
  created_at: string;
}

interface DeviceWorkoutLinkRow {
  id: string;
  athlete_id: string;
  assigned_plan_id: string;
  assigned_block_id: string;
  assigned_exercise_id: string | null;
  device_workout_id: string;
  linked_by_user_id: string;
  linked_at: string;
  created_at: string;
}

type QueryClient = PoolClient | typeof pool;

function toNullableNumber(value: string | null) {
  return value !== null ? Number(value) : null;
}

function hasPositiveNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function hasText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function mapDeviceOxygenSaturationSummary(
  row: DeviceHealthDailySummaryRow,
): DeviceHealthOxygenSaturationSummary | null {
  const summary = {
    averagePercent: toNullableNumber(row.oxygen_saturation_avg_percent),
    latestPercent: toNullableNumber(row.oxygen_saturation_latest_percent),
    maxPercent: toNullableNumber(row.oxygen_saturation_max_percent),
    minPercent: toNullableNumber(row.oxygen_saturation_min_percent),
    sampleCount: row.oxygen_saturation_sample_count,
  };

  return summary.sampleCount > 0 ||
    summary.averagePercent !== null ||
    summary.latestPercent !== null ||
    summary.maxPercent !== null ||
    summary.minPercent !== null
    ? summary
    : null;
}

function hasMeaningfulSleepPayload(payload: DeviceHealthDailySummaryPayload) {
  const sleep = payload.sleep;

  return Boolean(sleep && (
    hasText(sleep.startTime) ||
    hasText(sleep.endTime) ||
    hasPositiveNumber(sleep.durationMinutes) ||
    hasPositiveNumber(sleep.deepMinutes) ||
    hasPositiveNumber(sleep.lightMinutes) ||
    hasPositiveNumber(sleep.remMinutes) ||
    hasPositiveNumber(sleep.awakeMinutes) ||
    hasPositiveNumber(sleep.score)
  ));
}

function hasMeaningfulHeartRatePayload(payload: DeviceHealthDailySummaryPayload) {
  const heartRate = payload.heartRate;

  return Boolean(heartRate && (
    hasPositiveNumber(heartRate.restingBpm) ||
    hasPositiveNumber(heartRate.averageBpm) ||
    hasPositiveNumber(heartRate.minBpm) ||
    hasPositiveNumber(heartRate.maxBpm) ||
    hasPositiveNumber(heartRate.hrvRmssdMs)
  ));
}

function hasMeaningfulOxygenSaturationPayload(payload: DeviceHealthDailySummaryPayload) {
  const oxygenSaturation = payload.oxygenSaturation;

  return Boolean(oxygenSaturation && (
    oxygenSaturation.sampleCount > 0 ||
    hasPositiveNumber(oxygenSaturation.averagePercent) ||
    hasPositiveNumber(oxygenSaturation.latestPercent) ||
    hasPositiveNumber(oxygenSaturation.minPercent) ||
    hasPositiveNumber(oxygenSaturation.maxPercent)
  ));
}

function hasMeaningfulWorkoutPayload(payload: DeviceHealthDailySummaryPayload) {
  const workout = payload.workout;

  return Boolean(workout && (
    workout.count > 0 ||
    hasPositiveNumber(workout.totalDurationMinutes) ||
    hasPositiveNumber(workout.totalDistanceMeters) ||
    hasPositiveNumber(workout.averageHeartRateBpm) ||
    hasPositiveNumber(workout.maxHeartRateBpm)
  ));
}

function mapDeviceHealthDailySummary(
  row: DeviceHealthDailySummaryRow,
): DeviceHealthDailySummary {
  return {
    id: row.id,
    athleteId: row.athlete_id,
    createdAt: row.created_at,
    entryDate: row.entry_date,
    provider: row.provider,
    rawPayload: row.raw_payload_json,
    sourceDevice: row.source_device,
    syncedAt: row.synced_at,
    updatedAt: row.updated_at,
    heartRate: {
      averageBpm: toNullableNumber(row.average_hr),
      hrvRmssdMs: toNullableNumber(row.hrv_rmssd_ms),
      maxBpm: toNullableNumber(row.max_hr),
      minBpm: toNullableNumber(row.min_hr),
      restingBpm: toNullableNumber(row.resting_hr),
    },
    oxygenSaturation: mapDeviceOxygenSaturationSummary(row),
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
    workout: {
      activeCalories: toNullableNumber(row.workout_active_calories),
      averageHeartRateBpm: toNullableNumber(row.workout_average_hr),
      count: row.workout_count,
      maxHeartRateBpm: toNullableNumber(row.workout_max_hr),
      totalDistanceMeters: toNullableNumber(row.workout_distance_meters),
      totalDurationMinutes: toNullableNumber(row.workout_duration_minutes),
    },
  };
}

function mapDeviceWorkoutSample(row: DeviceWorkoutSampleRow): DeviceWorkoutSample {
  return {
    id: row.id,
    createdAt: row.created_at,
    deviceWorkoutId: row.device_workout_id,
    distanceMeters: toNullableNumber(row.distance_meters),
    heartRateBpm: toNullableNumber(row.heart_rate_bpm),
    oxygenSaturationPercent: toNullableNumber(row.oxygen_saturation_percent),
    paceSecondsPerKm: toNullableNumber(row.pace_seconds_per_km),
    rawPayload: row.raw_payload_json,
    sampleTime: row.sample_time,
    speedMetersPerSecond: toNullableNumber(row.speed_meters_per_second),
  };
}

function mapDeviceWorkout(
  row: DeviceWorkoutRow,
  samples: DeviceWorkoutSample[] = [],
): DeviceWorkout {
  return {
    id: row.id,
    activeCalories: toNullableNumber(row.active_calories),
    athleteId: row.athlete_id,
    averageHeartRateBpm: toNullableNumber(row.average_hr),
    createdAt: row.created_at,
    distanceMeters: toNullableNumber(row.distance_meters),
    durationMinutes: toNullableNumber(row.duration_minutes),
    endTime: row.end_time,
    entryDate: row.entry_date,
    maxHeartRateBpm: toNullableNumber(row.max_hr),
    minHeartRateBpm: toNullableNumber(row.min_hr),
    provider: row.provider,
    rawPayload: row.raw_payload_json,
    sampleCount: row.sample_count,
    samples,
    sourceDevice: row.source_device,
    sourceWorkoutId: row.source_workout_id,
    startTime: row.start_time,
    syncedAt: row.synced_at,
    updatedAt: row.updated_at,
    workoutType: row.workout_type,
  };
}

function mapDeviceWorkoutLink(
  row: DeviceWorkoutLinkRow,
  workout: DeviceWorkout,
): DeviceWorkoutLink {
  return {
    id: row.id,
    assignedBlockId: row.assigned_block_id,
    assignedExerciseId: row.assigned_exercise_id,
    assignedPlanId: row.assigned_plan_id,
    athleteId: row.athlete_id,
    createdAt: row.created_at,
    deviceWorkoutId: row.device_workout_id,
    linkedAt: row.linked_at,
    linkedByUserId: row.linked_by_user_id,
    workout,
  };
}

export async function listDeviceHealthDailySummariesForAthlete(
  athleteId: string,
  limit = 45,
  entryDate?: string,
): Promise<DeviceHealthDailySummary[]> {
  const params: unknown[] = [athleteId];
  let whereSql = "athlete_id = $1";

  if (entryDate) {
    params.push(entryDate);
    whereSql += ` AND entry_date = $${params.length}::date`;
  }

  params.push(limit);

  const result = await pool.query<DeviceHealthDailySummaryRow>(
    `
      SELECT
        id,
        athlete_id,
        provider,
        entry_date::text,
        source_device,
        sleep_start_time::text,
        sleep_end_time::text,
        sleep_duration_minutes::text,
        deep_sleep_minutes::text,
        light_sleep_minutes::text,
        rem_sleep_minutes::text,
        awake_minutes::text,
        sleep_score::text,
        resting_hr::text,
        average_hr::text,
        min_hr::text,
        max_hr::text,
        hrv_rmssd_ms::text,
        oxygen_saturation_avg_percent::text,
        oxygen_saturation_min_percent::text,
        oxygen_saturation_max_percent::text,
        oxygen_saturation_latest_percent::text,
        oxygen_saturation_sample_count,
        workout_count,
        workout_duration_minutes::text,
        workout_distance_meters::text,
        workout_active_calories::text,
        workout_average_hr::text,
        workout_max_hr::text,
        raw_payload_json,
        synced_at::text,
        created_at::text,
        updated_at::text
      FROM device_health_daily_summaries
      WHERE ${whereSql}
      ORDER BY entry_date DESC, updated_at DESC
      LIMIT $${params.length}
    `,
    params,
  );

  return result.rows.map(mapDeviceHealthDailySummary);
}

export async function upsertDeviceHealthDailySummary(input: {
  athleteId: string;
  payload: DeviceHealthDailySummaryPayload;
}): Promise<DeviceHealthDailySummary> {
  const syncedAt = input.payload.syncedAt ?? new Date().toISOString();
  const hasSleepPayload = hasMeaningfulSleepPayload(input.payload);
  const hasHeartRatePayload = hasMeaningfulHeartRatePayload(input.payload);
  const hasOxygenSaturationPayload = hasMeaningfulOxygenSaturationPayload(input.payload);
  const hasWorkoutPayload = hasMeaningfulWorkoutPayload(input.payload);
  const result = await pool.query<DeviceHealthDailySummaryRow>(
    `
      INSERT INTO device_health_daily_summaries (
        athlete_id,
        provider,
        entry_date,
        source_device,
        sleep_start_time,
        sleep_end_time,
        sleep_duration_minutes,
        deep_sleep_minutes,
        light_sleep_minutes,
        rem_sleep_minutes,
        awake_minutes,
        sleep_score,
        resting_hr,
        average_hr,
        min_hr,
        max_hr,
        hrv_rmssd_ms,
        oxygen_saturation_avg_percent,
        oxygen_saturation_min_percent,
        oxygen_saturation_max_percent,
        oxygen_saturation_latest_percent,
        oxygen_saturation_sample_count,
        workout_count,
        workout_duration_minutes,
        workout_distance_meters,
        workout_active_calories,
        workout_average_hr,
        workout_max_hr,
        raw_payload_json,
        synced_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3::date,
        $4,
        $5::timestamptz,
        $6::timestamptz,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16,
        $17,
        $18,
        $19,
        $20,
        $21,
        $22,
        $23,
        $24,
        $25,
        $26,
        $27,
        $28,
        $29::jsonb,
        $30::timestamptz,
        NOW()
      )
      ON CONFLICT (athlete_id, provider, entry_date)
      DO UPDATE SET
        source_device = EXCLUDED.source_device,
        sleep_start_time = CASE WHEN $31 THEN EXCLUDED.sleep_start_time ELSE device_health_daily_summaries.sleep_start_time END,
        sleep_end_time = CASE WHEN $31 THEN EXCLUDED.sleep_end_time ELSE device_health_daily_summaries.sleep_end_time END,
        sleep_duration_minutes = CASE WHEN $31 THEN EXCLUDED.sleep_duration_minutes ELSE device_health_daily_summaries.sleep_duration_minutes END,
        deep_sleep_minutes = CASE WHEN $31 THEN EXCLUDED.deep_sleep_minutes ELSE device_health_daily_summaries.deep_sleep_minutes END,
        light_sleep_minutes = CASE WHEN $31 THEN EXCLUDED.light_sleep_minutes ELSE device_health_daily_summaries.light_sleep_minutes END,
        rem_sleep_minutes = CASE WHEN $31 THEN EXCLUDED.rem_sleep_minutes ELSE device_health_daily_summaries.rem_sleep_minutes END,
        awake_minutes = CASE WHEN $31 THEN EXCLUDED.awake_minutes ELSE device_health_daily_summaries.awake_minutes END,
        sleep_score = CASE WHEN $31 THEN EXCLUDED.sleep_score ELSE device_health_daily_summaries.sleep_score END,
        resting_hr = CASE WHEN $32 THEN EXCLUDED.resting_hr ELSE device_health_daily_summaries.resting_hr END,
        average_hr = CASE WHEN $32 THEN EXCLUDED.average_hr ELSE device_health_daily_summaries.average_hr END,
        min_hr = CASE WHEN $32 THEN EXCLUDED.min_hr ELSE device_health_daily_summaries.min_hr END,
        max_hr = CASE WHEN $32 THEN EXCLUDED.max_hr ELSE device_health_daily_summaries.max_hr END,
        hrv_rmssd_ms = CASE WHEN $32 THEN EXCLUDED.hrv_rmssd_ms ELSE device_health_daily_summaries.hrv_rmssd_ms END,
        oxygen_saturation_avg_percent = CASE WHEN $33 THEN EXCLUDED.oxygen_saturation_avg_percent ELSE device_health_daily_summaries.oxygen_saturation_avg_percent END,
        oxygen_saturation_min_percent = CASE WHEN $33 THEN EXCLUDED.oxygen_saturation_min_percent ELSE device_health_daily_summaries.oxygen_saturation_min_percent END,
        oxygen_saturation_max_percent = CASE WHEN $33 THEN EXCLUDED.oxygen_saturation_max_percent ELSE device_health_daily_summaries.oxygen_saturation_max_percent END,
        oxygen_saturation_latest_percent = CASE WHEN $33 THEN EXCLUDED.oxygen_saturation_latest_percent ELSE device_health_daily_summaries.oxygen_saturation_latest_percent END,
        oxygen_saturation_sample_count = CASE WHEN $33 THEN EXCLUDED.oxygen_saturation_sample_count ELSE device_health_daily_summaries.oxygen_saturation_sample_count END,
        workout_count = CASE WHEN $34 THEN EXCLUDED.workout_count ELSE device_health_daily_summaries.workout_count END,
        workout_duration_minutes = CASE WHEN $34 THEN EXCLUDED.workout_duration_minutes ELSE device_health_daily_summaries.workout_duration_minutes END,
        workout_distance_meters = CASE WHEN $34 THEN EXCLUDED.workout_distance_meters ELSE device_health_daily_summaries.workout_distance_meters END,
        workout_active_calories = CASE WHEN $34 THEN EXCLUDED.workout_active_calories ELSE device_health_daily_summaries.workout_active_calories END,
        workout_average_hr = CASE WHEN $34 THEN EXCLUDED.workout_average_hr ELSE device_health_daily_summaries.workout_average_hr END,
        workout_max_hr = CASE WHEN $34 THEN EXCLUDED.workout_max_hr ELSE device_health_daily_summaries.workout_max_hr END,
        raw_payload_json = jsonb_strip_nulls(EXCLUDED.raw_payload_json || jsonb_build_object(
          'preservedExistingSleep', CASE WHEN $31 THEN NULL ELSE TRUE END,
          'preservedExistingHeartRate', CASE WHEN $32 THEN NULL ELSE TRUE END,
          'preservedExistingOxygenSaturation', CASE WHEN $33 THEN NULL ELSE TRUE END,
          'preservedExistingWorkout', CASE WHEN $34 THEN NULL ELSE TRUE END
        )),
        synced_at = EXCLUDED.synced_at,
        updated_at = NOW()
      RETURNING
        id,
        athlete_id,
        provider,
        entry_date::text,
        source_device,
        sleep_start_time::text,
        sleep_end_time::text,
        sleep_duration_minutes::text,
        deep_sleep_minutes::text,
        light_sleep_minutes::text,
        rem_sleep_minutes::text,
        awake_minutes::text,
        sleep_score::text,
        resting_hr::text,
        average_hr::text,
        min_hr::text,
        max_hr::text,
        hrv_rmssd_ms::text,
        oxygen_saturation_avg_percent::text,
        oxygen_saturation_min_percent::text,
        oxygen_saturation_max_percent::text,
        oxygen_saturation_latest_percent::text,
        oxygen_saturation_sample_count,
        workout_count,
        workout_duration_minutes::text,
        workout_distance_meters::text,
        workout_active_calories::text,
        workout_average_hr::text,
        workout_max_hr::text,
        raw_payload_json,
        synced_at::text,
        created_at::text,
        updated_at::text
    `,
    [
      input.athleteId,
      input.payload.provider,
      input.payload.entryDate,
      input.payload.sourceDevice,
      input.payload.sleep?.startTime ?? null,
      input.payload.sleep?.endTime ?? null,
      input.payload.sleep?.durationMinutes ?? null,
      input.payload.sleep?.deepMinutes ?? null,
      input.payload.sleep?.lightMinutes ?? null,
      input.payload.sleep?.remMinutes ?? null,
      input.payload.sleep?.awakeMinutes ?? null,
      input.payload.sleep?.score ?? null,
      input.payload.heartRate?.restingBpm ?? null,
      input.payload.heartRate?.averageBpm ?? null,
      input.payload.heartRate?.minBpm ?? null,
      input.payload.heartRate?.maxBpm ?? null,
      input.payload.heartRate?.hrvRmssdMs ?? null,
      input.payload.oxygenSaturation?.averagePercent ?? null,
      input.payload.oxygenSaturation?.minPercent ?? null,
      input.payload.oxygenSaturation?.maxPercent ?? null,
      input.payload.oxygenSaturation?.latestPercent ?? null,
      input.payload.oxygenSaturation?.sampleCount ?? 0,
      input.payload.workout?.count ?? 0,
      input.payload.workout?.totalDurationMinutes ?? null,
      input.payload.workout?.totalDistanceMeters ?? null,
      input.payload.workout?.activeCalories ?? null,
      input.payload.workout?.averageHeartRateBpm ?? null,
      input.payload.workout?.maxHeartRateBpm ?? null,
      JSON.stringify(input.payload.rawPayload ?? {}),
      syncedAt,
      hasSleepPayload,
      hasHeartRatePayload,
      hasOxygenSaturationPayload,
      hasWorkoutPayload,
    ],
  );

  const summary = mapDeviceHealthDailySummary(result.rows[0]);

  await markCoachTeamDayDirtyForAthlete({
    athleteId: input.athleteId,
    entryDate: summary.entryDate,
    reason: "device_health",
  });

  return summary;
}

export async function listDeviceWorkoutsForAthlete(
  athleteId: string,
  entryDate?: string,
): Promise<DeviceWorkout[]> {
  const values: unknown[] = [athleteId];
  const dateFilter = entryDate ? "AND device_workouts.entry_date = $2::date" : "";
  if (entryDate) {
    values.push(entryDate);
  }

  const result = await pool.query<DeviceWorkoutRow>(
    `
      SELECT
        device_workouts.id,
        device_workouts.athlete_id,
        device_workouts.provider,
        device_workouts.entry_date::text,
        device_workouts.source_device,
        device_workouts.source_workout_id,
        device_workouts.workout_type,
        device_workouts.start_time::text,
        device_workouts.end_time::text,
        device_workouts.duration_minutes::text,
        device_workouts.distance_meters::text,
        device_workouts.active_calories::text,
        device_workouts.average_hr::text,
        device_workouts.max_hr::text,
        device_workouts.min_hr::text,
        device_workouts.raw_payload_json,
        (
          SELECT COUNT(*)::int
          FROM device_workout_samples
          WHERE device_workout_samples.device_workout_id = device_workouts.id
        ) AS sample_count,
        device_workouts.synced_at::text,
        device_workouts.created_at::text,
        device_workouts.updated_at::text
      FROM device_workouts
      WHERE device_workouts.athlete_id = $1
        ${dateFilter}
      ORDER BY device_workouts.entry_date DESC, device_workouts.start_time DESC
      LIMIT 90
    `,
    values,
  );

  return attachDeviceWorkoutSamples(result.rows);
}

export async function syncDeviceWorkouts(input: {
  athleteId: string;
  payload: DeviceWorkoutsSyncPayload;
}): Promise<DeviceWorkout[]> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const workout of input.payload.workouts) {
      await upsertDeviceWorkout(client, input.athleteId, workout);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const workouts = await listDeviceWorkoutsForAthlete(input.athleteId, input.payload.entryDate);

  await Promise.all([
    markCoachTeamDayDirtyForAthlete({
      athleteId: input.athleteId,
      entryDate: input.payload.entryDate,
      reason: "device_workouts",
    }),
    markAnalyticsDirty({
      athleteId: input.athleteId,
      referenceDate: input.payload.entryDate,
      reason: "device_workouts",
    }),
  ]);

  return workouts;
}

export async function listDeviceWorkoutLinksForAthlete(
  athleteId: string,
  entryDate?: string,
): Promise<DeviceWorkoutLink[]> {
  const values: unknown[] = [athleteId];
  const dateFilter = entryDate ? "AND device_workouts.entry_date = $2::date" : "";
  if (entryDate) {
    values.push(entryDate);
  }

  const result = await pool.query<DeviceWorkoutLinkRow>(
    `
      SELECT
        training_plan_device_links.id,
        training_plan_device_links.athlete_id,
        training_plan_device_links.assigned_plan_id,
        training_plan_device_links.assigned_block_id,
        training_plan_device_links.assigned_exercise_id,
        training_plan_device_links.device_workout_id,
        training_plan_device_links.linked_by_user_id,
        training_plan_device_links.linked_at::text,
        training_plan_device_links.created_at::text
      FROM training_plan_device_links
      JOIN device_workouts ON device_workouts.id = training_plan_device_links.device_workout_id
      WHERE training_plan_device_links.athlete_id = $1
        ${dateFilter}
      ORDER BY device_workouts.entry_date DESC, device_workouts.start_time DESC
      LIMIT 90
    `,
    values,
  );

  return hydrateDeviceWorkoutLinks(result.rows);
}

export async function linkDeviceWorkoutToPlanBlock(input: {
  athleteId: string;
  linkedByUserId: string;
  payload: DeviceWorkoutLinkPayload;
}): Promise<DeviceWorkoutLink> {
  await assertDeviceWorkoutLinkTarget(input.athleteId, input.payload);

  const result = await pool.query<DeviceWorkoutLinkRow>(
    `
      INSERT INTO training_plan_device_links (
        athlete_id,
        assigned_plan_id,
        assigned_block_id,
        assigned_exercise_id,
        device_workout_id,
        linked_by_user_id,
        linked_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (athlete_id, assigned_block_id, device_workout_id)
      DO UPDATE SET
        assigned_plan_id = EXCLUDED.assigned_plan_id,
        assigned_exercise_id = EXCLUDED.assigned_exercise_id,
        linked_by_user_id = EXCLUDED.linked_by_user_id,
        linked_at = NOW()
      RETURNING
        id,
        athlete_id,
        assigned_plan_id,
        assigned_block_id,
        assigned_exercise_id,
        device_workout_id,
        linked_by_user_id,
        linked_at::text,
        created_at::text
    `,
    [
      input.athleteId,
      input.payload.assignedPlanId,
      input.payload.assignedBlockId,
      input.payload.assignedExerciseId ?? null,
      input.payload.deviceWorkoutId,
      input.linkedByUserId,
    ],
  );

  const [link] = await hydrateDeviceWorkoutLinks(result.rows);
  await Promise.all([
    markCoachTeamDayDirtyForAthlete({
      athleteId: input.athleteId,
      entryDate: link.workout.entryDate,
      reason: "device_workout_link",
    }),
    markAnalyticsDirty({
      athleteId: input.athleteId,
      referenceDate: link.workout.entryDate,
      reason: "device_workout_link",
    }),
  ]);

  return link;
}

export async function deleteDeviceWorkoutLink(input: {
  athleteId: string;
  linkId: string;
}): Promise<boolean> {
  const result = await pool.query<{ entry_date: string }>(
    `
      WITH deleted AS (
        DELETE FROM training_plan_device_links
        WHERE id = $1
          AND athlete_id = $2
        RETURNING device_workout_id
      )
      SELECT device_workouts.entry_date::text
      FROM deleted
      JOIN device_workouts ON device_workouts.id = deleted.device_workout_id
    `,
    [input.linkId, input.athleteId],
  );

  const entryDate = result.rows[0]?.entry_date;

  if (entryDate) {
    await Promise.all([
      markCoachTeamDayDirtyForAthlete({
        athleteId: input.athleteId,
        entryDate,
        reason: "device_workout_unlink",
      }),
      markAnalyticsDirty({
        athleteId: input.athleteId,
        referenceDate: entryDate,
        reason: "device_workout_unlink",
      }),
    ]);
  }

  return Boolean(entryDate);
}

async function upsertDeviceWorkout(
  client: PoolClient,
  athleteId: string,
  workout: DeviceWorkoutPayload,
) {
  const syncedAt = workout.syncedAt ?? new Date().toISOString();
  const result = await client.query<DeviceWorkoutRow>(
    `
      INSERT INTO device_workouts (
        athlete_id,
        provider,
        entry_date,
        source_device,
        source_workout_id,
        workout_type,
        start_time,
        end_time,
        duration_minutes,
        distance_meters,
        active_calories,
        average_hr,
        max_hr,
        min_hr,
        raw_payload_json,
        synced_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3::date,
        $4,
        $5,
        $6,
        $7::timestamptz,
        $8::timestamptz,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15::jsonb,
        $16::timestamptz,
        NOW()
      )
      ON CONFLICT (athlete_id, provider, source_workout_id)
      DO UPDATE SET
        entry_date = EXCLUDED.entry_date,
        source_device = EXCLUDED.source_device,
        workout_type = EXCLUDED.workout_type,
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time,
        duration_minutes = EXCLUDED.duration_minutes,
        distance_meters = EXCLUDED.distance_meters,
        active_calories = EXCLUDED.active_calories,
        average_hr = EXCLUDED.average_hr,
        max_hr = EXCLUDED.max_hr,
        min_hr = EXCLUDED.min_hr,
        raw_payload_json = EXCLUDED.raw_payload_json,
        synced_at = EXCLUDED.synced_at,
        updated_at = NOW()
      RETURNING
        id,
        athlete_id,
        provider,
        entry_date::text,
        source_device,
        source_workout_id,
        workout_type,
        start_time::text,
        end_time::text,
        duration_minutes::text,
        distance_meters::text,
        active_calories::text,
        average_hr::text,
        max_hr::text,
        min_hr::text,
        raw_payload_json,
        0 AS sample_count,
        synced_at::text,
        created_at::text,
        updated_at::text
    `,
    [
      athleteId,
      workout.provider,
      workout.entryDate,
      workout.sourceDevice,
      workout.sourceWorkoutId,
      workout.workoutType,
      workout.startTime,
      workout.endTime,
      workout.durationMinutes,
      workout.distanceMeters,
      workout.activeCalories,
      workout.averageHeartRateBpm,
      workout.maxHeartRateBpm,
      workout.minHeartRateBpm,
      JSON.stringify(workout.rawPayload ?? {}),
      syncedAt,
    ],
  );
  const workoutId = result.rows[0].id;

  await client.query("DELETE FROM device_workout_samples WHERE device_workout_id = $1", [workoutId]);

  for (const sample of workout.samples) {
    await client.query(
      `
        INSERT INTO device_workout_samples (
          device_workout_id,
          sample_time,
          heart_rate_bpm,
          distance_meters,
          speed_meters_per_second,
          pace_seconds_per_km,
          oxygen_saturation_percent,
          raw_payload_json
        )
        VALUES ($1, $2::timestamptz, $3, $4, $5, $6, $7, $8::jsonb)
        ON CONFLICT (device_workout_id, sample_time)
        DO UPDATE SET
          heart_rate_bpm = EXCLUDED.heart_rate_bpm,
          distance_meters = EXCLUDED.distance_meters,
          speed_meters_per_second = EXCLUDED.speed_meters_per_second,
          pace_seconds_per_km = EXCLUDED.pace_seconds_per_km,
          oxygen_saturation_percent = EXCLUDED.oxygen_saturation_percent,
          raw_payload_json = EXCLUDED.raw_payload_json
      `,
      [
        workoutId,
        sample.sampleTime,
        sample.heartRateBpm,
        sample.distanceMeters,
        sample.speedMetersPerSecond,
        sample.paceSecondsPerKm,
        sample.oxygenSaturationPercent,
        JSON.stringify(sample.rawPayload ?? {}),
      ],
    );
  }
}

async function assertDeviceWorkoutLinkTarget(
  athleteId: string,
  payload: DeviceWorkoutLinkPayload,
) {
  const result = await pool.query<{
    block_name: string;
    block_notes: string;
    plan_day_date: string;
    row_kind: string | null;
    workout_date: string;
    exercise_matches: boolean;
  }>(
    `
      SELECT
        assigned_plan_days.day_date::text AS plan_day_date,
        assigned_day_blocks.name AS block_name,
        assigned_day_blocks.notes AS block_notes,
        assigned_day_blocks.row_kind,
        device_workouts.entry_date::text AS workout_date,
        ($3::uuid IS NULL OR assigned_block_exercises.id IS NOT NULL) AS exercise_matches
      FROM assigned_plans
      JOIN assigned_plan_days
        ON assigned_plan_days.assigned_plan_id = assigned_plans.id
      JOIN assigned_day_sessions
        ON assigned_day_sessions.assigned_day_id = assigned_plan_days.id
      JOIN assigned_day_blocks
        ON assigned_day_blocks.assigned_session_id = assigned_day_sessions.id
      JOIN device_workouts
        ON device_workouts.id = $5
       AND device_workouts.athlete_id = assigned_plans.athlete_id
      LEFT JOIN assigned_block_exercises
        ON assigned_block_exercises.assigned_block_id = assigned_day_blocks.id
       AND assigned_block_exercises.id = $3::uuid
      WHERE assigned_plans.id = $1
        AND assigned_day_blocks.id = $2
        AND assigned_plans.athlete_id = $4
      LIMIT 1
    `,
    [
      payload.assignedPlanId,
      payload.assignedBlockId,
      payload.assignedExerciseId ?? null,
      athleteId,
      payload.deviceWorkoutId,
    ],
  );

  const target = result.rows[0];
  if (!target) {
    throw new Error("Selected plan block or device workout was not found");
  }

  const rowKind = target.row_kind ?? "exercise";
  const isWorkoutInstruction = isDeviceWorkoutLinkablePlanBlock({
    name: target.block_name,
    notes: target.block_notes,
    rowKind: rowKind as PlanBlockRowKind,
  });

  if (
    ["control", "note", "recovery"].includes(rowKind) ||
    (rowKind === "instruction" && !isWorkoutInstruction)
  ) {
    throw new Error("Device workout can only be linked to training plan blocks");
  }

  if (!target.exercise_matches) {
    throw new Error("Selected exercise does not belong to the plan block");
  }

  if (target.plan_day_date !== target.workout_date) {
    throw new Error("Device workout date must match the plan block date");
  }
}

async function hydrateDeviceWorkoutLinks(rows: DeviceWorkoutLinkRow[]): Promise<DeviceWorkoutLink[]> {
  if (rows.length === 0) {
    return [];
  }

  const workouts = await listDeviceWorkoutsByIds(rows.map((row) => row.device_workout_id));
  const workoutsById = new Map(workouts.map((workout) => [workout.id, workout]));

  return rows
    .map((row) => {
      const workout = workoutsById.get(row.device_workout_id);
      return workout ? mapDeviceWorkoutLink(row, workout) : null;
    })
    .filter((link): link is DeviceWorkoutLink => Boolean(link));
}

async function listDeviceWorkoutsByIds(workoutIds: string[]): Promise<DeviceWorkout[]> {
  const ids = Array.from(new Set(workoutIds.filter(Boolean)));
  if (ids.length === 0) {
    return [];
  }

  const result = await pool.query<DeviceWorkoutRow>(
    `
      SELECT
        device_workouts.id,
        device_workouts.athlete_id,
        device_workouts.provider,
        device_workouts.entry_date::text,
        device_workouts.source_device,
        device_workouts.source_workout_id,
        device_workouts.workout_type,
        device_workouts.start_time::text,
        device_workouts.end_time::text,
        device_workouts.duration_minutes::text,
        device_workouts.distance_meters::text,
        device_workouts.active_calories::text,
        device_workouts.average_hr::text,
        device_workouts.max_hr::text,
        device_workouts.min_hr::text,
        device_workouts.raw_payload_json,
        (
          SELECT COUNT(*)::int
          FROM device_workout_samples
          WHERE device_workout_samples.device_workout_id = device_workouts.id
        ) AS sample_count,
        device_workouts.synced_at::text,
        device_workouts.created_at::text,
        device_workouts.updated_at::text
      FROM device_workouts
      WHERE device_workouts.id = ANY($1::uuid[])
      ORDER BY device_workouts.entry_date DESC, device_workouts.start_time DESC
    `,
    [ids],
  );

  return attachDeviceWorkoutSamples(result.rows);
}

async function attachDeviceWorkoutSamples(rows: DeviceWorkoutRow[]): Promise<DeviceWorkout[]> {
  if (rows.length === 0) {
    return [];
  }

  const samplesByWorkoutId = await listDeviceWorkoutSamplesByWorkoutId(rows.map((row) => row.id));

  return rows.map((row) => mapDeviceWorkout(row, samplesByWorkoutId.get(row.id) ?? []));
}

async function listDeviceWorkoutSamplesByWorkoutId(
  workoutIds: string[],
  queryClient: QueryClient = pool,
) {
  const ids = Array.from(new Set(workoutIds.filter(Boolean)));
  const samplesByWorkoutId = new Map<string, DeviceWorkoutSample[]>();
  if (ids.length === 0) {
    return samplesByWorkoutId;
  }

  const result = await queryClient.query<DeviceWorkoutSampleRow>(
    `
      SELECT
        id,
        device_workout_id,
        sample_time::text,
        heart_rate_bpm::text,
        distance_meters::text,
        speed_meters_per_second::text,
        pace_seconds_per_km::text,
        oxygen_saturation_percent::text,
        raw_payload_json,
        created_at::text
      FROM device_workout_samples
      WHERE device_workout_id = ANY($1::uuid[])
      ORDER BY device_workout_id, sample_time
    `,
    [ids],
  );

  for (const row of result.rows) {
    const items = samplesByWorkoutId.get(row.device_workout_id) ?? [];
    items.push(mapDeviceWorkoutSample(row));
    samplesByWorkoutId.set(row.device_workout_id, items);
  }

  return samplesByWorkoutId;
}
