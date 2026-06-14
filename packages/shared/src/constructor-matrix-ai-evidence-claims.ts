import {
  CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS,
  type ConstructorMatrixAiSourceReviewId,
} from "./constructor-matrix-ai-source-review";
import {
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES,
  type ConstructorMatrixEvidenceClaimCandidate,
  type ConstructorMatrixEvidenceClaimCandidateId,
  type ConstructorMatrixEvidenceClaimCandidateReviewRequirement,
} from "./constructor-matrix-evidence-claim-candidates";

export type ConstructorMatrixAiEvidenceClaimStatus =
  | "ai_extracted_conservative_claim"
  | "blocked_source_text_needed"
  | "blocked_manual_verification_needed"
  | "human_review_required"
  | "do_not_automate";

export type ConstructorMatrixAiEvidenceClaimCategory =
  | "plan_structure_support"
  | "taper_context"
  | "recovery_caution"
  | "travel_fatigue_caution"
  | "data_quality_warning"
  | "source_limitation_warning"
  | "coach_review_needed_warning"
  | "medical_review_needed_warning";

export type ConstructorMatrixAiEvidenceClaimAllowedUseNow =
  | "none"
  | "docs_only"
  | "review_export_only"
  | "soft_warning_candidate"
  | "plan_structure_hint_candidate"
  | "fallback_guard_candidate";

export type ConstructorMatrixAiEvidenceClaim = {
  id: string;
  status: ConstructorMatrixAiEvidenceClaimStatus;
  category: ConstructorMatrixAiEvidenceClaimCategory;
  claimCandidateId: ConstructorMatrixEvidenceClaimCandidateId;
  title: string;
  claimText: string;
  sourceLookupIntakeIds: readonly string[];
  aiSourceReviewIds: readonly ConstructorMatrixAiSourceReviewId[];
  sourceCandidateIds: readonly string[];
  evidenceDependencyIds: readonly string[];
  dataDependencyIds: readonly string[];
  thresholdCandidateIds: readonly string[];
  reviewDecisionIds: readonly string[];
  blockerIds: readonly string[];
  sourceRefs: readonly string[];
  methodOrRiskArea: readonly string[];
  supports: readonly string[];
  limitations: readonly string[];
  reviewRequired: readonly ConstructorMatrixEvidenceClaimCandidateReviewRequirement[];
  allowedUseNow: ConstructorMatrixAiEvidenceClaimAllowedUseNow;
  forbiddenRuntimeUseNow: readonly string[];
  aiDeskReviewed: true;
  aiDeskReviewedAt: "2026-06-14T12:00:00.000Z";
  aiDeskReviewModel: "Codex AI desk review";
  aiDeskReviewLimitations: readonly string[];
  candidateOnly: true;
  finalEvidenceClaim: false;
  humanReviewed: false;
  runtimeChangeAllowedNow: false;
};

export interface ConstructorMatrixAiEvidenceClaimSummary {
  aiEvidenceClaimCount: number;
  aiEvidenceClaimIds: readonly ConstructorMatrixAiEvidenceClaimId[];
  claimCandidateCoveredCount: number;
  claimCandidateCount: number;
  byStatus: Readonly<Record<ConstructorMatrixAiEvidenceClaimStatus, number>>;
  byCategory: Readonly<Record<ConstructorMatrixAiEvidenceClaimCategory, number>>;
  byAllowedUseNow: Readonly<Record<ConstructorMatrixAiEvidenceClaimAllowedUseNow, number>>;
  softWarningCandidateCount: number;
  planStructureHintCandidateCount: number;
  blockedCount: number;
  finalEvidenceClaimCount: 0;
  aiDeskReviewedCount: number;
  humanReviewed: false;
  runtimeChangeAllowedNow: false;
}

const AI_EVIDENCE_CLAIM_STATUSES = [
  "ai_extracted_conservative_claim",
  "blocked_source_text_needed",
  "blocked_manual_verification_needed",
  "human_review_required",
  "do_not_automate",
] as const satisfies readonly ConstructorMatrixAiEvidenceClaimStatus[];

const AI_EVIDENCE_CLAIM_CATEGORIES = [
  "plan_structure_support",
  "taper_context",
  "recovery_caution",
  "travel_fatigue_caution",
  "data_quality_warning",
  "source_limitation_warning",
  "coach_review_needed_warning",
  "medical_review_needed_warning",
] as const satisfies readonly ConstructorMatrixAiEvidenceClaimCategory[];

const AI_EVIDENCE_CLAIM_ALLOWED_USES = [
  "none",
  "docs_only",
  "review_export_only",
  "soft_warning_candidate",
  "plan_structure_hint_candidate",
  "fallback_guard_candidate",
] as const satisfies readonly ConstructorMatrixAiEvidenceClaimAllowedUseNow[];

const HIGH_RISK_MEDICAL_AREAS = new Set([
  "weight_cut",
  "hydration",
  "pain",
  "injury",
  "injury_pain",
  "female_context",
  "RED-S",
  "youth_context",
  "bfr_kaatsu",
]);

const COMMON_FORBIDDEN_RUNTIME_USE = [
  "runtime hard rule",
  "runtime gate",
  "medical decision automation",
  "automatic weight-cut decision",
  "automatic hydration diagnosis",
  "automatic injury-return decision",
  "automatic RED-S decision",
  "automatic BFR/KAATSU prescription",
  "numeric threshold promotion",
  "Matrix default promotion",
] as const;

const AI_SOURCE_REVIEW_BY_LOOKUP_ID = new Map(
  CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS.map((item) => [item.sourceLookupIntakeId, item]),
) as Map<string, (typeof CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS)[number]>;

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

function uniqueSorted(items: readonly string[]): string[] {
  return Array.from(new Set(items)).sort();
}

function sourceReviewsFor(
  candidate: ConstructorMatrixEvidenceClaimCandidate,
) {
  return candidate.sourceLookupIntakeIds
    .map((id) => AI_SOURCE_REVIEW_BY_LOOKUP_ID.get(id))
    .filter((item): item is (typeof CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS)[number] =>
      Boolean(item),
    );
}

function hasHighRiskMedicalArea(candidate: ConstructorMatrixEvidenceClaimCandidate) {
  return candidate.methodOrRiskArea.some((area) => HIGH_RISK_MEDICAL_AREAS.has(area));
}

function statusFor(
  candidate: ConstructorMatrixEvidenceClaimCandidate,
  sourceReviews: readonly (typeof CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS)[number][],
): ConstructorMatrixAiEvidenceClaimStatus {
  if (candidate.status === "do_not_automate_candidate") {
    return "do_not_automate";
  }

  if (
    sourceReviews.some(
      (item) => item.aiVerificationStatus === "manual_verification_still_needed",
    )
  ) {
    return "blocked_manual_verification_needed";
  }

  if (sourceReviews.some((item) => item.aiVerificationStatus === "source_text_needed")) {
    return "blocked_source_text_needed";
  }

  if (
    candidate.status === "needs_human_review_before_extraction" ||
    sourceReviews.length === 0
  ) {
    return "human_review_required";
  }

  return "ai_extracted_conservative_claim";
}

function categoryFor(
  candidate: ConstructorMatrixEvidenceClaimCandidate,
): ConstructorMatrixAiEvidenceClaimCategory {
  const areas = new Set(candidate.methodOrRiskArea);

  if (hasHighRiskMedicalArea(candidate)) {
    return "medical_review_needed_warning";
  }

  if (areas.has("wearable_data")) {
    return "data_quality_warning";
  }

  if (areas.has("travel_fatigue")) {
    return "travel_fatigue_caution";
  }

  if (areas.has("readiness") || areas.has("sleep") || areas.has("rhr") || areas.has("hrv")) {
    return "recovery_caution";
  }

  if (areas.has("taper")) {
    return "taper_context";
  }

  if (areas.has("contact_load") || areas.has("lmv") || areas.has("competition_context")) {
    return "coach_review_needed_warning";
  }

  return "source_limitation_warning";
}

function allowedUseFor(
  candidate: ConstructorMatrixEvidenceClaimCandidate,
  category: ConstructorMatrixAiEvidenceClaimCategory,
): ConstructorMatrixAiEvidenceClaimAllowedUseNow {
  if (hasHighRiskMedicalArea(candidate)) {
    return "review_export_only";
  }

  switch (category) {
    case "data_quality_warning":
    case "recovery_caution":
    case "travel_fatigue_caution":
      return "soft_warning_candidate";
    case "taper_context":
    case "coach_review_needed_warning":
    case "plan_structure_support":
      return "plan_structure_hint_candidate";
    case "source_limitation_warning":
      return "docs_only";
    case "medical_review_needed_warning":
      return "review_export_only";
    default:
      return "docs_only";
  }
}

function claimTextFor(
  candidate: ConstructorMatrixEvidenceClaimCandidate,
  category: ConstructorMatrixAiEvidenceClaimCategory,
): string {
  const categoryText = category.replaceAll("_", " ");

  return `AI desk review may use "${candidate.title}" only as ${categoryText}. Source text or reviewer review remains required before final claim extraction; no diagnosis, prescription, numeric threshold, runtime hard gate, or Matrix default promotion is approved.`;
}

function aiEvidenceClaimFromCandidate(
  candidate: ConstructorMatrixEvidenceClaimCandidate,
): ConstructorMatrixAiEvidenceClaim {
  const sourceReviews = sourceReviewsFor(candidate);
  const category = categoryFor(candidate);

  return {
    id: `ai_claim_${candidate.id}`,
    status: statusFor(candidate, sourceReviews),
    category,
    claimCandidateId: candidate.id as ConstructorMatrixEvidenceClaimCandidateId,
    title: `AI desk claim: ${candidate.title}`,
    claimText: claimTextFor(candidate, category),
    sourceLookupIntakeIds: candidate.sourceLookupIntakeIds,
    aiSourceReviewIds: sourceReviews.map(
      (item) => item.id as ConstructorMatrixAiSourceReviewId,
    ),
    sourceCandidateIds: candidate.sourceCandidateIds,
    evidenceDependencyIds: candidate.evidenceDependencyIds,
    dataDependencyIds: candidate.dataDependencyIds,
    thresholdCandidateIds: candidate.thresholdCandidateIds,
    reviewDecisionIds: candidate.reviewDecisionIds,
    blockerIds: candidate.blockerIds,
    sourceRefs: uniqueSorted(sourceReviews.flatMap((item) => item.aiDeskReviewSourceRefs)),
    methodOrRiskArea: candidate.methodOrRiskArea,
    supports: candidate.supports,
    limitations: uniqueSorted([
      ...candidate.limitations,
      ...sourceReviews.flatMap((item) => item.limitations),
      "AI desk review is not human, coach, or medical review",
      "This is not a final evidence claim",
      "No numeric threshold approved",
      "No runtime behavior change allowed now",
    ]),
    reviewRequired: candidate.reviewRequired,
    allowedUseNow: allowedUseFor(candidate, category),
    forbiddenRuntimeUseNow: uniqueSorted([
      ...COMMON_FORBIDDEN_RUNTIME_USE,
      ...sourceReviews.flatMap((item) => item.forbiddenRuntimeUseNow),
    ]),
    aiDeskReviewed: true,
    aiDeskReviewedAt: "2026-06-14T12:00:00.000Z",
    aiDeskReviewModel: "Codex AI desk review",
    aiDeskReviewLimitations: [
      "AI desk review cannot replace human, coach, medical, or data-quality review",
      "Source text remains required where AI source review says source_text_needed",
      "Manual source verification remains required where AI source review says manual_verification_still_needed",
    ],
    candidateOnly: true,
    finalEvidenceClaim: false,
    humanReviewed: false,
    runtimeChangeAllowedNow: false,
  };
}

export const CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS =
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES.map(aiEvidenceClaimFromCandidate) satisfies
    readonly ConstructorMatrixAiEvidenceClaim[];

export type ConstructorMatrixAiEvidenceClaimId =
  (typeof CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS)[number]["id"];

export const CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIM_IDS =
  CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS.map((item) => item.id);

export function listConstructorMatrixAiEvidenceClaimIds():
  ConstructorMatrixAiEvidenceClaimId[] {
  return [...CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIM_IDS] as ConstructorMatrixAiEvidenceClaimId[];
}

export function getConstructorMatrixAiEvidenceClaim(
  id: string,
): ConstructorMatrixAiEvidenceClaim | null {
  return (
    CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS.find((item) => item.id === id) ??
    null
  );
}

export function validateConstructorMatrixAiEvidenceClaimIds(
  ids: readonly string[],
): { ok: boolean; missing: string[] } {
  const knownIds = new Set<string>(CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIM_IDS);
  const missing = ids.filter((id) => !knownIds.has(id));

  return { ok: missing.length === 0, missing };
}

export function buildConstructorMatrixAiEvidenceClaimSummary():
  ConstructorMatrixAiEvidenceClaimSummary {
  const statuses = CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS.map((item) => item.status);
  const categories = CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS.map((item) => item.category);
  const allowedUses = CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS.map(
    (item) => item.allowedUseNow,
  );

  return {
    aiEvidenceClaimCount: CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS.length,
    aiEvidenceClaimIds: listConstructorMatrixAiEvidenceClaimIds(),
    claimCandidateCoveredCount: new Set(
      CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS.map((item) => item.claimCandidateId),
    ).size,
    claimCandidateCount: CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES.length,
    byStatus: countBy(AI_EVIDENCE_CLAIM_STATUSES, statuses),
    byCategory: countBy(AI_EVIDENCE_CLAIM_CATEGORIES, categories),
    byAllowedUseNow: countBy(AI_EVIDENCE_CLAIM_ALLOWED_USES, allowedUses),
    softWarningCandidateCount: CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS.filter(
      (item) => item.allowedUseNow === "soft_warning_candidate",
    ).length,
    planStructureHintCandidateCount: CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS.filter(
      (item) => item.allowedUseNow === "plan_structure_hint_candidate",
    ).length,
    blockedCount: CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS.filter(
      (item) => item.status !== "ai_extracted_conservative_claim",
    ).length,
    finalEvidenceClaimCount: 0,
    aiDeskReviewedCount: CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS.filter(
      (item) => item.aiDeskReviewed,
    ).length,
    humanReviewed: false,
    runtimeChangeAllowedNow: false,
  };
}
