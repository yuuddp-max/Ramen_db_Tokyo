-- Run once in Supabase SQL Editor for an existing project.
alter table public.ramen_shops add column if not exists nearest_station text;
alter table public.ramen_shops add column if not exists nearest_station_distance_m integer check (nearest_station_distance_m >= 0);
alter table public.ramen_shops add column if not exists station_checked_at timestamptz;
