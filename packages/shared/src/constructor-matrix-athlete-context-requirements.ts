export type ConstructorMatrixAthleteContextRequirementArea =
  | "training_load"
  | "equipment"
  | "mat_access"
  | "session_duration"
  | "injury_pain"
  | "youth_context"
  | "female_context"
  | "weight_management"
  | "travel_competition"
  | "nutrition_preferences";

export type ConstructorMatrixAthleteContextRequirementStatus =
  | "required_for_full_prescription"
  | "recommended_for_better_fit"
  | "review_required"
  | "metadata_only";

export type ConstructorMatrixAthleteContextRequirement = {
  id: string;
  area: ConstructorMatrixAthleteContextRequirementArea;
  status: ConstructorMatrixAthleteContextRequirementStatus;
  title: string;
  fields: readonly string[];
  whyNeeded: string;
  fallbackWhenMissing: string;
  highRisk: boolean;
  runtimeUseNow: "metadata_only" | "coach_editable_prescription" | "review_prompt";
  noDbMigrationRequired: true;
};

export const CONSTRUCTOR_MATRIX_ATHLETE_CONTEXT_REQUIREMENTS = [
  {
    id: "training_max_or_estimated_max_context",
    area: "training_load",
    status: "required_for_full_prescription",
    title: "Training max or estimated max context",
    fields: ["trainingMaxKgByExerciseId", "estimatedOneRepMaxKgByExerciseId"],
    whyNeeded: "Strength weight candidates need athlete-specific training max or e1RM context.",
    fallbackWhenMissing: "Use RPE, duration and technical-quality prescriptions only.",
    highRisk: false,
    runtimeUseNow: "coach_editable_prescription",
    noDbMigrationRequired: true,
  },
  {
    id: "equipment_availability_context",
    area: "equipment",
    status: "recommended_for_better_fit",
    title: "Equipment availability",
    fields: ["mat", "partner", "barbell", "dumbbell", "kettlebell", "bike", "rower", "bands"],
    whyNeeded: "Exercise resolver can select better variants when equipment is known.",
    fallbackWhenMissing: "Prefer bodyweight, mat and low-equipment variants.",
    highRisk: false,
    runtimeUseNow: "coach_editable_prescription",
    noDbMigrationRequired: true,
  },
  {
    id: "mat_access_context",
    area: "mat_access",
    status: "recommended_for_better_fit",
    title: "Mat access",
    fields: ["matAvailable", "partnerAvailable", "coachPresent"],
    whyNeeded: "Wrestling drills need mat/partner context to avoid impossible sessions.",
    fallbackWhenMissing: "Use movement, mobility, solo technical rehearsal and strength support.",
    highRisk: false,
    runtimeUseNow: "coach_editable_prescription",
    noDbMigrationRequired: true,
  },
  {
    id: "session_duration_context",
    area: "session_duration",
    status: "recommended_for_better_fit",
    title: "Session duration",
    fields: ["availableSessionMinutes", "sessionsPerDay"],
    whyNeeded: "Volume can be scaled to fit real session duration.",
    fallbackWhenMissing: "Use conservative default duration from Matrix block volume.",
    highRisk: false,
    runtimeUseNow: "coach_editable_prescription",
    noDbMigrationRequired: true,
  },
  {
    id: "injury_pain_review_context",
    area: "injury_pain",
    status: "review_required",
    title: "Injury and pain review context",
    fields: ["painLevel", "painZones", "injuryHistory", "injuryCaution"],
    whyNeeded: "Pain and injury can change exercise selection and require qualified review.",
    fallbackWhenMissing: "Keep progression conservative and prompt coach/medical review when pain is present.",
    highRisk: true,
    runtimeUseNow: "review_prompt",
    noDbMigrationRequired: true,
  },
  {
    id: "youth_context_review",
    area: "youth_context",
    status: "review_required",
    title: "Youth context",
    fields: ["age", "trainingAgeYears", "guardian/coach confirmation if applicable"],
    whyNeeded: "Youth high-load and weight-management decisions require extra review.",
    fallbackWhenMissing: "Avoid aggressive progression and keep high-risk decisions review-required.",
    highRisk: true,
    runtimeUseNow: "review_prompt",
    noDbMigrationRequired: true,
  },
  {
    id: "female_context_review",
    area: "female_context",
    status: "review_required",
    title: "Female and RED-S-sensitive context",
    fields: ["sex", "symptom notes if voluntarily provided", "medical review artifacts if any"],
    whyNeeded: "Female-context and RED-S-sensitive decisions must not be automated.",
    fallbackWhenMissing: "Use neutral training guidance and keep medical decisions blocked.",
    highRisk: true,
    runtimeUseNow: "review_prompt",
    noDbMigrationRequired: true,
  },
  {
    id: "body_mass_category_review_context",
    area: "weight_management",
    status: "review_required",
    title: "Body mass and target category context",
    fields: ["currentBodyMass", "bodyMassTrend", "targetCategory", "weighInDate"],
    whyNeeded: "Weight management needs coach/medical review and cannot be inferred from one value.",
    fallbackWhenMissing: "Flag missing context and do not automate weight-cut recommendations.",
    highRisk: true,
    runtimeUseNow: "review_prompt",
    noDbMigrationRequired: true,
  },
  {
    id: "travel_weigh_in_schedule_context",
    area: "travel_competition",
    status: "recommended_for_better_fit",
    title: "Travel, weigh-in and competition schedule",
    fields: ["travelDate", "weighInDate", "competitionStart", "timezone", "climateContext"],
    whyNeeded: "Logistics influence load ceilings and recovery emphasis.",
    fallbackWhenMissing: "Keep logistics days conservative and avoid primary Matrix save/assign if server gate blocks.",
    highRisk: false,
    runtimeUseNow: "metadata_only",
    noDbMigrationRequired: true,
  },
  {
    id: "nutrition_constraints_preferences_context",
    area: "nutrition_preferences",
    status: "metadata_only",
    title: "Nutrition constraints and preferences",
    fields: ["allergies", "diet preference", "religious/cultural constraints", "GI tolerance notes"],
    whyNeeded: "Nutrition guidance should not suggest incompatible foods.",
    fallbackWhenMissing: "Use generic educational reminders and ask coach/athlete to adapt.",
    highRisk: false,
    runtimeUseNow: "metadata_only",
    noDbMigrationRequired: true,
  },
] as const satisfies readonly ConstructorMatrixAthleteContextRequirement[];

export function buildConstructorMatrixAthleteContextRequirementSummary() {
  return {
    requirementCount: CONSTRUCTOR_MATRIX_ATHLETE_CONTEXT_REQUIREMENTS.length,
    highRiskRequirementCount: CONSTRUCTOR_MATRIX_ATHLETE_CONTEXT_REQUIREMENTS.filter(
      (item) => item.highRisk,
    ).length,
    noDbMigrationRequired: true,
  };
}
