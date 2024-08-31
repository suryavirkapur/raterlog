import { Container, Theme } from "@radix-ui/themes";

export const metadata = {
  title: "Raterlog",
  description: "Raterlog's Dashboard",
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
          <Container p="2">{children}</Container>
        </Theme>
      </body>
    </html>
  );
}
