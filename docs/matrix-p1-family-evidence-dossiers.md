# Matrix P1 Family Evidence Dossiers

Stage: Matrix Family-Level Evidence Review + Coach UI + Controlled Pilot Readiness.

P1 dossiers live in
`packages/shared/src/constructor-matrix-p1-family-evidence-dossiers.ts` and are
checked by `npm run check:constructor-matrix-p1-family-evidence-dossiers`.

## P1 Families

- `seluyanov_statodynamic_lme`
- `speed_endurance_wrestling_density`
- `max_strength`
- `strength_endurance`
- `competition_model_and_controlled_bouts`
- `taper_activation`
- `aerobic_base_low_impact`

## Decisions

P1 families are allowed only as coach-editable controlled-pilot training
content. They are not hard protocols and do not create medical, weight-cut,
hydration, pain, injury-return or competition-day automation.

Seluyanov/statodynamic LME remains coach-school and sport-science review aware.
BFR/KAATSU is explicitly separated and blocked.

Max-strength and strength-endurance prescriptions remain editable. Missing
athlete max/e1RM context must fall back to RPE, duration or technical-quality
notes.

## Guardrails

- `humanReviewed=false`;
- no fake coach approval;
- no locked load prescription;
- no exact protocol approval;
- no production default promotion.
