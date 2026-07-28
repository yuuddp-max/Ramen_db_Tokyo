export type WebRamenMention = {
  mention_id: string;
  shop_id: string | null;
  source_name: string;
  title: string;
  summary: string;
  source_url: string;
  published_at: string | null;
  matched_area: string | null;
  matched_keyword: string | null;
  matched_alias: string | null;
  tokyo_confidence: number;
  ramen_relevance: number;
  source_score: number;
  ranking_score: number;
  is_visible: boolean;
  exclusion_reason: string | null;
};

export type WebRamenMentionWithShop = WebRamenMention & { ramen_shops: { id: string; name: string } | null };

export type WebFetchResult = {
  fetched: number;
  inserted: number;
  updated: number;
  matched: number;
  excluded: number;
  errors: number;
  apiStatus: number | null;
  startedAt: string;
  completedAt: string;
  status: "succeeded" | "partial" | "failed";
};
