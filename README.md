# TOKYO RAMEN GUIDE

東京全域のラーメン店を検索する Next.js 15 アプリケーションです。Google Places API (New) から店舗情報を取得し、Supabase に Place ID 単位で重複なく保存します。標準取込は5,000店を上限とし、既存データを更新しません。

## 機能

- キーワード（店名・住所）検索、評価順／新着順、一覧／Google Map 切り替え
- 店舗詳細：地図、営業時間、評価・口コミ数、電話、公式サイト、価格帯、営業状況
- `POST /api/import` による東京全域データの取り込み
- `place_id` のユニーク制約と Supabase `upsert` による重複防止
- ブラウザのローカルストレージによるお気に入り（認証導入後は `favorites` テーブルへ移行可能）
- フェーズ2：ユーザー投稿の待ち時間、曜日・時間帯別の実績グラフ、天気・祝日・評価を加味した混雑予測
- 今週の東京ラーメン話題投稿：Web検索から週1回調査し、東京の店舗名・別名・地域名と照合して表示

## ローカル起動

```bash
cp .env.example .env.local
npm install
npm run dev
```

`http://localhost:3000` を開きます。環境変数を設定するまで画面は空の状態になります。

## Supabase 設定

1. [Supabase](https://supabase.com) で新規プロジェクトを作成します。
2. **SQL Editor** を開き、[`supabase/schema.sql`](./supabase/schema.sql) の内容を実行します。
3. **Project Settings → API** から Project URL、anon key、service_role key を取得します。
4. `.env.local` と Vercel の Environment Variables に以下を設定します。

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
```

`SUPABASE_SERVICE_ROLE_KEY` はサーバー専用です。`NEXT_PUBLIC_` を付けず、ブラウザ・GitHub・ログに出さないでください。SQL は店舗データの読み取りだけを公開し、書き込みはサービスロールを使う `/api/import` だけに限定しています。

### フェーズ2：混雑予測の設定

既存プロジェクトでは、Supabase SQL Editor で [`supabase/20260725_congestion_phase2.sql`](./supabase/20260725_congestion_phase2.sql) を一度実行してください。これにより、ユーザーが投稿した待ち時間を保存する `wait_reports` テーブルが作成されます。

店舗詳細では、同じ曜日・時間帯の投稿実績を優先して待ち時間を算出します。投稿数が少ない場合は店舗全体の実績とランチ／ディナーの時間帯を基準とし、高評価店・祝日／週末・雨を補正に使います。天気はキー不要のOpen-Meteo Forecast APIからサーバー側で取得します。実績が少ない段階では予測精度が低いため、画面上の信頼度とともに参考値として扱ってください。

### Google Maps URL・店舗写真の設定

既存プロジェクトでは、Supabase SQL Editor で [`supabase/20260725_shop_media.sql`](./supabase/20260725_shop_media.sql) を一度実行してください。その後、`POST /api/import` を再実行すると、各店舗のGoogle Maps URL、先頭の店舗写真、写真提供者情報を更新します。

写真は `GET /api/shop-photo` でサーバーが一時的な写真URLを取得して表示するため、`GOOGLE_PLACES_API_KEY` はブラウザに公開されません。Google Placesの写真取得と、`photos` フィールドを含む再取り込みは課金対象になり得るため、Google Cloudの予算アラートを設定してから実行してください。

### 食べログ百名店の表示

Supabase SQL Editorで [`supabase/20260726_tabelog_hyakumeiten_awards.sql`](./supabase/20260726_tabelog_hyakumeiten_awards.sql) を一度実行してください。このSQLは画面例「西永福の煮干箱」の2024年選出も初期登録します。管理画面の `/admin/research` から、利用権を確認したCSVを取り込めます。列は `award_year, listed_name, source_url, selection_date`（最終列は任意）です。店舗詳細では、自動一致した受賞レコードだけを「食べログ 百名店 2024」のようなバッジとして表示し、押すと根拠URLを開きます。

### AIによるスープ系統の調査（下書き→承認）

1. Supabase SQL Editor で [`supabase/20260725_researched_soup_types.sql`](./supabase/20260725_researched_soup_types.sql) を一度実行します。今回の10店は公開済み（`approved`）、残りは未調査（`pending`）になります。
2. OpenAI Platform のAPIキーを `OPENAI_API_KEY`、呼び出し保護用の十分長いランダム文字列を `RESEARCH_API_SECRET` として、Vercelの **Production** 環境変数に設定します。どちらもブラウザには公開しません。
3. 1回につき最大10店を、評価点・口コミ数が高い順に調査します。まず登録済みの公式サイト本文を低コストモデルで分類し、取得できない店舗だけを最大1回のWeb検索へ回します。根拠URLつきの結果はまず `draft` として保存され、`pending` かつ分類・根拠URLが未保存の店舗だけを対象にするため、過去に調査済みの店舗は再調査しません。公開前に確認してください。

```bash
# 未調査の最大10店をAIに調査させ、下書きとして保存する
curl -X POST https://your-domain.vercel.app/api/research/soup \
  -H "Content-Type: application/json" \
  -H "x-research-secret: $RESEARCH_API_SECRET" \
  -d '{"limit":10}'

# 下書きの確認（URL・分類・信頼度を返す）
curl https://your-domain.vercel.app/api/research/soup?status=draft \
  -H "x-research-secret: $RESEARCH_API_SECRET"

# 確認済みのPlace IDだけを公開する
curl -X POST https://your-domain.vercel.app/api/research/soup/approve \
  -H "Content-Type: application/json" \
  -H "x-research-secret: $RESEARCH_API_SECRET" \
  -d '{"placeIds":["ChIJ..."]}'
```

Windows PowerShellでは `$RESEARCH_API_SECRET` を `$env:RESEARCH_API_SECRET` に置き換えてください。`OPENAI_LOW_COST_RESEARCH_MODEL` の既定値は `gpt-5.4-nano` です。通常は最大3並列で処理し、Web検索は公式サイトを取得できなかった店舗だけに最大1回使います。下書きはサイトへ公開されず、承認済みの結果だけが店舗詳細の「スープ系統」に反映されます。

### 自動実行と承認画面

`vercel.json` は毎日 **12:15（日本時間）** に最大10店を調査し、結果を下書きに保存します。VercelのProduction環境変数へ `CRON_SECRET` を設定してください。Cronはこの値をBearerトークンとして送信します。

`RESEARCH_ADMIN_PASSWORD` もProduction環境変数へ設定すると、[`/admin/research`](/admin/research) で下書きの根拠URL・分類・信頼度を確認できます。画面から1店または10店を手動調査、承認、却下も行えます。ログイン状態は8時間で失効し、管理用パスワード・OpenAI APIキー・サービスロールキーはいずれもブラウザに送信されません。

### 今週の東京ラーメン話題投稿（Web調査）

Xの公開ポスト取得は使用せず、既存のOpenAI Responses APIの `web_search` を使って、直近7日間の東京ラーメン関連記事・店舗公式情報・ニュース・公開ブログを最大20件調査します。本文は長く転載せず、短い要約と出典URLだけを保存・表示します。

Supabase SQL Editorで [`supabase/20260728_web_ramen_mentions.sql`](./supabase/20260728_web_ramen_mentions.sql) を一度実行してください。このmigrationは次の3テーブルを作成します。

- `shop_aliases`: 店舗別名・表記揺れ
- `web_ramen_mentions`: Web調査結果、店舗/地域判定、出典、ランキング
- `web_fetch_logs`: Web調査の実行履歴と件数・エラー概要

既存の `OPENAI_API_KEY`、`OPENAI_LOW_COST_RESEARCH_MODEL`、`SUPABASE_SERVICE_ROLE_KEY`、`CRON_SECRET` を使用します。新しいX用トークンは不要です。管理画面 `/admin/research` の「今週の話題投稿」から「Web調査を実行」を押すと手動実行できます。

Vercel Cronは `/api/cron/web-ramen` を毎週 **日曜06:00（Asia/Tokyo）** に実行します。UTC設定は `0 21 * * 6` です。`CRON_SECRET` が一致しないリクエストは拒否し、実行中ログの一意制約で二重実行を防ぎます。

Web調査のランキングは、情報源の信頼性・東京/店舗との関連性・新しさを0〜100で評価し、投稿日時の代わりに記事公開日時で経過時間補正します。エラー時は管理画面、Vercel Functions Logs、`web_fetch_logs.error_summary` を確認してください。

### 食べログ百名店CSVの取込

利用権を確認したご自身のCSVだけを対象に、[`supabase/20260726_tabelog_hyakumeiten_awards.sql`](./supabase/20260726_tabelog_hyakumeiten_awards.sql) をSupabase SQL Editorで一度実行してから、`/admin/research` の「百名店の一括取込」を使います。CSVのヘッダーは次のとおりです。`selection_date` は任意です。

```csv
award_year,listed_name,source_url,selection_date
2024,店舗名,https://award.tabelog.com/hyakumeiten/ramen_tokyo/2024/,2024-12-03
```

取込時に既存のGoogle Places店舗名へ自動照合します。一致しない店舗・同名候補が複数ある店舗も保存され、`match_status` で後から確認できます。

## Google Places API (New) 設定

1. Google Cloud でプロジェクトと Billing を有効にします。
2. **Places API (New)** と **Maps JavaScript API** を有効にします。
3. キーを2本作成します。
   - **サーバーキー**: `Places API (New)` に API 制限し、`GOOGLE_PLACES_API_KEY` に設定。
   - **ブラウザキー**: `Maps JavaScript API` に API 制限し、HTTP referrer を `http://localhost:3000/*` と本番ドメインに制限。`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` に設定。
4. 取り込み保護用に十分長いランダム文字列を `IMPORT_API_SECRET` に設定します。

取り込みは、23区・26市・町村・島しょ部を含む東京都の全自治体を個別に最大3ページ検索します。検索結果は Place ID でメモリ上でも重複を除去し、最大2,000店をDBの `place_id` を競合キーにUPSERTします。Places API は課金対象のため、初回はリクエスト数を確認してから実行してください。

```bash
# 全東京エリアを最大2,000店まで取り込む（最大186回のText Search）
curl -X POST http://localhost:3000/api/import \
  -H "Content-Type: application/json" \
  -H "x-import-secret: $IMPORT_API_SECRET" \
  -d '{}'

# 任意のエリアだけ更新する
curl -X POST http://localhost:3000/api/import \
  -H "Content-Type: application/json" \
  -H "x-import-secret: $IMPORT_API_SECRET" \
  -d '{"query":"ラーメン 神保町"}'

# 取り込み上限を指定する（最大2,000店）
curl -X POST http://localhost:3000/api/import \
  -H "Content-Type: application/json" \
  -H "x-import-secret: $IMPORT_API_SECRET" \
  -d '{"target":2000}'
```

Windows PowerShell では `$IMPORT_API_SECRET` を `$env:IMPORT_API_SECRET` に置き換えてください。定期更新する場合は、Vercel Cron または外部スケジューラから同じエンドポイントを呼び出してください。

## Vercel デプロイ

1. リポジトリを GitHub に push します。
2. [Vercel](https://vercel.com) で **Add New → Project** を選び、リポジトリをImportします。
3. Framework Preset は **Next.js** のまま、上記5つの環境変数を Production / Preview / Development に設定します。
4. Deploy します。
5. Google Cloud のブラウザキーの HTTP referrer に `https://あなたのドメイン/*` を必ず追加します。

Vercel は Next.js を標準サポートするため追加設定は不要です。`SUPABASE_SERVICE_ROLE_KEY` と `IMPORT_API_SECRET` は Production にのみ設定する運用を推奨します。

## GitHub Actions

`.github/workflows/ci.yml` は pull request と `main` への push 時に以下を実行します。

```text
npm ci → typecheck → lint → build
```

テストは次で実行します。Web APIはモックするため、APIキーなしでも実行できます。

```bash
npm run test
```

ビルドは環境変数未設定でも成功する設計です。実際の画面表示とデータ取り込みには各環境変数を設定してください。

## プロジェクト構成

```text
src/app/api/import/route.ts  # Google Places (New) → Supabase UPSERT
src/app/api/cron/web-ramen/route.ts # Vercel Cron: Web調査 → Supabase
src/lib/web-ramen-client.ts   # OpenAI Responses web_searchクライアント（サーバー専用）
src/lib/web-ramen-jobs.ts     # 判定・重複UPSERT・実行ログ
src/app/api/shops/route.ts   # 店舗一覧検索API
src/app/shops/[id]/page.tsx  # 店舗詳細
src/components/              # 検索UI、Google Map、お気に入り
src/lib/google-places.ts     # Google Places API (New) クライアント
supabase/schema.sql          # テーブル・RLS・インデックス
```
