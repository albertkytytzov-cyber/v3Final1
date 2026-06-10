"use client";

import type { ActiveConstructorDraftSource } from "../../lib/constructor-matrix-ui";
import { matrixUiCopyFor } from "../../lib/constructor-matrix-ui";
import type { Language } from "../../lib/i18n";

type MatrixInternalDraftBannerProps = {
  activeDraftSource: ActiveConstructorDraftSource;
  language: Language;
  onReturnToLegacyDraft: () => void;
};

export function MatrixInternalDraftBanner({
  activeDraftSource,
  language,
  onReturnToLegacyDraft,
}: MatrixInternalDraftBannerProps) {
  const activeMatrixInternal = activeDraftSource === "matrix_internal";
  const activeMatrixPrimaryPilot = activeDraftSource === "matrix_primary_pilot";

  if (!activeMatrixInternal && !activeMatrixPrimaryPilot) {
    return null;
  }

  return (
    <>
      <div className="constructor-active-draft-source-row">
        <span
          className={`constructor-active-draft-badge ${
            activeMatrixPrimaryPilot ? "is-matrix-pilot" : "is-matrix"
          }`}
        >
          {activeMatrixPrimaryPilot
            ? matrixUiCopyFor(language, {
                en: "matrix_primary_pilot · limited · not default",
                ru: "matrix_primary_pilot · limited · not default",
                bg: "matrix_primary_pilot · limited · not default",
              })
            : matrixUiCopyFor(language, {
                en: "matrix_internal · read-only",
                ru: "matrix_internal · read-only",
                bg: "matrix_internal · read-only",
              })}
        </span>
        <button className="tertiary-button" onClick={onReturnToLegacyDraft} type="button">
          {matrixUiCopyFor(language, {
            en: "Return to legacy draft",
            ru: "Вернуться к legacy draft",
            bg: "Върни legacy draft",
          })}
        </button>
      </div>
      <div className="constructor-active-draft-banner">
        <strong>
          {activeMatrixPrimaryPilot
            ? matrixUiCopyFor(language, {
                en: "Matrix primary pilot draft active",
                ru: "Активен matrix primary pilot draft",
                bg: "Активен matrix primary pilot draft",
              })
            : matrixUiCopyFor(language, {
                en: "Matrix internal draft active",
                ru: "Активен matrix internal draft",
                bg: "Активен matrix internal draft",
              })}
        </strong>
        <p>
          {activeMatrixPrimaryPilot
            ? matrixUiCopyFor(language, {
                en: "This is a limited primary pilot view for an explicitly allowed scenario. It is not the default production path, not saved, and not assigned automatically.",
                ru: "Это limited primary pilot view только для явно разрешённого сценария. Это не default production path, не сохраняется и не назначается автоматически.",
                bg: "Това е limited primary pilot view само за изрично разрешен сценарий. Не е default production path, не се записва и не се назначава автоматично.",
              })
            : matrixUiCopyFor(language, {
                en: "This draft is used only for internal UI review. It is read-only, not saved, not assigned, and the legacy draft is unchanged.",
                ru: "Этот черновик используется только для внутренней UI-проверки. Он read-only, не сохраняется, не назначается, legacy draft не изменён.",
                bg: "Тази чернова е само за вътрешна UI проверка. Read-only е, не се записва, не се назначава и legacy draft не е променен.",
              })}
        </p>
      </div>
    </>
  );
}
