import { NextRequest, NextResponse } from "next/server";
import { isResearchAdminRequest } from "@/lib/research-admin-auth";
import { buildClassificationText, classificationSourceHash } from "@/lib/shop-classification";
import { supabaseAdmin } from "@/lib/supabase";

function csv(value: string | null | undefined) {
  return `"${(value ?? "").replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  if (!isResearchAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });
  const [{ data, error }, { data: manualShops, error: manualError }] = await Promise.all([
    supabaseAdmin.from("classification_training_examples").select("classification_text,source_hash,soup_category,style_category,created_at").order("created_at", { ascending: false }).limit(10_000),
    supabaseAdmin.from("ramen_shops").select('id,name,website,shop_description,representative_menu,review_summary,"soupCategory","styleCategory","classifiedAt"').eq("is_excluded", false).eq("classificationMethod", "manual").not("soupCategory", "is", null).not("styleCategory", "is", null).limit(10_000),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (manualError) return NextResponse.json({ error: manualError.message }, { status: 500 });
  const examples = new Map((data ?? []).map((row) => [`${row.source_hash}:${row.soup_category}:${row.style_category}`, row]));
  for (const shop of manualShops ?? []) {
    const classificationText = buildClassificationText({ name: shop.name, description: shop.shop_description, representativeMenu: shop.representative_menu, reviewSummary: shop.review_summary, website: shop.website });
    const sourceHash = classificationSourceHash(classificationText);
    const row = { classification_text: classificationText, source_hash: sourceHash, soup_category: shop.soupCategory, style_category: shop.styleCategory, created_at: shop.classifiedAt ?? new Date().toISOString() };
    examples.set(`${sourceHash}:${row.soup_category}:${row.style_category}`, row);
  }
  const rows = ["classification_text,source_hash,soup_category,style_category,created_at", ...[...examples.values()].map((row) => [csv(row.classification_text), csv(row.source_hash), csv(row.soup_category), csv(row.style_category), csv(row.created_at)].join(","))];
  return new NextResponse(`\uFEFF${rows.join("\n")}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="ramen-classification-training.csv"' } });
}
