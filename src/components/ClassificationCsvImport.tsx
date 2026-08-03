"use client";

import { useState } from "react";

export function ClassificationCsvImport() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const importCsv = async () => {
    if (!file || busy) return;
    setBusy(true);
    setMessage("CSVを確認して分類結果を登録しています…");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/research/admin/classification-import", { method: "POST", body: form });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "CSVの取込に失敗しました。");
      setMessage(`${result.updated ?? 0}件を登録しました。スキップ${result.skipped ?? 0}件、エラー${result.errors ?? 0}件。`);
      if ((result.details ?? []).length) setMessage((current) => `${current}\n${result.details.join("\n")}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "CSVの取込に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel mt-8 rounded-2xl p-6 sm:p-8">
      <p className="text-xs font-bold tracking-[.2em] text-gold">LOCAL CLASSIFICATION IMPORT</p>
      <h2 className="mt-2 text-2xl font-black">分類結果CSVをインポート</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-700">「ローカル分類用CSV」をPC上の分類モデルで修正した後、CSVを選択して登録します。登録された分類は手動承認済みになり、次回の教師データ出力に反映されます。</p>
      <div className="mt-5 rounded-xl border border-gold/40 bg-amber-50 p-4 text-sm text-stone-800">
        <p className="font-bold text-stone-900">CSVに必要な列</p>
        <code className="mt-2 block overflow-x-auto text-xs">classification_text,source_hash,soup_category,style_category</code>
        <p className="mt-2">または、特徴付き形式の <code>id,text,soup_category,style_category</code> も取り込めます。</p>
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="block w-full rounded-xl border border-stone-400 bg-white px-3 py-3 text-sm text-stone-900 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:font-bold" />
        <button disabled={!file || busy} onClick={() => void importCsv()} className="shrink-0 rounded-xl bg-gold px-5 py-3 font-bold text-ink disabled:cursor-not-allowed disabled:opacity-50">{busy ? "取込中…" : "分類結果を登録"}</button>
      </div>
      {message && <p role="status" className="mt-4 whitespace-pre-line rounded-xl border border-gold/50 bg-amber-50 px-4 py-3 text-sm font-medium text-stone-900">{message}</p>}
    </section>
  );
}
