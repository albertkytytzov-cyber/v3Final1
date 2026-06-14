# Matrix Exercise Library

Stage: Matrix Full Training Content Library.

The Matrix exercise library is implemented in
`packages/shared/src/constructor-matrix-exercise-library.ts`. It is a
controlled-pilot content registry for concrete wrestling, strength, recovery
and preparation exercises.

## Scope

The registry covers at least 200 exercises and all current Matrix block types.
After the Seluyanov/statodynamic, performance-content and body-composition
expansions it contains dedicated coach-school candidate exercises for local
muscular endurance, wrestling transfer, speed, speed endurance, strength,
endurance, exercise complexes and long-horizon body-composition support:

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

## Body-Composition Training Candidate Layer

The library now includes body-composition training candidates for long-horizon
fat-loss support while preserving strength, muscle mass and training quality.
This layer includes:

- full-body strength-maintenance candidates;
- push/pull/hinge strength-endurance circuits;
- lower- and upper-body strength anchors;
- posterior-chain, trunk, grip and carry circuits;
- low-impact bike, rower and walk/run conditioning;
- low-contact wrestling movement and technical-chain density;
- recovery flush, travel reset and post-competition habit reset candidates.

These entries are tagged with `body_composition_training_candidate` and may
also include `muscle_preservation_candidate`,
`low_impact_conditioning_candidate`, `strength_development_candidate`,
`endurance_development_candidate` or `exercise_complex_candidate`.

This is not a rapid weight-cut layer. It does not prescribe dehydration,
sauna, sweat suits, diuretics, laxatives, spitting, last-minute weigh-in
manipulation or medical decisions. The entries remain coach-editable and
require coach and sport-science review before evidence-family approval.

## Performance Exercise And Complex Candidate Layer

The library now includes a broad performance-content candidate layer for:

- speed development and first-action work;
- acceleration, change of direction and reactive movement;
- wrestling-specific speed endurance;
- repeated shot, sprawl, hand-fight and edge-exchange density;
- max-strength and strength-endurance candidates;
- posterior-chain, trunk and grip strength candidates;
- aerobic base, tempo and low-contact endurance candidates;
- wrestling complexes that combine stance, entries, defense, par terre,
  grip, strength transfer, taper activation, travel reset and recovery.

These entries are tagged with `performance_content_candidate` and one or more
specific tags such as `speed_development_candidate`,
`speed_endurance_candidate`, `strength_development_candidate`,
`endurance_development_candidate` or `exercise_complex_candidate`.

This layer is intentionally broad enough for controlled-pilot plan generation,
but it is still candidate content. It is not a final evidence-approved
exercise protocol library. Every performance candidate requires coach and
sport-science review, remains coach-editable and must not be used as a
medical, injury-return, weight-management, hydration or RED-S decision.

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
Performance-content candidates are also coach-editable and not
source-verified protocols. Speed, strength, endurance and complex density
prescriptions remain training suggestions, not hard runtime gates.
Body-composition candidates are long-horizon training support only. They do
not authorize rapid weight cuts, dehydration methods or automatic body-mass
targets.

Matrix is not production default. Production route behavior is unchanged.
High-risk medical decisions remain non-automated.

## Matrix Exercise Evidence Map

Stage: Matrix Exercise Evidence Map.

The expanded exercise library is now mapped into evidence-review families in
`packages/shared/src/constructor-matrix-exercise-evidence-map.ts`. This keeps
the evidence workflow reviewable at the family level instead of forcing the
next stage to audit every exercise in isolation.

All exercises must map to at least one family. The map also covers nutrition
guidance and weight-management guidance, but it remains metadata-only. It does
not add final source approval, fake citations, fake human review or runtime
promotion.

## Matrix Exercise Source Requirements

Stage: Matrix Exercise Source Requirements.

`packages/shared/src/constructor-matrix-exercise-source-requirements.ts`
records source requirements for each evidence family. Body-composition,
weight-management, weigh-in, high-risk hydration and BFR/KAATSU contexts keep
P0 review/source requirements and cannot become runtime gates from this stage.

## Validation

Run:

```bash
npm run check:constructor-matrix-exercise-library
npm run check:constructor-matrix-exercise-evidence-map
npm run check:constructor-matrix-exercise-source-requirements
```

The checker validates exercise count, block coverage, category coverage,
safety notes, coaching cues, evidence dependency ids, high-risk blocking and
absence of fake approvals.
