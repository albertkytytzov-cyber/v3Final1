import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";

import {
  CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP,
  CONSTRUCTOR_MATRIX_EXERCISE_SOURCE_REQUIREMENTS,
  buildConstructorMatrixExerciseSourceRequirementSummary,
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

const sourcePath = "packages/shared/src/constructor-matrix-exercise-source-requirements.ts";
assert(existsSync(projectUrl(sourcePath)), "Exercise source requirements source file must exist");
assert(
  CONSTRUCTOR_MATRIX_EXERCISE_SOURCE_REQUIREMENTS.length > 0,
  "Exercise source requirements registry must not be empty",
);
assert(
  CONSTRUCTOR_MATRIX_EXERCISE_SOURCE_REQUIREMENTS.length ===
    CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP.length,
  "Every exercise evidence family must have one source requirement",
);

const familyIds = new Set(CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP.map((item) => item.id));
const requirementIds = new Set();

const requiredP0FamilyIds = [
  "high_risk_blocked_weight_cut_hydration",
  "weigh_in_review_required_guidance",
  "nutrition_body_composition_guidance",
  "weight_management_review_prompt",
  "body_composition_training",
  "muscle_preservation_training",
];

const requiredP1FamilyIds = [
  "seluyanov_statodynamic_lme",
  "speed_endurance_wrestling_density",
  "max_strength",
  "strength_endurance",
  "competition_model_and_controlled_bouts",
  "taper_activation",
  "aerobic_base_low_impact",
];

for (const familyId of familyIds) {
  assert(
    CONSTRUCTOR_MATRIX_EXERCISE_SOURCE_REQUIREMENTS.some(
      (item) => item.familyId === familyId,
    ),
    `Missing source requirement for family ${familyId}`,
  );
}

for (const requirement of CONSTRUCTOR_MATRIX_EXERCISE_SOURCE_REQUIREMENTS) {
  assert(
    familyIds.has(requirement.familyId),
    `Source requirement references unknown family ${requirement.familyId}`,
  );
  assert(!requirementIds.has(requirement.familyId), `Duplicate source requirement ${requirement.familyId}`);
  requirementIds.add(requirement.familyId);
  assert(requirement.requiredSourceTypes.length > 0, `${requirement.familyId}: missing required source types`);
  assert(requirement.sourceQuestions.length > 0, `${requirement.familyId}: missing source questions`);
  assert(
    requirement.minimumAcceptanceCriteria.length > 0,
    `${requirement.familyId}: missing minimum acceptance criteria`,
  );
  assert(
    requirement.blockersBeforeRuntimePromotion.length > 0,
    `${requirement.familyId}: missing runtime-promotion blockers`,
  );
  assert(requirement.manualReviewNeeded === true, `${requirement.familyId}: must require manual review`);
  assert(
    requirement.runtimePromotionAllowedNow === false,
    `${requirement.familyId}: source requirement cannot allow runtime promotion now`,
  );
}

for (const familyId of requiredP0FamilyIds) {
  const requirement = CONSTRUCTOR_MATRIX_EXERCISE_SOURCE_REQUIREMENTS.find(
    (item) => item.familyId === familyId,
  );

  assert(requirement, `Missing required P0 source requirement ${familyId}`);
  assert(requirement.priority === "P0", `${familyId}: must be P0`);
  assert(
    requirement.humanReviewRequiredBeforeApproval,
    `${familyId}: must require human review before approval`,
  );
  assert(
    requirement.blockersBeforeRuntimePromotion.some((blocker) =>
      /medical decision|weight-cut|hydration|rapid weight/i.test(blocker),
    ),
    `${familyId}: high-risk blocker must remain explicit`,
  );
}

for (const familyId of requiredP1FamilyIds) {
  const requirement = CONSTRUCTOR_MATRIX_EXERCISE_SOURCE_REQUIREMENTS.find(
    (item) => item.familyId === familyId,
  );

  assert(requirement, `Missing required P1 source requirement ${familyId}`);
  assert(requirement.priority === "P1", `${familyId}: must be P1`);
}

const highRiskFamilies = CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP.filter(
  (family) => family.highRiskAutomationBlocked,
);

for (const family of highRiskFamilies) {
  const requirement = CONSTRUCTOR_MATRIX_EXERCISE_SOURCE_REQUIREMENTS.find(
    (item) => item.familyId === family.id,
  );

  assert(requirement, `${family.id}: missing high-risk source requirement`);
  assert(requirement.humanReviewRequiredBeforeApproval, `${family.id}: high-risk family must require human review`);
  assert(requirement.runtimePromotionAllowedNow === false, `${family.id}: high-risk family cannot promote runtime`);
}

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
  assert(!source.toLowerCase().includes(marker.toLowerCase()), `Source requirements must not contain ${marker}`);
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
  assert(!pattern.test(source), `Source requirements must not contain numeric threshold pattern ${pattern}`);
}

await assertNoRuntimeImports("constructor-matrix-exercise-source-requirements");

const summary = buildConstructorMatrixExerciseSourceRequirementSummary();
console.log(JSON.stringify({
  ok: true,
  summary,
  requiredP0FamilyIds,
  requiredP1FamilyIds,
  noRuntimeImports: true,
  runtimePromotionAllowedNow: false,
}, null, 2));
