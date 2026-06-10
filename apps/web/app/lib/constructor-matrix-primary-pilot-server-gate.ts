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
    evidenceItem("server_dry_run", "server save check", dryRun?.status === "passed", dryRun?.status),
    evidenceItem("server_dry_run_blockers", "server save blockers", (dryRun?.blockers.length ?? 0) === 0, dryRun?.blockers.length),
    evidenceItem(
      "server_rollout_mode",
      "server use mode",
      rolloutDecision?.mode === "matrix_allowed_for_primary",
      rolloutDecision?.mode,
    ),
    evidenceItem(
      "server_matrix_primary_allowed",
      "server use allowed",
      rolloutDecision?.matrixPrimaryAllowed === true,
      rolloutDecision?.matrixPrimaryAllowed,
    ),
    evidenceItem(
      "server_rollout_blockers",
      "server use blockers",
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
      "server readiness allows use",
      pilotReadiness?.matrixPrimaryAllowed === true,
      pilotReadiness?.matrixPrimaryAllowed,
    ),
    evidenceItem(
      "server_readiness_blockers",
      "server readiness limits",
      (pilotReadiness?.blockers.length ?? 0) === 0,
      pilotReadiness?.blockers.length,
    ),
    evidenceItem(
      "server_rollout_readiness_scenario",
      "server decision/readiness scenario",
      serverScenarioMatches,
      rolloutDecision && pilotReadiness
        ? `${rolloutDecision.scenario} / ${pilotReadiness.scenario}`
        : null,
    ),
    evidenceItem(
      "server_rollout_readiness_mode",
      "server decision/readiness mode",
      serverRolloutModeMatches,
      rolloutDecision && pilotReadiness
        ? `${rolloutDecision.mode} / ${pilotReadiness.rolloutMode}`
        : null,
    ),
    evidenceItem(
      "server_rollout_readiness_primary",
      "server decision/readiness use allowed",
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
      en: "The server check confirms that this new draft can be used.",
      ru: "Серверная проверка подтверждает, что новый черновик можно использовать.",
      bg: "Сървърната проверка потвърждава, че новата чернова може да се използва.",
    });
  }

  const copy = {
    server_dry_run_missing: matrixUiCopyFor(language, {
      en: "The server save check is missing. Run the comparison again.",
      ru: "Нет серверной проверки сохранения. Запустите сравнение ещё раз.",
      bg: "Липсва сървърна проверка за запис. Пуснете сравнението отново.",
    }),
    server_dry_run_error: matrixUiCopyFor(language, {
      en: "The server save check returned an error.",
      ru: "Серверная проверка сохранения вернула ошибку.",
      bg: "Сървърната проверка за запис върна грешка.",
    }),
    server_dry_run_blocked: matrixUiCopyFor(language, {
      en: "The server save check did not pass.",
      ru: "Серверная проверка сохранения не пройдена.",
      bg: "Сървърната проверка за запис не премина.",
    }),
    server_rollout_not_primary: matrixUiCopyFor(language, {
      en: "The server rules do not allow using the new draft here.",
      ru: "Серверные правила не разрешают использовать новый черновик здесь.",
      bg: "Сървърните правила не разрешават новата чернова тук.",
    }),
    server_rollout_blockers_present: matrixUiCopyFor(language, {
      en: "The server found blocking limits.",
      ru: "Сервер нашёл блокирующие ограничения.",
      bg: "Сървърът намери блокиращи ограничения.",
    }),
    server_readiness_not_primary_ready: matrixUiCopyFor(language, {
      en: "The server readiness check is not ready for limited use.",
      ru: "Серверная проверка готовности не разрешила ограниченное применение.",
      bg: "Сървърната проверка за готовност не разреши ограничена употреба.",
    }),
    server_readiness_blockers_present: matrixUiCopyFor(language, {
      en: "The server readiness check found blockers.",
      ru: "Серверная проверка готовности нашла ограничения.",
      bg: "Сървърната проверка за готовност намери ограничения.",
    }),
    server_evidence_mismatch: matrixUiCopyFor(language, {
      en: "Server decision and readiness check do not match.",
      ru: "Серверное решение и проверка готовности не совпадают.",
      bg: "Сървърното решение и проверката за готовност не съвпадат.",
    }),
    server_scenario_mismatch: matrixUiCopyFor(language, {
      en: "The server scenario does not match the local comparison.",
      ru: "Серверный сценарий не совпадает с локальным сравнением.",
      bg: "Сървърният сценарий не съвпада с локалното сравнение.",
    }),
  } satisfies Record<MatrixPrimaryPilotServerGateReason, string>;

  return copy[reason];
}
