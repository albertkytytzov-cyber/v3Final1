# Matrix Load Prescription

Stage: Matrix Full Training Content Library.

The Matrix load prescription engine is implemented in
`packages/shared/src/constructor-matrix-load-prescription.ts`. It turns
registry exercises into coach-editable prescriptions for the controlled pilot.

## Allowed Prescription Modes

The engine supports:

- bodyweight work;
- duration-based work;
- distance-based work;
- RPE-based work;
- technical-quality prescriptions;
- coach-selected prescriptions;
- percent/e1RM/velocity candidates only when an athlete max, estimated max or
  coach-provided training max is supplied.

## Strength Weights

Strength weights are generated only as coach-editable candidates. If no
training max/e1RM is available, Matrix does not invent a weight and falls back
to RPE, duration and technical-quality notes.

Strength numbers are training recommendations, not medical thresholds, weight
management thresholds, hydration thresholds or injury-return gates.

## Conservative Context Caps

The engine lowers intensity for recovery-priority blocks, close competition
windows, travel fatigue, injury caution and weight-management context. These
caps are conservative training safeguards, not clinical decisions.

## Seluyanov / Statodynamic Candidate Loads

Seluyanov/Siluyanov-style statodynamic exercises use coach-editable local
stimulus prescriptions. The current Matrix layer does not approve a fixed
source-verified protocol for time under tension, rest, density, failure point
or weekly progression.

The safe runtime behavior is:

- keep prescriptions editable by the coach;
- avoid failure chasing;
- require local fatigue and pain review;
- avoid hidden speed/contact conflicts;
- keep close-start taper guards active;
- treat every Seluyanov/statodynamic entry as a coach-school candidate until
  the later source-review stage maps exact evidence and review artifacts.

## Performance Candidate Loads

Speed, speed-endurance, strength, endurance and exercise-complex entries use
coach-editable candidate prescriptions. Their default prescriptions can include
sets, reps, duration, distance, RPE or technical-quality notes where that is
safe for training planning.

The safe runtime behavior is:

- speed work stays quality-first and can regress to technical-quality notes;
- speed-endurance density remains coach-selected when fatigue or contact risk
  is unclear;
- strength weights require athlete max, estimated max or coach-provided
  training max before any load candidate is calculated;
- endurance work stays educational and training-focused, not medical or
  weight-management guidance;
- complexes are treated as editable exercise bundles, not closed protocols;
- no performance candidate may become a medical, injury-return, hydration,
  weight-cut or RED-S gate.

## Body-Composition Candidate Loads

Body-composition training candidates use coach-editable prescriptions for
long-horizon fat-loss support while preserving strength, muscle mass and
training quality. They may include strength-maintenance work, low-impact
conditioning, technical-density drills and recovery flushes.

The safe runtime behavior is:

- strength-maintenance load remains coach-editable and follows the same
  max/e1RM rule as other strength candidates;
- low-impact conditioning uses duration/RPE/technical-quality guidance, not
  medical or weight-cut thresholds;
- body-composition entries never prescribe kg loss, exact calories,
  dehydration, sauna, sweat suits, diuretics, laxatives, spitting or medical
  clearance;
- appetite, sudden fatigue, performance drop, RED-S-sensitive context or rapid
  weight change remains review-required.

## Output Contract

Prescriptions keep the existing `ConstructorPlanExercise` output shape and add
metadata only inside Matrix internals before template serialization. Template
payloads must not persist Matrix internals.

## Guardrails

- all prescriptions are `coachEditable=true`;
- all prescriptions are `loadLocked=false`;
- no medical diagnosis is automated;
- no injury-return clearance is automated;
- no weight-cut or hydration decision is automated;
- no numeric medical threshold gate is added;
- Matrix is not production default.

## Matrix Exercise Evidence Map

Stage: Matrix Exercise Evidence Map.

Load-prescription families are now represented in
`packages/shared/src/constructor-matrix-exercise-evidence-map.ts`. Max
strength, strength endurance, Seluyanov/statodynamic LME, speed endurance,
taper activation, aerobic base and body-composition training are review
families rather than final evidence-approved protocols.

The map preserves the current rule: training-load prescriptions are
coach-editable candidates. It does not approve fixed thresholds, failure
points, medical gates, weight-management gates or production runtime
promotion.

## Matrix Exercise Source Requirements

Stage: Matrix Exercise Source Requirements.

`packages/shared/src/constructor-matrix-exercise-source-requirements.ts`
records which source types and review questions are needed before a load
family can move beyond candidate status. All source requirements keep
`runtimePromotionAllowedNow: false`.

## Validation

Run:

```bash
npm run check:constructor-matrix-load-prescription
npm run check:constructor-matrix-exercise-evidence-map
npm run check:constructor-matrix-exercise-source-requirements
```

The checker validates missing-max fallback, max/e1RM-backed strength
candidates, coach-editable flags, unlocked load and high-risk blocking.
