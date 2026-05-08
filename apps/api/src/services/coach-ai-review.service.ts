import type {
  CoachDayAiPayload,
  CoachDayAiReview,
  UserRole,
} from "@training-platform/shared";
import { pool } from "../db";
import {
  getCoachAiReviewStatus,
  tryBuildCoachDayAiModelReview,
} from "./coach-ai-model-review.service";

interface CoachDayAiReviewRow {
  id: string;
  athlete_id: string;
  coach_user_id: string;
  entry_date: string;
  source: CoachDayAiReview["source"];
  observation: string;
  risk_notes: string[] | null;
  tomorrow_actions: string[] | null;
  day_payload_json: CoachDayAiPayload;
  generated_at: string;
  created_at: string;
}

export async function buildCoachDayAiReview(input: {
  athleteId: string;
  entryDate: string;
  dayPayload: CoachDayAiPayload;
}): Promise<CoachDayAiReview> {
  const serverRulesReview = buildServerRulesCoachDayAiReview(input);
  return (await tryBuildCoachDayAiModelReview(input, serverRulesReview)) ?? serverRulesReview;
}

export { getCoachAiReviewStatus };

export async function runCoachAiReviewDiagnostic() {
  const status = getCoachAiReviewStatus();
  const entryDate = new Date().toISOString().slice(0, 10);
  const review = await buildCoachDayAiReview({
    athleteId: "diagnostic",
    dayPayload: buildDiagnosticCoachDayPayload(entryDate),
    entryDate,
  });
  const fallbackUsed = review.source !== "model";
  const message = review.source === "model"
    ? "Тестовый вызов модели прошёл успешно. План и дневник не изменены."
    : status.mode === "model" && status.modelReady
      ? "Модель настроена, но тестовый вызов ушёл в fallback на серверные правила. План и дневник не изменены."
      : "Модель не вызвана: работает серверный разбор по правилам. План и дневник не изменены.";

  return {
    checkedAt: new Date().toISOString(),
    fallbackUsed,
    message,
    review,
    status,
  };
}

function buildServerRulesCoachDayAiReview(input: {
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
    source: "server-rules",
    tomorrowActions: buildTomorrowActions(input.dayPayload),
  };
}

function buildDiagnosticCoachDayPayload(entryDate: string): CoachDayAiPayload {
  return {
    athlete: {
      discipline: "вольная борьба",
      displayName: "Тестовый спортсмен",
      sport: "борьба",
      weightClass: null,
    },
    coachComment: "Тестовая проверка подключения ИИ. Не записывать в дневник.",
    date: entryDate,
    execution: {
      blocks: {
        completed: 1,
        missed: 0,
        partial: 1,
        total: 2,
      },
      exercises: {
        completed: 3,
        missed: 1,
        partial: 0,
        total: 4,
      },
      status: "partial",
      statusLabel: "Частично выполнено",
    },
    load: {
      actual: 78,
      delta: -22,
      planned: 100,
    },
    plan: {
      blocks: [
        {
          actualLoad: 54,
          exercises: [
            {
              actual: "выполнено",
              name: "Разминка",
              plannedControl: "пульс до 140",
              plannedWork: "12 мин",
              status: "completed",
            },
            {
              actual: "выполнено 3 из 4",
              name: "Технические проходы",
              plannedControl: "качество",
              plannedWork: "4x6",
              status: "partial",
            },
          ],
          name: "Техника",
          plannedLoad: 70,
          sessionName: "Утро",
          status: "partial",
        },
        {
          actualLoad: 24,
          exercises: [
            {
              actual: "выполнено",
              name: "Заминка",
              plannedControl: "дыхание",
              plannedWork: "8 мин",
              status: "completed",
            },
          ],
          name: "Восстановление",
          plannedLoad: 30,
          sessionName: "Утро",
          status: "completed",
        },
      ],
      count: 1,
      templates: ["Тестовый недельный план"],
    },
    readiness: {
      flags: "без боли, усталость умеренная",
      score: 72,
      status: "yellow",
      statusLabel: "Требует внимания",
    },
  };
}

function mapCoachDayAiReview(row: CoachDayAiReviewRow): CoachDayAiReview {
  return {
    id: row.id,
    athleteId: row.athlete_id,
    coachUserId: row.coach_user_id,
    createdAt: row.created_at,
    dayPayload: row.day_payload_json,
    dayPayloadJson: JSON.stringify(row.day_payload_json, null, 2),
    entryDate: row.entry_date,
    generatedAt: row.generated_at,
    observation: row.observation,
    riskNotes: row.risk_notes ?? [],
    source: row.source,
    tomorrowActions: row.tomorrow_actions ?? [],
  };
}

export async function saveCoachDayAiReview(input: {
  coachUserId: string;
  review: CoachDayAiReview;
}) {
  const result = await pool.query<CoachDayAiReviewRow>(
    `
      INSERT INTO coach_ai_day_reviews (
        athlete_id,
        coach_user_id,
        entry_date,
        source,
        observation,
        risk_notes,
        tomorrow_actions,
        day_payload_json,
        generated_at
      )
      VALUES ($1, $2, $3::date, $4, $5, $6::text[], $7::text[], $8::jsonb, $9::timestamptz)
      RETURNING
        id,
        athlete_id,
        coach_user_id,
        entry_date::text,
        source,
        observation,
        risk_notes,
        tomorrow_actions,
        day_payload_json,
        generated_at::text,
        created_at::text
    `,
    [
      input.review.athleteId,
      input.coachUserId,
      input.review.entryDate,
      input.review.source,
      input.review.observation,
      input.review.riskNotes,
      input.review.tomorrowActions,
      JSON.stringify(input.review.dayPayload),
      input.review.generatedAt,
    ],
  );

  return mapCoachDayAiReview(result.rows[0]);
}

async function loadCoachDayAiReviews(whereSql: string, params: unknown[]) {
  const result = await pool.query<CoachDayAiReviewRow>(
    `
      SELECT
        id,
        athlete_id,
        coach_user_id,
        entry_date::text,
        source,
        observation,
        risk_notes,
        tomorrow_actions,
        day_payload_json,
        generated_at::text,
        created_at::text
      FROM coach_ai_day_reviews
      WHERE ${whereSql}
      ORDER BY generated_at DESC
      LIMIT 300
    `,
    params,
  );

  return result.rows.map(mapCoachDayAiReview);
}

export function listCoachDayAiReviewsForCoachContext(input: {
  coachUserId: string;
  role: UserRole;
}) {
  if (input.role === "admin") {
    return loadCoachDayAiReviews("TRUE", []);
  }

  return loadCoachDayAiReviews(
    `
      EXISTS (
        SELECT 1
        FROM coach_athletes
        WHERE coach_athletes.athlete_id = coach_ai_day_reviews.athlete_id
          AND coach_athletes.coach_user_id = $1
      )
    `,
    [input.coachUserId],
  );
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
