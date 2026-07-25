"use client";

import { useEffect, useMemo, useState } from "react";
import type { RamenShop } from "@/types/ramen";
import { MapView } from "./MapView";
import { ShopCard } from "./ShopCard";
import { readFavoriteIds } from "@/lib/favorites";
import { calculateDistanceMeters } from "@/lib/utils";
import { readRecentShops } from "@/lib/recent-shops";

type Props = { initialShops: RamenShop[]; initialTotal: number };

const ramenStyles = [
  { genre: "", style: "", label: "すべて" },
  { genre: "ramen_restaurant", style: "", label: "ラーメン" },
  { genre: "", style: "つけ麺", label: "つけ麺" },
  { genre: "", style: "油そば", label: "油そば" },
  { genre: "", style: "家系", label: "家系" },
  { genre: "", style: "二郎", label: "二郎系" },
];

export function SearchExperience({ initialShops, initialTotal }: Props) {
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("");
  const [style, setStyle] = useState("");
  const [minRating, setMinRating] = useState("");
  const [price, setPrice] = useState("");
  const [sort, setSort] = useState<"rating" | "reviews" | "newest">("rating");
  const [view, setView] = useState<"list" | "map">("list");
  const [shops, setShops] = useState(initialShops);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [recentOnly, setRecentOnly] = useState(false);
  const [openOnly, setOpenOnly] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationMessage, setLocationMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQuery(params.get("q") ?? "");
    setGenre(params.get("genre") ?? "");
    setStyle(params.get("style") ?? "");
    setMinRating(params.get("minRating") === "4.5" ? "4.5" : params.get("minRating") === "4" ? "4" : "");
    setPrice(["¥", "¥¥", "¥¥¥", "¥¥¥¥"].includes(params.get("price") ?? "") ? params.get("price") ?? "" : "");
    setOpenOnly(params.get("open") === "1");
    const savedSort = params.get("sort");
    if (savedSort === "rating" || savedSort === "reviews" || savedSort === "newest") setSort(savedSort);
  }, []);

  useEffect(() => {
    const syncRecentShops = () => setRecentIds(readRecentShops().map((shop) => shop.id));
    syncRecentShops();
    window.addEventListener("recent-shops-changed", syncRecentShops);
    return () => window.removeEventListener("recent-shops-changed", syncRecentShops);
  }, []);

  useEffect(() => {
    const syncFavorites = () => setFavoriteIds(readFavoriteIds());
    syncFavorites();
    window.addEventListener("favorites-changed", syncFavorites);
    return () => window.removeEventListener("favorites-changed", syncFavorites);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let isCurrent = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setSearchError("");
      try {
        const params = new URLSearchParams({ q: query, genre, style, minRating, price, sort, limit: "60", offset: "0" });
        if (favoriteOnly) params.set("ids", favoriteIds.join(","));
        if (recentOnly) params.set("ids", recentIds.join(","));
        if (openOnly) params.set("openNow", "true");
        const response = await fetch(`/api/shops?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error("検索結果を取得できませんでした。");
        const data = await response.json();
        if (isCurrent) { setShops(data.shops ?? []); setTotal(data.total ?? 0); }
      } catch (error) {
        if (isCurrent && !(error instanceof DOMException && error.name === "AbortError")) setSearchError("検索結果を取得できませんでした。時間をおいて再度お試しください。");
      } finally {
        if (isCurrent) setLoading(false);
      }
    }, 200);
    return () => { isCurrent = false; clearTimeout(timer); controller.abort(); };
  }, [query, genre, style, minRating, price, sort, favoriteOnly, favoriteIds, recentOnly, recentIds, openOnly]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (genre) params.set("genre", genre);
    if (style) params.set("style", style);
    if (minRating) params.set("minRating", minRating);
    if (price) params.set("price", price);
    if (sort !== "rating") params.set("sort", sort);
    if (openOnly) params.set("open", "1");
    const suffix = params.toString();
    window.history.replaceState(null, "", suffix ? `/?${suffix}` : "/");
  }, [query, genre, style, minRating, price, sort, openOnly]);

  const loadMore = async () => {
    setLoadingMore(true);
    setSearchError("");
    try {
      const params = new URLSearchParams({ q: query, genre, style, minRating, price, sort, limit: "60", offset: String(shops.length) });
      if (favoriteOnly) params.set("ids", favoriteIds.join(","));
      if (recentOnly) params.set("ids", recentIds.join(","));
      if (openOnly) params.set("openNow", "true");
      const response = await fetch(`/api/shops?${params}`);
      if (!response.ok) throw new Error("追加の店舗を取得できませんでした。");
      const data = await response.json();
      setShops((current) => [...current, ...(data.shops ?? [])]);
    } catch {
      setSearchError("追加の店舗を取得できませんでした。時間をおいて再度お試しください。");
    } finally {
      setLoadingMore(false);
    }
  };

  const filteredLabel = useMemo(() => {
    const genreLabel = ramenStyles.find((item) => item.genre === genre && item.style === style)?.label;
    if (recentOnly) return "最近見た店舗";
    if (favoriteOnly && openOnly) return "営業中のお気に入り";
    if (favoriteOnly) return "お気に入りのラーメン店";
    if (openOnly) return "営業中のラーメン店";
    if (query && genreLabel && (genre || style)) return `「${query}」・${genreLabel} の検索結果`;
    if (query) return `「${query}」の検索結果`;
    return genre || style ? `${genreLabel} の店舗` : "東京のラーメン店";
  }, [query, genre, style, favoriteOnly, recentOnly, openOnly]);
  const hasActiveFilters = Boolean(query || genre || style || minRating || price || sort !== "rating" || favoriteOnly || recentOnly || openOnly);
  const clearFilters = () => {
    setQuery(""); setGenre(""); setStyle(""); setMinRating(""); setPrice(""); setSort("rating"); setFavoriteOnly(false); setRecentOnly(false); setOpenOnly(false);
  };
  const requestLocation = () => {
    if (!navigator.geolocation) { setLocationMessage("このブラウザは位置情報に対応していません。"); return; }
    setLocationMessage("現在地を取得中…");
    navigator.geolocation.getCurrentPosition(
      (position) => { setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }); setLocationMessage("現在地からの距離を表示中"); },
      () => setLocationMessage("位置情報を取得できませんでした。ブラウザの許可設定を確認してください。"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };
  const chooseRandomShop = () => {
    if (!shops.length) return;
    const shop = shops[Math.floor(Math.random() * shops.length)];
    window.location.href = `/shops/${shop.id}`;
  };
  return <>
    <section className="relative overflow-hidden border-b border-white/10 bg-charcoal"><div className="grain absolute inset-0 opacity-60" /><div className="relative mx-auto max-w-7xl px-5 pb-12 pt-16 sm:px-8 sm:pt-24">
      <p className="text-xs font-bold tracking-[.32em] text-gold">TOKYO RAMEN GUIDE</p><h1 className="mt-4 max-w-2xl text-4xl font-black leading-tight sm:text-6xl">今日の一杯を、<br /><span className="text-ramen">東京</span>から探す。</h1><p className="mt-5 max-w-xl text-sm leading-7 text-stone-400 sm:text-base">Google Places の情報をもとに、東京のラーメン店を評価・地図・キーワードで見つけるためのガイドです。</p>
      <div className="panel mt-8 rounded-2xl p-3"><div className="flex flex-col gap-3 sm:flex-row"><label className="flex flex-1 items-center gap-3 rounded-xl bg-black/40 px-4 py-3"><span className="text-gold">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="店名、駅名、エリアで検索" className="w-full bg-transparent text-sm outline-none placeholder:text-stone-600" /></label><select value={sort} onChange={(event) => setSort(event.target.value as "rating" | "reviews" | "newest")} className="rounded-xl bg-white/10 px-4 py-3 text-sm outline-none"><option value="rating">評価順</option><option value="reviews">口コミ数順</option><option value="newest">新着順</option></select></div><div className="mt-3 flex flex-wrap gap-2" aria-label="評価と価格帯の絞り込み"><select value={minRating} onChange={(event) => setMinRating(event.target.value)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-stone-300 outline-none"><option value="">評価：すべて</option><option value="4">評価 4.0 以上</option><option value="4.5">評価 4.5 以上</option></select><select value={price} onChange={(event) => setPrice(event.target.value)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-stone-300 outline-none"><option value="">価格帯：すべて</option><option value="¥">¥</option><option value="¥¥">¥¥</option><option value="¥¥¥">¥¥¥</option><option value="¥¥¥¥">¥¥¥¥</option></select></div><div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="ラーメンジャンル検索">{ramenStyles.map((item) => <button key={item.label} onClick={() => { setGenre(item.genre); setStyle(item.style); }} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition ${genre === item.genre && style === item.style ? "border-gold bg-gold text-ink" : "border-white/10 bg-white/5 text-stone-400 hover:border-gold/60 hover:text-gold"}`}>{item.label}</button>)}</div></div>
    </div></section>
    <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8"><div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-stone-400">{filteredLabel}</p><p className="mt-1 text-xl font-bold">{total.toLocaleString()} <span className="text-sm font-normal text-stone-500">shops found</span></p></div><div className="flex flex-wrap items-center justify-end gap-2"><button onClick={chooseRandomShop} disabled={!shops.length} className="rounded-xl border border-gold/60 px-3 py-2 text-sm font-bold text-gold transition hover:bg-gold hover:text-ink disabled:cursor-not-allowed disabled:opacity-40">🎲 おまかせ</button>{hasActiveFilters && <button onClick={clearFilters} className="px-2 py-2 text-xs text-stone-500 hover:text-gold">条件をクリア</button>}<button onClick={() => setOpenOnly((current) => !current)} className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${openOnly ? "border-emerald-400 bg-emerald-400 text-ink" : "border-white/10 text-stone-400 hover:border-emerald-400 hover:text-emerald-400"}`}>営業中のみ</button><button onClick={requestLocation} className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${userLocation ? "border-gold bg-gold text-ink" : "border-white/10 text-stone-400 hover:border-gold hover:text-gold"}`}>◎ 現在地</button><button onClick={() => { setRecentOnly((current) => !current); setFavoriteOnly(false); }} className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${recentOnly ? "border-gold bg-gold text-ink" : "border-white/10 text-stone-400 hover:border-gold hover:text-gold"}`}>◷ 履歴</button><button onClick={() => { setFavoriteOnly((current) => !current); setRecentOnly(false); }} className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${favoriteOnly ? "border-ramen bg-ramen text-white" : "border-white/10 text-stone-400 hover:border-gold hover:text-gold"}`}>♡ お気に入り</button><div className="rounded-xl border border-white/10 p-1"><button onClick={() => setView("list")} className={`rounded-lg px-3 py-2 text-sm ${view === "list" ? "bg-gold text-ink" : "text-stone-400"}`}>一覧</button><button onClick={() => setView("map")} className={`rounded-lg px-3 py-2 text-sm ${view === "map" ? "bg-gold text-ink" : "text-stone-400"}`}>地図</button></div></div></div>{locationMessage && <p className="mb-4 text-xs text-stone-500">{locationMessage}</p>}
      {searchError && <p role="alert" className="mb-4 rounded-xl border border-ramen/40 bg-ramen/10 px-4 py-3 text-sm text-stone-200">{searchError}</p>}{view === "map" ? <MapView shops={shops} className="h-[560px] overflow-hidden rounded-2xl border border-white/10" /> : <>{loading && <p className="mb-4 text-sm text-gold">検索中…</p>}{shops.length ? <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{shops.map((shop, index) => <ShopCard key={shop.id} shop={shop} index={index} distanceM={userLocation ? calculateDistanceMeters(userLocation.latitude, userLocation.longitude, shop.latitude, shop.longitude) : undefined} />)}</div>{shops.length < total && <div className="mt-8 text-center"><button onClick={loadMore} disabled={loadingMore} className="rounded-xl border border-gold/60 px-6 py-3 text-sm font-bold text-gold transition hover:bg-gold hover:text-ink disabled:cursor-wait disabled:opacity-60">{loadingMore ? "読み込み中…" : `さらに表示（残り ${(total - shops.length).toLocaleString()} 店）`}</button></div>}</> : <div className="panel rounded-2xl px-6 py-16 text-center text-stone-400">該当する店舗がありません。データを取り込むと、ここに表示されます。</div>}</>}
    </section>
  </>;
}
