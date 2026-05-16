-- BukkenLink initial schema
-- Mirrors lib/types.ts (spec §5)

-- ============================================================
-- ENUMs
-- ============================================================
CREATE TYPE plan AS ENUM ('free', 'standard', 'pro');
CREATE TYPE user_role AS ENUM ('admin', 'sales', 'viewer');
CREATE TYPE property_type AS ENUM ('land', 'house', 'mansion', 'income', 'business');
CREATE TYPE property_status AS ENUM ('published', 'draft');
CREATE TYPE inquiry_status AS ENUM ('new', 'in_progress', 'negotiating', 'closed', 'rejected');
CREATE TYPE inquiry_action_type AS ENUM ('status_change', 'note', 'email_sent');
CREATE TYPE notification_timing AS ENUM ('immediate', 'daily');
CREATE TYPE storage_provider AS ENUM ('bukkenlink', 'gdrive', 'dropbox', 'onedrive', 'box', 's3');
CREATE TYPE storage_status AS ENUM ('connected', 'expired', 'error');
CREATE TYPE sent_email_kind AS ENUM ('auto_reply', 'manual', 'notification');

-- ============================================================
-- Tables
-- ============================================================

-- Tenants (real estate companies)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  license_number TEXT NOT NULL,
  logo_url TEXT,
  plan plan NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Internal users (members of a tenant)
-- NOTE: For dev, we don't use Supabase Auth yet. This `id` is a plain UUID.
-- When auth is enabled, this `id` will reference auth.users(id).
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'sales',
  -- Legacy/demo password column (not used once Supabase Auth is wired)
  password TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_tenant ON users(tenant_id);

-- Properties
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  property_type property_type NOT NULL,
  address TEXT NOT NULL,
  price BIGINT NOT NULL,
  land_area NUMERIC,
  building_area NUMERIC,
  built_year_month TEXT,
  transport TEXT,
  description TEXT,
  reins_id TEXT,
  status property_status NOT NULL DEFAULT 'draft',
  form_token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_properties_tenant ON properties(tenant_id);
CREATE INDEX idx_properties_form_token ON properties(form_token);
CREATE INDEX idx_properties_status ON properties(status);

-- Property assignees (many-to-many)
CREATE TABLE property_assignees (
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (property_id, user_id)
);
CREATE INDEX idx_property_assignees_user ON property_assignees(user_id);

-- Storage connections (BYO Cloud Storage)
CREATE TABLE storage_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider storage_provider NOT NULL,
  display_name TEXT NOT NULL,
  account_email TEXT,
  root_folder_id TEXT,
  root_folder_name TEXT,
  status storage_status NOT NULL DEFAULT 'connected',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  -- Production: encrypted_access_token, encrypted_refresh_token, expires_at
  -- For now: just a hint string for the demo
  mock_token_hint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_storage_connections_tenant ON storage_connections(tenant_id);

-- Property documents (metadata only; bytes live in Supabase Storage or the tenant's cloud)
CREATE TABLE property_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  storage_connection_id UUID REFERENCES storage_connections(id) ON DELETE SET NULL,
  storage_provider storage_provider NOT NULL DEFAULT 'bukkenlink',
  -- For BukkenLink-hosted: object path in Supabase Storage `property-documents` bucket
  -- For external (Drive/Dropbox/etc.): the provider's file_id
  external_file_id TEXT NOT NULL,
  external_view_url TEXT,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_property_documents_property ON property_documents(property_id);

-- Inquiries (from outside agents via the public form)
CREATE TABLE inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  license_number TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT,
  status inquiry_status NOT NULL DEFAULT 'new',
  download_token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  token_expires_at TIMESTAMPTZ NOT NULL,
  download_count INT NOT NULL DEFAULT 0,
  download_limit INT NOT NULL DEFAULT 10,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_inquiries_tenant ON inquiries(tenant_id);
CREATE INDEX idx_inquiries_property ON inquiries(property_id);
CREATE INDEX idx_inquiries_token ON inquiries(download_token);
CREATE INDEX idx_inquiries_status ON inquiries(status);
CREATE INDEX idx_inquiries_created_at ON inquiries(created_at DESC);

-- Inquiry response logs (status changes, notes, emails)
CREATE TABLE inquiry_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action_type inquiry_action_type NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_inquiry_logs_inquiry ON inquiry_logs(inquiry_id);

-- Download access logs
CREATE TABLE download_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES property_documents(id) ON DELETE CASCADE,
  ip_address INET,
  user_agent TEXT,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_download_logs_inquiry ON download_logs(inquiry_id);

-- Email templates
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_email_templates_tenant ON email_templates(tenant_id);

-- Notification settings (1 row per tenant)
CREATE TABLE notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email_recipients TEXT[] NOT NULL DEFAULT '{}',
  slack_webhook TEXT,
  line_token TEXT,
  chatwork_token TEXT,
  timing notification_timing NOT NULL DEFAULT 'immediate'
);

-- Sent emails (mock outbox - real sending will go through Resend later)
CREATE TABLE sent_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  to_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  kind sent_email_kind NOT NULL DEFAULT 'manual',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sent_emails_tenant ON sent_emails(tenant_id);
CREATE INDEX idx_sent_emails_sent_at ON sent_emails(sent_at DESC);

-- ============================================================
-- Triggers
-- ============================================================

-- Enforce single default email template per tenant
CREATE OR REPLACE FUNCTION enforce_single_default_template()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE email_templates
       SET is_default = FALSE
     WHERE tenant_id = NEW.tenant_id
       AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_email_templates_single_default
  BEFORE INSERT OR UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION enforce_single_default_template();

-- Enforce single default storage connection per tenant
CREATE OR REPLACE FUNCTION enforce_single_default_storage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE storage_connections
       SET is_default = FALSE
     WHERE tenant_id = NEW.tenant_id
       AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_storage_connections_single_default
  BEFORE INSERT OR UPDATE ON storage_connections
  FOR EACH ROW EXECUTE FUNCTION enforce_single_default_storage();

-- Increment download_count when a download log is added
CREATE OR REPLACE FUNCTION bump_inquiry_download_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inquiries
     SET download_count = download_count + 1
   WHERE id = NEW.inquiry_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_download_logs_bump_count
  AFTER INSERT ON download_logs
  FOR EACH ROW EXECUTE FUNCTION bump_inquiry_download_count();

-- ============================================================
-- Storage bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-documents',
  'property-documents',
  FALSE,
  52428800, -- 50 MiB
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-logos',
  'tenant-logos',
  TRUE,
  2097152, -- 2 MiB
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Row Level Security
-- ----------
-- For dev (auth-bypassed mode): policies are permissive (`USING (true)`).
-- When Supabase Auth is wired, replace these with auth.uid()-based policies
-- using the helper view current_user_tenant_id().
-- ============================================================
ALTER TABLE tenants               ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties            ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_assignees    ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_connections   ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_documents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries             ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiry_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sent_emails           ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dev_all" ON tenants               FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "dev_all" ON users                 FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "dev_all" ON properties            FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "dev_all" ON property_assignees    FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "dev_all" ON storage_connections   FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "dev_all" ON property_documents    FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "dev_all" ON inquiries             FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "dev_all" ON inquiry_logs          FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "dev_all" ON download_logs         FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "dev_all" ON email_templates       FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "dev_all" ON notification_settings FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "dev_all" ON sent_emails           FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- Storage RLS (allow all on the buckets for now — tighten later)
CREATE POLICY "dev_all_property_docs"
  ON storage.objects FOR ALL
  USING (bucket_id = 'property-documents')
  WITH CHECK (bucket_id = 'property-documents');

CREATE POLICY "dev_all_tenant_logos"
  ON storage.objects FOR ALL
  USING (bucket_id = 'tenant-logos')
  WITH CHECK (bucket_id = 'tenant-logos');
