import {
  buildMatrixDrivenConstructorDraft,
  buildMatrixPrimaryPilotSaveDryRun,
  decideMatrixConstructorRollout,
  evaluateMatrixPilotReadiness,
} from "@training-platform/shared";
import { constructorPreviewFixtures } from "./fixtures/constructor/preview-regression-fixtures.mjs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const gateModule = await import("../apps/web/app/lib/constructor-matrix-primary-pilot-server-gate.ts");
const { canUseMatrixPrimaryPilotWithServerEvidence } = gateModule.default ?? gateModule;

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

function serverResponseForFixture(id) {
  const fixture = fixtureById(id);
  const rolloutDecision = decideMatrixConstructorRollout(fixture.input, rolloutOptions);
  const pilotReadiness = evaluateMatrixPilotReadiness(fixture.input, { rolloutOptions });
  const primaryPilotEligible =
    rolloutDecision.mode === "matrix_allowed_for_primary" &&
    rolloutDecision.matrixPrimaryAllowed &&
    rolloutDecision.blockers.length === 0 &&
    pilotReadiness.status === "ready_for_limited_primary_pilot" &&
    pilotReadiness.blockers.length === 0;
  const matrixDraft = buildMatrixDrivenConstructorDraft(
    fixture.input,
    previewOptions.matrixOptions,
  );
  const dryRun = buildMatrixPrimaryPilotSaveDryRun({
    activeDraftSource: "matrix_primary_pilot",
    draft: matrixDraft,
    primaryPilotEligible,
    templateName: "PERFORM Matrix Primary Pilot Dry Run",
  });

  return {
    generatedFrom: "matrix_primary_pilot_server_save_dry_run",
    generatedAt: new Date("2026-06-10T12:00:00.000Z").toISOString(),
    dryRun,
    rolloutDecision,
    pilotReadiness,
    notes: ["constructor matrix UI gate regression check"],
  };
}

function gateForFixture(id) {
  const serverResult = serverResponseForFixture(id);
  return {
    serverResult,
    gate: canUseMatrixPrimaryPilotWithServerEvidence({
      serverResult,
      localRolloutDecision: serverResult.rolloutDecision,
      localPilotReadiness: serverResult.pilotReadiness,
    }),
  };
}

const cases = [
  {
    id: "far_development_week_d90",
    allowed: true,
    reason: null,
  },
  {
    id: "main_start_d3_final_activation",
    allowed: false,
    reason: "server_dry_run_blocked",
  },
  {
    id: "travel_day",
    allowed: false,
    reason: "server_dry_run_blocked",
  },
  {
    id: "weigh_in_day",
    allowed: false,
    reason: "server_dry_run_blocked",
  },
];

const results = cases.map((testCase) => {
  const { serverResult, gate } = gateForFixture(testCase.id);

  assert(
    gate.allowed === testCase.allowed,
    `${testCase.id}: expected allowed=${testCase.allowed}, got ${gate.allowed}`,
  );
  assert(
    gate.reason === testCase.reason,
    `${testCase.id}: expected reason=${testCase.reason}, got ${gate.reason}`,
  );

  return {
    id: testCase.id,
    allowed: gate.allowed,
    reason: gate.reason,
    dryRun: serverResult.dryRun.status,
    rollout: serverResult.rolloutDecision.mode,
    readiness: serverResult.pilotReadiness.status,
  };
});

const missingGate = canUseMatrixPrimaryPilotWithServerEvidence({ serverResult: null });
assert(!missingGate.allowed, "Missing server dry-run evidence must block primary pilot");
assert(
  missingGate.reason === "server_dry_run_missing",
  `Expected missing server dry-run reason, got ${missingGate.reason}`,
);

const errorServerResult = serverResponseForFixture("far_development_week_d90");
const errorGate = canUseMatrixPrimaryPilotWithServerEvidence({
  serverResult: errorServerResult,
  serverError: "Synthetic server failure",
  localRolloutDecision: errorServerResult.rolloutDecision,
  localPilotReadiness: errorServerResult.pilotReadiness,
});
assert(!errorGate.allowed, "Server dry-run error must block primary pilot");
assert(
  errorGate.reason === "server_dry_run_error",
  `Expected server dry-run error reason, got ${errorGate.reason}`,
);

const mismatchServerResult = serverResponseForFixture("far_development_week_d90");
mismatchServerResult.pilotReadiness = {
  ...mismatchServerResult.pilotReadiness,
  scenario: "post_competition_recovery",
};
const mismatchGate = canUseMatrixPrimaryPilotWithServerEvidence({
  serverResult: mismatchServerResult,
  localRolloutDecision: mismatchServerResult.rolloutDecision,
  localPilotReadiness: mismatchServerResult.pilotReadiness,
});
assert(!mismatchGate.allowed, "Server rollout/readiness mismatch must block primary pilot");
assert(
  mismatchGate.reason === "server_evidence_mismatch",
  `Expected server evidence mismatch reason, got ${mismatchGate.reason}`,
);

console.log(
  JSON.stringify(
    {
      status: "ok",
      cases: results,
      missingGate: {
        allowed: missingGate.allowed,
        reason: missingGate.reason,
      },
      errorGate: {
        allowed: errorGate.allowed,
        reason: errorGate.reason,
      },
      mismatchGate: {
        allowed: mismatchGate.allowed,
        reason: mismatchGate.reason,
      },
    },
    null,
    2,
  ),
);
