-- Import records from a CSV that you created and are authorized to use.
-- Run this file once in Supabase Dashboard > SQL Editor before using the admin CSV importer.

create table if not exists public.tabelog_hyakumeiten_awards (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.ramen_shops(id) on delete set null,
  award_year integer not null check (award_year between 2000 and 2100),
  award_name text not null default 'ラーメン TOKYO 百名店',
  area text not null default '東京都',
  listed_name text not null,
  selection_date date,
  source_url text not null,
  match_status text not null default 'unmatched' check (match_status in ('matched', 'unmatched', 'ambiguous')),
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (award_name, award_year, area, listed_name)
);

create index if not exists tabelog_hyakumeiten_awards_shop_id_idx on public.tabelog_hyakumeiten_awards (shop_id);
create index if not exists tabelog_hyakumeiten_awards_year_idx on public.tabelog_hyakumeiten_awards (award_year desc);

drop trigger if exists tabelog_hyakumeiten_awards_set_updated_at on public.tabelog_hyakumeiten_awards;
create trigger tabelog_hyakumeiten_awards_set_updated_at before update on public.tabelog_hyakumeiten_awards
for each row execute function public.set_updated_at();

alter table public.tabelog_hyakumeiten_awards enable row level security;
-- No browser-side policy: the protected admin importer uses SUPABASE_SERVICE_ROLE_KEY.

-- 画面例「西永福の煮干箱」の確認済み選出歴。
-- 根拠: https://award.tabelog.com/hyakumeiten/ramen_tokyo/2024/
insert into public.tabelog_hyakumeiten_awards (
  shop_id, award_year, award_name, area, listed_name, selection_date, source_url, match_status
)
select id, 2024, 'ラーメン TOKYO 百名店', '東京都', '西永福の煮干箱', '2024-12-03',
  'https://award.tabelog.com/hyakumeiten/ramen_tokyo/2024/', 'matched'
from public.ramen_shops
where name = '西永福の煮干箱'
  and address ilike '%杉並区永福3-55-3%'
on conflict (award_name, award_year, area, listed_name) do update
set shop_id = excluded.shop_id,
  selection_date = excluded.selection_date,
  source_url = excluded.source_url,
  match_status = 'matched',
  updated_at = now();
