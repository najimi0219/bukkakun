-- Track which storage provider holds the inquirer's business card.
-- "bukkenlink"  = stored in our Supabase business-cards bucket
-- "gdrive"      = stored in the tenant's connected Google Drive
ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS business_card_provider TEXT;
