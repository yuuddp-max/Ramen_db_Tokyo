import { createHash } from "node:crypto";

export const SOUP_CATEGORIES = ["醤油", "塩", "味噌", "豚骨", "豚骨醤油", "豚骨魚介", "鶏白湯", "煮干し", "魚介", "その他", "不明"] as const;
export const STYLE_CATEGORIES = ["中華そば", "家系", "二郎系", "つけ麺", "油そば・まぜそば", "担々麺", "博多系", "札幌系", "淡麗系", "濃厚系", "その他", "不明"] as const;
export type SoupCategory = (typeof SOUP_CATEGORIES)[number];
export type StyleCategory = (typeof STYLE_CATEGORIES)[number];
export type ClassificationMethod = "rule" | "local-model" | "generative-ai" | "manual";
export type ClassificationStatus = "pending" | "processing" | "auto-approved" | "needs-review" | "manually-approved" | "error";

export type ClassificationInput = {
  name: string;
  description?: string | null;
  representativeMenu?: string | null;
  reviewSummary?: string | null;
  website?: string | null;
};

export type KeywordRule<T extends string> = {
  category: T;
  keywords: string[];
  excludeKeywords: string[];
  priority: number;
  score: number;
};

export type CategoryResult<T extends string> = { category: T; confidence: number; matchedRules: string[] };
export type LocalModelResult = { soup: CategoryResult<SoupCategory>; style: CategoryResult<StyleCategory>; model: string };

const soupRules: KeywordRule<SoupCategory>[] = [
  { category: "豚骨醤油", keywords: ["豚骨醤油", "豚骨しょうゆ", "横浜家系", "家系ラーメン"], excludeKeywords: [], priority: 100, score: 0.98 },
  { category: "豚骨魚介", keywords: ["豚骨魚介", "魚介豚骨", "とんこつ魚介", "豚骨つけ麺"], excludeKeywords: [], priority: 98, score: 0.96 },
  { category: "鶏白湯", keywords: ["鶏白湯", "鳥白湯", "鶏ぱいたん"], excludeKeywords: [], priority: 95, score: 0.97 },
  { category: "煮干し", keywords: ["煮干し", "煮干", "にぼし"], excludeKeywords: ["煮干し粉のみ"], priority: 90, score: 0.96 },
  { category: "豚骨", keywords: ["豚骨", "とんこつ"], excludeKeywords: ["豚骨醤油", "豚骨しょうゆ", "豚骨魚介", "魚介豚骨"], priority: 80, score: 0.93 },
  { category: "味噌", keywords: ["味噌", "みそ"], excludeKeywords: ["味噌漬け"], priority: 75, score: 0.92 },
  { category: "塩", keywords: ["塩ラーメン", "塩らーめん", "塩そば", "塩味"], excludeKeywords: [], priority: 70, score: 0.91 },
  { category: "醤油", keywords: ["醤油ラーメン", "醤油らーめん", "醤油そば", "しょうゆラーメン"], excludeKeywords: ["豚骨醤油", "豚骨しょうゆ"], priority: 65, score: 0.90 },
  { category: "魚介", keywords: ["魚介", "魚介豚骨", "節系", "魚粉", "鰹", "かつお"], excludeKeywords: ["煮干し"], priority: 60, score: 0.88 },
];

const styleRules: KeywordRule<StyleCategory>[] = [
  { category: "家系", keywords: ["家系", "横浜家系"], excludeKeywords: [], priority: 100, score: 0.99 },
  { category: "二郎系", keywords: ["二郎系", "二郎インスパイア", "二郎系インスパイア"], excludeKeywords: [], priority: 95, score: 0.98 },
  { category: "油そば・まぜそば", keywords: ["油そば", "まぜそば", "混ぜそば", "汁なし"], excludeKeywords: ["つけそば"], priority: 90, score: 0.97 },
  { category: "つけ麺", keywords: ["つけ麺", "つけめん", "つけそば"], excludeKeywords: [], priority: 85, score: 0.96 },
  { category: "担々麺", keywords: ["担々麺", "担担麺", "担々"], excludeKeywords: [], priority: 80, score: 0.95 },
  { category: "博多系", keywords: ["博多ラーメン", "博多豚骨", "長浜ラーメン", "長浜屋台"], excludeKeywords: [], priority: 75, score: 0.93 },
  { category: "札幌系", keywords: ["札幌ラーメン", "札幌味噌", "札幌みそ"], excludeKeywords: [], priority: 70, score: 0.93 },
  { category: "中華そば", keywords: ["中華そば", "支那そば"], excludeKeywords: [], priority: 65, score: 0.90 },
  { category: "淡麗系", keywords: ["淡麗", "清湯", "あっさり"], excludeKeywords: ["濃厚"], priority: 60, score: 0.88 },
  { category: "濃厚系", keywords: ["濃厚", "こってり", "濃いめ"], excludeKeywords: ["淡麗"], priority: 55, score: 0.88 },
];

function normalize(text: string) {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ");
}

export function buildClassificationText(input: ClassificationInput) {
  return [input.name, input.description, input.representativeMenu, input.reviewSummary]
    .filter((value): value is string => Boolean(value?.trim()))
    .join("\n")
    .trim();
}

export function buildTrainingClassificationText(input: ClassificationInput) {
  return [input.name, input.description, input.representativeMenu, input.reviewSummary]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classificationSourceHash(classificationText: string) {
  return createHash("sha256").update(classificationText, "utf8").digest("hex");
}

function evaluateRules<T extends string>(text: string, rules: KeywordRule<T>[], unknown: T): CategoryResult<T> {
  const normalized = normalize(text);
  const matches = rules.flatMap((rule) => {
    if (rule.excludeKeywords.some((keyword) => normalized.includes(normalize(keyword)))) return [];
    const matched = rule.keywords.filter((keyword) => normalized.includes(normalize(keyword)));
    if (!matched.length) return [];
    return [{ rule, matched }];
  });
  if (!matches.length) return { category: unknown, confidence: 0, matchedRules: [] };
  matches.sort((a, b) => b.rule.priority - a.rule.priority || b.rule.score - a.rule.score || b.matched.length - a.matched.length);
  const winner = matches[0];
  return { category: winner.rule.category, confidence: Math.min(0.99, winner.rule.score + Math.min(0.02, (winner.matched.length - 1) * 0.01)), matchedRules: winner.matched };
}

export function classifyWithRules(classificationText: string) {
  return {
    soup: evaluateRules(classificationText, soupRules, "不明"),
    style: evaluateRules(classificationText, styleRules, "不明"),
  };
}

export interface LocalClassificationModel {
  classify(input: { classificationText: string; ruleResult: ReturnType<typeof classifyWithRules> }): Promise<LocalModelResult>;
}

/** Replace this adapter with an ONNX/HTTP local model without changing the pipeline. */
export class MockLocalClassificationModel implements LocalClassificationModel {
  async classify({ ruleResult }: { classificationText: string; ruleResult: ReturnType<typeof classifyWithRules> }): Promise<LocalModelResult> {
    const soften = <T extends string>(result: CategoryResult<T>, unknown: T): CategoryResult<T> => result.category === unknown
      ? { category: unknown, confidence: 0.35, matchedRules: [] }
      : { ...result, confidence: Math.max(0.5, Math.min(0.79, result.confidence - 0.14)) };
    return { soup: soften(ruleResult.soup, "不明"), style: soften(ruleResult.style, "不明"), model: "mock-local-v1" };
  }
}

type ResponsePayload = { error?: { message?: string }; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };

export async function classifyWithGenerativeAI(classificationText: string): Promise<LocalModelResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  const started = Date.now();
  const schema = { type: "object", additionalProperties: false, required: ["soupCategory", "styleCategory", "soupConfidence", "styleConfidence"], properties: {
    soupCategory: { type: "string", enum: SOUP_CATEGORIES }, styleCategory: { type: "string", enum: STYLE_CATEGORIES },
    soupConfidence: { type: "number", minimum: 0, maximum: 1 }, styleConfidence: { type: "number", minimum: 0, maximum: 1 },
  } };
  const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({
    model: process.env.OPENAI_LOW_COST_RESEARCH_MODEL || "gpt-5.4-nano", reasoning: { effort: "low" },
    input: ["次のラーメン店情報だけを使い、指定カテゴリで分類してください。推測は禁止です。不明なら不明を選んで低い確信度にしてください。", classificationText].join("\n\n"),
    text: { verbosity: "low", format: { type: "json_schema", name: "ramen_local_fallback", strict: true, schema } },
  }) });
  const payload = await response.json().catch(() => null) as ResponsePayload | null;
  if (!response.ok) throw new Error(payload?.error?.message ?? `OpenAI API request failed (${response.status}).`);
  const text = payload?.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
  if (!text) throw new Error("OpenAI API returned no structured classification result.");
  const result = JSON.parse(text) as Record<string, unknown>;
  if (!SOUP_CATEGORIES.includes(result.soupCategory as SoupCategory) || !STYLE_CATEGORIES.includes(result.styleCategory as StyleCategory) || typeof result.soupConfidence !== "number" || typeof result.styleConfidence !== "number") throw new Error("OpenAI API result did not match the classification schema.");
  console.info("Generative classification completed", { durationMs: Date.now() - started });
  return { soup: { category: result.soupCategory as SoupCategory, confidence: result.soupConfidence as number, matchedRules: [] }, style: { category: result.styleCategory as StyleCategory, confidence: result.styleConfidence as number, matchedRules: [] }, model: "openai-fallback" };
}

export const classificationRules = { soupRules, styleRules };
