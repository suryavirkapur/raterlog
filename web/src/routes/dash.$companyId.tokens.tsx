import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  Button,
  Callout,
  Card,
  Flex,
  Heading,
  Separator,
  Text,
  TextField,
} from "@radix-ui/themes";
import { api, apiOptional, type CompanyDetail } from "@/lib/api";
import { TabBar } from "@/components/TabBar";
import { TokenCard } from "@/components/TokenCard";

export const Route = createFileRoute("/dash/$companyId/tokens")({
  loader: async ({ params }) =>
    apiOptional<CompanyDetail>(`/api/companies/${params.companyId}`),
  component: TokensTab,
});

function TokensTab() {
  const detail = Route.useLoaderData();
  const { companyId } = Route.useParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!detail) return <Text>Company not found</Text>;
  const { company, tokens } = detail;

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    if (!name) return setError("Token name is required");
    setPending(true);
    setError(null);
    try {
      await api(`/api/companies/${companyId}/tokens`, {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      form.reset();
      router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <TabBar companyId={company.id} companyName={company.name} active="tokens" />
      <Flex direction="column" gap="4">
        {tokens.length > 0 ? (
          <Flex direction="column" gap="2">
            {tokens.map((token) => (
              <TokenCard
                key={token.id}
                tokenId={token.id}
                name={token.name}
                token={token.token}
                companyId={company.id}
              />
            ))}
          </Flex>
        ) : (
          <Card size="2">
            <Flex direction="column" align="center" gap="2" py="4">
              <Text color="gray">No tokens yet</Text>
              <Text size="2" color="gray">
                Create a token to authenticate API requests
              </Text>
            </Flex>
          </Card>
        )}

        <Separator size="4" />

        <Card size="2">
          <Flex direction="column" gap="3">
            <Heading size="4">Create a Token</Heading>
            <form onSubmit={onCreate}>
              {error && (
                <Callout.Root color="red" size="1" mb="3">
                  <Callout.Text>{error}</Callout.Text>
                </Callout.Root>
              )}
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
                <Button type="submit" size="3" loading={pending}>
                  Generate Token
                </Button>
              </Flex>
            </form>
          </Flex>
        </Card>
      </Flex>
    </>
  );
}
