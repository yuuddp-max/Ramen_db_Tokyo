"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RamenShop } from "@/types/ramen";
import { MapView } from "./MapView";
import { ShopCard } from "./ShopCard";
import { readFavoriteIds } from "@/lib/favorites";
import { calculateDistanceMeters } from "@/lib/utils";
import { readRecentShops } from "@/lib/recent-shops";
import { RAMEN_SOUPS, RAMEN_STYLES } from "@/lib/ramen-genres";

type Props = { initialShops: RamenShop[]; initialTotal: number };
const PAGE_SIZE = 12;

export function SearchExperience({ initialShops, initialTotal }: Props) {
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("");
  const [soup, setSoup] = useState("");
  const [style, setStyle] = useState("");
  const [minRating, setMinRating] = useState("");
  const [price, setPrice] = useState("");
  const [sort, setSort] = useState<"rating" | "reviews" | "newest" | "distance">("rating");
  const [shops, setShops] = useState(initialShops);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [initializedFromUrl, setInitializedFromUrl] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [recentOnly, setRecentOnly] = useState(false);
  const [openOnly, setOpenOnly] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [mapBounds, setMapBounds] = useState<{ north: number; south: number; east: number; west: number } | null>(null);
  const [pendingMapBounds, setPendingMapBounds] = useState<{ north: number; south: number; east: number; west: number } | null>(null);
  const [locationSearchRevision, setLocationSearchRevision] = useState(0);
  const initialClientRequestHandled = useRef(false);
  const favoriteIdsKey = favoriteOnly ? favoriteIds.join(",") : "";
  const recentIdsKey = recentOnly ? recentIds.join(",") : "";
  const filterSignature = [query, genre, soup, style, minRating, price, sort, favoriteOnly, favoriteIdsKey, recentOnly, recentIdsKey, openOnly].join("|");
  const previousFilterSignature = useRef(filterSignature);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get("q") ?? "";
    const initialGenre = params.get("genre") ?? "";
    const initialSoup = RAMEN_SOUPS.some((item) => item.label === params.get("soup")) ? params.get("soup") ?? "" : "";
    const initialStyle = RAMEN_STYLES.some((item) => item.label === params.get("style")) ? params.get("style") ?? "" : "";
    const initialMinRating = params.get("minRating") === "4.5" ? "4.5" : params.get("minRating") === "4" ? "4" : "";
    const initialPrice = ["¥", "¥¥", "¥¥¥", "¥¥¥¥"].includes(params.get("price") ?? "") ? params.get("price") ?? "" : "";
    const savedSort = params.get("sort");
    const initialSort = savedSort === "rating" || savedSort === "reviews" || savedSort === "newest" ? savedSort : "rating";
    const initialOpenOnly = params.get("open") === "1";
    previousFilterSignature.current = [initialQuery, initialGenre, initialSoup, initialStyle, initialMinRating, initialPrice, initialSort, false, "", false, "", initialOpenOnly].join("|");
    setQuery(initialQuery);
    setGenre(initialGenre);
    setSoup(initialSoup);
    setStyle(initialStyle);
    const savedPage = Number(params.get("page"));
    if (Number.isInteger(savedPage) && savedPage > 1) setPage(savedPage);
    setMinRating(initialMinRating);
    setPrice(initialPrice);
    setOpenOnly(initialOpenOnly);
    setSort(initialSort);
    setInitializedFromUrl(true);
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
    requestLocation(false);
  // 位置情報は初回表示時のみ取得する。再取得は「現在地」ボタンから行う。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (previousFilterSignature.current !== filterSignature) {
      previousFilterSignature.current = filterSignature;
      setPage(1);
    }
  }, [filterSignature]);

  useEffect(() => {
    if (!initializedFromUrl) return;
    if (!initialClientRequestHandled.current) {
      initialClientRequestHandled.current = true;
      // The server-rendered first page is already in initialShops. Do not replace it
      // with a second, unrequested browser fetch after hydration.
      const hasUrlSearch = Boolean(query || genre || soup || style || minRating || price || sort !== "rating" || openOnly || page > 1);
      if (!hasUrlSearch) return;
    }
    const controller = new AbortController();
    let isCurrent = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setSearchError("");
      try {
        const params = new URLSearchParams({ q: query, genre, soup, style, minRating, price, sort, limit: String(PAGE_SIZE), offset: String((page - 1) * PAGE_SIZE) });
        if (sort === "distance" && userLocation) { params.set("latitude", String(userLocation.latitude)); params.set("longitude", String(userLocation.longitude)); }
        if (mapBounds && !query) { params.set("north", String(mapBounds.north)); params.set("south", String(mapBounds.south)); params.set("east", String(mapBounds.east)); params.set("west", String(mapBounds.west)); }
        if (favoriteOnly) params.set("ids", favoriteIdsKey);
        if (recentOnly) params.set("ids", recentIdsKey);
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
  }, [query, genre, soup, style, minRating, price, sort, favoriteOnly, favoriteIdsKey, recentOnly, recentIdsKey, openOnly, page, mapBounds, initializedFromUrl, locationSearchRevision, userLocation]);

  useEffect(() => {
    if (!initializedFromUrl) return;
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (genre) params.set("genre", genre);
    if (soup) params.set("soup", soup);
    if (style) params.set("style", style);
    if (minRating) params.set("minRating", minRating);
    if (price) params.set("price", price);
    if (sort !== "rating" && sort !== "distance") params.set("sort", sort);
    if (openOnly) params.set("open", "1");
    if (page > 1) params.set("page", String(page));
    const suffix = params.toString();
    window.history.replaceState(null, "", suffix ? `/?${suffix}` : "/");
  }, [query, genre, soup, style, minRating, price, sort, openOnly, page, initializedFromUrl]);

  const filteredLabel = useMemo(() => {
    const taxonomyLabel = [soup && `スープ：${soup}`, style && `スタイル：${style}`].filter(Boolean).join(" · ");
    if (recentOnly) return "最近見た店舗";
    if (favoriteOnly && openOnly) return "営業中のお気に入り";
    if (favoriteOnly) return "お気に入りのラーメン店";
    if (openOnly) return "営業中のラーメン店";
    if (query && taxonomyLabel) return `「${query}」・${taxonomyLabel} の検索結果`;
    if (query) return `「${query}」の検索結果`;
    return taxonomyLabel ? `${taxonomyLabel} の店舗` : "東京のラーメン店";
  }, [query, soup, style, favoriteOnly, recentOnly, openOnly]);
  const hasActiveFilters = Boolean(query || genre || soup || style || minRating || price || sort !== "rating" || favoriteOnly || recentOnly || openOnly);
  const clearFilters = () => {
    setQuery(""); setGenre(""); setSoup(""); setStyle(""); setMinRating(""); setPrice(""); setSort("rating"); setFavoriteOnly(false); setRecentOnly(false); setOpenOnly(false); setPage(1);
  };
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const visibleStart = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const visibleEnd = Math.min(page * PAGE_SIZE, total);
  const goToPage = (nextPage: number) => {
    setPage(Math.min(Math.max(nextPage, 1), totalPages));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const requestLocation = (refreshResults = true) => {
    if (!navigator.geolocation) { setLocationMessage("このブラウザは位置情報に対応していません。"); return; }
    setLocationMessage("現在地を取得中…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        if (refreshResults) {
          setSort("distance");
          setLocationSearchRevision((current) => current + 1);
        }
        setLocationMessage(refreshResults ? "現在地から近い順に表示中" : "現在地を地図に表示しています");
      },
      () => setLocationMessage("位置情報を取得できませんでした。ブラウザの許可設定を確認してください。"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };
  const chooseRandomShop = () => {
    if (!shops.length) return;
    const shop = shops[Math.floor(Math.random() * shops.length)];
    window.location.href = `/shops/${shop.id}`;
  };
  const selectShopFromMap = useCallback((shop: RamenShop) => {
    setSelectedShopId(shop.id);
    window.setTimeout(() => document.getElementById(`shop-card-${shop.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  }, []);
  const handleMapBoundsChange = useCallback((bounds: { north: number; south: number; east: number; west: number }) => {
    setPendingMapBounds((current) => current && Math.abs(current.north - bounds.north) < 0.0001 && Math.abs(current.south - bounds.south) < 0.0001 && Math.abs(current.east - bounds.east) < 0.0001 && Math.abs(current.west - bounds.west) < 0.0001 ? current : bounds);
  }, []);
  const visibleShops = useMemo(() => !mapBounds || query ? shops : shops.filter((shop) => shop.latitude >= mapBounds.south && shop.latitude <= mapBounds.north && shop.longitude >= mapBounds.west && shop.longitude <= mapBounds.east), [shops, mapBounds, query]);
  const renderList = () => <>{loading && <p className="mb-4 text-sm text-gold">検索中…</p>}{visibleShops.length ? <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visibleShops.map((shop, index) => <ShopCard key={shop.id} shop={shop} index={(page - 1) * PAGE_SIZE + index} distanceM={userLocation ? calculateDistanceMeters(userLocation.latitude, userLocation.longitude, shop.latitude, shop.longitude) : undefined} selected={selectedShopId === shop.id} />)}</div><nav className="mt-8 flex items-center justify-center gap-3" aria-label="店舗一覧のページ送り"><button onClick={() => goToPage(page - 1)} disabled={page <= 1} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-stone-300 transition hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-35">← 前へ</button><span className="text-sm text-stone-400"><strong className="text-stone-100">{page}</strong> / {totalPages} ページ</span><button onClick={() => goToPage(page + 1)} disabled={page >= totalPages} className="rounded-xl border border-gold/60 px-4 py-2 text-sm font-bold text-gold transition hover:bg-gold hover:text-ink disabled:cursor-not-allowed disabled:opacity-35">次ページへ →</button></nav></> : <div className="panel rounded-2xl px-6 py-16 text-center text-stone-400">地図の表示範囲内に店舗がありません。</div>}</>;
  return <>
    <section className="relative overflow-hidden border-b border-white/10 bg-charcoal"><div className="grain absolute inset-0 opacity-60" /><div className="relative mx-auto max-w-7xl px-5 pb-12 pt-16 sm:px-8 sm:pt-24">
      <p className="text-xs font-bold tracking-[.32em] text-gold">TOKYO RAMEN GUIDE</p><h1 className="mt-4 max-w-2xl text-4xl font-black leading-tight sm:text-6xl">今日の一杯を、<br /><span className="text-ramen">東京</span>から探す。</h1><p className="mt-5 max-w-xl text-sm leading-7 text-stone-400 sm:text-base">Google Places の情報をもとに、東京のラーメン店を評価・地図・キーワードで見つけるためのガイドです。</p>
      <div className="panel mt-8 rounded-2xl p-3"><div className="flex flex-col gap-3 sm:flex-row"><label className="flex flex-1 items-center gap-3 rounded-xl bg-black/40 px-4 py-3"><span className="text-gold">⌕</span><input value={query} onChange={(event) => { setQuery(event.target.value); setMapBounds(null); }} placeholder="店名、駅名、エリアで検索" className="w-full bg-transparent text-sm outline-none placeholder:text-stone-600" /></label><select value={sort} onChange={(event) => setSort(event.target.value as "rating" | "reviews" | "newest" | "distance")} className="rounded-xl bg-white/10 px-4 py-3 text-sm outline-none"><option value="rating">評価順</option><option value="reviews">口コミ数順</option><option value="newest">新着順</option>{userLocation && <option value="distance">現在地から近い順</option>}</select></div><div className="mt-3 flex flex-wrap gap-2" aria-label="評価と価格帯の絞り込み"><select value={minRating} onChange={(event) => setMinRating(event.target.value)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-stone-300 outline-none"><option value="">評価：すべて</option><option value="4">評価 4.0 以上</option><option value="4.5">評価 4.5 以上</option></select><select value={price} onChange={(event) => setPrice(event.target.value)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-stone-300 outline-none"><option value="">価格帯：すべて</option><option value="¥">¥</option><option value="¥¥">¥¥</option><option value="¥¥¥">¥¥¥</option><option value="¥¥¥¥">¥¥¥¥</option></select></div><div className="mt-4 space-y-3" aria-label="ラーメンジャンル検索"><div><p className="mb-1.5 text-xs font-bold tracking-[.12em] text-gold">スープ系統</p><div className="flex gap-2 overflow-x-auto pb-1"><button onClick={() => setSoup("")} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition ${!soup ? "border-gold bg-gold text-ink" : "border-white/10 bg-white/5 text-stone-400 hover:border-gold/60 hover:text-gold"}`}>すべて</button>{RAMEN_SOUPS.map((item) => <button key={item.label} onClick={() => setSoup(item.label)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition ${soup === item.label ? "border-gold bg-gold text-ink" : "border-white/10 bg-white/5 text-stone-400 hover:border-gold/60 hover:text-gold"}`}>{item.label}</button>)}</div></div><div><p className="mb-1.5 text-xs font-bold tracking-[.12em] text-gold">スタイル</p><div className="flex gap-2 overflow-x-auto pb-1"><button onClick={() => setStyle("")} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition ${!style ? "border-gold bg-gold text-ink" : "border-white/10 bg-white/5 text-stone-400 hover:border-gold/60 hover:text-gold"}`}>すべて</button>{RAMEN_STYLES.map((item) => <button key={item.label} onClick={() => setStyle(item.label)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition ${style === item.label ? "border-gold bg-gold text-ink" : "border-white/10 bg-white/5 text-stone-400 hover:border-gold/60 hover:text-gold"}`}>{item.label}</button>)}</div></div></div></div>
    </div></section>
    <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8"><div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-stone-400">{filteredLabel}</p><p className="mt-1 text-xl font-bold">{total.toLocaleString()} <span className="text-sm font-normal text-stone-500">shops found</span></p>{total > 0 && <p className="mt-1 text-xs text-stone-500">{visibleStart.toLocaleString()}〜{visibleEnd.toLocaleString()}件を表示</p>}</div><div className="flex flex-wrap items-center justify-end gap-2"><button onClick={chooseRandomShop} disabled={!shops.length} className="rounded-xl border border-gold/60 px-3 py-2 text-sm font-bold text-gold transition hover:bg-gold hover:text-ink disabled:cursor-not-allowed disabled:opacity-40">🎲 おまかせ</button>{hasActiveFilters && <button onClick={clearFilters} className="px-2 py-2 text-xs text-stone-500 hover:text-gold">条件をクリア</button>}<button onClick={() => setOpenOnly((current) => !current)} className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${openOnly ? "border-emerald-400 bg-emerald-400 text-ink" : "border-white/10 text-stone-400 hover:border-emerald-400 hover:text-emerald-400"}`}>営業中のみ</button><button onClick={() => requestLocation(true)} className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${userLocation ? "border-gold bg-gold text-ink" : "border-white/10 text-stone-400 hover:border-gold hover:text-gold"}`}>◎ 現在地</button><button onClick={() => { setRecentOnly((current) => !current); setFavoriteOnly(false); }} className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${recentOnly ? "border-gold bg-gold text-ink" : "border-white/10 text-stone-400 hover:border-gold hover:text-gold"}`}>◷ 履歴</button><button onClick={() => { setFavoriteOnly((current) => !current); setRecentOnly(false); }} className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${favoriteOnly ? "border-ramen bg-ramen text-white" : "border-white/10 text-stone-400 hover:border-gold hover:text-gold"}`}>♡ お気に入り</button></div></div>{locationMessage && <p className="mb-4 text-xs text-stone-500">{locationMessage}</p>}
      {searchError && <p role="alert" className="mb-4 rounded-xl border border-ramen/40 bg-ramen/10 px-4 py-3 text-sm text-stone-200">{searchError}</p>}{mapBounds && <p className="mb-4 text-xs text-stone-500">地図内の {visibleShops.length} 店を表示</p>}<div className="space-y-3"><MapView shops={shops} currentLocation={userLocation} onShopSelect={selectShopFromMap} onBoundsChange={handleMapBoundsChange} className="h-[360px] overflow-hidden rounded-2xl border border-white/10 sm:h-[460px]" /><div className="flex justify-center"><button onClick={() => { setMapBounds(pendingMapBounds); setPage(1); }} disabled={!pendingMapBounds} className="rounded-xl border border-gold bg-ink px-5 py-2.5 text-sm font-bold text-gold transition hover:bg-gold hover:text-ink disabled:cursor-not-allowed disabled:opacity-40">この地図で検索</button></div><div>{renderList()}</div></div>
    </section>
  </>;
}
