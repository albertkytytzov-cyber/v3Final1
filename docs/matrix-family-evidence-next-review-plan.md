# Matrix Family Evidence Next Review Plan

Stage: Matrix Controlled Pilot Launch + Quality Feedback + Family Evidence Continuation.

Validation date: 2026-06-14.

## Objective

The next evidence stage should continue at the family level, not exercise by
exercise. The current Matrix library is large enough that reviewing each
exercise separately would be slow and inconsistent. Family-level review keeps
the system auditable while preserving safety boundaries.

## Review Order

### P0 Families

Review first:

- `body_composition_training`;
- `muscle_preservation_training`;
- `nutrition_body_composition_guidance`;
- `weight_management_review_prompt`;
- `weigh_in_review_required_guidance`;
- `high_risk_blocked_weight_cut_hydration`;
- `bfr_kaatsu_blocked_screening_context`.

P0 review must not turn high-risk areas into automated recommendations.

### P1 Families

Review second:

- `seluyanov_statodynamic_lme`;
- `speed_endurance_wrestling_density`;
- `max_strength`;
- `strength_endurance`;
- `taper_activation`;
- `aerobic_base_low_impact`;
- `competition_model_and_controlled_bouts`.

P1 training families may support coach-editable controlled-pilot content when
source review supports general training use. They must not approve hard
protocols, medical gates or hidden threshold logic.

## Source Review Requirements

Use only real, verifiable sources:

- official federation or regulation documents;
- peer-reviewed papers;
- systematic reviews;
- meta-analyses;
- consensus statements;
- position stands;
- recognized strength and conditioning guidelines;
- recognized sports nutrition guidelines;
- wrestling or combat-sport specific studies where available.

Do not invent authors, years, DOI, PMID, passages, effect sizes or protocols.

## Allowed Outcomes

For safe training families, evidence review may support:

- docs-only use;
- review-export use;
- warning-candidate use;
- coach-editable controlled-pilot training content.

For high-risk families, evidence review may support:

- clearer review-required guidance;
- clearer blocked-state language;
- better source acquisition requirements;
- safer coach-facing warnings.

## Forbidden Outcomes

Evidence review must not approve:

- Matrix production default;
- rapid weight-cut automation;
- dehydration or weigh-in manipulation;
- RED-S diagnosis;
- injury-return or pain clearance;
- youth high-load or youth weight-cut automation;
- BFR/KAATSU prescription;
- numeric medical, weight-cut or hydration runtime gates;
- fake human, medical or coach approval.

## Required Artifacts For Next Stage

The next implementation stage should produce:

- family-level source acquisition log;
- source-text availability status;
- family evidence dossier updates;
- allowed-use updates only where justified;
- high-risk blocked/review-required confirmation;
- reviewer intake packets for anything needing real coach, medical, data-quality
  or sport-science review.

## Production Boundary

Matrix remains controlled-pilot only. Legacy constructor remains default.
Production `/api/v1/plans/constructor/draft` remains unchanged.

## Decision After Evidence Stage

After P0 and P1 review:

- safe training families can remain or become coach-editable controlled-pilot
  content;
- uncertain families should remain docs-only, review-export-only or warning-only;
- high-risk medical, weight-cut, hydration, BFR/KAATSU, RED-S, pain, injury and
  youth decisions remain blocked or review-required.
