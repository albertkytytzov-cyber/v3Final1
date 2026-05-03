import { PageClient } from "../page-client";
import type { Language } from "../lib/i18n";
import { resolveWorkspacePreviewState } from "../lib/workspace-preview";

type WorkspacePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveAuthMode(value: string | undefined) {
  return value === "register" || value === "login" ? value : undefined;
}

function resolveLanguage(value: string | undefined): Language {
  return value === "en" || value === "ru" || value === "bg" ? value : "ru";
}

export default async function WorkspacePage({ searchParams }: WorkspacePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialAuthMode = resolveAuthMode(firstValue(resolvedSearchParams?.auth));
  const initialLanguageValue = firstValue(resolvedSearchParams?.language);
  const initialLanguage = resolveLanguage(initialLanguageValue);
  const previewState = initialAuthMode
    ? null
    : resolveWorkspacePreviewState(resolvedSearchParams);

  return (
    <PageClient
      initialAuthMode={initialAuthMode}
      initialGuestAccessOpen={Boolean(initialAuthMode)}
      initialLanguageLocked={Boolean(initialLanguageValue)}
      initialLanguage={initialLanguage}
      initialPreviewState={previewState}
      suppressSessionRestore={Boolean(initialAuthMode)}
    />
  );
}
