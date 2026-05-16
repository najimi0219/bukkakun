/**
 * The actual demo data lives in `supabase/seed.sql` and runs automatically
 * on `supabase start` / `supabase db reset`.
 *
 * This file is kept only as a no-op fallback for callers that haven't been
 * migrated yet.
 */

import type { DB } from "./types";

export function seedDB(): DB {
  return {
    tenants: [],
    users: [],
    properties: [],
    property_documents: [],
    storage_connections: [],
    inquiries: [],
    inquiry_logs: [],
    download_logs: [],
    email_templates: [],
    notification_settings: [],
    email_send_settings: [],
    sent_emails: [],
    session: null,
  };
}
