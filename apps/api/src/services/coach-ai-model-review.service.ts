import type {
  CoachAiReviewStatus,
  CoachDayAiPayload,
  CoachDayAiReview,
} from "@training-platform/shared";

interface CoachDayAiReviewInput {
  athleteId: string;
  entryDate: string;
  dayPayload: CoachDayAiPayload;
}

interface ModelReviewJson {
  observation?: unknown;
  riskNotes?: unknown;
  tomorrowActions?: unknown;
}

interface ResponsesApiPayload {
  output_text?: unknown;
  output?: Array<{
    content?: Array<{
      text?: unknown;
      type?: string;
    }>;
  }>;
}

const defaultEndpoint = "https://api.openai.com/v1/responses";
const defaultInputLimit = 12_000;
const defaultTimeoutMs = 8_000;
const maxStringLength = 600;
const maxShortStringLength = 180;
const maxPlanBlocks = 12;
const maxExercisesPerBlock = 12;

const systemPrompt = [
  "Ты серверный помощник тренера в платформе PERFORM.",
  "Разбери только переданную карточку дня спортсмена.",
  "Если dataQuality показывает неполные данные, явно напиши, что вывод ограничен и чего не хватает.",
  "Если есть данные устройства, учитывай сон, пульс покоя и тренировки с телефона как контекст восстановления, но не делай медицинских выводов.",
  "Не меняй план, дневник, назначения и статусы.",
  "Не ставь медицинские диагнозы и не выдавай рекомендации как медицинское назначение.",
  "Отвечай на русском языке.",
  "Верни только JSON с полями observation, riskNotes, tomorrowActions.",
  "observation: один короткий вывод по дню.",
  "riskNotes: 1-4 конкретных риска или важных наблюдения.",
  "tomorrowActions: 1-4 практических действия тренера на следующий день.",
].join("\n");

export async function tryBuildCoachDayAiModelReview(
  input: CoachDayAiReviewInput,
  fallbackReview: CoachDayAiReview,
): Promise<CoachDayAiReview | null> {
  const config = readCoachAiModelConfig();

  if (!config.enabled) {
    return null;
  }

  const modelPayload = buildModelSafePayload(input.dayPayload);
  const payloadJson = JSON.stringify(modelPayload);

  if (payloadJson.length > config.inputLimit) {
    return null;
  }

  try {
    const modelReview = await requestModelReview({
      endpoint: config.endpoint,
      inputJson: payloadJson,
      model: config.model,
      timeoutMs: config.timeoutMs,
      apiKey: config.apiKey,
    });

    if (!modelReview) {
      return null;
    }

    return {
      ...fallbackReview,
      generatedAt: new Date().toISOString(),
      observation: modelReview.observation,
      riskNotes: modelReview.riskNotes,
      source: "model",
      tomorrowActions: modelReview.tomorrowActions,
    };
  } catch (error) {
    console.warn(
      "Coach AI model review failed; using server rules.",
      error instanceof Error ? error.message : "unknown error",
    );
    return null;
  }
}

export function getCoachAiReviewStatus(): CoachAiReviewStatus {
  const config = readCoachAiModelConfig();

  if (config.mode !== "model") {
    return {
      apiKeyConfigured: Boolean(config.apiKey),
      endpointConfigured: Boolean(config.endpoint),
      fallbackEnabled: true,
      inputLimit: config.inputLimit,
      message: "Сейчас включён серверный разбор по правилам. Модель не вызывается.",
      mode: "server-rules",
      modelConfigured: Boolean(config.model),
      modelReady: false,
      source: "server-rules",
      timeoutMs: config.timeoutMs,
    };
  }

  if (!config.model || !config.apiKey) {
    return {
      apiKeyConfigured: Boolean(config.apiKey),
      endpointConfigured: Boolean(config.endpoint),
      fallbackEnabled: true,
      inputLimit: config.inputLimit,
      message: "Режим модели включён, но модель или ключ не настроены. Работает fallback на серверные правила.",
      mode: "model",
      modelConfigured: Boolean(config.model),
      modelReady: false,
      source: "server-rules",
      timeoutMs: config.timeoutMs,
    };
  }

  return {
    apiKeyConfigured: true,
    endpointConfigured: Boolean(config.endpoint),
    fallbackEnabled: true,
    inputLimit: config.inputLimit,
    message: "Модель настроена. При ошибке внешнего вызова будет использован fallback на серверные правила.",
    mode: "model",
    modelConfigured: true,
    modelReady: true,
    source: "model",
    timeoutMs: config.timeoutMs,
  };
}

function readCoachAiModelConfig() {
  const rawMode = (process.env.COACH_AI_REVIEW_MODE ?? "server-rules").trim();
  const mode = rawMode === "model" ? "model" : "server-rules";
  const apiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  const model = (process.env.COACH_AI_REVIEW_MODEL ?? "").trim();
  const endpoint = (process.env.COACH_AI_REVIEW_ENDPOINT ?? defaultEndpoint).trim() ||
    defaultEndpoint;
  const inputLimit = readPositiveInteger(
    process.env.COACH_AI_REVIEW_INPUT_LIMIT,
    defaultInputLimit,
  );
  const timeoutMs = readPositiveInteger(
    process.env.COACH_AI_REVIEW_TIMEOUT_MS,
    defaultTimeoutMs,
  );

  return {
    apiKey,
    endpoint,
    inputLimit,
    model,
    mode,
    timeoutMs,
    enabled: mode === "model" && Boolean(apiKey) && Boolean(model),
  };
}

function buildModelSafePayload(payload: CoachDayAiPayload) {
  return {
    coachComment: toLimitedNullableString(payload.coachComment, maxStringLength),
    dataQuality: payload.dataQuality
      ? {
        actions: payload.dataQuality.actions
          .slice(0, 6)
          .map((item) => toLimitedString(item, maxShortStringLength)),
        available: payload.dataQuality.available
          .slice(0, 10)
          .map((item) => toLimitedString(item, maxShortStringLength)),
        missing: payload.dataQuality.missing
          .slice(0, 10)
          .map((item) => toLimitedString(item, maxShortStringLength)),
        signals: payload.dataQuality.signals.slice(0, 10).map((signal) => ({
          action: toLimitedNullableString(signal.action, maxShortStringLength),
          key: toLimitedString(signal.key, maxShortStringLength),
          label: toLimitedString(signal.label, maxShortStringLength),
          present: signal.present,
        })),
        status: payload.dataQuality.status,
        statusLabel: toLimitedString(payload.dataQuality.statusLabel, maxShortStringLength),
      }
      : null,
    date: payload.date,
    deviceHealth: payload.deviceHealth
      ? {
        heartRate: payload.deviceHealth.heartRate
          ? {
            averageBpm: payload.deviceHealth.heartRate.averageBpm,
            hrvRmssdMs: payload.deviceHealth.heartRate.hrvRmssdMs,
            maxBpm: payload.deviceHealth.heartRate.maxBpm,
            minBpm: payload.deviceHealth.heartRate.minBpm,
            restingBpm: payload.deviceHealth.heartRate.restingBpm,
          }
          : null,
        missing: (payload.deviceHealth.missing ?? [])
          .slice(0, 8)
          .map((item) => toLimitedString(item, maxShortStringLength)),
        oxygenSaturation: payload.deviceHealth.oxygenSaturation
          ? {
            averagePercent: payload.deviceHealth.oxygenSaturation.averagePercent,
            latestPercent: payload.deviceHealth.oxygenSaturation.latestPercent,
            maxPercent: payload.deviceHealth.oxygenSaturation.maxPercent,
            minPercent: payload.deviceHealth.oxygenSaturation.minPercent,
            sampleCount: payload.deviceHealth.oxygenSaturation.sampleCount,
          }
          : null,
        linkedWorkouts: (payload.deviceHealth.linkedWorkouts ?? [])
          .slice(0, 8)
          .map((workout) => ({
            averageHeartRateBpm: workout.averageHeartRateBpm,
            distanceMeters: workout.distanceMeters,
            durationMinutes: workout.durationMinutes,
            endTime: workout.endTime,
            hasDistance: workout.hasDistance,
            hasGraph: workout.hasGraph,
            hasHeartRate: workout.hasHeartRate,
            hasSpO2: workout.hasSpO2,
            maxHeartRateBpm: workout.maxHeartRateBpm,
            planBlockName: toLimitedString(workout.planBlockName, maxShortStringLength),
            sourceDevice: toLimitedNullableString(workout.sourceDevice, maxShortStringLength),
            startTime: workout.startTime,
            workoutType: toLimitedString(workout.workoutType, maxShortStringLength),
          })),
        sleep: payload.deviceHealth.sleep
          ? {
            awakeMinutes: payload.deviceHealth.sleep.awakeMinutes,
            deepMinutes: payload.deviceHealth.sleep.deepMinutes,
            durationMinutes: payload.deviceHealth.sleep.durationMinutes,
            lightMinutes: payload.deviceHealth.sleep.lightMinutes,
            remMinutes: payload.deviceHealth.sleep.remMinutes,
            score: payload.deviceHealth.sleep.score,
          }
          : null,
        sourceDevice: toLimitedNullableString(payload.deviceHealth.sourceDevice, maxShortStringLength),
        statusLabel: toLimitedString(payload.deviceHealth.statusLabel, maxShortStringLength),
        syncedAt: payload.deviceHealth.syncedAt,
        workout: payload.deviceHealth.workout
          ? {
            activeCalories: payload.deviceHealth.workout.activeCalories,
            averageHeartRateBpm: payload.deviceHealth.workout.averageHeartRateBpm,
            count: payload.deviceHealth.workout.count,
            maxHeartRateBpm: payload.deviceHealth.workout.maxHeartRateBpm,
            totalDistanceMeters: payload.deviceHealth.workout.totalDistanceMeters,
            totalDurationMinutes: payload.deviceHealth.workout.totalDurationMinutes,
          }
          : null,
      }
      : null,
    execution: payload.execution,
    load: payload.load,
    plan: {
      blocks: payload.plan.blocks.slice(0, maxPlanBlocks).map((block) => ({
        actualLoad: block.actualLoad,
        exercises: block.exercises.slice(0, maxExercisesPerBlock).map((exercise) => ({
          actual: toLimitedString(exercise.actual, maxShortStringLength),
          name: toLimitedString(exercise.name, maxShortStringLength),
          plannedControl: toLimitedString(exercise.plannedControl, maxShortStringLength),
          plannedWork: toLimitedString(exercise.plannedWork, maxShortStringLength),
          status: exercise.status,
        })),
        name: toLimitedString(block.name, maxShortStringLength),
        plannedLoad: block.plannedLoad,
        sessionName: toLimitedString(block.sessionName, maxShortStringLength),
        status: block.status,
      })),
      count: payload.plan.count,
      templates: payload.plan.templates
        .slice(0, 8)
        .map((templateName) => toLimitedString(templateName, maxShortStringLength)),
    },
    readiness: payload.readiness
      ? {
        flags: toLimitedString(payload.readiness.flags, maxStringLength),
        score: payload.readiness.score,
        status: payload.readiness.status,
        statusLabel: payload.readiness.statusLabel,
      }
      : null,
    sportContext: {
      discipline: toLimitedNullableString(payload.athlete.discipline, maxShortStringLength),
      sport: toLimitedNullableString(payload.athlete.sport, maxShortStringLength),
      weightClass: toLimitedNullableString(payload.athlete.weightClass, maxShortStringLength),
    },
  };
}

async function requestModelReview(input: {
  endpoint: string;
  inputJson: string;
  model: string;
  timeoutMs: number;
  apiKey: string;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await fetch(input.endpoint, {
      body: JSON.stringify({
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemPrompt }],
          },
          {
            role: "user",
            content: [{
              type: "input_text",
              text: `Карточка дня JSON:\n${input.inputJson}`,
            }],
          },
        ],
        max_output_tokens: 900,
        model: input.model,
        text: {
          format: {
            name: "coach_day_review",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                observation: { type: "string" },
                riskNotes: {
                  type: "array",
                  items: { type: "string" },
                },
                tomorrowActions: {
                  type: "array",
                  items: { type: "string" },
                },
              },
              required: ["observation", "riskNotes", "tomorrowActions"],
            },
            strict: true,
            type: "json_schema",
          },
        },
      }),
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`model endpoint returned ${response.status}`);
    }

    const body = await response.json() as ResponsesApiPayload;
    return parseModelReviewJson(extractResponseText(body));
  } finally {
    clearTimeout(timeout);
  }
}

function extractResponseText(body: ResponsesApiPayload) {
  if (typeof body.output_text === "string") {
    return body.output_text;
  }

  for (const outputItem of body.output ?? []) {
    for (const contentItem of outputItem.content ?? []) {
      if (
        typeof contentItem.text === "string" &&
        (!contentItem.type || contentItem.type === "output_text")
      ) {
        return contentItem.text;
      }
    }
  }

  return "";
}

function parseModelReviewJson(rawValue: string) {
  const rawJson = rawValue.trim();

  if (!rawJson) {
    return null;
  }

  let parsed: ModelReviewJson;
  try {
    parsed = JSON.parse(rawJson) as ModelReviewJson;
  } catch {
    return null;
  }

  const observation = toModelText(parsed.observation);
  const riskNotes = toModelList(parsed.riskNotes);
  const tomorrowActions = toModelList(parsed.tomorrowActions);

  if (!observation || riskNotes.length === 0 || tomorrowActions.length === 0) {
    return null;
  }

  return {
    observation,
    riskNotes,
    tomorrowActions,
  };
}

function toModelText(value: unknown) {
  return typeof value === "string"
    ? toLimitedString(value.trim(), maxStringLength)
    : "";
}

function toModelList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(toModelText)
    .filter(Boolean)
    .slice(0, 4);
}

function readPositiveInteger(value: string | undefined, fallback: number) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : fallback;
}

function toLimitedNullableString(value: string | null, maxLength: number) {
  return value ? toLimitedString(value, maxLength) : null;
}

function toLimitedString(value: string, maxLength: number) {
  const trimmedValue = value.trim();

  if (trimmedValue.length <= maxLength) {
    return trimmedValue;
  }

  return `${trimmedValue.slice(0, maxLength)}...`;
}
