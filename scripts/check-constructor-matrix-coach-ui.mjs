import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function projectUrl(path) {
  return new URL(`../${path}`, import.meta.url);
}

async function readProjectFile(path) {
  return readFile(projectUrl(path), "utf8");
}

const viewPath = "apps/web/app/components/constructor/MatrixDraftReadOnlyView.tsx";
const cssPath = "apps/web/app/globals.css";
const pagePath = "apps/web/app/page-client.tsx";
const flagsPath = "apps/web/app/lib/feature-flags.ts";
const uiPath = "apps/web/app/lib/constructor-matrix-ui.ts";
const apiRoutePath = "apps/api/src/api/planning/planning.routes.ts";

for (const path of [viewPath, cssPath, pagePath, flagsPath, uiPath, apiRoutePath]) {
  assert(existsSync(projectUrl(path)), `Expected file ${path}`);
}

const viewSource = await readProjectFile(viewPath);
const cssSource = await readProjectFile(cssPath);
const pageSource = await readProjectFile(pagePath);
const flagsSource = await readProjectFile(flagsPath);
const uiSource = await readProjectFile(uiPath);
const apiSource = await readProjectFile(apiRoutePath);

for (const marker of [
  "blockReviewNotes",
  "block.coachEditable",
  "block.volumeLocked",
  "block.riskFlags",
  "block.evidenceRefs",
  "block.localLoadZones",
  "exercise.notes",
  "matrix-coach-exercise-list",
]) {
  assert(viewSource.includes(marker), `Coach Matrix UI must show ${marker}`);
}

assert(
  cssSource.includes(".matrix-coach-exercise-list"),
  "Coach Matrix UI exercise list styles must exist",
);
assert(
  pageSource.includes("MatrixDraftReadOnlyView"),
  "Matrix draft view must remain wired into the page",
);
assert(
  flagsSource.includes("NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI") &&
    flagsSource.includes("NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT") &&
    flagsSource.includes("NEXT_PUBLIC_MATRIX_CONSTRUCTOR_SAVE_ASSIGN_PILOT"),
  "Matrix UI must remain behind explicit feature flags",
);
assert(
  uiSource.includes("isConstructorDraftSaveAllowed"),
  "Matrix UI helper must keep save/assign gate helper",
);

const routeBlock = apiSource.slice(
  apiSource.indexOf('app.post("/api/v1/plans/constructor/draft"'),
  apiSource.indexOf("\n  app.", apiSource.indexOf('app.post("/api/v1/plans/constructor/draft"') + 1),
);
assert(routeBlock.includes("buildPerformConstructorDraft"), "Production constructor draft route must stay legacy-backed");
assert(!routeBlock.includes("buildMatrixDrivenConstructorDraft"), "Production constructor draft route must not switch to Matrix");

for (const forbidden of [
  "humanReviewed: true",
  "reviewedBy",
  "reviewedAt",
  "medical approved",
  "coach approved",
  "localStorage",
  "sessionStorage",
]) {
  assert(!viewSource.toLowerCase().includes(forbidden.toLowerCase()), `Coach UI must not contain ${forbidden}`);
}

console.log(JSON.stringify({
  ok: true,
  coachFacingPlanInspection: true,
  productionRouteLegacyBacked: true,
  matrixDefaultNotEnabled: true,
}, null, 2));
