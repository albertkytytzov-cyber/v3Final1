import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  buildConstructorMatrixLayerReviewPackage,
  buildConstructorMatrixReviewDecisionLedgerSummary,
  CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES,
  CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY,
  CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER,
  CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES,
  isConstructorMatrixEvidenceDependencyNeedingReview,
  isConstructorMatrixHighRiskDataDependency,
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

async function listFiles(root, extensions = new Set([".ts", ".tsx", ".js", ".jsx"])) {
  const absoluteRoot = new URL(`../${root}`, import.meta.url).pathname;
  const results = [];

  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "dist") {
          continue;
        }
        await walk(path);
      } else if ([...extensions].some((extension) => entry.name.endsWith(extension))) {
        results.push(path);
      }
    }
  }

  await walk(absoluteRoot);

  return results;
}

const allowedSubjectTypes = new Set([
  "evidence_dependency",
  "data_dependency",
  "threshold_candidate",
]);
const allowedTracks = new Set([
  "coach",
  "medical",
  "data_quality",
  "sport_science",
  "product_safety",
]);
const allowedStatuses = new Set([
  "pending_review",
  "needs_source_expansion",
  "needs_data_model",
  "needs_coach_decision",
  "needs_medical_decision",
  "needs_data_quality_review",
  "blocked_for_runtime",
  "do_not_automate",
  "docs_only_allowed",
  "review_export_only_allowed",
  "warning_candidate_only",
]);
const allowedDecisionSources = new Set([
  "system_initial_triage",
  "audit_trace",
  "review_package_queue",
  "manual_human_review",
]);
const allowedUseNow = new Set([
  "none",
  "docs_only",
  "review_export_only",
  "risk_warning_candidate_only",
]);
const thresholdAllowedUseNow = new Set([
  "none",
  "docs_only",
  "review_export_only",
  "risk_warning_candidate_only",
]);
const forbiddenStatusPatterns = [
  /approved_for_runtime/i,
  /approved_for_hard_rule/i,
  /approved_for_default/i,
  /auto_allowed/i,
  /hard_rule/i,
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
  "constructor-matrix-review-decision-ledger",
  "CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER",
  "buildConstructorMatrixReviewDecisionLedgerSummary",
  "ReviewDecisionLedger",
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
const evidenceById = new Map(CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY.map((item) => [item.id, item]));
const dataById = new Map(CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES.map((item) => [item.id, item]));
const thresholdById = new Map(CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES.map((item) => [item.id, item]));
const highRiskDataDependencies = CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES.filter(
  isConstructorMatrixHighRiskDataDependency,
);
const evidenceDependenciesNeedingReview = CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY.filter(
  isConstructorMatrixEvidenceDependencyNeedingReview,
);

function isAllowedNoThresholdSentence(text) {
  return /\b(no|without|not|нет|без)\b.{0,64}\b(numeric threshold|numeric thresholds|threshold value|threshold values|threshold|thresholds|cutoff|cutoffs|hard rule|hard gate)\b/i.test(text);
}

function hasForbiddenThresholdText(text) {
  if (/\bthreshold candidate\b/i.test(text) || /\bcandidate threshold\b/i.test(text)) {
    return false;
  }

  if (isAllowedNoThresholdSentence(text)) {
    return false;
  }

  return (
    />=|<=|>|</.test(text) ||
    /[0-9]+\s*(%|kg|кг|bpm|уд\/мин|hours?|hrs|час)/i.test(text) ||
    /\b[0-9]+\/10\b/i.test(text) ||
    /\b(exact cutoff|threshold value approved)\b/i.test(text)
  );
}

function hasPiiText(text) {
  return (
    /\b(phone|email|passport|birthdate|DOB|address|medical record|production athlete id)\b/i.test(text) ||
    /real athlete name/i.test(text) ||
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text) ||
    /\b(?:\+?\d[\s().-]*){9,}\b/.test(text)
  );
}

function subjectAreas(entry) {
  if (entry.subjectType === "threshold_candidate") {
    return [thresholdById.get(entry.subjectId)?.area].filter(Boolean);
  }

  if (entry.subjectType === "data_dependency") {
    return [dataById.get(entry.subjectId)?.area].filter(Boolean);
  }

  return evidenceById.get(entry.subjectId)?.riskAreas ?? [];
}

function hasAnyArea(entry, areas) {
  const entryAreas = subjectAreas(entry);

  return entryAreas.some((area) => areas.includes(area));
}

function hasTrack(entry, tracks) {
  return entry.requiredReviewTracks.some((track) => tracks.includes(track));
}

await fileExists("packages/shared/src/constructor-matrix-review-decision-ledger.ts");

assert(
  CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER.length > 0,
  "CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER must not be empty",
);

const ledgerIds = new Set(CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER.map((item) => item.id));
assert(
  ledgerIds.size === CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER.length,
  "Review decision ledger ids must be unique",
);

const thresholdCandidatesCovered = new Set();
const highRiskDataDependenciesCovered = new Set();
const evidenceDependenciesNeedingReviewCovered = new Set();

for (const entry of CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER) {
  assert(entry.id && /^[a-z0-9_]+$/.test(entry.id), `Invalid ledger id: ${entry.id}`);
  assert(allowedSubjectTypes.has(entry.subjectType), `${entry.id} has invalid subjectType`);
  assert(entry.subjectId && typeof entry.subjectId === "string", `${entry.id} must have subjectId`);
  assert(entry.title && typeof entry.title === "string", `${entry.id} must have title`);
  assert(Array.isArray(entry.requiredReviewTracks) && entry.requiredReviewTracks.length > 0, `${entry.id} must have requiredReviewTracks`);
  assert(allowedStatuses.has(entry.status), `${entry.id} has invalid status: ${entry.status}`);
  assert(allowedDecisionSources.has(entry.decisionSource), `${entry.id} has invalid decisionSource`);
  assert(entry.decisionSource !== "manual_human_review", `${entry.id} must not claim manual human review`);
  assert(allowedUseNow.has(entry.allowedUseNow), `${entry.id} has invalid allowedUseNow`);
  assert(Array.isArray(entry.forbiddenUseNow), `${entry.id} must have forbiddenUseNow`);
  assert(entry.rationale && typeof entry.rationale === "string", `${entry.id} must have rationale`);
  assert(Array.isArray(entry.blockingReasons) && entry.blockingReasons.length > 0, `${entry.id} must have blockingReasons`);
  assert(Array.isArray(entry.followUpActions) && entry.followUpActions.length > 0, `${entry.id} must have followUpActions`);
  assert(Array.isArray(entry.evidenceDependencyIds), `${entry.id} must have evidenceDependencyIds`);
  assert(Array.isArray(entry.dataDependencyIds), `${entry.id} must have dataDependencyIds`);
  assert(Array.isArray(entry.thresholdCandidateIds), `${entry.id} must have thresholdCandidateIds`);
  assert(entry.humanReviewed === false, `${entry.id} must have humanReviewed=false`);
  assert(!("reviewedBy" in entry), `${entry.id} must not include reviewedBy`);
  assert(!("reviewedAt" in entry), `${entry.id} must not include reviewedAt`);

  for (const track of entry.requiredReviewTracks) {
    assert(allowedTracks.has(track), `${entry.id} has invalid review track: ${track}`);
  }

  for (const pattern of forbiddenStatusPatterns) {
    assert(!pattern.test(entry.status), `${entry.id} has runtime approval-like status: ${entry.status}`);
  }

  for (const evidenceId of entry.evidenceDependencyIds) {
    assert(evidenceIds.has(evidenceId), `${entry.id} references unknown evidence dependency: ${evidenceId}`);
  }

  for (const dataId of entry.dataDependencyIds) {
    assert(dataIds.has(dataId), `${entry.id} references unknown data dependency: ${dataId}`);
  }

  for (const thresholdId of entry.thresholdCandidateIds) {
    assert(thresholdIds.has(thresholdId), `${entry.id} references unknown threshold candidate: ${thresholdId}`);
    thresholdCandidatesCovered.add(thresholdId);
  }

  if (entry.subjectType === "threshold_candidate") {
    assert(thresholdIds.has(entry.subjectId), `${entry.id} has unknown threshold subject: ${entry.subjectId}`);
    thresholdCandidatesCovered.add(entry.subjectId);
    assert(
      thresholdAllowedUseNow.has(entry.allowedUseNow),
      `${entry.id} threshold candidate allowedUseNow is too broad: ${entry.allowedUseNow}`,
    );
  }

  if (entry.subjectType === "data_dependency") {
    assert(dataIds.has(entry.subjectId), `${entry.id} has unknown data subject: ${entry.subjectId}`);
    if (highRiskDataDependencies.some((item) => item.id === entry.subjectId)) {
      highRiskDataDependenciesCovered.add(entry.subjectId);
    }
  }

  if (entry.subjectType === "evidence_dependency") {
    assert(evidenceIds.has(entry.subjectId), `${entry.id} has unknown evidence subject: ${entry.subjectId}`);
    if (evidenceDependenciesNeedingReview.some((item) => item.id === entry.subjectId)) {
      evidenceDependenciesNeedingReviewCovered.add(entry.subjectId);
    }
  }

  if (hasAnyArea(entry, ["weight_cut", "hydration", "weigh_in"])) {
    assert(hasTrack(entry, ["medical"]), `${entry.id} weight/hydration entry requires medical review`);
  }

  if (hasAnyArea(entry, ["pain", "injury", "injury_pain"])) {
    assert(hasTrack(entry, ["medical"]), `${entry.id} pain/injury entry requires medical review`);
  }

  if (hasAnyArea(entry, ["female_context", "bfr_kaatsu"])) {
    assert(hasTrack(entry, ["medical"]), `${entry.id} female/RED-S-sensitive entry requires medical review`);
  }

  if (hasAnyArea(entry, ["youth_context"])) {
    assert(hasTrack(entry, ["coach", "medical"]), `${entry.id} youth entry requires coach or medical review`);
  }

  if (hasAnyArea(entry, ["wearable_data", "sleep", "rhr", "hrv", "readiness"])) {
    assert(hasTrack(entry, ["data_quality"]), `${entry.id} data-quality area requires data-quality review`);
  }

  if (hasAnyArea(entry, ["contact_load", "lmv", "taper"])) {
    assert(hasTrack(entry, ["coach", "sport_science"]), `${entry.id} contact/LMV/taper entry requires coach or sport-science review`);
  }

  if (subjectAreas(entry).length > 0) {
    assert(entry.forbiddenUseNow.length > 0, `${entry.id} high-risk entry must have forbiddenUseNow`);
  }

  for (const text of [
    entry.title,
    entry.rationale,
    ...entry.blockingReasons,
    ...entry.followUpActions,
    ...entry.forbiddenUseNow,
  ]) {
    assert(!hasForbiddenThresholdText(text), `${entry.id} contains numeric threshold text: ${text}`);
    assert(!hasPiiText(text), `${entry.id} contains PII-like text: ${text}`);
  }
}

for (const candidate of CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES) {
  assert(
    thresholdCandidatesCovered.has(candidate.id),
    `Missing ledger entry for threshold candidate: ${candidate.id}`,
  );
}

for (const dependency of highRiskDataDependencies) {
  assert(
    highRiskDataDependenciesCovered.has(dependency.id),
    `Missing ledger entry for high-risk data dependency: ${dependency.id}`,
  );
}

for (const dependency of evidenceDependenciesNeedingReview) {
  assert(
    evidenceDependenciesNeedingReviewCovered.has(dependency.id),
    `Missing ledger entry for evidence dependency needing review: ${dependency.id}`,
  );
}

for (const path of runtimeDecisionFiles) {
  const source = await readProjectFile(path);
  for (const pattern of runtimeImportPatterns) {
    assert(!source.includes(pattern), `${path} must not import or use review decision ledger`);
  }
}

for (const root of ["apps/api", "apps/web"]) {
  for (const path of await listFiles(root)) {
    const source = await readFile(path, "utf8");
    for (const pattern of runtimeImportPatterns) {
      assert(!source.includes(pattern), `${path} must not import or use review decision ledger`);
    }
  }
}

const reviewPackage = buildConstructorMatrixLayerReviewPackage({
  generatedAt: "2026-06-11T12:00:00.000Z",
});
const ledgerSummary = buildConstructorMatrixReviewDecisionLedgerSummary();

assert(reviewPackage.payload.reviewDecisionLedger.totalLedgerEntries > 0, "Review package must include ledger summary");
assert(
  reviewPackage.payload.reviewDecisionLedger.thresholdCandidatesCoveredCount === CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES.length,
  "Review package ledger summary must cover every threshold candidate",
);
assert(
  reviewPackage.payload.summary.requiredThresholdAreasMissing.length === 0,
  "Review package must not miss required threshold areas",
);
assert(reviewPackage.payload.reviewDecisionLedger.humanReviewed === false, "Review package must preserve humanReviewed=false");

const serializedPackage = `${reviewPackage.json}\n${reviewPackage.markdown}`;
assert(!hasPiiText(serializedPackage), "Review package ledger summary must not include PII-like text");
assert(!hasForbiddenThresholdText(serializedPackage), "Review package ledger summary must not add numeric threshold text");

for (const path of docsToCheck) {
  const source = await readProjectFile(path);
  assert(source.includes("Matrix Review Decision Ledger"), `${path} must document Matrix Review Decision Ledger`);
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      ledgerEntries: CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER.length,
      thresholdCandidatesCovered: thresholdCandidatesCovered.size,
      highRiskDataDependenciesCovered: highRiskDataDependenciesCovered.size,
      evidenceDependenciesNeedingReviewCovered: evidenceDependenciesNeedingReviewCovered.size,
      reviewTracks: ledgerSummary.entriesByReviewTrack,
      statuses: ledgerSummary.entriesByStatus,
      blockedForRuntimeCount: ledgerSummary.blockedForRuntimeCount,
      doNotAutomateCount: ledgerSummary.doNotAutomateCount,
      humanReviewed: ledgerSummary.humanReviewed,
      runtimeImportsAdded: false,
      numericThresholdsAdded: false,
      piiAdded: false,
    },
    null,
    2,
  ),
);
