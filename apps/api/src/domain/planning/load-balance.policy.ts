import type { AssignedPlanSummary } from "@training-platform/shared";
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
  blocks: Array<{
    targetDurationMinutes: number | null;
    targetRpe: number | null;
  }>,
) {
  return Number(
    blocks
      .reduce((sum, block) => {
        const duration = block.targetDurationMinutes ?? 20;
        const rpe = block.targetRpe ?? 5;
        return sum + duration * rpe;
      }, 0)
      .toFixed(1),
  );
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
