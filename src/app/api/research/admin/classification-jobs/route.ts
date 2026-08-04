import { after, NextRequest, NextResponse } from "next/server";
import { enqueueClassificationJob, processClassificationJobImmediately } from "@/lib/classification-jobs";
import { isResearchAdminRequest } from "@/lib/research-admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isResearchAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try {
    const requestedCount = Number(body.limit);
    if (requestedCount !== 10 && requestedCount !== 100) return NextResponse.json({ error: "実行件数は10件または100件を指定してください。" }, { status: 400 });
    const job = await enqueueClassificationJob(requestedCount);
    after(async () => {
      try {
        await processClassificationJobImmediately(job.id, requestedCount);
      } catch (error) {
        console.error("Immediate classification worker failed", { jobId: job.id, error: error instanceof Error ? error.message : "Unknown error" });
      }
    });
    return NextResponse.json({ job, message: `分類ジョブを登録し、${requestedCount}件の即時処理を開始しました。` }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not enqueue classification job." }, { status: 500 });
  }
}
