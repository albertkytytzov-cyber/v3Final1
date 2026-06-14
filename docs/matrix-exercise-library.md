# Matrix Exercise Library

Stage: Matrix Full Training Content Library.

The Matrix exercise library is implemented in
`packages/shared/src/constructor-matrix-exercise-library.ts`. It is a
controlled-pilot content registry for concrete wrestling, strength, recovery
and preparation exercises.

## Scope

The registry covers at least 80 exercises and all current Matrix block types:

- wrestling stance and movement;
- shots and entries;
- defense and sprawl;
- par terre top and bottom;
- grip fighting and hand fighting;
- edge-of-mat situations;
- tactical score situations;
- competition model and controlled bouts;
- speed and first action;
- acceleration and change of direction;
- max strength and strength endurance;
- local muscular endurance for legs;
- posterior chain;
- trunk and anti-rotation;
- neck/prehab;
- mobility;
- aerobic recovery;
- breathing and downregulation;
- travel mobility;
- weigh-in day activation;
- post-competition recovery.

## Entry Metadata

Each exercise includes:

- exercise id and name;
- category;
- Matrix block types it can serve;
- target qualities;
- equipment and environment;
- phase and day-type applicability;
- athlete context constraints;
- contraindication flags;
- progressions and regressions;
- coaching cues and common mistakes;
- safety notes;
- load prescription mode;
- default prescription template;
- evidence dependency ids;
- review-required tracks;
- `highRiskAutomationBlocked`.

## Guardrails

The library does not add BFR/KAATSU prescriptions, medical clearance,
injury-return rules, RED-S decisions, dehydration decisions or rapid
weight-cut protocols. High-risk entries such as weigh-in, heat-exposure review
notes and neck/prehab work remain review-required or automation-blocked.

Matrix is not production default. Production route behavior is unchanged.
High-risk medical decisions remain non-automated.

## Validation

Run:

```bash
npm run check:constructor-matrix-exercise-library
```

The checker validates exercise count, block coverage, category coverage,
safety notes, coaching cues, evidence dependency ids, high-risk blocking and
absence of fake approvals.
