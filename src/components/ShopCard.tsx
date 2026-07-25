import Link from "next/link";
import type { RamenShop } from "@/types/ramen";
import { formatPriceLevel, getCurrentOpenStatus, getTodayOpeningHours } from "@/lib/utils";
import { classifyRamen } from "@/lib/ramen-genres";
import { ShopPhotoThumbnail } from "./ShopPhotoThumbnail";

export function ShopCard({ shop, index, distanceM, selected = false }: { shop: RamenShop; index: number; distanceM?: number; selected?: boolean }) {
  const openStatus = getCurrentOpenStatus(shop.opening_hours);
  const todayHours = getTodayOpeningHours(shop.opening_hours);
  const ramen = classifyRamen(shop.name);
  return <Link id={`shop-card-${shop.id}`} href={`/shops/${shop.id}`} className={`panel group block rounded-2xl p-4 transition hover:-translate-y-1 hover:border-gold/60 ${selected ? "border-gold ring-1 ring-gold/40" : ""}`}>
    {shop.photo_name && <ShopPhotoThumbnail shopId={shop.id} shopName={shop.name} />}
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0"><span className="text-xs font-bold tracking-[.15em] text-gold">#{String(index + 1).padStart(2, "0")}</span><h2 className="mt-1 truncate text-lg font-bold text-stone-100 group-hover:text-gold">{shop.name}</h2></div>
      <div className="shrink-0 text-right"><p className="text-sm font-bold text-gold">★ {shop.rating?.toFixed(1) ?? "–"}</p><p className="mt-1 text-xs text-stone-500">{shop.user_ratings_total?.toLocaleString() ?? 0} 件</p></div>
    </div>
    <div className="mt-3 flex items-center justify-between gap-3"><p className="min-w-0 truncate text-sm text-stone-400">{shop.address ?? "住所情報なし"}</p>{distanceM != null && <span className="shrink-0 text-xs font-bold text-gold">現在地から {distanceM >= 1000 ? `${(distanceM / 1000).toFixed(1)}km` : `${distanceM}m`}</span>}</div>
    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-stone-400"><span className={`rounded px-2 py-1 font-bold ${openStatus.open ? "bg-emerald-500/15 text-emerald-400" : openStatus.known ? "bg-stone-500/15 text-stone-400" : "bg-white/5 text-stone-500"}`}>{openStatus.label}</span>{todayHours?.opensAt && todayHours.closesAt && <span className="rounded bg-white/5 px-2 py-1">🕒 {todayHours.opensAt}〜{todayHours.closesAt}</span>}<span className="rounded bg-gold/10 px-2 py-1 font-bold text-gold">スープ：{ramen.soup}</span>{ramen.style !== "その他" && <span className="rounded bg-ramen/10 px-2 py-1 font-bold text-ramen">{ramen.style}</span>}<span className="rounded bg-white/5 px-2 py-1">{formatPriceLevel(shop.price_level)}</span></div>
  </Link>;
}
