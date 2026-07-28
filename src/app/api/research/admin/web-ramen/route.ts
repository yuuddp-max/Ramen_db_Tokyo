import { NextRequest, NextResponse } from "next/server";
import { isResearchAdminRequest } from "@/lib/research-admin-auth";
import { runWebRamenResearch } from "@/lib/web-ramen-jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!isResearchAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json(await runWebRamenResearch()); }
  catch (error) { const conflict = error instanceof Error && error.message === "A web research run is already running."; return NextResponse.json({ error: conflict ? error.message : "Web research failed." }, { status: conflict ? 409 : 500 }); }
}
