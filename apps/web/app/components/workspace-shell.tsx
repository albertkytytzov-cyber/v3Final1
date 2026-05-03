"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";

export type WorkspaceLink<Id extends string = string> = {
  id: Id;
  label: string;
  meta: string;
};

export type WorkspaceRailStat = {
  label: string;
  value: string;
  note: string;
  tone?: "accent" | "default";
};

export type WorkspaceToolbarSelect = {
  label: string;
  value: string;
  options: Array<{
    value: string;
    label: string;
  }>;
  onChange: (value: string) => void;
};

type WorkspaceProfileStatusItem = {
  label: string;
  value: string;
  tone?: "pending" | "failed";
  onSelect: () => void;
};

type WorkspaceProfileLanguageOption = {
  value: string;
  label: string;
  active: boolean;
  onSelect: () => void;
};

type WorkspaceTopbarLanguageMenu = {
  label: string;
  valueLabel: string;
  options: WorkspaceProfileLanguageOption[];
};

type WorkspaceTopbarAuthActions = {
  loginLabel: string;
  registerLabel: string;
  activeMode: "login" | "register";
  onLogin: () => void;
  onRegister: () => void;
};

type WorkspaceProfileMenu = {
  avatarLabel: string;
  name: string;
  meta?: string;
  profileDetails?: ReactNode;
  statusItem?: WorkspaceProfileStatusItem;
  signOutLabel?: string;
  signOutDisabled?: boolean;
  onSignOut?: () => void;
};

type WorkspaceTopBarProps = {
  title: string;
  selects: WorkspaceToolbarSelect[];
  languageMenu: WorkspaceTopbarLanguageMenu;
  authActions?: WorkspaceTopbarAuthActions;
  profileMenu?: WorkspaceProfileMenu;
  actionLabel?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
};

export function WorkspaceTopBar({
  title,
  selects,
  languageMenu,
  authActions,
  profileMenu,
  actionLabel,
  actionDisabled,
  onAction,
}: WorkspaceTopBarProps) {
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const hasAction = Boolean(actionLabel && onAction);
  const hasSignOut = Boolean(profileMenu?.signOutLabel && profileMenu.onSignOut);
  const languageMenuId = useId();
  const profileMenuId = useId();
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        languageMenuRef.current &&
        event.target instanceof Node &&
        !languageMenuRef.current.contains(event.target)
      ) {
        setIsLanguageMenuOpen(false);
      }

      if (
        profileMenuRef.current &&
        event.target instanceof Node &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setIsProfileMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsLanguageMenuOpen(false);
        setIsProfileMenuOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    setIsProfileMenuOpen(false);
  }, [profileMenu?.name, profileMenu?.meta, profileMenu?.signOutLabel]);

  return (
    <div className="panel topbar">
      <div className="topbar-title">
        <strong>{title}</strong>
      </div>

      <div
        className={`topbar-side ${
          authActions ? "topbar-side-with-auth" : ""
        }`.trim()}
      >
        {selects.map((select) => (
          <label className="field compact-field" key={select.label}>
            <span>{select.label}</span>
            <select value={select.value} onChange={(event) => select.onChange(event.target.value)}>
              {select.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
        {hasAction ? (
          <div className="topbar-actions">
            <button
              className="primary-button workspace-top-action"
              disabled={actionDisabled}
              onClick={onAction}
              type="button"
            >
              {actionLabel}
            </button>
          </div>
        ) : null}

        <div className="workspace-language-menu" ref={languageMenuRef}>
          <button
            aria-controls={languageMenuId}
            aria-expanded={isLanguageMenuOpen}
            aria-label={languageMenu.label}
            className="workspace-language-trigger"
            onClick={() => setIsLanguageMenuOpen((open) => !open)}
            type="button"
          >
            <span className="workspace-language-icon" aria-hidden="true">
              🌐
            </span>
            <strong>{languageMenu.valueLabel}</strong>
            <span className="workspace-profile-trigger-caret" aria-hidden="true">
              v
            </span>
          </button>

          {isLanguageMenuOpen ? (
            <div
              aria-label={languageMenu.label}
              className="workspace-language-popover"
              id={languageMenuId}
              role="menu"
            >
              {languageMenu.options.map((option) => (
                <button
                  aria-current={option.active ? "true" : undefined}
                  className={`workspace-language-option ${
                    option.active ? "workspace-language-option-active" : ""
                  }`.trim()}
                  key={option.value}
                  onClick={() => {
                    option.onSelect();
                    setIsLanguageMenuOpen(false);
                  }}
                  role="menuitem"
                  type="button"
                >
                  <span>{option.label}</span>
                  <strong>{option.value.toUpperCase()}</strong>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {authActions ? (
          <div className="workspace-auth-actions">
            <button
              className={`workspace-auth-action ${
                authActions.activeMode === "login" ? "workspace-auth-action-active" : ""
              }`.trim()}
              onClick={authActions.onLogin}
              type="button"
            >
              {authActions.loginLabel}
            </button>
            <button
              className={`workspace-auth-action workspace-auth-action-primary ${
                authActions.activeMode === "register" ? "workspace-auth-action-active" : ""
              }`.trim()}
              onClick={authActions.onRegister}
              type="button"
            >
              {authActions.registerLabel}
            </button>
          </div>
        ) : null}

        {profileMenu ? (
          <div className="workspace-profile-menu" ref={profileMenuRef}>
          <button
            aria-controls={profileMenuId}
            aria-expanded={isProfileMenuOpen}
            className="workspace-profile-trigger"
            onClick={() => setIsProfileMenuOpen((open) => !open)}
            type="button"
          >
            <span className="workspace-profile-avatar">{profileMenu.avatarLabel}</span>
            <span className="workspace-profile-trigger-copy">
              <strong>{profileMenu.name}</strong>
              {profileMenu.meta ? <small>{profileMenu.meta}</small> : null}
            </span>
            <span className="workspace-profile-trigger-caret" aria-hidden="true">
              v
            </span>
          </button>

          {isProfileMenuOpen ? (
            <div
              className={`workspace-profile-popover ${
                profileMenu.profileDetails ? "workspace-profile-popover-wide" : ""
              }`.trim()}
              id={profileMenuId}
            >
              <div className="workspace-profile-popover-head">
                <span className="workspace-profile-avatar workspace-profile-avatar-large">
                  {profileMenu.avatarLabel}
                </span>
                <div className="workspace-profile-popover-copy">
                  <strong>{profileMenu.name}</strong>
                  {profileMenu.meta ? <small>{profileMenu.meta}</small> : null}
                </div>
              </div>

              {profileMenu.profileDetails ? (
                <div className="workspace-profile-section workspace-profile-extra-section">
                  {profileMenu.profileDetails}
                </div>
              ) : null}

              {profileMenu.statusItem ? (
                <div className="workspace-profile-section">
                  <button
                    className={`workspace-profile-status-link ${
                      profileMenu.statusItem.tone === "failed"
                        ? "workspace-profile-status-link-failed"
                        : "workspace-profile-status-link-pending"
                    }`}
                    onClick={() => {
                      profileMenu.statusItem?.onSelect();
                      setIsProfileMenuOpen(false);
                    }}
                    type="button"
                  >
                    <span>{profileMenu.statusItem.label}</span>
                    <strong>{profileMenu.statusItem.value}</strong>
                  </button>
                </div>
              ) : null}

              {hasSignOut ? (
                <div className="workspace-profile-section workspace-profile-section-actions">
                  <button
                    className="secondary-button workspace-profile-signout"
                    disabled={profileMenu.signOutDisabled}
                    onClick={() => {
                      profileMenu.onSignOut?.();
                      setIsProfileMenuOpen(false);
                    }}
                    type="button"
                  >
                    {profileMenu.signOutLabel}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        ) : null}
      </div>
    </div>
  );
}

type WorkspaceRailProps<Id extends string> = {
  productTitle: string;
  productEyebrow: string;
  currentWorkspaceLabel: string;
  activeItem: WorkspaceLink<Id>;
  sectionsLabel: string;
  links: WorkspaceLink<Id>[];
  activeId: Id;
  onSelect: (id: Id) => void;
  stats: WorkspaceRailStat[];
  note: string;
  noteIsError?: boolean;
};

export function WorkspaceRail<Id extends string>({
  productTitle,
  productEyebrow,
  currentWorkspaceLabel,
  activeItem,
  sectionsLabel,
  links,
  activeId,
  onSelect,
  stats,
  note,
  noteIsError = false,
}: WorkspaceRailProps<Id>) {
  return (
    <aside className="panel workspace-rail">
      <div className="workspace-rail-top">
        <div className="workspace-rail-header">
          <div className="workspace-brand-badge">v3</div>
          <div className="workspace-brand-copy">
            <strong>{productTitle}</strong>
            <small>{productEyebrow}</small>
          </div>
        </div>

        <div className="workspace-current">
          <span className="rail-stat-label">{currentWorkspaceLabel}</span>
          <strong>{activeItem.label}</strong>
          <small>{activeItem.meta}</small>
        </div>
      </div>

      <nav className="rail-nav">
        <span className="rail-nav-label">{sectionsLabel}</span>
        {links.map((link) => (
          <button
            aria-current={activeId === link.id ? "page" : undefined}
            className={`rail-link ${activeId === link.id ? "rail-link-active" : ""}`}
            key={link.id}
            onClick={() => onSelect(link.id)}
            type="button"
          >
            <span className="rail-link-title">{link.label}</span>
            <small>{link.meta}</small>
            <span className="rail-link-indicator" />
          </button>
        ))}
      </nav>

      {stats.length > 0 ? (
        <div className="rail-stat-grid">
          {stats.map((item) => (
            <article
              className={`rail-stat ${item.tone === "accent" ? "rail-stat-accent" : ""}`}
              key={item.label}
            >
              <span className="rail-stat-label">{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.note}</small>
            </article>
          ))}
        </div>
      ) : null}

      <p className={`workspace-rail-note ${noteIsError ? "workspace-rail-note-error" : ""}`}>
        {note}
      </p>
    </aside>
  );
}

type WorkspaceStageHeaderProps = {
  eyebrow: string;
  title: string;
  summary: string;
  hideCopy?: boolean;
  tabs?: ReactNode;
};

export function WorkspaceStageHeader({
  eyebrow,
  title,
  summary,
  hideCopy = false,
  tabs,
}: WorkspaceStageHeaderProps) {
  return (
    <div className={`panel workspace-stage-header ${hideCopy ? "workspace-stage-header-tabs-only" : ""}`.trim()}>
      {hideCopy ? null : (
        <div className="workspace-stage-copy">
          <span className="eyebrow eyebrow-muted">{eyebrow}</span>
          <h2>{title}</h2>
          <p>{summary}</p>
        </div>
      )}
      {tabs}
    </div>
  );
}

type WorkspaceContextDockProps = {
  children: ReactNode;
};

export function WorkspaceContextDock({ children }: WorkspaceContextDockProps) {
  return <aside className="panel workspace-context">{children}</aside>;
}

type WorkspaceContextSectionProps = {
  children: ReactNode;
  className?: string;
};

export function WorkspaceContextSection({
  children,
  className,
}: WorkspaceContextSectionProps) {
  return (
    <div className={`workspace-context-section ${className ?? ""}`.trim()}>{children}</div>
  );
}
