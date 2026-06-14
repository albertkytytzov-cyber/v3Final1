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

## Local Dev Stack

The validation used a temporary local dev stack:

- temporary PostgreSQL on `127.0.0.1:15432`;
- temporary Redis on `127.0.0.1:16379`;
- API on `127.0.0.1:4000`;
- web on `http://localhost:3100`;
- `SEED_DEMO_DATA=true`;
- demo coach account from repository seed data;
- demo athlete selected from seeded data.

No production service, production database or production athlete id was used.

Local web was started with the Matrix UI pilot flags enabled:

- `NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI=true`;
- `NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT=true`;
- `NEXT_PUBLIC_MATRIX_CONSTRUCTOR_SAVE_ASSIGN_PILOT=true`.

The browser opened:

- `http://localhost:3100/workspace?language=ru`;
- the workspace shell loaded;
- Russian navigation loaded;
- demo coach login succeeded;
- `Demo Athlete` was selected;
- the `Планирование` workspace opened;
- the `Конструктор` tab opened;
- the Matrix control block was visible;
- no production write action was performed.

## Authenticated Coach Flow Result

The authenticated coach flow passed in the temporary local dev stack.

The D21 Matrix draft was generated from the constructor screen with the default
manual start configuration:

- manual start date;
- 21 plan days;
- selected athlete `Demo Athlete`;
- phase shown as special preparation;
- Matrix working plan generated as `Matrix-конструктор`.

The generated plan showed:

- weeks;
- days;
- morning and evening sessions where applicable;
- concrete exercise names;
- sets, reps, duration and RPE;
- coach-editable notes;
- load-locked notes;
- risk flags;
- evidence references;
- local load zones;
- review-required language;
- fallback/safe-mode language.

The controlled save/assign pilot path was also checked in the temporary local
database:

- `Сохранить шаблон и перейти к назначению` was visible;
- template save succeeded;
- the UI moved to assignment mode;
- `PERFORM Constructor Candidate` was selected;
- assignment of 21 training days to `Demo Athlete` succeeded in the temporary
  dev database.

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
| Matrix draft opens for authenticated coach | Passed in local dev | Demo coach generated a D21 Matrix draft. |
| Plan readable by weeks, days and sessions | Passed in local dev | Week/day/session structure was visible. |
| Concrete exercises visible | Passed in local dev | Exercise names were visible inside blocks. |
| Sets, reps, duration, RPE and load notes visible | Passed in local dev | RPE and prescription notes were visible. |
| Coach-editable flags understandable | Passed in local dev | `редактируется тренером` and coach-editable notes were visible. |
| Substitution, regression and progression visibility | Passed with verbosity concern | Regression/progression text was visible but long. |
| Safety notes visible | Passed with verbosity concern | Safety notes were visible but dense. |
| Evidence family status visible | Partially passed | Evidence refs were visible; family-level readability still needs coach feedback. |
| Risk flags visible | Passed in local dev | Risk flags were visible. |
| Blocked/review-required blocks visible | Passed in local dev | Review-required language was visible. |
| Save/assign pilot gate visible | Passed in local dev | Save template and assignment path worked in temporary dev DB. |
| Matrix is not default | Passed | Feature flags default off and production route remains legacy-backed. |

## Quality Notes From The UI Pass

- The coach-facing draft is functionally visible, but the exercise rows can be
  very dense because each row includes prescription, source-review limitation,
  safety note, regressions and progressions.
- D21 output included body-composition candidate exercises in light technical
  blocks. They are guarded as coach-editable and non-medical, but this should be
  reviewed in pilot quality feedback because the wording may read like a
  body-composition objective inside a pre-start technical day.
- Evidence references are visible, but family-level evidence status may need a
  more compact coach-facing presentation before broader pilot use.

## Follow-Up For Real Pilot

Run the same UI checklist in a real dev/staging environment with:

- local or staging API running;
- safe demo coach account;
- seeded pilot fixtures;
- Matrix feature flags enabled only for the pilot cohort;
- no production athlete data unless the environment is explicitly approved for
  pilot testing;
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
