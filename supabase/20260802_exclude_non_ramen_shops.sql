-- Recoverable removal for places that are not ramen restaurants.
alter table public.ramen_shops
  add column if not exists is_excluded boolean not null default false,
  add column if not exists excluded_at timestamptz,
  add column if not exists exclusion_reason text;

create index if not exists ramen_shops_is_excluded_idx
  on public.ramen_shops (is_excluded)
  where is_excluded = false;
