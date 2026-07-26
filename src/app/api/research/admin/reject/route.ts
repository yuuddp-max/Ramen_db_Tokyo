import { NextRequest, NextResponse } from "next/server";
import { isResearchAdminRequest } from "@/lib/research-admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  if (!isResearchAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  const placeId = typeof body.placeId === "string" ? body.placeId : "";
  if (!placeId) return NextResponse.json({ error: "placeId is required." }, { status: 400 });
  const { error } = await supabaseAdmin.from("ramen_shops").update({ research_status: "rejected", research_updated_at: new Date().toISOString() }).eq("place_id", placeId).eq("research_status", "draft");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
