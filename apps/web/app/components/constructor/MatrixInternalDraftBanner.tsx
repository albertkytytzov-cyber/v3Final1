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
  if (activeDraftSource !== "matrix_internal") {
    return null;
  }

  return (
    <>
      <div className="constructor-active-draft-source-row">
        <span className="constructor-active-draft-badge is-matrix">
          {matrixUiCopyFor(language, {
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
          {matrixUiCopyFor(language, {
            en: "Matrix internal draft active",
            ru: "Активен matrix internal draft",
            bg: "Активен matrix internal draft",
          })}
        </strong>
        <p>
          {matrixUiCopyFor(language, {
            en: "This draft is used only for internal UI review. It is read-only, not saved, not assigned, and the legacy draft is unchanged.",
            ru: "Этот черновик используется только для внутренней UI-проверки. Он read-only, не сохраняется, не назначается, legacy draft не изменён.",
            bg: "Тази чернова е само за вътрешна UI проверка. Read-only е, не се записва, не се назначава и legacy draft не е променен.",
          })}
        </p>
      </div>
    </>
  );
}
