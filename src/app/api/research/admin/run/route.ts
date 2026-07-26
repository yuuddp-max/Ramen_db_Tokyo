import { NextRequest, NextResponse } from "next/server";
import { isResearchAdminRequest } from "@/lib/research-admin-auth";
import { runSoupResearch } from "@/lib/research-jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!isResearchAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const limit = Number(body.limit) === 10 ? 10 : 1;
  try { return NextResponse.json(await runSoupResearch(limit)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Research job failed." }, { status: 500 }); }
}
