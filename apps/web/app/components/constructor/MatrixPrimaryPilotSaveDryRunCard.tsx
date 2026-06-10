"use client";

import type { MatrixPrimaryPilotServerSaveDryRunResponse } from "@training-platform/shared";
import type { MatrixPrimaryPilotSaveDryRunResult } from "../../lib/constructor-matrix-save-dry-run";
import {
  constructorMatrixMetricLabel,
  constructorMatrixModeLabel,
  constructorMatrixPassStopLabel,
  constructorMatrixReadinessStatusLabel,
  constructorMatrixScenarioLabel,
  matrixUiCopyFor,
} from "../../lib/constructor-matrix-ui";
import type { Language } from "../../lib/i18n";

type MatrixPrimaryPilotSaveDryRunCardProps = {
  language: Language;
  result: MatrixPrimaryPilotSaveDryRunResult;
  serverResult?: MatrixPrimaryPilotServerSaveDryRunResponse | null;
  serverError?: string;
};

function statusLabel(language: Language, status: MatrixPrimaryPilotSaveDryRunResult["status"]) {
  const labels = {
    waiting: matrixUiCopyFor(language, {
      en: "waiting for activation",
      ru: "ожидает включения",
      bg: "чака включване",
    }),
    passed: matrixUiCopyFor(language, {
      en: "check passed",
      ru: "проверка пройдена",
      bg: "проверката премина",
    }),
    blocked: matrixUiCopyFor(language, {
      en: "check blocked",
      ru: "проверка заблокирована",
      bg: "проверката е блокирана",
    }),
  } satisfies Record<MatrixPrimaryPilotSaveDryRunResult["status"], string>;

  return labels[status];
}
function statusTone(status: MatrixPrimaryPilotSaveDryRunResult["status"]) {
  switch (status) {
    case "passed":
      return "is-passed";
    case "blocked":
      return "is-blocked";
    case "waiting":
    default:
      return "is-waiting";
  }
}

export function MatrixPrimaryPilotSaveDryRunCard({
  language,
  result,
  serverResult,
  serverError = "",
}: MatrixPrimaryPilotSaveDryRunCardProps) {
  const serverDryRun = serverResult?.dryRun ?? null;

  return (
    <article className={`constructor-matrix-preview-card constructor-matrix-save-dry-run-card ${statusTone(result.status)}`}>
      <div className="summary-topline">
        <strong>
          {matrixUiCopyFor(language, {
            en: "Safe save check",
            ru: "Проверка безопасного сохранения",
            bg: "Проверка за безопасен запис",
          })}
        </strong>
        <span className={`constructor-matrix-save-dry-run-badge ${statusTone(result.status)}`}>
          {statusLabel(language, result.status)}
        </span>
      </div>
      <p className="constructor-matrix-rollout-note">
        {matrixUiCopyFor(language, {
          en: "This validates whether the new plan can become a template. The check does not save, assign, write to the database, or change the production route.",
          ru: "Это проверяет, можно ли превратить новый план в шаблон. Проверка ничего не сохраняет, не назначает и не пишет в базу.",
          bg: "Това проверява дали новият план може да стане шаблон. Проверката не записва, не назначава и не променя данни.",
        })}
      </p>

      {result.summary ? (
        <div className="constructor-matrix-count-grid constructor-matrix-save-dry-run-grid">
          {[
            [matrixUiCopyFor(language, { en: "days", ru: "дни", bg: "дни" }), result.summary.dayCount],
            [constructorMatrixMetricLabel(language, "sessions"), result.summary.sessionCount],
            [constructorMatrixMetricLabel(language, "blocks"), result.summary.blockCount],
            [constructorMatrixMetricLabel(language, "exercises"), result.summary.exerciseCount],
            [constructorMatrixMetricLabel(language, "top blocks"), result.summary.topLevelBlockCount],
          ].map(([label, value]) => (
            <span key={label}>
              <small>{label}</small>
              <strong>{value}</strong>
            </span>
          ))}
        </div>
      ) : null}

      {result.blockers.length ? (
        <section className="constructor-matrix-pilot-section">
          <strong>
            {matrixUiCopyFor(language, {
              en: "Blockers",
              ru: "Ограничения",
              bg: "Блокери",
            })}
          </strong>
          <ul className="constructor-matrix-difference-list">
            {result.blockers.map((item) => (
              <li
                className={`constructor-matrix-difference constructor-matrix-severity-${item.severity}`}
                key={item.id}
              >
                <div>
                  <strong>{item.id}</strong>
                  <span>{item.severity}</span>
                </div>
                <p>{item.label}</p>
                {item.evidence.length ? <small>{item.evidence.join(" · ")}</small> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <details className="constructor-matrix-pilot-checklist">
        <summary>
          {matrixUiCopyFor(language, {
            en: "Save check details",
            ru: "Детали проверки сохранения",
            bg: "Детайли на проверката за запис",
          })}
        </summary>
        <ul className="constructor-matrix-preview-list">
          {result.checks.map((item) => (
            <li key={item.id}>
              <strong>{item.label}</strong>
              <span>
                {constructorMatrixPassStopLabel(language, item.passed)} · {item.severity}
                {item.evidence.length ? ` · ${item.evidence.join(" · ")}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </details>

      <section className="constructor-matrix-server-dry-run">
        <div className="summary-topline">
          <strong>
            {matrixUiCopyFor(language, {
              en: "Server check",
              ru: "Серверная проверка",
              bg: "Сървърна проверка",
            })}
          </strong>
          <span className={`constructor-matrix-save-dry-run-badge ${statusTone(serverDryRun?.status ?? "waiting")}`}>
              {serverError
                ? matrixUiCopyFor(language, {
                  en: "server check failed",
                  ru: "серверная проверка не прошла",
                  bg: "сървърната проверка не премина",
                })
              : serverDryRun
                ? statusLabel(language, serverDryRun.status)
                : matrixUiCopyFor(language, {
                    en: "not requested",
                    ru: "не запускалась",
                    bg: "не е заявено",
                  })}
          </span>
        </div>
        <p className="constructor-matrix-rollout-note">
          {matrixUiCopyFor(language, {
            en: "The server recomputes the decision, readiness and new draft before validating the same save candidate. This is still a check only.",
            ru: "Сервер заново считает решение, готовность и новый черновик перед проверкой шаблона. Это всё ещё только проверка без сохранения.",
            bg: "Сървърът пресмята решението, готовността и новата чернова преди проверката на шаблона. Това все още е само проверка без запис.",
          })}
        </p>

        {serverError ? (
          <p className="constructor-matrix-server-dry-run-error">{serverError}</p>
        ) : serverResult ? (
          <div className="constructor-matrix-count-grid constructor-matrix-save-dry-run-grid">
            {[
              [
                matrixUiCopyFor(language, { en: "scenario", ru: "сценарий", bg: "сценарий" }),
                constructorMatrixScenarioLabel(language, serverResult.rolloutDecision.scenario),
              ],
              [
                matrixUiCopyFor(language, { en: "mode", ru: "режим", bg: "режим" }),
                constructorMatrixModeLabel(language, serverResult.rolloutDecision.mode),
              ],
              [
                matrixUiCopyFor(language, { en: "readiness", ru: "готовность", bg: "готовност" }),
                constructorMatrixReadinessStatusLabel(language, serverResult.pilotReadiness.status),
              ],
              [
                matrixUiCopyFor(language, { en: "server status", ru: "статус сервера", bg: "статус сървър" }),
                statusLabel(language, serverResult.dryRun.status),
              ],
            ].map(([label, value]) => (
              <span key={label}>
                <small>{label}</small>
                <strong>{value}</strong>
              </span>
            ))}
          </div>
        ) : (
          <p className="constructor-matrix-rollout-note">
            {matrixUiCopyFor(language, {
              en: "Run the new constructor comparison to request the server check.",
              ru: "Запустите сравнение нового конструктора, чтобы получить серверную проверку.",
              bg: "Пуснете сравнението на новия конструктор, за да получите сървърна проверка.",
            })}
          </p>
        )}
      </section>
    </article>
  );
}
