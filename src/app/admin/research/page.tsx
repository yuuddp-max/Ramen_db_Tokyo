import Link from "next/link";
import { cookies } from "next/headers";
import { ResearchAdmin } from "@/components/ResearchAdmin";
import { isResearchAdminSession, RESEARCH_ADMIN_COOKIE } from "@/lib/research-admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function ResearchAdminPage() {
  const authenticated = isResearchAdminSession((await cookies()).get(RESEARCH_ADMIN_COOKIE)?.value);
  let drafts: Parameters<typeof ResearchAdmin>[0]["drafts"] = [];
  if (authenticated && supabaseAdmin) {
    const { data } = await supabaseAdmin.from("ramen_shops").select("place_id,name,address,rating,user_ratings_total,researched_soup_type,researched_style,research_confidence,research_evidence_url,research_evidence_summary,research_updated_at").eq("research_status", "draft").order("research_updated_at", { ascending: false }).limit(30);
    drafts = data ?? [];
  }
  return <><header className="border-b border-white/10"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8"><Link href="/" className="font-black">TOKYO <span className="text-ramen">RAMEN</span></Link><Link href="/" className="text-sm text-stone-400 hover:text-gold">← 店舗一覧</Link></div></header><ResearchAdmin authenticated={authenticated} drafts={drafts} /></>;
}
