import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  Button,
  Callout,
  Card,
  Code,
  Flex,
  Grid,
  Heading,
  Separator,
  Text,
  TextField,
} from "@radix-ui/themes";
import { api, apiOptional, type CompanyDetail } from "@/lib/api";
import { TabBar } from "@/components/TabBar";

export const Route = createFileRoute("/dash/$companyId/")({
  loader: async ({ params }) =>
    apiOptional<CompanyDetail>(`/api/companies/${params.companyId}`),
  component: ChannelsTab,
});

function ChannelsTab() {
  const detail = Route.useLoaderData();
  const { companyId } = Route.useParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!detail) return <Text>Company not found</Text>;
  const { company, channels, insights } = detail;

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    const icon = String(fd.get("icon") || "").trim();
    if (!name) return setError("Name is empty");
    if (!icon) return setError("Icon is empty");
    setPending(true);
    setError(null);
    try {
      await api(`/api/companies/${companyId}/channels`, {
        method: "POST",
        body: JSON.stringify({ name, icon }),
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
      <TabBar companyId={company.id} companyName={company.name} active="channels" />
      <Flex direction="column" gap="4">
        {insights.length > 0 && (
          <Grid columns={{ initial: "2", md: "4" }} gap="3">
            {insights.map((insight) => (
              <Card size="2" key={insight.id}>
                <Text size="5">{insight.icon || "\u{1F4CC}"}</Text>
                <Text size="1" color="gray" as="div">
                  {insight.title}
                </Text>
                <Heading size="5">{insight.value}</Heading>
              </Card>
            ))}
          </Grid>
        )}
        {channels.length > 0 ? (
          <Flex direction="column" gap="2">
            {channels.map((channel) => (
              <Link
                to="/dash/$companyId/$channelId"
                params={{ companyId: company.id, channelId: channel.id }}
                key={channel.id}
                style={{ textDecoration: "none" }}
              >
                <Card size="2" style={{ cursor: "pointer" }}>
                  <Flex align="center" gap="3">
                    <Text size="5">{channel.icon}</Text>
                    <Flex direction="column" gap="1">
                      <Text weight="bold" size="3">
                        {channel.name}
                      </Text>
                      <Text size="1" color="gray">
                        <Code size="1">{channel.id}</Code>
                      </Text>
                    </Flex>
                  </Flex>
                </Card>
              </Link>
            ))}
          </Flex>
        ) : (
          <Card size="2">
            <Flex direction="column" align="center" gap="2" py="4">
              <Text color="gray">No channels yet</Text>
              <Text size="2" color="gray">
                Create your first channel below to start logging events
              </Text>
            </Flex>
          </Card>
        )}

        <Separator size="4" />

        <Card size="2">
          <Flex direction="column" gap="3">
            <Heading size="4">Create a Channel</Heading>
            <form onSubmit={onCreate}>
              {error && (
                <Callout.Root color="red" size="1" mb="3">
                  <Callout.Text>{error}</Callout.Text>
                </Callout.Root>
              )}
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
                <Button type="submit" size="3" loading={pending}>
                  Create
                </Button>
              </Flex>
            </form>
          </Flex>
        </Card>
      </Flex>
    </>
  );
}
