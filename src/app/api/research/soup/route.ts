import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { runSoupResearch } from "@/lib/research-jobs";
import { isResearchSecretRequest } from "@/lib/research-admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isResearchSecretRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  if (!isResearchSecretRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 10);
  try { return NextResponse.json(await runSoupResearch(limit)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Research job failed." }, { status: 500 }); }
}
