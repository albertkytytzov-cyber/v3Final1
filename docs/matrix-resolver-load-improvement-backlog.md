# Matrix Resolver And Load Improvement Backlog

Stage: Matrix Controlled Pilot Launch + Quality Feedback + Family Evidence Continuation.

Validation date: 2026-06-14.

## Scope

This backlog captures likely improvement areas after controlled pilot scenario
checks and the AI-assisted internal pilot feedback pass. Runtime changes should
remain tied to concrete quality evidence and must preserve high-risk guardrails.

## Exercise Selection Backlog

- Review whether D28 and D21 plans surface too many exercise items for coach
  readability.
- Check whether wrestling-specific technical blocks need stronger filtering by
  phase, start proximity and athlete level.
- Check whether competition-model blocks produce enough tactical variety
  without becoming too broad.
- Check whether recovery and mobility blocks repeat too often across close
  start scenarios.
- Check whether body-composition training candidates are clearly separated from
  unsafe rapid weight-cut logic.
- Resolved in internal hardening: body-composition candidate exercises are now
  suppressed inside close-start, active weight-cut and `mat_light_technical`
  contexts, while long-horizon explicit body-composition contexts can still
  expose coach-editable review-required candidates.

## Load Prescription Backlog

- Confirm that missing max or e1RM inputs always fall back to RPE, duration or
  technical-quality prescription.
- Confirm that coach-editable strength-load candidates are clear when max or
  e1RM is present.
- Review whether RPE notes are specific enough for wrestling sessions.
- Review whether taper and start-window reductions are conservative enough.
- Review whether local muscular endurance work needs clearer density notes
  without becoming hard threshold logic.

## Equipment And Context Backlog

- Add real coach feedback on missing equipment substitutions.
- Validate home, travel, mat and gym environment filters in staging.
- Check if travel-day and weigh-in-day fallback messages are understandable.
- Check whether youth, female-context, pain and injury flags produce visible
  review-required notes without implying diagnosis or clearance.

## Nutrition And Weight-Management Backlog

- Keep nutrition guidance educational and review-required.
- Keep body-composition guidance long-horizon and non-medical.
- Do not add exact calorie, kg-loss, dehydration, sauna, sweat-suit, diuretic,
  laxative, spitting or water-restriction protocols.
- Improve wording only after source-text review and coach/medical review
  artifacts exist.

## Evidence-Driven Resolver Improvements

Resolver and load changes should be considered only after:

- family-level source review is completed;
- pilot quality logs show repeated quality issues;
- coach feedback identifies a specific mismatch;
- the change can be validated by scenario checks;
- high-risk guardrails remain unchanged.

## Current Decision

One resolver hardening change is applied from the internal feedback pass:

- Matrix week phase is passed into the exercise resolver;
- body-composition candidates are suppressed in close-start/light technical and
  active weight-cut contexts;
- long-horizon explicit body-composition content remains available only as
  coach-editable review-required content.

The remaining findings are quality-review signals, not confirmed defects:

- generated plans pass controlled-pilot checks;
- unsafe weight-cut language is absent;
- fake approval language is absent;
- high-risk decisions remain blocked or review-required;
- dense coach-facing text still needs real coach feedback before changing UI
  density or exercise-row presentation.

## Non-Goals

- No Matrix production default.
- No production route change.
- No DB migration.
- No automatic high-risk medical or weight-cut decision.
- No numeric medical, weight-cut or hydration runtime gate.
- No fake citation.
- No fake human, medical or coach approval.
