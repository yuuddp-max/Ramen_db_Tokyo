-- Phase 2: run this once in Supabase Dashboard > SQL Editor for an existing project.
create table if not exists public.wait_reports (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.ramen_shops(id) on delete cascade,
  wait_minutes integer not null check (wait_minutes >= 0 and wait_minutes <= 240),
  reported_at timestamptz not null default now(),
  source text not null default 'web' check (source in ('web'))
);

create index if not exists wait_reports_shop_reported_at_idx
  on public.wait_reports (shop_id, reported_at desc);

alter table public.wait_reports enable row level security;

create policy "Anyone can read wait reports"
  on public.wait_reports for select using (true);
-- No direct client-side insert policy. POST /api/wait-reports validates input
-- and uses SUPABASE_SERVICE_ROLE_KEY on the server.
