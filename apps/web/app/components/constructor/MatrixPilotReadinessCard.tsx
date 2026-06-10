"use client";

import type { MatrixPilotReadinessResult } from "@training-platform/shared";
import {
  getPilotReadinessBadgeTone,
  getPilotReadinessLabel,
  getPilotReadinessMeaning,
  matrixUiCopyFor,
  summarizePilotReadinessCounts,
} from "../../lib/constructor-matrix-ui";
import type { Language } from "../../lib/i18n";

type MatrixPilotReadinessCardProps = {
  readiness: MatrixPilotReadinessResult | null;
  language: Language;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  compact?: boolean;
  safeToPreview?: boolean | null;
  defaultPathUnchanged?: boolean | null;
};

export function MatrixPilotReadinessCard({
  readiness,
  language,
  loading = false,
  error = "",
  onRetry,
  compact = false,
  safeToPreview,
  defaultPathUnchanged,
}: MatrixPilotReadinessCardProps) {
  const badgeTone = getPilotReadinessBadgeTone(readiness?.status);
  const badgeLabel = getPilotReadinessLabel(language, readiness?.status);
  const meaning = getPilotReadinessMeaning(language, readiness?.status);
  const counts = summarizePilotReadinessCounts(readiness);

  return (
    <article
      className={`constructor-matrix-preview-card constructor-matrix-pilot-readiness-card ${
        compact ? "is-compact" : ""
      }`}
    >
      <div className="summary-topline">
        <strong>
          {matrixUiCopyFor(language, {
            en: "Pilot readiness",
            ru: "Pilot readiness",
            bg: "Pilot readiness",
          })}
        </strong>
        <span className={`constructor-matrix-pilot-readiness-badge ${badgeTone}`}>
          {loading
            ? matrixUiCopyFor(language, { en: "Loading", ru: "Загрузка", bg: "Зареждане" })
            : badgeLabel}
        </span>
      </div>

      {readiness ? (
        <>
          <div className="constructor-matrix-count-grid constructor-matrix-pilot-grid">
            {[
              ["status", readiness.status],
              ["scenario", readiness.scenario],
              ["rollout", readiness.rolloutMode],
              ["action", readiness.recommendedAction],
              ["safe", safeToPreview === null || safeToPreview === undefined ? "-" : safeToPreview ? "yes" : "no"],
              [
                "default",
                defaultPathUnchanged === null || defaultPathUnchanged === undefined
                  ? "-"
                  : defaultPathUnchanged
                    ? "unchanged"
                    : "changed",
              ],
            ].map(([label, value]) => (
              <span key={label}>
                <small>{label}</small>
                <strong>{value}</strong>
              </span>
            ))}
          </div>

          <div className="constructor-matrix-count-grid constructor-matrix-pilot-counts">
            {counts.map((item) => (
              <span key={item.label}>
                <small>{item.label}</small>
                <strong>{item.value}</strong>
              </span>
            ))}
          </div>

          <p className="constructor-matrix-rollout-note">{meaning}</p>
          <p>
            {matrixUiCopyFor(language, {
              en: "This card is display-only. It does not enable matrix primary, save, assign, or change rollout rules.",
              ru: "Эта карточка только показывает readiness. Она не включает matrix primary, save, assign и не меняет rollout rules.",
              bg: "Тази карта е само display. Не включва matrix primary, save, assign и не променя rollout rules.",
            })}
          </p>

          {readiness.blockers.length ? (
            <div className="constructor-matrix-pilot-section">
              <strong>
                {matrixUiCopyFor(language, {
                  en: "Blockers",
                  ru: "Blockers",
                  bg: "Blockers",
                })}
              </strong>
              <ul className="constructor-matrix-difference-list">
                {readiness.blockers.map((blocker, index) => (
                  <li
                    className={`constructor-matrix-difference constructor-matrix-severity-${blocker.severity}`}
                    key={`${blocker.id}-${index}`}
                  >
                    <div>
                      <strong>{blocker.id}</strong>
                      <span>{blocker.severity}</span>
                    </div>
                    <p>{blocker.message}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="constructor-matrix-rollout-note">
              {matrixUiCopyFor(language, {
                en: "No readiness blockers were returned.",
                ru: "Readiness blockers не вернулись.",
                bg: "Няма readiness blockers.",
              })}
            </p>
          )}

          <details className="constructor-matrix-pilot-checklist">
            <summary>
              {matrixUiCopyFor(language, {
                en: "Checklist details",
                ru: "Checklist details",
                bg: "Checklist details",
              })}
            </summary>
            <ul className="constructor-matrix-difference-list">
              {readiness.checklist.map((item) => (
                <li
                  className={`constructor-matrix-difference constructor-matrix-severity-${item.severity}`}
                  key={item.id}
                >
                  <div>
                    <strong>{item.label}</strong>
                    <span>
                      {item.status} · {item.severity}
                    </span>
                  </div>
                  <p>{item.explanation}</p>
                  {item.evidence.length ? <small>{item.evidence.slice(0, 4).join(" · ")}</small> : null}
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : (
        <>
          <p>
            {error ||
              matrixUiCopyFor(language, {
                en: "Pilot readiness unavailable until preview and rollout decision are loaded.",
                ru: "Pilot readiness недоступен, пока не загружены preview и rollout decision.",
                bg: "Pilot readiness не е наличен преди preview и rollout decision.",
              })}
          </p>
          {onRetry ? (
            <button className="secondary-button" disabled={loading} onClick={onRetry} type="button">
              {matrixUiCopyFor(language, {
                en: "Retry matrix preview",
                ru: "Повторить matrix-preview",
                bg: "Повтори matrix-preview",
              })}
            </button>
          ) : null}
        </>
      )}
    </article>
  );
}
