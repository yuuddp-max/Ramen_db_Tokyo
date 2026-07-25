import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  if (!supabase) return NextResponse.json({ shops: [], total: 0, message: "Supabase is not configured." });
  const params = request.nextUrl.searchParams;
  const query = params.get("q")?.trim() ?? "";
  const genre = params.get("genre")?.trim() ?? "";
  const sort = params.get("sort") === "newest" ? "newest" : "rating";
  const limit = Math.min(Math.max(Number(params.get("limit")) || 60, 1), 100);
  let builder = supabase.from("ramen_shops").select("*", { count: "exact" });
  if (query) builder = builder.or(`name.ilike.%${query}%,address.ilike.%${query}%`);
  if (genre) builder = builder.contains("genres", [genre]);
  builder = sort === "newest"
    ? builder.order("created_at", { ascending: false })
    : builder.order("rating", { ascending: false, nullsFirst: false });
  const { data, error, count } = await builder.limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shops: data ?? [], total: count ?? 0 });
}
