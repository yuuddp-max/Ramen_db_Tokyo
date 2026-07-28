import type { WebRamenMention } from "@/types/web-ramen";

export type WebResearchCandidate = Pick<WebRamenMention, "source_name" | "title" | "summary" | "source_url" | "published_at" | "source_score" | "matched_area">;
export type WebRamenResearchClient = { searchRecentMentions(): Promise<{ mentions: WebResearchCandidate[]; status: number }> };

type ResponsesPayload = { output?: Array<{ content?: Array<{ type?: string; text?: string }> }>; error?: { message?: string } };

function outputText(payload: ResponsesPayload) {
  return payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
}

function validateMentions(value: unknown): WebResearchCandidate[] {
  const items = (value && typeof value === "object" && Array.isArray((value as { mentions?: unknown }).mentions)) ? (value as { mentions: unknown[] }).mentions : [];
  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.source_name !== "string" || typeof row.title !== "string" || typeof row.summary !== "string" || typeof row.source_url !== "string") return [];
    try { const url = new URL(row.source_url); if (url.protocol !== "https:") return []; } catch { return []; }
    return [{ source_name: row.source_name.slice(0, 120), title: row.title.slice(0, 240), summary: row.summary.slice(0, 500), source_url: row.source_url, published_at: typeof row.published_at === "string" ? row.published_at : null, source_score: Math.max(0, Math.min(100, Number(row.source_score) || 0)), matched_area: typeof row.matched_area === "string" ? row.matched_area.slice(0, 80) : null }];
  });
}

export function createWebRamenResearchClient(): WebRamenResearchClient {
  return {
    async searchRecentMentions() {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
      const now = new Date();
      const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OPENAI_LOW_COST_RESEARCH_MODEL || "gpt-5.4-nano",
          input: `あなたは東京ラーメンのWeb調査担当です。現在時刻は${now.toISOString()}です。Web検索を使い、過去7日間（${since}以降）の東京のラーメン情報を調査してください。値引き、限定メニュー、テレビ・ニュース掲載、行列、SNSで話題になっている可能性がある店舗を優先し、急上昇候補を最大10店選んでください。各候補について、店名、エリア、急上昇理由、情報の日付、根拠（直接URL）をまとめてください。Xの投稿は検索・採用しないでください。カップ麺、インスタント麺、自宅調理、東京以外の記事、ラーメンと無関係なページは除外してください。同じURLは1件だけにしてください。本文の長い転載はせず、summaryは80〜500文字の要約にしてください。source_scoreは新しさ、東京との関連、話題性、店舗情報の具体性、信頼できる一次情報を0〜100で評価してください。published_atが確認できない場合はnullにしてください。URLはHTTPSの直接URLのみ返してください。`,
          tools: [{ type: "web_search", search_context_size: "low" }],
          max_tool_calls: 4,
          reasoning: { effort: "low" },
          text: { verbosity: "low", format: { type: "json_schema", name: "web_ramen_mentions", strict: true, schema: { type: "object", additionalProperties: false, required: ["mentions"], properties: { mentions: { type: "array", maxItems: 10, items: { type: "object", additionalProperties: false, required: ["source_name", "title", "summary", "source_url", "published_at", "source_score", "matched_area"], properties: { source_name: { type: "string" }, title: { type: "string" }, summary: { type: "string" }, source_url: { type: "string" }, published_at: { type: ["string", "null"] }, source_score: { type: "number" }, matched_area: { type: ["string", "null"] } } } } } } } },
        }),
      });
      const payload = await response.json().catch(() => null) as ResponsesPayload | null;
      if (!response.ok || !payload) throw new Error("Web research request failed.");
      const text = outputText(payload);
      if (!text) return { mentions: [], status: response.status };
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { throw new Error("Web research returned invalid structured data."); }
      return { mentions: validateMentions(parsed), status: response.status };
    },
  };
}
