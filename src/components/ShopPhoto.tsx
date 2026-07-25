"use client";

import Image from "next/image";
import { useState } from "react";

type Attribution = { displayName?: string; uri?: string; photoUri?: string };

export function ShopPhoto({ shopId, shopName, attributions }: { shopId: string; shopName: string; attributions: Attribution[] | null }) {
  const [available, setAvailable] = useState(true);
  if (!available) return null;
  return <figure className="panel overflow-hidden rounded-2xl">
    <Image unoptimized src={`/api/shop-photo?shopId=${shopId}`} alt={`${shopName} の店舗写真`} width={1200} height={800} onError={() => setAvailable(false)} className="h-72 w-full object-cover sm:h-96" />
    <figcaption className="border-t border-white/10 px-4 py-2 text-xs text-stone-500">写真提供：{attributions?.length ? attributions.map((attribution, index) => <span key={`${attribution.displayName}-${index}`}>{index > 0 && "、"}{attribution.uri ? <a className="underline hover:text-gold" href={attribution.uri} target="_blank" rel="noreferrer">{attribution.displayName ?? "Googleユーザー"}</a> : attribution.displayName ?? "Googleユーザー"}</span>) : "Google"}</figcaption>
  </figure>;
}
