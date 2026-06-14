import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";

import * as shared from "@training-platform/shared";

const {
  CONSTRUCTOR_MATRIX_FAMILY_SOURCE_REVIEW_IDS,
  CONSTRUCTOR_MATRIX_P1_FAMILY_EVIDENCE_DOSSIERS,
  buildConstructorMatrixP1FamilyEvidenceDossierSummary,
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

async function walkFiles(path) {
  const root = projectUrl(path);
  const entries = await readdir(root);
  const files = [];

  for (const entry of entries) {
    const entryPath = `${path}/${entry}`;
    const entryStat = await stat(projectUrl(entryPath));

    if (entryStat.isDirectory()) {
      if ([".next", "build", "dist", "node_modules", "tmp"].includes(entry)) continue;
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

const sourcePath = "packages/shared/src/constructor-matrix-p1-family-evidence-dossiers.ts";
assert(existsSync(projectUrl(sourcePath)), "P1 family evidence dossier source must exist");

const requiredP1Families = [
  "seluyanov_statodynamic_lme",
  "speed_endurance_wrestling_density",
  "max_strength",
  "strength_endurance",
  "competition_model_and_controlled_bouts",
  "taper_activation",
  "aerobic_base_low_impact",
];
const sourceReviewIds = new Set(CONSTRUCTOR_MATRIX_FAMILY_SOURCE_REVIEW_IDS);
const ids = new Set();

assert(
  CONSTRUCTOR_MATRIX_P1_FAMILY_EVIDENCE_DOSSIERS.length === requiredP1Families.length,
  "P1 family dossier count must match required P1 family list",
);

for (const familyId of requiredP1Families) {
  assert(
    CONSTRUCTOR_MATRIX_P1_FAMILY_EVIDENCE_DOSSIERS.some((item) => item.familyId === familyId),
    `Missing P1 dossier ${familyId}`,
  );
}

for (const dossier of CONSTRUCTOR_MATRIX_P1_FAMILY_EVIDENCE_DOSSIERS) {
  assert(!ids.has(dossier.familyId), `Duplicate P1 family dossier ${dossier.familyId}`);
  ids.add(dossier.familyId);
  assert(dossier.priority === "P1", `${dossier.familyId}: must be P1`);
  assert(dossier.evidenceSummary, `${dossier.familyId}: missing evidence summary`);
  assert(dossier.sourceReviewIds.length > 0, `${dossier.familyId}: missing source review ids`);
  assert(dossier.rationale, `${dossier.familyId}: missing rationale`);
  assert(dossier.limitations.length > 0, `${dossier.familyId}: missing limitations`);
  assert(dossier.forbiddenRuntimeUses.length > 0, `${dossier.familyId}: missing forbidden runtime uses`);
  assert(dossier.nextReviewActions.length > 0, `${dossier.familyId}: missing next review actions`);
  assert(dossier.humanReviewed === false, `${dossier.familyId}: must not be human reviewed`);
  assert(!("reviewedBy" in dossier), `${dossier.familyId}: must not include reviewedBy`);
  assert(!("reviewedAt" in dossier), `${dossier.familyId}: must not include reviewedAt`);
  assert(dossier.runtimePromotionAllowedNow === false, `${dossier.familyId}: cannot promote runtime now`);
  assert(
    dossier.allowedUseRecommendation === "coach_editable_training_candidate" ||
      dossier.allowedUseRecommendation === "controlled_pilot_training_candidate",
    `${dossier.familyId}: P1 safe training families must stay coach-editable or controlled-pilot only`,
  );
  assert(
    dossier.runtimeUseRecommendation === "coach_editable_plan_content",
    `${dossier.familyId}: P1 safe training family can only expose coach-editable plan content`,
  );

  for (const sourceReviewId of dossier.sourceReviewIds) {
    assert(sourceReviewIds.has(sourceReviewId), `${dossier.familyId}: unknown source review ${sourceReviewId}`);
  }
}

const seluyanov = CONSTRUCTOR_MATRIX_P1_FAMILY_EVIDENCE_DOSSIERS.find(
  (item) => item.familyId === "seluyanov_statodynamic_lme",
);
assert(seluyanov, "Missing Seluyanov/statodynamic P1 dossier");
assert(seluyanov.medicalReviewRequired, "Seluyanov/statodynamic dossier must keep medical review awareness");
assert(
  seluyanov.forbiddenRuntimeUses.some((item) => /BFR\/KAATSU/i.test(item)),
  "Seluyanov/statodynamic dossier must keep BFR/KAATSU prescription forbidden",
);

const source = await readProjectFile(sourcePath);
const forbiddenMarkers = [
  "humanReviewed: true",
  "reviewedBy",
  "reviewedAt",
  "medical approved",
  "coach approved",
  "approved_for_runtime",
  "approved_for_default",
  "et al.",
];

for (const marker of forbiddenMarkers) {
  assert(!source.toLowerCase().includes(marker.toLowerCase()), `P1 dossiers must not contain ${marker}`);
}

await assertNoRuntimeImports("constructor-matrix-p1-family-evidence-dossiers");

console.log(JSON.stringify({
  ok: true,
  summary: buildConstructorMatrixP1FamilyEvidenceDossierSummary(),
  noFakeApprovals: true,
  coachEditableOnly: true,
}, null, 2));
