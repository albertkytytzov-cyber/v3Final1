import type {
  DeviceHealthDailySummary,
  DeviceHealthDailySummaryPayload,
  DeviceHealthProvider,
} from "@training-platform/shared";
import { pool } from "../db";

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

function toNullableNumber(value: string | null) {
  return value !== null ? Number(value) : null;
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

export async function listDeviceHealthDailySummariesForAthlete(
  athleteId: string,
  limit = 45,
): Promise<DeviceHealthDailySummary[]> {
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
      WHERE athlete_id = $1
      ORDER BY entry_date DESC, updated_at DESC
      LIMIT $2
    `,
    [athleteId, limit],
  );

  return result.rows.map(mapDeviceHealthDailySummary);
}

export async function upsertDeviceHealthDailySummary(input: {
  athleteId: string;
  payload: DeviceHealthDailySummaryPayload;
}): Promise<DeviceHealthDailySummary> {
  const syncedAt = input.payload.syncedAt ?? new Date().toISOString();
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
        $24::jsonb,
        $25::timestamptz,
        NOW()
      )
      ON CONFLICT (athlete_id, provider, entry_date)
      DO UPDATE SET
        source_device = EXCLUDED.source_device,
        sleep_start_time = EXCLUDED.sleep_start_time,
        sleep_end_time = EXCLUDED.sleep_end_time,
        sleep_duration_minutes = EXCLUDED.sleep_duration_minutes,
        deep_sleep_minutes = EXCLUDED.deep_sleep_minutes,
        light_sleep_minutes = EXCLUDED.light_sleep_minutes,
        rem_sleep_minutes = EXCLUDED.rem_sleep_minutes,
        awake_minutes = EXCLUDED.awake_minutes,
        sleep_score = EXCLUDED.sleep_score,
        resting_hr = EXCLUDED.resting_hr,
        average_hr = EXCLUDED.average_hr,
        min_hr = EXCLUDED.min_hr,
        max_hr = EXCLUDED.max_hr,
        hrv_rmssd_ms = EXCLUDED.hrv_rmssd_ms,
        workout_count = EXCLUDED.workout_count,
        workout_duration_minutes = EXCLUDED.workout_duration_minutes,
        workout_distance_meters = EXCLUDED.workout_distance_meters,
        workout_active_calories = EXCLUDED.workout_active_calories,
        workout_average_hr = EXCLUDED.workout_average_hr,
        workout_max_hr = EXCLUDED.workout_max_hr,
        raw_payload_json = EXCLUDED.raw_payload_json,
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
      input.payload.workout?.count ?? 0,
      input.payload.workout?.totalDurationMinutes ?? null,
      input.payload.workout?.totalDistanceMeters ?? null,
      input.payload.workout?.activeCalories ?? null,
      input.payload.workout?.averageHeartRateBpm ?? null,
      input.payload.workout?.maxHeartRateBpm ?? null,
      JSON.stringify(input.payload.rawPayload ?? {}),
      syncedAt,
    ],
  );

  return mapDeviceHealthDailySummary(result.rows[0]);
}
