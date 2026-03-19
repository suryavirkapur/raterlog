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
  Container,
  Badge,
  Separator,
} from "@radix-ui/themes";
import NextLink from "next/link";

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
    <Flex
      direction="column"
      gapY="6"
      py="9"
      align="center"
      style={{ textAlign: "center" }}
    >
      <Badge size="2" variant="soft">Real-time monitoring platform</Badge>
      <Heading size="9" style={{ maxWidth: "700px", lineHeight: 1.1 }}>
        Realtime monitoring{" "}
        <span style={{ color: "var(--accent-9)" }}>for your entire business</span>
      </Heading>
      <Text size="4" color="gray" style={{ maxWidth: "550px" }}>
        Track every inch of your product, monitor potential issues or
        opportunities, and respond by making data-driven decisions.
      </Text>
      <Box>
        <Button size="4" asChild>
          <NextLink href="/signup">Get started free</NextLink>
        </Button>
      </Box>
    </Flex>
  );
}

function Features() {
  return (
    <Flex direction="column" gapY="6" py="9">
      <Flex
        direction={{ initial: "column", md: "row" }}
        justify="between"
        align="start"
        gap="4"
      >
        <Heading size="8" style={{ maxWidth: "400px" }}>
          Made for modern product teams
        </Heading>
        <Text size="4" color="gray" style={{ maxWidth: "400px" }}>
          Everything you need to monitor your product events in real-time,
          from ingestion to visualization.
        </Text>
      </Flex>
      <Grid columns={{ initial: "1", md: "3" }} gap="4">
        {[
          {
            icon: "\u{1F3AF}",
            title: "Purpose built",
            desc: "Designed specifically for modern product teams who need real-time event tracking",
          },
          {
            icon: "\u26A1",
            title: "Lightning quick",
            desc: "Get real-time insights in milliseconds with our high-performance event pipeline",
          },
          {
            icon: "\u{1F4B0}",
            title: "10,000 events free",
            desc: "Start monitoring with a generous free tier, no credit card required",
          },
        ].map((feature, index) => (
          <Card key={index} size="2">
            <Flex direction="column" gap="3" py="2">
              <Text size="6">{feature.icon}</Text>
              <Heading size="4">{feature.title}</Heading>
              <Text size="2" color="gray">{feature.desc}</Text>
            </Flex>
          </Card>
        ))}
      </Grid>
    </Flex>
  );
}

function Testimonials() {
  return (
    <Flex direction="column" gapY="6" py="9" align="center">
      <Heading size="8">What our customers say</Heading>
      <Grid columns={{ initial: "1", md: "2" }} gap="4" style={{ maxWidth: "800px" }}>
        {[
          {
            name: "John Doe",
            role: "CTO, TechCorp",
            content:
              "This tool has revolutionized how we monitor our products. The real-time dashboards are exactly what we needed.",
          },
          {
            name: "Jane Smith",
            role: "Product Manager, InnovateCo",
            content:
              "The insights we've gained have been invaluable for our decision-making process. Setup took minutes.",
          },
        ].map((testimonial, index) => (
          <Card key={index} size="2">
            <Flex direction="column" gap="3">
              <Text size="3" style={{ fontStyle: "italic" }}>
                &ldquo;{testimonial.content}&rdquo;
              </Text>
              <Separator size="4" />
              <Flex align="center" gap="3">
                <Avatar fallback={testimonial.name[0]} size="2" />
                <Box>
                  <Text weight="bold" size="2">{testimonial.name}</Text>
                  <br />
                  <Text size="1" color="gray">
                    {testimonial.role}
                  </Text>
                </Box>
              </Flex>
            </Flex>
          </Card>
        ))}
      </Grid>
    </Flex>
  );
}

function Pricing() {
  return (
    <Flex direction="column" gapY="6" py="9" align="center">
      <Box style={{ textAlign: "center" }}>
        <Heading size="8" mb="2">Simple, transparent pricing</Heading>
        <Text size="3" color="gray">Start free, scale as you grow</Text>
      </Box>
      <Grid columns={{ initial: "1", md: "3" }} gap="4" style={{ maxWidth: "900px" }}>
        {[
          {
            name: "Starter",
            price: "$9",
            features: [
              "Up to 50,000 events",
              "5 team members",
              "Basic analytics",
            ],
            highlighted: false,
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
            highlighted: true,
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
            highlighted: false,
          },
        ].map((plan, index) => (
          <Card
            key={index}
            size="3"
            style={plan.highlighted ? { border: "2px solid var(--accent-9)" } : {}}
          >
            <Flex direction="column" gap="3">
              <Text size="2" weight="bold" color="gray">{plan.name}</Text>
              <Flex align="end" gap="1">
                <Heading size="8">{plan.price}</Heading>
                {plan.price !== "Custom" && (
                  <Text size="2" color="gray" style={{ marginBottom: "8px" }}>/mo</Text>
                )}
              </Flex>
              <Separator size="4" />
              <Flex direction="column" gap="2">
                {plan.features.map((feature, i) => (
                  <Flex key={i} align="center" gap="2">
                    <Text size="2" color="green">&check;</Text>
                    <Text size="2">{feature}</Text>
                  </Flex>
                ))}
              </Flex>
              <Button
                mt="2"
                variant={plan.highlighted ? "solid" : "outline"}
                size="3"
                asChild
              >
                <NextLink href="/signup">
                  {plan.price === "Custom" ? "Contact sales" : "Get started"}
                </NextLink>
              </Button>
            </Flex>
          </Card>
        ))}
      </Grid>
    </Flex>
  );
}

function Footer() {
  return (
    <footer>
    <Flex
      justify="between"
      align="center"
      py="6"
      mt="4"
      style={{ borderTop: "1px solid var(--gray-a5)" }}
    >
      <Text size="2" color="gray">&copy; 2024 Raterlog. All rights reserved.</Text>
      <Flex gap="4">
        <Link size="2" href="#" style={{ textDecoration: "none" }}>Terms</Link>
        <Link size="2" href="#" style={{ textDecoration: "none" }}>Privacy</Link>
        <Link size="2" href="#" style={{ textDecoration: "none" }}>Contact</Link>
      </Flex>
    </Flex>
    </footer>
  );
}
