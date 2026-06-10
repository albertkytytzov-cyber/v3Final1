import type {
  ConstructorDraft,
  ConstructorMatrixPreviewResponse,
  MatrixConstructorRolloutDecision,
  MatrixConstructorRolloutMode,
  MatrixPilotReadinessResult,
  MatrixPilotReadinessStatus,
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

export type ActiveConstructorDraftSource = "legacy" | "matrix_internal" | "matrix_primary_pilot";

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
        en: "New constructor can be used",
        ru: "Новый конструктор можно применять",
        bg: "Новият конструктор може да се използва",
      }),
      matrix_allowed_for_internal: matrixUiCopyFor(language, {
        en: "New constructor: review only",
        ru: "Новый конструктор: только проверка",
        bg: "Новият конструктор: само проверка",
      }),
      preview_only: matrixUiCopyFor(language, {
        en: "Preview only",
        ru: "Только предварительный просмотр",
        bg: "Само предварителен преглед",
      }),
      legacy_only: matrixUiCopyFor(language, {
        en: "Use current constructor",
        ru: "Использовать текущий конструктор",
        bg: "Използвай текущия конструктор",
      }),
      blocked: matrixUiCopyFor(language, {
        en: "Blocked",
        ru: "Заблокировано",
        bg: "Блокирано",
      }),
    } satisfies Record<MatrixConstructorRolloutMode, string>
  )[mode];
}

export function getPilotReadinessBadgeTone(status?: MatrixPilotReadinessStatus | null) {
  return (
    {
      ready_for_limited_primary_pilot: "is-ready-primary",
      ready_for_internal_pilot: "is-ready-internal",
      internal_only: "is-internal-only",
      preview_only: "is-preview-only",
      blocked: "is-blocked",
      needs_review: "is-needs-review",
    } satisfies Record<MatrixPilotReadinessStatus, string>
  )[status ?? "needs_review"];
}

export function getPilotReadinessLabel(
  language: Language,
  status?: MatrixPilotReadinessStatus | null,
) {
  if (!status) {
    return matrixUiCopyFor(language, {
      en: "Not available",
      ru: "Недоступно",
      bg: "Не е налично",
    });
  }

  return (
    {
      ready_for_limited_primary_pilot: matrixUiCopyFor(language, {
        en: "Ready for limited use",
        ru: "Готов к ограниченному применению",
        bg: "Готов за ограничена употреба",
      }),
      ready_for_internal_pilot: matrixUiCopyFor(language, {
        en: "Ready for internal review",
        ru: "Готов к внутренней проверке",
        bg: "Готов за вътрешна проверка",
      }),
      internal_only: matrixUiCopyFor(language, {
        en: "Internal review only",
        ru: "Только внутренняя проверка",
        bg: "Само вътрешна проверка",
      }),
      preview_only: matrixUiCopyFor(language, {
        en: "Preview only",
        ru: "Только предварительный просмотр",
        bg: "Само предварителен преглед",
      }),
      blocked: matrixUiCopyFor(language, {
        en: "Blocked",
        ru: "Заблокировано",
        bg: "Blocked",
      }),
      needs_review: matrixUiCopyFor(language, {
        en: "Needs review",
        ru: "Нужна проверка",
        bg: "Нужна е проверка",
      }),
    } satisfies Record<MatrixPilotReadinessStatus, string>
  )[status];
}

export function getPilotReadinessMeaning(
  language: Language,
  status?: MatrixPilotReadinessStatus | null,
) {
  if (!status) {
    return matrixUiCopyFor(language, {
      en: "Run the internal preview and rollout decision first.",
      ru: "Сначала запустите сравнение и проверку применения нового конструктора.",
      bg: "Първо пуснете internal preview и rollout decision.",
    });
  }

  return (
    {
      ready_for_limited_primary_pilot: matrixUiCopyFor(language, {
        en: "The new constructor passed the limited-use checks for this scenario. Saving is still controlled by a separate safety gate.",
        ru: "Новый конструктор прошёл проверки для ограниченного применения в этом сценарии. Сохранение пока контролируется отдельным safety-gate.",
        bg: "Новият конструктор мина проверките за ограничена употреба. Записът още се контролира от отделен safety-gate.",
      }),
      ready_for_internal_pilot: matrixUiCopyFor(language, {
        en: "The new constructor can be inspected, but it should not be assigned to athletes yet.",
        ru: "Новый конструктор можно смотреть и сравнивать, но пока не назначать спортсмену.",
        bg: "Новият конструктор може да се преглежда, но още не трябва да се назначава.",
      }),
      internal_only: matrixUiCopyFor(language, {
        en: "Review the new constructor output, but keep the current constructor for saving.",
        ru: "Проверьте новый вариант, но для сохранения используйте текущий конструктор.",
        bg: "Прегледайте новия вариант, но за запис използвайте текущия конструктор.",
      }),
      preview_only: matrixUiCopyFor(language, {
        en: "The new constructor is visible only for comparison in this scenario.",
        ru: "В этом сценарии новый конструктор доступен только для сравнения.",
        bg: "В този сценарий новият конструктор е само за сравнение.",
      }),
      blocked: matrixUiCopyFor(language, {
        en: "The new constructor has blockers here. Keep the current draft.",
        ru: "В новом конструкторе есть блокирующие проблемы. Оставляем текущий черновик.",
        bg: "Новият конструктор има блокиращи проблеми. Остава текущата чернова.",
      }),
      needs_review: matrixUiCopyFor(language, {
        en: "The scenario needs manual review before it can enter a pilot.",
        ru: "Сценарию нужна ручная проверка перед пилотом.",
        bg: "Сценарият има нужда от ръчна проверка преди pilot.",
      }),
    } satisfies Record<MatrixPilotReadinessStatus, string>
  )[status];
}

export function summarizePilotReadinessCounts(readiness?: MatrixPilotReadinessResult | null) {
  const counts = readiness?.summary.checklistCounts ?? {
    pass: 0,
    warning: 0,
    fail: 0,
    not_applicable: 0,
  };

  return [
    { label: "pass", value: counts.pass },
    { label: "warning", value: counts.warning },
    { label: "fail", value: counts.fail },
    { label: "n/a", value: counts.not_applicable },
    { label: "blockers", value: readiness?.summary.blockerCount ?? 0 },
  ];
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
      ru: "Новый конструктор пока доступен только для сравнения. Близкие окна главного старта ещё не разрешены для применения.",
      bg: "Matrix остава само preview за този сценарий. Близките основни стартове още не са primary.",
    });
  }

  if (decision?.mode === "blocked") {
    return matrixUiCopyFor(language, {
      en: "Matrix is blocked here. Use the legacy default.",
      ru: "Новый конструктор здесь заблокирован. Используйте текущий черновик.",
      bg: "Matrix е блокиран тук. Използвайте legacy default.",
    });
  }

  if (decision?.mode === "legacy_only") {
    return matrixUiCopyFor(language, {
      en: "Matrix is not enabled as primary for this scenario.",
      ru: "Новый конструктор не разрешён для применения в этом сценарии.",
      bg: "Matrix не е разрешен като primary за този сценарий.",
    });
  }

  if (decision?.mode === "matrix_allowed_for_internal") {
    return matrixUiCopyFor(language, {
      en: "Matrix can be inspected as an internal candidate only.",
      ru: "Новый конструктор можно открыть только для внутренней проверки.",
      bg: "Matrix може да се гледа само като вътрешен кандидат.",
    });
  }

  if (decision?.mode === "matrix_allowed_for_primary") {
    return matrixUiCopyFor(language, {
      en: "Matrix primary is allowed by the controlled gate, but this panel is still read-only.",
      ru: "Проверка разрешает новый вариант, но применение всё ещё идёт через отдельный безопасный шаг.",
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
      ru: "Сначала запустите сравнение нового конструктора.",
      bg: "Първо пуснете internal matrix preview.",
    });
  }

  if (!matrixDraft) {
    return matrixUiCopyFor(language, {
      en: "Matrix draft was not returned by the preview response.",
      ru: "Новый черновик не вернулся из ответа сервера.",
      bg: "Matrix draft не е върнат в preview response.",
    });
  }

  if (!isConstructorMatrixWorkspaceAllowedMode(decision)) {
    if (decision.mode === "preview_only") {
      return matrixUiCopyFor(language, {
        en: "Matrix workspace is unavailable: main-start D-28/D-21/D-10/D-3 windows remain preview-only.",
        ru: "Новый черновик недоступен для открытия: близкие окна главного старта пока только для сравнения.",
        bg: "Matrix workspace не е достъпен: главните стартове D-28/D-21/D-10/D-3 са само preview.",
      });
    }

    return matrixUiCopyFor(language, {
      en: "Matrix workspace is unavailable: rollout mode is legacy-only or blocked.",
      ru: "Новый черновик недоступен: для этого сценария разрешён только текущий конструктор или есть блокировка.",
      bg: "Matrix workspace не е достъпен: rollout mode е legacy-only или blocked.",
    });
  }

  if (!preview?.safeToPreview || !decision.safeToPreview) {
    return matrixUiCopyFor(language, {
      en: "Matrix workspace is unavailable: preview safety did not pass.",
      ru: "Новый черновик недоступен: проверка безопасности не пройдена.",
      bg: "Matrix workspace не е достъпен: preview safety не мина.",
    });
  }

  if (!preview.defaultPathUnchanged || !decision.defaultPathUnchanged) {
    return matrixUiCopyFor(language, {
      en: "Matrix workspace is unavailable: legacy default guard changed.",
      ru: "Новый черновик недоступен: защита текущего конструктора изменилась.",
      bg: "Matrix workspace не е достъпен: legacy default guard се промени.",
    });
  }

  if (safetyErrorCount > 0) {
    return matrixUiCopyFor(language, {
      en: "Matrix workspace is unavailable: safety blockers are present.",
      ru: "Новый черновик недоступен: есть блокирующие safety-ошибки.",
      bg: "Matrix workspace не е достъпен: има safety blockers.",
    });
  }

  if (decision.blockers.some((blocker) => blocker.severity === "error")) {
    return matrixUiCopyFor(language, {
      en: "Matrix workspace is unavailable: rollout blockers are present.",
      ru: "Новый черновик недоступен: есть блокирующие ограничения запуска.",
      bg: "Matrix workspace не е достъпен: има rollout blockers.",
    });
  }

  return matrixUiCopyFor(language, {
    en: "Matrix candidate can be opened only as a read-only internal workspace.",
    ru: "Новый вариант можно открыть для просмотра и сравнения.",
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
      ru: "Этот сценарий разрешён только для внутренней проверки, не для назначения спортсмену.",
      bg: "Този сценарий е разрешен само за internal проверка, не за production primary.",
    });
  }

  if (decision?.mode === "matrix_allowed_for_primary") {
    return matrixUiCopyFor(language, {
      en: "The gate allows a primary candidate, but this workspace is still read-only until a separate rollout decision.",
      ru: "Проверка разрешила новый вариант, но сохранение включается отдельным безопасным решением.",
      bg: "Gate разрешава primary candidate, но този workspace остава read-only до отделно rollout решение.",
    });
  }

  if (decision?.mode === "preview_only") {
    return matrixUiCopyFor(language, {
      en: "This scenario stays preview-only, so the matrix candidate cannot become a workspace draft.",
      ru: "Этот сценарий остаётся только для сравнения, поэтому новый вариант нельзя сделать рабочим черновиком.",
      bg: "Този сценарий остава preview-only, затова matrix кандидатът не се отваря като workspace draft.",
    });
  }

  return matrixUiCopyFor(language, {
    en: "Legacy remains the main draft for this scenario.",
    ru: "Для этого сценария основным остаётся текущий черновик.",
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
      ru: "Логистический сценарий, разрешённый только для внутренней проверки.",
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
