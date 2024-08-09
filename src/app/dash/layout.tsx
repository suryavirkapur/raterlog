import { validateRequest } from "@/lib/auth";
import db from "@/lib/db";
import { redirect } from "next/navigation";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user } = await validateRequest();
  if (!user) {
    return redirect("/signin");
  }
  return (
    <html lang="en">
      <body className="dark  dark:bg-gray-950">{children}</body>
    </html>
  );
}
