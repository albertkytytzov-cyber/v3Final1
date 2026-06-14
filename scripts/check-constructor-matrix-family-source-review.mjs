import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";

import * as shared from "@training-platform/shared";

const {
  CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP,
  CONSTRUCTOR_MATRIX_FAMILY_SOURCE_REVIEWS,
  buildConstructorMatrixFamilySourceReviewSummary,
  validateConstructorMatrixFamilySourceReviewCoverage,
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

const sourcePath = "packages/shared/src/constructor-matrix-family-source-review.ts";
assert(existsSync(projectUrl(sourcePath)), "Family source review registry must exist");
assert(CONSTRUCTOR_MATRIX_FAMILY_SOURCE_REVIEWS.length > 0, "Family source review registry must not be empty");

const familyIds = new Set(CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP.map((item) => item.id));
const ids = new Set();
const allowedPmids = new Set([
  "17277604",
  "26891166",
  "35492609",
  "29345524",
  "32897239",
  "37752011",
  "27226389",
  "26933920",
  "31156448",
  "37163550",
  "37752006",
  "19204579",
  "28030533",
]);
const allowedDois = new Set([
  "10.1249/mss.0b013e31802ca597",
  "10.1249/MSS.0000000000000852",
  "10.3389/fphys.2022.830229",
  "10.1123/ijspp.2017-0759",
  "10.2196/18694",
  "10.1136/bjsports-2023-106994",
  "10.1136/bjsports-2016-096278",
  "10.1519/JSC.0000000000001387",
  "10.3389/fphys.2019.00533",
  "10.1371/journal.pone.0282838",
  "10.1136/bjsports-2023-106812",
]);

for (const review of CONSTRUCTOR_MATRIX_FAMILY_SOURCE_REVIEWS) {
  assert(!ids.has(review.id), `Duplicate source review id: ${review.id}`);
  ids.add(review.id);
  assert(familyIds.has(review.familyId), `${review.id}: unknown family ${review.familyId}`);
  assert(review.sourceTitle, `${review.id}: missing source title`);
  assert(review.sourceType, `${review.id}: missing source type`);
  assert(review.verificationStatus, `${review.id}: missing verification status`);
  assert(review.reviewedBy === "AI desk review", `${review.id}: reviewedBy must be AI desk review only`);
  assert(review.aiDeskReviewed === true, `${review.id}: must be AI desk reviewed`);
  assert(review.humanReviewed === false, `${review.id}: must not be human reviewed`);
  assert(!("reviewedAt" in review), `${review.id}: must not contain reviewedAt`);
  assert(review.runtimePromotionAllowedNow === false, `${review.id}: cannot allow runtime promotion now`);
  assert(review.limitations.length > 0, `${review.id}: missing limitations`);
  assert(review.forbiddenUses.length > 0, `${review.id}: missing forbidden uses`);

  if (review.pmid) {
    assert(allowedPmids.has(review.pmid), `${review.id}: unverified PMID ${review.pmid}`);
  }

  if (review.doi) {
    assert(allowedDois.has(review.doi), `${review.id}: unverified DOI ${review.doi}`);
  }

  if (review.allowedUseNow === "blocked") {
    assert(
      ["none", "not_ready", "needs_manual_verification"].some((marker) =>
        [review.extractionReadiness, review.allowedUseNow].includes(marker),
      ) || review.forbiddenUses.length > 0,
      `${review.id}: blocked item must carry explicit blockers`,
    );
  }
}

const highRiskFamilyIds = new Set(
  CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP.filter((item) => item.highRiskAutomationBlocked).map((item) => item.id),
);
for (const review of CONSTRUCTOR_MATRIX_FAMILY_SOURCE_REVIEWS.filter((item) => highRiskFamilyIds.has(item.familyId))) {
  assert(
    ["blocked", "review_export_only", "warning_candidate_only"].includes(review.allowedUseNow),
    `${review.id}: high-risk family source review cannot allow plan content`,
  );
}

const coverage = validateConstructorMatrixFamilySourceReviewCoverage();
assert(coverage.ok, `Family source review coverage incomplete: ${JSON.stringify(coverage)}`);

const source = await readProjectFile(sourcePath);
const forbiddenTextMarkers = [
  "humanReviewed: true",
  "reviewedAt",
  "medical approved",
  "coach approved",
  "approved_for_runtime",
  "approved_for_default",
  "et al.",
];

for (const marker of forbiddenTextMarkers) {
  assert(!source.toLowerCase().includes(marker.toLowerCase()), `Family source review must not contain ${marker}`);
}

await assertNoRuntimeImports("constructor-matrix-family-source-review");

console.log(JSON.stringify({
  ok: true,
  summary: buildConstructorMatrixFamilySourceReviewSummary(),
  noFakeApprovals: true,
  noRuntimeImports: true,
}, null, 2));
