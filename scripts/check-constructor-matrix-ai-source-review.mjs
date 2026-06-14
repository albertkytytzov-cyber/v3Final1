import { access, readFile } from "node:fs/promises";

import {
  buildConstructorMatrixAiSourceReviewSummary,
  CONSTRUCTOR_MATRIX_AI_REVIEW_POLICY,
  CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS,
  CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES,
  CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE,
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

const aiSourceReviewFile = "packages/shared/src/constructor-matrix-ai-source-review.ts";
const packageJsonFile = "package.json";
const coreCheckFile = "scripts/check-perform-constructor-core.mjs";
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

const allowedStatuses = new Set([
  "verified_identity",
  "verified_public_source",
  "source_text_needed",
  "manual_verification_still_needed",
  "rejected",
]);
const allowedUses = new Set([
  "docs_only",
  "review_export_only",
  "warning_candidate_only",
  "not_allowed",
]);
const allowedConfidence = new Set(["high", "medium", "low"]);
const allowedReviewTracks = new Set([
  "coach",
  "medical",
  "data_quality",
  "sport_science",
  "product_safety",
]);

const sourceLookupById = new Map(
  CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE.map((item) => [item.id, item]),
);
const sourceCandidateIds = new Set(
  CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES.map((item) => item.id),
);
const policyIds = new Set(CONSTRUCTOR_MATRIX_AI_REVIEW_POLICY.map((item) => item.id));

function assertNoFakeHumanReviewText(text, context) {
  const forbidden = [
    /humanReviewed\s*[:=]\s*true/i,
    /\breviewedBy\b/i,
    /\breviewedAt\b/i,
    /\bmedical approved\b/i,
    /\bcoach approved\b/i,
    /\bhuman approved\b/i,
    /\bapproved_for_runtime\b/i,
    /\bapproved for runtime\b/i,
  ];

  for (const pattern of forbidden) {
    assert(!pattern.test(text), `${context} contains forbidden approval text: ${pattern}`);
  }
}

function assertNoNumericRuntimeThresholdText(text, context) {
  const safeNegation =
    /\b(no|not|without)\b.{0,80}\b(numeric threshold|numeric thresholds|threshold promotion|thresholds|cutoff|cutoffs)\b/i;

  if (safeNegation.test(text)) {
    return;
  }

  const forbidden = [
    />=|<=/,
    /\b\d+\s*%/,
    /\b\d+\s*bpm\b/i,
    /\b\d+\s*kg\b/i,
    /\b\d+\s*\/10\b/i,
    /\bexact cutoff\b/i,
    /\bthreshold value approved\b/i,
  ];

  for (const pattern of forbidden) {
    assert(!pattern.test(text), `${context} contains forbidden numeric threshold text: ${pattern}`);
  }
}

function textFields(item) {
  return [
    item.sourceTitle,
    item.sourceUrl ?? "",
    ...item.aiDeskReviewSourceRefs,
    ...item.limitations,
    ...item.forbiddenRuntimeUseNow,
  ];
}

await fileExists(aiSourceReviewFile);
await fileExists(coreCheckFile);

assert(
  CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS.length === CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE.length,
  "AI source reviews must cover every source lookup intake record",
);
assert(
  CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS.length >= 12,
  "AI source reviews must include at least 12 records",
);

const ids = new Set(CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS.map((item) => item.id));
assert(ids.size === CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS.length, "AI source review ids must be unique");

const coveredLookupIds = new Set();

for (const item of CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS) {
  assert(item.id && /^ai_source_review_[a-z0-9_]+$/.test(item.id), `Invalid AI source review id: ${item.id}`);
  const lookup = sourceLookupById.get(item.sourceLookupIntakeId);
  assert(lookup, `${item.id} references unknown sourceLookupIntakeId`);
  assert(item.sourceTitle === lookup.title, `${item.id} must preserve source lookup title`);
  assert(item.sourceUrl === lookup.sourceUrl, `${item.id} must preserve source lookup url`);
  assert(item.sourceType === lookup.reliability, `${item.id} must preserve source reliability as sourceType`);
  assert(allowedStatuses.has(item.aiVerificationStatus), `${item.id} has invalid aiVerificationStatus`);
  assert(item.aiDeskReviewed === true, `${item.id} must have aiDeskReviewed=true`);
  assert(item.aiDeskReviewModel === "Codex AI desk review", `${item.id} has unexpected AI review model`);
  assert(allowedConfidence.has(item.aiDeskReviewConfidence), `${item.id} has invalid AI confidence`);
  assert(Array.isArray(item.aiDeskReviewSourceRefs), `${item.id} must have AI source refs`);
  assert(Array.isArray(item.aiDeskReviewPolicyRuleIds), `${item.id} must have policy rule ids`);
  assert(item.aiDeskReviewPolicyRuleIds.length > 0, `${item.id} must link AI policy rules`);
  assert(item.humanReviewed === false, `${item.id} must have humanReviewed=false`);
  assert(!("reviewedBy" in item), `${item.id} must not include reviewedBy`);
  assert(!("reviewedAt" in item), `${item.id} must not include reviewedAt`);
  assert(Array.isArray(item.limitations) && item.limitations.length > 0, `${item.id} must have limitations`);
  assert(Array.isArray(item.reviewRequired) && item.reviewRequired.length > 0, `${item.id} must have reviewRequired`);
  assert(allowedUses.has(item.allowedUseNow), `${item.id} has invalid allowedUseNow`);
  assert(
    Array.isArray(item.forbiddenRuntimeUseNow) && item.forbiddenRuntimeUseNow.length > 0,
    `${item.id} must have forbidden runtime uses`,
  );
  assert(item.runtimeChangeAllowedNow === false, `${item.id} must have runtimeChangeAllowedNow=false`);

  for (const sourceCandidateId of item.sourceCandidateIds) {
    assert(sourceCandidateIds.has(sourceCandidateId), `${item.id} references unknown source candidate`);
  }
  for (const policyId of item.aiDeskReviewPolicyRuleIds) {
    assert(policyIds.has(policyId), `${item.id} references unknown AI policy rule`);
  }
  for (const track of item.reviewRequired) {
    assert(allowedReviewTracks.has(track), `${item.id} has invalid review track ${track}`);
  }

  if (lookup.extractionReadiness === "needs_manual_verification") {
    assert(
      item.aiVerificationStatus === "manual_verification_still_needed",
      `${item.id} must keep manual verification blocker`,
    );
    assert(
      item.allowedUseNow === "review_export_only",
      `${item.id} manual verification items must stay review_export_only`,
    );
  }

  if (lookup.extractionReadiness === "needs_full_text_or_abstract") {
    assert(
      item.aiVerificationStatus === "source_text_needed",
      `${item.id} must keep source text blocker`,
    );
    assert(
      item.allowedUseNow === "review_export_only",
      `${item.id} source text items must stay review_export_only`,
    );
  }

  if (item.aiVerificationStatus === "verified_public_source") {
    assert(
      lookup.extractionReadiness === "ready_for_claim_extraction",
      `${item.id} cannot become verified_public_source without extraction-ready source lookup`,
    );
  }

  for (const field of textFields(item)) {
    assertNoFakeHumanReviewText(field, item.id);
    assertNoNumericRuntimeThresholdText(field, item.id);
  }

  coveredLookupIds.add(item.sourceLookupIntakeId);
}

assert(
  coveredLookupIds.size === CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE.length,
  "AI source reviews must cover all unique source lookup intake ids",
);

const aiSourceReviewSource = await readProjectFile(aiSourceReviewFile);
const packageJsonSource = await readProjectFile(packageJsonFile);
const coreCheckSource = await readProjectFile(coreCheckFile);

assert(
  packageJsonSource.includes("check:constructor-matrix-ai-source-review"),
  "package.json must expose check:constructor-matrix-ai-source-review",
);
assert(
  coreCheckSource.includes("check-constructor-matrix-ai-source-review.mjs"),
  "constructor core check must be aware of AI source review checker",
);
assert(
  coreCheckSource.includes("constructor-matrix-ai-source-review.ts"),
  "constructor core check must be aware of AI source review source",
);
assert(!/humanReviewed\s*:\s*true/i.test(aiSourceReviewSource), "AI source review source must not set humanReviewed=true");
assert(!/\breviewedBy\b/i.test(aiSourceReviewSource), "AI source review source must not mention reviewedBy");
assert(!/\breviewedAt\b/i.test(aiSourceReviewSource), "AI source review source must not mention reviewedAt");

for (const runtimeFile of runtimeDecisionFiles) {
  const source = await readProjectFile(runtimeFile);
  assert(
    !source.includes("constructor-matrix-ai-source-review") &&
      !source.includes("CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS") &&
      !source.includes("AiSourceReview"),
    `${runtimeFile} must not import AI source review metadata at this stage`,
  );
}

const summary = buildConstructorMatrixAiSourceReviewSummary();
assert(summary.aiSourceReviewCount === CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS.length, "AI source review summary count mismatch");
assert(summary.sourceLookupIntakeCoveredCount === summary.sourceLookupIntakeCount, "AI source review summary coverage mismatch");
assert(summary.sourceTextNeededCount === 12, "AI source review must keep 12 source-text-needed records");
assert(summary.manualVerificationStillNeededCount === 2, "AI source review must keep 2 manual-verification records");
assert(summary.rejectedCount === 0, "AI source review should not reject existing verified intake records");
assert(summary.aiDeskReviewedCount === summary.aiSourceReviewCount, "Every AI source review must be AI desk reviewed");
assert(summary.humanReviewed === false, "AI source review summary must have humanReviewed=false");
assert(summary.runtimeChangeAllowedNow === false, "AI source review summary must have runtimeChangeAllowedNow=false");

console.log(
  JSON.stringify(
    {
      ok: true,
      aiSourceReviewCount: summary.aiSourceReviewCount,
      sourceLookupIntakeCovered: `${summary.sourceLookupIntakeCoveredCount}/${summary.sourceLookupIntakeCount}`,
      byStatus: summary.byStatus,
      byAllowedUseNow: summary.byAllowedUseNow,
      sourceTextNeededCount: summary.sourceTextNeededCount,
      manualVerificationStillNeededCount: summary.manualVerificationStillNeededCount,
      aiDeskReviewedCount: summary.aiDeskReviewedCount,
      humanReviewed: summary.humanReviewed,
      runtimeChangeAllowedNow: summary.runtimeChangeAllowedNow,
    },
    null,
    2,
  ),
);
