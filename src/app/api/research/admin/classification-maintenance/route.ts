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
    .select('place_id,name,address,rating,user_ratings_total,"soupCategory","styleCategory","classificationMethod","classificationStatus","classifiedAt"', { count: "exact" })
    .eq("is_excluded", false)
    .order("name", { ascending: true })
    .range(offset, offset + limit - 1);
  if (query) builder = builder.ilike("name", `%${query.replace(/[%_]/g, "")}%`);
  const { data, count, error } = await builder;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shops: data ?? [], total: count ?? 0, offset, limit });
}
