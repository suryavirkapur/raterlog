import { createServerFn } from "@tanstack/react-start";
import type { LoginInput, SignupInput } from "./auth.server";

export const getAuth = createServerFn({ method: "GET" }).handler(async () => {
  const m = await import("./auth.server");
  return m.getAuthUser();
});

export const signupFn = createServerFn({ method: "POST" })
  .validator((data: SignupInput) => data)
  .handler(async ({ data }) => {
    const m = await import("./auth.server");
    return m.doSignup(data);
  });

export const loginFn = createServerFn({ method: "POST" })
  .validator((data: LoginInput) => data)
  .handler(async ({ data }) => {
    const m = await import("./auth.server");
    return m.doLogin(data);
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  const m = await import("./auth.server");
  return m.doLogout();
});
