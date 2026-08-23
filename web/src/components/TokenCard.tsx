"use client";

import { useState } from "react";
import { Card, Flex, Text, Code, Button } from "@radix-ui/themes";
import { Eye, EyeOff } from "lucide-react";
import { Form, ActionResult } from "@/lib/form";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

export function TokenCard({
  tokenId,
  name,
  token,
  companyId,
}: {
  tokenId: number;
  name: string;
  token: string;
  companyId: string;
}) {
  const [visible, setVisible] = useState(false);
  const router = useRouter();

  async function remove(): Promise<ActionResult> {
    try {
      await api(`/api/companies/${companyId}/tokens/${tokenId}`, {
        method: "DELETE",
      });
      router.refresh();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Delete failed" };
    }
  }

  return (
    <Card size="2">
      <Flex align="center" justify="between">
        <Flex direction="column" gap="1" style={{ minWidth: 0, flex: 1 }}>
          <Text weight="bold" size="3">
            {name}
          </Text>
          <Flex align="center" gap="2">
            <Code size="2" style={{ userSelect: "all" }}>
              {visible ? token : "•".repeat(24)}
            </Code>
            <button
              onClick={() => setVisible(!visible)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--gray-10)",
                padding: "2px",
                display: "flex",
                alignItems: "center",
              }}
              type="button"
            >
              {visible ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </Flex>
        </Flex>
        <Form action={remove}>
          <Button type="submit" variant="soft" color="red" size="2">
            Delete
          </Button>
        </Form>
      </Flex>
    </Card>
  );
}
