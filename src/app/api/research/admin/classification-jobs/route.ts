import { NextRequest, NextResponse } from "next/server";
import { enqueueClassificationJob } from "@/lib/classification-jobs";
import { isResearchAdminRequest } from "@/lib/research-admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isResearchAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try {
    const job = await enqueueClassificationJob(Number(body.limit) || 100);
    return NextResponse.json({ job, message: "分類ジョブを登録しました。バックグラウンド処理を待機しています。" }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not enqueue classification job." }, { status: 500 });
  }
}
