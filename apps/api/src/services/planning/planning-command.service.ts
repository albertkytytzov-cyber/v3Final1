import type {
  AssignedPlanBlock,
  AssignedPlanPayload,
  AssignedPlanSummary,
  AutoAssignMicrocyclePayload,
  PlanBlockInput,
  PlanDayInput,
  PlanExerciseInput,
  PlanTemplatePayload,
} from "@training-platform/shared";
import {
  prepareAutoAssignItems,
  resolvePlannedPhase,
} from "../../domain/planning/auto-assign.policy";
import { estimateBlocksLoad } from "../../domain/planning/load-balance.policy";
import { normalizePlanDeviceWorkoutSessions } from "../../domain/planning/plan-structure-normalization";
import { pool } from "../../db";
import { markAnalyticsDirty } from "../analytics/analytics-query.service";
import { markCoachTeamDayDirtyForAthlete } from "../analytics/coach-team-day.service";
import { getCompetitionContextForAthlete } from "../competition/competition-query.service";
import {
  getAssignedPlanById,
  loadPlanTemplateStructure,
} from "./planning-query.service";

export class PlanningCommandServiceError extends Error {
  constructor(
    public readonly code:
      | "template_blocks_not_found"
      | "template_not_found"
      | "template_in_use"
      | "assigned_plan_not_found",
    message: string,
  ) {
    super(message);
    this.name = "PlanningCommandServiceError";
  }
}

function defaultExerciseForBlock(block: PlanBlockInput): PlanExerciseInput {
  return {
    name: block.name,
    targetSets: block.targetSets,
    targetReps: block.targetReps,
    targetWeightKg: null,
    targetDurationMinutes: block.targetDurationMinutes,
    targetRpe: block.targetRpe,
    notes: "",
  };
}

function normalizePlanningNote(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function splitPlanningNoteParts(value: string | null | undefined) {
  return normalizePlanningNote(value)
    .split(/\s*(?:\/|;)\s*/u)
    .map(normalizePlanningNote)
    .filter(Boolean);
}

function mergePlanningNotes(...values: Array<string | null | undefined>) {
  return values
    .flatMap(splitPlanningNoteParts)
    .filter((value, index, items) => items.indexOf(value) === index)
    .join(" / ");
}

function normalizeAssignedExerciseNotes(
  exerciseNotes: string | null | undefined,
  blockNotes: string | null | undefined,
  dayNotes: string | null | undefined,
) {
  const notes = normalizePlanningNote(exerciseNotes);

  if (!notes) {
    return "";
  }

  const commonNotes = new Set([
    normalizePlanningNote(blockNotes),
    normalizePlanningNote(dayNotes),
    ...splitPlanningNoteParts(blockNotes),
    ...splitPlanningNoteParts(dayNotes),
  ].filter(Boolean));

  return commonNotes.has(notes) ? "" : notes;
}

function normalizeBlock(block: PlanBlockInput): PlanBlockInput {
  return {
    ...block,
    rowKind: block.rowKind ?? "exercise",
    replacementBlockId: block.replacementBlockId ?? null,
    exercises:
      block.exercises && block.exercises.length
        ? block.exercises.map((exercise) => ({
            ...exercise,
            targetWeightKg: exercise.targetWeightKg ?? null,
          }))
        : [defaultExerciseForBlock(block)],
  };
}

function normalizeTemplateDays(payload: PlanTemplatePayload): PlanDayInput[] {
  if (payload.days?.length) {
    return payload.days.map((day, dayIndex) => ({
      ...day,
      notes: day.notes ?? "",
      orderIndex: day.orderIndex ?? dayIndex,
      sessions: normalizePlanDeviceWorkoutSessions(
        day.sessions.map((session, sessionIndex) => ({
          ...session,
          notes: session.notes ?? "",
          orderIndex: session.orderIndex ?? sessionIndex,
          executionMode: session.executionMode ?? "whole_session",
          deviceLinkMode: session.deviceLinkMode ?? "session",
          blocks: session.blocks.map(normalizeBlock),
        })),
      ),
    }));
  }

  return [
    {
      label: "Day 1",
      notes: "",
      orderIndex: 0,
      sessions: normalizePlanDeviceWorkoutSessions([
        {
          name: "Primary session",
          notes: "",
          orderIndex: 0,
          executionMode: "whole_session",
          deviceLinkMode: "session",
          blocks: payload.blocks.map(normalizeBlock),
        },
      ]),
    },
  ];
}

function flattenTemplateBlocks(days: PlanDayInput[]) {
  return days.flatMap((day) => day.sessions.flatMap((session) => session.blocks));
}

function sumNullableNumbers(values: Array<number | null | undefined>) {
  const filteredValues = values.filter(
    (value): value is number => value !== null && value !== undefined,
  );

  return filteredValues.length
    ? Number(filteredValues.reduce((sum, value) => sum + value, 0).toFixed(2))
    : null;
}

function averageNullableNumbers(values: Array<number | null | undefined>) {
  const filteredValues = values.filter(
    (value): value is number => value !== null && value !== undefined,
  );

  return filteredValues.length
    ? Number(
        (
          filteredValues.reduce((sum, value) => sum + value, 0) /
          filteredValues.length
        ).toFixed(1),
      )
    : null;
}

function summarizeAssignedPlanBlockLoad(block: AssignedPlanBlock) {
  const exercises = block.exercises ?? [];

  return {
    plannedLoad: estimateBlocksLoad([block]),
    plannedDurationMinutes:
      block.targetDurationMinutes ??
      sumNullableNumbers(exercises.map((exercise) => exercise.targetDurationMinutes)),
    plannedRpe:
      block.targetRpe ??
      averageNullableNumbers(exercises.map((exercise) => exercise.targetRpe)),
    plannedSets:
      block.targetSets ??
      sumNullableNumbers(exercises.map((exercise) => exercise.targetSets)),
    plannedReps:
      block.targetReps ??
      sumNullableNumbers(exercises.map((exercise) => exercise.targetReps)),
  };
}

async function upsertPlannedLoadLogsForAssignedPlan(
  assignedPlan: AssignedPlanSummary | null,
) {
  if (!assignedPlan) {
    return;
  }

  for (const session of assignedPlan.day.sessions) {
    for (const block of session.blocks) {
      const summary = summarizeAssignedPlanBlockLoad(block);

      await pool.query(
        `
          INSERT INTO training_load_logs (
            athlete_id,
            assigned_plan_id,
            assigned_block_id,
            log_date,
            planned_load,
            planned_duration_minutes,
            planned_rpe,
            planned_sets,
            planned_reps,
            completion_status,
            source_type,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4::date,
            $5,
            $6,
            $7,
            $8,
            $9,
            'not_started',
            'plan',
            NOW()
          )
          ON CONFLICT (athlete_id, assigned_block_id, log_date)
          DO UPDATE SET
            assigned_plan_id = EXCLUDED.assigned_plan_id,
            planned_load = EXCLUDED.planned_load,
            planned_duration_minutes = EXCLUDED.planned_duration_minutes,
            planned_rpe = EXCLUDED.planned_rpe,
            planned_sets = EXCLUDED.planned_sets,
            planned_reps = EXCLUDED.planned_reps,
            completion_status = CASE
              WHEN training_load_logs.source_type = 'execution'
                THEN training_load_logs.completion_status
              ELSE EXCLUDED.completion_status
            END,
            source_type = CASE
              WHEN training_load_logs.source_type = 'execution'
                THEN training_load_logs.source_type
              ELSE EXCLUDED.source_type
            END,
            updated_at = NOW()
        `,
        [
          assignedPlan.athleteId,
          assignedPlan.id,
          block.id,
          assignedPlan.day.dayDate,
          summary.plannedLoad,
          summary.plannedDurationMinutes,
          summary.plannedRpe,
          summary.plannedSets,
          summary.plannedReps,
        ],
      );
    }
  }
}

async function syncMesocycleWeekTargetsForDates(input: {
  athleteId: string;
  dates: string[];
}) {
  const dates = Array.from(new Set(input.dates.filter(Boolean)));

  if (!dates.length) {
    return;
  }

  await pool.query(
    `
      WITH affected_weeks AS (
        SELECT DISTINCT
          mesocycles.id AS mesocycle_id,
          (week.value ->> 'startDate')::date AS start_date,
          (week.value ->> 'endDate')::date AS end_date
        FROM mesocycles
        CROSS JOIN LATERAL jsonb_array_elements(mesocycles.week_plan_json) AS week(value)
        WHERE mesocycles.athlete_id = $1
          AND EXISTS (
            SELECT 1
            FROM unnest($2::date[]) AS assigned_dates(day_date)
            WHERE assigned_dates.day_date BETWEEN
              (week.value ->> 'startDate')::date AND (week.value ->> 'endDate')::date
          )
      ),
      week_loads AS (
        SELECT
          affected_weeks.mesocycle_id,
          affected_weeks.start_date,
          affected_weeks.end_date,
          ROUND(COALESCE(SUM(training_load_logs.planned_load), 0)::numeric, 1) AS target_load
        FROM affected_weeks
        LEFT JOIN training_load_logs
          ON training_load_logs.athlete_id = $1
         AND training_load_logs.log_date BETWEEN affected_weeks.start_date AND affected_weeks.end_date
        GROUP BY
          affected_weeks.mesocycle_id,
          affected_weeks.start_date,
          affected_weeks.end_date
        HAVING COALESCE(SUM(training_load_logs.planned_load), 0) > 0
      ),
      rebuilt_mesocycles AS (
        SELECT
          mesocycles.id,
          jsonb_agg(
            CASE
              WHEN week_loads.mesocycle_id IS NOT NULL
                THEN jsonb_set(
                  week.value,
                  '{targetLoad}',
                  to_jsonb(week_loads.target_load),
                  false
                )
              ELSE week.value
            END
            ORDER BY week.ordinality
          ) AS week_plan_json
        FROM mesocycles
        CROSS JOIN LATERAL jsonb_array_elements(mesocycles.week_plan_json)
          WITH ORDINALITY AS week(value, ordinality)
        LEFT JOIN week_loads
          ON week_loads.mesocycle_id = mesocycles.id
         AND week_loads.start_date = (week.value ->> 'startDate')::date
         AND week_loads.end_date = (week.value ->> 'endDate')::date
        WHERE mesocycles.id IN (SELECT mesocycle_id FROM week_loads)
        GROUP BY mesocycles.id
      )
      UPDATE mesocycles
      SET week_plan_json = rebuilt_mesocycles.week_plan_json,
          updated_at = NOW()
      FROM rebuilt_mesocycles
      WHERE mesocycles.id = rebuilt_mesocycles.id
    `,
    [input.athleteId, dates],
  );
}

async function insertAssignedPlanFromTemplate(input: {
  athleteId: string;
  coachUserId: string;
  templateId: string;
  dayLabel: string;
  dayDate: string;
  dayNotes: string;
  plannedPhase: AssignedPlanSummary["plannedPhase"];
  competitionContext: AssignedPlanSummary["competitionContextSnapshot"];
  templateDayIndex?: number | null;
}) {
  const templateStructure = await loadPlanTemplateStructure(input.templateId);
  const requestedDayIndex =
    input.templateDayIndex !== null &&
    input.templateDayIndex !== undefined &&
    Number.isFinite(input.templateDayIndex)
      ? Math.max(0, input.templateDayIndex)
      : 0;
  const templateDay =
    templateStructure?.days[requestedDayIndex] ?? templateStructure?.days[0] ?? null;
  const templateBlocks =
    templateDay?.sessions.flatMap((session) => session.blocks) ??
    templateStructure?.flatBlocks ??
    [];

  if (!templateBlocks.length) {
    throw new PlanningCommandServiceError(
      "template_blocks_not_found",
      "Plan template blocks were not found",
    );
  }

  const sessions = templateDay?.sessions?.length
    ? templateDay.sessions
    : [
        {
          id: "fallback-session",
          name: "Primary session",
          notes: "",
          displayOrder: 0,
          blocks: templateBlocks,
          executionMode: "whole_session",
          deviceLinkMode: "session",
        },
      ];
  const assignedDayNotes = mergePlanningNotes(
    input.dayNotes,
    templateDay?.notes,
    ...sessions.map((session) => session.notes),
  );

  const assignedPlan = await pool.query<{ id: string }>(
    `
      INSERT INTO assigned_plans (
        athlete_id,
        coach_user_id,
        template_id,
        start_date,
        planned_phase,
        competition_context_snapshot
      )
      VALUES ($1, $2, $3, $4::date, $5, $6::jsonb)
      RETURNING id
    `,
    [
      input.athleteId,
      input.coachUserId,
      input.templateId,
      input.dayDate,
      input.plannedPhase,
      JSON.stringify(input.competitionContext),
    ],
  );

  const assignedDay = await pool.query<{ id: string }>(
    `
      INSERT INTO assigned_plan_days (assigned_plan_id, label, day_date, notes, display_order)
      VALUES ($1, $2, $3::date, $4, 0)
      RETURNING id
    `,
    [
      assignedPlan.rows[0].id,
      input.dayLabel || templateDay?.label || "Day 1",
      input.dayDate,
      assignedDayNotes,
    ],
  );

  const templateBlockToAssignedBlockId = new Map<string, string>();

  for (const [sessionIndex, session] of sessions.entries()) {
    const assignedSession = await pool.query<{ id: string }>(
      `
        INSERT INTO assigned_day_sessions (
          assigned_day_id,
          name,
          execution_mode,
          device_link_mode,
          display_order
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [
        assignedDay.rows[0].id,
        session.name,
        session.executionMode ?? "whole_session",
        session.deviceLinkMode ?? "session",
        session.displayOrder ?? sessionIndex,
      ],
    );

    for (const block of session.blocks) {
      const insertedBlock = await pool.query<{ id: string }>(
        `
          INSERT INTO assigned_day_blocks (
            assigned_session_id,
            template_block_id,
            name,
            row_kind,
            block_type,
            block_priority,
            is_mandatory,
            remove_priority_yellow,
            remove_priority_red,
            reduction_percent_yellow,
            reduction_percent_red,
            replacement_block_id,
            target_duration_minutes,
            target_rpe,
            target_sets,
            target_reps,
            notes,
            display_order
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULL, $12, $13, $14, $15, $16, $17)
          RETURNING id
        `,
        [
          assignedSession.rows[0].id,
          block.id,
          block.name,
          block.rowKind ?? "exercise",
          block.blockType,
          block.blockPriority,
          block.isMandatory,
          block.removePriorityYellow,
          block.removePriorityRed,
          block.reductionPercentYellow,
          block.reductionPercentRed,
          block.targetDurationMinutes,
          block.targetRpe,
          block.targetSets,
          block.targetReps,
          block.notes,
          block.displayOrder,
        ],
      );

      templateBlockToAssignedBlockId.set(block.id, insertedBlock.rows[0].id);

      for (const [exerciseIndex, exercise] of (block.exercises ?? []).entries()) {
        await pool.query(
          `
            INSERT INTO assigned_block_exercises (
              assigned_block_id,
              source_block_exercise_id,
              name,
              target_sets,
              target_reps,
              target_weight_kg,
              target_duration_minutes,
              target_rpe,
              notes,
              display_order
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `,
          [
            insertedBlock.rows[0].id,
            exercise.id ?? null,
            exercise.name,
            exercise.targetSets,
            exercise.targetReps,
            exercise.targetWeightKg,
            exercise.targetDurationMinutes,
            exercise.targetRpe,
            normalizeAssignedExerciseNotes(exercise.notes, block.notes, assignedDayNotes),
            exercise.displayOrder ?? exerciseIndex,
          ],
        );
      }
    }
  }

  for (const block of templateBlocks.filter((item) => item.replacementBlockId)) {
    const assignedBlockId = templateBlockToAssignedBlockId.get(block.id);
    const assignedReplacementBlockId = block.replacementBlockId
      ? templateBlockToAssignedBlockId.get(block.replacementBlockId)
      : null;

    if (!assignedBlockId || !assignedReplacementBlockId) {
      continue;
    }

    await pool.query(
      `
        UPDATE assigned_day_blocks
        SET replacement_block_id = $2
        WHERE id = $1
      `,
      [assignedBlockId, assignedReplacementBlockId],
    );
  }

  return assignedPlan.rows[0].id;
}

async function insertTemplateHierarchy(input: {
  templateId: string;
  days: PlanDayInput[];
}) {
  const blockInsertions: Array<{
    payload: PlanBlockInput;
    blockId: string;
  }> = [];

  for (const [dayIndex, day] of input.days.entries()) {
    const insertedDay = await pool.query<{ id: string }>(
      `
        INSERT INTO plan_days (plan_template_id, label, notes, display_order)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [input.templateId, day.label, day.notes ?? "", day.orderIndex ?? dayIndex],
    );

    for (const [sessionIndex, session] of day.sessions.entries()) {
      const insertedSession = await pool.query<{ id: string }>(
        `
          INSERT INTO plan_sessions (
            plan_day_id,
            name,
            notes,
            execution_mode,
            device_link_mode,
            display_order
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `,
        [
          insertedDay.rows[0].id,
          session.name,
          session.notes ?? "",
          session.executionMode ?? "whole_session",
          session.deviceLinkMode ?? "session",
          session.orderIndex ?? sessionIndex,
        ],
      );

      for (const [blockIndex, block] of session.blocks.entries()) {
        const insertedBlock = await pool.query<{ id: string }>(
          `
            INSERT INTO plan_blocks (
              plan_template_id,
              plan_session_id,
              name,
              row_kind,
              block_type,
              block_priority,
              is_mandatory,
              remove_priority_yellow,
              remove_priority_red,
              reduction_percent_yellow,
              reduction_percent_red,
              replacement_block_id,
              target_duration_minutes,
              target_rpe,
              target_sets,
              target_reps,
              notes,
              display_order
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULL, $12, $13, $14, $15, $16, $17)
            RETURNING id
          `,
          [
            input.templateId,
            insertedSession.rows[0].id,
            block.name,
            block.rowKind ?? "exercise",
            block.blockType,
            block.blockPriority,
            block.isMandatory,
            block.removePriorityYellow,
            block.removePriorityRed,
            block.reductionPercentYellow,
            block.reductionPercentRed,
            block.targetDurationMinutes,
            block.targetRpe,
            block.targetSets,
            block.targetReps,
            block.notes,
            blockIndex,
          ],
        );

        blockInsertions.push({
          payload: block,
          blockId: insertedBlock.rows[0].id,
        });

        const exercises = block.exercises?.length
          ? block.exercises
          : [defaultExerciseForBlock(block)];

        for (const [exerciseIndex, exercise] of exercises.entries()) {
          await pool.query(
            `
              INSERT INTO block_exercises (
                plan_block_id,
                name,
                target_sets,
                target_reps,
                target_weight_kg,
                target_duration_minutes,
                target_rpe,
                notes,
                display_order
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `,
            [
              insertedBlock.rows[0].id,
              exercise.name,
              exercise.targetSets,
              exercise.targetReps,
              exercise.targetWeightKg,
              exercise.targetDurationMinutes,
              exercise.targetRpe,
              exercise.notes,
              exercise.displayOrder ?? exerciseIndex,
            ],
          );
        }
      }
    }
  }

  const blockIdByName = new Map(
    blockInsertions.map((item) => [item.payload.name, item.blockId]),
  );

  for (const insertion of blockInsertions) {
    if (!insertion.payload.replacementBlockId) {
      continue;
    }

    const replacementBlockId =
      blockIdByName.get(insertion.payload.replacementBlockId) ??
      insertion.payload.replacementBlockId;

    await pool.query(
      `
        UPDATE plan_blocks
        SET replacement_block_id = $2
        WHERE id = $1
      `,
      [insertion.blockId, replacementBlockId],
    );
  }
}

export async function createPlanTemplate(input: {
  coachUserId: string;
  payload: PlanTemplatePayload;
}) {
  const normalizedDays = normalizeTemplateDays(input.payload);
  const normalizedBlocks = flattenTemplateBlocks(normalizedDays);
  const result = await pool.query<{ id: string; created_at: string }>(
    `
      INSERT INTO plan_templates (
        coach_user_id,
        name,
        description,
        sport_type,
        phase_focus,
        competition_priority_focus,
        template_goal,
        microcycle_type,
        competition_specific
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, created_at::text
    `,
    [
      input.coachUserId,
      input.payload.name,
      input.payload.description ?? "",
      input.payload.sportType ?? "",
      input.payload.phaseFocus ?? null,
      input.payload.competitionPriorityFocus ?? null,
      input.payload.templateGoal ?? "",
      input.payload.microcycleType ?? "",
      input.payload.competitionSpecific ?? false,
    ],
  );

  await insertTemplateHierarchy({
    templateId: result.rows[0].id,
    days: normalizedDays,
  });

  return {
    template: {
      id: result.rows[0].id,
      coachUserId: input.coachUserId,
      name: input.payload.name,
      description: input.payload.description ?? "",
      sportType: input.payload.sportType ?? "",
      phaseFocus: input.payload.phaseFocus ?? null,
      competitionPriorityFocus: input.payload.competitionPriorityFocus ?? null,
      templateGoal: input.payload.templateGoal ?? "",
      microcycleType: input.payload.microcycleType ?? "",
      competitionSpecific: input.payload.competitionSpecific ?? false,
      estimatedLoad: estimateBlocksLoad(normalizedBlocks),
      createdAt: result.rows[0].created_at,
      blockCount: normalizedBlocks.length,
      blocks: normalizedBlocks,
      days: normalizedDays,
    },
  };
}

export async function deletePlanTemplate(input: {
  coachUserId: string;
  role: string;
  templateId: string;
  force?: boolean;
}) {
  const template = await pool.query<{ id: string }>(
    `
      SELECT id
      FROM plan_templates
      WHERE id = $1 AND (coach_user_id = $2 OR $3 = 'admin')
      LIMIT 1
    `,
    [input.templateId, input.coachUserId, input.role],
  );

  if (!template.rowCount) {
    throw new PlanningCommandServiceError(
      "template_not_found",
      "Plan template was not found",
    );
  }

  const usage = await pool.query<{ assigned_count: string }>(
    `
      SELECT COUNT(*)::text AS assigned_count
      FROM assigned_plans
      WHERE template_id = $1
    `,
    [input.templateId],
  );
  const assignedCount = Number(usage.rows[0]?.assigned_count ?? 0);

  if (assignedCount > 0 && !input.force) {
    throw new PlanningCommandServiceError(
      "template_in_use",
      "Template is already assigned to athletes and cannot be deleted",
    );
  }

  await pool.query("DELETE FROM plan_templates WHERE id = $1", [input.templateId]);

  return {
    deleted: true,
    templateId: input.templateId,
  };
}

export async function deleteAssignedPlan(input: {
  coachUserId: string;
  role: string;
  assignedPlanId: string;
}) {
  const assignedPlan = await pool.query<{
    id: string;
    athlete_id: string;
    day_date: string | null;
  }>(
    `
      SELECT
        assigned_plans.id,
        assigned_plans.athlete_id,
        assigned_plan_days.day_date::text
      FROM assigned_plans
      LEFT JOIN assigned_plan_days ON assigned_plan_days.assigned_plan_id = assigned_plans.id
      WHERE assigned_plans.id = $1 AND (coach_user_id = $2 OR $3 = 'admin')
    `,
    [input.assignedPlanId, input.coachUserId, input.role],
  );

  if (!assignedPlan.rowCount) {
    throw new PlanningCommandServiceError(
      "assigned_plan_not_found",
      "Assigned plan was not found",
    );
  }

  await pool.query("DELETE FROM assigned_plans WHERE id = $1", [input.assignedPlanId]);

  await Promise.all(
    assignedPlan.rows.filter((row) => row.day_date).map((row) => {
      const entryDate = row.day_date ?? new Date().toISOString().slice(0, 10);

      return Promise.all([
        markAnalyticsDirty({
          athleteId: row.athlete_id,
          referenceDate: entryDate,
          reason: "plan_deleted",
        }),
        markCoachTeamDayDirtyForAthlete({
          athleteId: row.athlete_id,
          entryDate,
          reason: "plan_deleted",
        }),
      ]);
    }),
  );

  return {
    deleted: true,
    assignedPlanId: input.assignedPlanId,
  };
}

export async function assignPlan(input: {
  coachUserId: string;
  payload: AssignedPlanPayload;
}) {
  const competitionContext = await getCompetitionContextForAthlete(
    input.payload.athleteId,
    input.payload.startDate,
  );
  const plannedPhase = resolvePlannedPhase(
    input.payload.plannedPhase,
    competitionContext,
  );
  const assignedPlanId = await insertAssignedPlanFromTemplate({
    athleteId: input.payload.athleteId,
    coachUserId: input.coachUserId,
    templateId: input.payload.templateId,
    dayLabel: input.payload.dayLabel,
    dayDate: input.payload.startDate,
    dayNotes: input.payload.notes ?? "",
    plannedPhase,
    competitionContext,
    templateDayIndex: null,
  });
  const assignedPlan = await getAssignedPlanById(assignedPlanId);
  await upsertPlannedLoadLogsForAssignedPlan(assignedPlan);
  await syncMesocycleWeekTargetsForDates({
    athleteId: input.payload.athleteId,
    dates: [input.payload.startDate],
  });
  await Promise.all([
    markAnalyticsDirty({
      athleteId: input.payload.athleteId,
      referenceDate: input.payload.startDate,
      reason: "plan_assigned",
    }),
    markCoachTeamDayDirtyForAthlete({
      athleteId: input.payload.athleteId,
      entryDate: input.payload.startDate,
      reason: "plan_assigned",
    }),
  ]);

  return {
    assignedPlan,
  };
}

export async function autoAssignMicrocycle(input: {
  coachUserId: string;
  payload: AutoAssignMicrocyclePayload;
}) {
  const competitionContext = await getCompetitionContextForAthlete(
    input.payload.athleteId,
    input.payload.startDate,
  );
  const plannedPhase = resolvePlannedPhase(
    input.payload.plannedPhase,
    competitionContext,
  );
  const preparedItems = prepareAutoAssignItems(input.payload);
  const createdPlans: AssignedPlanSummary[] = [];

  for (const item of preparedItems) {
    try {
      const assignedPlanId = await insertAssignedPlanFromTemplate({
        athleteId: input.payload.athleteId,
        coachUserId: input.coachUserId,
        templateId: item.templateId,
        dayLabel: item.dayLabel,
        dayDate: item.assignDate,
        dayNotes: item.assignedDayNotes,
        plannedPhase,
        competitionContext,
        templateDayIndex: item.templateDayIndex,
      });
      const createdPlan = await getAssignedPlanById(assignedPlanId);

      if (createdPlan) {
        await upsertPlannedLoadLogsForAssignedPlan(createdPlan);
        createdPlans.push(createdPlan);
      }
    } catch (error) {
      if (
        error instanceof PlanningCommandServiceError &&
        error.code === "template_blocks_not_found"
      ) {
        continue;
      }

      throw error;
    }
  }

  await syncMesocycleWeekTargetsForDates({
    athleteId: input.payload.athleteId,
    dates: createdPlans.map((plan) => plan.day.dayDate),
  });
  await Promise.all(
    createdPlans.map((plan) =>
      Promise.all([
        markAnalyticsDirty({
          athleteId: input.payload.athleteId,
          referenceDate: plan.day.dayDate,
          reason: "plan_auto_assigned",
        }),
        markCoachTeamDayDirtyForAthlete({
          athleteId: input.payload.athleteId,
          entryDate: plan.day.dayDate,
          reason: "plan_auto_assigned",
        }),
      ]),
    ),
  );

  return {
    assignedPlans: createdPlans,
  };
}
