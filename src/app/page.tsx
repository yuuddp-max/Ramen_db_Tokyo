import { RamenHomeShell } from "@/components/RamenHomeShell";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import type { RamenShop } from "@/types/ramen";
import type { WebRamenMentionWithShop } from "@/types/web-ramen";
import { dedupeRamenShops } from "@/lib/shop-deduplication";
import { limitWebRamenMentions } from "@/lib/web-ramen-feed";

export const dynamic = "force-dynamic";

export default async function Home() {
  let shops: RamenShop[] = [];
  let total = 0;
  let weeklyPosts: WebRamenMentionWithShop[] = [];
  if (supabase) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data }, { count }, { data: xPosts }] = await Promise.all([
      supabase.from("ramen_shops").select("*").order("rating", { ascending: false, nullsFirst: false }).limit(10),
      supabase.from("ramen_shops").select("id", { count: "exact", head: true }),
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
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} /><RamenHomeShell initialShops={shops} initialTotal={total} posts={weeklyPosts} /></>;
}
