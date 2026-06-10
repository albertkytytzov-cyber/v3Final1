import type { ConstructorDraft } from "@training-platform/shared";
import {
  buildMatrixPrimaryPilotSaveDryRun as buildSharedMatrixPrimaryPilotSaveDryRun,
  type MatrixPrimaryPilotSaveDryRunCheck,
  type MatrixPrimaryPilotSaveDryRunCheckId,
  type MatrixPrimaryPilotSaveDryRunResult,
  type MatrixPrimaryPilotSaveDryRunStatus,
  type MatrixPrimaryPilotSaveDryRunSummary,
} from "@training-platform/shared";
import type { ActiveConstructorDraftSource } from "./constructor-matrix-ui";
import type { MatrixPrimaryPilotEligibility } from "./constructor-matrix-primary-pilot";

export type {
  MatrixPrimaryPilotSaveDryRunCheck,
  MatrixPrimaryPilotSaveDryRunCheckId,
  MatrixPrimaryPilotSaveDryRunResult,
  MatrixPrimaryPilotSaveDryRunStatus,
  MatrixPrimaryPilotSaveDryRunSummary,
};

export function buildMatrixPrimaryPilotSaveDryRun(params: {
  activeDraftSource: ActiveConstructorDraftSource;
  draft?: ConstructorDraft | null;
  eligibility: MatrixPrimaryPilotEligibility;
  templateName?: string;
}): MatrixPrimaryPilotSaveDryRunResult {
  const { activeDraftSource, draft, eligibility, templateName } = params;

  return buildSharedMatrixPrimaryPilotSaveDryRun({
    activeDraftSource,
    draft,
    primaryPilotEligible: eligibility.allowed,
    eligibilityReason: eligibility.reason,
    eligibilityEvidence: eligibility.evidence.map((item) => `${item.key}=${item.value}`),
    templateName,
  });
}
