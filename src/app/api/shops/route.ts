import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { calculateDistanceMeters, getCurrentOpenStatus } from "@/lib/utils";
import { matchesRamenTaxonomy } from "@/lib/ramen-genres";
import { dedupeRamenShops } from "@/lib/shop-deduplication";
import type { RamenShop } from "@/types/ramen";

export async function GET(request: NextRequest) {
  if (!supabase) return NextResponse.json({ shops: [], total: 0, message: "Supabase is not configured." });
  const params = request.nextUrl.searchParams;
  const query = params.get("q")?.trim() ?? "";
  const genre = params.get("genre")?.trim() ?? "";
  const soup = params.get("soup")?.trim() ?? "";
  const style = params.get("style")?.trim() ?? "";
  const minRatingValue = Number(params.get("minRating"));
  const minRating = [4, 4.5].includes(minRatingValue) ? minRatingValue : null;
  const price = params.get("price")?.trim() ?? "";
  const rawIds = params.get("ids");
  const openNow = params.get("openNow") === "true";
  const rawLatitude = params.get("latitude");
  const rawLongitude = params.get("longitude");
  const latitude = rawLatitude === null ? Number.NaN : Number(rawLatitude);
  const longitude = rawLongitude === null ? Number.NaN : Number(rawLongitude);
  const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
  const ids = rawIds?.split(",").filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)).slice(0, 100) ?? [];
  const sortValue = params.get("sort");
  const sort = sortValue === "newest" || sortValue === "reviews" || (sortValue === "distance" && hasLocation) ? sortValue : "rating";
  const limit = Math.min(Math.max(Number(params.get("limit")) || 60, 1), 100);
  const offset = Math.max(Number(params.get("offset")) || 0, 0);
  let builder = supabase.from("ramen_shops").select("*");
  if (query) builder = builder.or(`name.ilike.%${query}%,address.ilike.%${query}%`);
  if (genre) builder = builder.contains("genres", [genre]);
  if (minRating !== null) builder = builder.gte("rating", minRating);
  if (price) {
    const priceLevels: Record<string, string[]> = {
      "¥": ["PRICE_LEVEL_INEXPENSIVE", "¥"],
      "¥¥": ["PRICE_LEVEL_MODERATE", "¥¥"],
      "¥¥¥": ["PRICE_LEVEL_EXPENSIVE", "¥¥¥"],
      "¥¥¥¥": ["PRICE_LEVEL_VERY_EXPENSIVE", "¥¥¥¥"],
    };
    const levels = priceLevels[price];
    if (levels) builder = builder.in("price_level", levels);
  }
  if (rawIds !== null) {
    if (!ids.length) return NextResponse.json({ shops: [], total: 0 });
    builder = builder.in("id", ids);
  }
  builder = sort === "newest"
    ? builder.order("created_at", { ascending: false })
    : sort === "reviews"
      ? builder.order("user_ratings_total", { ascending: false, nullsFirst: false })
      : builder.order("rating", { ascending: false, nullsFirst: false });
  // Import results can contain different Place IDs for one physical storefront.
  // Read the import cap and deduplicate before applying pagination so pages and totals stay stable.
  const { data, error } = await builder.range(0, 2999);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const matchingShops = dedupeRamenShops((data ?? []) as RamenShop[]).filter((shop) =>
    (!openNow || getCurrentOpenStatus(shop.opening_hours).open) && matchesRamenTaxonomy(shop.name, soup, style),
  );
  if (sort === "distance") matchingShops.sort((a, b) => calculateDistanceMeters(latitude, longitude, a.latitude, a.longitude) - calculateDistanceMeters(latitude, longitude, b.latitude, b.longitude));
  return NextResponse.json({ shops: matchingShops.slice(offset, offset + limit), total: matchingShops.length });
}
