-- Deep Researchで確認したスープ系統・スタイル・根拠を保存します。
-- Supabase Dashboard > SQL Editor で、このファイル全体を一度だけ実行してください。

alter table public.ramen_shops
  add column if not exists researched_soup_type text,
  add column if not exists researched_style text,
  add column if not exists research_confidence text check (research_confidence in ('high', 'medium', 'low')),
  add column if not exists research_status text not null default 'pending' check (research_status in ('pending', 'draft', 'approved', 'rejected')),
  add column if not exists research_evidence_url text,
  add column if not exists research_evidence_summary text,
  add column if not exists research_updated_at timestamptz;

with research (
  place_id,
  researched_soup_type,
  researched_style,
  research_confidence,
  research_status,
  research_evidence_url,
  research_evidence_summary
) as (
  values
    ('ChIJY3LPRKblGGARz60964VyUFU', 'その他', '汁なし・油そば専門店', 'high', 'approved', 'https://shop.ganso-aburado.com/japan/detail/112618/', '油そば専門店として案内されているため、スープ系統は汁なし・油そばに分類。'),
    ('ChIJBYY9NlIhGWARdWNgdUD0YI8', '未確認', '冷凍ラーメン自販機', 'low', 'approved', 'https://www.ultrafoods.co.jp/', '冷凍ラーメン自販機としての登録で、提供スープの系統は確認できない。'),
    ('ChIJ84mFaAAlGWARjC6-s2ZKpcs', '煮干し', '節と煮干しを中心とした醤油ラーメン・つけ麺', 'high', 'approved', 'https://www.instagram.com/p/DBOYHnGyGMY/', '節と煮干しを中心にした醤油ラーメン・つけ麺として案内されている。'),
    ('ChIJXwW6XgDhGGARsO5GMy2uL_w', '未確認', '移動販売（チャルメラ）', 'low', 'approved', 'https://info.gbiz.go.jp/hojin/ichiran?hojinBango=6012801022380', '移動販売の登録で、固定メニューやスープ系統の確認ができない。'),
    ('ChIJ_3sD7gL9GGARBZ5ZUhL9-gM', '未確認', '駐車場として登録された地点', 'low', 'approved', 'https://www.urban-inc.co.jp/tokyotakao/shop/saikaiseimensho/', '店舗ではなく駐車場として登録された地点のため、スープ系統は付与しない。'),
    ('ChIJ86GzyOnnGGARRorKhoBwICY', '未確認', 'ラーメン店と大衆酒場の二毛作営業', 'medium', 'approved', 'https://x.com/menyagobou', 'ラーメン提供は確認できるが、主力スープ系統を特定できない。'),
    ('ChIJE9zJogePGGARBvQ-j_olTG0', '複数', 'ハラル和牛ラーメン（牛骨白湯・スパイシー味噌）', 'high', 'approved', 'https://gyumon-group.com/ramen-asakusa/en/', '牛骨白湯とスパイシー味噌の複数系統を提供している。'),
    ('ChIJazjtQgCNGGARO606yF6kY7I', '複数', '濃厚豚骨魚介つけ麺', 'high', 'approved', 'https://tsukemen-tsujita.com/information/tsujita-kandasuehirocho/', '豚骨と魚介を合わせた濃厚つけ麺として案内されている。'),
    ('ChIJ_VgnCwCPGGARRLda5HVnuw0', '未確認', '神戸牛ラーメン・ステーキレストラン', 'medium', 'approved', 'https://daia.koubegyuu.com/store/', '神戸牛ラーメンの提供は確認できるが、スープ系統を特定できない。'),
    ('ChIJrTTMInCPGGAR1XfX02rt-fs', '複数', 'ハラル和牛・鶏ラーメン（白湯・清湯・味噌・辛味・ヴィーガン対応）', 'high', 'approved', 'https://www.shunpudou.com/menu', '複数のスープ系統とヴィーガン対応メニューを提供している。')
)
update public.ramen_shops as shop
set
  researched_soup_type = research.researched_soup_type,
  researched_style = research.researched_style,
  research_confidence = research.research_confidence,
  research_status = research.research_status,
  research_evidence_url = research.research_evidence_url,
  research_evidence_summary = research.research_evidence_summary,
  research_updated_at = now()
from research
where shop.place_id = research.place_id;

notify pgrst, 'reload schema';
