export type ConstructorMatrixAiReviewPolicyScope =
  | "source_identity"
  | "evidence_claim"
  | "safety_classification"
  | "runtime_eligibility"
  | "pilot_deployment";

export type ConstructorMatrixAiReviewAllowedUse =
  | "docs_only"
  | "review_export_only"
  | "soft_warning_candidate"
  | "plan_structure_hint_candidate"
  | "fallback_guard_candidate"
  | "not_allowed";

export type ConstructorMatrixAiReviewBoundary =
  | "not_human_review"
  | "not_medical_approval"
  | "not_coach_approval"
  | "no_numeric_threshold_approval"
  | "no_runtime_hard_gate"
  | "no_medical_decision_automation"
  | "no_weight_cut_automation"
  | "no_hydration_automation"
  | "no_injury_return_automation"
  | "no_reds_decision"
  | "no_bfr_kaatsu_prescription"
  | "matrix_default_not_allowed";

export type ConstructorMatrixAiReviewRiskArea =
  | "weight_cut"
  | "hydration"
  | "pain"
  | "injury"
  | "female_context"
  | "reds"
  | "youth_context"
  | "bfr_kaatsu"
  | "sleep"
  | "rhr"
  | "hrv"
  | "wearable_data"
  | "readiness"
  | "contact_load"
  | "lmv"
  | "taper"
  | "competition_context"
  | "travel_fatigue";

export type ConstructorMatrixAiReviewPolicyRule = {
  id: string;
  title: string;
  scope: ConstructorMatrixAiReviewPolicyScope;
  aiMayDo: readonly string[];
  aiMustNotDo: readonly string[];
  allowedUseNow: readonly ConstructorMatrixAiReviewAllowedUse[];
  requiredBoundaries: readonly ConstructorMatrixAiReviewBoundary[];
  highRiskAreas: readonly ConstructorMatrixAiReviewRiskArea[];
  rationale: string;
  enforcementNotes: readonly string[];
  aiDeskReviewAllowed: true;
  humanReviewed: false;
  runtimeChangeAllowedNow: false;
};

export interface ConstructorMatrixAiReviewPolicySummary {
  policyRuleCount: number;
  policyRuleIds: readonly ConstructorMatrixAiReviewPolicyRuleId[];
  scopes: Readonly<Record<ConstructorMatrixAiReviewPolicyScope, number>>;
  allowedUses: Readonly<Record<ConstructorMatrixAiReviewAllowedUse, number>>;
  boundaries: Readonly<Record<ConstructorMatrixAiReviewBoundary, number>>;
  highRiskAreas: readonly ConstructorMatrixAiReviewRiskArea[];
  humanReviewed: false;
  runtimeChangeAllowedNow: false;
}

const POLICY_SCOPES = [
  "source_identity",
  "evidence_claim",
  "safety_classification",
  "runtime_eligibility",
  "pilot_deployment",
] as const satisfies readonly ConstructorMatrixAiReviewPolicyScope[];

const ALLOWED_USES = [
  "docs_only",
  "review_export_only",
  "soft_warning_candidate",
  "plan_structure_hint_candidate",
  "fallback_guard_candidate",
  "not_allowed",
] as const satisfies readonly ConstructorMatrixAiReviewAllowedUse[];

const BOUNDARIES = [
  "not_human_review",
  "not_medical_approval",
  "not_coach_approval",
  "no_numeric_threshold_approval",
  "no_runtime_hard_gate",
  "no_medical_decision_automation",
  "no_weight_cut_automation",
  "no_hydration_automation",
  "no_injury_return_automation",
  "no_reds_decision",
  "no_bfr_kaatsu_prescription",
  "matrix_default_not_allowed",
] as const satisfies readonly ConstructorMatrixAiReviewBoundary[];

function emptyRecord<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}

function countBy<K extends string>(
  keys: readonly K[],
  items: readonly K[],
): Readonly<Record<K, number>> {
  const counts = emptyRecord(keys);

  for (const item of items) {
    counts[item] += 1;
  }

  return counts;
}

function uniqueSorted<T extends string>(items: readonly T[]): T[] {
  return Array.from(new Set(items)).sort();
}

const COMMON_BOUNDARIES = [
  "not_human_review",
  "not_medical_approval",
  "not_coach_approval",
  "no_numeric_threshold_approval",
  "no_runtime_hard_gate",
] as const satisfies readonly ConstructorMatrixAiReviewBoundary[];

export const CONSTRUCTOR_MATRIX_AI_REVIEW_POLICY = [
  {
    id: "ai_desk_review_identity_boundary",
    title: "AI desk review is not human, coach, or medical review",
    scope: "source_identity",
    aiMayDo: [
      "classify existing source metadata as identity-plausible",
      "record that a public source identity needs source-text review",
      "route uncertain sources back to manual verification",
    ],
    aiMustNotDo: [
      "record a positive human-review flag",
      "invent reviewer identity or review date",
      "represent desk review as coach or medical approval",
      "invent DOI, PMID, authors, years, or source passages",
    ],
    allowedUseNow: ["docs_only", "review_export_only"],
    requiredBoundaries: COMMON_BOUNDARIES,
    highRiskAreas: [],
    rationale:
      "AI can organize and sanity-check source metadata, but it cannot replace accountable source verification or human review artifacts.",
    enforcementNotes: [
      "Every downstream AI record must preserve humanReviewed=false",
      "Reviewer identity fields belong only to real review artifacts",
      "Source text remains required before claims can be treated as source-backed",
    ],
    aiDeskReviewAllowed: true,
    humanReviewed: false,
    runtimeChangeAllowedNow: false,
  },
  {
    id: "high_risk_medical_non_automation_boundary",
    title: "High-risk medical areas remain blocked from AI automation",
    scope: "safety_classification",
    aiMayDo: [
      "classify high-risk items as medical_review_required",
      "classify high-risk items as do_not_automate",
      "emit conservative review-required warnings",
    ],
    aiMustNotDo: [
      "diagnose dehydration, RED-S, pain severity, or injury state",
      "clear return to training",
      "prescribe weight cutting, hydration intervention, or BFR/KAATSU",
      "convert athlete-specific medical context into a runtime rule",
    ],
    allowedUseNow: ["docs_only", "review_export_only", "soft_warning_candidate"],
    requiredBoundaries: [
      ...COMMON_BOUNDARIES,
      "no_medical_decision_automation",
      "no_weight_cut_automation",
      "no_hydration_automation",
      "no_injury_return_automation",
      "no_reds_decision",
      "no_bfr_kaatsu_prescription",
    ],
    highRiskAreas: [
      "weight_cut",
      "hydration",
      "pain",
      "injury",
      "female_context",
      "reds",
      "youth_context",
      "bfr_kaatsu",
    ],
    rationale:
      "Medical, clinical, weight-management, RED-S, youth, and BFR/KAATSU decisions need accountable human review and cannot be approved by AI alone.",
    enforcementNotes: [
      "High-risk records may produce review-required context only",
      "No hard stop, diagnosis, clearance, or prescription can be driven by AI review",
      "Runtime use must stay blocked, fallback-only, or soft-warning-only",
    ],
    aiDeskReviewAllowed: true,
    humanReviewed: false,
    runtimeChangeAllowedNow: false,
  },
  {
    id: "data_quality_soft_warning_boundary",
    title: "Wearable and readiness data can support only soft data-quality warnings",
    scope: "evidence_claim",
    aiMayDo: [
      "flag wearable, sleep, RHR, HRV, and readiness data as quality-limited",
      "route missing or low-confidence data to fallback planning",
      "summarize why data-quality review remains required",
    ],
    aiMustNotDo: [
      "treat wearable data as absolute truth",
      "create automatic sleep, RHR, HRV, or readiness cutoffs",
      "diagnose recovery state from a single signal",
    ],
    allowedUseNow: ["docs_only", "review_export_only", "soft_warning_candidate", "fallback_guard_candidate"],
    requiredBoundaries: COMMON_BOUNDARIES,
    highRiskAreas: ["sleep", "rhr", "hrv", "wearable_data", "readiness"],
    rationale:
      "AI-reviewed readiness evidence can support cautious data-quality messaging, but not absolute athlete-state decisions.",
    enforcementNotes: [
      "Data-quality warnings must remain qualitative",
      "Fallback behavior must be available when source or signal confidence is weak",
      "No exact cutoff value can be introduced by AI review",
    ],
    aiDeskReviewAllowed: true,
    humanReviewed: false,
    runtimeChangeAllowedNow: false,
  },
  {
    id: "plan_structure_hint_boundary",
    title: "AI-reviewed low-risk context may inform plan-structure hints",
    scope: "runtime_eligibility",
    aiMayDo: [
      "mark non-diagnostic taper, travel, contact-load, or structure context as plan-structure hint candidates",
      "recommend fallback guards when evidence remains incomplete",
      "keep close-start and competition-day scenarios preview-only when uncertain",
    ],
    aiMustNotDo: [
      "add hard numeric thresholds",
      "override rollout gates",
      "change block selection or eligibility for high-risk reasons without explicit runtime eligibility",
      "promote Matrix to default",
    ],
    allowedUseNow: [
      "docs_only",
      "review_export_only",
      "soft_warning_candidate",
      "plan_structure_hint_candidate",
      "fallback_guard_candidate",
    ],
    requiredBoundaries: [...COMMON_BOUNDARIES, "matrix_default_not_allowed"],
    highRiskAreas: ["contact_load", "lmv", "taper", "competition_context", "travel_fatigue"],
    rationale:
      "Non-medical AI desk review can support conservative plan-structure metadata only when fallback and rollout guards remain intact.",
    enforcementNotes: [
      "Plan-structure hints must be reversible and pilot-scoped",
      "Runtime integration requires a separate eligibility map",
      "Legacy fallback remains the default production path",
    ],
    aiDeskReviewAllowed: true,
    humanReviewed: false,
    runtimeChangeAllowedNow: false,
  },
  {
    id: "production_deployment_gate_boundary",
    title: "Production deployment remains feature-flagged controlled pilot only",
    scope: "pilot_deployment",
    aiMayDo: [
      "prepare deployment gates, monitoring checklists, and rollback documentation",
      "state which scenarios are enabled for controlled pilot",
      "state which scenarios remain blocked or preview-only",
    ],
    aiMustNotDo: [
      "enable Matrix as the production default",
      "enable save or assign by default",
      "change production constructor route behavior",
      "remove legacy fallback",
    ],
    allowedUseNow: ["docs_only", "review_export_only", "fallback_guard_candidate"],
    requiredBoundaries: [...COMMON_BOUNDARIES, "matrix_default_not_allowed"],
    highRiskAreas: [
      "weight_cut",
      "hydration",
      "pain",
      "injury",
      "female_context",
      "reds",
      "youth_context",
      "bfr_kaatsu",
      "competition_context",
    ],
    rationale:
      "Deployment can be prepared for controlled pilot users only; broad rollout requires a later explicit decision with monitoring evidence.",
    enforcementNotes: [
      "Feature flags must remain off by default",
      "Rollback must be documented before deployment",
      "High-risk medical decisions remain non-automated",
    ],
    aiDeskReviewAllowed: true,
    humanReviewed: false,
    runtimeChangeAllowedNow: false,
  },
] as const satisfies readonly ConstructorMatrixAiReviewPolicyRule[];

export type ConstructorMatrixAiReviewPolicyRuleId =
  (typeof CONSTRUCTOR_MATRIX_AI_REVIEW_POLICY)[number]["id"];

export const CONSTRUCTOR_MATRIX_AI_REVIEW_POLICY_IDS =
  CONSTRUCTOR_MATRIX_AI_REVIEW_POLICY.map((item) => item.id);

export function listConstructorMatrixAiReviewPolicyRuleIds():
  ConstructorMatrixAiReviewPolicyRuleId[] {
  return [...CONSTRUCTOR_MATRIX_AI_REVIEW_POLICY_IDS] as ConstructorMatrixAiReviewPolicyRuleId[];
}

export function getConstructorMatrixAiReviewPolicyRule(
  id: string,
): ConstructorMatrixAiReviewPolicyRule | null {
  return (
    CONSTRUCTOR_MATRIX_AI_REVIEW_POLICY.find((item) => item.id === id) ??
    null
  );
}

export function validateConstructorMatrixAiReviewPolicyRuleIds(
  ids: readonly string[],
): { ok: boolean; missing: string[] } {
  const knownIds = new Set<string>(CONSTRUCTOR_MATRIX_AI_REVIEW_POLICY_IDS);
  const missing = ids.filter((id) => !knownIds.has(id));

  return { ok: missing.length === 0, missing };
}

export function buildConstructorMatrixAiReviewPolicySummary():
  ConstructorMatrixAiReviewPolicySummary {
  return {
    policyRuleCount: CONSTRUCTOR_MATRIX_AI_REVIEW_POLICY.length,
    policyRuleIds: listConstructorMatrixAiReviewPolicyRuleIds(),
    scopes: countBy(
      POLICY_SCOPES,
      CONSTRUCTOR_MATRIX_AI_REVIEW_POLICY.map((item) => item.scope),
    ),
    allowedUses: countBy(
      ALLOWED_USES,
      CONSTRUCTOR_MATRIX_AI_REVIEW_POLICY.flatMap((item) => item.allowedUseNow),
    ),
    boundaries: countBy(
      BOUNDARIES,
      CONSTRUCTOR_MATRIX_AI_REVIEW_POLICY.flatMap((item) => item.requiredBoundaries),
    ),
    highRiskAreas: uniqueSorted(
      CONSTRUCTOR_MATRIX_AI_REVIEW_POLICY.flatMap((item) => item.highRiskAreas),
    ),
    humanReviewed: false,
    runtimeChangeAllowedNow: false,
  };
}
