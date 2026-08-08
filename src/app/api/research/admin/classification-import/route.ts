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
  return typeof value === "string"
    ? value.replace(/^\uFEFF/, "").replace(/[\u200B-\u200D\u2060]/g, "").replace(/^'+|'+$/g, "").normalize("NFKC").replace(/\s+/g, " ").trim()
    : "";
}

function matchKey(value: unknown) {
  return normalize(value).toLocaleLowerCase("ja-JP").replace(/[\s　・･.,，、「」『』（）()［］\[\]【】「」]/g, "");
}

function normalizeSoupCategory(value: string) {
  const aliases: Record<string, string> = { "しょうゆ": "醤油", "しょう油": "醤油", "みそ": "味噌", "とんこつ": "豚骨", "にぼし": "煮干し" };
  return aliases[value] ?? value;
}

function normalizeStyleCategory(value: string) {
  const aliases: Record<string, string> = {
    "まぜそば": "油そば・まぜそば",
    "混ぜそば": "油そば・まぜそば",
    "油そば": "油そば・まぜそば",
    "家系ラーメン": "家系",
    "二郎": "二郎系",
  };
  return aliases[value] ?? value;
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

async function fetchAllMatchShops() {
  const shops: ShopRow[] = [];
  const pageSize = 1_000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin!
      .from("ramen_shops")
      .select("id,place_id,name,address,genres,shop_description,representative_menu,review_summary")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    shops.push(...((data ?? []) as ShopRow[]));
    if (!data || data.length < pageSize) break;
  }
  return shops;
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
  const requiredHeaders = ["id", "name", "soup_category", "style_category"];
  const hasNameColumn = header.includes("name") || header.includes("classification_text");
  const missingHeaders = ["id", "soup_category", "style_category"].filter((required) => !header.includes(required));
  if (!hasNameColumn || missingHeaders.length) {
    return NextResponse.json({ error: `CSVのヘッダーが不正です。必要な列: ${requiredHeaders.join(",")}` }, { status: 400 });
  }
  const rows = parsed.slice(1).slice(0, MAX_ROWS).map((cells) => Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ""])));

  let matchShops: ShopRow[];
  try {
    matchShops = await fetchAllMatchShops();
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "店舗データの取得に失敗しました" }, { status: 500 });
  }
  const normalizeId = (value: unknown) => normalize(value).toLowerCase();
  const byId = new Map(matchShops.flatMap((shop) => [[normalizeId(shop.id), shop], [normalizeId(shop.place_id), shop]]));
  const byNameAddress = new Map(matchShops
    .filter((shop) => shop.name && shop.address)
    .map((shop) => [`${matchKey(shop.name)}::${matchKey(shop.address)}`, shop]));
  const byName = new Map(matchShops.map((shop) => [matchKey(shop.name), shop]));
  const byHash = new Map(matchShops.map((shop) => [classificationSourceHash(predictionText(shop as ShopRow)), shop]));
  const findByPartialId = (id: string) => {
    if (!id) return undefined;
    const normalizedId = normalizeId(id);
    const matches = matchShops.filter((shop) => {
      const shopId = normalizeId(shop.id);
      const placeId = normalizeId(shop.place_id);
      return shopId === normalizedId || placeId === normalizedId || shopId.startsWith(normalizedId) || placeId.startsWith(normalizedId);
    });
    return matches.length === 1 ? matches[0] : undefined;
  };
  const findByLegacyText = (text: string) => {
    const normalizedText = normalize(text);
    const key = matchKey(normalizedText);
    return matchShops.find((shop) => {
      const name = normalize(shop.name);
      const nameKey = matchKey(name);
      return Boolean(name && (key === nameKey || key.startsWith(nameKey)));
    });
  };
  let updated = 0;
  const skipped: string[] = [];
  const errors: string[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const id = value(row, "id");
    const text = value(row, "name", "classification_text");
    const address = value(row, "address");
    const suppliedSourceHash = value(row, "source_hash");
    const soup = normalizeSoupCategory(value(row, "soup_category"));
    const style = normalizeStyleCategory(value(row, "style_category"));
    const nameAddressKey = text && address ? `${matchKey(text)}::${matchKey(address)}` : "";
    const shop = byId.get(normalizeId(id)) ?? findByPartialId(id) ?? (nameAddressKey ? byNameAddress.get(nameAddressKey) : undefined) ?? byName.get(matchKey(text)) ?? findByLegacyText(text) ?? byHash.get(suppliedSourceHash);
    const missing: string[] = [];
    if (!id) missing.push("id");
    if (!text) missing.push("name");
    if (missing.length) { skipped.push(`行${index + 2}: ${missing.join(", ")} が未入力です`); continue; }
    if (!shop) { skipped.push(`行${index + 2}: idまたは店舗名に一致する店舗がありません`); continue; }
    const canonicalText = normalize(shop.name);
    const sourceHash = classificationSourceHash(canonicalText);
    if (suppliedSourceHash && suppliedSourceHash !== sourceHash) { skipped.push(`行${index + 2}: source_hashがclassification_textと一致しません`); continue; }
    // 分類欄は空白を許可する。値が入力されている場合だけ選択肢を検証する。
    const invalidSoup = soup && !SOUP_CATEGORIES.includes(soup as (typeof SOUP_CATEGORIES)[number]);
    const invalidStyle = style && !STYLE_CATEGORIES.includes(style as (typeof STYLE_CATEGORIES)[number]);
    if (invalidSoup || invalidStyle) {
      const invalidValues = [invalidSoup ? `soup_category="${soup}"` : "", invalidStyle ? `style_category="${style}"` : ""].filter(Boolean).join(", ");
      skipped.push(`行${index + 2}: 分類値が不正 (${invalidValues})`);
      continue;
    }
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("ramen_shops").update({
      soupCategory: soup, styleCategory: style, soupConfidence: 1, styleConfidence: 1,
      classificationMethod: "manual", classificationStatus: "manually-approved", classificationVersion: "csv-import-v1",
      classificationSourceHash: sourceHash, classifiedAt: now,
    }).eq("id", shop.id);
    if (error) { errors.push(`行${index + 2}: ${error.message}`); continue; }
    const { error: trainingError } = await supabaseAdmin.from("classification_training_examples").upsert({ shop_id: shop.id, classification_text: canonicalText, source_hash: sourceHash, soup_category: soup, style_category: style }, { onConflict: "shop_id,source_hash,soup_category,style_category" });
    if (trainingError) { errors.push(`行${index + 2}: 教師データ保存失敗`); continue; }
    updated += 1;
  }
  return NextResponse.json({ ok: true, updated, skipped: skipped.length, errors: errors.length, details: [...skipped, ...errors].slice(0, 20), truncated: parsed.length - 1 > MAX_ROWS });
}
