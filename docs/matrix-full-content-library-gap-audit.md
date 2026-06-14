# Matrix Full Content Library Gap Audit

Stage: Matrix Full Training Content Library.

This audit records the gap between the earlier Matrix controlled-pilot
structure builder and the richer controlled-pilot preparation-plan engine.
The stage remains controlled-pilot only. Matrix is not production default, the
production route `/api/v1/plans/constructor/draft` remains legacy-backed and
high-risk medical decisions remain blocked or review-required.

## Current Capability

Before this stage, Matrix could build controlled-pilot D90, D28, D21, D10 and
D4 preparation structures, validate rollout/readiness gates, and produce
save-compatible template payloads behind explicit pilot gates. The plan body
was still thin in places because block content came from limited hardcoded
exercise examples rather than a broader Matrix exercise registry.

Existing block types include mat technique, mat tactics, competition model,
controlled bouts, light technical work, SPP, GPP, leg LMV, first-action speed,
aerobic deload, mobility, recovery, sauna, environment change, travel,
weigh-in, competition start and post-competition recovery.

## Missing Before This Stage

Missing or incomplete layers:

- broad wrestling exercise coverage across stance, entries, defense, par
  terre, hand fighting, edge scenarios and tactical score situations;
- broader strength, strength-endurance, posterior-chain, trunk, neck/prehab
  and recovery content;
- registry-backed block-to-exercise resolution;
- coach-editable load prescriptions;
- explicit fallback when athlete max/e1RM is missing;
- metadata for athlete context requirements;
- educational nutrition guidance;
- safe weight-management review prompts;
- validation that concrete pilot drafts contain exercises while template
  payloads exclude Matrix internals.

## Safe Training Prescription

Safe training prescription can include concrete wrestling drills, strength
exercises, mobility, aerobic recovery, breathing/downregulation and
post-competition recovery content. These prescriptions are coach-editable and
do not represent medical, nutrition or weight-cut approval.

## Coach-Editable Training Recommendations

Training load recommendations may include sets, reps, duration, RPE and
strength-load candidates only when a coach/athlete-provided training max or
estimated max exists. When the max/e1RM input is missing, Matrix falls back to
RPE, duration and technical-quality guidance.

All training-load numbers are coach-editable. They are not medical thresholds,
weight-management gates or injury-return clearance.

## Nutrition Education

Nutrition guidance is educational and limited to reminders such as meal
timing, familiar foods, recovery meals, travel planning and competition-day
routine prompts. It is not medical advice and does not prescribe calories,
dehydration, rapid weight loss or clinical decisions.

## Weight-Management Guidance

Weight-management guidance is review-required and non-automated. Matrix can
ask for body-mass trend, target-category confirmation and coach/qualified
review. Matrix cannot prescribe automatic kg loss, water restriction, sauna
use, dehydration methods, medication, diuretics, laxatives, sweat-suit use,
spitting or clearance language.

## Medical / Review-Required Decisions

The following remain review-required, blocked or fallback-only:

- weight cut;
- hydration;
- RED-S-sensitive and female-context decisions;
- pain and injury-return decisions;
- youth progression and youth weight-management decisions;
- BFR/KAATSU;
- unsafe competition-day decisions.

No fake human approvals were added. `humanReviewed` remains false unless real
review artifacts exist.

## Save/Assign Boundary

Controlled pilot save/assign still requires the explicit feature-flag,
rollout, readiness, server dry-run and server-gate chain. Matrix internals,
exercise library metadata, AI/runtime metadata, source metadata and review
metadata are not persisted into template payloads.

## Remaining Work

Future work remains real source-text/manual review for high-risk expansion,
pilot monitoring and a separate production-readiness decision. Matrix Full
Content Controlled Pilot can make plans richer, but it does not remove the
medical and weight-management guardrails.
