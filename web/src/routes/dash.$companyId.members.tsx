import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  Badge,
  Button,
  Callout,
  Card,
  Flex,
  Heading,
  Separator,
  Table,
  Text,
  TextField,
} from "@radix-ui/themes";
import { getCompanyMembers, revokeInvite, sendInvite } from "@/server/data";
import { TabBar } from "@/components/TabBar";

export const Route = createFileRoute("/dash/$companyId/members")({
  loader: async ({ params }) =>
    await getCompanyMembers({ data: { companyId: params.companyId } }),
  component: MembersTab,
});

function MembersTab() {
  const { company, members, pendingInvites } = Route.useLoaderData();
  const { companyId } = Route.useParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!company) return <Text>Company not found</Text>;

  async function onInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setPending(true);
    setError(null);
    const res = await sendInvite({
      data: { companyId, email: String(fd.get("email") || "") },
    });
    setPending(false);
    if (res?.error) setError(res.error);
    else {
      form.reset();
      router.invalidate();
    }
  }

  async function onRevoke(inviteId: string) {
    await revokeInvite({ data: { inviteId } });
    router.invalidate();
  }

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
                {members.map((member) => (
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
                        <Button
                          type="button"
                          size="1"
                          variant="ghost"
                          color="red"
                          onClick={() => onRevoke(invite.id)}
                        >
                          Revoke
                        </Button>
                      </Flex>
                    </Table.Cell>
                  </Table.Row>
                ))}
                {members.length === 0 && pendingInvites.length === 0 && (
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
            <form onSubmit={onInvite}>
              {error && (
                <Callout.Root color="red" size="1" mb="3">
                  <Callout.Text>{error}</Callout.Text>
                </Callout.Root>
              )}
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
                <Button type="submit" size="3" loading={pending}>
                  Send Invite
                </Button>
              </Flex>
            </form>
          </Flex>
        </Card>
      </Flex>
    </>
  );
}
