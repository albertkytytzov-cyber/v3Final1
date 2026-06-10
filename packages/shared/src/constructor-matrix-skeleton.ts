import type { ConstructorInput, ConstructorPhase, ConstructorRiskCode } from "./constructor-core";
import type {
  ConstructorBlockEligibilityRule,
  ConstructorCompetitionRole,
  ConstructorDayType,
  ConstructorMatrixContext,
  ConstructorMatrixLoadLevel,
  ConstructorPreparationPhase,
  ConstructorRecoveryPriority,
  ConstructorSessionSlot,
  ConstructorTrainingBlockDefinition,
  ConstructorTrainingBlockType,
  ConstructorWeekType,
} from "./constructor-matrix";
import {
  CONSTRUCTOR_DAY_MATRIX_RULES,
  CONSTRUCTOR_TEMPLATE_CARD_COMPATIBILITY,
  CONSTRUCTOR_TRAINING_BLOCK_LIBRARY,
  CONSTRUCTOR_WEEK_MATRIX_RULES,
  explainBlockEligibility,
  getAllowedSessionSlots,
  getDayTypeForContext,
  getForbiddenBlockReasons,
  getWeekTypeForContext,
  isTrainingBlockAllowed,
} from "./constructor-matrix";

export interface MatrixDrivenSkeletonContext {
  competitionRole?: ConstructorCompetitionRole | null;
  isMainStart?: boolean;
  daysUntilStart: number | null;
  cycleLengthDays?: number | null;
  preparationPhase?: ConstructorPreparationPhase | null;
  constructorPhase?: ConstructorPhase | null;
  startDate?: string | null;
  weighInDate?: string | null;
  travelRequired?: boolean;
}

export interface MatrixDrivenSkeletonWarning {
  code:
    | "skeleton_only"
    | "fixed_templates_not_controlling"
    | "close_main_start"
    | "travel_day"
    | "weigh_in_day"
    | "post_competition"
    | "missing_start_context";
  message: string;
}

export interface MatrixDrivenSkeletonExplanation {
  level: "plan" | "week" | "day" | "session" | "block";
  code:
    | "matrix_source"
    | "phase"
    | "competition_role"
    | "week_type"
    | "day_type"
    | "session_slot"
    | "allowed_blocks"
    | "forbidden_blocks"
    | "compatibility_sources"
    | "risk";
  message: string;
}

export interface MatrixDrivenBlockCandidate {
  blockType: ConstructorTrainingBlockType;
  label: string;
  allowed: boolean;
  reasons: ConstructorBlockEligibilityRule[];
  riskTags: ConstructorRiskCode[];
  sourceCompatibilityCards: string[];
}

export interface MatrixDrivenSessionSkeleton {
  slot: ConstructorSessionSlot;
  allowedBlockTypes: ConstructorTrainingBlockType[];
  preferredBlockTypes: ConstructorTrainingBlockType[];
  forbiddenBlockTypes: ConstructorTrainingBlockType[];
  riskTags: ConstructorRiskCode[];
  blockCandidates: MatrixDrivenBlockCandidate[];
  explanations: MatrixDrivenSkeletonExplanation[];
}

export interface MatrixDrivenDaySkeleton {
  dayNumber: number;
  dayType: ConstructorDayType;
  daysUntilStart: number | null;
  date: string | null;
  isTravelDay: boolean;
  isWeighInDay: boolean;
  isCompetitionDay: boolean;
  isPostCompetitionDay: boolean;
  allowedSessionSlots: ConstructorSessionSlot[];
  sessions: MatrixDrivenSessionSkeleton[];
  forbiddenBlockReasons: ConstructorBlockEligibilityRule[];
  explanations: MatrixDrivenSkeletonExplanation[];
}

export interface MatrixDrivenWeekSkeleton {
  weekNumber: number;
  weekType: ConstructorWeekType;
  phase: ConstructorPreparationPhase;
  daysUntilStartRange: {
    from: number | null;
    to: number | null;
  };
  loadLevel: ConstructorMatrixLoadLevel;
  matVolumeLevel: ConstructorMatrixLoadLevel;
  canDevelopQualities: boolean;
  recoveryPriority: ConstructorRecoveryPriority;
  days: MatrixDrivenDaySkeleton[];
  explanations: MatrixDrivenSkeletonExplanation[];
}

export interface MatrixDrivenPlanSkeleton {
  generatedFrom: "matrix";
  competitionRole: ConstructorCompetitionRole | null;
  isMainStart: boolean;
  daysUntilStart: number | null;
  preparationPhase: ConstructorPreparationPhase;
  weeks: MatrixDrivenWeekSkeleton[];
  warnings: MatrixDrivenSkeletonWarning[];
  explanations: MatrixDrivenSkeletonExplanation[];
}

interface NormalizedSkeletonInput {
  competitionRole: ConstructorCompetitionRole | null;
  isMainStart: boolean;
  daysUntilStart: number | null;
  cycleLengthDays: number;
  preparationPhase: ConstructorPreparationPhase;
  constructorPhase: ConstructorPhase | null;
  startDate: string | null;
  weighInDate: string | null;
  travelRequired: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function isConstructorInput(input: ConstructorInput | MatrixDrivenSkeletonContext): input is ConstructorInput {
  return Boolean((input as ConstructorInput).competition && (input as ConstructorInput).context);
}

function clampPositiveInteger(value: number | null | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.round(value));
}

function parseDateInput(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return null;
  }

  const parsed = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateInput(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null;
}

function shiftDate(date: Date | null, days: number) {
  return date ? new Date(date.getTime() + days * DAY_MS) : null;
}

function inferCompetitionRoleFromInput(input: ConstructorInput): ConstructorCompetitionRole | null {
  const strategyRole = input.seasonStrategy?.targetCompetition.role ?? null;

  if (strategyRole) {
    return strategyRole;
  }

  if (
    input.competition.priority === "A" ||
    ["continental", "world", "olympics"].includes(input.competition.level)
  ) {
    return "main_peak";
  }

  if (input.competition.priority === "B") {
    return "secondary_peak";
  }

  return "control_start";
}

function constructorPhaseToPreparationPhase(
  constructorPhase: ConstructorPhase | null | undefined,
  daysUntilStart: number | null,
  role: ConstructorCompetitionRole | null,
  isMainStart: boolean,
): ConstructorPreparationPhase {
  if (daysUntilStart !== null && daysUntilStart < 0) {
    return "transition_recovery";
  }

  if (daysUntilStart !== null && daysUntilStart <= 4) {
    return "competition";
  }

  if (daysUntilStart !== null && daysUntilStart <= 14) {
    return "direct_pre_competition";
  }

  if (isMainStart && daysUntilStart !== null && daysUntilStart <= 30) {
    return "special_pre_competition";
  }

  if (role === "main_peak" && constructorPhase === "special_preparation") {
    return "special_preparation";
  }

  switch (constructorPhase) {
    case "base":
    case "development":
      return daysUntilStart !== null && daysUntilStart > 60 ? "general_preparation" : "special_preparation";
    case "special_preparation":
      return "special_preparation";
    case "taper":
      return "direct_pre_competition";
    case "start_window":
      return "competition";
    case "recovery":
      return "transition_recovery";
    default:
      return "special_preparation";
  }
}

function normalizeSkeletonInput(input: ConstructorInput | MatrixDrivenSkeletonContext): NormalizedSkeletonInput {
  if (!isConstructorInput(input)) {
    const role = input.competitionRole ?? null;
    const isMainStart = input.isMainStart ?? role === "main_peak";
    const daysUntilStart = typeof input.daysUntilStart === "number" ? Math.round(input.daysUntilStart) : null;
    const constructorPhase = input.constructorPhase ?? null;
    const preparationPhase =
      input.preparationPhase ??
      constructorPhaseToPreparationPhase(constructorPhase, daysUntilStart, role, isMainStart);

    return {
      competitionRole: role,
      isMainStart,
      daysUntilStart,
      cycleLengthDays: clampPositiveInteger(input.cycleLengthDays, daysUntilStart !== null && daysUntilStart > 0 ? daysUntilStart : 1),
      preparationPhase,
      constructorPhase,
      startDate: input.startDate ?? null,
      weighInDate: input.weighInDate ?? null,
      travelRequired: input.travelRequired ?? false,
    };
  }

  const role = inferCompetitionRoleFromInput(input);
  const isMainStart =
    role === "main_peak" ||
    input.competition.priority === "A" ||
    ["continental", "world", "olympics"].includes(input.competition.level);
  const daysUntilStart =
    typeof input.seasonStrategy?.currentWindow.daysToStart === "number"
      ? Math.round(input.seasonStrategy.currentWindow.daysToStart)
      : clampPositiveInteger(input.context.cycleLengthDays, 1);
  const constructorPhase = input.seasonStrategy?.currentWindow.phase ?? input.context.currentPhase;
  const preparationPhase = constructorPhaseToPreparationPhase(constructorPhase, daysUntilStart, role, isMainStart);

  return {
    competitionRole: role,
    isMainStart,
    daysUntilStart,
    cycleLengthDays: clampPositiveInteger(
      input.seasonStrategy?.currentWindow.cycleLengthDays ?? input.context.cycleLengthDays,
      daysUntilStart > 0 ? daysUntilStart : 1,
    ),
    preparationPhase,
    constructorPhase,
    startDate: input.competition.startDate,
    weighInDate: input.competition.weighInDate,
    travelRequired: input.competition.travelRequired || input.constraints?.travelFatigue === true,
  };
}

export function getDaysUntilStartForSkeletonDay(
  planDaysUntilStart: number | null,
  dayIndex: number,
) {
  if (planDaysUntilStart === null) {
    return null;
  }

  if (planDaysUntilStart <= 0) {
    return dayIndex === 0 ? planDaysUntilStart : planDaysUntilStart - dayIndex;
  }

  return Math.max(0, planDaysUntilStart - dayIndex);
}

export function getWeekDayRange(days: MatrixDrivenDaySkeleton[]) {
  const values = days
    .map((day) => day.daysUntilStart)
    .filter((value): value is number => typeof value === "number");

  if (values.length === 0) {
    return { from: null, to: null };
  }

  return {
    from: Math.max(...values),
    to: Math.min(...values),
  };
}

function isSameDate(left: string | null, right: string | null) {
  return Boolean(left && right && left === right);
}

function getSkeletonDate(input: NormalizedSkeletonInput, daysUntilStart: number | null) {
  const startDate = parseDateInput(input.startDate);

  if (!startDate || daysUntilStart === null) {
    return null;
  }

  return formatDateInput(shiftDate(startDate, -daysUntilStart));
}

function isWeighInDay(input: NormalizedSkeletonInput, daysUntilStart: number | null, date: string | null) {
  if (isSameDate(date, input.weighInDate)) {
    return true;
  }

  return input.isMainStart && daysUntilStart === 1;
}

function isTravelDay(input: NormalizedSkeletonInput, daysUntilStart: number | null) {
  return input.travelRequired && daysUntilStart === 2;
}

function getPreparationPhaseForSkeletonDay(
  input: NormalizedSkeletonInput,
  daysUntilStart: number | null,
) {
  if (daysUntilStart !== null && daysUntilStart < 0) {
    return "transition_recovery";
  }

  if (daysUntilStart !== null && daysUntilStart <= 4) {
    return "competition";
  }

  if (daysUntilStart !== null && daysUntilStart <= 14) {
    return "direct_pre_competition";
  }

  if (input.isMainStart && daysUntilStart !== null && daysUntilStart <= 30) {
    return "special_pre_competition";
  }

  return input.preparationPhase;
}

function getSkeletonDayType(
  context: ConstructorMatrixContext,
  dayIndexInWeek: number,
): ConstructorDayType {
  if (context.isPostCompetitionDay) {
    return "post_competition";
  }

  if (context.isCompetitionDay) {
    return "competition";
  }

  if (context.isWeighInDay) {
    return "weigh_in";
  }

  if (context.isTravelDay) {
    return "travel";
  }

  if (context.weekType === "pre_competition" || context.weekType === "special") {
    if (dayIndexInWeek === 2 || dayIndexInWeek === 5) {
      return "half_day";
    }

    if (dayIndexInWeek === 1 || dayIndexInWeek === 4) {
      return "technical";
    }

    return dayIndexInWeek === 3 ? "spp_day" : "competition_model";
  }

  if (context.weekType === "taper") {
    return dayIndexInWeek === 2 || dayIndexInWeek === 5 ? "recovery" : "light_training";
  }

  if (context.weekType === "competition") {
    return "light_training";
  }

  if (context.weekType === "recovery" || context.weekType === "post_competition") {
    return "post_competition";
  }

  if (context.weekType === "travel_logistics") {
    return "travel";
  }

  if (context.weekType === "development") {
    if (dayIndexInWeek === 0) {
      return "heavy_training";
    }

    if (dayIndexInWeek === 2 || dayIndexInWeek === 5) {
      return "half_day";
    }

    if (dayIndexInWeek === 4) {
      return "gpp_day";
    }
  }

  return getDayTypeForContext(context);
}

export function buildSkeletonContextForDay(params: {
  input: NormalizedSkeletonInput;
  daysUntilStart: number | null;
  dayIndexInWeek: number;
  date: string | null;
}): ConstructorMatrixContext {
  const phase = getPreparationPhaseForSkeletonDay(params.input, params.daysUntilStart);
  const baseContext: ConstructorMatrixContext = {
    preparationPhase: phase,
    competitionRole: params.input.competitionRole,
    daysUntilStart: params.daysUntilStart,
    isMainStart: params.input.isMainStart,
    isTravelDay: isTravelDay(params.input, params.daysUntilStart),
    isWeighInDay: isWeighInDay(params.input, params.daysUntilStart, params.date),
    isCompetitionDay: params.daysUntilStart === 0,
    isPostCompetitionDay: params.daysUntilStart !== null && params.daysUntilStart < 0,
  };
  const weekType = getWeekTypeForContext(baseContext);

  return {
    ...baseContext,
    weekType,
    dayType: getSkeletonDayType({ ...baseContext, weekType }, params.dayIndexInWeek),
  };
}

export function buildSkeletonContextForSession(
  context: ConstructorMatrixContext,
  slot: ConstructorSessionSlot,
): ConstructorMatrixContext {
  return {
    ...context,
    sessionSlot: slot,
  };
}

export function getPreferredBlockTypesForDayType(dayType: ConstructorDayType): ConstructorTrainingBlockType[] {
  const preferred: Record<ConstructorDayType, ConstructorTrainingBlockType[]> = {
    heavy_training: ["leg_lmv", "mat_control_bouts", "mat_technique", "spp", "recovery"],
    medium_training: ["mat_technique", "spp", "first_action_speed", "recovery"],
    light_training: ["mat_light_technical", "first_action_speed", "mobility", "recovery"],
    technical: ["mat_technique", "mat_tactics", "mat_light_technical", "first_action_speed", "recovery"],
    competition_model: ["mat_competition_model", "mat_control_bouts", "mat_technique", "recovery"],
    mat_day: ["mat_technique", "mat_tactics", "mat_light_technical", "recovery"],
    spp_day: ["spp", "first_action_speed", "mobility", "recovery"],
    gpp_day: ["gpp", "aerobic_deload", "mobility", "recovery"],
    half_day: ["aerobic_deload", "mobility", "recovery", "mat_light_technical"],
    environment_change: ["environment_change", "aerobic_deload", "mobility", "recovery"],
    recovery: ["recovery", "mobility"],
    sauna_recovery: ["sauna", "recovery", "mobility"],
    travel: ["travel", "mobility", "recovery"],
    weigh_in: ["weigh_in", "mat_light_technical", "mobility", "recovery"],
    competition: ["competition_start", "mobility", "recovery"],
    post_competition: ["post_competition_recovery", "recovery", "mobility", "aerobic_deload"],
  };

  return preferred[dayType];
}

export function getForbiddenBlockTypesForDayType(
  dayType: ConstructorDayType,
  context?: ConstructorMatrixContext,
): ConstructorTrainingBlockType[] {
  const matrixContext: ConstructorMatrixContext =
    context ?? {
      preparationPhase: "special_preparation",
      weekType: "maintenance",
      dayType,
      sessionSlot: "morning",
      isMainStart: false,
    };

  return CONSTRUCTOR_TRAINING_BLOCK_LIBRARY.filter(
    (block) => !isTrainingBlockAllowed(block, { ...matrixContext, dayType }),
  ).map((block) => block.type);
}

function sourceCardsForBlock(blockType: ConstructorTrainingBlockType) {
  return CONSTRUCTOR_TEMPLATE_CARD_COMPATIBILITY.filter((item) =>
    item.trainingBlockTypes.includes(blockType),
  ).map((item) => item.cardId);
}

function uniqueRiskTags(blocks: ConstructorTrainingBlockDefinition[]) {
  return Array.from(new Set(blocks.flatMap((block) => block.riskTags)));
}

function blockCandidateForContext(
  block: ConstructorTrainingBlockDefinition,
  context: ConstructorMatrixContext,
): MatrixDrivenBlockCandidate {
  const reasons = getForbiddenBlockReasons(block, context);

  return {
    blockType: block.type,
    label: block.label,
    allowed: reasons.length === 0,
    reasons,
    riskTags: block.riskTags,
    sourceCompatibilityCards: sourceCardsForBlock(block.type),
  };
}

function getSkeletonExplanations(params: {
  level: MatrixDrivenSkeletonExplanation["level"];
  context: ConstructorMatrixContext;
  weekType?: ConstructorWeekType;
  dayType?: ConstructorDayType;
  allowedCount?: number;
}): MatrixDrivenSkeletonExplanation[] {
  const explanations: MatrixDrivenSkeletonExplanation[] = [];

  if (params.level === "plan") {
    explanations.push({
      level: "plan",
      code: "matrix_source",
      message: "Скелет построен матрицей phase/week/day/session/block; fixed templates не выбирают структуру.",
    });
  }

  if (params.weekType) {
    const weekRule = CONSTRUCTOR_WEEK_MATRIX_RULES.find((rule) => rule.weekType === params.weekType);
    explanations.push({
      level: params.level,
      code: "week_type",
      message: weekRule
        ? `${params.weekType}: ${weekRule.explanation}`
        : `Тип недели ${params.weekType} выбран матрицей.`,
    });
  }

  if (params.dayType) {
    const dayRule = CONSTRUCTOR_DAY_MATRIX_RULES.find((rule) => rule.dayType === params.dayType);
    explanations.push({
      level: params.level,
      code: "day_type",
      message: dayRule
        ? `${params.dayType}: ${dayRule.explanation}`
        : `Тип дня ${params.dayType} выбран матрицей.`,
    });
  }

  if (typeof params.allowedCount === "number") {
    explanations.push({
      level: params.level,
      code: "allowed_blocks",
      message: `Разрешённых кандидатов блоков: ${params.allowedCount}. Запреты рассчитаны через eligibility rules.`,
    });
  }

  if (
    params.context.isMainStart &&
    typeof params.context.daysUntilStart === "number" &&
    params.context.daysUntilStart <= 30
  ) {
    explanations.push({
      level: params.level,
      code: "phase",
      message: "Главный старт ближе 30 дней: развитие запрещено, структура строится через поддержание, перенос, активацию и восстановление.",
    });
  }

  if (params.context.isTravelDay) {
    explanations.push({
      level: params.level,
      code: "risk",
      message: "День дороги снижает потолок нагрузки.",
    });
  }

  if (params.context.isWeighInDay) {
    explanations.push({
      level: params.level,
      code: "risk",
      message: "День взвешивания подчинён весу, воде, питанию и свежести.",
    });
  }

  if (params.context.isPostCompetitionDay) {
    explanations.push({
      level: params.level,
      code: "risk",
      message: "После старта приоритет восстановление и анализ.",
    });
  }

  return explanations;
}

function getSkeletonWarnings(input: NormalizedSkeletonInput): MatrixDrivenSkeletonWarning[] {
  const warnings: MatrixDrivenSkeletonWarning[] = [
    {
      code: "skeleton_only",
      message: "Это matrix-driven skeleton: он не выбирает упражнения и не заменяет текущий mergeWeeks.",
    },
    {
      code: "fixed_templates_not_controlling",
      message: "Fixed template cards используются только как metadata источников блоков.",
    },
  ];

  if (input.daysUntilStart === null) {
    warnings.push({
      code: "missing_start_context",
      message: "Нет точного количества дней до старта; skeleton использует длину цикла как безопасный fallback.",
    });
  }

  if (input.isMainStart && input.daysUntilStart !== null && input.daysUntilStart <= 30) {
    warnings.push({
      code: "close_main_start",
      message: "Главный старт ближе 30 дней: development-блоки должны быть запрещены.",
    });
  }

  if (input.travelRequired) {
    warnings.push({
      code: "travel_day",
      message: "В skeleton будет выделен день дороги при наличии D-2.",
    });
  }

  if (input.weighInDate || input.isMainStart) {
    warnings.push({
      code: "weigh_in_day",
      message: "Skeleton выделяет день взвешивания по дате или D-1 для главного старта.",
    });
  }

  if (input.daysUntilStart !== null && input.daysUntilStart < 0) {
    warnings.push({
      code: "post_competition",
      message: "Старт уже прошёл: skeleton переводит структуру в восстановление.",
    });
  }

  return warnings;
}

function buildSessionSkeleton(
  dayContext: ConstructorMatrixContext,
  slot: ConstructorSessionSlot,
): MatrixDrivenSessionSkeleton {
  const context = buildSkeletonContextForSession(dayContext, slot);
  const candidates = CONSTRUCTOR_TRAINING_BLOCK_LIBRARY.map((block) =>
    blockCandidateForContext(block, context),
  );
  const allowedCandidates = candidates.filter((candidate) => candidate.allowed);
  const allowedBlocks = allowedCandidates
    .map((candidate) => CONSTRUCTOR_TRAINING_BLOCK_LIBRARY.find((block) => block.type === candidate.blockType))
    .filter((block): block is ConstructorTrainingBlockDefinition => Boolean(block));
  const preferredSet = new Set(getPreferredBlockTypesForDayType(dayContext.dayType ?? "medium_training"));
  const preferredBlockTypes = allowedCandidates
    .map((candidate) => candidate.blockType)
    .filter((blockType) => preferredSet.has(blockType));

  return {
    slot,
    allowedBlockTypes: allowedCandidates.map((candidate) => candidate.blockType),
    preferredBlockTypes,
    forbiddenBlockTypes: candidates
      .filter((candidate) => !candidate.allowed)
      .map((candidate) => candidate.blockType),
    riskTags: uniqueRiskTags(allowedBlocks),
    blockCandidates: candidates,
    explanations: [
      ...getSkeletonExplanations({
        level: "session",
        context,
        dayType: dayContext.dayType ?? undefined,
        allowedCount: allowedCandidates.length,
      }),
      {
        level: "session",
        code: "compatibility_sources",
        message: "sourceCompatibilityCards показывают, какие старые карточки могут дать контент, но не структуру.",
      },
    ],
  };
}

function buildDaySkeleton(params: {
  input: NormalizedSkeletonInput;
  dayIndex: number;
  dayIndexInWeek: number;
}): MatrixDrivenDaySkeleton {
  const daysUntilStart = getDaysUntilStartForSkeletonDay(params.input.daysUntilStart, params.dayIndex);
  const date = getSkeletonDate(params.input, daysUntilStart);
  const dayContext = buildSkeletonContextForDay({
    input: params.input,
    daysUntilStart,
    dayIndexInWeek: params.dayIndexInWeek,
    date,
  });
  const allowedSessionSlots = getAllowedSessionSlots(dayContext);
  const sessions = allowedSessionSlots.map((slot) => buildSessionSkeleton(dayContext, slot));
  const forbiddenBlockReasons = sessions
    .flatMap((session) => session.blockCandidates)
    .filter((candidate) => !candidate.allowed)
    .flatMap((candidate) => candidate.reasons);

  return {
    dayNumber: params.dayIndex + 1,
    dayType: dayContext.dayType ?? "medium_training",
    daysUntilStart,
    date,
    isTravelDay: dayContext.isTravelDay === true,
    isWeighInDay: dayContext.isWeighInDay === true,
    isCompetitionDay: dayContext.isCompetitionDay === true,
    isPostCompetitionDay: dayContext.isPostCompetitionDay === true,
    allowedSessionSlots,
    sessions,
    forbiddenBlockReasons,
    explanations: getSkeletonExplanations({
      level: "day",
      context: dayContext,
      weekType: dayContext.weekType ?? undefined,
      dayType: dayContext.dayType ?? undefined,
    }),
  };
}

function buildWeekSkeleton(params: {
  input: NormalizedSkeletonInput;
  weekNumber: number;
  startDayIndex: number;
  dayCount: number;
}): MatrixDrivenWeekSkeleton {
  const days = Array.from({ length: params.dayCount }, (_, index) =>
    buildDaySkeleton({
      input: params.input,
      dayIndex: params.startDayIndex + index,
      dayIndexInWeek: index,
    }),
  );
  const firstDay = days[0];
  const phase = firstDay
    ? getPreparationPhaseForSkeletonDay(params.input, firstDay.daysUntilStart)
    : params.input.preparationPhase;
  const weekType = firstDay
    ? getWeekTypeForContext({
        preparationPhase: phase,
        competitionRole: params.input.competitionRole,
        daysUntilStart: firstDay.daysUntilStart,
        isMainStart: params.input.isMainStart,
        isTravelDay: firstDay.isTravelDay,
        isWeighInDay: firstDay.isWeighInDay,
        isCompetitionDay: firstDay.isCompetitionDay,
        isPostCompetitionDay: firstDay.isPostCompetitionDay,
      })
    : getWeekTypeForContext({
        preparationPhase: phase,
        competitionRole: params.input.competitionRole,
        daysUntilStart: params.input.daysUntilStart,
        isMainStart: params.input.isMainStart,
      });
  const weekRule = CONSTRUCTOR_WEEK_MATRIX_RULES.find((rule) => rule.weekType === weekType);

  return {
    weekNumber: params.weekNumber,
    weekType,
    phase,
    daysUntilStartRange: getWeekDayRange(days),
    loadLevel: weekRule?.loadLevel ?? "medium",
    matVolumeLevel: weekRule?.matVolumeLevel ?? "medium",
    canDevelopQualities: weekRule?.canDevelopQualities ?? false,
    recoveryPriority: weekRule?.recoveryPriority ?? "mandatory",
    days,
    explanations: getSkeletonExplanations({
      level: "week",
      context: {
        preparationPhase: phase,
        competitionRole: params.input.competitionRole,
        daysUntilStart: firstDay?.daysUntilStart ?? params.input.daysUntilStart,
        weekType,
        isMainStart: params.input.isMainStart,
      },
      weekType,
    }),
  };
}

export function buildMatrixDrivenWeekSkeleton(
  input: ConstructorInput | MatrixDrivenSkeletonContext,
): MatrixDrivenPlanSkeleton {
  const normalizedInput = normalizeSkeletonInput(input);
  const totalDays = normalizedInput.daysUntilStart !== null && normalizedInput.daysUntilStart <= 0
    ? 1
    : normalizedInput.cycleLengthDays;
  const weekCount = Math.max(1, Math.ceil(totalDays / 7));
  const weeks = Array.from({ length: weekCount }, (_, index) =>
    buildWeekSkeleton({
      input: normalizedInput,
      weekNumber: index + 1,
      startDayIndex: index * 7,
      dayCount: Math.min(7, totalDays - index * 7),
    }),
  );

  return {
    generatedFrom: "matrix",
    competitionRole: normalizedInput.competitionRole,
    isMainStart: normalizedInput.isMainStart,
    daysUntilStart: normalizedInput.daysUntilStart,
    preparationPhase: normalizedInput.preparationPhase,
    weeks,
    warnings: getSkeletonWarnings(normalizedInput),
    explanations: getSkeletonExplanations({
      level: "plan",
      context: {
        preparationPhase: normalizedInput.preparationPhase,
        competitionRole: normalizedInput.competitionRole,
        daysUntilStart: normalizedInput.daysUntilStart,
        isMainStart: normalizedInput.isMainStart,
      },
    }),
  };
}
