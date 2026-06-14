# Matrix Controlled Pilot End-to-End Validation

Stage: Controlled Pilot End-to-End Validation.

This stage validates the Matrix controlled pilot as an executable planning
workflow. It is not a production-default approval, not a save/assign production
enablement, not a medical review and not a source-readiness promotion.

Guard script:

```bash
npm run check:constructor-matrix-controlled-pilot-e2e
```

## Validation Scope

The E2E check builds the same controlled pilot path used by the internal server
flow:

```text
fixture input
-> Matrix draft
-> rollout decision
-> pilot readiness
-> server save dry-run evidence
-> server pilot gate
-> active Matrix pilot draft or legacy fallback
-> template payload shape
-> assignment payload shape
```

The check does not write to the database and does not enable production
save/assign.

## Matrix Primary Pilot Cases

These scenarios must build active Matrix pilot drafts only when rollout,
readiness, server dry-run evidence and the server gate all pass.

| Scenario | Active source | Weeks | Days | Sessions | Blocks |
| --- | --- | ---: | ---: | ---: | ---: |
| `far_development_week_d90` | `matrix_primary_pilot` | 1 | 7 | 11 | 32 |
| `main_start_d28_special_pre_competition` | `matrix_primary_pilot` | 4 | 28 | 37 | 110 |
| `main_start_d21_controlled_volume` | `matrix_primary_pilot` | 3 | 21 | 27 | 81 |
| `main_start_d10_taper` | `matrix_primary_pilot` | 2 | 10 | 12 | 35 |
| `main_start_d4_start_window` | `matrix_primary_pilot` | 1 | 4 | 4 | 15 |

For every active Matrix pilot draft, the check requires:

- `matrix.aiRuntime.metadataOnly=true`;
- `runtimeHardGatesEnabled=false`;
- `highRiskAutomationEnabled=false`;
- `numericThresholdRuntimeGatesEnabled=false`;
- `medicalDecisionAutomationEnabled=false`;
- `humanReviewed=false`;
- blocked high-risk metadata remains present;
- template payloads parse through the existing API schema;
- template payloads do not include `matrix`, `aiRuntime`, rollout or pilot
  readiness internals;
- assignment payload shapes parse through existing API schemas.

## Fallback Cases

These scenarios must not become active Matrix primary pilot drafts.

| Scenario | Active source | Dry-run result | Expected boundary |
| --- | --- | --- | --- |
| `main_start_d3_final_activation` | `legacy_fallback` | `blocked` | close-start primary pilot remains blocked |
| `travel_day` | `legacy_fallback` | `blocked` | travel fatigue remains internal/blocked for active pilot |
| `weigh_in_day` | `legacy_fallback` | `blocked` | hydration/weigh-in context remains blocked for active pilot |
| `competition_day` | `legacy_fallback` | `blocked` | competition-day Matrix output remains preview-only/fallback |

Fallback means the active trainer-facing draft is not generated from Matrix.
Matrix can still be inspected as internal preview/review context where the
feature flags allow it.

## High-Risk Coverage

The E2E guard checks runtime eligibility coverage for:

- weight cut;
- hydration;
- female context and RED-S-sensitive context;
- pain;
- injury;
- youth context;
- BFR/KAATSU.

Each covered high-risk entry must remain:

- `status=blocked_high_risk`;
- `allowedRuntimeUse=none`;
- `humanReviewed=false`;
- `runtimeChangeAllowedNow=false`.

This means the controlled pilot can build safe plan structure in allowed cases,
but it still cannot diagnose, prescribe, clear injury return, automate
weight-cut/hydration decisions, approve numeric threshold gates or represent AI
desk review as human review.

## Save/Assign Boundary

The E2E stage confirms payload compatibility and feeds the Matrix Save/Assign
Controlled Pilot. Production default save/assign remains legacy-backed:

- `legacy` save remains allowed;
- `matrix_internal` save remains disabled;
- `matrix_primary_pilot` save is available only when all explicit controlled
  pilot flags, rollout, readiness, local dry-run, server dry-run and server
  gate evidence pass;
- no DB migration is required;
- no Matrix internals enter template payloads;
- high-risk medical decisions remain non-automated;
- no numeric threshold gates and no fake human approvals are added.

The dedicated save/assign check is:

```bash
npm run check:constructor-matrix-save-assign-controlled-pilot
```

## Commands

Run before pilot expansion:

```bash
npm run check:constructor-matrix-controlled-pilot-e2e
npm run check:constructor-matrix-ui-gates
npm run check:constructor-matrix-dependency-map
npm run check:constructor-core
npm run check
npm run build
git diff --check
```

## Result

Matrix is validated for controlled preparation-plan building in the allowed
pilot scenarios above. Matrix is not production default. High-risk
medical decisions remain non-automated and review-required.

Final Controlled Pilot Readiness is recorded in
`docs/matrix-final-controlled-pilot-readiness.md`. It confirms no DB schema
migration, no numeric threshold runtime gates and no fake human approvals.

## Family Evidence Review Extension

Stage: Matrix Family-Level Evidence Review + Coach UI + Controlled Pilot
Readiness.

The E2E pilot now has a companion real-scenario check:

```bash
npm run check:constructor-matrix-real-scenario-pilot
```

It verifies allowed D90/D28/D21/D10/D4 Matrix drafts, fallback D-3/travel/
weigh-in/competition-day scenarios, high-risk review-required contexts,
template payload boundaries and the legacy-backed production route.
