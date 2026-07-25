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
  return status === "OPERATIONAL" ? "営業登録あり" : status.replaceAll("_", " ");
}

const ramenStyles = ["二郎系", "家系", "つけ麺", "油そば", "まぜそば", "豚骨", "味噌", "塩", "醤油"];

export function inferRamenStyle(name: string) {
  return ramenStyles.find((style) => name.includes(style)) ?? "ラーメン";
}

function normalizeOpeningHours(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string") {
    try { return normalizeOpeningHours(JSON.parse(value)); } catch { return value ? [value] : []; }
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return normalizeOpeningHours(record.weekdayDescriptions ?? record.weekday_descriptions ?? record.weekday_text);
  }
  return [];
}

export function getCurrentOpenStatus(openingHours: unknown) {
  const hours = normalizeOpeningHours(openingHours);
  if (!hours.length) return { label: "営業時間不明", open: false, known: false };
  const now = new Date();
  const weekday = new Intl.DateTimeFormat("ja-JP", { weekday: "long", timeZone: "Asia/Tokyo" }).format(now);
  const today = hours.find((entry) => entry.startsWith(weekday));
  if (!today) return { label: "営業時間不明", open: false, known: false };
  if (/休業|定休日|Closed/i.test(today)) return { label: "営業時間外", open: false, known: true };

  const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Tokyo" }).formatToParts(now);
  const minuteOfDay = Number(parts.find((part) => part.type === "hour")?.value ?? 0) * 60 + Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const periods = [...today.matchAll(/(\d{1,2}):(\d{2})\s*[–〜-]\s*(\d{1,2}):(\d{2})/g)];
  if (!periods.length) return { label: "営業時間不明", open: false, known: false };
  const open = periods.some((match) => {
    const start = Number(match[1]) * 60 + Number(match[2]);
    let end = Number(match[3]) * 60 + Number(match[4]);
    if (end <= start) end += 24 * 60;
    const current = minuteOfDay < start ? minuteOfDay + 24 * 60 : minuteOfDay;
    return current >= start && current < end;
  });
  return { label: open ? "営業中" : "営業時間外", open, known: true };
}
