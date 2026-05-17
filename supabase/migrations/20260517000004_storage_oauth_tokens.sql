-- Real OAuth token columns for storage_connections (Google Drive first).
--
-- TODO (post-beta): encrypt these at rest with a server-only KMS key.
-- For the beta we store them in plaintext, protected by the open RLS
-- policy + only being writable via the service-role API routes.

ALTER TABLE storage_connections
  ADD COLUMN IF NOT EXISTS access_token TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scope TEXT;

-- The BukkenLink folder created on the tenant's Drive after first connect.
-- All uploads land under this folder so the user can find them easily.
-- (We already have root_folder_id / root_folder_name from the demo schema —
-- the real OAuth flow reuses those columns to store the actual Drive
-- folder id and name.)
