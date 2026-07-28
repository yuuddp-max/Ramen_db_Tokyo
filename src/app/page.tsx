import { SearchExperience } from "@/components/SearchExperience";
import { WeeklyRamenPosts } from "@/components/WeeklyRamenPosts";
import Link from "next/link";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import type { RamenShop } from "@/types/ramen";
import type { WebRamenMentionWithShop } from "@/types/web-ramen";
import { dedupeRamenShops } from "@/lib/shop-deduplication";
import { limitWebRamenMentions } from "@/lib/web-ramen-feed";

export const dynamic = "force-dynamic";

// Keep the first server render focused on the fixed Tokyo Station origin.
// This prevents the page from briefly loading the entire database before the
// client-side 5 km search completes.
const TOKYO_STATION_BOUNDS = {
  south: 35.636236,
  north: 35.726236,
  west: 139.707125,
  east: 139.827125,
};

export default async function Home() {
  let shops: RamenShop[] = [];
  let total = 0;
  let weeklyPosts: WebRamenMentionWithShop[] = [];
  if (supabase) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data }, { count }, { data: xPosts }] = await Promise.all([
      supabase.from("ramen_shops").select("*").gte("latitude", TOKYO_STATION_BOUNDS.south).lte("latitude", TOKYO_STATION_BOUNDS.north).gte("longitude", TOKYO_STATION_BOUNDS.west).lte("longitude", TOKYO_STATION_BOUNDS.east).order("rating", { ascending: false, nullsFirst: false }).limit(48),
      supabase.from("ramen_shops").select("id", { count: "exact", head: true }).gte("latitude", TOKYO_STATION_BOUNDS.south).lte("latitude", TOKYO_STATION_BOUNDS.north).gte("longitude", TOKYO_STATION_BOUNDS.west).lte("longitude", TOKYO_STATION_BOUNDS.east),
      supabase.from("web_ramen_mentions").select("*,ramen_shops(id,name)").eq("is_visible", true).gte("published_at", weekAgo).order("ranking_score", { ascending: false }).limit(100),
    ]);
    shops = dedupeRamenShops((data as RamenShop[] | null) ?? []).slice(0, 12); total = count ?? 0;
    weeklyPosts = limitWebRamenMentions((xPosts as WebRamenMentionWithShop[] | null) ?? []);
    if (supabaseAdmin && shops.length) {
      const { data: awards } = await supabaseAdmin
        .from("tabelog_hyakumeiten_awards")
        .select("shop_id")
        .in("shop_id", shops.map((shop) => shop.id))
        .eq("match_status", "matched");
      const awardedShopIds = new Set((awards ?? []).map((award) => award.shop_id));
      shops = shops.map((shop) => ({ ...shop, has_tabelog_hyakumeiten: awardedShopIds.has(shop.id) }));
    }
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ramen-db-tokyo-blush.vercel.app";
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "TOKYO RAMEN",
    url: siteUrl,
    inLanguage: "ja-JP",
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
  return <main><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} /><header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur"><div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-6 sm:px-8"><Link href="/" className="flex items-center gap-2 font-bold text-ink" aria-label="東京ラーメンガイドのトップへ"><span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-lg text-white" aria-hidden="true">🍜</span><span>東京ラーメンガイド</span></Link><nav className="flex items-center gap-4 text-sm font-bold text-text-secondary"><a href="#search-results" className="hidden hover:text-accent sm:inline">店舗を探す</a><a href="#weekly-info" className="hidden hover:text-accent sm:inline">今週の話題</a><Link href="/?recent=1" className="hover:text-accent" aria-label="履歴">◷<span className="sr-only">履歴</span></Link><Link href="/?favorite=1" className="hover:text-accent" aria-label="お気に入り">♡<span className="sr-only">お気に入り</span></Link></nav></div></header><div id="search-results"><SearchExperience initialShops={shops} initialTotal={total} /></div><div id="weekly-info"><WeeklyRamenPosts posts={weeklyPosts} /></div><footer className="border-t border-border bg-white px-6 py-8 text-center text-xs text-text-muted">© {new Date().getFullYear()} 東京ラーメンガイド</footer></main>;
}
