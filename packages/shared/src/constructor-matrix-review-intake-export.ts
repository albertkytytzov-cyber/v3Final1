import {
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES,
  type ConstructorMatrixEvidenceClaimReviewIntake,
  type ConstructorMatrixEvidenceClaimReviewTrack,
} from "./constructor-matrix-evidence-claim-review-intake";

export type ConstructorMatrixReviewExportAudience =
  | "manual_source_verification"
  | "source_text_acquisition"
  | "coach"
  | "medical"
  | "data_quality"
  | "sport_science"
  | "product_safety";

export type ConstructorMatrixReviewExportFormat =
  | "json"
  | "markdown";

export type ConstructorMatrixReviewExportItem = {
  id: string;
  intakeId: string;
  audience: ConstructorMatrixReviewExportAudience;
  title: string;
  status: string;
  blockerSummary: string;
  linkedBlockerIds: readonly string[];
  linkedSourceLookupIntakeIds: readonly string[];
  linkedSourceCandidateIds: readonly string[];
  linkedSourceExpansionBacklogIds: readonly string[];
  linkedEvidenceDependencyIds: readonly string[];
  linkedDataDependencyIds: readonly string[];
  linkedThresholdCandidateIds: readonly string[];
  linkedReviewDecisionIds: readonly string[];
  reviewerQuestions: readonly string[];
  requiredArtifacts: readonly string[];
  allowedOutcomes: readonly string[];
  prohibitedActions: readonly string[];
  nextAction: string;
  runtimeChangeAllowedNow: false;
  humanReviewed: false;
};

export type ConstructorMatrixReviewIntakeExportPack = {
  generatedFrom: "constructor_matrix_evidence_claim_review_intake";
  runtimeChangeAllowedNow: false;
  humanReviewed: false;
  summary: {
    intakeCount: number;
    exportItemCount: number;
    itemsByAudience: Record<ConstructorMatrixReviewExportAudience, number>;
    manualSourceVerificationCount: number;
    sourceTextAcquisitionCount: number;
    coachReviewCount: number;
    medicalReviewCount: number;
    dataQualityReviewCount: number;
    sportScienceReviewCount: number;
    productSafetyReviewCount: number;
  };
  items: readonly ConstructorMatrixReviewExportItem[];
  guardrails: readonly string[];
};

export type ConstructorMatrixReviewIntakeExportSummary = {
  reviewIntakeExportItemCount: number;
  reviewIntakeExportItemsByAudience: Readonly<Record<ConstructorMatrixReviewExportAudience, number>>;
  reviewIntakeExportRuntimeChangeAllowedNowCount: number;
};

const REVIEW_EXPORT_AUDIENCES = [
  "manual_source_verification",
  "source_text_acquisition",
  "coach",
  "medical",
  "data_quality",
  "sport_science",
  "product_safety",
] as const satisfies readonly ConstructorMatrixReviewExportAudience[];

const REVIEW_EXPORT_GUARDRAILS = [
  "Metadata-only export for human reviewers",
  "This export does not approve claims",
  "No evidence claims are extracted by this export",
  "No source readiness state is changed by this export",
  "No numeric threshold approved",
  "Not a runtime threshold",
  "No runtime promotion",
  "Production route remains unchanged",
  "Rollout gates remain unchanged",
  "Preview behavior remains unchanged",
  "Legacy fallback remains unchanged",
  "Matrix default remains disabled",
  "No private athlete data is included",
] as const;

function emptyAudienceCounts(): Record<ConstructorMatrixReviewExportAudience, number> {
  return Object.fromEntries(
    REVIEW_EXPORT_AUDIENCES.map((audience) => [audience, 0]),
  ) as Record<ConstructorMatrixReviewExportAudience, number>;
}

function audienceForTrack(
  track: ConstructorMatrixEvidenceClaimReviewTrack,
): ConstructorMatrixReviewExportAudience {
  if (track === "coach_review") {
    return "coach";
  }

  if (track === "medical_review") {
    return "medical";
  }

  if (track === "data_quality_review") {
    return "data_quality";
  }

  if (track === "sport_science_review") {
    return "sport_science";
  }

  if (track === "product_safety_review") {
    return "product_safety";
  }

  return track;
}

function uniqueAudiencesForIntake(
  intake: ConstructorMatrixEvidenceClaimReviewIntake,
): ConstructorMatrixReviewExportAudience[] {
  return Array.from(new Set(intake.tracks.map(audienceForTrack))).sort();
}

function exportSafeText(text: string) {
  return text.replace("humanReviewed=true", "humanReviewed to true");
}

function exportSafeItems(items: readonly string[]) {
  return items.map(exportSafeText);
}

function exportItemForIntakeAudience(
  intake: ConstructorMatrixEvidenceClaimReviewIntake,
  audience: ConstructorMatrixReviewExportAudience,
): ConstructorMatrixReviewExportItem {
  return {
    id: `review_export_${audience}_${intake.id}`,
    intakeId: intake.id,
    audience,
    title: intake.title,
    status: intake.status,
    blockerSummary: exportSafeText(intake.blockerSummary),
    linkedBlockerIds: intake.blockerIds,
    linkedSourceLookupIntakeIds: intake.sourceLookupIntakeIds,
    linkedSourceCandidateIds: intake.sourceCandidateIds,
    linkedSourceExpansionBacklogIds: intake.sourceExpansionBacklogIds,
    linkedEvidenceDependencyIds: intake.evidenceDependencyIds,
    linkedDataDependencyIds: intake.dataDependencyIds,
    linkedThresholdCandidateIds: intake.thresholdCandidateIds,
    linkedReviewDecisionIds: intake.reviewDecisionIds,
    reviewerQuestions: exportSafeItems(intake.reviewerQuestions.map((item) => item.question)),
    requiredArtifacts: exportSafeItems(intake.requiredArtifacts),
    allowedOutcomes: exportSafeItems(intake.allowedOutcomes),
    prohibitedActions: exportSafeItems(intake.prohibitedActions),
    nextAction: exportSafeText(intake.nextAction),
    runtimeChangeAllowedNow: false,
    humanReviewed: false,
  };
}

function markdownList(items: readonly string[]) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- none";
}

function renderExportItemMarkdown(item: ConstructorMatrixReviewExportItem): string {
  return [
    `## ${item.id}`,
    "",
    `Audience: ${item.audience}`,
    `Intake: ${item.intakeId}`,
    `Title: ${item.title}`,
    `Status: ${item.status}`,
    `runtimeChangeAllowedNow=${item.runtimeChangeAllowedNow}`,
    `humanReviewed=${item.humanReviewed}`,
    "",
    "Blocker summary:",
    item.blockerSummary,
    "",
    "Reviewer questions:",
    markdownList(item.reviewerQuestions),
    "",
    "Required artifacts:",
    markdownList(item.requiredArtifacts),
    "",
    "Allowed outcomes:",
    markdownList(item.allowedOutcomes),
    "",
    "Prohibited actions:",
    markdownList(item.prohibitedActions),
    "",
    "Next action:",
    item.nextAction,
    "",
    "Linked ids:",
    markdownList([
      `blockers: ${item.linkedBlockerIds.join(", ") || "none"}`,
      `source lookup intake: ${item.linkedSourceLookupIntakeIds.join(", ") || "none"}`,
      `source candidates: ${item.linkedSourceCandidateIds.join(", ") || "none"}`,
      `source expansion backlog: ${item.linkedSourceExpansionBacklogIds.join(", ") || "none"}`,
      `evidence dependencies: ${item.linkedEvidenceDependencyIds.join(", ") || "none"}`,
      `data dependencies: ${item.linkedDataDependencyIds.join(", ") || "none"}`,
      `threshold candidates: ${item.linkedThresholdCandidateIds.join(", ") || "none"}`,
      `review decisions: ${item.linkedReviewDecisionIds.join(", ") || "none"}`,
    ]),
  ].join("\n");
}

export function buildConstructorMatrixReviewIntakeExportPack():
  ConstructorMatrixReviewIntakeExportPack {
  const items = CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES.flatMap((intake) =>
    uniqueAudiencesForIntake(intake).map((audience) =>
      exportItemForIntakeAudience(intake, audience),
    ),
  );
  const itemsByAudience = emptyAudienceCounts();

  for (const item of items) {
    itemsByAudience[item.audience] += 1;
  }

  return {
    generatedFrom: "constructor_matrix_evidence_claim_review_intake",
    runtimeChangeAllowedNow: false,
    humanReviewed: false,
    summary: {
      intakeCount: CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES.length,
      exportItemCount: items.length,
      itemsByAudience,
      manualSourceVerificationCount: itemsByAudience.manual_source_verification,
      sourceTextAcquisitionCount: itemsByAudience.source_text_acquisition,
      coachReviewCount: itemsByAudience.coach,
      medicalReviewCount: itemsByAudience.medical,
      dataQualityReviewCount: itemsByAudience.data_quality,
      sportScienceReviewCount: itemsByAudience.sport_science,
      productSafetyReviewCount: itemsByAudience.product_safety,
    },
    items,
    guardrails: REVIEW_EXPORT_GUARDRAILS,
  };
}

export function buildConstructorMatrixReviewIntakeExportSummary():
  ConstructorMatrixReviewIntakeExportSummary {
  const pack = buildConstructorMatrixReviewIntakeExportPack();

  return {
    reviewIntakeExportItemCount: pack.summary.exportItemCount,
    reviewIntakeExportItemsByAudience: pack.summary.itemsByAudience,
    reviewIntakeExportRuntimeChangeAllowedNowCount:
      pack.items.filter((item) => item.runtimeChangeAllowedNow).length,
  };
}

export function renderConstructorMatrixReviewIntakeExportMarkdown(
  pack: ConstructorMatrixReviewIntakeExportPack,
): string {
  return [
    "# Matrix Review Intake Export Pack",
    "",
    "This export is metadata-only and intended for future human review.",
    "",
    "Summary:",
    markdownList([
      `intakeCount=${pack.summary.intakeCount}`,
      `exportItemCount=${pack.summary.exportItemCount}`,
      `manualSourceVerificationCount=${pack.summary.manualSourceVerificationCount}`,
      `sourceTextAcquisitionCount=${pack.summary.sourceTextAcquisitionCount}`,
      `coachReviewCount=${pack.summary.coachReviewCount}`,
      `medicalReviewCount=${pack.summary.medicalReviewCount}`,
      `dataQualityReviewCount=${pack.summary.dataQualityReviewCount}`,
      `sportScienceReviewCount=${pack.summary.sportScienceReviewCount}`,
      `productSafetyReviewCount=${pack.summary.productSafetyReviewCount}`,
      `runtimeChangeAllowedNow=${pack.runtimeChangeAllowedNow}`,
      `humanReviewed=${pack.humanReviewed}`,
    ]),
    "",
    "Guardrails:",
    markdownList(pack.guardrails),
    "",
    ...pack.items.map(renderExportItemMarkdown).flatMap((item) => [item, ""]),
  ].join("\n").trimEnd();
}

export function renderConstructorMatrixReviewAudienceMarkdown(
  pack: ConstructorMatrixReviewIntakeExportPack,
  audience: ConstructorMatrixReviewExportAudience,
): string {
  const items = pack.items.filter((item) => item.audience === audience);

  return [
    `# Matrix Review Intake Export: ${audience}`,
    "",
    "This audience packet is metadata-only and waits for real-world reviewer action.",
    "",
    "Summary:",
    markdownList([
      `audience=${audience}`,
      `itemCount=${items.length}`,
      `runtimeChangeAllowedNow=${pack.runtimeChangeAllowedNow}`,
      `humanReviewed=${pack.humanReviewed}`,
    ]),
    "",
    "Guardrails:",
    markdownList(pack.guardrails),
    "",
    ...items.map(renderExportItemMarkdown).flatMap((item) => [item, ""]),
  ].join("\n").trimEnd();
}
