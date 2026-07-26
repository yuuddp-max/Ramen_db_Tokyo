import { NextRequest, NextResponse } from "next/server";
import { isResearchAdminRequest } from "@/lib/research-admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

const SOUP_TYPES = ["醤油", "塩", "味噌", "豚骨", "豚骨醤油", "鶏白湯", "魚介", "煮干し", "貝出汁", "海老", "牛骨", "担々麺", "カレー", "その他", "複数", "未確認"];
const STYLES = ["東京中華そば", "家系", "二郎系", "二郎インスパイア", "大勝軒系", "つけ麺", "油そば", "まぜそば", "淡麗系", "濃厚系", "背脂系", "昆布水つけ麺", "冷やしラーメン", "その他", "未確認"];

export async function POST(request: NextRequest) {
  if (!isResearchAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });

  const body = await request.json().catch(() => ({}));
  const placeId = typeof body.placeId === "string" ? body.placeId : "";
  const soupType = typeof body.soupType === "string" ? body.soupType : undefined;
  const style = typeof body.style === "string" ? body.style : undefined;

  if (!placeId) return NextResponse.json({ error: "placeId is required." }, { status: 400 });
  if (!soupType && !style) return NextResponse.json({ error: "スープ系統またはスタイルを選択してください。" }, { status: 400 });
  if (soupType && !SOUP_TYPES.includes(soupType)) return NextResponse.json({ error: "Invalid soup type." }, { status: 400 });
  if (style && !STYLES.includes(style)) return NextResponse.json({ error: "Invalid style." }, { status: 400 });

  const updates: Record<string, string> = {
    research_confidence: "manual",
    research_updated_at: new Date().toISOString(),
  };
  if (soupType) updates.researched_soup_type = soupType;
  if (style) updates.researched_style = style;

  const { error } = await supabaseAdmin
    .from("ramen_shops")
    .update(updates)
    .eq("place_id", placeId)
    .eq("research_status", "draft");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
