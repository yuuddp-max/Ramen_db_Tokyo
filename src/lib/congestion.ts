export type WaitReport = { wait_minutes: number; reported_at: string };

export type WeatherSnapshot = {
  temperature: number;
  precipitation: number;
  weatherCode: number;
  label: string;
  isWet: boolean;
};

const WET_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99]);

function weatherLabel(code: number) {
  if (WET_CODES.has(code)) return code >= 71 ? "雪・荒天" : "雨";
  if (code <= 1) return "晴れ";
  if (code <= 3) return "くもり";
  if (code <= 48) return "霧";
  return "天気情報あり";
}

export async function getCurrentWeather(latitude: number, longitude: number): Promise<WeatherSnapshot | null> {
  try {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: "temperature_2m,precipitation,weather_code",
      timezone: "Asia/Tokyo",
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { next: { revalidate: 1800 } });
    if (!response.ok) return null;
    const json = await response.json() as { current?: { temperature_2m?: number; precipitation?: number; weather_code?: number } };
    const temperature = json.current?.temperature_2m;
    const precipitation = json.current?.precipitation;
    const weatherCode = json.current?.weather_code;
    if (typeof temperature !== "number" || typeof precipitation !== "number" || typeof weatherCode !== "number") return null;
    return { temperature, precipitation, weatherCode, label: weatherLabel(weatherCode), isWet: precipitation > 0 || WET_CODES.has(weatherCode) };
  } catch {
    return null;
  }
}

function tokyoParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")), hour: Number(get("hour")), weekday: get("weekday") };
}

function nthMonday(year: number, month: number, occurrence: number) {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return 1 + ((8 - first) % 7) + (occurrence - 1) * 7;
}

function equinoxDay(year: number, autumn: boolean) {
  const base = autumn ? 23.2488 : 20.8431;
  return Math.floor(base + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

export function isJapaneseHoliday(value = new Date()): boolean {
  const { year, month, day, weekday } = tokyoParts(value);
  const fixed = new Set(["1-1", "2-11", "2-23", "4-29", "5-3", "5-4", "5-5", "8-11", "11-3", "11-23"]);
  if (fixed.has(`${month}-${day}`)) return true;
  if ((month === 1 && day === nthMonday(year, 1, 2)) || (month === 7 && day === nthMonday(year, 7, 3)) || (month === 9 && day === nthMonday(year, 9, 3)) || (month === 10 && day === nthMonday(year, 10, 2))) return true;
  if ((month === 3 && day === equinoxDay(year, false)) || (month === 9 && day === equinoxDay(year, true))) return true;
  const yesterday = new Date(value.getTime() - 24 * 60 * 60 * 1000);
  return weekday === "Mon" && isJapaneseHoliday(yesterday);
}

function average(values: number[]) { return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null; }

export function createCongestionPrediction(reports: WaitReport[], rating: number | null, weather: WeatherSnapshot | null, now = new Date()) {
  const current = tokyoParts(now);
  const reportWithParts = reports.map((report) => ({ ...report, parts: tokyoParts(new Date(report.reported_at)) }));
  const sameSlot = reportWithParts.filter((report) => report.parts.weekday === current.weekday && Math.abs(report.parts.hour - current.hour) <= 1);
  const allAverage = average(reports.map((report) => report.wait_minutes));
  const peakBaseline = (current.hour >= 11 && current.hour < 14) || (current.hour >= 18 && current.hour < 21) ? 18 : 7;
  let estimate = average(sameSlot.map((report) => report.wait_minutes)) ?? allAverage ?? peakBaseline;
  const factors: string[] = [];
  if (sameSlot.length) factors.push("同曜日・時間帯の投稿実績"); else factors.push("店舗全体の投稿実績と時間帯");
  if ((rating ?? 0) >= 4.5) { estimate *= 1.2; factors.push("高評価店（4.5以上）"); }
  const holiday = isJapaneseHoliday(now);
  if (holiday || current.weekday === "Sat" || current.weekday === "Sun") { estimate *= 1.25; factors.push(holiday ? "祝日" : "週末"); }
  if (weather?.isWet) { estimate *= 0.85; factors.push(`${weather.label}による来店分散`); }
  const waitMinutes = Math.max(0, Math.min(120, Math.round(estimate / 5) * 5));
  const crowd = waitMinutes >= 25 ? "高め" : waitMinutes >= 10 ? "やや高め" : "低め";
  const hourly = Array.from({ length: 12 }, (_, index) => {
    const hour = index + 11;
    const samples = reportWithParts.filter((report) => report.parts.weekday === current.weekday && report.parts.hour === hour);
    return { hour, averageWait: average(samples.map((report) => report.wait_minutes)), reportCount: samples.length };
  });
  return { waitMinutes, crowd, confidence: Math.min(95, 35 + reports.length * 6), reportCount: reports.length, holiday, factors, hourly };
}
