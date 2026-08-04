import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isResearchAdminRequest, isResearchSecretRequest } from "@/lib/research-admin-auth";
import { buildClassificationText, buildTrainingClassificationText, classificationSourceHash } from "@/lib/shop-classification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isResearchSecretRequest(request) && !isResearchAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  const placeIds = Array.isArray(body.placeIds) ? body.placeIds.filter((value: unknown): value is string => typeof value === "string").slice(0, 20) : [];
  if (!placeIds.length) return NextResponse.json({ error: "placeIds must contain at least one Place ID." }, { status: 400 });
  const { data: shops, error: shopError } = await supabaseAdmin.from("ramen_shops")
    .select('id,place_id,name,website,shop_description,representative_menu,review_summary,"soupCategory","styleCategory"')
    .in("place_id", placeIds).eq("research_status", "draft");
  if (shopError) return NextResponse.json({ error: shopError.message }, { status: 500 });
  const now = new Date().toISOString();
  for (const shop of shops ?? []) {
    const sourceHash = classificationSourceHash(buildClassificationText({ name: shop.name, description: shop.shop_description, representativeMenu: shop.representative_menu, reviewSummary: shop.review_summary, website: shop.website }));
    const { error } = await supabaseAdmin.from("ramen_shops").update({ research_status: "approved", research_updated_at: now, classificationStatus: "manually-approved", classificationMethod: "manual", classifiedAt: now, classificationSourceHash: sourceHash }).eq("id", shop.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (shop.soupCategory && shop.styleCategory) {
      const trainingText = buildTrainingClassificationText({ name: shop.name, description: shop.shop_description, representativeMenu: shop.representative_menu, reviewSummary: shop.review_summary });
      await supabaseAdmin.from("classification_training_examples").upsert({ shop_id: shop.id, classification_text: trainingText, source_hash: classificationSourceHash(trainingText), soup_category: shop.soupCategory, style_category: shop.styleCategory }, { onConflict: "shop_id,source_hash,soup_category,style_category" });
    }
  }
  const data = (shops ?? []).map((shop) => ({ place_id: shop.place_id, name: shop.name }));
  return NextResponse.json({ approved: data?.length ?? 0, shops: data ?? [] });
}
