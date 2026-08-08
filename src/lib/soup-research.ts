const SOUP_TYPES = ["醤油", "塩", "味噌", "豚骨", "豚骨醤油", "豚骨魚介", "鶏白湯", "魚介", "煮干し", "貝出汁", "海老", "牛骨", "担々麺", "カレー", "複数", "未確認"] as const;
const STYLES = ["東京中華そば", "家系", "二郎系", "二郎インスパイア", "大勝軒系", "つけ麺", "油そば", "まぜそば", "淡麗系", "濃厚系", "背脂系", "昆布水つけ麺", "冷やしラーメン", "未確認"] as const;
const CONFIDENCE = ["high", "medium", "low"] as const;

export type SoupResearch = {
  soupType: (typeof SOUP_TYPES)[number];
  style: string;
  confidence: (typeof CONFIDENCE)[number];
  evidenceUrl: string;
  evidenceSummary: string;
};

type ResearchInput = { name: string; address: string | null; website: string | null };

const LOW_COST_RESEARCH_MODEL = process.env.OPENAI_LOW_COST_RESEARCH_MODEL || "gpt-5.4-nano";
const MAX_WEBSITE_TEXT_LENGTH = 12_000;

type ResponsesApiPayload = {
  status?: string;
  error?: { message?: string };
  incomplete_details?: { reason?: string } | null;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

const researchSchema = {
  type: "object",
  additionalProperties: false,
  required: ["soupType", "style", "confidence", "evidenceUrl", "evidenceSummary"],
  properties: {
    soupType: { type: "string", enum: SOUP_TYPES },
    style: { type: "string", enum: STYLES },
    confidence: { type: "string", enum: CONFIDENCE },
    evidenceUrl: { type: "string" },
    evidenceSummary: { type: "string" },
  },
};

function validateResearch(value: unknown): SoupResearch {
  if (!value || typeof value !== "object") throw new Error("AI research response is not an object.");
  const record = value as Record<string, unknown>;
  if (
    typeof record.soupType !== "string" || !SOUP_TYPES.includes(record.soupType as SoupResearch["soupType"]) ||
    typeof record.style !== "string" || !STYLES.includes(record.style as (typeof STYLES)[number]) ||
    typeof record.confidence !== "string" || !CONFIDENCE.includes(record.confidence as SoupResearch["confidence"]) ||
    typeof record.evidenceUrl !== "string" ||
    typeof record.evidenceSummary !== "string" || record.evidenceSummary.length > 280
  ) throw new Error("AI research response did not match the required schema.");

  let evidenceUrl: URL;
  try { evidenceUrl = new URL(record.evidenceUrl); } catch { throw new Error("AI research response did not include a valid evidence URL."); }
  if (evidenceUrl.protocol !== "https:") throw new Error("Evidence URL must use HTTPS.");
  return {
    soupType: record.soupType as SoupResearch["soupType"],
    style: record.style.trim(),
    confidence: record.confidence as SoupResearch["confidence"],
    evidenceUrl: evidenceUrl.toString(),
    evidenceSummary: record.evidenceSummary.trim(),
  };
}

function getOutputText(payload: ResponsesApiPayload) {
  return payload.output
    ?.flatMap((item) => item.content ?? [])
    .find((content) => content.type === "output_text")
    ?.text;
}

async function requestResearch(prompt: string, options: { model: string; useWebSearch: boolean }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: options.model,
      input: prompt,
      ...(options.useWebSearch ? { tools: [{ type: "web_search", search_context_size: "low" }], max_tool_calls: 1 } : {}),
      reasoning: { effort: "low" },
      text: { verbosity: "low", format: { type: "json_schema", name: "ramen_soup_research", strict: true, schema: researchSchema } },
    }),
  });
  const payload = await response.json().catch(() => null) as ResponsesApiPayload | null;
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI API request failed (${response.status}).`);
  if (!payload) throw new Error("OpenAI API returned an invalid response.");
  const outputText = getOutputText(payload);
  if (!outputText) {
    const reason = payload.incomplete_details?.reason ? ` (${payload.incomplete_details.reason})` : "";
    throw new Error(`OpenAI API returned no structured research result: ${payload.status ?? "unknown"}${reason}.`);
  }
  try { return validateResearch(JSON.parse(outputText)); } catch (error) { throw new Error(error instanceof Error ? error.message : "Could not parse AI research result."); }
}

function cleanWebsiteText(html: string) {
  return html
    .replace(/<!--[^]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg)[^>]*>[^]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_WEBSITE_TEXT_LENGTH);
}

async function getOfficialWebsiteContent(website: string | null) {
  if (!website) return null;
  let url: URL;
  try { url = new URL(website); } catch { return null; }
  if (url.protocol !== "https:") return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "TokyoRamenResearchBot/1.0 (+https://ramen-db-tokyo-blush.vercel.app)" },
    });
    const contentType = response.headers.get("content-type") ?? "";
    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (!response.ok || !contentType.includes("text/html") || contentLength > 1_000_000) return null;
    const text = cleanWebsiteText(await response.text());
    return text.length >= 160 ? { url: url.toString(), text } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function researchSoupFromOfficialWebsite(input: ResearchInput): Promise<SoupResearch | null> {
  const website = await getOfficialWebsiteContent(input.website);
  if (!website) return null;
  const prompt = [
    "東京都のラーメン店について、下記の公式サイト本文だけを根拠にスープ系統とスタイルを分類してください。",
    "本文に明記されていないことを推測してはいけません。根拠が十分でなければ soupType を「未確認」、confidence を「low」にしてください。",
    "スープ系統とスタイルは、指定された選択肢だけを使います。複数の主力スープを確認できるときだけ「複数」にしてください。",
    "evidenceUrl には必ず次の公式URLをそのまま入れてください。",
    "style と evidenceSummary は日本語で簡潔に書いてください。",
    `店名: ${input.name}`,
    `住所: ${input.address ?? "不明"}`,
    `公式URL: ${website.url}`,
    `公式サイト本文: ${website.text}`,
  ].join("\n");
  try { return await requestResearch(prompt, { model: LOW_COST_RESEARCH_MODEL, useWebSearch: false }); }
  catch { return null; }
}

export async function researchSoup(input: ResearchInput): Promise<SoupResearch> {
  const prompt = [
    "東京都のラーメン店について、簡易Web調査でスープ系統とスタイルを分類してください。",
    "最初に公式店舗サイト・公式メニュー・公式SNSを確認し、見つからない場合だけ信頼できる紹介記事を1件確認してください。長い比較や追加調査はしません。",
    "憶測は禁止です。根拠が十分でなければ soupType を「未確認」、confidence を「low」にしてください。",
    "スープ系統とスタイルは、指定された選択肢だけを使います。複数の主力スープを確認できるときだけ「複数」にしてください。",
    "evidenceUrl には、結論を確認できるHTTPSの直接URLを1つだけ入れてください。",
    "style と evidenceSummary は日本語で簡潔に書いてください。",
    `店名: ${input.name}`,
    `住所: ${input.address ?? "不明"}`,
    `公式サイト候補: ${input.website ?? "不明"}`,
  ].join("\n");
  return requestResearch(prompt, { model: LOW_COST_RESEARCH_MODEL, useWebSearch: true });
}
