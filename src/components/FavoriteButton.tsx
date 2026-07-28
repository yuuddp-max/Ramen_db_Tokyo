"use client";

import { useEffect, useState } from "react";
import { FAVORITES_STORAGE_KEY, readFavoriteIds } from "@/lib/favorites";

export function FavoriteButton({ shopId }: { shopId: string }) {
  const [liked, setLiked] = useState(false);
  useEffect(() => setLiked(readFavoriteIds().includes(shopId)), [shopId]);
  const toggle = () => {
    const current = readFavoriteIds();
    const next = current.includes(shopId) ? current.filter((id) => id !== shopId) : [...current, shopId];
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("favorites-changed"));
    setLiked(next.includes(shopId));
  };
  return <button type="button" aria-label={liked ? "お気に入りから削除" : "お気に入りに追加"} onClick={toggle} className={`min-h-11 rounded-full border px-3 py-2 text-sm font-bold transition ${liked ? "border-accent bg-accent-light text-accent" : "border-border text-text-secondary hover:border-accent hover:text-accent"}`}>{liked ? "♥" : "♡"}<span className="sr-only">{liked ? "お気に入り済み" : "お気に入り"}</span></button>;
}
