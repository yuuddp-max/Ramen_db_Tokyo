import Link from "next/link";
import { cookies } from "next/headers";
import { ResearchAdmin } from "@/components/ResearchAdmin";
import { isResearchAdminSession, RESEARCH_ADMIN_COOKIE } from "@/lib/research-admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function ResearchAdminPage() {
  const authenticated = isResearchAdminSession((await cookies()).get(RESEARCH_ADMIN_COOKIE)?.value);
  let drafts: Parameters<typeof ResearchAdmin>[0]["drafts"] = [];
  let metrics: Parameters<typeof ResearchAdmin>[0]["metrics"] = { recordCount: 0, deletedCount: 0, total: 0, soupRegistered: 0, soupRegistrationRate: 0, styleRegistered: 0, styleRegistrationRate: 0, ratingRegistered: 0, websiteRegistered: 0, photoRegistered: 0 };
  let classificationMetrics: Parameters<typeof ResearchAdmin>[0]["classificationMetrics"] = { total: 0, processed: 0, autoApproved: 0, needsReview: 0, ai: 0, error: 0, progress: 0 };
  let webFetchLog: Parameters<typeof ResearchAdmin>[0]["webFetchLog"] = null;
  if (authenticated && supabaseAdmin) {
    const [classificationReviewResult, recordCountResult, deletedCountResult, totalResult, soupRegisteredResult, styleRegisteredResult, ratingRegisteredResult, websiteRegisteredResult, photoRegisteredResult, classificationProcessed, classificationAutoApproved, classificationNeedsReview, classificationAi, classificationError, xFetchLogResult] = await Promise.all([
      supabaseAdmin.from("ramen_shops").select('place_id,name,address,rating,user_ratings_total,research_evidence_summary,"soupCategory","styleCategory","soupConfidence","styleConfidence","classificationMethod","classificationStatus"').eq("is_excluded", false).eq("classificationStatus", "needs-review").order("classifiedAt", { ascending: false }).limit(30),
      supabaseAdmin.from("ramen_shops").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("ramen_shops").select("id", { count: "exact", head: true }).eq("is_excluded", true),
      supabaseAdmin.from("ramen_shops").select("id", { count: "exact", head: true }).eq("is_excluded", false),
      supabaseAdmin.from("ramen_shops").select("id", { count: "exact", head: true }).eq("is_excluded", false).not("soupCategory", "is", null),
      supabaseAdmin.from("ramen_shops").select("id", { count: "exact", head: true }).eq("is_excluded", false).not("styleCategory", "is", null),
      supabaseAdmin.from("ramen_shops").select("id", { count: "exact", head: true }).eq("is_excluded", false).not("rating", "is", null),
      supabaseAdmin.from("ramen_shops").select("id", { count: "exact", head: true }).eq("is_excluded", false).not("website", "is", null),
      supabaseAdmin.from("ramen_shops").select("id", { count: "exact", head: true }).eq("is_excluded", false).not("photo_name", "is", null),
      supabaseAdmin.from("ramen_shops").select("id", { count: "exact", head: true }).eq("is_excluded", false).not("classificationStatus", "is", null),
      supabaseAdmin.from("ramen_shops").select("id", { count: "exact", head: true }).eq("is_excluded", false).eq("classificationStatus", "auto-approved"),
      supabaseAdmin.from("ramen_shops").select("id", { count: "exact", head: true }).eq("is_excluded", false).eq("classificationStatus", "needs-review"),
      supabaseAdmin.from("ramen_shops").select("id", { count: "exact", head: true }).eq("is_excluded", false).eq("classificationMethod", "generative-ai"),
      supabaseAdmin.from("ramen_shops").select("id", { count: "exact", head: true }).eq("is_excluded", false).eq("classificationStatus", "error"),
      supabaseAdmin.from("web_fetch_logs").select("started_at,completed_at,status,fetched_count,inserted_count,updated_count,matched_count,excluded_count,error_count,api_status,error_summary").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const { data } = classificationReviewResult;
    drafts = data ?? [];
    webFetchLog = xFetchLogResult.data ?? null;
    metrics = {
      recordCount: recordCountResult.count ?? 0,
      deletedCount: deletedCountResult.count ?? 0,
      total: totalResult.count ?? 0,
      soupRegistered: soupRegisteredResult.count ?? 0,
      soupRegistrationRate: totalResult.count ? Math.round(((soupRegisteredResult.count ?? 0) / totalResult.count) * 1000) / 10 : 0,
      styleRegistered: styleRegisteredResult.count ?? 0,
      styleRegistrationRate: totalResult.count ? Math.round(((styleRegisteredResult.count ?? 0) / totalResult.count) * 1000) / 10 : 0,
      ratingRegistered: ratingRegisteredResult.count ?? 0,
      websiteRegistered: websiteRegisteredResult.count ?? 0,
      photoRegistered: photoRegisteredResult.count ?? 0,
    };
    const total = totalResult.count ?? 0;
    const processed = classificationProcessed.count ?? 0;
    classificationMetrics = { total, processed, autoApproved: classificationAutoApproved.count ?? 0, needsReview: classificationNeedsReview.count ?? 0, ai: classificationAi.count ?? 0, error: classificationError.count ?? 0, progress: total ? (processed / total) * 100 : 0 };
  }
  return <><header className="border-b border-white/10"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8"><Link href="/" className="font-black">TOKYO <span className="text-ramen">RAMEN</span></Link><Link href="/" className="text-sm text-stone-400 hover:text-gold">← 店舗一覧</Link></div></header><ResearchAdmin authenticated={authenticated} drafts={drafts} metrics={metrics} classificationMetrics={classificationMetrics} webFetchLog={webFetchLog} /></>;
}
