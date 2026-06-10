import {
  buildConstructorMatrixPreviewResponse,
  buildMatrixDrivenConstructorDraft,
  buildMatrixPrimaryPilotSaveDryRun,
  decideMatrixConstructorRollout,
  evaluateMatrixPilotReadiness,
} from "@training-platform/shared";
import { readFile } from "node:fs/promises";
import { constructorPreviewFixtures } from "./fixtures/constructor/preview-regression-fixtures.mjs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const gateModule = await import("../apps/web/app/lib/constructor-matrix-primary-pilot-server-gate.ts");
const { canUseMatrixPrimaryPilotWithServerEvidence } = gateModule.default ?? gateModule;
const localPilotModule = await import("../apps/web/app/lib/constructor-matrix-primary-pilot.ts");
const { canUseMatrixPrimaryPilot } = localPilotModule.default ?? localPilotModule;
const matrixUiModule = await import("../apps/web/app/lib/constructor-matrix-ui.ts");
const { isConstructorDraftSaveAllowed } = matrixUiModule.default ?? matrixUiModule;
const featureFlagsModule = await import("../apps/web/app/lib/feature-flags.ts");
const { getConstructorMatrixUiFlags } = featureFlagsModule.default ?? featureFlagsModule;

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

function extractFunctionBlock(source, name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert(start >= 0, `Expected function ${name}`);
  const nextFunction = source.indexOf("\n  function ", start + marker.length);

  return source.slice(start, nextFunction >= 0 ? nextFunction : source.length);
}

function withFeatureFlagEnv(nextEnv, callback) {
  const internalKey = "NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI";
  const limitedKey = "NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT";
  const saveAssignKey = "NEXT_PUBLIC_MATRIX_CONSTRUCTOR_SAVE_ASSIGN_PILOT";
  const previous = {
    internal: process.env[internalKey],
    limited: process.env[limitedKey],
    saveAssign: process.env[saveAssignKey],
  };

  try {
    if (Object.prototype.hasOwnProperty.call(nextEnv, "internal")) {
      if (nextEnv.internal === undefined) {
        delete process.env[internalKey];
      } else {
        process.env[internalKey] = nextEnv.internal;
      }
    }

    if (Object.prototype.hasOwnProperty.call(nextEnv, "limited")) {
      if (nextEnv.limited === undefined) {
        delete process.env[limitedKey];
      } else {
        process.env[limitedKey] = nextEnv.limited;
      }
    }

    if (Object.prototype.hasOwnProperty.call(nextEnv, "saveAssign")) {
      if (nextEnv.saveAssign === undefined) {
        delete process.env[saveAssignKey];
      } else {
        process.env[saveAssignKey] = nextEnv.saveAssign;
      }
    }

    return callback();
  } finally {
    if (previous.internal === undefined) {
      delete process.env[internalKey];
    } else {
      process.env[internalKey] = previous.internal;
    }

    if (previous.limited === undefined) {
      delete process.env[limitedKey];
    } else {
      process.env[limitedKey] = previous.limited;
    }

    if (previous.saveAssign === undefined) {
      delete process.env[saveAssignKey];
    } else {
      process.env[saveAssignKey] = previous.saveAssign;
    }
  }
}

function checkFeatureFlagDefaults() {
  const defaults = withFeatureFlagEnv({ internal: undefined, limited: undefined }, () =>
    getConstructorMatrixUiFlags(),
  );
  assert(
    defaults.internalMatrixConstructorUi === false,
    "Internal matrix UI flag must be off by default",
  );
  assert(
    defaults.matrixConstructorLimitedPrimaryPilot === false,
    "Limited matrix primary pilot flag must be off by default",
  );
  assert(
    defaults.matrixConstructorSaveAssignPilot === false,
    "Matrix save/assign pilot flag must be off by default",
  );

  const limitedWithoutInternal = withFeatureFlagEnv(
    { internal: undefined, limited: "true" },
    () => getConstructorMatrixUiFlags(),
  );
  assert(
    limitedWithoutInternal.internalMatrixConstructorUi === false,
    "Limited pilot env must not enable internal matrix UI",
  );
  assert(
    limitedWithoutInternal.matrixConstructorLimitedPrimaryPilot === false,
    "Limited pilot must be ignored unless internal matrix UI is explicitly enabled",
  );
  assert(
    limitedWithoutInternal.matrixConstructorSaveAssignPilot === false,
    "Save/assign pilot must be ignored unless internal matrix UI is explicitly enabled",
  );

  const internalOnly = withFeatureFlagEnv({ internal: "true", limited: undefined }, () =>
    getConstructorMatrixUiFlags(),
  );
  assert(internalOnly.internalMatrixConstructorUi, "Explicit internal flag must enable UI");
  assert(
    internalOnly.matrixConstructorLimitedPrimaryPilot === false,
    "Internal UI flag alone must not enable matrix primary pilot",
  );
  assert(
    internalOnly.matrixConstructorSaveAssignPilot === false,
    "Internal UI flag alone must not enable matrix save/assign pilot",
  );

  const bothEnabled = withFeatureFlagEnv({ internal: "true", limited: "true" }, () =>
    getConstructorMatrixUiFlags(),
  );
  assert(bothEnabled.internalMatrixConstructorUi, "Explicit internal flag must stay enabled");
  assert(
    bothEnabled.matrixConstructorLimitedPrimaryPilot,
    "Limited matrix primary pilot must enable only when both flags are explicit",
  );
  assert(
    bothEnabled.matrixConstructorSaveAssignPilot === false,
    "Limited matrix primary pilot alone must not enable save/assign pilot",
  );

  const allEnabled = withFeatureFlagEnv(
    { internal: "true", limited: "true", saveAssign: "true" },
    () => getConstructorMatrixUiFlags(),
  );
  assert(
    allEnabled.matrixConstructorSaveAssignPilot,
    "Matrix save/assign pilot must require all three explicit flags",
  );

  return {
    defaultInternal: defaults.internalMatrixConstructorUi,
    defaultLimitedPilot: defaults.matrixConstructorLimitedPrimaryPilot,
    defaultSaveAssignPilot: defaults.matrixConstructorSaveAssignPilot,
    limitedRequiresInternal:
      !limitedWithoutInternal.matrixConstructorLimitedPrimaryPilot &&
      !internalOnly.matrixConstructorLimitedPrimaryPilot &&
      bothEnabled.matrixConstructorLimitedPrimaryPilot,
    saveAssignRequiresLimitedPilot:
      !limitedWithoutInternal.matrixConstructorSaveAssignPilot &&
      !internalOnly.matrixConstructorSaveAssignPilot &&
      !bothEnabled.matrixConstructorSaveAssignPilot &&
      allEnabled.matrixConstructorSaveAssignPilot,
  };
}

async function checkControlledExposureSourceGuards() {
  const featureFlagSource = await readProjectFile("apps/web/app/lib/feature-flags.ts");
  assert(
    featureFlagSource.includes("NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI"),
    "Internal matrix UI must be controlled by NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI",
  );
  assert(
    featureFlagSource.includes("NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT"),
    "Limited primary pilot must be controlled by NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT",
  );
  assert(
    featureFlagSource.includes("NEXT_PUBLIC_MATRIX_CONSTRUCTOR_SAVE_ASSIGN_PILOT"),
    "Save/assign pilot must be controlled by NEXT_PUBLIC_MATRIX_CONSTRUCTOR_SAVE_ASSIGN_PILOT",
  );
  assert(
    featureFlagSource.includes("const matrixConstructorLimitedPrimaryPilot") &&
      featureFlagSource.includes("internalMatrixConstructorUi &&") &&
      featureFlagSource.includes("matrixConstructorLimitedPrimaryPilot,"),
    "Limited primary pilot must require the internal matrix UI flag",
  );
  assert(
    featureFlagSource.includes("matrixConstructorSaveAssignPilot:") &&
      featureFlagSource.includes("matrixConstructorLimitedPrimaryPilot &&"),
    "Save/assign pilot must require the limited primary pilot flag",
  );

  const pageClientSource = await readProjectFile("apps/web/app/page-client.tsx");
  const buildPreviewBlock = extractFunctionBlock(pageClientSource, "handleBuildConstructorMatrixPreview");
  const openWorkspaceBlock = extractFunctionBlock(pageClientSource, "handleOpenConstructorMatrixWorkspace");
  const activateInternalBlock = extractFunctionBlock(
    pageClientSource,
    "handleActivateConstructorMatrixInternalDraft",
  );
  const activatePrimaryBlock = extractFunctionBlock(
    pageClientSource,
    "handleActivateConstructorMatrixPrimaryPilotDraft",
  );

  assert(
    buildPreviewBlock.includes("if (!SHOW_INTERNAL_MATRIX_CONSTRUCTOR_UI)"),
    "Matrix preview build must return early when internal UI flag is off",
  );
  assert(
    buildPreviewBlock.includes("ENABLE_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT") &&
      buildPreviewBlock.includes("requestMatrixPrimaryPilotServerSaveDryRun"),
    "Server save dry-run request must remain scoped behind limited primary pilot flag",
  );
  assert(
    openWorkspaceBlock.includes("!SHOW_INTERNAL_MATRIX_CONSTRUCTOR_UI"),
    "Matrix workspace open must be gated by internal UI flag",
  );
  assert(
    activateInternalBlock.includes("!SHOW_INTERNAL_MATRIX_CONSTRUCTOR_UI"),
    "Matrix internal activation must be gated by internal UI flag",
  );
  assert(
    activatePrimaryBlock.includes("!SHOW_INTERNAL_MATRIX_CONSTRUCTOR_UI") &&
      activatePrimaryBlock.includes("!ENABLE_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT"),
    "Matrix primary pilot activation must require both internal and limited pilot flags",
  );
  assert(
    /SHOW_INTERNAL_MATRIX_CONSTRUCTOR_UI\s*\?\s*\(\s*<MatrixConstructorPreviewPanel/.test(
      pageClientSource,
    ),
    "Matrix preview panel must render only behind the internal UI flag",
  );
  assert(
    !/localStorage\.(?:getItem|setItem|removeItem)\([^)]*(?:matrix|Matrix|constructorMatrix|activeConstructorDraftSource)/.test(
      pageClientSource,
    ),
    "Matrix UI state must not be persisted in localStorage",
  );
  assert(
    !/sessionStorage\.(?:getItem|setItem|removeItem)\([^)]*(?:matrix|Matrix|constructorMatrix|activeConstructorDraftSource)/.test(
      pageClientSource,
    ),
    "Matrix UI state must not be persisted in sessionStorage",
  );

  const matrixSourceFiles = [
    "apps/web/app/components/constructor/MatrixConstructorPreviewPanel.tsx",
    "apps/web/app/components/constructor/MatrixDraftReadOnlyView.tsx",
    "apps/web/app/components/constructor/MatrixInternalDraftBanner.tsx",
    "apps/web/app/components/constructor/MatrixPilotReadinessCard.tsx",
    "apps/web/app/components/constructor/MatrixPreviewWorkspace.tsx",
    "apps/web/app/components/constructor/MatrixPrimaryPilotSaveDryRunCard.tsx",
    "apps/web/app/components/constructor/MatrixReviewExportActions.tsx",
    "apps/web/app/components/constructor/MatrixRolloutDecisionCard.tsx",
    "apps/web/app/lib/constructor-matrix-primary-pilot-server-gate.ts",
    "apps/web/app/lib/constructor-matrix-primary-pilot.ts",
    "apps/web/app/lib/constructor-matrix-review-export.ts",
    "apps/web/app/lib/constructor-matrix-save-dry-run.ts",
    "apps/web/app/lib/constructor-matrix-ui.ts",
    "apps/web/app/lib/feature-flags.ts",
  ];

  for (const path of matrixSourceFiles) {
    const source = await readProjectFile(path);
    assert(!/localStorage|sessionStorage/i.test(source), `${path} must not persist matrix UI state`);
    assert(!/telemetry/i.test(source), `${path} must not add matrix telemetry`);
  }

  const planningRoutesSource = await readProjectFile("apps/api/src/api/planning/planning.routes.ts");
  const productionDraftRoute = extractRouteBlock(
    planningRoutesSource,
    "/api/v1/plans/constructor/draft",
  );
  assert(
    productionDraftRoute.includes("buildPerformConstructorDraft(body)"),
    "Production constructor draft route must keep using the legacy builder",
  );
  assert(
    !productionDraftRoute.includes("buildMatrixDrivenConstructorDraft") &&
      !productionDraftRoute.includes("decideMatrixConstructorRollout") &&
      !productionDraftRoute.includes("matrix"),
    "Production constructor draft route must not become matrix-backed",
  );

  const internalRoutes = [
    "/api/v1/plans/constructor/internal/matrix-preview",
    "/api/v1/plans/constructor/internal/matrix-rollout-decision",
    "/api/v1/plans/constructor/internal/matrix-primary-pilot-save-dry-run",
  ];
  for (const route of internalRoutes) {
    const routeBlock = extractRouteBlock(planningRoutesSource, route);
    assert(
      routeBlock.includes('user.role !== "coach" && user.role !== "admin"'),
      `${route} must remain coach/admin only`,
    );
    assert(routeBlock.includes("assertAthleteAccess"), `${route} must assert athlete access`);
    assert(
      routeBlock.includes("no DB writes") || route.includes("save-dry-run"),
      `${route} must document internal/no-write behavior`,
    );
  }

  return {
    uiGated: true,
    noStoragePersistence: true,
    productionDraftRouteLegacy: true,
    internalEndpointsGuarded: true,
    limitedPilotServerDryRunFlagScoped: true,
  };
}

const previewOptions = {
  includeDrafts: true,
  includeComparisonReport: true,
  includeSafetyDetails: true,
  includeInfoDifferences: false,
};
const rolloutOptions = { previewOptions };

function fixtureById(id) {
  const fixture = constructorPreviewFixtures.find((item) => item.id === id);
  assert(fixture, `Expected constructor preview fixture ${id}`);
  return fixture;
}

function serverResponseForFixture(id) {
  const fixture = fixtureById(id);
  const preview = buildConstructorMatrixPreviewResponse(fixture.input, previewOptions);
  const rolloutDecision = decideMatrixConstructorRollout(fixture.input, rolloutOptions);
  const pilotReadiness = evaluateMatrixPilotReadiness(fixture.input, { rolloutOptions });
  const primaryPilotEligible =
    rolloutDecision.mode === "matrix_allowed_for_primary" &&
    rolloutDecision.matrixPrimaryAllowed &&
    rolloutDecision.blockers.length === 0 &&
    pilotReadiness.status === "ready_for_limited_primary_pilot" &&
    pilotReadiness.blockers.length === 0;
  const matrixDraft = buildMatrixDrivenConstructorDraft(
    fixture.input,
    previewOptions.matrixOptions,
  );
  const dryRun = buildMatrixPrimaryPilotSaveDryRun({
    activeDraftSource: "matrix_primary_pilot",
    draft: matrixDraft,
    primaryPilotEligible,
    templateName: "PERFORM Matrix Primary Pilot Dry Run",
  });

  return {
    generatedFrom: "matrix_primary_pilot_server_save_dry_run",
    generatedAt: new Date("2026-06-10T12:00:00.000Z").toISOString(),
    dryRun,
    preview,
    rolloutDecision,
    pilotReadiness,
    notes: ["constructor matrix UI gate regression check"],
  };
}

function gateForFixture(id) {
  const serverResult = serverResponseForFixture(id);
  const matrixDraft = serverResult.preview.matrixDraft ?? serverResult.preview.comparisonReport?.matrixDraft ?? null;

  return {
    serverResult,
    localEligibility: canUseMatrixPrimaryPilot({
      activeDraftSource: "matrix_primary_pilot",
      internalUiEnabled: true,
      limitedPilotEnabled: true,
      preview: serverResult.preview,
      rolloutDecision: serverResult.rolloutDecision,
      pilotReadiness: serverResult.pilotReadiness,
      matrixDraft,
    }),
    gate: canUseMatrixPrimaryPilotWithServerEvidence({
      serverResult,
      localRolloutDecision: serverResult.rolloutDecision,
      localPilotReadiness: serverResult.pilotReadiness,
    }),
  };
}

const cases = [
  {
    id: "far_development_week_d90",
    allowed: true,
    reason: null,
  },
  {
    id: "main_start_d28_special_pre_competition",
    allowed: true,
    reason: null,
  },
  {
    id: "main_start_d21_controlled_volume",
    allowed: true,
    reason: null,
  },
  {
    id: "main_start_d10_taper",
    allowed: true,
    reason: null,
  },
  {
    id: "main_start_d4_start_window",
    allowed: true,
    reason: null,
  },
  {
    id: "main_start_d3_final_activation",
    allowed: false,
    reason: "server_dry_run_blocked",
  },
  {
    id: "travel_day",
    allowed: false,
    reason: "server_dry_run_blocked",
  },
  {
    id: "weigh_in_day",
    allowed: false,
    reason: "server_dry_run_blocked",
  },
];

const results = cases.map((testCase) => {
  const { serverResult, localEligibility, gate } = gateForFixture(testCase.id);

  assert(
    localEligibility.allowed === testCase.allowed,
    `${testCase.id}: expected local eligibility allowed=${testCase.allowed}, got ${localEligibility.allowed}/${localEligibility.reason}`,
  );
  assert(
    gate.allowed === testCase.allowed,
    `${testCase.id}: expected allowed=${testCase.allowed}, got ${gate.allowed}`,
  );
  assert(
    gate.reason === testCase.reason,
    `${testCase.id}: expected reason=${testCase.reason}, got ${gate.reason}`,
  );

  return {
    id: testCase.id,
    allowed: gate.allowed,
    localAllowed: localEligibility.allowed,
    reason: gate.reason,
    dryRun: serverResult.dryRun.status,
    rollout: serverResult.rolloutDecision.mode,
    readiness: serverResult.pilotReadiness.status,
  };
});

const missingGate = canUseMatrixPrimaryPilotWithServerEvidence({ serverResult: null });
assert(!missingGate.allowed, "Missing server dry-run evidence must block primary pilot");
assert(
  missingGate.reason === "server_dry_run_missing",
  `Expected missing server dry-run reason, got ${missingGate.reason}`,
);

const errorServerResult = serverResponseForFixture("far_development_week_d90");
const errorGate = canUseMatrixPrimaryPilotWithServerEvidence({
  serverResult: errorServerResult,
  serverError: "Synthetic server failure",
  localRolloutDecision: errorServerResult.rolloutDecision,
  localPilotReadiness: errorServerResult.pilotReadiness,
});
assert(!errorGate.allowed, "Server dry-run error must block primary pilot");
assert(
  errorGate.reason === "server_dry_run_error",
  `Expected server dry-run error reason, got ${errorGate.reason}`,
);

const mismatchServerResult = serverResponseForFixture("far_development_week_d90");
mismatchServerResult.pilotReadiness = {
  ...mismatchServerResult.pilotReadiness,
  scenario: "post_competition_recovery",
};
const mismatchGate = canUseMatrixPrimaryPilotWithServerEvidence({
  serverResult: mismatchServerResult,
  localRolloutDecision: mismatchServerResult.rolloutDecision,
  localPilotReadiness: mismatchServerResult.pilotReadiness,
});
assert(!mismatchGate.allowed, "Server rollout/readiness mismatch must block primary pilot");
assert(
  mismatchGate.reason === "server_evidence_mismatch",
  `Expected server evidence mismatch reason, got ${mismatchGate.reason}`,
);

const saveAllowed = {
  legacy: isConstructorDraftSaveAllowed("legacy"),
  matrix_internal: isConstructorDraftSaveAllowed("matrix_internal"),
  matrix_primary_pilot: isConstructorDraftSaveAllowed("matrix_primary_pilot"),
};
assert(saveAllowed.legacy, "Legacy constructor draft must remain save-capable");
assert(
  !saveAllowed.matrix_internal,
  "matrix_internal draft must remain read-only and blocked from save/template flow",
);
assert(
  !saveAllowed.matrix_primary_pilot,
  "matrix_primary_pilot draft must remain read-only and blocked from save/template flow",
);

const featureFlags = checkFeatureFlagDefaults();
const controlledExposure = await checkControlledExposureSourceGuards();

console.log(
  JSON.stringify(
    {
      status: "ok",
      cases: results,
      missingGate: {
        allowed: missingGate.allowed,
        reason: missingGate.reason,
      },
      errorGate: {
        allowed: errorGate.allowed,
        reason: errorGate.reason,
      },
      mismatchGate: {
        allowed: mismatchGate.allowed,
        reason: mismatchGate.reason,
      },
      saveAllowed,
      featureFlags,
      controlledExposure,
    },
    null,
    2,
  ),
);
