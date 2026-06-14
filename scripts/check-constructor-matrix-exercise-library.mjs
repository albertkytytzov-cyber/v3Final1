import { readFile } from "node:fs/promises";

import {
  CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_IDS,
  CONSTRUCTOR_MATRIX_EXERCISE_LIBRARY,
  CONSTRUCTOR_TRAINING_BLOCK_LIBRARY,
  buildConstructorMatrixExerciseLibrarySummary,
} from "@training-platform/shared";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readProjectFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const requiredCategories = [
  "wrestling_stance_movement",
  "shots_entries",
  "defense_sprawl",
  "par_terre_top",
  "par_terre_bottom",
  "grip_hand_fighting",
  "edge_of_mat",
  "tactical_score_situation",
  "competition_model",
  "controlled_bout",
  "speed_first_action",
  "acceleration_change_of_direction",
  "max_strength",
  "strength_endurance",
  "local_muscular_endurance_legs",
  "posterior_chain",
  "trunk_anti_rotation",
  "neck_prehab",
  "mobility",
  "aerobic_recovery",
  "breathing_downregulation",
  "travel_mobility",
  "weigh_in_day_activation",
  "post_competition_recovery",
];
const evidenceIds = new Set(CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_IDS);
const ids = new Set();
const summary = buildConstructorMatrixExerciseLibrarySummary();

assert(CONSTRUCTOR_MATRIX_EXERCISE_LIBRARY.length >= 80, "Matrix exercise library must contain at least 80 exercises");
assert(summary.exerciseCount === CONSTRUCTOR_MATRIX_EXERCISE_LIBRARY.length, "Exercise library summary count mismatch");
assert(summary.humanReviewed === false, "Exercise library must not imply human review");
assert(
  summary.byMethodologyTag.seluyanov_statodynamic_lme_candidate >= 20,
  "Matrix exercise library must include Seluyanov/statodynamic LME candidate coverage",
);

for (const exercise of CONSTRUCTOR_MATRIX_EXERCISE_LIBRARY) {
  assert(!ids.has(exercise.id), `Duplicate exercise id: ${exercise.id}`);
  ids.add(exercise.id);
  assert(exercise.name, `${exercise.id}: missing name`);
  assert(exercise.category, `${exercise.id}: missing category`);
  assert(exercise.blockTypes.length > 0, `${exercise.id}: missing blockTypes`);
  assert(exercise.targetQualities.length > 0, `${exercise.id}: missing target qualities`);
  assert(exercise.equipment.length > 0, `${exercise.id}: missing equipment`);
  assert(exercise.environments.length > 0, `${exercise.id}: missing environments`);
  assert(exercise.phaseApplicability.length > 0, `${exercise.id}: missing phase applicability`);
  assert(exercise.dayTypeApplicability.length > 0, `${exercise.id}: missing day type applicability`);
  assert(exercise.progressionOptions.length > 0, `${exercise.id}: missing progression options`);
  assert(exercise.regressionOptions.length > 0, `${exercise.id}: missing regression options`);
  assert(exercise.coachingCues.length > 0, `${exercise.id}: missing coaching cues`);
  assert(exercise.commonMistakes.length > 0, `${exercise.id}: missing common mistakes`);
  assert(exercise.safetyNotes.length > 0, `${exercise.id}: missing safety notes`);
  assert(exercise.defaultPrescription, `${exercise.id}: missing default prescription`);
  assert(exercise.defaultPrescription.notes, `${exercise.id}: missing prescription notes`);
  assert(exercise.evidenceDependencyIds.length > 0, `${exercise.id}: missing evidence dependency ids`);

  for (const evidenceId of exercise.evidenceDependencyIds) {
    assert(evidenceIds.has(evidenceId), `${exercise.id}: unknown evidence dependency ${evidenceId}`);
  }

  if (exercise.category === "weigh_in_day_activation" || exercise.category === "neck_prehab") {
    assert(exercise.reviewRequired.length > 0, `${exercise.id}: high-risk category must require review`);
    assert(exercise.highRiskAutomationBlocked, `${exercise.id}: high-risk category must block automation`);
  }

  if (exercise.blockTypes.includes("sauna")) {
    assert(exercise.highRiskAutomationBlocked, `${exercise.id}: sauna block coverage must be automation-blocked`);
    assert(exercise.reviewRequired.includes("medical"), `${exercise.id}: sauna block coverage must require medical review`);
  }

  if (exercise.methodologyTags.includes("seluyanov_statodynamic_lme_candidate")) {
    assert(
      exercise.methodologyTags.includes("coach_school_candidate"),
      `${exercise.id}: Seluyanov/statodynamic entry must be marked coach-school candidate`,
    );
    assert(
      exercise.reviewRequired.includes("coach") && exercise.reviewRequired.includes("sport_science"),
      `${exercise.id}: Seluyanov/statodynamic entry must require coach and sport-science review`,
    );
    assert(
      exercise.safetyNotes.some((note) => /not source-verified protocol yet/i.test(note)),
      `${exercise.id}: Seluyanov/statodynamic entry must not imply source-verified protocol status`,
    );
  }
}

for (const category of requiredCategories) {
  assert(summary.byCategory[category] > 0, `Missing exercise category coverage: ${category}`);
}

for (const block of CONSTRUCTOR_TRAINING_BLOCK_LIBRARY) {
  assert(summary.byBlockType[block.type] > 0, `Missing exercise coverage for block type: ${block.type}`);
}

const source = await readProjectFile("packages/shared/src/constructor-matrix-exercise-library.ts");
const forbiddenSourceMarkers = [
  "humanReviewed: true",
  "reviewedBy",
  "reviewedAt",
  "approved_for_runtime",
  "medical approved",
  "coach approved",
  "BFR prescription",
  "KAATSU prescription",
  "water restriction plan",
  "diuretic advice",
  "laxative advice",
  "sweat suit plan",
  "source-verified protocol approved",
];

for (const marker of forbiddenSourceMarkers) {
  assert(!source.toLowerCase().includes(marker.toLowerCase()), `Exercise library must not contain ${marker}`);
}

console.log(JSON.stringify({
  ok: true,
  exerciseCount: CONSTRUCTOR_MATRIX_EXERCISE_LIBRARY.length,
  blockCoverageCount: Object.keys(summary.byBlockType).length,
  categoryCoverageCount: Object.keys(summary.byCategory).length,
  seluyanovStatodynamicCandidateCount:
    summary.byMethodologyTag.seluyanov_statodynamic_lme_candidate,
  reviewRequiredCount: summary.reviewRequiredCount,
  highRiskAutomationBlockedCount: summary.highRiskAutomationBlockedCount,
}, null, 2));
