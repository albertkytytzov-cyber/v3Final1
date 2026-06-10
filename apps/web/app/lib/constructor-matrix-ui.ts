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

export function constructorMatrixYesNoLabel(language: Language, value?: boolean | null) {
  if (value === null || value === undefined) {
    return "-";
  }

  return value
    ? matrixUiCopyFor(language, { en: "yes", ru: "да", bg: "да" })
    : matrixUiCopyFor(language, { en: "no", ru: "нет", bg: "не" });
}

export function constructorMatrixCheckLabel(language: Language, value?: boolean | null) {
  if (value === null || value === undefined) {
    return "-";
  }

  return value
    ? matrixUiCopyFor(language, { en: "passed", ru: "пройдена", bg: "премина" })
    : matrixUiCopyFor(language, { en: "attention", ru: "требует внимания", bg: "внимание" });
}

export function constructorMatrixModeLabel(
  language: Language,
  mode?: MatrixConstructorRolloutMode | null,
) {
  return mode ? constructorMatrixRolloutLabel(language, mode) : "-";
}

export function constructorMatrixScenarioLabel(language: Language, scenario?: string | null) {
  if (!scenario) {
    return "-";
  }

  const labels: Record<string, string> = {
    far_development_week: matrixUiCopyFor(language, {
      en: "Far from start",
      ru: "Далеко от старта",
      bg: "Далеч от старт",
    }),
    post_competition_recovery: matrixUiCopyFor(language, {
      en: "Post-competition recovery",
      ru: "Восстановление после старта",
      bg: "Възстановяване след старт",
    }),
    main_start_d28_preview: matrixUiCopyFor(language, {
      en: "Main start: D-28",
      ru: "Главный старт: Д-28",
      bg: "Основен старт: Д-28",
    }),
    main_start_d21_preview: matrixUiCopyFor(language, {
      en: "Main start: D-21",
      ru: "Главный старт: Д-21",
      bg: "Основен старт: Д-21",
    }),
    main_start_d10_preview: matrixUiCopyFor(language, {
      en: "Main start: D-10",
      ru: "Главный старт: Д-10",
      bg: "Основен старт: Д-10",
    }),
    main_start_d3_preview: matrixUiCopyFor(language, {
      en: "Main start: D-3",
      ru: "Главный старт: Д-3",
      bg: "Основен старт: Д-3",
    }),
    competition_day_preview: matrixUiCopyFor(language, {
      en: "Competition day",
      ru: "День соревнования",
      bg: "Ден на състезание",
    }),
    secondary_start_preview: matrixUiCopyFor(language, {
      en: "Secondary start",
      ru: "Второстепенный старт",
      bg: "Второстепенен старт",
    }),
    travel_day: matrixUiCopyFor(language, {
      en: "Travel day",
      ru: "День дороги",
      bg: "Ден за пътуване",
    }),
    weigh_in_day: matrixUiCopyFor(language, {
      en: "Weigh-in day",
      ru: "День взвешивания",
      bg: "Ден за кантар",
    }),
  };

  return labels[scenario] ?? scenario.replaceAll("_", " ");
}

export function constructorMatrixActionLabel(language: Language, action?: string | null) {
  if (!action) {
    return "-";
  }

  const labels: Record<string, string> = {
    use_matrix_primary: matrixUiCopyFor(language, {
      en: "Use new plan",
      ru: "Использовать новый план",
      bg: "Използвай новия план",
    }),
    use_matrix_internal: matrixUiCopyFor(language, {
      en: "Review new plan",
      ru: "Проверить новый план",
      bg: "Провери новия план",
    }),
    keep_legacy: matrixUiCopyFor(language, {
      en: "Keep current draft",
      ru: "Оставить текущий черновик",
      bg: "Остави текущата чернова",
    }),
    preview_only: matrixUiCopyFor(language, {
      en: "Compare only",
      ru: "Только сравнить",
      bg: "Само сравнение",
    }),
    blocked: matrixUiCopyFor(language, {
      en: "Do not use",
      ru: "Не применять",
      bg: "Не използвай",
    }),
  };

  return labels[action] ?? action.replaceAll("_", " ");
}

export function constructorMatrixReadinessStatusLabel(
  language: Language,
  status?: MatrixPilotReadinessStatus | null,
) {
  return status ? getPilotReadinessLabel(language, status) : "-";
}

export function constructorMatrixMetricLabel(language: Language, metric: string) {
  const labels: Record<string, string> = {
    weeks: matrixUiCopyFor(language, { en: "weeks", ru: "недели", bg: "седмици" }),
    days: matrixUiCopyFor(language, { en: "days", ru: "дни", bg: "дни" }),
    sessions: matrixUiCopyFor(language, { en: "sessions", ru: "тренировки", bg: "тренировки" }),
    blocks: matrixUiCopyFor(language, { en: "blocks", ru: "блоки", bg: "блокове" }),
    exercises: matrixUiCopyFor(language, { en: "exercises", ru: "упражнения", bg: "упражнения" }),
    "top blocks": matrixUiCopyFor(language, { en: "main blocks", ru: "основные блоки", bg: "основни блокове" }),
    "close-start": matrixUiCopyFor(language, { en: "start window", ru: "окно старта", bg: "стартов прозорец" }),
    load: matrixUiCopyFor(language, { en: "load", ru: "нагрузка", bg: "натоварване" }),
    risk: matrixUiCopyFor(language, { en: "risk", ru: "риск", bg: "риск" }),
    why: matrixUiCopyFor(language, { en: "why", ru: "почему", bg: "защо" }),
    matrix: matrixUiCopyFor(language, { en: "new plan", ru: "новый план", bg: "нов план" }),
    pass: matrixUiCopyFor(language, { en: "passed", ru: "пройдено", bg: "премина" }),
    warning: matrixUiCopyFor(language, { en: "attention", ru: "внимание", bg: "внимание" }),
    fail: matrixUiCopyFor(language, { en: "failed", ru: "ошибка", bg: "грешка" }),
    "n/a": matrixUiCopyFor(language, { en: "not needed", ru: "не требуется", bg: "не е нужно" }),
    blockers: matrixUiCopyFor(language, { en: "limits", ru: "ограничения", bg: "ограничения" }),
  };

  return labels[metric] ?? metric;
}

export function constructorMatrixPassStopLabel(language: Language, passed: boolean) {
  return passed
    ? matrixUiCopyFor(language, { en: "passed", ru: "пройдено", bg: "премина" })
    : matrixUiCopyFor(language, { en: "stop", ru: "стоп", bg: "стоп" });
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
  language: Language,
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
        day.flags.travel ? matrixUiCopyFor(language, { en: "travel", ru: "дорога", bg: "пътуване" }) : "",
        day.flags.weighIn ? matrixUiCopyFor(language, { en: "weigh-in", ru: "взвешивание", bg: "кантар" }) : "",
        day.flags.competition ? matrixUiCopyFor(language, { en: "competition", ru: "соревнование", bg: "състезание" }) : "",
        day.flags.postCompetition ? matrixUiCopyFor(language, { en: "post-start", ru: "после старта", bg: "след старт" }) : "",
      ]),
    ),
  ).filter(Boolean);
  const developmentStatus = matrixDraft?.focusPlan.developmentAllowed
    ? matrixUiCopyFor(language, {
        en: "development allowed",
        ru: "развивающая работа разрешена",
        bg: "развитието е разрешено",
      })
    : matrixUiCopyFor(language, {
        en: "development forbidden or limited",
        ru: "развитие запрещено или ограничено",
        bg: "развитието е забранено или ограничено",
      });

  return {
    items: [
      {
        label: matrixUiCopyFor(language, { en: "phase", ru: "фаза", bg: "фаза" }),
        value: matrix?.preparationPhase ?? matrixUiCopyFor(language, { en: "not included", ru: "нет данных", bg: "няма данни" }),
      },
      {
        label: matrixUiCopyFor(language, {
          en: "role / start proximity",
          ru: "роль старта / близость",
          bg: "роля / близост до старт",
        }),
        value: matrix
          ? `${matrix.competitionRole} · Д-${matrix.daysUntilStart ?? "?"} · ${
              matrix.isMainStart
                ? matrixUiCopyFor(language, { en: "main start", ru: "главный старт", bg: "основен старт" })
                : matrixUiCopyFor(language, { en: "non-main start", ru: "не главный старт", bg: "не основен старт" })
            }`
          : matrixUiCopyFor(language, { en: "not included", ru: "нет данных", bg: "няма данни" }),
      },
      {
        label: matrixUiCopyFor(language, { en: "development rule", ru: "правило развития", bg: "правило за развитие" }),
        value: developmentStatus,
      },
      {
        label: matrixUiCopyFor(language, { en: "logistics flags", ru: "логистика", bg: "логистика" }),
        value: flagLabels.length
          ? flagLabels.join(", ")
          : matrixUiCopyFor(language, {
              en: "none in plan days",
              ru: "нет в днях плана",
              bg: "няма в дните на плана",
            }),
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
      en: "Run the comparison and use check first.",
      ru: "Сначала запустите сравнение и проверку применения нового конструктора.",
      bg: "Първо пуснете сравнението и проверката за употреба.",
    });
  }

  return (
    {
      ready_for_limited_primary_pilot: matrixUiCopyFor(language, {
        en: "The new constructor passed the limited-use checks for this scenario. Saving is still controlled by a separate safety gate.",
        ru: "Новый конструктор прошёл проверки для ограниченного применения в этом сценарии. Сохранение пока контролируется отдельной проверкой безопасности.",
        bg: "Новият конструктор мина проверките за ограничена употреба. Записът още се контролира от отделна проверка за безопасност.",
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
        en: "The scenario needs manual review before the new draft can be used.",
        ru: "Сценарию нужна ручная проверка перед применением нового черновика.",
        bg: "Сценарият има нужда от ръчна проверка преди употреба на новата чернова.",
      }),
    } satisfies Record<MatrixPilotReadinessStatus, string>
  )[status];
}

export function summarizePilotReadinessCounts(
  language: Language,
  readiness?: MatrixPilotReadinessResult | null,
) {
  const counts = readiness?.summary.checklistCounts ?? {
    pass: 0,
    warning: 0,
    fail: 0,
    not_applicable: 0,
  };

  return [
    { label: constructorMatrixMetricLabel(language, "pass"), value: counts.pass },
    { label: constructorMatrixMetricLabel(language, "warning"), value: counts.warning },
    { label: constructorMatrixMetricLabel(language, "fail"), value: counts.fail },
    { label: constructorMatrixMetricLabel(language, "n/a"), value: counts.not_applicable },
    { label: constructorMatrixMetricLabel(language, "blockers"), value: readiness?.summary.blockerCount ?? 0 },
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
      en: "The new constructor remains comparison-only for this scenario. Close main-start windows are not applied automatically.",
      ru: "Новый конструктор пока доступен только для сравнения. Близкие окна главного старта ещё не разрешены для применения.",
      bg: "Новият конструктор остава само за сравнение в този сценарий. Близките основни стартове още не се прилагат автоматично.",
    });
  }

  if (decision?.mode === "blocked") {
    return matrixUiCopyFor(language, {
      en: "The new constructor is blocked here. Use the current draft.",
      ru: "Новый конструктор здесь заблокирован. Используйте текущий черновик.",
      bg: "Новият конструктор е блокиран тук. Използвайте текущата чернова.",
    });
  }

  if (decision?.mode === "legacy_only") {
    return matrixUiCopyFor(language, {
      en: "The new constructor is not enabled for this scenario.",
      ru: "Новый конструктор не разрешён для применения в этом сценарии.",
      bg: "Новият конструктор не е разрешен за приложение в този сценарий.",
    });
  }

  if (decision?.mode === "matrix_allowed_for_internal") {
    return matrixUiCopyFor(language, {
      en: "The new constructor can be inspected only.",
      ru: "Новый конструктор можно открыть только для внутренней проверки.",
      bg: "Новият конструктор може да се гледа само за вътрешна проверка.",
    });
  }

  if (decision?.mode === "matrix_allowed_for_primary") {
    return matrixUiCopyFor(language, {
      en: "The controlled check allows this new variant, but this panel is still read-only.",
      ru: "Проверка разрешает новый вариант, но применение всё ещё идёт через отдельный безопасный шаг.",
      bg: "Контролираната проверка разрешава новия вариант, но този панел все още е само за преглед.",
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
      en: "Run the new constructor comparison first.",
      ru: "Сначала запустите сравнение нового конструктора.",
      bg: "Първо пуснете сравнението на новия конструктор.",
    });
  }

  if (!matrixDraft) {
    return matrixUiCopyFor(language, {
      en: "The new draft was not returned by the server.",
      ru: "Новый черновик не вернулся из ответа сервера.",
      bg: "Новата чернова не се върна от сървъра.",
    });
  }

  if (!isConstructorMatrixWorkspaceAllowedMode(decision)) {
    if (decision.mode === "preview_only") {
      return matrixUiCopyFor(language, {
        en: "The new draft cannot be opened: this start window remains comparison-only.",
        ru: "Новый черновик недоступен для открытия: это стартовое окно пока только для сравнения.",
        bg: "Новата чернова не може да се отвори: този стартов прозорец е само за сравнение.",
      });
    }

    return matrixUiCopyFor(language, {
      en: "The new draft cannot be opened: this scenario uses the current constructor or is blocked.",
      ru: "Новый черновик недоступен: для этого сценария разрешён только текущий конструктор или есть блокировка.",
      bg: "Новата чернова не може да се отвори: за този сценарий се използва текущият конструктор или има блокиране.",
    });
  }

  if (!preview?.safeToPreview || !decision.safeToPreview) {
    return matrixUiCopyFor(language, {
      en: "The new draft cannot be opened: safety check did not pass.",
      ru: "Новый черновик недоступен: проверка безопасности не пройдена.",
      bg: "Новата чернова не може да се отвори: проверката за безопасност не премина.",
    });
  }

  if (!preview.defaultPathUnchanged || !decision.defaultPathUnchanged) {
    return matrixUiCopyFor(language, {
      en: "The new draft cannot be opened: current constructor protection changed.",
      ru: "Новый черновик недоступен: защита текущего конструктора изменилась.",
      bg: "Новата чернова не може да се отвори: защитата на текущия конструктор се промени.",
    });
  }

  if (safetyErrorCount > 0) {
    return matrixUiCopyFor(language, {
      en: "The new draft cannot be opened: safety blockers are present.",
      ru: "Новый черновик недоступен: есть блокирующие safety-ошибки.",
      bg: "Новата чернова не може да се отвори: има блокиращи грешки в проверката за безопасност.",
    });
  }

  if (decision.blockers.some((blocker) => blocker.severity === "error")) {
    return matrixUiCopyFor(language, {
      en: "The new draft cannot be opened: blocking limits are present.",
      ru: "Новый черновик недоступен: есть блокирующие ограничения запуска.",
      bg: "Новата чернова не може да се отвори: има блокиращи ограничения.",
    });
  }

  return matrixUiCopyFor(language, {
    en: "The new variant can be opened for review and comparison.",
    ru: "Новый вариант можно открыть для просмотра и сравнения.",
    bg: "Новият вариант може да се отвори за преглед и сравнение.",
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
      bg: "Този сценарий е разрешен само за вътрешна проверка, не за назначаване на спортист.",
    });
  }

  if (decision?.mode === "matrix_allowed_for_primary") {
    return matrixUiCopyFor(language, {
      en: "The safety check allows a new candidate, but saving is controlled by a separate safe step.",
      ru: "Проверка разрешила новый вариант, но сохранение включается отдельным безопасным решением.",
      bg: "Проверката разрешава нов вариант, но записът се контролира с отделна безопасна стъпка.",
    });
  }

  if (decision?.mode === "preview_only") {
    return matrixUiCopyFor(language, {
      en: "This scenario stays comparison-only, so the new variant cannot become a working draft.",
      ru: "Этот сценарий остаётся только для сравнения, поэтому новый вариант нельзя сделать рабочим черновиком.",
      bg: "Този сценарий остава само за сравнение, затова новият вариант не може да стане работна чернова.",
    });
  }

  return matrixUiCopyFor(language, {
    en: "The current draft remains the main draft for this scenario.",
    ru: "Для этого сценария основным остаётся текущий черновик.",
    bg: "Текущата чернова остава основна за този сценарий.",
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
      bg: "Логистичен сценарий само за вътрешна проверка.",
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
