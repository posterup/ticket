import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";

// Self-hosted Vazirmatn (variable). Bundled at build time so the deploy has no
// external font dependency (avoids build-time Google Fonts fetch failures).
import "@fontsource-variable/vazirmatn";
import "./globals.css";

import { AUTH_COOKIE } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "پوستر | پلتفرم برگزاری و بلیت‌فروشی تجربه و رویداد",
  description:
    "تجربه‌ها و رویدادهای جذاب اطرافتان را کشف کنید؛ و به کمک پوستر، رویدادهای خود را به‌سادگی بسازید، بلیت بفروشید و برگزار کنید.",
  // Keep the whole project out of search indexes (paired with /robots.txt).
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfd" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1e26" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const loggedIn = (await cookies()).get(AUTH_COOKIE)?.value === "1";

  return (
    <html lang="fa" dir="rtl" data-auth={loggedIn ? "in" : "out"}>
      <body>
        <AppShell loggedIn={loggedIn}>{children}</AppShell>
      </body>
    </html>
  );
}
