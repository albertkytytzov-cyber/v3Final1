import {
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS,
  type ConstructorMatrixEvidenceClaimBlocker,
  type ConstructorMatrixEvidenceClaimBlockerReason,
} from "./constructor-matrix-evidence-claims";
import {
  CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES,
  type ConstructorMatrixSourceCandidate,
  type ConstructorMatrixSourceCandidateReviewTrack,
} from "./constructor-matrix-source-candidates";
import {
  CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE,
  type ConstructorMatrixSourceLookupIntake,
  type ConstructorMatrixSourceLookupReviewTrack,
} from "./constructor-matrix-source-lookup-intake";

export type ConstructorMatrixEvidenceClaimReviewTrack =
  | "manual_source_verification"
  | "source_text_acquisition"
  | "coach_review"
  | "medical_review"
  | "sport_science_review"
  | "data_quality_review"
  | "product_safety_review";

export type ConstructorMatrixEvidenceClaimReviewIntakeStatus =
  | "pending_intake"
  | "manual_verification_needed"
  | "source_text_needed"
  | "reviewer_assignment_needed"
  | "blocked_for_claim_extraction"
  | "ready_for_human_review_packet";

export type ConstructorMatrixEvidenceClaimReviewAllowedOutcome =
  | "keep_blocked"
  | "source_verified_for_future_extraction"
  | "source_rejected"
  | "replacement_source_needed"
  | "claim_extraction_ready_after_review"
  | "do_not_automate"
  | "needs_more_data"
  | "needs_medical_review"
  | "needs_coach_review"
  | "needs_data_quality_review"
  | "needs_sport_science_review";

export type ConstructorMatrixEvidenceClaimReviewQuestion = {
  id: string;
  track: ConstructorMatrixEvidenceClaimReviewTrack;
  question: string;
  requiredForFutureExtraction: boolean;
};

export type ConstructorMatrixEvidenceClaimReviewIntake = {
  id: string;
  blockerIds: readonly string[];
  sourceLookupIntakeIds: readonly string[];
  sourceCandidateIds: readonly string[];
  sourceExpansionBacklogIds: readonly string[];
  evidenceDependencyIds: readonly string[];
  dataDependencyIds: readonly string[];
  thresholdCandidateIds: readonly string[];
  reviewDecisionIds: readonly string[];
  tracks: readonly ConstructorMatrixEvidenceClaimReviewTrack[];
  status: ConstructorMatrixEvidenceClaimReviewIntakeStatus;
  title: string;
  blockerSummary: string;
  reviewerQuestions: readonly ConstructorMatrixEvidenceClaimReviewQuestion[];
  allowedOutcomes: readonly ConstructorMatrixEvidenceClaimReviewAllowedOutcome[];
  requiredArtifacts: readonly string[];
  prohibitedActions: readonly string[];
  nextAction: string;
  runtimeUseNow: "none" | "documentation_only" | "review_export_only";
  humanReviewed: false;
  reviewedBy?: never;
  reviewedAt?: never;
  runtimeChangeAllowedNow: false;
};

export interface ConstructorMatrixEvidenceClaimReviewIntakeSummary {
  evidenceClaimReviewIntakeCount: number;
  evidenceClaimReviewIntakeIds: readonly ConstructorMatrixEvidenceClaimReviewIntakeId[];
  reviewIntakesByStatus: Readonly<
    Record<ConstructorMatrixEvidenceClaimReviewIntakeStatus, number>
  >;
  reviewIntakesByTrack: Readonly<Record<ConstructorMatrixEvidenceClaimReviewTrack, number>>;
  manualVerificationIntakeCount: number;
  sourceTextNeededIntakeCount: number;
  humanReviewBeforeClaimsIntakeCount: number;
  blockersCoveredCount: number;
  evidenceClaimBlockerCount: number;
  runtimeChangeAllowedNowCount: number;
}

const REVIEW_INTAKE_STATUS_VALUES = [
  "pending_intake",
  "manual_verification_needed",
  "source_text_needed",
  "reviewer_assignment_needed",
  "blocked_for_claim_extraction",
  "ready_for_human_review_packet",
] as const satisfies readonly ConstructorMatrixEvidenceClaimReviewIntakeStatus[];

const REVIEW_TRACK_VALUES = [
  "manual_source_verification",
  "source_text_acquisition",
  "coach_review",
  "medical_review",
  "sport_science_review",
  "data_quality_review",
  "product_safety_review",
] as const satisfies readonly ConstructorMatrixEvidenceClaimReviewTrack[];

const HUMAN_REVIEW_TRACKS = [
  "coach_review",
  "medical_review",
  "sport_science_review",
  "data_quality_review",
  "product_safety_review",
] as const satisfies readonly ConstructorMatrixEvidenceClaimReviewTrack[];

const COMMON_REVIEW_QUESTIONS = [
  {
    id: "source_authority",
    track: "sport_science_review",
    question: "Is this source authoritative enough to support a future evidence claim?",
    requiredForFutureExtraction: true,
  },
  {
    id: "population_scope",
    track: "sport_science_review",
    question:
      "Does the source population match wrestling, combat-sport transfer, youth, female, or general athlete context?",
    requiredForFutureExtraction: true,
  },
  {
    id: "future_use_scope",
    track: "product_safety_review",
    question:
      "Should this remain blocked, review-export-only, or become eligible for a future extraction pass?",
    requiredForFutureExtraction: true,
  },
] as const satisfies readonly ConstructorMatrixEvidenceClaimReviewQuestion[];

const SOURCE_LOOKUP_BY_ID = new Map<string, ConstructorMatrixSourceLookupIntake>(
  CONSTRUCTOR_MATRIX_SOURCE_LOOKUP_INTAKE.map((item) => [item.id, item]),
);

const SOURCE_CANDIDATE_BY_ID = new Map<string, ConstructorMatrixSourceCandidate>(
  CONSTRUCTOR_MATRIX_SOURCE_CANDIDATES.map((item) => [item.id, item]),
);

function uniqueSorted<T extends string>(items: readonly T[]): T[] {
  return Array.from(new Set(items)).sort() as T[];
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

function reviewTrackFromSourceTrack(
  track: ConstructorMatrixSourceLookupReviewTrack | ConstructorMatrixSourceCandidateReviewTrack,
): ConstructorMatrixEvidenceClaimReviewTrack {
  if (track === "coach") {
    return "coach_review";
  }

  if (track === "medical") {
    return "medical_review";
  }

  if (track === "data_quality") {
    return "data_quality_review";
  }

  if (track === "product_safety") {
    return "product_safety_review";
  }

  return "sport_science_review";
}

function lookupsForBlocker(
  blocker: ConstructorMatrixEvidenceClaimBlocker,
): ConstructorMatrixSourceLookupIntake[] {
  return blocker.sourceLookupIntakeIds
    .map((id) => SOURCE_LOOKUP_BY_ID.get(id))
    .filter((item): item is ConstructorMatrixSourceLookupIntake => Boolean(item));
}

function candidatesForBlocker(
  blocker: ConstructorMatrixEvidenceClaimBlocker,
): ConstructorMatrixSourceCandidate[] {
  return blocker.sourceCandidateIds
    .map((id) => SOURCE_CANDIDATE_BY_ID.get(id))
    .filter((item): item is ConstructorMatrixSourceCandidate => Boolean(item));
}

function tracksForAffectedArea(area: string): ConstructorMatrixEvidenceClaimReviewTrack[] {
  if (area === "weight_cut") {
    return ["coach_review", "medical_review", "sport_science_review"];
  }

  if (area === "hydration") {
    return ["medical_review", "sport_science_review", "data_quality_review"];
  }

  if (area === "readiness") {
    return ["coach_review", "data_quality_review", "sport_science_review"];
  }

  if (area === "wearable_data") {
    return ["data_quality_review", "sport_science_review"];
  }

  if (area === "sleep" || area === "rhr" || area === "hrv") {
    return ["data_quality_review", "coach_review"];
  }

  if (area === "pain") {
    return ["coach_review", "medical_review"];
  }

  if (area === "injury") {
    return ["medical_review"];
  }

  if (area === "female_context") {
    return ["medical_review", "coach_review", "sport_science_review"];
  }

  if (area === "youth_context") {
    return ["coach_review", "medical_review", "product_safety_review"];
  }

  if (area === "travel_fatigue" || area === "competition_context") {
    return ["coach_review", "product_safety_review"];
  }

  if (area === "contact_load" || area === "lmv" || area === "taper") {
    return ["coach_review", "sport_science_review"];
  }

  if (area === "bfr_kaatsu") {
    return ["medical_review", "coach_review", "sport_science_review"];
  }

  if (area === "block_eligibility") {
    return ["coach_review", "product_safety_review"];
  }

  return [];
}

function statusForReason(
  reason: ConstructorMatrixEvidenceClaimBlockerReason,
): ConstructorMatrixEvidenceClaimReviewIntakeStatus {
  if (reason === "manual_verification_required") {
    return "manual_verification_needed";
  }

  if (reason === "needs_full_text_or_policy_text") {
    return "source_text_needed";
  }

  if (reason === "needs_human_review_before_claims") {
    return "reviewer_assignment_needed";
  }

  return "blocked_for_claim_extraction";
}

function allowedOutcomesForReason(
  reason: ConstructorMatrixEvidenceClaimBlockerReason,
): ConstructorMatrixEvidenceClaimReviewAllowedOutcome[] {
  if (reason === "manual_verification_required") {
    return [
      "source_verified_for_future_extraction",
      "source_rejected",
      "replacement_source_needed",
      "keep_blocked",
    ];
  }

  if (reason === "needs_full_text_or_policy_text") {
    return [
      "source_verified_for_future_extraction",
      "keep_blocked",
      "replacement_source_needed",
    ];
  }

  if (reason === "needs_human_review_before_claims") {
    return [
      "claim_extraction_ready_after_review",
      "keep_blocked",
      "do_not_automate",
      "needs_more_data",
    ];
  }

  return ["keep_blocked", "replacement_source_needed", "needs_more_data"];
}

function requiredArtifactsForReason(
  reason: ConstructorMatrixEvidenceClaimBlockerReason,
): readonly string[] {
  if (reason === "manual_verification_required") {
    return [
      "exact source identity",
      "official document or authoritative record",
      "citation metadata verification",
      "scope/population applicability note",
    ];
  }

  if (reason === "needs_full_text_or_policy_text") {
    return [
      "source text or official policy text",
      "relevant passage locator",
      "claim extraction note",
      "limitations/applicability note",
    ];
  }

  if (reason === "needs_human_review_before_claims") {
    return [
      "reviewer decision record",
      "rationale",
      "remaining limitations",
      "allowed future use scope",
    ];
  }

  return [
    "source readiness note",
    "blocker rationale",
    "remaining limitations",
    "future review scope",
  ];
}

function prohibitedActionsForReason(
  reason: ConstructorMatrixEvidenceClaimBlockerReason,
): readonly string[] {
  if (reason === "manual_verification_required") {
    return [
      "no claim extraction before manual verification",
      "no runtime promotion",
      "no fake citation completion",
    ];
  }

  if (reason === "needs_full_text_or_policy_text") {
    return [
      "no abstract-only claim if full/policy text is needed",
      "no numerical threshold extraction without review",
      "no runtime promotion",
    ];
  }

  if (reason === "needs_human_review_before_claims") {
    return [
      "no humanReviewed=true in code",
      "no fake approval",
      "no runtime promotion",
    ];
  }

  return [
    "no claim extraction while blocked",
    "no fake approval",
    "no runtime promotion",
  ];
}

function nextActionForReason(reason: ConstructorMatrixEvidenceClaimBlockerReason): string {
  if (reason === "manual_verification_required") {
    return "Collect authoritative source records and route them to manual source verification before any future extraction pass.";
  }

  if (reason === "needs_full_text_or_policy_text") {
    return "Acquire source text or official policy text, record passage location, and route the item to the listed reviewer tracks.";
  }

  if (reason === "needs_human_review_before_claims") {
    return "Assign the listed reviewer tracks and record a real reviewer decision outside code before any future extraction pass.";
  }

  return "Keep the blocker in review intake until source readiness and reviewer routing are clarified.";
}

function tracksForBlocker(
  blocker: ConstructorMatrixEvidenceClaimBlocker,
): ConstructorMatrixEvidenceClaimReviewTrack[] {
  const lookups = lookupsForBlocker(blocker);
  const candidates = candidatesForBlocker(blocker);
  const reasonTracks: ConstructorMatrixEvidenceClaimReviewTrack[] =
    blocker.reason === "manual_verification_required"
      ? ["manual_source_verification"]
      : blocker.reason === "needs_full_text_or_policy_text"
        ? ["source_text_acquisition"]
        : [];
  const sourceTracks: ConstructorMatrixEvidenceClaimReviewTrack[] = [
    ...lookups.flatMap((item) => item.reviewRequired.map(reviewTrackFromSourceTrack)),
    ...candidates.flatMap((item) => item.reviewTracks.map(reviewTrackFromSourceTrack)),
  ];
  const areaTracks: ConstructorMatrixEvidenceClaimReviewTrack[] =
    blocker.affectedAreas.flatMap(tracksForAffectedArea);
  const tracks = uniqueSorted([...reasonTracks, ...sourceTracks, ...areaTracks]);

  if (
    blocker.reason === "needs_human_review_before_claims" &&
    !tracks.some((track) => (HUMAN_REVIEW_TRACKS as readonly string[]).includes(track))
  ) {
    return [...tracks, "product_safety_review"];
  }

  return tracks;
}

function reviewerQuestionsForBlocker(
  blocker: ConstructorMatrixEvidenceClaimBlocker,
  tracks: readonly ConstructorMatrixEvidenceClaimReviewTrack[],
): ConstructorMatrixEvidenceClaimReviewQuestion[] {
  const primaryReviewTrack =
    tracks.find((track) => (HUMAN_REVIEW_TRACKS as readonly string[]).includes(track)) ??
    "product_safety_review";
  const questions: ConstructorMatrixEvidenceClaimReviewQuestion[] = [
    ...COMMON_REVIEW_QUESTIONS,
    {
      id: "source_support_type",
      track: primaryReviewTrack,
      question:
        "Does the source contain direct support, indirect support, or only background context?",
      requiredForFutureExtraction: true,
    },
  ];

  if (blocker.affectedAreas.includes("weight_cut") || blocker.affectedAreas.includes("hydration")) {
    questions.push({
      id: "medical_weight_hydration_scope",
      track: "medical_review",
      question:
        "Is medical review required before any weight-cut or hydration claim is extracted?",
      requiredForFutureExtraction: true,
    });
  }

  if (blocker.affectedAreas.includes("wearable_data") || blocker.affectedAreas.includes("readiness")) {
    questions.push({
      id: "data_fields_for_confidence",
      track: "data_quality_review",
      question:
        "What data fields are required before this can affect future risk-confidence wording?",
      requiredForFutureExtraction: true,
    });
  }

  if (
    blocker.affectedAreas.includes("pain") ||
    blocker.affectedAreas.includes("injury") ||
    blocker.affectedAreas.includes("female_context") ||
    blocker.affectedAreas.includes("youth_context") ||
    blocker.affectedAreas.includes("bfr_kaatsu")
  ) {
    questions.push({
      id: "do_not_automate_scope",
      track: "medical_review",
      question: "Should this remain do_not_automate for future constructor behavior?",
      requiredForFutureExtraction: true,
    });
  }

  return uniqueSorted(questions.map((item) => item.id)).map(
    (id) => questions.find((item) => item.id === id),
  ).filter((item): item is ConstructorMatrixEvidenceClaimReviewQuestion => Boolean(item));
}

function sourceExpansionBacklogIdsForBlocker(
  blocker: ConstructorMatrixEvidenceClaimBlocker,
): string[] {
  return uniqueSorted([
    ...lookupsForBlocker(blocker).flatMap((item) => item.sourceExpansionBacklogIds),
    ...candidatesForBlocker(blocker).flatMap((item) => item.linkedSourceExpansionBacklogIds),
  ]);
}

function evidenceDependencyIdsForBlocker(
  blocker: ConstructorMatrixEvidenceClaimBlocker,
): string[] {
  return uniqueSorted([
    ...lookupsForBlocker(blocker).flatMap((item) => item.linkedEvidenceDependencyIds),
    ...candidatesForBlocker(blocker).flatMap((item) => item.linkedEvidenceDependencyIds),
  ]);
}

function dataDependencyIdsForBlocker(
  blocker: ConstructorMatrixEvidenceClaimBlocker,
): string[] {
  return uniqueSorted([
    ...lookupsForBlocker(blocker).flatMap((item) => item.linkedDataDependencyIds),
    ...candidatesForBlocker(blocker).flatMap((item) => item.linkedDataDependencyIds),
  ]);
}

function thresholdCandidateIdsForBlocker(
  blocker: ConstructorMatrixEvidenceClaimBlocker,
): string[] {
  return uniqueSorted([
    ...lookupsForBlocker(blocker).flatMap((item) => item.linkedThresholdCandidateIds),
    ...candidatesForBlocker(blocker).flatMap((item) => item.linkedThresholdCandidateIds),
  ]);
}

function reviewDecisionIdsForBlocker(
  blocker: ConstructorMatrixEvidenceClaimBlocker,
): string[] {
  return uniqueSorted([
    ...lookupsForBlocker(blocker).flatMap((item) => item.linkedReviewDecisionIds),
    ...candidatesForBlocker(blocker).flatMap((item) => item.linkedReviewDecisionIds),
  ]);
}

function titleForBlocker(blocker: ConstructorMatrixEvidenceClaimBlocker): string {
  if (blocker.reason === "manual_verification_required") {
    return `Manual source verification intake for ${blocker.id}`;
  }

  if (blocker.reason === "needs_full_text_or_policy_text") {
    return `Source text acquisition intake for ${blocker.id}`;
  }

  if (blocker.reason === "needs_human_review_before_claims") {
    return `Human review routing intake for ${blocker.id}`;
  }

  return `Evidence claim blocker intake for ${blocker.id}`;
}

function blockerSummary(blocker: ConstructorMatrixEvidenceClaimBlocker): string {
  return [
    `Evidence claim blocker ${blocker.id} remains blocked for reason ${blocker.reason}.`,
    `Affected areas: ${blocker.affectedAreas.join(", ")}.`,
    "This intake asks reviewers what artifacts are needed before a future extraction pass.",
  ].join(" ");
}

function buildReviewIntake(
  blocker: ConstructorMatrixEvidenceClaimBlocker,
): ConstructorMatrixEvidenceClaimReviewIntake {
  const tracks = tracksForBlocker(blocker);

  return {
    id: `review_intake_${blocker.id}`,
    blockerIds: [blocker.id],
    sourceLookupIntakeIds: blocker.sourceLookupIntakeIds,
    sourceCandidateIds: blocker.sourceCandidateIds,
    sourceExpansionBacklogIds: sourceExpansionBacklogIdsForBlocker(blocker),
    evidenceDependencyIds: evidenceDependencyIdsForBlocker(blocker),
    dataDependencyIds: dataDependencyIdsForBlocker(blocker),
    thresholdCandidateIds: thresholdCandidateIdsForBlocker(blocker),
    reviewDecisionIds: reviewDecisionIdsForBlocker(blocker),
    tracks,
    status: statusForReason(blocker.reason),
    title: titleForBlocker(blocker),
    blockerSummary: blockerSummary(blocker),
    reviewerQuestions: reviewerQuestionsForBlocker(blocker, tracks),
    allowedOutcomes: allowedOutcomesForReason(blocker.reason),
    requiredArtifacts: requiredArtifactsForReason(blocker.reason),
    prohibitedActions: prohibitedActionsForReason(blocker.reason),
    nextAction: nextActionForReason(blocker.reason),
    runtimeUseNow: "none",
    humanReviewed: false,
    runtimeChangeAllowedNow: false,
  };
}

export const CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES =
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS.map(
    buildReviewIntake,
  ) satisfies readonly ConstructorMatrixEvidenceClaimReviewIntake[];

export type ConstructorMatrixEvidenceClaimReviewIntakeId =
  (typeof CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES)[number]["id"];

export const CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKE_IDS =
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES.map((item) => item.id);

const CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKE_ID_SET = new Set<string>(
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKE_IDS,
);

const CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKE_LOOKUP = new Map<
  string,
  ConstructorMatrixEvidenceClaimReviewIntake
>(
  CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES.map((item) => [item.id, item]),
);

export function listConstructorMatrixEvidenceClaimReviewIntakeIds(): string[] {
  return [...CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKE_IDS];
}

export function getConstructorMatrixEvidenceClaimReviewIntake(
  id: string,
): ConstructorMatrixEvidenceClaimReviewIntake | null {
  return CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKE_LOOKUP.get(id) ?? null;
}

export function validateConstructorMatrixEvidenceClaimReviewIntakeIds(
  ids: readonly string[],
): { ok: boolean; missing: string[] } {
  const missing = ids.filter(
    (id) => !CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKE_ID_SET.has(id),
  );

  return {
    ok: missing.length === 0,
    missing,
  };
}

export function buildConstructorMatrixEvidenceClaimReviewIntakeSummary():
  ConstructorMatrixEvidenceClaimReviewIntakeSummary {
  const coveredBlockerIds = new Set(
    CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES.flatMap((item) => item.blockerIds),
  );

  return {
    evidenceClaimReviewIntakeCount:
      CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES.length,
    evidenceClaimReviewIntakeIds: listConstructorMatrixEvidenceClaimReviewIntakeIds(),
    reviewIntakesByStatus: countBy(
      REVIEW_INTAKE_STATUS_VALUES,
      CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES.map((item) => item.status),
    ),
    reviewIntakesByTrack: countBy(
      REVIEW_TRACK_VALUES,
      CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES.flatMap((item) => item.tracks),
    ),
    manualVerificationIntakeCount:
      CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES.filter(
        (item) => item.status === "manual_verification_needed",
      ).length,
    sourceTextNeededIntakeCount:
      CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES.filter(
        (item) => item.status === "source_text_needed",
      ).length,
    humanReviewBeforeClaimsIntakeCount:
      CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES.filter(
        (item) => item.status === "reviewer_assignment_needed",
      ).length,
    blockersCoveredCount: coveredBlockerIds.size,
    evidenceClaimBlockerCount: CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_BLOCKERS.length,
    runtimeChangeAllowedNowCount:
      CONSTRUCTOR_MATRIX_EVIDENCE_CLAIM_REVIEW_INTAKES.filter(
        (item) => item.runtimeChangeAllowedNow,
      ).length,
  };
}
