import { access, readFile } from "node:fs/promises";

import {
  buildConstructorMatrixLayerReviewPackage,
  CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES,
  CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY,
  CONSTRUCTOR_MATRIX_REVIEW_PACKAGE_REQUIRED_THRESHOLD_AREAS,
  CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES,
} from "@training-platform/shared";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fileExists(path) {
  await access(new URL(`../${path}`, import.meta.url));
}

async function readProjectFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const runtimeDecisionFiles = [
  "packages/shared/src/constructor-matrix-plan-builder.ts",
  "packages/shared/src/constructor-matrix-skeleton.ts",
  "packages/shared/src/constructor-matrix-preview.ts",
  "packages/shared/src/constructor-matrix-rollout.ts",
  "packages/shared/src/constructor-matrix-pilot-readiness.ts",
  "packages/shared/src/constructor-matrix-save-dry-run.ts",
  "packages/shared/src/constructor-core.ts",
  "packages/shared/src/constructor-matrix-adapter.ts",
];
const docsToCheck = [
  "docs/constructor-matrix-evidence-dependency-gap-audit.md",
  "docs/perform-constructor-core-stack.md",
  "docs/constructor-phase-matrix-transition-plan.md",
  "docs/constructor-matrix-preview-fixtures.md",
  "docs/constructor-matrix-production-rollout.md",
];
const expectedReviewers = new Set(["coach", "medical", "data_quality"]);
const packageResult = buildConstructorMatrixLayerReviewPackage({
  generatedAt: "2026-06-11T12:00:00.000Z",
});
const payload = packageResult.payload;
const serialized = `${packageResult.json}\n${packageResult.markdown}`;
const thresholdIds = new Set(CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES.map((item) => item.id));
const dataIds = new Set(CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES.map((item) => item.id));
const evidenceIds = new Set(CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY.map((item) => item.id));

function isAllowedNoThresholdSentence(text) {
  return /\b(no|without|not|нет|без)\b.{0,48}\b(numeric threshold|numeric thresholds|threshold value|threshold values|threshold|thresholds|cutoff|cutoffs|hard rule|hard gate)\b/i.test(text);
}

function hasForbiddenThresholdText(text) {
  if (/\bthreshold candidate\b/i.test(text)) {
    return false;
  }

  if (isAllowedNoThresholdSentence(text)) {
    return false;
  }

  return (
    />=|<=|>|</.test(text) ||
    /[0-9]+\s*(%|kg|кг|bpm|уд\/мин|hours?|час)/i.test(text) ||
    /\b[0-9]+\/10\b/i.test(text) ||
    /\b(runtime gate|hard gate|score cutoff|kg limit)\b/i.test(text)
  );
}

await fileExists("packages/shared/src/constructor-matrix-review-package.ts");

assert(
  payload.generatedFrom === "matrix_evidence_data_threshold_review_package",
  "Review package must identify its source",
);
assert(payload.scope.runtimeBehaviorChanged === false, "Runtime behavior must remain unchanged");
assert(payload.scope.productionRouteChanged === false, "Production route must remain unchanged");
assert(payload.scope.rolloutGatesChanged === false, "Rollout gates must remain unchanged");
assert(payload.scope.previewBehaviorChanged === false, "Preview behavior must remain unchanged");
assert(payload.scope.legacyFallbackChanged === false, "Legacy fallback must remain unchanged");
assert(payload.scope.numericThresholdValuesAdded === false, "Numeric threshold values must not be added");
assert(
  payload.summary.evidenceDependencyCount === CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY.length,
  "Review package must include every evidence dependency",
);
assert(
  payload.summary.dataDependencyCount === CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES.length,
  "Review package must include every data dependency",
);
assert(
  payload.summary.thresholdCandidateCount === CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES.length,
  "Review package must include every threshold candidate",
);
assert(payload.summary.thresholdCandidateCount >= 16, "Review package must include at least 16 threshold candidates");
assert(
  payload.summary.requiredThresholdAreasMissing.length === 0,
  `Review package is missing threshold areas: ${payload.summary.requiredThresholdAreasMissing.join(", ")}`,
);

for (const area of CONSTRUCTOR_MATRIX_REVIEW_PACKAGE_REQUIRED_THRESHOLD_AREAS) {
  assert(
    payload.summary.requiredThresholdAreasCovered.includes(area),
    `Required threshold area not covered in review package: ${area}`,
  );
}

const reviewerIds = new Set(payload.reviewerQueues.map((queue) => queue.reviewer));
for (const reviewer of expectedReviewers) {
  assert(reviewerIds.has(reviewer), `Missing reviewer queue: ${reviewer}`);
  const queue = payload.reviewerQueues.find((item) => item.reviewer === reviewer);
  assert(queue?.items.length, `${reviewer} queue must not be empty`);
  assert(queue?.reviewQuestions.length, `${reviewer} queue must include review questions`);
}

for (const candidate of CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES) {
  assert(candidate.fixtureImpact.runtimeChangeAllowedNow === false, `${candidate.id} allows runtime change`);
  assert(candidate.forbiddenRuntimeUseNow.length > 0, `${candidate.id} must list forbidden runtime use`);
  const queueRefs = payload.reviewerQueues.flatMap((queue) =>
    queue.items.filter((item) => item.layer === "threshold_candidate" && item.id === candidate.id),
  );
  assert(queueRefs.length > 0, `${candidate.id} must appear in at least one reviewer queue`);
  for (const dataId of candidate.dataDependencyIds) {
    assert(dataIds.has(dataId), `${candidate.id} references unknown data dependency: ${dataId}`);
  }
  for (const evidenceId of candidate.evidenceDependencyIds) {
    assert(evidenceIds.has(evidenceId), `${candidate.id} references unknown evidence dependency: ${evidenceId}`);
  }
}

for (const item of payload.dataDependencies) {
  assert(dataIds.has(item.id), `Unknown data dependency in review package: ${item.id}`);
  for (const evidenceId of item.evidenceDependencyIds) {
    assert(evidenceIds.has(evidenceId), `${item.id} references unknown evidence dependency: ${evidenceId}`);
  }
}

for (const item of payload.evidenceDependencies) {
  assert(evidenceIds.has(item.id), `Unknown evidence dependency in review package: ${item.id}`);
}

for (const item of payload.thresholdCandidates) {
  assert(thresholdIds.has(item.id), `Unknown threshold candidate in review package: ${item.id}`);
  assert(item.fixtureImpact.runtimeChangeAllowedNow === false, `${item.id} package item allows runtime change`);
}

assert(!/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(serialized), "Review package must not include email-like data");
assert(
  !/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(serialized),
  "Review package must not include UUID-like data",
);
assert(!/\b(?:\+?\d[\s().-]*){9,}\b/.test(serialized), "Review package must not include phone-like data");

for (const text of [
  packageResult.markdown,
  ...payload.evidenceDependencies.flatMap((item) => item.limitations),
  ...payload.dataDependencies.flatMap((item) => item.limitations),
  ...payload.thresholdCandidates.flatMap((item) => [
    item.whyNeeded,
    item.candidateStatement,
    ...item.limitations,
    ...item.forbiddenRuntimeUseNow,
  ]),
]) {
  assert(!hasForbiddenThresholdText(text), `Review package must not define numeric threshold text: ${text}`);
}

assert(packageResult.markdown.includes("Coach Review"), "Markdown must include Coach Review");
assert(packageResult.markdown.includes("Medical Review"), "Markdown must include Medical Review");
assert(packageResult.markdown.includes("Data-Quality Review"), "Markdown must include Data-Quality Review");
assert(
  packageResult.markdown.includes("runtimeBehaviorChanged=false"),
  "Markdown must show runtime behavior guardrail",
);

for (const path of runtimeDecisionFiles) {
  const source = await readProjectFile(path);
  assert(
    !source.includes("constructor-matrix-review-package") &&
      !source.includes("buildConstructorMatrixLayerReviewPackage") &&
      !source.includes("MatrixLayerReviewPackage"),
    `${path} must not import or use Matrix review package in runtime decisioning`,
  );
}

for (const path of docsToCheck) {
  const source = await readProjectFile(path);
  assert(source.includes("Matrix Review Package"), `${path} must document Matrix Review Package`);
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      generatedAt: payload.generatedAt,
      counts: {
        evidenceDependencies: payload.summary.evidenceDependencyCount,
        dataDependencies: payload.summary.dataDependencyCount,
        thresholdCandidates: payload.summary.thresholdCandidateCount,
      },
      reviewers: payload.reviewerQueues.map((queue) => ({
        reviewer: queue.reviewer,
        items: queue.items.length,
      })),
      requiredThresholdAreasMissing: payload.summary.requiredThresholdAreasMissing,
      runtimeBehaviorChanged: payload.scope.runtimeBehaviorChanged,
      numericThresholdValuesAdded: payload.scope.numericThresholdValuesAdded,
      runtimeImportsAdded: false,
    },
    null,
    2,
  ),
);
