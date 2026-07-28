"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TabelogAwardsImport } from "@/components/TabelogAwardsImport";

const SOUP_TYPES = ["醤油", "塩", "味噌", "豚骨", "豚骨醤油", "鶏白湯", "魚介", "煮干し", "貝出汁", "海老", "牛骨", "担々麺", "カレー", "その他", "複数"];
const STYLES = ["東京中華そば", "家系", "二郎系", "二郎インスパイア", "大勝軒系", "つけ麺", "油そば", "まぜそば", "淡麗系", "濃厚系", "背脂系", "昆布水つけ麺", "冷やしラーメン", "その他"];

type Draft = {
  place_id: string;
  name: string;
  address: string | null;
  rating: number | null;
  user_ratings_total: number | null;
  researched_soup_type: string | null;
  researched_style: string | null;
  research_confidence: string | null;
  research_evidence_url: string | null;
  research_evidence_summary: string | null;
  research_updated_at: string | null;
};

type Metrics = { total: number; pending: number; draft: number; approved: number; rejected: number; missingRating: number; missingWebsite: number; missingPhoto: number };
type WebFetchLog = { started_at: string; completed_at: string | null; status: string; fetched_count: number; inserted_count: number; updated_count: number; matched_count: number; excluded_count: number; error_count: number; api_status: number | null; error_summary: string | null } | null;
type ManualClassification = { soupType: string; style: string };
type MenuKey = "research" | "google" | "webposts" | "summary" | "maintenance" | "hyakumeiten";

const MENUS: { key: MenuKey; label: string; description: string }[] = [
  { key: "research", label: "AIスープ分類レビュー", description: "AIの分類結果を確認・手動補正して承認します。" },
  { key: "google", label: "Google Maps 新規データ取得", description: "Google Mapsで検索し、未登録の店舗だけを追加します。" },
  { key: "webposts", label: "今週の話題投稿", description: "Web調査で直近7日間の東京ラーメン関連情報を取得します。" },
  { key: "summary", label: "登録済みデータ 集計", description: "登録数・AI調査の進捗を集計します。" },
  { key: "maintenance", label: "登録済みデータ メンテナンス", description: "不足している登録情報を確認します。" },
  { key: "hyakumeiten", label: "百名店の一括取込", description: "利用権を確認した百名店CSVを一括で取り込みます。" },
];

function isUnconfirmed(value: string | null) {
  return !value || value === "未確認";
}

function MetricCard({ label, value, tone = "text-white" }: { label: string; value: number; tone?: string }) {
  return <div className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="text-xs text-stone-500">{label}</p><p className={`mt-1 text-2xl font-black ${tone}`}>{value.toLocaleString()}<span className="ml-1 text-sm font-normal text-stone-500">店</span></p></div>;
}

export function ResearchAdmin({ authenticated, drafts, metrics, webFetchLog }: { authenticated: boolean; drafts: Draft[]; metrics: Metrics; webFetchLog: WebFetchLog }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeMenu, setActiveMenu] = useState<MenuKey>("research");
  const [googleQuery, setGoogleQuery] = useState("ラーメン");
  const [manualClassifications, setManualClassifications] = useState<Record<string, ManualClassification>>({});

  const request = async (url: string, options: RequestInit = {}) => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options.headers ?? {}) } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "処理に失敗しました。");
      const failures = Array.isArray(data.results) ? data.results.filter((result: { status?: string }) => result.status === "failed") : [];
      const failureDetails = failures.map((result: { name?: string; error?: string }) => `${result.name ?? "店舗"}: ${result.error ?? "調査に失敗しました。"}`).join(" / ");
      const importMessage = data.imported != null ? `${data.found != null ? `Google Mapsで${data.found}店を確認。` : ""}${data.imported}店を新規登録しました。${data.skippedExisting ? ` 登録済みは${data.skippedExisting}店スキップしました。` : ""}` : null;
      const webMessage = data.fetched != null ? `Web調査で${data.fetched}件取得。新規${data.inserted ?? 0}件、更新${data.updated ?? 0}件、東京関連${data.matched ?? 0}件、除外${data.excluded ?? 0}件、エラー${data.errors ?? 0}件。` : null;
      setMessage(webMessage ?? importMessage ?? (data.researched != null ? `${data.researched}店を下書きとして作成しました。${failureDetails ? ` 失敗: ${failureDetails}` : ""}` : (data.message ?? "保存しました。承認前に内容を確認してください。")));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "処理に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  const updateManualClassification = (placeId: string, field: keyof ManualClassification, value: string) => {
    setManualClassifications((current) => {
      const existing = current[placeId] ?? { soupType: "", style: "" };
      return { ...current, [placeId]: field === "soupType" ? { ...existing, soupType: value } : { ...existing, style: value } };
    });
  };

  const saveManualClassification = (shop: Draft) => {
    const selection = manualClassifications[shop.place_id];
    const body: { placeId: string; soupType?: string; style?: string } = { placeId: shop.place_id };
    if (isUnconfirmed(shop.researched_soup_type) && selection?.soupType) body.soupType = selection.soupType;
    if (isUnconfirmed(shop.researched_style) && selection?.style) body.style = selection.style;
    request("/api/research/admin/manual-classification", { method: "POST", body: JSON.stringify(body) });
  };

  if (!authenticated) {
    return <main className="mx-auto max-w-md px-5 py-20"><div className="panel rounded-2xl p-6"><p className="text-xs font-bold tracking-[.2em] text-gold">ADMIN</p><h1 className="mt-2 text-2xl font-black">管理画面</h1><p className="mt-3 text-sm leading-6 text-stone-400">管理者パスワードでログインしてください。</p><form className="mt-6 space-y-3" onSubmit={(event) => { event.preventDefault(); request("/api/research/admin/session", { method: "POST", body: JSON.stringify({ password }) }); }}><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-gold" placeholder="管理者パスワード" required /><button disabled={busy} className="w-full rounded-xl bg-gold px-4 py-3 font-bold text-ink disabled:opacity-50">ログイン</button></form>{message && <p className="mt-4 text-sm text-gold">{message}</p>}</div></main>;
  }

  const active = MENUS.find((menu) => menu.key === activeMenu)!;
  return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold tracking-[.2em] text-gold">ADMIN · RAMEN DATABASE</p><h1 className="mt-2 text-3xl font-black">管理画面</h1><p className="mt-2 text-sm text-stone-400">{active.description}</p></div><button disabled={busy} onClick={() => request("/api/research/admin/session", { method: "DELETE" })} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-stone-400 disabled:opacity-50">ログアウト</button></div>

    <nav className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-6" aria-label="管理メニュー">{MENUS.map((menu) => <button key={menu.key} onClick={() => { setActiveMenu(menu.key); setMessage(""); }} className={`rounded-xl border px-4 py-3 text-left text-sm font-bold transition ${activeMenu === menu.key ? "border-gold bg-gold text-ink" : "border-white/10 bg-white/5 text-stone-300 hover:border-gold/60 hover:text-gold"}`}>{menu.label}</button>)}</nav>
    {message && <p className="mt-5 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">{message}</p>}

    {activeMenu === "research" && <section className="mt-8"><div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => request("/api/research/admin/run", { method: "POST" })} className="rounded-xl border border-gold px-4 py-2 text-sm font-bold text-gold disabled:opacity-50">AI調査を1店実行</button><button disabled={busy} onClick={() => request("/api/research/admin/run", { method: "POST", body: JSON.stringify({ limit: 10 }) })} className="rounded-xl bg-gold px-4 py-2 text-sm font-bold text-ink disabled:opacity-50">AI調査を10店実行</button></div><div className="mt-5 space-y-4">{drafts.length ? drafts.map((shop) => {
      const needsManualSelection = isUnconfirmed(shop.researched_soup_type) || isUnconfirmed(shop.researched_style);
      const selection = manualClassifications[shop.place_id];
      const canSaveManualSelection = (isUnconfirmed(shop.researched_soup_type) && Boolean(selection?.soupType)) || (isUnconfirmed(shop.researched_style) && Boolean(selection?.style));
      return <article key={shop.place_id} className="panel rounded-2xl p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row"><div className="min-w-0"><h2 className="text-lg font-bold">{shop.name}</h2><p className="mt-1 text-sm text-stone-400">{shop.address}</p><div className="mt-3 flex flex-wrap gap-2 text-sm"><span className="rounded bg-white/5 px-2 py-1 font-bold text-gold">★ Google {shop.rating?.toFixed(1) ?? "–"}</span><span className="rounded bg-white/5 px-2 py-1 text-stone-300">口コミ {shop.user_ratings_total?.toLocaleString() ?? "–"}件</span></div><div className="mt-4 flex flex-wrap gap-2 text-sm"><span className="rounded bg-gold/10 px-2 py-1 font-bold text-gold">{shop.researched_soup_type ?? "未確認"}</span><span className="rounded bg-ramen/10 px-2 py-1 font-bold text-ramen">{shop.researched_style ?? "未確認"}</span><span className="rounded bg-white/5 px-2 py-1 text-stone-400">信頼度 {shop.research_confidence ?? "-"}</span></div>{needsManualSelection && <div className="mt-4 rounded-xl border border-gold/30 bg-black/20 p-4"><p className="text-sm font-bold text-gold">未確認の項目を手動で分類</p><p className="mt-1 text-xs text-stone-400">保存後も下書きのままです。内容を確認してから承認してください。</p><div className="mt-3 flex flex-wrap gap-2">{isUnconfirmed(shop.researched_soup_type) && <label className="text-sm text-stone-300">スープ系統<select value={selection?.soupType ?? ""} onChange={(event) => updateManualClassification(shop.place_id, "soupType", event.target.value)} className="mt-1 block min-w-40 rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white"><option value="">選択してください</option>{SOUP_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>}{isUnconfirmed(shop.researched_style) && <label className="text-sm text-stone-300">スタイル<select value={selection?.style ?? ""} onChange={(event) => updateManualClassification(shop.place_id, "style", event.target.value)} className="mt-1 block min-w-40 rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white"><option value="">選択してください</option>{STYLES.map((style) => <option key={style} value={style}>{style}</option>)}</select></label>}</div><button disabled={busy || !canSaveManualSelection} onClick={() => saveManualClassification(shop)} className="mt-3 rounded-lg border border-gold px-3 py-2 text-sm font-bold text-gold disabled:opacity-50">手動分類を保存</button></div>}<p className="mt-4 max-w-2xl text-sm leading-6 text-stone-300">{shop.research_evidence_summary}</p>{shop.research_evidence_url && <a href={shop.research_evidence_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-bold text-gold underline underline-offset-4">根拠を確認 ↗</a>}</div><div className="flex shrink-0 items-start gap-2"><button disabled={busy} onClick={() => request("/api/research/soup/approve", { method: "POST", body: JSON.stringify({ placeIds: [shop.place_id] }) })} className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-ink disabled:opacity-50">承認</button><button disabled={busy} onClick={() => request("/api/research/admin/reject", { method: "POST", body: JSON.stringify({ placeId: shop.place_id }) })} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-stone-400 disabled:opacity-50">却下</button></div></div></article>;
    }) : <div className="panel rounded-2xl px-6 py-16 text-center text-stone-400">確認待ちの下書きはありません。</div>}</div></section>}

    {activeMenu === "google" && <section className="panel mt-8 rounded-2xl p-6"><p className="text-xs font-bold tracking-[.2em] text-gold">GOOGLE MAPS</p><h2 className="mt-2 text-2xl font-black">新規店舗を取得</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-stone-400">検索結果から、Google Place IDが未登録の店舗だけを追加します。検索語は「ラーメン」だけで利用でき、地域は東京都に固定しています。店名と駅名を組み合わせれば、特定の1店を確認できます。Google Places APIの利用料金が発生する場合があります。</p><div className="mt-4 inline-flex rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-bold text-gold">対象地域：東京都（固定）</div><label className="mt-5 block max-w-xl text-sm font-bold text-stone-300">検索語<input value={googleQuery} onChange={(event) => setGoogleQuery(event.target.value)} className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-gold" placeholder="例: ラーメン / ラーメン 徳丸家 東武練馬" /></label><button disabled={busy || googleQuery.trim().length < 2} onClick={() => request("/api/research/admin/google-import", { method: "POST", body: JSON.stringify({ query: googleQuery }) })} className="mt-4 rounded-xl bg-gold px-4 py-3 text-sm font-bold text-ink disabled:opacity-50">Google Mapsから検索・登録</button></section>}

    {activeMenu === "webposts" && <section className="panel mt-8 rounded-2xl p-6"><p className="text-xs font-bold tracking-[.2em] text-gold">WEB RESEARCH · WEEKLY</p><h2 className="mt-2 text-2xl font-black">今週の東京ラーメン話題投稿</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-stone-400">Web検索で直近7日間の東京ラーメン関連記事・店舗公式情報を最大20件調査し、店舗名・別名・地域名を照合します。本文の長い転載は行いません。</p><button disabled={busy} onClick={() => request("/api/research/admin/web-ramen", { method: "POST" })} className="mt-5 rounded-xl bg-gold px-4 py-3 text-sm font-bold text-ink disabled:opacity-50">Web調査を実行</button>{webFetchLog ? <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MetricCard label="取得件数" value={webFetchLog.fetched_count} tone="text-gold" /><MetricCard label="新規登録" value={webFetchLog.inserted_count} tone="text-emerald-400" /><MetricCard label="更新" value={webFetchLog.updated_count} /><MetricCard label="店舗と紐付け" value={webFetchLog.matched_count} tone="text-gold" /><MetricCard label="除外" value={webFetchLog.excluded_count} /><MetricCard label="エラー" value={webFetchLog.error_count} tone="text-ramen" /></div> : <p className="mt-5 text-sm text-stone-500">まだ実行履歴はありません。</p>}{webFetchLog && <p className="mt-4 text-xs text-stone-500">前回実行: {new Date(webFetchLog.started_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })} / 状態: {webFetchLog.status} / Web API: {webFetchLog.api_status ?? "-"}{webFetchLog.error_summary ? ` / ${webFetchLog.error_summary}` : ""}</p>}</section>}

    {activeMenu === "summary" && <section className="mt-8"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MetricCard label="登録店舗" value={metrics.total} tone="text-gold" /><MetricCard label="AI調査待ち" value={metrics.pending} /><MetricCard label="レビュー待ち" value={metrics.draft} tone="text-ramen" /><MetricCard label="承認済み" value={metrics.approved} tone="text-emerald-400" /><MetricCard label="却下" value={metrics.rejected} /><MetricCard label="Google評価未登録" value={metrics.missingRating} /><MetricCard label="公式サイト未登録" value={metrics.missingWebsite} /><MetricCard label="写真未登録" value={metrics.missingPhoto} /></div></section>}

    {activeMenu === "maintenance" && <section className="mt-8"><div className="panel rounded-2xl p-6"><p className="text-xs font-bold tracking-[.2em] text-gold">DATA HEALTH</p><h2 className="mt-2 text-2xl font-black">登録データのメンテナンス</h2><p className="mt-3 text-sm leading-6 text-stone-400">不足している情報を確認し、Google Mapsの新規取得やAIスープ分類レビューで補完します。</p><div className="mt-5 grid gap-3 sm:grid-cols-3"><MetricCard label="Google評価未登録" value={metrics.missingRating} /><MetricCard label="公式サイト未登録" value={metrics.missingWebsite} /><MetricCard label="写真未登録" value={metrics.missingPhoto} /></div></div></section>}

    {activeMenu === "hyakumeiten" && <section className="mt-8"><TabelogAwardsImport /></section>}
  </main>;
}
