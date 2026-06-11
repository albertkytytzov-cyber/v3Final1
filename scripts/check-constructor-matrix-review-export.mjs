import {
  buildConstructorMatrixPreviewResponse,
  decideMatrixConstructorRollout,
  evaluateMatrixPilotReadiness,
} from "@training-platform/shared";
import { constructorPreviewFixtures } from "./fixtures/constructor/preview-regression-fixtures.mjs";

const reviewExportModule = await import("../apps/web/app/lib/constructor-matrix-review-export.ts");
const { buildConstructorMatrixReviewPackage } =
  reviewExportModule.default ?? reviewExportModule;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const GENERATED_AT = "2026-06-10T12:00:00.000Z";
const previewOptions = {
  includeDrafts: true,
  includeComparisonReport: true,
  includeSafetyDetails: true,
  includeInfoDifferences: false,
};
const rolloutOptions = { previewOptions };

function fixtureById(id) {
  const fixture = constructorPreviewFixtures.find((item) => item.id === id);
  assert(fixture, `Expected constructor preview fixture ${id}`);
  return fixture;
}

function buildPackageForFixture(id) {
  const fixture = fixtureById(id);
  const preview = buildConstructorMatrixPreviewResponse(fixture.input, previewOptions);
  const rolloutDecision = decideMatrixConstructorRollout(fixture.input, rolloutOptions);
  const readiness = evaluateMatrixPilotReadiness(fixture.input, { rolloutOptions });
  const reviewPackage = buildConstructorMatrixReviewPackage({
    generatedAt: GENERATED_AT,
    preview,
    readiness,
    rolloutDecision,
    workspaceDraft: preview.matrixDraft ?? null,
  });

  return {
    id,
    fixture,
    preview,
    rolloutDecision,
    readiness,
    reviewPackage,
  };
}

function assertNoPrivateData({ fixture, reviewPackage, id }) {
  const serialized = `${reviewPackage.json}\n${reviewPackage.markdown}`;
  const forbiddenValues = [
    fixture.input.athlete.fullName,
    fixture.input.athlete.athleteId,
    fixture.input.state.coachComment,
    fixture.input.seasonStrategy?.season.id,
    fixture.input.seasonStrategy?.targetCompetitionPlan?.id,
    fixture.input.seasonStrategy?.targetCompetitionPlan?.athleteId,
    fixture.input.seasonStrategy?.targetCompetitionPlan?.seasonId,
    fixture.input.seasonStrategy?.targetCompetitionPlan?.competitionId,
    fixture.input.seasonStrategy?.targetCompetition?.id,
  ].filter(Boolean);

  for (const value of forbiddenValues) {
    assert(
      !serialized.includes(value),
      `${id}: review export must not include private/raw fixture value ${value}`,
    );
  }

  assert(!/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(serialized), `${id}: email leaked`);
  assert(
    !/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(
      serialized,
    ),
    `${id}: UUID-like identifier leaked`,
  );
  assert(!/\b(?:\+?\d[\s().-]*){9,}\b/.test(serialized), `${id}: phone-like value leaked`);
  assert(
    reviewPackage.payload.privacy.anonymized === true,
    `${id}: review export must declare anonymized privacy mode`,
  );
}

function assertPackageShape({ id, reviewPackage }) {
  const parsed = JSON.parse(reviewPackage.json);
  assert(parsed.generatedAt === GENERATED_AT, `${id}: generatedAt should be deterministic`);
  assert(
    parsed.generatedFrom === "internal_matrix_constructor_review_export",
    `${id}: generatedFrom should identify internal review export`,
  );
  assert(reviewPackage.markdown.includes("# Internal New Planning Logic Review"), `${id}: markdown title missing`);
  assert(reviewPackage.markdown.includes("## Pilot Readiness"), `${id}: markdown readiness missing`);
  assert(
    reviewPackage.payload.summary.counts.matrix.dayCount > 0,
    `${id}: matrix day count should be present`,
  );
  assert(
    reviewPackage.payload.summary.counts.matrix.sessionCount > 0,
    `${id}: matrix session count should be present`,
  );
  assert(
    reviewPackage.payload.matrixExplanation?.mainDecision,
    `${id}: matrix explanation should include main decision`,
  );
  assert(
    reviewPackage.payload.matrixVsLegacyDifferences.total >= 0,
    `${id}: matrix-vs-legacy difference summary should be present`,
  );
}

function assertFixtureExpectation(result, expectation) {
  const { id, reviewPackage } = result;
  assertPackageShape(result);
  assertNoPrivateData(result);

  assert(
    reviewPackage.payload.rollout.mode === expectation.rolloutMode,
    `${id}: expected rollout ${expectation.rolloutMode}, got ${reviewPackage.payload.rollout.mode}`,
  );
  assert(
    reviewPackage.payload.rollout.scenario === expectation.scenario,
    `${id}: expected scenario ${expectation.scenario}, got ${reviewPackage.payload.rollout.scenario}`,
  );
  assert(
    reviewPackage.payload.pilotReadiness?.status === expectation.readinessStatus,
    `${id}: expected readiness ${expectation.readinessStatus}, got ${reviewPackage.payload.pilotReadiness?.status}`,
  );
  assert(
    reviewPackage.payload.pilotReadiness?.matrixPrimaryAllowed === expectation.matrixPrimaryAllowed,
    `${id}: expected matrixPrimaryAllowed=${expectation.matrixPrimaryAllowed}`,
  );
  if (expectation.recommendedAction) {
    assert(
      reviewPackage.payload.rollout.recommendedAction === expectation.recommendedAction,
      `${id}: expected rollout action ${expectation.recommendedAction}, got ${reviewPackage.payload.rollout.recommendedAction}`,
    );
    assert(
      reviewPackage.payload.pilotReadiness?.recommendedAction === expectation.recommendedAction,
      `${id}: expected readiness action ${expectation.recommendedAction}, got ${reviewPackage.payload.pilotReadiness?.recommendedAction}`,
    );
  }

  for (const blockerCode of expectation.requiredBlockerCodes ?? []) {
    const blockerCodes = new Set([
      ...reviewPackage.payload.rollout.blockers.map((blocker) => blocker.code),
      ...(reviewPackage.payload.pilotReadiness?.blockerCodes ?? []),
    ]);
    assert(blockerCodes.has(blockerCode), `${id}: expected blocker ${blockerCode}`);
  }

  return {
    id,
    rollout: reviewPackage.payload.rollout.mode,
    scenario: reviewPackage.payload.rollout.scenario,
    recommendedAction: reviewPackage.payload.rollout.recommendedAction,
    readiness: reviewPackage.payload.pilotReadiness?.status,
    matrixPrimaryAllowed: reviewPackage.payload.pilotReadiness?.matrixPrimaryAllowed,
    blockers: [
      ...reviewPackage.payload.rollout.blockers.map((blocker) => blocker.code),
      ...(reviewPackage.payload.pilotReadiness?.blockerCodes ?? []),
    ].filter(Boolean),
    counts: reviewPackage.payload.summary.counts.matrix,
    anonymized: reviewPackage.payload.privacy.anonymized,
  };
}

const expectations = [
  {
    id: "far_development_week_d90",
    scenario: "far_development_week",
    rolloutMode: "matrix_allowed_for_primary",
    readinessStatus: "ready_for_limited_primary_pilot",
    matrixPrimaryAllowed: true,
  },
  {
    id: "main_start_d3_final_activation",
    scenario: "main_start_d3_preview",
    rolloutMode: "preview_only",
    readinessStatus: "preview_only",
    matrixPrimaryAllowed: false,
    requiredBlockerCodes: ["main_start_too_close_for_primary"],
  },
  {
    id: "travel_day",
    scenario: "travel_day",
    rolloutMode: "matrix_allowed_for_internal",
    readinessStatus: "ready_for_internal_pilot",
    matrixPrimaryAllowed: false,
    recommendedAction: "allow_internal_matrix_primary",
  },
  {
    id: "weigh_in_day",
    scenario: "weigh_in_day",
    rolloutMode: "matrix_allowed_for_internal",
    readinessStatus: "ready_for_internal_pilot",
    matrixPrimaryAllowed: false,
    recommendedAction: "allow_internal_matrix_primary",
  },
];

const results = expectations.map((expectation) =>
  assertFixtureExpectation(buildPackageForFixture(expectation.id), expectation),
);

console.log(
  JSON.stringify(
    {
      status: "ok",
      generatedAt: GENERATED_AT,
      reviewExports: results,
    },
    null,
    2,
  ),
);
