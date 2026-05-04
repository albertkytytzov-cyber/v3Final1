import type {
  AssignedBlockExercise,
  AssignedPlanBlock,
  AssignedPlanSummary,
  AuthUser,
  CoachAthleteSummary,
  CompetitionPlanSummary,
  CompetitionResultPayload,
  CompetitionSummary,
  ExecutionExerciseResult,
  ExecutionResult,
  ExecutionResultInput,
  ReadinessEntry,
  ReadinessSubmissionPayload,
} from "@training-platform/shared";

export type {
  AssignedBlockExercise,
  AssignedPlanBlock,
  AssignedPlanSummary,
  AuthResponse,
  AuthUser,
  CoachAthleteSummary,
  CompetitionPlanSummary,
  CompetitionResultPayload,
  CompetitionSummary,
  ExecutionExerciseResult,
  ExecutionResult,
  ExecutionResultInput,
  ReadinessEntry,
  ReadinessSubmissionPayload,
} from "@training-platform/shared";

export type MobileScreen =
  | "dashboard"
  | "athletes"
  | "plans"
  | "calendar"
  | "results"
  | "readiness";

export interface MobileSessionState {
  apiBaseUrl: string;
  sessionToken: string | null;
  user: AuthUser | null;
}

export interface MobileDataSnapshot {
  savedAt: string | null;
  athletes: CoachAthleteSummary[];
  assignedPlans: AssignedPlanSummary[];
  competitions: CompetitionSummary[];
  competitionPlans: CompetitionPlanSummary[];
  readinessEntry: ReadinessEntry | null;
  executionResults: ExecutionResult[];
}

export type SyncActionKind =
  | "readiness"
  | "execution"
  | "competition-result";

export interface PendingSyncAction {
  id: string;
  kind: SyncActionKind;
  label: string;
  endpoint: string;
  method: "POST" | "PATCH";
  body:
    | ReadinessSubmissionPayload
    | ExecutionResultInput
    | CompetitionResultPayload;
  idempotencyKey: string;
  ownerUserId: string | null;
  createdAt: string;
  attempts: number;
  lastError: string | null;
}

export interface MobileAppState {
  session: MobileSessionState;
  data: MobileDataSnapshot;
  queue: PendingSyncAction[];
  selectedScreen: MobileScreen;
  selectedAthleteId: string | null;
  isOnline: boolean;
  isBusy: boolean;
  isSyncing: boolean;
  message: string | null;
  error: string | null;
}

export function createEmptySnapshot(): MobileDataSnapshot {
  return {
    savedAt: null,
    athletes: [],
    assignedPlans: [],
    competitions: [],
    competitionPlans: [],
    readinessEntry: null,
    executionResults: [],
  };
}
