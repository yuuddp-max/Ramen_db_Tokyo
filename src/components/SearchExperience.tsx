"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RamenShop } from "@/types/ramen";
import type { MapShop } from "./MapView";
import { ShopCard } from "./ShopCard";
import { readFavoriteIds } from "@/lib/favorites";
import { readRecentShops } from "@/lib/recent-shops";
import { calculateDistanceMeters } from "@/lib/utils";
import { RAMEN_SOUPS, RAMEN_STYLES } from "@/lib/ramen-genres";

type Props = { initialShops: RamenShop[]; initialTotal: number };
const PAGE_SIZE = 12;
const MAP_RADIUS_METERS = 5_000;
const TOKYO_STATION = { latitude: 35.681236, longitude: 139.767125 };
const LazyMapView = dynamic(() => import("./MapView").then((module) => module.MapView), { ssr: false, loading: () => <div className="h-[360px] animate-pulse rounded-2xl border border-border bg-background-subtle sm:h-[460px]" aria-label="地図を読み込み中" /> });

function FilterPanel({ soup, setSoup, style, setStyle, minRating, setMinRating, openOnly, setOpenOnly, onClear }: { soup: string; setSoup: (value: string) => void; style: string; setStyle: (value: string) => void; minRating: string; setMinRating: (value: string) => void; openOnly: boolean; setOpenOnly: (value: boolean) => void; onClear: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const visibleStyles = expanded ? RAMEN_STYLES : RAMEN_STYLES.slice(0, 7);
  return <div className="space-y-6">
    <section><h2 className="text-sm font-bold text-ink">営業状態</h2><label className="mt-3 flex cursor-pointer items-center justify-between gap-3 text-sm text-text-secondary"><span>営業中のみ表示</span><input type="checkbox" checked={openOnly} onChange={(event) => setOpenOnly(event.target.checked)} className="h-4 w-4 accent-accent" /></label></section>
    <section><h2 className="text-sm font-bold text-ink">スープ系統</h2><div className="mt-3 grid gap-2">{RAMEN_SOUPS.map((item) => <label key={item.label} className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary"><input type="radio" name="soup" checked={soup === item.label} onChange={() => setSoup(item.label)} className="h-4 w-4 accent-accent" />{item.label}</label>)}</div></section>
    <section><div className="flex items-center justify-between"><h2 className="text-sm font-bold text-ink">スタイル</h2><button type="button" onClick={() => setExpanded(!expanded)} className="text-xs font-bold text-accent">{expanded ? "折りたたむ" : "すべて表示"}</button></div><div className="mt-3 grid gap-2">{visibleStyles.map((item) => <label key={item.label} className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary"><input type="radio" name="style" checked={style === item.label} onChange={() => setStyle(item.label)} className="h-4 w-4 accent-accent" />{item.label}</label>)}</div></section>
    <section><h2 className="text-sm font-bold text-ink">評価</h2><select aria-label="最低評価" value={minRating} onChange={(event) => setMinRating(event.target.value)} className="mt-3 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink"><option value="">指定なし</option><option value="4.5">4.5以上</option><option value="4">4.0以上</option></select></section>
    <button type="button" onClick={onClear} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm font-bold text-text-secondary transition hover:border-accent hover:text-accent">条件をクリア</button>
  </div>;
}

export function SearchExperience({ initialShops, initialTotal }: Props) {
  const [query, setQuery] = useState("");
  const [soup, setSoup] = useState("");
  const [style, setStyle] = useState("");
  const [minRating, setMinRating] = useState("");
  const [shops, setShops] = useState(initialShops);
  const [mapShops, setMapShops] = useState<MapShop[]>([]);
  const mapVisible = true;
  const setMapVisible = (_value: boolean) => undefined;
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [initializedFromUrl, setInitializedFromUrl] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [recentOnly, setRecentOnly] = useState(false);
  const [openOnly, setOpenOnly] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [mapResetRevision, setMapResetRevision] = useState(0);
  const [sort, setSort] = useState("reviews");
  const [retryNonce, setRetryNonce] = useState(0);
  const skippedInitialRequest = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get("q") ?? "";
    setQuery(initialQuery); setSoup(params.get("soup") ?? ""); setStyle(params.get("style") ?? "");
    setMinRating(["4", "4.5"].includes(params.get("minRating") ?? "") ? params.get("minRating")! : ""); setOpenOnly(params.get("open") === "1");
    setRecentOnly(params.get("recent") === "1"); setFavoriteOnly(params.get("favorite") === "1");
    const savedPage = Number(params.get("page")); if (Number.isInteger(savedPage) && savedPage > 1) setPage(savedPage);
    setInitializedFromUrl(true);
  }, []);
  useEffect(() => { const sync = () => setFavoriteIds(readFavoriteIds()); sync(); window.addEventListener("favorites-changed", sync); return () => window.removeEventListener("favorites-changed", sync); }, []);
  useEffect(() => { const sync = () => setRecentIds(readRecentShops().map((shop) => shop.id)); sync(); window.addEventListener("recent-shops-changed", sync); return () => window.removeEventListener("recent-shops-changed", sync); }, []);
  useEffect(() => { if (!mobileFiltersOpen) return; const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileFiltersOpen(false); }; document.addEventListener("keydown", onKeyDown); const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previous; }; }, [mobileFiltersOpen]);

  useEffect(() => {
    if (!initializedFromUrl) return;
    const isDefaultInitialView = !query && !soup && !style && !minRating && !favoriteOnly && !recentOnly && !openOnly && page === 1 && sort === "reviews";
    if (!skippedInitialRequest.current && isDefaultInitialView && initialShops.length > 0) { skippedInitialRequest.current = true; return; }
    skippedInitialRequest.current = true;
    const controller = new AbortController(); setLoading(true); setSearchError("");
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, soup, style, minRating, sort, limit: String(PAGE_SIZE), offset: String((page - 1) * PAGE_SIZE) });
        if (sort === "distance") { params.set("latitude", String(TOKYO_STATION.latitude)); params.set("longitude", String(TOKYO_STATION.longitude)); }
        if (favoriteOnly) params.set("ids", favoriteIds.join(",")); if (recentOnly) params.set("ids", recentIds.join(",")); if (openOnly) params.set("openNow", "true");
        const response = await fetch(`/api/shops?${params}`, { signal: controller.signal }); if (!response.ok) throw new Error("店舗情報を読み込めませんでした");
        const data = await response.json(); setShops(data.shops ?? []); setMapShops(data.mapShops ?? data.shops ?? []); setTotal(data.total ?? 0);
      } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setSearchError("店舗情報を読み込めませんでした。時間をおいて、もう一度お試しください。"); } finally { setLoading(false); }
    }, 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, soup, style, minRating, sort, favoriteOnly, recentOnly, openOnly, favoriteIds, recentIds, page, initializedFromUrl, retryNonce, initialShops.length]);

  useEffect(() => { if (!initializedFromUrl) return; const params = new URLSearchParams(); if (query) params.set("q", query); if (soup) params.set("soup", soup); if (style) params.set("style", style); if (minRating) params.set("minRating", minRating); if (openOnly) params.set("open", "1"); if (recentOnly) params.set("recent", "1"); if (favoriteOnly) params.set("favorite", "1"); if (page > 1) params.set("page", String(page)); window.history.replaceState(null, "", params.toString() ? `/?${params}` : "/"); }, [query, soup, style, minRating, openOnly, recentOnly, favoriteOnly, page, initializedFromUrl]);
  const clearFilters = useCallback(() => { setQuery(""); setSoup(""); setStyle(""); setMinRating(""); setFavoriteOnly(false); setRecentOnly(false); setOpenOnly(false); setPage(1); }, []);
  const displayTotal = total;
  const totalPages = Math.max(1, Math.ceil(displayTotal / PAGE_SIZE));
  const visibleStart = displayTotal ? (page - 1) * PAGE_SIZE + 1 : 0;
  const visibleEnd = Math.min(page * PAGE_SIZE, displayTotal);
  const activeFilters = [{ key: "soup", label: soup, clear: () => setSoup("") }, { key: "style", label: style, clear: () => setStyle("") }, { key: "rating", label: minRating ? `評価 ${minRating}以上` : "", clear: () => setMinRating("") }, { key: "open", label: openOnly ? "営業中" : "", clear: () => setOpenOnly(false) }].filter((item) => item.label);
  const filterCount = activeFilters.length + (favoriteOnly ? 1 : 0) + (recentOnly ? 1 : 0);
  const nearbyMapShops = useMemo(() => mapShops.filter((shop) => calculateDistanceMeters(TOKYO_STATION.latitude, TOKYO_STATION.longitude, shop.latitude, shop.longitude) <= MAP_RADIUS_METERS), [mapShops]);
  const selectShopFromMap = useCallback((shop: MapShop) => { setSelectedShopId(shop.id); window.setTimeout(() => document.getElementById(`shop-card-${shop.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0); }, []);
  const goToPage = (nextPage: number) => { setPage(Math.min(Math.max(nextPage, 1), totalPages)); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return <>
    <main className="mx-auto max-w-[1440px] px-6 py-8 sm:px-8"><div className="mb-4 flex items-center justify-between text-xs text-text-muted"><span>東京都内のラーメン店を表示</span><span>{loading ? "読み込み中…" : ""}</span></div><div className="flex items-start gap-8"><aside className="sticky top-[88px] hidden max-h-[calc(100vh-110px)] w-[280px] shrink-0 overflow-y-auto rounded-2xl border border-border bg-white p-5 lg:block"><FilterPanel soup={soup} setSoup={(value) => { setSoup(value); setPage(1); }} style={style} setStyle={(value) => { setStyle(value); setPage(1); }} minRating={minRating} setMinRating={(value) => { setMinRating(value); setPage(1); }} openOnly={(openOnly)} setOpenOnly={(value) => { setOpenOnly(value); setPage(1); }} onClear={clearFilters} /></aside><section className="min-w-0 flex-1"><div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-text-secondary">{query ? `「${query}」の検索結果` : "東京のラーメン店"}</p><p className="mt-1 text-2xl font-bold text-ink">{displayTotal.toLocaleString()} <span className="text-sm font-normal text-text-secondary">件</span></p>{displayTotal > 0 && <p className="mt-1 text-xs text-text-muted">{visibleStart}〜{visibleEnd}件を表示</p>}</div><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => setMobileFiltersOpen(true)} className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-bold text-text-secondary lg:hidden">絞り込み{filterCount ? ` ${filterCount}` : ""}</button><label className="flex items-center gap-2 text-sm text-text-secondary"><span className="sr-only">並び順</span><select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink"><option value="reviews">口コミ数が多い順</option><option value="rating">評価が高い順</option><option value="newest">新着順</option><option value="distance">距離が近い順</option></select></label><button type="button" onClick={() => { setRecentOnly((value) => !value); setFavoriteOnly(false); setPage(1); }} className={`rounded-lg border px-3 py-2 text-sm font-bold ${recentOnly ? "border-accent bg-accent-light text-accent" : "border-border bg-white text-text-secondary"}`}>◷ 履歴</button><button type="button" onClick={() => { setFavoriteOnly((value) => !value); setRecentOnly(false); setPage(1); }} className={`rounded-lg border px-3 py-2 text-sm font-bold ${favoriteOnly ? "border-accent bg-accent-light text-accent" : "border-border bg-white text-text-secondary"}`}>♡ お気に入り</button><div className="flex rounded-lg border border-border bg-white p-1"><button type="button" onClick={() => setMapVisible(false)} className={`rounded-md px-3 py-1.5 text-sm font-bold ${!mapVisible ? "bg-accent text-white" : "text-text-secondary"}`}>リスト</button><button type="button" onClick={() => setMapVisible(true)} className={`rounded-md px-3 py-1.5 text-sm font-bold ${mapVisible ? "bg-accent text-white" : "text-text-secondary"}`}>地図</button></div></div></div>
      <div className="mb-5 flex items-center gap-2 lg:hidden"><button type="button" aria-pressed={openOnly} onClick={() => { setOpenOnly((value) => !value); setPage(1); }} className={`rounded-lg border px-3 py-2 text-sm font-bold ${openOnly ? "border-accent bg-accent text-white" : "border-border bg-white text-text-secondary"}`}>営業中</button></div>
      {activeFilters.length > 0 && <div className="mb-5 flex flex-wrap gap-2">{activeFilters.map((item) => <button type="button" key={item.key} onClick={item.clear} className="rounded-full bg-accent-light px-3 py-1.5 text-xs font-bold text-accent">{item.label} ×</button>)}</div>}
      {searchError ? <div role="alert" className="rounded-xl border border-danger/30 bg-danger-light px-5 py-8 text-center text-sm text-danger"><p>店舗情報を読み込めませんでした</p><p className="mt-1">時間をおいて、もう一度お試しください。</p><button type="button" onClick={() => setRetryNonce((value) => value + 1)} className="mt-4 rounded-lg border border-danger/40 px-4 py-2 font-bold">再試行</button></div> : shops.length ? <><div className="overflow-hidden rounded-2xl border border-border bg-white">{shops.map((shop) => <ShopCard key={shop.id} shop={shop} distanceM={calculateDistanceMeters(TOKYO_STATION.latitude, TOKYO_STATION.longitude, shop.latitude, shop.longitude)} selected={selectedShopId === shop.id} />)}</div><nav className="mt-6 flex items-center justify-center gap-3" aria-label="店舗一覧のページ送り"><button type="button" onClick={() => goToPage(page - 1)} disabled={page <= 1} className="min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-bold text-text-secondary disabled:opacity-40">← 前へ</button><span className="text-sm text-text-secondary"><strong className="text-ink">{page}</strong> / {totalPages}</span><button type="button" onClick={() => goToPage(page + 1)} disabled={page >= totalPages} className="min-h-11 rounded-lg border border-accent px-4 py-2 text-sm font-bold text-accent disabled:opacity-40">次へ →</button></nav></> : loading ? <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-48 animate-pulse rounded-2xl border border-border bg-background-subtle" />)}</div> : <div className="rounded-2xl border border-border bg-white px-6 py-16 text-center text-sm text-text-secondary"><p>条件に一致する店舗が見つかりませんでした</p><p className="mt-2 text-xs text-text-muted">スープやスタイルの条件を減らすか、別の駅名・エリアで検索してください。</p><button type="button" onClick={clearFilters} className="mt-5 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white">条件をすべてクリア</button></div>}
    </section></div></main>
    {mobileFiltersOpen && <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="絞り込み"><button type="button" aria-label="絞り込みを閉じる" onClick={() => setMobileFiltersOpen(false)} className="absolute inset-0 bg-black/30" /><div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-ink">絞り込み</h2><button type="button" onClick={() => setMobileFiltersOpen(false)} className="min-h-11 min-w-11 rounded-lg border border-border text-xl text-text-secondary" aria-label="閉じる">×</button></div><div className="mt-6"><FilterPanel soup={soup} setSoup={setSoup} style={style} setStyle={setStyle} minRating={minRating} setMinRating={setMinRating} openOnly={openOnly} setOpenOnly={setOpenOnly} onClear={clearFilters} /></div><button type="button" onClick={() => setMobileFiltersOpen(false)} className="mt-6 min-h-11 w-full rounded-lg bg-accent py-3 text-sm font-bold text-white">{displayTotal.toLocaleString()}件を表示</button></div></div>}
  </>;
}
