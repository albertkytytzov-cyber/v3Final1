import {
  CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS,
  type ConstructorMatrixAiEvidenceClaim,
  type ConstructorMatrixAiEvidenceClaimId,
} from "./constructor-matrix-ai-evidence-claims";

export type ConstructorMatrixAiSafetyClassification =
  | "safe_for_docs"
  | "safe_for_review_export"
  | "safe_for_soft_warning"
  | "safe_for_plan_structure"
  | "fallback_only"
  | "do_not_automate"
  | "human_review_required"
  | "medical_review_required"
  | "coach_review_required"
  | "data_quality_review_required";

export type ConstructorMatrixAiSafetyRuntimeUseNow =
  | "none"
  | "docs_only"
  | "review_export_only"
  | "soft_warning_candidate"
  | "plan_structure_hint_candidate"
  | "fallback_only";

export type ConstructorMatrixAiSafetyClassificationEntry = {
  id: string;
  aiEvidenceClaimId: ConstructorMatrixAiEvidenceClaimId;
  claimCandidateId: string;
  title: string;
  riskAreas: readonly string[];
  sourceCandidateIds: readonly string[];
  evidenceDependencyIds: readonly string[];
  dataDependencyIds: readonly string[];
  thresholdCandidateIds: readonly string[];
  reviewDecisionIds: readonly string[];
  classifications: readonly ConstructorMatrixAiSafetyClassification[];
  primaryClassification: ConstructorMatrixAiSafetyClassification;
  allowedRuntimeUseNow: ConstructorMatrixAiSafetyRuntimeUseNow;
  forbiddenRuntimeUseNow: readonly string[];
  rationale: string;
  limitations: readonly string[];
  aiDeskReviewed: true;
  aiDeskReviewedAt: "2026-06-14T12:00:00.000Z";
  aiDeskReviewModel: "Codex AI desk review";
  humanReviewed: false;
  runtimeChangeAllowedNow: false;
};

export interface ConstructorMatrixAiSafetyClassificationSummary {
  safetyClassificationCount: number;
  safetyClassificationIds: readonly ConstructorMatrixAiSafetyClassificationId[];
  aiEvidenceClaimCoveredCount: number;
  aiEvidenceClaimCount: number;
  byPrimaryClassification: Readonly<Record<ConstructorMatrixAiSafetyClassification, number>>;
  byClassification: Readonly<Record<ConstructorMatrixAiSafetyClassification, number>>;
  softWarningCandidateCount: number;
  planStructureHintCandidateCount: number;
  fallbackOnlyCount: number;
  doNotAutomateCount: number;
  medicalReviewRequiredCount: number;
  coachReviewRequiredCount: number;
  dataQualityReviewRequiredCount: number;
  highRiskBlockedCount: number;
  humanReviewed: false;
  runtimeChangeAllowedNow: false;
}

const SAFETY_CLASSIFICATIONS = [
  "safe_for_docs",
  "safe_for_review_export",
  "safe_for_soft_warning",
  "safe_for_plan_structure",
  "fallback_only",
  "do_not_automate",
  "human_review_required",
  "medical_review_required",
  "coach_review_required",
  "data_quality_review_required",
] as const satisfies readonly ConstructorMatrixAiSafetyClassification[];

const HIGH_RISK_MEDICAL_AREAS = new Set([
  "weight_cut",
  "hydration",
  "pain",
  "injury",
  "injury_pain",
  "female_context",
  "RED-S",
  "bfr_kaatsu",
]);

const YOUTH_AREAS = new Set(["youth_context"]);

const DATA_QUALITY_AREAS = new Set([
  "wearable_data",
  "sleep",
  "rhr",
  "hrv",
  "readiness",
]);

const COACH_OR_SPORT_AREAS = new Set([
  "taper",
  "contact_load",
  "lmv",
  "competition_context",
  "travel_fatigue",
]);

const NO_AUTOMATION_AREAS = new Set([
  "weight_cut",
  "hydration",
  "pain",
  "injury",
  "injury_pain",
  "female_context",
  "RED-S",
  "bfr_kaatsu",
]);

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

function hasAnyArea(
  claim: ConstructorMatrixAiEvidenceClaim,
  areas: ReadonlySet<string>,
): boolean {
  return claim.methodOrRiskArea.some((area) => areas.has(area));
}

function classificationsFor(
  claim: ConstructorMatrixAiEvidenceClaim,
): ConstructorMatrixAiSafetyClassification[] {
  const classifications: ConstructorMatrixAiSafetyClassification[] = [
    "safe_for_review_export",
    "human_review_required",
  ];

  if (claim.allowedUseNow === "docs_only") {
    classifications.push("safe_for_docs");
  }

  if (claim.allowedUseNow === "soft_warning_candidate") {
    classifications.push("safe_for_docs", "safe_for_soft_warning");
  }

  if (claim.allowedUseNow === "plan_structure_hint_candidate") {
    classifications.push("safe_for_docs", "safe_for_plan_structure");
  }

  if (claim.status !== "ai_extracted_conservative_claim") {
    classifications.push("fallback_only");
  }

  if (hasAnyArea(claim, HIGH_RISK_MEDICAL_AREAS)) {
    classifications.push("medical_review_required");
  }

  if (hasAnyArea(claim, YOUTH_AREAS)) {
    classifications.push("coach_review_required", "medical_review_required");
  }

  if (hasAnyArea(claim, DATA_QUALITY_AREAS)) {
    classifications.push("data_quality_review_required");
  }

  if (hasAnyArea(claim, COACH_OR_SPORT_AREAS)) {
    classifications.push("coach_review_required");
  }

  if (
    hasAnyArea(claim, NO_AUTOMATION_AREAS) ||
    claim.status === "do_not_automate"
  ) {
    classifications.push("do_not_automate");
  }

  return uniqueSorted(classifications);
}

function primaryClassificationFor(
  classifications: readonly ConstructorMatrixAiSafetyClassification[],
): ConstructorMatrixAiSafetyClassification {
  const priority: readonly ConstructorMatrixAiSafetyClassification[] = [
    "do_not_automate",
    "medical_review_required",
    "data_quality_review_required",
    "coach_review_required",
    "human_review_required",
    "fallback_only",
    "safe_for_plan_structure",
    "safe_for_soft_warning",
    "safe_for_review_export",
    "safe_for_docs",
  ];

  return priority.find((item) => classifications.includes(item)) ?? "human_review_required";
}

function allowedRuntimeUseNowFor(
  claim: ConstructorMatrixAiEvidenceClaim,
  classifications: readonly ConstructorMatrixAiSafetyClassification[],
): ConstructorMatrixAiSafetyRuntimeUseNow {
  if (
    classifications.includes("do_not_automate") ||
    classifications.includes("medical_review_required")
  ) {
    return "review_export_only";
  }

  if (classifications.includes("data_quality_review_required")) {
    return "soft_warning_candidate";
  }

  if (classifications.includes("safe_for_plan_structure")) {
    return "plan_structure_hint_candidate";
  }

  if (classifications.includes("safe_for_soft_warning")) {
    return "soft_warning_candidate";
  }

  if (claim.allowedUseNow === "docs_only") {
    return "docs_only";
  }

  return "review_export_only";
}

function rationaleFor(
  claim: ConstructorMatrixAiEvidenceClaim,
  classifications: readonly ConstructorMatrixAiSafetyClassification[],
): string {
  if (classifications.includes("do_not_automate")) {
    return "High-risk or clinical context remains blocked for automation; AI desk review can only route it to review export or fallback handling.";
  }

  if (classifications.includes("data_quality_review_required")) {
    return "Wearable or readiness context may support only cautious warning candidates until source text and data-quality review are complete.";
  }

  if (classifications.includes("coach_review_required")) {
    return "Training-structure context may support only conservative plan-structure candidates until coach or sport-science review is complete.";
  }

  return "AI desk review keeps this item as documentation or review-export metadata until source text and human review requirements are resolved.";
}

function safetyClassificationFromClaim(
  claim: ConstructorMatrixAiEvidenceClaim,
): ConstructorMatrixAiSafetyClassificationEntry {
  const classifications = classificationsFor(claim);

  return {
    id: `ai_safety_${claim.claimCandidateId}`,
    aiEvidenceClaimId: claim.id as ConstructorMatrixAiEvidenceClaimId,
    claimCandidateId: claim.claimCandidateId,
    title: `AI safety classification: ${claim.title}`,
    riskAreas: claim.methodOrRiskArea,
    sourceCandidateIds: claim.sourceCandidateIds,
    evidenceDependencyIds: claim.evidenceDependencyIds,
    dataDependencyIds: claim.dataDependencyIds,
    thresholdCandidateIds: claim.thresholdCandidateIds,
    reviewDecisionIds: claim.reviewDecisionIds,
    classifications,
    primaryClassification: primaryClassificationFor(classifications),
    allowedRuntimeUseNow: allowedRuntimeUseNowFor(claim, classifications),
    forbiddenRuntimeUseNow: uniqueSorted(claim.forbiddenRuntimeUseNow),
    rationale: rationaleFor(claim, classifications),
    limitations: uniqueSorted([
      ...claim.limitations,
      ...claim.aiDeskReviewLimitations,
      "AI safety classification is not human, coach, or medical approval",
      "No numeric threshold or runtime hard gate is approved",
      "Runtime behavior remains unchanged by this metadata registry",
    ]),
    aiDeskReviewed: true,
    aiDeskReviewedAt: "2026-06-14T12:00:00.000Z",
    aiDeskReviewModel: "Codex AI desk review",
    humanReviewed: false,
    runtimeChangeAllowedNow: false,
  };
}

export const CONSTRUCTOR_MATRIX_AI_SAFETY_CLASSIFICATIONS =
  CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS.map(
    safetyClassificationFromClaim,
  ) satisfies readonly ConstructorMatrixAiSafetyClassificationEntry[];

export type ConstructorMatrixAiSafetyClassificationId =
  (typeof CONSTRUCTOR_MATRIX_AI_SAFETY_CLASSIFICATIONS)[number]["id"];

export const CONSTRUCTOR_MATRIX_AI_SAFETY_CLASSIFICATION_IDS =
  CONSTRUCTOR_MATRIX_AI_SAFETY_CLASSIFICATIONS.map((item) => item.id);

export function listConstructorMatrixAiSafetyClassificationIds():
  ConstructorMatrixAiSafetyClassificationId[] {
  return [
    ...CONSTRUCTOR_MATRIX_AI_SAFETY_CLASSIFICATION_IDS,
  ] as ConstructorMatrixAiSafetyClassificationId[];
}

export function getConstructorMatrixAiSafetyClassification(
  id: string,
): ConstructorMatrixAiSafetyClassificationEntry | null {
  return (
    CONSTRUCTOR_MATRIX_AI_SAFETY_CLASSIFICATIONS.find((item) => item.id === id) ??
    null
  );
}

export function validateConstructorMatrixAiSafetyClassificationIds(
  ids: readonly string[],
): { ok: boolean; missing: string[] } {
  const knownIds = new Set<string>(CONSTRUCTOR_MATRIX_AI_SAFETY_CLASSIFICATION_IDS);
  const missing = ids.filter((id) => !knownIds.has(id));

  return { ok: missing.length === 0, missing };
}

export function buildConstructorMatrixAiSafetyClassificationSummary():
  ConstructorMatrixAiSafetyClassificationSummary {
  const primaryClassifications = CONSTRUCTOR_MATRIX_AI_SAFETY_CLASSIFICATIONS.map(
    (item) => item.primaryClassification,
  );
  const allClassifications = CONSTRUCTOR_MATRIX_AI_SAFETY_CLASSIFICATIONS.flatMap(
    (item) => item.classifications,
  );

  return {
    safetyClassificationCount: CONSTRUCTOR_MATRIX_AI_SAFETY_CLASSIFICATIONS.length,
    safetyClassificationIds: listConstructorMatrixAiSafetyClassificationIds(),
    aiEvidenceClaimCoveredCount: new Set(
      CONSTRUCTOR_MATRIX_AI_SAFETY_CLASSIFICATIONS.map((item) => item.aiEvidenceClaimId),
    ).size,
    aiEvidenceClaimCount: CONSTRUCTOR_MATRIX_AI_EVIDENCE_CLAIMS.length,
    byPrimaryClassification: countBy(SAFETY_CLASSIFICATIONS, primaryClassifications),
    byClassification: countBy(SAFETY_CLASSIFICATIONS, allClassifications),
    softWarningCandidateCount: CONSTRUCTOR_MATRIX_AI_SAFETY_CLASSIFICATIONS.filter(
      (item) => item.classifications.includes("safe_for_soft_warning"),
    ).length,
    planStructureHintCandidateCount: CONSTRUCTOR_MATRIX_AI_SAFETY_CLASSIFICATIONS.filter(
      (item) => item.classifications.includes("safe_for_plan_structure"),
    ).length,
    fallbackOnlyCount: CONSTRUCTOR_MATRIX_AI_SAFETY_CLASSIFICATIONS.filter((item) =>
      item.classifications.includes("fallback_only"),
    ).length,
    doNotAutomateCount: CONSTRUCTOR_MATRIX_AI_SAFETY_CLASSIFICATIONS.filter((item) =>
      item.classifications.includes("do_not_automate"),
    ).length,
    medicalReviewRequiredCount: CONSTRUCTOR_MATRIX_AI_SAFETY_CLASSIFICATIONS.filter((item) =>
      item.classifications.includes("medical_review_required"),
    ).length,
    coachReviewRequiredCount: CONSTRUCTOR_MATRIX_AI_SAFETY_CLASSIFICATIONS.filter((item) =>
      item.classifications.includes("coach_review_required"),
    ).length,
    dataQualityReviewRequiredCount: CONSTRUCTOR_MATRIX_AI_SAFETY_CLASSIFICATIONS.filter(
      (item) => item.classifications.includes("data_quality_review_required"),
    ).length,
    highRiskBlockedCount: CONSTRUCTOR_MATRIX_AI_SAFETY_CLASSIFICATIONS.filter((item) =>
      item.classifications.includes("do_not_automate"),
    ).length,
    humanReviewed: false,
    runtimeChangeAllowedNow: false,
  };
}
