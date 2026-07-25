export const FAVORITES_STORAGE_KEY = "tokyo-ramen-favorites";

export function readFavoriteIds() {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}
