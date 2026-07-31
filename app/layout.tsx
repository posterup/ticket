import type { Metadata, Viewport } from "next";

// Self-hosted Vazirmatn (variable). Bundled at build time so the deploy has no
// external font dependency (avoids build-time Google Fonts fetch failures).
import "@fontsource-variable/vazirmatn";
import "./globals.css";

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
  /*
    One value, because there is one theme. The dark entry that used to sit here
    tinted the browser chrome dark on a dark-mode phone while the page stayed
    light — a seam, not a dark mode. Restore it alongside real dark tokens.
  */
  themeColor: "#fdfcff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
