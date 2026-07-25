"use client";

import { useEffect, useMemo, useState } from "react";
import type { RamenShop } from "@/types/ramen";
import { MapView } from "./MapView";
import { ShopCard } from "./ShopCard";

type Props = { initialShops: RamenShop[]; initialTotal: number };

const genres = [
  { value: "", label: "すべて" },
  { value: "ramen_restaurant", label: "ラーメン" },
  { value: "japanese_restaurant", label: "和食" },
  { value: "chinese_restaurant", label: "中華" },
  { value: "restaurant", label: "レストラン" },
];

export function SearchExperience({ initialShops, initialTotal }: Props) {
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("");
  const [sort, setSort] = useState("rating");
  const [view, setView] = useState<"list" | "map">("list");
  const [shops, setShops] = useState(initialShops);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({ q: query, genre, sort, limit: "60" });
      const response = await fetch(`/api/shops?${params}`);
      const data = await response.json();
      setShops(data.shops ?? []); setTotal(data.total ?? 0); setLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, genre, sort]);

  const filteredLabel = useMemo(() => {
    const genreLabel = genres.find((item) => item.value === genre)?.label;
    if (query && genreLabel && genre) return `「${query}」・${genreLabel} の検索結果`;
    if (query) return `「${query}」の検索結果`;
    return genre ? `${genreLabel} の店舗` : "東京のラーメン店";
  }, [query, genre]);
  return <>
    <section className="relative overflow-hidden border-b border-white/10 bg-charcoal"><div className="grain absolute inset-0 opacity-60" /><div className="relative mx-auto max-w-7xl px-5 pb-12 pt-16 sm:px-8 sm:pt-24">
      <p className="text-xs font-bold tracking-[.32em] text-gold">TOKYO RAMEN GUIDE</p><h1 className="mt-4 max-w-2xl text-4xl font-black leading-tight sm:text-6xl">今日の一杯を、<br /><span className="text-ramen">東京</span>から探す。</h1><p className="mt-5 max-w-xl text-sm leading-7 text-stone-400 sm:text-base">Google Places の情報をもとに、東京のラーメン店を評価・地図・キーワードで見つけるためのガイドです。</p>
      <div className="panel mt-8 rounded-2xl p-3"><div className="flex flex-col gap-3 sm:flex-row"><label className="flex flex-1 items-center gap-3 rounded-xl bg-black/40 px-4 py-3"><span className="text-gold">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="店名、駅名、エリアで検索" className="w-full bg-transparent text-sm outline-none placeholder:text-stone-600" /></label><select value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-xl bg-white/10 px-4 py-3 text-sm outline-none"><option value="rating">評価順</option><option value="newest">新着順</option></select></div><div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="ジャンル検索">{genres.map((item) => <button key={item.value || "all"} onClick={() => setGenre(item.value)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition ${genre === item.value ? "border-gold bg-gold text-ink" : "border-white/10 bg-white/5 text-stone-400 hover:border-gold/60 hover:text-gold"}`}>{item.label}</button>)}</div></div>
    </div></section>
    <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8"><div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-stone-400">{filteredLabel}</p><p className="mt-1 text-xl font-bold">{total.toLocaleString()} <span className="text-sm font-normal text-stone-500">shops found</span></p></div><div className="rounded-xl border border-white/10 p-1"><button onClick={() => setView("list")} className={`rounded-lg px-3 py-2 text-sm ${view === "list" ? "bg-gold text-ink" : "text-stone-400"}`}>一覧</button><button onClick={() => setView("map")} className={`rounded-lg px-3 py-2 text-sm ${view === "map" ? "bg-gold text-ink" : "text-stone-400"}`}>地図</button></div></div>
      {view === "map" ? <MapView shops={shops} className="h-[560px] overflow-hidden rounded-2xl border border-white/10" /> : <>{loading && <p className="mb-4 text-sm text-gold">検索中…</p>}{shops.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{shops.map((shop, index) => <ShopCard key={shop.id} shop={shop} index={index} />)}</div> : <div className="panel rounded-2xl px-6 py-16 text-center text-stone-400">該当する店舗がありません。データを取り込むと、ここに表示されます。</div>}</>}
    </section>
  </>;
}
