-- 物件の販売状況 (public な公開/申込/商談中/終了) と「最終確認日時」、
-- 確認メール頻度を追加。
--
-- - status (既存): 'published' / 'draft' = 公開設定 (フォームに出すかどうか)
-- - availability_status (新): 'available' / 'reserved' / 'negotiating' / 'closed'
--   = その物件の販売ステータス。業者は「最終確認 X 月 Y 日時点で公開中」を見たい。

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS availability_status TEXT NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS availability_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS verification_frequency_days INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS verification_email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS verification_last_emailed_at TIMESTAMPTZ;
