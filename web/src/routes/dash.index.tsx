import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  Badge,
  Box,
  Button,
  Callout,
  Card,
  Flex,
  Grid,
  Heading,
  Text,
  TextField,
} from "@radix-ui/themes";
import { createCompany, getDashboard } from "@/server/data";

export const Route = createFileRoute("/dash/")({
  loader: async () => await getDashboard(),
  component: DashHome,
});

function DashHome() {
  const { user, companies } = Route.useLoaderData();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setPending(true);
    setError(null);
    const res = await createCompany({ data: { name: String(fd.get("name") || "") } });
    setPending(false);
    if (res?.error) {
      setError(res.error);
    } else {
      form.reset();
      router.invalidate();
    }
  }

  return (
    <Flex direction="column" gap="6">
      <Box>
        <Heading size="6" mb="1">
          Welcome back, {user.name}
        </Heading>
        <Text size="3" color="gray">
          Manage your companies and monitoring channels
        </Text>
      </Box>

      <Card size="2">
        <Flex direction="column" gap="3">
          <Heading size="4">Create a Company</Heading>
          <form onSubmit={onCreate}>
            {error && (
              <Callout.Root color="red" size="1" mb="3">
                <Callout.Text>{error}</Callout.Text>
              </Callout.Root>
            )}
            <Flex direction="row" gap="3" align="end">
              <label style={{ flex: 1 }}>
                <Text as="div" size="2" mb="1" weight="medium">
                  Company Name
                </Text>
                <TextField.Root name="name" placeholder="Acme Corp" size="3" />
              </label>
              <Button type="submit" size="3" loading={pending}>
                Create
              </Button>
            </Flex>
          </form>
        </Flex>
      </Card>

      {companies.length > 0 && (
        <Box>
          <Heading size="4" mb="3">
            Your Companies
          </Heading>
          <Grid columns={{ initial: "1", md: "2" }} gap="3">
            {companies.map((c) => (
              <Link
                to="/dash/$companyId"
                params={{ companyId: c.id }}
                key={c.id}
                style={{ textDecoration: "none" }}
              >
                <Card size="2" style={{ cursor: "pointer" }}>
                  <Flex align="center" justify="between">
                    <Flex direction="column" gap="1">
                      <Text weight="bold" size="3">
                        {c.name}
                      </Text>
                      <Text size="2" color="gray">
                        {c.billing ? (
                          <Badge color="green" variant="soft">
                            Active billing
                          </Badge>
                        ) : (
                          <Badge color="gray" variant="soft">
                            Free tier
                          </Badge>
                        )}
                      </Text>
                    </Flex>
                    <Text size="2" color="gray">
                      &rarr;
                    </Text>
                  </Flex>
                </Card>
              </Link>
            ))}
          </Grid>
        </Box>
      )}
    </Flex>
  );
}
