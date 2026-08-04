import { NextRequest, NextResponse } from "next/server";
import { isResearchAdminRequest } from "@/lib/research-admin-auth";
import { classificationSourceHash } from "@/lib/shop-classification";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;
const HEADER = "id,classification_text,source_hash,soup_category,style_category";
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
  classificationSourceHash: string | null;
  updated_at: string | null;
};

type PredictionRow = { id: string; classification_text: string; source_hash: string; soup_category: string; style_category: string; updated_at: string };

function normalizeText(value: unknown): string {
  if (Array.isArray(value)) return value.flatMap((item) => normalizeText(item)).join(" ");
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function buildClassificationText(shop: ShopRow) {
  return normalizeText(shop.name);
}

function csv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function isScope(value: string): value is Scope {
  return SCOPES.includes(value as Scope);
}

function isUnclassified(shop: ShopRow) {
  const status = normalizeText(shop.classificationStatus).toLowerCase();
  return !normalizeText(shop.soupCategory) || !normalizeText(shop.styleCategory) || status === "pending" || status === "unclassified";
}

async function fetchAllShops() {
  const shops: ShopRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin!
      .from("ramen_shops")
      .select('id,name,address,genres,shop_description,representative_menu,review_summary,"soupCategory","styleCategory","classificationStatus","classificationSourceHash",updated_at')
      .eq("is_excluded", false)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    shops.push(...((data ?? []) as ShopRow[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return shops;
}

function selectScope(shop: ShopRow, scope: Scope, sourceHash: string) {
  if (scope === "all") return true;
  if (scope === "include-review") return isUnclassified(shop) || normalizeText(shop.classificationStatus).toLowerCase() === "needs-review";
  if (scope === "updated") return !normalizeText(shop.classificationSourceHash) || shop.classificationSourceHash !== sourceHash;
  return isUnclassified(shop);
}

async function collect(scope: Scope) {
  const shops = await fetchAllShops();
  const latestByHash = new Map<string, PredictionRow>();
  let missingText = 0;
  let unchanged = 0;
  let duplicate = 0;
  let candidates = 0;
  for (const shop of shops) {
    const text = buildClassificationText(shop);
    const sourceHash = text ? classificationSourceHash(text) : "";
    if (!selectScope(shop, scope, sourceHash)) {
      if (scope === "updated" && text && shop.classificationSourceHash === sourceHash) unchanged += 1;
      continue;
    }
    candidates += 1;
    if (!text) {
      missingText += 1;
      continue;
    }
    const row = {
      id: shop.id,
      classification_text: text,
      source_hash: sourceHash,
      soup_category: normalizeText(shop.soupCategory),
      style_category: normalizeText(shop.styleCategory),
      updated_at: shop.updated_at ?? "",
    };
    const existing = latestByHash.get(sourceHash);
    if (existing) {
      duplicate += 1;
      if (Date.parse(row.updated_at) >= Date.parse(existing.updated_at)) latestByHash.set(sourceHash, row);
    } else {
      latestByHash.set(sourceHash, row);
    }
  }
  return {
    rows: [...latestByHash.values()].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)),
    stats: { fetched: shops.length, candidates, output: latestByHash.size, unchanged, missingText, duplicate },
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
    const content = [HEADER, ...result.rows.map((row) => [row.id, row.classification_text, row.source_hash, row.soup_category, row.style_category].map(csv).join(","))].join("\r\n");
    return new NextResponse(`\uFEFF${content}\r\n`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="ramen_db_iist.csv"', "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" } });
  } catch (error) {
    console.error("shops_to_predict CSV export failed", error);
    return NextResponse.json({ error: "CSVの出力に失敗しました" }, { status: 500 });
  }
}
