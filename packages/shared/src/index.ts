export const PLATFORM_NAME = "PERFORM";

export type UserRole = "coach" | "athlete" | "admin";
export type ReadinessStatus = "green" | "yellow" | "red";
export type CompetitionLevel =
  | "local"
  | "national"
  | "continental"
  | "world"
  | "olympics";
export type CompetitionPriority = "A" | "B" | "C";
export type CompetitionPlanType = "main" | "secondary" | "qualifying" | "control";
export type SeasonStrategyType = "single_peak" | "double_peak" | "multi_peak";
export type MesocycleProgressionType = "linear" | "wave" | "taper" | "recovery";
export type MesocycleWeekType =
  | "build"
  | "impact"
  | "shock"
  | "recovery"
  | "taper"
  | "competition";
export type PreparationPhase =
  | "base"
  | "strength"
  | "specific"
  | "taper"
  | "competition"
  | "recovery";

export interface RoleDescriptor {
  id: UserRole;
  name: string;
  summary: string;
}

export interface ModuleDescriptor {
  id: string;
  name: string;
  summary: string;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  athleteId: string | null;
  photoUrl?: string;
  birthDate?: string | null;
  heightCm?: number | null;
  sport?: string;
  discipline?: string;
  weightClass?: string;
  dominantSide?: string;
  baselineRestingHr?: number | null;
  baselineWeightKg?: number | null;
  profileNotes?: string;
}

export interface AuthResponse {
  user: AuthUser;
  sessionToken?: string;
}

export interface ReadinessFormValues {
  sleepHours: number;
  sleepQuality: number;
  generalFeeling: number;
  fatigueLevel: number;
  muscleSoreness: number;
  motivationLevel: number;
  restingHr: number;
  bodyWeight: number;
  painLevel: number;
  illnessFlag: boolean;
  feverFlag: boolean;
}

export interface ReadinessSubmissionPayload extends ReadinessFormValues {
  entryDate?: string | null;
}

export interface ReadinessReason {
  code: string;
  label: string;
  impact: number;
}

export interface ReadinessEntry extends ReadinessFormValues {
  id: string;
  athleteId: string;
  entryDate: string;
  createdAt: string;
  score: number;
  status: ReadinessStatus;
  explanation: ReadinessReason[];
}

export interface ReadinessResponse {
  entry: ReadinessEntry;
}

export interface CoachAthleteSummary {
  athleteId: string;
  userId: string;
  fullName: string;
  email: string;
  photoUrl: string;
  birthDate: string | null;
  heightCm: number | null;
  sport: string;
  discipline: string;
  weightClass: string;
  dominantSide: string;
  baselineRestingHr: number | null;
  baselineWeightKg: number | null;
  currentWeightKg: number | null;
  currentWeightDate: string | null;
  wrestlingExperienceYears: number | null;
  strengthSquatKg: number | null;
  strengthBenchPressKg: number | null;
  strengthDeadliftKg: number | null;
  strengthPullUpsMax: number | null;
  strengthGripLeftKg: number | null;
  strengthGripRightKg: number | null;
  strengthNotes: string;
  strengths: string;
  weaknesses: string;
  injuriesOrRestrictions: string;
  preparationGoal: string;
  profileNotes: string;
  updatedAt: string | null;
  latestReadiness: {
    entryDate: string;
    score: number;
    status: ReadinessStatus;
  } | null;
}

export interface CoachAthleteProfilePayload {
  photoUrl: string;
  birthDate: string | null;
  heightCm: number | null;
  sport: string;
  discipline: string;
  weightClass: string;
  dominantSide: string;
  baselineRestingHr: number | null;
  baselineWeightKg: number | null;
  wrestlingExperienceYears: number | null;
  strengthSquatKg: number | null;
  strengthBenchPressKg: number | null;
  strengthDeadliftKg: number | null;
  strengthPullUpsMax: number | null;
  strengthGripLeftKg: number | null;
  strengthGripRightKg: number | null;
  strengthNotes: string;
  strengths: string;
  weaknesses: string;
  injuriesOrRestrictions: string;
  preparationGoal: string;
  profileNotes: string;
}

export interface CoachDashboardResponse {
  athletes: CoachAthleteSummary[];
}

export interface CoachAvailableAthletesResponse {
  athletes: CoachAthleteSummary[];
}

export interface CoachAttachAthleteResponse {
  athlete: CoachAthleteSummary;
}

export interface PlanBlockInput {
  name: string;
  blockType:
    | "technical"
    | "speed"
    | "strength"
    | "CNS_high"
    | "metabolic"
    | "conditioning"
    | "recovery"
    | "mobility"
    | "activation";
  blockPriority: number;
  isMandatory: boolean;
  removePriorityYellow: number;
  removePriorityRed: number;
  reductionPercentYellow: number;
  reductionPercentRed: number;
  targetDurationMinutes: number | null;
  targetRpe: number | null;
  targetSets: number | null;
  targetReps: number | null;
  notes: string;
  replacementBlockId?: string | null;
  exercises?: PlanExerciseInput[];
}

export interface PlanExerciseInput {
  id?: string;
  name: string;
  targetSets: number | null;
  targetReps: number | null;
  targetWeightKg: number | null;
  targetDurationMinutes: number | null;
  targetRpe: number | null;
  notes: string;
  displayOrder?: number;
}

export type TrainingLoadExerciseInput = Pick<
  PlanExerciseInput,
  "targetDurationMinutes" | "targetRpe"
>;

export type TrainingLoadBlockInput = Pick<
  PlanBlockInput,
  "targetDurationMinutes" | "targetRpe"
> &
  Partial<
    Pick<
      PlanBlockInput,
      "blockType" | "blockPriority" | "targetSets" | "targetReps" | "exercises"
    >
  >;

const TRAINING_LOAD_BLOCK_PROFILES: Record<
  PlanBlockInput["blockType"],
  { durationMinutes: number; rpe: number }
> = {
  technical: { durationMinutes: 35, rpe: 5 },
  speed: { durationMinutes: 22, rpe: 7.5 },
  strength: { durationMinutes: 30, rpe: 7 },
  CNS_high: { durationMinutes: 24, rpe: 8 },
  metabolic: { durationMinutes: 26, rpe: 8.5 },
  conditioning: { durationMinutes: 32, rpe: 6.5 },
  recovery: { durationMinutes: 20, rpe: 2.5 },
  mobility: { durationMinutes: 18, rpe: 2.5 },
  activation: { durationMinutes: 14, rpe: 4 },
};

const DEFAULT_TRAINING_LOAD_PROFILE = { durationMinutes: 20, rpe: 5 };

function normalizeTrainingLoadNumber(
  value: number | null | undefined,
  maxValue: number,
) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  return value > 0 && value <= maxValue ? value : null;
}

function getTrainingLoadProfile(blockType: PlanBlockInput["blockType"] | null | undefined) {
  return blockType && TRAINING_LOAD_BLOCK_PROFILES[blockType]
    ? TRAINING_LOAD_BLOCK_PROFILES[blockType]
    : DEFAULT_TRAINING_LOAD_PROFILE;
}

function getTrainingLoadPriorityFactor(blockPriority: number | null | undefined) {
  const priority = Number.isFinite(blockPriority ?? NaN)
    ? Math.min(Math.max(Number(blockPriority), 1), 5)
    : 1;

  return 0.7 + priority * 0.1;
}

function estimateTrainingExerciseLoad(
  exercise: TrainingLoadExerciseInput,
  fallbackRpe: number,
) {
  const durationMinutes = normalizeTrainingLoadNumber(
    exercise.targetDurationMinutes,
    240,
  );
  const rpe = normalizeTrainingLoadNumber(exercise.targetRpe, 10);

  if (durationMinutes === null) {
    return null;
  }

  return durationMinutes * (rpe ?? fallbackRpe);
}

export function estimateTrainingBlockLoad(block: TrainingLoadBlockInput) {
  const profile = getTrainingLoadProfile(block.blockType);
  const priorityFactor = getTrainingLoadPriorityFactor(block.blockPriority);
  const fallbackDurationMinutes = profile.durationMinutes * priorityFactor;
  const fallbackRpe = profile.rpe * priorityFactor;
  const durationMinutes = normalizeTrainingLoadNumber(
    block.targetDurationMinutes,
    240,
  );
  const rpe = normalizeTrainingLoadNumber(block.targetRpe, 10);

  if (durationMinutes !== null && rpe !== null) {
    return Number((durationMinutes * rpe).toFixed(1));
  }

  const exerciseLoads = (block.exercises ?? [])
    .map((exercise) => estimateTrainingExerciseLoad(exercise, fallbackRpe))
    .filter((value): value is number => value !== null);

  if (exerciseLoads.length) {
    return Number(
      exerciseLoads.reduce((sum, value) => sum + value, 0).toFixed(1),
    );
  }

  if (durationMinutes !== null) {
    return Number((durationMinutes * (rpe ?? fallbackRpe)).toFixed(1));
  }

  if (rpe !== null) {
    return Number((fallbackDurationMinutes * rpe).toFixed(1));
  }

  return Number((fallbackDurationMinutes * profile.rpe).toFixed(1));
}

export function estimateTrainingBlocksLoad(blocks: TrainingLoadBlockInput[]) {
  return Number(
    blocks
      .reduce((sum, block) => sum + estimateTrainingBlockLoad(block), 0)
      .toFixed(1),
  );
}

export interface PlanSessionInput {
  id?: string;
  name: string;
  notes: string;
  orderIndex?: number;
  blocks: PlanBlockInput[];
}

export interface PlanDayInput {
  id?: string;
  label: string;
  notes: string;
  orderIndex?: number;
  sessions: PlanSessionInput[];
}

export interface PlanTemplateSummary {
  id: string;
  coachUserId: string;
  name: string;
  description: string;
  sportType: string;
  phaseFocus: PreparationPhase | null;
  competitionPriorityFocus: CompetitionPriority | null;
  templateGoal: string;
  microcycleType: string;
  competitionSpecific: boolean;
  estimatedLoad: number;
  createdAt: string;
  blockCount: number;
  blocks: PlanBlockInput[];
  days?: PlanDayInput[];
}

export interface PlanTemplatePayload {
  name: string;
  description: string;
  sportType: string;
  phaseFocus: PreparationPhase | null;
  competitionPriorityFocus: CompetitionPriority | null;
  templateGoal: string;
  microcycleType: string;
  competitionSpecific: boolean;
  blocks: PlanBlockInput[];
  days?: PlanDayInput[];
}

export interface PlanTemplatesResponse {
  templates: PlanTemplateSummary[];
}

export interface AssignedPlanBlock {
  id: string;
  templateBlockId?: string | null;
  name: string;
  blockType: PlanBlockInput["blockType"];
  blockPriority: number;
  isMandatory: boolean;
  removePriorityYellow: number;
  removePriorityRed: number;
  reductionPercentYellow: number;
  reductionPercentRed: number;
  targetDurationMinutes: number | null;
  targetRpe: number | null;
  targetSets: number | null;
  targetReps: number | null;
  notes: string;
  replacementBlockId?: string | null;
  exercises?: AssignedBlockExercise[];
}

export interface AssignedBlockExercise {
  id: string;
  sourceExerciseId: string | null;
  name: string;
  targetSets: number | null;
  targetReps: number | null;
  targetWeightKg: number | null;
  targetDurationMinutes: number | null;
  targetRpe: number | null;
  notes: string;
  orderIndex: number;
}

export interface AssignedPlanSession {
  id: string;
  name: string;
  orderIndex: number;
  blocks: AssignedPlanBlock[];
}

export interface AssignedPlanDay {
  id: string;
  label: string;
  dayDate: string;
  notes: string;
  sessions: AssignedPlanSession[];
}

export interface AssignedPlanSummary {
  id: string;
  athleteId: string;
  athleteName: string;
  templateId: string;
  templateName: string;
  startDate: string;
  plannedPhase: PreparationPhase | null;
  competitionContextSnapshot: CompetitionContext | null;
  status: "active" | "completed" | "archived";
  createdAt: string;
  day: AssignedPlanDay;
}

export interface AssignedPlanPayload {
  athleteId: string;
  templateId: string;
  startDate: string;
  dayLabel: string;
  notes: string;
  plannedPhase?: PreparationPhase | null;
}

export interface AssignedPlansResponse {
  assignedPlans: AssignedPlanSummary[];
}

export interface TemplatePackItem {
  templateId: string;
  dayOffset: number;
  dayLabel: string;
  microcycleType: string;
  templateDayIndex?: number;
}

export type PlannerWarningLevel = "info" | "warning" | "critical";

export interface PlannerWarning {
  code:
    | "high_load_density"
    | "low_recovery"
    | "taper_violated"
    | "weekly_load_jump"
    | "calendar_overlap"
    | "mesocycle_target_above"
    | "mesocycle_target_below"
    | "mesocycle_week_mismatch";
  level: PlannerWarningLevel;
  message: string;
}

export interface TemplatePackNearbyDay {
  assignedPlanId: string;
  date: string;
  templateName: string;
  plannedPhase: PreparationPhase | null;
  estimatedLoad: number;
}

export type PlannerSuggestionAction =
  | "swap_to_recovery"
  | "swap_to_activation"
  | "reduce_load"
  | "increase_load"
  | "move_day"
  | "avoid_overlap";

export type PlannerSuggestionFeedbackLabel =
  | "historically_effective"
  | "mixed"
  | "watch"
  | "new";

export type PlannerSuggestionFeedbackScope =
  | "exact_context"
  | "phase_context"
  | "athlete_history";

export interface PlannerSuggestionFeedback {
  label: PlannerSuggestionFeedbackLabel;
  scope: PlannerSuggestionFeedbackScope;
  netScore: number;
  sampleSize: number;
  appliedCount: number;
  skippedCount: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  phase: PreparationPhase | null;
  competitionPriority: CompetitionPriority | null;
}

export interface PlannerSuggestion {
  code:
    | "recover_day_swap"
    | "activation_swap"
    | "reduce_slot_load"
    | "increase_slot_load"
    | "move_specific_day"
    | "resolve_overlap";
  action: PlannerSuggestionAction;
  message: string;
  dayOffset: number | null;
  targetDayOffset: number | null;
  recommendedTemplateId: string | null;
  recommendedTemplateName: string | null;
  recommendedTemplateDayIndex?: number | null;
  feedback: PlannerSuggestionFeedback | null;
}

export type TemplatePackHistoryBiasEffect = "boost" | "caution";

export interface TemplatePackHistoryBias {
  code: PlannerSuggestion["code"];
  action: PlannerSuggestionAction;
  effect: TemplatePackHistoryBiasEffect;
  label: PlannerSuggestionFeedbackLabel;
  scope: PlannerSuggestionFeedbackScope;
  netScore: number;
  sampleSize: number;
}

export interface MesocycleWeekContext {
  mesocycleId: string;
  mesocycleName: string;
  phase: PreparationPhase;
  progressionType: MesocycleProgressionType;
  competitionPlanId: string | null;
  competitionTitle: string | null;
  weekIndex: number;
  weekLabel: string;
  startDate: string;
  endDate: string;
  focus: string;
  targetLoad: number;
  loadModifier: number;
  microcycleType: MesocycleWeekType;
}

export interface TemplatePackRecommendation {
  phase: PreparationPhase | null;
  competitionPriority: CompetitionPriority | null;
  mesocycleWeek: MesocycleWeekContext | null;
  suggestedDays: number;
  totalPlannedLoad: number;
  targetLoadDelta: number | null;
  varietyScore: number;
  loadBalanceLabel: string;
  nearbyAssignedDays: number;
  nearbyAssignedPlanSummaries: TemplatePackNearbyDay[];
  warnings: PlannerWarning[];
  suggestions: PlannerSuggestion[];
  items: Array<
    TemplatePackItem & {
      templateName: string;
      score: number;
      reason: string;
      estimatedLoad: number;
      historyBiases: TemplatePackHistoryBias[];
    }
  >;
}

export interface TemplatePackRecommendationResponse {
  athleteId: string;
  startDate: string;
  competitionContext: CompetitionContext | null;
  pack: TemplatePackRecommendation;
}

export interface AutoAssignMicrocyclePayload {
  athleteId: string;
  startDate: string;
  daysCount: number;
  notes: string;
  plannedPhase?: PreparationPhase | null;
  items: TemplatePackItem[];
}

export type AdaptationActionType = "kept" | "reduced" | "removed" | "replaced";

export interface AdaptedPlanBlock extends AssignedPlanBlock {
  action: AdaptationActionType;
  adaptationReason: string;
}

export interface AdaptedPlanSession {
  id: string;
  name: string;
  orderIndex: number;
  blocks: AdaptedPlanBlock[];
}

export interface AdaptedPlanDay {
  assignedPlanId: string;
  athleteId: string;
  readinessStatus: ReadinessStatus;
  readinessScore: number;
  dayLabel: string;
  dayDate: string;
  sessions: AdaptedPlanSession[];
  removedBlocks: string[];
  reducedBlocks: string[];
  replacedBlocks: string[];
  explanation: string[];
  competitionContext: CompetitionContext | null;
}

export interface ExecutionResultInput {
  assignedPlanId: string;
  assignedBlockId: string;
  completed: boolean;
  setsCompleted: number | null;
  repsCompleted: number | null;
  weightKg: number | null;
  durationMinutes: number | null;
  rpe: number | null;
  notes: string;
  exercises?: ExecutionExerciseResultInput[];
}

export interface ExecutionResult extends ExecutionResultInput {
  id: string;
  athleteId: string;
  plannedLoad?: number | null;
  actualLoad?: number | null;
  loadUpdatedAt?: string | null;
  completedAt: string | null;
  updatedAt: string;
  exerciseResults?: ExecutionExerciseResult[];
}

export interface ExecutionResultsResponse {
  results: ExecutionResult[];
}

export type CoachDiaryScope = "day" | "tasks";

export interface CoachDiaryEntryPayload {
  athleteId: string;
  assignedPlanId: string;
  entryDate: string;
  scope: CoachDiaryScope;
  notes: string;
  assignedBlockIds: string[];
  assignedExerciseIds: string[];
}

export interface CoachDiaryEntry extends CoachDiaryEntryPayload {
  id: string;
  coachUserId: string;
  coachName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CoachDiaryEntriesResponse {
  entries: CoachDiaryEntry[];
}

export type CoachDayAiExecutionStatus =
  | "completed"
  | "partial"
  | "missed"
  | "no-plan";

export interface CoachDayAiPayload {
  athlete: {
    displayName: string;
    discipline: string | null;
    sport: string | null;
    weightClass: string | null;
  };
  coachComment: string | null;
  date: string;
  execution: {
    blocks: {
      completed: number;
      missed: number;
      partial: number;
      total: number;
    };
    exercises: {
      completed: number;
      missed: number;
      partial: number;
      total: number;
    };
    status: CoachDayAiExecutionStatus;
    statusLabel: string;
  };
  load: {
    actual: number;
    delta: number;
    planned: number;
  };
  plan: {
    blocks: Array<{
      actualLoad: number;
      exercises: Array<{
        actual: string;
        name: string;
        plannedControl: string;
        plannedWork: string;
        status: Exclude<CoachDayAiExecutionStatus, "no-plan">;
      }>;
      name: string;
      plannedLoad: number;
      sessionName: string;
      status: Exclude<CoachDayAiExecutionStatus, "no-plan">;
    }>;
    count: number;
    templates: string[];
  };
  readiness: {
    flags: string;
    score: number;
    status: ReadinessStatus;
    statusLabel: string;
  } | null;
}

export type CoachDayAiReviewSource = "local-rules" | "model";

export interface CoachDayAiReview {
  athleteId: string;
  entryDate: string;
  generatedAt: string;
  source: CoachDayAiReviewSource;
  observation: string;
  riskNotes: string[];
  tomorrowActions: string[];
  dayPayload: CoachDayAiPayload;
  dayPayloadJson: string;
}

export interface ExecutionExerciseResultInput {
  assignedExerciseId: string;
  completed: boolean;
  setsCompleted: number | null;
  repsCompleted: number | null;
  weightKg: number | null;
  durationMinutes: number | null;
  rpe: number | null;
  notes: string;
}

export interface ExecutionExerciseResult extends ExecutionExerciseResultInput {
  id: string;
  executionResultId: string;
  athleteId: string;
  assignedPlanId: string;
  assignedBlockId: string;
  updatedAt: string;
}

export interface ExecutionMetricDelta {
  planned: number | null;
  actual: number | null;
  delta: number | null;
}

export interface ExecutionMetricDeltaSet {
  sets: ExecutionMetricDelta;
  reps: ExecutionMetricDelta;
  durationMinutes: ExecutionMetricDelta;
  rpe: ExecutionMetricDelta;
}

export type ExecutionReviewStatus =
  | "completed"
  | "partial"
  | "missed"
  | "not_started";

export interface ExecutionReviewBlock extends AssignedPlanBlock {
  executionStatus: ExecutionReviewStatus;
  planLabel: string;
  actualResult: ExecutionResult | null;
  exerciseSummary?: {
    plannedExercises: number;
    completedExercises: number;
    partialExercises: number;
    missedExercises: number;
  };
  deviations?: ExecutionMetricDeltaSet;
  exercises?: ExecutionReviewExercise[];
}

export interface ExecutionReviewExercise extends AssignedBlockExercise {
  executionStatus: ExecutionReviewStatus;
  actualResult: ExecutionExerciseResult | null;
  deviations: ExecutionMetricDeltaSet;
}

export type CoachExecutionReviewStatus =
  | "all_good"
  | "ready_for_review"
  | "needs_attention";

export interface ExecutionReviewSession {
  id: string;
  name: string;
  orderIndex: number;
  blocks: ExecutionReviewBlock[];
}

export interface ExecutionReviewPlan {
  assignedPlanId: string;
  athleteId: string;
  athleteName: string;
  templateName: string;
  dayLabel: string;
  dayDate: string;
  summary: {
    plannedBlocks: number;
    completedBlocks: number;
    partialBlocks: number;
    missedBlocks: number;
    plannedExercises: number;
    completedExercises: number;
    partialExercises: number;
    missedExercises: number;
    completionRate: number;
    averageRpe: number | null;
    totalDurationMinutes: number;
    reviewStatus: CoachExecutionReviewStatus;
  };
  sessions: ExecutionReviewSession[];
}

export interface ReadinessTrendPoint {
  date: string;
  score: number;
  status: ReadinessStatus;
}

export interface CompletionTrendPoint {
  date: string;
  plannedBlocks: number;
  completedBlocks: number;
  partialBlocks: number;
  missedBlocks: number;
  adherenceRate: number;
}

export interface LoadTrendPoint {
  date: string;
  plannedLoad: number;
  actualLoad: number;
  loadDelta: number;
  averageRpe: number | null;
  totalDurationMinutes: number;
}

export interface WeightTrendPoint {
  date: string;
  weightKg: number;
  deltaFromBaseline: number | null;
}

export type AnalyticsInsightLevel = "info" | "warning" | "critical";

export type AnalyticsInsightCode =
  | "fatigue_risk"
  | "adherence_risk"
  | "load_spike"
  | "underload_risk"
  | "taper_violation"
  | "planning_chain_gap"
  | "on_track";

export interface AnalyticsInsightEvidence {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "warning";
}

export interface AnalyticsInsight {
  code: AnalyticsInsightCode;
  level: AnalyticsInsightLevel;
  title: string;
  summary: string;
  recommendation: string;
  phase: PreparationPhase | null;
  competitionPriority: CompetitionPriority | null;
  daysToCompetition: number | null;
  evidence: AnalyticsInsightEvidence[];
}

export type AnalyticsPatternScope = "week" | "block";

export type AnalyticsPatternCode =
  | "readiness_volatility"
  | "recovery_gap"
  | "fatigue_block_density"
  | "specific_block_drift"
  | "strength_underdelivery";

export interface AnalyticsPattern {
  code: AnalyticsPatternCode;
  level: AnalyticsInsightLevel;
  scope: AnalyticsPatternScope;
  title: string;
  summary: string;
  weekLabel: string | null;
  blockType: PlanBlockInput["blockType"] | null;
  dayOffset: number | null;
  evidence: AnalyticsInsightEvidence[];
}

export interface AnalyticsPlannerBridge {
  athleteId: string;
  startDate: string;
  plannedPhase: PreparationPhase | null;
  preferredSuggestionCode: PlannerSuggestion["code"] | null;
  preferredAction: PlannerSuggestionAction;
  dayOffset: number | null;
  targetDayOffset: number | null;
  autoApply: boolean;
}

export type AnalyticsCoachActionDecisionStatus = "applied" | "not_applied";

export type AnalyticsCoachActionOutcome = "pending" | "positive" | "neutral" | "negative";

export type AnalyticsCoachActionOutcomeSource = "pending" | "manual" | "automatic";

export interface AnalyticsCoachActionSnapshot {
  readinessScore: number | null;
  readinessStatus: ReadinessStatus | null;
  adherenceRate: number | null;
  actualLoad: number | null;
  loadDelta: number | null;
  phase: PreparationPhase | null;
  competitionPriority: CompetitionPriority | null;
}

export interface AnalyticsCoachActionDecision {
  id: string;
  athleteId: string;
  suggestionId: string;
  suggestionTitle: string;
  suggestionLevel: AnalyticsInsightLevel;
  sourceCode: AnalyticsInsightCode | AnalyticsPatternCode;
  weekStartDate: string;
  weekLabel: string | null;
  decisionStatus: AnalyticsCoachActionDecisionStatus;
  outcome: AnalyticsCoachActionOutcome;
  outcomeSource: AnalyticsCoachActionOutcomeSource;
  plannerBridge: AnalyticsPlannerBridge | null;
  baselineSnapshot: AnalyticsCoachActionSnapshot | null;
  latestSnapshot: AnalyticsCoachActionSnapshot | null;
  sourceStillActive: boolean;
  metricDeltaScore: number;
  decisionNotes: string;
  outcomeNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsCoachActionDecisionPayload {
  suggestionId: string;
  suggestionTitle: string;
  suggestionLevel: AnalyticsInsightLevel;
  sourceCode: AnalyticsInsightCode | AnalyticsPatternCode;
  weekStartDate: string;
  weekLabel?: string | null;
  decisionStatus: AnalyticsCoachActionDecisionStatus;
  plannerBridge: AnalyticsPlannerBridge | null;
  decisionNotes?: string;
  outcome?: AnalyticsCoachActionOutcome | null;
  outcomeNotes?: string;
}

export interface AnalyticsCoachSuggestion {
  id: string;
  level: AnalyticsInsightLevel;
  title: string;
  summary: string;
  recommendation: string;
  source: "insight" | "pattern";
  sourceCode: AnalyticsInsightCode | AnalyticsPatternCode;
  weekStartDate: string | null;
  weekLabel: string | null;
  plannerBridge: AnalyticsPlannerBridge | null;
  latestDecision: AnalyticsCoachActionDecision | null;
}

export interface AnalyticsChainSeason {
  id: string;
  name: string;
  year: number;
  strategyType: SeasonStrategyType;
  goal: string;
}

export interface AnalyticsChainCompetitionPlan {
  id: string;
  competitionTitle: string;
  priority: CompetitionPriority;
  planType: CompetitionPlanType;
  prepStartDate: string;
  prepEndDate: string;
  competitionStartDate: string;
  competitionEndDate: string;
}

export interface AnalyticsChainMesocycle {
  id: string;
  name: string;
  phase: PreparationPhase;
  progressionType: MesocycleProgressionType;
  goal: string;
  startDate: string;
  endDate: string;
}

export type AnalyticsWeekStatus = "upcoming" | "in_progress" | "completed";

export interface AnalyticsWeekSummary {
  label: string;
  startDate: string;
  endDate: string;
  status: AnalyticsWeekStatus;
  elapsedDays: number;
  totalDays: number;
  microcycleType: MesocycleWeekType | null;
  targetLoad: number | null;
  expectedLoadToDate: number | null;
  plannedLoad: number;
  actualLoad: number;
  loadDelta: number;
  averageRpe: number | null;
  averageReadiness: number | null;
  plannedBlocks: number;
  completedBlocks: number;
  partialBlocks: number;
  missedBlocks: number;
  adherenceRate: number;
}

export interface AnalyticsChain {
  season: AnalyticsChainSeason | null;
  competitionPlan: AnalyticsChainCompetitionPlan | null;
  competitionContext: CompetitionContext | null;
  mesocycle: AnalyticsChainMesocycle | null;
  mesocycleWeek: MesocycleWeekContext | null;
  weekSummary: AnalyticsWeekSummary | null;
  missingLinks: string[];
}

export interface AnalyticsOverview {
  athleteId: string;
  athleteName: string;
  readinessTrend: ReadinessTrendPoint[];
  weightTrend?: WeightTrendPoint[];
  completionTrend: CompletionTrendPoint[];
  loadTrend: LoadTrendPoint[];
  chain: AnalyticsChain;
  insights: AnalyticsInsight[];
  patterns: AnalyticsPattern[];
  coachSuggestions: AnalyticsCoachSuggestion[];
  decisionHistory: AnalyticsCoachActionDecision[];
}

export interface OlympicCycleSummary {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  targetEvent: string;
  description: string;
  createdAt: string;
}

export interface CreateOlympicCyclePayload {
  name: string;
  startDate: string;
  endDate: string;
  targetEvent: string;
  description: string;
}

export interface SeasonSummary {
  id: string;
  athleteId: string;
  athleteName: string;
  olympicCycleId: string | null;
  olympicCycleName: string | null;
  year: number;
  name: string;
  goal: string;
  strategyType: SeasonStrategyType;
  createdAt: string;
}

export interface CreateSeasonPayload {
  athleteId: string;
  olympicCycleId: string | null;
  year: number;
  name: string;
  goal: string;
  strategyType: SeasonStrategyType;
}

export interface CompetitionSummary {
  id: string;
  title: string;
  federation: string;
  location: string;
  startDate: string;
  endDate: string;
  level: CompetitionLevel;
  ageGroup: string;
  description: string;
  createdAt: string;
}

export interface CreateCompetitionPayload {
  title: string;
  federation: string;
  location: string;
  startDate: string;
  endDate: string;
  level: CompetitionLevel;
  ageGroup: string;
  description: string;
}

export interface CompetitionPlanSummary {
  id: string;
  athleteId: string;
  athleteName: string;
  seasonId: string | null;
  seasonName: string | null;
  seasonYear: number | null;
  competitionId: string;
  competitionTitle: string;
  competitionStartDate: string;
  competitionEndDate: string;
  priority: CompetitionPriority;
  planType: CompetitionPlanType;
  peakRequired: boolean;
  taperDays: number;
  weightCutRequired: boolean;
  targetWeight: number | null;
  currentWeight: number | null;
  expectedMatches: number | null;
  competitionFormat: string;
  prepStartDate: string;
  prepEndDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  result: CompetitionResultSummary | null;
}

export interface MesocycleWeekPlan {
  weekIndex: number;
  label: string;
  startDate: string;
  endDate: string;
  focus: string;
  targetLoad: number;
  loadModifier: number;
  microcycleType: MesocycleWeekType;
}

export interface MesocycleSummary {
  id: string;
  athleteId: string;
  athleteName: string;
  seasonId: string | null;
  seasonName: string | null;
  competitionPlanId: string | null;
  competitionTitle: string | null;
  name: string;
  phase: PreparationPhase;
  goal: string;
  progressionType: MesocycleProgressionType;
  startDate: string;
  endDate: string;
  weeksCount: number;
  notes: string;
  weeks: MesocycleWeekPlan[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateMesocyclePayload {
  athleteId: string;
  seasonId: string | null;
  competitionPlanId: string | null;
  name: string;
  phase: PreparationPhase;
  goal: string;
  progressionType: MesocycleProgressionType;
  startDate: string;
  endDate: string;
  weeksCount: number;
  notes: string;
}

export interface CreateCompetitionPlanPayload {
  athleteId: string;
  seasonId: string | null;
  competitionId: string;
  priority: CompetitionPriority;
  planType: CompetitionPlanType;
  peakRequired: boolean;
  taperDays: number;
  weightCutRequired: boolean;
  targetWeight: number | null;
  currentWeight: number | null;
  expectedMatches: number | null;
  competitionFormat: string;
  prepStartDate: string;
  prepEndDate: string;
  notes: string;
}

export interface CompetitionContext {
  competitionPlanId: string | null;
  competitionId: string | null;
  daysToCompetition: number | null;
  competitionPriority: CompetitionPriority | null;
  phase: PreparationPhase | null;
  taperState: boolean;
  weightCutState: boolean;
}

export interface CompetitionResultPayload {
  competitionPlanId: string;
  finalPlace: number | null;
  matchesCount: number | null;
  weightAtWeighIn: number | null;
  weightAfter: number | null;
  performanceNotes: string;
  coachNotes: string;
}

export interface CompetitionResultSummary {
  competitionPlanId: string;
  finalPlace: number | null;
  matchesCount: number | null;
  weightAtWeighIn: number | null;
  weightAfter: number | null;
  performanceNotes: string;
  coachNotes: string;
  createdAt: string;
}

export interface CompetitionReviewSeason {
  seasonId: string | null;
  seasonName: string;
  seasonYear: number | null;
  athleteId: string;
  athleteName: string;
  plans: CompetitionPlanSummary[];
}

export interface CompetitionReviewOverview {
  athleteId: string;
  athleteName: string;
  seasons: CompetitionReviewSeason[];
  unlinkedPlans: CompetitionPlanSummary[];
}

export interface CompetitionsResponse {
  competitions: CompetitionSummary[];
}

export interface UwwEventSyncFilters {
  year: string;
  ageGroup: string;
  style: string;
  eventType: string;
  country: string;
}

export interface UwwEventSyncOptions {
  years: string[];
  ageGroups: string[];
  styles: string[];
  eventTypes: string[];
  countries: string[];
}

export interface UwwEventSyncOptionsResponse {
  sourceUrl: string;
  options: UwwEventSyncOptions;
}

export interface UwwEventSyncResponse {
  sourceUrl: string;
  filters: UwwEventSyncFilters;
  options: UwwEventSyncOptions;
  totalFound: number;
  addedCount: number;
  updatedCount: number;
  skippedCount: number;
  competitions: CompetitionSummary[];
}

export interface DeleteCompetitionResponse {
  deletedCompetitionId: string;
  linkedPlanCount: number;
  competitions: CompetitionSummary[];
}

export interface DeleteCompetitionsPayload {
  competitionIds: string[];
}

export interface DeleteCompetitionsResponse {
  deletedCompetitionIds: string[];
  linkedPlanCount: number;
  competitions: CompetitionSummary[];
}

export interface MesocyclesResponse {
  mesocycles: MesocycleSummary[];
}

export interface CompetitionContextResponse {
  context: CompetitionContext | null;
}

export interface PlanTemplateRecommendation {
  templateId: string;
  templateName: string;
  phaseFocus: PreparationPhase | null;
  competitionPriorityFocus: CompetitionPriority | null;
  competitionSpecific: boolean;
  score: number;
  reason: string;
}

export interface PlanTemplateRecommendationResponse {
  date: string;
  athleteId: string;
  competitionContext: CompetitionContext | null;
  recommendations: PlanTemplateRecommendation[];
}

export const TRAINING_ROLES: RoleDescriptor[] = [
  {
    id: "coach",
    name: "Coach",
    summary:
      "Creates plans, analyzes readiness, controls adaptation logic, and reviews analytics.",
  },
  {
    id: "athlete",
    name: "Athlete",
    summary:
      "Submits readiness, views the assigned day, and records actual execution.",
  },
  {
    id: "admin",
    name: "Admin",
    summary:
      "Manages access, system settings, audit visibility, and operating environment.",
  },
];

export const MVP_MODULES: ModuleDescriptor[] = [
  {
    id: "planning",
    name: "Plan Engine",
    summary:
      "Training template builder with a Day -> Session -> Block -> Exercise hierarchy.",
  },
  {
    id: "readiness",
    name: "Readiness Engine v1",
    summary:
      "Daily state assessment using subjective and objective athlete metrics.",
  },
  {
    id: "adaptation",
    name: "Adaptation Engine v1",
    summary:
      "Safe training-day adjustment without breaking the intended preparation logic.",
  },
  {
    id: "analytics",
    name: "Analytics + Execution",
    summary:
      "Actual load capture, adherence tracking, and readiness/load/weight trends.",
  },
];

export const READINESS_STATUS_META: Record<
  ReadinessStatus,
  { label: string; loadRange: string; summary: string }
> = {
  green: {
    label: "Green",
    loadRange: "100%",
    summary: "The planned training day can stay unchanged.",
  },
  yellow: {
    label: "Yellow",
    loadRange: "70-85%",
    summary: "The day needs a partial reduction of load and intensity.",
  },
  red: {
    label: "Red",
    loadRange: "30-50%",
    summary: "The day needs strong reduction or replacement with recovery work.",
  },
};

export const READINESS_DEFAULTS: ReadinessFormValues = {
  sleepHours: 8,
  sleepQuality: 4,
  generalFeeling: 4,
  fatigueLevel: 2,
  muscleSoreness: 2,
  motivationLevel: 4,
  restingHr: 55,
  bodyWeight: 75,
  painLevel: 1,
  illnessFlag: false,
  feverFlag: false,
};

export const READINESS_FIELD_META: Array<{
  key: keyof ReadinessFormValues;
  label: string;
  type: "range" | "number" | "boolean";
  min?: number;
  max?: number;
  step?: number;
}> = [
  { key: "sleepHours", label: "Sleep, hours", type: "number", min: 0, max: 16, step: 0.5 },
  { key: "sleepQuality", label: "Sleep quality", type: "range", min: 1, max: 5, step: 1 },
  { key: "generalFeeling", label: "General feeling", type: "range", min: 1, max: 5, step: 1 },
  { key: "fatigueLevel", label: "Fatigue", type: "range", min: 1, max: 5, step: 1 },
  { key: "muscleSoreness", label: "Muscle soreness", type: "range", min: 1, max: 5, step: 1 },
  { key: "motivationLevel", label: "Motivation", type: "range", min: 1, max: 5, step: 1 },
  { key: "restingHr", label: "Resting HR", type: "number", min: 30, max: 140, step: 1 },
  { key: "bodyWeight", label: "Body weight, kg", type: "number", min: 20, max: 250, step: 0.1 },
  { key: "painLevel", label: "Pain level", type: "range", min: 0, max: 10, step: 1 },
  { key: "illnessFlag", label: "Illness symptoms", type: "boolean" },
  { key: "feverFlag", label: "Fever", type: "boolean" },
];

export const PLAN_BLOCK_TYPES: PlanBlockInput["blockType"][] = [
  "technical",
  "speed",
  "strength",
  "CNS_high",
  "metabolic",
  "conditioning",
  "recovery",
  "mobility",
  "activation",
];

export const DEFAULT_PLAN_TEMPLATE: PlanTemplatePayload = {
  name: "Weekly speed-strength day",
  description: "Coach-authored template for a single key training day.",
  sportType: "Track and field",
  phaseFocus: "strength",
  competitionPriorityFocus: null,
  templateGoal: "Primary speed-strength loading day",
  microcycleType: "load",
  competitionSpecific: false,
  blocks: [
    {
      name: "Sprint mechanics",
      blockType: "technical",
      blockPriority: 5,
      isMandatory: true,
      removePriorityYellow: 5,
      removePriorityRed: 5,
      reductionPercentYellow: 0,
      reductionPercentRed: 0,
      targetDurationMinutes: 18,
      targetRpe: 4,
      targetSets: 4,
      targetReps: 3,
      notes: "Drills and coordination work stay in all statuses.",
    },
    {
      name: "Main acceleration set",
      blockType: "speed",
      blockPriority: 5,
      isMandatory: true,
      removePriorityYellow: 3,
      removePriorityRed: 5,
      reductionPercentYellow: 20,
      reductionPercentRed: 60,
      targetDurationMinutes: 28,
      targetRpe: 8,
      targetSets: 6,
      targetReps: 2,
      notes: "Reduce total sprint volume on yellow or red days.",
    },
    {
      name: "Gym strength block",
      blockType: "strength",
      blockPriority: 4,
      isMandatory: false,
      removePriorityYellow: 4,
      removePriorityRed: 5,
      reductionPercentYellow: 30,
      reductionPercentRed: 70,
      targetDurationMinutes: 35,
      targetRpe: 8,
      targetSets: 4,
      targetReps: 5,
      notes: "Secondary block that can be cut first when readiness drops.",
    },
  ],
};
