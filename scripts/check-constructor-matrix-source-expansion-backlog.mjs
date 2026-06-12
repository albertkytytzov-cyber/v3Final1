import { access, readFile } from "node:fs/promises";

import {
  buildConstructorMatrixLayerReviewPackage,
  CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES,
  CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY,
  CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER,
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

const requiredBacklogIds = new Set([
  "weight_cut_quantitative_safety_sources",
  "hydration_sauna_heat_exposure_sources",
  "reds_low_energy_availability_sources",
  "bfr_kaatsu_safety_and_screening_sources",
  "injury_pain_return_to_training_sources",
  "youth_high_load_and_weight_cut_sources",
  "female_context_symptom_aware_readiness_sources",
  "wearable_data_quality_and_readiness_sources",
  "rhr_hrv_sleep_readiness_composite_sources",
  "wrestling_contact_load_classification_sources",
  "lmv_legs_recovery_and_start_proximity_sources",
  "taper_hidden_glycolytic_load_sources",
]);
const allowedPriorities = new Set(["P0", "P1", "P2", "P3"]);
const allowedStatuses = new Set([
  "needs_source_expansion",
  "needs_exact_citation",
  "needs_population_match",
  "needs_wrestling_specificity",
  "needs_medical_review",
  "needs_coach_review",
  "needs_data_quality_review",
  "blocked_for_runtime",
  "do_not_automate",
  "docs_only",
]);
const allowedTracks = new Set([
  "coach",
  "medical",
  "data_quality",
  "sport_science",
  "product_safety",
]);
const allowedSourceTypes = new Set([
  "systematic_review",
  "meta_analysis",
  "position_stand",
  "consensus_statement",
  "official_regulation",
  "combat_sport_study",
  "wrestling_specific_study",
  "female_athlete_source",
  "youth_athlete_source",
  "medical_safety_source",
  "hydration_weight_management_policy",
  "wearable_validity_source",
  "coach_school_review",
  "internal_validation_study",
  "data_quality_spec",
]);
const allowedRuntimeBlockers = new Set([
  "no_runtime_use_until_review",
  "no_hard_rule_without_external_source",
  "no_numeric_threshold_without_review",
  "no_medical_decision_automation",
  "no_weight_cut_automation",
  "no_bfr_kaatsu_automation",
  "no_injury_return_automation",
  "no_reds_diagnosis",
  "no_wearable_absolute_truth",
  "no_internal_case_as_universal_rule",
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
  "constructor-matrix-source-expansion-backlog",
  "CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG",
  "SourceExpansionBacklog",
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
const ledgerById = new Map(CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER.map((item) => [item.id, item]));

function isAllowedNoThresholdSentence(text) {
  return /\b(no|without|not|нет|без)\b.{0,64}\b(numeric threshold|numeric thresholds|threshold value|threshold values|threshold|thresholds|cutoff value|cutoff values|cutoff|cutoffs)\b/i.test(text);
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
    /\b(cutoff value|threshold value)\b/i.test(text)
  );
}

function hasFakeCitationText(text) {
  return (
    /\b(PMID|DOI):/i.test(text) ||
    /\bet al\./i.test(text) ||
    /\b(?:19|20)\d{2}\b.*\b(study|paper|trial|review|source|citation)\b/i.test(text)
  );
}

function claimsSourcesFound(text) {
  return /\b(found|sourced|identified source|citation found|evidence found)\b/i.test(text);
}

function itemText(item) {
  return [
    item.title,
    item.question,
    item.whyNeeded,
    ...item.acceptanceCriteria,
    ...item.forbiddenUntilResolved,
    ...item.notes,
  ];
}

await fileExists("packages/shared/src/constructor-matrix-source-expansion-backlog.ts");

assert(
  CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG.length >= 12,
  "Source expansion backlog must contain at least 12 items",
);

const backlogIds = new Set(CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG.map((item) => item.id));
assert(
  backlogIds.size === CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG.length,
  "Source expansion backlog ids must be unique",
);

for (const id of requiredBacklogIds) {
  assert(backlogIds.has(id), `Missing required source expansion backlog item: ${id}`);
}

const linkedEvidenceIds = new Set();
const linkedDataIds = new Set();
const linkedThresholdIds = new Set();
const p0Ids = [];

for (const item of CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG) {
  assert(/^[a-z0-9_]+$/.test(item.id), `${item.id} must be snake_case`);
  assert(allowedPriorities.has(item.priority), `${item.id} has invalid priority`);
  assert(allowedStatuses.has(item.status), `${item.id} has invalid status`);
  assert(typeof item.title === "string" && item.title.length > 0, `${item.id} must have title`);
  assert(typeof item.question === "string" && item.question.length > 0, `${item.id} must have question`);
  assert(typeof item.whyNeeded === "string" && item.whyNeeded.length > 0, `${item.id} must have whyNeeded`);
  assert(Array.isArray(item.riskAreas) && item.riskAreas.length > 0, `${item.id} must have riskAreas`);
  assert(Array.isArray(item.reviewTracks) && item.reviewTracks.length > 0, `${item.id} must have reviewTracks`);
  assert(Array.isArray(item.sourceTypesNeeded) && item.sourceTypesNeeded.length > 0, `${item.id} must have sourceTypesNeeded`);
  assert(Array.isArray(item.evidenceDependencyIds), `${item.id} must have evidenceDependencyIds`);
  assert(Array.isArray(item.dataDependencyIds), `${item.id} must have dataDependencyIds`);
  assert(Array.isArray(item.thresholdCandidateIds), `${item.id} must have thresholdCandidateIds`);
  assert(Array.isArray(item.reviewDecisionLedgerIds), `${item.id} must have reviewDecisionLedgerIds`);
  assert(Array.isArray(item.acceptanceCriteria) && item.acceptanceCriteria.length > 0, `${item.id} must have acceptanceCriteria`);
  assert(Array.isArray(item.runtimeBlockers) && item.runtimeBlockers.length > 0, `${item.id} must have runtimeBlockers`);
  assert(Array.isArray(item.forbiddenUntilResolved) && item.forbiddenUntilResolved.length > 0, `${item.id} must have forbiddenUntilResolved`);
  assert(Array.isArray(item.notes) && item.notes.length > 0, `${item.id} must have notes`);

  for (const track of item.reviewTracks) {
    assert(allowedTracks.has(track), `${item.id} has invalid review track: ${track}`);
  }

  for (const sourceType of item.sourceTypesNeeded) {
    assert(allowedSourceTypes.has(sourceType), `${item.id} has invalid source type: ${sourceType}`);
  }

  for (const blocker of item.runtimeBlockers) {
    assert(allowedRuntimeBlockers.has(blocker), `${item.id} has invalid runtime blocker: ${blocker}`);
  }

  for (const evidenceId of item.evidenceDependencyIds) {
    assert(evidenceIds.has(evidenceId), `${item.id} references unknown evidence dependency: ${evidenceId}`);
    linkedEvidenceIds.add(evidenceId);
  }

  for (const dataId of item.dataDependencyIds) {
    assert(dataIds.has(dataId), `${item.id} references unknown data dependency: ${dataId}`);
    linkedDataIds.add(dataId);
  }

  for (const thresholdId of item.thresholdCandidateIds) {
    assert(thresholdIds.has(thresholdId), `${item.id} references unknown threshold candidate: ${thresholdId}`);
    linkedThresholdIds.add(thresholdId);
  }

  for (const ledgerId of item.reviewDecisionLedgerIds) {
    assert(ledgerIds.has(ledgerId), `${item.id} references unknown review decision ledger id: ${ledgerId}`);
  }

  if (item.priority === "P0") {
    p0Ids.push(item.id);
    assert(item.runtimeBlockers.length > 0, `${item.id} P0 item must include runtime blockers`);
  }

  if (
    item.priority === "P0" &&
    item.riskAreas.some((area) =>
      [
        "weight_cut",
        "hydration",
        "female_context",
        "injury_pain",
        "pain",
        "injury",
        "youth_context",
        "bfr_kaatsu",
      ].includes(area),
    )
  ) {
    assert(item.reviewTracks.includes("medical"), `${item.id} P0 medical-risk item must include medical review`);
  }

  if (
    item.priority === "P0" &&
    item.riskAreas.some((area) => ["wearable_data", "readiness"].includes(area))
  ) {
    assert(
      item.reviewTracks.includes("data_quality") || item.reviewTracks.includes("medical"),
      `${item.id} P0 readiness/data item must include data-quality or medical review`,
    );
  }

  for (const text of itemText(item)) {
    assert(!hasFakeCitationText(text), `${item.id} contains fake citation-like text: ${text}`);
    assert(!hasForbiddenThresholdText(text), `${item.id} contains numeric threshold-like text: ${text}`);
    if (claimsSourcesFound(text)) {
      assert(item.evidenceDependencyIds.length > 0, `${item.id} claims sources were found without evidence ids`);
    }
  }
}

for (const item of CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER) {
  assert(item.humanReviewed === false, `${item.id} must keep humanReviewed=false`);
  assert(!("reviewedBy" in item), `${item.id} must not include reviewedBy`);
  assert(!("reviewedAt" in item), `${item.id} must not include reviewedAt`);

  for (const backlogId of item.sourceExpansionBacklogIds ?? []) {
    assert(backlogIds.has(backlogId), `${item.id} references unknown source expansion backlog id: ${backlogId}`);
  }
}

for (const item of CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG.filter((entry) => entry.priority === "P0")) {
  for (const ledgerId of item.reviewDecisionLedgerIds) {
    const ledgerEntry = ledgerById.get(ledgerId);
    assert(
      ledgerEntry?.sourceExpansionBacklogIds?.includes(item.id),
      `${ledgerId} must link back to P0 source expansion backlog item ${item.id}`,
    );
  }
}

for (const entry of CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER) {
  const medicalOrDataQuality =
    entry.requiredReviewTracks.includes("medical") ||
    entry.requiredReviewTracks.includes("data_quality");
  const highRiskSubject =
    entry.subjectId.includes("weight") ||
    entry.subjectId.includes("hydration") ||
    entry.subjectId.includes("pain") ||
    entry.subjectId.includes("injury") ||
    entry.subjectId.includes("female") ||
    entry.subjectId.includes("reds") ||
    entry.subjectId.includes("youth") ||
    entry.subjectId.includes("wearable") ||
    entry.subjectId.includes("rhr") ||
    entry.subjectId.includes("hrv") ||
    entry.subjectId.includes("sleep") ||
    entry.subjectId.includes("readiness");

  if (medicalOrDataQuality && highRiskSubject) {
    assert(
      (entry.sourceExpansionBacklogIds ?? []).length > 0,
      `${entry.id} high-risk review entry must link to source expansion backlog`,
    );
  }
}

for (const path of runtimeDecisionFiles) {
  const source = await readProjectFile(path);
  for (const pattern of runtimeImportPatterns) {
    assert(!source.includes(pattern), `${path} must not import or use source expansion backlog`);
  }
}

const reviewPackage = buildConstructorMatrixLayerReviewPackage({
  generatedAt: "2026-06-11T12:00:00.000Z",
});
assert(
  reviewPackage.payload.sourceExpansionBacklog.sourceExpansionBacklogCount ===
    CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG.length,
  "Review package must include source expansion backlog summary",
);
assert(
  reviewPackage.payload.sourceExpansionBacklog.unresolvedP0SourceExpansionIds.length === p0Ids.length,
  "Review package must include unresolved P0 source expansion ids",
);
assert(
  reviewPackage.payload.reviewDecisionLedger.humanReviewed === false,
  "Review package must not imply human review occurred",
);

for (const path of docsToCheck) {
  const source = await readProjectFile(path);
  assert(source.includes("Source Expansion Backlog + Review Intake Guard"), `${path} must document source expansion backlog stage`);
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      backlogItems: CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG.length,
      requiredItemsCovered: requiredBacklogIds.size,
      priorities: reviewPackage.payload.sourceExpansionBacklog.sourceExpansionByPriority,
      reviewTracks: reviewPackage.payload.sourceExpansionBacklog.sourceExpansionByReviewTrack,
      unresolvedP0SourceExpansionIds:
        reviewPackage.payload.sourceExpansionBacklog.unresolvedP0SourceExpansionIds,
      linkedEvidenceDependencyIds: Array.from(linkedEvidenceIds).sort(),
      linkedDataDependencyIds: Array.from(linkedDataIds).sort(),
      linkedThresholdCandidateIds: Array.from(linkedThresholdIds).sort(),
      ledgerHumanReviewed: false,
      runtimeImportsAdded: false,
      numericThresholdsAdded: false,
      fakeCitationsAdded: false,
    },
    null,
    2,
  ),
);
