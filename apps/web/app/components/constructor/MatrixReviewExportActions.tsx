"use client";

import { useState } from "react";
import type {
  ConstructorDraft,
  ConstructorMatrixPreviewResponse,
  MatrixConstructorRolloutDecision,
  MatrixPilotReadinessResult,
} from "@training-platform/shared";
import { matrixUiCopyFor } from "../../lib/constructor-matrix-ui";
import { buildConstructorMatrixReviewPackage } from "../../lib/constructor-matrix-review-export";
import type { Language } from "../../lib/i18n";

type MatrixReviewExportActionsProps = {
  contextLabel: string;
  language: Language;
  preview: ConstructorMatrixPreviewResponse | null;
  readiness?: MatrixPilotReadinessResult | null;
  rolloutDecision: MatrixConstructorRolloutDecision | null;
  workspaceDraft?: ConstructorDraft | null;
};

type CopyStatus = {
  tone: "success" | "error";
  message: string;
} | null;

async function writeClipboardText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("Clipboard copy failed.");
  }
}

export function MatrixReviewExportActions({
  contextLabel,
  language,
  preview,
  readiness,
  rolloutDecision,
  workspaceDraft,
}: MatrixReviewExportActionsProps) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>(null);

  async function copyReviewPackage(kind: "markdown" | "json") {
    if (!preview) {
      setCopyStatus({
        tone: "error",
        message: matrixUiCopyFor(language, {
          en: "Run matrix preview first.",
          ru: "Сначала запустите сравнение нового конструктора.",
          bg: "Първо пуснете matrix preview.",
        }),
      });
      return;
    }

    try {
      const reviewPackage = buildConstructorMatrixReviewPackage({
        generatedAt: new Date().toISOString(),
        preview,
        readiness,
        rolloutDecision,
        workspaceDraft,
      });

      await writeClipboardText(kind === "markdown" ? reviewPackage.markdown : reviewPackage.json);
      setCopyStatus({
        tone: "success",
        message:
          kind === "markdown"
            ? matrixUiCopyFor(language, {
                en: "Review summary copied.",
                ru: "Сводка проверки скопирована.",
                bg: "Review summary е копиран.",
              })
            : matrixUiCopyFor(language, {
                en: "Review JSON copied.",
                ru: "Данные проверки скопированы.",
                bg: "Review JSON е копиран.",
              }),
      });
    } catch (error) {
      setCopyStatus({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : matrixUiCopyFor(language, {
                en: "Copy failed.",
                ru: "Не удалось скопировать.",
                bg: "Копирането не успя.",
              }),
      });
    }
  }

  return (
    <div className="constructor-matrix-review-export">
      <div>
        <strong>
          {matrixUiCopyFor(language, {
            en: "Review package",
            ru: "Пакет проверки",
            bg: "Internal review export",
          })}
        </strong>
        <span>{contextLabel}</span>
      </div>
      <div className="constructor-matrix-review-export-actions">
        <button
          className="secondary-button"
          disabled={!preview}
          onClick={() => copyReviewPackage("markdown")}
          type="button"
        >
          {matrixUiCopyFor(language, {
            en: "Copy review summary",
            ru: "Скопировать сводку",
            bg: "Copy review summary",
          })}
        </button>
        <button
          className="secondary-button"
          disabled={!preview}
          onClick={() => copyReviewPackage("json")}
          type="button"
        >
          {matrixUiCopyFor(language, {
            en: "Copy review JSON",
            ru: "Скопировать JSON",
            bg: "Copy review JSON",
          })}
        </button>
      </div>
      {copyStatus ? (
        <p className={`constructor-matrix-review-export-status is-${copyStatus.tone}`}>
          {copyStatus.message}
        </p>
      ) : null}
    </div>
  );
}
