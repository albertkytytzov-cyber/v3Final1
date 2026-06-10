import type {
  ConstructorDraft,
  ConstructorInput,
  ConstructorPlanBlock,
} from "./constructor-core";
import { buildPerformConstructorDraft } from "./constructor-core";
import type {
  MatrixDrivenBuilderOptions,
  MatrixDrivenRiskCheckResult,
} from "./constructor-matrix-plan-builder";
import type { MatrixDrivenConstructorDraft } from "./constructor-matrix-adapter";
import { buildMatrixDrivenConstructorDraft } from "./constructor-matrix-adapter";

export type ConstructorDraftDifferenceSeverity =
  | "info"
  | "expected_difference"
  | "warning"
  | "error";

export type ConstructorDraftDifferenceCategory =
  | "structure"
  | "phase"
  | "week_type"
  | "day_type"
  | "sessions"
  | "blocks"
  | "volume"
  | "risks"
  | "explanations"
  | "legacy_template_dependency"
  | "matrix_safety"
  | "output_contract";

export interface ConstructorDraftComparisonOptions {
  matrixOptions?: MatrixDrivenBuilderOptions;
  includeInfo?: boolean;
}

export interface ConstructorDraftDifference {
  category: ConstructorDraftDifferenceCategory;
  severity: ConstructorDraftDifferenceSeverity;
  message: string;
  legacyValue?: string | number | boolean | null;
  matrixValue?: string | number | boolean | null;
  affected?: {
    weekNumber?: number;
    dayNumber?: number;
    sessionName?: string;
    blockType?: string;
  };
}

export interface ConstructorDraftSafetyInvariant {
  code:
    | "matrix_generated_marker"
    | "matrix_has_structure"
    | "no_legacy_template_used_as_structure"
    | "no_fixed_template_structural_source"
    | "no_development_near_main_start"
    | "no_heavy_lmv_near_main_start"
    | "no_heavy_strength_near_start"
    | "no_control_bouts_near_start"
    | "no_heavy_travel_load"
    | "no_heavy_weigh_in_load"
    | "competition_day_has_start"
    | "post_competition_has_recovery"
    | "matrix_explanations_present";
  severity: "warning" | "error";
  explanation: string;
}

export interface ConstructorDraftSafetyInvariantResult extends ConstructorDraftSafetyInvariant {
  passed: boolean;
  affected?: ConstructorDraftDifference["affected"];
}

export interface ConstructorDraftComparisonSummary {
  safeToPreview: boolean;
  legacyDefaultUnchanged: boolean;
  totalDifferences: number;
  errorCount: number;
  warningCount: number;
  expectedDifferenceCount: number;
  headline: string;
  topDifferences: ConstructorDraftDifference[];
}

export interface ConstructorDraftComparisonReport {
  generatedFrom: "legacy_matrix_comparison";
  legacyDraft: ConstructorDraft;
  matrixDraft: MatrixDrivenConstructorDraft;
  inputSummary: {
    competitionName: string;
    daysUntilStart: number | null;
    isMainStart: boolean;
  };
  differences: ConstructorDraftDifference[];
  matrixSafetyInvariants: ConstructorDraftSafetyInvariantResult[];
  legacyDefaultInvariants: ConstructorDraftSafetyInvariantResult[];
  summary: ConstructorDraftComparisonSummary;
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function flattenedDays(draft: ConstructorDraft) {
  return draft.plan.weeks.flatMap((week) => week.days);
}

function flattenedSessions(draft: ConstructorDraft) {
  return flattenedDays(draft).flatMap((day) => day.sessions ?? []);
}

function flattenedBlocks(draft: ConstructorDraft) {
  return flattenedSessions(draft).flatMap((session) => session.blocks);
}

function matrixBlockType(block: ConstructorPlanBlock) {
  const marker = block.localLoadZones.find((zone) => zone.startsWith("matrix:"));

  return marker ? marker.slice("matrix:".length) : null;
}

function matrixBlockTypes(draft: MatrixDrivenConstructorDraft) {
  return new Set(
    flattenedBlocks(draft)
      .map(matrixBlockType)
      .filter((value): value is string => Boolean(value)),
  );
}

function draftHasText(draft: ConstructorDraft, pattern: RegExp) {
  const texts = [
    draft.understood.mainTask,
    draft.understood.interpretation,
    draft.understood.limitation,
    draft.explanation.mainDecision,
    draft.explanation.whyNow,
    draft.explanation.testsImpact,
    draft.explanation.riskImpact,
    draft.explanation.evidenceSummary,
    ...draft.plan.weeks.flatMap((week) => [
      week.title,
      week.mainIntent,
      ...week.days.flatMap((day) => [
        day.dayLabel,
        day.dayIntent,
        day.readinessGate,
        ...(day.sessions ?? []).flatMap((session) => [
          session.name,
          session.notes,
          ...session.blocks.flatMap((block) => [
            block.name,
            block.volume,
            block.energySystem,
            ...block.localLoadZones,
            ...block.evidenceRefs,
          ]),
        ]),
      ]),
    ]),
  ];

  return texts.some((text) => pattern.test(String(text)));
}

function daysUntilStartForInput(input: ConstructorInput) {
  const strategyDays = input.seasonStrategy?.currentWindow.daysToStart;

  if (typeof strategyDays === "number" && Number.isFinite(strategyDays)) {
    return Math.round(strategyDays);
  }

  return typeof input.context.cycleLengthDays === "number"
    ? Math.round(input.context.cycleLengthDays)
    : null;
}

function isMainStartInput(input: ConstructorInput) {
  return (
    input.seasonStrategy?.targetCompetition.role === "main_peak" ||
    input.competition.priority === "A" ||
    ["continental", "world", "olympics"].includes(input.competition.level)
  );
}

function inputSummary(input: ConstructorInput) {
  return {
    competitionName: input.competition.name,
    daysUntilStart: daysUntilStartForInput(input),
    isMainStart: isMainStartInput(input),
  };
}

function invariant(
  params: ConstructorDraftSafetyInvariant & {
    passed: boolean;
    affected?: ConstructorDraftDifference["affected"];
  },
): ConstructorDraftSafetyInvariantResult {
  return params;
}

export function assertMatrixDraftSafetyInvariants(
  matrixDraft: MatrixDrivenConstructorDraft,
  input: ConstructorInput,
): ConstructorDraftSafetyInvariantResult[] {
  const summary = inputSummary(input);
  const blockTypes = matrixBlockTypes(matrixDraft);
  const riskCodes = new Set(matrixDraft.matrix.riskChecks.map((risk) => risk.code));
  const closeMainStart = summary.isMainStart && summary.daysUntilStart !== null && summary.daysUntilStart <= 30;
  const closeToStart = summary.daysUntilStart !== null && summary.daysUntilStart <= 14;
  const hasCompetitionDay = matrixDraft.matrix.draft.weeks.some((week) =>
    week.days.some((day) => day.flags.competition),
  );
  const hasPostCompetitionDay = matrixDraft.matrix.draft.weeks.some((week) =>
    week.days.some((day) => day.flags.postCompetition),
  );
  const hasTravelDay = matrixDraft.matrix.draft.weeks.some((week) =>
    week.days.some((day) => day.flags.travel),
  );
  const hasWeighInDay = matrixDraft.matrix.draft.weeks.some((week) =>
    week.days.some((day) => day.flags.weighIn),
  );

  return [
    invariant({
      code: "matrix_generated_marker",
      severity: "error",
      passed: matrixDraft.generatedFrom === "matrix" && matrixDraft.matrix.draft.generatedFrom === "matrix",
      explanation: "Matrix draft must carry an explicit generatedFrom=matrix marker.",
    }),
    invariant({
      code: "matrix_has_structure",
      severity: "error",
      passed:
        matrixDraft.plan.weeks.length > 0 &&
        flattenedDays(matrixDraft).length > 0 &&
        flattenedSessions(matrixDraft).length > 0,
      explanation: "Matrix constructor draft must contain weeks, days and sessions.",
    }),
    invariant({
      code: "no_legacy_template_used_as_structure",
      severity: "error",
      passed: !riskCodes.has("legacy_template_used_as_structure") && matrixDraft.matrix.legacyCards.usedAsStructure === false,
      explanation: "Legacy cards may be metadata/content hints only, not structural controllers.",
    }),
    invariant({
      code: "no_fixed_template_structural_source",
      severity: "error",
      passed: matrixDraft.selectedCards.every((card) => /metadata|content/i.test(card.rationale)),
      explanation: "SelectedCards in matrix path must describe metadata/content source only.",
    }),
    invariant({
      code: "no_development_near_main_start",
      severity: "error",
      passed: !closeMainStart || !blockTypes.has("leg_lmv"),
      explanation: "Development blocks are forbidden inside the close main-start window.",
      affected: blockTypes.has("leg_lmv") ? { blockType: "leg_lmv" } : undefined,
    }),
    invariant({
      code: "no_heavy_lmv_near_main_start",
      severity: "error",
      passed: !closeMainStart || !blockTypes.has("leg_lmv"),
      explanation: "Heavy leg LMV is forbidden near the main start.",
      affected: blockTypes.has("leg_lmv") ? { blockType: "leg_lmv" } : undefined,
    }),
    invariant({
      code: "no_heavy_strength_near_start",
      severity: "error",
      passed: !closeToStart || !flattenedBlocks(matrixDraft).some((block) => /strength|силов/i.test(block.energySystem)),
      explanation: "Heavy strength must not appear near the start.",
    }),
    invariant({
      code: "no_control_bouts_near_start",
      severity: "error",
      passed: !closeToStart || !blockTypes.has("mat_control_bouts"),
      explanation: "Control bouts must be rejected close to the start.",
      affected: blockTypes.has("mat_control_bouts") ? { blockType: "mat_control_bouts" } : undefined,
    }),
    invariant({
      code: "no_heavy_travel_load",
      severity: "error",
      passed:
        !hasTravelDay ||
        matrixDraft.matrix.draft.weeks
          .flatMap((week) => week.days)
          .filter((day) => day.flags.travel)
          .every((day) => day.sessions.every((session) => session.volume.loadLevel === "very_low" || session.volume.loadLevel === "low")),
      explanation: "Travel days must stay light.",
    }),
    invariant({
      code: "no_heavy_weigh_in_load",
      severity: "error",
      passed:
        !hasWeighInDay ||
        matrixDraft.matrix.draft.weeks
          .flatMap((week) => week.days)
          .filter((day) => day.flags.weighIn)
          .every((day) => day.sessions.every((session) => session.volume.loadLevel === "very_low" || session.volume.loadLevel === "low")),
      explanation: "Weigh-in days must stay short and light.",
    }),
    invariant({
      code: "competition_day_has_start",
      severity: "error",
      passed: !hasCompetitionDay || blockTypes.has("competition_start"),
      explanation: "Competition day must use competition_start instead of ordinary training.",
    }),
    invariant({
      code: "post_competition_has_recovery",
      severity: "error",
      passed:
        !hasPostCompetitionDay ||
        blockTypes.has("post_competition_recovery") ||
        blockTypes.has("recovery"),
      explanation: "Post-competition day must use recovery or post-competition recovery.",
    }),
    invariant({
      code: "matrix_explanations_present",
      severity: "warning",
      passed:
        matrixDraft.matrix.explanationCount > 0 &&
        draftHasText(matrixDraft, /matrix|главный старт|дорог|взвеш|recovery|подвод/i),
      explanation: "Matrix path must expose explanations for major decisions.",
    }),
  ];
}

export function assertLegacyDefaultUnchanged(
  input: ConstructorInput,
): ConstructorDraftSafetyInvariantResult[] {
  const legacyDraft = buildPerformConstructorDraft(input);

  return [
    invariant({
      code: "matrix_has_structure",
      severity: "error",
      passed:
        legacyDraft.plan.weeks.length > 0 &&
        flattenedDays(legacyDraft).length > 0 &&
        Boolean(legacyDraft.explanation.mainDecision),
      explanation: "Default legacy constructor call must still return a stable constructor-shaped draft.",
    }),
    invariant({
      code: "matrix_generated_marker",
      severity: "error",
      passed: !("generatedFrom" in legacyDraft),
      explanation: "Default buildPerformConstructorDraft(input) must not become matrix automatically.",
    }),
    invariant({
      code: "no_fixed_template_structural_source",
      severity: "warning",
      passed: legacyDraft.selectedCards.length > 0,
      explanation: "Legacy path may still expose selected template cards as part of its existing behavior.",
    }),
  ];
}

function addDifference(
  differences: ConstructorDraftDifference[],
  difference: ConstructorDraftDifference,
  includeInfo: boolean,
) {
  if (difference.severity === "info" && !includeInfo) {
    return;
  }

  differences.push(difference);
}

function countSessions(draft: ConstructorDraft) {
  return flattenedSessions(draft).length;
}

function countBlocks(draft: ConstructorDraft) {
  return flattenedBlocks(draft).length;
}

function matrixRiskCodes(matrixDraft: MatrixDrivenConstructorDraft) {
  return unique(matrixDraft.matrix.riskChecks.map((risk: MatrixDrivenRiskCheckResult) => risk.code));
}

export function buildConstructorDraftComparisonReport(
  legacyDraft: ConstructorDraft,
  matrixDraft: MatrixDrivenConstructorDraft,
  input: ConstructorInput,
  options?: ConstructorDraftComparisonOptions,
): ConstructorDraftComparisonReport {
  const includeInfo = options?.includeInfo === true;
  const differences: ConstructorDraftDifference[] = [];
  const matrixSafetyInvariants = assertMatrixDraftSafetyInvariants(matrixDraft, input);
  const legacyDefaultInvariants = assertLegacyDefaultUnchanged(input);
  const legacyDayCount = flattenedDays(legacyDraft).length;
  const matrixDayCount = flattenedDays(matrixDraft).length;
  const legacySessionCount = countSessions(legacyDraft);
  const matrixSessionCount = countSessions(matrixDraft);
  const legacyBlockCount = countBlocks(legacyDraft);
  const matrixBlockCount = countBlocks(matrixDraft);

  addDifference(
    differences,
    {
      category: "structure",
      severity: legacyDraft.plan.weeks.length === matrixDraft.plan.weeks.length ? "info" : "expected_difference",
      message: "Week count comparison.",
      legacyValue: legacyDraft.plan.weeks.length,
      matrixValue: matrixDraft.plan.weeks.length,
    },
    includeInfo,
  );
  addDifference(
    differences,
    {
      category: "sessions",
      severity: legacySessionCount === matrixSessionCount ? "info" : "expected_difference",
      message: "Session density can differ because matrix uses day/session eligibility instead of fixed template weeks.",
      legacyValue: legacySessionCount,
      matrixValue: matrixSessionCount,
    },
    includeInfo,
  );
  addDifference(
    differences,
    {
      category: "blocks",
      severity: legacyBlockCount === matrixBlockCount ? "info" : "expected_difference",
      message: "Block count can differ because matrix selects eligible blocks, not template day contents.",
      legacyValue: legacyBlockCount,
      matrixValue: matrixBlockCount,
    },
    includeInfo,
  );
  addDifference(
    differences,
    {
      category: "legacy_template_dependency",
      severity: "expected_difference",
      message: "Legacy path may use selectedCards as structure; matrix path keeps legacy cards as metadata/content hints only.",
      legacyValue: legacyDraft.selectedCards.length,
      matrixValue: matrixDraft.matrix.legacyCards.usedAsStructure,
    },
    includeInfo,
  );

  if (legacyDayCount !== matrixDayCount) {
    addDifference(
      differences,
      {
        category: "structure",
        severity: "warning",
        message: "Legacy and matrix cover different day counts; this should be reviewed before rollout.",
        legacyValue: legacyDayCount,
        matrixValue: matrixDayCount,
      },
      includeInfo,
    );
  }

  if (matrixDraft.riskFlags.length === 0 || matrixDraft.matrix.riskChecks.length === 0) {
    addDifference(
      differences,
      {
        category: "risks",
        severity: "warning",
        message: "Matrix risk output is empty; safety checks may be too quiet for preview.",
        legacyValue: legacyDraft.riskFlags.length,
        matrixValue: matrixDraft.matrix.riskChecks.length,
      },
      includeInfo,
    );
  }

  if (!draftHasText(matrixDraft, /matrix|главный старт|подвод|дорог|взвеш|recovery/i)) {
    addDifference(
      differences,
      {
        category: "explanations",
        severity: "warning",
        message: "Matrix explanations do not mention enough planning context.",
        matrixValue: matrixDraft.matrix.explanationCount,
      },
      includeInfo,
    );
  }

  for (const result of matrixSafetyInvariants) {
    if (!result.passed) {
      addDifference(
        differences,
        {
          category: "matrix_safety",
          severity: result.severity,
          message: `${result.code}: ${result.explanation}`,
          affected: result.affected,
        },
        includeInfo,
      );
    }
  }

  for (const result of legacyDefaultInvariants) {
    if (!result.passed) {
      addDifference(
        differences,
        {
          category: "output_contract",
          severity: result.severity,
          message: `${result.code}: ${result.explanation}`,
          affected: result.affected,
        },
        includeInfo,
      );
    }
  }

  if (matrixRiskCodes(matrixDraft).length > 0) {
    addDifference(
      differences,
      {
        category: "risks",
        severity: "info",
        message: `Matrix risk checks present: ${matrixRiskCodes(matrixDraft).join(", ")}.`,
        legacyValue: legacyDraft.riskFlags.length,
        matrixValue: matrixDraft.matrix.riskChecks.length,
      },
      includeInfo,
    );
  }

  const reportWithoutSummary = {
    generatedFrom: "legacy_matrix_comparison" as const,
    legacyDraft,
    matrixDraft,
    inputSummary: inputSummary(input),
    differences,
    matrixSafetyInvariants,
    legacyDefaultInvariants,
  };

  return {
    ...reportWithoutSummary,
    summary: summarizeConstructorDraftDifferences(reportWithoutSummary),
  };
}

export function compareLegacyAndMatrixConstructorDrafts(
  input: ConstructorInput,
  options?: ConstructorDraftComparisonOptions,
): ConstructorDraftComparisonReport {
  const legacyDraft = buildPerformConstructorDraft(input);
  const matrixDraft = buildMatrixDrivenConstructorDraft(input, options?.matrixOptions);

  return buildConstructorDraftComparisonReport(legacyDraft, matrixDraft, input, options);
}

export function summarizeConstructorDraftDifferences(
  report: Omit<ConstructorDraftComparisonReport, "summary">,
): ConstructorDraftComparisonSummary {
  const errorCount = report.differences.filter((item) => item.severity === "error").length;
  const warningCount = report.differences.filter((item) => item.severity === "warning").length;
  const expectedDifferenceCount = report.differences.filter((item) => item.severity === "expected_difference").length;
  const legacyDefaultUnchanged = report.legacyDefaultInvariants.every((item) => item.passed);
  const matrixSafe = report.matrixSafetyInvariants.every((item) => item.passed || item.severity !== "error");
  const safeToPreview = errorCount === 0 && matrixSafe && legacyDefaultUnchanged;

  return {
    safeToPreview,
    legacyDefaultUnchanged,
    totalDifferences: report.differences.length,
    errorCount,
    warningCount,
    expectedDifferenceCount,
    headline: safeToPreview
      ? "Matrix draft is safe for internal preview; differences are expected due to matrix-driven block selection."
      : "Matrix draft needs review before preview because one or more safety or contract invariants failed.",
    topDifferences: report.differences
      .filter((item) => item.severity !== "info")
      .slice(0, 5),
  };
}
