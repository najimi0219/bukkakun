# BukkenLink — 物件問い合わせ管理 SaaS

仕様書 `仕様書.pdf` に基づいた **Next.js 14 + TypeScript + Supabase (ローカル)** プロトタイプ実装です。

開発モードでは **認証はバイパス** されており、あなた(`info@najimi-llc.com`) として常時ログイン状態です。仕様策定が固まったら Supabase Auth を有効化します。

## セットアップ手順

### 0. 前提

- Node.js 18+
- Docker Desktop(起動状態)
- Supabase CLI(`supabase --version` で確認)

### 1. 依存をインストール

```powershell
npm install
```

### 2. ローカル Supabase を起動

```powershell
supabase start
```

初回はDocker イメージのダウンロードで5〜10分かかります。完了すると以下が立ち上がります:

| サービス | URL |
| --- | --- |
| API | http://127.0.0.1:54321 |
| Studio (DB GUI) | http://127.0.0.1:54323 |
| Inbucket (テストメール受信) | http://127.0.0.1:54324 |
| Postgres | postgresql://postgres:postgres@127.0.0.1:54322/postgres |

API/anon keys は `.env.local` に既定値が入っています(ローカル Supabase の固定値)。
もし `supabase start` の出力と異なる場合は `.env.local` を更新してください。

### 3. Next.js 開発サーバを起動

```powershell
npm run dev
```

→ http://localhost:3456 を開く

開いた瞬間に Supabase からデータを取得し、ダッシュボードが表示されます。
ログイン画面は出ません(認証バイパス中)。

### 4. (任意)Supabase Studio でデータを覗く

http://127.0.0.1:54323 を開けば全テーブルが見えます。`supabase/seed.sql` で初期投入された
テナント・物件・問い合わせ等が確認できます。

## よく使うコマンド

```powershell
# ローカル Supabase を停止
supabase stop

# DB を初期化(全マイグレーション + seed.sql を再適用)
supabase db reset

# 新しいマイグレーションを作成
supabase migration new <name>

# マイグレーションを本番に push (本番化フェーズで使う)
supabase link --project-ref <prod-ref>
supabase db push
```

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│  Next.js 14 (App Router) — http://localhost:3456       │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ React Components (UI: 既存のまま)               │   │
│  │   ├ get*()     ← 同期で in-memory cache から   │   │
│  │   └ create*()  ← 即時 cache 更新 + DB 書き込み │   │
│  └────────────┬────────────────────────────────────┘   │
│               │                                         │
│  ┌────────────▼────────────────────────────────────┐   │
│  │ lib/store.ts — cache-first レイヤ              │   │
│  │   - initStore() で全テーブルを Supabase から取得│   │
│  │   - 全 CRUD は cache → notify → fire-and-forget │   │
│  │     で Supabase に同期                          │   │
│  └────────────┬────────────────────────────────────┘   │
│               │ @supabase/supabase-js                  │
└───────────────┼─────────────────────────────────────────┘
                │
        ┌───────▼────────┐
        │ Supabase Local │
        │  (Docker)      │
        │ ┌──────────┐   │
        │ │ Postgres │   │  ← supabase/migrations/*.sql
        │ │ Storage  │   │  ← property-documents バケット
        │ │ Auth     │   │  ← (現在は使用していない)
        │ └──────────┘   │
        └────────────────┘
```

## 主要画面 (仕様書 §6 完全網羅)

### 公開側

| パス                                 | 機能                                         |
| ------------------------------------ | -------------------------------------------- |
| `/`                                  | ランディングページ                           |
| `/form/[token]`                      | 物件問い合わせフォーム (QR遷移先)            |
| `/form/[token]/success`              | 送信完了画面                                 |
| `/download/[token]`                  | 資料ダウンロード(期限・回数・ログ記録付き)|

### 管理側 (テナント)

| パス                              | 機能                                       |
| --------------------------------- | ------------------------------------------ |
| `/dashboard`                      | サマリ・推移グラフ・物件別ランキング       |
| `/properties`                     | 物件一覧 (検索・フィルタ)                  |
| `/properties/new` / `/[id]/edit`  | 物件登録・編集 (資料アップロード→Storage) |
| `/properties/[id]`                | 物件詳細 (フォームURL/QRコード生成)        |
| `/inquiries`                      | 問い合わせカンバン (Drag&Drop) / 一覧 / CSV |
| `/inbox`                          | 送信メール履歴 (デモ)                       |
| `/settings/users`                 | メンバー管理 (招待・ロール)                |
| `/settings/storage`               | ストレージ接続 (GDrive/Dropbox/OneDrive/Box/S3) |
| `/settings/email-templates`       | メールテンプレート管理 (変数差し込み)      |
| `/settings/notifications`         | 通知設定 (Email/Slack/LINE/Chatwork)       |
| `/settings/company`               | 会社情報・ロゴ                             |
| `/settings/billing`               | プラン変更・ストレージ利用状況             |

### スーパー管理者側 (admin ロール)

| パス                | 機能                       |
| ------------------- | -------------------------- |
| `/admin/tenants`    | 全テナント一覧             |
| `/admin/billing`    | 課金管理 / MRR             |
| `/admin/analytics`  | 全体統計                   |

## ファイルストレージ

物件資料はすべて Supabase Storage の **`property-documents`** バケットに保存されます。

- **アップロード**:`{tenant_id}/{property_id}/{timestamp}_{filename}` のパスに配置
- **ダウンロード**:`createSignedUrl(path, 60)` で60秒有効な署名付きURL を発行
- **アクセスログ**:DLボタン押下時に `download_logs` テーブルに INSERT(IP/UA/日時)

将来 Google Drive / Dropbox 等のテナント自前クラウドが本物 OAuth で接続されたら、
バケットアップロードを各プロバイダ SDK に差し替える設計です(`storage_provider` カラムで判別)。

## まだモックの部分

| 機能       | 現状             | 本番化での置き換え先     |
| ---------- | ---------------- | ------------------------ |
| 認証       | バイパス(自分固定)| Supabase Auth            |
| メール送信 | `/inbox` に記録   | Resend (本物)            |
| 決済       | プラン即時変更    | Stripe Checkout + Webhook |
| クラウド OAuth | モーダルだけ     | 各社 OAuth + ファイルピッカー |
| reCAPTCHA  | UI のみ          | reCAPTCHA v3             |

## デモのリセット方法

```powershell
# DBをまっさらにして seed.sql 再投入
supabase db reset
```

`/settings/billing` 最下部のボタンは Supabase Storage のバケットを空にしないので、
完全にクリーンな状態にするには上記コマンドが確実です。

## トラブルシューティング

**「読み込み中…」のまま進まない**
→ `supabase start` が完了しているか、Docker が動いているか確認。

**`relation "..." does not exist`**
→ マイグレーションが当たっていません。`supabase db reset` で再適用。

**ファイルアップロードが失敗する**
→ `property-documents` バケットがあるか Studio で確認。無ければ `supabase db reset`。

**ポート競合 (54321/54322 等)**
→ 他の Supabase プロジェクトが動いていないか:`supabase stop --all`
