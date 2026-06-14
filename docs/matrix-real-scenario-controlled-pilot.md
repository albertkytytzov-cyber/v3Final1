# Matrix Real Scenario Controlled Pilot

Stage: Matrix Family-Level Evidence Review + Coach UI + Controlled Pilot Readiness.

The real-scenario controlled pilot checker is
`npm run check:constructor-matrix-real-scenario-pilot`.

## Covered Scenarios

Allowed controlled pilot scenarios:

- D90 development;
- D28 main-start preparation;
- D21 controlled volume;
- D10 taper;
- D4 start window.

Fallback or blocked scenarios:

- D-3 final activation;
- travel day;
- weigh-in day;
- competition day.

High-risk review-required scenarios:

- body-composition long-horizon context;
- pain/injury context;
- youth context;
- female/RED-S-sensitive context.

## Expected Behavior

Allowed scenarios generate concrete coach-editable plans. Fallback scenarios do
not use Matrix as the active save path. High-risk scenarios may be inspected as
Matrix internal drafts, but they must keep review-required or blocked language
and must not automate medical or weight-control decisions.

Production `/api/v1/plans/constructor/draft` remains legacy-backed.
