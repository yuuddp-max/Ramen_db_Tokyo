import { SearchExperience } from "@/components/SearchExperience";
import Link from "next/link";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import type { RamenShop } from "@/types/ramen";
import { dedupeRamenShops } from "@/lib/shop-deduplication";

export const dynamic = "force-dynamic";

export default async function Home() {
  let shops: RamenShop[] = [];
  let total = 0;
  if (supabase) {
    const [{ data }, { count }] = await Promise.all([
      supabase.from("ramen_shops").select("*").order("rating", { ascending: false, nullsFirst: false }).limit(48),
      supabase.from("ramen_shops").select("id", { count: "exact", head: true }),
    ]);
    shops = dedupeRamenShops((data as RamenShop[] | null) ?? []).slice(0, 12); total = count ?? 0;
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
  return <main><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} /><header className="border-b border-white/10 bg-ink"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8"><Link href="/" className="font-black tracking-tight">TOKYO <span className="text-ramen">RAMEN</span></Link><span className="text-xs tracking-[.18em] text-stone-500">RAMEN DIRECTORY</span></div></header><SearchExperience initialShops={shops} initialTotal={total} /><footer className="border-t border-white/10 px-5 py-8 text-center text-xs text-stone-600">© {new Date().getFullYear()} TOKYO RAMEN GUIDE</footer></main>;
}
