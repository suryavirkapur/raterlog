import Nav from "@/components/nav";
import { Flex, Button, Text, Heading, Box, Grid, Card } from "@radix-ui/themes";

export default function Home() {
  return (
    <>
      <CallToAction />
      <Features />
    </>
  );
}

function CallToAction() {
  return (
    <Flex direction="column" gapY="5" mt="5">
      <Heading size="9">
        Realtime monitoring <br /> for your entire business.
      </Heading>
      <Text size="4">
        Track every inch of your product, monitor potential issues or <br />
        opportunities, and respond by making data-driven decisions.
      </Text>
      <Box>
        <Button size="4">Let&apos;s go</Button>
      </Box>
    </Flex>
  );
}

function Features() {
  return (
    <Flex direction="column" gapY="5" mt="5">
      <Flex
        direction={{ initial: "column", md: "row" }}
        justify="between"
        align="center"
      >
        <Heading size="9">
          Made for modern
          <br /> product teams
        </Heading>
        <Text size="4">
          Track every inch of your product, monitor potential issues or <br />
          opportunities, and respond by making data-driven decisions.
        </Text>
      </Flex>
      <Grid columns={{ initial: "1", md: "2", lg: "3" }} gap="4">
        <Card>
          <Box height="150px"></Box>
          <Heading>Purpose built for </Heading>
        </Card>
        <Card>
          <Box height="150px"></Box>
          <Heading>Lightning quick</Heading>
        </Card>
        <Card>
          <Box height="150px"></Box>
          <Heading>10,000 events free</Heading>
        </Card>
      </Grid>
    </Flex>
  );
}
