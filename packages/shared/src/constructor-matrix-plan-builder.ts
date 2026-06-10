import type { ConstructorInput, ConstructorRiskCode } from "./constructor-core";
import type {
  ConstructorDayType,
  ConstructorMatrixLoadLevel,
  ConstructorPreparationPhase,
  ConstructorRecoveryPriority,
  ConstructorSessionSlot,
  ConstructorTrainingBlockDefinition,
  ConstructorTrainingBlockType,
  ConstructorWeekType,
} from "./constructor-matrix";
import {
  CONSTRUCTOR_TRAINING_BLOCK_LIBRARY,
  getTrainingBlockDefinition,
} from "./constructor-matrix";
import type {
  MatrixDrivenDaySkeleton,
  MatrixDrivenPlanSkeleton,
  MatrixDrivenSessionSkeleton,
  MatrixDrivenWeekSkeleton,
} from "./constructor-matrix-skeleton";
import { buildMatrixDrivenWeekSkeleton } from "./constructor-matrix-skeleton";

export type MatrixDrivenBuilderMode = "skeleton_only" | "draft";
export type MatrixDrivenExplanationDepth = "short" | "normal" | "detailed";
export type MatrixDrivenLoadLevel = "very_low" | "low" | "medium" | "high";
export type MatrixDrivenIntensityLevel = "recovery" | "light" | "moderate" | "high";
export type MatrixDrivenMatVolume = "none" | "low" | "medium" | "high";
export type MatrixDrivenDensity =
  | "single_session"
  | "split_day"
  | "half_day"
  | "recovery_only";
export type MatrixDrivenRiskSeverity = "info" | "warning" | "error";

export type MatrixDrivenRiskCode =
  | "main_start_development_forbidden"
  | "heavy_lmv_too_close_to_start"
  | "heavy_strength_too_close_to_start"
  | "excessive_mat_volume_near_start"
  | "control_bouts_too_close_to_start"
  | "heavy_load_on_travel_day"
  | "heavy_load_on_weigh_in_day"
  | "taper_mixed_with_development"
  | "competition_day_training_load"
  | "post_competition_development_load"
  | "legacy_template_used_as_structure";

export interface MatrixDrivenBuilderOptions {
  mode?: MatrixDrivenBuilderMode;
  useLegacyCardsAsContentLibrary?: boolean;
  includeForbiddenCandidates?: boolean;
  explanationDepth?: MatrixDrivenExplanationDepth;
}

export interface MatrixDrivenVolumePrescription {
  loadLevel: MatrixDrivenLoadLevel;
  intensityLevel: MatrixDrivenIntensityLevel;
  durationMinutes: {
    min: number;
    max: number;
    target: number;
  };
  matVolume: MatrixDrivenMatVolume;
  density: MatrixDrivenDensity;
  recoveryPriority: ConstructorRecoveryPriority;
  explanation: string;
}

export interface MatrixDrivenRiskCheckResult {
  code: MatrixDrivenRiskCode;
  severity: MatrixDrivenRiskSeverity;
  message: string;
  affected: {
    weekNumber?: number;
    dayNumber?: number;
    sessionSlot?: ConstructorSessionSlot;
    blockType?: ConstructorTrainingBlockType;
  };
  replacementBlockType?: ConstructorTrainingBlockType;
  action: "selected" | "rejected" | "removed" | "replace_hint" | "info";
  explanation: string;
}

export interface MatrixDrivenExplanation {
  level: "plan" | "week" | "day" | "session" | "block";
  code:
    | "strategy"
    | "phase"
    | "week_type"
    | "day_type"
    | "session_mix"
    | "block_selection"
    | "volume"
    | "risk"
    | "legacy_cards";
  message: string;
}

export interface MatrixDrivenSelectedBlock {
  blockType: ConstructorTrainingBlockType;
  label: string;
  sourceCompatibilityCards: string[];
  targetQuality: ConstructorTrainingBlockDefinition["targetQuality"];
  blockTypeCategory: ConstructorTrainingBlockDefinition["blockType"];
  loadLevel: ConstructorMatrixLoadLevel;
  matVolumeLevel: ConstructorMatrixLoadLevel;
  riskTags: ConstructorRiskCode[];
  volume: MatrixDrivenVolumePrescription;
  selectedBecause: string[];
  explanations: MatrixDrivenExplanation[];
}

export interface MatrixDrivenPlanSession {
  slot: ConstructorSessionSlot;
  selectedBlocks: MatrixDrivenSelectedBlock[];
  rejectedBlockTypes: ConstructorTrainingBlockType[];
  volume: MatrixDrivenVolumePrescription;
  riskChecks: MatrixDrivenRiskCheckResult[];
  explanations: MatrixDrivenExplanation[];
}

export interface MatrixDrivenPlanDay {
  dayNumber: number;
  date: string | null;
  daysUntilStart: number | null;
  dayType: ConstructorDayType;
  flags: {
    travel: boolean;
    weighIn: boolean;
    competition: boolean;
    postCompetition: boolean;
  };
  sessions: MatrixDrivenPlanSession[];
  volume: MatrixDrivenVolumePrescription;
  riskChecks: MatrixDrivenRiskCheckResult[];
  explanations: MatrixDrivenExplanation[];
}

export interface MatrixDrivenPlanWeek {
  weekNumber: number;
  weekType: ConstructorWeekType;
  phase: ConstructorPreparationPhase;
  daysUntilStartRange: MatrixDrivenWeekSkeleton["daysUntilStartRange"];
  loadLevel: ConstructorMatrixLoadLevel;
  matVolumeLevel: ConstructorMatrixLoadLevel;
  recoveryPriority: ConstructorRecoveryPriority;
  days: MatrixDrivenPlanDay[];
  volume: MatrixDrivenVolumePrescription;
  riskChecks: MatrixDrivenRiskCheckResult[];
  explanations: MatrixDrivenExplanation[];
}

export interface MatrixDrivenPlanDraft {
  generatedFrom: "matrix";
  mode: MatrixDrivenBuilderMode;
  skeleton: MatrixDrivenPlanSkeleton;
  competitionRole: MatrixDrivenPlanSkeleton["competitionRole"];
  isMainStart: boolean;
  daysUntilStart: number | null;
  preparationPhase: ConstructorPreparationPhase;
  weeks: MatrixDrivenPlanWeek[];
  riskChecks: MatrixDrivenRiskCheckResult[];
  explanations: MatrixDrivenExplanation[];
  warnings: MatrixDrivenPlanSkeleton["warnings"];
  legacyCards: {
    usedAsStructure: false;
    useAsContentLibrary: boolean;
    sourceCompatibilityCards: string[];
  };
}

const DEFAULT_OPTIONS: Required<MatrixDrivenBuilderOptions> = {
  mode: "draft",
  useLegacyCardsAsContentLibrary: true,
  includeForbiddenCandidates: false,
  explanationDepth: "normal",
};

function normalizeOptions(options?: MatrixDrivenBuilderOptions): Required<MatrixDrivenBuilderOptions> {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
  };
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function loadToDraftLevel(load: ConstructorMatrixLoadLevel): MatrixDrivenLoadLevel {
  if (load === "none") {
    return "very_low";
  }

  return load;
}

function intensityForContext(params: {
  block?: ConstructorTrainingBlockDefinition | null;
  dayType?: ConstructorDayType;
  loadLevel: MatrixDrivenLoadLevel;
  recoveryPriority: ConstructorRecoveryPriority;
}): MatrixDrivenIntensityLevel {
  if (params.recoveryPriority === "primary") {
    return "recovery";
  }

  if (params.block?.type === "competition_start") {
    return "high";
  }

  if (params.loadLevel === "very_low" || params.loadLevel === "low") {
    return "light";
  }

  if (params.loadLevel === "high" && params.dayType !== "competition") {
    return "high";
  }

  return "moderate";
}

function densityForSessionCount(sessionCount: number, recoveryPriority: ConstructorRecoveryPriority): MatrixDrivenDensity {
  if (recoveryPriority === "primary") {
    return "recovery_only";
  }

  if (sessionCount >= 2) {
    return "split_day";
  }

  return "single_session";
}

function durationForLoad(params: {
  loadLevel: MatrixDrivenLoadLevel;
  dayType?: ConstructorDayType;
  block?: ConstructorTrainingBlockDefinition | null;
}) {
  if (params.block?.type === "competition_start") {
    return { min: 0, max: 0, target: 0 };
  }

  if (params.dayType === "travel" || params.dayType === "weigh_in") {
    return { min: 10, max: 25, target: 15 };
  }

  if (params.dayType === "competition") {
    return { min: 5, max: 15, target: 10 };
  }

  if (params.dayType === "post_competition") {
    return { min: 20, max: 35, target: 25 };
  }

  switch (params.loadLevel) {
    case "high":
      return { min: 50, max: 90, target: 70 };
    case "medium":
      return { min: 35, max: 65, target: 50 };
    case "low":
      return { min: 20, max: 45, target: 30 };
    default:
      return { min: 10, max: 30, target: 20 };
  }
}

export function applyMatrixDrivenVolumeRules(params: {
  week?: MatrixDrivenWeekSkeleton;
  day?: MatrixDrivenDaySkeleton;
  session?: MatrixDrivenSessionSkeleton;
  block?: ConstructorTrainingBlockDefinition | null;
}): MatrixDrivenVolumePrescription {
  const recoveryPriority =
    params.week?.recoveryPriority ??
    (params.day?.isPostCompetitionDay || params.day?.isTravelDay || params.day?.isWeighInDay
      ? "primary"
      : "mandatory");
  const baseLoad =
    params.block?.loadLevel ??
    params.week?.loadLevel ??
    "medium";
  let loadLevel = loadToDraftLevel(baseLoad);
  const dayType = params.day?.dayType;
  let matVolume = params.block?.matVolumeLevel ?? params.week?.matVolumeLevel ?? "medium";

  if (
    dayType === "travel" ||
    dayType === "weigh_in" ||
    dayType === "post_competition" ||
    recoveryPriority === "primary"
  ) {
    loadLevel = "very_low";
    matVolume = matVolume === "high" ? "low" : matVolume;
  }

  if (dayType === "competition" && params.block?.type === "competition_start") {
    loadLevel = "very_low";
    matVolume = "none";
  }

  const durationMinutes = durationForLoad({
    loadLevel,
    dayType,
    block: params.block,
  });
  const density = params.day
    ? densityForSessionCount(params.day.sessions.length, recoveryPriority)
    : "single_session";
  const intensityLevel = intensityForContext({
    block: params.block,
    dayType,
    loadLevel,
    recoveryPriority,
  });

  return {
    loadLevel,
    intensityLevel,
    durationMinutes,
    matVolume,
    density: dayType === "half_day" ? "half_day" : density,
    recoveryPriority,
    explanation:
      "Начальные объёмы консервативные: они задают уровень блока, а не финальный список упражнений.",
  };
}

function planPreferredOrderForDay(dayType: ConstructorDayType): ConstructorTrainingBlockType[] {
  if (dayType === "heavy_training") {
    return ["leg_lmv", "mat_control_bouts", "mat_technique", "spp", "recovery"];
  }

  if (dayType === "medium_training") {
    return ["mat_technique", "spp", "first_action_speed", "recovery"];
  }

  if (dayType === "gpp_day") {
    return ["gpp", "aerobic_deload", "mobility", "recovery"];
  }

  if (dayType === "competition_model") {
    return ["mat_competition_model", "mat_control_bouts", "mat_technique", "recovery"];
  }

  if (dayType === "light_training" || dayType === "technical") {
    return ["mat_light_technical", "first_action_speed", "mat_tactics", "mobility", "recovery"];
  }

  if (dayType === "travel") {
    return ["mobility", "recovery", "travel", "aerobic_deload"];
  }

  if (dayType === "weigh_in") {
    return ["weigh_in", "mobility", "recovery", "mat_light_technical"];
  }

  if (dayType === "post_competition") {
    return ["post_competition_recovery", "recovery", "mobility", "aerobic_deload"];
  }

  return [];
}

function blockPriority(
  blockType: ConstructorTrainingBlockType,
  session: MatrixDrivenSessionSkeleton,
  day: MatrixDrivenDaySkeleton,
) {
  const planPreferred = planPreferredOrderForDay(day.dayType);
  const planPreferredIndex = planPreferred.indexOf(blockType);

  if (planPreferredIndex >= 0) {
    return planPreferredIndex;
  }

  const preferredIndex = session.preferredBlockTypes.indexOf(blockType);

  if (preferredIndex >= 0) {
    return preferredIndex;
  }

  return 100 + session.allowedBlockTypes.indexOf(blockType);
}

function wantedBlockCount(day: MatrixDrivenDaySkeleton, session: MatrixDrivenSessionSkeleton) {
  if (day.isCompetitionDay || day.isTravelDay || day.isWeighInDay || day.isPostCompetitionDay) {
    return 1;
  }

  if (day.dayType === "recovery" || day.dayType === "half_day") {
    return 1;
  }

  return session.slot === "evening" ? 1 : 2;
}

export function selectMatrixDrivenBlocksForSession(params: {
  week: MatrixDrivenWeekSkeleton;
  day: MatrixDrivenDaySkeleton;
  session: MatrixDrivenSessionSkeleton;
  options?: MatrixDrivenBuilderOptions;
}): MatrixDrivenSelectedBlock[] {
  const options = normalizeOptions(params.options);
  const allowed = params.session.blockCandidates
    .filter((candidate) => candidate.allowed)
    .filter((candidate) => options.includeForbiddenCandidates || !params.session.forbiddenBlockTypes.includes(candidate.blockType))
    .sort((left, right) =>
      blockPriority(left.blockType, params.session, params.day) -
      blockPriority(right.blockType, params.session, params.day),
    );
  const selectedTypes: ConstructorTrainingBlockType[] = [];
  const maxBlocks = wantedBlockCount(params.day, params.session);

  for (const candidate of allowed) {
    if (selectedTypes.length >= maxBlocks) {
      break;
    }

    const block = getTrainingBlockDefinition(candidate.blockType);

    if (!block) {
      continue;
    }

    const conflictsWithSelected = selectedTypes.some((selectedType) => {
      const selectedBlock = getTrainingBlockDefinition(selectedType);

      return (
        selectedBlock?.forbiddenCombinations.includes(block.type) ||
        block.forbiddenCombinations.includes(selectedType)
      );
    });

    if (!conflictsWithSelected) {
      selectedTypes.push(candidate.blockType);
    }
  }

  if (selectedTypes.length === 0 && params.session.allowedBlockTypes.length > 0) {
    selectedTypes.push(params.session.allowedBlockTypes[0]);
  }

  return selectedTypes
    .map((blockType) => {
      const block = getTrainingBlockDefinition(blockType);

      if (!block) {
        return null;
      }

      const candidate = params.session.blockCandidates.find((item) => item.blockType === blockType);
      const volume = applyMatrixDrivenVolumeRules({
        week: params.week,
        day: params.day,
        session: params.session,
        block,
      });

      return {
        blockType,
        label: block.label,
        sourceCompatibilityCards: options.useLegacyCardsAsContentLibrary
          ? candidate?.sourceCompatibilityCards ?? []
          : [],
        targetQuality: block.targetQuality,
        blockTypeCategory: block.blockType,
        loadLevel: block.loadLevel,
        matVolumeLevel: block.matVolumeLevel,
        riskTags: block.riskTags,
        volume,
        selectedBecause: [
          `day_type=${params.day.dayType}`,
          `week_type=${params.week.weekType}`,
          `slot=${params.session.slot}`,
          candidate?.sourceCompatibilityCards.length
            ? "legacy card is metadata/content source only"
            : "native matrix block",
        ],
        explanations: [
          {
            level: "block",
            code: "block_selection",
            message: `${block.label}: выбран матрицей для ${params.day.dayType}/${params.session.slot}. ${block.explanation}`,
          },
          {
            level: "block",
            code: "volume",
            message: `${block.label}: объём ${volume.loadLevel}, интенсивность ${volume.intensityLevel}, ${volume.durationMinutes.target} мин target.`,
          },
        ],
      };
    })
    .filter((block): block is MatrixDrivenSelectedBlock => Boolean(block));
}

function riskCodeForRejectedBlock(
  block: ConstructorTrainingBlockDefinition,
  day: MatrixDrivenDaySkeleton,
): MatrixDrivenRiskCode | null {
  if (block.developsQuality && day.daysUntilStart !== null && day.daysUntilStart <= 30) {
    return "main_start_development_forbidden";
  }

  if (block.usesHeavyLegLmv) {
    return "heavy_lmv_too_close_to_start";
  }

  if (block.usesHeavyStrength) {
    return "heavy_strength_too_close_to_start";
  }

  if (block.usesControlBouts) {
    return "control_bouts_too_close_to_start";
  }

  if (block.matVolumeLevel === "high") {
    return "excessive_mat_volume_near_start";
  }

  if (day.isTravelDay) {
    return "heavy_load_on_travel_day";
  }

  if (day.isWeighInDay) {
    return "heavy_load_on_weigh_in_day";
  }

  if (day.dayType === "post_competition" && block.developsQuality) {
    return "post_competition_development_load";
  }

  return null;
}

function riskCodeForSelectedBlock(
  block: MatrixDrivenSelectedBlock,
  day: MatrixDrivenDaySkeleton,
): MatrixDrivenRiskCode | null {
  if (day.dayType === "competition" && block.blockType !== "competition_start") {
    return "competition_day_training_load";
  }

  if (day.dayType === "post_competition" && block.loadLevel === "high") {
    return "post_competition_development_load";
  }

  if ((day.dayType === "travel" || day.dayType === "weigh_in") && block.volume.loadLevel !== "very_low") {
    return day.dayType === "travel" ? "heavy_load_on_travel_day" : "heavy_load_on_weigh_in_day";
  }

  return null;
}

export function applyMatrixDrivenRiskChecks(params: {
  week: MatrixDrivenWeekSkeleton;
  day: MatrixDrivenDaySkeleton;
  session: MatrixDrivenSessionSkeleton;
  selectedBlocks: MatrixDrivenSelectedBlock[];
}): MatrixDrivenRiskCheckResult[] {
  const results: MatrixDrivenRiskCheckResult[] = [];

  for (const block of params.selectedBlocks) {
    const riskCode = riskCodeForSelectedBlock(block, params.day);

    if (riskCode) {
      results.push({
        code: riskCode,
        severity: "error",
        message: `${block.label}: выбранный блок конфликтует с типом дня ${params.day.dayType}.`,
        affected: {
          weekNumber: params.week.weekNumber,
          dayNumber: params.day.dayNumber,
          sessionSlot: params.session.slot,
          blockType: block.blockType,
        },
        action: "removed",
        explanation: "Risk check не должен пропускать тренировочную нагрузку там, где день подчинён логистике, старту или восстановлению.",
      });
    }
  }

  for (const candidate of params.session.blockCandidates.filter((item) => !item.allowed)) {
    const block = getTrainingBlockDefinition(candidate.blockType);

    if (!block) {
      continue;
    }

    const riskCode = riskCodeForRejectedBlock(block, params.day);

    if (!riskCode) {
      continue;
    }

    results.push({
      code: riskCode,
      severity: "warning",
      message: `${block.label}: не выбран. ${candidate.reasons.map((reason) => reason.message).join(" ")}`,
      affected: {
        weekNumber: params.week.weekNumber,
        dayNumber: params.day.dayNumber,
        sessionSlot: params.session.slot,
        blockType: candidate.blockType,
      },
      replacementBlockType: candidate.reasons.find((reason) => reason.replacementBlockType)?.replacementBlockType,
      action: "rejected",
      explanation: "Блок остался в rejected candidates и не попал в тренировочный draft.",
    });
  }

  return results;
}

export function buildMatrixDrivenPlanExplanations(params: {
  skeleton: MatrixDrivenPlanSkeleton;
  weeks?: MatrixDrivenPlanWeek[];
  options?: MatrixDrivenBuilderOptions;
}): MatrixDrivenExplanation[] {
  const options = normalizeOptions(params.options);
  const base: MatrixDrivenExplanation[] = [
    {
      level: "plan",
      code: "strategy",
      message: `Matrix-driven draft: старт role=${params.skeleton.competitionRole ?? "unknown"}, D-${params.skeleton.daysUntilStart ?? "?"}, phase=${params.skeleton.preparationPhase}.`,
    },
    {
      level: "plan",
      code: "legacy_cards",
      message: "Старые карточки используются только как compatibility/content metadata; структура недель и дней собрана матрицей.",
    },
  ];

  if (params.skeleton.isMainStart && params.skeleton.daysUntilStart !== null && params.skeleton.daysUntilStart <= 30) {
    base.push({
      level: "plan",
      code: "phase",
      message: "Главный старт ближе 30 дней: развитие запрещено, остаются перенос, активация, контроль веса и восстановление.",
    });
  }

  if (options.explanationDepth === "detailed" && params.weeks) {
    base.push(
      ...params.weeks.map((week) => ({
        level: "week" as const,
        code: "week_type" as const,
        message: `Неделя ${week.weekNumber}: ${week.weekType}, load=${week.volume.loadLevel}, mat=${week.volume.matVolume}, recovery=${week.recoveryPriority}.`,
      })),
    );
  }

  return base;
}

export function buildMatrixDrivenSessionFromSkeleton(params: {
  week: MatrixDrivenWeekSkeleton;
  day: MatrixDrivenDaySkeleton;
  session: MatrixDrivenSessionSkeleton;
  options?: MatrixDrivenBuilderOptions;
}): MatrixDrivenPlanSession {
  const selectedBlocks = selectMatrixDrivenBlocksForSession(params);
  const riskChecks = applyMatrixDrivenRiskChecks({
    week: params.week,
    day: params.day,
    session: params.session,
    selectedBlocks,
  });
  const volume = applyMatrixDrivenVolumeRules({
    week: params.week,
    day: params.day,
    session: params.session,
    block: selectedBlocks[0] ? getTrainingBlockDefinition(selectedBlocks[0].blockType) : null,
  });

  return {
    slot: params.session.slot,
    selectedBlocks,
    rejectedBlockTypes: params.session.blockCandidates
      .filter((candidate) => !candidate.allowed)
      .map((candidate) => candidate.blockType),
    volume,
    riskChecks,
    explanations: [
      {
        level: "session",
        code: "session_mix",
        message: `${params.session.slot}: выбрано ${selectedBlocks.length} блок(а) из matrix allowed candidates.`,
      },
      ...selectedBlocks.flatMap((block) => block.explanations),
    ],
  };
}

export function buildMatrixDrivenDayFromSkeleton(params: {
  week: MatrixDrivenWeekSkeleton;
  day: MatrixDrivenDaySkeleton;
  options?: MatrixDrivenBuilderOptions;
}): MatrixDrivenPlanDay {
  const sessions = params.day.sessions.map((session) =>
    buildMatrixDrivenSessionFromSkeleton({
      week: params.week,
      day: params.day,
      session,
      options: params.options,
    }),
  );
  const riskChecks = sessions.flatMap((session) => session.riskChecks);
  const volume = applyMatrixDrivenVolumeRules({
    week: params.week,
    day: params.day,
  });

  return {
    dayNumber: params.day.dayNumber,
    date: params.day.date,
    daysUntilStart: params.day.daysUntilStart,
    dayType: params.day.dayType,
    flags: {
      travel: params.day.isTravelDay,
      weighIn: params.day.isWeighInDay,
      competition: params.day.isCompetitionDay,
      postCompetition: params.day.isPostCompetitionDay,
    },
    sessions,
    volume,
    riskChecks,
    explanations: [
      {
        level: "day",
        code: "day_type",
        message: `День ${params.day.dayNumber}: ${params.day.dayType}; слоты ${params.day.allowedSessionSlots.join(", ")}.`,
      },
      ...sessions.flatMap((session) => session.explanations),
    ],
  };
}

export function buildMatrixDrivenWeeksFromSkeleton(
  input: ConstructorInput,
  skeleton: MatrixDrivenPlanSkeleton,
  options?: MatrixDrivenBuilderOptions,
): MatrixDrivenPlanWeek[] {
  void input;

  return skeleton.weeks.map((week) => {
    const days = week.days.map((day) =>
      buildMatrixDrivenDayFromSkeleton({
        week,
        day,
        options,
      }),
    );
    const riskChecks = days.flatMap((day) => day.riskChecks);
    const volume = applyMatrixDrivenVolumeRules({ week });

    return {
      weekNumber: week.weekNumber,
      weekType: week.weekType,
      phase: week.phase,
      daysUntilStartRange: week.daysUntilStartRange,
      loadLevel: week.loadLevel,
      matVolumeLevel: week.matVolumeLevel,
      recoveryPriority: week.recoveryPriority,
      days,
      volume,
      riskChecks,
      explanations: [
        {
          level: "week",
          code: "week_type",
          message: `Неделя ${week.weekNumber}: ${week.weekType}; load=${week.loadLevel}; mat=${week.matVolumeLevel}.`,
        },
        ...days.flatMap((day) => day.explanations),
      ],
    };
  });
}

export function buildMatrixDrivenPlanDraft(
  input: ConstructorInput,
  options?: MatrixDrivenBuilderOptions,
): MatrixDrivenPlanDraft {
  const normalizedOptions = normalizeOptions(options);
  const skeleton = buildMatrixDrivenWeekSkeleton(input);
  const weeks =
    normalizedOptions.mode === "skeleton_only"
      ? []
      : buildMatrixDrivenWeeksFromSkeleton(input, skeleton, normalizedOptions);
  const riskChecks = weeks.flatMap((week) => week.riskChecks);
  const explanations = buildMatrixDrivenPlanExplanations({
    skeleton,
    weeks,
    options: normalizedOptions,
  });
  const sourceCompatibilityCards = unique(
    weeks.flatMap((week) =>
      week.days.flatMap((day) =>
        day.sessions.flatMap((session) =>
          session.selectedBlocks.flatMap((block) => block.sourceCompatibilityCards),
        ),
      ),
    ),
  );

  return {
    generatedFrom: "matrix",
    mode: normalizedOptions.mode,
    skeleton,
    competitionRole: skeleton.competitionRole,
    isMainStart: skeleton.isMainStart,
    daysUntilStart: skeleton.daysUntilStart,
    preparationPhase: skeleton.preparationPhase,
    weeks,
    riskChecks,
    explanations,
    warnings: skeleton.warnings,
    legacyCards: {
      usedAsStructure: false,
      useAsContentLibrary: normalizedOptions.useLegacyCardsAsContentLibrary,
      sourceCompatibilityCards,
    },
  };
}
