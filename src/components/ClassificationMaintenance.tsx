"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const SOUPS = ["醤油", "塩", "味噌", "豚骨", "豚骨醤油", "鶏白湯", "煮干し", "魚介", "その他", "不明"];
const STYLES = ["中華そば", "家系", "二郎系", "つけ麺", "油そば・まぜそば", "担々麺", "博多系", "札幌系", "淡麗系", "濃厚系", "その他", "不明"];
type Shop = { place_id: string; name: string; address: string | null; rating: number | null; user_ratings_total: number | null; soupCategory: string | null; styleCategory: string | null; classificationStatus: string | null };

export function ClassificationMaintenance() {
  const router = useRouter();
  const [shops, setShops] = useState<Shop[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [values, setValues] = useState<Record<string, { soup: string; style: string }>>({});
  const load = useCallback(async () => {
    setLoading(true); setMessage("");
    try {
      const response = await fetch(`/api/research/admin/classification-maintenance?q=${encodeURIComponent(query)}&limit=200`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "店舗データの取得に失敗しました。");
      setShops(data.shops ?? []);
      setValues((current) => Object.fromEntries((data.shops ?? []).map((shop: Shop) => [shop.place_id, current[shop.place_id] ?? { soup: shop.soupCategory ?? "不明", style: shop.styleCategory ?? "不明" }])));
    } catch (error) { setMessage(error instanceof Error ? error.message : "店舗データの取得に失敗しました。"); }
    finally { setLoading(false); }
  }, [query]);
  useEffect(() => { void load(); }, [load]);
  const save = async (shop: Shop) => {
    const selected = values[shop.place_id] ?? { soup: shop.soupCategory ?? "不明", style: shop.styleCategory ?? "不明" };
    if (!selected.soup || !selected.style) return;
    if (!window.confirm(`「${shop.name}」の分類を保存して確定しますか？`)) return;
    setSaving(shop.place_id); setMessage("");
    try {
      const response = await fetch("/api/research/admin/manual-classification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ placeId: shop.place_id, soupCategory: selected.soup, styleCategory: selected.style, finalize: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "分類の保存に失敗しました。");
      await load(); router.refresh();
      setMessage(`${shop.name} の分類を保存しました。教師データにも反映されています。`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "分類の保存に失敗しました。"); }
    finally { setSaving(null); }
  };
  const exclude = async (shop: Shop) => {
    if (!window.confirm(`「${shop.name}」をラーメン店ではない店舗として一覧・分類対象から除外しますか？\n\nデータは完全削除されず、必要なら復元できます。`)) return;
    setSaving(shop.place_id); setMessage("");
    try {
      const response = await fetch("/api/research/admin/exclude-shop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ placeId: shop.place_id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "店舗の除外に失敗しました。");
      await load(); router.refresh();
      setMessage(`${shop.name} を対象外にしました。`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "店舗の除外に失敗しました。"); }
    finally { setSaving(null); }
  };
  return <section className="panel mt-8 rounded-2xl p-6">
    <h2 className="text-2xl font-black">スープ系統・スタイル修正</h2>
    <p className="mt-3 text-sm text-stone-400">登録済み店舗を検索して分類を修正します。保存すると承認済みになり、教師データCSVにも反映されます。</p>
    <div className="mt-5 flex flex-wrap gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void load(); }} placeholder="店名で検索" className="min-w-64 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3" /><button disabled={loading} onClick={() => void load()} className="rounded-xl bg-gold px-4 py-3 font-bold text-ink">検索</button></div>
    {message && <p className="mt-4 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">{message}</p>}
    <p className="mt-5 text-sm text-stone-500">{loading ? "読み込み中…" : `${shops.length}店を表示中（検索結果の先頭200店）`}</p>
    <div className="mt-3 space-y-3">{shops.map((shop) => { const selected = values[shop.place_id] ?? { soup: shop.soupCategory ?? "不明", style: shop.styleCategory ?? "不明" }; return <article key={shop.place_id} className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold">{shop.name}</h3><p className="mt-1 text-sm text-stone-400">{shop.address ?? "住所未登録"}</p><p className="mt-1 text-xs text-stone-500">Google {shop.rating?.toFixed(1) ?? "–"} / 口コミ {shop.user_ratings_total?.toLocaleString() ?? "–"}件</p></div><span className="rounded bg-white/5 px-2 py-1 text-xs text-stone-400">{shop.classificationStatus ?? "未分類"}</span></div><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"><label className="text-sm font-medium text-white">スープ系統<select value={selected.soup} onChange={(event) => setValues((current) => ({ ...current, [shop.place_id]: { ...selected, soup: event.target.value } }))} className="mt-1 block w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-white">{SOUPS.map((value) => <option key={value}>{value}</option>)}</select></label><label className="text-sm font-medium text-white">スタイル<select value={selected.style} onChange={(event) => setValues((current) => ({ ...current, [shop.place_id]: { ...selected, style: event.target.value } }))} className="mt-1 block w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-white">{STYLES.map((value) => <option key={value}>{value}</option>)}</select></label><button disabled={saving === shop.place_id} onClick={() => void save(shop)} className="rounded-lg bg-emerald-400 px-4 py-2 font-bold text-ink">{saving === shop.place_id ? "保存中…" : "修正を保存"}</button><button disabled={saving === shop.place_id} onClick={() => void exclude(shop)} className="rounded-lg border border-red-500/60 px-4 py-2 font-bold text-red-400 hover:bg-red-500/10">削除</button></div></article>; })}</div>
    {!loading && !shops.length && <p className="mt-6 text-center text-stone-400">該当する店舗がありません。</p>}
  </section>;
}
