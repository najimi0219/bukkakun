-- 問い合わせ種別 (5種) のスキーマ拡張

-- ----- 物件側 -----
-- 公開フォームで番地まで表示するかどうか。OFF にすると "東京都千代田区..." 等の
-- 市区町村までで打ち切って表示し、所在確認 (kind="location") の自動返信で
-- 初めて番地を送る、という運用が出来る。デフォルトは ON (今までと同じ挙動)。
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS show_address BOOLEAN NOT NULL DEFAULT TRUE;

-- 内見対応設定
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS viewing_available BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS viewing_methods TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS viewing_key_pickup_info TEXT,
  ADD COLUMN IF NOT EXISTS viewing_key_box_code TEXT,
  ADD COLUMN IF NOT EXISTS viewing_notes TEXT;

-- ----- 問い合わせ側 -----
-- 種別:
--   "location"   : 所在確認
--   "documents"  : 資料請求 (デフォルト・後方互換)
--   "viewing"    : 案内 (内見) 希望
--   "other"      : その他質問
--   "offer"      : 買付送付
ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'documents';

-- 内見希望 (kind="viewing") の自由テキスト + 選択された方法
ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS viewing_preferred_at TEXT,
  ADD COLUMN IF NOT EXISTS viewing_method TEXT;

-- 買付ファイル (kind="offer")
ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS offer_document_url TEXT,
  ADD COLUMN IF NOT EXISTS offer_document_provider TEXT;
