"use client";

import type {
  ConstructorDraft,
  ConstructorMatrixPreviewResponse,
  MatrixConstructorRolloutDecision,
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

  return (
    <section className="constructor-panel constructor-matrix-workspace-panel">
      {/* Matrix workspace is display-only: never pass this draft to template/save/assign handlers. */}
      <header className="constructor-matrix-workspace-header">
        <div>
          <span className="eyebrow eyebrow-muted">
            {matrixUiCopyFor(language, {
              en: "Internal matrix preview workspace",
              ru: "Internal matrix preview workspace",
              bg: "Internal matrix preview workspace",
            })}
          </span>
          <h3>
            {matrixUiCopyFor(language, {
              en: "Matrix candidate draft",
              ru: "Matrix-кандидат черновика",
              bg: "Matrix кандидат чернова",
            })}
          </h3>
          <p>
            {matrixUiCopyFor(language, {
              en: "Read-only, not saved, and does not replace the legacy draft.",
              ru: "Read-only, не сохраняется и не заменяет legacy draft.",
              bg: "Read-only, не се записва и не заменя legacy draft.",
            })}
          </p>
        </div>
        <button className="tertiary-button" onClick={onCloseWorkspace} type="button">
          {matrixUiCopyFor(language, {
            en: "Close matrix workspace",
            ru: "Вернуться к legacy draft",
            bg: "Затвори matrix workspace",
          })}
        </button>
      </header>

      <div className="constructor-matrix-workspace-badges">
        <span className="constructor-matrix-readonly-badge">read-only</span>
        <span className="constructor-matrix-readonly-badge">not saved</span>
        <span className="constructor-matrix-readonly-badge">does not replace legacy</span>
        {limitedPrimaryPilotEnabled ? (
          <>
            <span className="constructor-matrix-primary-pilot-badge">limited pilot</span>
            <span className="constructor-matrix-primary-pilot-badge">not default</span>
            <span className="constructor-matrix-primary-pilot-badge">allowed scenario only</span>
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
                  ru: "Активен matrix primary pilot draft",
                  bg: "Активен matrix primary pilot draft",
                })
              : activeMatrixInternal
              ? matrixUiCopyFor(language, {
                  en: "Matrix is active in the internal draft area",
                  ru: "Matrix активен во внутренней draft-зоне",
                  bg: "Matrix е активен във вътрешната draft зона",
                })
              : matrixUiCopyFor(language, {
                  en: "Use matrix draft in internal workspace",
                  ru: "Использовать matrix как internal draft",
                  bg: "Използвай matrix като internal draft",
                })}
          </strong>
          <p>
            {activeMatrixPrimaryPilot
              ? matrixUiCopyFor(language, {
                  en: "The main draft panel shows this matrix candidate as a limited primary pilot. It is still not the default path, not saved, and not assigned automatically.",
                  ru: "Основная draft-панель показывает этот matrix candidate как limited primary pilot. Это всё ещё не default path, не сохраняется и не назначается автоматически.",
                  bg: "Основният draft панел показва този matrix candidate като limited primary pilot. Това не е default path, не се записва и не се назначава автоматично.",
                })
              : activeMatrixInternal
              ? matrixUiCopyFor(language, {
                  en: "The main draft panel now shows this read-only matrix candidate. Legacy draft and template payload are unchanged.",
                  ru: "Основная draft-панель сейчас показывает этот read-only matrix candidate. Legacy draft и template payload не изменены.",
                  bg: "Основният draft панел показва този read-only matrix candidate. Legacy draft и template payload не са променени.",
                })
              : canActivate
                ? matrixUiCopyFor(language, {
                    en: "Allowed by rollout gate for internal review only. It will not save, assign, or write to storage.",
                    ru: "Разрешено rollout gate только для internal review. Не сохраняет, не назначает и не пишет в storage.",
                    bg: "Разрешено от rollout gate само за internal review. Не записва, не назначава и не пише в storage.",
                  })
                : activationDisabledReason}
          </p>
        </div>
        <div className="constructor-matrix-activation-actions">
          {activeMatrixCandidate ? (
            <button className="secondary-button" onClick={onReturnToLegacyDraft} type="button">
              {matrixUiCopyFor(language, {
                en: "Return to legacy draft",
                ru: "Вернуться к legacy draft",
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
                ru: "Использовать matrix как internal draft",
                bg: "Използвай matrix като internal draft",
              })}
            </button>
          )}
          <span className="constructor-matrix-readonly-badge">read-only / no save</span>
        </div>
      </div>

      {limitedPrimaryPilotEnabled ? (
        <div className="constructor-matrix-activation-panel constructor-matrix-primary-pilot-panel">
          <div>
            <strong>
              {matrixUiCopyFor(language, {
                en: "Limited primary pilot action",
                ru: "Limited primary pilot action",
                bg: "Limited primary pilot action",
              })}
            </strong>
            <p>
              {matrixPrimaryPilotDisabledReasonText(language, matrixPrimaryPilotEligibility.reason)}
            </p>
          </div>
          <div className="constructor-matrix-activation-actions">
            {activeMatrixPrimaryPilot ? (
              <button className="secondary-button" onClick={onReturnToLegacyDraft} type="button">
                {matrixUiCopyFor(language, {
                  en: "Return to legacy draft",
                  ru: "Вернуться к legacy draft",
                  bg: "Върни legacy draft",
                })}
              </button>
            ) : (
              <button
                className="primary-button"
                disabled={!matrixPrimaryPilotEligibility.allowed}
                onClick={onActivateMatrixPrimaryPilotDraft}
                title={matrixPrimaryPilotDisabledReasonText(language, matrixPrimaryPilotEligibility.reason)}
                type="button"
              >
                {matrixUiCopyFor(language, {
                  en: "Use matrix as primary pilot draft",
                  ru: "Использовать matrix как primary pilot draft",
                  bg: "Използвай matrix като primary pilot draft",
                })}
              </button>
            )}
            <span className="constructor-matrix-primary-pilot-badge">Matrix primary pilot</span>
            <span className="constructor-matrix-primary-pilot-badge">Limited pilot</span>
            <span className="constructor-matrix-primary-pilot-badge">Not default</span>
          </div>
          <details className="constructor-matrix-primary-pilot-evidence">
            <summary>
              {matrixUiCopyFor(language, {
                en: "Pilot eligibility checklist",
                ru: "Pilot eligibility checklist",
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

          <MatrixPrimaryPilotSaveDryRunCard
            language={language}
            result={matrixPrimaryPilotSaveDryRun}
          />
        </div>
      ) : null}

      <div className="constructor-matrix-count-grid constructor-matrix-workspace-overview">
        {[
          ["mode", rolloutDecision?.mode ?? "-"],
          ["scenario", rolloutDecision?.scenario ?? "-"],
          ["safe", rolloutDecision?.safeToPreview ? "yes" : "no"],
          ["default", rolloutDecision?.defaultPathUnchanged ? "unchanged" : "changed"],
          ["weeks", metrics.weekCount],
          ["days", metrics.dayCount],
          ["sessions", metrics.sessionCount],
          ["blocks", metrics.blockCount],
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
                ru: "Почему это не основной draft",
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
                ru: "Rollout blockers не вернулись, но workspace остаётся internal и read-only.",
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
                ru: "Matrix риски и объяснение",
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
                    ru: "Критичных рисков в matrix-кандидате не найдено.",
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
