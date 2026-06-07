import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Box,
  Button,
  Code,
  Flex,
  Heading,
  Separator,
  Text,
} from "@radix-ui/themes";
import { apiOptional, type CompanyDetail } from "@/lib/api";
import { ChannelAiPanel } from "@/components/ChannelAiPanel";
import LiveLogs from "@/components/LiveLogs";

export const Route = createFileRoute("/dash/$companyId/$channelId")({
  loader: async ({ params }) =>
    apiOptional<CompanyDetail>(`/api/companies/${params.companyId}`),
  component: ChannelDetail,
});

function ChannelDetail() {
  const detail = Route.useLoaderData();
  const { companyId, channelId } = Route.useParams();

  if (!detail) return <Text>Company not found</Text>;
  const channel = detail.channels.find((c) => c.id === channelId);
  if (!channel) return <Text>Channel not found</Text>;

  return (
    <Flex direction="column" gap="5">
      <Flex align="center" justify="between">
        <Box>
          <Flex align="center" gap="3" mb="1">
            <Text size="6">{channel.icon}</Text>
            <Heading size="6">{channel.name}</Heading>
          </Flex>
          <Text size="2" color="gray">
            Channel ID: <Code size="1">{channel.id}</Code>
          </Text>
        </Box>
        <Button variant="soft" size="2" asChild>
          <Link to="/dash/$companyId" params={{ companyId }}>
            &larr; Back to channels
          </Link>
        </Button>
      </Flex>

      <Separator size="4" />

      <ChannelAiPanel channelId={channel.id} />
      <LiveLogs channelID={channel.id} icon={channel.icon} />
    </Flex>
  );
}
