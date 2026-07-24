import Link from "next/link";
import { notFound } from "next/navigation";
import { FavoriteButton } from "@/components/FavoriteButton";
import { MapView } from "@/components/MapView";
import { formatPriceLevel, formatStatus } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import type { RamenShop } from "@/types/ramen";

export const dynamic = "force-dynamic";

export default async function ShopDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!supabase) notFound();
  const { data } = await supabase.from("ramen_shops").select("*").eq("id", id).single();
  const shop = data as RamenShop | null;
  if (!shop) notFound();
  return <main className="min-h-screen"><header className="border-b border-white/10"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8"><Link href="/" className="font-black">TOKYO <span className="text-ramen">RAMEN</span></Link><Link href="/" className="text-sm text-stone-400 hover:text-gold">← 一覧へ戻る</Link></div></header>
    <div className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-14"><p className="text-xs font-bold tracking-[.25em] text-gold">RAMEN SHOP</p><div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-3xl font-black sm:text-5xl">{shop.name}</h1><p className="mt-3 text-sm text-stone-400">{shop.address}</p></div><FavoriteButton shopId={shop.id} /></div>
      <div className="mt-8 grid gap-5 lg:grid-cols-[1.3fr_.7fr]"><MapView shops={[shop]} selected={shop} className="h-[380px] overflow-hidden rounded-2xl border border-white/10" /><div className="panel rounded-2xl p-6"><p className="text-sm text-stone-400">Google の評価</p><p className="mt-1 text-4xl font-black text-gold">★ {shop.rating?.toFixed(1) ?? "–"}</p><p className="mt-1 text-sm text-stone-500">{shop.user_ratings_total?.toLocaleString() ?? 0} 件の口コミ</p><div className="mt-6 border-t border-white/10 pt-5 text-sm"><p><span className="text-stone-500">価格帯</span><span className="float-right">{formatPriceLevel(shop.price_level)}</span></p><p className="mt-4"><span className="text-stone-500">営業状況</span><span className="float-right text-emerald-400">{formatStatus(shop.business_status)}</span></p></div></div></div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2"><section className="panel rounded-2xl p-6"><h2 className="font-bold">営業時間</h2><div className="mt-4 space-y-2 text-sm leading-6 text-stone-400">{shop.opening_hours?.length ? shop.opening_hours.map((hours) => <p key={hours}>{hours}</p>) : <p>営業時間の情報はありません。</p>}</div></section><section className="panel rounded-2xl p-6"><h2 className="font-bold">店舗情報</h2><dl className="mt-4 space-y-4 text-sm"><div className="flex justify-between gap-4"><dt className="text-stone-500">電話</dt><dd>{shop.phone_number ? <a className="hover:text-gold" href={`tel:${shop.phone_number}`}>{shop.phone_number}</a> : "情報なし"}</dd></div><div className="flex justify-between gap-4"><dt className="text-stone-500">公式サイト</dt><dd>{shop.website ? <a className="text-gold underline underline-offset-4" href={shop.website} target="_blank" rel="noreferrer">Webサイトを開く ↗</a> : "情報なし"}</dd></div><div className="flex justify-between gap-4"><dt className="text-stone-500">Google Place ID</dt><dd className="max-w-[60%] truncate text-stone-400">{shop.place_id}</dd></div></dl></section></div>
    </div></main>;
}
