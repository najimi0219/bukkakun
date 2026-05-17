import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  exchangeCodeForTokens,
  ensureFolder,
  GOOGLE_OAUTH_SCOPE,
} from "@/lib/googleDrive";

export const runtime = "nodejs";

/**
 * GET /api/oauth/google/callback?code=...&state=<tenant_id>
 *
 * Google redirects the user here after they consent. We:
 *   1) Exchange the code for an access + refresh token pair.
 *   2) Use the access token to create (or find) a top-level
 *      "BukkenLink" folder on the tenant's Drive — that's the root we
 *      land all uploads under.
 *   3) Upsert a storage_connections row for this tenant with the tokens
 *      and folder id.
 *   4) Redirect the user back to /settings/storage with a status flag.
 */
export async function GET(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!supabaseUrl || !serviceKey || !clientId || !clientSecret) {
    return errRedirect(req, "Server env vars missing");
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    return errRedirect(req, `Google から拒否されました: ${oauthError}`);
  }
  if (!code || !state) {
    return errRedirect(req, "code または state が不足しています");
  }
  const tenantId = state;

  const origin =
    req.headers.get("x-forwarded-host")
      ? `${req.headers.get("x-forwarded-proto") ?? "https"}://${req.headers.get(
          "x-forwarded-host"
        )}`
      : url.origin;
  const redirectUri = `${origin}/api/oauth/google/callback`;

  let tokens;
  try {
    tokens = await exchangeCodeForTokens({
      code,
      redirectUri,
      clientId,
      clientSecret,
    });
  } catch (e) {
    return errRedirect(req, e instanceof Error ? e.message : String(e));
  }

  // Create or find the top-level BukkenLink folder.
  let rootFolderId: string | null = null;
  try {
    rootFolderId = await ensureFolder({
      accessToken: tokens.access_token,
      name: "BukkenLink",
    });
  } catch (e) {
    return errRedirect(
      req,
      "Drive フォルダ作成に失敗: " + (e instanceof Error ? e.message : String(e))
    );
  }

  // Get tenant info for the display_name + account_email.
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: tenantRow } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("id", tenantId)
    .maybeSingle();
  if (!tenantRow) {
    return errRedirect(req, "テナントが見つかりません");
  }

  // Fetch the Google user info (email) for display.
  let accountEmail: string | null = null;
  try {
    const meRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo?fields=email",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    if (meRes.ok) {
      const me = await meRes.json();
      accountEmail = me.email ?? null;
    }
  } catch {
    /* non-fatal — we just won't have the email to display */
  }

  // Upsert the connection. If the tenant already had a gdrive connection
  // we replace its tokens (e.g. user re-authed to switch accounts).
  const expiresAt = new Date(
    Date.now() + tokens.expires_in * 1000
  ).toISOString();

  const { data: existing } = await supabase
    .from("storage_connections")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("provider", "gdrive")
    .maybeSingle();

  const baseRow = {
    tenant_id: tenantId,
    provider: "gdrive" as const,
    display_name: accountEmail
      ? `Google Drive (${accountEmail})`
      : "Google Drive",
    account_email: accountEmail ?? "",
    root_folder_id: rootFolderId,
    root_folder_name: "BukkenLink",
    status: "connected" as const,
    is_default: true,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: expiresAt,
    scope: tokens.scope ?? GOOGLE_OAUTH_SCOPE,
    last_sync_at: new Date().toISOString(),
  };

  if (existing?.id) {
    await supabase
      .from("storage_connections")
      .update(baseRow)
      .eq("id", existing.id);
  } else {
    await supabase.from("storage_connections").insert(baseRow);
  }

  // Done — bounce back to the settings page with a success flag.
  return NextResponse.redirect(
    `${origin}/settings/storage?connected=gdrive`
  );
}

function errRedirect(req: NextRequest, message: string): NextResponse {
  const url = new URL(req.url);
  const origin =
    req.headers.get("x-forwarded-host")
      ? `${req.headers.get("x-forwarded-proto") ?? "https"}://${req.headers.get(
          "x-forwarded-host"
        )}`
      : url.origin;
  const u = new URL(`${origin}/settings/storage`);
  u.searchParams.set("connect_error", message);
  return NextResponse.redirect(u.toString());
}
