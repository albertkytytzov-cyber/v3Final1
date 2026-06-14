import type { ConstructorDraft, ConstructorPlanBlock } from "./constructor-core";

export type ConstructorMatrixPilotQualityStatus =
  | "allowed"
  | "fallback"
  | "blocked"
  | "review_required";

export type ConstructorMatrixPilotQualityLogEntry = {
  scenarioId: string;
  generatedPlanSource: "matrix_primary_pilot" | "matrix_internal" | "legacy_fallback";
  status: ConstructorMatrixPilotQualityStatus;
  exerciseCount: number;
  reviewRequiredCount: number;
  blockedHighRiskCount: number;
  coachEditableLoadCount: number;
  missingDataWarningCount: number;
  evidenceFamilyCoverage: readonly string[];
  saveAssignGateStatus: "allowed" | "blocked" | "not_evaluated";
  qualityNotes: readonly string[];
  noPii: true;
  noProductionAthleteId: true;
  runtimeBehaviorChanged: false;
};

export type ConstructorMatrixPilotQualityLogInput = {
  scenarioId: string;
  generatedPlanSource: ConstructorMatrixPilotQualityLogEntry["generatedPlanSource"];
  status: ConstructorMatrixPilotQualityStatus;
  draft: ConstructorDraft;
  evidenceFamilyCoverage?: readonly string[];
  saveAssignGateStatus?: ConstructorMatrixPilotQualityLogEntry["saveAssignGateStatus"];
  qualityNotes?: readonly string[];
};

function draftBlocks(draft: ConstructorDraft): ConstructorPlanBlock[] {
  return draft.plan.weeks.flatMap((week) =>
    week.days.flatMap((day) =>
      (day.sessions ?? []).flatMap((session) => session.blocks),
    ),
  );
}

function blockHasHighRiskFlag(block: ConstructorPlanBlock) {
  const text = [
    block.name,
    block.type,
    block.targetQuality,
    block.volume,
    ...block.riskFlags,
    ...block.evidenceRefs,
    ...block.localLoadZones,
  ].join(" ");

  return /weight|hydration|weigh|injury|pain|RED-S|BFR|KAATSU|youth/i.test(text);
}

function blockRequiresReview(block: ConstructorPlanBlock) {
  const text = [
    block.name,
    block.volume,
    ...block.riskFlags,
    ...block.evidenceRefs,
    ...block.localLoadZones,
  ].join(" ");

  return /review|required|blocked|fallback|medical|coach/i.test(text);
}

export function buildConstructorMatrixPilotQualityLogEntry(
  input: ConstructorMatrixPilotQualityLogInput,
): ConstructorMatrixPilotQualityLogEntry {
  const blocks = draftBlocks(input.draft);
  const exercises = blocks.flatMap((block) => block.exercises ?? []);
  const missingDataWarningCount = input.draft.selectedCards.filter((card) =>
    /missing|data|readiness|sleep|rhr|hrv/i.test(`${card.id} ${card.title} ${card.rationale}`),
  ).length;

  return {
    scenarioId: input.scenarioId,
    generatedPlanSource: input.generatedPlanSource,
    status: input.status,
    exerciseCount: exercises.length,
    reviewRequiredCount: blocks.filter(blockRequiresReview).length,
    blockedHighRiskCount: blocks.filter(blockHasHighRiskFlag).length,
    coachEditableLoadCount: blocks.filter((block) => block.coachEditable && !block.volumeLocked).length,
    missingDataWarningCount,
    evidenceFamilyCoverage: input.evidenceFamilyCoverage ?? [],
    saveAssignGateStatus: input.saveAssignGateStatus ?? "not_evaluated",
    qualityNotes: input.qualityNotes ?? [],
    noPii: true,
    noProductionAthleteId: true,
    runtimeBehaviorChanged: false,
  };
}

function countBy<T extends string>(
  values: readonly T[],
): Readonly<Record<T, number>> {
  const counts = Object.create(null) as Record<T, number>;

  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }

  return counts;
}

export function buildConstructorMatrixPilotQualityLogSummary(
  entries: readonly ConstructorMatrixPilotQualityLogEntry[],
) {
  return {
    scenarioCount: entries.length,
    byStatus: countBy(entries.map((item) => item.status)),
    byGeneratedPlanSource: countBy(entries.map((item) => item.generatedPlanSource)),
    totalExerciseCount: entries.reduce((sum, item) => sum + item.exerciseCount, 0),
    totalReviewRequiredCount: entries.reduce((sum, item) => sum + item.reviewRequiredCount, 0),
    totalBlockedHighRiskCount: entries.reduce((sum, item) => sum + item.blockedHighRiskCount, 0),
    totalCoachEditableLoadCount: entries.reduce((sum, item) => sum + item.coachEditableLoadCount, 0),
    allNoPii: entries.every((item) => item.noPii),
    allNoProductionAthleteId: entries.every((item) => item.noProductionAthleteId),
    runtimeBehaviorChanged: false,
  };
}
