import {
  CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES,
  type ConstructorMatrixDataDependency,
  type ConstructorMatrixDataDependencyArea,
  type ConstructorMatrixDataDependencyId,
} from "./constructor-matrix-data-dependencies";
import {
  buildConstructorMatrixDeskSourceReviewSummary,
  type ConstructorMatrixDeskSourceReviewSummary,
} from "./constructor-matrix-desk-source-review";
import {
  CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY,
  type ConstructorMatrixEvidenceDependency,
  type ConstructorMatrixEvidenceDependencyId,
  type ConstructorMatrixEvidenceRiskArea,
} from "./constructor-matrix-evidence";
import { buildConstructorMatrixExerciseEvidenceMapSummary } from "./constructor-matrix-exercise-evidence-map";
import { buildConstructorMatrixExerciseSourceRequirementSummary } from "./constructor-matrix-exercise-source-requirements";
import {
  buildConstructorMatrixEvidenceClaimExtractionSummary,
  type ConstructorMatrixEvidenceClaimExtractionSummary,
} from "./constructor-matrix-evidence-claims";
import { buildConstructorMatrixFamilyAllowedUseSummary } from "./constructor-matrix-family-allowed-use";
import { buildConstructorMatrixFamilySourceReviewSummary } from "./constructor-matrix-family-source-review";
import {
  buildConstructorMatrixClaimCandidateReviewExportSummary,
  type ConstructorMatrixClaimCandidateReviewExportSummary,
} from "./constructor-matrix-evidence-claim-candidate-review-export";
import {
  buildConstructorMatrixEvidenceClaimCandidateSummary,
  type ConstructorMatrixEvidenceClaimCandidateSummary,
} from "./constructor-matrix-evidence-claim-candidates";
import {
  buildConstructorMatrixEvidenceClaimReviewIntakeSummary,
  type ConstructorMatrixEvidenceClaimReviewIntakeSummary,
} from "./constructor-matrix-evidence-claim-review-intake";
import {
  buildConstructorMatrixReviewDecisionLedgerSummary,
  getConstructorMatrixReviewDecisionsForSubject,
  type ConstructorMatrixReviewDecisionLedgerSummary,
  type ConstructorMatrixReviewDecisionStatus,
  type ConstructorMatrixReviewSubjectType,
} from "./constructor-matrix-review-decision-ledger";
import {
  buildConstructorMatrixReviewIntakeExportSummary,
  type ConstructorMatrixReviewIntakeExportSummary,
} from "./constructor-matrix-review-intake-export";
import { buildConstructorMatrixP0FamilyEvidenceDossierSummary } from "./constructor-matrix-p0-family-evidence-dossiers";
import { buildConstructorMatrixP1FamilyEvidenceDossierSummary } from "./constructor-matrix-p1-family-evidence-dossiers";
import {
  buildConstructorMatrixSourceExpansionBacklogSummary,
  type ConstructorMatrixSourceExpansionBacklogSummary,
} from "./constructor-matrix-source-expansion-backlog";
import {
  buildConstructorMatrixSourceAcquisitionSummary,
  type ConstructorMatrixSourceAcquisitionSummary,
} from "./constructor-matrix-source-candidates";
import {
  buildConstructorMatrixSourceLookupIntakeSummary,
  type ConstructorMatrixSourceLookupIntakeSummary,
} from "./constructor-matrix-source-lookup-intake";
import {
  CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES,
  type ConstructorMatrixThresholdCandidate,
  type ConstructorMatrixThresholdCandidateArea,
  type ConstructorMatrixThresholdCandidateId,
} from "./constructor-matrix-threshold-candidates";

export type ConstructorMatrixReviewPackageReviewer =
  | "coach"
  | "medical"
  | "data_quality";

export type ConstructorMatrixReviewPackageLayer =
  | "evidence_dependency"
  | "data_dependency"
  | "threshold_candidate";

export type ConstructorMatrixExerciseEvidenceMapSummary = ReturnType<
  typeof buildConstructorMatrixExerciseEvidenceMapSummary
>;

export type ConstructorMatrixExerciseSourceRequirementSummary = ReturnType<
  typeof buildConstructorMatrixExerciseSourceRequirementSummary
>;

export type ConstructorMatrixFamilySourceReviewSummary = ReturnType<
  typeof buildConstructorMatrixFamilySourceReviewSummary
>;

export type ConstructorMatrixP0FamilyEvidenceDossierSummary = ReturnType<
  typeof buildConstructorMatrixP0FamilyEvidenceDossierSummary
>;

export type ConstructorMatrixP1FamilyEvidenceDossierSummary = ReturnType<
  typeof buildConstructorMatrixP1FamilyEvidenceDossierSummary
>;

export type ConstructorMatrixFamilyAllowedUseSummary = ReturnType<
  typeof buildConstructorMatrixFamilyAllowedUseSummary
>;

export interface ConstructorMatrixReviewPackageRef {
  layer: ConstructorMatrixReviewPackageLayer;
  id: string;
  title: string;
  areas: readonly string[];
  reason: string;
  linkedDecisionStatuses: readonly ConstructorMatrixReviewDecisionStatus[];
  humanReviewed: false;
}

export interface ConstructorMatrixReviewPackageReviewerQueue {
  reviewer: ConstructorMatrixReviewPackageReviewer;
  title: string;
  mandate: string;
  reviewQuestions: readonly string[];
  items: readonly ConstructorMatrixReviewPackageRef[];
}

export interface ConstructorMatrixReviewPackageEvidenceItem {
  id: ConstructorMatrixEvidenceDependencyId;
  title: string;
  level: ConstructorMatrixEvidenceDependency["level"];
  type: ConstructorMatrixEvidenceDependency["type"];
  sourceDoc: string;
  riskAreas: readonly ConstructorMatrixEvidenceRiskArea[];
  automationReadiness: ConstructorMatrixEvidenceDependency["automationReadiness"];
  reviewStatus: ConstructorMatrixEvidenceDependency["reviewStatus"];
  ruleNature: ConstructorMatrixEvidenceDependency["ruleNature"];
  limitations: readonly string[];
}

export interface ConstructorMatrixReviewPackageDataItem {
  id: ConstructorMatrixDataDependencyId;
  area: ConstructorMatrixDataDependencyArea;
  title: string;
  requiredFields: readonly string[];
  optionalFields: readonly string[];
  currentAvailability: ConstructorMatrixDataDependency["currentAvailability"];
  missingDataBehavior: ConstructorMatrixDataDependency["missingDataBehavior"];
  runtimeUseNow: ConstructorMatrixDataDependency["runtimeUseNow"];
  evidenceDependencyIds: readonly ConstructorMatrixEvidenceDependencyId[];
  limitations: readonly string[];
}

export interface ConstructorMatrixReviewPackageThresholdItem {
  id: ConstructorMatrixThresholdCandidateId;
  area: ConstructorMatrixThresholdCandidateArea;
  kind: ConstructorMatrixThresholdCandidate["kind"];
  title: string;
  whyNeeded: string;
  candidateStatement: string;
  dataDependencyIds: readonly ConstructorMatrixDataDependencyId[];
  evidenceDependencyIds: readonly ConstructorMatrixEvidenceDependencyId[];
  requiredFields: readonly string[];
  missingDataBehavior: ConstructorMatrixThresholdCandidate["missingDataBehavior"];
  proposedRuntimeUse: ConstructorMatrixThresholdCandidate["proposedRuntimeUse"];
  status: ConstructorMatrixThresholdCandidate["status"];
  reviewRequired: ConstructorMatrixThresholdCandidate["reviewRequired"];
  futureTargetLayers: ConstructorMatrixThresholdCandidate["futureTargetLayers"];
  fixtureImpact: ConstructorMatrixThresholdCandidate["fixtureImpact"];
  forbiddenRuntimeUseNow: ConstructorMatrixThresholdCandidate["forbiddenRuntimeUseNow"];
  implementationReadiness: ConstructorMatrixThresholdCandidate["implementationReadiness"];
  limitations: readonly string[];
}

export interface ConstructorMatrixReviewPackagePayload {
  generatedFrom: "matrix_evidence_data_threshold_review_package";
  generatedAt: string;
  scope: {
    layers: readonly ConstructorMatrixReviewPackageLayer[];
    purpose: string;
    runtimeBehaviorChanged: false;
    productionRouteChanged: false;
    rolloutGatesChanged: false;
    previewBehaviorChanged: false;
    legacyFallbackChanged: false;
    numericThresholdValuesAdded: false;
  };
  summary: {
    evidenceDependencyCount: number;
    dataDependencyCount: number;
    thresholdCandidateCount: number;
    evidenceRiskAreas: readonly ConstructorMatrixEvidenceRiskArea[];
    dataAreas: readonly ConstructorMatrixDataDependencyArea[];
    thresholdAreas: readonly ConstructorMatrixThresholdCandidateArea[];
    requiredThresholdAreasCovered: readonly ConstructorMatrixThresholdCandidateArea[];
    requiredThresholdAreasMissing: readonly ConstructorMatrixThresholdCandidateArea[];
  };
  reviewDecisionLedger: ConstructorMatrixReviewDecisionLedgerSummary;
  sourceExpansionBacklog: ConstructorMatrixSourceExpansionBacklogSummary;
  sourceAcquisition: ConstructorMatrixSourceAcquisitionSummary;
  sourceLookupIntake: ConstructorMatrixSourceLookupIntakeSummary;
  deskSourceReview: ConstructorMatrixDeskSourceReviewSummary;
  evidenceClaimCandidates: ConstructorMatrixEvidenceClaimCandidateSummary;
  claimCandidateReviewExport: ConstructorMatrixClaimCandidateReviewExportSummary;
  evidenceClaims: ConstructorMatrixEvidenceClaimExtractionSummary;
  evidenceClaimReviewIntake: ConstructorMatrixEvidenceClaimReviewIntakeSummary;
  reviewIntakeExport: ConstructorMatrixReviewIntakeExportSummary;
  exerciseEvidenceMap: ConstructorMatrixExerciseEvidenceMapSummary;
  exerciseSourceRequirements: ConstructorMatrixExerciseSourceRequirementSummary;
  familySourceReview: ConstructorMatrixFamilySourceReviewSummary;
  p0FamilyEvidenceDossiers: ConstructorMatrixP0FamilyEvidenceDossierSummary;
  p1FamilyEvidenceDossiers: ConstructorMatrixP1FamilyEvidenceDossierSummary;
  familyAllowedUse: ConstructorMatrixFamilyAllowedUseSummary;
  reviewerQueues: readonly ConstructorMatrixReviewPackageReviewerQueue[];
  evidenceDependencies: readonly ConstructorMatrixReviewPackageEvidenceItem[];
  dataDependencies: readonly ConstructorMatrixReviewPackageDataItem[];
  thresholdCandidates: readonly ConstructorMatrixReviewPackageThresholdItem[];
  guardrails: {
    thresholdCandidatesCandidateOnly: true;
    thresholdCandidatesRuntimeOnlyMetadata: true;
    dataDependenciesRuntimeOnlyMetadata: true;
    evidenceDependenciesReviewedAsTraceability: true;
    noRuntimeImportsExpected: true;
  };
}

export interface ConstructorMatrixLayerReviewPackage {
  payload: ConstructorMatrixReviewPackagePayload;
  markdown: string;
  json: string;
}

export const CONSTRUCTOR_MATRIX_REVIEW_PACKAGE_REQUIRED_THRESHOLD_AREAS = [
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
] as const satisfies readonly ConstructorMatrixThresholdCandidateArea[];

const REVIEWER_INFO = {
  coach: {
    title: "Coach Review",
    mandate:
      "Validate coaching fit, wrestling specificity, taper intent, contact-load interpretation and whether a candidate belongs in review notes only.",
    reviewQuestions: [
      "Does this candidate match real coaching decisions in wrestling practice?",
      "Which inputs need coach confirmation before a recommendation is shown?",
      "Should this stay documentation-only, review-export-only or become a future warning candidate?",
    ],
  },
  medical: {
    title: "Medical Review",
    mandate:
      "Validate safety-sensitive areas such as weight cut, hydration, RED-S context, injury return and youth athlete protection.",
    reviewQuestions: [
      "Could this candidate be interpreted as diagnosis or medical clearance?",
      "Which cases must remain blocked for automation?",
      "Which additional medical context is mandatory before coach-facing language is allowed?",
    ],
  },
  data_quality: {
    title: "Data-Quality Review",
    mandate:
      "Validate data availability, wearable confidence, missing-data behavior and whether fields are typed enough for future pilot review.",
    reviewQuestions: [
      "Are required fields typed and available with enough confidence?",
      "Does missing data fail soft, require confirmation or stay advisory?",
      "Can this signal be audited without athlete identity or raw production ids?",
    ],
  },
} as const satisfies Record<
  ConstructorMatrixReviewPackageReviewer,
  {
    title: string;
    mandate: string;
    reviewQuestions: readonly string[];
  }
>;

const COACH_EVIDENCE_RISK_AREAS = new Set<ConstructorMatrixEvidenceRiskArea>([
  "phase",
  "week_type",
  "day_type",
  "session_slot",
  "block_eligibility",
  "volume",
  "risk_check",
  "taper",
  "contact_load",
  "competition_model",
  "lmv",
  "travel",
  "competition_day",
  "post_competition",
  "weight_cut",
]);

const MEDICAL_EVIDENCE_RISK_AREAS = new Set<ConstructorMatrixEvidenceRiskArea>([
  "weight_cut",
  "hydration",
  "weigh_in",
  "injury_pain",
  "female_context",
  "youth_context",
  "bfr_kaatsu",
]);

const DATA_QUALITY_EVIDENCE_RISK_AREAS = new Set<ConstructorMatrixEvidenceRiskArea>([
  "readiness",
  "wearable_data",
  "risk_check",
  "save_dry_run",
  "rollout",
]);

const MEDICAL_THRESHOLD_AREAS = new Set<ConstructorMatrixThresholdCandidateArea>([
  "weight_cut",
  "hydration",
  "pain",
  "injury",
  "female_context",
  "youth_context",
]);

const DATA_QUALITY_THRESHOLD_AREAS = new Set<ConstructorMatrixThresholdCandidateArea>([
  "readiness",
  "wearable_data",
  "sleep",
  "rhr",
  "hrv",
]);

const MEDICAL_DATA_AREAS = new Set<ConstructorMatrixDataDependencyArea>([
  "weight_cut",
  "hydration",
  "pain",
  "injury",
  "female_context",
  "youth_context",
]);

function uniqueSorted<T extends string>(items: readonly T[]): T[] {
  return Array.from(new Set(items)).sort();
}

function intersects<T>(items: readonly T[], set: Set<T>) {
  return items.some((item) => set.has(item));
}

function dataAreasForThreshold(candidate: ConstructorMatrixThresholdCandidate) {
  const areas: ConstructorMatrixDataDependencyArea[] = [];

  for (const id of candidate.dataDependencyIds) {
    const area = CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES.find((item) => item.id === id)?.area;
    if (area) {
      areas.push(area);
    }
  }

  return areas;
}

function subjectTypeForLayer(
  layer: ConstructorMatrixReviewPackageLayer,
): ConstructorMatrixReviewSubjectType {
  return layer;
}

function withLedgerDecisionMetadata(
  ref: Omit<ConstructorMatrixReviewPackageRef, "linkedDecisionStatuses" | "humanReviewed">,
): ConstructorMatrixReviewPackageRef {
  const decisions = getConstructorMatrixReviewDecisionsForSubject(
    subjectTypeForLayer(ref.layer),
    ref.id,
  );

  return {
    ...ref,
    linkedDecisionStatuses: uniqueSorted(decisions.map((item) => item.status)),
    humanReviewed: false,
  };
}

function reviewersForEvidence(
  item: ConstructorMatrixEvidenceDependency,
): ConstructorMatrixReviewPackageReviewer[] {
  const reviewers = new Set<ConstructorMatrixReviewPackageReviewer>();

  if (
    item.automationReadiness === "coach_review_required" ||
    item.reviewStatus === "coach_review_required" ||
    item.ruleNature === "coaching_heuristic" ||
    item.ruleNature === "internal_case_pattern" ||
    intersects(item.riskAreas, COACH_EVIDENCE_RISK_AREAS)
  ) {
    reviewers.add("coach");
  }

  if (
    item.automationReadiness === "medical_review_required" ||
    item.reviewStatus === "medical_review_required" ||
    intersects(item.riskAreas, MEDICAL_EVIDENCE_RISK_AREAS)
  ) {
    reviewers.add("medical");
  }

  if (
    item.automationReadiness === "evidence_only" ||
    item.reviewStatus === "audit_only" ||
    item.ruleNature === "gap_marker" ||
    intersects(item.riskAreas, DATA_QUALITY_EVIDENCE_RISK_AREAS)
  ) {
    reviewers.add("data_quality");
  }

  if (reviewers.size === 0) {
    reviewers.add("coach");
  }

  return Array.from(reviewers);
}

function reviewersForData(
  item: ConstructorMatrixDataDependency,
): ConstructorMatrixReviewPackageReviewer[] {
  const reviewers = new Set<ConstructorMatrixReviewPackageReviewer>(["data_quality"]);

  if (
    item.missingDataBehavior === "require_coach_confirmation" ||
    item.missingDataBehavior === "use_low_risk_replacement" ||
    item.area === "contact_load" ||
    item.area === "lmv" ||
    item.area === "taper" ||
    item.area === "competition_context" ||
    item.area === "travel_fatigue"
  ) {
    reviewers.add("coach");
  }

  if (
    item.missingDataBehavior === "require_medical_confirmation" ||
    MEDICAL_DATA_AREAS.has(item.area)
  ) {
    reviewers.add("medical");
  }

  return Array.from(reviewers);
}

function reviewersForThreshold(
  item: ConstructorMatrixThresholdCandidate,
): ConstructorMatrixReviewPackageReviewer[] {
  const reviewers = new Set<ConstructorMatrixReviewPackageReviewer>();

  if (
    item.reviewRequired.includes("coach_review") ||
    item.reviewRequired.includes("sport_science_review")
  ) {
    reviewers.add("coach");
  }

  if (item.reviewRequired.includes("medical_review") || MEDICAL_THRESHOLD_AREAS.has(item.area)) {
    reviewers.add("medical");
  }

  if (
    item.reviewRequired.includes("data_quality_review") ||
    item.reviewRequired.includes("product_safety_review") ||
    DATA_QUALITY_THRESHOLD_AREAS.has(item.area)
  ) {
    reviewers.add("data_quality");
  }

  if (reviewers.size === 0) {
    reviewers.add("coach");
  }

  return Array.from(reviewers);
}

function evidenceReviewRef(item: ConstructorMatrixEvidenceDependency): ConstructorMatrixReviewPackageRef {
  return withLedgerDecisionMetadata({
    layer: "evidence_dependency",
    id: item.id,
    title: item.title,
    areas: item.riskAreas,
    reason: `${item.reviewStatus} / ${item.automationReadiness}`,
  });
}

function dataReviewRef(item: ConstructorMatrixDataDependency): ConstructorMatrixReviewPackageRef {
  return withLedgerDecisionMetadata({
    layer: "data_dependency",
    id: item.id,
    title: item.title,
    areas: [item.area],
    reason: `${item.currentAvailability} / ${item.missingDataBehavior}`,
  });
}

function thresholdReviewRef(item: ConstructorMatrixThresholdCandidate): ConstructorMatrixReviewPackageRef {
  return withLedgerDecisionMetadata({
    layer: "threshold_candidate",
    id: item.id,
    title: item.title,
    areas: [item.area, ...dataAreasForThreshold(item)],
    reason: `${item.status} / ${item.proposedRuntimeUse}`,
  });
}

function buildReviewerQueues(): ConstructorMatrixReviewPackageReviewerQueue[] {
  const queues = new Map<ConstructorMatrixReviewPackageReviewer, ConstructorMatrixReviewPackageRef[]>(
    (Object.keys(REVIEWER_INFO) as ConstructorMatrixReviewPackageReviewer[]).map((reviewer) => [
      reviewer,
      [],
    ]),
  );

  for (const item of CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY) {
    for (const reviewer of reviewersForEvidence(item)) {
      queues.get(reviewer)?.push(evidenceReviewRef(item));
    }
  }

  for (const item of CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES) {
    for (const reviewer of reviewersForData(item)) {
      queues.get(reviewer)?.push(dataReviewRef(item));
    }
  }

  for (const item of CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES) {
    for (const reviewer of reviewersForThreshold(item)) {
      queues.get(reviewer)?.push(thresholdReviewRef(item));
    }
  }

  return (Object.keys(REVIEWER_INFO) as ConstructorMatrixReviewPackageReviewer[]).map((reviewer) => ({
    reviewer,
    title: REVIEWER_INFO[reviewer].title,
    mandate: REVIEWER_INFO[reviewer].mandate,
    reviewQuestions: REVIEWER_INFO[reviewer].reviewQuestions,
    items: queues.get(reviewer) ?? [],
  }));
}

function evidenceItem(item: ConstructorMatrixEvidenceDependency): ConstructorMatrixReviewPackageEvidenceItem {
  return {
    id: item.id as ConstructorMatrixEvidenceDependencyId,
    title: item.title,
    level: item.level,
    type: item.type,
    sourceDoc: item.sourceDoc,
    riskAreas: item.riskAreas,
    automationReadiness: item.automationReadiness,
    reviewStatus: item.reviewStatus,
    ruleNature: item.ruleNature,
    limitations: item.limitations,
  };
}

function dataItem(item: ConstructorMatrixDataDependency): ConstructorMatrixReviewPackageDataItem {
  return {
    id: item.id as ConstructorMatrixDataDependencyId,
    area: item.area,
    title: item.title,
    requiredFields: item.requiredFields,
    optionalFields: item.optionalFields,
    currentAvailability: item.currentAvailability,
    missingDataBehavior: item.missingDataBehavior,
    runtimeUseNow: item.runtimeUseNow,
    evidenceDependencyIds: item.supportsEvidenceDependencies,
    limitations: item.limitations,
  };
}

function thresholdItem(
  item: ConstructorMatrixThresholdCandidate,
): ConstructorMatrixReviewPackageThresholdItem {
  return {
    id: item.id as ConstructorMatrixThresholdCandidateId,
    area: item.area,
    kind: item.kind,
    title: item.title,
    whyNeeded: item.whyNeeded,
    candidateStatement: item.candidateStatement,
    dataDependencyIds: item.dataDependencyIds,
    evidenceDependencyIds: item.evidenceDependencyIds,
    requiredFields: item.requiredFields,
    missingDataBehavior: item.missingDataBehavior,
    proposedRuntimeUse: item.proposedRuntimeUse,
    status: item.status,
    reviewRequired: item.reviewRequired,
    futureTargetLayers: item.futureTargetLayers,
    fixtureImpact: item.fixtureImpact,
    forbiddenRuntimeUseNow: item.forbiddenRuntimeUseNow,
    implementationReadiness: item.implementationReadiness,
    limitations: item.limitations,
  };
}

function markdownList(items: readonly string[]) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- none";
}

function queueMarkdown(queue: ConstructorMatrixReviewPackageReviewerQueue) {
  return [
    `## ${queue.title}`,
    "",
    queue.mandate,
    "",
    "Review questions:",
    markdownList(queue.reviewQuestions),
    "",
    "Items:",
    markdownList(
      queue.items.map(
        (item) =>
          `${item.layer} · ${item.id} · ${item.reason} · ledger=${item.linkedDecisionStatuses.join(", ") || "none"} · humanReviewed=${item.humanReviewed}`,
      ),
    ),
  ].join("\n");
}

export function buildConstructorMatrixLayerReviewMarkdown(
  payload: ConstructorMatrixReviewPackagePayload,
) {
  return [
    "# Matrix Evidence/Data/Threshold Review Package",
    "",
    `Generated at: ${payload.generatedAt}`,
    "",
    "## Scope",
    payload.scope.purpose,
    "",
    "Guardrails:",
    markdownList([
      `runtimeBehaviorChanged=${payload.scope.runtimeBehaviorChanged}`,
      `productionRouteChanged=${payload.scope.productionRouteChanged}`,
      `rolloutGatesChanged=${payload.scope.rolloutGatesChanged}`,
      `previewBehaviorChanged=${payload.scope.previewBehaviorChanged}`,
      `legacyFallbackChanged=${payload.scope.legacyFallbackChanged}`,
      `numericThresholdValuesAdded=${payload.scope.numericThresholdValuesAdded}`,
    ]),
    "",
    "## Counts",
    markdownList([
      `Evidence dependencies: ${payload.summary.evidenceDependencyCount}`,
      `Data dependencies: ${payload.summary.dataDependencyCount}`,
      `Threshold candidates: ${payload.summary.thresholdCandidateCount}`,
      `Required threshold areas missing: ${payload.summary.requiredThresholdAreasMissing.join(", ") || "none"}`,
      `Review decision ledger entries: ${payload.reviewDecisionLedger.totalLedgerEntries}`,
      `Review decision threshold coverage: ${payload.reviewDecisionLedger.thresholdCandidatesCoveredCount}/${payload.reviewDecisionLedger.thresholdCandidateCount}`,
      `Review decision humanReviewed=${payload.reviewDecisionLedger.humanReviewed}`,
      `Source expansion backlog items: ${payload.sourceExpansionBacklog.sourceExpansionBacklogCount}`,
      `Source expansion unresolved P0: ${payload.sourceExpansionBacklog.unresolvedP0SourceExpansionIds.join(", ") || "none"}`,
      `Source acquisition candidates: ${payload.sourceAcquisition.totalCandidates}`,
      `Source acquisition P0 coverage: ${payload.sourceAcquisition.p0BacklogCoverage.coveredP0BacklogCount}/${payload.sourceAcquisition.p0BacklogCoverage.p0BacklogCount}`,
      `Source acquisition runtimeChangeAllowedNow=${payload.sourceAcquisition.runtimeChangeAllowedNow}`,
      `Source lookup intake records: ${payload.sourceLookupIntake.sourceLookupIntakeCount}`,
      `Source lookup verified sources: ${payload.sourceLookupIntake.verifiedSourceCount}`,
      `Source lookup manual needed: ${payload.sourceLookupIntake.manualLookupNeededCount}`,
      `Source lookup extraction ready: ${payload.sourceLookupIntake.extractionReadyCount}`,
      `Source lookup unavailable: ${payload.sourceLookupIntake.lookupUnavailableCount}`,
      `Source lookup runtimeChangeAllowedNow=${payload.sourceLookupIntake.sourceLookupRuntimeChangeAllowedNow}`,
      `Desk source reviews: ${payload.deskSourceReview.deskSourceReviewCount}`,
      `Desk source lookup coverage: ${payload.deskSourceReview.sourceLookupRecordsCoveredCount}/${payload.deskSourceReview.sourceLookupRecordCount}`,
      `Desk source manual verification still required: ${payload.deskSourceReview.manualVerificationStillRequiredCount}`,
      `Desk source full text still required: ${payload.deskSourceReview.fullTextStillRequiredCount}`,
      `Desk source policy text still required: ${payload.deskSourceReview.policyTextStillRequiredCount}`,
      `Desk source humanReviewed=${payload.deskSourceReview.humanReviewedCount}`,
      `Desk source runtime changes: ${payload.deskSourceReview.runtimeChangeAllowedNowCount}`,
      `Evidence claim candidates: ${payload.evidenceClaimCandidates.evidenceClaimCandidateCount}`,
      `Evidence claim candidate-only records: ${payload.evidenceClaimCandidates.candidateOnlyCount}`,
      `Evidence claim candidate human-reviewed records: ${payload.evidenceClaimCandidates.evidenceClaimCandidatesHumanReviewedCount}`,
      `Evidence claim candidate runtime changes: ${payload.evidenceClaimCandidates.evidenceClaimCandidatesRuntimeChangeAllowedNowCount}`,
      `Evidence claim candidate high-risk coverage: ${payload.evidenceClaimCandidates.highRiskAreasCovered.join(", ") || "none"}`,
      `Evidence claim candidate high-risk still blocked: ${payload.evidenceClaimCandidates.highRiskAreasStillBlocked.join(", ") || "none"}`,
      `Claim candidate review export items: ${payload.claimCandidateReviewExport.claimCandidateReviewExportItemCount}`,
      `Claim candidate review export runtime changes: ${payload.claimCandidateReviewExport.claimCandidateReviewExportRuntimeChangeAllowedNowCount}`,
      `Claim candidate review export human-reviewed records: ${payload.claimCandidateReviewExport.claimCandidateReviewExportHumanReviewedCount}`,
      `Claim candidate review export final evidence claims: ${payload.claimCandidateReviewExport.finalEvidenceClaimCount}`,
      `Evidence claims extracted: ${payload.evidenceClaims.evidenceClaimCount}`,
      `Evidence claim blockers: ${payload.evidenceClaims.evidenceClaimBlockerCount}`,
      `Evidence claim source lookup coverage: ${payload.evidenceClaims.sourceLookupRecordsCoveredCount}/${payload.evidenceClaims.sourceLookupRecordCount}`,
      `Evidence claim P0 source candidate coverage: ${payload.evidenceClaims.p0SourceCandidatesCoveredCount}/${payload.evidenceClaims.p0SourceCandidateCount}`,
      `Evidence claim P0 backlog coverage: ${payload.evidenceClaims.p0BacklogItemsCoveredCount}/${payload.evidenceClaims.p0BacklogItemCount}`,
      `Evidence claim runtimeChangeAllowedNow=${payload.evidenceClaims.runtimeChangeAllowedNow}`,
      `Evidence claim review intakes: ${payload.evidenceClaimReviewIntake.evidenceClaimReviewIntakeCount}`,
      `Evidence claim review blockers covered: ${payload.evidenceClaimReviewIntake.blockersCoveredCount}/${payload.evidenceClaimReviewIntake.evidenceClaimBlockerCount}`,
      `Evidence claim review manual verification: ${payload.evidenceClaimReviewIntake.manualVerificationIntakeCount}`,
      `Evidence claim review source text needed: ${payload.evidenceClaimReviewIntake.sourceTextNeededIntakeCount}`,
      `Evidence claim review human-review routing: ${payload.evidenceClaimReviewIntake.humanReviewBeforeClaimsIntakeCount}`,
      `Evidence claim review runtime changes: ${payload.evidenceClaimReviewIntake.runtimeChangeAllowedNowCount}`,
      `Review intake export items: ${payload.reviewIntakeExport.reviewIntakeExportItemCount}`,
      `Review intake export runtime changes: ${payload.reviewIntakeExport.reviewIntakeExportRuntimeChangeAllowedNowCount}`,
      `Exercise evidence families: ${payload.exerciseEvidenceMap.familyCount}`,
      `Exercise evidence coverage: ${payload.exerciseEvidenceMap.coveredExerciseCount}/${payload.exerciseEvidenceMap.exerciseCount}`,
      `Nutrition guidance evidence coverage: ${payload.exerciseEvidenceMap.coveredNutritionGuidanceCount}/${payload.exerciseEvidenceMap.nutritionGuidanceCount}`,
      `Weight-management evidence coverage: ${payload.exerciseEvidenceMap.coveredWeightManagementGuidanceCount}/${payload.exerciseEvidenceMap.weightManagementGuidanceCount}`,
      `Exercise source requirements: ${payload.exerciseSourceRequirements.sourceRequirementCount}`,
      `Exercise source P0 families: ${payload.exerciseSourceRequirements.p0FamilyIds.join(", ") || "none"}`,
      `Exercise source runtimePromotionAllowedNow=${payload.exerciseSourceRequirements.runtimePromotionAllowedNow}`,
      `Family source reviews: ${payload.familySourceReview.familySourceReviewCount}`,
      `Family source verified records: ${payload.familySourceReview.verifiedSourceCount}`,
      `Family source full-text/manual still needed: ${payload.familySourceReview.fullTextNeededCount}`,
      `Family source humanReviewed=${payload.familySourceReview.humanReviewed}`,
      `P0 family dossiers: ${payload.p0FamilyEvidenceDossiers.p0DossierCount}`,
      `P0 family blocked high-risk: ${payload.p0FamilyEvidenceDossiers.blockedHighRiskCount}`,
      `P1 family dossiers: ${payload.p1FamilyEvidenceDossiers.p1DossierCount}`,
      `P1 family coach-editable count: ${payload.p1FamilyEvidenceDossiers.coachEditableFamilyCount}`,
      `Family allowed-use decisions: ${payload.familyAllowedUse.familyAllowedUseDecisionCount}`,
      `Family allowed-use runtimePromotionAllowedNow=${payload.familyAllowedUse.runtimePromotionAllowedNow}`,
    ]),
    "",
    "## Required Threshold Areas Covered",
    markdownList(payload.summary.requiredThresholdAreasCovered),
    "",
    ...payload.reviewerQueues.flatMap((queue) => [queueMarkdown(queue), ""]),
    "## Threshold Candidates",
    markdownList(
      payload.thresholdCandidates.map(
        (item) => `${item.id} · ${item.area} · ${item.status} · ${item.proposedRuntimeUse}`,
      ),
    ),
  ].join("\n");
}

export function buildConstructorMatrixLayerReviewPackage(params?: {
  generatedAt?: string;
}): ConstructorMatrixLayerReviewPackage {
  const generatedAt = params?.generatedAt ?? new Date().toISOString();
  const thresholdAreas = uniqueSorted(
    CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES.map((item) => item.area),
  );
  const requiredThresholdAreasMissing =
    CONSTRUCTOR_MATRIX_REVIEW_PACKAGE_REQUIRED_THRESHOLD_AREAS.filter(
      (area) => !thresholdAreas.includes(area),
    );
  const payload: ConstructorMatrixReviewPackagePayload = {
    generatedFrom: "matrix_evidence_data_threshold_review_package",
    generatedAt,
    scope: {
      layers: ["evidence_dependency", "data_dependency", "threshold_candidate"],
      purpose:
        "Manual coach, medical and data-quality review of Matrix evidence traceability, data dependency coverage and threshold candidate readiness before any runtime promotion.",
      runtimeBehaviorChanged: false,
      productionRouteChanged: false,
      rolloutGatesChanged: false,
      previewBehaviorChanged: false,
      legacyFallbackChanged: false,
      numericThresholdValuesAdded: false,
    },
    summary: {
      evidenceDependencyCount: CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY.length,
      dataDependencyCount: CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES.length,
      thresholdCandidateCount: CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES.length,
      evidenceRiskAreas: uniqueSorted(
        CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY.flatMap((item) => item.riskAreas),
      ),
      dataAreas: uniqueSorted(CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES.map((item) => item.area)),
      thresholdAreas,
      requiredThresholdAreasCovered:
        CONSTRUCTOR_MATRIX_REVIEW_PACKAGE_REQUIRED_THRESHOLD_AREAS.filter((area) =>
          thresholdAreas.includes(area),
        ),
      requiredThresholdAreasMissing,
    },
    reviewDecisionLedger: buildConstructorMatrixReviewDecisionLedgerSummary(),
    sourceExpansionBacklog: buildConstructorMatrixSourceExpansionBacklogSummary(),
    sourceAcquisition: buildConstructorMatrixSourceAcquisitionSummary(),
    sourceLookupIntake: buildConstructorMatrixSourceLookupIntakeSummary(),
    deskSourceReview: buildConstructorMatrixDeskSourceReviewSummary(),
    evidenceClaimCandidates: buildConstructorMatrixEvidenceClaimCandidateSummary(),
    claimCandidateReviewExport: buildConstructorMatrixClaimCandidateReviewExportSummary(),
    evidenceClaims: buildConstructorMatrixEvidenceClaimExtractionSummary(),
    evidenceClaimReviewIntake: buildConstructorMatrixEvidenceClaimReviewIntakeSummary(),
    reviewIntakeExport: buildConstructorMatrixReviewIntakeExportSummary(),
    exerciseEvidenceMap: buildConstructorMatrixExerciseEvidenceMapSummary(),
    exerciseSourceRequirements: buildConstructorMatrixExerciseSourceRequirementSummary(),
    familySourceReview: buildConstructorMatrixFamilySourceReviewSummary(),
    p0FamilyEvidenceDossiers: buildConstructorMatrixP0FamilyEvidenceDossierSummary(),
    p1FamilyEvidenceDossiers: buildConstructorMatrixP1FamilyEvidenceDossierSummary(),
    familyAllowedUse: buildConstructorMatrixFamilyAllowedUseSummary(),
    reviewerQueues: buildReviewerQueues(),
    evidenceDependencies: CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY.map(evidenceItem),
    dataDependencies: CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES.map(dataItem),
    thresholdCandidates: CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES.map(thresholdItem),
    guardrails: {
      thresholdCandidatesCandidateOnly: true,
      thresholdCandidatesRuntimeOnlyMetadata: true,
      dataDependenciesRuntimeOnlyMetadata: true,
      evidenceDependenciesReviewedAsTraceability: true,
      noRuntimeImportsExpected: true,
    },
  };
  const markdown = buildConstructorMatrixLayerReviewMarkdown(payload);

  return {
    payload,
    markdown,
    json: JSON.stringify(payload, null, 2),
  };
}
