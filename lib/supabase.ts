"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    "[BukkenLink] NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Did you create .env.local?"
  );
}

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      // Auth is bypassed in dev. Disable session persistence to avoid stray cookies.
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  });
  return _client;
}

// Hardcoded "you" while auth is bypassed.
// These IDs come from supabase/seed.sql.
export const DEV_USER_ID =
  process.env.NEXT_PUBLIC_DEV_USER_ID ??
  "00000000-0000-0000-0000-000000000010";
export const DEV_TENANT_ID =
  process.env.NEXT_PUBLIC_DEV_TENANT_ID ??
  "00000000-0000-0000-0000-000000000001";

export const PROPERTY_DOCS_BUCKET = "property-documents";
export const TENANT_LOGOS_BUCKET = "tenant-logos";
