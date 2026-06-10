"use client";

import type { MatrixPrimaryPilotSaveDryRunResult } from "../../lib/constructor-matrix-save-dry-run";
import { matrixUiCopyFor } from "../../lib/constructor-matrix-ui";
import type { Language } from "../../lib/i18n";

type MatrixPrimaryPilotSaveDryRunCardProps = {
  language: Language;
  result: MatrixPrimaryPilotSaveDryRunResult;
};

function statusLabel(language: Language, status: MatrixPrimaryPilotSaveDryRunResult["status"]) {
  const labels = {
    waiting: matrixUiCopyFor(language, {
      en: "waiting for pilot activation",
      ru: "ожидает pilot activation",
      bg: "чака pilot activation",
    }),
    passed: matrixUiCopyFor(language, {
      en: "dry-run passed",
      ru: "dry-run пройден",
      bg: "dry-run премина",
    }),
    blocked: matrixUiCopyFor(language, {
      en: "dry-run blocked",
      ru: "dry-run заблокирован",
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
}: MatrixPrimaryPilotSaveDryRunCardProps) {
  return (
    <article className={`constructor-matrix-preview-card constructor-matrix-save-dry-run-card ${statusTone(result.status)}`}>
      <div className="summary-topline">
        <strong>
          {matrixUiCopyFor(language, {
            en: "Pilot-safe save dry-run",
            ru: "Pilot-safe save dry-run",
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
          ru: "Это проверяет matrix primary pilot как будущий template payload candidate. Не сохраняет, не назначает, не пишет в DB/storage и не меняет production route.",
          bg: "Това валидира matrix primary pilot като бъдещ template payload candidate. Не записва, не назначава, не пише в DB/storage и не променя production route.",
        })}
      </p>

      {result.summary ? (
        <div className="constructor-matrix-count-grid constructor-matrix-save-dry-run-grid">
          {[
            ["days", result.summary.dayCount],
            ["sessions", result.summary.sessionCount],
            ["blocks", result.summary.blockCount],
            ["exercises", result.summary.exerciseCount],
            ["top blocks", result.summary.topLevelBlockCount],
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
            ru: "Dry-run checklist",
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
    </article>
  );
}
