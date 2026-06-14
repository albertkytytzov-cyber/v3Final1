# Matrix Coach-Facing UI

Stage: Matrix Family-Level Evidence Review + Coach UI + Controlled Pilot Readiness.

The coach-facing Matrix surface is an inspection and editing-support surface
inside the existing controlled pilot UI. It does not enable Matrix as default
and does not change save/assign contracts.

## What The Coach Sees

- weeks, days and sessions;
- block names and volume notes;
- concrete exercise names;
- sets, reps, duration and RPE where present;
- exercise notes;
- coach-editable and load-locked flags;
- risk flags;
- evidence references;
- local load zones.

## What The UI Does Not Do

- it does not persist Matrix internals into templates;
- it does not store source-review or dossier metadata in save payloads;
- it does not bypass save/assign controlled pilot gates;
- it does not enable production Matrix default;
- it does not display fake human approval.

The UI is guarded by the same Matrix feature flags and by
`npm run check:constructor-matrix-coach-ui`.
