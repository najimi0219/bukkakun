import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  downloadFileFromDrive,
  ensureFreshAccessToken,
} from "@/lib/googleDrive";

export const runtime = "nodejs";

/**
 * GET /api/business-card/view?inquiry_id=...
 *   [&download=1]   -- if set, add Content-Disposition: attachment
 *
 * Returns the image bytes for an inquiry's attached business card.
 *
 * - For Supabase-stored cards we just 302 to a short-lived signed URL.
 * - For Drive-stored cards we proxy the download server-side using the
 *   tenant's refresh_token (the client never sees the access_token).
 *
 * This is intentionally NOT scoped to the requesting user — the inquiry_id
 * is hard to guess and the tenant's admin views these from the inquiry
 * detail modal. When real auth lands, gate by tenant_id == session.tenant_id.
 */
export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const gClientId = process.env.GOOGLE_CLIENT_ID;
  const gClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { ok: false, error: "Supabase env vars missing" },
      { status: 500 }
    );
  }
  const u = new URL(req.url);
  const inquiryId = u.searchParams.get("inquiry_id");
  const wantsDownload = u.searchParams.get("download") === "1";
  if (!inquiryId) {
    return NextResponse.json(
      { ok: false, error: "inquiry_id is required" },
      { status: 400 }
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: inq } = await supabase
    .from("inquiries")
    .select("tenant_id, business_card_url, business_card_provider")
    .eq("id", inquiryId)
    .maybeSingle();
  if (!inq?.business_card_url) {
    return NextResponse.json(
      { ok: false, error: "Card not found" },
      { status: 404 }
    );
  }

  const provider = (inq.business_card_provider as string | null) ?? "bukkenlink";

  // ----- Supabase route: signed URL redirect -----
  if (provider !== "gdrive") {
    const opts: { download?: string } = {};
    if (wantsDownload) {
      const base = (inq.business_card_url as string).split("/").pop() ?? "card.jpg";
      opts.download = base;
    }
    const { data, error } = await supabase.storage
      .from("business-cards")
      .createSignedUrl(inq.business_card_url as string, 300, opts);
    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { ok: false, error: error?.message ?? "Failed to sign URL" },
        { status: 500 }
      );
    }
    return NextResponse.redirect(data.signedUrl);
  }

  // ----- Drive route: proxy through us -----
  if (!gClientId || !gClientSecret) {
    return NextResponse.json(
      { ok: false, error: "Google credentials missing" },
      { status: 500 }
    );
  }
  const { data: conn } = await supabase
    .from("storage_connections")
    .select("id, refresh_token, access_token, token_expires_at")
    .eq("tenant_id", inq.tenant_id as string)
    .eq("provider", "gdrive")
    .eq("status", "connected")
    .maybeSingle();
  if (!conn?.refresh_token) {
    return NextResponse.json(
      { ok: false, error: "Tenant Drive connection not found" },
      { status: 404 }
    );
  }
  try {
    const fresh = await ensureFreshAccessToken({
      refresh_token: conn.refresh_token as string,
      access_token: (conn.access_token as string | null) ?? null,
      expires_at: conn.token_expires_at
        ? new Date(conn.token_expires_at as string).getTime()
        : null,
      clientId: gClientId,
      clientSecret: gClientSecret,
    });
    if (fresh.refreshed) {
      await supabase
        .from("storage_connections")
        .update({
          access_token: fresh.access_token,
          token_expires_at: new Date(fresh.expires_at).toISOString(),
        })
        .eq("id", conn.id);
    }
    const { bytes, contentType } = await downloadFileFromDrive({
      accessToken: fresh.access_token,
      fileId: inq.business_card_url as string,
    });
    const headers: Record<string, string> = {
      "Content-Type": contentType ?? "image/jpeg",
      // Short-lived browser cache so the modal doesn't refetch on every render.
      "Cache-Control": "private, max-age=120",
    };
    if (wantsDownload) {
      headers["Content-Disposition"] = `attachment; filename="card.jpg"`;
    }
    return new NextResponse(bytes, { headers });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
