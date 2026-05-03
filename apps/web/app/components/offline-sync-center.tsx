import { type ReactNode } from "react";

type SceneMetric = {
  label: string;
  value: string;
  note: string;
};

type OfflineSyncCenterProps = {
  eyebrow: string;
  title: string;
  description: string;
  action: ReactNode;
  metrics: SceneMetric[];
  children: ReactNode;
};

export function OfflineSyncCenter({
  eyebrow,
  title,
  description,
  action,
  metrics,
  children,
}: OfflineSyncCenterProps) {
  return (
    <>
      <div className="offline-sync-header offline-sync-stage">
        <div className="offline-sync-header-copy">
          <span className="eyebrow eyebrow-muted">{eyebrow}</span>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        {action}
      </div>
      <div className="offline-sync-status-grid">
        {metrics.map((item) => (
          <article className="scene-metric" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.note}</small>
          </article>
        ))}
      </div>
      {children}
    </>
  );
}
