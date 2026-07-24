import { NextRequest, NextResponse } from "next/server";
import { searchAllTokyoRamen, searchTokyoRamen } from "@/lib/google-places";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-import-secret");
  if (!process.env.IMPORT_API_SECRET || secret !== process.env.IMPORT_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });
  try {
    const body = await request.json().catch(() => ({}));
    const shops = typeof body.query === "string"
      ? await searchTokyoRamen(body.query)
      : await searchAllTokyoRamen();
    if (!shops.length) return NextResponse.json({ imported: 0, message: "No shops returned by Places API." });
    const { error } = await supabaseAdmin.from("ramen_shops").upsert(shops, { onConflict: "place_id" });
    if (error) throw error;
    return NextResponse.json({ imported: shops.length, placeIds: shops.map((shop) => shop.place_id) });
  } catch (error) {
    console.error("Ramen import failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Import failed" }, { status: 500 });
  }
}
