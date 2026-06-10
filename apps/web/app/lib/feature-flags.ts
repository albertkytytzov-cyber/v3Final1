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
  return {
    internalMatrixConstructorUi: isExplicitlyEnabled(
      process.env.NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI,
    ),
  };
}

export function isInternalMatrixConstructorUiEnabled() {
  return getConstructorMatrixUiFlags().internalMatrixConstructorUi;
}
