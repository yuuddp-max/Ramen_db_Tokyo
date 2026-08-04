import { NextRequest, NextResponse } from "next/server";
import { buildClassificationText, buildTrainingClassificationText, classificationSourceHash, SOUP_CATEGORIES, STYLE_CATEGORIES } from "@/lib/shop-classification";
import { isResearchAdminRequest } from "@/lib/research-admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  if (!isResearchAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  const placeId = typeof body.placeId === "string" ? body.placeId : "";
  const soupCategory = typeof body.soupCategory === "string" ? body.soupCategory : typeof body.soupType === "string" ? body.soupType : undefined;
  const styleCategory = typeof body.styleCategory === "string" ? body.styleCategory : typeof body.style === "string" ? body.style : undefined;
  const finalize = body.finalize === true;
  if (!placeId) return NextResponse.json({ error: "placeId is required." }, { status: 400 });
  if (!soupCategory && !styleCategory) return NextResponse.json({ error: "スープ分類またはスタイル分類を選択してください。" }, { status: 400 });
  if (soupCategory && !SOUP_CATEGORIES.includes(soupCategory as (typeof SOUP_CATEGORIES)[number])) return NextResponse.json({ error: "Invalid soup category." }, { status: 400 });
  if (styleCategory && !STYLE_CATEGORIES.includes(styleCategory as (typeof STYLE_CATEGORIES)[number])) return NextResponse.json({ error: "Invalid style category." }, { status: 400 });

  const { data: shop, error: selectError } = await supabaseAdmin.from("ramen_shops").select('id,name,website,shop_description,representative_menu,review_summary,"soupCategory","styleCategory"').eq("place_id", placeId).single();
  if (selectError || !shop) return NextResponse.json({ error: selectError?.message ?? "Shop not found." }, { status: 404 });
  const soup = soupCategory ?? shop.soupCategory;
  const style = styleCategory ?? shop.styleCategory;
  if (!SOUP_CATEGORIES.includes(soup as (typeof SOUP_CATEGORIES)[number]) || !STYLE_CATEGORIES.includes(style as (typeof STYLE_CATEGORIES)[number])) return NextResponse.json({ error: "スープ分類とスタイル分類の両方を指定してください。" }, { status: 400 });
  const text = buildClassificationText({ name: shop.name, description: shop.shop_description, representativeMenu: shop.representative_menu, reviewSummary: shop.review_summary, website: shop.website });
  const sourceHash = classificationSourceHash(text);
  const trainingText = buildTrainingClassificationText({ name: shop.name, description: shop.shop_description, representativeMenu: shop.representative_menu, reviewSummary: shop.review_summary });
  const trainingHash = classificationSourceHash(trainingText);
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("ramen_shops").update({
    soupCategory: soup, styleCategory: style, soupConfidence: 1, styleConfidence: 1,
    classificationMethod: "manual", classificationStatus: finalize ? "manually-approved" : "needs-review", classificationVersion: "manual-v1", classificationSourceHash: sourceHash, classifiedAt: now,
    researched_soup_type: soup, researched_style: style, research_confidence: "high", research_status: finalize ? "approved" : "draft", research_updated_at: now,
  }).eq("id", shop.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { error: trainingError } = await supabaseAdmin.from("classification_training_examples").upsert({
    shop_id: shop.id,
    classification_text: trainingText,
    source_hash: trainingHash,
    soup_category: soup,
    style_category: style,
  }, { onConflict: "shop_id,source_hash,soup_category,style_category" });
  if (trainingError) return NextResponse.json({ error: trainingError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
