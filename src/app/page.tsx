import { RamenHomeShell } from "@/components/RamenHomeShell";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import type { RamenShop } from "@/types/ramen";
import type { WebRamenMentionWithShop } from "@/types/web-ramen";
import { dedupeRamenShops } from "@/lib/shop-deduplication";
import { dedupeWebMentions, limitWebRamenMentions } from "@/lib/web-ramen-feed";
import { loadDriveNewsCsv } from "@/lib/drive-news-csv";

export const dynamic = "force-dynamic";

export default async function Home() {
  let shops: RamenShop[] = [];
  let total = 0;
  let weeklyPosts: WebRamenMentionWithShop[] = [];
  const drivePosts = await loadDriveNewsCsv();
  if (supabase) {
    const [{ data }, { count }, { data: xPosts }] = await Promise.all([
      supabase.from("ramen_shops").select("*").eq("is_excluded", false).order("user_ratings_total", { ascending: false, nullsFirst: false }).limit(10),
      supabase.from("ramen_shops").select("id", { count: "exact", head: true }).eq("is_excluded", false),
      supabase.from("web_ramen_mentions").select("*,ramen_shops(id,name)").eq("is_visible", true).order("published_at", { ascending: false, nullsFirst: false }).order("ranking_score", { ascending: false }).limit(40),
    ]);
    shops = dedupeRamenShops((data as RamenShop[] | null) ?? []).slice(0, 12); total = count ?? 0;
    weeklyPosts = limitWebRamenMentions(dedupeWebMentions([...drivePosts, ...((xPosts as WebRamenMentionWithShop[] | null) ?? [])]));
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
  if (!supabase) weeklyPosts = limitWebRamenMentions(dedupeWebMentions(drivePosts));
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
