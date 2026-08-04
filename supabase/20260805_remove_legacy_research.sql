-- 旧AI調査ジョブと旧ステータスのデータを廃止する。
-- ramen_shops の店舗レコード自体は削除せず、現在のローカルCSV分類を保持する。

alter table public.ramen_shops
  alter column research_status drop not null;

update public.ramen_shops
set
  research_status = null,
  researched_soup_type = null,
  researched_style = null,
  research_confidence = null,
  research_evidence_url = null,
  research_evidence_summary = null,
  research_updated_at = null;

drop table if exists public.classification_logs;
drop table if exists public.classification_jobs;
