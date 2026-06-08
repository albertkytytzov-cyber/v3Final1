import {
  buildConstructorTemplatePayload,
  buildPerformConstructorDraft,
  buildSeasonStrategySnapshot,
  CONSTRUCTOR_TEMPLATE_CARDS,
} from "@training-platform/shared";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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

assert(CONSTRUCTOR_TEMPLATE_CARDS.length >= 6, "Expected first constructor template cards");
assert(draft.plan.weeks.length > 0, "Draft must contain plan weeks");
assert(draft.selectedCards.length > 0, "Draft must select at least one template card");
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
  monthDraft.explanation.mainDecision.includes("развитие запрещено"),
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
  monthHalfDays.every((day) => !(day.sessions ?? []).some(sessionHasTechnicalWrestling)),
  "Half-days in the 30-day Europe constructor case must be environment-shift recovery days without mat technique/contact",
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
  monthWrongPhaseDraft.explanation.mainDecision.includes("special_preparation"),
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

console.log(
  JSON.stringify(
    {
      status: "ok",
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
    },
    null,
    2,
  ),
);
