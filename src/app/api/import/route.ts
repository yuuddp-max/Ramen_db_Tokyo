import { NextRequest, NextResponse } from "next/server";
import { searchAllTokyoRamen, searchTokyoRamen, TOKYO_SEARCH_QUERIES } from "@/lib/google-places";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function chunks<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-import-secret");
  if (!process.env.IMPORT_API_SECRET || secret !== process.env.IMPORT_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });
  try {
    const body = await request.json().catch(() => ({}));
    const target = Math.min(Math.max(Number(body.target) || 5_000, 1), 5_000);
    const queryOffset = Math.min(Math.max(Number(body.queryOffset) || 0, 0), TOKYO_SEARCH_QUERIES.length);
    const queryLimit = Math.min(Math.max(Number(body.queryLimit) || TOKYO_SEARCH_QUERIES.length, 1), 25);
    const { count: currentTotal, error: countError } = await supabaseAdmin.from("ramen_shops").select("id", { count: "exact", head: true });
    if (countError) throw countError;
    const remaining = Math.max(target - (currentTotal ?? 0), 0);
    if (remaining === 0) return NextResponse.json({ imported: 0, total: currentTotal ?? 0, target, message: "The target has already been reached. Existing shops were not changed." });
    const shops = typeof body.query === "string"
      ? await searchTokyoRamen(body.query)
      : await searchAllTokyoRamen(TOKYO_SEARCH_QUERIES.slice(queryOffset, queryOffset + queryLimit), 5_000);
    if (!shops.length) return NextResponse.json({ imported: 0, message: "No shops returned by Places API." });
    const existingPlaceIds = new Set<string>();
    for (const placeIds of chunks(shops.map((shop) => shop.place_id), 500)) {
      const { data, error } = await supabaseAdmin.from("ramen_shops").select("place_id").in("place_id", placeIds);
      if (error) throw error;
      for (const row of data ?? []) existingPlaceIds.add(row.place_id);
    }
    const newShops = shops.filter((shop) => !existingPlaceIds.has(shop.place_id)).slice(0, remaining);
    if (!newShops.length) return NextResponse.json({ imported: 0, total: currentTotal ?? 0, target, message: "All returned Places are already imported. Existing shops were not changed." });
    const { data: inserted, error } = await supabaseAdmin.from("ramen_shops").insert(newShops).select("place_id");
    if (error) throw error;
    const { count } = await supabaseAdmin.from("ramen_shops").select("id", { count: "exact", head: true });
    return NextResponse.json({ imported: inserted?.length ?? 0, skippedExisting: shops.length - newShops.length, total: count ?? 0, target, queryOffset, queryLimit, nextQueryOffset: Math.min(queryOffset + queryLimit, TOKYO_SEARCH_QUERIES.length), hasMoreQueries: queryOffset + queryLimit < TOKYO_SEARCH_QUERIES.length });
  } catch (error) {
    console.error("Ramen import failed", error);
    const message = error instanceof Error ? error.message : typeof error === "object" && error !== null ? JSON.stringify(error) : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
