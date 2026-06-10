import type { ConstructorDraft, ConstructorInput } from "./constructor-core";
import { buildPerformConstructorDraft } from "./constructor-core";
import type { MatrixDrivenConstructorDraft } from "./constructor-matrix-adapter";
import { buildMatrixDrivenConstructorDraft } from "./constructor-matrix-adapter";
import type { ConstructorComparisonPreviewOptions } from "./constructor-matrix-preview";
import { buildConstructorComparisonPreview } from "./constructor-matrix-preview";
import type { MatrixDrivenBuilderOptions, MatrixDrivenRiskCode } from "./constructor-matrix-plan-builder";

export type MatrixConstructorRolloutMode =
  | "legacy_only"
  | "preview_only"
  | "matrix_allowed_for_internal"
  | "matrix_allowed_for_primary"
  | "blocked";

export type MatrixConstructorRolloutScenario =
  | "far_development_week"
  | "post_competition_recovery"
  | "travel_day"
  | "weigh_in_day"
  | "secondary_start_preview"
  | "main_start_d28_preview"
  | "main_start_d21_preview"
  | "main_start_d10_preview"
  | "main_start_d3_preview"
  | "competition_day_preview"
  | "unknown"
  | "unsafe";

export type MatrixConstructorRolloutBlockerCode =
  | "matrix_safety_error"
  | "legacy_default_changed"
  | "comparison_error"
  | "forbidden_risk_code"
  | "legacy_template_used_as_structure"
  | "main_start_too_close_for_primary"
  | "competition_day_primary_not_enabled"
  | "missing_required_explanation"
  | "unknown_scenario"
  | "not_allowlisted"
  | "explicitly_disabled"
  | "input_mutation_detected";

export interface MatrixConstructorRolloutBlocker {
  code: MatrixConstructorRolloutBlockerCode;
  severity: "info" | "warning" | "error";
  message: string;
  details?: string[];
}

export interface MatrixConstructorRolloutPreviewSummary {
  headline: string;
  daysUntilStart: number | null;
  isMainStart: boolean;
  safeToPreview: boolean;
  defaultPathUnchanged: boolean;
  matrixSafetyPassed: boolean;
  legacyDefaultGuardPassed: boolean;
  errorCount: number;
  warningCount: number;
  expectedDifferenceCount: number;
}

export interface MatrixConstructorRolloutExplanation {
  headline: string;
  reasons: string[];
  nextStep: string;
}

export type MatrixConstructorRolloutRecommendedAction =
  | "use_legacy_default"
  | "show_preview_only"
  | "allow_internal_matrix_primary"
  | "allow_matrix_primary"
  | "block_matrix";

export interface MatrixConstructorRolloutOptions {
  previewOptions?: ConstructorComparisonPreviewOptions;
  disabled?: boolean;
  disabledReason?: string;
  forbiddenRiskCodes?: MatrixDrivenRiskCode[];
  primaryAllowlist?: MatrixConstructorRolloutScenario[];
  internalAllowlist?: MatrixConstructorRolloutScenario[];
  previewAllowlist?: MatrixConstructorRolloutScenario[];
}

export interface MatrixConstructorRolloutDecision {
  generatedFrom: "matrix_constructor_rollout_decision";
  generatedAt: string;
  mode: MatrixConstructorRolloutMode;
  scenario: MatrixConstructorRolloutScenario;
  allowlisted: boolean;
  safeToPreview: boolean;
  defaultPathUnchanged: boolean;
  matrixPrimaryAllowed: boolean;
  blockers: MatrixConstructorRolloutBlocker[];
  previewSummary: MatrixConstructorRolloutPreviewSummary | null;
  explanation: MatrixConstructorRolloutExplanation;
  recommendedAction: MatrixConstructorRolloutRecommendedAction;
}

export interface MatrixConstructorDraftIfAllowedOptions extends MatrixConstructorRolloutOptions {
  fallbackToLegacy?: boolean;
  requirePrimaryAllowed?: boolean;
  allowedModes?: MatrixConstructorRolloutMode[];
  matrixOptions?: MatrixDrivenBuilderOptions;
}

export interface MatrixConstructorDraftIfAllowedResult {
  generatedFrom: "matrix_constructor_draft_if_allowed";
  decision: MatrixConstructorRolloutDecision;
  source: "matrix" | "legacy_fallback" | "blocked";
  draft: MatrixDrivenConstructorDraft | ConstructorDraft | null;
  blocked: boolean;
  reason: string;
}

const DEFAULT_PRIMARY_ALLOWLIST: MatrixConstructorRolloutScenario[] = [
  "far_development_week",
  "post_competition_recovery",
  "main_start_d28_preview",
  "main_start_d21_preview",
  "main_start_d10_preview",
];

const DEFAULT_INTERNAL_ALLOWLIST: MatrixConstructorRolloutScenario[] = [
  "travel_day",
  "weigh_in_day",
];

const DEFAULT_PREVIEW_ALLOWLIST: MatrixConstructorRolloutScenario[] = [
  "secondary_start_preview",
  "main_start_d3_preview",
  "competition_day_preview",
];

const DEFAULT_FORBIDDEN_RISK_CODES: MatrixDrivenRiskCode[] = [
  "legacy_template_used_as_structure",
];

function stableJson(value: unknown) {
  return JSON.stringify(value);
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function previewMatrixDraft(preview: ReturnType<typeof buildConstructorComparisonPreview>) {
  return preview.matrixDraft ?? preview.comparisonReport?.matrixDraft ?? null;
}

function previewDaysUntilStart(
  input: ConstructorInput,
  preview?: ReturnType<typeof buildConstructorComparisonPreview>,
) {
  const fromPreview = preview?.comparisonReport?.inputSummary.daysUntilStart;

  if (typeof fromPreview === "number" && Number.isFinite(fromPreview)) {
    return Math.round(fromPreview);
  }

  const fromStrategy = input.seasonStrategy?.currentWindow.daysToStart;

  if (typeof fromStrategy === "number" && Number.isFinite(fromStrategy)) {
    return Math.round(fromStrategy);
  }

  if (typeof input.context.cycleLengthDays === "number" && Number.isFinite(input.context.cycleLengthDays)) {
    return Math.round(input.context.cycleLengthDays);
  }

  return null;
}

function previewIsMainStart(
  input: ConstructorInput,
  preview?: ReturnType<typeof buildConstructorComparisonPreview>,
) {
  const fromPreview = preview?.comparisonReport?.inputSummary.isMainStart;

  if (typeof fromPreview === "boolean") {
    return fromPreview;
  }

  return (
    input.seasonStrategy?.targetCompetition.role === "main_peak" ||
    input.competition.priority === "A" ||
    ["continental", "world", "olympics"].includes(input.competition.level)
  );
}

function matrixDays(preview?: ReturnType<typeof buildConstructorComparisonPreview>) {
  const draft = preview ? previewMatrixDraft(preview) : null;

  return draft?.matrix.draft.weeks.flatMap((week) => week.days) ?? [];
}

function matrixRiskCodes(preview?: ReturnType<typeof buildConstructorComparisonPreview>) {
  const draft = preview ? previewMatrixDraft(preview) : null;

  return new Set(draft?.matrix.riskChecks.map((risk) => risk.code) ?? []);
}

function collectStrings(value: unknown, output: string[] = []) {
  if (typeof value === "string") {
    output.push(value);
    return output;
  }

  if (!value || typeof value !== "object") {
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, output);
    }

    return output;
  }

  for (const item of Object.values(value)) {
    collectStrings(item, output);
  }

  return output;
}

function previewText(preview?: ReturnType<typeof buildConstructorComparisonPreview>) {
  if (!preview) {
    return "";
  }

  return collectStrings({
    summary: preview.summary,
    safety: preview.safety,
    warnings: preview.warnings,
    notes: preview.notes,
    matrixDraft: previewMatrixDraft(preview),
    comparisonReport: preview.comparisonReport,
  }).join("\n");
}

function hasAnyText(preview: ReturnType<typeof buildConstructorComparisonPreview> | undefined, pattern: RegExp) {
  return pattern.test(previewText(preview));
}

function hasHardLoadOnFlaggedDay(
  preview: ReturnType<typeof buildConstructorComparisonPreview> | undefined,
  flag: "travel" | "weighIn",
) {
  return matrixDays(preview)
    .filter((day) => day.flags[flag])
    .some((day) =>
      day.sessions.some((session) =>
        session.selectedBlocks.some((block) => block.volume.loadLevel === "medium" || block.volume.loadLevel === "high"),
      ),
    );
}

function hasMatrixSafetyError(preview?: ReturnType<typeof buildConstructorComparisonPreview>) {
  return Boolean(
    !preview?.safety.matrixSafetyPassed ||
      preview?.safetyInvariants?.some((item) => !item.passed && item.severity === "error"),
  );
}

function hasComparisonError(preview?: ReturnType<typeof buildConstructorComparisonPreview>) {
  return Boolean(
    (preview?.summary.errorCount ?? 0) > 0 ||
      preview?.comparisonReport?.differences.some((item) => item.severity === "error"),
  );
}

function scenarioInList(
  scenario: MatrixConstructorRolloutScenario,
  list: MatrixConstructorRolloutScenario[],
) {
  return list.includes(scenario);
}

function primaryAllowlist(options?: MatrixConstructorRolloutOptions) {
  return options?.primaryAllowlist ?? DEFAULT_PRIMARY_ALLOWLIST;
}

function internalAllowlist(options?: MatrixConstructorRolloutOptions) {
  return options?.internalAllowlist ?? DEFAULT_INTERNAL_ALLOWLIST;
}

function previewAllowlist(options?: MatrixConstructorRolloutOptions) {
  return options?.previewAllowlist ?? DEFAULT_PREVIEW_ALLOWLIST;
}

function isHardBlocker(blocker: MatrixConstructorRolloutBlocker) {
  return blocker.severity === "error";
}

function buildPreviewSummary(
  input: ConstructorInput,
  preview?: ReturnType<typeof buildConstructorComparisonPreview>,
): MatrixConstructorRolloutPreviewSummary | null {
  if (!preview) {
    return null;
  }

  return {
    headline: preview.summary.headline,
    daysUntilStart: previewDaysUntilStart(input, preview),
    isMainStart: previewIsMainStart(input, preview),
    safeToPreview: preview.safeToPreview,
    defaultPathUnchanged: preview.defaultPathUnchanged,
    matrixSafetyPassed: preview.safety.matrixSafetyPassed,
    legacyDefaultGuardPassed: preview.safety.legacyDefaultGuardPassed,
    errorCount: preview.summary.errorCount,
    warningCount: preview.summary.warningCount,
    expectedDifferenceCount: preview.summary.expectedDifferenceCount,
  };
}

function recommendedActionForMode(mode: MatrixConstructorRolloutMode): MatrixConstructorRolloutRecommendedAction {
  switch (mode) {
    case "blocked":
      return "block_matrix";
    case "preview_only":
      return "show_preview_only";
    case "matrix_allowed_for_internal":
      return "allow_internal_matrix_primary";
    case "matrix_allowed_for_primary":
      return "allow_matrix_primary";
    case "legacy_only":
    default:
      return "use_legacy_default";
  }
}

export function classifyConstructorRolloutScenario(
  input: ConstructorInput,
  preview?: ReturnType<typeof buildConstructorComparisonPreview>,
): MatrixConstructorRolloutScenario {
  if (preview && (!preview.safeToPreview || hasMatrixSafetyError(preview) || hasComparisonError(preview))) {
    return "unsafe";
  }

  const days = previewDaysUntilStart(input, preview);
  const isMainStart = previewIsMainStart(input, preview);
  const cycleLengthDays =
    input.seasonStrategy?.currentWindow.cycleLengthDays ?? input.context.cycleLengthDays;
  const shortFocusedWindow = cycleLengthDays <= 2;
  const daysList = matrixDays(preview);
  const hasTravelDay = daysList.some((day) => day.flags.travel) || Boolean(input.competition.travelRequired);
  const hasWeighInDay = daysList.some((day) => day.flags.weighIn);
  const hasCompetitionDay = daysList.some((day) => day.flags.competition) || days === 0;
  const hasPostCompetitionDay =
    daysList.some((day) => day.flags.postCompetition) ||
    input.context.currentPhase === "recovery" ||
    (days !== null && days < 0);

  if (hasPostCompetitionDay) {
    return "post_competition_recovery";
  }

  if (hasCompetitionDay && days === 0) {
    return "competition_day_preview";
  }

  if (hasTravelDay && shortFocusedWindow) {
    return "travel_day";
  }

  if (hasWeighInDay && shortFocusedWindow && days !== null && days <= 1) {
    return "weigh_in_day";
  }

  if (isMainStart && days !== null) {
    if (days <= 3) return "main_start_d3_preview";
    if (days <= 10) return "main_start_d10_preview";
    if (days <= 21) return "main_start_d21_preview";
    if (days <= 30) return "main_start_d28_preview";
  }

  if (!isMainStart && days !== null && days <= 30) {
    return "secondary_start_preview";
  }

  if (
    days !== null &&
    days >= 60 &&
    !hasTravelDay &&
    !hasWeighInDay &&
    !hasCompetitionDay &&
    ["base", "development"].includes(input.context.currentPhase)
  ) {
    return "far_development_week";
  }

  return "unknown";
}

export function isMatrixScenarioAllowlisted(
  scenario: MatrixConstructorRolloutScenario,
  input: ConstructorInput,
  preview?: ReturnType<typeof buildConstructorComparisonPreview>,
  options?: MatrixConstructorRolloutOptions,
) {
  void input;
  void preview;

  return (
    scenarioInList(scenario, primaryAllowlist(options)) ||
    scenarioInList(scenario, internalAllowlist(options)) ||
    scenarioInList(scenario, previewAllowlist(options))
  );
}

export function getMatrixRolloutBlockers(
  input: ConstructorInput,
  preview?: ReturnType<typeof buildConstructorComparisonPreview>,
  options?: MatrixConstructorRolloutOptions,
): MatrixConstructorRolloutBlocker[] {
  const blockers: MatrixConstructorRolloutBlocker[] = [];
  const scenario = classifyConstructorRolloutScenario(input, preview);
  const riskCodes = matrixRiskCodes(preview);
  const forbiddenRiskCodes = new Set(options?.forbiddenRiskCodes ?? DEFAULT_FORBIDDEN_RISK_CODES);

  if (options?.disabled) {
    blockers.push({
      code: "explicitly_disabled",
      severity: "error",
      message: options.disabledReason ?? "Matrix constructor rollout gate is explicitly disabled.",
    });
  }

  if (hasMatrixSafetyError(preview)) {
    blockers.push({
      code: "matrix_safety_error",
      severity: "error",
      message: "Matrix safety invariant failed; matrix output must not be used.",
      details: preview?.safetyInvariants
        ?.filter((item) => !item.passed)
        .map((item) => `${item.code}: ${item.explanation}`),
    });
  }

  if (preview && !preview.defaultPathUnchanged) {
    blockers.push({
      code: "legacy_default_changed",
      severity: "error",
      message: "Legacy default path guard failed; rollout is blocked until buildPerformConstructorDraft remains unchanged.",
    });
  }

  if (hasComparisonError(preview)) {
    blockers.push({
      code: "comparison_error",
      severity: "error",
      message: "Legacy/matrix comparison contains errors, so rollout is blocked.",
      details: preview?.comparisonReport?.differences
        .filter((item) => item.severity === "error")
        .map((item) => `${item.category}: ${item.message}`),
    });
  }

  for (const code of riskCodes) {
    if (forbiddenRiskCodes.has(code)) {
      blockers.push({
        code: code === "legacy_template_used_as_structure" ? "legacy_template_used_as_structure" : "forbidden_risk_code",
        severity: "error",
        message: `Forbidden matrix risk code is present: ${code}.`,
      });
    }
  }

  const matrixDraft = preview ? previewMatrixDraft(preview) : null;
  if (matrixDraft?.matrix.legacyCards.usedAsStructure) {
    blockers.push({
      code: "legacy_template_used_as_structure",
      severity: "error",
      message: "Legacy cards were used as structure; matrix rollout requires metadata/content-only legacy cards.",
    });
  }

  if (scenario === "travel_day" && hasHardLoadOnFlaggedDay(preview, "travel")) {
    blockers.push({
      code: "matrix_safety_error",
      severity: "error",
      message: "Travel-day matrix scenario still contains medium/high load.",
    });
  }

  if (scenario === "weigh_in_day" && hasHardLoadOnFlaggedDay(preview, "weighIn")) {
    blockers.push({
      code: "matrix_safety_error",
      severity: "error",
      message: "Weigh-in matrix scenario still contains medium/high load.",
    });
  }

  if (
    scenario === "travel_day" &&
    !hasAnyText(preview, /travel|дорог|логист/i)
  ) {
    blockers.push({
      code: "missing_required_explanation",
      severity: "error",
      message: "Travel scenario must explain logistics/travel constraints.",
    });
  }

  if (
    scenario === "weigh_in_day" &&
    !hasAnyText(preview, /взвеш|weight|вес/i)
  ) {
    blockers.push({
      code: "missing_required_explanation",
      severity: "error",
      message: "Weigh-in scenario must explain weight-control constraints.",
    });
  }

  if (
    scenario === "far_development_week" &&
    !hasAnyText(preview, /развит|development|matrix/i)
  ) {
    blockers.push({
      code: "missing_required_explanation",
      severity: "error",
      message: "Far development scenario must explain why development is allowed.",
    });
  }

  if (scenario === "unknown") {
    blockers.push({
      code: "unknown_scenario",
      severity: "warning",
      message: "Rollout scenario could not be classified into the initial matrix allowlist.",
    });
  }

  if (!isMatrixScenarioAllowlisted(scenario, input, preview, options)) {
    blockers.push({
      code: "not_allowlisted",
      severity: "warning",
      message: `Scenario ${scenario} is not allowlisted for matrix rollout.`,
    });
  }

  if (
    scenario === "main_start_d3_preview"
  ) {
    blockers.push({
      code: "main_start_too_close_for_primary",
      severity: "warning",
      message: "Close main-start scenarios are preview-only until coach feedback confirms the matrix path.",
    });
  }

  if (scenario === "competition_day_preview") {
    blockers.push({
      code: "competition_day_primary_not_enabled",
      severity: "warning",
      message: "Competition day remains preview-only in the initial rollout gate.",
    });
  }

  return blockers;
}

export function buildMatrixRolloutDecisionExplanation(
  decision: Pick<
    MatrixConstructorRolloutDecision,
    "mode" | "scenario" | "blockers" | "safeToPreview" | "defaultPathUnchanged" | "matrixPrimaryAllowed"
  >,
): MatrixConstructorRolloutExplanation {
  const hardBlockers = decision.blockers.filter(isHardBlocker);
  const reasons = [
    `Scenario: ${decision.scenario}.`,
    `Preview safety: ${decision.safeToPreview ? "green" : "not green"}.`,
    `Legacy default path: ${decision.defaultPathUnchanged ? "unchanged" : "changed"}.`,
  ];

  if (decision.matrixPrimaryAllowed) {
    reasons.push("Matrix primary is allowed only for this explicit allowlisted scenario.");
  }

  if (hardBlockers.length > 0) {
    reasons.push(`Hard blockers: ${hardBlockers.map((item) => item.code).join(", ")}.`);
  } else if (decision.blockers.length > 0) {
    reasons.push(`Advisory blockers: ${decision.blockers.map((item) => item.code).join(", ")}.`);
  } else {
    reasons.push("No rollout blockers were found.");
  }

  switch (decision.mode) {
    case "matrix_allowed_for_primary":
      return {
        headline: "Matrix primary is allowed for this explicitly allowlisted low-risk scenario.",
        reasons,
        nextStep: "Use matrix only through an explicit internal/helper path; do not change the legacy default route.",
      };
    case "matrix_allowed_for_internal":
      return {
        headline: "Matrix can be used internally, but not as the primary production result.",
        reasons,
        nextStep: "Keep this scenario in internal QA until enough real feedback is collected.",
      };
    case "preview_only":
      return {
        headline: "Matrix is safe enough to preview, but not allowed as primary.",
        reasons,
        nextStep: "Show side-by-side preview only and keep legacy as the default generated plan.",
      };
    case "blocked":
      return {
        headline: "Matrix rollout is blocked for this input.",
        reasons,
        nextStep: "Use the legacy constructor and fix blockers before any matrix preview/primary use.",
      };
    case "legacy_only":
    default:
      return {
        headline: "Use the legacy constructor for this input.",
        reasons,
        nextStep: "Keep matrix disabled unless the scenario is added to the controlled allowlist.",
      };
  }
}

export function decideMatrixConstructorRollout(
  input: ConstructorInput,
  options?: MatrixConstructorRolloutOptions,
): MatrixConstructorRolloutDecision {
  const inputSnapshot = stableJson(input);
  let preview: ReturnType<typeof buildConstructorComparisonPreview> | undefined;
  let buildError: Error | null = null;

  try {
    preview = buildConstructorComparisonPreview(input, {
      includeDrafts: true,
      includeComparisonReport: true,
      includeSafetyDetails: true,
      explanationDepth: "detailed",
      ...(options?.previewOptions ?? {}),
    });
  } catch (error) {
    buildError = error as Error;
  }

  const scenario = preview
    ? classifyConstructorRolloutScenario(input, preview)
    : "unknown";
  const blockers = preview
    ? getMatrixRolloutBlockers(input, preview, options)
    : [
        {
          code: "comparison_error" as const,
          severity: "error" as const,
          message: buildError?.message ?? "Matrix comparison preview could not be built.",
        },
      ];

  if (stableJson(input) !== inputSnapshot) {
    blockers.push({
      code: "input_mutation_detected",
      severity: "error",
      message: "Rollout decision detected input mutation while building the preview.",
    });
  }

  const hardBlocked = blockers.some(isHardBlocker);
  const allowlisted =
    !hardBlocked && isMatrixScenarioAllowlisted(scenario, input, preview, options);
  const safeToPreview = Boolean(preview?.safeToPreview);
  let mode: MatrixConstructorRolloutMode;

  if (hardBlocked || scenario === "unsafe") {
    mode = "blocked";
  } else if (scenarioInList(scenario, primaryAllowlist(options))) {
    mode = "matrix_allowed_for_primary";
  } else if (scenarioInList(scenario, internalAllowlist(options))) {
    mode = "matrix_allowed_for_internal";
  } else if (scenarioInList(scenario, previewAllowlist(options))) {
    mode = "preview_only";
  } else {
    mode = "legacy_only";
  }

  const decisionBase = {
    generatedFrom: "matrix_constructor_rollout_decision" as const,
    generatedAt: new Date().toISOString(),
    mode,
    scenario,
    allowlisted,
    safeToPreview,
    defaultPathUnchanged: Boolean(preview?.defaultPathUnchanged),
    matrixPrimaryAllowed: mode === "matrix_allowed_for_primary",
    blockers,
    previewSummary: buildPreviewSummary(input, preview),
    recommendedAction: recommendedActionForMode(mode),
  };

  return {
    ...decisionBase,
    explanation: buildMatrixRolloutDecisionExplanation(decisionBase),
  };
}

export function buildMatrixConstructorDraftIfAllowed(
  input: ConstructorInput,
  options?: MatrixConstructorDraftIfAllowedOptions,
): MatrixConstructorDraftIfAllowedResult {
  const fallbackToLegacy = options?.fallbackToLegacy ?? true;
  const requirePrimaryAllowed = options?.requirePrimaryAllowed ?? false;
  const allowedModes = options?.allowedModes ?? ["matrix_allowed_for_primary"];
  const decision = decideMatrixConstructorRollout(input, options);
  const allowed =
    decision.matrixPrimaryAllowed &&
    allowedModes.includes(decision.mode);

  if (allowed) {
    return {
      generatedFrom: "matrix_constructor_draft_if_allowed",
      decision,
      source: "matrix",
      draft: buildMatrixDrivenConstructorDraft(
        input,
        options?.matrixOptions ?? options?.previewOptions?.matrixOptions,
      ),
      blocked: false,
      reason: "Matrix draft was allowed by the controlled rollout gate.",
    };
  }

  if (fallbackToLegacy && !requirePrimaryAllowed) {
    return {
      generatedFrom: "matrix_constructor_draft_if_allowed",
      decision,
      source: "legacy_fallback",
      draft: buildPerformConstructorDraft(input),
      blocked: false,
      reason: "Matrix draft was not primary-allowed; returned legacy fallback.",
    };
  }

  return {
    generatedFrom: "matrix_constructor_draft_if_allowed",
    decision,
    source: "blocked",
    draft: null,
    blocked: true,
    reason: "Matrix draft is blocked by the controlled rollout gate.",
  };
}

export const MATRIX_CONSTRUCTOR_ROLLOUT_PRIMARY_ALLOWLIST = [
  ...DEFAULT_PRIMARY_ALLOWLIST,
];

export const MATRIX_CONSTRUCTOR_ROLLOUT_INTERNAL_ALLOWLIST = [
  ...DEFAULT_INTERNAL_ALLOWLIST,
];

export const MATRIX_CONSTRUCTOR_ROLLOUT_PREVIEW_ALLOWLIST = [
  ...DEFAULT_PREVIEW_ALLOWLIST,
];

export const MATRIX_CONSTRUCTOR_ROLLOUT_FORBIDDEN_RISK_CODES = unique([
  ...DEFAULT_FORBIDDEN_RISK_CODES,
]);
