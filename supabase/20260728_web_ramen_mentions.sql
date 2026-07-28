-- Web調査で見つけた東京ラーメン関連の話題記事・投稿用テーブル。
-- schema.sql 適用後にSupabase SQL Editorで実行してください。
create table if not exists public.shop_aliases (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.ramen_shops(id) on delete cascade,
  alias_name text not null check (char_length(trim(alias_name)) >= 2),
  created_at timestamptz not null default now(),
  unique (shop_id, alias_name)
);
create index if not exists shop_aliases_shop_id_idx on public.shop_aliases (shop_id);
create index if not exists shop_aliases_name_idx on public.shop_aliases using gin (to_tsvector('simple', alias_name));
alter table public.shop_aliases enable row level security;

create table if not exists public.web_ramen_mentions (
  mention_id text primary key,
  shop_id uuid references public.ramen_shops(id) on delete set null,
  source_name text not null,
  title text not null,
  summary text not null,
  source_url text not null,
  published_at timestamptz,
  matched_area text,
  matched_keyword text,
  matched_alias text,
  tokyo_confidence numeric(3,2) not null default 0 check (tokyo_confidence between 0 and 1),
  ramen_relevance numeric(3,2) not null default 0 check (ramen_relevance between 0 and 1),
  source_score numeric(5,2) not null default 0,
  ranking_score double precision not null default 0,
  is_visible boolean not null default false,
  exclusion_reason text,
  fetched_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists web_ramen_mentions_published_at_idx on public.web_ramen_mentions (published_at desc nulls last);
create index if not exists web_ramen_mentions_ranking_score_idx on public.web_ramen_mentions (ranking_score desc);
create index if not exists web_ramen_mentions_shop_id_idx on public.web_ramen_mentions (shop_id);
create index if not exists web_ramen_mentions_is_visible_idx on public.web_ramen_mentions (is_visible) where is_visible;
drop trigger if exists web_ramen_mentions_set_updated_at on public.web_ramen_mentions;
create trigger web_ramen_mentions_set_updated_at before update on public.web_ramen_mentions
for each row execute function public.set_updated_at();
alter table public.web_ramen_mentions enable row level security;
drop policy if exists "Anyone can read visible web ramen mentions" on public.web_ramen_mentions;
create policy "Anyone can read visible web ramen mentions" on public.web_ramen_mentions for select using (is_visible = true);

create table if not exists public.web_fetch_logs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running', 'succeeded', 'partial', 'failed')),
  fetched_count integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  matched_count integer not null default 0,
  excluded_count integer not null default 0,
  error_count integer not null default 0,
  api_status integer,
  error_summary text
);
create index if not exists web_fetch_logs_started_at_idx on public.web_fetch_logs (started_at desc);
create unique index if not exists web_fetch_logs_one_running_idx on public.web_fetch_logs (status) where status = 'running';
alter table public.web_fetch_logs enable row level security;
