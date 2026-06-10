import type { ConstructorInput } from "./constructor-core";
import type { ConstructorMatrixPreviewResponse } from "./constructor-matrix-preview";
import { buildConstructorMatrixPreviewResponse } from "./constructor-matrix-preview";
import type {
  MatrixConstructorRolloutDecision,
  MatrixConstructorRolloutOptions,
  MatrixConstructorRolloutScenario,
} from "./constructor-matrix-rollout";
import { decideMatrixConstructorRollout } from "./constructor-matrix-rollout";

export type MatrixPilotReadinessStatus =
  | "ready_for_internal_pilot"
  | "ready_for_limited_primary_pilot"
  | "internal_only"
  | "preview_only"
  | "blocked"
  | "needs_review";

export type MatrixPilotReadinessScenario = MatrixConstructorRolloutScenario;

export type MatrixPilotReadinessChecklistItemStatus =
  | "pass"
  | "warning"
  | "fail"
  | "not_applicable";

export type MatrixPilotReadinessChecklistItemSeverity = "info" | "warning" | "error";

export type MatrixPilotReadinessChecklistItemId =
  | "legacy_default_guard_passed"
  | "matrix_safety_passed"
  | "no_comparison_errors"
  | "no_legacy_template_as_structure"
  | "scenario_allowlisted"
  | "scenario_fixture_covered"
  | "review_export_available"
  | "no_pii_required"
  | "close_main_start_policy_respected"
  | "logistics_load_is_light"
  | "production_route_unchanged"
  | "no_db_write_required"
  | "manual_qa_required";

export interface MatrixPilotReadinessChecklistItem {
  id: MatrixPilotReadinessChecklistItemId;
  label: string;
  status: MatrixPilotReadinessChecklistItemStatus;
  severity: MatrixPilotReadinessChecklistItemSeverity;
  explanation: string;
  evidence: string[];
}

export interface MatrixPilotReadinessBlocker {
  id: string;
  severity: MatrixPilotReadinessChecklistItemSeverity;
  message: string;
  evidence: string[];
}

interface MatrixPilotFixtureCoverage {
  covered: boolean;
  expectationsPassed: boolean;
  note: string;
}

export interface MatrixPilotReadinessOptions {
  rolloutOptions?: MatrixConstructorRolloutOptions;
  reviewExportAvailable?: boolean;
  noPiiRequired?: boolean;
  productionRouteUnchanged?: boolean;
  noDbWriteRequired?: boolean;
  manualQaRequired?: boolean;
  fixtureCoverage?: Partial<
    Record<MatrixPilotReadinessScenario, Partial<MatrixPilotFixtureCoverage>>
  >;
}

export interface MatrixPilotReadinessSummary {
  status: MatrixPilotReadinessStatus;
  scenario: MatrixPilotReadinessScenario;
  blockerCount: number;
  checklistCounts: Record<MatrixPilotReadinessChecklistItemStatus, number>;
}

export interface MatrixPilotReadinessResult {
  generatedFrom: "matrix_constructor_pilot_readiness";
  generatedAt: string;
  status: MatrixPilotReadinessStatus;
  scenario: MatrixPilotReadinessScenario;
  rolloutMode: MatrixConstructorRolloutDecision["mode"];
  matrixPrimaryAllowed: boolean;
  recommendedAction: MatrixConstructorRolloutDecision["recommendedAction"];
  checklist: MatrixPilotReadinessChecklistItem[];
  blockers: MatrixPilotReadinessBlocker[];
  summary: MatrixPilotReadinessSummary;
  notes: string[];
}

const LIMITED_PRIMARY_PILOT_SCENARIOS = new Set<MatrixPilotReadinessScenario>([
  "far_development_week",
  "post_competition_recovery",
  "main_start_d28_preview",
  "main_start_d21_preview",
  "main_start_d10_preview",
  "main_start_d4_start_window",
]);

const INTERNAL_PILOT_SCENARIOS = new Set<MatrixPilotReadinessScenario>([
  "travel_day",
  "weigh_in_day",
]);

const PREVIEW_ONLY_SCENARIOS = new Set<MatrixPilotReadinessScenario>([
  "secondary_start_preview",
  "main_start_d3_preview",
  "competition_day_preview",
]);

const DEFAULT_FIXTURE_COVERAGE: Record<MatrixPilotReadinessScenario, MatrixPilotFixtureCoverage> = {
  far_development_week: {
    covered: true,
    expectationsPassed: true,
    note: "Covered by preview-regression fixture far_development_week_d90.",
  },
  post_competition_recovery: {
    covered: true,
    expectationsPassed: true,
    note: "Covered by preview-regression fixture post_competition_day.",
  },
  travel_day: {
    covered: true,
    expectationsPassed: true,
    note: "Covered by preview-regression fixture travel_day.",
  },
  weigh_in_day: {
    covered: true,
    expectationsPassed: true,
    note: "Covered by preview-regression fixture weigh_in_day.",
  },
  secondary_start_preview: {
    covered: true,
    expectationsPassed: true,
    note: "Covered by preview-regression fixture secondary_start_d10.",
  },
  main_start_d28_preview: {
    covered: true,
    expectationsPassed: true,
    note: "Covered by preview-regression fixture main_start_d28_special_pre_competition.",
  },
  main_start_d21_preview: {
    covered: true,
    expectationsPassed: true,
    note: "Covered by preview-regression fixture main_start_d21_controlled_volume.",
  },
  main_start_d10_preview: {
    covered: true,
    expectationsPassed: true,
    note: "Covered by preview-regression fixture main_start_d10_taper.",
  },
  main_start_d4_start_window: {
    covered: true,
    expectationsPassed: true,
    note: "Covered by preview-regression fixture main_start_d4_start_window.",
  },
  main_start_d3_preview: {
    covered: true,
    expectationsPassed: true,
    note: "Covered by preview-regression fixture main_start_d3_final_activation.",
  },
  competition_day_preview: {
    covered: true,
    expectationsPassed: true,
    note: "Covered by preview-regression fixture competition_day.",
  },
  unknown: {
    covered: false,
    expectationsPassed: false,
    note: "Unknown scenario is intentionally not fixture-covered for pilot readiness.",
  },
  unsafe: {
    covered: false,
    expectationsPassed: false,
    note: "Unsafe scenario is intentionally blocked and not pilot-covered.",
  },
};

function checklistCounts(checklist: MatrixPilotReadinessChecklistItem[]) {
  return checklist.reduce<Record<MatrixPilotReadinessChecklistItemStatus, number>>(
    (counts, item) => {
      counts[item.status] += 1;
      return counts;
    },
    {
      pass: 0,
      warning: 0,
      fail: 0,
      not_applicable: 0,
    },
  );
}

function item(params: MatrixPilotReadinessChecklistItem): MatrixPilotReadinessChecklistItem {
  return params;
}

function hasComparisonError(preview: ConstructorMatrixPreviewResponse) {
  return (
    (preview.comparisonReport?.differences.some((difference) => difference.severity === "error") ??
      false) ||
    preview.summary.errorCount > 0
  );
}

function hasSafetyError(preview: ConstructorMatrixPreviewResponse) {
  return (
    preview.safety.errorCount > 0 ||
    (preview.safetyInvariants?.some(
      (invariant) => !invariant.passed && invariant.severity === "error",
    ) ??
      false) ||
    (preview.legacyDefaultGuard?.some(
      (invariant) => !invariant.passed && invariant.severity === "error",
    ) ??
      false)
  );
}

function matrixDraft(preview: ConstructorMatrixPreviewResponse) {
  return preview.matrixDraft ?? preview.comparisonReport?.matrixDraft ?? null;
}

function hasLegacyTemplateAsStructure(preview: ConstructorMatrixPreviewResponse) {
  return Boolean(matrixDraft(preview)?.matrix.legacyCards.usedAsStructure);
}

function hasHeavyLogisticsLoad(preview: ConstructorMatrixPreviewResponse) {
  const flaggedDays =
    matrixDraft(preview)?.matrix.draft.weeks.flatMap((week) =>
      week.days.filter((day) => day.flags.travel || day.flags.weighIn),
    ) ?? [];

  return flaggedDays.some((day) =>
    day.sessions.some((session) =>
      session.selectedBlocks.some(
        (block) => block.volume.loadLevel === "medium" || block.volume.loadLevel === "high",
      ),
    ),
  );
}

function mergedCoverage(
  scenario: MatrixPilotReadinessScenario,
  options?: MatrixPilotReadinessOptions,
): MatrixPilotFixtureCoverage {
  return {
    ...DEFAULT_FIXTURE_COVERAGE[scenario],
    ...options?.fixtureCoverage?.[scenario],
  };
}

function isCloseMainOrCompetitionScenario(scenario: MatrixPilotReadinessScenario) {
  return PREVIEW_ONLY_SCENARIOS.has(scenario);
}

function hasErrorChecklistFailure(checklist: MatrixPilotReadinessChecklistItem[]) {
  return checklist.some((item) => item.status === "fail" && item.severity === "error");
}

function hasNonManualWarning(checklist: MatrixPilotReadinessChecklistItem[]) {
  return checklist.some(
    (item) => item.status === "warning" && item.id !== "manual_qa_required",
  );
}

function readinessBlockersFrom(
  checklist: MatrixPilotReadinessChecklistItem[],
  rolloutDecision: MatrixConstructorRolloutDecision,
): MatrixPilotReadinessBlocker[] {
  const checklistBlockers = checklist
    .filter(
      (item) =>
        item.status === "fail" ||
        (item.status === "warning" && item.severity !== "info"),
    )
    .map((item) => ({
      id: item.id,
      severity: item.severity,
      message: item.explanation,
      evidence: item.evidence,
    }));
  const rolloutBlockers = rolloutDecision.blockers.map((blocker) => ({
    id: blocker.code,
    severity: blocker.severity,
    message: blocker.message,
    evidence: blocker.details ?? [],
  }));

  return [...checklistBlockers, ...rolloutBlockers];
}

export function classifyMatrixPilotReadinessScenario(
  input: ConstructorInput,
  rolloutDecision?: MatrixConstructorRolloutDecision | null,
): MatrixPilotReadinessScenario {
  return (rolloutDecision ?? decideMatrixConstructorRollout(input)).scenario;
}

export function buildMatrixPilotReadinessChecklist(
  input: ConstructorInput,
  preview: ConstructorMatrixPreviewResponse,
  rolloutDecision: MatrixConstructorRolloutDecision,
  options?: MatrixPilotReadinessOptions,
): MatrixPilotReadinessChecklistItem[] {
  const scenario = classifyMatrixPilotReadinessScenario(input, rolloutDecision);
  const coverage = mergedCoverage(scenario, options);
  const comparisonError = hasComparisonError(preview);
  const safetyError = hasSafetyError(preview);
  const legacyTemplateAsStructure = hasLegacyTemplateAsStructure(preview);
  const closeMainPolicyRelevant = isCloseMainOrCompetitionScenario(scenario);
  const closeMainPolicyRespected =
    !closeMainPolicyRelevant ||
    (!rolloutDecision.matrixPrimaryAllowed &&
      (rolloutDecision.mode === "preview_only" || rolloutDecision.mode === "legacy_only"));
  const logisticsRelevant = INTERNAL_PILOT_SCENARIOS.has(scenario);
  const heavyLogisticsLoad = hasHeavyLogisticsLoad(preview);
  const reviewExportAvailable = options?.reviewExportAvailable ?? true;
  const noPiiRequired = options?.noPiiRequired ?? true;
  const productionRouteUnchanged = options?.productionRouteUnchanged ?? true;
  const noDbWriteRequired = options?.noDbWriteRequired ?? true;
  const manualQaRequired = options?.manualQaRequired ?? true;

  return [
    item({
      id: "legacy_default_guard_passed",
      label: "Legacy default guard passed",
      status: preview.defaultPathUnchanged && preview.safety.legacyDefaultGuardPassed ? "pass" : "fail",
      severity: "error",
      explanation: preview.defaultPathUnchanged
        ? "Legacy constructor remains the unchanged default path."
        : "Legacy default guard failed; matrix cannot enter pilot.",
      evidence: [
        `defaultPathUnchanged=${preview.defaultPathUnchanged}`,
        `legacyDefaultGuardPassed=${preview.safety.legacyDefaultGuardPassed}`,
      ],
    }),
    item({
      id: "matrix_safety_passed",
      label: "Matrix safety passed",
      status: preview.safeToPreview && preview.safety.matrixSafetyPassed && !safetyError ? "pass" : "fail",
      severity: "error",
      explanation: safetyError
        ? "Matrix safety invariants contain errors."
        : "Matrix safety invariants are green for preview.",
      evidence: [
        `safeToPreview=${preview.safeToPreview}`,
        `matrixSafetyPassed=${preview.safety.matrixSafetyPassed}`,
        `safetyErrorCount=${preview.safety.errorCount}`,
      ],
    }),
    item({
      id: "no_comparison_errors",
      label: "No comparison errors",
      status: comparisonError ? "fail" : "pass",
      severity: "error",
      explanation: comparisonError
        ? "Legacy/matrix comparison contains error-level differences."
        : "No error-level comparison differences were detected.",
      evidence: [
        `summary.errorCount=${preview.summary.errorCount}`,
        `comparison.errors=${
          preview.comparisonReport?.differences.filter((difference) => difference.severity === "error")
            .length ?? 0
        }`,
      ],
    }),
    item({
      id: "no_legacy_template_as_structure",
      label: "No legacy template as structure",
      status: legacyTemplateAsStructure ? "fail" : "pass",
      severity: "error",
      explanation: legacyTemplateAsStructure
        ? "Matrix draft used legacy cards as structure."
        : "Legacy cards are not used as matrix structure.",
      evidence: [`usedAsStructure=${legacyTemplateAsStructure}`],
    }),
    item({
      id: "scenario_allowlisted",
      label: "Scenario allowlisted",
      status: rolloutDecision.allowlisted ? "pass" : "fail",
      severity: rolloutDecision.scenario === "unknown" || rolloutDecision.scenario === "unsafe" ? "error" : "warning",
      explanation: rolloutDecision.allowlisted
        ? "Scenario is present in the controlled rollout allowlist for its current mode."
        : "Scenario is not allowlisted for matrix pilot readiness.",
      evidence: [
        `scenario=${rolloutDecision.scenario}`,
        `mode=${rolloutDecision.mode}`,
        `allowlisted=${rolloutDecision.allowlisted}`,
      ],
    }),
    item({
      id: "scenario_fixture_covered",
      label: "Scenario fixture covered",
      status: coverage.covered && coverage.expectationsPassed ? "pass" : "warning",
      severity: "warning",
      explanation:
        coverage.covered && coverage.expectationsPassed
          ? "Scenario has static fixture coverage and fixture expectations are expected to pass."
          : "Scenario is missing confirmed fixture coverage and needs manual review.",
      evidence: [
        `covered=${coverage.covered}`,
        `expectationsPassed=${coverage.expectationsPassed}`,
        coverage.note,
      ],
    }),
    item({
      id: "review_export_available",
      label: "Review export available",
      status: reviewExportAvailable ? "pass" : "warning",
      severity: "warning",
      explanation: reviewExportAvailable
        ? "Internal review export exists for manual coach/QA feedback."
        : "Internal review export is not available, so pilot feedback cannot be packaged.",
      evidence: [`reviewExportAvailable=${reviewExportAvailable}`],
    }),
    item({
      id: "no_pii_required",
      label: "No PII required",
      status: noPiiRequired ? "pass" : "fail",
      severity: "error",
      explanation: noPiiRequired
        ? "Pilot readiness can be reviewed without personal identifiers or notes."
        : "Pilot readiness would require personal data and must be blocked.",
      evidence: [`noPiiRequired=${noPiiRequired}`],
    }),
    item({
      id: "close_main_start_policy_respected",
      label: "Close main-start policy respected",
      status: closeMainPolicyRelevant
        ? closeMainPolicyRespected
          ? "pass"
          : "fail"
        : "not_applicable",
      severity: "error",
      explanation: closeMainPolicyRelevant
        ? closeMainPolicyRespected
          ? "Close main-start or competition-day scenario remains preview-only/non-primary."
          : "Close main-start or competition-day scenario attempted primary rollout."
        : "Scenario is not a close main-start or competition-day preview scenario.",
      evidence: [
        `scenario=${scenario}`,
        `mode=${rolloutDecision.mode}`,
        `matrixPrimaryAllowed=${rolloutDecision.matrixPrimaryAllowed}`,
      ],
    }),
    item({
      id: "logistics_load_is_light",
      label: "Logistics load is light",
      status: logisticsRelevant
        ? heavyLogisticsLoad
          ? "fail"
          : "pass"
        : "not_applicable",
      severity: "error",
      explanation: logisticsRelevant
        ? heavyLogisticsLoad
          ? "Travel/weigh-in matrix draft contains a heavy logistics-day load risk."
          : "Travel/weigh-in matrix draft stays light enough for internal pilot."
        : "Scenario is not a travel/weigh-in logistics scenario.",
      evidence: [`heavyLogisticsLoad=${heavyLogisticsLoad}`],
    }),
    item({
      id: "production_route_unchanged",
      label: "Production route unchanged",
      status: productionRouteUnchanged ? "pass" : "fail",
      severity: "error",
      explanation: productionRouteUnchanged
        ? "Pilot readiness does not require changing the production draft route."
        : "Production route changes are required, so readiness is blocked.",
      evidence: [`productionRouteUnchanged=${productionRouteUnchanged}`],
    }),
    item({
      id: "no_db_write_required",
      label: "No DB write required",
      status: noDbWriteRequired ? "pass" : "fail",
      severity: "error",
      explanation: noDbWriteRequired
        ? "Readiness/reporting stays pure and does not require DB writes."
        : "Readiness/reporting would write DB state and must be blocked.",
      evidence: [`noDbWriteRequired=${noDbWriteRequired}`],
    }),
    item({
      id: "manual_qa_required",
      label: "Manual QA required",
      status: manualQaRequired ? "warning" : "not_applicable",
      severity: "info",
      explanation: manualQaRequired
        ? "Limited pilot still requires manual coach/QA review before any production decision."
        : "Manual QA was explicitly marked not required for this evaluation.",
      evidence: [`manualQaRequired=${manualQaRequired}`],
    }),
  ];
}

function statusFor(params: {
  checklist: MatrixPilotReadinessChecklistItem[];
  preview: ConstructorMatrixPreviewResponse;
  rolloutDecision: MatrixConstructorRolloutDecision;
}): MatrixPilotReadinessStatus {
  const { checklist, preview, rolloutDecision } = params;
  const scenario = rolloutDecision.scenario;
  const hasErrorFailure = hasErrorChecklistFailure(checklist);
  const hasHardRolloutBlocker = rolloutDecision.blockers.some((blocker) => blocker.severity === "error");
  const hasBlockingWarning = hasNonManualWarning(checklist);
  const fixtureCovered = checklist.find((item) => item.id === "scenario_fixture_covered")?.status === "pass";

  if (
    rolloutDecision.mode === "blocked" ||
    scenario === "unknown" ||
    scenario === "unsafe" ||
    hasErrorFailure ||
    hasHardRolloutBlocker
  ) {
    return "blocked";
  }

  if (PREVIEW_ONLY_SCENARIOS.has(scenario) || rolloutDecision.mode === "preview_only") {
    return "preview_only";
  }

  if (
    rolloutDecision.mode === "matrix_allowed_for_primary" &&
    rolloutDecision.matrixPrimaryAllowed &&
    LIMITED_PRIMARY_PILOT_SCENARIOS.has(scenario) &&
    preview.safeToPreview &&
    preview.defaultPathUnchanged &&
    fixtureCovered &&
    !hasBlockingWarning &&
    rolloutDecision.blockers.length === 0
  ) {
    return "ready_for_limited_primary_pilot";
  }

  if (
    rolloutDecision.mode === "matrix_allowed_for_internal" &&
    INTERNAL_PILOT_SCENARIOS.has(scenario) &&
    preview.safeToPreview &&
    preview.defaultPathUnchanged &&
    fixtureCovered &&
    !hasBlockingWarning &&
    rolloutDecision.blockers.length === 0
  ) {
    return "ready_for_internal_pilot";
  }

  if (rolloutDecision.mode === "matrix_allowed_for_internal") {
    return "internal_only";
  }

  return "needs_review";
}

export function summarizeMatrixPilotReadiness(
  readiness: Pick<MatrixPilotReadinessResult, "status" | "scenario" | "blockers" | "checklist">,
): MatrixPilotReadinessSummary {
  return {
    status: readiness.status,
    scenario: readiness.scenario,
    blockerCount: readiness.blockers.length,
    checklistCounts: checklistCounts(readiness.checklist),
  };
}

export function getMatrixPilotReadinessBlockers(
  readiness: Pick<MatrixPilotReadinessResult, "blockers">,
) {
  return readiness.blockers;
}

export function evaluateMatrixPilotReadiness(
  input: ConstructorInput,
  options?: MatrixPilotReadinessOptions,
): MatrixPilotReadinessResult {
  const previewOptions = options?.rolloutOptions?.previewOptions ?? {
    includeDrafts: true,
    includeComparisonReport: true,
    includeSafetyDetails: true,
    includeInfoDifferences: true,
  };
  const preview = buildConstructorMatrixPreviewResponse(input, previewOptions);
  const rolloutDecision = decideMatrixConstructorRollout(input, {
    ...options?.rolloutOptions,
    previewOptions,
  });
  const checklist = buildMatrixPilotReadinessChecklist(input, preview, rolloutDecision, options);
  const blockers = readinessBlockersFrom(checklist, rolloutDecision);
  const status = statusFor({ checklist, preview, rolloutDecision });
  const resultWithoutSummary = {
    generatedFrom: "matrix_constructor_pilot_readiness" as const,
    generatedAt: new Date().toISOString(),
    status,
    scenario: rolloutDecision.scenario,
    rolloutMode: rolloutDecision.mode,
    matrixPrimaryAllowed: rolloutDecision.matrixPrimaryAllowed,
    recommendedAction: rolloutDecision.recommendedAction,
    checklist,
    blockers,
    notes: [
      "Readiness is a reporting layer only.",
      "It does not change legacy constructor defaults, production routes, DB, telemetry, storage, mobile, or save/assign flows.",
    ],
  };

  return {
    ...resultWithoutSummary,
    summary: summarizeMatrixPilotReadiness(resultWithoutSummary),
  };
}
