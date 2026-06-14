# Matrix Review Intake Export Pack

This folder contains deterministic review packets generated from the Evidence Claim Review Intake registry.

The pack is metadata-only. It prepares material for manual source verification, source text acquisition, coach review, medical review, data-quality review, sport-science review and product-safety review.

It is not human review, does not approve claims, does not extract evidence claims, does not update source readiness and does not change runtime behavior.

Reviewers should use these packets to decide what source material, rationale or reviewer action is needed outside code. Future code changes can consume real review results only in a separate explicit stage.

Summary:

- intake records covered: 20
- export items: 87
- manual source verification: 2
- source text acquisition: 12
- coach review: 20
- medical review: 11
- data-quality review: 12
- sport-science review: 18
- product-safety review: 12

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

Files:

- `review-intake-export.json`: machine-readable export
- `all-review-items.md`: full Markdown export
- `manual-source-verification.md`: manual source verification packet
- `source-text-acquisition.md`: source text acquisition packet
- `coach-review.md`: coach review packet
- `medical-review.md`: medical review packet
- `data-quality-review.md`: data-quality review packet
- `sport-science-review.md`: sport-science review packet
- `product-safety-review.md`: product-safety review packet

## AI-reviewed pilot metadata note

The controlled Matrix preparation pilot may now include `matrix.aiRuntime`
metadata in Matrix drafts. This metadata is derived from AI desk review,
safety classification and runtime eligibility registries.

It remains review-only support:

- not human review;
- not medical or coach approval;
- not final evidence claim extraction;
- not a numeric threshold or runtime hard gate;
- not a production default;
- high-risk medical decisions remain blocked or review-required.

Review export packets remain the handoff path for coach, medical,
data-quality, sport-science and product-safety review before any future source
readiness or runtime promotion stage.
