import Link from "next/link";

import { Logo } from "@/components/Logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-[100dvh] place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          aria-label="پوستر، صفحه اصلی"
          className="mb-8 flex justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <Logo />
        </Link>
        {children}
      </div>
    </div>
  );
}
