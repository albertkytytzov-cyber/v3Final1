import type {
  AssignedBlockExercise,
  AssignedPlanBlock,
  AssignedPlanSummary,
  PlanBlockInput,
  PlanDayInput,
  PlanExerciseInput,
  PlanTemplateSummary,
} from "@training-platform/shared";
import { pool } from "../../db";

interface PlanTemplateRow {
  template_id: string;
  coach_user_id: string;
  template_name: string;
  description: string;
  sport_type: string;
  phase_focus: PlanTemplateSummary["phaseFocus"];
  competition_priority_focus: PlanTemplateSummary["competitionPriorityFocus"];
  template_goal: string;
  microcycle_type: string;
  competition_specific: boolean;
  created_at: string;
  day_id: string | null;
  day_label: string | null;
  day_notes: string | null;
  day_order: number | null;
  session_id: string | null;
  session_name: string | null;
  session_notes: string | null;
  session_order: number | null;
  block_id: string | null;
  block_name: string | null;
  block_type: PlanBlockInput["blockType"] | null;
  block_priority: number | null;
  is_mandatory: boolean | null;
  remove_priority_yellow: number | null;
  remove_priority_red: number | null;
  reduction_percent_yellow: number | null;
  reduction_percent_red: number | null;
  replacement_block_id: string | null;
  target_duration_minutes: string | null;
  target_rpe: string | null;
  target_sets: number | null;
  target_reps: number | null;
  notes: string | null;
  display_order: number | null;
  exercise_id: string | null;
  exercise_name: string | null;
  exercise_target_sets: number | null;
  exercise_target_reps: number | null;
  exercise_target_weight_kg: string | null;
  exercise_target_duration_minutes: string | null;
  exercise_target_rpe: string | null;
  exercise_notes: string | null;
  exercise_order: number | null;
}

interface AssignedPlanRow {
  assigned_plan_id: string;
  athlete_id: string;
  athlete_name: string;
  template_id: string;
  template_name: string;
  start_date: string;
  planned_phase: AssignedPlanSummary["plannedPhase"];
  competition_context_snapshot: AssignedPlanSummary["competitionContextSnapshot"];
  status: "active" | "completed" | "archived";
  created_at: string;
  day_id: string;
  day_label: string;
  day_date: string;
  day_notes: string;
  session_id: string | null;
  session_name: string | null;
  session_order: number | null;
  block_id: string | null;
  template_block_id: string | null;
  block_name: string | null;
  block_type: PlanBlockInput["blockType"] | null;
  block_priority: number | null;
  is_mandatory: boolean | null;
  remove_priority_yellow: number | null;
  remove_priority_red: number | null;
  reduction_percent_yellow: number | null;
  reduction_percent_red: number | null;
  replacement_block_id: string | null;
  target_duration_minutes: string | null;
  target_rpe: string | null;
  target_sets: number | null;
  target_reps: number | null;
  block_notes: string | null;
  block_order: number | null;
  exercise_id: string | null;
  source_block_exercise_id: string | null;
  exercise_name: string | null;
  exercise_target_sets: number | null;
  exercise_target_reps: number | null;
  exercise_target_weight_kg: string | null;
  exercise_target_duration_minutes: string | null;
  exercise_target_rpe: string | null;
  exercise_notes: string | null;
  exercise_order: number | null;
}

export interface PlanTemplateExerciseRecord extends PlanExerciseInput {
  id: string;
  displayOrder: number;
}

export interface PlanTemplateBlockRecord {
  id: string;
  name: string;
  blockType: PlanBlockInput["blockType"];
  blockPriority: number;
  isMandatory: boolean;
  removePriorityYellow: number;
  removePriorityRed: number;
  reductionPercentYellow: number;
  reductionPercentRed: number;
  targetDurationMinutes: number | null;
  targetRpe: number | null;
  targetSets: number | null;
  targetReps: number | null;
  notes: string;
  replacementBlockId: string | null;
  displayOrder: number;
  exercises: PlanTemplateExerciseRecord[];
}

export interface PlanTemplateSessionRecord {
  id: string;
  name: string;
  notes: string;
  displayOrder: number;
  blocks: PlanTemplateBlockRecord[];
}

export interface PlanTemplateDayRecord {
  id: string;
  label: string;
  notes: string;
  displayOrder: number;
  sessions: PlanTemplateSessionRecord[];
}

export interface PlanTemplateStructureRecord {
  templateId: string;
  days: PlanTemplateDayRecord[];
  flatBlocks: PlanTemplateBlockRecord[];
}

function toNullableNumber(value: string | null) {
  return value !== null ? Number(value) : null;
}

function mapPlanExercise(row: PlanTemplateRow): PlanTemplateExerciseRecord | null {
  if (!row.exercise_id || !row.exercise_name) {
    return null;
  }

  return {
    id: row.exercise_id,
    name: row.exercise_name,
    targetSets: row.exercise_target_sets ?? null,
    targetReps: row.exercise_target_reps ?? null,
    targetWeightKg: toNullableNumber(row.exercise_target_weight_kg),
    targetDurationMinutes: toNullableNumber(row.exercise_target_duration_minutes),
    targetRpe: toNullableNumber(row.exercise_target_rpe),
    notes: row.exercise_notes ?? "",
    displayOrder: row.exercise_order ?? 0,
  };
}

function buildPlanBlockInput(row: PlanTemplateRow): PlanBlockInput {
  return {
    name: row.block_name ?? "",
    blockType: row.block_type!,
    blockPriority: row.block_priority ?? 1,
    isMandatory: row.is_mandatory ?? false,
    removePriorityYellow: row.remove_priority_yellow ?? 5,
    removePriorityRed: row.remove_priority_red ?? 5,
    reductionPercentYellow: row.reduction_percent_yellow ?? 0,
    reductionPercentRed: row.reduction_percent_red ?? 0,
    targetDurationMinutes: toNullableNumber(row.target_duration_minutes),
    targetRpe: toNullableNumber(row.target_rpe),
    targetSets: row.target_sets ?? null,
    targetReps: row.target_reps ?? null,
    notes: row.notes ?? "",
    replacementBlockId: row.replacement_block_id,
    exercises: [],
  };
}

function buildPlanTemplateStructureMap(rows: PlanTemplateRow[]) {
  const templateSummaryMap = new Map<string, PlanTemplateSummary>();
  const structureMap = new Map<string, PlanTemplateStructureRecord>();
  const templateBlockMap = new Map<string, Map<string, PlanTemplateBlockRecord>>();
  const templateSummaryBlockMap = new Map<string, Map<string, PlanBlockInput>>();

  for (const row of rows) {
    if (!templateSummaryMap.has(row.template_id)) {
      templateSummaryMap.set(row.template_id, {
        id: row.template_id,
        coachUserId: row.coach_user_id,
        name: row.template_name,
        description: row.description,
        sportType: row.sport_type,
        phaseFocus: row.phase_focus ?? null,
        competitionPriorityFocus: row.competition_priority_focus ?? null,
        templateGoal: row.template_goal ?? "",
        microcycleType: row.microcycle_type ?? "",
        competitionSpecific: row.competition_specific ?? false,
        estimatedLoad: 0,
        createdAt: row.created_at,
        blockCount: 0,
        blocks: [],
        days: [],
      });

      structureMap.set(row.template_id, {
        templateId: row.template_id,
        days: [],
        flatBlocks: [],
      });
      templateBlockMap.set(row.template_id, new Map());
      templateSummaryBlockMap.set(row.template_id, new Map());
    }

    if (!row.day_id || !row.day_label) {
      continue;
    }

    const templateSummary = templateSummaryMap.get(row.template_id)!;
    const structure = structureMap.get(row.template_id)!;
    const blockLookup = templateBlockMap.get(row.template_id)!;
    const summaryBlockLookup = templateSummaryBlockMap.get(row.template_id)!;

    let day = structure.days.find((item) => item.id === row.day_id);
    if (!day) {
      day = {
        id: row.day_id,
        label: row.day_label,
        notes: row.day_notes ?? "",
        displayOrder: row.day_order ?? 0,
        sessions: [],
      };
      structure.days.push(day);
      templateSummary.days?.push({
        id: row.day_id,
        label: row.day_label,
        notes: row.day_notes ?? "",
        orderIndex: row.day_order ?? 0,
        sessions: [],
      });
    }

    if (!row.session_id || !row.session_name) {
      continue;
    }

    let session = day.sessions.find((item) => item.id === row.session_id);
    let sessionSummary = templateSummary.days
      ?.find((item) => item.id === row.day_id)
      ?.sessions.find((item) => item.id === row.session_id);

    if (!session) {
      session = {
        id: row.session_id,
        name: row.session_name,
        notes: row.session_notes ?? "",
        displayOrder: row.session_order ?? 0,
        blocks: [],
      };
      day.sessions.push(session);
    }

    if (!sessionSummary) {
      sessionSummary = {
        id: row.session_id,
        name: row.session_name,
        notes: row.session_notes ?? "",
        orderIndex: row.session_order ?? 0,
        blocks: [],
      };
      templateSummary.days
        ?.find((item) => item.id === row.day_id)
        ?.sessions.push(sessionSummary);
    }

    if (!row.block_id || !row.block_name || !row.block_type) {
      continue;
    }

    let block = blockLookup.get(row.block_id);
    let blockSummary = summaryBlockLookup.get(row.block_id);

    if (!block) {
      block = {
        id: row.block_id,
        ...buildPlanBlockInput(row),
        replacementBlockId: row.replacement_block_id,
        displayOrder: row.display_order ?? 0,
        exercises: [],
      };
      blockLookup.set(row.block_id, block);
      structure.flatBlocks.push(block);
      session.blocks.push(block);
    } else if (!session.blocks.some((item) => item.id === row.block_id)) {
      session.blocks.push(block);
    }

    if (!blockSummary) {
      blockSummary = buildPlanBlockInput(row);
      templateSummary.blocks.push(blockSummary);
      summaryBlockLookup.set(row.block_id, blockSummary);
    }

    const exercise = mapPlanExercise(row);
    if (exercise) {
      if (!block.exercises.some((item) => item.id === exercise.id)) {
        block.exercises.push(exercise);
      }

      blockSummary.exercises ??= [];
      if (!blockSummary.exercises.some((item) => item.id === exercise.id)) {
        blockSummary.exercises.push({
          id: exercise.id,
          name: exercise.name,
          targetSets: exercise.targetSets,
          targetReps: exercise.targetReps,
          targetWeightKg: exercise.targetWeightKg,
          targetDurationMinutes: exercise.targetDurationMinutes,
          targetRpe: exercise.targetRpe,
          notes: exercise.notes,
        });
      }
    }

    if (!sessionSummary.blocks.includes(blockSummary)) {
      sessionSummary.blocks.push(blockSummary);
    }
  }

  for (const template of templateSummaryMap.values()) {
    template.blocks.sort((left, right) => left.name.localeCompare(right.name));
    template.blockCount = template.blocks.length;
    template.estimatedLoad = Number(
      template.blocks
        .reduce((sum, block) => {
          const duration = block.targetDurationMinutes ?? 20;
          const rpe = block.targetRpe ?? 5;
          return sum + duration * rpe;
        }, 0)
        .toFixed(1),
    );
    template.days?.sort((left, right) => (left.orderIndex ?? 0) - (right.orderIndex ?? 0));
    for (const day of template.days ?? []) {
      day.sessions.sort((left, right) => (left.orderIndex ?? 0) - (right.orderIndex ?? 0));
      for (const session of day.sessions) {
        session.blocks.sort((left, right) => left.name.localeCompare(right.name));
      }
    }
  }

  return {
    summaries: Array.from(templateSummaryMap.values()),
    structures: structureMap,
  };
}

function mapAssignedExercise(row: AssignedPlanRow): AssignedBlockExercise | null {
  if (!row.exercise_id || !row.exercise_name) {
    return null;
  }

  return {
    id: row.exercise_id,
    sourceExerciseId: row.source_block_exercise_id,
    name: row.exercise_name,
    targetSets: row.exercise_target_sets ?? null,
    targetReps: row.exercise_target_reps ?? null,
    targetWeightKg: toNullableNumber(row.exercise_target_weight_kg),
    targetDurationMinutes: toNullableNumber(row.exercise_target_duration_minutes),
    targetRpe: toNullableNumber(row.exercise_target_rpe),
    notes: row.exercise_notes ?? "",
    orderIndex: row.exercise_order ?? 0,
  };
}

function mapAssignedPlans(rows: AssignedPlanRow[]): AssignedPlanSummary[] {
  const grouped = new Map<string, AssignedPlanSummary>();
  const blockMaps = new Map<string, Map<string, AssignedPlanBlock>>();

  for (const row of rows) {
    let assigned = grouped.get(row.assigned_plan_id);

    if (!assigned) {
      assigned = {
        id: row.assigned_plan_id,
        athleteId: row.athlete_id,
        athleteName: row.athlete_name,
        templateId: row.template_id,
        templateName: row.template_name,
        startDate: row.start_date,
        plannedPhase: row.planned_phase ?? null,
        competitionContextSnapshot: row.competition_context_snapshot ?? null,
        status: row.status,
        createdAt: row.created_at,
        day: {
          id: row.day_id,
          label: row.day_label,
          dayDate: row.day_date,
          notes: row.day_notes,
          sessions: [],
        },
      };
      grouped.set(row.assigned_plan_id, assigned);
      blockMaps.set(row.assigned_plan_id, new Map());
    }

    if (!row.session_id || !row.session_name) {
      continue;
    }

    let session = assigned.day.sessions.find((item) => item.id === row.session_id);

    if (!session) {
      session = {
        id: row.session_id,
        name: row.session_name,
        orderIndex: row.session_order ?? 0,
        blocks: [],
      };
      assigned.day.sessions.push(session);
    }

    if (!row.block_id || !row.block_name || !row.block_type) {
      continue;
    }

    const blockLookup = blockMaps.get(row.assigned_plan_id)!;
    let block = blockLookup.get(row.block_id);

    if (!block) {
      block = {
        id: row.block_id,
        templateBlockId: row.template_block_id,
        name: row.block_name,
        blockType: row.block_type,
        blockPriority: row.block_priority ?? 1,
        isMandatory: row.is_mandatory ?? false,
        removePriorityYellow: row.remove_priority_yellow ?? 5,
        removePriorityRed: row.remove_priority_red ?? 5,
        reductionPercentYellow: row.reduction_percent_yellow ?? 0,
        reductionPercentRed: row.reduction_percent_red ?? 0,
        targetDurationMinutes: toNullableNumber(row.target_duration_minutes),
        targetRpe: toNullableNumber(row.target_rpe),
        targetSets: row.target_sets ?? null,
        targetReps: row.target_reps ?? null,
        notes: row.block_notes ?? "",
        replacementBlockId: row.replacement_block_id,
        exercises: [],
      };
      blockLookup.set(row.block_id, block);
      session.blocks.push(block);
    }

    const exercise = mapAssignedExercise(row);
    if (exercise && !(block.exercises ?? []).some((item) => item.id === exercise.id)) {
      block.exercises ??= [];
      block.exercises.push(exercise);
    }
  }

  return Array.from(grouped.values());
}

async function loadPlanTemplateRows(whereSql: string, params: unknown[]) {
  const result = await pool.query<PlanTemplateRow>(
    `
      SELECT
        plan_templates.id AS template_id,
        plan_templates.coach_user_id,
        plan_templates.name AS template_name,
        plan_templates.description,
        plan_templates.sport_type,
        plan_templates.phase_focus,
        plan_templates.competition_priority_focus,
        plan_templates.template_goal,
        plan_templates.microcycle_type,
        plan_templates.competition_specific,
        plan_templates.created_at::text,
        plan_days.id AS day_id,
        plan_days.label AS day_label,
        plan_days.notes AS day_notes,
        plan_days.display_order AS day_order,
        plan_sessions.id AS session_id,
        plan_sessions.name AS session_name,
        plan_sessions.notes AS session_notes,
        plan_sessions.display_order AS session_order,
        plan_blocks.id AS block_id,
        plan_blocks.name AS block_name,
        plan_blocks.block_type,
        plan_blocks.block_priority,
        plan_blocks.is_mandatory,
        plan_blocks.remove_priority_yellow,
        plan_blocks.remove_priority_red,
        plan_blocks.reduction_percent_yellow,
        plan_blocks.reduction_percent_red,
        plan_blocks.replacement_block_id::text,
        plan_blocks.target_duration_minutes::text,
        plan_blocks.target_rpe::text,
        plan_blocks.target_sets,
        plan_blocks.target_reps,
        plan_blocks.notes,
        plan_blocks.display_order,
        block_exercises.id AS exercise_id,
        block_exercises.name AS exercise_name,
        block_exercises.target_sets AS exercise_target_sets,
        block_exercises.target_reps AS exercise_target_reps,
        block_exercises.target_weight_kg::text AS exercise_target_weight_kg,
        block_exercises.target_duration_minutes::text AS exercise_target_duration_minutes,
        block_exercises.target_rpe::text AS exercise_target_rpe,
        block_exercises.notes AS exercise_notes,
        block_exercises.display_order AS exercise_order
      FROM plan_templates
      LEFT JOIN plan_days ON plan_days.plan_template_id = plan_templates.id
      LEFT JOIN plan_sessions ON plan_sessions.plan_day_id = plan_days.id
      LEFT JOIN plan_blocks ON plan_blocks.plan_session_id = plan_sessions.id
      LEFT JOIN block_exercises ON block_exercises.plan_block_id = plan_blocks.id
      WHERE ${whereSql}
      ORDER BY
        plan_templates.created_at DESC,
        plan_days.display_order ASC,
        plan_sessions.display_order ASC,
        plan_blocks.display_order ASC,
        block_exercises.display_order ASC
    `,
    params,
  );

  return result.rows;
}

export async function listPlanTemplatesForCoachContext(
  coachUserId: string,
  role: string,
): Promise<PlanTemplateSummary[]> {
  const rows = await loadPlanTemplateRows(
    "plan_templates.coach_user_id = $1 OR $2 = 'admin'",
    [coachUserId, role],
  );

  return buildPlanTemplateStructureMap(rows).summaries;
}

export async function loadPlanTemplateStructure(
  templateId: string,
): Promise<PlanTemplateStructureRecord | null> {
  const rows = await loadPlanTemplateRows("plan_templates.id = $1", [templateId]);

  if (!rows.length) {
    return null;
  }

  return buildPlanTemplateStructureMap(rows).structures.get(templateId) ?? null;
}

export async function loadPlanTemplateBlocks(
  templateId: string,
): Promise<PlanTemplateBlockRecord[]> {
  const structure = await loadPlanTemplateStructure(templateId);
  return structure?.flatBlocks ?? [];
}

export async function loadAssignedPlans(
  whereSql: string,
  params: unknown[],
): Promise<AssignedPlanSummary[]> {
  const result = await pool.query<AssignedPlanRow>(
    `
      SELECT
        assigned_plans.id AS assigned_plan_id,
        assigned_plans.athlete_id,
        athletes_user.full_name AS athlete_name,
        assigned_plans.template_id,
        plan_templates.name AS template_name,
        assigned_plans.start_date::text,
        assigned_plans.planned_phase,
        assigned_plans.competition_context_snapshot,
        assigned_plans.status,
        assigned_plans.created_at::text,
        assigned_plan_days.id AS day_id,
        assigned_plan_days.label AS day_label,
        assigned_plan_days.day_date::text,
        assigned_plan_days.notes AS day_notes,
        assigned_day_sessions.id AS session_id,
        assigned_day_sessions.name AS session_name,
        assigned_day_sessions.display_order AS session_order,
        assigned_day_blocks.id AS block_id,
        assigned_day_blocks.template_block_id::text,
        assigned_day_blocks.name AS block_name,
        assigned_day_blocks.block_type,
        assigned_day_blocks.block_priority,
        assigned_day_blocks.is_mandatory,
        assigned_day_blocks.remove_priority_yellow,
        assigned_day_blocks.remove_priority_red,
        assigned_day_blocks.reduction_percent_yellow,
        assigned_day_blocks.reduction_percent_red,
        assigned_day_blocks.replacement_block_id::text,
        assigned_day_blocks.target_duration_minutes::text,
        assigned_day_blocks.target_rpe::text,
        assigned_day_blocks.target_sets,
        assigned_day_blocks.target_reps,
        assigned_day_blocks.notes AS block_notes,
        assigned_day_blocks.display_order AS block_order,
        assigned_block_exercises.id AS exercise_id,
        assigned_block_exercises.source_block_exercise_id::text,
        assigned_block_exercises.name AS exercise_name,
        assigned_block_exercises.target_sets AS exercise_target_sets,
        assigned_block_exercises.target_reps AS exercise_target_reps,
        assigned_block_exercises.target_weight_kg::text AS exercise_target_weight_kg,
        assigned_block_exercises.target_duration_minutes::text AS exercise_target_duration_minutes,
        assigned_block_exercises.target_rpe::text AS exercise_target_rpe,
        assigned_block_exercises.notes AS exercise_notes,
        assigned_block_exercises.display_order AS exercise_order
      FROM assigned_plans
      JOIN athletes ON athletes.id = assigned_plans.athlete_id
      JOIN users AS athletes_user ON athletes_user.id = athletes.user_id
      JOIN plan_templates ON plan_templates.id = assigned_plans.template_id
      JOIN assigned_plan_days ON assigned_plan_days.assigned_plan_id = assigned_plans.id
      LEFT JOIN assigned_day_sessions ON assigned_day_sessions.assigned_day_id = assigned_plan_days.id
      LEFT JOIN assigned_day_blocks ON assigned_day_blocks.assigned_session_id = assigned_day_sessions.id
      LEFT JOIN assigned_block_exercises
        ON assigned_block_exercises.assigned_block_id = assigned_day_blocks.id
      WHERE ${whereSql}
      ORDER BY
        assigned_plans.created_at DESC,
        assigned_day_sessions.display_order ASC,
        assigned_day_blocks.display_order ASC,
        assigned_block_exercises.display_order ASC
    `,
    params,
  );

  return mapAssignedPlans(result.rows);
}

export async function loadAssignedPlansForWindow(
  athleteId: string,
  startDate: string,
  endDate: string,
): Promise<AssignedPlanSummary[]> {
  return loadAssignedPlans(
    "assigned_plans.athlete_id = $1 AND assigned_plan_days.day_date BETWEEN $2::date AND $3::date AND assigned_plans.status = 'active'",
    [athleteId, startDate, endDate],
  );
}

export async function listAssignedPlansForAthlete(
  athleteId: string,
): Promise<AssignedPlanSummary[]> {
  return loadAssignedPlans(
    "assigned_plans.athlete_id = $1 AND assigned_plans.status = 'active'",
    [athleteId],
  );
}

export async function listAssignedPlansForCoachContext(
  coachUserId: string,
  role: string,
): Promise<AssignedPlanSummary[]> {
  return loadAssignedPlans(
    "(assigned_plans.coach_user_id = $1 OR $2 = 'admin') AND assigned_plans.status = 'active'",
    [coachUserId, role],
  );
}

export async function getAssignedPlanById(
  assignedPlanId: string,
): Promise<AssignedPlanSummary | null> {
  const [assignedPlan] = await loadAssignedPlans("assigned_plans.id = $1", [assignedPlanId]);
  return assignedPlan ?? null;
}
