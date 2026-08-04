import { NextRequest, NextResponse } from "next/server";
import { searchTokyoRamen } from "@/lib/google-places";
import { isResearchAdminRequest } from "@/lib/research-admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!isResearchAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });

  const body = await request.json().catch(() => ({}));
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (query.length < 2 || query.length > 100) return NextResponse.json({ error: "検索語は2〜100文字で入力してください。" }, { status: 400 });

  try {
    const shops = await searchTokyoRamen(query);
    if (!shops.length) return NextResponse.json({ imported: 0, skippedExisting: 0, message: "Google Mapsから店舗が見つかりませんでした。" });

    const placeIds = shops.map((shop) => shop.place_id);
    const { data: existing, error: selectError } = await supabaseAdmin.from("ramen_shops").select("place_id").in("place_id", placeIds);
    if (selectError) throw selectError;
    const existingPlaceIds = new Set((existing ?? []).map((shop) => shop.place_id));
    const newShops = shops
      .filter((shop) => !existingPlaceIds.has(shop.place_id))
      .map((shop) => ({ ...shop, google_place_id: shop.place_id }));
    if (!newShops.length) return NextResponse.json({ imported: 0, skippedExisting: shops.length, message: "検索結果はすべて登録済みでした。" });

    const { data: inserted, error: insertError } = await supabaseAdmin.from("ramen_shops").insert(newShops).select("place_id");
    if (insertError) throw insertError;
    return NextResponse.json({ imported: inserted?.length ?? 0, skippedExisting: shops.length - newShops.length, found: shops.length });
  } catch (error) {
    console.error("Admin Google Maps import failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Google Mapsからの取得に失敗しました。" }, { status: 500 });
  }
}
