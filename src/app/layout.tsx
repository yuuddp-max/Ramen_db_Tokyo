import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ramen-db-tokyo-blush.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "TOKYO RAMEN | 東京ラーメン店検索", template: "%s | TOKYO RAMEN" },
  description: "東京のラーメン店を、評価・口コミ数・営業時間・地図から探せるラーメンガイド。",
  applicationName: "TOKYO RAMEN",
  keywords: ["東京", "ラーメン", "ラーメン店", "つけ麺", "家系ラーメン", "二郎系", "ラーメン検索"],
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: "/",
    siteName: "TOKYO RAMEN",
    title: "TOKYO RAMEN | 東京ラーメン店検索",
    description: "評価・口コミ数・営業時間・地図から、今日の一杯を東京で探す。",
  },
  twitter: {
    card: "summary",
    title: "TOKYO RAMEN | 東京ラーメン店検索",
    description: "評価・口コミ数・営業時間・地図から、今日の一杯を東京で探す。",
  },
};

export const viewport: Viewport = { themeColor: "#0b0b0b", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
