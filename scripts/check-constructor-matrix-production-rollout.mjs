import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readProjectFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const rolloutDoc = await readProjectFile("docs/constructor-matrix-production-rollout.md");
const webDockerfile = await readProjectFile("apps/web/Dockerfile");
const dockerCompose = await readProjectFile("docker-compose.yml");
const envExample = await readProjectFile(".env.example");

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
  "npm run check:constructor-matrix-evidence-dependencies",
  "npm run check:constructor-matrix-data-dependencies",
  "npm run check:constructor-matrix-threshold-candidates",
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
  "POST /api/v1/plans/constructor/internal/matrix-primary-pilot-draft",
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

const deploymentSources = [
  ["apps/web/Dockerfile", webDockerfile],
  ["docker-compose.yml", dockerCompose],
  [".env.example", envExample],
];

for (const [path, source] of deploymentSources) {
  for (const flag of [
    "NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI",
    "NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT",
  ]) {
    assert(source.includes(flag), `${path} must wire ${flag}`);
  }
}

assert(
  webDockerfile.includes("ARG NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI=false") &&
    webDockerfile.includes("ARG NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT=false") &&
    webDockerfile.includes("ENV NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI=$NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI") &&
    webDockerfile.includes(
      "ENV NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT=$NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT",
    ),
  "apps/web/Dockerfile must expose matrix flags to the Next.js build stage",
);
assert(
  dockerCompose.includes("args:") &&
    dockerCompose.includes(
      "NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI: ${NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI:-false}",
    ) &&
    dockerCompose.includes(
      "NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT: ${NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT:-false}",
    ),
  "docker-compose.yml must pass matrix flags as web build args with false defaults",
);
assert(
  envExample.includes("NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI=false") &&
    envExample.includes("NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT=false"),
  ".env.example must document matrix pilot flags as false by default",
);

console.log(
  JSON.stringify(
    {
      status: "ok",
      checklist: "docs/constructor-matrix-production-rollout.md",
      sections: requiredSections.length,
      tokens: requiredTokens.length,
      deploymentWiring: {
        dockerfile: true,
        compose: true,
        envExample: true,
      },
    },
    null,
    2,
  ),
);
