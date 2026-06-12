import { access, readFile } from "node:fs/promises";

import {
  buildConstructorMatrixEvidenceClaimReviewIntakeSummary,
  buildConstructorMatrixLayerReviewPackage,
  CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES,
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS,
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

const reviewIntakeFile =
  "packages/shared/src/constructor-matrix-evidence-claim-review-intake.ts";
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
  "pending_intake",
  "manual_verification_needed",
  "source_text_needed",
  "reviewer_assignment_needed",
  "blocked_for_claim_extraction",
  "ready_for_human_review_packet",
]);
const allowedTracks = new Set([
  "manual_source_verification",
  "source_text_acquisition",
  "coach_review",
  "medical_review",
  "sport_science_review",
  "data_quality_review",
  "product_safety_review",
]);
const allowedOutcomes = new Set([
  "keep_blocked",
  "source_verified_for_future_extraction",
  "source_rejected",
  "replacement_source_needed",
  "claim_extraction_ready_after_review",
  "do_not_automate",
  "needs_more_data",
  "needs_medical_review",
  "needs_coach_review",
  "needs_data_quality_review",
  "needs_sport_science_review",
]);
const allowedRuntimeUse = new Set(["none", "documentation_only", "review_export_only"]);
const humanReviewTracks = new Set([
  "coach_review",
  "medical_review",
  "sport_science_review",
  "data_quality_review",
  "product_safety_review",
]);
const highRiskAreas = new Set([
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
]);
const runtimeImportPatterns = [
  "constructor-matrix-evidence-claim-review-intake",
  "CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES",
  "EvidenceClaimReviewIntake",
];

const blockerIds = new Set(CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS.map((item) => item.id));
const blockerById = new Map(
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS.map((item) => [item.id, item]),
);
const sourceLookupIds = new Set(CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE.map((item) => item.id));
const sourceCandidateIds = new Set(CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES.map((item) => item.id));
const sourceExpansionBacklogIds = new Set(
  CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG.map((item) => item.id),
);
const evidenceDependencyIds = new Set(
  CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY.map((item) => item.id),
);
const dataDependencyIds = new Set(CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES.map((item) => item.id));
const thresholdCandidateIds = new Set(CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES.map((item) => item.id));
const reviewDecisionIds = new Set(CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER.map((item) => item.id));

function hasAllowedNoThresholdPhrase(text) {
  return /\b(no|not|without)\b.{0,80}\b(numerical threshold|numeric threshold|threshold value|runtime threshold|cutoff)\b/i.test(text);
}

function hasForbiddenThresholdText(text) {
  if (hasAllowedNoThresholdPhrase(text) || /\bthreshold candidate\b/i.test(text)) {
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

function hasFakeCitationText(text) {
  return /\b(PMID:|DOI:|et al\.)\b/i.test(text) || /\b(?:19|20)\d{2}\b/.test(text);
}

function hasAnsweredQuestion(text) {
  return /^\s*(yes|no|approved|rejected|verified)\b/i.test(text);
}

function intakeTextFields(item) {
  return [
    item.title,
    item.blockerSummary,
    item.nextAction,
    ...item.reviewerQuestions.map((question) => question.question),
    ...item.requiredArtifacts,
    ...item.prohibitedActions,
  ];
}

function assertTrack(item, track, reason) {
  assert(item.tracks.includes(track), `${item.id} must include ${track} for ${reason}`);
}

function affectedAreasForIntake(item) {
  return Array.from(
    new Set(
      item.blockerIds.flatMap((id) => blockerById.get(id)?.affectedAreas ?? []),
    ),
  );
}

function assertHighRiskTrackCoverage(item) {
  const areas = affectedAreasForIntake(item);

  for (const area of areas) {
    if (area === "weight_cut") {
      assertTrack(item, "coach_review", area);
      assertTrack(item, "medical_review", area);
      assertTrack(item, "sport_science_review", area);
    }

    if (area === "hydration") {
      assertTrack(item, "medical_review", area);
      assertTrack(item, "sport_science_review", area);
      assertTrack(item, "data_quality_review", area);
    }

    if (area === "readiness") {
      assertTrack(item, "coach_review", area);
      assertTrack(item, "data_quality_review", area);
      assertTrack(item, "sport_science_review", area);
    }

    if (area === "wearable_data") {
      assertTrack(item, "data_quality_review", area);
      assertTrack(item, "sport_science_review", area);
    }

    if (area === "sleep" || area === "rhr" || area === "hrv") {
      assertTrack(item, "data_quality_review", area);
      assertTrack(item, "coach_review", area);
    }

    if (area === "pain") {
      assertTrack(item, "coach_review", area);
      assertTrack(item, "medical_review", area);
    }

    if (area === "injury") {
      assertTrack(item, "medical_review", area);
    }

    if (area === "female_context") {
      assertTrack(item, "medical_review", area);
      assertTrack(item, "coach_review", area);
      assertTrack(item, "sport_science_review", area);
    }

    if (area === "youth_context") {
      assertTrack(item, "coach_review", area);
      assert(
        item.tracks.includes("medical_review") || item.tracks.includes("product_safety_review"),
        `${item.id} must include medical or product-safety review for ${area}`,
      );
    }

    if (area === "travel_fatigue" || area === "competition_context") {
      assertTrack(item, "coach_review", area);
      assertTrack(item, "product_safety_review", area);
    }

    if (area === "contact_load" || area === "lmv" || area === "taper") {
      assertTrack(item, "coach_review", area);
      assertTrack(item, "sport_science_review", area);
    }

    if (area === "bfr_kaatsu") {
      assertTrack(item, "medical_review", area);
      assertTrack(item, "coach_review", area);
      assertTrack(item, "sport_science_review", area);
    }
  }
}

await fileExists(reviewIntakeFile);

assert(
  Array.isArray(CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES),
  "CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES must exist",
);
assert(
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES.length > 0,
  "Review intake registry must not be empty",
);

const intakeIds = new Set(CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES.map((item) => item.id));
assert(
  intakeIds.size === CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES.length,
  "Review intake ids must be unique",
);

const blockerCoverage = new Map();

for (const item of CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES) {
  assert(item.id && /^[a-z0-9_]+$/.test(item.id), `Invalid intake id: ${item.id}`);
  assert(Array.isArray(item.blockerIds) && item.blockerIds.length > 0, `${item.id} must have blockerIds`);
  assert(Array.isArray(item.sourceLookupIntakeIds), `${item.id} must have sourceLookupIntakeIds`);
  assert(Array.isArray(item.sourceCandidateIds), `${item.id} must have sourceCandidateIds`);
  assert(Array.isArray(item.sourceExpansionBacklogIds), `${item.id} must have sourceExpansionBacklogIds`);
  assert(Array.isArray(item.evidenceDependencyIds), `${item.id} must have evidenceDependencyIds`);
  assert(Array.isArray(item.dataDependencyIds), `${item.id} must have dataDependencyIds`);
  assert(Array.isArray(item.thresholdCandidateIds), `${item.id} must have thresholdCandidateIds`);
  assert(Array.isArray(item.reviewDecisionIds), `${item.id} must have reviewDecisionIds`);
  assert(Array.isArray(item.tracks) && item.tracks.length > 0, `${item.id} must have tracks`);
  assert(allowedStatuses.has(item.status), `${item.id} has invalid status`);
  assert(typeof item.title === "string" && item.title.length > 0, `${item.id} must have title`);
  assert(
    typeof item.blockerSummary === "string" && item.blockerSummary.length > 0,
    `${item.id} must have blockerSummary`,
  );
  assert(
    Array.isArray(item.reviewerQuestions) && item.reviewerQuestions.length >= 2,
    `${item.id} must have at least two reviewerQuestions`,
  );
  assert(
    Array.isArray(item.allowedOutcomes) && item.allowedOutcomes.length > 0,
    `${item.id} must have allowedOutcomes`,
  );
  assert(
    Array.isArray(item.requiredArtifacts) && item.requiredArtifacts.length > 0,
    `${item.id} must have requiredArtifacts`,
  );
  assert(
    Array.isArray(item.prohibitedActions) && item.prohibitedActions.length > 0,
    `${item.id} must have prohibitedActions`,
  );
  assert(typeof item.nextAction === "string" && item.nextAction.length > 0, `${item.id} must have nextAction`);
  assert(allowedRuntimeUse.has(item.runtimeUseNow), `${item.id} has invalid runtimeUseNow`);
  assert(item.humanReviewed === false, `${item.id} must have humanReviewed=false`);
  assert(!("reviewedBy" in item), `${item.id} must not have reviewedBy`);
  assert(!("reviewedAt" in item), `${item.id} must not have reviewedAt`);
  assert(item.runtimeChangeAllowedNow === false, `${item.id} must have runtimeChangeAllowedNow=false`);

  for (const id of item.blockerIds) {
    assert(blockerIds.has(id), `${item.id} references unknown blocker id: ${id}`);
    blockerCoverage.set(id, (blockerCoverage.get(id) ?? 0) + 1);
  }
  for (const id of item.sourceLookupIntakeIds) {
    assert(sourceLookupIds.has(id), `${item.id} references unknown source lookup id: ${id}`);
  }
  for (const id of item.sourceCandidateIds) {
    assert(sourceCandidateIds.has(id), `${item.id} references unknown source candidate id: ${id}`);
  }
  for (const id of item.sourceExpansionBacklogIds) {
    assert(sourceExpansionBacklogIds.has(id), `${item.id} references unknown source backlog id: ${id}`);
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
  for (const track of item.tracks) {
    assert(allowedTracks.has(track), `${item.id} has invalid track: ${track}`);
  }
  for (const outcome of item.allowedOutcomes) {
    assert(allowedOutcomes.has(outcome), `${item.id} has invalid allowed outcome: ${outcome}`);
  }

  assert(
    item.prohibitedActions.some((action) => /no runtime promotion/i.test(action)),
    `${item.id} must prohibit runtime promotion`,
  );

  const blockers = item.blockerIds.map((id) => blockerById.get(id));
  for (const blocker of blockers) {
    assert(blocker, `${item.id} references missing blocker`);

    if (blocker.reason === "manual_verification_required") {
      assert(item.status === "manual_verification_needed", `${item.id} manual blocker must use manual status`);
      assertTrack(item, "manual_source_verification", blocker.reason);
      assert(
        item.allowedOutcomes.includes("source_verified_for_future_extraction"),
        `${item.id} manual blocker must allow future verified-source outcome`,
      );
      assert(
        item.allowedOutcomes.includes("source_rejected"),
        `${item.id} manual blocker must allow source rejection`,
      );
      assert(
        item.prohibitedActions.includes("no claim extraction before manual verification"),
        `${item.id} manual blocker must prohibit claim extraction before verification`,
      );
    }

    if (blocker.reason === "needs_full_text_or_policy_text") {
      assert(item.status === "source_text_needed", `${item.id} source-text blocker must use source-text status`);
      assertTrack(item, "source_text_acquisition", blocker.reason);
      assert(
        item.requiredArtifacts.some((artifact) => /source text or official policy text/i.test(artifact)),
        `${item.id} source-text blocker must require source or policy text`,
      );
      assert(
        item.prohibitedActions.includes("no abstract-only claim if full/policy text is needed"),
        `${item.id} source-text blocker must prohibit abstract-only claim`,
      );
    }

    if (blocker.reason === "needs_human_review_before_claims") {
      assert(
        item.tracks.some((track) => humanReviewTracks.has(track)),
        `${item.id} human-review blocker must include a reviewer track`,
      );
      assert(
        item.allowedOutcomes.includes("claim_extraction_ready_after_review") ||
          item.allowedOutcomes.includes("keep_blocked"),
        `${item.id} human-review blocker must include a review outcome`,
      );
      assert(
        item.prohibitedActions.some((action) => /no fake approval/i.test(action)),
        `${item.id} human-review blocker must prohibit fake approval`,
      );
    }
  }

  const highRisk = affectedAreasForIntake(item).some((area) => highRiskAreas.has(area));
  if (highRisk) {
    assert(
      item.reviewerQuestions.length >= 3,
      `${item.id} high-risk intake must have at least three reviewer questions`,
    );
    assertHighRiskTrackCoverage(item);
  }

  for (const question of item.reviewerQuestions) {
    assert(question.id && /^[a-z0-9_]+$/.test(question.id), `${item.id} has invalid question id`);
    assert(allowedTracks.has(question.track), `${item.id} question has invalid track`);
    assert(typeof question.question === "string" && question.question.endsWith("?"), `${item.id} question must be a question`);
    assert(question.requiredForFutureExtraction === true, `${item.id} question must state future extraction need`);
    assert(!hasAnsweredQuestion(question.question), `${item.id} question appears answered: ${question.question}`);
    assert(!/\b(approved|reviewed|complete)\b/i.test(question.question), `${item.id} question implies review completion`);
  }

  for (const text of intakeTextFields(item)) {
    assert(!hasForbiddenThresholdText(text), `${item.id} contains numeric threshold text: ${text}`);
    assert(!hasFakeCitationText(text), `${item.id} contains fake citation-like text: ${text}`);
  }
}

for (const blocker of CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS) {
  assert(
    blockerCoverage.get(blocker.id) === 1,
    `${blocker.id} must be covered by exactly one review intake`,
  );
}

const reviewIntakeSource = await readProjectFile(reviewIntakeFile);
assert(
  reviewIntakeSource.includes("CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES"),
  "Review intake source must define registry",
);
assert(!/humanReviewed\s*:\s*true/i.test(reviewIntakeSource), "Review intake source must not set humanReviewed=true");

for (const file of runtimeDecisionFiles) {
  const text = await readProjectFile(file);
  for (const pattern of runtimeImportPatterns) {
    assert(!text.includes(pattern), `${file} must not import evidence claim review intake metadata`);
  }
}

const packageJson = JSON.parse(await readProjectFile("package.json"));
assert(
  packageJson.scripts?.["check:constructor-matrix-evidence-claim-review-intake"] ===
    "node scripts/check-constructor-matrix-evidence-claim-review-intake.mjs",
  "package.json must define check:constructor-matrix-evidence-claim-review-intake",
);

const coreCheck = await readProjectFile("scripts/check-perform-constructor-core.mjs");
assert(
  coreCheck.includes("check-constructor-matrix-evidence-claim-review-intake.mjs"),
  "constructor core check must be aware of review intake script",
);
assert(
  coreCheck.includes("constructor-matrix-evidence-claim-review-intake.ts"),
  "constructor core check must be aware of review intake source file",
);

for (const doc of docsToCheck) {
  const text = await readProjectFile(doc);
  assert(
    text.includes("Stage: Evidence Claim Blocker Review Intake Pack"),
    `${doc} must document Evidence Claim Blocker Review Intake Pack`,
  );
}

const summary = buildConstructorMatrixEvidenceClaimReviewIntakeSummary();
assert(
  summary.evidenceClaimReviewIntakeCount === CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES.length,
  "Review intake summary count mismatch",
);
assert(
  summary.blockersCoveredCount === CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS.length,
  "Review intake summary must cover every blocker",
);
assert(summary.runtimeChangeAllowedNowCount === 0, "Review intake summary must report zero runtime changes");

const reviewPackage = buildConstructorMatrixLayerReviewPackage({
  generatedAt: "evidence-claim-review-intake-check",
});
assert(
  reviewPackage.payload.evidenceClaimReviewIntake.evidenceClaimReviewIntakeCount ===
    CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES.length,
  "Review package must include evidence claim review intake count",
);
assert(
  reviewPackage.payload.evidenceClaimReviewIntake.runtimeChangeAllowedNowCount === 0,
  "Review package must keep review intake runtime changes at zero",
);
assert(
  reviewPackage.markdown.includes("Evidence claim review intakes:"),
  "Review package markdown must include evidence claim review intake summary",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      reviewIntakeCount: summary.evidenceClaimReviewIntakeCount,
      blockersCovered: `${summary.blockersCoveredCount}/${summary.evidenceClaimBlockerCount}`,
      byStatus: summary.reviewIntakesByStatus,
      byTrack: summary.reviewIntakesByTrack,
      manualVerificationIntakeCount: summary.manualVerificationIntakeCount,
      sourceTextNeededIntakeCount: summary.sourceTextNeededIntakeCount,
      humanReviewBeforeClaimsIntakeCount: summary.humanReviewBeforeClaimsIntakeCount,
      runtimeChangeAllowedNowCount: summary.runtimeChangeAllowedNowCount,
    },
    null,
    2,
  ),
);
