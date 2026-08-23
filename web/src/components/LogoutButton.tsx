"use client";

import { api } from "@/lib/api";
import { ActionResult, Form } from "@/lib/form";
import { Button } from "@radix-ui/themes";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  async function logout(): Promise<ActionResult> {
    try {
      await api("/api/auth/signout", { method: "POST", body: "{}" });
      router.push("/");
      router.refresh();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Logout failed" };
    }
  }
  return (
    <Form action={logout}>
      <Button type="submit" variant="soft" size="1">
        Logout
      </Button>
    </Form>
  );
}
