"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CsvRecord = { award_year: string; listed_name: string; source_url: string; selection_date?: string };

function parseCsv(text: string): CsvRecord[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += character;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header, ...data] = rows.filter((values) => values.some((value) => value.trim()));
  if (!header) throw new Error("CSVにヘッダー行がありません。");
  const headers = header.map((value) => value.trim().replace(/^\uFEFF/, ""));
  for (const required of ["award_year", "listed_name", "source_url"]) if (!headers.includes(required)) throw new Error(`CSVに ${required} 列が必要です。`);
  return data.map((values) => Object.fromEntries(headers.map((name, index) => [name, values[index]?.trim() ?? ""])) as CsvRecord);
}

export function TabelogAwardsImport() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const importCsv = async (file: File) => {
    setBusy(true); setMessage("");
    try {
      const records = parseCsv(await file.text());
      const response = await fetch("/api/research/admin/tabelog-awards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ records }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "CSVの取込に失敗しました。");
      setMessage(`${data.imported}件を取込（自動一致 ${data.matched}件 / 要確認 ${data.ambiguous + data.unmatched}件）しました。`);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "CSVの取込に失敗しました。"); }
    finally { setBusy(false); }
  };

  return <section className="panel mt-8 rounded-2xl p-5"><p className="text-xs font-bold tracking-[.16em] text-gold">TABELLOG HYAKUMEITEN CSV</p><h2 className="mt-2 text-lg font-bold">百名店の一括取込</h2><p className="mt-1 text-sm leading-6 text-stone-400">利用権を確認したCSVを取り込みます。列は <code>award_year, listed_name, source_url, selection_date</code>（最終列は任意）です。</p><label className="mt-4 inline-flex cursor-pointer items-center rounded-xl border border-gold px-4 py-2 text-sm font-bold text-gold disabled:opacity-50"><input type="file" accept=".csv,text/csv" className="sr-only" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void importCsv(file); event.target.value = ""; }} />{busy ? "取込中…" : "CSVを選択して取込"}</label>{message && <p className="mt-3 text-sm text-gold">{message}</p>}</section>;
}
