import type {
  CoachDayAiPayload,
  CoachDayAiPeriodContext,
  CoachDayAiPeriodContextDay,
  CoachDayAiPeriodWindowSummary,
  CoachDayAiReview,
  CoachPeriodAiPayload,
  CoachPeriodAiReview,
  ReadinessStatus,
  UserRole,
} from "@training-platform/shared";
import { pool } from "../db";
import {
  getCoachAiReviewStatus,
  tryBuildCoachDayAiModelReview,
  tryBuildCoachPeriodAiModelReview,
} from "./coach-ai-model-review.service";
import { markCoachTeamDayDirtyForAthlete } from "./analytics/coach-team-day.service";

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

interface CoachDayAiPeriodRow {
  actual_load: string | null;
  body_weight_kg: string | null;
  completed_blocks: string;
  entry_date: string;
  notes_count: string;
  partial_blocks: string;
  planned_blocks: string;
  planned_load: string | null;
  readiness_score: string | null;
  readiness_status: ReadinessStatus | null;
  resting_hr: string | null;
  sleep_minutes: string | null;
  workout_calories: string | null;
  workout_count: string;
  workout_distance_meters: string | null;
  workout_duration_minutes: string | null;
}

interface CoachPeriodAiReviewRow {
  id: string;
  athlete_id: string;
  coach_user_id: string;
  selected_date: string;
  period_start: string;
  period_end: string;
  window_days: number;
  source: CoachPeriodAiReview["source"];
  observation: string;
  risk_notes: string[] | null;
  period_actions: string[] | null;
  period_payload_json: CoachPeriodAiPayload;
  generated_at: string;
  created_at: string;
}

interface CoachPeriodAthleteRow {
  discipline: string;
  display_name: string;
  sport: string;
  weight_class: string;
}

export async function buildCoachDayAiReview(input: {
  athleteId: string;
  entryDate: string;
  dayPayload: CoachDayAiPayload;
}): Promise<CoachDayAiReview> {
  const serverRulesReview = buildServerRulesCoachDayAiReview(input);
  return (await tryBuildCoachDayAiModelReview(input, serverRulesReview)) ?? serverRulesReview;
}

export async function buildCoachPeriodAiReview(input: {
  athleteId: string;
  selectedDate: string;
  windowDays: number;
}): Promise<CoachPeriodAiReview> {
  const periodPayload = await buildCoachPeriodAiPayload(input);
  const serverRulesReview = buildServerRulesCoachPeriodAiReview({
    athleteId: input.athleteId,
    periodPayload,
  });

  return (await tryBuildCoachPeriodAiModelReview({
    athleteId: input.athleteId,
    periodPayload,
  }, serverRulesReview)) ?? serverRulesReview;
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

async function buildCoachDayAiPeriodContext(input: {
  athleteId: string;
  selectedDate: string;
  windowDays: number;
}): Promise<CoachDayAiPeriodContext> {
  const periodStart = addIsoDays(input.selectedDate, -(input.windowDays - 1));
  const periodEnd = input.selectedDate;
  const rows = await pool.query<CoachDayAiPeriodRow>(
    `
      WITH days AS (
        SELECT generate_series($2::date, $3::date, interval '1 day')::date AS entry_date
      ),
      plan_daily AS (
        SELECT
          assigned_plan_days.day_date AS entry_date,
          COUNT(DISTINCT assigned_day_blocks.id)::integer AS planned_blocks
        FROM assigned_plans
        JOIN assigned_plan_days
          ON assigned_plan_days.assigned_plan_id = assigned_plans.id
        JOIN assigned_day_sessions
          ON assigned_day_sessions.assigned_day_id = assigned_plan_days.id
        JOIN assigned_day_blocks
          ON assigned_day_blocks.assigned_session_id = assigned_day_sessions.id
        WHERE assigned_plans.athlete_id = $1
          AND assigned_plans.status = 'active'
          AND assigned_plan_days.day_date BETWEEN $2::date AND $3::date
        GROUP BY assigned_plan_days.day_date
      ),
      load_daily AS (
        SELECT
          training_load_logs.log_date AS entry_date,
          ROUND(COALESCE(SUM(training_load_logs.planned_load), 0)::numeric, 1) AS planned_load,
          ROUND(COALESCE(SUM(training_load_logs.actual_load), 0)::numeric, 1) AS actual_load,
          COUNT(*) FILTER (WHERE training_load_logs.completion_status = 'completed')::integer AS completed_blocks,
          COUNT(*) FILTER (WHERE training_load_logs.completion_status = 'partial')::integer AS partial_blocks
        FROM training_load_logs
        WHERE training_load_logs.athlete_id = $1
          AND training_load_logs.log_date BETWEEN $2::date AND $3::date
        GROUP BY training_load_logs.log_date
      ),
      readiness_daily AS (
        SELECT
          daily_readiness_entries.entry_date,
          readiness_scores.score,
          readiness_scores.status,
          daily_readiness_entries.body_weight AS body_weight_kg,
          daily_readiness_entries.resting_hr
        FROM daily_readiness_entries
        LEFT JOIN readiness_scores
          ON readiness_scores.readiness_entry_id = daily_readiness_entries.id
        WHERE daily_readiness_entries.athlete_id = $1
          AND daily_readiness_entries.entry_date BETWEEN $2::date AND $3::date
      ),
      device_daily AS (
        SELECT
          device_health_daily_summaries.entry_date,
          MAX(device_health_daily_summaries.sleep_duration_minutes) AS sleep_minutes,
          MIN(device_health_daily_summaries.resting_hr) AS device_resting_hr,
          SUM(device_health_daily_summaries.workout_count)::integer AS workout_count,
          SUM(device_health_daily_summaries.workout_duration_minutes) AS workout_duration_minutes,
          SUM(device_health_daily_summaries.workout_distance_meters) AS workout_distance_meters,
          SUM(device_health_daily_summaries.workout_active_calories) AS workout_calories
        FROM device_health_daily_summaries
        WHERE device_health_daily_summaries.athlete_id = $1
          AND device_health_daily_summaries.entry_date BETWEEN $2::date AND $3::date
        GROUP BY device_health_daily_summaries.entry_date
      ),
      workout_daily AS (
        SELECT
          device_workouts.entry_date,
          COUNT(*)::integer AS workout_count,
          SUM(device_workouts.duration_minutes) AS workout_duration_minutes,
          SUM(device_workouts.distance_meters) AS workout_distance_meters,
          SUM(device_workouts.active_calories) AS workout_calories
        FROM device_workouts
        WHERE device_workouts.athlete_id = $1
          AND device_workouts.entry_date BETWEEN $2::date AND $3::date
        GROUP BY device_workouts.entry_date
      ),
      diary_daily AS (
        SELECT
          coach_diary_entries.entry_date,
          COUNT(*)::integer AS notes_count
        FROM coach_diary_entries
        WHERE coach_diary_entries.athlete_id = $1
          AND coach_diary_entries.entry_date BETWEEN $2::date AND $3::date
          AND BTRIM(coach_diary_entries.notes) <> ''
        GROUP BY coach_diary_entries.entry_date
      )
      SELECT
        days.entry_date::text,
        COALESCE(load_daily.planned_load, 0)::text AS planned_load,
        COALESCE(load_daily.actual_load, 0)::text AS actual_load,
        COALESCE(plan_daily.planned_blocks, 0)::text AS planned_blocks,
        COALESCE(load_daily.completed_blocks, 0)::text AS completed_blocks,
        COALESCE(load_daily.partial_blocks, 0)::text AS partial_blocks,
        readiness_daily.score::text AS readiness_score,
        readiness_daily.status AS readiness_status,
        readiness_daily.body_weight_kg::text,
        COALESCE(readiness_daily.resting_hr, device_daily.device_resting_hr)::text AS resting_hr,
        device_daily.sleep_minutes::text,
        GREATEST(COALESCE(device_daily.workout_count, 0), COALESCE(workout_daily.workout_count, 0))::text AS workout_count,
        COALESCE(device_daily.workout_duration_minutes, workout_daily.workout_duration_minutes)::text AS workout_duration_minutes,
        COALESCE(device_daily.workout_distance_meters, workout_daily.workout_distance_meters)::text AS workout_distance_meters,
        COALESCE(device_daily.workout_calories, workout_daily.workout_calories)::text AS workout_calories,
        COALESCE(diary_daily.notes_count, 0)::text AS notes_count
      FROM days
      LEFT JOIN plan_daily ON plan_daily.entry_date = days.entry_date
      LEFT JOIN load_daily ON load_daily.entry_date = days.entry_date
      LEFT JOIN readiness_daily ON readiness_daily.entry_date = days.entry_date
      LEFT JOIN device_daily ON device_daily.entry_date = days.entry_date
      LEFT JOIN workout_daily ON workout_daily.entry_date = days.entry_date
      LEFT JOIN diary_daily ON diary_daily.entry_date = days.entry_date
      ORDER BY days.entry_date ASC
    `,
    [input.athleteId, periodStart, periodEnd],
  );

  const days = rows.rows.map(mapCoachDayAiPeriodRow);
  const microcycleDays = days.slice(-7);
  const microcycle7 = summarizeCoachDayAiPeriodWindow(microcycleDays);
  const mesocycle30 = summarizeCoachDayAiPeriodWindow(days);
  const trends = {
    bodyWeight: resolveCoachDayAiTrend(days.map((day) => day.bodyWeightKg), 0.3),
    load: resolveCoachDayAiTrend(days.map((day) => day.actualLoad), 5),
    readiness: resolveCoachDayAiTrend(days.map((day) => day.readinessScore), 3),
    restingHr: resolveCoachDayAiTrend(days.map((day) => day.restingHr), 4),
    sleep: resolveCoachDayAiTrend(days.map((day) => day.sleepMinutes), 30),
  };
  const warnings = buildCoachDayAiPeriodWarnings({ mesocycle30, microcycle7, trends });

  return {
    days,
    generatedAt: new Date().toISOString(),
    interpretation: buildCoachDayAiPeriodInterpretation({ mesocycle30, microcycle7, trends }),
    mesocycle30,
    microcycle7,
    periodEnd,
    periodStart,
    selectedDate: input.selectedDate,
    trends,
    warnings,
    windowDays: input.windowDays,
  };
}

async function buildCoachPeriodAiPayload(input: {
  athleteId: string;
  selectedDate: string;
  windowDays: number;
}): Promise<CoachPeriodAiPayload> {
  const [athlete, periodContext] = await Promise.all([
    loadCoachPeriodAiAthlete(input.athleteId),
    buildCoachDayAiPeriodContext(input),
  ]);

  return {
    athlete,
    periodContext,
    periodEnd: periodContext.periodEnd,
    periodStart: periodContext.periodStart,
    selectedDate: input.selectedDate,
    windowDays: input.windowDays,
  };
}

async function loadCoachPeriodAiAthlete(athleteId: string): Promise<CoachPeriodAiPayload["athlete"]> {
  const result = await pool.query<CoachPeriodAthleteRow>(
    `
      SELECT
        users.full_name AS display_name,
        athletes.discipline,
        athletes.sport,
        athletes.weight_class
      FROM athletes
      JOIN users ON users.id = athletes.user_id
      WHERE athletes.id = $1
      LIMIT 1
    `,
    [athleteId],
  );

  const athlete = result.rows[0];

  if (!athlete) {
    throw new Error("Athlete not found for period AI review");
  }

  return {
    displayName: athlete.display_name,
    discipline: athlete.discipline || null,
    sport: athlete.sport || null,
    weightClass: athlete.weight_class || null,
  };
}

function mapCoachDayAiPeriodRow(row: CoachDayAiPeriodRow): CoachDayAiPeriodContextDay {
  const plannedBlocks = toCount(row.planned_blocks);
  const completedBlocks = toCount(row.completed_blocks);
  const partialBlocks = toCount(row.partial_blocks);
  const plannedLoad = toNumber(row.planned_load) ?? 0;
  const actualLoad = toNumber(row.actual_load) ?? 0;

  return {
    actualLoad,
    bodyWeightKg: toNumber(row.body_weight_kg),
    completedBlocks,
    date: row.entry_date,
    loadDelta: roundOne(actualLoad - plannedLoad),
    missedBlocks: Math.max(plannedBlocks - completedBlocks - partialBlocks, 0),
    notesPresent: toCount(row.notes_count) > 0,
    partialBlocks,
    plannedBlocks,
    plannedLoad,
    readinessScore: toNumber(row.readiness_score),
    readinessStatus: row.readiness_status,
    restingHr: toNumber(row.resting_hr),
    sleepMinutes: toNumber(row.sleep_minutes),
    workoutCalories: toNumber(row.workout_calories),
    workoutCount: toCount(row.workout_count),
    workoutDistanceMeters: toNumber(row.workout_distance_meters),
    workoutDurationMinutes: toNumber(row.workout_duration_minutes),
  };
}

function summarizeCoachDayAiPeriodWindow(days: CoachDayAiPeriodContextDay[]): CoachDayAiPeriodWindowSummary {
  const plannedLoad = roundOne(days.reduce((sum, day) => sum + day.plannedLoad, 0));
  const actualLoad = roundOne(days.reduce((sum, day) => sum + day.actualLoad, 0));
  const plannedBlocks = days.reduce((sum, day) => sum + day.plannedBlocks, 0);
  const completedBlocks = days.reduce((sum, day) => sum + day.completedBlocks, 0);
  const partialBlocks = days.reduce((sum, day) => sum + day.partialBlocks, 0);
  const readinessDays = days.filter((day) => day.readinessScore !== null);
  const sleepValues = days.map((day) => day.sleepMinutes).filter(isNumber);
  const restingHrValues = days.map((day) => day.restingHr).filter(isNumber);
  const weightDays = days.filter((day) => day.bodyWeightKg !== null);
  const workoutDurationValues = days.map((day) => day.workoutDurationMinutes).filter(isNumber);

  return {
    actualLoad,
    bodyWeightDeltaKg: weightDays.length >= 2
      ? roundOne((weightDays[weightDays.length - 1]?.bodyWeightKg ?? 0) - (weightDays[0]?.bodyWeightKg ?? 0))
      : null,
    completedBlocks,
    completionRate: plannedBlocks > 0
      ? roundOne(((completedBlocks + partialBlocks * 0.5) / plannedBlocks) * 100)
      : null,
    daysWithDeviceData: days.filter((day) =>
      day.sleepMinutes !== null ||
      day.restingHr !== null ||
      day.workoutCount > 0
    ).length,
    daysWithPlan: days.filter((day) => day.plannedBlocks > 0 || day.plannedLoad > 0).length,
    daysWithReadiness: readinessDays.length,
    highLoadDays: days.filter((day) =>
      day.plannedLoad > 0 && day.actualLoad > day.plannedLoad * 1.15
    ).length,
    incompletePlanDays: days.filter((day) =>
      day.plannedBlocks > 0 && day.completedBlocks + day.partialBlocks < day.plannedBlocks
    ).length,
    loadDelta: roundOne(actualLoad - plannedLoad),
    loadRatio: plannedLoad > 0 ? roundOne((actualLoad / plannedLoad) * 100) : null,
    partialBlocks,
    periodDays: days.length,
    plannedBlocks,
    plannedLoad,
    readinessAverage: averageOrNull(readinessDays.map((day) => day.readinessScore).filter(isNumber)),
    readinessGreenDays: readinessDays.filter((day) => day.readinessStatus === "green").length,
    readinessRedDays: readinessDays.filter((day) => day.readinessStatus === "red").length,
    readinessYellowDays: readinessDays.filter((day) => day.readinessStatus === "yellow").length,
    restingHrAverage: averageOrNull(restingHrValues),
    sleepAverageMinutes: averageOrNull(sleepValues),
    workoutCount: days.reduce((sum, day) => sum + day.workoutCount, 0),
    workoutDays: days.filter((day) => day.workoutCount > 0).length,
    workoutDurationMinutes: workoutDurationValues.length
      ? roundOne(workoutDurationValues.reduce((sum, value) => sum + value, 0))
      : null,
  };
}

function buildCoachDayAiPeriodWarnings(input: {
  mesocycle30: CoachDayAiPeriodWindowSummary;
  microcycle7: CoachDayAiPeriodWindowSummary;
  trends: CoachDayAiPeriodContext["trends"];
}) {
  const warnings: string[] = [];

  if (input.microcycle7.loadRatio !== null && input.microcycle7.loadRatio > 115) {
    warnings.push("За последние 7 дней фактическая нагрузка выше плановой: решение по следующему дню нельзя принимать только по выбранному дню.");
  }

  if (input.microcycle7.readinessRedDays > 0 || input.microcycle7.readinessYellowDays >= 3) {
    warnings.push("В микроцикле есть устойчивые сигналы сниженной готовности.");
  }

  if (input.microcycle7.sleepAverageMinutes !== null && input.microcycle7.sleepAverageMinutes < 360) {
    warnings.push("Средний сон за неделю ниже 6 часов: риск накопленного недовосстановления.");
  }

  if (input.trends.readiness === "down" && input.trends.load === "up") {
    warnings.push("Нагрузка растёт на фоне снижения готовности: это конфликтный тренд для борьбы.");
  }

  if (input.trends.restingHr === "up") {
    warnings.push("Пульс покоя растёт по периоду: перед интенсивной работой нужна проверка восстановления.");
  }

  if (input.mesocycle30.bodyWeightDeltaKg !== null && Math.abs(input.mesocycle30.bodyWeightDeltaKg) >= 1) {
    warnings.push("Вес заметно изменился за период: при анализе нагрузки надо учитывать весовую динамику, а не только выполнение.");
  }

  return warnings;
}

function buildCoachDayAiPeriodInterpretation(input: {
  mesocycle30: CoachDayAiPeriodWindowSummary;
  microcycle7: CoachDayAiPeriodWindowSummary;
  trends: CoachDayAiPeriodContext["trends"];
}) {
  const interpretation: string[] = [];

  if (input.microcycle7.plannedLoad > 0) {
    interpretation.push(
      `Микроцикл 7 дней: факт ${formatLoadValue(input.microcycle7.actualLoad)} из плана ${formatLoadValue(input.microcycle7.plannedLoad)}, выполнение ${input.microcycle7.completionRate ?? 0}%.`,
    );
  } else {
    interpretation.push("Микроцикл 7 дней: плановая нагрузка не зафиксирована, поэтому контекст периода ограничен.");
  }

  if (input.mesocycle30.plannedLoad > 0) {
    interpretation.push(
      `Период 30 дней: факт ${formatLoadValue(input.mesocycle30.actualLoad)} из плана ${formatLoadValue(input.mesocycle30.plannedLoad)}, дней с готовностью ${input.mesocycle30.daysWithReadiness}/${input.mesocycle30.periodDays}.`,
    );
  }

  if (input.trends.load !== "unknown" || input.trends.readiness !== "unknown") {
    interpretation.push(
      `Тренды: нагрузка ${translateTrend(input.trends.load)}, готовность ${translateTrend(input.trends.readiness)}, сон ${translateTrend(input.trends.sleep)}, пульс покоя ${translateTrend(input.trends.restingHr)}.`,
    );
  }

  return interpretation;
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

function buildServerRulesCoachPeriodAiReview(input: {
  athleteId: string;
  periodPayload: CoachPeriodAiPayload;
}): CoachPeriodAiReview {
  return {
    athleteId: input.athleteId,
    generatedAt: new Date().toISOString(),
    observation: buildPeriodObservation(input.periodPayload),
    periodActions: buildPeriodActions(input.periodPayload),
    periodEnd: input.periodPayload.periodEnd,
    periodPayload: input.periodPayload,
    periodPayloadJson: JSON.stringify(input.periodPayload, null, 2),
    periodStart: input.periodPayload.periodStart,
    riskNotes: buildPeriodRiskNotes(input.periodPayload),
    selectedDate: input.periodPayload.selectedDate,
    source: "server-rules",
    windowDays: input.periodPayload.windowDays,
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
    analysisContext: {
      blocks: [
        {
          blockName: "Техника",
          contactIntensity: "moderate",
          energySystem: "mixed",
          intent: "technical_resisted",
          localZones: ["ноги", "корпус", "плечевой пояс"],
          rationale: "Технические проходы связаны с блоком плана и подтверждены устройством.",
          sessionName: "Утро",
          technicalFocus: ["входы", "качество техники"],
        },
        {
          blockName: "Восстановление",
          contactIntensity: "none",
          energySystem: "recovery",
          intent: "recovery_regeneration",
          localZones: [],
          rationale: "Заминка и дыхание снижают восстановительный долг после основной работы.",
          sessionName: "Утро",
          technicalFocus: [],
        },
      ],
      contactFocus: ["техника с умеренным сопротивлением"],
      energySystems: ["mixed", "recovery"],
      frameworkVersion: "PERFORM wrestling analysis v1",
      keyQuestions: [
        "Сохранилось ли качество техники при частичном выполнении?",
        "Не конфликтует ли следующий день с жёлтой готовностью?",
      ],
      localLoadZones: ["ноги", "корпус", "плечевой пояс"],
      phase: "не указана",
      primaryIntents: ["technical_resisted", "recovery_regeneration"],
      recoverySignals: ["готовность жёлтая", "сон 7 ч 35 мин", "пульс покоя 54"],
      rules: [
        "Технику под сопротивлением не усиливать, если готовность жёлтая.",
        "Связанную тренировку устройства учитывать как факт, но не суммировать повторно с ручной отметкой.",
      ],
      technicalFocus: ["входы", "качество техники"],
      weightCutSignals: [],
    },
    dataQuality: {
      actions: [],
      available: [
        "готовность",
        "план",
        "выполнение",
        "комментарий тренера",
        "сон",
        "пульс покоя",
        "SpO2",
        "тренировки с устройства",
      ],
      missing: [],
      signals: [
        { action: null, key: "readiness", label: "готовность", present: true },
        { action: null, key: "plan", label: "план", present: true },
        { action: null, key: "execution", label: "выполнение", present: true },
        { action: null, key: "coachComment", label: "комментарий тренера", present: true },
        { action: null, key: "deviceSync", label: "синхронизация устройства", present: true },
        { action: null, key: "sleep", label: "сон", present: true },
        { action: null, key: "restingHr", label: "пульс покоя", present: true },
        { action: null, key: "oxygenSaturation", label: "SpO2", present: true },
        { action: null, key: "deviceWorkout", label: "тренировки с устройства", present: true },
      ],
      status: "complete",
      statusLabel: "Данных достаточно",
    },
    date: entryDate,
    limitations: [],
    deviceHealth: {
      heartRate: {
        averageBpm: 68,
        hrvRmssdMs: 42,
        maxBpm: 142,
        minBpm: 48,
        restingBpm: 54,
      },
      missing: [],
      oxygenSaturation: {
        averagePercent: 97,
        latestPercent: 97,
        maxPercent: 99,
        minPercent: 95,
        sampleCount: 12,
      },
      linkedWorkouts: [
        {
          averageHeartRateBpm: 126,
          distanceMeters: 5200,
          durationMinutes: 48,
          endTime: new Date(Date.now() + 48 * 60 * 1000).toISOString(),
          hasDistance: true,
          hasGraph: true,
          hasHeartRate: true,
          hasSpO2: false,
          linkedToPlan: true,
          linkStatusLabel: "связано с блоком плана",
          maxHeartRateBpm: 148,
          planBlockId: "diagnostic-block",
          planBlockName: "Техника",
          sourceDevice: "Huawei Health",
          startTime: new Date().toISOString(),
          workoutId: "diagnostic-workout",
          workoutType: "training",
        },
      ],
      sleep: {
        awakeMinutes: 24,
        deepMinutes: 92,
        durationMinutes: 455,
        lightMinutes: 245,
        remMinutes: 94,
        score: 78,
      },
      sourceDevice: "Huawei Health",
      statusLabel: "Данные полные",
      syncedAt: new Date().toISOString(),
      workout: {
        activeCalories: 320,
        averageHeartRateBpm: 126,
        count: 1,
        maxHeartRateBpm: 148,
        totalDistanceMeters: null,
        totalDurationMinutes: 48,
      },
    },
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
      deviceConfirmed: 54,
      explanation: [
        "Плановая: 100 из назначенных блоков плана.",
        "Факт по отметкам: 78 из сохранённых отметок выполнения.",
        "Подтверждено устройством: 54 · 1/1 плановых целей связано.",
        "Итоговый факт: 78 без повторного суммирования ручных и device-данных.",
        "Расхождение: -22 ниже плана; часть задач не выполнена или не отмечена.",
      ],
      manualActual: 78,
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

  const review = mapCoachDayAiReview(result.rows[0]);

  await markCoachTeamDayDirtyForAthlete({
    athleteId: review.athleteId,
    entryDate: review.entryDate,
    reason: "coach_ai_review",
  });

  return review;
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

function mapCoachPeriodAiReview(row: CoachPeriodAiReviewRow): CoachPeriodAiReview {
  return {
    id: row.id,
    athleteId: row.athlete_id,
    coachUserId: row.coach_user_id,
    createdAt: row.created_at,
    generatedAt: row.generated_at,
    observation: row.observation,
    periodActions: row.period_actions ?? [],
    periodEnd: row.period_end,
    periodPayload: row.period_payload_json,
    periodPayloadJson: JSON.stringify(row.period_payload_json, null, 2),
    periodStart: row.period_start,
    riskNotes: row.risk_notes ?? [],
    selectedDate: row.selected_date,
    source: row.source,
    windowDays: row.window_days,
  };
}

export async function saveCoachPeriodAiReview(input: {
  coachUserId: string;
  review: CoachPeriodAiReview;
}) {
  const result = await pool.query<CoachPeriodAiReviewRow>(
    `
      INSERT INTO coach_ai_period_reviews (
        athlete_id,
        coach_user_id,
        selected_date,
        period_start,
        period_end,
        window_days,
        source,
        observation,
        risk_notes,
        period_actions,
        period_payload_json,
        generated_at
      )
      VALUES ($1, $2, $3::date, $4::date, $5::date, $6, $7, $8, $9::text[], $10::text[], $11::jsonb, $12::timestamptz)
      RETURNING
        id,
        athlete_id,
        coach_user_id,
        selected_date::text,
        period_start::text,
        period_end::text,
        window_days,
        source,
        observation,
        risk_notes,
        period_actions,
        period_payload_json,
        generated_at::text,
        created_at::text
    `,
    [
      input.review.athleteId,
      input.coachUserId,
      input.review.selectedDate,
      input.review.periodStart,
      input.review.periodEnd,
      input.review.windowDays,
      input.review.source,
      input.review.observation,
      input.review.riskNotes,
      input.review.periodActions,
      JSON.stringify(input.review.periodPayload),
      input.review.generatedAt,
    ],
  );

  const review = mapCoachPeriodAiReview(result.rows[0]);

  await markCoachTeamDayDirtyForAthlete({
    athleteId: review.athleteId,
    entryDate: review.selectedDate,
    reason: "coach_period_ai_review",
  });

  return review;
}

async function loadCoachPeriodAiReviews(whereSql: string, params: unknown[]) {
  const result = await pool.query<CoachPeriodAiReviewRow>(
    `
      SELECT
        id,
        athlete_id,
        coach_user_id,
        selected_date::text,
        period_start::text,
        period_end::text,
        window_days,
        source,
        observation,
        risk_notes,
        period_actions,
        period_payload_json,
        generated_at::text,
        created_at::text
      FROM coach_ai_period_reviews
      WHERE ${whereSql}
      ORDER BY generated_at DESC
      LIMIT 300
    `,
    params,
  );

  return result.rows.map(mapCoachPeriodAiReview);
}

export function listCoachPeriodAiReviewsForCoachContext(input: {
  coachUserId: string;
  role: UserRole;
}) {
  if (input.role === "admin") {
    return loadCoachPeriodAiReviews("TRUE", []);
  }

  return loadCoachPeriodAiReviews(
    `
      EXISTS (
        SELECT 1
        FROM coach_athletes
        WHERE coach_athletes.athlete_id = coach_ai_period_reviews.athlete_id
          AND coach_athletes.coach_user_id = $1
      )
    `,
    [input.coachUserId],
  );
}

function buildObservation(payload: CoachDayAiPayload) {
  if (payload.plan.count === 0) {
    return "На выбранный день нет назначенного плана, поэтому дневной разбор может оценить только готовность, устройство и комментарии.";
  }

  const exerciseLabel = payload.execution.exercises.total > 0
    ? `${payload.execution.exercises.completed}/${payload.execution.exercises.total} упражнений`
    : `${payload.execution.blocks.completed}/${payload.execution.blocks.total} блоков`;

  const deviceConfirmedLabel = buildDeviceConfirmedLoadObservation(payload);
  const deviceLabel = buildDeviceHealthObservation(payload);
  const deltaLabel = payload.load.delta === 0
    ? "расхождения с планом нет"
    : payload.load.delta > 0
      ? `выше плана на ${formatLoadValue(payload.load.delta)}`
      : `ниже плана на ${formatLoadValue(Math.abs(payload.load.delta))}`;

  return `День отмечен как «${payload.execution.statusLabel.toLowerCase()}»: выполнено ${exerciseLabel}, нагрузка ${formatLoadValue(payload.load.actual)} из ${formatLoadValue(payload.load.planned)}, ${deltaLabel}.${deviceConfirmedLabel ? ` ${deviceConfirmedLabel}` : ""}${deviceLabel ? ` ${deviceLabel}` : ""}`;
}

function buildRiskNotes(payload: CoachDayAiPayload) {
  const risks: string[] = [];

  if (payload.plan.count === 0) {
    risks.push("Нет плановой нагрузки: сравнение плана и факта для этого дня ограничено.");
  }

  addDataQualityRiskNotes(risks, payload);

  if (payload.load.planned > 0) {
    const loadRatio = payload.load.actual / payload.load.planned;

    if (loadRatio < 0.5) {
      risks.push("Фактическая нагрузка сильно ниже плана: причина может быть в самочувствии, пропуске части заданий или неполной отметке выполнения.");
    } else if (loadRatio > 1.15) {
      risks.push("Фактическая нагрузка выше плана: стоит проверить восстановление и не добавлять тяжёлую работу автоматически.");
    }
  }

  if (payload.execution.status === "missed" && payload.load.deviceConfirmed <= 0) {
    risks.push("День не выполнен: аналитика следующего дня должна учитывать фактический пропуск, а не плановую нагрузку.");
  } else if (payload.execution.status === "missed") {
    risks.push("Ручных отметок выполнения нет, но связанная тренировка устройства подтверждает факт по плановому блоку; проверьте оставшиеся задачи дня.");
  } else if (payload.execution.status === "partial") {
    risks.push("Есть частичное выполнение: важно смотреть, какие упражнения пропущены, а не оценивать день только по общей нагрузке.");
  }

  if (payload.readiness?.status === "red") {
    risks.push("Готовность в красной зоне: приоритетом должно быть восстановление и уточнение причины снижения.");
  } else if (payload.readiness?.status === "yellow") {
    risks.push("Готовность требует снижения нагрузки: тяжёлую работу лучше оставить только при необходимости.");
  }

  addWrestlingAnalysisRiskNotes(risks, payload);
  addDeviceHealthRiskNotes(risks, payload);

  return risks.length ? risks : ["Критичных рисков по текущим данным не видно."];
}

function buildTomorrowActions(payload: CoachDayAiPayload) {
  const actions: string[] = [];

  addDataQualityTomorrowActions(actions, payload);

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

  addWrestlingAnalysisTomorrowActions(actions, payload);

  if (!payload.coachComment) {
    actions.push("Добавьте короткий комментарий тренера, чтобы следующий разбор учитывал причину решения.");
  }

  addDeviceHealthTomorrowActions(actions, payload);

  return Array.from(new Set(actions)).slice(0, 4);
}

function buildPeriodObservation(payload: CoachPeriodAiPayload) {
  const period = payload.periodContext;
  const selectedWindow = period.mesocycle30;
  const periodLabel = `за выбранные ${period.windowDays} дней`;
  const parts = [
    selectedWindow.plannedLoad > 0
      ? `${periodLabel} факт ${formatLoadValue(selectedWindow.actualLoad)} из плана ${formatLoadValue(selectedWindow.plannedLoad)}`
      : `${periodLabel} плановая нагрузка не зафиксирована`,
    selectedWindow.completionRate !== null ? `выполнение ${formatLoadValue(selectedWindow.completionRate)}%` : null,
    selectedWindow.readinessAverage !== null
      ? `готовность в среднем ${formatLoadValue(selectedWindow.readinessAverage)}`
      : null,
    selectedWindow.sleepAverageMinutes !== null
      ? `сон ${formatDurationMinutes(selectedWindow.sleepAverageMinutes)} в среднем`
      : null,
    selectedWindow.bodyWeightDeltaKg !== null
      ? `динамика веса ${formatSignedValue(selectedWindow.bodyWeightDeltaKg)} кг`
      : null,
  ].filter((item): item is string => Boolean(item));

  return `Общий разбор периода ${period.periodStart}–${period.periodEnd}: ${parts.join(", ")}. Тренды: нагрузка ${translateTrend(period.trends.load)}, готовность ${translateTrend(period.trends.readiness)}, сон ${translateTrend(period.trends.sleep)}, пульс покоя ${translateTrend(period.trends.restingHr)}.`;
}

function buildPeriodRiskNotes(payload: CoachPeriodAiPayload) {
  const period = payload.periodContext;
  const risks: string[] = [];

  for (const warning of period.warnings.slice(0, 4)) {
    risks.push(warning);
  }

  if (period.microcycle7.daysWithReadiness < Math.min(4, period.microcycle7.periodDays)) {
    risks.push("Мало дней с готовностью в микроцикле: общий вывод по восстановлению ограничен.");
  }

  if (period.microcycle7.daysWithDeviceData < Math.min(4, period.microcycle7.periodDays)) {
    risks.push("Данные устройства приходили не каждый день: сон, пульс покоя и тренировки могут быть неполной картиной.");
  }

  if (
    period.microcycle7.completionRate !== null &&
    period.microcycle7.completionRate < 70 &&
    period.microcycle7.daysWithPlan >= 3
  ) {
    risks.push("В микроцикле низкое закрытие плана: нужно искать причину, а не автоматически переносить весь недобор.");
  }

  if (
    period.microcycle7.loadRatio !== null &&
    period.microcycle7.loadRatio > 115 &&
    (period.trends.readiness === "down" || period.microcycle7.readinessYellowDays + period.microcycle7.readinessRedDays > 0)
  ) {
    risks.push("Факт выше плана совпадает с просадкой готовности: высокий риск накопления утомления для контактной или гликолитической работы.");
  }

  if (period.trends.restingHr === "up" && period.trends.sleep === "down") {
    risks.push("Пульс покоя растёт, а сон снижается: перед усилением нагрузки нужен отдельный контроль восстановления.");
  }

  return Array.from(new Set(risks)).slice(0, 5);
}

function buildPeriodActions(payload: CoachPeriodAiPayload) {
  const period = payload.periodContext;
  const actions: string[] = [];

  if (period.trends.load === "up" && period.trends.readiness === "down") {
    actions.push("Следующий микроцикл решать от восстановления: сначала сон, пульс покоя, готовность и качество техники, потом добор объёма.");
  }

  if (period.microcycle7.incompletePlanDays >= 2) {
    actions.push("Разобрать незакрытые дни: отделить пропуски, частичные блоки и тренировки с часов, которые не были привязаны к плану.");
  }

  if (period.microcycle7.sleepAverageMinutes !== null && period.microcycle7.sleepAverageMinutes < 360) {
    actions.push("Не усиливать контактную и гликолитическую работу, пока сон за последние дни не станет понятным.");
  }

  if (period.mesocycle30.bodyWeightDeltaKg !== null && Math.abs(period.mesocycle30.bodyWeightDeltaKg) >= 1) {
    actions.push("Сверить динамику веса с фазой подготовки: не трактовать нагрузку без контекста веса и восстановления.");
  }

  if (actions.length === 0) {
    actions.push("Оставить плановую логику периода, но ежедневно проверять готовность, сон и пульс покоя перед тяжёлыми блоками.");
  }

  return Array.from(new Set(actions)).slice(0, 4);
}

function buildDeviceHealthObservation(payload: CoachDayAiPayload) {
  const device = payload.deviceHealth;

  if (!device) {
    return "Данные устройства за этот день не синхронизированы.";
  }

  const linkedWorkouts = device.linkedWorkouts ?? [];
  const linkedWorkoutNames = linkedWorkouts
    .map((workout) => workout.planBlockName)
    .filter(Boolean);
  const parts = [
    device.sleep?.durationMinutes !== null && device.sleep?.durationMinutes !== undefined
      ? `сон ${formatDurationMinutes(device.sleep.durationMinutes)}`
      : null,
    device.heartRate?.restingBpm !== null && device.heartRate?.restingBpm !== undefined
      ? `пульс покоя ${formatLoadValue(device.heartRate.restingBpm)}`
      : null,
    device.oxygenSaturation?.latestPercent !== null && device.oxygenSaturation?.latestPercent !== undefined
      ? `SpO2 ${formatLoadValue(device.oxygenSaturation.latestPercent)}%`
      : device.oxygenSaturation?.averagePercent !== null && device.oxygenSaturation?.averagePercent !== undefined
        ? `SpO2 средний ${formatLoadValue(device.oxygenSaturation.averagePercent)}%`
        : null,
    device.workout ? `тренировки устройства: ${device.workout.count}` : null,
    linkedWorkouts.length
      ? `связано с планом: ${linkedWorkoutNames.length ? linkedWorkoutNames.join(", ") : `${linkedWorkouts.length} блок(а)`}`
      : device.workout && device.workout.count > 0
        ? "тренировка устройства пока не связана с блоком плана"
        : null,
  ].filter((item): item is string => Boolean(item));

  return parts.length ? `По устройству: ${parts.join(", ")}.` : "Данные устройства пришли неполностью.";
}

function addDataQualityRiskNotes(risks: string[], payload: CoachDayAiPayload) {
  const dataQuality = payload.dataQuality;

  if (!dataQuality) {
    risks.push("Качество данных дня не передано: вывод ограничен доступными полями карточки.");
    return;
  }

  const limitation = dataQuality.missing.length > 0
    ? `Вывод ограничен, потому что не хватает ${dataQuality.missing.slice(0, 5).join(", ")}.`
    : payload.limitations[0] ?? null;

  if (limitation) {
    risks.push(limitation);
  }

  if (dataQuality.status === "partial") {
    risks.push("Данные частичные: не делайте уверенный вывод только по общей нагрузке.");
  } else if (dataQuality.status === "insufficient") {
    risks.push(`Данных мало для анализа: не хватает ${dataQuality.missing.slice(0, 5).join(", ")}.`);
  }
}

function addDataQualityTomorrowActions(actions: string[], payload: CoachDayAiPayload) {
  const dataQuality = payload.dataQuality;

  if (!dataQuality) {
    actions.push("Проверьте полноту данных дня перед принятием решения по нагрузке.");
    return;
  }

  for (const action of dataQuality.actions.slice(0, 2)) {
    actions.push(action);
  }
}

function addWrestlingAnalysisRiskNotes(risks: string[], payload: CoachDayAiPayload) {
  const context = payload.analysisContext;

  if (!context) {
    risks.push("Научная рамка PERFORM для борьбы не передана: локальная усталость, контакт и intent блоков оцениваются ограниченно.");
    return;
  }

  const highContactBlocks = context.blocks.filter((block) => block.contactIntensity === "high");
  const gripOrUpperLoad = context.localLoadZones.some((zone) =>
    /предплеч|хват|плеч|шея|верх/u.test(zone.toLowerCase())
  );
  const glycolyticIntent = context.energySystems.some((item) =>
    /glycolytic|гликолит|z4|z5|mixed/u.test(item.toLowerCase())
  );
  const taperOrCompetition = /taper|подвод|старт|соревн|competition/u.test(context.phase.toLowerCase());
  const recoveryLimited = payload.readiness?.status === "yellow" ||
    payload.readiness?.status === "red" ||
    isDeviceSleepLow(payload) ||
    isDeviceRestingHrHigh(payload);

  if (highContactBlocks.length > 0) {
    risks.push(`Контактная нагрузка высокая: ${highContactBlocks.slice(0, 3).map((block) => block.blockName).join(", ")}. Оценивайте день не только по общей нагрузке, но и по контакту.`);
  }

  if (gripOrUpperLoad) {
    risks.push("Есть локальная нагрузка на хват/верх: перед борьбой, партером или клинчем проверьте предплечья, плечи и шею.");
  }

  if (glycolyticIntent && recoveryLimited) {
    risks.push("Гликолитическая или смешанная работа совпадает с ограниченным восстановлением: нельзя автоматически добавлять финишные отрезки или борьбу в темпе.");
  }

  if (taperOrCompetition && payload.load.actual > payload.load.planned * 1.05) {
    risks.push("Фаза подводки/соревнования не должна добирать лишний объём: факт выше плана может ухудшить свежесть.");
  }

  for (const signal of context.weightCutSignals.slice(0, 2)) {
    risks.push(`Контекст веса: ${signal}.`);
  }
}

function addWrestlingAnalysisTomorrowActions(actions: string[], payload: CoachDayAiPayload) {
  const context = payload.analysisContext;

  if (!context) {
    return;
  }

  const hasHighContact = context.blocks.some((block) => block.contactIntensity === "high");
  const hasTechnicalUnderFatigue = context.primaryIntents.some((intent) =>
    /fatigue|соревнов|competition|combat_rounds/u.test(intent.toLowerCase())
  );
  const hasLocalGripLoad = context.localLoadZones.some((zone) =>
    /предплеч|хват|плеч|шея/u.test(zone.toLowerCase())
  );
  const recoveryLimited = payload.readiness?.status === "yellow" ||
    payload.readiness?.status === "red" ||
    isDeviceSleepLow(payload) ||
    isDeviceRestingHrHigh(payload);

  if (hasHighContact && recoveryLimited) {
    actions.push("На следующий день снизьте контакт: оставьте технику без силового давления или короткую активацию.");
  }

  if (hasTechnicalUnderFatigue) {
    actions.push("Проверьте качество техники: если оно падало под утомлением, не переносите весь объём, а оставьте только ключевой технический акцент.");
  }

  if (hasLocalGripLoad) {
    actions.push("Перед следующей борьбой с захватами уточните локальную усталость предплечий/плеч и не ставьте тяжёлый хват подряд.");
  }

  for (const rule of context.rules.slice(0, 1)) {
    actions.push(rule);
  }
}

function addDeviceHealthRiskNotes(risks: string[], payload: CoachDayAiPayload) {
  const device = payload.deviceHealth;

  if (!device) {
    risks.push("Нет данных устройства: сон, пульс покоя и тренировки с телефона не учитываются в разборе.");
    return;
  }

  if ((device.missing?.length ?? 0) > 0) {
    risks.push(`Данные устройства неполные: не хватает ${device.missing.join(", ")}.`);
  }

  const linkedWorkouts = device.linkedWorkouts ?? [];

  if (linkedWorkouts.length > 0) {
    const linkedNames = linkedWorkouts
      .map((workout) => workout.planBlockName)
      .filter(Boolean)
      .slice(0, 3);
    risks.push(`Факт с устройства учитывается по привязке к плану: ${linkedNames.length ? linkedNames.join(", ") : "блок плана"}.`);
  } else if (device.workout && device.workout.count > 0) {
    risks.push("Тренировка с устройства пришла, но не связана с блоком плана: сравнение плана и факта по устройству ограничено.");
  }

  if (isDeviceSleepLow(payload)) {
    risks.push("Сон по устройству низкий: перед высокой нагрузкой важно уточнить восстановление спортсмена.");
  }

  if (isDeviceRestingHrHigh(payload)) {
    risks.push("Пульс покоя по устройству высокий: это повод не повышать нагрузку без проверки самочувствия.");
  }

  if (device.workout && device.workout.count > 0 && payload.execution.status !== "completed") {
    risks.push("Устройство показывает тренировочную активность, но план отмечен не полностью: проверьте, не была ли работа выполнена вне отметок.");
  }
}

function addDeviceHealthTomorrowActions(actions: string[], payload: CoachDayAiPayload) {
  const device = payload.deviceHealth;

  if (!device) {
    actions.push("Попросите спортсмена синхронизировать Huawei Health или Mi Fitness перед следующим разбором.");
    return;
  }

  if (isDeviceSleepLow(payload) || isDeviceRestingHrHigh(payload)) {
    actions.push("Сверьте сон и пульс покоя с самочувствием, прежде чем оставлять тяжёлую работу на следующий день.");
  }
}

function buildDeviceConfirmedLoadObservation(payload: CoachDayAiPayload) {
  if (payload.load.deviceConfirmed <= 0) {
    return "";
  }

  if (payload.load.manualActual <= 0) {
    return `Факт нагрузки подтверждён устройством: ${formatLoadValue(payload.load.deviceConfirmed)} из привязанной тренировки, без ручной отметки спортсмена.`;
  }

  return `Факт устройства подтверждает ${formatLoadValue(payload.load.deviceConfirmed)} нагрузки по привязанной тренировке; итог не суммируется повторно с ручной отметкой.`;
}

function isDeviceSleepLow(payload: CoachDayAiPayload) {
  const sleep = payload.deviceHealth?.sleep;

  return Boolean(
    sleep &&
      (
        (sleep.durationMinutes !== null && sleep.durationMinutes < 360) ||
        (sleep.score !== null && sleep.score < 60)
      ),
  );
}

function isDeviceRestingHrHigh(payload: CoachDayAiPayload) {
  const restingBpm = payload.deviceHealth?.heartRate?.restingBpm;

  return restingBpm !== null && restingBpm !== undefined && restingBpm >= 80;
}

function formatDurationMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);

  if (hours <= 0) {
    return `${minutes} мин`;
  }

  return minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`;
}

function formatLoadValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatSignedValue(value: number) {
  return value > 0 ? `+${formatLoadValue(value)}` : formatLoadValue(value);
}

function addIsoDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toCount(value: string | number | null | undefined) {
  const parsed = toNumber(value);
  return parsed === null ? 0 : Math.max(0, Math.round(parsed));
}

function isNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function roundOne(value: number) {
  return Number(value.toFixed(1));
}

function averageOrNull(values: number[]) {
  if (!values.length) {
    return null;
  }

  return roundOne(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function resolveCoachDayAiTrend(
  values: Array<number | null>,
  threshold: number,
): CoachDayAiPeriodContext["trends"]["load"] {
  const compactValues = values.filter(isNumber);

  if (compactValues.length < 4) {
    return "unknown";
  }

  const midpoint = Math.floor(compactValues.length / 2);
  const firstAverage = averageOrNull(compactValues.slice(0, midpoint));
  const secondAverage = averageOrNull(compactValues.slice(midpoint));

  if (firstAverage === null || secondAverage === null) {
    return "unknown";
  }

  const delta = secondAverage - firstAverage;

  if (Math.abs(delta) < threshold) {
    return "stable";
  }

  return delta > 0 ? "up" : "down";
}

function translateTrend(value: CoachDayAiPeriodContext["trends"]["load"]) {
  if (value === "up") {
    return "растёт";
  }

  if (value === "down") {
    return "снижается";
  }

  if (value === "stable") {
    return "стабильна";
  }

  return "нет данных";
}
