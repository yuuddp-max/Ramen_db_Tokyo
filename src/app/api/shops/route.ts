import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  if (!supabase) return NextResponse.json({ shops: [], total: 0, message: "Supabase is not configured." });
  const params = request.nextUrl.searchParams;
  const query = params.get("q")?.trim() ?? "";
  const genre = params.get("genre")?.trim() ?? "";
  const style = params.get("style")?.trim() ?? "";
  const rawIds = params.get("ids");
  const ids = rawIds?.split(",").filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)).slice(0, 100) ?? [];
  const sortValue = params.get("sort");
  const sort = sortValue === "newest" || sortValue === "reviews" ? sortValue : "rating";
  const limit = Math.min(Math.max(Number(params.get("limit")) || 60, 1), 100);
  const offset = Math.max(Number(params.get("offset")) || 0, 0);
  let builder = supabase.from("ramen_shops").select("*", { count: "exact" });
  if (query) builder = builder.or(`name.ilike.%${query}%,address.ilike.%${query}%`);
  if (genre) builder = builder.contains("genres", [genre]);
  if (style) builder = builder.ilike("name", `%${style}%`);
  if (rawIds !== null) {
    if (!ids.length) return NextResponse.json({ shops: [], total: 0 });
    builder = builder.in("id", ids);
  }
  builder = sort === "newest"
    ? builder.order("created_at", { ascending: false })
    : sort === "reviews"
      ? builder.order("user_ratings_total", { ascending: false, nullsFirst: false })
      : builder.order("rating", { ascending: false, nullsFirst: false });
  const { data, error, count } = await builder.range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shops: data ?? [], total: count ?? 0 });
}
