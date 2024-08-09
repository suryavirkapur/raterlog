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
  const obj = await db.user.findUnique({
    where: { id: user.id },
  });
  return (
    <html lang="en">
      <body>
        <>{obj?.name}</>
        {children}
      </body>
    </html>
  );
}
