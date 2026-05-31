import type {
  AssignedPlanSummary,
  AuthResponse,
  CoachAiReviewDiagnosticResponse,
  CoachAiReviewStatusResponse,
  CoachDiaryEntry,
  CoachDiaryEntryPayload,
  CoachDayAiPayload,
  CoachDayAiReviewHistoryResponse,
  CoachDayAiReviewResponse,
  CoachAthleteSummary,
  CompetitionPlanSummary,
  CompetitionResultPayload,
  CompetitionSummary,
  DeviceHealthDailySummariesResponse,
  DeviceHealthDailySummaryPayload,
  DeviceHealthDailySummaryResponse,
  DeviceHealthSampleMetric,
  DeviceHealthSamplesResponse,
  DeviceWorkout,
  DeviceWorkoutLink,
  DeviceWorkoutLinkPayload,
  DeviceWorkoutLinkResponse,
  DeviceWorkoutsResponse,
  DeviceWorkoutsSyncPayload,
  ExecutionResult,
  ExecutionResultInput,
  ReadinessEntry,
  ReadinessSubmissionPayload,
} from "../types/models.js";
import { translateApiErrorMessage } from "../permissions.js";

const DEVICE_HEALTH_SAMPLE_METRICS: DeviceHealthSampleMetric[] = ["heart_rate", "oxygen_saturation", "stress"];

export class MobileApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number | null,
  ) {
    super(message);
    this.name = "MobileApiError";
  }
}

export class MobileApiClient {
  constructor(
    private readonly apiBaseUrl: string,
    private readonly sessionToken: string | null,
  ) {}

  get isConfigured() {
    return Boolean(this.apiBaseUrl);
  }

  async request<T>(
    path: string,
    options: RequestInit & { idempotencyKey?: string } = {},
  ): Promise<T> {
    if (!this.apiBaseUrl) {
      throw new MobileApiError("Укажите адрес API сервера", null);
    }

    const headers = new Headers(options.headers ?? {});
    headers.set("X-Perform-Mobile", "1");

    if (this.sessionToken && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${this.sessionToken}`);
    }

    if (options.idempotencyKey) {
      headers.set("Idempotency-Key", options.idempotencyKey);
    }

    if (options.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    let response: Response;

    try {
      response = await fetch(`${this.apiBaseUrl}${path}`, {
        ...options,
        credentials: "include",
        headers,
      });
    } catch (error) {
      throw new MobileApiError(
        error instanceof Error ? error.message : "Нет соединения с сервером",
        null,
      );
    }

    if (!response.ok) {
      throw new MobileApiError(await readErrorMessage(response), response.status);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  login(email: string, password: string) {
    return this.request<AuthResponse>("/auth/login", {
      body: JSON.stringify({ email, password }),
      method: "POST",
    });
  }

  me() {
    return this.request<AuthResponse>("/auth/me");
  }

  logout() {
    return this.request<{ ok: boolean }>("/auth/logout", {
      method: "POST",
    });
  }

  async loadAppData(
    userRole: string,
    selectedEntryDate?: string,
    selectedCoachAthleteId?: string | null,
  ) {
    const [
      assignedPlans,
      competitions,
      competitionPlans,
      athletes,
      coachAiReviews,
      coachDiary,
      deviceHealth,
      deviceHealthSamples,
      deviceWorkouts,
      readiness,
      readinessHistory,
      athleteExecution,
    ] = await Promise.all([
      this.request<{ assignedPlans: AssignedPlanSummary[] }>("/plans/assigned"),
      this.request<{ competitions: CompetitionSummary[] }>("/competitions")
        .catch(() => ({ competitions: [] })),
      this.request<{ competitionPlans: CompetitionPlanSummary[] }>("/competition-plans")
        .catch(() => ({ competitionPlans: [] })),
      userRole === "coach" || userRole === "admin"
        ? this.request<{ athletes: CoachAthleteSummary[] }>("/coach/athletes")
            .catch(() => ({ athletes: [] }))
        : Promise.resolve({ athletes: [] }),
      userRole === "coach" || userRole === "admin"
        ? this.request<CoachDayAiReviewHistoryResponse>("/coach/ai-day-reviews")
            .catch(() => ({ reviews: [] }))
        : Promise.resolve({ reviews: [] }),
      userRole === "coach" || userRole === "admin"
        ? this.request<{ entries: CoachDiaryEntry[] }>("/coach/diary")
            .catch(() => ({ entries: [] }))
        : userRole === "athlete"
          ? this.request<{ entries: CoachDiaryEntry[] }>("/diary")
              .catch(() => ({ entries: [] }))
          : Promise.resolve({ entries: [] }),
      userRole === "athlete"
        ? this.request<DeviceHealthDailySummariesResponse>("/device-health/daily-summaries")
            .catch(() => ({ summaries: [] }))
        : Promise.resolve({ summaries: [] }),
      userRole === "athlete"
        ? this.loadDeviceHealthSamples(selectedEntryDate ?? localDateValue())
        : Promise.resolve({ samples: [] }),
      userRole === "athlete"
        ? this.loadAthleteDeviceWorkouts(selectedEntryDate ?? localDateValue())
        : Promise.resolve({ links: [], workouts: [] }),
      userRole === "athlete"
        ? this.request<{ entry: ReadinessEntry | null }>("/readiness/today")
            .catch(() => ({ entry: null }))
        : Promise.resolve({ entry: null }),
      userRole === "athlete"
        ? this.request<{ entries: ReadinessEntry[] }>("/readiness/recent")
            .catch(() => ({ entries: [] }))
        : Promise.resolve({ entries: [] }),
      userRole === "athlete"
        ? this.request<{ results: ExecutionResult[] }>("/execution")
            .catch(() => ({ results: [] }))
        : Promise.resolve({ results: [] }),
    ]);
    const executionResults =
      userRole === "coach" || userRole === "admin"
        ? await this.loadCoachExecutionResults(
            assignedPlans.assignedPlans,
            athletes.athletes,
            selectedEntryDate,
            selectedCoachAthleteId,
          )
        : athleteExecution.results;
    const coachReadinessHistory =
      userRole === "coach" || userRole === "admin"
        ? await this.loadCoachReadinessEntries(
            assignedPlans.assignedPlans,
            athletes.athletes,
            selectedEntryDate,
            selectedCoachAthleteId,
          )
        : readinessHistory.entries;
    const deviceHealthSummaries =
      userRole === "coach" || userRole === "admin"
        ? await this.loadCoachDeviceHealthSummaries(
            assignedPlans.assignedPlans,
            athletes.athletes,
            selectedEntryDate,
            selectedCoachAthleteId,
          )
        : deviceHealth.summaries;
    const deviceWorkoutData =
      userRole === "coach" || userRole === "admin"
        ? await this.loadCoachDeviceWorkouts(
            assignedPlans.assignedPlans,
            athletes.athletes,
            selectedEntryDate,
            selectedCoachAthleteId,
          )
        : deviceWorkouts;

    return {
      assignedPlans: assignedPlans.assignedPlans,
      athletes: athletes.athletes,
      coachAiReviews: coachAiReviews.reviews,
      coachDiaryEntries: coachDiary.entries,
      competitionPlans: competitionPlans.competitionPlans,
      competitions: competitions.competitions,
      deviceHealthSummaries,
      deviceHealthSamples: userRole === "coach" || userRole === "admin"
        ? []
        : deviceHealthSamples.samples,
      deviceWorkoutLinks: deviceWorkoutData.links ?? [],
      deviceWorkouts: deviceWorkoutData.workouts,
      executionResults,
      readinessEntry: readiness.entry,
      readinessHistory: coachReadinessHistory,
    };
  }

  private async loadCoachExecutionResults(
    assignedPlans: AssignedPlanSummary[],
    athletes: CoachAthleteSummary[],
    selectedEntryDate?: string,
    selectedCoachAthleteId?: string | null,
  ) {
    const athleteIds = resolveCoachDataAthleteIds(assignedPlans, athletes, selectedCoachAthleteId);
    const responses = await Promise.all(
      athleteIds.map((athleteId) =>
        this.request<{ results: ExecutionResult[] }>(
          withEntryDate(
            `/coach/athletes/${encodeURIComponent(athleteId)}/execution`,
            selectedEntryDate,
          ),
        ).catch(() => ({ results: [] })),
      ),
    );

    return responses.flatMap((response) => response.results);
  }

  private async loadCoachReadinessEntries(
    assignedPlans: AssignedPlanSummary[],
    athletes: CoachAthleteSummary[],
    selectedEntryDate?: string,
    selectedCoachAthleteId?: string | null,
  ) {
    const athleteIds = resolveCoachDataAthleteIds(assignedPlans, athletes, selectedCoachAthleteId);
    const recentResponses = await Promise.all(
      athleteIds.map((athleteId) =>
        this.request<{ entries: ReadinessEntry[] }>(
          `/coach/athletes/${encodeURIComponent(athleteId)}/readiness`,
        ).catch(() => ({ entries: [] })),
      ),
    );
    const selectedDayResponses = selectedEntryDate
      ? await Promise.all(
          athleteIds.map((athleteId) =>
            this.request<{ entries: ReadinessEntry[] }>(
              withEntryDate(
                `/coach/athletes/${encodeURIComponent(athleteId)}/readiness`,
                selectedEntryDate,
              ),
            ).catch(() => ({ entries: [] })),
          ),
        )
      : [];
    const entriesByDay = new Map<string, ReadinessEntry>();

    [...recentResponses, ...selectedDayResponses]
      .flatMap((response) => response.entries)
      .forEach((entry) => {
        entriesByDay.set(`${entry.athleteId}:${entry.entryDate}`, entry);
      });

    return Array.from(entriesByDay.values());
  }

  private async loadCoachDeviceHealthSummaries(
    assignedPlans: AssignedPlanSummary[],
    athletes: CoachAthleteSummary[],
    selectedEntryDate?: string,
    selectedCoachAthleteId?: string | null,
  ) {
    const athleteIds = resolveCoachDataAthleteIds(assignedPlans, athletes, selectedCoachAthleteId);
    const responses = await Promise.all(
      athleteIds.map((athleteId) =>
        this.request<DeviceHealthDailySummariesResponse>(
          withEntryDate(
            `/coach/athletes/${encodeURIComponent(athleteId)}/device-health`,
            selectedEntryDate,
          ),
        ).catch(() => ({ summaries: [] })),
      ),
    );

    return responses.flatMap((response) => response.summaries);
  }

  private async loadCoachDeviceHealthSamples(
    assignedPlans: AssignedPlanSummary[],
    athletes: CoachAthleteSummary[],
    selectedEntryDate?: string,
    selectedCoachAthleteId?: string | null,
  ) {
    if (!selectedEntryDate) {
      return [];
    }

    const athleteIds = resolveCoachDataAthleteIds(assignedPlans, athletes, selectedCoachAthleteId);
    const responses = await Promise.all(
      athleteIds.map((athleteId) =>
        this.request<DeviceHealthSamplesResponse>(
          `/coach/athletes/${encodeURIComponent(athleteId)}/device-health/samples?entryDate=${encodeURIComponent(selectedEntryDate)}&metric=heart_rate`,
        ).catch(() => ({ samples: [] })),
      ),
    );

    return responses.flatMap((response) => response.samples);
  }

  private async loadAthleteDeviceWorkouts(selectedEntryDate: string): Promise<DeviceWorkoutsResponse> {
    const dayPath =
      `/device-health/workouts?entryDate=${encodeURIComponent(selectedEntryDate)}&includeSamples=false`;
    const [recentResponse, dayResponse] = await Promise.all([
      this.request<DeviceWorkoutsResponse>("/device-health/workouts?includeSamples=false")
        .catch(() => ({ links: [], workouts: [] })),
      this.request<DeviceWorkoutsResponse>(dayPath)
        .catch(() => ({ links: [], workouts: [] })),
    ]);

    const linksById = new Map<string, DeviceWorkoutLink>();
    const workoutsById = new Map<string, DeviceWorkout>();
    recentResponse.workouts.forEach((workout) => {
      workoutsById.set(workout.id, workout);
    });
    dayResponse.workouts.forEach((workout) => {
      workoutsById.set(workout.id, workout);
    });
    (recentResponse.links ?? []).forEach((link) => {
      linksById.set(link.id, link);
    });
    (dayResponse.links ?? []).forEach((link) => {
      linksById.set(link.id, link);
    });

    return {
      links: Array.from(linksById.values()),
      workouts: Array.from(workoutsById.values()),
    };
  }

  private async loadCoachDeviceWorkouts(
    assignedPlans: AssignedPlanSummary[],
    athletes: CoachAthleteSummary[],
    selectedEntryDate?: string,
    selectedCoachAthleteId?: string | null,
  ) {
    const athleteIds = resolveCoachDataAthleteIds(assignedPlans, athletes, selectedCoachAthleteId);
    const responses = await Promise.all(
      athleteIds.map((athleteId) => {
        const basePath = `/coach/athletes/${encodeURIComponent(athleteId)}/device-workouts?includeSamples=false`;
        return this.request<DeviceWorkoutsResponse>(withEntryDate(basePath, selectedEntryDate))
          .catch(() => ({ links: [], workouts: [] }));
      }),
    );

    const linksById = new Map<string, DeviceWorkoutLink>();
    const workoutsById = new Map<string, DeviceWorkout>();

    responses.forEach((response) => {
      response.workouts.forEach((workout) => {
        workoutsById.set(workout.id, workout);
      });
      (response.links ?? []).forEach((link) => {
        linksById.set(link.id, link);
      });
    });

    return {
      links: Array.from(linksById.values()),
      workouts: Array.from(workoutsById.values()),
    };
  }

  submitReadiness(payload: ReadinessSubmissionPayload, idempotencyKey: string) {
    return this.request<{ entry: ReadinessEntry }>("/readiness", {
      body: JSON.stringify(payload),
      idempotencyKey,
      method: "POST",
    });
  }

  submitExecution(payload: ExecutionResultInput, idempotencyKey: string) {
    return this.request<{ result: ExecutionResult }>("/execution", {
      body: JSON.stringify(payload),
      idempotencyKey,
      method: "POST",
    });
  }

  submitDeviceHealthSummary(payload: DeviceHealthDailySummaryPayload, idempotencyKey: string) {
    return this.request<DeviceHealthDailySummaryResponse>("/device-health/daily-summaries", {
      body: JSON.stringify(payload),
      idempotencyKey,
      method: "POST",
    });
  }

  private async loadDeviceHealthSamples(entryDate: string) {
    const responses = await Promise.all(
      DEVICE_HEALTH_SAMPLE_METRICS.map((metric) =>
        this.request<DeviceHealthSamplesResponse>(
          withEntryDate(`/device-health/samples?metric=${encodeURIComponent(metric)}`, entryDate),
        ).catch(() => ({ samples: [] })),
      ),
    );

    return {
      samples: responses.flatMap((response) => response.samples),
    };
  }

  listDeviceHealthSamples(entryDate: string, metric: DeviceHealthSampleMetric = "heart_rate") {
    return this.request<DeviceHealthSamplesResponse>(
      `/device-health/samples?entryDate=${encodeURIComponent(entryDate)}&metric=${encodeURIComponent(metric)}`,
    );
  }

  listDeviceWorkouts(entryDate: string, includeSamples = true) {
    return this.request<DeviceWorkoutsResponse>(
      `/device-health/workouts?entryDate=${encodeURIComponent(entryDate)}&includeSamples=${includeSamples ? "true" : "false"}`,
    );
  }

  listCoachDeviceWorkouts(athleteId: string, entryDate: string, includeSamples = true) {
    return this.request<DeviceWorkoutsResponse>(
      `/coach/athletes/${encodeURIComponent(athleteId)}/device-workouts?entryDate=${encodeURIComponent(entryDate)}&includeSamples=${includeSamples ? "true" : "false"}`,
    );
  }

  submitDeviceWorkouts(payload: DeviceWorkoutsSyncPayload, idempotencyKey: string) {
    return this.request<DeviceWorkoutsResponse>("/device-health/workouts", {
      body: JSON.stringify(payload),
      idempotencyKey,
      method: "POST",
    });
  }

  linkDeviceWorkout(
    athleteId: string,
    payload: DeviceWorkoutLinkPayload,
  ) {
    return this.request<DeviceWorkoutLinkResponse>(
      `/coach/athletes/${encodeURIComponent(athleteId)}/device-workout-links`,
      {
        body: JSON.stringify(payload),
        method: "POST",
      },
    );
  }

  linkOwnDeviceWorkout(payload: DeviceWorkoutLinkPayload) {
    return this.request<DeviceWorkoutLinkResponse>(
      "/device-health/workout-links",
      {
        body: JSON.stringify(payload),
        method: "POST",
      },
    );
  }

  unlinkDeviceWorkout(athleteId: string, linkId: string) {
    return this.request<{ ok: boolean }>(
      `/coach/athletes/${encodeURIComponent(athleteId)}/device-workout-links/${encodeURIComponent(linkId)}`,
      { method: "DELETE" },
    );
  }

  unlinkOwnDeviceWorkout(linkId: string) {
    return this.request<{ ok: boolean }>(
      `/device-health/workout-links/${encodeURIComponent(linkId)}`,
      { method: "DELETE" },
    );
  }

  submitCompetitionResult(payload: CompetitionResultPayload, idempotencyKey: string) {
    return this.request<{ result: unknown }>("/competition-results", {
      body: JSON.stringify(payload),
      idempotencyKey,
      method: "POST",
    });
  }

  submitCoachDiary(payload: CoachDiaryEntryPayload, idempotencyKey: string) {
    return this.request<{ entry: CoachDiaryEntry }>("/coach/diary", {
      body: JSON.stringify(payload),
      idempotencyKey,
      method: "POST",
    });
  }

  getCoachAiReviewStatus() {
    return this.request<CoachAiReviewStatusResponse>("/coach/ai-day-review/status");
  }

  testCoachAiReview() {
    return this.request<CoachAiReviewDiagnosticResponse>("/coach/ai-day-review/test", {
      method: "POST",
    });
  }

  generateCoachDayAiReview(
    athleteId: string,
    entryDate: string,
    dayPayload: CoachDayAiPayload,
  ) {
    return this.request<CoachDayAiReviewResponse>(
      `/coach/athletes/${encodeURIComponent(athleteId)}/ai-day-review`,
      {
        body: JSON.stringify({ dayPayload, entryDate }),
        method: "POST",
      },
    );
  }
}

function resolveCoachDataAthleteIds(
  assignedPlans: AssignedPlanSummary[],
  athletes: CoachAthleteSummary[],
  selectedCoachAthleteId?: string | null,
) {
  const athleteIds = Array.from(new Set([
    ...assignedPlans.map((plan) => plan.athleteId),
    ...athletes.map((athlete) => athlete.athleteId),
  ].filter(Boolean)));

  return selectedCoachAthleteId && athleteIds.includes(selectedCoachAthleteId)
    ? [selectedCoachAthleteId]
    : athleteIds;
}

function withEntryDate(path: string, entryDate?: string) {
  if (!entryDate) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}entryDate=${encodeURIComponent(entryDate)}`;
}

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function readErrorMessage(response: Response) {
  const rawMessage = await response.text();

  if (!rawMessage) {
    return `Ошибка API ${response.status}`;
  }

  try {
    const body = JSON.parse(rawMessage) as { message?: unknown };
    const message = typeof body.message === "string" && body.message
      ? body.message
      : rawMessage;
    return translateApiErrorMessage(message);
  } catch {
    return translateApiErrorMessage(rawMessage);
  }
}
