import {
  CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE,
  type ConstructorMatrixSourceLookupIntake,
  type ConstructorMatrixSourceLookupIntakeId,
} from "./constructor-matrix-source-lookup-intake";

export type ConstructorMatrixDeskSourceReviewStatus =
  | "desk_verified_identity"
  | "desk_verified_url"
  | "desk_review_limited"
  | "manual_verification_still_required"
  | "full_text_still_required"
  | "policy_text_still_required"
  | "not_ready_for_claim_extraction";

export type ConstructorMatrixDeskSourceReviewUse =
  | "source_identity_only"
  | "claim_candidate_support_only"
  | "review_packet_support_only"
  | "manual_verification_required"
  | "do_not_use_for_claims_yet";

export type ConstructorMatrixDeskSourceReview = {
  id: string;
  sourceLookupIntakeIds: readonly string[];
  sourceCandidateIds: readonly string[];
  sourceExpansionBacklogIds: readonly string[];
  title: string;
  status: ConstructorMatrixDeskSourceReviewStatus;
  deskReviewUse: ConstructorMatrixDeskSourceReviewUse;
  checkedAs: readonly string[];
  confirmedMetadata: readonly string[];
  stillMissing: readonly string[];
  limitations: readonly string[];
  allowedNextActions: readonly string[];
  prohibitedActions: readonly string[];
  humanReviewed: false;
  runtimeChangeAllowedNow: false;
};

export interface ConstructorMatrixDeskSourceReviewSummary {
  deskSourceReviewCount: number;
  deskSourceReviewIds: readonly ConstructorMatrixDeskSourceReviewId[];
  deskSourceReviewsByStatus: Readonly<Record<ConstructorMatrixDeskSourceReviewStatus, number>>;
  deskSourceReviewsByUse: Readonly<Record<ConstructorMatrixDeskSourceReviewUse, number>>;
  sourceLookupRecordsCoveredCount: number;
  sourceLookupRecordCount: number;
  manualVerificationStillRequiredCount: number;
  fullTextStillRequiredCount: number;
  policyTextStillRequiredCount: number;
  humanReviewedCount: number;
  runtimeChangeAllowedNowCount: number;
}

const DESK_SOURCE_REVIEW_STATUSES = [
  "desk_verified_identity",
  "desk_verified_url",
  "desk_review_limited",
  "manual_verification_still_required",
  "full_text_still_required",
  "policy_text_still_required",
  "not_ready_for_claim_extraction",
] as const satisfies readonly ConstructorMatrixDeskSourceReviewStatus[];

const DESK_SOURCE_REVIEW_USES = [
  "source_identity_only",
  "claim_candidate_support_only",
  "review_packet_support_only",
  "manual_verification_required",
  "do_not_use_for_claims_yet",
] as const satisfies readonly ConstructorMatrixDeskSourceReviewUse[];

const COMMON_PROHIBITED_ACTIONS = [
  "runtime hard rule",
  "runtime gate",
  "numeric threshold promotion",
  "source readiness promotion",
  "final evidence claim approval",
  "setting humanReviewed to true",
] as const;

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

function statusForSourceLookup(
  item: ConstructorMatrixSourceLookupIntake,
): ConstructorMatrixDeskSourceReviewStatus {
  if (item.extractionReadiness === "needs_manual_verification") {
    return "manual_verification_still_required";
  }

  if (item.extractionReadiness === "needs_full_text_or_abstract") {
    return item.reliability === "official_policy" || item.reliability === "official_federation_rule"
      ? "policy_text_still_required"
      : "full_text_still_required";
  }

  if (item.extractionReadiness === "not_ready") {
    return "not_ready_for_claim_extraction";
  }

  if (item.lookupStatus.startsWith("verified_")) {
    return "desk_verified_identity";
  }

  return "desk_review_limited";
}

function useForSourceLookup(
  item: ConstructorMatrixSourceLookupIntake,
): ConstructorMatrixDeskSourceReviewUse {
  if (item.extractionReadiness === "needs_manual_verification") {
    return "manual_verification_required";
  }

  if (item.extractionReadiness === "not_ready") {
    return "do_not_use_for_claims_yet";
  }

  if (item.usePermission === "evidence_claim_extraction_candidate") {
    return "claim_candidate_support_only";
  }

  if (
    item.usePermission === "medical_review_context_only" ||
    item.usePermission === "coach_review_context_only" ||
    item.usePermission === "data_quality_review_context_only"
  ) {
    return "review_packet_support_only";
  }

  return "source_identity_only";
}

function stillMissingForSourceLookup(
  item: ConstructorMatrixSourceLookupIntake,
): readonly string[] {
  if (item.extractionReadiness === "needs_manual_verification") {
    return [
      "manual source text verification",
      "reviewer confirmation of source scope",
      "real human review result",
    ];
  }

  if (item.extractionReadiness === "needs_full_text_or_abstract") {
    return [
      "full text or abstract review",
      "population and sport-transfer boundary check",
      "real human review result",
    ];
  }

  if (item.extractionReadiness === "not_ready") {
    return [
      "source readiness decision",
      "reason no claim can be extracted",
      "real human review result",
    ];
  }

  return ["real human review result"];
}

function allowedNextActionsForSourceLookup(
  item: ConstructorMatrixSourceLookupIntake,
): readonly string[] {
  if (item.extractionReadiness === "needs_manual_verification") {
    return [
      "verify source text manually",
      "keep source identity in review packets only",
      "record real review decisions in a later stage",
    ];
  }

  if (item.extractionReadiness === "needs_full_text_or_abstract") {
    return [
      "review source text before final extraction",
      "draft cautious candidate-only context",
      "route candidate context to required review tracks",
    ];
  }

  return [
    "keep source as metadata",
    "route any future claim through review intake",
    "avoid runtime promotion",
  ];
}

function confirmedMetadataForSourceLookup(
  item: ConstructorMatrixSourceLookupIntake,
): readonly string[] {
  return [
    `title recorded: ${item.title}`,
    `source candidate: ${item.sourceCandidateId}`,
    `source URL recorded: ${item.sourceUrl ?? "not recorded"}`,
    `publisher or organization recorded: ${item.publisherOrOrganization ?? "not recorded"}`,
    `year recorded: ${item.year ?? "not recorded"}`,
    `DOI recorded: ${item.doi ?? "not recorded"}`,
    `PMID recorded: ${item.pmid ?? "not recorded"}`,
    `lookup status: ${item.lookupStatus}`,
    `reliability: ${item.reliability}`,
    `extraction readiness: ${item.extractionReadiness}`,
  ];
}

function deskSourceReviewForLookup(
  item: ConstructorMatrixSourceLookupIntake,
): ConstructorMatrixDeskSourceReview {
  const requiresManualVerification =
    item.extractionReadiness === "needs_manual_verification";

  return {
    id: `desk_source_review_${item.id}`,
    sourceLookupIntakeIds: [item.id as ConstructorMatrixSourceLookupIntakeId],
    sourceCandidateIds: [item.sourceCandidateId],
    sourceExpansionBacklogIds: item.sourceExpansionBacklogIds,
    title: `Desk source review: ${item.title}`,
    status: statusForSourceLookup(item),
    deskReviewUse: useForSourceLookup(item),
    checkedAs: [
      item.lookupStatus,
      item.reliability,
      item.lookupMethod,
      item.usePermission,
      item.extractionReadiness,
    ],
    confirmedMetadata: confirmedMetadataForSourceLookup(item),
    stillMissing: stillMissingForSourceLookup(item),
    limitations: [
      ...item.limitations,
      "Desk review is not human review",
      "Desk review does not approve a final evidence claim",
      "Desk review does not change source readiness",
    ],
    allowedNextActions: allowedNextActionsForSourceLookup(item),
    prohibitedActions: [
      ...COMMON_PROHIBITED_ACTIONS,
      ...item.forbiddenRuntimeUseNow,
      ...(requiresManualVerification
        ? ["no claim extraction before manual verification"]
        : ["final claim extraction before source text review"]),
    ],
    humanReviewed: false,
    runtimeChangeAllowedNow: false,
  };
}

export const CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEWS =
  CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE.map(
    deskSourceReviewForLookup,
  ) satisfies readonly ConstructorMatrixDeskSourceReview[];

export type ConstructorMatrixDeskSourceReviewId =
  (typeof CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEWS)[number]["id"];

export const CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEW_IDS =
  CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEWS.map((item) => item.id);

const CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEW_ID_SET = new Set<string>(
  CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEW_IDS,
);

const CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEW_LOOKUP = new Map<
  string,
  ConstructorMatrixDeskSourceReview
>(
  CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEWS.map((item) => [item.id, item]),
);

export function listConstructorMatrixDeskSourceReviewIds():
  ConstructorMatrixDeskSourceReviewId[] {
  return [...CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEW_IDS];
}

export function getConstructorMatrixDeskSourceReview(
  id: string,
): ConstructorMatrixDeskSourceReview | null {
  return CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEW_LOOKUP.get(id) ?? null;
}

export function validateConstructorMatrixDeskSourceReviewIds(
  ids: readonly string[],
): { ok: boolean; missing: string[] } {
  const missing = ids.filter((id) => !CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEW_ID_SET.has(id));

  return {
    ok: missing.length === 0,
    missing,
  };
}

export function buildConstructorMatrixDeskSourceReviewSummary():
  ConstructorMatrixDeskSourceReviewSummary {
  const coveredSourceLookupIds = new Set(
    CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEWS.flatMap((item) => item.sourceLookupIntakeIds),
  );

  return {
    deskSourceReviewCount: CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEWS.length,
    deskSourceReviewIds: listConstructorMatrixDeskSourceReviewIds(),
    deskSourceReviewsByStatus: countBy(
      DESK_SOURCE_REVIEW_STATUSES,
      CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEWS.map((item) => item.status),
    ),
    deskSourceReviewsByUse: countBy(
      DESK_SOURCE_REVIEW_USES,
      CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEWS.map((item) => item.deskReviewUse),
    ),
    sourceLookupRecordsCoveredCount: coveredSourceLookupIds.size,
    sourceLookupRecordCount: CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE.length,
    manualVerificationStillRequiredCount: CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEWS.filter(
      (item) => item.status === "manual_verification_still_required",
    ).length,
    fullTextStillRequiredCount: CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEWS.filter(
      (item) => item.status === "full_text_still_required",
    ).length,
    policyTextStillRequiredCount: CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEWS.filter(
      (item) => item.status === "policy_text_still_required",
    ).length,
    humanReviewedCount: CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEWS.filter(
      (item) => item.humanReviewed,
    ).length,
    runtimeChangeAllowedNowCount: CONSTRUCTOR_MATRIX_DESK_SOURCE_REVIEWS.filter(
      (item) => item.runtimeChangeAllowedNow,
    ).length,
  };
}
