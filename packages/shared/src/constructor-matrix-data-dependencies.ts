import type { ConstructorMatrixEvidenceDependencyId } from "./constructor-matrix-evidence";

export type ConstructorMatrixDataDependencyArea =
  | "weight_cut"
  | "hydration"
  | "readiness"
  | "wearable_data"
  | "sleep"
  | "rhr"
  | "hrv"
  | "pain"
  | "soreness"
  | "injury"
  | "female_context"
  | "youth_context"
  | "travel_fatigue"
  | "competition_context"
  | "contact_load"
  | "lmv"
  | "taper";

export type ConstructorMatrixDataAvailability =
  | "available"
  | "partial"
  | "missing"
  | "unknown";

export type ConstructorMatrixMissingDataBehavior =
  | "fail_closed"
  | "fail_soft"
  | "require_coach_confirmation"
  | "require_medical_confirmation"
  | "use_low_risk_replacement"
  | "advisory_only";

export type ConstructorMatrixDataRuntimeUse =
  | "none"
  | "documentation_only"
  | "risk_warning_only"
  | "pilot_readiness_only"
  | "future_gate";

export interface ConstructorMatrixDataDependency {
  id: string;
  area: ConstructorMatrixDataDependencyArea;
  title: string;
  requiredFields: string[];
  optionalFields: string[];
  currentAvailability: ConstructorMatrixDataAvailability;
  missingDataBehavior: ConstructorMatrixMissingDataBehavior;
  supportsEvidenceDependencies: ConstructorMatrixEvidenceDependencyId[];
  limitations: string[];
  runtimeUseNow: ConstructorMatrixDataRuntimeUse;
}

export const CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES = [
  {
    id: "body_mass_trend_for_weight_cut",
    area: "weight_cut",
    title: "Body-mass trend context for weight-cut decisions",
    requiredFields: [
      "current_body_mass",
      "target_weight_class",
      "days_to_start",
      "weigh_in_datetime",
      "recent_body_mass_trend",
    ],
    optionalFields: [
      "hydration_symptoms",
      "urine_color",
      "coach_weight_note",
    ],
    currentAvailability: "partial",
    missingDataBehavior: "require_coach_confirmation",
    supportsEvidenceDependencies: [
      "ncaa_weight_management",
      "acsm_hydration_nutrition",
      "japan_rapid_weight_loss_wrestlers",
      "sichuan_weight_reduction_wrestlers",
    ],
    limitations: [
      "No numeric thresholds are defined yet; hydration cannot be inferred from body mass alone.",
    ],
    runtimeUseNow: "documentation_only",
  },
  {
    id: "hydration_status_for_weigh_in",
    area: "hydration",
    title: "Hydration context for weigh-in decisions",
    requiredFields: [
      "weigh_in_datetime",
      "hydration_symptoms",
      "recent_body_mass_trend",
    ],
    optionalFields: [
      "urine_specific_gravity",
      "urine_color",
      "fluid_restriction_flag",
      "sauna_or_heat_exposure",
    ],
    currentAvailability: "unknown",
    missingDataBehavior: "require_medical_confirmation",
    supportsEvidenceDependencies: [
      "acsm_hydration_nutrition",
      "ncaa_weight_management",
    ],
    limitations: [
      "No automatic dehydration conclusion is allowed without symptoms, trend and coach or medical context.",
    ],
    runtimeUseNow: "future_gate",
  },
  {
    id: "readiness_context_for_load_confidence",
    area: "readiness",
    title: "Readiness context for load-confidence decisions",
    requiredFields: [
      "readiness_score",
      "readiness_trend",
      "days_to_start",
    ],
    optionalFields: [
      "athlete_self_report",
      "coach_readiness_note",
      "illness_symptoms",
    ],
    currentAvailability: "partial",
    missingDataBehavior: "use_low_risk_replacement",
    supportsEvidenceDependencies: [
      "recovery_monitoring_consensus",
      "wearable_validity_trend",
    ],
    limitations: [
      "Readiness is a confidence signal, not a diagnosis or automatic permission for added load.",
    ],
    runtimeUseNow: "pilot_readiness_only",
  },
  {
    id: "sleep_readiness_for_load_confidence",
    area: "sleep",
    title: "Sleep context for load-confidence decisions",
    requiredFields: [
      "sleep_duration",
      "sleep_quality",
      "days_to_start",
    ],
    optionalFields: [
      "wearable_sleep_confidence",
      "athlete_self_report",
      "coach_readiness_note",
    ],
    currentAvailability: "partial",
    missingDataBehavior: "use_low_risk_replacement",
    supportsEvidenceDependencies: [
      "recovery_monitoring_consensus",
      "wearable_validity_trend",
    ],
    limitations: [
      "A single sleep night cannot become a hard rule without trend and context.",
    ],
    runtimeUseNow: "risk_warning_only",
  },
  {
    id: "resting_hr_trend_for_recovery_confidence",
    area: "rhr",
    title: "Resting heart-rate trend context for recovery confidence",
    requiredFields: [
      "resting_hr_trend",
      "baseline_resting_hr",
      "data_window_days",
    ],
    optionalFields: [
      "illness_symptoms",
      "sleep_quality",
      "fatigue",
    ],
    currentAvailability: "partial",
    missingDataBehavior: "advisory_only",
    supportsEvidenceDependencies: [
      "recovery_monitoring_consensus",
      "wearable_validity_trend",
    ],
    limitations: [
      "No isolated resting-HR diagnosis is allowed; interpretation must remain trend-based.",
    ],
    runtimeUseNow: "risk_warning_only",
  },
  {
    id: "hrv_trend_for_recovery_confidence",
    area: "hrv",
    title: "HRV trend context for recovery confidence",
    requiredFields: [
      "hrv_trend",
      "baseline_hrv",
      "data_window_days",
    ],
    optionalFields: [
      "sleep_quality",
      "fatigue",
      "device_confidence",
    ],
    currentAvailability: "partial",
    missingDataBehavior: "advisory_only",
    supportsEvidenceDependencies: [
      "recovery_monitoring_consensus",
      "wearable_validity_trend",
    ],
    limitations: [
      "No isolated HRV diagnosis is allowed; no numeric threshold is approved.",
    ],
    runtimeUseNow: "risk_warning_only",
  },
  {
    id: "wearable_data_quality_for_readiness",
    area: "wearable_data",
    title: "Wearable data quality for readiness context",
    requiredFields: [
      "device_source",
      "data_completeness",
      "measurement_timestamp",
    ],
    optionalFields: [
      "device_confidence",
      "manual_override",
    ],
    currentAvailability: "partial",
    missingDataBehavior: "advisory_only",
    supportsEvidenceDependencies: [
      "wearable_validity_trend",
    ],
    limitations: [
      "Wearable data is trend and context evidence, not absolute truth for high-confidence decisions.",
    ],
    runtimeUseNow: "pilot_readiness_only",
  },
  {
    id: "contact_load_exposure_for_wrestling_sessions",
    area: "contact_load",
    title: "Contact-load exposure context for wrestling sessions",
    requiredFields: [
      "contact_minutes",
      "live_wrestling_minutes",
      "sparring_rounds",
      "control_bouts",
    ],
    optionalFields: [
      "opponent_resistance",
      "technical_intent",
      "coach_contact_note",
    ],
    currentAvailability: "partial",
    missingDataBehavior: "require_coach_confirmation",
    supportsEvidenceDependencies: [
      "wrestling_temporal_structure",
      "perform_evidence_matrix",
    ],
    limitations: [
      "Mat minutes are not equal to contact load; no contact-minute threshold is approved.",
    ],
    runtimeUseNow: "documentation_only",
  },
  {
    id: "lmv_local_fatigue_for_legs",
    area: "lmv",
    title: "Local muscular fatigue context for leg LMV work",
    requiredFields: [
      "leg_local_fatigue",
      "previous_lmv_load",
      "days_to_start",
    ],
    optionalFields: [
      "soreness",
      "coach_note",
      "movement_quality",
    ],
    currentAvailability: "unknown",
    missingDataBehavior: "require_coach_confirmation",
    supportsEvidenceDependencies: [
      "bfr_kaatsu_local_metabolic",
      "europe_pre_competition_plan",
      "perform_evidence_matrix",
    ],
    limitations: [
      "LMV/statodynamics is not the same as true BFR/KAATSU; no recovery-window threshold is approved.",
    ],
    runtimeUseNow: "documentation_only",
  },
  {
    id: "pain_location_severity_for_block_eligibility",
    area: "pain",
    title: "Pain location and onset context for block eligibility",
    requiredFields: [
      "pain_location",
      "pain_severity",
      "pain_onset",
    ],
    optionalFields: [
      "movement_trigger",
      "coach_note",
      "medical_clearance",
    ],
    currentAvailability: "unknown",
    missingDataBehavior: "require_medical_confirmation",
    supportsEvidenceDependencies: [
      "perform_evidence_matrix",
      "recovery_monitoring_consensus",
    ],
    limitations: [
      "No automatic return-to-training or pain-load decision is allowed from this metadata layer.",
    ],
    runtimeUseNow: "future_gate",
  },
  {
    id: "injury_status_for_return_to_training",
    area: "injury",
    title: "Injury status context for return-to-training decisions",
    requiredFields: [
      "injury_status",
      "medical_clearance",
      "affected_area",
    ],
    optionalFields: [
      "return_to_training_stage",
      "pain_severity",
      "coach_note",
    ],
    currentAvailability: "unknown",
    missingDataBehavior: "require_medical_confirmation",
    supportsEvidenceDependencies: [
      "perform_evidence_matrix",
      "nsca_youth_safe_progression",
    ],
    limitations: [
      "Medical review is required; the constructor must not automate return-to-training decisions.",
    ],
    runtimeUseNow: "future_gate",
  },
  {
    id: "youth_context_for_high_load_progression",
    area: "youth_context",
    title: "Youth context for high-load progression decisions",
    requiredFields: [
      "athlete_age",
      "training_age",
    ],
    optionalFields: [
      "biological_maturity",
      "coach_clearance",
      "parent_policy_context",
    ],
    currentAvailability: "unknown",
    missingDataBehavior: "require_coach_confirmation",
    supportsEvidenceDependencies: [
      "nsca_youth_safe_progression",
    ],
    limitations: [
      "Adult matrix logic must not be auto-scaled for youth high-load progression without review.",
    ],
    runtimeUseNow: "future_gate",
  },
  {
    id: "female_context_for_reds_or_cycle_sensitive_decisions",
    area: "female_context",
    title: "Female-athlete context for energy-availability and symptom-sensitive decisions",
    requiredFields: [
      "sex",
      "symptoms",
      "energy_availability_risk",
    ],
    optionalFields: [
      "menstrual_context",
      "iron_fatigue_context",
      "medical_note",
    ],
    currentAvailability: "unknown",
    missingDataBehavior: "require_medical_confirmation",
    supportsEvidenceDependencies: [
      "perform_evidence_matrix",
      "acsm_hydration_nutrition",
    ],
    limitations: [
      "Do not adjust automatically by cycle phase alone; RED-S is not diagnosed by the constructor.",
    ],
    runtimeUseNow: "future_gate",
  },
  {
    id: "travel_fatigue_for_load_ceiling",
    area: "travel_fatigue",
    title: "Travel-fatigue context for load-ceiling decisions",
    requiredFields: [
      "travel_date",
      "travel_duration",
      "days_to_start",
    ],
    optionalFields: [
      "time_zone_change",
      "sleep_after_travel",
      "athlete_fatigue",
    ],
    currentAvailability: "partial",
    missingDataBehavior: "use_low_risk_replacement",
    supportsEvidenceDependencies: [
      "europe_pre_competition_plan",
      "acsm_hydration_nutrition",
    ],
    limitations: [
      "No heavy load add-on is allowed from missing travel-fatigue context without coach confirmation.",
    ],
    runtimeUseNow: "risk_warning_only",
  },
  {
    id: "taper_load_context_for_hidden_fatigue",
    area: "taper",
    title: "Taper load context for hidden fatigue review",
    requiredFields: [
      "days_to_start",
      "start_role",
      "planned_volume",
      "recent_high_intensity_load",
    ],
    optionalFields: [
      "sleep_quality",
      "rhr_trend",
      "coach_taper_note",
    ],
    currentAvailability: "partial",
    missingDataBehavior: "use_low_risk_replacement",
    supportsEvidenceDependencies: [
      "periodization_taper_peaking",
      "matrix_transition_plan",
    ],
    limitations: [
      "No fixed taper-load threshold is approved; exact taper dose requires review.",
    ],
    runtimeUseNow: "risk_warning_only",
  },
  {
    id: "competition_day_context_for_no_training_development",
    area: "competition_context",
    title: "Competition-day context for no-development decisions",
    requiredFields: [
      "competition_date",
      "day_type",
      "start_role",
    ],
    optionalFields: [
      "expected_bout_count",
      "weigh_in_datetime",
      "tournament_format",
    ],
    currentAvailability: "partial",
    missingDataBehavior: "use_low_risk_replacement",
    supportsEvidenceDependencies: [
      "constructor_core_stack",
      "matrix_transition_plan",
      "periodization_taper_peaking",
    ],
    limitations: [
      "Competition day is not normal training; bout details still need a typed model before automation.",
    ],
    runtimeUseNow: "pilot_readiness_only",
  },
] as const satisfies readonly ConstructorMatrixDataDependency[];

export type ConstructorMatrixDataDependencyId =
  (typeof CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES)[number]["id"];

export const CONSTRUCTOR_MATRIX_DATA_DEPENDENCY_IDS =
  CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES.map((item) => item.id);

export const CONSTRUCTOR_MATRIX_DATA_DEPENDENCY_ID_SET = new Set<string>(
  CONSTRUCTOR_MATRIX_DATA_DEPENDENCY_IDS,
);

const CONSTRUCTOR_MATRIX_DATA_DEPENDENCY_LOOKUP = new Map<
  ConstructorMatrixDataDependencyId,
  ConstructorMatrixDataDependency
>(
  CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES.map((item) => [item.id, item]),
);

export function listConstructorMatrixDataDependencyIds(): ConstructorMatrixDataDependencyId[] {
  return [...CONSTRUCTOR_MATRIX_DATA_DEPENDENCY_IDS];
}

export function getConstructorMatrixDataDependency(
  id: ConstructorMatrixDataDependencyId,
): ConstructorMatrixDataDependency | null {
  return CONSTRUCTOR_MATRIX_DATA_DEPENDENCY_LOOKUP.get(id) ?? null;
}

export function validateConstructorMatrixDataDependencyIds(
  ids: readonly string[],
): { ok: boolean; missing: string[] } {
  const missing = ids.filter((id) => !CONSTRUCTOR_MATRIX_DATA_DEPENDENCY_ID_SET.has(id));

  return {
    ok: missing.length === 0,
    missing,
  };
}
