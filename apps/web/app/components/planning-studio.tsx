import { type ReactNode } from "react";

type SceneMetric = {
  label: string;
  value: string;
  note: string;
};

type PlanningStudioProps = {
  eyebrow: string;
  title: string;
  description: string;
  metrics: SceneMetric[];
  compact?: boolean;
  children: ReactNode;
};

export function PlanningStudio({
  eyebrow,
  title,
  description,
  metrics,
  compact = false,
  children,
}: PlanningStudioProps) {
  return (
    <>
      <div
        className={`planning-studio-headline planning-studio-stage ${
          compact ? "planning-studio-headline-compact" : ""
        }`.trim()}
      >
        <div className="planning-studio-headline-copy">
          <span className="eyebrow eyebrow-muted">{eyebrow}</span>
          <h3>{compact ? eyebrow : title}</h3>
          <p>{description}</p>
        </div>
        <div className="planning-head-metrics">
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
