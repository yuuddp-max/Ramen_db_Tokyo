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

export function inferRamenStyle(name: string) {
  return classifyRamen(name).style;
}

export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6_371_000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function normalizeOpeningTimeText(value: string) {
  return value.replace(/(\d{1,2})時(?:\s*(\d{1,2})分)?/g, (_match, hour: string, minute?: string) => `${hour}:${minute ?? "00"}`);
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

export function getTodayOpeningHours(openingHours: unknown) {
  const hours = normalizeOpeningHours(openingHours);
  if (!hours.length) return null;
  const weekday = new Intl.DateTimeFormat("ja-JP", { weekday: "long", timeZone: "Asia/Tokyo" }).format(new Date());
  const description = hours.find((entry) => entry.startsWith(weekday)) ?? hours[0];
  if (/24\s*時間営業|24\s*hours?/i.test(description)) return { description, opensAt: "00:00", closesAt: "24:00" };
  const match = normalizeOpeningTimeText(description).match(/(\d{1,2}:\d{2})\s*[–〜～-]\s*(\d{1,2}:\d{2})/);
  return { description, opensAt: match?.[1] ?? null, closesAt: match?.[2] ?? null };
}

export function getCurrentOpenStatus(openingHours: unknown) {
  const hours = normalizeOpeningHours(openingHours);
  if (!hours.length) return { label: "営業時間不明", open: false, known: false };
  const now = new Date();
  const weekday = new Intl.DateTimeFormat("ja-JP", { weekday: "long", timeZone: "Asia/Tokyo" }).format(now);
  const today = hours.find((entry) => entry.startsWith(weekday));
  if (!today) return { label: "営業時間不明", open: false, known: false };
  if (/休業|定休日|Closed/i.test(today)) return { label: "営業時間外", open: false, known: true };
  if (/24\s*時間営業|24\s*hours?/i.test(today)) return { label: "営業中", open: true, known: true };

  const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Tokyo" }).formatToParts(now);
  const minuteOfDay = Number(parts.find((part) => part.type === "hour")?.value ?? 0) * 60 + Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const periods = [...normalizeOpeningTimeText(today).matchAll(/(\d{1,2}):(\d{2})\s*[–〜～-]\s*(\d{1,2}):(\d{2})/g)];
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
import { classifyRamen } from "./ramen-genres";
