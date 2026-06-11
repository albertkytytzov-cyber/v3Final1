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
                en: "new constructor · limited use",
                ru: "новый конструктор · ограниченное применение",
                bg: "нов конструктор · ограничена употреба",
              })
            : matrixUiCopyFor(language, {
                en: "new constructor · review only",
                ru: "новый конструктор · только проверка",
                bg: "нов конструктор · само проверка",
              })}
        </span>
        <button className="tertiary-button" onClick={onReturnToLegacyDraft} type="button">
          {matrixUiCopyFor(language, {
            en: "Return to current draft",
            ru: "Вернуться к текущему черновику",
            bg: "Върни текущата чернова",
          })}
        </button>
      </div>
      <div className="constructor-active-draft-banner">
        <strong>
          {activeMatrixPrimaryPilot
            ? matrixUiCopyFor(language, {
                en: "New constructor draft active",
                ru: "Активен черновик нового конструктора",
                bg: "Активна чернова на новия конструктор",
              })
            : matrixUiCopyFor(language, {
                en: "New constructor draft open",
                ru: "Открыт черновик нового конструктора",
                bg: "Отворена чернова на новия конструктор",
              })}
        </strong>
        <p>
          {activeMatrixPrimaryPilot
            ? matrixUiCopyFor(language, {
                en: "This is the working draft for an explicitly allowed scenario. It is not assigned automatically: save it as a template, then review dates and assign it to the athlete.",
                ru: "Это рабочий черновик для явно разрешённого сценария. Он не назначается автоматически: сохраните его как шаблон, затем проверьте даты и назначьте спортсмену.",
                bg: "Това е работна чернова за изрично разрешен сценарий. Не се назначава автоматично: запазете я като шаблон, после проверете датите и я назначете.",
              })
            : matrixUiCopyFor(language, {
                en: "This draft is used only for review. It is read-only, not saved, not assigned, and the current draft is unchanged.",
                ru: "Этот черновик используется только для проверки. Он не сохраняется, не назначается, текущий черновик не изменён.",
                bg: "Тази чернова е само за проверка. Не се записва, не се назначава и текущата чернова не е променена.",
              })}
        </p>
      </div>
    </>
  );
}
