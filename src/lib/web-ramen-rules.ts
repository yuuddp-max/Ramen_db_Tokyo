import { createHash } from "crypto";

export type ShopCandidate = { id: string; name: string; address: string | null; nearest_station: string | null };
export type ShopAlias = { shop_id: string; alias_name: string };

export const TOKYO_AREAS = ["千代田区", "中央区", "港区", "新宿区", "文京区", "台東区", "墨田区", "江東区", "品川区", "目黒区", "大田区", "世田谷区", "渋谷区", "中野区", "杉並区", "豊島区", "北区", "荒川区", "板橋区", "練馬区", "足立区", "葛飾区", "江戸川区", "八王子市", "立川市", "武蔵野市", "三鷹市", "青梅市", "府中市", "昭島市", "調布市", "町田市", "小金井市", "小平市", "日野市", "東村山市", "国分寺市", "国立市", "福生市", "狛江市", "東大和市", "清瀬市", "東久留米市", "武蔵村山市", "多摩市", "稲城市", "西東京市", "神保町", "新宿", "渋谷", "池袋", "高田馬場", "中野", "荻窪", "吉祥寺", "恵比寿", "上野", "浅草", "秋葉原", "銀座", "町田", "立川", "八王子"];
const RAMEN_TERMS = ["ラーメン", "らーめん", "中華そば", "つけ麺", "つけめん", "油そば", "まぜそば"];
const EXCLUSION_TERMS = ["カップ麺", "カップラーメン", "カップヌードル", "インスタント麺", "即席麺", "袋麺", "冷凍ラーメン", "自宅ラーメン", "おうちラーメン"];

export function normalizeMatchText(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ja-JP").replace(/[\s　・･、,，.．!！?？'"“”()（）\[\]【】「」『』]/g, "");
}

export function mentionId(sourceUrl: string) {
  return createHash("sha256").update(sourceUrl.trim()).digest("hex");
}

export function classifyWebMention(text: string, shops: ShopCandidate[], aliases: ShopAlias[]) {
  const normalized = normalizeMatchText(text);
  const candidates = [
    ...shops.map((shop) => ({ shop, value: shop.name, alias: null as string | null, confidence: 1 })),
    ...aliases.map((alias) => ({ shop: shops.find((shop) => shop.id === alias.shop_id), value: alias.alias_name, alias: alias.alias_name, confidence: 0.95 })),
  ].filter((item): item is { shop: ShopCandidate; value: string; alias: string | null; confidence: number } => Boolean(item.shop));
  candidates.sort((a, b) => normalizeMatchText(b.value).length - normalizeMatchText(a.value).length);
  const matched = candidates.find((item) => normalizeMatchText(item.value).length >= 3 && normalized.includes(normalizeMatchText(item.value)));
  const area = TOKYO_AREAS.find((item) => text.includes(item)) ?? shops.map((shop) => shop.nearest_station).find((station) => Boolean(station && station.length >= 2 && text.includes(station))) ?? null;
  const keyword = RAMEN_TERMS.find((item) => text.includes(item)) ?? null;
  const exclusion = EXCLUSION_TERMS.find((item) => text.includes(item)) ?? null;
  const relevance = matched || keyword ? (matched ? 1 : 0.85) : 0;
  const confidence = matched ? matched.confidence : area ? 0.7 : 0;
  return { shopId: matched?.shop.id ?? null, matchedArea: matched ? null : area, matchedKeyword: keyword ?? matched?.value ?? null, matchedAlias: matched?.alias ?? null, tokyoConfidence: confidence, ramenRelevance: relevance, exclusionReason: exclusion && !matched ? `excluded:${exclusion}` : !relevance ? "not_ramen_related" : !confidence ? "not_tokyo_related" : null };
}

export function calculateWebRankingScore(sourceScore: number, publishedAt: string | null, now = new Date()) {
  const ageHours = publishedAt ? Math.max((now.getTime() - new Date(publishedAt).getTime()) / 3_600_000, 0) : 168;
  return Math.max(0, sourceScore) / Math.pow(Math.max(ageHours, 6), 0.5);
}
