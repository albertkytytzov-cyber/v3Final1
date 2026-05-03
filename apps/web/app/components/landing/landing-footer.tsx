import Link from "next/link";
import {
  landingLanguageHref,
  workspaceAuthHref,
  type LandingCopy,
  type LandingLanguage,
} from "./landing-i18n";
import styles from "./landing.module.css";

type LandingFooterProps = {
  copy: LandingCopy;
  language: LandingLanguage;
};

export function LandingFooter({ copy, language }: LandingFooterProps) {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.footerShell}>
          <div className={styles.footerGrid}>
            <Link className={styles.brand} href={landingLanguageHref(language)}>
              <span className={styles.brandMark}>PERFORM</span>
              <span className={styles.brandTagline}>{copy.brandTagline}</span>
            </Link>

            <div className={styles.footerNav}>
              {copy.nav.map((link) => (
                <a className={styles.footerLink} href={link.href} key={link.href}>
                  {link.label}
                </a>
              ))}
              <Link className={styles.footerLink} href={workspaceAuthHref("login", language)}>
                {copy.footer.login}
              </Link>
            </div>
          </div>

          <div className={styles.footerBottom}>
            <p>{copy.footer.copyright}</p>
            <p>{copy.footer.tagline}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
