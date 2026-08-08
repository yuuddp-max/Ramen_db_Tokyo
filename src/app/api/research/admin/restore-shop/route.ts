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
    is_excluded: false,
    excluded_at: null,
    exclusion_reason: null,
    classificationStatus: "pending",
  }).eq("place_id", placeId).eq("is_excluded", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: "店舗を通常の登録状態に戻しました。" });
}
