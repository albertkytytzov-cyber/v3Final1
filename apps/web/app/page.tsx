import { LandingPage } from "./components/landing/landing-page";
import { resolveLandingLanguage } from "./components/landing/landing-i18n";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const language = resolveLandingLanguage(resolvedSearchParams);

  return <LandingPage language={language} />;
}
