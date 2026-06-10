import type {
  ConstructorDraft,
  ConstructorMatrixPreviewResponse,
  MatrixConstructorRolloutDecision,
  MatrixConstructorRolloutMode,
} from "@training-platform/shared";
import type { Language } from "./i18n";

export type ConstructorPreviewDraftMetrics = {
  weekCount: number;
  dayCount: number;
  sessionCount: number;
  blockCount: number;
  closeStartDayCount: number;
  density: string;
  weekRows: {
    key: string;
    label: string;
    phase: ConstructorDraft["plan"]["weeks"][number]["phase"];
    dayCount: number;
    sessionCount: number;
    blockCount: number;
    closeStartDayCount: number;
  }[];
};

export type ConstructorPreviewDecisionSummary = {
  items: {
    label: string;
    value: string;
  }[];
  explanations: string[];
};

export type ConstructorMatrixCandidateSummary = {
  selectedBlockOverview: {
    key: string;
    label: string;
    count: number;
    loadLevels: string;
  }[];
  loadSummary: {
    label: string;
    value: string;
  }[];
  riskSummary: {
    key: string;
    code: string;
    severity: string;
    message: string;
  }[];
  explanations: string[];
};

export type ConstructorMatrixWorkspaceState = {
  open: boolean;
  draft: ConstructorDraft | null;
  source: "rollout_preview";
  readOnly: true;
};

export type ActiveConstructorDraftSource = "legacy" | "matrix_internal";

export const CLOSED_CONSTRUCTOR_MATRIX_WORKSPACE: ConstructorMatrixWorkspaceState = {
  open: false,
  draft: null,
  source: "rollout_preview",
  readOnly: true,
};

export function matrixUiCopyFor(language: Language, values: Record<Language, string>) {
  return values[language];
}

export function constructorPreviewSessionsForDay(
  day: ConstructorDraft["plan"]["weeks"][number]["days"][number],
) {
  return day.sessions?.length
    ? day.sessions
    : [
        {
          name: day.dayIntent,
          notes: day.readinessGate,
          orderIndex: 0,
          blocks: day.blocks,
        },
      ];
}

export function buildConstructorPreviewDraftMetrics(
  draft?: ConstructorDraft | null,
): ConstructorPreviewDraftMetrics {
  const weeks = draft?.plan.weeks ?? [];
  const weekRows = weeks.map((week) => {
    const sessions = week.days.flatMap(constructorPreviewSessionsForDay);
    const closeStartDayCount =
      week.phase === "taper" || week.phase === "start_window"
        ? week.days.length
        : 0;

    return {
      key: `${week.weekNumber}-${week.title}`,
      label: week.title || `Week ${week.weekNumber}`,
      phase: week.phase,
      dayCount: week.days.length,
      sessionCount: sessions.length,
      blockCount: sessions.reduce((sum, session) => sum + session.blocks.length, 0),
      closeStartDayCount,
    };
  });
  const dayCount = weekRows.reduce((sum, row) => sum + row.dayCount, 0);
  const sessionCount = weekRows.reduce((sum, row) => sum + row.sessionCount, 0);
  const blockCount = weekRows.reduce((sum, row) => sum + row.blockCount, 0);
  const closeStartDayCount = weekRows.reduce((sum, row) => sum + row.closeStartDayCount, 0);

  return {
    weekCount: weeks.length,
    dayCount,
    sessionCount,
    blockCount,
    closeStartDayCount,
    density: `${weeks.length}w / ${dayCount}d / ${sessionCount}s / ${blockCount}b`,
    weekRows,
  };
}

export function getConstructorMatrixPreviewMatrixDraft(
  preview?: ConstructorMatrixPreviewResponse | null,
) {
  return preview?.matrixDraft ?? preview?.comparisonReport?.matrixDraft ?? null;
}

export function buildConstructorPreviewDecisionSummary(
  preview: ConstructorMatrixPreviewResponse,
): ConstructorPreviewDecisionSummary {
  const matrixDraft = getConstructorMatrixPreviewMatrixDraft(preview);
  const matrix = matrixDraft?.matrix.draft;
  const flaggedDays =
    matrix?.weeks.flatMap((week) =>
      week.days.filter(
        (day) => day.flags.travel || day.flags.weighIn || day.flags.competition || day.flags.postCompetition,
      ),
    ) ?? [];
  const flagLabels = Array.from(
    new Set(
      flaggedDays.flatMap((day) => [
        day.flags.travel ? "travel" : "",
        day.flags.weighIn ? "weigh-in" : "",
        day.flags.competition ? "competition" : "",
        day.flags.postCompetition ? "post-start" : "",
      ]),
    ),
  ).filter(Boolean);
  const developmentStatus = matrixDraft?.focusPlan.developmentAllowed
    ? "development allowed"
    : "development forbidden or limited";

  return {
    items: [
      {
        label: "phase",
        value: matrix?.preparationPhase ?? "not included",
      },
      {
        label: "role / start proximity",
        value: matrix
          ? `${matrix.competitionRole} · D-${matrix.daysUntilStart ?? "?"} · ${
              matrix.isMainStart ? "main start" : "non-main start"
            }`
          : "not included",
      },
      {
        label: "development rule",
        value: developmentStatus,
      },
      {
        label: "logistics flags",
        value: flagLabels.length ? flagLabels.join(", ") : "none in matrix days",
      },
    ],
    explanations:
      matrix?.explanations
        .filter((item) => item.code === "strategy" || item.code === "phase" || item.code === "risk")
        .slice(0, 5)
        .map((item) => item.message) ?? [],
  };
}

export function constructorMatrixRolloutBadgeClass(mode?: MatrixConstructorRolloutMode | null) {
  switch (mode) {
    case "matrix_allowed_for_primary":
      return "is-primary-allowed";
    case "matrix_allowed_for_internal":
      return "is-internal-only";
    case "preview_only":
      return "is-preview-only";
    case "blocked":
      return "is-blocked";
    case "legacy_only":
    default:
      return "is-legacy-only";
  }
}

export function constructorMatrixRolloutLabel(
  language: Language,
  mode?: MatrixConstructorRolloutMode | null,
) {
  if (!mode) {
    return "";
  }

  return (
    {
      matrix_allowed_for_primary: matrixUiCopyFor(language, {
        en: "Matrix primary allowed",
        ru: "Matrix primary allowed",
        bg: "Matrix primary allowed",
      }),
      matrix_allowed_for_internal: matrixUiCopyFor(language, {
        en: "Matrix internal only",
        ru: "Matrix internal only",
        bg: "Matrix internal only",
      }),
      preview_only: matrixUiCopyFor(language, {
        en: "Preview only",
        ru: "Preview only",
        bg: "Preview only",
      }),
      legacy_only: matrixUiCopyFor(language, {
        en: "Legacy default",
        ru: "Legacy default",
        bg: "Legacy default",
      }),
      blocked: matrixUiCopyFor(language, {
        en: "Blocked",
        ru: "Blocked",
        bg: "Blocked",
      }),
    } satisfies Record<MatrixConstructorRolloutMode, string>
  )[mode];
}

export function collectConstructorMatrixCandidateSummary(
  draft?: ConstructorMatrixPreviewResponse["matrixDraft"] | null,
): ConstructorMatrixCandidateSummary {
  const matrix = draft?.matrix.draft;
  const selectedBlocks =
    matrix?.weeks.flatMap((week) =>
      week.days.flatMap((day) =>
        day.sessions.flatMap((session) => session.selectedBlocks),
      ),
    ) ?? [];
  const blockCounts = new Map<
    string,
    {
      label: string;
      count: number;
      loadLevels: Set<string>;
    }
  >();
  const loadCounts = new Map<string, number>();

  for (const block of selectedBlocks) {
    const key = block.blockType;
    const existing =
      blockCounts.get(key) ??
      {
        label: block.label,
        count: 0,
        loadLevels: new Set<string>(),
      };

    existing.count += 1;
    existing.loadLevels.add(block.volume.loadLevel);
    blockCounts.set(key, existing);
    loadCounts.set(block.volume.loadLevel, (loadCounts.get(block.volume.loadLevel) ?? 0) + 1);
  }

  const explanationCandidates = [
    ...(matrix?.explanations ?? []),
    ...(matrix?.weeks.flatMap((week) => week.explanations) ?? []),
    ...(matrix?.weeks.flatMap((week) =>
      week.days.flatMap((day) => day.explanations),
    ) ?? []),
  ];
  const uniqueExplanations = Array.from(new Set(explanationCandidates.map((item) => item.message)));

  return {
    selectedBlockOverview: Array.from(blockCounts.entries())
      .map(([key, value]) => ({
        key,
        label: value.label,
        count: value.count,
        loadLevels: Array.from(value.loadLevels).join(", "),
      }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 8),
    loadSummary: Array.from(loadCounts.entries())
      .map(([label, value]) => ({ label, value: String(value) }))
      .sort((left, right) => left.label.localeCompare(right.label)),
    riskSummary:
      draft?.matrix.riskChecks.slice(0, 8).map((risk, index) => ({
        key: `${risk.code}-${index}`,
        code: risk.code,
        severity: risk.severity,
        message: risk.message,
      })) ?? [],
    explanations: uniqueExplanations.slice(0, 8),
  };
}

export function isConstructorMatrixWorkspaceAllowedMode(
  decision?: MatrixConstructorRolloutDecision | null,
) {
  return (
    decision?.mode === "matrix_allowed_for_primary" ||
    decision?.mode === "matrix_allowed_for_internal"
  );
}

export function canOpenConstructorMatrixWorkspace(params: {
  decision?: MatrixConstructorRolloutDecision | null;
  preview?: ConstructorMatrixPreviewResponse | null;
  matrixDraft?: ConstructorMatrixPreviewResponse["matrixDraft"] | null;
  safetyErrorCount: number;
}) {
  const { decision, preview, matrixDraft, safetyErrorCount } = params;

  if (!decision || !preview || !matrixDraft) {
    return false;
  }

  const modeAllowed = isConstructorMatrixWorkspaceAllowedMode(decision);
  const primaryOrInternalAllowed =
    decision.matrixPrimaryAllowed || decision.mode === "matrix_allowed_for_internal";
  const hasErrorBlockers = decision.blockers.some((blocker) => blocker.severity === "error");

  return (
    modeAllowed &&
    primaryOrInternalAllowed &&
    preview.safeToPreview &&
    preview.defaultPathUnchanged &&
    decision.safeToPreview &&
    decision.defaultPathUnchanged &&
    safetyErrorCount === 0 &&
    !hasErrorBlockers
  );
}

export function canActivateConstructorMatrixInternalDraft(params: {
  workspace: ConstructorMatrixWorkspaceState;
  decision?: MatrixConstructorRolloutDecision | null;
  preview?: ConstructorMatrixPreviewResponse | null;
  matrixDraft?: ConstructorMatrixPreviewResponse["matrixDraft"] | null;
  safetyErrorCount: number;
}) {
  const { workspace, decision, preview, matrixDraft, safetyErrorCount } = params;

  return (
    workspace.open &&
    Boolean(workspace.draft) &&
    canOpenConstructorMatrixWorkspace({
      decision,
      preview,
      matrixDraft,
      safetyErrorCount,
    })
  );
}

export function isConstructorDraftSaveAllowed(source: ActiveConstructorDraftSource) {
  return source === "legacy";
}

export function getConstructorMatrixSafetyErrorCount(
  preview?: ConstructorMatrixPreviewResponse | null,
) {
  return (
    preview?.safetyInvariants?.filter((item) => !item.passed && item.severity === "error").length ??
    0
  );
}

export function isConstructorMatrixReadOnlyCandidateVisible(params: {
  decision?: MatrixConstructorRolloutDecision | null;
  preview?: ConstructorMatrixPreviewResponse | null;
  matrixDraft?: ConstructorMatrixPreviewResponse["matrixDraft"] | null;
}) {
  const { decision, preview, matrixDraft } = params;

  return (
    Boolean(decision) &&
    isConstructorMatrixWorkspaceAllowedMode(decision) &&
    Boolean(matrixDraft) &&
    Boolean(preview?.safeToPreview) &&
    Boolean(preview?.defaultPathUnchanged)
  );
}

export function constructorMatrixRolloutSupportText(
  language: Language,
  decision?: MatrixConstructorRolloutDecision | null,
) {
  if (decision?.mode === "preview_only") {
    return matrixUiCopyFor(language, {
      en: "Matrix remains preview-only for this scenario. Close main-start windows are not primary yet.",
      ru: "Matrix остаётся только preview для этого сценария. Главные старты D-28/D-21/D-10/D-3 пока не разрешены как primary.",
      bg: "Matrix остава само preview за този сценарий. Близките основни стартове още не са primary.",
    });
  }

  if (decision?.mode === "blocked") {
    return matrixUiCopyFor(language, {
      en: "Matrix is blocked here. Use the legacy default.",
      ru: "Matrix заблокирован здесь. Используйте legacy default.",
      bg: "Matrix е блокиран тук. Използвайте legacy default.",
    });
  }

  if (decision?.mode === "legacy_only") {
    return matrixUiCopyFor(language, {
      en: "Matrix is not enabled as primary for this scenario.",
      ru: "Matrix не разрешён для primary в этом сценарии.",
      bg: "Matrix не е разрешен като primary за този сценарий.",
    });
  }

  if (decision?.mode === "matrix_allowed_for_internal") {
    return matrixUiCopyFor(language, {
      en: "Matrix can be inspected as an internal candidate only.",
      ru: "Matrix можно смотреть только как внутренний кандидат.",
      bg: "Matrix може да се гледа само като вътрешен кандидат.",
    });
  }

  if (decision?.mode === "matrix_allowed_for_primary") {
    return matrixUiCopyFor(language, {
      en: "Matrix primary is allowed by the controlled gate, but this panel is still read-only.",
      ru: "Controlled gate разрешает matrix primary, но эта панель всё равно read-only.",
      bg: "Controlled gate разрешава matrix primary, но този панел е read-only.",
    });
  }

  return "";
}

export function constructorMatrixWorkspaceUnavailableReason(params: {
  language: Language;
  decision?: MatrixConstructorRolloutDecision | null;
  preview?: ConstructorMatrixPreviewResponse | null;
  matrixDraft?: ConstructorMatrixPreviewResponse["matrixDraft"] | null;
  safetyErrorCount: number;
}) {
  const { language, decision, preview, matrixDraft, safetyErrorCount } = params;

  if (!decision) {
    return matrixUiCopyFor(language, {
      en: "Run the internal matrix preview first.",
      ru: "Сначала запустите internal matrix preview.",
      bg: "Първо пуснете internal matrix preview.",
    });
  }

  if (!matrixDraft) {
    return matrixUiCopyFor(language, {
      en: "Matrix draft was not returned by the preview response.",
      ru: "Matrix draft не вернулся в preview response.",
      bg: "Matrix draft не е върнат в preview response.",
    });
  }

  if (!isConstructorMatrixWorkspaceAllowedMode(decision)) {
    if (decision.mode === "preview_only") {
      return matrixUiCopyFor(language, {
        en: "Matrix workspace is unavailable: main-start D-28/D-21/D-10/D-3 windows remain preview-only.",
        ru: "Matrix workspace недоступен: главные старты D-28/D-21/D-10/D-3 пока только preview.",
        bg: "Matrix workspace не е достъпен: главните стартове D-28/D-21/D-10/D-3 са само preview.",
      });
    }

    return matrixUiCopyFor(language, {
      en: "Matrix workspace is unavailable: rollout mode is legacy-only or blocked.",
      ru: "Matrix workspace недоступен: rollout mode legacy-only или blocked.",
      bg: "Matrix workspace не е достъпен: rollout mode е legacy-only или blocked.",
    });
  }

  if (!preview?.safeToPreview || !decision.safeToPreview) {
    return matrixUiCopyFor(language, {
      en: "Matrix workspace is unavailable: preview safety did not pass.",
      ru: "Matrix workspace недоступен: preview safety не прошёл.",
      bg: "Matrix workspace не е достъпен: preview safety не мина.",
    });
  }

  if (!preview.defaultPathUnchanged || !decision.defaultPathUnchanged) {
    return matrixUiCopyFor(language, {
      en: "Matrix workspace is unavailable: legacy default guard changed.",
      ru: "Matrix workspace недоступен: legacy default guard изменился.",
      bg: "Matrix workspace не е достъпен: legacy default guard се промени.",
    });
  }

  if (safetyErrorCount > 0) {
    return matrixUiCopyFor(language, {
      en: "Matrix workspace is unavailable: safety blockers are present.",
      ru: "Matrix workspace недоступен: есть safety blockers.",
      bg: "Matrix workspace не е достъпен: има safety blockers.",
    });
  }

  if (decision.blockers.some((blocker) => blocker.severity === "error")) {
    return matrixUiCopyFor(language, {
      en: "Matrix workspace is unavailable: rollout blockers are present.",
      ru: "Matrix workspace недоступен: есть rollout blockers.",
      bg: "Matrix workspace не е достъпен: има rollout blockers.",
    });
  }

  return matrixUiCopyFor(language, {
    en: "Matrix candidate can be opened only as a read-only internal workspace.",
    ru: "Matrix candidate можно открыть только как read-only internal workspace.",
    bg: "Matrix candidate може да се отвори само като read-only internal workspace.",
  });
}

export function constructorMatrixWorkspaceWhyText(
  language: Language,
  decision?: MatrixConstructorRolloutDecision | null,
) {
  if (decision?.mode === "matrix_allowed_for_internal") {
    return matrixUiCopyFor(language, {
      en: "This scenario is allowed only for internal inspection, not for production primary usage.",
      ru: "Этот сценарий разрешён только для internal проверки, не для production primary.",
      bg: "Този сценарий е разрешен само за internal проверка, не за production primary.",
    });
  }

  if (decision?.mode === "matrix_allowed_for_primary") {
    return matrixUiCopyFor(language, {
      en: "The gate allows a primary candidate, but this workspace is still read-only until a separate rollout decision.",
      ru: "Gate разрешает primary candidate, но этот workspace остаётся read-only до отдельного rollout-решения.",
      bg: "Gate разрешава primary candidate, но този workspace остава read-only до отделно rollout решение.",
    });
  }

  if (decision?.mode === "preview_only") {
    return matrixUiCopyFor(language, {
      en: "This scenario stays preview-only, so the matrix candidate cannot become a workspace draft.",
      ru: "Этот сценарий остаётся preview-only, поэтому matrix-кандидат нельзя открыть как workspace draft.",
      bg: "Този сценарий остава preview-only, затова matrix кандидатът не се отваря като workspace draft.",
    });
  }

  return matrixUiCopyFor(language, {
    en: "Legacy remains the main draft for this scenario.",
    ru: "Legacy остаётся основным черновиком для этого сценария.",
    bg: "Legacy остава основната чернова за този сценарий.",
  });
}

export function constructorMatrixWorkspaceScenarioText(
  language: Language,
  decision?: MatrixConstructorRolloutDecision | null,
) {
  if (decision?.scenario === "far_development_week") {
    return matrixUiCopyFor(language, {
      en: "Low-risk scenario far from the start.",
      ru: "Низкорисковый сценарий далеко от старта.",
      bg: "Нискорисков сценарий далеч от старта.",
    });
  }

  if (decision?.scenario === "post_competition_recovery") {
    return matrixUiCopyFor(language, {
      en: "Recovery scenario after competition.",
      ru: "Восстановительный сценарий после старта.",
      bg: "Възстановителен сценарий след старт.",
    });
  }

  if (decision?.scenario === "travel_day" || decision?.scenario === "weigh_in_day") {
    return matrixUiCopyFor(language, {
      en: "Logistics scenario allowed only for internal review.",
      ru: "Логистический сценарий, разрешённый только для internal проверки.",
      bg: "Логистичен сценарий само за internal проверка.",
    });
  }

  return "";
}

export function formatConstructorPreviewAffected(
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
