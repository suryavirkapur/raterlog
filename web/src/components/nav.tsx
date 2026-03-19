import Image from "next/image";
import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Link,
} from "@radix-ui/themes";

export default function Nav() {
  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        background: "rgba(30, 30, 30, 0.8)",
        borderBottom: "1px solid var(--gray-a4)",
      }}
    >
      <Container size="3" px="4">
        <Flex justify="between" align="center" py="3">
          <Flex align="center" gap="3">
            <a href="/" style={{ display: "flex", alignItems: "center" }}>
              <Image src="/icon.png" alt="Raterlog" width="26" height="26" />
            </a>
            <a href="/" style={{ textDecoration: "none" }}>
              <Heading size="4" weight="bold" style={{ color: "var(--gray-12)", letterSpacing: "-0.02em" }}>
                raterlog
              </Heading>
            </a>
          </Flex>
          <Flex align="center" gap="3">
            <Link
              size="2"
              href="/signup"
              style={{
                textDecoration: "none",
                color: "var(--gray-11)",
                display: "none",
              }}
            >
              Docs
            </Link>
            <Button variant="ghost" size="2" asChild>
              <Link href="/signin" style={{ textDecoration: "none" }}>Log in</Link>
            </Button>
            <Button size="2" asChild>
              <Link href="/signup" style={{ textDecoration: "none" }}>Sign up</Link>
            </Button>
          </Flex>
        </Flex>
      </Container>
    </nav>
  );
}
