import Image from "next/image";
import {
  Box,
  Button,
  Card,
  Container,
  Flex,
  Heading,
  Link,
} from "@radix-ui/themes";

export default function Nav() {
  return (
    <Container size="2">
      <Box
        style={{ border: "1px solid var(--gray-a7)", borderRadius: "12px" }}
        p="1"
      >
        <Flex justify="between" direction="row" align="center">
          <Flex justify="between" direction="row" align="center" gapX="2">
            <a href="/">
              <Image src="/icon.png" alt="Logo" width="28" height="28" />
            </a>
            <a href="/">
              <Heading size="5">raterlog</Heading>
            </a>
          </Flex>
          <Flex justify="between" gapX="4" direction="row" align="center">
            <Link>about</Link>
            <Button asChild>
              <Link href="/signin">login</Link>
            </Button>
          </Flex>
        </Flex>
      </Box>
    </Container>
  );
}
