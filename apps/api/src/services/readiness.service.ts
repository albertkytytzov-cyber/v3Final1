import type {
  ReadinessEntry,
  ReadinessFormValues,
} from "@training-platform/shared";
import { calculateReadiness } from "../domain/readiness.engine";
import { pool } from "../db";
import { markAnalyticsDirty } from "./analytics/analytics-query.service";
import { getCompetitionContextForAthlete } from "./competition/competition-query.service";

interface ReadinessRow {
  readiness_score_id: string;
  id: string;
  athlete_id: string;
  entry_date: string;
  sleep_hours: string;
  sleep_quality: number;
  general_feeling: number;
  fatigue_level: number;
  muscle_soreness: number;
  motivation_level: number;
  resting_hr: number;
  body_weight: string;
  pain_level: number;
  illness_flag: boolean;
  fever_flag: boolean;
  created_at: string;
  score: string;
  status: "green" | "yellow" | "red";
  explanation: Array<{ code: string; label: string; impact: number }>;
}

export interface StoredReadinessEntry extends ReadinessEntry {
  readinessScoreId: string;
}

export interface SubmitReadinessInput {
  athleteId: string;
  baselineRestingHr: number | null;
  baselineWeightKg: number | null;
  clientRequestId?: string | null;
  entryDate?: string | null;
  values: ReadinessFormValues;
}

function mapStoredReadinessEntry(row: ReadinessRow): StoredReadinessEntry {
  return {
    readinessScoreId: row.readiness_score_id,
    id: row.id,
    athleteId: row.athlete_id,
    entryDate: row.entry_date,
    sleepHours: Number(row.sleep_hours),
    sleepQuality: row.sleep_quality,
    generalFeeling: row.general_feeling,
    fatigueLevel: row.fatigue_level,
    muscleSoreness: row.muscle_soreness,
    motivationLevel: row.motivation_level,
    restingHr: row.resting_hr,
    bodyWeight: Number(row.body_weight),
    painLevel: row.pain_level,
    illnessFlag: row.illness_flag,
    feverFlag: row.fever_flag,
    createdAt: row.created_at,
    score: Number(row.score),
    status: row.status,
    explanation: row.explanation,
  };
}

function toReadinessEntry(entry: StoredReadinessEntry): ReadinessEntry {
  return {
    id: entry.id,
    athleteId: entry.athleteId,
    entryDate: entry.entryDate,
    sleepHours: entry.sleepHours,
    sleepQuality: entry.sleepQuality,
    generalFeeling: entry.generalFeeling,
    fatigueLevel: entry.fatigueLevel,
    muscleSoreness: entry.muscleSoreness,
    motivationLevel: entry.motivationLevel,
    restingHr: entry.restingHr,
    bodyWeight: entry.bodyWeight,
    painLevel: entry.painLevel,
    illnessFlag: entry.illnessFlag,
    feverFlag: entry.feverFlag,
    createdAt: entry.createdAt,
    score: entry.score,
    status: entry.status,
    explanation: entry.explanation,
  };
}

export async function listRecentReadinessEntries(
  athleteId: string,
  limit = 14,
): Promise<ReadinessEntry[]> {
  const result = await pool.query<ReadinessRow>(
    `
      SELECT
        readiness_scores.id AS readiness_score_id,
        daily_readiness_entries.id,
        daily_readiness_entries.athlete_id,
        daily_readiness_entries.entry_date::text,
        daily_readiness_entries.sleep_hours::text,
        daily_readiness_entries.sleep_quality,
        daily_readiness_entries.general_feeling,
        daily_readiness_entries.fatigue_level,
        daily_readiness_entries.muscle_soreness,
        daily_readiness_entries.motivation_level,
        daily_readiness_entries.resting_hr,
        daily_readiness_entries.body_weight::text,
        daily_readiness_entries.pain_level,
        daily_readiness_entries.illness_flag,
        daily_readiness_entries.fever_flag,
        daily_readiness_entries.created_at::text,
        readiness_scores.score::text,
        readiness_scores.status,
        readiness_scores.explanation
      FROM daily_readiness_entries
      JOIN readiness_scores ON readiness_scores.readiness_entry_id = daily_readiness_entries.id
      WHERE daily_readiness_entries.athlete_id = $1
      ORDER BY daily_readiness_entries.entry_date DESC
      LIMIT $2
    `,
    [athleteId, limit],
  );

  return result.rows.map((row) => toReadinessEntry(mapStoredReadinessEntry(row)));
}

export async function getTodayReadinessEntry(
  athleteId: string,
): Promise<ReadinessEntry | null> {
  return getReadinessEntryForDate(athleteId, new Date().toISOString().slice(0, 10));
}

export async function getReadinessEntryForDate(
  athleteId: string,
  entryDate: string,
): Promise<ReadinessEntry | null> {
  const result = await pool.query<ReadinessRow>(
    `
      SELECT
        readiness_scores.id AS readiness_score_id,
        daily_readiness_entries.id,
        daily_readiness_entries.athlete_id,
        daily_readiness_entries.entry_date::text,
        daily_readiness_entries.sleep_hours::text,
        daily_readiness_entries.sleep_quality,
        daily_readiness_entries.general_feeling,
        daily_readiness_entries.fatigue_level,
        daily_readiness_entries.muscle_soreness,
        daily_readiness_entries.motivation_level,
        daily_readiness_entries.resting_hr,
        daily_readiness_entries.body_weight::text,
        daily_readiness_entries.pain_level,
        daily_readiness_entries.illness_flag,
        daily_readiness_entries.fever_flag,
        daily_readiness_entries.created_at::text,
        readiness_scores.score::text,
        readiness_scores.status,
        readiness_scores.explanation
      FROM daily_readiness_entries
      JOIN readiness_scores ON readiness_scores.readiness_entry_id = daily_readiness_entries.id
      WHERE daily_readiness_entries.athlete_id = $1
        AND daily_readiness_entries.entry_date = $2::date
      LIMIT 1
    `,
    [athleteId, entryDate],
  );

  if (!result.rowCount) {
    return null;
  }

  return toReadinessEntry(mapStoredReadinessEntry(result.rows[0]));
}

export async function getLatestReadinessEntryRecord(
  athleteId: string,
): Promise<StoredReadinessEntry | null> {
  const result = await pool.query<ReadinessRow>(
    `
      SELECT
        readiness_scores.id AS readiness_score_id,
        daily_readiness_entries.id,
        daily_readiness_entries.athlete_id,
        daily_readiness_entries.entry_date::text,
        daily_readiness_entries.sleep_hours::text,
        daily_readiness_entries.sleep_quality,
        daily_readiness_entries.general_feeling,
        daily_readiness_entries.fatigue_level,
        daily_readiness_entries.muscle_soreness,
        daily_readiness_entries.motivation_level,
        daily_readiness_entries.resting_hr,
        daily_readiness_entries.body_weight::text,
        daily_readiness_entries.pain_level,
        daily_readiness_entries.illness_flag,
        daily_readiness_entries.fever_flag,
        daily_readiness_entries.created_at::text,
        readiness_scores.score::text,
        readiness_scores.status,
        readiness_scores.explanation
      FROM daily_readiness_entries
      JOIN readiness_scores ON readiness_scores.readiness_entry_id = daily_readiness_entries.id
      WHERE daily_readiness_entries.athlete_id = $1
      ORDER BY daily_readiness_entries.entry_date DESC
      LIMIT 1
    `,
    [athleteId],
  );

  if (!result.rowCount) {
    return null;
  }

  return mapStoredReadinessEntry(result.rows[0]);
}

export async function submitReadiness(
  input: SubmitReadinessInput,
): Promise<ReadinessEntry> {
  const entryDate = input.entryDate ?? new Date().toISOString().slice(0, 10);
  const competitionContext = await getCompetitionContextForAthlete(
    input.athleteId,
    new Date(`${entryDate}T00:00:00.000Z`),
  );

  const readiness = calculateReadiness({
    values: input.values,
    baseline: {
      baselineRestingHr: input.baselineRestingHr,
      baselineWeightKg: input.baselineWeightKg,
    },
    competitionContext,
  });

  const entry = await pool.query<{
    id: string;
    created_at: string;
    entry_date: string;
  }>(
    `
      INSERT INTO daily_readiness_entries (
        athlete_id,
        entry_date,
        sleep_hours,
        sleep_quality,
        general_feeling,
        fatigue_level,
        muscle_soreness,
        motivation_level,
        resting_hr,
        body_weight,
        pain_level,
        illness_flag,
        fever_flag,
        client_request_id
      )
      VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (athlete_id, entry_date)
      DO UPDATE SET
        sleep_hours = EXCLUDED.sleep_hours,
        sleep_quality = EXCLUDED.sleep_quality,
        general_feeling = EXCLUDED.general_feeling,
        fatigue_level = EXCLUDED.fatigue_level,
        muscle_soreness = EXCLUDED.muscle_soreness,
        motivation_level = EXCLUDED.motivation_level,
        resting_hr = EXCLUDED.resting_hr,
        body_weight = EXCLUDED.body_weight,
        pain_level = EXCLUDED.pain_level,
        illness_flag = EXCLUDED.illness_flag,
        fever_flag = EXCLUDED.fever_flag,
        client_request_id = COALESCE(EXCLUDED.client_request_id, daily_readiness_entries.client_request_id),
        updated_at = NOW()
      RETURNING id, created_at::text, entry_date::text
    `,
    [
      input.athleteId,
      entryDate,
      input.values.sleepHours,
      input.values.sleepQuality,
      input.values.generalFeeling,
      input.values.fatigueLevel,
      input.values.muscleSoreness,
      input.values.motivationLevel,
      input.values.restingHr,
      input.values.bodyWeight,
      input.values.painLevel,
      input.values.illnessFlag,
      input.values.feverFlag,
      input.clientRequestId ?? null,
    ],
  );

  await pool.query(
    `
      INSERT INTO readiness_scores (readiness_entry_id, score, status, explanation)
      VALUES ($1, $2, $3, $4::jsonb)
      ON CONFLICT (readiness_entry_id)
      DO UPDATE SET
        score = EXCLUDED.score,
        status = EXCLUDED.status,
        explanation = EXCLUDED.explanation,
        updated_at = NOW()
    `,
    [
      entry.rows[0].id,
      readiness.score,
      readiness.status,
      JSON.stringify(readiness.explanation),
    ],
  );

  await pool.query(
    `
      INSERT INTO weight_logs (
        athlete_id,
        readiness_entry_id,
        log_date,
        weight_kg,
        source_type,
        notes,
        updated_at
      )
      VALUES ($1, $2, $3::date, $4, 'readiness', '', NOW())
      ON CONFLICT (readiness_entry_id)
      DO UPDATE SET
        log_date = EXCLUDED.log_date,
        weight_kg = EXCLUDED.weight_kg,
        updated_at = NOW()
    `,
    [
      input.athleteId,
      entry.rows[0].id,
      entry.rows[0].entry_date,
      input.values.bodyWeight,
    ],
  );

  await markAnalyticsDirty({
    athleteId: input.athleteId,
    referenceDate: entry.rows[0].entry_date,
    reason: "readiness",
  });

  return {
    id: entry.rows[0].id,
    athleteId: input.athleteId,
    entryDate: entry.rows[0].entry_date,
    createdAt: entry.rows[0].created_at,
    score: readiness.score,
    status: readiness.status,
    explanation: readiness.explanation,
    ...input.values,
  };
}
