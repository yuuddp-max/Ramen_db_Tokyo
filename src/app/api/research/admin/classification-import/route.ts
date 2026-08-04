import { NextRequest, NextResponse } from "next/server";
import { classificationSourceHash, SOUP_CATEGORIES, STYLE_CATEGORIES } from "@/lib/shop-classification";
import { isResearchAdminRequest } from "@/lib/research-admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 1_000;

type ShopRow = {
  id: string;
  place_id: string;
  name: string | null;
  address: string | null;
  genres: string[] | null;
  shop_description: string | null;
  representative_menu: string | null;
  review_summary: string | null;
};

function normalize(value: unknown) {
  return typeof value === "string" ? value.normalize("NFKC").replace(/\s+/g, " ").trim() : "";
}

function predictionText(shop: ShopRow) {
  return normalize(shop.name);
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((values) => values.some((value) => value.trim()));
}

function value(row: Record<string, string>, ...keys: string[]) {
  for (const key of keys) if (row[key] != null && normalize(row[key])) return normalize(row[key]);
  return "";
}

export async function POST(request: NextRequest) {
  if (!isResearchAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "CSVファイルを選択してください。" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "CSVファイルは5MB以内にしてください。" }, { status: 400 });

  const parsed = parseCsv((await file.text()).replace(/^\uFEFF/, ""));
  if (parsed.length < 2) return NextResponse.json({ error: "CSVにデータ行がありません。" }, { status: 400 });
  const header = parsed[0].map((item) => normalize(item).toLowerCase());
  const requiredHeaders = ["id", "classification_text", "source_hash", "soup_category", "style_category"];
  const missingHeaders = requiredHeaders.filter((required) => !header.includes(required));
  if (missingHeaders.length) {
    return NextResponse.json({ error: `CSVのヘッダーが不正です。必要な列: ${requiredHeaders.join(",")}` }, { status: 400 });
  }
  const rows = parsed.slice(1).slice(0, MAX_ROWS).map((cells) => Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ""])));

  const { data: shops, error: shopError } = await supabaseAdmin.from("ramen_shops").select("id,place_id,name,address,genres,shop_description,representative_menu,review_summary").eq("is_excluded", false).limit(20_000);
  if (shopError) return NextResponse.json({ error: shopError.message }, { status: 500 });
  const byId = new Map((shops ?? []).flatMap((shop) => [[shop.id, shop], [shop.place_id, shop]]));
  const byHash = new Map((shops ?? []).map((shop) => [classificationSourceHash(predictionText(shop as ShopRow)), shop]));
  let updated = 0;
  const skipped: string[] = [];
  const errors: string[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const id = value(row, "id");
    const text = value(row, "classification_text");
    const sourceHash = value(row, "source_hash");
    const soup = value(row, "soup_category");
    const style = value(row, "style_category");
    const shop = byId.get(id) ?? byHash.get(sourceHash);
    if (!shop || !id || !text || !sourceHash || !soup || !style) { skipped.push(`行${index + 2}: ID/テキスト/ハッシュ/分類が不足、または店舗を特定できません`); continue; }
    if (classificationSourceHash(text) !== sourceHash) { skipped.push(`行${index + 2}: source_hashがclassification_textと一致しません`); continue; }
    if (!SOUP_CATEGORIES.includes(soup as (typeof SOUP_CATEGORIES)[number]) || !STYLE_CATEGORIES.includes(style as (typeof STYLE_CATEGORIES)[number])) { skipped.push(`行${index + 2}: 分類値が不正`); continue; }
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("ramen_shops").update({
      soupCategory: soup, styleCategory: style, soupConfidence: 1, styleConfidence: 1,
      classificationMethod: "manual", classificationStatus: "manually-approved", classificationVersion: "csv-import-v1",
      classificationSourceHash: sourceHash, classifiedAt: now,
      researched_soup_type: soup, researched_style: style, research_confidence: "high", research_status: "approved", research_updated_at: now,
    }).eq("id", shop.id);
    if (error) { errors.push(`行${index + 2}: ${error.message}`); continue; }
    const { error: trainingError } = await supabaseAdmin.from("classification_training_examples").upsert({ shop_id: shop.id, classification_text: text, source_hash: sourceHash, soup_category: soup, style_category: style }, { onConflict: "shop_id,source_hash,soup_category,style_category" });
    if (trainingError) { errors.push(`行${index + 2}: 教師データ保存失敗`); continue; }
    updated += 1;
  }
  return NextResponse.json({ ok: true, updated, skipped: skipped.length, errors: errors.length, details: [...skipped, ...errors].slice(0, 20), truncated: parsed.length - 1 > MAX_ROWS });
}
