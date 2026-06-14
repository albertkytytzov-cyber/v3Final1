# Matrix Full Content Controlled Pilot

Stage: Matrix Full Content Controlled Pilot.

This stage makes Matrix controlled-pilot drafts richer by adding concrete
exercise content, coach-editable load prescriptions, educational nutrition
guidance, safe weight-management review prompts and explicit high-risk
blocking metadata.

## Enabled Pilot Scenarios

The full-content checker validates these Matrix controlled-pilot scenarios:

- D90 far development week;
- D28 special pre-competition;
- D21 controlled volume;
- D10 taper;
- D4 start-window pilot.

These scenarios can generate concrete wrestling, strength, mobility, recovery
and preparation exercise plans while preserving the existing plan/template
output shape.

## Fallback / Blocked Scenarios

The following remain fallback or blocked for active Matrix pilot save/assign:

- D-3 final activation;
- travel day;
- weigh-in day;
- competition day;
- high-risk weight-cut, hydration, RED-S, pain, injury-return, youth and
  BFR/KAATSU contexts.

High-risk medical decisions remain non-automated.

## Template Payload Boundary

Controlled-pilot drafts may contain Matrix full-content metadata internally,
but template payloads must not persist:

- Matrix internals;
- AI runtime metadata;
- exercise-library summaries;
- nutrition guidance metadata;
- weight-management guidance metadata;
- rollout or pilot-readiness metadata;
- source/review metadata.

Existing API contracts remain unchanged.

## Feature Flags

Matrix remains feature-flagged and controlled-pilot only. Matrix is not
production default. Legacy fallback remains default.

## Validation

Run:

```bash
npm run check:constructor-matrix-full-content-pilot
```

The checker builds the allowed pilot scenarios, verifies concrete exercise
density, confirms that strength weights are not invented when max/e1RM is
missing, confirms fallback scenarios stay fallback, and confirms the production
draft route remains legacy-backed.
