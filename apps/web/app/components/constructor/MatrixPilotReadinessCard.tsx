"use client";

import type { MatrixPilotReadinessResult } from "@training-platform/shared";
import {
  constructorMatrixActionLabel,
  constructorMatrixModeLabel,
  constructorMatrixPassStopLabel,
  constructorMatrixReadinessStatusLabel,
  constructorMatrixScenarioLabel,
  constructorMatrixSeverityLabel,
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
  const counts = summarizePilotReadinessCounts(language, readiness);

  return (
    <article
      className={`constructor-matrix-preview-card constructor-matrix-pilot-readiness-card ${
        compact ? "is-compact" : ""
      }`}
    >
      <div className="summary-topline">
        <strong>
          {matrixUiCopyFor(language, {
            en: "Readiness to use",
            ru: "Готовность к применению",
            bg: "Готовност за приложение",
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
              [
                matrixUiCopyFor(language, { en: "status", ru: "статус", bg: "статус" }),
                constructorMatrixReadinessStatusLabel(language, readiness.status),
              ],
              [
                matrixUiCopyFor(language, { en: "scenario", ru: "сценарий", bg: "сценарий" }),
                constructorMatrixScenarioLabel(language, readiness.scenario),
              ],
              [
                matrixUiCopyFor(language, { en: "mode", ru: "режим", bg: "режим" }),
                constructorMatrixModeLabel(language, readiness.rolloutMode),
              ],
              [
                matrixUiCopyFor(language, { en: "action", ru: "действие", bg: "действие" }),
                constructorMatrixActionLabel(language, readiness.recommendedAction),
              ],
              [
                matrixUiCopyFor(language, { en: "safety", ru: "безопасность", bg: "безопасност" }),
                safeToPreview === null || safeToPreview === undefined
                  ? "-"
                  : safeToPreview
                    ? matrixUiCopyFor(language, { en: "ok", ru: "пройдена", bg: "ok" })
                    : matrixUiCopyFor(language, { en: "stop", ru: "стоп", bg: "стоп" }),
              ],
              [
                matrixUiCopyFor(language, { en: "current", ru: "текущий", bg: "текущ" }),
                defaultPathUnchanged === null || defaultPathUnchanged === undefined
                  ? "-"
                  : defaultPathUnchanged
                    ? matrixUiCopyFor(language, { en: "unchanged", ru: "не изменён", bg: "непроменен" })
                    : matrixUiCopyFor(language, { en: "changed", ru: "изменён", bg: "променен" }),
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
              en: "This card only shows readiness. It does not enable saving, assignment, or change use rules.",
              ru: "Эта карточка только показывает готовность. Она сама не включает сохранение, назначение и не меняет правила применения.",
              bg: "Тази карта само показва готовността. Тя не включва запис, назначаване и не променя правилата за приложение.",
            })}
          </p>

          {readiness.blockers.length ? (
            <div className="constructor-matrix-pilot-section">
              <strong>
                {matrixUiCopyFor(language, {
                  en: "Blockers",
                  ru: "Блокеры",
                  bg: "Ограничения",
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
                      <span>{constructorMatrixSeverityLabel(language, blocker.severity)}</span>
                    </div>
                    <p>{blocker.message}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="constructor-matrix-rollout-note">
              {matrixUiCopyFor(language, {
                en: "No blocking readiness problems were returned.",
                ru: "Блокирующих проблем готовности нет.",
                bg: "Няма блокиращи проблеми с готовността.",
              })}
            </p>
          )}

          <details className="constructor-matrix-pilot-checklist">
            <summary>
              {matrixUiCopyFor(language, {
                en: "Checklist details",
                ru: "Детали проверки",
                bg: "Детайли на проверката",
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
                      {constructorMatrixPassStopLabel(language, item.status === "pass")} ·{" "}
                      {constructorMatrixSeverityLabel(language, item.severity)}
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
                en: "Readiness is unavailable until comparison and use decision are loaded.",
                ru: "Готовность недоступна, пока не выполнено сравнение нового конструктора.",
                bg: "Готовността не е налична преди сравнението и решението за приложение.",
              })}
          </p>
          {onRetry ? (
            <button className="secondary-button" disabled={loading} onClick={onRetry} type="button">
              {matrixUiCopyFor(language, {
                en: "Repeat comparison",
                ru: "Повторить сравнение",
                bg: "Повтори сравнението",
              })}
            </button>
          ) : null}
        </>
      )}
    </article>
  );
}
