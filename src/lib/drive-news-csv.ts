import { createHash } from "node:crypto";
import type { WebRamenMentionWithShop } from "@/types/web-ramen";

type CsvRow = Record<string, string>;

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell.length === 0) quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  const headers = (rows.shift() ?? []).map((header) => header.replace(/^\uFEFF/, "").trim());
  return rows.filter((values) => values.some(Boolean)).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""])));
}

function firstDate(value: string) {
  const match = value.match(/\d{4}-\d{2}-\d{2}/);
  return match ? `${match[0]}T00:00:00.000Z` : null;
}

function certaintyScore(value: string) { return value === "high" ? 90 : value === "medium" ? 70 : 50; }

export async function loadDriveNewsCsv(): Promise<WebRamenMentionWithShop[]> {
  const configuredUrl = process.env.GOOGLE_DRIVE_NEWS_CSV_URL?.trim();
  const fileId = process.env.GOOGLE_DRIVE_NEWS_FILE_ID?.trim();
  const url = configuredUrl || (fileId ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}` : "");
  if (!url) return [];
  try {
    const response = await fetch(url, { next: { revalidate: 300 } });
    if (!response.ok) throw new Error(`Drive CSV request failed (${response.status})`);
    const rows = parseCsv(await response.text());
    return rows.map((row, index) => {
      const name = row["店名"] || "東京ラーメン情報";
      const title = row["区分"] ? `${name}｜${row["区分"]}` : name;
      const sourceUrl = (row["根拠URL"] ?? "").split("|").map((item) => item.trim()).find((item) => item.startsWith("http")) ?? url;
      const publishedAt = firstDate(row["情報日"] ?? "");
      const stableKey = `${row["順位"]}|${name}|${row["情報日"]}|${sourceUrl}|${index}`;
      return {
        mention_id: `drive-csv-${createHash("sha1").update(stableKey).digest("hex")}`,
        shop_id: null,
        source_name: row["情報源種別"] || "Google Drive CSV",
        title,
        summary: [row["急上昇理由"], row["根拠要約"]].filter(Boolean).join(" "),
        source_url: sourceUrl,
        published_at: publishedAt,
        matched_area: row["エリア"] || null,
        matched_keyword: "ラーメン",
        matched_alias: null,
        tokyo_confidence: row["確信度"] === "high" ? 1 : row["確信度"] === "medium" ? 0.8 : 0.6,
        ramen_relevance: 1,
        source_score: certaintyScore(row["確信度"] ?? ""),
        ranking_score: Math.max(0, 100 - Number(row["順位"] || 99)),
        is_visible: true,
        exclusion_reason: null,
        ramen_shops: null,
      } satisfies WebRamenMentionWithShop;
    });
  } catch (error) {
    console.warn("Drive news CSV could not be loaded", error);
    return [];
  }
}
