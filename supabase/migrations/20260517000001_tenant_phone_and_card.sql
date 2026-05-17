-- Add tenant phone + business card image columns
-- Both optional. business_card_url points to a file in the tenant-logos
-- bucket (Supabase Storage), uploaded during /signup or later from the
-- 会社情報 settings page.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS business_card_url TEXT;
