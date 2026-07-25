import type { RamenShop } from "@/types/ramen";

function normalize(value: string | null | undefined) {
  return (value ?? "").normalize("NFKC").toLowerCase().replace(/[\s\-‐‑‒–—―ー・,，、.．]/g, "");
}

/**
 * Google Places may return more than one Place ID for the same storefront.
 * Treat an identical normalized name and address as one listing.
 */
export function dedupeRamenShops(shops: RamenShop[]) {
  const seen = new Set<string>();
  return shops.filter((shop) => {
    const name = normalize(shop.name);
    const address = normalize(shop.address);
    const location = `${shop.latitude.toFixed(4)},${shop.longitude.toFixed(4)}`;
    const key = name && address ? `store:${name}:${address}` : `place:${normalize(shop.place_id) || `${name}:${location}`}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
