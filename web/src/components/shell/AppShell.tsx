import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useRouterState,
} from "@tanstack/react-router";
import {
  Button,
  Drawer,
  Icon,
  Menu,
  MenuDivider,
  MenuItem,
  Popover,
  Tag,
  Tooltip,
} from "@blueprintjs/core";
import { auth, billing, projects } from "@/lib/api";
import { useAsync, useLocalState } from "@/lib/hooks";
import { useSession } from "@/lib/context";
import { applyTheme, getTheme } from "@/lib/theme";
import { toastError } from "@/lib/toaster";
import { SidebarContent } from "./SidebarContent";
import { CommandPalette, type PaletteItem } from "./CommandPalette";
import { NewProjectDialog } from "./NewProjectDialog";
import { NewChannelDialog } from "./NewChannelDialog";
import "./shell.css";

const PAGE_LABELS: Record<string, string> = {
  setup: "Setup guide",
  analytics: "Analytics",
  insights: "Insights",
  dashboards: "Dashboards",
  users: "Users",
  settings: "Settings",
};

export default function AppShell({ children }: { children: ReactNode }) {
  const user = useSession();
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as {
    projectId?: string;
    channelId?: string;
    userId?: string;
  };
  const projectId = params.projectId;
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [theme, setTheme] = useState(getTheme);
  const [collapsed, setCollapsed] = useLocalState("rl-nav-collapsed", false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [omniOpen, setOmniOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newChannelOpen, setNewChannelOpen] = useState(false);

  const projectsReq = useAsync(() => projects.list().catch(() => []), []);
  const detailReq = useAsync(
    () => (projectId ? projects.get(projectId).catch(() => null) : Promise.resolve(null)),
    [projectId],
  );
  const usageReq = useAsync(
    () => (projectId ? billing.usage(projectId).catch(() => null) : Promise.resolve(null)),
    [projectId],
  );
  const detail = detailReq.data ?? null;
  const projectList = projectsReq.data ?? [];

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }

  // Global keyboard shortcuts: ⌘K / Ctrl+K / "/" palette, "g <x>" navigation.
  useEffect(() => {
    let gAt = 0;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        !!t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOmniOpen((v) => !v);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        setOmniOpen(true);
        return;
      }
      const now = Date.now();
      if (e.key === "g") {
        gAt = now;
        return;
      }
      if (projectId && now - gAt < 900) {
        gAt = 0;
        if (e.key === "f") navigate({ to: "/app/$projectId", params: { projectId }, search: { q: undefined, event: undefined, tag: undefined } });
        else if (e.key === "a")
          navigate({ to: "/app/$projectId/analytics", params: { projectId } });
        else if (e.key === "d")
          navigate({ to: "/app/$projectId/dashboards", params: { projectId } });
        else if (e.key === "u") navigate({ to: "/app/$projectId/users", params: { projectId } });
        else if (e.key === "s")
          navigate({
            to: "/app/$projectId/settings",
            params: { projectId },
            search: { tab: "general" },
          });
        return;
      }
      gAt = 0;
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [projectId, navigate]);

  // Breadcrumbs from the path.
  const crumbs = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean); // ["app", projectId?, sub?, extra?]
    const out: { label: string; to?: string }[] = [];
    if (!projectId) {
      out.push({ label: "Projects" });
      return out;
    }
    const name = detail?.company.name ?? projectList.find((p) => p.id === projectId)?.name ?? "…";
    out.push({ label: name, to: `/app/${projectId}` });
    const sub = parts[2];
    if (!sub) {
      out.push({ label: "Feed" });
    } else if (sub === "channels") {
      const ch = detail?.channels.find((c) => c.id === parts[3]);
      out.push({ label: "Channels", to: `/app/${projectId}` });
      out.push({ label: ch ? `${ch.icon} ${ch.name}` : "…" });
    } else if (sub === "users" && parts[3]) {
      out.push({ label: "Users", to: `/app/${projectId}/users` });
      out.push({ label: decodeURIComponent(parts[3]) });
    } else {
      out.push({ label: PAGE_LABELS[sub] ?? sub });
    }
    return out;
  }, [pathname, projectId, detail, projectList]);

  // Command palette items.
  const paletteItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [];
    if (projectId) {
      items.push(
        {
          id: "p-feed",
          label: "Feed",
          icon: "feed",
          hint: "g f",
          run: () => navigate({ to: "/app/$projectId", params: { projectId }, search: { q: undefined, event: undefined, tag: undefined } }),
        },
        {
          id: "p-analytics",
          label: "Analytics",
          icon: "timeline-line-chart",
          hint: "g a",
          run: () => navigate({ to: "/app/$projectId/analytics", params: { projectId } }),
        },
        {
          id: "p-dashboards",
          label: "Dashboards",
          icon: "dashboard",
          hint: "g d",
          run: () => navigate({ to: "/app/$projectId/dashboards", params: { projectId } }),
        },
        {
          id: "p-insights",
          label: "Insights",
          icon: "lightbulb",
          run: () => navigate({ to: "/app/$projectId/insights", params: { projectId } }),
        },
        {
          id: "p-users",
          label: "Users",
          icon: "people",
          hint: "g u",
          run: () => navigate({ to: "/app/$projectId/users", params: { projectId } }),
        },
        {
          id: "p-settings",
          label: "Settings",
          icon: "cog",
          hint: "g s",
          run: () =>
            navigate({
              to: "/app/$projectId/settings",
              params: { projectId },
              search: { tab: "general" },
            }),
        },
        {
          id: "p-setup",
          label: "Setup guide",
          icon: "rocket",
          run: () => navigate({ to: "/app/$projectId/setup", params: { projectId } }),
        },
        {
          id: "a-channel",
          label: "New channel…",
          icon: "plus",
          keywords: "create channel",
          run: () => setNewChannelOpen(true),
        },
      );
      for (const c of detail?.channels ?? []) {
        items.push({
          id: `ch-${c.id}`,
          label: `Channel: ${c.name}`,
          emoji: c.icon,
          keywords: "channel",
          run: () =>
            navigate({
              to: "/app/$projectId/channels/$channelId",
              params: { projectId, channelId: c.id },
            }),
        });
      }
    }
    for (const p of projectList) {
      items.push({
        id: `proj-${p.id}`,
        label: `Project: ${p.name}`,
        icon: "projects",
        keywords: "switch project",
        run: () => navigate({ to: "/app/$projectId", params: { projectId: p.id }, search: { q: undefined, event: undefined, tag: undefined } }),
      });
    }
    items.push(
      {
        id: "a-project",
        label: "New project…",
        icon: "plus",
        keywords: "create project",
        run: () => setNewProjectOpen(true),
      },
      { id: "a-docs", label: "Documentation", icon: "manual", run: () => navigate({ to: "/docs" }) },
      {
        id: "a-theme",
        label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        icon: "contrast",
        keywords: "toggle theme dark light",
        run: toggleTheme,
      },
    );
    return items;
  }, [projectId, detail, projectList, theme, navigate]);

  async function signOut() {
    try {
      await auth.signout();
    } catch (e) {
      toastError(e);
    }
    navigate({ to: "/" });
  }

  const sidebar = (
    <SidebarContent
      projectId={projectId}
      detail={detail}
      projectList={projectList}
      listLoading={projectsReq.loading}
      usage={usageReq.data}
      onNavigate={() => setDrawerOpen(false)}
      onNewProject={() => setNewProjectOpen(true)}
      onNewChannel={() => setNewChannelOpen(true)}
    />
  );

  return (
    <div className={"rl-shell" + (collapsed ? " rl-collapsed" : "")}>
      <aside className="rl-sidebar">{sidebar}</aside>

      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        position="left"
        size={272}
        className="rl-drawer-body"
      >
        <aside className="rl-sidebar" style={{ display: "flex", width: "100%", borderRight: "none" }}>
          {sidebar}
        </aside>
      </Drawer>

      <div className="rl-main">
        <header className="rl-topbar">
          <Button
            minimal
            icon="menu"
            className="rl-only-mobile"
            aria-label="Open navigation"
            onClick={() => setDrawerOpen(true)}
          />
          <Tooltip
            content={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            placement="bottom"
          >
            <Button
              minimal
              icon={collapsed ? "chevron-right" : "chevron-left"}
              className="rl-only-desktop"
              aria-label="Toggle sidebar"
              onClick={() => setCollapsed(!collapsed)}
            />
          </Tooltip>
          <nav className="rl-crumbs" aria-label="Breadcrumb">
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: "contents" }}>
                {i > 0 && (
                  <Icon icon="chevron-right" size={11} className="rl-crumb-sep" aria-hidden />
                )}
                {c.to ? (
                  <Link to={c.to as never} className="rl-crumb rl-crumb-dim">
                    {c.label}
                  </Link>
                ) : (
                  <span className={"rl-crumb" + (i < crumbs.length - 1 ? " rl-crumb-dim" : "")}>
                    {c.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
          <div style={{ flex: 1 }} />
          <Button
            minimal
            outlined
            className="rl-jump"
            icon="search"
            onClick={() => setOmniOpen(true)}
          >
            <span className="rl-jump-text">Jump to…</span>
            <Tag minimal style={{ marginLeft: "auto" }}>
              ⌘K
            </Tag>
          </Button>
          <Tooltip content="Toggle theme" placement="bottom">
            <Button
              minimal
              icon="contrast"
              aria-label="Toggle theme"
              onClick={toggleTheme}
            />
          </Tooltip>
          <Popover
            minimal
            placement="bottom-end"
            content={
              <Menu>
                <MenuItem
                  disabled
                  icon="person"
                  text={user.name}
                  label={user.email}
                />
                <MenuDivider />
                <MenuItem
                  icon="manual"
                  text="Documentation"
                  onClick={() => navigate({ to: "/docs" })}
                />
                <MenuItem
                  icon="contrast"
                  text={theme === "dark" ? "Light theme" : "Dark theme"}
                  onClick={toggleTheme}
                />
                <MenuDivider />
                <MenuItem icon="log-out" intent="danger" text="Sign out" onClick={signOut} />
              </Menu>
            }
          >
            <Button minimal icon="user" rightIcon="caret-down" aria-label="Account menu" />
          </Popover>
        </header>

        <main className="rl-content">{children}</main>
      </div>

      <CommandPalette isOpen={omniOpen} onClose={() => setOmniOpen(false)} items={paletteItems} />
      <NewProjectDialog
        isOpen={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        onCreated={() => projectsReq.reload()}
      />
      {projectId && (
        <NewChannelDialog
          isOpen={newChannelOpen}
          onClose={() => setNewChannelOpen(false)}
          projectId={projectId}
          onCreated={() => detailReq.reload()}
        />
      )}
    </div>
  );
}
