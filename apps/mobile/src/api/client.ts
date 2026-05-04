import type {
  AssignedPlanSummary,
  AuthResponse,
  CoachAthleteSummary,
  CompetitionPlanSummary,
  CompetitionResultPayload,
  CompetitionSummary,
  ExecutionResult,
  ExecutionResultInput,
  ReadinessEntry,
  ReadinessSubmissionPayload,
} from "../types/models.js";

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

  async loadAppData(userRole: string) {
    const [
      assignedPlans,
      competitions,
      competitionPlans,
      athletes,
      readiness,
      readinessHistory,
      execution,
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

    return {
      assignedPlans: assignedPlans.assignedPlans,
      athletes: athletes.athletes,
      competitionPlans: competitionPlans.competitionPlans,
      competitions: competitions.competitions,
      executionResults: execution.results,
      readinessEntry: readiness.entry,
      readinessHistory: readinessHistory.entries,
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

  submitCompetitionResult(payload: CompetitionResultPayload, idempotencyKey: string) {
    return this.request<{ result: unknown }>("/competition-results", {
      body: JSON.stringify(payload),
      idempotencyKey,
      method: "POST",
    });
  }
}

async function readErrorMessage(response: Response) {
  const rawMessage = await response.text();

  if (!rawMessage) {
    return `Ошибка API ${response.status}`;
  }

  try {
    const body = JSON.parse(rawMessage) as { message?: unknown };
    return typeof body.message === "string" && body.message
      ? body.message
      : rawMessage;
  } catch {
    return rawMessage;
  }
}
