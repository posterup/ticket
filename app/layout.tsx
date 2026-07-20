import type { Metadata, Viewport } from "next";

// Self-hosted Vazirmatn (variable). Bundled at build time so the deploy has no
// external font dependency (avoids build-time Google Fonts fetch failures).
import "@fontsource-variable/vazirmatn";
import "./globals.css";

import { AppBottomNav } from "@/components/AppBottomNav";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        {children}
        {/* Clears the fixed app bottom nav so content isn't hidden behind it. */}
        <div className="h-16 lg:hidden" aria-hidden />
        <AppBottomNav />
      </body>
    </html>
  );
}
