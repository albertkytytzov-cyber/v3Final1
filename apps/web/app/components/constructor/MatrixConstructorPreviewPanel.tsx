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
  buildConstructorPreviewDecisionSummary,
  buildConstructorPreviewDraftMetrics,
  collectConstructorMatrixCandidateSummary,
  constructorMatrixRolloutLabel,
  formatConstructorPreviewAffected,
  getConstructorMatrixPreviewMatrixDraft,
  isConstructorMatrixReadOnlyCandidateVisible,
  matrixUiCopyFor,
} from "../../lib/constructor-matrix-ui";
import type { MatrixPrimaryPilotEligibility } from "../../lib/constructor-matrix-primary-pilot";
import type { Language } from "../../lib/i18n";
import { MatrixPilotReadinessCard } from "./MatrixPilotReadinessCard";
import { MatrixPreviewWorkspace } from "./MatrixPreviewWorkspace";
import { MatrixReviewExportActions } from "./MatrixReviewExportActions";
import { MatrixRolloutDecisionCard } from "./MatrixRolloutDecisionCard";

type MatrixConstructorPreviewPanelProps = {
  activeDraftSource: ActiveConstructorDraftSource;
  activationDisabledReason: string;
  canActivateMatrixInternalDraft: boolean;
  includeInfoDifferences: boolean;
  language: Language;
  limitedPrimaryPilotEnabled: boolean;
  loadingLabel: string;
  onActivateMatrixInternalDraft: () => void;
  onActivateMatrixPrimaryPilotDraft: () => void;
  onBuildPreview: () => void;
  onCloseWorkspace: () => void;
  onIncludeInfoDifferencesChange: (value: boolean) => void;
  onOpenWorkspace: () => void;
  onReturnToLegacyDraft: () => void;
  phaseLabel: (phase: ConstructorDraft["plan"]["weeks"][number]["phase"]) => string;
  preview: ConstructorMatrixPreviewResponse | null;
  previewBusy: boolean;
  previewError: string;
  pilotReadiness: MatrixPilotReadinessResult | null;
  pilotReadinessError: string;
  matrixPrimaryPilotEligibility: MatrixPrimaryPilotEligibility;
  rolloutDecision: MatrixConstructorRolloutDecision | null;
  rolloutError: string;
  selectedCoachAthleteAvailable: boolean;
  workspace: ConstructorMatrixWorkspaceState;
  workspaceCanOpen: boolean;
  workspaceUnavailableReason: string;
};

export function MatrixConstructorPreviewPanel({
  activeDraftSource,
  activationDisabledReason,
  canActivateMatrixInternalDraft,
  includeInfoDifferences,
  language,
  limitedPrimaryPilotEnabled,
  loadingLabel,
  onActivateMatrixInternalDraft,
  onActivateMatrixPrimaryPilotDraft,
  onBuildPreview,
  onCloseWorkspace,
  onIncludeInfoDifferencesChange,
  onOpenWorkspace,
  onReturnToLegacyDraft,
  phaseLabel,
  preview,
  previewBusy,
  previewError,
  pilotReadiness,
  pilotReadinessError,
  matrixPrimaryPilotEligibility,
  rolloutDecision,
  rolloutError,
  selectedCoachAthleteAvailable,
  workspace,
  workspaceCanOpen,
  workspaceUnavailableReason,
}: MatrixConstructorPreviewPanelProps) {
  const legacyMetrics = buildConstructorPreviewDraftMetrics(
    preview?.legacyDraft ?? preview?.comparisonReport?.legacyDraft ?? null,
  );
  const matrixDraft = getConstructorMatrixPreviewMatrixDraft(preview);
  const matrixMetrics = buildConstructorPreviewDraftMetrics(matrixDraft);
  const candidateSummary = collectConstructorMatrixCandidateSummary(matrixDraft);
  const previewDecision = preview ? buildConstructorPreviewDecisionSummary(preview) : null;
  const differences = preview?.comparisonReport?.differences ?? [];
  const failedSafety = preview?.safetyInvariants?.filter((item) => !item.passed) ?? [];
  const failedLegacyGuard = preview?.legacyDefaultGuard?.filter((item) => !item.passed) ?? [];
  const readOnlyCandidateVisible = isConstructorMatrixReadOnlyCandidateVisible({
    decision: rolloutDecision,
    preview,
    matrixDraft,
  });
  const rolloutBadgeLabel = constructorMatrixRolloutLabel(language, rolloutDecision?.mode);
  return (
    <>
      <details className="constructor-panel constructor-matrix-preview-panel">
        <summary>
          <div>
            <strong>
              {matrixUiCopyFor(language, {
                en: "Matrix preview / internal",
                ru: "Сравнение legacy vs matrix - internal",
                bg: "Matrix preview / internal",
              })}
            </strong>
            <span>
              {matrixUiCopyFor(language, {
                en: "Experimental side-by-side QA. Does not save or replace the draft.",
                ru: "Экспериментальная QA-панель. Не сохраняет и не заменяет черновик.",
                bg: "Експериментален QA панел. Не записва и не заменя черновата.",
              })}
            </span>
          </div>
          <span className="constructor-source-badge">
            {matrixUiCopyFor(language, { en: "internal", ru: "internal", bg: "internal" })}
          </span>
        </summary>

        <div className="constructor-matrix-preview-actions">
          <button
            className="secondary-button"
            disabled={previewBusy || !selectedCoachAthleteAvailable}
            onClick={onBuildPreview}
            type="button"
          >
            {previewBusy
              ? loadingLabel
              : preview || previewError
                ? matrixUiCopyFor(language, {
                    en: "Retry matrix preview",
                    ru: "Повторить matrix-preview",
                    bg: "Повтори matrix-preview",
                  })
                : matrixUiCopyFor(language, {
                    en: "Compare legacy vs matrix",
                    ru: "Сравнить legacy vs matrix",
                    bg: "Сравни legacy vs matrix",
                  })}
          </button>
          <label>
            <input
              checked={includeInfoDifferences}
              type="checkbox"
              onChange={(event) => onIncludeInfoDifferencesChange(event.target.checked)}
            />
            <span>
              {matrixUiCopyFor(language, {
                en: "Include info differences",
                ru: "Показывать info-различия",
                bg: "Показвай info разлики",
              })}
            </span>
          </label>
        </div>

        {previewError ? (
          <div className="constructor-matrix-preview-error">
            <strong>
              {matrixUiCopyFor(language, {
                en: "Internal preview failed",
                ru: "Internal-preview не прошёл",
                bg: "Internal-preview не мина",
              })}
            </strong>
            <p>{previewError}</p>
          </div>
        ) : null}

        {rolloutError ? (
          <div className="constructor-matrix-preview-error constructor-matrix-rollout-error">
            <strong>
              {matrixUiCopyFor(language, {
                en: "Rollout decision unavailable",
                ru: "Rollout decision недоступен",
                bg: "Rollout decision не е наличен",
              })}
            </strong>
            <p>{rolloutError}</p>
          </div>
        ) : null}

        {!preview ? (
          <MatrixPilotReadinessCard
            compact
            error={matrixUiCopyFor(language, {
              en: "Pilot readiness unavailable until preview and rollout decision are loaded.",
              ru: "Pilot readiness недоступен, пока не загружены preview и rollout decision.",
              bg: "Pilot readiness не е наличен преди preview и rollout decision.",
            })}
            language={language}
            loading={previewBusy}
            onRetry={selectedCoachAthleteAvailable ? onBuildPreview : undefined}
            readiness={null}
          />
        ) : null}

        {preview ? (
          <div className="constructor-matrix-preview-body">
            <div className="constructor-matrix-preview-grid">
              <article className="constructor-matrix-preview-card">
                <div className="summary-topline">
                  <strong>{matrixUiCopyFor(language, { en: "Summary", ru: "Сводка", bg: "Сводка" })}</strong>
                  <span>{preview.generatedAt}</span>
                </div>
                <div className="constructor-matrix-status-row">
                  <span className={`status-chip ${preview.safeToPreview ? "green" : "warning"}`}>
                    safeToPreview: {preview.safeToPreview ? "yes" : "no"}
                  </span>
                  <span className={`status-chip ${preview.defaultPathUnchanged ? "green" : "danger"}`}>
                    defaultPathUnchanged: {preview.defaultPathUnchanged ? "yes" : "no"}
                  </span>
                </div>
                <div className="constructor-matrix-count-grid">
                  {[
                    ["errors", preview.summary.errorCount],
                    ["warnings", preview.summary.warningCount],
                    ["expected", preview.summary.expectedDifferenceCount],
                    ["total", preview.summary.totalDifferences],
                  ].map(([label, value]) => (
                    <span key={label}>
                      <small>{label}</small>
                      <strong>{value}</strong>
                    </span>
                  ))}
                </div>
                <p>{preview.summary.headline}</p>
              </article>

              <article className="constructor-matrix-preview-card">
                <div className="summary-topline">
                  <strong>
                    {matrixUiCopyFor(language, { en: "Safety", ru: "Безопасность", bg: "Безопасност" })}
                  </strong>
                  <span>
                    {preview.safety.errorCount === 0
                      ? matrixUiCopyFor(language, { en: "no errors", ru: "без ошибок", bg: "без грешки" })
                      : matrixUiCopyFor(language, { en: "attention", ru: "внимание", bg: "внимание" })}
                  </span>
                </div>
                <div className="constructor-matrix-status-row">
                  <span className={`status-chip ${preview.safety.matrixSafetyPassed ? "green" : "danger"}`}>
                    matrix: {preview.safety.matrixSafetyPassed ? "passed" : "failed"}
                  </span>
                  <span className={`status-chip ${preview.safety.legacyDefaultGuardPassed ? "green" : "danger"}`}>
                    legacy guard: {preview.safety.legacyDefaultGuardPassed ? "passed" : "failed"}
                  </span>
                </div>
                <ul className="constructor-matrix-preview-list">
                  {[...failedSafety, ...failedLegacyGuard].length ? (
                    [...failedSafety, ...failedLegacyGuard].map((item) => (
                      <li key={`${item.code}-${item.explanation}`}>
                        <strong>{item.code}</strong>
                        <span>{item.explanation}</span>
                      </li>
                    ))
                  ) : (
                    <li>
                      <strong>
                        {matrixUiCopyFor(language, {
                          en: "No failed invariants",
                          ru: "Нет проваленных инвариантов",
                          bg: "Няма неуспешни инварианти",
                        })}
                      </strong>
                      <span>
                        {matrixUiCopyFor(language, {
                          en: "Backend safety guards passed for this internal preview.",
                          ru: "Backend safety guards пройдены для этого internal-preview.",
                          bg: "Backend safety guards са преминали за този internal-preview.",
                        })}
                      </span>
                    </li>
                  )}
                </ul>
                {preview.warnings.length ? (
                  <ul className="constructor-matrix-preview-list">
                    {preview.warnings.slice(0, 4).map((warning) => (
                      <li key={`${warning.code}-${warning.message}`}>
                        <strong>{warning.code}</strong>
                        <span>{warning.message}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            </div>

            <MatrixRolloutDecisionCard
              decision={rolloutDecision}
              language={language}
              onOpenWorkspace={onOpenWorkspace}
              workspaceCanOpen={workspaceCanOpen}
              workspaceUnavailableReason={workspaceUnavailableReason}
            />

            <MatrixPilotReadinessCard
              defaultPathUnchanged={preview.defaultPathUnchanged}
              error={
                pilotReadinessError ||
                (!rolloutDecision
                  ? matrixUiCopyFor(language, {
                      en: "Pilot readiness unavailable until rollout decision is loaded.",
                      ru: "Pilot readiness недоступен, пока не загружен rollout decision.",
                      bg: "Pilot readiness не е наличен преди rollout decision.",
                    })
                  : "")
              }
              language={language}
              loading={previewBusy}
              onRetry={onBuildPreview}
              readiness={pilotReadiness}
              safeToPreview={preview.safeToPreview}
            />

            <MatrixReviewExportActions
              contextLabel="preview / rollout"
              language={language}
              preview={preview}
              readiness={pilotReadiness}
              rolloutDecision={rolloutDecision}
            />

            <div className="constructor-matrix-side-by-side">
              {([
                ["legacy", legacyMetrics],
                ["matrix", matrixMetrics],
              ] as const).map(([label, metrics]) => (
                <article className="constructor-matrix-preview-card" key={label}>
                  <div className="summary-topline">
                    <strong>{label}</strong>
                    <span>{metrics.density}</span>
                  </div>
                  <div className="constructor-matrix-count-grid">
                    {[
                      ["weeks", metrics.weekCount],
                      ["days", metrics.dayCount],
                      ["sessions", metrics.sessionCount],
                      ["close-start", metrics.closeStartDayCount],
                    ].map(([metricLabel, value]) => (
                      <span key={metricLabel}>
                        <small>{metricLabel}</small>
                        <strong>{value}</strong>
                      </span>
                    ))}
                  </div>
                  <ul className="constructor-matrix-preview-list">
                    {metrics.weekRows.slice(0, 5).map((week) => (
                      <li key={week.key}>
                        <strong>{week.label}</strong>
                        <span>
                          {phaseLabel(week.phase)} · {week.dayCount}d / {week.sessionCount}s /{" "}
                          {week.blockCount}b
                          {week.closeStartDayCount ? ` · close-start ${week.closeStartDayCount}d` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            {readOnlyCandidateVisible ? (
              <article className="constructor-matrix-preview-card constructor-matrix-candidate-card">
                <div className="summary-topline">
                  <strong>
                    {matrixUiCopyFor(language, {
                      en: "Matrix primary candidate - read-only",
                      ru: "Matrix primary candidate - read-only",
                      bg: "Matrix primary candidate - read-only",
                    })}
                  </strong>
                  <span className="constructor-matrix-readonly-badge">read-only / internal</span>
                </div>
                <p className="constructor-matrix-rollout-note">
                  {matrixUiCopyFor(language, {
                    en: "Read-only internal candidate. It is not saved and does not replace the generated legacy draft.",
                    ru: "Внутренний read-only кандидат. Не сохраняется и не заменяет основной черновик.",
                    bg: "Вътрешен read-only кандидат. Не се записва и не заменя основната чернова.",
                  })}
                </p>
                <div className="constructor-matrix-count-grid">
                  {[
                    ["weeks", matrixMetrics.weekCount],
                    ["days", matrixMetrics.dayCount],
                    ["sessions", matrixMetrics.sessionCount],
                    ["blocks", matrixMetrics.blockCount],
                  ].map(([label, value]) => (
                    <span key={label}>
                      <small>{label}</small>
                      <strong>{value}</strong>
                    </span>
                  ))}
                </div>
                <div className="constructor-matrix-candidate-grid">
                  <section>
                    <strong>
                      {matrixUiCopyFor(language, {
                        en: "Selected blocks",
                        ru: "Выбранные блоки",
                        bg: "Избрани блокове",
                      })}
                    </strong>
                    <ul className="constructor-matrix-preview-list">
                      {candidateSummary.selectedBlockOverview.length ? (
                        candidateSummary.selectedBlockOverview.map((block) => (
                          <li key={block.key}>
                            <strong>{block.key}</strong>
                            <span>
                              {block.label} · {block.count}x · {block.loadLevels}
                            </span>
                          </li>
                        ))
                      ) : (
                        <li>
                          <strong>matrix</strong>
                          <span>
                            {matrixUiCopyFor(language, {
                              en: "No selected block overview was returned.",
                              ru: "Selected block overview не вернулся.",
                              bg: "Няма selected block overview.",
                            })}
                          </span>
                        </li>
                      )}
                    </ul>
                  </section>
                  <section>
                    <strong>
                      {matrixUiCopyFor(language, {
                        en: "Load / risks",
                        ru: "Нагрузка / риски",
                        bg: "Натоварване / рискове",
                      })}
                    </strong>
                    <div className="constructor-matrix-count-grid constructor-matrix-load-grid">
                      {candidateSummary.loadSummary.length ? (
                        candidateSummary.loadSummary.map((item) => (
                          <span key={item.label}>
                            <small>{item.label}</small>
                            <strong>{item.value}</strong>
                          </span>
                        ))
                      ) : (
                        <span>
                          <small>load</small>
                          <strong>-</strong>
                        </span>
                      )}
                    </div>
                    <ul className="constructor-matrix-preview-list">
                      {candidateSummary.riskSummary.length ? (
                        candidateSummary.riskSummary.map((risk) => (
                          <li key={risk.key}>
                            <strong>
                              {risk.code} · {risk.severity}
                            </strong>
                            <span>{risk.message}</span>
                          </li>
                        ))
                      ) : (
                        <li>
                          <strong>risk</strong>
                          <span>
                            {matrixUiCopyFor(language, {
                              en: "No matrix risk summary was returned.",
                              ru: "Matrix risk summary не вернулся.",
                              bg: "Няма matrix risk summary.",
                            })}
                          </span>
                        </li>
                      )}
                    </ul>
                  </section>
                </div>
                {candidateSummary.explanations.length ? (
                  <ul className="constructor-matrix-preview-list">
                    {candidateSummary.explanations.map((message) => (
                      <li key={message}>
                        <strong>why</strong>
                        <span>{message}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ) : rolloutDecision ? (
              <article className="constructor-matrix-preview-card constructor-matrix-candidate-hidden">
                <div className="summary-topline">
                  <strong>
                    {matrixUiCopyFor(language, {
                      en: "Matrix primary candidate",
                      ru: "Matrix primary candidate",
                      bg: "Matrix primary candidate",
                    })}
                  </strong>
                  <span>{rolloutBadgeLabel}</span>
                </div>
                <p>
                  {matrixUiCopyFor(language, {
                    en: "Candidate is hidden because the rollout gate did not allow matrix primary/internal usage for this scenario.",
                    ru: "Кандидат скрыт: rollout gate не разрешил matrix primary/internal usage для этого сценария.",
                    bg: "Кандидатът е скрит: rollout gate не разрешава matrix primary/internal usage за този сценарий.",
                  })}
                </p>
              </article>
            ) : null}

            <article className="constructor-matrix-preview-card">
              <div className="summary-topline">
                <strong>
                  {matrixUiCopyFor(language, {
                    en: "Matrix decision explanation",
                    ru: "Почему matrix решил так",
                    bg: "Matrix decision explanation",
                  })}
                </strong>
                <span>{preview.mode}</span>
              </div>
              <div className="constructor-matrix-count-grid constructor-matrix-decision-grid">
                {previewDecision?.items.map((item) => (
                  <span key={item.label}>
                    <small>{item.label}</small>
                    <strong>{item.value}</strong>
                  </span>
                ))}
              </div>
              {previewDecision?.explanations.length ? (
                <ul className="constructor-matrix-preview-list">
                  {previewDecision.explanations.map((message) => (
                    <li key={message}>
                      <strong>matrix</strong>
                      <span>{message}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  {matrixUiCopyFor(language, {
                    en: "No matrix explanation was included in the response.",
                    ru: "В ответе нет отдельного matrix-объяснения.",
                    bg: "Няма matrix обяснение в отговора.",
                  })}
                </p>
              )}
            </article>

            <article className="constructor-matrix-preview-card">
              <div className="summary-topline">
                <strong>{matrixUiCopyFor(language, { en: "Differences", ru: "Различия", bg: "Разлики" })}</strong>
                <span>{differences.length}</span>
              </div>
              {differences.length ? (
                <ul className="constructor-matrix-difference-list">
                  {differences.slice(0, 12).map((difference, index) => (
                    <li
                      className={`constructor-matrix-difference constructor-matrix-severity-${difference.severity}`}
                      key={`${difference.category}-${difference.message}-${index}`}
                    >
                      <div>
                        <strong>{difference.category}</strong>
                        <span>{difference.severity}</span>
                      </div>
                      <p>{difference.message}</p>
                      <small>{formatConstructorPreviewAffected(difference.affected)}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  {matrixUiCopyFor(language, {
                    en: "No differences were returned by the comparison report.",
                    ru: "Comparison report не вернул различий.",
                    bg: "Comparison report не върна разлики.",
                  })}
                </p>
              )}
            </article>

            <details className="constructor-matrix-raw-json">
              <summary>{matrixUiCopyFor(language, { en: "Raw JSON", ru: "Raw JSON", bg: "Raw JSON" })}</summary>
              <pre>{JSON.stringify(preview, null, 2)}</pre>
            </details>
          </div>
        ) : (
          <p className="placeholder-copy">
            {matrixUiCopyFor(language, {
              en: "Open this internal panel and run the comparison when QA needs to inspect matrix output. The current production draft is untouched.",
              ru: "Откройте internal-панель и запустите сравнение, когда QA нужно проверить matrix-output. Текущий production-черновик не трогается.",
              bg: "Отворете internal панела и пуснете сравнение за QA. Текущата production чернова не се променя.",
            })}
          </p>
        )}
      </details>

      <MatrixPreviewWorkspace
        activeDraftSource={activeDraftSource}
        activationDisabledReason={activationDisabledReason}
        canActivate={canActivateMatrixInternalDraft}
        limitedPrimaryPilotEnabled={limitedPrimaryPilotEnabled}
        language={language}
        onActivateMatrixInternalDraft={onActivateMatrixInternalDraft}
        onActivateMatrixPrimaryPilotDraft={onActivateMatrixPrimaryPilotDraft}
        onCloseWorkspace={onCloseWorkspace}
        onReturnToLegacyDraft={onReturnToLegacyDraft}
        phaseLabel={phaseLabel}
        preview={preview}
        readiness={pilotReadiness}
        matrixPrimaryPilotEligibility={matrixPrimaryPilotEligibility}
        rolloutDecision={rolloutDecision}
        workspace={workspace}
      />
    </>
  );
}
