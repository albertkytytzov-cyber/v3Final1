# Matrix Save/Assign Controlled Pilot

Stage: Matrix Save/Assign Controlled Pilot.

This stage allows Matrix-derived preparation drafts to become save-compatible
only for controlled pilot users and only when every explicit gate passes. It
does not make Matrix the production default, does not change the production
constructor route and does not add a new persistence contract.

## Stage: Matrix Full Training Content Library

Matrix controlled pilot drafts may now include richer exercise content,
coach-editable load prescriptions, educational nutrition guidance and
review-required weight-management prompts. This does not widen save/assign
eligibility.

Strength weights require athlete max/e1RM or coach-provided training max.
Missing max/e1RM falls back to RPE, duration and technical-quality guidance.
Nutrition guidance is not medical advice. Weight-management guidance is
non-automated and review-required.

## Stage: Matrix Full Content Controlled Pilot

Full-content drafts remain save-compatible only when the existing controlled
pilot gates pass. Template payloads must not persist Matrix internals, full
content summaries, nutrition metadata, weight-management metadata,
AI/runtime metadata, source metadata or review metadata.

Matrix is not production default. High-risk medical decisions remain
non-automated.

## Deployment Mode

Deployment mode is feature-flagged controlled pilot only.

Required flags:

```bash
NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI=true
NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT=true
NEXT_PUBLIC_MATRIX_CONSTRUCTOR_SAVE_ASSIGN_PILOT=true
```

All Matrix feature flags remain off by default. Matrix is not production
default. Legacy constructor save remains the default path.

## Required Gates

Matrix save/assign controlled pilot can be available only when all of these
conditions are true:

- active draft source is `matrix_primary_pilot`;
- rollout mode is `matrix_allowed_for_primary`;
- pilot readiness is `ready_for_limited_primary_pilot`;
- local Matrix save dry-run passed;
- server Matrix save dry-run passed;
- server gate allowed the same scenario as the local gate;
- generated template payload excludes Matrix internals;
- existing template and assignment schemas parse the payload.

The production route `/api/v1/plans/constructor/draft` remains legacy-backed.
The internal Matrix endpoints remain no-write validation endpoints. There is no
DB schema migration for this stage.

## Allowed Save/Assign Scenarios

The controlled pilot checker validates save-compatible payloads for these
allowed scenarios:

- D90 far development week;
- D28 special pre-competition;
- D21 controlled volume;
- D10 taper;
- D4 start-window pilot.

These scenarios still require the full feature-flag, rollout, readiness,
server dry-run and server gate chain. A passing dry-run means the Matrix draft
can produce an existing `PlanTemplatePayload` shape. It is not a medical or
coach approval.

## Blocked Save/Assign Scenarios

Matrix save/assign remains unavailable for:

- `matrix_internal` drafts;
- preview-only scenarios;
- fallback scenarios;
- D-3 final activation;
- travel day;
- weigh-in day;
- competition day;
- weight-cut, hydration, RED-S, pain, injury-return, youth and BFR/KAATSU
  high-risk contexts.

High-risk medical decisions remain non-automated. High-risk entries remain
blocked, fallback-only or review-required.

## Payload Boundary

Template payloads must not persist Matrix internals, AI runtime metadata,
rollout decisions, pilot readiness, review metadata, source metadata or runtime
eligibility metadata.

Existing API contracts are reused:

- `/api/v1/plans/templates`;
- `/api/v1/plans/assign`;
- `/api/v1/plans/auto-assign-microcycle`.

No new public API contract is introduced. No DB schema migration is required.

## Rollback

Rollback is feature-flag first:

1. Disable `NEXT_PUBLIC_MATRIX_CONSTRUCTOR_SAVE_ASSIGN_PILOT`.
2. Disable `NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT`.
3. Disable `NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI`.
4. Keep `/api/v1/plans/constructor/draft` on legacy.
5. Use legacy templates and assignments while Matrix evidence is reviewed.

No DB rollback is expected because this stage does not require a schema
migration.

## Monitoring

Monitor:

- Matrix pilot save attempts;
- blocked server dry-runs;
- server/local gate mismatches;
- template payload parse errors;
- assignment payload parse errors;
- accidental Matrix internals in template payloads;
- high-risk blocked context attempts;
- any copy that could imply human, medical or coach approval.

## Known Limitations

- No high-risk automation is enabled.
- No numeric threshold gate is approved.
- No fake human approvals are added.
- AI desk review is not human review.
- Real source-text and manual review are still required before any high-risk
  expansion.

## Final Controlled Pilot Readiness Link

This stage feeds the Final Controlled Pilot Readiness decision. Matrix is not
production default; high-risk medical decisions remain non-automated; no DB
schema migration is required; no numeric threshold runtime gates are added; no
fake human approvals are added.
