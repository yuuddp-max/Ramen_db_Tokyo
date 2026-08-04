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
  let builder = supabaseAdmin.from("ramen_shops")
    .select("id,place_id,name,address,rating,user_ratings_total,updated_at", { count: "exact" })
    .eq("is_excluded", false)
    .order("name", { ascending: true })
    .range(offset, offset + limit - 1);
  if (query) builder = builder.ilike("name", `%${query.replace(/[%_]/g, "")}%`);
  const { data, count, error } = await builder;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shops: data ?? [], total: count ?? 0, offset, limit });
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
