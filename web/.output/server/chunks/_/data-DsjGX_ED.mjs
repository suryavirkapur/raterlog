import { c as createServerFn } from '../virtual/entry.mjs';
import { c as createServerRpc } from './createServerRpc-B0PkXF8x.mjs';
import '../nitro/nitro.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';
import '@tanstack/react-router';
import 'react/jsx-runtime';
import '@tanstack/react-router/ssr/server';
import 'node:async_hooks';
import 'rou3';
import 'srvx';
import '@tanstack/router-core';
import '@tanstack/router-core/ssr/client';
import 'seroval';
import '@tanstack/history';
import '@tanstack/router-core/ssr/server';

var getDashboard_createServerFn_handler = createServerRpc({
  id: "19121a6c0c84f006e9be2f2d033d322a72eb8aed3c7af7728222953b51a2106e",
  name: "getDashboard",
  filename: "src/server/data.ts"
}, (opts) => getDashboard.__executeServer(opts));
var getDashboard = createServerFn({ method: "GET" }).handler(getDashboard_createServerFn_handler, async () => (await import('./impl.server-Mx-wvAvj.mjs')).getDashboard());
var createCompany_createServerFn_handler = createServerRpc({
  id: "d8b62a9d9cb83feb28126c745f3d7033b6fda15a5ecbc3374ea3e48657de5f8e",
  name: "createCompany",
  filename: "src/server/data.ts"
}, (opts) => createCompany.__executeServer(opts));
var createCompany = createServerFn({ method: "POST" }).validator((data) => data).handler(createCompany_createServerFn_handler, async ({ data }) => (await import('./impl.server-Mx-wvAvj.mjs')).createCompany(data));
var getCompanyChannels_createServerFn_handler = createServerRpc({
  id: "0b4ecc796ff415a2a816203e60c46f68adbb84361f702aed140e2af2db8bb8b2",
  name: "getCompanyChannels",
  filename: "src/server/data.ts"
}, (opts) => getCompanyChannels.__executeServer(opts));
var getCompanyChannels = createServerFn({ method: "GET" }).validator((data) => data).handler(getCompanyChannels_createServerFn_handler, async ({ data }) => (await import('./impl.server-Mx-wvAvj.mjs')).getCompanyChannels(data));
var createChannel_createServerFn_handler = createServerRpc({
  id: "6438edb505d351c328387feb6a4c25967ad9e885aaa8cc754bf30ae2f713311a",
  name: "createChannel",
  filename: "src/server/data.ts"
}, (opts) => createChannel.__executeServer(opts));
var createChannel = createServerFn({ method: "POST" }).validator((data) => data).handler(createChannel_createServerFn_handler, async ({ data }) => (await import('./impl.server-Mx-wvAvj.mjs')).createChannel(data));
var getCompanyTokens_createServerFn_handler = createServerRpc({
  id: "13ca21011e883b4e39e720cdb003eed9d14d88b5e2ac03a659970aa2523aba74",
  name: "getCompanyTokens",
  filename: "src/server/data.ts"
}, (opts) => getCompanyTokens.__executeServer(opts));
var getCompanyTokens = createServerFn({ method: "GET" }).validator((data) => data).handler(getCompanyTokens_createServerFn_handler, async ({ data }) => (await import('./impl.server-Mx-wvAvj.mjs')).getCompanyTokens(data));
var createToken_createServerFn_handler = createServerRpc({
  id: "1d23f1fff0c36186cd0b0ee78fbae63a1c6aeb230432e55aa547f3738cbecb1b",
  name: "createToken",
  filename: "src/server/data.ts"
}, (opts) => createToken.__executeServer(opts));
var createToken = createServerFn({ method: "POST" }).validator((data) => data).handler(createToken_createServerFn_handler, async ({ data }) => (await import('./impl.server-Mx-wvAvj.mjs')).createToken(data));
var deleteToken_createServerFn_handler = createServerRpc({
  id: "9200e2b434a6b475dd75fec528f86e0cb33f2fedd7f83748ea02c7188eab25dd",
  name: "deleteToken",
  filename: "src/server/data.ts"
}, (opts) => deleteToken.__executeServer(opts));
var deleteToken = createServerFn({ method: "POST" }).validator((data) => data).handler(deleteToken_createServerFn_handler, async ({ data }) => (await import('./impl.server-Mx-wvAvj.mjs')).deleteToken(data));
var getCompanyMembers_createServerFn_handler = createServerRpc({
  id: "7bad6db9a2c5fc26158a6f0e4437c6f90cb14328f7a08d0e274c672711858f81",
  name: "getCompanyMembers",
  filename: "src/server/data.ts"
}, (opts) => getCompanyMembers.__executeServer(opts));
var getCompanyMembers = createServerFn({ method: "GET" }).validator((data) => data).handler(getCompanyMembers_createServerFn_handler, async ({ data }) => (await import('./impl.server-Mx-wvAvj.mjs')).getCompanyMembers(data));
var sendInvite_createServerFn_handler = createServerRpc({
  id: "29b65d851bb3983017a0352dc0ac58812cba9877d7ed7e827a1395e8482a6250",
  name: "sendInvite",
  filename: "src/server/data.ts"
}, (opts) => sendInvite.__executeServer(opts));
var sendInvite = createServerFn({ method: "POST" }).validator((data) => data).handler(sendInvite_createServerFn_handler, async ({ data }) => (await import('./impl.server-Mx-wvAvj.mjs')).sendInvite(data));
var revokeInvite_createServerFn_handler = createServerRpc({
  id: "0ad7bcc7a043f87e4b450bfebac166b4a28d1b2bc27a0cfe1f1a5b556fa19c3c",
  name: "revokeInvite",
  filename: "src/server/data.ts"
}, (opts) => revokeInvite.__executeServer(opts));
var revokeInvite = createServerFn({ method: "POST" }).validator((data) => data).handler(revokeInvite_createServerFn_handler, async ({ data }) => (await import('./impl.server-Mx-wvAvj.mjs')).revokeInvite(data));
var getChannel_createServerFn_handler = createServerRpc({
  id: "456d3f126d717edaddc610cfd404c8bf6379cff853ce794f6a1692831b9de95d",
  name: "getChannel",
  filename: "src/server/data.ts"
}, (opts) => getChannel.__executeServer(opts));
var getChannel = createServerFn({ method: "GET" }).validator((data) => data).handler(getChannel_createServerFn_handler, async ({ data }) => (await import('./impl.server-Mx-wvAvj.mjs')).getChannel(data));
var getInvite_createServerFn_handler = createServerRpc({
  id: "008fae48be9cb941de1e0799a8e10b8ad9bebf846cabd3f934bd5b351442fcd5",
  name: "getInvite",
  filename: "src/server/data.ts"
}, (opts) => getInvite.__executeServer(opts));
var getInvite = createServerFn({ method: "GET" }).validator((data) => data).handler(getInvite_createServerFn_handler, async ({ data }) => (await import('./impl.server-Mx-wvAvj.mjs')).getInvite(data));
var acceptInvite_createServerFn_handler = createServerRpc({
  id: "948a7d869bf750c9f6da6d320f61c0e39691ab6464dcd8b908042d2c01b00fe1",
  name: "acceptInvite",
  filename: "src/server/data.ts"
}, (opts) => acceptInvite.__executeServer(opts));
var acceptInvite = createServerFn({ method: "POST" }).validator((data) => data).handler(acceptInvite_createServerFn_handler, async ({ data }) => (await import('./impl.server-Mx-wvAvj.mjs')).acceptInvite(data));

export { acceptInvite_createServerFn_handler, createChannel_createServerFn_handler, createCompany_createServerFn_handler, createToken_createServerFn_handler, deleteToken_createServerFn_handler, getChannel_createServerFn_handler, getCompanyChannels_createServerFn_handler, getCompanyMembers_createServerFn_handler, getCompanyTokens_createServerFn_handler, getDashboard_createServerFn_handler, getInvite_createServerFn_handler, revokeInvite_createServerFn_handler, sendInvite_createServerFn_handler };
//# sourceMappingURL=data-DsjGX_ED.mjs.map
