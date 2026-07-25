import Link from "next/link";
import type { RamenShop } from "@/types/ramen";
import { formatPriceLevel, getCurrentOpenStatus, inferRamenStyle } from "@/lib/utils";

export function ShopCard({ shop, index }: { shop: RamenShop; index: number }) {
  const openStatus = getCurrentOpenStatus(shop.opening_hours);
  return <Link href={`/shops/${shop.id}`} className="panel group block rounded-2xl p-4 transition hover:-translate-y-1 hover:border-gold/60">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0"><span className="text-xs font-bold tracking-[.15em] text-gold">#{String(index + 1).padStart(2, "0")}</span><h2 className="mt-1 truncate text-lg font-bold text-stone-100 group-hover:text-gold">{shop.name}</h2></div>
      <div className="shrink-0 text-right"><p className="text-sm font-bold text-gold">★ {shop.rating?.toFixed(1) ?? "–"}</p><p className="mt-1 text-xs text-stone-500">{shop.user_ratings_total?.toLocaleString() ?? 0} 件</p></div>
    </div>
    <p className="mt-3 truncate text-sm text-stone-400">{shop.address ?? "住所情報なし"}</p>
    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-stone-400"><span className={`rounded px-2 py-1 font-bold ${openStatus.open ? "bg-emerald-500/15 text-emerald-400" : openStatus.known ? "bg-stone-500/15 text-stone-400" : "bg-white/5 text-stone-500"}`}>{openStatus.label}</span><span className="rounded bg-gold/10 px-2 py-1 font-bold text-gold">{inferRamenStyle(shop.name)}</span><span className="rounded bg-white/5 px-2 py-1">{formatPriceLevel(shop.price_level)}</span></div>
  </Link>;
}
