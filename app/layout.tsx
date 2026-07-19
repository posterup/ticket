import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";

import "./globals.css";

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  display: "swap",
  variable: "--font-vazirmatn",
});

export const metadata: Metadata = {
  title: "گیشه | مدیریت حرفه‌ای رویداد و فروش بلیت",
  description:
    "پلتفرم مدیریت رویداد و فروش بلیت برای کسب‌وکارها و سازمان‌ها. ایجاد رویداد، مدیریت مخاطبان، فروش بلیت و عملیات ورود، همه در یک پلتفرم واحد.",
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
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body>{children}</body>
    </html>
  );
}
