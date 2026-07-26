"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RamenShop } from "@/types/ramen";
import { MapView, type MapShop } from "./MapView";
import { ShopCard } from "./ShopCard";
import { readFavoriteIds } from "@/lib/favorites";
import { calculateDistanceMeters } from "@/lib/utils";
import { readRecentShops } from "@/lib/recent-shops";
import { RAMEN_SOUPS, RAMEN_STYLES } from "@/lib/ramen-genres";

type Props = { initialShops: RamenShop[]; initialTotal: number };
const PAGE_SIZE = 12;
const MAP_RADIUS_METERS = 5_000;

export function SearchExperience({ initialShops, initialTotal }: Props) {
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("");
  const [soup, setSoup] = useState("");
  const [style, setStyle] = useState("");
  const [minRating, setMinRating] = useState("");
  const [shops, setShops] = useState(initialShops);
  const [mapShops, setMapShops] = useState<MapShop[]>(initialShops);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [initializedFromUrl, setInitializedFromUrl] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasLoadedNearbyResults, setHasLoadedNearbyResults] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [recentOnly, setRecentOnly] = useState(false);
  const [openOnly, setOpenOnly] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [mapResetRevision, setMapResetRevision] = useState(0);
  const sort = "reviews";
  const favoriteIdsKey = favoriteOnly ? favoriteIds.join(",") : "";
  const recentIdsKey = recentOnly ? recentIds.join(",") : "";
  const filterSignature = [query, genre, soup, style, minRating, favoriteOnly, favoriteIdsKey, recentOnly, recentIdsKey, openOnly].join("|");
  const previousFilterSignature = useRef(filterSignature);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get("q") ?? "";
    const initialGenre = params.get("genre") ?? "";
    const initialSoup = RAMEN_SOUPS.some((item) => item.label === params.get("soup")) ? params.get("soup") ?? "" : "";
    const initialStyle = RAMEN_STYLES.some((item) => item.label === params.get("style")) ? params.get("style") ?? "" : "";
    const initialMinRating = params.get("minRating") === "4.5" ? "4.5" : params.get("minRating") === "4" ? "4" : "";
    const initialOpenOnly = params.get("open") === "1";
    previousFilterSignature.current = [initialQuery, initialGenre, initialSoup, initialStyle, initialMinRating, false, "", false, "", initialOpenOnly].join("|");
    setQuery(initialQuery); setGenre(initialGenre); setSoup(initialSoup); setStyle(initialStyle); setMinRating(initialMinRating); setOpenOnly(initialOpenOnly);
    const savedPage = Number(params.get("page"));
    if (Number.isInteger(savedPage) && savedPage > 1) setPage(savedPage);
    setInitializedFromUrl(true);
  }, []);

  useEffect(() => {
    const syncRecent = () => setRecentIds(readRecentShops().map((shop) => shop.id));
    syncRecent(); window.addEventListener("recent-shops-changed", syncRecent);
    return () => window.removeEventListener("recent-shops-changed", syncRecent);
  }, []);

  useEffect(() => {
    const syncFavorites = () => setFavoriteIds(readFavoriteIds());
    syncFavorites(); window.addEventListener("favorites-changed", syncFavorites);
    return () => window.removeEventListener("favorites-changed", syncFavorites);
  }, []);

  const requestLocation = useCallback((resetMap = false) => {
    if (!navigator.geolocation) { setLocationMessage("このブラウザは位置情報に対応していません。"); return; }
    // Do not briefly render the server-side Tokyo-wide result while we are
    // resolving the new 5km result for the user's current location.
    setHasLoadedNearbyResults(false);
    setShops([]);
    setMapShops([]);
    setTotal(0);
    setLocationMessage("現在地を取得中…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        if (resetMap) setMapResetRevision((current) => current + 1);
        setLocationMessage(resetMap ? "地図を現在地に戻しました" : "現在地から半径5kmの店舗を表示しています");
      },
      () => setLocationMessage("位置情報を取得できませんでした。ブラウザの許可設定を確認してください。"),
      // Avoid reusing a coarse IP/Wi-Fi position. Google Maps commonly refreshes
      // location more aggressively, so request a fresh high-accuracy position too.
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  }, []);

  useEffect(() => { requestLocation(); }, [requestLocation]);

  useEffect(() => {
    if (previousFilterSignature.current !== filterSignature) { previousFilterSignature.current = filterSignature; setPage(1); }
  }, [filterSignature]);

  useEffect(() => {
    if (!initializedFromUrl || !userLocation) return;
    const controller = new AbortController();
    let isCurrent = true;
    setLoading(true);
    setHasLoadedNearbyResults(false);
    const timer = setTimeout(async () => {
      setSearchError("");
      try {
        const params = new URLSearchParams({ q: query, genre, soup, style, minRating, sort, limit: String(PAGE_SIZE), offset: String((page - 1) * PAGE_SIZE), latitude: String(userLocation.latitude), longitude: String(userLocation.longitude), radiusMeters: String(MAP_RADIUS_METERS) });
        if (favoriteOnly) params.set("ids", favoriteIdsKey);
        if (recentOnly) params.set("ids", recentIdsKey);
        if (openOnly) params.set("openNow", "true");
        const response = await fetch(`/api/shops?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error("検索結果を取得できませんでした。");
        const data = await response.json();
        if (isCurrent) { setShops(data.shops ?? []); setMapShops(data.mapShops ?? data.shops ?? []); setTotal(data.total ?? 0); setHasLoadedNearbyResults(true); }
      } catch (error) {
        if (isCurrent && !(error instanceof DOMException && error.name === "AbortError")) setSearchError("検索結果を取得できませんでした。時間をおいて再度お試しください。");
      } finally { if (isCurrent) setLoading(false); }
    }, 0);
    return () => { isCurrent = false; clearTimeout(timer); controller.abort(); };
  }, [query, genre, soup, style, minRating, sort, favoriteOnly, favoriteIdsKey, recentOnly, recentIdsKey, openOnly, page, initializedFromUrl, userLocation]);

  useEffect(() => {
    if (!initializedFromUrl) return;
    const params = new URLSearchParams();
    if (query) params.set("q", query); if (genre) params.set("genre", genre); if (soup) params.set("soup", soup); if (style) params.set("style", style); if (minRating) params.set("minRating", minRating); if (openOnly) params.set("open", "1"); if (page > 1) params.set("page", String(page));
    window.history.replaceState(null, "", params.toString() ? `/?${params}` : "/");
  }, [query, genre, soup, style, minRating, openOnly, page, initializedFromUrl]);

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
  const hasActiveFilters = Boolean(query || genre || soup || style || minRating || favoriteOnly || recentOnly || openOnly);
  const clearFilters = () => { setQuery(""); setGenre(""); setSoup(""); setStyle(""); setMinRating(""); setFavoriteOnly(false); setRecentOnly(false); setOpenOnly(false); setPage(1); };
  const displayTotal = userLocation && hasLoadedNearbyResults ? total : 0;
  const totalPages = Math.max(1, Math.ceil(displayTotal / PAGE_SIZE));
  const visibleStart = displayTotal ? (page - 1) * PAGE_SIZE + 1 : 0;
  const visibleEnd = Math.min(page * PAGE_SIZE, displayTotal);
  const goToPage = (nextPage: number) => { setPage(Math.min(Math.max(nextPage, 1), totalPages)); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const selectShopFromMap = useCallback((shop: MapShop) => { setSelectedShopId(shop.id); window.setTimeout(() => document.getElementById(`shop-card-${shop.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0); }, []);
  const nearbyMapShops = useMemo(() => !userLocation || !hasLoadedNearbyResults ? [] : mapShops.filter((shop) => calculateDistanceMeters(userLocation.latitude, userLocation.longitude, shop.latitude, shop.longitude) <= MAP_RADIUS_METERS), [mapShops, userLocation, hasLoadedNearbyResults]);
  const visibleShops = userLocation && hasLoadedNearbyResults ? shops : [];

  const renderList = () => <>{loading && <p className="mb-4 text-sm text-gold">現在地の店舗を検索中…</p>}{visibleShops.length ? <><div className="panel overflow-hidden rounded-2xl">{visibleShops.map((shop) => <ShopCard key={shop.id} shop={shop} distanceM={userLocation ? calculateDistanceMeters(userLocation.latitude, userLocation.longitude, shop.latitude, shop.longitude) : undefined} selected={selectedShopId === shop.id} />)}</div><nav className="mt-8 flex items-center justify-center gap-3" aria-label="店舗一覧のページ送り"><button onClick={() => goToPage(page - 1)} disabled={page <= 1} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-stone-300 transition hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-35">← 前へ</button><span className="text-sm text-stone-400"><strong className="text-stone-100">{page}</strong> / {totalPages} ページ</span><button onClick={() => goToPage(page + 1)} disabled={page >= totalPages} className="rounded-xl border border-gold/60 px-4 py-2 text-sm font-bold text-gold transition hover:bg-gold hover:text-ink disabled:cursor-not-allowed disabled:opacity-35">次ページへ →</button></nav></> : <div className="panel rounded-2xl px-6 py-16 text-center text-stone-400">{!userLocation ? "現在地を取得しています…" : !hasLoadedNearbyResults ? "現在地から半径5kmの店舗を検索しています…" : "半径5km以内に条件と一致する店舗がありません。"}</div>}</>;

  return <>
    <section className="relative overflow-hidden border-b border-white/10 bg-charcoal"><div className="grain absolute inset-0 opacity-60" /><div className="relative mx-auto max-w-7xl px-5 pb-12 pt-16 sm:px-8 sm:pt-24">
      <p className="text-xs font-bold tracking-[.32em] text-gold">TOKYO RAMEN GUIDE</p><h1 className="mt-4 max-w-2xl text-4xl font-black leading-tight sm:text-6xl">今日の一杯を、<br /><span className="text-ramen">東京</span>から探す。</h1><p className="mt-5 max-w-xl text-sm leading-7 text-stone-400 sm:text-base">Google Places の情報をもとに、東京のラーメン店を評価・地図・キーワードで見つけるためのガイドです。</p>
      <div className="panel mt-8 rounded-2xl p-3"><div className="flex flex-col gap-3 sm:flex-row"><label className="flex flex-1 items-center gap-3 rounded-xl bg-black/40 px-4 py-3"><span className="text-gold">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="店名、駅名、エリアで検索" className="w-full bg-transparent text-sm outline-none placeholder:text-stone-600" /></label><span className="rounded-xl bg-white/10 px-4 py-3 text-sm text-stone-300">口コミ数順</span></div><div className="mt-3 flex flex-wrap gap-2" aria-label="評価の絞り込み"><select value={minRating} onChange={(event) => setMinRating(event.target.value)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-stone-300 outline-none"><option value="">評価：すべて</option><option value="4">評価 4.0 以上</option><option value="4.5">評価 4.5 以上</option></select></div><div className="mt-4 space-y-3" aria-label="ラーメンジャンル検索"><div><p className="mb-1.5 text-xs font-bold tracking-[.12em] text-gold">スープ系統</p><div className="flex gap-2 overflow-x-auto pb-1"><button onClick={() => setSoup("")} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition ${!soup ? "border-gold bg-gold text-ink" : "border-white/10 bg-white/5 text-stone-400 hover:border-gold/60 hover:text-gold"}`}>すべて</button>{RAMEN_SOUPS.map((item) => <button key={item.label} onClick={() => setSoup(item.label)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition ${soup === item.label ? "border-gold bg-gold text-ink" : "border-white/10 bg-white/5 text-stone-400 hover:border-gold/60 hover:text-gold"}`}>{item.label}</button>)}</div></div><div><p className="mb-1.5 text-xs font-bold tracking-[.12em] text-gold">スタイル</p><div className="flex gap-2 overflow-x-auto pb-1"><button onClick={() => setStyle("")} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition ${!style ? "border-gold bg-gold text-ink" : "border-white/10 bg-white/5 text-stone-400 hover:border-gold/60 hover:text-gold"}`}>すべて</button>{RAMEN_STYLES.map((item) => <button key={item.label} onClick={() => setStyle(item.label)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition ${style === item.label ? "border-gold bg-gold text-ink" : "border-white/10 bg-white/5 text-stone-400 hover:border-gold/60 hover:text-gold"}`}>{item.label}</button>)}</div></div></div></div>
    </div></section>
    <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8"><div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-stone-400">{filteredLabel}</p><p className="mt-1 text-xl font-bold">{displayTotal.toLocaleString()} <span className="text-sm font-normal text-stone-500">shops found</span></p>{displayTotal > 0 && <p className="mt-1 text-xs text-stone-500">{visibleStart.toLocaleString()}〜{visibleEnd.toLocaleString()}件を表示</p>}</div><div className="flex flex-wrap items-center justify-end gap-2">{hasActiveFilters && <button onClick={clearFilters} className="px-2 py-2 text-xs text-stone-500 hover:text-gold">条件をクリア</button>}<button onClick={() => setOpenOnly((current) => !current)} className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${openOnly ? "border-emerald-400 bg-emerald-400 text-ink" : "border-white/10 text-stone-400 hover:border-emerald-400 hover:text-emerald-400"}`}>営業中のみ</button><button onClick={() => { setRecentOnly((current) => !current); setFavoriteOnly(false); }} className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${recentOnly ? "border-gold bg-gold text-ink" : "border-white/10 text-stone-400 hover:border-gold hover:text-gold"}`}>◷ 履歴</button><button onClick={() => { setFavoriteOnly((current) => !current); setRecentOnly(false); }} className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${favoriteOnly ? "border-ramen bg-ramen text-white" : "border-white/10 text-stone-400 hover:border-gold hover:text-gold"}`}>♡ お気に入り</button></div></div>{locationMessage && <p className="mb-4 text-xs text-stone-500">{locationMessage}</p>}
      {searchError && <p role="alert" className="mb-4 rounded-xl border border-ramen/40 bg-ramen/10 px-4 py-3 text-sm text-stone-200">{searchError}</p>}<p className="mb-4 text-xs text-stone-500">{userLocation ? `現在地から半径5km以内の ${nearbyMapShops.length.toLocaleString()} 店を地図に表示` : "現在地を取得すると、半径5km以内の店舗を地図に表示します"}</p><div className="space-y-3"><MapView shops={nearbyMapShops} currentLocation={userLocation} radiusMeters={MAP_RADIUS_METERS} focusCurrentLocationToken={mapResetRevision} onShopSelect={selectShopFromMap} className="h-[360px] overflow-hidden rounded-2xl border border-white/10 sm:h-[460px]" /><div className="flex justify-center"><button onClick={() => requestLocation(true)} className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-bold text-stone-300 transition hover:border-gold hover:text-gold">◎ 現在地</button></div><div>{renderList()}</div></div>
    </section>
  </>;
}
