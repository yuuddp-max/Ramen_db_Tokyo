import { NextRequest, NextResponse } from "next/server";
import { classificationSourceHash, SOUP_CATEGORIES, STYLE_CATEGORIES } from "@/lib/shop-classification";
import { isResearchAdminRequest } from "@/lib/research-admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isResearchAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });
  const params = request.nextUrl.searchParams;
  const query = params.get("q")?.trim() ?? "";
  const limit = Math.min(Math.max(Number(params.get("limit")) || 100, 1), 200);
  const offset = Math.max(Number(params.get("offset")) || 0, 0);
  const nonRamenOnly = params.get("nonRamen") === "1";
  const includeExcluded = params.get("includeExcluded") === "1";
  let builder = supabaseAdmin.from("ramen_shops")
    .select("id,place_id,name,address,genres,rating,user_ratings_total,soupCategory,styleCategory,updated_at", { count: "exact" })
    .order("name", { ascending: true });
  if (!includeExcluded) builder = builder.eq("is_excluded", false);
  if (nonRamenOnly) builder = builder.limit(20_000);
  else builder = builder.range(offset, offset + limit - 1);
  if (query) builder = builder.ilike("name", `%${query.replace(/[%_]/g, "")}%`);
  const { data, count, error } = await builder;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ramenTerms = ["ラーメン", "らーめん", "つけ麺", "中華そば", "油そば", "まぜそば", "担々麺", "家系", "二郎"];
  const nonRamenTerms = ["美容", "サロン", "マッサージ", "焼肉", "居酒屋", "寿司", "鮨", "カフェ", "パン", "ケーキ", "餃子", "うどん", "そば", "自販機", "駐車場", "ホテル", "バー", "スナック", "コンビニ", "薬局", "病院", "ステーキ"];
  const filteredShops = nonRamenOnly ? (data ?? []).filter((shop) => {
    const text = [shop.name, shop.address, ...((shop.genres ?? []) as string[])].filter(Boolean).join(" ");
    return nonRamenTerms.some((term) => text.includes(term)) && !ramenTerms.some((term) => text.includes(term));
  }) : (data ?? []);
  const shops = nonRamenOnly ? filteredShops.slice(offset, offset + limit) : filteredShops;
  return NextResponse.json({ shops, total: nonRamenOnly ? filteredShops.length : count ?? 0, offset, limit, nonRamenOnly, includeExcluded });
}

export async function PATCH(request: NextRequest) {
  if (!isResearchAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  const placeId = typeof body.placeId === "string" ? body.placeId.trim() : "";
  const name = typeof body.name === "string" ? body.name.replace(/\s+/g, " ").trim() : "";
  const soupCategory = typeof body.soupCategory === "string" ? body.soupCategory.trim() : "";
  const styleCategory = typeof body.styleCategory === "string" ? body.styleCategory.trim() : "";
  if (!placeId) return NextResponse.json({ error: "placeId is required." }, { status: 400 });
  if (!name) return NextResponse.json({ error: "店名を入力してください。" }, { status: 400 });
  if (name.length > 200) return NextResponse.json({ error: "店名は200文字以内で入力してください。" }, { status: 400 });
  if (soupCategory && !SOUP_CATEGORIES.includes(soupCategory as (typeof SOUP_CATEGORIES)[number])) return NextResponse.json({ error: "スープ系統の値が不正です。" }, { status: 400 });
  if (styleCategory && !STYLE_CATEGORIES.includes(styleCategory as (typeof STYLE_CATEGORIES)[number])) return NextResponse.json({ error: "スタイルの値が不正です。" }, { status: 400 });
  const now = new Date().toISOString();
  const classificationText = name;
  const sourceHash = classificationSourceHash(classificationText);
  const hasClassification = Boolean(soupCategory || styleCategory);
  const { data, error } = await supabaseAdmin.from("ramen_shops")
    .update({
      name,
      soupCategory: soupCategory || null,
      styleCategory: styleCategory || null,
      soupConfidence: soupCategory ? 1 : null,
      styleConfidence: styleCategory ? 1 : null,
      classificationMethod: hasClassification ? "manual" : null,
      classificationStatus: hasClassification ? "manually-approved" : "pending",
      classificationVersion: "maintenance-v1",
      classificationSourceHash: sourceHash,
      classifiedAt: hasClassification ? now : null,
      researched_soup_type: soupCategory || null,
      researched_style: styleCategory || null,
      research_confidence: hasClassification ? "high" : null,
      research_status: hasClassification ? "approved" : "pending",
      research_updated_at: hasClassification ? now : null,
    })
    .eq("place_id", placeId)
    .eq("is_excluded", false)
    .select("id,place_id,name")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { error: trainingError } = await supabaseAdmin.from("classification_training_examples").upsert({
    shop_id: data.id,
    classification_text: classificationText,
    source_hash: sourceHash,
    soup_category: soupCategory || null,
    style_category: styleCategory || null,
  }, { onConflict: "shop_id,source_hash,soup_category,style_category" });
  if (trainingError) return NextResponse.json({ error: `分類データの保存に失敗しました: ${trainingError.message}` }, { status: 500 });
  return NextResponse.json({ ok: true, shop: data });
}
