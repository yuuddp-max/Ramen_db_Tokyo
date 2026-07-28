import type { WebRamenMentionWithShop } from "@/types/web-ramen";

export function limitWebRamenMentions(mentions: WebRamenMentionWithShop[], limit = 20) {
  const shopCounts = new Map<string, number>();
  let unlinked = 0;
  return mentions.filter((mention) => {
    if (!mention.shop_id) return unlinked++ < 5;
    const count = shopCounts.get(mention.shop_id) ?? 0;
    if (count >= 2) return false;
    shopCounts.set(mention.shop_id, count + 1);
    return true;
  }).slice(0, limit);
}

export function dedupeWebMentions<T extends { mention_id: string }>(mentions: T[]) {
  return [...new Map(mentions.map((mention) => [mention.mention_id, mention])).values()];
}
