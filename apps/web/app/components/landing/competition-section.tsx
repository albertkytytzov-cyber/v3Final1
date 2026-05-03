import type { LandingCopy } from "./landing-i18n";
import styles from "./landing.module.css";

type CompetitionSectionProps = {
  copy: LandingCopy;
};

export function CompetitionSection({ copy }: CompetitionSectionProps) {
  const competition = copy.competition;

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.sectionHead}>
          <span className={`${styles.eyebrow} ${styles.sectionEyebrow}`}>
            {competition.eyebrow}
          </span>
          <h2 className={styles.sectionTitle}>{competition.title}</h2>
          <p className={styles.sectionIntro}>{competition.intro}</p>
        </div>

        <div className={styles.competitionGrid}>
          {competition.cards.map((card) => (
            <article className={styles.competitionCard} key={card.title}>
              <span>{card.eyebrow}</span>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <div className={styles.competitionTag}>{card.tag}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
