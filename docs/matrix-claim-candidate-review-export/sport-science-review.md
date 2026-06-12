# Matrix Evidence Claim Candidate Review Export: sport_science

This audience packet is metadata-only and keeps every record candidate-only.
It waits for real reviewer work outside code and performs no source readiness change.

Summary:
- audience=sport_science
- itemCount=13
- runtimeChangeAllowedNow=false
- humanReviewed=false
- candidateOnly=true

Guardrails:
- Metadata-only export for future human reviewers
- Candidate-only; not a final evidence claim
- This packet records no reviewer identity or review date
- No candidate approval is recorded by this export
- No source readiness change is performed by this export
- No numeric threshold approved
- Not a runtime threshold
- No runtime promotion
- Production route remains unchanged
- Rollout gates remain unchanged
- Preview behavior remains unchanged
- Legacy fallback remains unchanged
- Matrix default remains disabled
- No private athlete data is included

## claim_candidate_review_export_sport_science_candidate_weight_cut_hydration_safety_context

Audience: sport_science
Candidate: candidate_weight_cut_hydration_safety_context
Title: Weight-cut and hydration safety context candidate
Candidate status: needs_full_text_before_extraction
Candidate type: weight_management_context
candidateOnly=true
runtimeChangeAllowedNow=false
humanReviewed=false

Candidate text:
Rapid weight-loss and hydration contexts should remain safety-first review areas before any training-load decision uses them.

Method/risk areas:
- weight_cut
- hydration

Population context:
- combat sport transfer
- wrestling transfer requires review

Supports:
- Verified source identities support a cautious review-export candidate only.
- Medical, coach and sport-science review are required before final extraction.

Limitations:
- No numeric threshold approved.
- NCAA manual-verification source is not used as evidence support for this candidate.
- This candidate does not diagnose hydration status or authorize weight cutting.

Reviewer questions:
- Should candidate_weight_cut_hydration_safety_context remain candidate-only, be rejected, or wait for another review packet?
- What source text, context, or reviewer artifact is still missing before later extraction work?
- Could this wording be misunderstood as a diagnosis, hard gate, or runtime instruction?
- Does the source scope support wrestling-specific use, combat-sport transfer, or only background context?
- Which source limitations must be resolved before any later extraction pass?

Required artifacts:
- candidate id: candidate_weight_cut_hydration_safety_context
- linked source lookup ids: combat_sports_rapid_weight_loss_meta_analysis_intake, acsm_exercise_fluid_replacement_intake
- linked desk source review ids: desk_source_review_acsm_exercise_fluid_replacement_intake, desk_source_review_combat_sports_rapid_weight_loss_meta_analysis_intake
- linked evidence dependency ids: acsm_hydration_nutrition, grappling_grip_dehydration_transfer, japan_rapid_weight_loss_wrestlers, ncaa_weight_management, sichuan_weight_reduction_wrestlers
- linked data dependency ids: body_mass_trend_for_weight_cut, hydration_status_for_weigh_in
- reviewer notes recorded outside code
- sport_science reviewer rationale
- explicit keep-blocked or future-review recommendation

Allowed outcomes:
- keep candidate blocked
- keep candidate in review export only
- request replacement or additional source material
- reject candidate as unsafe or unsupported
- recommend future extraction review after source readiness is handled separately

Prohibited actions:
- do not mark this export as human review completion
- do not record reviewer identity or review date in this export
- do not convert candidate into a final claim
- do not update source readiness in this export
- do not create a runtime rule
- do not create a runtime gate
- do not add a numeric cutoff
- do not enable Matrix default
- do not imply medical clearance
- do not imply coach signoff

Next action:
Route this candidate to sport_science review outside code and keep it candidate-only until real review results exist.

Linked ids:
- desk source reviews: desk_source_review_acsm_exercise_fluid_replacement_intake, desk_source_review_combat_sports_rapid_weight_loss_meta_analysis_intake
- source lookup intake: combat_sports_rapid_weight_loss_meta_analysis_intake, acsm_exercise_fluid_replacement_intake
- source candidates: hydration_heat_exposure_policy_source_need, weight_cut_hydration_consensus_source_need
- source expansion backlog: hydration_sauna_heat_exposure_sources, weight_cut_quantitative_safety_sources
- evidence dependencies: acsm_hydration_nutrition, grappling_grip_dehydration_transfer, japan_rapid_weight_loss_wrestlers, ncaa_weight_management, sichuan_weight_reduction_wrestlers
- data dependencies: body_mass_trend_for_weight_cut, hydration_status_for_weigh_in
- threshold candidates: acute_body_mass_loss_candidate, hydration_status_review_trigger_candidate, sauna_heat_exposure_review_candidate, weight_descent_rate_candidate
- review decisions: data_body_mass_trend_for_weight_cut, data_hydration_status_for_weigh_in, evidence_acsm_hydration_nutrition, evidence_grappling_grip_dehydration_transfer, evidence_japan_rapid_weight_loss_wrestlers, evidence_ncaa_weight_management, evidence_sichuan_weight_reduction_wrestlers, threshold_acute_body_mass_loss_candidate, threshold_hydration_status_review_trigger_candidate, threshold_sauna_heat_exposure_review_candidate, threshold_weight_descent_rate_candidate
- blockers: source_lookup_acsm_exercise_fluid_replacement_intake, source_lookup_combat_sports_rapid_weight_loss_meta_analysis_intake
- review intakes: review_intake_source_lookup_acsm_exercise_fluid_replacement_intake, review_intake_source_lookup_combat_sports_rapid_weight_loss_meta_analysis_intake

## claim_candidate_review_export_sport_science_candidate_hydration_heat_exposure_review_context

Audience: sport_science
Candidate: candidate_hydration_heat_exposure_review_context
Title: Hydration and heat-exposure review context candidate
Candidate status: needs_full_text_before_extraction
Candidate type: hydration_context
candidateOnly=true
runtimeChangeAllowedNow=false
humanReviewed=false

Candidate text:
Hydration and heat-exposure metadata should be handled as review context and not as automatic diagnosis or sauna guidance.

Method/risk areas:
- hydration

Population context:
- general sport
- wrestling weigh-in transfer requires review

Supports:
- Source identity is verified as a position stand record.
- The repository already blocks hydration automation and keeps source text review pending.

Limitations:
- Full text or abstract review remains required.
- No numeric threshold approved.
- This candidate cannot be used for hydration diagnosis.

Reviewer questions:
- Should candidate_hydration_heat_exposure_review_context remain candidate-only, be rejected, or wait for another review packet?
- What source text, context, or reviewer artifact is still missing before later extraction work?
- Could this wording be misunderstood as a diagnosis, hard gate, or runtime instruction?
- Does the source scope support wrestling-specific use, combat-sport transfer, or only background context?
- Which source limitations must be resolved before any later extraction pass?

Required artifacts:
- candidate id: candidate_hydration_heat_exposure_review_context
- linked source lookup ids: acsm_exercise_fluid_replacement_intake
- linked desk source review ids: desk_source_review_acsm_exercise_fluid_replacement_intake
- linked evidence dependency ids: acsm_hydration_nutrition, grappling_grip_dehydration_transfer, ncaa_weight_management
- linked data dependency ids: hydration_status_for_weigh_in
- reviewer notes recorded outside code
- sport_science reviewer rationale
- explicit keep-blocked or future-review recommendation

Allowed outcomes:
- keep candidate blocked
- keep candidate in review export only
- request replacement or additional source material
- reject candidate as unsafe or unsupported
- recommend future extraction review after source readiness is handled separately

Prohibited actions:
- do not mark this export as human review completion
- do not record reviewer identity or review date in this export
- do not convert candidate into a final claim
- do not update source readiness in this export
- do not create a runtime rule
- do not create a runtime gate
- do not add a numeric cutoff
- do not enable Matrix default
- do not imply medical clearance
- do not imply coach signoff

Next action:
Route this candidate to sport_science review outside code and keep it candidate-only until real review results exist.

Linked ids:
- desk source reviews: desk_source_review_acsm_exercise_fluid_replacement_intake
- source lookup intake: acsm_exercise_fluid_replacement_intake
- source candidates: hydration_heat_exposure_policy_source_need
- source expansion backlog: hydration_sauna_heat_exposure_sources
- evidence dependencies: acsm_hydration_nutrition, grappling_grip_dehydration_transfer, ncaa_weight_management
- data dependencies: hydration_status_for_weigh_in
- threshold candidates: hydration_status_review_trigger_candidate, sauna_heat_exposure_review_candidate
- review decisions: data_hydration_status_for_weigh_in, evidence_acsm_hydration_nutrition, evidence_grappling_grip_dehydration_transfer, evidence_ncaa_weight_management, threshold_hydration_status_review_trigger_candidate, threshold_sauna_heat_exposure_review_candidate
- blockers: source_lookup_acsm_exercise_fluid_replacement_intake
- review intakes: review_intake_source_lookup_acsm_exercise_fluid_replacement_intake

## claim_candidate_review_export_sport_science_candidate_readiness_multi_signal_context

Audience: sport_science
Candidate: candidate_readiness_multi_signal_context
Title: Multi-signal readiness context candidate
Candidate status: needs_full_text_before_extraction
Candidate type: readiness_context
candidateOnly=true
runtimeChangeAllowedNow=false
humanReviewed=false

Candidate text:
Readiness signals should be treated as multi-signal context and require data-quality and coach review before influencing load confidence.

Method/risk areas:
- readiness
- sleep
- rhr
- hrv

Population context:
- general sport
- wrestling transfer requires review

Supports:
- Verified consensus source identity supports a cautious readiness-context candidate.
- Source lookup and existing data dependency metadata both keep isolated signals out of runtime gates.

Limitations:
- No numeric threshold approved.
- No single signal is accepted as a runtime gate.
- Full text or abstract review remains required before final claim extraction.

Reviewer questions:
- Should candidate_readiness_multi_signal_context remain candidate-only, be rejected, or wait for another review packet?
- What source text, context, or reviewer artifact is still missing before later extraction work?
- Could this wording be misunderstood as a diagnosis, hard gate, or runtime instruction?
- Does the source scope support wrestling-specific use, combat-sport transfer, or only background context?
- Which source limitations must be resolved before any later extraction pass?

Required artifacts:
- candidate id: candidate_readiness_multi_signal_context
- linked source lookup ids: recovery_performance_consensus_intake
- linked desk source review ids: desk_source_review_recovery_performance_consensus_intake
- linked evidence dependency ids: perform_evidence_matrix, recovery_monitoring_consensus, wearable_validity_trend
- linked data dependency ids: hrv_trend_for_recovery_confidence, readiness_context_for_load_confidence, resting_hr_trend_for_recovery_confidence, sleep_readiness_for_load_confidence, wearable_data_quality_for_readiness
- reviewer notes recorded outside code
- sport_science reviewer rationale
- explicit keep-blocked or future-review recommendation

Allowed outcomes:
- keep candidate blocked
- keep candidate in review export only
- request replacement or additional source material
- reject candidate as unsafe or unsupported
- recommend future extraction review after source readiness is handled separately

Prohibited actions:
- do not mark this export as human review completion
- do not record reviewer identity or review date in this export
- do not convert candidate into a final claim
- do not update source readiness in this export
- do not create a runtime rule
- do not create a runtime gate
- do not add a numeric cutoff
- do not enable Matrix default
- do not imply medical clearance
- do not imply coach signoff

Next action:
Route this candidate to sport_science review outside code and keep it candidate-only until real review results exist.

Linked ids:
- desk source reviews: desk_source_review_recovery_performance_consensus_intake
- source lookup intake: recovery_performance_consensus_intake
- source candidates: readiness_multi_signal_monitoring_source_need
- source expansion backlog: reds_low_energy_availability_sources, rhr_hrv_sleep_readiness_composite_sources, wearable_data_quality_and_readiness_sources
- evidence dependencies: perform_evidence_matrix, recovery_monitoring_consensus, wearable_validity_trend
- data dependencies: hrv_trend_for_recovery_confidence, readiness_context_for_load_confidence, resting_hr_trend_for_recovery_confidence, sleep_readiness_for_load_confidence, wearable_data_quality_for_readiness
- threshold candidates: hrv_trend_candidate, multi_signal_readiness_candidate, rhr_deviation_candidate, sleep_low_confidence_candidate, wearable_data_quality_candidate
- review decisions: data_hrv_trend_for_recovery_confidence, data_readiness_context_for_load_confidence, data_resting_hr_trend_for_recovery_confidence, data_sleep_readiness_for_load_confidence, data_wearable_data_quality_for_readiness, evidence_perform_evidence_matrix, evidence_recovery_monitoring_consensus, evidence_wearable_validity_trend, threshold_hrv_trend_candidate, threshold_multi_signal_readiness_candidate, threshold_rhr_deviation_candidate, threshold_sleep_low_confidence_candidate, threshold_wearable_data_quality_candidate
- blockers: source_lookup_recovery_performance_consensus_intake
- review intakes: review_intake_source_lookup_recovery_performance_consensus_intake

## claim_candidate_review_export_sport_science_candidate_wearable_data_quality_context

Audience: sport_science
Candidate: candidate_wearable_data_quality_context
Title: Wearable data-quality context candidate
Candidate status: needs_full_text_before_extraction
Candidate type: data_quality_context
candidateOnly=true
runtimeChangeAllowedNow=false
humanReviewed=false

Candidate text:
Wearable readiness data should be treated as trend and context, with data-quality review before any future use in load confidence.

Method/risk areas:
- wearable_data
- readiness

Population context:
- general device validity
- wrestling transfer requires review

Supports:
- Verified wearable-validity source identity supports data-quality review context.
- Existing data dependencies already keep wearable data advisory and review-only.

Limitations:
- No wearable signal is treated as absolute truth.
- No numeric threshold approved.
- Full text or abstract review remains required.

Reviewer questions:
- Should candidate_wearable_data_quality_context remain candidate-only, be rejected, or wait for another review packet?
- What source text, context, or reviewer artifact is still missing before later extraction work?
- Could this wording be misunderstood as a diagnosis, hard gate, or runtime instruction?
- Does the source scope support wrestling-specific use, combat-sport transfer, or only background context?
- Which source limitations must be resolved before any later extraction pass?

Required artifacts:
- candidate id: candidate_wearable_data_quality_context
- linked source lookup ids: wearable_validity_systematic_review_intake, recovery_performance_consensus_intake
- linked desk source review ids: desk_source_review_recovery_performance_consensus_intake, desk_source_review_wearable_validity_systematic_review_intake
- linked evidence dependency ids: perform_evidence_matrix, recovery_monitoring_consensus, wearable_validity_trend
- linked data dependency ids: hrv_trend_for_recovery_confidence, readiness_context_for_load_confidence, resting_hr_trend_for_recovery_confidence, sleep_readiness_for_load_confidence, wearable_data_quality_for_readiness
- reviewer notes recorded outside code
- sport_science reviewer rationale
- explicit keep-blocked or future-review recommendation

Allowed outcomes:
- keep candidate blocked
- keep candidate in review export only
- request replacement or additional source material
- reject candidate as unsafe or unsupported
- recommend future extraction review after source readiness is handled separately

Prohibited actions:
- do not mark this export as human review completion
- do not record reviewer identity or review date in this export
- do not convert candidate into a final claim
- do not update source readiness in this export
- do not create a runtime rule
- do not create a runtime gate
- do not add a numeric cutoff
- do not enable Matrix default
- do not imply medical clearance
- do not imply coach signoff

Next action:
Route this candidate to sport_science review outside code and keep it candidate-only until real review results exist.

Linked ids:
- desk source reviews: desk_source_review_recovery_performance_consensus_intake, desk_source_review_wearable_validity_systematic_review_intake
- source lookup intake: wearable_validity_systematic_review_intake, recovery_performance_consensus_intake
- source candidates: readiness_multi_signal_monitoring_source_need, wearable_validity_reliability_source_need
- source expansion backlog: reds_low_energy_availability_sources, rhr_hrv_sleep_readiness_composite_sources, wearable_data_quality_and_readiness_sources
- evidence dependencies: perform_evidence_matrix, recovery_monitoring_consensus, wearable_validity_trend
- data dependencies: hrv_trend_for_recovery_confidence, readiness_context_for_load_confidence, resting_hr_trend_for_recovery_confidence, sleep_readiness_for_load_confidence, wearable_data_quality_for_readiness
- threshold candidates: hrv_trend_candidate, multi_signal_readiness_candidate, rhr_deviation_candidate, sleep_low_confidence_candidate, wearable_data_quality_candidate
- review decisions: data_hrv_trend_for_recovery_confidence, data_readiness_context_for_load_confidence, data_resting_hr_trend_for_recovery_confidence, data_sleep_readiness_for_load_confidence, data_wearable_data_quality_for_readiness, evidence_perform_evidence_matrix, evidence_recovery_monitoring_consensus, evidence_wearable_validity_trend, threshold_hrv_trend_candidate, threshold_multi_signal_readiness_candidate, threshold_rhr_deviation_candidate, threshold_sleep_low_confidence_candidate, threshold_wearable_data_quality_candidate
- blockers: source_lookup_recovery_performance_consensus_intake, source_lookup_wearable_validity_systematic_review_intake
- review intakes: review_intake_source_lookup_recovery_performance_consensus_intake, review_intake_source_lookup_wearable_validity_systematic_review_intake

## claim_candidate_review_export_sport_science_candidate_sleep_readiness_review_context

Audience: sport_science
Candidate: candidate_sleep_readiness_review_context
Title: Sleep readiness review context candidate
Candidate status: needs_human_review_before_extraction
Candidate type: readiness_context
candidateOnly=true
runtimeChangeAllowedNow=false
humanReviewed=false

Candidate text:
Sleep-readiness context should remain a data-quality and coach-review input rather than an isolated load-changing rule.

Method/risk areas:
- sleep
- readiness

Population context:
- general sport
- wrestling transfer requires review

Supports:
- Existing source candidate metadata identifies sleep as a readiness review area.
- Desk review supports review routing, not final extraction.

Limitations:
- No sleep cutoff or numeric threshold approved.
- No isolated sleep rule is accepted.
- Human review remains required before final extraction.

Reviewer questions:
- Should candidate_sleep_readiness_review_context remain candidate-only, be rejected, or wait for another review packet?
- What source text, context, or reviewer artifact is still missing before later extraction work?
- Could this wording be misunderstood as a diagnosis, hard gate, or runtime instruction?
- Does the source scope support wrestling-specific use, combat-sport transfer, or only background context?
- Which source limitations must be resolved before any later extraction pass?

Required artifacts:
- candidate id: candidate_sleep_readiness_review_context
- linked source lookup ids: recovery_performance_consensus_intake
- linked desk source review ids: desk_source_review_recovery_performance_consensus_intake
- linked evidence dependency ids: perform_evidence_matrix, recovery_monitoring_consensus, wearable_validity_trend
- linked data dependency ids: hrv_trend_for_recovery_confidence, readiness_context_for_load_confidence, resting_hr_trend_for_recovery_confidence, sleep_readiness_for_load_confidence, wearable_data_quality_for_readiness
- reviewer notes recorded outside code
- sport_science reviewer rationale
- explicit keep-blocked or future-review recommendation

Allowed outcomes:
- keep candidate blocked
- keep candidate in review export only
- request replacement or additional source material
- reject candidate as unsafe or unsupported
- recommend future extraction review after source readiness is handled separately

Prohibited actions:
- do not mark this export as human review completion
- do not record reviewer identity or review date in this export
- do not convert candidate into a final claim
- do not update source readiness in this export
- do not create a runtime rule
- do not create a runtime gate
- do not add a numeric cutoff
- do not enable Matrix default
- do not imply medical clearance
- do not imply coach signoff

Next action:
Route this candidate to sport_science review outside code and keep it candidate-only until real review results exist.

Linked ids:
- desk source reviews: desk_source_review_recovery_performance_consensus_intake
- source lookup intake: recovery_performance_consensus_intake
- source candidates: readiness_multi_signal_monitoring_source_need, sleep_readiness_context_source_need
- source expansion backlog: reds_low_energy_availability_sources, rhr_hrv_sleep_readiness_composite_sources, wearable_data_quality_and_readiness_sources
- evidence dependencies: perform_evidence_matrix, recovery_monitoring_consensus, wearable_validity_trend
- data dependencies: hrv_trend_for_recovery_confidence, readiness_context_for_load_confidence, resting_hr_trend_for_recovery_confidence, sleep_readiness_for_load_confidence, wearable_data_quality_for_readiness
- threshold candidates: hrv_trend_candidate, multi_signal_readiness_candidate, rhr_deviation_candidate, sleep_low_confidence_candidate, wearable_data_quality_candidate
- review decisions: data_hrv_trend_for_recovery_confidence, data_readiness_context_for_load_confidence, data_resting_hr_trend_for_recovery_confidence, data_sleep_readiness_for_load_confidence, data_wearable_data_quality_for_readiness, evidence_perform_evidence_matrix, evidence_recovery_monitoring_consensus, evidence_wearable_validity_trend, threshold_hrv_trend_candidate, threshold_multi_signal_readiness_candidate, threshold_rhr_deviation_candidate, threshold_sleep_low_confidence_candidate, threshold_wearable_data_quality_candidate
- blockers: source_candidate_sleep_readiness_context_source_need, source_lookup_recovery_performance_consensus_intake
- review intakes: review_intake_source_candidate_sleep_readiness_context_source_need, review_intake_source_lookup_recovery_performance_consensus_intake

## claim_candidate_review_export_sport_science_candidate_rhr_hrv_trend_review_context

Audience: sport_science
Candidate: candidate_rhr_hrv_trend_review_context
Title: RHR and HRV trend review context candidate
Candidate status: needs_human_review_before_extraction
Candidate type: readiness_context
candidateOnly=true
runtimeChangeAllowedNow=false
humanReviewed=false

Candidate text:
RHR and HRV trend metadata should remain recovery-context inputs requiring data-quality review before any future claim extraction.

Method/risk areas:
- rhr
- hrv
- readiness

Population context:
- general sport
- device-derived context requires review

Supports:
- Existing source candidate metadata identifies RHR and HRV trend monitoring as review-only.
- Desk review supports candidate routing to data-quality review.

Limitations:
- No numeric threshold approved.
- No automatic recovery diagnosis is allowed.
- Human review remains required before final extraction.

Reviewer questions:
- Should candidate_rhr_hrv_trend_review_context remain candidate-only, be rejected, or wait for another review packet?
- What source text, context, or reviewer artifact is still missing before later extraction work?
- Could this wording be misunderstood as a diagnosis, hard gate, or runtime instruction?
- Does the source scope support wrestling-specific use, combat-sport transfer, or only background context?
- Which source limitations must be resolved before any later extraction pass?

Required artifacts:
- candidate id: candidate_rhr_hrv_trend_review_context
- linked source lookup ids: recovery_performance_consensus_intake
- linked desk source review ids: desk_source_review_recovery_performance_consensus_intake
- linked evidence dependency ids: perform_evidence_matrix, recovery_monitoring_consensus, wearable_validity_trend
- linked data dependency ids: hrv_trend_for_recovery_confidence, readiness_context_for_load_confidence, resting_hr_trend_for_recovery_confidence, sleep_readiness_for_load_confidence, wearable_data_quality_for_readiness
- reviewer notes recorded outside code
- sport_science reviewer rationale
- explicit keep-blocked or future-review recommendation

Allowed outcomes:
- keep candidate blocked
- keep candidate in review export only
- request replacement or additional source material
- reject candidate as unsafe or unsupported
- recommend future extraction review after source readiness is handled separately

Prohibited actions:
- do not mark this export as human review completion
- do not record reviewer identity or review date in this export
- do not convert candidate into a final claim
- do not update source readiness in this export
- do not create a runtime rule
- do not create a runtime gate
- do not add a numeric cutoff
- do not enable Matrix default
- do not imply medical clearance
- do not imply coach signoff

Next action:
Route this candidate to sport_science review outside code and keep it candidate-only until real review results exist.

Linked ids:
- desk source reviews: desk_source_review_recovery_performance_consensus_intake
- source lookup intake: recovery_performance_consensus_intake
- source candidates: hrv_trend_monitoring_source_need, readiness_multi_signal_monitoring_source_need, rhr_trend_monitoring_source_need
- source expansion backlog: reds_low_energy_availability_sources, rhr_hrv_sleep_readiness_composite_sources, wearable_data_quality_and_readiness_sources
- evidence dependencies: perform_evidence_matrix, recovery_monitoring_consensus, wearable_validity_trend
- data dependencies: hrv_trend_for_recovery_confidence, readiness_context_for_load_confidence, resting_hr_trend_for_recovery_confidence, sleep_readiness_for_load_confidence, wearable_data_quality_for_readiness
- threshold candidates: hrv_trend_candidate, multi_signal_readiness_candidate, rhr_deviation_candidate, sleep_low_confidence_candidate, wearable_data_quality_candidate
- review decisions: data_hrv_trend_for_recovery_confidence, data_readiness_context_for_load_confidence, data_resting_hr_trend_for_recovery_confidence, data_sleep_readiness_for_load_confidence, data_wearable_data_quality_for_readiness, evidence_perform_evidence_matrix, evidence_recovery_monitoring_consensus, evidence_wearable_validity_trend, threshold_hrv_trend_candidate, threshold_multi_signal_readiness_candidate, threshold_rhr_deviation_candidate, threshold_sleep_low_confidence_candidate, threshold_wearable_data_quality_candidate
- blockers: source_candidate_hrv_trend_monitoring_source_need, source_candidate_rhr_trend_monitoring_source_need, source_lookup_recovery_performance_consensus_intake
- review intakes: review_intake_source_candidate_hrv_trend_monitoring_source_need, review_intake_source_candidate_rhr_trend_monitoring_source_need, review_intake_source_lookup_recovery_performance_consensus_intake

## claim_candidate_review_export_sport_science_candidate_female_energy_availability_context

Audience: sport_science
Candidate: candidate_female_energy_availability_context
Title: Female energy availability and RED-S context candidate
Candidate status: needs_full_text_before_extraction
Candidate type: population_context
candidateOnly=true
runtimeChangeAllowedNow=false
humanReviewed=false

Candidate text:
Female energy-availability and RED-S-related metadata should remain medical and sport-science review context, not diagnosis or automatic plan adjustment.

Method/risk areas:
- female_context
- RED-S
- readiness
- weight_cut

Population context:
- female athlete context
- medical interpretation requires review

Supports:
- Verified source identities support a cautious review-context candidate.
- Existing Matrix metadata blocks RED-S automation and medical interpretation.

Limitations:
- No medical diagnosis is extracted.
- No automatic RED-S decision is allowed.
- Full text or abstract review remains required.

Reviewer questions:
- Should candidate_female_energy_availability_context remain candidate-only, be rejected, or wait for another review packet?
- What source text, context, or reviewer artifact is still missing before later extraction work?
- Could this wording be misunderstood as a diagnosis, hard gate, or runtime instruction?
- Does the source scope support wrestling-specific use, combat-sport transfer, or only background context?
- Which source limitations must be resolved before any later extraction pass?

Required artifacts:
- candidate id: candidate_female_energy_availability_context
- linked source lookup ids: acsm_nutrition_athletic_performance_intake, ioc_reds_consensus_statement_intake
- linked desk source review ids: desk_source_review_acsm_nutrition_athletic_performance_intake, desk_source_review_ioc_reds_consensus_statement_intake
- linked evidence dependency ids: acsm_hydration_nutrition, perform_evidence_matrix, recovery_monitoring_consensus
- linked data dependency ids: female_context_for_reds_or_cycle_sensitive_decisions
- reviewer notes recorded outside code
- sport_science reviewer rationale
- explicit keep-blocked or future-review recommendation

Allowed outcomes:
- keep candidate blocked
- keep candidate in review export only
- request replacement or additional source material
- reject candidate as unsafe or unsupported
- recommend future extraction review after source readiness is handled separately

Prohibited actions:
- do not mark this export as human review completion
- do not record reviewer identity or review date in this export
- do not convert candidate into a final claim
- do not update source readiness in this export
- do not create a runtime rule
- do not create a runtime gate
- do not add a numeric cutoff
- do not enable Matrix default
- do not imply medical clearance
- do not imply coach signoff

Next action:
Route this candidate to sport_science review outside code and keep it candidate-only until real review results exist.

Linked ids:
- desk source reviews: desk_source_review_acsm_nutrition_athletic_performance_intake, desk_source_review_ioc_reds_consensus_statement_intake
- source lookup intake: acsm_nutrition_athletic_performance_intake, ioc_reds_consensus_statement_intake
- source candidates: female_context_review_source_need, female_reds_context_source_need
- source expansion backlog: female_context_symptom_aware_readiness_sources, reds_low_energy_availability_sources
- evidence dependencies: acsm_hydration_nutrition, perform_evidence_matrix, recovery_monitoring_consensus
- data dependencies: female_context_for_reds_or_cycle_sensitive_decisions
- threshold candidates: female_symptom_context_candidate, reds_risk_review_candidate
- review decisions: data_female_context_for_reds_or_cycle_sensitive_decisions, evidence_acsm_hydration_nutrition, evidence_perform_evidence_matrix, evidence_recovery_monitoring_consensus, threshold_female_symptom_context_candidate, threshold_reds_risk_review_candidate
- blockers: source_lookup_acsm_nutrition_athletic_performance_intake, source_lookup_ioc_reds_consensus_statement_intake
- review intakes: review_intake_source_lookup_acsm_nutrition_athletic_performance_intake, review_intake_source_lookup_ioc_reds_consensus_statement_intake

## claim_candidate_review_export_sport_science_candidate_youth_progression_review_context

Audience: sport_science
Candidate: candidate_youth_progression_review_context
Title: Youth progression and weight-cut review context candidate
Candidate status: needs_full_text_before_extraction
Candidate type: population_context
candidateOnly=true
runtimeChangeAllowedNow=false
humanReviewed=false

Candidate text:
Youth high-load progression and youth weight-making context require conservative coach, medical and sport-science review before final extraction.

Method/risk areas:
- youth_context
- weight_cut
- injury_pain

Population context:
- youth athlete context
- adult template transfer is blocked

Supports:
- Verified position-stand identity supports a cautious youth-context candidate.
- Existing Matrix metadata blocks adult-default scaling and youth weight-cut automation.

Limitations:
- No automatic youth high-load progression is allowed.
- No youth weight-cut rule is extracted.
- Full text or abstract review remains required.

Reviewer questions:
- Should candidate_youth_progression_review_context remain candidate-only, be rejected, or wait for another review packet?
- What source text, context, or reviewer artifact is still missing before later extraction work?
- Could this wording be misunderstood as a diagnosis, hard gate, or runtime instruction?
- Does the source scope support wrestling-specific use, combat-sport transfer, or only background context?
- Which source limitations must be resolved before any later extraction pass?

Required artifacts:
- candidate id: candidate_youth_progression_review_context
- linked source lookup ids: nsca_long_term_athletic_development_intake
- linked desk source review ids: desk_source_review_nsca_long_term_athletic_development_intake
- linked evidence dependency ids: china_bfr_half_squat_wrestlers, ncaa_weight_management, nsca_youth_safe_progression
- linked data dependency ids: youth_context_for_high_load_progression
- reviewer notes recorded outside code
- sport_science reviewer rationale
- explicit keep-blocked or future-review recommendation

Allowed outcomes:
- keep candidate blocked
- keep candidate in review export only
- request replacement or additional source material
- reject candidate as unsafe or unsupported
- recommend future extraction review after source readiness is handled separately

Prohibited actions:
- do not mark this export as human review completion
- do not record reviewer identity or review date in this export
- do not convert candidate into a final claim
- do not update source readiness in this export
- do not create a runtime rule
- do not create a runtime gate
- do not add a numeric cutoff
- do not enable Matrix default
- do not imply medical clearance
- do not imply coach signoff

Next action:
Route this candidate to sport_science review outside code and keep it candidate-only until real review results exist.

Linked ids:
- desk source reviews: desk_source_review_nsca_long_term_athletic_development_intake
- source lookup intake: nsca_long_term_athletic_development_intake
- source candidates: youth_high_load_and_weight_cut_source_need
- source expansion backlog: youth_high_load_and_weight_cut_sources
- evidence dependencies: china_bfr_half_squat_wrestlers, ncaa_weight_management, nsca_youth_safe_progression
- data dependencies: youth_context_for_high_load_progression
- threshold candidates: youth_high_load_progression_candidate, youth_weight_cut_block_candidate
- review decisions: data_youth_context_for_high_load_progression, evidence_china_bfr_half_squat_wrestlers, evidence_ncaa_weight_management, evidence_nsca_youth_safe_progression, threshold_youth_high_load_progression_candidate, threshold_youth_weight_cut_block_candidate
- blockers: source_lookup_nsca_long_term_athletic_development_intake
- review intakes: review_intake_source_lookup_nsca_long_term_athletic_development_intake

## claim_candidate_review_export_sport_science_candidate_bfr_kaatsu_safety_review_context

Audience: sport_science
Candidate: candidate_bfr_kaatsu_safety_review_context
Title: BFR and KAATSU safety review context candidate
Candidate status: needs_full_text_before_extraction
Candidate type: safety_context
candidateOnly=true
runtimeChangeAllowedNow=false
humanReviewed=false

Candidate text:
BFR and KAATSU-related methods require safety screening and cannot become automatic constructor assignments.

Method/risk areas:
- bfr_kaatsu
- lmv

Population context:
- methodology context
- wrestling transfer requires review

Supports:
- Verified source identity supports safety-review routing.
- Existing Matrix metadata keeps BFR and KAATSU outside runtime logic.

Limitations:
- No contraindication decision is extracted.
- No automatic BFR or KAATSU prescription is allowed.
- Full text or abstract review remains required.

Reviewer questions:
- Should candidate_bfr_kaatsu_safety_review_context remain candidate-only, be rejected, or wait for another review packet?
- What source text, context, or reviewer artifact is still missing before later extraction work?
- Could this wording be misunderstood as a diagnosis, hard gate, or runtime instruction?
- Does the source scope support wrestling-specific use, combat-sport transfer, or only background context?
- Which source limitations must be resolved before any later extraction pass?

Required artifacts:
- candidate id: candidate_bfr_kaatsu_safety_review_context
- linked source lookup ids: bfr_position_stand_intake
- linked desk source review ids: desk_source_review_bfr_position_stand_intake
- linked evidence dependency ids: bfr_kaatsu_local_metabolic, china_bfr_half_squat_wrestlers
- linked data dependency ids: lmv_local_fatigue_for_legs
- reviewer notes recorded outside code
- sport_science reviewer rationale
- explicit keep-blocked or future-review recommendation

Allowed outcomes:
- keep candidate blocked
- keep candidate in review export only
- request replacement or additional source material
- reject candidate as unsafe or unsupported
- recommend future extraction review after source readiness is handled separately

Prohibited actions:
- do not mark this export as human review completion
- do not record reviewer identity or review date in this export
- do not convert candidate into a final claim
- do not update source readiness in this export
- do not create a runtime rule
- do not create a runtime gate
- do not add a numeric cutoff
- do not enable Matrix default
- do not imply medical clearance
- do not imply coach signoff

Next action:
Route this candidate to sport_science review outside code and keep it candidate-only until real review results exist.

Linked ids:
- desk source reviews: desk_source_review_bfr_position_stand_intake
- source lookup intake: bfr_position_stand_intake
- source candidates: bfr_kaatsu_safety_screening_source_need
- source expansion backlog: bfr_kaatsu_safety_and_screening_sources
- evidence dependencies: bfr_kaatsu_local_metabolic, china_bfr_half_squat_wrestlers
- data dependencies: lmv_local_fatigue_for_legs
- threshold candidates: lmv_legs_recovery_window_candidate
- review decisions: data_lmv_local_fatigue_for_legs, evidence_bfr_kaatsu_local_metabolic, evidence_china_bfr_half_squat_wrestlers, threshold_lmv_legs_recovery_window_candidate
- blockers: source_lookup_bfr_position_stand_intake
- review intakes: review_intake_source_lookup_bfr_position_stand_intake

## claim_candidate_review_export_sport_science_candidate_lmv_local_fatigue_review_context

Audience: sport_science
Candidate: candidate_lmv_local_fatigue_review_context
Title: LMV local fatigue review context candidate
Candidate status: needs_full_text_before_extraction
Candidate type: methodology_context
candidateOnly=true
runtimeChangeAllowedNow=false
humanReviewed=false

Candidate text:
LMV and local-fatigue metadata should remain coach and sport-science review context, especially near start-proximity decisions.

Method/risk areas:
- lmv
- taper
- bfr_kaatsu

Population context:
- methodology transfer
- wrestling transfer requires review

Supports:
- Verified source identities support methodology review context.
- Existing local-fatigue data dependency remains review-only.

Limitations:
- No universal LMV rule is extracted.
- No numeric threshold approved.
- Full text or abstract review remains required.

Reviewer questions:
- Should candidate_lmv_local_fatigue_review_context remain candidate-only, be rejected, or wait for another review packet?
- What source text, context, or reviewer artifact is still missing before later extraction work?
- Could this wording be misunderstood as a diagnosis, hard gate, or runtime instruction?
- Does the source scope support wrestling-specific use, combat-sport transfer, or only background context?
- Which source limitations must be resolved before any later extraction pass?

Required artifacts:
- candidate id: candidate_lmv_local_fatigue_review_context
- linked source lookup ids: bfr_lmv_methodology_intake, tapering_systematic_review_intake
- linked desk source review ids: desk_source_review_bfr_lmv_methodology_intake, desk_source_review_tapering_systematic_review_intake
- linked evidence dependency ids: bfr_kaatsu_local_metabolic, china_bfr_half_squat_wrestlers, china_ssit_freestyle_wrestlers, europe_pre_competition_plan, matrix_transition_plan, perform_evidence_matrix, periodization_taper_peaking
- linked data dependency ids: lmv_local_fatigue_for_legs, sleep_readiness_for_load_confidence, taper_load_context_for_hidden_fatigue
- reviewer notes recorded outside code
- sport_science reviewer rationale
- explicit keep-blocked or future-review recommendation

Allowed outcomes:
- keep candidate blocked
- keep candidate in review export only
- request replacement or additional source material
- reject candidate as unsafe or unsupported
- recommend future extraction review after source readiness is handled separately

Prohibited actions:
- do not mark this export as human review completion
- do not record reviewer identity or review date in this export
- do not convert candidate into a final claim
- do not update source readiness in this export
- do not create a runtime rule
- do not create a runtime gate
- do not add a numeric cutoff
- do not enable Matrix default
- do not imply medical clearance
- do not imply coach signoff

Next action:
Route this candidate to sport_science review outside code and keep it candidate-only until real review results exist.

Linked ids:
- desk source reviews: desk_source_review_bfr_lmv_methodology_intake, desk_source_review_tapering_systematic_review_intake
- source lookup intake: bfr_lmv_methodology_intake, tapering_systematic_review_intake
- source candidates: lmv_statodynamics_source_need, taper_hidden_load_source_need
- source expansion backlog: bfr_kaatsu_safety_and_screening_sources, lmv_legs_recovery_and_start_proximity_sources, taper_hidden_glycolytic_load_sources
- evidence dependencies: bfr_kaatsu_local_metabolic, china_bfr_half_squat_wrestlers, china_ssit_freestyle_wrestlers, europe_pre_competition_plan, matrix_transition_plan, perform_evidence_matrix, periodization_taper_peaking
- data dependencies: lmv_local_fatigue_for_legs, sleep_readiness_for_load_confidence, taper_load_context_for_hidden_fatigue
- threshold candidates: hidden_glycolytic_load_close_start_candidate, lmv_legs_recovery_window_candidate, lmv_near_main_start_role_candidate, taper_high_volume_sfp_candidate
- review decisions: data_lmv_local_fatigue_for_legs, data_sleep_readiness_for_load_confidence, data_taper_load_context_for_hidden_fatigue, evidence_bfr_kaatsu_local_metabolic, evidence_china_bfr_half_squat_wrestlers, evidence_china_ssit_freestyle_wrestlers, evidence_europe_pre_competition_plan, evidence_matrix_transition_plan, evidence_perform_evidence_matrix, evidence_periodization_taper_peaking, threshold_hidden_glycolytic_load_close_start_candidate, threshold_lmv_legs_recovery_window_candidate, threshold_lmv_near_main_start_role_candidate, threshold_taper_high_volume_sfp_candidate
- blockers: source_lookup_bfr_lmv_methodology_intake, source_lookup_tapering_systematic_review_intake
- review intakes: review_intake_source_lookup_bfr_lmv_methodology_intake, review_intake_source_lookup_tapering_systematic_review_intake

## claim_candidate_review_export_sport_science_candidate_taper_hidden_load_review_context

Audience: sport_science
Candidate: candidate_taper_hidden_load_review_context
Title: Taper hidden-load review context candidate
Candidate status: needs_full_text_before_extraction
Candidate type: performance_context
candidateOnly=true
runtimeChangeAllowedNow=false
humanReviewed=false

Candidate text:
Taper and hidden-load context should remain a coach and sport-science review topic before any future close-start claim extraction.

Method/risk areas:
- taper
- lmv
- readiness
- sleep

Population context:
- general sport transfer
- wrestling close-start transfer requires review

Supports:
- Verified source identities support cautious review context for taper transfer.
- Existing Matrix metadata keeps close-start taper thresholds as candidates only.

Limitations:
- No close-start hard window is extracted.
- No numeric threshold approved.
- Full text or abstract review remains required.

Reviewer questions:
- Should candidate_taper_hidden_load_review_context remain candidate-only, be rejected, or wait for another review packet?
- What source text, context, or reviewer artifact is still missing before later extraction work?
- Could this wording be misunderstood as a diagnosis, hard gate, or runtime instruction?
- Does the source scope support wrestling-specific use, combat-sport transfer, or only background context?
- Which source limitations must be resolved before any later extraction pass?

Required artifacts:
- candidate id: candidate_taper_hidden_load_review_context
- linked source lookup ids: tapering_systematic_review_intake, recovery_performance_consensus_intake
- linked desk source review ids: desk_source_review_recovery_performance_consensus_intake, desk_source_review_tapering_systematic_review_intake
- linked evidence dependency ids: china_ssit_freestyle_wrestlers, europe_pre_competition_plan, matrix_transition_plan, perform_evidence_matrix, periodization_taper_peaking, recovery_monitoring_consensus, wearable_validity_trend
- linked data dependency ids: hrv_trend_for_recovery_confidence, lmv_local_fatigue_for_legs, readiness_context_for_load_confidence, resting_hr_trend_for_recovery_confidence, sleep_readiness_for_load_confidence, taper_load_context_for_hidden_fatigue, wearable_data_quality_for_readiness
- reviewer notes recorded outside code
- sport_science reviewer rationale
- explicit keep-blocked or future-review recommendation

Allowed outcomes:
- keep candidate blocked
- keep candidate in review export only
- request replacement or additional source material
- reject candidate as unsafe or unsupported
- recommend future extraction review after source readiness is handled separately

Prohibited actions:
- do not mark this export as human review completion
- do not record reviewer identity or review date in this export
- do not convert candidate into a final claim
- do not update source readiness in this export
- do not create a runtime rule
- do not create a runtime gate
- do not add a numeric cutoff
- do not enable Matrix default
- do not imply medical clearance
- do not imply coach signoff

Next action:
Route this candidate to sport_science review outside code and keep it candidate-only until real review results exist.

Linked ids:
- desk source reviews: desk_source_review_recovery_performance_consensus_intake, desk_source_review_tapering_systematic_review_intake
- source lookup intake: tapering_systematic_review_intake, recovery_performance_consensus_intake
- source candidates: readiness_multi_signal_monitoring_source_need, taper_hidden_load_source_need
- source expansion backlog: lmv_legs_recovery_and_start_proximity_sources, reds_low_energy_availability_sources, rhr_hrv_sleep_readiness_composite_sources, taper_hidden_glycolytic_load_sources, wearable_data_quality_and_readiness_sources
- evidence dependencies: china_ssit_freestyle_wrestlers, europe_pre_competition_plan, matrix_transition_plan, perform_evidence_matrix, periodization_taper_peaking, recovery_monitoring_consensus, wearable_validity_trend
- data dependencies: hrv_trend_for_recovery_confidence, lmv_local_fatigue_for_legs, readiness_context_for_load_confidence, resting_hr_trend_for_recovery_confidence, sleep_readiness_for_load_confidence, taper_load_context_for_hidden_fatigue, wearable_data_quality_for_readiness
- threshold candidates: hidden_glycolytic_load_close_start_candidate, hrv_trend_candidate, lmv_near_main_start_role_candidate, multi_signal_readiness_candidate, rhr_deviation_candidate, sleep_low_confidence_candidate, taper_high_volume_sfp_candidate, wearable_data_quality_candidate
- review decisions: data_hrv_trend_for_recovery_confidence, data_lmv_local_fatigue_for_legs, data_readiness_context_for_load_confidence, data_resting_hr_trend_for_recovery_confidence, data_sleep_readiness_for_load_confidence, data_taper_load_context_for_hidden_fatigue, data_wearable_data_quality_for_readiness, evidence_china_ssit_freestyle_wrestlers, evidence_europe_pre_competition_plan, evidence_matrix_transition_plan, evidence_perform_evidence_matrix, evidence_periodization_taper_peaking, evidence_recovery_monitoring_consensus, evidence_wearable_validity_trend, threshold_hidden_glycolytic_load_close_start_candidate, threshold_hrv_trend_candidate, threshold_lmv_near_main_start_role_candidate, threshold_multi_signal_readiness_candidate, threshold_rhr_deviation_candidate, threshold_sleep_low_confidence_candidate, threshold_taper_high_volume_sfp_candidate, threshold_wearable_data_quality_candidate
- blockers: source_lookup_recovery_performance_consensus_intake, source_lookup_tapering_systematic_review_intake
- review intakes: review_intake_source_lookup_recovery_performance_consensus_intake, review_intake_source_lookup_tapering_systematic_review_intake

## claim_candidate_review_export_sport_science_candidate_travel_fatigue_review_blocker_context

Audience: sport_science
Candidate: candidate_travel_fatigue_review_blocker_context
Title: Travel fatigue review blocker context candidate
Candidate status: needs_human_review_before_extraction
Candidate type: review_blocker_context
candidateOnly=true
runtimeChangeAllowedNow=false
humanReviewed=false

Candidate text:
Travel fatigue should remain a review blocker until source-specific context and data-quality limits are reviewed.

Method/risk areas:
- travel_fatigue
- readiness

Population context:
- travel context
- wrestling transfer requires review

Supports:
- Existing source candidate metadata identifies travel fatigue as unresolved.
- Desk review supports keeping travel fatigue in review export only.

Limitations:
- No load ceiling is extracted.
- No numeric threshold approved.
- Human review remains required before final extraction.

Reviewer questions:
- Should candidate_travel_fatigue_review_blocker_context remain candidate-only, be rejected, or wait for another review packet?
- What source text, context, or reviewer artifact is still missing before later extraction work?
- Could this wording be misunderstood as a diagnosis, hard gate, or runtime instruction?
- Does the source scope support wrestling-specific use, combat-sport transfer, or only background context?
- Which source limitations must be resolved before any later extraction pass?

Required artifacts:
- candidate id: candidate_travel_fatigue_review_blocker_context
- linked source lookup ids: recovery_performance_consensus_intake
- linked desk source review ids: desk_source_review_recovery_performance_consensus_intake
- linked evidence dependency ids: acsm_hydration_nutrition, europe_pre_competition_plan, perform_evidence_matrix, recovery_monitoring_consensus, wearable_validity_trend
- linked data dependency ids: hrv_trend_for_recovery_confidence, readiness_context_for_load_confidence, resting_hr_trend_for_recovery_confidence, sleep_readiness_for_load_confidence, travel_fatigue_for_load_ceiling, wearable_data_quality_for_readiness
- reviewer notes recorded outside code
- sport_science reviewer rationale
- explicit keep-blocked or future-review recommendation

Allowed outcomes:
- keep candidate blocked
- keep candidate in review export only
- request replacement or additional source material
- reject candidate as unsafe or unsupported
- recommend future extraction review after source readiness is handled separately

Prohibited actions:
- do not mark this export as human review completion
- do not record reviewer identity or review date in this export
- do not convert candidate into a final claim
- do not update source readiness in this export
- do not create a runtime rule
- do not create a runtime gate
- do not add a numeric cutoff
- do not enable Matrix default
- do not imply medical clearance
- do not imply coach signoff

Next action:
Route this candidate to sport_science review outside code and keep it candidate-only until real review results exist.

Linked ids:
- desk source reviews: desk_source_review_recovery_performance_consensus_intake
- source lookup intake: recovery_performance_consensus_intake
- source candidates: readiness_multi_signal_monitoring_source_need, travel_fatigue_context_source_need
- source expansion backlog: reds_low_energy_availability_sources, rhr_hrv_sleep_readiness_composite_sources, travel_fatigue_load_ceiling_sources, wearable_data_quality_and_readiness_sources
- evidence dependencies: acsm_hydration_nutrition, europe_pre_competition_plan, perform_evidence_matrix, recovery_monitoring_consensus, wearable_validity_trend
- data dependencies: hrv_trend_for_recovery_confidence, readiness_context_for_load_confidence, resting_hr_trend_for_recovery_confidence, sleep_readiness_for_load_confidence, travel_fatigue_for_load_ceiling, wearable_data_quality_for_readiness
- threshold candidates: hrv_trend_candidate, multi_signal_readiness_candidate, rhr_deviation_candidate, sleep_low_confidence_candidate, travel_fatigue_load_ceiling_candidate, wearable_data_quality_candidate
- review decisions: data_hrv_trend_for_recovery_confidence, data_readiness_context_for_load_confidence, data_resting_hr_trend_for_recovery_confidence, data_sleep_readiness_for_load_confidence, data_travel_fatigue_for_load_ceiling, data_wearable_data_quality_for_readiness, evidence_acsm_hydration_nutrition, evidence_europe_pre_competition_plan, evidence_perform_evidence_matrix, evidence_recovery_monitoring_consensus, evidence_wearable_validity_trend, threshold_hrv_trend_candidate, threshold_multi_signal_readiness_candidate, threshold_rhr_deviation_candidate, threshold_sleep_low_confidence_candidate, threshold_travel_fatigue_load_ceiling_candidate, threshold_wearable_data_quality_candidate
- blockers: source_candidate_travel_fatigue_context_source_need, source_lookup_recovery_performance_consensus_intake
- review intakes: review_intake_source_candidate_travel_fatigue_context_source_need, review_intake_source_lookup_recovery_performance_consensus_intake

## claim_candidate_review_export_sport_science_candidate_contact_load_review_blocker_context

Audience: sport_science
Candidate: candidate_contact_load_review_blocker_context
Title: Wrestling contact-load review blocker context candidate
Candidate status: needs_human_review_before_extraction
Candidate type: review_blocker_context
candidateOnly=true
runtimeChangeAllowedNow=false
humanReviewed=false

Candidate text:
Wrestling contact-load classification remains a coach and sport-science review blocker before any future claim extraction.

Method/risk areas:
- contact_load

Population context:
- wrestling contact context
- coach-school transfer requires review

Supports:
- Existing source candidate metadata marks contact-load classification as unresolved.
- Desk review supports blocker routing, not final extraction.

Limitations:
- No contact exposure rule is extracted.
- No numeric threshold approved.
- Human review remains required before final extraction.

Reviewer questions:
- Should candidate_contact_load_review_blocker_context remain candidate-only, be rejected, or wait for another review packet?
- What source text, context, or reviewer artifact is still missing before later extraction work?
- Could this wording be misunderstood as a diagnosis, hard gate, or runtime instruction?
- Does the source scope support wrestling-specific use, combat-sport transfer, or only background context?
- Which source limitations must be resolved before any later extraction pass?

Required artifacts:
- candidate id: candidate_contact_load_review_blocker_context
- linked source lookup ids: recovery_performance_consensus_intake
- linked desk source review ids: desk_source_review_recovery_performance_consensus_intake
- linked evidence dependency ids: europe_pre_competition_plan, grappling_grip_dehydration_transfer, perform_evidence_matrix, recovery_monitoring_consensus, wearable_validity_trend, wrestling_temporal_structure
- linked data dependency ids: contact_load_exposure_for_wrestling_sessions, hrv_trend_for_recovery_confidence, readiness_context_for_load_confidence, resting_hr_trend_for_recovery_confidence, sleep_readiness_for_load_confidence, wearable_data_quality_for_readiness
- reviewer notes recorded outside code
- sport_science reviewer rationale
- explicit keep-blocked or future-review recommendation

Allowed outcomes:
- keep candidate blocked
- keep candidate in review export only
- request replacement or additional source material
- reject candidate as unsafe or unsupported
- recommend future extraction review after source readiness is handled separately

Prohibited actions:
- do not mark this export as human review completion
- do not record reviewer identity or review date in this export
- do not convert candidate into a final claim
- do not update source readiness in this export
- do not create a runtime rule
- do not create a runtime gate
- do not add a numeric cutoff
- do not enable Matrix default
- do not imply medical clearance
- do not imply coach signoff

Next action:
Route this candidate to sport_science review outside code and keep it candidate-only until real review results exist.

Linked ids:
- desk source reviews: desk_source_review_recovery_performance_consensus_intake
- source lookup intake: recovery_performance_consensus_intake
- source candidates: readiness_multi_signal_monitoring_source_need, wrestling_contact_load_source_need
- source expansion backlog: reds_low_energy_availability_sources, rhr_hrv_sleep_readiness_composite_sources, wearable_data_quality_and_readiness_sources, wrestling_contact_load_classification_sources
- evidence dependencies: europe_pre_competition_plan, grappling_grip_dehydration_transfer, perform_evidence_matrix, recovery_monitoring_consensus, wearable_validity_trend, wrestling_temporal_structure
- data dependencies: contact_load_exposure_for_wrestling_sessions, hrv_trend_for_recovery_confidence, readiness_context_for_load_confidence, resting_hr_trend_for_recovery_confidence, sleep_readiness_for_load_confidence, wearable_data_quality_for_readiness
- threshold candidates: contact_load_exposure_candidate, control_bouts_recovery_window_candidate, hrv_trend_candidate, multi_signal_readiness_candidate, rhr_deviation_candidate, sleep_low_confidence_candidate, wearable_data_quality_candidate
- review decisions: data_contact_load_exposure_for_wrestling_sessions, data_hrv_trend_for_recovery_confidence, data_readiness_context_for_load_confidence, data_resting_hr_trend_for_recovery_confidence, data_sleep_readiness_for_load_confidence, data_wearable_data_quality_for_readiness, evidence_europe_pre_competition_plan, evidence_grappling_grip_dehydration_transfer, evidence_perform_evidence_matrix, evidence_recovery_monitoring_consensus, evidence_wearable_validity_trend, evidence_wrestling_temporal_structure, threshold_contact_load_exposure_candidate, threshold_control_bouts_recovery_window_candidate, threshold_hrv_trend_candidate, threshold_multi_signal_readiness_candidate, threshold_rhr_deviation_candidate, threshold_sleep_low_confidence_candidate, threshold_wearable_data_quality_candidate
- blockers: source_candidate_wrestling_contact_load_source_need, source_lookup_recovery_performance_consensus_intake
- review intakes: review_intake_source_candidate_wrestling_contact_load_source_need, review_intake_source_lookup_recovery_performance_consensus_intake
