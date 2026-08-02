import { NextRequest, NextResponse } from "next/server";
import { isResearchAdminRequest } from "@/lib/research-admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isResearchAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });
  const params = request.nextUrl.searchParams;
  const status = params.get("status") ?? "needs-review";
  const limit = Math.min(Math.max(Number(params.get("limit")) || 50, 1), 100);
  const { data, error } = await supabaseAdmin.from("ramen_shops")
    .select('id,place_id,name,address,shop_description,representative_menu,review_summary,feature_text,feature_keywords,feature_source_urls,feature_status,feature_method,feature_confidence,feature_updated_at,feature_error,"soupCategory","styleCategory"')
    .eq("is_excluded", false)
    .eq("feature_status", status)
    .order("feature_updated_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shops: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  if (!isResearchAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  const placeId = typeof body.placeId === "string" ? body.placeId.trim() : "";
  const action = typeof body.action === "string" ? body.action : "";
  if (!placeId || !["approve", "no-information", "retry", "save"].includes(action)) return NextResponse.json({ error: "placeIdと有効なactionが必要です。" }, { status: 400 });
  const update: Record<string, unknown> = { feature_updated_at: new Date().toISOString(), feature_error: null };
  if (action === "approve") Object.assign(update, { feature_status: "completed", feature_method: "manual", feature_confidence: 1 });
  if (action === "no-information") Object.assign(update, { feature_status: "no-information", feature_method: "manual" });
  if (action === "retry") Object.assign(update, { feature_status: "pending" });
  if (action === "save") {
    const featureText = typeof body.featureText === "string" ? body.featureText.replace(/\s+/g, " ").trim() : "";
    if (!featureText) return NextResponse.json({ error: "feature_textを入力してください。" }, { status: 400 });
    Object.assign(update, { feature_text: featureText, feature_keywords: body.featureKeywords ?? {}, feature_status: "completed", feature_method: "manual", feature_confidence: 1 });
  }
  const { data, error } = await supabaseAdmin.from("ramen_shops").update(update).eq("place_id", placeId).eq("is_excluded", false).select("place_id,feature_status,feature_text").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, shop: data });
}
