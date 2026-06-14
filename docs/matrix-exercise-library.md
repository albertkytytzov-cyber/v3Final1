# Matrix Exercise Library

Stage: Matrix Full Training Content Library.

The Matrix exercise library is implemented in
`packages/shared/src/constructor-matrix-exercise-library.ts`. It is a
controlled-pilot content registry for concrete wrestling, strength, recovery
and preparation exercises.

## Scope

The registry covers at least 80 exercises and all current Matrix block types.
After the Seluyanov/statodynamic expansion it contains dedicated
coach-school candidate exercises for local muscular endurance and wrestling
transfer:

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

## Seluyanov / Statodynamic Candidate Layer

The library now includes Seluyanov/Siluyanov-style statodynamic local muscular
endurance candidates for:

- legs and hip position;
- posterior chain;
- grip, hands and upper-body local endurance;
- trunk and anti-rotation;
- controlled technique transfer after local fatigue;
- par terre pressure and bottom-base work;
- low-force neck control as high-risk review-required content.

These entries are tagged as `seluyanov_statodynamic_lme_candidate` and
`coach_school_candidate`. They are based on the existing PERFORM methodology
documents that describe Seluyanov/statodynamic work as a practical coach-school
layer for local muscular endurance, constant tension, local fatigue control and
wrestling transfer.

They are not marked as source-verified protocols. They require coach and
sport-science review, and the neck-related entry also requires medical review.
Future evidence work must map each exercise family to exact sources, review
artifacts and accepted use.

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
Seluyanov/statodynamic entries are coach-editable candidates, not automatic
load prescriptions and not source-verified protocols.

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
