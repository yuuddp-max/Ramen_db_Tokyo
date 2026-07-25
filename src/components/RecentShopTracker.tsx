"use client";

import { useEffect } from "react";
import { saveRecentShop } from "@/lib/recent-shops";

export function RecentShopTracker({ shopId, shopName }: { shopId: string; shopName: string }) {
  useEffect(() => { saveRecentShop({ id: shopId, name: shopName }); }, [shopId, shopName]);
  return null;
}
