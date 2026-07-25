-- Run this once in Supabase Dashboard > SQL Editor for an existing project.
alter table public.ramen_shops add column if not exists google_maps_uri text;
alter table public.ramen_shops add column if not exists photo_name text;
alter table public.ramen_shops add column if not exists photo_attributions jsonb;
