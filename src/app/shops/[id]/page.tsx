import Link from "next/link";
import { notFound } from "next/navigation";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ShareButton } from "@/components/ShareButton";
import { RecentShopTracker } from "@/components/RecentShopTracker";
import { CongestionPanel } from "@/components/CongestionPanel";
import { ShopPhoto } from "@/components/ShopPhoto";
import { MapView } from "@/components/MapView";
import { formatPriceLevel, formatStatus, getCurrentOpenStatus } from "@/lib/utils";
import { classifyRamen } from "@/lib/ramen-genres";
import { estimateVisit, getNearestStation, getTodayHours } from "@/lib/shop-enrichment";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import type { RamenShop } from "@/types/ramen";
import { calculateRamenTrustScore } from "@/lib/trust-score";

export const dynamic = "force-dynamic";

function formatOpeningHours(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      return formatOpeningHours(JSON.parse(trimmed));
    } catch {
      return [trimmed];
    }
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["weekdayDescriptions", "weekday_descriptions", "weekday_text"]) {
      if (key in record) return formatOpeningHours(record[key]);
    }

    return Object.entries(record)
      .flatMap(([day, hours]) => formatOpeningHours(hours).map((hour) => `${day}: ${hour}`));
  }

  return [];
}

export default async function ShopDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!supabase) notFound();
  const { data } = await supabase.from("ramen_shops").select("*").eq("id", id).single();
  const shop = data as RamenShop | null;
  if (!shop) notFound();
  const openingHours = formatOpeningHours(shop.opening_hours);
  const openStatus = getCurrentOpenStatus(openingHours);
  const ramen = classifyRamen(shop.name);
  const isApprovedResearch = shop.research_status !== "draft" && shop.research_status !== "rejected";
  const soupType = isApprovedResearch ? shop.researched_soup_type ?? ramen.soup : ramen.soup;
  const ramenStyle = isApprovedResearch ? shop.researched_style ?? ramen.style : ramen.style;
  const researchConfidence = isApprovedResearch && shop.research_confidence === "high" ? "高" : isApprovedResearch && shop.research_confidence === "medium" ? "中" : isApprovedResearch && shop.research_confidence === "low" ? "低" : null;
  const googleMapsUrl = shop.google_maps_uri ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.name)}&query_place_id=${shop.place_id}`;
  const [station, awardResponse] = await Promise.all([
    getNearestStation(shop),
    supabaseAdmin ? supabaseAdmin.from("tabelog_hyakumeiten_awards").select("award_year,award_name,source_url").eq("shop_id", shop.id).eq("match_status", "matched").order("award_year", { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  const hyakumeitenAwards = awardResponse.data ?? [];
  const trust = calculateRamenTrustScore({ ...shop, has_tabelog_hyakumeiten: hyakumeitenAwards.length > 0 });
  const todayHours = getTodayHours(openingHours);
  const visitEstimate = estimateVisit(shop);
  return <main className="min-h-screen"><RecentShopTracker shopId={shop.id} shopName={shop.name} /><header className="border-b border-white/10"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8"><Link href="/" className="font-black">TOKYO <span className="text-ramen">RAMEN</span></Link><Link href="/" className="text-sm text-stone-400 hover:text-gold">← 一覧へ戻る</Link></div></header>
    <div className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-14"><p className="text-xs font-bold tracking-[.25em] text-gold">RAMEN SHOP</p><div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-3xl font-black sm:text-5xl">{shop.name}</h1><p className="mt-3 text-sm text-stone-400">{shop.address}</p></div><div className="flex flex-wrap gap-2"><a className="rounded-full border border-gold bg-gold px-4 py-2 text-sm font-bold text-ink transition hover:bg-transparent hover:text-gold" href={`https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}&destination_place_id=${shop.place_id}`} target="_blank" rel="noreferrer">⌖ 経路</a><a className="rounded-full border border-white/20 px-4 py-2 text-sm font-bold text-stone-200 transition hover:border-gold hover:text-gold" href={googleMapsUrl} target="_blank" rel="noreferrer">Google Maps ↗</a><ShareButton shopId={shop.id} shopName={shop.name} /><FavoriteButton shopId={shop.id} /></div></div>
      <div className="mt-8 grid gap-5 lg:grid-cols-[1.3fr_.7fr]"><div className="space-y-5">{shop.photo_name && <ShopPhoto shopId={shop.id} shopName={shop.name} attributions={shop.photo_attributions} />}<MapView shops={[shop]} selected={shop} className="h-[380px] overflow-hidden rounded-2xl border border-white/10" /></div><div className="panel rounded-2xl p-6"><p className="text-sm text-stone-400">Google の評価</p><div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2"><p className="text-4xl font-black text-gold">★ {shop.rating?.toFixed(1) ?? "–"}</p>{hyakumeitenAwards.map((award) => <a key={`${award.award_name}-${award.award_year}`} href={award.source_url} target="_blank" rel="noreferrer" className="rounded-full border border-gold/70 bg-gold/10 px-3 py-1.5 text-xs font-black text-gold transition hover:bg-gold hover:text-ink">🏆 食べログ 百名店 {award.award_year} ↗</a>)}</div><p className="mt-1 text-sm text-stone-500">{shop.user_ratings_total?.toLocaleString() ?? 0} 件の口コミ</p><div className="mt-5 rounded-xl border border-gold/30 bg-gold/5 p-4"><div className="flex items-baseline justify-between gap-3"><p className="text-sm font-bold text-stone-300">ラーメン信頼スコア</p><p className="text-3xl font-black text-gold">{trust.score}<span className="ml-1 text-sm font-normal text-stone-400">/100</span></p></div><ul className="mt-3 space-y-1 text-xs leading-5 text-stone-400">{trust.reasons.slice(0, 5).map((reason) => <li key={reason}>・{reason}</li>)}</ul></div><div className="mt-6 border-t border-white/10 pt-5 text-sm"><p><span className="text-stone-500">いまの営業時間</span><span className={`float-right font-bold ${openStatus.open ? "text-emerald-400" : openStatus.known ? "text-stone-300" : "text-stone-500"}`}>{openStatus.label}</span></p><p className="mt-4"><span className="text-stone-500">価格帯</span><span className="float-right">{formatPriceLevel(shop.price_level)}</span></p><p className="mt-4"><span className="text-stone-500">Google登録状態</span><span className="float-right text-stone-300">{formatStatus(shop.business_status)}</span></p></div></div></div>
      <section className="panel mt-5 rounded-2xl p-6"><h2 className="font-bold">訪問の目安</h2><div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xs text-stone-500">スープ系統</p><p className="mt-1 font-bold text-gold">{soupType}</p><p className="mt-1 text-xs text-stone-500">スタイル：{ramenStyle}</p>{researchConfidence && <p className="mt-2 text-xs text-stone-500">調査信頼度：{researchConfidence}</p>}{isApprovedResearch && shop.research_evidence_url && <a className="mt-2 inline-block text-xs font-bold text-gold underline underline-offset-4 hover:text-white" href={shop.research_evidence_url} target="_blank" rel="noreferrer">調査根拠を見る ↗</a>}</div><div><p className="text-xs text-stone-500">営業開始・終了（本日）</p><p className="mt-1 font-bold">{todayHours?.opensAt && todayHours.closesAt ? `${todayHours.opensAt} 〜 ${todayHours.closesAt}` : "情報なし"}</p></div><div><p className="text-xs text-stone-500">現在の推定混雑度</p><p className="mt-1 font-bold">{visitEstimate.crowd}<span className="ml-2 text-xs font-normal text-stone-500">待ち時間 {visitEstimate.wait}</span></p></div><div><p className="text-xs text-stone-500">最寄駅からの距離</p>{station ? <><p className="mt-1 font-bold">{station.name} 約{station.distanceM.toLocaleString()}m</p><a className="mt-2 inline-block text-xs font-bold text-gold underline underline-offset-4 hover:text-white" href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(station.name)}&destination_place_id=${shop.place_id}&travelmode=walking`} target="_blank" rel="noreferrer">駅から徒歩ルート ↗</a></> : <p className="mt-1 font-bold">取得中・情報なし</p>}</div></div><p className="mt-5 text-xs leading-5 text-stone-500">混雑度・待ち時間は、現在時刻・評価件数をもとにした参考値です。実際の状況とは異なる場合があります。</p></section>
      <CongestionPanel shopId={shop.id} />
      <div className="mt-5 grid gap-5 lg:grid-cols-2"><section className="panel rounded-2xl p-6"><h2 className="font-bold">営業時間</h2><div className="mt-4 space-y-2 text-sm leading-6 text-stone-400">{openingHours.length ? openingHours.map((hours, index) => <p key={`${index}-${hours}`}>{hours}</p>) : <p>営業時間の情報はありません。</p>}</div></section><section className="panel rounded-2xl p-6"><h2 className="font-bold">店舗情報</h2><dl className="mt-4 space-y-4 text-sm"><div className="flex justify-between gap-4"><dt className="text-stone-500">電話</dt><dd>{shop.phone_number ? <a className="hover:text-gold" href={`tel:${shop.phone_number}`}>{shop.phone_number}</a> : "情報なし"}</dd></div><div className="flex justify-between gap-4"><dt className="text-stone-500">公式サイト</dt><dd>{shop.website ? <a className="text-gold underline underline-offset-4" href={shop.website} target="_blank" rel="noreferrer">Webサイトを開く ↗</a> : "情報なし"}</dd></div><div className="flex justify-between gap-4"><dt className="text-stone-500">Google Place ID</dt><dd className="max-w-[60%] truncate text-stone-400">{shop.place_id}</dd></div></dl></section></div>
    </div></main>;
}
