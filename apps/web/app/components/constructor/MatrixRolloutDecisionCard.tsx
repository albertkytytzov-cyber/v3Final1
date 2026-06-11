"use client";

import type { MatrixConstructorRolloutDecision } from "@training-platform/shared";
import {
  constructorMatrixActionLabel,
  constructorMatrixBlockerMessage,
  constructorMatrixRolloutBadgeClass,
  constructorMatrixRolloutLabel,
  constructorMatrixRolloutSupportText,
  constructorMatrixModeLabel,
  constructorMatrixScenarioLabel,
  constructorMatrixSeverityLabel,
  constructorMatrixTrainerText,
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
            en: "Use decision",
            ru: "Решение по применению",
            bg: "Решение за приложение",
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
              [
                matrixUiCopyFor(language, { en: "mode", ru: "режим", bg: "режим" }),
                constructorMatrixModeLabel(language, decision.mode),
              ],
              [
                matrixUiCopyFor(language, { en: "scenario", ru: "сценарий", bg: "сценарий" }),
                constructorMatrixScenarioLabel(language, decision.scenario),
              ],
              [
                matrixUiCopyFor(language, { en: "action", ru: "действие", bg: "действие" }),
                constructorMatrixActionLabel(language, decision.recommendedAction),
              ],
              [
                matrixUiCopyFor(language, { en: "apply", ru: "применение", bg: "прилагане" }),
                decision.matrixPrimaryAllowed
                  ? matrixUiCopyFor(language, { en: "allowed", ru: "разрешено", bg: "разрешено" })
                  : matrixUiCopyFor(language, { en: "not allowed", ru: "не разрешено", bg: "не разрешено" }),
              ],
              [
                matrixUiCopyFor(language, { en: "allowed case", ru: "разрешённый случай", bg: "разрешен случай" }),
                decision.allowlisted
                  ? matrixUiCopyFor(language, { en: "yes", ru: "да", bg: "да" })
                  : matrixUiCopyFor(language, { en: "no", ru: "нет", bg: "не" }),
              ],
              [
                matrixUiCopyFor(language, { en: "safety", ru: "безопасность", bg: "безопасност" }),
                decision.safeToPreview
                  ? matrixUiCopyFor(language, { en: "ok", ru: "пройдена", bg: "ok" })
                  : matrixUiCopyFor(language, { en: "stop", ru: "стоп", bg: "стоп" }),
              ],
              [
                matrixUiCopyFor(language, { en: "limits", ru: "ограничения", bg: "ограничения" }),
                decision.blockers.length,
              ],
            ].map(([label, value]) => (
              <span key={label}>
                <small>{label}</small>
                <strong>{value}</strong>
              </span>
            ))}
          </div>
          <p>{constructorMatrixTrainerText(language, decision.explanation.headline)}</p>
          {supportText ? <p className="constructor-matrix-rollout-note">{supportText}</p> : null}
          <ul className="constructor-matrix-preview-list">
            {decision.explanation.reasons.slice(0, 5).map((reason) => (
              <li key={reason}>
                <strong>
                  {matrixUiCopyFor(language, { en: "reason", ru: "причина", bg: "причина" })}
                </strong>
                <span>{constructorMatrixTrainerText(language, reason)}</span>
              </li>
            ))}
            <li>
              <strong>{matrixUiCopyFor(language, { en: "next", ru: "дальше", bg: "следващо" })}</strong>
              <span>{constructorMatrixTrainerText(language, decision.explanation.nextStep)}</span>
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
                    <span>{constructorMatrixSeverityLabel(language, blocker.severity)}</span>
                  </div>
                  <p>{constructorMatrixBlockerMessage(language, blocker.code, blocker.message)}</p>
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
                en: "Open new plan variant",
                ru: "Открыть новый вариант плана",
                bg: "Отвори новия вариант на плана",
              })}
            </button>
            <p className="constructor-matrix-rollout-note">
              {workspaceCanOpen
                ? matrixUiCopyFor(language, {
                    en: "Available for review. It will not save, assign, or replace the safe plan until the safety gate allows it.",
                    ru: "Доступно для проверки. Не сохраняет, не назначает и не заменяет безопасный план, пока это не разрешит проверка безопасности.",
                    bg: "Достъпно е за проверка. Не записва, не назначава и не заменя безопасния план, докато проверката за безопасност не го разреши.",
                  })
                : workspaceUnavailableReason}
            </p>
          </div>
        </>
      ) : (
        <p>
          {matrixUiCopyFor(language, {
            en: "The use decision will appear after the comparison finishes.",
            ru: "Решение по применению появится после сравнения нового конструктора.",
            bg: "Решението за приложение ще се появи след сравнението на новия конструктор.",
          })}
        </p>
      )}
    </article>
  );
}
