import db from "@/lib/db";
import { validateRequest } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ActionResult, Form } from "@/lib/form";
import { generateId } from "lucia";
import { revalidatePath } from "next/cache";
import {
  Box,
  Button,
  Flex,
  Heading,
  Text,
  Card,
  TextField,
  Grid,
  Badge,
} from "@radix-ui/themes";
import Link from "next/link";

export default async function Page() {
  const { user } = await validateRequest();
  if (!user) return redirect("/signin");

  const companyUsers = await db.companyUser.findMany({
    where: { userID: user.id },
    include: { company: true },
  });

  return (
    <Flex direction="column" gap="6">
      <Box>
        <Heading size="6" mb="1">Welcome back, {user.name}</Heading>
        <Text size="3" color="gray">
          Manage your companies and monitoring channels
        </Text>
      </Box>

      {/* Create Company */}
      <Card size="2">
        <Flex direction="column" gap="3">
          <Heading size="4">Create a Company</Heading>
          <Form action={makeCompany}>
            <Flex direction="row" gap="3" align="end">
              <label style={{ flex: 1 }}>
                <Text as="div" size="2" mb="1" weight="medium">
                  Company Name
                </Text>
                <TextField.Root
                  name="name"
                  placeholder="Acme Corp"
                  size="3"
                />
              </label>
              <Button type="submit" size="3">
                Create
              </Button>
            </Flex>
          </Form>
        </Flex>
      </Card>

      {/* Company List */}
      {companyUsers.length > 0 && (
        <Box>
          <Heading size="4" mb="3">Your Companies</Heading>
          <Grid columns={{ initial: "1", md: "2" }} gap="3">
            {companyUsers.map((cu) => (
              <Link
                href={`/dash/${cu.companyID}`}
                key={cu.companyID}
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
                        {cu.company.name}
                      </Text>
                      <Text size="2" color="gray">
                        {cu.company.billing ? (
                          <Badge color="green" variant="soft">Active billing</Badge>
                        ) : (
                          <Badge color="gray" variant="soft">Free tier</Badge>
                        )}
                      </Text>
                    </Flex>
                    <Text size="2" color="gray">&rarr;</Text>
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

async function makeCompany(_: any, formData: FormData): Promise<ActionResult> {
  "use server";
  const name = formData.get("name");
  if (typeof name !== "string" || name.trim() === "")
    return { error: "Company name is missing." };
  const { user } = await validateRequest();
  if (!user) return { error: "Unauthorized" };
  const companyID = generateId(15);
  await db.company.create({
    data: {
      name: name,
      id: companyID,
      billing: false,
    },
  });
  await db.companyUser.create({
    data: {
      userID: user.id,
      companyID: companyID,
    },
  });

  revalidatePath(`/dash`);
  return { error: "" };
}
