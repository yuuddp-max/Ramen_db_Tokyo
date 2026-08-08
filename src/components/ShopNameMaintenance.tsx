"use client";

import { useCallback, useEffect, useState } from "react";
import { SOUP_CATEGORIES, STYLE_CATEGORIES } from "@/lib/shop-classification-categories";

const PAGE_SIZE = 10;
type Shop = { place_id: string; name: string; address: string | null; genres?: string[] | null; rating: number | null; user_ratings_total: number | null; soupCategory: string | null; styleCategory: string | null; is_excluded: boolean };

export function ShopNameMaintenance() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [nonRamenOnly, setNonRamenOnly] = useState(false);
  const [soupUnregistered, setSoupUnregistered] = useState(false);
  const [includeExcluded, setIncludeExcluded] = useState(false);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const [soupCategories, setSoupCategories] = useState<Record<string, string>>({});
  const [styleCategories, setStyleCategories] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const load = useCallback(async () => {
    setLoading(true); setMessage("");
    try {
      const response = await fetch(`/api/research/admin/shop-name-maintenance?q=${encodeURIComponent(query)}&nonRamen=${nonRamenOnly ? "1" : "0"}&soupUnregistered=${soupUnregistered ? "1" : "0"}&includeExcluded=${includeExcluded ? "1" : "0"}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "店舗データの取得に失敗しました。");
      setShops(data.shops ?? []); setTotal(data.total ?? 0); setSelected(new Set());
      setNames((current) => Object.fromEntries((data.shops ?? []).map((shop: Shop) => [shop.place_id, current[shop.place_id] ?? shop.name])));
      setSoupCategories((current) => Object.fromEntries((data.shops ?? []).map((shop: Shop) => [shop.place_id, current[shop.place_id] ?? shop.soupCategory ?? ""])));
      setStyleCategories((current) => Object.fromEntries((data.shops ?? []).map((shop: Shop) => [shop.place_id, current[shop.place_id] ?? shop.styleCategory ?? ""])));
    } catch (error) { setMessage(error instanceof Error ? error.message : "店舗データの取得に失敗しました。"); }
    finally { setLoading(false); }
  }, [page, query, nonRamenOnly, soupUnregistered, includeExcluded]);
  useEffect(() => { void load(); }, [load]);
  const search = () => { setPage(0); if (page === 0) void load(); };
  const save = async (shop: Shop) => {
    const name = names[shop.place_id]?.replace(/\s+/g, " ").trim() ?? "";
    const soupCategory = soupCategories[shop.place_id] ?? "";
    const styleCategory = styleCategories[shop.place_id] ?? "";
    setSaving(shop.place_id); setMessage("");
    try {
      const response = await fetch("/api/research/admin/shop-name-maintenance", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ placeId: shop.place_id, name, soupCategory, styleCategory }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "店名の保存に失敗しました。");
      await load(); setMessage(`${data.shop?.name ?? name} の店名・分類を保存しました。`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "店名の保存に失敗しました。"); }
    finally { setSaving(null); }
  };
  const remove = async (shop: Shop) => {
    if (!window.confirm(`「${shop.name}」を店舗一覧から削除しますか？\n\nデータは完全削除せず、除外状態として保存します。`)) return;
    setSaving(shop.place_id); setMessage("");
    try {
      const response = await fetch("/api/research/admin/exclude-shop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ placeId: shop.place_id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "店舗の削除に失敗しました。");
      await load(); setMessage(`${shop.name} を店舗一覧から削除しました。`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "店舗の削除に失敗しました。"); }
    finally { setSaving(null); }
  };
  const restore = async (shop: Shop) => {
    setSaving(shop.place_id); setMessage("");
    try {
      const response = await fetch("/api/research/admin/restore-shop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ placeId: shop.place_id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "店舗の復元に失敗しました。");
      await load(); setMessage(`${shop.name} を通常店舗に戻しました。`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "店舗の復元に失敗しました。"); }
    finally { setSaving(null); }
  };
  const removeSelected = async () => {
    const placeIds = [...selected];
    if (!placeIds.length) return;
    if (!window.confirm(`選択した${placeIds.length}店舗を一覧から削除しますか？\n\nデータは完全削除せず、除外状態として保存します。`)) return;
    setSaving("bulk"); setMessage("");
    try {
      const response = await fetch("/api/research/admin/exclude-shops", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ placeIds }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "店舗の一括削除に失敗しました。");
      await load(); setMessage(data.message ?? `${data.excluded ?? 0}店舗を削除しました。`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "店舗の一括削除に失敗しました。"); }
    finally { setSaving(null); }
  };
  const allSelected = shops.length > 0 && shops.every((shop) => selected.has(shop.place_id));
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return <section className="panel mt-8 rounded-2xl p-6">
    <h2 className="text-2xl font-black">データメンテナンス</h2>
    <p className="mt-3 text-sm text-stone-400">登録済み店舗の店名・スープ系統・スタイル・削除状態を管理します。削除すると ramen_shops.is_excluded=true の削除フラグが付き、一覧・検索対象から除外されます。</p>
    <div className="mt-5 flex flex-wrap gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") search(); }} placeholder="店名で検索" className="min-w-64 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3" /><button disabled={loading} onClick={search} className="rounded-xl bg-gold px-4 py-3 font-bold text-ink">検索</button><button disabled={loading} onClick={() => { setPage(0); setNonRamenOnly((current) => !current); }} className={`rounded-xl border px-4 py-3 font-bold ${nonRamenOnly ? "border-red-400 bg-red-400/10 text-red-300" : "border-white/20 text-stone-200"}`}>{nonRamenOnly ? "全店舗を表示" : "非ラーメン候補を表示"}</button><button disabled={loading} onClick={() => { setPage(0); setSoupUnregistered((current) => !current); }} className={`rounded-xl border px-4 py-3 font-bold ${soupUnregistered ? "border-gold bg-gold/10 text-gold" : "border-white/20 text-stone-200"}`}>{soupUnregistered ? "全店舗を表示" : "スープ未登録を表示"}</button><button disabled={loading} onClick={() => { setPage(0); setIncludeExcluded((current) => !current); }} className={`rounded-xl border px-4 py-3 font-bold ${includeExcluded ? "border-gold bg-gold/10 text-gold" : "border-white/20 text-stone-200"}`}>{includeExcluded ? "通常店舗を表示" : "削除済みを表示"}</button></div>
    {nonRamenOnly && <p className="mt-3 text-sm text-red-300">店名・住所・Googleジャンルから非ラーメン候補を抽出しています。内容を確認してから一括削除してください。</p>}
    {pageCount > 1 && <div className="mt-4 flex items-center justify-center gap-3"><button disabled={page === 0 || loading} onClick={() => setPage((current) => Math.max(0, current - 1))} className="rounded-lg border border-white/15 px-4 py-2 text-sm font-bold text-stone-200 disabled:cursor-not-allowed disabled:opacity-40">前へ</button><span className="text-sm text-stone-400">{page + 1} / {pageCount}ページ</span><button disabled={page >= pageCount - 1 || loading} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} className="rounded-lg border border-white/15 px-4 py-2 text-sm font-bold text-stone-200 disabled:cursor-not-allowed disabled:opacity-40">次へ</button></div>}
    {message && <p className="mt-4 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">{message}</p>}
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-stone-500">{loading ? "読み込み中…" : total ? `${total}店中 ${page * PAGE_SIZE + 1}〜${Math.min((page + 1) * PAGE_SIZE, total)}店を表示` : "0店"}</p><div className="flex items-center gap-3"><label className="flex items-center gap-2 text-sm text-stone-400"><input type="checkbox" checked={allSelected} onChange={(event) => setSelected(event.target.checked ? new Set(shops.map((shop) => shop.place_id)) : new Set())} disabled={loading || !shops.length} />表示中を全選択</label><button disabled={saving !== null || loading || !selected.size} onClick={() => void removeSelected()} className="rounded-lg border border-red-400/70 px-4 py-2 text-sm font-bold text-red-300 hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-40">選択した店舗をまとめて削除（{selected.size}）</button></div></div>
    <div className="mt-3 space-y-3">{shops.map((shop) => <article key={shop.place_id} className={`rounded-xl border border-white/10 p-4 ${shop.is_excluded ? "bg-red-950/20" : "bg-black/20"}`}><div className="flex flex-wrap items-center gap-3"><input type="checkbox" checked={selected.has(shop.place_id)} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(shop.place_id); else next.delete(shop.place_id); return next; })} aria-label={`${shop.name}を選択`} /><p className="text-sm text-stone-400">{shop.address ?? "住所未登録"}</p><p className="text-xs text-stone-500">Google {shop.rating?.toFixed(1) ?? "–"} / 口コミ {shop.user_ratings_total?.toLocaleString() ?? "–"}件</p>{shop.is_excluded && <span className="rounded bg-red-100 px-2 py-1 text-xs font-bold text-red-600">削除済み</span>}</div><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={names[shop.place_id] ?? shop.name} onChange={(event) => setNames((current) => ({ ...current, [shop.place_id]: event.target.value }))} className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black px-3 py-2 font-bold text-white" aria-label={`${shop.name}の店名`} /><select value={soupCategories[shop.place_id] ?? ""} onChange={(event) => setSoupCategories((current) => ({ ...current, [shop.place_id]: event.target.value }))} className="rounded-lg border border-white/15 bg-black px-3 py-2 text-white" aria-label={`${shop.name}のスープ系統`}><option value="">スープ系統（未設定）</option>{SOUP_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select><select value={styleCategories[shop.place_id] ?? ""} onChange={(event) => setStyleCategories((current) => ({ ...current, [shop.place_id]: event.target.value }))} className="rounded-lg border border-white/15 bg-black px-3 py-2 text-white" aria-label={`${shop.name}のスタイル`}><option value="">スタイル（未設定）</option>{STYLE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select>{shop.is_excluded ? <button disabled={saving !== null || loading} onClick={() => void restore(shop)} className="rounded-lg border border-red-500 px-4 py-2 font-bold text-red-600 hover:bg-red-50">元に戻す</button> : <><button disabled={saving !== null || loading} onClick={() => void save(shop)} className="rounded-lg bg-emerald-400 px-4 py-2 font-bold text-ink">{saving === shop.place_id ? "保存中…" : "保存"}</button><button disabled={saving !== null || loading} onClick={() => void remove(shop)} className="rounded-lg border border-red-400/70 px-4 py-2 font-bold text-red-300 hover:bg-red-400/10">削除</button></>}</div></article>)}</div>
    {!loading && !shops.length && <p className="mt-6 text-center text-stone-400">該当する店舗がありません。</p>}
  </section>;
}
