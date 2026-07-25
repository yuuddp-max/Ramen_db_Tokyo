import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const photoNamePattern = /^places\/[^/]+\/photos\/[^/]+$/;

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  const shopId = request.nextUrl.searchParams.get("shopId") ?? "";
  if (!uuidPattern.test(shopId)) return NextResponse.json({ error: "Invalid shop ID." }, { status: 400 });

  const { data: shop, error } = await supabase.from("ramen_shops").select("photo_name").eq("id", shopId).single();
  if (error || !shop?.photo_name || !photoNamePattern.test(shop.photo_name)) return NextResponse.json({ error: "Photo not available." }, { status: 404 });
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Photo service is not configured." }, { status: 500 });

  try {
    const params = new URLSearchParams({ maxWidthPx: "1200", skipHttpRedirect: "true", key: apiKey });
    const response = await fetch(`https://places.googleapis.com/v1/${shop.photo_name}/media?${params}`, { cache: "no-store" });
    if (!response.ok) return NextResponse.json({ error: "Photo could not be retrieved." }, { status: 404 });
    const body = await response.json() as { photoUri?: string };
    if (!body.photoUri) return NextResponse.json({ error: "Photo not available." }, { status: 404 });
    const redirect = NextResponse.redirect(body.photoUri, 302);
    redirect.headers.set("Cache-Control", "public, max-age=300, s-maxage=300");
    return redirect;
  } catch {
    return NextResponse.json({ error: "Photo could not be retrieved." }, { status: 502 });
  }
}
