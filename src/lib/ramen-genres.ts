export type RamenGenreOption = { label: string; keywords: string[] };

export const RAMEN_SOUPS: RamenGenreOption[] = [
  { label: "醤油", keywords: ["醤油", "しょうゆ"] },
  { label: "塩", keywords: ["塩らーめん", "塩ラーメン", "塩そば", "塩"] },
  { label: "味噌", keywords: ["味噌", "みそ"] },
  { label: "豚骨", keywords: ["豚骨", "とんこつ"] },
  { label: "豚骨醤油", keywords: ["豚骨醤油", "豚骨しょうゆ", "豚醤", "家系"] },
  { label: "豚骨魚介", keywords: ["豚骨魚介", "魚介豚骨", "とんこつ魚介"] },
  { label: "鶏白湯", keywords: ["鶏白湯", "鳥白湯", "鶏ぱいたん"] },
  { label: "魚介", keywords: ["魚介", "節系", "魚粉"] },
  { label: "煮干し", keywords: ["煮干", "にぼし"] },
  { label: "貝出汁", keywords: ["貝出汁", "貝だし", "しじみ", "あさり", "蛤"] },
  { label: "海老", keywords: ["海老", "えび", "エビ"] },
  { label: "牛骨", keywords: ["牛骨"] },
  { label: "担々麺", keywords: ["担々", "担担", "坦々", "坦坦"] },
  { label: "カレー", keywords: ["カレー"] },
  { label: "その他", keywords: [] },
];

export const RAMEN_STYLES: RamenGenreOption[] = [
  { label: "中華そば", keywords: ["東京中華そば", "東京ラーメン", "中華そば"] },
  { label: "家系", keywords: ["家系"] },
  { label: "二郎系", keywords: ["二郎系", "二郎"] },
  { label: "二郎インスパイア", keywords: ["二郎インスパイア", "二郎インスパ", "インスパイア"] },
  { label: "大勝軒系", keywords: ["大勝軒"] },
  { label: "つけ麺", keywords: ["つけ麺", "つけめん"] },
  { label: "油そば", keywords: ["油そば"] },
  { label: "まぜそば", keywords: ["まぜそば", "混ぜそば", "まぜ麺"] },
  { label: "淡麗系", keywords: ["淡麗"] },
  { label: "濃厚系", keywords: ["濃厚"] },
  { label: "背脂系", keywords: ["背脂"] },
  { label: "昆布水つけ麺", keywords: ["昆布水"] },
  { label: "ちゃんぽん", keywords: ["ちゃんぽん", "チャンポン"] },
];

function findGenre(name: string, options: RamenGenreOption[]) {
  return options.find((option) => option.keywords.some((keyword) => name.includes(keyword)))?.label ?? "その他";
}

export function classifyRamen(name: string) {
  // More specific variants must win over their generic counterparts.
  const soupOrder = [RAMEN_SOUPS[4], RAMEN_SOUPS[5], RAMEN_SOUPS[6], ...RAMEN_SOUPS.filter((option, index) => index !== 4 && index !== 5 && index !== 6)];
  const styleOrder = [RAMEN_STYLES[3], ...RAMEN_STYLES.filter((_, index) => index !== 3)];
  return { soup: findGenre(name, soupOrder), style: findGenre(name, styleOrder) };
}

export function matchesRamenTaxonomy(name: string, soup: string, style: string) {
  const classification = classifyRamen(name);
  return (!soup || classification.soup === soup) && (!style || classification.style === style);
}
