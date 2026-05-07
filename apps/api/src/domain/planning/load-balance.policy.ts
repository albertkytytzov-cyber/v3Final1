import {
  estimateTrainingBlocksLoad,
  type AssignedPlanSummary,
  type PlanDayInput,
  type PlanTemplateSummary,
} from "@training-platform/shared";
import type { PlannerSlot } from "./planning.types";

export function shiftDate(dateText: string, dayOffset: number) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}

export function diffDaysBetween(dateLeft: string, dateRight: string) {
  const left = new Date(`${dateLeft}T00:00:00Z`).getTime();
  const right = new Date(`${dateRight}T00:00:00Z`).getTime();
  return Math.round((right - left) / (24 * 60 * 60 * 1000));
}

export function estimateBlocksLoad(
  blocks: Parameters<typeof estimateTrainingBlocksLoad>[0],
) {
  return estimateTrainingBlocksLoad(blocks);
}

export function estimatePlanDayLoad(day: Pick<PlanDayInput, "sessions">) {
  return estimateBlocksLoad(day.sessions.flatMap((session) => session.blocks));
}

export function estimateTemplateDayLoad(
  template: Pick<PlanTemplateSummary, "estimatedLoad" | "days">,
  templateDayIndex: number | null | undefined,
) {
  const days = template.days ?? [];

  if (!days.length) {
    return template.estimatedLoad;
  }

  const normalizedIndex = Number.isFinite(templateDayIndex ?? NaN)
    ? Math.min(Math.max(Number(templateDayIndex), 0), days.length - 1)
    : 0;

  return estimatePlanDayLoad(days[normalizedIndex]);
}

export function getTemplateLoadCandidates(template: PlanTemplateSummary) {
  const days = template.days ?? [];

  if (!days.length) {
    return [
      {
        selectionKey: template.id,
        templateDayIndex: undefined,
        estimatedLoad: template.estimatedLoad,
      },
    ];
  }

  return days.map((day, index) => ({
    selectionKey: `${template.id}:${index}`,
    templateDayIndex: index,
    estimatedLoad: estimatePlanDayLoad(day),
  }));
}

export function estimateAssignedPlanLoad(plan: AssignedPlanSummary) {
  return estimateBlocksLoad(plan.day.sessions.flatMap((session) => session.blocks));
}

export function normalizeMicrocycleType(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function getTargetSlotLoad(
  slots: PlannerSlot[],
  slot: PlannerSlot,
  mesocycleWeek: { targetLoad: number | null } | null,
) {
  if (!mesocycleWeek?.targetLoad) {
    return null;
  }

  const totalWeight = slots.reduce((sum, item) => sum + item.slotWeight, 0);

  if (!totalWeight) {
    return null;
  }

  return Number(((mesocycleWeek.targetLoad * slot.slotWeight) / totalWeight).toFixed(1));
}
