import {
  CONSTRUCTOR_TRAINING_BLOCK_LIBRARY,
  buildMatrixDrivenPlanDraft,
  buildConstructorMatrixExerciseResolverSummary,
  resolveConstructorMatrixExercisesForBlock,
} from "@training-platform/shared";
import { constructorPreviewFixtures } from "./fixtures/constructor/preview-regression-fixtures.mjs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function fixtureById(id) {
  const fixture = constructorPreviewFixtures.find((item) => item.id === id);
  assert(fixture, `Expected fixture ${id}`);

  return fixture;
}

function selectedBlocks(planDraft) {
  return planDraft.weeks.flatMap((week) =>
    week.days.flatMap((day) =>
      day.sessions.flatMap((session) =>
        session.selectedBlocks.map((block) => ({
          block,
          phase: week.phase,
          dayType: day.dayType,
        })),
      ),
    ),
  );
}

const summary = buildConstructorMatrixExerciseResolverSummary();
const expectedBlockTypes = CONSTRUCTOR_TRAINING_BLOCK_LIBRARY.map((block) => block.type);

for (const blockType of expectedBlockTypes) {
  assert(summary.coveredBlockTypes.includes(blockType), `Resolver missing coverage for ${blockType}`);
}

const fixtureIds = [
  "far_development_week_d90",
  "main_start_d28_special_pre_competition",
  "main_start_d21_controlled_volume",
  "main_start_d10_taper",
  "main_start_d4_start_window",
  "travel_day",
  "weigh_in_day",
  "competition_day",
];

const results = fixtureIds.map((fixtureId) => {
  const fixture = fixtureById(fixtureId);
  const draft = buildMatrixDrivenPlanDraft(fixture.input);
  const blockResults = selectedBlocks(draft).map(({ block, phase, dayType }) =>
    resolveConstructorMatrixExercisesForBlock({
      block,
      input: fixture.input,
      phase,
      dayType,
    }),
  );

  for (const result of blockResults) {
    assert(result.exerciseCount > 0, `${fixtureId}:${result.blockType} must resolve exercises`);
    assert(result.exercises.length === result.exerciseCount, `${fixtureId}:${result.blockType} count mismatch`);

    for (const exercise of result.exercises) {
      assert(exercise.name, `${fixtureId}:${result.blockType} exercise missing name`);
      assert(exercise.coachEditable === true, `${fixtureId}:${exercise.name} must be coach-editable`);
      assert(exercise.loadLocked === false, `${fixtureId}:${exercise.name} load must not be locked`);
      assert(exercise.safetyNotes.length > 0, `${fixtureId}:${exercise.name} missing safety notes`);
      assert(exercise.substitutions.regressions.length > 0, `${fixtureId}:${exercise.name} missing regressions`);
      assert(exercise.substitutions.progressions.length > 0, `${fixtureId}:${exercise.name} missing progressions`);
    }

    if (result.blockType === "sauna" || result.blockType === "weigh_in") {
      assert(
        result.highRiskAutomationBlockedIds.length > 0,
        `${fixtureId}:${result.blockType} must keep high-risk exercise automation blocked`,
      );
      assert(result.reviewRequiredIds.length > 0, `${fixtureId}:${result.blockType} must require review`);
    }
  }

  return {
    fixtureId,
    selectedBlockCount: blockResults.length,
    resolvedExerciseCount: blockResults.reduce((sum, item) => sum + item.exerciseCount, 0),
    highRiskAutomationBlockedCount: blockResults.reduce(
      (sum, item) => sum + item.highRiskAutomationBlockedIds.length,
      0,
    ),
  };
});

console.log(JSON.stringify({
  ok: true,
  coveredBlockTypes: summary.coveredBlockTypes,
  coveredBlockTypeCount: summary.coveredBlockTypeCount,
  fixtureResults: results,
}, null, 2));
