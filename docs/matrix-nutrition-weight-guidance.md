# Matrix Nutrition And Weight Guidance

Stage: Matrix Full Training Content Library.

The nutrition and weight-management layers are implemented in:

- `packages/shared/src/constructor-matrix-nutrition-guidance.ts`;
- `packages/shared/src/constructor-matrix-weight-management-guidance.ts`.

These layers are controlled-pilot guidance metadata. They are not medical
advice and do not replace a qualified professional.

## Nutrition Guidance

Allowed guidance includes:

- general meal timing reminders;
- training-day fueling reminders;
- recovery meal reminders;
- travel-day food planning;
- competition-day routine prompts;
- weigh-in review-required checklists;
- allergen/diet-preference placeholders for coach review.

Forbidden uses include exact calorie prescriptions, dehydration protocols,
rapid weight-cut protocols, diuretics, laxatives, sweat-suit/spitting
protocols, RED-S decisions and medical diagnosis.

## Weight-Management Guidance

Allowed guidance includes:

- request current body-mass trend;
- request target-category confirmation;
- flag missing data;
- require coach/qualified review when a weight-management concern exists;
- explain that aggressive last-minute loss cannot be automated;
- provide safety-focused weigh-in prompts without dehydration methods.

Forbidden uses include automatic kg loss recommendations, automatic water
restriction, sauna prescription, sweat-suit or dehydration methods, medication
advice, diuretic/laxative advice, spitting protocols, medical clearance and
hard numeric runtime thresholds.

## High-Risk Boundary

Weight cut, hydration, RED-S-sensitive context, pain, injury-return, youth
context and BFR/KAATSU remain blocked, fallback-only or review-required.
Matrix does not add fake human approvals and does not set `humanReviewed=true`.

## Validation

Run:

```bash
npm run check:constructor-matrix-nutrition-weight-guidance
```

The checker validates evidence refs, review-required status, not-medical-advice
limitations and absence of unsafe action guidance.
