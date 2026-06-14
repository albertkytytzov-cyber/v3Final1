# Matrix Coach UI Manual Validation

Stage: Matrix Controlled Pilot Launch + Quality Feedback + Family Evidence Continuation.

Validation date: 2026-06-14.

## Scope

This document records the manual coach-facing UI validation status for the
Matrix controlled pilot surface after commit
`af37d34 Add matrix family evidence review and coach pilot UI`.

The validation is intentionally limited to controlled pilot behavior. It does
not enable Matrix as production default, does not change the production draft
route, and does not approve high-risk medical or weight-management decisions.

## Local Browser Smoke Check

Local web was started with the Matrix UI pilot flags enabled:

- `NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI=true`;
- `NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT=true`;
- `NEXT_PUBLIC_MATRIX_CONSTRUCTOR_SAVE_ASSIGN_PILOT=true`.

The browser opened:

- `http://localhost:3100/workspace?language=ru`;
- the workspace shell loaded;
- Russian navigation loaded;
- the `Соревнования` zone opened;
- unauthenticated guest state was displayed;
- no production write action was performed.

## Full Authenticated Coach Flow Status

The full authenticated Matrix draft flow could not be completed in this local
browser pass because the web app attempted to proxy auth state to
`127.0.0.1:4000`, and the local API was not running in this validation
environment.

The observed blocker was:

- `/api/v1/auth/me` proxy failed with connection refused to `127.0.0.1:4000`.

The API was not started during this pass to avoid accidental local database
initialization or seed-data writes outside an explicit dev/staging validation
run.

## Code-Level UI Coverage

The coach-facing Matrix read-only draft component currently exposes the
expected inspection fields:

- weeks;
- days;
- sessions;
- block names;
- block volume notes;
- concrete exercise names;
- sets, reps, duration and RPE where present;
- exercise notes;
- coach-editable state;
- volume-locked state;
- risk flags;
- evidence refs;
- local load zones.

This is implemented through
`apps/web/app/components/constructor/MatrixDraftReadOnlyView.tsx` and covered by
`npm run check:constructor-matrix-coach-ui`.

## Manual Validation Checklist

| Item | Status | Notes |
| --- | --- | --- |
| Matrix draft opens for authenticated coach | Pending staging/backend pass | Local API was not running. |
| Plan readable by weeks, days and sessions | Covered by code/checks; pending visual authenticated pass | Component renders this structure. |
| Concrete exercises visible | Covered by code/checks; pending visual authenticated pass | Scenario checks confirm exercise output. |
| Sets, reps, duration, RPE and load notes visible | Covered by code/checks; pending visual authenticated pass | Component renders these fields when present. |
| Coach-editable flags understandable | Covered by code/checks; pending visual authenticated pass | Component renders coach-editable and locked states. |
| Substitution, regression and progression visibility | Pending UX pass | Existing exercise data has variations, but authenticated visual flow still needs review. |
| Safety notes visible | Covered by code/checks; pending visual authenticated pass | Exercise notes and risk flags are visible surfaces. |
| Evidence family status visible | Covered by evidence refs; pending UX pass | Need coach readability review in staging. |
| Risk flags visible | Covered by code/checks; pending visual authenticated pass | Component renders risk flags. |
| Blocked/review-required blocks visible | Covered by scenario checks; pending visual authenticated pass | High-risk scenarios keep review-required text. |
| Save/assign pilot gate visible | Covered by UI gate checks; pending visual authenticated pass | Gate status remains controlled-pilot only. |
| Matrix is not default | Passed | Feature flags default off and production route remains legacy-backed. |

## Follow-Up For Real Pilot

Run the same UI checklist in a real dev/staging environment with:

- local or staging API running;
- safe demo coach account;
- seeded pilot fixtures;
- Matrix feature flags enabled only for the pilot cohort;
- no production athlete data;
- no production save/assign unless the controlled pilot gate explicitly passes.

## Guardrails Confirmed

- Matrix is not production default.
- Production `/api/v1/plans/constructor/draft` remains legacy-backed.
- No DB migration was added.
- No high-risk medical decision was automated.
- No rapid weight-cut or hydration protocol was automated.
- No numeric medical, weight-cut or hydration runtime threshold was added.
- No fake citation was added.
- No fake human, medical or coach approval was added.
