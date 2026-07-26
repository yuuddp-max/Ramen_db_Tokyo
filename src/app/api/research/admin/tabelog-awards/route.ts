import { NextRequest, NextResponse } from "next/server";
import { isResearchAdminRequest } from "@/lib/research-admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

type ImportRecord = { award_year?: unknown; listed_name?: unknown; source_url?: unknown; selection_date?: unknown };
type ShopName = { id: string; name: string };
type ValidatedRecord = { awardYear: number; listedName: string; selectionDate: string | null; sourceUrl: string };

function normalizeName(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ja-JP").replace(/[\s　・･'"`’‘\-‐‑–—―ー（）()［］\[\]【】]/g, "");
}

function toImportRecord(value: ImportRecord): ValidatedRecord {
  const awardYear = Number(value.award_year);
  const listedName = typeof value.listed_name === "string" ? value.listed_name.trim() : "";
  const selectionDate = typeof value.selection_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.selection_date) ? value.selection_date : null;
  if (!Number.isInteger(awardYear) || awardYear < 2000 || awardYear > 2100 || !listedName) throw new Error("CSVの award_year または listed_name が不正です。");
  if (typeof value.source_url !== "string") throw new Error("CSVの source_url が不正です。");
  let sourceUrl: URL;
  try { sourceUrl = new URL(value.source_url); } catch { throw new Error("CSVの source_url は有効なURLにしてください。"); }
  if (sourceUrl.protocol !== "https:" || sourceUrl.hostname !== "award.tabelog.com") throw new Error("source_url は award.tabelog.com のHTTPS URLにしてください。");
  return { awardYear, listedName, selectionDate, sourceUrl: sourceUrl.toString() };
}

async function getShopNameIndex() {
  const admin = supabaseAdmin!;
  const byName = new Map<string, ShopName[]>();
  for (let from = 0; ; from += 1_000) {
    const { data, error } = await admin.from("ramen_shops").select("id,name").range(from, from + 999);
    if (error) throw error;
    for (const shop of (data ?? []) as ShopName[]) {
      const key = normalizeName(shop.name);
      byName.set(key, [...(byName.get(key) ?? []), shop]);
    }
    if (!data || data.length < 1_000) return byName;
  }
}

export async function POST(request: NextRequest) {
  if (!isResearchAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });
  try {
    const body = await request.json().catch(() => ({}));
    if (!Array.isArray(body.records) || body.records.length < 1 || body.records.length > 1_000) return NextResponse.json({ error: "CSVは1〜1,000行で指定してください。" }, { status: 400 });
    const records = (body.records as ImportRecord[]).map(toImportRecord);
    const shopIndex = await getShopNameIndex();
    let matched = 0;
    let ambiguous = 0;
    const rows = records.map((record) => {
      const candidates = shopIndex.get(normalizeName(record.listedName)) ?? [];
      const matchStatus = candidates.length === 1 ? "matched" : candidates.length > 1 ? "ambiguous" : "unmatched";
      if (matchStatus === "matched") matched += 1;
      if (matchStatus === "ambiguous") ambiguous += 1;
      return {
        shop_id: candidates.length === 1 ? candidates[0].id : null,
        award_year: record.awardYear,
        award_name: "ラーメン TOKYO 百名店",
        area: "東京都",
        listed_name: record.listedName,
        selection_date: record.selectionDate,
        source_url: record.sourceUrl,
        match_status: matchStatus,
        imported_at: new Date().toISOString(),
      };
    });
    const { error } = await supabaseAdmin.from("tabelog_hyakumeiten_awards").upsert(rows, { onConflict: "award_name,award_year,area,listed_name" });
    if (error) throw error;
    return NextResponse.json({ imported: rows.length, matched, ambiguous, unmatched: rows.length - matched - ambiguous });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "百名店CSVの取込に失敗しました。" }, { status: 500 });
  }
}
