import { NextRequest, NextResponse } from "next/server";
import { runSoupResearch } from "@/lib/research-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json(await runSoupResearch(10)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Research job failed." }, { status: 500 }); }
}
