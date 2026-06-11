import type { ConstructorDraft } from "@training-platform/shared";

function shiftDateInputValue(dateValue: string, days: number, fallbackDate: string) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return fallbackDate;
  }

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getConstructorDraftAssignmentStartDate(
  draft: ConstructorDraft | null | undefined,
  competitionStartDate: string,
  fallbackDate: string,
) {
  const cycleLengthDays = Math.max(1, Math.round(draft?.plan.cycleLengthDays ?? 1));

  return shiftDateInputValue(competitionStartDate || fallbackDate, -cycleLengthDays, fallbackDate);
}
