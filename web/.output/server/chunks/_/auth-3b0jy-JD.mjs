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

var getAuth_createServerFn_handler = createServerRpc({
  id: "4e32d2b0f9bffbd87a61978732f04af12a131ce371b6e0f1dd007d7279264a78",
  name: "getAuth",
  filename: "src/server/auth.ts"
}, (opts) => getAuth.__executeServer(opts));
var getAuth = createServerFn({ method: "GET" }).handler(getAuth_createServerFn_handler, async () => {
  return (await import('./auth.server-C4dUC9Xa.mjs')).getAuthUser();
});
var signupFn_createServerFn_handler = createServerRpc({
  id: "cd37bf5b44ea2939a1d7c86d72030ae9c23710e31e36522287ad7f6d0c0f944c",
  name: "signupFn",
  filename: "src/server/auth.ts"
}, (opts) => signupFn.__executeServer(opts));
var signupFn = createServerFn({ method: "POST" }).validator((data) => data).handler(signupFn_createServerFn_handler, async ({ data }) => {
  return (await import('./auth.server-C4dUC9Xa.mjs')).doSignup(data);
});
var loginFn_createServerFn_handler = createServerRpc({
  id: "1bd5f6beef8b8498f487d444b475ec43c130b872d5482a076588f45d1d824033",
  name: "loginFn",
  filename: "src/server/auth.ts"
}, (opts) => loginFn.__executeServer(opts));
var loginFn = createServerFn({ method: "POST" }).validator((data) => data).handler(loginFn_createServerFn_handler, async ({ data }) => {
  return (await import('./auth.server-C4dUC9Xa.mjs')).doLogin(data);
});
var logoutFn_createServerFn_handler = createServerRpc({
  id: "9ba0115062514df0860765457c03095b2fb0bdf04c256d5c5cd841a19dca77fa",
  name: "logoutFn",
  filename: "src/server/auth.ts"
}, (opts) => logoutFn.__executeServer(opts));
var logoutFn = createServerFn({ method: "POST" }).handler(logoutFn_createServerFn_handler, async () => {
  return (await import('./auth.server-C4dUC9Xa.mjs')).doLogout();
});

export { getAuth_createServerFn_handler, loginFn_createServerFn_handler, logoutFn_createServerFn_handler, signupFn_createServerFn_handler };
//# sourceMappingURL=auth-3b0jy-JD.mjs.map
