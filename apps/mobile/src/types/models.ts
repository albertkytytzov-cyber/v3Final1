import type {
  AssignedBlockExercise,
  AssignedPlanBlock,
  AssignedPlanSummary,
  AuthUser,
  CoachAiReviewDiagnosticResponse,
  CoachAiReviewStatus,
  CoachAiReviewStatusResponse,
  CoachDiaryEntry,
  CoachDiaryEntryPayload,
  CoachDayAiPayload,
  CoachDayAiReview,
  CoachDayAiReviewHistoryResponse,
  CoachDayAiReviewRequest,
  CoachDayAiReviewResponse,
  CoachAthleteSummary,
  CompetitionPlanSummary,
  CompetitionResultPayload,
  CompetitionSummary,
  DeviceHealthDailySummary,
  DeviceHealthDailySummariesResponse,
  DeviceHealthDailySummaryPayload,
  DeviceHealthDailySummaryResponse,
  DeviceHealthHeartRateSummary,
  DeviceHealthOxygenSaturationSummary,
  DeviceHealthSleepSummary,
  DeviceHealthWorkoutSummary,
  DeviceWorkout,
  DeviceWorkoutLink,
  DeviceWorkoutLinkPayload,
  DeviceWorkoutLinkResponse,
  DeviceWorkoutPayload,
  DeviceWorkoutSamplePayload,
  DeviceWorkoutsResponse,
  DeviceWorkoutsSyncPayload,
  ExecutionExerciseResult,
  ExecutionResult,
  ExecutionResultInput,
  ReadinessEntry,
  ReadinessSubmissionPayload,
  UserRole,
} from "@training-platform/shared";
import type {
  DirectWatchClassicProbe,
  DirectWatchDevice,
  DirectWatchInspection,
  DirectWatchSessionPacket,
  DirectWatchSessionStatus,
} from "../integrations/direct-watch.js";

export type {
  AssignedBlockExercise,
  AssignedPlanBlock,
  AssignedPlanSummary,
  AuthResponse,
  AuthUser,
  CoachAiReviewDiagnosticResponse,
  CoachAiReviewStatus,
  CoachAiReviewStatusResponse,
  CoachDiaryEntry,
  CoachDiaryEntryPayload,
  CoachDayAiPayload,
  CoachDayAiReview,
  CoachDayAiReviewHistoryResponse,
  CoachDayAiReviewRequest,
  CoachDayAiReviewResponse,
  CoachAthleteSummary,
  CompetitionPlanSummary,
  CompetitionResultPayload,
  CompetitionSummary,
  DeviceHealthDailySummary,
  DeviceHealthDailySummariesResponse,
  DeviceHealthDailySummaryPayload,
  DeviceHealthDailySummaryResponse,
  DeviceHealthHeartRateSummary,
  DeviceHealthOxygenSaturationSummary,
  DeviceHealthSleepSummary,
  DeviceHealthWorkoutSummary,
  DeviceWorkout,
  DeviceWorkoutLink,
  DeviceWorkoutLinkPayload,
  DeviceWorkoutLinkResponse,
  DeviceWorkoutPayload,
  DeviceWorkoutSamplePayload,
  DeviceWorkoutsResponse,
  DeviceWorkoutsSyncPayload,
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
  coachAiReviews: CoachDayAiReview[];
  deviceHealthSummaries: DeviceHealthDailySummary[];
  deviceWorkoutLinks: DeviceWorkoutLink[];
  deviceWorkouts: DeviceWorkout[];
  readinessEntry: ReadinessEntry | null;
  readinessHistory: ReadinessEntry[];
  executionResults: ExecutionResult[];
}

export type SyncActionKind =
  | "readiness"
  | "execution"
  | "device-health"
  | "device-workouts"
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
    | DeviceHealthDailySummaryPayload
    | DeviceWorkoutsSyncPayload
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
  coachAiDiagnostic: CoachAiReviewDiagnosticResponse | null;
  coachAiStatus: CoachAiReviewStatus | null;
  directWatchDiagnostic: {
    classicProbe: DirectWatchClassicProbe | null;
    devices: DirectWatchDevice[];
    inspectedDeviceId: string | null;
    inspection: DirectWatchInspection | null;
    packets: DirectWatchSessionPacket[];
    scannedAt: string | null;
    session: DirectWatchSessionStatus | null;
  };
  aiReviewByDay: Record<string, CoachDayAiReview>;
  selectedScreen: MobileScreen;
  selectedAthleteId: string | null;
  selectedDayDate: string;
  executionDateFilter: string | null;
  executionEditDate: string | null;
  planDateFilter: string | null;
  readinessEditMode: boolean;
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
    coachAiReviews: [],
    coachDiaryEntries: [],
    competitions: [],
    competitionPlans: [],
    deviceHealthSummaries: [],
    deviceWorkoutLinks: [],
    deviceWorkouts: [],
    readinessEntry: null,
    readinessHistory: [],
    executionResults: [],
  };
}
