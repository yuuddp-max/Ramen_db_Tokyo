import { NextRequest, NextResponse } from "next/server";
import { researchSoup } from "@/lib/soup-research";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: NextRequest) {
  return Boolean(process.env.RESEARCH_API_SECRET && request.headers.get("x-research-secret") === process.env.RESEARCH_API_SECRET);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });
  const status = request.nextUrl.searchParams.get("status") ?? "draft";
  if (!["pending", "draft", "approved", "rejected"].includes(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  const { data, error } = await supabaseAdmin.from("ramen_shops")
    .select("place_id,name,address,researched_soup_type,researched_style,research_confidence,research_evidence_url,research_evidence_summary,research_status,research_updated_at")
    .eq("research_status", status).order("research_updated_at", { ascending: false, nullsFirst: true }).limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shops: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body.limit) || 3, 1), 3);
  const { data: shops, error: selectError } = await supabaseAdmin.from("ramen_shops")
    .select("id,place_id,name,address,website").eq("research_status", "pending")
    .order("rating", { ascending: false, nullsFirst: false }).order("user_ratings_total", { ascending: false, nullsFirst: false }).limit(limit);
  if (selectError) return NextResponse.json({ error: selectError.message }, { status: 500 });
  if (!shops?.length) return NextResponse.json({ researched: 0, message: "No pending shops." });

  const results: Array<{ placeId: string; name: string; status: "draft" | "failed"; error?: string }> = [];
  for (const shop of shops) {
    try {
      const research = await researchSoup(shop);
      const { error: updateError } = await supabaseAdmin.from("ramen_shops").update({
        researched_soup_type: research.soupType, researched_style: research.style, research_confidence: research.confidence,
        research_evidence_url: research.evidenceUrl, research_evidence_summary: research.evidenceSummary,
        research_status: "draft", research_updated_at: new Date().toISOString(),
      }).eq("id", shop.id);
      if (updateError) throw updateError;
      results.push({ placeId: shop.place_id, name: shop.name, status: "draft" });
    } catch (error) {
      console.error("Soup research failed", { placeId: shop.place_id, error: error instanceof Error ? error.message : "Unknown error" });
      results.push({ placeId: shop.place_id, name: shop.name, status: "failed", error: error instanceof Error ? error.message : "Research failed" });
    }
  }
  return NextResponse.json({ researched: results.filter((result) => result.status === "draft").length, results });
}
