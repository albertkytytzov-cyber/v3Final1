export interface MobileRuntimeConfig {
  apiBaseUrl: string;
}

declare global {
  interface Window {
    __PERFORM_MOBILE_CONFIG__?: Partial<MobileRuntimeConfig>;
  }
}

export function normalizeApiBaseUrl(value: string) {
  const normalized = value.trim().replace(/\/+$/, "");

  if (!normalized) {
    return "";
  }

  return normalized.endsWith("/api/v1") ? normalized : `${normalized}/api/v1`;
}

export function readRuntimeConfig(): MobileRuntimeConfig {
  return {
    apiBaseUrl: normalizeApiBaseUrl(window.__PERFORM_MOBILE_CONFIG__?.apiBaseUrl ?? ""),
  };
}
