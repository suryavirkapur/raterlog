import { api, type Company, type User } from "@/lib/api";
import { CreateCompanyForm } from "@/components/DashForms";
import {
  Box,
  Flex,
  Heading,
  Text,
  Card,
  Grid,
  Badge,
} from "@radix-ui/themes";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function Page() {
  const user = await api<User>("/api/auth/me").catch(() => null);
  if (!user) return redirect("/signin");
  const companies = await api<Company[]>("/api/companies");

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
          <CreateCompanyForm />
        </Flex>
      </Card>

      {companies.length > 0 && (
        <Box>
          <Heading size="4" mb="3">
            Your Companies
          </Heading>
          <Grid columns={{ initial: "1", md: "2" }} gap="3">
            {companies.map((company) => (
              <Link
                href={`/dash/${company.id}`}
                key={company.id}
                style={{ textDecoration: "none" }}
              >
                <Card
                  size="2"
                  style={{
                    cursor: "pointer",
                    transition: "background-color 0.15s",
                  }}
                >
                  <Flex align="center" justify="between">
                    <Flex direction="column" gap="1">
                      <Text weight="bold" size="3">
                        {company.name}
                      </Text>
                      <Text size="2" color="gray">
                        {company.billing ? (
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
