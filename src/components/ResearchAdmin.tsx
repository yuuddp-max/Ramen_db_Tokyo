"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TabelogAwardsImport } from "@/components/TabelogAwardsImport";

const SOUPS = ["醤油", "塩", "味噌", "豚骨", "豚骨醤油", "鶏白湯", "煮干し", "魚介", "その他", "不明"];
const STYLES = ["中華そば", "家系", "二郎系", "つけ麺", "油そば・まぜそば", "担々麺", "博多系", "札幌系", "淡麗系", "濃厚系", "その他", "不明"];
type Menu = "research" | "google" | "webposts" | "summary" | "maintenance" | "hyakumeiten";
type Draft = { place_id: string; name: string; address: string | null; rating: number | null; user_ratings_total: number | null; soupCategory: string | null; styleCategory: string | null; soupConfidence: number | null; styleConfidence: number | null; classificationMethod: string | null; classificationStatus: string | null; research_evidence_summary: string | null };
type Metrics = { total: number; pending: number; draft: number; approved: number; rejected: number; missingRating: number; missingWebsite: number; missingPhoto: number };
type ClassificationMetrics = { total: number; processed: number; autoApproved: number; needsReview: number; ai: number; error: number; progress: number };
type WebFetchLog = { started_at: string; status: string; fetched_count: number; inserted_count: number; updated_count: number; matched_count: number; excluded_count: number; error_count: number; api_status: number | null; error_summary: string | null } | null;

const menus: { key: Menu; label: string; description: string }[] = [
  { key: "research", label: "AIスープ分類レビュー", description: "ルール・ローカルモデル・生成AIフォールバックの結果を確認します。" },
  { key: "google", label: "Google Maps 新規データ取得", description: "Google Mapsで検索し、未登録店舗だけを追加します。" },
  { key: "webposts", label: "今週の話題投稿", description: "Web調査で直近の東京ラーメン情報を取得します。" },
  { key: "summary", label: "登録済みデータ 集計", description: "登録済みデータの状態を集計します。" },
  { key: "maintenance", label: "登録済みデータ メンテナンス", description: "不足情報を確認し、教師データを出力します。" },
  { key: "hyakumeiten", label: "百名店の一括取込", description: "利用権を確認したCSVを取り込みます。" },
];

function Card({ label, value, suffix = "店", tone = "text-white" }: { label: string; value: number; suffix?: string; tone?: string }) {
  return <div className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="text-xs text-stone-500">{label}</p><p className={`mt-1 text-2xl font-black ${tone}`}>{value.toLocaleString()}<span className="ml-1 text-sm font-normal text-stone-500">{suffix}</span></p></div>;
}

export function ResearchAdmin({ authenticated, drafts, metrics, classificationMetrics, webFetchLog }: { authenticated: boolean; drafts: Draft[]; metrics: Metrics; classificationMetrics: ClassificationMetrics; webFetchLog: WebFetchLog }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [active, setActive] = useState<Menu>("research");
  const [query, setQuery] = useState("ラーメン");
  const [manual, setManual] = useState<Record<string, { soup: string; style: string }>>({});
  const request = async (url: string, options: RequestInit = {}) => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options.headers ?? {}) } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "処理に失敗しました。");
      if (data.job) setMessage(`分類ジョブ ${data.job.id} を登録しました。バックグラウンド処理を待機しています。`);
      else if (data.imported != null) setMessage(`Google Mapsで${data.found ?? 0}店を確認。新規${data.imported}店、登録済み${data.skippedExisting ?? 0}店をスキップしました。`);
      else if (data.fetched != null) setMessage(`Web調査: ${data.fetched}件取得、新規${data.inserted ?? 0}件、更新${data.updated ?? 0}件。`);
      else setMessage(data.message ?? "保存しました。");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "処理に失敗しました。"); }
    finally { setBusy(false); }
  };
  const setManualValue = (placeId: string, key: "soup" | "style", value: string) => setManual((current) => ({ ...current, [placeId]: { ...(current[placeId] ?? { soup: "", style: "" }), [key]: value } }));
  const saveManual = (shop: Draft) => {
    const values = manual[shop.place_id] ?? { soup: shop.soupCategory ?? "", style: shop.styleCategory ?? "" };
    request("/api/research/admin/manual-classification", { method: "POST", body: JSON.stringify({ placeId: shop.place_id, soupCategory: values.soup, styleCategory: values.style }) });
  };
  if (!authenticated) return <main className="mx-auto max-w-md px-5 py-20"><div className="panel rounded-2xl p-6"><p className="text-xs font-bold tracking-[.2em] text-gold">ADMIN</p><h1 className="mt-2 text-2xl font-black">管理画面</h1><form className="mt-6 space-y-3" onSubmit={(event) => { event.preventDefault(); request("/api/research/admin/session", { method: "POST", body: JSON.stringify({ password }) }); }}><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3" placeholder="管理者パスワード" required /><button disabled={busy} className="w-full rounded-xl bg-gold px-4 py-3 font-bold text-ink">ログイン</button></form>{message && <p className="mt-4 text-sm text-gold">{message}</p>}</div></main>;
  const activeMenu = menus.find((menu) => menu.key === active)!;
  return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold tracking-[.2em] text-gold">ADMIN · RAMEN DATABASE</p><h1 className="mt-2 text-3xl font-black">管理画面</h1><p className="mt-2 text-sm text-stone-400">{activeMenu.description}</p></div><button disabled={busy} onClick={() => request("/api/research/admin/session", { method: "DELETE" })} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-stone-400">ログアウト</button></div>
    <nav className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">{menus.map((menu) => <button key={menu.key} onClick={() => { setActive(menu.key); setMessage(""); }} className={`rounded-xl border px-4 py-3 text-left text-sm font-bold ${active === menu.key ? "border-gold bg-gold text-ink" : "border-white/10 bg-white/5 text-stone-300"}`}>{menu.label}</button>)}</nav>{message && <p className="mt-5 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">{message}</p>}
    {active === "research" && <section className="mt-8"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Card label="全対象店舗数" value={classificationMetrics.total} tone="text-gold" /><Card label="処理済み件数" value={classificationMetrics.processed} /><Card label="自動確定件数" value={classificationMetrics.autoApproved} tone="text-emerald-400" /><Card label="確認待ち件数" value={classificationMetrics.needsReview} tone="text-ramen" /><Card label="AI判定件数" value={classificationMetrics.ai} /><Card label="エラー件数" value={classificationMetrics.error} tone="text-ramen" /><div className="rounded-xl border border-white/10 bg-black/20 p-4 sm:col-span-2"><p className="text-xs text-stone-500">処理進捗率</p><p className="mt-1 text-2xl font-black text-gold">{classificationMetrics.progress.toFixed(1)}%</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gold" style={{ width: `${Math.min(100, classificationMetrics.progress)}%` }} /></div></div></div><div className="mt-5 flex gap-2"><button disabled={busy} onClick={() => request("/api/research/admin/classification-jobs", { method: "POST", body: JSON.stringify({ limit: 100 }) })} className="rounded-xl bg-gold px-4 py-3 text-sm font-bold text-ink">未分類店舗を自動分類</button><button onClick={() => document.getElementById("review-list")?.scrollIntoView({ behavior: "smooth" })} className="rounded-xl border border-gold px-4 py-3 text-sm font-bold text-gold">確認待ち店舗を表示</button></div><div id="review-list" className="mt-5 space-y-4">{drafts.length ? drafts.map((shop) => { const values = manual[shop.place_id] ?? { soup: shop.soupCategory ?? "", style: shop.styleCategory ?? "" }; return <article key={shop.place_id} className="panel rounded-2xl p-5"><h2 className="text-lg font-bold">{shop.name}</h2><p className="mt-1 text-sm text-stone-400">{shop.address}</p><div className="mt-3 flex flex-wrap gap-2 text-sm"><span className="rounded bg-white/5 px-2 py-1 text-gold">★ Google {shop.rating?.toFixed(1) ?? "–"}</span><span className="rounded bg-white/5 px-2 py-1">口コミ {shop.user_ratings_total?.toLocaleString() ?? "–"}件</span><span className="rounded bg-white/5 px-2 py-1">{shop.classificationMethod ?? "-"}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label>スープ分類<select value={values.soup} onChange={(event) => setManualValue(shop.place_id, "soup", event.target.value)} className="mt-1 block w-full rounded-lg border border-white/15 bg-black px-3 py-2"><option value="">選択してください</option>{SOUPS.map((value) => <option key={value}>{value}</option>)}</select></label><label>スタイル分類<select value={values.style} onChange={(event) => setManualValue(shop.place_id, "style", event.target.value)} className="mt-1 block w-full rounded-lg border border-white/15 bg-black px-3 py-2"><option value="">選択してください</option>{STYLES.map((value) => <option key={value}>{value}</option>)}</select></label></div><p className="mt-3 text-sm text-stone-400">確信度: soup {shop.soupConfidence?.toFixed(2) ?? "-"} / style {shop.styleConfidence?.toFixed(2) ?? "-"}</p><div className="mt-4 flex gap-2"><button disabled={busy || !values.soup || !values.style} onClick={() => saveManual(shop)} className="rounded-lg border border-gold px-3 py-2 text-sm font-bold text-gold">手動分類を保存</button><button disabled={busy} onClick={() => request("/api/research/soup/approve", { method: "POST", body: JSON.stringify({ placeIds: [shop.place_id] }) })} className="rounded-lg bg-emerald-400 px-3 py-2 text-sm font-bold text-ink">手動承認</button></div></article>; }) : <div className="panel rounded-2xl px-6 py-16 text-center text-stone-400">確認待ち店舗はありません。</div>}</div></section>}
    {active === "google" && <section className="panel mt-8 rounded-2xl p-6"><h2 className="text-2xl font-black">新規店舗を取得</h2><p className="mt-3 text-sm text-stone-400">対象地域は東京都固定です。</p><input value={query} onChange={(event) => setQuery(event.target.value)} className="mt-5 block w-full max-w-xl rounded-xl border border-white/10 bg-black/30 px-4 py-3" /><button disabled={busy} onClick={() => request("/api/research/admin/google-import", { method: "POST", body: JSON.stringify({ query }) })} className="mt-4 rounded-xl bg-gold px-4 py-3 font-bold text-ink">Google Mapsから検索・登録</button></section>}
    {active === "webposts" && <section className="panel mt-8 rounded-2xl p-6"><h2 className="text-2xl font-black">今週の東京ラーメン話題投稿</h2><button disabled={busy} onClick={() => request("/api/research/admin/web-ramen", { method: "POST" })} className="mt-5 rounded-xl bg-gold px-4 py-3 font-bold text-ink">Web調査を実行</button>{webFetchLog && <p className="mt-4 text-sm text-stone-400">前回: {webFetchLog.fetched_count}件取得 / 新規{webFetchLog.inserted_count}件 / 更新{webFetchLog.updated_count}件</p>}</section>}
    {active === "summary" && <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Card label="登録店舗" value={metrics.total} tone="text-gold" /><Card label="旧AI調査待ち" value={metrics.pending} /><Card label="旧レビュー待ち" value={metrics.draft} /><Card label="旧承認済み" value={metrics.approved} tone="text-emerald-400" /><Card label="却下" value={metrics.rejected} /><Card label="Google評価未登録" value={metrics.missingRating} /><Card label="公式サイト未登録" value={metrics.missingWebsite} /><Card label="写真未登録" value={metrics.missingPhoto} /></section>}
    {active === "maintenance" && <section className="panel mt-8 rounded-2xl p-6"><h2 className="text-2xl font-black">登録済みデータのメンテナンス</h2><p className="mt-3 text-sm text-stone-400">手動承認した分類を、将来のローカルモデル学習用CSVとして出力できます。</p><a href="/api/research/admin/classification-training.csv" className="mt-5 inline-block rounded-xl border border-gold px-4 py-3 font-bold text-gold">教師データCSVを出力</a></section>}
    {active === "hyakumeiten" && <section className="mt-8"><TabelogAwardsImport /></section>}
  </main>;
}
