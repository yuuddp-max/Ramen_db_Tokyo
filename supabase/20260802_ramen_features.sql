-- Local keyword-based ramen feature extraction. Run in Supabase SQL Editor.
alter table public.ramen_shops
  add column if not exists feature_text text,
  add column if not exists feature_keywords jsonb,
  add column if not exists feature_source_urls jsonb,
  add column if not exists feature_source_hash text,
  add column if not exists feature_status text default 'pending',
  add column if not exists feature_method text,
  add column if not exists feature_confidence numeric(4,3),
  add column if not exists feature_updated_at timestamptz,
  add column if not exists feature_error text;

create index if not exists ramen_shops_feature_status_idx on public.ramen_shops (feature_status, feature_updated_at);
create index if not exists ramen_shops_feature_hash_idx on public.ramen_shops (feature_source_hash);

create table if not exists public.ramen_feature_jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'queued' check (status in ('queued','processing','completed','partially-completed','error','cancelled')),
  requested_count integer not null default 10,
  processed_count integer not null default 0,
  database_count integer not null default 0,
  needs_review_count integer not null default 0,
  no_information_count integer not null default 0,
  error_count integer not null default 0,
  skipped_count integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.ramen_feature_jobs enable row level security;
