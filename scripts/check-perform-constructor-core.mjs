import { existsSync, readFileSync } from "node:fs";

import {
  buildConstructorComparisonPreview,
  buildConstructorMatrixPreviewResponse,
  buildConstructorTemplatePayload,
  buildMatrixConstructorDraftIfAllowed,
  buildMatrixDrivenConstructorDraft,
  buildMatrixDrivenPlanDraft,
  buildMatrixDrivenWeekSkeleton,
  buildPerformConstructorDraft,
  buildSeasonStrategySnapshot,
  classifyConstructorTemplateCard,
  compareLegacyAndMatrixConstructorDrafts,
  CONSTRUCTOR_TEMPLATE_CARDS,
  CONSTRUCTOR_TRAINING_BLOCK_LIBRARY,
  decideMatrixConstructorRollout,
  evaluateMatrixPilotReadiness,
  explainBlockEligibility,
  filterAllowedTrainingBlocks,
  getMatrixPilotReadinessBlockers,
  getAllowedSessionSlots,
  getDayTypeForContext,
  getForbiddenBlockReasons,
  getWeekTypeForContext,
  isTrainingBlockAllowed,
  summarizeMatrixPilotReadiness,
} from "@training-platform/shared";
import { runConstructorPreviewFixtures } from "./constructor-preview-fixture-runner.mjs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readProjectFile(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function isWarmupBlock(block) {
  return /разминк/i.test(block.name);
}

function isCooldownBlock(block) {
  return /заминк/i.test(block.name);
}

function isActiveTrainingBlock(block) {
  if (isWarmupBlock(block) || isCooldownBlock(block)) {
    return false;
  }

  if (block.targetQuality === "weight_management") {
    return false;
  }

  return block.type !== "recovery" || block.targetQuality !== "recovery";
}

function activeTrainingDays(draft) {
  return draft.plan.weeks.flatMap((week) =>
    week.days.filter((day) => day.blocks.some(isActiveTrainingBlock)),
  );
}

function activeTrainingSessions(draft) {
  return draft.plan.weeks.flatMap((week) =>
    week.days.flatMap((day) =>
      (day.sessions ?? [{ name: day.dayIntent, blocks: day.blocks }]).filter((session) =>
        session.blocks.some(isActiveTrainingBlock),
      ),
    ),
  );
}

function sessionCount(day) {
  return day.sessions?.length ?? 0;
}

function hasSessionFrame(session) {
  return (
    session.blocks.length >= 3 &&
    isWarmupBlock(session.blocks[0]) &&
    isCooldownBlock(session.blocks[session.blocks.length - 1]) &&
    session.blocks.filter(isWarmupBlock).length === 1 &&
    session.blocks.filter(isCooldownBlock).length === 1
  );
}

function sessionMainBlocks(session) {
  return session.blocks.filter((block) => !isWarmupBlock(block) && !isCooldownBlock(block));
}

function sessionHasTechnicalWrestling(session) {
  return sessionMainBlocks(session).some(
    (block) =>
      block.type === "technical" ||
      ["fatigue_skill", "wrestling_contact_density", "taper_quality"].includes(String(block.targetQuality)),
  );
}

function sessionHasMatBlock(session) {
  return sessionMainBlocks(session).some(
    (block) =>
      block.type === "technical" ||
      /борьб|техник|стойк|партер|вход|захват/i.test(`${block.name} ${block.volume}`),
  );
}

function matrixBlock(type) {
  const block = CONSTRUCTOR_TRAINING_BLOCK_LIBRARY.find((item) => item.type === type);

  assert(block, `Expected constructor matrix block "${type}"`);

  return block;
}

function matrixReasonCodes(block, context) {
  return getForbiddenBlockReasons(block, context).map((reason) => reason.code);
}

function skeletonDays(skeleton) {
  return skeleton.weeks.flatMap((week) => week.days);
}

function skeletonSessions(skeleton) {
  return skeletonDays(skeleton).flatMap((day) => day.sessions);
}

function skeletonAllowedBlockTypes(skeleton) {
  return new Set(skeletonSessions(skeleton).flatMap((session) => session.allowedBlockTypes));
}

function skeletonForbiddenCandidate(skeleton, blockType) {
  return skeletonSessions(skeleton)
    .flatMap((session) => session.blockCandidates)
    .find((candidate) => candidate.blockType === blockType && !candidate.allowed);
}

function skeletonHasExplanation(skeleton, pattern) {
  const messages = [
    ...skeleton.explanations.map((item) => item.message),
    ...skeleton.weeks.flatMap((week) => week.explanations.map((item) => item.message)),
    ...skeletonDays(skeleton).flatMap((day) => day.explanations.map((item) => item.message)),
    ...skeletonSessions(skeleton).flatMap((session) => session.explanations.map((item) => item.message)),
  ];

  return messages.some((message) => pattern.test(message));
}

function readinessItem(readiness, id) {
  return readiness.checklist.find((item) => item.id === id);
}

function readinessCriticalItemsPass(readiness) {
  return readiness.checklist
    .filter((item) => item.severity === "error")
    .every((item) => item.status === "pass" || item.status === "not_applicable");
}

function matrixDraftDays(draft) {
  return draft.weeks.flatMap((week) => week.days);
}

function matrixDraftSessions(draft) {
  return matrixDraftDays(draft).flatMap((day) => day.sessions);
}

function matrixDraftBlocks(draft) {
  return matrixDraftSessions(draft).flatMap((session) => session.selectedBlocks);
}

function matrixDraftBlockTypes(draft) {
  return new Set(matrixDraftBlocks(draft).map((block) => block.blockType));
}

function matrixDraftRiskCodes(draft) {
  return new Set(draft.riskChecks.map((risk) => risk.code));
}

function matrixDraftHasExplanation(draft, pattern) {
  const messages = [
    ...draft.explanations.map((item) => item.message),
    ...draft.weeks.flatMap((week) => week.explanations.map((item) => item.message)),
    ...matrixDraftDays(draft).flatMap((day) => day.explanations.map((item) => item.message)),
    ...matrixDraftSessions(draft).flatMap((session) => session.explanations.map((item) => item.message)),
    ...matrixDraftBlocks(draft).flatMap((block) => block.explanations.map((item) => item.message)),
  ];

  return messages.some((message) => pattern.test(message));
}

function constructorDraftDays(draft) {
  return draft.plan.weeks.flatMap((week) => week.days);
}

function constructorDraftSessions(draft) {
  return constructorDraftDays(draft).flatMap((day) => day.sessions ?? []);
}

function constructorDraftBlocks(draft) {
  return constructorDraftSessions(draft).flatMap((session) => session.blocks);
}

function constructorDraftHasText(draft, pattern) {
  const texts = [
    draft.understood.mainTask,
    draft.understood.interpretation,
    draft.understood.limitation,
    draft.explanation.mainDecision,
    draft.explanation.whyNow,
    draft.explanation.riskImpact,
    draft.explanation.evidenceSummary,
    ...draft.selectedCards.flatMap((card) => [card.id, card.title, card.rationale]),
    ...draft.plan.weeks.flatMap((week) => [
      week.title,
      week.mainIntent,
      ...week.days.flatMap((day) => [
        day.dayLabel,
        day.dayIntent,
        day.readinessGate,
        ...(day.sessions ?? []).flatMap((session) => [
          session.name,
          session.notes,
          ...session.blocks.flatMap((block) => [
            block.name,
            block.volume,
            block.energySystem,
            ...block.localLoadZones,
            ...block.evidenceRefs,
          ]),
        ]),
      ]),
    ]),
  ];

  return texts.some((text) => pattern.test(String(text)));
}

function sessionHasPhysicalSupport(session) {
  return sessionMainBlocks(session).some(
    (block) =>
      ["strength", "metabolic", "conditioning", "CNS_high", "activation"].includes(String(block.type)) ||
      ["legs_lme", "arms_grip", "max_strength", "speed_strength", "anaerobic_power", "aerobic_base"].includes(
        String(block.targetQuality),
      ),
  );
}

function activeTemplateSessions(payload) {
  return payload.days.flatMap((day) =>
    day.sessions.filter((session) =>
      session.blocks.some((block) => {
        if (/разминк|заминк/i.test(block.name)) return false;
        if (block.name === "Контроль веса, сна и свежести" || block.name === "Контроль веса") return false;
        return block.blockType !== "recovery";
      }),
    ),
  );
}

const europePreparationInput = {
  competition: {
    name: "Чемпионат Европы",
    level: "continental",
    priority: "A",
    startDate: "2026-07-18",
    weighInDate: "2026-07-17",
    weightClass: "57 кг",
    expectedBoutCount: 4,
    location: "Europe",
    timezone: "Europe/Bucharest",
    travelRequired: true,
    climateContext: "summer",
  },
  athlete: {
    athleteId: "athlete-vasiliy-demo",
    fullName: "Vasiliy Tatarli",
    sex: "male",
    trainingAgeYears: 8,
    weightCurrentKg: 58.4,
    weightTargetKg: 57,
    baselineRestingHr: 52,
    strengths: ["стойка", "скорость включения"],
    weaknesses: ["устойчивость ног под утомлением"],
    injuryHistory: [],
    painZones: [],
  },
  context: {
    currentPhase: "special_preparation",
    cycleLengthDays: 21,
    sessionsPerWeek: 6,
    sessionsPerDay: 2,
    availableTrainingDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
  },
  goals: [
    {
      goalType: "speed_first_action",
      priority: 1,
      reason: "нужно улучшить первое действие",
    },
    {
      goalType: "legs_lme",
      priority: 2,
      reason: "нужно сохранить входы в ноги под утомлением",
    },
    {
      goalType: "fatigue_skill",
      priority: 3,
      reason: "перенос в технику",
    },
  ],
  tests: {
    sprint10mSec: 1.84,
    sprint20mSec: 3.11,
    verticalJumpCm: 51,
    legsLmeScore: 3,
    techniqueQualityScore: 4,
    aerobicRecoveryScore: 4,
  },
  state: {
    readinessScore: 76,
    sleepHours: 7.3,
    restingHr: 53,
    bodyWeightKg: 58.4,
    painLevel: 1,
    fatigueLevel: 2,
    deviceDataConfidence: "medium",
    coachComment: "Подготовка к главному старту, без случайного добора объёма.",
  },
  constraints: {
    noHeavyStrength: false,
    noHighGlycolytic: false,
    weightCutActive: false,
    injuryCaution: false,
    travelFatigue: true,
  },
};

const draft = buildPerformConstructorDraft(europePreparationInput);
const templatePayload = buildConstructorTemplatePayload(draft, "Constructor test");
const totalDraftDays = draft.plan.weeks.reduce((sum, week) => sum + week.days.length, 0);
const firstTwoWeekDayCounts = draft.plan.weeks.slice(0, 2).map((week) => week.days.length);

const closeTaperInput = {
  ...europePreparationInput,
  competition: {
    ...europePreparationInput.competition,
    startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    weighInDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  },
  context: {
    ...europePreparationInput.context,
    currentPhase: "taper",
    cycleLengthDays: 10,
    sessionsPerWeek: 6,
  },
};
const closeTaperDraft = buildPerformConstructorDraft(closeTaperInput);
const closeTaperPayload = buildConstructorTemplatePayload(closeTaperDraft, "Close taper constructor test");

const monthPreparationInput = {
  ...europePreparationInput,
  context: {
    ...europePreparationInput.context,
    currentPhase: "special_preparation",
    cycleLengthDays: 30,
    sessionsPerWeek: 6,
  },
  goals: [
    {
      goalType: "speed_first_action",
      priority: 1,
      reason: "скорость первого действия",
    },
    {
      goalType: "wrestling_contact_density",
      priority: 2,
      reason: "плотность борьбы",
    },
    {
      goalType: "fatigue_skill",
      priority: 3,
      reason: "техника под утомлением",
    },
    {
      goalType: "weight_management",
      priority: 4,
      reason: "вес и сгонка",
    },
    {
      goalType: "taper_quality",
      priority: 5,
      reason: "качество подводки",
    },
  ],
};
const monthDraft = buildPerformConstructorDraft(monthPreparationInput);
const monthPayload = buildConstructorTemplatePayload(monthDraft, "Month constructor test");
const monthPhases = monthDraft.plan.weeks.map((week) => week.phase);
const monthTitles = monthDraft.plan.weeks.map((week) => week.title);
const monthFocus = monthDraft.focusPlan;
const monthTargets = new Set(
  monthDraft.plan.weeks.flatMap((week) =>
    week.days.flatMap((day) => day.blocks.map((block) => block.targetQuality)),
  ),
);
const monthWorkingWeeks = monthDraft.plan.weeks.filter((week) =>
  ["base", "development", "special_preparation"].includes(week.phase),
);
const monthWorkingWeekSpeedDayCounts = monthWorkingWeeks.map((week) =>
  week.days.filter((day) => day.blocks.some((block) => block.targetQuality === "speed_first_action")).length,
);
const monthWorkingWeekRecoveryCoverage = monthWorkingWeeks.map((week) =>
  week.days.some((day) =>
    day.blocks.some((block) =>
      ["weight_management", "aerobic_base", "recovery"].includes(String(block.targetQuality)),
    ),
  ),
);
const monthSpeedDays = monthWorkingWeeks.flatMap((week) =>
  week.days.filter((day) => day.blocks.some((block) => block.targetQuality === "speed_first_action")),
);
const monthActiveTrainingDays = activeTrainingDays(monthDraft);
const monthActiveTrainingSessions = activeTrainingSessions(monthDraft);
const monthTemplateActiveSessions = activeTemplateSessions(monthPayload);
const monthActiveTrainingDaysWithSessions = monthDraft.plan.weeks.flatMap((week) =>
  week.days.filter((day) => (day.sessions ?? []).some((session) => session.blocks.some(isActiveTrainingBlock))),
);
const monthHalfDays = monthActiveTrainingDaysWithSessions.filter((day) => sessionCount(day) === 1);
const monthUnloadingHalfDays = monthHalfDays.filter((day) =>
  /половинчат|смена обстановки|сброс усталости/i.test(day.dayIntent),
);
const monthFullDays = monthActiveTrainingDaysWithSessions.filter((day) => sessionCount(day) >= 2);
const monthOverloadedSixDayWeeks = monthDraft.plan.weeks.filter(
  (week) => week.days.length >= 6 && week.days.every((day) => sessionCount(day) >= 2),
);
const monthHasMorningTechniqueEveningPhysical = monthActiveTrainingDaysWithSessions.some((day) => {
  const morning = day.sessions?.find((session) => session.name === "УТРО");
  const evening = day.sessions?.find((session) => session.name === "ВЕЧЕР");
  return Boolean(morning && evening && sessionHasTechnicalWrestling(morning) && sessionHasPhysicalSupport(evening));
});
const monthHasMorningPhysicalEveningWrestling = monthActiveTrainingDaysWithSessions.some((day) => {
  const morning = day.sessions?.find((session) => session.name === "УТРО");
  const evening = day.sessions?.find((session) => session.name === "ВЕЧЕР");
  return Boolean(morning && evening && sessionHasPhysicalSupport(morning) && sessionHasTechnicalWrestling(evening));
});
const monthAnaerobicDays = monthDraft.plan.weeks.flatMap((week) =>
  week.days.filter((day) => day.blocks.some((block) => block.targetQuality === "anaerobic_power")),
);
const europeCase23Input = {
  ...europePreparationInput,
  context: {
    ...europePreparationInput.context,
    cycleLengthDays: 23,
    sessionsPerWeek: 6,
  },
};
const europeCase23Draft = buildPerformConstructorDraft(europeCase23Input);
const europeCase23Titles = europeCase23Draft.plan.weeks.map((week) => week.title);
const europeCase23ActiveTrainingDays = activeTrainingDays(europeCase23Draft);
const europeCase23ActiveTrainingSessions = activeTrainingSessions(europeCase23Draft);
const europeCase23Payload = buildConstructorTemplatePayload(europeCase23Draft, "Europe case 23");
const europeCase23TemplateActiveSessions = activeTemplateSessions(europeCase23Payload);
const europeCase23HalfDays = europeCase23Draft.plan.weeks.flatMap((week) =>
  week.days.filter((day) => sessionCount(day) === 1),
);
const monthInputWithWrongDevelopmentPhase = {
  ...monthPreparationInput,
  context: {
    ...monthPreparationInput.context,
    currentPhase: "development",
  },
};
const monthWrongPhaseDraft = buildPerformConstructorDraft(monthInputWithWrongDevelopmentPhase);
const monthWrongPhasePhases = monthWrongPhaseDraft.plan.weeks.map((week) => week.phase);
const monthAutoGoalInput = {
  ...monthPreparationInput,
  goals: [
    {
      goalType: "speed_first_action",
      priority: 1,
      reason: "тренер выбрал только скорость, система должна добрать предсоревновательную логику",
    },
  ],
};
const monthAutoGoalDraft = buildPerformConstructorDraft(monthAutoGoalInput);
const monthAutoGoalTargets = new Set(
  monthAutoGoalDraft.plan.weeks.flatMap((week) =>
    week.days.flatMap((day) => day.blocks.map((block) => block.targetQuality)),
  ),
);

const localQualitiesInput = {
  ...europePreparationInput,
  goals: [
    {
      goalType: "legs_lme",
      priority: 1,
      reason: "локальная выносливость ног",
    },
    {
      goalType: "arms_grip",
      priority: 2,
      reason: "руки и хват",
    },
    {
      goalType: "aerobic_base",
      priority: 3,
      reason: "аэробная база",
    },
  ],
};
const localQualitiesDraft = buildPerformConstructorDraft(localQualitiesInput);
const localQualitiesLastWeek = localQualitiesDraft.plan.weeks[localQualitiesDraft.plan.weeks.length - 1];
const localQualitiesTaperTargets = new Set(
  localQualitiesLastWeek.days.flatMap((day) => day.blocks.map((block) => block.targetQuality)),
);
const competitionWeekInput = {
  ...europePreparationInput,
  competition: {
    ...europePreparationInput.competition,
    startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    weighInDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  },
  context: {
    ...europePreparationInput.context,
    currentPhase: "taper",
    cycleLengthDays: 7,
    sessionsPerWeek: 6,
  },
  goals: monthPreparationInput.goals,
};
const competitionWeekDraft = buildPerformConstructorDraft(competitionWeekInput);
const competitionWeekActivationDays = competitionWeekDraft.plan.weeks
  .flatMap((week) => week.days.map((day) => ({ ...day, phase: week.phase })))
  .filter((day) =>
    day.blocks.some(
      (block) =>
        !isWarmupBlock(block) &&
        !isCooldownBlock(block) &&
        (block.type === "activation" || /активац/i.test(`${block.name} ${block.volume}`)),
    ),
  );
const competitionWeekBlocks = competitionWeekDraft.plan.weeks.flatMap((week) =>
  week.days.flatMap((day) => day.blocks),
);

const europe28SeasonStrategy = buildSeasonStrategySnapshot({
  athleteId: "athlete-olga-demo",
  currentDate: "2026-06-08",
  season: {
    id: "season-2026",
    athleteId: "athlete-olga-demo",
    athleteName: "Popova Olga",
    olympicCycleId: "cycle-la-2028",
    olympicCycleName: "LA 2028",
    year: 2026,
    name: "2026 · углублённая специальная подготовка",
    goal: "Подготовка к Европе и миру внутри второго года олимпийского цикла",
    strategyType: "multi_peak",
  },
  olympicCycle: {
    id: "cycle-la-2028",
    name: "LA 2028",
    startDate: "2025-01-01",
    endDate: "2028-12-31",
    targetEvent: "Olympic Games 2028",
    description: "Олимпийский цикл",
  },
  targetCompetitionPlan: {
    id: "plan-europe-2026",
    athleteId: "athlete-olga-demo",
    seasonId: "season-2026",
    seasonName: "2026 · углублённая специальная подготовка",
    seasonYear: 2026,
    competitionId: "competition-europe-2026",
    competitionTitle: "Чемпионат Европы",
    competitionStartDate: "2026-07-06",
    competitionEndDate: "2026-07-07",
    priority: "A",
    planType: "main",
    peakRequired: true,
    taperDays: 10,
    weightCutRequired: true,
    targetWeight: 57,
    currentWeight: 58.2,
    expectedMatches: 4,
    competitionFormat: "tournament",
    prepStartDate: "2026-06-08",
    prepEndDate: "2026-07-05",
    notes: "Главный старт",
  },
  targetCompetition: {
    id: "competition-europe-2026",
    title: "Чемпионат Европы",
    startDate: "2026-07-06",
    endDate: "2026-07-07",
    level: "continental",
    location: "Europe",
  },
  competitionPlans: [
    {
      id: "plan-control-2026",
      athleteId: "athlete-olga-demo",
      seasonId: "season-2026",
      competitionId: "competition-control-2026",
      competitionTitle: "Контрольный старт",
      competitionStartDate: "2026-05-20",
      competitionEndDate: "2026-05-20",
      priority: "C",
      planType: "control",
      peakRequired: false,
      taperDays: 2,
      weightCutRequired: false,
    },
    {
      id: "plan-europe-2026",
      athleteId: "athlete-olga-demo",
      seasonId: "season-2026",
      competitionId: "competition-europe-2026",
      competitionTitle: "Чемпионат Европы",
      competitionStartDate: "2026-07-06",
      competitionEndDate: "2026-07-07",
      priority: "A",
      planType: "main",
      peakRequired: true,
      taperDays: 10,
      weightCutRequired: true,
    },
  ],
});
const europe28StrategyDraft = buildPerformConstructorDraft({
  ...monthPreparationInput,
  competition: {
    ...monthPreparationInput.competition,
    name: "Чемпионат Европы",
    startDate: "2026-07-06",
    weighInDate: "2026-07-05",
  },
  athlete: {
    ...monthPreparationInput.athlete,
    athleteId: "athlete-olga-demo",
    fullName: "Popova Olga",
  },
  context: {
    ...monthPreparationInput.context,
    currentPhase: "development",
    cycleLengthDays: 30,
  },
  goals: [
    {
      goalType: "speed_first_action",
      priority: 1,
      reason: "тренер выбрал резкость, стратегия должна нормализовать режим",
    },
  ],
  seasonStrategy: europe28SeasonStrategy,
});
const fourDayStartStrategy = buildSeasonStrategySnapshot({
  athleteId: "athlete-volga-demo",
  currentDate: "2026-06-08",
  season: {
    id: "season-volga-2026",
    athleteId: "athlete-volga-demo",
    athleteName: "Volga Athlete",
    olympicCycleId: "cycle-la-2028",
    olympicCycleName: "LA 2028",
    year: 2026,
    name: "2026 · углублённая специальная подготовка",
    goal: "Подготовка к ближайшему старту",
    strategyType: "multi_peak",
  },
  olympicCycle: {
    id: "cycle-la-2028",
    name: "LA 2028",
    startDate: "2025-01-01",
    endDate: "2028-12-31",
    targetEvent: "Olympic Games 2028",
    description: "Олимпийский цикл",
  },
  targetCompetitionPlan: {
    id: "plan-udlog-2026",
    athleteId: "athlete-volga-demo",
    seasonId: "season-volga-2026",
    competitionId: "competition-udlog-2026",
    competitionTitle: "Удлож",
    competitionStartDate: "2026-06-12",
    competitionEndDate: "2026-06-12",
    priority: "A",
    planType: "main",
    peakRequired: true,
    taperDays: 4,
    weightCutRequired: false,
    expectedMatches: 4,
  },
  targetCompetition: {
    id: "competition-udlog-2026",
    title: "Удлож",
    startDate: "2026-06-12",
    endDate: "2026-06-12",
    level: "continental",
    location: "Europe",
  },
});
const fourDayStartDraft = buildPerformConstructorDraft({
  ...competitionWeekInput,
  competition: {
    ...competitionWeekInput.competition,
    name: "Удлож",
    startDate: "2026-06-12",
    weighInDate: "2026-06-11",
  },
  athlete: {
    ...competitionWeekInput.athlete,
    athleteId: "athlete-volga-demo",
    fullName: "Volga Athlete",
  },
  context: {
    ...competitionWeekInput.context,
    currentPhase: "taper",
    cycleLengthDays: 7,
    sessionsPerWeek: 6,
  },
  seasonStrategy: fourDayStartStrategy,
});
const fourDayStartActiveDays = activeTrainingDays(fourDayStartDraft);
const fourDayStartDays = fourDayStartDraft.plan.weeks.flatMap((week) => week.days);
const fourDayStartMatDays = fourDayStartDays.filter((day) =>
  (day.sessions ?? []).some(sessionHasMatBlock),
);
const fourDayStartTargets = new Set(
  fourDayStartDays.flatMap((day) => day.blocks.map((block) => block.targetQuality)),
);
const matrixBlocks = {
  legLmv: matrixBlock("leg_lmv"),
  spp: matrixBlock("spp"),
  matCompetitionModel: matrixBlock("mat_competition_model"),
  matControlBouts: matrixBlock("mat_control_bouts"),
  matLightTechnical: matrixBlock("mat_light_technical"),
  firstActionSpeed: matrixBlock("first_action_speed"),
  gpp: matrixBlock("gpp"),
  mobility: matrixBlock("mobility"),
  recovery: matrixBlock("recovery"),
  travel: matrixBlock("travel"),
  weighIn: matrixBlock("weigh_in"),
  postCompetitionRecovery: matrixBlock("post_competition_recovery"),
};
const mainStart28Context = {
  preparationPhase: "special_pre_competition",
  competitionRole: "main_peak",
  daysUntilStart: 28,
  isMainStart: true,
  weekType: "pre_competition",
  dayType: "competition_model",
  sessionSlot: "morning",
};
const mainStart21Context = {
  preparationPhase: "special_pre_competition",
  competitionRole: "main_peak",
  daysUntilStart: 21,
  isMainStart: true,
  weekType: "pre_competition",
  dayType: "spp_day",
  sessionSlot: "morning",
};
const mainStart10Context = {
  preparationPhase: "direct_pre_competition",
  competitionRole: "main_peak",
  daysUntilStart: 10,
  isMainStart: true,
  weekType: "taper",
  dayType: "light_training",
  sessionSlot: "morning",
};
const mainStart3Context = {
  preparationPhase: "competition",
  competitionRole: "main_peak",
  daysUntilStart: 3,
  isMainStart: true,
  weekType: "competition",
  dayType: "light_training",
  sessionSlot: "morning",
};
const travelContext = {
  preparationPhase: "direct_pre_competition",
  competitionRole: "main_peak",
  daysUntilStart: 6,
  isMainStart: true,
  isTravelDay: true,
  sessionSlot: "morning",
};
const weighInContext = {
  preparationPhase: "competition",
  competitionRole: "main_peak",
  daysUntilStart: 1,
  isMainStart: true,
  isWeighInDay: true,
  sessionSlot: "morning",
};
const postCompetitionContext = {
  preparationPhase: "transition_recovery",
  competitionRole: "main_peak",
  daysUntilStart: -1,
  isMainStart: true,
  isPostCompetitionDay: true,
  sessionSlot: "morning",
};
const secondaryDevelopmentContext = {
  preparationPhase: "special_preparation",
  competitionRole: "secondary_peak",
  daysUntilStart: 21,
  isMainStart: false,
  weekType: "development",
  dayType: "gpp_day",
  sessionSlot: "morning",
};
const farDevelopmentContext = {
  preparationPhase: "general_preparation",
  competitionRole: "main_peak",
  daysUntilStart: 90,
  isMainStart: true,
  weekType: "development",
  dayType: "heavy_training",
  sessionSlot: "morning",
};
const matrixTemplateCompatibility = CONSTRUCTOR_TEMPLATE_CARDS.map((card) =>
  classifyConstructorTemplateCard(card.id),
);
const skeleton28 = buildMatrixDrivenWeekSkeleton({
  competitionRole: "main_peak",
  isMainStart: true,
  daysUntilStart: 28,
  cycleLengthDays: 28,
  preparationPhase: "special_pre_competition",
  startDate: "2026-07-06",
  weighInDate: "2026-07-05",
  travelRequired: true,
});
const skeleton21 = buildMatrixDrivenWeekSkeleton({
  competitionRole: "main_peak",
  isMainStart: true,
  daysUntilStart: 21,
  cycleLengthDays: 21,
  preparationPhase: "special_pre_competition",
  startDate: "2026-07-06",
  weighInDate: "2026-07-05",
});
const skeleton10 = buildMatrixDrivenWeekSkeleton({
  competitionRole: "main_peak",
  isMainStart: true,
  daysUntilStart: 10,
  cycleLengthDays: 10,
  preparationPhase: "direct_pre_competition",
  startDate: "2026-07-06",
  weighInDate: "2026-07-05",
});
const skeleton3 = buildMatrixDrivenWeekSkeleton({
  competitionRole: "main_peak",
  isMainStart: true,
  daysUntilStart: 3,
  cycleLengthDays: 3,
  preparationPhase: "competition",
  startDate: "2026-07-06",
  weighInDate: "2026-07-05",
});
const skeletonTravel = buildMatrixDrivenWeekSkeleton({
  competitionRole: "main_peak",
  isMainStart: true,
  daysUntilStart: 2,
  cycleLengthDays: 1,
  preparationPhase: "competition",
  startDate: "2026-07-06",
  weighInDate: "2026-07-05",
  travelRequired: true,
});
const skeletonWeighIn = buildMatrixDrivenWeekSkeleton({
  competitionRole: "main_peak",
  isMainStart: true,
  daysUntilStart: 1,
  cycleLengthDays: 1,
  preparationPhase: "competition",
  startDate: "2026-07-06",
  weighInDate: "2026-07-05",
});
const skeletonCompetitionDay = buildMatrixDrivenWeekSkeleton({
  competitionRole: "main_peak",
  isMainStart: true,
  daysUntilStart: 0,
  cycleLengthDays: 1,
  preparationPhase: "competition",
  startDate: "2026-07-06",
});
const skeletonPostCompetition = buildMatrixDrivenWeekSkeleton({
  competitionRole: "main_peak",
  isMainStart: true,
  daysUntilStart: -1,
  cycleLengthDays: 1,
  preparationPhase: "transition_recovery",
  startDate: "2026-07-06",
});
const skeletonSecondary = buildMatrixDrivenWeekSkeleton({
  competitionRole: "secondary_peak",
  isMainStart: false,
  daysUntilStart: 45,
  cycleLengthDays: 7,
  preparationPhase: "special_preparation",
  startDate: "2026-07-24",
});
const skeletonFarDevelopment = buildMatrixDrivenWeekSkeleton({
  competitionRole: "main_peak",
  isMainStart: true,
  daysUntilStart: 90,
  cycleLengthDays: 7,
  preparationPhase: "general_preparation",
  startDate: "2026-09-06",
});
const skeletonFromConstructorInput = buildMatrixDrivenWeekSkeleton({
  ...monthPreparationInput,
  competition: {
    ...monthPreparationInput.competition,
    name: "Чемпионат Европы",
    startDate: "2026-07-06",
    weighInDate: "2026-07-05",
    travelRequired: true,
  },
  athlete: {
    ...monthPreparationInput.athlete,
    athleteId: "athlete-olga-demo",
    fullName: "Popova Olga",
  },
  context: {
    ...monthPreparationInput.context,
    currentPhase: "development",
    cycleLengthDays: 30,
  },
  seasonStrategy: europe28SeasonStrategy,
});
function matrixPlanInput({
  daysToStart,
  cycleLengthDays,
  phase,
  role = "main_peak",
  priority = "A",
  level = "continental",
  travelRequired = false,
  startDate = "2026-07-06",
  weighInDate = "2026-07-05",
}) {
  return {
    ...monthPreparationInput,
    competition: {
      ...monthPreparationInput.competition,
      name: role === "main_peak" ? "Чемпионат Европы" : "Контрольный старт",
      priority,
      level,
      startDate,
      weighInDate,
      travelRequired,
    },
    context: {
      ...monthPreparationInput.context,
      currentPhase: phase,
      cycleLengthDays,
      sessionsPerWeek: 6,
      sessionsPerDay: 2,
    },
    seasonStrategy: {
      ...europe28SeasonStrategy,
      currentWindow: {
        ...europe28SeasonStrategy.currentWindow,
        daysToStart,
        cycleLengthDays,
        phase,
      },
      targetCompetition: {
        ...europe28SeasonStrategy.targetCompetition,
        role,
      },
    },
  };
}
const matrixDraft28 = buildMatrixDrivenPlanDraft(
  matrixPlanInput({
    daysToStart: 28,
    cycleLengthDays: 28,
    phase: "special_preparation",
    travelRequired: true,
  }),
);
const matrixDraft21 = buildMatrixDrivenPlanDraft(
  matrixPlanInput({
    daysToStart: 21,
    cycleLengthDays: 21,
    phase: "special_preparation",
  }),
);
const matrixDraft10 = buildMatrixDrivenPlanDraft(
  matrixPlanInput({
    daysToStart: 10,
    cycleLengthDays: 10,
    phase: "taper",
  }),
);
const matrixDraft3 = buildMatrixDrivenPlanDraft(
  matrixPlanInput({
    daysToStart: 3,
    cycleLengthDays: 3,
    phase: "start_window",
  }),
);
const matrixDraftTravel = buildMatrixDrivenPlanDraft(
  matrixPlanInput({
    daysToStart: 2,
    cycleLengthDays: 1,
    phase: "start_window",
    travelRequired: true,
  }),
);
const matrixDraftWeighIn = buildMatrixDrivenPlanDraft(
  matrixPlanInput({
    daysToStart: 1,
    cycleLengthDays: 1,
    phase: "start_window",
  }),
);
const matrixDraftCompetitionDay = buildMatrixDrivenPlanDraft(
  matrixPlanInput({
    daysToStart: 0,
    cycleLengthDays: 1,
    phase: "start_window",
    weighInDate: "2026-07-05",
  }),
);
const matrixDraftPostCompetition = buildMatrixDrivenPlanDraft(
  matrixPlanInput({
    daysToStart: -1,
    cycleLengthDays: 1,
    phase: "recovery",
    startDate: "2026-07-06",
    weighInDate: "2026-07-05",
  }),
);
const matrixDraftSecondary = buildMatrixDrivenPlanDraft(
  matrixPlanInput({
    daysToStart: 21,
    cycleLengthDays: 7,
    phase: "special_preparation",
    role: "secondary_peak",
    priority: "B",
    level: "national",
  }),
);
const matrixDraftFarDevelopment = buildMatrixDrivenPlanDraft(
  matrixPlanInput({
    daysToStart: 90,
    cycleLengthDays: 7,
    phase: "base",
    role: "main_peak",
    priority: "A",
    level: "continental",
    startDate: "2026-09-06",
    weighInDate: "2026-09-05",
  }),
  { explanationDepth: "detailed" },
);
const matrixDraftSkeletonOnly = buildMatrixDrivenPlanDraft(
  matrixPlanInput({
    daysToStart: 28,
    cycleLengthDays: 28,
    phase: "special_preparation",
  }),
  { mode: "skeleton_only" },
);
const matrixConstructorDraft28 = buildMatrixDrivenConstructorDraft(
  matrixPlanInput({
    daysToStart: 28,
    cycleLengthDays: 28,
    phase: "special_preparation",
    travelRequired: true,
  }),
);
const matrixConstructorDraft21 = buildMatrixDrivenConstructorDraft(
  matrixPlanInput({
    daysToStart: 21,
    cycleLengthDays: 21,
    phase: "special_preparation",
  }),
);
const matrixConstructorDraft10 = buildMatrixDrivenConstructorDraft(
  matrixPlanInput({
    daysToStart: 10,
    cycleLengthDays: 10,
    phase: "taper",
  }),
);
const matrixConstructorDraft3 = buildMatrixDrivenConstructorDraft(
  matrixPlanInput({
    daysToStart: 3,
    cycleLengthDays: 3,
    phase: "start_window",
  }),
);
const matrixConstructorDraftTravel = buildMatrixDrivenConstructorDraft(
  matrixPlanInput({
    daysToStart: 2,
    cycleLengthDays: 1,
    phase: "start_window",
    travelRequired: true,
  }),
);
const matrixConstructorDraftWeighIn = buildMatrixDrivenConstructorDraft(
  matrixPlanInput({
    daysToStart: 1,
    cycleLengthDays: 1,
    phase: "start_window",
  }),
);
const matrixConstructorDraftCompetitionDay = buildMatrixDrivenConstructorDraft(
  matrixPlanInput({
    daysToStart: 0,
    cycleLengthDays: 1,
    phase: "start_window",
  }),
);
const matrixConstructorDraftPostCompetition = buildMatrixDrivenConstructorDraft(
  matrixPlanInput({
    daysToStart: -1,
    cycleLengthDays: 1,
    phase: "recovery",
  }),
);
const matrixConstructorDraftSecondary = buildMatrixDrivenConstructorDraft(
  matrixPlanInput({
    daysToStart: 21,
    cycleLengthDays: 7,
    phase: "special_preparation",
    role: "secondary_peak",
    priority: "B",
    level: "national",
  }),
);
const matrixConstructorDraftFarDevelopment = buildMatrixDrivenConstructorDraft(
  matrixPlanInput({
    daysToStart: 90,
    cycleLengthDays: 7,
    phase: "base",
    role: "main_peak",
    priority: "A",
    level: "continental",
    startDate: "2026-09-06",
    weighInDate: "2026-09-05",
  }),
);
const comparison28 = compareLegacyAndMatrixConstructorDrafts(
  matrixPlanInput({
    daysToStart: 28,
    cycleLengthDays: 28,
    phase: "special_preparation",
    travelRequired: true,
  }),
);
const comparison21 = compareLegacyAndMatrixConstructorDrafts(
  matrixPlanInput({
    daysToStart: 21,
    cycleLengthDays: 21,
    phase: "special_preparation",
  }),
);
const comparison10 = compareLegacyAndMatrixConstructorDrafts(
  matrixPlanInput({
    daysToStart: 10,
    cycleLengthDays: 10,
    phase: "taper",
  }),
);
const comparison3 = compareLegacyAndMatrixConstructorDrafts(
  matrixPlanInput({
    daysToStart: 3,
    cycleLengthDays: 3,
    phase: "start_window",
  }),
);
const comparisonTravel = compareLegacyAndMatrixConstructorDrafts(
  matrixPlanInput({
    daysToStart: 2,
    cycleLengthDays: 1,
    phase: "start_window",
    travelRequired: true,
  }),
);
const comparisonWeighIn = compareLegacyAndMatrixConstructorDrafts(
  matrixPlanInput({
    daysToStart: 1,
    cycleLengthDays: 1,
    phase: "start_window",
  }),
);
const comparisonCompetitionDay = compareLegacyAndMatrixConstructorDrafts(
  matrixPlanInput({
    daysToStart: 0,
    cycleLengthDays: 1,
    phase: "start_window",
  }),
);
const comparisonPostCompetition = compareLegacyAndMatrixConstructorDrafts(
  matrixPlanInput({
    daysToStart: -1,
    cycleLengthDays: 1,
    phase: "recovery",
  }),
);
const comparisonSecondary = compareLegacyAndMatrixConstructorDrafts(
  matrixPlanInput({
    daysToStart: 21,
    cycleLengthDays: 7,
    phase: "special_preparation",
    role: "secondary_peak",
    priority: "B",
    level: "national",
  }),
);
const comparisonFarDevelopment = compareLegacyAndMatrixConstructorDrafts(
  matrixPlanInput({
    daysToStart: 90,
    cycleLengthDays: 7,
    phase: "base",
    role: "main_peak",
    priority: "A",
    level: "continental",
    startDate: "2026-09-06",
    weighInDate: "2026-09-05",
  }),
  { includeInfo: true },
);
const previewInput28 = matrixPlanInput({
  daysToStart: 28,
  cycleLengthDays: 28,
  phase: "special_preparation",
  travelRequired: true,
});
const previewInput28Snapshot = JSON.stringify(previewInput28);
const previewLegacyBefore = buildPerformConstructorDraft(previewInput28);
const preview28 = buildConstructorComparisonPreview(previewInput28);
const previewLegacyAfter = buildPerformConstructorDraft(previewInput28);
const preview3 = buildConstructorComparisonPreview(
  matrixPlanInput({
    daysToStart: 3,
    cycleLengthDays: 3,
    phase: "start_window",
  }),
  { explanationDepth: "detailed" },
);
const preview10 = buildConstructorComparisonPreview(
  matrixPlanInput({
    daysToStart: 10,
    cycleLengthDays: 10,
    phase: "taper",
  }),
);
const previewTravel = buildConstructorComparisonPreview(
  matrixPlanInput({
    daysToStart: 2,
    cycleLengthDays: 1,
    phase: "start_window",
    travelRequired: true,
  }),
);
const previewWeighIn = buildConstructorComparisonPreview(
  matrixPlanInput({
    daysToStart: 1,
    cycleLengthDays: 1,
    phase: "start_window",
  }),
);
const previewCompetitionDay = buildConstructorComparisonPreview(
  matrixPlanInput({
    daysToStart: 0,
    cycleLengthDays: 1,
    phase: "start_window",
  }),
);
const previewPostCompetition = buildConstructorComparisonPreview(
  matrixPlanInput({
    daysToStart: -1,
    cycleLengthDays: 1,
    phase: "recovery",
  }),
);
const previewFarDevelopment = buildConstructorComparisonPreview(
  matrixPlanInput({
    daysToStart: 90,
    cycleLengthDays: 7,
    phase: "base",
    role: "main_peak",
    priority: "A",
    level: "continental",
    startDate: "2026-09-06",
    weighInDate: "2026-09-05",
  }),
  { includeInfoDifferences: true },
);
const previewNoDrafts = buildConstructorComparisonPreview(previewInput28, {
  includeDrafts: false,
  includeSafetyDetails: false,
});
const previewNoReport = buildConstructorComparisonPreview(previewInput28, {
  includeDrafts: false,
  includeComparisonReport: false,
  includeSafetyDetails: false,
  explanationDepth: "short",
});
const apiPreviewInput28Snapshot = JSON.stringify(previewInput28);
const apiPreviewNoDrafts = buildConstructorMatrixPreviewResponse(previewInput28, {
  includeDrafts: false,
  includeComparisonReport: true,
  includeSafetyDetails: false,
  explanationDepth: "normal",
});
const apiPreviewNoReport = buildConstructorMatrixPreviewResponse(previewInput28, {
  includeDrafts: false,
  includeComparisonReport: false,
  includeSafetyDetails: false,
  explanationDepth: "short",
});
const apiPreview3 = buildConstructorMatrixPreviewResponse(
  matrixPlanInput({
    daysToStart: 3,
    cycleLengthDays: 3,
    phase: "start_window",
  }),
  { explanationDepth: "detailed" },
);
const apiPreviewTravel = buildConstructorMatrixPreviewResponse(
  matrixPlanInput({
    daysToStart: 2,
    cycleLengthDays: 1,
    phase: "start_window",
    travelRequired: true,
  }),
);
const apiPreviewWeighIn = buildConstructorMatrixPreviewResponse(
  matrixPlanInput({
    daysToStart: 1,
    cycleLengthDays: 1,
    phase: "start_window",
  }),
);
const rolloutInputFarDevelopment = matrixPlanInput({
  daysToStart: 90,
  cycleLengthDays: 7,
  phase: "base",
  role: "main_peak",
  priority: "A",
  level: "continental",
  startDate: "2026-09-06",
  weighInDate: "2026-09-05",
});
const rolloutInputFarDevelopmentSnapshot = JSON.stringify(rolloutInputFarDevelopment);
const rolloutFarDevelopment = decideMatrixConstructorRollout(rolloutInputFarDevelopment);
const rolloutInputPostCompetition = matrixPlanInput({
  daysToStart: -1,
  cycleLengthDays: 1,
  phase: "recovery",
});
const rolloutPostCompetition = decideMatrixConstructorRollout(rolloutInputPostCompetition);
const rolloutInputTravel = matrixPlanInput({
  daysToStart: 2,
  cycleLengthDays: 1,
  phase: "start_window",
  travelRequired: true,
});
const rolloutTravel = decideMatrixConstructorRollout(rolloutInputTravel);
const rolloutInputWeighIn = matrixPlanInput({
  daysToStart: 1,
  cycleLengthDays: 1,
  phase: "start_window",
});
const rolloutWeighIn = decideMatrixConstructorRollout(rolloutInputWeighIn);
const rolloutInputMainStartD28 = matrixPlanInput({
  daysToStart: 28,
  cycleLengthDays: 28,
  phase: "special_preparation",
});
const rolloutMainStartD28 = decideMatrixConstructorRollout(rolloutInputMainStartD28);
const rolloutInputMainStartD21 = matrixPlanInput({
  daysToStart: 21,
  cycleLengthDays: 21,
  phase: "special_preparation",
});
const rolloutMainStartD21 = decideMatrixConstructorRollout(rolloutInputMainStartD21);
const rolloutInputMainStartD10 = matrixPlanInput({
  daysToStart: 10,
  cycleLengthDays: 10,
  phase: "taper",
});
const rolloutMainStartD10 = decideMatrixConstructorRollout(rolloutInputMainStartD10);
const rolloutInputMainStartD4 = matrixPlanInput({
  daysToStart: 4,
  cycleLengthDays: 4,
  phase: "start_window",
});
const rolloutMainStartD4 = decideMatrixConstructorRollout(rolloutInputMainStartD4);
const rolloutInputMainStartD3 = matrixPlanInput({
  daysToStart: 3,
  cycleLengthDays: 3,
  phase: "start_window",
});
const rolloutMainStartD3 = decideMatrixConstructorRollout(rolloutInputMainStartD3);
const rolloutInputCompetitionDay = matrixPlanInput({
  daysToStart: 0,
  cycleLengthDays: 1,
  phase: "start_window",
});
const rolloutCompetitionDay = decideMatrixConstructorRollout(rolloutInputCompetitionDay);
const rolloutInputUnknown = matrixPlanInput({
  daysToStart: 45,
  cycleLengthDays: 7,
  phase: "special_preparation",
  role: "main_peak",
  priority: "A",
  level: "continental",
  startDate: "2026-08-20",
  weighInDate: "2026-08-19",
});
const rolloutUnknown = decideMatrixConstructorRollout(rolloutInputUnknown);
const rolloutDisabled = decideMatrixConstructorRollout(rolloutInputFarDevelopment, {
  disabled: true,
  disabledReason: "Synthetic rollout disabled check.",
});
const readinessInputFarDevelopmentSnapshot = JSON.stringify(rolloutInputFarDevelopment);
const readinessFarDevelopment = evaluateMatrixPilotReadiness(rolloutInputFarDevelopment);
const readinessPostCompetition = evaluateMatrixPilotReadiness(rolloutInputPostCompetition);
const readinessTravel = evaluateMatrixPilotReadiness(rolloutInputTravel);
const readinessWeighIn = evaluateMatrixPilotReadiness(rolloutInputWeighIn);
const readinessMainStartD28 = evaluateMatrixPilotReadiness(rolloutInputMainStartD28);
const readinessMainStartD21 = evaluateMatrixPilotReadiness(rolloutInputMainStartD21);
const readinessMainStartD10 = evaluateMatrixPilotReadiness(rolloutInputMainStartD10);
const readinessMainStartD4 = evaluateMatrixPilotReadiness(rolloutInputMainStartD4);
const readinessMainStartD3 = evaluateMatrixPilotReadiness(rolloutInputMainStartD3);
const readinessCompetitionDay = evaluateMatrixPilotReadiness(rolloutInputCompetitionDay);
const readinessUnknown = evaluateMatrixPilotReadiness(rolloutInputUnknown);
const readinessFarDevelopmentSummary = summarizeMatrixPilotReadiness(readinessFarDevelopment);
const readinessD3Blockers = getMatrixPilotReadinessBlockers(readinessMainStartD3);
const matrixIfAllowedFarDevelopment = buildMatrixConstructorDraftIfAllowed(rolloutInputFarDevelopment);
const matrixIfAllowedD4 = buildMatrixConstructorDraftIfAllowed(rolloutInputMainStartD4);
const matrixIfAllowedD3Fallback = buildMatrixConstructorDraftIfAllowed(
  matrixPlanInput({
    daysToStart: 3,
    cycleLengthDays: 3,
    phase: "start_window",
  }),
);
const matrixIfAllowedD3Blocked = buildMatrixConstructorDraftIfAllowed(
  matrixPlanInput({
    daysToStart: 3,
    cycleLengthDays: 3,
    phase: "start_window",
  }),
  {
    fallbackToLegacy: false,
    requirePrimaryAllowed: true,
  },
);

assert(CONSTRUCTOR_TEMPLATE_CARDS.length >= 6, "Expected first constructor template cards");
assert(draft.plan.weeks.length > 0, "Draft must contain plan weeks");
assert(draft.selectedCards.length > 0, "Draft must select at least one template card");
assert(
  CONSTRUCTOR_TRAINING_BLOCK_LIBRARY.length >= 18,
  "Matrix block library should include the initial constructor blocks",
);
assert(
  matrixTemplateCompatibility.every((item) => item.controlsGeneration === false),
  "Fixed template cards must be inventory sources only, not generation controllers",
);
assert(
  matrixTemplateCompatibility.every((item) => item.trainingBlockTypes.length > 0),
  "Every existing fixed template card should be classified into block-library sources",
);
assert(
  getWeekTypeForContext(mainStart28Context) === "pre_competition",
  "28 days to main start should resolve to a pre-competition week type",
);
assert(
  getDayTypeForContext(mainStart28Context) === "competition_model",
  "Explicit matrix day type should be preserved for 28-day scenario",
);
assert(
  !isTrainingBlockAllowed(matrixBlocks.legLmv, mainStart28Context),
  "28 days to main start must not allow development-heavy leg LMV",
);
assert(
  matrixReasonCodes(matrixBlocks.legLmv, mainStart28Context).includes(
    "development_forbidden_before_main_start",
  ),
  "28-day leg LMV rejection should explicitly mention development ban before main start",
);
assert(
  isTrainingBlockAllowed(matrixBlocks.matCompetitionModel, mainStart28Context),
  "28 days to main start should allow special competition-model work",
);
assert(
  filterAllowedTrainingBlocks(Object.values(matrixBlocks), mainStart28Context).some(
    (block) => block.type === "mat_competition_model",
  ),
  "Matrix filtering should keep allowed special work for 28-day main-start context",
);
assert(
  isTrainingBlockAllowed(matrixBlocks.spp, mainStart21Context),
  "21 days to main start should allow SPP only as maintenance/transfer",
);
assert(
  !isTrainingBlockAllowed(matrixBlocks.legLmv, mainStart21Context),
  "21 days to main start should forbid heavy leg LMV",
);
assert(
  !isTrainingBlockAllowed(matrixBlocks.matControlBouts, mainStart21Context),
  "21-day default SPP day should not allow control bouts unless a competition-model day is explicitly selected",
);
assert(
  !isTrainingBlockAllowed(matrixBlocks.legLmv, mainStart10Context),
  "10 days to main start should forbid development leg LMV during taper",
);
assert(
  !isTrainingBlockAllowed(matrixBlocks.spp, mainStart10Context),
  "10 days to main start should forbid SPP in taper week/day context",
);
assert(
  isTrainingBlockAllowed(matrixBlocks.matLightTechnical, mainStart10Context),
  "10 days to main start should allow light technical work",
);
assert(
  isTrainingBlockAllowed(matrixBlocks.recovery, mainStart10Context),
  "10 days to main start should allow recovery",
);
assert(
  getAllowedSessionSlots(mainStart3Context).length === 1 &&
    getAllowedSessionSlots(mainStart3Context)[0] === "morning",
  "3 days to main start should allow only a short single-session slot",
);
assert(
  isTrainingBlockAllowed(matrixBlocks.matLightTechnical, mainStart3Context),
  "3 days to main start should allow only light technical confidence work",
);
assert(
  isTrainingBlockAllowed(matrixBlocks.recovery, mainStart3Context),
  "3 days to main start should allow recovery",
);
assert(
  !isTrainingBlockAllowed(matrixBlocks.legLmv, mainStart3Context),
  "3 days to main start should forbid heavy blocks",
);
assert(
  /развитие запрещено/i.test(explainBlockEligibility(matrixBlocks.legLmv, mainStart3Context).message),
  "3-day rejection explanation should explicitly say development is forbidden",
);
assert(getWeekTypeForContext(travelContext) === "travel_logistics", "Travel day should resolve to logistics week");
assert(getDayTypeForContext(travelContext) === "travel", "Travel day should resolve to travel day type");
assert(
  isTrainingBlockAllowed(matrixBlocks.mobility, travelContext),
  "Travel day should allow mobility/light activation",
);
assert(
  !isTrainingBlockAllowed(matrixBlocks.matCompetitionModel, travelContext),
  "Travel day should forbid heavy or medium competition-model work",
);
assert(
  matrixReasonCodes(matrixBlocks.matCompetitionModel, travelContext).includes("heavy_load_on_travel_day"),
  "Travel-day rejection should explain logistics limitation",
);
assert(getDayTypeForContext(weighInContext) === "weigh_in", "Weigh-in flag should resolve to weigh-in day type");
assert(
  isTrainingBlockAllowed(matrixBlocks.weighIn, weighInContext),
  "Weigh-in day should allow weight-control activation",
);
assert(
  !isTrainingBlockAllowed(matrixBlocks.matCompetitionModel, weighInContext),
  "Weigh-in day should forbid heavy or medium load",
);
assert(
  matrixReasonCodes(matrixBlocks.matCompetitionModel, weighInContext).includes(
    "heavy_load_on_weigh_in_day",
  ),
  "Weigh-in rejection should explain weight-control priority",
);
assert(
  isTrainingBlockAllowed(matrixBlocks.postCompetitionRecovery, postCompetitionContext),
  "Post-competition day should allow recovery",
);
assert(
  !isTrainingBlockAllowed(matrixBlocks.gpp, postCompetitionContext),
  "Post-competition day should forbid development-oriented GPP",
);
assert(
  isTrainingBlockAllowed(matrixBlocks.gpp, secondaryDevelopmentContext),
  "Secondary start should allow softer explicit development context when trainer selects it",
);
assert(
  isTrainingBlockAllowed(matrixBlocks.legLmv, farDevelopmentContext),
  "Far-from-start development week should allow development blocks",
);
assert(skeleton28.generatedFrom === "matrix", "Skeleton should explicitly mark matrix generation source");
assert(skeleton28.weeks.length === 4, `28-day skeleton should build four calendar weeks, got ${skeleton28.weeks.length}`);
assert(skeleton28.weeks[0]?.weekType === "pre_competition", "28-day skeleton should start as pre-competition");
assert(
  skeleton28.weeks.some((week) => week.weekType === "taper"),
  "28-day skeleton should include taper weeks as days get closer to start",
);
assert(
  skeleton28.warnings.some((warning) => warning.code === "fixed_templates_not_controlling"),
  "Skeleton should warn that fixed template cards do not control structure",
);
assert(
  skeletonHasExplanation(skeleton28, /fixed templates не выбирают структуру/i),
  "Skeleton explanations should state that fixed templates are not structural controllers",
);
assert(
  skeletonAllowedBlockTypes(skeleton28).has("mat_competition_model"),
  "28-day skeleton should allow special competition-model work",
);
assert(
  Boolean(skeletonForbiddenCandidate(skeleton28, "leg_lmv")),
  "28-day skeleton should include leg LMV only as a forbidden candidate, not an allowed block",
);
assert(
  skeletonForbiddenCandidate(skeleton28, "leg_lmv").sourceCompatibilityCards.includes("legs_lme_21"),
  "Forbidden skeleton candidates should still expose old-card compatibility metadata",
);
assert(
  skeletonFromConstructorInput.daysUntilStart === 28 &&
    skeletonFromConstructorInput.preparationPhase === "special_pre_competition",
  "Skeleton builder should accept current ConstructorInput with SeasonStrategySnapshot",
);
assert(
  skeleton21.weeks[0]?.recoveryPriority === "mandatory",
  "21-day skeleton should raise recovery priority above far-start development",
);
assert(
  Boolean(skeletonForbiddenCandidate(skeleton21, "leg_lmv")),
  "21-day skeleton should keep heavy leg LMV forbidden/limited",
);
assert(
  skeletonSessions(skeleton21).some((session) => session.forbiddenBlockTypes.includes("mat_control_bouts")),
  "21-day skeleton should limit control bouts outside explicit competition-model slots",
);
assert(
  skeleton10.weeks.every((week) => week.weekType === "taper" || week.weekType === "competition"),
  "10-day skeleton should stay in taper/competition structure",
);
assert(
  !skeletonAllowedBlockTypes(skeleton10).has("leg_lmv") &&
    !skeletonAllowedBlockTypes(skeleton10).has("spp"),
  "10-day skeleton should forbid development/heavy SPP blocks",
);
assert(
  skeletonAllowedBlockTypes(skeleton10).has("mat_light_technical") &&
    skeletonAllowedBlockTypes(skeleton10).has("recovery") &&
    skeletonAllowedBlockTypes(skeleton10).has("mobility"),
  "10-day skeleton should allow light technical, recovery and mobility",
);
assert(
  skeleton3.weeks.length === 1 &&
    skeletonDays(skeleton3).every((day) => day.sessions.length === 1),
  "3-day skeleton should be one short-session start-window week",
);
assert(
  skeletonAllowedBlockTypes(skeleton3).has("mat_light_technical") &&
    skeletonAllowedBlockTypes(skeleton3).has("recovery"),
  "3-day skeleton should allow light technical and recovery",
);
assert(
  !skeletonAllowedBlockTypes(skeleton3).has("leg_lmv") &&
    !skeletonAllowedBlockTypes(skeleton3).has("mat_control_bouts"),
  "3-day skeleton should forbid heavy LMV and control bouts",
);
assert(
  skeletonHasExplanation(skeleton3, /развитие запрещено/i),
  "3-day skeleton should explicitly explain the development ban",
);
assert(
  skeletonDays(skeletonTravel)[0]?.dayType === "travel",
  "Travel skeleton should mark travel day type",
);
assert(
  skeletonAllowedBlockTypes(skeletonTravel).has("mobility") &&
    !skeletonAllowedBlockTypes(skeletonTravel).has("mat_competition_model"),
  "Travel skeleton should allow mobility and forbid heavy/medium competition model work",
);
assert(
  skeletonHasExplanation(skeletonTravel, /дороги/i),
  "Travel skeleton should explain logistics limitation",
);
assert(
  skeletonDays(skeletonWeighIn)[0]?.dayType === "weigh_in",
  "Weigh-in skeleton should mark weigh-in day type",
);
assert(
  skeletonAllowedBlockTypes(skeletonWeighIn).has("weigh_in") &&
    !skeletonAllowedBlockTypes(skeletonWeighIn).has("mat_competition_model"),
  "Weigh-in skeleton should allow weight-control activation and forbid heavy/medium load",
);
assert(
  skeletonHasExplanation(skeletonWeighIn, /взвешивания/i),
  "Weigh-in skeleton should explain weight-control priority",
);
assert(
  skeletonDays(skeletonCompetitionDay)[0]?.dayType === "competition" &&
    skeletonAllowedBlockTypes(skeletonCompetitionDay).has("competition_start"),
  "Competition-day skeleton should allow competition_start block",
);
assert(
  skeletonDays(skeletonCompetitionDay)[0]?.sessions.length === 1 &&
    !skeletonAllowedBlockTypes(skeletonCompetitionDay).has("leg_lmv"),
  "Competition-day skeleton should not look like an ordinary training day",
);
assert(
  skeletonDays(skeletonPostCompetition)[0]?.dayType === "post_competition" &&
    skeletonAllowedBlockTypes(skeletonPostCompetition).has("post_competition_recovery"),
  "Post-competition skeleton should allow post-competition recovery",
);
assert(
  !skeletonAllowedBlockTypes(skeletonPostCompetition).has("gpp"),
  "Post-competition skeleton should forbid development-oriented GPP",
);
assert(
  !skeletonSecondary.warnings.some((warning) => warning.code === "close_main_start"),
  "Secondary-start skeleton should not apply main-start close-window warning",
);
assert(
  skeletonFarDevelopment.weeks[0]?.weekType === "development" &&
    skeletonAllowedBlockTypes(skeletonFarDevelopment).has("leg_lmv") &&
    skeletonAllowedBlockTypes(skeletonFarDevelopment).has("gpp"),
  "Far-start development skeleton should allow development blocks, SPP/GPP and bigger workload",
);
assert(
  skeletonSessions(skeletonFarDevelopment).some((session) => session.slot === "evening"),
  "Far-start development skeleton should allow two-session days where the matrix permits them",
);
assert(matrixDraft28.generatedFrom === "matrix", "Matrix-driven plan draft should mark matrix generation");
assert(
  matrixDraft28.legacyCards.usedAsStructure === false,
  "Matrix-driven plan draft must not use legacy cards as week/day structure",
);
assert(
  matrixDraft28.weeks.length > 0 &&
    matrixDraftDays(matrixDraft28).length > 0 &&
    matrixDraftSessions(matrixDraft28).length > 0,
  "Matrix-driven plan draft should contain weeks, days and sessions",
);
assert(
  matrixDraft28.explanations.length > 0 &&
    matrixDraftRiskCodes(matrixDraft28).size > 0,
  "Matrix-driven plan draft should expose explanations and risk check results",
);
assert(
  matrixDraftBlockTypes(matrixDraft28).has("mat_competition_model"),
  "28-day matrix draft should select special competition-model work when allowed",
);
assert(
  !matrixDraftBlockTypes(matrixDraft28).has("leg_lmv"),
  "28-day matrix draft should not select development-heavy leg LMV before main start",
);
assert(
  matrixDraftRiskCodes(matrixDraft28).has("main_start_development_forbidden") ||
    matrixDraftRiskCodes(matrixDraft28).has("heavy_lmv_too_close_to_start"),
  "28-day matrix draft should risk-check development/heavy LMV rejection",
);
assert(
  matrixDraftHasExplanation(matrixDraft28, /главный старт|development|старые карточки/i),
  "28-day matrix draft should explain main-start phase and legacy-card metadata usage",
);
assert(
  !matrixDraftBlockTypes(matrixDraft21).has("leg_lmv") &&
    !matrixDraftBlockTypes(matrixDraft21).has("mat_control_bouts"),
  "21-day matrix draft should not select heavy leg LMV or control bouts by default",
);
assert(
  matrixDraftRiskCodes(matrixDraft21).has("control_bouts_too_close_to_start"),
  "21-day matrix draft should expose rejected control bouts risk",
);
assert(
  matrixDraftBlocks(matrixDraft21).every((block) => block.volume.loadLevel !== "high"),
  "21-day matrix draft should keep volume controlled",
);
assert(
  !matrixDraftBlockTypes(matrixDraft10).has("leg_lmv") &&
    !matrixDraftBlockTypes(matrixDraft10).has("spp") &&
    !matrixDraftBlockTypes(matrixDraft10).has("mat_control_bouts"),
  "10-day matrix draft should not select heavy development, SPP or control bouts",
);
assert(
  matrixDraftBlockTypes(matrixDraft10).has("mat_light_technical") &&
    (matrixDraftBlockTypes(matrixDraft10).has("recovery") || matrixDraftBlockTypes(matrixDraft10).has("mobility")),
  "10-day matrix draft should select light technical and recovery/mobility work",
);
assert(
  matrixDraftBlocks(matrixDraft10).every((block) => ["very_low", "low"].includes(block.volume.loadLevel)),
  "10-day matrix draft should keep low/very-low taper volume",
);
assert(
  !matrixDraftBlockTypes(matrixDraft3).has("leg_lmv") &&
    !matrixDraftBlockTypes(matrixDraft3).has("mat_control_bouts") &&
    !matrixDraftBlockTypes(matrixDraft3).has("spp"),
  "3-day matrix draft should not select heavy or control blocks",
);
assert(
  matrixDraftBlockTypes(matrixDraft3).has("mat_light_technical") ||
    matrixDraftBlockTypes(matrixDraft3).has("weigh_in") ||
    matrixDraftBlockTypes(matrixDraft3).has("recovery"),
  "3-day matrix draft should select only light activation/recovery blocks",
);
assert(
  matrixDraftHasExplanation(matrixDraft3, /развитие запрещено|Главный старт ближе 30/i),
  "3-day matrix draft should explain development ban near main start",
);
assert(
  !matrixDraftBlocks(matrixDraftTravel).some((block) => ["medium", "high"].includes(block.volume.loadLevel)),
  "Travel-day matrix draft should not select heavy load",
);
assert(
  matrixDraftBlockTypes(matrixDraftTravel).has("mobility") ||
    matrixDraftBlockTypes(matrixDraftTravel).has("recovery"),
  "Travel-day matrix draft should select mobility/recovery/light travel logic",
);
assert(
  matrixDraftRiskCodes(matrixDraftTravel).has("heavy_load_on_travel_day"),
  "Travel-day matrix draft should risk-check heavy travel load rejection",
);
assert(
  !matrixDraftBlockTypes(matrixDraftWeighIn).has("mat_control_bouts") &&
    !matrixDraftBlockTypes(matrixDraftWeighIn).has("mat_competition_model") &&
    !matrixDraftBlockTypes(matrixDraftWeighIn).has("spp"),
  "Weigh-in matrix draft should not select mat/control bouts or SPP",
);
assert(
  matrixDraftBlockTypes(matrixDraftWeighIn).has("weigh_in") ||
    matrixDraftBlockTypes(matrixDraftWeighIn).has("recovery"),
  "Weigh-in matrix draft should select short activation/recovery",
);
assert(
  matrixDraftBlockTypes(matrixDraftCompetitionDay).has("competition_start"),
  "Competition-day matrix draft should select competition_start",
);
assert(
  matrixDraftBlocks(matrixDraftCompetitionDay).every((block) => block.blockType === "competition_start"),
  "Competition-day matrix draft should not select ordinary training load",
);
assert(
  matrixDraftBlockTypes(matrixDraftPostCompetition).has("post_competition_recovery") ||
    matrixDraftBlockTypes(matrixDraftPostCompetition).has("recovery"),
  "Post-competition matrix draft should select recovery",
);
assert(
  !matrixDraftBlockTypes(matrixDraftPostCompetition).has("leg_lmv") &&
    !matrixDraftBlockTypes(matrixDraftPostCompetition).has("mat_control_bouts"),
  "Post-competition matrix draft should not select development/contact stress",
);
assert(
  !matrixDraftSecondary.warnings.some((warning) => warning.code === "close_main_start"),
  "Secondary-start matrix draft should keep softer role-specific warnings than main start",
);
assert(
  !matrixDraftBlockTypes(matrixDraftSecondary).has("leg_lmv"),
  "Secondary close-start matrix draft should still cut obvious risky heavy LMV",
);
assert(
  matrixDraftBlockTypes(matrixDraftFarDevelopment).has("leg_lmv") &&
    (matrixDraftBlockTypes(matrixDraftFarDevelopment).has("gpp") ||
      matrixDraftBlockTypes(matrixDraftFarDevelopment).has("spp")),
  "Far-start matrix draft should allow development and SPP/GPP blocks",
);
assert(
  matrixDraftBlocks(matrixDraftFarDevelopment).some((block) => block.volume.loadLevel === "high") &&
    matrixDraftSessions(matrixDraftFarDevelopment).some((session) => session.slot === "evening"),
  "Far-start matrix draft should allow larger workload and two-session days",
);
assert(
  matrixDraftSkeletonOnly.mode === "skeleton_only" &&
    matrixDraftSkeletonOnly.weeks.length === 0 &&
    matrixDraftSkeletonOnly.skeleton.weeks.length > 0,
  "Skeleton-only matrix option should not build plan weeks",
);
assert(
  matrixConstructorDraft28.generatedFrom === "matrix" &&
    matrixConstructorDraft28.matrix.draft.generatedFrom === "matrix",
  "Controlled matrix adapter should return matrix-generated constructor draft",
);
assert(
  matrixConstructorDraft28.plan.weeks.length > 0 &&
    constructorDraftDays(matrixConstructorDraft28).length > 0 &&
    constructorDraftSessions(matrixConstructorDraft28).length > 0,
  "Controlled matrix adapter should expose constructor-compatible weeks, days and sessions",
);
assert(
  constructorDraftBlocks(matrixConstructorDraft28).length > 0,
  "Controlled matrix adapter should convert selected matrix blocks into ConstructorPlanBlock entries",
);
assert(
  matrixConstructorDraft28.matrix.legacyCards.usedAsStructure === false &&
    constructorDraftHasText(matrixConstructorDraft28, /календарь старта|старые карточки используются только как источники контента/i),
  "Controlled matrix adapter should explain calendar-driven generation and content-only legacy behavior",
);
assert(
  matrixConstructorDraft28.riskFlags.length > 0 &&
    matrixConstructorDraft28.matrix.draft.riskChecks.some((risk) =>
      ["main_start_development_forbidden", "heavy_lmv_too_close_to_start"].includes(risk.code),
    ) &&
    /Развивающая нагрузка запрещена|локальная мышечная выносливость/i.test(
      matrixConstructorDraft28.explanation.riskImpact,
    ),
  "Controlled matrix adapter should preserve matrix risk checks in constructor-compatible output",
);
assert(
  !constructorDraftBlocks(matrixConstructorDraft28).some((block) =>
    /ЛМВ ног/i.test(block.name),
  ),
  "28-day adapted matrix draft should not include heavy leg LMV",
);
assert(
  constructorDraftBlocks(matrixConstructorDraft28).some((block) =>
    /Соревновательная модель/i.test(block.name),
  ),
  "28-day adapted matrix draft should include special competition-model work",
);
assert(
  !constructorDraftBlocks(matrixConstructorDraft21).some((block) =>
    /ЛМВ ног|контрольные схватки/i.test(block.name),
  ),
  "21-day adapted matrix draft should not include heavy LMV or control bouts",
);
assert(
  /Контрольные схватки слишком близко к старту/i.test(matrixConstructorDraft21.explanation.riskImpact),
  "21-day adapted matrix draft should retain control-bout rejection risk",
);
assert(
  !constructorDraftBlocks(matrixConstructorDraft10).some((block) =>
    /ЛМВ ног|СФП с переносом|контрольные схватки/i.test(block.name),
  ),
  "10-day adapted matrix draft should not include heavy development/SPP/control bouts",
);
assert(
  constructorDraftBlocks(matrixConstructorDraft10).some((block) =>
    /Лёгкая техника|Заминка|Мобилити|восстанов/i.test(block.name),
  ),
  "10-day adapted matrix draft should include light technical/recovery work",
);
assert(
  !constructorDraftBlocks(matrixConstructorDraft3).some((block) =>
    /ЛМВ ног|СФП с переносом|контрольные схватки/i.test(block.name),
  ),
  "3-day adapted matrix draft should not include heavy/control/development blocks",
);
assert(
  constructorDraftHasText(matrixConstructorDraft3, /Развивающие цели запрещены|Развивающая нагрузка запрещена|развитие/i),
  "3-day adapted matrix draft should explain development ban near main start",
);
assert(
  constructorDraftBlocks(matrixConstructorDraftTravel).every((block) => !/нагрузка high|нагрузка medium/.test(block.volume)) &&
    constructorDraftBlocks(matrixConstructorDraftTravel).some((block) =>
      /Мобилити|Заминка|восстанов/i.test(block.name),
    ),
  "Travel adapted matrix draft should keep light logistics blocks",
);
assert(
  constructorDraftHasText(matrixConstructorDraftTravel, /travel|дорог|logistics/i),
  "Travel adapted matrix draft should preserve logistics explanation",
);
assert(
  !constructorDraftBlocks(matrixConstructorDraftWeighIn).some((block) =>
    /контрольные схватки|Соревновательная модель|СФП с переносом/i.test(block.name),
  ),
  "Weigh-in adapted matrix draft should not include mat/control/SFP blocks",
);
assert(
  constructorDraftHasText(matrixConstructorDraftWeighIn, /взвеш|weight/i),
  "Weigh-in adapted matrix draft should preserve weight-control explanation",
);
assert(
  constructorDraftBlocks(matrixConstructorDraftCompetitionDay).every((block) =>
    /Разминка|Старт соревнования|Заминка/i.test(block.name),
  ),
  "Competition-day adapted matrix draft should only include competition_start",
);
assert(
  constructorDraftBlocks(matrixConstructorDraftPostCompetition).some((block) =>
    /восстанов|Мобилити|Заминка/i.test(block.name),
  ) &&
    !constructorDraftBlocks(matrixConstructorDraftPostCompetition).some((block) =>
      /ЛМВ ног/i.test(block.name),
    ),
  "Post-competition adapted matrix draft should include recovery and no development",
);
assert(
  !matrixConstructorDraftSecondary.matrix.draft.warnings.some((warning) => warning.code === "close_main_start") &&
    !constructorDraftBlocks(matrixConstructorDraftSecondary).some((block) =>
      /ЛМВ ног/i.test(block.name),
    ),
  "Secondary adapted matrix draft should be softer than main start but still cut risky close-start LMV",
);
assert(
  constructorDraftBlocks(matrixConstructorDraftFarDevelopment).some((block) =>
    /ЛМВ ног|СФП ног/i.test(block.name),
  ) &&
    constructorDraftBlocks(matrixConstructorDraftFarDevelopment).some((block) =>
      /ОФП|СФП с переносом/i.test(block.name),
    ) &&
    constructorDraftSessions(matrixConstructorDraftFarDevelopment).some((session) => session.name === "ВЕЧЕР"),
  "Far development adapted matrix draft should allow development, SPP/GPP and two-session days",
);
assert(
  draft.generatedFrom === undefined &&
    draft.plan.weeks.length > 0 &&
    draft.selectedCards.length > 0,
  "Default buildPerformConstructorDraft should remain legacy-compatible and not become matrix by default",
);
assert(
  comparison28.generatedFrom === "legacy_matrix_comparison" &&
    comparison28.legacyDraft.plan.weeks.length > 0 &&
    comparison28.matrixDraft.generatedFrom === "matrix",
  "Comparison report should dual-run legacy and matrix drafts",
);
assert(
  comparison28.summary.safeToPreview &&
    comparison28.summary.legacyDefaultUnchanged &&
    comparison28.summary.expectedDifferenceCount > 0,
  "28-day comparison should be safe to preview and mark expected legacy/matrix differences",
);
assert(
  comparison28.matrixSafetyInvariants.every((item) => item.passed || item.severity !== "error"),
  "28-day comparison should pass matrix safety invariants",
);
assert(
  comparison28.differences.some((item) => item.category === "legacy_template_dependency"),
  "28-day comparison should explicitly report legacy template dependency difference",
);
assert(
  !constructorDraftBlocks(comparison28.matrixDraft).some((block) =>
    /ЛМВ ног/i.test(block.name),
  ) &&
    constructorDraftBlocks(comparison28.matrixDraft).some((block) =>
      /Соревновательная модель/i.test(block.name),
    ),
  "28-day comparison matrix draft should keep special work and reject heavy development",
);
assert(
  comparison21.summary.safeToPreview &&
    !constructorDraftBlocks(comparison21.matrixDraft).some((block) =>
      /ЛМВ ног|контрольные схватки/i.test(block.name),
    ) &&
    /Контрольные схватки слишком близко к старту/i.test(comparison21.matrixDraft.explanation.riskImpact),
  "21-day comparison should show controlled volume and rejected control/LMV blocks",
);
assert(
  comparison10.summary.safeToPreview &&
    !constructorDraftBlocks(comparison10.matrixDraft).some((block) =>
      /ЛМВ ног|СФП с переносом|контрольные схватки/i.test(block.name),
    ) &&
    constructorDraftBlocks(comparison10.matrixDraft).some((block) =>
      /Лёгкая техника|Заминка|Мобилити|восстанов/i.test(block.name),
    ),
  "10-day comparison should show taper/direct pre-comp matrix behavior",
);
assert(
  comparison3.summary.safeToPreview &&
    !constructorDraftBlocks(comparison3.matrixDraft).some((block) =>
      /ЛМВ ног|СФП с переносом|контрольные схватки/i.test(block.name),
    ) &&
    constructorDraftHasText(comparison3.matrixDraft, /Развивающие цели запрещены|Развивающая нагрузка запрещена|развитие/i),
  "3-day comparison should keep safety invariant green and explain close-start development ban",
);
assert(
  comparisonTravel.summary.safeToPreview &&
    constructorDraftBlocks(comparisonTravel.matrixDraft).every((block) => !/нагрузка high|нагрузка medium/.test(block.volume)) &&
    constructorDraftHasText(comparisonTravel.matrixDraft, /travel|дорог|logistics/i),
  "Travel comparison should show no heavy load and logistics explanation",
);
assert(
  comparisonWeighIn.summary.safeToPreview &&
    !constructorDraftBlocks(comparisonWeighIn.matrixDraft).some((block) =>
      /контрольные схватки|Соревновательная модель|СФП с переносом/i.test(block.name),
    ) &&
    constructorDraftHasText(comparisonWeighIn.matrixDraft, /взвеш|weight/i),
  "Weigh-in comparison should show short activation/recovery and weight explanation",
);
assert(
  comparisonCompetitionDay.summary.safeToPreview &&
    constructorDraftBlocks(comparisonCompetitionDay.matrixDraft).every((block) =>
      /Разминка|Старт соревнования|Заминка/i.test(block.name),
    ),
  "Competition-day comparison should select competition_start and no ordinary heavy training",
);
assert(
  comparisonPostCompetition.summary.safeToPreview &&
    constructorDraftBlocks(comparisonPostCompetition.matrixDraft).some((block) =>
      /восстанов|Мобилити|Заминка/i.test(block.name),
    ) &&
    !constructorDraftBlocks(comparisonPostCompetition.matrixDraft).some((block) =>
      /ЛМВ ног/i.test(block.name),
    ),
  "Post-competition comparison should select recovery and no development",
);
assert(
  comparisonSecondary.summary.safeToPreview &&
    !comparisonSecondary.matrixDraft.matrix.draft.warnings.some((warning) => warning.code === "close_main_start") &&
    !constructorDraftBlocks(comparisonSecondary.matrixDraft).some((block) =>
      /ЛМВ ног/i.test(block.name),
    ),
  "Secondary comparison should be softer than main start but still reject risky close-start blocks",
);
assert(
  comparisonFarDevelopment.summary.safeToPreview &&
    constructorDraftBlocks(comparisonFarDevelopment.matrixDraft).some((block) =>
      /ЛМВ ног|СФП ног/i.test(block.name),
    ) &&
    constructorDraftBlocks(comparisonFarDevelopment.matrixDraft).some((block) =>
      /ОФП|СФП с переносом/i.test(block.name),
    ) &&
    constructorDraftSessions(comparisonFarDevelopment.matrixDraft).some((session) => session.name === "ВЕЧЕР") &&
    comparisonFarDevelopment.summary.totalDifferences >= comparisonFarDevelopment.summary.expectedDifferenceCount,
  "Far-development comparison should allow development/SPP/GPP and summarize expected differences",
);
assert(
  comparison28.legacyDefaultInvariants.every((item) => item.passed || item.severity !== "error") &&
    comparison28.legacyDraft.generatedFrom === undefined,
  "Legacy default guard should confirm buildPerformConstructorDraft remains legacy by default",
);
assert(
  preview28.generatedFrom === "legacy_matrix_comparison_preview" &&
    preview28.mode === "comparison_preview" &&
    preview28.legacyDraft?.plan.weeks.length > 0 &&
    preview28.matrixDraft?.generatedFrom === "matrix" &&
    preview28.comparisonReport?.generatedFrom === "legacy_matrix_comparison" &&
    preview28.summary.previewMode === "comparison_preview" &&
    preview28.safetyInvariants?.length > 0 &&
    preview28.legacyDefaultGuard?.every((item) => item.passed || item.severity !== "error"),
  "Preview smoke should return legacy draft, matrix draft, comparison report, summary and green legacy guard",
);
assert(
  previewLegacyBefore.generatedFrom === undefined &&
    previewLegacyAfter.generatedFrom === undefined &&
    previewLegacyBefore.plan.weeks.length === previewLegacyAfter.plan.weeks.length &&
    JSON.stringify(previewInput28) === previewInput28Snapshot,
  "Preview should not mutate input or change legacy default output shape",
);
assert(
  preview28.safeToPreview &&
    preview28.safety.safeToPreview &&
    preview28.safety.matrixSafetyPassed &&
    preview28.defaultPathUnchanged &&
    preview28.summary.expectedDifferenceCount > 0,
  "28-day preview should be safe and keep expected differences as non-errors",
);
assert(
  preview10.safeToPreview &&
    preview3.safeToPreview &&
    preview3.summary.safeToPreview &&
    preview3.notes.some((note) => /Top comparison differences|Input summary/i.test(note)),
  "10-day and 3-day previews should be safe, and detailed preview should include explanations",
);
assert(
  !constructorDraftBlocks(preview3.matrixDraft).some((block) =>
    /ЛМВ ног|СФП с переносом|контрольные схватки/i.test(block.name),
  ) &&
    constructorDraftHasText(preview3.matrixDraft, /Развивающие цели запрещены|Развивающая нагрузка запрещена|развитие/i),
  "3-day preview matrix draft should not contain heavy/development/control blocks",
);
assert(
  previewTravel.safeToPreview &&
    constructorDraftBlocks(previewTravel.matrixDraft).every((block) => !/нагрузка high|нагрузка medium/.test(block.volume)) &&
    constructorDraftHasText(previewTravel.matrixDraft, /travel|дорог|logistics/i),
  "Travel preview should keep light logistics load and explanation",
);
assert(
  previewWeighIn.safeToPreview &&
    !constructorDraftBlocks(previewWeighIn.matrixDraft).some((block) =>
      /контрольные схватки|Соревновательная модель|СФП с переносом/i.test(block.name),
    ) &&
    constructorDraftHasText(previewWeighIn.matrixDraft, /взвеш|weight/i),
  "Weigh-in preview should keep short activation/recovery and weight-control explanation",
);
assert(
  previewCompetitionDay.safeToPreview &&
    constructorDraftBlocks(previewCompetitionDay.matrixDraft).every((block) =>
      /Разминка|Старт соревнования|Заминка/i.test(block.name),
    ),
  "Competition-day preview should select competition_start only",
);
assert(
  previewPostCompetition.safeToPreview &&
    constructorDraftBlocks(previewPostCompetition.matrixDraft).some((block) =>
      /восстанов|Мобилити|Заминка/i.test(block.name),
    ) &&
    !constructorDraftBlocks(previewPostCompetition.matrixDraft).some((block) =>
      /ЛМВ ног/i.test(block.name),
    ),
  "Post-competition preview should select recovery and no development",
);
assert(
  previewFarDevelopment.safeToPreview &&
    constructorDraftBlocks(previewFarDevelopment.matrixDraft).some((block) =>
      /ЛМВ ног|СФП ног/i.test(block.name),
    ) &&
    constructorDraftSessions(previewFarDevelopment.matrixDraft).some((session) => session.name === "ВЕЧЕР"),
  "Far-development preview should allow development and larger two-session structure",
);
assert(
  previewNoDrafts.legacyDraft === undefined &&
    previewNoDrafts.matrixDraft === undefined &&
    previewNoDrafts.comparisonReport?.legacyDraft === undefined &&
    previewNoDrafts.comparisonReport?.matrixDraft === undefined &&
    previewNoDrafts.safetyInvariants === undefined &&
    previewNoDrafts.legacyDefaultGuard === undefined &&
    previewNoDrafts.summary.includedDrafts === false &&
    previewNoDrafts.summary.includedSafetyDetails === false,
  "Preview includeDrafts/includeSafetyDetails false should omit full drafts and safety details",
);
assert(
  previewNoReport.comparisonReport === undefined &&
    previewNoReport.legacyDraft === undefined &&
    previewNoReport.matrixDraft === undefined &&
    previewNoReport.summary.includedComparisonReport === false &&
    previewNoReport.summary.includedDrafts === false &&
    previewNoReport.notes.length === 2,
  "Preview includeComparisonReport false should keep summary/safety but omit report and drafts",
);
assert(
  apiPreviewNoDrafts.generatedFrom === "legacy_matrix_comparison_preview" &&
    apiPreviewNoDrafts.safeToPreview &&
    apiPreviewNoDrafts.defaultPathUnchanged &&
    apiPreviewNoDrafts.summary.includedDrafts === false &&
    apiPreviewNoDrafts.summary.includedComparisonReport === true &&
    apiPreviewNoDrafts.summary.includedSafetyDetails === false &&
    apiPreviewNoDrafts.legacyDraft === undefined &&
    apiPreviewNoDrafts.matrixDraft === undefined &&
    apiPreviewNoDrafts.comparisonReport?.legacyDraft === undefined &&
    apiPreviewNoDrafts.comparisonReport?.matrixDraft === undefined &&
    JSON.stringify(previewInput28) === apiPreviewInput28Snapshot,
  "API preview response helper should support includeDrafts=false without mutating input",
);
assert(
  apiPreviewNoReport.generatedFrom === "legacy_matrix_comparison_preview" &&
    apiPreviewNoReport.safeToPreview &&
    apiPreviewNoReport.summary.includedComparisonReport === false &&
    apiPreviewNoReport.comparisonReport === undefined &&
    apiPreviewNoReport.notes.length === 2,
  "API preview response helper should support includeComparisonReport=false",
);
assert(
  apiPreview3.safeToPreview &&
    !constructorDraftBlocks(apiPreview3.matrixDraft).some((block) =>
      /ЛМВ ног|СФП с переносом|контрольные схватки/i.test(block.name),
    ) &&
    constructorDraftHasText(apiPreview3.matrixDraft, /Развивающие цели запрещены|Развивающая нагрузка запрещена|развитие/i),
  "API preview helper D-3 scenario should keep close-start safety",
);
assert(
  apiPreviewTravel.safeToPreview &&
    constructorDraftBlocks(apiPreviewTravel.matrixDraft).every((block) => !/нагрузка high|нагрузка medium/.test(block.volume)) &&
    constructorDraftHasText(apiPreviewTravel.matrixDraft, /travel|дорог|logistics/i),
  "API preview helper travel scenario should keep logistics safety",
);
assert(
  apiPreviewWeighIn.safeToPreview &&
    !constructorDraftBlocks(apiPreviewWeighIn.matrixDraft).some((block) =>
      /контрольные схватки|Соревновательная модель|СФП с переносом/i.test(block.name),
    ) &&
    constructorDraftHasText(apiPreviewWeighIn.matrixDraft, /взвеш|weight/i),
  "API preview helper weigh-in scenario should keep weight-control safety",
);
assert(
  rolloutFarDevelopment.scenario === "far_development_week" &&
    rolloutFarDevelopment.mode === "matrix_allowed_for_primary" &&
    rolloutFarDevelopment.matrixPrimaryAllowed === true &&
    rolloutFarDevelopment.recommendedAction === "allow_matrix_primary" &&
    rolloutFarDevelopment.blockers.length === 0,
  `Far-development rollout should allow matrix primary without blockers, got ${rolloutFarDevelopment.scenario}/${rolloutFarDevelopment.mode}/${rolloutFarDevelopment.blockers.map((item) => item.code).join(",")}`,
);
assert(
  JSON.stringify(rolloutInputFarDevelopment) === rolloutInputFarDevelopmentSnapshot,
  "Rollout decision should not mutate the input",
);
assert(
  rolloutPostCompetition.scenario === "post_competition_recovery" &&
    rolloutPostCompetition.mode === "matrix_allowed_for_primary" &&
    rolloutPostCompetition.matrixPrimaryAllowed === true &&
    rolloutPostCompetition.blockers.length === 0,
  `Post-competition rollout should allow recovery matrix primary without blockers, got ${rolloutPostCompetition.scenario}/${rolloutPostCompetition.mode}/${rolloutPostCompetition.blockers.map((item) => item.code).join(",")}`,
);
assert(
  rolloutTravel.scenario === "travel_day" &&
    rolloutTravel.mode === "matrix_allowed_for_internal" &&
    rolloutTravel.matrixPrimaryAllowed === false &&
    rolloutTravel.recommendedAction === "allow_internal_matrix_primary" &&
    rolloutTravel.blockers.length === 0,
  `Travel rollout should stay internal-only without blockers, got ${rolloutTravel.scenario}/${rolloutTravel.mode}/${rolloutTravel.blockers.map((item) => item.code).join(",")}`,
);
assert(
  rolloutWeighIn.scenario === "weigh_in_day" &&
    rolloutWeighIn.mode === "matrix_allowed_for_internal" &&
    rolloutWeighIn.matrixPrimaryAllowed === false &&
    rolloutWeighIn.blockers.length === 0,
  `Weigh-in rollout should stay internal-only without blockers, got ${rolloutWeighIn.scenario}/${rolloutWeighIn.mode}/${rolloutWeighIn.blockers.map((item) => item.code).join(",")}`,
);
for (const [label, decision, expectedScenario] of [
  ["D-28", rolloutMainStartD28, "main_start_d28_preview"],
  ["D-21", rolloutMainStartD21, "main_start_d21_preview"],
  ["D-10", rolloutMainStartD10, "main_start_d10_preview"],
  ["D-4", rolloutMainStartD4, "main_start_d4_start_window"],
]) {
  assert(
    decision.scenario === expectedScenario &&
      decision.mode === "matrix_allowed_for_primary" &&
      decision.matrixPrimaryAllowed === true &&
      decision.recommendedAction === "allow_matrix_primary" &&
      decision.blockers.length === 0,
    `${label} rollout should allow limited matrix primary without blockers, got ${decision.scenario}/${decision.mode}/${decision.blockers.map((item) => item.code).join(",")}`,
  );
}
assert(
  rolloutMainStartD3.scenario === "main_start_d3_preview" &&
    rolloutMainStartD3.mode === "preview_only" &&
    rolloutMainStartD3.matrixPrimaryAllowed === false &&
    rolloutMainStartD3.recommendedAction === "show_preview_only" &&
    rolloutMainStartD3.blockers.some((item) => item.code === "main_start_too_close_for_primary"),
  `D-3 rollout should remain preview-only with main-start primary blocker, got ${rolloutMainStartD3.scenario}/${rolloutMainStartD3.mode}/${rolloutMainStartD3.blockers.map((item) => item.code).join(",")}`,
);
assert(
  rolloutCompetitionDay.scenario === "competition_day_preview" &&
    rolloutCompetitionDay.mode === "preview_only" &&
    rolloutCompetitionDay.matrixPrimaryAllowed === false &&
    rolloutCompetitionDay.blockers.some((item) => item.code === "competition_day_primary_not_enabled"),
  `Competition-day rollout should stay preview-only, got ${rolloutCompetitionDay.scenario}/${rolloutCompetitionDay.mode}/${rolloutCompetitionDay.blockers.map((item) => item.code).join(",")}`,
);
assert(
  rolloutUnknown.scenario === "unknown" &&
    (rolloutUnknown.mode === "legacy_only" || rolloutUnknown.mode === "blocked") &&
    rolloutUnknown.matrixPrimaryAllowed === false &&
    rolloutUnknown.blockers.some((item) => item.code === "unknown_scenario" || item.code === "not_allowlisted"),
  `Unknown rollout should fall back to legacy/block with an explicit blocker, got ${rolloutUnknown.scenario}/${rolloutUnknown.mode}/${rolloutUnknown.blockers.map((item) => item.code).join(",")}`,
);
assert(
  rolloutDisabled.mode === "blocked" &&
    rolloutDisabled.recommendedAction === "block_matrix" &&
    rolloutDisabled.blockers.some((item) => item.code === "explicitly_disabled"),
  "Explicitly disabled rollout should block matrix",
);
assert(
  readinessFarDevelopment.status === "ready_for_limited_primary_pilot" &&
    readinessFarDevelopment.scenario === "far_development_week" &&
    readinessFarDevelopment.rolloutMode === "matrix_allowed_for_primary" &&
    readinessCriticalItemsPass(readinessFarDevelopment),
  `Far-development readiness should be limited-primary ready, got ${readinessFarDevelopment.status}/${readinessFarDevelopment.scenario}`,
);
assert(
  JSON.stringify(rolloutInputFarDevelopment) === readinessInputFarDevelopmentSnapshot,
  "Pilot readiness evaluation should not mutate the input",
);
assert(
  readinessPostCompetition.status === "ready_for_limited_primary_pilot" &&
    readinessPostCompetition.scenario === "post_competition_recovery" &&
    readinessCriticalItemsPass(readinessPostCompetition),
  `Post-competition readiness should be limited-primary ready, got ${readinessPostCompetition.status}/${readinessPostCompetition.scenario}`,
);
assert(
  readinessTravel.status === "ready_for_internal_pilot" &&
    readinessTravel.scenario === "travel_day" &&
    readinessItem(readinessTravel, "logistics_load_is_light")?.status === "pass",
  `Travel readiness should be internal-pilot ready with light logistics load, got ${readinessTravel.status}/${readinessTravel.scenario}`,
);
assert(
  readinessWeighIn.status === "ready_for_internal_pilot" &&
    readinessWeighIn.scenario === "weigh_in_day" &&
    readinessItem(readinessWeighIn, "logistics_load_is_light")?.status === "pass",
  `Weigh-in readiness should be internal-pilot ready with light logistics load, got ${readinessWeighIn.status}/${readinessWeighIn.scenario}`,
);
for (const [label, readiness, expectedScenario] of [
  ["D-28", readinessMainStartD28, "main_start_d28_preview"],
  ["D-21", readinessMainStartD21, "main_start_d21_preview"],
  ["D-10", readinessMainStartD10, "main_start_d10_preview"],
  ["D-4", readinessMainStartD4, "main_start_d4_start_window"],
]) {
  assert(
    readiness.status === "ready_for_limited_primary_pilot" &&
      readiness.scenario === expectedScenario &&
      readinessItem(readiness, "close_main_start_policy_respected")?.status === "not_applicable" &&
      readiness.matrixPrimaryAllowed === true &&
      readinessCriticalItemsPass(readiness),
    `${label} readiness should be limited-primary ready, got ${readiness.status}/${readiness.scenario}`,
  );
}
assert(
  readinessMainStartD3.status === "preview_only" &&
    readinessMainStartD3.scenario === "main_start_d3_preview" &&
    readinessItem(readinessMainStartD3, "close_main_start_policy_respected")?.status === "pass" &&
    readinessMainStartD3.matrixPrimaryAllowed === false,
  `D-3 readiness should remain preview-only with close-main-start policy respected, got ${readinessMainStartD3.status}/${readinessMainStartD3.scenario}`,
);
assert(
  readinessCompetitionDay.status === "preview_only" &&
    readinessCompetitionDay.scenario === "competition_day_preview" &&
    readinessCompetitionDay.matrixPrimaryAllowed === false,
  `Competition-day readiness should remain preview-only, got ${readinessCompetitionDay.status}/${readinessCompetitionDay.scenario}`,
);
assert(
  readinessUnknown.status === "blocked" || readinessUnknown.status === "needs_review",
  `Unknown readiness should be blocked or needs_review, got ${readinessUnknown.status}`,
);
assert(
  readinessFarDevelopmentSummary.status === readinessFarDevelopment.status &&
    readinessFarDevelopmentSummary.blockerCount === readinessFarDevelopment.blockers.length &&
    readinessFarDevelopmentSummary.checklistCounts.pass > 0,
  "Pilot readiness summary should include status, blocker count and checklist counts",
);
assert(
  readinessD3Blockers.some((item) => item.id === "main_start_too_close_for_primary"),
  "D-3 readiness blockers should include the close-main-start rollout blocker",
);
assert(
  matrixIfAllowedFarDevelopment.source === "matrix" &&
    matrixIfAllowedFarDevelopment.draft?.generatedFrom === "matrix" &&
    matrixIfAllowedFarDevelopment.decision.matrixPrimaryAllowed,
  "buildMatrixConstructorDraftIfAllowed should return matrix draft for primary-allowed far development",
);
assert(
  matrixIfAllowedD4.source === "matrix" &&
    matrixIfAllowedD4.draft?.generatedFrom === "matrix" &&
    matrixIfAllowedD4.decision.scenario === "main_start_d4_start_window" &&
    matrixIfAllowedD4.decision.matrixPrimaryAllowed,
  "buildMatrixConstructorDraftIfAllowed should return matrix draft for D-4 start-window primary pilot",
);
assert(
  matrixIfAllowedD3Fallback.source === "legacy_fallback" &&
    matrixIfAllowedD3Fallback.draft?.generatedFrom === undefined &&
    matrixIfAllowedD3Fallback.decision.mode === "preview_only",
  "buildMatrixConstructorDraftIfAllowed should return legacy fallback for D-3 by default",
);
assert(
  matrixIfAllowedD3Blocked.source === "blocked" &&
    matrixIfAllowedD3Blocked.draft === null &&
    matrixIfAllowedD3Blocked.blocked === true,
  "buildMatrixConstructorDraftIfAllowed should return blocked result for D-3 when fallback is disabled",
);
assert(
  draft.missingData.every((item) => item.code !== "speed_tests"),
  "Speed tests should be satisfied in the Europe preparation scenario",
);
assert(
  draft.riskFlags.some((risk) => risk.code === "weight_gap"),
  "Weight gap risk should be visible when current weight is above target",
);
assert(templatePayload.days.length > 0, "Template payload must contain days");
assert(
  templatePayload.days.every((day) => day.sessions.length > 0),
  "Every generated day must contain a session",
);
assert(
  draft.plan.weeks.some((week) =>
    week.days.some((day) =>
      day.blocks.some(
        (block) =>
          block.targetQuality === "speed_first_action" ||
          /активац|первого действия/i.test(`${block.name} ${block.volume}`),
      ),
    ),
  ),
  "Generated plan should support first-action speed as competition-safe activation/transfer",
);
assert(
  totalDraftDays >= 15,
  `21-day cycle with 6 sessions/week should expand template anchors into at least 15 training days, got ${totalDraftDays}`,
);
assert(
  firstTwoWeekDayCounts.every((days) => days >= 5),
  `First two work weeks should not stay at 3 anchor days: ${firstTwoWeekDayCounts.join(", ")}`,
);
assert(
  closeTaperPayload.days.length >= 7,
  `10-day taper with 6 sessions/week should not collapse to 3 training days, got ${closeTaperPayload.days.length}`,
);
assert(
  new Set(closeTaperPayload.days.map((day) => day.label)).size === closeTaperPayload.days.length,
  "Close taper generated days should not duplicate day labels",
);
assert(monthPayload.days.length >= 20, `30-day cycle should build a full preparation draft, got ${monthPayload.days.length}`);
assert(monthFocus.developmentAllowed === false, "30-day major start focus must forbid development");
assert(
  monthFocus.items.every((item) => item.mode !== "development"),
  `30-day major start must not expose development focus modes: ${monthFocus.items
    .map((item) => `${item.label}:${item.mode}`)
    .join(", ")}`,
);
for (const expectedFocus of [
  "специальная борцовская работа",
  "соревновательная модель",
  "поддержание СФП",
  "контроль веса",
  "восстановление и суперкомпенсация",
  "качество подводки",
]) {
  assert(
    monthFocus.items.some((item) => item.label === expectedFocus),
    `30-day major start focus should include "${expectedFocus}"`,
  );
}
assert(
  monthFocus.phaseMap.length === 5 &&
    monthFocus.phaseMap[0]?.range === "Д-30...Д-24" &&
    monthFocus.phaseMap[monthFocus.phaseMap.length - 1]?.range === "Д-4...старт",
  "30-day major start focus should expose the agreed five-step phase map",
);
assert(
  !/скорость первого действия/i.test(monthDraft.understood.interpretation),
  `30-day major start interpretation should not use old development-speed wording: ${monthDraft.understood.interpretation}`,
);
assert(
  /развитие запрещено/i.test(monthDraft.explanation.mainDecision),
  "30-day major start decision should say that development is forbidden",
);
assert(
  monthTitles[0]?.includes("вход в предсоревновательный блок"),
  `30-day cycle should start from the Europe-case entry block, got: ${monthTitles.join(" | ")}`,
);
assert(
  monthTitles.some((title) => title.includes("основной специальный микроцикл")),
  `30-day cycle should include the Europe-case main specific microcycle, got: ${monthTitles.join(" | ")}`,
);
assert(
  monthTitles.some((title) => title.includes("интеграция и снижение объёма")),
  `30-day cycle should include the Europe-case integration phase, got: ${monthTitles.join(" | ")}`,
);
assert(
  monthTitles.some((title) => title.includes("стартовое окно") || title.includes("подводка и пик")),
  `30-day cycle should end with taper/start logic, got: ${monthTitles.join(" | ")}`,
);
assert(
  monthPhases.slice(0, 3).every((phase) => phase !== "taper" && phase !== "start_window"),
  `30-day cycle should not start taper before the final 10 days: ${monthPhases.join(", ")}`,
);
assert(
  monthDraft.plan.weeks
    .slice(0, 3)
    .every((week) => week.days.every((day) => /Д-\d+\s\/\s[А-Я]{2}\s\d{2}\.\d{2}/.test(day.dayLabel))),
  "30-day major competition cycle should use concrete calendar labels like D-30 / weekday date",
);
assert(
  monthDraft.plan.weeks.every((week) => week.days.every((day) => !/\sВС\s/.test(day.dayLabel))),
  "30-day major competition cycle should not create Sunday training days when Sunday is not available",
);
assert(
  monthDraft.plan.weeks.some((week) =>
    week.days.some((day) =>
      day.blocks.some(
        (block) =>
          block.type === "activation" ||
          block.targetQuality === "taper_quality" ||
          /резк|активац|первого действия|включен/i.test(`${block.name} ${block.volume}`),
      ),
    ),
  ),
  "30-day cycle should include competition-safe speed/first-action activation, not developing speed work",
);
assert(monthTargets.has("wrestling_contact_density"), "30-day cycle should include wrestling_contact_density blocks");
assert(monthTargets.has("fatigue_skill"), "30-day cycle should include fatigue_skill blocks");
assert(monthTargets.has("weight_management"), "30-day cycle should include weight_management blocks");
assert(monthTargets.has("taper_quality"), "30-day cycle should include taper_quality blocks");
assert(
  monthWorkingWeekSpeedDayCounts.every((count) => count <= 2),
  `Working weeks should not become speed-only weeks: ${monthWorkingWeekSpeedDayCounts.join(", ")}`,
);
assert(
  monthWorkingWeekRecoveryCoverage.every(Boolean),
  "Every working week should include recovery/aerobic/weight support, not only development work",
);
assert(
  monthSpeedDays.every((day) =>
    day.blocks.some((block) => block.targetQuality === "fatigue_skill"),
  ),
  "Every speed day in working weeks should include wrestling transfer, not only accelerations",
);
assert(
  europeCase23Titles[0]?.includes("вход в предсоревновательный блок") &&
    europeCase23Titles.some((title) => title.includes("основной специальный микроцикл")) &&
    europeCase23Titles.some((title) => title.includes("интеграция и снижение объёма")) &&
    europeCase23Titles.some((title) => title.includes("стартовое окно") || title.includes("подводка и пик")),
  `23-day Europe case should preserve entry/main/integration/taper phases: ${europeCase23Titles.join(" | ")}`,
);
assert(
  europeCase23ActiveTrainingDays.length > 0 &&
    europeCase23ActiveTrainingSessions.every(hasSessionFrame),
  "Every active session in the 23-day Europe case must be structured as warm-up -> main work -> cool-down",
);
assert(
  monthActiveTrainingDays.length > 0 && monthActiveTrainingSessions.every(hasSessionFrame),
  "Every active session in the 30-day constructor draft must be structured as warm-up -> main work -> cool-down",
);
assert(
  europeCase23ActiveTrainingDays.every((day) => [1, 2].includes(sessionCount(day))) &&
    europeCase23HalfDays.length >= 3,
  "Europe-case active days should follow full/half rhythm: two-session days plus planned half-days",
);
assert(
  monthActiveTrainingDays.every((day) => [1, 2].includes(sessionCount(day))) &&
    monthHalfDays.length >= 4 &&
    monthOverloadedSixDayWeeks.length === 0,
  "30-day active days should follow full/half rhythm, not six overloaded two-session days",
);
assert(
  europeCase23TemplateActiveSessions.every((session) => session.blocks.every((block) => block.exercises?.length > 0)),
  "Europe-case template payload should include concrete exercises for every block",
);
assert(
  monthTemplateActiveSessions.every((session) => session.blocks.every((block) => block.exercises?.length > 0)),
  "30-day template payload should include concrete exercises for every block",
);
assert(
  monthFullDays.every((day) =>
    (day.sessions ?? []).some(sessionHasTechnicalWrestling),
  ),
  "Every full active day in the 30-day Europe constructor case must include wrestling technique/contact",
);
assert(
  monthUnloadingHalfDays.length >= 3 &&
    monthUnloadingHalfDays.every((day) => !(day.sessions ?? []).some(sessionHasTechnicalWrestling)),
  `Half-days in the 30-day Europe constructor case must be environment-shift recovery days without mat technique/contact: ${monthUnloadingHalfDays
    .map((day) =>
      `${day.dayLabel}:${day.dayIntent}:${(day.sessions ?? [])
        .flatMap((session) => sessionMainBlocks(session).map((block) => `${block.name}/${block.targetQuality}`))
        .join(",")}`,
    )
    .join(" | ")}`,
);
assert(
  monthHasMorningTechniqueEveningPhysical,
  "30-day Europe constructor case should include days with morning technique and evening OFP/SFP support",
);
assert(
  monthHasMorningPhysicalEveningWrestling,
  "30-day Europe constructor case should include days with morning OFP/SFP support and evening wrestling/technique",
);
assert(
  monthAnaerobicDays.every((day) => (day.sessions ?? []).some(sessionHasTechnicalWrestling)),
  "Anaerobic/interval days must include wrestling technique/transfer in the same day",
);
assert(
  !monthWrongPhasePhases.includes("development"),
  `30-day competition cycle must not be treated as development: ${monthWrongPhasePhases.join(", ")}`,
);
assert(
  /специальная предсоревновательная подготовка|special_preparation/i.test(
    monthWrongPhaseDraft.explanation.mainDecision,
  ),
  "30-day competition cycle should normalize development input to special_preparation in the decision text",
);
assert(
  monthAutoGoalTargets.has("wrestling_contact_density") &&
    monthAutoGoalTargets.has("fatigue_skill") &&
    monthAutoGoalTargets.has("weight_management") &&
    monthAutoGoalTargets.has("taper_quality") &&
    monthAutoGoalTargets.has("recovery"),
  "30-day major competition constructor should auto-select wrestling, technique, weight, taper and recovery goals",
);
assert(localQualitiesLastWeek.phase === "taper", "Local qualities 21-day cycle should end with taper");
assert(
  !localQualitiesTaperTargets.has("legs_lme") && !localQualitiesTaperTargets.has("arms_grip"),
  "Taper week should not reuse developing LME/grip days when selected cards do not contain taper weeks",
);
assert(competitionWeekActivationDays.length > 0, "Competition week should include short activation/freshness work");
assert(
  competitionWeekActivationDays.every(
    (day) =>
      day.blocks.length >= 3 &&
      day.blocks.some((block) => block.targetQuality === "fatigue_skill") &&
      day.blocks.some((block) => block.targetQuality === "weight_management"),
  ),
  "Activation days in taper/start week must include wrestling transfer and weight/recovery control, not only accelerations",
);
assert(
  competitionWeekBlocks.every((block) => block.targetQuality !== "speed_first_action" && block.type !== "speed"),
  "Competition week must not contain developing speed blocks; speed is only short activation/taper quality",
);
assert(europe28SeasonStrategy.currentWindow.daysToStart === 28, "Season strategy must calculate exact 28 days to Europe");
assert(
  europe28SeasonStrategy.currentWindow.cycleLengthDays === 28,
  `Season strategy must keep exact draft length for <=30 days, got ${europe28SeasonStrategy.currentWindow.cycleLengthDays}`,
);
assert(
  europe28SeasonStrategy.olympicCycle.yearStage === "deep_special_preparation",
  `2026 in a 2025-2028 Olympic cycle should be year 2 deep special preparation, got ${europe28SeasonStrategy.olympicCycle.yearStage}`,
);
assert(
  europe28SeasonStrategy.constructorRules.forbiddenModes.includes("development"),
  "Main A start inside 30 days must forbid development mode",
);
assert(
  europe28StrategyDraft.plan.cycleLengthDays === 28,
  `Constructor must build exact remaining days from season strategy, got ${europe28StrategyDraft.plan.cycleLengthDays}`,
);
assert(
  europe28StrategyDraft.seasonStrategy?.currentWindow.cycleLengthDays === 28,
  "Constructor draft should preserve the season strategy snapshot",
);
assert(
  europe28StrategyDraft.focusPlan.developmentAllowed === false,
  "Season strategy for Europe in 28 days must keep development forbidden",
);
assert(
  europe28StrategyDraft.focusPlan.phaseMap[0]?.range === "Д-28...Д-24",
  `28-day strategy must show an exact phase map start, got ${europe28StrategyDraft.focusPlan.phaseMap
    .map((phase) => phase.range)
    .join(" | ")}`,
);
assert(fourDayStartStrategy.currentWindow.daysToStart === 4, "4-day start strategy must calculate exact days");
assert(
  fourDayStartStrategy.currentWindow.phase === "start_window",
  `D-4 should be start_window, got ${fourDayStartStrategy.currentWindow.phase}`,
);
assert(
  fourDayStartStrategy.currentWindow.cycleLengthDays === 4,
  `4-day start strategy must keep exact 4-day length, got ${fourDayStartStrategy.currentWindow.cycleLengthDays}`,
);
assert(
  fourDayStartDraft.plan.cycleLengthDays === 4,
  `Constructor must not round 4 days to 7, got ${fourDayStartDraft.plan.cycleLengthDays}`,
);
assert(
  fourDayStartDraft.plan.weeks.length === 1 &&
    fourDayStartDraft.plan.weeks[0]?.phase === "start_window" &&
    fourDayStartDays.length === 4,
  `4-day start draft should be one start-window week with four calendar days, got weeks=${fourDayStartDraft.plan.weeks.length}, phase=${fourDayStartDraft.plan.weeks[0]?.phase}, days=${fourDayStartDays.length}`,
);
assert(
  fourDayStartDays.every((day) => sessionCount(day) <= 1),
  `4-day start window must not create 2 sessions per day: ${fourDayStartDays
    .map((day) => `${day.dayLabel}:${sessionCount(day)}`)
    .join(", ")}`,
);
assert(
  fourDayStartMatDays.length <= 2,
  `4-day start window must include recovery/no-mat days, got mat days: ${fourDayStartMatDays
    .map((day) => day.dayLabel)
    .join(", ")}`,
);
assert(
  !fourDayStartTargets.has("legs_lme") && !fourDayStartTargets.has("wrestling_contact_density"),
  `4-day start window must not include LME/contact-density targets: ${Array.from(fourDayStartTargets).join(", ")}`,
);
assert(
  fourDayStartDraft.focusPlan.items.every(
    (item) => item.goalType !== "legs_lme" && item.goalType !== "wrestling_contact_density",
  ),
  `4-day start focus must not auto-select LME/contact density: ${fourDayStartDraft.focusPlan.items
    .map((item) => `${item.goalType}:${item.label}`)
    .join(", ")}`,
);
assert(
  fourDayStartDraft.focusPlan.phaseMap.map((phase) => phase.range).join("|") === "Д-4...старт",
  `4-day start focus map should not expose 7/10/14 templates, got ${fourDayStartDraft.focusPlan.phaseMap
    .map((phase) => phase.range)
    .join(" | ")}`,
);
assert(
  fourDayStartDraft.confidence === "low",
  `4-day start window should honestly show low confidence/critical close-start risk, got ${fourDayStartDraft.confidence}`,
);
assert(
  /стартовое окно/i.test(fourDayStartDraft.understood.mainTask) &&
    /стартовое окно/i.test(fourDayStartDraft.understood.interpretation),
  `4-day start explanation must speak as start window, got: ${fourDayStartDraft.understood.mainTask} / ${fourDayStartDraft.understood.interpretation}`,
);
assert(
  !/уверенного развивающего плана/i.test(fourDayStartDraft.understood.interpretation),
  `4-day start explanation must not use old development-plan wording: ${fourDayStartDraft.understood.interpretation}`,
);
assert(
  /Олимпийский цикл/i.test(fourDayStartDraft.understood.interpretation) &&
    /до старта 4 дн/i.test(fourDayStartDraft.understood.interpretation),
  `4-day start explanation must include season/cycle and exact days-to-start context: ${fourDayStartDraft.understood.interpretation}`,
);
assert(
  /4 дн/i.test(fourDayStartDraft.explanation.whyNow) &&
    /нельзя добирать объём/i.test(fourDayStartDraft.explanation.whyNow),
  `4-day start whyNow should explain why load cannot be added: ${fourDayStartDraft.explanation.whyNow}`,
);

const constructorPreviewFixtureResult = runConstructorPreviewFixtures();
const packageJsonSource = readProjectFile("package.json");
const evidenceAuditDoc = readProjectFile("docs/constructor-matrix-evidence-dependency-gap-audit.md");
const coreStackDoc = readProjectFile("docs/perform-constructor-core-stack.md");
const transitionPlanDoc = readProjectFile("docs/constructor-phase-matrix-transition-plan.md");

const metadataCheckFiles = [
  "scripts/check-constructor-matrix-ai-review-policy.mjs",
  "scripts/check-constructor-matrix-ai-evidence-claims.mjs",
  "scripts/check-constructor-matrix-ai-safety-classification.mjs",
  "scripts/check-constructor-matrix-runtime-eligibility.mjs",
  "scripts/check-constructor-matrix-ai-runtime-integration.mjs",
  "scripts/check-constructor-matrix-ai-save-assign-readiness.mjs",
  "scripts/check-constructor-matrix-ai-production-decision-pack.mjs",
  "scripts/check-constructor-matrix-ai-production-deployment-gate.mjs",
  "scripts/check-constructor-matrix-dependency-map.mjs",
  "scripts/check-constructor-matrix-controlled-pilot-e2e.mjs",
  "scripts/check-constructor-matrix-ai-source-review.mjs",
  "scripts/check-constructor-matrix-evidence-dependencies.mjs",
  "scripts/check-constructor-matrix-data-dependencies.mjs",
  "scripts/check-constructor-matrix-threshold-candidates.mjs",
  "scripts/check-constructor-matrix-review-package.mjs",
  "scripts/check-constructor-matrix-review-decision-ledger.mjs",
  "scripts/check-constructor-matrix-source-expansion-backlog.mjs",
  "scripts/check-constructor-matrix-source-candidates.mjs",
  "scripts/check-constructor-matrix-source-lookup-intake.mjs",
  "scripts/check-constructor-matrix-evidence-claims.mjs",
  "scripts/check-constructor-matrix-evidence-claim-review-intake.mjs",
  "scripts/check-constructor-matrix-review-intake-export.mjs",
  "scripts/check-constructor-matrix-desk-source-review-and-claim-candidates.mjs",
  "scripts/check-constructor-matrix-evidence-claim-candidate-review-export.mjs",
  "packages/shared/src/constructor-matrix-ai-review-policy.ts",
  "packages/shared/src/constructor-matrix-ai-evidence-claims.ts",
  "packages/shared/src/constructor-matrix-ai-safety-classification.ts",
  "packages/shared/src/constructor-matrix-runtime-eligibility.ts",
  "packages/shared/src/constructor-matrix-dependency-map.ts",
  "packages/shared/src/constructor-matrix-ai-source-review.ts",
  "packages/shared/src/constructor-matrix-evidence.ts",
  "packages/shared/src/constructor-matrix-evidence-claims.ts",
  "packages/shared/src/constructor-matrix-evidence-claim-review-intake.ts",
  "packages/shared/src/constructor-matrix-evidence-claim-candidates.ts",
  "packages/shared/src/constructor-matrix-evidence-claim-candidate-review-export.ts",
  "packages/shared/src/constructor-matrix-desk-source-review.ts",
  "packages/shared/src/constructor-matrix-review-intake-export.ts",
  "packages/shared/src/constructor-matrix-data-dependencies.ts",
  "packages/shared/src/constructor-matrix-threshold-candidates.ts",
  "packages/shared/src/constructor-matrix-review-package.ts",
  "packages/shared/src/constructor-matrix-review-decision-ledger.ts",
  "packages/shared/src/constructor-matrix-source-expansion-backlog.ts",
  "packages/shared/src/constructor-matrix-source-candidates.ts",
  "packages/shared/src/constructor-matrix-source-lookup-intake.ts",
  "docs/matrix-ai-reviewed-save-assign-readiness.md",
  "docs/matrix-ai-reviewed-production-decision-pack.md",
  "docs/matrix-ai-reviewed-production-deployment-gate.md",
  "docs/matrix-controlled-pilot-acceptance-matrix.md",
  "docs/matrix-controlled-pilot-e2e-validation.md",
  "docs/matrix-controlled-pilot-runbook.md",
  "docs/matrix-review-intake-export/README.md",
  "docs/matrix-claim-candidate-review-export/README.md",
];

for (const path of metadataCheckFiles) {
  assert(existsSync(new URL(`../${path}`, import.meta.url)), `Missing matrix metadata file: ${path}`);
}

for (const token of [
  "check:constructor-matrix-ai-review-policy",
  "check:constructor-matrix-ai-evidence-claims",
  "check:constructor-matrix-ai-safety-classification",
  "check:constructor-matrix-runtime-eligibility",
  "check:constructor-matrix-ai-runtime-integration",
  "check:constructor-matrix-ai-save-assign-readiness",
  "check:constructor-matrix-ai-production-decision-pack",
  "check:constructor-matrix-ai-production-deployment-gate",
  "check:constructor-matrix-dependency-map",
  "check:constructor-matrix-controlled-pilot-e2e",
  "check:constructor-matrix-ai-source-review",
  "check:constructor-matrix-evidence-dependencies",
  "check:constructor-matrix-data-dependencies",
  "check:constructor-matrix-threshold-candidates",
  "check:constructor-matrix-review-package",
  "check:constructor-matrix-review-decision-ledger",
  "check:constructor-matrix-source-expansion-backlog",
  "check:constructor-matrix-source-candidates",
  "check:constructor-matrix-source-lookup-intake",
  "check:constructor-matrix-evidence-claims",
  "check:constructor-matrix-evidence-claim-review-intake",
  "check:constructor-matrix-review-intake-export",
  "check:constructor-matrix-desk-source-review-and-claim-candidates",
  "check:constructor-matrix-evidence-claim-candidate-review-export",
]) {
  assert(packageJsonSource.includes(token), `package.json must expose ${token}`);
}

for (const [path, source] of [
  ["docs/constructor-matrix-evidence-dependency-gap-audit.md", evidenceAuditDoc],
  ["docs/perform-constructor-core-stack.md", coreStackDoc],
  ["docs/constructor-phase-matrix-transition-plan.md", transitionPlanDoc],
]) {
  assert(
    source.includes("Registry Hardening + Data Dependency Gate Skeleton"),
    `${path} must document Registry Hardening + Data Dependency Gate Skeleton`,
  );
  assert(
    source.includes("Threshold Candidate Registry"),
    `${path} must document Threshold Candidate Registry`,
  );
  assert(
    source.includes("Matrix Review Package"),
    `${path} must document Matrix Review Package`,
  );
  assert(
    source.includes("Matrix Review Decision Ledger"),
    `${path} must document Matrix Review Decision Ledger`,
  );
  assert(
    source.includes("Source Expansion Backlog + Review Intake Guard"),
    `${path} must document Source Expansion Backlog + Review Intake Guard`,
  );
  assert(
    source.includes("P0 Source Acquisition Dossier + Source Candidate Registry"),
    `${path} must document P0 Source Acquisition Dossier + Source Candidate Registry`,
  );
  assert(
    source.includes("P0 Controlled Source Lookup + Source Intake Registry"),
    `${path} must document P0 Controlled Source Lookup + Source Intake Registry`,
  );
  assert(
    source.includes("P0 Evidence Claim Extraction Registry"),
    `${path} must document P0 Evidence Claim Extraction Registry`,
  );
  assert(
    source.includes("Evidence Claim Blocker Review Intake Pack"),
    `${path} must document Evidence Claim Blocker Review Intake Pack`,
  );
  assert(
    source.includes("Matrix Review Intake Export Pack"),
    `${path} must document Matrix Review Intake Export Pack`,
  );
  assert(
    source.includes("Matrix Desk Source Review + Evidence Claim Candidate Extraction"),
    `${path} must document Matrix Desk Source Review + Evidence Claim Candidate Extraction`,
  );
  assert(
    source.includes("Matrix Evidence Claim Candidate Review Export Pack"),
    `${path} must document Matrix Evidence Claim Candidate Review Export Pack`,
  );
  assert(
    source.includes("Matrix Constructor Dependency Map"),
    `${path} must document Matrix Constructor Dependency Map`,
  );
  assert(
    source.includes("Controlled Pilot Hardening Audit"),
    `${path} must document Controlled Pilot Hardening Audit`,
  );
  assert(
    source.includes("Controlled Pilot End-to-End Validation"),
    `${path} must document Controlled Pilot End-to-End Validation`,
  );
  assert(
    source.includes("Matrix Controlled Pilot Runbook"),
    `${path} must document Matrix Controlled Pilot Runbook`,
  );
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      previewFixturePack: {
        status: constructorPreviewFixtureResult.status,
        fixtureCount: constructorPreviewFixtureResult.fixtureCount,
        fixtureIds: constructorPreviewFixtureResult.fixtureIds,
      },
      confidence: draft.confidence,
      selectedCards: draft.selectedCards.map((card) => card.id),
      missingData: draft.missingData.map((item) => item.code),
      riskFlags: draft.riskFlags.map((risk) => risk.code),
      generatedDays: templatePayload.days.length,
      closeTaperGeneratedDays: closeTaperPayload.days.length,
      monthGeneratedDays: monthPayload.days.length,
      monthPhases,
      monthTitles,
      monthWorkingWeekSpeedDayCounts,
      monthWorkingWeekRecoveryCoverage,
      monthFocus: {
        developmentAllowed: monthFocus.developmentAllowed,
        items: monthFocus.items.map((item) => ({
          label: item.label,
          mode: item.mode,
        })),
        phaseMap: monthFocus.phaseMap.map((phase) => phase.range),
      },
      europeCase23Titles,
      europeCase23StructuredDays: europeCase23ActiveTrainingDays.length,
      europeCase23StructuredSessions: europeCase23ActiveTrainingSessions.length,
      monthStructuredDays: monthActiveTrainingDays.length,
      monthStructuredSessions: monthActiveTrainingSessions.length,
      monthWrongPhasePhases,
      localQualitiesTaperTargets: Array.from(localQualitiesTaperTargets),
      competitionWeekActivationDays: competitionWeekActivationDays.map((day) => ({
        label: day.dayLabel,
        blocks: day.blocks.map((block) => block.targetQuality),
      })),
      seasonStrategy28Days: {
        yearStage: europe28SeasonStrategy.olympicCycle.yearStage,
        phase: europe28SeasonStrategy.currentWindow.phase,
        daysToStart: europe28SeasonStrategy.currentWindow.daysToStart,
        cycleLengthDays: europe28StrategyDraft.plan.cycleLengthDays,
        forbiddenModes: europe28SeasonStrategy.constructorRules.forbiddenModes,
        phaseMap: europe28StrategyDraft.focusPlan.phaseMap.map((phase) => phase.range),
      },
      fourDayStartWindow: {
        confidence: fourDayStartDraft.confidence,
        mainTask: fourDayStartDraft.understood.mainTask,
        interpretation: fourDayStartDraft.understood.interpretation,
        whyNow: fourDayStartDraft.explanation.whyNow,
        phase: fourDayStartStrategy.currentWindow.phase,
        daysToStart: fourDayStartStrategy.currentWindow.daysToStart,
        cycleLengthDays: fourDayStartDraft.plan.cycleLengthDays,
        activeDays: fourDayStartActiveDays.length,
        sessionCounts: fourDayStartDays.map((day) => ({
          label: day.dayLabel,
          sessions: sessionCount(day),
        })),
        matDays: fourDayStartMatDays.map((day) => day.dayLabel),
        targets: Array.from(fourDayStartTargets),
        focus: fourDayStartDraft.focusPlan.items.map((item) => item.goalType),
        phaseMap: fourDayStartDraft.focusPlan.phaseMap.map((phase) => phase.range),
      },
      matrixRolloutGate: {
        farDevelopment: {
          scenario: rolloutFarDevelopment.scenario,
          mode: rolloutFarDevelopment.mode,
          matrixPrimaryAllowed: rolloutFarDevelopment.matrixPrimaryAllowed,
        },
        closeMainStartModes: {
          d28: rolloutMainStartD28.mode,
          d21: rolloutMainStartD21.mode,
          d10: rolloutMainStartD10.mode,
          d4: rolloutMainStartD4.mode,
          d3: rolloutMainStartD3.mode,
        },
        logisticsModes: {
          travel: rolloutTravel.mode,
          weighIn: rolloutWeighIn.mode,
        },
        helperSources: {
          farDevelopment: matrixIfAllowedFarDevelopment.source,
          d3Default: matrixIfAllowedD3Fallback.source,
          d3Blocked: matrixIfAllowedD3Blocked.source,
        },
      },
      matrixPilotReadiness: {
        limitedPrimaryCandidates: {
          farDevelopment: readinessFarDevelopment.status,
          postCompetition: readinessPostCompetition.status,
          d28: readinessMainStartD28.status,
          d21: readinessMainStartD21.status,
          d10: readinessMainStartD10.status,
          d4: readinessMainStartD4.status,
        },
        internalCandidates: {
          travel: readinessTravel.status,
          weighIn: readinessWeighIn.status,
        },
        previewOnly: {
          d3: readinessMainStartD3.status,
          competitionDay: readinessCompetitionDay.status,
        },
        unknown: readinessUnknown.status,
        farDevelopmentChecklistCounts: readinessFarDevelopmentSummary.checklistCounts,
        d3Blockers: readinessD3Blockers.map((item) => item.id),
      },
    },
    null,
    2,
  ),
);
