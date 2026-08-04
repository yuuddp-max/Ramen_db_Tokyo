import { NextRequest, NextResponse } from "next/server";
import { isResearchAdminRequest } from "@/lib/research-admin-auth";
import { enqueueClassificationJob } from "@/lib/classification-jobs";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isResearchAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const limit = Number(body.limit) === 10 ? 10 : 100;
  try {
    const job = await enqueueClassificationJob(limit);
    return NextResponse.json({ job, message: "分類ジョブを登録しました。バックグラウンド処理を待機しています。" }, { status: 202 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not enqueue classification job." }, { status: 500 }); }
}
