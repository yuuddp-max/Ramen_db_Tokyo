import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { calculateDistanceMeters, getCurrentOpenStatus } from "@/lib/utils";
import { matchesRamenTaxonomy } from "@/lib/ramen-genres";
import { dedupeRamenShops, normalizeShopText } from "@/lib/shop-deduplication";
import { searchTokyoLocation } from "@/lib/google-places";
import type { RamenShop } from "@/types/ramen";

export async function GET(request: NextRequest) {
  if (!supabase) return NextResponse.json({ shops: [], total: 0, message: "Supabase is not configured." });
  const params = request.nextUrl.searchParams;
  const query = params.get("q")?.trim() ?? "";
  const stationSearch = query.endsWith("駅");
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
  const rawNorth = params.get("north"); const rawSouth = params.get("south"); const rawEast = params.get("east"); const rawWest = params.get("west");
  const north = rawNorth === null ? Number.NaN : Number(rawNorth); const south = rawSouth === null ? Number.NaN : Number(rawSouth); const east = rawEast === null ? Number.NaN : Number(rawEast); const west = rawWest === null ? Number.NaN : Number(rawWest);
  const hasBounds = [north, south, east, west].every(Number.isFinite) && north >= south && east >= west;
  const ids = rawIds?.split(",").filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)).slice(0, 100) ?? [];
  const sortValue = params.get("sort");
  const sort = sortValue === "newest" || sortValue === "reviews" || (sortValue === "distance" && hasLocation) ? sortValue : "rating";
  const limit = Math.min(Math.max(Number(params.get("limit")) || 60, 1), 100);
  const offset = Math.max(Number(params.get("offset")) || 0, 0);
  let builder = supabase.from("ramen_shops").select("*");
  if (hasBounds) builder = builder.gte("latitude", south).lte("latitude", north).gte("longitude", west).lte("longitude", east);
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
  const resultPages = await Promise.all(Array.from({ length: 6 }, (_, index) => builder.range(index * 1000, index * 1000 + 999)));
  const error = resultPages.find((result) => result.error)?.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const data = resultPages.flatMap((result) => result.data ?? []);
  const stationLocation = stationSearch ? await searchTokyoLocation(query) : null;
  const matchingShops = dedupeRamenShops((data ?? []) as RamenShop[]).filter((shop) => {
    const normalizedQuery = normalizeShopText(query);
    const textMatches = !normalizedQuery || normalizeShopText(shop.name).includes(normalizedQuery) || normalizeShopText(shop.address).includes(normalizedQuery) || normalizeShopText(shop.nearest_station).includes(normalizedQuery);
    const stationMatches = stationLocation ? calculateDistanceMeters(stationLocation.latitude, stationLocation.longitude, shop.latitude, shop.longitude) <= 2_000 : false;
    return (!openNow || getCurrentOpenStatus(shop.opening_hours).open) && matchesRamenTaxonomy(shop.name, soup, style) && (stationSearch ? stationMatches || textMatches : textMatches);
  });
  if (sort === "distance") matchingShops.sort((a, b) => calculateDistanceMeters(latitude, longitude, a.latitude, a.longitude) - calculateDistanceMeters(latitude, longitude, b.latitude, b.longitude));
  const pageShops = matchingShops.slice(offset, offset + limit);
  let awardedShopIds = new Set<string>();
  if (supabaseAdmin && pageShops.length) {
    const { data: awards } = await supabaseAdmin
      .from("tabelog_hyakumeiten_awards")
      .select("shop_id")
      .in("shop_id", pageShops.map((shop) => shop.id))
      .eq("match_status", "matched");
    awardedShopIds = new Set((awards ?? []).map((award) => award.shop_id));
  }
  return NextResponse.json({ shops: pageShops.map((shop) => ({ ...shop, has_tabelog_hyakumeiten: awardedShopIds.has(shop.id) })), total: matchingShops.length });
}
