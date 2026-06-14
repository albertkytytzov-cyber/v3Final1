# Matrix P0 Family Evidence Dossiers

Stage: Matrix Family-Level Evidence Review + Coach UI + Controlled Pilot Readiness.

P0 dossiers live in
`packages/shared/src/constructor-matrix-p0-family-evidence-dossiers.ts` and are
checked by `npm run check:constructor-matrix-p0-family-evidence-dossiers`.

## P0 Families

- `body_composition_training`
- `muscle_preservation_training`
- `nutrition_body_composition_guidance`
- `weight_management_review_prompt`
- `weigh_in_review_required_guidance`
- `high_risk_blocked_weight_cut_hydration`
- `bfr_kaatsu_blocked_screening_context`

## Decisions

Body-composition and muscle-preservation training can remain coach-editable
training candidates in controlled pilot. They do not approve any weight-loss,
calorie, body-mass or medical decision.

Nutrition/body-composition guidance stays educational and review-export only.
Weight management, weigh-in, hydration/weight-cut and BFR/KAATSU stay blocked
or review-required.

## Guardrails

- no rapid weight-cut automation;
- no dehydration protocol;
- no sauna, sweat-suit, diuretic, laxative, spitting or water-restriction
  protocol;
- no RED-S diagnosis;
- no BFR/KAATSU prescription;
- no numeric medical or hydration threshold gate;
- no human review is recorded.
