import type {
  ConstructorBlockType,
  ConstructorGoalMode,
  ConstructorGoalType,
  ConstructorLoadLevel,
  ConstructorPhase,
  ConstructorRiskCode,
} from "./constructor-core";
import type { ConstructorMatrixEvidenceDependencyId } from "./constructor-matrix-evidence";
import { uniqueConstructorMatrixEvidenceDependencies } from "./constructor-matrix-evidence";
import type { SeasonStrategyCompetitionRole } from "./season-strategy";

export type ConstructorPreparationPhase =
  | "general_preparation"
  | "special_preparation"
  | "special_pre_competition"
  | "direct_pre_competition"
  | "taper"
  | "competition"
  | "transition_recovery";

export type ConstructorCompetitionRole = SeasonStrategyCompetitionRole;

export type ConstructorWeekType =
  | "development"
  | "maintenance"
  | "special"
  | "pre_competition"
  | "deload"
  | "taper"
  | "competition"
  | "recovery"
  | "travel_logistics"
  | "post_competition";

export type ConstructorDayType =
  | "heavy_training"
  | "medium_training"
  | "light_training"
  | "technical"
  | "competition_model"
  | "mat_day"
  | "spp_day"
  | "gpp_day"
  | "half_day"
  | "environment_change"
  | "recovery"
  | "sauna_recovery"
  | "travel"
  | "weigh_in"
  | "competition"
  | "post_competition";

export type ConstructorSessionSlot = "morning" | "evening";

export type ConstructorTrainingBlockType =
  | "mat_technique"
  | "mat_tactics"
  | "mat_competition_model"
  | "mat_control_bouts"
  | "mat_light_technical"
  | "spp"
  | "gpp"
  | "leg_lmv"
  | "first_action_speed"
  | "aerobic_deload"
  | "mobility"
  | "recovery"
  | "sauna"
  | "environment_change"
  | "travel"
  | "weigh_in"
  | "competition_start"
  | "post_competition_recovery";

export type ConstructorMatrixLoadLevel = "none" | "low" | "medium" | "high";
export type ConstructorRecoveryPriority = "support" | "mandatory" | "primary";

export type ConstructorEligibilityReasonCode =
  | "phase_not_allowed"
  | "week_type_not_allowed"
  | "day_type_not_allowed"
  | "session_slot_not_allowed"
  | "development_forbidden_before_main_start"
  | "too_close_to_main_start"
  | "heavy_strength_too_close"
  | "heavy_leg_lmv_too_close"
  | "mat_volume_too_high_close_to_start"
  | "control_bouts_too_close"
  | "heavy_load_on_travel_day"
  | "heavy_load_on_weigh_in_day"
  | "taper_development_mix"
  | "week_development_forbidden"
  | "day_development_forbidden"
  | "spp_not_allowed"
  | "gpp_not_allowed"
  | "control_bouts_not_allowed";

export interface ConstructorPhaseMatrixRule {
  phase: ConstructorPreparationPhase;
  constructorPhase: ConstructorPhase;
  minDaysUntilStart: number | null;
  maxDaysUntilStart: number | null;
  competitionRoles: ConstructorCompetitionRole[];
  allowedModes: ConstructorGoalMode[];
  forbiddenModes: ConstructorGoalMode[];
  defaultWeekTypes: ConstructorWeekType[];
  canDevelopQualities: boolean;
  recoveryPriority: ConstructorRecoveryPriority;
  evidenceDependencies: ConstructorMatrixEvidenceDependencyId[];
  explanation: string;
}

export interface ConstructorWeekMatrixRule {
  weekType: ConstructorWeekType;
  phases: ConstructorPreparationPhase[];
  loadLevel: ConstructorMatrixLoadLevel;
  matVolumeLevel: ConstructorMatrixLoadLevel;
  canUseSPP: boolean;
  canUseGPP: boolean;
  canDevelopQualities: boolean;
  canUseHeavyStrength: boolean;
  canUseHeavyLegLmv: boolean;
  canUseControlBouts: boolean;
  recoveryPriority: ConstructorRecoveryPriority;
  evidenceDependencies: ConstructorMatrixEvidenceDependencyId[];
  explanation: string;
}

export interface ConstructorDayMatrixRule {
  dayType: ConstructorDayType;
  allowedWeekTypes: ConstructorWeekType[];
  loadLevel: ConstructorMatrixLoadLevel;
  matVolumeLevel: ConstructorMatrixLoadLevel;
  allowedSessionSlots: ConstructorSessionSlot[];
  maxSessions: 0 | 1 | 2;
  canUseSPP: boolean;
  canUseGPP: boolean;
  canDevelopQualities: boolean;
  canUseHeavyStrength: boolean;
  canUseHeavyLegLmv: boolean;
  canUseSpeed: boolean;
  canUseControlBouts: boolean;
  recoveryPriority: ConstructorRecoveryPriority;
  evidenceDependencies: ConstructorMatrixEvidenceDependencyId[];
  explanation: string;
}

export interface ConstructorTrainingBlockDefinition {
  type: ConstructorTrainingBlockType;
  blockType: ConstructorBlockType;
  targetQuality: ConstructorGoalType;
  label: string;
  allowedPhases: ConstructorPreparationPhase[];
  allowedWeekTypes: ConstructorWeekType[];
  allowedDayTypes: ConstructorDayType[];
  allowedSessionSlots: ConstructorSessionSlot[];
  minDaysUntilStartForMainStart: number | null;
  loadLevel: ConstructorMatrixLoadLevel;
  matVolumeLevel: ConstructorMatrixLoadLevel;
  developsQuality: boolean;
  usesSPP: boolean;
  usesGPP: boolean;
  usesHeavyStrength: boolean;
  usesHeavyLegLmv: boolean;
  usesControlBouts: boolean;
  riskTags: ConstructorRiskCode[];
  forbiddenCombinations: ConstructorTrainingBlockType[];
  evidenceDependencies: ConstructorMatrixEvidenceDependencyId[];
  explanation: string;
}

export interface ConstructorBlockEligibilityRule {
  code: ConstructorEligibilityReasonCode;
  message: string;
  replacementBlockType?: ConstructorTrainingBlockType;
  evidenceDependencies?: ConstructorMatrixEvidenceDependencyId[];
}

export interface ConstructorRiskRule {
  code: ConstructorRiskCode | ConstructorEligibilityReasonCode;
  message: string;
  replacementBlockType?: ConstructorTrainingBlockType;
  evidenceDependencies?: ConstructorMatrixEvidenceDependencyId[];
}

export interface ConstructorExplanationReason {
  code:
    | "phase"
    | "week_type"
    | "day_type"
    | "session_slot"
    | "block_allowed"
    | "block_forbidden"
    | "risk"
    | "template_card_inventory";
  message: string;
}

export interface ConstructorMatrixContext {
  preparationPhase: ConstructorPreparationPhase;
  competitionRole?: ConstructorCompetitionRole | null;
  daysUntilStart?: number | null;
  weekType?: ConstructorWeekType | null;
  dayType?: ConstructorDayType | null;
  sessionSlot?: ConstructorSessionSlot | null;
  isMainStart?: boolean;
  isTravelDay?: boolean;
  isWeighInDay?: boolean;
  isCompetitionDay?: boolean;
  isPostCompetitionDay?: boolean;
}

export interface ConstructorTemplateCardCompatibility {
  cardId: string;
  trainingBlockTypes: ConstructorTrainingBlockType[];
  controlsGeneration: false;
  explanation: string;
}

type ConstructorMatrixRuleWithoutEvidence<T extends { evidenceDependencies: unknown }> = Omit<
  T,
  "evidenceDependencies"
>;

function evidence(
  ids: readonly ConstructorMatrixEvidenceDependencyId[],
): ConstructorMatrixEvidenceDependencyId[] {
  return uniqueConstructorMatrixEvidenceDependencies(ids);
}

function evidenceForPhase(phase: ConstructorPreparationPhase): ConstructorMatrixEvidenceDependencyId[] {
  const common = ["perform_evidence_matrix", "matrix_transition_plan"] as const;

  switch (phase) {
    case "general_preparation":
      return evidence([...common, "constructor_core_stack", "periodization_taper_peaking"]);
    case "special_preparation":
      return evidence([...common, "constructor_core_stack", "wrestling_temporal_structure"]);
    case "special_pre_competition":
      return evidence([...common, "europe_pre_competition_plan", "periodization_taper_peaking"]);
    case "direct_pre_competition":
    case "taper":
      return evidence([...common, "europe_pre_competition_plan", "periodization_taper_peaking"]);
    case "competition":
      return evidence([
        ...common,
        "europe_pre_competition_plan",
        "periodization_taper_peaking",
        "ncaa_weight_management",
        "acsm_hydration_nutrition",
      ]);
    case "transition_recovery":
      return evidence([...common, "recovery_monitoring_consensus"]);
    default:
      return evidence(common);
  }
}

function evidenceForWeekType(weekType: ConstructorWeekType): ConstructorMatrixEvidenceDependencyId[] {
  const common = ["perform_evidence_matrix", "matrix_transition_plan"] as const;

  switch (weekType) {
    case "development":
      return evidence([
        ...common,
        "china_ssit_freestyle_wrestlers",
        "bfr_kaatsu_local_metabolic",
        "china_bfr_half_squat_wrestlers",
      ]);
    case "maintenance":
    case "special":
      return evidence([...common, "europe_pre_competition_plan", "wrestling_temporal_structure"]);
    case "pre_competition":
    case "taper":
    case "competition":
      return evidence([...common, "europe_pre_competition_plan", "periodization_taper_peaking"]);
    case "deload":
    case "recovery":
    case "post_competition":
      return evidence([...common, "recovery_monitoring_consensus", "europe_pre_competition_plan"]);
    case "travel_logistics":
      return evidence([...common, "europe_pre_competition_plan", "acsm_hydration_nutrition"]);
    default:
      return evidence(common);
  }
}

function evidenceForDayType(dayType: ConstructorDayType): ConstructorMatrixEvidenceDependencyId[] {
  const common = ["perform_evidence_matrix", "matrix_transition_plan"] as const;

  switch (dayType) {
    case "heavy_training":
    case "medium_training":
    case "spp_day":
    case "gpp_day":
      return evidence([
        ...common,
        "periodization_taper_peaking",
        "bfr_kaatsu_local_metabolic",
        "china_ssit_freestyle_wrestlers",
      ]);
    case "technical":
    case "mat_day":
    case "competition_model":
      return evidence([...common, "wrestling_temporal_structure", "europe_pre_competition_plan"]);
    case "light_training":
    case "half_day":
    case "environment_change":
    case "recovery":
    case "sauna_recovery":
    case "post_competition":
      return evidence([...common, "recovery_monitoring_consensus", "europe_pre_competition_plan"]);
    case "travel":
      return evidence([...common, "europe_pre_competition_plan", "acsm_hydration_nutrition"]);
    case "weigh_in":
      return evidence([
        ...common,
        "ncaa_weight_management",
        "acsm_hydration_nutrition",
        "japan_rapid_weight_loss_wrestlers",
        "sichuan_weight_reduction_wrestlers",
      ]);
    case "competition":
      return evidence([...common, "wrestling_temporal_structure", "periodization_taper_peaking"]);
    default:
      return evidence(common);
  }
}

function evidenceForTrainingBlock(
  type: ConstructorTrainingBlockType,
): ConstructorMatrixEvidenceDependencyId[] {
  const common = ["perform_evidence_matrix", "matrix_transition_plan"] as const;

  switch (type) {
    case "mat_technique":
    case "mat_tactics":
    case "mat_light_technical":
      return evidence([...common, "wrestling_temporal_structure", "europe_pre_competition_plan"]);
    case "mat_competition_model":
    case "mat_control_bouts":
    case "competition_start":
      return evidence([...common, "wrestling_temporal_structure", "europe_pre_competition_plan"]);
    case "spp":
      return evidence([...common, "europe_pre_competition_plan", "bfr_kaatsu_local_metabolic"]);
    case "gpp":
    case "aerobic_deload":
    case "environment_change":
      return evidence([...common, "recovery_monitoring_consensus", "periodization_taper_peaking"]);
    case "leg_lmv":
      return evidence([
        ...common,
        "bfr_kaatsu_local_metabolic",
        "china_bfr_half_squat_wrestlers",
        "europe_pre_competition_plan",
      ]);
    case "first_action_speed":
      return evidence([...common, "china_ssit_freestyle_wrestlers", "europe_pre_competition_plan"]);
    case "mobility":
    case "recovery":
    case "post_competition_recovery":
      return evidence([...common, "recovery_monitoring_consensus"]);
    case "sauna":
    case "weigh_in":
      return evidence([
        ...common,
        "ncaa_weight_management",
        "acsm_hydration_nutrition",
        "japan_rapid_weight_loss_wrestlers",
      ]);
    case "travel":
      return evidence([...common, "europe_pre_competition_plan", "acsm_hydration_nutrition"]);
    default:
      return evidence([...common, "perform_internal_validation_pending"]);
  }
}

function withPhaseEvidence(
  rule: ConstructorMatrixRuleWithoutEvidence<ConstructorPhaseMatrixRule>,
): ConstructorPhaseMatrixRule {
  return {
    ...rule,
    evidenceDependencies: evidenceForPhase(rule.phase),
  };
}

function withWeekEvidence(
  rule: ConstructorMatrixRuleWithoutEvidence<ConstructorWeekMatrixRule>,
): ConstructorWeekMatrixRule {
  return {
    ...rule,
    evidenceDependencies: evidenceForWeekType(rule.weekType),
  };
}

function withDayEvidence(
  rule: ConstructorMatrixRuleWithoutEvidence<ConstructorDayMatrixRule>,
): ConstructorDayMatrixRule {
  return {
    ...rule,
    evidenceDependencies: evidenceForDayType(rule.dayType),
  };
}

function withTrainingBlockEvidence(
  rule: ConstructorMatrixRuleWithoutEvidence<ConstructorTrainingBlockDefinition>,
): ConstructorTrainingBlockDefinition {
  return {
    ...rule,
    evidenceDependencies: evidenceForTrainingBlock(rule.type),
  };
}

const CONSTRUCTOR_PHASE_MATRIX_RULE_DEFINITIONS: Array<
  ConstructorMatrixRuleWithoutEvidence<ConstructorPhaseMatrixRule>
> = [
  {
    phase: "general_preparation",
    constructorPhase: "base",
    minDaysUntilStart: 61,
    maxDaysUntilStart: null,
    competitionRoles: ["control_start", "qualifier", "secondary_peak", "main_peak"],
    allowedModes: ["development", "maintenance", "transfer", "recovery"],
    forbiddenModes: [],
    defaultWeekTypes: ["development", "maintenance", "deload"],
    canDevelopQualities: true,
    recoveryPriority: "support",
    explanation: "Старт далеко: можно развивать базу, ОФП, аэробную устойчивость и общие качества.",
  },
  {
    phase: "special_preparation",
    constructorPhase: "special_preparation",
    minDaysUntilStart: 31,
    maxDaysUntilStart: 60,
    competitionRoles: ["control_start", "qualifier", "secondary_peak", "main_peak"],
    allowedModes: ["development", "maintenance", "transfer", "recovery"],
    forbiddenModes: [],
    defaultWeekTypes: ["special", "maintenance", "deload"],
    canDevelopQualities: true,
    recoveryPriority: "mandatory",
    explanation: "Специальная подготовка: развитие допускается, но должно переноситься в борьбу.",
  },
  {
    phase: "special_pre_competition",
    constructorPhase: "special_preparation",
    minDaysUntilStart: 15,
    maxDaysUntilStart: 30,
    competitionRoles: ["main_peak", "secondary_peak", "qualifier"],
    allowedModes: ["maintenance", "transfer", "activation", "recovery"],
    forbiddenModes: ["development"],
    defaultWeekTypes: ["pre_competition", "special", "deload"],
    canDevelopQualities: false,
    recoveryPriority: "mandatory",
    explanation: "Главный старт близко: развитие запрещено, остаются поддержание, перенос, активация и восстановление.",
  },
  {
    phase: "direct_pre_competition",
    constructorPhase: "taper",
    minDaysUntilStart: 5,
    maxDaysUntilStart: 14,
    competitionRoles: ["main_peak", "secondary_peak", "qualifier"],
    allowedModes: ["transfer", "activation", "recovery"],
    forbiddenModes: ["development"],
    defaultWeekTypes: ["taper", "deload"],
    canDevelopQualities: false,
    recoveryPriority: "primary",
    explanation: "Непосредственная предсоревновательная фаза: снижаем объём, сохраняем качество и свежесть.",
  },
  {
    phase: "taper",
    constructorPhase: "taper",
    minDaysUntilStart: 5,
    maxDaysUntilStart: 10,
    competitionRoles: ["main_peak", "secondary_peak", "qualifier"],
    allowedModes: ["activation", "recovery"],
    forbiddenModes: ["development", "maintenance"],
    defaultWeekTypes: ["taper"],
    canDevelopQualities: false,
    recoveryPriority: "primary",
    explanation: "Подводка: нельзя добирать нагрузку, нужны свежесть, сон, вес и короткая активация.",
  },
  {
    phase: "competition",
    constructorPhase: "start_window",
    minDaysUntilStart: 0,
    maxDaysUntilStart: 4,
    competitionRoles: ["main_peak", "secondary_peak", "qualifier", "control_start"],
    allowedModes: ["activation", "recovery"],
    forbiddenModes: ["development", "maintenance", "transfer"],
    defaultWeekTypes: ["competition", "travel_logistics"],
    canDevelopQualities: false,
    recoveryPriority: "primary",
    explanation: "Стартовое окно: только короткая активация, вес, сон, дорога и соревновательная готовность.",
  },
  {
    phase: "transition_recovery",
    constructorPhase: "recovery",
    minDaysUntilStart: null,
    maxDaysUntilStart: null,
    competitionRoles: ["control_start", "qualifier", "secondary_peak", "main_peak"],
    allowedModes: ["recovery"],
    forbiddenModes: ["development", "maintenance", "transfer", "activation"],
    defaultWeekTypes: ["recovery", "post_competition"],
    canDevelopQualities: false,
    recoveryPriority: "primary",
    explanation: "Переходное восстановление: сначала восстановление и разбор, потом новый цикл.",
  },
];

export const CONSTRUCTOR_PHASE_MATRIX_RULES: ConstructorPhaseMatrixRule[] =
  CONSTRUCTOR_PHASE_MATRIX_RULE_DEFINITIONS.map(withPhaseEvidence);

const CONSTRUCTOR_WEEK_MATRIX_RULE_DEFINITIONS: Array<
  ConstructorMatrixRuleWithoutEvidence<ConstructorWeekMatrixRule>
> = [
  {
    weekType: "development",
    phases: ["general_preparation", "special_preparation"],
    loadLevel: "high",
    matVolumeLevel: "high",
    canUseSPP: true,
    canUseGPP: true,
    canDevelopQualities: true,
    canUseHeavyStrength: true,
    canUseHeavyLegLmv: true,
    canUseControlBouts: true,
    recoveryPriority: "support",
    explanation: "Развивающая неделя допустима далеко от главного старта.",
  },
  {
    weekType: "maintenance",
    phases: ["general_preparation", "special_preparation", "special_pre_competition"],
    loadLevel: "medium",
    matVolumeLevel: "medium",
    canUseSPP: true,
    canUseGPP: true,
    canDevelopQualities: false,
    canUseHeavyStrength: false,
    canUseHeavyLegLmv: false,
    canUseControlBouts: false,
    recoveryPriority: "mandatory",
    explanation: "Поддерживающая неделя сохраняет качества без добора объёма.",
  },
  {
    weekType: "special",
    phases: ["special_preparation", "special_pre_competition"],
    loadLevel: "medium",
    matVolumeLevel: "high",
    canUseSPP: true,
    canUseGPP: false,
    canDevelopQualities: false,
    canUseHeavyStrength: false,
    canUseHeavyLegLmv: false,
    canUseControlBouts: true,
    recoveryPriority: "mandatory",
    explanation: "Специальная неделя переносит СФП и качество в борьбу.",
  },
  {
    weekType: "pre_competition",
    phases: ["special_pre_competition"],
    loadLevel: "medium",
    matVolumeLevel: "medium",
    canUseSPP: true,
    canUseGPP: false,
    canDevelopQualities: false,
    canUseHeavyStrength: false,
    canUseHeavyLegLmv: false,
    canUseControlBouts: true,
    recoveryPriority: "mandatory",
    explanation: "Предсоревновательная неделя работает через перенос, а не развитие.",
  },
  {
    weekType: "deload",
    phases: ["general_preparation", "special_preparation", "special_pre_competition", "direct_pre_competition"],
    loadLevel: "low",
    matVolumeLevel: "low",
    canUseSPP: false,
    canUseGPP: true,
    canDevelopQualities: false,
    canUseHeavyStrength: false,
    canUseHeavyLegLmv: false,
    canUseControlBouts: false,
    recoveryPriority: "primary",
    explanation: "Разгрузка снимает накопленную усталость и даёт смену обстановки.",
  },
  {
    weekType: "taper",
    phases: ["direct_pre_competition", "taper"],
    loadLevel: "low",
    matVolumeLevel: "low",
    canUseSPP: false,
    canUseGPP: false,
    canDevelopQualities: false,
    canUseHeavyStrength: false,
    canUseHeavyLegLmv: false,
    canUseControlBouts: false,
    recoveryPriority: "primary",
    explanation: "Подводящая неделя сохраняет свежесть, вес и короткую техническую уверенность.",
  },
  {
    weekType: "competition",
    phases: ["competition"],
    loadLevel: "low",
    matVolumeLevel: "low",
    canUseSPP: false,
    canUseGPP: false,
    canDevelopQualities: false,
    canUseHeavyStrength: false,
    canUseHeavyLegLmv: false,
    canUseControlBouts: false,
    recoveryPriority: "primary",
    explanation: "Соревновательная неделя подчинена старту, дороге, взвешиванию и восстановлению.",
  },
  {
    weekType: "recovery",
    phases: ["transition_recovery"],
    loadLevel: "low",
    matVolumeLevel: "none",
    canUseSPP: false,
    canUseGPP: true,
    canDevelopQualities: false,
    canUseHeavyStrength: false,
    canUseHeavyLegLmv: false,
    canUseControlBouts: false,
    recoveryPriority: "primary",
    explanation: "Восстановительная неделя не развивает качества.",
  },
  {
    weekType: "travel_logistics",
    phases: ["direct_pre_competition", "taper", "competition"],
    loadLevel: "low",
    matVolumeLevel: "none",
    canUseSPP: false,
    canUseGPP: false,
    canDevelopQualities: false,
    canUseHeavyStrength: false,
    canUseHeavyLegLmv: false,
    canUseControlBouts: false,
    recoveryPriority: "primary",
    explanation: "Логистика ограничивает тренировочный потолок и требует восстановления.",
  },
  {
    weekType: "post_competition",
    phases: ["transition_recovery"],
    loadLevel: "low",
    matVolumeLevel: "none",
    canUseSPP: false,
    canUseGPP: true,
    canDevelopQualities: false,
    canUseHeavyStrength: false,
    canUseHeavyLegLmv: false,
    canUseControlBouts: false,
    recoveryPriority: "primary",
    explanation: "После старта нужны восстановление, разбор и мягкий возврат к режиму.",
  },
];

export const CONSTRUCTOR_WEEK_MATRIX_RULES: ConstructorWeekMatrixRule[] =
  CONSTRUCTOR_WEEK_MATRIX_RULE_DEFINITIONS.map(withWeekEvidence);

const CONSTRUCTOR_DAY_MATRIX_RULE_DEFINITIONS: Array<
  ConstructorMatrixRuleWithoutEvidence<ConstructorDayMatrixRule>
> = [
  {
    dayType: "heavy_training",
    allowedWeekTypes: ["development"],
    loadLevel: "high",
    matVolumeLevel: "high",
    allowedSessionSlots: ["morning", "evening"],
    maxSessions: 2,
    canUseSPP: true,
    canUseGPP: true,
    canDevelopQualities: true,
    canUseHeavyStrength: true,
    canUseHeavyLegLmv: true,
    canUseSpeed: true,
    canUseControlBouts: true,
    recoveryPriority: "support",
    explanation: "Тяжёлый день допустим только далеко от главного старта.",
  },
  {
    dayType: "medium_training",
    allowedWeekTypes: ["development", "maintenance", "special", "pre_competition"],
    loadLevel: "medium",
    matVolumeLevel: "medium",
    allowedSessionSlots: ["morning", "evening"],
    maxSessions: 2,
    canUseSPP: true,
    canUseGPP: true,
    canDevelopQualities: false,
    canUseHeavyStrength: false,
    canUseHeavyLegLmv: false,
    canUseSpeed: true,
    canUseControlBouts: false,
    recoveryPriority: "mandatory",
    explanation: "Средний день держит специальную работу без тяжёлого развития.",
  },
  {
    dayType: "light_training",
    allowedWeekTypes: ["maintenance", "pre_competition", "deload", "taper", "competition"],
    loadLevel: "low",
    matVolumeLevel: "low",
    allowedSessionSlots: ["morning"],
    maxSessions: 1,
    canUseSPP: false,
    canUseGPP: true,
    canDevelopQualities: false,
    canUseHeavyStrength: false,
    canUseHeavyLegLmv: false,
    canUseSpeed: true,
    canUseControlBouts: false,
    recoveryPriority: "primary",
    explanation: "Лёгкий день сохраняет тонус и не добирает утомление.",
  },
  {
    dayType: "technical",
    allowedWeekTypes: ["development", "maintenance", "special", "pre_competition", "taper", "competition"],
    loadLevel: "low",
    matVolumeLevel: "low",
    allowedSessionSlots: ["morning", "evening"],
    maxSessions: 2,
    canUseSPP: false,
    canUseGPP: false,
    canDevelopQualities: false,
    canUseHeavyStrength: false,
    canUseHeavyLegLmv: false,
    canUseSpeed: true,
    canUseControlBouts: false,
    recoveryPriority: "mandatory",
    explanation: "Технический день работает на качество и уверенность.",
  },
  {
    dayType: "competition_model",
    allowedWeekTypes: ["development", "special", "pre_competition"],
    loadLevel: "medium",
    matVolumeLevel: "high",
    allowedSessionSlots: ["morning"],
    maxSessions: 1,
    canUseSPP: false,
    canUseGPP: false,
    canDevelopQualities: false,
    canUseHeavyStrength: false,
    canUseHeavyLegLmv: false,
    canUseSpeed: true,
    canUseControlBouts: true,
    recoveryPriority: "mandatory",
    explanation: "Модель борьбы допустима до подводки и требует восстановления.",
  },
  {
    dayType: "mat_day",
    allowedWeekTypes: ["development", "maintenance", "special", "pre_competition", "taper"],
    loadLevel: "medium",
    matVolumeLevel: "medium",
    allowedSessionSlots: ["morning", "evening"],
    maxSessions: 2,
    canUseSPP: false,
    canUseGPP: false,
    canDevelopQualities: false,
    canUseHeavyStrength: false,
    canUseHeavyLegLmv: false,
    canUseSpeed: true,
    canUseControlBouts: false,
    recoveryPriority: "mandatory",
    explanation: "Ковровый день нужен для техники и переноса, но объём задаётся фазой.",
  },
  {
    dayType: "spp_day",
    allowedWeekTypes: ["development", "maintenance", "special", "pre_competition"],
    loadLevel: "medium",
    matVolumeLevel: "low",
    allowedSessionSlots: ["morning", "evening"],
    maxSessions: 2,
    canUseSPP: true,
    canUseGPP: false,
    canDevelopQualities: false,
    canUseHeavyStrength: false,
    canUseHeavyLegLmv: false,
    canUseSpeed: true,
    canUseControlBouts: false,
    recoveryPriority: "mandatory",
    explanation: "СФП-день поддерживает перенос в борьбу и не должен быть тяжёлым перед стартом.",
  },
  {
    dayType: "gpp_day",
    allowedWeekTypes: ["development", "maintenance", "deload", "recovery", "post_competition"],
    loadLevel: "medium",
    matVolumeLevel: "none",
    allowedSessionSlots: ["morning"],
    maxSessions: 1,
    canUseSPP: false,
    canUseGPP: true,
    canDevelopQualities: true,
    canUseHeavyStrength: false,
    canUseHeavyLegLmv: false,
    canUseSpeed: false,
    canUseControlBouts: false,
    recoveryPriority: "support",
    explanation: "ОФП применяется далеко от старта или как смена обстановки.",
  },
  {
    dayType: "half_day",
    allowedWeekTypes: ["maintenance", "special", "pre_competition", "deload", "taper"],
    loadLevel: "low",
    matVolumeLevel: "low",
    allowedSessionSlots: ["morning"],
    maxSessions: 1,
    canUseSPP: false,
    canUseGPP: true,
    canDevelopQualities: false,
    canUseHeavyStrength: false,
    canUseHeavyLegLmv: false,
    canUseSpeed: false,
    canUseControlBouts: false,
    recoveryPriority: "primary",
    explanation: "Половинчатый день снимает накопленную усталость после плотных дней.",
  },
  {
    dayType: "environment_change",
    allowedWeekTypes: ["deload", "recovery", "post_competition"],
    loadLevel: "low",
    matVolumeLevel: "none",
    allowedSessionSlots: ["morning"],
    maxSessions: 1,
    canUseSPP: false,
    canUseGPP: true,
    canDevelopQualities: false,
    canUseHeavyStrength: false,
    canUseHeavyLegLmv: false,
    canUseSpeed: false,
    canUseControlBouts: false,
    recoveryPriority: "primary",
    explanation: "Смена обстановки разгружает психологически и физически.",
  },
  {
    dayType: "recovery",
    allowedWeekTypes: ["maintenance", "deload", "taper", "competition", "recovery", "post_competition"],
    loadLevel: "low",
    matVolumeLevel: "none",
    allowedSessionSlots: ["morning", "evening"],
    maxSessions: 1,
    canUseSPP: false,
    canUseGPP: false,
    canDevelopQualities: false,
    canUseHeavyStrength: false,
    canUseHeavyLegLmv: false,
    canUseSpeed: false,
    canUseControlBouts: false,
    recoveryPriority: "primary",
    explanation: "Восстановление является частью плана, а не пустым днём.",
  },
  {
    dayType: "sauna_recovery",
    allowedWeekTypes: ["deload", "taper", "competition", "recovery"],
    loadLevel: "low",
    matVolumeLevel: "none",
    allowedSessionSlots: ["morning", "evening"],
    maxSessions: 1,
    canUseSPP: false,
    canUseGPP: false,
    canDevelopQualities: false,
    canUseHeavyStrength: false,
    canUseHeavyLegLmv: false,
    canUseSpeed: false,
    canUseControlBouts: false,
    recoveryPriority: "primary",
    explanation: "Сауна и процедуры ставятся только как восстановление и контроль веса.",
  },
  {
    dayType: "travel",
    allowedWeekTypes: ["travel_logistics", "competition", "taper"],
    loadLevel: "low",
    matVolumeLevel: "none",
    allowedSessionSlots: ["morning"],
    maxSessions: 1,
    canUseSPP: false,
    canUseGPP: false,
    canDevelopQualities: false,
    canUseHeavyStrength: false,
    canUseHeavyLegLmv: false,
    canUseSpeed: false,
    canUseControlBouts: false,
    recoveryPriority: "primary",
    explanation: "Дорога запрещает тяжёлую нагрузку; допустимы мобилити и лёгкая активация.",
  },
  {
    dayType: "weigh_in",
    allowedWeekTypes: ["competition", "travel_logistics", "taper"],
    loadLevel: "low",
    matVolumeLevel: "none",
    allowedSessionSlots: ["morning"],
    maxSessions: 1,
    canUseSPP: false,
    canUseGPP: false,
    canDevelopQualities: false,
    canUseHeavyStrength: false,
    canUseHeavyLegLmv: false,
    canUseSpeed: true,
    canUseControlBouts: false,
    recoveryPriority: "primary",
    explanation: "Взвешивание подчиняет день весу, воде, питанию и свежести.",
  },
  {
    dayType: "competition",
    allowedWeekTypes: ["competition"],
    loadLevel: "high",
    matVolumeLevel: "high",
    allowedSessionSlots: ["morning"],
    maxSessions: 1,
    canUseSPP: false,
    canUseGPP: false,
    canDevelopQualities: false,
    canUseHeavyStrength: false,
    canUseHeavyLegLmv: false,
    canUseSpeed: true,
    canUseControlBouts: false,
    recoveryPriority: "primary",
    explanation: "День старта подчинён соревнованию, а не тренировочному добору.",
  },
  {
    dayType: "post_competition",
    allowedWeekTypes: ["post_competition", "recovery"],
    loadLevel: "low",
    matVolumeLevel: "none",
    allowedSessionSlots: ["morning"],
    maxSessions: 1,
    canUseSPP: false,
    canUseGPP: true,
    canDevelopQualities: false,
    canUseHeavyStrength: false,
    canUseHeavyLegLmv: false,
    canUseSpeed: false,
    canUseControlBouts: false,
    recoveryPriority: "primary",
    explanation: "После старта сначала восстановление и анализ.",
  },
];

export const CONSTRUCTOR_DAY_MATRIX_RULES: ConstructorDayMatrixRule[] =
  CONSTRUCTOR_DAY_MATRIX_RULE_DEFINITIONS.map(withDayEvidence);

const CONSTRUCTOR_TRAINING_BLOCK_DEFINITIONS: Array<
  ConstructorMatrixRuleWithoutEvidence<ConstructorTrainingBlockDefinition>
> = [
  {
    type: "mat_technique",
    blockType: "technical",
    targetQuality: "fatigue_skill",
    label: "Ковёр: техника",
    allowedPhases: ["general_preparation", "special_preparation", "special_pre_competition", "direct_pre_competition", "taper", "competition"],
    allowedWeekTypes: ["development", "maintenance", "special", "pre_competition", "deload", "taper", "competition"],
    allowedDayTypes: ["heavy_training", "medium_training", "light_training", "technical", "mat_day", "half_day"],
    allowedSessionSlots: ["morning", "evening"],
    minDaysUntilStartForMainStart: null,
    loadLevel: "medium",
    matVolumeLevel: "medium",
    developsQuality: false,
    usesSPP: false,
    usesGPP: false,
    usesHeavyStrength: false,
    usesHeavyLegLmv: false,
    usesControlBouts: false,
    riskTags: ["glycolytic_recovery_conflict"],
    forbiddenCombinations: ["leg_lmv"],
    explanation: "Техника разрешена широко, но близко к старту объём должен быть лёгким.",
  },
  {
    type: "mat_tactics",
    blockType: "technical",
    targetQuality: "fatigue_skill",
    label: "Ковёр: тактика",
    allowedPhases: ["special_preparation", "special_pre_competition", "direct_pre_competition", "taper"],
    allowedWeekTypes: ["special", "pre_competition", "taper"],
    allowedDayTypes: ["technical", "mat_day", "light_training"],
    allowedSessionSlots: ["morning", "evening"],
    minDaysUntilStartForMainStart: null,
    loadLevel: "low",
    matVolumeLevel: "low",
    developsQuality: false,
    usesSPP: false,
    usesGPP: false,
    usesHeavyStrength: false,
    usesHeavyLegLmv: false,
    usesControlBouts: false,
    riskTags: [],
    forbiddenCombinations: ["mat_control_bouts"],
    explanation: "Тактика уточняет решения без добора плотности.",
  },
  {
    type: "mat_competition_model",
    blockType: "technical",
    targetQuality: "wrestling_contact_density",
    label: "Ковёр: соревновательная модель",
    allowedPhases: ["special_preparation", "special_pre_competition"],
    allowedWeekTypes: ["development", "special", "pre_competition"],
    allowedDayTypes: ["competition_model", "mat_day"],
    allowedSessionSlots: ["morning"],
    minDaysUntilStartForMainStart: 10,
    loadLevel: "medium",
    matVolumeLevel: "high",
    developsQuality: false,
    usesSPP: false,
    usesGPP: false,
    usesHeavyStrength: false,
    usesHeavyLegLmv: false,
    usesControlBouts: false,
    riskTags: ["glycolytic_recovery_conflict"],
    forbiddenCombinations: ["leg_lmv", "mat_control_bouts"],
    explanation: "Модель борьбы проверяет перенос, но не ставится слишком близко к главному старту.",
  },
  {
    type: "mat_control_bouts",
    blockType: "technical",
    targetQuality: "wrestling_contact_density",
    label: "Ковёр: контрольные схватки",
    allowedPhases: ["general_preparation", "special_preparation", "special_pre_competition"],
    allowedWeekTypes: ["development", "special", "pre_competition"],
    allowedDayTypes: ["heavy_training", "competition_model"],
    allowedSessionSlots: ["morning"],
    minDaysUntilStartForMainStart: 14,
    loadLevel: "high",
    matVolumeLevel: "high",
    developsQuality: false,
    usesSPP: false,
    usesGPP: false,
    usesHeavyStrength: false,
    usesHeavyLegLmv: false,
    usesControlBouts: true,
    riskTags: ["glycolytic_recovery_conflict"],
    forbiddenCombinations: ["leg_lmv", "spp"],
    explanation: "Контрольные схватки дают контактный стресс и ограничиваются перед главным стартом.",
  },
  {
    type: "mat_light_technical",
    blockType: "technical",
    targetQuality: "taper_quality",
    label: "Ковёр: лёгкая техническая работа",
    allowedPhases: ["special_pre_competition", "direct_pre_competition", "taper", "competition"],
    allowedWeekTypes: ["pre_competition", "deload", "taper", "competition"],
    allowedDayTypes: ["light_training", "technical", "half_day", "weigh_in"],
    allowedSessionSlots: ["morning"],
    minDaysUntilStartForMainStart: null,
    loadLevel: "low",
    matVolumeLevel: "low",
    developsQuality: false,
    usesSPP: false,
    usesGPP: false,
    usesHeavyStrength: false,
    usesHeavyLegLmv: false,
    usesControlBouts: false,
    riskTags: [],
    forbiddenCombinations: ["leg_lmv", "mat_control_bouts", "mat_competition_model"],
    explanation: "Лёгкая техника поддерживает уверенность без накопления усталости.",
  },
  {
    type: "spp",
    blockType: "strength",
    targetQuality: "fatigue_skill",
    label: "СФП: поддержание и перенос",
    allowedPhases: ["general_preparation", "special_preparation", "special_pre_competition"],
    allowedWeekTypes: ["development", "maintenance", "special", "pre_competition"],
    allowedDayTypes: ["medium_training", "spp_day"],
    allowedSessionSlots: ["morning", "evening"],
    minDaysUntilStartForMainStart: 15,
    loadLevel: "medium",
    matVolumeLevel: "none",
    developsQuality: false,
    usesSPP: true,
    usesGPP: false,
    usesHeavyStrength: false,
    usesHeavyLegLmv: false,
    usesControlBouts: false,
    riskTags: ["heavy_legs_sprint_conflict"],
    forbiddenCombinations: ["mat_control_bouts"],
    explanation: "СФП в предсоревновательной фазе работает как поддержание и перенос, не как развитие.",
  },
  {
    type: "gpp",
    blockType: "conditioning",
    targetQuality: "aerobic_base",
    label: "ОФП",
    allowedPhases: ["general_preparation", "special_preparation", "transition_recovery"],
    allowedWeekTypes: ["development", "maintenance", "deload", "recovery", "post_competition"],
    allowedDayTypes: ["gpp_day", "environment_change", "post_competition"],
    allowedSessionSlots: ["morning"],
    minDaysUntilStartForMainStart: 31,
    loadLevel: "medium",
    matVolumeLevel: "none",
    developsQuality: true,
    usesSPP: false,
    usesGPP: true,
    usesHeavyStrength: false,
    usesHeavyLegLmv: false,
    usesControlBouts: false,
    riskTags: [],
    forbiddenCombinations: ["mat_control_bouts"],
    explanation: "ОФП развивает базу далеко от старта или используется мягко после старта.",
  },
  {
    type: "leg_lmv",
    blockType: "metabolic",
    targetQuality: "legs_lme",
    label: "ЛМВ ног",
    allowedPhases: ["general_preparation", "special_preparation"],
    allowedWeekTypes: ["development"],
    allowedDayTypes: ["heavy_training", "gpp_day"],
    allowedSessionSlots: ["morning"],
    minDaysUntilStartForMainStart: 31,
    loadLevel: "high",
    matVolumeLevel: "none",
    developsQuality: true,
    usesSPP: true,
    usesGPP: false,
    usesHeavyStrength: false,
    usesHeavyLegLmv: true,
    usesControlBouts: false,
    riskTags: ["heavy_legs_sprint_conflict"],
    forbiddenCombinations: ["first_action_speed", "mat_competition_model", "mat_control_bouts"],
    explanation: "Тяжёлая ЛМВ ног является развивающим блоком и не ставится перед главным стартом.",
  },
  {
    type: "first_action_speed",
    blockType: "speed",
    targetQuality: "speed_first_action",
    label: "Резкость первого действия",
    allowedPhases: ["general_preparation", "special_preparation", "special_pre_competition", "direct_pre_competition", "taper"],
    allowedWeekTypes: ["development", "special", "pre_competition", "taper"],
    allowedDayTypes: ["medium_training", "technical", "light_training"],
    allowedSessionSlots: ["morning"],
    minDaysUntilStartForMainStart: 5,
    loadLevel: "low",
    matVolumeLevel: "none",
    developsQuality: false,
    usesSPP: false,
    usesGPP: false,
    usesHeavyStrength: false,
    usesHeavyLegLmv: false,
    usesControlBouts: false,
    riskTags: ["heavy_legs_sprint_conflict"],
    forbiddenCombinations: ["leg_lmv"],
    explanation: "Перед стартом это короткая активация резкости, а не развитие скорости.",
  },
  {
    type: "aerobic_deload",
    blockType: "conditioning",
    targetQuality: "aerobic_base",
    label: "Аэробная разгрузка",
    allowedPhases: ["general_preparation", "special_preparation", "special_pre_competition", "direct_pre_competition", "taper", "transition_recovery"],
    allowedWeekTypes: ["maintenance", "deload", "taper", "recovery", "post_competition"],
    allowedDayTypes: ["half_day", "environment_change", "recovery", "post_competition"],
    allowedSessionSlots: ["morning"],
    minDaysUntilStartForMainStart: null,
    loadLevel: "low",
    matVolumeLevel: "none",
    developsQuality: false,
    usesSPP: false,
    usesGPP: true,
    usesHeavyStrength: false,
    usesHeavyLegLmv: false,
    usesControlBouts: false,
    riskTags: [],
    forbiddenCombinations: ["mat_control_bouts"],
    explanation: "Аэробная разгрузка помогает восстановлению и смене обстановки.",
  },
  {
    type: "mobility",
    blockType: "mobility",
    targetQuality: "recovery",
    label: "Мобилити",
    allowedPhases: ["general_preparation", "special_preparation", "special_pre_competition", "direct_pre_competition", "taper", "competition", "transition_recovery"],
    allowedWeekTypes: ["development", "maintenance", "special", "pre_competition", "deload", "taper", "competition", "recovery", "travel_logistics", "post_competition"],
    allowedDayTypes: ["light_training", "half_day", "environment_change", "recovery", "sauna_recovery", "travel", "weigh_in", "post_competition"],
    allowedSessionSlots: ["morning", "evening"],
    minDaysUntilStartForMainStart: null,
    loadLevel: "low",
    matVolumeLevel: "none",
    developsQuality: false,
    usesSPP: false,
    usesGPP: false,
    usesHeavyStrength: false,
    usesHeavyLegLmv: false,
    usesControlBouts: false,
    riskTags: [],
    forbiddenCombinations: [],
    explanation: "Мобилити разрешена как безопасная поддержка восстановления.",
  },
  {
    type: "recovery",
    blockType: "recovery",
    targetQuality: "recovery",
    label: "Восстановление",
    allowedPhases: ["general_preparation", "special_preparation", "special_pre_competition", "direct_pre_competition", "taper", "competition", "transition_recovery"],
    allowedWeekTypes: ["development", "maintenance", "special", "pre_competition", "deload", "taper", "competition", "recovery", "travel_logistics", "post_competition"],
    allowedDayTypes: ["light_training", "half_day", "environment_change", "recovery", "sauna_recovery", "travel", "weigh_in", "post_competition"],
    allowedSessionSlots: ["morning", "evening"],
    minDaysUntilStartForMainStart: null,
    loadLevel: "low",
    matVolumeLevel: "none",
    developsQuality: false,
    usesSPP: false,
    usesGPP: false,
    usesHeavyStrength: false,
    usesHeavyLegLmv: false,
    usesControlBouts: false,
    riskTags: [],
    forbiddenCombinations: [],
    explanation: "Восстановление приоритетно при риске, подводке и после старта.",
  },
  {
    type: "sauna",
    blockType: "recovery",
    targetQuality: "weight_management",
    label: "Сауна / восстановительные процедуры",
    allowedPhases: ["special_pre_competition", "direct_pre_competition", "taper", "competition", "transition_recovery"],
    allowedWeekTypes: ["deload", "taper", "competition", "recovery"],
    allowedDayTypes: ["sauna_recovery", "half_day", "recovery"],
    allowedSessionSlots: ["morning", "evening"],
    minDaysUntilStartForMainStart: null,
    loadLevel: "low",
    matVolumeLevel: "none",
    developsQuality: false,
    usesSPP: false,
    usesGPP: false,
    usesHeavyStrength: false,
    usesHeavyLegLmv: false,
    usesControlBouts: false,
    riskTags: ["weight_gap"],
    forbiddenCombinations: ["leg_lmv", "mat_control_bouts"],
    explanation: "Сауна используется как восстановление и контроль веса, а не как нагрузка.",
  },
  {
    type: "environment_change",
    blockType: "conditioning",
    targetQuality: "recovery",
    label: "Смена обстановки",
    allowedPhases: ["general_preparation", "special_preparation", "special_pre_competition", "direct_pre_competition", "transition_recovery"],
    allowedWeekTypes: ["deload", "recovery", "post_competition"],
    allowedDayTypes: ["environment_change", "half_day", "post_competition"],
    allowedSessionSlots: ["morning"],
    minDaysUntilStartForMainStart: null,
    loadLevel: "low",
    matVolumeLevel: "none",
    developsQuality: false,
    usesSPP: false,
    usesGPP: true,
    usesHeavyStrength: false,
    usesHeavyLegLmv: false,
    usesControlBouts: false,
    riskTags: [],
    forbiddenCombinations: ["mat_control_bouts"],
    explanation: "Смена обстановки снижает ковровое и психологическое напряжение.",
  },
  {
    type: "travel",
    blockType: "recovery",
    targetQuality: "recovery",
    label: "Дорога",
    allowedPhases: ["direct_pre_competition", "taper", "competition"],
    allowedWeekTypes: ["travel_logistics", "competition", "taper"],
    allowedDayTypes: ["travel"],
    allowedSessionSlots: ["morning"],
    minDaysUntilStartForMainStart: null,
    loadLevel: "low",
    matVolumeLevel: "none",
    developsQuality: false,
    usesSPP: false,
    usesGPP: false,
    usesHeavyStrength: false,
    usesHeavyLegLmv: false,
    usesControlBouts: false,
    riskTags: ["travel_fatigue"],
    forbiddenCombinations: ["leg_lmv", "mat_control_bouts", "mat_competition_model", "spp"],
    explanation: "День дороги снижает потолок нагрузки.",
  },
  {
    type: "weigh_in",
    blockType: "activation",
    targetQuality: "weight_management",
    label: "Взвешивание и короткая активация",
    allowedPhases: ["competition", "taper"],
    allowedWeekTypes: ["competition", "travel_logistics", "taper"],
    allowedDayTypes: ["weigh_in"],
    allowedSessionSlots: ["morning"],
    minDaysUntilStartForMainStart: null,
    loadLevel: "low",
    matVolumeLevel: "none",
    developsQuality: false,
    usesSPP: false,
    usesGPP: false,
    usesHeavyStrength: false,
    usesHeavyLegLmv: false,
    usesControlBouts: false,
    riskTags: ["weight_gap"],
    forbiddenCombinations: ["leg_lmv", "mat_control_bouts", "mat_competition_model", "spp"],
    explanation: "Взвешивание требует контроля веса, воды, питания и короткой активации.",
  },
  {
    type: "competition_start",
    blockType: "activation",
    targetQuality: "taper_quality",
    label: "Старт",
    allowedPhases: ["competition"],
    allowedWeekTypes: ["competition"],
    allowedDayTypes: ["competition"],
    allowedSessionSlots: ["morning"],
    minDaysUntilStartForMainStart: null,
    loadLevel: "high",
    matVolumeLevel: "high",
    developsQuality: false,
    usesSPP: false,
    usesGPP: false,
    usesHeavyStrength: false,
    usesHeavyLegLmv: false,
    usesControlBouts: false,
    riskTags: [],
    forbiddenCombinations: ["leg_lmv", "mat_control_bouts", "spp", "gpp"],
    explanation: "В день старта нагрузка задаётся соревнованием.",
  },
  {
    type: "post_competition_recovery",
    blockType: "recovery",
    targetQuality: "recovery",
    label: "Восстановление после старта",
    allowedPhases: ["transition_recovery"],
    allowedWeekTypes: ["post_competition", "recovery"],
    allowedDayTypes: ["post_competition", "recovery"],
    allowedSessionSlots: ["morning", "evening"],
    minDaysUntilStartForMainStart: null,
    loadLevel: "low",
    matVolumeLevel: "none",
    developsQuality: false,
    usesSPP: false,
    usesGPP: false,
    usesHeavyStrength: false,
    usesHeavyLegLmv: false,
    usesControlBouts: false,
    riskTags: [],
    forbiddenCombinations: ["leg_lmv", "mat_control_bouts", "mat_competition_model", "spp"],
    explanation: "После старта система должна восстановить спортсмена и собрать выводы.",
  },
];

export const CONSTRUCTOR_TRAINING_BLOCK_LIBRARY: ConstructorTrainingBlockDefinition[] =
  CONSTRUCTOR_TRAINING_BLOCK_DEFINITIONS.map(withTrainingBlockEvidence);

export const CONSTRUCTOR_TEMPLATE_CARD_COMPATIBILITY: ConstructorTemplateCardCompatibility[] = [
  {
    cardId: "pre_competition_21",
    trainingBlockTypes: ["mat_technique", "mat_competition_model", "spp", "first_action_speed", "recovery", "sauna"],
    controlsGeneration: false,
    explanation: "Старая карточка 21 дня становится источником предсоревновательных блоков, но не управляет неделями.",
  },
  {
    cardId: "speed_first_action_14",
    trainingBlockTypes: ["first_action_speed", "mat_light_technical", "recovery"],
    controlsGeneration: false,
    explanation: "Карточка скорости первого действия используется как источник активации резкости.",
  },
  {
    cardId: "legs_lme_21",
    trainingBlockTypes: ["leg_lmv", "spp", "recovery"],
    controlsGeneration: false,
    explanation: "Карточка ЛМВ ног классифицируется как развивающий/СФП источник, не как план перед главным стартом.",
  },
  {
    cardId: "arms_grip_21",
    trainingBlockTypes: ["spp", "recovery"],
    controlsGeneration: false,
    explanation: "Карточка хвата временно относится к СФП-библиотеке до отдельной детализации хвата.",
  },
  {
    cardId: "taper_10",
    trainingBlockTypes: ["mat_light_technical", "first_action_speed", "recovery", "sauna", "weigh_in"],
    controlsGeneration: false,
    explanation: "Taper-карточка даёт лёгкие блоки подводки, но не задаёт длину и структуру плана.",
  },
  {
    cardId: "recovery_7",
    trainingBlockTypes: ["recovery", "mobility", "aerobic_deload", "environment_change", "post_competition_recovery"],
    controlsGeneration: false,
    explanation: "Recovery-карточка становится источником восстановительных блоков.",
  },
];

function hasValue<T>(values: readonly T[], value: T) {
  return values.includes(value);
}

function normalizedDaysUntilStart(context: ConstructorMatrixContext) {
  const days = context.daysUntilStart;

  return typeof days === "number" && Number.isFinite(days) ? Math.round(days) : null;
}

function isMainStartContext(context: ConstructorMatrixContext) {
  return context.isMainStart === true || context.competitionRole === "main_peak";
}

function getWeekRule(weekType: ConstructorWeekType) {
  return CONSTRUCTOR_WEEK_MATRIX_RULES.find((rule) => rule.weekType === weekType);
}

function getDayRule(dayType: ConstructorDayType) {
  return CONSTRUCTOR_DAY_MATRIX_RULES.find((rule) => rule.dayType === dayType);
}

function evidenceForEligibilityReason(params: {
  reason: ConstructorBlockEligibilityRule;
  block: ConstructorTrainingBlockDefinition;
  weekRule?: ConstructorWeekMatrixRule;
  dayRule?: ConstructorDayMatrixRule;
}): ConstructorMatrixEvidenceDependencyId[] {
  const base = [
    ...params.block.evidenceDependencies,
    ...(params.weekRule?.evidenceDependencies ?? []),
    ...(params.dayRule?.evidenceDependencies ?? []),
  ];

  switch (params.reason.code) {
    case "development_forbidden_before_main_start":
    case "taper_development_mix":
    case "week_development_forbidden":
    case "day_development_forbidden":
      return evidence([...base, "europe_pre_competition_plan", "periodization_taper_peaking"]);
    case "heavy_leg_lmv_too_close":
      return evidence([...base, "bfr_kaatsu_local_metabolic", "china_bfr_half_squat_wrestlers"]);
    case "mat_volume_too_high_close_to_start":
    case "control_bouts_too_close":
    case "control_bouts_not_allowed":
      return evidence([...base, "wrestling_temporal_structure", "europe_pre_competition_plan"]);
    case "heavy_load_on_travel_day":
      return evidence([...base, "europe_pre_competition_plan", "acsm_hydration_nutrition"]);
    case "heavy_load_on_weigh_in_day":
      return evidence([...base, "ncaa_weight_management", "acsm_hydration_nutrition"]);
    default:
      return evidence(base);
  }
}

export function getWeekTypeForContext(context: ConstructorMatrixContext): ConstructorWeekType {
  const days = normalizedDaysUntilStart(context);

  if (context.isPostCompetitionDay || context.preparationPhase === "transition_recovery") {
    return "post_competition";
  }

  if (context.isTravelDay) {
    return "travel_logistics";
  }

  if (context.isCompetitionDay || context.preparationPhase === "competition" || (isMainStartContext(context) && days !== null && days <= 4)) {
    return "competition";
  }

  if (context.preparationPhase === "taper" || context.preparationPhase === "direct_pre_competition") {
    return "taper";
  }

  if (context.preparationPhase === "special_pre_competition") {
    return "pre_competition";
  }

  if (context.preparationPhase === "special_preparation") {
    return isMainStartContext(context) && days !== null && days <= 60 ? "special" : "maintenance";
  }

  return "development";
}

export function getDayTypeForContext(context: ConstructorMatrixContext): ConstructorDayType {
  if (context.dayType) {
    return context.dayType;
  }

  const days = normalizedDaysUntilStart(context);
  const weekType = context.weekType ?? getWeekTypeForContext(context);

  if (context.isPostCompetitionDay) {
    return "post_competition";
  }

  if (context.isCompetitionDay || (context.preparationPhase === "competition" && days !== null && days <= 0)) {
    return "competition";
  }

  if (context.isWeighInDay) {
    return "weigh_in";
  }

  if (context.isTravelDay) {
    return "travel";
  }

  if (weekType === "competition") {
    return "light_training";
  }

  if (weekType === "taper") {
    return "light_training";
  }

  if (weekType === "deload" || weekType === "recovery") {
    return "recovery";
  }

  if (weekType === "post_competition") {
    return "post_competition";
  }

  if (weekType === "pre_competition" || weekType === "special") {
    return "medium_training";
  }

  return "medium_training";
}

export function getAllowedSessionSlots(context: ConstructorMatrixContext): ConstructorSessionSlot[] {
  const dayType = getDayTypeForContext(context);
  const rule = getDayRule(dayType);

  return rule ? [...rule.allowedSessionSlots] : ["morning"];
}

export function getForbiddenBlockReasons(
  block: ConstructorTrainingBlockDefinition,
  context: ConstructorMatrixContext,
): ConstructorBlockEligibilityRule[] {
  const reasons: ConstructorBlockEligibilityRule[] = [];
  const weekType = context.weekType ?? getWeekTypeForContext(context);
  const dayType = context.dayType ?? getDayTypeForContext({ ...context, weekType });
  const sessionSlot = context.sessionSlot ?? "morning";
  const days = normalizedDaysUntilStart(context);
  const mainStart = isMainStartContext(context);
  const weekRule = getWeekRule(weekType);
  const dayRule = getDayRule(dayType);

  if (!hasValue(block.allowedPhases, context.preparationPhase)) {
    reasons.push({
      code: "phase_not_allowed",
      message: `${block.label} не разрешён в фазе ${context.preparationPhase}.`,
    });
  }

  if (!hasValue(block.allowedWeekTypes, weekType)) {
    reasons.push({
      code: "week_type_not_allowed",
      message: `${block.label} не подходит для недели ${weekType}.`,
    });
  }

  if (!hasValue(block.allowedDayTypes, dayType)) {
    reasons.push({
      code: "day_type_not_allowed",
      message: `${block.label} не подходит для дня ${dayType}.`,
    });
  }

  if (!hasValue(block.allowedSessionSlots, sessionSlot)) {
    reasons.push({
      code: "session_slot_not_allowed",
      message: `${block.label} не ставится в слот ${sessionSlot}.`,
    });
  }

  if (mainStart && days !== null && days <= 30 && block.developsQuality) {
    reasons.push({
      code: "development_forbidden_before_main_start",
      message: "Перед главным стартом ближе 30 дней развитие запрещено; блок можно заменить поддержанием, переносом или восстановлением.",
      replacementBlockType: "mat_light_technical",
    });
  }

  if (
    mainStart &&
    days !== null &&
    block.minDaysUntilStartForMainStart !== null &&
    days < block.minDaysUntilStartForMainStart
  ) {
    reasons.push({
      code: "too_close_to_main_start",
      message: `${block.label} слишком близко к главному старту: нужен минимум Д-${block.minDaysUntilStartForMainStart}.`,
      replacementBlockType: "mat_light_technical",
    });
  }

  if (mainStart && days !== null && days <= 21 && block.usesHeavyStrength) {
    reasons.push({
      code: "heavy_strength_too_close",
      message: "Тяжёлая силовая запрещена близко к главному старту.",
      replacementBlockType: "recovery",
    });
  }

  if (mainStart && days !== null && days <= 30 && block.usesHeavyLegLmv) {
    reasons.push({
      code: "heavy_leg_lmv_too_close",
      message: "Тяжёлая ЛМВ ног не ставится в последние 30 дней перед главным стартом.",
      replacementBlockType: "spp",
    });
  }

  if (
    mainStart &&
    days !== null &&
    days <= 10 &&
    block.matVolumeLevel === "high" &&
    block.type !== "competition_start"
  ) {
    reasons.push({
      code: "mat_volume_too_high_close_to_start",
      message: "Чрезмерный ковёр запрещён в непосредственной подводке.",
      replacementBlockType: "mat_light_technical",
    });
  }

  if (mainStart && days !== null && days <= 14 && block.usesControlBouts) {
    reasons.push({
      code: "control_bouts_too_close",
      message: "Контрольные схватки слишком близко к главному старту.",
      replacementBlockType: "mat_light_technical",
    });
  }

  if (context.isTravelDay && (block.loadLevel === "high" || block.loadLevel === "medium")) {
    reasons.push({
      code: "heavy_load_on_travel_day",
      message: "В день дороги тяжёлая и средняя нагрузка запрещены; допустимы мобилити, восстановление и лёгкая активация.",
      replacementBlockType: "mobility",
    });
  }

  if (context.isWeighInDay && (block.loadLevel === "high" || block.loadLevel === "medium")) {
    reasons.push({
      code: "heavy_load_on_weigh_in_day",
      message: "В день взвешивания нагрузка подчиняется весу, воде и свежести.",
      replacementBlockType: "weigh_in",
    });
  }

  if (
    (context.preparationPhase === "direct_pre_competition" || context.preparationPhase === "taper" || weekType === "taper") &&
    block.developsQuality
  ) {
    reasons.push({
      code: "taper_development_mix",
      message: "Taper нельзя смешивать с развивающими блоками.",
      replacementBlockType: "recovery",
    });
  }

  if (weekRule && !weekRule.canDevelopQualities && block.developsQuality) {
    reasons.push({
      code: "week_development_forbidden",
      message: `Неделя ${weekType} не допускает развитие качеств.`,
      replacementBlockType: "recovery",
    });
  }

  if (dayRule && !dayRule.canDevelopQualities && block.developsQuality) {
    reasons.push({
      code: "day_development_forbidden",
      message: `День ${dayType} не допускает развитие качеств.`,
      replacementBlockType: "recovery",
    });
  }

  if (weekRule && !weekRule.canUseSPP && block.usesSPP) {
    reasons.push({
      code: "spp_not_allowed",
      message: `Неделя ${weekType} не допускает СФП-блок.`,
      replacementBlockType: "recovery",
    });
  }

  if (dayRule && !dayRule.canUseSPP && block.usesSPP) {
    reasons.push({
      code: "spp_not_allowed",
      message: `День ${dayType} не допускает СФП-блок.`,
      replacementBlockType: "recovery",
    });
  }

  if (weekRule && !weekRule.canUseGPP && block.usesGPP) {
    reasons.push({
      code: "gpp_not_allowed",
      message: `Неделя ${weekType} не допускает ОФП-блок.`,
      replacementBlockType: "recovery",
    });
  }

  if (dayRule && !dayRule.canUseGPP && block.usesGPP) {
    reasons.push({
      code: "gpp_not_allowed",
      message: `День ${dayType} не допускает ОФП-блок.`,
      replacementBlockType: "recovery",
    });
  }

  if (dayRule && !dayRule.canUseControlBouts && block.usesControlBouts) {
    reasons.push({
      code: "control_bouts_not_allowed",
      message: `День ${dayType} не допускает контрольные схватки.`,
      replacementBlockType: "mat_light_technical",
    });
  }

  return reasons.map((reason) => ({
    ...reason,
    evidenceDependencies: evidenceForEligibilityReason({
      reason,
      block,
      weekRule,
      dayRule,
    }),
  }));
}

export function isTrainingBlockAllowed(
  block: ConstructorTrainingBlockDefinition,
  context: ConstructorMatrixContext,
) {
  return getForbiddenBlockReasons(block, context).length === 0;
}

export function filterAllowedTrainingBlocks(
  blocks: ConstructorTrainingBlockDefinition[],
  context: ConstructorMatrixContext,
) {
  return blocks.filter((block) => isTrainingBlockAllowed(block, context));
}

export function explainBlockEligibility(
  block: ConstructorTrainingBlockDefinition,
  context: ConstructorMatrixContext,
): ConstructorExplanationReason {
  const reasons = getForbiddenBlockReasons(block, context);

  if (reasons.length === 0) {
    return {
      code: "block_allowed",
      message: `${block.label}: разрешён. ${block.explanation}`,
    };
  }

  return {
    code: "block_forbidden",
    message: `${block.label}: запрещён. ${reasons.map((reason) => reason.message).join(" ")}`,
  };
}

export function classifyConstructorTemplateCard(cardId: string): ConstructorTemplateCardCompatibility {
  const known = CONSTRUCTOR_TEMPLATE_CARD_COMPATIBILITY.find((item) => item.cardId === cardId);

  if (known) {
    return known;
  }

  return {
    cardId,
    trainingBlockTypes: [],
    controlsGeneration: false,
    explanation: "Неизвестная старая карточка не должна управлять генерацией; нужна ручная классификация блоков.",
  };
}

export function getTrainingBlockDefinition(type: ConstructorTrainingBlockType) {
  return CONSTRUCTOR_TRAINING_BLOCK_LIBRARY.find((block) => block.type === type) ?? null;
}
