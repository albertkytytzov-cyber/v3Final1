"use client";

import type { MatrixConstructorRolloutDecision } from "@training-platform/shared";
import {
  constructorMatrixRolloutBadgeClass,
  constructorMatrixRolloutLabel,
  constructorMatrixRolloutSupportText,
  matrixUiCopyFor,
} from "../../lib/constructor-matrix-ui";
import type { Language } from "../../lib/i18n";

type MatrixRolloutDecisionCardProps = {
  decision: MatrixConstructorRolloutDecision | null;
  language: Language;
  workspaceCanOpen: boolean;
  workspaceUnavailableReason: string;
  onOpenWorkspace: () => void;
};

export function MatrixRolloutDecisionCard({
  decision,
  language,
  workspaceCanOpen,
  workspaceUnavailableReason,
  onOpenWorkspace,
}: MatrixRolloutDecisionCardProps) {
  const badgeLabel = constructorMatrixRolloutLabel(language, decision?.mode);
  const supportText = constructorMatrixRolloutSupportText(language, decision);

  return (
    <article className="constructor-matrix-preview-card constructor-matrix-rollout-card">
      <div className="summary-topline">
        <strong>
          {matrixUiCopyFor(language, {
            en: "Rollout decision",
            ru: "Rollout decision",
            bg: "Rollout decision",
          })}
        </strong>
        {decision ? (
          <span
            className={`constructor-matrix-rollout-badge ${constructorMatrixRolloutBadgeClass(
              decision.mode,
            )}`}
          >
            {badgeLabel}
          </span>
        ) : (
          <span>
            {matrixUiCopyFor(language, {
              en: "not loaded",
              ru: "не загружено",
              bg: "не е заредено",
            })}
          </span>
        )}
      </div>
      {decision ? (
        <>
          <div className="constructor-matrix-count-grid constructor-matrix-rollout-grid">
            {[
              ["mode", decision.mode],
              ["scenario", decision.scenario],
              ["action", decision.recommendedAction],
              ["primary", decision.matrixPrimaryAllowed ? "allowed" : "not allowed"],
              ["allowlisted", decision.allowlisted ? "yes" : "no"],
              ["safe", decision.safeToPreview ? "yes" : "no"],
              ["blockers", decision.blockers.length],
            ].map(([label, value]) => (
              <span key={label}>
                <small>{label}</small>
                <strong>{value}</strong>
              </span>
            ))}
          </div>
          <p>{decision.explanation.headline}</p>
          {supportText ? <p className="constructor-matrix-rollout-note">{supportText}</p> : null}
          <ul className="constructor-matrix-preview-list">
            {decision.explanation.reasons.slice(0, 5).map((reason) => (
              <li key={reason}>
                <strong>reason</strong>
                <span>{reason}</span>
              </li>
            ))}
            <li>
              <strong>next</strong>
              <span>{decision.explanation.nextStep}</span>
            </li>
          </ul>
          {decision.blockers.length ? (
            <ul className="constructor-matrix-difference-list">
              {decision.blockers.map((blocker, index) => (
                <li
                  className={`constructor-matrix-difference constructor-matrix-severity-${blocker.severity}`}
                  key={`${blocker.code}-${index}`}
                >
                  <div>
                    <strong>{blocker.code}</strong>
                    <span>{blocker.severity}</span>
                  </div>
                  <p>{blocker.message}</p>
                  {blocker.details?.length ? <small>{blocker.details.slice(0, 3).join(" · ")}</small> : null}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="constructor-matrix-workspace-actions">
            <button
              className="secondary-button"
              disabled={!workspaceCanOpen}
              title={workspaceUnavailableReason}
              onClick={onOpenWorkspace}
              type="button"
            >
              {matrixUiCopyFor(language, {
                en: "Open matrix candidate in preview workspace",
                ru: "Показать matrix-кандидат в preview workspace",
                bg: "Покажи matrix кандидата в preview workspace",
              })}
            </button>
            <p className="constructor-matrix-rollout-note">
              {workspaceCanOpen
                ? matrixUiCopyFor(language, {
                    en: "Available as read-only internal workspace. It will not save, assign, or replace the legacy draft.",
                    ru: "Доступно только как read-only internal workspace. Не сохраняет, не назначает и не заменяет legacy draft.",
                    bg: "Достъпно само като read-only internal workspace. Не записва, не назначава и не заменя legacy draft.",
                  })
                : workspaceUnavailableReason}
            </p>
          </div>
        </>
      ) : (
        <p>
          {matrixUiCopyFor(language, {
            en: "Rollout gate will appear after the internal comparison request finishes.",
            ru: "Rollout gate появится после выполнения internal comparison request.",
            bg: "Rollout gate ще се появи след internal comparison request.",
          })}
        </p>
      )}
    </article>
  );
}
