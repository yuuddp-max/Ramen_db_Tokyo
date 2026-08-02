import { describe, expect, it } from "vitest";
import {
  buildFeatureSourceText,
  buildFeatureText,
  extractFeatureKeywords,
  featureConfidence,
  featureSourceHash,
} from "@/lib/ramen-feature-rules";

describe("ramen feature keyword extraction", () => {
  it("連結した店舗情報からキーワードを抽出する", () => {
    const source = buildFeatureSourceText({
      name: "中華そば テスト店",
      description: "淡麗な醤油スープと自家製麺",
      menu: "味玉ラーメン",
      reviewSummary: "チャーシューとメンマが好評",
    });
    const keywords = extractFeatureKeywords(source);
    expect(keywords.soup).toContain("醤油");
    expect(keywords.style).toContain("中華そば");
    expect(keywords.noodle).toContain("自家製麺");
    expect(keywords.topping).toEqual(expect.arrayContaining(["味玉", "チャーシュー", "メンマ"]));
    expect(keywords.taste).toContain("淡麗");
  });

  it("高優先度の複合語を優先し、汎用語を除外する", () => {
    const keywords = extractFeatureKeywords("横浜家系 豚骨醤油ラーメン 魚介豚骨");
    expect(keywords.soup).toContain("豚骨醤油");
    expect(keywords.soup).toContain("豚骨魚介");
    expect(keywords.soup).not.toContain("豚骨");
    expect(keywords.soup).not.toContain("魚介");
    expect(keywords.style).toContain("家系");
  });

  it("表記ゆれと重複を正規化する", () => {
    const keywords = extractFeatureKeywords("煮干 にぼし ニボシ 汁なし担々麺 担々");
    expect(keywords.soup.filter((value) => value === "煮干し")).toHaveLength(1);
    expect(keywords.style.filter((value) => value === "担々麺")).toHaveLength(1);
  });

  it("特徴テキストは指定順で重複なく生成する", () => {
    const source = "家系 豚骨醤油 太麺";
    const keywords = extractFeatureKeywords(source);
    const text = buildFeatureText("テスト店", source, keywords, "豚骨醤油ラーメン");
    expect(text.startsWith("テスト店 豚骨醤油ラーメン")).toBe(true);
    expect(text.split(" ").filter((value) => value === "豚骨醤油")).toHaveLength(1);
  });

  it("情報がない店舗は低確信度になる", () => {
    const keywords = extractFeatureKeywords("店舗名のみ");
    expect(featureConfidence("店舗名のみ", keywords)).toBeLessThan(0.5);
  });

  it("同一テキストから安定したSHA-256を作る", () => {
    expect(featureSourceHash("同じ特徴情報")).toHaveLength(64);
    expect(featureSourceHash("同じ特徴情報")).toBe(featureSourceHash("同じ特徴情報"));
  });
});
