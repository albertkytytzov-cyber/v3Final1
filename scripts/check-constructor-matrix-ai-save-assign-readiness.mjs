import { readFile } from "node:fs/promises";

import {
  buildConstructorTemplatePayload,
  buildMatrixDrivenConstructorDraft,
  buildMatrixPrimaryPilotSaveDryRun,
} from "@training-platform/shared";
import { constructorPreviewFixtures } from "./fixtures/constructor/preview-regression-fixtures.mjs";

const matrixUiModule = await import("../apps/web/app/lib/constructor-matrix-ui.ts");
const { isConstructorDraftSaveAllowed } = matrixUiModule.default ?? matrixUiModule;

const featureFlagsModule = await import("../apps/web/app/lib/feature-flags.ts");
const { getConstructorMatrixUiFlags } = featureFlagsModule.default ?? featureFlagsModule;

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
    "limited Matrix pilot flag must default off",
  );
  assert(
    defaults.matrixConstructorSaveAssignPilot === false,
    "Matrix save/assign flag must default off",
  );
  assert(
    limitedOnly.matrixConstructorLimitedPrimaryPilot === false &&
      limitedOnly.matrixConstructorSaveAssignPilot === false,
    "limited pilot must require the internal Matrix UI flag",
  );
  assert(
    saveAssignWithoutLimited.matrixConstructorSaveAssignPilot === false,
    "save/assign pilot must require the limited Matrix pilot flag",
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
    "save/assign pilot must require all explicit feature flags",
  );

  return {
    defaultInternal: defaults.internalMatrixConstructorUi,
    defaultLimitedPilot: defaults.matrixConstructorLimitedPrimaryPilot,
    defaultSaveAssignPilot: defaults.matrixConstructorSaveAssignPilot,
    saveAssignRequiresAllFlags: true,
  };
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

const allowedPilotFixtureIds = [
  "far_development_week_d90",
  "main_start_d28_special_pre_competition",
  "main_start_d21_controlled_volume",
  "main_start_d10_taper",
  "main_start_d4_start_window",
];

const saveAllowed = {
  legacy: isConstructorDraftSaveAllowed("legacy"),
  matrix_internal: isConstructorDraftSaveAllowed("matrix_internal"),
  matrix_primary_pilot: isConstructorDraftSaveAllowed("matrix_primary_pilot"),
};

assert(saveAllowed.legacy, "legacy constructor draft must remain save-capable");
assert(!saveAllowed.matrix_internal, "matrix_internal must remain read-only");
assert(!saveAllowed.matrix_primary_pilot, "matrix_primary_pilot must remain read-only by default");

const fixtureResults = allowedPilotFixtureIds.map((fixtureId) => {
  const fixture = constructorPreviewFixtures.find((item) => item.id === fixtureId);
  assert(fixture, `Expected fixture ${fixtureId}`);

  const draft = buildMatrixDrivenConstructorDraft(fixture.input);
  const templatePayload = buildConstructorTemplatePayload(
    draft,
    `PERFORM Matrix Save Assign Audit ${fixtureId}`,
  );
  const dryRun = buildMatrixPrimaryPilotSaveDryRun({
    activeDraftSource: "matrix_primary_pilot",
    draft,
    primaryPilotEligible: true,
    templateName: `PERFORM Matrix Save Assign Audit ${fixtureId}`,
  });
  const parsedTemplatePayload = parsePlanTemplateBody(templatePayload);
  const assignmentItems = buildAssignmentItems(templatePayload, `template-${fixtureId}`);
  const assignmentPayload = parseAssignedPlanBody({
    athleteId: fixture.input.athlete.athleteId,
    templateId: `template-${fixtureId}`,
    startDate: fixture.input.context.currentDate,
    dayLabel: "Day 1",
    notes: `Dry-run assignment shape for ${templatePayload.name}`,
    plannedPhase: fixture.input.context.currentPhase,
  });
  const autoAssignPayload = parseAutoAssignMicrocycleBody({
    athleteId: fixture.input.athlete.athleteId,
    startDate: fixture.input.context.currentDate,
    daysCount: assignmentItems.length,
    notes: `Dry-run full-plan assignment shape for ${templatePayload.name}`,
    plannedPhase: fixture.input.context.currentPhase,
    items: assignmentItems,
  });
  const serializedPayload = JSON.stringify(templatePayload);
  const realSaveCheck = dryRun.checks.find((item) => item.id === "real_save_still_disabled");

  assert(dryRun.status === "passed", `${fixtureId}: save dry-run must pass`);
  assert(realSaveCheck?.passed === true, `${fixtureId}: real save must stay disabled`);
  assert(
    dryRun.notes.some((note) => /Dry-run only:.*write DB/i.test(note)),
    `${fixtureId}: dry-run notes must state no DB write`,
  );
  assert(
    parsedTemplatePayload.days?.length === templatePayload.days.length,
    `${fixtureId}: template payload must parse through API schema`,
  );
  assert(
    assignmentPayload.athleteId === fixture.input.athlete.athleteId &&
      assignmentPayload.templateId === `template-${fixtureId}`,
    `${fixtureId}: single assignment payload must parse through API schema`,
  );
  assert(
    autoAssignPayload.items.length === templatePayload.days.length &&
      autoAssignPayload.items.every((item, index) => item.templateDayIndex === index),
    `${fixtureId}: auto-assignment payload must cover every template day`,
  );
  assert(
    !serializedPayload.includes('"matrix"') &&
      !serializedPayload.includes('"aiRuntime"') &&
      !serializedPayload.includes('"rollout"') &&
      !serializedPayload.includes('"pilotReadiness"'),
    `${fixtureId}: template payload must not include internal Matrix metadata`,
  );

  return {
    fixtureId,
    dryRun: dryRun.status,
    templateDays: templatePayload.days.length,
    templateSessions: templatePayload.days.flatMap((day) => day.sessions).length,
    templateBlocks: templatePayload.days.flatMap((day) =>
      day.sessions.flatMap((session) => session.blocks),
    ).length,
    assignmentItems: assignmentItems.length,
    realSaveStillDisabled: realSaveCheck.passed,
  };
});

const featureFlags = checkFeatureFlagChain();
const planningRoutesSource = await readProjectFile("apps/api/src/api/planning/planning.routes.ts");
const productionDraftRoute = extractRouteBlock(planningRoutesSource, "/api/v1/plans/constructor/draft");

assert(
  productionDraftRoute.includes("buildPerformConstructorDraft(body)"),
  "production constructor draft route must remain legacy-backed",
);
assert(
  !productionDraftRoute.includes("buildMatrixDrivenConstructorDraft") &&
    !productionDraftRoute.includes("matrix_primary_pilot"),
  "production constructor draft route must not consume Matrix pilot logic",
);

for (const route of [
  "/api/v1/plans/constructor/internal/matrix-primary-pilot-draft",
  "/api/v1/plans/constructor/internal/matrix-primary-pilot-save-dry-run",
]) {
  const routeBlock = extractRouteBlock(planningRoutesSource, route);
  assert(routeBlock.includes("assertAthleteAccess"), `${route} must assert athlete access`);
  assert(
    routeBlock.includes('user.role !== "coach" && user.role !== "admin"'),
    `${route} must remain coach/admin guarded`,
  );
  assert(
    routeBlock.includes("no DB writes") || route.includes("save-dry-run"),
    `${route} must document or implement no-write behavior`,
  );
}

const pageClientSource = await readProjectFile("apps/web/app/page-client.tsx");
assert(
  pageClientSource.includes("constructorMatrixSaveAssignPilotAllowed") &&
    pageClientSource.includes("ENABLE_MATRIX_CONSTRUCTOR_SAVE_ASSIGN_PILOT") &&
    pageClientSource.includes("constructorMatrixServerSaveDryRun?.dryRun.status === \"passed\""),
  "page client must keep Matrix save/assign behind explicit save/assign flag and server dry-run",
);
assert(
  pageClientSource.includes("isConstructorDraftSaveAllowed(activeConstructorDraftSource)"),
  "page client must keep legacy save allowance centralized",
);

const doc = await readProjectFile("docs/matrix-ai-reviewed-save-assign-readiness.md");
const normalizedDoc = doc.replace(/\s+/g, " ");
for (const token of [
  "AI-reviewed Matrix Save/Assign Readiness",
  "does not enable real Matrix save",
  "All Matrix feature flags are off by default",
  "production route `/api/v1/plans/constructor/draft` remains backed by the legacy constructor path",
  "No DB schema migration is required",
  "High-risk areas remain blocked",
  "No numeric threshold values are approved",
  "No fake human approvals are added",
]) {
  assert(normalizedDoc.includes(token), `save/assign readiness doc must mention: ${token}`);
}

console.log(JSON.stringify({
  ok: true,
  saveAllowed,
  featureFlags,
  fixtureResults,
  productionDraftRouteLegacy: true,
  realDbWritesEnabled: false,
  matrixSaveAssignDefaultEnabled: false,
}, null, 2));
