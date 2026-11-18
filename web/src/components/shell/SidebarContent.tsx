import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Button,
  Classes,
  Icon,
  Menu,
  MenuDivider,
  MenuItem,
  Popover,
  Spinner,
  type IconName,
} from "@blueprintjs/core";
import type { Company, CompanyDetail, Usage } from "@/lib/api";
import { UsageMeter } from "./UsageMeter";

function NavItem({
  to,
  params,
  search,
  icon,
  emoji,
  label,
  hint,
  exact,
  onClick,
}: {
  to: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
  icon?: IconName;
  emoji?: string;
  label: string;
  hint?: string;
  exact?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to as never}
      params={params as never}
      search={search as never}
      className="rl-navitem"
      activeOptions={{ exact: !!exact, includeSearch: false }}
      activeProps={{ className: "rl-active" }}
      onClick={onClick}
    >
      {emoji != null ? (
        <span className="rl-nav-emoji" aria-hidden>
          {emoji}
        </span>
      ) : (
        <Icon icon={icon ?? "blank"} size={14} />
      )}
      <span className="rl-nav-label">{label}</span>
      {hint && <span className="rl-kbd">{hint}</span>}
    </Link>
  );
}

function Section({ label, action }: { label: string; action?: ReactNode }) {
  return (
    <div className="rl-section-label">
      <span className="rl-label-text">{label}</span>
      {action}
    </div>
  );
}

/** Sidebar contents shared between the fixed sidebar and the mobile drawer. */
export function SidebarContent({
  projectId,
  detail,
  projectList,
  listLoading,
  usage,
  onNavigate,
  onNewProject,
  onNewChannel,
}: {
  projectId?: string;
  detail?: CompanyDetail | null;
  projectList?: Company[];
  listLoading: boolean;
  usage?: Usage | null;
  onNavigate?: () => void;
  onNewProject: () => void;
  onNewChannel: () => void;
}) {
  const navigate = useNavigate();
  const current = detail?.company ?? projectList?.find((p) => p.id === projectId);
  const channels = detail?.channels ?? [];

  const switcherMenu = (
    <Menu>
      {listLoading && <MenuItem disabled text={<Spinner size={14} />} />}
      {projectList?.map((p) => (
        <MenuItem
          key={p.id}
          icon={p.id === projectId ? "tick" : "blank"}
          text={p.name}
          active={p.id === projectId}
          onClick={() => {
            onNavigate?.();
            navigate({ to: "/app/$projectId", params: { projectId: p.id }, search: { q: undefined, event: undefined, tag: undefined } });
          }}
        />
      ))}
      {projectList?.length === 0 && <MenuItem disabled text="No projects yet" />}
      <MenuDivider />
      <MenuItem
        icon="plus"
        intent="primary"
        text="New project…"
        onClick={() => {
          onNavigate?.();
          onNewProject();
        }}
      />
    </Menu>
  );

  return (
    <div className="rl-side-inner">
      <div className="rl-logo-row">
        <Link to="/" aria-label="Raterlog home">
          <img src="/icon.png" alt="" width={24} height={24} style={{ display: "block" }} />
        </Link>
        <span className="rl-logo-name">Raterlog</span>
      </div>

      <Popover
        minimal
        placement="bottom-start"
        matchTargetWidth
        content={switcherMenu}
      >
        <Button
          className={"rl-switcher" + (listLoading ? " " + Classes.SKELETON : "")}
          style={{ minHeight: 32 }}
          icon="projects"
          rightIcon="caret-down"
          alignText="left"
          fill
          outlined
        >
          <span className="rl-switcher-text">{current?.name ?? "Select project"}</span>
        </Button>
      </Popover>

      <div className="rl-side-scroll">
        {projectId ? (
          <>
            <Section label="Project" />
          <NavItem
            to="/app/$projectId"
            params={{ projectId }}
            icon="feed"
            label="Feed"
            hint="g f"
            exact
            onClick={onNavigate}
          />
          <NavItem
            to="/app/$projectId/analytics"
            params={{ projectId }}
            icon="timeline-line-chart"
            label="Analytics"
            hint="g a"
            onClick={onNavigate}
          />
          <NavItem
            to="/app/$projectId/dashboards"
            params={{ projectId }}
            icon="dashboard"
            label="Dashboards"
            hint="g d"
            onClick={onNavigate}
          />
          <NavItem
            to="/app/$projectId/insights"
            params={{ projectId }}
            icon="lightbulb"
            label="Insights"
            onClick={onNavigate}
          />
          <NavItem
            to="/app/$projectId/users"
            params={{ projectId }}
            icon="people"
            label="Users"
            hint="g u"
            onClick={onNavigate}
          />
          <NavItem
            to="/app/$projectId/settings"
            params={{ projectId }}
            search={{ tab: "general" }}
            icon="cog"
            label="Settings"
            hint="g s"
            onClick={onNavigate}
          />
          <NavItem
            to="/app/$projectId/setup"
            params={{ projectId }}
            icon="rocket"
            label="Setup guide"
            onClick={onNavigate}
          />

          <Section
            label="Channels"
            action={
              <Button
                minimal
                small
                icon="plus"
                aria-label="New channel"
                onClick={() => {
                  onNavigate?.();
                  onNewChannel();
                }}
              />
            }
          />
          {channels.map((c) => (
            <NavItem
              key={c.id}
              to="/app/$projectId/channels/$channelId"
              params={{ projectId, channelId: c.id }}
              emoji={c.icon}
              label={c.name}
              onClick={onNavigate}
            />
          ))}
          {detail && channels.length === 0 && (
            <div className="rl-hint">No channels yet — they're created by your first event.</div>
          )}
          </>
        ) : (
          <>
            <Section label="Projects" />
            {projectList?.map((p) => (
              <NavItem
                key={p.id}
                to="/app/$projectId"
                params={{ projectId: p.id }}
                icon="folder-close"
                label={p.name}
                onClick={onNavigate}
              />
            ))}
            {!listLoading && projectList?.length === 0 && (
              <div className="rl-hint">No projects yet.</div>
            )}
          </>
        )}
      </div>

      {projectId && (
        <div className="rl-side-footer">
          <UsageMeter projectId={projectId} usage={usage} />
        </div>
      )}
    </div>
  );
}
