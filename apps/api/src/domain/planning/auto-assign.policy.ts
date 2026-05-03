import type {
  AutoAssignMicrocyclePayload,
  CompetitionContext,
  PreparationPhase,
} from "@training-platform/shared";
import { shiftDate } from "./load-balance.policy";

export interface PreparedAutoAssignItem {
  templateId: string;
  dayOffset: number;
  dayLabel: string;
  microcycleType: string;
  assignDate: string;
  assignedDayNotes: string;
}

export function resolvePlannedPhase(
  requestedPhase: PreparationPhase | null | undefined,
  competitionContext: CompetitionContext | null,
) {
  return requestedPhase ?? competitionContext?.phase ?? null;
}

export function prepareAutoAssignItems(
  payload: Pick<
    AutoAssignMicrocyclePayload,
    "startDate" | "daysCount" | "notes" | "items"
  >,
) {
  const selectedItems = payload.items.slice(
    0,
    Math.max(1, payload.daysCount || payload.items.length),
  );

  return selectedItems.map((item) => ({
    templateId: item.templateId,
    dayOffset: item.dayOffset,
    dayLabel: item.dayLabel,
    microcycleType: item.microcycleType,
    assignDate: shiftDate(payload.startDate, item.dayOffset),
    assignedDayNotes: payload.notes
      ? `${payload.notes} / ${item.microcycleType}`
      : item.microcycleType,
  })) satisfies PreparedAutoAssignItem[];
}
