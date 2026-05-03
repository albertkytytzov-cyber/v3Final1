import type { LandingCopy, LandingTone } from "./landing-i18n";
import styles from "./landing.module.css";

const cardClassByTone: Record<LandingTone, string> = {
  green: `${styles.readinessCard} ${styles.readinessCardGreen}`,
  yellow: `${styles.readinessCard} ${styles.readinessCardYellow}`,
  red: `${styles.readinessCard} ${styles.readinessCardRed}`,
};

const pillClassByTone: Record<LandingTone, string> = {
  green: `${styles.statusPill} ${styles.statusGreen}`,
  yellow: `${styles.statusPill} ${styles.statusYellow}`,
  red: `${styles.statusPill} ${styles.statusRed}`,
};

type ReadinessSectionProps = {
  copy: LandingCopy;
};

export function ReadinessSection({ copy }: ReadinessSectionProps) {
  return (
    <section className={styles.section} id="readiness">
      <div className={styles.container}>
        <div className={styles.sectionHead}>
          <span className={`${styles.eyebrow} ${styles.sectionEyebrow}`}>
            {copy.readiness.eyebrow}
          </span>
          <h2 className={styles.sectionTitle}>{copy.readiness.title}</h2>
          <p className={styles.readinessLead}>{copy.readiness.intro}</p>
        </div>

        <div className={styles.readinessGrid}>
          {copy.readiness.statuses.map((status) => (
            <article className={cardClassByTone[status.tone]} key={status.label}>
              <span className={pillClassByTone[status.tone]}>{status.label}</span>
              <h3>{status.title}</h3>
              <ul>
                {status.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
