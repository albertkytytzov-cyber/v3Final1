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

## Guardrails Confirmed

- This review does not approve Matrix for production default.
- This review does not approve medical, hydration, RED-S, injury, youth or
  BFR/KAATSU automation.
- This review does not add numeric medical, weight-cut or hydration runtime
  gates.
- This review does not add fake citations or fake human approvals.
