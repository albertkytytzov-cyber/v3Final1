import { mkdir, writeFile } from "node:fs/promises";

import {
  buildConstructorMatrixClaimCandidateReviewExportPack,
  renderConstructorMatrixClaimCandidateAudienceMarkdown,
  renderConstructorMatrixClaimCandidateReviewExportMarkdown,
} from "@training-platform/shared";

const exportDir = new URL("../docs/matrix-claim-candidate-review-export/", import.meta.url);

const audienceFiles = {
  coach: "coach-review.md",
  medical: "medical-review.md",
  data_quality: "data-quality-review.md",
  sport_science: "sport-science-review.md",
  product_safety: "product-safety-review.md",
  manual_source_verification: "manual-source-verification.md",
  source_text_acquisition: "source-text-acquisition.md",
};

function readmeMarkdown(pack) {
  return [
    "# Matrix Evidence Claim Candidate Review Export Pack",
    "",
    "This folder contains deterministic review packets generated from the Evidence Claim Candidate registry.",
    "",
    "The pack is metadata-only and candidate-only. It prepares material for coach review, medical review, data-quality review, sport-science review, product-safety review, manual source verification and source text acquisition.",
    "",
    "It is not human review, does not approve candidates, does not create final claims, does not update source readiness and does not change runtime behavior.",
    "",
    "Reviewers should use these packets outside code to decide what source text, source verification, rationale or review action is still needed. Future code changes can consume real review results only in a separate explicit stage.",
    "",
    "Summary:",
    "",
    `- evidence claim candidates covered: ${pack.summary.candidateCount}`,
    `- export items: ${pack.summary.exportItemCount}`,
    `- coach review: ${pack.summary.itemsByAudience.coach}`,
    `- medical review: ${pack.summary.itemsByAudience.medical}`,
    `- data-quality review: ${pack.summary.itemsByAudience.data_quality}`,
    `- sport-science review: ${pack.summary.itemsByAudience.sport_science}`,
    `- product-safety review: ${pack.summary.itemsByAudience.product_safety}`,
    `- manual source verification: ${pack.summary.itemsByAudience.manual_source_verification}`,
    `- source text acquisition: ${pack.summary.itemsByAudience.source_text_acquisition}`,
    `- manual verification still required: ${pack.summary.manualVerificationStillRequiredCount}`,
    `- source text still required: ${pack.summary.sourceTextStillRequiredCount}`,
    `- final evidence claim count: ${pack.summary.finalEvidenceClaimCount}`,
    "",
    "Guardrails:",
    "",
    ...pack.guardrails.map((item) => `- ${item}`),
    "",
    "Files:",
    "",
    "- `claim-candidate-review-export.json`: machine-readable export",
    "- `all-candidates.md`: full Markdown export",
    "- `coach-review.md`: coach review packet",
    "- `medical-review.md`: medical review packet",
    "- `data-quality-review.md`: data-quality review packet",
    "- `sport-science-review.md`: sport-science review packet",
    "- `product-safety-review.md`: product-safety review packet",
    "- `manual-source-verification.md`: manual source verification packet",
    "- `source-text-acquisition.md`: source text acquisition packet",
    "",
  ].join("\n");
}

const pack = buildConstructorMatrixClaimCandidateReviewExportPack();

await mkdir(exportDir, { recursive: true });
await writeFile(new URL("README.md", exportDir), readmeMarkdown(pack), "utf8");
await writeFile(
  new URL("claim-candidate-review-export.json", exportDir),
  `${JSON.stringify(pack, null, 2)}\n`,
  "utf8",
);
await writeFile(
  new URL("all-candidates.md", exportDir),
  `${renderConstructorMatrixClaimCandidateReviewExportMarkdown(pack)}\n`,
  "utf8",
);

for (const [audience, fileName] of Object.entries(audienceFiles)) {
  await writeFile(
    new URL(fileName, exportDir),
    `${renderConstructorMatrixClaimCandidateAudienceMarkdown(pack, audience)}\n`,
    "utf8",
  );
}

console.log(
  JSON.stringify(
    {
      ok: true,
      outputDir: "docs/matrix-claim-candidate-review-export",
      exportItemCount: pack.summary.exportItemCount,
      itemsByAudience: pack.summary.itemsByAudience,
      finalEvidenceClaimCount: pack.summary.finalEvidenceClaimCount,
    },
    null,
    2,
  ),
);
