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
  buildConstructorPreviewDecisionSummary,
  buildConstructorPreviewDraftMetrics,
  collectConstructorMatrixCandidateSummary,
  constructorMatrixCheckLabel,
  constructorMatrixBlockKeyLabel,
  constructorMatrixDifferenceCategoryLabel,
  constructorMatrixLoadLevelLabel,
  constructorMatrixMetricLabel,
  constructorMatrixRolloutLabel,
  constructorMatrixSeverityLabel,
  constructorMatrixTrainerText,
  formatConstructorPreviewAffected,
  formatConstructorPreviewDraftDensity,
  formatConstructorPreviewWeekRowSummary,
  getConstructorMatrixPreviewMatrixDraft,
  isConstructorMatrixReadOnlyCandidateVisible,
  matrixUiCopyFor,
} from "../../lib/constructor-matrix-ui";
import type { MatrixPrimaryPilotEligibility } from "../../lib/constructor-matrix-primary-pilot";
import type { MatrixPrimaryPilotServerGate } from "../../lib/constructor-matrix-primary-pilot-server-gate";
import type { MatrixPrimaryPilotSaveDryRunResult } from "../../lib/constructor-matrix-save-dry-run";
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
  matrixPrimaryPilotSaveDryRun: MatrixPrimaryPilotSaveDryRunResult;
  matrixPrimaryPilotServerGate: MatrixPrimaryPilotServerGate;
  matrixPrimaryPilotServerSaveDryRun: MatrixPrimaryPilotServerSaveDryRunResponse | null;
  matrixPrimaryPilotServerSaveDryRunError: string;
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
  matrixPrimaryPilotSaveDryRun,
  matrixPrimaryPilotServerGate,
  matrixPrimaryPilotServerSaveDryRun,
  matrixPrimaryPilotServerSaveDryRunError,
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
  const previewDecision = preview ? buildConstructorPreviewDecisionSummary(language, preview) : null;
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
                en: "New planning logic diagnostics",
                ru: "Диагностика новой логики планирования",
                bg: "Диагностика на новата логика на планиране",
              })}
            </strong>
            <span>
              {matrixUiCopyFor(language, {
                en: "This block explains whether the new logic can become the working draft. It does not save or assign anything by itself.",
                ru: "Этот блок объясняет, может ли новая логика стать рабочим черновиком. Сам по себе он ничего не сохраняет и не назначает.",
                bg: "Този блок обяснява дали новата логика може да стане работна чернова. Сам по себе си не записва и не назначава нищо.",
              })}
            </span>
          </div>
          <span className="constructor-source-badge">
            {matrixUiCopyFor(language, { en: "diagnostics", ru: "диагностика", bg: "диагностика" })}
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
                    en: "Check new logic again",
                    ru: "Проверить новую логику ещё раз",
                    bg: "Провери новата логика отново",
                  })
                : matrixUiCopyFor(language, {
                    en: "Check new planning logic",
                    ru: "Проверить новую логику планирования",
                    bg: "Провери новата логика на планиране",
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
                en: "Show technical differences",
                ru: "Показывать технические отличия",
                bg: "Показвай технически разлики",
              })}
            </span>
          </label>
        </div>

        {previewError ? (
          <div className="constructor-matrix-preview-error">
            <strong>
              {matrixUiCopyFor(language, {
                en: "Comparison failed",
                ru: "Сравнение нового конструктора не прошло",
                bg: "Сравнението не премина",
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
                ru: "Решение по применению недоступно",
                bg: "Решението за приложение не е налично",
              })}
            </strong>
            <p>{rolloutError}</p>
          </div>
        ) : null}

        {!preview ? (
          <MatrixPilotReadinessCard
            compact
            error={matrixUiCopyFor(language, {
              en: "Readiness is unavailable until comparison and use decision are loaded.",
              ru: "Статус готовности недоступен, пока не выполнено сравнение нового конструктора.",
              bg: "Готовността не е налична преди сравнението и решението за приложение.",
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
                    {matrixUiCopyFor(language, { en: "Plan check", ru: "Проверка плана", bg: "Проверка план" })}:{" "}
                    {constructorMatrixCheckLabel(language, preview.safeToPreview)}
                  </span>
                  <span className={`status-chip ${preview.defaultPathUnchanged ? "green" : "danger"}`}>
                    {matrixUiCopyFor(language, { en: "Current draft", ru: "Текущий черновик", bg: "Текуща чернова" })}:{" "}
                    {preview.defaultPathUnchanged
                      ? matrixUiCopyFor(language, { en: "unchanged", ru: "не изменён", bg: "непроменен" })
                      : matrixUiCopyFor(language, { en: "changed", ru: "изменён", bg: "променен" })}
                  </span>
                </div>
                <div className="constructor-matrix-count-grid">
                  {[
                    [
                      matrixUiCopyFor(language, { en: "errors", ru: "ошибки", bg: "грешки" }),
                      preview.summary.errorCount,
                    ],
                    [
                      matrixUiCopyFor(language, { en: "warnings", ru: "внимание", bg: "внимание" }),
                      preview.summary.warningCount,
                    ],
                    [
                      matrixUiCopyFor(language, { en: "expected", ru: "ожидаемо", bg: "очаквано" }),
                      preview.summary.expectedDifferenceCount,
                    ],
                    [
                      matrixUiCopyFor(language, { en: "total", ru: "всего", bg: "общо" }),
                      preview.summary.totalDifferences,
                    ],
                  ].map(([label, value]) => (
                    <span key={label}>
                      <small>{label}</small>
                      <strong>{value}</strong>
                    </span>
                  ))}
                </div>
                <p>{constructorMatrixTrainerText(language, preview.summary.headline)}</p>
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
                    {matrixUiCopyFor(language, { en: "new", ru: "новый", bg: "нов" })}:{" "}
                    {preview.safety.matrixSafetyPassed
                      ? matrixUiCopyFor(language, { en: "passed", ru: "пройдено", bg: "премина" })
                      : matrixUiCopyFor(language, { en: "failed", ru: "ошибка", bg: "грешка" })}
                  </span>
                  <span className={`status-chip ${preview.safety.legacyDefaultGuardPassed ? "green" : "danger"}`}>
                    {matrixUiCopyFor(language, { en: "current", ru: "текущий", bg: "текущ" })}:{" "}
                    {preview.safety.legacyDefaultGuardPassed
                      ? matrixUiCopyFor(language, { en: "unchanged", ru: "не изменён", bg: "непроменен" })
                      : matrixUiCopyFor(language, { en: "changed", ru: "изменён", bg: "променен" })}
                  </span>
                </div>
                <ul className="constructor-matrix-preview-list">
                  {[...failedSafety, ...failedLegacyGuard].length ? (
                    [...failedSafety, ...failedLegacyGuard].map((item) => (
                      <li key={`${item.code}-${item.explanation}`}>
                        <strong>{constructorMatrixSeverityLabel(language, item.severity)}</strong>
                        <span>{constructorMatrixTrainerText(language, item.explanation)}</span>
                      </li>
                    ))
                  ) : (
                    <li>
                      <strong>
                        {matrixUiCopyFor(language, {
                          en: "No failed checks",
                          ru: "Нет проваленных проверок",
                          bg: "Няма неуспешни проверки",
                        })}
                      </strong>
                        <span>
                        {matrixUiCopyFor(language, {
                          en: "Server safety checks passed for this comparison.",
                          ru: "Серверные проверки безопасности пройдены для этого сравнения.",
                          bg: "Сървърните проверки за безопасност преминаха.",
                        })}
                      </span>
                    </li>
                  )}
                </ul>
                {preview.warnings.length ? (
                  <ul className="constructor-matrix-preview-list">
                    {preview.warnings.slice(0, 4).map((warning) => (
                      <li key={`${warning.code}-${warning.message}`}>
                        <strong>{constructorMatrixSeverityLabel(language, warning.severity)}</strong>
                        <span>{constructorMatrixTrainerText(language, warning.message)}</span>
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
                      en: "Readiness is unavailable until the application check is loaded.",
                      ru: "Готовность недоступна, пока не загружена проверка применения.",
                      bg: "Готовността не е налична, докато не се зареди проверката за приложение.",
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
              contextLabel={matrixUiCopyFor(language, {
                en: "comparison and decision",
                ru: "сравнение и решение",
                bg: "сравнение и решение",
              })}
              language={language}
              preview={preview}
              readiness={pilotReadiness}
              rolloutDecision={rolloutDecision}
            />

            <div className="constructor-matrix-side-by-side">
              {([
                [
                  matrixUiCopyFor(language, {
                    en: "current constructor",
                    ru: "текущий конструктор",
                    bg: "текущ конструктор",
                  }),
                  legacyMetrics,
                ],
                [
                  matrixUiCopyFor(language, {
                    en: "new constructor",
                    ru: "новый конструктор",
                    bg: "нов конструктор",
                  }),
                  matrixMetrics,
                ],
              ] as const).map(([label, metrics]) => (
                <article className="constructor-matrix-preview-card" key={label}>
                  <div className="summary-topline">
                    <strong>{label}</strong>
                    <span>{formatConstructorPreviewDraftDensity(language, metrics)}</span>
                  </div>
                  <div className="constructor-matrix-count-grid">
                    {[
                      [constructorMatrixMetricLabel(language, "weeks"), metrics.weekCount],
                      [constructorMatrixMetricLabel(language, "days"), metrics.dayCount],
                      [constructorMatrixMetricLabel(language, "sessions"), metrics.sessionCount],
                      [constructorMatrixMetricLabel(language, "close-start"), metrics.closeStartDayCount],
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
                          {phaseLabel(week.phase)} ·{" "}
                          {formatConstructorPreviewWeekRowSummary(language, week)}
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
                      en: "New plan variant - review only",
                      ru: "Новый вариант плана - только просмотр",
                      bg: "Нов вариант план - само преглед",
                    })}
                  </strong>
                  <span className="constructor-matrix-readonly-badge">
                    {matrixUiCopyFor(language, {
                      en: "review only",
                      ru: "только проверка",
                      bg: "само проверка",
                    })}
                  </span>
                </div>
                <p className="constructor-matrix-rollout-note">
                  {matrixUiCopyFor(language, {
                    en: "Review candidate. It is not saved and does not replace the current draft until the coach explicitly chooses a safe apply path.",
                    ru: "Кандидат для проверки. Он не сохраняется и не заменяет текущий черновик, пока тренер явно не выберет безопасное применение.",
                    bg: "Кандидат за проверка. Не се записва и не заменя текущата чернова.",
                  })}
                </p>
                <div className="constructor-matrix-count-grid">
                  {[
                    [constructorMatrixMetricLabel(language, "weeks"), matrixMetrics.weekCount],
                    [constructorMatrixMetricLabel(language, "days"), matrixMetrics.dayCount],
                    [constructorMatrixMetricLabel(language, "sessions"), matrixMetrics.sessionCount],
                    [constructorMatrixMetricLabel(language, "blocks"), matrixMetrics.blockCount],
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
                        ru: "Какие блоки выбрал новый конструктор",
                        bg: "Избрани блокове",
                      })}
                    </strong>
                    <ul className="constructor-matrix-preview-list">
                      {candidateSummary.selectedBlockOverview.length ? (
                        candidateSummary.selectedBlockOverview.map((block) => (
                          <li key={block.key}>
                            <strong>{constructorMatrixBlockKeyLabel(language, block.key)}</strong>
                            <span>
                              {constructorMatrixTrainerText(language, block.label)} · {block.count}x ·{" "}
                              {block.loadLevels
                                .map((loadLevel) => constructorMatrixLoadLevelLabel(language, loadLevel))
                                .join(", ")}
                            </span>
                          </li>
                        ))
                      ) : (
                        <li>
                          <strong>{constructorMatrixMetricLabel(language, "matrix")}</strong>
                          <span>
                            {matrixUiCopyFor(language, {
                              en: "No selected block overview was returned.",
                              ru: "Нет краткого списка выбранных блоков.",
                              bg: "Няма кратък списък с избрани блокове.",
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
                        ru: "Нагрузка и риски",
                        bg: "Натоварване / рискове",
                      })}
                    </strong>
                    <div className="constructor-matrix-count-grid constructor-matrix-load-grid">
                      {candidateSummary.loadSummary.length ? (
                        candidateSummary.loadSummary.map((item) => (
                          <span key={item.label}>
                            <small>{constructorMatrixLoadLevelLabel(language, item.label)}</small>
                            <strong>{item.value}</strong>
                          </span>
                        ))
                      ) : (
                        <span>
                          <small>{constructorMatrixMetricLabel(language, "load")}</small>
                          <strong>-</strong>
                        </span>
                      )}
                    </div>
                    <ul className="constructor-matrix-preview-list">
                      {candidateSummary.riskSummary.length ? (
                        candidateSummary.riskSummary.map((risk) => (
                          <li key={risk.key}>
                            <strong>
                              {constructorMatrixSeverityLabel(language, risk.severity)}
                            </strong>
                            <span>{constructorMatrixTrainerText(language, risk.message)}</span>
                          </li>
                        ))
                      ) : (
                        <li>
                          <strong>{constructorMatrixMetricLabel(language, "risk")}</strong>
                          <span>
                            {matrixUiCopyFor(language, {
                              en: "No risk summary was returned.",
                              ru: "Нет краткой сводки рисков.",
                              bg: "Няма кратка сводка на рисковете.",
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
                        <strong>{constructorMatrixMetricLabel(language, "why")}</strong>
                        <span>{constructorMatrixTrainerText(language, message)}</span>
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
                    en: "New plan variant",
                    ru: "Новый вариант плана",
                    bg: "Нов вариант план",
                  })}
                  </strong>
                  <span>{rolloutBadgeLabel}</span>
                </div>
                <p>
                  {matrixUiCopyFor(language, {
                    en: "Candidate is hidden because the safety gate did not allow the new constructor for this scenario.",
                    ru: "Кандидат скрыт: проверка безопасности не разрешила новый конструктор для этого сценария.",
                    bg: "Кандидатът е скрит: проверката за безопасност не разреши новия конструктор за този сценарий.",
                  })}
                </p>
              </article>
            ) : null}

            <article className="constructor-matrix-preview-card">
              <div className="summary-topline">
                <strong>
                  {matrixUiCopyFor(language, {
                    en: "New constructor decision explanation",
                    ru: "Почему новый конструктор решил так",
                    bg: "Обяснение на новия конструктор",
                  })}
                </strong>
                <span>{matrixUiCopyFor(language, { en: "comparison", ru: "сравнение", bg: "сравнение" })}</span>
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
                      <strong>{constructorMatrixMetricLabel(language, "matrix")}</strong>
                      <span>{constructorMatrixTrainerText(language, message)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  {matrixUiCopyFor(language, {
                    en: "No new constructor explanation was included in the response.",
                    ru: "В ответе нет отдельного объяснения нового конструктора.",
                    bg: "В отговора няма отделно обяснение на новия конструктор.",
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
                        <strong>{constructorMatrixDifferenceCategoryLabel(language, difference.category)}</strong>
                        <span>{constructorMatrixSeverityLabel(language, difference.severity)}</span>
                      </div>
                      <p>{constructorMatrixTrainerText(language, difference.message)}</p>
                      <small>{formatConstructorPreviewAffected(language, difference.affected)}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  {matrixUiCopyFor(language, {
                    en: "No differences were returned by the comparison report.",
                    ru: "Сравнение не вернуло различий.",
                    bg: "Сравнението не върна разлики.",
                  })}
                </p>
              )}
            </article>

            <details className="constructor-matrix-raw-json">
              <summary>
                {matrixUiCopyFor(language, {
                  en: "Technical data",
                  ru: "Технические данные",
                  bg: "Технически данни",
                })}
              </summary>
              <pre>{JSON.stringify(preview, null, 2)}</pre>
            </details>
          </div>
        ) : (
          <p className="placeholder-copy">
            {matrixUiCopyFor(language, {
              en: "Run the comparison to see the new plan variant. The current draft will not change.",
              ru: "Запустите сравнение, чтобы увидеть новый вариант плана. Текущий черновик не изменится.",
              bg: "Пуснете сравнението, за да видите нов вариант на плана. Текущата чернова не се променя.",
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
        matrixPrimaryPilotSaveDryRun={matrixPrimaryPilotSaveDryRun}
        matrixPrimaryPilotServerGate={matrixPrimaryPilotServerGate}
        matrixPrimaryPilotServerSaveDryRun={matrixPrimaryPilotServerSaveDryRun}
        matrixPrimaryPilotServerSaveDryRunError={matrixPrimaryPilotServerSaveDryRunError}
        rolloutDecision={rolloutDecision}
        workspace={workspace}
      />
    </>
  );
}
