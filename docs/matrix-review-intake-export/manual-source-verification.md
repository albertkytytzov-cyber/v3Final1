# Matrix Review Intake Export: manual_source_verification

This audience packet is metadata-only and waits for real-world reviewer action.

Summary:
- audience=manual_source_verification
- itemCount=2
- runtimeChangeAllowedNow=false
- humanReviewed=false

Guardrails:
- Metadata-only export for human reviewers
- This export does not approve claims
- No evidence claims are extracted by this export
- No source readiness state is changed by this export
- No numeric threshold approved
- Not a runtime threshold
- No runtime promotion
- Production route remains unchanged
- Rollout gates remain unchanged
- Preview behavior remains unchanged
- Legacy fallback remains unchanged
- Matrix default remains disabled
- No private athlete data is included

## review_export_manual_source_verification_review_intake_source_lookup_ncaa_wrestling_weight_management_program_intake

Audience: manual_source_verification
Intake: review_intake_source_lookup_ncaa_wrestling_weight_management_program_intake
Title: Manual source verification intake for source_lookup_ncaa_wrestling_weight_management_program_intake
Status: manual_verification_needed
runtimeChangeAllowedNow=false
humanReviewed=false

Blocker summary:
Evidence claim blocker source_lookup_ncaa_wrestling_weight_management_program_intake remains blocked for reason manual_verification_required. Affected areas: hydration, weight_cut. This intake asks reviewers what artifacts are needed before a future extraction pass.

Reviewer questions:
- Should this remain blocked, review-export-only, or become eligible for a future extraction pass?
- Is medical review required before any weight-cut or hydration claim is extracted?
- Does the source population match wrestling, combat-sport transfer, youth, female, or general athlete context?
- Is this source authoritative enough to support a future evidence claim?
- Does the source contain direct support, indirect support, or only background context?

Required artifacts:
- exact source identity
- official document or authoritative record
- citation metadata verification
- scope/population applicability note

Allowed outcomes:
- source_verified_for_future_extraction
- source_rejected
- replacement_source_needed
- keep_blocked

Prohibited actions:
- no claim extraction before manual verification
- no runtime promotion
- no fake citation completion

Next action:
Collect authoritative source records and route them to manual source verification before any future extraction pass.

Linked ids:
- blockers: source_lookup_ncaa_wrestling_weight_management_program_intake
- source lookup intake: ncaa_wrestling_weight_management_program_intake
- source candidates: weight_cut_hydration_consensus_source_need
- source expansion backlog: hydration_sauna_heat_exposure_sources, weight_cut_quantitative_safety_sources
- evidence dependencies: acsm_hydration_nutrition, japan_rapid_weight_loss_wrestlers, ncaa_weight_management, sichuan_weight_reduction_wrestlers
- data dependencies: body_mass_trend_for_weight_cut, hydration_status_for_weigh_in
- threshold candidates: acute_body_mass_loss_candidate, hydration_status_review_trigger_candidate, sauna_heat_exposure_review_candidate, weight_descent_rate_candidate
- review decisions: data_body_mass_trend_for_weight_cut, data_hydration_status_for_weigh_in, evidence_acsm_hydration_nutrition, evidence_japan_rapid_weight_loss_wrestlers, evidence_ncaa_weight_management, evidence_sichuan_weight_reduction_wrestlers, threshold_acute_body_mass_loss_candidate, threshold_hydration_status_review_trigger_candidate, threshold_sauna_heat_exposure_review_candidate, threshold_weight_descent_rate_candidate

## review_export_manual_source_verification_review_intake_source_lookup_uww_international_wrestling_rules_intake

Audience: manual_source_verification
Intake: review_intake_source_lookup_uww_international_wrestling_rules_intake
Title: Manual source verification intake for source_lookup_uww_international_wrestling_rules_intake
Status: manual_verification_needed
runtimeChangeAllowedNow=false
humanReviewed=false

Blocker summary:
Evidence claim blocker source_lookup_uww_international_wrestling_rules_intake remains blocked for reason manual_verification_required. Affected areas: competition_context. This intake asks reviewers what artifacts are needed before a future extraction pass.

Reviewer questions:
- Should this remain blocked, review-export-only, or become eligible for a future extraction pass?
- Does the source population match wrestling, combat-sport transfer, youth, female, or general athlete context?
- Is this source authoritative enough to support a future evidence claim?
- Does the source contain direct support, indirect support, or only background context?

Required artifacts:
- exact source identity
- official document or authoritative record
- citation metadata verification
- scope/population applicability note

Allowed outcomes:
- source_verified_for_future_extraction
- source_rejected
- replacement_source_needed
- keep_blocked

Prohibited actions:
- no claim extraction before manual verification
- no runtime promotion
- no fake citation completion

Next action:
Collect authoritative source records and route them to manual source verification before any future extraction pass.

Linked ids:
- blockers: source_lookup_uww_international_wrestling_rules_intake
- source lookup intake: uww_international_wrestling_rules_intake
- source candidates: competition_model_source_need
- source expansion backlog: competition_event_model_and_uww_rules_sources
- evidence dependencies: constructor_core_stack, matrix_transition_plan, wrestling_temporal_structure
- data dependencies: competition_day_context_for_no_training_development
- threshold candidates: competition_day_no_development_candidate
- review decisions: data_competition_day_context_for_no_training_development, evidence_constructor_core_stack, evidence_matrix_transition_plan, evidence_wrestling_temporal_structure, threshold_competition_day_no_development_candidate
