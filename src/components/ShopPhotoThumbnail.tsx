"use client";

import Image from "next/image";
import { useState } from "react";

type Props = { shopId: string; shopName: string };

export function ShopPhotoThumbnail({ shopId, shopName }: Props) {
  const [available, setAvailable] = useState(true);

  if (!available) return null;

  return <div className="mb-4 overflow-hidden rounded-xl border border-white/10 bg-black/20">
    <Image
      unoptimized
      src={`/api/shop-photo?shopId=${shopId}`}
      alt={`${shopName} の店舗写真`}
      width={720}
      height={405}
      onError={() => setAvailable(false)}
      className="h-36 w-full object-cover transition duration-300 group-hover:scale-[1.03]"
    />
  </div>;
}
