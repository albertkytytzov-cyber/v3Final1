import { readFile } from "node:fs/promises";

import * as shared from "@training-platform/shared";
import { constructorPreviewFixtures } from "./fixtures/constructor/preview-regression-fixtures.mjs";

const {
  buildConstructorTemplatePayload,
  buildMatrixConstructorDraftIfAllowed,
  buildMatrixDrivenConstructorDraft,
  buildPerformConstructorDraft,
  decideMatrixConstructorRollout,
  evaluateMatrixPilotReadiness,
} = shared;

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
  const serialized = JSON.stringify(draft);

  return {
    days: days.length,
    sessions: sessions.length,
    blocks: blocks.length,
    exercises: exercises.length,
    bodyCompositionExerciseCount: exercises.filter((exercise) =>
      /body-composition/i.test(`${exercise.name} ${exercise.notes}`),
    ).length,
    strengthWeightCandidates: exercises.filter((exercise) => exercise.targetWeightKg !== null).length,
    hasReviewRequiredText: /review|required|blocked|fallback|medical|coach/i.test(serialized),
    hasUnsafeWeightCutText:
      /(prescribe|recommend|instruct).{0,48}(sauna|diuretic|laxative|spitting|sweat suit|water restriction)/i.test(
        serialized,
      ),
    hasFakeApprovalText: /humanReviewed":true|medical approved|coach approved|approved_for_runtime/i.test(serialized),
  };
}

function assertTemplatePayloadSafe(testId, draft) {
  const payload = buildConstructorTemplatePayload(draft, `PERFORM Matrix Real Scenario ${testId}`);
  const serialized = JSON.stringify(payload);

  assert(payload.days?.length > 0, `${testId}: template payload must include days`);
  for (const marker of [
    '"matrix"',
    '"aiRuntime"',
    '"familySourceReview"',
    '"evidenceDossier"',
    '"reviewDecision"',
    '"sourceExpansion"',
    '"runtimeEligibility"',
  ]) {
    assert(!serialized.includes(marker), `${testId}: template payload must not contain ${marker}`);
  }
}

const allowedScenarioIds = [
  "far_development_week_d90",
  "main_start_d28_special_pre_competition",
  "main_start_d21_controlled_volume",
  "main_start_d10_taper",
  "main_start_d4_start_window",
];
const fallbackScenarioIds = [
  "main_start_d3_final_activation",
  "travel_day",
  "weigh_in_day",
  "competition_day",
];

const allowedResults = allowedScenarioIds.map((scenarioId) => {
  const fixture = fixtureById(scenarioId);
  const rollout = decideMatrixConstructorRollout(fixture.input);
  const readiness = evaluateMatrixPilotReadiness(fixture.input);
  const result = buildMatrixConstructorDraftIfAllowed(fixture.input, {
    fallbackToLegacy: true,
    allowedModes: ["matrix_allowed_for_primary"],
  });

  assert(result.source === "matrix", `${scenarioId}: expected Matrix source`);
  assert(rollout.mode === "matrix_allowed_for_primary", `${scenarioId}: rollout must allow Matrix primary pilot`);
  assert(readiness.status === "ready_for_limited_primary_pilot", `${scenarioId}: pilot readiness must pass`);

  const stats = draftStats(result.draft);
  assert(stats.days > 0, `${scenarioId}: draft must include days`);
  assert(stats.sessions > 0, `${scenarioId}: draft must include sessions`);
  assert(stats.exercises > 0, `${scenarioId}: draft must include exercises`);
  if (scenarioId !== "far_development_week_d90") {
    assert(
      stats.bodyCompositionExerciseCount === 0,
      `${scenarioId}: close-start pilot drafts must not surface body-composition exercise candidates`,
    );
  }
  assert(!stats.hasUnsafeWeightCutText, `${scenarioId}: must not include unsafe weight-cut text`);
  assert(!stats.hasFakeApprovalText, `${scenarioId}: must not include fake approval text`);
  assertTemplatePayloadSafe(scenarioId, result.draft);

  return { scenarioId, source: result.source, ...stats };
});

const fallbackResults = fallbackScenarioIds.map((scenarioId) => {
  const fixture = fixtureById(scenarioId);
  const result = buildMatrixConstructorDraftIfAllowed(fixture.input, {
    fallbackToLegacy: true,
    allowedModes: ["matrix_allowed_for_primary"],
  });
  const activeDraft = result.source === "matrix" ? result.draft : buildPerformConstructorDraft(fixture.input);
  const stats = draftStats(activeDraft);

  assert(result.source === "legacy_fallback", `${scenarioId}: expected legacy fallback`);
  assert(!stats.hasUnsafeWeightCutText, `${scenarioId}: fallback must not include unsafe weight-cut text`);
  assert(!stats.hasFakeApprovalText, `${scenarioId}: fallback must not include fake approval text`);

  return { scenarioId, source: result.source, ...stats };
});

function withPatch(baseFixtureId, scenarioId, patch) {
  const fixture = fixtureById(baseFixtureId);
  return {
    ...fixture,
    id: scenarioId,
    input: {
      ...fixture.input,
      athlete: {
        ...fixture.input.athlete,
        ...(patch.athlete ?? {}),
      },
      state: {
        ...fixture.input.state,
        ...(patch.state ?? {}),
      },
      constraints: {
        ...fixture.input.constraints,
        ...(patch.constraints ?? {}),
      },
      goals: patch.goals ?? fixture.input.goals,
    },
  };
}

const highRiskScenarios = [
  withPatch("far_development_week_d90", "body_composition_long_horizon_review_required", {
    goals: [
      {
        goalType: "weight_management",
        priority: 1,
        reason: "Synthetic review-required body-composition context.",
      },
    ],
  }),
  withPatch("main_start_d28_special_pre_competition", "pain_blocked_review_required", {
    state: { painLevel: 6 },
    constraints: { injuryCaution: true },
  }),
  withPatch("main_start_d28_special_pre_competition", "youth_review_required", {
    athlete: { trainingAgeYears: 1 },
  }),
  withPatch("main_start_d28_special_pre_competition", "female_reds_review_required", {
    athlete: { sex: "female" },
    goals: [
      {
        goalType: "weight_management",
        priority: 1,
        reason: "Synthetic female-context review-required scenario.",
      },
    ],
  }),
];

const highRiskResults = highRiskScenarios.map((scenario) => {
  const directDraft = buildMatrixDrivenConstructorDraft(scenario.input);
  const stats = draftStats(directDraft);

  assert(directDraft.generatedFrom === "matrix", `${scenario.id}: direct Matrix draft should build for inspection`);
  assert(stats.hasReviewRequiredText, `${scenario.id}: high-risk scenario must carry review-required text`);
  assert(!stats.hasUnsafeWeightCutText, `${scenario.id}: must not include unsafe weight-cut text`);
  assert(!stats.hasFakeApprovalText, `${scenario.id}: must not include fake approval text`);

  return { scenarioId: scenario.id, source: "matrix_internal", ...stats };
});

const planningRoutesSource = await readProjectFile("apps/api/src/api/planning/planning.routes.ts");
const marker = 'app.post("/api/v1/plans/constructor/draft"';
const start = planningRoutesSource.indexOf(marker);
assert(start >= 0, "Expected production constructor draft route");
const nextRoute = planningRoutesSource.indexOf("\n  app.", start + marker.length);
const routeBlock = planningRoutesSource.slice(start, nextRoute >= 0 ? nextRoute : planningRoutesSource.length);
assert(routeBlock.includes("buildPerformConstructorDraft"), "production route must remain legacy-backed");
assert(!routeBlock.includes("buildMatrixDrivenConstructorDraft"), "production route must not be Matrix-backed");

console.log(JSON.stringify({
  ok: true,
  allowedResults,
  fallbackResults,
  highRiskResults,
  productionDraftRouteLegacyBacked: true,
  noUnsafeWeightCutAutomation: true,
  noFakeApprovals: true,
}, null, 2));
