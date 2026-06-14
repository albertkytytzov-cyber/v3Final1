import type {
  ConstructorBlockType,
  ConstructorConfidence,
  ConstructorDraft,
  ConstructorGoalInput,
  ConstructorGoalMode,
  ConstructorGoalType,
  ConstructorInput,
  ConstructorLoadLevel,
  ConstructorMissingData,
  ConstructorPhase,
  ConstructorPlanBlock,
  ConstructorPlanDay,
  ConstructorPlanExercise,
  ConstructorPlanSession,
  ConstructorPlanWeek,
  ConstructorRiskCode,
  ConstructorRiskFlag,
} from "./constructor-core";
import type {
  ConstructorDayType,
  ConstructorMatrixLoadLevel,
  ConstructorPreparationPhase,
  ConstructorTrainingBlockType,
} from "./constructor-matrix";
import { getConstructorMatrixEvidenceDependencies } from "./constructor-matrix-evidence";
import type {
  MatrixDrivenBuilderOptions,
  MatrixDrivenPlanDay,
  MatrixDrivenPlanDraft,
  MatrixDrivenPlanSession,
  MatrixDrivenPlanWeek,
  MatrixDrivenRiskCheckResult,
  MatrixDrivenSelectedBlock,
} from "./constructor-matrix-plan-builder";
import { buildMatrixDrivenPlanDraft } from "./constructor-matrix-plan-builder";
import {
  buildConstructorMatrixRuntimeEligibilitySummary,
  CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY,
  type ConstructorMatrixRuntimeEligibilityId,
  type ConstructorMatrixRuntimeEligibilitySummary,
} from "./constructor-matrix-runtime-eligibility";
import { buildConstructorMatrixAthleteContextRequirementSummary } from "./constructor-matrix-athlete-context-requirements";
import {
  buildConstructorMatrixExerciseLibrarySummary,
} from "./constructor-matrix-exercise-library";
import {
  buildConstructorMatrixExerciseResolverSummary,
  resolveConstructorMatrixExercisesForBlock,
  type ConstructorMatrixResolvedExercise,
} from "./constructor-matrix-exercise-resolver";
import { buildConstructorMatrixNutritionGuidanceSummary } from "./constructor-matrix-nutrition-guidance";
import { buildConstructorMatrixWeightManagementGuidanceSummary } from "./constructor-matrix-weight-management-guidance";

export interface MatrixDrivenAiRuntimeMetadata {
  generatedFrom: "ai_reviewed_runtime_eligibility";
  metadataOnly: true;
  summary: ConstructorMatrixRuntimeEligibilitySummary;
  softWarningEligibilityIds: readonly ConstructorMatrixRuntimeEligibilityId[];
  planStructureHintEligibilityIds: readonly ConstructorMatrixRuntimeEligibilityId[];
  fallbackGuardEligibilityIds: readonly ConstructorMatrixRuntimeEligibilityId[];
  blockedHighRiskEligibilityIds: readonly ConstructorMatrixRuntimeEligibilityId[];
  reviewRequiredEligibilityIds: readonly ConstructorMatrixRuntimeEligibilityId[];
  runtimeHardGatesEnabled: false;
  highRiskAutomationEnabled: false;
  numericThresholdRuntimeGatesEnabled: false;
  medicalDecisionAutomationEnabled: false;
  humanReviewed: false;
}

export interface MatrixDrivenConstructorDraft extends ConstructorDraft {
  generatedFrom: "matrix";
  matrix: {
    draft: MatrixDrivenPlanDraft;
    riskChecks: MatrixDrivenRiskCheckResult[];
    explanationCount: number;
    legacyCards: MatrixDrivenPlanDraft["legacyCards"];
    aiRuntime: MatrixDrivenAiRuntimeMetadata;
    fullContent: {
      exerciseLibrary: ReturnType<typeof buildConstructorMatrixExerciseLibrarySummary>;
      exerciseResolver: ReturnType<typeof buildConstructorMatrixExerciseResolverSummary>;
      athleteContextRequirements: ReturnType<typeof buildConstructorMatrixAthleteContextRequirementSummary>;
      nutritionGuidance: ReturnType<typeof buildConstructorMatrixNutritionGuidanceSummary>;
      weightManagementGuidance: ReturnType<typeof buildConstructorMatrixWeightManagementGuidanceSummary>;
      metadataOnly: true;
      humanReviewed: false;
      highRiskAutomationEnabled: false;
    };
  };
}

function preparationPhaseToConstructorPhase(phase: ConstructorPreparationPhase): ConstructorPhase {
  switch (phase) {
    case "general_preparation":
      return "base";
    case "special_preparation":
    case "special_pre_competition":
      return "special_preparation";
    case "direct_pre_competition":
    case "taper":
      return "taper";
    case "competition":
      return "start_window";
    case "transition_recovery":
      return "recovery";
    default:
      return "special_preparation";
  }
}

function matrixLoadToConstructorLoad(load: MatrixDrivenSelectedBlock["volume"]["loadLevel"]): ConstructorLoadLevel {
  switch (load) {
    case "high":
      return "high";
    case "medium":
      return "medium";
    case "very_low":
    case "low":
      return "low";
    default:
      return "medium";
  }
}

function dayLoadToConstructorLoad(day: MatrixDrivenPlanDay): ConstructorLoadLevel {
  if (
    day.dayType === "post_competition" ||
    day.dayType === "recovery" ||
    day.volume.recoveryPriority === "primary"
  ) {
    return "recovery";
  }

  if (
    day.dayType === "travel" ||
    day.dayType === "weigh_in" ||
    day.dayType === "competition" ||
    day.volume.loadLevel === "very_low"
  ) {
    return "taper";
  }

  return matrixLoadToConstructorLoad(day.volume.loadLevel);
}

function riskCheckToConstructorRiskCode(risk: MatrixDrivenRiskCheckResult): ConstructorRiskCode {
  switch (risk.code) {
    case "heavy_lmv_too_close_to_start":
    case "heavy_strength_too_close_to_start":
      return "heavy_legs_sprint_conflict";
    case "heavy_load_on_travel_day":
      return "travel_fatigue";
    case "heavy_load_on_weigh_in_day":
      return "weight_gap";
    case "control_bouts_too_close_to_start":
    case "excessive_mat_volume_near_start":
    case "taper_mixed_with_development":
    case "competition_day_training_load":
    case "main_start_development_forbidden":
      return "competition_close";
    case "post_competition_development_load":
      return "glycolytic_recovery_conflict";
    case "legacy_template_used_as_structure":
      return "missing_key_tests";
    default:
      return "competition_close";
  }
}

function riskCheckToConstructorRiskFlag(risk: MatrixDrivenRiskCheckResult): ConstructorRiskFlag {
  return {
    code: riskCheckToConstructorRiskCode(risk),
    level: risk.severity === "error" ? "critical" : risk.severity,
    message: matrixRiskMessageForCoach(risk),
  };
}

function matrixLoadLabel(value: ConstructorMatrixLoadLevel | MatrixDrivenSelectedBlock["volume"]["loadLevel"]) {
  const labels: Record<string, string> = {
    very_low: "очень лёгкая",
    low: "лёгкая",
    medium: "средняя",
    high: "высокая",
  };

  return labels[value] ?? String(value);
}

function matrixIntensityLabel(value: MatrixDrivenPlanSession["volume"]["intensityLevel"]) {
  const labels: Record<string, string> = {
    recovery: "восстановительная",
    light: "лёгкая",
    moderate: "умеренная",
    high: "высокая",
  };

  return labels[value] ?? String(value);
}

function matrixMatVolumeLabel(value: MatrixDrivenPlanWeek["volume"]["matVolume"]) {
  const labels: Record<string, string> = {
    none: "без ковра",
    low: "низкий",
    medium: "средний",
    high: "высокий",
  };

  return labels[value] ?? String(value);
}

function matrixRecoveryPriorityLabel(value: MatrixDrivenPlanWeek["recoveryPriority"]) {
  const labels: Record<string, string> = {
    optional: "обычный контроль",
    recommended: "рекомендовано восстановление",
    mandatory: "обязательное восстановление",
    primary: "восстановление главное",
  };

  return labels[value] ?? String(value);
}

function matrixWeekdayDateLabel(date: string | null, fallbackDayNumber: number) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return `День ${fallbackDayNumber}`;
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    return `День ${fallbackDayNumber}`;
  }

  const weekdayLabels = ["ВС", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"];
  const day = date.slice(8, 10);
  const month = date.slice(5, 7);

  return `${weekdayLabels[parsed.getUTCDay()]} ${day}.${month}`;
}

function matrixDayTypeLabel(value: ConstructorDayType) {
  const labels: Record<ConstructorDayType, string> = {
    heavy_training: "тяжёлый тренировочный день",
    medium_training: "средний тренировочный день",
    light_training: "лёгкая тренировка",
    recovery: "восстановительный день",
    travel: "дорога",
    weigh_in: "взвешивание",
    competition: "соревновательный день",
    post_competition: "восстановление после старта",
    half_day: "половинчатый день",
    gpp_day: "день ОФП",
    spp_day: "день СФП",
    technical: "технический день",
    competition_model: "модель борьбы",
    mat_day: "день ковра",
    environment_change: "смена обстановки",
    sauna_recovery: "сауна и восстановление",
  };

  return labels[value] ?? String(value);
}

function matrixRiskMessageForCoach(risk: MatrixDrivenRiskCheckResult) {
  const labels: Record<MatrixDrivenRiskCheckResult["code"], string> = {
    main_start_development_forbidden:
      "Развивающая нагрузка запрещена в этом окне главного старта. Оставляем только поддержание, перенос, активацию и восстановление.",
    heavy_lmv_too_close_to_start:
      "Тяжёлая локальная мышечная выносливость слишком близко к старту. Нужен поддерживающий объём без отказа.",
    heavy_strength_too_close_to_start:
      "Тяжёлая силовая работа слишком близко к старту. Нужна активация или поддержание без накопления усталости.",
    excessive_mat_volume_near_start:
      "Объём ковра близко к старту требует контроля. Если свежесть снижена, уменьшить ковёр и оставить качество.",
    control_bouts_too_close_to_start:
      "Контрольные схватки слишком близко к старту. Лучше оставить короткую модель или техническую активацию.",
    heavy_load_on_travel_day:
      "В день дороги тяжёлая нагрузка запрещена. Приоритет: переезд, сон, питание и лёгкая мобилизация.",
    heavy_load_on_weigh_in_day:
      "В день взвешивания тяжёлая нагрузка запрещена. Приоритет: вес, восстановление, вода/питание и короткая активация.",
    taper_mixed_with_development:
      "Подводка смешана с развивающей задачей. Нужно снизить объём и оставить только качество и свежесть.",
    competition_day_training_load:
      "В соревновательный день нельзя добавлять тренировочную нагрузку сверх разминки и восстановления между схватками.",
    post_competition_development_load:
      "После старта развивающая нагрузка преждевременна. Сначала восстановление и разбор состояния.",
    legacy_template_used_as_structure:
      "Старый шаблон не должен задавать структуру нового плана. Он может быть только источником содержания.",
  };

  return labels[risk.code] ?? risk.message;
}

function uniqueRiskFlags(riskChecks: MatrixDrivenRiskCheckResult[]): ConstructorRiskFlag[] {
  const seen = new Set<string>();
  const flags: ConstructorRiskFlag[] = [];

  for (const risk of riskChecks) {
    const flag = riskCheckToConstructorRiskFlag(risk);
    const key = `${flag.code}:${flag.message}`;

    if (!seen.has(key)) {
      flags.push(flag);
      seen.add(key);
    }
  }

  return flags;
}

function primaryGoal(input: ConstructorInput): ConstructorGoalType {
  return [...input.goals].sort((left, right) => left.priority - right.priority)[0]?.goalType ?? "taper_quality";
}

function modeForMatrixGoal(input: ConstructorInput): ConstructorGoalMode {
  if (input.seasonStrategy?.constructorRules.forbiddenModes.includes("development")) {
    return "transfer";
  }

  if (input.context.currentPhase === "taper" || input.context.currentPhase === "start_window") {
    return "activation";
  }

  if (input.context.currentPhase === "recovery") {
    return "recovery";
  }

  return "development";
}

function buildMatrixMissingData(input: ConstructorInput): ConstructorMissingData[] {
  const missing: ConstructorMissingData[] = [];

  if (input.state.readinessScore === null) {
    missing.push({
      code: "readiness",
      requiredFor: "plan",
      message: "Нет готовности: уверенность в плане ниже, нужно проверить состояние спортсмена.",
    });
  }

  if (input.state.sleepHours === null) {
    missing.push({
      code: "sleep",
      requiredFor: "plan",
      message: "Нет сна: решения по подводке и восстановлению строятся осторожнее.",
    });
  }

  if (input.state.restingHr === null) {
    missing.push({
      code: "resting_hr",
      requiredFor: "plan",
      message: "Нет пульса покоя: восстановление и скрытая усталость оцениваются менее точно.",
    });
  }

  return missing;
}

function deriveMatrixConfidence(
  missingData: ConstructorMissingData[],
  riskChecks: MatrixDrivenRiskCheckResult[],
): ConstructorConfidence {
  if (riskChecks.some((risk) => risk.severity === "error")) {
    return "low";
  }

  if (missingData.length > 1 || riskChecks.some((risk) => risk.severity === "warning")) {
    return "medium";
  }

  return "high";
}

function matrixBlockName(block: MatrixDrivenSelectedBlock) {
  const names: Partial<Record<ConstructorTrainingBlockType, string>> = {
    mat_technique: "Техника борьбы",
    mat_tactics: "Тактические ситуации",
    mat_competition_model: "Соревновательная модель",
    mat_control_bouts: "Контрольные схватки",
    mat_light_technical: "Лёгкая техника",
    spp: "СФП с переносом в борьбу",
    gpp: "ОФП / смена обстановки",
    leg_lmv: "Поддержание СФП ног",
    first_action_speed: "Короткая активация первого действия",
    aerobic_deload: "Аэробная разгрузка",
    mobility: "Мобилити",
    recovery: "Восстановление",
    sauna: "Сауна / восстановительные процедуры",
    environment_change: "Смена обстановки",
    travel: "Дорога / адаптация",
    weigh_in: "Взвешивание / контроль веса",
    competition_start: "Старт соревнования",
    post_competition_recovery: "Восстановление после старта",
  };

  return names[block.blockType] ?? block.label;
}

function matrixBlockVolume(block: MatrixDrivenSelectedBlock) {
  switch (block.blockType) {
    case "mat_technique":
      return "20-30 мин: стойка, входы, защита/спрол, партер; качество техники выше объёма";
    case "mat_tactics":
      return "20-25 мин: 3-4 тактические ситуации, выход из захвата, край ковра, счёт";
    case "mat_competition_model":
      return "2-3 моделирующих отрезка: 3 мин + 30 сек + 3 мин; пауза 4-6 мин";
    case "mat_control_bouts":
      return "1-2 контрольные схватки только при свежести; остановить при падении качества";
    case "mat_light_technical":
      return "15-25 мин: лёгкая техника без силовой борьбы и без утомления";
    case "spp":
      return "25-35 мин: СФП поддерживающе, без отказа, обязательно с переносом в борьбу";
    case "gpp":
      return "25-40 мин: ОФП или кросс/поход как смена обстановки, RPE 3-5";
    case "leg_lmv":
      return "2-3 упражнения по 20-25 сек, 2-3 подхода; без отказа; затем перенос во входы";
    case "first_action_speed":
      return "4-8 коротких включений 10-20 м или входов по сигналу; полный отдых";
    case "aerobic_deload":
      return "25-35 мин Z1-Z2: кросс, велосипед, ходьба или поход; разговорный темп";
    case "mobility":
      return "10-20 мин: таз, спина, плечи, голеностоп, дыхание";
    case "recovery":
      return "15-30 мин восстановления: Z1, дыхание, мобилити, локальный сброс";
    case "sauna":
      return "сауна/процедуры только по самочувствию и весу; без тренировочного добора";
    case "environment_change":
      return "30-60 мин лёгкой смены обстановки: прогулка, поход, восстановительный кросс";
    case "travel":
      return "10-20 мин: дорога, адаптация, мобилити, сон, вода; без нагрузки";
    case "weigh_in":
      return "5-15 мин: вес, вода, питание, короткая активация только при свежести";
    case "competition_start":
      return "соревновательный день: разминка, старт, восстановление между схватками";
    case "post_competition_recovery":
      return "20-40 мин: восстановление, сон, питание, разбор ощущений и травм";
    default: {
      const duration = block.volume.durationMinutes.target > 0
        ? `${block.volume.durationMinutes.target} мин`
        : "соревновательный объём";

      return `${duration}; нагрузка ${block.volume.loadLevel}; интенсивность ${block.volume.intensityLevel}; ковёр ${block.volume.matVolume}`;
    }
  }
}

function resolvedExerciseToConstructorExercise(
  item: ConstructorMatrixResolvedExercise,
): ConstructorPlanExercise {
  return {
    name: item.name,
    targetSets: item.targetSets,
    targetReps: item.targetReps,
    targetWeightKg: item.targetWeightKg,
    targetDurationMinutes: item.targetDurationMinutes,
    targetRpe: item.targetRpe,
    notes: [
      item.notes,
      item.substitutions.regressions[0]
        ? `проще: ${item.substitutions.regressions[0]}`
        : "",
      item.substitutions.progressions[0]
        ? `сложнее: ${item.substitutions.progressions[0]}`
        : "",
    ]
      .filter(Boolean)
      .join(" · "),
    displayOrder: item.displayOrder,
  };
}

function adaptBlock(
  block: MatrixDrivenSelectedBlock,
  input: ConstructorInput,
  dayType?: ConstructorDayType,
  phase?: MatrixDrivenPlanWeek["phase"],
  rotation?: {
    weekNumber: number;
    dayNumber: number;
    daysUntilStart: number | null;
    sessionSlot: MatrixDrivenPlanSession["slot"];
    blockIndex: number;
    usedExerciseIds: Set<string>;
  },
): ConstructorPlanBlock {
  const evidenceTitles = getConstructorMatrixEvidenceDependencies(block.evidenceDependencies).map(
    (item) => item.title,
  );
  const resolvedResult = resolveConstructorMatrixExercisesForBlock({
    block,
    input,
    dayType,
    phase,
    weekNumber: rotation?.weekNumber,
    dayNumber: rotation?.dayNumber,
    daysUntilStart: rotation?.daysUntilStart,
    sessionSlot: rotation?.sessionSlot,
    blockIndex: rotation?.blockIndex,
    avoidExerciseIds: rotation ? Array.from(rotation.usedExerciseIds) : undefined,
  });
  const resolvedExercises = resolvedResult.exercises.map(resolvedExerciseToConstructorExercise);

  for (const exercise of resolvedResult.exercises) {
    rotation?.usedExerciseIds.add(exercise.sourceExerciseId);
  }

  return {
    name: matrixBlockName(block),
    type: block.blockTypeCategory as ConstructorBlockType,
    targetQuality: block.targetQuality,
    volume: matrixBlockVolume(block),
    localLoadZones: [
      matrixBlockName(block),
      `ковёр: ${matrixMatVolumeLabel(block.volume.matVolume)}`,
      `плотность: ${block.volume.density === "split_day" ? "две тренировки" : block.volume.density === "half_day" ? "половинчатый день" : block.volume.density === "recovery_only" ? "восстановление" : "одна тренировка"}`,
    ],
    energySystem:
      block.blockTypeCategory === "recovery"
        ? "восстановление"
        : block.volume.intensityLevel === "high"
          ? "специальная высокая интенсивность"
          : "контролируемая специальная нагрузка",
    riskFlags: block.riskTags,
    evidenceRefs: [
      "PERFORM: фазовая матрица подготовки",
      ...evidenceTitles,
      ...(block.sourceCompatibilityCards.length ? ["эталонные блоки используются как библиотека упражнений"] : []),
    ],
    coachEditable: true,
    volumeLocked: false,
    exercises: resolvedExercises,
  };
}

function sessionNotes(matrixSession: MatrixDrivenPlanSession) {
  const selectedBlockNotes = matrixSession.selectedBlocks
    .slice(0, 2)
    .map((block) => `${matrixBlockName(block)}: выбран по фазе дня`);

  return [
    matrixSession.slot === "morning" ? "Утренний блок" : "Вечерний блок",
    `нагрузка ${matrixLoadLabel(matrixSession.volume.loadLevel)}`,
    `интенсивность ${matrixIntensityLabel(matrixSession.volume.intensityLevel)}`,
    "разминка/заминка внутри основной задачи",
    ...selectedBlockNotes,
  ].join(" · ");
}

export function adaptMatrixDrivenSessionToConstructorSession(
  matrixSession: MatrixDrivenPlanSession,
  input: ConstructorInput,
  context: {
    weekNumber: number;
    dayNumber: number;
    daysUntilStart: number | null;
    dayType?: ConstructorDayType;
    phase?: MatrixDrivenPlanWeek["phase"];
    usedExerciseIds: Set<string>;
  },
): ConstructorPlanSession {
  const blocks = matrixSession.selectedBlocks.map((block, blockIndex) =>
    adaptBlock(block, input, context.dayType, context.phase, {
      weekNumber: context.weekNumber,
      dayNumber: context.dayNumber,
      daysUntilStart: context.daysUntilStart,
      sessionSlot: matrixSession.slot,
      blockIndex,
      usedExerciseIds: context.usedExerciseIds,
    }),
  );

  return {
    name: matrixSession.slot === "morning" ? "УТРО" : "ВЕЧЕР",
    notes: sessionNotes(matrixSession),
    orderIndex: matrixSession.slot === "morning" ? 0 : 1,
    blocks,
  };
}

export function adaptMatrixDrivenDayToConstructorDay(
  matrixDay: MatrixDrivenPlanDay,
  input: ConstructorInput,
  phase?: MatrixDrivenPlanWeek["phase"],
  weekNumber = 1,
  usedExerciseIds: Set<string> = new Set(),
): ConstructorPlanDay {
  const sessions = matrixDay.sessions.map((session) =>
    adaptMatrixDrivenSessionToConstructorSession(
      session,
      input,
      {
        weekNumber,
        dayNumber: matrixDay.dayNumber,
        daysUntilStart: matrixDay.daysUntilStart,
        dayType: matrixDay.dayType,
        phase,
        usedExerciseIds,
      },
    ),
  );
  const dayLabelParts = [
    matrixWeekdayDateLabel(matrixDay.date, matrixDay.dayNumber),
    matrixDay.daysUntilStart !== null ? `Д-${matrixDay.daysUntilStart}` : null,
  ].filter(Boolean);

  return {
    dayLabel: dayLabelParts.join(" / "),
    dayIntent: [
      matrixDayTypeLabel(matrixDay.dayType),
      matrixDay.sessions.length > 1 ? "две тренировки" : "одна тренировка",
      matrixDay.riskChecks.length ? "есть ограничения по нагрузке: проверьте свежесть и объём ковра" : null,
    ]
      .filter(Boolean)
      .join(" · "),
    loadLevel: dayLoadToConstructorLoad(matrixDay),
    readinessGate:
      matrixDay.volume.recoveryPriority === "primary"
        ? "Проверить свежесть, сон, вес и признаки скрытой усталости."
        : "Если готовность низкая, заменить основной блок на восстановление или мобилити.",
    blocks: sessions.flatMap((session) => session.blocks),
    sessions,
  };
}

function weekTypeLabel(weekType: MatrixDrivenPlanWeek["weekType"]) {
  const labels: Record<MatrixDrivenPlanWeek["weekType"], string> = {
    development: "развивающая неделя",
    maintenance: "поддерживающая неделя",
    special: "специальная борцовская неделя",
    pre_competition: "предсоревновательная неделя",
    deload: "разгрузочная неделя",
    taper: "подводящая неделя",
    competition: "соревновательная неделя",
    recovery: "восстановительная неделя",
    travel_logistics: "логистика и адаптация",
    post_competition: "послестартовое восстановление",
  };

  return labels[weekType];
}

function compatibilityCardLabel(cardId: string) {
  const labels: Record<string, string> = {
    pre_competition_21: "эталонный предсоревновательный блок 21 день",
    speed_first_action_14: "короткая активация первого действия",
    taper_10: "эталонная подводка 10 дней",
    legs_lme_21: "поддержание СФП ног",
    arms_grip_21: "поддержание рук и захвата",
    recovery_7: "восстановительный блок 7 дней",
  };

  return labels[cardId] ?? cardId.replaceAll("_", " ");
}

export function adaptMatrixDrivenWeekToConstructorWeek(
  matrixWeek: MatrixDrivenPlanWeek,
  input: ConstructorInput,
): ConstructorPlanWeek {
  const weekUsedExerciseIds = new Set<string>();

  return {
    weekNumber: matrixWeek.weekNumber,
    title: `Неделя ${matrixWeek.weekNumber}: ${weekTypeLabel(matrixWeek.weekType)}`,
    phase: preparationPhaseToConstructorPhase(matrixWeek.phase),
    mainIntent: [
      weekTypeLabel(matrixWeek.weekType),
      `нагрузка ${matrixLoadLabel(matrixWeek.volume.loadLevel)}`,
      `ковёр: ${matrixMatVolumeLabel(matrixWeek.volume.matVolume)}`,
      matrixRecoveryPriorityLabel(matrixWeek.recoveryPriority),
    ].join(" · "),
    days: matrixWeek.days.map((day) =>
      adaptMatrixDrivenDayToConstructorDay(
        day,
        input,
        matrixWeek.phase,
        matrixWeek.weekNumber,
        weekUsedExerciseIds,
      ),
    ),
  };
}

export function adaptMatrixDrivenDraftToConstructorWeeks(
  matrixDraft: MatrixDrivenPlanDraft,
  input: ConstructorInput,
): ConstructorPlanWeek[] {
  return matrixDraft.weeks.map((week) => adaptMatrixDrivenWeekToConstructorWeek(week, input));
}

function goalItem(
  goalType: ConstructorGoalType,
  mode: ConstructorGoalMode,
  label: string,
  reason: string,
): ConstructorDraft["focusPlan"]["items"][number] {
  return { goalType, mode, label, reason };
}

function buildMatrixFocusItems(
  input: ConstructorInput,
  matrixDraft: MatrixDrivenPlanDraft,
): ConstructorDraft["focusPlan"]["items"] {
  const days = matrixDraft.daysUntilStart;

  if (matrixDraft.isMainStart && days !== null && days <= 4) {
    return [
      goalItem("taper_quality", "activation", "короткая предстартовая активация", "стартовое окно: только ключевые действия без добора нагрузки"),
      goalItem("weight_management", "recovery", "контроль веса", "взвешивание, вода, питание и самочувствие важнее объёма"),
      goalItem("recovery", "recovery", "сон и восстановление", "сохранить свежесть и снять остаточное напряжение"),
    ];
  }

  if (matrixDraft.isMainStart && days !== null && days <= 14) {
    return [
      goalItem("taper_quality", "activation", "качество подводки", "снижаем объём, сохраняем резкость и уверенность"),
      goalItem("fatigue_skill", "transfer", "лёгкая техническая уверенность", "только качество действий, без борьбы в утомление"),
      goalItem("weight_management", "recovery", "контроль веса", "вес и восстановление задают допустимую нагрузку"),
      goalItem("recovery", "recovery", "суперкомпенсация", "сон, свежесть, половинчатые дни и процедуры"),
    ];
  }

  if (matrixDraft.isMainStart && days !== null && days <= 30) {
    return [
      goalItem("fatigue_skill", "transfer", "специальная борцовская работа", "основа активных дней: техника, ситуации и перенос СФП в борьбу"),
      goalItem("wrestling_contact_density", "transfer", "соревновательная модель", "моделируем плотность борьбы без развивающего добора"),
      goalItem("legs_lme", "maintenance", "поддержание СФП ног", "короткие локальные блоки без отказа и только с переносом во входы"),
      goalItem("weight_management", "recovery", "контроль веса", "вес, сон, пульс покоя и самочувствие ограничивают нагрузку"),
      goalItem("recovery", "recovery", "восстановление и разгрузка", "половинчатые дни, смена обстановки и снятие накопленной усталости"),
      goalItem("taper_quality", "activation", "качество подводки", "сохранить свежесть и резкость без развития утомления"),
    ];
  }

  if (matrixDraft.preparationPhase === "transition_recovery") {
    return [
      goalItem("recovery", "recovery", "восстановление после старта", "сначала сон, питание, суставы, мышечная боль и разбор"),
      goalItem("aerobic_base", "recovery", "мягкая аэробная поддержка", "возврат к режиму без развивающего давления"),
    ];
  }

  if (input.goals.length) {
    return input.goals.map((item: ConstructorGoalInput) => ({
      goalType: item.goalType,
      mode: item.mode ?? modeForMatrixGoal(input),
      label: item.reason ?? item.goalType,
      reason: "Выбрано тренером и проверено matrix eligibility rules.",
    }));
  }

  const goal = primaryGoal(input);

  return [
    goalItem(goal, modeForMatrixGoal(input), goal, "Fallback focus для matrix path."),
  ];
}

function matrixPhaseTitle(phase: MatrixDrivenPlanDraft["preparationPhase"]) {
  const labels: Record<MatrixDrivenPlanDraft["preparationPhase"], string> = {
    general_preparation: "общая подготовка",
    special_preparation: "специальная подготовка",
    special_pre_competition: "специальная предсоревновательная подготовка",
    direct_pre_competition: "непосредственная предсоревновательная подготовка",
    taper: "подводка",
    competition: "стартовое окно",
    transition_recovery: "восстановление после старта",
  };

  return labels[phase];
}

function matrixDevelopmentAllowed(matrixDraft: MatrixDrivenPlanDraft) {
  if (matrixDraft.isMainStart && matrixDraft.daysUntilStart !== null && matrixDraft.daysUntilStart <= 30) {
    return false;
  }

  return matrixDraft.weeks.some((week) => week.volume.loadLevel === "high");
}

function runtimeEligibilityIdsFor(
  predicate: (item: (typeof CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY)[number]) => boolean,
): ConstructorMatrixRuntimeEligibilityId[] {
  return CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY.filter(predicate).map(
    (item) => item.id as ConstructorMatrixRuntimeEligibilityId,
  );
}

export function buildMatrixDrivenAiRuntimeMetadata(): MatrixDrivenAiRuntimeMetadata {
  return {
    generatedFrom: "ai_reviewed_runtime_eligibility",
    metadataOnly: true,
    summary: buildConstructorMatrixRuntimeEligibilitySummary(),
    softWarningEligibilityIds: runtimeEligibilityIdsFor(
      (item) => item.allowedRuntimeUse === "soft_warning",
    ),
    planStructureHintEligibilityIds: runtimeEligibilityIdsFor(
      (item) => item.allowedRuntimeUse === "plan_structure_hint",
    ),
    fallbackGuardEligibilityIds: runtimeEligibilityIdsFor(
      (item) => item.allowedRuntimeUse === "fallback_guard",
    ),
    blockedHighRiskEligibilityIds: runtimeEligibilityIdsFor(
      (item) => item.status === "blocked_high_risk",
    ),
    reviewRequiredEligibilityIds: runtimeEligibilityIdsFor((item) =>
      item.requiredClassifications.includes("human_review_required"),
    ),
    runtimeHardGatesEnabled: false,
    highRiskAutomationEnabled: false,
    numericThresholdRuntimeGatesEnabled: false,
    medicalDecisionAutomationEnabled: false,
    humanReviewed: false,
  };
}

export function buildMatrixDrivenConstructorDraft(
  input: ConstructorInput,
  options?: MatrixDrivenBuilderOptions,
): MatrixDrivenConstructorDraft {
  const matrixDraft = buildMatrixDrivenPlanDraft(input, options);
  const weeks = adaptMatrixDrivenDraftToConstructorWeeks(matrixDraft, input);
  const missingData = buildMatrixMissingData(input);
  const riskFlags = uniqueRiskFlags(matrixDraft.riskChecks);
  const confidence = deriveMatrixConfidence(missingData, matrixDraft.riskChecks);
  const phaseMap = matrixDraft.weeks.map((week) => ({
    range:
      week.daysUntilStartRange.from !== null && week.daysUntilStartRange.to !== null
        ? `Д-${week.daysUntilStartRange.from}...Д-${week.daysUntilStartRange.to}`
        : `Неделя ${week.weekNumber}`,
    phase: preparationPhaseToConstructorPhase(week.phase),
    title: weekTypeLabel(week.weekType),
    intent: [
      weekTypeLabel(week.weekType),
      `нагрузка ${matrixLoadLabel(week.volume.loadLevel)}`,
      `ковёр: ${matrixMatVolumeLabel(week.volume.matVolume)}`,
      matrixRecoveryPriorityLabel(week.recoveryPriority),
    ].join(" · "),
  }));
  const selectedCards = matrixDraft.legacyCards.sourceCompatibilityCards.map((cardId) => ({
    id: cardId,
    title: compatibilityCardLabel(cardId),
    rationale: "Используется как библиотека упражнений и объёмов, но не задаёт структуру недели или дня.",
  }));
  const matrixRiskSummary = matrixDraft.riskChecks.length
    ? Array.from(new Set(matrixDraft.riskChecks.map(matrixRiskMessageForCoach))).join(" ")
    : "Проверка матрицы не нашла критичных нарушений.";
  const phaseTitle = matrixPhaseTitle(matrixDraft.preparationPhase);
  const daysText =
    matrixDraft.daysUntilStart !== null
      ? `${matrixDraft.daysUntilStart} дней до старта`
      : "нет точной даты старта";

  return {
    generatedFrom: "matrix",
    confidence,
    understood: {
      mainTask: `${input.competition.name}: ${phaseTitle}, ${daysText}.`,
      interpretation: [
        `Новый конструктор собрал план от календаря старта: ${input.competition.name}, ${daysText}.`,
        `Фаза: ${phaseTitle}.`,
        matrixDraft.isMainStart
          ? "Так как это главный старт, структура строится от обратного отсчёта до соревнования."
          : "Структура учитывает роль старта и календарь спортсмена.",
        "Старые эталонные блоки используются только как библиотека упражнений и объёмов, а не как готовая сетка дней.",
      ].join(" "),
      limitation:
        matrixDraft.isMainStart && matrixDraft.daysUntilStart !== null && matrixDraft.daysUntilStart <= 30
          ? "Развивающие цели запрещены: план работает через поддержание, перенос, активацию, вес и восстановление."
          : "Тренер может редактировать объёмы и упражнения перед сохранением шаблона.",
    },
    focusPlan: {
      title: "Фокус подготовки по календарю старта",
      developmentAllowed: matrixDevelopmentAllowed(matrixDraft),
      items: buildMatrixFocusItems(input, matrixDraft),
      phaseMap,
    },
    missingData,
    riskFlags,
    selectedCards,
    plan: {
      cycleLengthDays: Math.max(1, matrixDraft.weeks.flatMap((week) => week.days).length),
      sessionsPerDay: Math.max(1, ...weeks.flatMap((week) => week.days.map((day) => day.sessions?.length ?? 1))),
      weeks,
    },
    explanation: {
      mainDecision: `Новый конструктор выбрал фазу: ${phaseTitle}. Структура недель и дней построена от календаря старта, а не от фиксированной карточки.`,
      whyNow:
        matrixDraft.daysUntilStart !== null
          ? `До старта Д-${matrixDraft.daysUntilStart}: допустимые блоки ограничены фазой, дорогой, взвешиванием, восстановлением и ролью старта.`
          : "Нет точного D-day; новый конструктор использует безопасную структуру с пониженной уверенностью.",
      testsImpact:
        missingData.length > 0
          ? `Не хватает данных: ${missingData.map((item) => item.code).join(", ")}.`
          : "Данных достаточно для рабочего черновика конструктора.",
      riskImpact: matrixRiskSummary,
      evidenceSummary: [
        "календарь старта",
        "фазовая матрица PERFORM",
        "эталонный план Европы как методическая основа",
        ...matrixDraft.legacyCards.sourceCompatibilityCards.map(compatibilityCardLabel),
      ].join(", "),
      coachCanEdit: [
        "выбранные блоки",
        "объёмы",
        "упражнения",
        "расположение утро/вечер",
        "замены при рисках",
      ],
    },
    seasonStrategy: input.seasonStrategy ?? null,
    matrix: {
      draft: matrixDraft,
      riskChecks: matrixDraft.riskChecks,
      explanationCount:
        matrixDraft.explanations.length +
        matrixDraft.weeks.flatMap((week) => week.explanations).length +
        matrixDraft.weeks.flatMap((week) => week.days.flatMap((day) => day.explanations)).length,
      legacyCards: matrixDraft.legacyCards,
      aiRuntime: buildMatrixDrivenAiRuntimeMetadata(),
      fullContent: {
        exerciseLibrary: buildConstructorMatrixExerciseLibrarySummary(),
        exerciseResolver: buildConstructorMatrixExerciseResolverSummary(),
        athleteContextRequirements: buildConstructorMatrixAthleteContextRequirementSummary(),
        nutritionGuidance: buildConstructorMatrixNutritionGuidanceSummary(),
        weightManagementGuidance: buildConstructorMatrixWeightManagementGuidanceSummary(),
        metadataOnly: true,
        humanReviewed: false,
        highRiskAutomationEnabled: false,
      },
    },
  };
}
