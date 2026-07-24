# TOKYO RAMEN GUIDE

東京全域のラーメン店を検索する Next.js 15 アプリケーションです。Google Places API (New) から店舗情報を取得し、Supabase に Place ID 単位で重複なく保存します。

## 機能

- キーワード（店名・住所）検索、評価順／新着順、一覧／Google Map 切り替え
- 店舗詳細：地図、営業時間、評価・口コミ数、電話、公式サイト、価格帯、営業状況
- `POST /api/import` による東京全域データの取り込み
- `place_id` のユニーク制約と Supabase `upsert` による重複防止
- ブラウザのローカルストレージによるお気に入り（認証導入後は `favorites` テーブルへ移行可能）

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
```

`SUPABASE_SERVICE_ROLE_KEY` はサーバー専用です。`NEXT_PUBLIC_` を付けず、ブラウザ・GitHub・ログに出さないでください。SQL は店舗データの読み取りだけを公開し、書き込みはサービスロールを使う `/api/import` だけに限定しています。

## Google Places API (New) 設定

1. Google Cloud でプロジェクトと Billing を有効にします。
2. **Places API (New)** と **Maps JavaScript API** を有効にします。
3. キーを2本作成します。
   - **サーバーキー**: `Places API (New)` に API 制限し、`GOOGLE_PLACES_API_KEY` に設定。
   - **ブラウザキー**: `Maps JavaScript API` に API 制限し、HTTP referrer を `http://localhost:3000/*` と本番ドメインに制限。`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` に設定。
4. 取り込み保護用に十分長いランダム文字列を `IMPORT_API_SECRET` に設定します。

取り込みは、23区・26市・町村・島しょ部を含む東京都の全自治体を個別に検索します。検索結果は Place ID でメモリ上でも重複を除去し、DBでは `place_id` を競合キーに UPSERT します。Places API は課金対象のため、初回はリクエスト数を確認してから実行してください。

```bash
# 全東京エリアを取り込む（最大62回のText Search）
curl -X POST http://localhost:3000/api/import \
  -H "Content-Type: application/json" \
  -H "x-import-secret: $IMPORT_API_SECRET" \
  -d '{}'

# 任意のエリアだけ更新する
curl -X POST http://localhost:3000/api/import \
  -H "Content-Type: application/json" \
  -H "x-import-secret: $IMPORT_API_SECRET" \
  -d '{"query":"ラーメン 神保町"}'
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
