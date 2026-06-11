import {
  CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES,
  type ConstructorMatrixDataDependency,
  type ConstructorMatrixDataDependencyArea,
  type ConstructorMatrixDataDependencyId,
} from "./constructor-matrix-data-dependencies";
import {
  CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY,
  type ConstructorMatrixEvidenceDependency,
  type ConstructorMatrixEvidenceDependencyId,
  type ConstructorMatrixEvidenceRiskArea,
} from "./constructor-matrix-evidence";
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

export interface ConstructorMatrixReviewPackageRef {
  layer: ConstructorMatrixReviewPackageLayer;
  id: string;
  title: string;
  areas: readonly string[];
  reason: string;
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
  title: string;
  signalType: ConstructorMatrixThresholdCandidate["signalType"];
  candidateDirection: ConstructorMatrixThresholdCandidate["candidateDirection"];
  decisionScope: ConstructorMatrixThresholdCandidate["decisionScope"];
  dataDependencyIds: readonly ConstructorMatrixDataDependencyId[];
  evidenceDependencyIds: readonly ConstructorMatrixEvidenceDependencyId[];
  missingDataBehavior: ConstructorMatrixThresholdCandidate["missingDataBehavior"];
  runtimeUseNow: ConstructorMatrixThresholdCandidate["runtimeUseNow"];
  reviewStatus: ConstructorMatrixThresholdCandidate["reviewStatus"];
  reviewRequired: ConstructorMatrixThresholdCandidate["reviewRequired"];
  fixtureImpact: ConstructorMatrixThresholdCandidate["fixtureImpact"];
  forbiddenRuntimeUseNow: ConstructorMatrixThresholdCandidate["forbiddenRuntimeUseNow"];
  limitations: readonly string[];
  futureValidationQuestions: readonly string[];
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

  for (const id of candidate.requiredDataDependencies) {
    const area = CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES.find((item) => item.id === id)?.area;
    if (area) {
      areas.push(area);
    }
  }

  return areas;
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

  if (item.reviewRequired.includes("coach") || item.reviewRequired.includes("sport_science")) {
    reviewers.add("coach");
  }

  if (item.reviewRequired.includes("medical") || MEDICAL_THRESHOLD_AREAS.has(item.area)) {
    reviewers.add("medical");
  }

  if (item.reviewRequired.includes("data_quality") || DATA_QUALITY_THRESHOLD_AREAS.has(item.area)) {
    reviewers.add("data_quality");
  }

  if (reviewers.size === 0) {
    reviewers.add("coach");
  }

  return Array.from(reviewers);
}

function evidenceReviewRef(item: ConstructorMatrixEvidenceDependency): ConstructorMatrixReviewPackageRef {
  return {
    layer: "evidence_dependency",
    id: item.id,
    title: item.title,
    areas: item.riskAreas,
    reason: `${item.reviewStatus} / ${item.automationReadiness}`,
  };
}

function dataReviewRef(item: ConstructorMatrixDataDependency): ConstructorMatrixReviewPackageRef {
  return {
    layer: "data_dependency",
    id: item.id,
    title: item.title,
    areas: [item.area],
    reason: `${item.currentAvailability} / ${item.missingDataBehavior}`,
  };
}

function thresholdReviewRef(item: ConstructorMatrixThresholdCandidate): ConstructorMatrixReviewPackageRef {
  return {
    layer: "threshold_candidate",
    id: item.id,
    title: item.title,
    areas: [item.area, ...dataAreasForThreshold(item)],
    reason: `${item.reviewStatus} / ${item.runtimeUseNow}`,
  };
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
    title: item.title,
    signalType: item.signalType,
    candidateDirection: item.candidateDirection,
    decisionScope: item.decisionScope,
    dataDependencyIds: item.requiredDataDependencies,
    evidenceDependencyIds: item.supportsEvidenceDependencies,
    missingDataBehavior: item.missingDataBehavior,
    runtimeUseNow: item.runtimeUseNow,
    reviewStatus: item.reviewStatus,
    reviewRequired: item.reviewRequired,
    fixtureImpact: item.fixtureImpact,
    forbiddenRuntimeUseNow: item.forbiddenRuntimeUseNow,
    limitations: item.limitations,
    futureValidationQuestions: item.futureValidationQuestions,
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
      queue.items.map((item) => `${item.layer} · ${item.id} · ${item.reason}`),
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
    ]),
    "",
    "## Required Threshold Areas Covered",
    markdownList(payload.summary.requiredThresholdAreasCovered),
    "",
    ...payload.reviewerQueues.flatMap((queue) => [queueMarkdown(queue), ""]),
    "## Threshold Candidates",
    markdownList(
      payload.thresholdCandidates.map(
        (item) => `${item.id} · ${item.area} · ${item.reviewStatus} · ${item.runtimeUseNow}`,
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
