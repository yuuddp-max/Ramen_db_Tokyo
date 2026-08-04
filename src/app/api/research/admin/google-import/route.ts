import { NextRequest, NextResponse } from "next/server";
import { searchTokyoRamen } from "@/lib/google-places";
import { isResearchAdminRequest } from "@/lib/research-admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function matchKey(value: string | null | undefined) {
  return (value ?? "").normalize("NFKC").toLocaleLowerCase("ja-JP").replace(/[\s　・･.,，。、()（）「」『』【】\[\]]/g, "").trim();
}

export async function POST(request: NextRequest) {
  if (!isResearchAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });

  const body = await request.json().catch(() => ({}));
  const query = typeof body.query === "string" ? body.query.trim() : "";
  const excludeKeywords = Array.isArray(body.excludeKeywords)
    ? body.excludeKeywords.filter((item: unknown): item is string => typeof item === "string").map((item: string) => item.normalize("NFKC").trim().toLocaleLowerCase("ja-JP")).filter(Boolean)
    : typeof body.excludeKeywords === "string"
      ? body.excludeKeywords.split(/[\n,、]/).map((item: string) => item.normalize("NFKC").trim().toLocaleLowerCase("ja-JP")).filter(Boolean)
      : [];
  if (query.length < 2 || query.length > 100) return NextResponse.json({ error: "検索語は2〜100文字で入力してください。" }, { status: 400 });

  try {
    const shops = await searchTokyoRamen(query);
    if (!shops.length) return NextResponse.json({ imported: 0, skippedExisting: 0, message: "Google Mapsから店舗が見つかりませんでした。" });
    const matchesExcludeKeyword = (shop: (typeof shops)[number]) => {
      if (!excludeKeywords.length) return false;
      const searchable = [shop.name, shop.address, ...(shop.genres ?? [])].filter(Boolean).join(" ").normalize("NFKC").toLocaleLowerCase("ja-JP");
      return excludeKeywords.some((keyword: string) => searchable.includes(keyword));
    };
    const excludedByKeyword = shops.filter(matchesExcludeKeyword).length;
    const candidates = shops.filter((shop) => !matchesExcludeKeyword(shop));
    if (!candidates.length) return NextResponse.json({ imported: 0, found: shops.length, skippedExisting: 0, excludedByKeyword, message: `除外キーワードに一致する${excludedByKeyword}件を除外しました。` });

    const existing: { place_id: string; name: string | null; address: string | null }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin.from("ramen_shops").select("place_id,name,address").range(from, from + 999);
      if (error) throw error;
      existing.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    const existingPlaceIds = new Set(existing.map((shop) => shop.place_id));
    const existingNames = new Set(existing.map((shop) => matchKey(shop.name)));
    const existingAddresses = new Set(existing.map((shop) => matchKey(shop.address)));
    const newShops = candidates
      .filter((shop) => !existingPlaceIds.has(shop.place_id) && !existingNames.has(matchKey(shop.name)) && !existingAddresses.has(matchKey(shop.address)))
      .map((shop) => ({ ...shop, google_place_id: shop.place_id }));
    if (!newShops.length) return NextResponse.json({ imported: 0, found: shops.length, skippedExisting: candidates.length, excludedByKeyword, message: `検索結果${candidates.length}件はすべて登録済みでした。${excludedByKeyword ? `（除外${excludedByKeyword}件）` : ""}` });

    const { data: inserted, error: insertError } = await supabaseAdmin.from("ramen_shops").insert(newShops).select("place_id");
    if (insertError) throw insertError;
    return NextResponse.json({ imported: inserted?.length ?? 0, skippedExisting: candidates.length - newShops.length, excludedByKeyword, found: shops.length });
  } catch (error) {
    console.error("Admin Google Maps import failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Google Mapsからの取得に失敗しました。" }, { status: 500 });
  }
}
