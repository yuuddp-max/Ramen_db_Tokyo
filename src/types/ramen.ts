export type RamenShop = {
  id: string;
  place_id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  rating: number | null;
  user_ratings_total: number | null;
  opening_hours: string[] | null;
  phone_number: string | null;
  website: string | null;
  price_level: string | null;
  business_status: string | null;
  genres: string[] | null;
  created_at: string;
  updated_at: string;
};

export type ShopSearchResponse = {
  shops: RamenShop[];
  total: number;
};
