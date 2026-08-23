import { createServerFn } from "@tanstack/react-start";

export const getDashboard = createServerFn({ method: "GET" }).handler(
  async () => (await import("./impl.server")).getDashboard(),
);

export const createCompany = createServerFn({ method: "POST" })
  .validator((data: { name: string }) => data)
  .handler(async ({ data }) => (await import("./impl.server")).createCompany(data));

export const getCompanyChannels = createServerFn({ method: "GET" })
  .validator((data: { companyId: string }) => data)
  .handler(async ({ data }) =>
    (await import("./impl.server")).getCompanyChannels(data),
  );

export const createChannel = createServerFn({ method: "POST" })
  .validator((data: { companyId: string; name: string; icon: string }) => data)
  .handler(async ({ data }) => (await import("./impl.server")).createChannel(data));

export const getCompanyTokens = createServerFn({ method: "GET" })
  .validator((data: { companyId: string }) => data)
  .handler(async ({ data }) =>
    (await import("./impl.server")).getCompanyTokens(data),
  );

export const createToken = createServerFn({ method: "POST" })
  .validator((data: { companyId: string; name: string }) => data)
  .handler(async ({ data }) => (await import("./impl.server")).createToken(data));

export const deleteToken = createServerFn({ method: "POST" })
  .validator((data: { tokenId: number }) => data)
  .handler(async ({ data }) => (await import("./impl.server")).deleteToken(data));

export const getCompanyMembers = createServerFn({ method: "GET" })
  .validator((data: { companyId: string }) => data)
  .handler(async ({ data }) =>
    (await import("./impl.server")).getCompanyMembers(data),
  );

export const sendInvite = createServerFn({ method: "POST" })
  .validator((data: { companyId: string; email: string }) => data)
  .handler(async ({ data }) => (await import("./impl.server")).sendInvite(data));

export const revokeInvite = createServerFn({ method: "POST" })
  .validator((data: { inviteId: string }) => data)
  .handler(async ({ data }) => (await import("./impl.server")).revokeInvite(data));

export const getChannel = createServerFn({ method: "GET" })
  .validator((data: { channelId: string }) => data)
  .handler(async ({ data }) => (await import("./impl.server")).getChannel(data));

export const getInvite = createServerFn({ method: "GET" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }) => (await import("./impl.server")).getInvite(data));

export const acceptInvite = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }) => (await import("./impl.server")).acceptInvite(data));
