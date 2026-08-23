import { Box, Button, Container, Flex, Heading } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";

export default function Nav() {
  return (
    <Box
      asChild
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
      <nav>
        <Container size="3" px="4">
          <Flex justify="between" align="center" py="3">
            <Flex align="center" gap="3">
              <Link to="/" style={{ display: "flex", alignItems: "center" }}>
                <img src="/icon.png" alt="Raterlog" width={26} height={26} />
              </Link>
              <Link to="/" style={{ textDecoration: "none" }}>
                <Heading
                  size="4"
                  weight="bold"
                  style={{ color: "var(--gray-12)", letterSpacing: "-0.02em" }}
                >
                  raterlog
                </Heading>
              </Link>
            </Flex>
            <Flex align="center" gap="3">
              <Button variant="ghost" size="2" asChild>
                <Link to="/signin" style={{ textDecoration: "none" }}>
                  Log in
                </Link>
              </Button>
              <Button size="2" asChild>
                <Link to="/signup" style={{ textDecoration: "none" }}>
                  Sign up
                </Link>
              </Button>
            </Flex>
          </Flex>
        </Container>
      </nav>
    </Box>
  );
}
