-- Keep the legacy application key (place_id) and the integration-facing
-- google_place_id column synchronized. Run once in Supabase SQL Editor.
alter table public.ramen_shops
  add column if not exists google_place_id text;

-- Some older projects contain this trigger function without RETURN NEW,
-- which makes any UPDATE fail before the backfill can run. Recreate it safely.
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

update public.ramen_shops
set google_place_id = place_id
where nullif(trim(google_place_id), '') is null
  and nullif(trim(place_id), '') is not null;

create unique index if not exists ramen_shops_google_place_id_uidx
  on public.ramen_shops (google_place_id)
  where google_place_id is not null;
