# Matrix Controlled Pilot Runbook

Stage: Matrix Controlled Pilot Runbook.

This runbook explains how to operate Matrix as a controlled pilot. It does not
make Matrix production default and does not enable production save/assign for
Matrix sources.

## Pilot Mode

Deployment mode: feature-flagged controlled pilot only.

Matrix can be exposed only to an internal/admin/test cohort that understands:

- AI desk review is not human review;
- high-risk medical decisions remain non-automated;
- legacy fallback is the default safety path;
- Matrix save/assign production writes are not enabled by this runbook.

## Required Feature Flags

Default: all off.

Enable in this order for a controlled pilot:

1. `NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI=true`
2. `NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT=true`
3. `NEXT_PUBLIC_MATRIX_CONSTRUCTOR_SAVE_ASSIGN_PILOT=true` only for explicit
   save/assign dry-run pilot checks, not production writes

Disable in reverse order for rollback.

## Access Rules

Allowed users:

- admin users;
- coach users with athlete access;
- explicitly selected test cohort users.

Not allowed:

- public/default user exposure;
- mobile production flow exposure;
- unflagged web UI exposure;
- production save/assign for Matrix sources.

## Allowed Active Matrix Pilot Scenarios

Active Matrix pilot draft is allowed only when rollout, pilot readiness, server
save dry-run and server gate evidence all pass:

- `far_development_week_d90`;
- `main_start_d28_special_pre_competition`;
- `main_start_d21_controlled_volume`;
- `main_start_d10_taper`;
- `main_start_d4_start_window`.

## Fallback or Preview-Only Scenarios

These must use legacy fallback or remain internal preview-only:

- D-3 close start;
- travel fatigue day;
- weigh-in day;
- competition day;
- any missing server dry-run evidence;
- any server evidence mismatch;
- any server dry-run error.

## Blocked High-Risk Scenarios

These remain blocked, fallback-only or review-required:

- weight cut;
- hydration;
- female context and RED-S-sensitive context;
- youth context;
- injury-return context;
- pain context;
- BFR/KAATSU context;
- hard numeric threshold decisions;
- medical diagnosis or clearance.

AI-reviewed metadata may support docs/review export, soft warnings or
plan-structure hints only where the runtime eligibility map allows it. It must
not become a hard runtime gate.

## Pre-Pilot Checklist

Run:

```bash
npm run check:constructor-matrix-controlled-pilot-e2e
npm run check:constructor-matrix-dependency-map
npm run check:constructor-matrix-ui-gates
npm run check:constructor-matrix-ai-runtime-integration
npm run check:constructor-matrix-ai-save-assign-readiness
npm run check:constructor-core
npm run check
npm run build
git diff --check
```

Confirm:

- production `/api/v1/plans/constructor/draft` remains legacy-backed;
- Matrix is not production default;
- feature flags are off by default;
- internal endpoints are coach/admin and athlete-access guarded;
- no DB migration is pending;
- Matrix template payloads do not include Matrix internals;
- high-risk entries remain blocked or review-required.

## Monitoring Checklist

During pilot:

- count Matrix primary pilot builds;
- count legacy fallback builds;
- count blocked server dry-runs;
- watch internal endpoint errors;
- watch server evidence mismatch reasons;
- watch any save/assign attempts from Matrix sources;
- review trainer-facing copy for confusing approval language;
- verify high-risk blocked metadata remains present.

## Rollback

Rollback is feature-flag first:

1. Disable `NEXT_PUBLIC_MATRIX_CONSTRUCTOR_SAVE_ASSIGN_PILOT`.
2. Disable `NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT`.
3. Disable `NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI`.
4. Keep production `/api/v1/plans/constructor/draft` on the legacy constructor.
5. Use Matrix exports only as internal review artifacts until the issue is
   triaged.

No DB rollback is expected from this runbook because no Matrix production write
path is enabled.

## Save/Assign Decision

Current decision: Matrix Save/Assign Controlled Pilot may be used only when
`NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI`,
`NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT` and
`NEXT_PUBLIC_MATRIX_CONSTRUCTOR_SAVE_ASSIGN_PILOT` are all explicitly enabled
for the controlled cohort.

Reason:

- dry-run compatibility exists;
- real DB writes remain bounded by existing template and assignment contracts;
- no Matrix internals are persisted in template payloads;
- D-3, travel, weigh-in and competition-day scenarios remain blocked or
  fallback for Matrix save/assign;
- Matrix is not production default;
- high-risk medical decisions remain non-automated;
- no DB schema migration, no numeric threshold gates and no fake human
  approvals are added.

## Next Steps

Possible next stages:

- real source-text acquisition and manual review for high-risk areas;
- production readiness decision after controlled pilot evidence is collected.

## Matrix Save/Assign Controlled Pilot

Stage: Matrix Save/Assign Controlled Pilot.

Run `npm run check:constructor-matrix-save-assign-controlled-pilot` before any
controlled save/assign exposure. The check verifies:

- feature flags default off;
- all three pilot flags are required;
- production `/api/v1/plans/constructor/draft` remains legacy-backed;
- allowed D90, D28, D21, D10 and D4 scenarios can produce save-compatible
  payloads only after server evidence passes;
- fallback/high-risk scenarios cannot save as Matrix pilot;
- existing template and assignment APIs parse the payloads;
- no DB schema migration is required;
- no numeric threshold gates and no fake human approvals are added.

## Final Controlled Pilot Readiness

Stage: Final Controlled Pilot Readiness.

`docs/matrix-final-controlled-pilot-readiness.md` records the current decision:
Matrix is controlled-pilot ready only after all checks pass. Matrix is not
production default. Legacy fallback remains default. High-risk medical
decisions remain non-automated and review-required.
