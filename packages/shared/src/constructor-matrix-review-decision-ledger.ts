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
import {
  CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG,
  type ConstructorMatrixSourceExpansionBacklogId,
} from "./constructor-matrix-source-expansion-backlog";
import {
  CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES,
  type ConstructorMatrixSourceCandidateId,
} from "./constructor-matrix-source-candidates";
import {
  CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE,
  type ConstructorMatrixSourceLookupIntakeId,
} from "./constructor-matrix-source-lookup-intake";

export type ConstructorMatrixReviewSubjectType =
  | "evidence_dependency"
  | "data_dependency"
  | "threshold_candidate";

export type ConstructorMatrixReviewTrack =
  | "coach"
  | "medical"
  | "data_quality"
  | "sport_science"
  | "product_safety";

export type ConstructorMatrixReviewDecisionStatus =
  | "pending_review"
  | "needs_source_expansion"
  | "needs_data_model"
  | "needs_coach_decision"
  | "needs_medical_decision"
  | "needs_data_quality_review"
  | "blocked_for_runtime"
  | "do_not_automate"
  | "docs_only_allowed"
  | "review_export_only_allowed"
  | "warning_candidate_only";

export type ConstructorMatrixReviewDecisionSource =
  | "system_initial_triage"
  | "audit_trace"
  | "review_package_queue"
  | "manual_human_review";

export type ConstructorMatrixReviewAllowedUseNow =
  | "none"
  | "docs_only"
  | "review_export_only"
  | "risk_warning_candidate_only";

export type ConstructorMatrixReviewDecisionEntry = {
  id: string;
  subjectType: ConstructorMatrixReviewSubjectType;
  subjectId: string;
  title: string;
  requiredReviewTracks: readonly ConstructorMatrixReviewTrack[];
  status: ConstructorMatrixReviewDecisionStatus;
  decisionSource: ConstructorMatrixReviewDecisionSource;
  allowedUseNow: ConstructorMatrixReviewAllowedUseNow;
  forbiddenUseNow: readonly string[];
  rationale: string;
  blockingReasons: readonly string[];
  followUpActions: readonly string[];
  evidenceDependencyIds: readonly ConstructorMatrixEvidenceDependencyId[];
  dataDependencyIds: readonly ConstructorMatrixDataDependencyId[];
  thresholdCandidateIds: readonly ConstructorMatrixThresholdCandidateId[];
  sourceExpansionBacklogIds?: readonly ConstructorMatrixSourceExpansionBacklogId[];
  sourceCandidateIds?: readonly ConstructorMatrixSourceCandidateId[];
  sourceLookupIntakeIds?: readonly ConstructorMatrixSourceLookupIntakeId[];
  humanReviewed: false;
  reviewedBy?: never;
  reviewedAt?: never;
};

export interface ConstructorMatrixReviewDecisionLedgerSummary {
  totalLedgerEntries: number;
  entriesBySubjectType: Readonly<Record<ConstructorMatrixReviewSubjectType, number>>;
  entriesByStatus: Readonly<Record<ConstructorMatrixReviewDecisionStatus, number>>;
  entriesByReviewTrack: Readonly<Record<ConstructorMatrixReviewTrack, number>>;
  blockedForRuntimeCount: number;
  doNotAutomateCount: number;
  needsMedicalDecisionCount: number;
  needsDataQualityReviewCount: number;
  thresholdCandidatesCoveredCount: number;
  thresholdCandidateCount: number;
  highRiskDataDependenciesCoveredCount: number;
  highRiskDataDependencyCount: number;
  evidenceDependenciesNeedingReviewCoveredCount: number;
  evidenceDependenciesNeedingReviewCount: number;
  humanReviewed: false;
}

const HIGH_RISK_DATA_AREAS = [
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
] as const satisfies readonly ConstructorMatrixDataDependencyArea[];

const HIGH_RISK_THRESHOLD_AREAS = HIGH_RISK_DATA_AREAS as readonly ConstructorMatrixThresholdCandidateArea[];

const HIGH_RISK_DATA_AREA_SET = new Set<string>(HIGH_RISK_DATA_AREAS);
const HIGH_RISK_THRESHOLD_AREA_SET = new Set<string>(HIGH_RISK_THRESHOLD_AREAS);

const FORBIDDEN_COMMON_USE = [
  "runtime hard rule",
  "runtime gate",
  "automatic threshold cutoff",
  "Matrix broad default",
  "production rollout promotion",
] as const;

const STATUS_VALUES = [
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
] as const satisfies readonly ConstructorMatrixReviewDecisionStatus[];

const TRACK_VALUES = [
  "coach",
  "medical",
  "data_quality",
  "sport_science",
  "product_safety",
] as const satisfies readonly ConstructorMatrixReviewTrack[];

const SUBJECT_VALUES = [
  "evidence_dependency",
  "data_dependency",
  "threshold_candidate",
] as const satisfies readonly ConstructorMatrixReviewSubjectType[];

function unique<T extends string>(items: readonly T[]): T[] {
  return Array.from(new Set(items));
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

function evidenceRiskAreaToDataArea(
  area: ConstructorMatrixEvidenceRiskArea,
): ConstructorMatrixDataDependencyArea | null {
  if (HIGH_RISK_DATA_AREA_SET.has(area)) {
    return area as ConstructorMatrixDataDependencyArea;
  }

  if (area === "travel") {
    return "travel_fatigue";
  }

  if (area === "competition_day" || area === "competition_model") {
    return "competition_context";
  }

  if (area === "injury_pain") {
    return "pain";
  }

  return null;
}

function evidenceHasHighRiskArea(item: ConstructorMatrixEvidenceDependency) {
  return item.riskAreas.some((area) => evidenceRiskAreaToDataArea(area));
}

export function isConstructorMatrixHighRiskDataDependency(
  item: ConstructorMatrixDataDependency,
) {
  return HIGH_RISK_DATA_AREA_SET.has(item.area);
}

export function isConstructorMatrixEvidenceDependencyNeedingReview(
  item: ConstructorMatrixEvidenceDependency,
) {
  return (
    item.automationReadiness !== "auto_allowed" ||
    item.reviewStatus.includes("coach") ||
    item.reviewStatus.includes("medical") ||
    item.reviewStatus.includes("blocked") ||
    item.reviewStatus.includes("audit") ||
    evidenceHasHighRiskArea(item) ||
    item.ruleNature === "internal_case_pattern" ||
    item.ruleNature === "coaching_heuristic" ||
    item.ruleNature === "gap_marker" ||
    item.type === "internal_validation" ||
    item.type === "coach_school"
  );
}

function dataIdsForEvidence(
  id: ConstructorMatrixEvidenceDependencyId,
): ConstructorMatrixDataDependencyId[] {
  return CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES
    .filter((item) => (item.supportsEvidenceDependencies as readonly string[]).includes(id))
    .map((item) => item.id as ConstructorMatrixDataDependencyId);
}

function thresholdIdsForEvidence(
  id: ConstructorMatrixEvidenceDependencyId,
): ConstructorMatrixThresholdCandidateId[] {
  return CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES
    .filter((item) => (item.evidenceDependencyIds as readonly string[]).includes(id))
    .map((item) => item.id as ConstructorMatrixThresholdCandidateId);
}

function thresholdIdsForData(
  id: ConstructorMatrixDataDependencyId,
): ConstructorMatrixThresholdCandidateId[] {
  return CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES
    .filter((item) => (item.dataDependencyIds as readonly string[]).includes(id))
    .map((item) => item.id as ConstructorMatrixThresholdCandidateId);
}

function sourceExpansionIdsForEvidence(
  id: ConstructorMatrixEvidenceDependencyId,
): ConstructorMatrixSourceExpansionBacklogId[] {
  return CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG
    .filter((item) => (item.evidenceDependencyIds as readonly string[]).includes(id))
    .map((item) => item.id as ConstructorMatrixSourceExpansionBacklogId);
}

function sourceExpansionIdsForData(
  id: ConstructorMatrixDataDependencyId,
): ConstructorMatrixSourceExpansionBacklogId[] {
  return CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG
    .filter((item) => (item.dataDependencyIds as readonly string[]).includes(id))
    .map((item) => item.id as ConstructorMatrixSourceExpansionBacklogId);
}

function sourceExpansionIdsForThreshold(
  id: ConstructorMatrixThresholdCandidateId,
): ConstructorMatrixSourceExpansionBacklogId[] {
  return CONSTRUCTOR_MATRIX_SOURCE_EXPANSION_BACKLOG
    .filter((item) => (item.thresholdCandidateIds as readonly string[]).includes(id))
    .map((item) => item.id as ConstructorMatrixSourceExpansionBacklogId);
}

function sourceCandidateIdsForEvidence(
  id: ConstructorMatrixEvidenceDependencyId,
): ConstructorMatrixSourceCandidateId[] {
  return CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES
    .filter((item) => (item.linkedEvidenceDependencyIds as readonly string[]).includes(id))
    .map((item) => item.id as ConstructorMatrixSourceCandidateId);
}

function sourceCandidateIdsForData(
  id: ConstructorMatrixDataDependencyId,
): ConstructorMatrixSourceCandidateId[] {
  return CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES
    .filter((item) => (item.linkedDataDependencyIds as readonly string[]).includes(id))
    .map((item) => item.id as ConstructorMatrixSourceCandidateId);
}

function sourceCandidateIdsForThreshold(
  id: ConstructorMatrixThresholdCandidateId,
): ConstructorMatrixSourceCandidateId[] {
  return CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES
    .filter((item) => (item.linkedThresholdCandidateIds as readonly string[]).includes(id))
    .map((item) => item.id as ConstructorMatrixSourceCandidateId);
}

function sourceLookupIntakeIdsForEvidence(
  id: ConstructorMatrixEvidenceDependencyId,
): ConstructorMatrixSourceLookupIntakeId[] {
  return CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE
    .filter((item) => (item.linkedEvidenceDependencyIds as readonly string[]).includes(id))
    .map((item) => item.id as ConstructorMatrixSourceLookupIntakeId);
}

function sourceLookupIntakeIdsForData(
  id: ConstructorMatrixDataDependencyId,
): ConstructorMatrixSourceLookupIntakeId[] {
  return CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE
    .filter((item) => (item.linkedDataDependencyIds as readonly string[]).includes(id))
    .map((item) => item.id as ConstructorMatrixSourceLookupIntakeId);
}

function sourceLookupIntakeIdsForThreshold(
  id: ConstructorMatrixThresholdCandidateId,
): ConstructorMatrixSourceLookupIntakeId[] {
  return CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE
    .filter((item) => (item.linkedThresholdCandidateIds as readonly string[]).includes(id))
    .map((item) => item.id as ConstructorMatrixSourceLookupIntakeId);
}

function addAreaTracks(
  tracks: Set<ConstructorMatrixReviewTrack>,
  areas: readonly string[],
) {
  if (
    areas.some((area) =>
      [
        "lmv",
        "taper",
        "contact_load",
        "competition_model",
        "competition_context",
        "competition_day",
        "travel",
        "travel_fatigue",
      ].includes(area),
    )
  ) {
    tracks.add("coach");
  }

  if (
    areas.some((area) =>
      [
        "weight_cut",
        "hydration",
        "pain",
        "injury",
        "injury_pain",
        "female_context",
        "youth_context",
        "bfr_kaatsu",
        "weigh_in",
      ].includes(area),
    )
  ) {
    tracks.add("medical");
  }

  if (
    areas.some((area) =>
      [
        "wearable_data",
        "sleep",
        "rhr",
        "hrv",
        "readiness",
      ].includes(area),
    )
  ) {
    tracks.add("data_quality");
  }

  if (
    areas.some((area) =>
      [
        "contact_load",
        "competition_model",
        "taper",
        "lmv",
        "readiness",
      ].includes(area),
    )
  ) {
    tracks.add("sport_science");
  }

  if (
    areas.some((area) =>
      [
        "rollout",
        "save_dry_run",
        "legacy_safety",
        "risk_check",
      ].includes(area),
    )
  ) {
    tracks.add("product_safety");
  }
}

function reviewTracksForThreshold(
  item: ConstructorMatrixThresholdCandidate,
): ConstructorMatrixReviewTrack[] {
  const tracks = new Set<ConstructorMatrixReviewTrack>();

  for (const review of item.reviewRequired) {
    if (review === "coach_review") tracks.add("coach");
    if (review === "medical_review") tracks.add("medical");
    if (review === "data_quality_review") tracks.add("data_quality");
    if (review === "sport_science_review") tracks.add("sport_science");
    if (review === "product_safety_review") tracks.add("product_safety");
  }

  addAreaTracks(tracks, [item.area]);

  if (tracks.size === 0) {
    tracks.add("coach");
  }

  return Array.from(tracks);
}

function reviewTracksForData(
  item: ConstructorMatrixDataDependency,
): ConstructorMatrixReviewTrack[] {
  const tracks = new Set<ConstructorMatrixReviewTrack>();

  if (item.currentAvailability !== "available") {
    tracks.add("data_quality");
  }

  addAreaTracks(tracks, [item.area]);

  if (tracks.size === 0) {
    tracks.add("data_quality");
  }

  return Array.from(tracks);
}

function reviewTracksForEvidence(
  item: ConstructorMatrixEvidenceDependency,
): ConstructorMatrixReviewTrack[] {
  const tracks = new Set<ConstructorMatrixReviewTrack>();

  addAreaTracks(tracks, item.riskAreas);

  if (item.type === "coach_school" || item.ruleNature === "internal_case_pattern") {
    tracks.add("coach");
  }

  if (item.type === "transfer_grappling_evidence" || item.ruleNature === "gap_marker") {
    tracks.add("sport_science");
  }

  if (
    item.automationReadiness === "medical_review_required" ||
    item.reviewStatus === "medical_review_required"
  ) {
    tracks.add("medical");
  }

  if (
    item.automationReadiness === "coach_review_required" ||
    item.reviewStatus === "coach_review_required"
  ) {
    tracks.add("coach");
  }

  if (
    item.automationReadiness === "evidence_only" ||
    item.reviewStatus === "audit_only" ||
    item.type === "internal_validation"
  ) {
    tracks.add("data_quality");
  }

  if (
    item.ruleNature === "product_rollout_guard" ||
    item.ruleNature === "runtime_safety_guard" ||
    item.riskAreas.includes("rollout") ||
    item.riskAreas.includes("save_dry_run") ||
    item.riskAreas.includes("legacy_safety")
  ) {
    tracks.add("product_safety");
  }

  if (tracks.size === 0) {
    tracks.add("coach");
  }

  return Array.from(tracks);
}

function statusForThreshold(
  item: ConstructorMatrixThresholdCandidate,
): ConstructorMatrixReviewDecisionStatus {
  if (item.status === "do_not_automate") return "do_not_automate";
  if (item.status === "blocked_for_runtime") return "blocked_for_runtime";

  if (
    item.area === "weight_cut" ||
    item.area === "hydration" ||
    item.area === "pain" ||
    item.area === "injury" ||
    item.area === "female_context" ||
    item.id === "youth_weight_cut_block_candidate"
  ) {
    return "needs_medical_decision";
  }

  if (
    item.area === "wearable_data" ||
    item.area === "sleep" ||
    item.area === "rhr" ||
    item.area === "hrv" ||
    item.area === "readiness"
  ) {
    return "needs_data_quality_review";
  }

  if (item.status === "needs_evidence") return "needs_source_expansion";
  if (item.status === "approved_for_docs_only") return "docs_only_allowed";
  if (item.status === "approved_for_warning_candidate") return "warning_candidate_only";

  return "needs_coach_decision";
}

function statusForData(
  item: ConstructorMatrixDataDependency,
): ConstructorMatrixReviewDecisionStatus {
  if (
    item.area === "weight_cut" ||
    item.area === "hydration" ||
    item.area === "pain" ||
    item.area === "injury" ||
    item.area === "female_context"
  ) {
    return "needs_medical_decision";
  }

  if (
    item.area === "wearable_data" ||
    item.area === "sleep" ||
    item.area === "rhr" ||
    item.area === "hrv" ||
    item.area === "readiness"
  ) {
    return item.currentAvailability === "unknown" ? "needs_data_model" : "needs_data_quality_review";
  }

  if (item.area === "youth_context") {
    return "needs_coach_decision";
  }

  if (item.area === "contact_load" || item.area === "lmv" || item.area === "taper") {
    return "needs_source_expansion";
  }

  return "pending_review";
}

function statusForEvidence(
  item: ConstructorMatrixEvidenceDependency,
): ConstructorMatrixReviewDecisionStatus {
  if (item.reviewStatus === "blocked_for_default" || item.automationReadiness === "do_not_automate") {
    return "blocked_for_runtime";
  }

  if (
    item.automationReadiness === "medical_review_required" ||
    item.reviewStatus === "medical_review_required" ||
    item.riskAreas.some((area) =>
      [
        "weight_cut",
        "hydration",
        "injury_pain",
        "female_context",
        "bfr_kaatsu",
      ].includes(area),
    )
  ) {
    return "needs_medical_decision";
  }

  if (
    item.type === "transfer_grappling_evidence" ||
    item.ruleNature === "gap_marker" ||
    item.riskAreas.some((area) => ["contact_load", "lmv", "taper"].includes(area))
  ) {
    return "needs_source_expansion";
  }

  if (
    item.riskAreas.some((area) => ["wearable_data", "readiness"].includes(area)) ||
    item.reviewStatus === "audit_only"
  ) {
    return "needs_data_quality_review";
  }

  if (
    item.automationReadiness === "coach_review_required" ||
    item.reviewStatus === "coach_review_required" ||
    item.ruleNature === "internal_case_pattern" ||
    item.type === "coach_school"
  ) {
    return "needs_coach_decision";
  }

  return "pending_review";
}

function allowedUseForThreshold(
  item: ConstructorMatrixThresholdCandidate,
  status: ConstructorMatrixReviewDecisionStatus,
): ConstructorMatrixReviewAllowedUseNow {
  if (status === "do_not_automate" || status === "blocked_for_runtime") {
    return "none";
  }

  if (status === "warning_candidate_only" && item.proposedRuntimeUse === "risk_warning_candidate") {
    return "risk_warning_candidate_only";
  }

  if (status === "docs_only_allowed") {
    return "docs_only";
  }

  return "review_export_only";
}

function allowedUseForData(
  item: ConstructorMatrixDataDependency,
): ConstructorMatrixReviewAllowedUseNow {
  if (
    item.area === "weight_cut" ||
    item.area === "hydration" ||
    item.area === "pain" ||
    item.area === "injury" ||
    item.area === "female_context"
  ) {
    return "review_export_only";
  }

  if (
    item.area === "wearable_data" ||
    item.area === "sleep" ||
    item.area === "rhr" ||
    item.area === "hrv" ||
    item.area === "readiness"
  ) {
    return "docs_only";
  }

  return "review_export_only";
}

function allowedUseForEvidence(
  status: ConstructorMatrixReviewDecisionStatus,
): ConstructorMatrixReviewAllowedUseNow {
  if (
    status === "blocked_for_runtime" ||
    status === "do_not_automate" ||
    status === "needs_medical_decision"
  ) {
    return "none";
  }

  if (status === "needs_data_quality_review" || status === "pending_review") {
    return "docs_only";
  }

  return "review_export_only";
}

function forbiddenUseForAreas(areas: readonly string[]) {
  const forbidden = new Set<string>(FORBIDDEN_COMMON_USE);

  if (areas.some((area) => area === "weight_cut")) {
    forbidden.add("automatic weight-cut decision");
  }

  if (areas.some((area) => area === "hydration")) {
    forbidden.add("automatic hydration diagnosis");
  }

  if (areas.some((area) => area === "pain" || area === "injury" || area === "injury_pain")) {
    forbidden.add("automatic injury-return decision");
  }

  if (areas.some((area) => area === "female_context")) {
    forbidden.add("automatic RED-S decision");
  }

  if (areas.some((area) => area === "youth_context")) {
    forbidden.add("automatic youth high-load progression");
  }

  if (areas.some((area) => area === "contact_load" || area === "lmv" || area === "taper")) {
    forbidden.add("automatic load or volume promotion");
  }

  return Array.from(forbidden);
}

function evidenceDecisionEntry(
  item: ConstructorMatrixEvidenceDependency,
): ConstructorMatrixReviewDecisionEntry {
  const status = statusForEvidence(item);

  return {
    id: `evidence_${item.id}`,
    subjectType: "evidence_dependency",
    subjectId: item.id,
    title: item.title,
    requiredReviewTracks: reviewTracksForEvidence(item),
    status,
    decisionSource: "audit_trace",
    allowedUseNow: allowedUseForEvidence(status),
    forbiddenUseNow: forbiddenUseForAreas(item.riskAreas),
    rationale:
      "System triage keeps this evidence dependency in review governance before any runtime promotion.",
    blockingReasons: [
      "No human review recorded",
      "Evidence trace remains metadata-only",
      "Runtime promotion requires a separate stage",
    ],
    followUpActions: [
      "Confirm source scope with the assigned review track",
      "Record limitations before any review export promotion",
      "Keep constructor runtime unchanged",
    ],
    evidenceDependencyIds: [item.id as ConstructorMatrixEvidenceDependencyId],
    dataDependencyIds: dataIdsForEvidence(item.id as ConstructorMatrixEvidenceDependencyId),
    thresholdCandidateIds: thresholdIdsForEvidence(item.id as ConstructorMatrixEvidenceDependencyId),
    sourceExpansionBacklogIds: sourceExpansionIdsForEvidence(
      item.id as ConstructorMatrixEvidenceDependencyId,
    ),
    sourceCandidateIds: sourceCandidateIdsForEvidence(
      item.id as ConstructorMatrixEvidenceDependencyId,
    ),
    sourceLookupIntakeIds: sourceLookupIntakeIdsForEvidence(
      item.id as ConstructorMatrixEvidenceDependencyId,
    ),
    humanReviewed: false,
  };
}

function dataDecisionEntry(
  item: ConstructorMatrixDataDependency,
): ConstructorMatrixReviewDecisionEntry {
  const status = statusForData(item);

  return {
    id: `data_${item.id}`,
    subjectType: "data_dependency",
    subjectId: item.id,
    title: item.title,
    requiredReviewTracks: reviewTracksForData(item),
    status,
    decisionSource: "system_initial_triage",
    allowedUseNow: allowedUseForData(item),
    forbiddenUseNow: forbiddenUseForAreas([item.area]),
    rationale:
      "System triage records that this data dependency needs review before it can affect Matrix decisions.",
    blockingReasons: [
      "Data availability and missing-data behavior need review",
      "No human review recorded",
      "Runtime promotion requires a separate stage",
    ],
    followUpActions: [
      "Validate required fields and source quality",
      "Confirm missing-data behavior with the assigned review track",
      "Keep data dependency metadata separate from runtime gates",
    ],
    evidenceDependencyIds: item.supportsEvidenceDependencies,
    dataDependencyIds: [item.id as ConstructorMatrixDataDependencyId],
    thresholdCandidateIds: thresholdIdsForData(item.id as ConstructorMatrixDataDependencyId),
    sourceExpansionBacklogIds: sourceExpansionIdsForData(
      item.id as ConstructorMatrixDataDependencyId,
    ),
    sourceCandidateIds: sourceCandidateIdsForData(
      item.id as ConstructorMatrixDataDependencyId,
    ),
    sourceLookupIntakeIds: sourceLookupIntakeIdsForData(
      item.id as ConstructorMatrixDataDependencyId,
    ),
    humanReviewed: false,
  };
}

function thresholdDecisionEntry(
  item: ConstructorMatrixThresholdCandidate,
): ConstructorMatrixReviewDecisionEntry {
  const status = statusForThreshold(item);

  return {
    id: `threshold_${item.id}`,
    subjectType: "threshold_candidate",
    subjectId: item.id,
    title: item.title,
    requiredReviewTracks: reviewTracksForThreshold(item),
    status,
    decisionSource: "review_package_queue",
    allowedUseNow: allowedUseForThreshold(item, status),
    forbiddenUseNow: unique([
      ...item.forbiddenRuntimeUseNow,
      ...forbiddenUseForAreas([item.area]),
    ]),
    rationale:
      "System triage keeps this threshold candidate pending review and blocks runtime promotion.",
    blockingReasons: [
      "No human review recorded",
      "No numeric threshold approved",
      "Runtime promotion requires a separate stage",
    ],
    followUpActions: [
      "Route through coach, medical or data-quality review as assigned",
      "Expand sources or data model where required",
      "Keep candidate out of constructor runtime gates",
    ],
    evidenceDependencyIds: item.evidenceDependencyIds,
    dataDependencyIds: item.dataDependencyIds,
    thresholdCandidateIds: [item.id as ConstructorMatrixThresholdCandidateId],
    sourceExpansionBacklogIds: sourceExpansionIdsForThreshold(
      item.id as ConstructorMatrixThresholdCandidateId,
    ),
    sourceCandidateIds: sourceCandidateIdsForThreshold(
      item.id as ConstructorMatrixThresholdCandidateId,
    ),
    sourceLookupIntakeIds: sourceLookupIntakeIdsForThreshold(
      item.id as ConstructorMatrixThresholdCandidateId,
    ),
    humanReviewed: false,
  };
}

export const CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER = [
  ...CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES.map(thresholdDecisionEntry),
  ...CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES
    .filter(isConstructorMatrixHighRiskDataDependency)
    .map(dataDecisionEntry),
  ...CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY
    .filter(isConstructorMatrixEvidenceDependencyNeedingReview)
    .map(evidenceDecisionEntry),
] satisfies readonly ConstructorMatrixReviewDecisionEntry[];

export type ConstructorMatrixReviewDecisionId =
  (typeof CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER)[number]["id"];

export const CONSTRUCTOR_MATRIX_REVIEW_DECISION_IDS =
  CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER.map((item) => item.id);

export const CONSTRUCTOR_MATRIX_REVIEW_DECISION_ID_SET = new Set<string>(
  CONSTRUCTOR_MATRIX_REVIEW_DECISION_IDS,
);

const CONSTRUCTOR_MATRIX_REVIEW_DECISION_LOOKUP = new Map<
  ConstructorMatrixReviewDecisionId,
  ConstructorMatrixReviewDecisionEntry
>(
  CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER.map((item) => [
    item.id as ConstructorMatrixReviewDecisionId,
    item,
  ]),
);

export function listConstructorMatrixReviewDecisionIds(): ConstructorMatrixReviewDecisionId[] {
  return [...CONSTRUCTOR_MATRIX_REVIEW_DECISION_IDS] as ConstructorMatrixReviewDecisionId[];
}

export function getConstructorMatrixReviewDecision(
  id: string,
): ConstructorMatrixReviewDecisionEntry | null {
  return (
    CONSTRUCTOR_MATRIX_REVIEW_DECISION_LOOKUP.get(
      id as ConstructorMatrixReviewDecisionId,
    ) ?? null
  );
}

export function getConstructorMatrixReviewDecisionsForSubject(
  subjectType: ConstructorMatrixReviewSubjectType,
  subjectId: string,
): ConstructorMatrixReviewDecisionEntry[] {
  return CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER.filter(
    (item) => item.subjectType === subjectType && item.subjectId === subjectId,
  );
}

export function validateConstructorMatrixReviewDecisionIds(
  ids: readonly string[],
): { ok: boolean; missing: string[] } {
  const missing = ids.filter((id) => !CONSTRUCTOR_MATRIX_REVIEW_DECISION_ID_SET.has(id));

  return {
    ok: missing.length === 0,
    missing,
  };
}

export function buildConstructorMatrixReviewDecisionLedgerSummary():
  ConstructorMatrixReviewDecisionLedgerSummary {
  const thresholdCandidatesCovered = new Set(
    CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER.flatMap((item) => item.thresholdCandidateIds),
  );
  const highRiskDataDependencies = CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES.filter(
    isConstructorMatrixHighRiskDataDependency,
  );
  const highRiskDataDependenciesCovered = new Set(
    CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER
      .filter((item) => item.subjectType === "data_dependency")
      .map((item) => item.subjectId),
  );
  const evidenceDependenciesNeedingReview =
    CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY.filter(
      isConstructorMatrixEvidenceDependencyNeedingReview,
    );
  const evidenceDependenciesNeedingReviewCovered = new Set(
    CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER
      .filter((item) => item.subjectType === "evidence_dependency")
      .map((item) => item.subjectId),
  );

  return {
    totalLedgerEntries: CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER.length,
    entriesBySubjectType: countBy(
      SUBJECT_VALUES,
      CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER.map((item) => item.subjectType),
    ),
    entriesByStatus: countBy(
      STATUS_VALUES,
      CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER.map((item) => item.status),
    ),
    entriesByReviewTrack: countBy(
      TRACK_VALUES,
      CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER.flatMap((item) => item.requiredReviewTracks),
    ),
    blockedForRuntimeCount: CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER.filter(
      (item) => item.status === "blocked_for_runtime",
    ).length,
    doNotAutomateCount: CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER.filter(
      (item) => item.status === "do_not_automate",
    ).length,
    needsMedicalDecisionCount: CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER.filter(
      (item) => item.status === "needs_medical_decision",
    ).length,
    needsDataQualityReviewCount: CONSTRUCTOR_MATRIX_REVIEW_DECISION_LEDGER.filter(
      (item) => item.status === "needs_data_quality_review",
    ).length,
    thresholdCandidatesCoveredCount: thresholdCandidatesCovered.size,
    thresholdCandidateCount: CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES.length,
    highRiskDataDependenciesCoveredCount: highRiskDataDependenciesCovered.size,
    highRiskDataDependencyCount: highRiskDataDependencies.length,
    evidenceDependenciesNeedingReviewCoveredCount:
      evidenceDependenciesNeedingReviewCovered.size,
    evidenceDependenciesNeedingReviewCount: evidenceDependenciesNeedingReview.length,
    humanReviewed: false,
  };
}
