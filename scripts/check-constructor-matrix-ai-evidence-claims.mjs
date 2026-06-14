import { access, readFile } from "node:fs/promises";

import {
  buildConstructorMatrixAiEvidenceClaimSummary,
  CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS,
  CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS,
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES,
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

const aiEvidenceClaimsFile = "packages/shared/src/constructor-matrix-ai-evidence-claims.ts";
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
  "ai_extracted_conservative_claim",
  "blocked_source_text_needed",
  "blocked_manual_verification_needed",
  "human_review_required",
  "do_not_automate",
]);
const allowedCategories = new Set([
  "plan_structure_support",
  "taper_context",
  "recovery_caution",
  "travel_fatigue_caution",
  "data_quality_warning",
  "source_limitation_warning",
  "coach_review_needed_warning",
  "medical_review_needed_warning",
]);
const allowedUses = new Set([
  "none",
  "docs_only",
  "review_export_only",
  "soft_warning_candidate",
  "plan_structure_hint_candidate",
  "fallback_guard_candidate",
]);
const highRiskMedicalAreas = new Set([
  "weight_cut",
  "hydration",
  "pain",
  "injury",
  "injury_pain",
  "female_context",
  "RED-S",
  "youth_context",
  "bfr_kaatsu",
]);

const candidateIds = new Set(CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES.map((item) => item.id));
const aiSourceReviewIds = new Set(CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS.map((item) => item.id));

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

function assertNoForbiddenRuntimeText(text, context) {
  const safeNegation =
    /\b(no|not|without|cannot)\b.{0,100}\b(runtime hard gate|runtime rule|diagnosis|prescription|medical clearance|injury-return clearance|numeric threshold|threshold|cutoff|Matrix default)\b/i;

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
    /\bmedical clearance\b/i,
    /\binjury-return clearance\b/i,
    /\bdehydration diagnosis\b/i,
    /\bRED-S diagnosis\b/i,
    /\bBFR\/KAATSU prescription\b/i,
  ];

  for (const pattern of forbidden) {
    assert(!pattern.test(text), `${context} contains forbidden runtime text: ${pattern}`);
  }
}

function textFields(item) {
  return [
    item.title,
    item.claimText,
    ...item.sourceRefs,
    ...item.supports,
    ...item.limitations,
    ...item.aiDeskReviewLimitations,
  ];
}

await fileExists(aiEvidenceClaimsFile);
await fileExists(coreCheckFile);

assert(
  CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS.length ===
    CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES.length,
  "AI evidence claims must cover every claim candidate",
);

const ids = new Set(CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS.map((item) => item.id));
assert(ids.size === CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS.length, "AI evidence claim ids must be unique");

const coveredCandidateIds = new Set();

for (const item of CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS) {
  assert(item.id && /^ai_claim_[a-z0-9_]+$/.test(item.id), `Invalid AI evidence claim id: ${item.id}`);
  assert(allowedStatuses.has(item.status), `${item.id} has invalid status`);
  assert(allowedCategories.has(item.category), `${item.id} has invalid category`);
  assert(candidateIds.has(item.claimCandidateId), `${item.id} references unknown claim candidate`);
  assert(typeof item.title === "string" && item.title.length > 0, `${item.id} must have title`);
  assert(typeof item.claimText === "string" && item.claimText.length > 0, `${item.id} must have claimText`);
  assert(Array.isArray(item.sourceLookupIntakeIds), `${item.id} must have sourceLookupIntakeIds`);
  assert(Array.isArray(item.aiSourceReviewIds), `${item.id} must have aiSourceReviewIds`);
  assert(Array.isArray(item.sourceCandidateIds) && item.sourceCandidateIds.length > 0, `${item.id} must have sourceCandidateIds`);
  assert(Array.isArray(item.evidenceDependencyIds), `${item.id} must have evidenceDependencyIds`);
  assert(Array.isArray(item.dataDependencyIds), `${item.id} must have dataDependencyIds`);
  assert(Array.isArray(item.thresholdCandidateIds), `${item.id} must have thresholdCandidateIds`);
  assert(Array.isArray(item.reviewDecisionIds), `${item.id} must have reviewDecisionIds`);
  assert(Array.isArray(item.blockerIds), `${item.id} must have blockerIds`);
  assert(Array.isArray(item.methodOrRiskArea) && item.methodOrRiskArea.length > 0, `${item.id} must have risk areas`);
  assert(Array.isArray(item.limitations) && item.limitations.length > 0, `${item.id} must have limitations`);
  assert(Array.isArray(item.reviewRequired) && item.reviewRequired.length > 0, `${item.id} must have reviewRequired`);
  assert(allowedUses.has(item.allowedUseNow), `${item.id} has invalid allowedUseNow`);
  assert(Array.isArray(item.forbiddenRuntimeUseNow) && item.forbiddenRuntimeUseNow.length > 0, `${item.id} must have forbidden runtime uses`);
  assert(item.aiDeskReviewed === true, `${item.id} must be AI desk reviewed`);
  assert(item.aiDeskReviewModel === "Codex AI desk review", `${item.id} has unexpected AI review model`);
  assert(item.candidateOnly === true, `${item.id} must remain candidate-only`);
  assert(item.finalEvidenceClaim === false, `${item.id} must not be a final evidence claim`);
  assert(item.humanReviewed === false, `${item.id} must have humanReviewed=false`);
  assert(!("reviewedBy" in item), `${item.id} must not include reviewedBy`);
  assert(!("reviewedAt" in item), `${item.id} must not include reviewedAt`);
  assert(item.runtimeChangeAllowedNow === false, `${item.id} must have runtimeChangeAllowedNow=false`);

  for (const aiSourceReviewId of item.aiSourceReviewIds) {
    assert(aiSourceReviewIds.has(aiSourceReviewId), `${item.id} references unknown AI source review`);
  }

  const hasHighRiskMedicalArea = item.methodOrRiskArea.some((area) =>
    highRiskMedicalAreas.has(area),
  );
  if (hasHighRiskMedicalArea) {
    assert(
      item.category === "medical_review_needed_warning",
      `${item.id} high-risk medical items must be medical-review-needed warnings`,
    );
    assert(
      item.allowedUseNow === "review_export_only",
      `${item.id} high-risk medical items must stay review_export_only`,
    );
  }

  if (item.status === "blocked_source_text_needed") {
    assert(
      item.claimText.includes("Source text") || item.claimText.includes("source text"),
      `${item.id} source-text-blocked claims must mention source text`,
    );
  }

  for (const field of textFields(item)) {
    assertNoFakeHumanReviewText(field, item.id);
    assertNoForbiddenRuntimeText(field, item.id);
  }

  coveredCandidateIds.add(item.claimCandidateId);
}

assert(
  coveredCandidateIds.size === CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES.length,
  "AI evidence claims must cover all claim candidate ids",
);

const aiEvidenceClaimsSource = await readProjectFile(aiEvidenceClaimsFile);
const packageJsonSource = await readProjectFile(packageJsonFile);
const coreCheckSource = await readProjectFile(coreCheckFile);

assert(
  packageJsonSource.includes("check:constructor-matrix-ai-evidence-claims"),
  "package.json must expose check:constructor-matrix-ai-evidence-claims",
);
assert(
  coreCheckSource.includes("check-constructor-matrix-ai-evidence-claims.mjs"),
  "constructor core check must be aware of AI evidence claim checker",
);
assert(
  coreCheckSource.includes("constructor-matrix-ai-evidence-claims.ts"),
  "constructor core check must be aware of AI evidence claim source",
);
assert(!/humanReviewed\s*:\s*true/i.test(aiEvidenceClaimsSource), "AI evidence claim source must not set humanReviewed=true");
assert(!/\breviewedBy\b/i.test(aiEvidenceClaimsSource), "AI evidence claim source must not mention reviewedBy");
assert(!/\breviewedAt\b/i.test(aiEvidenceClaimsSource), "AI evidence claim source must not mention reviewedAt");

for (const runtimeFile of runtimeDecisionFiles) {
  const source = await readProjectFile(runtimeFile);
  assert(
    !source.includes("constructor-matrix-ai-evidence-claims") &&
      !source.includes("CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS") &&
      !source.includes("AiEvidenceClaim"),
    `${runtimeFile} must not import AI evidence claim metadata at this stage`,
  );
}

const summary = buildConstructorMatrixAiEvidenceClaimSummary();
assert(summary.aiEvidenceClaimCount === CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS.length, "AI evidence claim summary count mismatch");
assert(summary.claimCandidateCoveredCount === summary.claimCandidateCount, "AI evidence claim candidate coverage mismatch");
assert(summary.finalEvidenceClaimCount === 0, "AI evidence claims must not create final evidence claims");
assert(summary.aiDeskReviewedCount === summary.aiEvidenceClaimCount, "Every AI evidence claim must be AI desk reviewed");
assert(summary.humanReviewed === false, "AI evidence claim summary must have humanReviewed=false");
assert(summary.runtimeChangeAllowedNow === false, "AI evidence claim summary must have runtimeChangeAllowedNow=false");

console.log(
  JSON.stringify(
    {
      ok: true,
      aiEvidenceClaimCount: summary.aiEvidenceClaimCount,
      claimCandidatesCovered: `${summary.claimCandidateCoveredCount}/${summary.claimCandidateCount}`,
      byStatus: summary.byStatus,
      byCategory: summary.byCategory,
      byAllowedUseNow: summary.byAllowedUseNow,
      softWarningCandidateCount: summary.softWarningCandidateCount,
      planStructureHintCandidateCount: summary.planStructureHintCandidateCount,
      blockedCount: summary.blockedCount,
      finalEvidenceClaimCount: summary.finalEvidenceClaimCount,
      humanReviewed: summary.humanReviewed,
      runtimeChangeAllowedNow: summary.runtimeChangeAllowedNow,
    },
    null,
    2,
  ),
);
