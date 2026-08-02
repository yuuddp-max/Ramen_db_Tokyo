import { researchSoup, researchSoupFromOfficialWebsite } from "@/lib/soup-research";
import { supabaseAdmin } from "@/lib/supabase";

type Result = { placeId: string; name: string; status: "draft" | "failed"; error?: string };

export async function runSoupResearch(limit = 10) {
  const admin = supabaseAdmin;
  if (!admin) throw new Error("Supabase service role is not configured.");
  const safeLimit = Math.min(Math.max(limit, 1), 10);
  const { data: shops, error: selectError } = await admin.from("ramen_shops")
    .select("id,place_id,name,address,website").eq("is_excluded", false).eq("research_status", "pending")
    .is("researched_soup_type", null).is("research_evidence_url", null)
    .order("rating", { ascending: false, nullsFirst: false }).order("user_ratings_total", { ascending: false, nullsFirst: false }).limit(safeLimit);
  if (selectError) throw selectError;
  if (!shops?.length) return { researched: 0, message: "No pending shops.", results: [] as Result[] };

  const results: Result[] = [];
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < shops.length) {
      const shop = shops[nextIndex++];
      try {
        // Higher-rated stores are selected first. Use their official site before paying for Web search.
        const research = await researchSoupFromOfficialWebsite(shop) ?? await researchSoup(shop);
        const { error: updateError } = await admin.from("ramen_shops").update({
          researched_soup_type: research.soupType, researched_style: research.style, research_confidence: research.confidence,
          research_evidence_url: research.evidenceUrl, research_evidence_summary: research.evidenceSummary,
          research_status: "draft", research_updated_at: new Date().toISOString(),
        }).eq("id", shop.id);
        if (updateError) throw updateError;
        results.push({ placeId: shop.place_id, name: shop.name, status: "draft" });
      } catch (error) {
        console.error("Soup research failed", { placeId: shop.place_id, error: error instanceof Error ? error.message : "Unknown error" });
        results.push({ placeId: shop.place_id, name: shop.name, status: "failed", error: error instanceof Error ? error.message : "Research failed" });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, shops.length) }, worker));
  return { researched: results.filter((result) => result.status === "draft").length, results };
}
