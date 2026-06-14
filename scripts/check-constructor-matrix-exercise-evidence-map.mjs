import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";

import {
  CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_IDS,
  CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP,
  CONSTRUCTOR_MATRIX_EXERCISE_LIBRARY,
  CONSTRUCTOR_MATRIX_NUTRITION_GUIDANCE,
  CONSTRUCTOR_MATRIX_SOURCE_CANDIDATE_IDS,
  CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG_IDS,
  CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE_IDS,
  CONSTRUCTOR_MATRIX_WEIGHT_MANAGEMENT_GUIDANCE,
  buildConstructorMatrixExerciseEvidenceMapSummary,
  validateConstructorMatrixExerciseEvidenceCoverage,
} from "@training-platform/shared";

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

async function walkFiles(path) {
  const root = projectUrl(path);
  const entries = await readdir(root);
  const files = [];

  for (const entry of entries) {
    const entryPath = `${path}/${entry}`;
    const entryStat = await stat(projectUrl(entryPath));

    if (entryStat.isDirectory()) {
      files.push(...await walkFiles(entryPath));
    } else {
      files.push(entryPath);
    }
  }

  return files;
}

async function assertNoRuntimeImports(moduleName) {
  const runtimeFiles = [
    "packages/shared/src/constructor-matrix-plan-builder.ts",
    "packages/shared/src/constructor-matrix-skeleton.ts",
    "packages/shared/src/constructor-matrix-preview.ts",
    "packages/shared/src/constructor-matrix-rollout.ts",
    "packages/shared/src/constructor-matrix-pilot-readiness.ts",
    "packages/shared/src/constructor-matrix-save-dry-run.ts",
    "packages/shared/src/constructor-core.ts",
    "packages/shared/src/constructor-matrix-adapter.ts",
  ];

  for (const path of runtimeFiles) {
    const source = await readProjectFile(path);
    assert(!source.includes(moduleName), `${path} must not import ${moduleName}`);
  }

  for (const appDir of ["apps/api", "apps/web"]) {
    for (const path of await walkFiles(appDir)) {
      if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(path)) continue;

      const source = await readProjectFile(path);
      assert(!source.includes(moduleName), `${path} must not import ${moduleName}`);
    }
  }
}

const sourcePath = "packages/shared/src/constructor-matrix-exercise-evidence-map.ts";
assert(existsSync(projectUrl(sourcePath)), "Exercise evidence map source file must exist");
assert(CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP.length > 0, "Exercise evidence map must not be empty");

const requiredFamilyIds = [
  "seluyanov_statodynamic_lme",
  "speed_first_action",
  "acceleration_change_of_direction",
  "speed_endurance_wrestling_density",
  "max_strength",
  "strength_endurance",
  "posterior_chain_strength",
  "trunk_anti_rotation",
  "grip_hand_fighting_strength_endurance",
  "aerobic_base_low_impact",
  "wrestling_technical_transfer",
  "par_terre_technical_transfer",
  "competition_model_and_controlled_bouts",
  "taper_activation",
  "recovery_mobility_downregulation",
  "travel_mobility_reset",
  "post_competition_recovery",
  "body_composition_training",
  "muscle_preservation_training",
  "low_impact_conditioning_for_body_composition",
  "nutrition_body_composition_guidance",
  "weight_management_review_prompt",
  "weigh_in_review_required_guidance",
  "high_risk_blocked_weight_cut_hydration",
];

const ids = new Set();
const evidenceIds = new Set(CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_IDS);
const exerciseIds = new Set(CONSTRUCTOR_MATRIX_EXERCISE_LIBRARY.map((item) => item.id));
const nutritionIds = new Set(CONSTRUCTOR_MATRIX_NUTRITION_GUIDANCE.map((item) => item.id));
const weightGuidanceIds = new Set(CONSTRUCTOR_MATRIX_WEIGHT_MANAGEMENT_GUIDANCE.map((item) => item.id));
const backlogIds = new Set(CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG_IDS);
const sourceCandidateIds = new Set(CONSTRUCTOR_MATRIX_SOURCE_CANDIDATE_IDS);
const sourceLookupIds = new Set(CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE_IDS);

for (const familyId of requiredFamilyIds) {
  assert(
    CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP.some((item) => item.id === familyId),
    `Missing required exercise evidence family: ${familyId}`,
  );
}

for (const family of CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP) {
  assert(!ids.has(family.id), `Duplicate exercise evidence family id: ${family.id}`);
  ids.add(family.id);
  assert(family.title, `${family.id}: missing title`);
  assert(family.scope, `${family.id}: missing scope`);
  assert(family.requiredSourceTypes.length > 0, `${family.id}: missing required source types`);
  assert(family.reviewTracks.length > 0, `${family.id}: missing review tracks`);
  assert(family.forbiddenUses.length > 0, `${family.id}: missing forbidden uses`);
  assert(family.limitations.length > 0, `${family.id}: missing limitations`);
  assert(family.evidenceReviewQuestions.length > 0, `${family.id}: missing evidence review questions`);
  assert(
    family.acceptanceCriteriaForFutureApproval.length > 0,
    `${family.id}: missing future approval acceptance criteria`,
  );
  assert(family.humanReviewed === false, `${family.id}: must not imply human review`);
  assert(!("reviewedBy" in family), `${family.id}: must not include reviewedBy`);
  assert(!("reviewedAt" in family), `${family.id}: must not include reviewedAt`);

  for (const exerciseId of family.linkedExerciseIds) {
    assert(exerciseIds.has(exerciseId), `${family.id}: unknown exercise id ${exerciseId}`);
  }

  for (const guidanceId of family.linkedNutritionGuidanceIds) {
    assert(nutritionIds.has(guidanceId), `${family.id}: unknown nutrition guidance id ${guidanceId}`);
  }

  for (const guidanceId of family.linkedWeightManagementGuidanceIds) {
    assert(weightGuidanceIds.has(guidanceId), `${family.id}: unknown weight-management guidance id ${guidanceId}`);
  }

  for (const evidenceId of family.evidenceDependencyIds) {
    assert(evidenceIds.has(evidenceId), `${family.id}: unknown evidence dependency ${evidenceId}`);
  }

  for (const backlogId of family.sourceExpansionBacklogIds) {
    assert(backlogIds.has(backlogId), `${family.id}: unknown source expansion backlog id ${backlogId}`);
  }

  for (const candidateId of family.sourceCandidateIds) {
    assert(sourceCandidateIds.has(candidateId), `${family.id}: unknown source candidate id ${candidateId}`);
  }

  for (const intakeId of family.sourceLookupIntakeIds) {
    assert(sourceLookupIds.has(intakeId), `${family.id}: unknown source lookup intake id ${intakeId}`);
  }

  if (family.highRiskAutomationBlocked) {
    assert(
      ["none", "docs_only", "review_export_only"].includes(family.runtimeUseAllowedNow),
      `${family.id}: high-risk family cannot allow runtime plan content`,
    );
  }
}

const coverage = validateConstructorMatrixExerciseEvidenceCoverage();
assert(coverage.ok, `Exercise evidence map coverage incomplete: ${JSON.stringify(coverage)}`);

const bodyCompositionFamilies = [
  "body_composition_training",
  "muscle_preservation_training",
  "low_impact_conditioning_for_body_composition",
  "nutrition_body_composition_guidance",
];
const requiredBodyCompositionForbiddenUses = [
  "rapid weight cut",
  "dehydration protocol",
  "exact kg loss prescription",
  "exact calorie prescription",
];

for (const familyId of bodyCompositionFamilies) {
  const family = CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP.find((item) => item.id === familyId);

  assert(family, `Missing body-composition family: ${familyId}`);
  for (const forbiddenUse of requiredBodyCompositionForbiddenUses) {
    assert(
      family.forbiddenUses.includes(forbiddenUse),
      `${familyId}: must forbid ${forbiddenUse}`,
    );
  }
}

const bfrFamily = CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP.find(
  (item) => item.id === "bfr_kaatsu_blocked_screening_context",
);
assert(bfrFamily, "Missing BFR/KAATSU blocked screening family");
assert(bfrFamily.highRiskAutomationBlocked, "BFR/KAATSU family must be high-risk blocked");
assert(bfrFamily.runtimeUseAllowedNow === "none", "BFR/KAATSU family must have no runtime use");

const source = await readProjectFile(sourcePath);
const forbiddenMarkers = [
  "humanReviewed: true",
  "reviewedBy",
  "reviewedAt",
  "approved_for_runtime",
  "approved_for_default",
  "medical approved",
  "coach approved",
  "PMID:",
  "DOI:",
  "et al.",
];

for (const marker of forbiddenMarkers) {
  assert(!source.toLowerCase().includes(marker.toLowerCase()), `Exercise evidence map must not contain ${marker}`);
}

const forbiddenNumericThresholdPatterns = [
  />=\s*\d+/,
  /<=\s*\d+/,
  /\d+\s*>\s*\d*/,
  /\d+\s*<\s*\d*/,
  /\d+\s*%/,
  /\d+\s*bpm\b/i,
  /\d+\s*kg\b/i,
  /\d+\/10\b/,
  /threshold value approved/i,
];

for (const pattern of forbiddenNumericThresholdPatterns) {
  assert(!pattern.test(source), `Exercise evidence map must not contain numeric threshold pattern ${pattern}`);
}

await assertNoRuntimeImports("constructor-matrix-exercise-evidence-map");

const summary = buildConstructorMatrixExerciseEvidenceMapSummary();
console.log(JSON.stringify({
  ok: true,
  summary,
  requiredFamilyCount: requiredFamilyIds.length,
  noRuntimeImports: true,
  noFakeApprovals: true,
  noFakeCitations: true,
}, null, 2));
