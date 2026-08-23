import { useState } from "react";
import { Button, Card, Code, Flex, Text } from "@radix-ui/themes";
import { Eye, EyeOff } from "lucide-react";

export function TokenCard({
  tokenId,
  name,
  token,
  onDelete,
}: {
  tokenId: number;
  name: string;
  token: string;
  onDelete: (tokenId: number) => Promise<void> | void;
}) {
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <Card size="2">
      <Flex align="center" justify="between">
        <Flex direction="column" gap="1" style={{ minWidth: 0, flex: 1 }}>
          <Text weight="bold" size="3">
            {name}
          </Text>
          <Flex align="center" gap="2">
            <Code size="2" style={{ userSelect: "all" }}>
              {visible ? token : "\u2022".repeat(24)}
            </Code>
            <button
              type="button"
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
            >
              {visible ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </Flex>
        </Flex>
        <Button
          type="button"
          variant="soft"
          color="red"
          size="2"
          loading={pending}
          onClick={async () => {
            setPending(true);
            await onDelete(tokenId);
            setPending(false);
          }}
        >
          Delete
        </Button>
      </Flex>
    </Card>
  );
}
