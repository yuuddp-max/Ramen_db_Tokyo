-- Rule/local-model/generative-AI classification pipeline. Run once in Supabase SQL Editor.
alter table public.ramen_shops
  add column if not exists "soupCategory" text,
  add column if not exists "styleCategory" text,
  add column if not exists "soupConfidence" numeric(4,3),
  add column if not exists "styleConfidence" numeric(4,3),
  add column if not exists "classificationMethod" text check ("classificationMethod" in ('rule','local-model','generative-ai','manual')),
  add column if not exists "classificationStatus" text not null default 'pending' check ("classificationStatus" in ('pending','processing','auto-approved','needs-review','manually-approved','error')),
  add column if not exists "classificationVersion" text,
  add column if not exists "classificationSourceHash" text,
  add column if not exists "classifiedAt" timestamptz,
  add column if not exists shop_description text,
  add column if not exists representative_menu text,
  add column if not exists review_summary text;

create index if not exists ramen_shops_classification_status_idx on public.ramen_shops ("classificationStatus", "classifiedAt");
create index if not exists ramen_shops_classification_hash_idx on public.ramen_shops ("classificationSourceHash");

create or replace function public.mark_ramen_classification_stale()
returns trigger language plpgsql security invoker as $$
begin
  if old.name is distinct from new.name
    or old.shop_description is distinct from new.shop_description
    or old.representative_menu is distinct from new.representative_menu
    or old.review_summary is distinct from new.review_summary then
    new."classificationStatus" := 'pending';
    new."classificationSourceHash" := null;
  end if;
  return new;
end;
$$;
drop trigger if exists ramen_shops_classification_stale on public.ramen_shops;
create trigger ramen_shops_classification_stale before update on public.ramen_shops
for each row execute function public.mark_ramen_classification_stale();

create table if not exists public.classification_jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'queued' check (status in ('queued','running','completed','error')),
  requested_count integer not null default 100 check (requested_count between 1 and 1000),
  processed_count integer not null default 0,
  auto_approved_count integer not null default 0,
  needs_review_count integer not null default 0,
  ai_count integer not null default 0,
  error_count integer not null default 0,
  skipped_count integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.classification_logs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.classification_jobs(id) on delete set null,
  shop_id uuid references public.ramen_shops(id) on delete cascade,
  source_hash text not null,
  method text not null,
  status text not null,
  soup_category text,
  style_category text,
  soup_confidence numeric(4,3),
  style_confidence numeric(4,3),
  duration_ms integer not null default 0,
  generative_ai_called boolean not null default false,
  error_message text,
  created_at timestamptz not null default now()
);
create index if not exists classification_logs_job_idx on public.classification_logs(job_id, created_at desc);

create table if not exists public.classification_training_examples (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.ramen_shops(id) on delete cascade,
  classification_text text not null,
  source_hash text not null,
  soup_category text not null,
  style_category text not null,
  created_at timestamptz not null default now(),
  unique (shop_id, source_hash, soup_category, style_category)
);

alter table public.classification_jobs enable row level security;
alter table public.classification_logs enable row level security;
alter table public.classification_training_examples enable row level security;
-- Browser access is intentionally disabled; protected admin APIs use SUPABASE_SERVICE_ROLE_KEY.
