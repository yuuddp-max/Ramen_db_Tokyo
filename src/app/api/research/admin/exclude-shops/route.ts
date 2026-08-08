import { NextRequest, NextResponse } from "next/server";
import { isResearchAdminRequest } from "@/lib/research-admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isResearchAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  const placeIds = Array.isArray(body.placeIds)
    ? [...new Set(body.placeIds.filter((value: unknown): value is string => typeof value === "string").map((value: string) => value.trim()).filter(Boolean))]
    : [];
  if (!placeIds.length || placeIds.length > 100) return NextResponse.json({ error: "削除対象を1〜100件選択してください。" }, { status: 400 });

  const { data, error } = await supabaseAdmin.from("ramen_shops").update({
    is_excluded: true,
    excluded_at: new Date().toISOString(),
    exclusion_reason: "not-ramen",
    classificationStatus: "error",
  }).in("place_id", placeIds).eq("is_excluded", false).select("place_id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ excluded: data?.length ?? 0, message: `${data?.length ?? 0}店舗を除外しました。` });
}
