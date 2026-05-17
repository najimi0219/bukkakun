-- Add business card image to inquiry submissions.
-- The file lives in the business-cards bucket, path scoped per-tenant:
--   tenants/{tenant_id}/inquiries/{inquiry_id}/card.{ext}
-- so only the tenant admin sees it via signed URL from the inquiry detail.

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS business_card_url TEXT;
