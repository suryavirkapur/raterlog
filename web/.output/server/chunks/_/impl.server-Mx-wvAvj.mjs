import { t as sql, validateRequest } from './auth.server-C4dUC9Xa.mjs';
import { redirect } from '@tanstack/react-router';
import { generateId } from 'lucia';
import nodemailer from 'nodemailer';
import '../virtual/entry.mjs';
import '../nitro/nitro.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';
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
import 'oslo/password';
import 'postgres';

var transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "localhost",
  port: parseInt(process.env.SMTP_PORT || "1025", 10),
  secure: false
});
async function sendInviteEmail(to, companyName, inviteToken) {
  const inviteLink = `${process.env.APP_URL || "http://localhost:3000"}/invite/${inviteToken}`;
  await transporter.sendMail({
    from: '"Raterlog" <noreply@raterlog.dev>',
    to,
    subject: `You've been invited to join ${companyName} on Raterlog`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>You're invited to ${companyName}</h2>
        <p>You've been invited to join <strong>${companyName}</strong> on Raterlog.</p>
        <p>Click the link below to accept the invitation:</p>
        <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px; margin: 16px 0;">
          Accept Invitation
        </a>
        <p style="color: #666; font-size: 13px;">This link expires in 7 days. If you didn't expect this, you can ignore this email.</p>
      </div>
    `
  });
}
async function requireUser() {
  const { user } = await validateRequest();
  if (!user) throw redirect({ to: "/signin" });
  return user;
}
async function isMember(companyId, userId) {
  const [row] = await sql`
    SELECT 1 FROM "CompanyUser"
    WHERE "companyID" = ${companyId} AND "userID" = ${userId}`;
  return Boolean(row);
}
async function getDashboard() {
  const user = await requireUser();
  return {
    user,
    companies: (await sql`
    SELECT c.id, c.name, c.billing
    FROM "Company" c
    JOIN "CompanyUser" cu ON cu."companyID" = c.id
    WHERE cu."userID" = ${user.id}
    ORDER BY c.name`).map((c) => ({
      id: c.id,
      name: c.name,
      billing: c.billing
    }))
  };
}
async function createCompany(data) {
  const user = await requireUser();
  const name = (data.name ?? "").trim();
  if (!name) return { error: "Company name is missing." };
  const companyID = generateId(15);
  await sql`INSERT INTO "Company" (id, name, billing) VALUES (${companyID}, ${name}, false)`;
  await sql`INSERT INTO "CompanyUser" ("companyID", "userID") VALUES (${companyID}, ${user.id})`;
  return { error: "" };
}
async function getCompanyChannels(data) {
  const user = await requireUser();
  const [company] = await sql`SELECT id, name FROM "Company" WHERE id = ${data.companyId}`;
  if (!company || !await isMember(data.companyId, user.id)) return {
    company: null,
    channels: []
  };
  const channels = await sql`
    SELECT id, name, icon FROM "Channel" WHERE "companyID" = ${data.companyId}`;
  return {
    company: {
      id: company.id,
      name: company.name
    },
    channels: channels.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon
    }))
  };
}
async function createChannel(data) {
  const user = await requireUser();
  if (!await isMember(data.companyId, user.id)) return { error: "Unauthorized" };
  const name = (data.name ?? "").trim();
  const icon = (data.icon ?? "").trim();
  if (!name) return { error: "Name is empty" };
  if (!icon) return { error: "Emoji is empty" };
  await sql`
    INSERT INTO "Channel" (id, name, icon, "companyID")
    VALUES (${generateId(15)}, ${name}, ${icon}, ${data.companyId})`;
  return { error: "" };
}
async function getCompanyTokens(data) {
  const user = await requireUser();
  const [company] = await sql`SELECT id, name FROM "Company" WHERE id = ${data.companyId}`;
  if (!company || !await isMember(data.companyId, user.id)) return {
    company: null,
    tokens: []
  };
  const tokens = await sql`
    SELECT id, name, token FROM "Token" WHERE "companyID" = ${data.companyId} ORDER BY id`;
  return {
    company: {
      id: company.id,
      name: company.name
    },
    tokens: tokens.map((t) => ({
      id: t.id,
      name: t.name,
      token: t.token
    }))
  };
}
async function createToken(data) {
  const user = await requireUser();
  if (!await isMember(data.companyId, user.id)) return { error: "Unauthorized" };
  const name = (data.name ?? "").trim();
  if (!name) return { error: "Token name is required" };
  await sql`
    INSERT INTO "Token" (name, token, "companyID")
    VALUES (${name}, ${generateId(20)}, ${data.companyId})`;
  return { error: "" };
}
async function deleteToken(data) {
  await requireUser();
  await sql`DELETE FROM "Token" WHERE id = ${data.tokenId}`;
  return { error: "" };
}
async function getCompanyMembers(data) {
  const user = await requireUser();
  const [company] = await sql`SELECT id, name FROM "Company" WHERE id = ${data.companyId}`;
  if (!company || !await isMember(data.companyId, user.id)) return {
    company: null,
    members: [],
    pendingInvites: []
  };
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
    company: {
      id: company.id,
      name: company.name
    },
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email
    })),
    pendingInvites: pendingInvites.map((i) => ({
      id: i.id,
      email: i.email
    }))
  };
}
async function sendInvite(data) {
  const user = await requireUser();
  if (!await isMember(data.companyId, user.id)) return { error: "Unauthorized" };
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
  const expiresAt = new Date(Date.now() + 6048e5);
  await sql`
    INSERT INTO "Invite" (id, email, "companyID", token, status, "expiresAt")
    VALUES (${generateId(15)}, ${email}, ${data.companyId}, ${inviteToken}, 'pending', ${expiresAt})`;
  try {
    await sendInviteEmail(email, company.name, inviteToken);
  } catch (err) {
    console.error("Failed to send invite email:", err);
  }
  return { error: "" };
}
async function revokeInvite(data) {
  await requireUser();
  await sql`DELETE FROM "Invite" WHERE id = ${data.inviteId}`;
  return { error: "" };
}
async function getChannel(data) {
  await requireUser();
  const [channel] = await sql`
    SELECT id, name, icon, "companyID" FROM "Channel" WHERE id = ${data.channelId}`;
  if (!channel) return {
    channel: null,
    token: ""
  };
  const [token] = await sql`
    SELECT token FROM "Token" WHERE "companyID" = ${channel.companyID} ORDER BY id LIMIT 1`;
  return {
    channel: {
      id: channel.id,
      name: channel.name,
      icon: channel.icon,
      companyID: channel.companyID
    },
    token: token?.token || ""
  };
}
async function getInvite(data) {
  const [invite] = await sql`
    SELECT i.id, i.email, i."companyID", i.status, i."expiresAt", c.name AS company_name
    FROM "Invite" i
    JOIN "Company" c ON c.id = i."companyID"
    WHERE i.token = ${data.token}`;
  const { user } = await validateRequest();
  if (!invite) return {
    invite: null,
    user
  };
  return {
    invite: {
      id: invite.id,
      email: invite.email,
      companyID: invite.companyID,
      status: invite.status,
      expiresAt: invite.expiresAt.toISOString(),
      companyName: invite.company_name
    },
    user
  };
}
async function acceptInvite(data) {
  const user = await requireUser();
  const [invite] = await sql`SELECT * FROM "Invite" WHERE token = ${data.token}`;
  if (!invite || invite.status !== "pending") return { error: "Invite no longer valid" };
  const [existing] = await sql`
    SELECT 1 FROM "CompanyUser"
    WHERE "companyID" = ${invite.companyID} AND "userID" = ${user.id}`;
  if (!existing) await sql`
      INSERT INTO "CompanyUser" ("companyID", "userID")
      VALUES (${invite.companyID}, ${user.id})`;
  await sql`UPDATE "Invite" SET status = 'accepted' WHERE id = ${invite.id}`;
  return {
    error: "",
    redirect: `/dash/${invite.companyID}`
  };
}

export { acceptInvite, createChannel, createCompany, createToken, deleteToken, getChannel, getCompanyChannels, getCompanyMembers, getCompanyTokens, getDashboard, getInvite, revokeInvite, sendInvite };
//# sourceMappingURL=impl.server-Mx-wvAvj.mjs.map
