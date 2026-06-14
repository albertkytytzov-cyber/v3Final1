import {
  CONSTRUCTOR_MATRIX_AI_REVIEW_POLICY_IDS,
  type ConstructorMatrixAiReviewPolicyRuleId,
} from "./constructor-matrix-ai-review-policy";
import {
  CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE,
  type ConstructorMatrixSourceLookupIntake,
  type ConstructorMatrixSourceLookupIntakeId,
  type ConstructorMatrixSourceLookupReviewTrack,
} from "./constructor-matrix-source-lookup-intake";

export type ConstructorMatrixAiSourceVerificationStatus =
  | "verified_identity"
  | "verified_public_source"
  | "source_text_needed"
  | "manual_verification_still_needed"
  | "rejected";

export type ConstructorMatrixAiSourceReviewAllowedUseNow =
  | "docs_only"
  | "review_export_only"
  | "warning_candidate_only"
  | "not_allowed";

export type ConstructorMatrixAiSourceReviewConfidence =
  | "high"
  | "medium"
  | "low";

export type ConstructorMatrixAiSourceReview = {
  id: string;
  sourceLookupIntakeId: ConstructorMatrixSourceLookupIntakeId;
  sourceCandidateIds: readonly string[];
  sourceExpansionBacklogIds: readonly string[];
  reviewDecisionIds: readonly string[];
  sourceTitle: string;
  sourceUrl: string | null;
  sourceType: ConstructorMatrixSourceLookupIntake["reliability"];
  aiVerificationStatus: ConstructorMatrixAiSourceVerificationStatus;
  aiDeskReviewed: true;
  aiDeskReviewedAt: "2026-06-14T12:00:00.000Z";
  aiDeskReviewModel: "Codex AI desk review";
  aiDeskReviewConfidence: ConstructorMatrixAiSourceReviewConfidence;
  aiDeskReviewSourceRefs: readonly string[];
  aiDeskReviewPolicyRuleIds: readonly ConstructorMatrixAiReviewPolicyRuleId[];
  humanReviewed: false;
  limitations: readonly string[];
  reviewRequired: readonly ConstructorMatrixSourceLookupReviewTrack[];
  allowedUseNow: ConstructorMatrixAiSourceReviewAllowedUseNow;
  forbiddenRuntimeUseNow: readonly string[];
  runtimeChangeAllowedNow: false;
};

export interface ConstructorMatrixAiSourceReviewSummary {
  aiSourceReviewCount: number;
  aiSourceReviewIds: readonly ConstructorMatrixAiSourceReviewId[];
  sourceLookupIntakeCoveredCount: number;
  sourceLookupIntakeCount: number;
  byStatus: Readonly<Record<ConstructorMatrixAiSourceVerificationStatus, number>>;
  byAllowedUseNow: Readonly<Record<ConstructorMatrixAiSourceReviewAllowedUseNow, number>>;
  sourceTextNeededCount: number;
  manualVerificationStillNeededCount: number;
  rejectedCount: number;
  aiDeskReviewedCount: number;
  humanReviewed: false;
  runtimeChangeAllowedNow: false;
}

const AI_SOURCE_REVIEW_STATUSES = [
  "verified_identity",
  "verified_public_source",
  "source_text_needed",
  "manual_verification_still_needed",
  "rejected",
] as const satisfies readonly ConstructorMatrixAiSourceVerificationStatus[];

const AI_SOURCE_REVIEW_ALLOWED_USES = [
  "docs_only",
  "review_export_only",
  "warning_candidate_only",
  "not_allowed",
] as const satisfies readonly ConstructorMatrixAiSourceReviewAllowedUseNow[];

const COMMON_FORBIDDEN_RUNTIME_USE = [
  "runtime hard rule",
  "runtime gate",
  "medical decision automation",
  "numeric threshold promotion",
  "source readiness promotion",
  "production rollout promotion",
] as const;

const AI_SOURCE_REVIEW_POLICY_IDS = [
  "ai_desk_review_identity_boundary",
  "high_risk_medical_non_automation_boundary",
] as const satisfies readonly ConstructorMatrixAiReviewPolicyRuleId[];

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

function aiVerificationStatusFor(
  item: ConstructorMatrixSourceLookupIntake,
): ConstructorMatrixAiSourceVerificationStatus {
  if (item.lookupStatus === "not_found" || item.lookupStatus === "lookup_unavailable") {
    return "rejected";
  }

  if (item.extractionReadiness === "needs_manual_verification") {
    return "manual_verification_still_needed";
  }

  if (item.extractionReadiness === "needs_full_text_or_abstract") {
    return "source_text_needed";
  }

  if (item.lookupStatus.startsWith("verified_")) {
    return item.sourceUrl ? "verified_public_source" : "verified_identity";
  }

  return "verified_identity";
}

function allowedUseNowFor(
  status: ConstructorMatrixAiSourceVerificationStatus,
): ConstructorMatrixAiSourceReviewAllowedUseNow {
  switch (status) {
    case "verified_public_source":
    case "verified_identity":
      return "docs_only";
    case "source_text_needed":
    case "manual_verification_still_needed":
      return "review_export_only";
    case "rejected":
      return "not_allowed";
    default:
      return "review_export_only";
  }
}

function confidenceFor(
  status: ConstructorMatrixAiSourceVerificationStatus,
): ConstructorMatrixAiSourceReviewConfidence {
  switch (status) {
    case "verified_public_source":
    case "verified_identity":
      return "medium";
    case "source_text_needed":
      return "medium";
    case "manual_verification_still_needed":
    case "rejected":
      return "low";
    default:
      return "low";
  }
}

function limitationsFor(
  item: ConstructorMatrixSourceLookupIntake,
  status: ConstructorMatrixAiSourceVerificationStatus,
): string[] {
  const limitations = [
    "AI desk review is not human, coach, or medical review",
    "No source readiness promotion is performed by this registry",
    "No runtime rule or numeric threshold is approved by this registry",
    ...item.limitations,
  ];

  if (status === "source_text_needed") {
    limitations.push(
      "Full text or abstract review remains required before claim extraction",
    );
  }

  if (status === "manual_verification_still_needed") {
    limitations.push(
      "Manual source verification remains required before claim extraction",
    );
  }

  if (status === "rejected") {
    limitations.push("This source cannot be used until a replacement is reviewed");
  }

  return Array.from(new Set(limitations));
}

function sourceRefsFor(item: ConstructorMatrixSourceLookupIntake): string[] {
  return [
    item.sourceUrl ? `url:${item.sourceUrl}` : null,
    item.doi ? `doi:${item.doi}` : null,
    item.pmid ? `pmid:${item.pmid}` : null,
  ].filter((value): value is string => Boolean(value));
}

function aiSourceReviewFromLookup(
  item: ConstructorMatrixSourceLookupIntake,
): ConstructorMatrixAiSourceReview {
  const status = aiVerificationStatusFor(item);

  return {
    id: `ai_source_review_${item.id}`,
    sourceLookupIntakeId: item.id as ConstructorMatrixSourceLookupIntakeId,
    sourceCandidateIds: [item.sourceCandidateId],
    sourceExpansionBacklogIds: item.sourceExpansionBacklogIds,
    reviewDecisionIds: item.linkedReviewDecisionIds,
    sourceTitle: item.title,
    sourceUrl: item.sourceUrl,
    sourceType: item.reliability,
    aiVerificationStatus: status,
    aiDeskReviewed: true,
    aiDeskReviewedAt: "2026-06-14T12:00:00.000Z",
    aiDeskReviewModel: "Codex AI desk review",
    aiDeskReviewConfidence: confidenceFor(status),
    aiDeskReviewSourceRefs: sourceRefsFor(item),
    aiDeskReviewPolicyRuleIds: AI_SOURCE_REVIEW_POLICY_IDS.filter((id) =>
      CONSTRUCTOR_MATRIX_AI_REVIEW_POLICY_IDS.includes(id),
    ),
    humanReviewed: false,
    limitations: limitationsFor(item, status),
    reviewRequired: item.reviewRequired,
    allowedUseNow: allowedUseNowFor(status),
    forbiddenRuntimeUseNow: Array.from(
      new Set([...COMMON_FORBIDDEN_RUNTIME_USE, ...item.forbiddenRuntimeUseNow]),
    ),
    runtimeChangeAllowedNow: false,
  };
}

export const CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS =
  CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE.map(aiSourceReviewFromLookup) satisfies
    readonly ConstructorMatrixAiSourceReview[];

export type ConstructorMatrixAiSourceReviewId =
  (typeof CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS)[number]["id"];

export const CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEW_IDS =
  CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS.map((item) => item.id);

export function listConstructorMatrixAiSourceReviewIds():
  ConstructorMatrixAiSourceReviewId[] {
  return [...CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEW_IDS] as ConstructorMatrixAiSourceReviewId[];
}

export function getConstructorMatrixAiSourceReview(
  id: string,
): ConstructorMatrixAiSourceReview | null {
  return (
    CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS.find((item) => item.id === id) ??
    null
  );
}

export function getConstructorMatrixAiSourceReviewForLookup(
  sourceLookupIntakeId: string,
): ConstructorMatrixAiSourceReview | null {
  return (
    CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS.find(
      (item) => item.sourceLookupIntakeId === sourceLookupIntakeId,
    ) ?? null
  );
}

export function validateConstructorMatrixAiSourceReviewIds(
  ids: readonly string[],
): { ok: boolean; missing: string[] } {
  const knownIds = new Set<string>(CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEW_IDS);
  const missing = ids.filter((id) => !knownIds.has(id));

  return { ok: missing.length === 0, missing };
}

export function buildConstructorMatrixAiSourceReviewSummary():
  ConstructorMatrixAiSourceReviewSummary {
  const statuses = CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS.map(
    (item) => item.aiVerificationStatus,
  );
  const allowedUses = CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS.map(
    (item) => item.allowedUseNow,
  );
  const coveredLookupIds = new Set(
    CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS.map((item) => item.sourceLookupIntakeId),
  );

  return {
    aiSourceReviewCount: CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS.length,
    aiSourceReviewIds: listConstructorMatrixAiSourceReviewIds(),
    sourceLookupIntakeCoveredCount: coveredLookupIds.size,
    sourceLookupIntakeCount: CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE.length,
    byStatus: countBy(AI_SOURCE_REVIEW_STATUSES, statuses),
    byAllowedUseNow: countBy(AI_SOURCE_REVIEW_ALLOWED_USES, allowedUses),
    sourceTextNeededCount: CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS.filter(
      (item) => item.aiVerificationStatus === "source_text_needed",
    ).length,
    manualVerificationStillNeededCount: CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS.filter(
      (item) => item.aiVerificationStatus === "manual_verification_still_needed",
    ).length,
    rejectedCount: CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS.filter(
      (item) => item.aiVerificationStatus === "rejected",
    ).length,
    aiDeskReviewedCount: CONSTRUCTOR_MATRIX_AI_SOURCE_REVIEWS.filter(
      (item) => item.aiDeskReviewed,
    ).length,
    humanReviewed: false,
    runtimeChangeAllowedNow: false,
  };
}
