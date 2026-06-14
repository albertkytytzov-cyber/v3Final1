# Matrix Family Source Verification Notes

Stage: Matrix Controlled Pilot Launch + Quality Feedback + Family Evidence Continuation.

Verification date: 2026-06-14.

## Scope

This note records a focused source-verification pass for the current
family-level Matrix evidence plan. It does not create final evidence claims,
does not record human review and does not allow runtime promotion.

The pass focused on P0 high-risk and body-composition families because those are
the first review priority:

- `body_composition_training`;
- `muscle_preservation_training`;
- `nutrition_body_composition_guidance`;
- `weight_management_review_prompt`;
- `weigh_in_review_required_guidance`;
- `high_risk_blocked_weight_cut_hydration`;
- `bfr_kaatsu_blocked_screening_context`.

## Verified Public Source Anchors

The following source anchors were checked through public pages, official
documents, publication repositories or open full-text mirrors:

| Area | Source anchor | Verification result | Matrix decision |
| --- | --- | --- | --- |
| Body composition | Mathisen et al., 2023, BJSM body-composition recommendations, DOI `10.1136/bjsports-2023-106812` | Public repository metadata confirms title, journal, year, DOI and IOC REDs subgroup context. | Supports coach-editable long-horizon training context only; no body-mass or calorie prescription. |
| Nutrition / performance | Academy of Nutrition and Dietetics, Dietitians of Canada and ACSM nutrition position statement, PMID `26891166` | PubMed/search metadata and public PDF mirrors confirm identity. | Educational/review-export only until source-text and qualified review are complete. |
| RED-S | 2023 IOC REDs consensus statement, PMID `37752011` | PubMed/search metadata and BJSM/PDF mirrors confirm identity. | Medical/review-required; no diagnosis automation. |
| NCAA wrestling weight management | 2025-26 NCAA Men's Wrestling Weight Management Program Packet | NCAA page and official PDF confirm the current packet and weight-management program context. | Review-required guidance only; no automatic weight-cut, hydration or weigh-in manipulation. |
| Hydration/fluid replacement | ACSM Exercise and Fluid Replacement position stand, PMID `17277604` | PubMed/search metadata confirms identity. | Review-required context only; no hydration diagnosis or runtime threshold gate. |
| Rapid weight loss in combat sports | Systematic review/open full-text rapid weight-loss sources | Public open full-text sources confirm rapid weight-loss evidence is complex and safety-sensitive. | Keeps rapid weight cut blocked/non-automated. |
| BFR/KAATSU | Blood Flow Restriction Exercise position stand, PMID `31156448` | PubMed/search metadata and PMC full text confirm identity. | Keeps BFR/KAATSU prescription blocked/review-required. |

## Important Boundary

Some source anchors contain sport-policy or medical numeric values. These values
must not be copied into Matrix runtime gates in this stage. They remain source
text for future qualified review only.

## Current Evidence Decision

The source pass supports the current conservative Matrix stance:

- safe training families can remain coach-editable controlled-pilot content;
- nutrition and body-composition guidance remains educational and
  review-required;
- weight management, weigh-in, hydration, RED-S and BFR/KAATSU remain blocked or
  review-required;
- no final human review is recorded;
- no runtime promotion is allowed now.

## Next Source-Text Actions

Next source work should:

- acquire and archive source-text locators for P0 sources;
- separate policy-specific values from runtime decision logic;
- create reviewer packets for coach, medical, sport-science and data-quality
  review;
- update allowed-use metadata only after source-text and review artifacts exist.

## Guardrails Confirmed

- No fake citation was added.
- No fake source passage was added.
- No human review was recorded.
- No medical or coach approval was recorded.
- No numeric medical, hydration or weight-management runtime threshold was
  added.
- Matrix remains controlled-pilot only.
