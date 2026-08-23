import {
  apiOptional,
  type CompanyDetail,
  type Channel,
} from "@/lib/api";
import {
  CreateChannelForm,
  CreateTokenForm,
  InviteMemberForm,
  RevokeInviteForm,
} from "@/components/DashForms";
import { TokenCard } from "@/components/TokenCard";
import LiveLogs from "@/components/LiveLogs";
import { ChannelAiPanel } from "@/components/ChannelAiPanel";
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Text,
  Badge,
  Separator,
  Code,
  Table,
  Grid,
} from "@radix-ui/themes";
import Link from "next/link";
import { notFound } from "next/navigation";

function TabBar({
  companyId,
  companyName,
  active,
}: {
  companyId: string;
  companyName: string;
  active: string;
}) {
  const tabs = [
    { key: "channels", label: "Channels", href: `/dash/${companyId}` },
    { key: "tokens", label: "Tokens", href: `/dash/${companyId}/tokens` },
    { key: "members", label: "Members", href: `/dash/${companyId}/members` },
  ];
  return (
    <Box mb="5">
      <Heading size="6" mb="4">
        {companyName}
      </Heading>
      <Flex gap="1" style={{ borderBottom: "1px solid var(--gray-a5)" }}>
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            style={{
              textDecoration: "none",
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: active === tab.key ? 600 : 400,
              color: active === tab.key ? "var(--accent-9)" : "var(--gray-11)",
              borderBottom:
                active === tab.key
                  ? "2px solid var(--accent-9)"
                  : "2px solid transparent",
              marginBottom: "-1px",
            }}
          >
            {tab.label}
          </Link>
        ))}
      </Flex>
    </Box>
  );
}

export default async function Page({ params }: { params: { slug: string[] } }) {
  const detail = await apiOptional<CompanyDetail>(
    `/api/companies/${params.slug[0]}`
  );
  if (!detail) return <Text>Company not found</Text>;
  const company = detail.company;

  if (params.slug.length === 1 || params.slug[1] === "channels") {
    return (
      <>
        <TabBar companyId={company.id} companyName={company.name} active="channels" />
        <Flex direction="column" gap="4">
          {detail.insights.length > 0 && (
            <Grid columns={{ initial: "2", md: "4" }} gap="3">
              {detail.insights.map((insight) => (
                <Card size="2" key={insight.id}>
                  <Text size="5">{insight.icon || "📌"}</Text>
                  <Text size="1" color="gray" as="div">
                    {insight.title}
                  </Text>
                  <Heading size="5">{insight.value}</Heading>
                </Card>
              ))}
            </Grid>
          )}
          {detail.channels.length > 0 ? (
            <Flex direction="column" gap="2">
              {detail.channels.map((channel) => (
                <Link
                  href={`/dash/${company.id}/${channel.id}`}
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
              <CreateChannelForm companyId={company.id} />
            </Flex>
          </Card>
        </Flex>
      </>
    );
  }

  if (params.slug.length === 2 && params.slug[1] === "tokens") {
    return (
      <>
        <TabBar companyId={company.id} companyName={company.name} active="tokens" />
        <Flex direction="column" gap="4">
          {detail.tokens.length > 0 ? (
            <Flex direction="column" gap="2">
              {detail.tokens.map((token) => (
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
              <CreateTokenForm companyId={company.id} />
            </Flex>
          </Card>
        </Flex>
      </>
    );
  }

  if (params.slug.length === 2 && params.slug[1] === "members") {
    const pendingInvites = detail.invites.filter((i) => i.status === "pending");
    return (
      <>
        <TabBar companyId={company.id} companyName={company.name} active="members" />
        <Flex direction="column" gap="4">
          <Card size="2">
            <Flex direction="column" gap="4">
              <Heading size="4">Team Members</Heading>
              <Table.Root variant="surface">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Email</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {detail.members.map((member) => (
                    <Table.Row key={member.id}>
                      <Table.Cell>
                        <Text weight="bold" size="2">
                          {member.name}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2" color="gray">
                          {member.email}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color="green" variant="soft">
                          Member
                        </Badge>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                  {pendingInvites.map((invite) => (
                    <Table.Row key={invite.id}>
                      <Table.Cell>
                        <Text size="2" color="gray">
                          &mdash;
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2">{invite.email}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Flex align="center" gap="2">
                          <Badge color="orange" variant="soft">
                            Pending
                          </Badge>
                          <RevokeInviteForm
                            companyId={company.id}
                            inviteId={invite.id}
                          />
                        </Flex>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                  {detail.members.length === 0 && pendingInvites.length === 0 && (
                    <Table.Row>
                      <Table.Cell colSpan={3}>
                        <Text color="gray" size="2">
                          No members yet
                        </Text>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table.Root>
            </Flex>
          </Card>
          <Separator size="4" />
          <Card size="2">
            <Flex direction="column" gap="3">
              <Heading size="4">Invite a Team Member</Heading>
              <InviteMemberForm companyId={company.id} />
            </Flex>
          </Card>
        </Flex>
      </>
    );
  }

  if (params.slug.length === 2) {
    const channel: Channel | undefined = detail.channels.find(
      (c) => c.id === params.slug[1]
    );
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
          <Link href={`/dash/${company.id}`}>
            <Button variant="soft" size="2">
              &larr; Back to channels
            </Button>
          </Link>
        </Flex>
        <Separator size="4" />
        <ChannelAiPanel channelId={channel.id} />
        <LiveLogs channelID={channel.id} icon={channel.icon} />
      </Flex>
    );
  }

  return notFound();
}
