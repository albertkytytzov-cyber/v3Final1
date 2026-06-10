import { buildConstructorComparisonPreview } from "@training-platform/shared";
import { constructorPreviewFixtures } from "./fixtures/constructor/preview-regression-fixtures.mjs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableJson(value) {
  return JSON.stringify(value);
}

function collectMatrixSelectedBlockTypes(matrixDraft) {
  return new Set(
    matrixDraft.matrix.draft.weeks.flatMap((week) =>
      week.days.flatMap((day) =>
        day.sessions.flatMap((session) =>
          session.selectedBlocks.map((block) => block.blockType),
        ),
      ),
    ),
  );
}

function collectConstructorSessionNames(matrixDraft) {
  return new Set(
    matrixDraft.plan.weeks.flatMap((week) =>
      week.days.flatMap((day) => (day.sessions ?? []).map((session) => session.name)),
    ),
  );
}

function collectRiskCodes(preview) {
  return new Set(preview.matrixDraft.matrix.riskChecks.map((risk) => risk.code));
}

function collectDifferenceCategories(preview) {
  return new Set(preview.comparisonReport.differences.map((difference) => difference.category));
}

function collectDifferenceSeverities(preview) {
  return new Set(preview.comparisonReport.differences.map((difference) => difference.severity));
}

function collectStrings(value, output = []) {
  if (typeof value === "string") {
    output.push(value);
    return output;
  }

  if (!value || typeof value !== "object") {
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, output);
    }

    return output;
  }

  for (const item of Object.values(value)) {
    collectStrings(item, output);
  }

  return output;
}

function collectExplanationText(preview) {
  return collectStrings({
    summary: preview.summary,
    safety: preview.safety,
    warnings: preview.warnings,
    notes: preview.notes,
    matrixDraft: preview.matrixDraft,
    comparisonReport: preview.comparisonReport,
  }).join("\n");
}

function assertEveryAbsent(values, forbidden, fixtureId, label) {
  for (const item of forbidden ?? []) {
    assert(!values.has(item), `[${fixtureId}] Forbidden ${label} found: ${item}`);
  }
}

function assertEveryPresent(values, required, fixtureId, label) {
  for (const item of required ?? []) {
    assert(values.has(item), `[${fixtureId}] Required ${label} missing: ${item}`);
  }
}

function assertAnyGroupsPresent(values, requiredGroups, fixtureId, label) {
  for (const group of requiredGroups ?? []) {
    assert(
      group.some((item) => values.has(item)),
      `[${fixtureId}] Expected at least one ${label} from group: ${group.join(", ")}`,
    );
  }
}

function assertExplanationKeywords(text, keywords, fixtureId) {
  const normalized = text.toLocaleLowerCase();

  for (const keyword of keywords ?? []) {
    assert(
      normalized.includes(String(keyword).toLocaleLowerCase()),
      `[${fixtureId}] Expected explanation keyword missing: ${keyword}`,
    );
  }
}

function assertAllowedDifferenceCategories(categories, allowed, fixtureId) {
  if (!allowed?.length) {
    return;
  }

  const allowedSet = new Set(allowed);

  for (const category of categories) {
    assert(
      allowedSet.has(category),
      `[${fixtureId}] Difference category is not allowed by fixture: ${category}`,
    );
  }
}

function countMatrixSafetyErrors(preview) {
  return (preview.safetyInvariants ?? []).filter(
    (invariant) => !invariant.passed && invariant.severity === "error",
  ).length;
}

export function loadConstructorPreviewFixtures() {
  return constructorPreviewFixtures;
}

export function assertConstructorPreviewFixture(preview, fixture, originalInputSnapshot) {
  const matrixExpectations = fixture.expectations.matrix;
  const comparisonExpectations = fixture.expectations.comparison;
  const blockTypes = collectMatrixSelectedBlockTypes(preview.matrixDraft);
  const riskCodes = collectRiskCodes(preview);
  const explanationText = collectExplanationText(preview);
  const differenceCategories = collectDifferenceCategories(preview);
  const differenceSeverities = collectDifferenceSeverities(preview);
  const sessionNames = collectConstructorSessionNames(preview.matrixDraft);

  assert(
    preview.generatedFrom === "legacy_matrix_comparison_preview",
    `[${fixture.id}] Preview generatedFrom marker is wrong`,
  );
  assert(preview.mode === "comparison_preview", `[${fixture.id}] Preview mode marker is wrong`);
  assert(preview.legacyDraft?.plan?.weeks?.length > 0, `[${fixture.id}] Legacy draft did not build`);
  assert(preview.matrixDraft?.generatedFrom === "matrix", `[${fixture.id}] Matrix draft did not build`);
  assert(preview.comparisonReport?.generatedFrom === "legacy_matrix_comparison", `[${fixture.id}] Comparison report missing`);
  assert(preview.defaultPathUnchanged === true, `[${fixture.id}] Default path changed`);
  assert(stableJson(fixture.input) === originalInputSnapshot, `[${fixture.id}] Preview mutated fixture input`);

  if (comparisonExpectations.legacyDefaultMustRemainUnchanged) {
    assert(
      preview.legacyDefaultGuard?.every((item) => item.passed || item.severity !== "error"),
      `[${fixture.id}] Legacy default guard failed`,
    );
  }

  assert(
    preview.safeToPreview === matrixExpectations.safeToPreview,
    `[${fixture.id}] safeToPreview mismatch: expected ${matrixExpectations.safeToPreview}, got ${preview.safeToPreview}`,
  );

  assertEveryAbsent(
    blockTypes,
    matrixExpectations.forbiddenSelectedBlockTypes,
    fixture.id,
    "matrix block type",
  );
  assertEveryPresent(
    blockTypes,
    matrixExpectations.requiredSelectedBlockTypes,
    fixture.id,
    "matrix block type",
  );
  assertAnyGroupsPresent(
    blockTypes,
    matrixExpectations.requiredAnySelectedBlockTypes,
    fixture.id,
    "matrix block type",
  );
  assertEveryAbsent(riskCodes, matrixExpectations.forbiddenRiskCodes, fixture.id, "matrix risk code");
  assertEveryPresent(riskCodes, matrixExpectations.requiredRiskCodes, fixture.id, "matrix risk code");
  assertExplanationKeywords(explanationText, matrixExpectations.requiredExplanationKeywords, fixture.id);

  assert(
    countMatrixSafetyErrors(preview) <= matrixExpectations.maxErrorCount,
    `[${fixture.id}] Matrix safety errors exceed maxErrorCount`,
  );
  assert(
    preview.summary.errorCount <= matrixExpectations.maxErrorCount,
    `[${fixture.id}] Comparison errors exceed maxErrorCount`,
  );

  if (typeof matrixExpectations.maxWarningCount === "number") {
    assert(
      preview.summary.warningCount <= matrixExpectations.maxWarningCount,
      `[${fixture.id}] Comparison warnings exceed maxWarningCount`,
    );
  }

  assertAllowedDifferenceCategories(
    differenceCategories,
    comparisonExpectations.allowedDifferenceCategories,
    fixture.id,
  );
  assertEveryAbsent(
    differenceSeverities,
    comparisonExpectations.forbiddenDifferenceSeverities,
    fixture.id,
    "difference severity",
  );

  if (matrixExpectations.requireEveningSession) {
    assert(sessionNames.has("ВЕЧЕР"), `[${fixture.id}] Expected at least one evening session`);
  }
}

export function runConstructorPreviewFixture(fixture) {
  const inputBefore = stableJson(fixture.input);
  const preview = buildConstructorComparisonPreview(deepClone(fixture.input), {
    explanationDepth: "detailed",
    includeDrafts: true,
    includeComparisonReport: true,
    includeSafetyDetails: true,
  });

  assertConstructorPreviewFixture(preview, fixture, inputBefore);

  return {
    id: fixture.id,
    safeToPreview: preview.safeToPreview,
    selectedBlockTypes: Array.from(collectMatrixSelectedBlockTypes(preview.matrixDraft)).sort(),
    riskCodes: Array.from(collectRiskCodes(preview)).sort(),
    expectedDifferenceCount: preview.summary.expectedDifferenceCount,
  };
}

export function runConstructorPreviewFixtures(fixtures = loadConstructorPreviewFixtures()) {
  const results = fixtures.map(runConstructorPreviewFixture);

  return {
    status: "ok",
    fixtureCount: fixtures.length,
    fixtureIds: fixtures.map((fixture) => fixture.id),
    results,
  };
}
