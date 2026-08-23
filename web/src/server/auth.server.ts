import { Lucia, generateId } from "lucia";
import type { Adapter, DatabaseSession, DatabaseUser } from "lucia";
import { Argon2id } from "oslo/password";
import {
  deleteCookie,
  getCookie,
  setCookie,
} from "@tanstack/react-start/server";
import { sql } from "./db.server";

// ── Custom Lucia adapter backed by postgres.js (replaces the Prisma adapter) ──
function transformSession(row: any): DatabaseSession {
  return {
    id: row.id,
    userId: row.user_id,
    expiresAt: row.expires_at,
    attributes: {},
  };
}

function transformUser(row: any): DatabaseUser {
  const { id, ...attributes } = row;
  return { id, attributes: attributes as any };
}

const adapter: Adapter = {
  async getSessionAndUser(sessionId) {
    const [session] = await sql`SELECT * FROM "Session" WHERE id = ${sessionId}`;
    if (!session) return [null, null];
    const [user] = await sql`SELECT * FROM "User" WHERE id = ${session.user_id}`;
    if (!user) return [null, null];
    return [transformSession(session), transformUser(user)];
  },
  async getUserSessions(userId) {
    const rows = await sql`SELECT * FROM "Session" WHERE user_id = ${userId}`;
    return rows.map(transformSession);
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
  },
};

// Secure cookies require HTTPS. Default to on in production, but allow an
// explicit override (e.g. COOKIE_SECURE=false) for HTTP deployments like the
// all-in-one container running over plain http://localhost.
const secureCookies =
  process.env.COOKIE_SECURE !== undefined
    ? process.env.COOKIE_SECURE === "true"
    : process.env.NODE_ENV === "production";

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    expires: false,
    attributes: {
      secure: secureCookies,
    },
  },
  getUserAttributes: (attributes) => ({
    name: attributes.name,
    email: attributes.email,
  }),
});

declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: {
      name: string;
      email: string;
      password: string;
    };
  }
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export async function validateRequest(): Promise<{ user: AuthUser | null }> {
  const sessionId = getCookie(lucia.sessionCookieName) ?? null;
  if (!sessionId) return { user: null };

  const { session, user } = await lucia.validateSession(sessionId);
  try {
    if (session && session.fresh) {
      const cookie = lucia.createSessionCookie(session.id);
      setCookie(cookie.name, cookie.value, cookie.attributes as any);
    }
    if (!session) {
      const cookie = lucia.createBlankSessionCookie();
      setCookie(cookie.name, cookie.value, cookie.attributes as any);
    }
  } catch {
    // setCookie can throw outside a request context; ignore.
  }
  if (!user) return { user: null };
  return { user: { id: user.id, name: user.name, email: user.email } };
}

export async function getAuthUser() {
  const { user } = await validateRequest();
  return { user };
}

async function acceptInviteForUser(
  inviteToken: string,
  userId: string,
  email: string,
) {
  const [invite] = await sql`SELECT * FROM "Invite" WHERE token = ${inviteToken}`;
  if (
    invite &&
    invite.status === "pending" &&
    new Date() < new Date(invite.expiresAt) &&
    invite.email === email
  ) {
    const [existing] = await sql`
      SELECT 1 FROM "CompanyUser"
      WHERE "companyID" = ${invite.companyID} AND "userID" = ${userId}`;
    if (!existing) {
      await sql`
        INSERT INTO "CompanyUser" ("companyID", "userID")
        VALUES (${invite.companyID}, ${userId})`;
    }
    await sql`UPDATE "Invite" SET status = 'accepted' WHERE id = ${invite.id}`;
    return invite.companyID as string;
  }
  return null;
}

const emailRegex =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  inviteToken?: string;
}

export async function doSignup(data: SignupInput) {
  const { name, email, password, inviteToken } = data;
  if (typeof name !== "string" || name.length < 3 || name.length > 31) {
    return { error: "Invalid name" };
  }
  if (
    typeof password !== "string" ||
    password.length < 6 ||
    password.length > 255
  ) {
    return { error: "Invalid password" };
  }
  if (typeof email !== "string" || !emailRegex.test(email)) {
    return { error: "Invalid email" };
  }

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
  setCookie(cookie.name, cookie.value, cookie.attributes as any);

  return { redirect: redirectTo };
}

export interface LoginInput {
  email: string;
  password: string;
  inviteToken?: string;
}

export async function doLogin(data: LoginInput) {
  const { email, password, inviteToken } = data;
  if (
    typeof password !== "string" ||
    password.length < 6 ||
    password.length > 255
  ) {
    return { error: "Invalid password" };
  }
  if (typeof email !== "string" || !emailRegex.test(email)) {
    return { error: "Invalid email" };
  }

  const [existingUser] = await sql`SELECT * FROM "User" WHERE email = ${email}`;
  if (!existingUser) return { error: "Incorrect username or password" };

  const validPassword = await new Argon2id().verify(
    existingUser.password,
    password,
  );
  if (!validPassword) return { error: "Incorrect username or password" };

  let redirectTo = "/dash";
  if (inviteToken) {
    const companyID = await acceptInviteForUser(
      inviteToken,
      existingUser.id,
      email,
    );
    if (companyID) redirectTo = `/dash/${companyID}`;
  }

  const session = await lucia.createSession(existingUser.id, {});
  const cookie = lucia.createSessionCookie(session.id);
  setCookie(cookie.name, cookie.value, cookie.attributes as any);

  return { redirect: redirectTo };
}

export async function doLogout() {
  const sessionId = getCookie(lucia.sessionCookieName) ?? null;
  if (sessionId) {
    await lucia.invalidateSession(sessionId);
  }
  const cookie = lucia.createBlankSessionCookie();
  setCookie(cookie.name, cookie.value, cookie.attributes as any);
  deleteCookie(lucia.sessionCookieName);
  return { redirect: "/" };
}
