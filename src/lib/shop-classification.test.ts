import { describe, expect, it } from "vitest";
import { buildClassificationText, classificationSourceHash, classifyWithRules } from "@/lib/shop-classification";

describe("shop classification rules", () => {
  it("classifies a high-confidence 家系豚骨醤油店 without an API call", () => {
    const text = buildClassificationText({ name: "横浜家系ラーメン テスト店", representativeMenu: "豚骨醤油ラーメン" });
    const result = classifyWithRules(text);
    expect(result.soup.category).toBe("豚骨醤油");
    expect(result.style.category).toBe("家系");
    expect(result.soup.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result.style.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("classifies 豚骨魚介 before the generic 豚骨 and 魚介 rules", () => {
    const result = classifyWithRules(buildClassificationText({ name: "濃厚豚骨魚介ラーメン テスト店" }));
    expect(result.soup.category).toBe("豚骨魚介");
    expect(result.soup.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("creates stable SHA-256 input hashes", () => {
    const text = buildClassificationText({ name: "中華そば テスト", reviewSummary: "淡麗な醤油スープ" });
    expect(classificationSourceHash(text)).toHaveLength(64);
    expect(classificationSourceHash(text)).toBe(classificationSourceHash(text));
  });
});
