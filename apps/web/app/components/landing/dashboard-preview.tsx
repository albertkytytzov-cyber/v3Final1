import type { LandingCopy } from "./landing-i18n";
import styles from "./landing.module.css";

const chartHeights = [48, 64, 58, 72, 84, 62, 76];

type DashboardPreviewProps = {
  copy: LandingCopy;
};

export function DashboardPreview({ copy }: DashboardPreviewProps) {
  const dashboard = copy.dashboard;

  return (
    <div className={styles.dashboardPreview}>
      <article className={styles.heroPanel}>
        <div className={styles.panelHead}>
          <span>{dashboard.statusLabel}</span>
          <strong>{dashboard.systemLabel}</strong>
        </div>

        <div className={styles.panelStat}>
          <span className={styles.panelStatLabel}>{dashboard.readinessLabel}</span>
          <div className={styles.panelStatValue}>
            <strong>72%</strong>
            <span className={styles.panelStatus}>{dashboard.readinessStatus}</span>
          </div>
        </div>

        <div className={styles.chart} aria-hidden="true">
          {chartHeights.map((height, index) => (
            <span className={styles.chartBar} key={height + index} style={{ height }} />
          ))}
        </div>

        <div className={styles.metricGrid}>
          {dashboard.metrics.map((metric) => (
            <article className={styles.metricCard} key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </div>

        <div className={styles.recommendation}>
          <span className={styles.panelStatLabel}>{dashboard.recommendationLabel}</span>
          <p>{dashboard.recommendation}</p>
        </div>
      </article>

      <article className={`${styles.miniPanel} ${styles.floatingPhone}`}>
        <span>{dashboard.athleteWorkspace}</span>
        <strong>{dashboard.dailyReadiness}</strong>
        <div className={styles.phoneStatusRow}>
          <span className={styles.statusDot}>{dashboard.taper}</span>
          <span className={styles.statusDot}>{dashboard.yellowDay}</span>
        </div>
        <ul className={styles.phoneList}>
          <li>
            <span>{dashboard.assignedDay}</span>
            <strong>{dashboard.dayValue}</strong>
          </li>
          <li>
            <span>{dashboard.executionTracking}</span>
            <strong>{dashboard.executionValue}</strong>
          </li>
          <li>
            <span>{dashboard.offlineSync}</span>
            <strong>{dashboard.synced}</strong>
          </li>
        </ul>
      </article>

      <article className={styles.floatingPlanner}>
        <span>{dashboard.planningStudio}</span>
        <strong>{dashboard.microcycle}</strong>
        <div className={styles.plannerBars} aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
      </article>
    </div>
  );
}
