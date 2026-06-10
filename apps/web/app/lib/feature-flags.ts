function isExplicitlyEnabled(value?: string) {
  const normalized = value?.trim().toLowerCase();

  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "enabled" ||
    normalized === "on"
  );
}

export function getConstructorMatrixUiFlags() {
  const internalMatrixConstructorUi = isExplicitlyEnabled(
    process.env.NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI,
  );

  return {
    internalMatrixConstructorUi,
    matrixConstructorLimitedPrimaryPilot:
      internalMatrixConstructorUi &&
      isExplicitlyEnabled(process.env.NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT),
  };
}

export function isInternalMatrixConstructorUiEnabled() {
  return getConstructorMatrixUiFlags().internalMatrixConstructorUi;
}

export function isMatrixConstructorLimitedPrimaryPilotEnabled() {
  return getConstructorMatrixUiFlags().matrixConstructorLimitedPrimaryPilot;
}
