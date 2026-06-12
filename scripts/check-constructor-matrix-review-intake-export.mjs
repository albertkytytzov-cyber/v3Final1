import { access, readFile } from "node:fs/promises";

import {
  buildConstructorMatrixLayerReviewPackage,
  buildConstructorMatrixReviewIntakeExportPack,
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES,
  renderConstructorMatrixReviewAudienceMarkdown,
  renderConstructorMatrixReviewIntakeExportMarkdown,
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

const reviewIntakeExportFile =
  "packages/shared/src/constructor-matrix-review-intake-export.ts";
const exportDir = "docs/matrix-review-intake-export";
const requiredExportFiles = [
  "README.md",
  "review-intake-export.json",
  "all-review-items.md",
  "manual-source-verification.md",
  "source-text-acquisition.md",
  "coach-review.md",
  "medical-review.md",
  "data-quality-review.md",
  "sport-science-review.md",
  "product-safety-review.md",
];
const audienceFiles = {
  manual_source_verification: "manual-source-verification.md",
  source_text_acquisition: "source-text-acquisition.md",
  coach: "coach-review.md",
  medical: "medical-review.md",
  data_quality: "data-quality-review.md",
  sport_science: "sport-science-review.md",
  product_safety: "product-safety-review.md",
};
const allowedAudiences = new Set(Object.keys(audienceFiles));
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
const runtimeImportPatterns = [
  "constructor-matrix-review-intake-export",
  "buildConstructorMatrixReviewIntakeExportPack",
  "ReviewIntakeExportPack",
];
const fakeApprovalPatterns = [
  /humanReviewed\s*=\s*true/i,
  /"humanReviewed"\s*:\s*true/i,
  /\breviewedBy\b/i,
  /\breviewedAt\b/i,
  /\bapproved by\b/i,
  /\bapproved_for_runtime\b/i,
  /\breviewer signed\b/i,
  /\bcompleted review\b/i,
];
const runtimePromotionPatterns = [
  /runtimeChangeAllowedNow\s*=\s*true/i,
  /"runtimeChangeAllowedNow"\s*:\s*true/i,
  /\bMatrix default enabled\b/i,
  /\bproduction route changed\b/i,
  /\brollout gate changed\b/i,
  /\bpromoted to runtime\b/i,
];
const piiPatterns = [
  /\bdate of birth\b/i,
  /\bpassport\b/i,
  /\bphone\b/i,
  /\bemail\b/i,
  /\baddress\b/i,
  /\bmedical record\b/i,
  /\bproduction user id\b/i,
  /\bathlete name\b/i,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /\b(?:\+?\d[\s().-]*){9,}\b/,
];

function hasAllowedNoThresholdPhrase(text) {
  return /\b(no|not|without)\b.{0,80}\b(numeric threshold|threshold value|runtime threshold|cutoff)\b/i.test(text);
}

function hasForbiddenThresholdText(text) {
  if (hasAllowedNoThresholdPhrase(text) || /\bthreshold candidate\b/i.test(text)) {
    return false;
  }

  return (
    />=|<=/.test(text) ||
    /\bgreater than\b/i.test(text) ||
    /\bless than\b/i.test(text) ||
    /%/.test(text) ||
    /\bbpm\b/i.test(text) ||
    /\bkg\b/i.test(text) ||
    /\b\/10\b/.test(text) ||
    /\b(cutoff value|hard threshold)\b/i.test(text)
  );
}

function assertSafeText(text, context) {
  for (const pattern of fakeApprovalPatterns) {
    assert(!pattern.test(text), `${context} contains fake approval marker: ${pattern}`);
  }
  for (const pattern of runtimePromotionPatterns) {
    assert(!pattern.test(text), `${context} contains runtime promotion marker: ${pattern}`);
  }
  for (const pattern of piiPatterns) {
    assert(!pattern.test(text), `${context} contains sensitive data marker: ${pattern}`);
  }
  assert(!hasForbiddenThresholdText(text), `${context} contains numeric threshold text`);
}

await fileExists(reviewIntakeExportFile);
await fileExists(exportDir);

for (const file of requiredExportFiles) {
  await fileExists(`${exportDir}/${file}`);
}

const expectedPack = buildConstructorMatrixReviewIntakeExportPack();
const exportJsonText = await readProjectFile(`${exportDir}/review-intake-export.json`);
const exportJson = JSON.parse(exportJsonText);

assert(
  exportJsonText === `${JSON.stringify(expectedPack, null, 2)}\n`,
  "review-intake-export.json must match builder output",
);
assert(
  exportJson.generatedFrom === "constructor_matrix_evidence_claim_review_intake",
  "Export JSON must identify source",
);
assert(exportJson.runtimeChangeAllowedNow === false, "Export JSON must keep runtimeChangeAllowedNow=false");
assert(exportJson.humanReviewed === false, "Export JSON must keep humanReviewed=false");
assert(exportJson.summary, "Export JSON must include summary");
assert(Array.isArray(exportJson.items), "Export JSON must include items");
assert(Array.isArray(exportJson.guardrails), "Export JSON must include guardrails");

const intakeIds = new Set(CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES.map((item) => item.id));
const exportedIntakeIds = new Set();
const itemIds = new Set();
const audiencesInItems = new Set();

for (const item of exportJson.items) {
  assert(item.id && /^[a-z0-9_]+$/.test(item.id), `Invalid export item id: ${item.id}`);
  assert(item.intakeId && intakeIds.has(item.intakeId), `${item.id} references unknown intake`);
  assert(allowedAudiences.has(item.audience), `${item.id} has invalid audience`);
  assert(typeof item.title === "string" && item.title.length > 0, `${item.id} must have title`);
  assert(typeof item.status === "string" && item.status.length > 0, `${item.id} must have status`);
  assert(
    typeof item.blockerSummary === "string" && item.blockerSummary.length > 0,
    `${item.id} must have blockerSummary`,
  );
  assert(Array.isArray(item.reviewerQuestions) && item.reviewerQuestions.length > 0, `${item.id} must have questions`);
  assert(Array.isArray(item.requiredArtifacts) && item.requiredArtifacts.length > 0, `${item.id} must have artifacts`);
  assert(Array.isArray(item.allowedOutcomes) && item.allowedOutcomes.length > 0, `${item.id} must have outcomes`);
  assert(Array.isArray(item.prohibitedActions) && item.prohibitedActions.length > 0, `${item.id} must have prohibited actions`);
  assert(typeof item.nextAction === "string" && item.nextAction.length > 0, `${item.id} must have nextAction`);
  assert(item.runtimeChangeAllowedNow === false, `${item.id} must keep runtimeChangeAllowedNow=false`);
  assert(item.humanReviewed === false, `${item.id} must keep humanReviewed=false`);

  for (const key of [
    "linkedBlockerIds",
    "linkedSourceLookupIntakeIds",
    "linkedSourceCandidateIds",
    "linkedSourceExpansionBacklogIds",
    "linkedEvidenceDependencyIds",
    "linkedDataDependencyIds",
    "linkedThresholdCandidateIds",
    "linkedReviewDecisionIds",
  ]) {
    assert(Array.isArray(item[key]), `${item.id} must include ${key}`);
  }

  assert(!itemIds.has(item.id), `Duplicate export item id: ${item.id}`);
  itemIds.add(item.id);
  exportedIntakeIds.add(item.intakeId);
  audiencesInItems.add(item.audience);
  assertSafeText(JSON.stringify(item), item.id);
}

for (const intakeId of intakeIds) {
  assert(exportedIntakeIds.has(intakeId), `Intake missing from export: ${intakeId}`);
}

for (const [audience, fileName] of Object.entries(audienceFiles)) {
  assert(audiencesInItems.has(audience), `Audience missing from export items: ${audience}`);
  const audienceText = await readProjectFile(`${exportDir}/${fileName}`);
  assert(
    audienceText === `${renderConstructorMatrixReviewAudienceMarkdown(expectedPack, audience)}\n`,
    `${fileName} must match audience markdown renderer`,
  );
  assert(audienceText.includes(`audience=${audience}`), `${fileName} must include audience marker`);
  assert(audienceText.includes("## review_export_"), `${fileName} must contain at least one item`);
  assertSafeText(audienceText, fileName);
}

const allMarkdown = await readProjectFile(`${exportDir}/all-review-items.md`);
assert(
  allMarkdown === `${renderConstructorMatrixReviewIntakeExportMarkdown(expectedPack)}\n`,
  "all-review-items.md must match markdown renderer",
);
assertSafeText(allMarkdown, "all-review-items.md");
assertSafeText(exportJsonText, "review-intake-export.json");
assertSafeText(await readProjectFile(`${exportDir}/README.md`), "README.md");

const reviewIntakeExportSource = await readProjectFile(reviewIntakeExportFile);
assert(
  reviewIntakeExportSource.includes("buildConstructorMatrixReviewIntakeExportPack"),
  "Review intake export source must define builder",
);

for (const file of runtimeDecisionFiles) {
  const text = await readProjectFile(file);
  for (const pattern of runtimeImportPatterns) {
    assert(!text.includes(pattern), `${file} must not import review intake export metadata`);
  }
}

const packageJson = JSON.parse(await readProjectFile("package.json"));
assert(
  packageJson.scripts?.["check:constructor-matrix-review-intake-export"] ===
    "node scripts/check-constructor-matrix-review-intake-export.mjs",
  "package.json must define check:constructor-matrix-review-intake-export",
);

const coreCheckText = await readProjectFile("scripts/check-perform-constructor-core.mjs");
assert(
  coreCheckText.includes("check-constructor-matrix-review-intake-export.mjs"),
  "constructor core check must be aware of review intake export script",
);
assert(
  coreCheckText.includes("constructor-matrix-review-intake-export.ts"),
  "constructor core check must be aware of review intake export source file",
);
assert(
  coreCheckText.includes("docs/matrix-review-intake-export/README.md"),
  "constructor core check must be aware of review intake export README",
);

const reviewPackage = buildConstructorMatrixLayerReviewPackage({
  generatedAt: "review-intake-export-check",
});
assert(
  reviewPackage.payload.reviewIntakeExport.reviewIntakeExportItemCount ===
    expectedPack.summary.exportItemCount,
  "Review package must include review intake export item count",
);
assert(
  reviewPackage.payload.reviewIntakeExport.reviewIntakeExportRuntimeChangeAllowedNowCount === 0,
  "Review package must report zero review intake export runtime changes",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      exportItemCount: expectedPack.summary.exportItemCount,
      intakeCount: expectedPack.summary.intakeCount,
      itemsByAudience: expectedPack.summary.itemsByAudience,
      runtimeChangeAllowedNow: expectedPack.runtimeChangeAllowedNow,
      humanReviewed: expectedPack.humanReviewed,
    },
    null,
    2,
  ),
);
