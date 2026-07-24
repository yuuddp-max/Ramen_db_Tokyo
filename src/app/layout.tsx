import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TOKYO RAMEN | 東京ラーメン店検索",
  description: "東京のラーメン店を、評価・エリア・地図から探せるガイド。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
