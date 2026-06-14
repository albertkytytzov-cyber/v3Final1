import { access, readFile } from "node:fs/promises";

import {
  buildConstructorMatrixAiReviewPolicySummary,
  CONSTRUCTOR_MATRIX_AI_REVIEW_POLICY,
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

const policyFile = "packages/shared/src/constructor-matrix-ai-review-policy.ts";
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

const allowedScopes = new Set([
  "source_identity",
  "evidence_claim",
  "safety_classification",
  "runtime_eligibility",
  "pilot_deployment",
]);
const allowedUses = new Set([
  "docs_only",
  "review_export_only",
  "soft_warning_candidate",
  "plan_structure_hint_candidate",
  "fallback_guard_candidate",
  "not_allowed",
]);
const requiredBoundaries = [
  "not_human_review",
  "not_medical_approval",
  "not_coach_approval",
  "no_numeric_threshold_approval",
  "no_runtime_hard_gate",
];
const highRiskAreas = [
  "weight_cut",
  "hydration",
  "pain",
  "injury",
  "female_context",
  "reds",
  "youth_context",
  "bfr_kaatsu",
];

function textFields(item) {
  return [
    item.title,
    item.rationale,
    ...item.aiMayDo,
    ...item.aiMustNotDo,
    ...item.enforcementNotes,
  ];
}

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
    /\b(no|not|without)\b.{0,80}\b(numeric threshold|numeric thresholds|threshold approval|cutoff|cutoffs|hard numeric)\b/i;

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

await fileExists(policyFile);
await fileExists(coreCheckFile);

assert(
  CONSTRUCTOR_MATRIX_AI_REVIEW_POLICY.length >= 5,
  "AI review policy must contain at least five policy rules",
);

const ids = new Set(CONSTRUCTOR_MATRIX_AI_REVIEW_POLICY.map((item) => item.id));
assert(ids.size === CONSTRUCTOR_MATRIX_AI_REVIEW_POLICY.length, "AI review policy ids must be unique");

for (const item of CONSTRUCTOR_MATRIX_AI_REVIEW_POLICY) {
  assert(item.id && /^[a-z0-9_]+$/.test(item.id), `Invalid policy id: ${item.id}`);
  assert(typeof item.title === "string" && item.title.length > 0, `${item.id} must have title`);
  assert(allowedScopes.has(item.scope), `${item.id} has invalid scope`);
  assert(Array.isArray(item.aiMayDo) && item.aiMayDo.length > 0, `${item.id} must have aiMayDo`);
  assert(Array.isArray(item.aiMustNotDo) && item.aiMustNotDo.length > 0, `${item.id} must have aiMustNotDo`);
  assert(Array.isArray(item.allowedUseNow) && item.allowedUseNow.length > 0, `${item.id} must have allowedUseNow`);
  assert(
    Array.isArray(item.requiredBoundaries) && item.requiredBoundaries.length > 0,
    `${item.id} must have requiredBoundaries`,
  );
  assert(Array.isArray(item.highRiskAreas), `${item.id} must have highRiskAreas`);
  assert(typeof item.rationale === "string" && item.rationale.length > 0, `${item.id} must have rationale`);
  assert(
    Array.isArray(item.enforcementNotes) && item.enforcementNotes.length > 0,
    `${item.id} must have enforcementNotes`,
  );
  assert(item.aiDeskReviewAllowed === true, `${item.id} must allow AI desk review explicitly`);
  assert(item.humanReviewed === false, `${item.id} must have humanReviewed=false`);
  assert(item.runtimeChangeAllowedNow === false, `${item.id} must have runtimeChangeAllowedNow=false`);
  assert(!("reviewedBy" in item), `${item.id} must not include reviewedBy`);
  assert(!("reviewedAt" in item), `${item.id} must not include reviewedAt`);

  for (const allowedUse of item.allowedUseNow) {
    assert(allowedUses.has(allowedUse), `${item.id} has invalid allowedUseNow: ${allowedUse}`);
  }
  for (const boundary of requiredBoundaries) {
    assert(
      item.requiredBoundaries.includes(boundary),
      `${item.id} must include required boundary ${boundary}`,
    );
  }
  for (const field of textFields(item)) {
    assertNoFakeHumanReviewText(field, item.id);
    assertNoNumericRuntimeThresholdText(field, item.id);
  }
}

const coveredHighRiskAreas = new Set(
  CONSTRUCTOR_MATRIX_AI_REVIEW_POLICY.flatMap((item) => item.highRiskAreas),
);
for (const area of highRiskAreas) {
  assert(coveredHighRiskAreas.has(area), `AI review policy must cover high-risk area ${area}`);
}

const policySource = await readProjectFile(policyFile);
const packageJsonSource = await readProjectFile(packageJsonFile);
const coreCheckSource = await readProjectFile(coreCheckFile);

assert(
  packageJsonSource.includes("check:constructor-matrix-ai-review-policy"),
  "package.json must expose check:constructor-matrix-ai-review-policy",
);
assert(
  coreCheckSource.includes("check-constructor-matrix-ai-review-policy.mjs"),
  "constructor core check must be aware of AI review policy checker",
);
assert(
  coreCheckSource.includes("constructor-matrix-ai-review-policy.ts"),
  "constructor core check must be aware of AI review policy source",
);
assert(!/humanReviewed\s*:\s*true/i.test(policySource), "AI review policy source must not set humanReviewed=true");
assert(!/\breviewedBy\b/i.test(policySource), "AI review policy source must not mention reviewedBy");
assert(!/\breviewedAt\b/i.test(policySource), "AI review policy source must not mention reviewedAt");

for (const runtimeFile of runtimeDecisionFiles) {
  const source = await readProjectFile(runtimeFile);
  assert(
    !source.includes("constructor-matrix-ai-review-policy") &&
      !source.includes("CONSTRUCTOR_MATRIX_AI_REVIEW_POLICY") &&
      !source.includes("AiReviewPolicy"),
    `${runtimeFile} must not import AI review policy metadata at this stage`,
  );
}

const summary = buildConstructorMatrixAiReviewPolicySummary();
assert(summary.policyRuleCount === CONSTRUCTOR_MATRIX_AI_REVIEW_POLICY.length, "Policy summary count mismatch");
assert(summary.humanReviewed === false, "Policy summary must have humanReviewed=false");
assert(summary.runtimeChangeAllowedNow === false, "Policy summary must have runtimeChangeAllowedNow=false");

console.log(
  JSON.stringify(
    {
      ok: true,
      policyRuleCount: summary.policyRuleCount,
      scopes: summary.scopes,
      allowedUses: summary.allowedUses,
      boundaries: summary.boundaries,
      highRiskAreas: summary.highRiskAreas,
      humanReviewed: summary.humanReviewed,
      runtimeChangeAllowedNow: summary.runtimeChangeAllowedNow,
    },
    null,
    2,
  ),
);
