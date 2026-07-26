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

type ManualClassification = { soupType: string; style: string };

function isUnconfirmed(value: string | null) {
  return !value || value === "未確認";
}

export function ResearchAdmin({ authenticated, drafts }: { authenticated: boolean; drafts: Draft[] }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [manualClassifications, setManualClassifications] = useState<Record<string, ManualClassification>>({});

  const request = async (url: string, options: RequestInit = {}) => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(url, {
        ...options,
        headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "処理に失敗しました。");
      const failures = Array.isArray(data.results) ? data.results.filter((result: { status?: string }) => result.status === "failed") : [];
      const failureDetails = failures.map((result: { name?: string; error?: string }) => `${result.name ?? "店舗"}: ${result.error ?? "調査に失敗しました。"}`).join(" / ");
      setMessage(data.researched != null ? `${data.researched}店を下書きとして作成しました。${failureDetails ? ` 失敗: ${failureDetails}` : ""}` : "保存しました。承認前に内容を確認してください。");
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
      return {
        ...current,
        [placeId]: field === "soupType" ? { ...existing, soupType: value } : { ...existing, style: value },
      };
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
    return <main className="mx-auto max-w-md px-5 py-20"><div className="panel rounded-2xl p-6"><p className="text-xs font-bold tracking-[.2em] text-gold">ADMIN</p><h1 className="mt-2 text-2xl font-black">AI調査レビュー</h1><p className="mt-3 text-sm leading-6 text-stone-400">管理者パスワードでログインしてください。</p><form className="mt-6 space-y-3" onSubmit={(event) => { event.preventDefault(); request("/api/research/admin/session", { method: "POST", body: JSON.stringify({ password }) }); }}><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-gold" placeholder="管理者パスワード" required /><button disabled={busy} className="w-full rounded-xl bg-gold px-4 py-3 font-bold text-ink disabled:opacity-50">ログイン</button></form>{message && <p className="mt-4 text-sm text-gold">{message}</p>}</div></main>;
  }

  return <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold tracking-[.2em] text-gold">ADMIN · HUMAN REVIEW</p><h1 className="mt-2 text-3xl font-black">AIスープ分類レビュー</h1><p className="mt-2 text-sm text-stone-400">評価点・口コミ数が高い店舗から、公式サイトを優先して低コストで調査します。</p></div>
      <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => request("/api/research/admin/run", { method: "POST" })} className="rounded-xl border border-gold px-4 py-2 text-sm font-bold text-gold disabled:opacity-50">AI調査を1店実行</button><button disabled={busy} onClick={() => request("/api/research/admin/run", { method: "POST", body: JSON.stringify({ limit: 10 }) })} className="rounded-xl bg-gold px-4 py-2 text-sm font-bold text-ink disabled:opacity-50">AI調査を10店実行</button><button disabled={busy} onClick={() => request("/api/research/admin/session", { method: "DELETE" })} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-stone-400">ログアウト</button></div>
    </div>
    <TabelogAwardsImport />
    {message && <p className="mt-5 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">{message}</p>}
    <section className="mt-8 space-y-4">
      {drafts.length ? drafts.map((shop) => {
        const needsManualSelection = isUnconfirmed(shop.researched_soup_type) || isUnconfirmed(shop.researched_style);
        const selection = manualClassifications[shop.place_id];
        const canSaveManualSelection = (isUnconfirmed(shop.researched_soup_type) && Boolean(selection?.soupType)) || (isUnconfirmed(shop.researched_style) && Boolean(selection?.style));
        return <article key={shop.place_id} className="panel rounded-2xl p-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row">
            <div className="min-w-0"><h2 className="text-lg font-bold">{shop.name}</h2><p className="mt-1 text-sm text-stone-400">{shop.address}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm"><span className="rounded bg-white/5 px-2 py-1 font-bold text-gold">★ Google {shop.rating?.toFixed(1) ?? "–"}</span><span className="rounded bg-white/5 px-2 py-1 text-stone-300">口コミ {shop.user_ratings_total?.toLocaleString() ?? "–"}件</span></div>
              <div className="mt-4 flex flex-wrap gap-2 text-sm"><span className="rounded bg-gold/10 px-2 py-1 font-bold text-gold">{shop.researched_soup_type ?? "未確認"}</span><span className="rounded bg-ramen/10 px-2 py-1 font-bold text-ramen">{shop.researched_style ?? "未確認"}</span><span className="rounded bg-white/5 px-2 py-1 text-stone-400">信頼度 {shop.research_confidence ?? "-"}</span></div>
              {needsManualSelection && <div className="mt-4 rounded-xl border border-gold/30 bg-black/20 p-4"><p className="text-sm font-bold text-gold">未確認の項目を手動で分類</p><p className="mt-1 text-xs text-stone-400">保存後も下書きのままです。内容を確認してから承認してください。</p><div className="mt-3 flex flex-wrap gap-2">{isUnconfirmed(shop.researched_soup_type) && <label className="text-sm text-stone-300">スープ系統<select value={selection?.soupType ?? ""} onChange={(event) => updateManualClassification(shop.place_id, "soupType", event.target.value)} className="mt-1 block min-w-40 rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white"><option value="">選択してください</option>{SOUP_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>}{isUnconfirmed(shop.researched_style) && <label className="text-sm text-stone-300">スタイル<select value={selection?.style ?? ""} onChange={(event) => updateManualClassification(shop.place_id, "style", event.target.value)} className="mt-1 block min-w-40 rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white"><option value="">選択してください</option>{STYLES.map((style) => <option key={style} value={style}>{style}</option>)}</select></label>}</div><button disabled={busy || !canSaveManualSelection} onClick={() => saveManualClassification(shop)} className="mt-3 rounded-lg border border-gold px-3 py-2 text-sm font-bold text-gold disabled:opacity-50">手動分類を保存</button></div>}
              <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-300">{shop.research_evidence_summary}</p>{shop.research_evidence_url && <a href={shop.research_evidence_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-bold text-gold underline underline-offset-4">根拠を確認 ↗</a>}
            </div>
            <div className="flex shrink-0 items-start gap-2"><button disabled={busy} onClick={() => request("/api/research/soup/approve", { method: "POST", body: JSON.stringify({ placeIds: [shop.place_id] }) })} className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-ink disabled:opacity-50">承認</button><button disabled={busy} onClick={() => request("/api/research/admin/reject", { method: "POST", body: JSON.stringify({ placeId: shop.place_id }) })} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-stone-400 disabled:opacity-50">却下</button></div>
          </div>
        </article>;
      }) : <div className="panel rounded-2xl px-6 py-16 text-center text-stone-400">確認待ちの下書きはありません。</div>}
    </section>
  </main>;
}
