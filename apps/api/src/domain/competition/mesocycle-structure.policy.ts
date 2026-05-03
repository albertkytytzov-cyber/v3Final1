import type {
  MesocycleProgressionType,
  MesocycleWeekContext,
  MesocycleWeekPlan,
  PreparationPhase,
} from "@training-platform/shared";
import type {
  MesocycleWeekLookupInput,
  MesocycleWeeksInput,
  MesocycleWeeksValidationResult,
} from "./competition.types";
import { shiftDate } from "./competition-timeline.policy";

export function validateMesocycleWeeksCount(weeksCount: number): MesocycleWeeksValidationResult {
  if (weeksCount < 3 || weeksCount > 6) {
    return {
      ok: false,
      message: "weeksCount must stay between 3 and 6",
    };
  }

  return {
    ok: true,
  };
}

export function buildMesocycleWeeks(input: MesocycleWeeksInput): MesocycleWeekPlan[] {
  const phaseBaseLoad: Record<PreparationPhase, number> = {
    base: 850,
    strength: 980,
    specific: 920,
    taper: 620,
    competition: 500,
    recovery: 420,
  };
  const modifiersByProgression: Record<MesocycleProgressionType, number[]> = {
    linear: [0.9, 1, 1.08, 1.15, 1.05, 0.92],
    wave: [0.9, 1.08, 0.96, 1.14, 1.02, 0.9],
    taper: [1.02, 1.06, 0.94, 0.82, 0.7, 0.62],
    recovery: [0.76, 0.82, 0.78, 0.84, 0.8, 0.76],
  };
  const microcycleByProgression: Record<
    MesocycleProgressionType,
    MesocycleWeekPlan["microcycleType"][]
  > = {
    linear: ["build", "build", "impact", "shock", "impact", "recovery"],
    wave: ["build", "impact", "recovery", "shock", "impact", "recovery"],
    taper: ["build", "impact", "build", "taper", "taper", "competition"],
    recovery: ["recovery", "build", "recovery", "build", "recovery", "recovery"],
  };

  const baseLoad = phaseBaseLoad[input.phase];
  const modifiers = modifiersByProgression[input.progressionType];
  const microcycleTypes = microcycleByProgression[input.progressionType];

  return Array.from({ length: input.weeksCount }, (_, index) => {
    const weekStart = shiftDate(input.startDate, index * 7);
    const weekEnd = shiftDate(weekStart, 6);
    const loadModifier = modifiers[index] ?? modifiers[modifiers.length - 1] ?? 1;
    const microcycleType =
      microcycleTypes[index] ??
      microcycleTypes[microcycleTypes.length - 1] ??
      "build";
    const targetLoad = Number((baseLoad * loadModifier).toFixed(1));
    const focus =
      input.phase === "taper"
        ? "Protect freshness, preserve specificity, and reduce fatigue."
        : input.phase === "competition"
          ? `Competition execution${input.competitionTitle ? ` for ${input.competitionTitle}` : ""}.`
          : input.phase === "recovery"
            ? "Restore readiness and tissue quality before the next build."
            : input.phase === "specific"
              ? "Convert general capacity into competition-specific quality."
              : input.phase === "strength"
                ? "Build force output while keeping sport-specific rhythm."
                : "Establish aerobic, technical, and structural base.";

    return {
      weekIndex: index + 1,
      label: `Week ${index + 1}`,
      startDate: weekStart,
      endDate: weekEnd,
      focus,
      targetLoad,
      loadModifier: Number(loadModifier.toFixed(2)),
      microcycleType,
    } satisfies MesocycleWeekPlan;
  });
}

export function resolveMesocycleWeekContextForDate(
  input: MesocycleWeekLookupInput,
): MesocycleWeekContext | null {
  const matches = input.mesocycles
    .flatMap((mesocycle) =>
      mesocycle.weeks
        .filter((week) => week.startDate <= input.referenceDate && week.endDate >= input.referenceDate)
        .map((week) => ({
          mesocycle,
          week,
        })),
    )
    .sort(
      (left, right) =>
        right.week.startDate.localeCompare(left.week.startDate) ||
        right.mesocycle.createdAt.localeCompare(left.mesocycle.createdAt),
    );

  const active = matches[0];

  if (!active) {
    return null;
  }

  return {
    mesocycleId: active.mesocycle.id,
    mesocycleName: active.mesocycle.name,
    phase: active.mesocycle.phase,
    progressionType: active.mesocycle.progressionType,
    competitionPlanId: active.mesocycle.competitionPlanId,
    competitionTitle: active.mesocycle.competitionTitle,
    weekIndex: active.week.weekIndex,
    weekLabel: active.week.label,
    startDate: active.week.startDate,
    endDate: active.week.endDate,
    focus: active.week.focus,
    targetLoad: active.week.targetLoad,
    loadModifier: active.week.loadModifier,
    microcycleType: active.week.microcycleType,
  } satisfies MesocycleWeekContext;
}
