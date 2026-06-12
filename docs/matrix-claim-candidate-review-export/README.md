# Matrix Evidence Claim Candidate Review Export Pack

This folder contains deterministic review packets generated from the Evidence Claim Candidate registry.

The pack is metadata-only and candidate-only. It prepares material for coach review, medical review, data-quality review, sport-science review, product-safety review, manual source verification and source text acquisition.

It is not human review, does not approve candidates, does not create final claims, does not update source readiness and does not change runtime behavior.

Reviewers should use these packets outside code to decide what source text, source verification, rationale or review action is still needed. Future code changes can consume real review results only in a separate explicit stage.

Summary:

- evidence claim candidates covered: 15
- export items: 80
- coach review: 15
- medical review: 15
- data-quality review: 11
- sport-science review: 13
- product-safety review: 11
- manual source verification: 0
- source text acquisition: 15
- manual verification still required: 2
- source text still required: 12
- final evidence claim count: 0

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

Files:

- `claim-candidate-review-export.json`: machine-readable export
- `all-candidates.md`: full Markdown export
- `coach-review.md`: coach review packet
- `medical-review.md`: medical review packet
- `data-quality-review.md`: data-quality review packet
- `sport-science-review.md`: sport-science review packet
- `product-safety-review.md`: product-safety review packet
- `manual-source-verification.md`: manual source verification packet
- `source-text-acquisition.md`: source text acquisition packet
