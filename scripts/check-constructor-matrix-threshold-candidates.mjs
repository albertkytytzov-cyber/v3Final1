import { access } from "node:fs/promises";

import {
  CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES,
  CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY,
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

const evidenceIds = new Set(CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY.map((item) => item.id));
const dataDependencyIds = new Set(CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES.map((item) => item.id));
const candidateIds = new Set(CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES.map((item) => item.id));
const allowedRuntimeUseNow = new Set([
  "none",
  "documentation_only",
  "review_queue_only",
  "future_candidate",
]);
const blockedRuntimeStatuses = new Set([
  "approved_for_runtime",
  "approved_for_hard_rule",
  "auto_allowed",
  "hard_gate",
  "runtime_gate",
]);
const highRiskAreas = new Set([
  "weight_cut",
  "hydration",
  "pain",
  "injury",
  "female_context",
  "youth_context",
]);
const requiredAreas = new Set([
  "weight_cut",
  "hydration",
  "readiness",
  "sleep",
  "rhr",
  "wearable_data",
  "pain",
  "injury",
  "female_context",
  "youth_context",
  "travel_fatigue",
  "competition_context",
]);

function collectText(item) {
  return [
    item.id,
    item.title,
    item.signalType,
    item.candidateDirection,
    item.decisionScope,
    item.runtimeUseNow,
    item.reviewStatus,
    item.missingDataBehavior,
    ...item.requiredDataDependencies,
    ...item.supportsEvidenceDependencies,
    ...item.reviewRequired,
    ...item.limitations,
    ...item.futureValidationQuestions,
  ];
}

function isAllowedNoThresholdSentence(text) {
  return /\b(no|without|not|нет|без)\b.{0,40}\b(numeric threshold|numeric thresholds|threshold|thresholds|cutoff|cutoffs|hard rule|hard gate)\b/i.test(text);
}

function hasForbiddenThresholdText(text) {
  if (isAllowedNoThresholdSentence(text)) {
    return false;
  }

  return (
    />=|<=/.test(text) ||
    /[0-9]+\s*(%|kg|кг|bpm|уд\/мин|hours?|час)/i.test(text) ||
    /\b(threshold|cutoff|bpm|kg limit|score cutoff|runtime gate|hard gate)\b/i.test(text)
  );
}

await fileExists("packages/shared/src/constructor-matrix-threshold-candidates.ts");

assert(
  CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES.length > 0,
  "CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES must not be empty",
);
assert(
  candidateIds.size === CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES.length,
  "Threshold candidate registry must not contain duplicate ids",
);

const coveredAreas = new Set();
const runtimeUseNow = new Set();
const reviewStatuses = new Set();

for (const item of CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES) {
  assert(/^[a-z0-9_]+$/.test(item.id), `Threshold candidate id must be snake_case: ${item.id}`);
  assert(item.candidateOnly === true, `${item.id} must be candidateOnly=true`);
  assert(item.area, `${item.id} must have area`);
  assert(item.title.trim().length > 0, `${item.id} must have title`);
  assert(item.signalType, `${item.id} must have signalType`);
  assert(item.candidateDirection, `${item.id} must have candidateDirection`);
  assert(item.decisionScope, `${item.id} must have decisionScope`);
  assert(Array.isArray(item.requiredDataDependencies) && item.requiredDataDependencies.length > 0, `${item.id} must have requiredDataDependencies`);
  assert(Array.isArray(item.supportsEvidenceDependencies) && item.supportsEvidenceDependencies.length > 0, `${item.id} must have supportsEvidenceDependencies`);
  assert(Array.isArray(item.reviewRequired) && item.reviewRequired.length > 0, `${item.id} must have reviewRequired`);
  assert(Array.isArray(item.limitations) && item.limitations.length > 0, `${item.id} must have limitations`);
  assert(Array.isArray(item.futureValidationQuestions) && item.futureValidationQuestions.length > 0, `${item.id} must have futureValidationQuestions`);
  assert(allowedRuntimeUseNow.has(item.runtimeUseNow), `${item.id} has unsafe runtimeUseNow: ${item.runtimeUseNow}`);
  assert(!blockedRuntimeStatuses.has(item.reviewStatus), `${item.id} has runtime-like reviewStatus: ${item.reviewStatus}`);
  assert(item.reviewStatus !== "approved_for_runtime", `${item.id} must not be approved for runtime`);

  for (const dataDependencyId of item.requiredDataDependencies) {
    assert(
      dataDependencyIds.has(dataDependencyId),
      `${item.id} references unknown data dependency: ${dataDependencyId}`,
    );
  }

  for (const evidenceId of item.supportsEvidenceDependencies) {
    assert(
      evidenceIds.has(evidenceId),
      `${item.id} references unknown evidence dependency: ${evidenceId}`,
    );
  }

  for (const text of collectText(item)) {
    assert(!hasForbiddenThresholdText(text), `${item.id} must not define numeric threshold text: ${text}`);
  }

  if (highRiskAreas.has(item.area)) {
    assert(
      item.reviewRequired.includes("coach") || item.reviewRequired.includes("medical"),
      `${item.id} high-risk candidate needs coach or medical review`,
    );
    assert(
      item.reviewStatus === "needs_coach_review" ||
        item.reviewStatus === "needs_medical_review" ||
        item.reviewStatus === "blocked_for_runtime",
      `${item.id} high-risk candidate must stay review-required or blocked for runtime`,
    );
  }

  coveredAreas.add(item.area);
  runtimeUseNow.add(item.runtimeUseNow);
  reviewStatuses.add(item.reviewStatus);
}

for (const area of requiredAreas) {
  assert(coveredAreas.has(area), `Missing required threshold candidate area: ${area}`);
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      candidateCount: CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES.length,
      coveredAreas: Array.from(coveredAreas),
      runtimeUseNow: Array.from(runtimeUseNow),
      reviewStatuses: Array.from(reviewStatuses),
      numericThresholdsAdded: false,
      runtimeBehaviorChanged: false,
    },
    null,
    2,
  ),
);
