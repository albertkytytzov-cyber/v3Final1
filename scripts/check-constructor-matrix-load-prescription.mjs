import {
  CONSTRUCTOR_TRAINING_BLOCK_LIBRARY,
  buildConstructorMatrixLoadPrescription,
  buildConstructorMatrixLoadPrescriptionSummary,
  getConstructorMatrixExercise,
} from "@training-platform/shared";
import { constructorPreviewFixtures } from "./fixtures/constructor/preview-regression-fixtures.mjs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function blockDefinition(blockType) {
  const definition = CONSTRUCTOR_TRAINING_BLOCK_LIBRARY.find((item) => item.type === blockType);
  assert(definition, `Expected block definition ${blockType}`);

  return definition;
}

function selectedBlock(blockType, loadLevel = "high") {
  const definition = blockDefinition(blockType);

  return {
    blockType: definition.type,
    label: definition.label,
    sourceCompatibilityCards: [],
    targetQuality: definition.targetQuality,
    blockTypeCategory: definition.blockType,
    loadLevel,
    matVolumeLevel: definition.matVolumeLevel,
    riskTags: definition.riskTags,
    evidenceDependencies: definition.evidenceDependencies,
    volume: {
      loadLevel,
      intensityLevel: loadLevel === "high" ? "high" : "moderate",
      durationMinutes: { min: 20, max: 40, target: 30 },
      matVolume: definition.matVolumeLevel,
      density: "single_session",
      recoveryPriority: "secondary",
      explanation: "Synthetic load-prescription validation block.",
    },
    selectedBecause: ["synthetic validation"],
    explanations: [],
  };
}

const fixture = constructorPreviewFixtures.find((item) => item.id === "far_development_week_d90");
assert(fixture, "Expected far development fixture");

const strengthExercise = getConstructorMatrixExercise("front_squat_candidate");
const technicalExercise = getConstructorMatrixExercise("single_leg_entry_finish");
assert(strengthExercise, "Expected front_squat_candidate exercise");
assert(technicalExercise, "Expected single_leg_entry_finish exercise");

const missingMaxPrescription = buildConstructorMatrixLoadPrescription({
  exercise: strengthExercise,
  block: selectedBlock("spp", "high"),
  input: fixture.input,
  displayOrder: 0,
});
const maxBasedPrescription = buildConstructorMatrixLoadPrescription({
  exercise: strengthExercise,
  block: selectedBlock("spp", "high"),
  input: fixture.input,
  displayOrder: 1,
  strengthLoadContext: {
    trainingMaxKgByExerciseId: {
      front_squat_candidate: 100,
    },
  },
});
const technicalPrescription = buildConstructorMatrixLoadPrescription({
  exercise: technicalExercise,
  block: selectedBlock("mat_technique", "medium"),
  input: fixture.input,
  displayOrder: 2,
});
const weighInInput = {
  ...fixture.input,
  context: {
    ...fixture.input.context,
    cycleLengthDays: 4,
  },
  constraints: {
    ...fixture.input.constraints,
    weightCutActive: true,
  },
};
const weighInPrescription = buildConstructorMatrixLoadPrescription({
  exercise: getConstructorMatrixExercise("weigh_in_light_movement"),
  block: selectedBlock("weigh_in", "medium"),
  input: weighInInput,
  displayOrder: 3,
});

const prescriptions = [
  missingMaxPrescription,
  maxBasedPrescription,
  technicalPrescription,
  weighInPrescription,
];
const summary = buildConstructorMatrixLoadPrescriptionSummary(prescriptions);

assert(missingMaxPrescription.targetWeightKg === null, "Missing max/e1RM must not produce a weight");
assert(
  missingMaxPrescription.calculationNotes.some((note) => note.includes("no athlete training max/e1RM")),
  "Missing max/e1RM must be visible in calculation notes",
);
assert(maxBasedPrescription.targetWeightKg === 70, "Training max candidate should use coach-editable training max");
assert(
  maxBasedPrescription.calculationNotes.some((note) => note.includes("not a medical threshold")),
  "Strength weight candidate must be documented as non-medical",
);
assert(technicalPrescription.targetWeightKg === null, "Technical exercises must not invent weights");
assert(weighInPrescription.targetRpe <= 4, "Weight-management context must cap RPE conservatively");
assert(weighInPrescription.highRiskAutomationBlocked, "Weigh-in prescription must keep high-risk automation blocked");

for (const prescription of prescriptions) {
  assert(prescription.coachEditable === true, `${prescription.name}: prescription must be coach-editable`);
  assert(prescription.loadLocked === false, `${prescription.name}: load must not be locked`);
  assert(
    prescription.calculationNotes.includes("not medical advice"),
    `${prescription.name}: audit notes must carry not-medical-advice limitation`,
  );
  assert(
    !prescription.notes.includes("coachEditable=") &&
      !prescription.notes.includes("loadLocked=") &&
      !prescription.notes.includes("reviewRequired=") &&
      !prescription.notes.includes("coach-editable prescription") &&
      !prescription.notes.includes("no medical threshold"),
    `${prescription.name}: coach-facing notes must not expose technical metadata`,
  );
}

assert(summary.prescriptionCount === prescriptions.length, "Load prescription summary count mismatch");
assert(summary.coachEditableCount === prescriptions.length, "All load prescriptions must be coach-editable");
assert(summary.loadLockedCount === 0, "No load prescription may be locked");
assert(summary.strengthWeightCandidateCount === 1, "Only max/e1RM-backed strength exercise should receive weight");
assert(summary.missingStrengthMaxFallbackCount === 1, "Missing strength max fallback must be counted");

console.log(JSON.stringify({
  ok: true,
  summary,
  missingMaxTargetWeightKg: missingMaxPrescription.targetWeightKg,
  maxBasedTargetWeightKg: maxBasedPrescription.targetWeightKg,
  technicalTargetWeightKg: technicalPrescription.targetWeightKg,
  weighInTargetRpe: weighInPrescription.targetRpe,
}, null, 2));
