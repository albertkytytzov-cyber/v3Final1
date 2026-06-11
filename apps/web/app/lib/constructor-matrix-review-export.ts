import type {
  ConstructorDraft,
  ConstructorMatrixPreviewResponse,
  MatrixConstructorRolloutDecision,
  MatrixPilotReadinessResult,
} from "@training-platform/shared";

type ReviewCountSummary = {
  weekCount: number;
  dayCount: number;
  sessionCount: number;
  blockCount: number;
};

type ReviewTextItem = {
  code?: string;
  severity?: string;
  message: string;
};

export type ConstructorMatrixReviewExportPayload = {
  generatedFrom: "internal_matrix_constructor_review_export";
  generatedAt: string;
  rollout: {
    mode: MatrixConstructorRolloutDecision["mode"] | null;
    scenario: MatrixConstructorRolloutDecision["scenario"] | null;
    allowlisted: boolean | null;
    recommendedAction: MatrixConstructorRolloutDecision["recommendedAction"] | null;
    matrixPrimaryAllowed: boolean | null;
    safeToPreview: boolean | null;
    defaultPathUnchanged: boolean | null;
    blockers: ReviewTextItem[];
    explanation: {
      headline: string;
      reasons: string[];
      nextStep: string;
    } | null;
  };
  summary: {
    previewGeneratedAt: string | null;
    safeToPreview: boolean;
    defaultPathUnchanged: boolean;
    headline: string;
    errorCount: number;
    warningCount: number;
    expectedDifferenceCount: number;
    totalDifferences: number;
    counts: {
      legacy: ReviewCountSummary;
      matrix: ReviewCountSummary;
    };
  };
  safetyRiskSummary: {
    matrixSafetyPassed: boolean;
    legacyDefaultGuardPassed: boolean;
    errorCount: number;
    warningCount: number;
    failedInvariants: ReviewTextItem[];
    warnings: ReviewTextItem[];
    matrixRisks: ReviewTextItem[];
  };
  matrixExplanation: {
    mainDecision: string;
    whyNow: string;
    testsImpact: string;
    evidenceSummary: string;
    matrixMessages: string[];
  } | null;
  matrixVsLegacyDifferences: {
    total: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    items: {
      category: string;
      severity: string;
      message: string;
      affected: string;
    }[];
  };
  pilotReadiness: {
    status: MatrixPilotReadinessResult["status"];
    scenario: MatrixPilotReadinessResult["scenario"];
    rolloutMode: MatrixPilotReadinessResult["rolloutMode"];
    recommendedAction: MatrixPilotReadinessResult["recommendedAction"];
    matrixPrimaryAllowed: boolean;
    checklistCounts: MatrixPilotReadinessResult["summary"]["checklistCounts"];
    blockerCount: number;
    blockerCodes: string[];
  } | null;
  privacy: {
    anonymized: true;
    note: string;
  };
};

export type ConstructorMatrixReviewPackage = {
  payload: ConstructorMatrixReviewExportPayload;
  markdown: string;
  json: string;
};

type BuildConstructorMatrixReviewPackageParams = {
  generatedAt: string;
  preview: ConstructorMatrixPreviewResponse;
  readiness?: MatrixPilotReadinessResult | null;
  rolloutDecision?: MatrixConstructorRolloutDecision | null;
  workspaceDraft?: ConstructorDraft | null;
};

type ConstructorPlanDay = ConstructorDraft["plan"]["weeks"][number]["days"][number];

function sanitizeReviewText(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[redacted-id]")
    .trim();
}

function sessionsForDay(day: ConstructorPlanDay) {
  if (day.sessions?.length) {
    return day.sessions;
  }

  return day.blocks.length
    ? [
        {
          blocks: day.blocks,
        },
      ]
    : [];
}

function countDraft(draft?: ConstructorDraft | null): ReviewCountSummary {
  const weeks = draft?.plan.weeks ?? [];
  const days = weeks.flatMap((week) => week.days);
  const sessions = days.flatMap(sessionsForDay);

  return {
    weekCount: weeks.length,
    dayCount: days.length,
    sessionCount: sessions.length,
    blockCount: sessions.reduce((sum, session) => sum + session.blocks.length, 0),
  };
}

function countBy<T>(items: T[], keyFor: (item: T) => string) {
  return items.reduce<Record<string, number>>((accumulator, item) => {
    const key = keyFor(item);
    accumulator[key] = (accumulator[key] ?? 0) + 1;

    return accumulator;
  }, {});
}

function affectedLabel(
  affected?: NonNullable<
    NonNullable<ConstructorMatrixPreviewResponse["comparisonReport"]>["differences"][number]["affected"]
  >,
) {
  if (!affected) {
    return "whole preview";
  }

  return [
    affected.weekNumber ? `W${affected.weekNumber}` : "",
    affected.dayNumber ? `D${affected.dayNumber}` : "",
    affected.sessionName ?? "",
    affected.blockType ?? "",
  ]
    .filter(Boolean)
    .join(" / ");
}

function matrixDraftForPreview(preview: ConstructorMatrixPreviewResponse) {
  return preview.matrixDraft ?? preview.comparisonReport?.matrixDraft ?? null;
}

function legacyDraftForPreview(preview: ConstructorMatrixPreviewResponse) {
  return preview.legacyDraft ?? preview.comparisonReport?.legacyDraft ?? null;
}

function firstItems<T>(items: T[], limit: number) {
  return items.slice(0, limit);
}

function uniqueMessages(items: string[]) {
  return Array.from(new Set(items.map(sanitizeReviewText).filter(Boolean)));
}

function matrixExplanationMessages(draft?: ConstructorMatrixPreviewResponse["matrixDraft"] | null) {
  const matrix = draft?.matrix.draft;

  return uniqueMessages([
    ...(matrix?.explanations.map((item) => item.message) ?? []),
    ...(matrix?.weeks.flatMap((week) => week.explanations.map((item) => item.message)) ?? []),
    ...(matrix?.weeks.flatMap((week) =>
      week.days.flatMap((day) => day.explanations.map((item) => item.message)),
    ) ?? []),
  ]).slice(0, 10);
}

function markdownList(items: string[]) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- none";
}

function formatCountSummary(counts: ReviewCountSummary) {
  return `${counts.weekCount}w / ${counts.dayCount}d / ${counts.sessionCount}s / ${counts.blockCount}b`;
}

export function buildConstructorMatrixReviewMarkdown(
  payload: ConstructorMatrixReviewExportPayload,
) {
  const rollout = payload.rollout;
  const differences = payload.matrixVsLegacyDifferences.items.map(
    (item) => `${item.severity} · ${item.category} · ${item.affected}: ${item.message}`,
  );
  const blockers = rollout.blockers.map((item) =>
    [item.severity, item.code, item.message].filter(Boolean).join(" · "),
  );
  const risks = payload.safetyRiskSummary.matrixRisks.map((item) =>
    [item.severity, item.code, item.message].filter(Boolean).join(" · "),
  );

  return [
    "# Internal New Planning Logic Review",
    "",
    `Generated at: ${payload.generatedAt}`,
    "",
    "## Rollout",
    `- Mode: ${rollout.mode ?? "not loaded"}`,
    `- Scenario: ${rollout.scenario ?? "not loaded"}`,
    `- Allowlisted: ${rollout.allowlisted === null ? "not loaded" : rollout.allowlisted ? "yes" : "no"}`,
    `- Recommended action: ${rollout.recommendedAction ?? "not loaded"}`,
    `- New plan primary allowed: ${
      rollout.matrixPrimaryAllowed === null ? "not loaded" : rollout.matrixPrimaryAllowed ? "yes" : "no"
    }`,
    "",
    "## Safety / Risk",
    `- safeToPreview: ${payload.summary.safeToPreview ? "yes" : "no"}`,
    `- defaultPathUnchanged: ${payload.summary.defaultPathUnchanged ? "yes" : "no"}`,
    `- matrixSafetyPassed: ${payload.safetyRiskSummary.matrixSafetyPassed ? "yes" : "no"}`,
    `- legacyDefaultGuardPassed: ${payload.safetyRiskSummary.legacyDefaultGuardPassed ? "yes" : "no"}`,
    `- errors / warnings / expected: ${payload.summary.errorCount} / ${payload.summary.warningCount} / ${payload.summary.expectedDifferenceCount}`,
    "",
    "## Counts",
    `- Current draft: ${formatCountSummary(payload.summary.counts.legacy)}`,
    `- New logic: ${formatCountSummary(payload.summary.counts.matrix)}`,
    "",
    "## New Logic Explanation",
    payload.matrixExplanation?.mainDecision
      ? `Main decision: ${payload.matrixExplanation.mainDecision}`
      : "Main decision: none",
    payload.matrixExplanation?.whyNow ? `Why now: ${payload.matrixExplanation.whyNow}` : "Why now: none",
    "",
    "## New Logic Messages",
    markdownList(payload.matrixExplanation?.matrixMessages ?? []),
    "",
    "## Blockers",
    markdownList(blockers),
    "",
    "## New Logic Risks",
    markdownList(risks),
    "",
    "## New Logic vs Current Draft Differences",
    markdownList(differences),
    "",
    "## Pilot Readiness",
    payload.pilotReadiness
      ? [
          `- Status: ${payload.pilotReadiness.status}`,
          `- Scenario: ${payload.pilotReadiness.scenario}`,
          `- Rollout mode: ${payload.pilotReadiness.rolloutMode}`,
          `- Recommended action: ${payload.pilotReadiness.recommendedAction}`,
          `- New plan primary allowed: ${payload.pilotReadiness.matrixPrimaryAllowed ? "yes" : "no"}`,
          `- Checklist pass/warning/fail/n/a: ${payload.pilotReadiness.checklistCounts.pass}/${payload.pilotReadiness.checklistCounts.warning}/${payload.pilotReadiness.checklistCounts.fail}/${payload.pilotReadiness.checklistCounts.not_applicable}`,
          `- Blocker count: ${payload.pilotReadiness.blockerCount}`,
          `- Blocker codes: ${payload.pilotReadiness.blockerCodes.join(", ") || "none"}`,
        ].join("\n")
      : "- not included",
    "",
    "## Privacy",
    payload.privacy.note,
  ].join("\n");
}

export function buildConstructorMatrixReviewPackage({
  generatedAt,
  preview,
  readiness,
  rolloutDecision,
  workspaceDraft,
}: BuildConstructorMatrixReviewPackageParams): ConstructorMatrixReviewPackage {
  const matrixDraft = matrixDraftForPreview(preview);
  const selectedMatrixDraft = workspaceDraft ?? matrixDraft;
  const legacyDraft = legacyDraftForPreview(preview);
  const differences = preview.comparisonReport?.differences ?? [];
  const failedInvariants = [
    ...(preview.safetyInvariants ?? []),
    ...(preview.legacyDefaultGuard ?? []),
  ].filter((item) => !item.passed);

  const payload: ConstructorMatrixReviewExportPayload = {
    generatedFrom: "internal_matrix_constructor_review_export",
    generatedAt,
    rollout: {
      mode: rolloutDecision?.mode ?? null,
      scenario: rolloutDecision?.scenario ?? null,
      allowlisted: rolloutDecision?.allowlisted ?? null,
      recommendedAction: rolloutDecision?.recommendedAction ?? null,
      matrixPrimaryAllowed: rolloutDecision?.matrixPrimaryAllowed ?? null,
      safeToPreview: rolloutDecision?.safeToPreview ?? null,
      defaultPathUnchanged: rolloutDecision?.defaultPathUnchanged ?? null,
      blockers:
        rolloutDecision?.blockers.map((blocker) => ({
          code: blocker.code,
          severity: blocker.severity,
          message: sanitizeReviewText(blocker.message),
        })) ?? [],
      explanation: rolloutDecision
        ? {
            headline: sanitizeReviewText(rolloutDecision.explanation.headline),
            reasons: rolloutDecision.explanation.reasons.map(sanitizeReviewText),
            nextStep: sanitizeReviewText(rolloutDecision.explanation.nextStep),
          }
        : null,
    },
    summary: {
      previewGeneratedAt: preview.generatedAt ?? null,
      safeToPreview: preview.safeToPreview,
      defaultPathUnchanged: preview.defaultPathUnchanged,
      headline: sanitizeReviewText(preview.summary.headline),
      errorCount: preview.summary.errorCount,
      warningCount: preview.summary.warningCount,
      expectedDifferenceCount: preview.summary.expectedDifferenceCount,
      totalDifferences: preview.summary.totalDifferences,
      counts: {
        legacy: countDraft(legacyDraft),
        matrix: countDraft(selectedMatrixDraft),
      },
    },
    safetyRiskSummary: {
      matrixSafetyPassed: preview.safety.matrixSafetyPassed,
      legacyDefaultGuardPassed: preview.safety.legacyDefaultGuardPassed,
      errorCount: preview.safety.errorCount,
      warningCount: preview.safety.warningCount,
      failedInvariants: firstItems(failedInvariants, 12).map((item) => ({
        code: item.code,
        severity: item.severity,
        message: sanitizeReviewText(item.explanation),
      })),
      warnings: firstItems(preview.warnings, 12).map((warning) => ({
        code: warning.code,
        severity: warning.severity,
        message: sanitizeReviewText(warning.message),
      })),
      matrixRisks:
        firstItems(matrixDraft?.matrix.riskChecks ?? [], 12).map((risk) => ({
          code: risk.code,
          severity: risk.severity,
          message: sanitizeReviewText(risk.message),
        })),
    },
    matrixExplanation: selectedMatrixDraft
      ? {
          mainDecision: sanitizeReviewText(selectedMatrixDraft.explanation.mainDecision),
          whyNow: sanitizeReviewText(selectedMatrixDraft.explanation.whyNow),
          testsImpact: sanitizeReviewText(selectedMatrixDraft.explanation.testsImpact),
          evidenceSummary: sanitizeReviewText(selectedMatrixDraft.explanation.evidenceSummary),
          matrixMessages: matrixExplanationMessages(matrixDraft),
        }
      : null,
    matrixVsLegacyDifferences: {
      total: differences.length,
      byCategory: countBy(differences, (difference) => difference.category),
      bySeverity: countBy(differences, (difference) => difference.severity),
      items: firstItems(differences, 20).map((difference) => ({
        category: difference.category,
        severity: difference.severity,
        message: sanitizeReviewText(difference.message),
        affected: affectedLabel(difference.affected),
      })),
    },
    pilotReadiness: readiness
      ? {
          status: readiness.status,
          scenario: readiness.scenario,
          rolloutMode: readiness.rolloutMode,
          recommendedAction: readiness.recommendedAction,
          matrixPrimaryAllowed: readiness.matrixPrimaryAllowed,
          checklistCounts: readiness.summary.checklistCounts,
          blockerCount: readiness.summary.blockerCount,
          blockerCodes: readiness.blockers.map((blocker) => sanitizeReviewText(blocker.id)),
        }
      : null,
    privacy: {
      anonymized: true,
      note: "This internal review export intentionally includes only rollout, readiness summary, safety, structural counts, explanations, and comparison summaries. Identity, contact, personal notes, source payload details, and database fields are excluded.",
    },
  };

  const markdown = buildConstructorMatrixReviewMarkdown(payload);

  return {
    payload,
    markdown,
    json: JSON.stringify(payload, null, 2),
  };
}
