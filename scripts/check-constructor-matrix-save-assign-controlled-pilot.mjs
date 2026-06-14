import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";

import {
  buildConstructorTemplatePayload,
  buildMatrixConstructorDraftIfAllowed,
  buildMatrixDrivenConstructorDraft,
  buildMatrixPrimaryPilotSaveDryRun,
  buildPerformConstructorDraft,
  CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY,
  decideMatrixConstructorRollout,
  evaluateMatrixPilotReadiness,
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

async function collectFiles(path) {
  const root = new URL(`../${path}`, import.meta.url);

  if (!existsSync(root)) {
    return [];
  }

  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  const ignoredDirectoryNames = new Set([
    ".git",
    ".next",
    ".vercel",
    ".turbo",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "tmp",
  ]);

  for (const entry of entries) {
    const childPath = `${path}/${entry.name}`;

    if (entry.isDirectory()) {
      if (ignoredDirectoryNames.has(entry.name)) {
        continue;
      }
      files.push(...await collectFiles(childPath));
    } else {
      files.push(childPath);
    }
  }

  return files;
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

function checkFeatureFlagChain() {
  const defaults = withFeatureFlagEnv(
    { internal: undefined, limited: undefined, saveAssign: undefined },
    () => getConstructorMatrixUiFlags(),
  );
  const limitedOnly = withFeatureFlagEnv(
    { internal: undefined, limited: "true", saveAssign: undefined },
    () => getConstructorMatrixUiFlags(),
  );
  const saveAssignWithoutLimited = withFeatureFlagEnv(
    { internal: "true", limited: undefined, saveAssign: "true" },
    () => getConstructorMatrixUiFlags(),
  );
  const limitedWithoutSaveAssign = withFeatureFlagEnv(
    { internal: "true", limited: "true", saveAssign: undefined },
    () => getConstructorMatrixUiFlags(),
  );
  const allEnabled = withFeatureFlagEnv(
    { internal: "true", limited: "true", saveAssign: "true" },
    () => getConstructorMatrixUiFlags(),
  );

  assert(defaults.internalMatrixConstructorUi === false, "internal Matrix UI flag must default off");
  assert(
    defaults.matrixConstructorLimitedPrimaryPilot === false,
    "limited Matrix primary pilot flag must default off",
  );
  assert(
    defaults.matrixConstructorSaveAssignPilot === false,
    "Matrix save/assign pilot flag must default off",
  );
  assert(
    limitedOnly.matrixConstructorLimitedPrimaryPilot === false &&
      limitedOnly.matrixConstructorSaveAssignPilot === false,
    "limited pilot must require NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI=true",
  );
  assert(
    saveAssignWithoutLimited.matrixConstructorSaveAssignPilot === false,
    "save/assign pilot must require NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT=true",
  );
  assert(
    limitedWithoutSaveAssign.matrixConstructorLimitedPrimaryPilot === true &&
      limitedWithoutSaveAssign.matrixConstructorSaveAssignPilot === false,
    "limited pilot must not imply save/assign pilot",
  );
  assert(
    allEnabled.internalMatrixConstructorUi === true &&
      allEnabled.matrixConstructorLimitedPrimaryPilot === true &&
      allEnabled.matrixConstructorSaveAssignPilot === true,
    "save/assign pilot must require all three explicit feature flags",
  );

  return {
    defaultInternal: defaults.internalMatrixConstructorUi,
    defaultLimitedPilot: defaults.matrixConstructorLimitedPrimaryPilot,
    defaultSaveAssignPilot: defaults.matrixConstructorSaveAssignPilot,
    saveAssignRequiresAllFlags: true,
  };
}

function fixtureById(id) {
  const fixture = constructorPreviewFixtures.find((item) => item.id === id);
  assert(fixture, `Expected constructor preview fixture ${id}`);

  return fixture;
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

function assertTemplatePayloadSafe(testId, payload) {
  const parsed = parsePlanTemplateBody(payload);
  const serialized = JSON.stringify(payload);
  const days = payload.days ?? [];
  const sessions = days.flatMap((day) => day.sessions ?? []);
  const blocks = sessions.flatMap((session) => session.blocks ?? []);
  const forbiddenPayloadMarkers = [
    '"matrix"',
    '"aiRuntime"',
    '"rollout"',
    '"pilotReadiness"',
    '"reviewDecision"',
    '"sourceExpansion"',
    '"sourceCandidate"',
    '"runtimeEligibility"',
  ];

  assert(parsed.name === payload.name, `${testId}: template payload must parse through API schema`);
  assert(days.length > 0, `${testId}: template payload must contain days`);
  assert(sessions.length > 0, `${testId}: template payload must contain sessions`);
  assert(blocks.length > 0, `${testId}: template payload must contain blocks`);

  for (const marker of forbiddenPayloadMarkers) {
    assert(!serialized.includes(marker), `${testId}: template payload must not contain ${marker}`);
  }
}

function assertAssignmentPayloadsSafe(testId, fixture, payload) {
  const templateId = `template-${testId}`;
  const items = buildAssignmentItems(payload, templateId);
  const assignment = parseAssignedPlanBody({
    athleteId: fixture.input.athlete.athleteId,
    templateId,
    startDate: fixture.input.context.currentDate,
    dayLabel: "Day 1",
    notes: `Controlled pilot save/assign validation for ${payload.name}`,
    plannedPhase: fixture.input.context.currentPhase,
  });
  const autoAssign = parseAutoAssignMicrocycleBody({
    athleteId: fixture.input.athlete.athleteId,
    startDate: fixture.input.context.currentDate,
    daysCount: items.length,
    notes: `Controlled pilot save/assign validation for ${payload.name}`,
    plannedPhase: fixture.input.context.currentPhase,
    items,
  });

  assert(assignment.athleteId === fixture.input.athlete.athleteId, `${testId}: assignment athlete mismatch`);
  assert(assignment.templateId === templateId, `${testId}: assignment template mismatch`);
  assert(autoAssign.items.length === items.length, `${testId}: auto-assignment must cover every template day`);
  assert(
    autoAssign.items.every((item, index) => item.templateDayIndex === index && item.dayOffset === index),
    `${testId}: auto-assignment item indexes must stay stable`,
  );
}

function evaluateFixtureForControlledSave(testId) {
  const fixture = fixtureById(testId);
  const rolloutDecision = decideMatrixConstructorRollout(fixture.input);
  const pilotReadiness = evaluateMatrixPilotReadiness(fixture.input);
  const primaryPilotEligible =
    rolloutDecision.mode === "matrix_allowed_for_primary" &&
    rolloutDecision.matrixPrimaryAllowed &&
    rolloutDecision.blockers.length === 0 &&
    pilotReadiness.status === "ready_for_limited_primary_pilot" &&
    pilotReadiness.blockers.length === 0;
  const matrixDraft = buildMatrixDrivenConstructorDraft(fixture.input);
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

  const dryRun = buildMatrixPrimaryPilotSaveDryRun({
    activeDraftSource: "matrix_primary_pilot",
    draft: matrixDraft,
    primaryPilotEligible,
    eligibilityReason: primaryPilotEligible ? null : "not eligible for Matrix primary pilot",
    eligibilityEvidence: [
      `rolloutMode=${rolloutDecision.mode}`,
      `rolloutBlockers=${rolloutDecision.blockers.length}`,
      `readiness=${pilotReadiness.status}`,
      `readinessBlockers=${pilotReadiness.blockers.length}`,
      ...(allowedDraftError ? [`allowedDraftError=${allowedDraftError}`] : []),
    ],
    templateName: `PERFORM Matrix Save Assign Controlled Pilot ${testId}`,
  });
  const serverGate = canUseMatrixPrimaryPilotWithServerEvidence({
    serverResult: {
      generatedFrom: "matrix_primary_pilot_server_save_dry_run",
      generatedAt: new Date("2026-06-14T12:00:00.000Z").toISOString(),
      dryRun,
      rolloutDecision,
      pilotReadiness,
      notes: ["constructor matrix save/assign controlled pilot validation"],
    },
    localRolloutDecision: rolloutDecision,
    localPilotReadiness: pilotReadiness,
  });
  const activeSource =
    primaryPilotEligible &&
    serverGate.allowed &&
    dryRun.status === "passed" &&
    allowedDraftResult?.source === "matrix"
      ? "matrix_primary_pilot"
      : "legacy_fallback";
  const activeDraft =
    activeSource === "matrix_primary_pilot" && allowedDraftResult?.draft
      ? allowedDraftResult.draft
      : buildPerformConstructorDraft(fixture.input);
  const payload =
    activeSource === "matrix_primary_pilot"
      ? buildConstructorTemplatePayload(
          activeDraft,
          `PERFORM Matrix Save Assign Controlled Pilot ${testId}`,
        )
      : null;

  return {
    fixture,
    rolloutDecision,
    pilotReadiness,
    primaryPilotEligible,
    dryRun,
    serverGate,
    activeSource,
    activeDraft,
    payload,
  };
}

async function assertProductionRoutesAndApiContracts() {
  const planningRoutesSource = await readProjectFile("apps/api/src/api/planning/planning.routes.ts");
  const productionDraftRoute = extractRouteBlock(planningRoutesSource, "/api/v1/plans/constructor/draft");
  const createTemplateRoute = extractRouteBlock(planningRoutesSource, "/api/v1/plans/templates");
  const assignRoute = extractRouteBlock(planningRoutesSource, "/api/v1/plans/assign");
  const autoAssignRoute = extractRouteBlock(planningRoutesSource, "/api/v1/plans/auto-assign-microcycle");

  assert(
    productionDraftRoute.includes("buildPerformConstructorDraft(body)"),
    "production constructor draft route must remain legacy-backed",
  );
  assert(
    !productionDraftRoute.includes("buildMatrixDrivenConstructorDraft") &&
      !productionDraftRoute.includes("matrix_primary_pilot"),
    "production constructor draft route must not consume Matrix pilot logic",
  );
  assert(
    createTemplateRoute.includes("parsePlanTemplateBody") &&
      createTemplateRoute.includes("createPlanTemplate"),
    "template creation route must keep existing template API contract",
  );
  assert(
    assignRoute.includes("parseAssignedPlanBody") &&
      assignRoute.includes("assertAthleteAccess") &&
      assignRoute.includes("assignPlan"),
    "assignment route must keep existing assignment API contract and athlete access guard",
  );
  assert(
    autoAssignRoute.includes("parseAutoAssignMicrocycleBody") &&
      autoAssignRoute.includes("assertAthleteAccess") &&
      autoAssignRoute.includes("autoAssignMicrocycle"),
    "auto-assignment route must keep existing microcycle API contract and athlete access guard",
  );
}

async function assertUiControlledPilotGate() {
  const pageClientSource = await readProjectFile("apps/web/app/page-client.tsx");
  const requiredTokens = [
    "constructorMatrixSaveAssignPilotAllowed",
    "ENABLE_MATRIX_CONSTRUCTOR_SAVE_ASSIGN_PILOT",
    "activeConstructorDraftIsMatrixPrimaryPilot",
    "constructorMatrixPrimaryPilotEligibility.allowed",
    "constructorMatrixPrimaryPilotServerGate.allowed",
    'constructorMatrixPrimaryPilotSaveDryRun.status === "passed"',
    'constructorMatrixServerSaveDryRun?.dryRun.status === "passed"',
    "activeConstructorDraftSaveAllowed",
    "isConstructorDraftSaveAllowed(activeConstructorDraftSource)",
    "constructorMatrixSaveAssignPilotAllowed",
  ];

  for (const token of requiredTokens) {
    assert(pageClientSource.includes(token), `page client must keep controlled save gate token: ${token}`);
  }
}

async function assertNoDbMigrationRequired() {
  const candidateFiles = (
    await Promise.all([
      collectFiles("apps/api"),
      collectFiles("packages"),
      collectFiles("scripts"),
      collectFiles("docs"),
    ])
  ).flat();
  const migrationFiles = candidateFiles.filter((path) =>
    /(^|\/)(migrations?|db|database)(\/|$)|migration/i.test(path),
  );

  for (const file of migrationFiles) {
    if (!/\.(sql|ts|js|mjs|json)$/.test(file)) {
      continue;
    }

    const source = await readProjectFile(file);
    assert(
      !/\b(matrix|aiRuntime|pilotReadiness|runtimeEligibility)\b/i.test(source),
      `${file}: Matrix controlled save/assign must not require a DB schema migration`,
    );
  }

  return migrationFiles;
}

function assertHighRiskAreasStayBlocked() {
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

  return highRiskAreas.map((area) => {
    const entries = CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY.filter((item) =>
      item.riskAreas.includes(area),
    );
    assert(entries.length > 0, `Expected high-risk runtime eligibility coverage for ${area}`);

    for (const entry of entries) {
      assert(entry.status === "blocked_high_risk", `${entry.id}: ${area} must stay blocked_high_risk`);
      assert(entry.allowedRuntimeUse === "none", `${entry.id}: ${area} must not allow runtime use`);
      assert(entry.runtimeChangeAllowedNow === false, `${entry.id}: ${area} must not allow runtime changes`);
      assert(entry.humanReviewed === false, `${entry.id}: ${area} must not imply human review`);
      assert(
        entry.forbiddenRuntimeUses.includes("medical_decision") ||
          entry.forbiddenRuntimeUses.includes("automatic_weight_cut") ||
          entry.forbiddenRuntimeUses.includes("automatic_BFR_KAATSU"),
        `${entry.id}: ${area} must keep explicit forbidden runtime uses`,
      );
    }

    return {
      area,
      ids: entries.map((entry) => entry.id),
    };
  });
}

async function assertDocs() {
  const requiredDocs = [
    "docs/matrix-save-assign-controlled-pilot.md",
    "docs/matrix-final-controlled-pilot-readiness.md",
    "docs/perform-constructor-core-stack.md",
    "docs/constructor-phase-matrix-transition-plan.md",
    "docs/constructor-matrix-production-rollout.md",
    "docs/matrix-controlled-pilot-runbook.md",
    "docs/matrix-controlled-pilot-e2e-validation.md",
    "docs/constructor-matrix-evidence-dependency-gap-audit.md",
  ];
  const requiredTokens = [
    "Matrix Save/Assign Controlled Pilot",
    "Final Controlled Pilot Readiness",
    "Matrix is not production default",
    "high-risk medical decisions remain non-automated",
    "no DB schema migration",
    "no numeric threshold",
    "no fake human approvals",
  ];

  for (const path of requiredDocs) {
    const source = await readProjectFile(path);
    const normalized = source.replace(/\s+/g, " ");

    for (const token of requiredTokens) {
      assert(normalized.includes(token), `${path} must mention: ${token}`);
    }
  }
}

const allowedPilotFixtureIds = [
  "far_development_week_d90",
  "main_start_d28_special_pre_competition",
  "main_start_d21_controlled_volume",
  "main_start_d10_taper",
  "main_start_d4_start_window",
];
const blockedFixtureIds = [
  "main_start_d3_final_activation",
  "travel_day",
  "weigh_in_day",
  "competition_day",
];

const featureFlags = checkFeatureFlagChain();
const saveAllowed = {
  legacy: isConstructorDraftSaveAllowed("legacy"),
  matrix_internal: isConstructorDraftSaveAllowed("matrix_internal"),
  matrix_primary_pilot: isConstructorDraftSaveAllowed("matrix_primary_pilot"),
};
assert(saveAllowed.legacy, "legacy constructor draft must remain save-capable");
assert(!saveAllowed.matrix_internal, "matrix_internal must remain read-only");
assert(!saveAllowed.matrix_primary_pilot, "matrix_primary_pilot must remain read-only by default");

const allowedResults = allowedPilotFixtureIds.map((fixtureId) => {
  const result = evaluateFixtureForControlledSave(fixtureId);

  assert(result.activeSource === "matrix_primary_pilot", `${fixtureId}: Matrix pilot must be active`);
  assert(result.rolloutDecision.mode === "matrix_allowed_for_primary", `${fixtureId}: rollout must allow primary`);
  assert(
    result.pilotReadiness.status === "ready_for_limited_primary_pilot",
    `${fixtureId}: pilot readiness must allow limited primary pilot`,
  );
  assert(result.dryRun.status === "passed", `${fixtureId}: save dry-run must pass`);
  assert(result.serverGate.allowed, `${fixtureId}: server gate must allow controlled save`);
  assert(result.payload, `${fixtureId}: Matrix pilot must produce template payload`);
  assertTemplatePayloadSafe(fixtureId, result.payload);
  assertAssignmentPayloadsSafe(fixtureId, result.fixture, result.payload);

  return {
    fixtureId,
    source: result.activeSource,
    rollout: result.rolloutDecision.mode,
    readiness: result.pilotReadiness.status,
    dryRun: result.dryRun.status,
    serverGate: result.serverGate.allowed,
    days: result.payload.days?.length ?? 0,
    sessions: result.payload.days?.flatMap((day) => day.sessions ?? []).length ?? 0,
    blocks:
      result.payload.days
        ?.flatMap((day) => day.sessions ?? [])
        .flatMap((session) => session.blocks ?? []).length ?? 0,
  };
});

const blockedResults = blockedFixtureIds.map((fixtureId) => {
  const result = evaluateFixtureForControlledSave(fixtureId);
  const matrixInternalDryRun = buildMatrixPrimaryPilotSaveDryRun({
    activeDraftSource: "matrix_internal",
    draft: result.activeDraft,
    primaryPilotEligible: result.primaryPilotEligible,
    eligibilityReason: "matrix_internal is read-only",
    templateName: `PERFORM Matrix Save Assign Blocked ${fixtureId}`,
  });

  assert(result.activeSource === "legacy_fallback", `${fixtureId}: active source must fallback to legacy`);
  assert(!result.serverGate.allowed, `${fixtureId}: server gate must block Matrix pilot save`);
  assert(result.dryRun.status !== "passed", `${fixtureId}: Matrix pilot dry-run must not pass`);
  assert(!result.payload, `${fixtureId}: fallback scenarios must not create Matrix save payload`);
  assert(matrixInternalDryRun.status !== "passed", `${fixtureId}: matrix_internal must not save`);

  return {
    fixtureId,
    source: result.activeSource,
    rollout: result.rolloutDecision.mode,
    readiness: result.pilotReadiness.status,
    dryRun: result.dryRun.status,
    serverGate: result.serverGate.allowed,
    matrixInternalDryRun: matrixInternalDryRun.status,
  };
});

await assertProductionRoutesAndApiContracts();
await assertUiControlledPilotGate();
const migrationFiles = await assertNoDbMigrationRequired();
const highRiskCoverage = assertHighRiskAreasStayBlocked();
await assertDocs();

console.log(JSON.stringify({
  ok: true,
  featureFlags,
  saveAllowed,
  allowedPilotScenarios: allowedResults,
  blockedPilotScenarios: blockedResults,
  highRiskCoverage,
  dbMigrationFilesChecked: migrationFiles,
  productionRouteLegacyBacked: true,
  matrixDefaultEnabled: false,
  noDbSchemaMigrationRequired: true,
  noNumericThresholdRuntimeGates: true,
  noFakeHumanApprovals: true,
}, null, 2));
