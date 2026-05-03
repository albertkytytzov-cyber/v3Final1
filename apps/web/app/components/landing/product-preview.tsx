import type { LandingCopy } from "./landing-i18n";
import styles from "./landing.module.css";

type ProductPreviewProps = {
  copy: LandingCopy;
};

export function ProductPreview({ copy }: ProductPreviewProps) {
  const product = copy.product;

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.sectionHead}>
          <span className={`${styles.eyebrow} ${styles.sectionEyebrow}`}>
            {product.eyebrow}
          </span>
          <h2 className={styles.sectionTitle}>{product.title}</h2>
          <p className={styles.sectionIntro}>{product.intro}</p>
        </div>

        <div className={styles.productPanel}>
          <div className={styles.productPanelHead}>
            <div>
              <span className={styles.productCardEyebrow}>{product.panelEyebrow}</span>
              <h3 className={styles.productCardTitle}>{product.panelTitle}</h3>
            </div>
            <span className={styles.productPanelMeta}>{product.panelMeta}</span>
          </div>

          <div className={styles.productGrid}>
            {product.cards.map((card) => (
              <article className={styles.productCard} key={card.title}>
                <div className={styles.productCardHead}>
                  <div>
                    <span className={styles.productCardEyebrow}>{card.eyebrow}</span>
                    <h4 className={styles.productCardTitle}>{card.title}</h4>
                  </div>
                  <span className={styles.productValue}>{card.value}</span>
                </div>
                <ul>
                  {card.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className={styles.productPreviewFooter}>
            {product.footerNotes.map((note) => (
              <span className={styles.productPreviewNote} key={note}>
                {note}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
