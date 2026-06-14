import { readFile } from "node:fs/promises";

import {
  buildMatrixConstructorDraftIfAllowed,
  buildMatrixDrivenConstructorDraft,
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

function draftExercises(draft) {
  return draft.plan.weeks.flatMap((week) =>
    week.days.flatMap((day) =>
      (day.sessions ?? []).flatMap((session) =>
        (session.blocks ?? []).flatMap((block) => block.exercises ?? []),
      ),
    ),
  );
}

function bodyCompositionExerciseCount(draft) {
  return draftExercises(draft).filter((exercise) =>
    /body-composition/i.test(`${exercise.name} ${exercise.notes}`),
  ).length;
}

function assertNoUnsafeText(id, draft) {
  const serialized = JSON.stringify(draft);

  assert(
    !/(prescribe|recommend|instruct).{0,48}(sauna|diuretic|laxative|spitting|sweat suit|water restriction)/i.test(
      serialized,
    ),
    `${id}: must not include unsafe weight-cut protocol text`,
  );
  assert(
    !/humanReviewed":true|medical approved|coach approved|approved_for_runtime/i.test(serialized),
    `${id}: must not include fake approval text`,
  );
}

const closeStartScenarioIds = [
  "main_start_d28_special_pre_competition",
  "main_start_d21_controlled_volume",
  "main_start_d10_taper",
  "main_start_d4_start_window",
];

const closeStartResults = closeStartScenarioIds.map((scenarioId) => {
  const fixture = fixtureById(scenarioId);
  const result = buildMatrixConstructorDraftIfAllowed(fixture.input, {
    fallbackToLegacy: true,
    allowedModes: ["matrix_allowed_for_primary"],
  });

  assert(result.source === "matrix", `${scenarioId}: expected Matrix controlled pilot source`);
  assertNoUnsafeText(scenarioId, result.draft);
  const bodyCompositionCount = bodyCompositionExerciseCount(result.draft);
  assert(
    bodyCompositionCount === 0,
    `${scenarioId}: body-composition candidates must be suppressed in close-start pilot output`,
  );

  return {
    scenarioId,
    bodyCompositionExerciseCount: bodyCompositionCount,
    exerciseCount: draftExercises(result.draft).length,
  };
});

const baseLongHorizon = fixtureById("far_development_week_d90");
const longHorizonBodyCompositionDraft = buildMatrixDrivenConstructorDraft({
  ...baseLongHorizon.input,
  goals: [
    {
      goalType: "weight_management",
      priority: 1,
      reason: "Synthetic long-horizon body-composition internal feedback check.",
    },
    ...baseLongHorizon.input.goals,
  ],
  constraints: {
    ...baseLongHorizon.input.constraints,
    weightCutActive: false,
  },
});
const longHorizonBodyCompositionCount = bodyCompositionExerciseCount(
  longHorizonBodyCompositionDraft,
);

assertNoUnsafeText("long_horizon_body_composition", longHorizonBodyCompositionDraft);
assert(
  longHorizonBodyCompositionCount > 0,
  "Long-horizon explicit body-composition context should keep coach-editable candidates available",
);

const resolverSource = await readProjectFile(
  "packages/shared/src/constructor-matrix-exercise-resolver.ts",
);
const adapterSource = await readProjectFile(
  "packages/shared/src/constructor-matrix-adapter.ts",
);
const feedbackDoc = await readProjectFile(
  "docs/matrix-ai-internal-pilot-feedback-resolver-hardening.md",
);

assert(
  resolverSource.includes("shouldSuppressBodyCompositionCandidate"),
  "Resolver must include body-composition pilot quality guard",
);
assert(
  resolverSource.includes("body-composition candidates suppressed by pilot quality guard"),
  "Resolver must document suppressed body-composition candidates in result notes",
);
assert(
  adapterSource.includes("resolveConstructorMatrixExercisesForBlock") &&
    adapterSource.includes("phase,") &&
    adapterSource.includes("weekNumber: rotation?.weekNumber") &&
    adapterSource.includes("dayNumber: rotation?.dayNumber") &&
    adapterSource.includes("sessionSlot: rotation?.sessionSlot") &&
    adapterSource.includes("avoidExerciseIds: rotation ? Array.from(rotation.usedExerciseIds) : undefined"),
  "Adapter must pass phase/day/session rotation context into the exercise resolver",
);
assert(
  feedbackDoc.includes("AI-assisted internal pilot feedback"),
  "Feedback doc must record the AI-assisted internal pilot feedback stage",
);
assert(
  /no human approval/i.test(feedbackDoc),
  "Feedback doc must state that no human approval was recorded",
);

console.log(JSON.stringify({
  ok: true,
  closeStartResults,
  longHorizonBodyCompositionCount,
  noUnsafeWeightCutAutomation: true,
  noFakeApprovals: true,
}, null, 2));
