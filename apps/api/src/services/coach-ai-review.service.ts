import type {
  CoachDayAiPayload,
  CoachDayAiReview,
} from "@training-platform/shared";

export function buildCoachDayAiReview(input: {
  athleteId: string;
  entryDate: string;
  dayPayload: CoachDayAiPayload;
}): CoachDayAiReview {
  return {
    athleteId: input.athleteId,
    dayPayload: input.dayPayload,
    dayPayloadJson: JSON.stringify(input.dayPayload, null, 2),
    entryDate: input.entryDate,
    generatedAt: new Date().toISOString(),
    observation: buildObservation(input.dayPayload),
    riskNotes: buildRiskNotes(input.dayPayload),
    source: "local-rules",
    tomorrowActions: buildTomorrowActions(input.dayPayload),
  };
}

function buildObservation(payload: CoachDayAiPayload) {
  if (payload.plan.count === 0) {
    return "На выбранный день нет назначенного плана, поэтому разбор может оценить только готовность и комментарии.";
  }

  const exerciseLabel = payload.execution.exercises.total > 0
    ? `${payload.execution.exercises.completed}/${payload.execution.exercises.total} упражнений`
    : `${payload.execution.blocks.completed}/${payload.execution.blocks.total} блоков`;

  return `День отмечен как «${payload.execution.statusLabel.toLowerCase()}»: выполнено ${exerciseLabel}, нагрузка ${formatLoadValue(payload.load.actual)} из ${formatLoadValue(payload.load.planned)}.`;
}

function buildRiskNotes(payload: CoachDayAiPayload) {
  const risks: string[] = [];

  if (payload.plan.count === 0) {
    risks.push("Нет плановой нагрузки: сравнение плана и факта для этого дня ограничено.");
  }

  if (payload.load.planned > 0) {
    const loadRatio = payload.load.actual / payload.load.planned;

    if (loadRatio < 0.5) {
      risks.push("Фактическая нагрузка сильно ниже плана: причина может быть в самочувствии, пропуске части заданий или неполной отметке выполнения.");
    } else if (loadRatio > 1.15) {
      risks.push("Фактическая нагрузка выше плана: стоит проверить восстановление и не добавлять тяжёлую работу автоматически.");
    }
  }

  if (payload.execution.status === "missed") {
    risks.push("День не выполнен: аналитика следующего дня должна учитывать фактический пропуск, а не плановую нагрузку.");
  } else if (payload.execution.status === "partial") {
    risks.push("Есть частичное выполнение: важно смотреть, какие упражнения пропущены, а не оценивать день только по общей нагрузке.");
  }

  if (payload.readiness?.status === "red") {
    risks.push("Готовность в красной зоне: приоритетом должно быть восстановление и уточнение причины снижения.");
  } else if (payload.readiness?.status === "yellow") {
    risks.push("Готовность требует снижения нагрузки: тяжёлую работу лучше оставить только при необходимости.");
  }

  return risks.length ? risks : ["Критичных рисков по текущим данным не видно."];
}

function buildTomorrowActions(payload: CoachDayAiPayload) {
  const actions: string[] = [];

  if (payload.plan.count === 0) {
    actions.push("Сначала назначьте план на день или выберите дату с планом, чтобы рекомендация была предметной.");
  } else if (payload.execution.status === "completed") {
    actions.push("Оставьте следующий день по плану, если готовность не ухудшится.");
  } else if (payload.execution.status === "partial") {
    actions.push("Разберите невыполненные упражнения и перенесите только ключевую часть, если она важна для микроцикла.");
  } else {
    actions.push("Не переносите весь пропущенный объём автоматически; выберите 1-2 ключевых задания или восстановительный день.");
  }

  if (payload.load.planned > 0 && payload.load.actual > payload.load.planned * 1.15) {
    actions.push("Снизьте ближайшую дополнительную нагрузку и проверьте готовность перед следующей интенсивной сессией.");
  }

  if (payload.readiness?.status === "red") {
    actions.push("Поставьте восстановительный акцент и запросите у спортсмена комментарий по самочувствию.");
  } else if (payload.readiness?.status === "yellow") {
    actions.push("Сохраните только техническую или лёгкую специальную часть, объём держите ниже плана.");
  }

  if (!payload.coachComment) {
    actions.push("Добавьте короткий комментарий тренера, чтобы следующий разбор учитывал причину решения.");
  }

  return Array.from(new Set(actions)).slice(0, 4);
}

function formatLoadValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
