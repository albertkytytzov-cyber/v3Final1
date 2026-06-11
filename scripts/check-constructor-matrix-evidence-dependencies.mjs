import { access } from "node:fs/promises";

import {
  buildMatrixDrivenConstructorDraft,
  CONSTRUCTOR_DAY_MATRIX_RULES,
  CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY,
  CONSTRUCTOR_PHASE_MATRIX_RULES,
  CONSTRUCTOR_TRAINING_BLOCK_LIBRARY,
  CONSTRUCTOR_WEEK_MATRIX_RULES,
  getConstructorMatrixEvidenceDependencies,
} from "@training-platform/shared";
import { loadConstructorPreviewFixtures } from "./constructor-preview-fixture-runner.mjs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fileExists(path) {
  await access(new URL(`../${path}`, import.meta.url));
}

function unique(values) {
  return Array.from(new Set(values));
}

const highRiskAreas = new Set([
  "weight_cut",
  "hydration",
  "readiness",
  "wearable_data",
  "travel",
  "weigh_in",
  "competition_day",
  "lmv",
  "bfr_kaatsu",
  "contact_load",
  "taper",
  "injury_pain",
  "female_context",
  "youth_context",
]);

const autoAllowedRuntimeNatures = new Set(["product_rollout_guard", "runtime_safety_guard"]);
const internalEvidenceTypes = new Set(["internal_validation", "coach_school"]);
const internalRuleNatures = new Set(["internal_case_pattern", "coaching_heuristic"]);
const highRiskKeywordPattern = /\b(bfr|kaatsu|red|reds|injury|pain|female|youth|weight|hydration|rwl|sauna|wearable|readiness)\b/i;
const highRiskReviewStatusAllowlist = new Set([
  "coach_review_required",
  "medical_review_required",
  "blocked_for_default",
  "audit_only",
  "approved_for_internal_pilot",
  "approved_for_soft_rule",
]);
const genericEvidenceIds = new Set([
  "perform_evidence_matrix",
  "general_evidence",
  "evidence_matrix",
  "generic_science_basis",
  "perform_general_science",
]);

function itemHasHighRiskArea(item) {
  return item.riskAreas.some((area) => highRiskAreas.has(area));
}

function hasSpecificLimitation(item) {
  return item.limitations.some((text) => {
    const normalized = text.trim();

    return normalized.length >= 32 && /\b(not|no|must|should|needs?|required|requires?|cannot|without|unless|треб|нельзя|нужн)\b/i.test(normalized);
  });
}

function validateRegistryMetadata(item) {
  assert(Array.isArray(item.riskAreas) && item.riskAreas.length > 0, `Evidence ${item.id} must have riskAreas`);
  assert(Array.isArray(item.auditRefs), `Evidence ${item.id} must have auditRefs array`);
  assert(item.auditRefs.length > 0, `Evidence ${item.id} must have auditRefs`);
  assert(typeof item.automationReadiness === "string" && item.automationReadiness.length > 0, `Evidence ${item.id} must have automationReadiness`);
  assert(typeof item.reviewStatus === "string" && item.reviewStatus.length > 0, `Evidence ${item.id} must have reviewStatus`);
  assert(typeof item.ruleNature === "string" && item.ruleNature.length > 0, `Evidence ${item.id} must have ruleNature`);

  const highRisk = itemHasHighRiskArea(item);

  if (highRisk) {
    assert(hasSpecificLimitation(item), `${item.id} has high-risk riskAreas and must have explicit limitations`);

    if (item.automationReadiness === "auto_allowed") {
      assert(
        autoAllowedRuntimeNatures.has(item.ruleNature) && item.type !== "direct_training_intervention",
        `${item.id} cannot be auto_allowed for high-risk training evidence without product/runtime guard nature`,
      );
    }
  }

  if (
    highRisk &&
    (internalEvidenceTypes.has(item.type) || internalRuleNatures.has(item.ruleNature))
  ) {
    assert(item.automationReadiness !== "auto_allowed", `${item.id} internal/coach evidence cannot be auto_allowed`);
    assert(item.reviewStatus !== "approved_for_hard_rule", `${item.id} internal/coach evidence cannot become a hard universal rule`);
  }

  if (item.ruleNature === "product_rollout_guard") {
    const combinedText = [item.title, ...item.supports].join(" ");
    assert(item.type !== "direct_training_intervention", `${item.id} product rollout guard cannot be direct intervention evidence`);
    assert(
      !/\b(physiological|training proof|proves adaptation|доказывает трениров|физиолог)\b/i.test(combinedText),
      `${item.id} product rollout guard must not claim physiological/training proof`,
    );
    assert(
      item.limitations.some((text) => /operational|product|safety|rollout|guard/i.test(text)),
      `${item.id} product rollout guard must explain operational/product safety limitations`,
    );
  }

  const keywordText = [
    item.id,
    item.title,
    ...item.riskAreas,
  ].join(" ");

  if (highRiskKeywordPattern.test(keywordText)) {
    assert(item.automationReadiness !== "auto_allowed", `${item.id} high-risk keyword evidence cannot be auto_allowed`);
    assert(
      highRiskReviewStatusAllowlist.has(item.reviewStatus),
      `${item.id} high-risk keyword evidence has unsafe reviewStatus: ${item.reviewStatus}`,
    );
    assert(item.reviewStatus !== "approved_for_hard_rule", `${item.id} high-risk keyword evidence cannot be approved_for_hard_rule`);
  }
}

function validateSpecificEvidence(ids, context) {
  const uniqueIds = unique(ids);
  const hasGeneric = uniqueIds.some((id) => genericEvidenceIds.has(id));
  const hasSpecific = uniqueIds.some((id) => !genericEvidenceIds.has(id));

  assert(!hasGeneric || hasSpecific, `${context} cannot use generic evidence id as the only evidence dependency`);
}

function validateIds(ids, context, registryIds) {
  assert(Array.isArray(ids) && ids.length > 0, `${context} must have evidenceDependencies`);

  for (const id of ids) {
    assert(registryIds.has(id), `${context} references unknown evidence dependency: ${id}`);
  }

  validateSpecificEvidence(ids, context);
}

function flattenMatrixDraftBlocks(matrixDraft) {
  return matrixDraft.matrix.draft.weeks.flatMap((week) =>
    week.days.flatMap((day) =>
      day.sessions.flatMap((session) => session.selectedBlocks),
    ),
  );
}

function flattenMatrixDraftRisks(matrixDraft) {
  return matrixDraft.matrix.draft.weeks.flatMap((week) => [
    ...week.riskChecks,
    ...week.days.flatMap((day) => [
      ...day.riskChecks,
      ...day.sessions.flatMap((session) => session.riskChecks),
    ]),
  ]);
}

const registryIds = new Set(CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY.map((item) => item.id));

assert(
  registryIds.size === CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY.length,
  "Evidence dependency registry must not contain duplicate ids",
);

for (const item of CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY) {
  assert(/^[a-z0-9_]+$/.test(item.id), `Evidence id must be snake_case: ${item.id}`);
  assert(item.title.trim().length > 0, `Evidence ${item.id} must have title`);
  assert(item.sourceDoc.startsWith("docs/"), `Evidence ${item.id} must point to docs/* source`);
  assert(item.supports.length > 0, `Evidence ${item.id} must declare supports`);
  assert(item.limitations.length > 0, `Evidence ${item.id} must declare limitations`);
  validateRegistryMetadata(item);
  await fileExists(item.sourceDoc);
}

for (const rule of CONSTRUCTOR_PHASE_MATRIX_RULES) {
  validateIds(rule.evidenceDependencies, `phase rule ${rule.phase}`, registryIds);
}

for (const rule of CONSTRUCTOR_WEEK_MATRIX_RULES) {
  validateIds(rule.evidenceDependencies, `week rule ${rule.weekType}`, registryIds);
}

for (const rule of CONSTRUCTOR_DAY_MATRIX_RULES) {
  validateIds(rule.evidenceDependencies, `day rule ${rule.dayType}`, registryIds);
}

for (const block of CONSTRUCTOR_TRAINING_BLOCK_LIBRARY) {
  validateIds(block.evidenceDependencies, `training block ${block.type}`, registryIds);
}

function block(type) {
  const found = CONSTRUCTOR_TRAINING_BLOCK_LIBRARY.find((item) => item.type === type);
  assert(found, `Missing training block ${type}`);
  return found;
}

function ruleIncludesEvidence(context, ids, expected) {
  for (const id of expected) {
    assert(ids.includes(id), `${context} must include evidence dependency ${id}`);
  }
}

ruleIncludesEvidence("competition phase", CONSTRUCTOR_PHASE_MATRIX_RULES.find((item) => item.phase === "competition")?.evidenceDependencies ?? [], [
  "europe_pre_competition_plan",
  "periodization_taper_peaking",
  "ncaa_weight_management",
  "acsm_hydration_nutrition",
]);
ruleIncludesEvidence("leg_lmv block", block("leg_lmv").evidenceDependencies, [
  "bfr_kaatsu_local_metabolic",
  "china_bfr_half_squat_wrestlers",
]);
ruleIncludesEvidence("first_action_speed block", block("first_action_speed").evidenceDependencies, [
  "china_ssit_freestyle_wrestlers",
  "europe_pre_competition_plan",
]);
ruleIncludesEvidence("travel block", block("travel").evidenceDependencies, [
  "europe_pre_competition_plan",
  "acsm_hydration_nutrition",
]);
ruleIncludesEvidence("weigh_in block", block("weigh_in").evidenceDependencies, [
  "ncaa_weight_management",
  "acsm_hydration_nutrition",
]);

const highRiskEvidenceIds = [
  "ncaa_weight_management",
  "acsm_hydration_nutrition",
  "japan_rapid_weight_loss_wrestlers",
  "sichuan_weight_reduction_wrestlers",
  "wearable_validity_trend",
  "recovery_monitoring_consensus",
  "europe_pre_competition_plan",
];

for (const item of getConstructorMatrixEvidenceDependencies(highRiskEvidenceIds)) {
  assert(item.limitations.some((text) => text.length >= 24), `${item.id} must have explicit limitations`);
}

const fixtures = loadConstructorPreviewFixtures();
const fixtureSummaries = [];

for (const fixture of fixtures) {
  const matrixDraft = buildMatrixDrivenConstructorDraft(fixture.input);
  const selectedBlocks = flattenMatrixDraftBlocks(matrixDraft);
  const riskChecks = flattenMatrixDraftRisks(matrixDraft);

  assert(selectedBlocks.length > 0, `${fixture.id} must select matrix blocks`);

  for (const selectedBlock of selectedBlocks) {
    validateIds(
      selectedBlock.evidenceDependencies,
      `${fixture.id} selected block ${selectedBlock.blockType}`,
      registryIds,
    );
  }

  for (const riskCheck of riskChecks) {
    validateIds(riskCheck.evidenceDependencies, `${fixture.id} risk ${riskCheck.code}`, registryIds);
  }

  fixtureSummaries.push({
    id: fixture.id,
    selectedBlockTypes: unique(selectedBlocks.map((item) => item.blockType)).length,
    riskChecks: riskChecks.length,
    evidenceIds: unique([
      ...selectedBlocks.flatMap((item) => item.evidenceDependencies),
      ...riskChecks.flatMap((item) => item.evidenceDependencies),
    ]).length,
  });
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      registryCount: CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY.length,
      coverage: {
        phaseRules: CONSTRUCTOR_PHASE_MATRIX_RULES.length,
        weekRules: CONSTRUCTOR_WEEK_MATRIX_RULES.length,
        dayRules: CONSTRUCTOR_DAY_MATRIX_RULES.length,
        trainingBlocks: CONSTRUCTOR_TRAINING_BLOCK_LIBRARY.length,
        fixtures: fixtures.length,
      },
      hardenedMetadata: {
        highRiskAreas: Array.from(highRiskAreas),
        highRiskEvidenceCount: CONSTRUCTOR_MATRIX_EVIDENCE_DEPENDENCY_REGISTRY.filter(itemHasHighRiskArea).length,
        genericOnlyEvidenceGuard: true,
      },
      fixtureSummaries,
    },
    null,
    2,
  ),
);
