import { readFile } from "node:fs/promises";

import {
  CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_IDS,
  CONSTRUCTOR_MATRIX_NUTRITION_GUIDANCE,
  CONSTRUCTOR_MATRIX_WEIGHT_MANAGEMENT_GUIDANCE,
  buildConstructorMatrixNutritionGuidanceSummary,
  buildConstructorMatrixWeightManagementGuidanceSummary,
} from "@training-platform/shared";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readProjectFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const evidenceIds = new Set(CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_IDS);
const nutritionSummary = buildConstructorMatrixNutritionGuidanceSummary();
const weightSummary = buildConstructorMatrixWeightManagementGuidanceSummary();

assert(nutritionSummary.guidanceCount >= 10, "Nutrition guidance must include body-composition prompts");
assert(weightSummary.guidanceCount >= 9, "Weight-management guidance must include body-composition prompts");
assert(
  nutritionSummary.guidanceIds.includes("body_composition_meal_pattern_review_prompt"),
  "Nutrition guidance must include body-composition meal pattern prompt",
);
assert(
  nutritionSummary.guidanceIds.includes("muscle_preservation_fueling_prompt"),
  "Nutrition guidance must include muscle-preservation fueling prompt",
);
assert(
  weightSummary.guidanceIds.includes("long_horizon_body_composition_review_prompt"),
  "Weight-management guidance must include long-horizon body-composition prompt",
);
assert(
  weightSummary.guidanceIds.includes("fat_loss_without_rapid_cut_prompt"),
  "Weight-management guidance must include fat-loss without rapid-cut prompt",
);

function validateEvidenceRefs(id, refs) {
  assert(refs.length > 0, `${id}: missing evidence dependency references`);

  for (const ref of refs) {
    assert(evidenceIds.has(ref), `${id}: unknown evidence dependency ${ref}`);
  }
}

for (const item of CONSTRUCTOR_MATRIX_NUTRITION_GUIDANCE) {
  assert(item.id, "Nutrition item missing id");
  assert(item.title, `${item.id}: missing title`);
  assert(item.guidance.length > 0, `${item.id}: missing guidance`);
  assert(item.rationale, `${item.id}: missing rationale`);
  assert(item.forbiddenUses.length > 0, `${item.id}: missing forbidden uses`);
  assert(item.limitations.includes("not medical advice"), `${item.id}: must state not medical advice`);
  validateEvidenceRefs(item.id, item.evidenceDependencyIds);

  if (item.highRiskBlocked) {
    assert(item.allowedUseNow === "review_prompt", `${item.id}: high-risk nutrition item must be review prompt only`);
    assert(item.reviewRequired.includes("medical"), `${item.id}: high-risk nutrition item must require medical review`);
  }
}

for (const item of CONSTRUCTOR_MATRIX_WEIGHT_MANAGEMENT_GUIDANCE) {
  assert(item.id, "Weight-management item missing id");
  assert(item.title, `${item.id}: missing title`);
  assert(item.guidance.length > 0, `${item.id}: missing guidance`);
  assert(item.requiredContext.length > 0, `${item.id}: missing required context`);
  assert(item.forbiddenUses.length > 0, `${item.id}: missing forbidden uses`);
  assert(item.limitations.includes("not medical advice"), `${item.id}: must state not medical advice`);
  validateEvidenceRefs(item.id, item.evidenceDependencyIds);

  if (item.highRiskBlocked || item.status === "blocked_do_not_automate") {
    assert(item.allowedUseNow !== "educational_guidance", `${item.id}: blocked item cannot be plain educational guidance`);
    assert(item.reviewRequired.length > 0, `${item.id}: blocked item must require review`);
  }
}

const guidanceText = JSON.stringify({
  nutrition: CONSTRUCTOR_MATRIX_NUTRITION_GUIDANCE.map((item) => item.guidance),
  weight: CONSTRUCTOR_MATRIX_WEIGHT_MANAGEMENT_GUIDANCE.map((item) => item.guidance),
}).toLowerCase();
const unsafeActionMarkers = [
  "use sauna",
  "prescribe sauna",
  "water restriction",
  "water cut",
  "use diuretic",
  "take diuretic",
  "use laxative",
  "take laxative",
  "wear sweat suit",
  "spitting",
  "cleared to cut",
  "dehydration protocol",
  "rapid weight cut protocol",
  "automatic fat loss prescription",
];

for (const marker of unsafeActionMarkers) {
  assert(!guidanceText.includes(marker), `Guidance must not contain unsafe action marker: ${marker}`);
}

const combinedSource = [
  await readProjectFile("packages/shared/src/constructor-matrix-nutrition-guidance.ts"),
  await readProjectFile("packages/shared/src/constructor-matrix-weight-management-guidance.ts"),
].join("\n");
const forbiddenSourceMarkers = [
  "humanReviewed: true",
  "reviewedBy",
  "reviewedAt",
  "medical approved",
  "coach approved",
  "approved_for_runtime",
];

for (const marker of forbiddenSourceMarkers) {
  assert(!combinedSource.toLowerCase().includes(marker.toLowerCase()), `Guidance source must not contain ${marker}`);
}

console.log(JSON.stringify({
  ok: true,
  nutrition: nutritionSummary,
  weightManagement: weightSummary,
  noUnsafeRapidWeightCutAutomation: true,
  notMedicalAdvice: true,
}, null, 2));
