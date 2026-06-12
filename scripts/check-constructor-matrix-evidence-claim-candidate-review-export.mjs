import { access, readFile } from "node:fs/promises";

import {
  buildConstructorMatrixClaimCandidateReviewExportPack,
  buildConstructorMatrixLayerReviewPackage,
  CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES,
  CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEWS,
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS,
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES,
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIMS,
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES,
  CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY,
  CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER,
  CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES,
  CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG,
  CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE,
  CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES,
  renderConstructorMatrixClaimCandidateAudienceMarkdown,
  renderConstructorMatrixClaimCandidateReviewExportMarkdown,
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

const exportSourceFile =
  "packages/shared/src/constructor-matrix-evidence-claim-candidate-review-export.ts";
const exportDir = "docs/matrix-claim-candidate-review-export";
const requiredExportFiles = [
  "README.md",
  "claim-candidate-review-export.json",
  "all-candidates.md",
  "coach-review.md",
  "medical-review.md",
  "data-quality-review.md",
  "sport-science-review.md",
  "product-safety-review.md",
  "manual-source-verification.md",
  "source-text-acquisition.md",
];
const audienceFiles = {
  coach: "coach-review.md",
  medical: "medical-review.md",
  data_quality: "data-quality-review.md",
  sport_science: "sport-science-review.md",
  product_safety: "product-safety-review.md",
  manual_source_verification: "manual-source-verification.md",
  source_text_acquisition: "source-text-acquisition.md",
};
const reviewRequirementAudience = {
  coach_review: "coach",
  medical_review: "medical",
  data_quality_review: "data_quality",
  sport_science_review: "sport_science",
  product_safety_review: "product_safety",
  manual_source_verification: "manual_source_verification",
};
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
  "constructor-matrix-evidence-claim-candidate-review-export",
  "buildConstructorMatrixClaimCandidateReviewExportPack",
  "ClaimCandidateReviewExportPack",
];
const docsToCheck = [
  "docs/constructor-matrix-evidence-dependency-gap-audit.md",
  "docs/constructor-matrix-source-acquisition-p0-dossier.md",
  "docs/perform-constructor-core-stack.md",
  "docs/constructor-phase-matrix-transition-plan.md",
  "docs/constructor-matrix-preview-fixtures.md",
  "docs/constructor-matrix-production-rollout.md",
];
const allowedAudiences = new Set(Object.keys(audienceFiles));
const candidateIds = new Set(CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES.map((item) => item.id));
const deskReviewIds = new Set(CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEWS.map((item) => item.id));
const sourceLookupIds = new Set(CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE.map((item) => item.id));
const sourceCandidateIds = new Set(CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES.map((item) => item.id));
const backlogIds = new Set(CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG.map((item) => item.id));
const evidenceIds = new Set(CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY.map((item) => item.id));
const dataIds = new Set(CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES.map((item) => item.id));
const thresholdIds = new Set(CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES.map((item) => item.id));
const reviewDecisionIds = new Set(CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER.map((item) => item.id));
const blockerIds = new Set(CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS.map((item) => item.id));
const reviewIntakeIds = new Set(CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES.map((item) => item.id));

function hasAllowedNoThresholdPhrase(text) {
  return /\b(no|not|without)\b.{0,80}\b(numeric threshold|threshold value|runtime threshold|cutoff|hard threshold)\b/i.test(text);
}

function hasForbiddenThresholdText(text) {
  if (
    hasAllowedNoThresholdPhrase(text) ||
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

function hasForbiddenFinalClaimPromotion(text) {
  return (
    /\bpromoted to claim\b/i.test(text) ||
    /\bextracted final claim\b/i.test(text) ||
    /\bsource readiness updated\b/i.test(text) ||
    /\bcandidate approved\b/i.test(text) ||
    /\bfinal evidence claim\b/i.test(text) &&
      !/\bnot a final evidence claim\b/i.test(text) &&
      !/\bfinal evidence claim count\b/i.test(text) &&
      !/\bfinalEvidenceClaimCount\b/.test(text)
  );
}

function assertSafeText(text, context) {
  const fakeApprovalPatterns = [
    /humanReviewed\s*=\s*true/i,
    /"humanReviewed"\s*:\s*true/i,
    /\breviewedBy\b/i,
    /\breviewedAt\b/i,
    /\bapproved by\b/i,
    /\bapproved_for_runtime\b/i,
    /\breviewer signed\b/i,
    /\bcompleted review\b/i,
    /\bcoach approved\b/i,
    /\bmedical approved\b/i,
    /\bsafe for runtime\b/i,
  ];
  const runtimePromotionPatterns = [
    /runtimeChangeAllowedNow\s*=\s*true/i,
    /"runtimeChangeAllowedNow"\s*:\s*true/i,
    /\bMatrix default enabled\b/i,
    /\bproduction route changed\b/i,
    /\brollout gate changed\b/i,
    /\bpromoted to runtime\b/i,
  ];
  const piiPatterns = [
    /\bdate of birth\b/i,
    /\bpassport\b/i,
    /\bphone\b/i,
    /\bemail\b/i,
    /\baddress\b/i,
    /\bmedical record\b/i,
    /\bproduction user id\b/i,
    /\bathlete name\b/i,
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    /\b(?:\+?\d[\s().-]*){9,}\b/,
  ];

  for (const pattern of fakeApprovalPatterns) {
    assert(!pattern.test(text), `${context} contains fake approval marker: ${pattern}`);
  }
  for (const pattern of runtimePromotionPatterns) {
    assert(!pattern.test(text), `${context} contains runtime promotion marker: ${pattern}`);
  }
  for (const pattern of piiPatterns) {
    assert(!pattern.test(text), `${context} contains sensitive data marker: ${pattern}`);
  }
  assert(!hasForbiddenFinalClaimPromotion(text), `${context} contains final claim promotion text`);
  assert(!hasForbiddenThresholdText(text), `${context} contains numeric threshold text`);
}

function assertLinkedIds(ids, validIds, context) {
  assert(Array.isArray(ids), `${context} must be an array`);
  for (const id of ids) {
    assert(validIds.has(id), `${context} references unknown id: ${id}`);
  }
}

await fileExists(exportSourceFile);
await fileExists(exportDir);

for (const file of requiredExportFiles) {
  await fileExists(`${exportDir}/${file}`);
}

const expectedPack = buildConstructorMatrixClaimCandidateReviewExportPack();
const exportJsonText = await readProjectFile(`${exportDir}/claim-candidate-review-export.json`);
const exportJson = JSON.parse(exportJsonText);

assert(
  exportJsonText === `${JSON.stringify(expectedPack, null, 2)}\n`,
  "claim-candidate-review-export.json must match builder output",
);
assert(
  exportJson.generatedFrom === "constructor_matrix_evidence_claim_candidates",
  "Claim candidate review export JSON must identify source",
);
assert(exportJson.runtimeChangeAllowedNow === false, "Export JSON must keep runtimeChangeAllowedNow=false");
assert(exportJson.humanReviewed === false, "Export JSON must keep humanReviewed=false");
assert(exportJson.candidateOnly === true, "Export JSON must keep candidateOnly=true");
assert(exportJson.summary, "Export JSON must include summary");
assert(Array.isArray(exportJson.items), "Export JSON must include items");
assert(Array.isArray(exportJson.guardrails), "Export JSON must include guardrails");
assert(
  exportJson.summary.candidateCount === CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES.length,
  "Export summary must count every evidence claim candidate",
);
assert(
  exportJson.summary.finalEvidenceClaimCount === CONSTRUCTOR_MATRIX_EVIDENCE_CLAIMS.length,
  "Export summary must report final evidence claim count",
);
assert(exportJson.summary.finalEvidenceClaimCount === 0, "Final evidence claims must remain unchanged at zero");

const itemIds = new Set();
const exportedCandidateIds = new Set();
const audiencesInItems = new Set();
const audiencesByCandidate = new Map();

for (const item of exportJson.items) {
  assert(item.id && /^[a-z0-9_]+$/.test(item.id), `Invalid export item id: ${item.id}`);
  assert(item.candidateId && candidateIds.has(item.candidateId), `${item.id} references unknown candidate`);
  assert(allowedAudiences.has(item.audience), `${item.id} has invalid audience`);
  assert(typeof item.title === "string" && item.title.length > 0, `${item.id} must have title`);
  assert(typeof item.candidateStatus === "string" && item.candidateStatus.length > 0, `${item.id} must have candidateStatus`);
  assert(typeof item.candidateType === "string" && item.candidateType.length > 0, `${item.id} must have candidateType`);
  assert(typeof item.candidateText === "string" && item.candidateText.length > 0, `${item.id} must have candidateText`);
  assert(Array.isArray(item.reviewerQuestions) && item.reviewerQuestions.length > 0, `${item.id} must have reviewerQuestions`);
  assert(Array.isArray(item.requiredArtifacts) && item.requiredArtifacts.length > 0, `${item.id} must have requiredArtifacts`);
  assert(Array.isArray(item.allowedOutcomes) && item.allowedOutcomes.length > 0, `${item.id} must have allowedOutcomes`);
  assert(Array.isArray(item.prohibitedActions) && item.prohibitedActions.length > 0, `${item.id} must have prohibitedActions`);
  assert(typeof item.nextAction === "string" && item.nextAction.length > 0, `${item.id} must have nextAction`);
  assert(item.candidateOnly === true, `${item.id} must keep candidateOnly=true`);
  assert(item.runtimeChangeAllowedNow === false, `${item.id} must keep runtimeChangeAllowedNow=false`);
  assert(item.humanReviewed === false, `${item.id} must keep humanReviewed=false`);

  assertLinkedIds(item.linkedDeskSourceReviewIds, deskReviewIds, `${item.id}.linkedDeskSourceReviewIds`);
  assertLinkedIds(item.linkedSourceLookupIntakeIds, sourceLookupIds, `${item.id}.linkedSourceLookupIntakeIds`);
  assertLinkedIds(item.linkedSourceCandidateIds, sourceCandidateIds, `${item.id}.linkedSourceCandidateIds`);
  assertLinkedIds(item.linkedSourceExpansionBacklogIds, backlogIds, `${item.id}.linkedSourceExpansionBacklogIds`);
  assertLinkedIds(item.linkedEvidenceDependencyIds, evidenceIds, `${item.id}.linkedEvidenceDependencyIds`);
  assertLinkedIds(item.linkedDataDependencyIds, dataIds, `${item.id}.linkedDataDependencyIds`);
  assertLinkedIds(item.linkedThresholdCandidateIds, thresholdIds, `${item.id}.linkedThresholdCandidateIds`);
  assertLinkedIds(item.linkedReviewDecisionIds, reviewDecisionIds, `${item.id}.linkedReviewDecisionIds`);
  assertLinkedIds(item.linkedBlockerIds, blockerIds, `${item.id}.linkedBlockerIds`);
  assertLinkedIds(item.linkedReviewIntakeIds, reviewIntakeIds, `${item.id}.linkedReviewIntakeIds`);

  assert(!itemIds.has(item.id), `Duplicate export item id: ${item.id}`);
  itemIds.add(item.id);
  exportedCandidateIds.add(item.candidateId);
  audiencesInItems.add(item.audience);
  audiencesByCandidate.set(item.candidateId, [
    ...(audiencesByCandidate.get(item.candidateId) ?? []),
    item.audience,
  ]);
  assertSafeText(JSON.stringify(item), item.id);
}

for (const candidate of CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES) {
  assert(exportedCandidateIds.has(candidate.id), `Candidate missing from export: ${candidate.id}`);
  const candidateAudiences = new Set(audiencesByCandidate.get(candidate.id) ?? []);
  for (const reviewRequired of candidate.reviewRequired) {
    assert(
      candidateAudiences.has(reviewRequirementAudience[reviewRequired]),
      `${candidate.id} missing required audience for ${reviewRequired}`,
    );
  }
}

for (const [audience, fileName] of Object.entries(audienceFiles)) {
  const audienceText = await readProjectFile(`${exportDir}/${fileName}`);
  assert(
    audienceText === `${renderConstructorMatrixClaimCandidateAudienceMarkdown(expectedPack, audience)}\n`,
    `${fileName} must match audience markdown renderer`,
  );
  assert(audienceText.includes(`audience=${audience}`), `${fileName} must include audience marker`);
  if (audiencesInItems.has(audience)) {
    assert(
      audienceText.includes("## claim_candidate_review_export_"),
      `${fileName} must contain at least one item`,
    );
  }
  assertSafeText(audienceText, fileName);
}

const allMarkdown = await readProjectFile(`${exportDir}/all-candidates.md`);
assert(
  allMarkdown === `${renderConstructorMatrixClaimCandidateReviewExportMarkdown(expectedPack)}\n`,
  "all-candidates.md must match markdown renderer",
);
assertSafeText(allMarkdown, "all-candidates.md");
assertSafeText(exportJsonText, "claim-candidate-review-export.json");
assertSafeText(await readProjectFile(`${exportDir}/README.md`), "README.md");

const exportSource = await readProjectFile(exportSourceFile);
assert(
  exportSource.includes("buildConstructorMatrixClaimCandidateReviewExportPack"),
  "Claim candidate review export source must define builder",
);

for (const file of runtimeDecisionFiles) {
  const text = await readProjectFile(file);
  for (const pattern of runtimeImportPatterns) {
    assert(!text.includes(pattern), `${file} must not import claim candidate review export metadata`);
  }
}

const packageJson = JSON.parse(await readProjectFile("package.json"));
assert(
  packageJson.scripts?.["check:constructor-matrix-evidence-claim-candidate-review-export"] ===
    "node scripts/check-constructor-matrix-evidence-claim-candidate-review-export.mjs",
  "package.json must define check:constructor-matrix-evidence-claim-candidate-review-export",
);
assert(
  packageJson.scripts?.["generate:constructor-matrix-evidence-claim-candidate-review-export"] ===
    "node scripts/generate-constructor-matrix-evidence-claim-candidate-review-export.mjs",
  "package.json must define generate:constructor-matrix-evidence-claim-candidate-review-export",
);

const coreCheckText = await readProjectFile("scripts/check-perform-constructor-core.mjs");
assert(
  coreCheckText.includes("check-constructor-matrix-evidence-claim-candidate-review-export.mjs"),
  "constructor core check must be aware of claim candidate review export script",
);
assert(
  coreCheckText.includes("constructor-matrix-evidence-claim-candidate-review-export.ts"),
  "constructor core check must be aware of claim candidate review export source file",
);
assert(
  coreCheckText.includes("docs/matrix-claim-candidate-review-export/README.md"),
  "constructor core check must be aware of claim candidate review export README",
);

for (const path of docsToCheck) {
  const source = await readProjectFile(path);
  assert(
    source.includes("Matrix Evidence Claim Candidate Review Export Pack"),
    `${path} must document Matrix Evidence Claim Candidate Review Export Pack`,
  );
}

const reviewPackage = buildConstructorMatrixLayerReviewPackage({
  generatedAt: "claim-candidate-review-export-check",
});
assert(
  reviewPackage.payload.claimCandidateReviewExport.claimCandidateReviewExportItemCount ===
    expectedPack.summary.exportItemCount,
  "Review package must include claim candidate review export item count",
);
assert(
  reviewPackage.payload.claimCandidateReviewExport.claimCandidateReviewExportRuntimeChangeAllowedNowCount === 0,
  "Review package must report zero claim candidate review export runtime changes",
);
assert(
  reviewPackage.payload.claimCandidateReviewExport.claimCandidateReviewExportHumanReviewedCount === 0,
  "Review package must report zero claim candidate review export human-reviewed records",
);
assert(
  reviewPackage.payload.claimCandidateReviewExport.finalEvidenceClaimCount === 0,
  "Review package must keep final evidence claim count at zero",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      candidateCount: expectedPack.summary.candidateCount,
      exportItemCount: expectedPack.summary.exportItemCount,
      itemsByAudience: expectedPack.summary.itemsByAudience,
      candidatesCovered: exportedCandidateIds.size,
      finalEvidenceClaimCount: expectedPack.summary.finalEvidenceClaimCount,
      runtimeChangeAllowedNow: expectedPack.runtimeChangeAllowedNow,
      humanReviewed: expectedPack.humanReviewed,
      candidateOnly: expectedPack.candidateOnly,
    },
    null,
    2,
  ),
);
