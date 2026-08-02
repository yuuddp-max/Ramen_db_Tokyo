import {
  buildClassificationText,
  classificationSourceHash,
  classifyWithGenerativeAI,
  classifyWithRules,
  MockLocalClassificationModel,
  type CategoryResult,
  type ClassificationMethod,
  type ClassificationStatus,
  type LocalModelResult,
  type SoupCategory,
  type StyleCategory,
} from "@/lib/shop-classification";
import { supabaseAdmin } from "@/lib/supabase";

const VERSION = "rules-local-fallback-v1";
const localModel = new MockLocalClassificationModel();
type ShopRow = { id: string; place_id: string; name: string; website: string | null; shop_description?: string | null; representative_menu?: string | null; review_summary?: string | null; "classificationSourceHash"?: string | null };

function legacyConfidence(confidence: number) {
  return confidence >= 0.85 ? "high" : confidence >= 0.5 ? "medium" : "low";
}

function needsGenerative(result: LocalModelResult) {
  return result.soup.confidence < 0.5 || result.style.confidence < 0.5;
}

function approved(result: LocalModelResult, threshold: number) {
  return result.soup.confidence >= threshold && result.style.confidence >= threshold;
}

async function classifyShop(shop: ShopRow, jobId: string) {
  const started = Date.now();
  const admin = supabaseAdmin!;
  const classificationText = buildClassificationText({ name: shop.name, description: shop.shop_description, representativeMenu: shop.representative_menu, reviewSummary: shop.review_summary, website: shop.website });
  const sourceHash = classificationSourceHash(classificationText);
  if (shop["classificationSourceHash"] === sourceHash) {
    await admin.from("classification_logs").insert({ job_id: jobId, shop_id: shop.id, source_hash: sourceHash, method: "rule", status: "skipped", duration_ms: Date.now() - started, generative_ai_called: false });
    return { skipped: true, aiCalled: false, status: "pending" as const };
  }

  const ruleResult = classifyWithRules(classificationText);
  let result: LocalModelResult = { ...ruleResult, model: "rule" };
  let method: ClassificationMethod = "rule";
  let status: ClassificationStatus;
  let aiCalled = false;

  if (approved(result, 0.85)) {
    status = "auto-approved";
  } else {
    const localResult = await localModel.classify({ classificationText, ruleResult });
    result = localResult;
    method = "local-model";
    if (approved(localResult, 0.8)) {
      status = "auto-approved";
    } else if (needsGenerative(localResult)) {
      aiCalled = true;
      result = await classifyWithGenerativeAI(classificationText);
      method = "generative-ai";
      status = approved(result, 0.8) ? "auto-approved" : "needs-review";
    } else {
      status = "needs-review";
    }
  }

  const averageConfidence = (result.soup.confidence + result.style.confidence) / 2;
  const { error: updateError } = await admin.from("ramen_shops").update({
    soupCategory: result.soup.category,
    styleCategory: result.style.category,
    soupConfidence: result.soup.confidence,
    styleConfidence: result.style.confidence,
    classificationMethod: method,
    classificationStatus: status,
    classificationVersion: VERSION,
    classificationSourceHash: sourceHash,
    classifiedAt: new Date().toISOString(),
    // Keep existing screens and public cards compatible during the migration.
    researched_soup_type: result.soup.category,
    researched_style: result.style.category,
    research_confidence: legacyConfidence(averageConfidence),
    research_status: status === "auto-approved" ? "approved" : "draft",
    research_updated_at: new Date().toISOString(),
  }).eq("id", shop.id);
  if (updateError) throw updateError;
  await admin.from("classification_logs").insert({ job_id: jobId, shop_id: shop.id, source_hash: sourceHash, method, status, soup_category: result.soup.category, style_category: result.style.category, soup_confidence: result.soup.confidence, style_confidence: result.style.confidence, duration_ms: Date.now() - started, generative_ai_called: aiCalled });
  console.info("Shop classification completed", { placeId: shop.place_id, method, status, aiCalled, durationMs: Date.now() - started, soup: result.soup.category, style: result.style.category });
  return { skipped: false, aiCalled, status };
}

export async function enqueueClassificationJob(requestedCount = 100) {
  if (!supabaseAdmin) throw new Error("Supabase service role is not configured.");
  const safeCount = Math.min(Math.max(requestedCount, 1), 1000);
  const { data, error } = await supabaseAdmin.from("classification_jobs").insert({ requested_count: safeCount }).select("id,status,requested_count,created_at").single();
  if (error) throw error;
  return data;
}

export async function processClassificationJob(jobId: string, batchSize = 10) {
  const admin = supabaseAdmin;
  if (!admin) throw new Error("Supabase service role is not configured.");
  const safeBatch = Math.min(Math.max(batchSize, 1), 20);
  const { data: job, error: jobError } = await admin.from("classification_jobs").select("*").eq("id", jobId).in("status", ["queued", "running"]).maybeSingle();
  if (jobError) throw jobError;
  if (!job) return { processed: 0, message: "Classification job is not available." };
  if (job.status === "queued") await admin.from("classification_jobs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", job.id).eq("status", "queued");

  const remaining = Math.max(job.requested_count - job.processed_count, 0);
  if (!remaining) {
    await admin.from("classification_jobs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", job.id);
    return { jobId: job.id, processed: 0, completed: true };
  }
  const { data: candidates, error: shopError } = await admin.from("ramen_shops")
    .select('id,place_id,name,website,shop_description,representative_menu,review_summary,"classificationSourceHash"')
    .or("classificationStatus.is.null,classificationStatus.eq.pending,classificationStatus.eq.error")
    .order("rating", { ascending: false, nullsFirst: false }).order("user_ratings_total", { ascending: false, nullsFirst: false }).limit(Math.min(safeBatch, remaining));
  if (shopError) throw shopError;
  const shops = (candidates ?? []) as ShopRow[];
  if (!shops.length) {
    await admin.from("classification_jobs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", job.id);
    return { jobId: job.id, processed: 0, completed: true };
  }
  await admin.from("ramen_shops").update({ classificationStatus: "processing" }).in("id", shops.map((shop) => shop.id));

  let processed = 0; let autoApproved = 0; let needsReview = 0; let aiCount = 0; let errorCount = 0; let skipped = 0;
  for (const shop of shops) {
    try {
      const outcome = await classifyShop(shop, job.id);
      processed += 1;
      if (outcome.skipped) skipped += 1;
      if (outcome.status === "auto-approved") autoApproved += 1;
      if (outcome.status === "needs-review") needsReview += 1;
      if (outcome.aiCalled) aiCount += 1;
    } catch (error) {
      errorCount += 1;
      const message = error instanceof Error ? error.message : "Classification failed.";
      await admin.from("ramen_shops").update({ classificationStatus: "error" }).eq("id", shop.id);
      await admin.from("classification_logs").insert({ job_id: job.id, shop_id: shop.id, source_hash: shop["classificationSourceHash"] ?? "", method: "generative-ai", status: "error", duration_ms: 0, generative_ai_called: true, error_message: message });
      console.error("Shop classification failed", { placeId: shop.place_id, error: message });
    }
  }
  const nextProcessed = job.processed_count + processed;
  const complete = nextProcessed >= job.requested_count || shops.length < Math.min(safeBatch, remaining);
  await admin.from("classification_jobs").update({ processed_count: nextProcessed, auto_approved_count: job.auto_approved_count + autoApproved, needs_review_count: job.needs_review_count + needsReview, ai_count: job.ai_count + aiCount, error_count: job.error_count + errorCount, skipped_count: job.skipped_count + skipped, status: complete ? "completed" : "running", ...(complete ? { completed_at: new Date().toISOString() } : {}) }).eq("id", job.id);
  return { jobId: job.id, processed, autoApproved, needsReview, aiCount, errorCount, skipped, completed: complete };
}

export async function processClassificationJobs(batchSize = 10) {
  const admin = supabaseAdmin;
  if (!admin) throw new Error("Supabase service role is not configured.");
  const { data: jobs, error } = await admin.from("classification_jobs").select("id").in("status", ["queued", "running"]).order("created_at", { ascending: true }).limit(1);
  if (error) throw error;
  const job = jobs?.[0];
  if (!job) return { processed: 0, message: "No queued classification jobs." };
  return processClassificationJob(job.id, batchSize);
}

// Runs after the admin response has returned.  The time budget keeps this
// compatible with Vercel Function limits; an unfinished job remains queued
// for the daily recovery worker.
export async function processClassificationJobImmediately(jobId: string, requestedCount: number, maxDurationMs = 240_000) {
  const started = Date.now();
  let processed = 0;
  let completed = false;
  let batches = 0;
  while (processed < requestedCount && Date.now() - started < maxDurationMs) {
    const result = await processClassificationJob(jobId, Math.min(10, requestedCount - processed));
    processed += result.processed;
    batches += 1;
    completed = Boolean(result.completed);
    if (completed || result.processed === 0) break;
  }
  console.info("Immediate classification worker finished", { jobId, requestedCount, processed, batches, completed, durationMs: Date.now() - started });
  return { jobId, processed, completed, batches, durationMs: Date.now() - started };
}

export function trainingTextFromShop(shop: ShopRow) {
  return buildClassificationText({ name: shop.name, description: shop.shop_description, representativeMenu: shop.representative_menu, reviewSummary: shop.review_summary, website: shop.website });
}
