import { describe, expect, it } from "vitest";
import { dedupeWebMentions, limitWebRamenMentions } from "@/lib/web-ramen-feed";

const item = (id: string, shop_id: string | null) => ({ mention_id: id, shop_id, source_name: "source", title: "title", summary: "summary", source_url: `https://example.com/${id}`, published_at: null, matched_area: null, matched_keyword: "ラーメン", matched_alias: null, tokyo_confidence: 1, ramen_relevance: 1, source_score: 80, ranking_score: 1, is_visible: true, exclusion_reason: null, ramen_shops: shop_id ? { id: shop_id, name: shop_id } : null });

describe("web ramen feed limits", () => {
  it("keeps at most two per shop and five unlinked", () => {
    const result = limitWebRamenMentions([item("1", "s"), item("2", "s"), item("3", "s"), ...Array.from({ length: 6 }, (_, i) => item(`u${i}`, null))]);
    expect(result.filter((x) => x.shop_id === "s")).toHaveLength(2);
    expect(result.filter((x) => !x.shop_id)).toHaveLength(5);
  });
  it("deduplicates mention IDs", () => { expect(dedupeWebMentions([item("same", null), item("same", null)])).toHaveLength(1); });
});
