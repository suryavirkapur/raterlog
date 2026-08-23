import { redirect } from "@tanstack/react-router";
import { generateId } from "lucia";
import { sql } from "./db.server";
import { validateRequest, type AuthUser } from "./auth.server";
import { sendInviteEmail } from "./mail.server";

async function requireUser(): Promise<AuthUser> {
  const { user } = await validateRequest();
  if (!user) throw redirect({ to: "/signin" });
  return user;
}

async function isMember(companyId: string, userId: string) {
  const [row] = await sql`
    SELECT 1 FROM "CompanyUser"
    WHERE "companyID" = ${companyId} AND "userID" = ${userId}`;
  return Boolean(row);
}

export async function getDashboard() {
  const user = await requireUser();
  const companies = await sql`
    SELECT c.id, c.name, c.billing
    FROM "Company" c
    JOIN "CompanyUser" cu ON cu."companyID" = c.id
    WHERE cu."userID" = ${user.id}
    ORDER BY c.name`;
  return {
    user,
    companies: companies.map((c) => ({
      id: c.id as string,
      name: c.name as string,
      billing: c.billing as boolean,
    })),
  };
}

export async function createCompany(data: { name: string }) {
  const user = await requireUser();
  const name = (data.name ?? "").trim();
  if (!name) return { error: "Company name is missing." };
  const companyID = generateId(15);
  await sql`INSERT INTO "Company" (id, name, billing) VALUES (${companyID}, ${name}, false)`;
  await sql`INSERT INTO "CompanyUser" ("companyID", "userID") VALUES (${companyID}, ${user.id})`;
  return { error: "" };
}

export async function getCompanyChannels(data: { companyId: string }) {
  const user = await requireUser();
  const [company] = await sql`SELECT id, name FROM "Company" WHERE id = ${data.companyId}`;
  if (!company || !(await isMember(data.companyId, user.id))) {
    return { company: null, channels: [] as any[] };
  }
  const channels = await sql`
    SELECT id, name, icon FROM "Channel" WHERE "companyID" = ${data.companyId}`;
  return {
    company: { id: company.id as string, name: company.name as string },
    channels: channels.map((c) => ({
      id: c.id as string,
      name: c.name as string,
      icon: c.icon as string,
    })),
  };
}

export async function createChannel(data: {
  companyId: string;
  name: string;
  icon: string;
}) {
  const user = await requireUser();
  if (!(await isMember(data.companyId, user.id))) return { error: "Unauthorized" };
  const name = (data.name ?? "").trim();
  const icon = (data.icon ?? "").trim();
  if (!name) return { error: "Name is empty" };
  if (!icon) return { error: "Emoji is empty" };
  await sql`
    INSERT INTO "Channel" (id, name, icon, "companyID")
    VALUES (${generateId(15)}, ${name}, ${icon}, ${data.companyId})`;
  return { error: "" };
}

export async function getCompanyTokens(data: { companyId: string }) {
  const user = await requireUser();
  const [company] = await sql`SELECT id, name FROM "Company" WHERE id = ${data.companyId}`;
  if (!company || !(await isMember(data.companyId, user.id))) {
    return { company: null, tokens: [] as any[] };
  }
  const tokens = await sql`
    SELECT id, name, token FROM "Token" WHERE "companyID" = ${data.companyId} ORDER BY id`;
  return {
    company: { id: company.id as string, name: company.name as string },
    tokens: tokens.map((t) => ({
      id: t.id as number,
      name: t.name as string,
      token: t.token as string,
    })),
  };
}

export async function createToken(data: { companyId: string; name: string }) {
  const user = await requireUser();
  if (!(await isMember(data.companyId, user.id))) return { error: "Unauthorized" };
  const name = (data.name ?? "").trim();
  if (!name) return { error: "Token name is required" };
  await sql`
    INSERT INTO "Token" (name, token, "companyID")
    VALUES (${name}, ${generateId(20)}, ${data.companyId})`;
  return { error: "" };
}

export async function deleteToken(data: { tokenId: number }) {
  await requireUser();
  await sql`DELETE FROM "Token" WHERE id = ${data.tokenId}`;
  return { error: "" };
}

export async function getCompanyMembers(data: { companyId: string }) {
  const user = await requireUser();
  const [company] = await sql`SELECT id, name FROM "Company" WHERE id = ${data.companyId}`;
  if (!company || !(await isMember(data.companyId, user.id))) {
    return { company: null, members: [] as any[], pendingInvites: [] as any[] };
  }
  const members = await sql`
    SELECT u.id, u.name, u.email
    FROM "User" u
    JOIN "CompanyUser" cu ON cu."userID" = u.id
    WHERE cu."companyID" = ${data.companyId}`;
  const pendingInvites = await sql`
    SELECT id, email FROM "Invite"
    WHERE "companyID" = ${data.companyId} AND status = 'pending'
    ORDER BY "createdAt" DESC`;
  return {
    company: { id: company.id as string, name: company.name as string },
    members: members.map((m) => ({
      id: m.id as string,
      name: m.name as string,
      email: m.email as string,
    })),
    pendingInvites: pendingInvites.map((i) => ({
      id: i.id as string,
      email: i.email as string,
    })),
  };
}

export async function sendInvite(data: { companyId: string; email: string }) {
  const user = await requireUser();
  if (!(await isMember(data.companyId, user.id))) return { error: "Unauthorized" };
  const email = (data.email ?? "").trim();
  if (!email.includes("@")) return { error: "Valid email is required" };

  const [company] = await sql`SELECT name FROM "Company" WHERE id = ${data.companyId}`;
  if (!company) return { error: "Company not found" };

  const [existingUser] = await sql`SELECT id FROM "User" WHERE email = ${email}`;
  if (existingUser) {
    const [alreadyMember] = await sql`
      SELECT 1 FROM "CompanyUser"
      WHERE "companyID" = ${data.companyId} AND "userID" = ${existingUser.id}`;
    if (alreadyMember) return { error: "User is already a member" };
  }

  const [existingInvite] = await sql`
    SELECT 1 FROM "Invite"
    WHERE email = ${email} AND "companyID" = ${data.companyId} AND status = 'pending'`;
  if (existingInvite) return { error: "Invite already sent to this email" };

  const inviteToken = generateId(32);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await sql`
    INSERT INTO "Invite" (id, email, "companyID", token, status, "expiresAt")
    VALUES (${generateId(15)}, ${email}, ${data.companyId}, ${inviteToken}, 'pending', ${expiresAt})`;

  try {
    await sendInviteEmail(email, company.name as string, inviteToken);
  } catch (err) {
    console.error("Failed to send invite email:", err);
  }
  return { error: "" };
}

export async function revokeInvite(data: { inviteId: string }) {
  await requireUser();
  await sql`DELETE FROM "Invite" WHERE id = ${data.inviteId}`;
  return { error: "" };
}

export async function getChannel(data: { channelId: string }) {
  await requireUser();
  const [channel] = await sql`
    SELECT id, name, icon, "companyID" FROM "Channel" WHERE id = ${data.channelId}`;
  if (!channel) return { channel: null, token: "" };
  const [token] = await sql`
    SELECT token FROM "Token" WHERE "companyID" = ${channel.companyID} ORDER BY id LIMIT 1`;
  return {
    channel: {
      id: channel.id as string,
      name: channel.name as string,
      icon: channel.icon as string,
      companyID: channel.companyID as string,
    },
    token: (token?.token as string) || "",
  };
}

export async function getInvite(data: { token: string }) {
  const [invite] = await sql`
    SELECT i.id, i.email, i."companyID", i.status, i."expiresAt", c.name AS company_name
    FROM "Invite" i
    JOIN "Company" c ON c.id = i."companyID"
    WHERE i.token = ${data.token}`;
  const { user } = await validateRequest();
  if (!invite) return { invite: null, user };
  return {
    invite: {
      id: invite.id as string,
      email: invite.email as string,
      companyID: invite.companyID as string,
      status: invite.status as string,
      expiresAt: (invite.expiresAt as Date).toISOString(),
      companyName: invite.company_name as string,
    },
    user,
  };
}

export async function acceptInvite(data: { token: string }) {
  const user = await requireUser();
  const [invite] = await sql`SELECT * FROM "Invite" WHERE token = ${data.token}`;
  if (!invite || invite.status !== "pending")
    return { error: "Invite no longer valid" };

  const [existing] = await sql`
    SELECT 1 FROM "CompanyUser"
    WHERE "companyID" = ${invite.companyID} AND "userID" = ${user.id}`;
  if (!existing) {
    await sql`
      INSERT INTO "CompanyUser" ("companyID", "userID")
      VALUES (${invite.companyID}, ${user.id})`;
  }
  await sql`UPDATE "Invite" SET status = 'accepted' WHERE id = ${invite.id}`;
  return { error: "", redirect: `/dash/${invite.companyID}` };
}
