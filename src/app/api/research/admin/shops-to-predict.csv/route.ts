import { NextRequest, NextResponse } from "next/server";
import { isResearchAdminRequest } from "@/lib/research-admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;
const HEADER = "id,name,address,soup_category,style_category";
const SCOPES = ["unclassified", "include-review", "all", "updated"] as const;
type Scope = (typeof SCOPES)[number];

type ShopRow = {
  id: string;
  name: string | null;
  address: string | null;
  genres: string[] | null;
  shop_description: string | null;
  representative_menu: string | null;
  review_summary: string | null;
  soupCategory: string | null;
  styleCategory: string | null;
  classificationStatus: string | null;
  updated_at: string | null;
};

type TrainingRow = { shop_id: string | null; soup_category: string | null; style_category: string | null; created_at: string | null };
type PredictionRow = { id: string; name: string; address: string; soup_category: string; style_category: string; updated_at: string };

function normalizeText(value: unknown): string {
  if (Array.isArray(value)) return value.flatMap((item) => normalizeText(item)).join(" ");
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function csv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function isScope(value: string): value is Scope {
  return SCOPES.includes(value as Scope);
}

function isUnclassified(soupCategory: string, styleCategory: string) {
  return !soupCategory || !styleCategory;
}

async function fetchLatestTraining() {
  const { data, error } = await supabaseAdmin!
    .from("classification_training_examples")
    .select("shop_id,soup_category,style_category,created_at")
    .order("created_at", { ascending: false })
    .limit(20_000);
  if (error) throw new Error(error.message);
  const latest = new Map<string, TrainingRow>();
  for (const row of (data ?? []) as TrainingRow[]) {
    if (row.shop_id && !latest.has(row.shop_id)) latest.set(row.shop_id, row);
  }
  return latest;
}

function selectScope(_shop: ShopRow, scope: Scope, soupCategory: string, styleCategory: string) {
  if (scope === "all") return true;
  if (scope === "include-review") return isUnclassified(soupCategory, styleCategory);
  if (scope === "updated") return isUnclassified(soupCategory, styleCategory);
  return isUnclassified(soupCategory, styleCategory);
}

async function fetchAllShops() {
  const shops: ShopRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin!
      .from("ramen_shops")
      .select('id,name,address,genres,shop_description,representative_menu,review_summary,"soupCategory","styleCategory","classificationStatus",updated_at')
      .eq("is_excluded", false)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    shops.push(...((data ?? []) as ShopRow[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return shops;
}

async function collect(scope: Scope) {
  const shops = await fetchAllShops();
  const trainingByShop = await fetchLatestTraining();
  const rowsById = new Map<string, PredictionRow>();
  let missingText = 0;
  let unchanged = 0;
  let duplicate = 0;
  let candidates = 0;
  for (const shop of shops) {
    const training = trainingByShop.get(shop.id);
    const soup = normalizeText(training?.soup_category);
    const style = normalizeText(training?.style_category);
    if (!selectScope(shop, scope, soup, style)) {
      if (scope === "updated") unchanged += 1;
      continue;
    }
    candidates += 1;
    const name = normalizeText(shop.name);
    if (!name) {
      missingText += 1;
      continue;
    }
    const row = {
      id: shop.id,
      name,
      address: normalizeText(shop.address),
      soup_category: soup,
      style_category: style,
      updated_at: training?.created_at ?? shop.updated_at ?? "",
    };
    const existing = rowsById.get(shop.id);
    if (existing) {
      duplicate += 1;
      if (Date.parse(row.updated_at) >= Date.parse(existing.updated_at)) rowsById.set(shop.id, row);
    }
    else rowsById.set(shop.id, row);
  }
  return {
    rows: [...rowsById.values()].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)),
    stats: { fetched: shops.length, candidates, output: rowsById.size, unchanged, missingText, duplicate },
  };
}

export async function GET(request: NextRequest) {
  if (!isResearchAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });
  const scopeParam = request.nextUrl.searchParams.get("scope") ?? "unclassified";
  const scope = isScope(scopeParam) ? scopeParam : "unclassified";
  try {
    const result = await collect(scope);
    if (request.nextUrl.searchParams.get("mode") !== "download") return NextResponse.json({ scope, stats: result.stats });
    if (!result.rows.length) return NextResponse.json({ error: "出力対象の未分類店舗はありません" }, { status: 404 });
    const content = [HEADER, ...result.rows.map((row) => [row.id, row.name, row.address, row.soup_category, row.style_category].map(csv).join(","))].join("\r\n");
    return new NextResponse(`\uFEFF${content}\r\n`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="ramen_db_llst.csv"', "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" } });
  } catch (error) {
    console.error("shops_to_predict CSV export failed", error);
    return NextResponse.json({ error: "CSVの出力に失敗しました" }, { status: 500 });
  }
}
