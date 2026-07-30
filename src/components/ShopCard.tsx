import Link from "next/link";
import type { RamenShop } from "@/types/ramen";
import { getCurrentOpenStatus, getTodayOpeningHours } from "@/lib/utils";
import { classifyRamen } from "@/lib/ramen-genres";
import { FavoriteButton } from "./FavoriteButton";

function estimateCrowd(rating: number | null) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Tokyo" }).format(new Date()));
  if (!((hour >= 11 && hour < 14) || (hour >= 18 && hour < 21))) return "空いている";
  return (rating ?? 0) >= 4.5 ? "混雑" : "やや混雑";
}

export function ShopCard({ shop, distanceM, selected = false }: { shop: RamenShop; distanceM?: number; selected?: boolean }) {
  const status = getCurrentOpenStatus(shop.opening_hours);
  const today = getTodayOpeningHours(shop.opening_hours);
  const ramen = classifyRamen(shop.name);
  const tags = [shop.researched_soup_type ?? ramen.soup, shop.researched_style ?? ramen.style, estimateCrowd(shop.rating)].filter(Boolean).slice(0, 3);
  const hours = today?.opensAt && today.closesAt ? `${today.opensAt}〜${today.closesAt}` : "営業時間未確認";
  return <article id={`shop-card-${shop.id}`} className={`group border-b border-border p-5 transition last:border-b-0 hover:bg-background-subtle ${selected ? "bg-accent-light" : ""}`}>
    <div className="flex items-start justify-between gap-4"><div className="min-w-0"><Link href={`/shops/${shop.id}`} className="block max-w-3xl text-lg font-bold leading-7 text-ink hover:text-accent">{shop.name}</Link><p className="mt-1 truncate text-sm text-text-secondary">{shop.address ?? "住所情報なし"}</p></div><FavoriteButton shopId={shop.id} /></div>
    <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3"><div><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><p className="text-xs text-text-muted">営業状況</p><p className={`font-bold ${status.open ? "text-success" : status.known ? "text-text-secondary" : "text-text-muted"}`}>{status.label}</p><span className="text-xs text-text-secondary">{hours}</span></div></div><div><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><p className="text-xs text-text-muted">Googleの評価</p><p className="font-bold text-rating">★ {shop.rating?.toFixed(1) ?? "–"}</p><span className="text-xs text-text-secondary">（{shop.user_ratings_total?.toLocaleString() ?? 0}件）</span></div></div><div><p className="text-xs text-text-muted">推定混雑度</p><p className="mt-1 font-bold text-ink">{estimateCrowd(shop.rating)}<span className="ml-1 text-xs font-normal text-text-muted">（推定）</span></p></div></div>
    <div className="mt-4 flex flex-wrap items-center gap-2"><div className="flex flex-wrap gap-2">{tags.map((tag) => <span key={tag} className="rounded-full bg-background-subtle px-2.5 py-1 text-xs font-medium text-text-secondary">{tag}</span>)}{shop.has_tabelog_hyakumeiten && <span className="rounded-full bg-warning-light px-2.5 py-1 text-xs font-bold text-warning">食べログ百名店</span>}</div><Link href={`/shops/${shop.id}`} className="ml-auto text-sm font-bold text-accent hover:underline">詳細を見る →</Link></div>
  </article>;
}
