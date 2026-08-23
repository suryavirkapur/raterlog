import { T as TSS_SERVER_FUNCTION, g as getServerFnById, c as createServerFn } from '../virtual/entry.mjs';
import { createRootRoute, HeadContent, Outlet, Scripts, createFileRoute, lazyRouteComponent, redirect, createRouter } from '@tanstack/react-router';
import { jsxs, jsx } from 'react/jsx-runtime';
import { Theme } from '@radix-ui/themes';

var createSsrRpc = (functionId) => {
  const url = "/_serverFn/" + functionId;
  const serverFnMeta = { id: functionId };
  const fn = async (...args) => {
    return (await getServerFnById(functionId))(...args);
  };
  return Object.assign(fn, {
    url,
    serverFnMeta,
    [TSS_SERVER_FUNCTION]: true
  });
};

var getDashboard = createServerFn({ method: "GET" }).handler(createSsrRpc("19121a6c0c84f006e9be2f2d033d322a72eb8aed3c7af7728222953b51a2106e"));
var createCompany = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("d8b62a9d9cb83feb28126c745f3d7033b6fda15a5ecbc3374ea3e48657de5f8e"));
var getCompanyChannels = createServerFn({ method: "GET" }).validator((data) => data).handler(createSsrRpc("0b4ecc796ff415a2a816203e60c46f68adbb84361f702aed140e2af2db8bb8b2"));
var createChannel = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("6438edb505d351c328387feb6a4c25967ad9e885aaa8cc754bf30ae2f713311a"));
var getCompanyTokens = createServerFn({ method: "GET" }).validator((data) => data).handler(createSsrRpc("13ca21011e883b4e39e720cdb003eed9d14d88b5e2ac03a659970aa2523aba74"));
var createToken = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("1d23f1fff0c36186cd0b0ee78fbae63a1c6aeb230432e55aa547f3738cbecb1b"));
var deleteToken = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("9200e2b434a6b475dd75fec528f86e0cb33f2fedd7f83748ea02c7188eab25dd"));
var getCompanyMembers = createServerFn({ method: "GET" }).validator((data) => data).handler(createSsrRpc("7bad6db9a2c5fc26158a6f0e4437c6f90cb14328f7a08d0e274c672711858f81"));
var sendInvite = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("29b65d851bb3983017a0352dc0ac58812cba9877d7ed7e827a1395e8482a6250"));
var revokeInvite = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("0ad7bcc7a043f87e4b450bfebac166b4a28d1b2bc27a0cfe1f1a5b556fa19c3c"));
var getChannel = createServerFn({ method: "GET" }).validator((data) => data).handler(createSsrRpc("456d3f126d717edaddc610cfd404c8bf6379cff853ce794f6a1692831b9de95d"));
var getInvite = createServerFn({ method: "GET" }).validator((data) => data).handler(createSsrRpc("008fae48be9cb941de1e0799a8e10b8ad9bebf846cabd3f934bd5b351442fcd5"));
var acceptInvite = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("948a7d869bf750c9f6da6d320f61c0e39691ab6464dcd8b908042d2c01b00fe1"));

var getAuth = createServerFn({ method: "GET" }).handler(createSsrRpc("4e32d2b0f9bffbd87a61978732f04af12a131ce371b6e0f1dd007d7279264a78"));
var signupFn = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("cd37bf5b44ea2939a1d7c86d72030ae9c23710e31e36522287ad7f6d0c0f944c"));
var loginFn = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("1bd5f6beef8b8498f487d444b475ec43c130b872d5482a076588f45d1d824033"));
var logoutFn = createServerFn({ method: "POST" }).handler(createSsrRpc("9ba0115062514df0860765457c03095b2fb0bdf04c256d5c5cd841a19dca77fa"));

var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
  let target = {};
  for (var name in all) __defProp(target, name, {
    get: all[name],
    enumerable: true
  });
  __defProp(target, Symbol.toStringTag, { value: "Module" });
  return target;
};
var Route$10 = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1"
      },
      { title: "Raterlog" },
      {
        name: "description",
        content: "Raterlog - Realtime monitoring for your entire business"
      }
    ],
    links: [
      {
        rel: "icon",
        href: "/icon.png"
      },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com"
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous"
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
      }
    ]
  }),
  component: RootComponent
});
function RootComponent() {
  return /* @__PURE__ */ jsxs("html", {
    lang: "en",
    children: [/* @__PURE__ */ jsx("head", { children: /* @__PURE__ */ jsx(HeadContent, {}) }), /* @__PURE__ */ jsxs("body", {
      style: {
        margin: 0,
        fontFamily: "Inter, system-ui, sans-serif"
      },
      children: [/* @__PURE__ */ jsx(Theme, {
        accentColor: "blue",
        grayColor: "sand",
        radius: "large",
        scaling: "95%",
        appearance: "dark",
        children: /* @__PURE__ */ jsx(Outlet, {})
      }), /* @__PURE__ */ jsx(Scripts, {})]
    })]
  });
}
var $$splitComponentImporter$9 = () => import('./routes-BvhRYL8u.mjs');
var Route$9 = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter$9, "component") });
var $$splitComponentImporter$8 = () => import('./dash-DLGSuZWj.mjs');
var Route$8 = createFileRoute("/dash")({
  loader: async () => await getDashboard(),
  component: lazyRouteComponent($$splitComponentImporter$8, "component")
});
var $$splitComponentImporter$7 = () => import('./signin-D4nY3mKS.mjs');
var Route$7 = createFileRoute("/signin")({
  validateSearch: (search) => ({
    email: typeof search.email === "string" ? search.email : "",
    invite: typeof search.invite === "string" ? search.invite : ""
  }),
  beforeLoad: async ({ search }) => {
    const { user } = await getAuth();
    if (user) {
      if (search.invite) throw redirect({
        to: "/invite/$token",
        params: { token: search.invite }
      });
      throw redirect({ to: "/dash" });
    }
  },
  component: lazyRouteComponent($$splitComponentImporter$7, "component")
});
var $$splitComponentImporter$6 = () => import('./signup-BnI9_bCS.mjs');
var Route$6 = createFileRoute("/signup")({
  validateSearch: (search) => ({
    email: typeof search.email === "string" ? search.email : "",
    invite: typeof search.invite === "string" ? search.invite : ""
  }),
  beforeLoad: async ({ search }) => {
    const { user } = await getAuth();
    if (user) {
      if (search.invite) throw redirect({
        to: "/invite/$token",
        params: { token: search.invite }
      });
      throw redirect({ to: "/dash" });
    }
  },
  component: lazyRouteComponent($$splitComponentImporter$6, "component")
});
var $$splitComponentImporter$5 = () => import('./dash.index-DoUo148X.mjs');
var Route$5 = createFileRoute("/dash/")({
  loader: async () => await getDashboard(),
  component: lazyRouteComponent($$splitComponentImporter$5, "component")
});
var $$splitComponentImporter$4 = () => import('./invite._token-B2tpgC64.mjs');
var Route$4 = createFileRoute("/invite/$token")({
  loader: async ({ params }) => await getInvite({ data: { token: params.token } }),
  component: lazyRouteComponent($$splitComponentImporter$4, "component")
});
var $$splitComponentImporter$3 = () => import('./dash._companyId.index-CmjYqxnH.mjs');
var Route$3 = createFileRoute("/dash/$companyId/")({
  loader: async ({ params }) => await getCompanyChannels({ data: { companyId: params.companyId } }),
  component: lazyRouteComponent($$splitComponentImporter$3, "component")
});
var $$splitComponentImporter$2 = () => import('./dash._companyId._channelId-OvuYuEkB.mjs');
var Route$2 = createFileRoute("/dash/$companyId/$channelId")({
  loader: async ({ params }) => await getChannel({ data: { channelId: params.channelId } }),
  component: lazyRouteComponent($$splitComponentImporter$2, "component")
});
var $$splitComponentImporter$1 = () => import('./dash._companyId.members-HMSsCFgF.mjs');
var Route$1 = createFileRoute("/dash/$companyId/members")({
  loader: async ({ params }) => await getCompanyMembers({ data: { companyId: params.companyId } }),
  component: lazyRouteComponent($$splitComponentImporter$1, "component")
});
var $$splitComponentImporter = () => import('./dash._companyId.tokens-DAJ6SucP.mjs');
var Route = createFileRoute("/dash/$companyId/tokens")({
  loader: async ({ params }) => await getCompanyTokens({ data: { companyId: params.companyId } }),
  component: lazyRouteComponent($$splitComponentImporter, "component")
});
var IndexRoute = Route$9.update({
  id: "/",
  path: "/",
  getParentRoute: () => Route$10
});
var DashRoute = Route$8.update({
  id: "/dash",
  path: "/dash",
  getParentRoute: () => Route$10
});
var SigninRoute = Route$7.update({
  id: "/signin",
  path: "/signin",
  getParentRoute: () => Route$10
});
var SignupRoute = Route$6.update({
  id: "/signup",
  path: "/signup",
  getParentRoute: () => Route$10
});
var DashIndexRoute = Route$5.update({
  id: "/",
  path: "/",
  getParentRoute: () => DashRoute
});
var InviteTokenRoute = Route$4.update({
  id: "/invite/$token",
  path: "/invite/$token",
  getParentRoute: () => Route$10
});
var DashCompanyIdIndexRoute = Route$3.update({
  id: "/$companyId/",
  path: "/$companyId/",
  getParentRoute: () => DashRoute
});
var DashRouteChildren = {
  DashIndexRoute,
  DashCompanyIdChannelIdRoute: Route$2.update({
    id: "/$companyId/$channelId",
    path: "/$companyId/$channelId",
    getParentRoute: () => DashRoute
  }),
  DashCompanyIdMembersRoute: Route$1.update({
    id: "/$companyId/members",
    path: "/$companyId/members",
    getParentRoute: () => DashRoute
  }),
  DashCompanyIdTokensRoute: Route.update({
    id: "/$companyId/tokens",
    path: "/$companyId/tokens",
    getParentRoute: () => DashRoute
  }),
  DashCompanyIdIndexRoute
};
var rootRouteChildren = {
  IndexRoute,
  DashRoute: DashRoute._addFileChildren(DashRouteChildren),
  SigninRoute,
  SignupRoute,
  InviteTokenRoute
};
var routeTree = Route$10._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent"
  });
}

const routerBujGOfVM = /*#__PURE__*/Object.freeze({
	__proto__: null,
	a: Route$3,
	c: Route$6,
	getRouter: getRouter,
	i: Route$2,
	l: Route$7,
	n: Route,
	o: Route$4,
	r: Route$1,
	s: Route$5,
	t: router_exports,
	u: Route$8
});

export { Route$8 as R, Route$7 as a, loginFn as b, Route$6 as c, Route$5 as d, createCompany as e, Route$4 as f, acceptInvite as g, Route$3 as h, createChannel as i, Route$2 as j, Route$1 as k, logoutFn as l, sendInvite as m, Route as n, deleteToken as o, createToken as p, routerBujGOfVM as q, revokeInvite as r, signupFn as s };
//# sourceMappingURL=router-bujGOfVM.mjs.map
