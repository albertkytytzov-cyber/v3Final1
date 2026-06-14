# Matrix Controlled Pilot Scenario Results

Stage: Matrix Controlled Pilot Launch + Quality Feedback + Family Evidence Continuation.

Validation date: 2026-06-14.

## Scope

This document records the controlled pilot scenario status from the Matrix
scenario checkers. These are synthetic repository fixtures, not production
athlete results and not human coach approvals.

## Allowed Controlled Pilot Scenarios

The following scenarios are allowed for Matrix primary controlled pilot output
behind feature flags and server gates:

| Scenario | Source | Days | Sessions | Blocks | Exercises |
| --- | --- | ---: | ---: | ---: | ---: |
| `far_development_week_d90` | Matrix | 7 | 11 | 32 | 94 |
| `main_start_d28_special_pre_competition` | Matrix | 28 | 37 | 110 | 320 |
| `main_start_d21_controlled_volume` | Matrix | 21 | 27 | 81 | 233 |
| `main_start_d10_taper` | Matrix | 10 | 12 | 35 | 97 |
| `main_start_d4_start_window` | Matrix | 4 | 4 | 15 | 41 |

All allowed scenarios:

- generate concrete exercises;
- keep review-required language where needed;
- avoid unsafe weight-cut text;
- avoid fake approval text;
- keep template payloads free of Matrix internals.

## Fallback Or Blocked Scenarios

The following scenarios remain fallback or blocked for Matrix primary output:

| Scenario | Active source | Days | Sessions | Blocks | Exercises |
| --- | --- | ---: | ---: | ---: | ---: |
| `main_start_d3_final_activation` | Legacy fallback | 3 | 3 | 14 | 35 |
| `travel_day` | Legacy fallback | 2 | 2 | 9 | 23 |
| `weigh_in_day` | Legacy fallback | 1 | 1 | 5 | 13 |
| `competition_day` | Legacy fallback | 1 | 1 | 5 | 13 |

These scenarios must not become Matrix primary save/assign paths without a
separate explicit stage.

## High-Risk Review-Required Scenarios

The following scenarios can be inspected as Matrix internal drafts, but remain
review-required and non-automated:

| Scenario | Source | Days | Sessions | Blocks | Exercises |
| --- | --- | ---: | ---: | ---: | ---: |
| `body_composition_long_horizon_review_required` | Matrix internal | 7 | 11 | 32 | 94 |
| `pain_blocked_review_required` | Matrix internal | 28 | 37 | 110 | 320 |
| `youth_review_required` | Matrix internal | 28 | 37 | 110 | 320 |
| `female_reds_review_required` | Matrix internal | 28 | 37 | 110 | 320 |

These scenarios must preserve review-required or blocked language and must not
automate medical, injury, RED-S, youth, hydration or weight-cut decisions.

## Save/Assign Boundary

Controlled pilot save/assign remains gated:

- legacy save remains allowed by default;
- `matrix_internal` save remains blocked;
- `matrix_primary_pilot` save requires all Matrix pilot flags and server dry-run
  success;
- D-3, travel, weigh-in and competition-day scenarios are not Matrix pilot
  save/assign paths.

## Local Dev Save/Assign Check

The D21 authenticated coach UI pass used a temporary local database and confirmed
the controlled save/assign path for the generated Matrix draft:

- Matrix draft generated for `Demo Athlete`;
- `Сохранить шаблон и перейти к назначению` was visible;
- template save succeeded;
- assignment panel opened for `PERFORM Constructor Candidate`;
- 21 training days were assigned to the demo athlete in the temporary database.

This confirms the local dev controlled-pilot save/assign path, not production
save/assign enablement.

## Current Decision

The fixture suite supports controlled pilot use for D90, D28, D21, D10 and D4.
It does not support production-default rollout. The next practical validation
must be a real dev/staging pilot pass with coach review of plan quality.

## Guardrails Confirmed

- Matrix is not production default.
- Production `/api/v1/plans/constructor/draft` remains legacy-backed.
- High-risk scenarios remain fallback, blocked or review-required.
- No unsafe weight-cut automation is present.
- No numeric medical, weight-cut or hydration runtime threshold is present.
- No fake human, medical or coach approval is present.
