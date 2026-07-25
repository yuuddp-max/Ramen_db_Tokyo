-- Run this in Supabase Dashboard > SQL Editor.
create extension if not exists "pgcrypto";

create table if not exists public.ramen_shops (
  id uuid primary key default gen_random_uuid(),
  place_id text not null unique,
  name text not null,
  address text,
  latitude double precision not null,
  longitude double precision not null,
  rating numeric(2,1) check (rating >= 0 and rating <= 5),
  user_ratings_total integer check (user_ratings_total >= 0),
  opening_hours text[],
  phone_number text,
  website text,
  price_level text,
  business_status text,
  genres text[],
  nearest_station text,
  nearest_station_distance_m integer check (nearest_station_distance_m >= 0),
  station_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ramen_shops_rating_idx on public.ramen_shops (rating desc nulls last);
create index if not exists ramen_shops_created_at_idx on public.ramen_shops (created_at desc);
create index if not exists ramen_shops_name_idx on public.ramen_shops using gin (to_tsvector('simple', name));

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists ramen_shops_set_updated_at on public.ramen_shops;
create trigger ramen_shops_set_updated_at before update on public.ramen_shops
for each row execute function public.set_updated_at();

alter table public.ramen_shops enable row level security;
create policy "Anyone can read ramen shops" on public.ramen_shops for select using (true);
-- No client-side write policy: imports use SUPABASE_SERVICE_ROLE_KEY only on the server.

-- Optional future authenticated favorites table (the current UI keeps favorites in local storage).
create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  shop_id uuid not null references public.ramen_shops(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, shop_id)
);
alter table public.favorites enable row level security;
create policy "Users can read own favorites" on public.favorites for select using (auth.uid() = user_id);
create policy "Users can add own favorites" on public.favorites for insert with check (auth.uid() = user_id);
create policy "Users can remove own favorites" on public.favorites for delete using (auth.uid() = user_id);
