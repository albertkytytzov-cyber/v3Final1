import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import * as shared from "@training-platform/shared";
import { constructorPreviewFixtures } from "./fixtures/constructor/preview-regression-fixtures.mjs";

const {
  buildConstructorMatrixPilotQualityLogEntry,
  buildConstructorMatrixPilotQualityLogSummary,
  buildMatrixConstructorDraftIfAllowed,
  buildMatrixDrivenConstructorDraft,
  buildPerformConstructorDraft,
} = shared;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function projectUrl(path) {
  return new URL(`../${path}`, import.meta.url);
}

async function readProjectFile(path) {
  return readFile(projectUrl(path), "utf8");
}

function fixtureById(id) {
  const fixture = constructorPreviewFixtures.find((item) => item.id === id);
  assert(fixture, `Expected fixture ${id}`);

  return fixture;
}

const sourcePath = "packages/shared/src/constructor-matrix-pilot-quality-log.ts";
assert(existsSync(projectUrl(sourcePath)), "Pilot quality log helper must exist");

const allowedFixtureIds = [
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

const allowedEntries = allowedFixtureIds.map((fixtureId) => {
  const fixture = fixtureById(fixtureId);
  const result = buildMatrixConstructorDraftIfAllowed(fixture.input, {
    fallbackToLegacy: true,
    allowedModes: ["matrix_allowed_for_primary"],
  });

  assert(result.source === "matrix", `${fixtureId}: expected Matrix controlled pilot source`);

  const entry = buildConstructorMatrixPilotQualityLogEntry({
    scenarioId: fixtureId,
    generatedPlanSource: "matrix_primary_pilot",
    status: "allowed",
    draft: result.draft,
    evidenceFamilyCoverage: [
      "body_composition_training",
      "muscle_preservation_training",
      "max_strength",
      "taper_activation",
    ],
    saveAssignGateStatus: "not_evaluated",
    qualityNotes: ["Synthetic fixture quality entry; no production athlete id"],
  });

  assert(entry.exerciseCount > 0, `${fixtureId}: quality entry must count exercises`);
  assert(entry.coachEditableLoadCount > 0, `${fixtureId}: quality entry must count editable blocks`);
  assert(entry.noPii, `${fixtureId}: quality entry must be no PII`);
  assert(entry.noProductionAthleteId, `${fixtureId}: quality entry must avoid production athlete id`);
  assert(entry.runtimeBehaviorChanged === false, `${fixtureId}: quality log must not change runtime behavior`);

  return entry;
});

const fallbackEntries = fallbackFixtureIds.map((fixtureId) => {
  const fixture = fixtureById(fixtureId);
  const result = buildMatrixConstructorDraftIfAllowed(fixture.input, {
    fallbackToLegacy: true,
    allowedModes: ["matrix_allowed_for_primary"],
  });
  const draft = result.source === "matrix" ? result.draft : buildPerformConstructorDraft(fixture.input);

  assert(result.source === "legacy_fallback", `${fixtureId}: expected legacy fallback`);

  return buildConstructorMatrixPilotQualityLogEntry({
    scenarioId: fixtureId,
    generatedPlanSource: "legacy_fallback",
    status: "fallback",
    draft,
    evidenceFamilyCoverage: [],
    saveAssignGateStatus: "blocked",
    qualityNotes: ["Fallback scenario retained outside Matrix save path"],
  });
});

const directMatrixDraft = buildMatrixDrivenConstructorDraft(fixtureById("far_development_week_d90").input);
const directEntry = buildConstructorMatrixPilotQualityLogEntry({
  scenarioId: "direct_matrix_draft",
  generatedPlanSource: "matrix_internal",
  status: "review_required",
  draft: directMatrixDraft,
  evidenceFamilyCoverage: ["seluyanov_statodynamic_lme", "aerobic_base_low_impact"],
  saveAssignGateStatus: "blocked",
  qualityNotes: ["Direct Matrix draft is metadata review only"],
});

const entries = [...allowedEntries, ...fallbackEntries, directEntry];
const summary = buildConstructorMatrixPilotQualityLogSummary(entries);

assert(summary.scenarioCount === entries.length, "Pilot quality summary must include every entry");
assert(summary.totalExerciseCount > 0, "Pilot quality summary must count exercises");
assert(summary.totalCoachEditableLoadCount > 0, "Pilot quality summary must count coach-editable loads");
assert(summary.allNoPii, "Pilot quality summary must be no PII");
assert(summary.allNoProductionAthleteId, "Pilot quality summary must avoid production athlete ids");
assert(summary.runtimeBehaviorChanged === false, "Pilot quality log must not change runtime behavior");

const source = await readProjectFile(sourcePath);
for (const forbidden of [
  "production athlete id",
  "humanReviewed: true",
  "reviewedBy",
  "reviewedAt",
  "medical approved",
  "coach approved",
]) {
  assert(!source.toLowerCase().includes(forbidden.toLowerCase()), `Pilot quality log source must not contain ${forbidden}`);
}

console.log(JSON.stringify({
  ok: true,
  summary,
  allowedScenarios: allowedEntries.map((item) => item.scenarioId),
  fallbackScenarios: fallbackEntries.map((item) => item.scenarioId),
}, null, 2));
