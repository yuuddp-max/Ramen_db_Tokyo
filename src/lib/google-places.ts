type GooglePlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  priceLevel?: string;
  businessStatus?: string;
  types?: string[];
  googleMapsUri?: string;
  photos?: { name?: string; authorAttributions?: { displayName?: string; uri?: string; photoUri?: string }[] }[];
};

type TextSearchResponse = { places?: GooglePlace[]; nextPageToken?: string };

export type ImportedShop = {
  place_id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  rating: number | null;
  user_ratings_total: number | null;
  opening_hours: string[] | null;
  phone_number: string | null;
  website: string | null;
  price_level: string | null;
  business_status: string | null;
  genres: string[] | null;
  google_maps_uri: string | null;
  photo_name: string | null;
  photo_attributions: { displayName?: string; uri?: string; photoUri?: string }[] | null;
};

const TOKYO_AREAS = [
  "ラーメン 千代田区", "ラーメン 中央区", "ラーメン 港区", "ラーメン 新宿区", "ラーメン 文京区",
  "ラーメン 台東区", "ラーメン 墨田区", "ラーメン 江東区", "ラーメン 品川区", "ラーメン 目黒区",
  "ラーメン 大田区", "ラーメン 世田谷区", "ラーメン 渋谷区", "ラーメン 中野区", "ラーメン 杉並区",
  "ラーメン 豊島区", "ラーメン 北区", "ラーメン 荒川区", "ラーメン 板橋区", "ラーメン 練馬区",
  "ラーメン 足立区", "ラーメン 葛飾区", "ラーメン 江戸川区", "ラーメン 立川市", "ラーメン 八王子市",
  "ラーメン 町田市", "ラーメン 武蔵野市", "ラーメン 三鷹市", "ラーメン 府中市", "ラーメン 調布市",
  "ラーメン 西東京市", "ラーメン 多摩市", "ラーメン 青梅市", "ラーメン 昭島市", "ラーメン 小金井市",
  "ラーメン 小平市", "ラーメン 日野市", "ラーメン 東村山市", "ラーメン 国分寺市", "ラーメン 国立市",
  "ラーメン 福生市", "ラーメン 東大和市", "ラーメン 清瀬市", "ラーメン 東久留米市", "ラーメン 武蔵村山市",
  "ラーメン 稲城市", "ラーメン 狛江市", "ラーメン 羽村市", "ラーメン あきる野市", "ラーメン 瑞穂町", "ラーメン 日の出町",
  "ラーメン 檜原村", "ラーメン 奥多摩町", "ラーメン 大島町", "ラーメン 八丈町", "ラーメン 利島村",
  "ラーメン 新島村", "ラーメン 神津島村", "ラーメン 三宅村", "ラーメン 御蔵島村", "ラーメン 青ヶ島村", "ラーメン 小笠原村",
];

// A single "ラーメン" query is capped by Places and misses shops that primarily
// advertise themselves as tsukemen or abura soba.  Keep each query area-specific
// to preserve Tokyo-wide coverage while providing enough distinct candidates for
// the 5,000-shop import target.
const TOKYO_CORE_SEARCH_QUERIES = TOKYO_AREAS.flatMap((query) => [
  query,
  query.replace("ラーメン", "つけ麺"),
  query.replace("ラーメン", "油そば"),
]);

// The first 23 entries are Tokyo's special wards. Add commonly independent
// ramen terms there to find stores that do not use the word "ラーメン".
const TOKYO_WARD_VARIANT_QUERIES = TOKYO_AREAS.slice(0, 23).flatMap((query) => [
  query.replace("ラーメン", "中華そば"),
  query.replace("ラーメン", "担々麺"),
  query.replace("ラーメン", "家系ラーメン"),
]);

export const TOKYO_SEARCH_QUERIES = [...new Set([...TOKYO_CORE_SEARCH_QUERIES, ...TOKYO_WARD_VARIANT_QUERIES])];

const fieldMask = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.regularOpeningHours",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.priceLevel",
  "places.businessStatus",
  "places.types",
  "places.googleMapsUri",
  "places.photos",
  "nextPageToken",
].join(",");

function toShop(place: GooglePlace): ImportedShop | null {
  const latitude = place.location?.latitude;
  const longitude = place.location?.longitude;
  const name = place.displayName?.text;
  const address = place.formattedAddress ?? null;
  if (!place.id || !name || latitude == null || longitude == null) return null;
  // Text Search can only restrict by a rectangle, which also overlaps nearby
  // prefectures. Keep only records whose formatted address is in Tokyo.
  if (!address?.includes("東京都")) return null;
  // Low-rated records are not useful directory entries. Leave unrated places
  // untouched here; only an explicit rating of 1.0 or below is excluded.
  if (place.rating != null && place.rating <= 1) return null;

  return {
    place_id: place.id,
    name,
    address,
    latitude,
    longitude,
    rating: place.rating ?? null,
    user_ratings_total: place.userRatingCount ?? null,
    opening_hours: place.regularOpeningHours?.weekdayDescriptions ?? null,
    phone_number: place.nationalPhoneNumber ?? null,
    website: place.websiteUri ?? null,
    price_level: place.priceLevel ?? null,
    business_status: place.businessStatus ?? null,
    genres: place.types ?? null,
    google_maps_uri: place.googleMapsUri ?? null,
    photo_name: place.photos?.[0]?.name ?? null,
    photo_attributions: place.photos?.[0]?.authorAttributions ?? null,
  };
}

async function searchTokyoRamenPage(query: string, pageToken?: string) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY が設定されていません。");

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: "ja",
      regionCode: "JP",
      pageSize: 20,
      locationRestriction: {
        rectangle: {
          low: { latitude: 35.52, longitude: 138.94 },
          high: { latitude: 35.9, longitude: 139.92 },
        },
      },
      ...(pageToken ? { pageToken } : {}),
    }),
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Places API error: ${response.status} ${await response.text()}`);
  const json = (await response.json()) as TextSearchResponse;
  return {
    shops: (json.places ?? []).map(toShop).filter((shop): shop is ImportedShop => shop !== null),
    nextPageToken: json.nextPageToken,
  };
}

/** Resolves a station/area query to a map point without exposing the API key. */
export async function searchTokyoLocation(query: string) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "places.location" },
    body: JSON.stringify({ textQuery: query, languageCode: "ja", regionCode: "JP", pageSize: 1 }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const place = ((await response.json()) as TextSearchResponse).places?.[0];
  const latitude = place?.location?.latitude;
  const longitude = place?.location?.longitude;
  return latitude != null && longitude != null ? { latitude, longitude } : null;
}

export async function searchTokyoRamen(query = "ラーメン") {
  return (await searchTokyoRamenPage(query)).shops;
}

async function searchTokyoRamenPages(query: string, maxPages = 3) {
  const shops: ImportedShop[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const result = await searchTokyoRamenPage(query, pageToken);
    shops.push(...result.shops);
    if (!result.nextPageToken) break;
    pageToken = result.nextPageToken;
  }
  return shops;
}

export async function searchAllTokyoRamen(queries = TOKYO_SEARCH_QUERIES, target = 2_000) {
  const groups: ImportedShop[][] = [];
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < queries.length) {
      const query = queries[nextIndex++];
      groups.push(await searchTokyoRamenPages(query));
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, queries.length) }, worker));
  return [...new Map(groups.flat().map((shop) => [shop.place_id, shop])).values()].slice(0, target);
}
