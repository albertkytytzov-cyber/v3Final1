import { access, readFile } from "node:fs/promises";

import {
  CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES,
  CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY,
  CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES,
} from "@training-platform/shared";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fileExists(path) {
  await access(new URL(`../${path}`, import.meta.url));
}

async function readProjectFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const evidenceIds = new Set(CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY.map((item) => item.id));
const dataDependencyIds = new Set(CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES.map((item) => item.id));
const candidateIds = new Set(CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES.map((item) => item.id));
const minimumCandidateCount = 16;
const requiredAreas = new Set([
  "weight_cut",
  "hydration",
  "readiness",
  "wearable_data",
  "sleep",
  "rhr",
  "hrv",
  "pain",
  "injury",
  "female_context",
  "youth_context",
  "travel_fatigue",
  "competition_context",
  "contact_load",
  "lmv",
  "taper",
]);
const requiredCandidateIds = new Set([
  "acute_body_mass_loss_candidate",
  "weight_descent_rate_candidate",
  "hydration_status_review_trigger_candidate",
  "sauna_heat_exposure_review_candidate",
  "sleep_low_confidence_candidate",
  "rhr_deviation_candidate",
  "hrv_trend_candidate",
  "wearable_data_quality_candidate",
  "multi_signal_readiness_candidate",
  "pain_unknown_location_candidate",
  "pain_severity_threshold_candidate",
  "injury_return_to_training_candidate",
  "female_symptom_context_candidate",
  "reds_risk_review_candidate",
  "youth_high_load_progression_candidate",
  "youth_weight_cut_block_candidate",
  "travel_fatigue_load_ceiling_candidate",
  "competition_day_no_development_candidate",
  "contact_load_exposure_candidate",
  "control_bouts_recovery_window_candidate",
  "lmv_legs_recovery_window_candidate",
  "lmv_near_main_start_role_candidate",
  "taper_high_volume_sfp_candidate",
  "hidden_glycolytic_load_close_start_candidate",
]);
const allowedAreas = new Set([
  ...requiredAreas,
  "soreness",
]);
const allowedKinds = new Set([
  "upper_bound",
  "lower_bound",
  "rate_of_change",
  "trend_deviation",
  "composite_score",
  "categorical_gate",
  "data_quality_gate",
  "time_window",
  "recovery_window",
  "contact_exposure_window",
  "review_trigger",
]);
const allowedRuntimeUse = new Set([
  "none",
  "documentation_only",
  "review_export_only",
  "risk_warning_candidate",
  "future_soft_gate_candidate",
  "future_hard_gate_candidate",
]);
const allowedMissingDataBehaviors = new Set([
  "fail_closed",
  "fail_soft",
  "require_coach_confirmation",
  "require_medical_confirmation",
  "use_low_risk_replacement",
  "advisory_only",
]);
const allowedStatuses = new Set([
  "draft",
  "needs_evidence",
  "needs_coach_review",
  "needs_medical_review",
  "approved_for_docs_only",
  "approved_for_warning_candidate",
  "blocked_for_runtime",
  "do_not_automate",
]);
const allowedReviewRequirements = new Set([
  "coach_review",
  "medical_review",
  "sport_science_review",
  "data_quality_review",
  "product_safety_review",
]);
const allowedFutureTargetLayers = new Set([
  "pilot_readiness",
  "block_eligibility",
  "volume_allocator",
  "risk_check",
  "explanation_builder",
  "review_export",
  "rollout_gate",
]);
const highRiskAreas = new Set([
  "weight_cut",
  "hydration",
  "pain",
  "injury",
  "female_context",
  "youth_context",
  "wearable_data",
  "lmv",
  "contact_load",
  "taper",
]);
const medicalOnlyRuntimeAreas = new Set([
  "pain",
  "injury",
  "female_context",
]);
const runtimeDecisionFiles = [
  "packages/shared/src/constructor-matrix-plan-builder.ts",
  "packages/shared/src/constructor-matrix-skeleton.ts",
  "packages/shared/src/constructor-matrix-preview.ts",
  "packages/shared/src/constructor-matrix-rollout.ts",
  "packages/shared/src/constructor-matrix-pilot-readiness.ts",
  "packages/shared/src/constructor-matrix-save-dry-run.ts",
  "packages/shared/src/constructor-core.ts",
  "packages/shared/src/constructor-matrix-adapter.ts",
];

function collectRequiredText(item) {
  return [
    item.title,
    item.whyNeeded,
    item.candidateStatement,
    ...item.limitations,
    ...item.forbiddenRuntimeUseNow,
  ];
}

function isAllowedNoThresholdSentence(text) {
  return /\b(no|without|not|нет|без)\b.{0,64}\b(numeric threshold|numeric thresholds|threshold value|threshold values|threshold|thresholds|cutoff|cutoffs|hard rule|hard gate|fixed recovery timing)\b/i.test(text);
}

function hasForbiddenThresholdText(text) {
  if (/\bthreshold candidate\b/i.test(text) || /\bcandidate threshold\b/i.test(text)) {
    return false;
  }

  if (isAllowedNoThresholdSentence(text)) {
    return false;
  }

  return (
    />=|<=|>|</.test(text) ||
    /[0-9]+\s*(%|kg|кг|bpm|уд\/мин|hours?|hrs|час)/i.test(text) ||
    /\b[0-9]+\/10\b/i.test(text) ||
    /\b(cutoff|threshold value|score cutoff|kg limit|bpm)\b/i.test(text)
  );
}

await fileExists("packages/shared/src/constructor-matrix-threshold-candidates.ts");

assert(
  CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES.length > 0,
  "CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES must not be empty",
);
assert(
  CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES.length >= minimumCandidateCount,
  `CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES must include at least ${minimumCandidateCount} candidates`,
);
assert(
  candidateIds.size === CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES.length,
  "Threshold candidate registry must not contain duplicate ids",
);

for (const id of requiredCandidateIds) {
  assert(candidateIds.has(id), `Missing required threshold candidate id: ${id}`);
}

const coveredAreas = new Set();
const proposedRuntimeUse = new Set();
const statuses = new Set();
const usedEvidenceDependencyIds = new Set();
const usedDataDependencyIds = new Set();

for (const item of CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES) {
  assert(/^[a-z0-9_]+$/.test(item.id), `Threshold candidate id must be snake_case: ${item.id}`);
  assert(item.candidateOnly === true, `${item.id} must be candidateOnly=true`);
  assert(allowedAreas.has(item.area), `${item.id} has unsupported area: ${item.area}`);
  assert(allowedKinds.has(item.kind), `${item.id} has unsupported kind: ${item.kind}`);
  assert(typeof item.title === "string" && item.title.trim().length > 0, `${item.id} must have title`);
  assert(typeof item.whyNeeded === "string" && item.whyNeeded.trim().length > 0, `${item.id} must have whyNeeded`);
  assert(
    typeof item.candidateStatement === "string" && item.candidateStatement.trim().length > 0,
    `${item.id} must have candidateStatement`,
  );
  assert(Array.isArray(item.evidenceDependencyIds) && item.evidenceDependencyIds.length > 0, `${item.id} must have evidenceDependencyIds`);
  assert(Array.isArray(item.dataDependencyIds) && item.dataDependencyIds.length > 0, `${item.id} must have dataDependencyIds`);
  assert(Array.isArray(item.requiredFields) && item.requiredFields.length > 0, `${item.id} must have requiredFields`);
  assert(
    allowedMissingDataBehaviors.has(item.missingDataBehavior),
    `${item.id} has unsupported missingDataBehavior: ${item.missingDataBehavior}`,
  );
  assert(allowedRuntimeUse.has(item.proposedRuntimeUse), `${item.id} has unsupported proposedRuntimeUse: ${item.proposedRuntimeUse}`);
  assert(allowedStatuses.has(item.status), `${item.id} has unsupported status: ${item.status}`);
  assert(Array.isArray(item.reviewRequired) && item.reviewRequired.length > 0, `${item.id} must have reviewRequired`);
  assert(Array.isArray(item.limitations) && item.limitations.length > 0, `${item.id} must have limitations`);
  assert(Array.isArray(item.forbiddenRuntimeUseNow) && item.forbiddenRuntimeUseNow.length > 0, `${item.id} must have forbiddenRuntimeUseNow`);
  assert(Array.isArray(item.futureTargetLayers) && item.futureTargetLayers.length > 0, `${item.id} must have futureTargetLayers`);
  assert(item.fixtureImpact, `${item.id} must have fixtureImpact`);
  assert(item.fixtureImpact.runtimeChangeAllowedNow === false, `${item.id} must not allow runtime changes now`);
  assert(typeof item.fixtureImpact.shouldCreateFutureFixture === "boolean", `${item.id} must declare shouldCreateFutureFixture`);
  assert(
    Array.isArray(item.fixtureImpact.affectedFixtureAreas),
    `${item.id} must declare affectedFixtureAreas`,
  );
  assert(item.status !== "approved_for_hard_rule", `${item.id} must not be approved for hard rule`);

  for (const review of item.reviewRequired) {
    assert(allowedReviewRequirements.has(review), `${item.id} has unsupported review requirement: ${review}`);
  }

  for (const layer of item.futureTargetLayers) {
    assert(allowedFutureTargetLayers.has(layer), `${item.id} has unsupported future target layer: ${layer}`);
  }

  for (const dataDependencyId of item.dataDependencyIds) {
    assert(
      dataDependencyIds.has(dataDependencyId),
      `${item.id} references unknown data dependency: ${dataDependencyId}`,
    );
    usedDataDependencyIds.add(dataDependencyId);
  }

  for (const evidenceId of item.evidenceDependencyIds) {
    assert(
      evidenceIds.has(evidenceId),
      `${item.id} references unknown evidence dependency: ${evidenceId}`,
    );
    usedEvidenceDependencyIds.add(evidenceId);
  }

  for (const text of collectRequiredText(item)) {
    assert(!hasForbiddenThresholdText(text), `${item.id} must not define numeric threshold text: ${text}`);
  }

  if (item.proposedRuntimeUse === "future_hard_gate_candidate") {
    assert(
      ["needs_medical_review", "needs_coach_review", "blocked_for_runtime", "draft"].includes(item.status),
      `${item.id} cannot be a future hard-gate candidate with status ${item.status}`,
    );
  }

  if (highRiskAreas.has(item.area)) {
    assert(item.reviewRequired.length > 0, `${item.id} high-risk candidate needs review metadata`);
  }

  if (item.area === "weight_cut" || item.area === "hydration") {
    assert(
      item.proposedRuntimeUse !== "future_hard_gate_candidate",
      `${item.id} weight/hydration candidate cannot propose future hard gate now`,
    );
    if (item.status === "approved_for_warning_candidate") {
      assert(
        item.reviewRequired.includes("medical_review") &&
          item.reviewRequired.includes("coach_review"),
        `${item.id} warning candidate needs medical and coach review`,
      );
    }
  }

  if (
    medicalOnlyRuntimeAreas.has(item.area) ||
    item.id.includes("reds") ||
    item.id.includes("injury") ||
    item.id.includes("pain")
  ) {
    assert(
      ["documentation_only", "review_export_only"].includes(item.proposedRuntimeUse),
      `${item.id} injury/pain/RED-S candidate cannot propose runtime use: ${item.proposedRuntimeUse}`,
    );
    assert(
      item.status !== "approved_for_warning_candidate",
      `${item.id} injury/pain/RED-S candidate cannot be approved for runtime warning`,
    );
  }

  coveredAreas.add(item.area);
  proposedRuntimeUse.add(item.proposedRuntimeUse);
  statuses.add(item.status);
}

for (const area of requiredAreas) {
  assert(coveredAreas.has(area), `Missing required threshold candidate area: ${area}`);
}

for (const path of runtimeDecisionFiles) {
  const source = await readProjectFile(path);
  assert(
    !source.includes("constructor-matrix-threshold-candidates") &&
      !source.includes("CONSTRUCTOR_MATRIX_THRESHOLD") &&
      !source.includes("ThresholdCandidate"),
    `${path} must not import or use Threshold Candidate Registry in runtime decisioning`,
  );
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      minimumCandidateCount,
      candidateCount: CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES.length,
      coveredAreas: Array.from(coveredAreas),
      requiredAreas: Array.from(requiredAreas),
      candidateIds: Array.from(candidateIds),
      evidenceDependencyIds: Array.from(usedEvidenceDependencyIds),
      dataDependencyIds: Array.from(usedDataDependencyIds),
      proposedRuntimeUse: Array.from(proposedRuntimeUse),
      statuses: Array.from(statuses),
      numericThresholdsAdded: false,
      runtimeBehaviorChanged: false,
      runtimeImportsAdded: false,
    },
    null,
    2,
  ),
);
