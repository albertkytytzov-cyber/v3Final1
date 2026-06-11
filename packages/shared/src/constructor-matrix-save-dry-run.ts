import type { ConstructorDraft, ConstructorInput } from "./constructor-core";
import { buildConstructorTemplatePayload } from "./constructor-core";
import type { ConstructorMatrixPreviewResponse } from "./constructor-matrix-preview";
import type { MatrixPilotReadinessResult } from "./constructor-matrix-pilot-readiness";
import type {
  MatrixConstructorRolloutDecision,
  MatrixConstructorRolloutOptions,
} from "./constructor-matrix-rollout";

export type MatrixPrimaryPilotDraftSource =
  | "legacy"
  | "matrix_internal"
  | "matrix_primary_pilot";

export type MatrixPrimaryPilotTemplatePayload = ReturnType<typeof buildConstructorTemplatePayload>;

export type MatrixPrimaryPilotSaveDryRunStatus = "waiting" | "passed" | "blocked";

export type MatrixPrimaryPilotSaveDryRunCheckId =
  | "matrix_primary_pilot_active"
  | "primary_pilot_eligible"
  | "matrix_draft_present"
  | "template_payload_builds"
  | "payload_has_days"
  | "payload_has_sessions"
  | "payload_has_blocks"
  | "no_empty_block_names"
  | "no_empty_block_notes"
  | "exercise_rows_only"
  | "device_link_block_mode"
  | "no_control_column_marker"
  | "no_internal_matrix_fields"
  | "real_save_still_disabled";

export type MatrixPrimaryPilotSaveDryRunCheck = {
  id: MatrixPrimaryPilotSaveDryRunCheckId;
  label: string;
  passed: boolean;
  severity: "info" | "warning" | "error";
  evidence: string[];
};

export type MatrixPrimaryPilotSaveDryRunSummary = {
  name: string;
  dayCount: number;
  sessionCount: number;
  blockCount: number;
  exerciseCount: number;
  topLevelBlockCount: number;
};

export type MatrixPrimaryPilotSaveDryRunResult = {
  generatedFrom: "matrix_primary_pilot_save_dry_run";
  generatedAt: string;
  status: MatrixPrimaryPilotSaveDryRunStatus;
  summary: MatrixPrimaryPilotSaveDryRunSummary | null;
  checks: MatrixPrimaryPilotSaveDryRunCheck[];
  blockers: MatrixPrimaryPilotSaveDryRunCheck[];
  notes: string[];
};

export interface MatrixPrimaryPilotSaveDryRunParams {
  activeDraftSource: MatrixPrimaryPilotDraftSource;
  draft?: ConstructorDraft | null;
  primaryPilotEligible: boolean;
  eligibilityReason?: string | null;
  eligibilityEvidence?: string[];
  templateName?: string;
}

export interface MatrixPrimaryPilotServerSaveDryRunRequest {
  input: ConstructorInput;
  rolloutOptions?: MatrixConstructorRolloutOptions;
  templateName?: string;
}

export interface MatrixPrimaryPilotServerSaveDryRunResponse {
  generatedFrom: "matrix_primary_pilot_server_save_dry_run";
  generatedAt: string;
  dryRun: MatrixPrimaryPilotSaveDryRunResult;
  rolloutDecision: MatrixConstructorRolloutDecision;
  pilotReadiness: MatrixPilotReadinessResult;
  notes: string[];
}

export interface MatrixPrimaryPilotDraftResponse {
  generatedFrom: "matrix_primary_pilot_server_draft";
  generatedAt: string;
  source: "matrix_primary_pilot" | "legacy_fallback";
  reason: string;
  draft: ConstructorDraft;
  templatePayload: MatrixPrimaryPilotTemplatePayload;
  preview: ConstructorMatrixPreviewResponse;
  rolloutDecision: MatrixConstructorRolloutDecision;
  pilotReadiness: MatrixPilotReadinessResult;
  serverSaveDryRun: MatrixPrimaryPilotServerSaveDryRunResponse;
  notes: string[];
}

function check(
  id: MatrixPrimaryPilotSaveDryRunCheckId,
  label: string,
  passed: boolean,
  severity: MatrixPrimaryPilotSaveDryRunCheck["severity"],
  evidence: string[],
): MatrixPrimaryPilotSaveDryRunCheck {
  return {
    id,
    label,
    passed,
    severity,
    evidence,
  };
}

function flattenSessions(payload?: MatrixPrimaryPilotTemplatePayload | null) {
  return payload?.days?.flatMap((day) => day.sessions) ?? [];
}

function flattenBlocks(payload?: MatrixPrimaryPilotTemplatePayload | null) {
  return flattenSessions(payload).flatMap((session) => session.blocks);
}

function flattenExercises(payload?: MatrixPrimaryPilotTemplatePayload | null) {
  return flattenBlocks(payload).flatMap((block) => block.exercises ?? []);
}

function containsControlColumnMarker(payload?: MatrixPrimaryPilotTemplatePayload | null) {
  const candidates = [
    ...(payload?.blocks ?? []),
    ...flattenBlocks(payload),
  ];

  return candidates.some((block) => {
    const name = block.name.trim().toLowerCase();
    const notes = block.notes.trim().toLowerCase();

    return name === "контроль" || name === "control" || notes === "контроль" || notes === "control";
  });
}

function containsInternalMatrixFields(payload?: MatrixPrimaryPilotTemplatePayload | null) {
  if (!payload) {
    return false;
  }

  const serialized = JSON.stringify(payload);
  const forbiddenKeys = [
    "generatedFrom",
    "matrix",
    "rollout",
    "readiness",
    "legacyCards",
    "riskChecks",
    "sourceCompatibilityCards",
    "pilotReadiness",
  ];

  return forbiddenKeys.some((key) => serialized.includes(`"${key}"`));
}

function summarizePayload(payload: MatrixPrimaryPilotTemplatePayload): MatrixPrimaryPilotSaveDryRunSummary {
  const sessions = flattenSessions(payload);
  const blocks = flattenBlocks(payload);

  return {
    name: payload.name,
    dayCount: payload.days?.length ?? 0,
    sessionCount: sessions.length,
    blockCount: blocks.length,
    exerciseCount: flattenExercises(payload).length,
    topLevelBlockCount: payload.blocks.length,
  };
}

export function buildMatrixPrimaryPilotSaveDryRun(
  params: MatrixPrimaryPilotSaveDryRunParams,
): MatrixPrimaryPilotSaveDryRunResult {
  const {
    activeDraftSource,
    draft,
    primaryPilotEligible,
    eligibilityReason,
    eligibilityEvidence,
    templateName,
  } = params;
  const checks: MatrixPrimaryPilotSaveDryRunCheck[] = [];
  let payload: MatrixPrimaryPilotTemplatePayload | null = null;
  let buildError = "";
  const draftGeneratedFrom = (draft as { generatedFrom?: string } | null | undefined)?.generatedFrom;

  checks.push(
    check(
      "matrix_primary_pilot_active",
      "Active source is matrix_primary_pilot",
      activeDraftSource === "matrix_primary_pilot",
      "error",
      [`activeDraftSource=${activeDraftSource}`],
    ),
    check(
      "primary_pilot_eligible",
      "Primary pilot eligibility passed",
      primaryPilotEligible,
      "error",
      [
        `reason=${eligibilityReason ?? "none"}`,
        ...(eligibilityEvidence ?? []),
      ],
    ),
    check(
      "matrix_draft_present",
      "Matrix draft exists",
      Boolean(draft) && draftGeneratedFrom === "matrix",
      "error",
      [`generatedFrom=${draftGeneratedFrom ?? "missing"}`],
    ),
  );

  if (draft) {
    try {
      payload = buildConstructorTemplatePayload(
        draft,
        templateName ?? "PERFORM Matrix Primary Pilot Dry Run",
      );
      checks.push(
        check("template_payload_builds", "Template payload builds", true, "error", [
          `name=${payload.name}`,
        ]),
      );
    } catch (error) {
      buildError = error instanceof Error ? error.message : String(error);
      checks.push(
        check("template_payload_builds", "Template payload builds", false, "error", [buildError]),
      );
    }
  } else {
    checks.push(
      check("template_payload_builds", "Template payload builds", false, "error", [
        "draft is missing",
      ]),
    );
  }

  const sessions = flattenSessions(payload);
  const blocks = flattenBlocks(payload);
  const emptyNames = blocks.filter((block) => !block.name.trim()).length;
  const emptyNotes = blocks.filter((block) => !block.notes.trim()).length;
  const nonExerciseRows = blocks.filter((block) => block.rowKind !== "exercise").length;
  const nonBlockLinkedSessions = sessions.filter(
    (session) => session.deviceLinkMode !== "block" || session.executionMode !== "by_blocks",
  ).length;
  const controlMarkerPresent = containsControlColumnMarker(payload);
  const internalFieldsPresent = containsInternalMatrixFields(payload);

  checks.push(
    check("payload_has_days", "Payload has days", Boolean(payload?.days?.length), "error", [
      `days=${payload?.days?.length ?? 0}`,
    ]),
    check("payload_has_sessions", "Payload has sessions", sessions.length > 0, "error", [
      `sessions=${sessions.length}`,
    ]),
    check("payload_has_blocks", "Payload has blocks", blocks.length > 0, "error", [
      `blocks=${blocks.length}`,
    ]),
    check("no_empty_block_names", "No empty block names", emptyNames === 0, "error", [
      `emptyNames=${emptyNames}`,
    ]),
    check("no_empty_block_notes", "No empty block notes", emptyNotes === 0, "warning", [
      `emptyNotes=${emptyNotes}`,
    ]),
    check("exercise_rows_only", "Only exercise rows", nonExerciseRows === 0, "error", [
      `nonExerciseRows=${nonExerciseRows}`,
    ]),
    check(
      "device_link_block_mode",
      "Sessions use block execution/link mode",
      nonBlockLinkedSessions === 0,
      "error",
      [`nonBlockLinkedSessions=${nonBlockLinkedSessions}`],
    ),
    check("no_control_column_marker", "No old control-column marker", !controlMarkerPresent, "error", [
      `controlMarker=${controlMarkerPresent}`,
    ]),
    check("no_internal_matrix_fields", "No internal matrix fields in payload", !internalFieldsPresent, "error", [
      `internalFields=${internalFieldsPresent}`,
    ]),
    check("real_save_still_disabled", "Real save remains disabled for pilot source", activeDraftSource !== "legacy", "info", [
      "dry-run only; no DB write",
    ]),
  );

  const blockers = checks.filter((item) => !item.passed && item.severity === "error");
  const activeCheck = checks.find((item) => item.id === "matrix_primary_pilot_active");
  const status: MatrixPrimaryPilotSaveDryRunStatus =
    activeCheck?.passed === false ? "waiting" : blockers.length === 0 ? "passed" : "blocked";

  return {
    generatedFrom: "matrix_primary_pilot_save_dry_run",
    generatedAt: new Date().toISOString(),
    status,
    summary: payload ? summarizePayload(payload) : null,
    checks,
    blockers,
    notes: [
      "Dry-run only: this does not save a template, assign a plan, write DB, write storage, send telemetry, or change the production constructor route.",
      "Passing dry-run means the matrix primary pilot draft can produce a structurally compatible PlanTemplatePayload candidate, but real save remains disabled.",
      ...(buildError ? [`Build error: ${buildError}`] : []),
    ],
  };
}
