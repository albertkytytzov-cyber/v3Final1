# Matrix AI Internal Pilot Feedback + Resolver Hardening

Stage: AI-assisted internal pilot feedback + resolver hardening.

Validation date: 2026-06-14.

## Scope

This stage is an AI-assisted internal quality pass over synthetic Matrix pilot
fixtures and local dev UI observations. It is not a real coach review, not a
medical review and not a source approval.

No human approval was recorded. No `humanReviewed=true` state was added. No
medical, coach, nutrition or weight-management approval is implied.

## Internal Feedback Signals

The internal feedback pass used:

- D90, D28, D21, D10 and D4 controlled-pilot Matrix scenarios;
- D-3, travel, weigh-in and competition-day fallback scenarios;
- high-risk review-required scenarios for body composition, pain, youth and
  female/RED-S-sensitive context;
- local authenticated coach UI observations from the temporary dev stack;
- existing pilot quality-log summary.

## Finding

The local D21 UI pass showed body-composition candidate exercises inside light
technical pre-start blocks. The exercises were already coach-editable,
review-required and non-medical, but the naming could be misread by a coach as a
body-composition objective inside a session that should primarily protect
technical freshness.

This was a resolver-quality issue, not a high-risk automation issue:

- no unsafe rapid weight-cut protocol was present;
- no hydration, sauna, dehydration, diuretic, laxative, spitting or sweat-suit
  protocol was present;
- no fake approval wording was present;
- high-risk decisions remained blocked or review-required.

## Resolver Hardening Applied

The exercise resolver now suppresses body-composition exercise candidates when:

- the block is `mat_light_technical`;
- active weight-cut context is present;
- the Matrix phase is close-start or competition-phase;
- there is no explicit `weight_management` goal.

The adapter now passes Matrix week phase into the exercise resolver, so
phase-specific exercise filtering is actually available to plan output.

Long-horizon body-composition training remains available only as
coach-editable, review-required content when explicitly requested and when no
active weight-cut context is present.

## Validation Evidence

`check:constructor-matrix-exercise-resolver` now verifies:

- D28, D21, D10 and D4 resolve zero body-composition exercise candidates;
- a long-horizon explicit body-composition context still resolves
  body-composition candidates;
- all resolved exercises remain coach-editable and unlocked;
- weigh-in and sauna-related exercise candidates remain review-required and
  automation-blocked.

`check:constructor-matrix-real-scenario-pilot` now verifies:

- D90, D28, D21, D10 and D4 still produce Matrix controlled-pilot drafts;
- D28, D21, D10 and D4 have zero body-composition exercise candidates;
- body-composition long-horizon review-required internal scenario still carries
  body-composition candidates;
- unsafe weight-cut text and fake approval text are absent.

`check:constructor-matrix-full-content-pilot` now verifies the same suppression
at full draft/template compatibility level.

## Remaining Real Pilot Questions

This stage does not replace real coach feedback. A real pilot still needs to
evaluate:

- whether exercise density is readable enough for coaches;
- whether D28 and D21 have too much session detail;
- whether RPE and duration notes are fast to edit;
- whether evidence-family refs are useful or too technical on the coach
  surface;
- whether substitutions and regressions are practical with real equipment.

## Guardrails Confirmed

- Matrix is not production default.
- Production `/api/v1/plans/constructor/draft` remains legacy-backed.
- No production DB migration was added.
- No save/assign production path was broadened.
- No unsafe weight-cut automation was added.
- No numeric medical, hydration or weight-management runtime threshold was
  added.
- No fake citation or source passage was added.
- No fake human, medical or coach approval was added.
