import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const rolloutDoc = await readFile(
  new URL("../docs/constructor-matrix-production-rollout.md", import.meta.url),
  "utf8",
);

const requiredSections = [
  "# Matrix Constructor Controlled Pilot Rollout",
  "## Required flags",
  "## Pre-deploy checks",
  "## Production deploy",
  "## Flag-off smoke",
  "## Flag-on internal smoke",
  "## Rollback smoke",
  "## Go/no-go decision",
];

for (const section of requiredSections) {
  assert(rolloutDoc.includes(section), `Rollout checklist missing section: ${section}`);
}

const requiredTokens = [
  "NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI=true",
  "NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT=true",
  "npm run build --workspace @training-platform/shared",
  "npm run build --workspace @training-platform/api",
  "npm run build --workspace @training-platform/web",
  "npm run check:constructor-core",
  "npm run check:constructor-matrix-ui-gates",
  "npm run check:constructor-matrix-review-export",
  "npm run check",
  "git diff --check",
  "bash scripts/update.sh",
  "curl -fsS https://185.195.185.67.sslip.io/api/v1/health",
  "docker compose ps",
  "save/template/assign",
  "matrix_primary_pilot",
  "matrix_internal",
  "D-3",
  "travel",
  "weigh-in",
  "Copy review summary",
  "Copy review JSON",
  "production `/api/v1/plans/constructor/draft` remains legacy-backed",
  "review export leaks identity/raw ids",
];

for (const token of requiredTokens) {
  assert(rolloutDoc.includes(token), `Rollout checklist missing required token: ${token}`);
}

const flagOffIndex = rolloutDoc.indexOf("## Flag-off smoke");
const flagOnIndex = rolloutDoc.indexOf("## Flag-on internal smoke");
const rollbackIndex = rolloutDoc.indexOf("## Rollback smoke");

assert(flagOffIndex < flagOnIndex, "Flag-off smoke must be documented before flag-on smoke");
assert(flagOnIndex < rollbackIndex, "Rollback smoke must be documented after flag-on smoke");

console.log(
  JSON.stringify(
    {
      status: "ok",
      checklist: "docs/constructor-matrix-production-rollout.md",
      sections: requiredSections.length,
      tokens: requiredTokens.length,
    },
    null,
    2,
  ),
);
