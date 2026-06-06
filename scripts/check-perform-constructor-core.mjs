import {
  buildConstructorTemplatePayload,
  buildPerformConstructorDraft,
  CONSTRUCTOR_TEMPLATE_CARDS,
} from "@training-platform/shared";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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
const monthInputWithWrongDevelopmentPhase = {
  ...monthPreparationInput,
  context: {
    ...monthPreparationInput.context,
    currentPhase: "development",
  },
};
const monthWrongPhaseDraft = buildPerformConstructorDraft(monthInputWithWrongDevelopmentPhase);
const monthWrongPhasePhases = monthWrongPhaseDraft.plan.weeks.map((week) => week.phase);

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
    day.blocks.some((block) => block.type === "activation" || /активац/i.test(`${block.name} ${block.volume}`)),
  );
const competitionWeekBlocks = competitionWeekDraft.plan.weeks.flatMap((week) =>
  week.days.flatMap((day) => day.blocks),
);

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
    .every((week) => week.days.every((day) => !day.dayLabel.startsWith("Д-"))),
  "First three weeks of a 30-day cycle should use weekday labels, not pre-start day labels",
);
assert(monthTargets.has("speed_first_action"), "30-day cycle should include speed_first_action blocks");
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
  !monthWrongPhasePhases.includes("development"),
  `30-day competition cycle must not be treated as development: ${monthWrongPhasePhases.join(", ")}`,
);
assert(
  monthWrongPhaseDraft.explanation.mainDecision.includes("special_preparation"),
  "30-day competition cycle should normalize development input to special_preparation in the decision text",
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
      europeCase23Titles,
      monthWrongPhasePhases,
      localQualitiesTaperTargets: Array.from(localQualitiesTaperTargets),
      competitionWeekActivationDays: competitionWeekActivationDays.map((day) => ({
        label: day.dayLabel,
        blocks: day.blocks.map((block) => block.targetQuality),
      })),
    },
    null,
    2,
  ),
);
