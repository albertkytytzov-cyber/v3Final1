import type { LandingCopy } from "./landing-i18n";
import styles from "./landing.module.css";

type RoleCardsProps = {
  copy: LandingCopy;
};

export function RoleCards({ copy }: RoleCardsProps) {
  const roles = copy.roles;

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.sectionHead}>
          <span className={`${styles.eyebrow} ${styles.sectionEyebrow}`}>{roles.eyebrow}</span>
          <h2 className={styles.sectionTitle}>{roles.title}</h2>
          <p className={styles.sectionIntro}>{roles.intro}</p>
        </div>

        <div className={styles.roleGrid}>
          {roles.cards.map((card) => (
            <article className={styles.roleCard} id={card.id} key={card.id}>
              <span>{card.eyebrow}</span>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <ul>
                {card.points.map((point) => (
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
