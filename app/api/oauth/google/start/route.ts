import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPE = "https://www.googleapis.com/auth/drive.file";

/**
 * GET /api/oauth/google/start?tenant_id=...
 *
 * Builds the Google OAuth consent URL and redirects the browser there.
 * We pass tenant_id as `state` so the callback knows which tenant to
 * attach the resulting tokens to (no Supabase Auth yet).
 *
 * `access_type=offline` + `prompt=consent` together guarantee Google
 * issues a refresh_token even on repeat consent.
 */
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { ok: false, error: "GOOGLE_CLIENT_ID is not configured" },
      { status: 500 }
    );
  }

  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenant_id");
  if (!tenantId) {
    return NextResponse.json(
      { ok: false, error: "tenant_id query param is required" },
      { status: 400 }
    );
  }

  // Build redirect_uri off the request's own origin so the same code works
  // for localhost dev + Vercel prod without env-var juggling.
  const origin =
    req.headers.get("x-forwarded-host")
      ? `${req.headers.get("x-forwarded-proto") ?? "https"}://${req.headers.get(
          "x-forwarded-host"
        )}`
      : url.origin;
  const redirectUri = `${origin}/api/oauth/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: tenantId,
  });

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}
