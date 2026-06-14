import { readdir, readFile } from "node:fs/promises";

import {
  buildConstructorMatrixRuntimeEligibilitySummary,
  buildMatrixDrivenAiRuntimeMetadata,
  buildMatrixDrivenConstructorDraft,
  CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY,
} from "@training-platform/shared";
import { loadConstructorPreviewFixtures } from "./constructor-preview-fixture-runner.mjs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readProjectFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

async function collectFiles(path) {
  const root = new URL(`../${path}`, import.meta.url);
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const childPath = `${path}/${entry.name}`;

    if (entry.isDirectory()) {
      files.push(...await collectFiles(childPath));
    } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) {
      files.push(childPath);
    }
  }

  return files;
}

function assertNoFakeHumanReviewText(text, context) {
  const forbidden = [
    /humanReviewed\s*[:=]\s*true/i,
    /\breviewedBy\b/i,
    /\breviewedAt\b/i,
    /\bmedical approved\b/i,
    /\bcoach approved\b/i,
    /\bhuman approved\b/i,
    /\bapproved_for_runtime\b/i,
    /\bapproved for runtime\b/i,
  ];

  for (const pattern of forbidden) {
    assert(!pattern.test(text), `${context} contains forbidden approval text: ${pattern}`);
  }
}

function assertNoNumericThresholdText(text, context) {
  const safeNegation =
    /\b(no|not|without|cannot|unchanged|blocked|forbidden)\b.{0,120}\b(runtime hard gate|hard gate|runtime rule|diagnosis|prescription|medical clearance|numeric threshold|threshold|cutoff|Matrix default|runtime behavior|production default)\b/i;

  if (safeNegation.test(text)) {
    return;
  }

  const forbidden = [
    />=|<=/,
    /\b\d+\s*%/,
    /\b\d+\s*bpm\b/i,
    /\b\d+\s*kg\b/i,
    /\b\d+\s*\/10\b/i,
    /\bexact cutoff\b/i,
    /\bthreshold value approved\b/i,
  ];

  for (const pattern of forbidden) {
    assert(!pattern.test(text), `${context} contains forbidden threshold text: ${pattern}`);
  }
}

const adapterFile = "packages/shared/src/constructor-matrix-adapter.ts";
const disallowedRuntimeFiles = [
  "packages/shared/src/constructor-matrix-plan-builder.ts",
  "packages/shared/src/constructor-matrix-skeleton.ts",
  "packages/shared/src/constructor-matrix-preview.ts",
  "packages/shared/src/constructor-matrix-rollout.ts",
  "packages/shared/src/constructor-matrix-pilot-readiness.ts",
  "packages/shared/src/constructor-matrix-save-dry-run.ts",
  "packages/shared/src/constructor-core.ts",
];

const adapterSource = await readProjectFile(adapterFile);
const adapterAiRuntimeSnippet = adapterSource
  .split("\n")
  .filter((line) =>
    /aiRuntime|AiRuntime|runtimeEligibility|RuntimeEligibility|runtimeHard|highRiskAutomation|numericThreshold|medicalDecision|metadataOnly|humanReviewed/i.test(line),
  )
  .join("\n");
assert(
  adapterSource.includes("constructor-matrix-runtime-eligibility"),
  "adapter must import runtime eligibility for metadata integration",
);
assert(adapterSource.includes("aiRuntime"), "adapter must expose matrix.aiRuntime metadata");
assert(adapterSource.includes("metadataOnly: true"), "adapter aiRuntime must be metadata-only");
assert(
  adapterSource.includes("runtimeHardGatesEnabled: false") &&
    adapterSource.includes("highRiskAutomationEnabled: false") &&
    adapterSource.includes("numericThresholdRuntimeGatesEnabled: false") &&
    adapterSource.includes("medicalDecisionAutomationEnabled: false"),
  "adapter aiRuntime must keep high-risk runtime automation disabled",
);
assertNoFakeHumanReviewText(adapterAiRuntimeSnippet, adapterFile);
assertNoNumericThresholdText(adapterAiRuntimeSnippet, adapterFile);

for (const path of disallowedRuntimeFiles) {
  const source = await readProjectFile(path);
  assert(
    !source.includes("constructor-matrix-runtime-eligibility"),
    `${path} must not import runtime eligibility in this limited metadata integration`,
  );
}

for (const directory of ["apps/api", "apps/web", "apps/mobile"]) {
  for (const path of await collectFiles(directory)) {
    const source = await readProjectFile(path);
    assert(
      !source.includes("constructor-matrix-runtime-eligibility") &&
        !source.includes("aiRuntime"),
      `${path} must not consume AI runtime metadata in API/UI/mobile behavior`,
    );
  }
}

const summary = buildConstructorMatrixRuntimeEligibilitySummary();
const metadata = buildMatrixDrivenAiRuntimeMetadata();
const fixture = loadConstructorPreviewFixtures()[0];
const draft = buildMatrixDrivenConstructorDraft(fixture.input);

assert(draft.generatedFrom === "matrix", "matrix draft must still be generated from matrix");
assert(draft.matrix.aiRuntime.metadataOnly === true, "matrix.aiRuntime must be metadata-only");
assert(
  draft.matrix.aiRuntime.summary.runtimeEligibilityCount === summary.runtimeEligibilityCount,
  "draft aiRuntime summary must match runtime eligibility summary",
);
assert(
  draft.matrix.aiRuntime.softWarningEligibilityIds.length === summary.softWarningEligibleCount,
  "soft warning eligibility ids must match summary",
);
assert(
  draft.matrix.aiRuntime.planStructureHintEligibilityIds.length ===
    summary.planStructureHintEligibleCount,
  "plan-structure eligibility ids must match summary",
);
assert(
  draft.matrix.aiRuntime.blockedHighRiskEligibilityIds.length === summary.blockedHighRiskCount,
  "blocked high-risk eligibility ids must match summary",
);
assert(
  draft.matrix.aiRuntime.reviewRequiredEligibilityIds.length ===
    CONSTRUCTOR_MATRIX_RUNTIME_ELIGIBILITY.length,
  "every AI runtime eligibility item must remain review-required",
);
assert(draft.matrix.aiRuntime.runtimeHardGatesEnabled === false, "runtime hard gates must stay disabled");
assert(draft.matrix.aiRuntime.highRiskAutomationEnabled === false, "high-risk automation must stay disabled");
assert(
  draft.matrix.aiRuntime.numericThresholdRuntimeGatesEnabled === false,
  "numeric threshold gates must stay disabled",
);
assert(
  draft.matrix.aiRuntime.medicalDecisionAutomationEnabled === false,
  "medical decision automation must stay disabled",
);
assert(draft.matrix.aiRuntime.humanReviewed === false, "aiRuntime must not imply human review");
assert(metadata.summary.runtimeEligibilityCount === summary.runtimeEligibilityCount, "metadata helper summary mismatch");

for (const flag of draft.riskFlags) {
  assert(!/ai|runtime_eligibility/i.test(`${flag.code} ${flag.message}`), "AI runtime metadata must not create top-level risk flags");
}

console.log(JSON.stringify({
  ok: true,
  fixtureId: fixture.id,
  runtimeEligibilityCount: summary.runtimeEligibilityCount,
  softWarningEligibilityCount: draft.matrix.aiRuntime.softWarningEligibilityIds.length,
  planStructureHintEligibilityCount: draft.matrix.aiRuntime.planStructureHintEligibilityIds.length,
  blockedHighRiskEligibilityCount: draft.matrix.aiRuntime.blockedHighRiskEligibilityIds.length,
  reviewRequiredEligibilityCount: draft.matrix.aiRuntime.reviewRequiredEligibilityIds.length,
  runtimeHardGatesEnabled: draft.matrix.aiRuntime.runtimeHardGatesEnabled,
  highRiskAutomationEnabled: draft.matrix.aiRuntime.highRiskAutomationEnabled,
  numericThresholdRuntimeGatesEnabled: draft.matrix.aiRuntime.numericThresholdRuntimeGatesEnabled,
  medicalDecisionAutomationEnabled: draft.matrix.aiRuntime.medicalDecisionAutomationEnabled,
  humanReviewed: draft.matrix.aiRuntime.humanReviewed,
}, null, 2));
