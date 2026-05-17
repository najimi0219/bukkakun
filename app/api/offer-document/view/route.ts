import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  downloadFileFromDrive,
  ensureFreshAccessToken,
} from "@/lib/googleDrive";

export const runtime = "nodejs";

/**
 * GET /api/offer-document/view?inquiry_id=...
 *
 * Same shape as /api/business-card/view but for the 買付 (offer) document.
 * - Supabase-stored offers: redirect to a signed URL on the business-cards
 *   bucket (same bucket as cards, distinct path prefix).
 * - Drive-stored offers: proxy bytes server-side using the tenant's
 *   refresh_token so the client never sees the access token.
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
    .select("tenant_id, offer_document_url, offer_document_provider")
    .eq("id", inquiryId)
    .maybeSingle();
  if (!inq?.offer_document_url) {
    return NextResponse.json(
      { ok: false, error: "Offer not found" },
      { status: 404 }
    );
  }
  const provider =
    (inq.offer_document_provider as string | null) ?? "bukkenlink";

  if (provider !== "gdrive") {
    const opts: { download?: string } = {};
    if (wantsDownload) {
      const base =
        (inq.offer_document_url as string).split("/").pop() ?? "offer";
      opts.download = base;
    }
    const { data, error } = await supabase.storage
      .from("business-cards")
      .createSignedUrl(inq.offer_document_url as string, 300, opts);
    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { ok: false, error: error?.message ?? "Failed to sign URL" },
        { status: 500 }
      );
    }
    return NextResponse.redirect(data.signedUrl);
  }

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
      fileId: inq.offer_document_url as string,
    });
    const headers: Record<string, string> = {
      "Content-Type": contentType ?? "application/octet-stream",
      "Cache-Control": "private, max-age=120",
    };
    if (wantsDownload) {
      headers["Content-Disposition"] = `attachment; filename="offer"`;
    }
    return new NextResponse(bytes, { headers });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
