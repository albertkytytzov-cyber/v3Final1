import {
  buildMatrixDrivenPlanDraft,
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

function profileInput(baseInput, athlete) {
  return {
    ...baseInput,
    athlete: {
      ...baseInput.athlete,
      ...athlete,
    },
  };
}

function resolveExerciseSequence(input, limit = 18) {
  const draft = buildMatrixDrivenPlanDraft(input);
  const results = selectedBlocks(draft).map(({ block, phase, dayType }) =>
    resolveConstructorMatrixExercisesForBlock({
      block,
      input,
      phase,
      dayType,
    }),
  );
  const exerciseIds = results.flatMap((result) =>
    result.exercises.map((exercise) => exercise.sourceExerciseId),
  );

  return {
    results,
    exerciseIds: exerciseIds.slice(0, limit),
    exerciseCount: exerciseIds.length,
    scoringNoteCount: results.filter((result) =>
      result.notes.some((note) => note.includes("athlete profile scoring applied")),
    ).length,
    cautionNoteCount: results.filter((result) =>
      result.notes.some((note) => note.includes("no medical clearance inferred")),
    ).length,
  };
}

function countDifferences(left, right) {
  const length = Math.max(left.length, right.length);
  let differences = 0;

  for (let index = 0; index < length; index += 1) {
    if (left[index] !== right[index]) {
      differences += 1;
    }
  }

  return differences;
}

const fixture = fixtureById("main_start_d21_controlled_volume");
const speedNeedInput = profileInput(fixture.input, {
  athleteId: "matrix-check-speed-need",
  fullName: "Synthetic Matrix Athlete Speed Need",
  strengths: ["Upper-body grip fighting is reliable."],
  weaknesses: ["Needs speed first action and cleaner leg entries."],
  injuryHistory: [],
  painZones: [],
});
const gripParterreNeedInput = profileInput(fixture.input, {
  athleteId: "matrix-check-grip-parterre-need",
  fullName: "Synthetic Matrix Athlete Grip Parterre Need",
  strengths: ["Fast first action is reliable."],
  weaknesses: ["Needs grip endurance and par terre pressure."],
  injuryHistory: [],
  painZones: [],
});

const speedNeed = resolveExerciseSequence(speedNeedInput);
const gripParterreNeed = resolveExerciseSequence(gripParterreNeedInput);
const differentSlots = countDifferences(speedNeed.exerciseIds, gripParterreNeed.exerciseIds);

assert(speedNeed.exerciseCount > 0, "Speed-need profile must resolve exercises");
assert(gripParterreNeed.exerciseCount > 0, "Grip/par-terre profile must resolve exercises");
assert(
  differentSlots >= 4,
  `Athlete-specific resolver should vary exercise selection; only ${differentSlots} slots differed`,
);
assert(
  speedNeed.scoringNoteCount > 0 && gripParterreNeed.scoringNoteCount > 0,
  "Athlete-specific scoring note must be present for profiled inputs",
);

const kneeCautionInput = profileInput(fixture.input, {
  athleteId: "matrix-check-knee-caution",
  fullName: "Synthetic Matrix Athlete Knee Caution",
  weaknesses: ["Needs leg entries under fatigue."],
  injuryHistory: ["Previous knee limitation."],
  painZones: ["knee"],
});
const kneeCaution = resolveExerciseSequence(kneeCautionInput);
assert(
  kneeCaution.cautionNoteCount > 0,
  "Pain/injury profile must surface caution note without medical clearance",
);

const unsafeText = [
  ...speedNeed.results,
  ...gripParterreNeed.results,
  ...kneeCaution.results,
]
  .flatMap((result) => [
    ...result.notes,
    ...result.exercises.flatMap((exercise) => [
      exercise.name,
      exercise.notes,
      ...exercise.reviewRequired,
      ...exercise.safetyNotes,
    ]),
  ])
  .join(" ");

assert(!/humanReviewed=true/i.test(unsafeText), "Resolver must not fake human review");
assert(!/medical approved|coach approved|cleared for return/i.test(unsafeText), "Resolver must not claim approval");
const unsafePositiveText = unsafeText.replace(/no rapid weight-cut protocol/gi, "");
assert(
  !/rapid weight-cut protocol enabled|dehydration protocol approved|sauna prescription enabled|water restriction protocol/i.test(unsafePositiveText),
  "Resolver must not add unsafe weight-cut protocols",
);

console.log(JSON.stringify({
  ok: true,
  fixtureId: fixture.id,
  speedNeedExerciseIds: speedNeed.exerciseIds,
  gripParterreNeedExerciseIds: gripParterreNeed.exerciseIds,
  differentSlots,
  kneeCautionNoteCount: kneeCaution.cautionNoteCount,
}, null, 2));
