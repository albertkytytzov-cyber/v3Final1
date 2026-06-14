import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";

import * as shared from "@training-platform/shared";

const {
  CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP,
  CONSTRUCTOR_MATRIX_FAMILY_ALLOWED_USE_DECISIONS,
  buildConstructorMatrixFamilyAllowedUseSummary,
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

const sourcePath = "packages/shared/src/constructor-matrix-family-allowed-use.ts";
assert(existsSync(projectUrl(sourcePath)), "Family allowed-use source file must exist");
assert(
  CONSTRUCTOR_MATRIX_FAMILY_ALLOWED_USE_DECISIONS.length ===
    CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP.length,
  "Every exercise evidence family must have an allowed-use decision",
);

const familyIds = new Set(CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP.map((item) => item.id));
const ids = new Set();

for (const decision of CONSTRUCTOR_MATRIX_FAMILY_ALLOWED_USE_DECISIONS) {
  assert(!ids.has(decision.familyId), `Duplicate family allowed-use decision ${decision.familyId}`);
  ids.add(decision.familyId);
  assert(familyIds.has(decision.familyId), `${decision.familyId}: unknown family id`);
  assert(decision.humanReviewed === false, `${decision.familyId}: must not be human reviewed`);
  assert(!("reviewedBy" in decision), `${decision.familyId}: must not include reviewedBy`);
  assert(!("reviewedAt" in decision), `${decision.familyId}: must not include reviewedAt`);
  assert(
    decision.runtimePromotionAllowedNow === false,
    `${decision.familyId}: runtime promotion must remain false`,
  );

  if (decision.highRiskAutomationBlocked) {
    assert(
      ["none", "docs_only", "review_export_only"].includes(decision.effectiveRuntimeUseAllowedNow),
      `${decision.familyId}: high-risk family cannot allow runtime plan content`,
    );
    assert(
      ["blocked", "docs_only", "review_export_only", "warning_candidate_only"].includes(
        decision.effectiveAllowedUseNow,
      ),
      `${decision.familyId}: high-risk family cannot become a training candidate`,
    );
  }
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
];

for (const marker of forbiddenMarkers) {
  assert(!source.toLowerCase().includes(marker.toLowerCase()), `Family allowed-use must not contain ${marker}`);
}

await assertNoRuntimeImports("constructor-matrix-family-allowed-use");

console.log(JSON.stringify({
  ok: true,
  summary: buildConstructorMatrixFamilyAllowedUseSummary(),
  highRiskRuntimeBlocked: true,
  runtimePromotionAllowedNow: false,
}, null, 2));
