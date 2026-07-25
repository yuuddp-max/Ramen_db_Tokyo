import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const recentPosts = new Map<string, number>();

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) return NextResponse.json({ error: "Wait reports are not configured." }, { status: 500 });
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const lastPost = recentPosts.get(forwardedFor) ?? 0;
  if (Date.now() - lastPost < 60_000) return NextResponse.json({ error: "投稿は1分に1回までです。" }, { status: 429 });

  const body = await request.json().catch(() => null) as { shopId?: unknown; waitMinutes?: unknown } | null;
  const shopId = typeof body?.shopId === "string" ? body.shopId : "";
  const waitMinutes = typeof body?.waitMinutes === "number" ? body.waitMinutes : Number.NaN;
  if (!uuidPattern.test(shopId) || !Number.isInteger(waitMinutes) || waitMinutes < 0 || waitMinutes > 240) {
    return NextResponse.json({ error: "入力内容を確認してください。" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("wait_reports").insert({ shop_id: shopId, wait_minutes: waitMinutes, source: "web" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  recentPosts.set(forwardedFor, Date.now());
  return NextResponse.json({ ok: true }, { status: 201 });
}
