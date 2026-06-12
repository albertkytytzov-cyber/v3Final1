import { mkdir, writeFile } from "node:fs/promises";

import {
  buildConstructorMatrixReviewIntakeExportPack,
  renderConstructorMatrixReviewAudienceMarkdown,
  renderConstructorMatrixReviewIntakeExportMarkdown,
} from "@training-platform/shared";

const exportDir = new URL("../docs/matrix-review-intake-export/", import.meta.url);

const audienceFiles = {
  manual_source_verification: "manual-source-verification.md",
  source_text_acquisition: "source-text-acquisition.md",
  coach: "coach-review.md",
  medical: "medical-review.md",
  data_quality: "data-quality-review.md",
  sport_science: "sport-science-review.md",
  product_safety: "product-safety-review.md",
};

function readmeMarkdown(pack) {
  return [
    "# Matrix Review Intake Export Pack",
    "",
    "This folder contains deterministic review packets generated from the Evidence Claim Review Intake registry.",
    "",
    "The pack is metadata-only. It prepares material for manual source verification, source text acquisition, coach review, medical review, data-quality review, sport-science review and product-safety review.",
    "",
    "It is not human review, does not approve claims, does not extract evidence claims, does not update source readiness and does not change runtime behavior.",
    "",
    "Reviewers should use these packets to decide what source material, rationale or reviewer action is needed outside code. Future code changes can consume real review results only in a separate explicit stage.",
    "",
    "Summary:",
    "",
    `- intake records covered: ${pack.summary.intakeCount}`,
    `- export items: ${pack.summary.exportItemCount}`,
    `- manual source verification: ${pack.summary.manualSourceVerificationCount}`,
    `- source text acquisition: ${pack.summary.sourceTextAcquisitionCount}`,
    `- coach review: ${pack.summary.coachReviewCount}`,
    `- medical review: ${pack.summary.medicalReviewCount}`,
    `- data-quality review: ${pack.summary.dataQualityReviewCount}`,
    `- sport-science review: ${pack.summary.sportScienceReviewCount}`,
    `- product-safety review: ${pack.summary.productSafetyReviewCount}`,
    "",
    "Guardrails:",
    "",
    ...pack.guardrails.map((item) => `- ${item}`),
    "",
    "Files:",
    "",
    "- `review-intake-export.json`: machine-readable export",
    "- `all-review-items.md`: full Markdown export",
    "- `manual-source-verification.md`: manual source verification packet",
    "- `source-text-acquisition.md`: source text acquisition packet",
    "- `coach-review.md`: coach review packet",
    "- `medical-review.md`: medical review packet",
    "- `data-quality-review.md`: data-quality review packet",
    "- `sport-science-review.md`: sport-science review packet",
    "- `product-safety-review.md`: product-safety review packet",
    "",
  ].join("\n");
}

const pack = buildConstructorMatrixReviewIntakeExportPack();

await mkdir(exportDir, { recursive: true });
await writeFile(new URL("README.md", exportDir), readmeMarkdown(pack), "utf8");
await writeFile(
  new URL("review-intake-export.json", exportDir),
  `${JSON.stringify(pack, null, 2)}\n`,
  "utf8",
);
await writeFile(
  new URL("all-review-items.md", exportDir),
  `${renderConstructorMatrixReviewIntakeExportMarkdown(pack)}\n`,
  "utf8",
);

for (const [audience, fileName] of Object.entries(audienceFiles)) {
  await writeFile(
    new URL(fileName, exportDir),
    `${renderConstructorMatrixReviewAudienceMarkdown(pack, audience)}\n`,
    "utf8",
  );
}

console.log(
  JSON.stringify(
    {
      ok: true,
      outputDir: "docs/matrix-review-intake-export",
      exportItemCount: pack.summary.exportItemCount,
      itemsByAudience: pack.summary.itemsByAudience,
    },
    null,
    2,
  ),
);
