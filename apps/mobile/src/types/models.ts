import type {
  AssignedBlockExercise,
  AssignedPlanBlock,
  AssignedPlanSummary,
  AuthUser,
  CoachDiaryEntry,
  CoachDiaryEntryPayload,
  CoachAthleteSummary,
  CompetitionPlanSummary,
  CompetitionResultPayload,
  CompetitionSummary,
  ExecutionExerciseResult,
  ExecutionResult,
  ExecutionResultInput,
  ReadinessEntry,
  ReadinessSubmissionPayload,
  UserRole,
} from "@training-platform/shared";

export type {
  AssignedBlockExercise,
  AssignedPlanBlock,
  AssignedPlanSummary,
  AuthResponse,
  AuthUser,
  CoachDiaryEntry,
  CoachDiaryEntryPayload,
  CoachAthleteSummary,
  CompetitionPlanSummary,
  CompetitionResultPayload,
  CompetitionSummary,
  ExecutionExerciseResult,
  ExecutionResult,
  ExecutionResultInput,
  ReadinessEntry,
  ReadinessSubmissionPayload,
  UserRole,
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
  coachDiaryEntries: CoachDiaryEntry[];
  readinessEntry: ReadinessEntry | null;
  readinessHistory: ReadinessEntry[];
  executionResults: ExecutionResult[];
}

export type SyncActionKind =
  | "readiness"
  | "execution"
  | "competition-result"
  | "coach-diary";

export interface PendingSyncAction {
  id: string;
  kind: SyncActionKind;
  label: string;
  endpoint: string;
  method: "POST" | "PATCH";
  body:
    | ReadinessSubmissionPayload
    | ExecutionResultInput
    | CompetitionResultPayload
    | CoachDiaryEntryPayload;
  idempotencyKey: string;
  ownerUserId: string | null;
  ownerUserRole?: UserRole | null;
  createdAt: string;
  attempts: number;
  lastError: string | null;
  status?: "pending" | "invalid";
}

export interface MobileAppState {
  session: MobileSessionState;
  data: MobileDataSnapshot;
  queue: PendingSyncAction[];
  selectedScreen: MobileScreen;
  selectedAthleteId: string | null;
  selectedDayDate: string;
  executionDateFilter: string | null;
  planDateFilter: string | null;
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
    coachDiaryEntries: [],
    competitions: [],
    competitionPlans: [],
    readinessEntry: null,
    readinessHistory: [],
    executionResults: [],
  };
}
