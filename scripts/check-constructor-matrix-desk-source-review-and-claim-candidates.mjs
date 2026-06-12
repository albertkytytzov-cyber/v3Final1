import { access, readFile } from "node:fs/promises";

import {
  buildConstructorMatrixLayerReviewPackage,
  buildConstructorMatrixDeskSourceReviewSummary,
  buildConstructorMatrixEvidenceClaimCandidateSummary,
  CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES,
  CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEWS,
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS,
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES,
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES,
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

const deskReviewFile =
  "packages/shared/src/constructor-matrix-desk-source-review.ts";
const claimCandidateFile =
  "packages/shared/src/constructor-matrix-evidence-claim-candidates.ts";
const packageJsonFile = "package.json";
const coreCheckFile = "scripts/check-perform-constructor-core.mjs";
const docsToCheck = [
  "docs/constructor-matrix-evidence-dependency-gap-audit.md",
  "docs/constructor-matrix-source-acquisition-p0-dossier.md",
  "docs/perform-constructor-core-stack.md",
  "docs/constructor-phase-matrix-transition-plan.md",
  "docs/constructor-matrix-preview-fixtures.md",
  "docs/constructor-matrix-production-rollout.md",
];
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
  "constructor-matrix-desk-source-review",
  "CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEWS",
  "DeskSourceReview",
  "constructor-matrix-evidence-claim-candidates",
  "CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES",
  "EvidenceClaimCandidate",
];
const allowedDeskStatuses = new Set([
  "desk_verified_identity",
  "desk_verified_url",
  "desk_review_limited",
  "manual_verification_still_required",
  "full_text_still_required",
  "policy_text_still_required",
  "not_ready_for_claim_extraction",
]);
const allowedDeskUses = new Set([
  "source_identity_only",
  "claim_candidate_support_only",
  "review_packet_support_only",
  "manual_verification_required",
  "do_not_use_for_claims_yet",
]);
const allowedCandidateStatuses = new Set([
  "desk_reviewed_candidate",
  "desk_review_limited_candidate",
  "needs_full_text_before_extraction",
  "needs_policy_text_before_extraction",
  "needs_human_review_before_extraction",
  "manual_verification_required_before_extraction",
  "do_not_automate_candidate",
]);
const allowedRuntimeUseNow = new Set([
  "none",
  "documentation_only",
  "review_export_only",
  "future_claim_extraction_candidate",
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
  "bfr_kaatsu",
  "RED-S",
];

const sourceLookupIds = new Set(CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE.map((item) => item.id));
const sourceLookupById = new Map(CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE.map((item) => [item.id, item]));
const sourceCandidateIds = new Set(CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES.map((item) => item.id));
const backlogIds = new Set(CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG.map((item) => item.id));
const evidenceIds = new Set(CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY.map((item) => item.id));
const dataIds = new Set(CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES.map((item) => item.id));
const thresholdIds = new Set(CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES.map((item) => item.id));
const reviewDecisionIds = new Set(CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER.map((item) => item.id));
const blockerIds = new Set(CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS.map((item) => item.id));
const reviewIntakeIds = new Set(CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES.map((item) => item.id));
const deskReviewIds = new Set(CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEWS.map((item) => item.id));
const manualVerificationSourceLookupIds = new Set(
  CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE
    .filter((item) => item.extractionReadiness === "needs_manual_verification")
    .map((item) => item.id),
);

function assertArray(value, context) {
  assert(Array.isArray(value), `${context} must be an array`);
}

function assertNonEmptyArray(value, context) {
  assertArray(value, context);
  assert(value.length > 0, `${context} must not be empty`);
}

function assertLinkedIds(ids, allowedIds, context) {
  assertArray(ids, context);
  for (const id of ids) {
    assert(allowedIds.has(id), `${context} references unknown id: ${id}`);
  }
}

function uniqueCount(items) {
  return new Set(items).size;
}

function hasSafeNoThresholdPhrase(text) {
  return /\b(no|not|without)\b.{0,80}\b(numeric threshold|numeric thresholds|threshold value|threshold values|runtime threshold|runtime thresholds|cutoff|cutoffs|hard threshold|hard thresholds)\b/i.test(text);
}

function hasForbiddenThresholdText(text) {
  if (
    hasSafeNoThresholdPhrase(text) ||
    /\bthreshold candidate\b/i.test(text) ||
    /\bcandidate threshold\b/i.test(text)
  ) {
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

function assertNoFakeApprovals(text, context) {
  const forbiddenPatterns = [
    /humanReviewed\s*[:=]\s*true/i,
    /"humanReviewed"\s*:\s*true/i,
    /\breviewedBy\b/i,
    /\breviewedAt\b/i,
    /\bmedical approved\b/i,
    /\bcoach approved\b/i,
    /\bsafe for runtime\b/i,
    /\bapproved for runtime\b/i,
    /\bhuman approved\b/i,
    /\bapproved_for_runtime\b/i,
  ];

  for (const pattern of forbiddenPatterns) {
    assert(!pattern.test(text), `${context} contains fake approval marker: ${pattern}`);
  }
}

function assertNoRuntimePromotion(candidate) {
  assert(candidate.runtimeChangeAllowedNow === false, `${candidate.id} allows runtime change`);
  assert(candidate.candidateOnly === true, `${candidate.id} must stay candidate-only`);
  assert(allowedRuntimeUseNow.has(candidate.runtimeUseNow), `${candidate.id} has invalid runtimeUseNow`);
  assert(!/\bruntime|hard_gate|gate\b/i.test(candidate.runtimeUseNow), `${candidate.id} promotes runtime use`);
}

function assertHighRiskReviewTracks(candidate) {
  const areas = new Set(candidate.methodOrRiskArea);
  const reviews = new Set(candidate.reviewRequired);

  if (areas.has("weight_cut") || areas.has("hydration")) {
    assert(reviews.has("medical_review"), `${candidate.id} must require medical review`);
    assert(reviews.has("coach_review"), `${candidate.id} must require coach review`);
  }

  if (
    areas.has("pain") ||
    areas.has("injury") ||
    areas.has("injury_pain") ||
    areas.has("female_context") ||
    areas.has("RED-S") ||
    areas.has("bfr_kaatsu")
  ) {
    assert(reviews.has("medical_review"), `${candidate.id} must require medical review`);
  }

  if (areas.has("youth_context")) {
    assert(
      reviews.has("medical_review") && reviews.has("coach_review"),
      `${candidate.id} must require medical and coach review`,
    );
  }

  if (
    areas.has("wearable_data") ||
    areas.has("sleep") ||
    areas.has("rhr") ||
    areas.has("hrv") ||
    areas.has("readiness")
  ) {
    assert(reviews.has("data_quality_review"), `${candidate.id} must require data-quality review`);
  }

  if (areas.has("lmv") || areas.has("contact_load") || areas.has("taper")) {
    assert(reviews.has("coach_review"), `${candidate.id} must require coach review`);
    assert(reviews.has("sport_science_review"), `${candidate.id} must require sport-science review`);
  }
}

await fileExists(deskReviewFile);
await fileExists(claimCandidateFile);
await fileExists(coreCheckFile);

assert(
  CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEWS.length > 0,
  "CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEWS must not be empty",
);
assert(
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES.length >= 12,
  "CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES must include at least 12 items",
);
assert(
  uniqueCount(CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEWS.map((item) => item.id)) ===
    CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEWS.length,
  "Desk source review ids must be unique",
);
assert(
  uniqueCount(CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES.map((item) => item.id)) ===
    CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES.length,
  "Evidence claim candidate ids must be unique",
);

const coveredSourceLookupIds = new Set();

for (const item of CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEWS) {
  assert(item.id && /^[a-z0-9_]+$/.test(item.id), `Invalid desk source review id: ${item.id}`);
  assertNonEmptyArray(item.sourceLookupIntakeIds, `${item.id}.sourceLookupIntakeIds`);
  assertNonEmptyArray(item.sourceCandidateIds, `${item.id}.sourceCandidateIds`);
  assertArray(item.sourceExpansionBacklogIds, `${item.id}.sourceExpansionBacklogIds`);
  assert(typeof item.title === "string" && item.title.length > 0, `${item.id} must have title`);
  assert(allowedDeskStatuses.has(item.status), `${item.id} has invalid status`);
  assert(allowedDeskUses.has(item.deskReviewUse), `${item.id} has invalid deskReviewUse`);
  assertNonEmptyArray(item.checkedAs, `${item.id}.checkedAs`);
  assertNonEmptyArray(item.confirmedMetadata, `${item.id}.confirmedMetadata`);
  assertNonEmptyArray(item.stillMissing, `${item.id}.stillMissing`);
  assertNonEmptyArray(item.limitations, `${item.id}.limitations`);
  assertNonEmptyArray(item.allowedNextActions, `${item.id}.allowedNextActions`);
  assertNonEmptyArray(item.prohibitedActions, `${item.id}.prohibitedActions`);
  assert(item.humanReviewed === false, `${item.id} must keep humanReviewed=false`);
  assert(item.runtimeChangeAllowedNow === false, `${item.id} must keep runtimeChangeAllowedNow=false`);
  assertLinkedIds(item.sourceLookupIntakeIds, sourceLookupIds, `${item.id}.sourceLookupIntakeIds`);
  assertLinkedIds(item.sourceCandidateIds, sourceCandidateIds, `${item.id}.sourceCandidateIds`);
  assertLinkedIds(item.sourceExpansionBacklogIds, backlogIds, `${item.id}.sourceExpansionBacklogIds`);
  assertNoFakeApprovals(JSON.stringify(item), item.id);

  for (const sourceLookupId of item.sourceLookupIntakeIds) {
    coveredSourceLookupIds.add(sourceLookupId);
    const lookup = sourceLookupById.get(sourceLookupId);
    if (lookup?.extractionReadiness === "needs_manual_verification") {
      assert(
        item.status === "manual_verification_still_required",
        `${item.id} must keep manual verification status`,
      );
      assert(
        item.deskReviewUse !== "claim_candidate_support_only",
        `${item.id} must not support claim candidates before manual verification`,
      );
      assert(
        item.prohibitedActions.includes("no claim extraction before manual verification"),
        `${item.id} must prohibit claim extraction before manual verification`,
      );
    }
  }
}

for (const sourceLookupId of sourceLookupIds) {
  assert(coveredSourceLookupIds.has(sourceLookupId), `Source lookup record lacks desk review: ${sourceLookupId}`);
}

const highRiskAreasCovered = new Set();

for (const item of CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES) {
  assert(item.id && /^[a-z0-9_]+$/.test(item.id), `Invalid evidence claim candidate id: ${item.id}`);
  assert(allowedCandidateStatuses.has(item.status), `${item.id} has invalid status`);
  assert(typeof item.title === "string" && item.title.length > 0, `${item.id} must have title`);
  assert(typeof item.candidateText === "string" && item.candidateText.length > 0, `${item.id} must have candidateText`);
  assertNonEmptyArray(item.deskSourceReviewIds, `${item.id}.deskSourceReviewIds`);
  assertNonEmptyArray(item.sourceLookupIntakeIds, `${item.id}.sourceLookupIntakeIds`);
  assertNonEmptyArray(item.sourceCandidateIds, `${item.id}.sourceCandidateIds`);
  assertArray(item.sourceExpansionBacklogIds, `${item.id}.sourceExpansionBacklogIds`);
  assertNonEmptyArray(item.evidenceDependencyIds, `${item.id}.evidenceDependencyIds`);
  assertArray(item.dataDependencyIds, `${item.id}.dataDependencyIds`);
  assertArray(item.thresholdCandidateIds, `${item.id}.thresholdCandidateIds`);
  assertArray(item.reviewDecisionIds, `${item.id}.reviewDecisionIds`);
  assertArray(item.blockerIds, `${item.id}.blockerIds`);
  assertArray(item.reviewIntakeIds, `${item.id}.reviewIntakeIds`);
  assertNonEmptyArray(item.methodOrRiskArea, `${item.id}.methodOrRiskArea`);
  assertNonEmptyArray(item.populationContext, `${item.id}.populationContext`);
  assertNonEmptyArray(item.supports, `${item.id}.supports`);
  assertNonEmptyArray(item.limitations, `${item.id}.limitations`);
  assertNonEmptyArray(item.reviewRequired, `${item.id}.reviewRequired`);
  assert(item.humanReviewed === false, `${item.id} must keep humanReviewed=false`);
  assertNoRuntimePromotion(item);
  assertLinkedIds(item.deskSourceReviewIds, deskReviewIds, `${item.id}.deskSourceReviewIds`);
  assertLinkedIds(item.sourceLookupIntakeIds, sourceLookupIds, `${item.id}.sourceLookupIntakeIds`);
  assertLinkedIds(item.sourceCandidateIds, sourceCandidateIds, `${item.id}.sourceCandidateIds`);
  assertLinkedIds(item.sourceExpansionBacklogIds, backlogIds, `${item.id}.sourceExpansionBacklogIds`);
  assertLinkedIds(item.evidenceDependencyIds, evidenceIds, `${item.id}.evidenceDependencyIds`);
  assertLinkedIds(item.dataDependencyIds, dataIds, `${item.id}.dataDependencyIds`);
  assertLinkedIds(item.thresholdCandidateIds, thresholdIds, `${item.id}.thresholdCandidateIds`);
  assertLinkedIds(item.reviewDecisionIds, reviewDecisionIds, `${item.id}.reviewDecisionIds`);
  assertLinkedIds(item.blockerIds, blockerIds, `${item.id}.blockerIds`);
  assertLinkedIds(item.reviewIntakeIds, reviewIntakeIds, `${item.id}.reviewIntakeIds`);
  assertNoFakeApprovals(JSON.stringify(item), item.id);
  assertHighRiskReviewTracks(item);

  assert(
    item.dataDependencyIds.length > 0 ||
      item.limitations.some((text) => /data dependency is not applicable/i.test(text)),
    `${item.id} must link data dependencies or explain why not applicable`,
  );

  for (const sourceLookupId of item.sourceLookupIntakeIds) {
    assert(
      !manualVerificationSourceLookupIds.has(sourceLookupId),
      `${item.id} uses manual-verification source lookup as candidate support: ${sourceLookupId}`,
    );
  }

  for (const text of [item.candidateText, ...item.supports, ...item.limitations]) {
    assert(!hasForbiddenThresholdText(text), `${item.id} contains numeric threshold text: ${text}`);
  }

  for (const area of item.methodOrRiskArea) {
    if (requiredHighRiskAreas.includes(area)) {
      highRiskAreasCovered.add(area);
    }
  }
}

const highRiskAreasStillBlocked = requiredHighRiskAreas.filter(
  (area) => !highRiskAreasCovered.has(area),
);
assert(
  highRiskAreasCovered.size >= 12,
  "Evidence claim candidates must cover the bulk of high-risk areas",
);
assert(
  highRiskAreasStillBlocked.includes("competition_context"),
  "competition_context should remain explicitly blocked until manual/regulatory source verification",
);

const deskSummary = buildConstructorMatrixDeskSourceReviewSummary();
assert(
  deskSummary.sourceLookupRecordsCoveredCount === deskSummary.sourceLookupRecordCount,
  "Desk source review summary must cover every source lookup record",
);
assert(deskSummary.humanReviewedCount === 0, "Desk source review summary must report no human reviews");
assert(deskSummary.runtimeChangeAllowedNowCount === 0, "Desk source review summary must report no runtime changes");

const candidateSummary = buildConstructorMatrixEvidenceClaimCandidateSummary();
assert(
  candidateSummary.evidenceClaimCandidateCount === CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES.length,
  "Candidate summary must count all claim candidates",
);
assert(
  candidateSummary.evidenceClaimCandidatesHumanReviewedCount === 0,
  "Candidate summary must report no human-reviewed candidates",
);
assert(
  candidateSummary.evidenceClaimCandidatesRuntimeChangeAllowedNowCount === 0,
  "Candidate summary must report no runtime changes",
);

const reviewPackage = buildConstructorMatrixLayerReviewPackage({
  generatedAt: "desk-source-review-check",
});
assert(
  reviewPackage.payload.deskSourceReview.deskSourceReviewCount === CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEWS.length,
  "Review package must include desk source review summary",
);
assert(
  reviewPackage.payload.evidenceClaimCandidates.evidenceClaimCandidateCount ===
    CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES.length,
  "Review package must include evidence claim candidate summary",
);
assert(
  reviewPackage.payload.evidenceClaims.evidenceClaimCount === 0,
  "Review package must keep final evidence claims at zero",
);

for (const file of runtimeDecisionFiles) {
  const text = await readProjectFile(file);
  for (const pattern of runtimeImportPatterns) {
    assert(!text.includes(pattern), `${file} must not import desk source review or claim candidates`);
  }
}

const packageJson = JSON.parse(await readProjectFile(packageJsonFile));
assert(
  packageJson.scripts?.["check:constructor-matrix-desk-source-review-and-claim-candidates"] ===
    "node scripts/check-constructor-matrix-desk-source-review-and-claim-candidates.mjs",
  "package.json must define check:constructor-matrix-desk-source-review-and-claim-candidates",
);

const coreCheckText = await readProjectFile(coreCheckFile);
assert(
  coreCheckText.includes("check-constructor-matrix-desk-source-review-and-claim-candidates.mjs"),
  "constructor core check must be aware of desk source review and claim candidate script",
);
assert(
  coreCheckText.includes("constructor-matrix-desk-source-review.ts"),
  "constructor core check must be aware of desk source review source file",
);
assert(
  coreCheckText.includes("constructor-matrix-evidence-claim-candidates.ts"),
  "constructor core check must be aware of evidence claim candidates source file",
);

for (const path of docsToCheck) {
  const source = await readProjectFile(path);
  assert(
    source.includes("Matrix Desk Source Review + Evidence Claim Candidate Extraction"),
    `${path} must document Matrix Desk Source Review + Evidence Claim Candidate Extraction`,
  );
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      counts: {
        sourceLookupRecords: CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE.length,
        deskSourceReviews: CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEWS.length,
        evidenceClaimCandidates: CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES.length,
        finalEvidenceClaims: reviewPackage.payload.evidenceClaims.evidenceClaimCount,
      },
      deskSourceReviewsByStatus: deskSummary.deskSourceReviewsByStatus,
      evidenceClaimCandidatesByStatus: candidateSummary.evidenceClaimCandidatesByStatus,
      highRiskAreasCovered: Array.from(highRiskAreasCovered).sort(),
      highRiskAreasStillBlocked,
      manualVerificationSourceLookupIds: Array.from(manualVerificationSourceLookupIds).sort(),
      runtimeBehaviorChanged: false,
      humanReviewedRecords: 0,
      runtimeChangeAllowedNowRecords: 0,
    },
    null,
    2,
  ),
);
