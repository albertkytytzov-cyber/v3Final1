import type {
  CompetitionLevel,
  CompetitionPlanType,
  CompetitionPriority,
  SeasonStrategyType,
} from "./index";

export type SeasonStrategyOlympicYearStage =
  | "base_foundation"
  | "deep_special_preparation"
  | "qualification_realization"
  | "olympic_peak"
  | "unknown";

export type SeasonStrategyCompetitionRole =
  | "main_peak"
  | "secondary_peak"
  | "qualifier"
  | "control_start";

export type SeasonStrategyPhase =
  | "base"
  | "development"
  | "special_preparation"
  | "taper"
  | "start_window"
  | "recovery";

export type SeasonStrategyGoalMode =
  | "development"
  | "maintenance"
  | "transfer"
  | "activation"
  | "recovery";

export type SeasonStrategyFocusCode =
  | "speed_first_action"
  | "legs_lme"
  | "arms_grip"
  | "aerobic_base"
  | "anaerobic_power"
  | "max_strength"
  | "speed_strength"
  | "fatigue_skill"
  | "wrestling_contact_density"
  | "weight_management"
  | "taper_quality"
  | "recovery";

export interface SeasonStrategyOlympicCycleInput {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  targetEvent: string;
  description?: string;
}

export interface SeasonStrategySeasonInput {
  id: string;
  athleteId: string;
  athleteName?: string;
  olympicCycleId: string | null;
  olympicCycleName?: string | null;
  year: number;
  name: string;
  goal: string;
  strategyType: SeasonStrategyType;
}

export interface SeasonStrategyCompetitionInput {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  level: CompetitionLevel;
  location?: string;
}

export interface SeasonStrategyCompetitionPlanInput {
  id: string;
  athleteId: string;
  seasonId: string | null;
  seasonName?: string | null;
  seasonYear?: number | null;
  competitionId: string;
  competitionTitle: string;
  competitionStartDate: string;
  competitionEndDate: string;
  priority: CompetitionPriority;
  planType: CompetitionPlanType;
  peakRequired: boolean;
  taperDays: number;
  weightCutRequired: boolean;
  targetWeight?: number | null;
  currentWeight?: number | null;
  expectedMatches?: number | null;
  competitionFormat?: string;
  prepStartDate?: string;
  prepEndDate?: string;
  notes?: string;
}

export interface SeasonStrategySnapshotInput {
  athleteId: string;
  currentDate: string;
  season?: SeasonStrategySeasonInput | null;
  olympicCycle?: SeasonStrategyOlympicCycleInput | null;
  targetCompetitionPlan?: SeasonStrategyCompetitionPlanInput | null;
  targetCompetition?: SeasonStrategyCompetitionInput | null;
  competitionPlans?: SeasonStrategyCompetitionPlanInput[];
  competitions?: SeasonStrategyCompetitionInput[];
}

export interface SeasonStrategySnapshot {
  source: "season_calendar" | "competition_calendar" | "manual";
  computedAt: string;
  athleteId: string;
  currentDate: string;
  season: {
    id: string | null;
    name: string | null;
    year: number | null;
    goal: string | null;
    strategyType: SeasonStrategyType | null;
    hasSeasonContext: boolean;
  };
  olympicCycle: {
    id: string | null;
    name: string | null;
    targetEvent: string | null;
    yearIndex: number | null;
    yearStage: SeasonStrategyOlympicYearStage;
    yearStageLabel: string;
  };
  targetCompetition: {
    id: string | null;
    planId: string | null;
    title: string | null;
    startDate: string | null;
    endDate: string | null;
    level: CompetitionLevel | null;
    priority: CompetitionPriority | null;
    planType: CompetitionPlanType | null;
    role: SeasonStrategyCompetitionRole | null;
    daysToStart: number | null;
    taperDays: number | null;
    weightCutRequired: boolean;
    targetWeight: number | null;
    expectedMatches: number | null;
  };
  seasonStarts: Array<{
    planId: string;
    competitionId: string;
    title: string;
    startDate: string;
    priority: CompetitionPriority;
    planType: CompetitionPlanType;
    role: SeasonStrategyCompetitionRole;
    daysToStart: number | null;
    distanceFromTargetDays: number | null;
  }>;
  currentWindow: {
    phase: SeasonStrategyPhase;
    phaseReason: string;
    cycleLengthDays: number;
    daysToStart: number | null;
  };
  constructorRules: {
    allowedModes: SeasonStrategyGoalMode[];
    forbiddenModes: SeasonStrategyGoalMode[];
    mandatoryFocus: SeasonStrategyFocusCode[];
    blockedFocus: SeasonStrategyFocusCode[];
    weeklyRhythm: string;
    requiredBlocks: string[];
    warnings: string[];
  };
}

const MAIN_START_FOCUS: SeasonStrategyFocusCode[] = [
  "fatigue_skill",
  "wrestling_contact_density",
  "legs_lme",
  "weight_management",
  "recovery",
  "taper_quality",
];

function parseDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(startDate?: string | null, endDate?: string | null) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  if (!start || !end) {
    return null;
  }

  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function olympicYearStage(yearIndex: number | null): SeasonStrategyOlympicYearStage {
  if (yearIndex === 1) {
    return "base_foundation";
  }

  if (yearIndex === 2) {
    return "deep_special_preparation";
  }

  if (yearIndex === 3) {
    return "qualification_realization";
  }

  if (yearIndex === 4) {
    return "olympic_peak";
  }

  return "unknown";
}

function olympicYearStageLabel(stage: SeasonStrategyOlympicYearStage) {
  const labels: Record<SeasonStrategyOlympicYearStage, string> = {
    base_foundation: "1-й год: базовая и общая подготовка",
    deep_special_preparation: "2-й год: углублённая специальная подготовка",
    qualification_realization: "3-й год: реализация и квалификация",
    olympic_peak: "4-й год: олимпийский пик и стабилизация",
    unknown: "год олимпийского цикла не определён",
  };

  return labels[stage];
}

function inferOlympicYearIndex(
  season: SeasonStrategySeasonInput | null | undefined,
  olympicCycle: SeasonStrategyOlympicCycleInput | null | undefined,
  currentDate: string,
) {
  const cycleStart = parseDate(olympicCycle?.startDate);

  if (!cycleStart) {
    return null;
  }

  const year = season?.year ?? parseDate(currentDate)?.getUTCFullYear();

  if (!year) {
    return null;
  }

  return clamp(year - cycleStart.getUTCFullYear() + 1, 1, 4);
}

function competitionRoleForPlan(
  plan: SeasonStrategyCompetitionPlanInput,
): SeasonStrategyCompetitionRole {
  if (plan.planType === "control" || plan.priority === "C") {
    return "control_start";
  }

  if (plan.planType === "qualifying") {
    return "qualifier";
  }

  if (plan.priority === "A" || plan.planType === "main" || plan.peakRequired) {
    return "main_peak";
  }

  return "secondary_peak";
}

function phaseForTarget(
  daysToStart: number | null,
  role: SeasonStrategyCompetitionRole | null,
  stage: SeasonStrategyOlympicYearStage,
): { phase: SeasonStrategyPhase; reason: string } {
  if (daysToStart === null) {
    return {
      phase: stage === "base_foundation" ? "base" : "special_preparation",
      reason: "нет выбранной даты старта, фаза берётся из сезона и олимпийского года",
    };
  }

  if (daysToStart < 0) {
    return {
      phase: "recovery",
      reason: "старт уже прошёл, приоритет восстановление и анализ",
    };
  }

  if (daysToStart <= 4) {
    return {
      phase: "start_window",
      reason: "осталось 0-4 дня: стартовое окно, вес, сон и короткая активация",
    };
  }

  if (daysToStart <= 14) {
    return {
      phase: "taper",
      reason: "осталось 4-14 дней: подводка и снижение объёма",
    };
  }

  if (daysToStart <= 30 && role === "main_peak") {
    return {
      phase: "special_preparation",
      reason: "главный старт ближе 30 дней: специальная предсоревновательная подготовка без развития",
    };
  }

  if (daysToStart <= 60) {
    return {
      phase: stage === "base_foundation" ? "development" : "special_preparation",
      reason:
        stage === "base_foundation"
          ? "до старта 31-60 дней: развитие допустимо внутри базового года"
          : "до старта 31-60 дней: специальная подготовка с переносом в борьбу",
    };
  }

  if (stage === "base_foundation") {
    return {
      phase: "base",
      reason: "старт далеко, год цикла допускает базовую подготовку",
    };
  }

  return {
    phase: "special_preparation",
    reason: "старт далеко, но год цикла требует специальной направленности",
  };
}

function cycleLengthForTarget(daysToStart: number | null) {
  if (daysToStart === null) {
    return 30;
  }

  if (daysToStart <= 0) {
    return 1;
  }

  if (daysToStart <= 30) {
    return daysToStart;
  }

  return 30;
}

function rulesForSnapshot(params: {
  phase: SeasonStrategyPhase;
  daysToStart: number | null;
  role: SeasonStrategyCompetitionRole | null;
  stage: SeasonStrategyOlympicYearStage;
  strategyType: SeasonStrategyType | null;
}) {
  const warnings: string[] = [];
  const requiredBlocks = ["разминка", "основная работа", "заминка", "контроль готовности"];
  let allowedModes: SeasonStrategyGoalMode[] = [
    "development",
    "maintenance",
    "transfer",
    "activation",
    "recovery",
  ];
  let forbiddenModes: SeasonStrategyGoalMode[] = [];
  let mandatoryFocus: SeasonStrategyFocusCode[] = [];
  let blockedFocus: SeasonStrategyFocusCode[] = [];
  let weeklyRhythm =
    "недельный ритм задаётся тренером: нагрузочные дни чередуются с восстановлением";

  if (params.phase === "start_window") {
    allowedModes = ["activation", "recovery", "transfer"];
    forbiddenModes = ["development", "maintenance"];
    mandatoryFocus = ["taper_quality", "weight_management", "recovery", "fatigue_skill"];
    blockedFocus = [
      "legs_lme",
      "arms_grip",
      "wrestling_contact_density",
      "aerobic_base",
      "anaerobic_power",
      "max_strength",
      "speed_strength",
    ];
    weeklyRhythm =
      "стартовое окно: не больше одной короткой сессии в день, часть дней без ковра, приоритет вес, сон и свежесть";
    requiredBlocks.push("короткая активация", "вес и восстановление", "техническая уверенность");
    warnings.push("0-4 дня до старта: ЛМВ, плотность борьбы, силовая и интервальная работа запрещены как автофокус");
  } else if (params.phase === "taper") {
    allowedModes = ["activation", "recovery", "transfer"];
    forbiddenModes = ["development"];
    mandatoryFocus = ["fatigue_skill", "taper_quality", "weight_management", "recovery"];
    blockedFocus = ["legs_lme", "arms_grip", "max_strength", "anaerobic_power"];
    weeklyRhythm = "объём снижается, активные дни короткие, восстановление и вес обязательны";
  } else if (params.role === "main_peak" && params.daysToStart !== null && params.daysToStart <= 30) {
    allowedModes = ["maintenance", "transfer", "activation", "recovery"];
    forbiddenModes = ["development"];
    mandatoryFocus = MAIN_START_FOCUS;
    blockedFocus = ["max_strength", "speed_strength"];
    weeklyRhythm =
      "ПН/ВТ полный день, СР половинчатая разгрузка, ЧТ/ПТ полный день, СБ половинчатая разгрузка, ВС отдых";
    requiredBlocks.push("борцовская техника", "соревновательная модель", "вес и восстановление");
    warnings.push("главный старт ближе 30 дней: развитие скорости, ЛМВ и силы запрещено");
  } else if (params.stage === "deep_special_preparation") {
    mandatoryFocus = ["fatigue_skill", "wrestling_contact_density", "legs_lme", "aerobic_base"];
    weeklyRhythm =
      "специальная работа через борьбу, СФП поддерживает перенос, восстановительные окна обязательны";
  } else if (params.stage === "base_foundation") {
    mandatoryFocus = ["aerobic_base", "legs_lme", "arms_grip", "max_strength"];
    weeklyRhythm = "база и развитие качеств, но без конфликтов локальной нагрузки";
  }

  if (params.strategyType === "multi_peak") {
    warnings.push("мультипиковый сезон: контрольные старты не должны ломать подготовку к главному пику");
  }

  if (params.strategyType === "double_peak") {
    warnings.push("двойной пик: между главными стартами нужен восстановительный мост, а не новый полный развивающий цикл");
  }

  return {
    allowedModes,
    forbiddenModes,
    mandatoryFocus,
    blockedFocus,
    weeklyRhythm,
    requiredBlocks,
    warnings,
  };
}

export function buildSeasonStrategySnapshot(
  input: SeasonStrategySnapshotInput,
): SeasonStrategySnapshot {
  const targetPlan = input.targetCompetitionPlan ?? null;
  const targetCompetition = input.targetCompetition ?? null;
  const role = targetPlan ? competitionRoleForPlan(targetPlan) : null;
  const daysToStart = targetPlan
    ? daysBetween(input.currentDate, targetPlan.competitionStartDate)
    : targetCompetition
      ? daysBetween(input.currentDate, targetCompetition.startDate)
      : null;
  const yearIndex = inferOlympicYearIndex(input.season, input.olympicCycle, input.currentDate);
  const yearStage = olympicYearStage(yearIndex);
  const window = phaseForTarget(daysToStart, role, yearStage);
  const targetStartDate = targetPlan?.competitionStartDate ?? targetCompetition?.startDate ?? null;
  const seasonPlans = (input.competitionPlans ?? [])
    .filter((plan) => !input.season?.id || plan.seasonId === input.season.id)
    .sort((left, right) => left.competitionStartDate.localeCompare(right.competitionStartDate));
  const seasonStarts = seasonPlans.map((plan) => ({
    planId: plan.id,
    competitionId: plan.competitionId,
    title: plan.competitionTitle,
    startDate: plan.competitionStartDate,
    priority: plan.priority,
    planType: plan.planType,
    role: competitionRoleForPlan(plan),
    daysToStart: daysBetween(input.currentDate, plan.competitionStartDate),
    distanceFromTargetDays: targetStartDate
      ? daysBetween(targetStartDate, plan.competitionStartDate)
      : null,
  }));
  const rules = rulesForSnapshot({
    phase: window.phase,
    daysToStart,
    role,
    stage: yearStage,
    strategyType: input.season?.strategyType ?? null,
  });

  return {
    source: input.season
      ? "season_calendar"
      : targetPlan || targetCompetition
        ? "competition_calendar"
        : "manual",
    computedAt: new Date().toISOString(),
    athleteId: input.athleteId,
    currentDate: input.currentDate,
    season: {
      id: input.season?.id ?? null,
      name: input.season?.name ?? null,
      year: input.season?.year ?? null,
      goal: input.season?.goal ?? null,
      strategyType: input.season?.strategyType ?? null,
      hasSeasonContext: Boolean(input.season),
    },
    olympicCycle: {
      id: input.olympicCycle?.id ?? null,
      name: input.olympicCycle?.name ?? input.season?.olympicCycleName ?? null,
      targetEvent: input.olympicCycle?.targetEvent ?? null,
      yearIndex,
      yearStage,
      yearStageLabel: olympicYearStageLabel(yearStage),
    },
    targetCompetition: {
      id: targetPlan?.competitionId ?? targetCompetition?.id ?? null,
      planId: targetPlan?.id ?? null,
      title: targetPlan?.competitionTitle ?? targetCompetition?.title ?? null,
      startDate: targetPlan?.competitionStartDate ?? targetCompetition?.startDate ?? null,
      endDate: targetPlan?.competitionEndDate ?? targetCompetition?.endDate ?? null,
      level: targetCompetition?.level ?? null,
      priority: targetPlan?.priority ?? null,
      planType: targetPlan?.planType ?? null,
      role,
      daysToStart,
      taperDays: targetPlan?.taperDays ?? null,
      weightCutRequired: Boolean(targetPlan?.weightCutRequired),
      targetWeight: targetPlan?.targetWeight ?? null,
      expectedMatches: targetPlan?.expectedMatches ?? null,
    },
    seasonStarts,
    currentWindow: {
      phase: window.phase,
      phaseReason: window.reason,
      cycleLengthDays: cycleLengthForTarget(daysToStart),
      daysToStart,
    },
    constructorRules: rules,
  };
}
