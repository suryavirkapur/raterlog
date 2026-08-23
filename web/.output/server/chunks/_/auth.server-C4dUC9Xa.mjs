import { a as getCookie, s as setCookie$1, d as deleteCookie$1 } from '../virtual/entry.mjs';
import { Lucia, generateId } from 'lucia';
import { Argon2id } from 'oslo/password';
import postgres from 'postgres';
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

var url = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/example";
var sql = postgres(url);
function transformSession(row) {
  return {
    id: row.id,
    userId: row.user_id,
    expiresAt: row.expires_at,
    attributes: {}
  };
}
function transformUser(row) {
  const { id, ...attributes } = row;
  return {
    id,
    attributes
  };
}
var lucia = new Lucia({
  async getSessionAndUser(sessionId) {
    const [session] = await sql`SELECT * FROM "Session" WHERE id = ${sessionId}`;
    if (!session) return [null, null];
    const [user] = await sql`SELECT * FROM "User" WHERE id = ${session.user_id}`;
    if (!user) return [null, null];
    return [transformSession(session), transformUser(user)];
  },
  async getUserSessions(userId) {
    return (await sql`SELECT * FROM "Session" WHERE user_id = ${userId}`).map(transformSession);
  },
  async setSession(session) {
    await sql`
      INSERT INTO "Session" (id, user_id, expires_at)
      VALUES (${session.id}, ${session.userId}, ${session.expiresAt})`;
  },
  async updateSessionExpiration(sessionId, expiresAt) {
    await sql`UPDATE "Session" SET expires_at = ${expiresAt} WHERE id = ${sessionId}`;
  },
  async deleteSession(sessionId) {
    await sql`DELETE FROM "Session" WHERE id = ${sessionId}`;
  },
  async deleteUserSessions(userId) {
    await sql`DELETE FROM "Session" WHERE user_id = ${userId}`;
  },
  async deleteExpiredSessions() {
    await sql`DELETE FROM "Session" WHERE expires_at <= now()`;
  }
}, {
  sessionCookie: {
    expires: false,
    attributes: { secure: true }
  },
  getUserAttributes: (attributes) => ({
    name: attributes.name,
    email: attributes.email
  })
});
async function validateRequest() {
  const sessionId = getCookie(lucia.sessionCookieName) ?? null;
  if (!sessionId) return { user: null };
  const { session, user } = await lucia.validateSession(sessionId);
  try {
    if (session && session.fresh) {
      const cookie = lucia.createSessionCookie(session.id);
      setCookie$1(cookie.name, cookie.value, cookie.attributes);
    }
    if (!session) {
      const cookie = lucia.createBlankSessionCookie();
      setCookie$1(cookie.name, cookie.value, cookie.attributes);
    }
  } catch {
  }
  if (!user) return { user: null };
  return { user: {
    id: user.id,
    name: user.name,
    email: user.email
  } };
}
async function getAuthUser() {
  const { user } = await validateRequest();
  return { user };
}
async function acceptInviteForUser(inviteToken, userId, email) {
  const [invite] = await sql`SELECT * FROM "Invite" WHERE token = ${inviteToken}`;
  if (invite && invite.status === "pending" && /* @__PURE__ */ new Date() < new Date(invite.expiresAt) && invite.email === email) {
    const [existing] = await sql`
      SELECT 1 FROM "CompanyUser"
      WHERE "companyID" = ${invite.companyID} AND "userID" = ${userId}`;
    if (!existing) await sql`
        INSERT INTO "CompanyUser" ("companyID", "userID")
        VALUES (${invite.companyID}, ${userId})`;
    await sql`UPDATE "Invite" SET status = 'accepted' WHERE id = ${invite.id}`;
    return invite.companyID;
  }
  return null;
}
var emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
async function doSignup(data) {
  const { name, email, password, inviteToken } = data;
  if (typeof name !== "string" || name.length < 3 || name.length > 31) return { error: "Invalid name" };
  if (typeof password !== "string" || password.length < 6 || password.length > 255) return { error: "Invalid password" };
  if (typeof email !== "string" || !emailRegex.test(email)) return { error: "Invalid email" };
  const [existingUser] = await sql`SELECT id FROM "User" WHERE email = ${email}`;
  if (existingUser) return { error: "Email exists!" };
  const hashedPassword = await new Argon2id().hash(password);
  const userId = generateId(15);
  await sql`
    INSERT INTO "User" (id, name, email, password)
    VALUES (${userId}, ${name}, ${email}, ${hashedPassword})`;
  let redirectTo = "/dash";
  if (inviteToken) {
    const companyID = await acceptInviteForUser(inviteToken, userId, email);
    if (companyID) redirectTo = `/dash/${companyID}`;
  }
  const session = await lucia.createSession(userId, {});
  const cookie = lucia.createSessionCookie(session.id);
  setCookie$1(cookie.name, cookie.value, cookie.attributes);
  return { redirect: redirectTo };
}
async function doLogin(data) {
  const { email, password, inviteToken } = data;
  if (typeof password !== "string" || password.length < 6 || password.length > 255) return { error: "Invalid password" };
  if (typeof email !== "string" || !emailRegex.test(email)) return { error: "Invalid email" };
  const [existingUser] = await sql`SELECT * FROM "User" WHERE email = ${email}`;
  if (!existingUser) return { error: "Incorrect username or password" };
  if (!await new Argon2id().verify(existingUser.password, password)) return { error: "Incorrect username or password" };
  let redirectTo = "/dash";
  if (inviteToken) {
    const companyID = await acceptInviteForUser(inviteToken, existingUser.id, email);
    if (companyID) redirectTo = `/dash/${companyID}`;
  }
  const session = await lucia.createSession(existingUser.id, {});
  const cookie = lucia.createSessionCookie(session.id);
  setCookie$1(cookie.name, cookie.value, cookie.attributes);
  return { redirect: redirectTo };
}
async function doLogout() {
  const sessionId = getCookie(lucia.sessionCookieName) ?? null;
  if (sessionId) await lucia.invalidateSession(sessionId);
  const cookie = lucia.createBlankSessionCookie();
  setCookie$1(cookie.name, cookie.value, cookie.attributes);
  deleteCookie$1(lucia.sessionCookieName);
  return { redirect: "/" };
}

export { doLogin, doLogout, doSignup, getAuthUser, sql as t, validateRequest };
//# sourceMappingURL=auth.server-C4dUC9Xa.mjs.map
