# Matrix Controlled Pilot Acceptance Matrix

Stage: Matrix Constructor Dependency Map + Controlled Pilot Hardening Audit.

This document is the controlled-pilot acceptance matrix for the Matrix
constructor after the AI-reviewed metadata stages. It is not a production
default decision, not a runtime-promotion approval, not a medical review and not
a source acquisition record.

The related machine-readable registry is
`packages/shared/src/constructor-matrix-dependency-map.ts`; the guard is
`npm run check:constructor-matrix-dependency-map`.

The executable pilot validation is documented in
`docs/matrix-controlled-pilot-e2e-validation.md`, operated through
`docs/matrix-controlled-pilot-runbook.md` and guarded by
`npm run check:constructor-matrix-controlled-pilot-e2e`.

## Deployment Mode

Matrix remains a feature-flagged controlled pilot only.

Required flags:

- `NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI=true`;
- `NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT=true`;
- `NEXT_PUBLIC_MATRIX_CONSTRUCTOR_SAVE_ASSIGN_PILOT=true` only for dry-run
  save/assign pilot checks.

Default state:

- all Matrix feature flags are off;
- legacy constructor remains the default;
- production `/api/v1/plans/constructor/draft` remains legacy-backed;
- no DB schema migration is required;
- no Matrix save/assign production path is enabled by this stage.

## Dependency Graph

Runtime path:

```text
ConstructorInput
-> constructor-matrix.ts
-> constructor-matrix-skeleton.ts
-> constructor-matrix-plan-builder.ts
-> constructor-matrix-adapter.ts
-> constructor-matrix-preview/comparison.ts
-> constructor-matrix-rollout.ts
-> constructor-matrix-pilot-readiness.ts
-> constructor-matrix-save-dry-run.ts
-> internal API endpoints
-> gated web UI
```

Governance path:

```text
EvidenceDependencyRegistry
-> DataDependencyGate
-> ThresholdCandidateRegistry
-> ReviewPackage
-> ReviewDecisionLedger
-> SourceExpansionBacklog
-> SourceCandidates
-> SourceLookupIntake
-> AI Review Policy
-> AI Source Review
-> AI Evidence Claim Candidates
-> AI Safety Classification
-> Runtime Eligibility
-> matrix.aiRuntime metadata
-> Decision Pack
-> Deployment Gate
-> Dependency Map
```

The governance path is metadata-only. Runtime decision files must not import
review/source/AI governance registries, except the adapter bridge to
`constructor-matrix-runtime-eligibility` for safe `matrix.aiRuntime` metadata.

## Allowed Scenarios

The controlled pilot can use Matrix as the active draft only when rollout,
pilot readiness and server save dry-run evidence all pass.

Accepted fixture scenarios:

| Scenario | Expected pilot result | Boundary |
| --- | --- | --- |
| `far_development_week_d90` | Matrix primary pilot | Development plan structure may use Matrix under pilot gates. |
| `main_start_d28_special_pre_competition` | Matrix primary pilot | Controlled pre-competition structure; high-risk metadata remains review-required. |
| `main_start_d21_controlled_volume` | Matrix primary pilot | Controlled volume structure; no hard threshold gates. |
| `main_start_d10_taper` | Matrix primary pilot | Conservative taper structure; no medical automation. |
| `main_start_d4_start_window` | Matrix primary pilot | Start-window structure; no production default. |

All allowed scenarios must preserve:

- `matrix.aiRuntime.metadataOnly=true`;
- `runtimeHardGatesEnabled=false`;
- `highRiskAutomationEnabled=false`;
- `numericThresholdRuntimeGatesEnabled=false`;
- `medicalDecisionAutomationEnabled=false`;
- `humanReviewed=false`;
- legacy fallback availability.

## Fallback Scenarios

The controlled pilot must use legacy fallback when server evidence or dry-run
checks do not pass.

| Scenario | Expected pilot result | Reason |
| --- | --- | --- |
| `main_start_d3_final_activation` | `legacy_fallback` | Server dry-run blocks primary pilot activation. |
| `travel_day` | `legacy_fallback` | Travel-fatigue context remains conservative and server dry-run blocked. |
| `weigh_in_day` | `legacy_fallback` | Hydration/weigh-in context remains review-required and server dry-run blocked. |
| `competition_day` | `legacy_fallback` | Competition-day context is not promoted to Matrix primary pilot. |

Fallback means the active production-facing draft is not Matrix. Matrix preview
or comparison metadata may still exist behind internal gates for review.

## Preview-Only Scenarios

Preview-only scenarios may be inspected internally but must not become active
Matrix primary pilot drafts:

- competition day;
- close start windows where dry-run evidence blocks the pilot;
- travel/weigh-in logistics where Matrix is useful for review context but not
  for active controlled pilot output;
- any source-governance or review-governance item that lacks source text or
  real review artifacts.

Preview-only surfaces are read-only and no-write.

## Blocked Scenarios

These areas remain blocked, fallback-only, or review-required:

- female context and RED-S-sensitive context;
- youth context;
- injury-return context;
- pain context;
- hydration/weigh-in context;
- weight-cut context;
- BFR/KAATSU context;
- medical diagnosis or clearance;
- hard numeric threshold gates;
- source-text-needed claims;
- manual-verification-needed source records.

Allowed AI-reviewed runtime metadata for blocked areas is limited to
docs/review export, soft warning metadata where safe, blocked-state metadata and
fallback context. It must not prescribe, diagnose, clear return to training, or
turn a threshold candidate into a runtime rule.

## No-Write Boundaries

Internal API endpoints remain no-write inspection or dry-run endpoints:

- `/api/v1/plans/constructor/internal/matrix-preview`;
- `/api/v1/plans/constructor/internal/matrix-rollout-decision`;
- `/api/v1/plans/constructor/internal/matrix-primary-pilot-draft`;
- `/api/v1/plans/constructor/internal/matrix-primary-pilot-save-dry-run`.

Production save/template/assign remains legacy-only by default. Matrix
save/assign requires a later explicit approval stage and must still pass the
existing dry-run and feature-flag chain.

## Rollback Path

Rollback is feature-flag first:

1. Disable `NEXT_PUBLIC_MATRIX_CONSTRUCTOR_SAVE_ASSIGN_PILOT`.
2. Disable `NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT`.
3. Disable `NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI`.
4. Keep using legacy `/api/v1/plans/constructor/draft`.
5. Use Matrix exports only as review artifacts until the issue is classified.

No DB rollback is expected from this stage because no migration or Matrix write
path is enabled.

## Monitoring Checklist

Before any controlled pilot exposure, monitor:

- feature flag state and cohort size;
- internal endpoint errors;
- server dry-run pass/block counts;
- legacy fallback counts;
- blocked high-risk metadata counts;
- trainer-facing copy regressions;
- save/assign attempts from Matrix sources;
- absence of Matrix data in production template payloads.

## Known Limitations

- AI desk review is not human review.
- Source text is still needed for many candidate claims.
- Some source identities still need manual verification.
- Threshold candidates remain candidates only.
- High-risk medical decisions remain non-automated.
- Matrix is not production default.

## Next Steps

- Complete real source-text acquisition for source-text-needed records.
- Complete manual source verification for manual-verification-needed records.
- Run actual coach, medical, data-quality and sport-science review passes.
- Keep source readiness updates tied to real review artifacts.
- Re-run the dependency map and controlled-pilot checks before any future pilot
  expansion.
