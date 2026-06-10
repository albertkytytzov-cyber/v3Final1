import type {
  MatrixConstructorRolloutDecision,
  MatrixPilotReadinessResult,
  MatrixPrimaryPilotServerSaveDryRunResponse,
} from "@training-platform/shared";
import { matrixUiCopyFor } from "./constructor-matrix-ui";
import type { Language } from "./i18n";

export type MatrixPrimaryPilotServerGateReason =
  | "server_dry_run_missing"
  | "server_dry_run_error"
  | "server_dry_run_blocked"
  | "server_rollout_not_primary"
  | "server_rollout_blockers_present"
  | "server_readiness_not_primary_ready"
  | "server_readiness_blockers_present"
  | "server_evidence_mismatch"
  | "server_scenario_mismatch";

export type MatrixPrimaryPilotServerGateEvidenceItem = {
  key: string;
  label: string;
  passed: boolean;
  value: string;
};

export type MatrixPrimaryPilotServerGate = {
  allowed: boolean;
  reason: MatrixPrimaryPilotServerGateReason | null;
  evidence: MatrixPrimaryPilotServerGateEvidenceItem[];
};

function evidenceItem(
  key: string,
  label: string,
  passed: boolean,
  value: string | number | boolean | null | undefined,
): MatrixPrimaryPilotServerGateEvidenceItem {
  return {
    key,
    label,
    passed,
    value: value === null || value === undefined ? "-" : String(value),
  };
}

export function canUseMatrixPrimaryPilotWithServerEvidence(params: {
  serverResult?: MatrixPrimaryPilotServerSaveDryRunResponse | null;
  serverError?: string;
  localRolloutDecision?: MatrixConstructorRolloutDecision | null;
  localPilotReadiness?: MatrixPilotReadinessResult | null;
}): MatrixPrimaryPilotServerGate {
  const { serverResult, serverError = "", localRolloutDecision, localPilotReadiness } = params;
  const dryRun = serverResult?.dryRun ?? null;
  const rolloutDecision = serverResult?.rolloutDecision ?? null;
  const pilotReadiness = serverResult?.pilotReadiness ?? null;
  const localScenario = localRolloutDecision?.scenario ?? localPilotReadiness?.scenario ?? null;
  const serverScenario = rolloutDecision?.scenario ?? pilotReadiness?.scenario ?? null;
  const serverScenarioMatches = Boolean(
    rolloutDecision && pilotReadiness && rolloutDecision.scenario === pilotReadiness.scenario,
  );
  const serverRolloutModeMatches = Boolean(
    rolloutDecision && pilotReadiness && rolloutDecision.mode === pilotReadiness.rolloutMode,
  );
  const serverPrimaryAllowedMatches = Boolean(
    rolloutDecision &&
      pilotReadiness &&
      rolloutDecision.matrixPrimaryAllowed === pilotReadiness.matrixPrimaryAllowed,
  );
  const scenarioMatches = Boolean(
    localScenario && serverScenario && localScenario === serverScenario,
  );

  const evidence = [
    evidenceItem("server_result", "server result", Boolean(serverResult), Boolean(serverResult)),
    evidenceItem("server_error", "server error", !serverError, serverError || "none"),
    evidenceItem("server_dry_run", "server dry-run", dryRun?.status === "passed", dryRun?.status),
    evidenceItem("server_dry_run_blockers", "server dry-run blockers", (dryRun?.blockers.length ?? 0) === 0, dryRun?.blockers.length),
    evidenceItem(
      "server_rollout_mode",
      "server rollout mode",
      rolloutDecision?.mode === "matrix_allowed_for_primary",
      rolloutDecision?.mode,
    ),
    evidenceItem(
      "server_matrix_primary_allowed",
      "server matrixPrimaryAllowed",
      rolloutDecision?.matrixPrimaryAllowed === true,
      rolloutDecision?.matrixPrimaryAllowed,
    ),
    evidenceItem(
      "server_rollout_blockers",
      "server rollout blockers",
      (rolloutDecision?.blockers.length ?? 0) === 0,
      rolloutDecision?.blockers.length,
    ),
    evidenceItem(
      "server_readiness",
      "server readiness",
      pilotReadiness?.status === "ready_for_limited_primary_pilot",
      pilotReadiness?.status,
    ),
    evidenceItem(
      "server_readiness_primary_allowed",
      "server readiness primaryAllowed",
      pilotReadiness?.matrixPrimaryAllowed === true,
      pilotReadiness?.matrixPrimaryAllowed,
    ),
    evidenceItem(
      "server_readiness_blockers",
      "server readiness blockers",
      (pilotReadiness?.blockers.length ?? 0) === 0,
      pilotReadiness?.blockers.length,
    ),
    evidenceItem(
      "server_rollout_readiness_scenario",
      "server rollout/readiness scenario",
      serverScenarioMatches,
      rolloutDecision && pilotReadiness
        ? `${rolloutDecision.scenario} / ${pilotReadiness.scenario}`
        : null,
    ),
    evidenceItem(
      "server_rollout_readiness_mode",
      "server rollout/readiness mode",
      serverRolloutModeMatches,
      rolloutDecision && pilotReadiness
        ? `${rolloutDecision.mode} / ${pilotReadiness.rolloutMode}`
        : null,
    ),
    evidenceItem(
      "server_rollout_readiness_primary",
      "server rollout/readiness primaryAllowed",
      serverPrimaryAllowedMatches,
      rolloutDecision && pilotReadiness
        ? `${rolloutDecision.matrixPrimaryAllowed} / ${pilotReadiness.matrixPrimaryAllowed}`
        : null,
    ),
    evidenceItem(
      "server_scenario_match",
      "server scenario matches local",
      scenarioMatches,
      localScenario && serverScenario ? `${localScenario} / ${serverScenario}` : null,
    ),
  ];

  let reason: MatrixPrimaryPilotServerGateReason | null = null;

  if (!serverResult) {
    reason = "server_dry_run_missing";
  } else if (serverError) {
    reason = "server_dry_run_error";
  } else if (dryRun?.status !== "passed" || (dryRun?.blockers.length ?? 0) > 0) {
    reason = "server_dry_run_blocked";
  } else if (
    rolloutDecision?.mode !== "matrix_allowed_for_primary" ||
    rolloutDecision.matrixPrimaryAllowed !== true
  ) {
    reason = "server_rollout_not_primary";
  } else if ((rolloutDecision.blockers.length ?? 0) > 0) {
    reason = "server_rollout_blockers_present";
  } else if (
    pilotReadiness?.status !== "ready_for_limited_primary_pilot" ||
    pilotReadiness.matrixPrimaryAllowed !== true
  ) {
    reason = "server_readiness_not_primary_ready";
  } else if (pilotReadiness.blockers.length > 0) {
    reason = "server_readiness_blockers_present";
  } else if (
    !serverScenarioMatches ||
    !serverRolloutModeMatches ||
    !serverPrimaryAllowedMatches
  ) {
    reason = "server_evidence_mismatch";
  } else if (!scenarioMatches) {
    reason = "server_scenario_mismatch";
  }

  return {
    allowed: reason === null,
    reason,
    evidence,
  };
}

export function matrixPrimaryPilotServerGateReasonText(
  language: Language,
  reason?: MatrixPrimaryPilotServerGateReason | null,
) {
  if (!reason) {
    return matrixUiCopyFor(language, {
      en: "Server evidence confirms this primary pilot candidate.",
      ru: "Server evidence подтверждает этот primary pilot candidate.",
      bg: "Server evidence потвърждава този primary pilot candidate.",
    });
  }

  const copy = {
    server_dry_run_missing: matrixUiCopyFor(language, {
      en: "Server dry-run evidence is missing. Run matrix preview again.",
      ru: "Нет server dry-run evidence. Запустите matrix preview ещё раз.",
      bg: "Липсва server dry-run evidence. Пуснете matrix preview отново.",
    }),
    server_dry_run_error: matrixUiCopyFor(language, {
      en: "Server dry-run returned an error.",
      ru: "Server dry-run вернул ошибку.",
      bg: "Server dry-run върна грешка.",
    }),
    server_dry_run_blocked: matrixUiCopyFor(language, {
      en: "Server dry-run did not pass.",
      ru: "Server dry-run не пройден.",
      bg: "Server dry-run не премина.",
    }),
    server_rollout_not_primary: matrixUiCopyFor(language, {
      en: "Server rollout does not allow matrix primary mode.",
      ru: "Server rollout не разрешает matrix primary mode.",
      bg: "Server rollout не разрешава matrix primary mode.",
    }),
    server_rollout_blockers_present: matrixUiCopyFor(language, {
      en: "Server rollout blockers are present.",
      ru: "Есть server rollout blockers.",
      bg: "Има server rollout blockers.",
    }),
    server_readiness_not_primary_ready: matrixUiCopyFor(language, {
      en: "Server readiness is not ready for limited primary pilot.",
      ru: "Server readiness не готов к limited primary pilot.",
      bg: "Server readiness не е готов за limited primary pilot.",
    }),
    server_readiness_blockers_present: matrixUiCopyFor(language, {
      en: "Server readiness blockers are present.",
      ru: "Есть server readiness blockers.",
      bg: "Има server readiness blockers.",
    }),
    server_evidence_mismatch: matrixUiCopyFor(language, {
      en: "Server rollout and readiness evidence do not agree.",
      ru: "Server rollout и readiness evidence не совпадают.",
      bg: "Server rollout и readiness evidence не съвпадат.",
    }),
    server_scenario_mismatch: matrixUiCopyFor(language, {
      en: "Server scenario does not match the local preview scenario.",
      ru: "Server scenario не совпадает с local preview scenario.",
      bg: "Server scenario не съвпада с local preview scenario.",
    }),
  } satisfies Record<MatrixPrimaryPilotServerGateReason, string>;

  return copy[reason];
}
