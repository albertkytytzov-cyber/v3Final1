import { readFile } from "node:fs/promises";

import {
  CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS,
  CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS,
  CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY,
  buildConstructorMatrixRuntimeEligibilitySummary,
} from "@training-platform/shared";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readProjectFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const docPath = "docs/matrix-ai-reviewed-production-decision-pack.md";
const doc = await readProjectFile(docPath);
const normalizedDoc = doc.replace(/\s+/g, " ");
const summary = buildConstructorMatrixRuntimeEligibilitySummary();

for (const token of [
  "Stage: Final Matrix Decision Pack",
  "Controlled preparation-plan building: allowed only for feature-flagged pilot",
  "Production default: not allowed",
  "Matrix can be used for controlled preparation-plan building in pilot mode only",
  "AI desk review is not human review",
  "All current AI-reviewed runtime eligibility records remain review-required",
  "Allowed runtime use does not include hard rules, medical decisions or numeric threshold gates",
  "Forbidden runtime use:",
  "Matrix_default_promotion",
  "No numeric threshold values are approved",
  "No fake citations are added",
  "No fake human approvals are added",
]) {
  assert(normalizedDoc.includes(token), `${docPath} must mention: ${token}`);
}

for (const token of [
  `AI source reviews: ${CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS.length}`,
  `AI evidence claim candidates: ${CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS.length}`,
  `Runtime eligibility records: ${summary.runtimeEligibilityCount}`,
  `Soft-warning eligible records: ${summary.softWarningEligibleCount}`,
  `Plan-structure hint eligible records: ${summary.planStructureHintEligibleCount}`,
  `Blocked high-risk records: ${summary.blockedHighRiskCount}`,
  `Review-required runtime eligibility records: ${CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY.length}`,
]) {
  assert(normalizedDoc.includes(token), `${docPath} must include current count: ${token}`);
}

for (const forbidden of [
  /humanReviewed\s*[:=]\s*true/i,
  /\breviewedBy\b/i,
  /\breviewedAt\b/i,
  /\bmedical approved\b/i,
  /\bcoach approved\b/i,
  /\bapproved_for_runtime\b/i,
  /\bapproved for runtime\b/i,
  /\bproduction default:\s*allowed\b/i,
  /\bMatrix can become the production default\b/i,
]) {
  assert(!forbidden.test(doc), `${docPath} contains forbidden decision text: ${forbidden}`);
}

assert(
  summary.runtimeEligibilityCount === CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY.length,
  "runtime eligibility summary count must match registry",
);
assert(summary.softWarningEligibleCount === 6, "expected 6 soft-warning eligible records");
assert(summary.planStructureHintEligibleCount === 1, "expected 1 plan-structure hint eligible record");
assert(summary.blockedHighRiskCount === 8, "expected 8 blocked high-risk records");
assert(
  CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY.every((item) => item.humanReviewed === false),
  "runtime eligibility must not imply human review",
);

console.log(JSON.stringify({
  ok: true,
  aiSourceReviewCount: CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS.length,
  aiEvidenceClaimCount: CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS.length,
  runtimeEligibilityCount: summary.runtimeEligibilityCount,
  softWarningEligibleCount: summary.softWarningEligibleCount,
  planStructureHintEligibleCount: summary.planStructureHintEligibleCount,
  blockedHighRiskCount: summary.blockedHighRiskCount,
  productionDefaultAllowed: false,
  controlledPilotOnly: true,
}, null, 2));
