"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type HourlyPoint = { hour: number; averageWait: number | null; reportCount: number };
type CongestionData = {
  prediction: { waitMinutes: number; crowd: string; confidence: number; reportCount: number; holiday: boolean; factors: string[]; hourly: HourlyPoint[] };
  weather: { temperature: number; precipitation: number; label: string; isWet: boolean } | null;
};

export function CongestionPanel({ shopId }: { shopId: string }) {
  const [data, setData] = useState<CongestionData | null>(null);
  const [waitMinutes, setWaitMinutes] = useState("10");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/congestion?shopId=${shopId}`);
      if (!response.ok) throw new Error();
      setData(await response.json() as CongestionData);
    } catch {
      setMessage("混雑予測を取得できませんでした。時間をおいて再度お試しください。");
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => { void load(); }, [load]);

  const maxWait = useMemo(() => Math.max(20, ...(data?.prediction.hourly.map((point) => point.averageWait ?? 0) ?? [])), [data]);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = Number(waitMinutes);
    if (!Number.isInteger(value) || value < 0 || value > 240) { setMessage("待ち時間は0〜240分の整数で入力してください。"); return; }
    setSubmitting(true); setMessage("");
    try {
      const response = await fetch("/api/wait-reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shopId, waitMinutes: value }) });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "投稿できませんでした。");
      setMessage("待ち時間を投稿しました。ご協力ありがとうございます。");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "投稿できませんでした。");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <section className="panel mt-5 rounded-2xl p-6 text-sm text-stone-400">混雑予測を計算中…</section>;
  if (!data) return <section className="panel mt-5 rounded-2xl p-6 text-sm text-stone-400">{message || "混雑予測を表示できません。"}</section>;

  const { prediction, weather } = data;
  return <section className="panel mt-5 rounded-2xl p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold tracking-[.18em] text-gold">PHASE 2 · CONGESTION FORECAST</p><h2 className="mt-2 text-xl font-bold">いまの混雑予測</h2><p className="mt-2 text-sm text-stone-400">同じ曜日・時間帯の投稿実績を中心に算出した目安です。</p></div><div className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-right"><p className="text-xs text-stone-400">推定待ち時間</p><p className="mt-1 text-2xl font-black text-gold">約 {prediction.waitMinutes} 分</p><p className="mt-1 text-xs text-stone-400">混雑度 {prediction.crowd} · 信頼度 {prediction.confidence}%</p></div></div>
    <div className="mt-5 flex flex-wrap gap-2 text-xs">{weather && <span className="rounded-full bg-white/5 px-3 py-1.5 text-stone-300">天気：{weather.label} {weather.temperature.toFixed(1)}℃{weather.isWet ? " · 降水あり" : ""}</span>}{prediction.holiday && <span className="rounded-full bg-ramen/15 px-3 py-1.5 text-ramen">祝日補正</span>}{prediction.factors.map((factor) => <span key={factor} className="rounded-full bg-white/5 px-3 py-1.5 text-stone-400">{factor}</span>)}</div>
    <div className="mt-7"><div className="flex items-end justify-between"><h3 className="font-bold">混雑実績グラフ</h3><span className="text-xs text-stone-500">同じ曜日の投稿平均 · {prediction.reportCount}件</span></div><div className="mt-4 flex h-36 items-end gap-1 border-b border-white/10 pb-1">{prediction.hourly.map((point) => <div key={point.hour} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1 text-center"><div className="group relative mx-auto w-full max-w-7 rounded-t bg-gold/70 transition hover:bg-gold" style={{ height: point.averageWait == null ? "3px" : `${Math.max(8, (point.averageWait / maxWait) * 100)}%` }} title={point.averageWait == null ? `${point.hour}時：投稿なし` : `${point.hour}時：平均 ${Math.round(point.averageWait)}分（${point.reportCount}件）`} /><span className="text-[10px] text-stone-500">{point.hour}</span></div>)}</div><p className="mt-2 text-xs text-stone-500">棒の高さは平均待ち時間（分）。投稿がない時間帯は細い線で表示します。</p></div>
    <form onSubmit={submit} className="mt-7 border-t border-white/10 pt-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="flex-1 text-sm font-bold">実際の待ち時間を投稿<span className="mt-1 block text-xs font-normal text-stone-500">個人情報は保存しません。0分は待ちなしです。</span><input aria-label="待ち時間（分）" value={waitMinutes} onChange={(event) => setWaitMinutes(event.target.value)} inputMode="numeric" type="number" min="0" max="240" step="1" className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-gold" /></label><button disabled={submitting} className="rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-ink transition hover:bg-white disabled:cursor-wait disabled:opacity-60">{submitting ? "投稿中…" : "待ち時間を投稿"}</button></div>{message && <p role="status" className="mt-3 text-sm text-stone-300">{message}</p>}</form>
  </section>;
}
