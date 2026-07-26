import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isResearchAdminRequest, isResearchSecretRequest } from "@/lib/research-admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isResearchSecretRequest(request) && !isResearchAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  const placeIds = Array.isArray(body.placeIds) ? body.placeIds.filter((value: unknown): value is string => typeof value === "string").slice(0, 20) : [];
  if (!placeIds.length) return NextResponse.json({ error: "placeIds must contain at least one Place ID." }, { status: 400 });
  const { data, error } = await supabaseAdmin.from("ramen_shops")
    .update({ research_status: "approved", research_updated_at: new Date().toISOString() })
    .in("place_id", placeIds).eq("research_status", "draft").select("place_id,name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ approved: data?.length ?? 0, shops: data ?? [] });
}
