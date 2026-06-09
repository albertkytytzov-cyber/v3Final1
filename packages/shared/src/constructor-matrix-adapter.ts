import type {
  ConstructorBlockType,
  ConstructorConfidence,
  ConstructorDraft,
  ConstructorGoalMode,
  ConstructorGoalType,
  ConstructorInput,
  ConstructorLoadLevel,
  ConstructorMissingData,
  ConstructorPhase,
  ConstructorPlanBlock,
  ConstructorPlanDay,
  ConstructorPlanSession,
  ConstructorPlanWeek,
  ConstructorRiskCode,
  ConstructorRiskFlag,
} from "./constructor-core";
import type {
  ConstructorPreparationPhase,
  ConstructorTrainingBlockType,
} from "./constructor-matrix";
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

export interface MatrixDrivenConstructorDraft extends ConstructorDraft {
  generatedFrom: "matrix";
  matrix: {
    draft: MatrixDrivenPlanDraft;
    riskChecks: MatrixDrivenRiskCheckResult[];
    explanationCount: number;
    legacyCards: MatrixDrivenPlanDraft["legacyCards"];
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
    message: `[matrix:${risk.code}] ${risk.message}`,
  };
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
      message: "Matrix path: нет готовности, поэтому уверенность ниже.",
    });
  }

  if (input.state.sleepHours === null) {
    missing.push({
      code: "sleep",
      requiredFor: "plan",
      message: "Matrix path: нет сна, поэтому taper/recovery решения осторожнее.",
    });
  }

  if (input.state.restingHr === null) {
    missing.push({
      code: "resting_hr",
      requiredFor: "plan",
      message: "Matrix path: нет пульса покоя для контроля восстановления.",
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

function volumeText(block: MatrixDrivenSelectedBlock) {
  const duration = block.volume.durationMinutes.target > 0
    ? `${block.volume.durationMinutes.target} мин`
    : "соревновательный объём";

  return `${duration}; нагрузка ${block.volume.loadLevel}; интенсивность ${block.volume.intensityLevel}; ковёр ${block.volume.matVolume}`;
}

function adaptBlock(block: MatrixDrivenSelectedBlock): ConstructorPlanBlock {
  return {
    name: block.label,
    type: block.blockTypeCategory as ConstructorBlockType,
    targetQuality: block.targetQuality,
    volume: volumeText(block),
    localLoadZones: [
      `matrix:${block.blockType}`,
      `mat:${block.volume.matVolume}`,
      `density:${block.volume.density}`,
      ...block.sourceCompatibilityCards.map((cardId) => `legacy-source:${cardId}`),
    ],
    energySystem:
      block.blockTypeCategory === "recovery"
        ? "восстановление"
        : block.volume.intensityLevel === "high"
          ? "специальная высокая интенсивность"
          : "контролируемая матричная нагрузка",
    riskFlags: block.riskTags,
    evidenceRefs: [
      "matrix-driven-constructor",
      ...block.sourceCompatibilityCards.map((cardId) => `legacy-content:${cardId}`),
    ],
    coachEditable: true,
    volumeLocked: false,
  };
}

export function adaptMatrixDrivenSessionToConstructorSession(
  matrixSession: MatrixDrivenPlanSession,
  input: ConstructorInput,
): ConstructorPlanSession {
  void input;

  return {
    name: matrixSession.slot === "morning" ? "УТРО" : "ВЕЧЕР",
    notes: [
      `matrix slot=${matrixSession.slot}`,
      `load=${matrixSession.volume.loadLevel}`,
      ...matrixSession.explanations.slice(0, 3).map((item) => item.message),
    ].join(" · "),
    orderIndex: matrixSession.slot === "morning" ? 0 : 1,
    blocks: matrixSession.selectedBlocks.map(adaptBlock),
  };
}

export function adaptMatrixDrivenDayToConstructorDay(
  matrixDay: MatrixDrivenPlanDay,
  input: ConstructorInput,
): ConstructorPlanDay {
  const sessions = matrixDay.sessions.map((session) =>
    adaptMatrixDrivenSessionToConstructorSession(session, input),
  );
  const dayLabelParts = [
    matrixDay.date ?? `День ${matrixDay.dayNumber}`,
    matrixDay.daysUntilStart !== null ? `Д-${matrixDay.daysUntilStart}` : null,
  ].filter(Boolean);

  return {
    dayLabel: dayLabelParts.join(" / "),
    dayIntent: [
      `matrix day=${matrixDay.dayType}`,
      matrixDay.explanations[0]?.message,
      matrixDay.riskChecks.length ? `risk checks: ${matrixDay.riskChecks.map((risk) => risk.code).join(", ")}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    loadLevel: dayLoadToConstructorLoad(matrixDay),
    readinessGate:
      matrixDay.volume.recoveryPriority === "primary"
        ? "Проверить свежесть, сон, вес и признаки скрытой усталости."
        : "Если готовность низкая, заменить основной блок на recovery/mobility.",
    blocks: sessions.flatMap((session) => session.blocks),
    sessions,
  };
}

export function adaptMatrixDrivenWeekToConstructorWeek(
  matrixWeek: MatrixDrivenPlanWeek,
  input: ConstructorInput,
): ConstructorPlanWeek {
  return {
    weekNumber: matrixWeek.weekNumber,
    title: `Matrix неделя ${matrixWeek.weekNumber}: ${matrixWeek.weekType}`,
    phase: preparationPhaseToConstructorPhase(matrixWeek.phase),
    mainIntent: [
      `matrix week=${matrixWeek.weekType}`,
      `load=${matrixWeek.volume.loadLevel}`,
      `mat=${matrixWeek.volume.matVolume}`,
      `recovery=${matrixWeek.recoveryPriority}`,
    ].join(" · "),
    days: matrixWeek.days.map((day) => adaptMatrixDrivenDayToConstructorDay(day, input)),
  };
}

export function adaptMatrixDrivenDraftToConstructorWeeks(
  matrixDraft: MatrixDrivenPlanDraft,
  input: ConstructorInput,
): ConstructorPlanWeek[] {
  return matrixDraft.weeks.map((week) => adaptMatrixDrivenWeekToConstructorWeek(week, input));
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
  const goal = primaryGoal(input);
  const goalMode = modeForMatrixGoal(input);
  const phaseMap = matrixDraft.weeks.map((week) => ({
    range:
      week.daysUntilStartRange.from !== null && week.daysUntilStartRange.to !== null
        ? `Д-${week.daysUntilStartRange.from}...Д-${week.daysUntilStartRange.to}`
        : `Неделя ${week.weekNumber}`,
    phase: preparationPhaseToConstructorPhase(week.phase),
    title: `Matrix ${week.weekType}`,
    intent: week.explanations[0]?.message ?? week.volume.explanation,
  }));
  const selectedCards = matrixDraft.legacyCards.sourceCompatibilityCards.map((cardId) => ({
    id: cardId,
    title: `Legacy content source: ${cardId}`,
    rationale: "Используется только как metadata/content hint, не как структура недели или дня.",
  }));
  const matrixRiskSummary = matrixDraft.riskChecks.length
    ? matrixDraft.riskChecks.map((risk) => `${risk.code}: ${risk.message}`).join(" ")
    : "Matrix risk checks не нашли критичных нарушений.";

  return {
    generatedFrom: "matrix",
    confidence,
    understood: {
      mainTask: `Matrix-driven constructor: ${input.competition.name}, ${matrixDraft.daysUntilStart ?? "?"} дней до старта.`,
      interpretation:
        matrixDraft.explanations.map((item) => item.message).join(" ") ||
        "План собран через phase → week → day → session → eligible blocks.",
      limitation:
        "Это experimental matrix path: старый генератор не переключён, упражнения и финальные объёмы требуют следующего adapter-слоя.",
    },
    focusPlan: {
      title: "Matrix-driven focus",
      developmentAllowed: matrixDraft.weeks.some((week) => week.volume.loadLevel === "high"),
      items: input.goals.length
        ? input.goals.map((item) => ({
            goalType: item.goalType,
            mode: item.mode ?? goalMode,
            label: item.reason ?? item.goalType,
            reason: "Сохранено из входа тренера и проверено matrix path.",
          }))
        : [
            {
              goalType: goal,
              mode: goalMode,
              label: goal,
              reason: "Fallback focus для matrix path.",
            },
          ],
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
      mainDecision: `generatedFrom=matrix; ${matrixDraft.preparationPhase}; legacyCards.usedAsStructure=${matrixDraft.legacyCards.usedAsStructure}.`,
      whyNow:
        matrixDraft.daysUntilStart !== null
          ? `До старта Д-${matrixDraft.daysUntilStart}; структура собрана матрицей, а не fixed template card.`
          : "Нет точного D-day; matrix path использует безопасную структуру skeleton.",
      testsImpact:
        missingData.length > 0
          ? `Не хватает данных: ${missingData.map((item) => item.code).join(", ")}.`
          : "Данных достаточно для experimental matrix adapter smoke.",
      riskImpact: matrixRiskSummary,
      evidenceSummary: [
        "generatedFrom=matrix",
        "legacy cards are content metadata only",
        ...matrixDraft.legacyCards.sourceCompatibilityCards.map((cardId) => `legacy-content:${cardId}`),
      ].join(", "),
      coachCanEdit: [
        "matrix-selected blocks",
        "volume prescription",
        "session placement",
        "risk replacements",
        "legacy content hints",
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
    },
  };
}
