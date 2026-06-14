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

The controlled pilot also includes Seluyanov/Siluyanov-style statodynamic
candidate exercises for local muscular endurance and wrestling transfer. These
entries are coach-school candidates and review-required; they are not
source-verified protocols yet.

The pilot now also includes performance-content candidate exercises and
complexes for speed development, speed endurance, strength development,
endurance development and wrestling-specific bundled complexes. These entries
make the generated drafts more complete for coach review, while still
remaining candidate content. They are coach-editable, review-required at the
methodology level and not source-verified protocols yet.

The pilot also includes body-composition training candidates for long-horizon
fat-loss support while preserving strength and training quality. These entries
can enrich development and GPP/SPP drafts with strength-maintenance,
low-impact conditioning, technical-density and recovery options. They are not
rapid weight-cut prescriptions and cannot authorize dehydration, sauna,
medical clearance or automatic body-mass targets.

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

## Family Evidence Review Extension

Stage: Matrix Family-Level Evidence Review + Coach UI + Controlled Pilot
Readiness.

Controlled pilot drafts now have a family-reviewed metadata layer and a
coach-facing inspection UI. P0/P1 dossiers do not approve medical or weight
decisions. They only keep safe training families coach-editable and keep
high-risk areas blocked, fallback or review-required.
