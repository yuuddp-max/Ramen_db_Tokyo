import { buildFeatureText, buildFeatureSourceText, extractFeatureKeywords, featureConfidence, featureSourceHash, type FeatureKeywords } from "@/lib/ramen-feature-rules";
import { supabaseAdmin } from "@/lib/supabase";

type FeatureShop = {
  id: string;
  place_id: string;
  name: string;
  address: string | null;
  genres: string[] | null;
  shop_description: string | null;
  representative_menu: string | null;
  review_summary: string | null;
  website: string | null;
  google_maps_uri: string | null;
  feature_text: string | null;
  feature_source_hash: string | null;
  feature_status: string | null;
};

const OFFICIAL_FETCH_TIMEOUT_MS = 8_000;
const OFFICIAL_TEXT_LIMIT = 24_000;

function htmlToText(html: string) {
  const structured: string[] = [];
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (title) structured.push(title);
  for (const match of html.matchAll(/<meta[^>]+(?:name|property)=["'](?:description|og:title|og:description|twitter:title|twitter:description)["'][^>]+content=["']([^"']*)["'][^>]*>/gi)) structured.push(match[1]);
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const value = JSON.parse(match[1]) as unknown;
      const collect = (item: unknown) => {
        if (typeof item === "string") structured.push(item);
        else if (Array.isArray(item)) item.forEach(collect);
        else if (item && typeof item === "object") Object.values(item).forEach(collect);
      };
      collect(value);
    } catch {
      structured.push(match[1]);
    }
  }
  return `${structured.join(" ")} ${html}`
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, OFFICIAL_TEXT_LIMIT);
}

async function fetchOfficialSiteText(url: string) {
  if (!/^https?:\/\//i.test(url)) return "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OFFICIAL_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "text/html,text/plain;q=0.9", "User-Agent": "TokyoRamenDatabase/1.0 (+admin feature extraction)" },
      redirect: "follow",
    });
    if (!response.ok) throw new Error(`公式サイトHTTP ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType && !/text\/html|text\/plain/i.test(contentType)) return "";
    const html = await response.text();
    return htmlToText(html);
  } finally {
    clearTimeout(timer);
  }
}

export async function enqueueFeatureJob(requestedCount = 10) {
  if (!supabaseAdmin) throw new Error("Supabase service role is not configured.");
  const safeCount = Math.min(Math.max(requestedCount, 1), 1000);
  const { data, error } = await supabaseAdmin.from("ramen_feature_jobs").insert({ requested_count: safeCount }).select("id,status,requested_count,created_at").single();
  if (error) throw error;
  return data;
}

function eligible(shop: FeatureShop) {
  const source = buildFeatureSourceText({ name: shop.name, description: shop.shop_description, menu: shop.representative_menu, reviewSummary: shop.review_summary, genres: shop.genres, address: shop.address, officialUrl: shop.website, mapsUri: shop.google_maps_uri });
  const hash = featureSourceHash(source);
  return { source, hash, shouldProcess: !shop.feature_text?.trim() || !shop.feature_source_hash || shop.feature_source_hash !== hash || ["pending", "error", "no-information"].includes(shop.feature_status ?? "") };
}

export async function processFeatureJob(jobId: string, batchSize = 10) {
  const admin = supabaseAdmin;
  if (!admin) throw new Error("Supabase service role is not configured.");
  const safeBatch = Math.min(Math.max(batchSize, 1), 20);
  const { data: job, error: jobError } = await admin.from("ramen_feature_jobs").select("*").eq("id", jobId).in("status", ["queued", "processing"]).maybeSingle();
  if (jobError) throw jobError;
  if (!job) return { processed: 0, message: "Feature job is not available." };
  if (job.status === "queued") await admin.from("ramen_feature_jobs").update({ status: "processing", started_at: new Date().toISOString() }).eq("id", job.id).eq("status", "queued");
  const remaining = Math.max(job.requested_count - job.processed_count, 0);
  if (!remaining) {
    await admin.from("ramen_feature_jobs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", job.id);
    return { jobId: job.id, processed: 0, completed: true };
  }
  const { data: candidates, error: shopError } = await admin.from("ramen_shops")
    .select('id,place_id,name,address,genres,shop_description,representative_menu,review_summary,website,google_maps_uri,feature_text,feature_source_hash,feature_status')
    .eq("is_excluded", false)
    .order("user_ratings_total", { ascending: false, nullsFirst: false })
    .limit(5000);
  if (shopError) throw shopError;
  const allShops = (candidates ?? []) as FeatureShop[];
  const shops = allShops.filter((shop) => eligible(shop).shouldProcess).slice(0, Math.min(safeBatch, remaining));
  if (!shops.length) {
    await admin.from("ramen_feature_jobs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", job.id);
    return { jobId: job.id, processed: 0, completed: true };
  }
  await admin.from("ramen_shops").update({ feature_status: "processing", feature_error: null }).in("id", shops.map((shop) => shop.id));
  let processed = 0; let databaseCount = 0; let needsReview = 0; let noInformation = 0; let errors = 0;
  for (const shop of shops) {
    try {
      const { source: databaseSource, hash } = eligible(shop);
      let source = databaseSource;
      let officialFetched = false;
      if (shop.website) {
        try {
          const officialText = await fetchOfficialSiteText(shop.website);
          if (officialText) {
            source = `${databaseSource} ${officialText}`.replace(/\s+/g, " ").trim();
            officialFetched = true;
          }
        } catch (error) {
          console.warn("Official ramen site fetch failed; continuing with database data", {
            placeId: shop.place_id,
            url: shop.website,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
      const keywords = extractFeatureKeywords(source);
      const text = buildFeatureText(shop.name, source, keywords, shop.representative_menu);
      const confidence = officialFetched ? Math.max(0.9, featureConfidence(source, keywords)) : featureConfidence(source, keywords);
      const hasFeatures = Object.values(keywords).some((values) => values.length > 0);
      const status = hasFeatures ? "needs-review" : "no-information";
      const method = officialFetched ? (hasFeatures ? "mixed" : "official-site") : (hasFeatures ? "keyword-rule" : "database");
      const sourceUrls = [shop.website, shop.google_maps_uri].filter((value): value is string => Boolean(value?.trim()));
      const { error } = await admin.from("ramen_shops").update({ feature_text: text || null, feature_keywords: keywords as FeatureKeywords, feature_source_urls: sourceUrls, feature_source_hash: hash, feature_status: status, feature_method: method, feature_confidence: confidence, feature_updated_at: new Date().toISOString(), feature_error: null }).eq("id", shop.id);
      if (error) throw error;
      processed += 1; databaseCount += 1;
      if (hasFeatures) needsReview += 1; else noInformation += 1;
    } catch (error) {
      errors += 1;
      const message = error instanceof Error ? error.message : "Feature extraction failed.";
      await admin.from("ramen_shops").update({ feature_status: "error", feature_error: message, feature_updated_at: new Date().toISOString() }).eq("id", shop.id);
      console.error("Ramen feature extraction failed", { placeId: shop.place_id, error: message });
    }
  }
  const nextProcessed = job.processed_count + processed;
  const complete = nextProcessed >= job.requested_count || shops.length < Math.min(safeBatch, remaining);
  await admin.from("ramen_feature_jobs").update({ processed_count: nextProcessed, database_count: job.database_count + databaseCount, needs_review_count: job.needs_review_count + needsReview, no_information_count: job.no_information_count + noInformation, error_count: job.error_count + errors, skipped_count: job.skipped_count + Math.max(allShops.length - shops.length, 0), status: complete ? (errors ? "partially-completed" : "completed") : "processing", ...(complete ? { completed_at: new Date().toISOString() } : {}) }).eq("id", job.id);
  return { jobId: job.id, processed, databaseCount, needsReview, noInformation, errorCount: errors, completed: complete };
}

export async function processFeatureJobImmediately(jobId: string, requestedCount: number, maxDurationMs = 240_000) {
  const started = Date.now(); let processed = 0; let completed = false;
  while (processed < requestedCount && Date.now() - started < maxDurationMs) {
    const result = await processFeatureJob(jobId, Math.min(10, requestedCount - processed));
    processed += result.processed; completed = Boolean(result.completed);
    if (completed || result.processed === 0) break;
  }
  return { jobId, processed, completed, durationMs: Date.now() - started };
}

export async function processFeatureJobs(batchSize = 10) {
  if (!supabaseAdmin) throw new Error("Supabase service role is not configured.");
  const { data: jobs, error } = await supabaseAdmin.from("ramen_feature_jobs").select("id").in("status", ["queued", "processing"]).order("created_at", { ascending: true }).limit(1);
  if (error) throw error;
  const job = jobs?.[0];
  if (!job) return { processed: 0, message: "No queued feature jobs." };
  return processFeatureJob(job.id, batchSize);
}
