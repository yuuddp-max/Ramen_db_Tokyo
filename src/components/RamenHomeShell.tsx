"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { RamenShop } from "@/types/ramen";
import type { WebRamenMentionWithShop } from "@/types/web-ramen";
import { RAMEN_SOUPS, RAMEN_STYLES } from "@/lib/ramen-genres";
import { HorizontalTabs, type HorizontalTab } from "./HorizontalTabs";
import { SearchExperience } from "./SearchExperience";
import { FeaturedNewsCarousel } from "./FeaturedNewsCarousel";
import { NewsList } from "./NewsList";
import { MobileBottomNav } from "./MobileBottomNav";

type Mode = "news" | "shops";
const NEWS_CATEGORIES: HorizontalTab[] = [
  { id: "all", label: "すべて" }, { id: "新店情報", label: "新店" }, { id: "限定メニュー", label: "限定メニュー" }, { id: "トレンド", label: "トレンド" }, { id: "メディア", label: "メディア掲載" }, { id: "ランキング", label: "ランキング" }, { id: "営業情報", label: "営業情報" },
];
const SHOP_GENRES: HorizontalTab[] = [{ id: "all", label: "すべて" }, ...RAMEN_SOUPS.slice(0, 12).map((item) => ({ id: `soup:${item.label}`, label: item.label })), ...RAMEN_STYLES.slice(0, 8).map((item) => ({ id: `style:${item.label}`, label: item.label }))];
const AREAS: HorizontalTab[] = ["現在地周辺", "新宿", "池袋", "渋谷", "中野", "上野", "秋葉原", "吉祥寺", "高田馬場", "東京駅", "銀座", "浅草"].map((area) => ({ id: area, label: area }));

function readState() {
  const params = new URLSearchParams(window.location.search);
  return { mode: (params.get("mode") === "news" ? "news" : "shops") as Mode, category: params.get("category") ?? "all", genre: params.get("soup") ? `soup:${params.get("soup")}` : params.get("style") ? `style:${params.get("style")}` : "all", area: params.get("area") ?? "all" };
}

export function RamenHomeShell({ initialShops, initialTotal, posts }: { initialShops: RamenShop[]; initialTotal: number; posts: WebRamenMentionWithShop[] }) {
  const [mode, setMode] = useState<Mode>("shops");
  const [category, setCategory] = useState("all");
  const [genre, setGenre] = useState("all");
  const [area, setArea] = useState("all");

  useEffect(() => { const sync = () => { const state = readState(); setMode(state.mode); setCategory(state.category); setGenre(state.genre); setArea(state.area); }; sync(); window.addEventListener("popstate", sync); return () => window.removeEventListener("popstate", sync); }, []);
  const updateUrl = (updates: Record<string, string | null>) => { const url = new URL(window.location.href); Object.entries(updates).forEach(([key, value]) => value ? url.searchParams.set(key, value) : url.searchParams.delete(key)); window.history.pushState(null, "", `${url.pathname}${url.search}`); };
  const changeMode = (nextMode: Mode) => { setMode(nextMode); updateUrl({ mode: nextMode }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const changeCategory = (next: string) => { setCategory(next); setMode("news"); updateUrl({ mode: "news", category: next }); };
  const changeGenre = (next: string) => { setGenre(next); setArea("all"); setMode("shops"); if (next === "all") updateUrl({ mode: "shops", soup: null, style: null, q: null, area: null }); else { const [kind, value] = next.split(":"); updateUrl({ mode: "shops", soup: kind === "soup" ? value : null, style: kind === "style" ? value : null, q: null, area: null }); } };
  const changeArea = (next: string) => { setArea(next); setGenre("all"); setMode("shops"); updateUrl({ mode: "shops", area: next === "all" ? null : next, soup: null, style: null, q: next === "all" || next === "現在地周辺" ? null : next }); };
  const shopKey = `${mode}-${genre}-${area}`;
  const activeGenreLabel = useMemo(() => SHOP_GENRES.find((tab) => tab.id === genre)?.label ?? "すべて", [genre]);
  return <div className="min-h-screen pb-16 md:pb-0">
    <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur"><div className="mx-auto flex min-h-[76px] max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-6"><button type="button" onClick={() => { changeMode("shops"); window.setTimeout(() => document.querySelector<HTMLInputElement>("input[placeholder*='店名']")?.focus(), 100); }} aria-label="検索を開く" className="grid min-h-11 min-w-11 place-items-center rounded-full text-2xl text-accent hover:bg-accent-light">⌕</button><Link href="/" className="min-w-0 text-center" aria-label="らーめんDBのトップへ"><span className="block text-xl font-black tracking-tight text-ink sm:text-2xl">らーめん<span className="text-accent">DB</span></span><span className="hidden text-[10px] font-bold tracking-[.14em] text-text-secondary sm:block">ラーメンの今が見つかるデータベース</span></Link><span className="min-h-11 min-w-11" aria-hidden="true" /></div></header>
    <main className="mx-auto max-w-[1200px] px-4 pb-10 sm:px-6"><div className="mt-4 rounded-2xl border border-border bg-white p-2 shadow-warm sm:mt-6"><div className="grid grid-cols-2 gap-2" role="tablist" aria-label="表示モード"><button type="button" role="tab" aria-selected={mode === "news"} onClick={() => changeMode("news")} className={`min-h-14 rounded-xl text-sm font-black transition duration-200 ${mode === "news" ? "bg-accent text-white" : "text-text-secondary hover:bg-background-subtle"}`}>◉ ニュース</button><button type="button" role="tab" aria-selected={mode === "shops"} onClick={() => changeMode("shops")} className={`min-h-14 rounded-xl text-sm font-black transition duration-200 ${mode === "shops" ? "bg-accent text-white" : "text-text-secondary hover:bg-background-subtle"}`}>🍜 ラーメン店</button></div></div>
      {mode === "news" ? <><div className="mt-5"><HorizontalTabs tabs={NEWS_CATEGORIES} value={category} onChange={changeCategory} label="ニュースカテゴリ" /></div><section className="mt-8"><p className="text-xs font-bold tracking-[.18em] text-accent">RAMEN NEWS</p><h1 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">東京ラーメンの今を読む</h1><p className="mt-3 text-sm leading-6 text-text-secondary">新店、限定メニュー、メディア掲載など、直近の東京ラーメン情報をまとめています。</p></section><FeaturedNewsCarousel posts={posts} /><NewsList posts={posts} category={category} /></> : <><div className="mt-5"><p className="mb-2 text-xs font-bold text-text-secondary">ジャンル</p><HorizontalTabs tabs={SHOP_GENRES} value={genre} onChange={changeGenre} label="ラーメンジャンル" /></div><div className="mt-4"><p className="mb-2 text-xs font-bold text-text-secondary">地域</p><HorizontalTabs tabs={[{ id: "all", label: "すべて" }, ...AREAS]} value={area} onChange={changeArea} label="地域" /></div><div className="mt-7"><p className="text-xs font-bold tracking-[.18em] text-accent">RAMEN SHOPS</p><h1 className="mt-2 text-2xl font-black text-ink sm:text-3xl">今日の一杯を探す</h1><p className="mt-2 text-sm text-text-secondary">{activeGenreLabel}{area !== "all" ? `・${area}` : ""}から、気になるラーメン店を探せます。</p></div><div className="mt-4"><SearchExperience key={shopKey} initialShops={initialShops} initialTotal={initialTotal} /></div></>}</main>
    <footer className="border-t border-border bg-white px-4 py-8 text-center text-xs text-text-muted">© {new Date().getFullYear()} らーめんDB</footer><MobileBottomNav mode={mode} onModeChange={changeMode} onFavorites={() => { changeMode("shops"); updateUrl({ favorite: "1" }); }} />
  </div>;
}
