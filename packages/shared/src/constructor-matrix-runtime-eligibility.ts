import {
  CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS,
  type ConstructorMatrixAiEvidenceClaim,
  type ConstructorMatrixAiEvidenceClaimId,
} from "./constructor-matrix-ai-evidence-claims";
import {
  CONSTRUCTOR_MATRIX_AI_SAFETY_CLASSIFICATIONS,
  type ConstructorMatrixAiSafetyClassificationEntry,
  type ConstructorMatrixAiSafetyClassificationId,
} from "./constructor-matrix-ai-safety-classification";

export type ConstructorMatrixRuntimeEligibleUse =
  | "none"
  | "docs_only"
  | "review_export_only"
  | "soft_warning"
  | "plan_structure_hint"
  | "fallback_guard";

export type ConstructorMatrixRuntimeForbiddenUse =
  | "hard_gate"
  | "medical_decision"
  | "numeric_threshold"
  | "automatic_weight_cut"
  | "automatic_hydration"
  | "automatic_injury_return"
  | "automatic_REDS"
  | "automatic_BFR_KAATSU"
  | "Matrix_default_promotion";

export type ConstructorMatrixRuntimeEligibilityStatus =
  | "eligible_for_soft_warning_metadata"
  | "eligible_for_plan_structure_hint_metadata"
  | "eligible_for_fallback_guard_metadata"
  | "docs_or_review_export_only"
  | "blocked_high_risk"
  | "blocked_pending_review";

export type ConstructorMatrixRuntimeEligibilityEntry = {
  id: string;
  aiEvidenceClaimId: ConstructorMatrixAiEvidenceClaimId;
  safetyClassificationId: ConstructorMatrixAiSafetyClassificationId;
  claimCandidateId: string;
  title: string;
  status: ConstructorMatrixRuntimeEligibilityStatus;
  allowedRuntimeUse: ConstructorMatrixRuntimeEligibleUse;
  forbiddenRuntimeUses: readonly ConstructorMatrixRuntimeForbiddenUse[];
  riskAreas: readonly string[];
  requiredClassifications: readonly string[];
  sourceCandidateIds: readonly string[];
  evidenceDependencyIds: readonly string[];
  dataDependencyIds: readonly string[];
  thresholdCandidateIds: readonly string[];
  reviewDecisionIds: readonly string[];
  runtimeConditions: readonly string[];
  fallbackBehavior: string;
  limitations: readonly string[];
  aiDeskReviewed: true;
  aiDeskReviewedAt: "2026-06-14T12:00:00.000Z";
  aiDeskReviewModel: "Codex AI desk review";
  humanReviewed: false;
  runtimeChangeAllowedNow: boolean;
};

export interface ConstructorMatrixRuntimeEligibilitySummary {
  runtimeEligibilityCount: number;
  runtimeEligibilityIds: readonly ConstructorMatrixRuntimeEligibilityId[];
  aiEvidenceClaimCoveredCount: number;
  aiEvidenceClaimCount: number;
  byStatus: Readonly<Record<ConstructorMatrixRuntimeEligibilityStatus, number>>;
  byAllowedRuntimeUse: Readonly<Record<ConstructorMatrixRuntimeEligibleUse, number>>;
  softWarningEligibleCount: number;
  planStructureHintEligibleCount: number;
  fallbackGuardEligibleCount: number;
  blockedHighRiskCount: number;
  blockedPendingReviewCount: number;
  runtimeChangeAllowedNowCount: number;
  humanReviewed: false;
}

const RUNTIME_ELIGIBILITY_STATUSES = [
  "eligible_for_soft_warning_metadata",
  "eligible_for_plan_structure_hint_metadata",
  "eligible_for_fallback_guard_metadata",
  "docs_or_review_export_only",
  "blocked_high_risk",
  "blocked_pending_review",
] as const satisfies readonly ConstructorMatrixRuntimeEligibilityStatus[];

const RUNTIME_ELIGIBLE_USES = [
  "none",
  "docs_only",
  "review_export_only",
  "soft_warning",
  "plan_structure_hint",
  "fallback_guard",
] as const satisfies readonly ConstructorMatrixRuntimeEligibleUse[];

const COMMON_FORBIDDEN_RUNTIME_USES = [
  "hard_gate",
  "medical_decision",
  "numeric_threshold",
  "automatic_weight_cut",
  "automatic_hydration",
  "automatic_injury_return",
  "automatic_REDS",
  "automatic_BFR_KAATSU",
  "Matrix_default_promotion",
] as const satisfies readonly ConstructorMatrixRuntimeForbiddenUse[];

const SAFETY_BY_AI_CLAIM_ID = new Map(
  CONSTRUCTOR_MATRIX_AI_SAFETY_CLASSIFICATIONS.map((item) => [
    item.aiEvidenceClaimId,
    item,
  ]),
) as Map<string, ConstructorMatrixAiSafetyClassificationEntry>;

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

function uniqueSorted<T extends string>(items: readonly T[]): T[] {
  return Array.from(new Set(items)).sort();
}

function isHighRiskBlocked(
  safety: ConstructorMatrixAiSafetyClassificationEntry,
): boolean {
  return (
    safety.classifications.includes("do_not_automate") ||
    safety.classifications.includes("medical_review_required")
  );
}

function runtimeStatusFor(
  claim: ConstructorMatrixAiEvidenceClaim,
  safety: ConstructorMatrixAiSafetyClassificationEntry,
): ConstructorMatrixRuntimeEligibilityStatus {
  if (isHighRiskBlocked(safety)) {
    return "blocked_high_risk";
  }

  if (claim.status !== "ai_extracted_conservative_claim") {
    if (safety.classifications.includes("safe_for_soft_warning")) {
      return "eligible_for_soft_warning_metadata";
    }

    if (safety.classifications.includes("safe_for_plan_structure")) {
      return "eligible_for_plan_structure_hint_metadata";
    }

    return "blocked_pending_review";
  }

  if (safety.classifications.includes("safe_for_plan_structure")) {
    return "eligible_for_plan_structure_hint_metadata";
  }

  if (safety.classifications.includes("safe_for_soft_warning")) {
    return "eligible_for_soft_warning_metadata";
  }

  if (safety.classifications.includes("fallback_only")) {
    return "eligible_for_fallback_guard_metadata";
  }

  return "docs_or_review_export_only";
}

function allowedRuntimeUseFor(
  status: ConstructorMatrixRuntimeEligibilityStatus,
): ConstructorMatrixRuntimeEligibleUse {
  switch (status) {
    case "eligible_for_soft_warning_metadata":
      return "soft_warning";
    case "eligible_for_plan_structure_hint_metadata":
      return "plan_structure_hint";
    case "eligible_for_fallback_guard_metadata":
      return "fallback_guard";
    case "docs_or_review_export_only":
      return "review_export_only";
    case "blocked_high_risk":
    case "blocked_pending_review":
      return "none";
    default:
      return "none";
  }
}

function runtimeChangeAllowedNowFor(
  allowedRuntimeUse: ConstructorMatrixRuntimeEligibleUse,
): boolean {
  return ["soft_warning", "plan_structure_hint", "fallback_guard"].includes(
    allowedRuntimeUse,
  );
}

function runtimeConditionsFor(
  allowedRuntimeUse: ConstructorMatrixRuntimeEligibleUse,
): string[] {
  const baseConditions = [
    "AI desk reviewed metadata only",
    "humanReviewed remains false",
    "no medical decision automation",
    "no numeric threshold runtime gate",
    "legacy fallback remains available",
  ];

  if (allowedRuntimeUse === "soft_warning") {
    return [
      ...baseConditions,
      "soft warning must be advisory and dismissible by existing fallback",
    ];
  }

  if (allowedRuntimeUse === "plan_structure_hint") {
    return [
      ...baseConditions,
      "plan-structure hint must not change eligibility, risk, volume, or rollout gates",
    ];
  }

  if (allowedRuntimeUse === "fallback_guard") {
    return [
      ...baseConditions,
      "fallback guard may only choose legacy or safe fallback behavior",
    ];
  }

  return baseConditions;
}

function fallbackBehaviorFor(allowedRuntimeUse: ConstructorMatrixRuntimeEligibleUse): string {
  if (allowedRuntimeUse === "none") {
    return "Use existing legacy or safe fallback; do not apply AI-reviewed metadata at runtime.";
  }

  return "If metadata is missing, ambiguous, or high-risk, keep the existing legacy or safe fallback behavior.";
}

function runtimeEligibilityFromClaim(
  claim: ConstructorMatrixAiEvidenceClaim,
): ConstructorMatrixRuntimeEligibilityEntry {
  const safety = SAFETY_BY_AI_CLAIM_ID.get(claim.id);

  if (!safety) {
    throw new Error(`Missing AI safety classification for ${claim.id}`);
  }

  const status = runtimeStatusFor(claim, safety);
  const allowedRuntimeUse = allowedRuntimeUseFor(status);

  return {
    id: `runtime_eligibility_${claim.claimCandidateId}`,
    aiEvidenceClaimId: claim.id as ConstructorMatrixAiEvidenceClaimId,
    safetyClassificationId: safety.id as ConstructorMatrixAiSafetyClassificationId,
    claimCandidateId: claim.claimCandidateId,
    title: `Runtime eligibility: ${claim.title}`,
    status,
    allowedRuntimeUse,
    forbiddenRuntimeUses: COMMON_FORBIDDEN_RUNTIME_USES,
    riskAreas: claim.methodOrRiskArea,
    requiredClassifications: safety.classifications,
    sourceCandidateIds: claim.sourceCandidateIds,
    evidenceDependencyIds: claim.evidenceDependencyIds,
    dataDependencyIds: claim.dataDependencyIds,
    thresholdCandidateIds: claim.thresholdCandidateIds,
    reviewDecisionIds: claim.reviewDecisionIds,
    runtimeConditions: runtimeConditionsFor(allowedRuntimeUse),
    fallbackBehavior: fallbackBehaviorFor(allowedRuntimeUse),
    limitations: uniqueSorted([
      ...safety.limitations,
      "Runtime eligibility is metadata only until an explicit integration stage consumes it",
      "No production default, save, assign, or rollout promotion is approved by this map",
    ]),
    aiDeskReviewed: true,
    aiDeskReviewedAt: "2026-06-14T12:00:00.000Z",
    aiDeskReviewModel: "Codex AI desk review",
    humanReviewed: false,
    runtimeChangeAllowedNow: runtimeChangeAllowedNowFor(allowedRuntimeUse),
  };
}

export const CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY =
  CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS.map(
    runtimeEligibilityFromClaim,
  ) satisfies readonly ConstructorMatrixRuntimeEligibilityEntry[];

export type ConstructorMatrixRuntimeEligibilityId =
  (typeof CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY)[number]["id"];

export const CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY_IDS =
  CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY.map((item) => item.id);

export function listConstructorMatrixRuntimeEligibilityIds():
  ConstructorMatrixRuntimeEligibilityId[] {
  return [
    ...CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY_IDS,
  ] as ConstructorMatrixRuntimeEligibilityId[];
}

export function getConstructorMatrixRuntimeEligibility(
  id: string,
): ConstructorMatrixRuntimeEligibilityEntry | null {
  return CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY.find((item) => item.id === id) ?? null;
}

export function validateConstructorMatrixRuntimeEligibilityIds(
  ids: readonly string[],
): { ok: boolean; missing: string[] } {
  const knownIds = new Set<string>(CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY_IDS);
  const missing = ids.filter((id) => !knownIds.has(id));

  return { ok: missing.length === 0, missing };
}

export function buildConstructorMatrixRuntimeEligibilitySummary():
  ConstructorMatrixRuntimeEligibilitySummary {
  const statuses = CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY.map((item) => item.status);
  const allowedRuntimeUses = CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY.map(
    (item) => item.allowedRuntimeUse,
  );

  return {
    runtimeEligibilityCount: CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY.length,
    runtimeEligibilityIds: listConstructorMatrixRuntimeEligibilityIds(),
    aiEvidenceClaimCoveredCount: new Set(
      CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY.map((item) => item.aiEvidenceClaimId),
    ).size,
    aiEvidenceClaimCount: CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS.length,
    byStatus: countBy(RUNTIME_ELIGIBILITY_STATUSES, statuses),
    byAllowedRuntimeUse: countBy(RUNTIME_ELIGIBLE_USES, allowedRuntimeUses),
    softWarningEligibleCount: CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY.filter(
      (item) => item.allowedRuntimeUse === "soft_warning",
    ).length,
    planStructureHintEligibleCount: CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY.filter(
      (item) => item.allowedRuntimeUse === "plan_structure_hint",
    ).length,
    fallbackGuardEligibleCount: CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY.filter(
      (item) => item.allowedRuntimeUse === "fallback_guard",
    ).length,
    blockedHighRiskCount: CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY.filter(
      (item) => item.status === "blocked_high_risk",
    ).length,
    blockedPendingReviewCount: CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY.filter(
      (item) => item.status === "blocked_pending_review",
    ).length,
    runtimeChangeAllowedNowCount: CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY.filter(
      (item) => item.runtimeChangeAllowedNow,
    ).length,
    humanReviewed: false,
  };
}
