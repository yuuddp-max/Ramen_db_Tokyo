export type RamenShop = {
  id: string;
  place_id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  rating: number | null;
  user_ratings_total: number | null;
  // Older imports may contain a JSON object or a plain string. Normalize it
  // before rendering rather than assuming every value is a text array.
  opening_hours: unknown;
  phone_number: string | null;
  website: string | null;
  price_level: string | null;
  business_status: string | null;
  genres: string[] | null;
  google_maps_uri: string | null;
  photo_name: string | null;
  photo_attributions: { displayName?: string; uri?: string; photoUri?: string }[] | null;
  nearest_station: string | null;
  nearest_station_distance_m: number | null;
  station_checked_at: string | null;
  researched_soup_type: string | null;
  researched_style: string | null;
  research_confidence: "high" | "medium" | "low" | null;
  research_status: "pending" | "draft" | "approved" | "rejected" | null;
  research_evidence_url: string | null;
  research_evidence_summary: string | null;
  research_updated_at: string | null;
  /** Server-side flag for whether the shop has a matched Tabelog Hyakumeiten award. */
  has_tabelog_hyakumeiten?: boolean;
  created_at: string;
  updated_at: string;
};

export type ShopSearchResponse = {
  shops: RamenShop[];
  total: number;
};
