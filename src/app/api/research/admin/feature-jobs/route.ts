import { after, NextRequest, NextResponse } from "next/server";
import { enqueueFeatureJob, processFeatureJobImmediately } from "@/lib/ramen-feature-jobs";
import { isResearchAdminRequest } from "@/lib/research-admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isResearchAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });
  const { data, error } = await supabaseAdmin.from("ramen_feature_jobs").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ job: data });
}

export async function POST(request: NextRequest) {
  if (!isResearchAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const requestedCount = Number(body.limit);
  if (![1, 10, 50, 1000].includes(requestedCount)) return NextResponse.json({ error: "取得件数は1、10、50、または未取得店舗すべて（1000件上限）を指定してください。" }, { status: 400 });
  try {
    const job = await enqueueFeatureJob(requestedCount);
    after(async () => {
      try { await processFeatureJobImmediately(job.id, requestedCount); }
      catch (error) { console.error("Feature worker failed", { jobId: job.id, error: error instanceof Error ? error.message : "Unknown error" }); }
    });
    return NextResponse.json({ job, message: `店舗特徴情報の取得ジョブを登録しました（${requestedCount === 1000 ? "最大1000" : requestedCount}件）。` }, { status: 202 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Feature job could not be created." }, { status: 500 }); }
}
