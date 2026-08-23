import { Suspense } from "react";
import "@radix-ui/themes/styles.css";
import { Theme, Container } from "@radix-ui/themes";

export const metadata = {
  title: "Raterlog Login",
  description: "",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Theme
          accentColor="blue"
          grayColor="sand"
          radius="large"
          scaling="95%"
          appearance="dark"
        >
          <Container
            size="1"
            p="4"
            style={{
              minHeight: "100vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Suspense>{children}</Suspense>
          </Container>
        </Theme>
      </body>
    </html>
  );
}
