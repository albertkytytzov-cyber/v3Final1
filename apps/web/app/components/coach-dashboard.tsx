import { type ReactNode } from "react";

type SceneMetric = {
  label: string;
  value: string;
  note: string;
};

type CoachDashboardProps = {
  eyebrow: string;
  title: string;
  description: string;
  metrics: SceneMetric[];
  showHeaderCopy?: boolean;
  children: ReactNode;
};

export function CoachDashboard({
  eyebrow,
  title,
  description,
  metrics,
  showHeaderCopy = true,
  children,
}: CoachDashboardProps) {
  return (
    <>
      <div
        className={`coach-dashboard-head coach-dashboard-stage ${
          showHeaderCopy ? "" : "coach-dashboard-head-compact"
        }`.trim()}
      >
        {showHeaderCopy ? (
          <div className="coach-dashboard-head-copy">
            <span className="eyebrow eyebrow-muted">{eyebrow}</span>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
        ) : null}
        <div className="coach-dashboard-head-metrics">
          {metrics.map((item) => (
            <article className="scene-metric" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.note}</small>
            </article>
          ))}
        </div>
      </div>
      {children}
    </>
  );
}
