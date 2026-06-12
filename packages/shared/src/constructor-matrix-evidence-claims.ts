import {
  CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES,
  type ConstructorMatrixSourceCandidate,
  type ConstructorMatrixSourceCandidateId,
} from "./constructor-matrix-source-candidates";
import {
  CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG,
  type ConstructorMatrixSourceExpansionBacklogId,
} from "./constructor-matrix-source-expansion-backlog";
import {
  CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE,
  type ConstructorMatrixSourceLookupIntake,
  type ConstructorMatrixSourceLookupIntakeId,
} from "./constructor-matrix-source-lookup-intake";

export type ConstructorMatrixEvidenceClaimStatus =
  | "draft_extracted"
  | "blocked_source_not_ready"
  | "blocked_manual_verification_required"
  | "needs_source_verification"
  | "needs_sport_science_review"
  | "needs_coach_review"
  | "needs_medical_review"
  | "approved_for_docs_only"
  | "do_not_automate";

export type ConstructorMatrixEvidenceClaimType =
  | "safety"
  | "methodology"
  | "performance"
  | "readiness"
  | "weight_management"
  | "hydration"
  | "regulatory_competition_fact"
  | "data_quality"
  | "population_context"
  | "injury_pain"
  | "review_blocker";

export type ConstructorMatrixEvidenceClaimApplicability =
  | "direct_wrestling"
  | "combat_sport_transfer"
  | "general_sport"
  | "policy_or_regulatory"
  | "methodology_framework"
  | "internal_case_context"
  | "not_applicable_blocker";

export type ConstructorMatrixEvidenceClaimRuntimeUse =
  | "none"
  | "documentation_only"
  | "review_export_only"
  | "future_source_trace_only";

export type ConstructorMatrixEvidenceClaimReviewRequirement =
  | "coach_review"
  | "medical_review"
  | "sport_science_review"
  | "data_quality_review"
  | "product_safety_review"
  | "manual_source_verification";

export type ConstructorMatrixEvidenceClaim = {
  id: string;
  status: ConstructorMatrixEvidenceClaimStatus;
  claimType: ConstructorMatrixEvidenceClaimType;
  applicability: ConstructorMatrixEvidenceClaimApplicability;
  title: string;
  claimText: string;
  sourceLookupIntakeIds: readonly string[];
  sourceCandidateIds: readonly string[];
  sourceExpansionBacklogIds: readonly string[];
  evidenceDependencyIds: readonly string[];
  dataDependencyIds: readonly string[];
  thresholdCandidateIds: readonly string[];
  reviewDecisionIds: readonly string[];
  populationContext: readonly string[];
  methodOrRiskArea: readonly string[];
  supports: readonly string[];
  limitations: readonly string[];
  extractionNotes: readonly string[];
  reviewRequired: readonly ConstructorMatrixEvidenceClaimReviewRequirement[];
  runtimeUseNow: ConstructorMatrixEvidenceClaimRuntimeUse;
  humanReviewed: false;
  reviewedBy?: never;
  reviewedAt?: never;
  runtimeChangeAllowedNow: false;
};

export type ConstructorMatrixEvidenceClaimBlockerReason =
  | "manual_verification_required"
  | "source_not_extraction_ready"
  | "metadata_only_record"
  | "needs_full_text_or_policy_text"
  | "needs_human_review_before_claims"
  | "no_claim_safe_to_extract";

export type ConstructorMatrixEvidenceClaimBlocker = {
  id: string;
  sourceLookupIntakeIds: readonly string[];
  sourceCandidateIds: readonly string[];
  reason: ConstructorMatrixEvidenceClaimBlockerReason;
  affectedAreas: readonly string[];
  requiredNextAction: readonly string[];
  runtimeUseNow: "none" | "documentation_only";
  runtimeChangeAllowedNow: false;
};

export interface ConstructorMatrixEvidenceClaimExtractionSummary {
  evidenceClaimCount: number;
  evidenceClaimBlockerCount: number;
  extractedClaimsByStatus: Readonly<Record<ConstructorMatrixEvidenceClaimStatus, number>>;
  claimBlockersByReason: Readonly<Record<ConstructorMatrixEvidenceClaimBlockerReason, number>>;
  claimRuntimeUseSummary: Readonly<Record<ConstructorMatrixEvidenceClaimRuntimeUse, number>>;
  claimReviewQueueCounts: Readonly<Record<ConstructorMatrixEvidenceClaimReviewRequirement, number>>;
  sourceLookupRecordsCoveredCount: number;
  sourceLookupRecordCount: number;
  p0SourceCandidatesCoveredCount: number;
  p0SourceCandidateCount: number;
  p0BacklogItemsCoveredCount: number;
  p0BacklogItemCount: number;
  highRiskAreasCovered: readonly string[];
  highRiskAreasMissing: readonly string[];
  humanReviewed: false;
  runtimeChangeAllowedNow: false;
}

const CLAIM_STATUS_VALUES = [
  "draft_extracted",
  "blocked_source_not_ready",
  "blocked_manual_verification_required",
  "needs_source_verification",
  "needs_sport_science_review",
  "needs_coach_review",
  "needs_medical_review",
  "approved_for_docs_only",
  "do_not_automate",
] as const satisfies readonly ConstructorMatrixEvidenceClaimStatus[];

const CLAIM_BLOCKER_REASON_VALUES = [
  "manual_verification_required",
  "source_not_extraction_ready",
  "metadata_only_record",
  "needs_full_text_or_policy_text",
  "needs_human_review_before_claims",
  "no_claim_safe_to_extract",
] as const satisfies readonly ConstructorMatrixEvidenceClaimBlockerReason[];

const CLAIM_RUNTIME_USE_VALUES = [
  "none",
  "documentation_only",
  "review_export_only",
  "future_source_trace_only",
] as const satisfies readonly ConstructorMatrixEvidenceClaimRuntimeUse[];

const CLAIM_REVIEW_REQUIREMENT_VALUES = [
  "coach_review",
  "medical_review",
  "sport_science_review",
  "data_quality_review",
  "product_safety_review",
  "manual_source_verification",
] as const satisfies readonly ConstructorMatrixEvidenceClaimReviewRequirement[];

const HIGH_RISK_AREAS = [
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
] as const;

const SOURCE_CANDIDATE_ONLY_BLOCKER_IDS = [
  "sleep_readiness_context_source_need",
  "rhr_trend_monitoring_source_need",
  "hrv_trend_monitoring_source_need",
  "wrestling_contact_load_source_need",
  "competition_context_review_source_need",
  "travel_fatigue_context_source_need",
] as const;

const SOURCE_CANDIDATE_BY_ID = new Map<string, ConstructorMatrixSourceCandidate>(
  CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES.map((item) => [item.id, item]),
);

const SOURCE_EXPANSION_BACKLOG_BY_ID = new Map(
  CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG.map((item) => [item.id, item]),
);

function uniqueSorted(items: readonly string[]): string[] {
  return Array.from(new Set(items)).sort();
}

function emptyRecord<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}

function countBy<K extends string>(
  keys: readonly K[],
  items: readonly K[],
): Readonly<Record<K, number>> {
  const counts = emptyRecord(keys);

  for (const item of items) {
    counts[item] += 1;
  }

  return counts;
}

function normalizeArea(area: string): string[] {
  if (area === "reds") {
    return ["female_context"];
  }

  if (area === "injury_pain") {
    return ["pain", "injury"];
  }

  if (area === "competition_day" || area === "competition_model") {
    return ["competition_context"];
  }

  if (area === "travel") {
    return ["travel_fatigue"];
  }

  return [area];
}

function candidateForLookup(item: ConstructorMatrixSourceLookupIntake):
  ConstructorMatrixSourceCandidate | null {
  return SOURCE_CANDIDATE_BY_ID.get(item.sourceCandidateId) ?? null;
}

function affectedAreasForCandidate(item: ConstructorMatrixSourceCandidate): string[] {
  return uniqueSorted([
    ...normalizeArea(item.area),
    ...item.linkedSourceExpansionBacklogIds.flatMap((id) =>
      SOURCE_EXPANSION_BACKLOG_BY_ID.get(id)?.riskAreas.flatMap(normalizeArea) ?? [],
    ),
  ]);
}

function affectedAreasForLookup(item: ConstructorMatrixSourceLookupIntake): string[] {
  const sourceCandidate = candidateForLookup(item);

  return uniqueSorted([
    ...(sourceCandidate ? affectedAreasForCandidate(sourceCandidate) : []),
    ...item.sourceExpansionBacklogIds.flatMap((id) =>
      SOURCE_EXPANSION_BACKLOG_BY_ID.get(id)?.riskAreas.flatMap(normalizeArea) ?? [],
    ),
  ]);
}

function blockerReasonForLookup(
  item: ConstructorMatrixSourceLookupIntake,
): ConstructorMatrixEvidenceClaimBlockerReason {
  if (item.extractionReadiness === "needs_manual_verification") {
    return "manual_verification_required";
  }

  if (item.extractionReadiness === "needs_full_text_or_abstract") {
    return "needs_full_text_or_policy_text";
  }

  if (item.extractionReadiness === "not_ready") {
    return "source_not_extraction_ready";
  }

  if (item.usePermission !== "evidence_claim_extraction_candidate") {
    return "needs_human_review_before_claims";
  }

  return "no_claim_safe_to_extract";
}

function requiredNextActionForReason(
  reason: ConstructorMatrixEvidenceClaimBlockerReason,
): readonly string[] {
  if (reason === "manual_verification_required") {
    return [
      "Manually verify source text and scope before claim extraction",
      "Keep source identity metadata out of runtime rules",
      "Record real review decisions in a later stage",
    ];
  }

  if (reason === "needs_full_text_or_policy_text") {
    return [
      "Review full text, abstract or policy text before extracting a claim",
      "Confirm population and sport-transfer limits",
      "Keep claim extraction blocked until source content is reviewed",
    ];
  }

  if (reason === "needs_human_review_before_claims") {
    return [
      "Route source through the required review tracks before claims",
      "Keep source as review context only",
      "Do not convert source metadata into constructor logic",
    ];
  }

  return [
    "Run a controlled source-readiness pass before claim extraction",
    "Document why no safe claim can be extracted yet",
    "Keep constructor runtime unchanged",
  ];
}

function blockerForLookup(
  item: ConstructorMatrixSourceLookupIntake,
): ConstructorMatrixEvidenceClaimBlocker {
  const reason = blockerReasonForLookup(item);

  return {
    id: `source_lookup_${item.id}`,
    sourceLookupIntakeIds: [item.id as ConstructorMatrixSourceLookupIntakeId],
    sourceCandidateIds: [item.sourceCandidateId],
    reason,
    affectedAreas: affectedAreasForLookup(item),
    requiredNextAction: requiredNextActionForReason(reason),
    runtimeUseNow: "none",
    runtimeChangeAllowedNow: false,
  };
}

function blockerForSourceCandidate(
  item: ConstructorMatrixSourceCandidate,
): ConstructorMatrixEvidenceClaimBlocker {
  return {
    id: `source_candidate_${item.id}`,
    sourceLookupIntakeIds: [],
    sourceCandidateIds: [item.id as ConstructorMatrixSourceCandidateId],
    reason: "needs_human_review_before_claims",
    affectedAreas: affectedAreasForCandidate(item),
    requiredNextAction: [
      "Run controlled source lookup or source-readiness review for this candidate",
      "Do not extract claims from source candidate metadata alone",
      "Keep related threshold candidates blocked from runtime promotion",
    ],
    runtimeUseNow: "none",
    runtimeChangeAllowedNow: false,
  };
}

const SOURCE_LOOKUP_EVIDENCE_CLAIM_BLOCKERS =
  CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE.map(blockerForLookup);

const SOURCE_CANDIDATE_EVIDENCE_CLAIM_BLOCKERS =
  SOURCE_CANDIDATE_ONLY_BLOCKER_IDS
    .map((id) => SOURCE_CANDIDATE_BY_ID.get(id))
    .filter((item): item is ConstructorMatrixSourceCandidate => Boolean(item))
    .map(blockerForSourceCandidate);

export const CONSTRUCTOR_MATRIX_EVIDENCE_CLAIMS =
  [] satisfies readonly ConstructorMatrixEvidenceClaim[];

const CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_ITEMS:
  readonly ConstructorMatrixEvidenceClaim[] =
    CONSTRUCTOR_MATRIX_EVIDENCE_CLAIMS;

export const CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS = [
  ...SOURCE_LOOKUP_EVIDENCE_CLAIM_BLOCKERS,
  ...SOURCE_CANDIDATE_EVIDENCE_CLAIM_BLOCKERS,
] satisfies readonly ConstructorMatrixEvidenceClaimBlocker[];

export type ConstructorMatrixEvidenceClaimId = string;

export type ConstructorMatrixEvidenceClaimBlockerId =
  (typeof CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS)[number]["id"];

export const CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_IDS =
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_ITEMS.map((item) => item.id);

export const CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKER_IDS =
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS.map((item) => item.id);

const CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_ID_SET = new Set<string>(
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_IDS,
);

const CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKER_ID_SET = new Set<string>(
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKER_IDS,
);

const CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_LOOKUP = new Map<
  string,
  ConstructorMatrixEvidenceClaim
>(
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_ITEMS.map((item) => [item.id, item]),
);

const CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKER_LOOKUP = new Map<
  string,
  ConstructorMatrixEvidenceClaimBlocker
>(
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS.map((item) => [item.id, item]),
);

export function listConstructorMatrixEvidenceClaimIds(): string[] {
  return [...CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_IDS];
}

export function getConstructorMatrixEvidenceClaim(
  id: string,
): ConstructorMatrixEvidenceClaim | null {
  return CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_LOOKUP.get(id) ?? null;
}

export function validateConstructorMatrixEvidenceClaimIds(
  ids: readonly string[],
): { ok: boolean; missing: string[] } {
  const missing = ids.filter((id) => !CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_ID_SET.has(id));

  return {
    ok: missing.length === 0,
    missing,
  };
}

export function listConstructorMatrixEvidenceClaimBlockerIds(): string[] {
  return [...CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKER_IDS];
}

export function getConstructorMatrixEvidenceClaimBlocker(
  id: string,
): ConstructorMatrixEvidenceClaimBlocker | null {
  return CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKER_LOOKUP.get(id) ?? null;
}

export function validateConstructorMatrixEvidenceClaimBlockerIds(
  ids: readonly string[],
): { ok: boolean; missing: string[] } {
  const missing = ids.filter((id) => !CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKER_ID_SET.has(id));

  return {
    ok: missing.length === 0,
    missing,
  };
}

export function buildConstructorMatrixEvidenceClaimExtractionSummary():
  ConstructorMatrixEvidenceClaimExtractionSummary {
  const p0BacklogIds = CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG
    .filter((item) => item.priority === "P0")
    .map((item) => item.id as ConstructorMatrixSourceExpansionBacklogId);
  const p0BacklogIdSet = new Set<string>(p0BacklogIds);
  const p0SourceCandidateIds = CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES
    .filter((item) =>
      item.linkedSourceExpansionBacklogIds.some((id) => p0BacklogIdSet.has(id)),
    )
    .map((item) => item.id as ConstructorMatrixSourceCandidateId);
  const coveredSourceLookupIds = new Set(
    CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS.flatMap((item) => item.sourceLookupIntakeIds),
  );
  const coveredSourceCandidateIds = new Set([
    ...CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_ITEMS.flatMap((item) => item.sourceCandidateIds),
    ...CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS.flatMap((item) => item.sourceCandidateIds),
  ]);
  const coveredP0BacklogIds = new Set(
    CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE
      .filter((item) => coveredSourceLookupIds.has(item.id))
      .flatMap((item) => item.sourceExpansionBacklogIds)
      .filter((id) => p0BacklogIdSet.has(id)),
  );
  const coveredP0BacklogIdSet = new Set<string>(coveredP0BacklogIds);
  const highRiskAreasCovered = uniqueSorted([
    ...CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_ITEMS.flatMap((item) => item.methodOrRiskArea),
    ...CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS.flatMap((item) => item.affectedAreas),
  ]).filter((area) => (HIGH_RISK_AREAS as readonly string[]).includes(area));

  return {
    evidenceClaimCount: CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_ITEMS.length,
    evidenceClaimBlockerCount: CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS.length,
    extractedClaimsByStatus: countBy(
      CLAIM_STATUS_VALUES,
      CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_ITEMS.map((item) => item.status),
    ),
    claimBlockersByReason: countBy(
      CLAIM_BLOCKER_REASON_VALUES,
      CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS.map((item) => item.reason),
    ),
    claimRuntimeUseSummary: countBy(
      CLAIM_RUNTIME_USE_VALUES,
      CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_ITEMS.map((item) => item.runtimeUseNow),
    ),
    claimReviewQueueCounts: countBy(
      CLAIM_REVIEW_REQUIREMENT_VALUES,
      CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_ITEMS.flatMap((item) => item.reviewRequired),
    ),
    sourceLookupRecordsCoveredCount: coveredSourceLookupIds.size,
    sourceLookupRecordCount: CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE.length,
    p0SourceCandidatesCoveredCount: p0SourceCandidateIds.filter((id) =>
      coveredSourceCandidateIds.has(id),
    ).length,
    p0SourceCandidateCount: p0SourceCandidateIds.length,
    p0BacklogItemsCoveredCount: p0BacklogIds.filter((id) =>
      coveredP0BacklogIdSet.has(id),
    ).length,
    p0BacklogItemCount: p0BacklogIds.length,
    highRiskAreasCovered,
    highRiskAreasMissing: HIGH_RISK_AREAS.filter((area) => !highRiskAreasCovered.includes(area)),
    humanReviewed: false,
    runtimeChangeAllowedNow: false,
  };
}
