import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase";
import { createWebRamenResearchClient, type WebRamenResearchClient } from "@/lib/web-ramen-client";
import { calculateWebRankingScore, classifyWebMention, mentionId, type ShopAlias, type ShopCandidate } from "@/lib/web-ramen-rules";
import { dedupeWebMentions } from "@/lib/web-ramen-feed";
import type { WebFetchResult } from "@/types/web-ramen";

async function loadRows<T>(admin: SupabaseClient, table: "ramen_shops" | "shop_aliases", columns: string) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select(columns).range(from, from + 999);
    // Aliases are an optional enrichment table. Older deployments may not
    // have it yet; research can still run using canonical shop names.
    if (error && table === "shop_aliases" && (error.code === "42P01" || error.code === "PGRST205")) return rows;
    if (error) throw new Error(`Failed to load web research catalog (${table}).`);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return rows;
  }
}

async function startLog(admin: SupabaseClient) {
  await admin.from("web_fetch_logs").update({ status: "failed", completed_at: new Date().toISOString(), error_summary: "stale_run_recovered" }).eq("status", "running").lt("started_at", new Date(Date.now() - 15 * 60_000).toISOString());
  const { data, error } = await admin.from("web_fetch_logs").insert({ status: "running" }).select("id,started_at").single();
  if (error || !data) throw new Error(error?.code === "23505" ? "A web research run is already running." : "Could not create web research log.");
  return data as { id: string; started_at: string };
}

export async function runWebRamenResearch(options: { client?: WebRamenResearchClient; admin?: SupabaseClient } = {}): Promise<WebFetchResult> {
  const admin = options.admin ?? supabaseAdmin;
  if (!admin) throw new Error("Supabase service role is not configured.");
  const log = await startLog(admin);
  const base = { fetched: 0, inserted: 0, updated: 0, matched: 0, excluded: 0, errors: 0, apiStatus: null, startedAt: log.started_at, completedAt: new Date().toISOString(), status: "failed" as const };
  try {
    const [shopRows, aliases, result] = await Promise.all([
      // Keep this query compatible with databases that have not yet applied
      // optional station-enrichment migrations.
      loadRows<{ id: string; name: string; address: string | null }>(admin, "ramen_shops", "id,name,address"),
      loadRows<ShopAlias>(admin, "shop_aliases", "shop_id,alias_name"),
      (options.client ?? createWebRamenResearchClient()).searchRecentMentions(),
    ]);
    const shops: ShopCandidate[] = shopRows.map((shop) => ({ ...shop, nearest_station: null }));
    const candidates = dedupeWebMentions(result.mentions.map((mention) => {
      const match = classifyWebMention(`${mention.title}\n${mention.summary}`, shops, aliases);
      const exclusion = match.exclusionReason;
      return { mention_id: mentionId(mention.source_url), shop_id: match.shopId, source_name: mention.source_name, title: mention.title, summary: mention.summary, source_url: mention.source_url, published_at: mention.published_at, matched_area: match.matchedArea ?? mention.matched_area, matched_keyword: match.matchedKeyword, matched_alias: match.matchedAlias, tokyo_confidence: match.tokyoConfidence, ramen_relevance: match.ramenRelevance, source_score: mention.source_score, ranking_score: calculateWebRankingScore(mention.source_score, mention.published_at), is_visible: !exclusion && match.tokyoConfidence >= 0.6 && match.ramenRelevance >= 0.8, exclusion_reason: exclusion };
    }));
    const ids = candidates.map((candidate) => candidate.mention_id);
    const { data: existing } = ids.length ? await admin.from("web_ramen_mentions").select("mention_id").in("mention_id", ids) : { data: [] };
    const existingIds = new Set((existing ?? []).map((row) => row.mention_id));
    let errors = 0;
    for (let index = 0; index < candidates.length; index += 25) {
      const { error } = await admin.from("web_ramen_mentions").upsert(candidates.slice(index, index + 25), { onConflict: "mention_id" });
      if (error) errors += Math.min(25, candidates.length - index);
    }
    const output: WebFetchResult = { fetched: candidates.length, inserted: candidates.filter((row) => !existingIds.has(row.mention_id)).length, updated: candidates.filter((row) => existingIds.has(row.mention_id)).length, matched: candidates.filter((row) => row.shop_id).length, excluded: candidates.filter((row) => !row.is_visible).length, errors, apiStatus: result.status, startedAt: log.started_at, completedAt: new Date().toISOString(), status: errors ? "partial" : "succeeded" };
    await admin.from("web_fetch_logs").update({ completed_at: output.completedAt, status: output.status, fetched_count: output.fetched, inserted_count: output.inserted, updated_count: output.updated, matched_count: output.matched, excluded_count: output.excluded, error_count: output.errors, api_status: output.apiStatus }).eq("id", log.id);
    return output;
  } catch (error) {
    const output: WebFetchResult = { ...base, errors: 1, completedAt: new Date().toISOString() };
    await admin.from("web_fetch_logs").update({ completed_at: output.completedAt, status: "failed", error_count: 1, error_summary: error instanceof Error ? error.message.slice(0, 300) : "Web research failed." }).eq("id", log.id);
    throw error;
  }
}
