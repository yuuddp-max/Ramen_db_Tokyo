import { NextRequest, NextResponse } from "next/server";
import { isResearchAdminRequest } from "@/lib/research-admin-auth";
import { buildTrainingClassificationText, classificationSourceHash } from "@/lib/shop-classification";
import { supabaseAdmin } from "@/lib/supabase";

const HEADER = "classification_text,source_hash,soup_category,style_category,created_at";

function csv(value: string | null | undefined) {
  return `"${(value ?? "").replace(/"/g, '""')}"`;
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function isoDate(value: string | null | undefined) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

type TrainingRow = {
  classification_text: string;
  source_hash: string;
  soup_category: string;
  style_category: string;
  created_at: string;
};

export async function GET(request: NextRequest) {
  if (!isResearchAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });

  const [{ data, error }, { data: manualShops, error: manualError }] = await Promise.all([
    supabaseAdmin.from("classification_training_examples").select("shop_id,classification_text,source_hash,soup_category,style_category,created_at").order("created_at", { ascending: false }).limit(10_000),
    supabaseAdmin.from("ramen_shops").select('id,name,shop_description,representative_menu,review_summary,"soupCategory","styleCategory","classifiedAt"').eq("is_excluded", false).eq("classificationMethod", "manual").limit(10_000),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (manualError) return NextResponse.json({ error: manualError.message }, { status: 500 });

  const candidates: TrainingRow[] = [];
  for (const row of data ?? []) {
    const text = normalizeText(row.classification_text);
    if (!text || !row.soup_category?.trim() || !row.style_category?.trim()) continue;
    candidates.push({
      classification_text: text,
      source_hash: classificationSourceHash(text),
      soup_category: row.soup_category.trim(),
      style_category: row.style_category.trim(),
      created_at: isoDate(row.created_at),
    });
  }

  for (const shop of manualShops ?? []) {
    const text = buildTrainingClassificationText({ name: shop.name, description: shop.shop_description, representativeMenu: shop.representative_menu, reviewSummary: shop.review_summary });
    if (!text || !shop.soupCategory?.trim() || !shop.styleCategory?.trim()) continue;
    candidates.push({
      classification_text: text,
      source_hash: classificationSourceHash(text),
      soup_category: shop.soupCategory.trim(),
      style_category: shop.styleCategory.trim(),
      created_at: isoDate(shop.classifiedAt),
    });
  }

  const latestByHash = new Map<string, TrainingRow>();
  for (const row of candidates) {
    const existing = latestByHash.get(row.source_hash);
    if (!existing || Date.parse(row.created_at) >= Date.parse(existing.created_at)) latestByHash.set(row.source_hash, row);
  }
  const rows = [...latestByHash.values()]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .map((row) => [csv(row.classification_text), csv(row.source_hash), csv(row.soup_category), csv(row.style_category), csv(row.created_at)].join(","));

  return new NextResponse(`\uFEFF${[HEADER, ...rows].join("\n")}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="ramen-classification-training.csv"', "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" } });
}
