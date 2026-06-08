import type { SeasonStrategySnapshot } from "./season-strategy";

export type ConstructorCompetitionLevel =
  | "local"
  | "national"
  | "continental"
  | "world"
  | "olympics";

export type ConstructorCompetitionPriority = "A" | "B" | "C";

export type ConstructorPhase =
  | "base"
  | "development"
  | "special_preparation"
  | "taper"
  | "start_window"
  | "recovery";

type ConstructorCalendarStage =
  | "base"
  | "development"
  | "entry_block"
  | "main_specific_microcycle"
  | "competition_integration"
  | "taper_peak"
  | "start_window"
  | "recovery";

export type ConstructorGoalType =
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

export type ConstructorGoalMode =
  | "development"
  | "maintenance"
  | "transfer"
  | "activation"
  | "recovery";

export type ConstructorConfidence = "high" | "medium" | "low";

export type ConstructorEvidenceLevel = "A" | "B" | "C" | "B/C" | "A/B" | "A/B/C";

export type ConstructorOperationalEvidenceType =
  | "direct_training_intervention"
  | "position_stand"
  | "sport_policy"
  | "transfer_grappling_evidence"
  | "coach_school"
  | "internal_validation";

export type ConstructorBlockType =
  | "technical"
  | "speed"
  | "strength"
  | "CNS_high"
  | "metabolic"
  | "conditioning"
  | "recovery"
  | "mobility"
  | "activation";

export type ConstructorLoadLevel = "low" | "medium" | "high" | "taper" | "recovery";

export type ConstructorMissingDataCode =
  | "speed_tests"
  | "jump_or_power_test"
  | "grip_tests"
  | "legs_lme_test"
  | "technique_quality_score"
  | "aerobic_recovery_test"
  | "readiness"
  | "sleep"
  | "resting_hr"
  | "weight_plan"
  | "coach_comment";

export type ConstructorRiskCode =
  | "competition_close"
  | "weight_gap"
  | "weight_cut_active"
  | "low_readiness"
  | "low_sleep"
  | "rhr_above_baseline"
  | "pain_or_injury"
  | "heavy_legs_sprint_conflict"
  | "glycolytic_recovery_conflict"
  | "missing_key_tests"
  | "device_data_low_confidence"
  | "travel_fatigue";

export interface ConstructorCompetitionInput {
  name: string;
  level: ConstructorCompetitionLevel;
  priority: ConstructorCompetitionPriority;
  startDate: string;
  weighInDate: string;
  weightClass: string;
  expectedBoutCount?: number | null;
  location?: string | null;
  timezone?: string | null;
  travelRequired?: boolean;
  climateContext?: string | null;
}

export interface ConstructorAthleteInput {
  athleteId: string;
  fullName: string;
  age?: number | null;
  sex: "female" | "male" | "other" | "unknown";
  trainingAgeYears?: number | null;
  weightCurrentKg: number;
  weightTargetKg: number;
  baselineRestingHr?: number | null;
  strengths?: string[];
  weaknesses?: string[];
  injuryHistory?: string[];
  painZones?: string[];
}

export interface ConstructorContextInput {
  currentPhase: ConstructorPhase;
  cycleLengthDays: number;
  sessionsPerWeek: number;
  sessionsPerDay?: number;
  availableTrainingDays?: Array<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun">;
}

export interface ConstructorGoalInput {
  goalType: ConstructorGoalType;
  priority: number;
  mode?: ConstructorGoalMode;
  reason?: string | null;
}

export interface ConstructorTestInput {
  sprint10mSec?: number | null;
  sprint20mSec?: number | null;
  verticalJumpCm?: number | null;
  medicineBallThrowM?: number | null;
  gripLeftKg?: number | null;
  gripRightKg?: number | null;
  legsLmeScore?: number | null;
  techniqueQualityScore?: number | null;
  aerobicRecoveryScore?: number | null;
}

export interface ConstructorStateInput {
  readinessScore: number | null;
  sleepHours: number | null;
  restingHr: number | null;
  bodyWeightKg: number;
  painLevel?: number | null;
  fatigueLevel?: number | null;
  deviceDataConfidence?: "high" | "medium" | "low" | "none";
  coachComment?: string | null;
}

export interface ConstructorConstraintsInput {
  noHeavyStrength?: boolean;
  noHighGlycolytic?: boolean;
  weightCutActive?: boolean;
  injuryCaution?: boolean;
  travelFatigue?: boolean;
}

export interface ConstructorInput {
  competition: ConstructorCompetitionInput;
  athlete: ConstructorAthleteInput;
  context: ConstructorContextInput;
  goals: ConstructorGoalInput[];
  tests?: ConstructorTestInput;
  state: ConstructorStateInput;
  constraints?: ConstructorConstraintsInput;
  seasonStrategy?: SeasonStrategySnapshot | null;
}

export interface ConstructorPlanBlock {
  name: string;
  type: ConstructorBlockType;
  targetQuality: ConstructorGoalType | "general";
  volume: string;
  localLoadZones: string[];
  energySystem: string;
  riskFlags: ConstructorRiskCode[];
  evidenceRefs: string[];
  coachEditable: boolean;
  exercises?: ConstructorPlanExercise[];
  volumeLocked?: boolean;
}

export interface ConstructorPlanExercise {
  name: string;
  targetSets: number | null;
  targetReps: number | null;
  targetWeightKg: number | null;
  targetDurationMinutes: number | null;
  targetRpe: number | null;
  notes: string;
  displayOrder?: number;
}

export interface ConstructorPlanSession {
  name: string;
  notes: string;
  orderIndex: number;
  blocks: ConstructorPlanBlock[];
}

export interface ConstructorPlanDay {
  dayLabel: string;
  dayIntent: string;
  loadLevel: ConstructorLoadLevel;
  readinessGate: string;
  blocks: ConstructorPlanBlock[];
  sessions?: ConstructorPlanSession[];
}

export interface ConstructorPlanWeek {
  weekNumber: number;
  title: string;
  phase: ConstructorPhase;
  mainIntent: string;
  days: ConstructorPlanDay[];
}

export interface ConstructorTemplateCard {
  id: string;
  title: string;
  durationDays: 7 | 10 | 14 | 21 | 30;
  primaryGoals: ConstructorGoalType[];
  allowedPhases: ConstructorPhase[];
  evidenceLevel: ConstructorEvidenceLevel;
  operationalEvidenceTypes: ConstructorOperationalEvidenceType[];
  requiredData: ConstructorMissingDataCode[];
  rationale: string;
  weeks: ConstructorPlanWeek[];
}

export interface ConstructorRiskFlag {
  code: ConstructorRiskCode;
  level: "info" | "warning" | "critical";
  message: string;
}

export interface ConstructorMissingData {
  code: ConstructorMissingDataCode;
  requiredFor: ConstructorGoalType | "plan";
  message: string;
}

export interface ConstructorDraft {
  confidence: ConstructorConfidence;
  understood: {
    mainTask: string;
    interpretation: string;
    limitation: string;
  };
  focusPlan: {
    title: string;
    developmentAllowed: boolean;
    items: Array<{
      goalType: ConstructorGoalType;
      mode: ConstructorGoalMode;
      label: string;
      reason: string;
    }>;
    phaseMap: Array<{
      range: string;
      phase: ConstructorPhase;
      title: string;
      intent: string;
    }>;
  };
  missingData: ConstructorMissingData[];
  riskFlags: ConstructorRiskFlag[];
  selectedCards: Array<{
    id: string;
    title: string;
    rationale: string;
  }>;
  plan: {
    cycleLengthDays: number;
    sessionsPerDay: number;
    weeks: ConstructorPlanWeek[];
  };
  explanation: {
    mainDecision: string;
    whyNow: string;
    testsImpact: string;
    riskImpact: string;
    evidenceSummary: string;
    coachCanEdit: string[];
  };
  seasonStrategy?: SeasonStrategySnapshot | null;
}

export const CONSTRUCTOR_GOAL_REQUIRED_DATA: Record<
  ConstructorGoalType,
  ConstructorMissingDataCode[]
> = {
  speed_first_action: ["speed_tests"],
  legs_lme: ["legs_lme_test"],
  arms_grip: ["grip_tests"],
  aerobic_base: ["aerobic_recovery_test"],
  anaerobic_power: ["speed_tests", "readiness"],
  max_strength: ["jump_or_power_test"],
  speed_strength: ["speed_tests", "jump_or_power_test"],
  fatigue_skill: ["technique_quality_score"],
  wrestling_contact_density: ["coach_comment"],
  weight_management: ["weight_plan"],
  taper_quality: ["readiness", "sleep", "resting_hr"],
  recovery: ["readiness", "sleep", "resting_hr"],
};

const CONSTRUCTOR_GOAL_TYPES: ConstructorGoalType[] = [
  "speed_first_action",
  "legs_lme",
  "arms_grip",
  "aerobic_base",
  "anaerobic_power",
  "max_strength",
  "speed_strength",
  "fatigue_skill",
  "wrestling_contact_density",
  "weight_management",
  "taper_quality",
  "recovery",
];

function isConstructorGoalType(value: string): value is ConstructorGoalType {
  return CONSTRUCTOR_GOAL_TYPES.includes(value as ConstructorGoalType);
}

function block(
  name: string,
  type: ConstructorBlockType,
  targetQuality: ConstructorPlanBlock["targetQuality"],
  volume: string,
  localLoadZones: string[],
  energySystem: string,
  evidenceRefs: string[],
  riskFlags: ConstructorRiskCode[] = [],
): ConstructorPlanBlock {
  return {
    name,
    type,
    targetQuality,
    volume,
    localLoadZones,
    energySystem,
    riskFlags,
    evidenceRefs,
    coachEditable: true,
  };
}

function lockedVolumeBlock(planBlock: ConstructorPlanBlock): ConstructorPlanBlock {
  return {
    ...planBlock,
    volumeLocked: true,
  };
}

function day(
  dayLabel: string,
  dayIntent: string,
  loadLevel: ConstructorLoadLevel,
  readinessGate: string,
  blocks: ConstructorPlanBlock[],
): ConstructorPlanDay {
  return {
    dayLabel,
    dayIntent,
    loadLevel,
    readinessGate,
    blocks,
  };
}

export const CONSTRUCTOR_TEMPLATE_CARDS: ConstructorTemplateCard[] = [
  {
    id: "pre_competition_21",
    title: "Подготовка к старту 21 день",
    durationDays: 21,
    primaryGoals: ["speed_first_action", "fatigue_skill", "taper_quality"],
    allowedPhases: ["special_preparation", "taper"],
    evidenceLevel: "A/B/C",
    operationalEvidenceTypes: ["position_stand", "coach_school", "internal_validation"],
    requiredData: ["speed_tests", "readiness", "sleep", "resting_hr", "weight_plan"],
    rationale:
      "21 день позволяет сохранить специальные качества, перенести их в борьбу и выполнить предсоревновательную подводку.",
    weeks: [
      {
        weekNumber: 1,
        title: "Неделя 1: вход в специальный блок",
        phase: "special_preparation",
        mainIntent: "Поддержать скорость и локальную устойчивость через борцовский перенос без накопления случайной усталости.",
        days: [
          day("ПН", "ЛМВ ног и контроль качества", "medium", "readiness >= 60, боль ног <= 2/5", [
            block(
              "ЛМВ ног",
              "metabolic",
              "legs_lme",
              "4-6 подходов / 20-30 сек / без отказа",
              ["ноги", "таз", "корпус"],
              "локальный метаболический стресс",
              ["BFR/KAATSU evidence", "PERFORM Evidence Matrix"],
              ["heavy_legs_sprint_conflict"],
            ),
          ]),
          day("СР", "Скорость первого действия", "medium", "сон >= 7 ч, RHR без роста", [
            block(
              "Скорость 10-20 м",
              "speed",
              "speed_first_action",
              "6-8 повторов / полный отдых",
              ["ноги"],
              "CNS / alactic",
              ["Chinese SSIT wrestler evidence", "speed profile"],
            ),
          ]),
          day("ПТ", "Борьба без скрытой гликолитики", "medium", "readiness >= 65", [
            block(
              "Техника и короткие раунды",
              "technical",
              "fatigue_skill",
              "3-4 раунда / качество выше объёма",
              ["общее", "контакт"],
              "специальная борьба",
              ["Europe plan analysis", "wrestling temporal structure"],
            ),
          ]),
          day("ВС", "Восстановление и вес", "recovery", "обязательная проверка веса/сна", [
            block(
              "Восстановительный контроль",
              "recovery",
              "recovery",
              "сон / вес / мобилити 15-20 мин",
              ["общее"],
              "recovery",
              ["ACSM hydration", "NCAA weight management"],
            ),
          ]),
        ],
      },
      {
        weekNumber: 2,
        title: "Неделя 2: перенос в специальную работу",
        phase: "special_preparation",
        mainIntent: "Перенести скорость и ноги в технические действия, не добирая лишний объём.",
        days: [
          day("ПН", "Входы в ноги под контролем качества", "medium", "нет боли колена/таза", [
            block(
              "Входы в ноги",
              "technical",
              "fatigue_skill",
              "20-30 мин / качество 1-5",
              ["ноги", "таз"],
              "technical",
              ["motor learning", "PERFORM coach quality score"],
            ),
          ]),
          day("СР", "Короткая скорость", "medium", "RHR без роста", [
            block(
              "Спринт + реакция",
              "speed",
              "speed_first_action",
              "5-7 повторов / полный отдых",
              ["ноги"],
              "CNS / alactic",
              ["speed profile"],
            ),
          ]),
          day("ПТ", "Раунды и анализ качества", "high", "readiness >= 70, сон нормальный", [
            block(
              "Раунды борьбы",
              "technical",
              "wrestling_contact_density",
              "4-5 раундов / контроль качества",
              ["контакт", "общее"],
              "mixed wrestling",
              ["UWW model", "wrestling temporal structure"],
              ["glycolytic_recovery_conflict"],
            ),
          ]),
          day("ВС", "Снижение остаточной усталости", "recovery", "обязательный контроль сна", [
            block(
              "Аэробное восстановление",
              "conditioning",
              "recovery",
              "20-30 мин / Z1-Z2",
              ["общее"],
              "aerobic recovery",
              ["sleep consensus", "load consensus"],
            ),
          ]),
        ],
      },
      {
        weekNumber: 3,
        title: "Неделя 3: подводка",
        phase: "taper",
        mainIntent: "Снизить общий объём, сохранить скорость, вес и свежесть.",
        days: [
          day("ПН", "Техника качества", "low", "без локальной боли", [
            block(
              "Техника без утомления",
              "technical",
              "taper_quality",
              "25-35 мин / качество",
              ["общее"],
              "technical",
              ["taper logic", "Europe plan analysis"],
            ),
          ]),
          day("СР", "Скорость коротко", "taper", "сон >= 7 ч", [
            block(
              "Короткие ускорения",
              "speed",
              "speed_first_action",
              "4-5 повторов / 90-95%",
              ["ноги"],
              "CNS / alactic",
              ["taper logic"],
            ),
          ]),
          day("ПТ", "Вес и свежесть", "recovery", "без добора объёма", [
            block(
              "Контроль веса и восстановление",
              "recovery",
              "weight_management",
              "сон / вес / мобилити",
              ["общее"],
              "recovery",
              ["NCAA weight management", "ACSM hydration"],
            ),
          ]),
        ],
      },
    ],
  },
  {
    id: "speed_first_action_14",
    title: "Скорость первого действия 14 дней",
    durationDays: 14,
    primaryGoals: ["speed_first_action"],
    allowedPhases: ["development", "special_preparation"],
    evidenceLevel: "A/B",
    operationalEvidenceTypes: ["direct_training_intervention", "position_stand"],
    requiredData: ["speed_tests", "jump_or_power_test", "readiness", "sleep"],
    rationale:
      "Короткий скоростной блок строится только при наличии исходных тестов 10/20 м и контроля восстановления.",
    weeks: [
      {
        weekNumber: 1,
        title: "Неделя 1: вход в скорость",
        phase: "development",
        mainIntent: "Качество ускорения без утомления.",
        days: [
          day("ПН", "Скорость 10 м", "medium", "полный отдых между повторами", [
            block("10 м старт", "speed", "speed_first_action", "6-8 повторов", ["ноги"], "CNS", [
              "Chinese SSIT wrestler evidence",
            ]),
          ]),
          day("СР", "Реакция и первый шаг", "medium", "техника не должна падать", [
            block("Реакция + первый шаг", "speed", "speed_first_action", "6-10 стартов", ["ноги"], "CNS", [
              "speed profile",
            ]),
          ]),
          day("ПТ", "Технический перенос", "low", "качество выше объёма", [
            block("Входы после сигнала", "technical", "fatigue_skill", "20 мин", ["ноги", "таз"], "technical", [
              "PERFORM coach quality score",
            ]),
          ]),
        ],
      },
      {
        weekNumber: 2,
        title: "Неделя 2: закрепление",
        phase: "special_preparation",
        mainIntent: "Меньше объёма, больше качества и переноса.",
        days: [
          day("ПН", "20 м коротко", "medium", "без тяжёлых ног накануне", [
            block("20 м ускорение", "speed", "speed_first_action", "5-6 повторов", ["ноги"], "CNS", [
              "speed profile",
            ]),
          ]),
          day("СР", "Скорость в борьбе", "medium", "контроль качества", [
            block("Входы в темпе", "technical", "fatigue_skill", "20-25 мин", ["ноги", "таз"], "technical", [
              "wrestling transfer",
            ]),
          ]),
          day("ПТ", "Тест 10/20 м", "low", "без добора", [
            block("Контроль скорости", "activation", "speed_first_action", "тест / 3-4 попытки", ["ноги"], "test", [
              "internal_validation",
            ]),
          ]),
        ],
      },
    ],
  },
  {
    id: "legs_lme_21",
    title: "ЛМВ ног 21 день",
    durationDays: 21,
    primaryGoals: ["legs_lme"],
    allowedPhases: ["base", "development", "special_preparation"],
    evidenceLevel: "B/C",
    operationalEvidenceTypes: ["position_stand", "coach_school", "internal_validation"],
    requiredData: ["legs_lme_test", "readiness", "sleep", "resting_hr"],
    rationale:
      "ЛМВ ног ставится как локальный стимул с обязательным контролем техники входов и боли в колене/тазу/спине.",
    weeks: [
      {
        weekNumber: 1,
        title: "Неделя 1: ввод",
        phase: "development",
        mainIntent: "Ввести локальную нагрузку без разрушения техники.",
        days: [
          day("ПН", "ЛМВ ног ввод", "medium", "боль <= 2/5", [
            block("Статодинамика ног", "metabolic", "legs_lme", "4x20 сек", ["ноги"], "local metabolic", [
              "BFR/KAATSU position stand",
              "Seluyanov coach school",
            ]),
          ]),
          day("СР", "Техника лёгкая", "low", "качество 4/5+", [
            block("Входы без утомления", "technical", "fatigue_skill", "20 мин", ["ноги", "таз"], "technical", [
              "motor learning",
            ]),
          ]),
          day("ПТ", "ЛМВ ног повтор", "medium", "RHR без роста", [
            block("Статодинамика ног", "metabolic", "legs_lme", "5x20 сек", ["ноги"], "local metabolic", [
              "BFR/KAATSU position stand",
            ]),
          ]),
        ],
      },
    ],
  },
  {
    id: "arms_grip_21",
    title: "Руки и хват 21 день",
    durationDays: 21,
    primaryGoals: ["arms_grip"],
    allowedPhases: ["base", "development", "special_preparation"],
    evidenceLevel: "B/C",
    operationalEvidenceTypes: ["transfer_grappling_evidence", "coach_school"],
    requiredData: ["grip_tests", "readiness", "sleep"],
    rationale:
      "Хват и руки развиваются отдельно от тяжёлого партера/клинча, чтобы не перегрузить локти и плечи.",
    weeks: [
      {
        weekNumber: 1,
        title: "Неделя 1: ввод хвата",
        phase: "development",
        mainIntent: "Развить локальную устойчивость рук без потери качества контакта.",
        days: [
          day("ПН", "Хват ввод", "medium", "локти/плечи без боли", [
            block("Вис / полотенца / удержание", "strength", "arms_grip", "4-5 подходов", ["предплечья", "плечи"], "local strength endurance", [
              "judo grip evidence",
            ]),
          ]),
          day("СР", "Техника захвата", "low", "без отказа", [
            block("Захват и позиция", "technical", "arms_grip", "20-25 мин", ["руки", "контакт"], "technical", [
              "grappling transfer evidence",
            ]),
          ]),
        ],
      },
    ],
  },
  {
    id: "taper_10",
    title: "Предсоревновательная подводка 10 дней",
    durationDays: 10,
    primaryGoals: ["taper_quality", "weight_management"],
    allowedPhases: ["taper", "start_window"],
    evidenceLevel: "A/B/C",
    operationalEvidenceTypes: ["position_stand", "sport_policy", "coach_school"],
    requiredData: ["readiness", "sleep", "resting_hr", "weight_plan"],
    rationale:
      "Подводка снижает объём, сохраняет скорость и качество, а вес контролируется без добора интенсивности.",
    weeks: [
      {
        weekNumber: 1,
        title: "10 дней до старта",
        phase: "taper",
        mainIntent: "Сохранить скорость и свежесть.",
        days: [
          day("Д-10", "Техника качества", "low", "без добора", [
            block("Техника", "technical", "taper_quality", "30 мин", ["общее"], "technical", [
              "taper logic",
            ]),
          ]),
          day("Д-7", "Скорость коротко", "taper", "сон нормальный", [
            block("Ускорения", "speed", "speed_first_action", "4-5 повторов", ["ноги"], "CNS", [
              "taper logic",
            ]),
          ]),
          day("Д-3", "Вес и свежесть", "recovery", "без интенсивности", [
            block("Контроль веса", "recovery", "weight_management", "сон / вес / мобилити", ["общее"], "recovery", [
              "NCAA weight management",
            ]),
          ]),
        ],
      },
    ],
  },
  {
    id: "recovery_7",
    title: "Восстановительный микроцикл 7 дней",
    durationDays: 7,
    primaryGoals: ["recovery"],
    allowedPhases: ["recovery", "base", "development", "special_preparation"],
    evidenceLevel: "A/B",
    operationalEvidenceTypes: ["position_stand", "internal_validation"],
    requiredData: ["readiness", "sleep", "resting_hr"],
    rationale:
      "Восстановительный микроцикл нужен после перегруза, старта, плохого сна или роста пульса покоя.",
    weeks: [
      {
        weekNumber: 1,
        title: "Неделя восстановления",
        phase: "recovery",
        mainIntent: "Снять накопленную усталость и вернуть готовность.",
        days: [
          day("ПН", "Мобилити и лёгкая техника", "recovery", "без боли", [
            block("Мобилити", "mobility", "recovery", "20 мин", ["общее"], "recovery", [
              "sleep/load consensus",
            ]),
          ]),
          day("СР", "Аэробное восстановление", "low", "Z1-Z2", [
            block("Лёгкая аэробная", "conditioning", "recovery", "20-30 мин", ["общее"], "aerobic recovery", [
              "load consensus",
            ]),
          ]),
          day("ПТ", "Контроль готовности", "recovery", "обновить readiness/RHR", [
            block("Контроль", "activation", "recovery", "тест самочувствия", ["общее"], "monitoring", [
              "internal_validation",
            ]),
          ]),
        ],
      },
    ],
  },
];

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(startDate: string, endDate: string) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  if (!start || !end) {
    return null;
  }

  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

function hasRequiredData(input: ConstructorInput, code: ConstructorMissingDataCode) {
  const tests = input.tests ?? {};

  switch (code) {
    case "speed_tests":
      return hasValue(tests.sprint10mSec) && hasValue(tests.sprint20mSec);
    case "jump_or_power_test":
      return hasValue(tests.verticalJumpCm) || hasValue(tests.medicineBallThrowM);
    case "grip_tests":
      return hasValue(tests.gripLeftKg) || hasValue(tests.gripRightKg);
    case "legs_lme_test":
      return hasValue(tests.legsLmeScore);
    case "technique_quality_score":
      return hasValue(tests.techniqueQualityScore);
    case "aerobic_recovery_test":
      return hasValue(tests.aerobicRecoveryScore);
    case "readiness":
      return hasValue(input.state.readinessScore);
    case "sleep":
      return hasValue(input.state.sleepHours);
    case "resting_hr":
      return hasValue(input.state.restingHr);
    case "weight_plan":
      return input.athlete.weightTargetKg > 0 && input.athlete.weightCurrentKg > 0;
    case "coach_comment":
      return Boolean(input.state.coachComment?.trim());
    default:
      return false;
  }
}

function missingDataMessage(code: ConstructorMissingDataCode) {
  const messages: Record<ConstructorMissingDataCode, string> = {
    speed_tests: "Для скоростного блока нужны 10 м и 20 м.",
    jump_or_power_test: "Для вывода по взрыву нужен прыжок или бросок медбола.",
    grip_tests: "Для блока рук/хвата нужен тест хвата.",
    legs_lme_test: "Для ЛМВ ног нужна исходная оценка локальной выносливости.",
    technique_quality_score: "Для техники под утомлением нужна оценка качества тренером.",
    aerobic_recovery_test: "Для аэробной базы нужен тест восстановления или аэробный показатель.",
    readiness: "Для безопасного плана нужна готовность.",
    sleep: "Для оценки восстановления нужны данные сна.",
    resting_hr: "Для оценки восстановления нужен пульс покоя.",
    weight_plan: "Для контроля веса нужен текущий и целевой вес.",
    coach_comment: "Для контактной/технической плотности нужен комментарий тренера.",
  };

  return messages[code];
}

function collectMissingData(input: ConstructorInput) {
  const missing = new Map<ConstructorMissingDataCode, ConstructorMissingData>();

  for (const goal of input.goals) {
    for (const code of CONSTRUCTOR_GOAL_REQUIRED_DATA[goal.goalType]) {
      if (!hasRequiredData(input, code)) {
        missing.set(code, {
          code,
          requiredFor: goal.goalType,
          message: missingDataMessage(code),
        });
      }
    }
  }

  for (const code of ["readiness", "sleep", "resting_hr"] as const) {
    if (!hasRequiredData(input, code)) {
      missing.set(code, {
        code,
        requiredFor: "plan",
        message: missingDataMessage(code),
      });
    }
  }

  return Array.from(missing.values());
}

function collectRiskFlags(input: ConstructorInput, missingData: ConstructorMissingData[]) {
  const risks: ConstructorRiskFlag[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const daysToStart = daysBetween(today, input.competition.startDate);
  const weightGap = Number((input.athlete.weightCurrentKg - input.athlete.weightTargetKg).toFixed(1));
  const baselineRhr = input.athlete.baselineRestingHr;
  const rhr = input.state.restingHr;

  if (daysToStart !== null && daysToStart <= 14) {
    risks.push({
      code: "competition_close",
      level: daysToStart <= 7 ? "critical" : "warning",
      message: "Старт близко: развитие качества ограничено, приоритет свежесть, вес и техника.",
    });
  }

  if (weightGap > 0.8) {
    risks.push({
      code: "weight_gap",
      level: weightGap > 1.5 ? "critical" : "warning",
      message: `Вес выше цели на ${weightGap} кг: нельзя добирать интенсивность без плана снижения веса.`,
    });
  }

  if (input.constraints?.weightCutActive) {
    risks.push({
      code: "weight_cut_active",
      level: "warning",
      message: "Активная сгонка веса: гликолитика и плотный контакт требуют подтверждения тренера.",
    });
  }

  if (input.state.readinessScore !== null && input.state.readinessScore < 60) {
    risks.push({
      code: "low_readiness",
      level: "warning",
      message: "Готовность ниже 60: новый развивающий стимул ограничен.",
    });
  }

  if (input.state.sleepHours !== null && input.state.sleepHours < 6.5) {
    risks.push({
      code: "low_sleep",
      level: "warning",
      message: "Сон ниже 6.5 ч: высокоинтенсивные блоки требуют снижения.",
    });
  }

  if (baselineRhr && rhr && rhr - baselineRhr >= 6) {
    risks.push({
      code: "rhr_above_baseline",
      level: "warning",
      message: "Пульс покоя выше baseline: нужен контроль восстановления.",
    });
  }

  if (
    input.constraints?.injuryCaution ||
    (input.state.painLevel !== null && input.state.painLevel !== undefined && input.state.painLevel >= 3) ||
    (input.athlete.painZones?.length ?? 0) > 0
  ) {
    risks.push({
      code: "pain_or_injury",
      level: "warning",
      message: "Есть боль или ограничение: нагрузка на эту зону требует замены или подтверждения.",
    });
  }

  if (missingData.length > 0) {
    risks.push({
      code: "missing_key_tests",
      level: missingData.length >= 3 ? "warning" : "info",
      message: "Не хватает ключевых данных: план строится с пониженной уверенностью.",
    });
  }

  if (
    input.state.deviceDataConfidence === "low" ||
    input.state.deviceDataConfidence === "none"
  ) {
    risks.push({
      code: "device_data_low_confidence",
      level: "info",
      message: "Данные устройства неполные: вывод по восстановлению ограничен.",
    });
  }

  if (input.constraints?.travelFatigue || input.competition.travelRequired) {
    risks.push({
      code: "travel_fatigue",
      level: "info",
      message: "Есть фактор дороги/смены режима: нужна поправка на восстановление.",
    });
  }

  return risks;
}

function deriveConfidence(
  missingData: ConstructorMissingData[],
  riskFlags: ConstructorRiskFlag[],
): ConstructorConfidence {
  const criticalRisk = riskFlags.some((risk) => risk.level === "critical");

  if (criticalRisk || missingData.length >= 4) {
    return "low";
  }

  if (missingData.length > 0 || riskFlags.some((risk) => risk.level === "warning")) {
    return "medium";
  }

  return "high";
}

function primaryGoal(input: ConstructorInput) {
  return [...input.goals].sort((a, b) => a.priority - b.priority)[0]?.goalType ?? "recovery";
}

function goalLabel(goal: ConstructorGoalType) {
  const labels: Record<ConstructorGoalType, string> = {
    speed_first_action: "скорость первого действия",
    legs_lme: "локальная выносливость ног",
    arms_grip: "руки и хват",
    aerobic_base: "аэробная база",
    anaerobic_power: "анаэробная мощность",
    max_strength: "максимальная сила",
    speed_strength: "скоростно-силовая работа",
    fatigue_skill: "техника под утомлением",
    wrestling_contact_density: "плотность борьбы",
    weight_management: "контроль веса",
    taper_quality: "подводка",
    recovery: "восстановление",
  };

  return labels[goal];
}

function competitionSafeGoalLabel(goal: ConstructorGoalType) {
  const labels: Record<ConstructorGoalType, string> = {
    speed_first_action: "поддержание резкости первого действия",
    legs_lme: "поддержание СФП ног",
    arms_grip: "поддержание рук и хвата",
    aerobic_base: "аэробная разгрузка и восстановление",
    anaerobic_power: "борцовская финишная мощность без добора",
    max_strength: "поддержание силового тонуса",
    speed_strength: "поддержание скоростно-силового тонуса",
    fatigue_skill: "специальная борцовская работа",
    wrestling_contact_density: "соревновательная модель борьбы",
    weight_management: "контроль веса",
    taper_quality: "качество подводки",
    recovery: "восстановление и суперкомпенсация",
  };

  return labels[goal];
}

function goalLabelForInput(goal: ConstructorGoalType, input: ConstructorInput) {
  return isMajorCompetitionConstructorCase(input) ? competitionSafeGoalLabel(goal) : goalLabel(goal);
}

function normalizePhaseForCycle(input: ConstructorInput): ConstructorPhase {
  if (input.context.currentPhase === "development" && input.context.cycleLengthDays <= 30) {
    return "special_preparation";
  }

  return input.context.currentPhase;
}

function isMajorCompetition(input: ConstructorInput) {
  return (
    input.competition.priority === "A" ||
    ["continental", "world", "olympics"].includes(input.competition.level)
  );
}

function selectTemplateCards(input: ConstructorInput, riskFlags: ConstructorRiskFlag[]) {
  const goalSet = new Set(input.goals.map((goal) => goal.goalType));
  const closeCompetition = riskFlags.some((risk) => risk.code === "competition_close");
  const effectivePhase = normalizePhaseForCycle(input);

  if (effectivePhase === "start_window" || closeCompetition) {
    return CONSTRUCTOR_TEMPLATE_CARDS.filter((card) => card.id === "taper_10");
  }

  if (effectivePhase === "recovery") {
    return CONSTRUCTOR_TEMPLATE_CARDS.filter((card) => card.id === "recovery_7");
  }

  const candidates = CONSTRUCTOR_TEMPLATE_CARDS.filter(
    (card) =>
      card.allowedPhases.includes(effectivePhase) &&
      card.durationDays <= input.context.cycleLengthDays &&
      card.primaryGoals.some((goal) => goalSet.has(goal)),
  );

  if (candidates.length > 0) {
    return candidates.slice(0, 2);
  }

  return CONSTRUCTOR_TEMPLATE_CARDS.filter((card) => card.id === "recovery_7");
}

const STANDARD_WEEKDAY_LABELS = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];
const UTC_DAY_TO_TRAINING_DAY: Record<number, NonNullable<ConstructorContextInput["availableTrainingDays"]>[number]> = {
  0: "sun",
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
};
const TRAINING_DAY_LABELS: Record<
  NonNullable<ConstructorContextInput["availableTrainingDays"]>[number],
  string
> = {
  mon: "ПН",
  tue: "ВТ",
  wed: "СР",
  thu: "ЧТ",
  fri: "ПТ",
  sat: "СБ",
  sun: "ВС",
};

function standardWeekLabelPool(input: ConstructorInput) {
  if (input.context.availableTrainingDays && input.context.availableTrainingDays.length > 0) {
    return input.context.availableTrainingDays.map((dayCode) => TRAINING_DAY_LABELS[dayCode]);
  }

  return STANDARD_WEEKDAY_LABELS.slice(0, 6);
}

function taperWeekLabelPool(
  input: ConstructorInput,
  weekIndex: number,
  calendarDaysInWeek: number,
) {
  const firstDayFromStart = daysToStartAtWeekStart(input, weekIndex);

  return Array.from({ length: calendarDaysInWeek }, (_, index) => `Д-${firstDayFromStart - index}`).filter(
    (label) => !label.endsWith("-0"),
  );
}

function addUtcDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function formatPlanDate(date: Date) {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");

  return `${day}.${month}`;
}

function calendarLabelForDate(date: Date) {
  return `${STANDARD_WEEKDAY_LABELS[date.getUTCDay() === 0 ? 6 : date.getUTCDay() - 1]} ${formatPlanDate(date)}`;
}

function allowedTrainingDaySet(input: ConstructorInput) {
  return new Set(input.context.availableTrainingDays?.length ? input.context.availableTrainingDays : [
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
    "sat",
  ]);
}

function competitionPlanDate(input: ConstructorInput, dayIndex: number) {
  const startDate = parseDate(input.competition.startDate);

  if (!startDate) {
    return null;
  }

  return addUtcDays(startDate, -input.context.cycleLengthDays + dayIndex);
}

function competitionCalendarLabelPool(
  input: ConstructorInput,
  weekIndex: number,
  calendarDaysInWeek: number,
) {
  const allowedDays = allowedTrainingDaySet(input);

  return Array.from({ length: calendarDaysInWeek }, (_, index) => {
    const absoluteDayIndex = weekIndex * 7 + index;
    const date = competitionPlanDate(input, absoluteDayIndex);
    const daysToStart = Math.max(1, input.context.cycleLengthDays - absoluteDayIndex);

    if (!date) {
      return `Д-${daysToStart}`;
    }

    if (!allowedDays.has(UTC_DAY_TO_TRAINING_DAY[date.getUTCDay()])) {
      return null;
    }

    return `Д-${daysToStart} / ${calendarLabelForDate(date)}`;
  }).filter((label): label is string => Boolean(label));
}

function daysToStartAtWeekStart(input: ConstructorInput, weekIndex: number) {
  return Math.max(1, input.context.cycleLengthDays - weekIndex * 7);
}

function calendarStageFromWeek(input: ConstructorInput, weekIndex: number): ConstructorCalendarStage {
  const effectivePhase = normalizePhaseForCycle(input);
  const daysToStartAtWeekStartValue = daysToStartAtWeekStart(input, weekIndex);

  if (effectivePhase === "recovery") {
    return "recovery";
  }

  if (effectivePhase === "start_window" || daysToStartAtWeekStartValue <= 4) {
    return "start_window";
  }

  if (effectivePhase === "taper") {
    return "taper_peak";
  }

  if (isMajorCompetition(input) && input.context.cycleLengthDays <= 30) {
    if (daysToStartAtWeekStartValue <= 11) {
      return "competition_integration";
    }

    if (daysToStartAtWeekStartValue <= 18) {
      return "main_specific_microcycle";
    }

    return "entry_block";
  }

  if (effectivePhase === "base" && daysToStartAtWeekStartValue > 45) {
    return "base";
  }

  if (input.context.currentPhase === "development" && daysToStartAtWeekStartValue > 30) {
    return "development";
  }

  if (daysToStartAtWeekStartValue <= 10) {
    return "taper_peak";
  }

  return "entry_block";
}

function phaseForCalendarStage(stage: ConstructorCalendarStage): ConstructorPhase {
  switch (stage) {
    case "base":
      return "base";
    case "development":
      return "development";
    case "competition_integration":
    case "taper_peak":
      return "taper";
    case "start_window":
      return "start_window";
    case "recovery":
      return "recovery";
    case "entry_block":
    case "main_specific_microcycle":
    default:
      return "special_preparation";
  }
}

function weekPhaseFromCalendar(
  input: ConstructorInput,
  _sourcePhase: ConstructorPhase,
  weekIndex: number,
): ConstructorPhase {
  return phaseForCalendarStage(calendarStageFromWeek(input, weekIndex));
}

function targetSessionsForWeek(
  input: ConstructorInput,
  phase: ConstructorPhase,
  calendarDaysInWeek: number,
) {
  const availableDays =
    input.context.availableTrainingDays && input.context.availableTrainingDays.length > 0
      ? input.context.availableTrainingDays.length
      : 6;
  const requestedSessions = Math.max(1, Math.min(14, Math.round(input.context.sessionsPerWeek || 1)));
  const requestedTrainingDays = Math.min(requestedSessions, availableDays, calendarDaysInWeek);

  if (phase === "start_window") {
    return requestedTrainingDays;
  }

  if (phase === "recovery") {
    return Math.min(requestedTrainingDays, 4);
  }

  if (phase === "taper") {
    return Math.min(requestedTrainingDays, Math.min(5, calendarDaysInWeek));
  }

  return Math.min(requestedTrainingDays, calendarDaysInWeek);
}

function supportDayLabel(labelPool: string[], usedLabels: Set<string>, index: number) {
  return labelPool.find((label) => !usedLabels.has(label)) ?? `День ${index + 1}`;
}

function labelPoolForWeek(
  input: ConstructorInput,
  phase: ConstructorPhase,
  weekIndex: number,
  calendarDaysInWeek: number,
) {
  if (isMajorCompetitionConstructorCase(input)) {
    return competitionCalendarLabelPool(input, weekIndex, calendarDaysInWeek);
  }

  if (phase === "taper" || phase === "start_window") {
    return taperWeekLabelPool(input, weekIndex, calendarDaysInWeek);
  }

  return standardWeekLabelPool(input).slice(0, calendarDaysInWeek);
}

function sortPlanDaysByLabel(days: ConstructorPlanDay[], labelPool: string[]) {
  return [...days].sort((a, b) => {
    const indexA = labelPool.indexOf(a.dayLabel);
    const indexB = labelPool.indexOf(b.dayLabel);

    if (indexA === -1 && indexB === -1) {
      return 0;
    }

    if (indexA === -1) {
      return 1;
    }

    if (indexB === -1) {
      return -1;
    }

    return indexA - indexB;
  });
}

function hasBlockTarget(dayPlan: ConstructorPlanDay, target: ConstructorPlanBlock["targetQuality"]) {
  return dayPlan.blocks.some((planBlock) => planBlock.targetQuality === target);
}

function hasBlockType(dayPlan: ConstructorPlanDay, type: ConstructorBlockType) {
  return dayPlan.blocks.some((planBlock) => planBlock.type === type);
}

function clonePlanBlock(planBlock: ConstructorPlanBlock): ConstructorPlanBlock {
  return {
    ...planBlock,
    localLoadZones: [...planBlock.localLoadZones],
    riskFlags: [...planBlock.riskFlags],
    evidenceRefs: [...planBlock.evidenceRefs],
    exercises: planBlock.exercises?.map((exercise) => ({ ...exercise })),
  };
}

function clonePlanDay(planDay: ConstructorPlanDay): ConstructorPlanDay {
  return {
    ...planDay,
    blocks: planDay.blocks.map(clonePlanBlock),
    sessions: planDay.sessions?.map((session) => ({
      ...session,
      blocks: session.blocks.map(clonePlanBlock),
    })),
  };
}

function isDevelopmentPhase(phase: ConstructorPhase) {
  return phase === "base" || phase === "development" || phase === "special_preparation";
}

function isSpecialSupportPhase(phase: ConstructorPhase) {
  return phase === "special_preparation";
}

function hasAnyTarget(dayPlan: ConstructorPlanDay, targets: ConstructorPlanBlock["targetQuality"][]) {
  return targets.some((target) => hasBlockTarget(dayPlan, target));
}

function hasRecoverySupport(dayPlan: ConstructorPlanDay) {
  return (
    hasAnyTarget(dayPlan, ["recovery", "aerobic_base", "weight_management"]) ||
    hasBlockType(dayPlan, "conditioning") ||
    hasBlockType(dayPlan, "recovery") ||
    hasBlockType(dayPlan, "mobility")
  );
}

function hasWrestlingSpecificWork(dayPlan: ConstructorPlanDay) {
  return (
    hasAnyTarget(dayPlan, ["fatigue_skill", "wrestling_contact_density", "taper_quality"]) ||
    hasBlockType(dayPlan, "technical")
  );
}

function isSessionWarmupBlock(planBlock: ConstructorPlanBlock) {
  return /разминк/i.test(planBlock.name);
}

function isSessionCooldownBlock(planBlock: ConstructorPlanBlock) {
  return /заминк/i.test(planBlock.name);
}

function isActiveTrainingBlock(planBlock: ConstructorPlanBlock) {
  if (isSessionWarmupBlock(planBlock) || isSessionCooldownBlock(planBlock)) {
    return false;
  }

  if (planBlock.targetQuality === "weight_management") {
    return false;
  }

  return planBlock.type !== "recovery" || planBlock.targetQuality !== "recovery";
}

function needsTrainingSessionFrame(dayPlan: ConstructorPlanDay) {
  return dayPlan.blocks.some(isActiveTrainingBlock);
}

function warmupBlockForDay(dayPlan: ConstructorPlanDay, phase: ConstructorPhase) {
  const isTaperLike = phase === "taper" || phase === "start_window" || dayPlan.loadLevel === "taper";
  const isHighLoad = dayPlan.loadLevel === "high" || dayPlan.loadLevel === "medium";

  return block(
    "Разминка",
    "activation",
    "general",
    isTaperLike
      ? "8-10 мин / мягкая мобилизация, стойка, 2-3 коротких включения без утомления"
      : isHighLoad
        ? "10-15 мин / суставная мобилизация, Z1, специальные движения, вход в стойку"
        : "8-12 мин / мобилизация, лёгкое движение, подготовка к технике",
    ["общее"],
    isTaperLike ? "activation / readiness" : "warm-up / neuromuscular preparation",
    ["Europe plan analysis", "warm-up standard", "motor learning"],
  );
}

function cooldownBlockForDay(dayPlan: ConstructorPlanDay, phase: ConstructorPhase) {
  const isTaperLike = phase === "taper" || phase === "start_window" || dayPlan.loadLevel === "taper";
  const isHighLoad = dayPlan.loadLevel === "high" || dayPlan.loadLevel === "medium";

  return block(
    "Заминка",
    "recovery",
    "recovery",
    isTaperLike
      ? "8-10 мин / дыхание, мобилити, вес, сон и самочувствие"
      : isHighLoad
        ? "10-15 мин / Z1, дыхание, мобилити, локальный сброс"
        : "8-12 мин / лёгкая мобилити, дыхание, контроль самочувствия",
    ["общее"],
    "cool-down / recovery",
    ["Europe plan analysis", "recovery consensus", "sleep/load consensus"],
  );
}

function constructorExercise(
  name: string,
  notes: string,
  values: Partial<ConstructorPlanExercise> = {},
): ConstructorPlanExercise {
  return {
    name,
    targetSets: values.targetSets ?? null,
    targetReps: values.targetReps ?? null,
    targetWeightKg: values.targetWeightKg ?? null,
    targetDurationMinutes: values.targetDurationMinutes ?? null,
    targetRpe: values.targetRpe ?? null,
    notes,
    displayOrder: values.displayOrder,
  };
}

function concreteVolumeForBlock(planBlock: ConstructorPlanBlock) {
  if (planBlock.volumeLocked) {
    return planBlock.volume;
  }

  if (isSessionWarmupBlock(planBlock)) {
    return "10-15 мин: мобилизация 5 мин + стойка/перемещения 5-7 мин + 2-3 коротких включения";
  }

  if (isSessionCooldownBlock(planBlock)) {
    return "8-15 мин: Z1/дыхание 5-8 мин + мобилити 5 мин + контроль веса/самочувствия";
  }

  switch (planBlock.targetQuality) {
    case "speed_first_action":
      return "6-8 стартов 10-20 м + 4-6 входов по сигналу / отдых 90-120 сек / без добора";
    case "legs_lme":
      return "3 упражнения: 2-3 подхода по 20-25 сек / отдых 60-90 сек / без отказа";
    case "arms_grip":
      return "3 упражнения: 3 подхода / 20-40 сек удержания или 15-25 м переноски / без боли";
    case "aerobic_base":
      return "25-35 мин Z1-Z2 + 6-8 мин мобилити / разговорный темп";
    case "anaerobic_power":
      return "4-6 отрезков 20/40 или 30/30 / RPE 7-8 / стоп при падении качества";
    case "max_strength":
      return "2-3 упражнения: 3 подхода по 3-5 повторов / RPE 6-7 / без отказа";
    case "speed_strength":
      return "3 упражнения: 4-5 серий по 3-5 взрывных повторов / полный отдых";
    case "fatigue_skill":
      return "3 серии по 6-8 мин: стойка, входы, защита/спрол, партер / качество техники >= 4/5";
    case "wrestling_contact_density":
      return "2-3 цикла 3 мин + 30 сек + 3 мин / пауза 4-6 мин / контакт под контролем";
    case "weight_management":
      return "5-10 мин: вес, сон, пульс покоя, самочувствие, комментарий тренера";
    case "taper_quality":
      return "20-30 мин: техника без утомления + 2-4 коротких включения / RPE <= 4";
    case "recovery":
      return "15-30 мин восстановления: Z1, дыхание, мобилити, локальный сброс";
    case "general":
    default:
      return planBlock.volume;
  }
}

function concreteExercisesForBlock(planBlock: ConstructorPlanBlock): ConstructorPlanExercise[] {
  if (planBlock.exercises?.length) {
    return planBlock.exercises.map((exercise, index) => ({
      ...exercise,
      displayOrder: exercise.displayOrder ?? index,
    }));
  }

  if (isSessionWarmupBlock(planBlock)) {
    return [
      constructorExercise("Суставная мобилизация", "шея, плечи, таз, колени, голеностоп", {
        targetDurationMinutes: 5,
        targetRpe: 2,
        displayOrder: 0,
      }),
      constructorExercise("Стойка и перемещения", "борцовская стойка, смена уровня, шаги, развороты", {
        targetDurationMinutes: 5,
        targetRpe: 3,
        displayOrder: 1,
      }),
      constructorExercise("Короткие включения", "2-3 ускорения/входа без утомления", {
        targetSets: 3,
        targetReps: 1,
        targetRpe: 4,
        displayOrder: 2,
      }),
    ];
  }

  if (isSessionCooldownBlock(planBlock)) {
    return [
      constructorExercise("Z1 или ходьба", "снизить пульс, дыхание ровное", {
        targetDurationMinutes: 6,
        targetRpe: 2,
        displayOrder: 0,
      }),
      constructorExercise("Мобилити и дыхание", "таз, спина, плечи, предплечья", {
        targetDurationMinutes: 6,
        targetRpe: 1,
        displayOrder: 1,
      }),
      constructorExercise("Контроль состояния", "вес, сон, пульс покоя, боль/жёсткость", {
        targetDurationMinutes: 3,
        targetRpe: 1,
        displayOrder: 2,
      }),
    ];
  }

  switch (planBlock.targetQuality) {
    case "speed_first_action":
      return [
        constructorExercise("Старт из стойки 10 м", "6 повторов, отдых 90-120 сек, качество выше скорости", {
          targetSets: 6,
          targetReps: 1,
          targetRpe: 6,
          displayOrder: 0,
        }),
        constructorExercise("Вход в ногу по сигналу", "4-6 входов, полный возврат, без добора", {
          targetSets: 3,
          targetReps: 2,
          targetRpe: 5,
          displayOrder: 1,
        }),
      ];
    case "legs_lme":
      return [
        constructorExercise("Статодинамический присед", "2-3 подхода по 20-25 сек, без отказа", {
          targetSets: 3,
          targetDurationMinutes: 1,
          targetRpe: 6,
          displayOrder: 0,
        }),
        constructorExercise("Сплит-присед / выпад", "2 подхода на сторону по 20 сек", {
          targetSets: 2,
          targetDurationMinutes: 1,
          targetRpe: 6,
          displayOrder: 1,
        }),
        constructorExercise("Проходы в ноги после локальной работы", "3 серии по 4 входа, техника не ниже 4/5", {
          targetSets: 3,
          targetReps: 4,
          targetRpe: 5,
          displayOrder: 2,
        }),
      ];
    case "arms_grip":
      return [
        constructorExercise("Канат без ног / тяга каната", "3 подхода по 15-25 сек", {
          targetSets: 3,
          targetDurationMinutes: 1,
          targetRpe: 6,
          displayOrder: 0,
        }),
        constructorExercise("Вис на полотенцах", "3 удержания по 20-30 сек", {
          targetSets: 3,
          targetDurationMinutes: 1,
          targetRpe: 6,
          displayOrder: 1,
        }),
        constructorExercise("Фермерская ходьба", "3 прохода по 20-25 м, корпус стабилен", {
          targetSets: 3,
          targetReps: 1,
          targetRpe: 5,
          displayOrder: 2,
        }),
      ];
    case "aerobic_base":
      return [
        constructorExercise("Кросс / велосипед / ходьба Z1-Z2", "25-35 мин, разговорный темп", {
          targetDurationMinutes: 30,
          targetRpe: 3,
          displayOrder: 0,
        }),
        constructorExercise("Мобилити после аэробной", "таз, голеностоп, спина", {
          targetDurationMinutes: 8,
          targetRpe: 2,
          displayOrder: 1,
        }),
      ];
    case "anaerobic_power":
      return [
        constructorExercise("Интервалы 20/40", "4-6 отрезков, стоп при падении качества", {
          targetSets: 6,
          targetReps: 1,
          targetRpe: 8,
          displayOrder: 0,
        }),
        constructorExercise("Резина -> проход -> клинч", "4 серии, 20 сек работа / 40 сек отдых", {
          targetSets: 4,
          targetReps: 1,
          targetRpe: 7,
          displayOrder: 1,
        }),
      ];
    case "max_strength":
      return [
        constructorExercise("Присед / тяга вариант", "3x3-5, RPE 6-7, без отказа", {
          targetSets: 3,
          targetReps: 5,
          targetRpe: 7,
          displayOrder: 0,
        }),
        constructorExercise("Тяга корпуса / подтягивание", "3x4-6, чистая техника", {
          targetSets: 3,
          targetReps: 6,
          targetRpe: 6,
          displayOrder: 1,
        }),
      ];
    case "speed_strength":
      return [
        constructorExercise("Прыжки / медбол", "4 серии по 3-5 взрывных повторов", {
          targetSets: 4,
          targetReps: 5,
          targetRpe: 6,
          displayOrder: 0,
        }),
        constructorExercise("Взрывной вход с резиной", "4 серии по 3 входа, полный отдых", {
          targetSets: 4,
          targetReps: 3,
          targetRpe: 6,
          displayOrder: 1,
        }),
      ];
    case "fatigue_skill":
      return [
        constructorExercise("Входы в ноги под контролем", "3 серии по 6-8 мин, качество >= 4/5", {
          targetSets: 3,
          targetDurationMinutes: 7,
          targetRpe: 5,
          displayOrder: 0,
        }),
        constructorExercise("Защита/спрол после входа", "3 серии по 4-6 повторов", {
          targetSets: 3,
          targetReps: 6,
          targetRpe: 5,
          displayOrder: 1,
        }),
        constructorExercise("Ситуация стойка -> партер", "2 серии по 5 мин, без силовой рубки в подводке", {
          targetSets: 2,
          targetDurationMinutes: 5,
          targetRpe: 5,
          displayOrder: 2,
        }),
      ];
    case "wrestling_contact_density":
      return [
        constructorExercise("Цикл 3 мин + 30 сек + 3 мин", "2 цикла, второй период 85-90%, качество техники", {
          targetSets: 2,
          targetDurationMinutes: 7,
          targetRpe: 8,
          displayOrder: 0,
        }),
        constructorExercise("Клинч/давление", "3 отрезка по 60-90 сек, без потери стойки", {
          targetSets: 3,
          targetDurationMinutes: 2,
          targetRpe: 7,
          displayOrder: 1,
        }),
      ];
    case "weight_management":
      return [
        constructorExercise("Вес + самочувствие", "зафиксировать вес, жажду, аппетит, настроение", {
          targetDurationMinutes: 3,
          targetRpe: 1,
          displayOrder: 0,
        }),
        constructorExercise("Сон + пульс покоя", "сверить с baseline и readiness", {
          targetDurationMinutes: 3,
          targetRpe: 1,
          displayOrder: 1,
        }),
      ];
    case "taper_quality":
      return [
        constructorExercise("Техника без сопротивления", "15-20 мин, точность, без утомления", {
          targetDurationMinutes: 20,
          targetRpe: 3,
          displayOrder: 0,
        }),
        constructorExercise("Короткие входы", "2-4 включения, ощущение резкости, полный отдых", {
          targetSets: 4,
          targetReps: 1,
          targetRpe: 4,
          displayOrder: 1,
        }),
      ];
    case "recovery":
      return [
        constructorExercise("Активное восстановление", "15-25 мин Z1 или прогулка", {
          targetDurationMinutes: 20,
          targetRpe: 2,
          displayOrder: 0,
        }),
        constructorExercise("Мобилити локальных зон", "ноги, таз, спина, предплечья", {
          targetDurationMinutes: 10,
          targetRpe: 1,
          displayOrder: 1,
        }),
      ];
    case "general":
    default:
      if (planBlock.type === "activation") {
        return [
          constructorExercise("Активация и специальные движения", "коротко, без накопления усталости", {
            targetDurationMinutes: 10,
            targetRpe: 3,
            displayOrder: 0,
          }),
        ];
      }

      return [
        constructorExercise(planBlock.name, "выполнить по объёму блока, тренер может уточнить вручную", {
          targetDurationMinutes: planBlock.type === "technical" ? 20 : null,
          targetRpe: 4,
          displayOrder: 0,
        }),
      ];
  }
}

function withConcreteBlockDetails(planBlock: ConstructorPlanBlock): ConstructorPlanBlock {
  return {
    ...planBlock,
    volume: concreteVolumeForBlock(planBlock),
    exercises: concreteExercisesForBlock(planBlock),
  };
}

function withTrainingSessionFrame(
  dayPlan: ConstructorPlanDay,
  phase: ConstructorPhase,
): ConstructorPlanDay {
  if (!needsTrainingSessionFrame(dayPlan)) {
    return dayPlan;
  }

  const blocks = dayPlan.blocks.filter(
    (planBlock) => !isSessionWarmupBlock(planBlock) && !isSessionCooldownBlock(planBlock),
  );

  return {
    ...dayPlan,
    dayIntent: dayPlan.dayIntent.includes("разминка")
      ? dayPlan.dayIntent
      : `${dayPlan.dayIntent} / разминка -> основная работа -> заминка`,
    blocks: [
      warmupBlockForDay(dayPlan, phase),
      ...blocks,
      cooldownBlockForDay(dayPlan, phase),
    ].map(withConcreteBlockDetails),
  };
}

function stripSessionFrameBlocks(blocks: ConstructorPlanBlock[]) {
  return blocks.filter((planBlock) => !isSessionWarmupBlock(planBlock) && !isSessionCooldownBlock(planBlock));
}

function technicalEveningSupportBlock(phase: ConstructorPhase) {
  return withConcreteBlockDetails(
    block(
      phase === "taper" || phase === "start_window"
        ? "Вечерняя техника качества"
        : "Вечерний технический перенос",
      "technical",
      phase === "taper" || phase === "start_window" ? "taper_quality" : "fatigue_skill",
      phase === "taper" || phase === "start_window"
        ? "15-20 мин / техника без сопротивления / вес и сон под контролем"
        : "20-30 мин / входы, защита, стойка-партер / качество >= 4/5",
      ["ноги", "таз", "контакт"],
      phase === "taper" || phase === "start_window" ? "technical freshness" : "technical transfer",
      ["Europe plan analysis", "motor learning", "wrestling transfer"],
    ),
  );
}

function shouldPreferMorningBlock(planBlock: ConstructorPlanBlock) {
  return (
    ["speed", "strength", "CNS_high", "metabolic", "conditioning"].includes(planBlock.type) ||
    ["speed_first_action", "legs_lme", "arms_grip", "anaerobic_power", "max_strength", "speed_strength"].includes(
      String(planBlock.targetQuality),
    )
  );
}

function createConstructorSession(
  name: string,
  notes: string,
  orderIndex: number,
  mainBlocks: ConstructorPlanBlock[],
  dayPlan: ConstructorPlanDay,
  phase: ConstructorPhase,
): ConstructorPlanSession {
  const framedBlocks = [
    warmupBlockForDay(dayPlan, phase),
    ...mainBlocks,
    cooldownBlockForDay(dayPlan, phase),
  ].map(withConcreteBlockDetails);

  return {
    name,
    notes,
    orderIndex,
    blocks: framedBlocks,
  };
}

function withConstructorDaySessions(
  dayPlan: ConstructorPlanDay,
  phase: ConstructorPhase,
  requestedSessionsPerDay: number,
): ConstructorPlanDay {
  const sessionsPerDay = Math.max(1, Math.min(2, Math.round(requestedSessionsPerDay || 1)));

  if (dayPlan.sessions?.length && sessionsPerDay >= 2 && needsTrainingSessionFrame(dayPlan)) {
    const framedSessions = dayPlan.sessions.map((session, index) =>
      createConstructorSession(
        session.name,
        session.notes || dayPlan.readinessGate,
        session.orderIndex ?? index,
        stripSessionFrameBlocks(session.blocks.map(withConcreteBlockDetails)),
        dayPlan,
        phase,
      ),
    );

    return {
      ...dayPlan,
      blocks: framedSessions.flatMap((session) => session.blocks),
      sessions: framedSessions,
    };
  }

  const concreteBlocks = dayPlan.blocks.map(withConcreteBlockDetails);

  if (!needsTrainingSessionFrame({ ...dayPlan, blocks: concreteBlocks })) {
    return {
      ...dayPlan,
      blocks: concreteBlocks,
      sessions: [
        {
          name: "Служебный контроль",
          notes: dayPlan.readinessGate,
          orderIndex: 0,
          blocks: concreteBlocks,
        },
      ],
    };
  }

  const mainBlocks = stripSessionFrameBlocks(concreteBlocks);

  if (sessionsPerDay < 2) {
    return {
      ...dayPlan,
      blocks: concreteBlocks,
      sessions: [
        {
          name: "Основная тренировка",
          notes: dayPlan.readinessGate,
          orderIndex: 0,
          blocks: concreteBlocks,
        },
      ],
    };
  }

  const morningBlocks: ConstructorPlanBlock[] = [];
  const eveningBlocks: ConstructorPlanBlock[] = [];

  for (const planBlock of mainBlocks) {
    if (
      shouldPreferMorningBlock(planBlock) ||
      (planBlock.targetQuality === "fatigue_skill" && morningBlocks.some(shouldPreferMorningBlock))
    ) {
      morningBlocks.push(planBlock);
    } else {
      eveningBlocks.push(planBlock);
    }
  }

  if (morningBlocks.length === 0 && eveningBlocks.length > 0) {
    morningBlocks.push(eveningBlocks.shift() as ConstructorPlanBlock);
  }

  if (eveningBlocks.every((planBlock) => !isActiveTrainingBlock(planBlock))) {
    eveningBlocks.unshift(technicalEveningSupportBlock(phase));
  }

  return {
    ...dayPlan,
    blocks: [
      ...createConstructorSession("УТРО", dayPlan.readinessGate, 0, morningBlocks, dayPlan, phase).blocks,
      ...createConstructorSession("ВЕЧЕР", dayPlan.readinessGate, 1, eveningBlocks, dayPlan, phase).blocks,
    ],
    sessions: [
      createConstructorSession("УТРО", dayPlan.readinessGate, 0, morningBlocks, dayPlan, phase),
      createConstructorSession("ВЕЧЕР", dayPlan.readinessGate, 1, eveningBlocks, dayPlan, phase),
    ],
  };
}

function speedToWrestlingTransferBlock(phase: ConstructorPhase) {
  return block(
    "Борцовский перенос скорости",
    "technical",
    "fatigue_skill",
    phase === "special_preparation"
      ? "15-20 мин / первое действие, входы, выход из захвата"
      : "10-15 мин / первое действие из стойки / без добора",
    ["ноги", "таз", "контакт"],
    "technical transfer",
    ["wrestling transfer", "PERFORM coach quality score", "motor learning"],
  );
}

function normalizeMaintenanceBlockForPhase(
  planBlock: ConstructorPlanBlock,
  phase: ConstructorPhase,
): ConstructorPlanBlock {
  const normalized = clonePlanBlock(planBlock);

  if (phase === "taper" || phase === "start_window") {
    if (normalized.targetQuality === "speed_first_action" || normalized.type === "speed") {
      return {
        ...normalized,
        name: "Нейромышечная активация первого действия",
        type: "activation",
        targetQuality: "taper_quality",
        volume:
          phase === "start_window"
            ? "5-8 мин / 2-3 коротких включения / без развития утомления"
            : "8-12 мин / 2-4 коротких включения / полный отдых",
        energySystem: "activation / supercompensation",
        riskFlags: [],
        evidenceRefs: ["taper logic", "supercompensation", "Europe plan analysis"],
      };
    }

    return normalized;
  }

  if (!isSpecialSupportPhase(phase)) {
    return normalized;
  }

  switch (normalized.targetQuality) {
    case "speed_first_action":
      return {
        ...normalized,
        name: "Поддержание скорости первого действия",
        type: "activation",
        volume: "3-5 качественных повторов / полный отдых / без добора объёма",
        energySystem: "alactic maintenance",
        evidenceRefs: ["speed profile", "wrestling transfer", "Europe plan analysis"],
      };
    case "legs_lme":
      return {
        ...normalized,
        name: "Поддержание СФП ног",
        volume: "2-4 подхода / 15-25 сек / без отказа",
        energySystem: "local maintenance",
        evidenceRefs: ["BFR/KAATSU evidence", "PERFORM Evidence Matrix", "taper risk control"],
      };
    case "arms_grip":
      return {
        ...normalized,
        name: "Поддержание рук и хвата",
        volume: "2-4 подхода / без отказа / локти и плечи без боли",
        energySystem: "local strength endurance maintenance",
        evidenceRefs: ["grappling transfer evidence", "PERFORM Evidence Matrix"],
      };
    case "max_strength":
    case "speed_strength":
      return {
        ...normalized,
        name: "Поддержание силового тонуса",
        volume: "2-3 подхода / RPE 5-6 / без тяжёлых ног",
        energySystem: "strength maintenance",
        evidenceRefs: ["strength training evidence", "taper risk control"],
      };
    case "anaerobic_power":
      return {
        ...normalized,
        name: "Специальная плотность без добора",
        volume: "2-4 коротких отрезка / качество выше объёма / без накопления лактата",
        energySystem: "special maintenance",
        riskFlags: ["glycolytic_recovery_conflict"],
        evidenceRefs: ["wrestling temporal structure", "Europe plan analysis"],
      };
    default:
      return normalized;
  }
}

function physicalToWrestlingTransferBlock(target: ConstructorPlanBlock["targetQuality"]) {
  const volume =
    target === "legs_lme"
      ? "12-18 мин / входы в ноги после локальной работы / качество выше объёма"
      : target === "arms_grip"
        ? "12-18 мин / захват, удержание, выход из контакта / без боли"
        : "12-18 мин / перенос усилия в стойку и партер";

  return block(
    "Технический перенос после ОФП/СФП",
    "technical",
    "fatigue_skill",
    volume,
    ["ноги", "таз", "контакт", "корпус"],
    "technical transfer",
    ["PERFORM Evidence Matrix", "Europe plan analysis", "motor learning"],
  );
}

function weeklyWeightRecoveryDay(label: string) {
  return day(label, "Восстановление, вес и контроль состояния", "recovery", "сон, вес, RHR, боль и самочувствие", [
    block(
      "Контроль веса, сна и восстановления",
      "recovery",
      "weight_management",
      "10-15 мин / вес, сон, RHR, самочувствие",
      ["общее"],
      "recovery",
      ["NCAA weight management", "ACSM hydration", "sleep consensus"],
    ),
    block(
      "Аэробная поддержка",
      "conditioning",
      "aerobic_base",
      "20-30 мин / Z1-Z2 / без накопления усталости",
      ["общее"],
      "aerobic recovery",
      ["load consensus", "wrestling physiology"],
    ),
  ]);
}

function enhanceDevelopmentDayTransfers(dayPlan: ConstructorPlanDay, phase: ConstructorPhase) {
  if (!isDevelopmentPhase(phase)) {
    return dayPlan;
  }

  const blocks = dayPlan.blocks.map((planBlock) => normalizeMaintenanceBlockForPhase(planBlock, phase));
  const hasSpeed = blocks.some(
    (planBlock) => planBlock.targetQuality === "speed_first_action" || planBlock.type === "speed",
  );
  const hasPhysicalDevelopment = blocks.some((planBlock) =>
    [
      "legs_lme",
      "arms_grip",
      "max_strength",
      "speed_strength",
      "anaerobic_power",
    ].includes(String(planBlock.targetQuality)),
  );
  const hasTransfer = blocks.some((planBlock) =>
    ["fatigue_skill", "wrestling_contact_density"].includes(String(planBlock.targetQuality)),
  );

  if (hasSpeed && !hasTransfer) {
    blocks.unshift(speedToWrestlingTransferBlock(phase));
  }

  if (hasPhysicalDevelopment && !hasTransfer && !hasSpeed) {
    const firstPhysicalTarget =
      blocks.find((planBlock) =>
        [
          "legs_lme",
          "arms_grip",
          "max_strength",
          "speed_strength",
          "anaerobic_power",
        ].includes(String(planBlock.targetQuality)),
      )?.targetQuality ?? "general";

    blocks.push(physicalToWrestlingTransferBlock(firstPhysicalTarget));
  }

  return {
    ...dayPlan,
    dayIntent:
      hasSpeed && !hasTransfer
        ? `${dayPlan.dayIntent} + борцовский перенос`
        : hasPhysicalDevelopment && !hasTransfer
          ? `${dayPlan.dayIntent} + технический перенос`
          : dayPlan.dayIntent,
    blocks,
  };
}

function dayTargetCounts(days: ConstructorPlanDay[]) {
  const counts = new Map<ConstructorPlanBlock["targetQuality"], number>();

  for (const dayPlan of days) {
    for (const planBlock of dayPlan.blocks) {
      counts.set(planBlock.targetQuality, (counts.get(planBlock.targetQuality) ?? 0) + 1);
    }
  }

  return counts;
}

function findReplaceableDevelopmentDayIndex(days: ConstructorPlanDay[]) {
  const counts = dayTargetCounts(days);
  const speedIndexes = days
    .map((dayPlan, index) => ({ dayPlan, index }))
    .filter(({ dayPlan }) => hasBlockTarget(dayPlan, "speed_first_action"));

  if (speedIndexes.length > 2) {
    return speedIndexes[speedIndexes.length - 1]?.index ?? -1;
  }

  for (let index = days.length - 1; index >= 0; index -= 1) {
    const dayPlan = days[index];

    if (hasRecoverySupport(dayPlan)) {
      continue;
    }

    if (dayPlan.blocks.some((planBlock) => (counts.get(planBlock.targetQuality) ?? 0) > 1)) {
      return index;
    }
  }

  return days.length > 0 ? days.length - 1 : -1;
}

function normalizeDevelopmentWeekBalance(
  days: ConstructorPlanDay[],
  phase: ConstructorPhase,
  goalTypes: ConstructorGoalType[],
) {
  if (!isDevelopmentPhase(phase) || days.length === 0) {
    return days;
  }

  let balancedDays = days.map((dayPlan) => enhanceDevelopmentDayTransfers(dayPlan, phase));
  const needsWeightControl = goalTypes.includes("weight_management") || goalTypes.includes("taper_quality");
  const hasWeeklyRecovery = balancedDays.some(hasRecoverySupport);
  const hasWeeklyWeight = balancedDays.some((dayPlan) => hasBlockTarget(dayPlan, "weight_management"));

  if (!hasWeeklyRecovery || (needsWeightControl && !hasWeeklyWeight)) {
    const replaceIndex = findReplaceableDevelopmentDayIndex(balancedDays);
    const label = balancedDays[replaceIndex]?.dayLabel ?? `День ${balancedDays.length}`;

    if (replaceIndex >= 0) {
      balancedDays = balancedDays.map((dayPlan, index) =>
        index === replaceIndex ? weeklyWeightRecoveryDay(label) : dayPlan,
      );
    } else {
      balancedDays.push(weeklyWeightRecoveryDay(label));
    }
  }

  const speedDayIndexes = balancedDays
    .map((dayPlan, index) => ({ dayPlan, index }))
    .filter(({ dayPlan }) => hasBlockTarget(dayPlan, "speed_first_action"));

  if (speedDayIndexes.length > 2) {
    const extraSpeedIndexes = new Set(speedDayIndexes.slice(2).map(({ index }) => index));
    balancedDays = balancedDays.map((dayPlan, index) =>
      extraSpeedIndexes.has(index)
        ? day(dayPlan.dayLabel, "Техника борьбы и восстановление после скорости", "low", "качество выше объёма", [
            block(
              "Техника борьбы без добора",
              "technical",
              "fatigue_skill",
              "25-35 мин / стойка, входы, партер / RPE <= 4",
              ["ноги", "таз", "контакт"],
              "technical freshness",
              ["motor learning", "Europe plan analysis"],
            ),
          ])
        : dayPlan,
    );
  }

  if (!balancedDays.some(hasWrestlingSpecificWork)) {
    balancedDays = balancedDays.map((dayPlan, index) =>
      index === 0
        ? {
            ...dayPlan,
            blocks: [speedToWrestlingTransferBlock(phase), ...dayPlan.blocks],
          }
        : dayPlan,
    );
  }

  return balancedDays;
}

function withCompetitionTaperStructure(
  dayPlan: ConstructorPlanDay,
  phase: ConstructorPhase,
): ConstructorPlanDay {
  if (phase !== "taper" && phase !== "start_window") {
    return dayPlan;
  }

  const hasSpeed = hasBlockTarget(dayPlan, "speed_first_action") || hasBlockType(dayPlan, "speed");
  const hasWeight = hasBlockTarget(dayPlan, "weight_management");
  const hasTechnical =
    hasBlockType(dayPlan, "technical") ||
    hasBlockTarget(dayPlan, "fatigue_skill") ||
    hasBlockTarget(dayPlan, "taper_quality") ||
    hasBlockTarget(dayPlan, "wrestling_contact_density");
  const hasWrestlingTransfer =
    hasBlockTarget(dayPlan, "fatigue_skill") || hasBlockTarget(dayPlan, "wrestling_contact_density");
  const blocks: ConstructorPlanBlock[] = [];

  if (!hasTechnical && !hasSpeed) {
    blocks.push(
      block(
        "Техника борьбы и тактические ситуации",
        "technical",
        "fatigue_skill",
        phase === "start_window"
          ? "15-20 мин / стойка, входы, защита, партер / без утомления"
          : "25-35 мин / стойка, входы, защита, партер / качество выше объёма",
        ["ноги", "таз", "контакт", "корпус"],
        "technical freshness",
        ["taper logic", "Europe plan analysis", "motor learning"],
      ),
    );
  }

  if (hasTechnical && !hasWrestlingTransfer && !hasSpeed && !hasWeight) {
    blocks.push(
      block(
        "Борцовские ситуации без утомления",
        "technical",
        "fatigue_skill",
        phase === "start_window"
          ? "10-15 мин / стойка-партер / без борьбы в утомление"
          : "15-20 мин / стойка, входы, защита, партер",
        ["ноги", "таз", "контакт"],
        "technical freshness",
        ["taper logic", "Europe plan analysis", "motor learning"],
      ),
    );
  }

  blocks.push(...dayPlan.blocks.map((planBlock) => normalizeMaintenanceBlockForPhase(planBlock, phase)));

  if (hasSpeed && !hasBlockTarget(dayPlan, "fatigue_skill")) {
    blocks.unshift(
      block(
        "Борцовский перенос скорости",
        "technical",
        "fatigue_skill",
        phase === "start_window"
          ? "10-15 мин / первое действие из стойки / без добора"
          : "15-20 мин / первое действие, входы, выход из захвата",
        ["ноги", "таз", "контакт"],
        "technical transfer",
        ["taper logic", "wrestling transfer", "PERFORM coach quality score"],
      ),
    );
  }

  if (!hasWeight) {
    blocks.push(
      block(
        "Контроль веса, сна и свежести",
        "recovery",
        "weight_management",
        "5-10 мин / вес, сон, самочувствие, мобилити",
        ["общее"],
        "recovery",
        ["NCAA weight management", "ACSM hydration", "sleep consensus"],
      ),
    );
  }

  return {
    ...dayPlan,
    dayIntent: hasSpeed
      ? "Техника борьбы + короткая скоростная активация"
      : hasWeight
        ? "Лёгкая техника, вес и свежесть"
        : dayPlan.dayIntent,
    readinessGate:
      phase === "start_window"
        ? "без утомления, без добора объёма, вес и сон под контролем"
        : dayPlan.readinessGate,
    blocks,
  };
}

function supportDayForPhase(
  phase: ConstructorPhase,
  label: string,
  goalTypes: ConstructorGoalType[],
  slotIndex: number,
) {
  const supportGoal = goalTypes[slotIndex % Math.max(1, goalTypes.length)] ?? "recovery";

  if (phase === "taper") {
    if (supportGoal === "weight_management") {
      return day(label, "Вес, сон и восстановление", "recovery", "без интенсивности", [
        block(
          "Контроль веса и восстановления",
          "recovery",
          "weight_management",
          "сон / вес / мобилити 15-20 мин",
          ["общее"],
          "recovery",
          ["NCAA weight management", "ACSM hydration"],
        ),
      ]);
    }

    if (supportGoal === "speed_first_action" || supportGoal === "speed_strength") {
      return day(label, "Поддерживающая активация первого действия", "taper", "сон нормальный, полный отдых", [
        block(
          "Нейромышечная активация первого действия",
          "activation",
          "taper_quality",
          "8-12 мин / 2-4 коротких включения / без развития утомления",
          ["ноги", "таз", "контакт"],
          "activation / supercompensation",
          ["taper logic", "supercompensation", "Europe plan analysis"],
        ),
      ]);
    }

    if (supportGoal === "wrestling_contact_density" || supportGoal === "fatigue_skill") {
      return day(label, "Техника борьбы без накопления усталости", "low", "качество выше объёма, RPE <= 4", [
        block(
          "Техника и входы без утомления",
          "technical",
          "fatigue_skill",
          "20-30 мин / точность / без добора",
          ["ноги", "таз", "контакт"],
          "technical freshness",
          ["taper logic", "Europe plan analysis", "motor learning"],
        ),
      ]);
    }

    return day(label, "Качество подводки", "low", "качество выше объёма, RPE <= 4", [
      block(
        "Техника без сопротивления",
        "technical",
        "taper_quality",
        "20-30 мин / точность / без добора",
        ["общее"],
        "technical freshness",
        ["taper logic", "Europe plan analysis"],
      ),
    ]);
  }

  if (phase === "start_window") {
    if (supportGoal === "weight_management") {
      return day(label, "Вес и свежесть", "recovery", "без добора", [
        block(
          "Контроль веса",
          "recovery",
          "weight_management",
          "сон / вес / мобилити",
          ["общее"],
          "recovery",
          ["NCAA weight management"],
        ),
      ]);
    }

    return day(label, "Стартовая свежесть", "taper", "очень коротко, без усталости", [
      block(
        "Активация перед стартом",
        "activation",
        "taper_quality",
        "10-15 мин / скорость ощущений",
        ["общее"],
        "activation",
        ["taper logic"],
      ),
    ]);
  }

  if (phase === "recovery") {
    const variants = [
      day(label, "Мобилити и лёгкая техника", "recovery", "без боли", [
        block("Мобилити", "mobility", "recovery", "20 мин", ["общее"], "recovery", [
          "sleep/load consensus",
        ]),
      ]),
      day(label, "Аэробное восстановление", "low", "Z1-Z2", [
        block("Лёгкая аэробная", "conditioning", "recovery", "20-30 мин", ["общее"], "aerobic recovery", [
          "load consensus",
        ]),
      ]),
    ];

    return variants[slotIndex % variants.length];
  }

  switch (supportGoal) {
    case "speed_first_action":
      return day(label, "Скорость первого действия", "medium", "полный отдых между повторами", [
        block("Старт 10-20 м", "speed", "speed_first_action", "5-8 повторов / полный отдых", ["ноги"], "CNS / alactic", [
          "Chinese SSIT wrestler evidence",
          "speed profile",
        ]),
      ]);
    case "speed_strength":
      return day(label, "Скоростно-силовая работа", "medium", "без отказа, качество выше веса", [
        block("Прыжки / броски / ускорение", "CNS_high", "speed_strength", "4-6 серий / полный отдых", ["ноги", "корпус"], "CNS / power", [
          "speed-strength evidence",
        ]),
      ]);
    case "max_strength":
      return day(label, "Силовая база без добора", "medium", "без отказа и без тяжёлых ног перед скоростью", [
        block("Силовая работа", "strength", "max_strength", "3-5 подходов / RPE 6-7", ["ноги", "корпус"], "strength", [
          "strength training evidence",
        ]),
      ]);
    case "legs_lme":
      return day(label, "Локальная выносливость ног", "medium", "не доводить до отказа", [
        block(
          "ЛМВ ног",
          "metabolic",
          "legs_lme",
          "3-5 подходов / 20-30 сек / без отказа",
          ["ноги", "таз", "корпус"],
          "local metabolic",
          ["BFR/KAATSU evidence", "PERFORM Evidence Matrix"],
          ["heavy_legs_sprint_conflict"],
        ),
      ]);
    case "arms_grip":
      return day(label, "Руки и хват", "medium", "локти/плечи без боли", [
        block("Хват и удержание", "strength", "arms_grip", "4-5 подходов / без отказа", ["предплечья", "плечи"], "local strength endurance", [
          "grappling transfer evidence",
        ]),
      ]);
    case "wrestling_contact_density":
      return day(label, "Плотность борьбы", "high", "readiness >= 70, сон нормальный", [
        block(
          "Короткие раунды и контакт",
          "technical",
          "wrestling_contact_density",
          "3-5 раундов / контроль качества",
          ["контакт", "общее"],
          "mixed wrestling",
          ["UWW model", "wrestling temporal structure"],
          ["glycolytic_recovery_conflict"],
        ),
      ]);
    case "fatigue_skill":
      return day(label, "Техника под утомлением", "medium", "качество техники не ниже 4/5", [
        block(
          "Технический перенос",
          "technical",
          "fatigue_skill",
          "20-30 мин / качество выше объёма",
          ["ноги", "таз", "контакт"],
          "technical transfer",
          ["motor learning", "PERFORM coach quality score"],
        ),
      ]);
    case "anaerobic_power":
      return day(label, "Анаэробная мощность", "high", "readiness >= 70, без активной сгонки", [
        block(
          "Интервальная работа",
          "metabolic",
          "anaerobic_power",
          "4-6 отрезков / полный контроль качества",
          ["ноги", "корпус"],
          "glycolytic",
          ["wrestling temporal structure"],
          ["glycolytic_recovery_conflict"],
        ),
      ]);
    case "aerobic_base":
      return day(label, "Аэробная база и восстановление", "low", "Z1-Z2, без накопления усталости", [
        block("Лёгкая аэробная", "conditioning", "aerobic_base", "25-35 мин / Z1-Z2", ["общее"], "aerobic recovery", [
          "load consensus",
        ]),
      ]);
    case "weight_management":
      return day(label, "Вес и восстановление", "recovery", "обязательная проверка веса/сна", [
        block(
          "Контроль веса и восстановления",
          "recovery",
          "weight_management",
          "сон / вес / мобилити 15-20 мин",
          ["общее"],
          "recovery",
          ["NCAA weight management", "ACSM hydration"],
        ),
      ]);
    case "taper_quality":
      return day(label, "Техника качества", "low", "без добора объёма", [
        block("Техника без утомления", "technical", "taper_quality", "25-35 мин / качество", ["общее"], "technical", [
          "taper logic",
          "Europe plan analysis",
        ]),
      ]);
    case "recovery":
    default:
      return day(label, "Аэробная поддержка и восстановление", "low", "Z1-Z2, без накопления усталости", [
        block(
          "Аэробная поддержка",
          "conditioning",
          "aerobic_base",
          "25-35 мин / Z1-Z2",
          ["общее"],
          "aerobic recovery",
          ["load consensus", "sleep consensus"],
        ),
      ]);
  }
}

function isMajorCompetitionConstructorCase(input: ConstructorInput) {
  return (
    isMajorCompetition(input) &&
    input.context.cycleLengthDays <= 30 &&
    normalizePhaseForCycle(input) !== "recovery"
  );
}

function defaultGoalTypesForCompetitionCase(
  input: ConstructorInput,
  requestedGoalTypes: ConstructorGoalType[],
): ConstructorGoalType[] {
  if (!isMajorCompetitionConstructorCase(input)) {
    return requestedGoalTypes.length > 0 ? requestedGoalTypes : ["recovery"];
  }

  const days = input.context.cycleLengthDays;
  const recommended: ConstructorGoalType[] =
    days <= 3
      ? ["taper_quality", "weight_management", "recovery"]
      : days <= 7
        ? ["taper_quality", "fatigue_skill", "weight_management", "recovery"]
        : days <= 14
          ? ["fatigue_skill", "taper_quality", "weight_management", "recovery"]
          : days <= 23
            ? [
                "wrestling_contact_density",
                "fatigue_skill",
                "taper_quality",
                "weight_management",
                "recovery",
              ]
            : [
                "fatigue_skill",
                "wrestling_contact_density",
                "legs_lme",
                "weight_management",
                "recovery",
                "taper_quality",
              ];

  for (const goalType of requestedGoalTypes) {
    if (!recommended.includes(goalType)) {
      recommended.push(goalType);
    }
  }

  return recommended;
}

function goalModeForInput(goalType: ConstructorGoalType, input: ConstructorInput): ConstructorGoalMode {
  if (!isMajorCompetitionConstructorCase(input)) {
    return "development";
  }

  switch (goalType) {
    case "speed_first_action":
    case "speed_strength":
      return "activation";
    case "legs_lme":
    case "arms_grip":
    case "aerobic_base":
    case "anaerobic_power":
    case "max_strength":
      return "maintenance";
    case "fatigue_skill":
    case "wrestling_contact_density":
      return "transfer";
    case "weight_management":
    case "recovery":
      return "recovery";
    case "taper_quality":
    default:
      return "activation";
  }
}

function competitionFocusPhaseMap(input: ConstructorInput) {
  const days = Math.max(1, Math.round(input.context.cycleLengthDays));
  const phaseMap: ConstructorDraft["focusPlan"]["phaseMap"] = [];

  if (days >= 24) {
    phaseMap.push({
      range: `Д-${days}...Д-24`,
      phase: "special_preparation",
      title: "вход в специальный блок",
      intent: "СФП поддерживающе, техника и восстановление без резкого перегруза",
    });
  }

  if (days >= 17) {
    phaseMap.push({
      range: `Д-${Math.min(days, 23)}...Д-17`,
      phase: "special_preparation",
      title: "основной специальный микроцикл",
      intent: "борьба, соревновательная модель, финишная способность и ежедневный контроль",
    });
  }

  if (days >= 10) {
    phaseMap.push({
      range: `Д-${Math.min(days, 16)}...Д-10`,
      phase: "taper",
      title: "интеграция и снижение объёма",
      intent: "меньше объёма, больше качества, техника без силовой рубки",
    });
  }

  if (days >= 5) {
    phaseMap.push({
      range: `Д-${Math.min(days, 9)}...Д-5`,
      phase: "taper",
      title: "подводка, свежесть, вес",
      intent: "суперкомпенсация, вес, сон, короткая активация",
    });
  }

  phaseMap.push({
    range: `Д-${Math.min(days, 4)}...старт`,
    phase: "start_window",
    title: "дорога, взвешивание, активация, пик",
    intent: "без добора нагрузки, только свежесть и ключевые действия",
  });

  return phaseMap;
}

function buildCompetitionFocusPlan(input: ConstructorInput, goalTypes: ConstructorGoalType[]) {
  const isCompetitionPrep = isMajorCompetitionConstructorCase(input);

  if (!isCompetitionPrep) {
    return {
      title: "Фокус подготовки",
      developmentAllowed: true,
      items: goalTypes.map((goalType, index) => ({
        goalType,
        mode: "development" as ConstructorGoalMode,
        label: goalLabel(goalType),
        reason: index === 0 ? "главная выбранная цель тренера" : "дополнительная выбранная цель",
      })),
      phaseMap: [],
    };
  }

  const requested = new Set(goalTypes);
  const baseItems: Array<{
    goalType: ConstructorGoalType;
    mode: ConstructorGoalMode;
    label: string;
    reason: string;
  }> = [
    {
      goalType: "fatigue_skill",
      mode: "transfer",
      label: "специальная борцовская работа",
      reason: "ядро активных дней: техника, ситуации и перенос СФП в борьбу",
    },
    {
      goalType: "wrestling_contact_density",
      mode: "transfer",
      label: "соревновательная модель",
      reason: "моделирование 3 мин + 30 сек + 3 мин и турнирной плотности",
    },
    {
      goalType: "legs_lme",
      mode: "maintenance",
      label: "поддержание СФП",
      reason: "короткие локальные блоки без отказа и только с переносом в входы/проходы",
    },
    {
      goalType: "weight_management",
      mode: "recovery",
      label: "контроль веса",
      reason: "вес, сон, пульс покоя и самочувствие влияют на допустимую нагрузку",
    },
    {
      goalType: "recovery",
      mode: "recovery",
      label: "восстановление и суперкомпенсация",
      reason: "половинчатые дни, смена обстановки и снятие накопленного напряжения",
    },
    {
      goalType: "taper_quality",
      mode: "activation",
      label: "качество подводки",
      reason: "сохранить свежесть, резкость и уверенность без развития утомления",
    },
  ];

  const extraItems = goalTypes
    .filter((goalType) => !baseItems.some((item) => item.goalType === goalType))
    .map((goalType) => ({
      goalType,
      mode: goalModeForInput(goalType, input),
      label: competitionSafeGoalLabel(goalType),
      reason: requested.has(goalType)
        ? "выбрано тренером, но в последние 30 дней трактуется как безопасный предсоревновательный режим"
        : "добавлено системой как поддерживающий контекст",
    }));

  return {
    title: "Фокус специальной предсоревновательной подготовки",
    developmentAllowed: false,
    items: [...baseItems, ...extraItems],
    phaseMap: competitionFocusPhaseMap(input),
  };
}

function phaseDecisionLabel(phase: ConstructorPhase) {
  const labels: Record<ConstructorPhase, string> = {
    base: "базовая подготовка",
    development: "развитие качеств",
    special_preparation: "специальная предсоревновательная подготовка",
    taper: "подводка и снижение объёма",
    start_window: "стартовое окно",
    recovery: "восстановление",
  };

  return labels[phase];
}

function strategyTypeLabel(strategyType: SeasonStrategySnapshot["season"]["strategyType"]) {
  const labels: Record<string, string> = {
    single_peak: "один главный пик",
    double_peak: "два пика",
    multi_peak: "мультипиковая стратегия",
  };

  return strategyType ? labels[strategyType] ?? strategyType : "стратегия сезона не задана";
}

function missingDataShortLabel(code: ConstructorMissingDataCode) {
  const labels: Record<ConstructorMissingDataCode, string> = {
    speed_tests: "тесты 10/20 м",
    jump_or_power_test: "прыжок или мощность",
    grip_tests: "тест хвата",
    legs_lme_test: "тест ЛМВ ног",
    technique_quality_score: "оценка техники",
    aerobic_recovery_test: "аэробное восстановление",
    readiness: "готовность",
    sleep: "сон",
    resting_hr: "пульс покоя",
    weight_plan: "план веса",
    coach_comment: "комментарий тренера",
  };

  return labels[code];
}

function missingDataSummary(missingData: ConstructorMissingData[]) {
  if (missingData.length === 0) {
    return "ключевые данные на месте";
  }

  return missingData
    .map((item) => missingDataShortLabel(item.code))
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(", ");
}

function riskShortLabel(code: ConstructorRiskCode) {
  const labels: Record<ConstructorRiskCode, string> = {
    competition_close: "близкий старт",
    weight_gap: "вес выше цели",
    weight_cut_active: "активная сгонка",
    low_readiness: "низкая готовность",
    low_sleep: "недостаточный сон",
    rhr_above_baseline: "пульс покоя выше базы",
    pain_or_injury: "боль или травматический риск",
    heavy_legs_sprint_conflict: "конфликт ног и скорости",
    glycolytic_recovery_conflict: "конфликт гликолитики и восстановления",
    missing_key_tests: "нехватка ключевых данных",
    device_data_low_confidence: "неполные данные устройства",
    travel_fatigue: "дорога или смена режима",
  };

  return labels[code];
}

function confidenceReasonSummary(missingData: ConstructorMissingData[], riskFlags: ConstructorRiskFlag[]) {
  if (missingData.length > 0) {
    return `нехватки данных (${missingDataSummary(missingData)})`;
  }

  if (riskFlags.length > 0) {
    return `близости старта и ограничений (${riskFlags
      .map((risk) => riskShortLabel(risk.code))
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(", ")})`;
  }

  return "осторожного режима стартового окна";
}

function sentenceWithPeriod(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function capitalizeSentence(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
}

function strategyDecisionSummary(snapshot: SeasonStrategySnapshot | null | undefined) {
  if (!snapshot) {
    return "";
  }

  const targetTitle = snapshot.targetCompetition.title ?? "выбранный старт";
  const daysText =
    snapshot.currentWindow.daysToStart !== null
      ? `до старта ${snapshot.currentWindow.daysToStart} дн`
      : "дата старта не определена";
  const seasonText = snapshot.season.name
    ? `Сезон: ${snapshot.season.name}, ${strategyTypeLabel(snapshot.season.strategyType)}.`
    : `Сезон: ${strategyTypeLabel(snapshot.season.strategyType)}.`;

  return `${seasonText} Олимпийский цикл: ${snapshot.olympicCycle.yearStageLabel}. Целевой старт: ${targetTitle}, ${daysText}. ${sentenceWithPeriod(capitalizeSentence(snapshot.currentWindow.phaseReason))}`;
}

function daysToStartForDecision(input: ConstructorInput) {
  return input.seasonStrategy?.currentWindow.daysToStart ?? input.context.cycleLengthDays;
}

function buildUnderstoodMainTask(input: ConstructorInput, goal: ConstructorGoalType) {
  if (!isMajorCompetitionConstructorCase(input)) {
    return `Главная задача: ${goalLabel(goal)}.`;
  }

  if (input.context.currentPhase === "start_window") {
    return "Главная задача: стартовое окно, свежесть и безопасная активация.";
  }

  if (input.context.currentPhase === "taper") {
    return "Главная задача: подводка, снижение объёма и сохранение резкости.";
  }

  return "Главная задача: специальная предсоревновательная подготовка.";
}

function buildUnderstoodInterpretation(
  input: ConstructorInput,
  confidence: ConstructorConfidence,
  focusPlan: ConstructorDraft["focusPlan"],
  missingData: ConstructorMissingData[],
  riskFlags: ConstructorRiskFlag[],
  goal: ConstructorGoalType,
  effectivePhase: ConstructorPhase,
) {
  const phaseLabel = phaseDecisionLabel(effectivePhase);

  if (!isMajorCompetitionConstructorCase(input)) {
    if (confidence === "low") {
      return `Система видит цель, но не хватает данных (${missingDataSummary(
        missingData,
      )}) для уверенного выбора нагрузки. Черновик остаётся безопасным, а развивающие блоки требуют подтверждения тренера.`;
    }

    return `Система может построить черновик под цель "${goalLabel(goal)}" с учетом фазы ${phaseLabel}.`;
  }

  const focusText = focusPlan.items.map((item) => item.label).join(", ");
  const strategyText = strategyDecisionSummary(input.seasonStrategy);
  const confidenceText =
    confidence === "low"
      ? `Уверенность снижена не из-за цели, а из-за ${confidenceReasonSummary(
          missingData,
          riskFlags,
        )}. Поэтому план строится осторожно: без добора нагрузки, с контролем свежести, веса и восстановления.`
      : "Данных достаточно, чтобы собрать черновик в безопасной предсоревновательной логике.";

  return `Система определила фазу: ${phaseLabel}. ${strategyText} Фокус: ${focusText}. ${confidenceText}`;
}

function buildUnderstoodLimitation(
  input: ConstructorInput,
  missingData: ConstructorMissingData[],
  weightGap: number,
  confidence: ConstructorConfidence,
) {
  const limitations: string[] = [];

  if (confidence === "low" && missingData.length > 0) {
    limitations.push(`Уверенность снижена: нужно уточнить ${missingDataSummary(missingData)}.`);
  }

  if (weightGap > 0) {
    limitations.push(`Вес выше цели на ${weightGap} кг: план должен учитывать вес и восстановление.`);
  }

  if (isMajorCompetitionConstructorCase(input)) {
    limitations.push("В этом окне нельзя добирать развитие: только поддержание, перенос, активация и восстановление.");
  }

  return limitations.length > 0
    ? limitations.join(" ")
    : "Ограничения по весу и восстановлению не являются главным фактором по текущим вводным.";
}

function buildMainDecisionText(input: ConstructorInput, goal: ConstructorGoalType, effectivePhase: ConstructorPhase) {
  const strategyText = strategyDecisionSummary(input.seasonStrategy);

  if (!isMajorCompetitionConstructorCase(input)) {
    return `Черновик строится вокруг цели "${goalLabelForInput(goal, input)}" и текущей фазы ${phaseDecisionLabel(
      effectivePhase,
    )}.${strategyText ? ` ${strategyText}` : ""}`;
  }

  return `Черновик строится от календаря старта: ${input.context.cycleLengthDays} дн., фаза "${phaseDecisionLabel(
    effectivePhase,
  )}". Развитие запрещено; скорость/ЛМВ/сила работают как поддержание, перенос, активация и восстановление.${
    strategyText ? ` ${strategyText}` : ""
  }`;
}

function buildWhyNowText(input: ConstructorInput, effectivePhase: ConstructorPhase) {
  if (!isMajorCompetitionConstructorCase(input)) {
    if (effectivePhase === "taper" || effectivePhase === "start_window") {
      return "Старт близко, поэтому развитие качества заменяется подводкой, свежестью и контролем веса.";
    }

    return "Срок позволяет развивать качество, но нагрузка ограничивается readiness, сном, RHR и весом.";
  }

  const daysToStart = daysToStartForDecision(input);

  if (effectivePhase === "start_window") {
    return `Осталось ${daysToStart} дн. до старта: это стартовое окно. Нельзя добирать объём; нужны сон, вес, вода, короткая активация и уверенность в ключевых действиях.`;
  }

  if (effectivePhase === "taper") {
    return `Осталось ${daysToStart} дн. до старта: это подводка. Объём снижается, борьба остаётся качественной, активация короткая, восстановление и вес важнее добора нагрузки.`;
  }

  return `Осталось ${daysToStart} дн. до главного старта: это предсоревновательная подготовка. Развитие заменяется специальной борьбой, переносом СФП, разгрузкой, весом и подводкой.`;
}

function goalsFromTypes(goalTypes: ConstructorGoalType[], input: ConstructorInput): ConstructorGoalInput[] {
  return goalTypes.map((goalType, index) => {
    const requested = input.goals.find((goal) => goal.goalType === goalType);

    return {
      goalType,
      priority: index + 1,
      mode: requested?.mode ?? goalModeForInput(goalType, input),
      reason:
        requested?.reason ??
        (isMajorCompetitionConstructorCase(input)
          ? "автовыбор фокуса для главного старта по остаточным дням"
          : null),
    };
  });
}

function dayWithExplicitSessions(
  dayLabel: string,
  dayIntent: string,
  loadLevel: ConstructorLoadLevel,
  readinessGate: string,
  morningBlocks: ConstructorPlanBlock[],
  eveningBlocks: ConstructorPlanBlock[],
): ConstructorPlanDay {
  return {
    dayLabel,
    dayIntent,
    loadLevel,
    readinessGate,
    blocks: [...morningBlocks, ...eveningBlocks],
    sessions: [
      {
        name: "УТРО",
        notes: readinessGate,
        orderIndex: 0,
        blocks: morningBlocks,
      },
      {
        name: "ВЕЧЕР",
        notes: readinessGate,
        orderIndex: 1,
        blocks: eveningBlocks,
      },
    ],
  };
}

function dayWithSingleSession(
  dayLabel: string,
  dayIntent: string,
  loadLevel: ConstructorLoadLevel,
  readinessGate: string,
  sessionBlocks: ConstructorPlanBlock[],
): ConstructorPlanDay {
  return {
    dayLabel,
    dayIntent,
    loadLevel,
    readinessGate,
    blocks: sessionBlocks,
    sessions: [
      {
        name: "УТРО",
        notes: `${readinessGate}. Вторая тренировка не ставится: разгрузка, сон, питание, восстановительные процедуры.`,
        orderIndex: 0,
        blocks: sessionBlocks,
      },
    ],
  };
}

function techniqueBaseBlock(volume = "25-35 мин / стойка, входы, защита, партер / качество >= 4/5") {
  return lockedVolumeBlock(
    block(
      "Техника борьбы",
      "technical",
      "fatigue_skill",
      volume,
      ["ноги", "таз", "контакт", "корпус"],
      "technical / motor control",
      ["Europe plan analysis", "motor learning", "wrestling transfer"],
    ),
  );
}

function technicalTempoBlock(volume = "20 мин техника в темпе + 3-4 короткие ситуации / без развала стойки") {
  return lockedVolumeBlock(
    block(
      "Техника в темпе",
      "technical",
      "fatigue_skill",
      volume,
      ["ноги", "таз", "контакт"],
      "technical tempo",
      ["Europe plan analysis", "technical_under_fatigue", "motor learning"],
    ),
  );
}

function wrestlingRoundBlock(
  name = "Соревновательные циклы борьбы",
  volume = "2 цикла 3 мин + 30 сек + 3 мин / пауза 4-6 мин / качество техники",
) {
  return lockedVolumeBlock(
    block(
      name,
      "technical",
      "wrestling_contact_density",
      volume,
      ["контакт", "ноги", "таз", "корпус"],
      "mixed wrestling / competition model",
      ["Europe plan analysis", "wrestling temporal structure", "UWW model"],
      ["glycolytic_recovery_conflict"],
    ),
  );
}

function sfpLegsMaintenanceBlock(volume = "2-3 упражнения / 2-3 подхода по 20-25 сек / без отказа") {
  return lockedVolumeBlock(
    block(
      "СФП ног поддерживающе",
      "metabolic",
      "legs_lme",
      volume,
      ["ноги", "таз", "корпус"],
      "local maintenance",
      ["Europe plan analysis", "BFR/KAATSU evidence", "Seluyanov coach school"],
      ["heavy_legs_sprint_conflict"],
    ),
  );
}

function gripUpperMaintenanceBlock(volume = "канат/полотенца/тяга: 3 упражнения по 2-3 подхода / без боли") {
  return lockedVolumeBlock(
    block(
      "Руки, верх и хват поддерживающе",
      "strength",
      "arms_grip",
      volume,
      ["предплечья", "плечи", "спина", "контакт"],
      "local strength endurance maintenance",
      ["Europe plan analysis", "grappling transfer evidence", "PERFORM Evidence Matrix"],
    ),
  );
}

function strengthToneBlock(volume = "2 упражнения / 2-3 подхода по 3-5 повторов / RPE 5-6 / без отказа") {
  return lockedVolumeBlock(
    block(
      "Силовой тонус без добора",
      "strength",
      "max_strength",
      volume,
      ["ноги", "корпус", "спина"],
      "strength maintenance",
      ["Europe plan analysis", "strength training evidence", "taper risk control"],
    ),
  );
}

function finishPowerBlock(volume = "4x20/40: резина -> проход -> клинч/давление -> защита/спрол / без дожима") {
  return lockedVolumeBlock(
    block(
      "Финишная мощность в борцовском действии",
      "metabolic",
      "anaerobic_power",
      volume,
      ["ноги", "таз", "контакт", "корпус"],
      "special glycolytic / late-round power",
      ["Europe plan analysis", "technical_under_fatigue", "glycolytic_intervals"],
      ["glycolytic_recovery_conflict"],
    ),
  );
}

function speedActivationBlock(volume = "4-6 коротких включений 10-20 м или вход по сигналу / полный отдых / без развития") {
  return lockedVolumeBlock(
    block(
      "Короткая скоростная активация",
      "activation",
      "taper_quality",
      volume,
      ["ноги", "таз"],
      "alactic activation",
      ["Europe plan analysis", "taper logic", "speed profile"],
    ),
  );
}

function weightRecoveryControlBlock(volume = "вес, сон, пульс покоя, самочувствие, жесткость / 5-10 мин") {
  return lockedVolumeBlock(
    block(
      "Контроль веса и восстановления",
      "recovery",
      "weight_management",
      volume,
      ["общее"],
      "recovery / monitoring",
      ["Europe plan analysis", "NCAA weight management", "sleep consensus"],
    ),
  );
}

function aerobicRecoveryBlock(volume = "20-30 мин Z1-Z2 / разговорный темп / без накопления усталости") {
  return lockedVolumeBlock(
    block(
      "Аэробное восстановление",
      "conditioning",
      "aerobic_base",
      volume,
      ["общее"],
      "aerobic recovery",
      ["Europe plan analysis", "load consensus", "sleep consensus"],
    ),
  );
}

function unloadingProcedureBlock(
  volume = "сауна/массаж/мобилити 20-40 мин по состоянию / без тренировочного добора",
) {
  return lockedVolumeBlock(
    block(
      "Разгрузочные процедуры",
      "recovery",
      "recovery",
      volume,
      ["общее"],
      "recovery / fatigue unloading",
      ["Europe plan analysis", "supercompensation", "recovery consensus"],
    ),
  );
}

function environmentShiftRecoveryBlock(
  volume = "кросс, прогулка, поход, велосипед или бассейн 30-45 мин / смена обстановки / Z1-Z2",
) {
  return lockedVolumeBlock(
    block(
      "Смена обстановки",
      "conditioning",
      "aerobic_base",
      volume,
      ["общее"],
      "psychological recovery / aerobic unloading",
      ["Europe plan analysis", "recovery consensus", "load consensus"],
    ),
  );
}

function europeHalfDay(label: string, stage: ConstructorCalendarStage, slotIndex: number) {
  const isDenseStage = stage === "main_specific_microcycle";
  const isTaperStage = stage === "competition_integration" || stage === "taper_peak" || stage === "start_window";
  const isSaturday = slotIndex >= 5;

  if (isTaperStage) {
    return dayWithSingleSession(
      label,
      isSaturday
        ? "Половинчатая суббота: смена обстановки, вес и восстановление"
        : "Половинчатый день: смена обстановки и восстановление",
      "recovery",
      "без ковра, без борьбы, без второй тренировки",
      [
        environmentShiftRecoveryBlock(
          isSaturday
            ? "прогулка/поход/велосипед 30-40 мин или бассейн / смена обстановки"
            : "кросс Z1-Z2, прогулка, велосипед или бассейн 25-35 мин / не на ковре",
        ),
        weightRecoveryControlBlock(),
        unloadingProcedureBlock("сауна/мобилити/массаж 20-30 мин по состоянию, вес и сон под контролем"),
      ],
    );
  }

  return dayWithSingleSession(
    label,
    isSaturday
      ? "Половинчатая суббота: смена обстановки и сброс усталости"
      : "Половинчатый день после двух рабочих дней: смена обстановки",
    isDenseStage ? "recovery" : "low",
    "без ковра, без борьбы, восстановительные процедуры вместо второй сессии",
    [
      environmentShiftRecoveryBlock(
        isDenseStage
          ? "прогулка/поход/велосипед 30-45 мин Z1-Z2 / психологический сброс после плотности"
          : "кросс, прогулка, поход, велосипед или бассейн 30-40 мин / смена обстановки",
      ),
      weightRecoveryControlBlock(),
      unloadingProcedureBlock(),
    ],
  );
}

function europeEntryBlockDay(label: string, slotIndex: number) {
  const variants = [
    () =>
      dayWithExplicitSessions(
        label,
        "Техника утром, СФП ног вечером",
        "medium",
        "качество техники >= 4/5, ноги без боли",
        [techniqueBaseBlock("30 мин: стойка, входы, защита, партер / без силовой рубки")],
        [sfpLegsMaintenanceBlock(), physicalToWrestlingTransferBlock("legs_lme")],
      ),
    () =>
      dayWithExplicitSessions(
        label,
        "ОФП/аэробная поддержка утром, техника вечером",
        "low",
        "Z1-Z2, без накопления усталости",
        [aerobicRecoveryBlock(), weightRecoveryControlBlock()],
        [techniqueBaseBlock("25-30 мин: входы, выход из захвата, стойка-партер / качество выше объёма")],
      ),
    () =>
      dayWithExplicitSessions(
        label,
        "СФП утром, технический перенос вечером",
        "medium",
        "без отказа, техника после СФП не ниже 4/5",
        [sfpLegsMaintenanceBlock("3 упражнения / 2 подхода по 20 сек / без отказа"), strengthToneBlock()],
        [technicalTempoBlock("20-25 мин: входы после локальной работы + защита/спрол")],
      ),
    () =>
      dayWithExplicitSessions(
        label,
        "Техника и хват",
        "medium",
        "локти/плечи без боли, хват не добивать",
        [techniqueBaseBlock("25-30 мин: захват, позиция, вход из контакта")],
        [gripUpperMaintenanceBlock(), physicalToWrestlingTransferBlock("arms_grip")],
      ),
    () =>
      dayWithExplicitSessions(
        label,
        "Борцовская скорость без развития объёма",
        "medium",
        "полный отдых, качество первого действия",
        [speedActivationBlock("5-6 включений: первый шаг, вход по сигналу / полный отдых")],
        [technicalTempoBlock("20 мин: первое действие -> развитие атаки -> выход из контакта")],
      ),
    () =>
      dayWithExplicitSessions(
        label,
        "Восстановление и лёгкая техника",
        "recovery",
        "снять остаточную усталость, сверить вес и сон",
        [aerobicRecoveryBlock("20-25 мин Z1-Z2 + мобилити")],
        [techniqueBaseBlock("15-20 мин лёгкая техника без сопротивления"), weightRecoveryControlBlock()],
      ),
  ];

  return variants[slotIndex % variants.length]();
}

function europeMainSpecificDay(label: string, slotIndex: number) {
  const variants = [
    () =>
      dayWithExplicitSessions(
        label,
        "СФП/силовой тонус утром, борьба вечером",
        "high",
        "readiness >= 70, сон нормальный, без боли ног",
        [strengthToneBlock("присед/тяга вариант: 2-3x3-5 RPE 6 / без отказа"), sfpLegsMaintenanceBlock()],
        [wrestlingRoundBlock("Борьба в соревновательном темпе", "2 цикла 3 мин + 30 сек + 3 мин / качество входов")],
      ),
    () =>
      dayWithExplicitSessions(
        label,
        "Техника утром, финишная мощность вечером",
        "high",
        "качество стойки не падает, стоп при развале техники",
        [technicalTempoBlock("25 мин: техника в темпе, входы и защита без закисления")],
        [finishPowerBlock(), physicalToWrestlingTransferBlock("anaerobic_power")],
      ),
    () =>
      dayWithExplicitSessions(
        label,
        "Восстановительный контроль внутри плотного блока",
        "low",
        "вес, сон, RHR, жесткость обязательны",
        [aerobicRecoveryBlock("20 мин Z1-Z2 / локальный сброс")],
        [techniqueBaseBlock("20 мин лёгкая техника, стойка-партер без силовой борьбы"), weightRecoveryControlBlock()],
      ),
    () =>
      dayWithExplicitSessions(
        label,
        "Соревновательная структура 2x3",
        "high",
        "readiness >= 70, без активной сгонки",
        [techniqueBaseBlock("20 мин: техническая настройка перед раундами")],
        [wrestlingRoundBlock("2x3 с паузой 30 сек", "2 цикла 3 мин + 30 сек + 3 мин / пауза 4-6 мин")],
      ),
    () =>
      dayWithExplicitSessions(
        label,
        "Турнирная плотность",
        "high",
        "после дня обязателен восстановительный контроль",
        [technicalTempoBlock("20 мин: входы, клинч, защита/спрол")],
        [wrestlingRoundBlock("3 встречи в соревновательном формате", "3 встречи: 3 мин + 30 сек + 3 мин / без лишнего добора")],
      ),
    () =>
      dayWithExplicitSessions(
        label,
        "Сброс после плотной борьбы",
        "recovery",
        "не добавлять объём, восстановить ноги и ЦНС",
        [aerobicRecoveryBlock("20-30 мин Z1-Z2 / прогулка или велосипед")],
        [techniqueBaseBlock("15-20 мин лёгкая техника без сопротивления"), weightRecoveryControlBlock()],
      ),
  ];

  return variants[slotIndex % variants.length]();
}

function europeIntegrationDay(label: string, slotIndex: number) {
  const variants = [
    () =>
      dayWithExplicitSessions(
        label,
        "Лёгкая техника утром, борьба без силовой вечером",
        "low",
        "качество выше объёма, без силовой борьбы",
        [techniqueBaseBlock("25-30 мин: точность входов, защита, партер / RPE <= 4")],
        [wrestlingRoundBlock("Одна встреча без силовой борьбы", "1 встреча 3 мин + 30 сек + 3 мин / скорость и дистанция")],
      ),
    () =>
      dayWithExplicitSessions(
        label,
        "Восстановление утром, тактика вечером",
        "recovery",
        "сон, вес и RHR важнее добора",
        [aerobicRecoveryBlock("20 мин Z1-Z2 + мобилити")],
        [techniqueBaseBlock("20-25 мин: тактические ситуации, выход из захвата"), weightRecoveryControlBlock()],
      ),
    () =>
      dayWithExplicitSessions(
        label,
        "Короткая резкость и технический перенос",
        "taper",
        "полный отдых, без закисления",
        [speedActivationBlock("3-5 коротких включений / первый шаг и вход по сигналу")],
        [
          technicalTempoBlock("15-20 мин: первое действие -> защита -> партер / без добора"),
          weightRecoveryControlBlock(),
        ],
      ),
    () =>
      dayWithExplicitSessions(
        label,
        "Две сессии борьбы без силовой рубки",
        "low",
        "две короткие сессии, не создавать локальный долг",
        [wrestlingRoundBlock("Утренняя встреча без силовой борьбы", "1 встреча 3 мин + 30 сек + 3 мин / дистанция и скорость")],
        [wrestlingRoundBlock("Вечерняя встреча без силовой борьбы", "1 встреча 3 мин + 30 сек + 3 мин / качество входов")],
      ),
    () =>
      dayWithExplicitSessions(
        label,
        "Вес, сон и свежесть",
        "recovery",
        "не добавлять нагрузку при снижении готовности",
        [aerobicRecoveryBlock("15-20 мин Z1 или прогулка")],
        [weightRecoveryControlBlock(), techniqueBaseBlock("10-15 мин лёгкая техника")],
      ),
    () =>
      dayWithExplicitSessions(
        label,
        "Техническая уверенность",
        "low",
        "сохранить ощущение скорости, без добора",
        [techniqueBaseBlock("20-25 мин: любимые атаки, защита, контроль позиции")],
        [speedActivationBlock("2-3 коротких включения / только ощущение резкости"), weightRecoveryControlBlock()],
      ),
  ];

  return variants[slotIndex % variants.length]();
}

function europeTaperPeakDay(label: string, slotIndex: number) {
  const variants = [
    () =>
      dayWithExplicitSessions(
        label,
        "Качество техники и вес",
        "taper",
        "RPE <= 4, вес и сон под контролем",
        [techniqueBaseBlock("20-25 мин техника без утомления / точность"), speedActivationBlock("2-4 включения")],
        [weightRecoveryControlBlock(), aerobicRecoveryBlock("15-20 мин Z1")],
      ),
    () =>
      dayWithExplicitSessions(
        label,
        "Суперкомпенсация без добора",
        "taper",
        "не развивать, только сохранить резкость",
        [speedActivationBlock("3 коротких входа по сигналу / полный отдых")],
        [techniqueBaseBlock("15-20 мин лёгкая техника, стойка-партер"), weightRecoveryControlBlock()],
      ),
    () =>
      dayWithExplicitSessions(
        label,
        "Дорога/режим/восстановление",
        "recovery",
        "учесть дорогу, воду, сон, вес",
        [aerobicRecoveryBlock("прогулка 15-20 мин или мобилити")],
        [weightRecoveryControlBlock("вес, вода, сон, RHR, самочувствие / без тренировки в утомление")],
      ),
    () =>
      dayWithExplicitSessions(
        label,
        "Предстартовая техническая настройка",
        "taper",
        "коротко, уверенно, без силовой борьбы",
        [techniqueBaseBlock("15-20 мин: ключевые входы, защита, выход из контакта")],
        [speedActivationBlock("2-3 включения / ощущение резкости"), weightRecoveryControlBlock()],
      ),
    () =>
      dayWithExplicitSessions(
        label,
        "Тонкая настройка веса и свежести",
        "recovery",
        "не добирать объём, питание и сон важнее",
        [weightRecoveryControlBlock()],
        [techniqueBaseBlock("10-15 мин очень лёгкая техника, если готовность нормальная")],
      ),
  ];

  return variants[slotIndex % variants.length]();
}

function europeStartWindowDay(label: string, slotIndex: number) {
  const variants = [
    () =>
      dayWithExplicitSessions(
        label,
        "Предстартовая активация",
        "taper",
        "очень коротко, без усталости",
        [techniqueBaseBlock("10-15 мин: ключевые действия, стойка, выход из захвата")],
        [speedActivationBlock("2-3 коротких включения / полный отдых"), weightRecoveryControlBlock()],
      ),
    () =>
      dayWithExplicitSessions(
        label,
        "Взвешивание, вес и восстановление",
        "recovery",
        "вес, вода, сон, без тренировочного добора",
        [weightRecoveryControlBlock("вес, вода, самочувствие, RHR / 5-10 мин")],
        [techniqueBaseBlock("5-10 мин лёгкая техника только при хорошей готовности")],
      ),
    () =>
      dayWithExplicitSessions(
        label,
        "Стартовый день",
        "taper",
        "только активация и работа между схватками",
        [speedActivationBlock("предстартовая активация 5-8 мин / без утомления")],
        [
          techniqueBaseBlock("работа между схватками: дыхание, настройка, ключевые действия"),
          weightRecoveryControlBlock("вес, вода, самочувствие, восстановление между схватками"),
        ],
      ),
  ];

  return variants[slotIndex % variants.length]();
}

function europeCompetitionDayForStage(
  stage: ConstructorCalendarStage,
  label: string,
  slotIndex: number,
) {
  if (slotIndex === 2 || /\/\sСБ\s/.test(label)) {
    return europeHalfDay(label, stage, slotIndex);
  }

  switch (stage) {
    case "main_specific_microcycle":
      return europeMainSpecificDay(label, slotIndex);
    case "competition_integration":
      return europeIntegrationDay(label, slotIndex);
    case "taper_peak":
      return europeTaperPeakDay(label, slotIndex);
    case "start_window":
      return europeStartWindowDay(label, slotIndex);
    case "entry_block":
    default:
      return europeEntryBlockDay(label, slotIndex);
  }
}

function europeCompetitionDaysForWeek(
  stage: ConstructorCalendarStage,
  targetDayCount: number,
  labelPool: string[],
) {
  return Array.from({ length: targetDayCount }, (_, index) => {
    const label = labelPool[index] ?? `День ${index + 1}`;
    return europeCompetitionDayForStage(stage, label, index);
  });
}

function normalizeWeekDensity(
  week: ConstructorPlanWeek,
  input: ConstructorInput,
  weekIndex: number,
  weekCount: number,
  goalTypes: ConstructorGoalType[],
) {
  const calendarDaysRemaining = Math.max(1, input.context.cycleLengthDays - weekIndex * 7);
  const calendarDaysInWeek = Math.min(7, calendarDaysRemaining);
  const calendarStage = calendarStageFromWeek(input, weekIndex);
  const phase = phaseForCalendarStage(calendarStage);
  const labelPool = labelPoolForWeek(input, phase, weekIndex, calendarDaysInWeek);
  const rawTargetDayCount = targetSessionsForWeek(input, phase, calendarDaysInWeek);
  const isEuropeCase = isMajorCompetitionConstructorCase(input);
  const targetDayCount = isEuropeCase
    ? Math.min(rawTargetDayCount, Math.max(1, labelPool.length))
    : rawTargetDayCount;
  const europeCaseDays = isEuropeCase
    ? europeCompetitionDaysForWeek(calendarStage, targetDayCount, labelPool)
    : null;
  const days = week.days.slice(0, targetDayCount).map((planDay, index) => ({
    ...clonePlanDay(planDay),
    dayLabel: labelPool[index] ?? planDay.dayLabel,
  }));
  const usedLabels = new Set(days.map((planDay) => planDay.dayLabel));
  let supportIndex = 0;

  while (!isEuropeCase && days.length < targetDayCount) {
    const label = supportDayLabel(labelPool, usedLabels, days.length);
    usedLabels.add(label);
    days.push(clonePlanDay(supportDayForPhase(phase, label, goalTypes, supportIndex)));
    supportIndex += 1;
  }
  const plannedDays = europeCaseDays ?? days;
  const balancedDays = isEuropeCase
    ? plannedDays
    : normalizeDevelopmentWeekBalance(plannedDays, phase, goalTypes);
  const normalizedDays = balancedDays
    .map((planDay) => withCompetitionTaperStructure(planDay, phase))
    .map((planDay) => withTrainingSessionFrame(planDay, phase))
    .map((planDay) =>
      withConstructorDaySessions(planDay, phase, input.context.sessionsPerDay ?? 1),
    );

  return {
    ...week,
    phase,
    title: titleForCalendarStage(week, calendarStage),
    mainIntent: mainIntentForCalendarStage(week, calendarStage),
    days: sortPlanDaysByLabel(normalizedDays, labelPool),
  };
}

function titleForCalendarStage(week: ConstructorPlanWeek, stage: ConstructorCalendarStage) {
  if (stage === "entry_block") {
    return `Неделя ${week.weekNumber}: вход в предсоревновательный блок`;
  }

  if (stage === "main_specific_microcycle") {
    return `Неделя ${week.weekNumber}: основной специальный микроцикл`;
  }

  if (stage === "competition_integration") {
    return `Неделя ${week.weekNumber}: интеграция и снижение объёма`;
  }

  if (stage === "start_window") {
    return `Неделя ${week.weekNumber}: стартовое окно`;
  }

  if (stage === "taper_peak") {
    return `Неделя ${week.weekNumber}: подводка и пик`;
  }

  const phase = phaseForCalendarStage(stage);

  if (phase === week.phase) {
    return week.title;
  }

  if (phase === "recovery") {
    return `Неделя ${week.weekNumber}: восстановление`;
  }

  if (phase === "development") {
    return `Неделя ${week.weekNumber}: развитие качества`;
  }

  return `Неделя ${week.weekNumber}: базовая подготовка`;
}

function mainIntentForCalendarStage(week: ConstructorPlanWeek, stage: ConstructorCalendarStage) {
  if (stage === "entry_block") {
    return "Ввести организм в предсоревновательный блок без резкого перегруза: Z2/ОФП/СФП, сила и хват только с контролем восстановления.";
  }

  if (stage === "main_specific_microcycle") {
    return "Дать главный специальный стимул: борьба, 2x3, контактная плотность, финишная способность и перенос силы в борьбу под ежедневным контролем.";
  }

  if (stage === "competition_integration") {
    return "Перевести работу в соревновательную свежесть: меньше объёма, больше качества техники, восстановление, вес, сон и готовность.";
  }

  if (stage === "taper_peak") {
    return "Снять остаточную усталость, вывести организм в пик, сохранить короткую резкость, вес, сон и уверенность перед стартом.";
  }

  if (stage === "start_window") {
    return "Сохранить свежесть, вес, сон и уверенность в ключевых технических действиях без добора нагрузки.";
  }

  const phase = phaseForCalendarStage(stage);

  if (phase === week.phase) {
    return week.mainIntent;
  }

  if (phase === "recovery") {
    return "Снять накопленную усталость и вернуть готовность.";
  }

  if (phase === "development") {
    return "Развить выбранные качества с контролем восстановления и исходных тестов.";
  }

  return "Подготовить базу для дальнейшего развития качеств.";
}

function buildFallbackWeek(
  input: ConstructorInput,
  weekNumber: number,
  phase: ConstructorPhase,
): ConstructorPlanWeek {
  return {
    weekNumber,
    title:
      phase === "taper"
        ? `Неделя ${weekNumber}: подводка к старту`
        : `Неделя ${weekNumber}: рабочая структура`,
    phase,
    mainIntent:
      phase === "taper"
        ? "Сохранить скорость, свежесть, вес и качество без добора объёма."
        : "Заполнить неделю рабочими днями под выбранные цели и текущие ограничения.",
    days: [],
  };
}

function mergeWeeks(
  cards: ConstructorTemplateCard[],
  input: ConstructorInput,
  goalTypes: ConstructorGoalType[],
) {
  const weeks: ConstructorPlanWeek[] = [];
  const weekCount = Math.max(1, Math.ceil(input.context.cycleLengthDays / 7));

  for (let weekIndex = 0; weekIndex < weekCount; weekIndex += 1) {
    const calendarPhase = weekPhaseFromCalendar(input, input.context.currentPhase, weekIndex);
    const sourceWeek = pickSourceWeekForPhase(cards, calendarPhase, weekIndex);
    const week = sourceWeek
      ? {
          ...sourceWeek,
          weekNumber: weekIndex + 1,
      }
      : buildFallbackWeek(input, weekIndex + 1, calendarPhase);

    weeks.push(normalizeWeekDensity(week, input, weekIndex, weekCount, goalTypes));
  }

  return weeks;
}

function pickSourceWeekForPhase(
  cards: ConstructorTemplateCard[],
  phase: ConstructorPhase,
  weekIndex: number,
) {
  const sourceWeeks = cards.flatMap((card) => card.weeks);
  const phaseWeeks = sourceWeeks.filter((week) => {
    if (phase === "taper" || phase === "start_window") {
      return week.phase === "taper";
    }

    if (phase === "recovery") {
      return week.phase === "recovery";
    }

    if (phase === "base") {
      return week.phase === "base" || week.phase === "development";
    }

    if (phase === "development") {
      return week.phase === "development" || week.phase === "special_preparation";
    }

    return week.phase === "special_preparation" || week.phase === "development";
  });

  if (phaseWeeks.length > 0) {
    return phaseWeeks[weekIndex % phaseWeeks.length];
  }

  if (phase === "taper" || phase === "start_window" || phase === "recovery") {
    return undefined;
  }

  return sourceWeeks[weekIndex % Math.max(1, sourceWeeks.length)];
}

function applySeasonStrategyToConstructorInput(input: ConstructorInput): ConstructorInput {
  const snapshot = input.seasonStrategy;

  if (!snapshot) {
    return input;
  }

  const mandatoryGoals = snapshot.constructorRules.mandatoryFocus.filter(isConstructorGoalType);
  const currentGoals = input.goals
    .sort((left, right) => left.priority - right.priority)
    .map((goal) => goal.goalType);
  const mergedGoalTypes = [
    ...mandatoryGoals,
    ...currentGoals.filter((goalType) => !mandatoryGoals.includes(goalType)),
  ];
  const goals =
    mergedGoalTypes.length > 0
      ? mergedGoalTypes.map((goalType, index) => {
          const existing = input.goals.find((goal) => goal.goalType === goalType);

          return {
            goalType,
            priority: index + 1,
            mode: existing?.mode,
            reason:
              existing?.reason ??
              (mandatoryGoals.includes(goalType)
                ? "добавлено стратегией сезона и календарём стартов"
                : null),
          };
        })
      : input.goals;
  const cycleLengthDays = Math.max(
    1,
    Math.round(snapshot.currentWindow.cycleLengthDays || input.context.cycleLengthDays),
  );

  return {
    ...input,
    context: {
      ...input.context,
      currentPhase: snapshot.currentWindow.phase,
      cycleLengthDays,
    },
    goals,
  };
}

export function buildPerformConstructorDraft(input: ConstructorInput): ConstructorDraft {
  const seasonAdjustedInput = applySeasonStrategyToConstructorInput(input);
  const effectivePhase = normalizePhaseForCycle(seasonAdjustedInput);
  const effectiveInput =
    effectivePhase === seasonAdjustedInput.context.currentPhase
      ? seasonAdjustedInput
      : {
          ...seasonAdjustedInput,
          context: {
            ...seasonAdjustedInput.context,
            currentPhase: effectivePhase,
          },
        };
  const requestedGoalTypes = [...seasonAdjustedInput.goals]
    .sort((a, b) => a.priority - b.priority)
    .map((item) => item.goalType);
  const goalTypes = defaultGoalTypesForCompetitionCase(
    effectiveInput,
    requestedGoalTypes.length > 0 ? requestedGoalTypes : [primaryGoal(seasonAdjustedInput)],
  );
  const planningInput = isMajorCompetitionConstructorCase(effectiveInput)
    ? {
        ...effectiveInput,
        goals: goalsFromTypes(goalTypes, effectiveInput),
      }
    : effectiveInput;
  const missingData = collectMissingData(planningInput);
  const riskFlags = collectRiskFlags(planningInput, missingData);
  const confidence = deriveConfidence(missingData, riskFlags);
  const goal = goalTypes[0] ?? primaryGoal(planningInput);
  const selectedCards = selectTemplateCards(planningInput, riskFlags);
  const weeks = mergeWeeks(selectedCards, planningInput, goalTypes.length > 0 ? goalTypes : [goal]);
  const weightGap = Number((planningInput.athlete.weightCurrentKg - planningInput.athlete.weightTargetKg).toFixed(1));
  const focusPlan = buildCompetitionFocusPlan(planningInput, goalTypes);
  const riskText = riskFlags.length
    ? riskFlags.map((risk) => risk.message).join(" ")
    : "Критичных ограничений по введённым данным нет.";

  return {
    confidence,
    understood: {
      mainTask: buildUnderstoodMainTask(planningInput, goal),
      interpretation: buildUnderstoodInterpretation(
        planningInput,
        confidence,
        focusPlan,
        missingData,
        riskFlags,
        goal,
        effectivePhase,
      ),
      limitation: buildUnderstoodLimitation(planningInput, missingData, weightGap, confidence),
    },
    focusPlan,
    missingData,
    riskFlags,
    selectedCards: selectedCards.map((card) => ({
      id: card.id,
      title: card.title,
      rationale: card.rationale,
    })),
    plan: {
      cycleLengthDays: planningInput.context.cycleLengthDays,
      sessionsPerDay: Math.max(1, Math.min(2, Math.round(planningInput.context.sessionsPerDay ?? 1))),
      weeks,
    },
    explanation: {
      mainDecision: buildMainDecisionText(planningInput, goal, effectivePhase),
      whyNow: buildWhyNowText(planningInput, effectivePhase),
      testsImpact:
        missingData.length > 0
          ? `Не хватает данных: ${missingData.map((item) => item.code).join(", ")}. Уверенность снижена.`
          : "Ключевые тесты под выбранные цели есть, план можно строить увереннее.",
      riskImpact: riskText,
      evidenceSummary: selectedCards
        .flatMap((card) => card.operationalEvidenceTypes)
        .filter((value, index, values) => values.indexOf(value) === index)
        .join(", "),
      coachCanEdit: [
        "цели и приоритеты",
        "длительность цикла",
        "объём каждого блока",
        "расположение дней",
        "общий комментарий",
        "замены при риске",
      ],
    },
    seasonStrategy: planningInput.seasonStrategy ?? null,
  };
}

export function buildConstructorTemplatePayload(
  draft: ConstructorDraft,
  name = "PERFORM Constructor Draft",
) {
  return {
    name,
    description: draft.explanation.mainDecision,
    sportType: "wrestling",
    phaseFocus: null,
    competitionPriorityFocus: null,
    templateGoal: draft.understood.mainTask,
    microcycleType: "constructor-draft",
    competitionSpecific: true,
    blocks: [],
    days: draft.plan.weeks.flatMap((week) =>
      week.days.map((planDay, index) => ({
        label: `${week.title} / ${planDay.dayLabel}`,
        notes: `${planDay.dayIntent}. ${planDay.readinessGate}`,
        orderIndex: (week.weekNumber - 1) * 7 + index,
        sessions: (planDay.sessions?.length
          ? planDay.sessions
          : [
              {
                name: planDay.dayIntent,
                notes: planDay.readinessGate,
                orderIndex: 0,
                blocks: planDay.blocks,
              },
            ]).map((session, sessionIndex) => ({
            name: session.name,
            notes: session.notes,
            orderIndex: session.orderIndex ?? sessionIndex,
            executionMode: "by_blocks" as const,
            deviceLinkMode: "block" as const,
            blocks: session.blocks.map((planBlock) => ({
              name: planBlock.name,
              rowKind: "exercise" as const,
              blockType: planBlock.type,
              blockPriority: planDay.loadLevel === "high" ? 4 : 2,
              isMandatory: planDay.loadLevel !== "recovery",
              removePriorityYellow: 3,
              removePriorityRed: 5,
              reductionPercentYellow: 20,
              reductionPercentRed: 50,
              targetDurationMinutes: null,
              targetRpe:
                planDay.loadLevel === "high"
                  ? 8
                  : planDay.loadLevel === "medium"
                    ? 6
                    : planDay.loadLevel === "low" || planDay.loadLevel === "taper"
                      ? 4
                      : 2,
              targetSets: null,
              targetReps: null,
              notes: `${planBlock.volume}. ${planBlock.energySystem}. Evidence: ${planBlock.evidenceRefs.join(", ")}`,
              exercises: planBlock.exercises ?? [],
            })),
          })),
      })),
    ),
  };
}
