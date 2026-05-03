import { CompetitionSection } from "./competition-section";
import { FeatureSection } from "./feature-section";
import { FinalCta } from "./final-cta";
import { HeroSection } from "./hero-section";
import { LandingFooter } from "./landing-footer";
import { LandingHeader } from "./landing-header";
import { ProductPreview } from "./product-preview";
import { ReadinessSection } from "./readiness-section";
import { RoleCards } from "./role-cards";
import { LANDING_COPY, type LandingLanguage } from "./landing-i18n";
import styles from "./landing.module.css";

type LandingPageProps = {
  language: LandingLanguage;
};

export function LandingPage({ language }: LandingPageProps) {
  const copy = LANDING_COPY[language];

  return (
    <main className={styles.page}>
      <LandingHeader copy={copy} language={language} />
      <HeroSection copy={copy} language={language} />
      <FeatureSection copy={copy} />
      <RoleCards copy={copy} />
      <ReadinessSection copy={copy} />
      <CompetitionSection copy={copy} />
      <ProductPreview copy={copy} />
      <FinalCta copy={copy} language={language} />
      <LandingFooter copy={copy} language={language} />
    </main>
  );
}
