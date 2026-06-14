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

## Validation

Run:

```bash
npm run check:constructor-matrix-load-prescription
```

The checker validates missing-max fallback, max/e1RM-backed strength
candidates, coach-editable flags, unlocked load and high-risk blocking.
