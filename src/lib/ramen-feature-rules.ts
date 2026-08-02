import { createHash } from "node:crypto";

export type FeatureType = "soup" | "style" | "noodle" | "topping" | "taste" | "menu";
export type FeatureRule = { keyword: string; normalizedValue: string; featureType: FeatureType; priority: number; excludeKeywords?: string[]; isActive?: boolean };
export type FeatureKeywords = Record<FeatureType, string[]>;

export const FEATURE_RULES: FeatureRule[] = [
  { keyword: "豚骨醤油", normalizedValue: "豚骨醤油", featureType: "soup", priority: 110 },
  { keyword: "家系", normalizedValue: "家系", featureType: "style", priority: 110 },
  { keyword: "汁なし担々麺", normalizedValue: "担々麺", featureType: "style", priority: 110 },
  { keyword: "鶏白湯", normalizedValue: "鶏白湯", featureType: "soup", priority: 105 },
  { keyword: "魚介豚骨", normalizedValue: "豚骨魚介", featureType: "soup", priority: 105 },
  { keyword: "豚骨魚介", normalizedValue: "豚骨魚介", featureType: "soup", priority: 105 },
  { keyword: "横浜家系", normalizedValue: "家系", featureType: "style", priority: 105 },
  { keyword: "二郎インスパイア", normalizedValue: "二郎系", featureType: "style", priority: 105 },
  { keyword: "煮干", normalizedValue: "煮干し", featureType: "soup", priority: 100 },
  { keyword: "煮干し", normalizedValue: "煮干し", featureType: "soup", priority: 100 },
  { keyword: "にぼし", normalizedValue: "煮干し", featureType: "soup", priority: 100 },
  { keyword: "ニボシ", normalizedValue: "煮干し", featureType: "soup", priority: 100 },
  { keyword: "鶏清湯", normalizedValue: "鶏清湯", featureType: "soup", priority: 100 },
  { keyword: "清湯", normalizedValue: "清湯", featureType: "taste", priority: 90 },
  { keyword: "白湯", normalizedValue: "白湯", featureType: "taste", priority: 90 },
  { keyword: "醤油", normalizedValue: "醤油", featureType: "soup", priority: 85 },
  { keyword: "塩", normalizedValue: "塩", featureType: "soup", priority: 85 },
  { keyword: "味噌", normalizedValue: "味噌", featureType: "soup", priority: 85 },
  { keyword: "豚骨", normalizedValue: "豚骨", featureType: "soup", priority: 85, excludeKeywords: ["豚骨醤油", "豚骨魚介", "魚介豚骨"] },
  { keyword: "魚介", normalizedValue: "魚介", featureType: "soup", priority: 80, excludeKeywords: ["魚介豚骨"] },
  { keyword: "貝出汁", normalizedValue: "貝出汁", featureType: "soup", priority: 80 },
  { keyword: "牛骨", normalizedValue: "牛骨", featureType: "soup", priority: 80 },
  { keyword: "海老", normalizedValue: "海老", featureType: "soup", priority: 80 },
  { keyword: "カレー", normalizedValue: "カレー", featureType: "soup", priority: 78 },
  { keyword: "辛味", normalizedValue: "辛味", featureType: "soup", priority: 72 },
  { keyword: "担々", normalizedValue: "担々麺", featureType: "style", priority: 85 },
  { keyword: "中華そば", normalizedValue: "中華そば", featureType: "style", priority: 85 },
  { keyword: "つけ麺", normalizedValue: "つけ麺", featureType: "style", priority: 90 },
  { keyword: "油そば", normalizedValue: "油そば・まぜそば", featureType: "style", priority: 90 },
  { keyword: "まぜそば", normalizedValue: "油そば・まぜそば", featureType: "style", priority: 90 },
  { keyword: "混ぜそば", normalizedValue: "油そば・まぜそば", featureType: "style", priority: 90 },
  { keyword: "博多", normalizedValue: "博多系", featureType: "style", priority: 80 },
  { keyword: "札幌", normalizedValue: "札幌系", featureType: "style", priority: 80 },
  { keyword: "喜多方", normalizedValue: "喜多方系", featureType: "style", priority: 80 },
  { keyword: "長浜", normalizedValue: "長浜系", featureType: "style", priority: 80 },
  { keyword: "ちゃん系", normalizedValue: "ちゃん系", featureType: "style", priority: 80 },
  { keyword: "昆布水つけ麺", normalizedValue: "昆布水つけ麺", featureType: "style", priority: 95 },
  { keyword: "燕三条", normalizedValue: "燕三条系", featureType: "style", priority: 80 },
  { keyword: "徳島", normalizedValue: "徳島系", featureType: "style", priority: 80 },
  { keyword: "台湾まぜそば", normalizedValue: "台湾まぜそば", featureType: "style", priority: 95 },
  { keyword: "細麺", normalizedValue: "細麺", featureType: "noodle", priority: 70 },
  { keyword: "中細麺", normalizedValue: "中細麺", featureType: "noodle", priority: 75 },
  { keyword: "中太麺", normalizedValue: "中太麺", featureType: "noodle", priority: 75 },
  { keyword: "太麺", normalizedValue: "太麺", featureType: "noodle", priority: 70 },
  { keyword: "極太麺", normalizedValue: "極太麺", featureType: "noodle", priority: 80 },
  { keyword: "平打ち", normalizedValue: "平打ち麺", featureType: "noodle", priority: 75 },
  { keyword: "縮れ", normalizedValue: "縮れ麺", featureType: "noodle", priority: 75 },
  { keyword: "ストレート", normalizedValue: "ストレート麺", featureType: "noodle", priority: 70 },
  { keyword: "低加水", normalizedValue: "低加水麺", featureType: "noodle", priority: 80 },
  { keyword: "多加水", normalizedValue: "多加水麺", featureType: "noodle", priority: 80 },
  { keyword: "自家製麺", normalizedValue: "自家製麺", featureType: "noodle", priority: 80 },
  { keyword: "チャーシュー", normalizedValue: "チャーシュー", featureType: "topping", priority: 70 },
  { keyword: "鶏チャーシュー", normalizedValue: "鶏チャーシュー", featureType: "topping", priority: 80 },
  { keyword: "低温調理", normalizedValue: "低温調理チャーシュー", featureType: "topping", priority: 85 },
  { keyword: "海苔", normalizedValue: "海苔", featureType: "topping", priority: 70 },
  { keyword: "ほうれん草", normalizedValue: "ほうれん草", featureType: "topping", priority: 70 },
  { keyword: "メンマ", normalizedValue: "メンマ", featureType: "topping", priority: 70 },
  { keyword: "味玉", normalizedValue: "味玉", featureType: "topping", priority: 70 },
  { keyword: "ネギ", normalizedValue: "ネギ", featureType: "topping", priority: 65 },
  { keyword: "玉ねぎ", normalizedValue: "玉ねぎ", featureType: "topping", priority: 70 },
  { keyword: "背脂", normalizedValue: "背脂", featureType: "topping", priority: 75 },
  { keyword: "もやし", normalizedValue: "もやし", featureType: "topping", priority: 65 },
  { keyword: "キャベツ", normalizedValue: "キャベツ", featureType: "topping", priority: 65 },
  { keyword: "ワンタン", normalizedValue: "ワンタン", featureType: "topping", priority: 75 },
  { keyword: "花椒", normalizedValue: "花椒", featureType: "topping", priority: 75 },
  { keyword: "胡麻", normalizedValue: "胡麻", featureType: "topping", priority: 65 },
  { keyword: "濃厚", normalizedValue: "濃厚", featureType: "taste", priority: 80 },
  { keyword: "淡麗", normalizedValue: "淡麗", featureType: "taste", priority: 80 },
  { keyword: "こってり", normalizedValue: "こってり", featureType: "taste", priority: 75 },
  { keyword: "あっさり", normalizedValue: "あっさり", featureType: "taste", priority: 75 },
  { keyword: "辛い", normalizedValue: "辛い", featureType: "taste", priority: 70 },
  { keyword: "ピリ辛", normalizedValue: "ピリ辛", featureType: "taste", priority: 75 },
  { keyword: "クリーミー", normalizedValue: "クリーミー", featureType: "taste", priority: 75 },
  { keyword: "甘辛", normalizedValue: "甘辛", featureType: "taste", priority: 70 },
  { keyword: "酸味", normalizedValue: "酸味", featureType: "taste", priority: 70 },
  { keyword: "清涼感", normalizedValue: "清涼感", featureType: "taste", priority: 70 },
  { keyword: "魚介強め", normalizedValue: "魚介強め", featureType: "taste", priority: 75 },
  { keyword: "煮干し強め", normalizedValue: "煮干し強め", featureType: "taste", priority: 75 },
  { keyword: "豚骨臭控えめ", normalizedValue: "豚骨臭控えめ", featureType: "taste", priority: 75 },
  { keyword: "特製ラーメン", normalizedValue: "特製ラーメン", featureType: "menu", priority: 80 },
  { keyword: "濃厚煮干しそば", normalizedValue: "濃厚煮干しそば", featureType: "menu", priority: 90 },
  { keyword: "豚骨醤油ラーメン", normalizedValue: "豚骨醤油ラーメン", featureType: "menu", priority: 90 },
  { keyword: "塩そば", normalizedValue: "塩そば", featureType: "menu", priority: 80 },
  { keyword: "つけ麺", normalizedValue: "つけ麺", featureType: "menu", priority: 80 },
  { keyword: "汁なし担々麺", normalizedValue: "汁なし担々麺", featureType: "menu", priority: 90 },
];

function normalize(value: unknown) {
  return (Array.isArray(value) ? value.join(" ") : typeof value === "string" ? value : "").normalize("NFKC").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function buildFeatureSourceText(input: { name?: unknown; description?: unknown; menu?: unknown; reviewSummary?: unknown; genres?: unknown; address?: unknown; officialUrl?: unknown; mapsUri?: unknown }) {
  return [input.name, input.description, input.menu, input.reviewSummary, input.genres, input.address, input.officialUrl, input.mapsUri].map(normalize).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export function featureSourceHash(sourceText: string) {
  return createHash("sha256").update(sourceText, "utf8").digest("hex");
}

export function extractFeatureKeywords(sourceText: string): FeatureKeywords {
  const text = normalize(sourceText).toLowerCase();
  const result: FeatureKeywords = { soup: [], style: [], noodle: [], topping: [], taste: [], menu: [] };
  const sorted = FEATURE_RULES.filter((rule) => rule.isActive !== false).sort((a, b) => b.priority - a.priority);
  for (const rule of sorted) {
    if (!text.includes(normalize(rule.keyword).toLowerCase())) continue;
    if (rule.excludeKeywords?.some((keyword) => text.includes(normalize(keyword).toLowerCase()))) continue;
    if (!result[rule.featureType].includes(rule.normalizedValue)) result[rule.featureType].push(rule.normalizedValue);
  }
  return result;
}

export function buildFeatureText(name: string, sourceText: string, keywords: FeatureKeywords, representativeMenu?: string | null) {
  const parts = [name, representativeMenu, ...keywords.menu, ...keywords.soup, ...keywords.style, ...keywords.noodle, ...keywords.topping, ...keywords.taste];
  const seen = new Set<string>();
  return parts.map(normalize).filter((part) => { if (!part || seen.has(part)) return false; seen.add(part); return true; }).join(" ").replace(/\s+/g, " ").trim() || normalize(sourceText);
}

export function featureConfidence(sourceText: string, keywords: FeatureKeywords) {
  const sourceParts = sourceText.trim().split(/\s+/).filter(Boolean).length;
  const groups = Object.values(keywords).filter((values) => values.length).length;
  if (sourceParts <= 1 && groups === 0) return 0.4;
  if (groups >= 2 || sourceParts >= 8) return 0.85;
  if (groups >= 1) return 0.65;
  return 0.4;
}
