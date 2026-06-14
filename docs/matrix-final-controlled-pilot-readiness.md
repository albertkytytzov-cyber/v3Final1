# Matrix Final Controlled Pilot Readiness

Stage: Final Controlled Pilot Readiness.

This document records the current end-state for the Matrix constructor after
controlled pilot E2E validation and Matrix Save/Assign Controlled Pilot
hardening.

## Decision

Matrix is ready only for controlled pilot use when all validation checks pass.
Matrix is not production default. Legacy fallback remains the default
constructor behavior.

Controlled pilot use means:

- Matrix may build preparation-plan drafts for explicitly allowed pilot
  scenarios;
- Matrix save/assign may be available only behind all explicit pilot flags;
- the production route `/api/v1/plans/constructor/draft` remains legacy-backed;
- existing template and assignment contracts are reused;
- no DB schema migration is required.

## Allowed Now

Allowed controlled pilot scenarios:

- D90 far development week;
- D28 special pre-competition;
- D21 controlled volume;
- D10 taper;
- D4 start-window pilot.

Allowed use is limited to plan-structure generation, existing template payload
compatibility and controlled pilot save/assign gating. This is not a human
review result and not a medical or coach approval.

## Blocked Now

Blocked or fallback-only scenarios:

- D-3 final activation;
- travel day;
- weigh-in day;
- competition day;
- preview-only Matrix drafts;
- `matrix_internal` drafts;
- high-risk medical, weight-cut, hydration, RED-S, pain, injury-return, youth
  and BFR/KAATSU contexts.

High-risk medical decisions remain non-automated and review-required.

## Guardrails

The final controlled pilot state requires:

- feature flags off by default;
- Matrix is not production default;
- legacy fallback remains available;
- no DB schema migration;
- no numeric threshold runtime gates;
- no fake human approvals;
- no fake medical approvals;
- no high-risk automation;
- no Matrix internals persisted in templates;
- rollback through feature flags.

## Required Checks

Before any controlled pilot expansion, run:

```bash
npm run build --workspace @training-platform/shared
npm run check:constructor-matrix-controlled-pilot-e2e
npm run check:constructor-matrix-save-assign-controlled-pilot
npm run check:constructor-matrix-dependency-map
npm run check:constructor-matrix-ui-gates
npm run check:constructor-matrix-ai-runtime-integration
npm run check:constructor-matrix-ai-save-assign-readiness
npm run check:constructor-core
npm run check
npm run build
git diff --check
```

## Future Work

Future work remains:

- real source-text acquisition;
- manual coach/medical/data-quality review for high-risk expansion;
- monitoring evidence from the controlled pilot;
- a later explicit production-readiness decision.

Until that happens, Matrix remains controlled-pilot only. Matrix is not
production default; high-risk medical decisions remain non-automated; no DB
schema migration is required; no numeric threshold gate is approved; no fake
human approvals are added.
