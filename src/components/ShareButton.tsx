"use client";

import { useState } from "react";

export function ShareButton({ shopId, shopName }: { shopId: string; shopName: string }) {
  const [message, setMessage] = useState("");
  const share = async () => {
    const url = new URL(`/shops/${shopId}`, window.location.origin).toString();
    try {
      if (navigator.share) {
        await navigator.share({ title: shopName, text: `${shopName} | TOKYO RAMEN`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setMessage("リンクをコピーしました");
      window.setTimeout(() => setMessage(""), 2_000);
    } catch {
      // Users may cancel the native share sheet. No action is needed.
    }
  };
  return <div className="relative"><button onClick={share} className="rounded-full border border-stone-600 px-4 py-2 text-sm font-bold text-stone-200 transition hover:border-gold hover:text-gold">↗ 共有</button>{message && <span className="absolute right-0 top-11 w-max rounded bg-stone-800 px-2 py-1 text-xs text-gold">{message}</span>}</div>;
}
