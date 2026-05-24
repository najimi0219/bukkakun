# AI電話受付サービス — 構想メモ

> 作成日: 2026-05-17
> ステータス: **保留 (Phase 2)** — BukkenLink (Web 問合せ管理) ベータ運用後に着手

---

## 1. サービス概要

不動産会社向けの **AI電話受付・要件整理・通知自動化サービス**。

AI が電話一次対応を行い、以下を自動化する：

- 名前確認
- 要件ヒアリング
- FAQ 回答
- 担当者への通知
- 通話内容要約
- 管理画面保存

### 不動産業界特化シナリオ
- 物件確認 (物確)
- 広告掲載確認 (広告料、先物)
- 内見予約
- 売却相談
- 空室確認
- 折返し依頼

---

## 2. 業界課題と価値仮説

電話依存の強い不動産業界では、

- 営業中で電話に出られない
- 夜間・休日の取りこぼし
- 要件メモ漏れ
- 担当への伝達漏れ
- 機会損失

が慢性的に発生。特に **売却相談・未公開案件・内見予約** は、1本の取りこぼしが数十万〜数百万円規模の機会損失につながる。

**価値仮説**: AI が 24時間365日 一次受付を代行 → 取りこぼしを最小化、要件メモを構造化、担当者の応答スピードを向上。

---

## 3. BukkenLink との関係 — **別アプリ + データ共有**

### 採用方針: ハイブリッド

「ユーザーから見ると1サービス、技術的には2サービス」。

```
┌────────────────────────────────┐    ┌────────────────────────────────┐
│  BukkenLink (現行)              │    │  BukkenLink Voice (将来)        │
│  ─────────                      │    │  ─────────                      │
│  Next.js + Vercel + Supabase    │    │  Vapi or 自作 on Fly.io          │
│  Web 問合せ / 物件管理 / カンバン  │    │  電話受付 / 通話要約 / FAQ        │
│  bukkakun.vercel.app            │    │  voice.bukkakun.vercel.app      │
└────────────────────────────────┘    └────────────────────────────────┘
              ↓ 共有 ↑                              ↓ 共有 ↑
       ┌──────────────────────────────────────────────┐
       │            Supabase (DB)                     │
       │  tenants, users, properties, inquiries...    │
       │  + call_logs, call_summaries (新規)          │
       └──────────────────────────────────────────────┘
```

### 共有すべきもの (初日から)
1. `tenant_id` / アカウント体系 (同じ Supabase の tenants/users)
2. データの相互流入: 電話受付の問合せを `inquiries` テーブルに `kind="phone"` で書き込み → BukkenLink のカンバンに統合表示
3. UI 上の見え方: 同じサイドバーから両方アクセス可、SSO

### なぜ別アプリか
BukkenLink は **Next.js + Vercel Serverless + Supabase** = 「ステートレス・短命リクエスト」前提。
AI電話受付は本質的に **永続接続 + リアルタイム音声ストリーム** が必要 → Vercel functions では物理的に動かない。

| 必要な機能 | Vercel Serverless |
|---|---|
| 電話の着信受け (SIP/Twilio Voice) | Webhook受けは可、リアルタイム音声 ✗ |
| WebSocket 永続接続 (音声双方向ストリーム) | ✗ (最大10秒/60秒) |
| STT ストリーミング (Deepgram等) | ✗ |
| TTS リアルタイム返答 | ✗ |
| 通話中の対話状態管理 | ✗ (ステートフル不可) |

→ Fly.io / Railway / Cloudflare Workers Durable Objects / AWS ECS のような「常時稼働 + WebSocket OK」な環境、もしくは Vapi / Retell / Pipecat 等の **AI Voice Platform** を使う。

---

## 4. 技術スタック候補

### 案A: マネージドプラットフォーム (推奨・MVP 早い)
- **Vapi.ai** または **Retell AI**
- 電話番号購入 → Webhook で自社ロジック → 内蔵で STT/LLM/TTS パイプライン
- LLM は Claude / GPT を選択可
- 1分あたり $0.05〜0.10 + telephony
- **MVP 1〜2週間**

### 案B: 自前構築 (カスタマイズ重視)
- **Twilio Voice** + **Deepgram (STT)** + **Claude (LLM)** + **ElevenLabs (TTS)**
- 1分あたり $0.03〜0.06
- インフラ運用必要 (Fly.io 等)
- **MVP 2〜3ヶ月**

### 推奨: **案A の Vapi で MVP → 軌道に乗ったら自前へ移行**

### 日本語名刺・対話精度
- STT: **Deepgram Nova-2 / AssemblyAI Universal-2** どちらも日本語対応
- TTS: **ElevenLabs** が日本語自然 (OpenAI TTS-1 も可)
- LLM: **Claude Sonnet / Haiku** が日本語の業界用語に強い

不動産特化用語 (物確・先物・広告料・鍵現地・ローン特約) は LLM の **System Prompt に注入** で対応可能。

---

## 5. 想定機能

### AI 対応
1. **電話受付**: 会社名案内 → 名前確認 → 電話番号確認 → 用件確認
2. **AI 回答**: 登録済み FAQ・ルールに基づき自動応答 (営業時間 / 内見方法 / 鍵の受け渡し / 必要書類 / 広告掲載可否 等)
3. **エスカレーション**: AI が判断不能 → 担当者へ通知 (Slack/メール)、折返し依頼、通話内容要約送信

### 管理画面
- 通話履歴一覧
- AI 要約
- 要件分類 (物確 / 内見 / 売却相談 / 空室 / 折返し / その他)
- 顧客情報管理
- 担当者割振り
- 検索・フィルタ
- Slack / メール通知設定

---

## 6. 競合優位性

### 不動産特化
- 一般 AI 電話サービスは業界知識が弱い
- 「物確」「先物」「広告料」「鍵現地」「ローン特約」等の業界用語・フローを理解

### 低導入コスト
- 想定価格 月額 9,800円〜 (中小不動産でも導入しやすい)

### 利益防衛型 AI 原価制御
- AI 音声は利用量で原価変動 → 内部原価監視 + 利用率通知 + **自動簡易受付モード切替** を実装
- 70% 到達 → 「今月のAI利用量が70%に到達」ユーザー通知
- 100% 到達 → 簡易受付モード (録音 + 折返し依頼) に自動切替
- **完全停止はせず、受付機能は維持**

---

## 7. 料金体系 (要再設計)

### 暫定案
- **ライト 月額 9,800円**: AI 受付 / 要件整理 / Slack 通知 / メール通知
- **スタンダード 月額 29,800円**: AI 会話強化 / FAQ 回答 / 複数担当 / CRM 連携
- **プロ 月額 79,800円〜**: 複数店舗 / 高度分析 / AI 営業支援 / API 連携 / カスタム対応

### コスト・利益率リアリティチェック

**1通話3分の Vapi 利用前提**:
- Telephony (Twilio Japan inbound): ¥6 × 3min = ¥18
- Vapi (STT + LLM + TTS): $0.08 × 3 = $0.24 ≈ ¥36
- LLM 追加 (長い対話): ¥10〜30
- **合計: 約 ¥65〜85 / 通話**

月額9,800円プラン + 200通話/月 = 原価 ¥13,000〜17,000 → **赤字**

### 通話数キャップ必須 (再設計案)
| プラン | 月額 | 通話数上限 | 想定原価 | 粗利 |
|---|---|---|---|---|
| ライト | ¥9,800 | 50通話 | ¥4,000 | 約 60% |
| スタンダード | ¥29,800 | 200通話 | ¥14,000 | 約 53% |
| プロ | ¥79,800 | 1000通話 + 複数店舗 | 要設計 | 要設計 |

→ **70/100% 制御は必須**。コスト管理失敗のリスク大。

---

## 8. ロードマップ

### Phase 1 — 現在: BukkenLink を磨く
- Web 問合せ管理をベータで安定化
- 数社にバラまいてフィードバック収集
- **電話機能はまだ入れない**

### Phase 2 — 5〜10 社のフィードバック後
- ヒアリングで「電話の方が来る」「夜間取りこぼし困る」と裏取れたら GO
- Voice 用 Supabase テーブル設計 (`call_logs`, `phone_inquiries` 等)
- **Vapi 試作 (1〜2 週間)**
- BukkenLink 側にサイドバーリンク追加、`/phone-inquiries` ページ追加

### Phase 3 — β販売
- 既存 BukkenLink テナントに「電話受付プラン」アドオン
- 1社で月20〜100 通話の規模感を実測
- 料金体系の再設計

### 将来展開 (Phase 4+)
- 通話データ資産化: エリア需要分析 / 売却相談傾向 / 成約率分析 / 営業トーク最適化
- LINE 連携 / AI 自動折返し / 内見自動予約
- レインズ連携 / マイソク OCR / AI 査定 / AI 営業支援

---

## 9. データモデル設計 (草案)

```sql
-- 新規テーブル
CREATE TABLE call_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  caller_phone    TEXT NOT NULL,
  caller_name     TEXT,
  duration_sec    INT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  recording_url   TEXT,           -- Vapi/Twilio が返す録音URL
  transcript      TEXT,           -- 全文文字起こし
  ai_summary      TEXT,           -- AI 要約
  ai_category     TEXT,           -- "物確"/"内見"/"売却相談"/etc
  status          TEXT,           -- "ai_handled" / "escalated" / "missed"
  assigned_user_id UUID REFERENCES users(id),
  inquiry_id      UUID REFERENCES inquiries(id), -- 既存 inquiries 連携
  cost_yen        INT,            -- 原価管理
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE call_faqs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trigger_keywords TEXT[],
  answer          TEXT,
  priority        INT DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE call_usage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  month           DATE NOT NULL,
  call_count      INT DEFAULT 0,
  total_minutes   NUMERIC DEFAULT 0,
  total_cost_yen  INT DEFAULT 0,
  plan_limit      INT,           -- そのテナントのプラン上限
  UNIQUE (tenant_id, month)
);

-- 既存 inquiries テーブルへの追加
ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS call_log_id UUID REFERENCES call_logs(id),
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'web'; -- "web" / "phone"
```

---

## 10. 次にやる時に思い出すこと

- **着手前に BukkenLink で 5〜10 社のフィードバックを必ず取る** — 業界の流れ・用語・現場の困り事を肌で理解してから入る方が遥かに良いプロダクトになる
- **電話受付サービスは「テクノロジー」より「業務理解と運用」がカネを生む**
- **通話数キャップ + 利用率制御は MVP から組み込む** (後付けは大変)
- **データは BukkenLink と完全に共有** (tenant_id ベース)
- **Vapi で素早く検証 → 自前は採算が見えてから**

---

*メモ: このドキュメントは将来の自分が「やる気が出た時にすぐ着手できる」ためのもの。アーキテクチャ判断・コスト見積・スケジュール感は最新の状況を見て更新すること。*
