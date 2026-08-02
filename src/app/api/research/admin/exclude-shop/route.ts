import { NextRequest, NextResponse } from "next/server";
import { isResearchAdminRequest } from "@/lib/research-admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isResearchAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  const placeId = typeof body.placeId === "string" ? body.placeId.trim() : "";
  if (!placeId || placeId.length > 300) return NextResponse.json({ error: "店舗IDが不正です。" }, { status: 400 });

  const { error } = await supabaseAdmin.from("ramen_shops").update({
    is_excluded: true,
    excluded_at: new Date().toISOString(),
    exclusion_reason: "not-ramen",
    classificationStatus: "error",
  }).eq("place_id", placeId).eq("is_excluded", false);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: "ラーメン店ではない店舗として除外しました。必要ならデータベースから復元できます。" });
}
