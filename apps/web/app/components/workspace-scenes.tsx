import { type ReactNode } from "react";

type SceneProps = {
  children: ReactNode;
};

type AthleteWorkspaceSceneProps = SceneProps & {
  isGuest: boolean;
};

export function AthleteWorkspaceScene({
  isGuest,
  children,
}: AthleteWorkspaceSceneProps) {
  return (
    <section
      className={`section workspace-scene workspace-scene-athlete ${
        isGuest ? "workspace-scene-athlete-guest" : ""
      }`}
    >
      {children}
    </section>
  );
}

type PanelSceneProps = SceneProps & {
  id: string;
  panelClassName: string;
  sectionClassName?: string;
};

function PanelScene({
  id,
  panelClassName,
  sectionClassName,
  children,
}: PanelSceneProps) {
  return (
    <section
      className={`section workspace-scene workspace-scene-single ${sectionClassName ?? ""}`.trim()}
    >
      <div className={`panel stack anchor-panel ${panelClassName}`} id={id}>
        {children}
      </div>
    </section>
  );
}

export function OfflineSyncCenterScene({ children }: SceneProps) {
  return (
    <PanelScene
      id="offline-center"
      panelClassName="offline-sync-shell"
      sectionClassName="workspace-scene-offline"
    >
      {children}
    </PanelScene>
  );
}

export function CoachDashboardScene({ children }: SceneProps) {
  return (
    <PanelScene
      id="coach-dashboard"
      panelClassName="coach-dashboard-shell"
      sectionClassName="workspace-scene-coach"
    >
      {children}
    </PanelScene>
  );
}

export function PlanningStudioScene({ children }: SceneProps) {
  return (
    <PanelScene
      id="planning-studio"
      panelClassName="planning-studio-shell"
      sectionClassName="workspace-scene-planning"
    >
      {children}
    </PanelScene>
  );
}
