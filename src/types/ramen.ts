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
  nearest_station: string | null;
  nearest_station_distance_m: number | null;
  station_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ShopSearchResponse = {
  shops: RamenShop[];
  total: number;
};
