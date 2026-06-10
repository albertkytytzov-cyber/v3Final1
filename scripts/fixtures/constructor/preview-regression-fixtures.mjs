import { buildSeasonStrategySnapshot } from "@training-platform/shared";

const CURRENT_DATE = "2026-06-08";

function addDaysIso(date, days) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

const syntheticAthlete = {
  athleteId: "fixture-athlete-001",
  fullName: "Synthetic Fixture Athlete",
  sex: "unknown",
  trainingAgeYears: 7,
  weightCurrentKg: 58.2,
  weightTargetKg: 57,
  baselineRestingHr: 52,
  strengths: ["stance discipline", "first-action timing"],
  weaknesses: ["local leg fatigue"],
  injuryHistory: [],
  painZones: [],
};

const baseGoals = [
  {
    goalType: "speed_first_action",
    priority: 1,
    reason: "Synthetic fixture: preserve first-action sharpness.",
  },
  {
    goalType: "wrestling_contact_density",
    priority: 2,
    reason: "Synthetic fixture: transfer density into wrestling model.",
  },
  {
    goalType: "fatigue_skill",
    priority: 3,
    reason: "Synthetic fixture: keep technique quality under fatigue.",
  },
  {
    goalType: "weight_management",
    priority: 4,
    reason: "Synthetic fixture: keep weight under control.",
  },
  {
    goalType: "taper_quality",
    priority: 5,
    reason: "Synthetic fixture: protect taper quality.",
  },
];

function makeSeasonStrategy({
  fixtureId,
  daysToStart,
  cycleLengthDays,
  priority,
  level,
  planType,
  peakRequired,
  weightCutRequired = false,
  travelRequired = false,
}) {
  const startDate = addDaysIso(CURRENT_DATE, daysToStart);
  const endDate = addDaysIso(startDate, 1);

  return buildSeasonStrategySnapshot({
    athleteId: syntheticAthlete.athleteId,
    currentDate: CURRENT_DATE,
    season: {
      id: "fixture-season-2026",
      athleteId: syntheticAthlete.athleteId,
      athleteName: syntheticAthlete.fullName,
      olympicCycleId: "fixture-cycle-2028",
      olympicCycleName: "Fixture Olympic Cycle 2028",
      year: 2026,
      name: "Fixture 2026 season",
      goal: "Synthetic regression season for constructor preview.",
      strategyType: "multi_peak",
    },
    olympicCycle: {
      id: "fixture-cycle-2028",
      name: "Fixture Olympic Cycle 2028",
      startDate: "2025-01-01",
      endDate: "2028-12-31",
      targetEvent: "Fixture Olympic Event",
      description: "Synthetic cycle only.",
    },
    targetCompetitionPlan: {
      id: `fixture-plan-${fixtureId}`,
      athleteId: syntheticAthlete.athleteId,
      seasonId: "fixture-season-2026",
      seasonName: "Fixture 2026 season",
      seasonYear: 2026,
      competitionId: `fixture-competition-${fixtureId}`,
      competitionTitle: `Fixture Competition ${fixtureId}`,
      competitionStartDate: startDate,
      competitionEndDate: endDate,
      priority,
      planType,
      peakRequired,
      taperDays: Math.max(1, Math.min(10, daysToStart)),
      weightCutRequired,
      targetWeight: syntheticAthlete.weightTargetKg,
      currentWeight: syntheticAthlete.weightCurrentKg,
      expectedMatches: 4,
      competitionFormat: "tournament",
      prepStartDate: CURRENT_DATE,
      prepEndDate: addDaysIso(startDate, -1),
      notes: "Synthetic regression fixture.",
    },
    targetCompetition: {
      id: `fixture-competition-${fixtureId}`,
      title: `Fixture Competition ${fixtureId}`,
      startDate,
      endDate,
      level,
      location: travelRequired ? "Fixture Away Venue" : "Fixture Home Venue",
    },
    competitionPlans: [
      {
        id: `fixture-plan-${fixtureId}`,
        athleteId: syntheticAthlete.athleteId,
        seasonId: "fixture-season-2026",
        competitionId: `fixture-competition-${fixtureId}`,
        competitionTitle: `Fixture Competition ${fixtureId}`,
        competitionStartDate: startDate,
        competitionEndDate: endDate,
        priority,
        planType,
        peakRequired,
        taperDays: Math.max(1, Math.min(10, daysToStart)),
        weightCutRequired,
      },
    ],
    defaultCycleLengthDays: cycleLengthDays,
  });
}

function phaseForDays(daysToStart, fallback = "special_preparation") {
  if (daysToStart <= 4) return "start_window";
  if (daysToStart <= 14) return "taper";
  if (daysToStart <= 30) return "special_preparation";
  if (daysToStart <= 60) return "development";
  return fallback;
}

function makeInput({
  fixtureId,
  daysToStart,
  cycleLengthDays,
  priority = "A",
  level = "continental",
  planType = "main",
  peakRequired = true,
  travelRequired = false,
  weightCutRequired = false,
  currentPhase = phaseForDays(daysToStart),
  goals = baseGoals,
  statePatch = {},
  constraintsPatch = {},
}) {
  const startDate = addDaysIso(CURRENT_DATE, daysToStart);
  const weighInDate = addDaysIso(startDate, -1);
  const seasonStrategy = makeSeasonStrategy({
    fixtureId,
    daysToStart,
    cycleLengthDays,
    priority,
    level,
    planType,
    peakRequired,
    weightCutRequired,
    travelRequired,
  });

  return {
    competition: {
      name: `Fixture Competition ${fixtureId}`,
      level,
      priority,
      startDate,
      weighInDate,
      weightClass: "57 kg",
      expectedBoutCount: 4,
      location: travelRequired ? "Fixture Away Venue" : "Fixture Home Venue",
      timezone: "Europe/Sofia",
      travelRequired,
      climateContext: "synthetic",
    },
    athlete: syntheticAthlete,
    context: {
      currentPhase,
      cycleLengthDays,
      sessionsPerWeek: 6,
      sessionsPerDay: 2,
      availableTrainingDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
    },
    goals,
    tests: {
      sprint10mSec: 1.86,
      sprint20mSec: 3.08,
      verticalJumpCm: 49,
      medicineBallThrowM: 7.2,
      gripLeftKg: 43,
      gripRightKg: 45,
      legsLmeScore: 4,
      techniqueQualityScore: 4,
      aerobicRecoveryScore: 4,
    },
    state: {
      readinessScore: 78,
      sleepHours: 7.4,
      restingHr: 53,
      bodyWeightKg: 58.2,
      painLevel: 1,
      fatigueLevel: 2,
      deviceDataConfidence: "medium",
      coachComment: "Synthetic regression input; no production athlete data.",
      ...statePatch,
    },
    constraints: {
      noHeavyStrength: false,
      noHighGlycolytic: false,
      weightCutActive: weightCutRequired,
      injuryCaution: false,
      travelFatigue: travelRequired,
      ...constraintsPatch,
    },
    seasonStrategy,
  };
}

const noCloseHeavyBlocks = ["leg_lmv", "spp", "mat_control_bouts"];
const baseComparison = {
  legacyDefaultMustRemainUnchanged: true,
  forbiddenDifferenceSeverities: ["error"],
};

function fixture({
  id,
  title,
  description,
  input,
  matrix,
  comparison = baseComparison,
}) {
  return {
    id,
    title,
    description,
    input,
    expectations: {
      legacy: {
        shouldBuild: true,
      },
      matrix: {
        shouldBuild: true,
        safeToPreview: true,
        maxErrorCount: 0,
        ...matrix,
      },
      comparison,
    },
  };
}

function forceSeasonWindow(input, patch) {
  return {
    ...input,
    context: {
      ...input.context,
      currentPhase: patch.phase ?? input.context.currentPhase,
      cycleLengthDays: patch.cycleLengthDays ?? input.context.cycleLengthDays,
    },
    seasonStrategy: {
      ...input.seasonStrategy,
      currentWindow: {
        ...input.seasonStrategy.currentWindow,
        phase: patch.phase ?? input.seasonStrategy.currentWindow.phase,
        daysToStart: patch.daysToStart ?? input.seasonStrategy.currentWindow.daysToStart,
        cycleLengthDays: patch.cycleLengthDays ?? input.seasonStrategy.currentWindow.cycleLengthDays,
      },
      constructorRules: {
        ...input.seasonStrategy.constructorRules,
        allowedModes: patch.allowedModes ?? input.seasonStrategy.constructorRules.allowedModes,
        forbiddenModes: patch.forbiddenModes ?? input.seasonStrategy.constructorRules.forbiddenModes,
        mandatoryFocus: patch.mandatoryFocus ?? input.seasonStrategy.constructorRules.mandatoryFocus,
        blockedFocus: patch.blockedFocus ?? input.seasonStrategy.constructorRules.blockedFocus,
      },
    },
  };
}

export const constructorPreviewFixtures = [
  fixture({
    id: "main_start_d28_special_pre_competition",
    title: "Main start D-28 special pre-competition",
    description: "Main A-level start with 28 days left must stay maintenance/transfer, not development.",
    input: makeInput({
      fixtureId: "main-d28",
      daysToStart: 28,
      cycleLengthDays: 28,
      travelRequired: true,
      weightCutRequired: true,
    }),
    matrix: {
      forbiddenSelectedBlockTypes: ["leg_lmv"],
      requiredSelectedBlockTypes: ["mat_competition_model"],
      requiredExplanationKeywords: ["главный старт", "развитие", "matrix"],
      requiredRiskCodes: ["main_start_development_forbidden"],
    },
  }),
  fixture({
    id: "main_start_d21_controlled_volume",
    title: "Main start D-21 controlled volume",
    description: "D-21 main start should reject heavy leg LMV and control bouts while keeping controlled special work.",
    input: makeInput({
      fixtureId: "main-d21",
      daysToStart: 21,
      cycleLengthDays: 21,
      weightCutRequired: true,
    }),
    matrix: {
      forbiddenSelectedBlockTypes: ["leg_lmv", "mat_control_bouts"],
      requiredSelectedBlockTypes: ["mat_competition_model"],
      requiredExplanationKeywords: ["контроль", "объём", "старт"],
      requiredRiskCodes: ["control_bouts_too_close_to_start"],
    },
  }),
  fixture({
    id: "main_start_d10_taper",
    title: "Main start D-10 taper",
    description: "Direct pre-competition window must keep taper/recovery/light technical blocks and reject heavy work.",
    input: makeInput({
      fixtureId: "main-d10",
      daysToStart: 10,
      cycleLengthDays: 10,
      weightCutRequired: true,
    }),
    matrix: {
      forbiddenSelectedBlockTypes: noCloseHeavyBlocks,
      requiredAnySelectedBlockTypes: [["mat_light_technical", "recovery", "mobility"]],
      requiredExplanationKeywords: ["подвод", "recovery"],
    },
  }),
  fixture({
    id: "main_start_d4_start_window",
    title: "Main start D-4 start window",
    description: "Four days before a main start must build the exact start-window length, not a 7/10-day legacy draft.",
    input: makeInput({
      fixtureId: "main-d4",
      daysToStart: 4,
      cycleLengthDays: 4,
      weightCutRequired: true,
    }),
    matrix: {
      forbiddenSelectedBlockTypes: noCloseHeavyBlocks,
      requiredAnySelectedBlockTypes: [["mat_light_technical", "recovery", "mobility", "weigh_in"]],
      requiredExplanationKeywords: ["Главный старт ближе 30", "развитие"],
    },
  }),
  fixture({
    id: "main_start_d3_final_activation",
    title: "Main start D-3 final activation",
    description: "Final start window should allow only light activation/recovery and explain development ban.",
    input: makeInput({
      fixtureId: "main-d3",
      daysToStart: 3,
      cycleLengthDays: 3,
      weightCutRequired: true,
    }),
    matrix: {
      forbiddenSelectedBlockTypes: noCloseHeavyBlocks,
      requiredAnySelectedBlockTypes: [["mat_light_technical", "recovery", "mobility", "weigh_in"]],
      requiredExplanationKeywords: ["Главный старт ближе 30", "развитие"],
    },
  }),
  fixture({
    id: "travel_day",
    title: "Travel day",
    description: "Travel day must stay light and explain logistics constraints.",
    input: makeInput({
      fixtureId: "travel-day",
      daysToStart: 2,
      cycleLengthDays: 1,
      travelRequired: true,
    }),
    matrix: {
      forbiddenSelectedBlockTypes: ["leg_lmv", "spp", "mat_control_bouts", "mat_competition_model"],
      requiredAnySelectedBlockTypes: [["mobility", "recovery", "travel"]],
      requiredExplanationKeywords: ["travel", "дорог", "logistics"],
    },
  }),
  fixture({
    id: "weigh_in_day",
    title: "Weigh-in day",
    description: "Weigh-in day should prioritize weight control, short activation and recovery.",
    input: makeInput({
      fixtureId: "weigh-in-day",
      daysToStart: 1,
      cycleLengthDays: 1,
      weightCutRequired: true,
    }),
    matrix: {
      forbiddenSelectedBlockTypes: ["leg_lmv", "spp", "mat_control_bouts", "mat_competition_model"],
      requiredAnySelectedBlockTypes: [["weigh_in", "recovery", "mobility"]],
      requiredExplanationKeywords: ["взвеш", "weight"],
    },
  }),
  fixture({
    id: "competition_day",
    title: "Competition day",
    description: "D0 must select competition_start and no ordinary heavy training.",
    input: makeInput({
      fixtureId: "competition-day",
      daysToStart: 0,
      cycleLengthDays: 1,
      weightCutRequired: true,
    }),
    matrix: {
      forbiddenSelectedBlockTypes: ["leg_lmv", "spp", "mat_control_bouts", "mat_competition_model", "gpp"],
      requiredSelectedBlockTypes: ["competition_start"],
      requiredExplanationKeywords: ["competition", "старт"],
    },
  }),
  fixture({
    id: "post_competition_day",
    title: "Post-competition day",
    description: "After start, matrix should select recovery/post-competition recovery and no development.",
    input: makeInput({
      fixtureId: "post-competition",
      daysToStart: -1,
      cycleLengthDays: 1,
      currentPhase: "recovery",
    }),
    matrix: {
      forbiddenSelectedBlockTypes: ["leg_lmv", "spp", "mat_control_bouts", "mat_competition_model"],
      requiredAnySelectedBlockTypes: [["post_competition_recovery", "recovery"]],
      requiredExplanationKeywords: ["recovery", "восстанов"],
    },
  }),
  fixture({
    id: "secondary_start_d10",
    title: "Secondary start D-10",
    description: "Secondary start has softer warnings than main start but still rejects risky close-start blocks.",
    input: makeInput({
      fixtureId: "secondary-d10",
      daysToStart: 10,
      cycleLengthDays: 7,
      priority: "B",
      level: "national",
      planType: "secondary",
      peakRequired: true,
    }),
    matrix: {
      forbiddenSelectedBlockTypes: ["leg_lmv", "mat_control_bouts"],
      requiredAnySelectedBlockTypes: [["mat_light_technical", "recovery", "mobility"]],
      requiredExplanationKeywords: ["matrix"],
    },
  }),
  fixture({
    id: "far_development_week_d90",
    title: "Far development week D-90",
    description: "With 90 days left, development/SPP/GPP and larger two-session structure are allowed.",
    input: forceSeasonWindow(
      makeInput({
        fixtureId: "far-d90",
        daysToStart: 90,
        cycleLengthDays: 7,
        currentPhase: "base",
        goals: [
          {
            goalType: "legs_lme",
            priority: 1,
            reason: "Synthetic fixture: develop local leg endurance while the start is far away.",
          },
          {
            goalType: "aerobic_base",
            priority: 2,
            reason: "Synthetic fixture: support general base.",
          },
        ],
      }),
      {
        phase: "base",
        daysToStart: 90,
        cycleLengthDays: 7,
        allowedModes: ["development", "maintenance", "transfer", "recovery"],
        forbiddenModes: [],
        mandatoryFocus: ["legs_lme", "aerobic_base"],
        blockedFocus: [],
      },
    ),
    matrix: {
      requiredSelectedBlockTypes: ["leg_lmv"],
      requiredAnySelectedBlockTypes: [["gpp", "spp"]],
      requiredExplanationKeywords: ["развит", "matrix"],
      requireEveningSession: true,
    },
  }),
  fixture({
    id: "missing_readiness_data",
    title: "Missing readiness data",
    description: "Preview should not fail when readiness, sleep and resting HR are missing.",
    input: makeInput({
      fixtureId: "missing-readiness",
      daysToStart: 28,
      cycleLengthDays: 14,
      statePatch: {
        readinessScore: null,
        sleepHours: null,
        restingHr: null,
        deviceDataConfidence: "none",
      },
    }),
    matrix: {
      forbiddenSelectedBlockTypes: ["leg_lmv"],
      requiredSelectedBlockTypes: ["mat_competition_model"],
      requiredExplanationKeywords: ["готовности", "сна", "пульса покоя"],
    },
  }),
];
