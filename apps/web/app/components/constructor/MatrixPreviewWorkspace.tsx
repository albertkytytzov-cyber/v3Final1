"use client";

import type {
  ConstructorDraft,
  ConstructorMatrixPreviewResponse,
  MatrixConstructorRolloutDecision,
  MatrixPrimaryPilotServerSaveDryRunResponse,
  MatrixPilotReadinessResult,
} from "@training-platform/shared";
import {
  type ActiveConstructorDraftSource,
  type ConstructorMatrixWorkspaceState,
  buildConstructorPreviewDraftMetrics,
  constructorMatrixRolloutBadgeClass,
  constructorMatrixRolloutLabel,
  constructorMatrixWorkspaceScenarioText,
  constructorMatrixWorkspaceWhyText,
  matrixUiCopyFor,
} from "../../lib/constructor-matrix-ui";
import {
  type MatrixPrimaryPilotEligibility,
  matrixPrimaryPilotDisabledReasonText,
} from "../../lib/constructor-matrix-primary-pilot";
import {
  type MatrixPrimaryPilotServerGate,
  matrixPrimaryPilotServerGateReasonText,
} from "../../lib/constructor-matrix-primary-pilot-server-gate";
import type { MatrixPrimaryPilotSaveDryRunResult } from "../../lib/constructor-matrix-save-dry-run";
import type { Language } from "../../lib/i18n";
import { MatrixDraftReadOnlyView } from "./MatrixDraftReadOnlyView";
import { MatrixPrimaryPilotSaveDryRunCard } from "./MatrixPrimaryPilotSaveDryRunCard";
import { MatrixReviewExportActions } from "./MatrixReviewExportActions";

type MatrixPreviewWorkspaceProps = {
  activeDraftSource: ActiveConstructorDraftSource;
  activationDisabledReason: string;
  canActivate: boolean;
  limitedPrimaryPilotEnabled: boolean;
  language: Language;
  onActivateMatrixInternalDraft: () => void;
  onActivateMatrixPrimaryPilotDraft: () => void;
  onCloseWorkspace: () => void;
  onReturnToLegacyDraft: () => void;
  phaseLabel: (phase: ConstructorDraft["plan"]["weeks"][number]["phase"]) => string;
  preview: ConstructorMatrixPreviewResponse | null;
  readiness: MatrixPilotReadinessResult | null;
  matrixPrimaryPilotEligibility: MatrixPrimaryPilotEligibility;
  matrixPrimaryPilotSaveDryRun: MatrixPrimaryPilotSaveDryRunResult;
  matrixPrimaryPilotServerGate: MatrixPrimaryPilotServerGate;
  matrixPrimaryPilotServerSaveDryRun: MatrixPrimaryPilotServerSaveDryRunResponse | null;
  matrixPrimaryPilotServerSaveDryRunError: string;
  rolloutDecision: MatrixConstructorRolloutDecision | null;
  workspace: ConstructorMatrixWorkspaceState;
};

export function MatrixPreviewWorkspace({
  activeDraftSource,
  activationDisabledReason,
  canActivate,
  limitedPrimaryPilotEnabled,
  language,
  onActivateMatrixInternalDraft,
  onActivateMatrixPrimaryPilotDraft,
  onCloseWorkspace,
  onReturnToLegacyDraft,
  phaseLabel,
  preview,
  readiness,
  matrixPrimaryPilotEligibility,
  matrixPrimaryPilotSaveDryRun,
  matrixPrimaryPilotServerGate,
  matrixPrimaryPilotServerSaveDryRun,
  matrixPrimaryPilotServerSaveDryRunError,
  rolloutDecision,
  workspace,
}: MatrixPreviewWorkspaceProps) {
  if (!workspace.open || !workspace.draft) {
    return null;
  }

  const draft = workspace.draft;
  const activeMatrixInternal = activeDraftSource === "matrix_internal";
  const activeMatrixPrimaryPilot = activeDraftSource === "matrix_primary_pilot";
  const activeMatrixCandidate = activeMatrixInternal || activeMatrixPrimaryPilot;
  const metrics = buildConstructorPreviewDraftMetrics(draft);
  const badgeLabel = constructorMatrixRolloutLabel(language, rolloutDecision?.mode) || "internal";
  const whyText = constructorMatrixWorkspaceWhyText(language, rolloutDecision);
  const scenarioText = constructorMatrixWorkspaceScenarioText(language, rolloutDecision);
  const primaryPilotDisabledText = matrixPrimaryPilotEligibility.allowed
    ? matrixPrimaryPilotServerGateReasonText(language, matrixPrimaryPilotServerGate.reason)
    : matrixPrimaryPilotDisabledReasonText(language, matrixPrimaryPilotEligibility.reason);
  const primaryPilotCanActivate =
    matrixPrimaryPilotEligibility.allowed && matrixPrimaryPilotServerGate.allowed;

  return (
    <section className="constructor-panel constructor-matrix-workspace-panel">
      {/* Matrix workspace is display-only: never pass this draft to template/save/assign handlers. */}
      <header className="constructor-matrix-workspace-header">
        <div>
          <span className="eyebrow eyebrow-muted">
            {matrixUiCopyFor(language, {
              en: "New constructor plan review",
              ru: "Проверка плана нового конструктора",
              bg: "Internal matrix preview workspace",
            })}
          </span>
          <h3>
            {matrixUiCopyFor(language, {
              en: "New plan variant",
              ru: "Новый вариант плана",
              bg: "Matrix кандидат чернова",
            })}
          </h3>
          <p>
            {matrixUiCopyFor(language, {
              en: "Review it before choosing whether it can replace the current draft.",
              ru: "Проверьте его перед тем, как использовать вместо текущего черновика.",
              bg: "Read-only, не се записва и не заменя legacy draft.",
            })}
          </p>
        </div>
        <button className="tertiary-button" onClick={onCloseWorkspace} type="button">
          {matrixUiCopyFor(language, {
            en: "Back to current draft",
            ru: "Вернуться к текущему черновику",
            bg: "Затвори matrix workspace",
          })}
        </button>
      </header>

      <div className="constructor-matrix-workspace-badges">
        <span className="constructor-matrix-readonly-badge">
          {matrixUiCopyFor(language, { en: "review", ru: "проверка", bg: "проверка" })}
        </span>
        <span className="constructor-matrix-readonly-badge">
          {matrixUiCopyFor(language, { en: "not saved yet", ru: "ещё не сохранено", bg: "още не е записано" })}
        </span>
        <span className="constructor-matrix-readonly-badge">
          {matrixUiCopyFor(language, { en: "current draft is safe", ru: "текущий черновик сохранён", bg: "текущата чернова е запазена" })}
        </span>
        {limitedPrimaryPilotEnabled ? (
          <>
            <span className="constructor-matrix-primary-pilot-badge">
              {matrixUiCopyFor(language, { en: "limited pilot", ru: "ограниченный пилот", bg: "ограничен pilot" })}
            </span>
            <span className="constructor-matrix-primary-pilot-badge">
              {matrixUiCopyFor(language, { en: "not default", ru: "не по умолчанию", bg: "не по подразбиране" })}
            </span>
            <span className="constructor-matrix-primary-pilot-badge">
              {matrixUiCopyFor(language, { en: "only allowed scenarios", ru: "только разрешённые сценарии", bg: "само разрешени сценарии" })}
            </span>
          </>
        ) : null}
        <span
          className={`constructor-matrix-rollout-badge ${constructorMatrixRolloutBadgeClass(
            rolloutDecision?.mode,
          )}`}
        >
          {badgeLabel}
        </span>
      </div>

      <MatrixReviewExportActions
        contextLabel="workspace"
        language={language}
        preview={preview}
        readiness={readiness}
        rolloutDecision={rolloutDecision}
        workspaceDraft={draft}
      />

      <div className="constructor-matrix-activation-panel">
        <div>
          <strong>
            {activeMatrixPrimaryPilot
              ? matrixUiCopyFor(language, {
                en: "Matrix primary pilot draft is active",
                  ru: "Активен новый план в режиме ограниченного пилота",
                  bg: "Активен matrix primary pilot draft",
                })
              : activeMatrixInternal
              ? matrixUiCopyFor(language, {
                  en: "Matrix is active in the internal draft area",
                  ru: "Новый план открыт в зоне проверки",
                  bg: "Matrix е активен във вътрешната draft зона",
                })
              : matrixUiCopyFor(language, {
                  en: "Use matrix draft in internal workspace",
                  ru: "Показать новый план в основной панели",
                  bg: "Използвай matrix като internal draft",
                })}
          </strong>
          <p>
            {activeMatrixPrimaryPilot
              ? matrixUiCopyFor(language, {
                en: "The main draft panel shows this matrix candidate as a limited primary pilot. It is still not the default path, not saved, and not assigned automatically.",
                  ru: "Основная панель показывает новый вариант как ограниченный пилот. Он ещё не сохраняется и не назначается автоматически.",
                  bg: "Основният draft панел показва този matrix candidate като limited primary pilot. Това не е default path, не се записва и не се назначава автоматично.",
                })
              : activeMatrixInternal
              ? matrixUiCopyFor(language, {
                  en: "The main draft panel now shows this read-only matrix candidate. Legacy draft and template payload are unchanged.",
                  ru: "Основная панель сейчас показывает новый вариант для просмотра. Текущий черновик и шаблон не изменены.",
                  bg: "Основният draft панел показва този read-only matrix candidate. Legacy draft и template payload не са променени.",
                })
              : canActivate
                ? matrixUiCopyFor(language, {
                    en: "Allowed by rollout gate for internal review only. It will not save, assign, or write to storage.",
                    ru: "Разрешено только для проверки. Не сохраняет, не назначает и не пишет данные.",
                    bg: "Разрешено от rollout gate само за internal review. Не записва, не назначава и не пише в storage.",
                  })
                : activationDisabledReason}
          </p>
        </div>
        <div className="constructor-matrix-activation-actions">
          {activeMatrixCandidate ? (
            <button className="secondary-button" onClick={onReturnToLegacyDraft} type="button">
              {matrixUiCopyFor(language, {
                en: "Return to current draft",
                ru: "Вернуться к текущему черновику",
                bg: "Върни legacy draft",
              })}
            </button>
          ) : (
            <button
              className="secondary-button"
              disabled={!canActivate}
              onClick={onActivateMatrixInternalDraft}
              title={activationDisabledReason}
              type="button"
            >
              {matrixUiCopyFor(language, {
                en: "Use matrix draft in internal workspace",
                ru: "Показать новый план в основной панели",
                bg: "Използвай matrix като internal draft",
              })}
            </button>
          )}
          <span className="constructor-matrix-readonly-badge">
            {matrixUiCopyFor(language, { en: "review / no save", ru: "проверка / без сохранения", bg: "проверка / без запис" })}
          </span>
        </div>
      </div>

      {limitedPrimaryPilotEnabled ? (
        <div className="constructor-matrix-activation-panel constructor-matrix-primary-pilot-panel">
          <div>
            <strong>
              {matrixUiCopyFor(language, {
                en: "Limited primary pilot action",
                ru: "Ограниченное применение нового плана",
                bg: "Limited primary pilot action",
              })}
            </strong>
            <p>
              {primaryPilotDisabledText}
            </p>
          </div>
          <div className="constructor-matrix-activation-actions">
            {activeMatrixPrimaryPilot ? (
              <button className="secondary-button" onClick={onReturnToLegacyDraft} type="button">
                {matrixUiCopyFor(language, {
                  en: "Return to legacy draft",
                  ru: "Вернуться к текущему черновику",
                  bg: "Върни legacy draft",
                })}
              </button>
            ) : (
              <button
                className="primary-button"
                disabled={!primaryPilotCanActivate}
                onClick={onActivateMatrixPrimaryPilotDraft}
                title={primaryPilotDisabledText}
                type="button"
              >
                {matrixUiCopyFor(language, {
                  en: "Use matrix as primary pilot draft",
                  ru: "Использовать новый план как пилотный черновик",
                  bg: "Използвай matrix като primary pilot draft",
                })}
              </button>
            )}
            <span className="constructor-matrix-primary-pilot-badge">
              {matrixUiCopyFor(language, { en: "new constructor pilot", ru: "пилот нового конструктора", bg: "pilot нов конструктор" })}
            </span>
            <span className="constructor-matrix-primary-pilot-badge">
              {matrixUiCopyFor(language, { en: "limited", ru: "ограниченно", bg: "ограничено" })}
            </span>
            <span className="constructor-matrix-primary-pilot-badge">
              {matrixUiCopyFor(language, { en: "not default", ru: "не по умолчанию", bg: "не по подразбиране" })}
            </span>
          </div>
          <details className="constructor-matrix-primary-pilot-evidence">
            <summary>
              {matrixUiCopyFor(language, {
                en: "Pilot eligibility checklist",
                ru: "Проверка допуска пилота",
                bg: "Pilot eligibility checklist",
              })}
            </summary>
            <ul className="constructor-matrix-preview-list">
              {matrixPrimaryPilotEligibility.evidence.map((item) => (
                <li key={item.key}>
                  <strong>{item.label}</strong>
                  <span>
                    {item.passed ? "pass" : "stop"} · {item.value}
                  </span>
                </li>
              ))}
            </ul>
          </details>
          <details className="constructor-matrix-primary-pilot-evidence">
            <summary>
              {matrixUiCopyFor(language, {
                en: "Server primary gate checklist",
                ru: "Серверная проверка применения",
                bg: "Server primary gate checklist",
              })}
            </summary>
            <ul className="constructor-matrix-preview-list">
              {matrixPrimaryPilotServerGate.evidence.map((item) => (
                <li key={item.key}>
                  <strong>{item.label}</strong>
                  <span>
                    {item.passed ? "pass" : "stop"} · {item.value}
                  </span>
                </li>
              ))}
            </ul>
          </details>

          <MatrixPrimaryPilotSaveDryRunCard
            language={language}
            result={matrixPrimaryPilotSaveDryRun}
            serverError={matrixPrimaryPilotServerSaveDryRunError}
            serverResult={matrixPrimaryPilotServerSaveDryRun}
          />
        </div>
      ) : null}

      <div className="constructor-matrix-count-grid constructor-matrix-workspace-overview">
        {[
          [matrixUiCopyFor(language, { en: "mode", ru: "режим", bg: "режим" }), rolloutDecision?.mode ?? "-"],
          [matrixUiCopyFor(language, { en: "scenario", ru: "сценарий", bg: "сценарий" }), rolloutDecision?.scenario ?? "-"],
          [
            matrixUiCopyFor(language, { en: "safety", ru: "безопасность", bg: "безопасност" }),
            rolloutDecision?.safeToPreview
              ? matrixUiCopyFor(language, { en: "ok", ru: "пройдена", bg: "ok" })
              : matrixUiCopyFor(language, { en: "stop", ru: "стоп", bg: "стоп" }),
          ],
          [
            matrixUiCopyFor(language, { en: "current", ru: "текущий", bg: "текущ" }),
            rolloutDecision?.defaultPathUnchanged
              ? matrixUiCopyFor(language, { en: "unchanged", ru: "не изменён", bg: "непроменен" })
              : matrixUiCopyFor(language, { en: "changed", ru: "изменён", bg: "променен" }),
          ],
          [matrixUiCopyFor(language, { en: "weeks", ru: "недели", bg: "седмици" }), metrics.weekCount],
          [matrixUiCopyFor(language, { en: "days", ru: "дни", bg: "дни" }), metrics.dayCount],
          [matrixUiCopyFor(language, { en: "sessions", ru: "тренировки", bg: "тренировки" }), metrics.sessionCount],
          [matrixUiCopyFor(language, { en: "blocks", ru: "блоки", bg: "блокове" }), metrics.blockCount],
        ].map(([label, value]) => (
          <span key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </span>
        ))}
      </div>

      <div className="constructor-matrix-workspace-context-grid">
        <article className="constructor-matrix-preview-card">
          <div className="summary-topline">
            <strong>
              {matrixUiCopyFor(language, {
                en: "Why this is not the main draft",
                ru: "Почему это пока не основной черновик",
                bg: "Защо това не е основната чернова",
              })}
            </strong>
            <span>{rolloutDecision?.recommendedAction ?? "-"}</span>
          </div>
          <p>{whyText}</p>
          {scenarioText ? <p className="constructor-matrix-rollout-note">{scenarioText}</p> : null}
          {rolloutDecision?.blockers.length ? (
            <ul className="constructor-matrix-preview-list">
              {rolloutDecision.blockers.map((blocker, index) => (
                <li key={`${blocker.code}-${index}`}>
                  <strong>{blocker.code}</strong>
                  <span>{blocker.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="constructor-matrix-rollout-note">
              {matrixUiCopyFor(language, {
                en: "No rollout blockers were returned, but this workspace remains internal and read-only.",
                ru: "Блокирующих ограничений нет, но этот вариант пока открыт только для проверки.",
                bg: "Няма rollout blockers, но workspace остава internal и read-only.",
              })}
            </p>
          )}
        </article>

        <article className="constructor-matrix-preview-card">
          <div className="summary-topline">
            <strong>
              {matrixUiCopyFor(language, {
                en: "Matrix risks and explanation",
                ru: "Риски и объяснение нового конструктора",
                bg: "Matrix рискове и обяснение",
              })}
            </strong>
            <span>{draft.confidence}</span>
          </div>
          <ul className="constructor-matrix-preview-list">
            {draft.riskFlags.length ? (
              draft.riskFlags.slice(0, 6).map((risk, index) => (
                <li key={`${risk.code}-${index}`}>
                  <strong>
                    {risk.code} · {risk.level}
                  </strong>
                  <span>{risk.message}</span>
                </li>
              ))
            ) : (
              <li>
                <strong>risk</strong>
                <span>
                  {matrixUiCopyFor(language, {
                    en: "No critical risks detected in the matrix candidate.",
                    ru: "Критичных рисков в новом варианте не найдено.",
                    bg: "Няма критични рискове в matrix кандидата.",
                  })}
                </span>
              </li>
            )}
          </ul>
          <div className="constructor-explanation-list constructor-matrix-workspace-explanations">
            <div>
              <span>{matrixUiCopyFor(language, { en: "Decision", ru: "Решение", bg: "Решение" })}</span>
              <p>{draft.explanation.mainDecision}</p>
            </div>
            <div>
              <span>{matrixUiCopyFor(language, { en: "Why now", ru: "Почему сейчас", bg: "Защо сега" })}</span>
              <p>{draft.explanation.whyNow}</p>
            </div>
          </div>
        </article>
      </div>

      <MatrixDraftReadOnlyView
        className="constructor-week-list constructor-matrix-workspace-week-list"
        draft={draft}
        keyPrefix="matrix-workspace"
        phaseLabel={phaseLabel}
      />
    </section>
  );
}
