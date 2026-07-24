"use client";

import { useEffect, useState } from "react";

const key = "tokyo-ramen-favorites";

export function FavoriteButton({ shopId }: { shopId: string }) {
  const [liked, setLiked] = useState(false);
  useEffect(() => setLiked(JSON.parse(localStorage.getItem(key) ?? "[]").includes(shopId)), [shopId]);
  const toggle = () => {
    const current: string[] = JSON.parse(localStorage.getItem(key) ?? "[]");
    const next = current.includes(shopId) ? current.filter((id) => id !== shopId) : [...current, shopId];
    localStorage.setItem(key, JSON.stringify(next));
    setLiked(next.includes(shopId));
  };
  return <button onClick={toggle} className={`rounded-full border px-4 py-2 text-sm font-bold transition ${liked ? "border-ramen bg-ramen text-white" : "border-stone-600 text-stone-200 hover:border-gold"}`}>{liked ? "♥ お気に入り済み" : "♡ お気に入り"}</button>;
}
