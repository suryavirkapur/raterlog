import {
  Flex,
  Button,
  Text,
  Heading,
  Box,
  Grid,
  Card,
  Avatar,
  Link,
} from "@radix-ui/themes";

export default function Home() {
  return (
    <>
      <CallToAction />
      <Features />
      <Testimonials />
      <Pricing />
      <Footer />
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
          <Box
            height="150px"
            style={{ background: "url('/feature1.jpg') center/cover" }}
          ></Box>
          <Heading size="6">Purpose built</Heading>
          <Text>Designed specifically for modern product teams</Text>
        </Card>
        <Card>
          <Box
            height="150px"
            style={{ background: "url('/feature2.jpg') center/cover" }}
          ></Box>
          <Heading size="6">Lightning quick</Heading>
          <Text>Get real-time insights in milliseconds</Text>
        </Card>
        <Card>
          <Box
            height="150px"
            style={{ background: "url('/feature3.jpg') center/cover" }}
          ></Box>
          <Heading size="6">10,000 events free</Heading>
          <Text>Start monitoring with a generous free tier</Text>
        </Card>
      </Grid>
    </Flex>
  );
}

function Testimonials() {
  return (
    <Flex direction="column" gapY="5" mt="9">
      <Heading size="8" align="center">
        What our customers say
      </Heading>
      <Grid columns={{ initial: "1", md: "2" }} gap="4">
        {[
          {
            name: "John Doe",
            role: "CTO, TechCorp",
            content:
              "This tool has revolutionized how we monitor our products.",
          },
          {
            name: "Jane Smith",
            role: "Product Manager, InnovateCo",
            content:
              "The insights we've gained have been invaluable for our decision-making process.",
          },
        ].map((testimonial, index) => (
          <Card key={index}>
            <Flex align="center" gap="3">
              <Avatar fallback={testimonial.name[0]} />
              <Box>
                <Text weight="bold">{testimonial.name}</Text>
                <br />
                <Text size="2" color="gray">
                  {testimonial.role}
                </Text>
              </Box>
            </Flex>
            <Text mt="3">{testimonial.content}</Text>
          </Card>
        ))}
      </Grid>
    </Flex>
  );
}

function Pricing() {
  return (
    <Flex direction="column" gapY="5" mt="9">
      <Heading size="8" align="center">
        Simple, transparent pricing
      </Heading>
      <Grid columns={{ initial: "1", md: "3" }} gap="4">
        {[
          {
            name: "Starter",
            price: "$9",
            features: [
              "Up to 50,000 events",
              "5 team members",
              "Basic analytics",
            ],
          },
          {
            name: "Pro",
            price: "$29",
            features: [
              "Up to 500,000 events",
              "Unlimited team members",
              "Advanced analytics",
              "Priority support",
            ],
          },
          {
            name: "Enterprise",
            price: "Custom",
            features: [
              "Unlimited events",
              "Dedicated account manager",
              "Custom integrations",
              "24/7 support",
            ],
          },
        ].map((plan, index) => (
          <Card key={index}>
            <Heading size="6">{plan.name}</Heading>
            <Text size="8" weight="bold" mt="2">
              {plan.price}
            </Text>
            <Text size="2" color="gray">
              per month
            </Text>
            <Flex direction="column" gap="2" mt="4">
              {plan.features.map((feature, i) => (
                <Flex key={i} align="center" gap="2">
                  <Box>✓</Box>
                  <Text>{feature}</Text>
                </Flex>
              ))}
            </Flex>
            <Button mt="4" variant={index === 1 ? "solid" : "outline"}>
              Choose plan
            </Button>
          </Card>
        ))}
      </Grid>
    </Flex>
  );
}

function Footer() {
  return (
    <Flex
      as="footer"
      justify="between"
      mt="9"
      pt="5"
      style={{ borderTop: "1px solid var(--gray-5)" }}
    >
      <Text>© 2024 Raterlog. All rights reserved.</Text>
      <Flex gap="4">
        <Link style={{ textDecoration: "none" }}>Terms</Link>
        <Link href="#" style={{ textDecoration: "none" }}>
          Privacy
        </Link>
        <Link href="#" style={{ textDecoration: "none" }}>
          Contact
        </Link>
      </Flex>
    </Flex>
  );
}
