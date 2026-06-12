import { access, readFile } from "node:fs/promises";

import {
  buildConstructorMatrixEvidenceClaimExtractionSummary,
  buildConstructorMatrixLayerReviewPackage,
  buildConstructorMatrixSourceLookupIntakeSummary,
  CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES,
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS,
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIMS,
  CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY,
  CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER,
  CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES,
  CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG,
  CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE,
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

async function readProjectFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const evidenceClaimsFile = "packages/shared/src/constructor-matrix-evidence-claims.ts";
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
const docsToCheck = [
  "docs/constructor-matrix-evidence-dependency-gap-audit.md",
  "docs/constructor-matrix-source-acquisition-p0-dossier.md",
  "docs/perform-constructor-core-stack.md",
  "docs/constructor-phase-matrix-transition-plan.md",
  "docs/constructor-matrix-preview-fixtures.md",
  "docs/constructor-matrix-production-rollout.md",
];
const allowedClaimStatuses = new Set([
  "draft_extracted",
  "blocked_source_not_ready",
  "blocked_manual_verification_required",
  "needs_source_verification",
  "needs_sport_science_review",
  "needs_coach_review",
  "needs_medical_review",
  "approved_for_docs_only",
  "do_not_automate",
]);
const allowedClaimTypes = new Set([
  "safety",
  "methodology",
  "performance",
  "readiness",
  "weight_management",
  "hydration",
  "regulatory_competition_fact",
  "data_quality",
  "population_context",
  "injury_pain",
  "review_blocker",
]);
const allowedApplicability = new Set([
  "direct_wrestling",
  "combat_sport_transfer",
  "general_sport",
  "policy_or_regulatory",
  "methodology_framework",
  "internal_case_context",
  "not_applicable_blocker",
]);
const allowedRuntimeUse = new Set([
  "none",
  "documentation_only",
  "review_export_only",
  "future_source_trace_only",
]);
const allowedReviewRequirements = new Set([
  "coach_review",
  "medical_review",
  "sport_science_review",
  "data_quality_review",
  "product_safety_review",
  "manual_source_verification",
]);
const allowedBlockerReasons = new Set([
  "manual_verification_required",
  "source_not_extraction_ready",
  "metadata_only_record",
  "needs_full_text_or_policy_text",
  "needs_human_review_before_claims",
  "no_claim_safe_to_extract",
]);
const requiredHighRiskAreas = [
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
];
const runtimeImportPatterns = [
  "constructor-matrix-evidence-claims",
  "CONSTRUCTOR_MATRIX_EVIDENCE_CLAIMS",
  "CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS",
  "EvidenceClaimExtraction",
];

const sourceLookupIds = new Set(CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE.map((item) => item.id));
const sourceCandidateIds = new Set(CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES.map((item) => item.id));
const sourceBacklogIds = new Set(CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG.map((item) => item.id));
const evidenceDependencyIds = new Set(CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY.map((item) => item.id));
const dataDependencyIds = new Set(CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES.map((item) => item.id));
const thresholdCandidateIds = new Set(CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES.map((item) => item.id));
const reviewDecisionIds = new Set(CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER.map((item) => item.id));
const sourceLookupById = new Map(
  CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE.map((item) => [item.id, item]),
);
const sourceCandidateById = new Map(
  CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES.map((item) => [item.id, item]),
);
const p0BacklogIds = CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG
  .filter((item) => item.priority === "P0")
  .map((item) => item.id);
const p0SourceCandidateIds = CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES
  .filter((item) =>
    item.linkedSourceExpansionBacklogIds.some((backlogId) => p0BacklogIds.includes(backlogId)),
  )
  .map((item) => item.id);

function hasHumanApprovalPattern(text) {
  return (
    /humanReviewed\s*:\s*true/i.test(text) ||
    /\breviewedBy\s*:/i.test(text) ||
    /\breviewedAt\s*:/i.test(text) ||
    /\bapproved by\b/i.test(text)
  );
}

function hasForbiddenThresholdText(text) {
  if (/\b(no|not|without)\b.{0,80}\b(numeric threshold|threshold value|runtime threshold|cutoff)\b/i.test(text)) {
    return false;
  }

  if (/\bthreshold candidate\b/i.test(text)) {
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

function claimTextFields(item) {
  return [
    item.title,
    item.claimText,
    ...item.populationContext,
    ...item.methodOrRiskArea,
    ...item.supports,
    ...item.limitations,
    ...item.extractionNotes,
  ];
}

function blockerCoveredLookupIds() {
  return new Set([
    ...CONSTRUCTOR_MATRIX_EVIDENCE_CLAIMS.flatMap((item) => item.sourceLookupIntakeIds),
    ...CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS.flatMap((item) => item.sourceLookupIntakeIds),
  ]);
}

function blockerCoveredCandidateIds() {
  return new Set([
    ...CONSTRUCTOR_MATRIX_EVIDENCE_CLAIMS.flatMap((item) => item.sourceCandidateIds),
    ...CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS.flatMap((item) => item.sourceCandidateIds),
  ]);
}

await fileExists(evidenceClaimsFile);

assert(Array.isArray(CONSTRUCTOR_MATRIX_EVIDENCE_CLAIMS), "CONSTRUCTOR_MATRIX_EVIDENCE_CLAIMS must exist");
assert(
  Array.isArray(CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS),
  "CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS must exist",
);

const claimIds = new Set(CONSTRUCTOR_MATRIX_EVIDENCE_CLAIMS.map((item) => item.id));
assert(claimIds.size === CONSTRUCTOR_MATRIX_EVIDENCE_CLAIMS.length, "Claim ids must be unique");

const blockerIds = new Set(CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS.map((item) => item.id));
assert(blockerIds.size === CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS.length, "Blocker ids must be unique");

for (const item of CONSTRUCTOR_MATRIX_EVIDENCE_CLAIMS) {
  assert(item.id && /^[a-z0-9_]+$/.test(item.id), `Invalid claim id: ${item.id}`);
  assert(allowedClaimStatuses.has(item.status), `${item.id} has invalid status`);
  assert(allowedClaimTypes.has(item.claimType), `${item.id} has invalid claimType`);
  assert(allowedApplicability.has(item.applicability), `${item.id} has invalid applicability`);
  assert(typeof item.title === "string" && item.title.length > 0, `${item.id} must have title`);
  assert(typeof item.claimText === "string" && item.claimText.length > 0, `${item.id} must have claimText`);
  assert(Array.isArray(item.sourceLookupIntakeIds), `${item.id} must have sourceLookupIntakeIds`);
  assert(Array.isArray(item.sourceCandidateIds), `${item.id} must have sourceCandidateIds`);
  assert(Array.isArray(item.sourceExpansionBacklogIds), `${item.id} must have sourceExpansionBacklogIds`);
  assert(Array.isArray(item.evidenceDependencyIds), `${item.id} must have evidenceDependencyIds`);
  assert(Array.isArray(item.dataDependencyIds), `${item.id} must have dataDependencyIds`);
  assert(Array.isArray(item.thresholdCandidateIds), `${item.id} must have thresholdCandidateIds`);
  assert(Array.isArray(item.reviewDecisionIds), `${item.id} must have reviewDecisionIds`);
  assert(Array.isArray(item.populationContext), `${item.id} must have populationContext`);
  assert(Array.isArray(item.methodOrRiskArea), `${item.id} must have methodOrRiskArea`);
  assert(Array.isArray(item.supports), `${item.id} must have supports`);
  assert(Array.isArray(item.limitations), `${item.id} must have limitations`);
  assert(Array.isArray(item.extractionNotes), `${item.id} must have extractionNotes`);
  assert(Array.isArray(item.reviewRequired), `${item.id} must have reviewRequired`);
  assert(allowedRuntimeUse.has(item.runtimeUseNow), `${item.id} has invalid runtimeUseNow`);
  assert(item.humanReviewed === false, `${item.id} must have humanReviewed=false`);
  assert(!("reviewedBy" in item), `${item.id} must not have reviewedBy`);
  assert(!("reviewedAt" in item), `${item.id} must not have reviewedAt`);
  assert(item.runtimeChangeAllowedNow === false, `${item.id} must have runtimeChangeAllowedNow=false`);

  for (const id of item.sourceLookupIntakeIds) {
    assert(sourceLookupIds.has(id), `${item.id} references unknown source lookup id: ${id}`);
    const sourceLookup = sourceLookupById.get(id);
    assert(sourceLookup?.extractionReadiness === "ready_for_claim_extraction", `${item.id} references non-ready source lookup: ${id}`);
    assert(sourceLookup?.extractionReadiness !== "needs_manual_verification", `${item.id} references manual-verification source: ${id}`);
  }
  for (const id of item.sourceCandidateIds) {
    assert(sourceCandidateIds.has(id), `${item.id} references unknown source candidate id: ${id}`);
  }
  for (const id of item.sourceExpansionBacklogIds) {
    assert(sourceBacklogIds.has(id), `${item.id} references unknown source backlog id: ${id}`);
  }
  for (const id of item.evidenceDependencyIds) {
    assert(evidenceDependencyIds.has(id), `${item.id} references unknown evidence dependency id: ${id}`);
  }
  for (const id of item.dataDependencyIds) {
    assert(dataDependencyIds.has(id), `${item.id} references unknown data dependency id: ${id}`);
  }
  for (const id of item.thresholdCandidateIds) {
    assert(thresholdCandidateIds.has(id), `${item.id} references unknown threshold candidate id: ${id}`);
  }
  for (const id of item.reviewDecisionIds) {
    assert(reviewDecisionIds.has(id), `${item.id} references unknown review decision id: ${id}`);
  }
  for (const reviewRequired of item.reviewRequired) {
    assert(allowedReviewRequirements.has(reviewRequired), `${item.id} has invalid review requirement`);
  }
  for (const text of claimTextFields(item)) {
    assert(!hasForbiddenThresholdText(text), `${item.id} contains numeric threshold text: ${text}`);
    assert(!hasHumanApprovalPattern(text), `${item.id} contains human approval text: ${text}`);
  }
}

for (const item of CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS) {
  assert(item.id && /^[a-z0-9_]+$/.test(item.id), `Invalid blocker id: ${item.id}`);
  assert(Array.isArray(item.sourceLookupIntakeIds), `${item.id} must have sourceLookupIntakeIds`);
  assert(Array.isArray(item.sourceCandidateIds), `${item.id} must have sourceCandidateIds`);
  assert(allowedBlockerReasons.has(item.reason), `${item.id} has invalid reason`);
  assert(Array.isArray(item.affectedAreas) && item.affectedAreas.length > 0, `${item.id} must have affectedAreas`);
  assert(Array.isArray(item.requiredNextAction) && item.requiredNextAction.length > 0, `${item.id} must have requiredNextAction`);
  assert(["none", "documentation_only"].includes(item.runtimeUseNow), `${item.id} has invalid runtimeUseNow`);
  assert(item.runtimeChangeAllowedNow === false, `${item.id} must have runtimeChangeAllowedNow=false`);

  for (const id of item.sourceLookupIntakeIds) {
    assert(sourceLookupIds.has(id), `${item.id} references unknown source lookup id: ${id}`);
  }
  for (const id of item.sourceCandidateIds) {
    assert(sourceCandidateIds.has(id), `${item.id} references unknown source candidate id: ${id}`);
  }
}

const coveredLookupIds = blockerCoveredLookupIds();
for (const sourceLookup of CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE) {
  assert(coveredLookupIds.has(sourceLookup.id), `Source lookup intake not covered by claim or blocker: ${sourceLookup.id}`);
}

const coveredCandidateIds = blockerCoveredCandidateIds();
for (const id of p0SourceCandidateIds) {
  assert(coveredCandidateIds.has(id), `P0 source candidate not covered by claim or blocker: ${id}`);
}

const coveredP0BacklogIds = new Set(
  CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE
    .filter((item) => coveredLookupIds.has(item.id))
    .flatMap((item) => item.sourceExpansionBacklogIds)
    .filter((id) => p0BacklogIds.includes(id)),
);
for (const id of p0BacklogIds) {
  assert(coveredP0BacklogIds.has(id), `P0 backlog item not covered by claim or blocker: ${id}`);
}

const coveredAreas = new Set(
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS.flatMap((item) => item.affectedAreas),
);
for (const area of requiredHighRiskAreas) {
  assert(coveredAreas.has(area), `Required high-risk area not covered by claim or blocker: ${area}`);
}

for (const sourceLookup of CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE) {
  if (sourceLookup.extractionReadiness === "needs_manual_verification") {
    assert(
      CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS.some(
        (item) =>
          item.sourceLookupIntakeIds.includes(sourceLookup.id) &&
          item.reason === "manual_verification_required",
      ),
      `Manual-verification source lookup must have manual blocker: ${sourceLookup.id}`,
    );
  }
}

const sourceLookupSummary = buildConstructorMatrixSourceLookupIntakeSummary();
const summary = buildConstructorMatrixEvidenceClaimExtractionSummary();
if (summary.evidenceClaimCount === 0) {
  assert(sourceLookupSummary.extractionReadyCount === 0, "Zero claims are allowed only when source lookup has no extraction-ready records");
  assert(summary.evidenceClaimBlockerCount > 0, "Zero claims require blockers");
  assert(summary.sourceLookupRecordsCoveredCount === summary.sourceLookupRecordCount, "Zero-claim stage must cover all source lookup records with blockers");
}
assert(summary.highRiskAreasMissing.length === 0, "Summary must report no missing high-risk areas");
assert(summary.humanReviewed === false, "Evidence claim summary must keep humanReviewed=false");
assert(summary.runtimeChangeAllowedNow === false, "Evidence claim summary must keep runtimeChangeAllowedNow=false");

const evidenceClaimsText = await readProjectFile(evidenceClaimsFile);
assert(!hasHumanApprovalPattern(evidenceClaimsText), "Evidence claim file must not contain approval values");

for (const file of runtimeDecisionFiles) {
  const text = await readProjectFile(file);
  for (const pattern of runtimeImportPatterns) {
    assert(!text.includes(pattern), `${file} must not import evidence claims metadata`);
  }
}

const packageJson = JSON.parse(await readProjectFile("package.json"));
assert(
  packageJson.scripts?.["check:constructor-matrix-evidence-claims"] ===
    "node scripts/check-constructor-matrix-evidence-claims.mjs",
  "package.json must define check:constructor-matrix-evidence-claims",
);

const coreCheckText = await readProjectFile("scripts/check-perform-constructor-core.mjs");
assert(
  coreCheckText.includes("check-constructor-matrix-evidence-claims.mjs"),
  "constructor core check must be aware of evidence claims script",
);
assert(
  coreCheckText.includes("constructor-matrix-evidence-claims.ts"),
  "constructor core check must be aware of evidence claims source file",
);

for (const doc of docsToCheck) {
  const text = await readProjectFile(doc);
  assert(
    text.includes("Stage: P0 Evidence Claim Extraction Registry"),
    `${doc} must document P0 Evidence Claim Extraction Registry`,
  );
  assert(
    text.includes("claim registry intentionally empty"),
    `${doc} must document zero-claim blocker behavior`,
  );
}

const reviewPackage = buildConstructorMatrixLayerReviewPackage({
  generatedAt: "evidence-claims-check",
});
assert(
  reviewPackage.payload.evidenceClaims.evidenceClaimCount === CONSTRUCTOR_MATRIX_EVIDENCE_CLAIMS.length,
  "Review package must include evidence claim count",
);
assert(
  reviewPackage.payload.evidenceClaims.evidenceClaimBlockerCount ===
    CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS.length,
  "Review package must include evidence claim blocker count",
);
assert(
  reviewPackage.markdown.includes("Evidence claims extracted:"),
  "Review package markdown must include evidence claims summary",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      evidenceClaimCount: summary.evidenceClaimCount,
      evidenceClaimBlockerCount: summary.evidenceClaimBlockerCount,
      sourceLookupRecordsCovered: `${summary.sourceLookupRecordsCoveredCount}/${summary.sourceLookupRecordCount}`,
      p0SourceCandidatesCovered: `${summary.p0SourceCandidatesCoveredCount}/${summary.p0SourceCandidateCount}`,
      p0BacklogItemsCovered: `${summary.p0BacklogItemsCoveredCount}/${summary.p0BacklogItemCount}`,
      highRiskAreasCovered: summary.highRiskAreasCovered,
      claimBlockersByReason: summary.claimBlockersByReason,
      humanReviewed: summary.humanReviewed,
      runtimeChangeAllowedNow: summary.runtimeChangeAllowedNow,
    },
    null,
    2,
  ),
);
