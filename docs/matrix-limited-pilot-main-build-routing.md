# Matrix Limited Pilot Main Build Routing

This stage fixes a coach-facing routing issue: the main "build draft" action
could still show the safe legacy constructor even when the Matrix limited
primary pilot was enabled.

## Finding

The production route `/api/v1/plans/constructor/draft` is intentionally
legacy-backed. That guardrail stays unchanged.

The UI, however, also used the legacy route for the main coach build unless
`NEXT_PUBLIC_MATRIX_CONSTRUCTOR_SAVE_ASSIGN_PILOT=true` was enabled. That meant
a coach could have Matrix limited pilot enabled for plan review but still see
generic legacy rows such as technique or light SPP instead of the Matrix
exercise library.

## Routing Fix

The main `handleBuildConstructorDraft()` flow now calls the no-write server
route `/api/v1/plans/constructor/internal/matrix-primary-pilot-draft` when:

- `NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI=true`;
- `NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT=true`.

The save/assign feature flag is no longer required just to display the Matrix
controlled-pilot draft.

## Save/Assign Boundary

Saving and assignment remain separately gated. Matrix save/assign still
requires:

- `NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI=true`;
- `NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT=true`;
- `NEXT_PUBLIC_MATRIX_CONSTRUCTOR_SAVE_ASSIGN_PILOT=true`;
- server dry-run passed;
- primary pilot eligibility passed.

With the save/assign flag off, the coach can inspect the Matrix draft with
concrete exercises, RPE/load notes, safety notes and review-required blocks,
but cannot save it as a Matrix template.

## Guardrails

- Matrix is not production default.
- The production draft route remains legacy-backed.
- The Matrix primary pilot draft route is no-write.
- D-3, travel, weigh-in and competition day remain fallback/blocked for primary
  Matrix use.
- High-risk medical, weight-cut, hydration, RED-S, injury, youth and
  BFR/KAATSU decisions remain review-required or blocked.
- No numeric medical, weight-cut or hydration runtime gates are added.
- No fake citations or fake human approvals are added.
