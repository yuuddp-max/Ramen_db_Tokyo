"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const PAGE_SIZE = 10;
type Shop = { place_id: string; name: string; address: string | null; rating: number | null; user_ratings_total: number | null };

export function ShopNameMaintenance() {
  const router = useRouter();
  const [shops, setShops] = useState<Shop[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const load = useCallback(async () => {
    setLoading(true); setMessage("");
    try {
      const response = await fetch(`/api/research/admin/shop-name-maintenance?q=${encodeURIComponent(query)}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "店舗データの取得に失敗しました。");
      setShops(data.shops ?? []); setTotal(data.total ?? 0); setSelected(new Set());
      setNames((current) => Object.fromEntries((data.shops ?? []).map((shop: Shop) => [shop.place_id, current[shop.place_id] ?? shop.name])));
    } catch (error) { setMessage(error instanceof Error ? error.message : "店舗データの取得に失敗しました。"); }
    finally { setLoading(false); }
  }, [page, query]);
  useEffect(() => { void load(); }, [load]);
  const search = () => { setPage(0); if (page === 0) void load(); };
  const save = async (shop: Shop) => {
    const name = names[shop.place_id]?.replace(/\s+/g, " ").trim() ?? "";
    setSaving(shop.place_id); setMessage("");
    try {
      const response = await fetch("/api/research/admin/shop-name-maintenance", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ placeId: shop.place_id, name }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "店名の保存に失敗しました。");
      await load(); router.refresh(); setMessage(`${data.shop?.name ?? name} の店名を保存しました。分類は再確認待ちになっています。`);
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
      await load(); router.refresh(); setMessage(`${shop.name} を店舗一覧から削除しました。`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "店舗の削除に失敗しました。"); }
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
      await load(); router.refresh(); setMessage(data.message ?? `${data.excluded ?? 0}店舗を削除しました。`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "店舗の一括削除に失敗しました。"); }
    finally { setSaving(null); }
  };
  const allSelected = shops.length > 0 && shops.every((shop) => selected.has(shop.place_id));
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return <section className="panel mt-8 rounded-2xl p-6">
    <h2 className="text-2xl font-black">店名修正</h2>
    <p className="mt-3 text-sm text-stone-400">登録済み店舗の店名を修正します。変更後は分類が再確認待ちになります。</p>
    <div className="mt-5 flex flex-wrap gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") search(); }} placeholder="店名で検索" className="min-w-64 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3" /><button disabled={loading} onClick={search} className="rounded-xl bg-gold px-4 py-3 font-bold text-ink">検索</button></div>
    {pageCount > 1 && <div className="mt-4 flex items-center justify-center gap-3"><button disabled={page === 0 || loading} onClick={() => setPage((current) => Math.max(0, current - 1))} className="rounded-lg border border-white/15 px-4 py-2 text-sm font-bold text-stone-200 disabled:cursor-not-allowed disabled:opacity-40">前へ</button><span className="text-sm text-stone-400">{page + 1} / {pageCount}ページ</span><button disabled={page >= pageCount - 1 || loading} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} className="rounded-lg border border-white/15 px-4 py-2 text-sm font-bold text-stone-200 disabled:cursor-not-allowed disabled:opacity-40">次へ</button></div>}
    {message && <p className="mt-4 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">{message}</p>}
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-stone-500">{loading ? "読み込み中…" : total ? `${total}店中 ${page * PAGE_SIZE + 1}〜${Math.min((page + 1) * PAGE_SIZE, total)}店を表示` : "0店"}</p><div className="flex items-center gap-3"><label className="flex items-center gap-2 text-sm text-stone-400"><input type="checkbox" checked={allSelected} onChange={(event) => setSelected(event.target.checked ? new Set(shops.map((shop) => shop.place_id)) : new Set())} disabled={loading || !shops.length} />表示中を全選択</label><button disabled={saving !== null || loading || !selected.size} onClick={() => void removeSelected()} className="rounded-lg border border-red-400/70 px-4 py-2 text-sm font-bold text-red-300 hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-40">選択した店舗をまとめて削除（{selected.size}）</button></div></div>
    <div className="mt-3 space-y-3">{shops.map((shop) => <article key={shop.place_id} className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="flex flex-wrap items-center gap-3"><input type="checkbox" checked={selected.has(shop.place_id)} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(shop.place_id); else next.delete(shop.place_id); return next; })} aria-label={`${shop.name}を選択`} /><p className="text-sm text-stone-400">{shop.address ?? "住所未登録"}</p><p className="text-xs text-stone-500">Google {shop.rating?.toFixed(1) ?? "–"} / 口コミ {shop.user_ratings_total?.toLocaleString() ?? "–"}件</p></div><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={names[shop.place_id] ?? shop.name} onChange={(event) => setNames((current) => ({ ...current, [shop.place_id]: event.target.value }))} className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black px-3 py-2 font-bold text-white" aria-label={`${shop.name}の店名`} /><button disabled={saving !== null || loading} onClick={() => void save(shop)} className="rounded-lg bg-emerald-400 px-4 py-2 font-bold text-ink">{saving === shop.place_id ? "保存中…" : "店名を保存"}</button><button disabled={saving !== null || loading} onClick={() => void remove(shop)} className="rounded-lg border border-red-400/70 px-4 py-2 font-bold text-red-300 hover:bg-red-400/10">削除</button></div></article>)}</div>
    {!loading && !shops.length && <p className="mt-6 text-center text-stone-400">該当する店舗がありません。</p>}
  </section>;
}
