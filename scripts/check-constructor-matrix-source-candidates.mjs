import { access, readFile } from "node:fs/promises";

import {
  buildConstructorMatrixLayerReviewPackage,
  buildConstructorMatrixSourceAcquisitionSummary,
  CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES,
  CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY,
  CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER,
  CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES,
  CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG,
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

const requiredAreas = new Set([
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
  "reds",
  "youth_context",
  "contact_load",
  "lmv",
  "bfr_kaatsu",
  "taper",
  "competition_model",
  "product_safety",
]);
const allowedAreas = new Set([
  ...requiredAreas,
  "travel_fatigue",
  "competition_context",
]);
const allowedNeedTypes = new Set([
  "systematic_review",
  "meta_analysis",
  "consensus_statement",
  "position_stand",
  "official_regulation",
  "peer_reviewed_intervention",
  "observational_study",
  "validity_reliability_study",
  "sport_specific_review",
  "combat_sport_transfer_evidence",
  "clinical_guideline",
  "internal_validation_protocol",
  "product_safety_policy",
]);
const allowedStatuses = new Set([
  "needs_external_lookup",
  "mentioned_in_existing_docs",
  "candidate_source_identified",
  "requires_verification",
  "accepted_for_claim_extraction",
  "rejected",
  "do_not_use",
]);
const allowedTracks = new Set([
  "coach",
  "medical",
  "data_quality",
  "sport_science",
  "product_safety",
]);
const allowedFutureTargetLayers = new Set([
  "evidence_claim_extraction",
  "threshold_candidate_update",
  "data_dependency_update",
  "review_decision_update",
  "review_export",
  "risk_check_future",
  "block_eligibility_future",
  "volume_allocator_future",
  "rollout_gate_future",
]);
const highRiskAreas = new Set([
  "weight_cut",
  "hydration",
  "pain",
  "injury",
  "female_context",
  "reds",
  "youth_context",
  "bfr_kaatsu",
  "contact_load",
  "lmv",
  "taper",
]);
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
  "constructor-matrix-source-candidates",
  "CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES",
  "SourceCandidate",
];
const docsToCheck = [
  "docs/constructor-matrix-evidence-dependency-gap-audit.md",
  "docs/perform-constructor-core-stack.md",
  "docs/constructor-phase-matrix-transition-plan.md",
  "docs/constructor-matrix-preview-fixtures.md",
  "docs/constructor-matrix-production-rollout.md",
];

const evidenceIds = new Set(CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY.map((item) => item.id));
const dataIds = new Set(CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES.map((item) => item.id));
const thresholdIds = new Set(CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES.map((item) => item.id));
const ledgerIds = new Set(CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER.map((item) => item.id));
const backlogIds = new Set(CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG.map((item) => item.id));
const p0BacklogIds = CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG
  .filter((item) => item.priority === "P0")
  .map((item) => item.id);

function isAllowedNoThresholdSentence(text) {
  return /\b(no|without|not|нет|без)\b.{0,80}\b(numeric threshold|numeric thresholds|threshold value|threshold values|threshold|thresholds|cutoff|cutoffs)\b/i.test(text);
}

function hasForbiddenThresholdText(text) {
  if (/\bthreshold candidate\b/i.test(text) || /\bcandidate threshold\b/i.test(text)) {
    return false;
  }

  if (isAllowedNoThresholdSentence(text)) {
    return false;
  }

  return (
    />=|<=/.test(text) ||
    /\s>\s|\s<\s/.test(text) ||
    /[0-9]+\s*(%|kg|кг|bpm|уд\/мин)/i.test(text) ||
    /\b[0-9]+\/10\b/i.test(text) ||
    /\b(cutoff value|threshold value|fixed numeric cutoff)\b/i.test(text)
  );
}

function hasBibliographyPattern(text) {
  return (
    /\b(PMID|DOI):/i.test(text) ||
    /\b10\.\d{4,9}\//i.test(text) ||
    /\bet al\./i.test(text) ||
    /\b(?:19|20)\d{2}\b.*\b(study|paper|trial|review|citation|source)\b/i.test(text)
  );
}

function hasHumanApprovalPattern(text) {
  return (
    /humanReviewed\s*:\s*true/i.test(text) ||
    /\breviewedBy\b/i.test(text) ||
    /\breviewedAt\b/i.test(text) ||
    /\bapproved by\b/i.test(text)
  );
}

function textFields(item) {
  return [
    item.title,
    ...item.acceptanceCriteria,
    ...item.rejectionCriteria,
    ...item.extractionQuestions,
    ...item.requiredBibliographicFields,
    ...item.candidateSourceNotes,
    ...item.forbiddenUseUntilAccepted,
  ];
}

await fileExists("packages/shared/src/constructor-matrix-source-candidates.ts");
await fileExists("docs/constructor-matrix-source-acquisition-p0-dossier.md");

assert(
  CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES.length > 0,
  "CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES must not be empty",
);

const candidateIds = new Set(CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES.map((item) => item.id));
assert(
  candidateIds.size === CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES.length,
  "Source candidate ids must be unique",
);

const coveredAreas = new Set();
const linkedBacklogIds = new Set();
const linkedEvidenceIds = new Set();
const linkedDataIds = new Set();
const linkedThresholdIds = new Set();
const linkedReviewDecisionIds = new Set();
const p0LinkedCandidateIds = new Set();

for (const item of CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES) {
  assert(item.id && /^[a-z0-9_]+$/.test(item.id), `Invalid source candidate id: ${item.id}`);
  assert(allowedAreas.has(item.area), `${item.id} has invalid area: ${item.area}`);
  assert(typeof item.title === "string" && item.title.length > 0, `${item.id} must have title`);
  assert(allowedNeedTypes.has(item.needType), `${item.id} has invalid needType: ${item.needType}`);
  assert(allowedStatuses.has(item.status), `${item.id} has invalid status: ${item.status}`);
  assert(Array.isArray(item.linkedSourceExpansionBacklogIds), `${item.id} must have linkedSourceExpansionBacklogIds`);
  assert(Array.isArray(item.linkedEvidenceDependencyIds), `${item.id} must have linkedEvidenceDependencyIds`);
  assert(Array.isArray(item.linkedDataDependencyIds), `${item.id} must have linkedDataDependencyIds`);
  assert(Array.isArray(item.linkedThresholdCandidateIds), `${item.id} must have linkedThresholdCandidateIds`);
  assert(Array.isArray(item.linkedReviewDecisionIds), `${item.id} must have linkedReviewDecisionIds`);
  assert(Array.isArray(item.reviewTracks), `${item.id} must have reviewTracks`);
  assert(Array.isArray(item.acceptanceCriteria) && item.acceptanceCriteria.length > 0, `${item.id} must have acceptanceCriteria`);
  assert(Array.isArray(item.rejectionCriteria) && item.rejectionCriteria.length > 0, `${item.id} must have rejectionCriteria`);
  assert(Array.isArray(item.extractionQuestions) && item.extractionQuestions.length > 0, `${item.id} must have extractionQuestions`);
  assert(Array.isArray(item.requiredBibliographicFields) && item.requiredBibliographicFields.length > 0, `${item.id} must have requiredBibliographicFields`);
  assert(Array.isArray(item.candidateSourceNotes) && item.candidateSourceNotes.length > 0, `${item.id} must have candidateSourceNotes`);
  assert(Array.isArray(item.forbiddenUseUntilAccepted) && item.forbiddenUseUntilAccepted.length > 0, `${item.id} must have forbiddenUseUntilAccepted`);
  assert(Array.isArray(item.futureTargetLayers) && item.futureTargetLayers.length > 0, `${item.id} must have futureTargetLayers`);
  assert(item.runtimeChangeAllowedNow === false, `${item.id} must have runtimeChangeAllowedNow=false`);
  assert(item.status !== "accepted_for_claim_extraction", `${item.id} must not be accepted in this stage`);

  coveredAreas.add(item.area);

  if (highRiskAreas.has(item.area)) {
    assert(item.reviewTracks.length > 0, `${item.id} high-risk item must have review tracks`);
  }

  for (const track of item.reviewTracks) {
    assert(allowedTracks.has(track), `${item.id} has invalid review track: ${track}`);
  }

  for (const futureTargetLayer of item.futureTargetLayers) {
    assert(
      allowedFutureTargetLayers.has(futureTargetLayer),
      `${item.id} has invalid future target layer: ${futureTargetLayer}`,
    );
  }

  for (const backlogId of item.linkedSourceExpansionBacklogIds) {
    assert(backlogIds.has(backlogId), `${item.id} references unknown source expansion backlog id: ${backlogId}`);
    linkedBacklogIds.add(backlogId);
    if (p0BacklogIds.includes(backlogId)) {
      p0LinkedCandidateIds.add(item.id);
      assert(
        item.status !== "accepted_for_claim_extraction",
        `${item.id} links P0 backlog and must not be accepted without verified source metadata`,
      );
    }
  }

  for (const evidenceId of item.linkedEvidenceDependencyIds) {
    assert(evidenceIds.has(evidenceId), `${item.id} references unknown evidence dependency: ${evidenceId}`);
    linkedEvidenceIds.add(evidenceId);
  }

  for (const dataId of item.linkedDataDependencyIds) {
    assert(dataIds.has(dataId), `${item.id} references unknown data dependency: ${dataId}`);
    linkedDataIds.add(dataId);
  }

  for (const thresholdId of item.linkedThresholdCandidateIds) {
    assert(thresholdIds.has(thresholdId), `${item.id} references unknown threshold candidate: ${thresholdId}`);
    linkedThresholdIds.add(thresholdId);
  }

  if (item.area !== "product_safety") {
    assert(item.linkedReviewDecisionIds.length > 0, `${item.id} must link review decision ids`);
  }

  for (const reviewDecisionId of item.linkedReviewDecisionIds) {
    assert(ledgerIds.has(reviewDecisionId), `${item.id} references unknown review decision id: ${reviewDecisionId}`);
    linkedReviewDecisionIds.add(reviewDecisionId);
  }

  for (const text of textFields(item)) {
    if (hasBibliographyPattern(text)) {
      assert(
        ["requires_verification", "accepted_for_claim_extraction"].includes(item.status) &&
          item.requiredBibliographicFields.some((field) => /verification/i.test(field)),
        `${item.id} has raw bibliography-like text without verification status`,
      );
    }

    assert(!hasForbiddenThresholdText(text), `${item.id} introduces numeric threshold-like text: ${text}`);
    assert(!hasHumanApprovalPattern(text), `${item.id} includes human approval-like text: ${text}`);
  }
}

for (const area of requiredAreas) {
  assert(coveredAreas.has(area), `Missing source candidate area coverage: ${area}`);
}

for (const backlogId of p0BacklogIds) {
  assert(linkedBacklogIds.has(backlogId), `P0 source expansion backlog item has no source candidate: ${backlogId}`);
}

const source = await readProjectFile("packages/shared/src/constructor-matrix-source-candidates.ts");
assert(!hasHumanApprovalPattern(source), "Source candidate registry must not include human approvals");
assert(!/\bruntimeChangeAllowedNow\s*:\s*true\b/i.test(source), "Source candidates must not allow runtime changes");

const indexSource = await readProjectFile("packages/shared/src/index.ts");
assert(
  indexSource.includes("constructor-matrix-source-candidates"),
  "Shared index must export constructor-matrix-source-candidates",
);

for (const path of runtimeDecisionFiles) {
  const fileSource = await readProjectFile(path);
  for (const pattern of runtimeImportPatterns) {
    assert(!fileSource.includes(pattern), `${path} must not import source candidates: ${pattern}`);
  }
}

const reviewPackage = buildConstructorMatrixLayerReviewPackage({
  generatedAt: "2026-06-12T12:00:00.000Z",
});
assert(
  reviewPackage.payload.sourceAcquisition?.totalCandidates === CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES.length,
  "Review package must include source acquisition candidate count",
);
assert(
  reviewPackage.payload.sourceAcquisition?.p0BacklogCoverage?.missingP0BacklogIds.length === 0,
  "Review package source acquisition summary must cover every P0 backlog item",
);
assert(
  reviewPackage.payload.sourceAcquisition?.runtimeChangeAllowedNow === false,
  "Review package source acquisition summary must keep runtimeChangeAllowedNow=false",
);

const sourceAcquisitionSummary = buildConstructorMatrixSourceAcquisitionSummary();
assert(
  sourceAcquisitionSummary.p0BacklogCoverage.missingP0BacklogIds.length === 0,
  "Source acquisition summary must cover every P0 backlog item",
);

for (const path of docsToCheck) {
  const docSource = await readProjectFile(path);
  assert(
    docSource.includes("P0 Source Acquisition Dossier + Source Candidate Registry"),
    `${path} must document P0 Source Acquisition Dossier + Source Candidate Registry`,
  );
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      sourceCandidates: CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES.length,
      p0BacklogCoverage: sourceAcquisitionSummary.p0BacklogCoverage,
      areaCoverage: Array.from(coveredAreas).sort(),
      reviewTrackCounts: CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES.reduce((counts, item) => {
        for (const track of item.reviewTracks) {
          counts[track] = (counts[track] ?? 0) + 1;
        }
        return counts;
      }, {}),
      linkedSourceExpansionBacklogIds: Array.from(linkedBacklogIds).sort(),
      linkedEvidenceDependencyIds: Array.from(linkedEvidenceIds).sort(),
      linkedDataDependencyIds: Array.from(linkedDataIds).sort(),
      linkedThresholdCandidateIds: Array.from(linkedThresholdIds).sort(),
      linkedReviewDecisionCount: linkedReviewDecisionIds.size,
      p0LinkedCandidateIds: Array.from(p0LinkedCandidateIds).sort(),
      runtimeChangeAllowedNow: false,
      runtimeImportsAdded: false,
      numericThresholdsAdded: false,
      fakeCitationsAdded: false,
      fakeHumanApprovalsAdded: false,
    },
    null,
    2,
  ),
);
