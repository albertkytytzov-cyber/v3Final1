import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";

import {
  buildConstructorMatrixDependencyMapSummary,
  buildConstructorMatrixRuntimeEligibilitySummary,
  buildMatrixConstructorDraftIfAllowed,
  buildMatrixDrivenAiRuntimeMetadata,
  buildMatrixDrivenConstructorDraft,
  buildMatrixPrimaryPilotSaveDryRun,
  buildPerformConstructorDraft,
  buildConstructorMatrixPreviewResponse,
  CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS,
  CONSTRUCTOR_MATRIX_DEPENDENCY_MAP,
  CONSTRUCTOR_MATRIX_DEPENDENCY_MAP_IDS,
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
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  const ignoredDirectoryNames = new Set([
    ".next",
    ".turbo",
    "build",
    "coverage",
    "dist",
    "node_modules",
  ]);

  for (const entry of entries) {
    const childPath = `${path}/${entry.name}`;

    if (entry.isDirectory()) {
      if (ignoredDirectoryNames.has(entry.name)) {
        continue;
      }
      files.push(...await collectFiles(childPath));
    } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) {
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

function fixtureById(id) {
  const fixture = constructorPreviewFixtures.find((item) => item.id === id);
  assert(fixture, `Expected constructor preview fixture ${id}`);

  return fixture;
}

function serverResponseForFixture(id) {
  const fixture = fixtureById(id);
  const previewOptions = {
    includeDrafts: true,
    includeComparisonReport: true,
    includeSafetyDetails: true,
    includeInfoDifferences: false,
  };
  const rolloutOptions = { previewOptions };
  const preview = buildConstructorMatrixPreviewResponse(fixture.input, previewOptions);
  const rolloutDecision = decideMatrixConstructorRollout(fixture.input, rolloutOptions);
  const pilotReadiness = evaluateMatrixPilotReadiness(fixture.input, { rolloutOptions });
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
    templateName: "PERFORM Matrix Dependency Map Dry Run",
  });
  let draftResult = null;
  let draftError = "";

  try {
    draftResult = buildMatrixConstructorDraftIfAllowed(fixture.input, {
      ...rolloutOptions,
      fallbackToLegacy: true,
      allowedModes: ["matrix_allowed_for_primary"],
    });
  } catch (error) {
    draftError = error instanceof Error ? error.message : String(error);
  }

  const matrixDraftAllowed =
    primaryPilotEligible && draftResult?.source === "matrix" && Boolean(draftResult.draft);
  const source = matrixDraftAllowed && dryRun.status === "passed" ? "matrix_primary_pilot" : "legacy_fallback";
  const activeDraft = source === "matrix_primary_pilot" ? draftResult.draft : buildPerformConstructorDraft(fixture.input);
  const gate = canUseMatrixPrimaryPilotWithServerEvidence({
    serverResult: {
      generatedFrom: "matrix_primary_pilot_server_save_dry_run",
      generatedAt: new Date("2026-06-14T12:00:00.000Z").toISOString(),
      dryRun,
      preview,
      rolloutDecision,
      pilotReadiness,
      notes: ["constructor matrix dependency map regression check"],
    },
    localRolloutDecision: rolloutDecision,
    localPilotReadiness: pilotReadiness,
  });

  return {
    id,
    source,
    preview,
    rolloutDecision,
    pilotReadiness,
    dryRun,
    gate,
    activeDraft,
    draftError,
  };
}

function assertNoFakeHumanReviewRecord(item, context) {
  assert(item.humanReviewed === false, `${context} must keep humanReviewed=false`);
  assert(!Object.prototype.hasOwnProperty.call(item, "reviewedBy"), `${context} must not include reviewedBy`);
  assert(!Object.prototype.hasOwnProperty.call(item, "reviewedAt"), `${context} must not include reviewedAt`);
}

const expectedLayers = [
  "runtime_core",
  "runtime_adapter",
  "preview_and_comparison",
  "rollout_and_pilot",
  "save_assign_dry_run",
  "api_internal_routes",
  "web_ui_gates",
  "evidence_governance",
  "source_governance",
  "ai_review_governance",
  "production_guardrails",
];

assert(CONSTRUCTOR_MATRIX_DEPENDENCY_MAP.length >= expectedLayers.length, "dependency map must contain every required layer");
assert(
  new Set(CONSTRUCTOR_MATRIX_DEPENDENCY_MAP_IDS).size === CONSTRUCTOR_MATRIX_DEPENDENCY_MAP_IDS.length,
  "dependency map ids must be unique",
);

for (const layer of expectedLayers) {
  assert(
    CONSTRUCTOR_MATRIX_DEPENDENCY_MAP.some((item) => item.layer === layer),
    `dependency map must include layer ${layer}`,
  );
}

const knownDependencyIds = new Set(CONSTRUCTOR_MATRIX_DEPENDENCY_MAP_IDS);
for (const entry of CONSTRUCTOR_MATRIX_DEPENDENCY_MAP) {
  assert(entry.id, "dependency entry must include id");
  assert(entry.sourceFiles.length > 0, `${entry.id} must reference source files`);
  assert(entry.allowedConsumers.length > 0, `${entry.id} must list allowed consumers`);
  assert(entry.forbiddenConsumers.length > 0, `${entry.id} must list forbidden consumers`);
  assert(entry.guardrailNotes.length > 0, `${entry.id} must list guardrail notes`);

  for (const path of entry.sourceFiles) {
    assert(existsSync(new URL(`../${path}`, import.meta.url)), `${entry.id} references missing file ${path}`);
  }

  for (const dependencyId of entry.dependsOn) {
    assert(knownDependencyIds.has(dependencyId), `${entry.id} depends on unknown dependency ${dependencyId}`);
  }
}

const summary = buildConstructorMatrixDependencyMapSummary();
assert(summary.dependencyCount === CONSTRUCTOR_MATRIX_DEPENDENCY_MAP.length, "dependency summary count mismatch");
assert(summary.byLayer.runtime_core >= 1, "dependency summary must count runtime core");
assert(summary.metadataOnlyEntryCount >= 3, "dependency summary must count metadata-only governance entries");

const runtimeFiles = [
  "packages/shared/src/constructor-matrix.ts",
  "packages/shared/src/constructor-matrix-skeleton.ts",
  "packages/shared/src/constructor-matrix-plan-builder.ts",
  "packages/shared/src/constructor-matrix-preview.ts",
  "packages/shared/src/constructor-matrix-rollout.ts",
  "packages/shared/src/constructor-matrix-pilot-readiness.ts",
  "packages/shared/src/constructor-matrix-save-dry-run.ts",
  "packages/shared/src/constructor-core.ts",
];
const adapterFile = "packages/shared/src/constructor-matrix-adapter.ts";
const governanceModuleNames = [
  "constructor-matrix-review-package",
  "constructor-matrix-review-decision-ledger",
  "constructor-matrix-source-expansion-backlog",
  "constructor-matrix-source-candidates",
  "constructor-matrix-source-lookup-intake",
  "constructor-matrix-desk-source-review",
  "constructor-matrix-evidence-claim-candidates",
  "constructor-matrix-evidence-claim-candidate-review-export",
  "constructor-matrix-review-intake-export",
  "constructor-matrix-ai-review-policy",
  "constructor-matrix-ai-source-review",
  "constructor-matrix-ai-evidence-claims",
  "constructor-matrix-ai-safety-classification",
  "constructor-matrix-dependency-map",
];

for (const path of runtimeFiles) {
  const source = await readProjectFile(path);
  for (const moduleName of governanceModuleNames) {
    assert(!source.includes(moduleName), `${path} must not import governance module ${moduleName}`);
  }
  assert(
    !source.includes("constructor-matrix-runtime-eligibility"),
    `${path} must not import runtime eligibility directly`,
  );
}

const adapterSource = await readProjectFile(adapterFile);
assert(
  adapterSource.includes("constructor-matrix-runtime-eligibility"),
  "adapter must remain the only runtime eligibility metadata bridge",
);
for (const moduleName of governanceModuleNames) {
  assert(!adapterSource.includes(moduleName), `${adapterFile} must not import governance module ${moduleName}`);
}

const appCodeFiles = [
  ...(await collectFiles("apps/api")),
  ...(await collectFiles("apps/web")),
  ...(await collectFiles("apps/mobile")),
];
for (const path of appCodeFiles) {
  const source = await readProjectFile(path);
  for (const token of [
    "CONSTRUCTOR_MATRIX_DEPENDENCY_MAP",
    "CONSTRUCTOR_MATRIX_AI_REVIEW_POLICY",
    "CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS",
    "CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS",
    "CONSTRUCTOR_MATRIX_AI_SAFETY_CLASSIFICATIONS",
    "CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY",
  ]) {
    assert(!source.includes(token), `${path} must not consume governance/runtime eligibility registry ${token}`);
  }
}

const planningRoutesSource = await readProjectFile("apps/api/src/api/planning/planning.routes.ts");
const productionDraftRoute = extractRouteBlock(planningRoutesSource, "/api/v1/plans/constructor/draft");
assert(
  productionDraftRoute.includes("buildPerformConstructorDraft(body)"),
  "production constructor draft route must remain legacy-backed",
);
assert(
  !productionDraftRoute.includes("buildMatrixDrivenConstructorDraft") &&
    !productionDraftRoute.includes("decideMatrixConstructorRollout") &&
    !productionDraftRoute.includes("matrix_primary_pilot"),
  "production constructor draft route must not be Matrix-backed",
);

for (const route of [
  "/api/v1/plans/constructor/internal/matrix-preview",
  "/api/v1/plans/constructor/internal/matrix-rollout-decision",
  "/api/v1/plans/constructor/internal/matrix-primary-pilot-draft",
  "/api/v1/plans/constructor/internal/matrix-primary-pilot-save-dry-run",
]) {
  const routeBlock = extractRouteBlock(planningRoutesSource, route);
  assert(
    routeBlock.includes('user.role !== "coach" && user.role !== "admin"'),
    `${route} must remain coach/admin gated`,
  );
  assert(routeBlock.includes("assertAthleteAccess"), `${route} must assert athlete access`);
  assert(
    routeBlock.includes("no DB writes") || route.includes("save-dry-run"),
    `${route} must remain documented as no-write/internal`,
  );
}

const defaultFlags = withFeatureFlagEnv(
  { internal: undefined, limited: undefined, saveAssign: undefined },
  () => getConstructorMatrixUiFlags(),
);
const limitedOnlyFlags = withFeatureFlagEnv(
  { internal: undefined, limited: "true", saveAssign: undefined },
  () => getConstructorMatrixUiFlags(),
);
const saveAssignWithoutLimitedFlags = withFeatureFlagEnv(
  { internal: "true", limited: undefined, saveAssign: "true" },
  () => getConstructorMatrixUiFlags(),
);
assert(defaultFlags.internalMatrixConstructorUi === false, "internal Matrix UI flag must default off");
assert(defaultFlags.matrixConstructorLimitedPrimaryPilot === false, "limited Matrix pilot flag must default off");
assert(defaultFlags.matrixConstructorSaveAssignPilot === false, "Matrix save/assign flag must default off");
assert(
  limitedOnlyFlags.matrixConstructorLimitedPrimaryPilot === false,
  "limited Matrix pilot flag must require internal UI flag",
);
assert(
  saveAssignWithoutLimitedFlags.matrixConstructorSaveAssignPilot === false,
  "Matrix save/assign pilot flag must require limited pilot flag",
);

const saveAllowed = {
  legacy: isConstructorDraftSaveAllowed("legacy"),
  matrix_internal: isConstructorDraftSaveAllowed("matrix_internal"),
  matrix_primary_pilot: isConstructorDraftSaveAllowed("matrix_primary_pilot"),
};
assert(saveAllowed.legacy, "legacy constructor save must remain allowed");
assert(!saveAllowed.matrix_internal, "matrix_internal save must remain disabled");
assert(!saveAllowed.matrix_primary_pilot, "matrix_primary_pilot save must remain disabled by default");

const aiRuntime = buildMatrixDrivenAiRuntimeMetadata();
assert(aiRuntime.metadataOnly === true, "AI runtime metadata must remain metadata-only");
assert(aiRuntime.runtimeHardGatesEnabled === false, "runtime hard gates must remain disabled");
assert(aiRuntime.highRiskAutomationEnabled === false, "high-risk automation must remain disabled");
assert(aiRuntime.numericThresholdRuntimeGatesEnabled === false, "numeric threshold runtime gates must remain disabled");
assert(aiRuntime.medicalDecisionAutomationEnabled === false, "medical decision automation must remain disabled");
assert(aiRuntime.humanReviewed === false, "AI runtime metadata must not imply human review");

for (const item of CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY) {
  assertNoFakeHumanReviewRecord(item, `runtime eligibility ${item.id}`);
  assert(
    item.forbiddenRuntimeUses.includes("numeric_threshold"),
    `${item.id} must forbid numeric threshold runtime use`,
  );
  assert(
    item.forbiddenRuntimeUses.includes("Matrix_default_promotion"),
    `${item.id} must forbid Matrix default promotion`,
  );
}

for (const claim of CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS) {
  assertNoFakeHumanReviewRecord(claim, `AI evidence claim ${claim.id}`);
  assert(
    !/\bmedical approved\b|\bcoach approved\b|\bhuman approved\b|\bapproved_for_runtime\b|\bapproved for runtime\b/i.test(
      JSON.stringify(claim),
    ),
    `${claim.id} must not contain fake approval wording`,
  );
}

function runtimeEntriesForRiskArea(area) {
  return CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY.filter((item) =>
    item.riskAreas.includes(area),
  );
}

const highRiskExpectations = [
  ["weight_cut", "blocked_high_risk"],
  ["hydration", "blocked_high_risk"],
  ["female_context", "blocked_high_risk"],
  ["RED-S", "blocked_high_risk"],
  ["pain", "blocked_high_risk"],
  ["injury", "blocked_high_risk"],
  ["youth_context", "blocked_high_risk"],
  ["bfr_kaatsu", "blocked_high_risk"],
];

for (const [area, expectedStatus] of highRiskExpectations) {
  const entries = runtimeEntriesForRiskArea(area);
  assert(entries.length > 0, `Expected runtime eligibility coverage for ${area}`);

  for (const entry of entries) {
    assert(entry.status === expectedStatus, `${entry.id} must keep ${area} as ${expectedStatus}`);
    assert(entry.allowedRuntimeUse === "none", `${entry.id} must not allow runtime use for ${area}`);
    assert(
      entry.forbiddenRuntimeUses.includes("medical_decision") ||
        entry.forbiddenRuntimeUses.includes("automatic_BFR_KAATSU"),
      `${entry.id} must explicitly forbid medical/BFR automation for ${area}`,
    );
  }
}

const dataQualityExpectations = ["wearable_data", "sleep", "rhr", "hrv", "readiness"];
for (const area of dataQualityExpectations) {
  const entries = runtimeEntriesForRiskArea(area);
  assert(entries.length > 0, `Expected runtime eligibility coverage for data-quality area ${area}`);
  assert(
    entries.every((entry) => entry.allowedRuntimeUse === "soft_warning" || entry.allowedRuntimeUse === "none"),
    `Data-quality area ${area} must stay soft-warning-only or blocked`,
  );
}

const pilotCases = [
  {
    id: "far_development_week_d90",
    expectedSource: "matrix_primary_pilot",
    expectedDryRun: "passed",
  },
  {
    id: "main_start_d28_special_pre_competition",
    expectedSource: "matrix_primary_pilot",
    expectedDryRun: "passed",
  },
  {
    id: "main_start_d21_controlled_volume",
    expectedSource: "matrix_primary_pilot",
    expectedDryRun: "passed",
  },
  {
    id: "main_start_d10_taper",
    expectedSource: "matrix_primary_pilot",
    expectedDryRun: "passed",
  },
  {
    id: "main_start_d4_start_window",
    expectedSource: "matrix_primary_pilot",
    expectedDryRun: "passed",
  },
  {
    id: "main_start_d3_final_activation",
    expectedSource: "legacy_fallback",
    expectedDryRun: "blocked",
  },
  {
    id: "travel_day",
    expectedSource: "legacy_fallback",
    expectedDryRun: "blocked",
  },
  {
    id: "weigh_in_day",
    expectedSource: "legacy_fallback",
    expectedDryRun: "blocked",
  },
  {
    id: "competition_day",
    expectedSource: "legacy_fallback",
    expectedDryRun: "blocked",
  },
];

const pilotResults = pilotCases.map((testCase) => {
  const result = serverResponseForFixture(testCase.id);

  assert(result.source === testCase.expectedSource, `${testCase.id}: expected ${testCase.expectedSource}, got ${result.source}`);
  assert(
    result.dryRun.status === testCase.expectedDryRun,
    `${testCase.id}: expected dry-run ${testCase.expectedDryRun}, got ${result.dryRun.status}`,
  );

  if (testCase.expectedSource === "matrix_primary_pilot") {
    assert(result.gate.allowed, `${testCase.id}: controlled pilot gate must allow safe scenario`);
    assert(result.activeDraft.generatedFrom === "matrix", `${testCase.id}: active draft must be Matrix`);
  } else {
    assert(!result.gate.allowed, `${testCase.id}: controlled pilot gate must block fallback scenario`);
    assert(result.activeDraft.generatedFrom !== "matrix", `${testCase.id}: active draft must be legacy fallback`);
  }

  return {
    id: testCase.id,
    source: result.source,
    dryRun: result.dryRun.status,
    rollout: result.rolloutDecision.mode,
    readiness: result.pilotReadiness.status,
    gateAllowed: result.gate.allowed,
    draftGeneratedFrom: result.activeDraft.generatedFrom,
    draftError: result.draftError,
  };
});

const docsToCheck = [
  "docs/matrix-controlled-pilot-acceptance-matrix.md",
  "docs/perform-constructor-core-stack.md",
  "docs/constructor-phase-matrix-transition-plan.md",
  "docs/constructor-matrix-production-rollout.md",
];
for (const path of docsToCheck) {
  const source = await readProjectFile(path);
  assert(source.includes("Matrix Constructor Dependency Map"), `${path} must mention Matrix Constructor Dependency Map`);
  assert(
    source.includes("Controlled Pilot Hardening Audit"),
    `${path} must mention Controlled Pilot Hardening Audit`,
  );
  assert(!/\bhumanReviewed\s*[:=]\s*true\b/i.test(source), `${path} must not claim humanReviewed=true`);
  assert(!/\bmedical approved\b|\bcoach approved\b|\bapproved_for_runtime\b/i.test(source), `${path} must not contain fake approval wording`);
}

const packageJson = await readProjectFile("package.json");
assert(
  packageJson.includes("check:constructor-matrix-dependency-map"),
  "package.json must expose check:constructor-matrix-dependency-map",
);

const runtimeEligibilitySummary = buildConstructorMatrixRuntimeEligibilitySummary();

console.log(JSON.stringify({
  ok: true,
  dependencyMap: {
    dependencyCount: summary.dependencyCount,
    byLayer: summary.byLayer,
    byRuntimeBehaviorImpact: summary.byRuntimeBehaviorImpact,
  },
  aiRuntime: {
    metadataOnly: aiRuntime.metadataOnly,
    runtimeHardGatesEnabled: aiRuntime.runtimeHardGatesEnabled,
    highRiskAutomationEnabled: aiRuntime.highRiskAutomationEnabled,
    numericThresholdRuntimeGatesEnabled: aiRuntime.numericThresholdRuntimeGatesEnabled,
    medicalDecisionAutomationEnabled: aiRuntime.medicalDecisionAutomationEnabled,
    humanReviewed: aiRuntime.humanReviewed,
  },
  runtimeEligibility: {
    count: runtimeEligibilitySummary.runtimeEligibilityCount,
    byStatus: runtimeEligibilitySummary.byStatus,
    byAllowedRuntimeUse: runtimeEligibilitySummary.byAllowedRuntimeUse,
  },
  featureFlags: defaultFlags,
  saveAllowed,
  pilotResults,
}, null, 2));
