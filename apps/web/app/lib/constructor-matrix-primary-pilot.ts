import type {
  ConstructorMatrixPreviewResponse,
  MatrixConstructorRolloutDecision,
  MatrixConstructorRolloutScenario,
  MatrixPilotReadinessResult,
} from "@training-platform/shared";
import { matrixUiCopyFor, type ActiveConstructorDraftSource } from "./constructor-matrix-ui";
import type { Language } from "./i18n";

export type MatrixPrimaryPilotDisabledReason =
  | "internal_ui_flag_off"
  | "limited_pilot_flag_off"
  | "missing_matrix_draft"
  | "readiness_not_primary_ready"
  | "rollout_not_primary_allowed"
  | "scenario_not_allowed"
  | "unsafe_preview"
  | "legacy_default_changed"
  | "safety_errors_present"
  | "comparison_errors_present"
  | "legacy_template_used_as_structure"
  | "blockers_present";

export type MatrixPrimaryPilotEvidenceItem = {
  key: string;
  label: string;
  passed: boolean;
  value: string;
};

export type MatrixPrimaryPilotEligibility = {
  allowed: boolean;
  reason: MatrixPrimaryPilotDisabledReason | null;
  evidence: MatrixPrimaryPilotEvidenceItem[];
};

const MATRIX_PRIMARY_PILOT_ALLOWED_SCENARIOS = new Set<MatrixConstructorRolloutScenario>([
  "far_development_week",
  "post_competition_recovery",
]);

function failedSafetyErrorCount(preview?: ConstructorMatrixPreviewResponse | null) {
  return (
    preview?.safetyInvariants?.filter((item) => !item.passed && item.severity === "error").length ??
    0
  );
}

function comparisonErrorCount(preview?: ConstructorMatrixPreviewResponse | null) {
  const reportErrors =
    preview?.comparisonReport?.differences.filter((item) => item.severity === "error").length ?? 0;

  return Math.max(preview?.summary.errorCount ?? 0, reportErrors);
}

function hasLegacyTemplateStructure(params: {
  preview?: ConstructorMatrixPreviewResponse | null;
  rolloutDecision?: MatrixConstructorRolloutDecision | null;
  matrixDraft?: ConstructorMatrixPreviewResponse["matrixDraft"] | null;
}) {
  const { preview, rolloutDecision, matrixDraft } = params;

  return (
    Boolean(matrixDraft?.matrix.legacyCards.usedAsStructure) ||
    Boolean(preview?.matrixDraft?.matrix.legacyCards.usedAsStructure) ||
    Boolean(preview?.comparisonReport?.matrixDraft?.matrix.legacyCards.usedAsStructure) ||
    rolloutDecision?.blockers.some((blocker) => blocker.code === "legacy_template_used_as_structure") === true
  );
}

function evidenceItem(
  key: string,
  label: string,
  passed: boolean,
  value: string | number | boolean | null | undefined,
): MatrixPrimaryPilotEvidenceItem {
  return {
    key,
    label,
    passed,
    value: value === null || value === undefined ? "-" : String(value),
  };
}

export function canUseMatrixPrimaryPilot(params: {
  activeDraftSource: ActiveConstructorDraftSource;
  internalUiEnabled: boolean;
  limitedPilotEnabled: boolean;
  preview?: ConstructorMatrixPreviewResponse | null;
  rolloutDecision?: MatrixConstructorRolloutDecision | null;
  pilotReadiness?: MatrixPilotReadinessResult | null;
  matrixDraft?: ConstructorMatrixPreviewResponse["matrixDraft"] | null;
}): MatrixPrimaryPilotEligibility {
  const {
    activeDraftSource,
    internalUiEnabled,
    limitedPilotEnabled,
    preview,
    rolloutDecision,
    pilotReadiness,
    matrixDraft,
  } = params;
  const scenario = rolloutDecision?.scenario ?? pilotReadiness?.scenario ?? null;
  const safetyErrors = failedSafetyErrorCount(preview);
  const comparisonErrors = comparisonErrorCount(preview);
  const rolloutBlockerCount = rolloutDecision?.blockers.length ?? 0;
  const readinessBlockerCount = pilotReadiness?.blockers.length ?? 0;
  const legacyTemplateStructure = hasLegacyTemplateStructure({
    preview,
    rolloutDecision,
    matrixDraft,
  });
  const scenarioAllowed = scenario ? MATRIX_PRIMARY_PILOT_ALLOWED_SCENARIOS.has(scenario) : false;
  const evidence = [
    evidenceItem("active_source", "activeDraftSource", true, activeDraftSource),
    evidenceItem("internal_ui_flag", "internal UI flag", internalUiEnabled, internalUiEnabled),
    evidenceItem("limited_pilot_flag", "limited pilot flag", limitedPilotEnabled, limitedPilotEnabled),
    evidenceItem(
      "readiness_status",
      "readiness",
      pilotReadiness?.status === "ready_for_limited_primary_pilot",
      pilotReadiness?.status,
    ),
    evidenceItem(
      "rollout_mode",
      "rollout mode",
      rolloutDecision?.mode === "matrix_allowed_for_primary" &&
        rolloutDecision.matrixPrimaryAllowed === true,
      rolloutDecision?.mode,
    ),
    evidenceItem("scenario", "scenario", scenarioAllowed, scenario),
    evidenceItem("safe_to_preview", "safeToPreview", preview?.safeToPreview === true, preview?.safeToPreview),
    evidenceItem(
      "default_path",
      "defaultPathUnchanged",
      preview?.defaultPathUnchanged === true,
      preview?.defaultPathUnchanged,
    ),
    evidenceItem("safety_errors", "safety errors", safetyErrors === 0, safetyErrors),
    evidenceItem("comparison_errors", "comparison errors", comparisonErrors === 0, comparisonErrors),
    evidenceItem("rollout_blockers", "rollout blockers", rolloutBlockerCount === 0, rolloutBlockerCount),
    evidenceItem("readiness_blockers", "readiness blockers", readinessBlockerCount === 0, readinessBlockerCount),
    evidenceItem(
      "legacy_template_structure",
      "legacy template as structure",
      !legacyTemplateStructure,
      legacyTemplateStructure,
    ),
    evidenceItem("matrix_draft", "matrix draft", Boolean(matrixDraft), Boolean(matrixDraft)),
  ];

  let reason: MatrixPrimaryPilotDisabledReason | null = null;

  if (!internalUiEnabled) {
    reason = "internal_ui_flag_off";
  } else if (!limitedPilotEnabled) {
    reason = "limited_pilot_flag_off";
  } else if (!matrixDraft) {
    reason = "missing_matrix_draft";
  } else if (pilotReadiness?.status !== "ready_for_limited_primary_pilot") {
    reason = "readiness_not_primary_ready";
  } else if (
    rolloutDecision?.mode !== "matrix_allowed_for_primary" ||
    rolloutDecision.matrixPrimaryAllowed !== true
  ) {
    reason = "rollout_not_primary_allowed";
  } else if (!scenarioAllowed) {
    reason = "scenario_not_allowed";
  } else if (
    preview?.safeToPreview !== true ||
    rolloutDecision.safeToPreview !== true ||
    preview.safety.matrixSafetyPassed !== true
  ) {
    reason = "unsafe_preview";
  } else if (preview.defaultPathUnchanged !== true || rolloutDecision.defaultPathUnchanged !== true) {
    reason = "legacy_default_changed";
  } else if (safetyErrors > 0 || preview.safety.errorCount > 0) {
    reason = "safety_errors_present";
  } else if (comparisonErrors > 0) {
    reason = "comparison_errors_present";
  } else if (legacyTemplateStructure) {
    reason = "legacy_template_used_as_structure";
  } else if (rolloutBlockerCount > 0 || readinessBlockerCount > 0) {
    reason = "blockers_present";
  }

  return {
    allowed: reason === null,
    reason,
    evidence,
  };
}

export function matrixPrimaryPilotDisabledReasonText(
  language: Language,
  reason?: MatrixPrimaryPilotDisabledReason | null,
) {
  if (!reason) {
    return matrixUiCopyFor(language, {
      en: "Limited matrix primary pilot is available for this scenario.",
      ru: "Limited matrix primary pilot доступен для этого сценария.",
      bg: "Limited matrix primary pilot е наличен за този сценарий.",
    });
  }

  const copy = {
    internal_ui_flag_off: matrixUiCopyFor(language, {
      en: "Internal matrix UI flag is off.",
      ru: "Internal matrix UI flag выключен.",
      bg: "Internal matrix UI flag е изключен.",
    }),
    limited_pilot_flag_off: matrixUiCopyFor(language, {
      en: "Limited primary pilot flag is off.",
      ru: "Limited primary pilot flag выключен.",
      bg: "Limited primary pilot flag е изключен.",
    }),
    missing_matrix_draft: matrixUiCopyFor(language, {
      en: "Matrix draft is missing.",
      ru: "Matrix draft отсутствует.",
      bg: "Matrix draft липсва.",
    }),
    readiness_not_primary_ready: matrixUiCopyFor(language, {
      en: "Pilot readiness is not ready_for_limited_primary_pilot.",
      ru: "Pilot readiness не равен ready_for_limited_primary_pilot.",
      bg: "Pilot readiness не е ready_for_limited_primary_pilot.",
    }),
    rollout_not_primary_allowed: matrixUiCopyFor(language, {
      en: "Rollout mode is not matrix_allowed_for_primary.",
      ru: "Rollout mode не matrix_allowed_for_primary.",
      bg: "Rollout mode не е matrix_allowed_for_primary.",
    }),
    scenario_not_allowed: matrixUiCopyFor(language, {
      en: "Scenario is not allowed for limited primary pilot.",
      ru: "Сценарий не разрешён для limited primary pilot.",
      bg: "Сценарият не е разрешен за limited primary pilot.",
    }),
    unsafe_preview: matrixUiCopyFor(language, {
      en: "Preview is not safe for primary pilot.",
      ru: "Preview небезопасен для primary pilot.",
      bg: "Preview не е безопасен за primary pilot.",
    }),
    legacy_default_changed: matrixUiCopyFor(language, {
      en: "Legacy default path changed.",
      ru: "Legacy default path изменился.",
      bg: "Legacy default path е променен.",
    }),
    safety_errors_present: matrixUiCopyFor(language, {
      en: "Safety errors are present.",
      ru: "Есть safety errors.",
      bg: "Има safety errors.",
    }),
    comparison_errors_present: matrixUiCopyFor(language, {
      en: "Comparison errors are present.",
      ru: "Есть comparison errors.",
      bg: "Има comparison errors.",
    }),
    legacy_template_used_as_structure: matrixUiCopyFor(language, {
      en: "Legacy template was used as structure.",
      ru: "Legacy template использован как структура.",
      bg: "Legacy template е използван като структура.",
    }),
    blockers_present: matrixUiCopyFor(language, {
      en: "Rollout/readiness blockers are present.",
      ru: "Есть rollout/readiness blockers.",
      bg: "Има rollout/readiness blockers.",
    }),
  } satisfies Record<MatrixPrimaryPilotDisabledReason, string>;

  return copy[reason];
}
