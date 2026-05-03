import Link from "next/link";
import {
  LANDING_LANGUAGE_OPTIONS,
  landingLanguageHref,
  workspaceAuthHref,
  type LandingCopy,
  type LandingLanguage,
} from "./landing-i18n";
import styles from "./landing.module.css";

type LandingHeaderProps = {
  copy: LandingCopy;
  language: LandingLanguage;
};

export function LandingHeader({ copy, language }: LandingHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.headerBar}>
          <Link className={styles.brand} href={landingLanguageHref(language)}>
            <span className={styles.brandMark}>PERFORM</span>
            <span className={styles.brandTagline}>{copy.brandTagline}</span>
          </Link>

          <nav className={styles.nav} aria-label={copy.header.ariaLabel}>
            {copy.nav.map((link) => (
              <a className={styles.navLink} href={link.href} key={link.href}>
                {link.label}
              </a>
            ))}
          </nav>

          <div className={styles.headerActions}>
            <div className={styles.languageSwitch} aria-label={copy.languageLabel}>
              {LANDING_LANGUAGE_OPTIONS.map((option) => (
                <Link
                  aria-current={option.value === language ? "true" : undefined}
                  className={`${styles.languageOption} ${
                    option.value === language ? styles.languageOptionActive : ""
                  }`.trim()}
                  href={landingLanguageHref(option.value)}
                  key={option.value}
                  title={option.label}
                >
                  {option.value.toUpperCase()}
                </Link>
              ))}
            </div>
            <Link className={styles.headerGhost} href={workspaceAuthHref("login", language)}>
              {copy.header.login}
            </Link>
            <Link className={styles.headerPrimary} href={workspaceAuthHref("register", language)}>
              {copy.header.register}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
