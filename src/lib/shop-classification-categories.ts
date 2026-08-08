/** Shared classification labels. Keep this module free of Node-only imports. */
export const SOUP_CATEGORIES = ["醤油", "塩", "味噌", "豚骨", "豚骨醤油", "豚骨魚介", "鶏白湯", "煮干し", "魚介", "貝出汁", "担々麺", "牛骨", "その他", "不明"] as const;
export const STYLE_CATEGORIES = ["中華そば", "家系", "二郎系", "二郎インスパイア", "つけ麺", "油そば・まぜそば", "博多系", "札幌系", "淡麗系", "濃厚系", "背脂系", "ちゃんぽん", "その他", "不明"] as const;
export type SoupCategory = (typeof SOUP_CATEGORIES)[number];
export type StyleCategory = (typeof STYLE_CATEGORIES)[number];
