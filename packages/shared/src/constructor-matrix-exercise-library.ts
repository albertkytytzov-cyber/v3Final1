import type { ConstructorGoalType } from "./constructor-core";
import type {
  ConstructorDayType,
  ConstructorPreparationPhase,
  ConstructorTrainingBlockType,
} from "./constructor-matrix";
import type { ConstructorMatrixEvidenceDependencyId } from "./constructor-matrix-evidence";

export type ConstructorMatrixExerciseCategory =
  | "wrestling_stance_movement"
  | "shots_entries"
  | "defense_sprawl"
  | "par_terre_top"
  | "par_terre_bottom"
  | "grip_hand_fighting"
  | "edge_of_mat"
  | "tactical_score_situation"
  | "competition_model"
  | "controlled_bout"
  | "speed_first_action"
  | "acceleration_change_of_direction"
  | "max_strength"
  | "strength_endurance"
  | "local_muscular_endurance_legs"
  | "posterior_chain"
  | "trunk_anti_rotation"
  | "neck_prehab"
  | "mobility"
  | "aerobic_recovery"
  | "breathing_downregulation"
  | "travel_mobility"
  | "weigh_in_day_activation"
  | "post_competition_recovery";

export type ConstructorMatrixExerciseEquipment =
  | "mat"
  | "partner"
  | "coach"
  | "dummy"
  | "barbell"
  | "dumbbell"
  | "kettlebell"
  | "medicine_ball"
  | "sled"
  | "resistance_band"
  | "pullup_bar"
  | "bike"
  | "rower"
  | "open_space"
  | "bodyweight"
  | "timer"
  | "none";

export type ConstructorMatrixExerciseEnvironment =
  | "mat"
  | "gym"
  | "outdoor"
  | "home"
  | "travel";

export type ConstructorMatrixExerciseLoadPrescriptionMode =
  | "bodyweight"
  | "duration"
  | "distance"
  | "RPE"
  | "percent_1rm_candidate"
  | "e1rm_based_candidate"
  | "velocity_based_candidate"
  | "technical_quality"
  | "coach_selected";

export type ConstructorMatrixExerciseReviewTrack =
  | "coach"
  | "medical"
  | "data_quality"
  | "sport_science"
  | "product_safety";

export type ConstructorMatrixExerciseMethodologyTag =
  | "coach_school_candidate"
  | "seluyanov_statodynamic_lme_candidate"
  | "wrestling_transfer_candidate"
  | "performance_content_candidate"
  | "speed_development_candidate"
  | "speed_endurance_candidate"
  | "strength_development_candidate"
  | "endurance_development_candidate"
  | "exercise_complex_candidate";

export type ConstructorMatrixExercisePrescriptionTemplate = {
  sets: number | null;
  reps: number | null;
  durationMinutes: number | null;
  targetRpe: number | null;
  distanceMeters: number | null;
  notes: string;
};

export type ConstructorMatrixExercise = {
  id: string;
  name: string;
  category: ConstructorMatrixExerciseCategory;
  blockTypes: readonly ConstructorTrainingBlockType[];
  targetQualities: readonly ConstructorGoalType[];
  equipment: readonly ConstructorMatrixExerciseEquipment[];
  environments: readonly ConstructorMatrixExerciseEnvironment[];
  phaseApplicability: readonly ConstructorPreparationPhase[];
  dayTypeApplicability: readonly ConstructorDayType[];
  athleteContextConstraints: readonly string[];
  contraindicationFlags: readonly string[];
  progressionOptions: readonly string[];
  regressionOptions: readonly string[];
  coachingCues: readonly string[];
  commonMistakes: readonly string[];
  safetyNotes: readonly string[];
  loadPrescriptionMode: ConstructorMatrixExerciseLoadPrescriptionMode;
  defaultPrescription: ConstructorMatrixExercisePrescriptionTemplate;
  evidenceDependencyIds: readonly ConstructorMatrixEvidenceDependencyId[];
  reviewRequired: readonly ConstructorMatrixExerciseReviewTrack[];
  methodologyTags: readonly ConstructorMatrixExerciseMethodologyTag[];
  highRiskAutomationBlocked: boolean;
};

type ExerciseSeed = {
  id: string;
  name: string;
  category: ConstructorMatrixExerciseCategory;
  blockTypes: readonly ConstructorTrainingBlockType[];
  targetQualities: readonly ConstructorGoalType[];
  equipment?: readonly ConstructorMatrixExerciseEquipment[];
  environments?: readonly ConstructorMatrixExerciseEnvironment[];
  phases?: readonly ConstructorPreparationPhase[];
  dayTypes?: readonly ConstructorDayType[];
  loadMode?: ConstructorMatrixExerciseLoadPrescriptionMode;
  prescription?: Partial<ConstructorMatrixExercisePrescriptionTemplate>;
  reviewRequired?: readonly ConstructorMatrixExerciseReviewTrack[];
  methodologyTags?: readonly ConstructorMatrixExerciseMethodologyTag[];
  highRiskAutomationBlocked?: boolean;
  constraints?: readonly string[];
  contraindications?: readonly string[];
  cues?: readonly string[];
  mistakes?: readonly string[];
  safety?: readonly string[];
  progressions?: readonly string[];
  regressions?: readonly string[];
};

const ALL_PHASES = [
  "general_preparation",
  "special_preparation",
  "special_pre_competition",
  "direct_pre_competition",
  "taper",
  "competition",
  "transition_recovery",
] as const satisfies readonly ConstructorPreparationPhase[];

const TRAINING_DAY_TYPES = [
  "heavy_training",
  "medium_training",
  "light_training",
  "technical",
  "competition_model",
  "mat_day",
  "spp_day",
  "gpp_day",
  "half_day",
] as const satisfies readonly ConstructorDayType[];

const RECOVERY_DAY_TYPES = [
  "light_training",
  "half_day",
  "environment_change",
  "recovery",
  "sauna_recovery",
  "travel",
  "weigh_in",
  "post_competition",
] as const satisfies readonly ConstructorDayType[];

const CATEGORY_DEFAULTS = {
  wrestling_stance_movement: {
    equipment: ["mat", "partner", "timer"],
    environments: ["mat"],
    loadMode: "technical_quality",
    prescription: { sets: 3, reps: 6, durationMinutes: null, targetRpe: 4 },
    cues: ["stable stance", "level change before entry", "hands protect position"],
    mistakes: ["standing tall", "crossing feet", "rushing without balance"],
    safety: ["stop if knee, ankle, or back pain changes movement quality"],
  },
  shots_entries: {
    equipment: ["mat", "partner", "coach"],
    environments: ["mat"],
    loadMode: "technical_quality",
    prescription: { sets: 4, reps: 4, durationMinutes: null, targetRpe: 5 },
    cues: ["setup first", "head and hip position stay connected", "finish through angle"],
    mistakes: ["shooting from too far", "head down", "finishing square"],
    safety: ["keep volume coach-editable and stop if impact quality drops"],
  },
  defense_sprawl: {
    equipment: ["mat", "partner"],
    environments: ["mat"],
    loadMode: "technical_quality",
    prescription: { sets: 4, reps: 4, durationMinutes: null, targetRpe: 5 },
    cues: ["hips heavy", "hands block shoulder line", "recover stance after defense"],
    mistakes: ["dropping knees", "late hip pressure", "staying flat after defense"],
    safety: ["avoid ballistic volume when shoulder, neck, or lumbar pain is present"],
  },
  par_terre_top: {
    equipment: ["mat", "partner", "coach"],
    environments: ["mat"],
    loadMode: "technical_quality",
    prescription: { sets: 3, reps: 4, durationMinutes: null, targetRpe: 5 },
    cues: ["pressure before turn", "hips stay connected", "finish without forcing joint range"],
    mistakes: ["pulling with arms only", "losing chest pressure", "forcing rotation"],
    safety: ["do not force neck, shoulder, or spine positions"],
  },
  par_terre_bottom: {
    equipment: ["mat", "partner"],
    environments: ["mat"],
    loadMode: "technical_quality",
    prescription: { sets: 3, reps: 4, durationMinutes: null, targetRpe: 5 },
    cues: ["base first", "hips move before reach", "clear pressure then stand"],
    mistakes: ["reaching before base", "flat hips", "turning into pressure"],
    safety: ["stop when neck or shoulder position becomes unsafe"],
  },
  grip_hand_fighting: {
    equipment: ["mat", "partner"],
    environments: ["mat"],
    loadMode: "duration",
    prescription: { sets: 4, reps: null, durationMinutes: 2, targetRpe: 5 },
    cues: ["win inside line", "clear before attack", "hands and feet move together"],
    mistakes: ["static pulling", "arms-only fighting", "no setup after clearing"],
    safety: ["keep wrists, fingers, and shoulders pain-free"],
  },
  edge_of_mat: {
    equipment: ["mat", "partner"],
    environments: ["mat"],
    loadMode: "technical_quality",
    prescription: { sets: 4, reps: 3, durationMinutes: null, targetRpe: 5 },
    cues: ["know boundary", "score before stepping out", "protect position after action"],
    mistakes: ["backing straight out", "panic shot", "leaving hips behind"],
    safety: ["use controlled partner resistance near mat edge"],
  },
  tactical_score_situation: {
    equipment: ["mat", "partner", "coach", "timer"],
    environments: ["mat"],
    loadMode: "duration",
    prescription: { sets: 3, reps: null, durationMinutes: 2, targetRpe: 6 },
    cues: ["define score and clock", "one tactical objective", "reset after each exchange"],
    mistakes: ["unclear scenario", "chasing chaos", "ignoring clock"],
    safety: ["scenario work remains coach-supervised and coach-editable"],
  },
  competition_model: {
    equipment: ["mat", "partner", "coach", "timer"],
    environments: ["mat"],
    loadMode: "duration",
    prescription: { sets: 2, reps: null, durationMinutes: 7, targetRpe: 7 },
    cues: ["model match rhythm", "quality beats extra volume", "full reset between periods"],
    mistakes: ["turning model into conditioning", "too many rounds", "poor recovery"],
    safety: ["not used too close to main start unless coach confirms readiness"],
  },
  controlled_bout: {
    equipment: ["mat", "partner", "coach", "timer"],
    environments: ["mat"],
    loadMode: "coach_selected",
    prescription: { sets: 1, reps: null, durationMinutes: 6, targetRpe: 8 },
    cues: ["clear bout goal", "coach stops quality drop", "review one tactical point"],
    mistakes: ["uncontrolled intensity", "extra rounds", "no technical objective"],
    safety: ["coach-supervised only; not for pain, injury, or close-start fatigue"],
  },
  speed_first_action: {
    equipment: ["mat", "open_space", "timer"],
    environments: ["mat", "gym", "outdoor"],
    loadMode: "RPE",
    prescription: { sets: 5, reps: 1, durationMinutes: null, targetRpe: 5 },
    cues: ["fast but fresh", "full reset", "stop before speed decays"],
    mistakes: ["turning speed into conditioning", "short rest", "forcing tired reps"],
    safety: ["avoid if sprint mechanics are painful"],
  },
  acceleration_change_of_direction: {
    equipment: ["open_space", "timer"],
    environments: ["gym", "outdoor", "mat"],
    loadMode: "distance",
    prescription: { sets: 5, reps: 1, durationMinutes: null, targetRpe: 5, distanceMeters: 10 },
    cues: ["push the floor", "decelerate under control", "finish balanced"],
    mistakes: ["slipping", "upright acceleration", "hard cuts while tired"],
    safety: ["surface must be safe and non-slippery"],
  },
  max_strength: {
    equipment: ["barbell", "dumbbell", "kettlebell"],
    environments: ["gym"],
    loadMode: "e1rm_based_candidate",
    prescription: { sets: 3, reps: 3, durationMinutes: null, targetRpe: 7 },
    cues: ["leave reserve", "technical reps only", "coach controls load"],
    mistakes: ["testing maxes in pilot", "grinding reps", "adding load without max context"],
    safety: ["numeric load requires athlete training max or e1RM and remains coach-editable"],
  },
  strength_endurance: {
    equipment: ["barbell", "dumbbell", "kettlebell", "bodyweight", "resistance_band"],
    environments: ["gym", "home"],
    loadMode: "RPE",
    prescription: { sets: 3, reps: 8, durationMinutes: null, targetRpe: 6 },
    cues: ["repeatable quality", "controlled breathing", "stop short of failure"],
    mistakes: ["failure chasing", "losing posture", "too much density near start"],
    safety: ["coach edits volume when readiness, pain, or travel flags appear"],
  },
  local_muscular_endurance_legs: {
    equipment: ["bodyweight", "dumbbell", "kettlebell", "timer"],
    environments: ["gym", "home"],
    loadMode: "duration",
    prescription: { sets: 3, reps: null, durationMinutes: 1, targetRpe: 6 },
    cues: ["local burn without failure", "controlled range", "transfer to entries after"],
    mistakes: ["going to failure", "too close to main start", "knee collapse"],
    safety: ["blocked close to main start and coach-review required when pain exists"],
  },
  posterior_chain: {
    equipment: ["barbell", "dumbbell", "kettlebell", "resistance_band"],
    environments: ["gym", "home"],
    loadMode: "RPE",
    prescription: { sets: 3, reps: 6, durationMinutes: null, targetRpe: 6 },
    cues: ["hinge first", "neutral trunk", "hamstrings and glutes share load"],
    mistakes: ["lumbar pulling", "rushing eccentric", "adding load without shape"],
    safety: ["regress if back pain or hamstring symptoms appear"],
  },
  trunk_anti_rotation: {
    equipment: ["medicine_ball", "resistance_band", "bodyweight"],
    environments: ["gym", "home", "mat"],
    loadMode: "RPE",
    prescription: { sets: 3, reps: 8, durationMinutes: null, targetRpe: 5 },
    cues: ["ribs down", "hips stable", "resist rotation before producing it"],
    mistakes: ["twisting lumbar spine", "holding breath", "too much speed early"],
    safety: ["keep trunk work pain-free and controlled"],
  },
  neck_prehab: {
    equipment: ["bodyweight", "resistance_band", "partner"],
    environments: ["gym", "home", "mat"],
    loadMode: "coach_selected",
    prescription: { sets: 2, reps: 6, durationMinutes: null, targetRpe: 3 },
    cues: ["low force", "slow control", "no symptom provocation"],
    mistakes: ["max effort neck work", "fast jerks", "working through symptoms"],
    safety: ["medical review required for neck symptoms or concussion history"],
  },
  mobility: {
    equipment: ["bodyweight", "none"],
    environments: ["mat", "gym", "home", "travel"],
    loadMode: "duration",
    prescription: { sets: null, reps: null, durationMinutes: 10, targetRpe: 2 },
    cues: ["easy range", "breathe normally", "leave joints feeling better"],
    mistakes: ["forcing range", "turning mobility into fatigue", "ignoring pain"],
    safety: ["mobility must not push painful end ranges"],
  },
  aerobic_recovery: {
    equipment: ["bike", "rower", "open_space", "bodyweight"],
    environments: ["gym", "outdoor", "travel"],
    loadMode: "duration",
    prescription: { sets: null, reps: null, durationMinutes: 25, targetRpe: 3 },
    cues: ["conversation pace", "smooth breathing", "finish fresher"],
    mistakes: ["racing recovery work", "adding intervals", "chasing fatigue"],
    safety: ["keep recovery work easy and coach-editable"],
  },
  breathing_downregulation: {
    equipment: ["none", "timer"],
    environments: ["home", "travel", "mat"],
    loadMode: "duration",
    prescription: { sets: null, reps: null, durationMinutes: 5, targetRpe: 1 },
    cues: ["quiet exhale", "relaxed shoulders", "slow reset"],
    mistakes: ["breath holding", "forcing long holds", "using it as medical treatment"],
    safety: ["stop if dizziness or distress appears"],
  },
  travel_mobility: {
    equipment: ["bodyweight", "resistance_band"],
    environments: ["travel", "home"],
    loadMode: "duration",
    prescription: { sets: null, reps: null, durationMinutes: 10, targetRpe: 2 },
    cues: ["restore hips and ankles", "easy spine motion", "no fatigue"],
    mistakes: ["doing workout volume", "forcing cramped ranges", "skipping hydration awareness"],
    safety: ["travel day remains no-heavy-load"],
  },
  weigh_in_day_activation: {
    equipment: ["mat", "bodyweight", "timer"],
    environments: ["mat", "travel"],
    loadMode: "coach_selected",
    prescription: { sets: 2, reps: 3, durationMinutes: null, targetRpe: 3 },
    cues: ["short and fresh", "coach checks readiness", "stop if flat or symptomatic"],
    mistakes: ["sweating session", "extra rounds", "using activation for weight loss"],
    safety: ["not a dehydration or weight-cut protocol; medical/coach review required"],
  },
  post_competition_recovery: {
    equipment: ["bodyweight", "none"],
    environments: ["home", "travel", "mat"],
    loadMode: "duration",
    prescription: { sets: null, reps: null, durationMinutes: 20, targetRpe: 2 },
    cues: ["restore movement", "collect symptoms", "prepare next review"],
    mistakes: ["development work too early", "ignoring pain", "no recovery plan"],
    safety: ["injury or pain changes require qualified review"],
  },
} as const satisfies Record<
  ConstructorMatrixExerciseCategory,
  {
    equipment: readonly ConstructorMatrixExerciseEquipment[];
    environments: readonly ConstructorMatrixExerciseEnvironment[];
    loadMode: ConstructorMatrixExerciseLoadPrescriptionMode;
    prescription: Partial<ConstructorMatrixExercisePrescriptionTemplate>;
    cues: readonly string[];
    mistakes: readonly string[];
    safety: readonly string[];
  }
>;

const DEFAULT_PRESCRIPTION: ConstructorMatrixExercisePrescriptionTemplate = {
  sets: null,
  reps: null,
  durationMinutes: null,
  targetRpe: null,
  distanceMeters: null,
  notes: "coach-editable prescription; no medical threshold",
};

const DEFAULT_PROGRESSION = [
  "add one technical constraint before adding load",
  "increase complexity only if quality stays stable",
];
const DEFAULT_REGRESSION = [
  "reduce partner resistance",
  "switch to slower technical rehearsal",
];

function evidenceForBlockType(
  type: ConstructorTrainingBlockType,
): ConstructorMatrixEvidenceDependencyId[] {
  const common = ["perform_evidence_matrix", "matrix_transition_plan"] as const;

  switch (type) {
    case "mat_technique":
    case "mat_tactics":
    case "mat_light_technical":
    case "mat_competition_model":
    case "mat_control_bouts":
    case "competition_start":
      return [...common, "wrestling_temporal_structure", "europe_pre_competition_plan"];
    case "spp":
    case "leg_lmv":
      return [...common, "bfr_kaatsu_local_metabolic", "europe_pre_competition_plan"];
    case "gpp":
    case "aerobic_deload":
    case "environment_change":
      return [...common, "recovery_monitoring_consensus", "periodization_taper_peaking"];
    case "first_action_speed":
      return [...common, "china_ssit_freestyle_wrestlers", "europe_pre_competition_plan"];
    case "mobility":
    case "recovery":
    case "post_competition_recovery":
      return [...common, "recovery_monitoring_consensus"];
    case "sauna":
    case "weigh_in":
      return [...common, "ncaa_weight_management", "acsm_hydration_nutrition"];
    case "travel":
      return [...common, "europe_pre_competition_plan", "acsm_hydration_nutrition"];
    default:
      return [...common, "perform_internal_validation_pending"];
  }
}

function unique<T extends string>(items: readonly T[]): T[] {
  return Array.from(new Set(items));
}

function evidenceForSeed(seed: ExerciseSeed): ConstructorMatrixEvidenceDependencyId[] {
  return unique(seed.blockTypes.flatMap(evidenceForBlockType));
}

function makeExercise(seed: ExerciseSeed): ConstructorMatrixExercise {
  const defaults = CATEGORY_DEFAULTS[seed.category];
  const reviewRequired =
    seed.reviewRequired ??
    (seed.category === "weigh_in_day_activation"
      ? ["coach", "medical"]
      : seed.category === "controlled_bout" || seed.category === "neck_prehab"
        ? ["coach"]
        : []);

  return {
    id: seed.id,
    name: seed.name,
    category: seed.category,
    blockTypes: seed.blockTypes,
    targetQualities: seed.targetQualities,
    equipment: seed.equipment ?? defaults.equipment,
    environments: seed.environments ?? defaults.environments,
    phaseApplicability: seed.phases ?? ALL_PHASES,
    dayTypeApplicability: seed.dayTypes ??
      (seed.category === "travel_mobility"
        ? ["travel"]
        : seed.category === "weigh_in_day_activation"
          ? ["weigh_in"]
          : seed.category === "post_competition_recovery"
            ? ["post_competition", "recovery"]
            : seed.category === "mobility" ||
                seed.category === "aerobic_recovery" ||
                seed.category === "breathing_downregulation"
              ? RECOVERY_DAY_TYPES
              : TRAINING_DAY_TYPES),
    athleteContextConstraints: seed.constraints ?? [
      "coach may edit for athlete level, equipment, and session duration",
    ],
    contraindicationFlags: seed.contraindications ?? [
      "pain_or_injury_requires_review",
    ],
    progressionOptions: seed.progressions ?? DEFAULT_PROGRESSION,
    regressionOptions: seed.regressions ?? DEFAULT_REGRESSION,
    coachingCues: seed.cues ?? defaults.cues,
    commonMistakes: seed.mistakes ?? defaults.mistakes,
    safetyNotes: seed.safety ?? defaults.safety,
    loadPrescriptionMode: seed.loadMode ?? defaults.loadMode,
    defaultPrescription: {
      ...DEFAULT_PRESCRIPTION,
      ...defaults.prescription,
      ...seed.prescription,
      notes: seed.prescription?.notes ?? DEFAULT_PRESCRIPTION.notes,
    },
    evidenceDependencyIds: evidenceForSeed(seed),
    reviewRequired,
    methodologyTags: seed.methodologyTags ?? [],
    highRiskAutomationBlocked:
      seed.highRiskAutomationBlocked ??
      (seed.category === "weigh_in_day_activation" ||
        seed.category === "controlled_bout" ||
        seed.category === "neck_prehab"),
  };
}

const SELUYANOV_STATODYNAMIC_TAGS = [
  "coach_school_candidate",
  "seluyanov_statodynamic_lme_candidate",
  "wrestling_transfer_candidate",
] as const satisfies readonly ConstructorMatrixExerciseMethodologyTag[];

const SELUYANOV_REVIEW_TRACKS = [
  "coach",
  "sport_science",
] as const satisfies readonly ConstructorMatrixExerciseReviewTrack[];

const SELUYANOV_CONSTRAINTS = [
  "coach must confirm local fatigue zone and transfer intent",
  "use only as coach-editable local muscular endurance candidate",
  "do not treat as source-verified protocol before evidence review",
] as const;

const SELUYANOV_CONTRAINDICATIONS = [
  "pain_or_injury_requires_review",
  "high_local_fatigue_requires_regression",
  "close_main_start_requires_taper_guard",
] as const;

const SELUYANOV_CUES = [
  "constant tension without chasing failure",
  "short local stimulus before technique transfer",
  "quality and posture stay above volume",
] as const;

const SELUYANOV_MISTAKES = [
  "turning local endurance into max strength",
  "working to failure",
  "placing heavy local work before speed or close-start sessions",
] as const;

const SELUYANOV_SAFETY = [
  "coach-review candidate from Seluyanov/statodynamic school, not source-verified protocol yet",
  "stop or regress if pain, coordination loss, or sharp technique drop appears",
  "do not combine with heavy contact or sprint work without local-fatigue review",
] as const;

const SELUYANOV_STATODYNAMIC_EXERCISE_SEEDS = [
  {
    id: "seluyanov_statodynamic_half_squat",
    name: "Seluyanov-style statodynamic half squat",
    category: "local_muscular_endurance_legs",
    blockTypes: ["leg_lmv", "spp"],
    targetQualities: ["legs_lme", "fatigue_skill"],
  },
  {
    id: "seluyanov_statodynamic_split_squat",
    name: "Seluyanov-style statodynamic split squat",
    category: "local_muscular_endurance_legs",
    blockTypes: ["leg_lmv", "spp"],
    targetQualities: ["legs_lme", "fatigue_skill"],
  },
  {
    id: "seluyanov_statodynamic_lateral_lunge",
    name: "Seluyanov-style statodynamic lateral lunge",
    category: "local_muscular_endurance_legs",
    blockTypes: ["leg_lmv", "spp"],
    targetQualities: ["legs_lme", "fatigue_skill"],
  },
  {
    id: "seluyanov_statodynamic_calf_ankle",
    name: "Seluyanov-style calf and ankle constant-tension work",
    category: "local_muscular_endurance_legs",
    blockTypes: ["leg_lmv", "spp", "mobility"],
    targetQualities: ["legs_lme", "fatigue_skill"],
  },
  {
    id: "seluyanov_adductor_constant_tension",
    name: "Seluyanov-style adductor constant-tension pattern",
    category: "local_muscular_endurance_legs",
    blockTypes: ["leg_lmv", "spp", "mobility"],
    targetQualities: ["legs_lme", "fatigue_skill"],
  },
  {
    id: "seluyanov_glute_bridge_constant_tension",
    name: "Seluyanov-style glute bridge constant tension",
    category: "posterior_chain",
    blockTypes: ["leg_lmv", "spp", "gpp"],
    targetQualities: ["legs_lme", "fatigue_skill"],
  },
  {
    id: "seluyanov_hamstring_bridge_walkout",
    name: "Seluyanov-style hamstring bridge walkout",
    category: "posterior_chain",
    blockTypes: ["leg_lmv", "spp", "gpp"],
    targetQualities: ["legs_lme", "fatigue_skill"],
  },
  {
    id: "seluyanov_rdl_iso_dynamic_pattern",
    name: "Seluyanov-style RDL iso-dynamic pattern",
    category: "posterior_chain",
    blockTypes: ["spp", "gpp"],
    targetQualities: ["max_strength", "fatigue_skill"],
  },
  {
    id: "seluyanov_towel_grip_constant_tension",
    name: "Seluyanov-style towel grip constant tension",
    category: "strength_endurance",
    blockTypes: ["spp", "mat_tactics"],
    targetQualities: ["arms_grip", "fatigue_skill"],
  },
  {
    id: "seluyanov_rope_pull_constant_tension",
    name: "Seluyanov-style rope pull constant tension",
    category: "strength_endurance",
    blockTypes: ["spp"],
    targetQualities: ["arms_grip", "fatigue_skill"],
  },
  {
    id: "seluyanov_two_on_one_grip_endurance",
    name: "Seluyanov-style two-on-one grip endurance",
    category: "grip_hand_fighting",
    blockTypes: ["mat_tactics", "spp"],
    targetQualities: ["arms_grip", "fatigue_skill"],
  },
  {
    id: "seluyanov_underhook_pummel_constant_tension",
    name: "Seluyanov-style underhook pummel constant tension",
    category: "grip_hand_fighting",
    blockTypes: ["mat_tactics", "spp"],
    targetQualities: ["arms_grip", "fatigue_skill"],
  },
  {
    id: "seluyanov_pallof_static_dynamic_press",
    name: "Seluyanov-style Pallof static-dynamic press",
    category: "trunk_anti_rotation",
    blockTypes: ["spp", "gpp", "mobility"],
    targetQualities: ["fatigue_skill", "recovery"],
  },
  {
    id: "seluyanov_bear_crawl_constant_tension",
    name: "Seluyanov-style bear crawl constant tension",
    category: "trunk_anti_rotation",
    blockTypes: ["spp", "gpp"],
    targetQualities: ["fatigue_skill"],
  },
  {
    id: "seluyanov_band_pull_constant_tension",
    name: "Seluyanov-style band pull constant tension",
    category: "strength_endurance",
    blockTypes: ["spp", "gpp"],
    targetQualities: ["arms_grip", "fatigue_skill"],
  },
  {
    id: "seluyanov_pushup_constant_tension",
    name: "Seluyanov-style push-up constant tension",
    category: "strength_endurance",
    blockTypes: ["spp", "gpp"],
    targetQualities: ["fatigue_skill"],
  },
  {
    id: "seluyanov_entry_after_leg_lme_transfer",
    name: "Entry transfer after Seluyanov-style leg LME",
    category: "shots_entries",
    blockTypes: ["leg_lmv", "mat_technique", "spp"],
    targetQualities: ["legs_lme", "fatigue_skill"],
    loadMode: "technical_quality",
  },
  {
    id: "seluyanov_sprawl_recover_after_local_fatigue",
    name: "Sprawl-recover after Seluyanov-style local fatigue",
    category: "defense_sprawl",
    blockTypes: ["leg_lmv", "mat_technique", "spp"],
    targetQualities: ["legs_lme", "fatigue_skill"],
    loadMode: "technical_quality",
  },
  {
    id: "seluyanov_par_terre_pressure_constant_tension",
    name: "Seluyanov-style par terre pressure constant tension",
    category: "par_terre_top",
    blockTypes: ["mat_technique", "spp"],
    targetQualities: ["fatigue_skill", "wrestling_contact_density"],
  },
  {
    id: "seluyanov_bottom_base_constant_tension",
    name: "Seluyanov-style bottom base constant tension",
    category: "par_terre_bottom",
    blockTypes: ["mat_technique", "spp"],
    targetQualities: ["fatigue_skill"],
  },
  {
    id: "seluyanov_core_hip_lock_static_dynamic",
    name: "Seluyanov-style core and hip lock static-dynamic work",
    category: "trunk_anti_rotation",
    blockTypes: ["spp", "gpp", "leg_lmv"],
    targetQualities: ["legs_lme", "fatigue_skill"],
  },
  {
    id: "seluyanov_neck_low_force_isometric_control",
    name: "Seluyanov-style low-force neck isometric control",
    category: "neck_prehab",
    blockTypes: ["mobility", "recovery", "spp"],
    targetQualities: ["recovery", "fatigue_skill"],
    reviewRequired: ["coach", "medical", "sport_science"],
    highRiskAutomationBlocked: true,
  },
].map((seed) => ({
  ...seed,
  methodologyTags: SELUYANOV_STATODYNAMIC_TAGS,
  reviewRequired: seed.reviewRequired ?? SELUYANOV_REVIEW_TRACKS,
  constraints: SELUYANOV_CONSTRAINTS,
  contraindications: SELUYANOV_CONTRAINDICATIONS,
  cues: SELUYANOV_CUES,
  mistakes: SELUYANOV_MISTAKES,
  safety: SELUYANOV_SAFETY,
  loadMode: seed.loadMode ?? "duration",
  prescription: {
    sets: 3,
    reps: null,
    durationMinutes: 1,
    targetRpe: 6,
    notes: "Seluyanov/statodynamic coach-school candidate; coach-editable local stimulus, no source-verified protocol yet",
  },
})) as readonly ExerciseSeed[];

const PERFORMANCE_REVIEW_TRACKS = [
  "coach",
  "sport_science",
] as const satisfies readonly ConstructorMatrixExerciseReviewTrack[];

const PERFORMANCE_CONSTRAINTS = [
  "coach must select based on phase, equipment, readiness, and technical quality",
  "candidate content only until exercise-family evidence review is complete",
  "do not use as medical, weight-management, or injury-return decision",
] as const;

const PERFORMANCE_CONTRAINDICATIONS = [
  "pain_or_injury_requires_review",
  "poor_sleep_or_low_readiness_requires_regression",
  "close_main_start_requires_taper_guard",
] as const;

const PERFORMANCE_CUES = [
  "quality before volume",
  "coach controls density and rest",
  "stop before mechanics degrade",
] as const;

const PERFORMANCE_MISTAKES = [
  "turning every drill into conditioning",
  "adding density without recovery window",
  "ignoring local fatigue before contact work",
] as const;

const PERFORMANCE_SAFETY = [
  "coach-editable performance candidate, not source-verified protocol yet",
  "regress if pain, coordination loss, or sharp technical drop appears",
  "keep high-risk medical and weight-management decisions outside this exercise layer",
] as const;

function performanceSeed(
  seed: ExerciseSeed,
  tags: readonly ConstructorMatrixExerciseMethodologyTag[],
): ExerciseSeed {
  return {
    ...seed,
    methodologyTags: [
      "performance_content_candidate",
      ...tags,
    ],
    reviewRequired: seed.reviewRequired ?? PERFORMANCE_REVIEW_TRACKS,
    constraints: seed.constraints ?? PERFORMANCE_CONSTRAINTS,
    contraindications: seed.contraindications ?? PERFORMANCE_CONTRAINDICATIONS,
    cues: seed.cues ?? PERFORMANCE_CUES,
    mistakes: seed.mistakes ?? PERFORMANCE_MISTAKES,
    safety: seed.safety ?? PERFORMANCE_SAFETY,
    prescription: {
      notes: "performance content candidate; coach-editable, no source-verified protocol yet",
      ...seed.prescription,
    },
  };
}

const SPEED_DEVELOPMENT_EXERCISE_SEEDS = [
  performanceSeed({ id: "performance_falling_start_acceleration", name: "Falling-start acceleration candidate", category: "acceleration_change_of_direction", blockTypes: ["first_action_speed", "gpp"], targetQualities: ["speed_first_action"], loadMode: "distance", prescription: { sets: 5, reps: 1, durationMinutes: null, targetRpe: 5, distanceMeters: 10 } }, ["speed_development_candidate"]),
  performanceSeed({ id: "performance_kneeling_start_acceleration", name: "Kneeling-start acceleration candidate", category: "acceleration_change_of_direction", blockTypes: ["first_action_speed", "gpp"], targetQualities: ["speed_first_action"], loadMode: "distance", prescription: { sets: 5, reps: 1, durationMinutes: null, targetRpe: 5, distanceMeters: 10 } }, ["speed_development_candidate"]),
  performanceSeed({ id: "performance_partner_signal_first_step", name: "Partner signal first-step candidate", category: "speed_first_action", blockTypes: ["first_action_speed", "mat_light_technical"], targetQualities: ["speed_first_action", "taper_quality"], loadMode: "technical_quality", prescription: { sets: 5, reps: 2, durationMinutes: null, targetRpe: 5 } }, ["speed_development_candidate", "wrestling_transfer_candidate"]),
  performanceSeed({ id: "performance_reactive_level_change", name: "Reactive level-change speed candidate", category: "speed_first_action", blockTypes: ["first_action_speed", "mat_technique"], targetQualities: ["speed_first_action"], loadMode: "technical_quality", prescription: { sets: 5, reps: 2, durationMinutes: null, targetRpe: 5 } }, ["speed_development_candidate", "wrestling_transfer_candidate"]),
  performanceSeed({ id: "performance_mirror_first_action_chase", name: "Mirror first-action chase candidate", category: "speed_first_action", blockTypes: ["first_action_speed", "mat_tactics"], targetQualities: ["speed_first_action", "fatigue_skill"], loadMode: "technical_quality", prescription: { sets: 4, reps: 3, durationMinutes: null, targetRpe: 5 } }, ["speed_development_candidate", "wrestling_transfer_candidate"]),
  performanceSeed({ id: "performance_sprawl_to_acceleration", name: "Sprawl to acceleration candidate", category: "defense_sprawl", blockTypes: ["first_action_speed", "mat_technique"], targetQualities: ["speed_first_action", "fatigue_skill"], loadMode: "technical_quality", prescription: { sets: 4, reps: 3, durationMinutes: null, targetRpe: 5 } }, ["speed_development_candidate", "wrestling_transfer_candidate"]),
  performanceSeed({ id: "performance_lateral_shuffle_cut", name: "Lateral shuffle cut candidate", category: "acceleration_change_of_direction", blockTypes: ["first_action_speed", "gpp"], targetQualities: ["speed_first_action"], loadMode: "distance", prescription: { sets: 4, reps: 2, durationMinutes: null, targetRpe: 5, distanceMeters: 10 } }, ["speed_development_candidate"]),
  performanceSeed({ id: "performance_edge_reaction_circle", name: "Edge reaction circle candidate", category: "edge_of_mat", blockTypes: ["first_action_speed", "mat_tactics"], targetQualities: ["speed_first_action", "fatigue_skill"], loadMode: "technical_quality", prescription: { sets: 4, reps: 3, durationMinutes: null, targetRpe: 5 } }, ["speed_development_candidate", "wrestling_transfer_candidate"]),
  performanceSeed({ id: "performance_medball_scoop_throw", name: "Medicine-ball scoop throw speed candidate", category: "acceleration_change_of_direction", blockTypes: ["first_action_speed", "spp"], targetQualities: ["speed_strength", "speed_first_action"], loadMode: "RPE", prescription: { sets: 4, reps: 3, durationMinutes: null, targetRpe: 5 } }, ["speed_development_candidate", "strength_development_candidate"]),
  performanceSeed({ id: "performance_medball_overhead_reactive_throw", name: "Medicine-ball overhead reactive throw candidate", category: "acceleration_change_of_direction", blockTypes: ["first_action_speed", "spp"], targetQualities: ["speed_strength", "speed_first_action"], loadMode: "RPE", prescription: { sets: 4, reps: 3, durationMinutes: null, targetRpe: 5 } }, ["speed_development_candidate", "strength_development_candidate"]),
  performanceSeed({ id: "performance_band_resisted_entry", name: "Band-resisted entry speed candidate", category: "shots_entries", blockTypes: ["first_action_speed", "mat_technique", "spp"], targetQualities: ["speed_first_action", "fatigue_skill"], loadMode: "technical_quality", prescription: { sets: 4, reps: 3, durationMinutes: null, targetRpe: 5 } }, ["speed_development_candidate", "wrestling_transfer_candidate"]),
  performanceSeed({ id: "performance_first_contact_release", name: "First-contact release speed candidate", category: "grip_hand_fighting", blockTypes: ["first_action_speed", "mat_tactics"], targetQualities: ["speed_first_action", "fatigue_skill"], loadMode: "technical_quality", prescription: { sets: 4, reps: 3, durationMinutes: null, targetRpe: 5 } }, ["speed_development_candidate", "wrestling_transfer_candidate"]),
] as const satisfies readonly ExerciseSeed[];

const SPEED_ENDURANCE_EXERCISE_SEEDS = [
  performanceSeed({ id: "performance_repeated_shot_cluster", name: "Repeated shot cluster candidate", category: "tactical_score_situation", blockTypes: ["mat_competition_model", "spp"], targetQualities: ["anaerobic_power", "fatigue_skill"], loadMode: "duration", prescription: { sets: 3, reps: null, durationMinutes: 2, targetRpe: 6 } }, ["speed_endurance_candidate", "wrestling_transfer_candidate"]),
  performanceSeed({ id: "performance_sprawl_shot_repeat", name: "Sprawl-shot repeat candidate", category: "defense_sprawl", blockTypes: ["mat_competition_model", "spp"], targetQualities: ["anaerobic_power", "fatigue_skill"], loadMode: "duration", prescription: { sets: 3, reps: null, durationMinutes: 2, targetRpe: 6 } }, ["speed_endurance_candidate", "wrestling_transfer_candidate"]),
  performanceSeed({ id: "performance_handfight_burst_repeat", name: "Hand-fight burst repeat candidate", category: "grip_hand_fighting", blockTypes: ["mat_competition_model", "mat_tactics"], targetQualities: ["anaerobic_power", "arms_grip"], loadMode: "duration", prescription: { sets: 3, reps: null, durationMinutes: 2, targetRpe: 6 } }, ["speed_endurance_candidate", "wrestling_transfer_candidate"]),
  performanceSeed({ id: "performance_edge_attack_repeat", name: "Edge attack repeat candidate", category: "edge_of_mat", blockTypes: ["mat_competition_model", "mat_tactics"], targetQualities: ["anaerobic_power", "wrestling_contact_density"], loadMode: "duration", prescription: { sets: 3, reps: null, durationMinutes: 2, targetRpe: 6 } }, ["speed_endurance_candidate", "wrestling_transfer_candidate"]),
  performanceSeed({ id: "performance_scramble_repeat", name: "Scramble repeat candidate", category: "competition_model", blockTypes: ["mat_competition_model", "mat_control_bouts"], targetQualities: ["anaerobic_power", "wrestling_contact_density"], loadMode: "duration", prescription: { sets: 2, reps: null, durationMinutes: 3, targetRpe: 7 } }, ["speed_endurance_candidate", "wrestling_transfer_candidate"]),
  performanceSeed({ id: "performance_mat_return_repeat", name: "Mat return repeat candidate", category: "competition_model", blockTypes: ["mat_competition_model", "spp"], targetQualities: ["anaerobic_power", "wrestling_contact_density"], loadMode: "duration", prescription: { sets: 3, reps: null, durationMinutes: 2, targetRpe: 6 } }, ["speed_endurance_candidate", "wrestling_transfer_candidate"]),
  performanceSeed({ id: "performance_short_bout_exchange_density", name: "Short-bout exchange density candidate", category: "controlled_bout", blockTypes: ["mat_control_bouts", "mat_competition_model"], targetQualities: ["anaerobic_power", "wrestling_contact_density"], loadMode: "coach_selected", prescription: { sets: 2, reps: null, durationMinutes: 3, targetRpe: 7 } }, ["speed_endurance_candidate", "wrestling_transfer_candidate"]),
  performanceSeed({ id: "performance_grip_attack_density", name: "Grip-to-attack density candidate", category: "strength_endurance", blockTypes: ["spp", "mat_tactics"], targetQualities: ["arms_grip", "anaerobic_power"], loadMode: "duration", prescription: { sets: 3, reps: null, durationMinutes: 2, targetRpe: 6 } }, ["speed_endurance_candidate", "strength_development_candidate", "wrestling_transfer_candidate"]),
  performanceSeed({ id: "performance_stance_motion_density", name: "Stance motion density candidate", category: "wrestling_stance_movement", blockTypes: ["mat_technique", "spp"], targetQualities: ["anaerobic_power", "fatigue_skill"], loadMode: "duration", prescription: { sets: 3, reps: null, durationMinutes: 2, targetRpe: 6 } }, ["speed_endurance_candidate", "wrestling_transfer_candidate"]),
  performanceSeed({ id: "performance_par_terre_pressure_repeat", name: "Par terre pressure repeat candidate", category: "par_terre_top", blockTypes: ["mat_competition_model", "spp"], targetQualities: ["anaerobic_power", "wrestling_contact_density"], loadMode: "duration", prescription: { sets: 3, reps: null, durationMinutes: 2, targetRpe: 6 } }, ["speed_endurance_candidate", "wrestling_transfer_candidate"]),
] as const satisfies readonly ExerciseSeed[];

const STRENGTH_DEVELOPMENT_EXERCISE_SEEDS = [
  performanceSeed({ id: "performance_front_squat_strength_candidate", name: "Front squat strength candidate", category: "max_strength", blockTypes: ["spp", "gpp"], targetQualities: ["max_strength"], loadMode: "e1rm_based_candidate", prescription: { sets: 3, reps: 3, durationMinutes: null, targetRpe: 7 } }, ["strength_development_candidate"]),
  performanceSeed({ id: "performance_split_squat_strength_candidate", name: "Split squat strength candidate", category: "max_strength", blockTypes: ["spp", "gpp"], targetQualities: ["max_strength", "legs_lme"], loadMode: "e1rm_based_candidate", prescription: { sets: 3, reps: 4, durationMinutes: null, targetRpe: 7 } }, ["strength_development_candidate"]),
  performanceSeed({ id: "performance_trap_bar_hinge_strength_candidate", name: "Trap-bar hinge strength candidate", category: "max_strength", blockTypes: ["spp", "gpp"], targetQualities: ["max_strength"], loadMode: "e1rm_based_candidate", prescription: { sets: 3, reps: 3, durationMinutes: null, targetRpe: 7 } }, ["strength_development_candidate"]),
  performanceSeed({ id: "performance_bench_pull_strength_candidate", name: "Bench pull strength candidate", category: "max_strength", blockTypes: ["spp", "gpp"], targetQualities: ["max_strength", "arms_grip"], loadMode: "e1rm_based_candidate", prescription: { sets: 3, reps: 4, durationMinutes: null, targetRpe: 7 } }, ["strength_development_candidate"]),
  performanceSeed({ id: "performance_weighted_chin_candidate", name: "Weighted chin-up candidate", category: "max_strength", blockTypes: ["spp", "gpp"], targetQualities: ["max_strength", "arms_grip"], loadMode: "e1rm_based_candidate", prescription: { sets: 3, reps: 3, durationMinutes: null, targetRpe: 7 } }, ["strength_development_candidate"]),
  performanceSeed({ id: "performance_landmine_press_candidate", name: "Landmine press candidate", category: "max_strength", blockTypes: ["spp", "gpp"], targetQualities: ["max_strength", "speed_strength"], loadMode: "RPE", prescription: { sets: 3, reps: 5, durationMinutes: null, targetRpe: 6 } }, ["strength_development_candidate"]),
  performanceSeed({ id: "performance_hip_thrust_strength_candidate", name: "Hip thrust strength candidate", category: "posterior_chain", blockTypes: ["spp", "gpp"], targetQualities: ["max_strength"], loadMode: "e1rm_based_candidate", prescription: { sets: 3, reps: 4, durationMinutes: null, targetRpe: 7 } }, ["strength_development_candidate"]),
  performanceSeed({ id: "performance_nordic_hamstring_regression", name: "Nordic hamstring regression candidate", category: "posterior_chain", blockTypes: ["spp", "gpp"], targetQualities: ["max_strength", "fatigue_skill"], loadMode: "RPE", prescription: { sets: 3, reps: 4, durationMinutes: null, targetRpe: 6 } }, ["strength_development_candidate"]),
  performanceSeed({ id: "performance_copenhagen_plank_candidate", name: "Copenhagen plank candidate", category: "trunk_anti_rotation", blockTypes: ["spp", "gpp", "mobility"], targetQualities: ["max_strength", "fatigue_skill"], loadMode: "RPE", prescription: { sets: 3, reps: null, durationMinutes: 1, targetRpe: 5 } }, ["strength_development_candidate"]),
  performanceSeed({ id: "performance_farmer_carry_strength_candidate", name: "Farmer carry strength candidate", category: "strength_endurance", blockTypes: ["spp", "gpp"], targetQualities: ["arms_grip", "max_strength"], loadMode: "RPE", prescription: { sets: 3, reps: null, durationMinutes: 1, targetRpe: 6 } }, ["strength_development_candidate"]),
  performanceSeed({ id: "performance_zercher_hold_candidate", name: "Zercher hold candidate", category: "strength_endurance", blockTypes: ["spp"], targetQualities: ["max_strength", "fatigue_skill"], loadMode: "RPE", prescription: { sets: 3, reps: null, durationMinutes: 1, targetRpe: 6 } }, ["strength_development_candidate"]),
  performanceSeed({ id: "performance_sled_drag_strength_candidate", name: "Sled drag strength candidate", category: "strength_endurance", blockTypes: ["spp", "gpp"], targetQualities: ["legs_lme", "max_strength"], loadMode: "RPE", prescription: { sets: 4, reps: null, durationMinutes: 1, targetRpe: 6 } }, ["strength_development_candidate"]),
  performanceSeed({ id: "performance_medball_chest_throw_power", name: "Medicine-ball chest throw power candidate", category: "acceleration_change_of_direction", blockTypes: ["first_action_speed", "spp"], targetQualities: ["speed_strength", "max_strength"], loadMode: "RPE", prescription: { sets: 4, reps: 3, durationMinutes: null, targetRpe: 5 } }, ["strength_development_candidate", "speed_development_candidate"]),
  performanceSeed({ id: "performance_medball_rotational_slam_power", name: "Medicine-ball rotational slam power candidate", category: "acceleration_change_of_direction", blockTypes: ["first_action_speed", "spp"], targetQualities: ["speed_strength", "max_strength"], loadMode: "RPE", prescription: { sets: 4, reps: 3, durationMinutes: null, targetRpe: 5 } }, ["strength_development_candidate", "speed_development_candidate"]),
] as const satisfies readonly ExerciseSeed[];

const ENDURANCE_DEVELOPMENT_EXERCISE_SEEDS = [
  performanceSeed({ id: "performance_easy_mat_footwork_continuous", name: "Easy mat footwork continuous candidate", category: "aerobic_recovery", blockTypes: ["aerobic_deload", "gpp", "mat_light_technical"], targetQualities: ["aerobic_base", "recovery"], loadMode: "duration", prescription: { sets: null, reps: null, durationMinutes: 20, targetRpe: 3 } }, ["endurance_development_candidate", "wrestling_transfer_candidate"]),
  performanceSeed({ id: "performance_shadow_wrestling_aerobic", name: "Shadow wrestling aerobic candidate", category: "aerobic_recovery", blockTypes: ["aerobic_deload", "gpp", "mat_light_technical"], targetQualities: ["aerobic_base", "fatigue_skill"], loadMode: "duration", prescription: { sets: null, reps: null, durationMinutes: 20, targetRpe: 3 } }, ["endurance_development_candidate", "wrestling_transfer_candidate"]),
  performanceSeed({ id: "performance_bike_aerobic_base_candidate", name: "Bike aerobic base candidate", category: "aerobic_recovery", blockTypes: ["aerobic_deload", "gpp", "environment_change"], targetQualities: ["aerobic_base", "recovery"], loadMode: "duration", prescription: { sets: null, reps: null, durationMinutes: 30, targetRpe: 3 } }, ["endurance_development_candidate"]),
  performanceSeed({ id: "performance_rower_aerobic_base_candidate", name: "Rower aerobic base candidate", category: "aerobic_recovery", blockTypes: ["aerobic_deload", "gpp", "environment_change"], targetQualities: ["aerobic_base", "recovery"], loadMode: "duration", prescription: { sets: null, reps: null, durationMinutes: 25, targetRpe: 3 } }, ["endurance_development_candidate"]),
  performanceSeed({ id: "performance_outdoor_tempo_walk_run", name: "Outdoor tempo walk/run candidate", category: "aerobic_recovery", blockTypes: ["aerobic_deload", "gpp", "environment_change"], targetQualities: ["aerobic_base", "recovery"], loadMode: "duration", prescription: { sets: null, reps: null, durationMinutes: 30, targetRpe: 3 } }, ["endurance_development_candidate"]),
  performanceSeed({ id: "performance_recovery_circuit_aerobic", name: "Recovery circuit aerobic candidate", category: "aerobic_recovery", blockTypes: ["aerobic_deload", "recovery", "gpp"], targetQualities: ["aerobic_base", "recovery"], loadMode: "duration", prescription: { sets: null, reps: null, durationMinutes: 20, targetRpe: 3 } }, ["endurance_development_candidate", "exercise_complex_candidate"]),
  performanceSeed({ id: "performance_low_contact_conditioning_circuit", name: "Low-contact conditioning circuit candidate", category: "strength_endurance", blockTypes: ["gpp", "spp"], targetQualities: ["aerobic_base", "fatigue_skill"], loadMode: "duration", prescription: { sets: 3, reps: null, durationMinutes: 5, targetRpe: 5 } }, ["endurance_development_candidate", "exercise_complex_candidate"]),
  performanceSeed({ id: "performance_stance_motion_tempo", name: "Stance motion tempo candidate", category: "wrestling_stance_movement", blockTypes: ["mat_technique", "gpp"], targetQualities: ["aerobic_base", "fatigue_skill"], loadMode: "duration", prescription: { sets: 3, reps: null, durationMinutes: 3, targetRpe: 4 } }, ["endurance_development_candidate", "wrestling_transfer_candidate"]),
  performanceSeed({ id: "performance_grip_aerobic_flush", name: "Grip aerobic flush candidate", category: "grip_hand_fighting", blockTypes: ["aerobic_deload", "recovery", "spp"], targetQualities: ["aerobic_base", "arms_grip"], loadMode: "duration", prescription: { sets: 2, reps: null, durationMinutes: 3, targetRpe: 3 } }, ["endurance_development_candidate", "wrestling_transfer_candidate"]),
  performanceSeed({ id: "performance_partner_movement_aerobic", name: "Partner movement aerobic candidate", category: "wrestling_stance_movement", blockTypes: ["mat_light_technical", "gpp"], targetQualities: ["aerobic_base", "fatigue_skill"], loadMode: "duration", prescription: { sets: 3, reps: null, durationMinutes: 3, targetRpe: 4 } }, ["endurance_development_candidate", "wrestling_transfer_candidate"]),
  performanceSeed({ id: "performance_technical_chain_aerobic", name: "Technical chain aerobic candidate", category: "shots_entries", blockTypes: ["mat_light_technical", "gpp"], targetQualities: ["aerobic_base", "fatigue_skill"], loadMode: "duration", prescription: { sets: 3, reps: null, durationMinutes: 3, targetRpe: 4 } }, ["endurance_development_candidate", "wrestling_transfer_candidate"]),
  performanceSeed({ id: "performance_post_contact_flush", name: "Post-contact flush candidate", category: "aerobic_recovery", blockTypes: ["aerobic_deload", "recovery", "post_competition_recovery"], targetQualities: ["aerobic_base", "recovery"], loadMode: "duration", prescription: { sets: null, reps: null, durationMinutes: 20, targetRpe: 2 } }, ["endurance_development_candidate"]),
] as const satisfies readonly ExerciseSeed[];

const EXERCISE_COMPLEX_SEEDS = [
  performanceSeed({ id: "complex_stance_entry_defense", name: "Complex: stance-entry-defense", category: "tactical_score_situation", blockTypes: ["mat_technique", "mat_tactics"], targetQualities: ["fatigue_skill"], loadMode: "technical_quality", prescription: { sets: 3, reps: 4, durationMinutes: null, targetRpe: 5 } }, ["exercise_complex_candidate", "wrestling_transfer_candidate"]),
  performanceSeed({ id: "complex_handfight_shot_finish", name: "Complex: hand-fight-shot-finish", category: "tactical_score_situation", blockTypes: ["mat_tactics", "mat_competition_model"], targetQualities: ["fatigue_skill", "wrestling_contact_density"], loadMode: "technical_quality", prescription: { sets: 3, reps: 4, durationMinutes: null, targetRpe: 5 } }, ["exercise_complex_candidate", "wrestling_transfer_candidate"]),
  performanceSeed({ id: "complex_par_terre_top_pressure", name: "Complex: par terre top pressure", category: "par_terre_top", blockTypes: ["mat_technique", "mat_tactics", "spp"], targetQualities: ["fatigue_skill"], loadMode: "technical_quality", prescription: { sets: 3, reps: 4, durationMinutes: null, targetRpe: 5 } }, ["exercise_complex_candidate", "wrestling_transfer_candidate"]),
  performanceSeed({ id: "complex_bottom_escape_rescore", name: "Complex: bottom escape and rescore", category: "par_terre_bottom", blockTypes: ["mat_technique", "mat_tactics"], targetQualities: ["fatigue_skill"], loadMode: "technical_quality", prescription: { sets: 3, reps: 4, durationMinutes: null, targetRpe: 5 } }, ["exercise_complex_candidate", "wrestling_transfer_candidate"]),
  performanceSeed({ id: "complex_strength_power_transfer", name: "Complex: strength-power transfer", category: "strength_endurance", blockTypes: ["spp", "first_action_speed"], targetQualities: ["speed_strength", "max_strength"], loadMode: "RPE", prescription: { sets: 3, reps: 3, durationMinutes: null, targetRpe: 6 } }, ["exercise_complex_candidate", "strength_development_candidate", "speed_development_candidate"]),
  performanceSeed({ id: "complex_posterior_chain_trunk", name: "Complex: posterior chain and trunk", category: "posterior_chain", blockTypes: ["spp", "gpp"], targetQualities: ["max_strength", "fatigue_skill"], loadMode: "RPE", prescription: { sets: 3, reps: 5, durationMinutes: null, targetRpe: 6 } }, ["exercise_complex_candidate", "strength_development_candidate"]),
  performanceSeed({ id: "complex_grip_par_terre", name: "Complex: grip and par terre pressure", category: "strength_endurance", blockTypes: ["spp", "mat_tactics"], targetQualities: ["arms_grip", "fatigue_skill"], loadMode: "duration", prescription: { sets: 3, reps: null, durationMinutes: 2, targetRpe: 6 } }, ["exercise_complex_candidate", "strength_development_candidate", "wrestling_transfer_candidate"]),
  performanceSeed({ id: "complex_lme_entry_transfer", name: "Complex: leg LME to entry transfer", category: "local_muscular_endurance_legs", blockTypes: ["leg_lmv", "spp", "mat_technique"], targetQualities: ["legs_lme", "fatigue_skill"], loadMode: "duration", prescription: { sets: 3, reps: null, durationMinutes: 2, targetRpe: 6 } }, ["exercise_complex_candidate", "wrestling_transfer_candidate"]),
  performanceSeed({ id: "complex_taper_neural_activation", name: "Complex: taper neural activation", category: "speed_first_action", blockTypes: ["first_action_speed", "mat_light_technical"], targetQualities: ["speed_first_action", "taper_quality"], loadMode: "technical_quality", prescription: { sets: 3, reps: 2, durationMinutes: null, targetRpe: 4 } }, ["exercise_complex_candidate", "speed_development_candidate", "wrestling_transfer_candidate"]),
  performanceSeed({ id: "complex_travel_reset", name: "Complex: travel reset", category: "travel_mobility", blockTypes: ["travel", "mobility", "recovery"], targetQualities: ["recovery"], loadMode: "duration", prescription: { sets: null, reps: null, durationMinutes: 12, targetRpe: 2 } }, ["exercise_complex_candidate", "endurance_development_candidate"]),
  performanceSeed({ id: "complex_post_competition_recovery", name: "Complex: post-competition recovery", category: "post_competition_recovery", blockTypes: ["post_competition_recovery", "recovery"], targetQualities: ["recovery"], loadMode: "duration", prescription: { sets: null, reps: null, durationMinutes: 20, targetRpe: 2 } }, ["exercise_complex_candidate", "endurance_development_candidate"]),
  performanceSeed({ id: "complex_competition_exchange_model", name: "Complex: competition exchange model", category: "competition_model", blockTypes: ["mat_competition_model"], targetQualities: ["wrestling_contact_density", "fatigue_skill"], loadMode: "duration", prescription: { sets: 2, reps: null, durationMinutes: 4, targetRpe: 6 } }, ["exercise_complex_candidate", "speed_endurance_candidate", "wrestling_transfer_candidate"]),
  performanceSeed({ id: "complex_no_contact_conditioning", name: "Complex: no-contact conditioning", category: "strength_endurance", blockTypes: ["gpp", "aerobic_deload"], targetQualities: ["aerobic_base", "fatigue_skill"], loadMode: "duration", prescription: { sets: 3, reps: null, durationMinutes: 4, targetRpe: 5 } }, ["exercise_complex_candidate", "endurance_development_candidate"]),
  performanceSeed({ id: "complex_mat_edge_scenario", name: "Complex: mat-edge scenario", category: "edge_of_mat", blockTypes: ["mat_tactics", "mat_competition_model"], targetQualities: ["fatigue_skill", "wrestling_contact_density"], loadMode: "technical_quality", prescription: { sets: 3, reps: 3, durationMinutes: null, targetRpe: 5 } }, ["exercise_complex_candidate", "wrestling_transfer_candidate"]),
] as const satisfies readonly ExerciseSeed[];

const EXERCISE_SEEDS = [
  ...SPEED_DEVELOPMENT_EXERCISE_SEEDS,
  ...SPEED_ENDURANCE_EXERCISE_SEEDS,
  ...STRENGTH_DEVELOPMENT_EXERCISE_SEEDS,
  ...ENDURANCE_DEVELOPMENT_EXERCISE_SEEDS,
  ...EXERCISE_COMPLEX_SEEDS,
  ...SELUYANOV_STATODYNAMIC_EXERCISE_SEEDS,
  { id: "stance_level_change_flow", name: "Stance level-change flow", category: "wrestling_stance_movement", blockTypes: ["mat_technique", "mat_light_technical"], targetQualities: ["fatigue_skill", "taper_quality"] },
  { id: "stance_circle_pressure", name: "Stance circle pressure", category: "wrestling_stance_movement", blockTypes: ["mat_technique"], targetQualities: ["fatigue_skill"] },
  { id: "stance_reaction_mirror", name: "Partner mirror stance reaction", category: "wrestling_stance_movement", blockTypes: ["mat_technique", "first_action_speed"], targetQualities: ["fatigue_skill", "speed_first_action"] },
  { id: "level_change_to_tie", name: "Level change to tie-up", category: "wrestling_stance_movement", blockTypes: ["mat_tactics", "mat_technique"], targetQualities: ["fatigue_skill"] },
  { id: "stance_sprawl_recover", name: "Stance-sprawl-recover chain", category: "wrestling_stance_movement", blockTypes: ["mat_technique", "mat_light_technical"], targetQualities: ["fatigue_skill", "taper_quality"] },
  { id: "single_leg_entry_finish", name: "Single-leg entry and finish", category: "shots_entries", blockTypes: ["mat_technique", "mat_tactics"], targetQualities: ["fatigue_skill"] },
  { id: "double_leg_penetration_step", name: "Double-leg penetration step", category: "shots_entries", blockTypes: ["mat_technique"], targetQualities: ["fatigue_skill"] },
  { id: "high_crotch_angle_finish", name: "High-crotch angle finish", category: "shots_entries", blockTypes: ["mat_technique", "mat_tactics"], targetQualities: ["fatigue_skill"] },
  { id: "snap_down_go_behind", name: "Snap-down to go-behind", category: "shots_entries", blockTypes: ["mat_tactics", "mat_competition_model"], targetQualities: ["fatigue_skill", "wrestling_contact_density"] },
  { id: "shot_reshoot_sequence", name: "Shot to re-shot sequence", category: "shots_entries", blockTypes: ["mat_tactics", "mat_competition_model"], targetQualities: ["fatigue_skill", "wrestling_contact_density"] },
  { id: "front_headlock_entry", name: "Front headlock entry", category: "shots_entries", blockTypes: ["mat_tactics", "mat_technique"], targetQualities: ["fatigue_skill"] },
  { id: "short_offense_corner_finish", name: "Short offense corner finish", category: "shots_entries", blockTypes: ["mat_tactics", "mat_competition_model"], targetQualities: ["fatigue_skill"] },
  { id: "sprawl_hip_pressure", name: "Sprawl with hip pressure", category: "defense_sprawl", blockTypes: ["mat_technique", "mat_tactics"], targetQualities: ["fatigue_skill"] },
  { id: "sprawl_go_behind", name: "Sprawl to go-behind", category: "defense_sprawl", blockTypes: ["mat_tactics"], targetQualities: ["fatigue_skill"] },
  { id: "whizzer_square_up", name: "Whizzer and square-up", category: "defense_sprawl", blockTypes: ["mat_tactics", "mat_competition_model"], targetQualities: ["fatigue_skill", "wrestling_contact_density"] },
  { id: "down_block_recover", name: "Down-block and recover stance", category: "defense_sprawl", blockTypes: ["mat_light_technical", "mat_technique"], targetQualities: ["taper_quality", "fatigue_skill"] },
  { id: "leg_defense_chain", name: "Leg defense chain", category: "defense_sprawl", blockTypes: ["mat_competition_model", "mat_tactics"], targetQualities: ["wrestling_contact_density"] },
  { id: "par_terre_top_pressure_ride", name: "Par terre top pressure ride", category: "par_terre_top", blockTypes: ["mat_technique", "mat_tactics"], targetQualities: ["fatigue_skill"] },
  { id: "gut_wrench_position_rehearsal", name: "Gut-wrench position rehearsal", category: "par_terre_top", blockTypes: ["mat_technique"], targetQualities: ["fatigue_skill"] },
  { id: "turn_setup_without_force", name: "Turn setup without forced range", category: "par_terre_top", blockTypes: ["mat_light_technical", "mat_tactics"], targetQualities: ["taper_quality", "fatigue_skill"] },
  { id: "top_transition_to_finish", name: "Top transition to finish", category: "par_terre_top", blockTypes: ["mat_competition_model"], targetQualities: ["wrestling_contact_density"] },
  { id: "par_terre_bottom_base_build", name: "Par terre bottom base build", category: "par_terre_bottom", blockTypes: ["mat_technique"], targetQualities: ["fatigue_skill"] },
  { id: "bottom_hip_escape", name: "Bottom hip escape", category: "par_terre_bottom", blockTypes: ["mat_technique", "mat_tactics"], targetQualities: ["fatigue_skill"] },
  { id: "stand_up_from_pressure", name: "Stand-up from pressure", category: "par_terre_bottom", blockTypes: ["mat_tactics"], targetQualities: ["fatigue_skill"] },
  { id: "bottom_defense_round", name: "Bottom defense round", category: "par_terre_bottom", blockTypes: ["mat_competition_model"], targetQualities: ["wrestling_contact_density"] },
  { id: "inside_tie_clear", name: "Inside tie clear", category: "grip_hand_fighting", blockTypes: ["mat_tactics", "mat_technique"], targetQualities: ["fatigue_skill"] },
  { id: "two_on_one_position", name: "Two-on-one position control", category: "grip_hand_fighting", blockTypes: ["mat_tactics"], targetQualities: ["fatigue_skill"] },
  { id: "underhook_pummel", name: "Underhook pummel", category: "grip_hand_fighting", blockTypes: ["mat_technique", "mat_tactics"], targetQualities: ["fatigue_skill"] },
  { id: "wrist_control_to_attack", name: "Wrist control to attack", category: "grip_hand_fighting", blockTypes: ["mat_tactics", "mat_competition_model"], targetQualities: ["fatigue_skill", "wrestling_contact_density"] },
  { id: "hand_fight_short_burst", name: "Hand-fight short burst", category: "grip_hand_fighting", blockTypes: ["mat_competition_model", "mat_control_bouts"], targetQualities: ["wrestling_contact_density"] },
  { id: "edge_circle_in", name: "Edge circle-in drill", category: "edge_of_mat", blockTypes: ["mat_tactics"], targetQualities: ["fatigue_skill"] },
  { id: "edge_attack_before_stepout", name: "Edge attack before step-out", category: "edge_of_mat", blockTypes: ["mat_tactics", "mat_competition_model"], targetQualities: ["wrestling_contact_density"] },
  { id: "edge_defend_score", name: "Edge defend and score", category: "edge_of_mat", blockTypes: ["mat_competition_model"], targetQualities: ["wrestling_contact_density"] },
  { id: "edge_reset_under_pressure", name: "Edge reset under pressure", category: "edge_of_mat", blockTypes: ["mat_light_technical", "mat_tactics"], targetQualities: ["taper_quality", "fatigue_skill"] },
  { id: "score_lead_last_30", name: "Score lead last-clock scenario", category: "tactical_score_situation", blockTypes: ["mat_tactics", "mat_competition_model"], targetQualities: ["fatigue_skill", "wrestling_contact_density"] },
  { id: "score_down_last_30", name: "Score down last-clock scenario", category: "tactical_score_situation", blockTypes: ["mat_tactics", "mat_competition_model"], targetQualities: ["fatigue_skill", "wrestling_contact_density"] },
  { id: "passivity_response", name: "Passivity response scenario", category: "tactical_score_situation", blockTypes: ["mat_tactics"], targetQualities: ["fatigue_skill"] },
  { id: "restart_position_choice", name: "Restart position choice", category: "tactical_score_situation", blockTypes: ["mat_tactics", "mat_light_technical"], targetQualities: ["fatigue_skill", "taper_quality"] },
  { id: "match_period_model", name: "Match period model", category: "competition_model", blockTypes: ["mat_competition_model"], targetQualities: ["wrestling_contact_density"] },
  { id: "late_period_finish_model", name: "Late-period finish model", category: "competition_model", blockTypes: ["mat_competition_model"], targetQualities: ["wrestling_contact_density"] },
  { id: "three_exchange_model", name: "Three-exchange model", category: "competition_model", blockTypes: ["mat_competition_model"], targetQualities: ["wrestling_contact_density"] },
  { id: "between_bout_reset_model", name: "Between-bout reset model", category: "competition_model", blockTypes: ["competition_start", "mat_light_technical"], targetQualities: ["taper_quality"] },
  { id: "controlled_bout_one_goal", name: "Controlled bout with one goal", category: "controlled_bout", blockTypes: ["mat_control_bouts"], targetQualities: ["wrestling_contact_density"] },
  { id: "controlled_bout_short_score", name: "Controlled bout from score scenario", category: "controlled_bout", blockTypes: ["mat_control_bouts"], targetQualities: ["wrestling_contact_density"] },
  { id: "controlled_bout_position_start", name: "Controlled bout from position start", category: "controlled_bout", blockTypes: ["mat_control_bouts"], targetQualities: ["wrestling_contact_density"] },
  { id: "first_step_sprint_10m", name: "First-step sprint", category: "speed_first_action", blockTypes: ["first_action_speed"], targetQualities: ["speed_first_action"] },
  { id: "signal_shot_entry", name: "Signal shot entry", category: "speed_first_action", blockTypes: ["first_action_speed", "mat_light_technical"], targetQualities: ["speed_first_action", "taper_quality"] },
  { id: "reaction_sprawl_to_shot", name: "Reaction sprawl to shot", category: "speed_first_action", blockTypes: ["first_action_speed", "mat_technique"], targetQualities: ["speed_first_action"] },
  { id: "first_contact_win", name: "First-contact win drill", category: "speed_first_action", blockTypes: ["first_action_speed", "mat_tactics"], targetQualities: ["speed_first_action"] },
  { id: "accel_10m_falling_start", name: "Falling-start acceleration", category: "acceleration_change_of_direction", blockTypes: ["first_action_speed", "gpp"], targetQualities: ["speed_first_action", "aerobic_base"] },
  { id: "shuffle_cut_recover", name: "Shuffle-cut recover", category: "acceleration_change_of_direction", blockTypes: ["first_action_speed", "gpp"], targetQualities: ["speed_first_action"] },
  { id: "deceleration_stick", name: "Deceleration stick", category: "acceleration_change_of_direction", blockTypes: ["gpp", "first_action_speed"], targetQualities: ["speed_first_action"] },
  { id: "medball_rotational_throw", name: "Medicine-ball rotational throw", category: "acceleration_change_of_direction", blockTypes: ["first_action_speed", "spp"], targetQualities: ["speed_first_action", "fatigue_skill"] },
  { id: "front_squat_candidate", name: "Front squat candidate", category: "max_strength", blockTypes: ["spp", "gpp"], targetQualities: ["max_strength"], loadMode: "e1rm_based_candidate" },
  { id: "trap_bar_deadlift_candidate", name: "Trap-bar deadlift candidate", category: "max_strength", blockTypes: ["spp", "gpp"], targetQualities: ["max_strength"], loadMode: "e1rm_based_candidate" },
  { id: "weighted_pull_candidate", name: "Weighted pull candidate", category: "max_strength", blockTypes: ["spp", "gpp"], targetQualities: ["max_strength", "arms_grip"], loadMode: "e1rm_based_candidate" },
  { id: "bench_pull_candidate", name: "Bench pull candidate", category: "max_strength", blockTypes: ["spp"], targetQualities: ["max_strength", "arms_grip"], loadMode: "e1rm_based_candidate" },
  { id: "push_press_candidate", name: "Push press candidate", category: "max_strength", blockTypes: ["spp"], targetQualities: ["max_strength", "speed_strength"], loadMode: "percent_1rm_candidate" },
  { id: "sled_push_moderate", name: "Sled push moderate", category: "strength_endurance", blockTypes: ["spp", "gpp"], targetQualities: ["fatigue_skill", "legs_lme"] },
  { id: "kettlebell_front_rack_carry", name: "Kettlebell front-rack carry", category: "strength_endurance", blockTypes: ["spp", "gpp"], targetQualities: ["fatigue_skill", "arms_grip"] },
  { id: "rope_pull_or_towel_pull", name: "Rope or towel pull", category: "strength_endurance", blockTypes: ["spp"], targetQualities: ["arms_grip", "fatigue_skill"] },
  { id: "bodyweight_circuit_controlled", name: "Bodyweight circuit controlled", category: "strength_endurance", blockTypes: ["spp", "gpp"], targetQualities: ["fatigue_skill"] },
  { id: "partner_pummel_strength_endurance", name: "Partner pummel strength endurance", category: "strength_endurance", blockTypes: ["spp", "mat_tactics"], targetQualities: ["fatigue_skill"] },
  { id: "statodynamic_squat", name: "Statodynamic squat", category: "local_muscular_endurance_legs", blockTypes: ["leg_lmv"], targetQualities: ["legs_lme"] },
  { id: "split_squat_iso_dynamic", name: "Split-squat iso-dynamic", category: "local_muscular_endurance_legs", blockTypes: ["leg_lmv"], targetQualities: ["legs_lme"] },
  { id: "wall_sit_entry_transfer", name: "Wall-sit to entry transfer", category: "local_muscular_endurance_legs", blockTypes: ["leg_lmv"], targetQualities: ["legs_lme"] },
  { id: "lateral_lunge_lmv", name: "Lateral lunge LMV", category: "local_muscular_endurance_legs", blockTypes: ["leg_lmv", "spp"], targetQualities: ["legs_lme"] },
  { id: "step_up_lmv", name: "Step-up LMV", category: "local_muscular_endurance_legs", blockTypes: ["leg_lmv", "spp"], targetQualities: ["legs_lme"] },
  { id: "romanian_deadlift_control", name: "Romanian deadlift control", category: "posterior_chain", blockTypes: ["spp", "gpp"], targetQualities: ["max_strength", "fatigue_skill"] },
  { id: "hip_thrust_control", name: "Hip thrust control", category: "posterior_chain", blockTypes: ["spp", "gpp"], targetQualities: ["max_strength"] },
  { id: "hamstring_walkout", name: "Hamstring walkout", category: "posterior_chain", blockTypes: ["spp", "gpp"], targetQualities: ["fatigue_skill"] },
  { id: "single_leg_rdl", name: "Single-leg RDL", category: "posterior_chain", blockTypes: ["spp", "gpp"], targetQualities: ["fatigue_skill"] },
  { id: "pallof_press", name: "Pallof press", category: "trunk_anti_rotation", blockTypes: ["spp", "gpp", "mobility"], targetQualities: ["fatigue_skill", "recovery"] },
  { id: "dead_bug_breathing", name: "Dead bug breathing", category: "trunk_anti_rotation", blockTypes: ["mobility", "recovery"], targetQualities: ["recovery"] },
  { id: "side_plank_row", name: "Side plank row", category: "trunk_anti_rotation", blockTypes: ["spp", "gpp"], targetQualities: ["fatigue_skill"] },
  { id: "medicine_ball_anti_rotation_catch", name: "Medicine-ball anti-rotation catch", category: "trunk_anti_rotation", blockTypes: ["spp", "first_action_speed"], targetQualities: ["speed_strength"] },
  { id: "neck_isometric_four_way", name: "Neck isometric four-way", category: "neck_prehab", blockTypes: ["mobility", "recovery", "spp"], targetQualities: ["recovery"], reviewRequired: ["coach", "medical"], highRiskAutomationBlocked: true },
  { id: "band_neck_control", name: "Band neck control", category: "neck_prehab", blockTypes: ["mobility", "recovery"], targetQualities: ["recovery"], reviewRequired: ["coach", "medical"], highRiskAutomationBlocked: true },
  { id: "shoulder_cars", name: "Shoulder controlled articular rotations", category: "mobility", blockTypes: ["mobility", "recovery"], targetQualities: ["recovery"] },
  { id: "hip_airplane_assisted", name: "Assisted hip airplane", category: "mobility", blockTypes: ["mobility", "recovery"], targetQualities: ["recovery"] },
  { id: "ankle_rocker_mobility", name: "Ankle rocker mobility", category: "mobility", blockTypes: ["mobility", "recovery", "travel"], targetQualities: ["recovery"] },
  { id: "thoracic_rotation_flow", name: "Thoracic rotation flow", category: "mobility", blockTypes: ["mobility", "recovery", "travel"], targetQualities: ["recovery"] },
  { id: "adductor_rockback", name: "Adductor rock-back", category: "mobility", blockTypes: ["mobility", "recovery"], targetQualities: ["recovery"] },
  { id: "easy_bike_recovery", name: "Easy bike recovery", category: "aerobic_recovery", blockTypes: ["aerobic_deload", "recovery", "environment_change"], targetQualities: ["aerobic_base", "recovery"] },
  { id: "easy_run_walk", name: "Easy run/walk", category: "aerobic_recovery", blockTypes: ["aerobic_deload", "gpp", "environment_change"], targetQualities: ["aerobic_base", "recovery"] },
  { id: "rower_easy_flush", name: "Rower easy flush", category: "aerobic_recovery", blockTypes: ["aerobic_deload", "recovery"], targetQualities: ["aerobic_base", "recovery"] },
  { id: "outdoor_walk_reset", name: "Outdoor walk reset", category: "aerobic_recovery", blockTypes: ["environment_change", "recovery", "travel"], targetQualities: ["recovery", "aerobic_base"] },
  { id: "long_exhale_reset", name: "Long-exhale reset", category: "breathing_downregulation", blockTypes: ["recovery", "mobility", "post_competition_recovery"], targetQualities: ["recovery"] },
  { id: "box_breath_easy", name: "Easy box-breath reset", category: "breathing_downregulation", blockTypes: ["recovery", "travel", "weigh_in"], targetQualities: ["recovery", "weight_management"] },
  { id: "supine_breathing_feet_up", name: "Supine breathing feet-up", category: "breathing_downregulation", blockTypes: ["recovery", "post_competition_recovery"], targetQualities: ["recovery"] },
  { id: "travel_hip_ankle_flow", name: "Travel hip/ankle flow", category: "travel_mobility", blockTypes: ["travel", "mobility"], targetQualities: ["recovery"] },
  { id: "hotel_room_mobility", name: "Hotel-room mobility", category: "travel_mobility", blockTypes: ["travel", "mobility", "environment_change"], targetQualities: ["recovery"] },
  { id: "post_flight_walk_reset", name: "Post-travel walk reset", category: "travel_mobility", blockTypes: ["travel", "environment_change"], targetQualities: ["recovery"] },
  { id: "weigh_in_readiness_checklist", name: "Weigh-in readiness checklist", category: "weigh_in_day_activation", blockTypes: ["weigh_in"], targetQualities: ["weight_management"], reviewRequired: ["coach", "medical"], highRiskAutomationBlocked: true },
  { id: "weigh_in_light_movement", name: "Weigh-in light movement", category: "weigh_in_day_activation", blockTypes: ["weigh_in", "mat_light_technical"], targetQualities: ["weight_management", "taper_quality"], reviewRequired: ["coach", "medical"], highRiskAutomationBlocked: true },
  { id: "weigh_in_signal_entry_only", name: "Weigh-in signal entry only", category: "weigh_in_day_activation", blockTypes: ["weigh_in", "first_action_speed"], targetQualities: ["weight_management", "speed_first_action"], reviewRequired: ["coach", "medical"], highRiskAutomationBlocked: true },
  { id: "heat_exposure_review_blocked_note", name: "Heat exposure review blocked note", category: "weigh_in_day_activation", blockTypes: ["sauna", "weigh_in"], targetQualities: ["weight_management"], reviewRequired: ["coach", "medical"], highRiskAutomationBlocked: true },
  { id: "post_competition_walk_mobility", name: "Post-competition walk and mobility", category: "post_competition_recovery", blockTypes: ["post_competition_recovery", "recovery"], targetQualities: ["recovery"] },
  { id: "post_competition_symptom_review", name: "Post-competition symptom review", category: "post_competition_recovery", blockTypes: ["post_competition_recovery"], targetQualities: ["recovery"], reviewRequired: ["coach", "medical"], highRiskAutomationBlocked: true },
  { id: "post_competition_easy_aerobic", name: "Post-competition easy aerobic", category: "post_competition_recovery", blockTypes: ["post_competition_recovery", "aerobic_deload"], targetQualities: ["recovery", "aerobic_base"] },
] as const satisfies readonly ExerciseSeed[];

export const CONSTRUCTOR_MATRIX_EXERCISE_LIBRARY = EXERCISE_SEEDS.map(makeExercise);

export type ConstructorMatrixExerciseId =
  (typeof CONSTRUCTOR_MATRIX_EXERCISE_LIBRARY)[number]["id"];

export const CONSTRUCTOR_MATRIX_EXERCISE_LIBRARY_IDS =
  CONSTRUCTOR_MATRIX_EXERCISE_LIBRARY.map((item) => item.id);

export function listConstructorMatrixExerciseIds(): ConstructorMatrixExerciseId[] {
  return [...CONSTRUCTOR_MATRIX_EXERCISE_LIBRARY_IDS] as ConstructorMatrixExerciseId[];
}

export function getConstructorMatrixExercise(
  id: string,
): ConstructorMatrixExercise | null {
  return CONSTRUCTOR_MATRIX_EXERCISE_LIBRARY.find((item) => item.id === id) ?? null;
}

export function getConstructorMatrixExercisesForBlockType(
  blockType: ConstructorTrainingBlockType,
): ConstructorMatrixExercise[] {
  return CONSTRUCTOR_MATRIX_EXERCISE_LIBRARY.filter((item) =>
    item.blockTypes.includes(blockType),
  );
}

export function buildConstructorMatrixExerciseLibrarySummary() {
  const blockTypes = new Map<ConstructorTrainingBlockType, number>();
  const categories = new Map<ConstructorMatrixExerciseCategory, number>();
  const methodologyTags = new Map<ConstructorMatrixExerciseMethodologyTag, number>();
  const reviewRequired = CONSTRUCTOR_MATRIX_EXERCISE_LIBRARY.filter(
    (item) => item.reviewRequired.length > 0,
  ).length;
  const highRiskBlocked = CONSTRUCTOR_MATRIX_EXERCISE_LIBRARY.filter(
    (item) => item.highRiskAutomationBlocked,
  ).length;

  for (const item of CONSTRUCTOR_MATRIX_EXERCISE_LIBRARY) {
    categories.set(item.category, (categories.get(item.category) ?? 0) + 1);

    for (const blockType of item.blockTypes) {
      blockTypes.set(blockType, (blockTypes.get(blockType) ?? 0) + 1);
    }

    for (const methodologyTag of item.methodologyTags) {
      methodologyTags.set(
        methodologyTag,
        (methodologyTags.get(methodologyTag) ?? 0) + 1,
      );
    }
  }

  return {
    exerciseCount: CONSTRUCTOR_MATRIX_EXERCISE_LIBRARY.length,
    byCategory: Object.fromEntries(categories),
    byBlockType: Object.fromEntries(blockTypes),
    byMethodologyTag: Object.fromEntries(methodologyTags),
    reviewRequiredCount: reviewRequired,
    highRiskAutomationBlockedCount: highRiskBlocked,
    humanReviewed: false,
  };
}
