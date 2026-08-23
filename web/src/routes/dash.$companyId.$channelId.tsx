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
import { getChannel } from "@/server/data";
import LiveLogs from "@/components/LiveLogs";

export const Route = createFileRoute("/dash/$companyId/$channelId")({
  loader: async ({ params }) =>
    await getChannel({ data: { channelId: params.channelId } }),
  component: ChannelDetail,
});

function ChannelDetail() {
  const { channel, token } = Route.useLoaderData();
  const { companyId } = Route.useParams();

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

      <LiveLogs channelID={channel.id} token={token} icon={channel.icon} />
    </Flex>
  );
}
