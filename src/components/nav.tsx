import Link from "next/link";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { JSX, SVGProps } from "react";

const links = [
  {
    text: "Home",
    link: "/",
  },
  {
    text: "Login",
    link: "/signin",
  },
];
export function Nav() {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-br from-slate-500 via-slate-700 to-zinc-800 text-white dark:text-black rounded-sm dark:bg-gray-800 max-w-screen-md mx-auto mt-2">
      <Link href="#" className="flex items-center gap-2" prefetch={false}>
        <span className="text-lg font-black">RATERLOG</span>
      </Link>
      <div className="hidden md:flex gap-2">
        {links.map(({ link, text }, index) => (
          <Link
            href={link}
            className="text-md font-medium hover:opacity-80 underline-offset-4"
            prefetch={false}
            key={index}
          >
            {text}
          </Link>
        ))}
      </div>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="lg:hidden">
            <MenuIcon className="h-6 w-6" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="right">
          <div className="grid w-[200px] p-4">
            {links.map(({ link, text }, index) => (
              <Link
                href={link}
                className="text-lg font-medium hover:opacity-70 underline-offset-4"
                prefetch={false}
                key={index}
              >
                {text}
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MenuIcon(props: JSX.IntrinsicAttributes & SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}
