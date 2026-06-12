# Matrix P0 Source Acquisition Dossier + Source Candidate Registry

Stage: P0 Source Acquisition Dossier + Source Candidate Registry.

This dossier converts the unresolved P0 source-expansion backlog into a
traceable source-acquisition plan. It does not perform source lookup, does not
accept sources, does not approve thresholds and does not simulate human review.

The active chain is:

```text
SourceExpansionBacklog
-> SourceCandidateRegistry
-> P0 Source Acquisition Dossier
-> future evidence claim extraction or review
```

## 1. Summary

Implemented metadata:

- `packages/shared/src/constructor-matrix-source-candidates.ts`;
- `npm run check:constructor-matrix-source-candidates`;
- shared exports for source candidate ids, lookup helpers and acquisition
  summary;
- Review Package source-acquisition summary metadata;
- Review Decision Ledger metadata links to source candidate ids.

Guardrails:

- no source is automatically accepted;
- no fake citations, DOI, PMID, authors or source metadata are invented;
- no numeric threshold values or cutoffs are added;
- no runtime rules, gates or promotions are added;
- no human approvals, reviewer names or review timestamps are recorded;
- every source candidate keeps `runtimeChangeAllowedNow=false`;
- production route, rollout gates, preview behavior and legacy fallback are
  unchanged;
- broad Matrix default remains blocked.

## 2. P0 Backlog Coverage

| P0 backlog item | Primary source candidates | Reviewer tracks | Runtime use blocked now |
|---|---|---|---|
| `weight_cut_quantitative_safety_sources` | `weight_cut_hydration_consensus_source_need` | medical, coach, sport_science | automatic weight cut rule, dehydration diagnosis, numeric threshold promotion |
| `hydration_sauna_heat_exposure_sources` | `weight_cut_hydration_consensus_source_need`, `hydration_heat_exposure_policy_source_need` | medical, coach, sport_science | automatic hydration diagnosis, sauna recommendation, weight-cut automation |
| `reds_low_energy_availability_sources` | `readiness_multi_signal_monitoring_source_need`, `female_context_review_source_need`, `female_reds_context_source_need` | medical, coach, sport_science, product_safety | RED-S diagnosis, cycle-phase automation, weight-cut permission |
| `bfr_kaatsu_safety_and_screening_sources` | `lmv_statodynamics_source_need`, `bfr_kaatsu_safety_screening_source_need` | medical, coach, sport_science, product_safety | BFR or KAATSU prescription, automatic screening, local-fatigue clearance |
| `injury_pain_return_to_training_sources` | `pain_review_intake_source_need`, `injury_return_source_need` | medical, coach, product_safety | return-to-training clearance, pain-load automation, injury block selection |
| `youth_high_load_and_weight_cut_sources` | `youth_high_load_and_weight_cut_source_need` | medical, coach, sport_science | adult-matrix scaling, youth weight cutting, youth high-load automation |

## 3. Source Candidate Table

| Candidate | Area | Need type | Status | Linked backlog scope |
|---|---|---|---|---|
| `weight_cut_hydration_consensus_source_need` | weight_cut | consensus_statement | mentioned_in_existing_docs | P0 weight cut, P0 hydration |
| `hydration_heat_exposure_policy_source_need` | hydration | position_stand | requires_verification | P0 hydration |
| `readiness_multi_signal_monitoring_source_need` | readiness | consensus_statement | mentioned_in_existing_docs | P0 RED-S, readiness and wearable backlog |
| `wearable_validity_reliability_source_need` | wearable_data | validity_reliability_study | mentioned_in_existing_docs | wearable data-quality backlog |
| `sleep_readiness_context_source_need` | sleep | consensus_statement | needs_external_lookup | sleep/RHR/HRV readiness backlog |
| `rhr_trend_monitoring_source_need` | rhr | validity_reliability_study | needs_external_lookup | sleep/RHR/HRV readiness backlog |
| `hrv_trend_monitoring_source_need` | hrv | validity_reliability_study | needs_external_lookup | sleep/RHR/HRV readiness backlog |
| `pain_review_intake_source_need` | pain | clinical_guideline | needs_external_lookup | P0 injury and pain |
| `injury_return_source_need` | injury | clinical_guideline | needs_external_lookup | P0 injury and pain |
| `female_context_review_source_need` | female_context | consensus_statement | needs_external_lookup | P0 RED-S and female readiness |
| `female_reds_context_source_need` | reds | clinical_guideline | needs_external_lookup | P0 RED-S |
| `youth_high_load_and_weight_cut_source_need` | youth_context | position_stand | mentioned_in_existing_docs | P0 youth |
| `wrestling_contact_load_source_need` | contact_load | sport_specific_review | mentioned_in_existing_docs | contact load backlog |
| `lmv_statodynamics_source_need` | lmv | peer_reviewed_intervention | mentioned_in_existing_docs | P0 BFR/KAATSU and LMV backlog |
| `bfr_kaatsu_safety_screening_source_need` | bfr_kaatsu | position_stand | requires_verification | P0 BFR/KAATSU |
| `taper_hidden_load_source_need` | taper | systematic_review | mentioned_in_existing_docs | taper and LMV backlog |
| `competition_model_source_need` | competition_model | official_regulation | requires_verification | competition model backlog |
| `competition_context_review_source_need` | competition_context | sport_specific_review | mentioned_in_existing_docs | competition context backlog |
| `travel_fatigue_context_source_need` | travel_fatigue | sport_specific_review | needs_external_lookup | travel fatigue backlog |
| `product_safety_rollout_source_need` | product_safety | product_safety_policy | requires_verification | internal validation and review export backlog |

No row in this table means a source has been accepted. The statuses only define
the next intake action.

## 4. Area Coverage

Required source-acquisition areas covered:

- weight_cut;
- hydration;
- readiness;
- wearable_data;
- sleep;
- rhr;
- hrv;
- pain;
- injury;
- female_context;
- reds;
- youth_context;
- contact_load;
- lmv;
- bfr_kaatsu;
- taper;
- competition_model;
- product_safety.

Additional traceability areas covered:

- travel_fatigue;
- competition_context.

## 5. Reviewer-Track Coverage

The candidate registry routes source intake to these review tracks:

- coach: weight-making context, youth progression, contact load, LMV, taper,
  competition model and travel context;
- medical: weight cut, hydration, RED-S/female context, pain, injury, youth and
  BFR/KAATSU safety;
- data_quality: readiness, wearable data, sleep, RHR, HRV, travel context and
  product-safety auditability;
- sport_science: source transfer, sport-specificity, taper, contact load, LMV,
  readiness and competition model;
- product_safety: BFR/KAATSU boundaries, RED-S wording, injury return,
  competition context, review export and rollout guardrails.

## 6. Acceptance Criteria

A future source can move toward claim extraction only when:

- exact source metadata is verified;
- source type and source title are recorded;
- issuing body or journal is recorded;
- population and sport context are explicit;
- safety scope is explicit;
- transfer limits are documented;
- reviewer track confirms the source is suitable for intake;
- the extracted claim does not approve a numeric threshold or runtime rule.

## 7. Rejection Criteria

Reject or mark `do_not_use` when:

- source is a blog, marketing page or unsourced coaching opinion;
- source metadata cannot be verified;
- source does not describe population or safety scope clearly;
- source implies medical clearance, diagnosis or runtime approval;
- source is not transferable to wrestling or the relevant combat-sport context;
- source would create an automatic rule without coach, medical, data-quality or
  product-safety review.

## 8. Extraction Questions

Future evidence-claim extraction must answer:

- What claim is supported by the source?
- What source type and population does the claim depend on?
- Which backlog item and ledger entries does it unblock?
- Which threshold candidates remain candidate-only?
- Which data fields are required before review export can mention the claim?
- Which reviewer track must approve the claim before any future runtime
  discussion?
- What wording prevents diagnosis, clearance, hard gating or default rollout?

## 9. Forbidden Runtime Use Until Accepted

The following remain forbidden:

- runtime hard rule;
- runtime gate;
- automatic weight cut rule;
- dehydration diagnosis;
- RED-S diagnosis;
- cycle-phase automatic adjustment;
- BFR or KAATSU automatic prescription;
- automatic pain-load decision;
- automatic injury-return decision;
- automatic youth weight cutting;
- wearable absolute truth;
- contact-minute threshold;
- fixed close-start hard window;
- normal training day on competition day;
- broad Matrix default;
- production rollout promotion;
- save or assign enablement.

## 10. What Remains Blocked

Blocked until source lookup and real review:

- numeric threshold values for weight cut, hydration, RHR, HRV, sleep, pain,
  contact exposure, LMV or taper;
- automatic medical or return-to-training decisions;
- automatic BFR/KAATSU screening or prescription;
- RED-S-sensitive automated decisions;
- source claims in runtime plan generation;
- Matrix broad default or production rollout promotion.

## 11. Next Stage Options

Safe next stages:

- external source lookup for the P0 source candidates;
- evidence claim extraction from verified sources;
- coach, medical and data-quality review pass;
- source candidate rejection or acceptance ledger.

Unsafe next stages:

- runtime promotion;
- threshold approval;
- fake source metadata;
- human-review simulation;
- broad Matrix default.

## 12. Stage: P0 Controlled Source Lookup + Source Intake Registry

The controlled source lookup stage has created a metadata-only intake registry:

- registry: `packages/shared/src/constructor-matrix-source-lookup-intake.ts`;
- verifier: `npm run check:constructor-matrix-source-lookup-intake`;
- Review Package summary: source lookup intake counts and runtime guard flag;
- Review Decision Ledger links: metadata-only source lookup intake ids.

External lookup was available. The intake registry records 14 source identities,
with 14 verified records, 2 entries still needing manual verification before
claim extraction, 0 extraction-ready entries and 0 lookup-unavailable entries.
It covers 6/6 P0 source-expansion backlog items and 10/10 P0 source candidates.

The stage records citation metadata such as source title, URL, DOI, PMID,
publisher or organization, and reviewer tracks when verified. It does not
extract evidence claims, does not approve any source for rules, and does not
convert source candidates into runtime behavior.

Guardrails:

- no fake citations, DOI, PMID, authors or years are added;
- no numeric threshold values or cutoffs are approved;
- no fake human approvals, reviewer names or review timestamps are recorded;
- no source is accepted into runtime rules;
- runtime behavior, production route, rollout gates, preview behavior and
  legacy fallback are unchanged;
- Matrix default remains prohibited.

Next safe stages: evidence claim extraction from verified sources only, manual
verification for official policy/rule entries, or real coach/medical/data
quality review.

## 13. Stage: P0 Evidence Claim Extraction Registry

The P0 evidence claim extraction stage has created a metadata-only registry for
future extracted claims and current claim blockers:

- registry: `packages/shared/src/constructor-matrix-evidence-claims.ts`;
- verifier: `npm run check:constructor-matrix-evidence-claims`;
- Review Package summary: evidence claim counts, blocker counts and coverage;
- source lookup records covered: 14/14;
- P0 source candidates covered: 10/10;
- P0 backlog items covered: 6/6.

The claim registry intentionally empty because SourceLookupIntake currently has
0 extraction-ready records. The stage records 20 blockers instead of extracting
claims from source identities that still need full text, policy text, manual
verification or human review.

This means:

- manual-verification sources are not used for claims;
- verified-but-not-ready sources stay blocked;
- no source identity is turned into a runtime rule;
- no numeric threshold values are approved;
- no fake citations or human approvals are added.

Runtime behavior, production route, rollout gates, preview behavior and legacy
fallback are unchanged. Matrix default remains disabled.

Next safe stages: manual verification of blocked policy/rule sources, source
readiness updates, or real coach/medical/data-quality review before any future
claim extraction.

## 14. Stage: Evidence Claim Blocker Review Intake Pack

The Evidence Claim Blocker Review Intake Pack adds structured review packets for
the 20 current evidence claim blockers. It is metadata-only and sits after the
blocker registry:

EvidenceClaimBlocker -> ReviewIntake -> reviewer questions -> required
artifacts -> allowed outcomes -> future manual review.

Implemented:

- registry: `packages/shared/src/constructor-matrix-evidence-claim-review-intake.ts`;
- verifier: `npm run check:constructor-matrix-evidence-claim-review-intake`;
- Review Package summary: intake count, status counts, review-track counts and
  zero runtime-change count.

The pack does not approve claims, does not extract claims, does not invent
sources, citations, reviewer names or review dates, and does not create numeric
thresholds. It keeps every intake as `humanReviewed=false`.

Manual-verification blockers require manual source verification before
extraction. Full-text/policy blockers require source text or official policy
text before extraction. Human-review blockers require real reviewer decisions
before future extraction. Runtime behavior, production route, rollout gates,
preview behavior and legacy fallback are unchanged. Matrix default remains
disabled.

Next safe stage: actual human review or manual source verification outside code;
only after that can a later extraction pass update evidence claims.

## 15. Stage: Matrix Review Intake Export Pack

The Matrix Review Intake Export Pack creates deterministic reviewer packets from
the Evidence Claim Review Intake registry:

EvidenceClaimReviewIntake -> ReviewIntakeExportPack -> reviewer-specific
Markdown/JSON packets -> real-world manual review.

Implemented:

- export builder: `packages/shared/src/constructor-matrix-review-intake-export.ts`;
- generated docs: `docs/matrix-review-intake-export/`;
- generator: `npm run generate:constructor-matrix-review-intake-export`;
- verifier: `npm run check:constructor-matrix-review-intake-export`;
- Review Package summary for export item counts by audience.

The export pack is metadata-only and for human reviewers. It does not approve
anything, does not extract claims, does not update source readiness, does not
create numeric thresholds and does not change runtime behavior.

Production route, rollout gates, preview behavior and legacy fallback are
unchanged. Matrix default remains disabled.

Next real-world step: manual source verification and reviewer completion
outside code. Next code stage after real review: Source Readiness Update from
Human Review Results.

## 16. Stage: Matrix Desk Source Review + Evidence Claim Candidate Extraction

The Matrix Desk Source Review + Evidence Claim Candidate Extraction stage adds
a metadata-only desk review and candidate layer after SourceLookupIntake:

SourceLookupIntake -> DeskSourceReviewRegistry ->
EvidenceClaimCandidateRegistry -> future human review / source verification /
extraction pass.

Artifacts:

- desk review registry:
  `packages/shared/src/constructor-matrix-desk-source-review.ts`;
- claim candidate registry:
  `packages/shared/src/constructor-matrix-evidence-claim-candidates.ts`;
- verifier:
  `npm run check:constructor-matrix-desk-source-review-and-claim-candidates`;
- Review Package summary fields for desk source review and claim candidate
  counts.

The desk source review is not human review. Claim candidates are not final
evidence claims and are not runtime rules. This stage adds no human approvals,
medical approvals, coach approvals, `reviewedBy`, `reviewedAt`, numeric
thresholds, cutoff values, fake citations or fake source metadata.

Manual-verification-needed sources remain blocked for final extraction. Source
readiness is not updated. Runtime behavior, production route, rollout gates,
preview behavior and legacy fallback are unchanged. Matrix default remains
disabled.

Current metadata shape: 14 desk source reviews cover all source lookup records,
and 15 evidence claim candidates provide candidate-only review context.
`competition_context` remains blocked until future manual/regulatory source
verification.

Next stage: real human/manual source review or Source Readiness Update from
Human Review Results.
