// Route table (code-based TanStack Router). Owned by the integrator; page
// components live in src/pages/**. Add a route here only if you must.
import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { NotFound } from "@/components/NotFound";
import { AppLayout, ProjectLayout } from "@/components/Layouts";
import Landing from "@/pages/public/Landing";
import Pricing from "@/pages/public/Pricing";
import Docs from "@/pages/public/Docs";
import SignIn from "@/pages/auth/SignIn";
import SignUp from "@/pages/auth/SignUp";
import Invite from "@/pages/auth/Invite";
import AppHome from "@/pages/app/AppHome";
import Setup from "@/pages/app/Setup";
import Feed from "@/pages/app/Feed";
import ChannelPage from "@/pages/app/Channel";
import Analytics from "@/pages/app/Analytics";
import Insights from "@/pages/app/Insights";
import Users from "@/pages/app/Users";
import UserJourney from "@/pages/app/UserJourney";
import Settings from "@/pages/app/Settings";

const rootRoute = createRootRoute({ component: Outlet, notFoundComponent: NotFound });

const authSearch = (s: Record<string, unknown>) => ({
  email: typeof s.email === "string" ? s.email : "",
  invite: typeof s.invite === "string" ? s.invite : "",
});

const landing = createRoute({ getParentRoute: () => rootRoute, path: "/", component: Landing });
const pricing = createRoute({ getParentRoute: () => rootRoute, path: "/pricing", component: Pricing });
const docs = createRoute({ getParentRoute: () => rootRoute, path: "/docs", component: Docs });
const signin = createRoute({ getParentRoute: () => rootRoute, path: "/signin", validateSearch: authSearch, component: SignIn });
const signup = createRoute({ getParentRoute: () => rootRoute, path: "/signup", validateSearch: authSearch, component: SignUp });
const invite = createRoute({ getParentRoute: () => rootRoute, path: "/invite/$token", component: Invite });

// Old dashboard URLs.
const dashRedirect = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dash/$",
  beforeLoad: () => {
    throw redirect({ to: "/app" });
  },
});

const app = createRoute({ getParentRoute: () => rootRoute, path: "/app", component: AppLayout });
const appHome = createRoute({ getParentRoute: () => app, path: "/", component: AppHome });
const project = createRoute({ getParentRoute: () => app, path: "$projectId", component: ProjectLayout });
const feed = createRoute({
  getParentRoute: () => project,
  path: "/",
  validateSearch: (s: Record<string, unknown>): { q?: string; event?: string; tag?: string } => {
    const out: { q?: string; event?: string; tag?: string } = {};
    if (typeof s.q === "string" && s.q) out.q = s.q;
    if (typeof s.event === "string" && s.event) out.event = s.event;
    if (typeof s.tag === "string" && s.tag) out.tag = s.tag;
    return out;
  },
  component: Feed,
});
const setup = createRoute({ getParentRoute: () => project, path: "setup", component: Setup });
const channel = createRoute({ getParentRoute: () => project, path: "channels/$channelId", component: ChannelPage });
const analytics = createRoute({ getParentRoute: () => project, path: "analytics", component: Analytics });
const insights = createRoute({ getParentRoute: () => project, path: "insights", component: Insights });
const usersRoute = createRoute({ getParentRoute: () => project, path: "users", component: Users });
const userJourney = createRoute({ getParentRoute: () => project, path: "users/$userId", component: UserJourney });
const settings = createRoute({
  getParentRoute: () => project,
  path: "settings",
  validateSearch: (s: Record<string, unknown>) => ({
    tab: (["general", "tokens", "members", "billing"] as const).includes(s.tab as any)
      ? (s.tab as "general" | "tokens" | "members" | "billing")
      : "general",
  }),
  component: Settings,
});

const routeTree = rootRoute.addChildren([
  landing,
  pricing,
  docs,
  signin,
  signup,
  invite,
  dashRedirect,
  app.addChildren([
    appHome,
    project.addChildren([feed, setup, channel, analytics, insights, usersRoute, userJourney, settings]),
  ]),
]);

export const router = createRouter({ routeTree, defaultPreload: "intent", scrollRestoration: true });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
