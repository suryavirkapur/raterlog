"use client";

import { api } from "@/lib/api";
import { ActionResult, Form } from "@/lib/form";
import { Button, Flex, Text, TextField } from "@radix-ui/themes";
import { useRouter } from "next/navigation";

export function CreateCompanyForm() {
  const router = useRouter();
  async function create(formData: FormData): Promise<ActionResult> {
    const name = String(formData.get("name") || "").trim();
    if (!name) return { error: "Company name is missing." };
    try {
      await api("/api/companies", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      router.refresh();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Create failed" };
    }
  }
  return (
    <Form action={create}>
      <Flex direction="row" gap="3" align="end">
        <label style={{ flex: 1 }}>
          <Text as="div" size="2" mb="1" weight="medium">
            Company Name
          </Text>
          <TextField.Root name="name" placeholder="Acme Corp" size="3" />
        </label>
        <Button type="submit" size="3">
          Create
        </Button>
      </Flex>
    </Form>
  );
}

export function CreateChannelForm({ companyId }: { companyId: string }) {
  const router = useRouter();
  async function create(formData: FormData): Promise<ActionResult> {
    const name = String(formData.get("name") || "").trim();
    const icon = String(formData.get("icon") || "").trim();
    if (!name) return { error: "Name is empty" };
    if (!icon) return { error: "Icon is empty" };
    try {
      await api(`/api/companies/${companyId}/channels`, {
        method: "POST",
        body: JSON.stringify({ name, icon }),
      });
      router.refresh();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Create failed" };
    }
  }
  return (
    <Form action={create}>
      <Flex direction="row" gap="3" align="end">
        <label style={{ flex: 1 }}>
          <Text as="div" size="2" mb="1" weight="medium">
            Channel Name
          </Text>
          <TextField.Root
            name="name"
            placeholder="e.g. signups, errors, purchases"
            size="3"
          />
        </label>
        <label style={{ width: "100px" }}>
          <Text as="div" size="2" mb="1" weight="medium">
            Icon
          </Text>
          <TextField.Root name="icon" placeholder="🚀" size="3" />
        </label>
        <Button type="submit" size="3">
          Create
        </Button>
      </Flex>
    </Form>
  );
}

export function CreateTokenForm({ companyId }: { companyId: string }) {
  const router = useRouter();
  async function create(formData: FormData): Promise<ActionResult> {
    const name = String(formData.get("name") || "").trim();
    if (!name) return { error: "Token name is required" };
    try {
      await api(`/api/companies/${companyId}/tokens`, {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      router.refresh();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Create failed" };
    }
  }
  return (
    <Form action={create}>
      <Flex direction="row" gap="3" align="end">
        <label style={{ flex: 1 }}>
          <Text as="div" size="2" mb="1" weight="medium">
            Token Name
          </Text>
          <TextField.Root
            name="name"
            placeholder="e.g. production-server, staging"
            size="3"
          />
        </label>
        <Button type="submit" size="3">
          Generate Token
        </Button>
      </Flex>
    </Form>
  );
}

export function InviteMemberForm({ companyId }: { companyId: string }) {
  const router = useRouter();
  async function invite(formData: FormData): Promise<ActionResult> {
    const email = String(formData.get("email") || "").trim();
    if (!email.includes("@")) return { error: "Valid email is required" };
    try {
      await api(`/api/companies/${companyId}/invites`, {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      router.refresh();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Invite failed" };
    }
  }
  return (
    <Form action={invite}>
      <Flex direction="row" gap="3" align="end">
        <label style={{ flex: 1 }}>
          <Text as="div" size="2" mb="1" weight="medium">
            Email Address
          </Text>
          <TextField.Root
            name="email"
            type="email"
            placeholder="colleague@company.com"
            size="3"
          />
        </label>
        <Button type="submit" size="3">
          Send Invite
        </Button>
      </Flex>
    </Form>
  );
}

export function RevokeInviteForm({
  companyId,
  inviteId,
}: {
  companyId: string;
  inviteId: string;
}) {
  const router = useRouter();
  async function revoke(): Promise<ActionResult> {
    try {
      await api(`/api/companies/${companyId}/invites/${inviteId}`, {
        method: "DELETE",
      });
      router.refresh();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Revoke failed" };
    }
  }
  return (
    <Form action={revoke}>
      <Button type="submit" size="1" variant="ghost" color="red">
        Revoke
      </Button>
    </Form>
  );
}
