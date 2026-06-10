"use client";

import type { MatrixPrimaryPilotServerSaveDryRunResponse } from "@training-platform/shared";
import type { MatrixPrimaryPilotSaveDryRunResult } from "../../lib/constructor-matrix-save-dry-run";
import { matrixUiCopyFor } from "../../lib/constructor-matrix-ui";
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
      en: "waiting for pilot activation",
      ru: "ожидает включения пилота",
      bg: "чака pilot activation",
    }),
    passed: matrixUiCopyFor(language, {
      en: "dry-run passed",
      ru: "проверка пройдена",
      bg: "dry-run премина",
    }),
    blocked: matrixUiCopyFor(language, {
      en: "dry-run blocked",
      ru: "проверка заблокирована",
      bg: "dry-run блокиран",
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
            bg: "Pilot-safe save dry-run",
          })}
        </strong>
        <span className={`constructor-matrix-save-dry-run-badge ${statusTone(result.status)}`}>
          {statusLabel(language, result.status)}
        </span>
      </div>
      <p className="constructor-matrix-rollout-note">
        {matrixUiCopyFor(language, {
          en: "This validates the matrix primary pilot as a future template payload candidate. It does not save, assign, write DB, write storage, or change the production route.",
          ru: "Это проверяет, можно ли превратить новый план в шаблон. Проверка ничего не сохраняет, не назначает и не пишет в базу.",
          bg: "Това валидира matrix primary pilot като бъдещ template payload candidate. Не записва, не назначава, не пише в DB/storage и не променя production route.",
        })}
      </p>

      {result.summary ? (
        <div className="constructor-matrix-count-grid constructor-matrix-save-dry-run-grid">
          {[
            [matrixUiCopyFor(language, { en: "days", ru: "дни", bg: "дни" }), result.summary.dayCount],
            [matrixUiCopyFor(language, { en: "sessions", ru: "тренировки", bg: "тренировки" }), result.summary.sessionCount],
            [matrixUiCopyFor(language, { en: "blocks", ru: "блоки", bg: "блокове" }), result.summary.blockCount],
            [matrixUiCopyFor(language, { en: "exercises", ru: "упражнения", bg: "упражнения" }), result.summary.exerciseCount],
            [matrixUiCopyFor(language, { en: "top blocks", ru: "основные блоки", bg: "основни блокове" }), result.summary.topLevelBlockCount],
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
              ru: "Блокеры",
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
            en: "Dry-run checklist",
            ru: "Детали проверки сохранения",
            bg: "Dry-run checklist",
          })}
        </summary>
        <ul className="constructor-matrix-preview-list">
          {result.checks.map((item) => (
            <li key={item.id}>
              <strong>{item.label}</strong>
              <span>
                {item.passed ? "pass" : "stop"} · {item.severity}
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
              en: "Server dry-run evidence",
              ru: "Серверная проверка",
              bg: "Server dry-run evidence",
            })}
          </strong>
          <span className={`constructor-matrix-save-dry-run-badge ${statusTone(serverDryRun?.status ?? "waiting")}`}>
            {serverError
              ? matrixUiCopyFor(language, {
                  en: "server check failed",
                  ru: "серверная проверка не прошла",
                  bg: "server check не мина",
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
            en: "The server recomputes rollout, readiness and matrix draft before validating the same save payload candidate. This is still dry-run only.",
            ru: "Сервер заново считает решение, готовность и новый черновик перед проверкой шаблона. Это всё ещё только проверка без сохранения.",
            bg: "Сървърът пресмята rollout, readiness и matrix draft преди проверката на save payload candidate. Това още е само dry-run.",
          })}
        </p>

        {serverError ? (
          <p className="constructor-matrix-server-dry-run-error">{serverError}</p>
        ) : serverResult ? (
          <div className="constructor-matrix-count-grid constructor-matrix-save-dry-run-grid">
            {[
              [matrixUiCopyFor(language, { en: "scenario", ru: "сценарий", bg: "сценарий" }), serverResult.rolloutDecision.scenario],
              [matrixUiCopyFor(language, { en: "mode", ru: "режим", bg: "режим" }), serverResult.rolloutDecision.mode],
              [matrixUiCopyFor(language, { en: "readiness", ru: "готовность", bg: "готовност" }), serverResult.pilotReadiness.status],
              [matrixUiCopyFor(language, { en: "server status", ru: "статус сервера", bg: "статус сървър" }), serverResult.dryRun.status],
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
              en: "Run matrix preview with limited pilot flag enabled to request server evidence.",
              ru: "Запустите сравнение нового конструктора с включённым пилотным режимом, чтобы получить серверную проверку.",
              bg: "Пуснете matrix preview с включен limited pilot flag, за да получите server evidence.",
            })}
          </p>
        )}
      </section>
    </article>
  );
}
