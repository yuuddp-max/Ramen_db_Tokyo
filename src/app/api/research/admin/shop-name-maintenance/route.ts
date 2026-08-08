import { NextRequest, NextResponse } from "next/server";
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
    .select("id,place_id,name,address,genres,rating,user_ratings_total,updated_at", { count: "exact" })
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
  if (!placeId) return NextResponse.json({ error: "placeId is required." }, { status: 400 });
  if (!name) return NextResponse.json({ error: "店名を入力してください。" }, { status: 400 });
  if (name.length > 200) return NextResponse.json({ error: "店名は200文字以内で入力してください。" }, { status: 400 });
  const { data, error } = await supabaseAdmin.from("ramen_shops")
    .update({ name, classificationStatus: "pending", classificationSourceHash: null })
    .eq("place_id", placeId)
    .eq("is_excluded", false)
    .select("place_id,name")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, shop: data });
}
