# Matrix Exercise Source Requirements

Stage: Matrix Exercise Source Requirements.

The Matrix exercise source-requirement registry is implemented in:

- `packages/shared/src/constructor-matrix-exercise-source-requirements.ts`;
- `scripts/check-constructor-matrix-exercise-source-requirements.mjs`.

This stage defines what source types and review work are needed for each
exercise evidence family before any future evidence approval can be considered.
It does not fabricate sources and does not approve runtime promotion.

## Source Requirement Model

Each evidence family has one source requirement with:

- family id;
- priority `P0`, `P1`, `P2` or `P3`;
- required source types;
- source questions;
- minimum acceptance criteria;
- blockers before runtime promotion;
- manual review requirement;
- human review requirement before approval when needed;
- `runtimePromotionAllowedNow: false`.

The registry is generated from
`CONSTRUCTOR_MATRIX_EXERCISE_EVIDENCE_MAP`, so every family must stay covered.

## Priority Rules

P0 requirements cover:

- high-risk blocked weight cut and hydration;
- weigh-in review-required guidance;
- nutrition body-composition guidance;
- weight-management review prompts;
- body-composition training;
- muscle-preservation training;
- BFR/KAATSU blocked screening context.

P1 requirements cover:

- Seluyanov/statodynamic LME;
- wrestling speed-endurance density;
- max strength;
- strength endurance;
- competition model and controlled bouts;
- taper activation;
- aerobic base low-impact work.

All other families stay in the backlog as lower-priority source-review work
unless a later stage promotes their priority with real review rationale.

## Safety Boundaries

Every source requirement keeps runtime promotion blocked now. This registry is
a backlog for evidence acquisition and review, not a source approval ledger.

The registry does not add DOI, PMID, authors, years, quoted passages or source
claims. It does not set `humanReviewed=true`, does not add reviewer metadata
and does not imply medical, coach or sport-science approval.

High-risk P0 requirements retain explicit blockers for rapid weight-cut
automation, hydration diagnosis automation and medical decision automation.

## Validation

Run:

```bash
npm run check:constructor-matrix-exercise-source-requirements
```

The checker validates family coverage, required P0/P1 priorities, blocked
runtime promotion, manual/human review requirements where needed, absence of
fake citations, absence of fake approvals, absence of numeric thresholds and
absence of runtime imports.
