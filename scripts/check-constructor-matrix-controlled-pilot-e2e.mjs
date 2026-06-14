import { readFile } from "node:fs/promises";

import {
  buildConstructorTemplatePayload,
  buildMatrixConstructorDraftIfAllowed,
  buildMatrixDrivenConstructorDraft,
  buildMatrixPrimaryPilotSaveDryRun,
  buildPerformConstructorDraft,
  decideMatrixConstructorRollout,
  evaluateMatrixPilotReadiness,
  CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY,
} from "@training-platform/shared";
import { constructorPreviewFixtures } from "./fixtures/constructor/preview-regression-fixtures.mjs";

const gateModule = await import("../apps/web/app/lib/constructor-matrix-primary-pilot-server-gate.ts");
const { canUseMatrixPrimaryPilotWithServerEvidence } = gateModule.default ?? gateModule;
const featureFlagsModule = await import("../apps/web/app/lib/feature-flags.ts");
const { getConstructorMatrixUiFlags } = featureFlagsModule.default ?? featureFlagsModule;
const matrixUiModule = await import("../apps/web/app/lib/constructor-matrix-ui.ts");
const { isConstructorDraftSaveAllowed } = matrixUiModule.default ?? matrixUiModule;
const planningSchemasModule = await import("../apps/api/src/api/planning/planning.schemas.ts");
const { parseAssignedPlanBody, parseAutoAssignMicrocycleBody, parsePlanTemplateBody } =
  planningSchemasModule.default ?? planningSchemasModule;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readProjectFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function extractRouteBlock(source, routePath) {
  const marker = `app.post("${routePath}"`;
  const start = source.indexOf(marker);
  assert(start >= 0, `Expected route ${routePath}`);
  const nextRoute = source.indexOf("\n  app.", start + marker.length);

  return source.slice(start, nextRoute >= 0 ? nextRoute : source.length);
}

function withFeatureFlagEnv(nextEnv, callback) {
  const keys = {
    internal: "NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI",
    limited: "NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT",
    saveAssign: "NEXT_PUBLIC_MATRIX_CONSTRUCTOR_SAVE_ASSIGN_PILOT",
  };
  const previous = Object.fromEntries(
    Object.entries(keys).map(([name, key]) => [name, process.env[key]]),
  );

  try {
    for (const [name, key] of Object.entries(keys)) {
      if (!Object.prototype.hasOwnProperty.call(nextEnv, name)) {
        continue;
      }

      if (nextEnv[name] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = nextEnv[name];
      }
    }

    return callback();
  } finally {
    for (const [name, key] of Object.entries(keys)) {
      if (previous[name] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[name];
      }
    }
  }
}

function fixtureById(id) {
  const fixture = constructorPreviewFixtures.find((item) => item.id === id);
  assert(fixture, `Expected constructor preview fixture ${id}`);

  return fixture;
}

function draftStats(draft) {
  const days = draft.plan.weeks.flatMap((week) => week.days);
  const sessions = days.flatMap((day) => day.sessions ?? []);
  const blocks = sessions.flatMap((session) => session.blocks);

  return {
    weeks: draft.plan.weeks.length,
    days: days.length,
    sessions: sessions.length,
    blocks: blocks.length,
    blockTypes: Array.from(
      new Set(blocks.map((block) => String(block.blockType ?? block.type ?? block.targetQuality ?? block.name))),
    ).sort(),
  };
}

function assertMatrixAiRuntimeMetadataSafe(testId, draft) {
  assert(draft.generatedFrom === "matrix", `${testId}: expected matrix generated draft`);
  assert(draft.matrix?.aiRuntime?.metadataOnly === true, `${testId}: matrix.aiRuntime must be metadata-only`);
  assert(
    draft.matrix.aiRuntime.runtimeHardGatesEnabled === false,
    `${testId}: runtime hard gates must stay disabled`,
  );
  assert(
    draft.matrix.aiRuntime.highRiskAutomationEnabled === false,
    `${testId}: high-risk automation must stay disabled`,
  );
  assert(
    draft.matrix.aiRuntime.numericThresholdRuntimeGatesEnabled === false,
    `${testId}: numeric threshold runtime gates must stay disabled`,
  );
  assert(
    draft.matrix.aiRuntime.medicalDecisionAutomationEnabled === false,
    `${testId}: medical decision automation must stay disabled`,
  );
  assert(draft.matrix.aiRuntime.humanReviewed === false, `${testId}: AI runtime must not imply human review`);
  assert(
    draft.matrix.aiRuntime.blockedHighRiskEligibilityIds.length >= 8,
    `${testId}: blocked high-risk metadata must remain present`,
  );
}

function assertTemplatePayloadSafe(testId, payload) {
  const parsed = parsePlanTemplateBody(payload);
  const serialized = JSON.stringify(payload);
  const days = payload.days ?? [];
  const sessions = days.flatMap((day) => day.sessions ?? []);
  const blocks = sessions.flatMap((session) => session.blocks ?? []);

  assert(parsed.name === payload.name, `${testId}: template payload must parse through API schema`);
  assert(days.length > 0, `${testId}: template payload must contain days`);
  assert(sessions.length > 0, `${testId}: template payload must contain sessions`);
  assert(blocks.length > 0, `${testId}: template payload must contain blocks`);
  assert(!serialized.includes('"matrix"'), `${testId}: template payload must not contain matrix internals`);
  assert(!serialized.includes('"aiRuntime"'), `${testId}: template payload must not contain aiRuntime`);
  assert(!serialized.includes('"rollout"'), `${testId}: template payload must not contain rollout metadata`);
  assert(!serialized.includes('"pilotReadiness"'), `${testId}: template payload must not contain readiness metadata`);
}

function buildAssignmentItems(templatePayload, templateId) {
  return (templatePayload.days ?? []).map((day, index) => ({
    templateId,
    templateDayIndex: index,
    dayOffset: index,
    dayLabel: day.label || `Day ${index + 1}`,
    microcycleType:
      day.notes ||
      templatePayload.templateGoal ||
      templatePayload.microcycleType ||
      templatePayload.name,
  }));
}

function assertAssignmentPayloadsSafe(testId, fixture, payload) {
  const items = buildAssignmentItems(payload, `template-${testId}`);
  const assignment = parseAssignedPlanBody({
    athleteId: fixture.input.athlete.athleteId,
    templateId: `template-${testId}`,
    startDate: fixture.input.context.currentDate,
    dayLabel: "Day 1",
    notes: `Controlled pilot E2E validation for ${payload.name}`,
    plannedPhase: fixture.input.context.currentPhase,
  });
  const autoAssign = parseAutoAssignMicrocycleBody({
    athleteId: fixture.input.athlete.athleteId,
    startDate: fixture.input.context.currentDate,
    daysCount: items.length,
    notes: `Controlled pilot E2E validation for ${payload.name}`,
    plannedPhase: fixture.input.context.currentPhase,
    items,
  });

  assert(assignment.athleteId === fixture.input.athlete.athleteId, `${testId}: assignment payload athlete mismatch`);
  assert(autoAssign.items.length === items.length, `${testId}: auto-assignment must cover every template day`);
}

function evaluatePilotFixture(testCase) {
  const fixture = fixtureById(testCase.id);
  const rolloutDecision = decideMatrixConstructorRollout(fixture.input);
  const pilotReadiness = evaluateMatrixPilotReadiness(fixture.input);
  const primaryPilotEligible =
    rolloutDecision.mode === "matrix_allowed_for_primary" &&
    rolloutDecision.matrixPrimaryAllowed &&
    rolloutDecision.blockers.length === 0 &&
    pilotReadiness.status === "ready_for_limited_primary_pilot" &&
    pilotReadiness.blockers.length === 0;
  const matrixDraft = buildMatrixDrivenConstructorDraft(fixture.input);
  const dryRun = buildMatrixPrimaryPilotSaveDryRun({
    activeDraftSource: "matrix_primary_pilot",
    draft: matrixDraft,
    primaryPilotEligible,
    templateName: `PERFORM Matrix E2E ${testCase.id}`,
  });
  let allowedDraftResult = null;
  let allowedDraftError = "";

  try {
    allowedDraftResult = buildMatrixConstructorDraftIfAllowed(fixture.input, {
      fallbackToLegacy: true,
      allowedModes: ["matrix_allowed_for_primary"],
    });
  } catch (error) {
    allowedDraftError = error instanceof Error ? error.message : String(error);
  }

  const gate = canUseMatrixPrimaryPilotWithServerEvidence({
    serverResult: {
      generatedFrom: "matrix_primary_pilot_server_save_dry_run",
      generatedAt: new Date("2026-06-14T12:00:00.000Z").toISOString(),
      dryRun,
      rolloutDecision,
      pilotReadiness,
      notes: ["constructor matrix controlled pilot E2E validation"],
    },
    localRolloutDecision: rolloutDecision,
    localPilotReadiness: pilotReadiness,
  });
  const source =
    primaryPilotEligible &&
    gate.allowed &&
    dryRun.status === "passed" &&
    allowedDraftResult?.source === "matrix"
      ? "matrix_primary_pilot"
      : "legacy_fallback";
  const activeDraft =
    source === "matrix_primary_pilot" && allowedDraftResult?.draft
      ? allowedDraftResult.draft
      : buildPerformConstructorDraft(fixture.input);
  const templatePayload = buildConstructorTemplatePayload(
    activeDraft,
    `PERFORM Matrix E2E ${testCase.id}`,
  );
  const stats = draftStats(activeDraft);

  assert(source === testCase.expectedSource, `${testCase.id}: expected source ${testCase.expectedSource}, got ${source}`);
  assert(
    dryRun.status === testCase.expectedDryRun,
    `${testCase.id}: expected dry-run ${testCase.expectedDryRun}, got ${dryRun.status}`,
  );
  assert(stats.weeks === testCase.expectedStats.weeks, `${testCase.id}: week count mismatch`);
  assert(stats.days === testCase.expectedStats.days, `${testCase.id}: day count mismatch`);
  assert(stats.sessions === testCase.expectedStats.sessions, `${testCase.id}: session count mismatch`);
  assert(stats.blocks === testCase.expectedStats.blocks, `${testCase.id}: block count mismatch`);

  assertTemplatePayloadSafe(testCase.id, templatePayload);
  assertAssignmentPayloadsSafe(testCase.id, fixture, templatePayload);

  if (source === "matrix_primary_pilot") {
    assert(gate.allowed, `${testCase.id}: server gate must allow active Matrix pilot`);
    assertMatrixAiRuntimeMetadataSafe(testCase.id, activeDraft);
  } else {
    assert(!gate.allowed, `${testCase.id}: server gate must block fallback scenario`);
    assert(activeDraft.generatedFrom !== "matrix", `${testCase.id}: fallback active draft must not be Matrix`);
  }

  return {
    id: testCase.id,
    source,
    dryRun: dryRun.status,
    rollout: rolloutDecision.mode,
    readiness: pilotReadiness.status,
    gateAllowed: gate.allowed,
    activeDraftGeneratedFrom: activeDraft.generatedFrom,
    stats,
    allowedDraftSource: allowedDraftResult?.source ?? null,
    allowedDraftError,
  };
}

const allowedPilotCases = [
  {
    id: "far_development_week_d90",
    expectedSource: "matrix_primary_pilot",
    expectedDryRun: "passed",
    expectedStats: { weeks: 1, days: 7, sessions: 11, blocks: 32 },
  },
  {
    id: "main_start_d28_special_pre_competition",
    expectedSource: "matrix_primary_pilot",
    expectedDryRun: "passed",
    expectedStats: { weeks: 4, days: 28, sessions: 37, blocks: 110 },
  },
  {
    id: "main_start_d21_controlled_volume",
    expectedSource: "matrix_primary_pilot",
    expectedDryRun: "passed",
    expectedStats: { weeks: 3, days: 21, sessions: 27, blocks: 81 },
  },
  {
    id: "main_start_d10_taper",
    expectedSource: "matrix_primary_pilot",
    expectedDryRun: "passed",
    expectedStats: { weeks: 2, days: 10, sessions: 12, blocks: 35 },
  },
  {
    id: "main_start_d4_start_window",
    expectedSource: "matrix_primary_pilot",
    expectedDryRun: "passed",
    expectedStats: { weeks: 1, days: 4, sessions: 4, blocks: 15 },
  },
];

const fallbackCases = [
  {
    id: "main_start_d3_final_activation",
    expectedSource: "legacy_fallback",
    expectedDryRun: "blocked",
    expectedStats: { weeks: 1, days: 3, sessions: 3, blocks: 14 },
  },
  {
    id: "travel_day",
    expectedSource: "legacy_fallback",
    expectedDryRun: "blocked",
    expectedStats: { weeks: 1, days: 2, sessions: 2, blocks: 9 },
  },
  {
    id: "weigh_in_day",
    expectedSource: "legacy_fallback",
    expectedDryRun: "blocked",
    expectedStats: { weeks: 1, days: 1, sessions: 1, blocks: 5 },
  },
  {
    id: "competition_day",
    expectedSource: "legacy_fallback",
    expectedDryRun: "blocked",
    expectedStats: { weeks: 1, days: 1, sessions: 1, blocks: 5 },
  },
];

const defaultFlags = withFeatureFlagEnv(
  { internal: undefined, limited: undefined, saveAssign: undefined },
  () => getConstructorMatrixUiFlags(),
);
assert(defaultFlags.internalMatrixConstructorUi === false, "internal Matrix UI must default off");
assert(defaultFlags.matrixConstructorLimitedPrimaryPilot === false, "limited pilot must default off");
assert(defaultFlags.matrixConstructorSaveAssignPilot === false, "save/assign pilot must default off");

const saveAllowed = {
  legacy: isConstructorDraftSaveAllowed("legacy"),
  matrix_internal: isConstructorDraftSaveAllowed("matrix_internal"),
  matrix_primary_pilot: isConstructorDraftSaveAllowed("matrix_primary_pilot"),
};
assert(saveAllowed.legacy, "legacy save must remain allowed");
assert(!saveAllowed.matrix_internal, "matrix_internal save must remain disabled");
assert(!saveAllowed.matrix_primary_pilot, "matrix_primary_pilot save must remain disabled by default");

const highRiskAreas = [
  "weight_cut",
  "hydration",
  "female_context",
  "RED-S",
  "pain",
  "injury",
  "youth_context",
  "bfr_kaatsu",
];
const highRiskCoverage = highRiskAreas.map((area) => {
  const entries = CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY.filter((item) =>
    item.riskAreas.includes(area),
  );
  assert(entries.length > 0, `Expected high-risk runtime eligibility coverage for ${area}`);

  for (const entry of entries) {
    assert(entry.status === "blocked_high_risk", `${entry.id}: ${area} must stay blocked_high_risk`);
    assert(entry.allowedRuntimeUse === "none", `${entry.id}: ${area} must not allow runtime use`);
    assert(entry.humanReviewed === false, `${entry.id}: ${area} must not imply human review`);
    assert(entry.runtimeChangeAllowedNow === false, `${entry.id}: ${area} must not allow runtime change`);
  }

  return {
    area,
    ids: entries.map((entry) => entry.id),
  };
});

const planningRoutesSource = await readProjectFile("apps/api/src/api/planning/planning.routes.ts");
const productionDraftRoute = extractRouteBlock(planningRoutesSource, "/api/v1/plans/constructor/draft");
assert(
  productionDraftRoute.includes("buildPerformConstructorDraft(body)"),
  "production constructor draft route must remain legacy-backed",
);
assert(
  !productionDraftRoute.includes("buildMatrixDrivenConstructorDraft") &&
    !productionDraftRoute.includes("matrix_primary_pilot"),
  "production constructor draft route must not be Matrix-backed",
);

const allowedResults = allowedPilotCases.map(evaluatePilotFixture);
const fallbackResults = fallbackCases.map(evaluatePilotFixture);

console.log(JSON.stringify({
  ok: true,
  allowedPilotCases: allowedResults,
  fallbackCases: fallbackResults,
  highRiskCoverage,
  featureFlags: defaultFlags,
  saveAllowed,
  productionDraftRouteLegacy: true,
  matrixDefaultEnabled: false,
}, null, 2));
