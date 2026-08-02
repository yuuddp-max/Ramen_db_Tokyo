"use client";

import { useCallback, useEffect, useState } from "react";

type FeatureShop = {
  id: string;
  place_id: string;
  name: string;
  address: string | null;
  shop_description: string | null;
  representative_menu: string | null;
  review_summary: string | null;
  feature_text: string | null;
  feature_keywords: Record<string, string[]> | null;
  feature_source_urls: string[] | null;
  feature_status: string | null;
  feature_method: string | null;
  feature_confidence: number | null;
  feature_updated_at: string | null;
  feature_error: string | null;
  soupCategory: string | null;
  styleCategory: string | null;
};
type FeatureJob = { id: string; status: string; requested_count: number; processed_count: number; database_count: number; needs_review_count: number; no_information_count: number; error_count: number; skipped_count: number; };

const groups: Array<[string, string]> = [
  ["soup", "スープ"],
  ["style", "スタイル"],
  ["noodle", "麺"],
  ["topping", "トッピング"],
  ["taste", "味"],
  ["menu", "メニュー"],
];

function statusLabel(status: string | null) {
  return ({
    "needs-review": "確認待ち",
    "no-information": "情報なし",
    completed: "承認済み",
    error: "エラー",
    pending: "未処理",
  } as Record<string, string>)[status ?? ""] ?? status ?? "-";
}

export function RamenFeatureMaintenance() {
  const [shops, setShops] = useState<FeatureShop[]>([]);
  const [target, setTarget] = useState("10");
  const [status, setStatus] = useState("needs-review");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [job, setJob] = useState<FeatureJob | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const response = await fetch(`/api/research/admin/feature-maintenance?status=${encodeURIComponent(status)}&limit=100`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "特徴情報を取得できませんでした。");
      setShops(payload.shops ?? []);
      setEdited(Object.fromEntries((payload.shops ?? []).map((shop: FeatureShop) => [shop.place_id, shop.feature_text ?? ""])));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "特徴情報を取得できませんでした。");
    } finally {
      setBusy(false);
    }
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  const runJob = async () => {
    setBusy(true);
    setMessage("店舗特徴情報の取得ジョブを登録しています…");
    try {
      const response = await fetch("/api/research/admin/feature-jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: Number(target) }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "ジョブを登録できませんでした。");
      setJob(payload.job ?? null);
      setMessage(payload.message ?? "特徴情報の取得を開始しました。完了後に一覧を更新してください。");
      setStatus("needs-review");
      if (payload.job?.id) {
        for (let attempt = 0; attempt < 30; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 2000));
          const progressResponse = await fetch("/api/research/admin/feature-jobs", { cache: "no-store" });
          const progress = await progressResponse.json().catch(() => ({}));
          if (progress.job) setJob(progress.job);
          if (["completed", "partially-completed", "error", "cancelled"].includes(progress.job?.status)) break;
        }
        await load();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ジョブを登録できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const update = async (shop: FeatureShop, action: "approve" | "no-information" | "retry" | "save") => {
    setBusy(true);
    try {
      const response = await fetch("/api/research/admin/feature-maintenance", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ placeId: shop.place_id, action, featureText: edited[shop.place_id] }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "保存に失敗しました。");
      setMessage(action === "approve" || action === "save" ? `「${shop.name}」の特徴情報を承認しました。` : "更新しました。");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  const exclude = async (shop: FeatureShop) => {
    if (!window.confirm(`「${shop.name}」を対象外にしますか？`)) return;
    setBusy(true);
    try {
      const response = await fetch("/api/research/admin/exclude-shop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ placeId: shop.place_id }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "対象外への変更に失敗しました。");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "対象外への変更に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel mt-5 rounded-2xl p-6 text-ink sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[.2em] text-gold">LOCAL FEATURE EXTRACTION</p>
          <h2 className="mt-1 text-xl font-black">店舗特徴情報</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-700">登録済みの店名・説明・メニュー・口コミ要約から、スープ・スタイル・麺・具材などの特徴語を抽出します。外部APIや生成AIは使用しません。</p>
        </div>
      </div>
      <div className="mt-5 rounded-xl border border-gold/40 bg-amber-50 p-4 text-sm text-stone-800">
        <p className="font-bold text-stone-900">操作手順</p>
        <p className="mt-1 leading-6">①取得件数を選ぶ → ②「店舗特徴情報を取得」を押す → ③確認待ちを確認 → ④内容を承認。承認済みの特徴だけが教師データCSVに採用されます。</p>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] md:items-end">
        <label className="text-sm font-bold text-stone-900">取得件数
          <select aria-label="特徴情報の取得件数" value={target} onChange={(event) => setTarget(event.target.value)} className="mt-1 block w-full rounded-lg border border-stone-400 bg-black px-3 py-2 text-white">
            <option value="1">1件</option><option value="10">10件</option><option value="50">50件</option><option value="1000">未取得店舗すべて（最大1000件）</option>
          </select>
        </label>
        <button disabled={busy} onClick={() => void runJob()} className="rounded-xl bg-gold px-4 py-3 font-bold text-ink shadow-sm disabled:cursor-not-allowed disabled:opacity-50">{busy ? "処理中…" : "店舗特徴情報を取得"}</button>
        <label className="text-sm font-bold text-stone-900">表示する状態
          <select aria-label="表示する特徴情報の状態" value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 block w-full rounded-lg border border-stone-400 bg-black px-3 py-2 text-white">
            <option value="needs-review">確認待ち</option><option value="completed">承認済み</option><option value="no-information">情報なし</option><option value="error">エラー</option><option value="pending">未処理</option>
          </select>
        </label>
        <button disabled={busy} onClick={() => void load()} className="rounded-xl border border-stone-400 px-4 py-3 text-sm font-bold text-stone-900 disabled:cursor-not-allowed disabled:opacity-50">更新</button>
      </div>
      {message && <p role="status" className="mt-4 rounded-xl border border-gold/50 bg-amber-50 px-4 py-3 text-sm font-medium text-stone-900">{message}</p>}
      {job && <div className="mt-4 rounded-xl border border-stone-300 bg-stone-100 p-4 text-sm text-stone-900"><div className="flex flex-wrap justify-between gap-2 font-bold"><span>ジョブ状態: {job.status}</span><span>処理済み {job.processed_count} / {job.requested_count}店舗</span></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-stone-300"><div className="h-full bg-gold transition-all" style={{ width: `${Math.min(100, job.requested_count ? (job.processed_count / job.requested_count) * 100 : 0)}%` }} /></div><div className="mt-3 grid gap-2 text-xs font-medium text-stone-700 sm:grid-cols-2 lg:grid-cols-5"><span>DB情報のみ: {job.database_count}件</span><span>確認待ち: {job.needs_review_count}件</span><span>情報なし: {job.no_information_count}件</span><span>エラー: {job.error_count}件</span><span>キャッシュスキップ: {job.skipped_count}件</span></div></div>}
      <p className="mt-4 text-sm font-medium text-stone-700">{shops.length}件を表示中。確認・承認済みの特徴情報だけが特徴付き教師CSVに採用されます。</p>
      <div className="mt-4 space-y-3">
        {shops.map((shop) => (
          <article key={shop.place_id} className="rounded-xl border border-stone-300 bg-stone-50 p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <h3 className="font-bold text-stone-900">{shop.name}</h3><span className="text-sm text-stone-700">{shop.address ?? "住所なし"}</span><span className="rounded bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900">{statusLabel(shop.feature_status)}</span><span className="text-xs font-medium text-stone-700">確信度 {shop.feature_confidence?.toFixed(2) ?? "-"}</span>
            </div>
            {(shop.shop_description || shop.representative_menu || shop.review_summary) && <p className="mt-2 text-xs leading-5 text-stone-700">{[shop.shop_description, shop.representative_menu, shop.review_summary].filter(Boolean).join(" ")}</p>}
            <label className="mt-3 block text-sm font-bold text-stone-900">生成された特徴テキスト（編集可能）<textarea value={edited[shop.place_id] ?? ""} onChange={(event) => setEdited((current) => ({ ...current, [shop.place_id]: event.target.value }))} rows={2} className="mt-1 w-full rounded-lg border border-stone-500 bg-black px-3 py-2 text-sm text-white placeholder:text-stone-500" /></label>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-stone-400">
              {groups.map(([key, label]) => {
                const values = shop.feature_keywords?.[key] ?? [];
                return values.length ? <span key={key}><b className="text-stone-300">{label}:</b> {values.join(" / ")}</span> : null;
              })}
            </div>
            {shop.feature_source_urls?.length ? <p className="mt-2 text-xs font-medium text-stone-700">取得元: {shop.feature_source_urls.join(" / ")}</p> : <p className="mt-2 text-xs font-medium text-stone-700">取得元: Supabaseに保存済みの店舗情報</p>}
            {shop.feature_error && <p className="mt-2 text-sm text-red-300">{shop.feature_error}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => void update(shop, "save")} className="rounded-lg border border-gold px-3 py-2 text-sm font-bold text-gold">編集して承認</button>
              <button disabled={busy} onClick={() => void update(shop, "approve")} className="rounded-lg bg-emerald-400 px-3 py-2 text-sm font-bold text-ink">承認</button>
              <button disabled={busy} onClick={() => void update(shop, "retry")} className="rounded-lg border border-stone-400 px-3 py-2 text-sm font-medium text-stone-900">再取得</button>
              <button disabled={busy} onClick={() => void update(shop, "no-information")} className="rounded-lg border border-stone-400 px-3 py-2 text-sm font-medium text-stone-900">情報なし</button>
              <button disabled={busy} onClick={() => void exclude(shop)} className="rounded-lg border border-red-500/60 px-3 py-2 text-sm text-red-300">対象外</button>
            </div>
          </article>
        ))}
        {!shops.length && <div className="rounded-xl border border-stone-300 bg-stone-50 px-4 py-10 text-center font-medium text-stone-700">該当する店舗はありません。</div>}
      </div>
    </section>
  );
}
