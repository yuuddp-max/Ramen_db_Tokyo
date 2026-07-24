export function formatPriceLevel(level: string | null) {
  if (!level) return "価格情報なし";
  const map: Record<string, string> = {
    PRICE_LEVEL_FREE: "無料",
    PRICE_LEVEL_INEXPENSIVE: "¥",
    PRICE_LEVEL_MODERATE: "¥¥",
    PRICE_LEVEL_EXPENSIVE: "¥¥¥",
    PRICE_LEVEL_VERY_EXPENSIVE: "¥¥¥¥",
  };
  return map[level] ?? level.replace("PRICE_LEVEL_", "");
}

export function formatStatus(status: string | null) {
  if (!status) return "営業状況不明";
  return status === "OPERATIONAL" ? "営業中" : status.replaceAll("_", " ");
}
