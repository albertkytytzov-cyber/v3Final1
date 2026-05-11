import type {
  CoachDiaryEntry,
  CoachDiaryEntryPayload,
  CoachDiaryScope,
  UserRole,
} from "@training-platform/shared";
import { pool } from "../db";
import { markCoachTeamDayDirtyForAthlete } from "./analytics/coach-team-day.service";

interface CoachDiaryEntryRow {
  id: string;
  athlete_id: string;
  coach_user_id: string;
  coach_name: string;
  assigned_plan_id: string;
  entry_date: string;
  scope: CoachDiaryScope;
  notes: string;
  assigned_block_ids: string[] | null;
  assigned_exercise_ids: string[] | null;
  created_at: string;
  updated_at: string;
}

interface AssignedPlanDiaryContextRow {
  day_date: string;
}

interface CountRow {
  count: number;
}

export interface SubmitCoachDiaryInput {
  coachUserId: string;
  clientRequestId?: string | null;
  payload: CoachDiaryEntryPayload;
}

export class CoachDiaryServiceError extends Error {
  constructor(
    public readonly code:
      | "assigned_plan_not_found"
      | "diary_notes_required"
      | "diary_task_not_found"
      | "diary_task_selection_required",
    message: string,
  ) {
    super(message);
    this.name = "CoachDiaryServiceError";
  }
}

function uniqueIds(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function mapCoachDiaryEntry(row: CoachDiaryEntryRow): CoachDiaryEntry {
  return {
    id: row.id,
    athleteId: row.athlete_id,
    coachUserId: row.coach_user_id,
    coachName: row.coach_name,
    assignedPlanId: row.assigned_plan_id,
    entryDate: row.entry_date,
    scope: row.scope,
    notes: row.notes,
    assignedBlockIds: row.assigned_block_ids ?? [],
    assignedExerciseIds: row.assigned_exercise_ids ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadCoachDiaryEntries(whereSql: string, params: unknown[]) {
  const result = await pool.query<CoachDiaryEntryRow>(
    `
      SELECT
        coach_diary_entries.id,
        coach_diary_entries.athlete_id,
        coach_diary_entries.coach_user_id,
        users.full_name AS coach_name,
        coach_diary_entries.assigned_plan_id,
        coach_diary_entries.entry_date::text,
        coach_diary_entries.scope,
        coach_diary_entries.notes,
        coach_diary_entries.assigned_block_ids,
        coach_diary_entries.assigned_exercise_ids,
        coach_diary_entries.created_at::text,
        coach_diary_entries.updated_at::text
      FROM coach_diary_entries
      JOIN users ON users.id = coach_diary_entries.coach_user_id
      WHERE ${whereSql}
      ORDER BY coach_diary_entries.updated_at DESC
      LIMIT 200
    `,
    params,
  );

  return result.rows.map(mapCoachDiaryEntry);
}

export async function listCoachDiaryEntriesForCoachContext(input: {
  coachUserId: string;
  role: UserRole;
}) {
  if (input.role === "admin") {
    return loadCoachDiaryEntries("TRUE", []);
  }

  return loadCoachDiaryEntries(
    `
      EXISTS (
        SELECT 1
        FROM coach_athletes
        WHERE coach_athletes.athlete_id = coach_diary_entries.athlete_id
          AND coach_athletes.coach_user_id = $1
      )
    `,
    [input.coachUserId],
  );
}

export function listCoachDiaryEntriesForAthlete(athleteId: string) {
  return loadCoachDiaryEntries("coach_diary_entries.athlete_id = $1", [athleteId]);
}

async function loadEntryByClientRequestId(athleteId: string, clientRequestId: string | null) {
  if (!clientRequestId) {
    return null;
  }

  const [entry] = await loadCoachDiaryEntries(
    "coach_diary_entries.athlete_id = $1 AND coach_diary_entries.client_request_id = $2",
    [athleteId, clientRequestId],
  );

  return entry ?? null;
}

async function loadAssignedPlanDiaryContext(payload: CoachDiaryEntryPayload) {
  const result = await pool.query<AssignedPlanDiaryContextRow>(
    `
      SELECT assigned_plan_days.day_date::text
      FROM assigned_plans
      JOIN assigned_plan_days ON assigned_plan_days.assigned_plan_id = assigned_plans.id
      WHERE assigned_plans.id = $1
        AND assigned_plans.athlete_id = $2
        AND assigned_plans.status = 'active'
        AND assigned_plan_days.day_date = $3::date
      LIMIT 1
    `,
    [payload.assignedPlanId, payload.athleteId, payload.entryDate],
  );

  if (!result.rowCount) {
    throw new CoachDiaryServiceError(
      "assigned_plan_not_found",
      "Assigned plan day was not found for this athlete",
    );
  }

  return result.rows[0];
}

async function assertTaskIdsBelongToPlan(input: {
  assignedPlanId: string;
  entryDate: string;
  assignedBlockIds: string[];
  assignedExerciseIds: string[];
}) {
  if (input.assignedBlockIds.length > 0) {
    const result = await pool.query<CountRow>(
      `
        SELECT COUNT(DISTINCT assigned_day_blocks.id)::int AS count
        FROM assigned_plans
        JOIN assigned_plan_days ON assigned_plan_days.assigned_plan_id = assigned_plans.id
        JOIN assigned_day_sessions ON assigned_day_sessions.assigned_day_id = assigned_plan_days.id
        JOIN assigned_day_blocks ON assigned_day_blocks.assigned_session_id = assigned_day_sessions.id
        WHERE assigned_plans.id = $1
          AND assigned_plan_days.day_date = $2::date
          AND assigned_day_blocks.id = ANY($3::uuid[])
      `,
      [input.assignedPlanId, input.entryDate, input.assignedBlockIds],
    );

    if (result.rows[0].count !== input.assignedBlockIds.length) {
      throw new CoachDiaryServiceError(
        "diary_task_not_found",
        "Assigned diary task was not found for this plan",
      );
    }
  }

  if (input.assignedExerciseIds.length > 0) {
    const result = await pool.query<CountRow>(
      `
        SELECT COUNT(DISTINCT assigned_block_exercises.id)::int AS count
        FROM assigned_plans
        JOIN assigned_plan_days ON assigned_plan_days.assigned_plan_id = assigned_plans.id
        JOIN assigned_day_sessions ON assigned_day_sessions.assigned_day_id = assigned_plan_days.id
        JOIN assigned_day_blocks ON assigned_day_blocks.assigned_session_id = assigned_day_sessions.id
        JOIN assigned_block_exercises
          ON assigned_block_exercises.assigned_block_id = assigned_day_blocks.id
        WHERE assigned_plans.id = $1
          AND assigned_plan_days.day_date = $2::date
          AND assigned_block_exercises.id = ANY($3::uuid[])
      `,
      [input.assignedPlanId, input.entryDate, input.assignedExerciseIds],
    );

    if (result.rows[0].count !== input.assignedExerciseIds.length) {
      throw new CoachDiaryServiceError(
        "diary_task_not_found",
        "Assigned diary task was not found for this plan",
      );
    }
  }
}

export async function submitCoachDiaryEntry(
  input: SubmitCoachDiaryInput,
): Promise<CoachDiaryEntry> {
  const notes = input.payload.notes.trim();

  if (!notes) {
    throw new CoachDiaryServiceError(
      "diary_notes_required",
      "Diary notes are required",
    );
  }

  const scope: CoachDiaryScope = input.payload.scope === "tasks" ? "tasks" : "day";
  const assignedBlockIds = scope === "tasks" ? uniqueIds(input.payload.assignedBlockIds) : [];
  const assignedExerciseIds = scope === "tasks" ? uniqueIds(input.payload.assignedExerciseIds) : [];

  if (scope === "tasks" && assignedBlockIds.length === 0 && assignedExerciseIds.length === 0) {
    throw new CoachDiaryServiceError(
      "diary_task_selection_required",
      "Diary task selection is required",
    );
  }

  const existingEntry = await loadEntryByClientRequestId(
    input.payload.athleteId,
    input.clientRequestId ?? null,
  );

  if (existingEntry) {
    return existingEntry;
  }

  const planContext = await loadAssignedPlanDiaryContext(input.payload);
  await assertTaskIdsBelongToPlan({
    assignedPlanId: input.payload.assignedPlanId,
    entryDate: planContext.day_date,
    assignedBlockIds,
    assignedExerciseIds,
  });

  const result = await pool.query<CoachDiaryEntryRow>(
    `
      INSERT INTO coach_diary_entries (
        athlete_id,
        coach_user_id,
        assigned_plan_id,
        entry_date,
        scope,
        notes,
        assigned_block_ids,
        assigned_exercise_ids,
        client_request_id,
        updated_at
      )
      VALUES ($1, $2, $3, $4::date, $5, $6, $7::uuid[], $8::uuid[], $9, NOW())
      RETURNING
        coach_diary_entries.id,
        coach_diary_entries.athlete_id,
        coach_diary_entries.coach_user_id,
        (
          SELECT users.full_name
          FROM users
          WHERE users.id = coach_diary_entries.coach_user_id
        ) AS coach_name,
        coach_diary_entries.assigned_plan_id,
        coach_diary_entries.entry_date::text,
        coach_diary_entries.scope,
        coach_diary_entries.notes,
        coach_diary_entries.assigned_block_ids,
        coach_diary_entries.assigned_exercise_ids,
        coach_diary_entries.created_at::text,
        coach_diary_entries.updated_at::text
    `,
    [
      input.payload.athleteId,
      input.coachUserId,
      input.payload.assignedPlanId,
      planContext.day_date,
      scope,
      notes,
      assignedBlockIds,
      assignedExerciseIds,
      input.clientRequestId ?? null,
    ],
  );

  const entry = mapCoachDiaryEntry(result.rows[0]);

  await markCoachTeamDayDirtyForAthlete({
    athleteId: entry.athleteId,
    entryDate: entry.entryDate,
    reason: "coach_diary",
  });

  return entry;
}
