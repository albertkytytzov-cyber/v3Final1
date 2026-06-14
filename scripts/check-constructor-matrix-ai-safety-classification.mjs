import { access, readFile } from "node:fs/promises";

import {
  buildConstructorMatrixAiSafetyClassificationSummary,
  CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS,
  CONSTRUCTOR_MATRIX_AI_SAFETY_CLASSIFICATIONS,
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

const safetyFile = "packages/shared/src/constructor-matrix-ai-safety-classification.ts";
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

const allowedClassifications = new Set([
  "safe_for_docs",
  "safe_for_review_export",
  "safe_for_soft_warning",
  "safe_for_plan_structure",
  "fallback_only",
  "do_not_automate",
  "human_review_required",
  "medical_review_required",
  "coach_review_required",
  "data_quality_review_required",
]);
const allowedRuntimeUseNow = new Set([
  "none",
  "docs_only",
  "review_export_only",
  "soft_warning_candidate",
  "plan_structure_hint_candidate",
  "fallback_only",
]);
const medicalAreas = new Set([
  "weight_cut",
  "hydration",
  "pain",
  "injury",
  "injury_pain",
  "female_context",
  "RED-S",
  "bfr_kaatsu",
]);
const youthAreas = new Set(["youth_context"]);
const dataQualityAreas = new Set([
  "wearable_data",
  "sleep",
  "rhr",
  "hrv",
  "readiness",
]);
const coachAreas = new Set([
  "taper",
  "contact_load",
  "lmv",
  "competition_context",
  "travel_fatigue",
]);

const aiEvidenceClaimIds = new Set(CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS.map((item) => item.id));

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
    /\b(no|not|without|cannot|unchanged|blocked)\b.{0,100}\b(runtime hard gate|runtime rule|diagnosis|prescription|medical clearance|numeric threshold|threshold|cutoff|Matrix default|runtime behavior)\b/i;

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

function hasAnyArea(item, areas) {
  return item.riskAreas.some((area) => areas.has(area));
}

function textFields(item) {
  return [
    item.title,
    item.rationale,
    ...item.limitations,
  ];
}

await fileExists(safetyFile);
await fileExists(coreCheckFile);

assert(
  CONSTRUCTOR_MATRIX_AI_SAFETY_CLASSIFICATIONS.length ===
    CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS.length,
  "AI safety classifications must cover every AI evidence claim",
);

const ids = new Set(CONSTRUCTOR_MATRIX_AI_SAFETY_CLASSIFICATIONS.map((item) => item.id));
assert(
  ids.size === CONSTRUCTOR_MATRIX_AI_SAFETY_CLASSIFICATIONS.length,
  "AI safety classification ids must be unique",
);

const coveredAiEvidenceClaimIds = new Set();

for (const item of CONSTRUCTOR_MATRIX_AI_SAFETY_CLASSIFICATIONS) {
  assert(item.id && /^ai_safety_[a-z0-9_]+$/.test(item.id), `Invalid safety id: ${item.id}`);
  assert(aiEvidenceClaimIds.has(item.aiEvidenceClaimId), `${item.id} references unknown AI evidence claim`);
  assert(typeof item.claimCandidateId === "string" && item.claimCandidateId.length > 0, `${item.id} must have claimCandidateId`);
  assert(typeof item.title === "string" && item.title.length > 0, `${item.id} must have title`);
  assert(Array.isArray(item.riskAreas) && item.riskAreas.length > 0, `${item.id} must have riskAreas`);
  assert(Array.isArray(item.sourceCandidateIds) && item.sourceCandidateIds.length > 0, `${item.id} must have sourceCandidateIds`);
  assert(Array.isArray(item.evidenceDependencyIds), `${item.id} must have evidenceDependencyIds`);
  assert(Array.isArray(item.dataDependencyIds), `${item.id} must have dataDependencyIds`);
  assert(Array.isArray(item.thresholdCandidateIds), `${item.id} must have thresholdCandidateIds`);
  assert(Array.isArray(item.reviewDecisionIds), `${item.id} must have reviewDecisionIds`);
  assert(Array.isArray(item.classifications) && item.classifications.length > 0, `${item.id} must have classifications`);
  assert(allowedClassifications.has(item.primaryClassification), `${item.id} has invalid primaryClassification`);
  assert(allowedRuntimeUseNow.has(item.allowedRuntimeUseNow), `${item.id} has invalid allowedRuntimeUseNow`);
  assert(Array.isArray(item.forbiddenRuntimeUseNow) && item.forbiddenRuntimeUseNow.length > 0, `${item.id} must have forbiddenRuntimeUseNow`);
  assert(typeof item.rationale === "string" && item.rationale.length > 0, `${item.id} must have rationale`);
  assert(Array.isArray(item.limitations) && item.limitations.length > 0, `${item.id} must have limitations`);
  assert(item.aiDeskReviewed === true, `${item.id} must be AI desk reviewed`);
  assert(item.aiDeskReviewModel === "Codex AI desk review", `${item.id} has unexpected AI review model`);
  assert(item.humanReviewed === false, `${item.id} must have humanReviewed=false`);
  assert(!("reviewedBy" in item), `${item.id} must not include reviewedBy`);
  assert(!("reviewedAt" in item), `${item.id} must not include reviewedAt`);
  assert(item.runtimeChangeAllowedNow === false, `${item.id} must have runtimeChangeAllowedNow=false`);

  for (const classification of item.classifications) {
    assert(allowedClassifications.has(classification), `${item.id} has invalid classification: ${classification}`);
  }

  assert(
    item.classifications.includes("human_review_required"),
    `${item.id} must keep human review required`,
  );

  if (hasAnyArea(item, medicalAreas)) {
    assert(
      item.classifications.includes("medical_review_required"),
      `${item.id} medical high-risk areas must require medical review`,
    );
    assert(
      item.classifications.includes("do_not_automate"),
      `${item.id} medical high-risk areas must remain do_not_automate`,
    );
    assert(
      item.allowedRuntimeUseNow === "review_export_only",
      `${item.id} medical high-risk items must stay review_export_only`,
    );
  }

  if (hasAnyArea(item, youthAreas)) {
    assert(
      item.classifications.includes("coach_review_required") ||
        item.classifications.includes("medical_review_required"),
      `${item.id} youth items must require coach or medical review`,
    );
  }

  if (hasAnyArea(item, dataQualityAreas)) {
    assert(
      item.classifications.includes("data_quality_review_required"),
      `${item.id} data-quality areas must require data-quality review`,
    );
  }

  if (hasAnyArea(item, coachAreas)) {
    assert(
      item.classifications.includes("coach_review_required") ||
        item.classifications.includes("safe_for_plan_structure"),
      `${item.id} coach/sport areas must require coach review or stay plan-structure-only`,
    );
  }

  for (const field of textFields(item)) {
    assertNoFakeHumanReviewText(field, item.id);
    assertNoForbiddenRuntimeText(field, item.id);
  }

  coveredAiEvidenceClaimIds.add(item.aiEvidenceClaimId);
}

assert(
  coveredAiEvidenceClaimIds.size === CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS.length,
  "AI safety classification must cover all AI evidence claim ids",
);

const safetySource = await readProjectFile(safetyFile);
const packageJsonSource = await readProjectFile(packageJsonFile);
const coreCheckSource = await readProjectFile(coreCheckFile);

assertNoFakeHumanReviewText(safetySource, safetyFile);
assert(
  packageJsonSource.includes("check:constructor-matrix-ai-safety-classification"),
  "package.json must expose check:constructor-matrix-ai-safety-classification",
);
assert(
  coreCheckSource.includes("check-constructor-matrix-ai-safety-classification.mjs") &&
    coreCheckSource.includes("constructor-matrix-ai-safety-classification.ts") &&
    coreCheckSource.includes("check:constructor-matrix-ai-safety-classification"),
  "constructor core check must be aware of AI safety classification metadata",
);

for (const path of runtimeDecisionFiles) {
  const source = await readProjectFile(path);
  assert(
    !source.includes("constructor-matrix-ai-safety-classification"),
    `${path} must not import AI safety classification metadata`,
  );
}

const summary = buildConstructorMatrixAiSafetyClassificationSummary();

assert(summary.safetyClassificationCount > 0, "summary must include safety classifications");
assert(
  summary.aiEvidenceClaimCoveredCount === summary.aiEvidenceClaimCount,
  "summary must cover every AI evidence claim",
);
assert(summary.humanReviewed === false, "summary must not imply human review");
assert(summary.runtimeChangeAllowedNow === false, "summary must not allow runtime change");

console.log(JSON.stringify({
  ok: true,
  safetyClassificationCount: summary.safetyClassificationCount,
  aiEvidenceClaimsCovered: `${summary.aiEvidenceClaimCoveredCount}/${summary.aiEvidenceClaimCount}`,
  byPrimaryClassification: summary.byPrimaryClassification,
  byClassification: summary.byClassification,
  softWarningCandidateCount: summary.softWarningCandidateCount,
  planStructureHintCandidateCount: summary.planStructureHintCandidateCount,
  fallbackOnlyCount: summary.fallbackOnlyCount,
  doNotAutomateCount: summary.doNotAutomateCount,
  medicalReviewRequiredCount: summary.medicalReviewRequiredCount,
  coachReviewRequiredCount: summary.coachReviewRequiredCount,
  dataQualityReviewRequiredCount: summary.dataQualityReviewRequiredCount,
  highRiskBlockedCount: summary.highRiskBlockedCount,
  humanReviewed: summary.humanReviewed,
  runtimeChangeAllowedNow: summary.runtimeChangeAllowedNow,
}, null, 2));
