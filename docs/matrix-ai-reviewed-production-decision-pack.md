# AI-reviewed Matrix production decision pack

Stage: Final Matrix Decision Pack.

This pack summarizes the current production decision after the AI desk review,
safety classification, runtime eligibility, controlled pilot metadata and
save/assign readiness audit stages.

## Decision

Controlled preparation-plan building: allowed only for feature-flagged pilot
users, admins or test cohorts.

Production default: not allowed.

Matrix may support controlled preparation-plan building when all existing pilot
gates pass and server save dry-run evidence is present. It must remain behind
feature flags and must preserve the legacy constructor as the production
default.

## What Matrix can do now

- Build Matrix-controlled preparation-plan candidates for allowed pilot
  scenarios.
- Expose `matrix.aiRuntime` metadata in Matrix drafts.
- Use AI-reviewed runtime eligibility for soft warning metadata.
- Use AI-reviewed runtime eligibility for conservative plan-structure hint
  metadata.
- Keep blocked high-risk items visible as blocked or review-required metadata.
- Produce review export material for coach, medical, data-quality,
  sport-science and product-safety handoff.
- Produce template and assignment payload shapes in dry-run checks.

Current registry counts:

- AI source reviews: 14.
- AI evidence claim candidates: 15.
- Runtime eligibility records: 15.
- Soft-warning eligible records: 6.
- Plan-structure hint eligible records: 1.
- Blocked high-risk records: 8.
- Review-required runtime eligibility records: 15.

## What remains blocked

- Matrix as production default.
- Production route replacement for `/api/v1/plans/constructor/draft`.
- Production save/template/assign path for Matrix output.
- Hard runtime gates.
- Numeric threshold runtime gates.
- Medical decision automation.
- Coach approval automation.
- Weight-cut prescription.
- Hydration diagnosis or intervention.
- Injury-return clearance.
- RED-S diagnosis or decision.
- BFR/KAATSU prescription.
- Unsafe competition-day decisions.

## AI-reviewed only

The following are AI-reviewed metadata only:

- source identity/status review;
- evidence claim candidates;
- safety classification;
- runtime eligibility;
- pilot metadata;
- save/assign dry-run compatibility.

AI desk review is not human review. The current metadata does not contain
medical approval, coach approval, final source readiness approval or final
claim extraction approval.

## Human or manual review still required

Real review is still required for:

- manual source verification;
- source-text acquisition;
- coach review;
- medical review;
- data-quality review;
- sport-science review;
- product-safety review;
- any future readiness update from real review artifacts.

All current AI-reviewed runtime eligibility records remain review-required.

## Runtime use allowed

Allowed runtime use for the controlled pilot:

- docs/review export;
- soft warning metadata;
- conservative plan-structure hint metadata;
- fallback or blocked-state metadata;
- pilot-safe non-medical plan generation when existing rollout and readiness
  gates pass.

Allowed runtime use does not include hard rules, medical decisions or numeric
threshold gates.

## Runtime use forbidden

Forbidden runtime use:

- hard_gate;
- medical_decision;
- numeric_threshold;
- automatic_weight_cut;
- automatic_hydration;
- automatic_injury_return;
- automatic_REDS;
- automatic_BFR_KAATSU;
- Matrix_default_promotion;
- representing AI desk review as human, medical or coach approval.

## Production readiness conclusion

Matrix can be used for controlled preparation-plan building in pilot mode only.

Matrix cannot become the production default from this stage. A separate
production deployment gate is required before any deployment decision, and even
that gate must keep feature flags off by default and high-risk medical
decisions non-automated.

## Guardrail confirmations

- Runtime behavior remains unchanged except for metadata already added to Matrix
  pilot drafts.
- Legacy fallback remains unchanged.
- Production route remains unchanged.
- Rollout gates remain unchanged.
- Preview behavior remains unchanged.
- DB schema remains unchanged.
- No numeric threshold values are approved.
- No fake citations are added.
- No fake human approvals are added.
- No medical or coach approval is represented as human approval.
