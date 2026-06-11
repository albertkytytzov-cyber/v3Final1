import {
  buildConstructorTemplatePayload,
  buildConstructorMatrixPreviewResponse,
  buildMatrixDrivenConstructorDraft,
  buildMatrixConstructorDraftIfAllowed,
  buildMatrixPrimaryPilotSaveDryRun,
  buildPerformConstructorDraft,
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
const assignmentDateModule = await import("../apps/web/app/lib/constructor-assignment-date.ts");
const { getConstructorDraftAssignmentStartDate } =
  assignmentDateModule.default ?? assignmentDateModule;
const featureFlagsModule = await import("../apps/web/app/lib/feature-flags.ts");
const { getConstructorMatrixUiFlags } = featureFlagsModule.default ?? featureFlagsModule;
const planningSchemasModule = await import("../apps/api/src/api/planning/planning.schemas.ts");
const { parseAssignedPlanBody, parseAutoAssignMicrocycleBody, parsePlanTemplateBody } =
  planningSchemasModule.default ?? planningSchemasModule;

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
  const buildDraftBlock = extractFunctionBlock(pageClientSource, "handleBuildConstructorDraft");
  const saveConstructorTemplateBlock = extractFunctionBlock(
    pageClientSource,
    "handleSaveConstructorTemplate",
  );
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
    buildDraftBlock.includes("ENABLE_MATRIX_CONSTRUCTOR_SAVE_ASSIGN_PILOT") &&
      buildDraftBlock.includes("requestMatrixPrimaryPilotDraft") &&
      buildDraftBlock.includes('pilotDraft.source === "matrix_primary_pilot"') &&
      buildDraftBlock.includes('pilotDraft.source === "legacy_fallback"'),
    "Main build action must use the server-authoritative matrix pilot draft path before legacy fallback",
  );
  assert(
    saveConstructorTemplateBlock.includes("activeConstructorDraftSaveAllowed") &&
      saveConstructorTemplateBlock.includes("activeConstructorTemplatePayload") &&
      saveConstructorTemplateBlock.includes('setTemplatePlanningTab("assign")') &&
      saveConstructorTemplateBlock.includes("templateId: template.id") &&
      saveConstructorTemplateBlock.includes("setAssignedPlanForm"),
    "Saving an allowed constructor draft must open the template assignment flow with the saved template selected",
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
    "/api/v1/plans/constructor/internal/matrix-primary-pilot-draft",
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

async function checkTrainerFacingMatrixCopy() {
  const trainerFacingFiles = [
    "apps/web/app/components/constructor/MatrixConstructorPreviewPanel.tsx",
    "apps/web/app/components/constructor/MatrixPreviewWorkspace.tsx",
    "apps/web/app/components/constructor/MatrixRolloutDecisionCard.tsx",
    "apps/web/app/components/constructor/MatrixPilotReadinessCard.tsx",
    "apps/web/app/components/constructor/MatrixPrimaryPilotSaveDryRunCard.tsx",
    "apps/web/app/lib/constructor-matrix-review-export.ts",
  ];
  const combined = (
    await Promise.all(trainerFacingFiles.map((path) => readProjectFile(path)))
  ).join("\n");
  const pageClientSource = await readProjectFile("apps/web/app/page-client.tsx");
  const forbiddenPhrases = [
    "Current vs new constructor",
    "Internal Matrix Constructor Review",
    "Matrix vs Legacy",
    "Legacy:",
    'contextLabel="workspace"',
    "internal panel",
    "QA",
    "production чернова",
    "close-start ",
  ];

  for (const phrase of forbiddenPhrases) {
    assert(
      !combined.includes(phrase),
      `Trainer-facing matrix UI must not expose old/internal phrase: ${phrase}`,
    );
  }

  assert(
    combined.includes("Диагностика новой логики планирования"),
    "Trainer-facing matrix panel must explain that matrix is a diagnostics block",
  );
  assert(
    combined.includes("Проверить новую логику планирования"),
    "Trainer-facing matrix panel must use a clear Russian check action",
  );
  assert(
    pageClientSource.includes("3. Рабочий черновик: новый конструктор") &&
      pageClientSource.includes("3. Рабочий черновик: текущий конструктор") &&
      pageClientSource.includes("Активен текущий конструктор") &&
      pageClientSource.includes("Проверка новой логики"),
    "Main draft panel must clearly identify the active constructor source for trainers",
  );
  assert(
    combined.includes("проверка нового плана"),
    "Matrix workspace export context must be localized for trainers",
  );
  assert(
    combined.includes("constructorMatrixSeverityLabel") &&
      combined.includes("constructorMatrixBlockerMessage"),
    "Matrix UI must translate technical severity/blocker values before rendering",
  );
  assert(
    combined.includes("constructorMatrixTrainerText(language, decision.explanation.headline)") &&
      combined.includes("constructorMatrixTrainerText(language, reason)") &&
      combined.includes("constructorMatrixTrainerText(language, decision.explanation.nextStep)"),
    "Matrix rollout decision copy must pass through trainer-facing text normalization",
  );

  return {
    oldInternalTermsHidden: true,
    russianPlanningLabelPresent: true,
    blockerMessagesTranslated: true,
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

function pilotDraftResponseForFixture(id) {
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
  let draftResult = null;
  let matrixDraftError = "";

  try {
    draftResult = buildMatrixConstructorDraftIfAllowed(fixture.input, {
      ...rolloutOptions,
      fallbackToLegacy: true,
      allowedModes: ["matrix_allowed_for_primary"],
    });
  } catch (error) {
    matrixDraftError = error instanceof Error ? error.message : String(error);
  }

  const matrixDraftAllowed =
    primaryPilotEligible && draftResult?.source === "matrix" && Boolean(draftResult.draft);
  const candidateSource = matrixDraftAllowed ? "matrix_primary_pilot" : "legacy_fallback";
  const candidateDraft =
    candidateSource === "matrix_primary_pilot" && draftResult?.draft
      ? draftResult.draft
      : buildPerformConstructorDraft(fixture.input);
  const candidateReason =
    candidateSource === "matrix_primary_pilot"
      ? "Matrix draft was allowed by the controlled pilot gate and passed server save dry-run checks."
      : matrixDraftError || draftResult?.reason || `${rolloutDecision.mode}/${pilotReadiness.status}`;
  const templateName = `PERFORM Constructor Candidate • ${fixture.input.competition.name}`;
  const candidateDryRun = buildMatrixPrimaryPilotSaveDryRun({
    activeDraftSource: candidateSource === "matrix_primary_pilot" ? "matrix_primary_pilot" : "legacy",
    draft: candidateSource === "matrix_primary_pilot" ? candidateDraft : null,
    primaryPilotEligible: candidateSource === "matrix_primary_pilot",
    eligibilityReason: candidateSource === "matrix_primary_pilot" ? null : candidateReason,
    eligibilityEvidence: [
      `scenario=${rolloutDecision.scenario}`,
      `rolloutMode=${rolloutDecision.mode}`,
      `matrixPrimaryAllowed=${rolloutDecision.matrixPrimaryAllowed}`,
      `readiness=${pilotReadiness.status}`,
      `rolloutBlockers=${rolloutDecision.blockers.length}`,
      `readinessBlockers=${pilotReadiness.blockers.length}`,
      ...(matrixDraftError ? [`matrixDraftError=${matrixDraftError}`] : []),
    ],
    templateName,
  });
  const source =
    candidateSource === "matrix_primary_pilot" && candidateDryRun.status === "passed"
      ? "matrix_primary_pilot"
      : "legacy_fallback";
  const draft =
    source === "matrix_primary_pilot" ? candidateDraft : buildPerformConstructorDraft(fixture.input);
  const reason =
    source === "matrix_primary_pilot"
      ? candidateReason
      : candidateSource === "matrix_primary_pilot"
        ? `Matrix draft did not pass server save dry-run: ${candidateDryRun.status}`
        : candidateReason;
  const dryRun =
    source === "matrix_primary_pilot"
      ? candidateDryRun
      : buildMatrixPrimaryPilotSaveDryRun({
          activeDraftSource: "legacy",
          draft: null,
          primaryPilotEligible: false,
          eligibilityReason: reason,
          eligibilityEvidence: [
            `scenario=${rolloutDecision.scenario}`,
            `rolloutMode=${rolloutDecision.mode}`,
            `matrixPrimaryAllowed=${rolloutDecision.matrixPrimaryAllowed}`,
            `readiness=${pilotReadiness.status}`,
            `rolloutBlockers=${rolloutDecision.blockers.length}`,
            `readinessBlockers=${pilotReadiness.blockers.length}`,
            ...(matrixDraftError ? [`matrixDraftError=${matrixDraftError}`] : []),
          ],
          templateName,
        });
  const serverSaveDryRun = {
    generatedFrom: "matrix_primary_pilot_server_save_dry_run",
    generatedAt: new Date("2026-06-10T12:00:00.000Z").toISOString(),
    dryRun,
    rolloutDecision,
    pilotReadiness,
    notes: ["constructor matrix pilot draft regression check"],
  };

  return {
    generatedFrom: "matrix_primary_pilot_server_draft",
    generatedAt: new Date("2026-06-10T12:00:00.000Z").toISOString(),
    source,
    reason,
    draft,
    templatePayload: buildConstructorTemplatePayload(draft, templateName),
    preview,
    rolloutDecision,
    pilotReadiness,
    serverSaveDryRun,
    notes: ["constructor matrix pilot draft regression check"],
  };
}

function assertNoTrainerFacingMatrixLeaks(testId, draft) {
  const trainerFacingDraft = {
    understood: draft.understood,
    focusPlan: draft.focusPlan,
    missingData: draft.missingData,
    riskFlags: draft.riskFlags,
    selectedCards: draft.selectedCards,
    plan: draft.plan,
    explanation: draft.explanation,
  };
  const serializedTrainerFields = JSON.stringify(trainerFacingDraft);
  const forbiddenTrainerPhrases = [
    "Matrix-driven draft",
    "Matrix path",
    "legacy-content:",
    "legacy-source:",
    "risk checks:",
    "[matrix:",
    "matrix allowed candidates",
    "metadata/content hint",
    "compatibility/content metadata",
    "load=",
    "mat=",
    "recovery=",
    "нагрузка medium",
    "нагрузка very_low",
    "ковёр medium",
    "ковёр low",
    "восстановление mandatory",
    "восстановление primary",
    "recovery/mobility",
    "competition_model/",
    "pre_competition/",
    "taper/",
  ];

  for (const phrase of forbiddenTrainerPhrases) {
    assert(
      !serializedTrainerFields.includes(phrase),
      `${testId}: trainer-facing matrix draft must not expose technical phrase: ${phrase}`,
    );
  }
}

function buildFullTemplateAssignmentItems(templatePayload, templateId) {
  return (templatePayload.days ?? []).map((day, dayIndex) => ({
    templateId,
    templateDayIndex: dayIndex,
    dayOffset: dayIndex,
    dayLabel: day.label || `Day ${dayIndex + 1}`,
    microcycleType:
      day.notes ||
      templatePayload.templateGoal ||
      templatePayload.microcycleType ||
      templatePayload.name,
  }));
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

const pilotDraftResults = cases.map((testCase) => {
  const fixture = fixtureById(testCase.id);
  const response = pilotDraftResponseForFixture(testCase.id);
  const expectedSource = testCase.allowed ? "matrix_primary_pilot" : "legacy_fallback";
  const parsedTemplatePayload = parsePlanTemplateBody(response.templatePayload);
  const templateDays = response.templatePayload.days ?? [];
  const templateSessions = templateDays.flatMap((day) => day.sessions);
  const templateBlocks = templateSessions.flatMap((session) => session.blocks);
  const parsedTemplateDays = parsedTemplatePayload.days ?? [];
  const parsedTemplateSessions = parsedTemplateDays.flatMap((day) => day.sessions);
  const parsedTemplateBlocks = parsedTemplateSessions.flatMap((session) => session.blocks);
  const fullAssignmentItems = buildFullTemplateAssignmentItems(
    response.templatePayload,
    `template-${testCase.id}`,
  );
  const assignmentStartDate = getConstructorDraftAssignmentStartDate(
    response.draft,
    fixture.input.competition.startDate,
    "2026-06-08",
  );
  const assignmentPayload = parseAssignedPlanBody({
    athleteId: fixture.input.athlete.athleteId,
    templateId: `template-${testCase.id}`,
    startDate: assignmentStartDate,
    dayLabel: "День 1",
    notes: `Назначено из шаблона конструктора: ${response.templatePayload.name}`,
    plannedPhase: fixture.input.context.currentPhase,
  });
  const autoAssignPayload = parseAutoAssignMicrocycleBody({
    athleteId: fixture.input.athlete.athleteId,
    startDate: assignmentStartDate,
    daysCount: fullAssignmentItems.length,
    notes: `Назначено из плана ${response.templatePayload.name}`,
    plannedPhase: fixture.input.context.currentPhase,
    items: fullAssignmentItems,
  });
  const serializedPayload = JSON.stringify(response.templatePayload);
  const serverGate = canUseMatrixPrimaryPilotWithServerEvidence({
    serverResult: response.serverSaveDryRun,
    localRolloutDecision: response.rolloutDecision,
    localPilotReadiness: response.pilotReadiness,
  });

  assert(
    response.source === expectedSource,
    `${testCase.id}: expected pilot draft source=${expectedSource}, got ${response.source}`,
  );
  assert(
    templateDays.length > 0,
    `${testCase.id}: pilot draft response must include template days`,
  );
  assert(
    templateSessions.length > 0,
    `${testCase.id}: pilot draft response must include template sessions`,
  );
  assert(
    templateBlocks.length > 0,
    `${testCase.id}: pilot draft response must include template blocks`,
  );
  assert(
    parsedTemplatePayload.name === response.templatePayload.name &&
      parsedTemplateDays.length === templateDays.length &&
      parsedTemplateSessions.length === templateSessions.length &&
      parsedTemplateBlocks.length === templateBlocks.length,
    `${testCase.id}: pilot draft template payload must survive API template schema parsing`,
  );
  assert(
    assignmentPayload.athleteId === fixture.input.athlete.athleteId &&
      assignmentPayload.templateId === `template-${testCase.id}` &&
      assignmentPayload.startDate === assignmentStartDate,
    `${testCase.id}: pilot draft assignment payload must start at constructor cycle start`,
  );
  assert(
    autoAssignPayload.athleteId === fixture.input.athlete.athleteId &&
      autoAssignPayload.startDate === assignmentStartDate &&
      autoAssignPayload.daysCount === templateDays.length &&
      autoAssignPayload.items.length === templateDays.length &&
      autoAssignPayload.items.every(
        (item, index) =>
          item.templateId === `template-${testCase.id}` &&
          item.templateDayIndex === index &&
          item.dayOffset === index,
      ),
    `${testCase.id}: pilot draft full-plan auto-assignment payload must cover every template day`,
  );
  if (response.draft.plan.cycleLengthDays > 1) {
    assert(
      assignmentStartDate < fixture.input.competition.startDate,
      `${testCase.id}: constructor assignment must open before the competition date`,
    );
  }
  assert(
    !serializedPayload.includes('"matrix"') &&
      !serializedPayload.includes('"rollout"') &&
      !serializedPayload.includes('"pilotReadiness"'),
    `${testCase.id}: template payload must not leak internal matrix fields`,
  );
  assertNoTrainerFacingMatrixLeaks(testCase.id, response.draft);

  if (testCase.allowed) {
    assert(
      response.draft.generatedFrom === "matrix",
      `${testCase.id}: allowed pilot draft must be generated from matrix`,
    );
    assert(
      response.serverSaveDryRun.dryRun.status === "passed",
      `${testCase.id}: allowed pilot draft must pass server save dry-run`,
    );
    assert(
      serverGate.allowed,
      `${testCase.id}: allowed pilot draft must pass server evidence gate`,
    );
  } else {
    assert(
      response.draft.generatedFrom !== "matrix",
      `${testCase.id}: fallback pilot draft must not expose a matrix draft as active`,
    );
    assert(
      response.serverSaveDryRun.dryRun.status !== "passed",
      `${testCase.id}: fallback pilot draft must not pass server save dry-run`,
    );
    assert(
      !serverGate.allowed,
      `${testCase.id}: fallback pilot draft must not pass server evidence gate`,
    );
  }

  return {
    id: testCase.id,
    source: response.source,
    dryRun: response.serverSaveDryRun.dryRun.status,
    serverGateAllowed: serverGate.allowed,
    templateDays: templateDays.length,
    templateSessions: templateSessions.length,
    templateBlocks: templateBlocks.length,
    assignmentStartDate,
    competitionStartDate: fixture.input.competition.startDate,
    apiTemplateSchema: "passed",
    apiAssignSchema: "passed",
    apiAutoAssignSchema: "passed",
    autoAssignItems: autoAssignPayload.items.length,
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
const trainerFacingCopy = await checkTrainerFacingMatrixCopy();

console.log(
  JSON.stringify(
    {
      status: "ok",
      cases: results,
      pilotDrafts: pilotDraftResults,
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
      trainerFacingCopy,
    },
    null,
    2,
  ),
);
