import { access } from "node:fs/promises";

import {
  CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES,
  CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY,
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
const dataIds = new Set(CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES.map((item) => item.id));
const allowedRuntimeUse = new Set([
  "none",
  "documentation_only",
  "risk_warning_only",
  "pilot_readiness_only",
  "future_gate",
]);
const highRiskDataAreas = new Set([
  "weight_cut",
  "hydration",
  "injury",
  "pain",
  "female_context",
  "youth_context",
  "wearable_data",
  "hrv",
  "contact_load",
  "lmv",
  "taper",
]);
const conservativeMissingDataBehaviors = new Set([
  "require_coach_confirmation",
  "require_medical_confirmation",
  "use_low_risk_replacement",
  "advisory_only",
]);
const requiredAreas = new Set([
  "weight_cut",
  "hydration",
  "readiness",
  "wearable_data",
  "sleep",
  "rhr",
  "hrv",
  "pain",
  "injury",
  "female_context",
  "youth_context",
  "travel_fatigue",
  "competition_context",
  "contact_load",
  "lmv",
  "taper",
]);

function hasForbiddenThreshold(text) {
  const normalized = text.toLowerCase();

  if (/\b(no|without|not|нет|без)\b.{0,32}\b(threshold|thresholds|cutoff|cutoffs|numeric thresholds)\b/i.test(text)) {
    return false;
  }

  return (
    />=|<=/.test(text) ||
    /%/.test(text) ||
    /\b(threshold|cutoff|bpm|hours minimum|kg limit)\b/i.test(normalized)
  );
}

function validateNoThresholds(item) {
  const textFields = [
    item.title,
    ...item.requiredFields,
    ...item.optionalFields,
    ...item.limitations,
  ];

  for (const text of textFields) {
    assert(
      !hasForbiddenThreshold(text),
      `${item.id} must remain metadata-only and must not define threshold text: ${text}`,
    );
  }
}

await fileExists("packages/shared/src/constructor-matrix-data-dependencies.ts");

assert(
  CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES.length > 0,
  "CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES must not be empty",
);
assert(
  dataIds.size === CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES.length,
  "Data dependency registry must not contain duplicate ids",
);

const coveredAreas = new Set();
const missingBehaviorSummary = {};

for (const item of CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES) {
  assert(/^[a-z0-9_]+$/.test(item.id), `Data dependency id must be snake_case: ${item.id}`);
  assert(item.area, `${item.id} must have area`);
  assert(item.title.trim().length > 0, `${item.id} must have title`);
  assert(Array.isArray(item.requiredFields) && item.requiredFields.length > 0, `${item.id} must have requiredFields`);
  assert(Array.isArray(item.optionalFields), `${item.id} must have optionalFields array`);
  assert(item.currentAvailability, `${item.id} must have currentAvailability`);
  assert(item.missingDataBehavior, `${item.id} must have missingDataBehavior`);
  assert(allowedRuntimeUse.has(item.runtimeUseNow), `${item.id} has unsupported runtimeUseNow: ${item.runtimeUseNow}`);
  assert(Array.isArray(item.supportsEvidenceDependencies), `${item.id} must have supportsEvidenceDependencies array`);
  assert(item.supportsEvidenceDependencies.length > 0, `${item.id} must reference evidence dependencies`);
  assert(Array.isArray(item.limitations) && item.limitations.length > 0, `${item.id} must have limitations`);

  for (const evidenceId of item.supportsEvidenceDependencies) {
    assert(evidenceIds.has(evidenceId), `${item.id} references unknown evidence dependency: ${evidenceId}`);
  }

  if (highRiskDataAreas.has(item.area)) {
    assert(
      conservativeMissingDataBehaviors.has(item.missingDataBehavior),
      `${item.id} high-risk data dependency needs conservative missingDataBehavior`,
    );
  }

  validateNoThresholds(item);
  coveredAreas.add(item.area);
  missingBehaviorSummary[item.area] = item.missingDataBehavior;
}

for (const area of requiredAreas) {
  assert(coveredAreas.has(area), `Missing required data dependency area: ${area}`);
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      dependencyCount: CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES.length,
      requiredAreas: Array.from(requiredAreas),
      coveredAreas: Array.from(coveredAreas),
      runtimeUseNow: Array.from(new Set(CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES.map((item) => item.runtimeUseNow))),
      missingDataBehavior: missingBehaviorSummary,
      numericThresholdsAdded: false,
    },
    null,
    2,
  ),
);
