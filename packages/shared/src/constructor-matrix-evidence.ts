export type ConstructorMatrixEvidenceLevel = "A" | "B" | "C" | "A/B" | "B/C" | "A/B/C";

export type ConstructorMatrixEvidenceType =
  | "direct_training_intervention"
  | "position_stand"
  | "sport_policy"
  | "transfer_grappling_evidence"
  | "coach_school"
  | "internal_validation";

export type ConstructorMatrixEvidenceRiskArea =
  | "calendar"
  | "phase"
  | "week_type"
  | "day_type"
  | "session_slot"
  | "block_eligibility"
  | "volume"
  | "risk_check"
  | "explanation"
  | "rollout"
  | "save_dry_run"
  | "weight_cut"
  | "hydration"
  | "readiness"
  | "wearable_data"
  | "travel"
  | "weigh_in"
  | "competition_day"
  | "post_competition"
  | "lmv"
  | "bfr_kaatsu"
  | "contact_load"
  | "competition_model"
  | "taper"
  | "female_context"
  | "youth_context"
  | "injury_pain"
  | "legacy_safety";

export type ConstructorMatrixEvidenceAutomationReadiness =
  | "auto_allowed"
  | "soft_rule_only"
  | "risk_warning_only"
  | "coach_review_required"
  | "medical_review_required"
  | "internal_case_only"
  | "evidence_only"
  | "do_not_automate";

export type ConstructorMatrixEvidenceReviewStatus =
  | "draft"
  | "audit_only"
  | "coach_review_required"
  | "medical_review_required"
  | "approved_for_internal_pilot"
  | "approved_for_soft_rule"
  | "approved_for_hard_rule"
  | "blocked_for_default";

export type ConstructorMatrixEvidenceRuleNature =
  | "evidence_rule"
  | "coaching_heuristic"
  | "internal_case_pattern"
  | "product_rollout_guard"
  | "runtime_safety_guard"
  | "methodology_framework"
  | "gap_marker";

export interface ConstructorMatrixEvidenceDependency {
  id: string;
  level: ConstructorMatrixEvidenceLevel;
  type: ConstructorMatrixEvidenceType;
  title: string;
  sourceDoc: string;
  supports: string[];
  limitations: string[];
  riskAreas: ConstructorMatrixEvidenceRiskArea[];
  auditRefs: string[];
  automationReadiness: ConstructorMatrixEvidenceAutomationReadiness;
  reviewStatus: ConstructorMatrixEvidenceReviewStatus;
  ruleNature: ConstructorMatrixEvidenceRuleNature;
}

export const CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY = [
  {
    id: "perform_evidence_matrix",
    level: "A/B/C",
    type: "coach_school",
    title: "PERFORM Evidence Matrix v1",
    sourceDoc: "docs/perform-cycle-evidence-matrix.md",
    supports: [
      "Working evidence levels, evidence types, generator safety rules and monitoring data requirements.",
    ],
    limitations: [
      "This is a synthesis document, so high-risk rules still need specific source ids and limitations.",
    ],
    riskAreas: ["phase", "block_eligibility", "risk_check", "explanation"],
    auditRefs: ["EDG-14"],
    automationReadiness: "evidence_only",
    reviewStatus: "audit_only",
    ruleNature: "methodology_framework",
  },
  {
    id: "constructor_core_stack",
    level: "C",
    type: "coach_school",
    title: "PERFORM Constructor Core Stack",
    sourceDoc: "docs/perform-constructor-core-stack.md",
    supports: [
      "Calendar-first constructor flow, season strategy snapshot, exact days-to-start and safe fallback behavior.",
    ],
    limitations: [
      "It defines product logic; it does not replace sport-science evidence for load thresholds.",
    ],
    riskAreas: ["calendar", "phase", "rollout", "legacy_safety"],
    auditRefs: ["EDG-01", "EDG-13", "EDG-16"],
    automationReadiness: "soft_rule_only",
    reviewStatus: "approved_for_internal_pilot",
    ruleNature: "methodology_framework",
  },
  {
    id: "matrix_transition_plan",
    level: "C",
    type: "coach_school",
    title: "Constructor Phase Matrix Transition Plan",
    sourceDoc: "docs/constructor-phase-matrix-transition-plan.md",
    supports: [
      "Phase/week/day/session/block matrix, compatibility-card migration and explicit close-start restrictions.",
    ],
    limitations: [
      "It is an implementation transition plan; each matrix rule still needs evidence traceability.",
    ],
    riskAreas: ["phase", "week_type", "day_type", "session_slot", "block_eligibility"],
    auditRefs: ["EDG-02", "EDG-06", "EDG-14"],
    automationReadiness: "evidence_only",
    reviewStatus: "approved_for_internal_pilot",
    ruleNature: "methodology_framework",
  },
  {
    id: "europe_pre_competition_plan",
    level: "C",
    type: "coach_school",
    title: "Europe 2026 pre-competition plan analysis",
    sourceDoc: "docs/europe-2026-plan-analysis.md",
    supports: [
      "Successful 23-day pre-competition structure, taper rhythm, competition modeling, weight control and daily readiness monitoring.",
    ],
    limitations: [
      "It is a coach-validated exemplar, not a universal protocol for every athlete or competition.",
    ],
    riskAreas: ["taper", "competition_model", "weight_cut", "readiness", "contact_load"],
    auditRefs: ["EDG-02", "EDG-03", "EDG-04", "EDG-09", "EDG-10"],
    automationReadiness: "internal_case_only",
    reviewStatus: "approved_for_internal_pilot",
    ruleNature: "internal_case_pattern",
  },
  {
    id: "periodization_taper_peaking",
    level: "A/B/C",
    type: "position_stand",
    title: "Periodization, taper and peaking logic",
    sourceDoc: "docs/perform-cycle-builder-methodology.md",
    supports: [
      "Reducing volume close to competition while preserving quality, specificity, freshness and short activation.",
    ],
    limitations: [
      "Exact taper magnitude and timing must be individualized; this source does not define automatic numeric thresholds.",
    ],
    riskAreas: ["taper", "phase", "volume", "competition_day", "risk_check"],
    auditRefs: ["EDG-02", "EDG-03", "EDG-08"],
    automationReadiness: "soft_rule_only",
    reviewStatus: "approved_for_soft_rule",
    ruleNature: "evidence_rule",
  },
  {
    id: "wrestling_temporal_structure",
    level: "B/C",
    type: "coach_school",
    title: "Wrestling temporal and competition-model structure",
    sourceDoc: "docs/europe-2026-plan-analysis.md",
    supports: [
      "Competition model blocks, round structures, late-round quality and contact-density decisions.",
    ],
    limitations: [
      "Bout structure must become typed data instead of free text before broad automation.",
    ],
    riskAreas: ["competition_model", "contact_load", "day_type", "session_slot"],
    auditRefs: ["EDG-09"],
    automationReadiness: "soft_rule_only",
    reviewStatus: "approved_for_soft_rule",
    ruleNature: "methodology_framework",
  },
  {
    id: "bfr_kaatsu_local_metabolic",
    level: "A/B",
    type: "position_stand",
    title: "BFR/KAATSU local metabolic stimulus and safety",
    sourceDoc: "docs/perform-cycle-international-evidence.md",
    supports: [
      "Local metabolic stress can matter even with moderate external load; true BFR requires strict safety handling.",
    ],
    limitations: [
      "PERFORM must not prescribe real BFR automatically; use as an analogy for local stress unless explicitly approved.",
    ],
    riskAreas: ["bfr_kaatsu", "lmv", "block_eligibility", "risk_check"],
    auditRefs: ["EDG-07"],
    automationReadiness: "medical_review_required",
    reviewStatus: "medical_review_required",
    ruleNature: "evidence_rule",
  },
  {
    id: "china_bfr_half_squat_wrestlers",
    level: "B",
    type: "direct_training_intervention",
    title: "Chinese adolescent female wrestler BFR + half-squat protocol",
    sourceDoc: "docs/perform-cycle-international-evidence.md",
    supports: [
      "Lower-limb force-development and local-strength programming in wrestlers with explicit duration/frequency context.",
    ],
    limitations: [
      "Youth/female protocol transfer requires age, sex, injury and safety context; not a close-start taper rule.",
    ],
    riskAreas: ["bfr_kaatsu", "lmv", "youth_context", "female_context", "block_eligibility"],
    auditRefs: ["EDG-07"],
    automationReadiness: "medical_review_required",
    reviewStatus: "medical_review_required",
    ruleNature: "evidence_rule",
  },
  {
    id: "china_ssit_freestyle_wrestlers",
    level: "B",
    type: "direct_training_intervention",
    title: "Chinese short sprint interval training in young freestyle wrestlers",
    sourceDoc: "docs/perform-cycle-international-evidence.md",
    supports: [
      "Sprint interval development far from competition with RPE and lower-limb recovery control.",
    ],
    limitations: [
      "SSIT is a development/preseason layer and must not be used as a hidden close-start load.",
    ],
    riskAreas: ["readiness", "volume", "block_eligibility", "taper"],
    auditRefs: ["EDG-08"],
    automationReadiness: "coach_review_required",
    reviewStatus: "coach_review_required",
    ruleNature: "evidence_rule",
  },
  {
    id: "ncaa_weight_management",
    level: "A/B",
    type: "sport_policy",
    title: "NCAA wrestling weight management",
    sourceDoc: "docs/perform-cycle-international-evidence.md",
    supports: [
      "Weight management as a safety policy with hydration and rate-of-loss constraints.",
    ],
    limitations: [
      "Policy thresholds need local configuration and cannot infer hydration status from weight alone.",
    ],
    riskAreas: ["weight_cut", "hydration", "weigh_in", "readiness", "risk_check"],
    auditRefs: ["EDG-04", "EDG-10"],
    automationReadiness: "medical_review_required",
    reviewStatus: "medical_review_required",
    ruleNature: "runtime_safety_guard",
  },
  {
    id: "acsm_hydration_nutrition",
    level: "A",
    type: "position_stand",
    title: "ACSM hydration and nutrition position stands",
    sourceDoc: "docs/perform-cycle-international-evidence.md",
    supports: [
      "Hydration, fueling and acute body-mass-loss risk handling around training and competition.",
    ],
    limitations: [
      "Hydration decisions need body mass trend, symptoms, intake and context, not one isolated reading.",
    ],
    riskAreas: ["hydration", "weight_cut", "weigh_in", "readiness", "risk_check"],
    auditRefs: ["EDG-04", "EDG-10"],
    automationReadiness: "medical_review_required",
    reviewStatus: "medical_review_required",
    ruleNature: "evidence_rule",
  },
  {
    id: "japan_rapid_weight_loss_wrestlers",
    level: "B",
    type: "direct_training_intervention",
    title: "Japanese wrestler rapid weight loss and body composition evidence",
    sourceDoc: "docs/perform-cycle-international-evidence.md",
    supports: [
      "Interpreting rapid weight change through energy deficit, hydration, body composition and performance risk.",
    ],
    limitations: [
      "Weight loss is not automatically readiness improvement; context and recovery markers are required.",
    ],
    riskAreas: ["weight_cut", "hydration", "readiness", "risk_check"],
    auditRefs: ["EDG-10"],
    automationReadiness: "risk_warning_only",
    reviewStatus: "coach_review_required",
    ruleNature: "evidence_rule",
  },
  {
    id: "sichuan_weight_reduction_wrestlers",
    level: "B",
    type: "direct_training_intervention",
    title: "Sichuan freestyle wrestler weight-reduction monitoring",
    sourceDoc: "docs/perform-cycle-international-evidence.md",
    supports: [
      "Weight-reduction monitoring through morning HR, sleep quality, mood, physiology and anaerobic power.",
    ],
    limitations: [
      "Requires multi-signal data; missing sleep/RHR/readiness should reduce confidence.",
    ],
    riskAreas: ["weight_cut", "readiness", "wearable_data", "hydration", "risk_check"],
    auditRefs: ["EDG-10", "EDG-11", "EDG-12"],
    automationReadiness: "risk_warning_only",
    reviewStatus: "coach_review_required",
    ruleNature: "evidence_rule",
  },
  {
    id: "grappling_grip_dehydration_transfer",
    level: "B/C",
    type: "transfer_grappling_evidence",
    title: "Judo/grappling dehydration and grip transfer evidence",
    sourceDoc: "docs/perform-cycle-international-evidence.md",
    supports: [
      "Grip, upper-limb fatigue and dehydration risks in grappling-like contact contexts.",
    ],
    limitations: [
      "Transfer evidence must be labelled as grappling transfer, not direct wrestling proof.",
    ],
    riskAreas: ["hydration", "contact_load", "readiness"],
    auditRefs: ["EDG-10"],
    automationReadiness: "risk_warning_only",
    reviewStatus: "approved_for_soft_rule",
    ruleNature: "evidence_rule",
  },
  {
    id: "recovery_monitoring_consensus",
    level: "A/B",
    type: "position_stand",
    title: "Recovery monitoring through sleep, RHR, readiness and soreness",
    sourceDoc: "docs/perform-cycle-evidence-matrix.md",
    supports: [
      "Conservative load decisions when sleep, resting HR, readiness, soreness or pain indicate recovery debt.",
    ],
    limitations: [
      "Signals are trend-based; missing data should lower confidence instead of producing a hard diagnosis.",
    ],
    riskAreas: ["readiness", "volume", "risk_check"],
    auditRefs: ["EDG-11"],
    automationReadiness: "risk_warning_only",
    reviewStatus: "approved_for_soft_rule",
    ruleNature: "evidence_rule",
  },
  {
    id: "wearable_validity_trend",
    level: "B/C",
    type: "position_stand",
    title: "Wearable data validity as trend evidence",
    sourceDoc: "docs/perform-cycle-evidence-matrix.md",
    supports: [
      "Using watches as trend/context data for sleep, HR, SpO2 and training, not as absolute truth.",
    ],
    limitations: [
      "Device quality, timestamps and completeness must be checked before high-confidence decisions.",
    ],
    riskAreas: ["wearable_data", "readiness", "risk_check"],
    auditRefs: ["EDG-12"],
    automationReadiness: "evidence_only",
    reviewStatus: "audit_only",
    ruleNature: "methodology_framework",
  },
  {
    id: "nsca_youth_safe_progression",
    level: "A",
    type: "position_stand",
    title: "NSCA youth long-term athletic development and safe progression",
    sourceDoc: "docs/perform-cycle-international-evidence.md",
    supports: [
      "Conservative progression and stronger safety gates for youth or developing athletes.",
    ],
    limitations: [
      "Age/maturity context must be known before applying youth-specific restrictions.",
    ],
    riskAreas: ["youth_context", "injury_pain", "block_eligibility", "volume"],
    auditRefs: ["EDG-07", "EDG-11"],
    automationReadiness: "coach_review_required",
    reviewStatus: "coach_review_required",
    ruleNature: "evidence_rule",
  },
  {
    id: "perform_internal_validation_pending",
    level: "C",
    type: "internal_validation",
    title: "PERFORM internal validation pending",
    sourceDoc: "docs/constructor-matrix-evidence-dependency-gap-audit.md",
    supports: [
      "Explicitly marks rules that need coach acceptance, edit history and athlete-response validation.",
    ],
    limitations: [
      "This dependency is not proof of effectiveness; it is a required audit marker until real PERFORM outcomes exist.",
    ],
    riskAreas: ["rollout", "explanation", "risk_check"],
    auditRefs: ["EDG-14", "EDG-15"],
    automationReadiness: "evidence_only",
    reviewStatus: "blocked_for_default",
    ruleNature: "gap_marker",
  },
] as const satisfies readonly ConstructorMatrixEvidenceDependency[];

export type ConstructorMatrixEvidenceDependencyId =
  (typeof CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY)[number]["id"];

export const CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_IDS =
  CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY.map((item) => item.id);

export const CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_ID_SET = new Set<string>(
  CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_IDS,
);

const CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_LOOKUP = new Map<
  ConstructorMatrixEvidenceDependencyId,
  ConstructorMatrixEvidenceDependency
>(
  CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY.map((item) => [item.id, item]),
);

export function isConstructorMatrixEvidenceDependencyId(
  value: string,
): value is ConstructorMatrixEvidenceDependencyId {
  return CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_ID_SET.has(value);
}

export function getConstructorMatrixEvidenceDependency(
  id: ConstructorMatrixEvidenceDependencyId,
) {
  return CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_LOOKUP.get(id) ?? null;
}

export function getConstructorMatrixEvidenceDependencies(
  ids: readonly ConstructorMatrixEvidenceDependencyId[],
) {
  return ids.flatMap((id) => {
    const item = getConstructorMatrixEvidenceDependency(id);

    return item ? [item] : [];
  });
}

export function uniqueConstructorMatrixEvidenceDependencies(
  ids: readonly ConstructorMatrixEvidenceDependencyId[],
): ConstructorMatrixEvidenceDependencyId[] {
  return Array.from(new Set(ids));
}

export function listConstructorMatrixEvidenceDependencyIds(): ConstructorMatrixEvidenceDependencyId[] {
  return [...CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_IDS];
}

export function validateConstructorMatrixEvidenceDependencyIds(
  ids: readonly string[],
): { ok: boolean; missing: string[] } {
  const missing = ids.filter((id) => !isConstructorMatrixEvidenceDependencyId(id));

  return {
    ok: missing.length === 0,
    missing,
  };
}
