import { classifyRamen } from "@/lib/ramen-genres";

type TrustScoreShop = {
  name: string;
  rating: number | null;
  user_ratings_total: number | null;
  genres: string[] | null;
  researched_soup_type: string | null;
  researched_style: string | null;
  research_evidence_url: string | null;
  research_updated_at: string | null;
  updated_at: string;
  has_tabelog_hyakumeiten?: boolean;
};

export type RamenTrustScore = {
  score: number;
  bayesianRating: number;
  reasons: string[];
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function calculateBayesianRating(rating: number | null, reviewCount: number | null, globalAverage = 4, minimumReviews = 100) {
  if (rating === null) return globalAverage;
  const reviews = Math.max(0, reviewCount ?? 0);
  return (reviews / (reviews + minimumReviews)) * rating + (minimumReviews / (reviews + minimumReviews)) * globalAverage;
}

export function calculateRamenTrustScore(shop: TrustScoreShop, globalAverage = 4): RamenTrustScore {
  const reviews = Math.max(0, shop.user_ratings_total ?? 0);
  const bayesianRating = calculateBayesianRating(shop.rating, reviews, globalAverage);
  const ratingScore = clamp((bayesianRating / 5) * 100);
  const volumeScore = clamp(Math.log10(reviews + 1) * 30);
  const classified = classifyRamen(shop.name);
  const nonSpecialty = /自販機|駐車場|物販|居酒屋|酒場|移動販売/.test(shop.name);
  const ramenKeywords = (shop.genres ?? []).some((genre) => /ramen|ラーメン|麺|つけ麺/i.test(genre));
  const specialtyScore = nonSpecialty ? 0 : clamp(45 + (ramenKeywords ? 25 : 0) + (shop.researched_soup_type || shop.researched_style ? 20 : 0) + (classified.soup !== "不明" || classified.style !== "不明" ? 10 : 0));
  const updatedAt = shop.research_updated_at ?? shop.updated_at;
  const ageDays = updatedAt ? Math.max(0, (Date.now() - new Date(updatedAt).getTime()) / 86_400_000) : Number.POSITIVE_INFINITY;
  const recencyScore = ageDays <= 90 ? 100 : ageDays <= 180 ? 75 : ageDays <= 365 ? 50 : 25;
  const editorialScore = shop.has_tabelog_hyakumeiten ? 100 : shop.research_evidence_url ? 55 : 0;
  const qualityFields = [shop.rating, shop.user_ratings_total, shop.researched_soup_type, shop.researched_style, shop.research_evidence_url, shop.updated_at].filter(Boolean).length;
  const dataQualityScore = (qualityFields / 6) * 100;
  const score = Math.round(ratingScore * 0.35 + volumeScore * 0.15 + specialtyScore * 0.2 + recencyScore * 0.1 + editorialScore * 0.15 + dataQualityScore * 0.05);
  const reasons = [
    `Google ${shop.rating?.toFixed(1) ?? "-"} / ${reviews.toLocaleString()}件`,
    reviews >= 100 ? "口コミ件数が十分" : "口コミ件数は参考値",
    nonSpecialty ? "ラーメン専門店として未確認" : specialtyScore >= 70 ? "ラーメン専門性が高い" : "ラーメン関連店",
    recencyScore >= 75 ? "情報が比較的新しい" : "情報の更新を確認中",
    editorialScore >= 100 ? "食べログ百名店の掲載歴あり" : editorialScore > 0 ? "専門情報の根拠あり" : "専門媒体の掲載情報なし",
  ];
  return { score: clamp(score), bayesianRating, reasons };
}
