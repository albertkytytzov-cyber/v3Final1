import type { ConstructorDraft, ConstructorInput } from "./constructor-core";
import type {
  ConstructorDraftComparisonReport,
  ConstructorDraftComparisonSummary,
  ConstructorDraftDifferenceCategory,
  ConstructorDraftDifferenceSeverity,
  ConstructorDraftDifference,
  ConstructorDraftSafetyInvariantResult,
} from "./constructor-matrix-comparison";
import { compareLegacyAndMatrixConstructorDrafts } from "./constructor-matrix-comparison";
import type { MatrixDrivenConstructorDraft } from "./constructor-matrix-adapter";
import type {
  MatrixDrivenBuilderOptions,
  MatrixDrivenRiskCode,
} from "./constructor-matrix-plan-builder";
import type { ConstructorTrainingBlockType } from "./constructor-matrix";

export type ConstructorComparisonPreviewMode = "comparison_preview";
export type ConstructorComparisonPreviewExplanationDepth = "short" | "normal" | "detailed";

export interface ConstructorComparisonPreviewOptions {
  includeDrafts?: boolean;
  includeComparisonReport?: boolean;
  includeSafetyDetails?: boolean;
  explanationDepth?: ConstructorComparisonPreviewExplanationDepth;
  failOnMatrixSafetyError?: boolean;
  matrixOptions?: MatrixDrivenBuilderOptions;
  includeInfoDifferences?: boolean;
}

export interface ConstructorComparisonPreviewWarning {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
}

export interface ConstructorComparisonPreviewSummary extends ConstructorDraftComparisonSummary {
  matrixSafetyPassed: boolean;
  legacyDefaultGuardPassed: boolean;
  previewMode: ConstructorComparisonPreviewMode;
  includedDrafts: boolean;
  includedComparisonReport: boolean;
  includedSafetyDetails: boolean;
}

export interface ConstructorComparisonPreviewReport
  extends Omit<
    ConstructorDraftComparisonReport,
    "legacyDraft" | "matrixDraft" | "matrixSafetyInvariants" | "legacyDefaultInvariants"
  > {
  legacyDraft?: ConstructorDraft;
  matrixDraft?: MatrixDrivenConstructorDraft;
  matrixSafetyInvariants?: ConstructorDraftSafetyInvariantResult[];
  legacyDefaultInvariants?: ConstructorDraftSafetyInvariantResult[];
}

export interface ConstructorComparisonPreviewSafety {
  safeToPreview: boolean;
  matrixSafetyPassed: boolean;
  legacyDefaultGuardPassed: boolean;
  defaultPathUnchanged: boolean;
  errorCount: number;
  warningCount: number;
  expectedDifferenceCount: number;
}

export interface ConstructorComparisonPreview {
  mode: ConstructorComparisonPreviewMode;
  generatedFrom: "legacy_matrix_comparison_preview";
  generatedAt: string;
  legacyDraft?: ConstructorDraft;
  matrixDraft?: MatrixDrivenConstructorDraft;
  comparisonReport?: ConstructorComparisonPreviewReport;
  summary: ConstructorComparisonPreviewSummary;
  safety: ConstructorComparisonPreviewSafety;
  safetyInvariants?: ConstructorDraftSafetyInvariantResult[];
  legacyDefaultGuard?: ConstructorDraftSafetyInvariantResult[];
  safeToPreview: boolean;
  defaultPathUnchanged: boolean;
  warnings: ConstructorComparisonPreviewWarning[];
  notes: string[];
}

export type ConstructorMatrixPreviewApiOptions = ConstructorComparisonPreviewOptions;

export interface ConstructorMatrixPreviewRequest {
  input: ConstructorInput;
  options?: ConstructorMatrixPreviewApiOptions;
}

export type ConstructorMatrixPreviewResponse = ConstructorComparisonPreview;

export interface ConstructorPreviewFixtureLegacyExpectations {
  shouldBuild: boolean;
}

export interface ConstructorPreviewFixtureMatrixExpectations {
  shouldBuild: boolean;
  safeToPreview: boolean;
  forbiddenSelectedBlockTypes?: ConstructorTrainingBlockType[];
  requiredSelectedBlockTypes?: ConstructorTrainingBlockType[];
  requiredAnySelectedBlockTypes?: ConstructorTrainingBlockType[][];
  requiredExplanationKeywords?: string[];
  forbiddenRiskCodes?: MatrixDrivenRiskCode[];
  requiredRiskCodes?: MatrixDrivenRiskCode[];
  maxErrorCount: number;
  maxWarningCount?: number;
  requireEveningSession?: boolean;
}

export interface ConstructorPreviewFixtureComparisonExpectations {
  allowedDifferenceCategories?: ConstructorDraftDifferenceCategory[];
  forbiddenDifferenceSeverities?: ConstructorDraftDifferenceSeverity[];
  legacyDefaultMustRemainUnchanged: boolean;
}

export interface ConstructorPreviewFixture {
  id: string;
  title: string;
  description: string;
  input: ConstructorInput;
  expectations: {
    legacy: ConstructorPreviewFixtureLegacyExpectations;
    matrix: ConstructorPreviewFixtureMatrixExpectations;
    comparison: ConstructorPreviewFixtureComparisonExpectations;
  };
}

function withPreviewDefaults(options?: ConstructorComparisonPreviewOptions) {
  return {
    includeDrafts: options?.includeDrafts ?? true,
    includeComparisonReport: options?.includeComparisonReport ?? true,
    includeSafetyDetails: options?.includeSafetyDetails ?? true,
    explanationDepth: options?.explanationDepth ?? "normal",
    failOnMatrixSafetyError: options?.failOnMatrixSafetyError ?? false,
    matrixOptions: options?.matrixOptions,
    includeInfoDifferences: options?.includeInfoDifferences ?? false,
  };
}

function sanitizeComparisonReport(
  report: ConstructorDraftComparisonReport,
  options: {
    includeDrafts: boolean;
    includeSafetyDetails: boolean;
  },
): ConstructorComparisonPreviewReport {
  const {
    legacyDraft,
    matrixDraft,
    matrixSafetyInvariants,
    legacyDefaultInvariants,
    ...rest
  } = report;

  return {
    ...rest,
    ...(options.includeDrafts ? { legacyDraft, matrixDraft } : {}),
    ...(options.includeSafetyDetails
      ? { matrixSafetyInvariants, legacyDefaultInvariants }
      : {}),
  };
}

function warningFromDifference(
  difference: ConstructorDraftDifference,
): ConstructorComparisonPreviewWarning | null {
  if (difference.severity === "info" || difference.severity === "expected_difference") {
    return null;
  }

  return {
    code: `comparison_${difference.category}`,
    severity: difference.severity === "error" ? "error" : "warning",
    message: difference.message,
  };
}

function buildPreviewWarnings(report: ConstructorDraftComparisonReport) {
  const warnings: ConstructorComparisonPreviewWarning[] = [];

  for (const item of report.differences) {
    const warning = warningFromDifference(item);

    if (warning) {
      warnings.push(warning);
    }
  }

  for (const item of report.matrixSafetyInvariants) {
    if (!item.passed) {
      warnings.push({
        code: `matrix_safety_${item.code}`,
        severity: item.severity,
        message: item.explanation,
      });
    }
  }

  for (const item of report.legacyDefaultInvariants) {
    if (!item.passed) {
      warnings.push({
        code: `legacy_default_${item.code}`,
        severity: item.severity,
        message: item.explanation,
      });
    }
  }

  if (report.summary.expectedDifferenceCount > 0) {
    warnings.push({
      code: "expected_legacy_matrix_differences",
      severity: "info",
      message:
        "Legacy and matrix drafts have expected structural differences because matrix preview uses eligibility rules instead of fixed template weeks.",
    });
  }

  return warnings;
}

function buildPreviewNotes(
  report: ConstructorDraftComparisonReport,
  explanationDepth: ConstructorComparisonPreviewExplanationDepth,
) {
  const baseNotes = [
    "Internal preview only: default buildPerformConstructorDraft(input) remains the legacy path.",
    "Preview does not write to DB and does not change production API/UI behavior.",
  ];

  if (explanationDepth === "short") {
    return baseNotes;
  }

  const normalNotes = [
    ...baseNotes,
    "Matrix draft is generated side-by-side for QA/regression checks before any rollout.",
    "Expected differences are allowed; safety errors and legacy default guard failures block preview.",
  ];

  if (explanationDepth === "normal") {
    return normalNotes;
  }

  return [
    ...normalNotes,
    `Top comparison differences: ${
      report.summary.topDifferences.map((item) => `${item.category}:${item.severity}`).join(", ") || "none"
    }.`,
    `Input summary: ${report.inputSummary.competitionName}, daysUntilStart=${report.inputSummary.daysUntilStart ?? "unknown"}, mainStart=${report.inputSummary.isMainStart}.`,
  ];
}

export function buildConstructorComparisonPreview(
  input: ConstructorInput,
  options?: ConstructorComparisonPreviewOptions,
): ConstructorComparisonPreview {
  const resolvedOptions = withPreviewDefaults(options);
  const comparisonReport = compareLegacyAndMatrixConstructorDrafts(input, {
    matrixOptions: resolvedOptions.matrixOptions,
    includeInfo: resolvedOptions.includeInfoDifferences,
  });
  const matrixSafetyPassed = comparisonReport.matrixSafetyInvariants.every(
    (item) => item.passed || item.severity !== "error",
  );
  const legacyDefaultGuardPassed = comparisonReport.legacyDefaultInvariants.every(
    (item) => item.passed || item.severity !== "error",
  );
  const defaultPathUnchanged = comparisonReport.summary.legacyDefaultUnchanged && legacyDefaultGuardPassed;
  const safeToPreview = comparisonReport.summary.safeToPreview && matrixSafetyPassed && defaultPathUnchanged;

  if (resolvedOptions.failOnMatrixSafetyError && !matrixSafetyPassed) {
    throw new Error("Matrix constructor preview failed safety invariants");
  }

  const summary: ConstructorComparisonPreviewSummary = {
    ...comparisonReport.summary,
    safeToPreview,
    legacyDefaultUnchanged: defaultPathUnchanged,
    matrixSafetyPassed,
    legacyDefaultGuardPassed,
    previewMode: "comparison_preview",
    includedDrafts: resolvedOptions.includeDrafts,
    includedComparisonReport: resolvedOptions.includeComparisonReport,
    includedSafetyDetails: resolvedOptions.includeSafetyDetails,
  };
  const safety: ConstructorComparisonPreviewSafety = {
    safeToPreview,
    matrixSafetyPassed,
    legacyDefaultGuardPassed,
    defaultPathUnchanged,
    errorCount: summary.errorCount,
    warningCount: summary.warningCount,
    expectedDifferenceCount: summary.expectedDifferenceCount,
  };

  return {
    mode: "comparison_preview",
    generatedFrom: "legacy_matrix_comparison_preview",
    generatedAt: new Date().toISOString(),
    ...(resolvedOptions.includeDrafts
      ? {
          legacyDraft: comparisonReport.legacyDraft,
          matrixDraft: comparisonReport.matrixDraft,
        }
      : {}),
    ...(resolvedOptions.includeComparisonReport
      ? {
          comparisonReport: sanitizeComparisonReport(comparisonReport, {
            includeDrafts: resolvedOptions.includeDrafts,
            includeSafetyDetails: resolvedOptions.includeSafetyDetails,
          }),
        }
      : {}),
    summary,
    safety,
    ...(resolvedOptions.includeSafetyDetails
      ? {
          safetyInvariants: comparisonReport.matrixSafetyInvariants,
          legacyDefaultGuard: comparisonReport.legacyDefaultInvariants,
        }
      : {}),
    safeToPreview,
    defaultPathUnchanged,
    warnings: buildPreviewWarnings(comparisonReport),
    notes: buildPreviewNotes(comparisonReport, resolvedOptions.explanationDepth),
  };
}

export function buildConstructorMatrixPreviewResponse(
  input: ConstructorInput,
  options?: ConstructorMatrixPreviewApiOptions,
): ConstructorMatrixPreviewResponse {
  return buildConstructorComparisonPreview(input, options);
}
