import {
  buildConstructorMatrixDeskSourceReviewSummary,
} from "./constructor-matrix-desk-source-review";
import {
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIMS,
} from "./constructor-matrix-evidence-claims";
import {
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES,
  type ConstructorMatrixEvidenceClaimCandidate,
  type ConstructorMatrixEvidenceClaimCandidateReviewRequirement,
  type ConstructorMatrixEvidenceClaimCandidateStatus,
} from "./constructor-matrix-evidence-claim-candidates";
import {
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES,
  type ConstructorMatrixEvidenceClaimReviewTrack,
} from "./constructor-matrix-evidence-claim-review-intake";

export type ConstructorMatrixClaimCandidateReviewAudience =
  | "coach"
  | "medical"
  | "data_quality"
  | "sport_science"
  | "product_safety"
  | "manual_source_verification"
  | "source_text_acquisition";

export type ConstructorMatrixClaimCandidateReviewExportItem = {
  id: string;
  candidateId: string;
  audience: ConstructorMatrixClaimCandidateReviewAudience;
  title: string;
  candidateStatus: string;
  candidateType: string;
  candidateText: string;
  linkedDeskSourceReviewIds: readonly string[];
  linkedSourceLookupIntakeIds: readonly string[];
  linkedSourceCandidateIds: readonly string[];
  linkedSourceExpansionBacklogIds: readonly string[];
  linkedEvidenceDependencyIds: readonly string[];
  linkedDataDependencyIds: readonly string[];
  linkedThresholdCandidateIds: readonly string[];
  linkedReviewDecisionIds: readonly string[];
  linkedBlockerIds: readonly string[];
  linkedReviewIntakeIds: readonly string[];
  methodOrRiskArea: readonly string[];
  populationContext: readonly string[];
  supports: readonly string[];
  limitations: readonly string[];
  reviewerQuestions: readonly string[];
  requiredArtifacts: readonly string[];
  allowedOutcomes: readonly string[];
  prohibitedActions: readonly string[];
  nextAction: string;
  candidateOnly: true;
  runtimeChangeAllowedNow: false;
  humanReviewed: false;
};

export type ConstructorMatrixClaimCandidateReviewExportPack = {
  generatedFrom: "constructor_matrix_evidence_claim_candidates";
  runtimeChangeAllowedNow: false;
  humanReviewed: false;
  candidateOnly: true;
  summary: {
    candidateCount: number;
    exportItemCount: number;
    itemsByAudience: Record<ConstructorMatrixClaimCandidateReviewAudience, number>;
    candidatesByStatus: Record<ConstructorMatrixEvidenceClaimCandidateStatus, number>;
    highRiskAreasCovered: readonly string[];
    manualVerificationStillRequiredCount: number;
    sourceTextStillRequiredCount: number;
    finalEvidenceClaimCount: 0;
  };
  items: readonly ConstructorMatrixClaimCandidateReviewExportItem[];
  guardrails: readonly string[];
};

export type ConstructorMatrixClaimCandidateReviewExportSummary = {
  claimCandidateReviewExportItemCount: number;
  claimCandidateReviewExportItemsByAudience: Readonly<
    Record<ConstructorMatrixClaimCandidateReviewAudience, number>
  >;
  claimCandidateReviewExportRuntimeChangeAllowedNowCount: number;
  claimCandidateReviewExportHumanReviewedCount: number;
  finalEvidenceClaimCount: number;
};

const CLAIM_CANDIDATE_REVIEW_AUDIENCES = [
  "coach",
  "medical",
  "data_quality",
  "sport_science",
  "product_safety",
  "manual_source_verification",
  "source_text_acquisition",
] as const satisfies readonly ConstructorMatrixClaimCandidateReviewAudience[];

const CLAIM_CANDIDATE_STATUSES = [
  "desk_reviewed_candidate",
  "desk_review_limited_candidate",
  "needs_full_text_before_extraction",
  "needs_policy_text_before_extraction",
  "needs_human_review_before_extraction",
  "manual_verification_required_before_extraction",
  "do_not_automate_candidate",
] as const satisfies readonly ConstructorMatrixEvidenceClaimCandidateStatus[];

const CLAIM_CANDIDATE_REVIEW_EXPORT_GUARDRAILS = [
  "Metadata-only export for future human reviewers",
  "Candidate-only; not a final evidence claim",
  "This packet records no reviewer identity or review date",
  "No candidate approval is recorded by this export",
  "No source readiness change is performed by this export",
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

const REVIEW_INTAKE_BY_ID = new Map(
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES.map((item) => [item.id, item]),
);

function emptyAudienceCounts():
  Record<ConstructorMatrixClaimCandidateReviewAudience, number> {
  return Object.fromEntries(
    CLAIM_CANDIDATE_REVIEW_AUDIENCES.map((audience) => [audience, 0]),
  ) as Record<ConstructorMatrixClaimCandidateReviewAudience, number>;
}

function emptyStatusCounts():
  Record<ConstructorMatrixEvidenceClaimCandidateStatus, number> {
  return Object.fromEntries(
    CLAIM_CANDIDATE_STATUSES.map((status) => [status, 0]),
  ) as Record<ConstructorMatrixEvidenceClaimCandidateStatus, number>;
}

function uniqueSorted<T extends string>(items: readonly T[]): T[] {
  return Array.from(new Set(items)).sort();
}

function markdownList(items: readonly string[]) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- none";
}

function exportSafeText(text: string) {
  return text
    .replaceAll("humanReviewed=true", "humanReviewed to true")
    .replaceAll("reviewedBy", "reviewer identity")
    .replaceAll("reviewedAt", "review date");
}

function exportSafeItems(items: readonly string[]) {
  return items.map(exportSafeText);
}

function audienceForReviewRequirement(
  requirement: ConstructorMatrixEvidenceClaimCandidateReviewRequirement,
): ConstructorMatrixClaimCandidateReviewAudience {
  if (requirement === "coach_review") {
    return "coach";
  }

  if (requirement === "medical_review") {
    return "medical";
  }

  if (requirement === "data_quality_review") {
    return "data_quality";
  }

  if (requirement === "sport_science_review") {
    return "sport_science";
  }

  if (requirement === "product_safety_review") {
    return "product_safety";
  }

  return "manual_source_verification";
}

function audienceForReviewIntakeTrack(
  track: ConstructorMatrixEvidenceClaimReviewTrack,
): ConstructorMatrixClaimCandidateReviewAudience {
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

function reviewIntakeTracksForCandidate(
  candidate: ConstructorMatrixEvidenceClaimCandidate,
): ConstructorMatrixEvidenceClaimReviewTrack[] {
  return uniqueSorted(
    candidate.reviewIntakeIds.flatMap(
      (id) => REVIEW_INTAKE_BY_ID.get(id)?.tracks ?? [],
    ),
  );
}

function uniqueAudiencesForCandidate(
  candidate: ConstructorMatrixEvidenceClaimCandidate,
): ConstructorMatrixClaimCandidateReviewAudience[] {
  const audiences = new Set<ConstructorMatrixClaimCandidateReviewAudience>(
    candidate.reviewRequired.map(audienceForReviewRequirement),
  );

  for (const track of reviewIntakeTracksForCandidate(candidate)) {
    audiences.add(audienceForReviewIntakeTrack(track));
  }

  if (
    candidate.status === "needs_full_text_before_extraction" ||
    candidate.status === "needs_policy_text_before_extraction"
  ) {
    audiences.add("source_text_acquisition");
  }

  if (candidate.status === "manual_verification_required_before_extraction") {
    audiences.add("manual_source_verification");
  }

  return Array.from(audiences).sort();
}

function reviewerQuestionsForAudience(
  candidate: ConstructorMatrixEvidenceClaimCandidate,
  audience: ConstructorMatrixClaimCandidateReviewAudience,
): readonly string[] {
  const common = [
    `Should ${candidate.id} remain candidate-only, be rejected, or wait for another review packet?`,
    "What source text, context, or reviewer artifact is still missing before later extraction work?",
    "Could this wording be misunderstood as a diagnosis, hard gate, or runtime instruction?",
  ];

  if (audience === "coach") {
    return [
      ...common,
      "Does this candidate match real wrestling coaching context without becoming an automatic rule?",
      "Which coach-facing caveats must stay visible if this remains in review export only?",
    ];
  }

  if (audience === "medical") {
    return [
      ...common,
      "Could this candidate be interpreted as medical clearance, diagnosis, or unsafe weight-management guidance?",
      "Which medical safety boundaries must block future extraction or automation?",
    ];
  }

  if (audience === "data_quality") {
    return [
      ...common,
      "Are the linked data dependencies typed and reliable enough for future reviewer interpretation?",
      "Which missing-data behavior must remain advisory or blocked?",
    ];
  }

  if (audience === "sport_science") {
    return [
      ...common,
      "Does the source scope support wrestling-specific use, combat-sport transfer, or only background context?",
      "Which source limitations must be resolved before any later extraction pass?",
    ];
  }

  if (audience === "product_safety") {
    return [
      ...common,
      "Could this candidate affect rollout, save, preview, or user-facing expectations if phrased too strongly?",
      "Which product guardrails must remain in the export before any future source-readiness stage?",
    ];
  }

  if (audience === "manual_source_verification") {
    return [
      ...common,
      "Which source identity, official text, or policy record must be manually verified outside code?",
      "Should this candidate stay blocked until manual source verification is complete?",
    ];
  }

  return [
    ...common,
    "Which abstract, full-text, policy text, or official rule text is required before later extraction work?",
    "Does the available source text directly support this candidate or only provide background context?",
  ];
}

function requiredArtifactsForAudience(
  candidate: ConstructorMatrixEvidenceClaimCandidate,
  audience: ConstructorMatrixClaimCandidateReviewAudience,
): readonly string[] {
  const base = [
    `candidate id: ${candidate.id}`,
    `linked source lookup ids: ${candidate.sourceLookupIntakeIds.join(", ") || "none"}`,
    `linked desk source review ids: ${candidate.deskSourceReviewIds.join(", ") || "none"}`,
    `linked evidence dependency ids: ${candidate.evidenceDependencyIds.join(", ") || "none"}`,
    `linked data dependency ids: ${candidate.dataDependencyIds.join(", ") || "none"}`,
    "reviewer notes recorded outside code",
  ];

  if (audience === "manual_source_verification") {
    return [
      ...base,
      "manually verified source identity or official source text",
      "reason the source remains blocked or can move to a later readiness stage",
    ];
  }

  if (audience === "source_text_acquisition") {
    return [
      ...base,
      "source abstract, full text, policy text, or official rule text",
      "source-scope notes for population and wrestling transfer",
    ];
  }

  return [
    ...base,
    `${audience} reviewer rationale`,
    "explicit keep-blocked or future-review recommendation",
  ];
}

function allowedOutcomesForAudience(
  audience: ConstructorMatrixClaimCandidateReviewAudience,
): readonly string[] {
  const common = [
    "keep candidate blocked",
    "keep candidate in review export only",
    "request replacement or additional source material",
    "reject candidate as unsafe or unsupported",
  ];

  if (audience === "manual_source_verification") {
    return [
      ...common,
      "record that manual source verification is complete outside code",
      "request a separate source-readiness stage after real review",
    ];
  }

  if (audience === "source_text_acquisition") {
    return [
      ...common,
      "record that required source text was acquired outside code",
      "request a separate extraction-readiness stage after real review",
    ];
  }

  return [
    ...common,
    "recommend future extraction review after source readiness is handled separately",
  ];
}

function prohibitedActionsForAudience(
  audience: ConstructorMatrixClaimCandidateReviewAudience,
): readonly string[] {
  return [
    "do not mark this export as human review completion",
    "do not record reviewer identity or review date in this export",
    "do not convert candidate into a final claim",
    "do not update source readiness in this export",
    "do not create a runtime rule",
    "do not create a runtime gate",
    "do not add a numeric cutoff",
    "do not enable Matrix default",
    audience === "medical"
      ? "do not create diagnosis or medical clearance"
      : "do not imply medical clearance",
    audience === "coach"
      ? "do not imply coach signoff"
      : "do not imply coach signoff",
  ];
}

function nextActionForAudience(
  audience: ConstructorMatrixClaimCandidateReviewAudience,
): string {
  if (audience === "manual_source_verification") {
    return "Verify source identity or official text outside code, then decide whether a separate source-readiness stage is warranted.";
  }

  if (audience === "source_text_acquisition") {
    return "Acquire and review source text outside code before any later extraction-readiness stage.";
  }

  return `Route this candidate to ${audience} review outside code and keep it candidate-only until real review results exist.`;
}

function exportItemForCandidateAudience(
  candidate: ConstructorMatrixEvidenceClaimCandidate,
  audience: ConstructorMatrixClaimCandidateReviewAudience,
): ConstructorMatrixClaimCandidateReviewExportItem {
  return {
    id: `claim_candidate_review_export_${audience}_${candidate.id}`,
    candidateId: candidate.id,
    audience,
    title: candidate.title,
    candidateStatus: candidate.status,
    candidateType: candidate.candidateType,
    candidateText: exportSafeText(candidate.candidateText),
    linkedDeskSourceReviewIds: candidate.deskSourceReviewIds,
    linkedSourceLookupIntakeIds: candidate.sourceLookupIntakeIds,
    linkedSourceCandidateIds: candidate.sourceCandidateIds,
    linkedSourceExpansionBacklogIds: candidate.sourceExpansionBacklogIds,
    linkedEvidenceDependencyIds: candidate.evidenceDependencyIds,
    linkedDataDependencyIds: candidate.dataDependencyIds,
    linkedThresholdCandidateIds: candidate.thresholdCandidateIds,
    linkedReviewDecisionIds: candidate.reviewDecisionIds,
    linkedBlockerIds: candidate.blockerIds,
    linkedReviewIntakeIds: candidate.reviewIntakeIds,
    methodOrRiskArea: candidate.methodOrRiskArea,
    populationContext: candidate.populationContext,
    supports: exportSafeItems(candidate.supports),
    limitations: exportSafeItems(candidate.limitations),
    reviewerQuestions: exportSafeItems(
      reviewerQuestionsForAudience(candidate, audience),
    ),
    requiredArtifacts: exportSafeItems(
      requiredArtifactsForAudience(candidate, audience),
    ),
    allowedOutcomes: exportSafeItems(allowedOutcomesForAudience(audience)),
    prohibitedActions: exportSafeItems(prohibitedActionsForAudience(audience)),
    nextAction: exportSafeText(nextActionForAudience(audience)),
    candidateOnly: true,
    runtimeChangeAllowedNow: false,
    humanReviewed: false,
  };
}

function renderExportItemMarkdown(
  item: ConstructorMatrixClaimCandidateReviewExportItem,
): string {
  return [
    `## ${item.id}`,
    "",
    `Audience: ${item.audience}`,
    `Candidate: ${item.candidateId}`,
    `Title: ${item.title}`,
    `Candidate status: ${item.candidateStatus}`,
    `Candidate type: ${item.candidateType}`,
    `candidateOnly=${item.candidateOnly}`,
    `runtimeChangeAllowedNow=${item.runtimeChangeAllowedNow}`,
    `humanReviewed=${item.humanReviewed}`,
    "",
    "Candidate text:",
    item.candidateText,
    "",
    "Method/risk areas:",
    markdownList(item.methodOrRiskArea),
    "",
    "Population context:",
    markdownList(item.populationContext),
    "",
    "Supports:",
    markdownList(item.supports),
    "",
    "Limitations:",
    markdownList(item.limitations),
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
      `desk source reviews: ${item.linkedDeskSourceReviewIds.join(", ") || "none"}`,
      `source lookup intake: ${item.linkedSourceLookupIntakeIds.join(", ") || "none"}`,
      `source candidates: ${item.linkedSourceCandidateIds.join(", ") || "none"}`,
      `source expansion backlog: ${item.linkedSourceExpansionBacklogIds.join(", ") || "none"}`,
      `evidence dependencies: ${item.linkedEvidenceDependencyIds.join(", ") || "none"}`,
      `data dependencies: ${item.linkedDataDependencyIds.join(", ") || "none"}`,
      `threshold candidates: ${item.linkedThresholdCandidateIds.join(", ") || "none"}`,
      `review decisions: ${item.linkedReviewDecisionIds.join(", ") || "none"}`,
      `blockers: ${item.linkedBlockerIds.join(", ") || "none"}`,
      `review intakes: ${item.linkedReviewIntakeIds.join(", ") || "none"}`,
    ]),
  ].join("\n");
}

export function buildConstructorMatrixClaimCandidateReviewExportPack():
  ConstructorMatrixClaimCandidateReviewExportPack {
  const items = CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES.flatMap(
    (candidate) =>
      uniqueAudiencesForCandidate(candidate).map((audience) =>
        exportItemForCandidateAudience(candidate, audience),
      ),
  );
  const itemsByAudience = emptyAudienceCounts();
  const candidatesByStatus = emptyStatusCounts();
  const highRiskAreasCovered = uniqueSorted(
    CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES.flatMap(
      (item) => item.methodOrRiskArea,
    ),
  );
  const deskSourceReviewSummary = buildConstructorMatrixDeskSourceReviewSummary();

  for (const item of items) {
    itemsByAudience[item.audience] += 1;
  }

  for (const candidate of CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES) {
    candidatesByStatus[candidate.status] += 1;
  }

  return {
    generatedFrom: "constructor_matrix_evidence_claim_candidates",
    runtimeChangeAllowedNow: false,
    humanReviewed: false,
    candidateOnly: true,
    summary: {
      candidateCount: CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_CANDIDATES.length,
      exportItemCount: items.length,
      itemsByAudience,
      candidatesByStatus,
      highRiskAreasCovered,
      manualVerificationStillRequiredCount:
        deskSourceReviewSummary.manualVerificationStillRequiredCount,
      sourceTextStillRequiredCount:
        deskSourceReviewSummary.fullTextStillRequiredCount +
        deskSourceReviewSummary.policyTextStillRequiredCount,
      finalEvidenceClaimCount: CONSTRUCTOR_MATRIX_EVIDENCE_CLAIMS.length as 0,
    },
    items,
    guardrails: CLAIM_CANDIDATE_REVIEW_EXPORT_GUARDRAILS,
  };
}

export function buildConstructorMatrixClaimCandidateReviewExportSummary():
  ConstructorMatrixClaimCandidateReviewExportSummary {
  const pack = buildConstructorMatrixClaimCandidateReviewExportPack();

  return {
    claimCandidateReviewExportItemCount: pack.summary.exportItemCount,
    claimCandidateReviewExportItemsByAudience: pack.summary.itemsByAudience,
    claimCandidateReviewExportRuntimeChangeAllowedNowCount:
      pack.items.filter((item) => item.runtimeChangeAllowedNow).length,
    claimCandidateReviewExportHumanReviewedCount:
      pack.items.filter((item) => item.humanReviewed).length,
    finalEvidenceClaimCount: pack.summary.finalEvidenceClaimCount,
  };
}

export function renderConstructorMatrixClaimCandidateReviewExportMarkdown(
  pack: ConstructorMatrixClaimCandidateReviewExportPack,
): string {
  return [
    "# Matrix Evidence Claim Candidate Review Export Pack",
    "",
    "This export is metadata-only and prepares candidate-only packets for future human review.",
    "It is not human review, records no reviewer decision, and performs no source readiness change.",
    "",
    "Summary:",
    markdownList([
      `candidateCount=${pack.summary.candidateCount}`,
      `exportItemCount=${pack.summary.exportItemCount}`,
      `manualVerificationStillRequiredCount=${pack.summary.manualVerificationStillRequiredCount}`,
      `sourceTextStillRequiredCount=${pack.summary.sourceTextStillRequiredCount}`,
      `finalEvidenceClaimCount=${pack.summary.finalEvidenceClaimCount}`,
      `runtimeChangeAllowedNow=${pack.runtimeChangeAllowedNow}`,
      `humanReviewed=${pack.humanReviewed}`,
      `candidateOnly=${pack.candidateOnly}`,
      `coachReviewCount=${pack.summary.itemsByAudience.coach}`,
      `medicalReviewCount=${pack.summary.itemsByAudience.medical}`,
      `dataQualityReviewCount=${pack.summary.itemsByAudience.data_quality}`,
      `sportScienceReviewCount=${pack.summary.itemsByAudience.sport_science}`,
      `productSafetyReviewCount=${pack.summary.itemsByAudience.product_safety}`,
      `manualSourceVerificationCount=${pack.summary.itemsByAudience.manual_source_verification}`,
      `sourceTextAcquisitionCount=${pack.summary.itemsByAudience.source_text_acquisition}`,
    ]),
    "",
    "Guardrails:",
    markdownList(pack.guardrails),
    "",
    ...pack.items.map(renderExportItemMarkdown).flatMap((item) => [item, ""]),
  ].join("\n").trimEnd();
}

export function renderConstructorMatrixClaimCandidateAudienceMarkdown(
  pack: ConstructorMatrixClaimCandidateReviewExportPack,
  audience: ConstructorMatrixClaimCandidateReviewAudience,
): string {
  const items = pack.items.filter((item) => item.audience === audience);

  return [
    `# Matrix Evidence Claim Candidate Review Export: ${audience}`,
    "",
    "This audience packet is metadata-only and keeps every record candidate-only.",
    "It waits for real reviewer work outside code and performs no source readiness change.",
    "",
    "Summary:",
    markdownList([
      `audience=${audience}`,
      `itemCount=${items.length}`,
      `runtimeChangeAllowedNow=${pack.runtimeChangeAllowedNow}`,
      `humanReviewed=${pack.humanReviewed}`,
      `candidateOnly=${pack.candidateOnly}`,
    ]),
    "",
    "Guardrails:",
    markdownList(pack.guardrails),
    "",
    ...items.map(renderExportItemMarkdown).flatMap((item) => [item, ""]),
  ].join("\n").trimEnd();
}
