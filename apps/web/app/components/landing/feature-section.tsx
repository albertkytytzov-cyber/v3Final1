import type { LandingCopy } from "./landing-i18n";
import styles from "./landing.module.css";

function FeatureVisual({ visual }: { visual: string }) {
  if (visual === "calendar") {
    return (
      <div className={styles.calendarStrip} aria-hidden="true">
        {Array.from({ length: 7 }, (_, index) => (
          <span className={styles.calendarDay} key={index} />
        ))}
      </div>
    );
  }

  if (visual === "bars") {
    return (
      <div className={styles.cardRow} aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <span className={styles.miniBar} key={index} />
        ))}
      </div>
    );
  }

  if (visual === "dots") {
    return (
      <div className={styles.cardRow} aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <span className={styles.dot} key={index} />
        ))}
        <span className={styles.line} />
      </div>
    );
  }

  return (
    <div className={styles.cardVisual} aria-hidden="true">
      {Array.from({ length: 3 }, (_, index) => (
        <div className={styles.cardRow} key={index}>
          <span className={styles.dot} />
          <span className={styles.line} />
        </div>
      ))}
    </div>
  );
}

type FeatureSectionProps = {
  copy: LandingCopy;
};

export function FeatureSection({ copy }: FeatureSectionProps) {
  const features = copy.features;

  return (
    <section className={styles.section} id="features">
      <div className={styles.container}>
        <div className={styles.sectionHead}>
          <span className={`${styles.eyebrow} ${styles.sectionEyebrow}`}>
            {features.unifiedHead.eyebrow}
          </span>
          <h2 className={styles.sectionTitle}>{features.unifiedHead.title}</h2>
          <p className={styles.sectionIntro}>{features.unifiedHead.intro}</p>
        </div>

        <div className={styles.systemGrid}>
          {features.unifiedCards.map((card) => (
            <article className={styles.systemCard} key={card.title}>
              <span>{card.eyebrow}</span>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <div className={styles.cardVisual}>
                <FeatureVisual visual={card.visual} />
              </div>
            </article>
          ))}
        </div>

        <div className={styles.sectionHead}>
          <span className={`${styles.eyebrow} ${styles.sectionEyebrow}`}>
            {features.capabilityHead.eyebrow}
          </span>
          <h2 className={styles.sectionTitle}>{features.capabilityHead.title}</h2>
          <p className={styles.sectionIntro}>{features.capabilityHead.intro}</p>
        </div>

        <div className={styles.featureGrid}>
          {features.featureCards.map((card) => (
            <article className={styles.featureCard} key={card.title}>
              <span>{card.eyebrow}</span>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <div className={styles.cardVisual}>
                <FeatureVisual visual={card.visual} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
