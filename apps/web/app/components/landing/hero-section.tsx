import Link from "next/link";
import { DashboardPreview } from "./dashboard-preview";
import { workspaceAuthHref, type LandingCopy, type LandingLanguage } from "./landing-i18n";
import styles from "./landing.module.css";

type HeroSectionProps = {
  copy: LandingCopy;
  language: LandingLanguage;
};

export function HeroSection({ copy, language }: HeroSectionProps) {
  return (
    <section className={styles.hero}>
      <div className={styles.container}>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>{copy.hero.eyebrow}</span>
            <h1 className={styles.heroTitle}>{copy.hero.title}</h1>
            <p className={styles.heroSubtitle}>{copy.hero.subtitle}</p>
            <div className={styles.heroActions}>
              <Link className={styles.heroPrimary} href={workspaceAuthHref("register", language)}>
                {copy.hero.primary}
              </Link>
              <a className={styles.heroSecondary} href="#features">
                {copy.hero.secondary}
              </a>
            </div>
            <div className={styles.heroNote}>{copy.hero.note}</div>
            <div className={styles.heroSignalRow}>
              {copy.hero.chips.map((chip) => (
                <span className={styles.signalChip} key={chip}>
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <div className={styles.heroVisualWrap}>
            <DashboardPreview copy={copy} />
          </div>
        </div>
      </div>
    </section>
  );
}
