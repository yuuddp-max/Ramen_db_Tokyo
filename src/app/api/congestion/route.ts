import { NextRequest, NextResponse } from "next/server";
import { createCongestionPrediction, getCurrentWeather, type WaitReport } from "@/lib/congestion";
import { supabase } from "@/lib/supabase";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  const shopId = request.nextUrl.searchParams.get("shopId") ?? "";
  if (!uuidPattern.test(shopId)) return NextResponse.json({ error: "Invalid shop ID." }, { status: 400 });

  const [{ data: shop, error: shopError }, { data: reports, error: reportsError }] = await Promise.all([
    supabase.from("ramen_shops").select("id,rating,latitude,longitude").eq("id", shopId).single(),
    supabase.from("wait_reports").select("wait_minutes,reported_at").eq("shop_id", shopId).order("reported_at", { ascending: false }).limit(1000),
  ]);
  if (shopError || !shop) return NextResponse.json({ error: "Shop not found." }, { status: 404 });
  if (reportsError) return NextResponse.json({ error: reportsError.message }, { status: 500 });

  const weather = await getCurrentWeather(shop.latitude, shop.longitude);
  const prediction = createCongestionPrediction((reports ?? []) as WaitReport[], shop.rating, weather);
  return NextResponse.json({ prediction, weather });
}
