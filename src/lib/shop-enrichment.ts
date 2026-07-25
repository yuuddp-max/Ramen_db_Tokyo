import type { RamenShop } from "@/types/ramen";
import { supabaseAdmin } from "./supabase";
import { calculateDistanceMeters } from "./utils";
export { inferRamenStyle } from "./utils";

export function getTodayHours(openingHours: string[] | null) {
  if (!openingHours?.length) return null;
  const weekday = new Intl.DateTimeFormat("ja-JP", { weekday: "long", timeZone: "Asia/Tokyo" }).format(new Date());
  const today = openingHours.find((hours) => hours.startsWith(weekday)) ?? openingHours[0];
  const match = today.match(/(\d{1,2}:\d{2})\s*[–〜-]\s*(\d{1,2}:\d{2})/);
  return { description: today, opensAt: match?.[1] ?? null, closesAt: match?.[2] ?? null };
}

export function estimateVisit(shop: RamenShop) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Tokyo" }).format(new Date()));
  const peak = (hour >= 11 && hour < 14) || (hour >= 18 && hour < 21);
  const popular = (shop.user_ratings_total ?? 0) >= 1000;
  if (peak && popular) return { crowd: "高め", wait: "20〜35分" };
  if (peak || popular) return { crowd: "やや高め", wait: "10〜20分" };
  return { crowd: "低め", wait: "0〜10分" };
}

type StationResult = { name: string; distanceM: number } | null;
type PlaceResult = { displayName?: { text?: string }; location?: { latitude?: number; longitude?: number }; types?: string[] };

async function findNearestStation(shop: RamenShop): Promise<StationResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.displayName,places.location,places.types",
    },
    body: JSON.stringify({
      textQuery: "駅",
      languageCode: "ja",
      regionCode: "JP",
      pageSize: 20,
      locationBias: { circle: { center: { latitude: shop.latitude, longitude: shop.longitude }, radius: 3000 } },
    }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { places?: PlaceResult[] };
  const stations = (json.places ?? []).filter((place) =>
    place.displayName?.text && place.location?.latitude != null && place.location?.longitude != null &&
    place.types?.some((type) => type === "train_station" || type === "subway_station" || type === "transit_station"),
  );
  if (!stations.length) return null;
  const closest = stations
    .map((station) => ({
      name: station.displayName!.text!,
      distanceM: calculateDistanceMeters(shop.latitude, shop.longitude, station.location!.latitude!, station.location!.longitude!),
    }))
    .sort((a, b) => a.distanceM - b.distanceM)[0];
  return closest;
}

export async function getNearestStation(shop: RamenShop): Promise<StationResult> {
  const checkedRecently = shop.station_checked_at && Date.now() - new Date(shop.station_checked_at).getTime() < 1000 * 60 * 60 * 24 * 30;
  if (shop.nearest_station && shop.nearest_station_distance_m != null && checkedRecently) {
    return { name: shop.nearest_station, distanceM: shop.nearest_station_distance_m };
  }
  let station: StationResult = null;
  try {
    station = await findNearestStation(shop);
  } catch {
    return null;
  }
  if (station && supabaseAdmin) {
    await supabaseAdmin.from("ramen_shops").update({
      nearest_station: station.name,
      nearest_station_distance_m: station.distanceM,
      station_checked_at: new Date().toISOString(),
    }).eq("id", shop.id);
  }
  return station;
}
