import { access, readFile } from "node:fs/promises";

import {
  buildConstructorMatrixRuntimeEligibilitySummary,
  CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS,
  CONSTRUCTOR_MATRIX_AI_SAFETY_CLASSIFICATIONS,
  CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY,
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

const eligibilityFile = "packages/shared/src/constructor-matrix-runtime-eligibility.ts";
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
  "eligible_for_soft_warning_metadata",
  "eligible_for_plan_structure_hint_metadata",
  "eligible_for_fallback_guard_metadata",
  "docs_or_review_export_only",
  "blocked_high_risk",
  "blocked_pending_review",
]);
const allowedRuntimeUses = new Set([
  "none",
  "docs_only",
  "review_export_only",
  "soft_warning",
  "plan_structure_hint",
  "fallback_guard",
]);
const forbiddenRuntimeUses = new Set([
  "hard_gate",
  "medical_decision",
  "numeric_threshold",
  "automatic_weight_cut",
  "automatic_hydration",
  "automatic_injury_return",
  "automatic_REDS",
  "automatic_BFR_KAATSU",
  "Matrix_default_promotion",
]);
const highRiskAreas = new Set([
  "weight_cut",
  "hydration",
  "pain",
  "injury",
  "injury_pain",
  "female_context",
  "RED-S",
  "bfr_kaatsu",
]);

const aiEvidenceClaimIds = new Set(CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS.map((item) => item.id));
const safetyIds = new Set(CONSTRUCTOR_MATRIX_AI_SAFETY_CLASSIFICATIONS.map((item) => item.id));
const safetyById = new Map(CONSTRUCTOR_MATRIX_AI_SAFETY_CLASSIFICATIONS.map((item) => [item.id, item]));

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
    /\b(no|not|without|cannot|unchanged|blocked|forbidden)\b.{0,120}\b(runtime hard gate|hard gate|runtime rule|diagnosis|prescription|medical clearance|numeric threshold|threshold|cutoff|Matrix default|runtime behavior|production default)\b/i;

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

function hasHighRiskArea(item) {
  return item.riskAreas.some((area) => highRiskAreas.has(area));
}

function textFields(item) {
  return [
    item.title,
    item.fallbackBehavior,
    ...item.runtimeConditions,
    ...item.limitations,
  ];
}

await fileExists(eligibilityFile);
await fileExists(coreCheckFile);

assert(
  CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY.length ===
    CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS.length,
  "Runtime eligibility must cover every AI evidence claim",
);

const ids = new Set(CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY.map((item) => item.id));
assert(ids.size === CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY.length, "Runtime eligibility ids must be unique");

const coveredAiEvidenceClaimIds = new Set();

for (const item of CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY) {
  assert(item.id && /^runtime_eligibility_[a-z0-9_]+$/.test(item.id), `Invalid runtime eligibility id: ${item.id}`);
  assert(aiEvidenceClaimIds.has(item.aiEvidenceClaimId), `${item.id} references unknown AI evidence claim`);
  assert(safetyIds.has(item.safetyClassificationId), `${item.id} references unknown safety classification`);
  assert(typeof item.claimCandidateId === "string" && item.claimCandidateId.length > 0, `${item.id} must have claimCandidateId`);
  assert(typeof item.title === "string" && item.title.length > 0, `${item.id} must have title`);
  assert(allowedStatuses.has(item.status), `${item.id} has invalid status`);
  assert(allowedRuntimeUses.has(item.allowedRuntimeUse), `${item.id} has invalid allowedRuntimeUse`);
  assert(Array.isArray(item.forbiddenRuntimeUses) && item.forbiddenRuntimeUses.length > 0, `${item.id} must have forbiddenRuntimeUses`);
  assert(Array.isArray(item.riskAreas) && item.riskAreas.length > 0, `${item.id} must have riskAreas`);
  assert(Array.isArray(item.requiredClassifications) && item.requiredClassifications.length > 0, `${item.id} must have requiredClassifications`);
  assert(Array.isArray(item.sourceCandidateIds) && item.sourceCandidateIds.length > 0, `${item.id} must have sourceCandidateIds`);
  assert(Array.isArray(item.evidenceDependencyIds), `${item.id} must have evidenceDependencyIds`);
  assert(Array.isArray(item.dataDependencyIds), `${item.id} must have dataDependencyIds`);
  assert(Array.isArray(item.thresholdCandidateIds), `${item.id} must have thresholdCandidateIds`);
  assert(Array.isArray(item.reviewDecisionIds), `${item.id} must have reviewDecisionIds`);
  assert(Array.isArray(item.runtimeConditions) && item.runtimeConditions.length > 0, `${item.id} must have runtimeConditions`);
  assert(typeof item.fallbackBehavior === "string" && item.fallbackBehavior.length > 0, `${item.id} must have fallbackBehavior`);
  assert(Array.isArray(item.limitations) && item.limitations.length > 0, `${item.id} must have limitations`);
  assert(item.aiDeskReviewed === true, `${item.id} must be AI desk reviewed`);
  assert(item.aiDeskReviewModel === "Codex AI desk review", `${item.id} has unexpected AI review model`);
  assert(item.humanReviewed === false, `${item.id} must have humanReviewed=false`);
  assert(!("reviewedBy" in item), `${item.id} must not include reviewedBy`);
  assert(!("reviewedAt" in item), `${item.id} must not include reviewedAt`);

  for (const use of item.forbiddenRuntimeUses) {
    assert(forbiddenRuntimeUses.has(use), `${item.id} has invalid forbidden runtime use: ${use}`);
  }

  for (const requiredUse of forbiddenRuntimeUses) {
    assert(
      item.forbiddenRuntimeUses.includes(requiredUse),
      `${item.id} must explicitly forbid ${requiredUse}`,
    );
  }

  const safety = safetyById.get(item.safetyClassificationId);
  assert(safety, `${item.id} missing safety classification`);

  if (hasHighRiskArea(item) || safety.classifications.includes("medical_review_required")) {
    assert(item.status === "blocked_high_risk", `${item.id} high-risk item must be blocked_high_risk`);
    assert(item.allowedRuntimeUse === "none", `${item.id} high-risk item must have no runtime use`);
    assert(item.runtimeChangeAllowedNow === false, `${item.id} high-risk item cannot allow runtime change`);
  }

  if (item.allowedRuntimeUse !== "none" && item.allowedRuntimeUse !== "review_export_only" && item.allowedRuntimeUse !== "docs_only") {
    assert(item.aiDeskReviewed === true, `${item.id} runtime candidates must be AI desk reviewed`);
    assert(!safety.classifications.includes("medical_review_required"), `${item.id} runtime candidates must not require medical review`);
    assert(!safety.classifications.includes("do_not_automate"), `${item.id} runtime candidates must not be do_not_automate`);
    assert(item.runtimeConditions.some((condition) => /fallback/i.test(condition)), `${item.id} runtime candidates must have fallback condition`);
    assert(/fallback/i.test(item.fallbackBehavior), `${item.id} runtime candidates must have fallback behavior`);
    assert(item.limitations.length > 0, `${item.id} runtime candidates must have limitations`);
    assert(item.runtimeChangeAllowedNow === true, `${item.id} safe runtime candidates must mark runtimeChangeAllowedNow=true`);
  }

  for (const field of textFields(item)) {
    assertNoFakeHumanReviewText(field, item.id);
    assertNoForbiddenRuntimeText(field, item.id);
  }

  coveredAiEvidenceClaimIds.add(item.aiEvidenceClaimId);
}

assert(
  coveredAiEvidenceClaimIds.size === CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS.length,
  "Runtime eligibility must cover every AI evidence claim id",
);

const eligibilitySource = await readProjectFile(eligibilityFile);
const packageJsonSource = await readProjectFile(packageJsonFile);
const coreCheckSource = await readProjectFile(coreCheckFile);

assertNoFakeHumanReviewText(eligibilitySource, eligibilityFile);
assert(
  packageJsonSource.includes("check:constructor-matrix-runtime-eligibility"),
  "package.json must expose check:constructor-matrix-runtime-eligibility",
);
assert(
  coreCheckSource.includes("check-constructor-matrix-runtime-eligibility.mjs") &&
    coreCheckSource.includes("constructor-matrix-runtime-eligibility.ts") &&
    coreCheckSource.includes("check:constructor-matrix-runtime-eligibility"),
  "constructor core check must be aware of runtime eligibility metadata",
);

for (const path of runtimeDecisionFiles) {
  const source = await readProjectFile(path);
  assert(
    !source.includes("constructor-matrix-runtime-eligibility"),
    `${path} must not import runtime eligibility before the explicit integration stage`,
  );
}

const summary = buildConstructorMatrixRuntimeEligibilitySummary();

assert(summary.runtimeEligibilityCount > 0, "summary must include runtime eligibility entries");
assert(
  summary.aiEvidenceClaimCoveredCount === summary.aiEvidenceClaimCount,
  "summary must cover every AI evidence claim",
);
assert(summary.humanReviewed === false, "summary must not imply human review");
assert(summary.blockedHighRiskCount > 0, "summary must keep high-risk items blocked");

console.log(JSON.stringify({
  ok: true,
  runtimeEligibilityCount: summary.runtimeEligibilityCount,
  aiEvidenceClaimsCovered: `${summary.aiEvidenceClaimCoveredCount}/${summary.aiEvidenceClaimCount}`,
  byStatus: summary.byStatus,
  byAllowedRuntimeUse: summary.byAllowedRuntimeUse,
  softWarningEligibleCount: summary.softWarningEligibleCount,
  planStructureHintEligibleCount: summary.planStructureHintEligibleCount,
  fallbackGuardEligibleCount: summary.fallbackGuardEligibleCount,
  blockedHighRiskCount: summary.blockedHighRiskCount,
  blockedPendingReviewCount: summary.blockedPendingReviewCount,
  runtimeChangeAllowedNowCount: summary.runtimeChangeAllowedNowCount,
  humanReviewed: summary.humanReviewed,
}, null, 2));
