# Matrix Controlled Pilot Quality Review

Stage: Matrix Controlled Pilot Launch + Quality Feedback + Family Evidence Continuation.

Validation date: 2026-06-14.

## Scope

This review summarizes quality signals from existing Matrix controlled-pilot
fixtures and the pilot quality log helper. It is not a real coach feedback pass
and must not be treated as human approval.

## What Looks Ready For Controlled Pilot

- D90, D28, D21, D10 and D4 scenarios generate structured plans with concrete
  exercises.
- Plans include week, day, session and block structure.
- Plans carry exercise counts that scale with scenario length.
- Matrix output keeps review-required language in high-risk contexts.
- Template payloads remain compatible and do not persist Matrix governance
  internals.
- Feature flags remain off by default.
- Production draft route remains legacy-backed.

## Current Quality Log Snapshot

`npm run check:constructor-matrix-pilot-quality-log` currently reports:

- 10 controlled-pilot quality log entries;
- 5 allowed Matrix primary pilot scenarios;
- 4 fallback scenarios;
- 1 review-required Matrix internal scenario;
- 963 total exercise references across the quality-log sample;
- 157 coach-editable load entries;
- 25 blocked high-risk markers;
- no PII;
- no production athlete id;
- no runtime behavior change.

`npm run check:constructor-matrix-real-scenario-pilot` currently reports:

- D90: 7 days, 11 sessions, 32 blocks, 94 exercises;
- D28: 28 days, 37 sessions, 110 blocks, 320 exercises;
- D21: 21 days, 27 sessions, 81 blocks, 233 exercises;
- D10: 10 days, 12 sessions, 35 blocks, 97 exercises;
- D4: 4 days, 4 sessions, 15 blocks, 41 exercises;
- D-3, travel, weigh-in and competition day stay legacy fallback;
- D28, D21, D10 and D4 now report zero body-composition exercise candidates in
  close-start pilot output;
- the long-horizon body-composition review-required internal scenario keeps
  body-composition candidates available as coach-editable review-required
  content;
- body-composition, pain, youth and female/RED-S-sensitive contexts stay
  review-required Matrix internal scenarios.

The local authenticated UI pass generated a D21 Matrix draft, saved it as a
template and assigned 21 training days to the demo athlete in a temporary local
database.

## Quality Questions For Real Coach Review

The next pilot pass should judge plan quality, not only code correctness:

- Are selected exercises specific enough for wrestling phase and start
  proximity?
- Are technical, strength, speed, endurance and recovery blocks balanced?
- Is session density appropriate for the phase?
- Are D28 and D21 plans too broad or too dense for the intended athlete?
- Are D10 and D4 plans conservative enough near start?
- Are missing equipment fallbacks practical?
- Are RPE and duration notes clear enough for a coach to edit quickly?
- Are evidence refs readable, or too technical for the coach surface?
- Are review-required notes visible without cluttering the plan?
- Do nutrition and weight-management prompts stay educational rather than
  prescriptive?

## Current Risk Observations

The current fixture checks pass, but several areas should be watched during
pilot:

- D28 and D21 plans generate many exercises, so coach readability and session
  density need human review.
- Strength-weight candidates are conservative; when no max or e1RM exists, the
  system falls back to RPE, duration or technical-quality prescriptions.
- Body-composition and weight-management guidance remains review-required and
  may feel too generic until real source-text and coach review refine it.
- D-3, travel, weigh-in and competition-day outputs correctly avoid Matrix
  primary save/assign, but coach communication around why they are fallback
  should be checked.
- Evidence-family refs exist, but the UI needs a staging UX pass to confirm
  they are understandable to coaches.
- In the local D21 coach UI pass, exercise rows were functionally rich but
  verbose. A coach can see prescriptions, review-required wording, safety notes,
  regressions and progressions, but this density may slow review.
- Body-composition candidate exercise names appeared in light technical blocks
  during the first local D21 UI pass. This has now been hardened in the
  resolver: close-start, active weight-cut and `mat_light_technical` contexts
  suppress body-composition exercise candidates, while long-horizon explicit
  body-composition review-required content remains available.
- A later coach-facing check found a different resolver issue: two athletes
  with different profile needs could still receive the same first exercise
  sequence when the same phase and block type were selected. This is now
  hardened by athlete-profile scoring from strengths, weaknesses, goals and
  coach context.

## Pilot Quality Log Use

Use `buildConstructorMatrixPilotQualityLogEntry` to record for each pilot
scenario:

- scenario id;
- generated plan source;
- allowed, fallback, blocked or review-required status;
- exercise count;
- review-required count;
- blocked high-risk count;
- coach-editable load count;
- missing-data warning count;
- evidence family coverage;
- save/assign gate status;
- quality notes.

No production athlete id or PII should be stored in quality logs.

## Suggested Review Rubric

For each real pilot plan, record:

- plan readability: pass, needs edit, fail;
- wrestling specificity: pass, needs more specificity, too generic;
- load clarity: pass, needs coach clarification, unclear;
- phase fit: pass, too aggressive, too conservative, wrong emphasis;
- equipment fit: pass, missing equipment issue, substitution needed;
- high-risk handling: pass, warning too weak, warning too strong, unsafe;
- coach edit burden: low, medium, high;
- final decision: keep, adjust resolver, adjust load prescription, block
  scenario, source-review needed.

## Athlete-Specific Variation Guard

The check `npm run check:constructor-matrix-athlete-specific-exercise-variation`
uses the same D21 controlled-pilot scenario with two synthetic profiles:

- speed and leg-entry development need;
- grip endurance and par-terre pressure need.

The check fails if their exercise sequences become identical again. It also
confirms that pain/injury context remains a caution/review-required signal, not
medical approval or return-to-training clearance.

## Guardrails Confirmed

- This review does not approve Matrix for production default.
- This review does not approve medical, hydration, RED-S, injury, youth or
  BFR/KAATSU automation.
- This review does not add numeric medical, weight-cut or hydration runtime
  gates.
- This review does not add fake citations or fake human approvals.
