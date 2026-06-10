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
  "main_start_d28_preview",
  "main_start_d21_preview",
  "main_start_d10_preview",
  "main_start_d4_start_window",
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
    evidenceItem("active_source", "active draft source", true, activeDraftSource),
    evidenceItem("internal_ui_flag", "new constructor UI enabled", internalUiEnabled, internalUiEnabled),
    evidenceItem("limited_pilot_flag", "limited use enabled", limitedPilotEnabled, limitedPilotEnabled),
    evidenceItem(
      "readiness_status",
      "readiness",
      pilotReadiness?.status === "ready_for_limited_primary_pilot",
      pilotReadiness?.status,
    ),
    evidenceItem(
      "rollout_mode",
      "use mode",
      rolloutDecision?.mode === "matrix_allowed_for_primary" &&
        rolloutDecision.matrixPrimaryAllowed === true,
      rolloutDecision?.mode,
    ),
    evidenceItem("scenario", "scenario", scenarioAllowed, scenario),
    evidenceItem("safe_to_preview", "safety check", preview?.safeToPreview === true, preview?.safeToPreview),
    evidenceItem(
      "default_path",
      "current draft unchanged",
      preview?.defaultPathUnchanged === true,
      preview?.defaultPathUnchanged,
    ),
    evidenceItem("safety_errors", "safety errors", safetyErrors === 0, safetyErrors),
    evidenceItem("comparison_errors", "comparison errors", comparisonErrors === 0, comparisonErrors),
    evidenceItem("rollout_blockers", "use blockers", rolloutBlockerCount === 0, rolloutBlockerCount),
    evidenceItem("readiness_blockers", "readiness limits", readinessBlockerCount === 0, readinessBlockerCount),
    evidenceItem(
      "legacy_template_structure",
      "current template used as structure",
      !legacyTemplateStructure,
      legacyTemplateStructure,
    ),
    evidenceItem("matrix_draft", "new draft returned", Boolean(matrixDraft), Boolean(matrixDraft)),
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
      en: "The new constructor can be used for this scenario.",
      ru: "Новый конструктор можно применить для этого сценария.",
      bg: "Новият конструктор може да се използва за този сценарий.",
    });
  }

  const copy = {
    internal_ui_flag_off: matrixUiCopyFor(language, {
      en: "The new constructor interface is disabled.",
      ru: "Интерфейс нового конструктора выключен.",
      bg: "Интерфейсът на новия конструктор е изключен.",
    }),
    limited_pilot_flag_off: matrixUiCopyFor(language, {
      en: "Limited use of the new constructor is disabled.",
      ru: "Ограниченное применение нового конструктора выключено.",
      bg: "Ограничената употреба на новия конструктор е изключена.",
    }),
    missing_matrix_draft: matrixUiCopyFor(language, {
      en: "The new draft is missing.",
      ru: "Новый черновик не найден.",
      bg: "Новата чернова липсва.",
    }),
    readiness_not_primary_ready: matrixUiCopyFor(language, {
      en: "The new draft is not ready for limited use.",
      ru: "Новый черновик ещё не готов к ограниченному применению.",
      bg: "Новата чернова още не е готова за ограничена употреба.",
    }),
    rollout_not_primary_allowed: matrixUiCopyFor(language, {
      en: "The application rules do not allow using the new draft here.",
      ru: "Правила применения не разрешают использовать новый черновик здесь.",
      bg: "Правилата не разрешават употреба на новата чернова тук.",
    }),
    scenario_not_allowed: matrixUiCopyFor(language, {
      en: "This scenario is not allowed for limited use.",
      ru: "Этот сценарий не разрешён для ограниченного применения.",
      bg: "Този сценарий не е разрешен за ограничена употреба.",
    }),
    unsafe_preview: matrixUiCopyFor(language, {
      en: "The safety check did not allow using this draft.",
      ru: "Проверка безопасности не разрешила использовать этот черновик.",
      bg: "Проверката за безопасност не разреши тази чернова.",
    }),
    legacy_default_changed: matrixUiCopyFor(language, {
      en: "The current constructor protection changed.",
      ru: "Защита текущего конструктора изменилась.",
      bg: "Защитата на текущия конструктор се промени.",
    }),
    safety_errors_present: matrixUiCopyFor(language, {
      en: "Safety errors are present.",
      ru: "Есть ошибки проверки безопасности.",
      bg: "Има грешки в проверката за безопасност.",
    }),
    comparison_errors_present: matrixUiCopyFor(language, {
      en: "Comparison errors are present.",
      ru: "Есть ошибки сравнения.",
      bg: "Има грешки при сравнението.",
    }),
    legacy_template_used_as_structure: matrixUiCopyFor(language, {
      en: "The current template was used as the structure.",
      ru: "Текущий шаблон был использован как структура.",
      bg: "Текущият шаблон е използван като структура.",
    }),
    blockers_present: matrixUiCopyFor(language, {
      en: "There are blocking limits.",
      ru: "Есть блокирующие ограничения.",
      bg: "Има блокиращи ограничения.",
    }),
  } satisfies Record<MatrixPrimaryPilotDisabledReason, string>;

  return copy[reason];
}
