import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@radix-ui/themes/styles.css";
import { Container, Theme } from "@radix-ui/themes";
import Nav from "@/components/nav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Raterlog",
  description: "Raterlog",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Theme
          accentColor="blue"
          grayColor="sand"
          radius="large"
          scaling="95%"
          appearance="dark"
        >
          <Nav />
          <Container p="2">{children}</Container>
        </Theme>
      </body>
    </html>
  );
}
