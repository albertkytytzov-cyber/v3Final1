import Link from "next/link";
import { workspaceAuthHref, type LandingCopy, type LandingLanguage } from "./landing-i18n";
import styles from "./landing.module.css";

type FinalCtaProps = {
  copy: LandingCopy;
  language: LandingLanguage;
};

export function FinalCta({ copy, language }: FinalCtaProps) {
  const finalCta = copy.finalCta;

  return (
    <section className={styles.finalCta}>
      <div className={styles.container}>
        <div className={styles.finalCtaPanel}>
          <span className={styles.eyebrow}>{finalCta.eyebrow}</span>
          <h2>{finalCta.title}</h2>
          <p>{finalCta.text}</p>
          <div className={styles.finalCtaActions}>
            <Link className={styles.heroPrimary} href={workspaceAuthHref("register", language)}>
              {finalCta.primary}
            </Link>
            <Link className={styles.heroSecondary} href={workspaceAuthHref("login", language)}>
              {finalCta.secondary}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
