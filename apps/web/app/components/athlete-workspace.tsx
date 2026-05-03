import { type ReactNode } from "react";

type SceneMetric = {
  label: string;
  value: string;
  note: string;
};

type SceneChip = {
  label: string;
  value: string;
};

type PreviewCard = {
  title: string;
  value: string;
  description: string;
};

type AthleteWorkspaceProps = {
  title: string;
  guestLabel: string;
  isGuest: boolean;
  metrics: SceneMetric[];
  summaryItems: SceneChip[];
  previewCards: PreviewCard[];
  children: ReactNode;
};

export function AthleteWorkspace({
  title,
  guestLabel,
  isGuest,
  metrics,
  summaryItems,
  previewCards,
  children,
}: AthleteWorkspaceProps) {
  if (isGuest) {
    return (
      <div className="panel stack athlete-auth-preview athlete-scene-product">
        <div className="athlete-scene-lead">
          <div className="section-head">
            <h2>{title}</h2>
            <span className="eyebrow eyebrow-muted">{guestLabel}</span>
          </div>
          <div className="athlete-scene-topbar">
            {metrics.map((item) => (
              <article className="scene-metric" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.note}</small>
              </article>
            ))}
          </div>
          <div className="context-chip-grid athlete-scene-summary">
            {summaryItems.map((item) => (
              <article className="context-chip" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>
        </div>

        <div className="athlete-preview-grid">
          {previewCards.map((card) => (
            <article className="entry-summary athlete-scene-card athlete-preview-card" key={card.title}>
              <div className="summary-topline">
                <strong>{card.title}</strong>
                <span>{card.value}</span>
              </div>
              <p className="placeholder-copy">{card.description}</p>
            </article>
          ))}
        </div>
      </div>
    );
  }

  return <div className="panel stack athlete-workbench-shell athlete-scene-product">{children}</div>;
}
