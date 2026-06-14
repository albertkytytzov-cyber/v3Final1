import { readFile } from "node:fs/promises";

import { buildMatrixDrivenAiRuntimeMetadata } from "@training-platform/shared";

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

const docPath = "docs/matrix-ai-reviewed-production-deployment-gate.md";
const doc = await readProjectFile(docPath);
const normalizedDoc = doc.replace(/\s+/g, " ");

for (const token of [
  "Stage: Production Deployment Gate",
  "Deployment mode: feature-flagged controlled pilot only",
  "Matrix is not production default",
  "High-risk medical decisions remain non-automated",
  "Feature flags must be off by default",
  "Rollback is feature-flag first",
  "Monitoring checklist",
  "Known limitations",
  "No DB schema migration is required",
  "npm run check",
  "npm run build",
  "git diff --check",
]) {
  assert(normalizedDoc.includes(token), `${docPath} must mention: ${token}`);
}

for (const forbidden of [
  /\bMatrix is production default\b/i,
  /\bproduction default:\s*allowed\b/i,
  /\bhumanReviewed\s*[:=]\s*true\b/i,
  /\breviewedBy\b/i,
  /\breviewedAt\b/i,
  /\bmedical approved\b/i,
  /\bcoach approved\b/i,
  /\bapproved_for_runtime\b/i,
]) {
  assert(!forbidden.test(doc), `${docPath} contains forbidden deployment text: ${forbidden}`);
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

assert(defaultFlags.internalMatrixConstructorUi === false, "internal Matrix UI must default off");
assert(defaultFlags.matrixConstructorLimitedPrimaryPilot === false, "limited pilot must default off");
assert(defaultFlags.matrixConstructorSaveAssignPilot === false, "save/assign pilot must default off");
assert(
  limitedOnlyFlags.matrixConstructorLimitedPrimaryPilot === false,
  "limited pilot must require internal Matrix UI flag",
);
assert(
  saveAssignWithoutLimitedFlags.matrixConstructorSaveAssignPilot === false,
  "save/assign pilot must require limited pilot flag",
);

const saveAllowed = {
  legacy: isConstructorDraftSaveAllowed("legacy"),
  matrix_internal: isConstructorDraftSaveAllowed("matrix_internal"),
  matrix_primary_pilot: isConstructorDraftSaveAllowed("matrix_primary_pilot"),
};
assert(saveAllowed.legacy, "legacy constructor draft must remain save-capable");
assert(!saveAllowed.matrix_internal, "matrix_internal must remain read-only");
assert(!saveAllowed.matrix_primary_pilot, "matrix_primary_pilot must remain read-only by default");

const aiRuntime = buildMatrixDrivenAiRuntimeMetadata();
assert(aiRuntime.metadataOnly === true, "AI runtime metadata must remain metadata-only");
assert(aiRuntime.runtimeHardGatesEnabled === false, "runtime hard gates must remain disabled");
assert(aiRuntime.highRiskAutomationEnabled === false, "high-risk automation must remain disabled");
assert(
  aiRuntime.numericThresholdRuntimeGatesEnabled === false,
  "numeric threshold runtime gates must remain disabled",
);
assert(
  aiRuntime.medicalDecisionAutomationEnabled === false,
  "medical decision automation must remain disabled",
);
assert(aiRuntime.humanReviewed === false, "AI runtime metadata must not imply human review");
assert(aiRuntime.blockedHighRiskEligibilityIds.length > 0, "high-risk blocked metadata must exist");

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

console.log(JSON.stringify({
  ok: true,
  deploymentMode: "feature-flagged controlled pilot only",
  defaultFlags,
  saveAllowed,
  productionDraftRouteLegacy: true,
  aiRuntime: {
    metadataOnly: aiRuntime.metadataOnly,
    runtimeHardGatesEnabled: aiRuntime.runtimeHardGatesEnabled,
    highRiskAutomationEnabled: aiRuntime.highRiskAutomationEnabled,
    numericThresholdRuntimeGatesEnabled: aiRuntime.numericThresholdRuntimeGatesEnabled,
    medicalDecisionAutomationEnabled: aiRuntime.medicalDecisionAutomationEnabled,
    humanReviewed: aiRuntime.humanReviewed,
    blockedHighRiskEligibilityCount: aiRuntime.blockedHighRiskEligibilityIds.length,
  },
}, null, 2));
