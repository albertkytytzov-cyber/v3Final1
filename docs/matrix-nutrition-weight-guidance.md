# Matrix Nutrition And Weight Guidance

Stage: Matrix Full Training Content Library.

The nutrition and weight-management layers are implemented in:

- `packages/shared/src/constructor-matrix-nutrition-guidance.ts`;
- `packages/shared/src/constructor-matrix-weight-management-guidance.ts`.

These layers are controlled-pilot guidance metadata. They are not medical
advice and do not replace a qualified professional.

## Nutrition Guidance

Allowed guidance includes:

- body-composition meal-pattern review prompts;
- muscle-preservation fueling prompts;
- training-day recovery prompts for body-composition phases;
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

- long-horizon body-composition review prompts;
- fat-loss support without rapid-cut automation;
- muscle-mass preservation context checks;
- plateau review prompts that look at sleep, recovery and training density;
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

## Body-Composition Boundary

Body-composition guidance is allowed only as educational and review-required
support for long-horizon planning. It can ask for body-mass trend, strength
trend, recovery context, appetite/fatigue context and coach review.

Matrix must not convert this layer into automatic kg-loss targets, exact
calorie prescriptions, rapid weight-cut plans, dehydration protocols, sauna
use, sweat-suit/spitting protocols, diuretic/laxative advice, RED-S decisions
or medical clearance.

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
