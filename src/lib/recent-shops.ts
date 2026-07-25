export const RECENT_SHOPS_STORAGE_KEY = "tokyo-ramen-recent-shops";

export type RecentShop = { id: string; name: string };

export function readRecentShops(): RecentShop[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_SHOPS_STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((shop): shop is RecentShop => typeof shop?.id === "string" && typeof shop?.name === "string") : [];
  } catch {
    return [];
  }
}

export function saveRecentShop(shop: RecentShop) {
  const next = [shop, ...readRecentShops().filter((item) => item.id !== shop.id)].slice(0, 12);
  localStorage.setItem(RECENT_SHOPS_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("recent-shops-changed"));
}
