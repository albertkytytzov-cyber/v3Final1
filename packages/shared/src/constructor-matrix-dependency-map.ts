export type ConstructorMatrixDependencyLayer =
  | "runtime_core"
  | "runtime_adapter"
  | "preview_and_comparison"
  | "rollout_and_pilot"
  | "save_assign_dry_run"
  | "api_internal_routes"
  | "web_ui_gates"
  | "evidence_governance"
  | "source_governance"
  | "ai_review_governance"
  | "production_guardrails";

export type ConstructorMatrixRuntimeBehaviorImpact =
  | "runtime_behavior"
  | "metadata_only"
  | "read_only_gate"
  | "no_write_audit"
  | "documentation_only";

export type ConstructorMatrixDependencyEntry = {
  id: string;
  layer: ConstructorMatrixDependencyLayer;
  sourceFiles: readonly string[];
  dependsOn: readonly string[];
  runtimeBehaviorImpact: ConstructorMatrixRuntimeBehaviorImpact;
  allowedConsumers: readonly string[];
  forbiddenConsumers: readonly string[];
  guardrailNotes: readonly string[];
};

export interface ConstructorMatrixDependencyMapSummary {
  dependencyCount: number;
  dependencyIds: readonly ConstructorMatrixDependencyMapEntryId[];
  byLayer: Readonly<Record<ConstructorMatrixDependencyLayer, number>>;
  byRuntimeBehaviorImpact: Readonly<Record<ConstructorMatrixRuntimeBehaviorImpact, number>>;
  runtimeBehaviorEntryCount: number;
  metadataOnlyEntryCount: number;
  documentationOnlyEntryCount: number;
}

const DEPENDENCY_LAYERS = [
  "runtime_core",
  "runtime_adapter",
  "preview_and_comparison",
  "rollout_and_pilot",
  "save_assign_dry_run",
  "api_internal_routes",
  "web_ui_gates",
  "evidence_governance",
  "source_governance",
  "ai_review_governance",
  "production_guardrails",
] as const satisfies readonly ConstructorMatrixDependencyLayer[];

const RUNTIME_BEHAVIOR_IMPACTS = [
  "runtime_behavior",
  "metadata_only",
  "read_only_gate",
  "no_write_audit",
  "documentation_only",
] as const satisfies readonly ConstructorMatrixRuntimeBehaviorImpact[];

const RUNTIME_DECISION_CONSUMERS = [
  "packages/shared/src/constructor-matrix.ts",
  "packages/shared/src/constructor-matrix-skeleton.ts",
  "packages/shared/src/constructor-matrix-plan-builder.ts",
] as const;

const RUNTIME_EDGE_CONSUMERS = [
  "packages/shared/src/constructor-matrix-adapter.ts",
  "packages/shared/src/constructor-matrix-preview.ts",
  "packages/shared/src/constructor-matrix-rollout.ts",
  "packages/shared/src/constructor-matrix-pilot-readiness.ts",
  "packages/shared/src/constructor-matrix-save-dry-run.ts",
  "apps/api/src/api/planning/planning.routes.ts",
  "apps/web/app/page-client.tsx",
] as const;

const GOVERNANCE_ONLY_FORBIDDEN_CONSUMERS = [
  ...RUNTIME_DECISION_CONSUMERS,
  "packages/shared/src/constructor-matrix-preview.ts",
  "packages/shared/src/constructor-matrix-rollout.ts",
  "packages/shared/src/constructor-matrix-pilot-readiness.ts",
  "packages/shared/src/constructor-matrix-save-dry-run.ts",
  "packages/shared/src/constructor-core.ts",
  "apps/api runtime routes",
  "apps/web runtime UI",
  "apps/mobile runtime UI",
] as const;

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

export const CONSTRUCTOR_MATRIX_DEPENDENCY_MAP = [
  {
    id: "runtime_core_matrix_domain",
    layer: "runtime_core",
    sourceFiles: [
      "packages/shared/src/constructor-matrix.ts",
      "packages/shared/src/constructor-matrix-skeleton.ts",
      "packages/shared/src/constructor-matrix-plan-builder.ts",
    ],
    dependsOn: [],
    runtimeBehaviorImpact: "runtime_behavior",
    allowedConsumers: [
      "packages/shared/src/constructor-matrix-adapter.ts",
      "packages/shared/src/constructor-matrix-preview.ts",
      "packages/shared/src/constructor-matrix-comparison.ts",
      "scripts/check-perform-constructor-core.mjs",
    ],
    forbiddenConsumers: [
      "apps/api production draft route",
      "apps/web production save path",
      "source governance registries",
      "AI review governance registries",
    ],
    guardrailNotes: [
      "Core Matrix plan generation remains behind preview, internal routes, or controlled pilot gates.",
      "Core runtime must not import review, source, or AI governance registries.",
      "No numeric threshold approval, medical automation, or Matrix default promotion is represented here.",
    ],
  },
  {
    id: "runtime_adapter_ai_metadata_bridge",
    layer: "runtime_adapter",
    sourceFiles: [
      "packages/shared/src/constructor-matrix-adapter.ts",
      "packages/shared/src/constructor-matrix-runtime-eligibility.ts",
    ],
    dependsOn: [
      "runtime_core_matrix_domain",
      "ai_review_governance_chain",
    ],
    runtimeBehaviorImpact: "metadata_only",
    allowedConsumers: [
      "packages/shared/src/constructor-matrix-preview.ts",
      "scripts/check-constructor-matrix-ai-runtime-integration.mjs",
      "scripts/check-constructor-matrix-dependency-map.mjs",
    ],
    forbiddenConsumers: [
      "apps/api production draft route",
      "apps/web production save path",
      "apps/mobile runtime UI",
    ],
    guardrailNotes: [
      "The adapter may attach aiRuntime metadata, but it must keep runtime hard gates, high-risk automation, numeric threshold gates, and medical automation disabled.",
      "The metadata bridge does not change block selection, skeleton selection, risk logic, or rollout eligibility.",
    ],
  },
  {
    id: "preview_and_comparison_internal_surface",
    layer: "preview_and_comparison",
    sourceFiles: [
      "packages/shared/src/constructor-matrix-preview.ts",
      "packages/shared/src/constructor-matrix-comparison.ts",
      "scripts/fixtures/constructor/preview-regression-fixtures.mjs",
    ],
    dependsOn: [
      "runtime_core_matrix_domain",
      "runtime_adapter_ai_metadata_bridge",
    ],
    runtimeBehaviorImpact: "read_only_gate",
    allowedConsumers: [
      "apps/api internal matrix preview endpoint",
      "apps/web internal Matrix preview panel",
      "scripts/check-constructor-matrix-ui-gates.mjs",
    ],
    forbiddenConsumers: [
      "apps/api production draft route",
      "legacy constructor default path",
      "save or assign production write path",
    ],
    guardrailNotes: [
      "Preview and comparison remain read-only inspection surfaces.",
      "Preview behavior must not become production default and must not create DB writes.",
    ],
  },
  {
    id: "rollout_and_pilot_gate_chain",
    layer: "rollout_and_pilot",
    sourceFiles: [
      "packages/shared/src/constructor-matrix-rollout.ts",
      "packages/shared/src/constructor-matrix-pilot-readiness.ts",
      "apps/web/app/lib/constructor-matrix-primary-pilot.ts",
      "apps/web/app/lib/constructor-matrix-primary-pilot-server-gate.ts",
    ],
    dependsOn: [
      "preview_and_comparison_internal_surface",
      "runtime_adapter_ai_metadata_bridge",
    ],
    runtimeBehaviorImpact: "read_only_gate",
    allowedConsumers: [
      "apps/api internal matrix rollout endpoints",
      "apps/web controlled pilot UI",
      "scripts/check-constructor-matrix-ui-gates.mjs",
    ],
    forbiddenConsumers: [
      "production constructor default",
      "unflagged web UI",
      "mobile production flow",
    ],
    guardrailNotes: [
      "Pilot mode requires explicit feature flags, rollout decision, pilot readiness, and server dry-run evidence.",
      "High-risk contexts stay blocked, fallback-only, preview-only, or review-required.",
    ],
  },
  {
    id: "save_assign_dry_run_boundary",
    layer: "save_assign_dry_run",
    sourceFiles: [
      "packages/shared/src/constructor-matrix-save-dry-run.ts",
      "apps/web/app/lib/constructor-matrix-save-dry-run.ts",
      "docs/matrix-ai-reviewed-save-assign-readiness.md",
    ],
    dependsOn: [
      "rollout_and_pilot_gate_chain",
    ],
    runtimeBehaviorImpact: "no_write_audit",
    allowedConsumers: [
      "apps/api internal matrix save dry-run endpoint",
      "apps/web controlled pilot UI",
      "scripts/check-constructor-matrix-ai-save-assign-readiness.mjs",
    ],
    forbiddenConsumers: [
      "production save/template/assign write path",
      "DB migration path",
      "legacy save disablement",
    ],
    guardrailNotes: [
      "Save/assign Matrix paths remain dry-run or explicitly feature-flagged pilot checks.",
      "Legacy save remains the default write-capable constructor path.",
    ],
  },
  {
    id: "api_internal_routes_no_write",
    layer: "api_internal_routes",
    sourceFiles: [
      "apps/api/src/api/planning/planning.routes.ts",
      "apps/api/src/api/planning/planning.schemas.ts",
    ],
    dependsOn: [
      "preview_and_comparison_internal_surface",
      "rollout_and_pilot_gate_chain",
      "save_assign_dry_run_boundary",
    ],
    runtimeBehaviorImpact: "read_only_gate",
    allowedConsumers: [
      "coach/admin internal Matrix endpoints",
      "controlled pilot server gate",
      "scripts/check-constructor-matrix-ui-gates.mjs",
    ],
    forbiddenConsumers: [
      "production /api/v1/plans/constructor/draft route",
      "unauthorized athlete access",
      "DB write path",
    ],
    guardrailNotes: [
      "The production draft route remains legacy-backed.",
      "Internal Matrix endpoints must assert coach/admin role and athlete access and must remain no-write.",
    ],
  },
  {
    id: "web_ui_feature_flag_gates",
    layer: "web_ui_gates",
    sourceFiles: [
      "apps/web/app/lib/feature-flags.ts",
      "apps/web/app/lib/constructor-matrix-ui.ts",
      "apps/web/app/page-client.tsx",
      "apps/web/app/components/constructor/MatrixConstructorPreviewPanel.tsx",
      "apps/web/app/components/constructor/MatrixPrimaryPilotSaveDryRunCard.tsx",
    ],
    dependsOn: [
      "api_internal_routes_no_write",
      "save_assign_dry_run_boundary",
    ],
    runtimeBehaviorImpact: "read_only_gate",
    allowedConsumers: [
      "internal Matrix UI",
      "controlled pilot users/admin/test cohort",
      "scripts/check-constructor-matrix-ui-gates.mjs",
    ],
    forbiddenConsumers: [
      "unflagged public UI",
      "production default constructor tab",
      "persistent Matrix UI local storage",
    ],
    guardrailNotes: [
      "Feature flags default off and cascade from internal UI to limited primary pilot to save/assign pilot.",
      "Matrix UI must not make Matrix the production default.",
    ],
  },
  {
    id: "evidence_governance_chain",
    layer: "evidence_governance",
    sourceFiles: [
      "packages/shared/src/constructor-matrix-evidence.ts",
      "packages/shared/src/constructor-matrix-data-dependencies.ts",
      "packages/shared/src/constructor-matrix-threshold-candidates.ts",
      "packages/shared/src/constructor-matrix-review-package.ts",
      "packages/shared/src/constructor-matrix-review-decision-ledger.ts",
    ],
    dependsOn: [],
    runtimeBehaviorImpact: "metadata_only",
    allowedConsumers: [
      "packages/shared/src/index.ts",
      "review/export metadata helpers",
      "validation scripts",
      "docs",
    ],
    forbiddenConsumers: GOVERNANCE_ONLY_FORBIDDEN_CONSUMERS,
    guardrailNotes: [
      "Evidence governance records review queues and blockers without human approval fabrication.",
      "Threshold candidates remain candidates only and cannot become runtime gates from this layer.",
    ],
  },
  {
    id: "source_governance_chain",
    layer: "source_governance",
    sourceFiles: [
      "packages/shared/src/constructor-matrix-source-expansion-backlog.ts",
      "packages/shared/src/constructor-matrix-source-candidates.ts",
      "packages/shared/src/constructor-matrix-source-lookup-intake.ts",
      "packages/shared/src/constructor-matrix-desk-source-review.ts",
      "packages/shared/src/constructor-matrix-evidence-claim-candidates.ts",
      "packages/shared/src/constructor-matrix-evidence-claim-candidate-review-export.ts",
    ],
    dependsOn: [
      "evidence_governance_chain",
    ],
    runtimeBehaviorImpact: "metadata_only",
    allowedConsumers: [
      "packages/shared/src/index.ts",
      "source review/export metadata helpers",
      "validation scripts",
      "docs",
    ],
    forbiddenConsumers: GOVERNANCE_ONLY_FORBIDDEN_CONSUMERS,
    guardrailNotes: [
      "Source governance describes source acquisition, intake, candidate claims, and export packs only.",
      "It must not invent citations, source passages, DOI, PMID, numeric thresholds, or human approvals.",
    ],
  },
  {
    id: "ai_review_governance_chain",
    layer: "ai_review_governance",
    sourceFiles: [
      "packages/shared/src/constructor-matrix-ai-review-policy.ts",
      "packages/shared/src/constructor-matrix-ai-source-review.ts",
      "packages/shared/src/constructor-matrix-ai-evidence-claims.ts",
      "packages/shared/src/constructor-matrix-ai-safety-classification.ts",
      "packages/shared/src/constructor-matrix-runtime-eligibility.ts",
    ],
    dependsOn: [
      "evidence_governance_chain",
      "source_governance_chain",
    ],
    runtimeBehaviorImpact: "metadata_only",
    allowedConsumers: [
      "packages/shared/src/constructor-matrix-adapter.ts for runtime eligibility metadata only",
      "packages/shared/src/index.ts",
      "validation scripts",
      "docs",
    ],
    forbiddenConsumers: [
      ...RUNTIME_DECISION_CONSUMERS,
      "packages/shared/src/constructor-matrix-preview.ts",
      "packages/shared/src/constructor-matrix-rollout.ts",
      "packages/shared/src/constructor-matrix-pilot-readiness.ts",
      "packages/shared/src/constructor-matrix-save-dry-run.ts",
      "apps/api production routes",
      "apps/web runtime UI",
      "apps/mobile runtime UI",
    ],
    guardrailNotes: [
      "AI desk review is not human, medical, or coach review.",
      "Runtime eligibility can only create safe metadata, soft warnings, plan-structure hints, or fallback information under explicit blockers.",
      "High-risk medical, weight-cut, hydration, injury, RED-S, youth, and BFR/KAATSU areas remain blocked or review-required.",
    ],
  },
  {
    id: "production_guardrails_pack",
    layer: "production_guardrails",
    sourceFiles: [
      "docs/matrix-ai-reviewed-production-decision-pack.md",
      "docs/matrix-ai-reviewed-production-deployment-gate.md",
      "docs/constructor-matrix-production-rollout.md",
      "docs/matrix-controlled-pilot-acceptance-matrix.md",
    ],
    dependsOn: [
      "rollout_and_pilot_gate_chain",
      "save_assign_dry_run_boundary",
      "ai_review_governance_chain",
    ],
    runtimeBehaviorImpact: "documentation_only",
    allowedConsumers: [
      "release reviewers",
      "controlled pilot operators",
      "validation scripts",
    ],
    forbiddenConsumers: [
      "runtime default switch",
      "automatic deployment approval",
      "medical or coach approval representation",
    ],
    guardrailNotes: [
      "Production deployment is limited to feature-flagged controlled pilot mode.",
      "Matrix is not production default and high-risk medical decisions remain non-automated.",
      "Rollback is feature-flag first with legacy constructor as default.",
    ],
  },
] as const satisfies readonly ConstructorMatrixDependencyEntry[];

export type ConstructorMatrixDependencyMapEntryId =
  (typeof CONSTRUCTOR_MATRIX_DEPENDENCY_MAP)[number]["id"];

export const CONSTRUCTOR_MATRIX_DEPENDENCY_MAP_IDS =
  CONSTRUCTOR_MATRIX_DEPENDENCY_MAP.map((item) => item.id);

export function listConstructorMatrixDependencyMapIds(): ConstructorMatrixDependencyMapEntryId[] {
  return [...CONSTRUCTOR_MATRIX_DEPENDENCY_MAP_IDS];
}

export function getConstructorMatrixDependencyMapEntry(
  id: string,
): ConstructorMatrixDependencyEntry | null {
  return CONSTRUCTOR_MATRIX_DEPENDENCY_MAP.find((item) => item.id === id) ?? null;
}

export function validateConstructorMatrixDependencyMapIds(
  ids: readonly string[],
): { ok: boolean; missing: string[] } {
  const knownIds = new Set<string>(CONSTRUCTOR_MATRIX_DEPENDENCY_MAP_IDS);
  const missing = ids.filter((id) => !knownIds.has(id));

  return {
    ok: missing.length === 0,
    missing,
  };
}

export function buildConstructorMatrixDependencyMapSummary(): ConstructorMatrixDependencyMapSummary {
  const byLayer = countBy(
    DEPENDENCY_LAYERS,
    CONSTRUCTOR_MATRIX_DEPENDENCY_MAP.map((item) => item.layer),
  );
  const byRuntimeBehaviorImpact = countBy(
    RUNTIME_BEHAVIOR_IMPACTS,
    CONSTRUCTOR_MATRIX_DEPENDENCY_MAP.map((item) => item.runtimeBehaviorImpact),
  );

  return {
    dependencyCount: CONSTRUCTOR_MATRIX_DEPENDENCY_MAP.length,
    dependencyIds: listConstructorMatrixDependencyMapIds(),
    byLayer,
    byRuntimeBehaviorImpact,
    runtimeBehaviorEntryCount: byRuntimeBehaviorImpact.runtime_behavior,
    metadataOnlyEntryCount: byRuntimeBehaviorImpact.metadata_only,
    documentationOnlyEntryCount: byRuntimeBehaviorImpact.documentation_only,
  };
}
