import { access, readFile } from "node:fs/promises";

import {
  buildConstructorMatrixLayerReviewPackage,
  buildConstructorMatrixSourceLookupIntakeSummary,
  CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES,
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

const sourceLookupFile =
  "packages/shared/src/constructor-matrix-source-lookup-intake.ts";
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
const docsToCheck = [
  "docs/constructor-matrix-evidence-dependency-gap-audit.md",
  "docs/constructor-matrix-source-acquisition-p0-dossier.md",
  "docs/perform-constructor-core-stack.md",
  "docs/constructor-phase-matrix-transition-plan.md",
  "docs/constructor-matrix-preview-fixtures.md",
  "docs/constructor-matrix-production-rollout.md",
];

const allowedStatuses = new Set([
  "verified_exact_source",
  "verified_official_source",
  "verified_peer_reviewed_source",
  "verified_consensus_or_position_stand",
  "verified_regulatory_source",
  "partial_match",
  "not_found",
  "access_blocked",
  "lookup_unavailable",
  "needs_manual_lookup",
]);
const allowedReliability = new Set([
  "official_policy",
  "peer_reviewed",
  "systematic_review",
  "meta_analysis",
  "consensus_statement",
  "position_stand",
  "regulatory_source",
  "official_federation_rule",
  "internal_doc_only",
  "candidate_only",
  "unknown",
]);
const allowedUsePermissions = new Set([
  "citation_metadata_only",
  "evidence_claim_extraction_candidate",
  "coach_review_context_only",
  "medical_review_context_only",
  "data_quality_review_context_only",
  "do_not_use_for_rules",
]);
const allowedLookupMethods = new Set([
  "external_web_lookup",
  "existing_docs_only",
  "manual_placeholder",
  "not_attempted",
]);
const allowedExtractionReadiness = new Set([
  "ready_for_claim_extraction",
  "needs_full_text_or_abstract",
  "needs_manual_verification",
  "not_ready",
]);
const allowedReviewTracks = new Set([
  "coach",
  "medical",
  "data_quality",
  "sport_science",
  "product_safety",
]);
const highRiskMedicalCandidateAreas = new Set([
  "weight_cut",
  "hydration",
  "pain",
  "injury",
  "female_context",
  "reds",
  "youth_context",
  "bfr_kaatsu",
]);
const highRiskDataCandidateAreas = new Set([
  "wearable_data",
  "readiness",
  "sleep",
  "rhr",
  "hrv",
]);
const runtimeImportPatterns = [
  "constructor-matrix-source-lookup-intake",
  "CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE",
  "SourceLookupIntake",
];

const evidenceIds = new Set(CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY.map((item) => item.id));
const dataIds = new Set(CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES.map((item) => item.id));
const thresholdIds = new Set(CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES.map((item) => item.id));
const ledgerIds = new Set(CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER.map((item) => item.id));
const backlogIds = new Set(CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG.map((item) => item.id));
const sourceCandidateIds = new Set(CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES.map((item) => item.id));
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
    /\breviewedBy\b/i.test(text) ||
    /\breviewedAt\b/i.test(text) ||
    /\bacceptedBy\b/i.test(text) ||
    /\bapprovalDate\b/i.test(text)
  );
}

function hasForbiddenThresholdText(text) {
  return (
    />=|<=/.test(text) ||
    /\bbpm threshold\b/i.test(text) ||
    /\bkg limit\b/i.test(text) ||
    /\bpercent cutoff\b/i.test(text) ||
    /\bpain score cutoff\b/i.test(text) ||
    /\bhard threshold value\b/i.test(text)
  );
}

function looksLikeDoi(value) {
  return /^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i.test(value);
}

function looksLikeUrl(value) {
  return /^https:\/\/[^\s]+$/i.test(value);
}

function textFields(item) {
  return [
    item.title,
    item.publisherOrOrganization ?? "",
    ...item.authors,
    ...item.verificationNotes,
    ...item.limitations,
    ...item.forbiddenRuntimeUseNow,
  ];
}

await fileExists(sourceLookupFile);
await fileExists(coreCheckFile);

assert(
  CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE.length > 0,
  "CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE must not be empty",
);
assert(
  CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE.length >= 12,
  "Source lookup intake must have at least 12 records",
);

const intakeIds = new Set(CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE.map((item) => item.id));
assert(
  intakeIds.size === CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE.length,
  "Source lookup intake ids must be unique",
);

const coveredBacklogIds = new Set();
const coveredSourceCandidateIds = new Set();
const linkedEvidenceIds = new Set();
const linkedDataIds = new Set();
const linkedThresholdIds = new Set();
const linkedReviewDecisionIds = new Set();

for (const item of CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE) {
  assert(item.id && /^[a-z0-9_]+$/.test(item.id), `Invalid source lookup intake id: ${item.id}`);
  assert(sourceCandidateIds.has(item.sourceCandidateId), `${item.id} has unknown sourceCandidateId`);
  assert(Array.isArray(item.sourceExpansionBacklogIds), `${item.id} must have sourceExpansionBacklogIds`);
  assert(Array.isArray(item.linkedEvidenceDependencyIds), `${item.id} must have linkedEvidenceDependencyIds`);
  assert(Array.isArray(item.linkedDataDependencyIds), `${item.id} must have linkedDataDependencyIds`);
  assert(Array.isArray(item.linkedThresholdCandidateIds), `${item.id} must have linkedThresholdCandidateIds`);
  assert(Array.isArray(item.linkedReviewDecisionIds), `${item.id} must have linkedReviewDecisionIds`);
  assert(allowedStatuses.has(item.lookupStatus), `${item.id} has invalid lookupStatus`);
  assert(allowedReliability.has(item.reliability), `${item.id} has invalid reliability`);
  assert(allowedUsePermissions.has(item.usePermission), `${item.id} has invalid usePermission`);
  assert(typeof item.title === "string" && item.title.length > 0, `${item.id} must have title`);
  assert(Array.isArray(item.authors), `${item.id} must have authors array`);
  assert("year" in item, `${item.id} must have year field`);
  assert("sourceUrl" in item, `${item.id} must have sourceUrl field`);
  assert("doi" in item, `${item.id} must have doi field`);
  assert("pmid" in item, `${item.id} must have pmid field`);
  assert("publisherOrOrganization" in item, `${item.id} must have publisherOrOrganization field`);
  assert(allowedLookupMethods.has(item.lookupMethod), `${item.id} has invalid lookupMethod`);
  assert(Array.isArray(item.verificationNotes) && item.verificationNotes.length > 0, `${item.id} must have verificationNotes`);
  assert(allowedExtractionReadiness.has(item.extractionReadiness), `${item.id} has invalid extractionReadiness`);
  assert(Array.isArray(item.reviewRequired) && item.reviewRequired.length > 0, `${item.id} must have reviewRequired`);
  assert(Array.isArray(item.limitations) && item.limitations.length > 0, `${item.id} must have limitations`);
  assert(Array.isArray(item.forbiddenRuntimeUseNow) && item.forbiddenRuntimeUseNow.length > 0, `${item.id} must have forbiddenRuntimeUseNow`);
  assert(item.runtimeChangeAllowedNow === false, `${item.id} must have runtimeChangeAllowedNow=false`);

  coveredSourceCandidateIds.add(item.sourceCandidateId);

  for (const backlogId of item.sourceExpansionBacklogIds) {
    assert(backlogIds.has(backlogId), `${item.id} references unknown backlog id: ${backlogId}`);
    coveredBacklogIds.add(backlogId);
  }
  for (const evidenceId of item.linkedEvidenceDependencyIds) {
    assert(evidenceIds.has(evidenceId), `${item.id} references unknown evidence id: ${evidenceId}`);
    linkedEvidenceIds.add(evidenceId);
  }
  for (const dataId of item.linkedDataDependencyIds) {
    assert(dataIds.has(dataId), `${item.id} references unknown data id: ${dataId}`);
    linkedDataIds.add(dataId);
  }
  for (const thresholdId of item.linkedThresholdCandidateIds) {
    assert(thresholdIds.has(thresholdId), `${item.id} references unknown threshold id: ${thresholdId}`);
    linkedThresholdIds.add(thresholdId);
  }
  for (const reviewDecisionId of item.linkedReviewDecisionIds) {
    assert(ledgerIds.has(reviewDecisionId), `${item.id} references unknown review decision id: ${reviewDecisionId}`);
    linkedReviewDecisionIds.add(reviewDecisionId);
  }
  for (const track of item.reviewRequired) {
    assert(allowedReviewTracks.has(track), `${item.id} has invalid review track: ${track}`);
  }

  const sourceCandidate = sourceCandidateById.get(item.sourceCandidateId);
  assert(sourceCandidate, `${item.id} must resolve source candidate`);
  assert(item.linkedEvidenceDependencyIds.length > 0, `${item.id} must link at least one evidence dependency`);
  assert(item.linkedReviewDecisionIds.length > 0, `${item.id} must link at least one review decision`);
  if (sourceCandidate.linkedDataDependencyIds.length > 0) {
    assert(item.linkedDataDependencyIds.length > 0, `${item.id} must link at least one data dependency`);
  }
  if (sourceCandidate.linkedThresholdCandidateIds.length > 0) {
    assert(item.linkedThresholdCandidateIds.length > 0, `${item.id} must link threshold candidates`);
  }
  if (highRiskMedicalCandidateAreas.has(sourceCandidate.area)) {
    assert(
      item.reviewRequired.includes("medical"),
      `${item.id} high-risk medical source candidate must require medical review`,
    );
  }
  if (highRiskDataCandidateAreas.has(sourceCandidate.area)) {
    assert(
      item.reviewRequired.includes("data_quality") || item.reviewRequired.includes("sport_science"),
      `${item.id} data-quality source candidate must require data-quality or sport-science review`,
    );
  }

  if (item.lookupStatus.startsWith("verified_")) {
    assert(
      item.sourceUrl || item.doi || item.pmid || (
        (item.reliability === "official_policy" || item.reliability === "regulatory_source") &&
        item.publisherOrOrganization
      ),
      `${item.id} verified source must have URL, DOI, PMID, or official organization metadata`,
    );
  } else {
    assert(
      item.usePermission !== "evidence_claim_extraction_candidate",
      `${item.id} unverified source cannot be an extraction candidate`,
    );
    assert(
      item.extractionReadiness !== "ready_for_claim_extraction",
      `${item.id} unverified source cannot be ready for extraction`,
    );
  }

  if (item.doi) {
    assert(looksLikeDoi(item.doi), `${item.id} DOI does not look valid: ${item.doi}`);
  }
  if (item.pmid) {
    assert(/^\d+$/.test(item.pmid), `${item.id} PMID must be digits only: ${item.pmid}`);
  }
  if (item.sourceUrl) {
    assert(looksLikeUrl(item.sourceUrl), `${item.id} sourceUrl must be an https URL`);
  }

  for (const text of textFields(item)) {
    assert(!hasForbiddenThresholdText(text), `${item.id} contains numeric hard cutoff language: ${text}`);
    assert(!hasHumanApprovalPattern(text), `${item.id} contains human approval wording: ${text}`);
  }
}

for (const backlogId of p0BacklogIds) {
  assert(coveredBacklogIds.has(backlogId), `Missing source lookup intake for P0 backlog: ${backlogId}`);
}
for (const sourceCandidateId of p0SourceCandidateIds) {
  assert(
    coveredSourceCandidateIds.has(sourceCandidateId),
    `Missing source lookup intake for P0 source candidate: ${sourceCandidateId}`,
  );
}

const sourceLookupText = await readProjectFile(sourceLookupFile);
assert(!hasHumanApprovalPattern(sourceLookupText), "Source lookup intake file must not contain human approval fields");
assert(
  !/accepted into runtime|approved for runtime|approved_for_runtime|approved_for_hard_rule/i.test(sourceLookupText),
  "Source lookup intake must not approve runtime use",
);

for (const file of runtimeDecisionFiles) {
  const text = await readProjectFile(file);
  for (const pattern of runtimeImportPatterns) {
    assert(!text.includes(pattern), `${file} must not import source lookup intake metadata`);
  }
}

const packageJson = JSON.parse(await readProjectFile(packageJsonFile));
assert(
  packageJson.scripts?.["check:constructor-matrix-source-lookup-intake"] ===
    "node scripts/check-constructor-matrix-source-lookup-intake.mjs",
  "package.json must define check:constructor-matrix-source-lookup-intake",
);

const coreCheckText = await readProjectFile(coreCheckFile);
assert(
  coreCheckText.includes("check-constructor-matrix-source-lookup-intake.mjs"),
  "constructor core check must be aware of source lookup intake script",
);
assert(
  coreCheckText.includes("constructor-matrix-source-lookup-intake.ts"),
  "constructor core check must be aware of source lookup intake source file",
);

for (const doc of docsToCheck) {
  const text = await readProjectFile(doc);
  assert(
    text.includes("Stage: P0 Controlled Source Lookup + Source Intake Registry"),
    `${doc} must document the source lookup intake stage`,
  );
}

const summary = buildConstructorMatrixSourceLookupIntakeSummary();
assert(summary.sourceLookupIntakeCount === CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE.length, "summary count mismatch");
assert(summary.sourceLookupRuntimeChangeAllowedNow === false, "source lookup runtime changes must remain false");
assert(summary.p0BacklogCoverage.missingP0BacklogIds.length === 0, "summary reports missing P0 backlog coverage");
assert(summary.p0SourceCandidateCoverage.missingP0SourceCandidateIds.length === 0, "summary reports missing P0 source candidate coverage");

const reviewPackage = buildConstructorMatrixLayerReviewPackage({
  generatedAt: "source-lookup-intake-check",
});
assert(
  reviewPackage.payload.sourceLookupIntake.sourceLookupIntakeCount ===
    CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE.length,
  "Review package must include source lookup intake summary",
);
assert(
  reviewPackage.payload.sourceLookupIntake.sourceLookupRuntimeChangeAllowedNow === false,
  "Review package source lookup summary must keep runtimeChangeAllowedNow=false",
);
assert(
  reviewPackage.markdown.includes("Source lookup intake records:"),
  "Review package markdown must include source lookup intake counts",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      sourceLookupIntakeCount: summary.sourceLookupIntakeCount,
      verifiedSourceCount: summary.verifiedSourceCount,
      manualLookupNeededCount: summary.manualLookupNeededCount,
      extractionReadyCount: summary.extractionReadyCount,
      lookupUnavailableCount: summary.lookupUnavailableCount,
      p0BacklogCoverage: summary.p0BacklogCoverage,
      p0SourceCandidateCoverage: summary.p0SourceCandidateCoverage,
      linkedEvidenceDependencyCount: linkedEvidenceIds.size,
      linkedDataDependencyCount: linkedDataIds.size,
      linkedThresholdCandidateCount: linkedThresholdIds.size,
      linkedReviewDecisionCount: linkedReviewDecisionIds.size,
    },
    null,
    2,
  ),
);
