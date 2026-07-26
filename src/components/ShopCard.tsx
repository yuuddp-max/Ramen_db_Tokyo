import Link from "next/link";
import type { RamenShop } from "@/types/ramen";
import { getCurrentOpenStatus, getTodayOpeningHours } from "@/lib/utils";
import { classifyRamen } from "@/lib/ramen-genres";

function estimateCrowd(rating: number | null) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Tokyo" }).format(new Date()));
  const peakTime = (hour >= 11 && hour < 14) || (hour >= 18 && hour < 21);
  if (!peakTime) return "低め";
  if ((rating ?? 0) >= 4.5) return "高め";
  return "やや高め";
}

export function ShopCard({ shop, index, distanceM, selected = false }: { shop: RamenShop; index: number; distanceM?: number; selected?: boolean }) {
  const openStatus = getCurrentOpenStatus(shop.opening_hours);
  const todayHours = getTodayOpeningHours(shop.opening_hours);
  const ramen = classifyRamen(shop.name);
  const soup = shop.researched_soup_type ?? ramen.soup;
  const style = shop.researched_style ?? ramen.style;
  const hours = todayHours?.opensAt && todayHours.closesAt ? `${todayHours.opensAt}〜${todayHours.closesAt}` : "営業時間不明";
  const crowd = estimateCrowd(shop.rating);
  return <Link id={`shop-card-${shop.id}`} href={`/shops/${shop.id}`} className={`group block border-b border-white/10 border-l-4 border-l-gold/60 px-5 py-4 transition hover:border-l-gold hover:bg-white/[0.035] last:border-b-0 ${selected ? "border-l-gold bg-gold/5" : ""}`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><span className="text-xs font-bold tracking-[.15em] text-gold">#{String(index + 1).padStart(2, "0")}</span><h2 className="mt-1 text-xl font-bold text-stone-100 group-hover:text-gold sm:text-2xl">{shop.name}</h2></div>{distanceM != null && <span className="shrink-0 pt-1 text-xs font-bold text-gold">現在地から {distanceM >= 1000 ? `${(distanceM / 1000).toFixed(1)}km` : `${distanceM}m`}</span>}</div>
    <div className="mt-4 overflow-x-auto border-t border-white/10 pt-4">
      <dl className="grid min-w-[1040px] grid-cols-[.8fr_1.15fr_.95fr_1fr_1fr_2.4fr_1.05fr_1.2fr] text-sm">
        <dt className="px-2 text-xs text-stone-500">スープ系統</dt><dt className="px-2 text-xs text-stone-500">スタイル</dt><dt className="px-2 text-xs text-stone-500">営業状況</dt><dt className="px-2 text-xs text-stone-500">営業時間</dt><dt className="px-2 text-xs text-stone-500">推定混雑度</dt><dt className="px-2 text-xs text-stone-500">住所</dt><dt className="px-2 text-xs text-stone-500">Google の評価</dt><dt className="px-2 text-xs text-stone-500">百名店</dt>
        <dd className="mt-2 truncate px-2 font-bold text-gold">{soup}</dd><dd className="mt-2 truncate px-2 font-bold text-ramen">{style}</dd><dd className={`mt-2 truncate px-2 font-bold ${openStatus.open ? "text-emerald-400" : openStatus.known ? "text-stone-300" : "text-stone-500"}`}>{openStatus.label}</dd><dd className="mt-2 truncate px-2 font-medium text-stone-200">{hours}</dd><dd className={`mt-2 truncate px-2 font-bold ${crowd === "高め" ? "text-ramen" : crowd === "やや高め" ? "text-gold" : "text-emerald-400"}`}>{crowd}</dd><dd className="mt-2 truncate px-2 text-stone-300">{shop.address ?? "住所情報なし"}</dd><dd className="mt-2 truncate px-2 font-bold text-gold">★ {shop.rating?.toFixed(1) ?? "–"}<span className="ml-1 text-xs font-normal text-stone-500">{shop.user_ratings_total?.toLocaleString() ?? 0}件</span></dd><dd className={`mt-2 truncate px-2 font-bold ${shop.has_tabelog_hyakumeiten ? "text-gold" : "text-stone-500"}`}>{shop.has_tabelog_hyakumeiten ? "🏆 食べログ百名店" : "掲載なし"}</dd>
      </dl>
    </div>
  </Link>;
}
