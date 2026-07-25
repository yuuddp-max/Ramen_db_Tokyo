# TOKYO RAMEN GUIDE

東京全域のラーメン店を検索する Next.js 15 アプリケーションです。Google Places API (New) から店舗情報を取得し、Supabase に Place ID 単位で重複なく保存します。

## 機能

- キーワード（店名・住所）検索、評価順／新着順、一覧／Google Map 切り替え
- 店舗詳細：地図、営業時間、評価・口コミ数、電話、公式サイト、価格帯、営業状況
- `POST /api/import` による東京全域データの取り込み
- `place_id` のユニーク制約と Supabase `upsert` による重複防止
- ブラウザのローカルストレージによるお気に入り（認証導入後は `favorites` テーブルへ移行可能）
- フェーズ2：ユーザー投稿の待ち時間、曜日・時間帯別の実績グラフ、天気・祝日・評価を加味した混雑予測

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

ビルドは環境変数未設定でも成功する設計です。実際の画面表示とデータ取り込みには各環境変数を設定してください。

## プロジェクト構成

```text
src/app/api/import/route.ts  # Google Places (New) → Supabase UPSERT
src/app/api/shops/route.ts   # 店舗一覧検索API
src/app/shops/[id]/page.tsx  # 店舗詳細
src/components/              # 検索UI、Google Map、お気に入り
src/lib/google-places.ts     # Google Places API (New) クライアント
supabase/schema.sql          # テーブル・RLS・インデックス
```
