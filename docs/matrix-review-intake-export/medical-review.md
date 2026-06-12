# Matrix Review Intake Export: medical

This audience packet is metadata-only and waits for real-world reviewer action.

Summary:
- audience=medical
- itemCount=11
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

## review_export_medical_review_intake_source_lookup_ncaa_wrestling_weight_management_program_intake

Audience: medical
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

## review_export_medical_review_intake_source_lookup_acsm_exercise_fluid_replacement_intake

Audience: medical
Intake: review_intake_source_lookup_acsm_exercise_fluid_replacement_intake
Title: Source text acquisition intake for source_lookup_acsm_exercise_fluid_replacement_intake
Status: source_text_needed
runtimeChangeAllowedNow=false
humanReviewed=false

Blocker summary:
Evidence claim blocker source_lookup_acsm_exercise_fluid_replacement_intake remains blocked for reason needs_full_text_or_policy_text. Affected areas: hydration. This intake asks reviewers what artifacts are needed before a future extraction pass.

Reviewer questions:
- Should this remain blocked, review-export-only, or become eligible for a future extraction pass?
- Is medical review required before any weight-cut or hydration claim is extracted?
- Does the source population match wrestling, combat-sport transfer, youth, female, or general athlete context?
- Is this source authoritative enough to support a future evidence claim?
- Does the source contain direct support, indirect support, or only background context?

Required artifacts:
- source text or official policy text
- relevant passage locator
- claim extraction note
- limitations/applicability note

Allowed outcomes:
- source_verified_for_future_extraction
- keep_blocked
- replacement_source_needed

Prohibited actions:
- no abstract-only claim if full/policy text is needed
- no numerical threshold extraction without review
- no runtime promotion

Next action:
Acquire source text or official policy text, record passage location, and route the item to the listed reviewer tracks.

Linked ids:
- blockers: source_lookup_acsm_exercise_fluid_replacement_intake
- source lookup intake: acsm_exercise_fluid_replacement_intake
- source candidates: hydration_heat_exposure_policy_source_need
- source expansion backlog: hydration_sauna_heat_exposure_sources
- evidence dependencies: acsm_hydration_nutrition, grappling_grip_dehydration_transfer, ncaa_weight_management
- data dependencies: hydration_status_for_weigh_in
- threshold candidates: hydration_status_review_trigger_candidate, sauna_heat_exposure_review_candidate
- review decisions: data_hydration_status_for_weigh_in, evidence_acsm_hydration_nutrition, evidence_grappling_grip_dehydration_transfer, evidence_ncaa_weight_management, threshold_hydration_status_review_trigger_candidate, threshold_sauna_heat_exposure_review_candidate

## review_export_medical_review_intake_source_lookup_acsm_nutrition_athletic_performance_intake

Audience: medical
Intake: review_intake_source_lookup_acsm_nutrition_athletic_performance_intake
Title: Source text acquisition intake for source_lookup_acsm_nutrition_athletic_performance_intake
Status: source_text_needed
runtimeChangeAllowedNow=false
humanReviewed=false

Blocker summary:
Evidence claim blocker source_lookup_acsm_nutrition_athletic_performance_intake remains blocked for reason needs_full_text_or_policy_text. Affected areas: female_context, readiness, weight_cut. This intake asks reviewers what artifacts are needed before a future extraction pass.

Reviewer questions:
- What data fields are required before this can affect future risk-confidence wording?
- Should this remain do_not_automate for future constructor behavior?
- Should this remain blocked, review-export-only, or become eligible for a future extraction pass?
- Is medical review required before any weight-cut or hydration claim is extracted?
- Does the source population match wrestling, combat-sport transfer, youth, female, or general athlete context?
- Is this source authoritative enough to support a future evidence claim?
- Does the source contain direct support, indirect support, or only background context?

Required artifacts:
- source text or official policy text
- relevant passage locator
- claim extraction note
- limitations/applicability note

Allowed outcomes:
- source_verified_for_future_extraction
- keep_blocked
- replacement_source_needed

Prohibited actions:
- no abstract-only claim if full/policy text is needed
- no numerical threshold extraction without review
- no runtime promotion

Next action:
Acquire source text or official policy text, record passage location, and route the item to the listed reviewer tracks.

Linked ids:
- blockers: source_lookup_acsm_nutrition_athletic_performance_intake
- source lookup intake: acsm_nutrition_athletic_performance_intake
- source candidates: female_context_review_source_need
- source expansion backlog: female_context_symptom_aware_readiness_sources, reds_low_energy_availability_sources
- evidence dependencies: acsm_hydration_nutrition, perform_evidence_matrix, recovery_monitoring_consensus
- data dependencies: female_context_for_reds_or_cycle_sensitive_decisions
- threshold candidates: female_symptom_context_candidate, reds_risk_review_candidate
- review decisions: data_female_context_for_reds_or_cycle_sensitive_decisions, evidence_acsm_hydration_nutrition, evidence_perform_evidence_matrix, evidence_recovery_monitoring_consensus, threshold_female_symptom_context_candidate, threshold_reds_risk_review_candidate

## review_export_medical_review_intake_source_lookup_combat_sports_rapid_weight_loss_meta_analysis_intake

Audience: medical
Intake: review_intake_source_lookup_combat_sports_rapid_weight_loss_meta_analysis_intake
Title: Source text acquisition intake for source_lookup_combat_sports_rapid_weight_loss_meta_analysis_intake
Status: source_text_needed
runtimeChangeAllowedNow=false
humanReviewed=false

Blocker summary:
Evidence claim blocker source_lookup_combat_sports_rapid_weight_loss_meta_analysis_intake remains blocked for reason needs_full_text_or_policy_text. Affected areas: hydration, weight_cut. This intake asks reviewers what artifacts are needed before a future extraction pass.

Reviewer questions:
- Should this remain blocked, review-export-only, or become eligible for a future extraction pass?
- Is medical review required before any weight-cut or hydration claim is extracted?
- Does the source population match wrestling, combat-sport transfer, youth, female, or general athlete context?
- Is this source authoritative enough to support a future evidence claim?
- Does the source contain direct support, indirect support, or only background context?

Required artifacts:
- source text or official policy text
- relevant passage locator
- claim extraction note
- limitations/applicability note

Allowed outcomes:
- source_verified_for_future_extraction
- keep_blocked
- replacement_source_needed

Prohibited actions:
- no abstract-only claim if full/policy text is needed
- no numerical threshold extraction without review
- no runtime promotion

Next action:
Acquire source text or official policy text, record passage location, and route the item to the listed reviewer tracks.

Linked ids:
- blockers: source_lookup_combat_sports_rapid_weight_loss_meta_analysis_intake
- source lookup intake: combat_sports_rapid_weight_loss_meta_analysis_intake
- source candidates: weight_cut_hydration_consensus_source_need
- source expansion backlog: hydration_sauna_heat_exposure_sources, weight_cut_quantitative_safety_sources
- evidence dependencies: acsm_hydration_nutrition, japan_rapid_weight_loss_wrestlers, ncaa_weight_management, sichuan_weight_reduction_wrestlers
- data dependencies: body_mass_trend_for_weight_cut, hydration_status_for_weigh_in
- threshold candidates: acute_body_mass_loss_candidate, hydration_status_review_trigger_candidate, sauna_heat_exposure_review_candidate, weight_descent_rate_candidate
- review decisions: data_body_mass_trend_for_weight_cut, data_hydration_status_for_weigh_in, evidence_acsm_hydration_nutrition, evidence_japan_rapid_weight_loss_wrestlers, evidence_ncaa_weight_management, evidence_sichuan_weight_reduction_wrestlers, threshold_acute_body_mass_loss_candidate, threshold_hydration_status_review_trigger_candidate, threshold_sauna_heat_exposure_review_candidate, threshold_weight_descent_rate_candidate

## review_export_medical_review_intake_source_lookup_recovery_performance_consensus_intake

Audience: medical
Intake: review_intake_source_lookup_recovery_performance_consensus_intake
Title: Source text acquisition intake for source_lookup_recovery_performance_consensus_intake
Status: source_text_needed
runtimeChangeAllowedNow=false
humanReviewed=false

Blocker summary:
Evidence claim blocker source_lookup_recovery_performance_consensus_intake remains blocked for reason needs_full_text_or_policy_text. Affected areas: female_context, hrv, readiness, rhr, sleep, wearable_data, weight_cut. This intake asks reviewers what artifacts are needed before a future extraction pass.

Reviewer questions:
- What data fields are required before this can affect future risk-confidence wording?
- Should this remain do_not_automate for future constructor behavior?
- Should this remain blocked, review-export-only, or become eligible for a future extraction pass?
- Is medical review required before any weight-cut or hydration claim is extracted?
- Does the source population match wrestling, combat-sport transfer, youth, female, or general athlete context?
- Is this source authoritative enough to support a future evidence claim?
- Does the source contain direct support, indirect support, or only background context?

Required artifacts:
- source text or official policy text
- relevant passage locator
- claim extraction note
- limitations/applicability note

Allowed outcomes:
- source_verified_for_future_extraction
- keep_blocked
- replacement_source_needed

Prohibited actions:
- no abstract-only claim if full/policy text is needed
- no numerical threshold extraction without review
- no runtime promotion

Next action:
Acquire source text or official policy text, record passage location, and route the item to the listed reviewer tracks.

Linked ids:
- blockers: source_lookup_recovery_performance_consensus_intake
- source lookup intake: recovery_performance_consensus_intake
- source candidates: readiness_multi_signal_monitoring_source_need
- source expansion backlog: reds_low_energy_availability_sources, rhr_hrv_sleep_readiness_composite_sources, wearable_data_quality_and_readiness_sources
- evidence dependencies: perform_evidence_matrix, recovery_monitoring_consensus, wearable_validity_trend
- data dependencies: hrv_trend_for_recovery_confidence, readiness_context_for_load_confidence, resting_hr_trend_for_recovery_confidence, sleep_readiness_for_load_confidence, wearable_data_quality_for_readiness
- threshold candidates: hrv_trend_candidate, multi_signal_readiness_candidate, rhr_deviation_candidate, sleep_low_confidence_candidate, wearable_data_quality_candidate
- review decisions: data_hrv_trend_for_recovery_confidence, data_readiness_context_for_load_confidence, data_resting_hr_trend_for_recovery_confidence, data_sleep_readiness_for_load_confidence, data_wearable_data_quality_for_readiness, evidence_perform_evidence_matrix, evidence_recovery_monitoring_consensus, evidence_wearable_validity_trend, threshold_hrv_trend_candidate, threshold_multi_signal_readiness_candidate, threshold_rhr_deviation_candidate, threshold_sleep_low_confidence_candidate, threshold_wearable_data_quality_candidate

## review_export_medical_review_intake_source_lookup_ioc_reds_consensus_statement_intake

Audience: medical
Intake: review_intake_source_lookup_ioc_reds_consensus_statement_intake
Title: Source text acquisition intake for source_lookup_ioc_reds_consensus_statement_intake
Status: source_text_needed
runtimeChangeAllowedNow=false
humanReviewed=false

Blocker summary:
Evidence claim blocker source_lookup_ioc_reds_consensus_statement_intake remains blocked for reason needs_full_text_or_policy_text. Affected areas: female_context, readiness, weight_cut. This intake asks reviewers what artifacts are needed before a future extraction pass.

Reviewer questions:
- What data fields are required before this can affect future risk-confidence wording?
- Should this remain do_not_automate for future constructor behavior?
- Should this remain blocked, review-export-only, or become eligible for a future extraction pass?
- Is medical review required before any weight-cut or hydration claim is extracted?
- Does the source population match wrestling, combat-sport transfer, youth, female, or general athlete context?
- Is this source authoritative enough to support a future evidence claim?
- Does the source contain direct support, indirect support, or only background context?

Required artifacts:
- source text or official policy text
- relevant passage locator
- claim extraction note
- limitations/applicability note

Allowed outcomes:
- source_verified_for_future_extraction
- keep_blocked
- replacement_source_needed

Prohibited actions:
- no abstract-only claim if full/policy text is needed
- no numerical threshold extraction without review
- no runtime promotion

Next action:
Acquire source text or official policy text, record passage location, and route the item to the listed reviewer tracks.

Linked ids:
- blockers: source_lookup_ioc_reds_consensus_statement_intake
- source lookup intake: ioc_reds_consensus_statement_intake
- source candidates: female_reds_context_source_need
- source expansion backlog: reds_low_energy_availability_sources
- evidence dependencies: acsm_hydration_nutrition, perform_evidence_matrix
- data dependencies: female_context_for_reds_or_cycle_sensitive_decisions
- threshold candidates: female_symptom_context_candidate, reds_risk_review_candidate
- review decisions: data_female_context_for_reds_or_cycle_sensitive_decisions, evidence_acsm_hydration_nutrition, evidence_perform_evidence_matrix, threshold_female_symptom_context_candidate, threshold_reds_risk_review_candidate

## review_export_medical_review_intake_source_lookup_return_to_sport_pain_review_intake

Audience: medical
Intake: review_intake_source_lookup_return_to_sport_pain_review_intake
Title: Source text acquisition intake for source_lookup_return_to_sport_pain_review_intake
Status: source_text_needed
runtimeChangeAllowedNow=false
humanReviewed=false

Blocker summary:
Evidence claim blocker source_lookup_return_to_sport_pain_review_intake remains blocked for reason needs_full_text_or_policy_text. Affected areas: injury, pain. This intake asks reviewers what artifacts are needed before a future extraction pass.

Reviewer questions:
- Should this remain do_not_automate for future constructor behavior?
- Should this remain blocked, review-export-only, or become eligible for a future extraction pass?
- Does the source population match wrestling, combat-sport transfer, youth, female, or general athlete context?
- Is this source authoritative enough to support a future evidence claim?
- Does the source contain direct support, indirect support, or only background context?

Required artifacts:
- source text or official policy text
- relevant passage locator
- claim extraction note
- limitations/applicability note

Allowed outcomes:
- source_verified_for_future_extraction
- keep_blocked
- replacement_source_needed

Prohibited actions:
- no abstract-only claim if full/policy text is needed
- no numerical threshold extraction without review
- no runtime promotion

Next action:
Acquire source text or official policy text, record passage location, and route the item to the listed reviewer tracks.

Linked ids:
- blockers: source_lookup_return_to_sport_pain_review_intake
- source lookup intake: return_to_sport_pain_review_intake
- source candidates: pain_review_intake_source_need
- source expansion backlog: injury_pain_return_to_training_sources
- evidence dependencies: nsca_youth_safe_progression, perform_evidence_matrix, recovery_monitoring_consensus
- data dependencies: pain_location_severity_for_block_eligibility
- threshold candidates: pain_severity_threshold_candidate, pain_unknown_location_candidate
- review decisions: data_pain_location_severity_for_block_eligibility, evidence_nsca_youth_safe_progression, evidence_perform_evidence_matrix, evidence_recovery_monitoring_consensus, threshold_pain_severity_threshold_candidate, threshold_pain_unknown_location_candidate

## review_export_medical_review_intake_source_lookup_return_to_sport_injury_review_intake

Audience: medical
Intake: review_intake_source_lookup_return_to_sport_injury_review_intake
Title: Source text acquisition intake for source_lookup_return_to_sport_injury_review_intake
Status: source_text_needed
runtimeChangeAllowedNow=false
humanReviewed=false

Blocker summary:
Evidence claim blocker source_lookup_return_to_sport_injury_review_intake remains blocked for reason needs_full_text_or_policy_text. Affected areas: injury, pain. This intake asks reviewers what artifacts are needed before a future extraction pass.

Reviewer questions:
- Should this remain do_not_automate for future constructor behavior?
- Should this remain blocked, review-export-only, or become eligible for a future extraction pass?
- Does the source population match wrestling, combat-sport transfer, youth, female, or general athlete context?
- Is this source authoritative enough to support a future evidence claim?
- Does the source contain direct support, indirect support, or only background context?

Required artifacts:
- source text or official policy text
- relevant passage locator
- claim extraction note
- limitations/applicability note

Allowed outcomes:
- source_verified_for_future_extraction
- keep_blocked
- replacement_source_needed

Prohibited actions:
- no abstract-only claim if full/policy text is needed
- no numerical threshold extraction without review
- no runtime promotion

Next action:
Acquire source text or official policy text, record passage location, and route the item to the listed reviewer tracks.

Linked ids:
- blockers: source_lookup_return_to_sport_injury_review_intake
- source lookup intake: return_to_sport_injury_review_intake
- source candidates: injury_return_source_need
- source expansion backlog: injury_pain_return_to_training_sources
- evidence dependencies: nsca_youth_safe_progression, perform_evidence_matrix, recovery_monitoring_consensus
- data dependencies: injury_status_for_return_to_training
- threshold candidates: injury_return_to_training_candidate
- review decisions: data_injury_status_for_return_to_training, evidence_nsca_youth_safe_progression, evidence_perform_evidence_matrix, evidence_recovery_monitoring_consensus, threshold_injury_return_to_training_candidate

## review_export_medical_review_intake_source_lookup_nsca_long_term_athletic_development_intake

Audience: medical
Intake: review_intake_source_lookup_nsca_long_term_athletic_development_intake
Title: Source text acquisition intake for source_lookup_nsca_long_term_athletic_development_intake
Status: source_text_needed
runtimeChangeAllowedNow=false
humanReviewed=false

Blocker summary:
Evidence claim blocker source_lookup_nsca_long_term_athletic_development_intake remains blocked for reason needs_full_text_or_policy_text. Affected areas: injury, pain, weight_cut, youth_context. This intake asks reviewers what artifacts are needed before a future extraction pass.

Reviewer questions:
- Should this remain do_not_automate for future constructor behavior?
- Should this remain blocked, review-export-only, or become eligible for a future extraction pass?
- Is medical review required before any weight-cut or hydration claim is extracted?
- Does the source population match wrestling, combat-sport transfer, youth, female, or general athlete context?
- Is this source authoritative enough to support a future evidence claim?
- Does the source contain direct support, indirect support, or only background context?

Required artifacts:
- source text or official policy text
- relevant passage locator
- claim extraction note
- limitations/applicability note

Allowed outcomes:
- source_verified_for_future_extraction
- keep_blocked
- replacement_source_needed

Prohibited actions:
- no abstract-only claim if full/policy text is needed
- no numerical threshold extraction without review
- no runtime promotion

Next action:
Acquire source text or official policy text, record passage location, and route the item to the listed reviewer tracks.

Linked ids:
- blockers: source_lookup_nsca_long_term_athletic_development_intake
- source lookup intake: nsca_long_term_athletic_development_intake
- source candidates: youth_high_load_and_weight_cut_source_need
- source expansion backlog: youth_high_load_and_weight_cut_sources
- evidence dependencies: china_bfr_half_squat_wrestlers, ncaa_weight_management, nsca_youth_safe_progression
- data dependencies: youth_context_for_high_load_progression
- threshold candidates: youth_high_load_progression_candidate, youth_weight_cut_block_candidate
- review decisions: data_youth_context_for_high_load_progression, evidence_china_bfr_half_squat_wrestlers, evidence_ncaa_weight_management, evidence_nsca_youth_safe_progression, threshold_youth_high_load_progression_candidate, threshold_youth_weight_cut_block_candidate

## review_export_medical_review_intake_source_lookup_bfr_position_stand_intake

Audience: medical
Intake: review_intake_source_lookup_bfr_position_stand_intake
Title: Source text acquisition intake for source_lookup_bfr_position_stand_intake
Status: source_text_needed
runtimeChangeAllowedNow=false
humanReviewed=false

Blocker summary:
Evidence claim blocker source_lookup_bfr_position_stand_intake remains blocked for reason needs_full_text_or_policy_text. Affected areas: bfr_kaatsu, lmv. This intake asks reviewers what artifacts are needed before a future extraction pass.

Reviewer questions:
- Should this remain do_not_automate for future constructor behavior?
- Should this remain blocked, review-export-only, or become eligible for a future extraction pass?
- Does the source population match wrestling, combat-sport transfer, youth, female, or general athlete context?
- Is this source authoritative enough to support a future evidence claim?
- Does the source contain direct support, indirect support, or only background context?

Required artifacts:
- source text or official policy text
- relevant passage locator
- claim extraction note
- limitations/applicability note

Allowed outcomes:
- source_verified_for_future_extraction
- keep_blocked
- replacement_source_needed

Prohibited actions:
- no abstract-only claim if full/policy text is needed
- no numerical threshold extraction without review
- no runtime promotion

Next action:
Acquire source text or official policy text, record passage location, and route the item to the listed reviewer tracks.

Linked ids:
- blockers: source_lookup_bfr_position_stand_intake
- source lookup intake: bfr_position_stand_intake
- source candidates: bfr_kaatsu_safety_screening_source_need
- source expansion backlog: bfr_kaatsu_safety_and_screening_sources
- evidence dependencies: bfr_kaatsu_local_metabolic, china_bfr_half_squat_wrestlers
- data dependencies: lmv_local_fatigue_for_legs
- threshold candidates: lmv_legs_recovery_window_candidate
- review decisions: data_lmv_local_fatigue_for_legs, evidence_bfr_kaatsu_local_metabolic, evidence_china_bfr_half_squat_wrestlers, threshold_lmv_legs_recovery_window_candidate

## review_export_medical_review_intake_source_lookup_bfr_lmv_methodology_intake

Audience: medical
Intake: review_intake_source_lookup_bfr_lmv_methodology_intake
Title: Source text acquisition intake for source_lookup_bfr_lmv_methodology_intake
Status: source_text_needed
runtimeChangeAllowedNow=false
humanReviewed=false

Blocker summary:
Evidence claim blocker source_lookup_bfr_lmv_methodology_intake remains blocked for reason needs_full_text_or_policy_text. Affected areas: bfr_kaatsu, block_eligibility, lmv, taper. This intake asks reviewers what artifacts are needed before a future extraction pass.

Reviewer questions:
- Should this remain do_not_automate for future constructor behavior?
- Should this remain blocked, review-export-only, or become eligible for a future extraction pass?
- Does the source population match wrestling, combat-sport transfer, youth, female, or general athlete context?
- Is this source authoritative enough to support a future evidence claim?
- Does the source contain direct support, indirect support, or only background context?

Required artifacts:
- source text or official policy text
- relevant passage locator
- claim extraction note
- limitations/applicability note

Allowed outcomes:
- source_verified_for_future_extraction
- keep_blocked
- replacement_source_needed

Prohibited actions:
- no abstract-only claim if full/policy text is needed
- no numerical threshold extraction without review
- no runtime promotion

Next action:
Acquire source text or official policy text, record passage location, and route the item to the listed reviewer tracks.

Linked ids:
- blockers: source_lookup_bfr_lmv_methodology_intake
- source lookup intake: bfr_lmv_methodology_intake
- source candidates: lmv_statodynamics_source_need
- source expansion backlog: bfr_kaatsu_safety_and_screening_sources, lmv_legs_recovery_and_start_proximity_sources
- evidence dependencies: bfr_kaatsu_local_metabolic, china_bfr_half_squat_wrestlers, europe_pre_competition_plan, perform_evidence_matrix
- data dependencies: lmv_local_fatigue_for_legs, taper_load_context_for_hidden_fatigue
- threshold candidates: lmv_legs_recovery_window_candidate, lmv_near_main_start_role_candidate
- review decisions: data_lmv_local_fatigue_for_legs, data_taper_load_context_for_hidden_fatigue, evidence_bfr_kaatsu_local_metabolic, evidence_china_bfr_half_squat_wrestlers, evidence_europe_pre_competition_plan, evidence_perform_evidence_matrix, threshold_lmv_legs_recovery_window_candidate, threshold_lmv_near_main_start_role_candidate
