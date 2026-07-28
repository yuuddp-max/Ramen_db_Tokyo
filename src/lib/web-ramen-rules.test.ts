import { describe, expect, it } from "vitest";
import { calculateWebRankingScore, classifyWebMention, mentionId } from "@/lib/web-ramen-rules";

const shops = [{ id: "shop-1", name: "東京煮干し専門店", address: "東京都千代田区", nearest_station: "神保町" }];

describe("web ramen classification", () => {
  it("matches shop name and alias", () => {
    expect(classifyWebMention("東京煮干し専門店の新メニュー", shops, []).shopId).toBe("shop-1");
    expect(classifyWebMention("煮干し東京の紹介", shops, [{ shop_id: "shop-1", alias_name: "煮干し東京" }]).matchedAlias).toBe("煮干し東京");
  });
  it("matches a Tokyo area and excludes cup noodles", () => {
    expect(classifyWebMention("池袋のつけ麺店", shops, []).matchedArea).toBe("池袋");
    expect(classifyWebMention("池袋のカップ麺", shops, []).exclusionReason).toContain("カップ麺");
  });
  it("creates stable IDs and applies age decay", () => {
    expect(mentionId("https://example.com/a")).toBe(mentionId("https://example.com/a"));
    expect(calculateWebRankingScore(100, "2026-07-28T00:00:00Z", new Date("2026-07-28T06:00:00Z"))).toBe(100 / Math.sqrt(6));
  });
});
