# Matrix Exercise Evidence Map

Stage: Matrix Exercise Evidence Map.

The Matrix exercise evidence map is implemented in:

- `packages/shared/src/constructor-matrix-exercise-evidence-map.ts`;
- `scripts/check-constructor-matrix-exercise-evidence-map.mjs`.

This stage maps the expanded Matrix exercise, nutrition and weight-management
content into evidence-review families. It does not approve the content, does
not add new citations and does not promote any family into production runtime.

## Purpose

The full Matrix library now contains many exercise and guidance entries. The
next evidence stage should not review every exercise one by one. Instead, this
map groups related items into review families such as max strength,
speed-endurance wrestling density, Seluyanov/statodynamic LME,
body-composition training, nutrition guidance and blocked weight-cut or
hydration contexts.

Each family records:

- linked exercise ids;
- linked nutrition guidance ids;
- linked weight-management guidance ids;
- methodology tags and target qualities;
- Matrix block types;
- existing evidence dependency ids;
- source backlog, candidate and lookup-intake refs where available;
- required source types;
- review tracks;
- allowed metadata use now;
- forbidden uses;
- limitations;
- future evidence questions;
- acceptance criteria for any later approval.

## Coverage

The checker requires every item in `CONSTRUCTOR_MATRIX_EXERCISE_LIBRARY`,
`CONSTRUCTOR_MATRIX_NUTRITION_GUIDANCE` and
`CONSTRUCTOR_MATRIX_WEIGHT_MANAGEMENT_GUIDANCE` to map to at least one family.

Required families include:

- Seluyanov/statodynamic local muscular endurance;
- speed and acceleration;
- wrestling speed endurance and contact density;
- max strength and strength endurance;
- posterior chain, trunk and grip strength endurance;
- aerobic base, recovery and travel mobility;
- wrestling and par terre technical transfer;
- competition model and controlled bouts;
- taper activation;
- body-composition training and muscle preservation;
- nutrition and weight-management review prompts;
- weigh-in review-required guidance;
- high-risk blocked weight-cut and hydration context.

## Safety Boundaries

This map is metadata-only. It does not change Matrix runtime behavior,
production route behavior, save/assign behavior, preview behavior or rollout
gates.

High-risk families cannot allow runtime plan content. Weight cut, hydration,
weigh-in manipulation, RED-S-sensitive contexts and BFR/KAATSU remain blocked,
fallback-only, docs-only or review-export-only.

Body-composition families explicitly forbid rapid weight cut, dehydration,
exact kg-loss prescription and exact calorie prescription. Strength families
may remain coach-editable training candidates, but they do not approve medical
or weight-management thresholds.

No family records human review. All families keep `humanReviewed: false`; no
`reviewedBy` or `reviewedAt` fields are present.

## Validation

Run:

```bash
npm run check:constructor-matrix-exercise-evidence-map
```

The checker validates coverage, references, high-risk boundaries, absence of
fake approvals, absence of fake citations, absence of numeric medical or
weight-cut thresholds and absence of runtime imports.
