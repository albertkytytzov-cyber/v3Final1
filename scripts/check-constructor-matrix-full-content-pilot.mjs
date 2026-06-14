import { readFile } from "node:fs/promises";

import {
  buildConstructorTemplatePayload,
  buildMatrixConstructorDraftIfAllowed,
  buildMatrixDrivenConstructorDraft,
  buildPerformConstructorDraft,
  decideMatrixConstructorRollout,
  evaluateMatrixPilotReadiness,
} from "@training-platform/shared";
import { constructorPreviewFixtures } from "./fixtures/constructor/preview-regression-fixtures.mjs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readProjectFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function fixtureById(id) {
  const fixture = constructorPreviewFixtures.find((item) => item.id === id);
  assert(fixture, `Expected fixture ${id}`);

  return fixture;
}

function draftStats(draft) {
  const days = draft.plan.weeks.flatMap((week) => week.days);
  const sessions = days.flatMap((day) => day.sessions ?? []);
  const blocks = sessions.flatMap((session) => session.blocks ?? []);
  const exercises = blocks.flatMap((block) => block.exercises ?? []);
  const strengthWeightCandidates = exercises.filter((exercise) => exercise.targetWeightKg !== null);

  return {
    weeks: draft.plan.weeks.length,
    days: days.length,
    sessions: sessions.length,
    blocks: blocks.length,
    exercises: exercises.length,
    bodyCompositionExerciseCount: exercises.filter((exercise) =>
      /body-composition/i.test(`${exercise.name} ${exercise.notes}`),
    ).length,
    strengthWeightCandidates: strengthWeightCandidates.length,
  };
}

function assertTemplatePayloadSafe(testId, payload) {
  const serialized = JSON.stringify(payload);
  const forbiddenMarkers = [
    '"matrix"',
    '"aiRuntime"',
    '"fullContent"',
    '"exerciseLibrary"',
    '"nutritionGuidance"',
    '"weightManagementGuidance"',
    '"pilotReadiness"',
    '"runtimeEligibility"',
  ];

  assert(payload.days?.length > 0, `${testId}: template payload must include days`);

  for (const marker of forbiddenMarkers) {
    assert(!serialized.includes(marker), `${testId}: template payload must not contain ${marker}`);
  }
}

function assertFullContentMetadata(testId, draft) {
  assert(draft.generatedFrom === "matrix", `${testId}: expected Matrix generated draft`);
  assert(draft.matrix?.fullContent?.metadataOnly === true, `${testId}: full content metadata must be metadata-only`);
  assert(draft.matrix.fullContent.humanReviewed === false, `${testId}: full content metadata must not imply human review`);
  assert(
    draft.matrix.fullContent.highRiskAutomationEnabled === false,
    `${testId}: full content metadata must keep high-risk automation disabled`,
  );
  assert(
    draft.matrix.fullContent.exerciseLibrary.exerciseCount >= 80,
    `${testId}: full content metadata must include exercise library count`,
  );
  assert(
    draft.matrix.fullContent.exerciseResolver.coveredBlockTypeCount >= 18,
    `${testId}: full content metadata must cover Matrix block types`,
  );
  assert(
    draft.matrix.fullContent.nutritionGuidance.notMedicalAdvice === true,
    `${testId}: nutrition guidance must be marked not medical advice`,
  );
  assert(
    draft.matrix.fullContent.nutritionGuidance.guidanceIds.length > 0,
    `${testId}: nutrition guidance ids must be present as metadata`,
  );
  assert(
    draft.matrix.fullContent.weightManagementGuidance.noUnsafeRapidWeightCutAutomation === true,
    `${testId}: weight guidance must block unsafe rapid weight-cut automation`,
  );
  assert(
    draft.matrix.fullContent.weightManagementGuidance.reviewRequiredIds.length > 0,
    `${testId}: weight-management review prompt ids must be present as metadata`,
  );
}

const allowedPilotFixtureIds = [
  "far_development_week_d90",
  "main_start_d28_special_pre_competition",
  "main_start_d21_controlled_volume",
  "main_start_d10_taper",
  "main_start_d4_start_window",
];
const fallbackFixtureIds = [
  "main_start_d3_final_activation",
  "travel_day",
  "weigh_in_day",
  "competition_day",
];

const allowedResults = allowedPilotFixtureIds.map((fixtureId) => {
  const fixture = fixtureById(fixtureId);
  const rollout = decideMatrixConstructorRollout(fixture.input);
  const readiness = evaluateMatrixPilotReadiness(fixture.input);
  const result = buildMatrixConstructorDraftIfAllowed(fixture.input, {
    fallbackToLegacy: true,
    allowedModes: ["matrix_allowed_for_primary"],
  });

  assert(result.source === "matrix", `${fixtureId}: expected Matrix controlled pilot source`);
  assert(rollout.mode === "matrix_allowed_for_primary", `${fixtureId}: rollout must allow primary Matrix pilot`);
  assert(readiness.status === "ready_for_limited_primary_pilot", `${fixtureId}: pilot readiness must pass`);
  assertFullContentMetadata(fixtureId, result.draft);

  const stats = draftStats(result.draft);
  assert(stats.exercises >= stats.blocks, `${fixtureId}: each Matrix pilot plan should have concrete exercise density`);
  assert(stats.strengthWeightCandidates === 0, `${fixtureId}: fixtures without max/e1RM must not invent strength weights`);
  if (fixtureId !== "far_development_week_d90") {
    assert(
      stats.bodyCompositionExerciseCount === 0,
      `${fixtureId}: close-start full-content pilot should suppress body-composition exercise candidates`,
    );
  }

  const templatePayload = buildConstructorTemplatePayload(result.draft, `PERFORM Matrix Full Content ${fixtureId}`);
  assertTemplatePayloadSafe(fixtureId, templatePayload);

  return {
    fixtureId,
    source: result.source,
    rollout: rollout.mode,
    readiness: readiness.status,
    ...stats,
  };
});

const fallbackResults = fallbackFixtureIds.map((fixtureId) => {
  const fixture = fixtureById(fixtureId);
  const result = buildMatrixConstructorDraftIfAllowed(fixture.input, {
    fallbackToLegacy: true,
    allowedModes: ["matrix_allowed_for_primary"],
  });
  const activeDraft = result.source === "matrix" ? result.draft : buildPerformConstructorDraft(fixture.input);

  assert(result.source === "legacy_fallback", `${fixtureId}: high-risk/final-window scenario must fallback to legacy`);
  assert(activeDraft.generatedFrom !== "matrix", `${fixtureId}: active fallback draft must not be Matrix`);

  return {
    fixtureId,
    source: result.source,
    activeGeneratedFrom: activeDraft.generatedFrom,
  };
});

const matrixDraft = buildMatrixDrivenConstructorDraft(fixtureById("far_development_week_d90").input);
assertFullContentMetadata("direct_matrix_draft", matrixDraft);

const planningRoutesSource = await readProjectFile("apps/api/src/api/planning/planning.routes.ts");
const productionDraftMarker = 'app.post("/api/v1/plans/constructor/draft"';
const productionDraftStart = planningRoutesSource.indexOf(productionDraftMarker);
assert(productionDraftStart >= 0, "Expected production constructor draft route");
const nextRoute = planningRoutesSource.indexOf("\n  app.", productionDraftStart + productionDraftMarker.length);
const productionDraftRoute = planningRoutesSource.slice(
  productionDraftStart,
  nextRoute >= 0 ? nextRoute : planningRoutesSource.length,
);
assert(
  productionDraftRoute.includes("buildPerformConstructorDraft(body)"),
  "production constructor draft route must remain legacy-backed",
);
assert(
  !productionDraftRoute.includes("buildMatrixDrivenConstructorDraft") &&
    !productionDraftRoute.includes("matrix_primary_pilot"),
  "production constructor draft route must not become Matrix-backed",
);

console.log(JSON.stringify({
  ok: true,
  allowedPilotScenarios: allowedResults,
  fallbackScenarios: fallbackResults,
  productionDraftRouteLegacyBacked: true,
  matrixDefaultEnabled: false,
  noMatrixInternalsInTemplatePayload: true,
}, null, 2));
