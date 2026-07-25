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
  return <button onClick={toggle} className={`rounded-full border px-4 py-2 text-sm font-bold transition ${liked ? "border-ramen bg-ramen text-white" : "border-stone-600 text-stone-200 hover:border-gold"}`}>{liked ? "♥ お気に入り済み" : "♡ お気に入り"}</button>;
}
