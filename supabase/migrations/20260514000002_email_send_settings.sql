-- BukkenLink: Email send mode (per tenant)
--
-- ① relay_with_cc       … BukkenLink ドメインから送信、テナント宛にCc
-- ② custom_domain        … テナント自社ドメインから送信(DNS認証要)

CREATE TYPE email_send_mode AS ENUM ('relay_with_cc', 'custom_domain');
CREATE TYPE domain_verification_status AS ENUM (
  'not_started',
  'pending',
  'verified',
  'failed'
);

CREATE TABLE email_send_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  mode email_send_mode NOT NULL DEFAULT 'relay_with_cc',

  -- From "山田太郎 <no-reply@bukkenlink.com>" 等の表示名
  from_display_name TEXT,
  -- 実際のFromアドレス
  -- mode=relay_with_cc → 自動で no-reply@bukkenlink.com (このカラムは未使用)
  -- mode=custom_domain → no-reply@najimi-llc.com 等
  from_email TEXT,
  -- 業者の「返信」が向かう先(両モード共通)
  reply_to_email TEXT NOT NULL,
  -- Cc 宛先(relay_with_cc モード時のみ使用、複数可)
  cc_emails TEXT[] NOT NULL DEFAULT '{}',

  -- ↓ custom_domain モード時のドメイン認証
  custom_domain TEXT,                            -- 例:najimi-llc.com
  detected_dns_provider TEXT,                    -- "cloudflare" / "onamae" / "muumuu" / "xserver" / "google_domains" / "route53" / "unknown"
  detected_mail_provider TEXT,                   -- "google_workspace" / "microsoft365" / "self_hosted" / "unknown"
  detected_existing_spf TEXT,                    -- 現在の SPF レコード(マージ提案用)
  verification_status domain_verification_status NOT NULL DEFAULT 'not_started',
  verification_last_checked_at TIMESTAMPTZ,
  verification_dns_records JSONB,                -- Resend から発行された SPF/DKIM/MX レコードのスナップショット
  verification_error TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_send_settings_tenant ON email_send_settings(tenant_id);

-- updated_at を自動更新するトリガ
CREATE OR REPLACE FUNCTION touch_email_send_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_email_send_settings_updated_at
  BEFORE UPDATE ON email_send_settings
  FOR EACH ROW EXECUTE FUNCTION touch_email_send_settings_updated_at();

ALTER TABLE email_send_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_all" ON email_send_settings FOR ALL USING (TRUE) WITH CHECK (TRUE);
