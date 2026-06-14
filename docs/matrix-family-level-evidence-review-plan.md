# Matrix Family-Level Evidence Review Plan

Stage: Matrix Family-Level Evidence Review + Coach UI + Controlled Pilot Readiness.

This plan reviews Matrix content at evidence-family level instead of reviewing
each exercise one by one. The goal is to keep the expanded exercise, nutrition
and weight-management library auditable while avoiding fake approvals and unsafe
runtime promotion.

## Review Model

Family-level review groups similar exercises and guidance by training intent,
source requirement and safety boundary. This lets reviewers inspect transfer
questions once per family, then keep individual exercises coach-editable inside
that boundary.

AI desk review is not human review. All records keep `humanReviewed=false`.
No medical, coach or data-quality approval is recorded by this stage.

## All Evidence Families

- `seluyanov_statodynamic_lme`
- `speed_first_action`
- `acceleration_change_of_direction`
- `speed_endurance_wrestling_density`
- `max_strength`
- `strength_endurance`
- `posterior_chain_strength`
- `trunk_anti_rotation`
- `grip_hand_fighting_strength_endurance`
- `aerobic_base_low_impact`
- `wrestling_technical_transfer`
- `par_terre_technical_transfer`
- `competition_model_and_controlled_bouts`
- `taper_activation`
- `recovery_mobility_downregulation`
- `travel_mobility_reset`
- `post_competition_recovery`
- `body_composition_training`
- `muscle_preservation_training`
- `low_impact_conditioning_for_body_composition`
- `nutrition_body_composition_guidance`
- `nutrition_training_day_guidance`
- `weight_management_review_prompt`
- `weigh_in_review_required_guidance`
- `high_risk_blocked_weight_cut_hydration`
- `bfr_kaatsu_blocked_screening_context`

## P0 First

P0 review covers body composition, muscle preservation, nutrition and
high-risk weight-management boundaries:

- `body_composition_training`
- `muscle_preservation_training`
- `nutrition_body_composition_guidance`
- `weight_management_review_prompt`
- `weigh_in_review_required_guidance`
- `high_risk_blocked_weight_cut_hydration`
- `bfr_kaatsu_blocked_screening_context`

Allowed after AI desk review:

- body-composition and muscle-preservation training may remain
  coach-editable training candidates;
- nutrition/body-composition remains education/review-export only;
- weight management, weigh-in, hydration/weight-cut and BFR/KAATSU remain
  blocked or review-required.

## P1 Second

P1 review covers safe training families that can be used in controlled pilot
only as editable plan content:

- `seluyanov_statodynamic_lme`
- `speed_endurance_wrestling_density`
- `max_strength`
- `strength_endurance`
- `competition_model_and_controlled_bouts`
- `taper_activation`
- `aerobic_base_low_impact`

Allowed after AI desk review:

- coach-editable training candidates;
- coach-editable plan content inside controlled pilot;
- no hard runtime gates;
- no locked loads;
- no medical thresholds.

## Blocked Boundaries

Matrix must not automate:

- rapid weight cut;
- dehydration, sauna, sweat-suit, diuretic, laxative, spitting or water
  restriction methods;
- RED-S, injury-return, pain, youth or female-context decisions;
- BFR/KAATSU prescription;
- numeric medical, weight-cut or hydration thresholds;
- production default promotion.

## Acceptance Criteria

A family may move beyond docs/review export only when:

- source identity is verified;
- source text or abstract is available for claim extraction;
- population and wrestling-transfer limits are explicit;
- coach, sport-science, medical or data-quality review is recorded where
  required;
- runtime use remains separately gated;
- no fake human approval is introduced.

Next stage after this plan is either real human review or limited pilot
monitoring. Matrix remains controlled-pilot only.
