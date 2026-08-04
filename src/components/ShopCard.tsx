import Link from "next/link";
import type { RamenShop } from "@/types/ramen";
import { getCurrentOpenStatus, getTodayOpeningHours } from "@/lib/utils";
import { classifyRamen } from "@/lib/ramen-genres";
import { FavoriteButton } from "./FavoriteButton";
import { calculateRamenTrustScore } from "@/lib/trust-score";

export function ShopCard({ shop, selected = false }: { shop: RamenShop; distanceM?: number; selected?: boolean }) {
  const status = getCurrentOpenStatus(shop.opening_hours);
  const today = getTodayOpeningHours(shop.opening_hours);
  const ramen = classifyRamen(shop.name);
  const tags = [shop.researched_soup_type ?? ramen.soup, shop.researched_style ?? ramen.style].filter(Boolean).slice(0, 2);
  const hours = today?.opensAt && today.closesAt ? `${today.opensAt}〜${today.closesAt}` : "営業時間未確認";
  const trust = calculateRamenTrustScore(shop);

  return <article id={`shop-card-${shop.id}`} className={`group border-b border-border p-5 transition last:border-b-0 hover:bg-background-subtle ${selected ? "bg-accent-light" : ""}`}>
    <div className="flex items-start justify-between gap-4"><div className="min-w-0"><Link href={`/shops/${shop.id}`} className="block max-w-3xl text-lg font-bold leading-7 text-ink hover:text-accent">{shop.name}</Link><p className="mt-1 truncate text-sm text-text-secondary">{shop.address ?? "住所情報なし"}</p></div><FavoriteButton shopId={shop.id} /></div>
    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3 sm:gap-4"><div><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><p className="text-xs text-text-muted">営業状況</p><p className={`font-bold ${status.open ? "text-success" : status.label === "営業時間外" ? "text-red-600" : status.known ? "text-text-secondary" : "text-text-muted"}`}>{status.label}</p><span className="text-xs text-text-secondary">{hours}</span></div></div><div className="flex items-center justify-between gap-3 whitespace-nowrap"><p className="text-xs text-text-muted">Googleの評価</p><p className="shrink-0 font-bold text-rating">★ {shop.rating?.toFixed(1) ?? "–"} <span className="text-xs font-normal text-text-secondary">（{shop.user_ratings_total?.toLocaleString() ?? 0}件）</span></p></div><div className="flex items-center justify-between gap-3 whitespace-nowrap"><p className="text-xs text-text-muted">ラーメン信頼スコア</p><p className="shrink-0 font-bold text-accent">{trust.score}<span className="ml-1 text-xs font-normal text-text-secondary">/100</span></p></div></div>
    <div className="mt-4 flex flex-wrap items-center gap-2"><div className="flex flex-wrap gap-2">{tags.map((tag) => <span key={tag} className="rounded-full bg-background-subtle px-2.5 py-1 text-xs font-medium text-text-secondary">{tag}</span>)}{shop.has_tabelog_hyakumeiten && <span className="rounded-full bg-warning-light px-2.5 py-1 text-xs font-bold text-warning">食べログ百名店</span>}</div><Link href={`/shops/${shop.id}`} className="ml-auto text-sm font-bold text-accent hover:underline">詳細を見る →</Link></div>
  </article>;
}
